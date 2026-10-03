// ═══════════════════════════════════════════════════════════════════════════
// KI-WEICHE: OPENAI-FORMAT ↔ CLAUDE (03.10.2026, E-279)
//
// Justin, 03.10.2026: „Ok ich denke wir werden OPENAI wechseln, das ist eine
// unzuverlässige, schadhafte, teure, und nicht qualitative KI“ — OpenAI hatte
// am 03.10. um 05:15 das Konto hinter dem Hausschlüssel deaktiviert („The
// OpenAI account associated with this API key has been deactivated“), seitdem
// stand jede KI: Mara im Postfach, auf WhatsApp, die Mara-Aktion.
//
// Der übrige Code spricht OpenAI-Format (Chat Completions und Responses) — in
// 25 Dateien. Statt jede umzuschreiben, übersetzt DIESE Datei an EINER Stelle
// (openaiFetch in fiaon-ki-pause.ts): Anfrage → Claude Messages API, Antwort →
// dieselbe OpenAI-Form, die die Aufrufer schon lesen. Reine Funktionen, kein
// Netz, keine Importe — Netz, Pause und Schlüssel bleiben in fiaon-ki-pause.ts
// (die einzige Wahrheit, E-246).
//
//   · Anbieter: KI_ANBIETER=claude|openai; ohne Angabe Claude, sobald
//     ANTHROPIC_API_KEY gesetzt ist.
//   · Modelle: CLAUDE_MODELL_GROSS (Vorgabe claude-opus-5-5) für alles, was
//     bisher gpt-5.x/4.1/4o war; CLAUDE_MODELL_KLEIN (Vorgabe
//     claude-sonnet-5-5) für *-mini/*-nano.
//   · Festes Antwortformat (json_schema) → output_config.format (GA); lehnt
//     Claude das Schema ab, wiederholt fiaon-ki-pause.ts einmal mit klarer
//     Anweisung (alsAnweisung).
//   · Werkzeugschleifen: Die Antwort trägt Claudes Rohblöcke (Denken,
//     Werkzeugaufrufe) als `_claude_inhalt` an der Nachricht — wer die
//     Nachricht unverändert in den Verlauf legt (Postmeister), bekommt sie in
//     der nächsten Runde zurück. Fehlen sie, wird Denken für diese Runde
//     abgeschaltet (sonst lehnt Claude Werkzeugverlauf ohne Denkblöcke ab).
//   · NICHT übersetzt: /audio/* (Whisper, Telefon-Transkripte) — Claude hat
//     kein Sprache-zu-Text; das bleibt bei OpenAI.
//
// Preise (platform.claude.com, 03.10.2026, US-$ je 1 Mio. Tokens):
//   Fable 5.1 10/50 · Opus 5.5 4/20 · Sonnet 5.5 2/10 · Haiku 4.5 1/5.
//   Cache schreiben ×1,25, Cache lesen ×0,1 (Opus 5.5 ×0,05).
// ═══════════════════════════════════════════════════════════════════════════

export type KiAnbieter = "openai" | "claude";

export const CLAUDE_GROSS_VORGABE = "claude-opus-5-5";
export const CLAUDE_KLEIN_VORGABE = "claude-sonnet-5-5";
/** Obergrenze für max_tokens — darunter liegen alle Modelle (Haiku 4.5: 64K). */
const MAX_TOKENS_DECKEL = 64_000;

/** Welcher Anbieter trägt die KI? KI_ANBIETER gewinnt, sonst Claude, sobald ANTHROPIC_API_KEY gesetzt ist. */
export function aktiverAnbieter(): KiAnbieter {
  const w = String(process.env.KI_ANBIETER || "").trim().toLowerCase();
  if (w === "openai") return "openai";
  if (w === "claude" || w === "anthropic") return "claude";
  return process.env.ANTHROPIC_API_KEY ? "claude" : "openai";
}

/** Geht dieser OpenAI-Pfad an Claude? Nur Text, Bild, PDF (POST /chat/completions, /responses) — nie Sprache. */
export function claudeKannPfad(url: string, methode?: string | null): boolean {
  if (methode && String(methode).toUpperCase() !== "POST") return false;
  let pfad = url;
  try { pfad = new URL(url).pathname; } catch { /* schon ein Pfad */ }
  return /\/(chat\/completions|responses)\/?$/.test(pfad);
}

/** Das Claude-Modell für ein OpenAI-Modell: *-mini/*-nano → KLEIN, alles andere → GROSS. claude-* bleibt. */
export function claudeModellFuer(modell: string | null | undefined): string {
  const m = String(modell || "").trim();
  if (/^claude-/.test(m)) return m;
  return /mini|nano/i.test(m)
    ? (process.env.CLAUDE_MODELL_KLEIN || CLAUDE_KLEIN_VORGABE)
    : (process.env.CLAUDE_MODELL_GROSS || CLAUDE_GROSS_VORGABE);
}

/** Haiku kennt weder `effort` noch adaptives Denken (400 bei beidem). */
function ohneDenken(modell: string): boolean {
  return /haiku/i.test(modell);
}

// ── Inhalt: OpenAI-Teile → Claude-Blöcke ──────────────────────────────────
function datenUrl(url: string): { media: string; daten: string } | null {
  const m = /^data:([^;,]+);base64,([\s\S]*)$/.exec(String(url || ""));
  return m ? { media: m[1].toLowerCase(), daten: m[2] } : null;
}

function dateiBlock(media: string, daten: string): any | null {
  if (media === "application/pdf") return { type: "document", source: { type: "base64", media_type: "application/pdf", data: daten } };
  if (/^image\/(jpeg|png|gif|webp)$/.test(media)) return { type: "image", source: { type: "base64", media_type: media, data: daten } };
  if (media === "image/jpg") return { type: "image", source: { type: "base64", media_type: "image/jpeg", data: daten } };
  if (/^text\//.test(media)) {
    return { type: "document", source: { type: "text", media_type: "text/plain", data: Buffer.from(daten, "base64").toString("utf8") } };
  }
  return null;
}

function bildBlock(url: unknown): any | null {
  const u = String(url || "");
  if (!u) return null;
  const d = datenUrl(u);
  if (d) return dateiBlock(d.media, d.daten);
  return /^https?:\/\//i.test(u) ? { type: "image", source: { type: "url", url: u } } : null;
}

function teilNachClaude(t: any): any | null {
  if (t == null) return null;
  if (typeof t === "string") return t.trim() ? { type: "text", text: t } : null;
  switch (t.type) {
    case "text": case "input_text": case "output_text":
      return String(t.text ?? "").trim() ? { type: "text", text: String(t.text) } : null;
    case "image_url":
      return bildBlock(typeof t.image_url === "string" ? t.image_url : t.image_url?.url);
    case "input_image":
      return bildBlock(typeof t.image_url === "string" ? t.image_url : (t.image_url?.url ?? t.url));
    case "input_file": case "file": {
      const roh = t.file_data ?? t.file?.file_data;
      if (!roh) return null;
      const d = datenUrl(roh) ?? { media: /\.pdf$/i.test(String(t.filename ?? t.file?.filename ?? "")) || !t.filename ? "application/pdf" : "application/octet-stream", daten: String(roh) };
      return dateiBlock(d.media, d.daten);
    }
    case "refusal":
      return null;
    default:
      return typeof t.text === "string" && t.text.trim() ? { type: "text", text: t.text } : null;
  }
}

function inhaltNachClaude(c: unknown): any[] {
  if (c == null) return [];
  if (typeof c === "string") return c.trim() ? [{ type: "text", text: c }] : [];
  if (Array.isArray(c)) return c.map(teilNachClaude).filter(Boolean);
  const b = teilNachClaude(c);
  return b ? [b] : [];
}

function inhaltAlsText(c: unknown): string {
  if (c == null) return "";
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.map((t: any) => (typeof t === "string" ? t : typeof t?.text === "string" ? t.text : "")).filter(Boolean).join("\n");
  return typeof (c as any)?.text === "string" ? (c as any).text : "";
}

/** Werkzeug-IDs: Claude erlaubt nur [a-zA-Z0-9_-]. */
function idGlatt(id: unknown): string {
  const s = String(id ?? "").replace(/[^a-zA-Z0-9_-]/g, "_");
  return s || "werkzeug";
}

function jsonOderLeer(a: unknown): any {
  if (a && typeof a === "object") return a;
  try { const j = JSON.parse(String(a ?? "{}")); return j && typeof j === "object" ? j : {}; } catch { return {}; }
}

// ── Schema: was Claudes festes Format nicht kennt, fällt weg ─────────────
const SCHEMA_WEG = new Set([
  "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf",
  "minLength", "maxLength", "pattern", "maxItems", "uniqueItems", "minProperties", "maxProperties", "$schema",
]);
const FORMATE = new Set(["date-time", "date", "time", "email", "uri", "uuid", "hostname", "ipv4", "ipv6", "duration"]);

/** Entfernt Zahlen-/Längengrenzen (von Claudes Format nicht unterstützt); minItems nur 0 oder 1. Rein. */
export function schemaGlaetten(s: any): any {
  if (Array.isArray(s)) return s.map(schemaGlaetten);
  if (!s || typeof s !== "object") return s;
  const raus: any = {};
  for (const [k, v] of Object.entries(s)) {
    if (SCHEMA_WEG.has(k)) continue;
    if (k === "minItems" && !(v === 0 || v === 1)) continue;
    if (k === "format" && typeof v === "string" && !FORMATE.has(v)) continue;
    raus[k] = schemaGlaetten(v);
  }
  return raus;
}

function werkzeugSchema(p: any): any {
  const s = p && typeof p === "object" ? p : {};
  return s.type === "object" ? s : { type: "object", properties: s.properties ?? {}, ...(s.required ? { required: s.required } : {}) };
}

// ── Anfrage: OpenAI Chat Completions → Claude Messages ────────────────────
export interface ClaudeUebersetzung {
  anfrage: any;
  /** Antwortform: festes Schema, freies JSON-Objekt oder Text. */
  json: "schema" | "objekt" | null;
  /** Das Schema (ungeglättet) — für die Ersatzanweisung. */
  schema: any | null;
  stream: boolean;
}

const EFFORT: Record<string, string> = { none: "low", minimal: "low", low: "low", medium: "medium", high: "high", xhigh: "xhigh", max: "max" };

export function chatNachClaude(body: any): ClaudeUebersetzung {
  const modell = claudeModellFuer(body?.model);
  const system: string[] = [];
  const nachrichten: { role: "user" | "assistant"; content: any[] }[] = [];
  let werkzeugVerlaufOhneRoh = false;
  const anhaengen = (role: "user" | "assistant", bloecke: any[]) => {
    if (!bloecke.length) return;
    const letzte = nachrichten[nachrichten.length - 1];
    if (letzte && letzte.role === role) letzte.content.push(...bloecke);
    else nachrichten.push({ role, content: [...bloecke] });
  };

  for (const n of Array.isArray(body?.messages) ? body.messages : []) {
    if (!n) continue;
    const rolle = String(n.role || "user");
    if (rolle === "system" || rolle === "developer") {
      const t = inhaltAlsText(n.content);
      if (t.trim()) system.push(t);
      continue;
    }
    if (rolle === "tool" || rolle === "function") {
      const inhalt = typeof n.content === "string" ? n.content : JSON.stringify(n.content ?? "");
      anhaengen("user", [{ type: "tool_result", tool_use_id: idGlatt(n.tool_call_id), content: inhalt || "(leer)" }]);
      continue;
    }
    if (rolle === "assistant") {
      if (Array.isArray(n._claude_inhalt) && n._claude_inhalt.length) {
        anhaengen("assistant", n._claude_inhalt);
        continue;
      }
      const bl = inhaltNachClaude(n.content).filter((b) => b.type === "text");
      for (const r of Array.isArray(n.tool_calls) ? n.tool_calls : []) {
        werkzeugVerlaufOhneRoh = true;
        bl.push({ type: "tool_use", id: idGlatt(r.id), name: String(r.function?.name ?? r.name ?? "werkzeug"), input: jsonOderLeer(r.function?.arguments ?? r.arguments) });
      }
      anhaengen("assistant", bl);
      continue;
    }
    anhaengen("user", inhaltNachClaude(n.content));
  }
  // Claude: Beginn mit „user“, Ende nie mit „assistant“ (Vorbefüllen ist bei Denkmodellen nicht erlaubt).
  if (!nachrichten.length || nachrichten[0].role !== "user") nachrichten.unshift({ role: "user", content: [{ type: "text", text: "(Beginn des Verlaufs)" }] });
  if (nachrichten[nachrichten.length - 1].role === "assistant") {
    nachrichten.push({ role: "user", content: [{ type: "text", text: "Bitte fahre fort und gib jetzt deine Antwort im verlangten Format." }] });
  }

  const anfrage: any = { model: modell, messages: nachrichten };

  // Festes Antwortformat
  let json: ClaudeUebersetzung["json"] = null;
  let schema: any = null;
  const rf = body?.response_format;
  if (rf?.type === "json_schema" && rf.json_schema?.schema) {
    json = "schema";
    schema = rf.json_schema.schema;
    anfrage.output_config = { format: { type: "json_schema", schema: schemaGlaetten(schema) } };
  } else if (rf?.type === "json_object") {
    json = "objekt";
    system.push("Antworte ausschließlich mit einem einzigen gültigen JSON-Objekt — ohne Erklärtext davor oder danach und ohne Codeblock.");
  }

  const systemText = system.join("\n\n").trim();
  if (systemText) {
    // Lange Aufträge zwischenspeichern: Werkzeugrunden und zweite Entwürfe lesen sie zum Bruchteil des Preises.
    anfrage.system = systemText.length > 6_000
      ? [{ type: "text", text: systemText, cache_control: { type: "ephemeral" } }]
      : systemText;
  }

  // Werkzeuge
  const werkzeuge = (Array.isArray(body?.tools) ? body.tools : []).map((t: any) => {
    if (t?.type === "function" || (t && !t.type && t.name)) {
      const f = t.function ?? t;
      return { name: String(f.name), description: String(f.description ?? ""), input_schema: werkzeugSchema(f.parameters) };
    }
    if (t?.type === "web_search" || t?.type === "web_search_preview") return { type: "web_search_20250305", name: "web_search", max_uses: 8 };
    return null;
  }).filter(Boolean);
  if (werkzeuge.length) {
    anfrage.tools = werkzeuge;
    const tc = body?.tool_choice;
    if (tc === "required") anfrage.tool_choice = { type: "any" };
    else if (tc === "none") anfrage.tool_choice = { type: "none" };
    else if (tc && typeof tc === "object" && (tc.function?.name || tc.name)) anfrage.tool_choice = { type: "tool", name: String(tc.function?.name ?? tc.name) };
    else anfrage.tool_choice = { type: "auto" };
  }

  // Denken und Aufwand
  const temperatur = body?.temperature;
  const denkenAus = werkzeugVerlaufOhneRoh || temperatur != null;
  if (!ohneDenken(modell)) {
    if (denkenAus) anfrage.thinking = { type: "disabled" };
    const e = EFFORT[String(body?.reasoning_effort ?? body?.reasoning?.effort ?? "").toLowerCase()];
    if (e) anfrage.effort = e;
  }
  if (temperatur != null && denkenAus) anfrage.temperature = Math.max(0, Math.min(1, Number(temperatur) || 0));

  const gewuenscht = Number(body?.max_tokens ?? body?.max_completion_tokens ?? body?.max_output_tokens ?? 8_000) || 8_000;
  // Mit Denken zählt das Nachdenken gegen dieselbe Grenze — Luft lassen (bezahlt wird, was gebraucht wird).
  anfrage.max_tokens = Math.min(MAX_TOKENS_DECKEL, Math.max(gewuenscht, denkenAus || ohneDenken(modell) ? 1_024 : 8_000));

  return { anfrage, json, schema, stream: body?.stream === true };
}

/**
 * Ersatz, wenn Claude das feste Format ablehnt (Schema-Eigenheit, Websuche mit Belegen): dasselbe ohne
 * output_config, dafür eine klare Anweisung mit dem Schema. Die Antwort wird als JSON gelesen (jsonKern). Rein.
 */
export function alsAnweisung(u: ClaudeUebersetzung): ClaudeUebersetzung {
  const anfrage = { ...u.anfrage };
  delete anfrage.output_config;
  const satz = `Antworte ausschließlich mit einem einzigen gültigen JSON-Objekt, das genau diesem JSON-Schema entspricht — ohne Erklärtext und ohne Codeblock:\n${JSON.stringify(u.schema ?? {})}`;
  if (Array.isArray(anfrage.system)) anfrage.system = [...anfrage.system, { type: "text", text: satz }];
  else anfrage.system = [anfrage.system, satz].filter(Boolean).join("\n\n");
  return { ...u, anfrage, json: "objekt" };
}

// ── Antwort: Claude → OpenAI Chat Completions ─────────────────────────────
/** JSON aus einem Text holen: Codeblock weg, sonst vom ersten „{“ bis zum letzten „}“. Rein. */
export function jsonKern(text: string): string {
  let t = String(text ?? "").trim();
  const block = /```(?:json)?\s*([\s\S]*?)```/i.exec(t);
  if (block) t = block[1].trim();
  if (t.startsWith("{") || t.startsWith("[")) return t;
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  return a >= 0 && b > a ? t.slice(a, b + 1) : t;
}

export function claudeNachChat(roh: any, opt: { json: ClaudeUebersetzung["json"]; modell: string }): any {
  const bloecke: any[] = Array.isArray(roh?.content) ? roh.content : [];
  const texte = bloecke.filter((b) => b?.type === "text" && typeof b.text === "string").map((b) => b.text as string);
  let text = opt.json
    // Bei JSON zählt der letzte Textblock, der wie JSON aussieht (Websuche liefert Zwischentexte mit Belegen).
    ? jsonKern([...texte].reverse().find((t) => /[{[]/.test(t)) ?? texte.join(""))
    : texte.join("");
  text = text.trim() ? text : "";
  const tool_calls = bloecke.filter((b) => b?.type === "tool_use").map((b) => ({
    id: String(b.id), type: "function", function: { name: String(b.name), arguments: JSON.stringify(b.input ?? {}) },
  }));
  const finish = roh?.stop_reason === "max_tokens" ? "length"
    : tool_calls.length ? "tool_calls"
    : roh?.stop_reason === "refusal" ? "content_filter" : "stop";
  const u = roh?.usage ?? {};
  const ein = Number(u.input_tokens || 0), cw = Number(u.cache_creation_input_tokens || 0), cr = Number(u.cache_read_input_tokens || 0);
  const aus = Number(u.output_tokens || 0);
  const modell = String(roh?.model || opt.modell);
  return {
    id: String(roh?.id || `claude-${Date.now()}`),
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: modell,
    choices: [{
      index: 0,
      message: {
        role: "assistant",
        content: text || null,
        ...(tool_calls.length ? { tool_calls, _claude_inhalt: bloecke } : {}),
      },
      finish_reason: finish,
    }],
    usage: {
      prompt_tokens: ein + cw + cr, completion_tokens: aus, total_tokens: ein + cw + cr + aus,
      prompt_tokens_details: { cached_tokens: cr },
      _anbieter: "claude", _modell: modell, _eingabe: ein, _cache_schreiben: cw, _cache_lesen: cr,
    },
  };
}

// ── Responses API ↔ Chat ───────────────────────────────────────────────────
/** Eine Anfrage an /v1/responses in Chat-Form (danach geht sie durch chatNachClaude). Rein. */
export function responsesNachChat(body: any): any {
  const messages: any[] = [];
  if (body?.instructions) messages.push({ role: "system", content: String(body.instructions) });
  const input = body?.input;
  if (typeof input === "string") messages.push({ role: "user", content: input });
  else for (const it of Array.isArray(input) ? input : []) {
    if (!it) continue;
    if (it.type === "function_call") {
      const ruf = { id: String(it.call_id ?? it.id), type: "function", function: { name: String(it.name), arguments: String(it.arguments ?? "{}") } };
      const letzte = messages[messages.length - 1];
      if (letzte?.role === "assistant") (letzte.tool_calls ??= []).push(ruf);
      else messages.push({ role: "assistant", content: null, tool_calls: [ruf] });
      continue;
    }
    if (it.type === "function_call_output") {
      messages.push({ role: "tool", tool_call_id: String(it.call_id), content: typeof it.output === "string" ? it.output : JSON.stringify(it.output ?? "") });
      continue;
    }
    if (it.type === "reasoning") continue;
    if (it.role || it.type === "message") messages.push({ role: it.role ?? "user", content: it.content });
  }
  const chat: any = { model: body?.model, messages };
  if (body?.max_output_tokens != null) chat.max_tokens = body.max_output_tokens;
  if (body?.temperature != null) chat.temperature = body.temperature;
  if (body?.reasoning?.effort) chat.reasoning_effort = body.reasoning.effort;
  if (Array.isArray(body?.tools)) {
    chat.tools = body.tools.map((t: any) => (t?.type === "function"
      ? { type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } }
      : t));
  }
  const tc = body?.tool_choice;
  if (tc && typeof tc === "object" && tc.type === "function") chat.tool_choice = { type: "function", function: { name: tc.name } };
  else if (tc) chat.tool_choice = tc;
  const f = body?.text?.format;
  if (f?.type === "json_schema") chat.response_format = { type: "json_schema", json_schema: { name: f.name, schema: f.schema, strict: f.strict } };
  else if (f?.type === "json_object") chat.response_format = { type: "json_object" };
  return chat;
}

/** Eine Chat-Antwort in der Form von /v1/responses. Rein. */
export function chatNachResponses(chat: any): any {
  const wahl = chat?.choices?.[0] ?? {};
  const m = wahl.message ?? {};
  const output: any[] = [];
  if (m.content) output.push({ type: "message", id: `${chat.id}_m`, status: "completed", role: "assistant", content: [{ type: "output_text", text: String(m.content), annotations: [] }] });
  for (const r of Array.isArray(m.tool_calls) ? m.tool_calls : []) {
    output.push({ type: "function_call", id: r.id, call_id: r.id, name: r.function?.name, arguments: r.function?.arguments ?? "{}", status: "completed" });
  }
  const u = chat?.usage ?? {};
  const unfertig = wahl.finish_reason === "length";
  return {
    id: chat.id, object: "response", created_at: chat.created, model: chat.model,
    status: unfertig ? "incomplete" : "completed",
    incomplete_details: unfertig ? { reason: "max_output_tokens" } : null,
    output, output_text: m.content ?? "",
    usage: {
      input_tokens: u.prompt_tokens ?? 0, output_tokens: u.completion_tokens ?? 0, total_tokens: u.total_tokens ?? 0,
      input_tokens_details: { cached_tokens: u._cache_lesen ?? 0 },
      _anbieter: u._anbieter, _modell: u._modell, _eingabe: u._eingabe, _cache_schreiben: u._cache_schreiben, _cache_lesen: u._cache_lesen,
    },
  };
}

/** Eine fertige Chat-Antwort als Datenstrom (stream: true) — Text in einem Stück, Werkzeuge je Index. Rein. */
export function chatAlsSse(chat: any): string {
  const wahl = chat?.choices?.[0] ?? {};
  const m = wahl.message ?? {};
  const stueck = (delta: any, finish: string | null = null) =>
    `data: ${JSON.stringify({ id: chat.id, object: "chat.completion.chunk", created: chat.created, model: chat.model, choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`;
  const zeilen = [stueck({ role: "assistant" })];
  if (m.content) zeilen.push(stueck({ content: m.content }));
  (Array.isArray(m.tool_calls) ? m.tool_calls : []).forEach((r: any, i: number) => {
    zeilen.push(stueck({ tool_calls: [{ index: i, id: r.id, type: "function", function: { name: r.function?.name, arguments: r.function?.arguments ?? "{}" } }] }));
  });
  zeilen.push(stueck({}, wahl.finish_reason ?? "stop"));
  zeilen.push("data: [DONE]\n\n");
  return zeilen.join("");
}

// ── Fehler ─────────────────────────────────────────────────────────────────
/**
 * Claude-Fehler → „abrechnung" | „zugang" | null (vorübergehend). Rein.
 *   · 401 authentication_error → zugang (Schlüssel falsch oder widerrufen).
 *   · 403 nur mit Hinweis auf Schlüssel/Konto → zugang.
 *   · 400 „credit balance is too low“ → abrechnung.
 *   · 429 mit enforced_spend_limit_reached / „usage limits“ → abrechnung; sonst Ratenlimit → null.
 *   · 402 / billing_error → abrechnung.
 *   · 5xx, 529 (überlastet), übrige 400 → null.
 */
export function claudeFehlerArt(status: number, body: unknown): "abrechnung" | "zugang" | null {
  let j: any = body;
  if (typeof body === "string") { try { j = JSON.parse(body); } catch { j = null; } }
  const err = j && typeof j === "object" && j.error && typeof j.error === "object" ? j.error : null;
  if (!err) return null;
  const typ = String(err.type ?? "");
  const meldung = String(err.message ?? "");
  const code = String(err.details?.error_code ?? err.code ?? "");
  if (status === 402 || typ === "billing_error") return "abrechnung";
  if (/credit balance is too low/i.test(meldung)) return "abrechnung";
  // 03.10.2026 (gemessen): Organisations-Schlüssel ohne Arbeitsbereich — jede Anfrage 400. Das ist Zugang, nicht Zufall.
  if (status === 400 && /not scoped to a workspace|anthropic-workspace-id/i.test(meldung)) return "zugang";
  if (status === 429) return code === "enforced_spend_limit_reached" || /usage limits|spend limit/i.test(meldung) ? "abrechnung" : null;
  if (status === 401 || typ === "authentication_error") return "zugang";
  if (status === 403 && /api key|organization|organisation|disabled|suspended|deactivated|not authorized/i.test(meldung)) return "zugang";
  return null;
}

/** Ein Claude-Fehler in OpenAI-Form — die Aufrufer lesen `error.message`. Rein. */
export function alsOpenAiFehler(status: number, json: any, text: string): any {
  const err = json?.error ?? {};
  return { error: { message: `Claude (HTTP ${status}): ${String(err.message ?? text ?? "").slice(0, 400)}`, type: String(err.type ?? "claude_error"), code: String(err.details?.error_code ?? err.type ?? status) } };
}

// ── Kosten ─────────────────────────────────────────────────────────────────
/** US-$ je 1 Mio. Tokens (platform.claude.com, 03.10.2026); lesen = Cache-Treffer. */
const CLAUDE_PREIS: Record<string, { ein: number; aus: number; lesen: number }> = {
  "claude-fable-5-1": { ein: 10, aus: 50, lesen: 0.25 },
  "claude-opus-5-5": { ein: 4, aus: 20, lesen: 0.2 },
  "claude-sonnet-5-5": { ein: 2, aus: 10, lesen: 0.2 },
  "claude-haiku-4-5": { ein: 1, aus: 5, lesen: 0.1 },
};

function claudePreis(modell: string): { ein: number; aus: number; lesen: number } {
  const m = String(modell || "").replace(/-\d{8}$/, "");
  return CLAUDE_PREIS[m] ?? CLAUDE_PREIS[CLAUDE_GROSS_VORGABE];
}

/**
 * Kosten eines Claude-Aufrufs in Cent (dieselbe Hausrechnung wie die OpenAI-Tabelle: $ ≈ €), oder null, wenn die
 * Zählung nicht von Claude kommt. Eingabe, Cache-Schreiben (×1,25), Cache-Lesen und Ausgabe getrennt. Rein.
 */
export function claudeKostenCents(modell: string, usage: any): number | null {
  if (usage?._anbieter !== "claude") return null;
  const p = claudePreis(String(usage._modell ?? modell));
  const ein = Number(usage._eingabe ?? usage.prompt_tokens ?? 0);
  const cw = Number(usage._cache_schreiben ?? 0);
  const cr = Number(usage._cache_lesen ?? 0);
  const aus = Number(usage.completion_tokens ?? usage.output_tokens ?? 0);
  return (ein * p.ein + cw * p.ein * 1.25 + cr * p.lesen + aus * p.aus) / 10_000;
}

/** Ein OpenAI-Modellname in der Nutzungstabelle, während Claude trägt: das Claude-Modell, das wirklich lief. */
export function nutzungsModell(modell: string): string {
  const m = String(modell || "");
  if (aktiverAnbieter() !== "claude" || /^claude-/.test(m) || /whisper|transcribe|tts|embedding/i.test(m) || m === "-") return m;
  return claudeModellFuer(m);
}
