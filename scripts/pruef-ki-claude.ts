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
  // Ohne Claudes Rohblöcke wird der Werkzeugverlauf zu Text (Opus 5.5 kann Denken nicht abschalten — nie ein tool_use ohne Denkblöcke).
  pruef("B3 Werkzeugaufruf ohne Rohblöcke → Text, kein tool_use", a1.messages[1].role === "assistant" && !a1.messages[1].content.some((b: any) => b.type === "tool_use") && a1.messages[1].content.some((b: any) => b.text === '[Werkzeugaufruf akte({"id":5})]'), a1.messages[1].content);
  pruef("B4 Werkzeugergebnis → Text in user", a1.messages[2].role === "user" && a1.messages[2].content[0].type === "text" && /\[Ergebnis akte: \{\\"ok\\":true\}\]/.test(JSON.stringify(a1.messages[2].content[0])), a1.messages[2].content);
  pruef("B5 Opus: nie ein thinking-Feld", a1.thinking === undefined);
  pruef("B6 Aufwand low in output_config, nicht oben", a1.output_config?.effort === "low" && a1.effort === undefined);
  pruef("B7 festes Format → output_config", a1.output_config?.format?.type === "json_schema");
  pruef("B8 Schema geglättet (minLength/maxLength/minimum weg)", !JSON.stringify(a1.output_config.format.schema).match(/minLength|maxLength|minimum/) && a1.output_config.format.schema.additionalProperties === false);
  pruef("B9 Werkzeug-Schema bleibt", a1.tools[0].name === "akte" && a1.tools[0].input_schema.type === "object" && a1.tool_choice.type === "auto");
  pruef("B10 Opus denkt immer → max_tokens ≥ 8000", a1.max_tokens === 8000, a1.max_tokens);
  pruef("B11 Ende nie assistant", a1.messages[a1.messages.length - 1].role === "user");
  pruef("B12 Antwortform schema", b1.json === "schema");

  const roh = [{ type: "thinking", thinking: "x", signature: "s" }, { type: "tool_use", id: "toolu_9", name: "akte", input: {} }];
  const b2 = C.chatNachClaude({ model: "gpt-5.5", messages: [
    { role: "user", content: "Hi" },
    { role: "assistant", content: null, tool_calls: [{ id: "toolu_9", type: "function", function: { name: "akte", arguments: "{}" } }], _claude_inhalt: roh },
    { role: "tool", tool_call_id: "toolu_9", content: "ok" },
  ], tools: [{ type: "function", function: { name: "akte", parameters: { type: "object", properties: {} } } }] });
  pruef("B13b Rohblöcke → tool_result-Block", b2.anfrage.messages[2].content[0].type === "tool_result" && b2.anfrage.messages[2].content[0].tool_use_id === "toolu_9");
  // Letzte Runde ohne Werkzeuge (Postmeister „schreib jetzt die Antwort“): Rohblöcke würden die Signatur brechen → Text.
  const b2b = C.chatNachClaude({ model: "gpt-5.5", messages: [
    { role: "system", content: "Auftrag" }, { role: "user", content: "Hi" },
    { role: "assistant", content: null, tool_calls: [{ id: "toolu_9", type: "function", function: { name: "akte", arguments: "{}" } }], _claude_inhalt: roh },
    { role: "tool", tool_call_id: "toolu_9", content: "ok" },
    { role: "system", content: "Jetzt im Schema antworten" },
  ] });
  pruef("B13c ohne Werkzeuge: Rohblöcke → Text, kein Denkblock", !JSON.stringify(b2b.anfrage.messages).includes('"thinking"') && !JSON.stringify(b2b.anfrage.messages).includes("tool_use") && /Werkzeugaufruf akte/.test(JSON.stringify(b2b.anfrage.messages)));
  pruef("B13d späterer System-Hinweis geht in den Verlauf, System bleibt", b2b.anfrage.system === "Auftrag" && /\[Hinweis\] Jetzt im Schema antworten/.test(JSON.stringify(b2b.anfrage.messages)));
  pruef("B13 Rohblöcke kommen unverändert zurück (Denken bleibt an)", b2.anfrage.messages[1].content === roh || JSON.stringify(b2.anfrage.messages[1].content) === JSON.stringify(roh));
  pruef("B14 mit Rohblöcken kein Denken-aus", !b2.anfrage.thinking);
  pruef("B15 mit Denken max_tokens ≥ 8000", b2.anfrage.max_tokens >= 8000);

  const b3 = C.chatNachClaude({ model: "gpt-4.1-mini", temperature: 0, messages: [
    { role: "user", content: [{ type: "text", text: "Lies das" }, { type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } }] },
    { role: "assistant", content: "Vorbefüllt" },
  ], response_format: { type: "json_object" } });
  pruef("B16 Bild als base64-Block", b3.anfrage.messages[0].content[1].type === "image" && b3.anfrage.messages[0].content[1].source.media_type === "image/png");
  pruef("B17 Sonnet: Temperatur fällt weg, Denken bleibt adaptiv", b3.anfrage.model === "claude-sonnet-5-5" && b3.anfrage.temperature === undefined && b3.anfrage.thinking === undefined);
  pruef("B18 json_object → Anweisung an der letzten Nachricht, nicht im System", /JSON-Objekt/.test(JSON.stringify(b3.anfrage.messages[b3.anfrage.messages.length - 1])) && !/JSON-Objekt/.test(String(b3.anfrage.system ?? "")) && b3.json === "objekt");
  pruef("B19 assistant am Ende → user angehängt", b3.anfrage.messages[b3.anfrage.messages.length - 1].role === "user");

  const b4 = C.chatNachClaude({ model: "claude-haiku-4-5-20251001", reasoning_effort: "high", messages: [{ role: "user", content: "x" }] });
  pruef("B20 Haiku: kein effort, kein thinking", b4.anfrage.effort === undefined && b4.anfrage.output_config === undefined && b4.anfrage.thinking === undefined && b4.anfrage.max_tokens === 16000);
  const b4b = C.chatNachClaude({ model: "claude-haiku-4-5-20251001", temperature: 0.3, messages: [{ role: "user", content: "x" }] });
  pruef("B20b Haiku behält die Temperatur", b4b.anfrage.temperature === 0.3);
  const b4c = C.chatNachClaude({ model: "gpt-4.1-mini", reasoning_effort: "medium", max_tokens: 200, messages: [{ role: "user", content: "x" }] }, { denkenAus: true });
  pruef("B20c Sonnet + denkenAus → between_tools, Boden 1024", b4c.anfrage.thinking?.type === "between_tools" && Object.keys(b4c.anfrage.thinking).length === 1 && b4c.anfrage.max_tokens === 1024 && b4c.anfrage.output_config?.effort === "medium");
  const b4d = C.chatNachClaude({ model: "gpt-4.1-mini", reasoning_effort: "max", messages: [{ role: "user", content: "x" }] }, { denkenAus: true });
  pruef("B20d Sonnet mit Aufwand max → kein between_tools", b4d.anfrage.thinking === undefined && b4d.anfrage.output_config?.effort === "max");
  const b4e = C.chatNachClaude({ model: "gpt-5.5", messages: [{ role: "user", content: "x" }] }, { denkenAus: true });
  pruef("B20e Opus + denkenAus → kein thinking, Aufwand low", b4e.anfrage.thinking === undefined && b4e.anfrage.output_config?.effort === "low");
  const b5 = C.chatNachClaude({ model: "gpt-5.5", messages: [{ role: "assistant", content: "Hallo" }, { role: "user", content: "Antwort" }] });
  pruef("B21 Beginn immer user", b5.anfrage.messages[0].role === "user");
  const b6 = C.chatNachClaude({ model: "gpt-5.5", messages: [{ role: "system", content: "x".repeat(7000) }, { role: "user", content: "a" }] });
  pruef("B22 langer Auftrag wird zwischengespeichert", Array.isArray(b6.anfrage.system) && b6.anfrage.system[0].cache_control?.type === "ephemeral");
  const b7 = C.chatNachClaude({ model: "gpt-5.5", messages: [{ role: "user", content: "a" }], tools: [{ type: "web_search" }], tool_choice: "required" });
  pruef("B23 Websuche → neueste Fassung, required → auto + Hinweis", b7.anfrage.tools[0].type === "web_search_20260209" && b7.anfrage.tool_choice.type === "auto" && /eines der Werkzeuge/.test(JSON.stringify(b7.anfrage.messages)));
  const b8 = C.chatNachClaude({ model: "gpt-5.5", messages: [{ role: "user", content: "a" }], tools: [{ type: "function", function: { name: "x", parameters: {} } }], tool_choice: { type: "function", function: { name: "x" } } });
  pruef("B24 genanntes Werkzeug → auto + „Verwende jetzt das Werkzeug“", b8.anfrage.tool_choice.type === "auto" && /Verwende jetzt das Werkzeug „x“/.test(JSON.stringify(b8.anfrage.messages)));
  const b9 = C.alsAnweisung(b1);
  pruef("B25 Ersatzanweisung: Format weg, Aufwand bleibt, Schema an der letzten Nachricht, System unverändert",
    !b9.anfrage.output_config?.format && b9.anfrage.output_config?.effort === "low" && /JSON-Schema/.test(JSON.stringify(b9.anfrage.messages[b9.anfrage.messages.length - 1])) && b9.anfrage.system === a1.system && b9.json === "objekt");
  pruef("B26 Ersatz ändert das Original nicht", !/JSON-Schema/.test(JSON.stringify(b1.anfrage.messages)));
  pruef("B27 Leerraum im base64 fällt weg", C.chatNachClaude({ model: "gpt-5.5", messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: "data:image/png;base64,AA\nAA" } }] }] }).anfrage.messages[0].content[0].source.data === "AAAA");
  const b29 = C.chatNachClaude({ model: "gpt-4.1", temperature: 0, messages: [{ role: "user", content: "lies" }] });
  pruef("B29 Temperatur 0 ohne Werkzeuge → Aufwand low (Auslesen)", b29.anfrage.output_config?.effort === "low" && b29.anfrage.temperature === undefined);
  pruef("B30 ohne max_tokens → 16000", C.chatNachClaude({ model: "gpt-5.5", messages: [{ role: "user", content: "x" }] }).anfrage.max_tokens === 16000);
  const b31 = C.chatNachClaude({ model: "gpt-5.5", messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: "data:application/pdf;name=a.pdf;base64,JVBE" } }] }] });
  pruef("B31 Daten-URL mit Parametern", b31.anfrage.messages[0].content[0].type === "document" && b31.anfrage.messages[0].content[0].source.data === "JVBE");
  const b32 = C.chatNachClaude({ model: "gpt-5.5", messages: [{ role: "user", content: [{ type: "file", file: { filename: "scan.png", file_data: "iVBORw0K" } }] }] });
  pruef("B32 rohes base64 mit .png → Bild", b32.anfrage.messages[0].content[0].type === "image" && b32.anfrage.messages[0].content[0].source.media_type === "image/png");
  pruef("B28 denkArt", C.denkArt("claude-opus-5-5") === "immer" && C.denkArt("claude-sonnet-5-5") === "abschaltbar" && C.denkArt("claude-haiku-4-5-20251001") === "ohne" && C.denkArt("claude-fable-5-1") === "immer");

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
  pruef("C7 gültiges JSON mit ``` im Wert bleibt", C.jsonKern('{"antwort":"Bitte so: ```IBAN DE00``` eintragen","n":1}') === '{"antwort":"Bitte so: ```IBAN DE00``` eintragen","n":1}');
  const c8 = C.claudeNachChat({ id: "m", content: [
    { type: "server_tool_use", id: "s", name: "web_search", input: {} }, { type: "web_search_tool_result", tool_use_id: "s", content: [] },
    { type: "text", text: '{"firmen":[{"name":"' }, { type: "text", text: "Muster GmbH", citations: [{}] }, { type: "text", text: '","ort":"' }, { type: "text", text: "Berlin", citations: [{}] }, { type: "text", text: '"}]}' },
  ], stop_reason: "end_turn", usage: {} }, { json: "objekt", modell: "x" });
  pruef("C8 JSON aus Beleg-Bruchstücken zusammengesetzt", c8.choices[0].message.content === '{"firmen":[{"name":"Muster GmbH","ort":"Berlin"}]}', c8.choices[0].message.content);

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
  pruef("E9 gesperrte Organisation (400) → zugang", fe(400, "invalid_request_error", "This organization has been disabled.") === "zugang");
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

  // Selbstkorrektur: Claude nennt den richtigen Denk-Wert (gemessen 03.10.) → gemerkt, einmal neu.
  P.kiWeicheZuruecksetzen();
  rufe.length = 0;
  antworten = [
    () => json({ type: "error", error: { type: "invalid_request_error", message: 'To turn thinking off on this model, send "thinking": {"type": "between_tools"} instead of {"type": "disabled"}.' } }, 400),
    () => claudeText("ok"), () => claudeText("ok2"),
  ];
  const g11 = await P.claudeSendenFuerPruefstand({ model: "claude-sonnet-5-5", max_tokens: 1024, thinking: { type: "disabled" }, messages: [{ role: "user", content: "x" }] });
  pruef("G11 Denk-Hinweis übernommen und neu gesendet", g11.status === 200 && rufe.length === 2 && rufe[1].body.thinking?.type === "between_tools", rufe.map((r) => r.body?.thinking));
  rufe.length = 0;
  const g12 = await P.claudeSendenFuerPruefstand({ model: "claude-sonnet-5-5", max_tokens: 1024, thinking: { type: "disabled" }, messages: [{ role: "user", content: "y" }] });
  pruef("G12 gemerkt: nächster Aufruf gleich richtig", g12.status === 200 && rufe.length === 1 && rufe[0].body.thinking?.type === "between_tools");
  pruef("G13 denkHinweis liest den Satz", JSON.stringify(P.denkHinweis('send "thinking": {"type": "between_tools"} instead of {"type": "disabled"}')) === JSON.stringify({ neu: "between_tools", alt: "disabled" }));
  rufe.length = 0;
  antworten = [() => json({ type: "error", error: { type: "invalid_request_error", message: "output_config.effort: Extra inputs are not permitted" } }, 400), () => claudeText("ok"), () => claudeText("ok2")];
  const g14 = await P.openaiFetch("pruef", "/chat/completions", { method: "POST", body: JSON.stringify({ model: "gpt-5.5", reasoning_effort: "low", messages: [{ role: "user", content: "z" }] }) });
  pruef("G14 Aufwand abgelehnt → ohne Aufwand neu", g14.ok && rufe.length === 2 && rufe[0].body.output_config?.effort === "low" && rufe[1].body.output_config === undefined);
  rufe.length = 0;
  await P.openaiFetch("pruef", "/chat/completions", { method: "POST", body: JSON.stringify({ model: "gpt-5.5", reasoning_effort: "low", messages: [{ role: "user", content: "z2" }] }) });
  pruef("G14b gemerkt: Aufwand gleich weg", rufe.length === 1 && rufe[0].body.output_config === undefined);
  rufe.length = 0;
  antworten = [() => json({ type: "error", error: { type: "invalid_request_error", message: '"thinking.type.disabled" is not supported for this model. Use "thinking.type.adaptive" and "output_config.effort"' } }, 400), () => claudeText("ok")];
  const g15 = await P.claudeSendenFuerPruefstand({ model: "claude-opus-5-5", max_tokens: 1024, thinking: { type: "disabled" }, messages: [{ role: "user", content: "x" }] });
  pruef("G15 Opus-Meldung ohne Hinweis → Denk-Feld weg, neu", g15.status === 200 && rufe.length === 2 && rufe[1].body.thinking === undefined);
  rufe.length = 0;
  antworten = [() => json({ type: "error", error: { type: "invalid_request_error", message: "tools.0: Input tag 'web_search_20260209' found using 'type' does not match any of the expected tags" } }, 400), () => claudeText("{\"firmen\":[]}")];
  const g16 = await P.openaiFetch("radar", "/responses", { method: "POST", body: JSON.stringify({ model: "gpt-5.5", input: "x", tools: [{ type: "web_search" }], text: { format: { type: "json_schema", name: "r", schema: { type: "object", properties: { firmen: { type: "array", items: { type: "string" } } } } } } }) });
  pruef("G16 neue Websuche abgelehnt → alte Fassung", g16.ok && rufe.length === 2 && rufe[1].body.tools[0].type === "web_search_20250305");
  rufe.length = 0;
  antworten = [
    () => json({ id: "m", type: "message", model: "claude-opus-5-5", content: [{ type: "server_tool_use", id: "s1", name: "web_search", input: {} }, { type: "text", text: "Zwischenstand" }], stop_reason: "pause_turn", usage: { input_tokens: 10, output_tokens: 5 } }),
    () => claudeText("{\"firmen\":[\"A\"]}"),
  ];
  const g17 = await P.openaiFetch("radar", "/responses", { method: "POST", body: JSON.stringify({ model: "gpt-5.5", input: "x", tools: [{ type: "web_search" }], text: { format: { type: "json_schema", name: "r", schema: { type: "object", properties: { firmen: { type: "array", items: { type: "string" } } } } } } }) });
  const g17j: any = await g17.json();
  pruef("G17 pause_turn → fortgesetzt, Endantwort gelesen", rufe.length === 2 && rufe[1].body.messages[rufe[1].body.messages.length - 1].role === "assistant" && g17j.output_text === "{\"firmen\":[\"A\"]}", { n: rufe.length, t: g17j.output_text });
  rufe.length = 0;
  antworten = [() => json({ type: "error", error: { type: "invalid_request_error", message: "messages.1.content.0: unexpected" } }, 400)];
  const g18 = await P.openaiFetch("pruef", "/chat/completions", { method: "POST", body: JSON.stringify({ model: "gpt-5.5", messages: [{ role: "user", content: "x" }], response_format: { type: "json_schema", json_schema: { name: "a", schema: { type: "object", properties: {} } } } }) });
  pruef("G18 anderer 400 → kein sinnloser Format-Ersatz", g18.status === 400 && rufe.length === 1);
  // Denk-Signatur passt nicht → einmal ohne Rohblöcke (Verlauf als Text).
  rufe.length = 0;
  antworten = [() => json({ type: "error", error: { type: "invalid_request_error", message: "Invalid `signature` in `thinking` block: bound to a different conversation" } }, 400), () => claudeText("ok")];
  const g19 = await P.openaiFetch("postmeister", "/chat/completions", { method: "POST", body: JSON.stringify({ model: "gpt-5.5", messages: [
    { role: "user", content: "Hi" },
    { role: "assistant", content: null, tool_calls: [{ id: "toolu_9", type: "function", function: { name: "akte", arguments: "{}" } }], _claude_inhalt: roh },
    { role: "tool", tool_call_id: "toolu_9", content: "ok" },
  ], tools: [{ type: "function", function: { name: "akte", parameters: { type: "object", properties: {} } } }] }) });
  pruef("G19 Signatur-Fehler → Verlauf als Text, neu", g19.ok && rufe.length === 2 && JSON.stringify(rufe[0].body.messages).includes('"thinking"') && !JSON.stringify(rufe[1].body.messages).includes('"thinking"'));
  // Ratenlimit auch nach Wiederholungen → „drossel“ (wie eine Pause: liegen lassen), nichts gespeichert.
  rufe.length = 0;
  const limit = () => json({ type: "error", error: { type: "rate_limit_error", message: "Number of request tokens has exceeded your per-minute rate limit" } }, 429, { "retry-after": "1" });
  antworten = [limit, limit, limit, limit];
  let g20: any = null;
  try { await P.openaiFetch("mara-aktion", "/chat/completions", { method: "POST", body: JSON.stringify({ model: "gpt-5.5", messages: [{ role: "user", content: "x" }] }) }); } catch (e) { g20 = e; }
  P.kiPauseZwischenspeicherLeeren();
  pruef("G20 Ratenlimit → KiPausiertFehler „drossel“, keine gespeicherte Pause", P.istKiPause(g20) && g20?.art === "drossel" && rufe.length === 4 && (await P.kiPausiert("claude")) === false, { n: rufe.length, art: g20?.art });
  // pause_turn, Fortsetzung scheitert an Guthaben → Pause, kein doppelter Text.
  P.kiPauseProduktionSimulieren(false);
  rufe.length = 0;
  antworten = [
    () => json({ id: "m", type: "message", model: "claude-opus-5-5", content: [{ type: "text", text: "Zwischenstand. " }], stop_reason: "pause_turn", usage: {} }),
    () => json({ type: "error", error: { type: "invalid_request_error", message: "Your credit balance is too low to access the Anthropic API." } }, 400),
  ];
  let g21: any = null;
  try { await P.openaiFetch("radar", "/responses", { method: "POST", body: JSON.stringify({ model: "gpt-5.5", input: "x", tools: [{ type: "web_search" }] }) }); } catch (e) { g21 = e; }
  pruef("G21 pause_turn + Guthaben leer → Pause statt halber Antwort", P.istKiPause(g21) && g21?.art === "abrechnung", String(g21));
  P.kiPauseZwischenspeicherLeeren();
  P.kiPauseProduktionSimulieren(null);
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

  // ── J: A/B-Test Mara (E-280) und interne Dienste auf Sonnet ──────────────
  const gruppen = { opus: 0, sonnet: 0 } as Record<string, number>;
  for (let i = 1; i <= 10_000; i++) gruppen[C.maraGruppe(i) as string]++;
  pruef("J1 A/B etwa 50/50 (10.000 Personen)", gruppen.opus > 4_800 && gruppen.sonnet > 4_800, gruppen);
  pruef("J2 fest je Person", C.maraGruppe(13411) === C.maraGruppe("13411") && C.maraGruppe(13411) === C.maraGruppe(13411));
  pruef("J3 ohne Person keine Gruppe", C.maraGruppe(null) === null && C.maraModell(null, "gpt-5.5") === "gpt-5.5");
  const opusPerson = Array.from({ length: 50 }, (_, i) => i + 1).find((i) => C.maraGruppe(i) === "opus")!;
  const sonnetPerson = Array.from({ length: 50 }, (_, i) => i + 1).find((i) => C.maraGruppe(i) === "sonnet")!;
  pruef("J4 maraModell je Gruppe", C.maraModell(opusPerson, "gpt-5.5") === "claude-opus-5-5" && C.maraModell(sonnetPerson, "gpt-5.5") === "claude-sonnet-5-5");
  process.env.MARA_AB = "aus";
  pruef("J5 MARA_AB=aus → kein Test", C.maraModell(sonnetPerson, "gpt-5.5") === "gpt-5.5");
  delete process.env.MARA_AB;
  pruef("J6 interne Dienste → Sonnet, Kundendienste → Opus", C.claudeModellFuer("gpt-5.5", "radar") === "claude-sonnet-5-5" && C.claudeModellFuer("gpt-5.5", "postmeister-einordnen") === "claude-sonnet-5-5" && C.claudeModellFuer("gpt-5.5", "mara-whatsapp") === "claude-opus-5-5" && C.claudeModellFuer("claude-opus-5-5", "ocr") === "claude-opus-5-5");
  rufe.length = 0;
  antworten = [() => claudeText("Seite 1")];
  await P.openaiFetch("ocr", "/responses", { method: "POST", body: JSON.stringify({ model: "gpt-4.1", input: "lies" }) });
  pruef("J7 Texterkennung läuft auf Sonnet", rufe[0]?.body?.model === "claude-sonnet-5-5", rufe[0]?.body?.model);
  const A = await import("../server/lib/fiaon-postmeister-agent");
  rufe.length = 0;
  antworten = [() => claudeText("{\"antwort\":\"ok\"}")];
  await A.kiAufruf({ dienst: "mara-whatsapp", modell: "gpt-5.5", nachrichten: [{ role: "user", content: "x" }], person: sonnetPerson });
  pruef("J8 kiAufruf mit Person der Sonnet-Gruppe → Sonnet", rufe[0]?.body?.model === "claude-sonnet-5-5", rufe[0]?.body?.model);
  rufe.length = 0;
  antworten = [() => claudeText("{\"antwort\":\"ok\"}")];
  await A.kiAufruf({ dienst: "mara-whatsapp", modell: "gpt-5.5", nachrichten: [{ role: "user", content: "x" }], person: opusPerson });
  pruef("J9 … der Opus-Gruppe → Opus", rufe[0]?.body?.model === "claude-opus-5-5", rufe[0]?.body?.model);

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
