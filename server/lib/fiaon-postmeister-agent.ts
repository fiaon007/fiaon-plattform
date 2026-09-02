// ═══════════════════════════════════════════════════════════════════════════
// DER AGENT — einordnen, handeln, antworten (03.09.2026, E-094)
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

const MODELL = () => process.env.POSTMEISTER_MODELL || "gpt-5.5";
const MODELL_KLEIN = () => process.env.POSTMEISTER_MODELL_KLEIN || "gpt-5.5";
const SCHLUESSEL = () => process.env.OPENAI_API_KEY || process.env.ASSISTENT_API_KEY || "";
const MAX_RUNDEN = 6;
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
}

// ── Der Aufruf ────────────────────────────────────────────────────────────

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
    const body: any = {
      model: ein.modell,
      messages: ein.nachrichten,
      max_completion_tokens: ein.maxTokens ?? 2500,
      reasoning_effort: ein.aufwand ?? "medium",
    };
    if (ein.schema) body.response_format = { type: "json_schema", json_schema: { name: "antwort", strict: true, schema: ein.schema } };
    if (ein.tools?.length) { body.tools = ein.tools; body.tool_choice = "auto"; }
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${schluessel}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: abbruch.signal,
    });
    const j: any = await res.json();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(j?.error ?? j).slice(0, 200)}`);
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
    dienst: "postmeister-einordnen", modell: MODELL_KLEIN(), aufwand: "low", maxTokens: 900, schema: SCHEMA_A,
    nachrichten: [
      { role: "system", content: system },
      { role: "user", content: `VON: ${mail.von}\nBETREFF: ${mail.betreff}\nALTER: ${mail.alterTage} Tage\n\n${String(mail.text || "").slice(0, 6000)}` },
    ],
  });
  const roh = JSON.parse(j.choices?.[0]?.message?.content ?? "{}");
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

function systemPrompt(ein: {
  postfach: string; lage: Kundenlage; lageGrund: string; heute: string; akte: any;
  einordnung: Einordnung; vertrag: string; alterTage: number; werkzeuge: string[];
}): string {
  const schritte = ERLAUBTE_SCHRITTE[ein.lage].join(", ");
  return [
    `Du bist Sachbearbeiterin bei FIAON und schreibst aus dem Postfach ${ein.postfach}. Du bist ein Mensch am Schreibtisch, kein Automat: Du hast die Akte gelesen, bevor du antwortest.`,
    `HEUTE ist ${ein.heute}.`,
    ``,
    `LAGE DIESES KUNDEN: ${ein.lage} — ${ein.lageGrund}.`,
    `Erlaubte nächste Schritte in dieser Lage: ${schritte}. Genau EINER davon steht am Ende deiner Antwort.`,
    `VERTRAG: ${ein.vertrag}`,
    ``,
    `SO SCHREIBST DU:`,
    `· Sprache der Kundenmail (${ein.einordnung.sprache}), Sie-Form, drei bis acht Sätze.`,
    `· Beginne mit dem, was der Kunde will — nie mit einer Eingangsbestätigung.`,
    `· Nenne konkrete Dinge aus der Akte: Paket, Betrag, Datum, Rate, Termin, Name der Betreuerin.`,
    `· Keine Aufzählungszeichen, keine Emojis, keine Betreffzeile, keine Grußformel.`,
    ein.alterTage > 3 ? `· Diese Mail liegt seit ${ein.alterTage} Tagen. Beginne mit einer kurzen, ehrlichen Entschuldigung dafür.` : ``,
    ``,
    `WAS DU NICHT SAGST: nichts garantieren, nicht beraten, nichts empfehlen, keine Fristen zusagen, keine Bankdaten aus dem Gedächtnis, keine internen Statuswörter, nichts versprechen, was du nicht im selben Zug getan hast.`,
    ``,
    `HANDELN: Du hast Werkzeuge (${ein.werkzeuge.join(", ")}). Benutze sie, bevor du schreibst. Wenn ein Mensch etwas wissen muss, schreib ihm eine Notiz (notiz_an_betreuer) — so, wie du es einer Kollegin sagen würdest. Wenn es um Geld geht, hol dir die Zahlungsseite (zahlungslink_bauen) und verlinke sie.`,
    ``,
    `BELEGE: Jede Zahl, jedes Datum, jeder Betrag, jeder Name in deiner Antwort muss aus einem Werkzeugergebnis oder der Akte stammen, und du führst ihn in "belege" auf. Was du nicht belegen kannst, schreibst du nicht.`,
    ``,
    `FRAGEN DES KUNDEN: ${ein.einordnung.fragen.length ? ein.einordnung.fragen.map((f) => `– ${f}`).join("\n") : "keine erkannt"}`,
    `Jede davon beantwortest du oder benennst sie ehrlich als offen (dann muss ein Rückruf oder Termin belegt sein).`,
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
    }) },
  ];
  if (ein.verlauf.length) {
    nachrichten.push({
      role: "user",
      content: `BISHERIGER SCHRIFTWECHSEL (älteste zuerst):\n${ein.verlauf.slice(-6).map((v) => `[${v.am}] ${v.von}: ${v.text.slice(0, 900)}`).join("\n\n")}`,
    });
  }
  nachrichten.push({ role: "user", content: `NEUE NACHRICHT\nVon: ${ein.mail.von}\nBetreff: ${ein.mail.betreff}\n\n${String(ein.mail.text).slice(0, 6000)}` });

  const handlungen: AgentErgebnis["handlungen"] = [];
  const werkzeugDaten: Record<string, any> = {};
  let kosten = 0;

  // Werkzeug-Runden
  for (let runde = 0; runde < MAX_RUNDEN; runde++) {
    const j = await kiAufruf({
      dienst: "postmeister-antwort", modell: MODELL(), aufwand: "medium", maxTokens: 3000,
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
        dienst: "postmeister-antwort", modell: MODELL(), aufwand: "medium", maxTokens: 2000, schema: SCHEMA_B,
        nachrichten: [...nachrichten, { role: "user", content: "Schreibe jetzt die Antwort an den Kunden im vorgegebenen Format." }],
      }).catch((e) => ({ fehler: String(e?.message || e) } as any));
      if ((fertig as any).fehler) return { ...leer, grund: `Antwort nicht erzeugt: ${(fertig as any).fehler}`, handlungen };
      return await pruefenUndAbschliessen(JSON.parse(fertig.choices?.[0]?.message?.content ?? "{}"), {
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
    const werte = JSON.stringify(k.werkzeugDaten).toLowerCase() + JSON.stringify(k.akte).toLowerCase();
    for (const z of belegPflichtig(t)) {
      const nackt = z.replace(/[€\s]/g, "").replace(",", ".").toLowerCase();
      if (!werte.includes(nackt) && !belegte.includes(z.toLowerCase())) fehlend.push(`ohne Beleg: ${z}`);
    }
    // Pflichtangaben je Lage
    if (["unbezahlt", "zahlung_gemeldet", "rate_ueberfaellig", "gekuendigt"].includes(k.lage)) {
      const seite = k.werkzeugDaten.zahlungslink_bauen?.zahlungsseite;
      if (!seite) fehlend.push("Zahlungsseite nicht geholt (zahlungslink_bauen fehlt)");
      else if (!t.includes(String(seite))) fehlend.push("Zahlungsseite nicht in der Antwort verlinkt");
    }
    // Termin in den nächsten sieben Tagen muss vorkommen
    const naher = (k.akte.termine ?? []).find((tm: any) => /heute|morgen|in \d+ Tagen/.test(tm.beginn) && tm.status === "gebucht");
    if (naher && !/termin|gespräch|uhr/i.test(t)) fehlend.push("gebuchter Termin nicht erwähnt");
    // Genau ein nächster Schritt, und seine Adresse muss im Text stehen
    if (!schritt) fehlend.push("kein nächster Schritt");
    else {
      if (!ERLAUBTE_SCHRITTE[k.lage].includes(schritt.art)) fehlend.push(`Schritt „${schritt.art}" ist in dieser Lage nicht erlaubt`);
      if (schritt.url && !t.includes(schritt.url)) fehlend.push("Adresse des nächsten Schritts fehlt im Text");
    }
    // Offene Fragen ohne belegten Rückruf
    const offen = (roh.fragen_beantwortet ?? []).filter((f: any) => f && f.beantwortet === false);
    if (offen.length && !gelaufen.includes("notiz_an_betreuer")) fehlend.push("offene Frage ohne Rückruf oder Notiz");
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
      dienst: "postmeister-antwort", modell: MODELL(), aufwand: "low", maxTokens: 1800, schema: SCHEMA_B,
      nachrichten: [...k.nachrichten, { role: "user", content: `Deine Antwort hat diese Mängel:\n${liste}\n\nSchreib sie neu — dieselbe Sache, ohne die Mängel. Nichts erfinden.` }],
    }).catch(() => null);
    if (neu) {
      const zweit = JSON.parse(neu.choices?.[0]?.message?.content ?? "{}");
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
  };
}
