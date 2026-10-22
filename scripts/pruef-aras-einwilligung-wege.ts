// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-408 (Scheibe 3, 22.10.2026): DIE WEGE ZUM „JA ZUM ANRUF“ — Akte, Mara per WhatsApp, Meta-Formular
//
// Ab Fr 23.10. darf ARAS jeden anrufen, der eingewilligt hat. Drei Wege sammeln das Ja (fiaon_telefon_einwilligung):
// die Akte (Art „chef“, nur mit Pflicht-Bestätigung), Mara auf WhatsApp (angehängte Frage, klares JA → „zuruf_whatsapp“)
// und das Meta-Formular (Kästchen oder Frage → „meta_kaestchen“). Dazu der Widerruf (Akte und WhatsApp).
//
//   A  REIN (immer, ohne Datenbank): die Sätze buchstabengetreu und an genau einem Ort; der JA-Erkenner (grün und rot);
//      der Widerrufs-Erkenner; das Urteil „darf Mara fragen?“ mit Rot-Proben; die Zeile der Akte; die Meta-Erkennung;
//      Quelltext-Wachen (Eingang vor Mara, die Frage nur als eigener Absatz, Routen mit darfAnKunde, Knöpfe der Karte).
//   B  LOKALE DATENBANK (DATABASE_URL auf 127.0.0.1:54329/fiaon_pruefstand…): die echten Funktionen an erfundenen
//      Menschen — Akte-Eintrag (ohne Bestätigung nichts), Widerruf, WhatsApp-JA mit beiden Nachrichten und Rot-Proben,
//      Mara fragt (Attrappe statt waSenden — es geht nichts raus), Anhängen an Maras Antwort, Widerruf per WhatsApp,
//      Meta-Einspielen (Kästchen → meta_kaestchen; nicht angehakt, Pflicht, ohne Kästchen → nichts).
//   C  BROWSER (--server http://127.0.0.1:<port> --geheim <SESSION_SECRET des lokalen Servers> [--fotos <ordner>]): die
//      echte Akte im Chromium — Zeile lesen, „Ja zum Anruf eintragen“ (Dialog, ohne Häkchen grau), eintragen, widerrufen,
//      „Mara fragt nach dem Ja“ (ohne WhatsApp-Zugang: der Grund bleibt rot stehen), Fotos am Handy (390 px) und Rechner.
//
//   env -i HOME="$HOME" PATH="$PATH" TZ=Europe/Berlin node_modules/.bin/tsx scripts/pruef-aras-einwilligung-wege.ts   (nur A)
//   env -i HOME="$HOME" PATH="$PATH" TZ=Europe/Berlin CRONS=aus \
//     DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_ja?sslmode=require' \
//     node_modules/.bin/tsx scripts/pruef-aras-einwilligung-wege.ts [--server http://127.0.0.1:5321 --geheim … --fotos …]
//
// Verschickt nichts: Schlüssel in der Umgebung → Abbruch; „Mara fragt“ läuft in B über eine Attrappe, in C über einen
// Server ohne WhatsApp-Zugang. Alle Menschen sind erfunden (example.com nach RFC 2606, Nummern nur in der lokalen DB).
// Danach die Prüfdatenbank verwerfen (dropdb).
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { randomBytes, createHmac } from "node:crypto";

if (!process.env.DATABASE_URL) process.env.DATABASE_URL = "postgresql://pruef@127.0.0.1:9/keine";
const URL_DB = String(process.env.DATABASE_URL);
const arg = (name: string): string | null => { const i = process.argv.indexOf(name); return i >= 0 ? String(process.argv[i + 1] ?? "") : null; };
const SERVER = arg("--server");
const GEHEIM = arg("--geheim");
const FOTOS = arg("--fotos");
const LOKAL_DB = /@(127\.0\.0\.1|localhost):54329\/fiaon_pruefstand[A-Za-z0-9_]*(\?|$)/.test(URL_DB);

for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "TWILIO_AUTH_TOKEN", "WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID", "WHATSAPP_WABA_ID", "META_APP_SECRET", "DATABASE_URL_EXTERN"]) {
  if (process.env[k]) { console.error(`ABBRUCH: ${k} ist gesetzt — dieser Prüfstand läuft nur ohne Schlüssel und nur gegen eine lokale Datenbank.`); process.exit(3); }
}
if (SERVER !== null && (!LOKAL_DB || !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(SERVER) || !GEHEIM)) {
  console.error("ABBRUCH: Teil C nur mit --server http://127.0.0.1:<port>, --geheim <SESSION_SECRET des LOKALEN Servers> und DATABASE_URL auf die lokale Prüfdatenbank.");
  process.exit(3);
}

let gut = 0, schlecht = 0;
const teilZahl: Record<string, [number, number]> = {};
let teil = "A";
function ok(b: unknown, was: string, extra: unknown = "") {
  teilZahl[teil] ??= [0, 0];
  if (b) { gut++; teilZahl[teil][0]++; console.log(`  ✓ ${was}`); }
  else { schlecht++; teilZahl[teil][1]++; console.log(`  ✗ ${was}${extra !== "" ? ` — ${typeof extra === "string" ? extra : JSON.stringify(extra).slice(0, 600)}` : ""}`); }
}
const lies = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
/** Kommentare raus — wer Quelltext prüft, darf die Begründung nicht treffen (AGENTS.md). */
const ohneKommentare = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
/** Der Block zwischen zwei Marken (wer eine Reihenfolge prüft, schneidet den Block heraus). */
function ausschnitt(t: string, von: string, bis: string): string {
  const a = t.indexOf(von);
  if (a < 0) return "";
  const b = t.indexOf(bis, a + von.length);
  return b < 0 ? t.slice(a) : t.slice(a, b);
}
const warte = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Die freigegebenen Sätze, AUSGESCHRIEBEN — nicht aus der Konstante gelesen (sonst prüfte sie sich selbst).
/** Fassung 2 (freigegeben 22.10.2026, Koordination): der Widerruf steht VOR dem Ja. */
const FRAGE = "Dürfen wir Sie dazu auch kurz anrufen – auch ARAS, unsere digitale Mitarbeiterin (eine KI)? Antworten Sie einfach mit JA. Sie können es jederzeit mit einer kurzen Nachricht zurücknehmen.";
/** Fassung 1 (Auftrag 22.10.2026) — geht nicht mehr raus, ein Ja darauf zählt weiter. */
const FRAGE_ALT = "Dürfen wir Sie dazu auch kurz anrufen – auch ARAS, unsere digitale Mitarbeiterin (eine KI)? Antworten Sie einfach mit JA.";
const SPERRE_SATZ = "Verstanden – wir rufen Sie nicht mehr an.";
const DANKE = "Vielen Dank, das ist notiert. Sie können es jederzeit mit einer kurzen Nachricht zurücknehmen.";
const BESTAETIGUNG = "Der Kunde hat mir gerade im Gespräch gesagt, dass FIAON ihn anrufen darf, auch ARAS (KI)";

// ═══════════════════════════════════════════════════════════════════════════
// A — REIN
// ═══════════════════════════════════════════════════════════════════════════
async function teilA() {
  teil = "A";
  const J = await import("../shared/fiaon-ja-zum-anruf");

  console.log("── A1 · Die Sätze (buchstabengetreu wie im Auftrag)");
  ok(J.JA_FRAGE_WA === FRAGE, "die Frage, die Mara anhängt (Fassung 2)", J.JA_FRAGE_WA);
  ok(/\? Antworten Sie einfach mit JA\. Sie können es jederzeit mit einer kurzen Nachricht zurücknehmen\.$/.test(J.JA_FRAGE_WA), "der Widerruf steht VOR dem Ja — in der Frage selbst (DSGVO Art. 7 Abs. 3)");
  ok(J.JA_FRAGE_FASSUNGEN.length === 2 && J.JA_FRAGE_FASSUNGEN[0] === FRAGE && J.JA_FRAGE_FASSUNGEN[1] === FRAGE_ALT, "beide Fassungen bleiben erkennbar — die neueste vorn, die alte dahinter");
  ok(J.jaFrageIn(`Gerne.\n\n${FRAGE}`) === FRAGE && J.jaFrageIn(`Gerne.\n\n${FRAGE_ALT}`) === FRAGE_ALT, "der Erkenner nennt die Fassung, die er gelesen hat (die alte steckt in der neuen — die neue gewinnt)");
  ok(J.ANRUF_SPERRE_WA === SPERRE_SATZ, "Maras Satz nach „nicht mehr anrufen“", J.ANRUF_SPERRE_WA);
  ok(J.JA_AKTE_BESTAETIGUNG === BESTAETIGUNG, "die Pflicht-Bestätigung im Dialog der Akte", J.JA_AKTE_BESTAETIGUNG);
  ok(J.JA_DANKE_WA === DANKE && !/\b(?:gleich|heute|morgen|sofort|rufen\s+sie|ruft\s+sie|melden\s+uns)\b/i.test(J.JA_DANKE_WA), "Maras Dank: notiert, jederzeit zurückzunehmen — kein Zeitpunkt, kein Anruf-Versprechen");
  ok(/ARAS/.test(FRAGE) && /\(eine KI\)/.test(FRAGE), "die Frage nennt ARAS als KI (KI-VO Art. 50)");
  const { sendePruefung, inkassoVerdacht } = await import("../server/lib/fiaon-whatsapp");
  ok(sendePruefung(FRAGE).length === 0 && !inkassoVerdacht(FRAGE), "die Frage geht durch die Wand von waSenden (Wortwand, Du-Form, Inkasso)", sendePruefung(FRAGE));
  ok(sendePruefung(DANKE).length === 0 && sendePruefung(SPERRE_SATZ).length === 0, "der Dank und der Sperr-Satz gehen durch dieselbe Wand", [sendePruefung(DANKE), sendePruefung(SPERRE_SATZ)]);
  ok(sendePruefung(`Gerne, hier ist Ihr Link: https://www.fiaon.com/a/abc\n\n${FRAGE}`).length === 0, "eine Antwort mit angehängter Frage geht durch die Wand");

  console.log("── A2 · Ein Satz, ein Ort");
  const fundorte = (stueck: string) => {
    const f = new Set<string>();
    for (const wurzel of ["client/src", "server", "shared"]) {
      for (const rel of readdirSync(new URL(`../${wurzel}`, import.meta.url), { recursive: true }) as string[]) {
        if (!/\.(ts|tsx)$/.test(rel)) continue;
        if (lies(`${wurzel}/${rel}`).includes(stueck)) f.add(`${wurzel}/${rel}`);
      }
    }
    return Array.from(f);
  };
  for (const [name, s] of [["die Frage", "unsere digitale Mitarbeiterin (eine KI)? Antworten Sie einfach mit JA"], ["der Dank", "Sie können es jederzeit mit einer kurzen Nachricht zurücknehmen"], ["die Bestätigung", "dass FIAON ihn anrufen darf, auch ARAS (KI)"], ["der Sperr-Satz", "wir rufen Sie nicht mehr an"]] as const) {
    const orte = fundorte(s);
    ok(orte.length === 1 && orte[0] === "shared/fiaon-ja-zum-anruf.ts", `${name} steht genau einmal im Code — in shared/fiaon-ja-zum-anruf.ts`, orte);
  }

  console.log("── A3 · Der JA-Erkenner (klar mit JA)");
  const gruen = ["Ja", "JA", "Ja.", "Ja!", "ja gerne", "Ja gerne!", "Ja, passt", "Ja passt", "Ja, sehr gerne", "Jaaa", "Ja klar", "Ja natürlich",
    "Ja, dürfen Sie", "Ja, Sie dürfen", "Ja bitte", "Gerne", "Sehr gerne", "Ja 👍", "Ja, gerne. Danke!", "Ja, kein Problem", "Ja, auch ARAS", "Yes",
    "Jawohl", "Ja, einverstanden", "Na klar", "Auf jeden Fall", "Ja genau", "Ja, rufen Sie mich gerne an", "Ok, gerne", "Hallo, ja gerne 😊", "Ja ❤️"];
  const gruenFalsch = gruen.filter((t) => !J.istKlaresJa(t));
  ok(gruenFalsch.length === 0, `${gruen.length} klare Ja werden erkannt`, gruenFalsch);
  const rot = ["nein", "Nein danke", "Nee", "lieber nicht", "Bitte nicht anrufen", "ja, aber nicht anrufen", "Ja aber bitte nur WhatsApp", "Ja, aber nicht ARAS",
    "ja nein", "Ja? Wer ist da?", "Ja?", "jaja", "ja ja", "Ja, ab 18 Uhr", "Ja gerne per WhatsApp", "Ok", "👍", "Klar", "Alles klar", "Ja 😡", "Ja 😂",
    "Ja kein Interesse", "Ja, später", "Ja bitte nicht", "Ja, ohne KI", "Nicht anrufen, ja?", "Kein Anruf bitte", "Ja schreiben Sie mir lieber",
    "Ja, ich bin Herr Müller", "Ja 0171 123456", "", "   ", "Ja gerne, aber erst nächste Woche, ich bin im Urlaub und kann gerade nicht telefonieren"];
  const rotFalsch = rot.filter((t) => J.istKlaresJa(t));
  ok(rotFalsch.length === 0, `Rot-Proben: ${rot.length} Antworten, die KEIN klares Ja sind („nein“, „ja, aber nicht anrufen“, „Ja?“, „Ok“, „jaja“ …)`, rotFalsch);

  console.log("── A4 · Widerruf („bitte nicht anrufen“) und Telefonsperre („nicht mehr anrufen“)");
  const weg = ["Bitte nicht mehr anrufen", "Rufen Sie mich bitte nicht mehr an", "Ich möchte keine Anrufe", "Ich will nicht angerufen werden",
    "Keine Anrufe mehr bitte", "Bitte keine Anrufe", "Ich widerrufe meine Einwilligung zu Anrufen", "Ich nehme mein Ja zum Anruf zurück",
    "Nicht telefonisch, nur WhatsApp", "Hallo, ich habe gesagt, Sie sollen mich nicht mehr anrufen.", "ruft mich nicht an!",
    "Bitte rufen Sie mich doch nicht mehr an."];
  const wegFalsch = weg.filter((t) => !J.istNeinZumAnruf(t));
  ok(wegFalsch.length === 0, `${weg.length} Widerrufe werden erkannt`, wegFalsch);
  const bleibt = ["Sie haben mich nicht angerufen", "Warum haben Sie mich nicht mehr angerufen?", "Ich habe keine Anrufe bekommen", "Ich kann gerade nicht anrufen",
    "Ja gerne, rufen Sie mich an", "Ich ziehe die Kündigung zurück", "Ich widerrufe den Vertrag", "Rückruf bitte morgen", "Ja"];
  const bleibtFalsch = bleibt.filter((t) => J.istNeinZumAnruf(t));
  ok(bleibtFalsch.length === 0, `Rot-Proben: ${bleibt.length} Sätze nehmen nichts zurück (Klage über die Vergangenheit, Vertrag, Rückruf-Wunsch)`, bleibtFalsch);
  const warum = ["Warum rufen Sie mich nicht an?", "Wieso ruft ihr mich nicht mehr an", "Weshalb rufen Sie mich nie zurück?"];
  ok(warum.every((t) => !J.istNeinZumAnruf(t) && !J.istAnrufSperreWunsch(t)), "Rot-Probe: „Warum rufen Sie mich nicht an?“ will einen Anruf — weder Widerruf noch Sperre", warum.filter((t) => J.istNeinZumAnruf(t) || J.istAnrufSperreWunsch(t)));
  const sperre = ["Bitte nicht mehr anrufen", "Keine Anrufe mehr!", "Rufen Sie mich nie wieder an.", "Hören Sie auf anzurufen", "Hören Sie auf, mich anzurufen.",
    "Ich will nicht mehr angerufen werden", "Keine weiteren Anrufe bitte", "Rufen Sie mich bitte nicht mehr an", "Nein, rufen Sie mich nie wieder an!", "Bitte rufen Sie mich doch nicht mehr an.",
    "Hört endlich auf mit den Anrufen"];
  const sperreFalsch = sperre.filter((t) => !J.istAnrufSperreWunsch(t) || !J.istNeinZumAnruf(t));
  ok(sperreFalsch.length === 0, `${sperre.length} klare Sätze → Telefonsperre (und Widerruf)`, sperreFalsch);
  const weich = ["Bitte nicht anrufen, bin auf Arbeit", "bitte jetzt nicht anrufen", "Ich möchte keine Anrufe", "Rufen Sie mich nicht vor 18 Uhr an", "Bitte keine Anrufe heute"];
  const weichFalsch = weich.filter((t) => J.istAnrufSperreWunsch(t) || !J.istNeinZumAnruf(t));
  ok(weichFalsch.length === 0, `${weich.length} weiche Sätze → nur das Ja zurück, KEINE Sperre`, weichFalsch);
  const keineSperre = ["Können Sie mich nicht mehr anrufen?", "Sie müssen mich nicht mehr anrufen, ich habe schon bezahlt", "Warum haben Sie mich nicht mehr angerufen",
    "Sie haben mich nie wieder angerufen", "Rufen Sie mich nie wieder an?"];
  const keineSperreFalsch = keineSperre.filter((t) => J.istAnrufSperreWunsch(t));
  ok(keineSperreFalsch.length === 0, `Rot-Proben: ${keineSperre.length} Sätze ohne Sperre (Frage, „müssen nicht“, Vergangenheit)`, keineSperreFalsch);

  console.log("── A5 · Darf Mara fragen? (das Urteil)");
  const jetzt = new Date("2026-10-22T12:00:00Z");
  type Fakten = import("../shared/fiaon-ja-zum-anruf").JaFrageFakten;
  const basis: Fakten = { nummer: "4915900408000", fensterOffen: true, hatJa: false, telefonSperre: false, global: false, werbeGrund: null, zuletztGefragtAm: null, wartetAufAntwort: false, jetzt };
  ok(J.jaFrageUrteil(basis).darf, "alles frei → Mara darf fragen");
  const proben: [string, Partial<Fakten>, RegExp][] = [
    ["kein offenes Fenster → keine Frage", { fensterOffen: false }, /Fenster ist zu/],
    ["schon ein Ja → keine Frage", { hatJa: true }, /schon Ja/],
    ["nie auf WhatsApp geschrieben → keine Frage", { nummer: null }, /noch nicht auf WhatsApp/],
    ["Telefonsperre → keine Frage", { telefonSperre: true }, /Telefonsperre/],
    ["FIAON Global → keine Frage", { global: true }, /Global/],
    ["Werbesperre → keine Frage", { werbeGrund: "Werbesperre" }, /Werbesperre/],
    ["vor 10 Tagen gefragt → keine Frage (30 Tage)", { zuletztGefragtAm: new Date(jetzt.getTime() - 10 * 86_400_000) }, /schon gefragt – wieder ab/],
    ["Knopf: er wartet auf eine Antwort → erst antworten", { wartetAufAntwort: true }, /wartet gerade auf eine Antwort/],
  ];
  for (const [name, aend, muster] of proben) {
    const u = J.jaFrageUrteil({ ...basis, ...aend });
    ok(!u.darf && muster.test(String(u.grund)), `Rot-Probe: ${name}`, u);
  }
  ok(J.jaFrageUrteil({ ...basis, zuletztGefragtAm: new Date(jetzt.getTime() - 31 * 86_400_000) }).darf, "vor 31 Tagen gefragt → Mara darf wieder");
  ok(J.antwortOhneFrage("Gerne, hier ist Ihr Link: https://www.fiaon.com/zahlung/X?ref=1") && !J.antwortOhneFrage("Soll ich Ihnen den Link schicken?")
    && !J.antwortOhneFrage(`Gerne.\n\n${FRAGE}`) && !J.antwortOhneFrage(""), "an eine Antwort, die selbst fragt (oder schon gefragt hat), kommt die Frage nie");
  ok(J.jaFrageIn(`Gerne.\n\n${FRAGE}`) === FRAGE && J.jaFrageIn("Dürfen wir Sie anrufen?") === null, "die Frage wird im Verlauf nur am genauen Wortlaut erkannt");
  ok(/KEIN klares JA/.test(String(J.jaHinweisFuerMara({ jaGespeichert: false, zurueckgenommen: false, frageOffen: true })))
    && /gespeichert/.test(String(J.jaHinweisFuerMara({ jaGespeichert: true, zurueckgenommen: false, frageOffen: true })))
    && /ZURÜCKGENOMMEN/.test(String(J.jaHinweisFuerMara({ jaGespeichert: false, zurueckgenommen: true, frageOffen: false })))
    && J.jaHinweisFuerMara({ jaGespeichert: false, zurueckgenommen: false, frageOffen: false }) === null, "Maras Hinweis: kein klares Ja / gespeichert / zurückgenommen / nichts");
  ok(/NICHT MEHR ANGERUFEN/.test(String(J.jaHinweisFuerMara({ jaGespeichert: false, zurueckgenommen: true, frageOffen: true, gesperrt: true }))), "Maras Hinweis nach einer Sperre: „wir rufen ihn nicht mehr an“ geht vor allem anderen");

  console.log("── A6 · Die Zeile der Akte");
  const seit = "2026-10-22T09:15:00Z", weg2 = "2026-10-23T08:00:00Z";
  ok(J.jaZeile(null) === "Noch kein Ja zum Anruf", "ohne Ja: „Noch kein Ja zum Anruf“");
  ok(J.jaZeile({ id: 1, art: "antrag_kaestchen", seit, von: null, widerrufenAm: null }) === "Ja zum Anruf: seit 22.10. (Antrag-Kästchen)", "Antrag-Kästchen");
  ok(J.jaZeile({ id: 2, art: "zuruf_whatsapp", seit, von: null, widerrufenAm: null }) === "Ja zum Anruf: seit 22.10. (WhatsApp)", "WhatsApp");
  ok(J.jaZeile({ id: 3, art: "chef", seit, von: "Lucas Böhnert", widerrufenAm: null }) === "Ja zum Anruf: seit 22.10. (im Gespräch mit Lucas Böhnert)", "im Gespräch mit …");
  ok(J.jaZeile({ id: 4, art: "zuruf_whatsapp", seit, von: null, widerrufenAm: weg2 }) === "Ja zum Anruf: seit 22.10. (WhatsApp) · Widerrufen am 23.10.", "… · Widerrufen am …");
  ok(J.jaZeile({ id: 5, art: "meta_kaestchen", seit: "2026-10-21T22:30:00Z", von: null, widerrufenAm: null }) === "Ja zum Anruf: seit 22.10. (Meta-Formular)", "Datum in Berliner Zeit (22:30 UTC = 22.10. 00:30)");

  console.log("── A7 · Meta: das Formular fragt nach dem Ja zum Anruf");
  const M = await import("../server/lib/fiaon-meta-leads");
  const kasten = "Ja, FIAON darf mich telefonisch zu meiner Anfrage anrufen – auch ARAS, die digitale Mitarbeiterin von FIAON (eine KI). Freiwillig, jederzeit widerrufbar.";
  const form = { fragen: [{ key: "full_name", label: "Full name" }, { key: "phone_number", label: "Phone number" }, { key: "anruf_einwilligung", label: "Dürfen wir Sie anrufen – auch ARAS (eine KI)?" }],
    kaestchen: [{ key: "anruf_einwilligung", text: kasten, is_required: false }, { key: "whatsapp_ok", text: "Ich stimme zu, per WhatsApp kontaktiert zu werden.", is_required: false }] };
  const lead = (o: Partial<{ ja: unknown; key: string; felder: { name: string; values: string[] }[] }> = {}) => ({
    id: "1", form_id: "F", field_data: o.felder ?? [{ name: "full_name", values: ["Pia Probe"] }, { name: "phone_number", values: ["+4915900408999"] }],
    custom_disclaimer_responses: o.ja === undefined ? [] : [{ checkbox_key: o.key ?? "anruf_einwilligung", is_checked: o.ja as any }],
  });
  const k1 = M.anrufJaAusMeta(lead({ ja: "1" }), form);
  ok(k1?.weg === "kaestchen" && k1.wortlaut === kasten && k1.schluessel === "anruf_einwilligung", "Kästchen angehakt → Ja mit dem Wortlaut des Kästchens", k1);
  ok(M.anrufJaAusMeta(lead({ ja: "0" }), form) === null && M.anrufJaAusMeta(lead({ ja: false }), form) === null, "Rot-Probe: Kästchen NICHT angehakt → nichts");
  ok(M.anrufJaAusMeta(lead({ ja: "1" }), { ...form, kaestchen: [{ ...form.kaestchen[0], is_required: true }] }) === null, "Rot-Probe: Pflicht-Kästchen (nicht freiwillig) → nichts");
  ok(M.anrufJaAusMeta(lead({ ja: "1", key: "whatsapp_ok" }), form) === null, "Rot-Probe: das WhatsApp-Kästchen ist kein Ja zum Anruf");
  const f1 = M.anrufJaAusMeta(lead({ felder: [{ name: "phone_number", values: ["+4915900408999"] }, { name: "anruf_einwilligung", values: ["Ja, gerne"] }] }), form);
  ok(f1?.weg === "frage" && f1.wortlaut === "Dürfen wir Sie anrufen – auch ARAS (eine KI)?" && f1.antwort === "Ja, gerne", "eigene Frage mit Antwort „Ja, gerne“ → Ja mit dem Wortlaut der Frage", f1);
  ok(M.anrufJaAusMeta(lead({ felder: [{ name: "anruf_einwilligung", values: ["Nein"] }] }), form) === null, "Rot-Probe: Antwort „Nein“ → nichts");
  ok(M.anrufJaAusMeta(lead({ felder: [{ name: "telefonnummer", values: ["0171 1234567"] }, { name: "e-mail-adresse", values: ["x@example.com"] }] }), form) === null, "Rot-Probe: die Telefonnummer selbst ist keine Einwilligung");
  const produktion = { fragen: [{ key: "vollständiger_name", label: "Full name" }, { key: "e-mail-adresse", label: "Email" }, { key: "phone_number", label: "Phone number" }, { key: "inbox_url", label: "Inbox URL" }], kaestchen: [] };
  ok(M.anrufJaAusMeta(lead({ felder: [{ name: "vollständiger_name", values: ["Pia"] }, { name: "phone_number", values: ["+4915900408999"] }, { name: "inbox_url", values: ["https://x"] }] }), produktion) === null,
    "die Formulare der Produktion (Stand 22.10., nur Feldnamen) fragen nicht — es entsteht nichts");

  console.log("── A8 · Quelltext-Wachen (das Verhalten prüfen B und C)");
  const wa = ohneKommentare(lies("server/lib/fiaon-whatsapp.ts"));
  const eingang = ausschnitt(wa, "export async function waEingang(", "for (const s of wert?.statuses");
  const iJa = eingang.indexOf("jaAusWhatsApp("), iMara = eingang.indexOf("m.maraAntwortet(nummer)");
  ok(iJa > 0 && iMara > iJa, "waEingang: Ja/Widerruf wird VOR Maras Antwort gespeichert");
  ok(/catch \(e\) \{\s*console\.error\(`\[JA-ZUM-ANRUF\]/.test(ausschnitt(eingang, "jaAusWhatsApp(", "m.maraAntwortet")), "ein Fehler dabei hält weder Webhook noch Mara auf (Protokoll)");
  const mara = ohneKommentare(lies("server/lib/fiaon-whatsapp-mara.ts"));
  const antwortet = ausschnitt(mara, "export async function maraAntwortet(", "\nexport function wissenFuerWhatsApp(");
  const iStopp = antwortet.indexOf("if (istStopp(neuesteRein.text, neuesteRein.knopf))"), iJaZweig = antwortet.indexOf("jaImGespraech("), iAbst = antwortet.indexOf("let herkunftHinweis");
  ok(iStopp > 0 && iJaZweig > iStopp && iAbst > iJaZweig, "Maras Dank auf ein klares JA: nach STOPP, vor allem anderen (fester Satz, ohne Modell)");
  ok(/await vorbereiten\(nummer, JA_DANKE_WA,/.test(antwortet), "der Dank ist der feste Satz aus shared/ (JA_DANKE_WA)");
  ok(/await vorbereiten\(nummer, ANRUF_SPERRE_WA,/.test(antwortet) && !/wir rufen Sie nicht mehr an/.test(antwortet), "nach einer Sperre der feste Satz aus shared/ (ANRUF_SPERRE_WA)");
  const iAnhang = antwortet.indexOf("const jaFrage = await jaFrageZumAnhaengen("), iVor = antwortet.indexOf("await vorbereiten(nummer, antwort, Number(neuesteRein.id), frage, { kunde, handlung });"), iKi = antwortet.indexOf("die digitale Assistentin von FIAON. ${antwort}");
  ok(iKi > 0 && iAnhang > iKi && iVor > iAnhang, "die Frage kommt zuletzt dran — nach allem, was Maras Antwort prüft und ergänzt, direkt vor dem Vorbereiten");
  ok((antwortet.match(/antwort = `\$\{antwort\}\\n\\n\$\{jaFrage\}`/g) ?? []).length === 1 && !/JA_FRAGE_WA/.test(antwortet), "angehängt wird genau EINMAL, als eigener Absatz — Maras Antwort davor bleibt Wort für Wort");
  ok(/ruhe: jaRuhe/.test(antwortet) && /heikel \|\| heikelJetzt \|\| ruhe24/.test(antwortet) && /terminDa \|\| anrufGewuenscht \|\| rueckrufWunsch/.test(antwortet), "die Ruhe-Gründe (heikel, Kündigung, Übergabe, Telefon schon Thema …) gehen mit");
  ok(/jaFrageZuletzt \? urteil\.hinweise\.filter/.test(antwortet) && /\.\.\.\(jaHinweis \? \[jaHinweis\] : \[\]\)/.test(antwortet), "nach der Frage: kein „Ok = Zustimmung“-Hinweis, dafür der Satz aus jaHinweisFuerMara");
  const routen = ohneKommentare(lies("server/routes/fiaon-ja-zum-anruf.ts"));
  const posts = routen.match(/router\.(get|post)\("[^"]+", requireAgent, async/g) ?? [];
  ok(posts.length === 4 && (routen.match(/const z = await zugang\(req, res\); if \(!z\) return;/g) ?? []).length === 4 && /darfAnKunde\(/.test(routen), "vier Routen, jede hinter requireAgent UND darfAnKunde");
  ok(/router\.use\(jaZumAnruf\);/.test(lies("server/routes/fiaon-aras-akte.ts")), "eingehängt in die Akte-Routen (dieselbe Tür wie die Karte)");
  const karte = lies("client/src/components/agent/ArasKarte.tsx");
  const ja = ohneKommentare(lies("client/src/components/agent/ArasJaZumAnruf.tsx"));
  ok(/<ArasJaZumAnruf personId=\{personId\} melden=\{melden\} \/>/.test(karte), "die Karte „ARAS“ zeigt den Block");
  ok([">Ja zum Anruf eintragen<", "\"Mara fragt nach dem Ja\"", ">Ja widerrufen<"].every((s) => ja.includes(s)), "drei Knöpfe: eintragen, Mara fragt, widerrufen");
  ok(/disabled=\{!bestaetigt \|\| laeuft === "eintragen"\}/.test(ja) && /\{ bestaetigt: true \}/.test(ja) && /\{JA_AKTE_BESTAETIGUNG\}/.test(ja), "„Eintragen“ bleibt grau bis zum Häkchen; geschickt wird bestaetigt: true; der Satz aus shared/");
  ok(/disabled=\{!l\.frage\.darf \|\| !!laeuft\}/.test(ja) && /\{l\.frage\.grund\}/.test(ja), "„Mara fragt“ nur, wenn Mara darf — sonst steht der Grund als Text daneben");
  const hakenOben = ja.indexOf("if (!lage) {") > 0 && ja.slice(0, ja.indexOf("if (!lage) {")).match(/use(State|Effect|Callback)\(/g)?.length === (ja.match(/use(State|Effect|Callback)\(/g) ?? []).length;
  ok(hakenOben, "alle React-Haken stehen über dem ersten return");
  const meta = ohneKommentare(lies("server/lib/fiaon-meta-leads.ts"));
  const einspielen = ausschnitt(meta, "export async function metaLeadEinspielen(", "\nexport function istBeispielMeldung(");
  ok(einspielen.indexOf("anrufJaAusMetaMerken(roh, f,") > einspielen.indexOf("INSERT INTO fiaon_meta_leads (meta_lead_id, lead_id, formular_id, erstellt_am, weg)\n    VALUES (${String(roh.id)}, ${erg.id}"), "Meta: das Ja wird erst nach dem angelegten Lead gemerkt");
  const S = await import("../shared/fiaon-ki-schalter");
  const schalter = S.REGISTER.find((e) => e.schluessel === "mara_wa_ja_frage");
  ok(!!schalter && schalter.vorgabe === "an" && schalter.leser === "lib/fiaon-ja-zum-anruf.ts:jaFrageSchalter" && S.KI_SCHLUESSEL.includes("mara_wa_ja_frage"), "Schalter im KI-Raum: „Nach dem Ja zum Anruf fragen“ (an)");
  const A = await import("../shared/fiaon-aras");
  ok(A.istGesperrteSpielart("zuruf") && A.istGesperrteSpielart("lead"), "ein Ja allein wählt hier nie — die Werbe-Gesprächsarten bleiben im Code gesperrt (anderer Strang)");
}

// ═══════════════════════════════════════════════════════════════════════════
// B — LOKALE DATENBANK
// ═══════════════════════════════════════════════════════════════════════════
const LAUF = randomBytes(3).toString("hex").toUpperCase();
/**
 * Sechs Ziffern je Lauf in jeder Nummer (und damit in ihrem Kern, den letzten neun Ziffern) — so teilen sich zwei Läufe
 * auf derselben Prüfdatenbank nie eine Nummer (AGENTS.md: Merkmale je Lauf einmalig). Drei Ziffern waren zu wenig: Bei
 * einem Treffer fand der zweite Lauf das Ja des ersten.
 */
const LZ = String(parseInt(LAUF, 16) % 1_000_000).padStart(6, "0");
const nummerFuer = (nr: number) => `49159${LZ}${String(nr).padStart(2, "0")}`;
/** Ein eigenes Prüfkonto je Lauf (Testkonto-Marke, nur in der lokalen DB) — die Prüfkonten der Struktur-Kopie sind gesperrt. */
let AGENT = 0, AGENT_NAME = "";
async function prueferAnlegen(): Promise<void> {
  if (AGENT) return;
  const { sqlPool: sql } = await import("../server/lib/db-pool");
  const [a] = (await sql`
    INSERT INTO fiaon_agents (name, first_name, last_name, email, active, rolle, is_test_account, pruefkonto, distribution_active)
    VALUES (${`Paul Prüfer ${LAUF}`}, 'Paul', ${`Prüfer ${LAUF}`}, ${`pruefstand.ja.agent.${LAUF.toLowerCase()}@example.com`}, TRUE, 'agent', TRUE, TRUE, FALSE)
    RETURNING id, name`) as any[];
  AGENT = Number(a.id); AGENT_NAME = String(a.name);
  // Ohne abgeschlossenes Onboarding sperrt das Tor jede /agent-Route (customerDataGate) — wie pruef-sendesperre-browser.ts.
  const { ONBOARDING_DOCS, ensureOnboardingTables } = await import("../server/routes/fiaon-onboarding");
  await ensureOnboardingTables();
  for (const d of ONBOARDING_DOCS as any[]) {
    await sql`INSERT INTO fiaon_agent_consents (agent_id, doc_key, doc_version, accepted_at, ip, user_agent)
              VALUES (${AGENT}, ${d.key}, ${d.version}, NOW(), ${`PRUEFSTAND/JA-${LAUF}`}, 'pruef-aras-einwilligung-wege.ts (kein Mensch)') ON CONFLICT DO NOTHING`;
  }
  const [vorlage] = (await sql`SELECT version FROM fiaon_contract_templates WHERE status = 'active' ORDER BY version DESC LIMIT 1`) as any[];
  if (vorlage) {
    await sql`INSERT INTO fiaon_agent_contracts (agent_id, template_version, variables_json, rendered_html, signature_name, signature_mode, doc_hash, status, signed_at)
              VALUES (${AGENT}, ${Number(vorlage.version)}, ${JSON.stringify({ pruefstand: `JA-${LAUF}` })}, ${`<p>Prüfstand JA-${LAUF} — kein Vertrag, kein Mensch.</p>`},
                      ${`Prüfstand JA-${LAUF}`}, 'pruefstand', ${`pruefja-${LAUF}`}, 'signed', NOW())`;
  }
}

async function teilB() {
  teil = "B";
  const { sqlPool: sql } = await import("../server/lib/db-pool");
  const L = await import("../server/lib/fiaon-ja-zum-anruf");
  const E = await import("../server/lib/fiaon-telefon-einwilligung");
  const J = await import("../shared/fiaon-ja-zum-anruf");
  const { nummerKern } = await import("../server/lib/fiaon-aras-sperre");
  const { arasSchema } = await import("../server/lib/fiaon-aras-schema");
  await arasSchema();
  await sql`INSERT INTO fiaon_settings (key, value) VALUES ('mara_wa_ja_frage', 'an') ON CONFLICT (key) DO UPDATE SET value = 'an'`;
  await prueferAnlegen();

  const person = async (nr: number, o: { ohneTelefon?: boolean; werbesperre?: boolean; antrag?: boolean } = {}) => {
    const [p] = (await sql`
      INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_phone, phone_key9, primary_email, country, werbung_gesperrt_am)
      VALUES (${`PRUEF-JA-${LAUF}-${nr}`}, 'Pia', ${`Japrobe ${LAUF}-${nr}`}, ${o.ohneTelefon ? null : `+${nummerFuer(nr)}`}, ${o.ohneTelefon ? null : nummerFuer(nr).slice(-9)},
              ${`pruefstand.ja.${LAUF.toLowerCase()}.${nr}@example.com`}, 'DE', ${o.werbesperre ? new Date() : null})
      RETURNING id`) as any[];
    const id = Number(p.id);
    if (o.antrag !== false) {
      await sql`INSERT INTO fiaon_applications (ref, payment_reference, person_id, status, email, first_name, last_name, created_at)
                VALUES (${`FIAON-PRUEFJA-${LAUF}-${nr}`}, ${`FIAON-J${LAUF}${String(nr).padStart(2, "0")}`.slice(0, 20)}, ${id}, 'started',
                        ${`pruefstand.ja.${LAUF.toLowerCase()}.${nr}@example.com`}, 'Pia', ${`Japrobe ${LAUF}-${nr}`}, NOW() - INTERVAL '2 days')`;
    }
    return id;
  };
  const rein = async (nr: number, personId: number | null, text: string, vorMin: number) => {
    const am = new Date(Date.now() - vorMin * 60_000);
    const [z] = (await sql`INSERT INTO fiaon_whatsapp (wa_id, richtung, nummer, person_id, typ, text, status, empfangen_am, created_at)
      VALUES (${`wamid.PRUEFJA.${LAUF}.${randomBytes(4).toString("hex")}`}, 'rein', ${nummerFuer(nr)}, ${personId}, 'text', ${text}, 'empfangen', ${am}, ${am}) RETURNING id`) as any[];
    return Number(z.id);
  };
  const raus = async (nr: number, personId: number | null, text: string, vorMin: number, von = "Mara Lindner", vorlage: string | null = null) => {
    const am = new Date(Date.now() - vorMin * 60_000);
    const [z] = (await sql`INSERT INTO fiaon_whatsapp (wa_id, richtung, nummer, person_id, typ, text, vorlage, status, von, gesendet_am, created_at)
      VALUES (${`wamid.PRUEFJA.${LAUF}.${randomBytes(4).toString("hex")}`}, 'raus', ${nummerFuer(nr)}, ${personId}, ${vorlage ? "vorlage" : "text"}, ${text}, ${vorlage}, 'read', ${von}, ${am}, ${am}) RETURNING id`) as any[];
    return Number(z.id);
  };
  const einw = async (personId: number) => (await sql`SELECT * FROM fiaon_telefon_einwilligung WHERE person_id = ${personId} ORDER BY id`) as any[];
  /** jaAusWhatsApp so, wie waEingang es ruft (dieselben Felder). */
  const eingang = async (nr: number, personId: number | null, text: string, vorMin = 0) => {
    const id = await rein(nr, personId, text, vorMin);
    // Wirft der Eingang, wird das rot gemeldet — und der Prüfstand läuft weiter (AGENTS.md: nie am ersten Fehler abbrechen).
    const r = await L.jaAusWhatsApp({ nummer: nummerFuer(nr), nachrichtId: id, text, personId, leadId: null })
      .catch((e: unknown) => { ok(false, `jaAusWhatsApp warf bei „${text}“`, String(e).slice(0, 200)); return { ja: false, nein: false, grund: "Fehler" } as import("../server/lib/fiaon-ja-zum-anruf").JaAusWhatsApp; });
    return { id, r };
  };

  console.log("── B1 · Akte: „Ja zum Anruf eintragen“ (Art „chef“)");
  const p1 = await person(1);
  const [call] = (await sql`INSERT INTO fiaon_calls (person_id, agent_id, nummer, beginn, ende, status, recording_url)
    VALUES (${p1}, ${AGENT}, ${`+${nummerFuer(1)}`}, NOW() - INTERVAL '12 minutes', NOW() - INTERVAL '4 minutes', 'beendet', NULL) RETURNING id`) as any[];
  const ohne = await L.jaEintragen({ personId: p1, agentId: AGENT, agentName: AGENT_NAME, bestaetigt: false });
  ok(!ohne.ok && (ohne as any).status === 400 && (await einw(p1)).length === 0, "Rot-Probe: ohne Bestätigung → 400, nichts gespeichert", ohne);
  const text = await L.jaEintragen({ personId: p1, agentId: AGENT, agentName: AGENT_NAME, bestaetigt: "true" });
  ok(!text.ok && (await einw(p1)).length === 0, "Rot-Probe: „true“ als Text zählt nicht → nichts gespeichert", text);
  const lage0 = await L.jaLage(p1, AGENT);
  ok(lage0?.zeile === "Noch kein Ja zum Anruf" && lage0.gueltig === false && lage0.gespraech?.id === Number(call.id), "Akte vorher: „Noch kein Ja zum Anruf“, dein Gespräch von eben wird der Beleg", lage0);
  const ein = await L.jaEintragen({ personId: p1, agentId: AGENT, agentName: AGENT_NAME, bestaetigt: true });
  const z1 = (await einw(p1))[0] ?? {};
  ok(ein.ok && (await einw(p1)).length === 1, "mit Bestätigung → genau eine Einwilligung", ein);
  ok(z1.art === "chef" && z1.wortlaut === BESTAETIGUNG, "Art „chef“, Wortlaut = die Bestätigung", { art: z1.art, w: z1.wortlaut });
  ok(z1.beleg?.mitarbeiterId === AGENT && z1.beleg?.mitarbeiterName === AGENT_NAME && z1.beleg?.gespraechId === Number(call.id) && z1.quelle_art === "gespraech" && z1.quelle_id === String(call.id),
    "Beleg: Mitarbeiter-ID und Name, Gesprächs-ID (Quelle = das Gespräch)", { beleg: z1.beleg, q: [z1.quelle_art, z1.quelle_id] });
  ok(Math.abs(new Date(z1.erteilt_am).getTime() - Date.now()) < 60_000 && z1.widerrufen_am == null && z1.nummer === `+${nummerFuer(1)}` && z1.nummer_kern === nummerKern(`+${nummerFuer(1)}`), "Zeitpunkt = jetzt, gültig, Nummer aus der Akte", { t: z1.erteilt_am, n: z1.nummer });
  const g1 = await E.einwilligungGueltig(nummerKern(`+${nummerFuer(1)}`), p1);
  ok(g1?.id === Number(z1.id) && g1?.art === "chef", "einwilligungGueltig (Planer, Wähler, Briefing) findet sie", g1);
  const lage1 = await L.jaLage(p1, AGENT);
  ok(lage1?.gueltig === true && lage1.zeile === `Ja zum Anruf: seit ${J.tagKurz(new Date())} (im Gespräch mit ${AGENT_NAME})`, "Akte: „Ja zum Anruf: seit TT.MM. (im Gespräch mit …)“", lage1?.zeile);
  const doppelt = await L.jaEintragen({ personId: p1, agentId: AGENT, agentName: AGENT_NAME, bestaetigt: true });
  ok(!doppelt.ok && (doppelt as any).status === 409 && (await einw(p1)).length === 1, "zweimal eintragen → 409, bleibt eine", doppelt);
  const [vermerk] = (await sql`SELECT agent_id, agent_name, note FROM fiaon_contact_log WHERE person_id = ${p1} AND note LIKE 'Ja zum Anruf eingetragen%' ORDER BY id DESC LIMIT 1`) as any[];
  ok(Number(vermerk?.agent_id) === AGENT && /Gespräch #/.test(String(vermerk?.note)), "Vermerk im Verlauf der Akte (mit Mitarbeiter und Gespräch)", vermerk);
  const p2 = await person(2);
  await sql`INSERT INTO fiaon_telefon_sperre (nummer_kern, person_id, quelle, grund) VALUES (${nummerFuer(2).slice(-9)}, ${p2}, 'pruefstand', 'Prüfstand: nicht mehr anrufen') ON CONFLICT (nummer_kern) DO NOTHING`;
  const gesperrt = await L.jaEintragen({ personId: p2, agentId: AGENT, agentName: AGENT_NAME, bestaetigt: true });
  ok(!gesperrt.ok && /Telefonsperre/.test((gesperrt as any).grund) && (await einw(p2)).length === 0, "Telefonsperre → 409, nichts gespeichert", gesperrt);
  const p3 = await person(3, { ohneTelefon: true });
  const ohneNr = await L.jaEintragen({ personId: p3, agentId: AGENT, agentName: AGENT_NAME, bestaetigt: true });
  ok(!ohneNr.ok && /keine Telefonnummer/.test((ohneNr as any).grund) && (await einw(p3)).length === 0, "ohne Telefonnummer → 409, nichts gespeichert", ohneNr);

  console.log("── B2 · Akte: „Ja widerrufen“");
  const w = await L.jaWiderrufen({ personId: p1, agentId: AGENT, agentName: AGENT_NAME });
  const z1w = (await einw(p1))[0] ?? {};
  ok(w.ok && Number((w as any).anzahl) >= 1 && z1w.widerrufen_am && String(z1w.widerruf_quelle).startsWith(`akte:${AGENT} `), "widerrufen: Zeitpunkt und Quelle (Akte, Mitarbeiter)", { w, q: z1w.widerruf_quelle });
  ok((await E.einwilligungGueltig(nummerKern(`+${nummerFuer(1)}`), p1)) === null, "einwilligungGueltig findet nichts mehr — ARAS wählt nicht");
  const lage1w = await L.jaLage(p1, AGENT);
  ok(lage1w?.gueltig === false && / · Widerrufen am \d\d\.\d\d\.$/.test(String(lage1w?.zeile)), "Akte: „… · Widerrufen am TT.MM.“", lage1w?.zeile);
  const w2 = await L.jaWiderrufen({ personId: p1, agentId: AGENT, agentName: AGENT_NAME });
  ok(!w2.ok && (w2 as any).status === 409, "nichts mehr zu widerrufen → 409", w2);
  ok((await einw(p1)).length === 1, "nichts gelöscht — die Zeile bleibt als Nachweis (nur widerrufen_am)");

  console.log("── B3 · WhatsApp: klares JA auf Maras Frage → „zuruf_whatsapp“ mit beiden Nachrichten");
  const p4 = await person(4);
  await rein(4, p4, "Hallo, was kostet die Karte im Monat?", 30);
  const frageId = await raus(4, p4, `Hier ist Mara, die digitale Assistentin von FIAON. Die Karte kostet 59,99 € im Monat.\n\n${FRAGE}`, 29);
  const ja4 = await eingang(4, p4, "Ja gerne");
  const z4 = (await einw(p4))[0] ?? {};
  ok(ja4.r.ja && ja4.r.neu && (await einw(p4)).length === 1, "genau eine Einwilligung", ja4.r);
  ok(z4.art === "zuruf_whatsapp" && z4.wortlaut === FRAGE, "Art zuruf_whatsapp, Wortlaut = die gestellte Frage", { a: z4.art, w: z4.wortlaut });
  ok(z4.beleg?.frage?.nachrichtId === frageId && z4.beleg?.antwort?.nachrichtId === ja4.id && /^wamid\./.test(z4.beleg?.frage?.waId) && /^wamid\./.test(z4.beleg?.antwort?.waId)
    && z4.beleg?.antwort?.text === "Ja gerne" && z4.quelle_art === "whatsapp" && z4.quelle_id === String(ja4.id), "Beleg: beide Nachrichten (unsere und Metas Kennung, Text, Zeit)", z4.beleg);
  ok(z4.nummer === `+${nummerFuer(4)}` && Number(z4.person_id) === p4, "Nummer (E.164) und Person", { n: z4.nummer, p: z4.person_id });
  const nochmal = await L.jaAusWhatsApp({ nummer: nummerFuer(4), nachrichtId: ja4.id, text: "Ja gerne", personId: p4, leadId: null });
  ok(nochmal.ja && nochmal.neu === false && nochmal.id === Number(z4.id) && (await einw(p4)).length === 1, "dieselbe Nachricht zweimal → bleibt eine (idempotent)");
  const im = await L.jaImGespraech({ nummer: nummerFuer(4), offene: [{ id: ja4.id, text: "Ja gerne" }], ersteOffeneId: ja4.id });
  ok(im.gespeichertIds.includes(ja4.id) && im.frageOffen, "für Maras Antwort: alles Offene ist das gespeicherte Ja → fester Dank, kein Modell", im);
  const lage4 = await L.jaLage(p4, AGENT);
  ok(lage4?.zeile === `Ja zum Anruf: seit ${J.tagKurz(new Date())} (WhatsApp)` && lage4.frage.darf === false, "Akte: „Ja zum Anruf: seit TT.MM. (WhatsApp)“; Mara fragt nicht noch einmal", lage4);

  const rotProbe = async (nr: number, name: string, antwort: string, vorbereitung: (pid: number) => Promise<void>) => {
    const pid = await person(nr);
    await vorbereitung(pid);
    const e = await eingang(nr, pid, antwort);
    ok(!e.r.ja && (await einw(pid)).length === 0, `Rot-Probe: ${name} → kein Ja`, e.r);
  };
  const mitFrage = async (pid: number, nr: number) => { await rein(nr, pid, "Wie geht es weiter?", 20); await raus(nr, pid, `Sie bekommen den Link per Mail.\n\n${FRAGE}`, 19); };
  await rotProbe(5, "„nein“", "nein", (pid) => mitFrage(pid, 5));
  await rotProbe(6, "„ja, aber nicht anrufen“", "ja, aber nicht anrufen", (pid) => mitFrage(pid, 6));
  await rotProbe(7, "„Ja“ ohne Maras Frage davor", "Ja", async (pid) => { await rein(7, pid, "Hallo", 20); await raus(7, pid, "Gerne, der Link kommt per Mail.", 19); });
  await rotProbe(8, "„Ja“, aber vorher schrieb er schon etwas anderes", "Ja", async (pid) => { await mitFrage(pid, 8); await rein(8, pid, "Was kostet das?", 10); });
  await rotProbe(9, "„Ja“ acht Tage nach der Frage", "Ja", async (pid) => { await rein(9, pid, "Hallo", 8 * 24 * 60 + 30); await raus(9, pid, `Gerne.\n\n${FRAGE}`, 8 * 24 * 60 + 20); });
  await rotProbe(10, "„Ja“ auf eine Vorlage, die nach der Frage kam", "Ja", async (pid) => { await mitFrage(pid, 10); await raus(10, pid, "Ihr Antrag wartet noch — möchten Sie weitermachen?", 5, "Mara", "fiaon_kk_erinnerung"); });
  {
    // Fassung 1 ging am 22.10. schon raus: ein Ja darauf zählt — mit genau DEM Wortlaut, den er gelesen hat.
    const p5a = await person(50);
    await rein(50, p5a, "Und wie geht es jetzt weiter?", 40);
    const alteFrage = await raus(50, p5a, `Sie bekommen den Link per Mail.\n\n${FRAGE_ALT}`, 39);
    const jaAlt = await eingang(50, p5a, "Ja, gerne");
    const zAlt = (await einw(p5a))[0] ?? {};
    ok(jaAlt.r.ja && zAlt.art === "zuruf_whatsapp" && zAlt.wortlaut === FRAGE_ALT && zAlt.beleg?.frage?.nachrichtId === alteFrage, "ein Ja auf die ALTE Fassung zählt — Wortlaut = die alte Frage", { r: jaAlt.r, w: zAlt.wortlaut });
    ok(z4.wortlaut === FRAGE && z4.wortlaut !== FRAGE_ALT, "ein Ja auf die NEUE Fassung speichert die neue (nicht die darin steckende alte)", z4.wortlaut);
  }

  console.log("── B4 · „Mara fragt nach dem Ja“ (Knopf) — Attrappe statt waSenden");
  const gesendet: { an: string; text: string; von: string | null }[] = [];
  const attrappe: import("../server/lib/fiaon-ja-zum-anruf").JaSenden = async (an, inhalt, zusatz, l) => {
    gesendet.push({ an, text: inhalt.text, von: zusatz.von ?? null });
    // Wie waSenden nach Metas Annahme: die Zeile in fiaon_whatsapp (mit Kennung) — sonst wüsste niemand, dass gefragt wurde.
    await l`INSERT INTO fiaon_whatsapp (wa_id, richtung, nummer, person_id, lead_id, typ, text, status, von, gesendet_am)
            VALUES (${`wamid.PRUEFJA.${LAUF}.${randomBytes(4).toString("hex")}`}, 'raus', ${an}, ${zusatz.personId ?? null}, ${zusatz.leadId ?? null}, 'text', ${inhalt.text}, 'gesendet', ${zusatz.von ?? "Mara"}, NOW())`;
    return { ok: true, waId: "wamid.pruef" };
  };
  const p11 = await person(11);
  await rein(11, p11, "Danke für die Infos!", 120);
  await raus(11, p11, "Sehr gern! Einen schönen Tag noch.", 119);
  const lage11 = await L.jaLage(p11, AGENT);
  ok(lage11?.frage.darf === true && lage11.frage.grund === null, "Fenster offen, kein Ja, nichts wartet → der Knopf ist aktiv", lage11?.frage);
  const f11 = await L.maraFragtNachDemJa({ personId: p11, agentId: AGENT, agentName: AGENT_NAME }, undefined, attrappe);
  ok(f11.ok && gesendet.length === 1 && gesendet[0].text === FRAGE && gesendet[0].an === nummerFuer(11) && /\(Ja-Frage\)$/.test(String(gesendet[0].von)), "Mara schickt genau die Frage an seine WhatsApp-Nummer (Absender „Mara … (Ja-Frage)“)", { f11, gesendet });
  const lage11b = await L.jaLage(p11, AGENT);
  ok(lage11b?.frage.darf === false && /schon gefragt – wieder ab/.test(String(lage11b?.frage.grund)), "danach: „Mara hat am … schon gefragt – wieder ab …“", lage11b?.frage);
  const f11b = await L.maraFragtNachDemJa({ personId: p11, agentId: AGENT, agentName: AGENT_NAME }, undefined, attrappe);
  ok(!f11b.ok && gesendet.length === 1, "Rot-Probe: zweiter Klick → nichts geht raus (30 Tage)", f11b);
  const ja11 = await eingang(11, p11, "Ja 👍");
  const z11 = (await einw(p11))[0] ?? {};
  ok(ja11.r.ja && z11.art === "zuruf_whatsapp" && z11.beleg?.frage?.knopf === true, "sein „Ja 👍“ auf die Frage aus dem Knopf → Ja, im Beleg als Knopf-Frage erkennbar", z11.beleg);

  const p12 = await person(12);
  await rein(12, p12, "Hallo", 30 * 60);
  await raus(12, p12, "Hallo, wie kann ich helfen?", 30 * 60 - 1);
  const lage12 = await L.jaLage(p12, AGENT);
  const f12 = await L.maraFragtNachDemJa({ personId: p12, agentId: AGENT, agentName: AGENT_NAME }, undefined, attrappe);
  ok(lage12?.frage.darf === false && /Fenster ist zu/.test(String(lage12?.frage.grund)) && !f12.ok && gesendet.length === 1, "Rot-Probe: kein offenes Fenster (30 h) → keine Frage, der Grund steht da", { g: lage12?.frage.grund, f12 });

  const p13 = await person(13);
  await E.einwilligungMerken({ personId: p13, nummer: `+${nummerFuer(13)}`, art: "antrag_kaestchen", wortlaut: "Prüfstand: Antrag-Kästchen", quelleArt: "antrag", quelleId: `PRUEF-${LAUF}-13` });
  await rein(13, p13, "Wann kommt meine Karte?", 10);
  await raus(13, p13, "Die Karte kommt in 2–5 Werktagen.", 9);
  const lage13 = await L.jaLage(p13, AGENT);
  const f13 = await L.maraFragtNachDemJa({ personId: p13, agentId: AGENT, agentName: AGENT_NAME }, undefined, attrappe);
  const a13 = await L.jaFrageZumAnhaengen({ nummer: nummerFuer(13), personId: p13, antwort: "Die Karte kommt in 2–5 Werktagen.", ruhe: [] });
  ok(lage13?.frage.darf === false && /schon Ja/.test(String(lage13?.frage.grund)) && !f13.ok && a13 === null && gesendet.length === 1, "Rot-Probe: schon ein Ja → keine Frage (Knopf UND Mara)", { g: lage13?.frage.grund, a13 });

  const p14 = await person(14);
  await rein(14, p14, "Was kostet die Karte?", 1);
  const lage14 = await L.jaLage(p14, AGENT);
  ok(lage14?.frage.darf === false && /wartet gerade auf eine Antwort/.test(String(lage14?.frage.grund)), "Knopf: seine Nachricht wartet noch → „erst antworten, dann fragen“", lage14?.frage);

  const p15 = await person(15, { werbesperre: true });
  await rein(15, p15, "Hallo", 10);
  await raus(15, p15, "Hallo!", 9);
  const lage15 = await L.jaLage(p15, AGENT);
  ok(lage15?.frage.darf === false && /Werbesperre/.test(String(lage15?.frage.grund)), "Rot-Probe: Werbesperre → keine Frage", lage15?.frage);

  {
    const p51 = await person(51);
    await rein(51, p51, "Hallo, ich hätte noch eine Frage.", 10 * 24 * 60 + 5);
    await raus(51, p51, `Gerne.\n\n${FRAGE_ALT}`, 10 * 24 * 60);
    await rein(51, p51, "Danke, ich melde mich.", 10);
    await raus(51, p51, "Sehr gern!", 9);
    const lage51 = await L.jaLage(p51, AGENT);
    ok(lage51?.frage.darf === false && /schon gefragt – wieder ab/.test(String(lage51?.frage.grund)), "die ALTE Fassung vor 10 Tagen zählt für die 30 Tage — keine neue Frage", lage51?.frage);
  }

  console.log("── B5 · Mara hängt die Frage an ihre Antwort (jaFrageZumAnhaengen)");
  const a14 = await L.jaFrageZumAnhaengen({ nummer: nummerFuer(14), personId: p14, antwort: "Die Karte kostet 59,99 € im Monat.", ruhe: [] });
  ok(a14 === FRAGE, "Mara antwortet ihm gerade (Fenster offen, kein Ja, nie gefragt) → die Frage darf dran", a14);
  ok((await L.jaFrageZumAnhaengen({ nummer: nummerFuer(14), personId: p14, antwort: "Soll ich Ihnen den Link schicken?", ruhe: [] })) === null, "Rot-Probe: Maras Antwort fragt selbst → keine Frage (sonst wüsste niemand, worauf „Ja“ antwortet)");
  ok((await L.jaFrageZumAnhaengen({ nummer: nummerFuer(14), personId: p14, antwort: "Die Karte kostet 59,99 € im Monat.", ruhe: ["heikles Anliegen oder Kündigung"] })) === null, "Rot-Probe: ein Ruhe-Grund (heikel, Kündigung, Übergabe …) → keine Frage");
  ok((await L.jaFrageZumAnhaengen({ nummer: nummerFuer(12), personId: p12, antwort: "Gerne.", ruhe: [] })) === null, "Rot-Probe: kein offenes Fenster → keine Frage");
  ok((await L.jaFrageZumAnhaengen({ nummer: nummerFuer(11), personId: p11, antwort: "Gerne.", ruhe: [] })) === null, "Rot-Probe: schon ein Ja (und gerade gefragt) → keine Frage");
  await sql`UPDATE fiaon_settings SET value = 'aus' WHERE key = 'mara_wa_ja_frage'`;
  const aus14 = await L.jaFrageZumAnhaengen({ nummer: nummerFuer(14), personId: p14, antwort: "Die Karte kostet 59,99 € im Monat.", ruhe: [] });
  await raus(14, p14, "Die Karte kostet 59,99 € im Monat.", 0);
  const ausKnopf = await L.maraFragtNachDemJa({ personId: p14, agentId: AGENT, agentName: AGENT_NAME }, undefined, attrappe);
  ok(aus14 === null && !ausKnopf.ok && /KI-Raum ausgeschaltet/.test((ausKnopf as any).grund) && gesendet.length === 1, "Schalter „Nach dem Ja zum Anruf fragen“ aus → Mara fragt nicht, der Knopf auch nicht", { aus14, ausKnopf });
  await sql`UPDATE fiaon_settings SET value = 'an' WHERE key = 'mara_wa_ja_frage'`;

  console.log("── B6 · Per WhatsApp: „nicht mehr anrufen“ → Telefonsperre + Widerruf; „bitte jetzt nicht anrufen“ → nur Widerruf");
  const nein4 = await eingang(4, p4, "Bitte rufen Sie mich doch nicht mehr an.");
  const z4w = (await einw(p4))[0] ?? {};
  ok(nein4.r.nein && Number(nein4.r.widerrufen) >= 1 && z4w.widerrufen_am && z4w.widerruf_quelle === `whatsapp:${nein4.id}`, "sein Ja ist widerrufen — Quelle = seine Nachricht", { r: nein4.r, q: z4w.widerruf_quelle });
  const [sp4] = (await sql`SELECT quelle, person_id, grund, aufgehoben_am FROM fiaon_telefon_sperre WHERE nummer_kern = ${nummerFuer(4).slice(-9)}`) as any[];
  const [pp4] = (await sql`SELECT werbung_gesperrt_am, werbesperre_quelle FROM fiaon_persons WHERE id = ${p4}`) as any[];
  ok(nein4.r.gesperrt === true && sp4?.quelle === "whatsapp" && Number(sp4?.person_id) === p4 && sp4?.aufgehoben_am == null && new RegExp(`Nachricht ${nein4.id}`).test(String(sp4?.grund)),
    "klar („nicht mehr anrufen“) → echte Telefonsperre, Quelle whatsapp, Person, die Nachricht im Grund", sp4);
  ok(!!pp4?.werbung_gesperrt_am && pp4?.werbesperre_quelle === "whatsapp", "wie bei ARAS' Werkzeug: auch die Werbesperre der Person (Quelle whatsapp)", pp4);
  const { telefonGesperrt } = await import("../server/lib/fiaon-aras-sperre");
  ok(await telefonGesperrt(nummerKern(`+${nummerFuer(4)}`), p4), "telefonGesperrt (Planer und Wähler fragen hier) sagt: gesperrt");
  const lage4s = await L.jaLage(p4, AGENT);
  ok(lage4s?.frage.darf === false && /Telefonsperre/.test(String(lage4s?.frage.grund)), "Akte: Mara fragt nicht mehr (Telefonsperre)", lage4s?.frage);
  const ein4s = await L.jaEintragen({ personId: p4, agentId: AGENT, agentName: AGENT_NAME, bestaetigt: true });
  ok(!ein4s.ok && /Telefonsperre/.test((ein4s as any).grund), "Akte: ein Ja lässt sich nicht eintragen, solange die Sperre steht", ein4s);
  const weichFall = async (nr: number, text: string) => {
    const pid = await person(nr);
    await E.einwilligungMerken({ personId: pid, nummer: `+${nummerFuer(nr)}`, art: "antrag_kaestchen", wortlaut: "Prüfstand: Antrag-Kästchen", quelleArt: "antrag", quelleId: `PRUEF-${LAUF}-${nr}` });
    const e = await eingang(nr, pid, text);
    const [sp] = (await sql`SELECT 1 FROM fiaon_telefon_sperre WHERE nummer_kern = ${nummerFuer(nr).slice(-9)}`) as any[];
    const [pp] = (await sql`SELECT werbung_gesperrt_am FROM fiaon_persons WHERE id = ${pid}`) as any[];
    ok(e.r.nein && !e.r.gesperrt && Number(e.r.widerrufen) >= 1 && !sp && !pp?.werbung_gesperrt_am && (await E.einwilligungGueltig(nummerKern(`+${nummerFuer(nr)}`), pid)) === null,
      `weich („${text}“) → nur das Ja zurück, KEINE Telefonsperre, keine Werbesperre`, { r: e.r, sperre: !!sp });
  };
  await weichFall(17, "Bitte nicht anrufen, bin auf Arbeit");
  await weichFall(18, "bitte jetzt nicht anrufen");
  {
    const p19 = await person(19);
    await E.einwilligungMerken({ personId: p19, nummer: `+${nummerFuer(19)}`, art: "antrag_kaestchen", wortlaut: "Prüfstand: Antrag-Kästchen", quelleArt: "antrag", quelleId: `PRUEF-${LAUF}-19` });
    const e = await eingang(19, p19, "Warum rufen Sie mich nicht an?");
    const [sp] = (await sql`SELECT 1 FROM fiaon_telefon_sperre WHERE nummer_kern = ${nummerFuer(19).slice(-9)}`) as any[];
    ok(!e.r.nein && !sp && (await E.einwilligungGueltig(nummerKern(`+${nummerFuer(19)}`), p19)) !== null, "Rot-Probe: „Warum rufen Sie mich nicht an?“ — das Ja bleibt, keine Sperre", e.r);
    const p20 = await person(20);
    const e20 = await eingang(20, p20, "Hören Sie auf, mich anzurufen.");
    const [sp20] = (await sql`SELECT quelle FROM fiaon_telefon_sperre WHERE nummer_kern = ${nummerFuer(20).slice(-9)}`) as any[];
    ok(e20.r.gesperrt === true && sp20?.quelle === "whatsapp", "auch ohne vorheriges Ja: „Hören Sie auf, mich anzurufen“ → Telefonsperre", { r: e20.r, sp20 });
  }
  ok((await E.einwilligungGueltig(nummerKern(`+${nummerFuer(4)}`), p4)) === null, "einwilligungGueltig findet nichts mehr");
  const im4 = await L.jaImGespraech({ nummer: nummerFuer(4), offene: [{ id: nein4.id, text: "Bitte rufen Sie mich doch nicht mehr an." }], ersteOffeneId: nein4.id });
  ok(im4.zurueckIds.includes(nein4.id) && im4.sperreIds.includes(nein4.id), "für Maras Antwort: zurückgenommen UND gesperrt (fester Sperr-Satz)", im4);
  const p16 = await person(16);
  await E.einwilligungMerken({ personId: p16, nummer: `+${nummerFuer(16)}`, art: "antrag_kaestchen", wortlaut: "Prüfstand: Antrag-Kästchen", quelleArt: "antrag", quelleId: `PRUEF-${LAUF}-16` });
  const klage = await eingang(16, p16, "Sie haben mich gestern nicht angerufen, obwohl es ausgemacht war!");
  ok(!klage.r.nein && (await E.einwilligungGueltig(nummerKern(`+${nummerFuer(16)}`), p16)) !== null, "Rot-Probe: „Sie haben mich nicht angerufen“ nimmt nichts zurück", klage.r);

  console.log("── B8 · Der echte Eingang (waEingang): sein „Ja“ → Einwilligung, danach Maras fester Dank (ohne Modell)");
  {
    const W = await import("../server/lib/fiaon-whatsapp");
    const p30 = await person(30);
    await rein(30, p30, "Wie hoch ist das Limit?", 12);
    const frage30 = await raus(30, p30, `Das Limit hängt von Ihrem Paket ab — bis 25.000 € sind möglich.\n\n${FRAGE}`, 11);
    const waId = `wamid.PRUEFJA.${LAUF}.b8`;
    await W.waEingang({ messages: [{ from: nummerFuer(30), id: waId, timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body: "Ja, gerne!" } }] });
    const z30 = (await einw(p30))[0] ?? {};
    const [zeile30] = (await sql`SELECT id FROM fiaon_whatsapp WHERE wa_id = ${waId}`) as any[];
    ok(z30.art === "zuruf_whatsapp" && z30.beleg?.frage?.nachrichtId === frage30 && z30.beleg?.antwort?.waId === waId && z30.quelle_id === String(zeile30?.id),
      "der Webhook-Eingang speichert das Ja — mit Metas Kennung seiner Nachricht", { art: z30.art, beleg: z30.beleg });
    // Mara antwortet im Hintergrund (waEingang stößt sie an) — warten, bis ihre Antwort vorbereitet ist (höchstens 20 s).
    let vorb: any = null;
    for (let i = 0; i < 80; i++) {
      [vorb] = (await sql`SELECT antwort_text, antwort_handlung FROM fiaon_whatsapp_gespraech WHERE nummer = ${nummerFuer(30)}`) as any[];
      if (vorb?.antwort_text) break;
      await warte(250);
    }
    ok(vorb?.antwort_text === DANKE && /Ja zum Anruf gespeichert/.test(String(vorb?.antwort_handlung)), "Mara: der feste Dank liegt bereit (kein Modell, kein Versprechen)", vorb);
    const [prot] = (await sql`SELECT text FROM fiaon_mara_protokoll WHERE art = 'ja_zum_anruf' AND nummer = ${nummerFuer(30)} ORDER BY id DESC LIMIT 1`) as any[];
    ok(/kurzer Dank/.test(String(prot?.text)), "Protokoll „ja_zum_anruf“ (Maras Dank)", prot);
    await sql`UPDATE fiaon_whatsapp_gespraech SET antwort_text = NULL, antwort_faellig_am = NULL WHERE nummer = ${nummerFuer(30)}`;
  }

  console.log("── B8b · Der echte Eingang: „Nein, rufen Sie mich nie wieder an!“ → Sperre, danach Maras fester Sperr-Satz (ohne Modell)");
  {
    const W = await import("../server/lib/fiaon-whatsapp");
    const p34 = await person(34);
    await rein(34, p34, "Was kostet die Karte?", 12);
    await raus(34, p34, `Die Karte kostet 59,99 € im Monat.\n\n${FRAGE}`, 11);
    await W.waEingang({ messages: [{ from: nummerFuer(34), id: `wamid.PRUEFJA.${LAUF}.b8b`, timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body: "Nein, rufen Sie mich nie wieder an!" } }] });
    const [sp34] = (await sql`SELECT quelle FROM fiaon_telefon_sperre WHERE nummer_kern = ${nummerFuer(34).slice(-9)} AND aufgehoben_am IS NULL`) as any[];
    ok(sp34?.quelle === "whatsapp" && (await einw(p34)).length === 0, "der Webhook-Eingang setzt die Telefonsperre (und legt kein Ja an)", sp34);
    let vorb: any = null;
    for (let i = 0; i < 80; i++) {
      [vorb] = (await sql`SELECT antwort_text, antwort_handlung FROM fiaon_whatsapp_gespraech WHERE nummer = ${nummerFuer(34)}`) as any[];
      if (vorb?.antwort_text) break;
      await warte(250);
    }
    ok(vorb?.antwort_text === SPERRE_SATZ && /Telefonsperre gesetzt/.test(String(vorb?.antwort_handlung)), "Mara: „Verstanden – wir rufen Sie nicht mehr an.“ (fester Satz, kein Modell)", vorb);
    await sql`UPDATE fiaon_whatsapp_gespraech SET antwort_text = NULL, antwort_faellig_am = NULL WHERE nummer = ${nummerFuer(34)}`;
  }

  console.log("── B9 · Maras echte Antwort (maraAntwortet, Attrappe für das Modell): die Frage hängt als eigener Absatz dran");
  {
    // Netz: nur lokal und die Attrappe des Modells (wie pruef-mara-wa-e372.ts) — nichts geht raus.
    const plan: { antworten: string[] } = { antworten: ["Sehr gern!"] };
    const MODELL: { system: string; antwort: string }[] = [];
    const echt = globalThis.fetch;
    const attrappe = (async (eingabe: any, init?: any) => {
      const u = String(typeof eingabe === "string" ? eingabe : eingabe instanceof URL ? eingabe.href : eingabe?.url ?? eingabe);
      if (/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(u)) return echt(eingabe, init);
      if (u.startsWith("https://api.openai.com/")) {
        let body: any = {};
        try { body = JSON.parse(typeof init?.body === "string" ? init.body : "{}"); } catch { /* leer */ }
        const input: any[] = Array.isArray(body.input) ? body.input : [];
        const system = String(input.find((i) => i?.role === "system")?.content ?? "");
        const zweiter = input.filter((i) => i?.role === "user").some((i) => /darf so nicht raus|noch nicht gut genug/.test(String(i.content ?? "")));
        const antwort = String(zweiter ? (plan.antworten[1] ?? plan.antworten[0]) : plan.antworten[0]);
        MODELL.push({ system, antwort });
        return new Response(JSON.stringify({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ antwort, gemerkt: "", mensch: false, uebergabe: "" }) }] }], usage: { input_tokens: 10, output_tokens: 10 } }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      throw new Error(`Prüfstand: kein Netz (${u})`);
    }) as typeof fetch;
    globalThis.fetch = attrappe;
    (globalThis as any).__kiRohFetch = attrappe;
    process.env.OPENAI_API_KEY = "sk-pruef-lokal-ja-zum-anruf";
    try {
      await sql`INSERT INTO fiaon_settings (key, value) VALUES ('mara_wa_an', 'an') ON CONFLICT (key) DO UPDATE SET value = 'an'`;
      await sql`DELETE FROM fiaon_settings WHERE key = 'ki_pause'`;
      (await import("../server/lib/fiaon-ki-pause")).kiPauseZwischenspeicherLeeren();
      const wa = await import("../server/lib/fiaon-whatsapp-mara");
      /** Ein zahlender Kunde (Rate 1 bezahlt, Rate 2 erst in 25 Tagen) mit Maras Begrüßung von gestern und seiner Frage von eben. */
      const zahlender = async (nr: number, frage: string) => {
        const pid = await person(nr, { antrag: false });
        const ref = `FIAON-PRUEFJA-${LAUF}-K${nr}`, zahl = `FIAON-J${LAUF.slice(0, 3)}${String(nr).padStart(2, "0")}`;
        await sql`INSERT INTO fiaon_applications (ref, payment_reference, person_id, status, payment_status, current_step, pack_key, ist_entwurf, agb_stand, created_at, user_agent, paid_at, submitted_at, email, first_name, last_name)
          VALUES (${ref}, ${zahl}, ${pid}, 'approved', 'paid', 8, 'ultra', FALSE, '2026-09-10', NOW() - INTERVAL '5 days', 'Mozilla/5.0 (Prüfstand E-408 Ja)', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days',
                  ${`pruefstand.ja.${LAUF.toLowerCase()}.${nr}@example.com`}, 'Pia', ${`Japrobe ${LAUF}-${nr}`})`;
        await sql`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status, bezahlt_am) VALUES (${ref}, 1, ${`${zahl}-1`}, 9999, NOW() - INTERVAL '5 days', 'bezahlt', NOW() - INTERVAL '5 days')`;
        await sql`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status) VALUES (${ref}, 2, ${`${zahl}-2`}, 9999, (NOW() AT TIME ZONE 'Europe/Berlin')::date + 25, 'offen')`;
        await raus(nr, pid, "Hallo, hier ist Mara, die digitale Assistentin von FIAON.", 20 * 60, "Mara", "fiaon_kkb_test");
        await rein(nr, pid, frage, 0.3);
        return pid;
      };
      const antworten = async (nr: number) => {
        const vorher = MODELL.length;
        await wa.maraAntwortet(nummerFuer(nr));
        const [g] = (await sql`SELECT antwort_text, antwort_handlung FROM fiaon_whatsapp_gespraech WHERE nummer = ${nummerFuer(nr)}`) as any[];
        await sql`UPDATE fiaon_whatsapp_gespraech SET antwort_text = NULL, antwort_faellig_am = NULL WHERE nummer = ${nummerFuer(nr)}`;
        return { text: String(g?.antwort_text ?? ""), handlung: String(g?.antwort_handlung ?? ""), modell: MODELL.slice(vorher) };
      };
      const SACH = "Nach der Zusage der Bank dauert es in der Regel 2–5 Werktage, meist haben Sie vorher schon Apple Pay.";

      const p31 = await zahlender(31, "Wie lange dauert es nach der Zusage der Bank, bis ich die Karte habe?");
      plan.antworten = [SACH];
      const a31 = await antworten(31);
      ok(a31.modell.length >= 1 && a31.text === `${SACH}\n\n${FRAGE}`, "Maras Antwort bleibt Wort für Wort — die Frage steht als eigener Absatz darunter", a31.text);
      ok(/nach dem Ja zum Anruf gefragt/.test(a31.handlung), "der Aktenvermerk nennt die Frage („nach dem Ja zum Anruf gefragt“)", a31.handlung);

      const p32 = await zahlender(32, "Wie lange dauert es nach der Zusage der Bank, bis ich die Karte habe?");
      plan.antworten = [`${SACH} Soll ich Ihnen dazu noch etwas schicken?`];
      const a32 = await antworten(32);
      ok(a32.modell.length >= 1 && a32.text.length > 0 && !a32.text.includes(FRAGE), "Rot-Probe: fragt Maras Antwort selbst etwas, hängt keine zweite Frage dran", a32.text);
      void p32;

      // Die Antwort an 31 ging raus (wie im Versandtakt) — er schreibt etwas anderes als Ja: keine zweite Frage, kein „Ok = Zustimmung“.
      await raus(31, p31, a31.text, 0.2, "Mara Lindner");
      await rein(31, p31, "Ok", 0.1);
      plan.antworten = ["Alles klar, melden Sie sich gern, wenn Sie Fragen haben."];
      const a31b = await antworten(31);
      const sys = a31b.modell[0]?.system ?? "";
      ok(a31b.text.length > 0 && !a31b.text.includes(FRAGE), "Rot-Probe: gerade gefragt (30 Tage) → keine zweite Frage", a31b.text);
      ok(/KEIN klares JA/.test(sys) && !/es ist seine Zustimmung/.test(sys), "„Ok“ auf die Frage ist kein Ja: Mara bekommt den Hinweis, nichts zu versprechen — nicht „Zustimmung“", sys.slice(0, 200));
      ok((await einw(p31)).length === 0, "„Ok“ legt keine Einwilligung an");

      // Ein bloßer Widerruf („bitte jetzt nicht anrufen“) läuft wie bisher über das Modell — mit dem Hinweis „zurückgenommen“.
      const p35 = await zahlender(35, "Wie lange dauert es nach der Zusage der Bank, bis ich die Karte habe?");
      await E.einwilligungMerken({ personId: p35, nummer: `+${nummerFuer(35)}`, art: "antrag_kaestchen", wortlaut: "Prüfstand: Antrag-Kästchen", quelleArt: "antrag", quelleId: `PRUEF-${LAUF}-35` });
      await sql`UPDATE fiaon_whatsapp SET empfangen_am = NOW() - INTERVAL '30 seconds', created_at = NOW() - INTERVAL '30 seconds' WHERE nummer = ${nummerFuer(35)} AND richtung = 'rein'`;
      await raus(35, p35, SACH, 0.4, "Mara Lindner");
      const w35 = await eingang(35, p35, "Bitte jetzt nicht anrufen, ich bin im Meeting", 0.1);
      plan.antworten = ["Alles klar, ist notiert."];
      const a35 = await antworten(35);
      const sys35 = a35.modell[0]?.system ?? "";
      ok(w35.r.nein && !w35.r.gesperrt && a35.modell.length >= 1 && a35.text === "Alles klar, ist notiert." && /ZURÜCKGENOMMEN/.test(sys35) && !/NICHT MEHR ANGERUFEN/.test(sys35),
        "weicher Widerruf: Maras Antwort wie bisher (Modell mit „zurückgenommen“), kein Sperr-Satz", { r: w35.r, text: a35.text });

      // Sperre UND eine Frage dazu: das Modell antwortet — mit dem Hinweis, dass wir ihn nicht mehr anrufen.
      const p36 = await zahlender(36, "Wie lange dauert es nach der Zusage der Bank, bis ich die Karte habe?");
      await sql`UPDATE fiaon_whatsapp SET empfangen_am = NOW() - INTERVAL '30 seconds', created_at = NOW() - INTERVAL '30 seconds' WHERE nummer = ${nummerFuer(36)} AND richtung = 'rein'`;
      await raus(36, p36, SACH, 0.4, "Mara Lindner");
      const s36 = await eingang(36, p36, "Rufen Sie mich nicht mehr an! Wann kommt denn jetzt meine Karte?", 0.1);
      plan.antworten = ["Verstanden, wir rufen Sie nicht mehr an. Ihre Karte kommt nach der Zusage der Bank in 2–5 Werktagen."];
      const a36 = await antworten(36);
      const sys36 = a36.modell[0]?.system ?? "";
      ok(s36.r.gesperrt === true && a36.modell.length >= 1 && /NICHT MEHR ANGERUFEN/.test(sys36) && a36.text.includes("Ihre Karte kommt") && !a36.text.includes(FRAGE),
        "Sperre mit einer Frage dazu: das Modell antwortet auf beides (Hinweis „nicht mehr anrufen“), keine Frage nach dem Ja", { r: s36.r, text: a36.text });
    } finally {
      globalThis.fetch = echt;
      delete (globalThis as any).__kiRohFetch;
      delete process.env.OPENAI_API_KEY;
    }
  }

  console.log("── B7 · Meta: Formular mit Kästchen „anruf_einwilligung“ → „meta_kaestchen“");
  const M = await import("../server/lib/fiaon-meta-leads");
  await M.metaTabellen();
  const kasten = "Ja, FIAON darf mich telefonisch zu meiner Anfrage anrufen – auch ARAS, die digitale Mitarbeiterin von FIAON (eine KI). Freiwillig, jederzeit widerrufbar.";
  const formular = async (id: string, pflicht: boolean | null) => {
    await sql`INSERT INTO fiaon_meta_formulare (id, name, status, sprache, fragen, kaestchen, geladen_am)
              VALUES (${id}, ${`Prüfstand ${id}`}, 'ACTIVE', 'de_DE',
                      ${sql.json([{ key: "full_name", label: "Full name", type: "FULL_NAME" }, { key: "email", label: "Email", type: "EMAIL" }, { key: "phone_number", label: "Phone number", type: "PHONE" }] as any)},
                      ${sql.json((pflicht === null ? [] : [{ key: "anruf_einwilligung", text: kasten, is_required: pflicht }]) as any)}, NOW())
              ON CONFLICT (id) DO NOTHING`;
  };
  await formular(`PRUEFJA${LAUF}F1`, false);
  await formular(`PRUEFJA${LAUF}F2`, true);
  await formular(`PRUEFJA${LAUF}F3`, null);
  const metaLead = (nr: number, form: string, haken: unknown | undefined) => ({
    id: `PRUEFJA${LAUF}L${nr}`, created_time: new Date(Date.now() - 5 * 60_000).toISOString(), form_id: form, platform: "ig",
    field_data: [{ name: "full_name", values: [`Mia Metaprobe ${LAUF}${nr}`] }, { name: "email", values: [`pruefstand.ja.meta.${LAUF.toLowerCase()}.${nr}@example.com`] },
      { name: "phone_number", values: [`+${nummerFuer(nr)}`] }],
    custom_disclaimer_responses: haken === undefined ? [] : [{ checkbox_key: "anruf_einwilligung", is_checked: haken as any }],
  });
  const metaZeilen = async (metaId: string) => (await sql`SELECT * FROM fiaon_telefon_einwilligung WHERE quelle_art = 'meta_lead' AND quelle_id = ${metaId}`) as any[];
  const m1 = await M.metaLeadEinspielen(metaLead(21, `PRUEFJA${LAUF}F1`, "1"), "meta_webhook", null);
  const mz = (await metaZeilen(`PRUEFJA${LAUF}L21`))[0] ?? {};
  ok(m1.status === "neu" && m1.leadId && (await metaZeilen(`PRUEFJA${LAUF}L21`)).length === 1, "Lead angelegt, genau eine Einwilligung", m1);
  ok(mz.art === "meta_kaestchen" && mz.wortlaut === kasten && Number(mz.lead_id) === Number(m1.leadId) && mz.person_id != null && mz.nummer === `+${nummerFuer(21)}`
    && mz.beleg?.schluessel === "anruf_einwilligung" && mz.beleg?.weg === "kaestchen" && mz.beleg?.formularId === `PRUEFJA${LAUF}F1`, "Art meta_kaestchen, Wortlaut des Kästchens, Lead, Person, Nummer, Formular im Beleg", mz);
  ok(Math.abs(new Date(mz.erteilt_am).getTime() - (Date.now() - 5 * 60_000)) < 5000, "Zeitpunkt = sein Absenden bei Meta");
  const m1b = await M.metaLeadEinspielen(metaLead(21, `PRUEFJA${LAUF}F1`, "1"), "meta_nachhol", null);
  ok(m1b.status === "dublette" && (await metaZeilen(`PRUEFJA${LAUF}L21`)).length === 1, "derselbe Lead noch einmal (Nachhol-Lauf) → bleibt eine", m1b);
  const m2 = await M.metaLeadEinspielen(metaLead(22, `PRUEFJA${LAUF}F1`, "0"), "meta_webhook", null);
  ok(m2.status === "neu" && (await metaZeilen(`PRUEFJA${LAUF}L22`)).length === 0, "Rot-Probe: Kästchen nicht angehakt → Lead ja, Einwilligung nein", m2);
  const m3 = await M.metaLeadEinspielen(metaLead(23, `PRUEFJA${LAUF}F2`, "1"), "meta_webhook", null);
  ok(m3.status === "neu" && (await metaZeilen(`PRUEFJA${LAUF}L23`)).length === 0, "Rot-Probe: Pflicht-Kästchen (nicht freiwillig) → keine Einwilligung", m3);
  const m4 = await M.metaLeadEinspielen(metaLead(24, `PRUEFJA${LAUF}F3`, undefined), "meta_webhook", null);
  ok(m4.status === "neu" && (await metaZeilen(`PRUEFJA${LAUF}L24`)).length === 0, "Formular ohne Kästchen (wie heute in der Produktion) → keine Einwilligung", m4);
}

// ═══════════════════════════════════════════════════════════════════════════
// C — BROWSER (lokaler Server, dieselbe lokale Datenbank)
// ═══════════════════════════════════════════════════════════════════════════
async function teilC() {
  teil = "C";
  const { sqlPool: sql } = await import("../server/lib/db-pool");
  console.log("── C0 · Wache: schaut der Server in DIESE lokale Datenbank?");
  await prueferAnlegen();
  const [agent] = (await sql`SELECT id, session_epoch, name FROM fiaon_agents WHERE id = ${AGENT}`) as any[];
  const exp = Date.now() + 30 * 60_000;
  const nutzlast = `${AGENT}.${Number(agent?.session_epoch ?? 0)}.${exp}`;
  const token = `${nutzlast}.${createHmac("sha256", String(GEHEIM)).update(`agent2:${nutzlast}`).digest("hex").slice(0, 40)}`;
  const nr = 40;
  const [p] = (await sql`
    INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_phone, phone_key9, primary_email, country)
    VALUES (${`PRUEF-JA-${LAUF}-C`}, 'Paula', ${`Anrufprobe ${LAUF}`}, ${`+${nummerFuer(nr)}`}, ${nummerFuer(nr).slice(-9)}, ${`pruefstand.ja.${LAUF.toLowerCase()}.c@example.com`}, 'DE')
    RETURNING id`) as any[];
  const pid = Number(p.id);
  await sql`INSERT INTO fiaon_applications (ref, payment_reference, person_id, status, email, first_name, last_name, created_at)
            VALUES (${`FIAON-PRUEFJA-${LAUF}-C`}, ${`FIAON-JC${LAUF}`}, ${pid}, 'started', ${`pruefstand.ja.${LAUF.toLowerCase()}.c@example.com`}, 'Paula', ${`Anrufprobe ${LAUF}`}, NOW() - INTERVAL '1 day')`;
  // Er hat vor zwei Stunden geschrieben, Mara hat geantwortet (Fenster offen, nichts wartet).
  const t1 = new Date(Date.now() - 120 * 60_000), t2 = new Date(Date.now() - 119 * 60_000);
  await sql`INSERT INTO fiaon_whatsapp (wa_id, richtung, nummer, person_id, typ, text, status, empfangen_am, created_at) VALUES (${`wamid.PRUEFJA.${LAUF}.c1`}, 'rein', ${nummerFuer(nr)}, ${pid}, 'text', 'Danke für die Infos!', 'empfangen', ${t1}, ${t1})`;
  await sql`INSERT INTO fiaon_whatsapp (wa_id, richtung, nummer, person_id, typ, text, status, von, gesendet_am, created_at) VALUES (${`wamid.PRUEFJA.${LAUF}.c2`}, 'raus', ${nummerFuer(nr)}, ${pid}, 'text', 'Sehr gern!', 'read', 'Mara Lindner', ${t2}, ${t2})`;
  const zeile = async () => (await sql`SELECT art, widerrufen_am FROM fiaon_telefon_einwilligung WHERE person_id = ${pid} ORDER BY id DESC LIMIT 1`) as any[];

  const wache = await fetch(`${SERVER}/api/fiaon/agent/kunden/${pid}/aras/ja`, { headers: { cookie: `fiaon_agent_token=${token}` } });
  const wj = await wache.json().catch(() => null);
  ok(wache.status === 200 && wj?.zeile === "Noch kein Ja zum Anruf", "der Server kennt die Prüfperson (gleiche lokale DB) und die Sitzung des Prüfkontos", { s: wache.status, wj });
  if (wache.status !== 200) return;

  const { chromium } = await import("playwright");
  const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const browser = await chromium.launch(existsSync(chrome) ? { executablePath: chrome } : {});
  if (FOTOS) mkdirSync(FOTOS, { recursive: true });
  const host = new URL(String(SERVER)).hostname;
  /** Die Hinweise des Office für ein frisches Prüfkonto (Verfügbarkeit fehlt, Rundgang) — nur schließen, nichts eintragen. */
  const wegklicken = async (page: import("playwright").Page) => {
    for (const t of ["Überspringen", "In 5 Minuten erinnern", "Später", "Schließen"]) {
      const k = page.getByRole("button", { name: t, exact: true }).first();
      if (await k.count().catch(() => 0)) await k.click({ timeout: 800 }).catch(() => {});
    }
  };
  const seite = async (breite: number, hoehe: number, person = pid) => {
    const ctx = await browser.newContext({ viewport: { width: breite, height: hoehe }, deviceScaleFactor: 2, ...(breite < 500 ? { isMobile: true, hasTouch: true } : {}) });
    await ctx.addCookies([{ name: "fiaon_agent_token", value: token, domain: host, path: "/", httpOnly: true, secure: false }]);
    const page = await ctx.newPage();
    const fehler: string[] = [];
    page.on("pageerror", (e) => fehler.push(String(e).slice(0, 200)));
    await page.goto(`${SERVER}/agent/kunden?person=${person}`, { waitUntil: "domcontentloaded" });
    for (let i = 0; i < 40 && !(await page.locator('[data-fiaon="aras-ja-zeile"]').count()); i++) {
      await wegklicken(page);
      await page.waitForTimeout(500);
    }
    // Hinweise des Office (Verfügbarkeit, Rundgang) blenden sich NACH dem Laden ein — noch einmal wegklicken.
    await page.waitForTimeout(1500);
    await wegklicken(page);
    return { ctx, page, fehler };
  };
  const block = (page: import("playwright").Page) => page.locator('[data-fiaon="aras-ja"]');
  const foto = async (page: import("playwright").Page, name: string) => {
    if (!FOTOS) return;
    await wegklicken(page);
    await page.waitForTimeout(600);
    const karte = page.locator('[data-fiaon="aras-karte"]');
    await karte.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(400);
    await karte.screenshot({ path: `${FOTOS}/${name}.png` }).catch(async () => { await page.screenshot({ path: `${FOTOS}/${name}.png`, fullPage: false }); });
  };

  console.log("── C1 · Rechner (1360 px): lesen, eintragen, widerrufen");
  {
    const { ctx, page, fehler } = await seite(1360, 900);
    const da = await page.locator('[data-fiaon="aras-ja-zeile"]').count();
    ok(da === 1, "die Karte „ARAS“ zeigt den Block „Ja zum Anruf“", { da, fehler });
    if (da) {
      ok((await page.locator('[data-fiaon="aras-ja-zeile"]').innerText()).trim() === "Noch kein Ja zum Anruf", "Zeile: „Noch kein Ja zum Anruf“");
      await foto(page, "1-rechner-noch-kein-ja");
      const eintragen = block(page).getByRole("button", { name: "Ja zum Anruf eintragen" });
      ok(await eintragen.isEnabled(), "„Ja zum Anruf eintragen“ ist da und aktiv");
      await eintragen.click();
      const dialog = page.locator('[data-fiaon="aras-ja-dialog"]');
      await dialog.waitFor({ timeout: 5000 }).catch(() => {});
      const knopf = dialog.getByRole("button", { name: "Eintragen", exact: true });
      ok(await dialog.isVisible() && /Der Kunde hat mir gerade im Gespräch gesagt, dass FIAON ihn anrufen darf, auch ARAS \(KI\)/.test(await dialog.innerText()), "der Dialog zeigt die Pflicht-Bestätigung");
      ok(await knopf.isDisabled(), "Rot-Probe: ohne Häkchen ist „Eintragen“ grau");
      await foto(page, "2-rechner-dialog");
      await knopf.click({ force: true, timeout: 1500 }).catch(() => {});
      await page.waitForTimeout(800);
      ok((await zeile()).length === 0, "Rot-Probe: ein Klick auf das graue „Eintragen“ speichert nichts");
      await dialog.getByRole("checkbox").check();
      ok(await knopf.isEnabled(), "mit Häkchen wird „Eintragen“ aktiv");
      await knopf.click();
      await page.waitForFunction(() => /^Ja zum Anruf: seit /.test(document.querySelector('[data-fiaon="aras-ja-zeile"]')?.textContent ?? ""), null, { timeout: 8000 }).catch(() => {});
      const z = await zeile();
      const text = (await page.locator('[data-fiaon="aras-ja-zeile"]').innerText()).trim();
      ok(z.length === 1 && z[0].art === "chef" && new RegExp(`^Ja zum Anruf: seit \\d\\d\\.\\d\\d\\. \\(im Gespräch mit ${String(agent?.name).replace(/[()]/g, "\\$&")}\\)$`).test(text), "eingetragen: Zeile „Ja zum Anruf: seit TT.MM. (im Gespräch mit …)“, Art chef in der DB", { text, z });
      await foto(page, "3-rechner-ja-gilt");
      await block(page).getByRole("button", { name: "Ja widerrufen" }).click();
      await block(page).getByRole("button", { name: "Ja, widerrufen" }).click();
      await page.waitForFunction(() => /Widerrufen am/.test(document.querySelector('[data-fiaon="aras-ja-zeile"]')?.textContent ?? ""), null, { timeout: 8000 }).catch(() => {});
      const z2 = await zeile();
      ok(z2[0]?.widerrufen_am && / · Widerrufen am \d\d\.\d\d\.$/.test((await page.locator('[data-fiaon="aras-ja-zeile"]').innerText()).trim()), "widerrufen (mit Rückfrage): „… · Widerrufen am TT.MM.“");
      await foto(page, "4-rechner-widerrufen");
      // „Mara fragt nach dem Ja“: Fenster offen, also aktiv — der Server hat keinen WhatsApp-Zugang, der Grund bleibt rot stehen.
      const fragt = block(page).getByRole("button", { name: "Mara fragt nach dem Ja" });
      ok(await fragt.isEnabled(), "„Mara fragt nach dem Ja“ ist aktiv (er hat vor 2 h geschrieben)");
      await fragt.click();
      await page.locator('[data-fiaon="aras-ja-fehler"]').waitFor({ timeout: 8000 }).catch(() => {});
      const f = await page.locator('[data-fiaon="aras-ja-fehler"]').innerText().catch(() => "");
      const [raus] = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_whatsapp WHERE nummer = ${nummerFuer(nr)} AND richtung = 'raus' AND status <> 'fehler' AND text LIKE ${"%Antworten Sie einfach mit JA.%"}`) as any[];
      ok(/ging nicht raus: WhatsApp ist noch nicht eingerichtet/.test(f) && Number(raus?.n) === 0, "ohne WhatsApp-Zugang: der Grund steht rot da und bleibt — nichts ging raus", f);
      await foto(page, "5-rechner-mara-fragt-ohne-zugang");
      ok(fehler.length === 0, "keine Fehler in der Seite", fehler);
    }
    await ctx.close();
  }

  console.log("── C2 · Handy (390 px): die Zeile und der Grund, warum Mara gerade nicht fragt");
  {
    // Fenster zu: seine letzte Nachricht ist über 24 Stunden alt.
    await sql`UPDATE fiaon_whatsapp SET empfangen_am = NOW() - INTERVAL '30 hours', created_at = NOW() - INTERVAL '30 hours' WHERE nummer = ${nummerFuer(nr)} AND richtung = 'rein'`;
    const { ctx, page, fehler } = await seite(390, 844);
    const da = await page.locator('[data-fiaon="aras-ja-zeile"]').count();
    ok(da === 1, "am Handy: der Block ist da", { fehler });
    if (da) {
      const fragt = block(page).getByRole("button", { name: "Mara fragt nach dem Ja" });
      const warum = (await page.locator('[data-fiaon="aras-ja-warum"]').innerText().catch(() => "")).trim();
      ok(await fragt.isDisabled() && /Fenster ist zu/.test(warum), "Rot-Probe am Handy: Fenster zu → „Mara fragt“ grau, der Grund steht als Text darunter", warum);
      const breit = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
      ok(breit, "am Handy: kein seitliches Scrollen");
      await foto(page, "6-handy-390");
      ok(fehler.length === 0, "keine Fehler in der Seite", fehler);
    }
    await ctx.close();
  }
  console.log("── C3 · Handy (390 px): ein Ja, das per WhatsApp kam");
  {
    const L = await import("../server/lib/fiaon-ja-zum-anruf");
    const nr2 = 41;
    const [p2] = (await sql`
      INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_phone, phone_key9, primary_email, country)
      VALUES (${`PRUEF-JA-${LAUF}-C3`}, 'Paul', ${`Waprobe ${LAUF}`}, ${`+${nummerFuer(nr2)}`}, ${nummerFuer(nr2).slice(-9)}, ${`pruefstand.ja.${LAUF.toLowerCase()}.c3@example.com`}, 'DE')
      RETURNING id`) as any[];
    const pid2 = Number(p2.id);
    const t = (min: number) => new Date(Date.now() - min * 60_000);
    await sql`INSERT INTO fiaon_whatsapp (wa_id, richtung, nummer, person_id, typ, text, status, empfangen_am, created_at) VALUES (${`wamid.PRUEFJA.${LAUF}.c31`}, 'rein', ${nummerFuer(nr2)}, ${pid2}, 'text', 'Wie lange dauert das?', 'empfangen', ${t(15)}, ${t(15)})`;
    await sql`INSERT INTO fiaon_whatsapp (wa_id, richtung, nummer, person_id, typ, text, status, von, gesendet_am, created_at) VALUES (${`wamid.PRUEFJA.${LAUF}.c32`}, 'raus', ${nummerFuer(nr2)}, ${pid2}, 'text', ${`Nach der Zahlung geht es sofort los.\n\n${FRAGE}`}, 'read', 'Mara Lindner', ${t(14)}, ${t(14)})`;
    const [ja] = (await sql`INSERT INTO fiaon_whatsapp (wa_id, richtung, nummer, person_id, typ, text, status, empfangen_am, created_at) VALUES (${`wamid.PRUEFJA.${LAUF}.c33`}, 'rein', ${nummerFuer(nr2)}, ${pid2}, 'text', 'Ja gerne', 'empfangen', ${t(13)}, ${t(13)}) RETURNING id`) as any[];
    await L.jaAusWhatsApp({ nummer: nummerFuer(nr2), nachrichtId: Number(ja.id), text: "Ja gerne", personId: pid2, leadId: null });
    const { ctx, page } = await seite(390, 844, pid2);
    const text = (await page.locator('[data-fiaon="aras-ja-zeile"]').innerText().catch(() => "")).trim();
    ok(new RegExp("^Ja zum Anruf: seit \\d\\d\\.\\d\\d\\. \\(WhatsApp\\)$").test(text) && await block(page).getByRole("button", { name: "Ja widerrufen" }).isVisible(),
      "am Handy: „Ja zum Anruf: seit TT.MM. (WhatsApp)“ und „Ja widerrufen“", text);
    await foto(page, "7-handy-ja-per-whatsapp");
    await ctx.close();
  }
  await browser.close();
}

// ═══════════════════════════════════════════════════════════════════════════
(async () => {
  await teilA().catch((e) => ok(false, "Teil A brach ab", String(e?.stack ?? e).slice(0, 400)));
  if (LOKAL_DB) await teilB().catch((e) => { teil = "B"; ok(false, "Teil B brach ab — die übrigen Prüfungen von B fehlen", String(e?.stack ?? e).slice(0, 400)); });
  else console.log("\n(B und C übersprungen — keine lokale Prüfdatenbank in DATABASE_URL)");
  if (SERVER) await teilC().catch((e) => { teil = "C"; ok(false, "Teil C brach ab", String(e?.stack ?? e).slice(0, 400)); });
  const teile = Object.entries(teilZahl).map(([k, [g, r]]) => `${k}: ${g} grün${r ? `, ${r} rot` : ""}`).join(" · ");
  console.log(`\n${schlecht ? "✗" : "✓"} ${gut}/${gut + schlecht} Prüfungen bestanden (${teile})`);
  // Die Begrüßung neuer Meta-Leads läuft im Hintergrund weiter (ohne Mail-Schlüssel scheitert sie still) — erst warten, dann schließen.
  if (LOKAL_DB) { await warte(2500); const { sqlPool } = await import("../server/lib/db-pool"); await sqlPool.end({ timeout: 2 }).catch(() => {}); }
  process.exit(schlecht ? 1 : 0);
})().catch((e) => { console.error("ABBRUCH:", e); process.exit(2); });
