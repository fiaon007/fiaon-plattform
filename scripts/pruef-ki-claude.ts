// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-279: DIE KI-WEICHE (OpenAI-Format ↔ Claude)
//
// Justin, 03.10.2026: „Ok ich denke wir werden OPENAI wechseln …“ — OpenAI hat das Konto deaktiviert, Claude
// trägt. Geprüft: Übersetzung hin und zurück (Chat, Responses, Datenstrom), Werkzeugrunden mit Denkblöcken,
// festes Format mit Ersatz, Bilder/PDF, Websuche, Fehler → Pause JE ANBIETER, Kosten, und dass Sprache
// (Whisper) bei OpenAI bleibt. Kein Netz: fetch ist eine Attrappe.
//
// NUR gegen die lokale Test-DB (die Pause liest fiaon_settings):
//   env -i PATH="$PATH" HOME="$HOME" DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand?sslmode=require' \
//     SESSION_SECRET=pruefstand-nur-lokal DOTENV_CONFIG_PATH=/dev/null npx tsx scripts/pruef-ki-claude.ts
// ═══════════════════════════════════════════════════════════════════════════
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "WHATSAPP_TOKEN", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GMAIL_CLIENT_SECRET"]) {
  if (process.env[k]) { console.error(`${k} ist gesetzt — Abbruch, der Prüfstand nutzt nur Attrappen.`); process.exit(3); }
}
if (!/127\.0\.0\.1:54329\//.test(String(process.env.DATABASE_URL))) { console.error("NUR gegen die lokale Test-DB!"); process.exit(3); }
process.env.CRONS = "aus";
process.env.OPENAI_API_KEY = "sk-pruef-openai-e279";
process.env.ANTHROPIC_API_KEY = "sk-ant-pruef-e279";

let ok = 0, fehler = 0;
function pruef(name: string, bed: unknown, info?: unknown) {
  if (bed) { ok++; return; }
  fehler++;
  console.log(`✗ ${name}${info !== undefined ? ` — ${typeof info === "string" ? info : JSON.stringify(info).slice(0, 400)}` : ""}`);
}

type Ruf = { url: string; methode: string; kopf: Record<string, string>; body: any };
const rufe: Ruf[] = [];
let antworten: Array<(r: Ruf) => Response> = [];
const json = (x: unknown, status = 200, kopf: Record<string, string> = {}) =>
  new Response(JSON.stringify(x), { status, headers: { "content-type": "application/json", ...kopf } });
(globalThis as any).fetch = async (input: any, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : String(input?.url ?? "");
  const kopf: Record<string, string> = {};
  new Headers((init?.headers as any) ?? (input?.headers as any) ?? {}).forEach((v, k) => { kopf[k] = v; });
  let body: any = null;
  try { body = init?.body ? JSON.parse(String(init.body)) : null; } catch { body = String(init?.body ?? ""); }
  const r: Ruf = { url, methode: String(init?.method ?? input?.method ?? "GET"), kopf, body };
  rufe.push(r);
  const f = antworten.shift();
  if (!f) return json({ type: "error", error: { type: "api_error", message: "keine Attrappe" } }, 500);
  return f(r);
};
const claudeText = (text: string, extra: any = {}) => json({
  id: "msg_1", type: "message", role: "assistant", model: "claude-opus-5-5",
  content: [{ type: "thinking", thinking: "…", signature: "sig" }, { type: "text", text }],
  stop_reason: "end_turn", usage: { input_tokens: 1000, output_tokens: 200, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }, ...extra,
});

async function main() {
  const C = await import("../server/lib/fiaon-ki-claude");
  const P = await import("../server/lib/fiaon-ki-pause");
  const S = await import("../server/lib/fiaon-postmeister-schema");
  const { sqlPool } = await import("../server/lib/db-pool");
  await sqlPool`DELETE FROM fiaon_settings WHERE key = 'ki_pause'`;
  P.kiPauseZwischenspeicherLeeren();

  // ── A: Anbieter und Modelle ─────────────────────────────────────────────
  pruef("A1 Claude trägt mit Schlüssel", C.aktiverAnbieter() === "claude");
  process.env.KI_ANBIETER = "openai";
  pruef("A2 KI_ANBIETER=openai schaltet zurück", C.aktiverAnbieter() === "openai");
  delete process.env.KI_ANBIETER;
  pruef("A3 gpt-5.5 → Opus 5.5", C.claudeModellFuer("gpt-5.5") === "claude-opus-5-5");
  pruef("A4 gpt-4.1-mini → Sonnet 5.5", C.claudeModellFuer("gpt-4.1-mini") === "claude-sonnet-5-5");
  pruef("A5 claude-* bleibt", C.claudeModellFuer("claude-haiku-4-5-20251001") === "claude-haiku-4-5-20251001");
  process.env.CLAUDE_MODELL_GROSS = "claude-fable-5-1";
  pruef("A6 CLAUDE_MODELL_GROSS wirkt", C.claudeModellFuer("gpt-4o") === "claude-fable-5-1");
  delete process.env.CLAUDE_MODELL_GROSS;
  pruef("A7 Whisper nie an Claude", !C.claudeKannPfad("https://api.openai.com/v1/audio/transcriptions"));
  pruef("A8 Chat und Responses an Claude", C.claudeKannPfad("https://api.openai.com/v1/chat/completions") && C.claudeKannPfad("/responses"));
  pruef("A9 GET nie übersetzt", !C.claudeKannPfad("/responses", "GET"));

  // ── B: Chat → Claude ────────────────────────────────────────────────────
  const b1 = C.chatNachClaude({
    model: "gpt-5.5", reasoning_effort: "low", max_tokens: 3500,
    messages: [
      { role: "system", content: "Du bist Mara." }, { role: "developer", content: "Sie-Form." },
      { role: "user", content: "Hallo" },
      { role: "assistant", content: "Ich schaue nach.", tool_calls: [{ id: "call_1", type: "function", function: { name: "akte", arguments: "{\"id\":5}" } }] },
      { role: "tool", tool_call_id: "call_1", content: "{\"ok\":true}" },
    ],
    tools: [{ type: "function", function: { name: "akte", description: "Akte lesen", parameters: { type: "object", properties: { id: { type: "integer", minimum: 1 } }, required: ["id"] } } }],
    response_format: { type: "json_schema", json_schema: { name: "antwort", strict: true, schema: { type: "object", properties: { text: { type: "string", minLength: 10, maxLength: 900 }, n: { type: "integer", minimum: 0 } }, required: ["text", "n"], additionalProperties: false } } },
  });
  const a1 = b1.anfrage;
  pruef("B1 Modell übersetzt", a1.model === "claude-opus-5-5");
  pruef("B2 System + Developer zusammen", a1.system === "Du bist Mara.\n\nSie-Form.", a1.system);
  pruef("B3 Werkzeugaufruf → tool_use", a1.messages[1].role === "assistant" && a1.messages[1].content.some((b: any) => b.type === "tool_use" && b.id === "call_1" && b.input.id === 5));
  pruef("B4 Werkzeugergebnis → tool_result in user", a1.messages[2].role === "user" && a1.messages[2].content[0].type === "tool_result" && a1.messages[2].content[0].tool_use_id === "call_1");
  pruef("B5 Werkzeugverlauf ohne Rohblöcke → Denken aus", a1.thinking?.type === "disabled");
  pruef("B6 Aufwand low", a1.effort === "low");
  pruef("B7 festes Format → output_config", a1.output_config?.format?.type === "json_schema");
  pruef("B8 Schema geglättet (minLength/maxLength/minimum weg)", !JSON.stringify(a1.output_config.format.schema).match(/minLength|maxLength|minimum/) && a1.output_config.format.schema.additionalProperties === false);
  pruef("B9 Werkzeug-Schema bleibt", a1.tools[0].name === "akte" && a1.tools[0].input_schema.type === "object" && a1.tool_choice.type === "auto");
  pruef("B10 max_tokens ohne Denken wie gewünscht", a1.max_tokens === 3500, a1.max_tokens);
  pruef("B11 Ende nie assistant", a1.messages[a1.messages.length - 1].role === "user");
  pruef("B12 Antwortform schema", b1.json === "schema");

  const roh = [{ type: "thinking", thinking: "x", signature: "s" }, { type: "tool_use", id: "toolu_9", name: "akte", input: {} }];
  const b2 = C.chatNachClaude({ model: "gpt-5.5", messages: [
    { role: "user", content: "Hi" },
    { role: "assistant", content: null, tool_calls: [{ id: "toolu_9", type: "function", function: { name: "akte", arguments: "{}" } }], _claude_inhalt: roh },
    { role: "tool", tool_call_id: "toolu_9", content: "ok" },
  ] });
  pruef("B13 Rohblöcke kommen unverändert zurück (Denken bleibt an)", b2.anfrage.messages[1].content === roh || JSON.stringify(b2.anfrage.messages[1].content) === JSON.stringify(roh));
  pruef("B14 mit Rohblöcken kein Denken-aus", !b2.anfrage.thinking);
  pruef("B15 mit Denken max_tokens ≥ 8000", b2.anfrage.max_tokens >= 8000);

  const b3 = C.chatNachClaude({ model: "gpt-4.1-mini", temperature: 0, messages: [
    { role: "user", content: [{ type: "text", text: "Lies das" }, { type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } }] },
    { role: "assistant", content: "Vorbefüllt" },
  ], response_format: { type: "json_object" } });
  pruef("B16 Bild als base64-Block", b3.anfrage.messages[0].content[1].type === "image" && b3.anfrage.messages[0].content[1].source.media_type === "image/png");
  pruef("B17 temperature → Denken aus + Temperatur", b3.anfrage.thinking?.type === "disabled" && b3.anfrage.temperature === 0);
  pruef("B18 json_object → Anweisung im System", /JSON-Objekt/.test(String(b3.anfrage.system)) && b3.json === "objekt");
  pruef("B19 assistant am Ende → user angehängt", b3.anfrage.messages[b3.anfrage.messages.length - 1].role === "user");

  const b4 = C.chatNachClaude({ model: "claude-haiku-4-5-20251001", reasoning_effort: "high", messages: [{ role: "user", content: "x" }] });
  pruef("B20 Haiku: kein effort, kein thinking", b4.anfrage.effort === undefined && b4.anfrage.thinking === undefined);
  const b5 = C.chatNachClaude({ model: "gpt-5.5", messages: [{ role: "assistant", content: "Hallo" }, { role: "user", content: "Antwort" }] });
  pruef("B21 Beginn immer user", b5.anfrage.messages[0].role === "user");
  const b6 = C.chatNachClaude({ model: "gpt-5.5", messages: [{ role: "system", content: "x".repeat(7000) }, { role: "user", content: "a" }] });
  pruef("B22 langer Auftrag wird zwischengespeichert", Array.isArray(b6.anfrage.system) && b6.anfrage.system[0].cache_control?.type === "ephemeral");
  const b7 = C.chatNachClaude({ model: "gpt-5.5", messages: [{ role: "user", content: "a" }], tools: [{ type: "web_search" }], tool_choice: "required" });
  pruef("B23 Websuche → Claude-Websuche", b7.anfrage.tools[0].type === "web_search_20250305" && b7.anfrage.tool_choice.type === "any");
  const b8 = C.chatNachClaude({ model: "gpt-5.5", messages: [{ role: "user", content: "a" }], tools: [{ type: "function", function: { name: "x", parameters: {} } }], tool_choice: { type: "function", function: { name: "x" } } });
  pruef("B24 tool_choice Funktion → tool", b8.anfrage.tool_choice.type === "tool" && b8.anfrage.tool_choice.name === "x");
  const b9 = C.alsAnweisung(b1);
  pruef("B25 Ersatzanweisung: ohne output_config, Schema im System", !b9.anfrage.output_config && /JSON-Schema/.test(JSON.stringify(b9.anfrage.system)) && b9.json === "objekt");

  // ── C: Claude → Chat ────────────────────────────────────────────────────
  const c1 = C.claudeNachChat({ id: "m", model: "claude-opus-5-5", content: [{ type: "thinking", thinking: "t", signature: "s" }, { type: "text", text: "```json\n{\"text\":\"Hallo\"}\n```" }], stop_reason: "end_turn",
    usage: { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 2000, cache_read_input_tokens: 3000 } }, { json: "schema", modell: "claude-opus-5-5" });
  pruef("C1 JSON aus Codeblock", c1.choices[0].message.content === "{\"text\":\"Hallo\"}", c1.choices[0].message.content);
  pruef("C2 Zählwerte samt Cache", c1.usage.prompt_tokens === 5100 && c1.usage.completion_tokens === 50 && c1.usage._cache_lesen === 3000);
  pruef("C3 kein _claude_inhalt ohne Werkzeug", c1.choices[0].message._claude_inhalt === undefined);
  const c2 = C.claudeNachChat({ id: "m2", model: "claude-opus-5-5", content: roh, stop_reason: "tool_use", usage: {} }, { json: null, modell: "x" });
  pruef("C4 tool_use → tool_calls + Rohblöcke", c2.choices[0].message.tool_calls[0].id === "toolu_9" && c2.choices[0].finish_reason === "tool_calls" && c2.choices[0].message._claude_inhalt === roh);
  const c3 = C.claudeNachChat({ id: "m3", content: [{ type: "text", text: "abgeschn" }], stop_reason: "max_tokens", usage: {} }, { json: null, modell: "x" });
  pruef("C5 max_tokens → length", c3.choices[0].finish_reason === "length");
  pruef("C6 Prosa vor JSON", C.jsonKern("Hier: {\"a\":1} fertig") === "{\"a\":1}");

  // ── D: Responses ↔ Chat, Datenstrom ─────────────────────────────────────
  const d1 = C.responsesNachChat({ model: "gpt-5.5", instructions: "Anw", input: [
    { role: "user", content: [{ type: "input_text", text: "Lies" }, { type: "input_file", filename: "a.pdf", file_data: "data:application/pdf;base64,JVBERi0=" }] },
    { role: "assistant", content: "Moment" },
    { type: "function_call", call_id: "c1", name: "f", arguments: "{}" },
    { type: "function_call_output", call_id: "c1", output: "ok" },
  ], text: { format: { type: "json_schema", name: "z", schema: { type: "object", properties: {} } } }, reasoning: { effort: "medium" }, max_output_tokens: 16000 });
  pruef("D1 instructions → system", d1.messages[0].role === "system" && d1.messages[0].content === "Anw");
  pruef("D2 function_call hängt an assistant", d1.messages[2].role === "assistant" && d1.messages[2].tool_calls[0].id === "c1");
  pruef("D3 function_call_output → tool", d1.messages[3].role === "tool" && d1.messages[3].tool_call_id === "c1");
  pruef("D4 text.format → response_format", d1.response_format?.type === "json_schema" && d1.reasoning_effort === "medium" && d1.max_tokens === 16000);
  const d1c = C.chatNachClaude(d1);
  pruef("D5 PDF → document-Block", d1c.anfrage.messages[0].content.some((b: any) => b.type === "document" && b.source.media_type === "application/pdf"));
  const d2 = C.chatNachResponses(c2);
  pruef("D6 Chat → Responses: function_call", d2.output.some((o: any) => o.type === "function_call" && o.call_id === "toolu_9") && d2.status === "completed");
  const d3 = C.chatNachResponses(c3);
  pruef("D7 length → incomplete/max_output_tokens", d3.status === "incomplete" && d3.incomplete_details.reason === "max_output_tokens");
  const sse = C.chatAlsSse(c2);
  pruef("D8 Datenstrom mit tool_calls und [DONE]", /"tool_calls":\[\{"index":0,"id":"toolu_9"/.test(sse) && sse.trim().endsWith("data: [DONE]"));

  // ── E: Fehlerarten ──────────────────────────────────────────────────────
  const fe = (s: number, type: string, message: string, details?: any) => C.claudeFehlerArt(s, { type: "error", error: { type, message, ...(details ? { details } : {}) } });
  pruef("E1 401 → zugang", fe(401, "authentication_error", "invalid x-api-key") === "zugang");
  pruef("E2 Guthaben → abrechnung", fe(400, "invalid_request_error", "Your credit balance is too low to access the Anthropic API.") === "abrechnung");
  pruef("E3 Ausgabengrenze → abrechnung", fe(429, "rate_limit_error", "You have reached your API usage limits", { error_code: "enforced_spend_limit_reached" }) === "abrechnung");
  pruef("E4 Ratenlimit → null", fe(429, "rate_limit_error", "Number of request tokens has exceeded your per-minute rate limit") === null);
  pruef("E5 529 → null", fe(529, "overloaded_error", "Overloaded") === null);
  pruef("E6 übliche 400 → null", fe(400, "invalid_request_error", "messages: field required") === null);
  pruef("E7 HTML → null", C.claudeFehlerArt(502, "<html>bad gateway</html>") === null);
  pruef("E8 Organisations-Schlüssel ohne Arbeitsbereich → zugang", fe(400, "invalid_request_error", "This API key is not scoped to a workspace, so this request must include the anthropic-workspace-id header") === "zugang");

  // ── F: Kosten ───────────────────────────────────────────────────────────
  const k1 = C.claudeKostenCents("claude-opus-5-5", c1.usage);
  // 100×4 + 2000×4×1,25 + 3000×0,2 + 50×20 = 400 + 10000 + 600 + 1000 = 12000 → /10000 = 1,2 Cent
  pruef("F1 Opus mit Cache: 1,2 Cent", Math.abs((k1 ?? 0) - 1.2) < 1e-9, k1);
  pruef("F2 OpenAI-Zählung → null", C.claudeKostenCents("gpt-5.5", { prompt_tokens: 10 }) === null);
  pruef("F3 kostenCentsAus nimmt Claude-Preis", Math.abs(S.kostenCentsAus("gpt-5.5", c1.usage) - 1.2) < 1e-9);
  // Ein Modul, das seine Zählung selbst umbaut (OCR): gpt-5.5 + nur Ein/Aus → zum Opus-Preis
  pruef("F4 umgebaute Zählung → Claude-Preis des gelaufenen Modells", Math.abs(S.kostenCentsAus("gpt-5.5", { prompt_tokens: 1000, completion_tokens: 100 }) - (1000 * 4 + 100 * 20) / 10_000) < 1e-9);
  pruef("F5 Haiku mit Datum", Math.abs((C.claudeKostenCents("claude-haiku-4-5-20251001", { _anbieter: "claude", _modell: "claude-haiku-4-5-20251001", _eingabe: 10000, completion_tokens: 0 }) ?? 0) - 1) < 1e-9);

  // ── G: Netz über openaiFetch ────────────────────────────────────────────
  rufe.length = 0;
  antworten = [() => claudeText("{\"text\":\"Guten Tag\",\"n\":1}")];
  const g1 = await P.openaiFetch("pruef", "/chat/completions", { method: "POST", headers: { Authorization: "Bearer sk-pruef-openai-e279" }, body: JSON.stringify({
    model: "gpt-5.5", messages: [{ role: "user", content: "Hi" }],
    response_format: { type: "json_schema", json_schema: { name: "a", schema: { type: "object", properties: { text: { type: "string" } } } } },
  }) });
  const g1j: any = await g1.json();
  pruef("G1 geht an api.anthropic.com/v1/messages", rufe[0]?.url === "https://api.anthropic.com/v1/messages", rufe[0]?.url);
  pruef("G2 Kopf: x-api-key + anthropic-version, kein OpenAI-Schlüssel", rufe[0]?.kopf["x-api-key"] === "sk-ant-pruef-e279" && rufe[0]?.kopf["anthropic-version"] === "2023-06-01" && !rufe[0]?.kopf.authorization);
  pruef("G3 Antwort in Chat-Form", g1.ok && g1j.choices[0].message.content === "{\"text\":\"Guten Tag\",\"n\":1}" && g1j.usage._anbieter === "claude");

  rufe.length = 0;
  antworten = [() => claudeText("Texterkennung: Kontostand 12,00 €")];
  const g2 = await P.openaiFetch("ocr", "/responses", { method: "POST", body: JSON.stringify({
    model: "gpt-5.5", temperature: 0, max_output_tokens: 16000,
    input: [{ role: "user", content: [{ type: "input_image", image_url: "data:image/jpeg;base64,/9j/" }, { type: "input_text", text: "Lies" }] }],
  }) });
  const g2j: any = await g2.json();
  pruef("G4 Responses → output_text-Block", g2j.output?.[0]?.content?.[0]?.text === "Texterkennung: Kontostand 12,00 €" && g2j.usage.input_tokens === 1000);
  pruef("G5 Bild kam als image-Block an", rufe[0]?.body?.messages?.[0]?.content?.[0]?.type === "image");

  rufe.length = 0;
  antworten = [
    () => json({ type: "error", error: { type: "invalid_request_error", message: "output_config.format.schema: unsupported keyword" } }, 400),
    () => claudeText("{\"a\":1}"),
  ];
  const g3 = await P.openaiFetch("pruef", "/chat/completions", { method: "POST", body: JSON.stringify({
    model: "gpt-5.5", messages: [{ role: "user", content: "x" }],
    response_format: { type: "json_schema", json_schema: { name: "a", schema: { type: "object", properties: { a: { type: "integer" } } } } },
  }) });
  const g3j: any = await g3.json();
  pruef("G6 festes Format abgelehnt → zweiter Versuch ohne output_config", rufe.length === 2 && !rufe[1].body.output_config && g3j.choices[0].message.content === "{\"a\":1}");

  rufe.length = 0;
  antworten = [() => json({ type: "error", error: { type: "overloaded_error", message: "Overloaded" } }, 529), () => claudeText("ok")];
  const g4 = await P.openaiFetch("pruef", "/chat/completions", { method: "POST", body: JSON.stringify({ model: "gpt-5.5", messages: [{ role: "user", content: "x" }] }) });
  pruef("G7 überlastet → Wiederholung", g4.ok && rufe.length === 2);

  rufe.length = 0;
  antworten = [() => claudeText("Hallo Welt")];
  const g5 = await P.openaiFetch("copilot", "https://api.openai.com/v1/chat/completions", { method: "POST", body: JSON.stringify({ model: "gpt-4.1", stream: true, temperature: 0.2, messages: [{ role: "user", content: "x" }] }) });
  const g5t = await g5.text();
  pruef("G8 Datenstrom für den Copilot", g5.headers.get("content-type") === "text/event-stream" && /"content":"Hallo Welt"/.test(g5t) && /\[DONE\]/.test(g5t));

  rufe.length = 0;
  antworten = [
    () => json({ type: "error", error: { type: "invalid_request_error", message: "anthropic-workspace-id header is required for this API key" } }, 400),
    () => json({ data: [{ id: "wrkspc_pruef", name: "Default", archived_at: null }] }),
    () => claudeText("ok"),
  ];
  const g6 = await P.openaiFetch("pruef", "/chat/completions", { method: "POST", body: JSON.stringify({ model: "gpt-5.5", messages: [{ role: "user", content: "x" }] }) });
  pruef("G9 Organisations-Schlüssel: Arbeitsbereich ermittelt und mitgeschickt", g6.ok && /organizations\/workspaces/.test(rufe[1]?.url) && rufe[2]?.kopf["anthropic-workspace-id"] === "wrkspc_pruef");
  P.kiWeicheZuruecksetzen();

  rufe.length = 0;
  antworten = [() => json({ text: "Hallo" })];
  const g7 = await P.openaiFetch("transkript", "/audio/transcriptions", { method: "POST", body: "{}" });
  pruef("G10 Sprache bleibt bei OpenAI", g7.ok && rufe[0]?.url === "https://api.openai.com/v1/audio/transcriptions");

  // Gemessen 03.10.: Sonnet 5.5 lehnt „thinking: disabled“ ab und nennt den richtigen Wert → gemerkt, einmal neu.
  P.kiWeicheZuruecksetzen();
  rufe.length = 0;
  antworten = [
    () => json({ type: "error", error: { type: "invalid_request_error", message: 'To turn thinking off on this model, send "thinking": {"type": "between_tools"} instead of {"type": "disabled"}. The model does not think before responding.' } }, 400),
    () => claudeText("ok"),
    () => claudeText("ok2"),
  ];
  const g11 = await P.openaiFetch("pruef", "/chat/completions", { method: "POST", body: JSON.stringify({ model: "gpt-4.1-mini", temperature: 0, messages: [{ role: "user", content: "x" }] }) });
  pruef("G11 Denk-Hinweis übernommen und neu gesendet", g11.ok && rufe.length === 2 && rufe[0].body.thinking?.type === "disabled" && rufe[1].body.thinking?.type === "between_tools", rufe.map((r) => r.body?.thinking));
  rufe.length = 0;
  const g12 = await P.openaiFetch("pruef", "/chat/completions", { method: "POST", body: JSON.stringify({ model: "gpt-4.1-mini", temperature: 0, messages: [{ role: "user", content: "y" }] }) });
  pruef("G12 gemerkt: nächster Aufruf gleich richtig", g12.ok && rufe.length === 1 && rufe[0].body.thinking?.type === "between_tools");
  pruef("G13 denkHinweis liest den Satz", JSON.stringify(P.denkHinweis('send "thinking": {"type": "between_tools"} instead of {"type": "disabled"}')) === JSON.stringify({ neu: "between_tools", alt: "disabled" }));
  rufe.length = 0;
  antworten = [() => json({ type: "error", error: { type: "invalid_request_error", message: "temperature may only be set to 1 when thinking is enabled" } }, 400), () => claudeText("ok")];
  const g14 = await P.openaiFetch("pruef", "/chat/completions", { method: "POST", body: JSON.stringify({ model: "gpt-5.5", temperature: 0.2, messages: [{ role: "user", content: "z" }] }) });
  pruef("G14 Temperatur abgelehnt → ohne Temperatur neu", g14.ok && rufe.length === 2 && rufe[1].body.temperature === undefined);
  P.kiWeicheZuruecksetzen();

  // ── H: Pause je Anbieter ────────────────────────────────────────────────
  // Die alte OpenAI-Pause (wie in der Produktion seit 03.10. 05:15) hält Claude nicht an.
  await sqlPool`INSERT INTO fiaon_settings (key, value, updated_at) VALUES ('ki_pause', ${JSON.stringify({ an: true, art: "zugang", grund: "OpenAI lehnt ab", fehler: "account_deactivated", dienst: "postmeister-einordnen", seit: "2026-10-03T03:15:35.206Z", von: "automatisch", verlauf: [] })}, NOW())
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  P.kiPauseZwischenspeicherLeeren();
  pruef("H1 OpenAI-Pause: Claude nicht pausiert", (await P.kiPausiert()) === false);
  pruef("H2 OpenAI-Pause gilt für OpenAI", (await P.kiPausiert("openai")) === true);
  const sicht = await P.kiPauseLesen(true);
  pruef("H3 Ansicht: an=false, nebenPause openai", sicht.an === false && sicht.nebenPause?.anbieter === "openai");
  rufe.length = 0;
  let h4: any = null;
  try { await P.openaiFetch("transkript", "/audio/transcriptions", { method: "POST", body: "{}" }); } catch (e) { h4 = e; }
  pruef("H4 Whisper in der OpenAI-Pause: KiPausiertFehler, kein Netz", P.istKiPause(h4) && rufe.length === 0);
  antworten = [() => claudeText("läuft")];
  const h5 = await P.openaiFetch("mara-aktion", "/chat/completions", { method: "POST", body: JSON.stringify({ model: "gpt-5.5", messages: [{ role: "user", content: "x" }] }) });
  pruef("H5 Mara läuft trotz OpenAI-Pause", h5.ok);

  // Claude lehnt ab (lokal: Pause nur in diesem Prozess) → KiPausiertFehler
  P.kiPauseProduktionSimulieren(false);
  rufe.length = 0;
  antworten = [
    () => json({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }, 401),
    () => json({ type: "error", error: { type: "authentication_error", message: "invalid bearer" } }, 401),
  ];
  let h6: any = null;
  try { await P.openaiFetch("postmeister", "/chat/completions", { method: "POST", body: JSON.stringify({ model: "gpt-5.5", messages: [{ role: "user", content: "x" }] }) }); } catch (e) { h6 = e; }
  pruef("H6 401: einmal Bearer probiert, dann Pause", rufe.length === 2 && rufe[1].kopf.authorization === "Bearer sk-ant-pruef-e279" && P.istKiPause(h6), { rufe: rufe.length, h6: String(h6) });
  pruef("H7 Meldung nennt Claude", /Claude \(Anthropic\)/.test(String(h6?.message)), String(h6?.message));
  pruef("H8 jetzt ist Claude pausiert (dieser Prozess)", (await P.kiPausiert("claude")) === true);
  P.kiPauseZwischenspeicherLeeren();
  P.kiPauseProduktionSimulieren(null);

  // Pause von Hand (wie am 03.10. bis zur Arbeitsbereich-Kennung): Aktivieren prüft den TRAGENDEN Anbieter (Claude).
  await sqlPool`DELETE FROM fiaon_settings WHERE key = 'ki_pause'`;
  P.kiPauseZwischenspeicherLeeren();
  await P.pausieren({ art: "hand", fehler: "bis zur Kennung angehalten", dienst: "ki-weiche", von: "Prüfstand" });
  pruef("H9 Pause von Hand hält auch Claude", (await P.kiPausiert("claude")) === true && (await P.kiPauseLesen(true)).an === true);
  rufe.length = 0;
  antworten = [() => claudeText("OK")];
  const h10 = await P.aktivieren("Prüfstand", { nachholen: false });
  pruef("H10 Aktivieren nach Hand-Pause: Probe bei Claude, Pause weg", h10.ok && rufe[0]?.url === "https://api.anthropic.com/v1/messages" && (await P.kiPausiert("claude")) === false, { ok: h10.ok, url: rufe[0]?.url, f: h10.fehler });

  // ── I: Quelltext ────────────────────────────────────────────────────────
  const { readFileSync } = await import("node:fs");
  const weiche = readFileSync("server/lib/fiaon-ki-claude.ts", "utf8");
  pruef("I1 Weiche ohne Netz und ohne Importe", !/\bfetch\(/.test(weiche) && !/^import /m.test(weiche));
  pruef("I2 Weiche ohne OpenAI-/Anthropic-URL", !/https:\/\/api\.(openai|anthropic)\.com/.test(weiche));

  await sqlPool`DELETE FROM fiaon_settings WHERE key = 'ki_pause'`;
  await sqlPool.end({ timeout: 5 }).catch(() => {});
  console.log(fehler ? `ROT: ${fehler} fehlgeschlagen, ${ok} bestanden` : `GRÜN: ${ok} bestanden, 0 fehlgeschlagen`);
  process.exit(fehler ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
