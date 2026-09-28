// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: MARA SPIELT ECHTE GESPRÄCHE NOCH EINMAL (28.09.2026, E-248)
//
// Justin am 28.09.: „Merkst du nicht, dass Mara gar nicht den persönlichen
// Link, sondern nur /antrag sendet? … Geh Mara komplett durch: bucht sie alle
// Termine richtig? Aufgaben richtig? … optimiere sie um 100 %!"
//
// Drei Teile:
//   A. REGELN OHNE DATENBANK — Schweigen (inkl. der Musterdialoge aus
//      shared/fiaon-mara-ton.ts), Uhrzeiten in jeder Schreibweise, falscher
//      Preisalarm 79,99 €, Reparieren (ISO, Emojis), Link- und Tonprüfung,
//      heikle Anliegen (P30), Aufgaben-Klassen, Zahltag „an 1", sicherer Satz,
//      Rückfallsatz, Wortwand bei Fragen (P5/P7), der Auftrag an das Modell.
//   B. WIEDERGABE — echte Gespräche aus der Produktion (NUR gelesen, Namen und
//      Referenzen ersetzt, Nummern gekürzt) laufen Schritt für Schritt durch
//      GENAU maraAntwortet — gegen die lokale Test-DB, mit einem Attrappen-Modell
//      (fetch nachgebaut, kein Netz). Geprüft: schweigen/antworten/Abschluss,
//      Termin 20 Uhr bestätigt (Fall K.), Autoantworten still (Nagelstudio,
//      Praxis), Kredit positiv, kein ISO-Datum, erfundene Uhrzeit abgelehnt,
//      nackter /antrag-Link abgelehnt, höchstens eine Aufgabe je Grund.
//      Fälle: .pruef/mara-wiedergabe/*.json (nicht im Repo — echte Chats, auch
//      anonymisiert nicht öffentlich; Herkunft: .pruef/e248-wiedergabe-export/LIESMICH.txt).
//   C. Mit --ki: dasselbe mit dem ECHTEN Modell (OPENAI_API_KEY aus der
//      Umgebung) — ohne Versand (WhatsApp nicht eingerichtet, fetch außer OpenAI
//      gesperrt), nur lokale Test-DB. Ausgabe je Schritt: ALT (damals) gegen NEU.
//
//   env -i PATH="$PATH" HOME="$HOME" DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand?sslmode=require' \
//     SESSION_SECRET=pruefstand-nur-lokal DOTENV_CONFIG_PATH=/dev/null npx tsx scripts/pruef-mara-wiedergabe.ts [--nur termin] [--ki]
//   (für --ki zusätzlich OPENAI_API_KEY=… in dieselbe Zeile)
// Eigene Datensätze (Nummern 4915900248xxx, Personen PRUEF248-…, Agenten pruef248-…@fiaon.invalid,
// Referenzen FIAON-P248…) werden am Ende entfernt.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync, existsSync } from "node:fs";

const KI = process.argv.includes("--ki");
const NUR = (() => { const i = process.argv.indexOf("--nur"); return i > 0 ? String(process.argv[i + 1] ?? "") : ""; })();
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID", "META_SYSTEM_TOKEN",
  "GOOGLE_SA_KEY", "GMAIL_CLIENT_SECRET", "RESEND_API_KEY", "TWILIO_AUTH_TOKEN", "VAPID_PRIVATE_KEY", ...(KI ? [] : ["OPENAI_API_KEY"])]) {
  if (process.env[k]) { console.error(`${k} ist gesetzt — Abbruch, der Prüfstand darf nichts versenden.`); process.exit(3); }
}
if (KI && !process.env.OPENAI_API_KEY) { console.error("--ki braucht OPENAI_API_KEY in der Umgebung."); process.exit(3); }
if (!/127\.0\.0\.1:54329\/fiaon_pruefstand/.test(String(process.env.DATABASE_URL))) { console.error("NUR gegen die lokale Test-DB!"); process.exit(3); }
process.env.CRONS = "aus";
process.env.SESSION_SECRET ||= "pruefstand-nur-lokal";
if (!KI) process.env.OPENAI_API_KEY = "sk-pruef-lokal-e248";

// ── Netz: nur lokal und (Attrappe oder, mit --ki, echt) OpenAI ─────────────
type Plan = { werkzeug?: { name: string; args: Record<string, unknown> }; antworten: string[]; mensch?: boolean; uebergabe?: string };
let plan: Plan | null = null;
let ersetzen: (t: string, extra?: Record<string, string>) => string = (t) => t;
const OPENAI: { system: string; nutzer: string[]; werkzeugErgebnisse: any[]; zweiter: boolean; antwort?: string }[] = [];
const FREMD: string[] = [];
const json = (status: number, j: unknown) => new Response(JSON.stringify(j), { status, headers: { "Content-Type": "application/json" } });
const echtFetch = globalThis.fetch;
globalThis.fetch = (async (eingabe: any, init?: any) => {
  const u = String(typeof eingabe === "string" ? eingabe : eingabe instanceof URL ? eingabe.href : eingabe?.url ?? eingabe);
  if (/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(u)) return echtFetch(eingabe, init);
  if (u.startsWith("https://api.openai.com/")) {
    let body: any = {};
    try { body = JSON.parse(typeof init?.body === "string" ? init.body : "{}"); } catch { /* leer */ }
    const input: any[] = Array.isArray(body.input) ? body.input : [];
    const system = String(input.find((i) => i?.role === "system")?.content ?? "");
    const nutzer = input.filter((i) => i?.role === "user").map((i) => String(i.content ?? ""));
    const werkzeugErgebnisse = input.filter((i) => i?.type === "function_call_output").map((i) => { try { return JSON.parse(String(i.output)); } catch { return {}; } });
    const zweiter = nutzer.some((t) => /darf so nicht raus|noch nicht gut genug/.test(t));
    const eintrag = { system, nutzer, werkzeugErgebnisse, zweiter } as (typeof OPENAI)[number];
    OPENAI.push(eintrag);
    if (KI) return echtFetch(eingabe, init);
    const p = plan ?? { antworten: ["Sehr gern!"] };
    if (p.werkzeug && Array.isArray(body.tools) && body.tools.length && !werkzeugErgebnisse.length) {
      const args = JSON.parse(ersetzen(JSON.stringify(p.werkzeug.args)));
      return json(200, { status: "completed", output: [{ type: "function_call", call_id: `pruef-${OPENAI.length}`, name: p.werkzeug.name, arguments: JSON.stringify(args) }], usage: { input_tokens: 10, output_tokens: 10 } });
    }
    const so = [...werkzeugErgebnisse].reverse().find((w) => w?.so_schreiben)?.so_schreiben ?? "";
    const roh = zweiter ? (p.antworten[1] ?? p.antworten[0]) : p.antworten[0];
    const text = ersetzen(roh, { SO_SCHREIBEN: String(so) });
    eintrag.antwort = text;
    const antwort = JSON.stringify({ antwort: text, gemerkt: "", mensch: !!p.mensch, uebergabe: p.uebergabe ?? "" });
    return json(200, { status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: antwort }] }], usage: { input_tokens: 10, output_tokens: 10 } });
  }
  FREMD.push(u);
  throw new Error(`Prüfstand: kein Netz (${u})`);
}) as typeof fetch;

let geprueft = 0, fehler = 0;
function ok(bed: unknown, text: string) {
  geprueft++;
  if (bed) console.log(`  ✓ ${text}`); else { fehler++; console.log(`  ✗ ${text}`); }
}

const { sqlPool: sql } = await import("../server/lib/db-pool");
const kp = await import("../server/lib/fiaon-ki-pause");
kp.kiNetzAbsichern();
const wa = await import("../server/lib/fiaon-whatsapp-mara");
const sw = await import("../server/lib/fiaon-mara-schweigen");
const ton = await import("../shared/fiaon-mara-ton");
const { wandPruefen } = await import("../shared/fiaon-wortverbote");
const { sendePruefung } = await import("../server/lib/fiaon-whatsapp");

const berlinIso = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
const hhmm = (d: Date) => { const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d); return `${p.find((x) => x.type === "hour")?.value}:${p.find((x) => x.type === "minute")?.value}`; };

// ═══════════════════════════════════════════════════════════════════════════
// A. REGELN OHNE DATENBANK
// ═══════════════════════════════════════════════════════════════════════════
console.log("── A. Regeln ohne Datenbank ─────────────────────────────────────────");
{
  // A1 Uhrzeiten in beide Richtungen (Fall K.)
  const t20 = "Genau, Florentine ruft Sie morgen um 20 Uhr an.";
  ok(wa.handlungsPruefung(t20, [], "Ja morgen Abend um 20 Uhr habe ich einen Termin\nDer Termin steht").length === 0, "Fall K.: „20 Uhr“ des Kunden ist bekannt → „morgen um 20 Uhr“ geht durch");
  ok(wa.handlungsPruefung(t20, [], "Ok", "TEAM: Der Termin heute um 20Uhr steht").length === 0, "„20Uhr“ der Kollegin ist bekannt");
  ok(wa.handlungsPruefung(t20, [], "Ich möchte wissen, ob ich morgen Abend angerufen werden kann", "", { termin: { uhrzeit: "20:00" } }).length === 0, "Termin im Kalender macht 20:00 wahr — auch ohne HH:MM im Verlauf");
  ok(wa.handlungsPruefung("Genau, Florentine ruft Sie morgen um 21 Uhr an.", [], "Ich möchte wissen, ob ich morgen Abend angerufen werden kann", "", { termin: { uhrzeit: "20:00" } }).some((f) => /21 Uhr/.test(f)), "Erfundene „21 Uhr“ fällt auf (Lücke der alten Prüfung: nur HH:MM)");
  ok(wa.handlungsPruefung("Ihr Termin steht: morgen um 20 Uhr mit Florentine.", [], "Ok", "", { termin: { uhrzeit: "20:00" } }).length === 0, "„Termin steht“ ist wahr, wenn er im Kalender steht (Protokoll 63)");
  ok(wa.handlungsPruefung("Ihr Termin steht morgen um 20 Uhr.", [], "Ok", "KUNDE: 20 Uhr").some((f) => /keinen Rückruf eingetragen/.test(f)), "… ohne Termin bleibt „steht“ eine erfundene Buchung");
  ok(wa.handlungsPruefung("Nikita ruft Sie morgen um 8 an.", [], "Hallo").some((f) => /8 Uhr/.test(f)), "„um 8“ zählt als Uhrzeit");
  ok(wa.handlungsPruefung("15 Uhr ist schon vergeben — Nikita ruft Sie morgen um 15:20 Uhr an.", [{ werkzeug: "rueckruf_eintragen", ok: true, zeiten: ["15:20"], abweichung: { wunsch: "15:00", gebucht: "15:20" } }], "morgen 15 00 uhr").length === 0, "#294: Wunsch 15 Uhr (abweichend gebucht) darf genannt werden");
  ok(wa.handlungsPruefung("FIAON Start gibt es ab 7,99 € im Monat, in 2–5 Werktagen.", [], "Was kostet das?").length === 0, "Preise und Werktage sind keine Uhrzeiten");
  // A2 Falscher Preisalarm (Befund 577)
  const r577 = "Gute Frage! Die 79,99 € sind die erste von zwölf Monatsraten für FIAON Ultra, damit fangen wir sofort an: Wir erklären Ihre Schufa-Einträge und übernehmen die Schreiben.";
  ok(wa.handlungsPruefung(r577, [], "Aber für was muss zahlen was macht diese Firma?").length === 0, "577: Paketrate 79,99 € im Satz mit „Schufa“ ist kein falscher Auskunft-Preis");
  ok(wa.handlungsPruefung("Die Bonitätsauskunft kostet 99 €.", [], "Was kostet die Auskunft?").length === 1, "… ein erfundener Auskunft-Preis fällt weiter auf");
  // A3 Reparieren
  const iso = wa.reparieren("Okay — Daniel bekommt Ihren Rückrufwunsch für 2026-09-25 18:50 und den Hinweis.", { jetzt: new Date("2026-09-25T14:00:00Z") });
  ok(!/2026-/.test(iso) && /heute um 18:50 Uhr/.test(iso), `ISO-Zeit wird menschlich: „${iso}“`);
  ok(/Samstag, 19\. September/.test(wa.reparieren("Der Link wurde am 2026-09-19 an Sie rausgegeben.")), "ISO-Datum wird „Samstag, 19. September“");
  const um = wa.reparieren("Das tut mir leid — der Rückruf um 2026-09-25 18:50 hat nicht geklappt.", { jetzt: new Date("2026-09-28T09:00:00Z") });
  ok(um === "Das tut mir leid — der Rückruf am Freitag, 25. September, um 18:50 Uhr hat nicht geklappt.", `„um <ISO>“ ohne doppelte Präposition: „${um}“`);
  ok(wa.reparieren("Gern 👍 *jetzt* starten: https://fiaon.com/a/Ab3dEf7hJk/w") === "Gern jetzt starten: https://fiaon.com/a/Ab3dEf7hJk/w", "Emoji und Sternchen raus, Link unverändert");
  ok(wa.reparieren("Transparent: Sie zahlen die erste Rate.") === "Sie zahlen die erste Rate.", "„Transparent:“ fällt weg");
  ok(wa.reparieren("Das Limit legt die Bank fest, Ihr Wunschlimit ist das Ziel.", { limit: true }) === "Der Rahmen legt die Bank fest, Ihr Wunschrahmen ist das Ziel.", "Limit → Rahmen (nur als letztes Mittel)");
  // A4 Link- und Tonprüfung
  const lage = { stufe: "zahlung_offen" as const, zahlungsReferenz: "FIAON-BSP4KX" };
  ok(wa.tonUndLink("Hier geht es weiter: https://fiaon.com/antrag", { linkLage: lage }).hart.length > 0, "Nackter /antrag ist hart (Nagelstudio)");
  ok(wa.tonUndLink("Ihre Zahlungsseite: https://fiaon.com/zahlung/FIAON-BSP4KX", { linkLage: lage }).hart.length === 0, "Seine Zahlungsseite geht durch");
  ok(wa.tonUndLink("Schreiben Sie an support@fiaon.com.", { linkLage: lage }).hart.length === 0, "support@fiaon.com ist kein nackter Link");
  ok(wa.tonUndLink("Sein Antrag: https://fiaon.com/a/Ab3dEf7hJk/w", { linkLage: { stufe: "zahlung_offen", zahlungsReferenz: "FIAON-BSP4KX" } }).weich.some((w) => /Zahlungsseite/.test(w)), "Antragslink, obwohl die Zahlung offen ist → neu schreiben");
  ok(wa.tonUndLink("Ihre Schufa muss nicht perfekt sein.", { land: "AT", kunde: "Ich wurde abgelehnt" }).hart.some((h) => /SCHUFA/i.test(h)), "Österreich: „Schufa“ ist hart");
  ok(wa.tonUndLink("Einen Kredit über 3.000 € vergeben wir nicht.", {}).weich.some((w) => /Noch besser/.test(w)), "Kredit-Nein → neu schreiben mit „Noch besser“");
  // A4b Verkaufsprüfung: Bestellwunsch ohne Link (#415), leises Rausreden (Wiedergabe mit dem echten Modell)
  const vp = (antwort: string, kunde: string) => wa.verkaufsPruefung(antwort, { kunde, letzteDu: [], verkaufen: true, link: "https://fiaon.com/a/Ab3dEf7hJk/w" });
  ok(vp("Sehr gern, Ihre Karte können Sie über den vorbereiteten Antrag bestellen. Was möchten Sie vorher wissen?", "Hallo ich möchte gerne diese Karte bestellen").some((h) => /Er will bestellen/.test(h)), "#415: „möchte diese Karte bestellen“ ohne Link → neu schreiben mit Link");
  ok(!vp("Sehr gern — hier geht es direkt los: https://fiaon.com/a/Ab3dEf7hJk/w", "Hallo ich möchte gerne diese Karte bestellen").some((h) => /Er will bestellen/.test(h)), "… mit Link ist gut");
  ok(vp("Verstehe ich — wenn Sie fest einen Ratenkredit suchen, passt eher der Kreditweg.", "Dann nützt mich das nichts").some((h) => /woanders/.test(h)), "„passt eher der Kreditweg“ ist Rausreden");
  // A5 Heikel (P30) und Aufgaben
  ok(!wa.heikelAnliegen("geht das jetzt darum das ich mein Konto bei meiner Bank kündigen soll"), "P30: „Konto bei meiner Bank kündigen“ ist nicht heikel");
  ok(wa.heikelAnliegen("Ich möchte meinen Vertrag kündigen"), "„meinen Vertrag kündigen“ ist heikel");
  ok(wa.heikelAnliegen("Ich widerrufe hiermit"), "Widerruf ist heikel");
  ok(wa.aufgabenKlasse("Bitte rufen Sie mich an") === "rueckruf" && !wa.aufgabeDringend("rueckruf", true) && wa.aufgabeDringend("rueckruf", false), "Rückruf: dringend nur ohne Termin");
  ok(!wa.aufgabeDringend("pruefung", false) && !wa.aufgabeDringend("anliegen", false), "Prüf-Ablehnung und Anliegen sind nie dringend");
  ok(wa.aufgabenKlasse("Ich habe gestern überwiesen") === "geld" && wa.aufgabeDringend("geld", true), "Geld ist dringend");
  // A6 Zahltag (#621)
  ok(!wa.zahltagEindeutig("2026-10-01", "Zahlen an 1"), "„Zahlen an 1“ ist kein Datum");
  ok(wa.zahltagEindeutig("2026-10-01", "Okay, kann zum 1.10.2026 bezahlen"), "„zum 1.10.2026“ ist eindeutig");
  ok(wa.zahltagEindeutig("2026-10-01", "Ja genau", "Gern — meinen Sie den 1. Oktober? Dann halte ich den Tag für Sie fest."), "„Ja genau“ auf „Meinen Sie den 1. Oktober?“ zählt");
  ok(wa.zahltagEindeutig("2026-09-30", "ich kann erst übermorgen zahlen"), "„übermorgen“ ist eindeutig");
  // A7 Wortwand: Fragen und „keinen Rückruf“ sind keine Zusage (P5/P7)
  const z = (t: string) => wandPruefen(t).filter((x) => x.art === "zusage").length;
  ok(z("Welche Zeit soll ich für den Rückruf eintragen?") === 0 && z("Ich trage keinen Rückruf ein.") === 0, "P5/P7: Frage und Verneinung lösen keine Zusage aus");
  ok(z("Ihr Rückruf ist notiert.") === 1, "… eine echte Rückruf-Aussage bleibt Zusage");
  // A8 Schweigen — die zwölf Musterdialoge aus der gemeinsamen Quelle, dazu die echten Grenzfälle
  let id = 1;
  const zeile = (von: "kunde" | "mara" | "team" | "vorlage", text: string, am: number) => ({
    id: id++, richtung: von === "kunde" ? "rein" : "raus", text, vorlage: von === "vorlage" ? "fiaon_kkb_test" : null,
    von: von === "mara" ? "Mara Lindner" : von === "team" ? "Florentine Prüf" : von === "vorlage" ? "Mara" : null, am: new Date(am),
  });
  const jetzt = Date.now();
  const morgen20Iso = () => { const d = new Date(); d.setUTCDate(d.getUTCDate() + 1); d.setUTCHours(18, 0, 0, 0); return d.toISOString(); };
  for (const d of ton.MUSTERDIALOGE.filter((x) => x.kanal === "whatsapp")) {
    id = 1;
    const zeilen = d.verlauf.map((m, i) => zeile(m.von, m.text, jetzt - (d.verlauf.length - i) * 60_000));
    // Die Autoantwort kam 13 s nach der Vorlage (echter Fall); sonst 40 s.
    const letzte = zeile("kunde", d.kunde, (zeilen[zeilen.length - 1] ? (zeilen[zeilen.length - 1].am as Date).getTime() : jetzt - 60_000) + (d.id === "autoantwort_nagelstudio" ? 13_000 : 40_000));
    const u = sw.schweigen({ verlauf: [...zeilen, letzte], offeneIds: [letzte.id], istRueckfall: wa.istRueckfall });
    ok(u.art === d.soll.art, `Musterdialog ${d.id}: ${d.soll.art} (Urteil: ${u.art} — ${u.grund})`);
  }
  id = 1;
  const nachFrage = sw.schweigen({ verlauf: [zeile("mara", "Soll ich Ihnen den Antrag schicken?", jetzt - 60_000), zeile("kunde", "Ok", jetzt - 10_000)], offeneIds: [2] });
  ok(nachFrage.art === "antworten", "„Ok“ auf Maras Frage ist Zustimmung → antworten");
  id = 1;
  const ja = sw.schweigen({ verlauf: [zeile("mara", "Nikita bekommt Bescheid, dass Sie nicht weitermachen möchten.", jetzt - 60_000), zeile("kunde", "Ja dass stimmt", jetzt - 10_000)], offeneIds: [2] });
  ok(ja.art === "abschluss", "„Ja dass stimmt“ nach Maras Aussage → ein Abschluss (Chat B)");
  id = 1;
  const nurJa = sw.schweigen({ verlauf: [zeile("mara", "Ihr Antrag ist vorbereitet: https://fiaon.com/a/Ab3dEf7hJk/w", jetzt - 60_000), zeile("kunde", "Ja", jetzt - 10_000)], offeneIds: [2] });
  ok(nurJa.art === "antworten", "Ein bloßes „Ja“ ist keine Bestätigung zum Schweigen");
  id = 1;
  const kredit = sw.schweigen({ verlauf: [zeile("vorlage", "Ihr Antrag ist vorbereitet.", jetzt - 3_600_000), zeile("kunde", "Vielen Dank für Ihre Nachricht, ich melde mich später", jetzt - 10_000)], offeneIds: [2] });
  ok(kredit.art === "antworten", "Ein Mensch, der nur „danke … melde mich später“ schreibt (1 h nach der Vorlage), ist keine Autoantwort");
  id = 1;
  const oeffnung = sw.schweigen({ verlauf: [zeile("vorlage", "Ihr Antrag ist vorbereitet.", jetzt - 20_000), zeile("kunde", "Was sind Ihre Öffnungszeiten?", jetzt - 10_000)], offeneIds: [2] });
  ok(oeffnung.art === "antworten" && !oeffnung.autoIds.length, "„Was sind Ihre Öffnungszeiten?“ ist ein Mensch, keine Autoantwort");
  id = 1;
  const doppelt = sw.schweigen({ verlauf: [zeile("kunde", "Wie kann ich bestellen?", jetzt - 120_000), zeile("mara", "Hier ist Ihr Antrag: https://fiaon.com/a/Ab3dEf7hJk/w", jetzt - 100_000), zeile("kunde", "Wie kann ich bestellen?", jetzt - 10_000)], offeneIds: [3] });
  ok(doppelt.art === "schweigen" && doppelt.still === "doppelt", "Dieselbe Frage noch einmal, gerade beantwortet → schweigen");
  id = 1;
  const kreuz = sw.schweigen({ verlauf: [zeile("kunde", "ich möchte diese Karte bestellen", jetzt - 30_000), zeile("mara", "Sehr gern — hier ist Ihr Antrag: https://fiaon.com/a/Ab3dEf7hJk/w", jetzt - 15_000), zeile("kunde", "Wie kann man bestellen", jetzt - 14_300)], offeneIds: [3] });
  ok(kreuz.art === "antworten" && kreuz.hinweise.some((h) => /ÜBERKREUZT/.test(h)), "#417/#419: überkreuzt → Hinweis an das Modell");
  // A8b Nachbesserung E-248 — kein Mensch wird als Autoantwort verschluckt (Gegenprobe auto.mts)
  for (const t of [
    "Ich möchte bitte mit jemandem sprechen.",
    "Ich bin Geschäftsführer einer GmbH und brauche eine Firmenkarte",
    "Bin gerade nicht erreichbar, bitte morgen um 10 anrufen",
    "Ich bin im Urlaub bis 5.10., dann gern",
    "Ich bin derzeit nicht erreichbar, bitte rufen Sie mich morgen um 10 Uhr an.",
    "Wir sind gerade im Urlaub, können Sie uns nach dem 10. anrufen?",
    "Ich bin zurzeit im Urlaub. Ab Montag habe ich Zeit, bitte Termin eintragen.",
    "Vielen Dank für Ihre Nachricht an mich. Ich möchte den Antrag jetzt abschließen.",
  ]) {
    ok(!ton.istAutoantwort(t, { sekundenNachUnserer: 13 }), `Mensch, keine Autoantwort (auch 13 s nach uns): „${t}“`);
    id = 1;
    const u = sw.schweigen({ verlauf: [zeile("mara", "Wann passt Ihnen ein kurzes Gespräch?", jetzt - 60_000), zeile("kunde", t, jetzt - 10_000)], offeneIds: [2] });
    ok(u.art === "antworten" && !u.autoIds.length, `… und Mara antwortet (${u.art}): „${t.slice(0, 40)}“`);
  }
  // Die Kollegin hat GEFRAGT → „Ok passt“ ist ihre Antwort: nicht still, sie bekommt Bescheid (Gegenprobe team.mts).
  for (const vorH of [1, 16]) {
    id = 1;
    const u = sw.schweigen({ verlauf: [zeile("team", "Soll ich Sie morgen um 10 Uhr anrufen?", jetzt - vorH * 3_600_000), zeile("kunde", "Ok passt", jetzt - 10_000)], offeneIds: [2] });
    ok(u.art === "weitergeben" && !!u.anTeam, `Team-Frage vor ${vorH} h, Kunde „Ok passt“ → weitergeben, nicht still (${u.art})`);
  }
  id = 1;
  const teamOhneFrage = sw.schweigen({ verlauf: [zeile("team", "Der Termin heute um 20 Uhr steht.", jetzt - 3_600_000), zeile("kunde", "Ok danke", jetzt - 10_000)], offeneIds: [2] });
  ok(teamOhneFrage.art === "schweigen", "Team-Aussage ohne Frage, „Ok danke“ → Mara schweigt weiter (die Kollegin führt)");
  // Der sichere Satz kennt heikle Anliegen (Gegenprobe sicher.mts)
  const zl = "https://fiaon.com/zahlung/FIAON-BSP4KX";
  ok(wa.sichererSatz({ kunde: "Ich kann nicht zahlen, bitte alles stornieren", aktionen: [], link: zl, stufe: "zahlung_offen" }) === null, "„kann nicht zahlen, bitte stornieren“ → kein Zahlungssatz");
  ok(wa.sichererSatz({ kunde: "Ich will widerrufen, wie geht das?", aktionen: [], link: zl, stufe: "zahlung_offen" }) === null, "„widerrufen, wie geht das?“ → kein Zahlungssatz");
  ok(wa.sichererSatz({ kunde: "Heute um 20 Uhr kann ich nicht, bitte absagen", aktionen: [], termin: { beginn: morgen20Iso(), vorname: "Florentine" } }) === null, "„bitte absagen“ → kein „Genau, Florentine ruft Sie an“");
  ok(wa.sichererSatz({ kunde: "Können wir den Termin auf morgen 18 Uhr verschieben?", aktionen: [], termin: { beginn: morgen20Iso(), vorname: "Florentine" } }) === null, "„verschieben?“ → kein alter Terminsatz");
  ok(wa.sichererSatz({ kunde: "Warum soll ich vorher zahlen? Wo ist der Link?", aktionen: [], link: zl, stufe: "zahlung_offen" }) === null, "Einwand gegen die Zahlung → kein fester Zahlungssatz");
  // Zahlungsruhe auf WhatsApp (hart)
  ok(wa.handlungsPruefung(`Hier ist Ihre Zahlungsseite: ${zl}`, [], "Ich kann nicht zahlen, bitte alles stornieren", "", { links: [zl] }).some((f) => /keine Zahlungsseite/.test(f)), "Zahlungsseite auf „kann nicht zahlen / stornieren“ → harter Mangel");
  ok(wa.handlungsPruefung(`Hier ist Ihre Zahlungsseite: ${zl}`, [], "Wo kann ich bezahlen?", "", { links: [zl] }).length === 0, "Zahlungsseite auf „Wo kann ich bezahlen?“ bleibt erlaubt");
  // Auskunft-Preisprüfung: „Rahmen bis 10.000 €“ ist kein Auskunft-Preis (Probelauf M109)
  ok(wa.handlungsPruefung("Genau dafür sind wir da: ein Rahmen bis 10.000 € ist Ihr Ziel, und Ihre Schufa muss nicht perfekt sein.", [], "Ich will 10.000 € ohne Schufa, nur Ausweis", "").length === 0, "M109: „Rahmen bis 10.000 €“ im Schufa-Satz ist kein falscher Auskunft-Preis");
  ok(wa.handlungsPruefung("Ihre Bonitätsauskunft kostet 99 €.", [], "Was kostet die Auskunft?", "").some((f) => /für die Auskunft stimmt nicht/.test(f)), "Ein erfundener Auskunft-Preis (99 €) fällt weiter auf");
  // Abweichung mit Grund — „vergeben“ nur, wenn belegt (Probelauf #15)
  ok(/So kurzfristig klappt 12:25 Uhr leider nicht — Nikita ruft Sie heute um 12:40 Uhr an\./.test(ton.abweichungsSatz({ wunsch: "12:25 Uhr", grund: "vorlauf" }, "Nikita", "heute um 12:40 Uhr")), "Vorlauf: „So kurzfristig klappt …“ statt „vergeben“");
  ok(/schon vergeben/.test(ton.abweichungsSatz({ wunsch: "15 Uhr", grund: "belegt" }, "Nikita", "morgen um 15:20 Uhr")), "Belegt: „schon vergeben“");
  ok(!/vergeben/.test(ton.abweichungsSatz({ wunsch: "15 Uhr", grund: "raster" }, "Nikita", "morgen um 15:10 Uhr")), "Raster: nie „vergeben“");
  ok(wa.kannNichtZahlen("Ich kann diesen Monat leider nicht zahlen") && !wa.kannNichtZahlen("Ich kann erst am 15. zahlen"), "„kann nicht zahlen“ erkannt, „kann erst am 15. zahlen“ nicht");
  // Ungefragtes Storno-Angebot (Probelauf #31)
  ok(wa.verkaufsPruefung("Das verstehe ich. Wenn Sie die Bestellung stornieren möchten, schreiben Sie mir einfach.", { kunde: "Ich zahle nicht im Voraus", letzteDu: [], verkaufen: true }).some((h) => /Storno oder Kündigung an/.test(h)), "#31: Storno-Angebot ohne Anlass → neu schreiben");

  // A9 Abschluss, sicherer Satz, Rückfallsatz
  const morgen20 = new Date(); morgen20.setUTCDate(morgen20.getUTCDate() + 1); morgen20.setUTCHours(18, 0, 0, 0);
  ok(/^Gern, dann bis morgen um \d+(:\d\d)? Uhr!$/.test(sw.abschlussSatz({ termin: { beginn: morgen20 } })), `Abschluss mit Termin: „${sw.abschlussSatz({ termin: { beginn: morgen20 } })}“`);
  ok(sw.abschlussSatz({ kunde: "Oky Dankeschön schönen abend" }) === "Danke, Ihnen auch einen schönen Abend!", "Abschluss spiegelt „schönen Abend“");
  const sicher = wa.sichererSatz({ kunde: "Ich möchte wissen, ob ich morgen Abend angerufen werden kann", aktionen: [], termin: { beginn: morgen20.toISOString(), vorname: "Florentine" } });
  ok(!!sicher && /^Genau, Florentine ruft Sie morgen um/.test(sicher) && !sendePruefung(sicher!).length, `Sicherer Satz aus dem Kalender: „${sicher}“`);
  ok(wa.sichererSatz({ kunde: "Was macht diese Firma?", aktionen: [], termin: null, link: "https://fiaon.com/zahlung/FIAON-BSP4KX", stufe: "zahlung_offen" }) === null, "Kein sicherer Satz, wo die Lage nichts Wahres hergibt");
  ok(/zahlung\/FIAON-BSP4KX/.test(String(wa.sichererSatz({ kunde: "Wie kann ich bezahlen?", aktionen: [], link: "https://fiaon.com/zahlung/FIAON-BSP4KX", stufe: "zahlung_offen" }))), "Wie-zahle-ich → seine Zahlungsseite");
  const rf = wa.rueckfallSatz("Florentine");
  ok(wa.istRueckfall(rf) && !sendePruefung(rf).length && !ton.tonPruefung(rf, { kanal: "whatsapp" }).some((f) => f.schwere === "hart") && !/ganz genau beantworten|liegt schon bei/.test(rf), `Neuer Rückfallsatz ist menschlich und besteht die Wand: „${rf}“`);
  ok(wa.istRueckfall("Das möchte ich Ihnen ganz genau beantworten. Ich gebe …") && wa.istRueckfall("Ihre Nachricht ist angekommen und liegt schon bei Florentine"), "Alte Rückfallsätze werden im Verlauf weiter erkannt");
  // A10 Der Auftrag
  const auftrag = wa.maraAuftrag({ name: "Mara Lindner", wer: "Kunde P, sein fester Betreuer ist Florentine Prüf.", lage: "Antrag angefangen.", ziel: "Er macht seinen Antrag fertig.",
    link: "https://fiaon.com/a/Ab3dEf7hJk/w", verkaufen: true, gedaechtnis: "", verlauf: "KUNDE (Mo 10:00): Hallo", wissen: wa.wissenFuerWhatsApp(), hausanweisung: "",
    werkzeuge: true, betreuer: "Florentine", jetzt: "Montag, 28.09.2026, 10:00", auskunft: null, stand: ["Sein Termin: morgen um 20 Uhr — Florentine ruft ihn an."], land: "AT" });
  ok(/DEIN LINK: https:\/\/fiaon\.com\/a\/Ab3dEf7hJk\/w/.test(auftrag), "Auftrag: DEIN LINK ist der persönliche");
  ok(!/Einen Kredit gibt es bei uns nicht|Kredite gibt es bei uns nicht/.test(auftrag) && /Noch besser: Wir bringen Sie zu Ihrer eigenen Kreditkarte/.test(auftrag), "Auftrag: Kredit-Beispiel positiv („Noch besser“), kein Nein");
  ok(!/ein „ok“/.test(auftrag), "Auftrag: kein „antworte auch auf ein ok“ mehr");
  ok(!/das Limit legt am Ende|über Karte und Limit entscheidet|Ihr Limit steht|Über Karte und Limit/.test(auftrag), "Auftrag: kein „Limit“ in Maras Beispielsätzen (nur in der Liste der verbotenen Sätze)");
  ok(/STAND DES GESPRÄCHS/.test(auftrag) && /Sein Termin: morgen um 20 Uhr/.test(auftrag), "Auftrag: STAND DES GESPRÄCHS mit Termin");
  ok(!/Ihre Schufa muss nicht perfekt sein/.test(auftrag) && /Ihre Bonität muss nicht perfekt sein/.test(auftrag), "Auftrag (AT): Beispiele ohne „Schufa“");
  ok(!/fiaon\.com\/antrag\b(?!,| ohne| oder)/.test(auftrag.replace(/Nie fiaon\.com\/antrag[^\n]*/g, "").replace(/nie fiaon\.com\/antrag[^\n]*/gi, "")), "Auftrag: fiaon.com/antrag kommt nur als Verbot vor");
  ok(/YYYY-MM-DD HH:MM" an — dem Kunden schreibst du sie NIE so/.test(auftrag), "Auftrag: Werkzeugformat nie an den Kunden");
}

// ═══════════════════════════════════════════════════════════════════════════
// B./C. WIEDERGABE ECHTER GESPRÄCHE
// ═══════════════════════════════════════════════════════════════════════════
const ORDNER = new URL("../.pruef/mara-wiedergabe/", import.meta.url);
interface Zug { id: number; richtung: string; text: string | null; typ?: string | null; vorlage?: string | null; von?: string | null; knopf?: string | null; am: string }
interface Schritt { id: string; bis: number; soll: "antworten" | "schweigen" | "abschluss"; titel: string; attrappe?: Plan; belegt?: string; pruef?: Record<string, any> }
interface Fall {
  id: string; titel: string; quelle: string; nummer: string;
  person: { land: string | null; betreuer: string | null } | null;
  lead: { link_code: string | null; quelle: string } | null;
  antrag: { status: string; payment_status: string; schritt: number; paket: string | null } | null;
  termine: { beginn: string; status: string; herkunft: string; quelle: string; agent: string; angelegt: string }[];
  verlauf: Zug[]; schritte: Schritt[];
}
const faelle: Fall[] = existsSync(ORDNER)
  ? readdirSync(ORDNER).filter((f) => f.endsWith(".json")).sort().map((f) => JSON.parse(readFileSync(new URL(f, ORDNER), "utf8")) as Fall)
    .filter((f) => !NUR || f.id.includes(NUR))
  : [];
if (!faelle.length) console.log(`\n(keine Fälle unter .pruef/mara-wiedergabe/ — Herkunft: .pruef/e248-wiedergabe-export/LIESMICH.txt; Teil B übersprungen)`);

const START = new Date();
const EINSTELLUNGEN = ["ki_pause", "mara_wa_an", "mara_wa_tag_euro"];
const einstellungVorher = (await sql`SELECT key, value FROM fiaon_settings WHERE key = ANY(${EINSTELLUNGEN})`.catch(() => [])) as any[];
const AGENTEN: Record<string, number> = {};
const PERSONEN: number[] = [];
const LEADS: number[] = [];
const REFS: string[] = [];
const NUMMERN: string[] = [];
const ALT_NEU: { fall: string; schritt: string; kunde: string; alt: string; neu: string }[] = [];

async function agent(vorname: string): Promise<number> {
  if (AGENTEN[vorname]) return AGENTEN[vorname];
  const mail = `pruef248-${vorname.toLowerCase().replace(/[^a-z]/g, "")}@fiaon.invalid`;
  await sql`DELETE FROM fiaon_agents WHERE email = ${mail}`.catch(() => {});
  const [a] = (await sql`INSERT INTO fiaon_agents (name, first_name, email, active, rolle) VALUES (${`${vorname} Prüf`}, ${vorname}, ${mail}, TRUE, 'agent') RETURNING id`) as any[];
  for (let wt = 1; wt <= 7; wt++) await sql`INSERT INTO fiaon_agent_verfuegbarkeit (agent_id, wochentag, von, bis, aktiv) VALUES (${a.id}, ${wt}, '07:00', '22:00', TRUE)`;
  AGENTEN[vorname] = Number(a.id);
  return AGENTEN[vorname];
}

async function aufraeumen(): Promise<void> {
  for (const n of NUMMERN) {
    await sql`DELETE FROM fiaon_whatsapp WHERE nummer = ${n}`.catch(() => {});
    await sql`DELETE FROM fiaon_whatsapp_gespraech WHERE nummer = ${n}`.catch(() => {});
    await sql`DELETE FROM fiaon_mara_protokoll WHERE nummer = ${n}`.catch(() => {});
  }
  if (PERSONEN.length) {
    await sql`DELETE FROM fiaon_betreiber_todos WHERE id IN (SELECT id FROM fiaon_betreiber_todos WHERE schluessel ~ ${`^wa-(${PERSONEN.join("|")})-`} OR schluessel LIKE 'wa-n4915900248%')`.catch(() => {});
    await sql`DELETE FROM fiaon_termine WHERE person_id = ANY(${PERSONEN})`.catch(() => {});
    await sql`DELETE FROM fiaon_contact_log WHERE person_id = ANY(${PERSONEN})`.catch(() => {});
    await sql`DELETE FROM fiaon_kurzlinks WHERE person_id = ANY(${PERSONEN}) OR lead_id = ANY(${LEADS.length ? LEADS : [0]})`.catch(() => {});
    await sql`DELETE FROM fiaon_applications WHERE ref = ANY(${REFS})`.catch(() => {});
    await sql`DELETE FROM fiaon_leads WHERE id = ANY(${LEADS.length ? LEADS : [0]})`.catch(() => {});
    await sql`DELETE FROM fiaon_mara_gedaechtnis WHERE person_id = ANY(${PERSONEN})`.catch(() => {});
    await sql`DELETE FROM fiaon_persons WHERE id = ANY(${PERSONEN})`.catch(() => {});
  }
  const ids = Object.values(AGENTEN);
  if (ids.length) {
    await sql`DELETE FROM fiaon_termine WHERE agent_id = ANY(${ids})`.catch(() => {});
    await sql`DELETE FROM fiaon_agent_verfuegbarkeit WHERE agent_id = ANY(${ids})`.catch(() => {});
    await sql`DELETE FROM fiaon_agents WHERE id = ANY(${ids})`.catch(() => {});
  }
}

try {
  if (faelle.length) {
    await sql`DELETE FROM fiaon_settings WHERE key = ANY(${EINSTELLUNGEN})`;
    await sql`INSERT INTO fiaon_settings (key, value) VALUES ('mara_wa_an', 'an')`;
    kp.kiPauseZwischenspeicherLeeren();
  }
  for (const fall of faelle) {
    console.log(`\n── ${KI ? "C" : "B"}. ${fall.id}: ${fall.titel}`);
    console.log(`   Quelle: ${fall.quelle}`);
    NUMMERN.push(fall.nummer);
    // ── Einmal je Fall: Person, Lead, Antrag ────────────────────────────────
    let personId: number | null = null, leadId: number | null = null;
    const ref = `FIAON-P248${fall.id.slice(0, 6).toUpperCase().replace(/[^A-Z]/g, "X")}`;
    const zahlRef = `FIAON-P248Z${String(REFS.length).padStart(2, "0")}`;
    if (fall.person) {
      const betreuerId = fall.person.betreuer ? await agent(fall.person.betreuer) : null;
      await sql`DELETE FROM fiaon_persons WHERE person_ref = ${`PRUEF248-${fall.id}`}`.catch(() => {});
      const [p] = (await sql`INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_email, country, assigned_agent_id)
        VALUES (${`PRUEF248-${fall.id}`}, 'Prüf', ${fall.id}, ${`pruef248-${fall.id}@kunde.invalid`}, ${fall.person.land}, ${betreuerId}) RETURNING id`) as any[];
      personId = Number(p.id);
      PERSONEN.push(personId);
    }
    if (fall.lead) {
      const code = fall.lead.link_code ? `P248${fall.id.replace(/[^a-zA-Z]/g, "").slice(0, 6)}`.padEnd(10, "x").slice(0, 10) : null;
      const [l] = (await sql`INSERT INTO fiaon_leads (person_id, quelle, link_code, vorname, nachname) VALUES (${personId}, ${fall.lead.quelle}, ${code}, 'Prüf', ${fall.id}) RETURNING id`) as any[];
      leadId = Number(l.id);
      LEADS.push(leadId);
    }
    if (fall.antrag && personId) {
      REFS.push(ref);
      await sql`DELETE FROM fiaon_applications WHERE ref = ${ref}`.catch(() => {});
      await sql`INSERT INTO fiaon_applications (ref, payment_reference, person_id, status, payment_status, current_step, pack_key, ist_entwurf, agb_stand)
        VALUES (${ref}, ${zahlRef}, ${personId}, ${fall.antrag.status}, ${fall.antrag.payment_status}, ${fall.antrag.schritt}, ${fall.antrag.paket}, FALSE, '2026-09-03')`;
    }
    const todosVorher = personId ? Number(((await sql`SELECT COUNT(*)::int AS n FROM fiaon_betreiber_todos WHERE schluessel LIKE ${`wa-${personId}-%`}`) as any[])[0].n) : 0;

    for (const schritt of fall.schritte) {
      // ── Je Schritt: der echte Verlauf bis zu seiner Nachricht, verschoben auf „jetzt" ──
      const ziel = fall.verlauf.find((z) => z.id === schritt.bis);
      if (!ziel) { ok(false, `${schritt.id}: Nachricht ${schritt.bis} fehlt im Fall`); continue; }
      const jetzt = Date.now();
      const shift = jetzt - 20_000 - new Date(ziel.am).getTime();
      await sql`DELETE FROM fiaon_whatsapp WHERE nummer = ${fall.nummer}`;
      await sql`DELETE FROM fiaon_whatsapp_gespraech WHERE nummer = ${fall.nummer}`.catch(() => {});
      if (personId) {
        await sql`DELETE FROM fiaon_termine WHERE person_id = ${personId}`;
        await sql`UPDATE fiaon_persons SET promised_payment_date = NULL WHERE id = ${personId}`;
      }
      const idKarte = new Map<number, number>();
      for (const z of fall.verlauf.filter((x) => x.id <= schritt.bis)) {
        const am = new Date(new Date(z.am).getTime() + shift);
        const [r] = (await sql`
          INSERT INTO fiaon_whatsapp (richtung, nummer, typ, text, status, vorlage, von, knopf, person_id, lead_id, empfangen_am, gesendet_am, created_at)
          VALUES (${z.richtung}, ${fall.nummer}, ${z.typ ?? "text"}, ${z.text}, ${z.richtung === "rein" ? "empfangen" : "read"}, ${z.vorlage ?? null}, ${z.von ?? null}, ${z.knopf ?? null},
                  ${personId}, ${leadId}, ${z.richtung === "rein" ? am : null}, ${z.richtung === "raus" ? am : null}, ${am})
          RETURNING id`) as any[];
        idKarte.set(z.id, Number(r.id));
      }
      // Termine, die zu diesem Zeitpunkt schon angelegt waren — gleich weit verschoben.
      let terminBeginn: Date | null = null;
      for (const t of fall.termine) {
        if (new Date(t.angelegt).getTime() > new Date(ziel.am).getTime()) continue;
        const beginn = new Date(new Date(t.beginn).getTime() + shift);
        await sql`INSERT INTO fiaon_termine (person_id, agent_id, beginn, status, quelle, herkunft, storno_token)
          VALUES (${personId}, ${await agent(t.agent)}, ${beginn}, ${t.status}, ${t.quelle}, ${t.herkunft}, ${`p248-${fall.id}-${schritt.id}`})`;
        if (t.status === "gebucht") terminBeginn = beginn;
      }
      // „belegt": ein fremder Termin blockiert die Wunschzeit (Fall 15:00 → 15:20).
      let fremdePerson: number | null = null;
      if (schritt.belegt && fall.person?.betreuer) {
        const morgen = berlinIso(new Date(jetzt + 86_400_000));
        const { parseBerlinInput } = await import("../server/lib/fiaon-time");
        const [fp] = (await sql`INSERT INTO fiaon_persons (person_ref, first_name, last_name) VALUES (${`PRUEF248-belegt-${schritt.id}`}, 'Prüf', 'belegt') RETURNING id`) as any[];
        fremdePerson = Number(fp.id);
        PERSONEN.push(fremdePerson);
        await sql`INSERT INTO fiaon_termine (person_id, agent_id, beginn, status, quelle, herkunft) VALUES (${fremdePerson}, ${await agent(fall.person.betreuer)}, ${parseBerlinInput(`${morgen} 15:00`)}, 'gebucht', 'agent_manuell', 'agent')`;
      }
      // Platzhalter für die Attrappe und die Prüfungen
      const lageJetzt = await wa.maraLage(personId, leadId, null).catch(() => null);
      const falsch = terminBeginn ? new Date(terminBeginn.getTime() + 67 * 60_000) : null;
      const naechsterErster = (() => { const d = new Date(jetzt); const j = Number(berlinIso(d).slice(0, 4)), m = Number(berlinIso(d).slice(5, 7)); const nm = m === 12 ? 1 : m + 1; const nj = m === 12 ? j + 1 : j; return `${nj}-${String(nm).padStart(2, "0")}-01`; })();
      const platz: Record<string, string> = {
        LINK: lageJetzt?.link ?? "",
        BETREUER: fall.person?.betreuer ?? "jemand aus unserem Team",
        TERMIN_SATZ: terminBeginn ? `${fall.termine[0]?.agent ?? "Florentine"} ruft Sie ${ton.zeitFuerKunde(terminBeginn)} an.` : "",
        TERMIN_UHR: terminBeginn ? ton.uhrText(Number(hhmm(terminBeginn).slice(0, 2)), Number(hhmm(terminBeginn).slice(3))) : "",
        FALSCH_TEXT: falsch ? ton.zeitFuerKunde(falsch) : "",
        FALSCH_UHR: falsch ? hhmm(falsch) : "",
        NAECHSTER_ERSTER: naechsterErster,
        NAECHSTER_ERSTER_TEXT: ton.datumFuerKunde(new Date(`${naechsterErster}T12:00:00Z`)).replace(/^\w+,\s*/, ""),
        MORGEN: berlinIso(new Date(jetzt + 86_400_000)),
      };
      ersetzen = (t, extra = {}) => String(t).replace(/\{([A-Z_]+)\}/g, (m, k) => (k in extra ? extra[k] : k in platz ? platz[k] : m));
      plan = schritt.attrappe ?? null;
      const aufrufeVorher = OPENAI.length;
      const todosSchrittVorher = personId ? Number(((await sql`SELECT COUNT(*)::int AS n FROM fiaon_betreiber_todos WHERE schluessel LIKE ${`wa-${personId}-%`}`) as any[])[0].n) : 0;
      const protVorher = new Date();

      const erg = await wa.maraAntwortet(fall.nummer);

      const [g] = (await sql`SELECT antwort_text, still_bis_id FROM fiaon_whatsapp_gespraech WHERE nummer = ${fall.nummer}`.catch(() => [])) as any[];
      await sql`UPDATE fiaon_whatsapp_gespraech SET antwort_text = NULL, antwort_faellig_am = NULL WHERE nummer = ${fall.nummer}`.catch(() => {});
      const antwort = String(g?.antwort_text ?? "");
      const prot = (await sql`SELECT art, text FROM fiaon_mara_protokoll WHERE nummer = ${fall.nummer} AND am >= ${protVorher} ORDER BY id`.catch(() => [])) as any[];
      const aufrufe = OPENAI.slice(aufrufeVorher);
      const todosNach = personId ? Number(((await sql`SELECT COUNT(*)::int AS n FROM fiaon_betreiber_todos WHERE schluessel LIKE ${`wa-${personId}-%`}`) as any[])[0].n) : 0;
      const neueAufgaben = todosNach - todosSchrittVorher;
      const art = antwort ? (prot.some((p) => p.art === "abschluss") ? "abschluss" : "antworten") : "schweigen";
      const kundeText = fall.verlauf.filter((z) => z.id <= schritt.bis && z.richtung === "rein").slice(-2).map((z) => z.text).join(" / ");
      const alt = fall.verlauf.find((z) => z.id > schritt.bis && z.richtung === "raus" && !z.vorlage && /^mara/i.test(String(z.von ?? "")))?.text ?? "(nichts)";
      ALT_NEU.push({ fall: fall.id, schritt: schritt.id, kunde: kundeText, alt: String(alt), neu: antwort || `(schweigt — ${erg.grund})` });

      console.log(`   ${schritt.id} ${schritt.titel.replace(/\{([A-Z_]+)\}/g, (m, k) => platz[k] ?? m)}`);
      console.log(`      Kunde: „${kundeText.slice(0, 140)}“`);
      console.log(`      ALT:   „${String(alt).replace(/\s+/g, " ").slice(0, 200)}“`);
      console.log(`      NEU:   ${antwort ? `„${antwort.replace(/\s+/g, " ").slice(0, 240)}“` : `(schweigt — ${erg.grund})`}`);
      if (KI) {
        // Mit dem echten Modell: nur die harten Regeln — der Wortlaut ist Justins Urteil.
        if (schritt.soll === "schweigen") ok(!antwort, `${schritt.id}: schweigt`);
        else if (antwort) {
          ok(!/\b20\d{2}-\d{2}-\d{2}\b/.test(antwort), `${schritt.id}: kein ISO-Datum`);
          ok(!ton.linkPruefung(antwort).some((f) => f.art === "nackt"), `${schritt.id}: kein nackter Link`);
          ok(!wa.istRueckfall(antwort), `${schritt.id}: kein Rückfallsatz`);
        } else ok(false, `${schritt.id}: hätte ${schritt.soll} sollen — ${erg.grund}`);
        continue;
      }
      // ── Prüfungen mit der Attrappe ──────────────────────────────────────
      const pr = schritt.pruef ?? {};
      ok(art === schritt.soll, `${schritt.id}: ${schritt.soll} (ist: ${art}${art === "schweigen" ? ` — ${erg.grund}` : ""})`);
      if (schritt.soll === "schweigen") {
        ok(Number(g?.still_bis_id ?? 0) >= Number(idKarte.get(schritt.bis) ?? Infinity), `${schritt.id}: still_bis_id gesetzt — der Takt stößt nicht neu an`);
        ok(prot.some((p) => p.art === "still"), `${schritt.id}: im Protokoll als „still“`);
        const [offen] = (await sql.unsafe(`${wa.OFFENE_GESPRAECHE_SQL} AND r.nummer = '${fall.nummer}'`)) as any[];
        ok(!offen, `${schritt.id}: gilt nicht mehr als offenes Gespräch`);
      } else if (antwort) {
        ok(!/\b20\d{2}-\d{2}-\d{2}\b/.test(antwort), `${schritt.id}: kein ISO-Datum`);
        ok(!ton.linkPruefung(antwort.replace(/[\w.+-]+@fiaon\.com/g, "")).some((f) => f.art === "nackt"), `${schritt.id}: kein nackter fiaon.com-Link`);
        ok(!ton.tonPruefung(antwort, { kanal: "whatsapp", land: (fall.person?.land as any) ?? null }).some((f) => f.schwere === "hart"), `${schritt.id}: Tonprüfung ohne harten Treffer`);
        if (!pr.sicher) ok(!wa.istRueckfall(antwort), `${schritt.id}: kein Rückfallsatz`);
      }
      for (const e of pr.enthaelt ?? []) {
        if (e === "{TERMIN_UHR}") ok(terminBeginn && ton.uhrzeitenIn(antwort).includes(hhmm(terminBeginn)), `${schritt.id}: nennt die Termin-Uhrzeit ${platz.TERMIN_UHR}`);
        else ok(antwort.includes(ersetzen(e)), `${schritt.id}: enthält „${ersetzen(e).slice(0, 60)}“`);
      }
      for (const e of pr.nicht_enthaelt ?? []) {
        if (e === "{FALSCH_UHR}") ok(!ton.uhrzeitenIn(antwort).includes(platz.FALSCH_UHR), `${schritt.id}: nicht die erfundene ${platz.FALSCH_UHR}`);
        else ok(!antwort.includes(ersetzen(e)), `${schritt.id}: ohne „${ersetzen(e)}“`);
      }
      if (pr.aufgaben_max != null) ok(neueAufgaben <= pr.aufgaben_max, `${schritt.id}: höchstens ${pr.aufgaben_max} neue Aufgabe(n) (${neueAufgaben})`);
      if (pr.auto) {
        const ids = (pr.auto as number[]).map((x) => idKarte.get(x) ?? -1);
        const marken = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_whatsapp WHERE id = ANY(${ids}) AND auto_antwort`) as any[];
        ok(Number(marken[0].n) === ids.length, `${schritt.id}: ${ids.length} Nachricht(en) als „Automatische Antwort“ markiert`);
      }
      if (pr.ki_aufrufe != null) ok(aufrufe.length === pr.ki_aufrufe, `${schritt.id}: ${pr.ki_aufrufe} KI-Aufruf(e) (${aufrufe.length})`);
      if (pr.sicher) ok(prot.some((p) => p.art === "sicherer_satz") && !prot.some((p) => p.art === "rueckfall"), `${schritt.id}: sicherer Satz statt Rückfallsatz`);
      if (pr.kein_rueckfall) ok(!prot.some((p) => p.art === "rueckfall"), `${schritt.id}: kein Rückfallsatz im Protokoll`);
      if (pr.zweiter_hinweis) ok(aufrufe.some((a) => a.zweiter && a.nutzer.some((t) => t.includes(pr.zweiter_hinweis))), `${schritt.id}: zweiter Entwurf bekommt den Hinweis „${pr.zweiter_hinweis}“`);
      for (const e of pr.prompt_enthaelt ?? []) ok(aufrufe[0]?.system.includes(ersetzen(e)), `${schritt.id}: Auftrag enthält „${ersetzen(e)}“`);
      for (const e of pr.prompt_nicht ?? []) ok(!aufrufe[0]?.system.includes(ersetzen(e)), `${schritt.id}: Auftrag ohne „${ersetzen(e)}“`);
      if (pr.zahltag_leer && personId) {
        const [p] = (await sql`SELECT promised_payment_date FROM fiaon_persons WHERE id = ${personId}`) as any[];
        ok(!p?.promised_payment_date, `${schritt.id}: kein geratener Zahltag festgehalten`);
      }
      if (pr.werkzeug_abgelehnt) ok(aufrufe.some((a) => a.werkzeugErgebnisse.some((w) => w?.ok === false && /nicht eindeutig/.test(String(w?.grund ?? "")))), `${schritt.id}: ${pr.werkzeug_abgelehnt} lehnt den geratenen Tag ab`);
      if (pr.termin_gebucht && personId) {
        const t = (await sql`SELECT beginn FROM fiaon_termine WHERE person_id = ${personId} AND status = 'gebucht' AND herkunft = 'mara_whatsapp'`) as any[];
        ok(t.length === 1 && ton.uhrzeitenIn(antwort).includes(hhmm(new Date(t[0].beginn))), `${schritt.id}: Termin echt im Kalender, Uhrzeit in der Antwort (${t[0] ? hhmm(new Date(t[0].beginn)) : "—"})`);
      }
      if (fremdePerson) await sql`DELETE FROM fiaon_termine WHERE person_id = ${fremdePerson}`;
    }
    // ── Je Fall: höchstens eine Aufgabe je Grund ────────────────────────────
    if (personId && !KI) {
      const klassen = (await sql`SELECT schluessel FROM fiaon_betreiber_todos WHERE schluessel LIKE ${`wa-${personId}-%`}`) as any[];
      const je = new Map<string, number>();
      for (const k of klassen) { const kl = String(k.schluessel).split("-")[2] ?? "?"; je.set(kl, (je.get(kl) ?? 0) + 1); }
      ok(Array.from(je.values()).every((n) => n <= 1), `${fall.id}: höchstens eine Aufgabe je Grund (${Array.from(je.entries()).map(([k, n]) => `${k}:${n}`).join(", ") || "keine"}; vorher ${todosVorher})`);
    }
  }
} catch (e) {
  fehler++;
  console.error("ABBRUCH:", e);
} finally {
  plan = null;
  await aufraeumen().catch((e) => console.error("Aufräumen:", e));
  await sql`DELETE FROM fiaon_settings WHERE key = ANY(${EINSTELLUNGEN})`.catch(() => {});
  for (const r of einstellungVorher) await sql`INSERT INTO fiaon_settings (key, value) VALUES (${r.key}, ${r.value}) ON CONFLICT (key) DO UPDATE SET value = ${r.value}`.catch(() => {});
}

if (KI && ALT_NEU.length) {
  console.log("\n══ ALT gegen NEU (echtes Modell) ═════════════════════════════════════");
  for (const z of ALT_NEU) console.log(`${z.fall}/${z.schritt}\n  Kunde: ${z.kunde.slice(0, 160)}\n  ALT:   ${z.alt.replace(/\s+/g, " ").slice(0, 300)}\n  NEU:   ${z.neu.replace(/\s+/g, " ").slice(0, 300)}`);
}
ok(FREMD.length === 0, `Kein Netzaufruf außer ${KI ? "OpenAI" : "der Attrappe"} (${FREMD.slice(0, 3).join(", ") || "keiner"})`);
console.log(`\n${fehler ? "✗" : "✓"} ${geprueft - fehler}/${geprueft} Prüfungen bestanden`);
process.exit(fehler ? 1 : 0);
