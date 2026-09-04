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

import { wandPruefen, wandUrteil, type Wandtreffer } from "@shared/fiaon-wortverbote";
import {
  ERLAUBTE_SCHRITTE, AUTO_LAGEN, LEERE_FLAGS,
  type Flags, type Kategorie, type Kundenlage, type Beleg, type NaechsterSchritt,
} from "@shared/fiaon-postmeister-typen";
import { werkzeugeAlsTools, werkzeugVonName, werkzeugeFuerLage, type WerkzeugKontext } from "./fiaon-postmeister-werkzeuge";
import { akteLesen, vertragsfassung } from "./fiaon-postmeister-dossier";
import { nutzungMerken, kostenHeute } from "./fiaon-postmeister-schema";
import { wissenText } from "@shared/fiaon-wissen";

const MODELL = () => process.env.POSTMEISTER_MODELL || "gpt-5.5";
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
function antwortLesen(j: any, wofuer: string): any {
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

async function kiAufruf(ein: {
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
      },
      required: ["kuendigung", "bestreitet", "widerruf", "beschwerde", "rechtlich", "stopp", "zahlung_behauptet", "rueckruf_wunsch", "droht_anwalt", "zahlungsunfaehig"],
    },
  },
  required: ["kategorien", "dringend", "sprache", "fragen", "zusammenfassung", "flags"],
};

export async function einordnen(mail: { betreff: string; text: string; von: string; alterTage: number }): Promise<Einordnung> {
  const system = [
    "Du ordnest eingehende Kundenmails eines deutschen Dienstleisters ein. Du antwortest NICHT, du beschreibst nur.",
    "Kategorien (mehrere möglich): zahlung, zugang_login, termin, unterlagen, status_frage, neuinteresse, vertrieb_komplex, kuendigung, beschwerde, rechtlich, abmeldung, werbung_newsletter, intern, sonstiges.",
    "fragen: jede Frage des Kunden als eigener kurzer Satz, in seinen Worten. Keine Frage erfinden.",
    "zusammenfassung: ein bis zwei Sätze, was der Kunde will und in welcher Stimmung er ist.",
    "sprache: der ISO-Code der Sprache, in der die Mail geschrieben ist (de, en, …).",
    "dringend: true nur, wenn heute jemand handeln muss.",
  ].join("\n");
  const j = await kiAufruf({
    dienst: "postmeister-einordnen", modell: MODELL_KLEIN(), aufwand: "low", maxTokens: 3000, schema: SCHEMA_A,
    nachrichten: [
      { role: "system", content: system },
      { role: "user", content: `VON: ${mail.von}\nBETREFF: ${mail.betreff}\nALTER: ${mail.alterTage} Tage\n\n${String(mail.text || "").slice(0, 6000)}` },
    ],
  });
  const roh = antwortLesen(j, "Einordnung");
  const flags: Flags = { ...LEERE_FLAGS, ...(roh.flags ?? {}) };

  // Der Riegel gewinnt immer.
  const pruefText = `${mail.betreff}\n${mail.text}`;
  for (const r of RIEGEL) if (r.muster.test(pruefText)) flags[r.flag] = true;
  if (flags.droht_anwalt || flags.widerruf) flags.rechtlich = true;

  return {
    kategorien: (Array.isArray(roh.kategorien) ? roh.kategorien : ["sonstiges"]) as Kategorie[],
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
  },
  required: ["antwort", "naechster_schritt", "belege", "fragen_beantwortet"],
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

function systemPrompt(ein: {
  postfach: string; lage: Kundenlage; lageGrund: string; heute: string; akte: any;
  einordnung: Einordnung; vertrag: string; alterTage: number; werkzeuge: string[];
  name: string;
}): string {
  const schritte = ERLAUBTE_SCHRITTE[ein.lage].join(", ");
  return [
    `Du heißt ${ein.name} und arbeitest im Kundendienst von FIAON. Kolleginnen und Kollegen nennst du dem Kunden gegenüber so, wie die Werkzeuge sie dir nennen (Herr/Frau Nachname oder voller Name) — nie nur mit Vornamen. Du schreibst aus dem Postfach ${ein.postfach}. Du bist ein Mensch am Schreibtisch, kein Automat: Du hast die Akte gelesen und den ganzen bisherigen Schriftwechsel, bevor du antwortest.`,
    `Wenn der Kunde dich mit Namen anspricht oder auf eine frühere Mail von dir Bezug nimmt, gehst du darauf ein — du erinnerst dich an alles, was in diesem Verlauf steht.`,
    `DU UNTERSCHREIBST NICHT. Kein Name, kein Gruß am Ende — beides hängt der Server an. Dein Text endet mit dem letzten Satz an den Kunden.`,
    `KEINE ADRESSE (URL) IM TEXT. Wenn der Kunde eine Seite braucht, nennst du sie beim Namen („die Zahlungsseite", „Ihren Bereich") — der Knopf darunter trägt die Adresse. Eine URL im Fließtext ist ein Fremdkörper.`,
    `HEUTE ist ${ein.heute}.`,
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
    `HANDELN: Du hast Werkzeuge (${ein.werkzeuge.join(", ")}). Benutze sie, bevor du schreibst. Du ersetzt einen Mitarbeiter: Was du erledigen kannst, erledigst du selbst. Wenn ein Mensch etwas TUN muss (Rückruf, Bescheinigung, Datenänderung, Unterlagen prüfen, frühere Kündigung nachsehen), gib ihm eine Aufgabe (aufgabe_an_betreuer) mit Titel und Frist — und sag dem Kunden, wer sich bis wann meldet. Wenn ein Mensch nur etwas wissen soll, reicht eine Notiz (notiz_an_betreuer). Wenn es um Geld geht, hol dir die Zahlungsseite (zahlungslink_bauen) und verlinke sie — die Rechnung als PDF hängt der Server dann automatisch an; verlangt der Kunde ausdrücklich eine Rechnung oder einen Beleg, nimm rechnung_anhaengen. Bei einer Kündigung: erst das Rettungsgespräch, bei klarer Erklärung kuendigung_vormerken — der Vertrag endet erst mit der Zahlung der offenen Rate.`,
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
    wissenText().slice(0, 6000),
    ``,
    `BEI WUT UND WIEDERHOLUNG: Ein Kunde, der sich wiederholt, wurde beim ersten Mal nicht verstanden — oder hat es nicht geglaubt. Erkläre es ANDERS, nie vorwurfsvoll. Du spiegelst seinen Ton nicht: Auf „wie oft muss ich es noch sagen" antwortest du NICHT mit „Sie müssen es nicht noch einmal erwähnen". Du erkennst an, was er fühlt („Ich verstehe, dass Sie verärgert sind"), ohne es zu bewerten, und erklärst dann ruhig.`,
    `WENN DER KUNDE VON „KREDIT" SPRICHT, hat er das Produkt missverstanden — das ist der Kern seines Widerstands, nicht ein Nebensatz. FIAON vergibt keine Kredite und vermittelt keine. Erkläre in zwei Sätzen, was er tatsächlich gebucht hat und wofür die Rate ist. Erst dann sprich über die Zahlung.`,
    // ═══════════════════════════════════════════════════════════════════
    // DAS RETTUNGSGESPRÄCH (04.09.2026, Justin): „Warum führt die KI keine
    // Kommunikation, um den Kunden zu retten? … also dass Handlungen
    // PASSIEREN!" Bis hierher erklärte Mara Fakten (Rate, Fälligkeit,
    // Kündigungsfrist) und bot einen Termin an. Ein Kunde, der aussteigen
    // will, braucht einen Grund zu bleiben — den hat sie ihm nicht gegeben.
    // ═══════════════════════════════════════════════════════════════════
    `WENN DER KUNDE AUSSTEIGEN WILL (kündigen, nicht zahlen, „Vertrag gebrochen", „wozu das alles"), ist deine erste Aufgabe nicht die Rechnung, sondern der Grund zu bleiben. Du bist Beraterin, nicht Buchhalterin. In dieser Reihenfolge:`,
    `  1. Anerkennen, was er sagt — ein Satz, ohne Bewertung.`,
    `  2. Fragen, ob du kurz erklären darfst, worum es eigentlich geht. Dann: Er will danach wieder normal am Kreditsystem teilnehmen — ein Handy finanzieren, einen Vertrag abschließen, ein Konto mit Karte. Genau dafür ist das Programm da: Schritt für Schritt die Bonität aufbauen, bis am Ende die Kreditkarte unserer Kooperationsbank steht. Wer jetzt abbricht, steht in einem Jahr am selben Punkt.`,
    `  3. Die Alternative ehrlich benennen: Angebote mit „Kredit ohne SCHUFA" sind oft unseriös — man zahlt dort Gebühren, und die Bonität bleibt, wie sie ist. (NICHT „Betrug" oder „Fake" schreiben — das ist eine Behauptung über Dritte, die uns Ärger macht.)`,
    `  4. Bitten, es durchzuziehen. Ein echter Satz, kein Verkaufsspruch: „Ziehen Sie es bitte einmal durch — was meinen Sie?"`,
    `  5. ERST DANN die Rate und der Weg zur Zahlung, in einem Satz, ohne Druck.`,
    `Wenn der Kunde trotzdem kündigt, respektierst du das: Kündigung vormerken (Werkzeug), letzte Rate benennen, kein zweiter Versuch. Einmal werben ist Beratung, zweimal ist Bedrängen.`,
    `Wortverbote gelten weiter: nichts garantieren, keinen Kredit versprechen oder vermitteln, das Wort „Affiliate" nie.`,
    ``,
    `WENN DER KUNDE EINEN VERPASSTEN TERMIN NENNT, sieh in den Terminen der Akte nach. Stimmt es, entschuldige dich konkret (Datum, wer). Stimmt es nicht, sag ruhig, was du in der Akte siehst.`,
    `KEINE TELEFONNUMMERN IM TEXT — weder die des Kunden noch die eines Kollegen. „Daniel ruft Sie an" reicht. Die Nummer kennt der Kunde, und die des Kollegen geht ihn nichts an.`,
    ``,
    `DIE AKTE:`,
    JSON.stringify(ein.akte, null, 1).slice(0, 9000),
  ].filter(Boolean).join("\n");
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
    /\bFIAON-[A-Z0-9]{6}(?:-\d{1,2})?\b/g,
    /\bRate\s+\d{1,2}\b/gi,
  ];
  for (const m of muster) {
    const treffer = text.match(m);
    if (treffer) for (const t of treffer) gefunden[t.trim()] = true;
  }
  return Object.keys(gefunden);
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
  };
  const werkzeuge = werkzeugeFuerLage(lage);
  const tools = werkzeugeAlsTools(lage);

  const nachrichten: any[] = [
    { role: "system", content: systemPrompt({
      postfach: ein.postfach, lage, lageGrund: akte.lageGrund, heute: akte.heute, akte,
      einordnung: ein.einordnung, vertrag: vertrag.text, alterTage: ein.mail.alterTage,
      werkzeuge: werkzeuge.map((w) => w.name),
      name: await agentName(),
    }) },
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

  const handlungen: AgentErgebnis["handlungen"] = [];
  const werkzeugDaten: Record<string, any> = {};
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
      return await pruefenUndAbschliessen(antwortLesen(fertig, "Antwort"), {
        lage, akte, einordnung: ein.einordnung, handlungen, werkzeugDaten, kosten, kontext, nachrichten,
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
  lage: Kundenlage; akte: any; einordnung: Einordnung;
  handlungen: AgentErgebnis["handlungen"]; werkzeugDaten: Record<string, any>;
  kosten: number; kontext: WerkzeugKontext; nachrichten: any[];
}): Promise<AgentErgebnis> {
  let text = String(roh.antwort || "").trim();
  // 02.09.2026: Im Entwurf an Herrn Munk endete der Brief mit dem Wort
  // „erledigt." — das ist der interne Zustand `naechster_schritt.art`, den das
  // Modell aus dem Schema mit in den Text genommen hat. Ein Kunde liest dort
  // ein sinnloses Einzelwort. Ein Statuswort am Ende, allein auf einer Zeile
  // oder als letzter „Satz", wird abgeschnitten.
  text = text.replace(
    /(?:^|\n)\s*(erledigt|zahlung|termin|bereich|unterlagen|antrag|angebot|startgespraech|startgespräch|rueckruf|rückruf|keiner|nichts)\s*\.?\s*$/i,
    "",
  ).trim();
  const schritt: NaechsterSchritt | null = roh.naechster_schritt
    ? { art: String(roh.naechster_schritt.art) as any, url: roh.naechster_schritt.url ?? null, text: String(roh.naechster_schritt.text || "") }
    : null;
  const belege: Beleg[] = Array.isArray(roh.belege) ? roh.belege : [];
  const gelaufen = k.handlungen.filter((h) => h.ok).map((h) => h.werkzeug);

  const pruefen = (t: string) => {
    const treffer = wandPruefen(t, gelaufen);
    const fehlend: string[] = [];
    // Belegpflicht
    const belegte = belege.map((b) => `${b.satz} ${b.feld}`).join(" ").toLowerCase();
    // Hauswissen (Impressum, Preise, Ablauf) ist belegfähig — es ist öffentlich.
    const werte = JSON.stringify(k.werkzeugDaten).toLowerCase() + JSON.stringify(k.akte).toLowerCase() + wissenText().toLowerCase();
    for (const z of belegPflichtig(t)) {
      const nackt = z.replace(/[€\s]/g, "").replace(",", ".").toLowerCase();
      if (!werte.includes(nackt) && !belegte.includes(z.toLowerCase())) fehlend.push(`ohne Beleg: ${z}`);
    }
    // Pflichtangaben je Lage
    if (["unbezahlt", "zahlung_gemeldet", "rate_ueberfaellig", "gekuendigt"].includes(k.lage)) {
      const seite = k.werkzeugDaten.zahlungslink_bauen?.zahlungsseite;
      // 04.09.2026: Der Knopf unter dem Text trägt die Adresse (antwortBauen),
      // kernBereinigen nimmt sie aus dem Text sogar heraus. Die Prüfung verlangte
      // sie trotzdem im Modelltext — Hauptgrund für „Entwurf" bei sauberen
      // Antworten (2427 Jusic: alles richtig, Knopf da, trotzdem Entwurf).
      // Es zählt: Zahlungsseite geholt UND als nächster Schritt gesetzt.
      if (!seite) fehlend.push("Zahlungsseite nicht geholt (zahlungslink_bauen fehlt)");
      else if (!t.includes(String(seite)) && String(schritt?.url || "") !== String(seite)) fehlend.push("Zahlungsseite weder im Text noch als Knopf");
    }
    // Termin in den nächsten sieben Tagen muss vorkommen
    const naher = (k.akte.termine ?? []).find((tm: any) => /heute|morgen|in \d+ Tagen/.test(tm.beginn) && tm.status === "gebucht");
    if (naher && !/termin|gespräch|uhr/i.test(t)) fehlend.push("gebuchter Termin nicht erwähnt");
    // Genau ein nächster Schritt, und seine Adresse muss im Text stehen
    if (!schritt) fehlend.push("kein nächster Schritt");
    else {
      if (!ERLAUBTE_SCHRITTE[k.lage].includes(schritt.art)) fehlend.push(`Schritt „${schritt.art}" ist in dieser Lage nicht erlaubt`);
      // Die Adresse des Schritts hängt der Server als Knopf an — sie muss nicht
      // im Text stehen. Nur eine leere Adresse bei einem Schritt, der eine braucht, ist ein Mangel.
      if (!schritt.url && ["zahlung", "termin", "antrag", "bereich", "startgespraech", "unterlagen", "angebot"].includes(String(schritt.art))) fehlend.push(`Schritt „${schritt.art}" ohne Adresse`);
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
    // Offene Fragen ohne belegten Rückruf
    const offen = (roh.fragen_beantwortet ?? []).filter((f: any) => f && f.beantwortet === false);
    if (offen.length && !gelaufen.includes("notiz_an_betreuer") && !gelaufen.includes("aufgabe_an_betreuer")) fehlend.push("offene Frage ohne Rückruf, Aufgabe oder Notiz");
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
  const automatisch = sauber && urteil.automatisch && AUTO_LAGEN.includes(k.lage)
    && !Object.values(k.einordnung.flags).some(Boolean) && !k.einordnung.dringend;

  return {
    ok: !!text,
    antwort: text || null,
    antwortHtml: null, // setzt der Aufrufer über das Haus-Gerüst
    belege, naechsterSchritt: schritt, handlungen: k.handlungen,
    pruefung: { treffer, fehlend, umformuliert },
    automatischErlaubt: automatisch,
    grund: sauber ? (automatisch ? "sauber, Automat erlaubt" : "sauber, aber Entwurf (Lage oder Flag)") : `Entwurf: ${[...treffer.map((t) => t.treffer), ...fehlend].slice(0, 3).join("; ")}`,
    kostenCents: k.kosten,
    werkzeugDaten: k.werkzeugDaten,
  };
}
