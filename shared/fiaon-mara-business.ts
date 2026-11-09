// ═══════════════════════════════════════════════════════════════════════════
// MARA BUSINESS — JUSTINS DIGITALE ASSISTENTIN FÜR FIAON GLOBAL (E-481, 05.11.2026)
//
// Justin (05.11.2026): „Mara komplett neu trainieren auf den Business Kontext, WhatsApp Vorlagen einreichen (sehr edle …),
// und der Kunde sich aussuchen kann, telefonische Beratung, Beratung via Mail … aber Mara eben einspeisen, für das haben
// wir es ja (also WhatsApp) … US LLC mit Zugang zum Finanzmarkt, das ist unser pitch — wie wir es mit dem Kunden dann
// machen ist individuell anzusehen.“ Danach „alles an … wirklich alles vollautomatisiert! GOGO“ = Entscheidung 4× A:
//   1. Mara ist Justins digitale Assistentin NUR auf WhatsApp. E-Mail bleibt Justins Stimme (js@, E-476 Entscheidung 2 A).
//   2. Sie schreibt einen neuen Lead einmal zuerst an (fiaon_gl_willkommen, drei Knöpfe) — nur mit seinem Ja zu WhatsApp.
//   3. Global-Kunden mit Vertrag bleiben bei Justin (E-272 unverändert).
//   4. Eine eigene Nummer „FIAON Global“ folgt; bis dahin schreibt Mara von der heutigen Nummer.
//
// Hier steht nur, was ohne Datenbank gilt: Stimme, Wissen, Grenzen, die Wand, die Knöpfe der Vorlagen und der
// WhatsApp-Link mit Anfrage-Kennung. Server (fiaon-mara-business.ts), Lead-Mails, Website und Prüfstand lesen von hier.
//
// Wortwand: „Beratung/beraten“ ist für automatische Texte gesperrt (shared/fiaon-wortverbote.ts) — Mara sagt „Gespräch“;
// „Unternehmensberatung“ geht durch. Repo öffentlich: keine Kundennamen, keine Nummern.
// ═══════════════════════════════════════════════════════════════════════════
import { RADAR_VERKAUF, radarBankVorbehalt } from "./fiaon-radar";
import { GLOBAL_PAKETE, globalPreisText } from "./fiaon-global";
import { leadCodeForm, LEAD_CODE_LAENGE } from "./fiaon-lead-weg";

/** Wie Mara sich vorstellt (KI-Verordnung Art. 50: in der ersten Nachricht jedes Gesprächs). */
export const MB_ROLLE = "die digitale Assistentin von Justin Schwarzott";
/** Der Kopf jeder Business-Vorlage — wie ein Briefkopf. */
export const MB_KOPF = "FIAON Global";
/** Die Fußzeile jeder Business-Vorlage (49 Zeichen, Meta erlaubt 60) — zugleich der dauerhafte KI-Hinweis. */
export const MB_FUSS = "Mara · Digitale Assistentin von Justin Schwarzott";
/** Der Absendername im Verlauf (WhatsApp-Raum, Protokoll). */
export const MB_VON = "Mara (FIAON Global)";
/** Der KI-Dienst — eigener Name für die KI-Kasse (Topf „Antworten an Menschen“) und die Kostenzählung. */
export const MB_DIENST = "mara-business";

/** Der Pitch (Justin) — der genaue Weg wird im Gespräch individuell festgelegt. */
export const MB_PITCH = "eine eigene US-Gesellschaft mit Zugang zum größten Finanzmarkt der Welt";

// ── Die Wege zum Gespräch ────────────────────────────────────────────────────
export const GESPRAECHSWEGE = ["telefon", "mail", "whatsapp"] as const;
export type Gespraechsweg = (typeof GESPRAECHSWEGE)[number];
export const WEG_TEXT: Readonly<Record<Gespraechsweg, string>> = {
  telefon: "Telefonat mit Justin Schwarzott",
  mail: "per E-Mail mit Justin Schwarzott",
  whatsapp: "auf WhatsApp mit Mara",
};
export function istGespraechsweg(w: unknown): w is Gespraechsweg {
  return (GESPRAECHSWEGE as readonly string[]).includes(String(w ?? ""));
}

// ── Die Knöpfe der Vorlagen (Quick Replies) — was ein Tipp darauf bedeutet ──────
export type KnopfAktion =
  | { art: "weg"; weg: Gespraechsweg }
  | { art: "termin_ja" } | { art: "spaeter" } | { art: "passt" } | { art: "verschieben" } | { art: "antwort_lesen" };
/** Knopftext (wie in den Vorlagen) → Aktion. Meta liefert beim Tippen den Text des Knopfes. */
export const MB_KNOEPFE: Readonly<Record<string, KnopfAktion>> = {
  "Telefonat vereinbaren": { art: "weg", weg: "telefon" },
  "Per E-Mail": { art: "weg", weg: "mail" },
  "Hier auf WhatsApp": { art: "weg", weg: "whatsapp" },
  "Ja, gern": { art: "termin_ja" },
  "Später": { art: "spaeter" },
  "Passt": { art: "passt" },
  "Bitte verschieben": { art: "verschieben" },
  "Termin verschieben": { art: "verschieben" },
  "Ja, bitte": { art: "antwort_lesen" },
};
/** Ist das, was er geschickt hat, genau ein Knopf einer Business-Vorlage? Rein. */
export function knopfAktion(text: unknown, knopf?: unknown): KnopfAktion | null {
  for (const roh of [knopf, text]) {
    const t = String(roh ?? "").trim();
    if (t && MB_KNOEPFE[t]) return MB_KNOEPFE[t];
  }
  return null;
}

// ── Der WhatsApp-Link mit Anfrage-Kennung (Lead-Mail, Website) ───────────────
/** Der fertige Satz im WhatsApp-Fenster — mit Kennung weiß Mara sofort, welche Anfrage schreibt. */
export function waGlobalSatz(code: string | null | undefined, sprache: "de" | "en" = "de"): string {
  const c = leadCodeForm(code) ? ` (Anfrage ${code})` : "";
  return sprache === "en"
    ? `Hello, I would like to continue the conversation about FIAON Global here on WhatsApp.${c}`
    : `Guten Tag, ich möchte das Gespräch zu FIAON Global gern hier auf WhatsApp führen.${c}`;
}
/** wa.me-Link zur Mara-Nummer (nur Ziffern, mit Landesvorwahl) mit dem fertigen Satz. null ohne Nummer. Rein. */
export function waGlobalLink(nummer: string | null | undefined, code: string | null | undefined, sprache: "de" | "en" = "de"): string | null {
  const ziffern = String(nummer ?? "").replace(/\D/g, "").replace(/^00/, "");
  if (ziffern.length < 8) return null;
  return `https://wa.me/${ziffern}?text=${encodeURIComponent(waGlobalSatz(code, sprache))}`;
}
/**
 * Ist das genau Maras eigener WhatsApp-Link (wa.me/<Mara-Nummer>?text=<der feste Satz, mit oder ohne Kennung>)? Dann der
 * Satz im Klartext, sonst null. Die Lead-Wand prüft statt der Adresse diesen Satz: „%20“ im Link galt ihr als Prozentzahl,
 * wa.me als fremde Adresse — deshalb ging seit dem 05.11.2026 keine Willkommens-Mail hinaus (Fix 09.11.2026). Rein.
 */
export function eigenerWaSatz(url: unknown, nummer: string | null | undefined): string | null {
  const u = String(url ?? "");
  const m = /^https:\/\/wa\.me\/\d{8,15}\?text=([^\s#&]+)$/.exec(u);
  if (!m) return null;
  let satz: string;
  try { satz = decodeURIComponent(m[1]); } catch { return null; }
  const code = kennungAusText(satz);
  for (const sprache of ["de", "en"] as const) if (waGlobalLink(nummer, code, sprache) === u) return satz;
  return null;
}
/** Die Anfrage-Kennung aus seiner ersten Nachricht („(Anfrage Ab3dEf7hJk)“). Rein. */
export function kennungAusText(text: unknown): string | null {
  const m = new RegExp(`\\((?:Anfrage|enquiry|Enquiry)\\s+([A-Za-z0-9]{${LEAD_CODE_LAENGE}})\\)`).exec(String(text ?? ""));
  return m && leadCodeForm(m[1]) ? m[1] : null;
}
/** Schreibt eine unbekannte Nummer erkennbar zu FIAON Global (Website-Knopf ohne Kennung)? Rein. */
export function istGlobalEinstieg(text: unknown): boolean {
  return /\bFIAON\s+Global\b/i.test(String(text ?? ""));
}

// ── Das Wissen ───────────────────────────────────────────────────────────────
/** Der Einstiegspreis aus dem Katalog (nie fest im Text). */
export function mbAbPreis(): string {
  const preise = GLOBAL_PAKETE.map((p) => globalPreisText(p.key)).filter(Boolean);
  const zahl = (s: string) => Number(s.replace(/[^\d]/g, "")) || Infinity;
  return preise.sort((a, b) => zahl(a) - zahl(b))[0] ?? "";
}

/** Wahre Sätze, die Mara frei verwenden darf (eigene Worte, nie wörtlich abschreiben). */
export const MB_FAKTEN: readonly string[] = [
  "FIAON Global ist die Unternehmensberatung für Unternehmer aus Deutschland, Österreich und der Schweiz, die eine eigene US-Gesellschaft aufbauen.",
  `Der Kern: ${MB_PITCH}. Den genauen Weg legt Herr Schwarzott im Gespräch individuell fest — jedes Unternehmen ist anders.`,
  "Wir übernehmen alles aus einer Hand: Gründung in Delaware, Florida oder Wyoming mit allen staatlichen Gebühren, Registered Agent (die offizielle US-Zustelladresse), US-Geschäftsadresse und US-Telefonnummer im ersten Jahr.",
  "Dazu die EIN (US-Steuernummer der Firma), das Operating Agreement vom Partner-Anwalt, eine Prüfung durch den Partner-Steuerberater vor der Gründung und die erste jährliche US-Meldung durch den US-Steuerberater.",
  "Konto- und Kartenanträge bereiten wir vollständig vor. Ein fester Ansprechpartner begleitet alles bis zur Unterschrift bei der Bank.",
  "Der Kunde muss für die Gründung nicht in die USA reisen; das Team vor Ort übernimmt die Termine dort.",
  "Delaware geht meist am schnellsten (Express in ein bis zwei Werktagen), Wyoming in rund drei Werktagen, Florida dauert länger.",
  "Für den Start braucht es fünf Unterlagen: eine Farbkopie des Passes, einen Adressnachweis, den Handelsregisterauszug bzw. die Gesellschafterliste, drei Namensvorschläge und eine kurze Beschreibung der Tätigkeit.",
  "Das Kapital ist nicht an die USA gebunden — es darf nach Europa fließen und hier arbeiten.",
  "Der Weg zum Kapital wächst Schritt für Schritt: Gesellschaft, Geschäftskonto, erste Firmenkarten, eine eigene US-Bonität, dann größere Rahmen.",
  "Festpreis statt Stundensätzen: alle Partnerhonorare sind enthalten. Wer nur die Gesellschaft braucht, zahlt bei einem reinen Gründungsdienst weniger — das sagen wir auch offen.",
  "Das Erstgespräch mit Herrn Schwarzott dauert rund 30 Minuten, am Telefon, auf Deutsch, kostenlos.",
];

/** Die Grenzen — still eingebaut, nie als Belehrung an den Kunden. */
export const MB_GRENZEN: readonly string[] = [
  "Keine Zahl zu Zinsen, Rahmen, Kreditbetrag oder Laufzeit; keine Zusage, dass er Kapital, eine Karte oder eine Finanzierung bekommt.",
  "Nie „ohne Sicherheiten“ — höchstens „meist ohne hohe Sicherheiten“, und nur als allgemeiner Vergleich mit Europa.",
  "Kein Steuer-Versprechen, kein „Steuern sparen“, kein Steuermodell. Steuern prüft der Partner-Steuerberater vor der Gründung.",
  "Keine Banknamen, keine Partnernamen, keine Anbieter, keine internen Wörter.",
  "Nie „die Bank entscheidet“, „keine Zusage“ oder „wir sind keine Bank“ (Justin, E-468).",
  "Nie das Wort „Beratung“ oder „beraten“ — sag „Gespräch“, „Erstgespräch“, „wir begleiten“, „wir übernehmen“.",
  "Nichts aus der Privat-Welt: keine Kreditkarte für Privatkunden, keine Bonitätsauskunft, kein SCHUFA-Thema, kein Antrag, keine Raten, keine Links auf /antrag, /start, /mein-bereich, /app oder /zahlung.",
  "Preis nur, wenn er fragt: Festpreis ab {{ab}}; welches Paket passt, klärt Herr Schwarzott im Gespräch.",
  "Keine erfundene Eile, kein Druck, kein „nur heute“.",
];

/** Wann Mara an Justin übergibt (Aufgabe + ruhiger Satz an den Kunden). */
export const MB_UEBERGABE: readonly string[] = [
  "Vertrag, Angebot, Rechnung oder Preis über den Einstiegspreis hinaus",
  "Steuer- oder Rechtsfragen zu seinem Einzelfall",
  "Beschwerde, Ärger, Anwalt, Rückzahlung",
  "er will ausdrücklich einen Menschen oder Herrn Schwarzott persönlich",
  "eine fremde Sprache (außer Englisch: dann antwortest du auf Englisch)",
  "eine Firma in der Krise (Insolvenz, Pfändung, Schulden)",
];

/** Kurze Musterdialoge — der Ton, nicht der Wortlaut. */
export const MB_MUSTER: readonly { kunde: string; mara: string }[] = [
  { kunde: "Was kostet das?", mara: "Wir arbeiten zum Festpreis, alle Partnerhonorare sind enthalten — die Pakete beginnen bei {{ab}}. Welches zu Ihnen passt, klärt Herr Schwarzott im Erstgespräch. Soll ich Ihnen dafür eine Zeit eintragen?" },
  { kunde: "Bekomme ich damit sofort einen Kredit?", mara: "Der Weg zum Kapital wird Schritt für Schritt aufgebaut: erst die Gesellschaft und das Geschäftskonto, dann die ersten Firmenkarten und eine eigene US-Bonität, darauf größere Rahmen. Wie schnell das bei Ihnen geht, schaut sich Herr Schwarzott mit Ihnen individuell an." },
  { kunde: "Muss ich dafür in die USA?", mara: "Nein, für die Gründung müssen Sie nicht reisen — unser Team vor Ort übernimmt die Termine dort. Was ist Ihr Vorhaben: eher Kapital für Ihr bestehendes Unternehmen oder Geschäft in den USA?" },
  { kunde: "Spare ich damit Steuern?", mara: "Eine US-Gesellschaft ist kein Steuermodell. Bevor wir gründen, prüft unser Partner-Steuerberater Ihren Fall, damit alles sauber ist. Im Gespräch zeigt Ihnen Herr Schwarzott, welchen Nutzen die Gesellschaft für Ihr Unternehmen hat." },
  { kunde: "Ist das seriös?", mara: "Eine berechtigte Frage. FIAON ist eine eingetragene Gesellschaft, wir arbeiten zum Festpreis mit Vertrag und mit Partner-Anwälten und Steuerberatern. Alle Fakten finden Sie auf fiaon.com/ist-fiaon-serioes — und im Gespräch beantwortet Herr Schwarzott jede Frage persönlich." },
];

/** Der Auftrag an die Schreib-KI. `lage` = was wir über diesen Lead wissen (vom Server). Rein. */
export function businessAuftrag(lage: {
  anrede: string | null; firma: string | null; email?: string | null; antworten: readonly string[]; weg: Gespraechsweg | null;
  termin: string | null; freieZeiten: readonly string[]; link: string | null; ersteAntwort: boolean;
  englisch: boolean; erzaehlt: readonly string[]; anweisung?: string | null;
}): string {
  const ab = mbAbPreis();
  const mit = (s: string) => s.replace(/\{\{ab\}\}/g, ab);
  return [
    lage.anweisung ? `HAUSANWEISUNG VON JUSTIN (gilt vor allem anderen):\n${lage.anweisung}\n` : "",
    `Du bist Mara, ${MB_ROLLE} — für FIAON Global. Du schreibst auf WhatsApp mit einem Unternehmer, der sich für ${MB_PITCH} interessiert.`,
    `Deine Aufgabe: Fragen ehrlich und knapp beantworten, verstehen, was er vorhat, und ihn zum persönlichen Gespräch mit Justin Schwarzott führen — oder das Gespräch hier auf WhatsApp gut weiterführen, wenn er das möchte. Die Beratung selbst macht Herr Schwarzott.`,
    "",
    "STIMME: Sie-Form, immer. Edel, ruhig, menschlich — wie die Assistentin einer exklusiven Unternehmensberatung. Kurze Sätze, 2 bis 4 Sätze je Nachricht, höchstens eine Frage. Keine Emojis, keine Aufzählungszeichen, kein Fett, keine Ausrufezeichen-Ketten. Nie verkäuferisch, nie aufdringlich. Antwort zuerst, dann ein nächster Schritt. Du sprichst von Herrn Schwarzott (er führt das Gespräch und schreibt die E-Mails), nie von „dem Team“. Frag nie nach Angaben, die unten schon stehen.",
    lage.ersteAntwort
      ? `ERSTE ANTWORT IN DIESEM GESPRÄCH: Stell dich in einem kurzen Satz vor: „Ich bin Mara, ${MB_ROLLE}.“ (Pflicht — du bist eine KI und sagst das.)`
      : "Du hast dich schon vorgestellt — nicht wiederholen. Fragt er, ob du ein Mensch bist: ehrlich sagen, dass du eine digitale Assistentin bist.",
    lage.englisch ? "Er schreibt Englisch: antworte in britischem Englisch, gleiche Regeln." : "Antworte auf Deutsch.",
    "",
    "WAS DU WEISST (wahr, in eigenen Worten, nie wörtlich abschreiben):",
    ...MB_FAKTEN.map((f) => `· ${mit(f)}`),
    `· Justins Geschichte (höchstens ein Punkt je Nachricht, nur wenn es passt): ${[...RADAR_VERKAUF.kern, ...RADAR_VERKAUF.extra.slice(0, 2)].join(" · ")}.`,
    "",
    "GRENZEN (still einhalten, nie erklären):",
    ...MB_GRENZEN.map((g) => `· ${mit(g)}`),
    "",
    "AN HERRN SCHWARZOTT ÜBERGEBEN (Feld uebergabe ausfüllen, dem Kunden ruhig sagen, dass Herr Schwarzott sich persönlich meldet — ohne Uhrzeit):",
    ...MB_UEBERGABE.map((u) => `· ${u}`),
    "",
    "WAS WIR ÜBER IHN WISSEN:",
    `· Anrede: ${lage.anrede || "unbekannt (dann ohne Namen)"}${lage.firma ? ` · Firma: ${lage.firma}` : ""}${lage.email ? ` · E-Mail: ${lage.email} (wählt er E-Mail: Herr Schwarzott schreibt ihm dorthin)` : ""}`,
    ...(lage.antworten.length ? [`· Seine Angaben im Formular: ${lage.antworten.join(" · ")}`] : ["· Keine Formular-Angaben."]),
    ...(lage.erzaehlt.length ? [`· Was er selbst erzählt hat: ${lage.erzaehlt.join(" · ")}`] : []),
    `· Gewählter Weg: ${lage.weg ? WEG_TEXT[lage.weg] : "noch keiner"}`,
    lage.termin ? `· Sein Gespräch mit Herrn Schwarzott steht: ${lage.termin}. Keinen zweiten Termin anbieten; nur verschieben, wenn er es will.` : "· Noch kein Gespräch gebucht.",
    "",
    "GESPRÄCH EINTRAGEN:",
    lage.freieZeiten.length
      ? `· Freie Zeiten bei Herrn Schwarzott (deutsche Zeit): ${lage.freieZeiten.join(" · ")}. Biete höchstens zwei, drei davon an. Sagt er klar zu einer dieser Zeiten ja, trag sie ins Feld termin ein (tag JJJJ-MM-TT, zeit HH:MM) und bestätige in einem Satz.`
      : "· Gerade sind keine freien Zeiten eingetragen — biete an, dass Herr Schwarzott sich persönlich meldet (Feld uebergabe).",
    lage.link ? `· Sein persönlicher Link zum Selbst-Wählen: ${lage.link}` : "",
    "",
    "AUSGABE: Nur das JSON-Objekt. antwort = deine WhatsApp-Nachricht. weg = telefon | mail | whatsapp, wenn er sich in DIESER Nachricht klar für einen Weg entschieden hat, sonst null. termin = die Zeit, der er gerade zugestimmt hat, sonst null. uebergabe = ein Satz für Herrn Schwarzott, wenn er übernehmen muss, sonst null. notiz = was er über sich und sein Unternehmen erzählt hat (sachlich, ein Satz), sonst null.",
  ].filter((z) => z !== "").join("\n");
}

/** Das Antwort-Schema (OpenAI strict JSON). */
export const MB_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["antwort", "weg", "termin", "uebergabe", "notiz"],
  properties: {
    antwort: { type: "string" },
    weg: { type: ["string", "null"], enum: ["telefon", "mail", "whatsapp", null] },
    termin: {
      type: ["object", "null"], additionalProperties: false, required: ["tag", "zeit"],
      properties: { tag: { type: "string" }, zeit: { type: "string" } },
    },
    uebergabe: { type: ["string", "null"] },
    notiz: { type: ["string", "null"] },
  },
} as const;

// ── Die Wand: was nie aus Maras Business-Mund kommt ─────────────────────────
const PRIVAT_LINK = /(?:fiaon\.com)?\/(?:antrag|a\/|start\b|mein-bereich|app\b|zahlung|login\b|privat\b)/i;
// „US-Bonität“ (die eigene Kreditwürdigkeit der Firma in den USA) gehört zum Business-Weg — nur die private Bonität ist Privat-Welt.
const PRIVAT_WORT = /\b(?:kreditkarte\w*|visa|(?<!US-)bonit[aä]t\w*|schufa|auskunft\w*|partnerbank|monatsrate\w*|raten?\b|wunschlimit|limit)\b/i;
const ZINSZAHL = /\b\d{1,2}(?:[.,]\d{1,2})?\s?%/;
const ZUSAGE = /\b(?:sie\s+(?:bekommen|erhalten)|garantiert|garantie|sicher\s+zu|auf\s+jeden\s+fall|100\s?%)\b[^.?!]{0,60}\b(?:kredit\w*|kapital|finanzierung\w*|darlehen|rahmen|karte\w*|zusage)?/i;
const OHNE_SICHERHEIT = /(?<!meist\s)(?<!oft\s)\bohne\s+(?:jede\s+)?sicherheit(?:en)?\b/i;
const STEUER_SPAREN = new RegExp(String.raw`steuer\w*\s+(?:zu\s+)?(?:sparen|spar\w+|vermeiden|optimier\w*)|\bspar\w*\s+(?:\p{L}+\s+){0,2}steuer\w*|steuerfrei`, "iu");
const EMOJI = new RegExp("[\\p{Extended_Pictographic}]", "u");
const VORSTELLUNG = /digitale\s+Assistentin|digital\s+assistant/i;

/** Alle Funde der Business-Wand — leer heißt: darf raus (die Hauswand sendePruefung kommt zusätzlich). Rein. */
export function businessWand(text: string, ctx: { ersteAntwort: boolean }): string[] {
  const t = String(text ?? "");
  const f: string[] = [];
  if (!t.trim()) f.push("leere Antwort");
  if (PRIVAT_LINK.test(t)) f.push("Privat-Link (Antrag/Start/Bereich/Zahlung) — Business-Leads bekommen nur Global-Wege.");
  const pw = PRIVAT_WORT.exec(t);
  if (pw) f.push(`Privat-Wort „${pw[0]}“ — gehört nicht in FIAON Global.`);
  const bank = radarBankVorbehalt(t);
  if (bank) f.push(`Bank-Satz „${bank}“ (E-468).`);
  if (ZINSZAHL.test(t)) f.push("Prozentzahl — keine Zins- oder Rahmenzahl.");
  const z = ZUSAGE.exec(t);
  if (z && /kredit|kapital|finanzierung|darlehen|rahmen|karte|zusage|garant|sicher\s+zu|auf\s+jeden\s+fall|100/i.test(z[0])) f.push(`Zusage „${z[0].trim().slice(0, 60)}“ — nie etwas zusagen.`);
  if (OHNE_SICHERHEIT.test(t)) f.push("„ohne Sicherheiten“ — höchstens „meist ohne hohe Sicherheiten“.");
  if (STEUER_SPAREN.test(t)) f.push("Steuer-Versprechen — kein Steuermodell.");
  if (EMOJI.test(t)) f.push("Emoji — Business-Nachrichten ohne Emojis.");
  if (t.length > 900) f.push("zu lang — höchstens vier kurze Sätze.");
  if (ctx.ersteAntwort && !VORSTELLUNG.test(t)) f.push("erste Antwort ohne Vorstellung als digitale Assistentin (KI-Verordnung Art. 50).");
  return f;
}

/** Stellt der Text die Vorstellung voran, wenn sie fehlt (Rückfall nach zwei Versuchen). Rein. */
export function vorstellungVoran(text: string, englisch = false): string {
  if (VORSTELLUNG.test(text)) return text;
  return `${englisch ? "I am Mara, Justin Schwarzott's digital assistant." : `Ich bin Mara, ${MB_ROLLE}.`} ${text}`.trim();
}

// ── Feste Sätze (ohne KI, auch in der KI-Pause) ─────────────────────────────
export function satzWegMail(email: string | null, englisch = false): string {
  if (englisch) return `Of course. Mr Schwarzott will write to you personally${email ? ` at ${email}` : ""}. If a short question comes up in the meantime, I am here for you.`;
  return `Sehr gern. Herr Schwarzott schreibt Ihnen persönlich per E-Mail${email ? ` an ${email}` : ""}. Wenn zwischendurch eine kurze Frage aufkommt, bin ich hier für Sie da.`;
}
export function satzWegWhatsapp(englisch = false): string {
  return englisch
    ? "Of course, let us continue here. Tell me briefly about your plans: what does your company do, and what should the US company do for you?"
    : "Sehr gern, dann bleiben wir hier im Gespräch. Erzählen Sie mir kurz, was Sie vorhaben: Was macht Ihr Unternehmen, und wofür soll die US-Gesellschaft arbeiten?";
}
export function satzTelefon(zeiten: readonly string[], link: string | null, englisch = false): string {
  const z = zeiten.slice(0, 3);
  if (englisch) {
    if (z.length) return `Of course. Mr Schwarzott has time on ${z.join(", ")} (German time). Which suits you best?${link ? ` You can also choose yourself: ${link}` : ""}`;
    return `Of course. Mr Schwarzott will get in touch with you personally to arrange a time.${link ? ` You can also choose a time here: ${link}` : ""}`;
  }
  if (z.length) return `Sehr gern. Herr Schwarzott hat zum Beispiel ${z.length > 1 ? `${z.slice(0, -1).join(", ")} oder ${z[z.length - 1]}` : z[0]} frei. Was passt Ihnen am besten?${link ? ` Oder wählen Sie selbst: ${link}` : ""}`;
  return `Sehr gern. Herr Schwarzott meldet sich persönlich bei Ihnen, um eine Zeit abzustimmen.${link ? ` Oder wählen Sie selbst eine Zeit: ${link}` : ""}`;
}
export function satzSpaeter(englisch = false): string {
  return englisch ? "Of course. I will not get in touch again for now — just write to me whenever it suits you." : "Sehr gern. Ich melde mich vorerst nicht weiter — schreiben Sie mir einfach, wenn es Ihnen passt.";
}
export function satzPasst(termin: string | null, englisch = false): string {
  return englisch ? `Wonderful, then Mr Schwarzott will call you${termin ? ` ${termin}` : ""}.` : `Wunderbar, dann ruft Herr Schwarzott Sie${termin ? ` ${termin}` : " wie vereinbart"} an.`;
}
export function satzGebucht(termin: string, englisch = false): string {
  return englisch
    ? `Done — your call with Mr Schwarzott is booked: ${termin} (German time). He will call you then; you do not need to prepare anything.`
    : `Ist eingetragen: Ihr Gespräch mit Herrn Schwarzott ${termin}. Er ruft Sie zur vereinbarten Zeit an, vorbereiten müssen Sie nichts.`;
}
export function satzUebergabe(englisch = false): string {
  return englisch
    ? "Thank you, I have passed this on to Mr Schwarzott. He will get back to you personally."
    : "Danke, das gebe ich direkt an Herrn Schwarzott weiter. Er meldet sich persönlich bei Ihnen.";
}
