// ═══════════════════════════════════════════════════════════════════════════
// DIE WERKZEUGE DES FIAON COPILOT — die einzige Handlungsschicht (30.08.2026)
//
// Der KI-Assistent handelt AUSSCHLIESSLICH über diese Registry. Jedes Werkzeug
// ruft einen BESTEHENDEN internen Endpunkt über HTTP auf — mit den Cookies des
// angemeldeten Menschen. Dadurch gelten alle Wände des Hauses automatisch auch
// für den Assistenten: requireAgent, darfAnKunde, nurLesenWand, die
// Sende-Sperren, die Rollenprüfungen. Der Assistent bekommt keinen einzigen
// Weg, den der Mensch am Bildschirm nicht auch hätte.
//
// ── DIE ZWEI STUFEN ────────────────────────────────────────────────────────
//   „frei"        liest oder notiert — führt der Assistent sofort aus.
//   „bestaetigen" hat Folgen für Geld, Zugänge oder Kundenkommunikation.
//                 Der Assistent bereitet die Aktion VOLLSTÄNDIG vor (inklusive
//                 Vorschau, wo es eine gibt) und rendert eine Bestätigungs-
//                 karte. Ausgeführt wird erst nach Klick des Menschen —
//                 POST /agent/assistent/bestaetigen/:id. Kein Automatik-Modus,
//                 der das übergeht.
//
// ── HARTE GRENZEN (Code, nicht Prompt) ─────────────────────────────────────
//   · Keine Löschungen, keine DSGVO-Aktionen, keine Zahlungs-/Ratenbuchung:
//     solche Werkzeuge EXISTIEREN hier nicht, und der Motor führt nur aus,
//     was in dieser Registry steht.
//   · Höchstens 5 Kunden je Auftrag — zählt der Motor über betroffenePersonen.
//   · Kundengerichtete Freitexte laufen durch die Wortverbots-Prüfung unten.
//
// ── EINE ABWEICHUNG VOM AUFTRAG, MIT BEGRÜNDUNG ────────────────────────────
// Der Auftrag nannte für Notizen POST /agent/onboarding/person/:id/notiz.
// Diese Route verlangt ein Startgespräch des aufrufenden Mitarbeiters mit
// genau diesem Kunden (404 sonst) — ein Vertriebler könnte also an fast
// keinem seiner Kunden eine Notiz hinterlassen. Die Oberfläche der Kundenakte
// (kunden-neu.tsx) schreibt Notizen über POST /agent/crm/kunden/:id/aktivitaet
// mit art=notiz — derselbe Verlauf, dieselbe Tabelle, für alle Rollen mit
// Kundenzugriff. Das Werkzeug nimmt deshalb diesen Weg.
// ═══════════════════════════════════════════════════════════════════════════

import { parseBerlinInput, formatBerlin } from "./fiaon-time";
import { WERKZEUGE_TAG } from "./fiaon-assistent-werkzeuge-tag";
import { WERKZEUGE_WISSEN } from "./fiaon-assistent-werkzeuge-wissen";

// ── Der interne Selbst-Aufruf ────────────────────────────────────────────────
// Der Motor reicht eine Funktion herein, die einen bestehenden Endpunkt über
// HTTP aufruft — mit den Cookies der laufenden Sitzung. Werkzeuge kennen kein
// fetch, keine Ports und keine Cookies; sie kennen nur Pfade.
export type InternerAufruf = (
  methode: "GET" | "POST",
  pfad: string,
  body?: unknown,
) => Promise<{ status: number; json: any }>;

export interface WerkzeugKontext {
  /** Mitarbeiter-Kennung — im Chefbüro mit altem Admin-Cookie null. */
  agentId: number | null;
  /** Anzeigename des Menschen, in dessen Auftrag gehandelt wird. */
  name: string;
  /** Rolle: agent | onboarding | inkasso | vertriebsleiter | admin — oder „chef". */
  rolle: string;
  istChef: boolean;
  intern: InternerAufruf;
}

export type WerkzeugStufe = "frei" | "bestaetigen";

export interface WerkzeugVorschau {
  /** Ein Satz, der die Aktion vollständig beschreibt — steht auf der Karte. */
  zusammenfassung: string;
  /** Echte E-Mail-Vorschau (HTML) — wird im iframe gezeigt, wo es sie gibt. */
  vorschauHtml?: string | null;
  /** Warnhinweis auf der Karte (z. B. fehlende Felder aus der Mail-Vorschau). */
  warnung?: string | null;
}

export interface Werkzeug {
  name: string;
  /** Beschreibung für das Modell — sagt WAS und WANN, nicht WIE. */
  beschreibung: string;
  /** Menschenlesbarer Titel für die Aktionskarte. */
  titel: string;
  stufe: WerkzeugStufe;
  /** Rollen, die das Werkzeug in ihrer Toolliste bekommen. „chef" = Chefbüro. */
  rollen: string[];
  /**
   * Welche Tür die internen Aufrufe brauchen: „agent" (fiaon_agent_token) oder
   * „chef" (fiaon_chef). Im Chefbüro mit dem ALTEN Admin-Cookie gibt es keine
   * Mitarbeiter-Kennung — dann bleiben nur die „chef"-Werkzeuge übrig, und der
   * Motor sagt das, statt mit 401 ins Leere zu laufen.
   * „offen" (02.09.2026): braucht keine Tür — nur öffentliche Endpunkte oder
   * gar keine (Wissen nachschlagen). Steht in jeder Toolliste.
   */
  zugang: "agent" | "chef" | "offen";
  /** JSON-Schema der Parameter (OpenAI-Format, Feld parameters). */
  jsonSchema: Record<string, unknown>;
  /** Welche Kunden berührt dieser Aufruf? Grundlage der 5-Kunden-Grenze. */
  betroffenePersonen?: (parameter: any) => Array<number | string>;
  /** Baut die Bestätigungskarte VOR der Ausführung (nur Stufe „bestaetigen"). */
  vorschau?: (parameter: any, kontext: WerkzeugKontext) => Promise<WerkzeugVorschau>;
  /** Führt aus — ausschließlich über bestehende Endpunkte. */
  ausfuehren: (parameter: any, kontext: WerkzeugKontext) => Promise<any>;
}

// ── Wortverbote in kundengerichteten Texten ──────────────────────────────────
// Compliance-Regel des Hauses: Die Karte ist ZIEL, nie Zusage; niemand berät,
// niemand garantiert, niemand „verbessert den Score". Geprüft wird serverseitig
// — ein Prompt kann vergessen werden, diese Liste nicht.
const WORTVERBOTE: Array<{ muster: RegExp; wort: string }> = [
  { muster: /berat/i, wort: "Beratung/beraten" },
  { muster: /empfehl/i, wort: "Empfehlung/empfehlen" },
  { muster: /garant/i, wort: "Garantie/garantiert" },
  { muster: /sicher\s+klappt/i, wort: "sicher klappt" },
  { muster: /verbessern\s+ihren\s+score/i, wort: "wir verbessern Ihren Score" },
  { muster: /score\s+verbessern/i, wort: "Score verbessern" },
  { muster: /l(ö|oe)schung\s+garantiert/i, wort: "Löschung garantiert" },
];

/** Liefert die verletzten Verbote — leer heißt: der Text darf raus. */
export function verboteneKundenworte(text: string): string[] {
  const t = String(text || "");
  const treffer: string[] = [];
  for (const v of WORTVERBOTE) if (v.muster.test(t)) treffer.push(v.wort);
  return Array.from(new Set(treffer));
}

// ── Hilfen ──────────────────────────────────────────────────────────────────
function alsZahl(wert: unknown): number {
  const n = Number(wert);
  return Number.isFinite(n) ? n : NaN;
}

function fehler(text: string): { ok: false; error: string } {
  return { ok: false, error: text };
}

/** Kompakte Kundenkarte fürs Modell — nur, was ein Gespräch braucht. */
function kundeKompakt(k: any): Record<string, unknown> {
  return {
    personId: k.personId ?? k.id ?? null,
    name: k.name ?? null,
    email: k.email ?? k.primary_email ?? null,
    telefon: k.telefon ?? k.primary_phone ?? null,
    ref: k.ref ?? null,
    paket: k.produkt ?? k.pack_name ?? null,
    zahlungsstatus: k.zahlungsstatus ?? null,
    kontoGesperrt: k.kontoGesperrt ?? k.konto_gesperrt ?? false,
    titel: k.titel ?? null,
    hinweis: k.hinweis ?? null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE REGISTRY — ein Eintrag je Werkzeug. Erweiterbar: neuer Eintrag, fertig.
// ═══════════════════════════════════════════════════════════════════════════

const ALLE_ROLLEN = ["agent", "onboarding", "inkasso", "vertriebsleiter", "admin", "chef"];

export const WERKZEUGE: Werkzeug[] = [
  // ── Der Tag (02.09.2026, Scheibe 2): Tagesbrief, Fristen, Anruf vorbereiten ─
  // Drei freie, nur lesende Werkzeuge in eigener Datei — dieselben Regeln.
  ...WERKZEUGE_TAG,
  // ── Das Wissen (02.09.2026, Scheibe 6): nachschlagen mit Stand und Quelle ─
  ...WERKZEUGE_WISSEN,
  // ── Lesen und Notieren (Stufe „frei") ─────────────────────────────────────
  {
    name: "kunde_suchen",
    titel: "Kunden suchen",
    beschreibung:
      "Sucht Kunden nach Name, E-Mail, Telefonnummer oder Referenz und liefert eine kompakte Trefferliste "
      + "mit personId, Kontaktdaten, Paket und Zahlungsstand. Immer zuerst benutzen, wenn nur ein Name genannt wird.",
    stufe: "frei",
    zugang: "agent",
    rollen: ALLE_ROLLEN,
    jsonSchema: {
      type: "object",
      properties: {
        suchtext: { type: "string", description: "Name, E-Mail, Rufnummer oder Referenz" },
      },
      required: ["suchtext"],
      additionalProperties: false,
    },
    ausfuehren: async (p, kontext) => {
      const q = String(p?.suchtext || "").trim();
      if (q.length < 2) return fehler("Bitte mindestens zwei Zeichen Suchtext angeben.");
      const r = await kontext.intern("GET", `/agent/kunden/liste?q=${encodeURIComponent(q)}&limit=8`);
      if (!r.json?.ok) return fehler(r.json?.error || `Suche fehlgeschlagen (HTTP ${r.status}).`);
      const kunden = (r.json.kunden || []).slice(0, 8).map(kundeKompakt);
      return { ok: true, anzahl: kunden.length, kunden };
    },
  },
  {
    name: "akte_lesen",
    titel: "Kundenakte lesen",
    beschreibung:
      "Liest die Akte eines Kunden: Lage/Stufe, Zahlungen, Dokumente, Kartenstand, nächster Termin und die "
      + "letzten Verlaufseinträge. Braucht die personId aus kunde_suchen.",
    stufe: "frei",
    zugang: "agent",
    rollen: ALLE_ROLLEN,
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
      if (!Number.isFinite(id)) return fehler("personId fehlt.");
      const r = await kontext.intern("GET", `/agent/crm/kunden/${id}/gespraech`);
      if (!r.json?.ok) return fehler(r.json?.error || `Akte nicht lesbar (HTTP ${r.status}).`);
      const j = r.json;
      return {
        ok: true,
        stufe: j.stufe ?? null,
        zahlungen: Array.isArray(j.zahlungen) ? j.zahlungen.slice(0, 6) : j.zahlungen ?? null,
        dokumente: j.dokumente ?? null,
        karte: j.karte ?? null,
        naechsterTermin: j.naechsterTermin
          ? { beginn: j.naechsterTermin.beginn, text: formatBerlin(j.naechsterTermin.beginn), quelle: j.naechsterTermin.quelle }
          : null,
        verlauf: (j.verlauf || []).slice(0, 5),
      };
    },
  },
  {
    name: "ueberfaellige_heute",
    titel: "Überfällige Raten zeigen",
    beschreibung:
      "Zeigt die eigenen Mandate mit überfälligen Raten (Stichtag heute, Europe/Berlin): wer, wie viele Raten "
      + "überfällig, seit wie vielen Tagen, Rücklastschrift ja/nein. Gut für die Frage nach heute überfälligen Kunden.",
    stufe: "frei",
    zugang: "agent",
    rollen: ALLE_ROLLEN,
    jsonSchema: { type: "object", properties: {}, additionalProperties: false },
    ausfuehren: async (_p, kontext) => {
      const r = await kontext.intern("GET", "/agent/vertrieb/bestand");
      if (!r.json?.ok) return fehler(r.json?.error || `Bestand nicht lesbar (HTTP ${r.status}).`);
      const faellig = (r.json.mandate || [])
        .filter((m: any) => Number(m?.raten?.ueberfaellig || 0) > 0)
        .map((m: any) => ({
          personId: m.kunde?.personId ?? null,
          name: m.kunde?.name ?? null,
          ueberfaelligeRaten: Number(m.raten?.ueberfaellig || 0),
          seitTagen: m.raten?.ueberfaelligSeitTagen ?? null,
          ruecklastschrift: !!m.raten?.ruecklastschrift,
          monatsrateCents: m.monatsrateCents ?? null,
        }));
      return { ok: true, anzahl: faellig.length, ueberfaellige: faellig };
    },
  },
  {
    name: "notiz_schreiben",
    titel: "Notiz an der Akte hinterlassen",
    beschreibung:
      "Hinterlässt eine interne Notiz im Verlauf der Kundenakte. Ändert keinen Zustand, verschickt nichts. "
      + "Die Notiz ist intern — der Kunde sieht sie nie.",
    stufe: "frei",
    zugang: "agent",
    rollen: ALLE_ROLLEN,
    jsonSchema: {
      type: "object",
      properties: {
        personId: { type: "integer", description: "Kennung des Kunden" },
        notiz: { type: "string", description: "Der Text der Notiz (intern, Deutsch)" },
      },
      required: ["personId", "notiz"],
      additionalProperties: false,
    },
    betroffenePersonen: (p) => [alsZahl(p?.personId)].filter((n) => Number.isFinite(n)),
    ausfuehren: async (p, kontext) => {
      const id = alsZahl(p?.personId);
      const text = String(p?.notiz || "").trim();
      if (!Number.isFinite(id)) return fehler("personId fehlt.");
      if (text.length < 2) return fehler("Die Notiz ist leer.");
      const r = await kontext.intern("POST", `/agent/crm/kunden/${id}/aktivitaet`, {
        art: "notiz",
        notiz: `KI-Assistent im Auftrag von ${kontext.name}: ${text}`.slice(0, 3800),
      });
      if (!r.json?.ok) return fehler(r.json?.error || `Notiz nicht gespeichert (HTTP ${r.status}).`);
      return { ok: true, meldung: "Notiz gespeichert." };
    },
  },
  {
    name: "mail_ereignisse",
    titel: "Sendbare E-Mail-Vorlagen zeigen",
    beschreibung:
      "Listet für einen Kunden alle E-Mail-Vorlagen (Ereignisse), die die eigene Rolle senden dürfte — je mit "
      + "Klartext, erlaubt/gesperrt und dem Sperrgrund. Vor mail_vorlage_senden aufrufen, um den Ereignis-Schlüssel zu finden.",
    stufe: "frei",
    zugang: "agent",
    rollen: ALLE_ROLLEN,
    jsonSchema: {
      type: "object",
      properties: {
        personId: { type: "integer", description: "Kennung des Kunden" },
      },
      required: ["personId"],
      additionalProperties: false,
    },
    betroffenePersonen: (p) => [alsZahl(p?.personId)].filter((n) => Number.isFinite(n)),
    ausfuehren: async (p, kontext) => {
      const id = alsZahl(p?.personId);
      if (!Number.isFinite(id)) return fehler("personId fehlt.");
      const r = await kontext.intern("GET", `/agent/mail/${id}`);
      if (!r.json?.ok) return fehler(r.json?.error || `Mail-Menü nicht lesbar (HTTP ${r.status}).`);
      const events = (r.json.events || []).map((e: any) => ({
        ereignis: e.type, label: e.label, klartext: e.klartext,
        erlaubt: !!e.erlaubt, grund: e.grund ?? null,
      }));
      return { ok: true, events };
    },
  },

  // ── Handeln mit Folgen (Stufe „bestaetigen") ──────────────────────────────
  {
    name: "mail_vorlage_senden",
    titel: "E-Mail-Vorlage senden",
    beschreibung:
      "Sendet eine bestehende E-Mail-Vorlage (Ereignis) an einen Kunden — z. B. Zahlungsdaten, Willkommen, "
      + "Terminbestätigung. Der Ereignis-Schlüssel kommt aus mail_ereignisse. Wird dem Menschen mit echter "
      + "Vorschau zur Bestätigung vorgelegt.",
    stufe: "bestaetigen",
    zugang: "agent",
    rollen: ALLE_ROLLEN,
    jsonSchema: {
      type: "object",
      properties: {
        personId: { type: "integer", description: "Kennung des Kunden" },
        ereignis: { type: "string", description: "Der Ereignis-Schlüssel der Vorlage, z. B. payment_details" },
      },
      required: ["personId", "ereignis"],
      additionalProperties: false,
    },
    betroffenePersonen: (p) => [alsZahl(p?.personId)].filter((n) => Number.isFinite(n)),
    vorschau: async (p, kontext) => {
      const id = alsZahl(p?.personId);
      const ereignis = String(p?.ereignis || "").trim();
      if (!Number.isFinite(id) || !ereignis) throw new Error("personId oder Ereignis fehlt.");
      const r = await kontext.intern("GET", `/agent/mail/${id}/${encodeURIComponent(ereignis)}/vorschau`);
      if (!r.json?.ok) throw new Error(r.json?.error || `Vorschau fehlgeschlagen (HTTP ${r.status}).`);
      const an = r.json.empfaenger || r.json.an || "";
      return {
        zusammenfassung: `E-Mail-Vorlage „${ereignis}" an Kunde ${id}${an ? ` (${an})` : ""} senden — Betreff: ${r.json.betreff || "—"}`,
        vorschauHtml: r.json.html || null,
      };
    },
    ausfuehren: async (p, kontext) => {
      const id = alsZahl(p?.personId);
      const ereignis = String(p?.ereignis || "").trim();
      if (!Number.isFinite(id) || !ereignis) return fehler("personId oder Ereignis fehlt.");
      const r = await kontext.intern("POST", `/agent/mail/${id}/${encodeURIComponent(ereignis)}`);
      if (!r.json?.ok) return fehler(r.json?.error || `Versand fehlgeschlagen (HTTP ${r.status}).`);
      return { ok: true, meldung: r.json.meldung || "E-Mail versendet." };
    },
  },
  {
    name: "mail_freitext_senden",
    titel: "Freitext-E-Mail senden",
    beschreibung:
      "Sendet eine frei formulierte E-Mail an einen Kunden. Kundentexte SIEZEN, keine Zusagen, keine "
      + "verbotenen Wörter (Beratung, Empfehlung, Garantie, Score-Versprechen) — der Server prüft das zusätzlich. "
      + "Wird dem Menschen mit echter Vorschau zur Bestätigung vorgelegt.",
    stufe: "bestaetigen",
    zugang: "agent",
    rollen: ALLE_ROLLEN,
    jsonSchema: {
      type: "object",
      properties: {
        personId: { type: "integer", description: "Kennung des Kunden" },
        betreff: { type: "string", description: "Betreffzeile (Sie-Form)" },
        text: { type: "string", description: "Der E-Mail-Text (Sie-Form, Klartext ohne HTML)" },
      },
      required: ["personId", "betreff", "text"],
      additionalProperties: false,
    },
    betroffenePersonen: (p) => [alsZahl(p?.personId)].filter((n) => Number.isFinite(n)),
    vorschau: async (p, kontext) => {
      const id = alsZahl(p?.personId);
      const betreff = String(p?.betreff || "").trim();
      const text = String(p?.text || "").trim();
      if (!Number.isFinite(id) || !betreff || !text) throw new Error("personId, Betreff oder Text fehlt.");
      const verboten = verboteneKundenworte(`${betreff}\n${text}`);
      if (verboten.length) {
        throw new Error(`Der Text enthält nicht erlaubte Formulierungen (${verboten.join(", ")}). Bitte umformulieren — die Entscheidung trifft die Bank, FIAON verspricht nichts.`);
      }
      const r = await kontext.intern("POST", `/agent/mail/${id}/frei/vorschau`, { betreff, text });
      if (!r.json?.ok) throw new Error(r.json?.error || `Vorschau fehlgeschlagen (HTTP ${r.status}).`);
      return {
        zusammenfassung: `Freitext-Mail an ${r.json.empfaenger || `Kunde ${id}`} — Betreff: ${r.json.betreff || betreff}`,
        vorschauHtml: r.json.html || null,
        warnung: Array.isArray(r.json.fehlend) && r.json.fehlend.length
          ? `Es fehlen Angaben: ${r.json.fehlend.join(", ")}` : null,
      };
    },
    ausfuehren: async (p, kontext) => {
      const id = alsZahl(p?.personId);
      const betreff = String(p?.betreff || "").trim();
      const text = String(p?.text || "").trim();
      if (!Number.isFinite(id) || !betreff || !text) return fehler("personId, Betreff oder Text fehlt.");
      const verboten = verboteneKundenworte(`${betreff}\n${text}`);
      if (verboten.length) return fehler(`Nicht erlaubte Formulierungen: ${verboten.join(", ")}.`);
      const r = await kontext.intern("POST", `/agent/mail/${id}/frei`, { betreff, text });
      if (!r.json?.ok) return fehler(r.json?.error || `Versand fehlgeschlagen (HTTP ${r.status}).`);
      return { ok: true, meldung: r.json.meldung || "E-Mail versendet." };
    },
  },
  {
    name: "termin_buchen",
    titel: "Termin buchen",
    beschreibung:
      "Bucht einen Termin mit einem Kunden. beginn ist Berliner Wandzeit im Format JJJJ-MM-TTTHH:MM "
      + "(z. B. 2026-09-01T14:00). Wird dem Menschen zur Bestätigung vorgelegt.",
    stufe: "bestaetigen",
    zugang: "agent",
    rollen: ALLE_ROLLEN,
    jsonSchema: {
      type: "object",
      properties: {
        personId: { type: "integer", description: "Kennung des Kunden" },
        beginn: { type: "string", description: "Beginn in Berliner Zeit, Format JJJJ-MM-TTTHH:MM" },
        notiz: { type: "string", description: "Optionale Notiz zum Termin" },
      },
      required: ["personId", "beginn"],
      additionalProperties: false,
    },
    betroffenePersonen: (p) => [alsZahl(p?.personId)].filter((n) => Number.isFinite(n)),
    vorschau: async (p) => {
      const id = alsZahl(p?.personId);
      const beginn = String(p?.beginn || "").trim();
      const zeit = parseBerlinInput(beginn);
      if (!Number.isFinite(id) || !zeit) throw new Error("personId fehlt oder beginn ist kein gültiger Zeitpunkt (JJJJ-MM-TTTHH:MM).");
      if (zeit.getTime() <= Date.now()) throw new Error("Der Termin liegt in der Vergangenheit.");
      return { zusammenfassung: `Termin mit Kunde ${id} am ${formatBerlin(zeit)} buchen${p?.notiz ? ` — Notiz: ${String(p.notiz).slice(0, 120)}` : ""}` };
    },
    ausfuehren: async (p, kontext) => {
      const id = alsZahl(p?.personId);
      const beginn = String(p?.beginn || "").trim();
      if (!Number.isFinite(id) || !beginn) return fehler("personId oder beginn fehlt.");
      const body: Record<string, unknown> = { personId: id, beginn };
      if (p?.notiz) body.notiz = String(p.notiz).slice(0, 500);
      const r = await kontext.intern("POST", "/agent/termine", body);
      if (!r.json?.ok) return fehler(r.json?.error || `Termin nicht gebucht (HTTP ${r.status}).`);
      const t = r.json.termin || {};
      return { ok: true, meldung: `Termin gebucht: ${t.datumText || beginn}${t.uhrzeit ? `, ${t.uhrzeit} Uhr` : ""}` };
    },
  },
  {
    name: "bonitaet_bestellen",
    titel: "Bonitätsauskunft bestellen",
    beschreibung:
      "Legt für einen Kunden die Bonitätsauskunft (74 Euro) als Bestellung an. Gibt es bereits eine offene "
      + "Auskunfts-Bestellung, meldet der Server das und legt nichts doppelt an. Wird dem Menschen zur Bestätigung vorgelegt.",
    stufe: "bestaetigen",
    zugang: "agent",
    rollen: ALLE_ROLLEN,
    jsonSchema: {
      type: "object",
      properties: {
        personId: { type: "integer", description: "Kennung des Kunden" },
      },
      required: ["personId"],
      additionalProperties: false,
    },
    betroffenePersonen: (p) => [alsZahl(p?.personId)].filter((n) => Number.isFinite(n)),
    vorschau: async (p) => {
      const id = alsZahl(p?.personId);
      if (!Number.isFinite(id)) throw new Error("personId fehlt.");
      return { zusammenfassung: `Bonitätsauskunft (74 €) für Kunde ${id} bestellen — bestehende offene Auskunfts-Bestellungen nutzt der Server weiter, statt doppelt anzulegen.` };
    },
    ausfuehren: async (p, kontext) => {
      const id = alsZahl(p?.personId);
      if (!Number.isFinite(id)) return fehler("personId fehlt.");
      const r = await kontext.intern("POST", `/agent/crm/kunden/${id}/bonitaet-bestellen`);
      if (!r.json?.ok) return fehler(r.json?.error || `Bestellung fehlgeschlagen (HTTP ${r.status}).`);
      return {
        ok: true,
        ref: r.json.ref ?? null,
        bereitsVorhanden: !!r.json.existing,
        meldung: r.json.hinweis || (r.json.existing ? "Es gab bereits eine Auskunfts-Bestellung." : "Bonitätsauskunft angelegt."),
      };
    },
  },
  {
    name: "paket_anlegen_oder_tauschen",
    titel: "Paket anlegen oder tauschen",
    beschreibung:
      "Legt für einen Kunden ein Paket als neue Bestellung an (personId + packKey) ODER tauscht das Paket einer "
      + "bestehenden Bestellung (zusätzlich ersetzenRef angeben). packKey ist der Paket-Schlüssel, z. B. basis, plus, "
      + "pro, ultra. Wird dem Menschen zur Bestätigung vorgelegt.",
    stufe: "bestaetigen",
    zugang: "agent",
    rollen: ALLE_ROLLEN,
    jsonSchema: {
      type: "object",
      properties: {
        personId: { type: "integer", description: "Kennung des Kunden (für neue Bestellung)" },
        packKey: { type: "string", description: "Paket-Schlüssel, z. B. basis, plus, pro, ultra" },
        ersetzenRef: { type: "string", description: "Nur beim Tausch: die Referenz der bestehenden Bestellung (FIAON-...)" },
      },
      required: ["personId", "packKey"],
      additionalProperties: false,
    },
    betroffenePersonen: (p) => [alsZahl(p?.personId)].filter((n) => Number.isFinite(n)),
    vorschau: async (p) => {
      const id = alsZahl(p?.personId);
      const paket = String(p?.packKey || "").trim().toLowerCase();
      if (!Number.isFinite(id) || !paket) throw new Error("personId oder packKey fehlt.");
      const tausch = String(p?.ersetzenRef || "").trim();
      return {
        zusammenfassung: tausch
          ? `Bestellung ${tausch} von Kunde ${id} auf das Paket „${paket}" umstellen`
          : `Neues Paket „${paket}" für Kunde ${id} als Bestellung anlegen`,
      };
    },
    ausfuehren: async (p, kontext) => {
      const id = alsZahl(p?.personId);
      const paket = String(p?.packKey || "").trim().toLowerCase();
      if (!Number.isFinite(id) || !paket) return fehler("personId oder packKey fehlt.");
      const tausch = String(p?.ersetzenRef || "").trim();
      const r = tausch
        ? await kontext.intern("POST", `/agent/customers/${encodeURIComponent(tausch)}/produkt`, { packKey: paket })
        : await kontext.intern("POST", `/agent/crm/kunden/${id}/bestellung`, { packKey: paket });
      if (!r.json?.ok) return fehler(r.json?.error || `Paket nicht angelegt (HTTP ${r.status}).`);
      return { ok: true, ref: r.json.ref ?? null, paket: r.json.paket ?? paket, meldung: r.json.hinweis || "Paket angelegt." };
    },
  },
  {
    name: "konto_sperren",
    titel: "Kundenkonto sperren oder freischalten",
    beschreibung:
      "Sperrt das Kundenkonto (sperren=true) oder schaltet es wieder frei (sperren=false), mit Begründung. "
      + "Wird dem Menschen zur Bestätigung vorgelegt.",
    stufe: "bestaetigen",
    zugang: "agent",
    rollen: ALLE_ROLLEN,
    jsonSchema: {
      type: "object",
      properties: {
        personId: { type: "integer", description: "Kennung des Kunden" },
        sperren: { type: "boolean", description: "true = sperren, false = freischalten" },
        grund: { type: "string", description: "Kurze Begründung (steht im Verlauf)" },
      },
      required: ["personId", "sperren"],
      additionalProperties: false,
    },
    betroffenePersonen: (p) => [alsZahl(p?.personId)].filter((n) => Number.isFinite(n)),
    vorschau: async (p) => {
      const id = alsZahl(p?.personId);
      if (!Number.isFinite(id)) throw new Error("personId fehlt.");
      const tat = p?.sperren === true ? "SPERREN" : "FREISCHALTEN";
      return { zusammenfassung: `Konto von Kunde ${id} ${tat}${p?.grund ? ` — Grund: ${String(p.grund).slice(0, 160)}` : ""}` };
    },
    ausfuehren: async (p, kontext) => {
      const id = alsZahl(p?.personId);
      if (!Number.isFinite(id)) return fehler("personId fehlt.");
      const r = await kontext.intern("POST", `/agent/crm/kunden/${id}/konto-sperre`, {
        sperren: p?.sperren === true,
        grund: String(p?.grund || "").slice(0, 300),
      });
      if (!r.json?.ok) return fehler(r.json?.error || `Sperre nicht geändert (HTTP ${r.status}).`);
      return { ok: true, gesperrt: !!r.json.gesperrt, meldung: r.json.hinweis || (r.json.gesperrt ? "Konto gesperrt." : "Konto freigeschaltet.") };
    },
  },
  {
    name: "einmal_passwort",
    titel: "Einmal-Passwort erzeugen",
    beschreibung:
      "Erzeugt ein Einmal-Passwort für den Kundenzugang zu einer Bestellung (Referenz FIAON-...). Nur die "
      + "Vertriebsleitung darf das — der Server prüft die Rolle. Wird dem Menschen zur Bestätigung vorgelegt.",
    stufe: "bestaetigen",
    zugang: "agent",
    rollen: ["vertriebsleiter", "admin", "chef"],
    jsonSchema: {
      type: "object",
      properties: {
        ref: { type: "string", description: "Referenz der Bestellung (FIAON-...)" },
        grund: { type: "string", description: "Begründung, mindestens 5 Zeichen" },
      },
      required: ["ref", "grund"],
      additionalProperties: false,
    },
    betroffenePersonen: (p) => [String(p?.ref || "")].filter(Boolean),
    vorschau: async (p) => {
      const ref = String(p?.ref || "").trim();
      const grund = String(p?.grund || "").trim();
      if (!ref) throw new Error("ref fehlt.");
      if (grund.length < 5) throw new Error("Bitte kurz begründen (mindestens 5 Zeichen).");
      return { zusammenfassung: `Einmal-Passwort für die Bestellung ${ref} erzeugen — Grund: ${grund.slice(0, 160)}` };
    },
    ausfuehren: async (p, kontext) => {
      const ref = String(p?.ref || "").trim();
      const grund = String(p?.grund || "").trim();
      if (!ref || grund.length < 5) return fehler("ref oder Begründung fehlt.");
      const r = await kontext.intern("POST", `/agent/zugang/${encodeURIComponent(ref)}/einmal-passwort`, { grund });
      if (!r.json?.ok) return fehler(r.json?.error || `Einmal-Passwort nicht erzeugt (HTTP ${r.status}).`);
      return {
        ok: true,
        passwort: r.json.passwort ?? null,
        gueltigBis: r.json.gueltigBis ?? null,
        meldung: r.json.hinweis || "Einmal-Passwort erzeugt — bitte sicher an den Kunden übermitteln.",
      };
    },
  },

  // ── Chefbüro: das Mailwerk lesen und steuern ──────────────────────────────
  {
    name: "mailwerk_lesen",
    titel: "Mailwerk-Übersicht lesen",
    beschreibung:
      "Liest die Mailwerk-Übersicht des Chefbüros: alle Mail-Ereignisse mit Volumen, letztem Versand und "
      + "Fehlerquote, dazu Versandweg und Takte der Automatik. Nur im Chefbüro verfügbar.",
    stufe: "frei",
    zugang: "chef",
    rollen: ["chef"],
    jsonSchema: { type: "object", properties: {}, additionalProperties: false },
    ausfuehren: async (_p, kontext) => {
      const r = await kontext.intern("GET", "/chef/mailwerk");
      if (!r.json?.ok) return fehler(r.json?.error || `Mailwerk nicht lesbar (HTTP ${r.status}).`);
      const j = r.json;
      const events = (j.events || j.ereignisse || []).slice(0, 60).map((e: any) => ({
        ereignis: e.type ?? e.event ?? null, label: e.label ?? null,
        versand30Tage: e.volumen ?? e.versand ?? null, fehlerquote: e.fehlerquote ?? null,
        zuletzt: e.zuletzt ?? e.letzterVersand ?? null,
      }));
      return { ok: true, einstellungen: j.einstellungen ?? null, events };
    },
  },
  {
    name: "mailwerk_einstellen",
    titel: "Mailwerk-Einstellung ändern",
    beschreibung:
      "Ändert eine Einstellung des Mailwerks (z. B. mail_versandweg, mahn_takte_pro_tag). Der Server erlaubt "
      + "nur die Schlüssel seiner Weißliste. Nur im Chefbüro; wird dem Menschen zur Bestätigung vorgelegt.",
    stufe: "bestaetigen",
    zugang: "chef",
    rollen: ["chef"],
    jsonSchema: {
      type: "object",
      properties: {
        schluessel: { type: "string", description: "Der Einstellungs-Schlüssel, z. B. mail_versandweg" },
        wert: { type: "string", description: "Der neue Wert" },
      },
      required: ["schluessel", "wert"],
      additionalProperties: false,
    },
    vorschau: async (p) => {
      const schluessel = String(p?.schluessel || "").trim();
      const wert = String(p?.wert ?? "").trim();
      if (!schluessel) throw new Error("Der Einstellungs-Schlüssel fehlt.");
      return { zusammenfassung: `Mailwerk-Einstellung „${schluessel}" auf „${wert}" stellen` };
    },
    ausfuehren: async (p, kontext) => {
      const r = await kontext.intern("POST", "/chef/mailwerk/einstellung", {
        key: String(p?.schluessel || "").trim(),
        value: String(p?.wert ?? "").trim(),
      });
      if (!r.json?.ok) return fehler(r.json?.error || `Einstellung nicht geändert (HTTP ${r.status}).`);
      return { ok: true, meldung: "Einstellung gespeichert." };
    },
  },
  {
    name: "mailwerk_pruefversand",
    titel: "Mailwerk-Prüfversand auslösen",
    beschreibung:
      "Löst für ein Mail-Ereignis einen Prüfversand an eine Adresse aus (Vorgabe: Betreiberadresse). Nur im "
      + "Chefbüro; wird dem Menschen zur Bestätigung vorgelegt.",
    stufe: "bestaetigen",
    zugang: "chef",
    rollen: ["chef"],
    jsonSchema: {
      type: "object",
      properties: {
        ereignis: { type: "string", description: "Der Ereignis-Schlüssel" },
        an: { type: "string", description: "Optionale Zieladresse für den Prüfversand" },
      },
      required: ["ereignis"],
      additionalProperties: false,
    },
    vorschau: async (p) => {
      const ereignis = String(p?.ereignis || "").trim();
      if (!ereignis) throw new Error("Das Ereignis fehlt.");
      return { zusammenfassung: `Prüfversand für „${ereignis}"${p?.an ? ` an ${String(p.an).trim()}` : " an die Betreiberadresse"} auslösen` };
    },
    ausfuehren: async (p, kontext) => {
      const ereignis = String(p?.ereignis || "").trim();
      if (!ereignis) return fehler("Das Ereignis fehlt.");
      const body: Record<string, unknown> = {};
      if (p?.an) body.an = String(p.an).trim();
      const r = await kontext.intern("POST", `/chef/mailwerk/pruefversand/${encodeURIComponent(ereignis)}`, body);
      if (!r.json?.ok) return fehler(r.json?.error || `Prüfversand fehlgeschlagen (HTTP ${r.status}).`);
      return { ok: true, meldung: r.json.meldung || "Prüfversand ausgelöst." };
    },
  },
];

/**
 * Die Werkzeuge, die eine Sitzung in ihre Modell-Toolliste bekommt.
 * Chefbüro: rolle = „chef". hatAgentZugang sagt, ob interne /agent-Aufrufe
 * möglich sind (im Chefbüro nur, wenn das Chef-Cookie eine Mitarbeiter-
 * Kennung trägt — beim alten Admin-Cookie trägt es keine).
 */
export function werkzeugeFuerRolle(rolle: string, hatAgentZugang: boolean): Werkzeug[] {
  return WERKZEUGE
    .filter((w) => w.rollen.includes(rolle))
    .filter((w) => (w.zugang === "agent" ? hatAgentZugang : true));
}

export function werkzeugVonName(name: string): Werkzeug | null {
  return WERKZEUGE.find((w) => w.name === name) || null;
}
