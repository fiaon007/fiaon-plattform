// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: MAIL-MARA ARBEITET SELBSTSTÄNDIG UND VERKAUFT (02.10.2026, E-275)
//
// Justin (02.10.2026, ~16:00): „MARA verweist immer mehr auf die Mitarbeiter,
// Mara soll aber selbstständig arbeiten ohne jedes mal ein Termin zu vereinbaren
// (Whatsapp aber natürlich auch per mail!) Mara soll selbst verkaufen … Aber nicht
// immer sagen ‚Ich mache einen Termin mit XY‘ oder ‚Wir sind keine Bank und
// können nichts wissen‘. Mara soll positiv, verkäuferisch und selbstständig agieren."
//
// Der Anlass: Postmeister-Fall #6120 (welcome@, 02.10. 15:30) — ein Kunde, der
// FIAON Ultra am 02.08. bezahlt hat, schreibt „I have not your kaditkarte“ (Text
// nur „Sent from Yahoo Mail for iPhone“). Seit einer Werbesperre vom 09.09. (Mail
// 3644: kein eigener Text, aber sein Betreff „… bitte not again send me e mail for
// rattan ok“ — zu Recht gesetzt, Gegenprüfung E-275) stand er auf „gesperrt“ — nur Übergabe —,
// und die Einladung der Partnerbank hatte er nie bekommen. Mara: „The card itself
// is issued and sent by the bank … I have asked Nikita Boychenko to check this today".
//
// Geprüft (Teil A ohne Datenbank, Teil B mit lokaler Test-DB, Modell und Gmail als
// Attrappen — nichts geht hinaus):
//   1. Werbesperre nur auf ausdrücklichen Wunsch — nie bei leerem Text, Signatur, Bild.
//   2. Übergabe nur noch bei Beschwerde, Bestreiten, Recht, Widerruf, „kann nicht zahlen“,
//      ausdrücklichem Rückrufwunsch und FIAON Global — nicht mehr bei „sonstiges“, „dringend“,
//      „mein Betreuer hat gesagt …“.
//   3. Kartenfrage erkennen, Verweis- und Abwehrsätze erkennen, Mail-Abschluss ohne Pflicht-Termin.
//   4. Werkzeug karte_senden: Lagen, Global-Wand, Bank-Stand, Funktion aus dem Bereich Karte.
//   DB: Fall #6120 (zahlender Kunde mit Werbesperre fragt nach der Karte → karte_senden, keine
//   Übergabe, Antwort geht selbst raus), unbezahlter Kunde fragt nach der Karte (Zahlungsseite +
//   Abschluss, kein Kartenlink), Kündigung und Widerruf bleiben Übergabe, leere Mail mit Bild setzt
//   keine Werbesperre, Unterlagen still, Rückrufwunsch, Global-Kunde.
//
//   Offline:
//     env -i PATH="$PATH" HOME="$HOME" TZ=Europe/Berlin DOTENV_CONFIG_PATH=/dev/null npx tsx scripts/pruef-mara-mail-e275.ts
//   Mit der lokalen Test-DB (eigene Datenbank, nie die Produktion):
//     env -i PATH="$PATH" HOME="$HOME" TZ=Europe/Berlin DOTENV_CONFIG_PATH=/dev/null CRONS=aus SESSION_SECRET=pruefstand-nur-lokal \
//       DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_e275_mail?sslmode=require' npx tsx scripts/pruef-mara-mail-e275.ts --db
//   Eigene Datensätze (Personen PRUEF275M-…, Referenzen FIAON-P275…, Mails e275m-…) werden am Ende entfernt.
// ═══════════════════════════════════════════════════════════════════════════
const MIT_DB = process.argv.includes("--db");
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID", "META_SYSTEM_TOKEN",
  "OPENAI_API_KEY", "GOOGLE_SA_KEY", "GMAIL_CLIENT_SECRET", "RESEND_API_KEY", "TWILIO_AUTH_TOKEN", "VAPID_PRIVATE_KEY", "DATABASE_URL_EXTERN"]) {
  if (process.env[k]) { console.error(`${k} ist gesetzt — Abbruch, der Prüfstand darf nichts versenden.`); process.exit(3); }
}
if (MIT_DB && !/127\.0\.0\.1:54329\/fiaon_/.test(String(process.env.DATABASE_URL))) { console.error("--db NUR gegen eine lokale Test-DB (127.0.0.1:54329)!"); process.exit(3); }
if (!MIT_DB) process.env.DATABASE_URL = "postgresql://nobody@127.0.0.1:1/none";
process.env.CRONS = "aus";
process.env.SESSION_SECRET ||= "pruefstand-nur-lokal";

import { generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";

// ── Attrappen VOR jedem Import (wie scripts/pruef-mara-mail.ts) ───────────
process.env.OPENAI_API_KEY = "sk-pruef-lokal-e275m";
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
process.env.GOOGLE_SA_KEY = JSON.stringify({
  client_email: "pruef@e275m.invalid", private_key: privateKey.export({ type: "pkcs8", format: "pem" }), token_uri: "https://oauth2.pruef.invalid/token",
});

/** Das Drehbuch des Modells für eine Mail. */
interface Szenario {
  einordnung: Record<string, unknown>;
  werkzeuge?: { name: string; args: Record<string, unknown> }[];
  antwort: Record<string, unknown>;
  umformuliert?: Record<string, unknown>;
}
let SZ: Szenario | null = null;
const OPENAI: { art: "einordnen" | "antwort"; system: string; alles: string; tools: string[] }[] = [];
const GMAIL_SENDEN: string[] = [];
const GMAIL_ENTWURF: string[] = [];
const FREMD: string[] = [];
type Nachricht = { thread: string; am: number; von: string; betreff: string; text: string; anhang?: boolean };
const NACHRICHTEN = new Map<string, Nachricht>();

const json = (status: number, j: unknown) => new Response(JSON.stringify(j), { status, headers: { "Content-Type": "application/json" } });
const nachricht = (text: string) => ({ output: [{ type: "message", content: [{ type: "output_text", text }] }] });
const echtFetch = globalThis.fetch;
globalThis.fetch = (async (eingabe: any, init?: any) => {
  const u = String(typeof eingabe === "string" ? eingabe : eingabe instanceof URL ? eingabe.href : eingabe?.url ?? eingabe);
  if (/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(u)) return echtFetch(eingabe, init);
  if (u.startsWith("https://api.openai.com/")) {
    const body = JSON.parse(typeof init?.body === "string" ? init.body : "{}");
    const alles = JSON.stringify(body.input ?? []);
    const system = String((body.input ?? []).find((m: any) => m?.role === "system")?.content ?? "");
    const einordnen = alles.includes("Du ordnest eingehende Kundenmails");
    OPENAI.push({ art: einordnen ? "einordnen" : "antwort", system, alles, tools: (body.tools ?? []).map((t: any) => String(t?.name ?? "")) });
    if (!SZ) return json(500, { error: { message: "kein Szenario" } });
    let aus: any;
    if (einordnen) aus = nachricht(JSON.stringify(SZ.einordnung));
    else if (body.text?.format) aus = nachricht(JSON.stringify(alles.includes("Deine Antwort hat diese Mängel") && SZ.umformuliert ? SZ.umformuliert : SZ.antwort));
    else if (body.tools && SZ.werkzeuge?.length && !alles.includes("function_call_output")) {
      aus = { output: SZ.werkzeuge.map((w, i) => ({ type: "function_call", call_id: `c${i}`, name: w.name, arguments: JSON.stringify(w.args) })) };
    } else aus = nachricht("fertig");
    return json(200, { status: "completed", ...aus, usage: { input_tokens: 1000, output_tokens: 200, total_tokens: 1200 } });
  }
  if (u === "https://oauth2.pruef.invalid/token") return json(200, { access_token: "pruef-token", expires_in: 3600 });
  if (u.startsWith("https://gmail.googleapis.com/")) {
    const methode = String(init?.method ?? "GET").toUpperCase();
    if (/\/messages\/send/.test(u)) { GMAIL_SENDEN.push(String(init?.body ?? "")); return json(200, { id: `gesendet-${GMAIL_SENDEN.length}`, threadId: "t" }); }
    if (/\/drafts/.test(u)) { GMAIL_ENTWURF.push(String(init?.body ?? "")); return json(200, { id: `entwurf-${GMAIL_ENTWURF.length}`, message: { id: "x" } }); }
    if (/\/messages\?/.test(u)) return json(200, { messages: [], resultSizeEstimate: 0 });
    const m = u.match(/\/messages\/([^/?]+)\?format=full/);
    if (m) {
      const n = NACHRICHTEN.get(m[1]);
      if (!n) return json(404, { error: { message: "Not Found" } });
      const textTeil = { mimeType: "text/plain", body: { data: Buffer.from(n.text).toString("base64") } };
      const bild = { mimeType: "image/jpeg", filename: "IMG_0001.jpg", body: { attachmentId: "anh-1", size: 204800 } };
      return json(200, {
        id: m[1], threadId: n.thread, labelIds: ["INBOX", "UNREAD"], internalDate: String(n.am), snippet: n.text.slice(0, 80),
        payload: {
          mimeType: n.anhang ? "multipart/mixed" : "text/plain",
          headers: [
            { name: "From", value: n.von }, { name: "To", value: "welcome@fiaon.com" },
            { name: "Subject", value: n.betreff }, { name: "Message-ID", value: `<${m[1]}@kunde.invalid>` }],
          ...(n.anhang ? { parts: [textTeil, bild] } : { body: textTeil.body }),
        },
      });
    }
    if (u.endsWith("/labels")) return json(200, methode === "POST" ? { id: "L1" } : { labels: [] });
    return json(200, {});
  }
  FREMD.push(u);
  throw new Error(`Prüfstand: kein Netz (${u})`);
}) as typeof fetch;

let geprueft = 0, fehler = 0;
function ok(bed: unknown, text: string) {
  geprueft++;
  if (bed) console.log(`  ✓ ${text}`); else { fehler++; console.log(`  ✗ ${text}`); }
}
const abschnitt = (t: string) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 70 - t.length))}`);

const agent = await import("../server/lib/fiaon-postmeister-agent");
const wz = await import("../server/lib/fiaon-postmeister-werkzeuge");
const lauf = await import("../server/lib/fiaon-postmeister-lauf");
const ton = await import("../shared/fiaon-mara-ton");
const { wandPruefen } = await import("../shared/fiaon-wortverbote");
const { KARTE_ZEIT_SATZ } = await import("../shared/fiaon-karten-weg");

// ═══ TEIL A · OHNE DATENBANK ══════════════════════════════════════════════
abschnitt("1 · Werbesperre nur auf ausdrücklichen Wunsch (ausdruecklicherStopp)");
// Anonymisierte Formen echter Mails (Postfach 01.09.–02.10., nur gelesen): Text und Betreff, wie sie kamen.
const STOPP_JA: [string, string][] = [
  ["Re: Ihre Zahlung steht noch aus", "Ihr betreibt Spam.... Ich will keine Mail mehr!! Mit sonnigen Grüßen"],
  ["Re: Ihre Monatsrate 2", "Und bitte keine mael mer"],
  ["Re: Ihre Monatsrate 2", "Ist das normal!!!!Bitte keine mael mehr!!! Ich zahle nichts mehr..."],
  ["Re: Ihr Account wartet auf Aktivierung", "Stopp"],
  ["Re: Ihr Account wartet noch kurz", "S T O P P"],
  ["Re: Ihr Account wartet auf einen Schritt", "Stop"],
  ["Abmelden FIAON Global", ""],
  ["Abmelden FIAON Global", "Gesendet mit der Telekom Mail App"],
  ["Stop sending me email!", ""],
  ["AW: Ihre Monatsrate 2", "Lassen Sie mich in Ruhe  Yahoo Mail: Suchen, organisieren, erobern"],
  ["AW: Ihre Zahlung steht noch aus", "Kein Interesse. Keine Nachrichten mehr. Danke"],
  ["Re: Ihre Zahlung steht noch aus", "Ich habe es schon so oft abgesagt, also schreib mir bitte nicht mehr. Danke"],
  ["Kunde I have not your Kredit card bitte not again send me e mail for rattan ok", "Sent from Yahoo Mail for iPhone"],
  ["Re: Ihre Akte", "Bitte keine weiteren Mails."],
];
for (const [b, t] of STOPP_JA) ok(wz.ausdruecklicherStopp(b, t), `ausdrücklich: „${(b + " | " + t).slice(0, 80)}“`);
const STOPP_NEIN: [string, string][] = [
  ["I have not your kaditkarte", "Sent from Yahoo Mail for iPhone"],
  ["Re: Ihre Monatsrate 2 — FIAON-ABCDEF-2", ""],
  ["Re: Ihr Account wartet", "Gesendet von Outlook für iOS<https://aka.ms/o0ukef>"],
  ["Re: Ihre Monatsrate 2", "\n\n[Der Kunde hat 1 Datei(en) mitgeschickt: IMG_0001.jpg (image/jpeg, 200 KB). Du kannst sie nicht öffnen.]"],
  ["Frage", "Ich habe keine Mail mit dem Link bekommen. Wann kommt meine Karte?"],
  ["Karte", "Ich will Sie nicht belästigen, aber wann kommt meine Karte?"],
  ["Re: Ihr Zugang", "Ihre Mail war im Spam-Ordner. Wie geht es weiter?"],
  ["Re: Zahlung", "Ich habe die Rate überwiesen, hier der Beleg."],
  // Unser eigener Betreff (Re:) zählt nie — auch wenn er Worte wie „Stopp“ enthielte.
  ["Re: Stopp — Ihre Erinnerungen", "Wann kommt meine Karte?"],
  ["Re: Wir erreichen Sie nicht", "Am 22.09.2026 schrieb FIAON Welcome <welcome@fiaon.com>:\n> Antworten Sie mit Stopp, wenn Sie keine Nachrichten mehr möchten."],
];
for (const [b, t] of STOPP_NEIN) ok(!wz.ausdruecklicherStopp(b, t), `kein Wunsch: „${(b + " | " + t).replace(/\n/g, " ").slice(0, 80)}“`);
ok(!wz.hatEigenenText("Sent from Yahoo Mail for iPhone", "Re: Ihre Monatsrate 2") && wz.hatEigenenText("Sent from Yahoo Mail for iPhone", "I have not your kaditkarte"), "hatEigenenText: Signatur allein nein — sein Betreff (kein Re:) zählt");
ok(wz.eigenerBetreff("Re: Ihre Zahlung") === "" && wz.eigenerBetreff("AW: x") === "" && wz.eigenerBetreff("I have not your kaditkarte") === "I have not your kaditkarte", "eigenerBetreff: „Re:/AW:“ ist unser Betreff");
{
  // Der Riegel: Das Modell sagt „abmeldung + stopp“ zu einer Mail ohne eigenen Text — der Riegel nimmt beides zurück.
  const r = agent.riegelAnwenden({ betreff: "I have not your kaditkarte", text: "Sent from Yahoo Mail for iPhone", kategorien: ["abmeldung", "sonstiges"] as any, flags: { stopp: true } as any });
  ok(!r.flags.stopp && !r.kategorien.includes("abmeldung" as any), `#6120-Form: stopp und „abmeldung“ zurückgenommen (${r.kategorien.join(", ")})`);
  const r2 = agent.riegelAnwenden({ betreff: "Re: Ihre Monatsrate 2", text: "\n\n[Der Kunde hat 1 Datei(en) mitgeschickt: IMG.jpg (image/jpeg, 200 KB).]", kategorien: ["abmeldung"] as any, flags: { stopp: true } as any });
  ok(!r2.flags.stopp && r2.kategorien.length === 1 && r2.kategorien[0] === "sonstiges", `Nur ein Bild ohne Text: kein Stopp, keine Abmeldung (${r2.kategorien.join(", ")})`);
  const r3 = agent.riegelAnwenden({ betreff: "Re: Ihre Monatsrate 2", text: "Stopp. Bitte keine Werbung mehr.", kategorien: ["abmeldung"] as any, flags: {} as any });
  ok(r3.flags.stopp && r3.kategorien.includes("abmeldung" as any), "„Stopp. Bitte keine Werbung mehr.“ bleibt Stopp + Abmeldung");
  const r4 = agent.riegelAnwenden({ betreff: "Re: Ihr Antrag", text: "Lassen Sie mich in Ruhe!", kategorien: ["beschwerde"] as any, flags: {} as any });
  ok(r4.flags.stopp, "„Lassen Sie mich in Ruhe!“ bleibt Stopp (E-264)");
}
{
  // ── E-275 GEGENPRÜFUNG (Wahrheit und Recht): Die Liste ist kein Veto über SEINE Worte ───────────────────────────
  // Echte Stopp-Wünsche aus dem Postfach (01.08.–02.10., nur gelesen, anonymisiert), die ausdruecklicherStopp NICHT
  // erkennt. Das Modell hatte sie als stopp eingeordnet — der Merker bleibt (STOPP_KOEPFE), die Sperre darf gesetzt werden.
  const ECHT: [string, string, string][] = [
    ["Re: Ihre Monatsrate 2", "Noch eine Bitte schicken sie mir keine Nachricht mehr.. Ich zahle nicht mehr..", "schicken sie mir keine Nachricht mehr"],
    ["Re: Ihre Monatsrate 2", "ja ist unklar bittee löschen sie dieses account", "bittee löschen sie dieses account"],
    ["Aw: Ein kurzer Schritt zur Karte", "Bitte Antrag löschen. Alles schon erledigt.", "Bitte Antrag löschen"],
    ["Re: Ihr Startgespräch", "Ich weiß nicht wie viel mal soll ich sagen fack off", "fack off"],
  ];
  for (const [b, t, z] of ECHT) {
    ok(!wz.ausdruecklicherStopp(b, t), `(Ausgangslage) Liste erkennt „${t.slice(0, 40)}…“ nicht`);
    const r = agent.riegelAnwenden({ betreff: b, text: t, kategorien: ["zahlung"] as any, flags: { stopp: true } as any });
    ok(r.flags.stopp, `Modell-Stopp mit eigenem Text bleibt: „${t.slice(0, 50)}“`);
    ok(wz.werbesperreUrteil(b, t, z) === null, `werbesperre_setzen darf sperren (Zitat aus seinem Text): „${z}“`);
  }
  // Was die Liste weiter verhindert: kein eigener Text, ein Zitat aus unserer Mail, ein Textriegel-Treffer nur im Zitat.
  ok(wz.werbesperreUrteil("I have not your kaditkarte", "Sent from Yahoo Mail for iPhone", "Sent from Yahoo Mail for iPhone") !== null, "#6120-Form: Signatur als Zitat → keine Sperre");
  ok(wz.werbesperreUrteil("Re: Ihre Monatsrate 2", "\n\n[Der Kunde hat 1 Datei(en) mitgeschickt: IMG.jpg (image/jpeg, 200 KB).]", "Bild") !== null, "Nur ein Bild → keine Sperre");
  const unsere = "Wann kommt meine Karte?\n\nAm 22.09.2026 schrieb FIAON Welcome <welcome@fiaon.com>:\n> Antworten Sie mit Stopp, wenn Sie keine Nachrichten mehr möchten.";
  ok(wz.werbesperreUrteil("Re: Wir erreichen Sie nicht", unsere, "Antworten Sie mit Stopp, wenn Sie keine Nachrichten mehr möchten") !== null, "Zitat aus UNSERER Mail → keine Sperre");
  const rz = agent.riegelAnwenden({ betreff: "Re: Wir erreichen Sie nicht", text: unsere, kategorien: ["status_frage"] as any, flags: {} as any });
  ok(!rz.flags.stopp, "Textriegel trifft nur unser Zitat („keine Nachrichten mehr“), das Modell sagt nichts → kein Stopp");
  const r6 = agent.riegelAnwenden({ betreff: "Satpal Jhim I have not your frima Kredit card bitte not again send me e mail for rattan ok", text: "Sent from Yahoo Mail for iPhone", kategorien: ["abmeldung", "sonstiges"] as any, flags: { stopp: true } as any });
  ok(r6.flags.stopp, "Mail 3644 (09.09.): der Wunsch im eigenen Betreff zählt — die Sperre damals war richtig");
  // Ausstieg ist keine Kartenfrage — kein Vorab-Versand der Einladung gegen sein Nein.
  for (const t of ["Ich brauche die Karte nicht mehr.", "Ich will keine Karte mehr, bitte beenden.", "I don't need the card"]) {
    ok(!agent.fragtNachFehlenderKarte("Re: Ihre Monatsrate 2", t), `Ausstieg ist keine Kartenfrage: „${t}“`);
  }
  // Unvollständiger Antrag: Der Abschluss verspricht den Link nicht „direkt“ — und besteht Ton und Wand (auch nach dem Wunschlimit).
  const formelL = agent.mailAbschlussFormel("b", { euro: 25000, art: "wunsch", paketName: null } as any)
    .replace(agent.AKTIVIERUNG_SATZ, agent.aktivierungMitLuecke(["Geburtsdatum"])).replace("[Betrag]", "59,99 €").replace("[Verwendungszweck]", "FIAON-ABCDEF");
  ok(!/direkt\s+den\s+fertigen\s+Link/.test(formelL) && /es fehlt noch: Geburtsdatum/.test(formelL)
    && !ton.tonPruefung(formelL, { kanal: "mail", land: "DE", kunde: "" }).some((b) => b.schwere === "hart") && !wandPruefen(formelL, []).length,
    "Abschluss B mit unvollständigem Antrag: kein „direkt“, nennt was fehlt, Ton und Wand ohne harten Treffer");
}

abschnitt("2 · Übergabe nur noch, wo ein Mensch wirklich übernimmt (menschNoetig)");
const E = (kategorien: string[], flags: Record<string, boolean> = {}, dringend = false) => ({ kategorien, flags, dringend });
ok(lauf.menschNoetig(E(["sonstiges"]), "Sent from Yahoo Mail for iPhone") === null, "#6120: „sonstiges“ ist kein Grund mehr");
ok(lauf.menschNoetig(E(["status_frage"], {}, true), "Seit Wochen keine Karte!") === null, "„dringend“ allein ist kein Grund mehr");
ok(lauf.menschNoetig(E(["status_frage"]), "Mein Betreuer hat gesagt, die Karte kommt bald. Wann denn?") === null, "„Mein Betreuer hat gesagt …“ ist kein Rückrufwunsch");
ok(lauf.menschNoetig(E(["status_frage"]), "Ich habe versucht anzurufen, aber niemand ging ran.") === null, "„versucht anzurufen“ ist kein Rückrufwunsch");
ok(lauf.menschNoetig(E(["status_frage"]), "Bitte nicht anrufen, ich bin auf der Arbeit.") === null, "„Bitte nicht anrufen“ ist kein Rückrufwunsch");
ok(lauf.menschNoetig(E(["termin"]), "Bitte rufen Sie mich morgen Vormittag an.") === lauf.UEBERGABE_GRUND.ansprechpartner, "„Bitte rufen Sie mich morgen an“ → Rückruf (Mensch)");
ok(lauf.menschNoetig(E(["sonstiges"]), "Ich möchte mit meinem Betreuer sprechen.") === lauf.UEBERGABE_GRUND.ansprechpartner, "„möchte mit meinem Betreuer sprechen“ → Mensch");
ok(lauf.menschNoetig(E(["zahlung"], { beschwerde: true }), "Unverschämt!") === lauf.UEBERGABE_GRUND.beschwerde, "Beschwerde → Mensch");
ok(lauf.menschNoetig(E(["rechtlich"], { widerruf: true, rechtlich: true }), "Ich widerrufe.") === lauf.UEBERGABE_GRUND.rechtlich, "Widerruf/Recht → Mensch");
ok(lauf.menschNoetig(E(["zahlung"], { zahlungsunfaehig: true }), "Ich kann gerade nicht zahlen.") === lauf.UEBERGABE_GRUND.zahlungsunfaehig, "„kann nicht zahlen“ → Mensch (Geld)");
ok(lauf.menschNoetig(E(["status_frage"]), "Wie ist der Stand?", { globalKunde: true }) === lauf.UEBERGABE_GRUND.global, "Kunde von FIAON Global → Justin (E-272)");
ok(lauf.menschNoetig(E(["beschwerde"]), "…") === lauf.UEBERGABE_GRUND.mensch, "Kategorie Beschwerde → Mensch");

abschnitt("3 · Kartenfrage, Verweis- und Abwehrsätze, Mail-Abschluss");
ok(agent.fragtNachFehlenderKarte("I have not your kaditkarte", "Sent from Yahoo Mail for iPhone"), "#6120: „I have not your kaditkarte“ (Betreff) → Kartenfrage");
ok(agent.fragtNachFehlenderKarte("Re: Ihre Monatsrate 2", "Wann kommt endlich meine Kreditkarte?"), "„Wann kommt endlich meine Kreditkarte?“ → Kartenfrage");
ok(agent.fragtNachFehlenderKarte("Re: x", "Ich habe den Link für die Karte nicht bekommen."), "„Link für die Karte nicht bekommen“ → Kartenfrage");
ok(agent.fragtNachFehlenderKarte("Frage", "Seit 26.06. nichts mit Karte und PIN."), "„nichts mit Karte und PIN“ → Kartenfrage");
ok(!agent.fragtNachFehlenderKarte("Re: x", "Die Karte ist angekommen, danke!"), "„Die Karte ist angekommen, danke!“ → keine");
ok(!agent.fragtNachFehlenderKarte("Re: Ihre Zahlung", "Ich habe heute überwiesen."), "Zahlungsmeldung ohne Karte → keine");
const ALT_6120 = "I understand that you still have not received the credit card. Your FIAON Ultra account is active, and FIAON prepares the card step for you.\nThe card itself is issued and sent by the bank, not by e-mail from FIAON. I have asked Nikita Boychenko to check this today and give you the current position.";
const vb = agent.verweisBefunde(ALT_6120);
ok(vb.some((h) => /Verweis/.test(h)) && vb.some((h) => /Abwehr/.test(h)), `Maras Antwort aus #6120 fällt auf: Verweis UND Abwehr (${vb.length})`);
ok(agent.verweisBefunde("Ich habe Herrn Stripling gebeten, das heute zu prüfen.").length === 1, "„Ich habe Herrn Stripling gebeten …“ → Verweis");
ok(agent.verweisBefunde("Nikita Boychenko meldet sich heute bei Ihnen.").length === 1, "„Nikita Boychenko meldet sich …“ → Verweis");
ok(agent.verweisBefunde("FIAON verschickt selbst keine Karte und keine PIN.").length === 1, "„FIAON verschickt keine Karte“ → Abwehr");
ok(agent.verweisBefunde("Das können wir leider nicht wissen.").length === 1, "„können wir nicht wissen“ → Abwehr");
ok(agent.verweisBefunde("Herr Stripling ruft Sie morgen um 10 Uhr an.", { erlaubt: true }).length === 0, "Rückrufwunsch (erlaubt): „Herr Stripling ruft Sie … an“ ist richtig");
ok(agent.verweisBefunde("Unsere Zahlungsstelle prüft den Eingang und verbucht ihn.").length === 0, "„Unsere Zahlungsstelle prüft den Eingang“ ist kein Verweis");
const GUT_KARTE = `Den fertigen Link unserer Partnerbank für Ihren Kartenantrag habe ich Ihnen eben noch einmal geschickt — in einer eigenen E-Mail mit dem Betreff „Ihr Link zur Karte ist da“. Der Antrag dauert online nur wenige Minuten. ${KARTE_ZEIT_SATZ}`;
ok(agent.verweisBefunde(GUT_KARTE).length === 0, "Die neue Kartenantwort hat keinen Verweis und keine Abwehr");
ok(!wandPruefen(GUT_KARTE).filter((w) => w.art !== "zusage").length && !ton.tonPruefung(GUT_KARTE, { kanal: "mail" }).some((b) => b.schwere === "hart"), "… und besteht Wortwand und Ton (hart)");
ok(!wandPruefen(wz.karteGesendetSatz({ erneut: true, betreff: "Ihr Link zur Karte ist da, Satpal" })).filter((w) => w.art !== "zusage").length
  && /„Ihr Link zur Karte ist da“/.test(wz.karteGesendetSatz({ erneut: true, betreff: "Ihr Link zur Karte ist da, Satpal" })), "karteGesendetSatz: Wortwand frei, Betreff ohne Vornamen");
// Der Mail-Abschluss ohne Pflicht-Termin
const ZIEL = { euro: 25000, art: "wunsch" as const, paketName: "FIAON Ultra" };
for (const art of ["b", "a", "rate", "abbrecher", "c"] as const) {
  for (const z of [null, ZIEL]) {
    const f = agent.mailAbschlussFormel(art, z).replace(/\[Betrag\]/g, "59,99 €").replace(/\[Verwendungszweck\]/g, "FIAON-AB12CD").replace(/\[Fälligkeit\]/g, "12.09.");
    const hart = ton.tonPruefung(f, { kanal: "mail", land: "DE" }).filter((b) => b.schwere === "hart");
    // E-275 Ton (02.10.2026): höchstens EIN Ausrufezeichen, nie „wir versenden die Karte“/„in Produktion“/„garantiert“.
    ok(!/termin|vereinbare|anruf/i.test(f) && !hart.length && !wandPruefen(f).filter((w) => w.art !== "zusage").length
      && ton.ausrufezeichen(f) <= 1 && !/versend|verschick|produktion|garant/i.test(f),
      `mailAbschlussFormel ${art}${z ? " mit Ziel" : ""}: kein Termin, Ton und Wortwand frei, höchstens ein „!“${hart.length ? ` (${hart.map((h) => h.id).join(",")})` : ""}`);
  }
}
const fb = agent.mailAbschlussFormel("b", ZIEL);
// E-275 Ton (02.10.2026, Justin: „Zahlen Sie die Aktivierung … Ihr Account ist sofort nach Eingang aktiv!“): die klare
// Aufforderung statt „Bitte begleichen Sie jetzt …“, der Nutzen direkt dahinter, das Tempo — bewusst mitgezogen.
ok(fb.includes(agent.AKTIVIERUNG_SATZ) && fb.includes(KARTE_ZEIT_SATZ) && fb.includes(`${ton.AKTIVIERUNG_AUFRUF}, Ihre erste Monatsrate über [Betrag]`) && fb.includes(ton.TEMPO_SATZ) && fb.includes(ton.BANK_SATZ)
  && agent.AKTIVIERUNG_SATZ.startsWith("Ihr Account ist sofort nach Zahlungseingang aktiv") && ton.ausrufezeichen(fb) === 1,
  "Abschluss B: „Zahlen Sie jetzt die Aktivierung“, der Nutzen (sofort aktiv → direkt der Link), Tempo, 2–5 Werktage, Wunschlimit nur mit Bank-Satz, ein „!“");
ok(fb.indexOf(ton.AKTIVIERUNG_AUFRUF) < fb.indexOf(agent.AKTIVIERUNG_SATZ) && fb.split("\n\n")[0].includes(agent.AKTIVIERUNG_SATZ), "Abschluss B: erst die Aufforderung, direkt dahinter der Nutzen — im ersten Absatz");
ok(!/Bitte begleichen|überweisen|zahlen Sie/i.test(agent.mailAbschlussFormel("a", null)), "Abschluss A (Zahlung gemeldet): keine Zahlungsbitte, keine Aufforderung");
ok(agent.mailAbschlussVerkauf(fb.replace(/\[Betrag\]/g, "59,99 €")).length === 0, "mailAbschlussVerkauf: die Formel erfüllt Nutzen und Bitte");
ok(agent.mailAbschlussVerkauf("Offen ist Ihre erste Monatsrate über 59,99 €. Welche Zeit passt Ihnen für einen Anruf mit Herrn Stripling?").length === 2, "mailAbschlussVerkauf: ohne Nutzen-Satz und ohne Bitte → zwei Hinweise");

abschnitt("4 · Werkzeug karte_senden: Lagen, Wand, Auftrag");
const namen = (l: any, o: any = {}) => wz.werkzeugeFuerLage(l, o).map((w) => w.name);
for (const l of ["aktiv", "rate_ueberfaellig", "bezahlt_ohne_startgespraech"]) ok(namen(l).includes("karte_senden"), `karte_senden in Lage „${l}“`);
for (const l of ["unbezahlt", "interessent", "zahlung_gemeldet", "gesperrt", "gekuendigt", "fremd", "unklar"]) ok(!namen(l).includes("karte_senden"), `kein karte_senden in Lage „${l}“`);
ok(namen("aktiv").includes("auskunft_anbieten") && !namen("aktiv", { werbesperre: true }).includes("auskunft_anbieten"), "Werbesperre beim zahlenden Kunden: kein auskunft_anbieten (kein Upsell)");
ok(wz.NUR_PRIVATKUNDEN_WERKZEUGE.has("karte_senden") && typeof wz.globalWerkzeugSperre("karte_senden", true) === "string" && wz.globalWerkzeugSperre("karte_senden", false) === null, "Global-Wand: karte_senden nie an FIAON Global (E-272)");
ok(wz.werkzeugVonName("karte_senden")!.ausfuehren.toString().includes("globalWerkzeugSperre"), "werkzeugVonName liefert karte_senden MIT der Wand");
{
  // Nur Code, keine Kommentare — die Kommentare zitieren die alten Sätze absichtlich.
  const ohneKommentar = (t: string) => t.split("\n").filter((z) => !/^\s*(\/\/|\*|\/\*)/.test(z)).join("\n");
  const qa = ohneKommentar(readFileSync(new URL("../server/lib/fiaon-postmeister-agent.ts", import.meta.url), "utf8"));
  ok(!/bietest den Termin mit Herrn\/Frau Nachname an/.test(qa), "Auftrag: kein Pflicht-Terminangebot mehr („bietest den Termin mit Herrn/Frau Nachname an“)");
  ok(!/erneut schicken kann sein Betreuer/.test(qa) && !/FIAON verschickt keine Karte und keine PIN\. Nie/.test(qa), "Auftrag: kein „erneut schicken kann sein Betreuer“, kein „FIAON verschickt keine Karte“ mehr");
  ok(!/gib dem Betreuer die Aufgabe, es zu klären/.test(qa), "Auftrag: Kundenweg ohne „gib dem Betreuer die Aufgabe, es zu klären“");
  ok(/\.replace\(KARTE_REGEL_TEXT, MAIL_KARTE_REGEL\)/.test(qa) && /selbstBlock\(\{ werbesperreZahlend/.test(qa), "Auftrag: Mail-Kreditkartenregel ohne Pflicht-Termin + Block „DU ERLEDIGST ES SELBST“");
  const ql = ohneKommentar(readFileSync(new URL("../server/lib/fiaon-postmeister-lauf.ts", import.meta.url), "utf8"));
  ok(!/k\.has\("sonstiges"\)\) return UEBERGABE_GRUND\.mensch/.test(ql) && !/if \(e\.dringend\) return UEBERGABE_GRUND\.dringend/.test(ql), "Lauf: „sonstiges“ und „dringend“ erzwingen keine Übergabe mehr");
  ok(!/leg eine Aufgabe an, die Datei zu prüfen/.test(ql), "Lauf: Anhang-Hinweis ohne „leg eine Aufgabe an, die Datei zu prüfen“");
}

// ═══ TEIL B · MIT DER LOKALEN TEST-DB ═════════════════════════════════════
if (MIT_DB) {
  const { sqlPool: sql } = await import("../server/lib/db-pool");
  const kp = await import("../server/lib/fiaon-ki-pause");
  kp.kiNetzAbsichern();
  const { postmeisterSchema } = await import("../server/lib/fiaon-postmeister-schema");
  const START = new Date();
  const EINSTELLUNGEN = ["ki_pause", "postmeister_an", "postmeister_v2"];
  const einstellungVorher = (await sql`SELECT key, value FROM fiaon_settings WHERE key = ANY(${EINSTELLUNGEN})`) as any[];
  const personen: Record<string, number> = {};
  const refs: string[] = [];
  const PF = "welcome@fiaon.com";
  const GRUSS = "Freundliche Grüße\nIhr FIAON Welcome-Team";
  const jetzt = Date.now();
  let mailNr = 0;

  // Die Funktion aus dem Bereich Karte als Attrappe: schreibt mit, schickt nichts.
  const KARTE_RUFE: { personId: number; opt: any }[] = [];
  const KARTE_SATZ = "Ich habe Ihnen soeben den fertigen Link unserer Partnerbank, der DKB, für Ihren Kartenantrag per E-Mail geschickt. Darüber beantragen Sie in wenigen Minuten online Ihr Girokonto mit Visa-Karte — Sie brauchen nur Ihren Ausweis. " + KARTE_ZEIT_SATZ;
  wz.KARTE_EINLADUNG_QUELLE.fn = async (personId, opt) => {
    KARTE_RUFE.push({ personId, opt });
    return { ok: true, aktion: "erneut_gesendet", gesendet: true, satz: KARTE_SATZ, intern: "Link der Partnerbank erneut geschickt (Attrappe).", schonAm: null, betreff: "Ihr Link zur Karte ist da, Max" };
  };

  const person = async (kurz: string, extra: { werbesperre?: boolean } = {}) => {
    const mail = `pruef275m-${kurz.toLowerCase()}@kunde.invalid`;
    const [p] = (await sql`INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_email, werbung_gesperrt_am)
                           VALUES (${`PRUEF275M-${kurz}`}, 'Max', ${`Prüfer${kurz}`}, ${mail}, ${extra.werbesperre ? new Date("2026-09-09T13:13:30Z") : null}) RETURNING id`) as any[];
    personen[kurz] = Number(p.id);
    return { id: Number(p.id), mail };
  };
  const antrag = async (ref: string, personId: number, mail: string, o: { status: string; betrag?: number; typ?: string; pack?: string }) => {
    refs.push(ref);
    await sql`INSERT INTO fiaon_applications (ref, person_id, type, status, pack_key, pack_name, payment_reference, payment_status, amount_due, first_name, last_name, email, agb_stand, created_at)
              VALUES (${ref}, ${personId}, 'private', ${o.typ ?? "submitted"}, ${o.pack ?? "ultra"}, 'FIAON Ultra', ${ref}, ${o.status}, ${o.betrag ?? 79.99}, 'Max', 'Prüfer', ${mail}, null, NOW() - INTERVAL '61 days')`;
  };
  const rate = async (ref: string, nr: number, status: string, faellig: string) => {
    await sql`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status) VALUES (${ref}, ${nr}, ${`${ref}-${nr}`}, 7999, ${faellig}, ${status})`;
  };
  const lies = (w: unknown) => { if (w == null) return null; if (typeof w === "object") return w; try { const x = JSON.parse(String(w)); return typeof x === "string" ? JSON.parse(x) : x; } catch { return null; } };
  /** Eine Kundenmail durch den ganzen Lauf — mit Drehbuch für das Modell. */
  const lauf1 = async (von: string, text: string, sz: Szenario, o: { betreff?: string; anhang?: boolean } = {}) => {
    mailNr += 1;
    const gmailId = `e275m-${mailNr}`;
    NACHRICHTEN.set(gmailId, { thread: `e275m-t${mailNr}`, am: jetzt - 3 * 60_000, von: `Max Prüfer <${von}>`, betreff: o.betreff ?? "Frage", text, anhang: o.anhang });
    SZ = sz;
    const vorKi = OPENAI.length, vorSenden = GMAIL_SENDEN.length, vorEntwurf = GMAIL_ENTWURF.length, vorKarte = KARTE_RUFE.length;
    const e = await lauf.mailBearbeiten({ postfach: PF, gmailId, gruss: GRUSS, modus: "auto" });
    const [z] = (await sql`SELECT * FROM fiaon_postmeister WHERE gmail_id = ${gmailId}`) as any[];
    if (process.argv.includes("--zeigen")) console.log(`\n  ┌ Mail #${z?.id} (${z?.aktion}; ${String(z?.begruendung ?? "").slice(0, 90)})\n${String(z?.antwort ?? "(keine Antwort)").split("\n").map((l: string) => `  │ ${l}`).join("\n")}\n  └`);
    return {
      e, z, id: Number(z?.id), schritt: lies(z?.naechster_schritt) as any, pruefung: lies(z?.pruefung) as any, handlungen: (lies(z?.handlungen) ?? []) as any[],
      kiAntwort: OPENAI.slice(vorKi).filter((x) => x.art === "antwort"), gesendet: GMAIL_SENDEN.length - vorSenden, entwuerfe: GMAIL_ENTWURF.length - vorEntwurf,
      karteRufe: KARTE_RUFE.slice(vorKarte),
    };
  };
  const uebergabe = async (personId: number) => ((await sql`SELECT id, titel, text FROM fiaon_betreiber_todos WHERE schluessel = ${`postmeister:antwort:${personId}`} AND created_at >= ${START}`) as any[]);

  try {
    await postmeisterSchema();
    await sql`DELETE FROM fiaon_settings WHERE key = ANY(${EINSTELLUNGEN})`;
    await sql`INSERT INTO fiaon_settings (key, value) VALUES ('postmeister_an', 'an')`;
    kp.kiPauseZwischenspeicherLeeren?.();
    const heute = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });

    // ── DB 1 · FALL #6120 ────────────────────────────────────────────────────
    abschnitt("DB 1 · #6120: zahlender Kunde mit Werbesperre fragt nach der Karte");
    const S = await person("S", { werbesperre: true });
    await antrag("FIAON-P275MS", S.id, S.mail, { status: "paid" });
    await rate("FIAON-P275MS", 1, "bezahlt", "2026-08-02");
    await rate("FIAON-P275MS", 2, "offen", "2026-09-02");
    const dossier = await import("../server/lib/fiaon-postmeister-dossier");
    const lS = await dossier.kundenlageBerechnen(S.id, "FIAON-P275MS");
    ok(lS.lage === "rate_ueberfaellig" && /Werbesperre gesetzt: keine Werbung/.test(lS.grund), `Lage: „${lS.lage}“ statt „gesperrt“ — die Sperre steht im Grund (${lS.grund.slice(0, 90)})`);
    const ANTWORT_S = "I am sorry you are still waiting for your card. I have just sent you the ready-made link from our partner bank for your card application again — in a separate e-mail with the subject “Ihr Link zur Karte ist da”. The application takes only a few minutes online, and you only need your ID. Once the bank approves, the card is usually with you within a few working days, and you can often use it beforehand in the bank's app with Apple Pay.\n\nYour rate 2 of 79.99 € with the payment reference FIAON-P275MS-2 is still open. Please settle it now — the quickest way is the button below.";
    const s1 = await lauf1(S.mail, "Sent from Yahoo Mail for iPhone", {
      einordnung: { kategorien: ["sonstiges"], dringend: false, sprache: "en", fragen: ["Where is my card?"], zusammenfassung: "Hat keine Karte.", flags: {} },
      antwort: { antwort: ANTWORT_S, naechster_schritt: { art: "zahlung", url: null, text: "Pay now" }, belege: [{ satz: "Your rate 2 of 79.99 €", werkzeug: "zahlungslink_bauen", feld: "betrag" }], fragen_beantwortet: [], merken: [] },
    }, { betreff: "I have not your kaditkarte" });
    ok(s1.z?.kundenlage === "rate_ueberfaellig", `Zeile: Lage ${s1.z?.kundenlage}`);
    ok(s1.karteRufe.length === 1 && s1.karteRufe[0].personId === S.id && s1.karteRufe[0].opt?.erneut === true && s1.karteRufe[0].opt?.quelle === "postmeister",
      `karte_senden vorab: die Funktion aus dem Bereich Karte wurde EINMAL gerufen (erneut, quelle postmeister) — ${JSON.stringify(s1.karteRufe.map((r) => r.opt))}`);
    ok(s1.handlungen.some((h: any) => h.werkzeug === "karte_senden" && h.ok) && !s1.handlungen.some((h: any) => h.werkzeug === "aufgabe_an_betreuer"), "Handlungen: karte_senden ja, aufgabe_an_betreuer nein");
    const sys1 = String(s1.kiAntwort[0]?.system ?? "");
    ok(/DU ERLEDIGST ES SELBST/.test(sys1) && /WERBESPERRE: Er hat um keine Werbung gebeten/.test(sys1), "Auftrag: „DU ERLEDIGST ES SELBST“ + Werbesperre heißt nur kein Upsell");
    ok(/VORAB GEHOLT \(karte_senden/.test(sys1) && sys1.includes(KARTE_SATZ.slice(0, 60)), "Auftrag: karte_senden VORAB GEHOLT, mit dem Satz aus dem Bereich Karte");
    ok(/keinen eigenen Text geschrieben/.test(s1.kiAntwort[0]?.alles ?? "") && /I have not your kaditkarte/.test(s1.kiAntwort[0]?.alles ?? ""), "Mail ohne eigenen Text: das Modell liest den Betreff als sein Anliegen");
    ok(!/bietest den Termin|vereinbare Ihren Termin mit/.test(sys1), "Auftrag: kein Pflicht-Termin");
    ok(!(s1.kiAntwort[0]?.tools ?? []).includes("auskunft_anbieten") && (s1.kiAntwort[0]?.tools ?? []).includes("karte_senden"), `Werkzeuge: karte_senden ja, auskunft_anbieten nein (Werbesperre) — ${(s1.kiAntwort[0]?.tools ?? []).join(", ")}`);
    ok(s1.z?.aktion === "auto_beantwortet" && s1.gesendet === 1, `Mara antwortet SELBST (${s1.z?.aktion}; ${String(s1.z?.begruendung ?? "").slice(0, 90)}; fehlend: ${(s1.pruefung?.fehlend ?? []).join(" · ").slice(0, 160)})`);
    ok((await uebergabe(S.id)).length === 0, "Keine Übergabe „Kunde hat geschrieben“ an einen Menschen");
    ok(s1.schritt?.art === "zahlung" && /\/zahlung\/FIAON-P275MS-2$/.test(String(s1.schritt?.url)), "Knopf: seine offene Rate (Vertragspflicht, kein Upsell)");
    const [pS] = (await sql`SELECT werbung_gesperrt_am FROM fiaon_persons WHERE id = ${S.id}`) as any[];
    ok(!!pS?.werbung_gesperrt_am, "Die Werbesperre selbst bleibt stehen (nur Werbung ist gesperrt, nicht der Service)");
    // Eine zweite Mail desselben Laufs: karte_senden höchstens einmal je Mail (das Modell ruft es noch einmal).
    const s1b = await lauf1(S.mail, "Hello? I still have no card and no link!", {
      einordnung: { kategorien: ["status_frage"], dringend: true, sprache: "en", fragen: ["Where is my card?"], zusammenfassung: "Fragt nach der Karte.", flags: {} },
      werkzeuge: [{ name: "karte_senden", args: { anlass: "hat keinen Kartenlink" } }],
      antwort: { antwort: ANTWORT_S, naechster_schritt: { art: "zahlung", url: null, text: "Pay now" }, belege: [{ satz: "Your rate 2 of 79.99 €", werkzeug: "zahlungslink_bauen", feld: "betrag" }], fragen_beantwortet: [], merken: [] },
    }, { betreff: "Re: I have not your kaditkarte" });
    ok(s1b.karteRufe.length === 1, `Zweite Mail: vorab einmal geschickt, der zweite Ruf des Modells schickt nichts (${s1b.karteRufe.length} Versand)`);
    ok(s1b.z?.aktion === "auto_beantwortet", `„dringend“ hält die Antwort nicht mehr fest (${s1b.z?.aktion}; ${String(s1b.z?.begruendung ?? "").slice(0, 80)})`);

    // ── DB 2 · UNBEZAHLT FRAGT NACH DER KARTE ─────────────────────────────────
    abschnitt("DB 2 · Unbezahlter Kunde fragt nach der Karte → Zahlungsseite + Abschluss");
    const U = await person("U");
    await antrag("FIAON-P275MU", U.id, U.mail, { status: "pending_payment", betrag: 59.99, pack: "pro" });
    // E-275 Ton (02.10.2026): der gute Entwurf in der neuen Form — Aufforderung, Nutzen, Tempo.
    const GUT_U = `Ihre Visa-Kreditkarte ist genau der richtige nächste Schritt. ${ton.AKTIVIERUNG_AUFRUF}, Ihre erste Monatsrate über 59,99 € (Verwendungszweck FIAON-P275MU) — am schnellsten über den Knopf unten. ${agent.AKTIVIERUNG_SATZ}\n\n${ton.TEMPO_SATZ} ${KARTE_ZEIT_SATZ}`;
    const s2 = await lauf1(U.mail, "Wann bekomme ich meine Kreditkarte?", {
      einordnung: { kategorien: ["status_frage"], dringend: false, sprache: "de", fragen: ["Wann kommt die Karte?"], zusammenfassung: "Fragt nach der Karte.", flags: {} },
      antwort: { antwort: GUT_U, naechster_schritt: { art: "zahlung", url: null, text: "Jetzt bezahlen" }, belege: [], fragen_beantwortet: [], merken: [] },
    });
    const sys2 = String(s2.kiAntwort[0]?.system ?? "");
    ok(s2.z?.kundenlage === "unbezahlt" && s2.karteRufe.length === 0 && !(s2.kiAntwort[0]?.tools ?? []).includes("karte_senden"), "Unbezahlt: kein Kartenlink, kein karte_senden im Werkzeugkasten");
    ok(/VORAB GEHOLT \(zahlungslink_bauen/.test(sys2) && /SO SCHLIESST DU AB/.test(sys2) && sys2.includes(agent.AKTIVIERUNG_SATZ) && /Zahlen Sie jetzt die Aktivierung, Ihre erste Monatsrate/.test(sys2) && !/Bitte begleichen Sie jetzt Ihre erste Monatsrate/.test(sys2), "Auftrag: Zahlungsseite vorab, Abschluss mit „Zahlen Sie jetzt die Aktivierung“ und dem Nutzen (E-275 Ton)");
    ok(!/vereinbare Ihren Termin|Termin mit Herrn\/Frau Nachname an/.test(sys2), "Auftrag: kein Pflicht-Termin im Abschluss");
    // E-275 Gegenprüfung (Wahrheit und Recht): Diesem Antrag fehlen Geburtsdatum und Anschrift — nach der Zahlung kommt der
    // Link NICHT direkt (die Einladung verlangt den vollständigen Antrag). Der Abschluss nennt, was fehlt; die Akte auch.
    const zeile2 = sys2.split("\n").find((l) => l.startsWith("SO SCHLIESST DU AB")) ?? "";
    ok(/es fehlt noch: Geburtsdatum/.test(zeile2) && !zeile2.includes(agent.AKTIVIERUNG_SATZ) && /Im Antrag fehlt noch: Geburtsdatum/.test(sys2),
      "Antrag ohne Geburtsdatum/Anschrift: Abschluss verspricht den Link erst mit vollständigen Angaben (kein „direkt“)");
    const U3 = await person("U3");
    await antrag("FIAON-P275MX", U3.id, U3.mail, { status: "pending_payment", betrag: 59.99, pack: "pro" });
    await sql`UPDATE fiaon_applications SET birthdate = '1980-01-01', street = 'Prüfweg 1', zip = '10115', city = 'Berlin' WHERE ref = 'FIAON-P275MX'`;
    const s2c = await lauf1(U3.mail, "Wann bekomme ich meine Kreditkarte?", {
      einordnung: { kategorien: ["status_frage"], dringend: false, sprache: "de", fragen: ["Wann kommt die Karte?"], zusammenfassung: "Fragt nach der Karte.", flags: {} },
      antwort: { antwort: GUT_U.replace(/FIAON-P275MU/g, "FIAON-P275MX"), naechster_schritt: { art: "zahlung", url: null, text: "Jetzt bezahlen" }, belege: [], fragen_beantwortet: [], merken: [] },
    });
    const zeile3 = String(s2c.kiAntwort[0]?.system ?? "").split("\n").find((l) => l.startsWith("SO SCHLIESST DU AB")) ?? "";
    ok(zeile3.includes(agent.AKTIVIERUNG_SATZ) && !/es fehlt noch/.test(zeile3), "Antrag vollständig: Abschluss mit Justins Satz („direkt den fertigen Link“)");
    ok(s2.z?.aktion === "auto_beantwortet" && s2.gesendet === 1 && s2.schritt?.art === "zahlung" && /\/zahlung\/FIAON-P275MU$/.test(String(s2.schritt?.url)),
      `Mara schließt selbst ab — Knopf seine Zahlungsseite (${s2.z?.aktion}; ${(s2.pruefung?.fehlend ?? []).join(" · ").slice(0, 120)})`);
    // Ohne Bitte und mit Pflicht-Termin: der zweite Entwurf wird verlangt (weich).
    const SCHWACH_U = "Ihre Karte kommt nach der Aktivierung. Offen ist Ihre erste Monatsrate über 59,99 € (Verwendungszweck FIAON-P275MU). Welche Zeit passt Ihnen für einen Anruf mit Herrn Stripling?";
    const U2 = await person("U2");
    await antrag("FIAON-P275MV", U2.id, U2.mail, { status: "pending_payment", betrag: 59.99, pack: "pro" });
    const s2b = await lauf1(U2.mail, "Wann bekomme ich meine Kreditkarte?", {
      einordnung: { kategorien: ["status_frage"], dringend: false, sprache: "de", fragen: ["Wann kommt die Karte?"], zusammenfassung: "Fragt nach der Karte.", flags: {} },
      antwort: { antwort: SCHWACH_U, naechster_schritt: { art: "zahlung", url: null, text: "x" }, belege: [], fragen_beantwortet: [], merken: [] },
      umformuliert: { antwort: GUT_U.replace(/FIAON-P275MU/g, "FIAON-P275MV"), naechster_schritt: { art: "zahlung", url: null, text: "x" }, belege: [], fragen_beantwortet: [], merken: [] },
    });
    const maengel = String(OPENAI.filter((x) => /Deine Antwort hat diese Mängel/.test(x.alles)).pop()?.alles ?? "");
    ok(/Fordere ihn klar auf, jetzt zu zahlen/.test(maengel) && /Sag, was die Zahlung ihm bringt/.test(maengel) && !/End mit EINER Frage zum Termin/.test(maengel),
      "Schwacher Entwurf: zweiter Entwurf verlangt Nutzen und Bitte — keine Terminfrage mehr");
    ok(s2b.z?.aktion === "auto_beantwortet" && String(s2b.z?.antwort).includes(agent.AKTIVIERUNG_SATZ) && /Zahlen Sie jetzt die Aktivierung/.test(String(s2b.z?.antwort)), `… und der verkaufende zweite Entwurf geht raus (${s2b.z?.aktion})`);

    // ── DB 3 · KÜNDIGUNG UND WIDERRUF BLEIBEN ÜBERGABE ───────────────────────
    abschnitt("DB 3 · Kündigung (nicht gebucht) und Widerruf bleiben beim Menschen");
    const K = await person("K", { werbesperre: true });
    await antrag("FIAON-P275MK", K.id, K.mail, { status: "paid" });
    await rate("FIAON-P275MK", 1, "bezahlt", heute);
    const s3 = await lauf1(K.mail, "Wie kann ich meinen Vertrag kündigen?", {
      einordnung: { kategorien: ["kuendigung"], dringend: false, sprache: "de", fragen: ["Wie kündigen?"], zusammenfassung: "Fragt nach der Kündigung.", flags: { kuendigung: true } },
      antwort: { antwort: "Gern erkläre ich es Ihnen: Ihre Kündigung nehmen wir formlos entgegen. Möchten Sie, dass ich Ihren Vertrag jetzt kündige? Ein kurzes Ja genügt.", naechster_schritt: { art: "erledigt", url: null, text: "" }, belege: [], fragen_beantwortet: [], merken: [] },
    });
    ok(s3.z?.aktion === "entwurf" && s3.gesendet === 0 && /Kündigung angesprochen, aber nicht gebucht/.test(String(s3.z?.begruendung)), `Kündigung angesprochen, nicht gebucht → Entwurf + Übergabe (${String(s3.z?.begruendung).slice(0, 80)})`);
    ok((await uebergabe(K.id)).length === 1, "… mit Aufgabe beim Menschen");
    const W = await person("W");
    await antrag("FIAON-P275MW", W.id, W.mail, { status: "paid" });
    await rate("FIAON-P275MW", 1, "bezahlt", heute);
    const s3b = await lauf1(W.mail, "Ich widerrufe hiermit den Vertrag fristgerecht.", {
      einordnung: { kategorien: ["rechtlich"], dringend: false, sprache: "de", fragen: [], zusammenfassung: "Widerruft.", flags: { widerruf: true } },
      antwort: { antwort: "Danke, Ihr Schreiben ist bei uns. Ihren Widerruf prüft unsere Geschäftsführung; Sie bekommen dazu eine schriftliche Nachricht.", naechster_schritt: { art: "erledigt", url: null, text: "" }, belege: [], fragen_beantwortet: [], merken: [] },
    });
    ok(s3b.z?.aktion === "entwurf" && /Übergabe an den Betreuer: rechtliches Anliegen|Widerruf/.test(String(s3b.z?.begruendung)) && (await uebergabe(W.id)).length === 1, `Widerruf → Entwurf + Übergabe (${String(s3b.z?.begruendung).slice(0, 70)})`);
    ok(s3b.karteRufe.length === 0, "Widerruf: kein Kartenlink, nichts verkauft");

    // ── DB 4 · LEERE MAIL MIT BILD SETZT KEINE WERBESPERRE ───────────────────
    abschnitt("DB 4 · Mail ohne eigenen Text (nur Bild) — keine Werbesperre, keine Abmeldung");
    const B = await person("B");
    await antrag("FIAON-P275MB", B.id, B.mail, { status: "paid" });
    await rate("FIAON-P275MB", 1, "bezahlt", heute);
    const s4 = await lauf1(B.mail, "Sent from Yahoo Mail for iPhone", {
      einordnung: { kategorien: ["abmeldung", "sonstiges"], dringend: false, sprache: "de", fragen: [], zusammenfassung: "Will keine Mails mehr.", flags: { stopp: true } },
      werkzeuge: [{ name: "werbesperre_setzen", args: { zitat: "Sent from Yahoo Mail for iPhone" } }, { name: "notiz_an_betreuer", args: { text: "Kunde hat ein Bild per Mail geschickt (Mail ohne Text).", dringend: false, anrufen: false } }],
      antwort: { antwort: "Danke für Ihr Bild — es ist bei uns angekommen und fließt in Ihre Bonitätsanalyse ein. Ihre Visa-Kreditkarte bleibt unser gemeinsames Ziel; Ihr Weg dorthin läuft weiter.", naechster_schritt: { art: "bereich", url: null, text: "Zu meinem Bereich" }, belege: [], fragen_beantwortet: [], merken: [] },
    }, { betreff: "Re: Ihre Monatsrate 2", anhang: true });
    const [pB] = (await sql`SELECT werbung_gesperrt_am FROM fiaon_persons WHERE id = ${B.id}`) as any[];
    const wsB = s4.handlungen.find((h: any) => h.werkzeug === "werbesperre_setzen");
    ok(!pB?.werbung_gesperrt_am && wsB && wsB.ok === false, `Werbesperre NICHT gesetzt — das Werkzeug lehnt ab („${String(wsB?.ergebnis ?? "").slice(0, 80)}“)`);
    ok(!String(s4.z?.kategorie ?? "").includes("abmeldung") && !(Array.isArray(s4.z?.kategorien) ? s4.z.kategorien : []).includes("abmeldung"), `Kategorie ohne „abmeldung“ (${JSON.stringify(s4.z?.kategorien)})`);
    ok(!lies(s4.z?.flags)?.stopp, "Merker stopp zurückgenommen");
    ok(s4.z?.aktion === "auto_beantwortet" && (await uebergabe(B.id)).length === 0, `Bild still notiert, Antwort geht selbst raus (${s4.z?.aktion}; ${String(s4.z?.begruendung ?? "").slice(0, 80)})`);
    ok(/notiz_an_betreuer, still|still festhalten|still fest mit notiz_an_betreuer/.test(s4.kiAntwort[0]?.alles ?? ""), "Anhang-Hinweis: still notieren, keine Aufgabe");

    // ── DB 5 · RÜCKRUFWUNSCH ─────────────────────────────────────────────────
    abschnitt("DB 5 · Ausdrücklicher Rückrufwunsch: Aufgabe mit Zeit — Antwort geht selbst raus");
    const R = await person("R");
    await antrag("FIAON-P275MR", R.id, R.mail, { status: "paid" });
    await rate("FIAON-P275MR", 1, "bezahlt", heute);
    const morgen = new Date(Date.now() + 26 * 3_600_000).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
    const s5 = await lauf1(R.mail, "Bitte rufen Sie mich morgen um 10 Uhr an.", {
      einordnung: { kategorien: ["termin"], dringend: false, sprache: "de", fragen: [], zusammenfassung: "Will Rückruf.", flags: { rueckruf_wunsch: true } },
      werkzeuge: [{ name: "aufgabe_an_betreuer", args: { titel: "Rückruf morgen 10 Uhr", text: "Kunde bittet um Rückruf morgen 10 Uhr.", faellig_in_tagen: 1, dringend: false, kollege: "", rueckruf_am: `${morgen} 10:00` } }],
      antwort: { antwort: "Gern, das ist eingetragen: Unser Team ruft Sie morgen um 10 Uhr an. Ihre Visa-Kreditkarte bleibt dabei unser gemeinsames Ziel.", naechster_schritt: { art: "rueckruf", url: null, text: "" }, belege: [], fragen_beantwortet: [], merken: [] },
    });
    const au = s5.handlungen.find((h: any) => h.werkzeug === "aufgabe_an_betreuer");
    ok(au?.ok && /meldet sich/.test(String(au?.ergebnis)), `Aufgabe mit Rückruf: Zusage bleibt („${String(au?.ergebnis ?? "").slice(0, 70)}“)`);
    ok(s5.z?.aktion === "auto_beantwortet" || /Lage oder Flag|sauber/.test(String(s5.z?.begruendung ?? "")), `Rückruf eingeplant → keine zweite Übergabe (${s5.z?.aktion}; ${String(s5.z?.begruendung ?? "").slice(0, 80)})`);
    ok((await uebergabe(R.id)).length === 0, "Keine Übergabe „Kunde hat geschrieben“ zusätzlich zur Rückruf-Aufgabe");
    // Eine Aufgabe ohne Rückruf ist intern — kein „meldet sich heute“ für den Kunden.
    const au2 = await wz.aufgabeAnBetreuer.ausfuehren({ titel: "Adresse ändern", text: "Kunde meldet eine neue Anschrift.", faellig_in_tagen: 1, dringend: false, kollege: "", rueckruf_am: "" },
      { personId: R.id, ref: "FIAON-P275MR", postfach: PF, postmeisterId: null, kundenlage: "aktiv" as any });
    ok(au2.ok && /meldet sich nur, wenn/.test(au2.ergebnis) && (au2.daten as any)?.intern === true, `Aufgabe ohne Rückruf: intern („${au2.ergebnis.slice(0, 70)}…“)`);

    // ── DB 6 · KUNDE VON FIAON GLOBAL ────────────────────────────────────────
    abschnitt("DB 6 · Kunde von FIAON Global bleibt bei Justin (E-272)");
    const G = await person("G");
    await sql`INSERT INTO fiaon_global_angebote (angebot_ref, person_id, fassung, kunde, parameter, buergin, status, gueltig_bis)
              VALUES ('FIAON-IA-E275P-1', ${G.id}, 'pruefstand', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, 'offen', CURRENT_DATE + 14)`;
    const s6 = await lauf1(G.mail, "Wie ist der Stand meines Angebots?", {
      einordnung: { kategorien: ["status_frage"], dringend: false, sprache: "de", fragen: ["Stand?"], zusammenfassung: "Fragt nach dem Angebot.", flags: {} },
      antwort: { antwort: "Danke für Ihre Nachricht. Ihre Ansprechperson bei FIAON Global meldet sich bei Ihnen.", naechster_schritt: { art: "wartet_auf_uns", url: null, text: "" }, belege: [], fragen_beantwortet: [], merken: [] },
    });
    ok(s6.z?.aktion === "entwurf" && s6.gesendet === 0, `Global-Kunde: nie automatisch (${s6.z?.aktion}; ${String(s6.z?.begruendung ?? "").slice(0, 80)})`);
    ok(!/DU ERLEDIGST ES SELBST/.test(String(s6.kiAntwort[0]?.system ?? "")), "Global-Kunde: kein Block „DU ERLEDIGST ES SELBST“ (es gilt GLOBAL_AUFTRAG)");

    // ── DB 7 · DIE ECHTE FUNKTION AUS DEM BEREICH KARTE (Aufruf, ohne Versand) ─
    abschnitt("DB 7 · karte_senden mit der echten karteEinladungFuerPerson (Netz abgeklemmt)");
    {
      wz.KARTE_EINLADUNG_QUELLE.fn = undefined;
      const echt = await wz.karteEinladungLaden();
      ok(typeof echt === "function", "karteEinladungFuerPerson ist im Bereich Karte vorhanden");
      if (echt) {
        const r = await echt(S.id, { erneut: true, quelle: "postmeister", akteurName: "Mara (Postmeister)", postmeisterId: null }).catch((e: any) => ({ ok: false, aktion: "wirft", grund: String(e?.message || e) }));
        ok(r && typeof r.ok === "boolean" && typeof (r as any).aktion === "string", `Aufruf mit der Postmeister-Signatur liefert ein Ergebnis ohne Ausnahme (aktion ${(r as any)?.aktion}, ok ${r?.ok})`);
        const w = await wz.karteSenden.ausfuehren({ anlass: "Prüfstand" }, { personId: S.id, ref: "FIAON-P275MS", postfach: PF, postmeisterId: null, kundenlage: "rate_ueberfaellig" as any });
        ok(w.ok ? !!w.ergebnis : /schreib NICHT/.test(String(w.fehler)), `Werkzeug liest das Ergebnis: ${w.ok ? `„${w.ergebnis.slice(0, 70)}“` : `Fehler „${String(w.fehler).slice(0, 90)}“`}`);
      }
    }

    abschnitt("DB 8 · Nichts ging hinaus");
    ok(FREMD.filter((u) => !/brevo|make\.com|hook\./i.test(u)).length === 0, `Kein fremdes Netz außer abgeklemmten Mail-Diensten (${FREMD.slice(0, 3).join(", ") || "keins"})`);
  } finally {
    const pids = Object.values(personen);
    await sql`DELETE FROM fiaon_betreiber_todo_beitraege WHERE todo_id IN (SELECT id FROM fiaon_betreiber_todos WHERE created_at >= ${START})`.catch(() => {});
    await sql`DELETE FROM fiaon_betreiber_todos WHERE created_at >= ${START}`.catch(() => {});
    await sql`DELETE FROM fiaon_postmeister WHERE gmail_id LIKE 'e275m-%'`.catch(() => {});
    await sql`DELETE FROM fiaon_contact_log WHERE ref = ANY(${refs}) OR person_id = ANY(${pids})`.catch(() => {});
    await sql`DELETE FROM fiaon_termine WHERE person_id = ANY(${pids})`.catch(() => {});
    await sql`DELETE FROM fiaon_rueckrufe WHERE person_id = ANY(${pids})`.catch(() => {});
    await sql`DELETE FROM fiaon_mara_gedaechtnis WHERE person_id = ANY(${pids})`.catch(() => {});
    await sql`DELETE FROM fiaon_mail_log WHERE person_id = ANY(${pids})`.catch(() => {});
    await sql`DELETE FROM fiaon_konto_karte WHERE person_id = ANY(${pids})`.catch(() => {});
    await sql`DELETE FROM fiaon_global_angebote WHERE angebot_ref LIKE 'FIAON-IA-E275P-%'`.catch(() => {});
    for (const t of ["fiaon_kuendigung_urkunden", "fiaon_kuendigungen", "cancellation_requests"]) {
      await sql.unsafe(`DELETE FROM ${t} WHERE ref = ANY($1)`, [refs] as any).catch(() => {});
    }
    await sql`DELETE FROM fiaon_abo_raten WHERE ref = ANY(${refs})`.catch(() => {});
    await sql`DELETE FROM fiaon_applications WHERE ref = ANY(${refs})`.catch(() => {});
    await sql`DELETE FROM fiaon_persons WHERE id = ANY(${pids})`.catch(() => {});
    await sql`DELETE FROM fiaon_ki_nutzung WHERE created_at >= ${START}`.catch(() => {});
    await sql`DELETE FROM fiaon_settings WHERE key = ANY(${EINSTELLUNGEN})`.catch(() => {});
    for (const z of einstellungVorher) await sql`INSERT INTO fiaon_settings (key, value) VALUES (${z.key}, ${z.value}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`.catch(() => {});
    const [rest] = (await sql`SELECT (SELECT COUNT(*) FROM fiaon_persons WHERE person_ref LIKE 'PRUEF275M-%')::int AS p, (SELECT COUNT(*) FROM fiaon_applications WHERE ref LIKE 'FIAON-P275M%')::int AS a`) as any[];
    console.log(`\n  ℹ aufgeräumt — übrig: ${rest?.p ?? "?"} Personen, ${rest?.a ?? "?"} Bestellungen`);
    await sql.end({ timeout: 2 }).catch(() => {});
  }
}

console.log(`\n${fehler ? "✗" : "✓"} ${geprueft - fehler}/${geprueft} Prüfungen bestanden${MIT_DB ? " (mit DB)" : " (offline)"}`);
process.exit(fehler ? 1 : 0);
