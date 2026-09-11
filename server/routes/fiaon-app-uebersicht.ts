// ═══════════════════════════════════════════════════════════════════════════
// DIE AKTE SIEHT, WAS DER KUNDE SIEHT (Scheibe 7, Modul C, 06.09.2026)
//
// ── WOFÜR ──────────────────────────────────────────────────────────────────
// Lücken-Audit 06.09.2026: Der Betreuer am Telefon sah NICHT, was sein Kunde
// in /app sieht — keinen Weg-Fortschritt, keine Vorgänge, keine Ansprüche,
// keine Vollmacht, keinen Monatsbericht. Er hat den Kunden gefragt, was auf
// dessen Bildschirm steht. Das ist die Umkehrung: EIN Endpunkt liefert der
// Akte genau die Lage, die der Kundenbereich zeichnet.
//
// ── KEINE ZWEITE WAHRHEIT ──────────────────────────────────────────────────
// Der Weg wird mit `rahmenwegAus` (shared/fiaon-rahmenweg.ts) gerechnet —
// derselben Funktion, die der Kunde in /app benutzt. Die Eingangsfelder kommen
// aus DENSELBEN Quellen wie GET /kunde/:ref/bereich (fiaon-kunde-bereich.ts):
//   · maßgebliche Bestellung, Unterlagen, Zahlstand  → fiaon_applications
//   · Startgespräch                                  → erledigter Onboarding-
//                                                      Termin ODER dokumentiertes
//                                                      Gespräch im Verlauf
//   · Bonität                                        → bonitaetFuer()
//   · Konto und Karte                                → kartenStand()
//   · Raten                                          → fiaon_abo_raten
//   · Anspruchs-Check                                → fiaon_anspruch_antworten
// Dieselbe Aufstellung baut server/lib/fiaon-monatsbericht.ts (wegRechnen) für
// den Monatsbericht. Sie steht dort nicht als Export zur Verfügung; deshalb ist
// `bereichEingangFuerPerson()` hier EXPORTIERT — wer als Nächstes den Weg
// serverseitig braucht, nimmt diese Funktion und schreibt keine dritte.
//
// ── GRENZEN ────────────────────────────────────────────────────────────────
// Alles hinter `requireAgent` UND der Zuständigkeitsprüfung aus
// ../lib/fiaon-kundenzugriff (Muster: vorgangFuerAgent in fiaon-app-antraege.ts).
// Lesen darf auch eine Ansichts-Sitzung, ÄNDERN nicht. Keine neuen Tabellen:
// 080/081/082 und fiaon_konto_karte, alles vorhanden.
// Berliner Datum ausschliesslich über formatToParts (Zeit-Falle 01.09.2026).
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import { tag, berlinHeute, ensureAppTabellen, antwortenLaden, STAND_TEXT, OFFENE_STAENDE } from "./fiaon-app";
import { rahmenwegAus, type BereichEingang, type Rahmenweg } from "@shared/fiaon-rahmenweg";
import { FRAGEN, REGELN, beantwortet, type Antworten } from "@shared/fiaon-ansprueche";

const router = Router();

const fehler = (res: Response, code: number, satz: string) => res.status(code).json({ ok: false, error: satz });

// Die Kundensätze zum Vorgangsstand (`STAND_TEXT`) und die Liste der offenen
// Stände kommen aus fiaon-app.ts — derselben Datei, die sie dem Kunden in
// GET /kunde/:ref/app/post ausliefert. Eine abgeschriebene Fassung hier wäre
// eine Karte, die zeigt, was auf dem Bildschirm des Kunden ÄHNLICH steht; genau
// diesen Fehler soll sie beheben.

// ── Zeit (Berlin, nur formatToParts) ────────────────────────────────────────
/** „2026-09-06“ — heute in Berlin. */
function heuteIso(): string { const h = berlinHeute(); return `${h.j}-${String(h.m).padStart(2, "0")}-${String(h.t).padStart(2, "0")}`; }
/** „YYYY-MM-DD“ aus einem Datenbankwert; null, wenn nichts Lesbares kommt. */
function isoVon(d: any): string | null {
  if (!d) return null;
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  const teile = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(x);
  const w = (art: string) => teile.find((p) => p.type === art)?.value ?? "";
  return `${w("year")}-${w("month")}-${w("day")}`;
}
/** „06.09.2026, 14:32“ — Berliner Zeit, ohne Number(format()). */
function zeitText(d: any): string | null {
  if (!d) return null;
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  const teile = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(x);
  const w = (art: string) => teile.find((p) => p.type === art)?.value ?? "00";
  const stunde = w("hour") === "24" ? "00" : w("hour");
  return `${w("day")}.${w("month")}.${w("year")}, ${stunde}:${w("minute")}`;
}

// ── Zuständigkeit (Muster: vorgangFuerAgent, fiaon-app-antraege.ts) ─────────
/**
 * Darf dieser Mitarbeiter an diesen Menschen? Liefert die person_id oder null
 * (dann ist die Antwort schon geschrieben).
 *
 * `schreibend` heißt in BEIDEN neuen Dateien dasselbe: true = er will etwas
 * ändern. Vorher hieß der dritte Parameter hier `nurLesen` und in
 * fiaon-app-ansprueche-agent.ts `schreibend` — gleicher Name, gleiche Signatur,
 * gegenteilige Bedeutung. Wer einen Aufruf von der einen Datei in die andere
 * kopiert (und das tut man, sie sehen gleich aus), hätte die Ansichts-Wand
 * still abgeschaltet, ohne dass irgendetwas rot wird.
 */
async function personFuerAgent(req: AgentRequest, res: Response, schreibend: boolean): Promise<number | null> {
  const personId = Number(req.params.personId);
  if (!Number.isInteger(personId) || personId <= 0) { fehler(res, 404, "Diesen Kunden gibt es nicht."); return null; }
  const [p] = (await sqlPool`SELECT id FROM fiaon_persons WHERE id = ${personId} LIMIT 1`) as any[];
  if (!p) { fehler(res, 404, "Diesen Kunden gibt es nicht."); return null; }
  const { rolleVon, darfAnKunde } = await import("../lib/fiaon-kundenzugriff");
  const rolle = req.agent?.rolle || await rolleVon(req.agent!.id);
  if (!(await darfAnKunde(req.agent!.id, rolle, personId))) { fehler(res, 403, "Dieser Kunde wird von jemand anderem betreut."); return null; }
  if (schreibend && req.agent?.ansicht) { fehler(res, 403, "In der Ansicht lässt sich nichts ändern."); return null; }
  return personId;
}

/**
 * Zusätzliche Tür NUR für die Kontomeldung — enger als `darfAnKunde`.
 *
 * `darfAnKunde` lässt die Rolle „agent“ an JEDEN unzugewiesenen Menschen
 * (Pool-Regel vom 25.08.2026: niemand besitzt Kunden vor dem Mandat, gemessen
 * 229 Personen). Diese Regel ist fürs LESEN gebaut. Hier hängt erstmals ein
 * SCHREIBknopf daran, der den sichtbaren Weg des Kunden verändert — dafür ist
 * sie zu weit. Melden darf, wer den Menschen betreut oder mit ihm einen Termin
 * hat bzw. hatte; die Leitung ohnehin.
 */
async function darfKontoMelden(agentId: number, rolle: string, personId: number): Promise<boolean> {
  if (rolle === "vertriebsleiter" || rolle === "admin") return true;
  const [p] = (await sqlPool`
    SELECT 1 AS ok FROM fiaon_persons WHERE id = ${personId} AND assigned_agent_id = ${agentId} LIMIT 1`) as any[];
  if (p) return true;
  const [t] = (await sqlPool`
    SELECT 1 AS ok FROM fiaon_termine WHERE person_id = ${personId} AND agent_id = ${agentId} LIMIT 1`) as any[];
  return !!t;
}

// ═══════════════════════════════════════════════════════════════════════════
// DER WEG — dieselben Quellen wie GET /kunde/:ref/bereich
// ═══════════════════════════════════════════════════════════════════════════
export interface EingangErgebnis {
  eingang: BereichEingang;
  /** Die maßgebliche Bestellung (bezahlte zuletzt, sonst die jüngste). */
  ref: string | null;
  check: { beantwortet: number; gesamt: number };
  vorgaengeVersandt: number;
  /** Kontoeröffnung aus fiaon_konto_karte; `am` als dd.mm.yyyy oder null. */
  konto: { eroeffnet: boolean; am: string | null; gemeldetVon: string | null };
}

/**
 * Die Felder, die `rahmenwegAus` braucht — für EINEN Menschen, serverseitig.
 *
 * Jede Quelle ist dieselbe wie im Kundenbereich. Fällt eine Nebenquelle aus
 * (Bonität, Kartenstand), bleibt das Feld null: Der Weg ist dann vorsichtiger,
 * aber nie falsch. Ein Fehler dort darf die Akte nicht mitreissen — dieselbe
 * Lehre wie am 26./27.08.2026 im Kundenbereich.
 */
export async function bereichEingangFuerPerson(personId: number): Promise<EingangErgebnis> {
  // Die maßgebliche Bestellung: bezahlte zuletzt, sonst die jüngste — dieselbe
  // Auswahlregel wie Login und Monatsbericht.
  //
  // ── DIE BONITÄTSAUSKUNFT IST KEINE BESTELLUNG DES PAKETS (06.09.2026) ────
  // Wer die 74 € bezahlt hat, hat ZWEI bezahlte Anträge, und die
  // SCHUFA-Bestellung ist die jüngere: Sie gewönne die Sortierung, brächte
  // aber weder Unterlagen noch wanted_limit noch Raten mit (fiaon_abo_raten
  // hängt an der ref des Pakets). GEMESSEN am 06.09.: 69 von 2.482 Personen —
  // und in der Stichprobe von 40 zahlenden Kunden wichen 3 Wege zwischen Akte
  // und Kundenbereich ab (u. a. „3 von 11“ hier gegen „5 von 11“ dort).
  // Der Ausschluss ist derselbe wie in server/lib/fiaon-konto-karte.ts.
  const [a] = (await sqlPool`
    SELECT a.ref, a.payment_status, a.wanted_limit, a.pack_key, a.approved_limit,
           (a.bank_statement_pdf IS NOT NULL) AS hat_kontoauszug, (a.id_card_pdf IS NOT NULL) AS hat_ausweis,
           a.reupload_bank_statement, a.reupload_id_card
      FROM fiaon_applications a
     WHERE a.person_id = ${personId} AND a.merged_into IS NULL AND a.archived_at IS NULL AND a.gdpr_deleted_at IS NULL
       AND a.ref NOT LIKE 'FIAON-SCHUFA-%' AND COALESCE(a.type, '') <> 'schufa'
     ORDER BY (a.payment_status = 'paid') DESC, a.created_at DESC LIMIT 1`) as any[];
  const ref: string | null = a?.ref ? String(a.ref) : null;

  // Startgespräch: erledigter Onboarding-Termin ODER dokumentiertes Gespräch
  // (fiaon-kunde-bereich.ts — nicht der Termin allein, sonst schickt die Anzeige
  // einen Menschen ein zweites Mal zur Buchung).
  const [ob] = (await sqlPool`
    SELECT EXISTS (SELECT 1 FROM fiaon_termine t WHERE t.person_id = ${personId} AND t.quelle = 'onboarding_call' AND t.status = 'erledigt') AS termin_erledigt,
           EXISTS (SELECT 1 FROM fiaon_contact_log cl WHERE cl.person_id = ${personId} AND cl.type IN ('onboarding', 'startgespraech')) AS gespraech_im_verlauf`) as any[];

  // Ein gebuchtes Startgespräch — sonst sagt der Weg „Zeit wählen“, obwohl der
  // Termin steht.
  //
  // DIESELBE WAHL WIE IM KUNDENBEREICH (fiaon-kunde-bereich.ts): erst ein
  // erledigtes Startgespräch, dann ein gebuchtes, dann JEDER gebuchte Termin in
  // der Zukunft — egal welcher Quelle. Vorher stand hier nur die zweite Zeile.
  // GEMESSEN am 06.09.: 24 Menschen haben einen kommenden gebuchten Termin
  // anderer Quelle. Bei ihnen sagte die Akte „Zeit wählen“, während der Kunde
  // auf seinem Bildschirm „Ihr Termin steht“ las. Zwei Ansagen für eine Lage —
  // genau das, was diese Karte beenden soll.
  const terminZeilen = (await sqlPool`
    SELECT t.beginn, t.status, t.quelle, (SELECT g.name FROM fiaon_agents g WHERE g.id = t.agent_id) AS agent
      FROM fiaon_termine t
     WHERE t.person_id = ${personId}
     ORDER BY t.beginn DESC LIMIT 5`) as any[];
  const jetzt = Date.now();
  const zeitVon = (x: any): number => { const d = x instanceof Date ? x : new Date(x); return Number.isNaN(d.getTime()) ? 0 : d.getTime(); };
  const nt = terminZeilen.find((t) => t.quelle === "onboarding_call" && t.status === "erledigt")
    || terminZeilen.find((t) => t.quelle === "onboarding_call" && t.status === "gebucht")
    || terminZeilen.find((t) => t.status === "gebucht" && zeitVon(t.beginn) > jetzt)
    || null;
  const termin: BereichEingang["termin"] = nt?.beginn
    ? { beginn: nt.beginn instanceof Date ? nt.beginn.toISOString() : String(nt.beginn), status: String(nt.status), agent: nt.agent ?? null }
    : null;

  // Bonität: dieselbe Funktion wie Bereich und Akte.
  let bonitaet: BereichEingang["bonitaet"] = null;
  if (ref) {
    try {
      const { bonitaetFuer } = await import("../lib/fiaon-bonitaet-status");
      const b = await bonitaetFuer(ref);
      // E-178: die automatische Auswertung zaehlt als „geprueft und erklaert“ (Schritt 7 des Weges).
      if (b) bonitaet = { hatDokument: !!b.hatDokument, geprueft: !!b.dokumentGeprueft || !!b.ausgewertet, darfKaufen: !!b.darfKaufen, bezahlt: !!b.bezahlt };
    } catch (e: any) { console.error("[UEBERSICHT] bonitaetFuer:", e?.message || e); }
  }

  // Konto und Karte: Tore und Versand — dieselbe Funktion wie Portal und Akte.
  let karte: BereichEingang["karte"] = null;
  try {
    const { kartenStand } = await import("../lib/fiaon-konto-karte");
    const ks = await kartenStand(personId);
    if (ks) karte = { verschickt: !!ks.versand, tore: (ks.tore || []).map((t) => ({ titel: t.titel, erfuellt: t.erfuellt })) };
  } catch (e: any) { console.error("[UEBERSICHT] kartenStand:", e?.message || e); }

  const raten = ref ? ((await sqlPool`
    SELECT rate_nr, betrag_cents, faellig_am, status, bezahlt_am FROM fiaon_abo_raten WHERE ref = ${ref} ORDER BY faellig_am ASC`) as any[]) : [];

  // Anspruchs-Check: dieselbe Ladefunktion und dieselbe Zählung wie der
  // Kundenweg und das Startgespräch (antwortenLaden aus fiaon-app.ts,
  // beantwortet aus shared/fiaon-ansprueche.ts). Keine dritte Abfrage über
  // dieselben Zeilen — sie wäre die erste, die jemand vergisst mitzuändern.
  const antworten: Antworten = await antwortenLaden(personId).catch(() => ({} as Antworten));
  const check = { beantwortet: beantwortet(antworten), gesamt: FRAGEN.length };

  // Versandte Anträge — dieselbe Zählung wie im Kundenbereich.
  const [vz] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_vorgaenge WHERE person_id = ${personId} AND stand IN ('versandt', 'nachfrage', 'bewilligt')`.catch(() => [])) as any[];

  const konto = await kontoStandLesen(personId);

  const eingang: BereichEingang = {
    // rahmenwegAus liest nur `bezahlt`; `vollAktiv` wertet es nicht aus.
    stufe: { bezahlt: String(a?.payment_status || "") === "paid", vollAktiv: false },
    onboardingGelaufen: !!(ob?.termin_erledigt || ob?.gespraech_im_verlauf),
    termin,
    unterlagen: {
      kontoauszug: !!a?.hat_kontoauszug, ausweis: !!a?.hat_ausweis,
      erneutKontoauszug: !!a?.reupload_bank_statement, erneutAusweis: !!a?.reupload_id_card,
    },
    kontoVerbunden: false,
    bonitaet,
    abo: { raten: raten.map((r) => ({ nr: Number(r.rate_nr), betragCents: Number(r.betrag_cents), status: String(r.status), faelligAm: tag(r.faellig_am), faelligIso: isoVon(r.faellig_am), bezahltAm: tag(r.bezahlt_am) })) },
    karte,
    // Schritt 10 des Weges („Girokonto eröffnet“) — dieselbe Regel wie
    // GET /kunde/:ref/bereich: nur ein gemeldeter oder vom Partner bestätigter
    // Stand zählt, „gesendet“ heisst nur, dass der Kunde den Weg bekommen hat.
    konto: { eroeffnet: konto.eroeffnet, am: konto.am },
    paket: { wunschlimit: a?.wanted_limit != null ? Number(a.wanted_limit) : null, rahmen: null },
    fahrplan: [],
  };

  return { eingang, ref, check, vorgaengeVersandt: Number(vz?.n || 0), konto };
}

/** Den Weg dieses Menschen rechnen — genau wie ihn sein Bereich zeichnet. */
export async function rahmenwegFuerPerson(personId: number): Promise<{ weg: Rahmenweg; erg: EingangErgebnis }> {
  const erg = await bereichEingangFuerPerson(personId);
  const weg = rahmenwegAus(erg.eingang, { heuteIso: heuteIso(), check: erg.check, vorgaengeVersandt: erg.vorgaengeVersandt });
  return { weg, erg };
}

// ═══════════════════════════════════════════════════════════════════════════
// KONTOERÖFFNUNG — gemeldet, nicht geraten
//
// Gelesen und geschrieben wird ausschliesslich über `kontoEroeffnung()` und
// `kontoEroeffnetMelden()` aus server/lib/fiaon-konto-karte.ts. Dort steht auch
// die Begründung: Der gemeldete Stand heisst 'gemeldet' und hat mit
// `gemeldet_am` eine eigene Spalte, damit `bestaetigt_am` und `bonus_cents`
// unberührt bleiben — an ihnen hängt die 10-€-Kontoprovision (E-067), und die
// darf keine Kundenaussage auslösen.
//
// Der Kundenbereich (GET /kunde/:ref/bereich) liest DIESELBE Funktion. Eine
// zweite Fassung hier hiesse: Akte und Kundenbereich zeigen verschiedene Konten.
// ═══════════════════════════════════════════════════════════════════════════
async function kontoStandLesen(personId: number): Promise<{ eroeffnet: boolean; am: string | null; gemeldetVon: string | null }> {
  const { kontoEroeffnung } = await import("../lib/fiaon-konto-karte");
  const k = await kontoEroeffnung(personId);
  return { eroeffnet: k.eroeffnet, am: k.am, gemeldetVon: k.gemeldetVon };
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /agent/app/kunde/:personId/uebersicht
// ═══════════════════════════════════════════════════════════════════════════
router.get("/agent/app/kunde/:personId/uebersicht", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureAppTabellen();
    const personId = await personFuerAgent(req, res, true); if (!personId) return;

    const { weg, erg } = await rahmenwegFuerPerson(personId);

    // ── Vorgänge — die Post des Kunden, mit seinem Stand-Satz ──────────────
    // `artTitel` kommt aus fiaon_vorgaenge.titel: Dort steht beim Anlegen
    // bereits der Titel der Regel (shared/fiaon-ansprueche) bzw. „Brief vom …“.
    // Eine vierte Kopie der ART_TITEL-Tabelle (fiaon-app.ts, fiaon-app-antraege.ts,
    // fiaon-monatsbericht.ts) entsteht hier deshalb nicht.
    const vorgangZeilen = (await sqlPool`
      SELECT v.id, v.art, v.titel, v.stand, v.stand_text, v.aktenzeichen, v.frist_am, v.versandt_am, v.empfaenger_name, v.created_at
        FROM fiaon_vorgaenge v WHERE v.person_id = ${personId}
       ORDER BY v.created_at DESC LIMIT 50`.catch(() => [])) as any[];
    const vorgaenge = vorgangZeilen.map((z) => ({
      id: Number(z.id), art: String(z.art), artTitel: String(z.titel || z.art),
      stand: String(z.stand), standText: z.stand_text || STAND_TEXT[String(z.stand)] || String(z.stand),
      aktenzeichen: z.aktenzeichen ?? null, fristAm: tag(z.frist_am), versandtAm: tag(z.versandt_am),
      empfaenger: z.empfaenger_name ?? null, angelegtAm: tag(z.created_at),
      offen: OFFENE_STAENDE.indexOf(String(z.stand)) !== -1,
    }));

    // ── Ansprüche — was der Check ergeben hat, mit Betrag und Stand ────────
    const anspruchZeilen = (await sqlPool`
      SELECT regel_schluessel, stand, betrag_cents, monatlich, frist_am, erkannt_am
        FROM fiaon_ansprueche WHERE person_id = ${personId} ORDER BY erkannt_am ASC`.catch(() => [])) as any[];
    const ansprueche = anspruchZeilen.map((z) => {
      const regel = REGELN.find((r) => r.schluessel === String(z.regel_schluessel)) ?? null;
      return {
        regelSchluessel: String(z.regel_schluessel), titel: regel?.titel ?? String(z.regel_schluessel),
        stand: String(z.stand), betragCents: z.betrag_cents == null ? null : Number(z.betrag_cents),
        monatlich: z.monatlich !== false, fristAm: tag(z.frist_am),
      };
    });

    // ── Vollmacht — die jüngste, egal ob aktiv, widerrufen oder abgelaufen ──
    const [vm] = (await sqlPool`
      SELECT umfang, gueltig_bis, signed_at, widerrufen_am, status
        FROM fiaon_vollmachten WHERE person_id = ${personId} ORDER BY created_at DESC LIMIT 1`.catch(() => [])) as any[];
    const heute = heuteIso();
    const gueltigBisIso = vm ? isoVon(vm.gueltig_bis) : null;
    const vollmacht = vm ? {
      aktiv: String(vm.status) === "unterschrieben" && !vm.widerrufen_am && !!gueltigBisIso && gueltigBisIso >= heute,
      gueltigBis: tag(vm.gueltig_bis),
      umfang: Array.isArray(vm.umfang) ? vm.umfang.map((x: any) => String(x)) : [],
      unterschriebenAm: tag(vm.signed_at),
      widerrufenAm: tag(vm.widerrufen_am),
    } : null;

    // ── Monatsbericht — der jüngste Beleg, den der Kunde bekommen hat ──────
    let bericht: { monat: string; monatText: string; grosseZahlCents: number; grosseZahlText: string; gelesenAm: string | null } | null = null;
    try {
      const { letzterBericht } = await import("../lib/fiaon-monatsbericht");
      const b = await letzterBericht(personId);
      if (b) bericht = { monat: b.monat, monatText: b.monatText, grosseZahlCents: b.grosseZahlCents, grosseZahlText: b.grosseZahlText, gelesenAm: b.gelesenAm };
    } catch (e: any) { console.error("[UEBERSICHT] letzterBericht:", e?.message || e); }

    // ── War der Kunde überhaupt schon drin? ───────────────────────────────
    // fiaon_app_ereignisse hält nur Bildschirm und Zeit fest (TFO-Vorgabe
    // 06.09.), nach 90 Tagen ist es weg. `bildschirme` zählt die verschiedenen
    // Bildschirme, die er je geöffnet hat — nicht die Aufrufe.
    const [be] = (await sqlPool`
      SELECT MAX(am) AS zuletzt, COUNT(DISTINCT bildschirm)::int AS bildschirme
        FROM fiaon_app_ereignisse WHERE person_id = ${personId}`.catch(() => [])) as any[];

    res.json({
      ok: true,
      personId,
      kundeRef: erg.ref,
      weg: {
        erledigt: weg.erledigt, gesamt: weg.gesamt,
        jetzt: weg.jetzt ? { key: weg.jetzt.key, titel: weg.jetzt.titel, kurz: weg.jetzt.kurz, wer: weg.jetzt.wer } : null,
        lage: weg.lage,
        raten: { gesamt: weg.raten.gesamt, bezahlt: weg.raten.bezahlt, puenktlich: weg.raten.puenktlich },
      },
      vorgaenge,
      ansprueche,
      vollmacht,
      bericht,
      check: erg.check,
      konto: { eroeffnet: erg.konto.eroeffnet, am: erg.konto.am, gemeldetVon: erg.konto.gemeldetVon },
      bereichBesucht: { zuletzt: zeitText(be?.zuletzt), bildschirme: Number(be?.bildschirme || 0) },
    });
  } catch (e: any) {
    console.error("[UEBERSICHT] laden:", e?.message || e);
    fehler(res, 500, "Der Kundenbereich lässt sich gerade nicht lesen. Lade die Karte gleich noch einmal.");
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /agent/app/kunde/:personId/konto-eroeffnet  { am?: "YYYY-MM-DD" }
//
// Der Mitarbeiter meldet, dass der Kunde sein Girokonto eröffnet hat. Das ist
// eine Aussage aus dem Gespräch, keine Bestätigung des Partners: Sie setzt
// `status = 'gemeldet'` und `gemeldet_am` — und rührt `bestaetigt_am` und
// `bonus_cents` nicht an. Auszahlbar wird die 10-€-Provision (E-067) allein
// mit der Bestätigung des Kooperationspartners.
// Idempotent: Ein zweiter Klick meldet nichts ein zweites Mal.
// ═══════════════════════════════════════════════════════════════════════════
router.post("/agent/app/kunde/:personId/konto-eroeffnet", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const personId = await personFuerAgent(req, res, true); if (!personId) return;

    // Engere Tür als beim Lesen — Begründung an `darfKontoMelden`.
    const { rolleVon } = await import("../lib/fiaon-kundenzugriff");
    const rolle = req.agent?.rolle || await rolleVon(req.agent!.id);
    if (!(await darfKontoMelden(req.agent!.id, rolle, personId))) {
      return fehler(res, 403, "Melden darf das nur, wer den Kunden betreut oder einen Termin mit ihm hat. Gib es seinem Betreuer durch.");
    }

    const heute = heuteIso();
    const roh = String(req.body?.am ?? "").trim();
    if (roh && !/^\d{4}-\d{2}-\d{2}$/.test(roh)) return fehler(res, 400, "Das Datum muss als JJJJ-MM-TT kommen.");
    const am = roh || heute;
    // Die Regex allein lässt „2026-13-45“ und „0001-01-01“ durch. Das erste
    // fiele erst in Postgres auf (500er statt Satz), das zweite stünde als
    // Erledigungsdatum von Schritt 10 im Weg des Kunden. Also wirklich prüfen:
    // Der Kalender muss das Datum kennen, und es darf nicht vor dem Bestehen
    // dieses Weges liegen.
    const geprueft = new Date(`${am}T12:00:00Z`);
    if (Number.isNaN(geprueft.getTime()) || geprueft.toISOString().slice(0, 10) !== am) {
      return fehler(res, 400, "Dieses Datum gibt es nicht — schau noch einmal auf Tag und Monat.");
    }
    if (am < "2024-01-01") return fehler(res, 400, "Das Datum liegt zu weit zurück — frag noch einmal nach.");
    if (am > heute) return fehler(res, 400, "Ein Konto lässt sich nicht für die Zukunft melden.");

    // Schreiben ausschliesslich über die Melde-Funktion der Bibliothek: Sie ist
    // idempotent, setzt 'gemeldet' + gemeldet_am und lässt bestaetigt_am und
    // bonus_cents in Ruhe.
    const { kontoEroeffnetMelden } = await import("../lib/fiaon-konto-karte");
    const erg = await kontoEroeffnetMelden(personId, req.agent!.id, req.agent!.name, am);
    if (erg.schonGemeldet) {
      return res.json({ ok: true, schonGemeldet: true, am: erg.stand.am, gemeldetVon: erg.stand.gemeldetVon,
        meldung: `Die Kontoeröffnung steht schon in der Akte${erg.stand.gemeldetVon ? ` (gemeldet von ${erg.stand.gemeldetVon})` : ""}.` });
    }

    // Der Verlauf hält fest, wer was gemeldet hat. `fiaon_contact_log.ref` ist
    // Pflichtfeld: Hat der Mensch keinen Antrag mehr (Zusammenführung, Löschung),
    // bleibt der Vermerk aus — eine erfundene Referenz wäre schlimmer als ein
    // fehlender Satz, und ein NULL dort schluckte der catch stillschweigend.
    const [ap] = (await sqlPool`
      SELECT ref FROM fiaon_applications WHERE person_id = ${personId} AND merged_into IS NULL ORDER BY created_at DESC LIMIT 1`.catch(() => [])) as any[];
    if (ap?.ref) {
      await sqlPool`
        INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note, created_at)
        VALUES (${String(ap.ref)}, ${personId}, ${req.agent!.id}, ${req.agent!.name}, 'system',
                ${`Konto & Karte: Kontoeröffnung gemeldet (Eröffnung am ${erg.stand.am ?? tag(am) ?? am}).`}, NOW())`
        .catch((e: any) => console.error("[UEBERSICHT] Konto-Vermerk:", e?.message || e));
    }

    console.log(`[UEBERSICHT] Kontoeröffnung Person ${personId} gemeldet von ${req.agent!.name} (${am})`);
    res.json({ ok: true, schonGemeldet: false, am: erg.stand.am ?? tag(am), meldung: "Eingetragen. Der Kunde sieht den Schritt jetzt in seinem Weg." });
  } catch (e: any) {
    console.error("[UEBERSICHT] konto-eroeffnet:", e?.message || e);
    fehler(res, 500, "Die Meldung ließ sich gerade nicht speichern. Versuch es gleich noch einmal.");
  }
});

export default router;
