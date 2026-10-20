// ═══════════════════════════════════════════════════════════════════════════
// PRÜF-MARA — DIE REINEN REGELN (E-409, 19.10.2026)
//
// Justin (fiaon-mara-endziel): Qualitätskontrolle von Maras Arbeit macht eine
// zweite KI automatisch; nur Auffälliges kommt als Karte zu ihm. Keine
// Mitarbeiter-Pflicht. Hier stehen die HARTEN Regeln ohne KI — dieselbe
// Wortwand, derselbe Ton wie beim Schreiben (shared/fiaon-wortverbote.ts,
// shared/fiaon-mara-ton.ts) — plus die Telefon-Regeln des Vertrags (§ 11):
// KI-Hinweis in den ersten 20 s, Anliegen erst nach Identitätsbestätigung,
// Aufnahme erst nach dem Ja, kein „Lastschrift“, kein Druck (KI-VO Art. 5
// Abs. 1 lit. b — wirtschaftliche Lage), keine Vertrags-Zusage per Stimme.
//
// Alles hier ist rein (kein Netz, keine Datenbank) und in
// scripts/pruef-ki-pruefung.ts geprüft. Der Server (server/lib/fiaon-ki-pruefung.ts)
// ruft `harteRegeln`, fragt danach das Modell und bildet mit `urteilBilden` das Urteil.
//
// E-409 Nachbesserung (20.10.2026, Prüfer-Funde 7 + 8):
//   · Am Telefon gelten die Textregeln NUR für das, was Aras sagt (arasText) — „Sonst gehe ich zum Anwalt“
//     aus dem Mund des Kunden ist kein Fehler von Aras. Eine Zusammenfassung ist kein Wortlaut: ohne Transkript
//     gibt der Server keinen Text in die Textregeln (nur die Zeiten und Teams 1 Live-Befund).
//   · „Anliegen erst nach Identität“ liest das GANZE Gespräch: Bestätigt ist erst ein Ja des Kunden NACH der
//     Identitätsfrage. Beginnt das Transkript erst mitten im Gespräch (z. B. ab dem Aufnahme-Ja), fehlt der Anfang —
//     dann prüft die Regel nichts, statt fast jeden Anruf zum „Fehler“ zu machen.
//   · telefonRegeln = Teams 1 Form (shared/fiaon-aras-regeln.ts, ohne Ton-Prüfung) — damit die Datei dort zur
//     reinen Weiterleitung werden kann (ihr Kopf sagt das so). Mit Teams 1 Ergänzungen: Druck in umgekehrter
//     Reihenfolge, „€“ als Anliegen.
// ═══════════════════════════════════════════════════════════════════════════
import { wandPruefen, kopplungFinden, drohungFinden } from "./fiaon-wortverbote";
import { tonPruefung, limitPruefen, type MaraKanal } from "./fiaon-mara-ton";
import type { MitarbeiterEintrag } from "./fiaon-mitarbeiter-name";
import type { PruefPunkt } from "./fiaon-ki-team";

export type PruefKanal = "telefon" | "mail" | "whatsapp";
export type PruefUrteil = "ok" | "auffaellig" | "fehler";

/** Eine Transkriptzeile (fiaon_aras_anruf.transkript bzw. Live-Zeilen). */
export interface TranskriptZeile { t?: number; wer: "kunde" | "aras"; text: string }

export interface PruefKontext {
  kanal: PruefKanal;
  land?: "DE" | "AT" | "CH" | null;
  mitarbeiter?: readonly MitarbeiterEintrag[] | null;
  kundeNamen?: readonly (string | null | undefined)[];
  /** Telefon: Zeiten in Sekunden seit Abheben (null = unbekannt). */
  telefon?: {
    kiHinweisSek?: number | null;
    aufnahmeJaSek?: number | null;
    aufnahmeGestartetSek?: number | null;
    aufnahmeNeinSek?: number | null;
    /** Twilio meldete „Maschine“, obwohl der Kunde sprach. */
    amdWiderspruch?: boolean;
    /** Der Kunde sagte „nicht mehr anrufen“, und die Sperre fehlt. */
    sperrwunschOhneSperre?: boolean;
    transkript?: TranskriptZeile[] | null;
  } | null;
}

// ── Druck (KI-VO Art. 5 Abs. 1 lit. b): Zeitfallen, Drohkulisse, Ausnutzen der Lage ──
const DRUCK_MUSTER: { re: RegExp; hinweis: string }[] = [
  { re: /\b(?:nur|bloß|bloss)\s+(?:noch\s+)?heute\b|\bnur\s+(?:noch\s+)?bis\s+(?:heute|morgen|mitternacht)\b|\bheute\s+ist\s+(?:die|ihre)\s+letzte\b/i, hinweis: "Zeitfalle („nur heute“) — verboten (KI-VO Art. 5)." },
  { re: /\bletzte\s+(?:chance|gelegenheit|möglichkeit|moeglichkeit)\b/i, hinweis: "„Letzte Chance“ ist Druck — verboten." },
  { re: /\b(?:sonst|andernfalls|ansonsten)\b[^.!?\n]{0,80}\b(?:gericht|mahnbescheid|inkasso|schufa|anzeige|anwalt|pfändung|pfaendung|vollstreck|zwangs)/i, hinweis: "Drohkulisse („sonst Gericht/SCHUFA/Inkasso“) — verboten." },
  { re: /\b(?:wenn|falls)\s+sie\s+(?:nicht|jetzt\s+nicht)\b[^.!?\n]{0,80}\b(?:gericht|mahnbescheid|inkasso|schufa|anzeige|anwalt|pfändung|pfaendung|vollstreck|zwangs|teurer|verlieren)/i, hinweis: "Bedingte Drohung („wenn Sie nicht … dann …“) — verboten." },
  // Umgekehrte Reihenfolge („… kommt das Gericht, wenn Sie nicht zahlen“) — dieselbe Drohung (aus Teams 1 Fassung, E-408).
  { re: /\b(?:gericht|mahnbescheid|inkasso|schufa|anzeige|anwalt|pfändung|pfaendung|vollstreck|zwangs)[^.!?\n]{0,80}\b(?:wenn|falls)\s+sie\s+(?:nicht|jetzt\s+nicht)\b/i, hinweis: "Bedingte Drohung („… Gericht, wenn Sie nicht …“) — verboten." },
  { re: /\bsie\s+haben\b[^.!?\n]{0,24}\b(?:keine|kein)\s+(?:andere\s+)?(?:wahl|möglichkeit|moeglichkeit|alternative)\b/i, hinweis: "Ausnutzen der Lage („keine andere Wahl“) — verboten." },
  { re: /\bjetzt\s+oder\s+nie\b|\bsofort\s+entscheiden\b|\b(?:das\s+angebot|der\s+preis)\s+gilt\s+nur\s+(?:jetzt|heute|solange)\b/i, hinweis: "Entscheidungsdruck — verboten." },
];
/** Der erste Druck-Treffer (Hinweis) oder null. Rein. */
export function druckFinden(text: string): string | null {
  const t = String(text ?? "");
  for (const m of DRUCK_MUSTER) if (m.re.test(t)) return m.hinweis;
  return null;
}

/** „Lastschrift“ ist ausgeschlossen (Justin 19.10.: der Kunde überweist aktiv und selbst) — außer im Verbotssatz. */
export function lastschriftFinden(text: string): string | null {
  const t = String(text ?? "");
  const m = /\b(?:lastschrift|sepa-?mandat|einzugsermächtigung|einzugsermaechtigung|abbuchen|abbuchung|einziehen)\b/i.exec(t);
  if (!m) return null;
  const satz = t.slice(Math.max(0, t.lastIndexOf(".", m.index) + 1), t.indexOf(".", m.index) === -1 ? t.length : t.indexOf(".", m.index) + 1);
  if (/\b(?:kein|keine|nicht|nie|ausgeschlossen|gibt es nicht|bieten wir nicht)\b/i.test(satz)) return null;
  return m[0];
}

/** Vertrag per Stimme/Text „geschlossen“ — verboten: der Kunde unterschreibt selbst (E-329, § 9 Abs. 2 FAGG). */
export function vertragZusageFinden(text: string): string | null {
  const m = /\b(?:dann\s+sind\s+wir\s+(?:uns\s+)?einig|(?:der\s+)?vertrag\s+(?:ist\s+)?(?:hiermit\s+)?(?:abgeschlossen|zustande\s+gekommen|geschlossen)|(?:das|es)\s+gilt\s+als\s+(?:abgeschlossen|vereinbart)|ich\s+(?:buche|schließe|schliesse)\s+(?:das|den\s+vertrag)\s+(?:jetzt\s+)?(?:für\s+sie\s+)?ab)\b/i.exec(String(text ?? ""));
  return m ? m[0] : null;
}

/** Nennt die Zeile das Anliegen (Rate, Antrag, Paket, Betrag)? Vor der Identitätsbestätigung verboten (Dritte am Telefon). */
export function anliegenGenannt(text: string): boolean {
  return /\b(?:rate|raten|antrag|paket|limit|überweis|ueberweis|zahlung|euro|verwendungszweck)\b|€/i.test(String(text ?? ""));
}

// ── Wer spricht? (E-409 Fund 7) ────────────────────────────────────────────
/**
 * Nur was ARAS sagt: aus „ARAS: … / KUNDE: …“ bleiben die Aras-Zeilen (ohne Marke), Kundenzeilen fallen weg; eine
 * Zeile ohne Marke gehört zum Sprecher davor (ohne jede Marke: alles Aras — so gibt Teams 1 Live-Prüfung ihn schon). Rein.
 */
export function arasText(text: string): string {
  let wer: "aras" | "kunde" = "aras";
  const aus: string[] = [];
  for (const zeile of String(text ?? "").split("\n")) {
    const m = /^\s*(ARAS|KUNDE)\s*:\s?/i.exec(zeile);
    if (m) wer = m[1].toUpperCase() === "KUNDE" ? "kunde" : "aras";
    if (wer === "aras") aus.push(m ? zeile.slice(m[0].length) : zeile);
  }
  return aus.join("\n");
}

/** Das Transkript als Text mit Sprecher-Marken (eine Zeile je Beitrag) — für das Modell und den Karten-Ausschnitt. Rein. */
export function transkriptText(zeilen: readonly TranskriptZeile[] | null | undefined): string {
  return (zeilen ?? []).filter((z) => String(z.text ?? "").trim()).map((z) => `${z.wer === "kunde" ? "KUNDE" : "ARAS"}: ${String(z.text).replace(/\s+/g, " ").trim()}`).join("\n");
}

// ── Identität vor Anliegen (E-409 Fund 8) ──────────────────────────────────
const KI_HINWEIS_RE = /\b(?:ki|künstliche intelligenz|kuenstliche intelligenz|digitale[rn]?\s+assistent)\b/i;
/** Fragt Aras, ob der Richtige dran ist? */
const IDENTITAET_FRAGE = new RegExp([
  "\\bspreche\\s+ich\\s+(?:da\\s+|hier\\s+)?(?:mit|bei)\\b",
  "\\b(?:bin|wäre|waere)\\s+ich\\s+(?:da\\s+|hier\\s+)?richtig\\s+bei\\b",
  "\\bsind\\s+sie\\s+(?:selbst|persönlich|persoenlich|herr|frau)\\b",
  "\\bhabe\\s+ich\\s+(?:da\\s+)?(?:herrn?|frau)\\b",
  "\\b(?:ist|wäre|waere)\\s+(?:herr|frau)\\s+[\\wäöüß-]+\\s+(?:zu\\s+sprechen|da|am\\s+apparat|erreichbar)\\b",
  "\\bmit\\s+wem\\s+spreche\\s+ich\\b",
  "\\b(?:darf|kann|könnte|koennte)\\s+ich\\s+(?:kurz\\s+|bitte\\s+)?mit\\s+(?:herrn?|frau)\\b",
  "\\b(?:möchte|moechte|würde|wuerde)\\s+(?:gerne?\\s+)?(?:mit\\s+)?(?:herrn?|frau)\\s+[\\wäöüß-]+\\s+sprechen\\b",
  "\\b(?:bestätigen|bestaetigen)\\s+sie\\s+(?:mir\\s+)?(?:kurz\\s+|bitte\\s+)?ihr(?:en)?\\s+(?:namen|geburtsdatum)\\b",
  // E-408 (Justin 20.10., Anruf 16): die Eröffnung grüßt mit Namen („Grüß Gott, Herr Probe! Hier ist Aras …“) — das IST die
  // Frage, ob er es ist: Antwortet er, ist er es; ist es jemand anderes, sagt er es.
  "^\\s*(?:grüß\\s+gott|gruess\\s+gott|guten\\s+(?:tag|morgen|abend)|hallo|hi|servus)\\s*,?\\s+(?:herr|frau)\\s+[\\wäöüß-]+\\s*[!?.,]",
].join("|"), "i");
/** Sagt der Kunde „ja, ich bin es“? (nur NACH der Identitätsfrage gezählt) */
const BESTAETIGT = /^\s*(?:ja\b|jawohl\b|jap\b|jep\b|genau\b|richtig\b|korrekt\b|stimmt\b|selbst\b|persönlich\b|persoenlich\b|am\s+apparat\b|das\s+bin\s+ich\b|ich\s+bin(?:'s|s|\s+es|\s+das)\b|hier\s+ist\b|passt\b|gerne?\b|klar\b|freilich\b|(?:worum|um\s+was)\s+geht'?s\b|was\s+gibt'?s\b)|\b(?:am\s+apparat|das\s+bin\s+ich|ich\s+bin(?:'s|s)\b)/i;
/** … oder „nein“ / „hier ist seine Frau“ — dann ist NICHT bestätigt. */
const VERNEINT = /\b(?:nein|nee|falsch\s+verbunden|nicht\s+(?:da|zu\s+sprechen|zu\s*hause|erreichbar|im\s+haus)|bin\s+(?:ich\s+)?nicht|(?:seine|ihre)\s+(?:frau|mann|tochter|sohn|mutter|vater|partnerin|partner|schwester|bruder|freundin|freund)|ich\s+bin\s+(?:die|der)\s+(?:frau|mann|tochter|sohn|mutter|vater))\b/i;
const ANFANG_ARAS = /\bhier\s+ist\b|\bvon\s+fiaon\b|\bmein\s+name\s+ist\b/i;
const ANFANG_KUNDE = /^\s*(?:hallo\b|ja,?\s*hallo\b|guten\s+(?:tag|morgen|abend)\b|moin\b|servus\b|grüß\s+gott\b|gruess\s+gott\b|wer\s+ist\s+da\b|ja\s*\?\s*$)/i;

export function identitaetGefragt(text: string): boolean { return IDENTITAET_FRAGE.test(String(text ?? "")); }
export function identitaetBestaetigt(text: string): boolean { const t = String(text ?? ""); return BESTAETIGT.test(t) && !VERNEINT.test(t); }

/**
 * Steht der Anfang des Gesprächs im Transkript? Ja, wenn der Kunde mit dem Abheben beginnt („Hallo?“) oder eine der
 * ersten zwei Aras-Zeilen die Begrüßung mit Namen, den KI-Hinweis oder die Identitätsfrage trägt. Ein Transkript, das
 * erst ab dem Aufnahme-Ja läuft, beginnt mitten im Gespräch — darauf lassen sich Anfangs-Regeln nicht anwenden. Rein.
 */
export function gespraechsAnfang(zeilen: readonly TranskriptZeile[] | null | undefined): boolean {
  if (!zeilen?.length) return false;
  if (zeilen[0].wer === "kunde" && ANFANG_KUNDE.test(zeilen[0].text)) return true;
  return zeilen.filter((z) => z.wer === "aras").slice(0, 2).some((z) => ANFANG_ARAS.test(z.text) || KI_HINWEIS_RE.test(z.text) || IDENTITAET_FRAGE.test(z.text));
}

/**
 * Die erste Aras-Zeile, die das Anliegen (Rate, Antrag, Paket, Betrag) nennt, BEVOR der Kunde auf die Identitätsfrage
 * mit Ja geantwortet hat — über das ganze Gespräch, nicht nur bis zur ersten Kundenzeile (ein „Hallo?“ bestätigt nichts).
 * Ohne den Gesprächsanfang im Transkript: null (nicht prüfbar). Rein.
 */
export function anliegenVorIdentitaet(zeilen: readonly TranskriptZeile[] | null | undefined): string | null {
  if (!zeilen?.length || !gespraechsAnfang(zeilen)) return null;
  let gefragt = false;
  for (const z of zeilen) {
    if (z.wer === "aras") {
      if (anliegenGenannt(z.text)) return z.text.slice(0, 160);
      if (IDENTITAET_FRAGE.test(z.text)) gefragt = true;
    } else if (gefragt && identitaetBestaetigt(z.text)) {
      return null;
    }
  }
  return null;
}

/** Hat ARAS gesagt, dass er eine KI ist? (ENTWURF § 2: „digitale Assistent, also eine KI“) */
export function kiHinweisGesagt(zeilen: readonly TranskriptZeile[] | null | undefined): boolean {
  return (zeilen ?? []).some((z) => z.wer === "aras" && KI_HINWEIS_RE.test(z.text));
}

export const KI_HINWEIS_SPAETESTENS_SEK = 20;
/** Ton-Regeln, die nur beim Schreiben gelten (Anrede setzt der Server, Herr/Frau kommt aus der gespeicherten Anrede). */
const TON_NUR_BEIM_SCHREIBEN = new Set(["mail_anrede", "herr_frau"]);
type Push = (regel: string, schwere: "hart" | "weich", treffer: string, hinweis: string) => void;

/** Die Wortregeln (Wand, Limit, Kopplung, Drohung, Druck, Lastschrift) — dieselben für Schrift und Telefon. */
function wortRegeln(t: string, push: Push): void {
  for (const w of wandPruefen(t)) push(`wand_${w.art}`, w.art === "floskel" ? "weich" : "hart", w.treffer, w.hinweis);
  for (const l of limitPruefen(t)) push(`limit_${l.art}`, l.art === "ohne_bank" ? "weich" : "hart", l.satz, l.art === "zusage" ? "Limit zugesagt — nie ‚garantiert‘, nie ‚sicher‘." : l.art === "freigabe" ? "Freigabe versprochen — über den Rahmen entscheidet die Partnerbank." : "Limit ohne Bank-Satz genannt.");
  const kopp = kopplungFinden(t); if (kopp) push("kopplung", "hart", kopp, "Kündigung an Zahlung gekoppelt (§ 312k BGB).");
  const droh = drohungFinden(t); if (droh) push("drohung", "hart", droh, "Drohung — nie Gericht, Inkasso, SCHUFA, Anwalt.");
  const druck = druckFinden(t); if (druck) push("druck", "hart", druck, druck);
  const ls = lastschriftFinden(t); if (ls) push("lastschrift", "hart", ls, "Lastschrift ist ausgeschlossen — der Kunde überweist selbst.");
}

/** Die Telefon-Pflichten aus Zeiten und Transkript (Vertrag § 11). */
function telefonPflichten(tel: NonNullable<PruefKontext["telefon"]> | null, push: Push): void {
  if (!tel) return;
  const zeilen = tel.transkript ?? null;
  if (tel.kiHinweisSek == null && zeilen?.length && !kiHinweisGesagt(zeilen)) {
    // E-409 Fund 8: Fehlt der Gesprächsanfang im Transkript (es läuft erst ab dem Aufnahme-Ja), ist der Hinweis dort
    // gar nicht zu sehen — dann kein „Regelverstoß“, nur ein weicher Punkt (der Zeitpunkt ki_hinweis_am fehlt).
    if (gespraechsAnfang(zeilen)) push("ki_hinweis_fehlt", "hart", "", "KI-Hinweis nicht gesagt (KI-VO Art. 50).");
    else push("ki_hinweis_unbelegt", "weich", "", "KI-Hinweis nicht belegbar: das Transkript beginnt mitten im Gespräch, der Zeitpunkt fehlt.");
  }
  if (tel.kiHinweisSek != null && tel.kiHinweisSek > KI_HINWEIS_SPAETESTENS_SEK) push("ki_hinweis_spaet", "hart", `${Math.round(tel.kiHinweisSek)} s`, `KI-Hinweis erst nach ${Math.round(tel.kiHinweisSek)} s (erlaubt: ${KI_HINWEIS_SPAETESTENS_SEK} s).`);
  if (tel.aufnahmeGestartetSek != null && (tel.aufnahmeJaSek == null || tel.aufnahmeGestartetSek < tel.aufnahmeJaSek)) push("aufnahme_vor_ja", "hart", "", "Aufnahme vor dem hörbaren Ja gestartet (§ 201 StGB).");
  if (tel.aufnahmeNeinSek != null && tel.aufnahmeGestartetSek != null) push("aufnahme_trotz_nein", "hart", "", "Aufnahme trotz Nein gestartet.");
  if (tel.amdWiderspruch) push("amd_widerspruch", "weich", "", "Twilio meldete Maschine, obwohl der Kunde sprach — Gespräch lief weiter (Quote beobachten).");
  if (tel.sperrwunschOhneSperre) push("sperrwunsch_ohne_sperre", "hart", "", "Kunde will nicht mehr angerufen werden — Sperre fehlt.");
  const vorab = anliegenVorIdentitaet(zeilen);
  if (vorab) push("anliegen_vor_identitaet", "hart", vorab, "Rate/Antrag genannt, bevor der Kunde bestätigt hat, dass er selbst dran ist.");
}

function sammler(): { punkte: PruefPunkt[]; push: Push } {
  const punkte: PruefPunkt[] = [];
  return { punkte, push: (regel, schwere, treffer, hinweis) => { punkte.push({ regel, schwere, treffer: String(treffer ?? "").slice(0, 160), hinweis: String(hinweis ?? "").slice(0, 240) }); } };
}

/**
 * Alle harten Regeln auf einen Text (Mail, WhatsApp) oder ein Transkript (Telefon).
 * Telefon: die Wortregeln nur auf das, was ARAS sagt (arasText — Kundenzeilen fallen weg, E-409 Fund 7).
 * Rein. Jeder Punkt: regel (fester Schlüssel), schwere, treffer, hinweis.
 */
export function harteRegeln(text: string, k: PruefKontext): PruefPunkt[] {
  const { punkte, push } = sammler();
  const t = k.kanal === "telefon" ? arasText(text) : String(text ?? "");
  wortRegeln(t, push);
  const kanal: MaraKanal = k.kanal === "mail" ? "mail" : "whatsapp";
  // Die Ton-Prüfung gilt GESCHRIEBENEN Texten (Länge, Ausrufezeichen, Anrede-Form). Ein Telefon-Transkript ist gesprochen —
  // dort sind 1.000+ Zeichen normal; den Ton am Telefon beurteilt das Modell (20.10.2026, erste Live-Läufe).
  for (const b of k.kanal === "telefon" ? [] : tonPruefung(t, { kanal, land: k.land ?? null, mitarbeiter: k.mitarbeiter ?? null, kundeNamen: k.kundeNamen })) {
    // Zwei Ton-Regeln gelten dem MODELLTEXT vor dem Versand (der Server setzt die Anrede selbst) — eine gesendete
    // Mail trägt sie zu Recht. Für die Prüfung des Gesendeten sind sie kein Befund.
    if (TON_NUR_BEIM_SCHREIBEN.has(b.id)) continue;
    push(`ton_${b.id}`, b.schwere === "hart" ? "hart" : "weich", b.treffer, b.hinweis);
  }
  if (k.kanal === "telefon") {
    const v = vertragZusageFinden(t); if (v) push("vertrag_zusage", "hart", v, "Vertrag nie per Stimme schließen — Link zum Unterschreiben.");
    telefonPflichten(k.telefon ?? null, push);
  }
  return punkte;
}

// ── Teams 1 Form (E-408, shared/fiaon-aras-regeln.ts) — damit die Datei dort zur Weiterleitung werden kann ──────────
export type RegelZeile = TranskriptZeile;
export type RegelPunkt = PruefPunkt;
export type TelefonLage = Omit<NonNullable<PruefKontext["telefon"]>, "amdWiderspruch">;
/**
 * Die harten Telefon-Regeln für Aras’ Live-Prüfung (ohne Ton-Prüfung, wie Teams 1 telefonRegeln): Wortregeln auf das,
 * was ARAS sagt, Vertrag per Stimme, und — mit `tel` — die Pflichten aus Zeiten und Transkript. Rein.
 */
export function telefonRegeln(text: string, tel: TelefonLage | null = null): PruefPunkt[] {
  const { punkte, push } = sammler();
  const t = arasText(text);
  wortRegeln(t, push);
  const v = vertragZusageFinden(t); if (v) push("vertrag_zusage", "hart", v, "Vertrag nie per Stimme schließen — Link zum Unterschreiben.");
  telefonPflichten(tel, push);
  return punkte;
}

/** Was ein Telefon-Punkt bedeutet — für Teams 1 Live-Befund, der nur Schlüssel und Schwere speichert (kein Wortlaut). */
const TELEFON_HINWEIS: Record<string, string> = {
  ki_hinweis_fehlt: "KI-Hinweis nicht gesagt (KI-VO Art. 50).", ki_hinweis_spaet: "KI-Hinweis zu spät (erlaubt: 20 s).",
  ki_hinweis_unbelegt: "KI-Hinweis nicht belegbar.", aufnahme_vor_ja: "Aufnahme vor dem hörbaren Ja gestartet (§ 201 StGB).",
  aufnahme_trotz_nein: "Aufnahme trotz Nein gestartet.", sperrwunsch_ohne_sperre: "Kunde will nicht mehr angerufen werden — Sperre fehlt.",
  anliegen_vor_identitaet: "Rate/Antrag genannt, bevor der Kunde bestätigt hat, dass er selbst dran ist.",
  vertrag_zusage: "Vertrag nie per Stimme schließen — Link zum Unterschreiben.", druck: "Druck (KI-VO Art. 5) — verboten.",
  drohung: "Drohung — nie Gericht, Inkasso, SCHUFA, Anwalt.", lastschrift: "Lastschrift ist ausgeschlossen — der Kunde überweist selbst.",
  kopplung: "Kündigung an Zahlung gekoppelt (§ 312k BGB).", amd_widerspruch: "Twilio meldete Maschine, obwohl der Kunde sprach.",
};

/**
 * Teams 1 Live-Befund (fiaon_aras_anruf.pruefung = { live: true, punkte: [{ regel, schwere }] }) — bei Anrufen OHNE
 * Aufnahme-Ja die einzige Spur dessen, was gesagt wurde (der Wortlaut wird nie gespeichert). Rein; Unbekanntes fällt weg.
 */
export function liveBefundPunkte(roh: unknown): PruefPunkt[] {
  let o: any = roh;
  if (typeof o === "string") { try { o = JSON.parse(o); } catch { return []; } }
  if (!o || typeof o !== "object" || o.live !== true || !Array.isArray(o.punkte)) return [];
  return o.punkte.slice(0, 12).map((p: any) => {
    const regel = String(p?.regel ?? "").replace(/[^a-z0-9_]/gi, "_").toLowerCase().slice(0, 60);
    return { regel, schwere: p?.schwere === "hart" ? "hart" as const : "weich" as const, treffer: "", hinweis: `Live-Prüfung ohne Aufnahme: ${TELEFON_HINWEIS[regel] ?? regel.replace(/_/g, " ")}` };
  }).filter((p: PruefPunkt) => p.regel);
}

/** Punkte zusammenlegen — jede Regel einmal (die erste Fundstelle zählt). Rein. */
export function punkteZusammen(...listen: PruefPunkt[][]): PruefPunkt[] {
  const gesehen = new Set<string>();
  const aus: PruefPunkt[] = [];
  for (const l of listen) for (const p of l) { if (gesehen.has(p.regel)) continue; gesehen.add(p.regel); aus.push(p); }
  return aus;
}

/** Das Modell-Urteil, wie es der Server (oder die Attrappe im Prüfstand) liefert. */
export interface ModellUrteil { urteil: PruefUrteil; punkte: PruefPunkt[]; begruendung: string }

/** Die rohe Modell-Antwort in eine sichere Form bringen — nichts Unbekanntes kommt durch. Rein. */
export function modellUrteilLesen(roh: unknown): ModellUrteil | null {
  let o: any = roh;
  if (typeof o === "string") { try { o = JSON.parse(o); } catch { return null; } }
  if (!o || typeof o !== "object") return null;
  const urteil: PruefUrteil = o.urteil === "fehler" ? "fehler" : o.urteil === "auffaellig" ? "auffaellig" : "ok";
  const punkte: PruefPunkt[] = (Array.isArray(o.punkte) ? o.punkte : []).slice(0, 8).map((p: any) => ({
    regel: `modell_${String(p?.regel ?? "hinweis").replace(/[^a-z0-9_]/gi, "_").toLowerCase().slice(0, 40)}`,
    schwere: p?.schwere === "hart" ? "hart" : "weich",
    treffer: String(p?.treffer ?? "").slice(0, 160),
    hinweis: String(p?.hinweis ?? "").slice(0, 240),
  }));
  return { urteil, punkte, begruendung: String(o.begruendung ?? "").slice(0, 600) };
}

/**
 * Das Urteil: ein harter Treffer = fehler; sonst auffällig, wenn das Modell es sagt oder mindestens
 * zwei weiche Punkte zusammenkommen; ein einzelner weicher Punkt bleibt „ok“ (steht trotzdem in den Punkten).
 * Rein.
 */
export function urteilBilden(harte: PruefPunkt[], modell: ModellUrteil | null): { urteil: PruefUrteil; punkte: PruefPunkt[] } {
  const punkte = [...harte, ...(modell?.punkte ?? [])];
  if (punkte.some((p) => p.schwere === "hart") || modell?.urteil === "fehler") return { urteil: "fehler", punkte };
  const weich = punkte.filter((p) => p.schwere === "weich").length;
  if (modell?.urteil === "auffaellig" || weich >= 2) return { urteil: "auffaellig", punkte };
  return { urteil: "ok", punkte };
}

/** Karte nur bei Auffälligem — und die Empfehlung dazu (Vertrag § 11). */
// Karte nur bei einem Regelverstoß („fehler“). „Auffällig“ zählt still in KI-Team › Qualität — keine Aufgabe für Justin
// (20.10.2026: in den ersten 5 Minuten 26 Karten, fast alle Hinweise auf Justins eigenen Verkaufssatz E-373).
export function karteNoetig(urteil: PruefUrteil): boolean { return urteil === "fehler"; }
/** Höchstens so viele neue Prüf-Mara-Karten je Tag (Berlin) — mehr zählt nur in der Statistik. */
export const KARTEN_JE_TAG = 5;
export function empfehlungFuer(urteil: PruefUrteil): "in_ordnung" | "anweisen" { return urteil === "fehler" ? "anweisen" : "in_ordnung"; }

/**
 * Stichprobe: gehört diese Zeile (id) bei der Quote (0–100 %) in die Prüfung? Deterministisch —
 * dieselbe Zeile bekommt bei derselben Quote immer dieselbe Antwort (kein Zufall, der den Prüfstand wackeln lässt).
 */
export function inStichprobe(id: number, quote: number): boolean {
  const q = Math.max(0, Math.min(100, Math.round(Number(quote) || 0)));
  if (q >= 100) return true;
  if (q <= 0) return false;
  let h = 2166136261;
  for (const z of `pruef:${Math.trunc(id)}`) { h ^= z.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return (h % 100) < q;
}

/** Die Prüfquoten (fiaon_settings.pruef_mara_quote) lesen — Vorgabe telefon 100, mail 20, whatsapp 20. Rein. */
export const QUOTE_VORGABE = { telefon: 100, mail: 20, whatsapp: 20 } as const;
export function quotenLesen(roh: unknown): { telefon: number; mail: number; whatsapp: number } {
  let o: any = roh;
  if (typeof o === "string") { try { o = JSON.parse(o); } catch { o = null; } }
  const z = (k: keyof typeof QUOTE_VORGABE) => {
    const n = Number(o?.[k]);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : QUOTE_VORGABE[k];
  };
  return { telefon: z("telefon"), mail: z("mail"), whatsapp: z("whatsapp") };
}

/** Fehlerquote je Schlüssel (Werkzeug/Spielart/Kanal) aus Zählzeilen — und die Vorschläge „gelb → grün“. Rein. */
export function fehlerquoteRechnen(
  zeilen: { kanal: string; schluessel: string | null; n: number; auffaellig: number }[],
  opt: {
    tage: number; gelb?: readonly string[];
    /**
     * E-409 Fund 16: je Werkzeug, das in den geprüften Fällen unter Gelb lief (fiaon_ki_pruefung.werkzeuge) — die Grundlage
     * für „gelb → grün“. Die Kanal-Schlüssel (postfach:…, aktion:…) heißen nie wie ein Werkzeug; ohne diese Liste kam nie ein Vorschlag.
     */
    werkzeuge?: { schluessel: string; n: number; auffaellig: number }[];
  } = { tage: 7 },
): { je: { kanal: string; schluessel: string; n: number; auffaellig: number; quote: number }[]; gesamt: { n: number; auffaellig: number; quote: number }; vorschlaege: string[] } {
  const je = zeilen.map((z) => {
    const n = Number(z.n) || 0, a = Number(z.auffaellig) || 0;
    return { kanal: z.kanal, schluessel: z.schluessel ?? "(ohne)", n, auffaellig: a, quote: n ? Math.round((a / n) * 1000) / 10 : 0 };
  }).sort((x, y) => y.quote - x.quote || y.n - x.n);
  const n = je.reduce((s, z) => s + z.n, 0), a = je.reduce((s, z) => s + z.auffaellig, 0);
  const vorschlaege: string[] = [];
  if (opt.tage >= 28) {
    const basis = opt.werkzeuge
      ? opt.werkzeuge.map((w) => { const n = Number(w.n) || 0, a = Number(w.auffaellig) || 0; return { schluessel: w.schluessel, n, quote: n ? Math.round((a / n) * 1000) / 10 : 0 }; })
      : je;
    for (const g of opt.gelb ?? []) {
      const z = basis.find((x) => x.schluessel === g);
      if (z && z.n >= 20 && z.quote < 2) vorschlaege.push(`„${g}“: ${z.n} Prüfungen in ${opt.tage} Tagen, ${z.quote} % auffällig — gelb → grün wäre vertretbar.`);
    }
  }
  return { je, gesamt: { n, auffaellig: a, quote: n ? Math.round((a / n) * 1000) / 10 : 0 }, vorschlaege };
}

/** Transkript-Ausschnitt für die Karte: nur der betroffene Satz, ≤ 300 Zeichen, ohne Vornamen der Mitarbeiter. Rein. */
export function ausschnittFuerKarte(text: string, treffer: string, mitarbeiter?: readonly MitarbeiterEintrag[] | null): string {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  let s = t;
  const i = treffer ? t.toLowerCase().indexOf(String(treffer).toLowerCase()) : -1;
  if (i >= 0) {
    const a = Math.max(0, t.lastIndexOf(". ", i) + 1), e = t.indexOf(". ", i);
    s = t.slice(a, e === -1 ? t.length : e + 1).trim();
  }
  for (const m of mitarbeiter ?? []) {
    if (m.vorname) s = s.replace(new RegExp(`\\b${m.vorname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), m.anrede ? `${m.anrede} ${m.nachname}` : m.nachname);
  }
  return s.length > 300 ? `${s.slice(0, 297)}…` : s;
}
