// ═══════════════════════════════════════════════════════════════════════════
// DER AGENT — einordnen, handeln, antworten (02.09.2026, E-094)
//
// ZWEI AUFRUFE JE MAIL:
//   A  Einordnen (billig, schnell): Kategorien, Flags, Fragen, Zusammenfassung.
//      Dazu ein Textriegel im Code, der die Flags überstimmt — am 02.09.
//      ordnete das Modell sieben Kündigungen als „Zahlung" ein, und der
//      Automat schickte Kündigern eine Zahlungsaufforderung.
//   B  Handeln und antworten (bestes Modell, mit Werkzeugen): Der Server legt
//      die Akte und den Gesprächsverlauf VOR der ersten Runde vor, das Modell
//      ruft Werkzeuge auf, schreibt die Antwort und muss jede Tatsache mit
//      einem Beleg auf ein Werkzeugergebnis versehen.
//
// DANACH PRÜFT DER SERVER, nicht das Modell:
//   · Wortwand (verboten / Floskel / ungedeckte Zusage)
//   · Belegpflicht — jede Zahl und jedes Datum im Text muss aus einem
//     Werkzeugergebnis stammen
//   · Pflichtangaben je Lage (Zahlungsseite bei offener Rechnung, Termin in
//     den nächsten sieben Tagen, genau ein nächster Schritt)
//   · Sprache, Anrede, Länge
// Ein Verstoß führt zu EINEM Umformulierungsversuch mit der Trefferliste.
// Danach: Entwurf für einen Menschen, nie stiller Versand.
// ═══════════════════════════════════════════════════════════════════════════

import { KARTE_LINK_SATZ, KARTE_ZEIT_SATZ } from "@shared/fiaon-karten-weg";
import { gedaechtnisText, gedaechtnisMerken, MERKEN_BESCHREIBUNG } from "./fiaon-mara-gedaechtnis";
import { wandPruefen, wandUrteil, type Wandtreffer } from "@shared/fiaon-wortverbote";
import { absoluteUrl } from "../fiaon-base-url";
import {
  AUTO_LAGEN, LEERE_FLAGS, AUSKUNFT_ANTWORT_LAGEN, KEIN_VERKAUF_FLAGS, warnlampen,
  // E-241: ERLAUBTE_SCHRITTE und AUSKUNFT_LAGEN nur noch über diese beiden — dort steht die Ausnahme für B und Leads.
  erlaubteSchritte, auskunftLageErlaubt, lehntAuskunftAb, bezogenAufAuskunftAngebot,
  type Flags, type Kategorie, type Kundenlage, type Beleg, type NaechsterSchritt,
} from "@shared/fiaon-postmeister-typen";
import {
  AUSKUNFT_KOSTENLOS_ANTWORT, AUSKUNFT_NUTZEN_SATZ, AUSKUNFT_NUTZEN_SATZ_KARTE, AUSKUNFT_PREISE_CENTS, euroText, auskunfteienText,
} from "@shared/fiaon-auskunft";
import {
  werkzeugeAlsTools, werkzeugVonName, werkzeugeFuerLage, auskunftBetreuerMelden, akteRef,
  auskunftAntwortArt, antwortAufAuskunftAngebot, kundenTeil,
  type WerkzeugKontext, type WerkzeugErgebnis, type AuskunftAntwort,
} from "./fiaon-postmeister-werkzeuge";
import { akteLesen, vertragsfassung } from "./fiaon-postmeister-dossier";
import { nutzungMerken, kostenHeute } from "./fiaon-postmeister-schema";
import { wissenFakten } from "@shared/fiaon-wissen";

export const MODELL = () => process.env.POSTMEISTER_MODELL || "gpt-5.5";
const MODELL_KLEIN = () => process.env.POSTMEISTER_MODELL_KLEIN || "gpt-5.5";
const SCHLUESSEL = () => process.env.OPENAI_API_KEY || process.env.ASSISTENT_API_KEY || "";
const MAX_RUNDEN = 6;

/**
 * Der Name, mit dem der Agent unterschreibt (04.09.2026, Justin: „Gebe den
 * Agenten einen Namen"). Steht in fiaon_settings unter `postmeister_name`,
 * damit Justin ihn ohne Code ändert. Vorgabe: Mara.
 */
/**
 * Vor- und Nachname der Agentin (04.09.2026, Justin: „Mara braucht einen
 * Nachnamen"). Beides in fiaon_settings: postmeister_name (Vorgabe „Mara"),
 * postmeister_nachname (Vorgabe „Lindner"). Unterschrift und Prompt tragen den
 * vollen Namen; das Netz gegen doppelte Signaturen kennt beide Formen.
 */
export async function agentNamen(): Promise<{ vorname: string; nachname: string; voll: string }> {
  let vorname = "Mara", nachname = "Lindner";
  try {
    const { sqlPool } = await import("./db-pool");
    const rows = (await sqlPool`SELECT key, value FROM fiaon_settings WHERE key IN ('postmeister_name', 'postmeister_nachname')`) as any[];
    for (const r of rows) {
      const v = String(r.value ?? "").trim();
      if (r.key === "postmeister_name" && v) vorname = v;
      if (r.key === "postmeister_nachname") nachname = v; // leer = bewusst ohne Nachnamen
    }
  } catch { /* Vorgaben */ }
  return { vorname, nachname, voll: [vorname, nachname].filter(Boolean).join(" ") };
}
export async function agentName(): Promise<string> {
  return (await agentNamen()).voll;
}
const ZEITGRENZE_MS = 90_000;

/** Der Textriegel. Was hier trifft, gilt — egal was das Modell meint. */
const RIEGEL: { flag: keyof Flags; muster: RegExp }[] = [
  { flag: "kuendigung", muster: /\b(kündig\w*|kuendig\w*|vertrag\s+beenden|abo\s+beenden|storniere?n?\s+sie\s+(meinen|meine))\b/i },
  { flag: "widerruf", muster: /\bwiderruf\w*\b/i },
  { flag: "bestreitet", muster: /\b(nie\s+bestellt|nicht\s+bestellt|nichts\s+bestellt|kenne\s+ich\s+nicht|betrug|abzocke?|unberechtigt|nicht\s+autorisiert|falsche\s+forderung)\b/i },
  { flag: "droht_anwalt", muster: /\b(anwalt|rechtsanwalt|verbraucherzentrale|klage|gericht|anzeige)\b/i },
  { flag: "beschwerde", muster: /\b(beschwer\w+|unverschämt|frechheit|enttäuscht|ärgerlich|inakzeptabel|skandal)\b/i },
  { flag: "stopp", muster: /\b(keine\s+(weiteren\s+)?(e-?mails?|nachrichten|werbung)|stopp|abmelden|austragen|verteiler)\b/i },
  { flag: "zahlung_behauptet", muster: /\b(habe\s+(bereits\s+)?(schon\s+)?(be)?zahlt|überwiesen|zahlung\s+(ist\s+)?raus|geld\s+ist\s+raus)\b/i },
  { flag: "rueckruf_wunsch", muster: /\b(rufen\s+sie\s+(mich)?\s*an|rückruf|telefonisch\s+erreichen|melden\s+sie\s+sich\s+telefonisch)\b/i },
  { flag: "zahlungsunfaehig", muster: /\b(kann\s+(gerade\s+)?nicht\s+zahlen|kein\s+geld|arbeitslos|insolvenz|privatinsolvenz|hartz|bürgergeld|pfänd\w+)\b/i },
];

// ═══════════════════════════════════════════════════════════════════════════
// DER RIEGEL FÜR „ICH HAB KEINE AUSKUNFT" (24.09.2026, E-240)
//
// Am 24.09. gingen 961 Unterlagen-Mails hinaus, 403 davon baten um die
// Bonitätsauskunft („… sonst antworten Sie kurz auf diese E-Mail"). Die
// Antworten sind knapp: „Ich hab keine." (Doris Hösl, 5612), „Nicht vorhanden
// Lg" (5609), „leider liegt mir auch keine vor" (5538). Ohne das Zitat — das
// ohneZitat abschneidet — weiß das Modell nicht, WAS fehlt: Der Betreff „Wir
// brauchen ein Dokument von Ihnen" ist für Ausweis, Kontoauszug und Auskunft
// derselbe. Deshalb zwei Wege:
//   · DIREKT: Der Kunde nennt die Auskunft selbst („habe keine SCHUFA-Auskunft",
//     „die Datenkopie habe ich nicht") — gilt immer.
//   · KONTEXT: eine kurze Verneinung („Ich hab keine.", „nicht vorhanden") als
//     Antwort, wenn wir ihn in den letzten 30 Tagen um die Auskunft gebeten
//     haben (fiaon_mail_log) oder der Betreff sie nennt.
// „Keine Schufa-Einträge" ist KEIN fehlendes Dokument, sondern eine gute
// Nachricht — das Muster schließt Eintrag/Score/Problem/Abfrage aus. Und wer
// „keine Zeit" oder „keine Kontoauszüge" hat, meint nicht die Auskunft.
// ═══════════════════════════════════════════════════════════════════════════
const AUSKUNFT_WORT = String.raw`(?:schufa(?:[\s-]*(?:auskunft|datenkopie|selbstauskunft))?(?![\s-]*(?:eintr|score|problem|prüf|pruef|abfrage|frei|negativ|klausel))|bonitätsauskunft|bonitaetsauskunft|selbstauskunft|datenkopie|auskunft|ksv(?:1870)?(?:[\s-]*auskunft)?|crif(?:[\s-]*auskunft)?)`;
const FUELL = String.raw`(?:leider\s+|noch\s+|auch\s+|gar\s+|überhaupt\s+|momentan\s+|aktuell\s+|derzeit\s+)*`;
const AUSKUNFT_DIREKT: RegExp[] = [
  // „Ich habe (noch) keine SCHUFA-Auskunft", „hab keine Datenkopie"
  new RegExp(String.raw`\b(?:hab|habe|hätte|haben|besitze)\s+(?:ich\s+|wir\s+)?${FUELL}keine?n?\s+(?:aktuelle\s+|gültige\s+|eigene\s+)?${AUSKUNFT_WORT}`, "i"),
  // „Eine SCHUFA-Auskunft habe ich nicht", „Die Datenkopie hab ich noch nicht" — die
  // Verneinung schließt den Satz (sonst: „74 € für die KSV-Prüfung, damit habe ich keine
  // Raten offen" — Fund im Postfach, 3783).
  new RegExp(String.raw`\b${AUSKUNFT_WORT}\b[^.!?\n]{0,40}?\b(?:hab|habe|besitze|haben)\s+(?:ich|wir)\s+${FUELL}(?:nicht|keine?)\s*(?:[.!?,;]|$)`, "i"),
  // „keine Auskunft vorhanden", „keine SCHUFA da"
  new RegExp(String.raw`\bkeine?\s+${AUSKUNFT_WORT}\s+(?:vorhanden|da|zur\s+hand)\b`, "i"),
  // „Die Auskunft liegt mir nicht vor"
  new RegExp(String.raw`\b${AUSKUNFT_WORT}\b[^.!?\n]{0,30}?\b(?:liegt|ist)\s+(?:mir\s+)?${FUELL}(?:nicht|keine?)\s+(?:vor|vorhanden|da)\b`, "i"),
  // „Wie komme ich an eine SCHUFA-Auskunft?", „weiß nicht, wie ich die Auskunft bekomme"
  new RegExp(String.raw`\bwie\s+(?:komme|bekomme|kriege|erhalte)\s+ich\s+(?:an\s+)?(?:die|eine|meine)\s+${AUSKUNFT_WORT}`, "i"),
];
/** Was nach „habe keine" steht und NICHT die Auskunft meint. */
const KEINE_AUSKUNFT_NOMEN = String.raw`(?:zeit|lust|ahnung|geld|arbeit|kontoausz\w*|auszüge|ausweis|pass|reisepass|personalausweis|interesse|mail|e-mail|nachricht\w*|login|zugang|passwort|kraft|nerven|termin\w*|probleme?|schulden|einträge?|karte|negative?\w*|offenen?\w*|schufa[\s-]*(?:eintr|score|problem|negativ)\w*)`;
const AUSKUNFT_KONTEXT: RegExp[] = [
  // „Ich hab keine." / „Habe ich nicht." — aber nicht „habe keine Zeit", nicht „habe nicht bezahlt".
  new RegExp(String.raw`\b(?:hab|habe|hätte|haben|besitze)\s+(?:ich\s+|wir\s+)?${FUELL}(?:keine?n?\b(?!\s+${KEINE_AUSKUNFT_NOMEN}\b)|nicht\s*(?:[.!?,;]|$))`, "i"),
  /\bnicht\s+vorhanden\b/i,
  new RegExp(String.raw`\bliegt\s+(?:mir\s+)?${FUELL}(?:nicht|keine?)\s+vor\b`, "i"),
  /\bkeine?\s+(?:da|vorhanden)\b/i,
  // Ein bloßes „Nein." / „Leider keine." — und sonst höchstens ein Gruß.
  /^\s*(?:nein|nö|leider\s+nein|leider\s+nicht|leider\s+keine?|keine?)\s*[.!,]*\s*(?:(?:lg|mfg|liebe\s+grüße|viele\s+grüße|gruß|grüße|danke)\b[\s\S]{0,60})?$/i,
];

/**
 * Sagt der Kunde, er habe keine Bonitätsauskunft? Rein — für Einordnung und
 * Prüfstand. `angefordert` = wir haben ihn in den letzten 30 Tagen darum gebeten.
 */
export function auskunftFehltErkennen(betreff: string, text: string, angefordert = false): boolean {
  const t = String(text || "");
  if (AUSKUNFT_DIREKT.some((m) => m.test(t))) return true;
  const b = String(betreff || "");
  const betreffAuskunft = /\b(?:bonit\w*|schufa|auskunft|datenkopie|ksv|crif)/i.test(b);
  // Gegenlesen E-240: Die Anforderung zählt nur für eine Antwort auf die
  // Unterlagen-Mail („Wir brauchen ein Dokument …", seit E-240 „Noch fehlende
  // Unterlagen …") oder ohne Betreff — „Habe ich nicht." auf eine
  // Zahlungserinnerung aus denselben 30 Tagen meint etwas anderes.
  const antwortAufUnterlagen = !b.trim() || /\b(?:dokument\w*|unterlage\w*)/i.test(b);
  const kontext = betreffAuskunft || (angefordert && antwortAufUnterlagen);
  // Nur eine KURZE Antwort ist eine Antwort auf unsere Frage — ein langer Brief
  // mit „habe keine" handelt von etwas anderem.
  const kurz = t.replace(/\s+/g, " ").trim();
  return kontext && kurz.length > 0 && kurz.length <= 300 && AUSKUNFT_KONTEXT.some((m) => m.test(kurz));
}

/**
 * Den Riegel auf das Urteil des Modells legen — was hier trifft, gilt (rein,
 * damit der Prüfstand es ohne Modell prüfen kann). Seit E-240 dazu: das
 * Verkaufs-Signal auskunft_fehlt samt Kategorie „auskunft" — und ohne
 * „sonstiges", denn das hielte die Mail beim Menschen fest (menschNoetig),
 * obwohl Mara hier selbst die beste Antwort hat.
 */
export function riegelAnwenden(ein: {
  betreff: string; text: string; kategorien: Kategorie[]; flags: Flags; auskunftAngefordert?: boolean;
}): { kategorien: Kategorie[]; flags: Flags } {
  const flags: Flags = { ...LEERE_FLAGS, ...ein.flags };
  const pruefText = `${ein.betreff}\n${ein.text}`;
  for (const r of RIEGEL) if (r.muster.test(pruefText)) flags[r.flag] = true;
  if (flags.droht_anwalt || flags.widerruf) flags.rechtlich = true;
  // Ohne den Anhang-Hinweis des Laufs — sonst wäre keine Antwort mit Datei mehr „kurz".
  if (auskunftFehltErkennen(ein.betreff, kundeTextOhneAnhang(ein.text), !!ein.auskunftAngefordert)) flags.auskunft_fehlt = true;
  let kategorien = [...ein.kategorien];
  // 25.09.2026 (E-241): Ein „Re:" auf die Angebots-Mail der Auskunft („Ja, gern",
  // „Was kostet das genau?") ist genauso Maras Fall — das Modell ordnete so eine
  // Antwort gern als „sonstiges" ein, und menschNoetig hielt das Ja beim Menschen
  // fest. Nicht bei einem Nein und nicht, wenn eine Warnlampe brennt.
  // Gegenlesen E-241: nur SEIN Text (ohne durchgerutschtes Zitat, wie auskunftAntwortArt),
  // und nur, wenn er sich auf das Angebot bezieht — „Woher haben Sie meine Daten?" oder
  // „Wann kommt meine Karte?" auf die Angebots-Mail bleiben, was das Modell daraus macht.
  const eigenerText = kundenTeil(kundeTextOhneAnhang(ein.text));
  const jaAufAngebot = antwortAufAuskunftAngebot(ein.betreff) && !lehntAuskunftAb(eigenerText)
    && bezogenAufAuskunftAngebot(eigenerText) && !KEIN_VERKAUF_FLAGS.some((f) => flags[f]);
  if (flags.auskunft_fehlt || jaAufAngebot) {
    kategorien = kategorien.filter((k) => k !== "sonstiges");
    if (!kategorien.includes("auskunft")) kategorien.push("auskunft");
  }
  return { kategorien, flags };
}

/**
 * Haben wir diesen Absender in den letzten 30 Tagen um seine Bonitätsauskunft
 * gebeten (Unterlagen-Mail documents_change_request)? Liest nur; ein Fehler
 * heißt „nein" — dann greift nur der direkte Weg.
 */
export async function auskunftZuletztAngefordert(von: string): Promise<boolean> {
  const adresse = String(von || "").toLowerCase().match(/<([^>]+)>/)?.[1]?.trim() ?? String(von || "").toLowerCase().trim();
  if (!adresse.includes("@")) return false;
  try {
    const { sqlPool } = await import("./db-pool");
    const [r] = (await sqlPool`
      SELECT 1 AS ja FROM fiaon_mail_log
       WHERE event = 'documents_change_request' AND created_at > NOW() - INTERVAL '30 days'
         AND LOWER(TRIM(COALESCE(empfaenger, ''))) = ${adresse}
         AND payload::text ~* '(bonit|schufa|ksv|crif|datenkopie)'
       LIMIT 1
    `) as any[];
    return !!r;
  } catch {
    return false;
  }
}

export interface Einordnung {
  kategorien: Kategorie[];
  dringend: boolean;
  sprache: string;
  fragen: string[];
  flags: Flags;
  zusammenfassung: string;
}

export interface AgentErgebnis {
  ok: boolean;
  antwort: string | null;
  antwortHtml: string | null;
  belege: Beleg[];
  naechsterSchritt: NaechsterSchritt | null;
  handlungen: { werkzeug: string; ergebnis: string; ok: boolean }[];
  pruefung: { treffer: Wandtreffer[]; fehlend: string[]; umformuliert: boolean };
  automatischErlaubt: boolean;
  grund: string;
  kostenCents: number;
  /** Was die Werkzeuge geliefert haben — der Lauf braucht daraus die Zahlungsreferenz (Rechnung anhängen). */
  werkzeugDaten?: Record<string, any>;
}

// ── Der Aufruf ────────────────────────────────────────────────────────────

/**
 * Chat-Nachrichten → Eingabe für /v1/responses.
 *
 * Drei Formen müssen übersetzt werden:
 *   · gewöhnliche Nachricht  → bleibt, wie sie ist
 *   · Assistent mit Werkzeugaufrufen → je Aufruf ein eigenes `function_call`
 *   · Werkzeugergebnis (role "tool") → `function_call_output` mit derselben call_id
 * Die call_id ist das Band zwischen Aufruf und Ergebnis; geht sie verloren,
 * weiß das Modell nicht mehr, welche Antwort zu welcher Frage gehört.
 */
function nachChatUmgekehrt(nachrichten: any[]): any[] {
  const raus: any[] = [];
  for (const n of nachrichten) {
    if (!n) continue;
    if (n.role === "tool") {
      raus.push({ type: "function_call_output", call_id: n.tool_call_id, output: String(n.content ?? "") });
      continue;
    }
    if (n.role === "assistant" && Array.isArray(n.tool_calls) && n.tool_calls.length) {
      if (n.content) raus.push({ role: "assistant", content: String(n.content) });
      for (const r of n.tool_calls) {
        raus.push({
          type: "function_call",
          call_id: r.id,
          name: r.function?.name ?? r.name,
          arguments: r.function?.arguments ?? r.arguments ?? "{}",
        });
      }
      continue;
    }
    if (typeof n.content === "string" || Array.isArray(n.content)) {
      raus.push({ role: n.role, content: n.content });
    }
  }
  return raus;
}

/** Werkzeuge: verschachtelt (Chat) → flach (Responses). Beides wird akzeptiert. */
function alsResponsesWerkzeuge(tools: unknown[]): any[] {
  return (tools as any[]).map((t) => {
    if (t?.type === "function" && t.function) {
      return {
        type: "function",
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
        strict: t.function.strict ?? false,
      };
    }
    return t;
  });
}

/**
 * Antwort von /v1/responses → die Chat-Form, die der übrige Code erwartet.
 * Damit bleibt alles hinter dieser Funktion unverändert: Werkzeugrunden,
 * Belegprüfung, Wand. Auch die Zählwerte werden umbenannt, sonst steht in
 * `fiaon_ki_nutzung` nur Null und der Tagesdeckel greift nie.
 */
function alsChatAntwort(roh: any): any {
  const teile: any[] = Array.isArray(roh?.output) ? roh.output : [];
  const tool_calls = teile
    .filter((t) => t?.type === "function_call")
    .map((t) => ({ id: t.call_id, type: "function", function: { name: t.name, arguments: t.arguments ?? "{}" } }));

  // ── NUR DER LETZTE BLOCK (02.09.2026) ──────────────────────────────────
  // Die erste Fassung klebte alle Textblöcke aneinander. Gibt das Modell mehr
  // als einen `message`-Block aus — bei Werkzeugrunden der Normalfall —, wird
  // daraus „{…}{…}", und das Parsen scheiterte mit „Unexpected non-whitespace
  // character after JSON at position 1997". Der LETZTE Block ist die Antwort;
  // die früheren sind Zwischenschritte auf dem Weg dorthin. Dasselbe gilt für
  // `output_text`, das OpenAI aus allen Blöcken zusammensetzt — deshalb steht
  // es hier nur noch als Rückfall.
  const bloecke: string[] = teile
    .filter((t) => t?.type === "message")
    .map((t) => (Array.isArray(t.content) ? t.content : [])
      .filter((c: any) => c?.type === "output_text" && typeof c.text === "string")
      .map((c: any) => c.text)
      .join(""))
    .filter((s: string) => s.trim().length > 0);
  let text = bloecke.length ? bloecke[bloecke.length - 1] : "";
  if (!text && typeof roh?.output_text === "string") text = roh.output_text;

  const u = roh?.usage ?? {};
  return {
    choices: [{
      message: {
        role: "assistant",
        content: text || null,
        ...(tool_calls.length ? { tool_calls } : {}),
      },
    }],
    usage: {
      prompt_tokens: u.input_tokens ?? 0,
      completion_tokens: u.output_tokens ?? 0,
      total_tokens: u.total_tokens ?? (Number(u.input_tokens || 0) + Number(u.output_tokens || 0)),
    },
    _unvollstaendig: roh?.status === "incomplete" ? String(roh?.incomplete_details?.reason ?? "unbekannt") : null,
  };
}

/**
 * Den JSON-Kern einer Modellantwort lesen — und beim Scheitern SAGEN, warum.
 *
 * 02.09.2026: Im ersten Aufhol-Lauf kamen zwei Mails als „Unterminated string
 * in JSON at position 5796" zurück. Das war kein Formatfehler des Modells,
 * sondern eine abgeschnittene Antwort: Bei /v1/responses zählt das Nachdenken
 * gegen dasselbe Token-Budget wie der Text. Wer das nicht weiß, sucht den
 * Fehler im Schema statt in der Obergrenze — deshalb steht der Grund jetzt
 * in der Meldung.
 */
export function antwortLesen(j: any, wofuer: string): any {
  const inhalt = j?.choices?.[0]?.message?.content;
  if (j?._unvollstaendig) {
    throw new Error(
      j._unvollstaendig === "max_output_tokens"
        ? `${wofuer}: Die Antwort wurde abgeschnitten (Token-Grenze erreicht). Grenze erhöhen oder Akte kürzen.`
        : `${wofuer}: Antwort unvollständig (${j._unvollstaendig}).`,
    );
  }
  if (!inhalt || !String(inhalt).trim()) throw new Error(`${wofuer}: Das Modell hat nichts geschrieben.`);
  const roh = String(inhalt).trim();
  try {
    return JSON.parse(roh);
  } catch (e: any) {
    // Sicherheitsnetz: Kommen doch einmal zwei Objekte hintereinander an
    // („{…}{…}"), ist das letzte die endgültige Antwort. Lieber sie nehmen als
    // eine Kundenmail liegen lassen.
    const letzte = roh.lastIndexOf("{");
    if (letzte > 0) {
      try { return JSON.parse(roh.slice(letzte)); } catch { /* dann eben nicht */ }
    }
    throw new Error(`${wofuer}: Antwort war kein gültiges JSON (${String(e?.message || e).slice(0, 80)}).`);
  }
}

export async function kiAufruf(ein: {
  dienst: string; modell: string; nachrichten: any[]; schema?: any; tools?: unknown[];
  aufwand?: "low" | "medium" | "high"; maxTokens?: number;
}): Promise<any> {
  const start = Date.now();
  const schluessel = SCHLUESSEL();
  if (!schluessel) throw new Error("Kein OpenAI-Schlüssel gesetzt (OPENAI_API_KEY).");
  const abbruch = new AbortController();
  const uhr = setTimeout(() => abbruch.abort(), ZEITGRENZE_MS);
  try {
    // ═══════════════════════════════════════════════════════════════════════
    // WARUM /v1/responses UND NICHT /v1/chat/completions (02.09.2026)
    //
    // Der Agent hat vom 02. auf den 02.09. KEINE EINZIGE Antwort erzeugt.
    // In der Akte stand bei jedem Versuch derselbe Satz:
    //
    //   „Function tools with reasoning_effort are not supported for gpt-5.5
    //    in /v1/chat/completions. To use function tools, use /v1/responses
    //    or set reasoning_effort to 'none'."
    //
    // Also: entweder Werkzeuge ODER Denkleistung — auf dem alten Weg nicht
    // beides. Ein Sachbearbeiter, der weder nachdenken noch handeln kann,
    // ist kein Sachbearbeiter. Deshalb der neue Weg, der beides erlaubt.
    //
    // Nach außen bleibt alles wie vorher: Wir nehmen Nachrichten im
    // Chat-Format entgegen und geben `choices[0].message` zurück. Die
    // Übersetzung in beide Richtungen steht hier und NUR hier.
    // ═══════════════════════════════════════════════════════════════════════
    const body: any = {
      model: ein.modell,
      input: nachChatUmgekehrt(ein.nachrichten),
      // ── WARUM DIESE ZAHLEN GROSSZÜGIG SIND (02.09.2026) ────────────────
      // Bei /v1/responses zählt das NACHDENKEN gegen dasselbe Budget wie die
      // Antwort. Mit den alten 2.000–3.000 Token blieb nach dem Denken zu
      // wenig übrig: Die Antwort brach mitten im Satz ab und kam als
      // „Unterminated string in JSON at position 5796" zurück — zweimal im
      // ersten Aufhol-Lauf. Lieber Luft lassen; bezahlt wird, was gebraucht
      // wird, und der Tagesdeckel bremst weiterhin.
      max_output_tokens: ein.maxTokens ?? 8000,
      reasoning: { effort: ein.aufwand ?? "medium" },
    };
    if (ein.schema) body.text = { format: { type: "json_schema", name: "antwort", strict: true, schema: ein.schema } };
    if (ein.tools?.length) { body.tools = alsResponsesWerkzeuge(ein.tools); body.tool_choice = "auto"; }
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${schluessel}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: abbruch.signal,
    });
    const roh: any = await res.json();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(roh?.error ?? roh).slice(0, 200)}`);
    const j = alsChatAntwort(roh);
    await nutzungMerken({ dienst: ein.dienst, modell: ein.modell, usage: j?.usage, dauerMs: Date.now() - start, ok: true });
    return j;
  } catch (e: any) {
    await nutzungMerken({ dienst: ein.dienst, modell: ein.modell, dauerMs: Date.now() - start, ok: false, fehler: String(e?.message || e).slice(0, 200) });
    throw e;
  } finally {
    clearTimeout(uhr);
  }
}

// ── A: Einordnen ──────────────────────────────────────────────────────────

const SCHEMA_A = {
  type: "object", additionalProperties: false,
  properties: {
    kategorien: { type: "array", items: { type: "string" } },
    dringend: { type: "boolean" },
    sprache: { type: "string" },
    fragen: { type: "array", items: { type: "string" } },
    zusammenfassung: { type: "string" },
    flags: {
      type: "object", additionalProperties: false,
      properties: {
        kuendigung: { type: "boolean" }, bestreitet: { type: "boolean" }, widerruf: { type: "boolean" },
        beschwerde: { type: "boolean" }, rechtlich: { type: "boolean" }, stopp: { type: "boolean" },
        zahlung_behauptet: { type: "boolean" }, rueckruf_wunsch: { type: "boolean" },
        droht_anwalt: { type: "boolean" }, zahlungsunfaehig: { type: "boolean" },
        auskunft_fehlt: { type: "boolean" },
      },
      required: ["kuendigung", "bestreitet", "widerruf", "beschwerde", "rechtlich", "stopp", "zahlung_behauptet", "rueckruf_wunsch", "droht_anwalt", "zahlungsunfaehig", "auskunft_fehlt"],
    },
  },
  required: ["kategorien", "dringend", "sprache", "fragen", "zusammenfassung", "flags"],
};

export async function einordnen(mail: { betreff: string; text: string; von: string; alterTage: number }): Promise<Einordnung> {
  // E-240: Haben wir ihn zuletzt um die Auskunft gebeten? Dann ist „Ich hab keine." eine Antwort darauf.
  const auskunftAngefordert = await auskunftZuletztAngefordert(mail.von);
  const system = [
    "Du ordnest eingehende Kundenmails eines deutschen Dienstleisters ein. Du antwortest NICHT, du beschreibst nur.",
    "Kategorien (mehrere möglich): zahlung, zugang_login, termin, unterlagen, status_frage, neuinteresse, vertrieb_komplex, kuendigung, beschwerde, rechtlich, abmeldung, werbung_newsletter, spam, intern, auskunft, sonstiges.",
    "auskunft = der Kunde spricht über seine Bonitätsauskunft (SCHUFA, KSV, CRIF, Datenkopie): hat keine, will eine, weiß nicht, wie er an eine kommt, fragt nach Preis, Lieferung oder Inhalt.",
    "Flag auskunft_fehlt = true, wenn der Kunde sagt, er habe keine Bonitätsauskunft/SCHUFA/Datenkopie oder wisse nicht, wie er an eine kommt — auch knapp als Antwort auf unsere Bitte um die Auskunft („Ich hab keine.“, „nicht vorhanden“). „Keine Einträge“ oder „keine Schulden“ ist NICHT gemeint.",
    "werbung_newsletter = Newsletter, Angebote, Rundschreiben von Firmen an uns. spam = unerbetene Kaltakquise an uns (SEO, Webdesign, Leads, Krypto, Kreditangebote, Massenmails), Phishing, wirre Texte ohne Bezug zu uns. Beides ist KEIN Kunde und bekommt genau eine Kategorie. Ein Mensch, der über sein Anliegen bei FIAON schreibt — auch wütend, auch knapp, auch in schlechtem Deutsch — ist NIE werbung_newsletter oder spam.",
    "fragen: jede Frage des Kunden als eigener kurzer Satz, in seinen Worten. Keine Frage erfinden.",
    "zusammenfassung: ein bis zwei Sätze, was der Kunde will und in welcher Stimmung er ist.",
    "sprache: der ISO-Code der Sprache, in der die Mail geschrieben ist (de, en, …).",
    "dringend: true nur, wenn heute jemand handeln muss.",
  ].join("\n");
  const j = await kiAufruf({
    dienst: "postmeister-einordnen", modell: MODELL_KLEIN(), aufwand: "low", maxTokens: 3000, schema: SCHEMA_A,
    nachrichten: [
      { role: "system", content: system },
      {
        role: "user",
        content: `VON: ${mail.von}\nBETREFF: ${mail.betreff}\nALTER: ${mail.alterTage} Tage\n`
          + (auskunftAngefordert ? "HINWEIS: Wir haben diesen Absender zuletzt per E-Mail um seine Bonitätsauskunft gebeten (die zitierte Mail ist abgeschnitten).\n" : "")
          + `\n${String(mail.text || "").slice(0, 6000)}`,
      },
    ],
  });
  const roh = antwortLesen(j, "Einordnung");

  // Der Riegel gewinnt immer.
  const { kategorien, flags } = riegelAnwenden({
    betreff: mail.betreff, text: mail.text, auskunftAngefordert,
    kategorien: (Array.isArray(roh.kategorien) ? roh.kategorien : ["sonstiges"]) as Kategorie[],
    flags: { ...LEERE_FLAGS, ...(roh.flags ?? {}) },
  });

  return {
    kategorien,
    dringend: !!roh.dringend || flags.droht_anwalt || flags.beschwerde || flags.bestreitet,
    sprache: String(roh.sprache || "de").slice(0, 5),
    fragen: Array.isArray(roh.fragen) ? roh.fragen.slice(0, 8).map(String) : [],
    flags,
    zusammenfassung: String(roh.zusammenfassung || "").slice(0, 500),
  };
}

// ── B: Handeln und antworten ──────────────────────────────────────────────

const SCHEMA_B = {
  type: "object", additionalProperties: false,
  properties: {
    antwort: { type: "string", description: "Die Antwort an den Kunden. Keine Anrede-Zeile, keine Grußformel — die setzt der Server." },
    naechster_schritt: {
      type: "object", additionalProperties: false,
      properties: {
        art: { type: "string" },
        url: { type: ["string", "null"] },
        text: { type: "string" },
      },
      required: ["art", "url", "text"],
    },
    belege: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        properties: { satz: { type: "string" }, werkzeug: { type: "string" }, feld: { type: "string" } },
        required: ["satz", "werkzeug", "feld"],
      },
    },
    fragen_beantwortet: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        properties: { frage: { type: "string" }, beantwortet: { type: "boolean" }, warum: { type: "string" } },
        required: ["frage", "beantwortet", "warum"],
      },
    },
    merken: { type: "array", items: { type: "string" }, description: MERKEN_BESCHREIBUNG },
  },
  required: ["antwort", "naechster_schritt", "belege", "fragen_beantwortet", "merken"],
};

/**
 * Der Name der Sprache, in ihr selbst geschrieben. Eine Anweisung auf
 * „antworte auf English" wirkt schwächer als eine auf die Sprache, die
 * gemeint ist — und der Eigenname ist eindeutiger als ein Kürzel.
 */
function sprachName(code: string): string {
  const k = String(code || "de").slice(0, 2).toLowerCase();
  const namen: Record<string, string> = {
    en: "English", fr: "français", es: "español", it: "italiano", nl: "Nederlands",
    pl: "polski", ro: "română", ru: "русский", tr: "Türkçe", bg: "български",
    hr: "hrvatski", sr: "српски", cs: "čeština", sk: "slovenčina", hu: "magyar",
    pt: "português", el: "ελληνικά", ar: "العربية", uk: "українська", sq: "shqip",
    de: "Deutsch",
  };
  return namen[k] ?? code;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE BONITÄTSAUSKUNFT VERKAUFST DU (24.09.2026, E-240)
//
// Justin: Die Auskunft soll „weggehen wie warme Semmeln". Bis hierher sagte
// der Prompt an drei Stellen das Gegenteil: „selbst angefordert mit unserer
// Anleitung oder über FIAON" (Selbstweg zuerst), „wir holen Ihre
// Bonitätsauskunft" (als wäre sie im Paket), und das Hauswissen „wird im
// Kundenbereich angeboten, sobald das Paket bezahlt ist" — ohne Preis, ohne
// Knopf. Doris Hösl bekam deshalb „Sie können sie in Ihrem Bereich anfordern".
//
// Die Musterantwort unten ist GENAU ihr Fall („Ich hab keine.", Rate 3 offen) —
// mit Platzhalternamen und Beispielwerten, damit das Modell nie einen echten
// Kundennamen in eine fremde Mail trägt. Der Prüfstand hält sie gegen die
// Wortwand und gegen auskunftPruefung (.pruef/pruef-postmeister-auskunft.ts).
// ═══════════════════════════════════════════════════════════════════════════
export const AUSKUNFT_MUSTER_KUNDE = "Ich hab keine.";
export const AUSKUNFT_MUSTER_ANTWORT = [
  "Das ist gar kein Problem, Frau Beispiel — genau das übernehmen wir für Sie. Wir fordern Ihre Datenkopien bei SCHUFA, CRIF und Creditreform Boniversum an, Sie müssen keinen Brief schreiben.",
  "",
  "Danach erklären wir Ihnen jeden Eintrag in klaren Worten und prüfen, ob Speicherfristen abgelaufen sind. Dazu kommen Ihr persönlicher Handlungsplan und fertige Schreiben, die Sie nur noch freigeben. Mit Ihrer Auskunft sehen wir, was die Bank sieht — und richten Ihren Weg zu Karte und Wunschlimit genau danach aus.",
  "",
  "Mit Ihrem Paket gilt für Sie der Kundenpreis von 74 € (einzeln 149 €). Ein Klick auf den Knopf unten genügt: Dort bestätigen Sie den Auftrag und sehen gleich danach Betrag, Bankdaten und Verwendungszweck.",
  "",
  "Offen ist außerdem noch Ihre Rate 3 über 7,99 € mit dem Verwendungszweck FIAON-AB12CD-3; die Rechnung dazu hängt an. Ich freue mich auf Ihre Rückmeldung.",
].join("\n");

/**
 * Der Prompt-Block zur Auskunft — je nach Lage ganz, knapp oder gar nicht.
 * `antwort` (E-241): Die Mail antwortet auf das Angebot („angebot") oder der
 * Kunde fragt selbst („frage") — nur dann verkauft Mara sie auch einem offenen
 * Antrag oder einem Lead.
 */
export function auskunftBlock(lage: Kundenlage, akteAuskunft?: { stufe?: string; land?: string } | null, antwort: AuskunftAntwort = null): string {
  if (lage === "gesperrt" || lage === "fremd" || lage === "unklar" || lage === "bestreitet" || lage === "gekuendigt") {
    return "DIE BONITÄTSAUSKUNFT bietest du diesem Kunden NICHT an. Fragt er selbst danach, antworte sachlich mit dem Hauswissen — ohne Angebot, ohne Knopf.";
  }
  if (!auskunftLageErlaubt(lage, !!antwort)) {
    // E-241: Ein Lead ohne Frage nach der Auskunft — sein Ziel ist der Antrag, nichts sonst.
    if (lage === "interessent") {
      return "DIE BONITÄTSAUSKUNFT sprichst du bei diesem Interessenten nicht von dir aus an — sein Ziel ist der Antrag. Kein Wort zu Auskunft, SCHUFA-Datenkopie oder Kontoauszügen, nach dem er nicht gefragt hat.";
    }
    return "DIE BONITÄTSAUSKUNFT: In dieser Lage (erste Zahlung fehlt noch) bietest du sie nicht mit Knopf an — das Ziel dieser Mail ist die offene Zahlung. Fragt er danach, sag in einem Satz, dass FIAON sie ihm nach der ersten Zahlung zum Kundenpreis besorgt. Die kostenlose Datenkopie nur, wenn er danach fragt.";
  }
  if (akteAuskunft?.stufe === "bezahlt" || akteAuskunft?.stufe === "dokument") {
    return `DIE BONITÄTSAUSKUNFT ${akteAuskunft.stufe === "bezahlt" ? "hat dieser Kunde schon bezahlt" : "liegt für diesen Kunden schon in der Akte"} — du verkaufst sie NICHT noch einmal. Fragt er danach oder schreibt, er habe keine, sag ihm freundlich, wo sie steht, und dass sein Betreuer die Auswertung mit ihm durchgeht.`;
  }
  // ── E-241: OFFENER ANTRAG ODER LEAD, DER ANTWORTET ODER FRAGT ─────────────
  if (AUSKUNFT_ANTWORT_LAGEN.includes(lage)) return auskunftBlockAntwort(lage, akteAuskunft, antwort);
  // Gegenlesen E-240: Bei „Zahlung gemeldet" ist die erste Zahlung noch nicht gebucht —
  // die Bestätigungsseite lässt dann nicht beauftragen (angebotLage, fiaon-auskunft-kauf.ts).
  // Nur eine schon offene Auskunft-Bestellung bekommt ihren Zahlungsweg; sonst gilt
  // dasselbe wie bei „unbezahlt", und der Betreuer erfährt es über die Aufgabe.
  if (lage === "zahlung_gemeldet" && akteAuskunft?.stufe !== "offen") {
    return "DIE BONITÄTSAUSKUNFT: Die erste Zahlung dieses Kunden ist gemeldet, aber noch nicht gebucht — du bietest die Auskunft jetzt nicht mit Knopf an. Schreibt er, er habe keine, oder fragt danach, sag in einem Satz, dass FIAON sie für ihn holt, sobald die erste Zahlung gebucht ist, und dass sich sein Betreuer dazu meldet. Die kostenlose Datenkopie nur, wenn er danach fragt.";
  }
  const p = AUSKUNFT_PREISE_CENTS.privat;
  const stand = akteAuskunft?.stufe ? ` Stand dieses Kunden (Akte, Feld auskunft): „${akteAuskunft.stufe}".` : "";
  const landRoh = String(akteAuskunft?.land ?? "");
  const land: "AT" | "CH" | null = landRoh === "AT" || landRoh === "CH" ? landRoh : null;
  return [
    `DIE BONITÄTSAUSKUNFT VERKAUFST DU. Sie ist ein eigenes Produkt, NICHT im Paket enthalten: ${euroText(p.mitAbo)} für Kunden mit laufendem Paket, ${euroText(p.einzeln)} einzeln. Für Firmenkunden gelten andere Preise. Den Preis für DIESEN Kunden nennt dir auskunft_anbieten (Feld betragText) — nie aus dem Kopf.${stand}`,
    `WANN: Schreibt der Kunde über Auskunft, SCHUFA, KSV, Datenkopie, Bonität, Einträge, Limit oder Karte — sagt er, er habe keine Auskunft (auch knapp: „Ich hab keine.", „nicht vorhanden") — oder zeigt die Akte unter auskunft die Stufe „nichts" und er hat ein gewöhnliches Anliegen: Rufe auskunft_anbieten, BEVOR du schreibst. Liefert es einen Knopf (Feld knopf), ist die Auskunft das Ziel dieser Mail, und der Knopf unten führt dorthin (Schritt auskunft). Das Werkzeug bestellt nichts — beauftragen tut der Kunde selbst auf der Seite hinter dem Knopf. Bei Kündigung, Beschwerde, Bestreiten, „Stopp" oder „kann nicht zahlen" verkaufst du nichts.`,
    `WIE: begeistert, konkret, kurz. (1) Nimm seine Lage auf („Das ist gar kein Problem — genau das übernehmen wir für Sie."). (2) Was er bekommt, aus dem Feld leistung: Wir fordern seine Datenkopien bei den Auskunfteien seines Landes an (Feld auskunfteien, mit seiner Vollmacht — er muss keinen Brief schreiben), erklären jeden Eintrag, prüfen die Speicherfristen, liefern den persönlichen Handlungsplan und fertige Schreiben, die er nur freigibt. (3) Sein Ziel: „${AUSKUNFT_NUTZEN_SATZ}" — nie eine Zusage zu Karte, Limit oder Löschung. (4) Preis (betragText; mit Paket beide Preise nebeneinander, nie „statt") und der Weg aus dem Feld weg: Ist noch nichts beauftragt, bestätigt er hinter dem Knopf den Auftrag und sieht danach Betrag, Bankdaten und Verwendungszweck — schreib dann nie, er habe schon bestellt oder eine Rechnung sei offen. Ist die Auskunft schon beauftragt (stufe offen), führt der Knopf direkt zur Zahlungsseite; dann nennst du Betrag und Verwendungszweck.`,
    `DAS WORT: Nenne die Auskunft so wie das Werkzeug (Feld wort).${land ? ` Dieser Kunde lebt in ${land === "AT" ? "Österreich" : "der Schweiz"} — dort gibt es keine SCHUFA: Das Wort „SCHUFA" schreibst du nicht, die Auskunfteien heißen ${auskunfteienText(land)}.` : ` In Österreich und der Schweiz schreibst du nie „SCHUFA".`}`,
    `DIE KOSTENLOSE DATENKOPIE erwähnst du nicht von dir aus — und verschweigst sie nie, wenn er fragt („Kann ich die nicht kostenlos selbst anfordern?"). Dann ehrlich, sinngemäß: „${AUSKUNFT_KOSTENLOS_ANTWORT}" — und danach der Knopf.`,
    `VERBOTEN: „fordern Sie sie in Ihrem Bereich an", „Sie können sie selbst anfordern", eine Anleitung zum Selbst-Anfordern als Hauptweg; Löschzusagen, „Score verbessern", Fristen mit Zahl, „anwaltlich geprüft".`,
    `IST SCHON ETWAS DA: Meldet auskunft_anbieten verkaufen: false (bezahlt, Zahlung gemeldet oder in der Akte), verkaufst du nichts — sag ihm, wo seine Auskunft steht und dass sein Betreuer die Auswertung mit ihm durchgeht.`,
    `IST EINE RATE OFFEN: Die offene Rate bleibt in DERSELBEN Mail, in EINEM Satz mit Nummer, Betrag und Verwendungszweck aus zahlungslink_bauen — die Rechnung dazu hängt an. Der Knopf unten gehört dann der Auskunft.`,
    `DER BETREUER erfährt vom Angebot automatisch (auskunft_anbieten legt ihm die Aufgabe an) — dafür keine eigene Aufgabe und keine Notiz.`,
    `MUSTER (Beispielwerte; Name, Preis, Rate und Verwendungszweck kommen bei dir aus Akte und Werkzeugen). Die Kundin antwortet auf unsere Bitte um die Auskunft nur: „${AUSKUNFT_MUSTER_KUNDE}" — Rate 3 ist offen. Deine Antwort:`,
    // Gegenlesen E-240: Für Österreich/Schweiz das Muster mit den Auskunfteien des
    // Landes — sonst schreibt das Modell das deutsche Muster samt „SCHUFA" ab.
    land ? AUSKUNFT_MUSTER_ANTWORT.replace(auskunfteienText("DE"), auskunfteienText(land)) : AUSKUNFT_MUSTER_ANTWORT,
  ].join("\n");
}

/**
 * Der Verkaufsblock für einen offenen Antrag oder einen Lead, der auf das
 * Angebot antwortet oder selbst nach der Auskunft fragt (25.09.2026, E-241).
 * Dieselben Wortregeln wie für zahlende Kunden. Anders: der Einzelpreis, die
 * Auskunft ist keine Voraussetzung für Antrag oder Karte, und bei „unbezahlt"
 * bleibt die offene erste Zahlung EIN Satz in derselben Mail (Justin: die
 * Auskunft ist dann das Ziel).
 */
function auskunftBlockAntwort(lage: Kundenlage, akteAuskunft: { stufe?: string; land?: string } | null | undefined, antwort: AuskunftAntwort): string {
  // 25.09.2026 (E-241): Antrag und Lead lesen den Nutzen ohne „Limit" (AUSKUNFT_NUTZEN_SATZ_KARTE, VERBOTENE_WORTE).
  const landRoh = String(akteAuskunft?.land ?? "");
  const land: "AT" | "CH" | null = landRoh === "AT" || landRoh === "CH" ? landRoh : null;
  const stand = akteAuskunft?.stufe ? ` Stand dieses Kunden (Akte, Feld auskunft): „${akteAuskunft.stufe}".` : "";
  const warum = antwort === "angebot" ? "Er antwortet auf unser Angebot der Bonitätsauskunft" : "Er fragt selbst nach seiner Bonitätsauskunft";
  const wer = lage === "unbezahlt" ? "Sein Antrag liegt vor, die erste Zahlung für sein Paket ist noch offen" : "Er hat noch keinen Antrag";
  return [
    // Gegenlesen E-241: nicht fest „149 €" — ein Business-Antrag bekommt die Firmen-Auskunft (wie im Angebot des Takts).
    `DIE BONITÄTSAUSKUNFT VERKAUFST DU IHM JETZT. ${warum} — sie ist seine Frage, keine Hürde. ${wer}; für ihn gilt deshalb der Einzelpreis, nicht der Kundenpreis mit Paket (${euroText(AUSKUNFT_PREISE_CENTS.privat.einzeln)} privat, ${euroText(AUSKUNFT_PREISE_CENTS.firma.einzeln)} für ein Unternehmen). Welcher Betrag für ihn gilt, nennt dir auskunft_anbieten (Feld betragText) — nie aus dem Kopf, und keinen anderen.${stand}`,
    `WANN: Rufe auskunft_anbieten, BEVOR du schreibst (steht es oben als VORAB GEHOLT, ist es schon gelaufen). Liefert es einen Knopf (Feld knopf), ist die Auskunft das Ziel dieser Mail, und der Knopf unten führt dorthin (Schritt auskunft). Das Werkzeug bestellt nichts — beauftragen tut er selbst auf der Seite hinter dem Knopf.`,
    `WIE: begeistert, konkret, kurz. (1) Nimm seine Antwort auf („Sehr gern — genau das übernehmen wir für Sie."). (2) Was er bekommt, aus dem Feld leistung: Wir fordern seine Datenkopien bei den Auskunfteien seines Landes an (Feld auskunfteien, mit seiner Vollmacht — er muss keinen Brief schreiben), erklären jeden Eintrag, prüfen die Speicherfristen, liefern den persönlichen Handlungsplan und fertige Schreiben, die er nur freigibt. (3) Sein Ziel: „${AUSKUNFT_NUTZEN_SATZ_KARTE}" — nie eine Zusage zu Karte, Limit oder Löschung. (4) Preis (betragText, einmalig, kein Abo) und der Weg aus dem Feld weg: Hinter dem Knopf bestätigt er den Auftrag und sieht danach Betrag, Bankdaten und Verwendungszweck — schreib nie, er habe schon bestellt.`,
    `KEINE HÜRDE: Die Auskunft ist ein eigener Auftrag und KEINE Voraussetzung für ${lage === "unbezahlt" ? "sein Paket" : "einen Antrag"} oder die Karte — das stellst du nie anders dar. Kontoauszüge, Ausweis und weitere Unterlagen erwähnst du nicht.`,
    lage === "unbezahlt"
      ? `SEIN PAKET IST NOCH NICHT BEZAHLT: Die erste Zahlung nennst du in EINEM Satz mit Betrag und Verwendungszweck aus zahlungslink_bauen (mit ihr wird sein Account aktiv) — die Rechnung dazu hängt an. Der Knopf unten gehört der Auskunft. Kein zweiter Knopf.`
      : `SEIN ANTRAG liegt für ihn vorbereitet bereit — erwähne ihn höchstens in einem Satz. Der Knopf unten gehört der Auskunft. Kein zweiter Knopf.`,
    `DAS WORT: Nenne die Auskunft so wie das Werkzeug (Feld wort).${land ? ` Dieser Kunde lebt in ${land === "AT" ? "Österreich" : "der Schweiz"} — dort gibt es keine SCHUFA: Das Wort „SCHUFA" schreibst du nicht, die Auskunfteien heißen ${auskunfteienText(land)}.` : ` In Österreich und der Schweiz schreibst du nie „SCHUFA".`}`,
    `DIE KOSTENLOSE DATENKOPIE erwähnst du nicht von dir aus — und verschweigst sie nie, wenn er fragt („Kann ich die nicht kostenlos selbst anfordern?"). Dann ehrlich, sinngemäß: „${AUSKUNFT_KOSTENLOS_ANTWORT}" — und danach der Knopf.`,
    `VERBOTEN: „fordern Sie sie in Ihrem Bereich an", „Sie können sie selbst anfordern", eine Anleitung zum Selbst-Anfordern als Hauptweg; Löschzusagen, „Score verbessern", Fristen mit Zahl, „anwaltlich geprüft".`,
    `IST SCHON ETWAS DA: Meldet auskunft_anbieten verkaufen: false, verkaufst du nichts — sag ihm, wo seine Auskunft steht. Liefert es einen Fehler, nennst du keinen Preis und keinen Link.`,
    `DER BETREUER erfährt vom Angebot automatisch (auskunft_anbieten legt die Aufgabe an) — dafür keine eigene Aufgabe und keine Notiz.`,
  ].join("\n");
}

function systemPrompt(ein: {
  kundenweg?: string | null;
  /** Was Mara sich aus früheren Gesprächen gemerkt hat (fiaon-mara-gedaechtnis.ts). */
  gedaechtnis?: string | null;
  postfach: string; lage: Kundenlage; lageGrund: string; heute: string; akte: any;
  einordnung: Einordnung; vertrag: string; alterTage: number; werkzeuge: string[];
  /** Absolutes Datum des Vertragsschlusses (Bestellung) — für Härte-Stufe und Widerruf. */
  vertragGeschlossenAm?: string | null;
  /** „das für Wien zuständige Bezirksgericht" — je Land des Kunden. */
  gerichtText: string;
  name: string;
  /** Justins eigene Anweisung (Steuerpult) — steht ganz oben und gewinnt im Zweifel. */
  hausanweisung?: string;
  /** E-241: Antwort auf das Angebot der Auskunft oder seine eigene Frage — öffnet den Schritt „auskunft" auch für B und Leads. */
  auskunftAntwort?: AuskunftAntwort;
}): string {
  const schritte = erlaubteSchritte(ein.lage, !!ein.auskunftAntwort).join(", ");
  return [
    ein.hausanweisung || ``,
    `Du heißt ${ein.name} und arbeitest im Kundendienst von FIAON. Kolleginnen und Kollegen nennst du dem Kunden gegenüber so, wie die Werkzeuge sie dir nennen (Herr/Frau Nachname oder voller Name) — nie nur mit Vornamen. Du schreibst aus dem Postfach ${ein.postfach}. Du bist ein Mensch am Schreibtisch, kein Automat: Du hast die Akte gelesen und den ganzen bisherigen Schriftwechsel, bevor du antwortest.`,
    `Wenn der Kunde dich mit Namen anspricht oder auf eine frühere Mail von dir Bezug nimmt, gehst du darauf ein — du erinnerst dich an alles, was in diesem Verlauf steht.`,
    `DU UNTERSCHREIBST NICHT. Kein Name, kein Gruß am Ende — beides hängt der Server an. Dein Text endet mit dem letzten Satz an den Kunden.`,
    `KEINE ADRESSE (URL) IM TEXT. Wenn der Kunde eine Seite braucht, nennst du sie beim Namen („die Zahlungsseite", „Ihren Bereich") — der Knopf darunter trägt die Adresse. Eine URL im Fließtext ist ein Fremdkörper.`,
    `HEUTE ist ${ein.heute}.`,
    ``,
    // 21.09.2026 (Justin): „ein viel besseres Gedächtnis — ALLES bis ins kleinste Detail".
    `DEIN GEDÄCHTNIS ZU DIESEM MENSCHEN (was du dir aus früheren Gesprächen gemerkt hast — nutze es, damit er merkt, dass du ihn kennst):`,
    ein.gedaechtnis || "(noch nichts gemerkt)",
    ``,
    // Am 02.09.2026 beanstandet: „auf englische Mails antwortet er Deutsch".
    // Die Sprachregel stand bis dahin als Nebensatz in einer Aufzählung. Jetzt
    // steht sie oben und allein — sie ist das Erste, was der Leser bemerkt.
    ein.einordnung.sprache && ein.einordnung.sprache.slice(0, 2).toLowerCase() !== "de"
      ? `SPRACHE — DAS WICHTIGSTE ZUERST: Der Kunde hat auf ${sprachName(ein.einordnung.sprache)} geschrieben (${ein.einordnung.sprache}). Du antwortest VOLLSTÄNDIG auf ${sprachName(ein.einordnung.sprache)}. Jeder Satz, jede Zahlenangabe, jede Erklärung. Kein deutsches Wort, auch nicht in Nebensätzen. Schreib so, wie eine Muttersprachlerin im Kundendienst schreiben würde — höflich, in der förmlichen Anredeform dieser Sprache.`
      : `SPRACHE: Der Kunde schreibt Deutsch. Du antwortest auf Deutsch, in der Sie-Form.`,
    ``,
    `LAGE DIESES KUNDEN: ${ein.lage} — ${ein.lageGrund}.`,
    `Erlaubte nächste Schritte in dieser Lage: ${schritte}. Genau EINER davon steht am Ende deiner Antwort.`,
    `VERTRAG: ${ein.vertrag}`,
    ``,
    // ═══════════════════════════════════════════════════════════════════
    // DEIN TON (21.09.2026, Justin): „Alle E-Mails müssen viel freundlicher
    // beantwortet werden und immer mehr anregen zum Kaufen, direkt zu zahlen
    // — es dem Kunden so einfach und smart wie möglich machen." Und zur
    // Karte: „immer was Nettes und Motivierendes."
    // ═══════════════════════════════════════════════════════════════════
    `DEIN TON: herzlich, positiv und motivierend — du freust dich, dass der Kunde schreibt, und willst, dass er ans Ziel kommt. Jede Antwort macht Lust auf den nächsten Schritt: Sag, was er davon hat (sein Account ist aktiv, er bekommt direkt den Link unserer Partnerbank für Konto und Karte, sein persönlicher Betreuer begleitet ihn, sein Wunschlimit ist das Ziel) und wie leicht es jetzt geht (ein Klick auf den Knopf unten, dort stehen Betrag, Bankdaten und QR-Code). Nie belehrend, nie drohend, nie genervt. Schließ mit einem kurzen, warmen, persönlichen Satz („Ich freue mich auf Ihre Rückmeldung", „Einen schönen Abend Ihnen") — ohne Unterschrift.`,
    `SO SCHREIBST DU:`,
    `· Drei bis acht Sätze, förmliche Anrede.`,
    // 02.09.2026, nach den ersten echten Entwürfen: Der Agent schrieb inhaltlich
    // richtig, aber in Schachtelsätzen mit fünf Kommata („keinen konkreten
    // Issuer, keine konkrete Visa- oder Mastercard, kein Institut für einen
    // Kreditrahmen, keine Entscheidung über dessen Höhe …"). Das ist
    // Beamtendeutsch. Ein Mensch, der auf Geld wartet, liest so etwas nicht.
    `· EIN GEDANKE PRO SATZ. Höchstens 20 Wörter. Wenn ein Satz zwei Kommata braucht, mach zwei Sätze daraus.`,
    `· ABSÄTZE: Zwei bis vier Sätze bilden einen Absatz, die Sätze stehen HINTEREINANDER in einer Zeile. Absätze trennst du durch eine LEERZEILE. Nicht jeden Satz auf eine eigene Zeile setzen — das ist eine Liste, kein Brief.`,
    `· NIMM BEZUG: Wenn der Kunde zum zweiten Mal schreibt, zeig, dass du das erste Mal gelesen hast („Sie hatten am Montag gefragt, ob …"). Wiederhole nicht, was du schon gesagt hast — der Kunde hat es gelesen.`,
    `· SEI WARM, NICHT FÖRMLICH: „gern", „natürlich", „das verstehe ich" sind erlaubt. „Wir bitten um Verständnis" und „Sehr geehrte" sind es nicht.`,
    `· Sprich wie am Telefon, nicht wie in einem Bescheid. Keine Aufzählung von Dingen, die du NICHT weißt — sag in EINEM Satz, was offen ist, und wer sich darum kümmert.`,
    `· Keine Fachwörter aus unserem Haus (Issuer, Impressum, Status, Akte, System, Vorgang). Der Kunde kennt sie nicht.`,
    `· Beginne mit dem, was der Kunde will — nie mit einer Eingangsbestätigung.`,
    `· Nenne konkrete Dinge aus der Akte: Paket, Betrag, Datum, Rate, Termin, Name der Betreuerin.`,
    `· Keine Aufzählungszeichen, keine Emojis, keine Betreffzeile, keine Grußformel.`,
    ein.alterTage > 3 ? `· Diese Mail liegt seit ${ein.alterTage} Tagen. Beginne mit einer kurzen, ehrlichen Entschuldigung dafür.` : ``,
    ``,
    `WAS DU NICHT SAGST: nichts garantieren, nicht beraten, nichts empfehlen, keine Fristen zusagen, keine Bankdaten aus dem Gedächtnis, keine internen Statuswörter, nichts versprechen, was du nicht im selben Zug getan hast.`,
    ``,
    // ═══════════════════════════════════════════════════
    // MARA ERLEDIGT SELBST (05.09.2026, Justin, E-135): „Der Agent verweist
    // IMMER auf den Mitarbeiter, der Agent soll ja Arbeit abnehmen statt
    // machen. Alles, was Mara machen kann, macht sie!" Gemessen an sieben
    // Tagen: 276 Antworten, 128 mit Aufgabe an den Betreuer, 115 mit „meldet
    // sich" — darunter Stornos unbezahlter Bestellungen, Kündigungen,
    // Kartenfragen und Zahlungsfragen, die Mara vollständig selbst kann.
    // ═══════════════════════════════════════════════════
    // ═══════════════════════════════════════════════════
    // DEIN ERSTER AUFTRAG IST DIE OFFENE RECHNUNG (08.09.2026, E-167, Justin):
    // „Warum verweist der Agent IMMER auf die Mitarbeiter? Der Agent soll
    // klären, dass der Kunde die offene Rechnung bezahlt — der Kunde hat eine
    // offene Rechnung, sobald er den Antrag unterschreibt, also eigentlich
    // JEDER — und nicht immer mehr Arbeit machen an die anderen!"
    // Gemessen am Postfach 08.09.: Entwürfe mit „zur Prüfung an Herrn X",
    // Mahnstopp und Aufgabe, obwohl die Regeln unten das schon verboten —
    // der Ausstiegs-Block sagte „erste Aufgabe nicht die Rechnung", und die
    // Nachprüfung VERLANGTE eine Aufgabe bei jeder offenen Frage. Beides weg.
    // ═══════════════════════════════════════════════════
    `DEIN ERSTER AUFTRAG: DIE OFFENE RECHNUNG. Jeder Kunde mit unterschriebenem Antrag hat eine offene Rechnung, bis sie bezahlt ist — und solange ist die Zahlung das Thema jeder Antwort, egal, was er fragt. Du beantwortest seine Frage UND nennst in derselben Antwort die offene Rate (Nummer, Betrag, Fälligkeit), die Zahlungsseite (zahlungslink_bauen) und bittest klar darum, sie jetzt zu begleichen. Der Vertrag läuft, bis sie bezahlt ist. Du gibst das Eintreiben NIE an einen Kollegen: keine „Prüfung durch Herrn X“, kein „meldet sich“, keine Aufgabe, damit ein Mensch das Geld holt — das ist deine Arbeit. Einwände (angebliche frühere Kündigung, Widerruf, „nie bestellt“) prüfst du selbst gegen die Akte und den Weg des Kunden: Steht dort nichts davon, sagst du das ruhig, nennst das Vertragsdatum und die offene Rate und bittest um den Nachweis (Sendebeleg, Datum) — bis er vorliegt, bleibt die Rate fällig. Nur ein Widerruf in der 14-Tage-Frist oder eine belegte Zahlung ändern das (Regeln unten).`,
    `HANDELN: Du hast Werkzeuge (${ein.werkzeuge.join(", ")}). Benutze sie, bevor du schreibst. Du ersetzt einen Mitarbeiter — du bist die Sachbearbeiterin, nicht die Telefonzentrale. Was du erledigen kannst, erledigst du in dieser Antwort selbst und abschließend.`,
    `DAS ERLEDIGST DU IMMER SELBST, ohne jemanden einzuschalten: Zahlungsfragen (Zahlungsseite holen; Betrag, Rate, Fälligkeit, Verwendungszweck nennen; Rechnung anhängen, wenn verlangt). Kündigung, Storno, Widerruf, „ich will nicht mehr" (Werkzeug kuendigung_vormerken — es storniert eine unbezahlte Bestellung oder merkt die Kündigung mit der letzten Rate vor; du erklärst dem Kunden das Ergebnis). Fragen zu Karte, Konto, Leistung, Ablauf, Kosten, Fristen (Haus-Wissen und Akte: FIAON gibt keine Karte aus, die Bank entscheidet; welche Etappe der Kunde gerade hat, steht in der Akte). Zugang und Passwort (konto_freischalten; die Passwort-vergessen-Seite nennen). Terminwunsch (terminlink_bauen — der Kunde wählt selbst eine Zeit, der Betreuer sieht die Buchung sofort). Doppelte oder unpassende Mails erklären und die Werbesperre setzen, wenn der Kunde es will. Stand der Unterlagen nennen.`,
    `NUR DANN gibst du eine Aufgabe (aufgabe_an_betreuer): (1) Der Kunde wünscht ausdrücklich einen Rückruf oder ein Gespräch mit seinem Betreuer — dann Aufgabe mit Uhrzeitwunsch (Parameter rueckruf_am als YYYY-MM-DD HH:MM, heute ist ${ein.akte?.heute ?? "unbekannt"}; nennt er keine Uhrzeit, bleibt es leer), und dem Kunden klar sagen, wer sich meldet (Nachname). (2) Der Kunde hat Unterlagen geschickt, die das Haus verarbeiten muss (Ausweis, Kontoauszug, Bescheid) — NICHT eine angebliche frühere Kündigung oder ein „Widerruf“: die prüfst du selbst gegen die Akte (siehe DEIN ERSTER AUFTRAG). (3) Eine Datenänderung, für die du kein Werkzeug hast. (4) Eine Entscheidung über Geld zurück (Widerruf nach Zahlung, Kulanz) — die geht an die Leitung (kollege: "Leitung"), nie an den Betreuer. (5) Ein Zahlungsbeleg oder eine Buchungsfrage („ich habe überwiesen, hier der Beleg") — die geht an die Zahlungsstelle (kollege: "Zahlung"), denn nur sie sieht das Bankbuch; dem Kunden sagst du, dass die Zahlungsstelle den Eingang prüft und verbucht. Nennt der Kunde einen Kollegen mit Namen, geht die Aufgabe an diesen (Parameter kollege).`,
    `NIE: „Herr X meldet sich" als Ersatz für eine Antwort. Wenn du eine Aufgabe gibst, beantwortest du trotzdem JETZT alles, was du beantworten kannst. Nie eine Kündigung, ein Storno, eine Zahlungsfrage oder eine Kartenfrage „zur Prüfung" weitergeben — das prüfst du selbst in der Akte. Wenn ein Mensch nur etwas wissen soll, reicht eine Notiz (notiz_an_betreuer), und der Kunde erfährt davon nichts.`,
    `MAHNSTOPP gibt es für dich nicht (08.09.2026, Justin): Die Zahlungserinnerungen laufen, bis die Zahlung gebucht ist — du hältst sie nie an. Belegt der Kunde eine Zahlung, gibst du den Beleg an die Zahlungsstelle (aufgabe_an_betreuer, kollege "Zahlung") und sagst ihm, dass bis zur Buchung noch eine Erinnerung kommen kann und dann gegenstandslos ist. Alles andere — Ärger, „erst eine Antwort“, „ich zahle nicht“ — ändert an der Forderung nichts; die Antwort gibst du jetzt.`,
    ``,
    `BELEGE: Jede Zahl, jedes Datum, jeder Betrag, jeder Name in deiner Antwort muss aus einem Werkzeugergebnis oder der Akte stammen, und du führst ihn in "belege" auf. Was du nicht belegen kannst, schreibst du nicht.`,
    ``,
    `FRAGEN DES KUNDEN: ${ein.einordnung.fragen.length ? ein.einordnung.fragen.map((f) => `– ${f}`).join("\n") : "keine erkannt"}`,
    `Jede davon beantwortest du oder benennst sie ehrlich als offen (dann muss ein Rückruf oder Termin belegt sein).`,
    ``,
    // ═══════════════════════════════════════════════════════════════════
    // DAS HAUS (04.09.2026) — Beim Neubau des Agenten ging das Hauswissen
    // verloren; der alte Postmeister hatte es. Folge, gemessen an einem echten
    // Entwurf: Ein Kunde fragte nach dem Hauptsitz, und Mara schrieb „Die
    // genaue Anschrift möchte ich Ihnen nicht ungesichert nennen" — weil die
    // Belegpflicht griff und die Anschrift nirgends im Kontext stand. Sie
    // steht im Impressum. Wer sie verweigert, klingt, als hätte er etwas zu
    // verbergen.
    // ═══════════════════════════════════════════════════════════════════
    `DAS HAUS — das darfst du nennen, ohne Beleg aus der Akte (es ist öffentlich):`,
    wissenFakten(),
    ``,
    `BEI WUT UND WIEDERHOLUNG: Ein Kunde, der sich wiederholt, wurde beim ersten Mal nicht verstanden — oder hat es nicht geglaubt. Erkläre es ANDERS, nie vorwurfsvoll. Du spiegelst seinen Ton nicht: Auf „wie oft muss ich es noch sagen" antwortest du NICHT mit „Sie müssen es nicht noch einmal erwähnen". Du erkennst an, was er fühlt („Ich verstehe, dass Sie verärgert sind"), ohne es zu bewerten, und erklärst dann ruhig.`,
    // ══════════════════════════════════════════════════════════════════════
    // WIDERSPRICH DIR NIE (23.09.2026, E-225)
    //
    // Ferat Met, 17:36: „Bekomme ich für 79,99 € den Kredit über 15.000 € gleich
    // ausbezahlt?" 18:41 Mara: „Nein, FIAON vergibt keine Kredite." 18:58
    // dieselbe Mara: „Der gewünschte Betrag ist sofort verfügbar." 19:04 der
    // Kunde: „Ich verstehe jetzt nichts mehr."
    //
    // Ein Widerspruch im selben Verlauf kostet mehr Vertrauen als jede
    // vorsichtige Formulierung. Deshalb steht diese Regel VOR allen anderen.
    // ══════════════════════════════════════════════════════════════════════
    `DU WIDERSPRICHST DIR NIE. Du hast den ganzen Verlauf vor dir. Bevor du eine Tatsache behauptest, sieh nach, was FIAON in diesem Verlauf schon geschrieben hat — und sag nichts Gegenteiliges. Hast du dich vorher geirrt, korrigierst du es AUSDRÜCKLICH und benennst es („Ich habe mich vorhin missverständlich ausgedrückt — richtig ist …"). Nie so tun, als wäre nichts gewesen. Ein Kunde, der zwei gegenteilige Sätze von derselben Absenderin liest, glaubt keinen von beiden mehr.`,

    // ══════════════════════════════════════════════════════════════════════
    // MACH DAS BEZAHLEN LEICHT (23.09.2026, E-225, Justins Punkt)
    //
    // „Warum schickt sie ihm keine Rechnung und die Zahlungsdetails alle mit,
    // dass er sie direkt kopieren und zahlen kann?" Er hat recht: In der Mail,
    // auf die es ankam, stand kein Betrag, keine IBAN, kein Verwendungszweck
    // und kein Link. Ein Kunde, der zahlen will, muss suchen — und sucht nicht.
    // ══════════════════════════════════════════════════════════════════════
    `ZAHLUNGSDATEN GEHÖREN IN DIE MAIL, NICHT HINTER EINEN KLICK. Ist eine Rechnung offen, nennst du in JEDER Antwort: den Betrag, die Fälligkeit, den Verwendungszweck und die IBAN — zum Ablesen und Kopieren, nicht nur als Knopf. Den Knopf zur Zahlungsseite (zahlungslink_bauen) setzt du zusätzlich, und die Rechnung hängst du an (rechnung_anhaengen). Drei Wege zum selben Ziel, weil jeder Mensch einen anderen nimmt. Eine Antwort an einen Kunden mit offener Rechnung OHNE diese Angaben ist unvollständig. (Verkaufst du in derselben Mail die Bonitätsauskunft, gehört der Knopf ihr; Betrag und Verwendungszweck der Rate stehen trotzdem im Text, die Rechnung der Rate hängt an.)`,

    // ══════════════════════════════════════════════════════════════════════
    // DER MANTRA-SATZ (23.09.2026, E-225)
    //
    // Justin: „In jeder Mail ‚wir sind keine Bank, wir wissen nicht, ob Sie was
    // bekommen‘ killt ALLES." Stimmt. Der Satz ist richtig und muss fallen —
    // aber dort, wo jemand nach Geld fragt, und nur dort.
    // ══════════════════════════════════════════════════════════════════════
    // ══════════════════════════════════════════════════════════════════════
    // SO VERKAUFST DU (23.09.2026, E-226)
    //
    // Justin: „Du arbeitest sehr streng nach Theorie, das killt die Conversion.
    // Sie ist Verkäuferin und soll die beste von allen werden. Sie kann den
    // Kunden immer anheizen, mit knappen Sachen wie: Nach der Zahlung =
    // Aktivierung — und dann NICHT schreiben: Limit entscheidet die Bank."
    //
    // Er hat recht, und der Unterschied ist wichtig genug, um ihn zu benennen:
    // Eine WAHRE Aussage darf man nicht im selben Atemzug entwerten. „Zahlung
    // = Aktivierung" stimmt zu hundert Prozent. Wer daran „aber über das Limit
    // entscheidet die Bank" hängt, ohne dass jemand danach gefragt hat, macht
    // aus einer Zusage eine Warnung — und der Kunde hört nur die Warnung.
    //
    // Die Grenze bleibt, wo sie ist: Nichts behaupten, was FIAON nicht halten
    // kann. Innerhalb dieser Grenze ist alles erlaubt, was schnell, knapp und
    // wahr ist. Es gibt genug davon.
    // ══════════════════════════════════════════════════════════════════════
    `SO VERKAUFST DU. Du bist Verkäuferin, keine Sachbearbeiterin. Kurze Sätze, klare Zusagen über das, was FIAON WIRKLICH liefert, und immer der nächste Schritt. Diese Sätze sind wahr und du benutzt sie oft:
· „Zahlung = Aktivierung." Sobald die erste Zahlung gebucht ist, ist sein Account aktiv — sofort, nicht irgendwann.
· „Danach geht direkt der fertige Link unserer Partnerbank an Sie raus."
· „Ihr Betreuer sitzt daneben, Sie machen das nicht allein."
· „Mit der Bonitätsauskunft über FIAON fordern wir Ihre Datenkopien bei den Auskunfteien Ihres Landes an, erklären jeden Eintrag und bereiten die Schreiben vor — Sie geben nur frei." (Die Auskunft ist ein Zusatz mit eigenem Preis — siehe DIE BONITÄTSAUSKUNFT VERKAUFST DU.)
· „Nach der Zusage der Bank ist die Karte in der Regel in 2–5 Werktagen bei Ihnen, und meist nutzen Sie sie schon vorher in der App mit Apple Pay."
ENTWERTE NIE DEINE EIGENE ZUSAGE. Wenn du etwas Wahres und Starkes gesagt hast, hänge KEINEN Einschränkungssatz daran, nach dem niemand gefragt hat. Der Satz über die Bank kommt, wenn der Kunde nach Geld, Auszahlung, Limit oder Zusage fragt — dann sofort, klar und ohne Ausflüchte. Sonst nicht.
GEH MIT DER WELLE. Ist der Kunde ungeduldig („ich brauche das sofort"), nimm das Tempo auf, statt zu bremsen: Sag, was HEUTE noch geht — zahlen, Account aktiv, Link der Partnerbank. Ist er skeptisch, nimm den Einwand ernst, beantworte ihn in einem Satz und führ ihn zurück zum nächsten Schritt. Ist er verärgert, gib ihm zuerst recht, dann die Lösung. Nie ausweichen, nie an einen Kollegen abschieben, nie „ich prüfe das".
EIN ZIEL JE MAIL. Am Ende steht genau eine Handlung, und sie ist leicht: bezahlen (mit Betrag, Verwendungszweck, IBAN und Knopf), die Bonitätsauskunft bestellen (Knopf aus auskunft_anbieten), Unterlagen hochladen oder ein Termin. Nie zwei Knöpfe, nie eine Mail ohne Ziel. Hat auskunft_anbieten einen Knopf geliefert, trägt der Knopf die Auskunft — eine offene Rate steht dann als EIN Satz mit Betrag und Verwendungszweck in derselben Mail (24.09.2026, E-240).`,

    `DER SATZ ÜBER DIE BANK GEHÖRT AN SEINEN PLATZ, NICHT IN JEDE MAIL. „Über Konto, Karte und Rahmen entscheidet die Bank" schreibst du, wenn der Kunde nach Geld, Auszahlung, Limit oder Zusage fragt — dann aber klar und ohne Umschweife. Fragt er etwas anderes, lässt du ihn weg. In jeder Mail wiederholt klingt er wie eine Warnung vor dem eigenen Angebot, und genau so liest ihn der Kunde. Positiv sagen, was FIAON TUT: Account, Startgespräch, Betreuer, Auswertung seiner Unterlagen, der fertige Link der Partnerbank — dafür zahlt er, und das bekommt er. Die Bonitätsauskunft mit Handlungsplan und fertigen Schreiben ist ein Zusatz, den du ihm anbietest (auskunft_anbieten).`,
    // E-240: der Verkaufsblock zur Auskunft — je nach Lage ganz, knapp oder gar nicht.
    auskunftBlock(ein.lage, ein.akte?.auskunft ?? null, ein.auskunftAntwort ?? null),

    // ══════════════════════════════════════════════════════════════════════
    // KÜNDIGUNG MIT OFFENER RECHNUNG (23.09.2026, E-225, Justins Wortlaut)
    // ══════════════════════════════════════════════════════════════════════
    `WILL JEMAND KÜNDIGEN: Du kündigst ihm — aber nicht, solange eine Rechnung offen ist. Dann sagst du es ihm freundlich und gerade heraus, sinngemäß: „Dass Sie kündigen möchten, verstehe ich, und Sie können das auch. Es besteht ein Vertrag, und solange die Rechnung im System offen ist, kann ich die Kündigung nicht abschließen. Begleichen Sie bitte die letzte Rechnung — sobald sie da ist, setze ich die Kündigung um und die Sache ist für Sie erledigt." Dazu Betrag, Fälligkeit, Verwendungszweck, IBAN und Zahlungsseite. Bleibt er nach ZWEI bis DREI solchen Wechseln dabei und zahlt nicht, führst du die Kündigung trotzdem durch (kuendigung_vormerken) — die letzte Rate bleibt fällig, das sagst du dazu. Nie drohen, nie mit Inkasso, Gericht oder Kosten winken. Ein Widerruf innerhalb von 14 Tagen ist etwas anderes und gilt sofort.`,

    `KARTE UND KONTO (seit 21.09.2026, Justin: „viel mehr auf die Kreditkarte gepitcht, immer nett und motivierend"): Die Karte ist das Ziel des Kunden — schreib positiv, warm und ermutigend darüber, nie abwehrend. Der Weg: Sobald die erste Zahlung gebucht ist, ist sein Account aktiviert und er bekommt DIREKT den fertigen Link unserer Partnerbank (DKB) für Konto und Karte; das geht automatisch raus. Die Sätze dazu: „${KARTE_LINK_SATZ}" und „${KARTE_ZEIT_SATZ}" In der Antragszeit lädt er in seinem Bereich Kontoauszüge (6 Monate) und Ausweis/Reisepass hoch; seine Bonitätsauskunft besorgt FIAON für ihn (auskunft_anbieten) — hat er schon eine aktuelle, lädt er sie hoch. Dann folgt unsere Bonitätsanalyse. Fragt er „wann bekomme ich meine Karte?" oder schreibt „bezahle ich nicht": freundlich und motivierend antworten — was er bekommt, wie einfach der nächste Schritt ist, und dass es mit der ersten Zahlung sofort losgeht; ist die Zahlung offen, gehört der Zahlungsweg in die Antwort. Nutze SEINEN Stand aus der Akte (Feld karte): Steht in karte.einladung ein Datum, ist der Link raus — dann sag, wann, und dass er ihn in der Mail „Ihr Link zur Karte ist da" findet (erneut schicken kann sein Betreuer). Über Konto und Karte entscheidet die Bank; FIAON verschickt keine Karte und keine PIN. Nie „ich empfehle", nie „garantiert", nie eine feste Frist.`,
    `WENN DER KUNDE VON „KREDIT" SPRICHT, hat er das Produkt missverstanden — das ist der Kern seines Widerstands, nicht ein Nebensatz. FIAON vergibt keine Kredite und vermittelt keine. Erkläre in zwei Sätzen, was er tatsächlich gebucht hat und wofür die Rate ist. Erst dann sprich über die Zahlung.`,
    // ═══════════════════════════════════════════════════════════════════
    // DAS RETTUNGSGESPRÄCH (04.09.2026, Justin): „Warum führt die KI keine
    // Kommunikation, um den Kunden zu retten? … also dass Handlungen
    // PASSIEREN!" Bis hierher erklärte Mara Fakten (Rate, Fälligkeit,
    // Kündigungsfrist) und bot einen Termin an. Ein Kunde, der aussteigen
    // will, braucht einen Grund zu bleiben — den hat sie ihm nicht gegeben.
    // ═══════════════════════════════════════════════════════════════════
    `WENN DER KUNDE AUSSTEIGEN WILL (kündigen, nicht zahlen, „Vertrag gebrochen", „wozu das alles"), gibst du ihm einen Grund zu bleiben — und schließt mit der offenen Rate. Beides in EINER Antwort, in dieser Reihenfolge:`,
    `  1. Anerkennen, was er sagt — ein Satz, ohne Bewertung.`,
    `  2. Fragen, ob du kurz erklären darfst, worum es eigentlich geht. Dann: Er will danach wieder normal am Kreditsystem teilnehmen — ein Handy finanzieren, einen Vertrag abschließen, ein Konto mit Karte. Genau dafür ist das Programm da: Schritt für Schritt die Bonität aufbauen, bis am Ende die Kreditkarte unserer Kooperationsbank steht. Wer jetzt abbricht, steht in einem Jahr am selben Punkt.`,
    `  3. Die Alternative ehrlich benennen: Angebote mit „Kredit ohne SCHUFA" sind oft unseriös — man zahlt dort Gebühren, und die Bonität bleibt, wie sie ist. (NICHT „Betrug" oder „Fake" schreiben — das ist eine Behauptung über Dritte, die uns Ärger macht.)`,
    `  4. Bitten, es durchzuziehen. Ein echter Satz, kein Verkaufsspruch: „Ziehen Sie es bitte einmal durch — was meinen Sie?"`,
    `  5. DANN die offene Rate konkret: Nummer, Betrag, Fälligkeit, Zahlungsseite — und die klare Bitte, sie jetzt zu begleichen. Der Vertrag läuft, bis sie bezahlt ist; das sagst du freundlich und ohne Umweg über einen Kollegen.`,
    // ═══════════════════════════════════════════════════
    // KÜNDIGUNG MIT OFFENER RECHNUNG — JUSTINS ABLAUF (05.09.2026, E-135):
    // „Okay, bitte die letzte Rechnung anführen, hier die Zahlungsdetails und
    // Rechnung im Anhang und Link am Ende — wenn die Rate eingegangen ist,
    // schicke ich das Kündigungsschreiben. Wenn er »nein, mache ich nicht«
    // schreibt, muss Mara hart werden: Wir haben einen Vertrag, den Sie
    // gezeichnet haben; ohne die Rate können wir nicht kündigen; sonst geht
    // es an das Bezirksgericht, wo der Kunde lebt — ersparen Sie uns beiden
    // den Stress und zahlen Sie." Das Kündigungsschreiben (vertrag_beendet)
    // schickt das Haus automatisch, sobald die letzte Rate verbucht ist.
    // ═══════════════════════════════════════════════════
    `WENN DER KUNDE TROTZDEM KÜNDIGT, respektierst du das und erledigst es selbst: kuendigung_vormerken (Werkzeug). Kein zweiter Rettungsversuch — einmal werben ist Beratung, zweimal ist Bedrängen. Danach, je nach Ergebnis des Werkzeugs:`,
    `  · Storniert (nichts bezahlt): „Ihre Bestellung ist storniert, es bleibt nichts offen." Fertig, Schritt erledigt. Bei einer UNBEZAHLTEN Bestellung zählt JEDE klare Absage als Storno-Wunsch („brauche ich nicht mehr", „kein Interesse", „bitte löschen", „nein danke", „möchte das Angebot nicht") — Werkzeug rufen und bestätigen, NICHT den Kunden bitten, es noch einmal anders zu formulieren.`,
    `  · Alle Raten bezahlt: „Ihr Vertrag ist beendet." Fertig.`,
    `  · OFFENE RATE: „Ihre Kündigung ist vorgemerkt. Offen ist noch Rate N über X € (fällig am D). Die Rechnung hängt an; Bankdaten, QR-Code und Verwendungszweck stehen auf der Zahlungsseite unten. Sobald die Zahlung eingegangen ist, erhalten Sie von uns das Kündigungsschreiben, und der Vertrag ist beendet." Dazu zahlungslink_bauen UND rechnung_anhaengen; Schritt zahlung.`,
    `ERSTES NEIN („bezahle ich nicht", „mache ich nicht") — freundlich und motivierend, NICHT hart (21.09.2026, Justin): Du nimmst es ernst, fragst kurz nach dem Grund und zeigst, was er gewinnt, wenn er die Rate jetzt zahlt — Account aktiv, direkt der Link unserer Partnerbank, die Karte meist schon vor dem Versand mit Apple Pay in der App der Bank. Dann der einfache Weg über den Knopf. Die Härte-Stufe unten gilt erst, wenn er im SELBEN Schriftwechsel schon einmal abgelehnt hat.`,
    `HÄRTE-STUFE — erst beim ZWEITEN ausdrücklichen Nein im Schriftwechsel: wenn der Kunde die offene Rate erneut verweigert („nein, mache ich nicht", „zahle nichts mehr", „wozu") und KEINEN sachlichen Einwand nennt (keine belegte Zahlung, kein Widerruf in der Frist, kein falscher Betrag), dann kein Mahnstopp, keine Aufgabe an den Betreuer. Du schreibst ruhig und bestimmt, in dieser Reihenfolge: (1) „Wir haben einen Vertrag, den Sie am ${ein.vertragGeschlossenAm ?? "[Datum aus der Akte]"} geschlossen haben." (2) „Ohne die offene Rate N über X € können wir den Vertrag nicht beenden — das ist die einzige Bedingung." (3) „Bleibt die Zahlung aus, übergeben wir die Forderung an ${ein.gerichtText} zur Eintreibung. Die Kosten dafür tragen dann Sie." (4) „Ersparen Sie uns beiden diesen Aufwand und begleichen Sie die Rate — der Weg steht unten." Dazu eskalation_vorbereiten, damit die Leitung die Verweigerung sieht. Beim zweiten Nein dasselbe in drei Sätzen, keine Diskussion. Diese Härte gilt NUR bei einem laufenden Vertrag (mindestens eine Rate bezahlt) — eine unbezahlte Bestellung wird einfach storniert.`,
    `WIDERRUF: Liegt der Vertragsschluss (${ein.vertragGeschlossenAm ?? "Datum in der Akte"}) höchstens 14 Tage zurück, gilt der Widerruf: kuendigung_vormerken (unbezahlt → storniert) und, wenn schon gezahlt wurde, Aufgabe an die Leitung (kollege: "Leitung") für die Entscheidung über die Rückzahlung — dem Kunden sagst du, dass die Leitung das entscheidet; du versprichst keine Rückzahlung. Nach 14 Tagen ist ein „Widerruf" eine Kündigung und wird so behandelt.`,
    `Wortverbote gelten weiter: nichts garantieren, keinen Kredit versprechen oder vermitteln, das Wort „Affiliate" nie.`,
    ``,
    `WENN DER KUNDE EINEN VERPASSTEN TERMIN NENNT, sieh in den Terminen der Akte nach. Stimmt es, entschuldige dich konkret (Datum, wer). Stimmt es nicht, sag ruhig, was du in der Akte siehst.`,
    `KEINE TELEFONNUMMERN IM TEXT — weder die des Kunden noch die eines Kollegen. „Daniel ruft Sie an" reicht. Die Nummer kennt der Kunde, und die des Kollegen geht ihn nichts an.`,
    ``,
    `DIE AKTE (Stand, Bestellungen, Raten, Termine):`,
    // 04.09.2026 (E-118): Bis hierher 9.000 Zeichen hart abgeschnitten, mitten
    // im JSON — und die wichtigen Schlüssel (Sperren, Kündigung) standen hinten.
    // Jetzt: die Kernfelder zuerst, Verlauf und Mails kommen als Zeitleiste.
    JSON.stringify(akteKompakt(ein.akte), null, 1).slice(0, 12_000),
    ``,
    `DER GANZE WEG DES KUNDEN (alles, was das Haus über ihn weiß — Mails, Anrufe, Termine, Zahlungen, Notizen, Portal; älteste zuerst). Lies ihn, bevor du antwortest. Was der Kunde behauptet („ihr habt mir die Kündigung bestätigt", „ich habe überwiesen", „nie eine Mail bekommen"), prüfst du HIER — und antwortest mit dem, was da steht, mit Datum. Steht es nicht da, sag das ruhig und gib dem Betreuer die Aufgabe, es zu klären:`,
    ein.kundenweg || "(kein Verlauf bekannt — unbekannter Absender)",
  ].filter(Boolean).join("\n");
}

/**
 * Die Stelle, die eine offene Forderung eintreibt — je Land des Kunden
 * (05.09.2026, E-135). Deutschland: Mahnbescheid über das Amtsgericht;
 * Österreich: Bezirksgericht; Schweiz: Betreibungsamt. Ohne Land bleibt es
 * beim allgemeinen „zuständigen Gericht" — nichts erfinden.
 */
export function gerichtFuer(land?: string | null, ort?: string | null): string {
  const l = String(land || "").trim().toUpperCase();
  const o = String(ort || "").trim();
  const wo = o ? `das für ${o} zuständige` : "das zuständige";
  if (["AT", "ÖSTERREICH", "OESTERREICH", "AUSTRIA"].includes(l)) return `${wo} Bezirksgericht`;
  if (["CH", "SCHWEIZ", "SWITZERLAND"].includes(l)) return `${wo} Betreibungsamt`;
  if (["DE", "DEUTSCHLAND", "GERMANY"].includes(l)) return `${wo} Amtsgericht (gerichtliches Mahnverfahren)`;
  return `${wo} Gericht`;
}

/** Die Akte ohne Verlauf und Mails (die stehen im Kundenweg), Wichtiges zuerst. */
export function akteKompakt(a: any): any {
  if (!a || typeof a !== "object") return a;
  const { verlauf: _v, mails: _m, offeneAufgaben: _o, ...rest } = a;
  return { kundenlage: a.kundenlage, lageGrund: a.lageGrund, sperren: a.sperren, kuendigung: a.kuendigung, vertrag: a.vertrag, karte: a.karte, auskunft: a.auskunft ?? null, ...rest };
}

/**
 * Zahlen und Daten im Text, die einen Beleg brauchen.
 * Das Übersetzerziel des Hauses ist älter als ES2015 — deshalb `match` statt
 * `matchAll` und ein Objekt statt eines Sets (Hausfalle, siehe AGENTS.md).
 */
function belegPflichtig(text: string): string[] {
  const gefunden: Record<string, true> = {};
  const muster = [
    /\b\d{1,3}(?:[.,]\d{2})\s*(?:€|EUR)/gi,
    /\b\d{1,2}\.\d{1,2}\.\d{2,4}\b/g,
    /\bFIAON-?[A-Z0-9]{6}(?:-\d{1,2})?\b/g, // E-230: auch ohne Bindestrich
    /\bRate\s+\d{1,2}\b/gi,
  ];
  for (const m of muster) {
    const treffer = text.match(m);
    if (treffer) for (const t of treffer) gefunden[t.trim()] = true;
  }
  return Object.keys(gefunden);
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE WAND UM DIE AUSKUNFT (24.09.2026, E-240) — rein, damit der Prüfstand sie
// ohne Modell und ohne Datenbank prüft. Ein Prompt ist eine Bitte; das hier
// entscheidet, ob die Antwort rausgeht oder ein zweiter Versuch nötig ist.
// ═══════════════════════════════════════════════════════════════════════════

/** Der Kundentext ohne den Anhang-Hinweis, den der Lauf für das Modell anhängt. */
function kundeTextOhneAnhang(t: string): string {
  return String(t || "").split("\n\n[Der Kunde hat ")[0].trim();
}

/**
 * Muss Mara in diesem Vorgang auskunft_anbieten rufen? 25.09.2026 (E-241): auch,
 * wenn die Mail auf das Angebot antwortet oder der Kunde selbst danach fragt
 * (`antwort`, auskunftAntwortArt) — dann in jeder Lage, in der verkauft werden
 * darf, bei einem offenen Antrag und einem Lead nur so.
 */
export function auskunftPflicht(ein: { flags?: Partial<Flags> | null; lage: Kundenlage; stufe?: string | null; antwort?: AuskunftAntwort }): boolean {
  const anlass = !!ein.flags?.auskunft_fehlt || !!ein.antwort;
  return anlass && auskunftLageErlaubt(ein.lage, !!ein.antwort)
    && (ein.stufe == null || ein.stufe === "nichts" || ein.stufe === "offen")
    && !KEIN_VERKAUF_FLAGS.some((f) => !!ein.flags?.[f]);
}

/**
 * „Sie können sie in Ihrem Bereich anfordern" (Maras Entwurf an Doris Hösl) —
 * der Selbstweg als Hauptweg. Erlaubt nur, wenn der Kunde selbst nach dem
 * kostenlosen Weg fragt (dann gilt AUSKUNFT_KOSTENLOS_ANTWORT).
 */
const SELBSTWEG: RegExp[] = [
  /\b[Ff]ordern Sie (?:sie|die|Ihre)\b[^.!?\n]{0,60}\b(?:selbst|kostenlos|in Ihrem Bereich|online|bei der SCHUFA|direkt)\b/,
  /\bSie\s+(?:können|könnten|sollten|müssten)\s+(?:sie|die|diese|Ihre)\b[^.!?\n]{0,70}\b(?:an)?fordern\b/,
  /\b(?:in Ihrem Bereich|selbst|kostenlos)\s+(?:an)?(?:zu)?fordern\b/i,
  /\bselbst\s+(?:beantragen|bestellen|besorgen|anfragen)\b/i,
  /\b[Bb]eantragen Sie (?:sie|die|Ihre)\b[^.!?\n]{0,60}\b(?:selbst|kostenlos|online|bei der SCHUFA)\b/,
];
export function auskunftSelbstweg(antwort: string, kundeText = ""): boolean {
  if (/\b(kostenlos|gratis|umsonst|selbst|selber|art\.?\s*15|nichts\s+kosten|kostet\s+nichts)\b/i.test(String(kundeText || ""))) return false;
  const saetze = String(antwort || "").split(/[.!?]\s+|\n+/);
  // „… müssen Sie nicht selbst anfordern — das übernehmen wir" ist Verkauf, kein Selbstweg.
  return saetze.some((s) => SELBSTWEG.some((m) => m.test(s))
    && !/\b(?:für Sie|über (?:uns|FIAON)|Knopf|unten)\b/.test(s) && !/\bnicht\s+(?:mehr\s+)?selbst\b/i.test(s));
}

/** Die Prüfung rund um die Auskunft — jede Zeile ist ein Mangel. */
export function auskunftPruefung(ein: {
  text: string; kundeText: string; lage: Kundenlage; flags?: Partial<Flags> | null;
  werkzeugDaten: Record<string, any>; gelaufen: string[];
  /**
   * Alle gerufenen Werkzeuge, auch die abgelehnten (Gegenlesen E-240): Lehnt
   * auskunft_anbieten ab (Vertriebssperre, erste Zahlung fehlt), ist die Pflicht
   * erfüllt — sonst hinge jede solche Mail als „nicht gerufen" im Entwurf fest.
   */
  versucht?: string[];
  akteAuskunft?: { stufe?: string | null; land?: string | null } | null;
  /** E-241: Antwort auf das Angebot oder eigene Frage (auskunftAntwortArt) — dann ist das Werkzeug auch bei B/Lead Pflicht. */
  antwort?: AuskunftAntwort;
}): string[] {
  const fehlend: string[] = [];
  const t = String(ein.text || "");
  const aa = ein.werkzeugDaten.auskunft_anbieten;
  if (auskunftPflicht({ flags: ein.flags, lage: ein.lage, stufe: ein.akteAuskunft?.stufe, antwort: ein.antwort ?? null })
    && !(ein.versucht ?? ein.gelaufen).includes("auskunft_anbieten")) {
    fehlend.push(ein.flags?.auskunft_fehlt
      ? "Der Kunde hat keine Bonitätsauskunft — auskunft_anbieten wurde nicht gerufen"
      : "Der Kunde antwortet auf das Angebot der Auskunft oder fragt danach — auskunft_anbieten wurde nicht gerufen");
  }
  if (auskunftSelbstweg(t, ein.kundeText)) {
    fehlend.push("Die Antwort schickt den Kunden, die Auskunft selbst anzufordern — biete sie über FIAON an (auskunft_anbieten); die kostenlose Datenkopie nur auf seine Frage");
  }
  if (aa?.verkaufen && (aa?.knopf || aa?.zahlungsseite)) {
    const zahl = String(aa.betragText || "").replace(/\s*€\s*$/, "").trim();
    const preis = zahl ? new RegExp(String.raw`\b${zahl.replace(/[.,]/, "[,.]")}(?:[,.]00)?\s*(?:€|euro)`, "i") : null;
    if (preis && !preis.test(t)) fehlend.push(`Preis der Auskunft (${aa.betragText}) fehlt im Text`);
    // Gegenlesen E-240: Der Kauflink bestellt nichts — erst der Klick auf der
    // Bestätigungsseite. „Ihre Auskunft ist bestellt" wäre unwahr.
    if (aa.stufe === "nichts" && /(?:auskunft|\bsie)\b[^.!?\n]{0,60}?\b(?:ist|wurde|haben wir)\s+(?:schon\s+|bereits\s+)?(?:für Sie\s+)?(?:bestellt|beauftragt|angelegt)\b/i.test(t)) {
      fehlend.push("Die Antwort sagt, die Auskunft sei bestellt — bestellt ist erst mit dem Klick auf der Bestätigungsseite");
    }
  }
  if (!ein.gelaufen.includes("auskunft_anbieten")
    && /\b(?:bonitätsauskunft|schufa-auskunft|ksv-auskunft|auskunft)\b/i.test(t) && /\b(?:74|149|199|349)(?:[,.]00)?\s*(?:€|euro)/i.test(t)) {
    fehlend.push("Auskunft mit Preis angeboten, ohne auskunft_anbieten — Preis und Knopf kommen nur aus dem Werkzeug");
  }
  const land = aa?.land ?? ein.akteAuskunft?.land ?? null;
  if ((land === "AT" || land === "CH") && /schufa/i.test(t) && !/schufa/i.test(String(ein.kundeText || ""))) {
    fehlend.push(`„SCHUFA" in einer Mail an einen Kunden in ${land === "AT" ? "Österreich" : "der Schweiz"} — dort heißen die Auskunfteien ${auskunfteienText(land)}`);
  }
  return fehlend;
}

/**
 * Der nächste Schritt (Knopf) — aus dem Vorschlag des Modells und dem, was die
 * Werkzeuge wirklich geliefert haben. Rein; vorher stand das mitten in
 * pruefenUndAbschliessen und war nicht prüfbar.
 */
export function schrittBestimmen(
  roh: any, lage: Kundenlage, werkzeugDaten: Record<string, any>,
  /** E-241: Antwort auf das Angebot oder eigene Frage — dann darf der Knopf auch bei B/Lead die Auskunft sein. */
  auskunftAntwort = false,
): { schritt: NaechsterSchritt | null; storniert: boolean } {
  const schritt: NaechsterSchritt | null = roh?.naechster_schritt
    ? { art: String(roh.naechster_schritt.art) as any, url: roh.naechster_schritt.url ?? null, text: String(roh.naechster_schritt.text || "") }
    : null;
  // E-240: Die Adresse der Auskunft kommt NUR aus auskunft_anbieten — eine vom
  // Modell eingesetzte gilt nicht (sonst stünde ein erfundener Link im Knopf).
  // Gegenlesen E-240: `knopf` (Kauflink oder Zahlungsseite der offenen Bestellung).
  const aa = werkzeugDaten.auskunft_anbieten;
  const auskunftSeite = aa?.verkaufen ? (aa.knopf ?? aa.zahlungsseite ?? null) : null;
  if (schritt && schritt.art === "auskunft" && !auskunftSeite) schritt.url = null;
  // 04.09.2026 (E-119b): Schritte mit bekannter Adresse bekommen sie vom Server —
  // „Zu meinem Bereich" braucht kein Werkzeug. Vorher fiel ein Schritt ohne Adresse
  // still durch (kein Knopf in der Mail) oder galt seit heute als Mangel.
  if (schritt && !schritt.url) {
    const vorgabe: Record<string, string> = { bereich: "/mein-bereich", unterlagen: "/mein-bereich", antrag: "/antrag", angebot: "/antrag" };
    if (vorgabe[String(schritt.art)]) schritt.url = absoluteUrl(vorgabe[String(schritt.art)]);
  }
  // In einer Zahlungslage ist die Zahlungsseite der Knopf — Hausregel, kein
  // Ermessen des Modells. 63 von 157 Entwürfen hingen am 04.09. nur daran,
  // dass das Modell „erledigt" oder „rueckruf" als Schritt wählte, obwohl die
  // Seite vorab geholt war. Der Text darf vom Rückruf handeln; der Knopf zahlt.
  const zahlungsSeite = werkzeugDaten.zahlungslink_bauen?.zahlungsseite;
  // ── NACH EINEM STORNO KEIN ZAHLUNGSKNOPF (05.09.2026, E-135) ──────────
  // Gesehen: „Ihre Bestellung ist storniert, es bleibt nichts offen" — und
  // darunter „Rechnung ansehen und bezahlen". Ist die Bestellung storniert
  // oder der Vertrag beendet, gibt es nichts zu zahlen; der Schritt ist
  // „erledigt", und die Zahlungsseite wird nicht verlangt.
  const storniert = ["storno_unbezahlt", "sofort_beendet", "kulanz_sofort"].includes(String(werkzeugDaten.kuendigung_vormerken?.weg || ""));
  const zahlungsSchritt: NaechsterSchritt | null = !storniert && ["unbezahlt", "zahlung_gemeldet", "rate_ueberfaellig", "gekuendigt"].includes(lage) && zahlungsSeite
    ? { art: "zahlung" as any, url: String(zahlungsSeite), text: "Rechnung ansehen und bezahlen" }
    : null;
  // ── HAT auskunft_anbieten GELIEFERT, IST DIE AUSKUNFT DER KNOPF (E-240) ──
  // Auch in einer Zahlungslage: Die offene Rate steht dann als ein Satz mit
  // Betrag und Verwendungszweck im Text (Prüfung unten), ihre Rechnung hängt an.
  const auskunftSchritt: NaechsterSchritt | null = !storniert && auskunftSeite && erlaubteSchritte(lage, auskunftAntwort).includes("auskunft")
    ? { art: "auskunft", url: String(auskunftSeite), text: "Bonitätsauskunft bestellen" }
    : null;
  const schrittFinal: NaechsterSchritt | null = storniert
    ? (schritt && schritt.art !== "zahlung" && schritt.art !== "auskunft" ? schritt : ({ art: "erledigt" } as NaechsterSchritt))
    : auskunftSchritt
      ?? (zahlungsSchritt && (!schritt || !schritt.url || schritt.art !== "zahlung") ? zahlungsSchritt : schritt);
  return { schritt: schrittFinal, storniert };
}

// ═══════════════════════════════════════════════════════════════════════════
// JEDE MARA-MAIL STEHT IN DER AKTE (24.09.2026, E-240)
//
// Bisher: ein Vermerk beim Eingang (Betreff + Zusammenfassung) und einer nach
// dem AUTOMATISCHEN Versand — ein Entwurf hinterließ nichts, und was Mara tat,
// stand verstreut in einzelnen Werkzeug-Zeilen. Der Betreuer, der den Kunden
// anruft, sah nicht, was besprochen war. Jetzt EIN Vermerk je Antwort, auch je
// Entwurf: was der Kunde schrieb, was Mara antwortete, was sie tat. Ohne
// Bestellung im Vorgang unter der jüngsten der Person (akteRef).
// ═══════════════════════════════════════════════════════════════════════════
export interface MaraVermerk {
  kundeText: string;
  antwort: string | null;
  art: "gesendet" | "entwurf";
  handlungen: { werkzeug: string; ergebnis: string; ok: boolean }[];
  grund?: string | null;
  anhaenge?: string[];
}

export function maraMailVermerkText(ein: MaraVermerk): string {
  const kurz = (s: string, n: number) => {
    const t = String(s || "").replace(/\s+/g, " ").trim();
    return t.length > n ? `${t.slice(0, n - 1)}…` : t;
  };
  const taten = (ein.handlungen || []).filter((h) => h.ok).map((h) => `${h.werkzeug}: ${kurz(h.ergebnis, 90)}`);
  return [
    `Mara (Mail): Kunde schrieb „${kurz(ein.kundeText, 200) || "(ohne Text)"}"`,
    ein.art === "gesendet"
      ? `Mara antwortete${ein.anhaenge?.length ? ` (mit ${ein.anhaenge.join(", ")})` : ""}: „${kurz(ein.antwort ?? "", 320)}"`
      : `Mara entwarf, wartet auf Freigabe${ein.grund ? ` (${kurz(ein.grund, 90)})` : ""}: „${kurz(ein.antwort ?? "", 320)}"`,
    `Handlungen: ${taten.length ? taten.join("; ") : "keine"}`,
  ].join(" — ").slice(0, 1400);
}

/** Den Vermerk schreiben — ohne Person nichts; ein Fehler lässt die Mail nie scheitern. */
export async function maraMailVermerk(ein: MaraVermerk & { personId: number | null; ref: string | null }): Promise<void> {
  try {
    const ref = await akteRef(ein.personId, ein.ref);
    if (!ref) return;
    const { sqlPool } = await import("./db-pool");
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
      VALUES (${ref}, ${ein.personId}, NULL, 'Postmeister', 'system', ${maraMailVermerkText(ein)})
    `;
  } catch (e) {
    console.warn("[POSTMEISTER] Aktenvermerk:", String((e as any)?.message || e).slice(0, 160));
  }
}

export async function antwortErzeugen(ein: {
  postfach: string;
  mail: { betreff: string; text: string; von: string; alterTage: number };
  verlauf: { von: string; am: string; text: string }[];
  einordnung: Einordnung;
  personId: number | null;
  ref: string | null;
  postmeisterId: number | null;
}): Promise<AgentErgebnis> {
  const leer: AgentErgebnis = {
    ok: false, antwort: null, antwortHtml: null, belege: [], naechsterSchritt: null, handlungen: [],
    pruefung: { treffer: [], fehlend: [], umformuliert: false }, automatischErlaubt: false, grund: "", kostenCents: 0,
  };

  // Kostendeckel — die einzige Bremse gegen eine Überraschung auf der Rechnung.
  const deckel = Number(process.env.POSTMEISTER_TAG_EURO || 25);
  const heute = await kostenHeute("postmeister-antwort").catch(() => 0);
  if (heute > deckel) return { ...leer, grund: `Tagesdeckel erreicht (${heute.toFixed(2)} € von ${deckel} €)` };

  const akte = await akteLesen(ein.personId, ein.ref);
  const vertrag = await vertragsfassung(ein.ref);
  const lage = akte.kundenlage;
  const kontext: WerkzeugKontext = {
    personId: ein.personId, ref: ein.ref, postfach: ein.postfach,
    postmeisterId: ein.postmeisterId, kundenlage: lage,
    // E-240: Lampen (kein Verkauf bei Kündigung, Beschwerde …) und Kundentext (für die Betreuer-Aufgabe).
    flags: ein.einordnung.flags, kundeText: kundeTextOhneAnhang(ein.mail.text).slice(0, 600),
    // Integration 25.09.2026 (E-240): „Re:" auf das Angebot — die gemeinsame Bremse lässt Maras Link dann durch.
    betreff: ein.mail.betreff,
  };
  // 25.09.2026 (E-241): Antwortet er auf das Angebot der Auskunft oder fragt er selbst?
  // Nur dann gibt es Werkzeug, Schritt und Verkaufsblock auch bei einem offenen Antrag
  // oder einem Lead — ungefragt dort nie (Justin 24.09.). Der Server rechnet das, nicht das Modell.
  kontext.auskunftAntwort = ein.personId
    ? auskunftAntwortArt({ betreff: ein.mail.betreff, kundeText: kontext.kundeText, flags: ein.einordnung.flags })
    : null;
  const werkzeuge = werkzeugeFuerLage(lage, { auskunftAntwort: !!kontext.auskunftAntwort });
  const tools = werkzeugeAlsTools(lage, { auskunftAntwort: !!kontext.auskunftAntwort });

  // 04.09.2026 (E-118): Der ganze Weg des Kunden — aus zwanzig Quellen, als Zeitleiste.
  const { kundenwegLesen } = await import("./fiaon-kundenweg");
  // 21.09.2026: 20.000 statt 14.000 Zeichen — dazu fasst der Weg gleiche Automatik-Mails zusammen.
  const weg = (ein.personId || ein.ref) ? await kundenwegLesen(ein.personId, ein.ref, { maxZeichen: 20_000 }).catch((e) => { console.warn("[POSTMEISTER] Kundenweg:", String(e).slice(0, 120)); return null; }) : null;
  const gedaechtnis = await gedaechtnisText(ein.personId).catch(() => null);

  const handlungen: AgentErgebnis["handlungen"] = [];
  const werkzeugDaten: Record<string, any> = {};

  // 04.09.2026: In Zahlungslagen die Zahlungsseite VORAB holen. Bis hierher
  // vergaß das Modell den Aufruf in jedem siebten Fall („Zahlungsseite nicht
  // geholt") — und die Umformulierung kann keine Werkzeuge mehr rufen.
  const zahlLagen = ["unbezahlt", "zahlung_gemeldet", "rate_ueberfaellig", "gekuendigt"];
  const vorab: string[] = [];
  if (zahlLagen.includes(lage)) {
    const offeneRate = (akte.raten ?? []).filter((r: any) => r.status === "offen" && r.referenz).sort((a: any, b: any) => Number(a.nr) - Number(b.nr))[0];
    const bestellung = (akte.bestellungen ?? []).find((b: any) => b.ref === ein.ref) ?? (akte.bestellungen ?? [])[0];
    const referenz = offeneRate?.referenz ?? (bestellung && bestellung.status !== "paid" ? bestellung.referenz : null);
    const w = werkzeuge.find((x) => x.name === "zahlungslink_bauen");
    if (referenz && w) {
      const erg: WerkzeugErgebnis = await w.ausfuehren({ referenz }, kontext).catch((e): WerkzeugErgebnis => ({ ok: false, ergebnis: "", fehler: String(e?.message || e) }));
      handlungen.push({ werkzeug: "zahlungslink_bauen", ergebnis: erg.ok ? erg.ergebnis : (erg.fehler || "fehlgeschlagen"), ok: erg.ok });
      if (erg.ok && erg.daten) werkzeugDaten.zahlungslink_bauen = erg.daten;
      vorab.push(erg.ok
        ? `VORAB GEHOLT (zahlungslink_bauen ist gelaufen, nicht noch einmal rufen): ${erg.ergebnis} ${JSON.stringify(erg.daten)}`
        : `HINWEIS: Zahlungsseite für ${referenz} konnte nicht geholt werden (${erg.fehler || "unbekannt"}) — keine Zahlungsaufforderung schreiben, sondern dem Betreuer eine Aufgabe geben.`);
    }
  }

  // ── DIE AUSKUNFT VORAB (24.09.2026, E-240) ───────────────────────────────
  // Sagt der Kunde „Ich hab keine.", holt der Server das Angebot selbst — aus
  // demselben Grund wie die Zahlungsseite oben: Das Modell vergisst Werkzeuge,
  // und die Umformulierung kann keine mehr rufen. Ohne Werkzeug gäbe es keinen
  // echten Knopf, und Mara schriebe wieder „fordern Sie sie in Ihrem Bereich an".
  // E-241: dasselbe, wenn er auf das Angebot antwortet („Ja, gern") oder selbst danach fragt —
  // auch bei einem offenen Antrag oder einem Lead.
  if (auskunftPflicht({ flags: ein.einordnung.flags, lage, stufe: akte.auskunft?.stufe, antwort: kontext.auskunftAntwort })) {
    const w = werkzeuge.find((x) => x.name === "auskunft_anbieten");
    if (w) {
      const anlass = ein.einordnung.flags?.auskunft_fehlt ? "Kunde schreibt, er habe keine Bonitätsauskunft"
        : kontext.auskunftAntwort === "angebot" ? "Kunde antwortet auf das Angebot der Bonitätsauskunft"
        : "Kunde fragt nach der Bonitätsauskunft";
      const erg: WerkzeugErgebnis = await w.ausfuehren({ anlass }, kontext)
        .catch((e): WerkzeugErgebnis => ({ ok: false, ergebnis: "", fehler: String(e?.message || e).slice(0, 200) }));
      handlungen.push({ werkzeug: "auskunft_anbieten", ergebnis: erg.ok ? erg.ergebnis : (erg.fehler || "fehlgeschlagen"), ok: erg.ok });
      if (erg.ok && erg.daten) werkzeugDaten.auskunft_anbieten = erg.daten;
      vorab.push(erg.ok
        ? `VORAB GEHOLT (auskunft_anbieten ist gelaufen, nicht noch einmal rufen): ${erg.ergebnis} ${JSON.stringify(erg.daten)}`
        : `HINWEIS: Die Bonitätsauskunft ließ sich nicht anbieten (${erg.fehler || "unbekannt"}) — nenne keinen Preis und keinen Link dafür.`);
    }
  }
  // Der Betreuer erfährt „hat keine Auskunft" auch dann, wenn Mara hier nicht
  // verkaufen durfte (erste Zahlung fehlt) oder die Auskunft schon bezahlt ist —
  // dann fehlt etwas in der Lieferung. auskunftBetreuerMelden prüft Sperren und Lampen.
  if (ein.einordnung.flags?.auskunft_fehlt && ein.personId && !kontext.auskunftGemeldet) {
    await auskunftBetreuerMelden(kontext, {
      angeboten: false, stufe: (akte.auskunft?.stufe ?? "nichts") as any, anlass: "Kunde schreibt, er habe keine Bonitätsauskunft",
    }).catch((e) => console.error("[POSTMEISTER] Auskunft an Betreuer:", String(e).slice(0, 160)));
  }

  const nachrichten: any[] = [
    { role: "system", content: [systemPrompt({
      hausanweisung: await (await import("./fiaon-mara-anweisung")).anweisungBlock("postfach").catch(() => ""),
      postfach: ein.postfach, lage, lageGrund: akte.lageGrund, heute: akte.heute, akte,
      einordnung: ein.einordnung, vertrag: vertrag.text, alterTage: ein.mail.alterTage,
      vertragGeschlossenAm: akte?.vertrag?.geschlossenAm ?? null,
      gerichtText: gerichtFuer(akte?.vertrag?.land, akte?.vertrag?.ort),
      werkzeuge: werkzeuge.map((w) => w.name),
      name: await agentName(),
      kundenweg: weg?.text ?? null,
      gedaechtnis,
      auskunftAntwort: kontext.auskunftAntwort ?? null,
    }), ...vorab].filter(Boolean).join("\n\n") },
  ];
  if (ein.verlauf.length) {
    nachrichten.push({
      role: "user",
      // 04.09.2026, Justin: „Der Email Agent muss auch immer den gesamten
      // Verlauf kennen." Bis hierher sah er sechs Nachrichten à 900 Zeichen —
      // eine lange Beschwerde war nach dem ersten Drittel abgeschnitten, und
      // beim siebten Wortwechsel fehlte der erste. Jetzt der ganze Verlauf.
      content: `BISHERIGER SCHRIFTWECHSEL (älteste zuerst, ${ein.verlauf.length} Nachrichten):\n${ein.verlauf.map((v) => `[${v.am}] ${v.von}: ${v.text.slice(0, 3000)}`).join("\n\n")}`,
    });
  }
  nachrichten.push({ role: "user", content: `NEUE NACHRICHT\nVon: ${ein.mail.von}\nBetreff: ${ein.mail.betreff}\n\n${String(ein.mail.text).slice(0, 6000)}` });

  let kosten = 0;

  // Werkzeug-Runden
  for (let runde = 0; runde < MAX_RUNDEN; runde++) {
    const j = await kiAufruf({
      dienst: "postmeister-antwort", modell: MODELL(), aufwand: "medium", maxTokens: 9000,
      nachrichten, tools, schema: runde >= MAX_RUNDEN - 1 ? SCHEMA_B : undefined,
    }).catch((e) => ({ fehler: String(e?.message || e) } as any));
    if ((j as any).fehler) return { ...leer, grund: `Modell nicht erreichbar: ${(j as any).fehler}`, handlungen };
    kosten += Number((j as any)?.usage?.total_tokens || 0) / 1000;

    const nachricht = j.choices?.[0]?.message;
    const rufe = nachricht?.tool_calls ?? [];
    if (!rufe.length) {
      nachrichten.push(nachricht);
      // Kein Werkzeug mehr — jetzt die Antwort im Schema anfordern.
      const fertig = await kiAufruf({
        dienst: "postmeister-antwort", modell: MODELL(), aufwand: "medium", maxTokens: 9000, schema: SCHEMA_B,
        nachrichten: [...nachrichten, { role: "user", content: "Schreibe jetzt die Antwort an den Kunden im vorgegebenen Format." }],
      }).catch((e) => ({ fehler: String(e?.message || e) } as any));
      if ((fertig as any).fehler) return { ...leer, grund: `Antwort nicht erzeugt: ${(fertig as any).fehler}`, handlungen };
      const roh = antwortLesen(fertig, "Antwort");
      // 21.09.2026: Was Mara Neues über den Menschen weiß, bleibt — auch wenn die Antwort ein Entwurf wird.
      await gedaechtnisMerken(ein.personId, roh?.merken, "mail").catch((e) => console.warn("[POSTMEISTER] Gedächtnis:", String(e).slice(0, 120)));
      return await pruefenUndAbschliessen(roh, { kundenweg: weg?.text ?? null,
        lage, akte, einordnung: ein.einordnung, handlungen, werkzeugDaten, kosten, kontext, nachrichten,
        kundeText: kundeTextOhneAnhang(ein.mail.text),
      });
    }

    nachrichten.push(nachricht);
    for (const ruf of rufe) {
      const w = werkzeugVonName(ruf.function?.name);
      if (!w) {
        nachrichten.push({ role: "tool", tool_call_id: ruf.id, content: JSON.stringify({ ok: false, fehler: "Unbekanntes Werkzeug." }) });
        continue;
      }
      let p: any = {};
      try { p = JSON.parse(ruf.function?.arguments || "{}"); } catch { /* leere Parameter */ }
      const erg = w.stufe === "bestaetigen"
        ? { ok: false, ergebnis: "", fehler: "Dieses Werkzeug braucht die Freigabe eines Menschen. Schreib die Antwort so, dass ein Kollege sie mit einem Klick auslösen kann." }
        : await w.ausfuehren(p, kontext).catch((e: any) => ({ ok: false, ergebnis: "", fehler: String(e?.message || e).slice(0, 200) }));
      handlungen.push({ werkzeug: w.name, ergebnis: erg.ok ? erg.ergebnis : (erg.fehler ?? "fehlgeschlagen"), ok: !!erg.ok });
      if (erg.ok && (erg as any).daten) werkzeugDaten[w.name] = (erg as any).daten;
      nachrichten.push({ role: "tool", tool_call_id: ruf.id, content: JSON.stringify(erg).slice(0, 2000) });
    }
  }
  return { ...leer, grund: "Zu viele Werkzeugrunden ohne Antwort", handlungen, kostenCents: kosten };
}

/** Die Serverprüfung — hier entscheidet sich, ob eine Antwort rausgehen darf. */
async function pruefenUndAbschliessen(roh: any, k: {
  lage: Kundenlage; akte: any; einordnung: Einordnung; kundenweg?: string | null;
  handlungen: AgentErgebnis["handlungen"]; werkzeugDaten: Record<string, any>;
  kosten: number; kontext: WerkzeugKontext; nachrichten: any[];
  /** Was der Kunde geschrieben hat — für die Auskunft-Prüfung (Selbstweg nur auf seine Frage). */
  kundeText?: string;
}): Promise<AgentErgebnis> {
  let text = String(roh.antwort || "").trim();
  // 02.09.2026: Im Entwurf an Herrn Munk endete der Brief mit dem Wort
  // „erledigt." — das ist der interne Zustand `naechster_schritt.art`, den das
  // Modell aus dem Schema mit in den Text genommen hat. Ein Kunde liest dort
  // ein sinnloses Einzelwort. Ein Statuswort am Ende, allein auf einer Zeile
  // oder als letzter „Satz", wird abgeschnitten.
  text = text.replace(
    /(?:^|\n)\s*(erledigt|zahlung|termin|bereich|unterlagen|antrag|angebot|auskunft|startgespraech|startgespräch|rueckruf|rückruf|keiner|nichts)\s*\.?\s*$/i,
    "",
  ).trim();
  // Der Knopf — seit E-240 in schrittBestimmen (rein, im Prüfstand geprüft).
  // E-241: Antwortet er auf das Angebot oder fragt selbst, darf der Knopf auch bei B/Lead die Auskunft sein.
  const auskunftAntwort = k.kontext.auskunftAntwort ?? null;
  const { schritt: schrittFinal, storniert } = schrittBestimmen(roh, k.lage, k.werkzeugDaten, !!auskunftAntwort);
  const zahlLage = ["unbezahlt", "zahlung_gemeldet", "rate_ueberfaellig", "gekuendigt"].includes(k.lage);
  // ── DIE RECHNUNG DER RATE GEHT MIT (24.09.2026, E-240) ──────────────────
  // Trägt der Knopf die Auskunft, hängt der Lauf die Rechnung der offenen Rate
  // nicht mehr von selbst an (er liest sie aus einem Zahlungs-Knopf). Die Rate
  // bleibt aber Teil derselben Mail — also hängt der Server sie hier an.
  const rateRef = k.werkzeugDaten.zahlungslink_bauen?.verwendungszweck;
  if (schrittFinal?.art === "auskunft" && zahlLage && rateRef && !k.handlungen.some((h) => h.ok && h.werkzeug === "rechnung_anhaengen")) {
    const w = werkzeugVonName("rechnung_anhaengen");
    const erg: WerkzeugErgebnis | null = w ? await w.ausfuehren({ referenz: rateRef }, k.kontext).catch(() => null) : null;
    if (erg?.ok) k.handlungen.push({ werkzeug: "rechnung_anhaengen", ergebnis: erg.ergebnis, ok: true });
  }
  const belege: Beleg[] = Array.isArray(roh.belege) ? roh.belege : [];
  const gelaufen = k.handlungen.filter((h) => h.ok).map((h) => h.werkzeug);

  const pruefen = (t: string) => {
    // „Ihre Kündigung ist seit dem 04.09. vorgemerkt" ist eine Tatsache aus der
    // Akte, keine Zusage — die Wand darf sie nicht als ungedeckt werten (05.09.2026).
    const treffer = wandPruefen(t, gelaufen).filter((tr) => !(k.akte?.kuendigung && tr.gedecktDurch?.includes("kuendigung_vormerken")));
    const fehlend: string[] = [];
    // Belegpflicht
    const belegte = belege.map((b) => `${b.satz} ${b.feld}`).join(" ").toLowerCase();
    // Hauswissen (Impressum, Preise, Ablauf) ist belegfähig — es ist öffentlich.
    const werte = JSON.stringify(k.werkzeugDaten).toLowerCase() + JSON.stringify(k.akte).toLowerCase() + wissenFakten().toLowerCase() + String(k.kundenweg || "").toLowerCase();
    for (const z of belegPflichtig(t)) {
      const nackt = z.replace(/[€\s]/g, "").replace(",", ".").toLowerCase();
      if (!werte.includes(nackt) && !belegte.includes(z.toLowerCase())) fehlend.push(`ohne Beleg: ${z}`);
    }
    // Pflichtangaben je Lage
    if (!storniert && ["unbezahlt", "zahlung_gemeldet", "rate_ueberfaellig", "gekuendigt"].includes(k.lage)) {
      const seite = k.werkzeugDaten.zahlungslink_bauen?.zahlungsseite;
      // 04.09.2026: Der Knopf unter dem Text trägt die Adresse (antwortBauen),
      // kernBereinigen nimmt sie aus dem Text sogar heraus. Die Prüfung verlangte
      // sie trotzdem im Modelltext — Hauptgrund für „Entwurf" bei sauberen
      // Antworten (2427 Jusic: alles richtig, Knopf da, trotzdem Entwurf).
      // Es zählt: Zahlungsseite geholt UND als nächster Schritt gesetzt.
      if (!seite) fehlend.push("Zahlungsseite nicht geholt (zahlungslink_bauen fehlt)");
      else if (schrittFinal?.art === "auskunft") {
        // E-240: Der Knopf gehört der Auskunft — dann muss die offene Rate als
        // Satz im Text stehen: Verwendungszweck und Betrag (Justin: „die offene
        // Rate bleibt EIN Satz in derselben Mail").
        const vz = String(k.werkzeugDaten.zahlungslink_bauen?.verwendungszweck || "");
        const betrag = String(k.werkzeugDaten.zahlungslink_bauen?.betrag || "");
        if (vz && !t.toUpperCase().includes(vz.toUpperCase())) fehlend.push(`offene Rate fehlt im Text (Verwendungszweck ${vz})`);
        if (betrag && !t.includes(betrag) && !t.includes(betrag.replace(".", ","))) fehlend.push(`offene Rate fehlt im Text (Betrag ${betrag.replace(".", ",")} €)`);
      }
      else if (!t.includes(String(seite)) && String(schrittFinal?.url || "") !== String(seite)) fehlend.push("Zahlungsseite weder im Text noch als Knopf");
    }
    // E-240: Auskunft — Pflicht zum Werkzeug, kein Selbstweg, Preis im Text, kein „SCHUFA" in AT/CH.
    fehlend.push(...auskunftPruefung({
      text: t, kundeText: k.kundeText ?? "", lage: k.lage, flags: k.einordnung.flags,
      werkzeugDaten: k.werkzeugDaten, gelaufen, akteAuskunft: k.akte?.auskunft ?? null,
      versucht: k.handlungen.map((h) => h.werkzeug), antwort: auskunftAntwort,
    }));
    // Termin in den nächsten sieben Tagen muss vorkommen
    const naher = (k.akte.termine ?? []).find((tm: any) => /heute|morgen|in \d+ Tagen/.test(tm.beginn) && tm.status === "gebucht");
    if (naher && !/termin|gespräch|uhr/i.test(t)) fehlend.push("gebuchter Termin nicht erwähnt");
    // Genau ein nächster Schritt, und seine Adresse muss im Text stehen
    if (!schrittFinal) fehlend.push("kein nächster Schritt");
    else {
      if (!erlaubteSchritte(k.lage, !!auskunftAntwort).includes(schrittFinal.art)) fehlend.push(`Schritt „${schrittFinal.art}" ist in dieser Lage nicht erlaubt`);
      // Die Adresse des Schritts hängt der Server als Knopf an — sie muss nicht
      // im Text stehen. Nur eine leere Adresse bei einem Schritt, der eine braucht, ist ein Mangel.
      if (!schrittFinal.url && ["zahlung", "termin", "startgespraech", "auskunft"].includes(String(schrittFinal.art))) fehlend.push(`Schritt „${schrittFinal.art}" ohne Adresse — Werkzeug nicht gerufen`);
    }
    // Sie-Form — Justin 04.09.2026: „wir schreiben immer in SIE-Form". Ein Prompt
    // ist eine Bitte; das hier ist die Wand. Kleingeschriebenes du/dich/dir/dein
    // kommt in einem Sie-Text nicht vor (Zitate des Kunden stehen nicht im Kern).
    const sprache = String(k.einordnung.sprache || "de").slice(0, 2);
    const duForm = sprache === "de" ? /(^|[\s„"(])(du|dich|dir|dein|deine|deinen|deinem|deiner|deines|euch|euer|eure)(?=[\s.,;:!?)"“]|$)/
      : sprache === "nl" ? /(^|[\s("])(je|jij|jou|jouw|jullie)(?=[\s.,;:!?)"]|$)/
      : sprache === "fr" ? /(^|[\s("])(tu|toi|ton|ta|tes)(?=[\s.,;:!?)"]|$)/
      : null;
    if (duForm && duForm.test(t)) fehlend.push("Du-Form statt Sie-Form");
    // 08.09.2026 (E-167): VORHER verlangte die Nachprüfung bei jeder offenen Frage
    // eine Aufgabe oder Notiz an den Betreuer — und zwang Mara damit genau zu dem
    // Delegieren, das Justin abgeschafft hat. Eine offene Frage beantwortet Mara
    // selbst oder sagt dem Kunden, was sie dafür von ihm braucht. Keine Wand mehr.
    return { treffer, fehlend };
  };

  let { treffer, fehlend } = pruefen(text);
  let umformuliert = false;

  // Ein Versuch, es selbst zu korrigieren.
  if (treffer.length || fehlend.length) {
    const liste = [
      ...treffer.map((t) => `· ${t.art === "floskel" ? "Floskel" : t.art === "zusage" ? "Ungedeckte Zusage" : "Verboten"}: „${t.treffer}" — ${t.hinweis}`),
      ...fehlend.map((f) => `· Fehlt: ${f}`),
    ].join("\n");
    const neu = await kiAufruf({
      dienst: "postmeister-antwort", modell: MODELL(), aufwand: "low", maxTokens: 6000, schema: SCHEMA_B,
      nachrichten: [...k.nachrichten, { role: "user", content: `Deine Antwort hat diese Mängel:\n${liste}\n\nSchreib sie neu — dieselbe Sache, ohne die Mängel. Nichts erfinden.` }],
    }).catch(() => null);
    if (neu) {
      const zweit = antwortLesen(neu, "Umformulierung");
      const zweitText = String(zweit.antwort || "").trim();
      if (zweitText) {
        const p2 = pruefen(zweitText);
        if (p2.treffer.length + p2.fehlend.length < treffer.length + fehlend.length) {
          text = zweitText; treffer = p2.treffer; fehlend = p2.fehlend; umformuliert = true;
        }
      }
    }
  }

  const urteil = wandUrteil(treffer);
  const sauber = urteil.sendbar && fehlend.length === 0;
  // 04.09.2026 (E-119): Ein Rückrufwunsch hält die Antwort nicht mehr fest, wenn
  // die Aufgabe dazu schon steht — „Herr Stripling meldet sich heute" braucht
  // keinen zweiten Menschen zum Absegnen. Alle anderen Warnlampen bleiben.
  const flags = { ...k.einordnung.flags } as Record<string, boolean>;
  if (flags.rueckruf_wunsch && (gelaufen.includes("aufgabe_an_betreuer") || gelaufen.includes("notiz_an_betreuer"))) flags.rueckruf_wunsch = false;
  // Kündigung GEBUCHT (kuendigung_vormerken ok) und sonst keine Lampe: Der Weg ist
  // Justins Regel (letzte Rate bleibt, dann Ende) — Mara berichtet nur den
  // Buchungsstand, belegt. Beschwerde, Bestreiten, Anwalt, Widerruf halten weiter.
  if (flags.kuendigung && gelaufen.includes("kuendigung_vormerken")
    && !flags.beschwerde && !flags.bestreitet && !flags.rechtlich && !flags.droht_anwalt && !flags.widerruf && !flags.stopp && !flags.zahlungsunfaehig) flags.kuendigung = false;
  // E-240: Verkaufs-Signale (auskunft_fehlt) sind keine Warnlampe — „Ich hab
  // keine." darf mit einem sauberen Angebot automatisch beantwortet werden.
  const automatisch = sauber && urteil.automatisch && AUTO_LAGEN.includes(k.lage)
    && warnlampen(flags).length === 0 && !k.einordnung.dringend;

  return {
    ok: !!text,
    antwort: text || null,
    antwortHtml: null, // setzt der Aufrufer über das Haus-Gerüst
    belege, naechsterSchritt: schrittFinal, handlungen: k.handlungen,
    pruefung: { treffer, fehlend, umformuliert },
    automatischErlaubt: automatisch,
    grund: sauber ? (automatisch ? "sauber, Automat erlaubt" : "sauber, aber Entwurf (Lage oder Flag)") : `Entwurf: ${[...treffer.map((t) => t.treffer), ...fehlend].slice(0, 3).join("; ")}`,
    kostenCents: k.kosten,
    werkzeugDaten: k.werkzeugDaten,
  };
}
