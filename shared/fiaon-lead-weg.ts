// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DER LEAD-WEG: DIE REINEN REGELN (E-476 Scheibe 3, 05.11.2026)
//
// Justin (05.11.2026, Entscheidung 1A): „Das erste Gespräch mit einem neuen Business-Lead führe ICH.“ Leads buchen in
// Justins Zeiten (30 Minuten, höchstens drei Lead-Gespräche am Tag), Daniel ruft trotzdem sofort an und trägt den Lead
// im Gespräch per Cockpit-Knopf bei Justin ein. Dazu ein persönlicher, vorausgefüllter Terminlink je Anfrage.
//
// Hier steht nur, was ohne Datenbank gilt — Server, Seite, Cockpit und Prüfstand lesen dieselben Regeln:
//   · Welche Termine LEAD-GESPRÄCHE sind (Herkunft) und welche davon auf den Lead-Deckel zählen.
//   · Die Einstellung „Gespräche führt“ (Vorgabe: Justins Konto) und die zwei Tagesdeckel.
//   · Der persönliche Link (fiaon.com/g/<code>), die Cookies, die ihn zur Seite tragen, und der Danke-Link der
//     Meta-Formular-Fassung 2.
//   · „Was er selbst erzählt hat“ (Cockpit-Knopf) mit der Pflicht-Prüfung.
//   · Die Gesprächshilfe der Anruf-Karte (Einstieg, drei Fragen, Paket-Idee) — aus SEINEN Antworten, ohne KI.
//   · Der Satz der Datenschutzerklärung zum Hintergrund-Check (Entscheidung 4A, deutsch und britisches Englisch).
//
// Repo öffentlich: keine Kundennamen, keine Adressen, keine Nummern.
// ═══════════════════════════════════════════════════════════════════════════
import type { LeadAntwort, LeadTemperatur } from "./fiaon-global-lead";
import { GLOBAL_PAKETE, type GlobalSchluessel } from "./fiaon-global";

// ── Welche Termine sind Lead-Gespräche? ─────────────────────────────────────
/** Die /justin-Weiche: ein Business-Lead bucht über fiaon.com/justin — ein Global-Gespräch. */
export const JUSTIN_WEICHE_HERKUNFT = "gruender_global";
/**
 * Herkünfte, die auf den LEAD-DECKEL zählen (Gutachten 0, Mangel 2): Kalender auf der Website, persönlicher Link,
 * Cockpit-Knopf — und (Nachbesserung 05.11.2026, Gutachten Technik Mangel 5; Entscheidung 1A „höchstens drei
 * Global-Gespräche am Tag“) die /justin-Weiche. Startgespräche zahlender Kunden (herkunft „individualangebot“) zählen NIE
 * darauf — sie sind immer buchbar.
 */
export const LEAD_DECKEL_HERKUENFTE = ["global_seite", "global_link", "agent_global", JUSTIN_WEICHE_HERKUNFT] as const;
/** Alle Lead-Gespräche: kein ARAS, Anruf-Karte an Justin, Ergebnis-Rückfrage an die zuständige Person. */
export const LEAD_GESPRAECH_HERKUENFTE: readonly string[] = [...LEAD_DECKEL_HERKUENFTE];

/** Ist dieser Termin ein Lead-Gespräch (Erstgespräch eines Business-Leads)? Rein. */
export function istLeadGespraech(t: { quelle?: string | null; herkunft?: string | null }): boolean {
  return String(t.quelle ?? "") === "global" && LEAD_GESPRAECH_HERKUENFTE.includes(String(t.herkunft ?? ""));
}
/** Zählt dieser Termin auf den Lead-Deckel? Rein. */
export function zaehltAufLeadDeckel(t: { quelle?: string | null; herkunft?: string | null; status?: string | null }): boolean {
  return String(t.quelle ?? "") === "global" && (LEAD_DECKEL_HERKUENFTE as readonly string[]).includes(String(t.herkunft ?? ""))
    && ["gebucht", "erledigt", "verpasst"].includes(String(t.status ?? ""));
}
/** Zählt dieser Termin auf den Gesamtdeckel der Gesprächsperson (/justin-Gespräche und Lead-Gespräche)? Rein. */
export function zaehltAufGesamtDeckel(t: { quelle?: string | null; herkunft?: string | null; status?: string | null }): boolean {
  if (!["gebucht", "erledigt", "verpasst"].includes(String(t.status ?? ""))) return false;
  return String(t.quelle ?? "") === "gruender" || istLeadGespraech(t);
}

// ── „Gespräche führt“ und die Tagesdeckel (fiaon_settings) ──────────────────
export const LEAD_WEG_SCHLUESSEL = {
  /** Wer die Erstgespräche mit Business-Leads führt: leer = Vorgabe (Justin), „zustaendig“ = wie vor E-476, Zahl = Konto. */
  kalenderAgent: "global_kalender_agent_id",
  /** Höchstens so viele Lead-Gespräche je Tag (Vorgabe 3, Entscheidung 1A). */
  leadProTag: "global_lead_pro_tag",
  /** Höchstens so viele Gespräche je Tag bei der Gesprächsperson — /justin und Leads zusammen (Gutachten 0, Mangel 2). */
  gesamtProTag: "global_kalender_gesamt_pro_tag",
} as const;

export const LEAD_WEG_VORGABE = {
  /** Justins Konto (dasselbe wie gruender_termin_agent_id, fiaon-gruender-termin.ts). */
  kalenderAgentId: 928,
  leadProTag: 3,
  gesamtProTag: 5,
  /** Der persönliche Link gilt so viele Tage. */
  codeTage: 30,
  /** Eine Buchung ohne Link hängt sich an eine offene Anfrage, die höchstens so alt ist (Gutachten 0, Mangel 17). */
  anfrageTage: 60,
  /** So lange trägt das Cookie den Link vom Klick zur Seite (der Code steht nie in der Adresse der Seite). */
  cookieStunden: 2,
} as const;

/** Der Wert, mit dem die Einstellung „Gespräche führt“ das Verhalten vor E-476 wählt (die zuständige Person). */
export const KALENDER_ZUSTAENDIG = "zustaendig";

export type KalenderWahl =
  | { art: "vorgabe"; agentId: number }
  | { art: "konto"; agentId: number }
  | { art: "zustaendig"; agentId: null };

/** Die Einstellung „Gespräche führt“ lesen. Leer/kaputt = die Vorgabe (Justin). Rein. */
export function kalenderWahlLesen(wert: unknown, vorgabeAgentId: number = LEAD_WEG_VORGABE.kalenderAgentId): KalenderWahl {
  const v = String(wert ?? "").trim().toLowerCase();
  if (v === KALENDER_ZUSTAENDIG) return { art: "zustaendig", agentId: null };
  const n = Number(v);
  if (v && /^\d{1,7}$/.test(v) && Number.isInteger(n) && n > 0) return { art: "konto", agentId: n };
  return { art: "vorgabe", agentId: vorgabeAgentId };
}

/** Eine ganze Zahl in Grenzen — sonst die Vorgabe. Rein. */
export function deckelLesen(wert: unknown, vorgabe: number, min = 1, max = 12): number {
  const s = String(wert ?? "").trim();
  const n = Math.round(Number(s));
  return s !== "" && Number.isFinite(n) && n >= min && n <= max ? n : vorgabe;
}

/**
 * Wie viele Lead-Gespräche nimmt ein Tag noch auf? Das Minimum aus Lead-Deckel und Gesamtdeckel (Gutachten 0,
 * Mangel 2). Nie negativ. Rein.
 */
export function tagesRest(ein: { leadProTag: number; gesamtProTag: number; leadGebucht: number; gesamtGebucht: number }): number {
  return Math.max(0, Math.min(ein.leadProTag - ein.leadGebucht, ein.gesamtProTag - ein.gesamtGebucht));
}

// ── Der persönliche Link und die Cookies ────────────────────────────────────
/** Der Code des persönlichen Links: 10 Zeichen aus 56 (wie fiaon-kurzlink.ts, ≈ 3·10^17 Möglichkeiten — nicht erratbar). */
export const LEAD_CODE_ZEICHEN = "23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
export const LEAD_CODE_LAENGE = 10;
export function leadCodeForm(code: unknown): code is string {
  const c = String(code ?? "");
  return c.length === LEAD_CODE_LAENGE && Array.from(c).every((z) => LEAD_CODE_ZEICHEN.includes(z));
}
/**
 * /g/ gehört auch dem Firmen-Radar (Codes r<Ziffern>, E-458 — schon verschickte Kaltmails). Die Weiche (Gutachten 0,
 * Mangel 1): r + Ziffern bleibt Radar, ein Code in Lead-Form ist ein persönlicher Link, alles andere führt zur Startseite. Rein.
 */
export function gPfadArt(kennung: unknown): "radar" | "lead" | "unbekannt" {
  const k = String(kennung ?? "").trim();
  if (/^r\d{1,9}$/.test(k)) return "radar";
  return leadCodeForm(k) ? "lead" : "unbekannt";
}
/** Die Adresse des persönlichen Links — kurz, ohne Kundendaten. Rein. */
export function leadLinkUrl(code: string, basis = "https://fiaon.com"): string {
  return `${String(basis).replace(/\/+$/, "")}/g/${code}`;
}
/** Das Cookie, das den Link vom Klick zur Seite trägt (HttpOnly, nur für /api/fiaon/global). */
export const LEAD_CODE_COOKIE = "fiaon_g";
/** Das Cookie des Meta-Danke-Knopfs (/gb?lid=…): die Lead-Kennung, bis die Anfrage da ist. */
export const LEAD_GB_COOKIE = "fiaon_gb";
export const LEAD_COOKIE_PFAD = "/api/fiaon/global";

/**
 * Der Danke-Knopf der Meta-Formular-Fassung 2 (Entscheidung 1A, Gutachten 0, Mangel 4/22): Meta setzt die Lead-Kennung
 * ein. Die Fassung MUSS mit „FIAON Global“ beginnen, sonst greift die Weiche Meta → Global nicht (istGlobalFormular).
 */
export const META_DANKE_URL = "https://fiaon.com/gb?lid={{lead_id}}";
/**
 * Die Namen der Formular-Fassung 2 (Danke-Knopf auf META_DANKE_URL). Vorbereitet in
 * 08_Medien_Higgsfield/2026-10-30_Global_Meta_Anzeigen/kampagne/formular_fassung2.py — angelegt und in die Anzeigen
 * getauscht wird NUR mit Justins Wort (abends; die alte Fassung bleibt als Rückfall). Beide beginnen mit „FIAON Global“.
 */
export const META_FASSUNG2_NAMEN = {
  kapital: "FIAON Global · Kapital · drei Fragen · Fassung 2",
  us: "FIAON Global · US-Gesellschaft · drei Fragen · Fassung 2",
} as const;
/** Eine Meta-Lead-Kennung aus der Adresse — nur Ziffern (steht noch „{{lead_id}}“ da, hat Meta nicht ersetzt). Rein. */
export function metaLeadKennung(roh: unknown): string | null {
  const s = String(roh ?? "").trim();
  return /^\d{3,25}$/.test(s) ? s : null;
}

// ── „Was er selbst erzählt hat“ (Cockpit-Knopf, Gutachten 1, Mangel 13) ─────
export const ERZAEHLT_FELDER = [
  { key: "wohnort", label: "Wohnort / Land" },
  { key: "rolle", label: "Rolle und Anteile" },
  { key: "wer_noch", label: "Wer noch in der Firma ist (Partner, Familie)" },
  { key: "us_bezug", label: "US-Bezug" },
  { key: "groesse", label: "Größe grob (Mitarbeiter, Umsatz)" },
] as const;
export type ErzaehltFeld = (typeof ERZAEHLT_FELDER)[number]["key"];
export const EINSCHAETZUNGEN = ["heiss", "warm", "kalt"] as const;
export type Einschaetzung = (typeof EINSCHAETZUNGEN)[number];
export const EINSCHAETZUNG_WORT: Readonly<Record<Einschaetzung, string>> = { heiss: "heiß", warm: "warm", kalt: "kalt" };
/** Mindestlänge der Notiz: zwei, drei Sätze — „Interesse“ allein sagt Justin nichts. */
export const ERZAEHLT_MIN = 40;

/**
 * Die Pflicht-Notiz des Cockpit-Knopfs prüfen und zu EINEM Text bauen (Notiz, dann die kurzen Felder). Die
 * Einschätzung heißt bewusst heiß/warm/kalt — A/B/C sind die Kundenstufen und bedeuten etwas anderes. Rein.
 */
export function erzaehltPruefen(ein: { text: unknown; felder?: Partial<Record<string, unknown>> | null; einschaetzung: unknown }):
  { ok: true; text: string; einschaetzung: Einschaetzung } | { ok: false; error: string; feld: string } {
  const text = String(ein.text ?? "").replace(/\s+/g, " ").trim().slice(0, 1500);
  if (text.length < ERZAEHLT_MIN) {
    return { ok: false, feld: "erzaehlt", error: "Bitte zwei, drei Sätze: Wer ist er, was will er, wie groß, wie ernst? (Pflicht — Justin liest das vor dem Gespräch.)" };
  }
  const e = String(ein.einschaetzung ?? "").trim().toLowerCase().replace("ß", "ss");
  if (!(EINSCHAETZUNGEN as readonly string[]).includes(e)) return { ok: false, feld: "einschaetzung", error: "Bitte die Einschätzung wählen: heiß, warm oder kalt." };
  const zeilen = [text];
  for (const f of ERZAEHLT_FELDER) {
    const w = String(ein.felder?.[f.key] ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
    if (w) zeilen.push(`${f.label}: ${w}`);
  }
  return { ok: true, text: zeilen.join("\n"), einschaetzung: e as Einschaetzung };
}

// ── Die Gesprächshilfe der Anruf-Karte (rein, aus SEINEN Antworten) ─────────
export interface PaketIdee { key: GlobalSchluessel; name: string; grund: string }

/** Die obere Grenze eines Rahmens („100.000 $ – 250.000 $“ → 250000). null ohne Zahl. Rein. */
export function rahmenObergrenze(antwort: unknown): number | null {
  const zahlen = String(antwort ?? "").match(/\d{1,3}(?:[.,\s]\d{3})+|\d+/g) ?? [];
  const werte = zahlen.map((z) => Number(z.replace(/[.,\s]/g, ""))).filter((n) => Number.isFinite(n) && n >= 1000);
  return werte.length ? Math.max(...werte) : null;
}

/**
 * Die Paket-Idee: das kleinste Paket, dessen Kapitalrahmen die Obergrenze SEINES Ziels trägt (Pakete aus
 * shared/fiaon-global.ts, nie fest im Code). Ohne Rahmen (US-Gesellschaft-Formular, „Noch offen“): Global Struktur,
 * weil die Gründung im Vordergrund steht. Eine Lesehilfe für Justin, keine Empfehlung an den Kunden. Rein.
 */
export function paketIdeeAusAntworten(antworten: readonly LeadAntwort[]): PaketIdee | null {
  const pakete = [...GLOBAL_PAKETE].sort((a, b) => a.planungUsd - b.planungUsd);
  if (!pakete.length) return null;
  const rahmen = antworten.find((a) => /^kapitalrahmen/.test(String(a.code ?? a.schluessel ?? "")) || /kapitalrahmen/i.test(a.frage));
  const offen = !rahmen || /noch offen|^offen/i.test(rahmen.antwort) || /_4$/.test(String(rahmen.code ?? ""));
  if (!offen) {
    const oben = rahmenObergrenze(rahmen!.antwort);
    if (oben) {
      const p = pakete.find((x) => x.planungUsd >= oben) ?? pakete[pakete.length - 1];
      return { key: p.key, name: p.de.name, grund: `sein Ziel „${rahmen!.antwort}“ — der Rahmen von ${p.de.name} trägt es` };
    }
  }
  const p = pakete[0];
  return { key: p.key, name: p.de.name, grund: rahmen ? "Rahmen noch offen — erst die Gründung, der Rest im Gespräch" : "kein Kapitalrahmen genannt — die Gründung steht im Vordergrund" };
}

const START_WORT: Readonly<Record<string, string>> = {
  "1": "so bald wie möglich", "2": "in den nächsten Monaten", "3": "später", "4": "erst einmal informieren",
};

/**
 * Einstieg (ein Satz, den Justin sagt — Sie-Form) und drei Fragen für das Erstgespräch. Keine Zusage, keine Zahl, kein
 * Bank-Satz; Privates fragt er im Gespräch selbst. Rein.
 */
export function gespraechsHilfe(ein: { antworten: readonly LeadAntwort[]; temperatur: LeadTemperatur; nachricht?: string | null }):
  { einstieg: string; fragen: string[]; paket: PaketIdee | null } {
  const code = (praefix: string) => ein.antworten.find((a) => String(a.code ?? "").startsWith(praefix))?.code ?? null;
  const vorhaben = code("vorhaben_");
  const start = (code("wann_starten_") ?? code("wann_gruenden_"))?.slice(-1) ?? null;
  const wofuer = code("wofuer_");
  const startText = start ? START_WORT[start] : null;
  let einstieg: string;
  if (vorhaben === "vorhaben_1" || vorhaben === "vorhaben_3") {
    einstieg = start === "1"
      ? "„Sie möchten so bald wie möglich starten — wofür soll das Kapital bei Ihnen arbeiten?“"
      : "„Sie haben den Weg zum Kapital angekreuzt — wofür soll das Kapital bei Ihnen arbeiten?“";
  } else if (vorhaben === "vorhaben_2" || wofuer) {
    einstieg = "„Sie möchten in den USA Geschäft machen — erzählen Sie mir kurz, was Sie dort vorhaben?“";
  } else if (ein.nachricht) {
    einstieg = "„Danke für Ihre Nachricht — erzählen Sie mir in zwei, drei Sätzen, worum es Ihnen geht?“";
  } else {
    einstieg = "„Sie haben sich bei uns gemeldet — erzählen Sie mir kurz, was Sie in den USA vorhaben?“";
  }
  const fragen = [
    "Wo sitzen Sie und Ihr Unternehmen heute, und wer ist außer Ihnen beteiligt (Partner, Familie)?",
    vorhaben === "vorhaben_3"
      ? "Was ist Ihnen wichtiger: der Weg zum Kapital oder das Geschäft in den USA?"
      : wofuer === "wofuer_2"
        ? "Was soll die Tochtergesellschaft in den USA für Ihr bestehendes Unternehmen tun?"
        : "Was soll die US-Gesellschaft für Sie leisten — Kunden in den USA, Kapital oder beides?",
    start === "1" || ein.temperatur === "heiss"
      ? "Bis wann soll alles stehen, und was hat Sie bisher aufgehalten?"
      : `Sie möchten ${startText ?? "noch nicht sofort"} starten — was müsste passieren, damit es losgeht?`,
  ];
  return { einstieg, fragen, paket: paketIdeeAusAntworten(ein.antworten) };
}

// ── Datenschutzerklärung: der Hintergrund-Check (Entscheidung 4A, Justins Wortlaut 05.11.2026) ──
/**
 * Justins Wortlaut, Wort für Wort (deutsch) — und die britische Fassung. Steht in der Datenschutzerklärung
 * (client/src/pages/privacy.tsx, Abschnitt VII a). Der Anwalt prüft ihn nachträglich; ändern nur mit Justins Wort.
 */
export const LEAD_HINTERGRUND_DATENSCHUTZ = {
  de: "Um Ihr Gespräch vorzubereiten, prüfen wir öffentlich zugängliche Angaben zu Ihrem Unternehmen und zu Ihrer geschäftlichen Rolle darin (z. B. Handelsregister, Impressum, Presse). Dienstleister für die Websuche: OpenAI.",
  en: "To prepare for your call, we check publicly available information about your company and your business role within it (e.g. the commercial register, the company's legal notice and press coverage). Service provider for the web search: OpenAI.",
} as const;
