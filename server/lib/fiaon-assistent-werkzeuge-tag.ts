// ═══════════════════════════════════════════════════════════════════════════
// DER TAG DES MITARBEITERS — drei freie, nur lesende Werkzeuge (02.09.2026)
//
// Justin: „Der Agent soll dem Mitarbeiter JEDE Arbeit abnehmen." Der erste
// Handgriff jedes Morgens ist derselbe: fünf Räume öffnen, um zu wissen, was
// heute ansteht. Das übernimmt der Copilot:
//
//   tagesbrief         Was steht heute an? Termine, Rückrufe, Zusagen,
//                      überfällige Raten, Aufträge, Posteingang, Verdienst.
//   fristen            Was läuft in den nächsten Tagen ab oder ist schon
//                      überfällig? Eine sortierte Liste mit Dringlichkeit.
//   anruf_vorbereiten  Alles für EINEN Anruf auf einer Karte: Lage, letzte
//                      Ereignisse, offene Zahlung, der passende Leitfaden mit
//                      den ersten zwei Sätzen, Hinweise (Konto gesperrt,
//                      Unterlagen fehlen).
//
// ── DIESELBEN REGELN WIE IN DER REGISTRY ───────────────────────────────────
// Kein Werkzeug hier liest die Datenbank. Jedes ruft BESTEHENDE Endpunkte
// über kontext.intern mit den Cookies des Menschen auf — die Wände des Hauses
// (requireAgent, darfAkteLesen, Rollen) gelten damit auch für den Copilot.
// Alle drei sind Stufe „frei": Sie verändern nichts.
//
// ── QUELLEN (alle vorhanden, keine neuen Endpunkte) ────────────────────────
//   GET /agent/start                    Zahlen, Zusagen, Rückrufe, Verdienst
//   GET /agent/termine                  gebuchte und unerledigte Termine
//   GET /agent/auftraege                Aufträge aus dem TODO-Board
//   GET /agent/inbox/uebersicht         Posteingang-Zahlen
//   GET /agent/vertrieb/bestand         Mandate mit Ratenstand
//   GET /agent/kunden/liste?person=     Kundenkarte
//   GET /agent/crm/kunden/:id/gespraech Stufe, Zahlungen, Dokumente, Karte
//   GET /agent/vertrieb/aktivitaet/:id  Ereignisse + KundenSituation
//   shared/fiaon-leitfaeden.ts          die Leitfäden (eine Quelle)
//   shared/fiaon-gespraechs-schritte.ts die Schritte zur Lage (eine Quelle)
//
// Fällt eine Quelle aus, fällt nur ihr Block aus (mit `fehler`), nicht der
// ganze Brief — ein halber Morgenbrief ist besser als keiner.
// ═══════════════════════════════════════════════════════════════════════════

import type { Werkzeug, WerkzeugKontext } from "./fiaon-assistent-werkzeuge";
import { formatBerlin } from "./fiaon-time";
import { leitfadenFuerLage, leitfadenVonKey } from "../../shared/fiaon-leitfaeden";
import { schritteFuer } from "../../shared/fiaon-gespraechs-schritte";

// Dieselbe Liste wie ALLE_ROLLEN in der Registry. Sie steht hier noch einmal,
// weil die Registry dieses Modul einbindet — ein Import in die Gegenrichtung
// wäre ein Kreis, und Konstanten aus einem Kreis sind beim Laden undefiniert.
const ROLLEN = ["agent", "onboarding", "inkasso", "vertriebsleiter", "admin", "chef"];

function fehler(text: string): { ok: false; error: string } {
  return { ok: false, error: text };
}

function alsZahl(wert: unknown): number {
  const n = Number(wert);
  return Number.isFinite(n) ? n : NaN;
}

/** Heutiges Datum in Berlin als JJJJ-MM-TT. */
function heuteBerlin(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
}

/** JJJJ-MM-TT von heute plus n Tage (Berliner Kalender). */
function tagPlus(n: number): string {
  const d = new Date(`${heuteBerlin()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Datum eines Zeitstempels in Berlin als JJJJ-MM-TT. */
function tagVon(zeit: unknown): string | null {
  if (!zeit) return null;
  const d = new Date(String(zeit));
  if (Number.isNaN(d.getTime())) return String(zeit).slice(0, 10);
  return d.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
}

const euro = (cents: unknown): string => `${(Number(cents || 0) / 100).toFixed(2).replace(".", ",")} €`;

/** Eine Quelle lesen — Ausfall wird zum Block mit `fehler`, nie zum Absturz. */
async function quelle(kontext: WerkzeugKontext, pfad: string): Promise<{ json: any; fehler: string | null }> {
  try {
    const r = await kontext.intern("GET", pfad);
    if (!r.json?.ok) return { json: null, fehler: r.json?.error || `HTTP ${r.status}` };
    return { json: r.json, fehler: null };
  } catch (e: any) {
    return { json: null, fehler: String(e?.message || "nicht erreichbar") };
  }
}

/** Die Lage in einem Satz — dieselben neun Arten wie KundenSituation.art. */
const LAGE_TEXT: Record<string, string> = {
  rate_ueberfaellig: "Eine Rate ist überfällig.",
  zusage_gebrochen: "Eine Zahlungszusage ist verstrichen.",
  rueckruf_faellig: "Ein vereinbarter Rückruf ist fällig.",
  bezahlt_ohne_termin: "Bezahlt, aber noch kein Startgespräch gebucht.",
  zahlung_gemeldet: "Der Kunde hat „Ich habe bezahlt“ geklickt — Eingang noch nicht bestätigt.",
  rechnung_offen: "Antrag fertig, die erste Rate ist noch nicht eingegangen.",
  lead_ohne_antrag: "Registriert, aber noch kein Antrag.",
  termin_heute: "Heute steht ein Termin an.",
  alles_gut: "Nichts Offenes — betreuter Kunde.",
};

interface Frist {
  art: "termin" | "rueckruf" | "zusage" | "rate" | "auftrag";
  dringlichkeit: "ueberfaellig" | "heute" | "bald";
  am: string | null;
  amText: string | null;
  personId: number | null;
  name: string | null;
  text: string;
}

/** Sammelt Termine, Rückrufe, Zusagen, überfällige Raten und Aufträge bis zum Horizont. */
async function fristenSammeln(kontext: WerkzeugKontext, tage: number): Promise<{ fristen: Frist[]; ausfaelle: string[] }> {
  const heute = heuteBerlin();
  const grenze = tagPlus(tage);
  const [start, termine, auftraege, bestand] = await Promise.all([
    quelle(kontext, "/agent/start"),
    quelle(kontext, "/agent/termine"),
    quelle(kontext, "/agent/auftraege"),
    quelle(kontext, "/agent/vertrieb/bestand"),
  ]);
  const ausfaelle: string[] = [];
  const fristen: Frist[] = [];
  const stufe = (tag: string | null): Frist["dringlichkeit"] => (!tag || tag < heute ? "ueberfaellig" : tag === heute ? "heute" : "bald");

  if (termine.fehler) ausfaelle.push(`Termine: ${termine.fehler}`);
  for (const t of termine.json?.termine || []) {
    const tag = tagVon(t.beginn);
    const verpasst = t.status === "verpasst";
    if (!verpasst && tag && tag > grenze) continue;
    fristen.push({
      art: "termin", dringlichkeit: verpasst ? "ueberfaellig" : stufe(tag), am: t.beginn ?? null, amText: t.beginn ? formatBerlin(t.beginn) : null,
      personId: t.personId ?? null, name: t.name ?? null,
      text: `${t.terminArtText || "Termin"}${verpasst ? " — verpasst, noch nicht abgearbeitet" : ""}${t.notiz ? ` · ${String(t.notiz).slice(0, 80)}` : ""}`,
    });
  }

  if (start.fehler) ausfaelle.push(`Start: ${start.fehler}`);
  for (const r of start.json?.rueckrufe || []) {
    const tag = tagVon(r.am);
    if (tag && tag > grenze) continue;
    fristen.push({ art: "rueckruf", dringlichkeit: stufe(tag), am: r.am ?? null, amText: r.am ? formatBerlin(r.am) : null, personId: r.personId ?? null, name: r.name ?? null, text: `Rückruf${r.notiz ? ` · ${String(r.notiz).slice(0, 80)}` : ""}` });
  }
  for (const z of start.json?.zusagen || []) {
    const tag = z.zusagedatum ?? z.zusageAm ?? z.promised_payment_date ?? null; // /agent/start liefert `zusagedatum`
    const t = tag ? String(tag).slice(0, 10) : null;
    if (t && t > grenze) continue;
    fristen.push({ art: "zusage", dringlichkeit: stufe(t), am: t, amText: t, personId: z.personId ?? z.id ?? null, name: z.name ?? null, text: `Zahlungszusage${z.betrag ? ` über ${z.betrag} €` : ""}` });
  }

  if (bestand.fehler) ausfaelle.push(`Bestand: ${bestand.fehler}`);
  for (const m of bestand.json?.mandate || []) {
    const n = Number(m?.raten?.ueberfaellig || 0);
    if (n <= 0) continue;
    fristen.push({
      art: "rate", dringlichkeit: "ueberfaellig", am: null, amText: m.raten?.ueberfaelligSeitTagen != null ? `seit ${m.raten.ueberfaelligSeitTagen} Tagen` : null,
      personId: m.kunde?.personId ?? null, name: m.kunde?.name ?? null,
      text: `${n} Rate${n === 1 ? "" : "n"} überfällig${m.raten?.ruecklastschrift ? " · Rücklastschrift" : ""}${m.monatsrateCents ? ` · Rate ${euro(m.monatsrateCents)}` : ""}`,
    });
  }

  if (auftraege.fehler) ausfaelle.push(`Aufträge: ${auftraege.fehler}`);
  for (const a of auftraege.json?.auftraege || []) {
    const tag = a.faelligAm ? String(a.faelligAm).slice(0, 10) : null;
    if (!tag && !a.frageAnAgent) continue;
    if (tag && tag > grenze) continue;
    fristen.push({ art: "auftrag", dringlichkeit: tag ? stufe(tag) : "heute", am: tag, amText: tag, personId: null, name: null, text: `Auftrag #${a.id}: ${a.titel}${a.frageAnAgent ? " · Rückfrage vom Betreiber wartet auf dich" : ""}` });
  }

  const rang: Record<Frist["dringlichkeit"], number> = { ueberfaellig: 0, heute: 1, bald: 2 };
  fristen.sort((a, b) => rang[a.dringlichkeit] - rang[b.dringlichkeit] || String(a.am || "").localeCompare(String(b.am || "")));
  return { fristen, ausfaelle };
}

export const WERKZEUGE_TAG: Werkzeug[] = [
  {
    name: "tagesbrief",
    titel: "Tagesbrief",
    beschreibung:
      "Der Morgenbrief des Mitarbeiters: heutige Termine, fällige Rückrufe, Zahlungszusagen, überfällige Raten, "
      + "offene Aufträge vom Betreiber, Posteingang-Zahlen und Verdienst des Monats — in einem Aufruf. Benutzen bei "
      + "„Was steht heute an?“, „Guten Morgen“, „Womit fange ich an?“ oder zu Beginn des Tages.",
    stufe: "frei",
    zugang: "agent",
    rollen: ROLLEN,
    jsonSchema: { type: "object", properties: {}, additionalProperties: false },
    ausfuehren: async (_p, kontext) => {
      const heute = heuteBerlin();
      const [start, termine, auftraege, inbox, bestand] = await Promise.all([
        quelle(kontext, "/agent/start"),
        quelle(kontext, "/agent/termine"),
        quelle(kontext, "/agent/auftraege"),
        quelle(kontext, "/agent/inbox/uebersicht?filter=offen"),
        quelle(kontext, "/agent/vertrieb/bestand"),
      ]);
      const termineHeute = (termine.json?.termine || [])
        .filter((t: any) => t.heute === true || tagVon(t.beginn) === heute)
        .map((t: any) => ({ personId: t.personId, name: t.name, uhrzeit: t.uhrzeit || (t.beginn ? formatBerlin(t.beginn) : null), art: t.terminArtText || t.quelle || "Termin", status: t.status, telefon: t.telefon ?? null, notiz: t.notiz ?? null }));
      const verpasst = (termine.json?.termine || []).filter((t: any) => t.status === "verpasst").length;
      const ueberfaellig = (bestand.json?.mandate || [])
        .filter((m: any) => Number(m?.raten?.ueberfaellig || 0) > 0)
        .sort((a: any, b: any) => Number(b.raten?.ueberfaelligSeitTagen || 0) - Number(a.raten?.ueberfaelligSeitTagen || 0));
      const offeneAuftraege = auftraege.json?.auftraege || [];
      const k = start.json?.kunden || null;
      const v = start.json?.verdienst || null;
      const z = inbox.json?.zahlen || null;

      // Die Zeilen, die ein Mensch morgens hören will — Zahlen erst dahinter.
      const zeilen: string[] = [];
      if (termineHeute.length) zeilen.push(`${termineHeute.length} Termin${termineHeute.length === 1 ? "" : "e"} heute`);
      if (verpasst) zeilen.push(`${verpasst} verpasste${verpasst === 1 ? "r" : ""} Termin${verpasst === 1 ? "" : "e"} noch nicht abgearbeitet`);
      if ((start.json?.rueckrufe || []).length) zeilen.push(`${start.json.rueckrufe.length} Rückruf${start.json.rueckrufe.length === 1 ? "" : "e"} fällig`);
      if (k?.zusageHeute) zeilen.push(`${k.zusageHeute} Zahlungszusage${k.zusageHeute === 1 ? "" : "n"} für heute`);
      if (k?.zusageUeberfaellig) zeilen.push(`${k.zusageUeberfaellig} verstrichene Zusage${k.zusageUeberfaellig === 1 ? "" : "n"}`);
      if (ueberfaellig.length) zeilen.push(`${ueberfaellig.length} Mandat${ueberfaellig.length === 1 ? "" : "e"} mit überfälliger Rate`);
      if (offeneAuftraege.length) zeilen.push(`${offeneAuftraege.length} offene${offeneAuftraege.length === 1 ? "r" : ""} Auftrag${offeneAuftraege.length === 1 ? "" : "e"}${offeneAuftraege.filter((a: any) => a.frageAnAgent).length ? " (mit Rückfrage an dich)" : ""}`);
      if (z?.zuBeantworten) zeilen.push(`${z.zuBeantworten} Vorg${z.zuBeantworten === 1 ? "ang" : "änge"} im Posteingang zu beantworten`);
      if (!zeilen.length) zeilen.push("Nichts Dringendes — freie Bahn für die Arbeitsliste.");

      return {
        ok: true,
        datum: heute,
        kurz: zeilen,
        termineHeute,
        rueckrufe: (start.json?.rueckrufe || []).map((r: any) => ({ personId: r.personId, name: r.name, am: r.am ? formatBerlin(r.am) : null, telefon: r.telefon ?? null, notiz: r.notiz ?? null })),
        zusagen: (start.json?.zusagen || []).slice(0, 10).map((s: any) => ({ personId: s.personId ?? s.id ?? null, name: s.name ?? null, am: s.zusagedatum ? String(s.zusagedatum).slice(0, 10) : (s.zusageAm ?? null), telefon: s.telefon ?? null })),
        ueberfaelligeRaten: {
          anzahl: ueberfaellig.length,
          erste: ueberfaellig.slice(0, 8).map((m: any) => ({ personId: m.kunde?.personId ?? null, name: m.kunde?.name ?? null, raten: Number(m.raten?.ueberfaellig || 0), seitTagen: m.raten?.ueberfaelligSeitTagen ?? null, ruecklastschrift: !!m.raten?.ruecklastschrift, rate: m.monatsrateCents ? euro(m.monatsrateCents) : null })),
        },
        auftraege: {
          anzahl: offeneAuftraege.length,
          erste: offeneAuftraege.slice(0, 8).map((a: any) => ({ id: a.id, titel: a.titel, faelligAm: a.faelligAm ?? null, status: a.status, rueckfrage: !!a.frageAnAgent, prioritaet: a.prioritaet })),
        },
        posteingang: z ? { zuBeantworten: z.zuBeantworten, anliegen: z.anliegen, verpassteAnrufe: z.anrufe, rueckrufwuensche: z.rueckrufe, postKaputt: z.postKaputt, neu24h: z.neu24 } : null,
        kunden: k ? { arbeitslisteOffen: k.offen, zahlungGemeldet: k.tier1, rechnungOffen: k.tier2, leads: k.tier3, mitOffenerRate: k.rateOffen } : null,
        verdienst: v ? { monat: euro(v.monatCents), monatsziel: v.monatszielCents ? euro(v.monatszielCents) : null, guthaben: euro(v.guthabenCents), moeglich: euro(v.moeglichCents) } : null,
        ausfaelle: [start, termine, auftraege, inbox, bestand].map((q, i) => q.fehler ? `${["Start", "Termine", "Aufträge", "Posteingang", "Bestand"][i]}: ${q.fehler}` : null).filter(Boolean),
      };
    },
  },
  {
    name: "fristen",
    titel: "Fristen prüfen",
    beschreibung:
      "Der Fristenwächter: alles, was überfällig ist oder in den nächsten Tagen fällig wird — Termine (auch verpasste, "
      + "nicht abgearbeitete), Rückrufe, Zahlungszusagen, überfällige Raten, Aufträge mit Fälligkeit. Sortiert nach "
      + "Dringlichkeit. Benutzen bei „Was läuft ab?“, „Habe ich etwas verpasst?“, „Was ist überfällig?“.",
    stufe: "frei",
    zugang: "agent",
    rollen: ROLLEN,
    jsonSchema: {
      type: "object",
      properties: {
        tage: { type: "integer", description: "Horizont in Tagen ab heute (1 bis 14, Standard 3)" },
      },
      additionalProperties: false,
    },
    ausfuehren: async (p, kontext) => {
      const tage = Math.min(14, Math.max(1, Math.round(alsZahl(p?.tage) || 3)));
      const { fristen, ausfaelle } = await fristenSammeln(kontext, tage);
      return {
        ok: true,
        horizontTage: tage,
        anzahl: fristen.length,
        ueberfaellig: fristen.filter((f) => f.dringlichkeit === "ueberfaellig").length,
        heute: fristen.filter((f) => f.dringlichkeit === "heute").length,
        fristen: fristen.slice(0, 40),
        ausfaelle,
      };
    },
  },
  {
    name: "anruf_vorbereiten",
    titel: "Anruf vorbereiten",
    beschreibung:
      "Bereitet EINEN Anruf vor: Kundenkarte, Lage in einem Satz, offene Zahlung oder nächste Rate, nächster Termin, "
      + "die letzten Ereignisse, der passende Leitfaden (Stufe A/B/C, Reaktivierung, Rückruf, Startgespräch) mit den "
      + "ersten zwei Sätzen, die Schritte zur Lage und Hinweise (Konto gesperrt, Unterlagen fehlen). Braucht die "
      + "personId aus kunde_suchen. Benutzen bei „Bereite den Anruf mit … vor“, „Ich rufe gleich … an“.",
    stufe: "frei",
    zugang: "agent",
    rollen: ROLLEN,
    jsonSchema: {
      type: "object",
      properties: {
        personId: { type: "integer", description: "Kennung des Kunden (personId)" },
      },
      required: ["personId"],
      additionalProperties: false,
    },
    betroffenePersonen: (p) => [alsZahl(p?.personId)].filter((n) => Number.isFinite(n)),
    ausfuehren: async (p, kontext) => {
      const id = alsZahl(p?.personId);
      if (!Number.isFinite(id) || id <= 0) return fehler("personId fehlt.");
      const [karte, gespraech, aktivitaet] = await Promise.all([
        quelle(kontext, `/agent/kunden/liste?person=${id}&limit=1`),
        quelle(kontext, `/agent/crm/kunden/${id}/gespraech`),
        quelle(kontext, `/agent/vertrieb/aktivitaet/${id}`),
      ]);
      const k = karte.json?.kunden?.[0] || null;
      if (!k && gespraech.fehler && aktivitaet.fehler) {
        return fehler(`Kunde ${id} ist für dich nicht lesbar (${gespraech.fehler}).`);
      }
      const situation = aktivitaet.json?.situation || null;
      const lage: string = situation?.art || "alles_gut";
      const leitfadenKey = leitfadenFuerLage(lage, situation?.terminHeuteQuelle ?? null);
      const leitfaden = leitfadenVonKey(leitfadenKey);
      const g = gespraech.json || {};

      const hinweise: string[] = [];
      if (k?.kontoGesperrt || k?.konto_gesperrt) hinweise.push("Das Konto ist GESPERRT — der Kunde kommt nicht in seinen Bereich. Grund steht im Verlauf.");
      if (g.dokumente && g.dokumente.vollstaendig === false) hinweise.push("Unterlagen unvollständig (Kontoauszug/Ausweis) — im Gespräch erbitten.");
      if (g.karte && g.karte.esFehlt && Array.isArray(g.karte.esFehlt) && g.karte.esFehlt.length) hinweise.push(`Für Konto und Karte fehlt noch: ${g.karte.esFehlt.join(", ")}.`);
      if (situation?.rate) hinweise.push(`Rate ${situation.rate.nr} über ${euro(situation.rate.betragCents)} ist seit ${situation.rate.tage} Tagen überfällig${situation.rate.lastschriftStatus === "fehlgeschlagen" ? " (Rücklastschrift)" : ""}${situation.rate.referenz ? ` — Referenz ${situation.rate.referenz}` : ""}.`);
      if (situation?.terminHeute) hinweise.push(`Heute steht ein Termin an (${formatBerlin(situation.terminHeute)}) — dessen Gesprächsart bestimmt den Leitfaden.`);
      hinweise.push("Karte und Konto sind Ziel, nie Zusage — die Bank entscheidet. Keine Garantie, keine Beratung, kein „Score verbessern“.");

      const ereignisse = (aktivitaet.json?.ereignisse || [])
        .filter((e: any) => e.kat !== "klick")
        .slice(0, 6)
        .map((e: any) => ({ am: e.am ? formatBerlin(e.am) : null, art: e.kat, titel: e.titel, detail: e.detail ?? null }));

      return {
        ok: true,
        kunde: k ? {
          personId: k.personId ?? id, name: k.name ?? null, telefon: k.telefon ?? k.primary_phone ?? null, email: k.email ?? k.primary_email ?? null,
          paket: k.produkt ?? k.pack_name ?? null, zahlungsstatus: k.zahlungsstatus ?? null, titel: k.titel ?? null, kontoGesperrt: !!(k.kontoGesperrt ?? k.konto_gesperrt),
        } : { personId: id },
        lage: { art: lage, text: LAGE_TEXT[lage] || lage, stufe: g.stufe ?? null, naechsterSchritt: g.stufe?.naechsterSchritt ?? null },
        zahlung: {
          ueberfaelligeRate: situation?.rate ? { nr: situation.rate.nr, betrag: euro(situation.rate.betragCents), faelligAm: situation.rate.faelligAm, tage: situation.rate.tage, referenz: situation.rate.referenz, sepa: situation.rate.sepaEingerichtet } : null,
          naechsteRate: situation?.naechsteRate ? { faelligAm: situation.naechsteRate.faelligAm, betrag: euro(situation.naechsteRate.betragCents) } : null,
          zusageAm: situation?.zusageAm ?? null,
          letzteZahlungen: Array.isArray(g.zahlungen) ? g.zahlungen.slice(0, 3) : null,
        },
        termin: g.naechsterTermin ? { beginn: g.naechsterTermin.beginn, text: formatBerlin(g.naechsterTermin.beginn), quelle: g.naechsterTermin.quelle } : null,
        letzteEreignisse: ereignisse,
        verlauf: (g.verlauf || []).slice(0, 3),
        leitfaden: {
          key: leitfaden.key, titel: leitfaden.label, kurz: leitfaden.kurz,
          ersteSaetze: leitfaden.schritte.slice(0, 2).map((s) => s.satz).filter(Boolean),
          schritte: leitfaden.schritte.map((s) => ({ titel: s.titel, was: s.text ?? null, satz: s.satz ?? null })),
          einwaende: leitfaden.einwaende,
        },
        schritteZurLage: schritteFuer(lage).map((s) => ({ titel: s.titel, satz: s.satz })),
        hinweise,
        ausfaelle: [karte, gespraech, aktivitaet].map((q, i) => q.fehler ? `${["Karte", "Gespräch", "Aktivität"][i]}: ${q.fehler}` : null).filter(Boolean),
      };
    },
  },
];
