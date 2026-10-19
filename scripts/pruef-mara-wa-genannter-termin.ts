// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-401 (2/6, 19.10.2026): WHATSAPP-MARA LIEST DAS TEAM UND TRÄGT GENANNTE TERMINE EIN
//
// Justin (19.10.2026): „Mach Mara und co fix fertig, damit die wirklich GUT arbeitet und selbst arbeitet.“ E-395 hat den
// genannten Termin für die Mail gebaut — hier dasselbe für WhatsApp (server/lib/fiaon-whatsapp-mara.ts).
//
//   A. OFFLINE (rein, ohne Datenbank, ohne Modell): genanntAufWhatsApp (das Aushandeln einer Zeit mit Mara bleibt der
//      Rückruf-Weg, E-236), fragtNachZeit, saetzeMitUhrzeit, genanntSatz durch Wand und Ton, genanntAntwortFunde (kein
//      Verkauf, kein Zahlungslink, „eingetragen“ nur wenn eingetragen, Uhrzeit-Pflicht), Herkunft/Marke/Übersicht,
//      der Auftrag mit dem Notizen-Block, der Quelltext (Reihenfolge in maraAntwortet).
//   B. LOKALE TEST-DB (nur 127.0.0.1:54329/fiaon_pruefstand…), eigene Datensätze (PRUEF401-…, Nummern 4915900401xxx),
//      am Ende entfernt:
//      B1 genannterTerminBehandeln mit kanal "whatsapp": eingetragen, steht_schon, Dritte, Testperson, Vertriebssperre,
//         Zeitangebot/Wunsch = nichts, Bezug einer älteren Nachricht, ein Vermerk je Nachricht, die Mitarbeiter-Mail.
//      B2 maraAntwortet mit einer Attrappe für das Modell (fetch nachgebaut, kein Netz): Notizen im Auftrag, Hinweis,
//         Werkzeuge ohne Kartenlink, Verkauf → zweiter Entwurf, sicherer Satz, Dritte, Zeitangebot unverändert.
//
//   Offline: env -i HOME="$HOME" PATH="$PATH" TZ=Europe/Berlin node_modules/.bin/tsx scripts/pruef-mara-wa-genannter-termin.ts
//   Mit DB:  env -i HOME="$HOME" PATH="$PATH" TZ=Europe/Berlin CRONS=aus SESSION_SECRET=pruefstand-nur-lokal DOTENV_CONFIG_PATH=/dev/null \
//              DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_…?sslmode=require' \
//              node_modules/.bin/tsx scripts/pruef-mara-wa-genannter-termin.ts --db
// Verschickt nichts: Schlüssel aus der Umgebung → Abbruch; fetch kennt nur die Attrappen (Modell, Mail-Dienst). Alle
// Sätze und Personen sind erfunden; nur die Namen der Kollegen stehen so im Team.
// ═══════════════════════════════════════════════════════════════════════════
const MIT_DB = process.argv.includes("--db");
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID", "META_SYSTEM_TOKEN", "OPENAI_API_KEY", "ANTHROPIC_API_KEY",
  "GOOGLE_SA_KEY", "GMAIL_CLIENT_SECRET", "RESEND_API_KEY", "TWILIO_AUTH_TOKEN", "VAPID_PRIVATE_KEY", "DATABASE_URL_EXTERN"]) {
  if (process.env[k]) { console.error(`${k} ist gesetzt — Abbruch, der Prüfstand darf nichts versenden.`); process.exit(3); }
}
if (MIT_DB && !/127\.0\.0\.1:54329\/fiaon_pruefstand/.test(String(process.env.DATABASE_URL))) { console.error("--db NUR gegen die lokale Test-DB (127.0.0.1:54329/fiaon_pruefstand…)!"); process.exit(3); }
if (!MIT_DB) process.env.DATABASE_URL = "postgresql://nobody@127.0.0.1:1/none";
process.env.CRONS = "aus";
process.env.SESSION_SECRET ||= "pruefstand-nur-lokal";
// Attrappen-Schlüssel: Beide Dienste beantwortet unten der nachgebaute fetch — nichts verlässt den Rechner.
process.env.OPENAI_API_KEY = "sk-pruef-lokal-e401";
if (MIT_DB) process.env.BREVO_API_KEY = "xkeysib-pruef-lokal-e401";
process.env.OHNE_PDF = "1";

// ── Netz: nur lokal und die Attrappen ─────────────────────────────────────
type Plan = { antworten: string[]; mensch?: boolean };
let plan: Plan | null = null;
const MODELL: { system: string; zweiter: boolean; tools: string[]; nutzer: string[]; antwort?: string }[] = [];
const MAILS: { an: string; betreff: string; text: string }[] = [];
const FREMD: string[] = [];
const json = (status: number, j: unknown) => new Response(JSON.stringify(j), { status, headers: { "Content-Type": "application/json" } });
const echtFetch = globalThis.fetch;
globalThis.fetch = (async (eingabe: any, init?: any) => {
  const u = String(typeof eingabe === "string" ? eingabe : eingabe instanceof URL ? eingabe.href : eingabe?.url ?? eingabe);
  if (/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(u)) return echtFetch(eingabe, init);
  if (u.startsWith("https://api.brevo.com/")) {
    let body: any = {};
    try { body = JSON.parse(typeof init?.body === "string" ? init.body : "{}"); } catch { /* leer */ }
    MAILS.push({ an: String(body?.to?.[0]?.email ?? ""), betreff: String(body?.subject ?? ""), text: String(body?.textContent ?? "") });
    return json(201, { messageId: `<pruef401-${MAILS.length}@lokal>` });
  }
  if (u.startsWith("https://api.openai.com/")) {
    let body: any = {};
    try { body = JSON.parse(typeof init?.body === "string" ? init.body : "{}"); } catch { /* leer */ }
    const input: any[] = Array.isArray(body.input) ? body.input : [];
    const system = String(input.find((i) => i?.role === "system")?.content ?? "");
    const nutzer = input.filter((i) => i?.role === "user").map((i) => String(i.content ?? ""));
    const zweiter = nutzer.some((t) => /darf so nicht raus|noch nicht gut genug/.test(t));
    const tools = (Array.isArray(body.tools) ? body.tools : []).map((t: any) => String(t?.name ?? t?.function?.name ?? ""));
    const eintrag = { system, zweiter, tools, nutzer } as (typeof MODELL)[number];
    MODELL.push(eintrag);
    const p = plan ?? { antworten: ["Sehr gern!"] };
    // {SATZ} = der warme Satz aus dem Hinweis des Servers („Ihr Gespräch … Gespräch!“).
    const satz = system.match(/„((?:Ihr Gespräch|Ich wünsche Ihnen)[^“”]*?)“/)?.[1] ?? "";
    const text = String(zweiter ? (p.antworten[1] ?? p.antworten[0]) : p.antworten[0]).replace(/\{SATZ\}/g, satz).replace(/\s+/g, " ").trim();
    eintrag.antwort = text;
    return json(200, { status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ antwort: text, gemerkt: "", mensch: !!p.mensch, uebergabe: "" }) }] }], usage: { input_tokens: 10, output_tokens: 10 } });
  }
  FREMD.push(u);
  throw new Error(`Prüfstand: kein Netz (${u})`);
}) as typeof fetch;

let geprueft = 0, fehler = 0;
function ok(bed: unknown, text: string, info?: unknown) {
  geprueft++;
  if (bed) console.log(`  ✓ ${text}`);
  else { fehler++; console.log(`  ✗ ${text}${info !== undefined ? ` — ${typeof info === "string" ? info : JSON.stringify(info)}` : ""}`); }
}
const kurz = (t: unknown, n = 140) => String(t ?? "").replace(/\s+/g, " ").slice(0, n);

const G = await import("../shared/fiaon-genannter-termin");
const { maraMarke } = await import("../shared/fiaon-mara-marke");
const { istMaraWeg } = await import("../shared/fiaon-termin-uebersicht");
const kp = await import("../server/lib/fiaon-ki-pause");
kp.kiNetzAbsichern();
const wa = await import("../server/lib/fiaon-whatsapp-mara");
const { sendePruefung } = await import("../server/lib/fiaon-whatsapp");
const { HERKUENFTE } = await import("../server/lib/fiaon-termine");
const { readFileSync } = await import("node:fs");
const quelle = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// ═══════════════════════════════════════════════════════════════════════════
// A. OFFLINE
// ═══════════════════════════════════════════════════════════════════════════
// Montag, 19.10.2026, 09:44 Berlin — wie im Prüfstand E-395.
const JETZT = new Date("2026-10-19T07:44:00Z");
const TEAM = [
  { id: 8, vorname: "Daniel", nachname: "Stripling" },
  { id: 10, vorname: "Florentine", nachname: "Lombardi" },
  { id: 928, vorname: "Justin", nachname: "Schwarzott" },
];
const DANIEL: import("../shared/fiaon-genannter-termin").TeamNotiz = { am: "2026-10-16T14:52:30Z", text: "Hat Interesse an unserem Global Konzept telefoniert am Montag 11 Uhr mit Justin.", agentId: 8, agentName: "Daniel Stripling" };
const VORSTELLUNG = "Hallo, hier ist Mara, die digitale Assistentin von FIAON.";
const auf = (kundeText: string, o: { notizen?: any[]; bestehende?: any[]; raus?: string | null } = {}) => {
  const e = G.genannterTermin({ kundeText, jetzt: JETZT, notizen: o.notizen ?? [], mitarbeiter: TEAM, bestehende: o.bestehende ?? [] });
  return { e, g: G.genanntAufWhatsApp(e, { kundeText, letzteRaus: o.raus === undefined ? VORSTELLUNG : o.raus }) };
};

console.log("── A1. Wann gilt ein genannter Termin auf WhatsApp? ─────────────────");
{
  const r = auf("ja bitte stornieren, wir haben heute um 11.00 uhr ein neues gespräch für einen firmenkredit.", { notizen: [DANIEL] });
  ok(r.e.art === "mit_uns" && r.e.beleg === "notiz" && r.g.gilt, "Fall #7131 auf WhatsApp: Notiz von Herrn Stripling + „wir haben heute um 11.00 uhr …“ → gilt", r);
}
{
  const r = auf("Wir telefonieren morgen um 14 Uhr mit Herrn Stripling.");
  ok(r.e.art === "mit_uns" && r.e.beleg === "kunde" && r.g.gilt, "„Wir telefonieren morgen um 14 Uhr mit Herrn Stripling.“ → gilt (vereinbart, ohne Notiz)", r);
}
{
  const r = auf("I have a call with Mr Schwarzott at 11 am tomorrow.");
  ok(r.e.art === "mit_uns" && r.g.gilt, "englisch „I have a call with Mr Schwarzott at 11 am tomorrow.“ → gilt", r);
}
{
  const r = auf("wir haben morgen um 11 ein Gespräch mit Herrn Stripling, ich will vorher noch zahlen");
  ok(r.g.gilt, "„… ein Gespräch mit Herrn Stripling, ich will vorher noch zahlen“ → gilt (der Wunsch steht im anderen Teilsatz)", r.g);
}
{
  const r = auf("Ich habe morgen um 11 einen Termin mit Herrn Stripling, können Sie mir vorher die Unterlagen schicken?");
  ok(r.g.gilt, "Termin + eine andere Frage im selben Satz → gilt", r.g);
}
{
  const r = auf("Wie besprochen, können wir morgen um 11 Uhr telefonieren?");
  ok(r.e.art === "unklar" && r.g.gilt, "„Wie besprochen, können wir morgen um 11 Uhr telefonieren?“ → gilt (ausdrücklich vereinbart, unklar mit wem)", r);
}
{
  const r = auf("Steht unser Gespräch morgen um 14 Uhr noch?", { bestehende: [{ id: 77, beginn: "2026-10-20T12:00:00Z", agentId: 8, status: "gebucht" }] });
  ok(r.e.art === "steht_schon" && r.g.gilt, "Frage nach dem Termin, der im Kalender steht → steht_schon, gilt", r);
}
{
  const r = auf("Ich habe morgen um 10 Uhr einen Termin bei meiner Hausbank.");
  ok(r.e.art === "dritte" && r.g.gilt, "Termin bei der Hausbank → dritte, gilt (nichts eintragen, nichts verkaufen)", r);
}
{
  const r = auf("Ich habe morgen um 15 Uhr ein Gespräch, danach melde ich mich.");
  ok(r.e.art === "unklar" && r.g.gilt, "„Ich habe morgen um 15 Uhr ein Gespräch …“ → unklar, aber vereinbart → gilt (Vermerk für den Menschen)", r);
}
{
  const r = auf("Ich habe morgen um 15.30 uhr ein Gespräch, danach melde ich mich.");
  ok(r.e.art === "unklar" && r.g.gilt, "„… um 15.30 uhr ein Gespräch“ — der Punkt in der Uhrzeit trennt die Vereinbarung nicht", r.g);
}
{
  const r = auf("Wir haben morgen um 10 Uhr ein Gespräch mit Herrn Stripling, danach zahle ich.", { raus: "Wann können Sie die Rate zahlen? Hier ist Ihre Zahlungsseite." });
  ok(r.g.gilt, "unsere Frage „Wann können Sie die Rate zahlen?“ ist kein Zeitangebot → gilt", r.g);
}
console.log("   … und wann NICHT (der bisherige Weg läuft unverändert)");
{
  const r = auf("Können wir morgen um 14 Uhr mit Herrn Stripling telefonieren?");
  ok(!r.g.gilt, "„Können wir morgen um 14 Uhr mit Herrn Stripling telefonieren?“ → Wunsch/Frage, Rückruf-Weg", r.g);
}
{
  const r = auf("Ich möchte morgen um 14 Uhr mit Herrn Stripling sprechen.");
  ok(!r.g.gilt, "„Ich möchte morgen um 14 Uhr mit Herrn Stripling sprechen.“ → Wunsch, Rückruf-Weg", r.g);
}
{
  const r = auf("Wir haben kein Geld, können wir morgen um 14 Uhr telefonieren?");
  ok(!r.g.gilt, "„Wir haben kein Geld, können wir morgen um 14 Uhr telefonieren?“ → Frage (das „wir haben“ gehört nicht zum Termin)", r.g);
}
{
  const r = auf("Können wir um 15 Uhr sprechen");
  ok(!r.g.gilt, "„Können wir um 15 Uhr sprechen“ (ohne Fragezeichen) → Wunsch", r.g);
}
{
  const r = auf("Morgen 14 Uhr, Termin mit Herrn Stripling passt.", { raus: "Herr Stripling kann Sie morgen um 14 Uhr oder um 16 Uhr anrufen — was passt Ihnen?" });
  ok(!r.g.gilt && /Aushandeln/.test(r.g.grund), "Antwort auf Maras Zeitangebot → nie der genannte Termin (rueckruf_eintragen, E-236)", r.g);
}
{
  const r = auf("Wir haben morgen um 10 Uhr ein Gespräch mit Ihrem Berater.", { raus: "Wann passt es Ihnen am besten?" });
  ok(!r.g.gilt, "Antwort auf „Wann passt es Ihnen am besten?“ → Aushandeln, nicht der genannte Termin", r.g);
}
{
  const r = auf("Rufen Sie mich morgen um 14 Uhr an.");
  ok(r.e.art === "keiner" && !r.g.gilt, "„Rufen Sie mich morgen um 14 Uhr an.“ → Rückrufwunsch, keiner", r);
}
{
  const r = auf("Morgen 15 Uhr Gespräch?");
  ok(!r.g.gilt, "„Morgen 15 Uhr Gespräch?“ → Frage", r.g);
}
{
  const r = auf("Ich hatte gestern um 11 Uhr ein Gespräch mit Herrn Stripling.");
  ok(r.e.art === "vergangen" && !r.g.gilt, "vergangen → nichts", r);
}

console.log("── A2. Hilfen ──────────────────────────────────────────────────────");
ok(G.fragtNachZeit("Wann passt es Ihnen am besten?") && G.fragtNachZeit("Welche Uhrzeit passt Ihnen?") && G.fragtNachZeit("Wann erreiche ich Sie am besten?"),
  "fragtNachZeit: „Wann passt es Ihnen?“, „Welche Uhrzeit …?“, „Wann erreiche ich Sie?“");
ok(!G.fragtNachZeit("Wann können Sie die Rate zahlen?") && !G.fragtNachZeit("Hier ist Ihre Zahlungsseite.") && !G.fragtNachZeit(VORSTELLUNG),
  "fragtNachZeit: nicht „Wann können Sie die Rate zahlen?“, nicht ohne Frage");
{
  const s1 = G.saetzeMitUhrzeit("Ich habe um 11 einen Termin, können Sie mir die Unterlagen schicken?");
  const s2 = G.saetzeMitUhrzeit("Können wir um 11 telefonieren? Danke!");
  ok(s1.length === 1 && !s1[0].frage && s2.length === 1 && s2[0].frage, "saetzeMitUhrzeit: die Frage zählt nur, wenn der Teilsatz mit der Uhrzeit sie stellt", { s1, s2 });
  ok(G.saetzeMitUhrzeit("Am 23.10. um 10 Uhr habe ich das Gespräch.").length === 1, "„23.10.“ trennt den Satz nicht");
}

console.log("── A3. Der warme Satz — durch Wand und Ton ──────────────────────────");
const SAETZE = [
  G.genanntSatz({ art: "mit_uns", eingetragen: true, zeit: "heute um 11 Uhr", mit: "Herrn Schwarzott" }),
  G.genanntSatz({ art: "steht_schon", eingetragen: false, zeit: "morgen um 14 Uhr", mit: "Herrn Stripling" }),
  G.genanntSatz({ art: "mit_uns", eingetragen: false, zeit: "morgen um 14 Uhr", mit: null }),
  G.genanntSatz({ art: "dritte", eingetragen: false, zeit: "morgen um 10 Uhr", mit: null }),
  G.genanntSatz({ art: "unklar", eingetragen: false, zeit: "morgen um 15 Uhr", mit: null }),
];
ok(SAETZE[0] === "Ihr Gespräch heute um 11 Uhr mit Herrn Schwarzott ist bei uns eingetragen — ich wünsche Ihnen ein richtig gutes Gespräch!", `eingetragen: „${SAETZE[0]}“`);
ok(/steht bei uns/.test(SAETZE[1]) && /viel Erfolg/.test(SAETZE[3]) && /alles Gute/.test(SAETZE[2]) && !/eingetragen/.test(SAETZE[2] + SAETZE[3] + SAETZE[4]), "steht schon / Dritte / unklar: kein „eingetragen“");
for (const s of SAETZE) {
  const tl = wa.tonUndLink(s, { land: "DE", kunde: "wir haben heute um 11 uhr ein gespräch" });
  ok(!sendePruefung(s).length && !tl.hart.length && !G.verkaufNebenTermin(s) && !G.genanntAntwortFunde(s, { darfEingetragen: true, uhrzeitPflicht: null, satz: s, linkVerboten: true }).length,
    `Wand, Ton, kein Verkauf: „${kurz(s, 90)}“`, { wand: sendePruefung(s), ton: tl.hart });
}

console.log("── A4. Die Antwortprüfung (dieselben Regeln wie im Postfach, E-395) ──");
{
  const gut = SAETZE[0];
  const pflicht = { darfEingetragen: true, uhrzeitPflicht: "11:00", satz: gut, linkVerboten: true };
  ok(!G.genanntAntwortFunde(gut, pflicht).length, "der eingetragene Termin mit Uhrzeit → frei");
  ok(G.genanntAntwortFunde(gut, { ...pflicht, darfEingetragen: false, uhrzeitPflicht: null }).some((f) => /eingetragen ist nichts/.test(f)), "„eingetragen“, obwohl nichts eingetragen ist → Mangel");
  ok(G.genanntAntwortFunde("Ich wünsche Ihnen ein richtig gutes Gespräch!", pflicht).some((f) => /nennt den eingetragenen Termin nicht/.test(f)), "eingetragen, aber die Uhrzeit fehlt → Mangel mit dem Satz");
  ok(G.genanntAntwortFunde("Ihr Gespräch um 11 Uhr steht — ich wünsche Ihnen viel Erfolg!", { ...pflicht, uhrzeitPflicht: "11:15" }).some((f) => /nennt den eingetragenen Termin nicht/.test(f)), "Termin steht um 11:15, die Antwort sagt 11 Uhr → Mangel (die Uhrzeit des Kalenders zählt)");
  ok(G.genanntAntwortFunde(`${gut} Ihre Visa-Kreditkarte wartet schon auf Sie.`, pflicht).some((f) => /Verkauf neben einem genannten Termin/.test(f)), "Visa-Kreditkarte daneben → Verkauf");
  ok(G.genanntAntwortFunde(`${gut} Hier ist Ihre Zahlungsseite: https://www.fiaon.com/zahlung/FIAON-PRUEF1`, pflicht).some((f) => /Kein Link/.test(f)), "Zahlungslink daneben → Mangel");
  ok(!G.genanntAntwortFunde(`${gut} Ihre Unterlagen laden Sie in Ihrem Bereich hoch: fiaon.com/login.`, pflicht).length, "sein Bereich (fiaon.com/login) ist Service → frei");
  ok(!G.genanntAntwortFunde(`${gut} https://www.fiaon.com/zahlung/FIAON-PRUEF1`, { ...pflicht, linkVerboten: false }).some((f) => /Kein Link/.test(f)), "ohne linkVerboten (Postfach-Regel) kein Link-Mangel");
}

console.log("── A5. Herkunft, Marke, Übersicht ──────────────────────────────────");
ok(typeof (HERKUENFTE as Record<string, string>).mara_whatsapp_genannt === "string" && /per WhatsApp genannt/.test((HERKUENFTE as Record<string, string>).mara_whatsapp_genannt),
  "HERKUENFTE kennt mara_whatsapp_genannt (sonst würde terminBuchen „unbekannt“ speichern)");
{
  const m = maraMarke("mara_whatsapp_genannt");
  ok(m?.text === "von Mara" && m.vonMaraEingetragen && /WhatsApp genannt/.test(m.titel), "Marke „von Mara“ im Kalender, Tooltip „per WhatsApp genannt“", m);
  ok(istMaraWeg("mara_whatsapp_genannt") && istMaraWeg("mara_mail_genannt"), "Übersicht (Mara › Termine) zählt beide genannten Wege zu Mara");
}
ok(/mara_whatsapp_genannt/.test(quelle("server/lib/fiaon-termin-meldung.ts")) && /per WhatsApp/.test(quelle("server/lib/fiaon-termin-meldung.ts")), "Mitarbeiter-Mail kennt den WhatsApp-Weg („per WhatsApp genannt“)");
ok(/t\.mara\.weg === "mara_whatsapp" \|\| t\.mara\.weg === "mara_whatsapp_link"/.test(quelle("client/src/components/admin/ChefMaraTermine.tsx")),
  "„bietet ihm neue Zeiten an“ nur bei Maras eigenen WhatsApp-Terminen (nicht bei genannten)");

console.log("── A6. Auftrag und Quelltext ───────────────────────────────────────");
{
  const basis = { name: "Mara Prüf", wer: "Prüfkunde", lage: "zahlender Kunde", ziel: "Ziel", link: null, verkaufen: false, gedaechtnis: "", verlauf: "KUNDE (Mo 09:00): Hallo", wissen: "Fakten", hausanweisung: "" };
  const mit = wa.maraAuftrag({ ...basis, teamNotizen: "- [16.10., 16:52] Daniel Stripling: „telefoniert am Montag 11 Uhr mit Justin.“" });
  const ohne = wa.maraAuftrag(basis);
  ok(/LETZTE GESPRÄCHSNOTIZEN DES TEAMS/.test(mit) && /telefoniert am Montag 11 Uhr/.test(mit) && /GILT/.test(mit), "Auftrag: Block „LETZTE GESPRÄCHSNOTIZEN DES TEAMS“ mit „was ein Kollege vereinbart hat, gilt“");
  ok(!/LETZTE GESPRÄCHSNOTIZEN/.test(ohne), "ohne Notizen kein Block (Auftrag wie vorher)");
  ok(mit.indexOf("LETZTE GESPRÄCHSNOTIZEN") < mit.indexOf("DIE LETZTEN NACHRICHTEN"), "der Block steht vor dem Verlauf");
  ok(!G.verkaufNebenTermin(wa.GENANNT_ZIEL) && /zurück/.test(wa.GENANNT_ZIEL), "GENANNT_ZIEL verkauft nichts und sagt „zurücknehmen“");
}
{
  const ohneKommentare = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const q = ohneKommentare(quelle("server/lib/fiaon-whatsapp-mara.ts"));
  const i = q.indexOf("export async function maraAntwortet(");
  const rumpf = q.slice(i, q.indexOf("\n}\n", i));
  const pos = (s: string) => rumpf.indexOf(s);
  ok(pos("genannterTerminBehandeln(") > 0, "maraAntwortet ruft genannterTerminBehandeln");
  ok(/kanal: "whatsapp"/.test(rumpf), "… mit kanal „whatsapp“");
  ok(pos("genannterTerminBehandeln(") > pos("globalKundeWa(Number(personId))") && pos("genannterTerminBehandeln(") > pos("await kiPausiert()")
    && pos("genannterTerminBehandeln(") > pos("kostenHeute(DIENST_WA)"), "… nach Global-Weiche, KI-Pause und Kostendeckel (kein Eintrag ohne Antwort)");
  ok(pos("genannterTerminBehandeln(") < pos("const termin = personId ? await mt.kuenftigerTermin("), "… vor dem Blick in den Kalender (STAND kennt den neuen Termin)");
  ok(pos("genannterTerminBehandeln(") < pos("werkzeugAusfuehren(\"rueckruf_eintragen\""), "… vor dem Vorab-Rückruf (der dann nicht läuft)");
  ok(/ohneVerkauf: !!genannt/.test(rumpf) && /verkaufen: lage\.verkaufen && !genannt/.test(rumpf) && /heikelJetzt \|\| !!genannt/.test(rumpf),
    "neben dem genannten Termin: kein Kartenlink/Auskunft-Werkzeug, kein Verkaufsteil, kein Abschluss");
  ok(/ruhe: ruhe24 \|\| karteRuhe\(offeneKarten\) \|\| !!genannt/.test(rumpf), "… und keine Zahlungsbitte (Ruhe)");
  const ew = q.slice(q.indexOf("export async function entwerfen("), q.indexOf("\n}\n", q.indexOf("export async function entwerfen(")));
  ok(/genanntAntwortFunde\(a,/.test(ew) && /x\.werkzeug === "rueckruf_eintragen" && x\.ok/.test(ew), "Entwurfsprüfung: genanntAntwortFunde hart — ein eingetragener Rückruf darf „eingetragen“ heißen");
  const mail = quelle("server/lib/fiaon-postmeister-agent.ts");
  ok(!/kanal: "whatsapp"/.test(mail) && /genannterTerminBehandeln\(\{\n\s+personId: ein\.personId, ref: ein\.ref, kundeText: kontext\.kundeText/.test(mail), "Postfach ruft wie vorher ohne kanal (Mail unverändert)");
}

// ═══════════════════════════════════════════════════════════════════════════
// B. LOKALE TEST-DB
// ═══════════════════════════════════════════════════════════════════════════
if (MIT_DB) {
  const { sqlPool: sql } = await import("../server/lib/db-pool");
  const GT = await import("../server/lib/fiaon-mara-genannter-termin");
  const { berlinWand } = G;
  const EINSTELLUNGEN = ["ki_pause", "mara_wa_an", "mara_wa_tag_euro"];
  const einstellungVorher = (await sql`SELECT key, value FROM fiaon_settings WHERE key = ANY(${EINSTELLUNGEN})`.catch(() => [])) as any[];
  const PERSONEN: number[] = [], REFS: string[] = [], NUMMERN: string[] = [];
  const aufraeumen = async () => {
    const alt = (await sql`SELECT id FROM fiaon_persons WHERE person_ref LIKE 'PRUEF401-%'`.catch(() => [])) as any[];
    const ids = Array.from(new Set([...PERSONEN, ...alt.map((x) => Number(x.id))]));
    const refs = REFS.length ? REFS : ["-"];
    for (const n of NUMMERN) {
      await sql`DELETE FROM fiaon_whatsapp WHERE nummer = ${n}`.catch(() => {});
      await sql`DELETE FROM fiaon_whatsapp_gespraech WHERE nummer = ${n}`.catch(() => {});
      await sql`DELETE FROM fiaon_mara_protokoll WHERE nummer = ${n}`.catch(() => {});
    }
    if (ids.length) {
      await sql`DELETE FROM fiaon_whatsapp WHERE person_id = ANY(${ids})`.catch(() => {});
      await sql`DELETE FROM fiaon_termine WHERE person_id = ANY(${ids})`.catch(() => {});
      await sql`DELETE FROM fiaon_betreiber_todos WHERE person_id = ANY(${ids})`.catch(() => {});
      await sql`DELETE FROM fiaon_mara_entscheidungen WHERE person_id = ANY(${ids})`.catch(() => {});
      await sql`DELETE FROM fiaon_mara_protokoll WHERE person_id = ANY(${ids})`.catch(() => {});
      await sql`DELETE FROM fiaon_contact_log WHERE person_id = ANY(${ids}) OR ref = ANY(${refs})`.catch(() => {});
      await sql`DELETE FROM fiaon_abo_raten WHERE ref = ANY(${refs})`.catch(() => {});
      await sql`DELETE FROM fiaon_person_aliases WHERE person_id = ANY(${ids})`.catch(() => {});
      await sql`DELETE FROM fiaon_applications WHERE person_id = ANY(${ids}) OR ref = ANY(${refs})`.catch(() => {});
      await sql`DELETE FROM fiaon_mara_gedaechtnis WHERE person_id = ANY(${ids})`.catch(() => {});
      await sql`DELETE FROM fiaon_persons WHERE id = ANY(${ids})`.catch(() => {});
    }
  };
  /** Eine Person mit Bestellung (kunde: Rate 1 bezahlt, Rate 2 offen; b: abgeschickt, erste Zahlung offen). */
  const kunde = async (id: string, o: { stufe: "kunde" | "b"; test?: boolean; gesperrt?: boolean } = { stufe: "kunde" }) => {
    const [p] = (await sql`INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_email, country, assigned_agent_id, ist_test_am, is_blocked)
      VALUES (${`PRUEF401-${id}`}, 'Prüf', 'Kunde', ${`pruef401-${id}@kunde.invalid`}, 'DE', 8, ${o.test ? new Date() : null}, ${!!o.gesperrt}) RETURNING id`) as any[];
    const personId = Number(p.id); PERSONEN.push(personId);
    const ref = `FIAON-P401${id.toUpperCase()}`; REFS.push(ref);
    const zahl = `FIAON-${`Q4${id.toUpperCase()}`.padEnd(6, "X").slice(0, 6)}`;
    await sql`INSERT INTO fiaon_applications (ref, payment_reference, person_id, status, payment_status, current_step, pack_key, ist_entwurf, agb_stand, created_at, user_agent, paid_at, submitted_at, email, first_name, last_name)
      VALUES (${ref}, ${zahl}, ${personId}, 'approved', ${o.stufe === "kunde" ? "paid" : "pending_payment"}, 8, 'ultra', FALSE, '2026-09-10',
              NOW() - INTERVAL '5 days', 'Mozilla/5.0 (Prüfstand E-401)', ${o.stufe === "kunde" ? new Date(Date.now() - 5 * 86_400_000) : null},
              ${new Date(Date.now() - 5 * 86_400_000)}, ${`pruef401-${id}@kunde.invalid`}, 'Prüf', 'Kunde')`;
    if (o.stufe === "kunde") {
      await sql`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status, bezahlt_am) VALUES (${ref}, 1, ${`${zahl}-1`}, 9999, NOW() - INTERVAL '5 days', 'bezahlt', NOW() - INTERVAL '5 days')`;
      await sql`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status) VALUES (${ref}, 2, ${`${zahl}-2`}, 9999, (NOW() AT TIME ZONE 'Europe/Berlin')::date, 'offen')`;
    }
    return { personId, ref };
  };
  const notiz = async (pid: number, ref: string, text: string) => {
    await sql`INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, outcome, note, created_at)
              VALUES (${ref}, ${pid}, 8, 'Daniel Stripling', 'result', 'erreicht_sonstiges', ${text}, NOW() - INTERVAL '1 hour')`;
  };
  /** Ein Gespräch: Maras Vorstellung von gestern, optional Maras letzte Nachricht, dazu seine Nachricht(en). */
  const gespraech = async (nummer: string, personId: number, texte: string[], maraVorher?: string) => {
    NUMMERN.push(nummer);
    await sql`DELETE FROM fiaon_whatsapp WHERE nummer = ${nummer}`;
    await sql`DELETE FROM fiaon_whatsapp_gespraech WHERE nummer = ${nummer}`.catch(() => {});
    const gestern = new Date(Date.now() - 20 * 3_600_000);
    await sql`INSERT INTO fiaon_whatsapp (richtung, nummer, typ, text, status, vorlage, von, person_id, gesendet_am, created_at)
      VALUES ('raus', ${nummer}, 'vorlage', ${VORSTELLUNG}, 'read', 'fiaon_kkb_test', 'Mara', ${personId}, ${gestern}, ${gestern})`;
    if (maraVorher) {
      const t = new Date(Date.now() - 60_000);
      await sql`INSERT INTO fiaon_whatsapp (richtung, nummer, typ, text, status, von, person_id, gesendet_am, created_at) VALUES ('raus', ${nummer}, 'text', ${maraVorher}, 'read', 'Mara Prüf', ${personId}, ${t}, ${t})`;
    }
    for (const [i, text] of texte.entries()) {
      const am = new Date(Date.now() - 20_000 + i * 1000);
      await sql`INSERT INTO fiaon_whatsapp (richtung, nummer, typ, text, status, person_id, empfangen_am, created_at) VALUES ('rein', ${nummer}, 'text', ${text}, 'empfangen', ${personId}, ${am}, ${am})`;
    }
  };
  const lauf = async (nummer: string, personId: number) => {
    const vorher = MODELL.length;
    const protVorher = new Date(Date.now() - 1000);
    const erg = await wa.maraAntwortet(nummer);
    const [g] = (await sql`SELECT antwort_text, antwort_handlung FROM fiaon_whatsapp_gespraech WHERE nummer = ${nummer}`.catch(() => [])) as any[];
    await sql`UPDATE fiaon_whatsapp_gespraech SET antwort_text = NULL, antwort_faellig_am = NULL WHERE nummer = ${nummer}`.catch(() => {});
    const prot = (await sql`SELECT art, kanal, nummer, text, termin_id FROM fiaon_mara_protokoll WHERE (nummer = ${nummer} OR person_id = ${personId}) AND am >= ${protVorher} ORDER BY id`.catch(() => [])) as any[];
    const aufgaben = (await sql`SELECT schluessel, titel FROM fiaon_betreiber_todos WHERE person_id = ${personId}`.catch(() => [])) as any[];
    const termine = (await sql`SELECT id, agent_id, herkunft, quelle, status, notiz, beginn FROM fiaon_termine WHERE person_id = ${personId} ORDER BY id`.catch(() => [])) as any[];
    return { erg, antwort: String(g?.antwort_text ?? ""), handlung: String(g?.antwort_handlung ?? ""), prot, aufgaben, termine, modell: MODELL.slice(vorher) };
  };
  /** Eine Zeit in `minuten` Minuten (Berlin), auf „…7“ gesetzt (sicher außerhalb jedes Rasters): Wort, „HH.MM uhr“, „HH:MM“. */
  const zeitIn = (minuten: number) => {
    const z = new Date(Date.now() + minuten * 60_000);
    const w = berlinWand(z), h = berlinWand(new Date());
    const [hh, mm] = w.hhmm.split(":").map(Number);
    const min = Math.min(57, Math.floor(mm / 10) * 10 + 7);
    const hhmm = `${String(hh).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
    return { wort: w.t === h.t ? "heute" : "morgen", text: `${hh}.${String(min).padStart(2, "0")} uhr`, hhmm };
  };

  try {
    await aufraeumen();
    await sql`DELETE FROM fiaon_settings WHERE key = ANY(${EINSTELLUNGEN})`;
    await sql`INSERT INTO fiaon_settings (key, value) VALUES ('mara_wa_an', 'an')`;
    kp.kiPauseZwischenspeicherLeeren();

    console.log("\n── B1. genannterTerminBehandeln auf WhatsApp (kanal „whatsapp“) ─────");
    const t1 = zeitIn(125);
    {
      const k = await kunde("d1");
      await notiz(k.personId, k.ref, `Hat Interesse an unserem Global Konzept, telefoniert ${t1.wort} ${t1.hhmm} Uhr mit Justin.`);
      const lage = await GT.genannterTerminBehandeln({ personId: k.personId, ref: null, kundeText: `wir haben ${t1.wort} um ${t1.text} ein gespräch für einen firmenkredit`,
        kanal: "whatsapp", nummer: "4915900401901", waId: 40101, letzteRaus: VORSTELLUNG });
      ok(lage?.kanal === "whatsapp" && lage.erkennung.art === "mit_uns" && lage.eingetragen && lage.teilnehmer?.id === 928, "mit_uns, eingetragen bei Justin (928)", lage?.fehler ?? lage);
      const [t] = (await sql`SELECT * FROM fiaon_termine WHERE person_id = ${k.personId}`) as any[];
      ok(t?.herkunft === "mara_whatsapp_genannt" && t?.quelle === "agent_manuell" && berlinWand(new Date(t.beginn)).hhmm === t1.hhmm, `Termin: herkunft mara_whatsapp_genannt, ${t1.hhmm} Berlin`, t);
      ok(/per WhatsApp genannt \[WhatsApp #40101\]/.test(String(t?.notiz)) && /Daniel Stripling/.test(String(t?.notiz)), "Notiz am Termin: „per WhatsApp genannt [WhatsApp #40101]“ mit Beleg", t?.notiz);
      ok(lage?.uhrzeitTermin === t1.hhmm && /ist bei uns eingetragen/.test(String(lage?.satz)) && lage?.satz && lage.satz.includes(lage.kundenZeit ?? "§"), `uhrzeitTermin ${t1.hhmm}, Satz „${kurz(lage?.satz, 90)}“`);
      ok(/VOM SERVER ERKANNT UND EINGETRAGEN/.test(String(lage?.hinweis)) && /endet mit dem guten Wunsch/.test(String(lage?.hinweis)) && !/Nächster Schritt/.test(String(lage?.hinweis)), "Hinweis in WhatsApp-Fassung (endet mit dem Wunsch, kein „Nächster Schritt“)");
      const [p] = (await sql`SELECT art, kanal, nummer, termin_id, daten FROM fiaon_mara_protokoll WHERE person_id = ${k.personId} ORDER BY id DESC LIMIT 1`) as any[];
      ok(p?.art === "termin_eingetragen" && p?.kanal === "whatsapp" && p?.nummer === "4915900401901" && Number(p?.termin_id) === Number(t?.id), "Mara-Protokoll: termin_eingetragen, Kanal whatsapp, Nummer", p);
      const akte = (await sql`SELECT agent_name, note FROM fiaon_contact_log WHERE person_id = ${k.personId} AND agent_id IS NULL ORDER BY id`) as any[];
      ok(akte.some((a) => a.agent_name === "Mara" && /eingetragen — der Kunde hat ihn per WhatsApp genannt; passt zur Notiz von Daniel Stripling/.test(a.note) && /\[WhatsApp #40101\]/.test(a.note)), "Akte: „Mara: Termin … eingetragen — per WhatsApp genannt“", akte);
      ok(akte.some((a) => a.agent_name === "System" && /vom Kunden per WhatsApp genannt, von Mara eingetragen/.test(a.note)), "Akte: Verlaufseintrag der Meldung nennt den WhatsApp-Weg", akte.map((a) => kurz(a.note, 90)));
      const m = MAILS.find((x) => /Neuer Termin \(von Mara\)/.test(x.betreff));
      ok(m && /per WhatsApp einen Termin mit dir genannt/.test(m.text) && /Beleg:/.test(m.text) && /Art: Vereinbarter Termin — vom Kunden per WhatsApp genannt/.test(m.text), "Mitarbeiter-Mail: „… hat per WhatsApp einen Termin mit dir genannt …“, Beleg", m ? kurz(m.text, 200) : MAILS.map((x) => x.betreff));

      console.log("   dieselbe Nachricht noch einmal (Mara fasst sie nach einem KI-Fehler erneut an)");
      const lage2 = await GT.genannterTerminBehandeln({ personId: k.personId, ref: null, kundeText: `wir haben ${t1.wort} um ${t1.text} ein gespräch für einen firmenkredit`,
        kanal: "whatsapp", nummer: "4915900401901", waId: 40101, letzteRaus: VORSTELLUNG });
      const [{ n }] = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_termine WHERE person_id = ${k.personId}`) as any[];
      const [{ v }] = (await sql`SELECT COUNT(*)::int AS v FROM fiaon_contact_log WHERE person_id = ${k.personId} AND agent_name = 'Mara'`) as any[];
      ok(lage2?.erkennung.art === "steht_schon" && n === 1 && v === 1, "steht_schon — weiter genau ein Termin und ein Mara-Vermerk", { art: lage2?.erkennung.art, n, v });
      ok(/STEHT SCHON IM KALENDER/.test(String(lage2?.hinweis)) && lage2?.uhrzeitTermin === t1.hhmm && /steht bei uns/.test(String(lage2?.satz)), "Hinweis „steht schon“, die Uhrzeit des Kalenders");
    }
    {
      console.log("   Dritte, Testperson, Vertriebssperre, Aushandeln, Wunsch");
      const t2 = zeitIn(150);
      const kB = await kunde("d2", { stufe: "b" });
      const lB = await GT.genannterTerminBehandeln({ personId: kB.personId, ref: null, kundeText: `Ich habe ${t2.wort} um ${t2.text} einen Termin bei meiner Hausbank.`, kanal: "whatsapp", nummer: "4915900401902", waId: 40102, letzteRaus: VORSTELLUNG });
      const [{ n: nB }] = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_termine WHERE person_id = ${kB.personId}`) as any[];
      ok(lB?.erkennung.art === "dritte" && nB === 0 && /BEI DRITTEN/.test(String(lB?.hinweis)) && /viel Erfolg/.test(String(lB?.satz)) && !!lB?.ruhe, "Dritte: kein Termin, „viel Erfolg“, keine Zahlungsbitte", { art: lB?.erkennung.art, nB });

      const kT = await kunde("d3", { stufe: "kunde", test: true });
      const lT = await GT.genannterTerminBehandeln({ personId: kT.personId, ref: null, kundeText: `Wir telefonieren ${t2.wort} um ${t2.text} mit Herrn Schwarzott.`, kanal: "whatsapp", waId: 40103 });
      ok(lT === null, "Testperson → nichts", lT);

      const kS = await kunde("d4", { stufe: "kunde", gesperrt: true });
      const lS = await GT.genannterTerminBehandeln({ personId: kS.personId, ref: null, kundeText: `Wir telefonieren ${t2.wort} um ${t2.text} mit Herrn Schwarzott.`, kanal: "whatsapp", waId: 40104, letzteRaus: VORSTELLUNG });
      const [{ n: nS }] = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_termine WHERE person_id = ${kS.personId}`) as any[];
      const [vS] = (await sql`SELECT note FROM fiaon_contact_log WHERE person_id = ${kS.personId} AND agent_name = 'Mara' ORDER BY id DESC LIMIT 1`) as any[];
      ok(lS && !lS.eingetragen && nS === 0 && /Vertriebssperre/.test(String(lS.fehler)) && /NICHT EINGETRAGEN/.test(String(lS.hinweis)) && /Vertriebssperre/.test(String(vS?.note)),
        "Vertriebssperre: nichts eingetragen, ehrlicher Hinweis, Vermerk für den Menschen", { lS: lS?.fehler, nS, note: vS?.note });

      const kA = await kunde("d5");
      const lA = await GT.genannterTerminBehandeln({ personId: kA.personId, ref: null, kundeText: `Ja, ${t2.wort} um ${t2.text} das Gespräch mit Herrn Stripling passt.`, kanal: "whatsapp", waId: 40105,
        letzteRaus: `Herr Stripling kann Sie ${t2.wort} um ${t2.hhmm} Uhr anrufen. Passt Ihnen das?` });
      const lW = await GT.genannterTerminBehandeln({ personId: kA.personId, ref: null, kundeText: `Können wir ${t2.wort} um ${t2.text} mit Herrn Stripling telefonieren?`, kanal: "whatsapp", waId: 40106, letzteRaus: VORSTELLUNG });
      const [{ n: nA }] = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_termine WHERE person_id = ${kA.personId}`) as any[];
      const [{ v: vA }] = (await sql`SELECT COUNT(*)::int AS v FROM fiaon_contact_log WHERE person_id = ${kA.personId} AND agent_id IS NULL`) as any[];
      ok(lA === null && lW === null && nA === 0 && vA === 0, "Antwort auf Maras Zeitangebot / „Können wir …?“ → nichts (Rückruf-Weg), kein Vermerk", { lA, lW, nA, vA });

      console.log("   unklar, zweimal dieselbe Nachricht → ein Vermerk");
      const kU = await kunde("d6");
      for (let i = 0; i < 2; i++) {
        await GT.genannterTerminBehandeln({ personId: kU.personId, ref: null, kundeText: `Ich habe ${t2.wort} um ${t2.text} ein Gespräch, danach melde ich mich.`, kanal: "whatsapp", waId: 40107, letzteRaus: VORSTELLUNG });
      }
      const vU = (await sql`SELECT note FROM fiaon_contact_log WHERE person_id = ${kU.personId} AND agent_name = 'Mara'`) as any[];
      ok(vU.length === 1 && /ohne dass klar ist, mit wem/.test(vU[0].note) && /\[WhatsApp #40107\]/.test(vU[0].note), "genau ein Vermerk „ohne dass klar ist, mit wem“ je Nachricht", vU);

      console.log("   Bezug: „morgen“ in einer Nachricht von gestern (aus einer Pause) meint heute");
      const t3 = zeitIn(185);
      const bezug = new Date(Date.now() + 185 * 60_000 - 24 * 3_600_000);
      const kZ = await kunde("d7");
      const lZ = await GT.genannterTerminBehandeln({ personId: kZ.personId, ref: null, kundeText: `Wir telefonieren morgen um ${t3.text} mit Herrn Schwarzott.`, kanal: "whatsapp", waId: 40108, letzteRaus: VORSTELLUNG, bezug });
      const [tZ] = (await sql`SELECT beginn FROM fiaon_termine WHERE person_id = ${kZ.personId}`) as any[];
      ok(lZ?.eingetragen && tZ && berlinWand(new Date(tZ.beginn)).hhmm === t3.hhmm && berlinWand(new Date(tZ.beginn)).t === berlinWand(new Date(Date.now() + 185 * 60_000)).t,
        `eingetragen am Tag NACH seiner Nachricht (${t3.hhmm}), nicht einen Tag später`, { lZ: lZ?.fehler, tZ });
      const kV = await kunde("d8");
      const lV = await GT.genannterTerminBehandeln({ personId: kV.personId, ref: null, kundeText: `Wir telefonieren heute um ${zeitIn(-200).text} mit Herrn Schwarzott.`, kanal: "whatsapp", waId: 40109, letzteRaus: VORSTELLUNG,
        bezug: new Date(Date.now() - 6 * 3_600_000) });
      ok(lV === null, "Bezug: die genannte Zeit ist inzwischen vorbei → nichts", lV);
    }

    console.log("\n── B2. maraAntwortet mit der Modell-Attrappe ───────────────────────");
    {
      console.log("   e1 zahlend, Notiz von Herrn Stripling + „wir telefonieren … wegen dem Firmenkredit“");
      const t = zeitIn(215);
      const k = await kunde("e1");
      await notiz(k.personId, k.ref, `telefoniert ${t.wort} ${t.hhmm} Uhr mit Justin wegen Firmenkredit.`);
      await gespraech("4915900401001", k.personId, [`wir telefonieren ${t.wort} um ${t.text} wegen dem firmenkredit`]);
      plan = { antworten: ["Wie schön! Und Ihre Visa-Kreditkarte mit Wunschlimit wartet schon — hier ist Ihre Zahlungsseite: https://www.fiaon.com/zahlung/FIAON-PRUEF1", "{SATZ}"] };
      const r = await lauf("4915900401001", k.personId);
      const s0 = r.modell[0]?.system ?? "";
      ok(/LETZTE GESPRÄCHSNOTIZEN DES TEAMS/.test(s0) && /telefoniert .* mit Justin wegen Firmenkredit/.test(s0), "Auftrag: Notizen des Teams mit der Notiz von Herrn Stripling");
      ok(/VOM SERVER ERKANNT UND EINGETRAGEN/.test(s0) && s0.indexOf("VOM SERVER ERKANNT") > s0.indexOf("JETZT BEACHTEN"), "Hinweis unter JETZT BEACHTEN: eingetragen");
      ok(s0.includes(wa.GENANNT_ZIEL) && !/═══ DEIN ABSCHLUSS/.test(s0) && !/DEIN JOB: VERKAUFEN/.test(s0), "Ziel „zurücknehmen“, kein Abschluss, kein Verkaufsteil");
      ok(r.modell.length >= 1 && !r.modell[0].tools.includes("karte_link_schicken") && !r.modell[0].tools.includes("auskunft_anbieten") && r.modell[0].tools.includes("rueckruf_eintragen"),
        "Werkzeuge: kein Kartenlink, keine Auskunft — die Termin-Werkzeuge bleiben (E-236 unverändert)", r.modell[0]?.tools);
      ok(r.modell.some((x) => x.zweiter && x.nutzer.some((n) => /Verkauf neben einem genannten Termin/.test(n))), "erster Entwurf mit Visa/Zahlungsseite → zweiter Entwurf mit „Verkauf neben einem genannten Termin“");
      ok(/ist bei uns eingetragen/.test(r.antwort) && r.antwort.includes(t.hhmm.replace(/:00$/, "")) && !/visa|zahlung/i.test(r.antwort), `Antwort: „${kurz(r.antwort, 160)}“`);
      ok(r.termine.length === 1 && r.termine[0].herkunft === "mara_whatsapp_genannt" && Number(r.termine[0].agent_id) === 928, "ein Termin bei Justin, herkunft mara_whatsapp_genannt", r.termine);
      ok(r.prot.some((p: any) => p.art === "termin_eingetragen" && p.kanal === "whatsapp" && p.nummer === "4915900401001"), "Protokoll termin_eingetragen (whatsapp)", r.prot.map((p: any) => p.art));
      ok(/Vereinbarten Termin eingetragen/.test(r.handlung), `Handlung im Aktenvermerk: „${kurz(r.handlung, 140)}“`);
      ok(!r.aufgaben.length, "keine Aufgabe für einen Menschen");

      console.log("   e1b dieselbe Nachricht noch einmal (Nachhol-Takt nach einem KI-Fehler)");
      plan = { antworten: ["{SATZ}"] };
      const r2 = await lauf("4915900401001", k.personId);
      ok(/STEHT SCHON IM KALENDER/.test(r2.modell[0]?.system ?? "") && r2.termine.length === 1 && /steht bei uns/.test(r2.antwort), "steht schon — kein zweiter Termin, „steht bei uns“", { n: r2.termine.length, a: kurz(r2.antwort) });
    }
    {
      console.log("   e2 beide Entwürfe verkaufen → der warme Satz ist der sichere Satz");
      const t = zeitIn(245);
      const k = await kunde("e2");
      await gespraech("4915900401002", k.personId, [`Ich habe ${t.wort} um ${t.text} ein Gespräch mit Herrn Schwarzott, wie besprochen.`]);
      plan = { antworten: ["Super! Ihre Visa-Kreditkarte wartet schon auf Sie.", "Prima — und vergessen Sie Ihre Visa-Kreditkarte nicht!"] };
      const r = await lauf("4915900401002", k.personId);
      ok(r.prot.some((p: any) => p.art === "sicherer_satz") && /ist bei uns eingetragen — ich wünsche Ihnen ein richtig gutes Gespräch!/.test(r.antwort) && !/visa/i.test(r.antwort),
        `sicherer Satz: „${kurz(r.antwort, 150)}“`, r.prot.map((p: any) => p.art));
      ok(r.termine.length === 1 && r.termine[0].herkunft === "mara_whatsapp_genannt", "Termin eingetragen (Beleg: er sagt „wie besprochen“)", r.termine);
    }
    {
      console.log("   e3 Antwort auf Maras Zeitangebot → der bisherige Weg (kein genannter Termin)");
      const k = await kunde("e3");
      await gespraech("4915900401003", k.personId, ["Ja, morgen um 10 Uhr ist das Gespräch gut."], "Herr Stripling kann Sie morgen um 10 Uhr anrufen. Passt Ihnen das?");
      plan = { antworten: ["Gern, Herr Stripling ruft Sie morgen um 10 Uhr an."] };
      const r = await lauf("4915900401003", k.personId);
      const alle = r.modell.map((x) => x.system).join("\n");
      ok(!/VEREINBARTER TERMIN|GENANNTER TERMIN|ER NENNT/.test(alle) && !r.termine.some((x: any) => x.herkunft === "mara_whatsapp_genannt"), "kein Hinweis zum genannten Termin, kein Termin mara_whatsapp_genannt", r.termine);
      ok(!alle.includes(wa.GENANNT_ZIEL), "das Ziel bleibt das normale");
    }
    {
      console.log("   e4 B (Zahlung offen) nennt einen Termin bei der Bank → viel Erfolg, keine Zahlungsseite");
      const t = zeitIn(160);
      const k = await kunde("e4", { stufe: "b" });
      await gespraech("4915900401004", k.personId, [`Ich habe ${t.wort} um ${t.text} einen Termin bei meiner Hausbank.`]);
      plan = { antworten: ["Viel Erfolg! Hier ist Ihre Zahlungsseite: https://www.fiaon.com/zahlung/FIAON-PRUEF4 — zahlen Sie jetzt, dann geht es los.", "Ich wünsche Ihnen viel Erfolg bei Ihrem Termin!"] };
      const r = await lauf("4915900401004", k.personId);
      const s0 = r.modell[0]?.system ?? "";
      ok(/BEI DRITTEN/.test(s0) && s0.includes(wa.GENANNT_ZIEL) && !/═══ DEIN ABSCHLUSS/.test(s0), "Hinweis „bei Dritten“, Ziel zurücknehmen, kein Abschluss");
      ok(r.modell.some((x) => x.zweiter) && r.antwort === "Ich wünsche Ihnen viel Erfolg bei Ihrem Termin!" && !r.termine.length, `zweiter Entwurf geht raus, kein Termin: „${kurz(r.antwort)}“`);
    }
    {
      console.log("   e5 Testperson → normaler Weg, kein Eintrag");
      const t = zeitIn(170);
      const k = await kunde("e5", { stufe: "kunde", test: true });
      await gespraech("4915900401005", k.personId, [`Wir telefonieren ${t.wort} um ${t.text} mit Herrn Schwarzott.`]);
      plan = { antworten: ["Danke für Ihre Nachricht!"] };
      const r = await lauf("4915900401005", k.personId);
      ok(!r.termine.length && !/VEREINBARTER TERMIN|GENANNTER TERMIN/.test(r.modell.map((x) => x.system).join("\n")), "kein Termin, kein Hinweis", r.termine);
    }
  } catch (e) {
    fehler++;
    console.error("ABBRUCH:", e);
  } finally {
    plan = null;
    await aufraeumen().catch((e) => console.error("Aufräumen:", e));
    await sql`DELETE FROM fiaon_settings WHERE key = ANY(${EINSTELLUNGEN})`.catch(() => {});
    for (const r of einstellungVorher) await sql`INSERT INTO fiaon_settings (key, value) VALUES (${r.key}, ${r.value}) ON CONFLICT (key) DO UPDATE SET value = ${r.value}`.catch(() => {});
    const [rest] = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_persons WHERE person_ref LIKE 'PRUEF401-%'`.catch(() => [{ n: -1 }])) as any[];
    ok(Number(rest.n) === 0, `Aufgeräumt: keine PRUEF401-Personen mehr (${rest.n})`);
    ok(!FREMD.length, `kein fremder Netzaufruf${FREMD.length ? ` (${FREMD.slice(0, 3).join(", ")})` : ""}`);
    await sql.end().catch(() => {});
  }
}

console.log(`\n${fehler ? "✗" : "✓"} ${geprueft - fehler}/${geprueft} Prüfungen bestanden${MIT_DB ? " (mit DB)" : " (offline)"}`);
process.exit(fehler ? 1 : 0);
