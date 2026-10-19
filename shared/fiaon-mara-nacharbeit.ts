// ═══════════════════════════════════════════════════════════════════════════
// NACHARBEIT NACH DEM ANRUF — EIN KLICK, MARA MACHT DEN REST (E-406 C2, 19.10.2026) — DIE REGEL
//
// Justin (19.10.2026), Vorschlag 3 „Mara führt den Betrieb“: „Nach dem Anruf genügt ein Klick auf das Ergebnis.
// Die Nacharbeit macht Mara.“ Gemessen (Produktion, nur lesend, 05.–19.10.2026): 115 Gesprächsergebnisse in
// 14 Tagen, nach denen der Kunde von uns NICHTS Schriftliches bekam — 55 „Zahlt sofort“, 10 „Zahlt am …“,
// 14 „Rückruf vereinbart“, 36 „Erreicht – Sonstiges“ (alle mit Notiz). Was am Telefon vereinbart war, stand
// nur in der Akte; der Kunde hatte weder Betrag noch Verwendungszweck noch die vereinbarte Uhrzeit.
//
// ── DIE REGEL ───────────────────────────────────────────────────────────────
// Beim Ergebnis steht ein Häkchen „Mara schickt die Zusammenfassung“ (an, wo es passt) mit EINER Zeile Vorschau.
// Bleibt es an, schickt Mara dem Kunden eine kurze Mail, passend zum Ergebnis:
//   · Zahlt sofort / Zahlt am …  → Betrag, Tag und Verwendungszweck, Knopf zu SEINER Zahlungsseite
//   · Rückruf vereinbart         → Tag, Uhrzeit und wer anruft (der Rückruf steht schon im Kalender)
//   · Erreicht – Sonstiges        → eine kurze Zusammenfassung aus der Notiz (Mara schreibt, der Server prüft)
//   · … und die Notiz verspricht Unterlagen → der bestehende Upload-Link ohne Anmeldung
// Nie bei: nicht erreicht / Mailbox (dafür E-401), abgelehnt, falscher Nummer, Übergabe; FIAON Global; Test;
// Werbesperre, „Stopp“, Vertriebssperre, gekündigt; eingegangener Kündigung; heiklem Thema in der Notiz
// (Kündigung, Widerruf, Beschwerde, Anwalt, Erstattung, Gesundheit, Weitergabe an die Leitung …) oder einem offenen
// heiklen Auftrag; ohne Mail-Adresse. Nie doppelt (höchstens eine je DOPPELT_STUNDEN; ein neueres Ergebnis ersetzt
// eine noch wartende), nur 08–20 Uhr — sonst am nächsten Morgen.
//
// Hier steht nur die REGEL — rein, ohne Datenbank (Oberfläche, Server und Prüfstand lesen sie):
// scripts/pruef-mara-nacharbeit.ts. Texte und Textprüfung: shared/fiaon-mara-nacharbeit-text.ts (nur Server).
// Vormerken und Senden: server/lib/fiaon-mara-nacharbeit.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { imVersandfenster, naechstesFenster, wannText } from "./fiaon-nicht-erreicht-nachfass";
import { LINK_ART_TEXT, type LinkArt } from "./fiaon-unterlagen-anfrage";
import { ERGEBNIS_LISTE, ergebnisAngabe } from "./fiaon-kontakt-ergebnis-liste";

/** Das Mail-Ereignis (Quelltext-Vorlage im Mailwerk, server/mail/vorlagen/nacharbeit.ts). */
export const NACHARBEIT_EVENT = "mara_nacharbeit";
/** Der Schalter in Maras Einstellungen (fiaon_settings). Fehlt er, ist die Nacharbeit AN. */
export const NACHARBEIT_SCHALTER = "mara_nacharbeit_mail";
/** So lange wartet eine vorgemerkte Mail mindestens — Zeit, das Ergebnis zu berichtigen (ein neueres ersetzt sie). */
export const REIF_MINUTEN = 3;
/** Ein neueres ANDERES Ergebnis ohne Häkchen binnen dieser Zeit nimmt die wartende Mail zurück (Berichtigung). */
export const KORREKTUR_MINUTEN = 10;
/** Nie doppelt: höchstens eine Nacharbeit-Mail je Mensch in so vielen Stunden. */
export const DOPPELT_STUNDEN = 12;
/** Was so lange wartet (Abendanruf, KI-Pause), verfällt — eine Zusammenfassung von vorgestern hilft niemandem. */
export const VERFALL_STUNDEN = 24;
/** Ein Rückruf, der näher als so viele Minuten liegt, braucht keine Bestätigung mehr. */
export const TERMIN_MINDEST_MINUTEN = 60;
/** In der KI-Pause wartet die Gesprächs-Zusammenfassung so lange und versucht es dann noch einmal. */
export const KI_PAUSE_WARTEN_MINUTEN = 30;

export type NacharbeitArt = "zusage" | "termin" | "gespraech" | "unterlagen";
export const NACHARBEIT_ARTEN: readonly NacharbeitArt[] = ["zusage", "termin", "gespraech", "unterlagen"];
export function istNacharbeitArt(v: unknown): v is NacharbeitArt {
  return typeof v === "string" && (NACHARBEIT_ARTEN as readonly string[]).includes(v);
}
/** So heißt die Art in Akte, Meldung und Chefbüro. */
export const ART_TEXT: Record<NacharbeitArt, string> = {
  zusage: "Zahlungszusage", termin: "Rückruf", gespraech: "Zusammenfassung", unterlagen: "Upload-Link",
};

// ── ZEIT (Berlin, nur formatToParts — Zeit-Falle 01.09.2026) ────────────────
const WOCHENTAG_KURZ = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
function berlinTeile(d: Date): { j: number; m: number; t: number; h: number; min: number; wt: number } {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(d).reduce<Record<string, string>>((o, x) => { o[x.type] = x.value; return o; }, {});
  const j = Number(p.year), m = Number(p.month), t = Number(p.day);
  return { j, m, t, h: Number(p.hour) % 24, min: Number(p.minute), wt: new Date(Date.UTC(j, m - 1, t)).getUTCDay() };
}
/** Der Berliner Kalendertag als „JJJJ-MM-TT“. */
export function berlinTag(d: Date = new Date()): string {
  const b = berlinTeile(d);
  return `${b.j}-${String(b.m).padStart(2, "0")}-${String(b.t).padStart(2, "0")}`;
}
/** „Mi 22.10.“ aus „JJJJ-MM-TT“ — für die Vorschau-Zeile. */
export function kurzDatum(iso: string): string {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(iso || "");
  const wt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay();
  return `${WOCHENTAG_KURZ[wt]} ${m[3]}.${m[2]}.`;
}
/** 59.99 → „59,99 €“. */
export function betragText(n: number | string | null | undefined): string | null {
  const x = Number(n);
  if (!Number.isFinite(x) || x <= 0) return null;
  return `${x.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")} €`;
}

// ═══════════════════════════════════════════════════════════════════════════
// WAS VERSPRICHT DIE NOTIZ? — UNTERLAGEN
//
// Ein Versprechen ist ein Satz mit einer Unterlage UND einem Schick-/Lade-Verb, ohne Verneinung:
// „schickt die Kontoauszüge bis Freitag“, „lädt Ausweis heute hoch“, „reicht Unterlagen nach“.
// Nicht: „hat keine Kontoauszüge“, „Unterlagen liegen vor“, „Ausweis abgelaufen“.
// ═══════════════════════════════════════════════════════════════════════════
const UNTERLAGE_WORT: { art: LinkArt | "allgemein"; muster: RegExp }[] = [
  { art: "ausweis", muster: /\b(?:personal)?ausweis\w*|\breisepass\w*|\bpass(?:kopie|foto)?\b/i },
  { art: "kontoauszug", muster: /\b(?:konto)?ausz(?:ug|üge|uege)\w*|\bkontoauszug\w*/i },
  { art: "schufa", muster: /\bschufa\w*|\bbonitätsauskunft\w*|\bselbstauskunft\w*|\bdatenkopie\w*/i },
  { art: "allgemein", muster: /\b(?:unterlagen|dokument\w*|nachweis\w*|lohnabrechnung\w*|gehaltsabrechnung\w*|gehaltsnachweis\w*|belege?)\b/i },
];
const VERSPRECHEN_VERB = /\b(?:schick\w*|sende[nt]?|send\w*|zuschick\w*|zukommen|nachreich\w*|reicht\w*|reichen|hochlad\w*|lädt\b|laedt\b|l[äa]d\w*\s+[^.!?\n]{0,40}hoch\b|hoch(?:zu)?lad\w*|liefer\w*|bring\w*|versproch\w*|zusag\w*|einreich\w*|mail\w*)\b/i;
const VERNEINUNG = /\b(?:kein\w*|nicht|nie|niemals|ohne)\b/i;

/** Welche Unterlagen verspricht die Notiz? null = keine; ["allgemein"] = „Unterlagen“ ohne genaue Art. */
export function unterlagenAusNotiz(notiz: string | null | undefined): (LinkArt | "allgemein")[] | null {
  const saetze = String(notiz ?? "").split(/(?<=[.!?;\n])\s+|\s+[—–-]\s+/).map((s) => s.trim()).filter(Boolean);
  const arten = new Set<LinkArt | "allgemein">();
  for (const s of saetze) {
    if (!VERSPRECHEN_VERB.test(s) || VERNEINUNG.test(s)) continue;
    for (const w of UNTERLAGE_WORT) if (w.muster.test(s)) arten.add(w.art);
  }
  if (!arten.size) return null;
  // Eine genaue Art schlägt das allgemeine Wort („schickt die Unterlagen, also die Kontoauszüge“).
  const genau = Array.from(arten).filter((a) => a !== "allgemein");
  return genau.length ? genau : ["allgemein"];
}

/** Die Unterlagen, um die der Link bittet: die genannten — bei „Unterlagen“ ohne Art die fehlenden (Ausweis, Kontoauszug). */
export function unterlagenFuerLink(notiz: string | null | undefined, fehlende: readonly LinkArt[]): LinkArt[] {
  const u = unterlagenAusNotiz(notiz);
  if (!u) return [];
  if (u.includes("allgemein")) return fehlende.filter((a) => a === "ausweis" || a === "kontoauszug");
  return u.filter((a): a is LinkArt => a !== "allgemein");
}

// ═══════════════════════════════════════════════════════════════════════════
// HEIKLE NOTIZ — dann schreibt Mara NICHTS (ein Mensch hat das Gespräch, und das bleibt so)
// ═══════════════════════════════════════════════════════════════════════════
const HEIKEL: { muster: RegExp; grund: string }[] = [
  { muster: /k[üu]ndig\w*|\bstorn\w*|vertrag\s+(?:beenden|aufl[öo]sen|loswerden)|raus\s+aus\s+dem\s+vertrag/i, grund: "Kündigung oder Storno im Gespräch" },
  { muster: /widerruf\w*|widerrufen/i, grund: "Widerruf im Gespräch" },
  { muster: /beschwer\w*|unzufrieden|ver[äa]rgert|w[üu]tend|sauer\b|abzocke|betrug|betr[üu]g\w*|unseri[öo]s/i, grund: "Beschwerde oder Ärger im Gespräch" },
  { muster: /anwalt|anw[äa]lt\w*|rechtsanw\w*|gericht\w*|polizei|anzeige\b|verbraucherzentrale|bafin|beh[öo]rde/i, grund: "Anwalt, Behörde oder Gericht im Gespräch" },
  { muster: /erstatt\w*|r[üu]ckzahl\w*|zur[üu]ckzahl\w*|zur[üu]ck[üu]berweis\w*|geld\s+zur[üu]ck|r[üu]ckbuch\w*|chargeback/i, grund: "Erstattung oder Rückbuchung im Gespräch" },
  { muster: /datenschutz|l[öo]sch\w*|dsgvo/i, grund: "Datenschutz oder Löschung im Gespräch" },
  { muster: /krank\w*|klinik|krankenhaus|\bkur\b|operation|verstorb\w*|todesfall|trauer|beerdigung|psych\w*|geht\s+(?:es\s+)?(?:ihr|ihm|es)\s+(?:gerade\s+|momentan\s+|aktuell\s+)?(?:nicht|schlecht)/i, grund: "Gesundheit oder Privates im Gespräch" },
  { muster: /\bglobal\b|firmenkredit|\bgmbh\b|\bllc\b|\bfirma\b|unternehmen/i, grund: "FIAON Global oder Firmenthema im Gespräch" },
  { muster: /keine\s+(?:e-?mails?|mails?|post|nachrichten|werbung)|nicht\s+(?:mehr\s+)?(?:anschreiben|anrufen|kontaktieren)|kein(?:en)?\s+kontakt/i, grund: "Der Kunde will keine Nachrichten" },
  { muster: /weitergegeben|weitergeleitet|eskal\w*|schwarzott|\bchef\b|gesch[äa]ftsf[üu]hr\w*|leitung\s+(?:entscheidet|kl[äa]rt|meldet)|justin/i, grund: "an die Leitung weitergegeben — die Leitung meldet sich selbst" },
];
/** Steht in der Notiz ein Thema, zu dem Mara nichts Schriftliches schickt? Dann der Grund, sonst null. */
export function heikleNotiz(notiz: string | null | undefined): string | null {
  const t = String(notiz ?? "");
  for (const h of HEIKEL) if (h.muster.test(t)) return h.grund;
  return null;
}

/**
 * Welche Mail passt zu diesem Ergebnis? null = keine (nicht erreicht, Mailbox, abgelehnt, falsche Nummer, blockiert).
 * Abgeleitet aus der EINEN Ergebnisliste (shared/fiaon-kontakt-ergebnis-liste.ts), keine eigene Aufzählung
 * (scripts/pruef-ergebnis-eine-liste.ts): „zahlt …“ → Zusage, das Ergebnis mit Termin → Rückruf, das Ergebnis mit
 * Notizpflicht → Zusammenfassung (oder Upload-Link, wenn die Notiz Unterlagen verspricht).
 * `fehlende`: die Unterlagen, die in der Akte noch fehlen — nur für „Unterlagen“ ohne genaue Art.
 */
export function nacharbeitArt(ergebnis: string | null | undefined, notiz?: string | null, fehlende: readonly LinkArt[] = []): NacharbeitArt | null {
  const a = ergebnisAngabe(String(ergebnis ?? ""));
  if (!a || a.gibtAb) return null;
  if (a.braucht === "termin") return "termin";
  if (!a.art.startsWith("erreicht_")) return null;
  if (a.art.startsWith("erreicht_zahlt")) return "zusage";
  if (a.braucht === "notiz") return unterlagenFuerLink(notiz, fehlende).length ? "unterlagen" : "gespraech";
  return null;
}

/** Die Ergebnisse, nach denen Mara überhaupt eine Nacharbeit-Mail kennt (abgeleitet, s. o.). */
export const ERGEBNISSE_MIT_NACHARBEIT: readonly string[] = ERGEBNIS_LISTE.filter((e) => nacharbeitArt(e.art, null, ["ausweis"]) !== null).map((e) => e.art);

// ═══════════════════════════════════════════════════════════════════════════
// DAS URTEIL
// ═══════════════════════════════════════════════════════════════════════════
/** Was der Server über den Menschen und die vorgemerkte Mail weiß — vollständig, damit die Regel nichts rät. */
export interface NacharbeitFakten {
  /** Gibt es die Person noch (nicht zusammengeführt)? */
  personDa: boolean;
  art: NacharbeitArt | null;
  /** Kunde von FIAON Global (fiaon-global-kunde.ts)? */
  globalKunde: boolean;
  /** werbungVerboten(menschSperre): Werbesperre, „Stopp“, Testkonto, Vertriebssperre, gekündigt — null = frei. */
  sperre: string | null;
  /** Eingegangener, noch nicht gebuchter Kündigungsantrag (KUENDIGUNG_UNGEBUCHT_SQL). */
  kuendigungOffen: boolean;
  /** heikleNotiz(notiz) — der Grund oder null. */
  notizHeikel: string | null;
  /** Ein offener heikler Auftrag zu ihm (Kündigung, Beschwerde, Löschung, Eskalation, heikle Mara-Übergabe) — Art oder null. */
  heiklerAuftrag: string | null;
  /** Gibt es eine zustellbare Adresse (dieselbe Rangfolge wie der Versand)? */
  hatEmail: boolean;
  /** Die jüngste VERSANDTE Nacharbeit-Mail an ihn — Zeitpunkt oder null. */
  letzteNacharbeitAm: string | Date | null;
  /** Zusage: die offene Zahlung (Erstzahlung oder älteste offene Rate) — null = keine. */
  zahlung?: { status: string; betrag: number | null } | null;
  /** Zusage: der zugesagte Tag (JJJJ-MM-TT). */
  zusageTag?: string | null;
  /** Rückruf: der vereinbarte Zeitpunkt. */
  terminAm?: string | Date | null;
  /** Rückruf: steht er noch (nicht erledigt, nicht verworfen)? */
  terminSteht?: boolean;
  /** Unterlagen: um welche der Link bittet. */
  unterlagen?: readonly LinkArt[] | null;
  /** Wann vorgemerkt (für die Wartezeit REIF_MINUTEN) — null beim Vormerken selbst = jetzt. */
  vorgemerktAm?: string | Date | null;
}

export type NacharbeitUrteil =
  | { art: "senden" }
  | { art: "warten"; nichtVor: Date; grund: string }
  | { art: "auslassen"; grund: string }
  | { art: "erledigt"; grund: string };

export const GRUND = {
  personWeg: "Person nicht mehr da (zusammengeführt oder gelöscht)",
  keineArt: "zu diesem Ergebnis schickt Mara nichts",
  global: "Kunde von FIAON Global — sein Ansprechpartner schreibt selbst",
  kuendigung: "Kündigung eingegangen (noch nicht gebucht)",
  keineMail: "keine E-Mail-Adresse hinterlegt",
  doppelt: `Mara hat ihm in den letzten ${DOPPELT_STUNDEN} Stunden schon eine Zusammenfassung geschickt`,
  keineZahlung: "keine offene Zahlung — nichts zu bestätigen",
  gemeldet: "Zahlung schon gemeldet — Mara bestätigt keine zweite",
  abgelaufen: "die Bestellung ist abgelaufen — erst in der Akte neu freischalten",
  bezahlt: "inzwischen bezahlt",
  zusageVorbei: "der zugesagte Tag ist vorbei",
  terminWeg: "der Rückruf steht nicht mehr",
  terminGleich: "der Rückruf steht gleich an — keine Mail nötig",
  keineUnterlage: "keine Unterlage, um die Mara bitten könnte",
  reif: "wartet ein paar Minuten (Zeit zum Berichtigen)",
  fenster: "außerhalb 08:00–20:00 — geht ab 8 Uhr raus",
} as const;

const zeit = (d: string | Date | null | undefined): number => (d ? new Date(d).getTime() : NaN);

/**
 * Die eine Regel: Was tut Mara jetzt mit dieser Nacharbeit? Rein — dieselbe Prüfung beim Vormerken (nach dem Klick)
 * und beim Senden (im Takt), damit sich zwischendurch Geändertes (bezahlt, gekündigt, gesperrt) durchsetzt.
 */
export function nacharbeitUrteil(f: NacharbeitFakten, jetzt: Date = new Date()): NacharbeitUrteil {
  if (!f.personDa) return { art: "auslassen", grund: GRUND.personWeg };
  if (!f.art) return { art: "auslassen", grund: GRUND.keineArt };
  if (f.globalKunde) return { art: "auslassen", grund: GRUND.global };
  if (f.sperre) return { art: "auslassen", grund: f.sperre };
  if (f.kuendigungOffen) return { art: "auslassen", grund: GRUND.kuendigung };
  if (f.notizHeikel) return { art: "auslassen", grund: f.notizHeikel };
  if (f.heiklerAuftrag) return { art: "auslassen", grund: `offener Auftrag „${f.heiklerAuftrag}“ — ein Mensch klärt das` };
  if (!f.hatEmail) return { art: "auslassen", grund: GRUND.keineMail };
  const letzte = zeit(f.letzteNacharbeitAm);
  if (Number.isFinite(letzte) && jetzt.getTime() - letzte < DOPPELT_STUNDEN * 3_600_000) return { art: "auslassen", grund: GRUND.doppelt };

  if (f.art === "zusage") {
    const z = f.zahlung ?? null;
    if (!z) return { art: "auslassen", grund: GRUND.keineZahlung };
    if (z.status === "paid") return { art: "erledigt", grund: GRUND.bezahlt };
    if (z.status === "claimed_paid") return { art: "auslassen", grund: GRUND.gemeldet };
    if (z.status === "expired") return { art: "auslassen", grund: GRUND.abgelaufen };
    if (z.status !== "pending_payment" || !(Number(z.betrag) > 0)) return { art: "auslassen", grund: GRUND.keineZahlung };
    if (f.zusageTag && f.zusageTag < berlinTag(jetzt)) return { art: "erledigt", grund: GRUND.zusageVorbei };
  }
  if (f.art === "termin") {
    const t = zeit(f.terminAm);
    if (!f.terminSteht || !Number.isFinite(t)) return { art: "erledigt", grund: GRUND.terminWeg };
    if (t - jetzt.getTime() < TERMIN_MINDEST_MINUTEN * 60_000) return { art: "erledigt", grund: GRUND.terminGleich };
  }
  if (f.art === "unterlagen" && !(f.unterlagen ?? []).length) return { art: "auslassen", grund: GRUND.keineUnterlage };

  const vorgemerkt = zeit(f.vorgemerktAm);
  const reifAb = (Number.isFinite(vorgemerkt) ? vorgemerkt : jetzt.getTime()) + REIF_MINUTEN * 60_000;
  if (reifAb > jetzt.getTime()) {
    const ab = new Date(reifAb);
    return { art: "warten", nichtVor: imVersandfenster(ab) ? ab : naechstesFenster(ab), grund: imVersandfenster(ab) ? GRUND.reif : GRUND.fenster };
  }
  if (!imVersandfenster(jetzt)) return { art: "warten", nichtVor: naechstesFenster(jetzt), grund: GRUND.fenster };
  return { art: "senden" };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE VORSCHAU — EINE ZEILE FÜR DEN MITARBEITER, BEVOR ER SPEICHERT
// ═══════════════════════════════════════════════════════════════════════════
/** Was der Server dem Häkchen liefert (GET /agent/crm/kunden/:personId/mara-nacharbeit). */
export interface NacharbeitVorschauDaten {
  /** Der Schalter in Maras Einstellungen — aus: kein Häkchen. */
  an: boolean;
  /** Personen-Sperren (Global, Sperre, Kündigung, heikler Auftrag, keine Adresse, schon heute) — der Grund oder null. */
  sperrGrund: string | null;
  /** Die offene Zahlung als Text („59,99 €“) — null: keine. */
  betrag: string | null;
  /** Warum keine Zahlungszusage geht (keine offene Zahlung, schon gemeldet, abgelaufen) — null: geht. */
  zahlungGrund: string | null;
  /** Unterlagen, die in der Akte fehlen (für „Unterlagen“ ohne genaue Art). */
  fehlende: LinkArt[];
}

export interface VorschauEin {
  ergebnis: string | null;
  notiz?: string | null;
  /** „Zahlt am …“: JJJJ-MM-TT. */
  zusageDatum?: string | null;
  /** „Rückruf“: JJJJ-MM-TT und HH:MM. */
  terminDatum?: string | null;
  terminZeit?: string | null;
  heute: string;
}

/** Die Zeile (ohne „Mara mailt:“) und ob gesendet werden kann. Rein — die Oberfläche zeigt sie, der Server prüft neu. */
export function nacharbeitVorschau(d: NacharbeitVorschauDaten | null, e: VorschauEin): { moeglich: boolean; art: NacharbeitArt | null; zeile: string } {
  const art = nacharbeitArt(e.ergebnis, e.notiz ?? null, d?.fehlende ?? []);
  if (!art) return { moeglich: false, art: null, zeile: "nach diesem Ergebnis schickt Mara nichts" };
  if (!d) return { moeglich: false, art, zeile: "lädt …" };
  if (d.sperrGrund) return { moeglich: false, art, zeile: `nichts — ${d.sperrGrund}` };
  const heikel = heikleNotiz(e.notiz);
  if (heikel) return { moeglich: false, art, zeile: `nichts — ${heikel}` };
  if (art === "zusage") {
    if (d.zahlungGrund || !d.betrag) return { moeglich: false, art, zeile: `nichts — ${d.zahlungGrund ?? GRUND.keineZahlung}` };
    const tag = e.ergebnis === "erreicht_zahlt_am" ? (e.zusageDatum || "") : e.heute;
    return { moeglich: true, art, zeile: `${d.betrag} ${!tag || tag === e.heute ? "heute" : `bis ${kurzDatum(tag)}`} + Zahlungsseite` };
  }
  if (art === "termin") {
    const zeitText = /^\d{1,2}:\d{2}$/.test(String(e.terminZeit || "")) ? `, ${e.terminZeit} Uhr` : "";
    return { moeglich: !!e.terminDatum, art, zeile: e.terminDatum ? `Rückruf ${kurzDatum(e.terminDatum)}${zeitText} bestätigen` : "Rückruf bestätigen (Tag fehlt noch)" };
  }
  if (art === "unterlagen") {
    const arten = unterlagenFuerLink(e.notiz, d.fehlende);
    return { moeglich: true, art, zeile: `Upload-Link für ${arten.map((a) => LINK_ART_TEXT[a].titel).join(", ")}` };
  }
  return { moeglich: true, art, zeile: "kurze Zusammenfassung deiner Notiz" };
}

/** Der Satz an den Mitarbeiter nach dem Speichern (hängt an der Meldung des Ergebnisses). */
export function hinweisFuerMitarbeiter(u: NacharbeitUrteil, art: NacharbeitArt, jetzt: Date = new Date()): string | null {
  const was = art === "unterlagen" ? "den Upload-Link" : art === "gespraech" ? "eine kurze Zusammenfassung" : `die Zusammenfassung (${ART_TEXT[art]})`;
  if (u.art === "senden") return `Mara schickt dem Kunden gleich ${was}.`;
  if (u.art === "warten") return u.grund === GRUND.reif ? `Mara schickt dem Kunden in ein paar Minuten ${was}.` : `Mara schickt dem Kunden ${wannText(u.nichtVor, jetzt)} Uhr ${was}.`;
  if (u.art === "auslassen") return `Mara schickt keine Mail: ${u.grund}.`;
  return null;
}
