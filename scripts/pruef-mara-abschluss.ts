// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: MARA SCHLIESST AB (29.09.2026, E-265)
//
// Justin am 29.09.: „nicht ‚Daniel, Florentine, Nikita' schreiben, sondern die
// Nachnamen, zum letzten Mal!!" — „VIEL MEHR AUF DIE KREDITKARTEN!" — „NEIN,
// bezahlen Sie Ihre Rate, dann lasse ich Sie aus Kulanz gerne aus dem
// Vertrag!!!" — „Das liegt daran, dass bei Ihnen noch eine Zahlung offen ist.
// PUNKT AUS FERTIG!"
//
// Drei Teile (Muster: scripts/pruef-mara-wiedergabe.ts):
//   A. REGELN OHNE DATENBANK — Nennform (Herr/Herrn/Frau, ohne Anrede der volle
//      Name, Hans-Jürgen, Kunde mit gleichem Vornamen), die Wand gegen jedes
//      künftige `${vorname}` (jeder feste Satz mit „Testa Prüfmann" und „Testo
//      Ohneanrede"), Justins Screenshot-Sätze hart gefangen, Kartenziel (D2),
//      Abschlussprüfung, Kulanz-/Ruhe-/Stopp-Regeln, Kündigungssätze, Erkennung.
//   B. ECHTE FÄLLE — 20 WhatsApp-Gespräche aus der Produktion (NUR gelesen,
//      anonymisiert, Personen nur als ID in „quelle") laufen durch GENAU
//      maraAntwortet, gegen die lokale Test-DB, mit einem Attrappen-Modell: Der
//      erste Entwurf ist Maras ALTE Antwort (muss fallen), der zweite der Satz aus
//      dem Auftrag bzw. dem Werkzeug (muss durch). Dazu 5 Mail-Fälle rein (Knopf,
//      Formel, Ton). Soll-Merkmale je Fall (Bauplan 6.1):
//        N Nennform, kein Vorname allein · K „Kreditkarte" · L Wunschlimit = limitZiel
//        mit Bank-Satz · Z Betrag/Link/A ohne Zahlung/C ohne Rate · T Termin- oder
//        Abschlussfrage mit Nennform · R nach Kündigung/Stopp/Widerruf kein Link außer
//        der Formel · H Handlung wirklich geschehen · V kein Abwesender mit Zusage.
//        Nachbesserung 29.09.: E Argument „Sie überweisen selbst, abgebucht wird nichts" · B „kein Kreditinstitut?"
//        beantwortet · P das nächstkleinere Paket mit Ziel — auch mit --ki (die Muster zeigt der Server selbst).
//      Fälle: .pruef/mara-abschluss/*.json (nicht im Repo — echte Chats, auch
//      anonymisiert nicht öffentlich; erzeugt aus dem Leseauftrag E-265).
//   C. Mit --ki: dieselben Fälle mit dem ECHTEN Modell (OPENAI_API_KEY aus der
//      Umgebung) — ohne Versand, nur lokale Test-DB; geprüft werden die harten
//      Regeln und die Soll-Merkmale (Schwelle: 25/25 ohne harten Mangel, ≥ 22/25 alle Merkmale).
//
//   env -i PATH="$PATH" HOME="$HOME" DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_e265?sslmode=require' \
//     SESSION_SECRET=pruefstand-nur-lokal DOTENV_CONFIG_PATH=/dev/null npx tsx scripts/pruef-mara-abschluss.ts [--nur f12] [--ki]
// Eigene Datensätze (Nummern 4915900265xxx, Personen PRUEF265-…, Referenzen FIAON-P265…)
// werden am Ende entfernt; die Einstellungen (mara_wa_an, ki_pause, team_abwesenheit) zurückgesetzt.
// Echte Mitarbeiterkonten (8, 10, 13, 505, 928) werden nur GELESEN (Name, Anrede, Arbeitszeiten).
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
if (!KI) process.env.OPENAI_API_KEY = "sk-pruef-lokal-e265";

// ── Netz: nur lokal und (Attrappe oder, mit --ki, echt) OpenAI ─────────────
type Plan = { werkzeug?: { name: string; args: Record<string, unknown> }; antworten: string[]; mensch?: boolean; uebergabe?: string };
let plan: Plan | null = null;
let ersetzen: (t: string, extra?: Record<string, string>) => string = (t) => t;
const OPENAI: { system: string; nutzer: string[]; werkzeugErgebnisse: any[]; zweiter: boolean; antwort?: string }[] = [];
const FREMD: string[] = [];
const json = (status: number, j: unknown) => new Response(JSON.stringify(j), { status, headers: { "Content-Type": "application/json" } });
/** Die fertigen Sätze, die der Server dem Modell in den Auftrag schreibt — die Attrappe „übernimmt" sie. */
function aus(system: string, re: RegExp): string { return system.match(re)?.[1]?.trim() ?? ""; }
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
    const text = ersetzen(roh, {
      SO_SCHREIBEN: String(so),
      ABSCHLUSS: aus(system, /So, eingesetzt für ihn \(in eigenen Worten, gleiche Fakten, keine andere Zahl\): „([\s\S]*?)"\n/),
      WAS_IST: aus(system, /Deine Kurzantwort \(in eigenen Worten, gleiche Fakten, nie „Bonitätsplattform" als erstes Wort\): „([\s\S]*?)"\n/),
      KEINE_KARTE: aus(system, /kein Umweg über den Link oder die Zusage der Bank: „([\s\S]*?)"\n/),
      NOCH_ZAHLEN: aus(system, /Fragt er, ob er noch zahlen muss: „([\s\S]*?)" — mit seiner Zahlungsseite/),
      // E-265 Nachbesserung (V1): die Einwand-Muster, die der Server dem Modell WIRKLICH zeigt (vorher baute der
      // Prüfstand sie selbst — Teil B war grün, obwohl das Live-Modell nur die alten Muster ohne Karte sah).
      VORKASSE_AUFTRAG: aus(system, /KUNDE: Wieso soll ich zahlen, bevor ich überhaupt etwas bekomme\?\nDU: ([^\n]*)\n/),
      ZU_TEUER_AUFTRAG: aus(system, /KUNDE: Das ist mir zu teuer\.\nDU: ([^\n]*)\n/),
      // E-265 Schluss-Nachbesserung (01.10.2026): die feste Antwort auf seine Limit-Frage (bausteinLimitFrage), wie der Server sie zeigt.
      LIMIT_FRAGE: aus(system, /Deine Antwort auf die Limit-Frage \([^)]*\): „([\s\S]*?)"\n/),
    }).replace(/\s+/g, " ").trim();
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
const ton = await import("../shared/fiaon-mara-ton");
// E-265 (01.10.2026, Recht): der Abrechnungsmonat — eine Rechnung für Teil A und Teil B.
const antragStand = await import("../shared/fiaon-antrag-stand");
const nm = await import("../shared/fiaon-mitarbeiter-name");
const { sendePruefung } = await import("../server/lib/fiaon-whatsapp");
const pm = await import("../server/lib/fiaon-postmeister-agent");
const abw = await import("../server/lib/fiaon-abwesenheit");
const namen = await import("../server/lib/fiaon-mitarbeiter-namen");
const mt = await import("../server/lib/fiaon-mara-termin");
const { PACK_LIMITS } = await import("../server/routes/fiaon-antrag");

const berlinIso = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
const hhmm = (d: Date) => { const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d); return `${p.find((x) => x.type === "hour")?.value}:${p.find((x) => x.type === "minute")?.value}`; };
const kurz = (t: string, n = 110) => String(t ?? "").replace(/\s+/g, " ").slice(0, n);

// Das Team für die reinen Prüfungen: wie in der Produktion (8, 10, 13, 505, 531, Vertreter 928) plus zwei Prüfkonten.
const TEAM: import("../shared/fiaon-mitarbeiter-name").MitarbeiterEintrag[] = [
  { vorname: "Daniel", nachname: "Stripling", anrede: "Herr" },
  { vorname: "Florentine", nachname: "Lombardi", anrede: "Frau" },
  { vorname: "Nikita", nachname: "Boychenko", anrede: null },
  { vorname: "Hans-Jürgen", nachname: "Gerhold", anrede: "Herr" },
  { vorname: "Diana", nachname: "Zeller", anrede: "Frau" },
  { vorname: "Justin", nachname: "Schwarzott", anrede: null },
  { vorname: "Testa", nachname: "Prüfmann", anrede: "Frau" },
  { vorname: "Testo", nachname: "Ohneanrede", anrede: null },
];
const hartName = (t: string, kundeNamen: string[] = []) => nm.mitarbeiterVornameFunde(t, TEAM, { kundeNamen }).filter((f) => f.schwere === "hart");
const TESTA = nm.nennform({ anrede: "Frau", first_name: "Testa", last_name: "Prüfmann" });
const TESTO = nm.nennform({ anrede: null, first_name: "Testo", last_name: "Ohneanrede" });
/** Vorname allein — „Testa"/„Testo", auf die kein Nachname folgt. */
const TEST_VORNAME_ALLEIN = /\bTest[ao]\b(?!\s+(?:Prüfmann|Ohneanrede))/;
const GERATEN = /\b(?:Herrn?|Frau)\s+(?:Ohneanrede|Testo)\b/;

// ═══════════════════════════════════════════════════════════════════════════
// A. REGELN OHNE DATENBANK
// ═══════════════════════════════════════════════════════════════════════════
if (!NUR || NUR === "a") {
  console.log("── A1. Nennform ─────────────────────────────────────────────────────");
  const ds = nm.nennform({ anrede: "Herr", first_name: "Daniel", last_name: "Stripling", name: "Daniel Stripling" });
  ok(ds.nom === "Herr Stripling" && ds.dat === "Herrn Stripling" && ds.hatAnrede, `Herr → „${ds.nom}“ / mit: „${ds.dat}“`);
  const fl = nm.nennform({ anrede: "Frau", first_name: "Florentine", last_name: "Lombardi" });
  ok(fl.nom === "Frau Lombardi" && fl.dat === "Frau Lombardi", `Frau → „${fl.nom}“ (Dativ gleich)`);
  const nb = nm.nennform({ anrede: null, first_name: "Nikita", last_name: "Boychenko", name: "Nikita Boychenko" });
  ok(nb.nom === "Nikita Boychenko" && nb.dat === "Nikita Boychenko" && !nb.hatAnrede, `ohne Anrede → voller Name „${nb.nom}“, nie geraten`);
  const hj = nm.nennform({ anrede: "Herr", first_name: "Hans-Jürgen", last_name: "Gerhold" });
  ok(hj.nom === "Herr Gerhold" && hj.dat === "Herrn Gerhold", `Hans-Jürgen → „${hj.nom}“ / „${hj.dat}“`);
  ok(nm.nennform({ anrede: "Hr.", first_name: "Daniel", last_name: "Stripling" }).nom === "Herr Stripling" && nm.nennform({ anrede: "herrn", first_name: "Daniel", last_name: "Stripling" }).nom === "Herr Stripling", "„Hr.“ und „herrn“ gelten als Herr");
  ok(nm.nennform({ anrede: "Divers", first_name: "Kim", last_name: "Muster" }).nom === "Kim Muster", "unbekannte Anrede → voller Name");
  ok(nm.nennform({ anrede: "Herr", first_name: null, last_name: null, name: "Justin Schwarzott" }).nom === "Herr Schwarzott", "nur `name` gepflegt → Nachname daraus");
  ok(nm.nennformAusText("Herr Stripling")?.dat === "Herrn Stripling" && nm.nennformAusText("Nikita Boychenko")?.dat === "Nikita Boychenko", "nennformAusText: Dativ aus dem Nominativ");
  ok(ton.nennAus("Herr Stripling")?.dat === "Herrn Stripling" && ton.nennAus({ nom: "Frau Lombardi", dat: "Frau Lombardi" })?.nom === "Frau Lombardi" && ton.nennAus(null) === null, "nennAus: Text, Paar und leer");

  console.log("── A2. Vorname allein ist hart ──────────────────────────────────────");
  const faelle: [string, "hart" | "weich" | "ok", string[]?][] = [
    ["Daniel ruft Sie heute um 17:30 Uhr an und klärt alles in Ruhe mit Ihnen.", "hart"],
    ["nach der Zahlung ist Ihr Account aktiv und Florentine begleitet Sie Schritt für Schritt weiter.", "hart"],
    ["Ihr Betreuer Nikita kann Ihnen den Ablauf in Ruhe erklären.", "hart"],
    ["Gern, ich gebe Ihren Widerruf jetzt an Hans-Jürgen weiter.", "hart"],
    ["Herr Stripling ruft Sie morgen um 9:30 Uhr an.", "ok"],
    ["Ihr Termin mit Herrn Stripling steht.", "ok"],
    ["Nikita Boychenko erklärt Ihnen den Ablauf.", "ok"],
    ["Herr Gerhold prüft das.", "ok"],
    ["Gern, Florentine Lombardi meldet sich heute bei Ihnen.", "weich"],
    ["Guten Tag Daniel Muster, Herr Stripling ruft Sie an.", "ok", ["Daniel Muster", "Daniel", "Muster"]],
    ["Danielle aus dem Kundenservice", "ok"],
    ["Ja, am Justin-Weg 3 ist unser Büro.", "ok"],
  ];
  for (const [t, soll, kn] of faelle) {
    const f = nm.mitarbeiterVornameFunde(t, TEAM, { kundeNamen: kn ?? [] });
    const ist = f.some((x) => x.schwere === "hart") ? "hart" : f.some((x) => x.schwere === "weich") ? "weich" : "ok";
    ok(ist === soll, `„${kurz(t, 70)}“ → ${soll} (ist: ${ist})`);
  }
  const rep = [
    ["Gern, ich gebe es an Daniel weiter.", "Gern, ich gebe es an Herrn Stripling weiter."],
    ["Daniel ruft Sie morgen an.", "Herr Stripling ruft Sie morgen an."],
    ["Ihr Termin mit Nikita steht.", "Ihr Termin mit Nikita Boychenko steht."],
    ["Florentine meldet sich bei Ihnen.", "Frau Lombardi meldet sich bei Ihnen."],
    ["Ich gebe Hans-Jürgen Bescheid, und bei Daniel liegt es auch.", "Ich gebe Herrn Gerhold Bescheid, und bei Herrn Stripling liegt es auch."],
  ];
  for (const [a, b] of rep) { const r = nm.vornamenErsetzen(a, TEAM); ok(r === b, `Reparatur „${a}“ → „${r}“`); }
  // Tonprüfung: die neue Regel ist hart, die Nennform geht durch
  const tp = (t: string, kanal: "whatsapp" | "mail" = "whatsapp") => ton.tonPruefung(t, { kanal, land: "DE", kunde: "", mitarbeiter: TEAM });
  ok(tp("Daniel ruft Sie heute um 17:30 Uhr an.").some((b) => b.id === "mitarbeiter_vorname" && b.schwere === "hart"), "tonPruefung WhatsApp: „Daniel ruft …“ → mitarbeiter_vorname hart");
  ok(tp("Gern, Florentine meldet sich heute bei Ihnen.", "mail").some((b) => b.id === "mitarbeiter_vorname" && b.schwere === "hart"), "tonPruefung Mail: „Florentine meldet sich“ → hart");
  ok(!tp("Gern, Herr Stripling ruft Sie morgen um 10 Uhr an.").some((b) => b.schwere === "hart" || b.id === "herr_frau"), "„Herr Stripling“ ist kein Kunden-„Herr“ (herr_frau schweigt für Mitarbeiter)");
  ok(tp("Guten Tag Herr Wolf, schön von Ihnen zu hören.").some((b) => b.id === "herr_frau"), "… ein Kunden-„Herr Wolf“ fällt weiter auf");

  console.log("── A3. Die Wand gegen jedes künftige ${vorname} ─────────────────────");
  // Jeder feste Satz, einmal mit Anrede (Testa Prüfmann, Frau) und einmal ohne (Testo Ohneanrede).
  const ZIEL = ton.kartenZiel({ wunschEuro: 25000, rahmenEuro: 25000, paketKey: "highend" });
  const LINK = "https://fiaon.com/zahlung/FIAON-P265WAND";
  const jetzt = new Date();
  const morgen10 = new Date(Date.now() + 86_400_000); morgen10.setUTCHours(8, 0, 0, 0);
  for (const n of [TESTA, TESTO]) {
    const wer = n.hatAnrede ? "mit Anrede" : "ohne Anrede";
    const nennE = { nom: n.nom, dat: n.dat };
    const saetze: [string, string][] = [
      ["rueckfallSatz", wa.rueckfallSatz(nennE)],
      ["abweichungsSatz (belegt)", ton.abweichungsSatz({ wunsch: "15:00", grund: "belegt" }, n.nom, "morgen um 15:20 Uhr")],
      ["abweichungsSatz (Vorlauf)", ton.abweichungsSatz({ wunsch: "12:25", grund: "vorlauf" }, n.nom, "heute um 12:40 Uhr")],
      ["sichererSatz (gebucht)", String(wa.sichererSatz({ kunde: "Morgen 10 Uhr?", aktionen: [{ werkzeug: "rueckruf_eintragen", ok: true, zeiten: ["10:00"], termin: { beginn: morgen10.toISOString(), text: "morgen um 10 Uhr", kundenText: "morgen um 10 Uhr", uhrzeit: "10:00", vorname: n.vorname, nenn: nennE } as any }] as any, stufe: "zahlung_offen" }))],
      ["sichererSatz (Termin steht)", String(wa.sichererSatz({ kunde: "Wann ruft mich jemand an?", aktionen: [], termin: { beginn: morgen10.toISOString(), vorname: n.vorname, nenn: nennE } as any, stufe: "zahlung_offen", jetzt }))],
      ["bausteinAbschluss b", ton.bausteinAbschluss({ kanal: "whatsapp", art: "b", ziel: ZIEL, betrag: "99,99 €", mit: nennE, zeit: "morgen um 10 Uhr", link: LINK })],
      ["bausteinAbschluss b (Termin steht)", ton.bausteinAbschluss({ kanal: "whatsapp", art: "b", ziel: ZIEL, betrag: "99,99 €", mit: nennE, zeit: "morgen um 10 Uhr", terminSteht: true, link: LINK })],
      ["bausteinAbschluss a", ton.bausteinAbschluss({ kanal: "whatsapp", art: "a", ziel: ZIEL, betrag: "99,99 €", mit: nennE, zeit: "morgen um 10 Uhr" })],
      ["bausteinAbschluss rate", ton.bausteinAbschluss({ kanal: "whatsapp", art: "rate", ziel: ZIEL, betrag: "99,99 €", rateVom: "13.09.", mit: nennE, link: LINK })],
      ["bausteinAbschluss abbrecher", ton.bausteinAbschluss({ kanal: "whatsapp", art: "abbrecher", ziel: ZIEL, mit: nennE, zeit: "morgen um 10 Uhr", link: "https://fiaon.com/a/P265wandxx/w" })],
      ["bausteinAbschluss c", ton.bausteinAbschluss({ kanal: "whatsapp", art: "c", mit: nennE, link: "https://fiaon.com/a/P265wandxx/w" })],
      ["bausteinAbschluss b (Mail)", ton.bausteinAbschluss({ kanal: "mail", art: "b", ziel: ZIEL, betrag: "99,99 €", verwendungszweck: "FIAON-P265WAND", mit: nennE })],
      ["bausteinKeineKarte", ton.bausteinKeineKarte({ kanal: "whatsapp", betrag: "59,99 €", rateVom: "12.09.", ziel: ZIEL, link: LINK, mit: nennE })],
      ["bausteinVorkasse", ton.bausteinVorkasse({ betrag: "99,99 €", ziel: ZIEL, mit: nennE, zeit: "morgen um 10 Uhr", link: LINK })],
      ["bausteinWasIstFiaon (Kunde)", ton.bausteinWasIstFiaon({ kanal: "whatsapp", stufe: "kunde", ziel: ZIEL, betreuer: nennE })],
      ["bausteinAbstreiten rueckfrage", ton.bausteinAbstreiten({ kanal: "whatsapp", art: "rueckfrage", herkunft: null, betreuer: n.nom })],
    ];
    for (const [was, s] of saetze) {
      const namensTreffer = TEST_VORNAME_ALLEIN.test(s) || GERATEN.test(s) || hartName(s).length > 0;
      ok(s && s !== "null" && !namensTreffer && (s.includes(n.nom) || s.includes(n.dat)), `${was} ${wer}: Nennform, kein Vorname allein, nichts geraten — „${kurz(s, 90)}“`);
    }
    // Die großen Texte: Persona und der ganze Auftrag an das Modell
    const persona = ton.personaText("whatsapp", { betreuer: nennE, vertretung: { name: n.nom, dat: n.dat, bis: "Freitag, 2. Oktober, 9 Uhr" } });
    ok(!TEST_VORNAME_ALLEIN.test(persona) && !GERATEN.test(persona) && persona.includes(n.nom), `personaText ${wer}: Nennform drin, kein Vorname allein`);
    const auftrag = wa.maraAuftrag({
      name: "Prüf Kunde", wer: "Prüf Kunde", lage: "Antrag fertig", ziel: "Er zahlt die erste Rate.", link: LINK, verkaufen: true,
      gedaechtnis: "", verlauf: "KUNDE (Di 10:00): Zuerst die Zahlung dann, zahle ich gerne weiter!", wissen: "", hausanweisung: "",
      werkzeuge: true, betreuer: nennE, fester: nennE, jetzt: "Dienstag, 29.09.2026, 10:00",
      abschluss: { art: "b", satz: ton.bausteinAbschluss({ kanal: "whatsapp", art: "b", ziel: ZIEL, betrag: "99,99 €", mit: nennE, zeit: "morgen um 10 Uhr", link: LINK }), ziel: ZIEL, zeitHerkunft: "freie_zeiten" },
      kuendigung: "frage", stufe: "zahlung_offen",
    });
    ok(!TEST_VORNAME_ALLEIN.test(auftrag) && !GERATEN.test(auftrag), `maraAuftrag ${wer}: kein „Testa/Testo“ allein, nichts geraten`);
    ok(auftrag.includes(n.dat) && auftrag.includes("DEIN ABSCHLUSS") && auftrag.includes("25.000 €"), `maraAuftrag ${wer}: Abschluss mit Nennform und Kartenziel`);
    ok(!n.hatAnrede ? /nie er\/sie|ohne er\/sie|kein Pronomen|nie „er“/i.test(persona + auftrag) : true, `${wer}: ohne Anrede der Hinweis „nie er/sie“`);
  }

  console.log("── A4. Justins Screenshot-Sätze fallen hart, die Bausteine gehen durch ─");
  const SCREEN: [string, string][] = [
    ["Sehr gern — Daniel ruft Sie heute um 17:30 Uhr an und klärt alles in Ruhe mit Ihnen.", "Vorname"],
    ["Die 99,99 € sind die erste Monatsrate; danach begleitet Daniel Sie Schritt für Schritt.", "Vorname"],
    ["FIAON ist Ihre Bonitätsplattform: Wir erklären Ihre Auskunft. Daniel ist dabei Ihr fester Betreuer.", "Vorname"],
    ["Gern, ich gebe Ihren Kündigungswunsch an Daniel weiter. Ihre Zahlungsseite zur aktuellen Rate bleibt hier: https://fiaon.com/zahlung/FIAON-P265X-2", "Vorname"],
    ["Ich verstehe Sie, wenn Sie nichts vorab zahlen möchten. Daniel klärt das mit Ihnen persönlich.", "Vorname"],
    ["Sie bekommen Ihre Kreditkarte mit einem Limit von 25.000 €.", "Limit"],
    ["Ihr Wunschlimit von 25.000 € steht schon fest.", "Wunschlimit ohne Bank"],
  ];
  for (const [t, warum] of SCREEN) {
    const h = ton.tonPruefung(t, { kanal: "whatsapp", land: "DE", kunde: "", mitarbeiter: TEAM }).filter((b) => b.schwere === "hart");
    ok(h.length > 0, `hart (${warum}): „${kurz(t, 80)}“ → ${h.map((b) => b.id).join(", ")}`);
  }
  ok(sendePruefung("Bei uns bekommen Sie Ihre Visa-Kreditkarte mit 25.000 €.").length > 0, "Wortwand: „bekommen Sie Ihre Visa-Kreditkarte“ als Zusage → verboten");
  ok(!sendePruefung("Bei uns kommen Sie zu Ihrer Visa-Kreditkarte mit Ihrem Wunschlimit von 25.000 € — über den Rahmen entscheidet unsere Partnerbank.").length, "… Justins Satz („kommen Sie zu …“, Bank entscheidet) geht durch");
  ok(!sendePruefung("Sobald Ihre Zahlung gebucht ist, bekommen Sie direkt den Link unserer Partnerbank für Ihre Visa-Kreditkarte — über den Rahmen entscheidet unsere Partnerbank.").length, "… „bekommen Sie den Link der Partnerbank“ ist keine Kartenzusage");
  ok(ton.limitOhneBank("Ihr Wunschlimit von 25.000 € steht fest.") !== null && ton.limitOhneBank("mit Ihrem Wunschlimit von 25.000 € — über den Rahmen entscheidet unsere Partnerbank.") === null, "limitOhneBank: ohne Bank-Satz Treffer, mit Bank-Satz keiner");
  const BAUSTEINE: [string, string][] = [
    ["Abschluss b", ton.bausteinAbschluss({ kanal: "whatsapp", art: "b", ziel: ZIEL, betrag: "99,99 €", mit: ds, zeit: "morgen um 10 Uhr", link: LINK })],
    ["Abschluss a", ton.bausteinAbschluss({ kanal: "whatsapp", art: "a", ziel: ZIEL, betrag: "99,99 €", mit: ds, zeit: "morgen um 10 Uhr" })],
    ["Abschluss rate", ton.bausteinAbschluss({ kanal: "whatsapp", art: "rate", ziel: ZIEL, betrag: "79,99 €", rateVom: "13.09.", mit: ds, link: LINK })],
    ["Abschluss abbrecher", ton.bausteinAbschluss({ kanal: "whatsapp", art: "abbrecher", ziel: ton.kartenZiel({ wunschEuro: 20000, rahmenEuro: 15000, paketKey: "ultra" }), mit: ds, zeit: "heute um 12 Uhr", terminSteht: true, link: "https://fiaon.com/a/P265wandxx/w" })],
    ["Abschluss c", ton.bausteinAbschluss({ kanal: "whatsapp", art: "c", mit: nb, link: "https://fiaon.com/a/P265wandxx/w" })],
    ["Was ist FIAON (Kunde)", ton.bausteinWasIstFiaon({ kanal: "whatsapp", stufe: "kunde", ziel: ZIEL, betreuer: ds })],
    ["Was ist FIAON (C)", ton.bausteinWasIstFiaon({ kanal: "whatsapp", stufe: "lead", link: "https://fiaon.com/a/P265wandxx/w" })],
    ["Keine Karte", ton.bausteinKeineKarte({ kanal: "whatsapp", betrag: "59,99 €", rateVom: "12.09.", link: LINK, mit: fl })],
    ["Keine Karte (Altkunde)", ton.bausteinKeineKarte({ kanal: "whatsapp", betrag: "79,99 €", rateVom: "13.09.", ziel: ton.kartenZiel({ wunschEuro: 11000, rahmenEuro: 15000, paketKey: "ultra" }), altkunde: true, link: LINK, mit: ds })],
    ["Vorkasse", ton.bausteinVorkasse({ betrag: "99,99 €", ziel: ZIEL, mit: fl, zeit: "morgen um 15:40 Uhr", link: LINK })],
    ["Zu teuer → Pro", ton.bausteinZuTeuerKarte({ paketKey: "pro", zielEuro: 5000 })],
    ["Kündigung Frage", ton.bausteinKuendigungFrage({ kanal: "whatsapp", ziel: ZIEL })],
    ["Widerruf", ton.bausteinWiderruf()],
    ["Kündigung Jahresvertrag", ton.bausteinKuendigung({ kanal: "whatsapp", weg: "letzte_rate", jahresvertrag: true, heute: "29.09.", rateVom: "12.09.", betrag: "99,99 €", link: LINK, bestaetigung: true })],
    ["Kündigung Altvertrag", ton.bausteinKuendigung({ kanal: "whatsapp", weg: "letzte_rate", jahresvertrag: false, heute: "29.09.", rateVom: "12.09.", betrag: "59,99 €", link: LINK })],
    ["Storno", ton.bausteinKuendigung({ kanal: "whatsapp", weg: "storno_unbezahlt", jahresvertrag: true, heute: "29.09.", bestaetigung: true })],
  ];
  for (const [was, s] of BAUSTEINE) {
    const h = ton.tonPruefung(s, { kanal: "whatsapp", land: "DE", kunde: "", mitarbeiter: TEAM }).filter((b) => b.schwere === "hart");
    const w = sendePruefung(s);
    ok(!h.length && !w.length && s.length <= 500, `${was}: ohne harten Treffer, Wand frei, ${s.length} Zeichen${h.length || w.length ? ` — ${[...h.map((b) => b.id), ...w].join(" · ")}` : ""}`);
  }

  console.log("── A5. Kartenziel (D2) ──────────────────────────────────────────────");
  const z1 = ton.kartenZiel({ wunschEuro: 25000, rahmenEuro: PACK_LIMITS.highend, paketKey: "highend" });
  ok(z1?.euro === 25000 && z1.art === "wunsch" && ton.kartenzielText(z1) === "mit Ihrem Wunschlimit von 25.000 €", `High-End 25.000 € → „${ton.kartenzielText(z1)}“`);
  const z2 = ton.kartenZiel({ wunschEuro: 20000, rahmenEuro: PACK_LIMITS.ultra, paketKey: "ultra" });
  ok(z2?.euro === 15000 && z2.art === "paket" && /15\.000 € als Ziel in Ihrem Paket FIAON Ultra/.test(ton.kartenzielText(z2)), `Wunsch 20.000 € über dem Ultra-Rahmen → „${ton.kartenzielText(z2)}“`);
  const z3 = ton.kartenZiel({ wunschEuro: 11000, rahmenEuro: PACK_LIMITS.ultra, paketKey: "ultra" });
  ok(z3?.euro === 11000 && z3.art === "wunsch", "Ultra 11.000 € bleibt das Wunschlimit");
  ok(ton.kartenZiel({ wunschEuro: null }) === null && ton.kartenZiel({ wunschEuro: 0 }) === null && ton.kartenzielText(null) === "", "ohne Wunsch kein Ziel, kein Text");
  ok(PACK_LIMITS.start === 500 && PACK_LIMITS.pro === 5000 && PACK_LIMITS.ultra === 15000 && PACK_LIMITS.highend === 25000, "Rahmen je Paket vom Server (500/5.000/15.000/25.000)");

  console.log("── A6. Abschlussprüfung (weich) ─────────────────────────────────────");
  const ALT1350 = "Ich verstehe Sie: Sie möchten erst sehen, dass es losgeht. Die 99,99 € sind genau die erste Monatsrate zur Aktivierung; danach begleitet Herr Stripling Sie Schritt für Schritt.";
  const m1 = ton.abschlussPruefung(ALT1350, { art: "b", kunde: "Zuerst die Zahlung dann , zahle ich gerne weiter!", ziel: ZIEL, betrag: "99,99 €" });
  ok(m1.some((h) => /Kreditkarte/.test(h)) && m1.some((h) => /25\.000/.test(h)) && m1.some((h) => /Frage/.test(h)), `4714: alte Antwort → Karte, Ziel und Frage fehlen (${m1.length})`);
  const formel = ton.bausteinAbschluss({ kanal: "whatsapp", art: "b", ziel: ZIEL, betrag: "99,99 €", mit: ds, zeit: "morgen um 10 Uhr", link: LINK });
  ok(!ton.abschlussPruefung(formel, { art: "b", kunde: "Zuerst die Zahlung dann , zahle ich gerne weiter!", ziel: ZIEL, betrag: "99,99 €" }).length, "… Justins Formel erfüllt alles");
  ok(ton.abschlussPruefung(`Danke! Ihre Zahlungsseite: ${LINK}`, { art: "a", kunde: "bezahlt", ziel: null, betrag: "7,99 €" }).length === 1, "A: ein Zahlungslink nach „bezahlt“ fällt auf");
  ok(!ton.abschlussPruefung(ton.bausteinAbschluss({ kanal: "whatsapp", art: "a", betrag: "7,99 €", mit: fl, zeit: "morgen um 10 Uhr" }), { art: "a", kunde: "bezahlt", betrag: "7,99 €" }).length, "… die A-Formel (Danke, Karte, Termin) geht durch");
  const ALT1414 = "Die 59,99 € sind die Monatsrate für FIAON Pro: Ihr Account ist aktiv, und der Link der Partnerbank ist bereits an Sie rausgegangen; die Karte selbst kommt erst nach der Zusage der Bank.";
  ok(ton.abschlussPruefung(ALT1414, { art: "rate", kunde: "Wozu soll ich dann bitte zahlen", betrag: "59,99 €" }).some((h) => /Zahlung offen/.test(h)), "8078: „keine Karte — wozu zahlen?“ ohne „Zahlung offen“ fällt auf");
  ok(!ton.abschlussPruefung(ton.bausteinKeineKarte({ kanal: "whatsapp", betrag: "59,99 €", rateVom: "12.09.", link: LINK, mit: fl }), { art: "rate", kunde: "Wozu soll ich dann bitte zahlen", betrag: "59,99 €" }).length, "… „Das liegt daran, dass bei Ihnen noch eine Zahlung offen ist“ geht durch");
  ok(!ton.abschlussPruefung("Gern, danke Ihnen.", { art: "b", kunde: "Ok danke", betrag: "99,99 €" }).length, "ohne Kaufsignal/Einwand keine Abschlusspflicht");

  console.log("── A7. Ruhe, Kulanz, Stopp (handlungsPruefung) ──────────────────────");
  const hp = (t: string, kunde: string, bekannt: any = {}, aktionen: any[] = []) => wa.handlungsPruefung(t, aktionen, kunde, "", { links: [LINK], ...bekannt });
  ok(hp(`Ihre Zahlungsseite zur aktuellen Rate bleibt hier: ${LINK}`, "Bitte tun sie das", { ruhe: true }).length > 0, "#1401: Zahlungsseite nach Kündigung (Verlauf) fällt auf");
  // E-265 Nachbesserung: die Formel zählt nur mit gebuchter Kündigung (Werkzeug) oder in der Lage „beendet" mit Rate.
  const GEBUCHT = [{ werkzeug: "kuendigung_aufnehmen", ok: true, zeiten: [], satz: "…" }];
  ok(!hp(ton.bausteinKuendigung({ kanal: "whatsapp", weg: "letzte_rate", jahresvertrag: true, heute: "29.09.", rateVom: "12.09.", betrag: "99,99 €", link: LINK }), "Ich kündige", { ruhe: true, jahresvertrag: true }, GEBUCHT).length, "… Justins Kulanz-Formel mit Zahlungsseite geht durch (Kündigung gebucht, Jahresvertrag)");
  ok(!hp(ton.bausteinKuendigung({ kanal: "whatsapp", weg: "letzte_rate", jahresvertrag: false, heute: "29.09.", rateVom: "12.09.", betrag: "59,99 €", link: LINK }), "Muss ich trotzdem noch zahlen ?", { ruhe: true, jahresvertrag: false, gekuendigt: true, beendetMitRate: true }).length, "… die Altvertrag-Formel („danach kommt nichts mehr“) in der Lage „beendet“ auch");
  ok(hp("Verstanden, dann stoppen wir hier.", "Danke kein Interesse mehr").some((f) => /stopp|nicht mehr|Werkzeug|Sperre/i.test(f)), "#1186: „stoppen wir hier“ ohne Buchung/Sperre ist eine erfundene Zusage");
  ok(!hp("Verstanden, dann stoppen wir hier.", "Danke kein Interesse mehr", {}, [{ werkzeug: "kuendigung_aufnehmen", ok: true, zeiten: [], satz: "Erledigt" }]).length, "… mit gebuchtem Storno ist sie wahr");

  console.log("── A8. Kündigungssätze ─────────────────────────────────────────────");
  const kj = ton.bausteinKuendigung({ kanal: "whatsapp", weg: "letzte_rate", jahresvertrag: true, heute: "29.09.", rateVom: "12.09.", betrag: "99,99 €", link: LINK, bestaetigung: true });
  ok(/heute, am 29\.09\., bei uns eingegangen/.test(kj) && /aus Kulanz gerne aus dem Vertrag/.test(kj) && kj.includes(LINK) && /Rate vom 12\.09\. über 99,99 €/.test(kj) && !/offene Rate/.test(kj), `Jahresvertrag: Eingang, Kulanz, Rate vom …, Link, nie „offene Rate“ — „${kurz(kj, 120)}“`);
  const ka = ton.bausteinKuendigung({ kanal: "whatsapp", weg: "letzte_rate", jahresvertrag: false, heute: "29.09.", rateVom: "12.09.", betrag: "59,99 €", link: LINK });
  // E-265 (01.10.2026, Recht): Altvertrag — Ende des Abrechnungsmonats, nie „Monatsende".
  ok(!/kulanz/i.test(ka) && /gilt zum Ende Ihres laufenden Abrechnungsmonats/.test(ka) && !/Monatsende/.test(ka) && /danach kommt nichts mehr/.test(ka) && ka.includes(LINK), `Altvertrag: kein „Kulanz“, Ende des Abrechnungsmonats, nichts mehr — „${kurz(ka, 140)}“`);
  const km = ton.bausteinKuendigung({ kanal: "mail", weg: "letzte_rate", jahresvertrag: true, heute: "29.09.", rateVom: "12.09.", betrag: "99,99 €", link: LINK });
  ok(/offene Rate/.test(km) && !km.includes("https://") && /Knopf/.test(km), "Mail: „offene Rate“ erlaubt, kein Link im Text (der Knopf trägt ihn)");
  const ks = ton.bausteinKuendigung({ kanal: "whatsapp", weg: "storno_unbezahlt", jahresvertrag: true, heute: "29.09.", betrag: "59,99 €", link: LINK });
  ok(!ks.includes("https://") && !/59,99/.test(ks) && /storniert/.test(ks), "Storno: kein Link, kein Betrag");
  ok(!ton.bausteinKuendigung({ kanal: "whatsapp", weg: "sofort_beendet", jahresvertrag: true, heute: "29.09." }).includes("https://"), "ohne offene Rate: kein Link");
  ok(/liegt uns schon vor/.test(ton.bausteinKuendigung({ kanal: "whatsapp", weg: "bereits", jahresvertrag: false, heute: "29.09." })), "„bereits“: nicht „heute eingegangen“");

  console.log("── A9. Erkennung ───────────────────────────────────────────────────");
  for (const t of ["Zuerst die Zahlung dann , zahle ich gerne weiter!", "Ich werde heute oder morgen bezahlen die 79 Euro.", "Bitte wie geht es weiter", "Ich bin morgen erst wieder zuhause", "Brauche 15000 euro"]) ok(ton.kaufSignal(t), `Kaufsignal: „${t}“`);
  for (const t of ["Nein danke habe ich gesagt ich zahle nichts vor ok", "Ich bezahle nicht 99 Euro für eine Karte", "Und seit wann muss man für einen Kredit in Vorkasse bezahlen das hört sich sehr unseriös an ?", "Warum soll ich eine Vorauszahlung tätigen. ?"]) ok(ton.einwandSignal(t), `Einwand: „${kurz(t, 60)}“`);
  for (const t of ["Was ist eigentlich Fiaon?", "Ich habe dein Formular ausgefüllt und würde gerne mehr über dein Unternehmen erfahren."]) ok(ton.fragtWasIstFiaon(t), `Was ist FIAON: „${kurz(t, 60)}“`);
  for (const t of ["Ich habe ja keine Karte und kein Credit aufgenommen", "Wozu soll ich dann bitte zahlen"]) ok(ton.fragtKeineKarte(t), `Keine Karte: „${t}“`);
  ok(ton.kuendigungsFrage("Kündigung kann ich per WhatsApp?") && ton.kuendigungsFrage("Kann ich kündigen?"), "Frage: „Kündigung kann ich per WhatsApp?“, „Kann ich kündigen?“");
  ok(!ton.kuendigungsFrage("Kann ich bitte kündigen\nIch brauche sie nicht") && ton.kuendigungBitte("Kann ich bitte kündigen\nIch brauche sie nicht"), "8078: „Kann ich bitte kündigen“ (ohne ?) ist eine Bitte, keine Frage");
  ok(!ton.kuendigungBitte("Kann ich bitte kündigen?") && !ton.kuendigungBitte("Kann ich bitte nicht kündigen"), "… mit Fragezeichen oder Verneinung nicht");
  const ANGEBOT = "Sie können formlos kündigen; am saubersten geht es im Kundenbereich. Wenn Sie möchten, gebe ich Ihren Wunsch direkt an Herrn Stripling weiter.";
  // E-265 Nachbesserung (Recht/Regression): nur ein klares Ja auf Maras EINE Kündigungsfrage — ein Angebot ohne Frage
  // („Wenn Sie möchten, gebe ich … weiter.") ist keine Rückfrage mehr; dann fragt Mara einmal nach (f12).
  ok(!ton.jaAufKuendigungsAngebot("Bitte tun sie das", ANGEBOT) && ton.jaAufKuendigungsAngebot("Ja", ton.bausteinKuendigungRueckfrage()) && !ton.jaAufKuendigungsAngebot("Ja", "Möchten Sie trotzdem kündigen? Dann nehme ich es sofort auf.") && ton.jaAufKuendigungsAngebot("Bitte tun sie das", ton.bausteinKuendigungFrage({ kanal: "whatsapp" })), "11145: „Bitte tun sie das“ zählt nur auf Maras Kündigungsfrage, nicht auf ein Angebot ohne Frage");
  ok(!ton.jaAufKuendigungsAngebot("Ja", "Soll ich Ihnen den Antrag schicken?") && !ton.jaAufKuendigungsAngebot("Nein, doch nicht", ANGEBOT) && !ton.jaAufKuendigungsAngebot("Wie lange dauert das?", ANGEBOT), "… nicht auf eine andere Frage, nicht bei Nein, nicht bei einer Gegenfrage");
  ok(!!ton.stornoUngefragt("Ja, der Vertrag wurde am 11. August angenommen; bei Ihnen gilt monatliche Kündigung zum Ende des laufenden Monats.", "Habe ich einen Vertrag unterschrieben?"), "11145 #1395: ungefragtes Kündigungsrecht fällt auf");
  ok(!ton.stornoUngefragt("Ja, Sie können auch hier kündigen.", "Kann ich kündigen?") && !ton.stornoUngefragt("Ja, Ihren Vertrag für FIAON Ultra haben Sie am 11. August angenommen.", "Habe ich einen Vertrag unterschrieben?"), "… gefragt oder ohne Kündigungsrecht nicht");
  ok(ton.abschlussArtAus("zahlung_offen") === "b" && ton.abschlussArtAus("zahlung_gemeldet") === "a" && ton.abschlussArtAus("kunde", { rateOffen: true }) === "rate" && ton.abschlussArtAus("kunde") === null && ton.abschlussArtAus("antrag_offen") === "abbrecher" && ton.abschlussArtAus("lead") === "c" && ton.abschlussArtAus("beendet") === null, "Abschlussart je Stufe (A/B/C nie umgedeutet, E-264: antrag_offen = Abbrecher)");

  console.log("── A10. Musterdialoge ──────────────────────────────────────────────");
  const ids = new Set(ton.MUSTERDIALOGE.map((d) => d.id));
  for (const id of ["abschluss_b_zahlungsbereit", "abschluss_b_vorkasse", "abschluss_b_zu_teuer", "abschluss_a_gemeldet", "abschluss_rate", "abschluss_abbrecher", "was_ist_fiaon_kunde", "was_ist_fiaon_c", "keine_karte_rate", "kuendigung_klar", "kuendigung_frage", "stopp_freitext", "widerruf", "termin_vertretung"]) ok(ids.has(id), `Musterdialog „${id}“ da`);
  for (const d of ton.MUSTERDIALOGE) {
    const t = ton.musterText(d);
    if (!t) continue;
    ok(!hartName(t).length, `Musterdialog „${d.id}“: kein Mitarbeiter-Vorname allein`);
  }
  const nieAlle = ton.MUSTERDIALOGE.flatMap((d) => (d as any).nie ?? []).join(" | ");
  for (const s of ["Daniel ruft Sie heute um 17:30 Uhr an", "Florentine begleitet Sie Schritt für Schritt", "Bonitätsplattform", "Daniel klärt das"]) ok(nieAlle.includes(s), `„nie“ enthält Justins Screenshot-Satz „${s}“`);

  // ═════════════════════════════════════════════════════════════════════════
  // A11. NACHBESSERUNG (29.09.2026) — die Befunde aus Recht, Verkauf und Regression als Gegenproben
  // ═════════════════════════════════════════════════════════════════════════
  console.log("── A11. Nachbesserung: Zusage am Wunschlimit (kritisch) ──────────────");
  const { wandPruefen } = await import("../shared/fiaon-wortverbote");
  const { istJahresvertrag, abrechnungsmonat, abrechnungsmonatEnde, giltZumSatz } = await import("../shared/fiaon-antrag-stand");
  const pmw = await import("../server/lib/fiaon-postmeister-werkzeuge");
  const { istWillenserklaerung } = await import("../server/lib/fiaon-kuendigung");
  const hartIds = (t: string) => ton.tonPruefung(t, { kanal: "whatsapp", land: "DE", kunde: "", mitarbeiter: TEAM }).filter((b) => b.schwere === "hart").map((b) => b.id);
  for (const t of [
    "Sie bekommen Ihr Wunschlimit von 25.000 €.",
    "Sie bekommen Ihr Wunschlimit von 25.000 €, über den Rahmen entscheidet unsere Partnerbank.",
    "Ihr Wunschlimit von 25.000 € ist Ihnen sicher, über den Rahmen entscheidet unsere Partnerbank.",
    "Mit Ihrer Zahlung schalten Sie Ihr Wunschlimit von 15.000 € frei — über den Rahmen entscheidet unsere Partnerbank.",
    "Sie bekommen 25.000 € auf Ihre Karte.",
  ]) ok(hartIds(t).includes("limit_zusage"), `limit_zusage hart: „${kurz(t, 80)}“`);
  ok(ton.bankSatzErgaenzen("Sie bekommen Ihr Wunschlimit von 25.000 €.") === "Sie bekommen Ihr Wunschlimit von 25.000 €.", "bankSatzErgaenzen hängt den Bank-Satz nie an eine Zusage (sie bleibt hart)");
  ok(wa.tonUndLink("Sie bekommen Ihr Wunschlimit von 25.000 €.", { mitarbeiter: TEAM }).hartIds.some((id) => id !== "limit"), "tonUndLink: die Zusage ist nicht „nur Limit“ — der nurLimit-Weg repariert sie nie");
  ok(!hartIds(ton.bausteinAbschluss({ kanal: "whatsapp", art: "b", ziel: ZIEL, betrag: "99,99 €", mit: ds, zeit: "heute um 15:30 Uhr", link: LINK })).length, "Justins Formel („kommen Sie zu …“) bleibt frei");

  console.log("── A11. Wortwand: Kartenzusage mit Rahmen-Satz ──────────────────────");
  const verboten = (t: string) => wandPruefen(t).some((f) => f.art === "verboten");
  ok(verboten("Bei uns bekommen Sie Ihre Kreditkarte mit Ihrem Wunschlimit von 25.000 € — über den Rahmen entscheidet unsere Partnerbank."), "Justins Originalsatz „Bei uns bekommen Sie Ihre Kreditkarte … — über den Rahmen entscheidet …“ fällt");
  ok(verboten("Sie bekommen Ihre Kreditkarte, über den Rahmen entscheidet die Bank."), "„Sie bekommen Ihre Kreditkarte, über den Rahmen entscheidet die Bank“ fällt");
  ok(!verboten("Nach der Zusage der Bank bekommen Sie Ihre Karte in der Regel in 2–5 Werktagen.") && !verboten("Sie bekommen die Karte nach der Zusage der Bank."), "… der Weg („nach der Zusage der Bank“) bleibt frei");

  console.log("── A11. Kündigung nur aus einer Erklärung ───────────────────────────");
  const FRAGE = ton.bausteinKuendigungFrage({ kanal: "whatsapp", ziel: ZIEL });
  ok((FRAGE.match(/\?/g) ?? []).length === 1 && !/gern\w*\s+gehe\s+ich/i.test(FRAGE), `bausteinKuendigungFrage: genau EINE Frage, kein zweites Angebot — „${kurz(FRAGE, 90)}“`);
  const NEIN_JA: [string, string, { knopf?: boolean }?][] = [
    ["Bitte verschieben", FRAGE, { knopf: true }], ["Bitte rufen Sie mich an", FRAGE, { knopf: true }], ["Ja, bitte", FRAGE, { knopf: true }],
    ["Ok", FRAGE], ["Ok danke", FRAGE], ["Ja aber erst nächsten Monat", FRAGE], ["Ja ich überlege es mir noch", FRAGE],
    ["Ja gerne", "Kündigen müssen Sie dafür nichts. Möchten Sie, dass Herr Stripling Sie heute anruft?"],
    ["Ok", "Eine Kündigung ist nicht nötig. Soll ich Ihnen Ihre Zahlungsseite schicken?"],
    ["Ja gerne", "Statt zu kündigen: Möchten Sie in das kleinere Paket wechseln?"],
    ["Ja gerne, gehen wir das durch", FRAGE],
  ];
  for (const [k, m, o] of NEIN_JA) ok(!ton.jaAufKuendigungsAngebot(k, m, o ?? {}), `kein Ja: „${k}“${o?.knopf ? " (Knopf)" : ""} auf „${kurz(m, 50)}“`);
  ok(ton.jaAufKuendigungsAngebot("Ja bitte", FRAGE) && ton.jaAufKuendigungsAngebot("Ja, bitte kündigen Sie meinen Vertrag.", FRAGE) && ton.jaAufKuendigungsAngebot("Genau", FRAGE), "… ein klares „Ja bitte“ / „Ja, bitte kündigen …“ / „Genau“ auf die Rückfrage zählt");
  ok(!ton.jaAufKuendigungsAngebot("Ja", { text: FRAGE, am: new Date(Date.now() - 25 * 3_600_000) }) && !ton.jaAufKuendigungsAngebot("Ja", { text: FRAGE, vorlage: "fiaon_kkb_rate" }), "… nicht nach 24 Stunden und nie auf eine Vorlage");
  for (const t of ["Kann ich bitte erfahren wie ich kündigen kann", "Kann ich bitte wissen, wann ich kündigen kann", "Kann ich bitte nachfragen ob ich kündigen muss", "Darf ich bitte fragen ob man kündigen kann", "Kann ich bitte später kündigen", "Kann ich bitte kündigen wenn die Karte nicht kommt"]) {
    ok(!ton.kuendigungBitte(t), `keine Bitte (Frage/Bedingung): „${t}“`);
  }
  ok(ton.kuendigungBitte("Kann ich bitte kündigen") && ton.kuendigungBitte("Kann ich bitte kündigen\nIch brauche sie nicht") && ton.kuendigungBitte("Bitte kündigen Sie meinen Vertrag"), "… die enge Bitte bleibt (8078)");
  // E-265 Nachbesserung 2 (01.10.2026): ZWEI SCHRITTE — „klar" heißt nur noch „die verbindliche Rückfrage stellen";
  // Verneinung/Rücknahme → „zurueck" (nie buchen, ein Mensch), Bestreiten/falsche Nummer → „bestreitet".
  const einordnen = (t: string) => wa.kuendigungEinordnen(t, {
    wille: (x) => pmw.kuendigungsWille(x, { unbezahlt: false, formlos: true, istWillenserklaerung }), keinSatz: pmw.keinKuendigungsSatz,
    ruecknahme: pmw.kuendigungRuecknahme, bestreitet: (x) => pmw.bestreitetKuendigung(x, ton.abstreitenArt),
  });
  const EINORDNUNG: [string, string | null][] = [
    ["Ich kündige nicht, ich will nur wissen wann die Karte kommt", "zurueck"], ["Wenn das nicht klappt kündige ich", null],
    ["Wie ist die Kündigungsfrist?", "frage"], ["Was passiert wenn ich kündige", "frage"], ["Bitte nicht stornieren, ich zahle am Freitag", "zurueck"],
    ["Kann ich bitte erfahren wie ich kündigen kann", "frage"], ["Ich kündige hiermit meinen Vertrag", "klar"], ["Kann ich bitte kündigen", "klar"],
    ["Bitte kündigen Sie nicht meinen Vertrag", "zurueck"], ["Ich kündige!\nWar ein Scherz, sorry", "zurueck"], ["Ich möchte meine Kündigung widerrufen", "zurueck"],
    ["Ich kündige nich. Ich zahle am Freitag.", "zurueck"], ["Falsche Nummer, bitte stornieren", "bestreitet"], ["Ich habe das nicht bestellt. Bitte stornieren Sie alles.", "bestreitet"],
  ];
  for (const [t, soll] of EINORDNUNG) ok(einordnen(t) === soll, `kuendigungEinordnen „${t}“ → ${soll} (ist: ${einordnen(t)})`);

  console.log("── A11. Formel nur mit Buchung, Kulanz nur beim Jahresvertrag ────────");
  const ALT_FORMEL = `Ihre Rate vom 12.09. über 59,99 € zahlen Sie bitte noch, danach kommt nichts mehr: ${LINK}`;
  ok(hp(`Ihre Kündigung ist heute bei uns eingegangen. ${ALT_FORMEL}`, "Ich kündige hiermit meinen Vertrag").length > 0, "r10: Kündigung „eingegangen“ + Zahlungsseite OHNE gebuchtes Werkzeug fällt");
  ok(hp(ALT_FORMEL, "Ich widerrufe den Vertrag, ich zahle gar nichts mehr.", {}, GEBUCHT).length > 0, "Widerruf + „danach kommt nichts mehr“ mit Link fällt (auch mit Werkzeug)");
  ok(hp(`Bitte begleichen Sie Ihre Rate vom 12.09. über 59,99 €, dann lasse ich Sie aus Kulanz gerne aus dem Vertrag: ${LINK}`, "Ich kann nicht zahlen", { jahresvertrag: true }).length > 0, "„kann nicht zahlen“ + Kulanz-Satz fällt");
  ok(hp("Verstanden, danach kommt nichts mehr von uns.", "Hören Sie auf mir zu schreiben").length > 0, "„danach kommt nichts mehr“ ohne Werkzeug fällt (Stopp-Zusage)");
  ok(hp(`Bitte begleichen Sie Ihre Rate vom 12.09. über 59,99 €, dann lasse ich Sie aus Kulanz gerne aus dem Vertrag: ${LINK}`, "Ich kündige hiermit", { jahresvertrag: false }, GEBUCHT).some((f) => /Kulanz/.test(f)), "„Kulanz“ beim Altvertrag fällt hart (§ 5 UWG)");
  ok(wa.kuendigungBestaetigt("Ihre Kündigung ist heute, am 29.09., bei uns eingegangen.") !== null && wa.kuendigungBestaetigt("Soll ich Ihre Kündigung trotzdem jetzt aufnehmen?") === null && wa.kuendigungBestaetigt("Ihr Widerruf ist heute bei uns eingegangen.") === null, "kuendigungBestaetigt: „eingegangen“ ja, Rückfrage und Widerruf nein");
  ok(hp(`Ich verstehe. Hier ist Ihre Zahlungsseite: ${LINK}`, "Ich habe ja keine Karte bekommen, wozu zahlen?", { ruhe: true }).length > 0, "ruhe.mts: Widerruf/Kündigung gestern, heute „keine Karte“ — die Zahlungsseite fällt (keine Ausnahme mehr)");
  ok(!hp(`Sehr gern, hier ist Ihre Zahlungsseite: ${LINK}`, "Ich zahle jetzt", { ruhe: true }).length && !hp(`Gern: ${LINK}`, "Ok schicken Sie mir den Link", { ruhe: true }).length, "r2: ein aktuelles Kaufsignal oder die Link-Bitte hebt die Ruhe aus dem Verlauf auf");
  ok(!wa.ruheErklaerung("Ich will nicht kündigen, ich zahle morgen", pmw.keinKuendigungsSatz) && !wa.ruheErklaerung("Bitte nicht stornieren, ich zahle am Freitag", pmw.keinKuendigungsSatz) && wa.ruheErklaerung("Ich kündige hiermit meinen Vertrag.", pmw.keinKuendigungsSatz), "ruheErklaerung: verneint zählt nicht, die Erklärung schon");
  ok(hp(`Gern, hier ist Ihre Zahlungsseite: ${LINK}`, "Ich kann gerade nicht zahlen").some((f) => /leichtesten Weg/.test(f) && !/wer es mit ihm klärt/.test(f)), "„kann nicht zahlen“: der leichteste Weg statt „sag, wer es klärt“ (f04)");

  console.log("── A11. Mehrere Raten, Altvertrag nach Vertragsende, „bereits“ ──────");
  const R2 = [{ vom: "12.09.", betrag: "59,99 €", cents: 5999 }, { vom: "12.10.", betrag: "59,99 €", cents: 5999 }];
  const km2 = ton.bausteinKuendigung({ kanal: "whatsapp", weg: "letzte_rate", jahresvertrag: true, heute: "29.09.", raten: R2, link: LINK });
  ok(/vom 12\.09\./.test(km2) && /vom 12\.10\./.test(km2) && /zusammen 119,98 €/.test(km2) && !/danach kommt nichts mehr/.test(km2), `zwei Raten: beide mit Summe, ohne „danach kommt nichts mehr“ — „${kurz(km2, 120)}“`);
  // E-265 (01.10.2026, Recht): Raten am 12.; Kündigung 29.09. → Frist 30.09. → Abrechnungsmonat 12.09.–11.10. → Ende 11.10.
  const ende12 = abrechnungsmonatEnde("2026-09-29T10:00:00Z", ["2026-08-12", "2026-09-12", "2026-10-12"]);
  const auf = ton.kuendigungRatenAufteilen([{ faellig: "2026-09-12" }, { faellig: "2026-10-12" }], { jahresvertrag: false, vertragsEnde: ende12 });
  ok(auf.zuZahlen.length === 1 && auf.nachEnde.length === 1 && ende12 === "2026-10-11", `Altvertrag: die Rate vom 12.10. liegt nach dem Vertragsende (${ende12}) — nie verlangt`);
  ok(ton.kuendigungRatenAufteilen([{ faellig: "2026-10-12" }], { jahresvertrag: true, vertragsEnde: "2026-10-11" }).zuZahlen.length === 1, "… beim Jahresvertrag bleibt sie (Kulanz)");
  const kn = ton.bausteinKuendigung({ kanal: "whatsapp", weg: "letzte_rate", jahresvertrag: false, heute: "29.09.", raten: [], giltZum: "2026-10-11" });
  ok(/gilt zum Ende Ihres laufenden Abrechnungsmonats, dem 11\.10\.2026, danach kommt nichts mehr/.test(kn) && !/https?:/.test(kn) && !/zahlen Sie/.test(kn) && !/Monatsende/.test(kn), `Altvertrag ohne Rate bis zum Vertragsende: keine Zahlungsbitte — „${kurz(kn, 120)}“`);
  ok(/gilt zum Ende Ihres laufenden Abrechnungsmonats\./.test(ton.bausteinKuendigung({ kanal: "whatsapp", weg: "letzte_rate", jahresvertrag: false, heute: "29.09.", raten: [], nichtsMehr: false })), "… ohne Datum: „gilt zum Ende Ihres laufenden Abrechnungsmonats“, nie „Monatsende“");
  ok(/dem 11\.10\.2026/.test(ton.bausteinKuendigung({ kanal: "mail", weg: "letzte_rate", jahresvertrag: false, heute: "29.09.", raten: [], giltZum: "11.10.2026" })), "… giltZum auch als TT.MM.JJJJ");

  console.log("── A12. Abrechnungsmonat statt Kalendermonat (E-265, Recht 01.10.2026) ──");
  // AGB 04.07.2026 § 6: Frist 24 Stunden zum Ende des Abrechnungsmonats (Fälligkeit zu Fälligkeit). Raten jeweils am 28.
  const R28 = ["2026-07-28", "2026-08-28", "2026-09-28"];
  const am1 = abrechnungsmonat("2026-09-28T10:00:00+02:00", R28);
  ok(am1.von === "2026-09-28" && am1.bis === "2026-10-27" && am1.wirkTag === "2026-09-29" && am1.quelle === "raten", `Beispiel 1: Kündigung 28.09. → Abrechnungsmonat 28.09.–27.10., Ende 27.10. (${am1.von}–${am1.bis})`);
  const ap1 = ton.kuendigungRatenAufteilen([{ faellig: "2026-09-28" }, { faellig: "2026-10-28" }], { jahresvertrag: false, vertragsEnde: am1.bis });
  ok(ap1.zuZahlen.length === 1 && ap1.zuZahlen[0].faellig === "2026-09-28" && ap1.nachEnde.length === 1, "… Rate 28.09. geschuldet, Rate 28.10. entfällt");
  const am2 = abrechnungsmonat("2026-09-26T10:00:00+02:00", R28);
  ok(am2.von === "2026-08-28" && am2.bis === "2026-09-27" && am2.wirkTag === "2026-09-27", `Beispiel 2: Kündigung 26.09. (Frist läuft 27.09. ab) → Abrechnungsmonat 28.08.–27.09., Ende 27.09. (${am2.von}–${am2.bis})`);
  ok(ton.kuendigungRatenAufteilen([{ faellig: "2026-09-28" }], { jahresvertrag: false, vertragsEnde: am2.bis }).nachEnde.length === 1, "… Rate 28.09. entfällt");
  ok(abrechnungsmonat("2026-09-28T00:05:00+02:00", R28).bis === "2026-10-27" && abrechnungsmonat("2026-09-28T23:55:00+02:00", R28).bis === "2026-10-27", "12665: Kündigung AM Fälligkeitstag (00:05 oder 23:55) → die Rate dieses Tages ist geschuldet, Ende 27.10.");
  ok(abrechnungsmonat("2026-09-27T23:30:00+02:00", R28).bis === "2026-10-27", "Kündigung 27.09. 23:30 → 24-Stunden-Frist endet 28.09. 23:30 → Abrechnungsmonat 28.09.–27.10.");
  ok(abrechnungsmonat("2026-09-26T23:59:00+02:00", R28).bis === "2026-09-27" && abrechnungsmonat("2026-09-27T00:30:00+02:00", R28).bis === "2026-10-27", "… 26.09. 23:59 → Ende 27.09.; 27.09. 00:30 → Ende 27.10. (die Frist entscheidet, Berliner Zeit)");
  ok(abrechnungsmonat("2026-09-28T10:00:00+02:00", [new Date("2026-09-28T00:00:00Z"), "2026-08-28", null, "2026-07-28"]).bis === "2026-10-27", "… Fälligkeiten als Date, Text und null, unsortiert");
  ok(abrechnungsmonat("2026-12-15T10:00:00+01:00", ["2026-07-28"]).von === "2026-11-28" && abrechnungsmonat("2026-12-15T10:00:00+01:00", ["2026-07-28"]).bis === "2026-12-27", "Kette endet früh: monatlich weitergezählt → 28.11.–27.12.");
  const am31 = abrechnungsmonat("2026-03-01T10:00:00+01:00", ["2026-01-31", "2026-02-28"]);
  ok(am31.von === "2026-02-28" && am31.bis === "2026-03-30", `Monatsgrenze 31./28.: Anker 31.01., Kündigung 01.03. → 28.02.–30.03. (der 31. bleibt der Anker) (${am31.von}–${am31.bis})`);
  const am30 = abrechnungsmonat("2026-10-05T10:00:00+02:00", ["2026-08-31", "2026-09-30"]);
  ok(am30.von === "2026-09-30" && am30.bis === "2026-10-30", `Monatsgrenze 30./31.: Raten 31.08., 30.09. → Kündigung 05.10. → 30.09.–30.10. (${am30.von}–${am30.bis})`);
  const amFeb = abrechnungsmonat("2027-02-10T10:00:00+01:00", ["2026-12-30", "2027-01-30"]);
  ok(amFeb.von === "2027-01-30" && amFeb.bis === "2027-02-27", `Februar: Raten am 30. → Kündigung 10.02.2027 → 30.01.–27.02. (28.02. gekappt) (${amFeb.von}–${amFeb.bis})`);
  const amAnker = abrechnungsmonat("2026-09-20T10:00:00+02:00", [], { anker: "2026-07-05" });
  ok(amAnker.von === "2026-09-05" && amAnker.bis === "2026-10-04" && amAnker.quelle === "anker", `ohne Ratenkette: Anker (erste Zahlung 05.07.) in Monatsschritten → 05.09.–04.10. (${amAnker.von}–${amAnker.bis})`);
  const amKal = abrechnungsmonat("2026-09-30T23:30:00+02:00", []);
  ok(amKal.von === "2026-10-01" && amKal.bis === "2026-10-31" && amKal.quelle === "kalendermonat", `ohne Kette und Anker: Kalendermonat der ablaufenden Frist (${amKal.von}–${amKal.bis})`);
  ok(abrechnungsmonat("2026-07-01T10:00:00+02:00", R28).bis === "2026-08-27", "vor der ersten Fälligkeit: der erste Abrechnungsmonat (28.07.–27.08.)");
  ok(giltZumSatz("2026-10-27") === "gilt zum Ende Ihres laufenden Abrechnungsmonats, dem 27.10.2026" && giltZumSatz(null) === "gilt zum Ende Ihres laufenden Abrechnungsmonats", "giltZumSatz: der eine Kundensatz, mit und ohne Datum");
  // Jahresvertrag unverändert: kein Abrechnungsmonat, Kulanz verlangt nur fällige Raten.
  const apj = ton.kuendigungRatenAufteilen([{ faellig: "2026-09-28" }, { faellig: "2026-10-28" }], { jahresvertrag: true, vertragsEnde: null, heute: "2026-09-29" });
  ok(apj.zuZahlen.length === 1 && apj.nachEnde.length === 1 && istJahresvertrag("2026-09-10"), "Jahresvertrag unverändert: fällige Rate bleibt (Kulanz), die noch nicht fällige entfällt — kein Abrechnungsmonat");
  const akAlt = ton.bausteinKuendigung({ kanal: "whatsapp", weg: "letzte_rate", jahresvertrag: false, heute: "28.09.", raten: [{ vom: "28.09.", betrag: "59,99 €", cents: 5999 }], link: LINK, giltZum: am1.bis });
  ok(/Ihre Kündigung ist heute, am 28\.09\., bei uns eingegangen und gilt zum Ende Ihres laufenden Abrechnungsmonats, dem 27\.10\.2026\./.test(akAlt) && /Rate vom 28\.09\. über 59,99 € zahlen Sie bitte noch, danach kommt nichts mehr/.test(akAlt) && !/Monatsende|Kulanz/.test(akAlt), `Kundensatz Altvertrag: „${kurz(akAlt, 160)}“`);
  const akJ = ton.bausteinKuendigung({ kanal: "whatsapp", weg: "letzte_rate", jahresvertrag: true, heute: "28.09.", raten: [{ vom: "28.09.", betrag: "99,99 €", cents: 9999 }], link: LINK, giltZum: am1.bis });
  ok(!/Abrechnungsmonat|Monatsende/.test(akJ) && /Kulanz/.test(akJ), "Kundensatz Jahresvertrag: kein Abrechnungsmonat, Justins Kulanz-Satz");
  const aks1 = pmw.kuendigungSatz("letzte_rate", [{ nr: 3, cents: 5999, faellig: "28.09.2026" }], { formlos: true, endeTag: "2026-10-27" });
  ok(/die Kündigung gilt zum Ende Ihres laufenden Abrechnungsmonats, dem 27\.10\.2026\./.test(aks1) && !/Monatsende/.test(aks1), `Postfach-Werkzeugsatz: „${kurz(aks1, 140)}“`);
  ok(/gilt zum Ende Ihres laufenden Abrechnungsmonats, dem 27\.09\.2026; es ist keine Rate mehr offen/.test(pmw.kuendigungSatz("sofort_beendet", [], { formlos: true, endeTag: "2026-09-27" })), "… „nichts mehr zu zahlen“ mit Datum");
  ok(!/Abrechnungsmonat/.test(pmw.kuendigungSatz("letzte_rate", [{ nr: 2, cents: 9999, faellig: "28.09.2026" }], { formlos: false })), "… Jahresvertrag ohne Abrechnungsmonat");
  ok(!/Monatsende|laufenden Monats/.test(ton.KUENDIGUNG_REGEL_TEXT.replace(/nie „Monatsende“ oder „Ende des Kalendermonats“/g, "")) && /Abrechnungsmonat/.test(ton.KUENDIGUNG_REGEL_TEXT), "Regeltext im Auftrag: Abrechnungsmonat, nie „Monatsende“ (außer als Verbot)");
  const kb = ton.bausteinKuendigung({ kanal: "mail", weg: "bereits", beendet: true, jahresvertrag: false, heute: "29.09." });
  ok(!/heute/.test(kb) && !/anders überlegen/.test(kb) && /lag uns schon vor/.test(kb), `r9: „bereits“ + beendet — nie „heute eingegangen“ — „${kb}“`);
  const k1 = ton.bausteinKuendigung({ kanal: "whatsapp", weg: "letzte_rate", jahresvertrag: false, heute: "29.09.", raten: [R2[0]], link: LINK });
  ok(!/Erledigt/.test(k1) && /Visa-Kreditkarte später doch möchten/.test(k1) && k1.endsWith(LINK), "Kündigung: ohne „Erledigt:“, mit offener Tür zur Karte, Formel und Link am Ende");
  ok(!/zahlen Sie|https?:/.test(ton.bausteinKuendigung({ kanal: "whatsapp", weg: "letzte_rate", jahresvertrag: true, heute: "29.09.", raten: [R2[0]], link: LINK, ohneZahlung: true })), "„kann nicht zahlen“/Widerruf: nur der Stand, keine Zahlungsbitte");
  ok(!istJahresvertrag(new Date("2026-08-15")) && istJahresvertrag(new Date("2026-09-03")) && istJahresvertrag("2026-09-26") && !istJahresvertrag(null) && !istJahresvertrag(new Date(2026, 8, 2)) && istJahresvertrag(new Date(2026, 8, 3)), "istJahresvertrag: Date und Text über den Berliner Tag (nie String(Date) >= „2026-09-03“)");

  console.log("── A11. Karte, A-Formel, Nähe, keine Karte ──────────────────────────");
  const A = ton.bausteinAbschluss({ kanal: "whatsapp", art: "a", ziel: ZIEL, betrag: "7,99 €", mit: fl, zeit: "heute um 15:40 Uhr" });
  ok(/Link unserer Partnerbank für Konto und Karte/.test(A) && !/Link unserer Partnerbank für Ihre Visa-Kreditkarte/.test(A) && !hartIds(A).length, `A: der Link gilt Konto und Karte, die Kreditkarte bleibt Ziel — „${kurz(A, 140)}“`);
  const AB = ton.bausteinAbschluss({ kanal: "whatsapp", art: "abbrecher", ziel: ZIEL, mit: ds, zeit: "heute um 15:30 Uhr", link: "https://fiaon.com/a/P265wandxx/w" });
  ok(!/nur noch/.test(AB) && /nächster Schritt/.test(AB), `Abbrecher: „Ihr nächster Schritt … ist Ihr Antrag“ statt „nur noch einen Schritt“ — „${kurz(AB, 100)}“`);
  for (const t of ["Ihre Visa-Kreditkarte ist nur noch einen Schritt entfernt.", "Ihre Karte ist greifbar.", "Dazu fehlt nur noch die offene Rechnung."]) ok(ton.tonPruefung(t, { kanal: "mail" }).some((b) => b.id === "naehe_druck"), `naehe_druck (weich): „${t}“`);
  const C = ton.bausteinAbschluss({ kanal: "whatsapp", art: "c", mit: nb, zeit: "heute um 15:30 Uhr", link: "https://fiaon.com/a/P265wandxx/w" });
  ok(/\?\s*$/.test(C) && !ton.abschlussPruefung(C, { art: "c", kunde: "Ich würde gerne mehr über Ihr Unternehmen erfahren" }).some((h) => /Frage/.test(h)), `C endet mit einer Frage — „${kurz(C.slice(-90), 90)}“`);
  const KK = ton.bausteinKeineKarte({ kanal: "whatsapp", betrag: "59,99 €", rateVom: "12.09.", ziel: ZIEL, link: LINK, einladungRaus: true, mit: fl });
  ok(!/Das liegt daran/.test(KK) && /Bei Ihnen ist noch Ihre Rate vom 12\.09\./.test(KK) && !/ohne Pause/.test(KK), `zahlender Kunde mit Einladung: keine falsche Ursache — „${kurz(KK, 100)}“`);
  ok(/Das liegt daran, dass bei Ihnen noch eine Zahlung offen ist/.test(ton.bausteinKeineKarte({ kanal: "whatsapp", betrag: "99,99 €", erste: true, link: LINK })), "… bei der ERSTEN Monatsrate bleibt Justins Satz");
  const RATE = ton.bausteinAbschluss({ kanal: "whatsapp", art: "rate", ziel: ZIEL, betrag: "79,99 €", rateVom: "13.09.", mit: ds, link: LINK });
  ok(!/ohne Pause/.test(RATE) && /Ihre Rate vom 13\.09\./.test(RATE), "Rate: ohne „läuft Ihr Weg ohne Pause weiter“");
  ok(!/für Ihre eigene Visa-Kreditkarte —/.test(ton.bausteinVorkasse({ betrag: "99,99 €", ziel: ZIEL, mit: ds, jahresvertrag: true })) && !/zwölf/.test(ton.bausteinVorkasse({ betrag: "59,99 €", mit: ds, jahresvertrag: false })), "Vorkasse: die Rate ist für das Paket, nicht „für Ihre eigene Visa-Kreditkarte“; „zwölf“ nur beim Jahresvertrag");
  const WI = ton.bausteinWasIstFiaon({ kanal: "whatsapp", stufe: "kunde", ziel: ZIEL, betreuer: ds });
  ok(/^FIAON bringt Sie zu Ihrer eigenen Visa-Kreditkarte, bei Ihnen mit Ihrem Wunschlimit/.test(WI) && !/Konto und Karte[^.]*Wunschlimit/.test(WI), "Was ist FIAON: das Wunschlimit gehört zur Kreditkarte, nicht zu „Konto und Karte“");

  console.log("── A11. Verkauf: Einwand, Wiederholung, Einstieg ────────────────────");
  const F01 = "Zuerst die Zahlung dann , zahle ich gerne weiter!";
  ok(ton.einwandSignal(F01) && ton.einwandVertrauen(F01), "f01: „zuerst die Zahlung“ ist ein Vorkasse-Einwand");
  ok(ton.abschlussPruefung("Genau: Mit Ihrer ersten Monatsrate über 99,99 € wird Ihr Account aktiv. Passt Ihnen heute um 15:30 Uhr?", { art: "b", kunde: F01, ziel: ZIEL, betrag: "99,99 €" }).some((h) => /Genau/.test(h)), "f01: „Genau:“ als Einstieg auf einen Einwand fällt (weich)");
  ok(wa.sichererSatz({ kunde: F01, aktionen: [], stufe: "zahlung_offen", abschluss: "ABSCHLUSS" }) !== "ABSCHLUSS", "sichererSatz: ein Einwand ist nie das Kaufsignal für die feste Formel");
  const VK = ton.bausteinVorkasse({ betrag: "99,99 €", ziel: ZIEL, mit: ds, zeit: "heute um 15:30 Uhr", link: LINK, jahresvertrag: true });
  ok(/Passt Ihnen heute um 15:30 Uhr ein Anruf mit Herrn Stripling, bevor Sie etwas überweisen\?/.test(VK) && /Sie überweisen selbst, abgebucht wird nichts/.test(VK) && VK.length <= 500, `Vorkasse: der Anruf OHNE Bedingung, „Sie überweisen selbst“ — ${VK.length} Zeichen`);
  ok(!ton.abschlussPruefung(VK, { art: "b", kunde: "Nein danke habe ich gesagt ich zahle nichts vor ok", ziel: ZIEL, betrag: "99,99 €" }).length, "… erfüllt die Abschlussprüfung beim Einwand");
  ok(!ton.abschlussPruefung("Richtig, und Sie überweisen jede Rate selbst, abgebucht wird nichts. Passt Ihnen heute um 15:30 Uhr für den Anruf mit Herrn Stripling?", { art: "b", kunde: "Und wird dann was abgebucht? Ich zahle nicht vorab", ziel: ZIEL, betrag: "99,99 €", letzteDu: [formel] }).length, "zweiter Einwand: stand die Formel gerade da, keine Wiederholungspflicht");
  const F05 = "Mir wurde gesagt das sie kein Kreditinstitut sind sondern nur die Bonität prüfen? Und seit wann muss man für einen Kredit in Vorkasse bezahlen das hört sich sehr unseriös an ?";
  const VK5 = ton.bausteinVorkasse({ betrag: "99,99 €", ziel: ZIEL, mit: fl, zeit: "heute um 15:40 Uhr", link: LINK, jahresvertrag: true, kreditFrage: ton.fragtKreditinstitut(F05) });
  ok(ton.fragtKreditinstitut(F05) && /^Verstehe ich — und FIAON ist tatsächlich keine Bank/.test(VK5) && !ton.tonPruefung(VK5, { kanal: "whatsapp", mitarbeiter: TEAM }).some((b) => b.schwere === "hart" || b.id === "kredit_nein") && VK5.length <= 500, `f05: der erste Satz beantwortet „kein Kreditinstitut?“ — ${VK5.length} Zeichen`);
  ok(ton.abschlussPruefung("Bei uns kommen Sie zu Ihrer Visa-Kreditkarte mit Ihrem Wunschlimit von 25.000 € — über den Rahmen entscheidet unsere Partnerbank. Passt Ihnen heute um 15:30 Uhr?", { art: "b", kunde: "Nein danke, ich zahle nichts vor", ziel: ZIEL, betrag: "99,99 €", vorher: "Hier ist Mara, die digitale Assistentin von FIAON — ich verstehe Sie, wenn Sie nichts vorab zahlen möchten. Herr Stripling klärt das." }).some((h) => /Einstieg/.test(h)), "V4: der zugewandte Einstieg des ersten Entwurfs darf nicht verloren gehen");
  ok(ton.kaufSignal("Ich überweise heute") && wa.meldetZahlung("Ich habe überwiesen") && wa.meldetZahlung("Habe gestern überwiesen") && !wa.meldetZahlung("Wann habe ich überwiesen?"), "r5: „überweise/überwiesen“ trotz Umlaut erkannt");
  ok(nm.mitarbeiterVornameFunde("Daniels Kalender ist heute voll. Florentines Team meldet sich morgen. Ich habe Nikitas Nummer weitergegeben.", TEAM).filter((f) => f.schwere === "hart").length === 3, "Genitiv: „Daniels“, „Florentines“, „Nikitas“ sind harte Vornamen");
  ok(nm.vornamenErsetzen("Herr Daniel ruft Sie morgen an.", TEAM) === "Herr Stripling ruft Sie morgen an." && nm.vornamenErsetzen("Frau Florentine begleitet Sie.", TEAM) === "Frau Lombardi begleitet Sie." && nm.vornamenErsetzen("Daniels Kalender ist voll.", TEAM) === "Herrn Striplings Kalender ist voll.", "Reparatur: nie „Herr Herr Stripling“, Genitiv „Herrn Striplings“");
  ok(wa.rueckfallSatz({ nom: "Nikita Boychenko", dat: "Nikita Boychenko" }).split("Nikita Boychenko").length === 2, "Rückfallsatz: die Nennform einmal (f18)");
  const AU = wa.maraAuftrag({
    name: "Prüf Kunde", wer: "Prüf Kunde", lage: "Antrag fertig", ziel: "Er zahlt die erste Rate.", link: LINK, verkaufen: true,
    gedaechtnis: "", verlauf: "", wissen: "", hausanweisung: "", werkzeuge: true, betreuer: ds, fester: ds, jetzt: "Dienstag", stufe: "zahlung_offen",
    einwandMuster: { vorkasse: VK, zuTeuer: ton.bausteinZuTeuerKarte({ paketKey: "ultra", zielEuro: 15000 }) },
  });
  ok(AU.includes(VK) && AU.includes("FIAON Ultra") && !AU.includes("begleitet Sie Schritt für Schritt zu Konto und Karte."), "V1: der Auftrag zeigt die Einwand-Muster aus SEINER Lage (nie mehr bausteinVorabZahlen/bausteinZuTeuer)");
  ok(/EINE Zeit/.test(AU) && /EINMAL je Nachricht/.test(AU), "Auftrag: im Abschluss EINE Zeit; den Kollegen einmal je Nachricht nennen");
  ok(!!ton.stornoUngefragt("Ja, der Vertrag wurde am 11. August angenommen; bei Ihnen gilt monatliche Kündigung zum Ende des laufenden Monats.", "Habe ich einen Vertrag unterschrieben?") && !ton.stornoUngefragt("Ihr Vertrag läuft zwölf Monate und ist danach monatlich kündbar.", "Wie lange läuft mein Vertrag?"), "stornoUngefragt: Frage nach der Laufzeit ist die Ausnahme, #1395 bleibt ein Treffer");

  // ═════════════════════════════════════════════════════════════════════════
  // A12. SCHLUSS-NACHBESSERUNG (01.10.2026) — die Befunde der Echt-Probe 3 als Gegenproben
  // ═════════════════════════════════════════════════════════════════════════
  console.log("── A12. Schluss-Nachbesserung: Echt-Probe 3 ─────────────────────────");
  const { wissenFakten } = await import("../shared/fiaon-wissen");
  // A — Justins Formel in EINEM Satz (Semikolon): die Entwürfe #53/#54 dürfen nicht mehr als Zusage fallen
  const E53 = "Verstehe ich — Sie möchten erst Sicherheit, bevor Sie überweisen. Bei uns kommen Sie zu Ihrer eigenen Visa-Kreditkarte mit Ihrem Wunschlimit von 25.000 € — über den Rahmen entscheidet unsere Partnerbank; die 99,99 € sind die erste Monatsrate, und sobald sie gebucht ist, schaltet das System Sie frei. Passt Ihnen heute um 10:30 Uhr ein Anruf mit Herrn Stripling, bevor Sie etwas überweisen?";
  const E54 = "Verstehe ich — Sie möchten erst Sicherheit, bevor Sie überweisen. Bei uns kommen Sie zu Ihrer Visa-Kreditkarte mit Ihrem Wunschlimit von 25.000 € als Ziel — über den Rahmen entscheidet unsere Partnerbank; die 99,99 € sind die erste Monatsrate, und sobald sie gebucht ist, schaltet das System Sie frei. Passt Ihnen heute um 10:30 Uhr ein Anruf mit Herrn Stripling, bevor Sie etwas überweisen?";
  const JF = "Bei uns kommen Sie zu Ihrer Visa-Kreditkarte mit Ihrem Wunschlimit von 25.000 € — über den Rahmen entscheidet unsere Partnerbank —, begleichen Sie bitte die offene Rate, dann schaltet das System Sie direkt frei, und ich vereinbare den Termin mit Herrn Stripling, okay?";
  for (const [n, t] of [["f01 Entwurf #53", E53], ["f01 Entwurf #54", E54], ["Justins Gedächtnis-Formel", JF]] as const) {
    ok(!ton.limitPruefen(t).length && !hartIds(t).some((id) => id.startsWith("limit")), `A: ${n} mit Semikolon ist keine Zusage (${ton.limitPruefen(t).map((f) => f.art).join(",") || "frei"})`);
  }
  for (const t of [
    "Mit Ihrem Wunschlimit von 25.000 € — über den Rahmen entscheidet unsere Partnerbank; sobald Sie zahlen, ist Ihr Rahmen freigeschaltet.",
    "Ihr Wunschlimit von 25.000 € — über den Rahmen entscheidet unsere Partnerbank; sobald die Rate gebucht ist, schaltet das System Ihr Wunschlimit frei.",
    "Mit Ihrer Zahlung schalten Sie Ihr Wunschlimit von 15.000 € frei — über den Rahmen entscheidet unsere Partnerbank.",
  ]) ok(ton.limitZusage(t) !== null, `A: bleibt eine Zusage: „${kurz(t, 90)}“`);
  ok(/dann ein PUNKT/.test(ton.KARTE_REGEL_TEXT) && /ein PUNKT, der Betrag beginnt einen neuen Satz/.test(ton.TON_REGELN.find((r) => r.id === "limit_zusage")!.hinweis), "A: Auftrag und Hinweis zeigen die Formel mit Punkt nach dem Bank-Satz");

  // 1 — f11: keine Vertragsmail
  const F11P3 = "Hier ist Mara, die digitale Assistentin von FIAON — ja, Ihr Vertrag wurde am 13. August abgeschlossen; Vertrag und Rechnung kamen damals per E-Mail. Ihre Visa-Kreditkarte bleibt das Ziel, und Herr Stripling kann Ihnen die Unterlagen noch einmal schicken. Soll ich ihm dafür Bescheid geben?";
  ok(hartIds(F11P3).includes("vertrag_mail"), "f11 (Probe 3): „Vertrag und Rechnung kamen damals per E-Mail“ ist hart (vertrag_mail)");
  for (const t of ["Sie haben Ihren Vertrag per E-Mail bekommen.", "Per E-Mail haben wir Ihnen den Vertrag zugeschickt.", "Ihre Vertragsunterlagen sind per E-Mail an Sie gegangen."]) ok(ton.vertragPerMail(t) !== null, `f11: hart: „${t}“`);
  for (const t of ["Ihre Vertragsunterlagen lasse ich Ihnen gern schicken.", "Ihr Vertrag ist per E-Mail kündbar.", "Ihr Vertrag ist gekündigt, die Bestätigung kommt per E-Mail.", "Die Rechnung kam per E-Mail."]) ok(ton.vertragPerMail(t) === null, `f11: frei: „${t}“`);
  ok(!/Vertrag und Rechnung kamen per E-Mail|Vertrag und Rechnung bekommen Sie schriftlich/.test(AU) && /Vertragsunterlagen lasse ich Ihnen gern schicken/.test(AU), "f11: der Auftrag behauptet keine Vertragsmail mehr und bietet an, die Unterlagen schicken zu lassen");

  // 2 — M3: Kündigung nie an die Zahlung gebunden
  const M3P3 = "Danke, die Überweisungsquittung über 59,99 € ist bei der Zahlungsstelle zur Prüfung. Ihre Kündigung vom 6. September liegt vor, und Rate 3 ist die letzte Rate. Sobald der Eingang gebucht ist, wird das Kündigungsschreiben der FIAON LTD automatisch verschickt.";
  ok(ton.tonPruefung(M3P3, { kanal: "mail", mitarbeiter: TEAM }).some((b) => b.id === "kuendigung_an_zahlung" && b.schwere === "hart"), "M3 (Probe 3): „Sobald der Eingang gebucht ist, wird das Kündigungsschreiben … verschickt“ ist hart");
  for (const t of ["Ihre Kündigung wird wirksam, sobald die Zahlung eingegangen ist.", "Nach Ihrer Zahlung bestätigen wir Ihnen die Kündigung schriftlich."]) ok(ton.kuendigungAnZahlung(t) !== null, `M3: hart: „${t}“`);
  for (const t of [
    ton.bausteinKuendigung({ kanal: "whatsapp", weg: "letzte_rate", jahresvertrag: true, heute: "01.10.", rateVom: "28.09.", betrag: "59,99 €", link: LINK, bestaetigung: true }),
    ton.bausteinKuendigung({ kanal: "mail", weg: "letzte_rate", jahresvertrag: false, heute: "01.10.", rateVom: "15.09.", betrag: "79,99 €", bestaetigung: true }),
    ton.bausteinKuendigung({ kanal: "whatsapp", weg: "bereits", jahresvertrag: false, heute: "01.10." }),
  ]) ok(ton.kuendigungAnZahlung(t) === null, `M3: Justins Sätze bleiben frei — „${kurz(t, 80)}“`);

  // G — f17: die Storno-Form für unbezahlte Bestellungen
  ok(ton.jaAufKuendigungsAngebot("Ja", ton.bausteinKuendigungRueckfrage({ unbezahlt: true })) && ton.verbindlicheRueckfrage(ton.STORNO_RUECKFRAGE) === "storno", "f17: ein „Ja“ auf die wörtliche Storno-Rückfrage zählt");
  ok(hp("Verstanden, dann dränge ich Sie nicht weiter. Möchten Sie, dass ich Ihre Bestellung storniere?", "Danke kein Interesse mehr", { unbezahlt: true, kuendigungThema: true }).some((f) => f.includes(ton.STORNO_RUECKFRAGE)), "f17: eine freie Storno-Frage fällt und verlangt die wörtliche Form");
  ok(!hp(`Verstanden, dann dränge ich Sie nicht weiter. ${ton.STORNO_RUECKFRAGE}`, "Danke kein Interesse mehr", { unbezahlt: true, kuendigungThema: true }).length, "f17: die wörtliche Storno-Form geht durch");
  ok(hp(`Verstanden. ${ton.KUENDIGUNG_RUECKFRAGE}`, "Danke kein Interesse mehr", { unbezahlt: true, kuendigungThema: true }).some((f) => /nichts zu kündigen/.test(f)), "f17: „Kündigung“ bei einer unbezahlten Bestellung fällt");
  ok(hp(`Verstanden. ${ton.STORNO_RUECKFRAGE}`, "Ich möchte kündigen", { unbezahlt: false, kuendigungThema: true }).some((f) => /bezahlten Vertrag/.test(f)), "… und „stornieren“ bei einem bezahlten Vertrag auch");
  ok(hp(`Bei Ihnen gilt die Kündigung zum Monatsende. ${ton.KUENDIGUNG_RUECKFRAGE}`, "Wie lange ist eigentlich die Kündigungsfrist bei mir?", { kuendigung: "frage", kuendigungThema: true }).some((f) => /Frist oder Folgen/.test(f)), "k04: auf die Frist-Frage keine Rückfrage zur Kündigung");

  // H — k03: verneinte Kündigung + Zahlungsankündigung
  const K03 = "Ich will nich kündigen!! hab die rate nur vergessen, mach ich heute abend";
  ok(ton.kaufSignal(K03) && wa.nurVerneinteKuendigung(K03, pmw.keinKuendigungsSatz), "k03: „mach ich heute abend“ ist ein Kaufsignal, die Kündigung nur verneint");
  ok(!hp(`Alles gut, ich halte fest: Sie zahlen heute Abend. Ihre Rate vom 12.09. über 59,99 €: ${LINK}`, K03, { kuendigung: "zurueck", kuendigungVerneint: true }).length, "k03: wer nicht kündigt und zahlen will, bekommt seine Zahlungsseite");
  ok(hp(`Hier ist Ihre Zahlungsseite: ${LINK}`, "Ich kündige hiermit meinen Vertrag").length > 0 && !wa.nurVerneinteKuendigung("Ich will nicht kündigen, ich widerrufe", pmw.keinKuendigungsSatz), "… eine echte Kündigung oder ein Widerruf bleibt ohne Zahlungsseite");
  ok(!ton.kaufSignal("mach ich heute abend") && !ton.kaufSignal("Ich mache heute Abend Sport"), "… ohne Rate/Zahlung im Text kein Kaufsignal");

  // B — die Längenregel frisst die Formel nicht mehr
  const VS = "Hier ist Mara, die digitale Assistentin von FIAON — ";
  const L03 = "mit 20.000 € als Ziel für Ihre Visa-Kreditkarte sind Sie bei uns richtig; über den Rahmen entscheidet unsere Partnerbank. Die erste Monatsrate beträgt 99,99 €, und sobald sie gebucht ist, schaltet das System Sie frei. Nach der Zusage der Bank ist die Karte in der Regel in 2–5 Werktagen bei Ihnen, meist vorher in der App nutzbar. Passt Ihnen heute um 12:50 Uhr ein Anruf mit Frau Lombardi?";
  const vk = (t: string) => wa.verkaufsPruefung(t, { kunde: "Brauche 20'000 CHF, geht das?", letzteDu: [], verkaufen: true });
  ok((VS + L03).length > 420 && L03.length <= 420 && !vk(VS + L03).some((h) => /Zu lang/.test(h)), `l03: der Vorspann zählt nicht mit (${(VS + L03).length} → ${L03.length} Zeichen)`);
  ok(vk(VS + L03 + " " + L03).some((h) => /nie Karte, Ziel mit Bank-Satz, Betrag/.test(h)), "… zu lang: der Hinweis kürzt den Einstieg, nie die Formel");
  const zielCH = ton.kartenZiel({ wunschEuro: 20000, rahmenEuro: 25000, paketKey: "highend" });
  const kurzL03 = "Mit 20.000 € als Ziel für Ihre Visa-Kreditkarte sind Sie richtig — über den Rahmen entscheidet unsere Partnerbank. Passt Ihnen heute um 12:50 Uhr ein Anruf mit Frau Lombardi?";
  ok(wa.formelVerloren(L03, kurzL03, ["Zu lang für seine kurze Nachricht (425 Zeichen) — zwei bis drei Sätze."], { ziel: zielCH, betrag: "99,99 €" }).join(",") === "Betrag,Freischaltung", "l03: Entwurf 2 verlor Betrag und Freischaltung → Entwurf 1 gilt");
  ok(!wa.formelVerloren(L03, kurzL03, ["Nicht auf Deutsch — schreib die ganze Antwort auf Deutsch."], { ziel: zielCH, betrag: "99,99 €" }).length, "… nur bei einem reinen Längen-Hinweis");

  // C — f04: Preis-Einwand
  ok(!wa.kannNichtZahlen("Ich bezahle nicht 99 Euro für eine Karte") && ton.einwandSignal("Ich bezahle nicht 99 Euro für eine Karte"), "f04: „Ich bezahle nicht 99 Euro für eine Karte“ ist ein Preis-Einwand, kein „kann nicht zahlen“");
  ok(wa.kannNichtZahlen("Ich kann nicht zahlen") && wa.kannNichtZahlen("Ich zahle nicht 99 Euro, ich habe kein Geld") && wa.kannNichtZahlen("Ich zahle nichts mehr"), "… „kann nicht zahlen“ / „kein Geld“ bleiben");

  // D — f06: die bestätigte Zeit
  const ANG_AM = new Date("2026-10-01T07:40:00Z");
  const ANG = { text: "Sehr gern — Justin Schwarzott kann Sie heute um 10:20 Uhr anrufen. Passt Ihnen das?", am: ANG_AM };
  const b1 = wa.angeboteneZeitBestaetigt("Heute .10:20?", ANG);
  ok(b1?.zeit === "10:20" && b1?.datum === "2026-10-01" && wa.angeboteneZeitBestaetigt("Ok", ANG)?.zeit === "10:20" && wa.angeboteneZeitBestaetigt("Ja passt", ANG)?.zeit === "10:20", `f06: „Heute .10:20?“ / „Ok“ / „Ja passt“ bestätigen die angebotene Zeit (${b1?.datum} ${b1?.zeit})`);
  ok(!wa.angeboteneZeitBestaetigt("Morgen 10:20?", ANG) && !wa.angeboteneZeitBestaetigt("Lieber um 11 Uhr", ANG) && !wa.angeboteneZeitBestaetigt("Nein, heute nicht", ANG)
    && !wa.angeboteneZeitBestaetigt("Ja", { text: "Soll ich Ihnen den Link schicken?", am: ANG_AM }) && !wa.angeboteneZeitBestaetigt("Ja", { text: "Passt Ihnen heute um 10:20 Uhr oder um 15 Uhr ein Anruf?", am: ANG_AM }), "f06: anderer Tag, andere Zeit, Nein, keine Terminfrage oder zwei Zeiten → nichts gebucht");
  ok(wa.angeboteneZeitBestaetigt("Ja", { text: "Herr Stripling kann Sie morgen um 9:30 Uhr anrufen. Passt Ihnen das?", am: ANG_AM })?.datum === "2026-10-02", "f06: „morgen“ zählt ab Maras Nachricht");

  // E — f16: kein Herkunftssatz ohne Bestreiten
  const F16 = "Bitte keinen Kontakt mehr…habe mich dagegen entschieden…. Begründung: bat um Bedenkzeit da ich derzeit keinen freien Kopf dafür habe und es wird einfach weiter gespamt";
  ok(ton.kenntUns(F16) && !ton.kenntUns("Lassen Sie mich in Ruhe!!") && !ton.kenntUns("Ich habe nie etwas beantragt"), "f16: er kennt uns („habe mich dagegen entschieden“), ein knappes „in Ruhe“ nicht");
  const IR = ton.bausteinAbstreiten({ kanal: "whatsapp", art: "in_ruhe", herkunft: { art: "antrag", am: "2026-09-27T10:00:00Z" }, abgeschickt: false, kenntUns: ton.kenntUns(F16) });
  ok(!/eingetragen|deshalb haben wir|gespeichert/.test(IR) && /Entschuldigen Sie bitte die Störung/.test(IR) && /nicht mehr/.test(IR) && ton.nachAbstreiten(IR), `f16: „keinen Kontakt mehr“ ohne Herkunftssatz — „${kurz(IR, 110)}“`);
  ok(/eingetragen/.test(ton.bausteinAbstreiten({ kanal: "whatsapp", art: "bestreitet", herkunft: { art: "antrag", am: "2026-09-27T10:00:00Z" } })) && /eingetragen/.test(ton.bausteinAbstreiten({ kanal: "whatsapp", art: "in_ruhe", herkunft: { art: "antrag", am: "2026-09-27T10:00:00Z" } })), "… beim Bestreiten und beim knappen „in Ruhe“ (E-264) bleibt die Herkunft");

  // I — l01/l02: Limit-Fragen
  for (const t of ["Bekomme ich die 25.000 dann auch sicher wenn ich zahle?", "Wie hoch ist eigentlich mein Limit auf der Karte?", "Brauche 20'000 CHF, geht das? Wann habe ich das Geld?", "Welches Limit bekomme ich?"]) ok(ton.fragtLimit(t), `Limit-Frage: „${t}“`);
  for (const t of ["Wie lange dauert das?", "Ich zahle heute", "Was kostet das?"]) ok(!ton.fragtLimit(t), `keine Limit-Frage: „${t}“`);
  const LF = ton.bausteinLimitFrage({ kanal: "whatsapp", ziel: ZIEL, mit: ds, zeit: "heute um 10:30 Uhr", betrag: "99,99 €", link: LINK });
  ok(/^Für Ihre Visa-Kreditkarte ist Ihr Wunschlimit von 25\.000 € unser Ziel — über den Rahmen entscheidet unsere Partnerbank\. /.test(LF) && !hartIds(LF).length && !sendePruefung(LF).length && LF.endsWith(LINK) && /Herrn Stripling\?/.test(LF), `l01: fester Baustein — Karte, Ziel, Bank, Betrag, Termin, Link (${LF.length} Zeichen)`);
  const LF2 = ton.bausteinLimitFrage({ kanal: "whatsapp", ziel: ton.kartenZiel({ wunschEuro: 11000, rahmenEuro: 15000, paketKey: "ultra" })!, mit: ds });
  ok(/11\.000 €/.test(LF2) && /\?$/.test(LF2) && !hartIds(LF2).length && !LF2.includes("https://"), `l02: „Wie hoch?“ → die Zahl, die Frage mit Nennform — „${kurz(LF2, 120)}“`);
  const LF3 = ton.bausteinLimitFrage({ kanal: "whatsapp", ziel: ton.kartenZiel({ wunschEuro: 20000, rahmenEuro: 15000, paketKey: "ultra" })!, mit: fl, zeit: "heute um 12:50 Uhr" });
  ok(!hartIds(LF3).length && /15\.000 € als Ziel/.test(LF3), `Paket-Ziel: auch über der Paketgrenze frei — „${kurz(LF3, 100)}“`);

  // Probe 4 (echtes Modell, 01.10.2026): l02 — die umgestellte Form ohne Zahl ist frei; der sichere Satz ist die feste Antwort
  const L02P4 = "für Ihre Visa-Kreditkarte ist Ihr Wunschlimit aus dem Antrag unser Ziel; über den Rahmen entscheidet unsere Partnerbank. Herr Stripling kann mit Ihnen den nächsten Schritt durchgehen: Welche Zeit passt Ihnen für einen Anruf?";
  ok(!ton.limitPruefen(L02P4).length && ton.limitZusage("Sicher ist Ihr Wunschlimit von 25.000 € unser Ziel.") !== null, "l02 (Probe 4): „ist Ihr Wunschlimit aus dem Antrag unser Ziel“ ist frei — „Sicher ist …“ bleibt Zusage");
  ok(wa.sichererSatz({ kunde: "Wie hoch ist eigentlich mein Limit auf der Karte?", aktionen: [], stufe: "kunde", limitFrage: LF2 }) === LF2, "l02: fällt jeder Entwurf, ist die feste Limit-Antwort der sichere Satz");
  // Probe 4 f05: die weiche 500-Zeichen-Grenze ohne den Vorspann
  const F05P4 = "Hier ist Mara, die digitale Assistentin von FIAON — " + "x".repeat(455) + ".";
  ok(!ton.tonPruefung(F05P4, { kanal: "whatsapp" }).some((b) => b.id === "laenge") && ton.tonPruefung("y".repeat(510), { kanal: "whatsapp" }).some((b) => b.id === "laenge"), "f05 (Probe 4): der Vorspann zählt auch für die weiche 500er-Grenze nicht mit");

  // J — Mails: Abschluss als weiche Pflicht, nichts Unbelegtes erklären
  ok(ton.mailAbschlussPflicht("Gern, Ihre Fragen zu FIAON klären wir persönlich. Bei uns geht es um Ihren Weg zur eigenen Visa-Kreditkarte.", { betrag: "59.99" }).length === 3, "M1: ohne Betrag, Freischaltung und Terminfrage → drei weiche Hinweise");
  ok(!ton.mailAbschlussPflicht(ton.bausteinAbschluss({ kanal: "mail", art: "b", ziel: ZIEL, betrag: "59,99 €", verwendungszweck: "FIAON-P265M1", mit: ds }), { betrag: "59.99" }).length, "… Justins Mail-Formel erfüllt alles");
  ok(ton.mailAbschlussPflicht("With FIAON, you are moving toward your own Visa credit card. The €99.99 is your first monthly instalment.", { betrag: "99.99" }).length === 2, "M6: englisch ohne Freischaltung und ohne Terminfrage → zwei Hinweise");
  ok(!ton.mailAbschlussPflicht("The €99.99 is your first monthly instalment; once it is booked, the system activates your account. Which time suits you for a short call with Mr Stripling?", { betrag: "99.99" }).length, "… englisch mit beidem frei");
  ok(ton.mailWeichBefunde("Das verstehe ich gut. Die 2 bis 3 Arbeitstage betreffen die Bankprüfung nach vollständiger Einreichung. Es tut mir leid, dass es sich zieht.", { wissen: wissenFakten() }).length >= 2, "M4: unbelegte Frist und doppeltes Mitgefühl (weich)");
  ok(!ton.mailWeichBefunde("Nach der Zusage der Bank ist die Karte in der Regel in 2–5 Werktagen bei Ihnen.", { wissen: wissenFakten() }).length, "… die Frist aus dem Hauswissen bleibt frei");

  // K — die gescheiterte Bestätigungsmail gilt nicht mehr als gesendet
  const kSrc = readFileSync("server/routes/fiaon-kuendigung.ts", "utf8");
  ok(/if \(!erg\?\.ok\) return false;/.test(kSrc) && !/if \(erg === false\)/.test(kSrc), "K: bestaetigungSenden prüft { ok } — eine gescheiterte Mail setzt kuendigung_bestaetigt_mail_am nicht");
}

// ═══════════════════════════════════════════════════════════════════════════
// B-MAIL. FÜNF MAIL-FÄLLE (rein): Knopf, Formel, Ton, Vertreter
// ═══════════════════════════════════════════════════════════════════════════
if (!NUR || NUR === "mail") {
  console.log("\n── B-Mail. Fünf Mail-Fälle (rein) ───────────────────────────────────");
  const ZAHL = "https://fiaon.com/zahlung/FIAON-P265M1";
  const TERMIN = "https://fiaon.com/termin/P265M";
  const wz = { zahlungslink_bauen: { zahlungsseite: ZAHL }, terminlink_bauen: { terminlink: TERMIN } };
  const vertreter = nm.nennform({ anrede: null, first_name: "Justin", last_name: "Schwarzott" });
  const tpm = (t: string) => ton.tonPruefung(t, { kanal: "mail", land: "DE", kunde: "", mitarbeiter: TEAM }).filter((b) => b.schwere === "hart");
  // M1 #5786 (P11679): B Pro, 5.000 €, „erreiche Frau Lombardi nicht, Fragen zu Ihrer Firma" — Team abwesend
  {
    const ziel = ton.kartenZiel({ wunschEuro: 5000, rahmenEuro: PACK_LIMITS.pro, paketKey: "pro" });
    const t = `${ton.bausteinWasIstFiaon({ kanal: "mail", stufe: "zahlung_offen", ziel, betreuer: nm.nennform({ anrede: "Frau", first_name: "Florentine", last_name: "Lombardi" }) })}\n\n${ton.bausteinAbschluss({ kanal: "mail", art: "b", ziel, betrag: "59,99 €", verwendungszweck: "FIAON-P265M1", mit: vertreter })}`;
    ok(!tpm(t).length && /Kreditkarte/.test(t) && t.includes("5.000 €") && ton.BANK_SATZ_MUSTER.test(t) && t.includes("59,99 €") && t.includes("FIAON-P265M1") && !t.includes("https://"), "M1: Kurzantwort + Formel (Karte, 5.000 €, Bank, 59,99 €, Verwendungszweck, kein Link im Text)");
    ok(t.includes("Justin Schwarzott") && !/Lombardi\s+(?:meldet|ruft|klärt)/.test(t), "M1: Termin beim Vertreter (Justin Schwarzott), keine Zusage für die Abwesende");
    ok(tpm("Gern, Florentine meldet sich heute bei Ihnen und klärt Ihre Fragen zu FIAON.").length > 0, "M1: der alte Satz mit „Florentine“ fällt hart");
    const s = pm.schrittBestimmen({ naechster_schritt: { art: "zahlung", text: "Rechnung ansehen und bezahlen" } }, "unbezahlt" as any, wz);
    ok(s.schritt?.art === "zahlung" && s.schritt?.url === ZAHL, "M1: B behält den Zahlknopf (seine Zahlungsseite)");
  }
  // M2 #5773 (P12303): A mit Beleg — kein Zahlknopf, Karte + 25.000 €
  {
    const s = pm.schrittBestimmen({ naechster_schritt: { art: "zahlung", text: "Rechnung ansehen und bezahlen" } }, "zahlung_gemeldet" as any, wz, false, { gemeldet: true });
    ok(s.schritt?.art === "termin" && s.schritt?.url === TERMIN, `M2: gemeldet → Knopf „Termin“ statt Zahlknopf (ist: ${s.schritt?.art})`);
    const s2 = pm.schrittBestimmen({ naechster_schritt: { art: "zahlung", text: "Rechnung ansehen" } }, "zahlung_gemeldet" as any, { zahlungslink_bauen: { zahlungsseite: ZAHL } }, false, { gemeldet: true });
    ok(s2.schritt?.art === "bereich", `M2: ohne Terminlink → sein Bereich (ist: ${s2.schritt?.art})`);
    const t = ton.bausteinAbschluss({ kanal: "mail", art: "a", ziel: ton.kartenZiel({ wunschEuro: 25000, rahmenEuro: PACK_LIMITS.highend, paketKey: "highend" }), betrag: "99,99 €", mit: nm.nennform({ anrede: "Herr", first_name: "Daniel", last_name: "Stripling" }) });
    ok(!tpm(t).length && /Kreditkarte/.test(t) && t.includes("25.000 €") && !/begleichen|überweisen|zahlungsseite/i.test(t) && t.includes("Herrn Stripling"), "M2: A-Formel — Danke, Karte, 25.000 €, Termin mit Herrn Stripling, keine Zahlungsbitte");
  }
  // M3 #5779 (P7815): gekündigt + Beleg — Bestätigung, kein Zahlknopf
  {
    const s = pm.schrittBestimmen({ naechster_schritt: { art: "zahlung", text: "Rechnung ansehen und bezahlen" } }, "gekuendigt" as any, wz, false, { ruhe: true });
    ok(s.schritt?.art !== "zahlung", `M3: nach Kündigung kein Zahlknopf (ist: ${s.schritt?.art})`);
    const t = ton.bausteinKuendigung({ kanal: "mail", weg: "bereits", jahresvertrag: false, heute: "29.09.", bestaetigung: true });
    ok(/liegt uns schon vor/.test(t) && !/kulanz/i.test(t) && !t.includes("https://") && !tpm(t).length, "M3: „Ihre Kündigung liegt uns schon vor“, kein Kulanz, kein Link");
  }
  // M4 #5666 (P3507): Beschwerde seit 26.06. (Karte/PIN) — kein Zahlknopf, Stand der Karte + Termin
  {
    const s = pm.schrittBestimmen({ naechster_schritt: { art: "zahlung", text: "Rechnung ansehen und bezahlen" } }, "rate_ueberfaellig" as any, wz, false, { ruhe: true });
    ok(s.schritt?.art === "termin" && s.schritt?.url === TERMIN, `M4: Beschwerde → Knopf „Termin“ (ist: ${s.schritt?.art})`);
    const t = "Das verstehe ich, und es tut mir leid, dass es sich so zieht. Ihr Link zu Konto und Kreditkarte unserer Partnerbank liegt seit 19.09. bei Ihnen — Ihr Antrag läuft mit Ihrem Wunschlimit von 25.000 €, über den Rahmen entscheidet unsere Partnerbank. Ich vereinbare Ihren Termin mit Herrn Stripling, in dem er den Kartenantrag Schritt für Schritt mit Ihnen fertig macht.";
    ok(!tpm(t).length && ton.limitOhneBank(t) === null, "M4: die bessere Antwort (Stand der Karte, Wunschlimit mit Bank, Herr Stripling) geht durch");
  }
  // M5 #5739 (P12295): „Bitte löschen Sie meine Mail Adresse" — Löschwunsch, keine Abwesende
  {
    ok(ton.istLoeschwunsch("Bitte löschen Sie meine Mail Adresse"), "M5: als Löschwunsch erkannt (Aufgabe an die Leitung / das Board, E-264)");
    ok(tpm("Florentine kümmert sich morgen um die Löschung der gespeicherten E-Mail-Adresse.").length > 0, "M5: der alte Satz mit „Florentine“ fällt hart");
    const t = ton.bausteinAbstreiten({ kanal: "mail", art: "falsche_nummer", herkunft: null });
    ok(!hartName(t).length && !/meldet sich morgen|kümmert sich morgen/.test(t), "M5: fester Satz ohne Namen und ohne Zusage für morgen");
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// B. ECHTE WHATSAPP-FÄLLE GEGEN DIE TEST-DB
// ═══════════════════════════════════════════════════════════════════════════
type Schritt = { id: string; bis: number; attrappe?: Plan; pruef: Record<string, any> };
type Fall = {
  id: string; titel: string; quelle: string; nummer: string; abwesenheit?: boolean;
  person: { betreuer: number | null; land: string; werbesperre?: boolean };
  antrag: null | { status: string; payment_status: string; schritt: number; paket: string | null; wunsch: number | null; agb: string | null; angelegt_tage: number; approved?: number };
  raten?: { nr: number; cents: number; faellig_tage: number; status: "offen" | "bezahlt" }[];
  karte?: { tage: number };
  termine?: { agent: number; min_nach_bis: number; status: string }[];
  verlauf: { id: number; am: string; richtung: "rein" | "raus"; vorlage: string | null; von: string | null; knopf: string | null; typ: string; text: string }[];
  schritte: Schritt[];
};
const ORDNER = ".pruef/mara-abschluss";
const faelle: Fall[] = existsSync(ORDNER)
  ? readdirSync(ORDNER).filter((f) => f.endsWith(".json")).sort().flatMap((f) => JSON.parse(readFileSync(`${ORDNER}/${f}`, "utf8")) as Fall[])
    .filter((f) => !NUR || NUR === "b" || f.id === NUR)
  : [];
if (!faelle.length && (!NUR || NUR === "b" || /^f\d/.test(NUR))) console.log(`\n(keine Fälle in ${ORDNER} — Teil B übersprungen)`);
if (NUR === "a" || NUR === "mail") faelle.length = 0;

const START = new Date();
const EINSTELLUNGEN = ["ki_pause", "mara_wa_an", "mara_wa_tag_euro", abw.ABWESENHEIT_SCHLUESSEL];
const einstellungVorher = (await sql`SELECT key, value FROM fiaon_settings WHERE key = ANY(${EINSTELLUNGEN})`.catch(() => [])) as any[];
const PERSONEN: number[] = [];
const LEADS: number[] = [];
const REFS: string[] = [];
const NUMMERN: string[] = [];
const ERGEBNIS: { fall: string; schritt: string; hart: boolean; alle: boolean; fehlt: string[] }[] = [];
const TEAM_IDS = [8, 10, 13, 505, 531];
const VERTRETER = 928;

async function aufraeumen(): Promise<void> {
  for (const n of NUMMERN) {
    await sql`DELETE FROM fiaon_whatsapp WHERE nummer = ${n}`.catch(() => {});
    await sql`DELETE FROM fiaon_whatsapp_gespraech WHERE nummer = ${n}`.catch(() => {});
    await sql`DELETE FROM fiaon_mara_protokoll WHERE nummer = ${n}`.catch(() => {});
  }
  if (PERSONEN.length) {
    await sql`DELETE FROM fiaon_betreiber_todos WHERE schluessel ~ ${`^wa-(${PERSONEN.join("|")})-`} OR schluessel LIKE 'wa-n4915900265%'`.catch(() => {});
    // E-265 Nachbesserung: die Prüffälle des Kündigungswerkzeugs (Rate nach Vertragsende, Rate trotz Ende).
    await sql`DELETE FROM fiaon_betreiber_todos WHERE schluessel LIKE 'whatsapp:kuendigung-%' AND schluessel LIKE '%FIAON-P265%'`.catch(() => {});
    await sql`DELETE FROM fiaon_mara_protokoll WHERE person_id = ANY(${PERSONEN})`.catch(() => {});
    await sql`DELETE FROM fiaon_termine WHERE person_id = ANY(${PERSONEN})`.catch(() => {});
    await sql`DELETE FROM fiaon_contact_log WHERE person_id = ANY(${PERSONEN}) OR ref = ANY(${REFS.length ? REFS : ["-"]})`.catch(() => {});
    await sql`DELETE FROM fiaon_kurzlinks WHERE person_id = ANY(${PERSONEN}) OR lead_id = ANY(${LEADS.length ? LEADS : [0]})`.catch(() => {});
    await sql`DELETE FROM fiaon_abo_raten WHERE ref = ANY(${REFS.length ? REFS : ["-"]})`.catch(() => {});
    await sql`DELETE FROM fiaon_konto_karte WHERE person_id = ANY(${PERSONEN})`.catch(() => {});
    await sql`DELETE FROM cancellation_requests WHERE ref = ANY(${REFS.length ? REFS : ["-"]})`.catch(() => {});
    await sql`DELETE FROM fiaon_applications WHERE ref = ANY(${REFS.length ? REFS : ["-"]})`.catch(() => {});
    await sql`DELETE FROM fiaon_leads WHERE id = ANY(${LEADS.length ? LEADS : [0]})`.catch(() => {});
    await sql`DELETE FROM fiaon_mara_gedaechtnis WHERE person_id = ANY(${PERSONEN})`.catch(() => {});
    await sql`DELETE FROM fiaon_persons WHERE id = ANY(${PERSONEN})`.catch(() => {});
  }
}

/** Die Nennform eines echten Kontos der Test-DB (nur gelesen). */
async function nennVon(id: number) {
  const [a] = (await sql`SELECT name, first_name, last_name, anrede FROM fiaon_agents WHERE id = ${id}`) as any[];
  return nm.nennform(a);
}

/** Soll-Merkmale (Bauplan 6.1) — liefert die fehlenden. */
function merkmale(antwort: string, pr: Record<string, any>, ctx: {
  zahlRef: string; rateRef: string | null; kundeNamen: string[]; abwesende: { nom: string; dat: string }[];
  terminGebucht: { beginn: Date; agentId: number } | null; terminUhr: string | null;
}): string[] {
  const fehlt: string[] = [];
  const a = antwort;
  const ohneLink = a.replace(/https?:\/\/\S+/g, "").trim();
  const formel = /aus\s+kulanz\s+gerne\s+aus\s+dem\s+vertrag|danach\s+kommt\s+nichts\s+mehr/i.test(a);
  for (const m of pr.merkmale ?? []) {
    if (m === "N") {
      const f = nm.mitarbeiterVornameFunde(a, TEAM, { kundeNamen: ctx.kundeNamen });
      if (f.length) fehlt.push(`N: ${f.map((x) => `${x.treffer} (${x.schwere})`).join(", ")}`);
      // E-265 Schluss-Nachbesserung (Probe 3 f10): „mit Herrn Stripling" ist dieselbe Nennform im Dativ.
      if (pr.nenn && !(pr.nenn as string[]).some((n) => a.includes(n) || a.includes(n.replace(/^Herr\s/, "Herrn ")))) fehlt.push(`N: keine der Nennformen ${pr.nenn.join("/")}`);
      if (pr.ohne_anrede && /\b(?:er|ihn|ihm)\b/.test(a)) fehlt.push("N: Pronomen für einen Mitarbeiter ohne Anrede");
    }
    if (m === "K" && !/kreditkarte/i.test(a)) fehlt.push("K: „Kreditkarte“ fehlt");
    if (m === "L") {
      if (pr.ziel && !a.includes(pr.ziel)) fehlt.push(`L: Ziel ${pr.ziel} fehlt`);
      if (pr.ziel && !ton.BANK_SATZ_MUSTER.test(a)) fehlt.push("L: Bank-Satz fehlt");
      if (ton.limitOhneBank(a)) fehlt.push("L: Wunschlimit ohne Bank-Satz");
      if (/\b(?:bekommen|erhalten)\s+sie\s+(?:bei\s+uns\s+)?(?:auch\s+)?(?:ihre|eine|die)\s+(?:eigene\s+)?(?:visa-?)?(?:kredit)?karte\b(?![\s\S]{0,60}\b(?:zusage|entscheidet)\b)|\bsie\s+bekommen\s+[\d.]+\s*€/i.test(a)) fehlt.push("L: Karte oder Betrag als Zusage");
    }
    if (m === "Z") {
      if (pr.betrag && !a.includes(pr.betrag)) fehlt.push(`Z: Betrag ${pr.betrag} fehlt`);
      if (pr.link === "zahlung" && !a.includes(`/zahlung/${ctx.zahlRef}`)) fehlt.push("Z: seine Zahlungsseite fehlt");
      if (pr.link === "rate" && !(ctx.rateRef && a.includes(`/zahlung/${ctx.rateRef}`))) fehlt.push("Z: die Zahlungsseite seiner Rate fehlt");
      if (pr.link === "antrag" && !/fiaon\.com\/a\/[A-Za-z0-9]+\/w/.test(a)) fehlt.push("Z: sein Antragslink fehlt");
      if (pr.link === "keiner" && /https?:\/\//.test(a)) fehlt.push("Z: Link, obwohl keiner hingehört");
      if (pr.art === "a" && (/\/zahlung\//.test(a) || /\bbitte\s+(?:be)?(?:gleichen|zahlen|überweisen)|\b(?:begleichen|überweisen|bezahlen)\s+sie\b/i.test(a))) fehlt.push("Z: A bekommt eine Zahlungsbitte");
      if (pr.ohne_rate && (/\d+,\d{2}\s*€/.test(a) || /\/zahlung\//.test(a))) fehlt.push("Z: Betrag/Zahlungsseite ohne abgeschickten Antrag");
    }
    if (m === "T") {
      const frage = /\?\s*$/.test(ohneLink) && (!pr.nenn || (pr.nenn as string[]).some((n) => a.includes(n) || a.includes(n.replace(/^Herr\s/, "Herrn "))));
      const gebucht = !!ctx.terminGebucht && ton.uhrzeitenIn(a).includes(hhmm(ctx.terminGebucht.beginn));
      if (!frage && !gebucht) fehlt.push("T: weder Abschlussfrage mit Nennform noch gebuchter Termin");
      if (pr.termin_uhr && !(ctx.terminUhr && ton.uhrzeitenIn(a).includes(ctx.terminUhr))) fehlt.push(`T: Uhrzeit des Kalendertermins ${ctx.terminUhr} fehlt`);
    }
    if (m === "R") {
      // E-265 Schluss-Nachbesserung (Probe 3 k04): nur eine ZAHLUNGSSEITE zählt — der Login-Link zu seinen Unterlagen nicht.
      if (/\/zahlung\//.test(a) && !formel) fehlt.push("R: Zahlungsseite nach Kündigung/Stopp/Widerruf ohne Formel");
      if (/begleichen|überweisen|zahlungsseite/i.test(a) && !formel) fehlt.push("R: Zahlungsbitte ohne Formel");
      if (pr.keine_kuendigung && /k(?:ü|ue)ndig/i.test(a)) fehlt.push("R: ungefragt über Kündigung");
    }
    // E-265 Nachbesserung (29.09.2026, Verkauf V1/V10): auch mit --ki geprüft — das Argument gegen die Vorkasse
    // (E), die Antwort auf „kein Kreditinstitut?" (B) und das kleinere Paket mit Ziel (P).
    if (m === "E" && !/(?:überweis\w*|zahlen)[^.!?]{0,30}\bselbst\b|abgebucht\s+wird\s+nichts|nichts\s+wird\s+abgebucht/i.test(a)) fehlt.push("E: Argument „Sie überweisen selbst, abgebucht wird nichts“ fehlt");
    if (m === "B" && !/\bkeine\s+bank\b|kein\w*\s+kreditinstitut|kein\w*\s+kredit(?:betrag)?\b/i.test(a)) fehlt.push("B: seine Frage „kein Kreditinstitut?“ bleibt unbeantwortet");
    if (m === "P" && !((pr.paket_kleiner ? a.includes(pr.paket_kleiner) : /FIAON\s+(?:Start|Pro|Ultra)/.test(a)) && /als\s+ziel/i.test(a))) fehlt.push(`P: das kleinere Paket (${pr.paket_kleiner ?? "?"}) mit seinem Ziel fehlt`);
    if (m === "V" && ctx.abwesende.length) {
      for (const n of ctx.abwesende) {
        const re = new RegExp(`${n.nom.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+(?:ruft|meldet|schaut|klärt|prüft|kümmert|geht)|(?:an|bei|mit)\\s+${n.dat.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+(?:weiter|Bescheid)`, "i");
        if (re.test(a)) fehlt.push(`V: Zusage für den Abwesenden ${n.nom}`);
      }
    }
  }
  return fehlt;
}

try {
  if (faelle.length) {
    await sql`DELETE FROM fiaon_settings WHERE key = ANY(${EINSTELLUNGEN})`;
    await sql`INSERT INTO fiaon_settings (key, value) VALUES ('mara_wa_an', 'an')`;
    kp.kiPauseZwischenspeicherLeeren();
    // Die Arbeitszeiten der echten Konten müssen da sein (nur gelesen) — sonst gibt es keine freien Zeiten.
    const zeiten = (await sql`SELECT agent_id, COUNT(*)::int AS n FROM fiaon_agent_verfuegbarkeit WHERE aktiv AND agent_id = ANY(${[...TEAM_IDS, VERTRETER]}) GROUP BY 1`) as any[];
    ok(zeiten.length >= 5, `Arbeitszeiten der Konten 8/10/13/505/928 in der Test-DB (${zeiten.map((z: any) => `${z.agent_id}:${z.n}`).join(" ")})`);
    // E-265 Nachbesserung (29.09.2026): Justins Konto 928 (Testkonto, aktive Leitung) steht IMMER in der Namensliste —
    // nicht nur während der Abwesenheit (ab Fr 02.10. sonst „Justin ruft Sie an" ungeprüft, Gründer-Termine E-124).
    await sql`DELETE FROM fiaon_settings WHERE key = ${abw.ABWESENHEIT_SCHLUESSEL}`;
    abw.abwesenheitVergessen();
    namen.mitarbeiterListeVergessen();
    const ohneAbwesenheit = await namen.mitarbeiterListe();
    ok(ohneAbwesenheit.some((m) => m.vorname === "Justin" && m.nachname === "Schwarzott"), "Namensliste ohne Abwesenheit: „Justin Schwarzott“ (Konto 928) ist drin");
    namen.mitarbeiterListeVergessen();
  }
  const abwesendeNenn = await Promise.all(TEAM_IDS.map((id) => nennVon(id).catch(() => null)));
  for (const fall of faelle) {
    console.log(`\n── ${KI ? "C" : "B"}. ${fall.id}: ${fall.titel}`);
    console.log(`   Quelle: ${fall.quelle}`);
    NUMMERN.push(fall.nummer);
    // ── Team abwesend (E-260)? Wie heute in der Produktion: alle außer Justin (928), bis in drei Tagen.
    await sql`DELETE FROM fiaon_settings WHERE key = ${abw.ABWESENHEIT_SCHLUESSEL}`;
    if (fall.abwesenheit) {
      const bis = new Date(Date.now() + 3 * 86_400_000);
      await sql`INSERT INTO fiaon_settings (key, value) VALUES (${abw.ABWESENHEIT_SCHLUESSEL}, ${JSON.stringify({ an: true, vertreterId: VERTRETER, bis: bis.toISOString(), fuer: [], gesetztVon: "pruef-e265", gesetztAm: new Date().toISOString(), verlauf: [] })})`;
    }
    abw.abwesenheitVergessen();
    namen.mitarbeiterListeVergessen();
    // ── Person, Lead, Antrag, Raten, Karte ──────────────────────────────────
    const ID = fall.id.toUpperCase();
    await sql`DELETE FROM fiaon_persons WHERE person_ref = ${`PRUEF265-${fall.id}`}`.catch(() => {});
    const [p] = (await sql`INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_email, country, assigned_agent_id)
      VALUES (${`PRUEF265-${fall.id}`}, 'Prüf', 'Kunde', ${`pruef265-${fall.id}@kunde.invalid`}, ${fall.person.land}, ${fall.person.betreuer}) RETURNING id`) as any[];
    const personId = Number(p.id);
    PERSONEN.push(personId);
    if (fall.person.werbesperre) await sql`UPDATE fiaon_persons SET werbung_gesperrt_am = NOW() WHERE id = ${personId}`;
    const code = `P265${fall.id}`.padEnd(10, "x").slice(0, 10);
    // Der Lead kam VOR dem Antrag (sonst gälte ein Gekündigter als „neu angefragt", erneutAngefragt).
    const leadAm = new Date(Date.now() + ((fall.antrag?.angelegt_tage ?? 0) - 1) * 86_400_000);
    const [l] = (await sql`INSERT INTO fiaon_leads (person_id, quelle, link_code, vorname, nachname, erstellt_am) VALUES (${personId}, 'meta', ${code}, 'Prüf', 'Kunde', ${leadAm}) RETURNING id`) as any[];
    const leadId = Number(l.id);
    LEADS.push(leadId);
    const ref = `FIAON-P265${ID}`;
    // E-265 Nachbesserung (29.09.2026, Verkauf): echte Referenzen haben 6 Zeichen (FIAON-XXXXXX-N) — mit „P265ZF11"
    // traf die Raten-Erkennung in lageFuer (/FIAON-?[A-Z0-9]{6}-\d{1,2}/) nie, und f10–f14 liefen am echten Weg vorbei.
    const zahlRef = `FIAON-${`P5${ID}`.padEnd(6, "X").slice(0, 6)}`;
    let rateRef: string | null = null;
    let angelegt: Date | null = null;
    if (fall.antrag) {
      REFS.push(ref);
      const a = fall.antrag;
      angelegt = new Date(Date.now() + a.angelegt_tage * 86_400_000);
      const bezahlt = a.payment_status === "paid";
      await sql`DELETE FROM fiaon_applications WHERE ref = ${ref}`.catch(() => {});
      await sql`INSERT INTO fiaon_applications (ref, payment_reference, person_id, status, payment_status, current_step, pack_key, ist_entwurf, agb_stand, created_at, user_agent,
                  wanted_limit, approved_limit, paid_at, email, first_name, last_name)
        VALUES (${ref}, ${zahlRef}, ${personId}, ${a.status}, ${a.payment_status}, ${a.schritt}, ${a.paket}, FALSE, ${a.agb}, ${angelegt}, 'Mozilla/5.0 (Prüfstand E-265)',
                ${a.wunsch}, ${a.approved ?? null}, ${bezahlt ? angelegt : null}, ${`pruef265-${fall.id}@kunde.invalid`}, 'Prüf', 'Kunde')`;
      for (const r of fall.raten ?? []) {
        const f = berlinIso(new Date(Date.now() + r.faellig_tage * 86_400_000));
        const rr = `${zahlRef}-${r.nr}`;
        await sql`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status, bezahlt_am)
          VALUES (${ref}, ${r.nr}, ${rr}, ${r.cents}, ${f}, ${r.status}, ${r.status === "bezahlt" ? new Date(Date.now() + r.faellig_tage * 86_400_000) : null})`;
        if (r.status === "offen" && r.faellig_tage <= 0 && !rateRef) rateRef = rr;
      }
    }
    if (fall.karte) await sql`INSERT INTO fiaon_konto_karte (person_id, agent_id, gesendet_am, status) VALUES (${personId}, ${fall.person.betreuer}, ${new Date(Date.now() + fall.karte.tage * 86_400_000)}, 'gesendet')`;
    const neu: Record<string, string> = {};

    for (const schritt of fall.schritte) {
      const ziel = fall.verlauf.find((z) => z.id === schritt.bis);
      if (!ziel) { ok(false, `${schritt.id}: Nachricht ${schritt.bis} fehlt im Fall`); continue; }
      const jetzt = Date.now();
      const shift = jetzt - 20_000 - new Date(ziel.am).getTime();
      await sql`DELETE FROM fiaon_whatsapp WHERE nummer = ${fall.nummer}`;
      await sql`DELETE FROM fiaon_whatsapp_gespraech WHERE nummer = ${fall.nummer}`.catch(() => {});
      await sql`DELETE FROM fiaon_termine WHERE person_id = ${personId}`;
      await sql`UPDATE fiaon_persons SET promised_payment_date = NULL WHERE id = ${personId}`;
      // Termine zum Zeitpunkt der Nachricht (relativ zu ihr, gleich weit verschoben)
      let terminBeginn: Date | null = null;
      for (const t of fall.termine ?? []) {
        const beginn = new Date(new Date(ziel.am).getTime() + shift + t.min_nach_bis * 60_000);
        await sql`INSERT INTO fiaon_termine (person_id, agent_id, beginn, status, quelle, herkunft, storno_token, abgesagt_am)
          VALUES (${personId}, ${t.agent}, ${beginn}, ${t.status}, 'agent_manuell', 'agent', ${`p265-${fall.id}-${schritt.id}-${t.min_nach_bis}`}, ${t.status === "abgesagt" ? new Date(jetzt - 13 * 86_400_000) : null})`;
        if (t.status === "gebucht") terminBeginn = beginn;
      }
      // Die Lage und der nächste freie Platz (wie maraAntwortet ihn sieht) — für Platzhalter und Prüfungen
      const lageJetzt = await wa.maraLage(personId, leadId, null).catch(() => null);
      const ang = await mt.freieZeiten(personId).catch(() => null);
      const s0 = ang?.slots?.[0] ?? null;
      const s0Beginn = s0 ? new Date(s0.beginn) : null;
      const s0Text = s0Beginn ? ton.zeitFuerKunde(s0Beginn) : "";
      const mit = s0 ? ton.nennAus(s0.agentVorname) : null;
      const tagWort = s0Beginn ? (berlinIso(s0Beginn) === berlinIso(new Date()) ? "Heute" : berlinIso(s0Beginn) === berlinIso(new Date(Date.now() + 86_400_000)) ? "Morgen" : s0Beginn.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", weekday: "long" })) : "";
      const platz: Record<string, string> = {
        LINK: lageJetzt?.link ?? "",
        ZAHLREF: zahlRef, RATENREF: rateRef ?? zahlRef,
        SLOT1_TEXT: s0Text, SLOT1_FRAGE: s0Text.replace(/^am\s+/, ""), SLOT1_ZEIT: s0 ? `${s0.datum} ${s0.uhrzeit}` : "",
        SLOT1_KUNDE: s0 ? `${tagWort} .${Number(s0.uhrzeit.slice(0, 2))}:${s0.uhrzeit.slice(3)}` : "",
        MIT_NOM: mit?.nom ?? "", MIT_DAT: mit?.dat ?? "",
        MORGEN: berlinIso(new Date(jetzt + 86_400_000)),
        VERTRAG_DATUM: angelegt ? angelegt.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "numeric", month: "long" }) : "",
        ZU_TEUER_PRO: ton.bausteinZuTeuerKarte({ paketKey: "pro", zielEuro: PACK_LIMITS.pro }),
        VORKASSE: ton.bausteinVorkasse({ betrag: lageJetzt?.zahlung?.betrag ?? lageJetzt?.ersteRate ?? null, ziel: lageJetzt?.kartenziel ?? null, mit: mit ? { nom: mit.nom, dat: mit.dat } : null, zeit: s0Text || null, link: lageJetzt?.link ?? null }),
        WIDERRUF: ton.bausteinWiderruf(),
        // E-265 Nachbesserung: Maras EINE Rückfrage (f12 — „Bitte tun sie das" auf ein Angebot ohne Frage bucht nicht mehr).
        KUENDIGUNG_FRAGE: ton.bausteinKuendigungFrage({ kanal: "whatsapp", ziel: lageJetzt?.kartenziel ?? null }),
        // E-265 Nachbesserung 2 (01.10.2026): Schritt 1 einer klaren Kündigung — nur die verbindliche Rückfrage.
        // E-265 Schluss-Nachbesserung: bei einer UNBEZAHLTEN Bestellung die Storno-Form (f17).
        KUENDIGUNG_RUECKFRAGE: ton.bausteinKuendigungRueckfrage({ unbezahlt: fall.antrag?.payment_status !== "paid" }),
        ...Object.fromEntries(Object.entries(neu).map(([k, v]) => [`NEU_${k}`, v])),
      };
      ersetzen = (t, extra = {}) => String(t).replace(/\{([A-Z_0-9a-z]+)\}/g, (m, k) => (k in extra ? extra[k] : k in platz ? platz[k] : m));
      const idKarte = new Map<number, number>();
      const zielMs = new Date(ziel.am).getTime();
      for (const z of fall.verlauf) {
        // Bis zu seiner Nachricht: früher, oder in derselben Minute mit kleinerer Nummer.
        const ms = new Date(z.am).getTime();
        if (ms > zielMs || (ms === zielMs && z.id > schritt.bis)) continue;
        const am = new Date(new Date(z.am).getTime() + shift);
        const [r] = (await sql`
          INSERT INTO fiaon_whatsapp (richtung, nummer, typ, text, status, vorlage, von, knopf, person_id, lead_id, empfangen_am, gesendet_am, created_at)
          VALUES (${z.richtung}, ${fall.nummer}, ${z.typ === "vorlage" ? "vorlage" : z.typ ?? "text"}, ${ersetzen(z.text)}, ${z.richtung === "rein" ? "empfangen" : "read"}, ${z.vorlage ?? null}, ${z.von ?? null}, ${z.knopf ?? null},
                  ${personId}, ${leadId}, ${z.richtung === "rein" ? am : null}, ${z.richtung === "raus" ? am : null}, ${am})
          RETURNING id`) as any[];
        idKarte.set(z.id, Number(r.id));
      }
      plan = schritt.attrappe ?? null;
      const aufrufeVorher = OPENAI.length;
      const protVorher = new Date(Date.now() - 1000);
      namen.mitarbeiterListeVergessen();
      abw.abwesenheitVergessen();
      const erg = await wa.maraAntwortet(fall.nummer);
      const [g] = (await sql`SELECT antwort_text FROM fiaon_whatsapp_gespraech WHERE nummer = ${fall.nummer}`.catch(() => [])) as any[];
      await sql`UPDATE fiaon_whatsapp_gespraech SET antwort_text = NULL, antwort_faellig_am = NULL WHERE nummer = ${fall.nummer}`.catch(() => {});
      const antwort = String(g?.antwort_text ?? "");
      neu[schritt.id] = antwort;
      const prot = (await sql`SELECT art, text FROM fiaon_mara_protokoll WHERE (nummer = ${fall.nummer} OR person_id = ${personId}) AND am >= ${protVorher} ORDER BY id`.catch(() => [])) as any[];
      const aufrufe = OPENAI.slice(aufrufeVorher);
      const kundeText = fall.verlauf.filter((z) => z.id <= schritt.bis && z.richtung === "rein").slice(-2).map((z) => ersetzen(z.text)).join(" / ");
      const altText = ersetzen(schritt.attrappe?.antworten?.[0] ?? "");
      console.log(`   ${schritt.id}  Kunde: „${kurz(kundeText, 140)}“`);
      console.log(`       ALT:  „${kurz(altText, 220)}“`);
      console.log(`       NEU:  ${antwort ? `„${kurz(antwort, 400)}“` : `(schweigt — ${erg.grund})`}`);
      const pr = schritt.pruef ?? {};
      const [gebuchtRow] = (await sql`SELECT beginn, agent_id FROM fiaon_termine WHERE person_id = ${personId} AND status = 'gebucht' AND herkunft = 'mara_whatsapp' ORDER BY id DESC LIMIT 1`.catch(() => [])) as any[];
      const ctx = {
        zahlRef, rateRef, kundeNamen: ["Prüf Kunde", "Prüf", "Kunde"],
        abwesende: fall.abwesenheit ? abwesendeNenn.filter(Boolean).map((n) => ({ nom: n!.nom, dat: n!.dat })) : [],
        terminGebucht: gebuchtRow ? { beginn: new Date(gebuchtRow.beginn), agentId: Number(gebuchtRow.agent_id) } : null,
        terminUhr: terminBeginn ? hhmm(terminBeginn) : null,
      };
      const fehltM = antwort ? merkmale(antwort, pr, ctx) : ["keine Antwort"];
      // E-265 Schluss-Nachbesserung (01.10.2026, Probe 3 f17/s2): H — die Handlung — auch mit --ki. Ein klares „Ja", das
      // nichts storniert, oder ein bestätigter Termin, der nicht im Kalender steht, ist ein fehlendes Soll-Merkmal.
      if (KI) {
        const [ak] = (await sql`SELECT gekuendigt_am, payment_status FROM fiaon_applications WHERE ref = ${ref}`.catch(() => [])) as any[];
        if (pr.storno) {
          const offenH = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_abo_raten WHERE ref = ${ref} AND status = 'offen' AND storniert_am IS NULL`) as any[];
          if (!(["cancelled", "superseded", "refunded"].includes(String(ak?.payment_status)) || !!ak?.gekuendigt_am) || Number(offenH[0].n) > 0) fehltM.push(`H: Storno nicht gebucht (${ak?.payment_status})`);
        }
        if (pr.kuendigung && !(ak?.gekuendigt_am && prot.some((x: any) => x.art === "kuendigung"))) fehltM.push("H: Kündigung nicht gebucht");
        if (pr.keine_buchung && (ak?.gekuendigt_am || prot.some((x: any) => x.art === "kuendigung"))) fehltM.push("H: gebucht, obwohl nichts gebucht werden durfte");
        if (pr.termin_gebucht && !(ctx.terminGebucht && ctx.terminGebucht.agentId === pr.termin_gebucht.agent)) fehltM.push(`H: Termin nicht im Kalender bei #${pr.termin_gebucht.agent}`);
        if (pr.zahltag) {
          const [pz] = (await sql`SELECT promised_payment_date FROM fiaon_persons WHERE id = ${personId}`) as any[];
          if (!(pz?.promised_payment_date && berlinIso(new Date(pz.promised_payment_date)) === ersetzen(pr.zahltag))) fehltM.push("H: Zahltag nicht festgehalten");
        }
        if (pr.werbesperre != null) {
          const [pw] = (await sql`SELECT werbung_gesperrt_am FROM fiaon_persons WHERE id = ${personId}`) as any[];
          if (!!pw?.werbung_gesperrt_am !== pr.werbesperre) fehltM.push(`H: Werbesperre ${pr.werbesperre ? "nicht gesetzt" : "gesetzt"}`);
        }
      }
      const hartTon = antwort ? ton.tonPruefung(antwort, { kanal: "whatsapp", land: fall.person.land as any, kunde: kundeText, mitarbeiter: TEAM, kundeNamen: ctx.kundeNamen }).filter((b) => b.schwere === "hart") : [];
      const wandHart = antwort ? sendePruefung(antwort, { namen: ctx.kundeNamen }) : [];
      ERGEBNIS.push({ fall: fall.id, schritt: schritt.id, hart: hartTon.length + wandHart.length > 0 || wa.istRueckfall(antwort), alle: !fehltM.length, fehlt: fehltM });
      if (KI) {
        ok(!!antwort, `${fall.id}/${schritt.id}: antwortet`);
        ok(!hartTon.length && !wandHart.length, `${fall.id}/${schritt.id}: ohne harten Mangel${hartTon.length || wandHart.length ? ` (${[...hartTon.map((b) => b.id), ...wandHart].join(" · ")})` : ""}`);
        if (fehltM.length) console.log(`       Merkmale fehlen: ${fehltM.join(" · ")}`);
        continue;
      }
      // ── Prüfungen mit der Attrappe ──────────────────────────────────────
      ok(pr.soll === "schweigen" ? !antwort : !!antwort, `${fall.id}/${schritt.id}: ${pr.soll}${antwort ? "" : ` (${erg.grund})`}`);
      if (!antwort) continue;
      ok(!hartTon.length && !wandHart.length, `${fall.id}/${schritt.id}: Ton und Wand ohne harten Treffer${hartTon.length || wandHart.length ? ` (${[...hartTon.map((b) => `${b.id}: ${b.treffer}`), ...wandHart].join(" · ")})` : ""}`);
      ok(!wa.istRueckfall(antwort) && !prot.some((x: any) => x.art === "rueckfall"), `${fall.id}/${schritt.id}: kein Rückfallsatz`);
      ok(!/\b20\d{2}-\d{2}-\d{2}\b/.test(antwort) && !ton.linkPruefung(antwort.replace(/[\w.+-]+@fiaon\.com/g, "")).some((f) => f.art === "nackt"), `${fall.id}/${schritt.id}: kein ISO-Datum, kein nackter Link`);
      ok(!fehltM.length, `${fall.id}/${schritt.id}: Soll-Merkmale ${(pr.merkmale ?? []).join(" ")}${fehltM.length ? ` — fehlt: ${fehltM.join(" · ")}` : ""}`);
      if (pr.zweiter) ok(aufrufe.some((x) => x.zweiter), `${fall.id}/${schritt.id}: Maras alte Antwort fiel durch (zweiter Entwurf)`);
      if (pr.ki_aufrufe != null) ok(aufrufe.length === pr.ki_aufrufe, `${fall.id}/${schritt.id}: ${pr.ki_aufrufe} KI-Aufruf(e) — fester Satz (${aufrufe.length})`);
      for (const e of pr.enthaelt ?? []) ok(antwort.includes(ersetzen(e)), `${fall.id}/${schritt.id}: enthält „${ersetzen(e)}“`);
      for (const e of pr.nicht_enthaelt ?? []) ok(!antwort.includes(ersetzen(e)), `${fall.id}/${schritt.id}: ohne „${ersetzen(e)}“`);
      // H — die Handlung ist wirklich geschehen
      if (pr.kuendigung) {
        const [a] = (await sql`SELECT gekuendigt_am, payment_status FROM fiaon_applications WHERE ref = ${ref}`) as any[];
        ok(!!a?.gekuendigt_am && prot.some((x: any) => x.art === "kuendigung"), `${fall.id}/${schritt.id}: H — Kündigung gebucht (gekuendigt_am) und im Protokoll`);
      }
      if (pr.keine_buchung) {
        // E-265 Nachbesserung (Recht): keine Kündigung aus einer Nicht-Erklärung — nichts gebucht, keine Urkunde.
        const [a] = (await sql`SELECT gekuendigt_am FROM fiaon_applications WHERE ref = ${ref}`) as any[];
        ok(!a?.gekuendigt_am && !prot.some((x: any) => x.art === "kuendigung"), `${fall.id}/${schritt.id}: H — NICHTS gebucht (kein gekuendigt_am, kein Protokoll „kuendigung“)`);
      }
      if (pr.kuendigung) {
        // E-265 Nachbesserung 2 (01.10.2026, EINE Rechnung): Altvertrag — eine Rate NACH dem Vertragsende (E-265 Recht:
        // Ende des Abrechnungsmonats, in dem die 24-Stunden-Frist abläuft — Fälligkeit zu Fälligkeit) entfällt mit der
        // Kündigung selbst (storno_grund „kuendigung“, Rücknahme holt sie zurück); kein Prüffall mehr, kein Text darüber.
        // Jahresvertrag — eine noch nicht fällige Rate entfällt mit der Kulanz.
        const ende = antragStand.abrechnungsmonatEnde(new Date(), (fall.raten ?? []).map((r) => berlinIso(new Date(Date.now() + r.faellig_tage * 86_400_000))));
        const spaeter = (fall.raten ?? []).filter((r) => r.status === "offen" && (fall.antrag?.agb
          ? r.faellig_tage > 0 : berlinIso(new Date(Date.now() + r.faellig_tage * 86_400_000)) > ende)).map((r) => r.nr);
        if (spaeter.length) {
          const st = (await sql`SELECT rate_nr, status, storno_grund FROM fiaon_abo_raten WHERE ref = ${ref} AND rate_nr = ANY(${spaeter})`) as any[];
          ok(st.length === spaeter.length && st.every((x: any) => x.status === "storniert" && x.storno_grund === "kuendigung"), `${fall.id}/${schritt.id}: Rate(n) ${spaeter.join(", ")} nach dem Vertragsende entfallen (${st.map((x: any) => `${x.rate_nr}:${x.status}/${x.storno_grund ?? "-"}`).join(", ")})`);
          const t = (await sql`SELECT schluessel FROM fiaon_betreiber_todos WHERE schluessel = ${`whatsapp:kuendigung-nach-ende:${ref}`}`) as any[];
          ok(t.length === 0, `${fall.id}/${schritt.id}: kein Prüffall „Rate nach Vertragsende“ mehr (${t.length})`);
        }
      }
      if (pr.storno) {
        const [a] = (await sql`SELECT gekuendigt_am, payment_status FROM fiaon_applications WHERE ref = ${ref}`) as any[];
        ok(["cancelled", "superseded", "refunded"].includes(String(a?.payment_status)) || !!a?.gekuendigt_am, `${fall.id}/${schritt.id}: H — Bestellung storniert (${a?.payment_status})`);
        const offen = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_abo_raten WHERE ref = ${ref} AND status = 'offen' AND storniert_am IS NULL`) as any[];
        ok(Number(offen[0].n) === 0, `${fall.id}/${schritt.id}: keine offene Rate mehr`);
      }
      if (pr.werbesperre != null) {
        const [pp] = (await sql`SELECT werbung_gesperrt_am FROM fiaon_persons WHERE id = ${personId}`) as any[];
        ok(!!pp?.werbung_gesperrt_am === pr.werbesperre, `${fall.id}/${schritt.id}: H — Werbesperre ${pr.werbesperre ? "gesetzt" : "nicht gesetzt"}`);
      }
      if (pr.aufgabe) {
        const t = (await sql`SELECT schluessel, zustaendig_art, zustaendig_agent_id FROM fiaon_betreiber_todos WHERE schluessel LIKE ${`wa-${personId}-%`}`) as any[];
        ok(t.length >= 1, `${fall.id}/${schritt.id}: H — Aufgabe angelegt (${t.map((x: any) => x.schluessel).join(", ") || "keine"})`);
        if (fall.abwesenheit) ok(t.every((x: any) => !TEAM_IDS.includes(Number(x.zustaendig_agent_id))), `${fall.id}/${schritt.id}: V — Aufgabe nicht bei Abwesenden (${t.map((x: any) => `${x.zustaendig_art}/${x.zustaendig_agent_id ?? "-"}`).join(", ")})`);
      }
      if (pr.termin_gebucht) {
        ok(!!ctx.terminGebucht && ctx.terminGebucht.agentId === pr.termin_gebucht.agent && !!s0Beginn && berlinIso(ctx.terminGebucht.beginn) === berlinIso(s0Beginn),
          `${fall.id}/${schritt.id}: T — Termin echt im Kalender bei #${pr.termin_gebucht.agent}, der Tag stimmt (${ctx.terminGebucht ? `${berlinIso(ctx.terminGebucht.beginn)} ${hhmm(ctx.terminGebucht.beginn)} #${ctx.terminGebucht.agentId}` : "—"}; angeboten ${s0 ? `${s0.datum} ${s0.uhrzeit}` : "—"})`);
      }
      if (pr.zahltag) {
        const [pp] = (await sql`SELECT promised_payment_date FROM fiaon_persons WHERE id = ${personId}`) as any[];
        ok(pp?.promised_payment_date && berlinIso(new Date(pp.promised_payment_date)) === ersetzen(pr.zahltag), `${fall.id}/${schritt.id}: Zahltag festgehalten (${pp?.promised_payment_date ? berlinIso(new Date(pp.promised_payment_date)) : "—"})`);
      }
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
  abw.abwesenheitVergessen();
}

if (ERGEBNIS.length) {
  const ohneHart = ERGEBNIS.filter((e) => !e.hart).length;
  const alle = ERGEBNIS.filter((e) => e.alle).length;
  console.log(`\n══ ${KI ? "C (echtes Modell)" : "B (Attrappe)"}: ${ohneHart}/${ERGEBNIS.length} ohne harten Mangel · ${alle}/${ERGEBNIS.length} mit allen Soll-Merkmalen`);
  if (KI) {
    for (const e of ERGEBNIS.filter((x) => !x.alle)) console.log(`   ${e.fall}/${e.schritt}: ${e.fehlt.join(" · ")}`);
    ok(ohneHart === ERGEBNIS.length, `C: alle ohne harten Mangel (${ohneHart}/${ERGEBNIS.length})`);
    ok(alle >= Math.ceil(ERGEBNIS.length * 22 / 25), `C: mindestens 22/25 mit allen Merkmalen (${alle}/${ERGEBNIS.length})`);
  }
}
const rest = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_persons WHERE person_ref LIKE 'PRUEF265-%'`.catch(() => [{ n: -1 }])) as any[];
ok(Number(rest[0].n) === 0, `Aufgeräumt: keine PRUEF265-Personen mehr (${rest[0].n}) — seit ${START.toLocaleTimeString("de-DE")}`);
ok(FREMD.length === 0, `Kein Netzaufruf außer ${KI ? "OpenAI" : "der Attrappe"} (${FREMD.slice(0, 3).join(", ") || "keiner"})`);
console.log(`\n${fehler ? "✗" : "✓"} ${geprueft - fehler}/${geprueft} Prüfungen bestanden`);
process.exit(fehler ? 1 : 0);
