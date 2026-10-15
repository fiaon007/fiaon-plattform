// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-372 (15.10.2026): MARAS WHATSAPP — SELBST ERLEDIGEN ODER EIN KLICK FÜR JUSTIN
//
// Justin: „Mara soll ALLES selbst machen können, nichts weitergeben an die Mitarbeiter — selbst arbeiten. Wenn sie
// eine Entscheidung braucht, dann soll ich es mit 1 Klick entscheiden können … Mara soll nicht MEHR Arbeit schaffen.“
//
//   A. OFFLINE (reine Regeln, ohne Datenbank, ohne Modell): waRechtlich, waWiderruf, waErstattung, waSelbstThema,
//      die Weiche waWeg (jeder Anlass), waEntscheidungVorab, der sichere Satz gegen Wortwand/Ton/Zahlungsbitte,
//      zusageTreffer, ausstiegThema, ratenpauseGewollt, angabenPruefen, die Karten (waKarteBauen) mit gültigen
//      Optionen, die angemeldeten Werkzeuge, der Quelltext (Reihenfolge in maraAntwortet, keine Pflicht-Übergabe mehr).
//   B. LOKALE TEST-DB (nur 127.0.0.1:54329/fiaon_pruefstand…), zwei Teile:
//      B1 in EINER zurückgerollten Transaktion: Lage (waLageLesen), Karten anlegen/auffrischen (waKarteAnlegen),
//         offene Karten (waOffeneKarten), die Riegel der Werkzeuge (Lage hat sich erledigt → „von selbst“).
//      B2 maraAntwortet mit einer Attrappe für das Modell (fetch nachgebaut, kein Netz) und für den Kartenweg — wie
//         pruef-mara-karte-wa: eigene Datensätze (Personen PRUEF372-…, Nummern 4915900372xxx, Referenzen FIAON-P372…),
//         am Ende entfernt. Die Werkzeuge (kuendigungDurchfuehren, ratenpauseAnwenden, Löschen) schreiben über den
//         Pool — das geht nicht in einer fremden Transaktion; deshalb nur gegen die lokale Prüf-DB, mit Aufräumen.
//
//   Offline: env -i HOME=$HOME PATH=$PATH DATABASE_URL=postgresql://x@127.0.0.1:1/x node_modules/.bin/tsx scripts/pruef-mara-wa-e372.ts
//   Mit DB:  env -i HOME=$HOME PATH=$PATH DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_…?sslmode=require' \
//              SESSION_SECRET=pruefstand-nur-lokal DOTENV_CONFIG_PATH=/dev/null node_modules/.bin/tsx scripts/pruef-mara-wa-e372.ts --db
// Verschickt nichts (kein Schlüssel, fetch außer der Modell-Attrappe gesperrt). Keine Kundendaten — alle Sätze erfunden.
// ═══════════════════════════════════════════════════════════════════════════
const MIT_DB = process.argv.includes("--db");
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID", "META_SYSTEM_TOKEN", "OPENAI_API_KEY", "ANTHROPIC_API_KEY",
  "GOOGLE_SA_KEY", "GMAIL_CLIENT_SECRET", "RESEND_API_KEY", "TWILIO_AUTH_TOKEN", "VAPID_PRIVATE_KEY"]) {
  if (process.env[k]) { console.error(`${k} ist gesetzt — Abbruch, der Prüfstand darf nichts versenden.`); process.exit(3); }
}
if (MIT_DB && !/127\.0\.0\.1:54329\/fiaon_pruefstand/.test(String(process.env.DATABASE_URL))) { console.error("--db NUR gegen die lokale Test-DB (127.0.0.1:54329/fiaon_pruefstand…)!"); process.exit(3); }
if (!MIT_DB) process.env.DATABASE_URL = "postgresql://nobody@127.0.0.1:1/none";
process.env.CRONS = "aus";
process.env.SESSION_SECRET ||= "pruefstand-nur-lokal";
process.env.OPENAI_API_KEY = "sk-pruef-lokal-e372";
process.env.OHNE_PDF = "1";

// ── Netz: nur lokal und die Attrappe für das Modell ───────────────────────
type Plan = { werkzeug?: { name: string; args: Record<string, unknown> }; antworten: string[]; mensch?: boolean; uebergabe?: string };
let plan: Plan | null = null;
const MODELL: { system: string; zweiter: boolean; tools: string[]; antwort?: string }[] = [];
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
    const tools = (Array.isArray(body.tools) ? body.tools : []).map((t: any) => String(t?.name ?? t?.function?.name ?? ""));
    const eintrag = { system, zweiter, tools } as (typeof MODELL)[number];
    MODELL.push(eintrag);
    const p = plan ?? { antworten: ["Sehr gern!"] };
    if (p.werkzeug && tools.includes(p.werkzeug.name) && !werkzeugErgebnisse.length) {
      return json(200, { status: "completed", output: [{ type: "function_call", call_id: `pruef372-${MODELL.length}`, name: p.werkzeug.name, arguments: JSON.stringify(p.werkzeug.args) }], usage: { input_tokens: 10, output_tokens: 10 } });
    }
    const so = [...werkzeugErgebnisse].reverse().find((w) => w?.so_schreiben)?.so_schreiben ?? "";
    const text = String(zweiter ? (p.antworten[1] ?? p.antworten[0]) : p.antworten[0]).replace(/\{SO_SCHREIBEN\}/g, String(so)).replace(/\s+/g, " ").trim();
    eintrag.antwort = text;
    return json(200, { status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ antwort: text, gemerkt: "", mensch: !!p.mensch, uebergabe: p.uebergabe ?? "" }) }] }], usage: { input_tokens: 10, output_tokens: 10 } });
  }
  FREMD.push(u);
  throw new Error(`Prüfstand: kein Netz (${u})`);
}) as typeof fetch;

let geprueft = 0, fehler = 0;
function ok(bed: unknown, text: string) {
  geprueft++;
  if (bed) console.log(`  ✓ ${text}`); else { fehler++; console.log(`  ✗ ${text}`); }
}
const kurz = (t: unknown, n = 120) => String(t ?? "").replace(/\s+/g, " ").slice(0, n);

const kp = await import("../server/lib/fiaon-ki-pause");
kp.kiNetzAbsichern();
const wa = await import("../server/lib/fiaon-whatsapp-mara");
const we = await import("../server/lib/fiaon-whatsapp-entscheidungen");
const me = await import("../server/lib/fiaon-mara-entscheidungen");
const ton = await import("../shared/fiaon-mara-ton");
const { sendePruefung } = await import("../server/lib/fiaon-whatsapp");
const { fordertZahlung } = await import("../server/lib/fiaon-postmeister-agent");
const { readFileSync } = await import("node:fs");
const quelle = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// ═══════════════════════════════════════════════════════════════════════════
// A. OFFLINE
// ═══════════════════════════════════════════════════════════════════════════
console.log("── A1. Recht, Widerruf, Geld zurück — erkannt (erfundene Sätze nach den Mustern der Übergaben 01.–15.10.) ──");
for (const t of ["Sonst gebe ich das meinem Rechtsanwalt.", "Ich gehe jetzt zum Anwalt.", "Das gebe ich an die Staatsanwaltschaft.",
  "wenn Sie weiter schreiben, ruf ich polzai", "Ich habe schon Anzeige gemacht über Ihre Nummer.", "sonst zeige ich Sie wegen Internetbetrug an",
  "Ich gehe zur Verbraucherzentrale.", "Ich werde rechtliche Schritte einleiten.", "Das gehört angezeigt gehört ihr", "Ich verklage Sie.",
  "Schreiben der Finanzmarktaufsicht, Aktenzeichen: 12345"]) ok(wa.waRechtlich(t), `rechtlich: „${t}“`);
for (const t of ["Mir wird nichts angezeigt", "Zeigen Sie mir an, was offen ist", "Alles schwarz, nicht zu erkennen", "Ich beklage mich nicht", "Wo ist meine Karte?"]) {
  ok(!wa.waRechtlich(t), `nicht rechtlich: „${t}“`);
}
for (const t of ["Ich widerrufe hiermit meinen Vertrag.", "Hiermit nutze ich mein Widerspruchsrecht und widerspreche dem Vertrag.",
  "Ich trete hiermit vom Vertrag zurück", "Bitte bestätigen Sie endlich meinen Wiederruf", "Hiermit widerufe ich"]) ok(wa.waWiderruf(t), `Widerruf erklärt: „${t}“`);
for (const t of ["Wie lange habe ich Widerrufsrecht?", "Ich widerrufe nicht, ich will nur wissen, wann die Karte kommt.", "Das ist alles widersprüchlich",
  "Ich widerspreche der Erinnerung", "Kein Widerruf, ich will nur meine Karte"]) ok(!wa.waWiderruf(t), `kein erklärter Widerruf: „${t}“`);
for (const t of ["Ich will sofort mein Geld zurück!", "Ich verlange die Rückerstattung der ersten Rate.", "Ich will die 59,99 € zurück.",
  "Bekomme ich mein Geld wieder?", "Bitte überweisen Sie mir den Betrag zurück."]) ok(wa.waErstattung(t), `Geld zurück: „${t}“`);
for (const t of ["Ich werde Anzeige erstatten", "Ich zahle die Rate morgen.", "Wo ist mein Geld geblieben, ich habe überwiesen"]) ok(!wa.waErstattung(t), `kein Geld zurück: „${t}“`);
ok(wa.waEntscheidungVorab("Ich gehe zum Anwalt", { bezahlt: false }) === "rechtlich", "Recht immer (auch ohne Zahlung)");
ok(wa.waEntscheidungVorab("Ich widerrufe hiermit", { bezahlt: true }) === "widerruf" && wa.waEntscheidungVorab("Ich widerrufe hiermit", { bezahlt: false }) === null,
  "Widerruf: nach Zahlung Justin, ohne Zahlung Storno (Mara selbst)");
ok(wa.waEntscheidungVorab("Ich will mein Geld zurück", { bezahlt: true }) === "erstattung" && wa.waEntscheidungVorab("Ich will mein Geld zurück", { bezahlt: false }) === null,
  "Geld zurück: nur nach einer Zahlung eine Entscheidung");
ok(wa.waEntscheidungVorab("Ich kündige, das ist mir zu teuer", { bezahlt: true }) === null, "Kündigung ist keine Entscheidung (Mara, zwei Schritte)");

console.log("── A2. Was Mara selbst kann (waSelbstThema) ──────────────────────────");
const thema: [string, string | null][] = [["Ich habe gekündigt und bezahle nicht", "kuendigung"], ["Ich habe schon 3 Raten bezahlt", "bezahlt"],
  ["Eben per Echtzeit überwiesen", "bezahlt"], ["Wo ist meine Karte", "karte"], ["Ich bekomme keine E-Mail von Ihnen", "karte"],
  ["Ihr seid unfähig", "beschwerde"], ["Kunde bestreitet den Vertrag", "abstreiten"], ["Ich kann diesen Monat nicht zahlen", "kann_nicht_zahlen"],
  ["Ich habe nichts beantragt", "abstreiten"], ["Ich habe eine Frage", null], ["Die Seite bleibt schwarz", null]];
for (const [t, soll] of thema) ok(wa.waSelbstThema(t) === soll, `waSelbstThema(„${t}“) = ${soll} (ist ${wa.waSelbstThema(t)})`);

console.log("── A3. Die Weiche waWeg ──────────────────────────────────────────────");
const W = (e: Parameters<typeof wa.waWeg>[0]) => wa.waWeg(e);
const w = (e: Parameters<typeof wa.waWeg>[0], weg: string, fall: string | null, was: string) => {
  const r = W(e);
  ok(r.weg === weg && r.fall === fall, `${was} → ${weg}${fall ? `/${fall}` : ""} (ist ${r.weg}${r.fall ? `/${r.fall}` : ""}: ${r.grund})`);
};
w({ kunde: "egal", anlass: "ki" }, "betreuer", null, "KI-Ausfall");
w({ kunde: "egal", anlass: "technik" }, "betreuer", null, "Technik (Deckel, Pause, Versand)");
w({ kunde: "Hallo", anlass: "global" }, "karte", "global", "FIAON Global");
w({ kunde: "Ok passt", anlass: "zusage_team" }, "betreuer", null, "Zusage auf die Frage einer Kollegin");
w({ kunde: "Löschen Sie meine Daten", anlass: "abstreiten", abstArt: "loeschen" }, "karte", "loeschen", "Löschwunsch");
w({ kunde: "Falsche Nummer", anlass: "abstreiten", abstArt: "falsche_nummer" }, "karte", "falsche_nummer", "falsche Nummer");
w({ kunde: "Ich habe nichts beantragt", anlass: "abstreiten", abstArt: "bestreitet", abgeschickt: true }, "karte", "bestreitet", "bestreitet abgeschickten Antrag");
w({ kunde: "Ich habe nichts beantragt", anlass: "abstreiten", abstArt: "bestreitet", abgeschickt: false }, "selbst", null, "bestreitet ohne abgeschickten Antrag");
w({ kunde: "Lassen Sie mich in Ruhe", anlass: "abstreiten", abstArt: "in_ruhe" }, "selbst", null, "in Ruhe lassen");
w({ kunde: "😡😡", anlass: "abstreiten", abstArt: "wut" }, "selbst", null, "nur Wut");
w({ kunde: "Für was soll ich zahlen?", anlass: "abstreiten", abstArt: "rueckfrage" }, "betreuer", null, "„wofür zahlen?“ (fester Satz sagt seinen Anruf zu)");
w({ kunde: "Ich habe nichts beantragt, ich gehe zur Polizei", anlass: "abstreiten", abstArt: "bestreitet" }, "karte", "rechtlich", "Bestreiten mit Drohung");
w({ kunde: "Ich kündige!", anlass: "nachricht", bezahlt: true }, "selbst", null, "Kündigung");
w({ kunde: "Ihr seid Betrüger", anlass: "nachricht", bezahlt: true }, "selbst", null, "Beschwerde/Betrugsvorwurf");
w({ kunde: "Ich kann nicht zahlen", anlass: "nachricht", bezahlt: true }, "selbst", null, "kann nicht zahlen");
w({ kunde: "Ich habe gestern überwiesen", anlass: "nachricht", bezahlt: true }, "selbst", null, "habe bezahlt");
w({ kunde: "Bitte rufen Sie mich an", anlass: "nachricht", rueckrufWunsch: true }, "betreuer", null, "ausdrücklicher Rückrufwunsch ohne Termin");
w({ kunde: "Bitte rufen Sie mich an", anlass: "nachricht", rueckrufWunsch: true, terminDa: true }, "selbst", null, "Rückrufwunsch, der Termin steht schon");
w({ kunde: "Ich widerrufe hiermit", anlass: "modell", bezahlt: true, uebergabe: "Kunde widerruft" }, "karte", "widerruf", "Modell will einen Menschen, er widerruft nach Zahlung");
w({ kunde: "Ich habe eine Frage", anlass: "modell", uebergabe: "Kunde bestreitet den Vertrag und fragt nach dem Vertrag" }, "selbst", null, "Knopf + Zusammenfassung „bestreitet“ (Mara selbst)");
w({ kunde: "Die Seite bleibt schwarz", anlass: "modell", uebergabe: "Darstellung nach der Adresse schwarz, bitte technisch prüfen" }, "karte", "frage", "Frage, die Mara nicht beantworten kann");
w({ kunde: "Morgen", anlass: "modell", uebergabe: "Kunde möchte morgen angerufen werden" }, "betreuer", null, "Modell: Rückruf gewünscht, kein Termin");
w({ kunde: "Ich habe keinen Link bekommen", anlass: "modell", uebergabe: "Kundin möchte keinen Anruf; der Link sei nicht angekommen" }, "selbst", null, "„keinen Anruf“ + Kartenfrage → Mara selbst");
w({ kunde: "egal", anlass: "rueckfall" }, "karte", "unsicher", "Maras Prüfung hielt jede Antwort an");
w({ kunde: "Bitte rufen Sie mich an", anlass: "rueckfall", rueckrufWunsch: true }, "betreuer", null, "Rückfall, aber er will angerufen werden");
w({ kunde: "Wie lange dauert das?", anlass: "zusage", uebergabe: "Mara hat zugesagt (Rückmeldung)" }, "karte", "frage", "Zusage ohne Werkzeug (kein Anruf)");
w({ kunde: "Können Sie mich anrufen?", anlass: "zusage", anrufGewuenscht: true, uebergabe: "Mara hat zugesagt (meldet sich bei Ihnen)" }, "betreuer", null, "Zusage eines Anrufs, er wollte telefonieren");
w({ kunde: "Wann ruft er an?", anlass: "zusage", terminDa: true, uebergabe: "Mara hat zugesagt (ruft Sie an)" }, "selbst", null, "Zusage, der Termin deckt sie");
w({ kunde: "Wann kommt die Karte?", anlass: "karte_ausschluss" }, "karte", "karte", "Kartenlink ausgeschlossen");
w({ kunde: "Bitte noch eine Pause", anlass: "ratenpause_haertefall" }, "karte", "ratenpause", "Härtefall Ratenpause");
w({ kunde: "Ich will doch nicht kündigen", anlass: "kuendigung_zurueck", gekuendigt: true }, "karte", "kuendigung_zurueck", "Rücknahme einer gebuchten Kündigung");
w({ kunde: "Ich will doch nicht kündigen", anlass: "kuendigung_zurueck", gekuendigt: false }, "selbst", null, "verneinte Kündigung ohne Buchung");
w({ kunde: "Ich habe nichts bestellt, stornieren", anlass: "kuendigung_bestreitet", abgeschickt: true }, "karte", "bestreitet", "bestreitet + Storno, Antrag abgeschickt");
w({ kunde: "Ich habe nichts bestellt, stornieren", anlass: "kuendigung_bestreitet", abgeschickt: false }, "selbst", null, "bestreitet + Storno ohne abgeschickten Antrag");
w({ kunde: "Termin absagen", anlass: "modell", terminDa: true, terminAenderung: true, uebergabe: "will den Termin verschieben" }, "betreuer", null, "Termin des Teams verschieben");
w({ kunde: "Ich will weitermachen", anlass: "werbesperre" }, "karte", "werbesperre", "nach der Sperre doch weitermachen");
w({ kunde: "Ich kündige", anlass: "vorlegen" }, "karte", "frage", "ein Werkzeug konnte es nicht erledigen (Kündigung als Prüffall)");

console.log("── A4. Der sichere Satz (Wortwand, Ton, keine Zahlungsbitte, keine Zusage) ──");
for (const [fall, satz] of Object.entries(wa.WA_ENTSCHEIDUNG_SATZ)) {
  const t = String(satz);
  ok(!sendePruefung(t).length, `${fall}: Wortwand frei`);
  ok(!ton.tonPruefung(t, { kanal: "whatsapp" }).some((f) => f.schwere === "hart"), `${fall}: Tonprüfung ohne harten Treffer`);
  ok(!fordertZahlung(t) && !/zahlungsseite|überweisen|\/zahlung\//i.test(t), `${fall}: keine Zahlungsbitte`);
  ok(/Geschäftsführung/.test(t) && /schriftliche Nachricht/.test(t) && !/erstatten wir|bekommen Sie (?:Ihr|das) Geld|innerhalb|heute|morgen|garantiert/i.test(t), `${fall}: nichts zugesagt (Geschäftsführung entscheidet, schriftliche Nachricht)`);
  ok(!wa.handlungsPruefung(t, [], fall === "widerruf" ? "Ich widerrufe hiermit" : "Ich gehe zum Anwalt", "", { ruhe: true }).length, `${fall}: Handlungsprüfung (Ruhe) frei`);
  // Justin (15.10.2026): Verkauf und Vertrag nicht vermischen — kein Bank-Satz, keine Einschränkung; und der sichere Satz verkauft auch nicht.
  ok(!/bank|kreditinstitut|rahmen|garantie|zusage der|limit|kreditkarte|link|zahlungsseite/i.test(t), `${fall}: neutral — kein Bank-Satz, keine Einschränkung, kein Verkauf`);
}
// E-373 (Justins neuer Verkaufssatz): in der Ruhe ist „… schalten wir umgehend Ihren Account frei“ (B) eine Zahlungsbitte, A nicht.
{
  const B = "Nach Ihrer Zahlung mit Ihrem Verwendungszweck schalten wir umgehend Ihren Account frei, damit Sie schnellstmöglich starten können.";
  const A = "Sobald wir Ihre Zahlung zugeordnet haben, schalten wir umgehend Ihren Account frei, damit Sie schnellstmöglich starten können.";
  ok(wa.handlungsPruefung(B, [], "Ich widerrufe hiermit", "", { ruhe: true }).some((f) => /keine Zahlungsseite und keine Bitte um Zahlung/.test(f)), "Ruhe: „… schalten wir umgehend Ihren Account frei“ (B) ist eine Zahlungsbitte");
  ok(!wa.handlungsPruefung(A, [], "Ich widerrufe hiermit", "", { ruhe: true }).some((f) => /keine Zahlungsseite und keine Bitte um Zahlung/.test(f)), "Ruhe: Stufe A („zugeordnet haben, schalten wir …“) bleibt frei");
}
ok(we.waKundenSatz("widerruf") === wa.WA_ENTSCHEIDUNG_SATZ.widerruf && we.waKundenSatz("global") === null, "waKundenSatz: Global bekommt keinen Satz (E-272)");

console.log("── A5. Zusagen, Ausstieg, Ratenpause, Angaben ────────────────────────");
ok(wa.zusageTreffer("Herr Muster meldet sich bei Ihnen.", ["Herr Muster"]) != null, "„Herr X meldet sich“ ist eine Zusage");
ok(wa.zusageTreffer("Ich gebe Ihrem Betreuer Bescheid.") != null && wa.zusageTreffer("Unsere Geschäftsführung prüft das.") != null, "„ich gebe Bescheid“, „Geschäftsführung prüft“ sind Zusagen");
ok(wa.zusageTreffer("Hier ist Ihr Link: https://example.invalid/x — in etwa fünf Minuten sind Sie durch.") == null, "ein Link ist keine Zusage");
ok(wa.zusageTreffer("Geben Sie mir Bescheid, wenn es passt?") == null, "„Geben Sie mir Bescheid?“ ist keine Zusage");
ok(wa.zusageGeschaeftsfuehrung(wa.zusageTreffer("Unsere Geschäftsführung klärt das, Sie bekommen Bescheid.")) && !wa.zusageGeschaeftsfuehrung(wa.zusageTreffer("Herr Muster meldet sich.", ["Herr Muster"]))
  && !wa.zusageGeschaeftsfuehrung("Geschäftsführung ruft Sie an"), "nur „die Geschäftsführung klärt“ ist mit mensch true gedeckt — kein Name, kein Anruf");
ok(wa.ausstiegThema("Ich widerrufe", true) && !wa.ausstiegThema("Ich widerrufe", false) && wa.ausstiegThema("Ich kündige", false), "Ausstieg: Widerruf nur bei unbezahlter Bestellung (Storno)");
ok(wa.ratenpauseGewollt("Kann ich die Rate aussetzen?", null) && wa.ratenpauseGewollt("Bitte eine Ratenpause", null), "Pause erbeten");
ok(wa.ratenpauseGewollt("Ja gerne", "Soll ich Ihre Raten einmal um einen Monat verschieben? Bis dahin bekommen Sie keine Erinnerung."), "Ja auf Maras Angebot");
ok(!wa.ratenpauseGewollt("Ja gerne", "Möchten Sie den Link?") && !wa.ratenpauseGewollt("Nein danke", "Soll ich Ihre Raten einmal um einen Monat verschieben?"), "kein Ja auf das Angebot → keine Pause");
ok(!wa.ratenpauseGewollt("Können wir den Termin verschieben?", null), "Termin verschieben ist keine Ratenpause");
const AP = (args: any, kunde: string, fehlend: string[], adresseProblem = false) => wa.angabenPruefen(args, { kunde, fehlend, adresseProblem });
let a1 = AP({ email: "neu.adresse@example.invalid" }, "Meine Mail ist neu.adresse@example.invalid", ["E-Mail-Adresse"]);
ok(a1.ok && (a1 as any).body.email === "neu.adresse@example.invalid", "fehlende E-Mail aus seiner Nachricht → eintragen");
ok(!AP({ email: "erfunden@example.invalid" }, "Meine Mail ist neu.adresse@example.invalid", ["E-Mail-Adresse"]).ok, "erfundene E-Mail (nicht in seiner Nachricht) → nein");
ok(!AP({ email: "neu.adresse@example.invalid" }, "neu.adresse@example.invalid", []).ok, "E-Mail vorhanden und zustellbar → nicht ändern");
ok(AP({ email: "neu.adresse@example.invalid" }, "neu.adresse@example.invalid", [], true).ok, "E-Mail vorhanden, aber dort kommt nichts an → neue eintragen");
a1 = AP({ strasse: "Musterweg 12", plz: "12345", ort: "Musterstadt" }, "Musterweg 12, 12345 Musterstadt", ["Straße und Hausnummer", "Postleitzahl", "Wohnort"]);
ok(a1.ok && (a1 as any).body.street === "Musterweg 12" && (a1 as any).body.zip === "12345" && (a1 as any).body.city === "Musterstadt", "Anschrift aus seiner Nachricht");
ok(!AP({ strasse: "Musterweg" }, "Musterweg", ["Straße und Hausnummer"]).ok, "Straße ohne Hausnummer → nein");
ok(!AP({ plz: "1234567" }, "1234567", ["Postleitzahl"]).ok, "ungültige PLZ → nein");
ok(AP({ geburtsdatum: "1980-03-07" }, "Ich bin am 07.03.1980 geboren", ["Geburtsdatum"]).ok && AP({ geburtsdatum: "1980-03-07" }, "7. März 1980", ["Geburtsdatum"]).ok, "Geburtsdatum (Ziffern oder Monatsname)");
ok(!AP({ geburtsdatum: "1980-03-07" }, "Ich bin 1980 geboren", ["Geburtsdatum"]).ok, "Geburtsdatum nicht vollständig in seiner Nachricht → nein");
ok(!AP({ email: "neu.adresse@example.invalid", plz: "99" }, "neu.adresse@example.invalid 99", ["E-Mail-Adresse", "Postleitzahl"]).ok, "eine falsche Angabe → nichts eingetragen");

console.log("── A6. Die Karten (waKarteBauen) ─────────────────────────────────────");
const LAGE_PAID = { personId: 77, bezahlt: true, bezahltCents: 7999, ref: "FIAON-TEST0001", paymentStatus: "paid", abgeschickt: true, gekuendigt: false,
  vertragAm: "2026-10-10", tageSeitVertrag: 5, offenCents: 7999, offeneRaten: 1 };
const LAGE_B = { ...LAGE_PAID, bezahlt: false, bezahltCents: 0, paymentStatus: "pending_payment", offenCents: 0, offeneRaten: 0 };
const gueltig = (k: any) => {
  const keys = k.optionen.map((o: any) => o.key);
  return keys.length > 0 && new Set(keys).size === keys.length && keys.includes(k.empfehlung) && k.optionen.every((o: any) => o.key && o.label && o.werkzeug && (o.werkzeug !== "link" || o.link));
};
const faelle = ["rechtlich", "widerruf", "erstattung", "loeschen", "global", "bestreitet", "kuendigung_zurueck", "karte", "ratenpause", "falsche_nummer", "werbesperre", "unsicher", "frage"] as const;
for (const fall of faelle) {
  const k = we.waKarteBauen({ fall, schluessel: `wa:${fall}:p77:1`, nummer: "4915900000001", personId: 77, lage: fall === "bestreitet" ? LAGE_B : { ...LAGE_PAID, gekuendigt: fall === "kuendigung_zurueck" },
    kunde: "Erfundener Satz des Kunden.", mara: fall === "global" ? null : "Maras Antwort.", loesch: fall === "loeschen" ? { art: "endgueltig", text: "Keine Zahlung — darf vollständig verschwinden." } : null, pauseOhneSperre: fall === "ratenpause" });
  ok(gueltig(k) && k.art === we.WA_ART[fall] && k.optionen.some((o) => o.key === "selbst" && o.link === "/chef/s/whatsapp?nummer=4915900000001"), `${fall}: gültige Karte, „Selbst antworten“ öffnet genau dieses Gespräch (Empfehlung ${k.empfehlung})`);
}
const kw = we.waKarteBauen({ fall: "widerruf", schluessel: "x", nummer: "4915900000001", personId: 77, lage: LAGE_PAID, kunde: "Ich widerrufe", mara: "…" });
ok(kw.empfehlung === "annehmen" && kw.optionen.find((o) => o.key === "annehmen")?.werkzeug === "wa_widerruf_annehmen" && kw.optionen.find((o) => o.key === "annehmen")?.ton === "vorsicht",
  "Widerruf innerhalb von 14 Tagen: „Widerruf annehmen“ empfohlen (vorsicht)");
const kw2 = we.waKarteBauen({ fall: "widerruf", schluessel: "x", nummer: "4915900000001", personId: 77, lage: { ...LAGE_PAID, tageSeitVertrag: 40 }, kunde: "Ich widerrufe", mara: "…" });
ok(kw2.empfehlung === "selbst", "Widerruf nach 40 Tagen: „Selbst antworten“ empfohlen");
const kb = we.waKarteBauen({ fall: "bestreitet", schluessel: "x", nummer: "4915900000001", personId: 77, lage: LAGE_B, kunde: "Nichts beantragt", mara: "…" });
ok(kb.empfehlung === "stornieren" && kb.optionen.find((o) => o.key === "stornieren")?.werkzeug === "wa_storno", "bestreitet (unbezahlt): „Bestellung stornieren“ empfohlen");
const kl = we.waKarteBauen({ fall: "loeschen", schluessel: "x", nummer: "4915900000001", personId: 77, lage: { ...LAGE_B, offenCents: 0 }, kunde: "Löschen", mara: "…", loesch: { art: "endgueltig", text: "…" } });
const kl2 = we.waKarteBauen({ fall: "loeschen", schluessel: "x", nummer: "4915900000001", personId: 77, lage: LAGE_PAID, kunde: "Löschen", mara: "…", loesch: { art: "anonymisiert", text: "…" } });
ok(kl.empfehlung === "loeschen" && kl2.empfehlung === "selbst" && kl2.optionen.find((o) => o.key === "loeschen")?.label === "Person anonymisieren", "Löschwunsch: ohne Zahlung „löschen“, mit Vertrag erst sprechen (Anonymisieren als Knopf)");
const kg = we.waKarteBauen({ fall: "global", schluessel: "x", nummer: "4915900000001", personId: 77, lage: null, kunde: "Hallo", mara: null });
ok(kg.optionen.find((o) => o.key === "nichts")?.label === "Nichts tun" && !kg.belege?.some((b) => b.name === "Maras Antwort"), "Global: keine Antwort von Mara in der Karte, „Nichts tun“");
ok(["wa_storno", "wa_widerruf_annehmen", "wa_kuendigung_zuruecknehmen", "wa_daten_loeschen", "wa_ratenpause_haertefall"].every((n) => me.entscheidungWerkzeugNamen().includes(n)), "Werkzeuge der Karten angemeldet");
ok(wa.karteRuhe([{ fall: "widerruf" }]) && !wa.karteRuhe([{ fall: "frage" }]), "offene Recht/Widerruf/Geld-Karte → keine Zahlungsbitte; eine offene Frage nicht");

console.log("── A7. Quelltext: Reihenfolge und keine Pflicht-Übergabe mehr ───────");
// Ohne Kommentare — dort steht absichtlich, was vorher galt („Hier stand …“).
const ohneKommentare = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const q = ohneKommentare(quelle("server/lib/fiaon-whatsapp-mara.ts"));
const rumpf = (name: string) => { const i = q.indexOf(name); return i < 0 ? "" : q.slice(i, q.indexOf("\n}\n", i)); };
const antwort = rumpf("export async function maraAntwortet(");
ok(!/if \(heikel && !mensch\)/.test(antwort), "„heikel → mensch true“ ist weg (Mara erledigt Kündigung, Beschwerde, Storno selbst)");
ok(antwort.indexOf("waEntscheidungVorab(") > 0 && antwort.indexOf("waEntscheidungVorab(") < antwort.indexOf("await kiPausiert()"), "Recht/Widerruf/Geld zurück vor der KI-Pause (fester Satz, ohne Modell)");
ok(antwort.indexOf("waEntscheidungVorab(") > antwort.indexOf("globalKundeWa(Number(personId))"), "… nach der Global-Weiche (E-272 bleibt zuerst)");
ok(/anlass: "global"/.test(antwort) && !/aufgabeFuerMenschen\([^;]*"global"/.test(antwort), "Global: Karte statt Aufgabe (Rückfall in uebergeben)");
{
  // Jeder direkte Aufruf in maraAntwortet: nur Technik (KI, Pause, Deckel) und die Zusage auf die Frage einer Kollegin („rueckruf“).
  const aufrufe = antwort.split("aufgabeFuerMenschen(").slice(1).map((x) => x.slice(0, x.indexOf(");") + 1));
  const klassen = aufrufe.map((x) => (x.match(/"(pause|deckel|ki|rueckruf|heikel|geld|anliegen|pruefung|bestreitet|loeschen|global|falsche_nummer|rueckfrage)"/g) ?? []).slice(-1)[0] ?? "?");
  ok(aufrufe.length > 0 && klassen.every((k) => /^"(pause|deckel|ki|rueckruf)"$/.test(k)), `aufgabeFuerMenschen in maraAntwortet nur noch für Technik und die Zusage an eine Kollegin (${klassen.join(", ")})`);
}
ok(/zusageVerboten: zusageOk \? null/.test(antwort), "Zusagen ohne Werkzeug: harte Wand im Entwurf (zusageVerboten)");
ok(quelle("server/lib/fiaon-mara-entscheidungen.ts").includes('import("./fiaon-whatsapp-entscheidungen")'), "erweiterungenLaden lädt die WhatsApp-Karten (dynamisch)");
ok(!/import\s+[^;]*from\s+"\.\/fiaon-whatsapp-entscheidungen"/.test(q.replace(/import type[^;]*;/g, "")), "fiaon-whatsapp-mara importiert die Karten nie statisch (kein Kreis)");
ok(!/setzt du mensch auf true \(uebergabe: (?:Angaben|E-Mail)/.test(q), "Angaben/E-Mail: angaben_eintragen statt „mensch true“");
ok(!/Eine Ratenpause oder Stundung sagst du nie zu; die entscheidet ein Mensch/.test(q) && !/Ratenpause oder Stundung sagst du nie zu — das übergibst du/.test(q), "Ratenpause: der vorhandene Weg statt „nie zusagen, übergeben“");

// ═══════════════════════════════════════════════════════════════════════════
// B. LOKALE TEST-DB
// ═══════════════════════════════════════════════════════════════════════════
if (MIT_DB) {
  const { sqlPool: sql } = await import("../server/lib/db-pool");
  await me.entscheidungTabellen();
  console.log("\n── B1. In einer zurückgerollten Transaktion: Lage, Karten, Riegel ────");
  const ZURUECK = new Error("zurückrollen");
  await sql.begin(async (tx: any) => {
    const [p] = await tx`INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_email) VALUES ('PRUEF372-T1', 'Prüf', 'Transaktion', 'pruef372-t1@kunde.invalid') RETURNING id`;
    const pid = Number(p.id);
    await tx`INSERT INTO fiaon_applications (ref, payment_reference, person_id, status, payment_status, current_step, pack_key, ist_entwurf, agb_stand, created_at, paid_at, submitted_at, email)
      VALUES ('FIAON-P372T1', 'FIAON-P72T1X', ${pid}, 'approved', 'paid', 8, 'ultra', FALSE, '2026-09-10', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days', 'pruef372-t1@kunde.invalid')`;
    await tx`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status, bezahlt_am) VALUES ('FIAON-P372T1', 1, 'FIAON-P72T1X-1', 9999, NOW() - INTERVAL '5 days', 'bezahlt', NOW() - INTERVAL '5 days')`;
    await tx`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status) VALUES ('FIAON-P372T1', 2, 'FIAON-P72T1X-2', 9999, NOW() + INTERVAL '25 days', 'offen')`;
    const lage = await we.waLageLesen(pid, tx);
    ok(lage?.bezahlt && lage.bezahltCents === 9999 && lage.offenCents === 9999 && lage.offeneRaten === 1 && lage.ref === "FIAON-P372T1" && lage.abgeschickt && !lage.gekuendigt && lage.tageSeitVertrag === 5,
      `waLageLesen: bezahlt, offen, Vertrag vor 5 Tagen (${JSON.stringify(lage)})`);
    const k1 = await we.waKarteAnlegen({ fall: "widerruf", nummer: "4915900372901", personId: pid, lage, kunde: "Ich widerrufe hiermit.", mara: wa.WA_ENTSCHEIDUNG_SATZ.widerruf!, aufId: 9001 }, tx);
    const k2 = await we.waKarteAnlegen({ fall: "widerruf", nummer: "4915900372901", personId: pid, lage, kunde: "Ich widerrufe hiermit. Wann höre ich etwas?", mara: "…", aufId: 9002 }, tx);
    ok(k1?.neu && k2 && !k2.neu && k1.schluessel === k2.schluessel && k1.schluessel === `wa:widerruf:p${pid}:9001`, "zweite Nachricht frischt DIE offene Karte auf (kein zweites Mal fragen)");
    const [z] = await tx`SELECT art, empfehlung, belege::text AS b, optionen::text AS o FROM fiaon_mara_entscheidungen WHERE schluessel = ${k1!.schluessel}`;
    ok(z.art === "wa_widerruf" && z.empfehlung === "annehmen" && /Wann höre ich etwas/.test(z.b) && /wa_widerruf_annehmen/.test(z.o), "die Karte trägt die neueste Nachricht, Empfehlung „annehmen“ (5 Tage)");
    const offen = await we.waOffeneKarten(pid, "4915900372901", tx);
    ok(offen.length === 1 && offen[0].fall === "widerruf", "waOffeneKarten findet die offene Widerrufskarte");
    await tx`UPDATE fiaon_mara_entscheidungen SET status = 'entschieden', entschieden_am = NOW() WHERE schluessel = ${k1!.schluessel}`;
    const k3 = await we.waKarteAnlegen({ fall: "widerruf", nummer: "4915900372901", personId: pid, lage, kunde: "Noch einmal: Widerruf!", mara: "…", aufId: 9003 }, tx);
    ok(k3?.neu && k3.schluessel === `wa:widerruf:p${pid}:9003`, "nach der Entscheidung: eine neue Nachricht macht eine neue Karte");
    const kl = await we.waKarteAnlegen({ fall: "loeschen", nummer: "4915900372901", personId: pid, lage, kunde: "Löschen Sie meine Daten", mara: "…", aufId: 9004 }, tx);
    const [zl] = await tx`SELECT optionen::text AS o, empfehlung, text FROM fiaon_mara_entscheidungen WHERE id = ${kl!.id}`;
    ok(/Person anonymisieren/.test(zl.o) && zl.empfehlung === "selbst" && /§ 147 AO/.test(zl.text), "Löschwunsch eines Zahlenden: Einteilung der Zentrale (anonymisieren, § 147 AO), erst sprechen");
    // Riegel: Die Lage hat sich erledigt → „von selbst“ (über k.lauf = tx gelesen).
    const [kartenZeile] = await tx`SELECT id FROM fiaon_mara_entscheidungen WHERE schluessel = ${k3!.schluessel}`;
    await tx`UPDATE fiaon_applications SET gekuendigt_am = NOW() WHERE ref = 'FIAON-P372T1'`;
    const e1 = await me.entscheiden(Number(kartenZeile.id), "annehmen", { von: "Prüfstand", lauf: tx });
    ok(e1.ok && e1.karte?.status === "erledigt_von_selbst", `Widerruf annehmen, Vertrag schon gekündigt → „von selbst“ (${e1.karte?.ergebnis ?? e1.error})`);
    const ks = await we.waKarteAnlegen({ fall: "bestreitet", nummer: "4915900372901", personId: pid, lage: { ...lage!, paymentStatus: "pending_payment" }, kunde: "Nichts beantragt", mara: "…", aufId: 9005 }, tx);
    const [ksz] = await tx`SELECT id FROM fiaon_mara_entscheidungen WHERE id = ${ks!.id}`;
    const e2 = await me.entscheiden(Number(ksz.id), "stornieren", { von: "Prüfstand", lauf: tx });
    ok(e2.ok && e2.karte?.status === "erledigt_von_selbst", `Storno, die Bestellung ist inzwischen gekündigt/storniert → „von selbst“ (${e2.karte?.ergebnis ?? e2.error})`);
    throw ZURUECK;
  }).catch((e: any) => { if (e !== ZURUECK) throw e; });
  const [rest] = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_persons WHERE person_ref = 'PRUEF372-T1'`) as any[];
  ok(Number(rest.n) === 0, "B1 zurückgerollt — keine Prüfperson bleibt");

  console.log("\n── B2. maraAntwortet mit Attrappen (lokale Prüf-DB, Aufräumen am Ende) ──");
  const EINSTELLUNGEN = ["ki_pause", "mara_wa_an", "mara_wa_tag_euro"];
  const einstellungVorher = (await sql`SELECT key, value FROM fiaon_settings WHERE key = ANY(${EINSTELLUNGEN})`.catch(() => [])) as any[];
  const PERSONEN: number[] = [], REFS: string[] = [], NUMMERN: string[] = [];
  const KARTEN_AUFRUFE: number[] = [];
  wa.KARTEN_WEG.einladung = async (personId: number) => {
    KARTEN_AUFRUFE.push(personId);
    return { ok: true, aktion: "gesendet", satz: "Ich habe Ihnen soeben den fertigen Link unserer Partnerbank per E-Mail geschickt.", intern: "Prüfstand", stand: null, gesendet: true, grund: null, schonAm: null, betreff: null } as any;
  };
  const aufraeumen = async () => {
    for (const n of NUMMERN) {
      await sql`DELETE FROM fiaon_whatsapp WHERE nummer = ${n}`.catch(() => {});
      await sql`DELETE FROM fiaon_whatsapp_gespraech WHERE nummer = ${n}`.catch(() => {});
      await sql`DELETE FROM fiaon_mara_protokoll WHERE nummer = ${n}`.catch(() => {});
    }
    if (PERSONEN.length) {
      await sql`DELETE FROM fiaon_betreiber_todos WHERE person_id = ANY(${PERSONEN}) OR schluessel ~ ${`^wa-(${PERSONEN.join("|")})-`}`.catch(() => {});
      await sql`DELETE FROM fiaon_mara_entscheidungen WHERE person_id = ANY(${PERSONEN})`.catch(() => {});
      await sql`DELETE FROM fiaon_mara_protokoll WHERE person_id = ANY(${PERSONEN})`.catch(() => {});
      await sql`DELETE FROM fiaon_contact_log WHERE person_id = ANY(${PERSONEN}) OR ref = ANY(${REFS.length ? REFS : ["-"]})`.catch(() => {});
      await sql`DELETE FROM fiaon_abo_raten WHERE ref = ANY(${REFS.length ? REFS : ["-"]})`.catch(() => {});
      await sql`DELETE FROM fiaon_person_aliases WHERE person_id = ANY(${PERSONEN})`.catch(() => {});
      await sql`DELETE FROM fiaon_applications WHERE ref = ANY(${REFS.length ? REFS : ["-"]})`.catch(() => {});
      await sql`DELETE FROM fiaon_mara_gedaechtnis WHERE person_id = ANY(${PERSONEN})`.catch(() => {});
      await sql`DELETE FROM fiaon_loeschungen WHERE person_id = ANY(${PERSONEN})`.catch(() => {});
      await sql`DELETE FROM fiaon_persons WHERE id = ANY(${PERSONEN})`.catch(() => {});
    }
  };
  /** Eine Person mit Bestellung (bezahlt: Rate 1 bezahlt, Rate 2 offen; sonst: abgeschickt, erste Zahlung offen; lead: nie abgeschickt). */
  const kunde = async (id: string, o: { stufe: "kunde" | "b" | "lead"; tage?: number; email?: string | null }) => {
    const [p] = (await sql`INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_email, country) VALUES (${`PRUEF372-${id}`}, 'Prüf', 'Kunde', ${o.email === undefined ? `pruef372-${id}@kunde.invalid` : o.email}, 'DE') RETURNING id`) as any[];
    const personId = Number(p.id); PERSONEN.push(personId);
    const ref = `FIAON-P372${id.toUpperCase()}`; REFS.push(ref);
    const zahl = `FIAON-${`P2${id.toUpperCase()}`.padEnd(6, "X").slice(0, 6)}`;
    const tage = o.tage ?? 5;
    await sql`INSERT INTO fiaon_applications (ref, payment_reference, person_id, status, payment_status, current_step, pack_key, ist_entwurf, agb_stand, created_at, user_agent, paid_at, submitted_at, email, first_name, last_name)
      VALUES (${ref}, ${zahl}, ${personId}, ${o.stufe === "lead" ? "draft" : "approved"}, ${o.stufe === "kunde" ? "paid" : "pending_payment"}, ${o.stufe === "lead" ? 3 : 8}, 'ultra', FALSE, '2026-09-10',
              NOW() - make_interval(days => ${tage}), 'Mozilla/5.0 (Prüfstand E-372)', ${o.stufe === "kunde" ? new Date(Date.now() - tage * 86_400_000) : null},
              ${o.stufe === "lead" ? null : new Date(Date.now() - tage * 86_400_000)}, ${o.email === undefined ? `pruef372-${id}@kunde.invalid` : o.email}, 'Prüf', 'Kunde')`;
    if (o.stufe === "kunde") {
      await sql`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status, bezahlt_am) VALUES (${ref}, 1, ${`${zahl}-1`}, 9999, ${new Date(Date.now() - tage * 86_400_000)}, 'bezahlt', ${new Date(Date.now() - tage * 86_400_000)})`;
      await sql`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status) VALUES (${ref}, 2, ${`${zahl}-2`}, 9999, (NOW() AT TIME ZONE 'Europe/Berlin')::date, 'offen')`;
    }
    return { personId, ref };
  };
  /** Ein Gespräch: Maras Vorstellung von gestern (KI-Hinweis steht), dazu seine Nachricht(en) vor 20 Sekunden. */
  const gespraech = async (nummer: string, personId: number, texte: string[], maraVorher?: string) => {
    NUMMERN.push(nummer);
    await sql`DELETE FROM fiaon_whatsapp WHERE nummer = ${nummer}`;
    await sql`DELETE FROM fiaon_whatsapp_gespraech WHERE nummer = ${nummer}`.catch(() => {});
    const gestern = new Date(Date.now() - 20 * 3_600_000);
    await sql`INSERT INTO fiaon_whatsapp (richtung, nummer, typ, text, status, vorlage, von, person_id, gesendet_am, created_at)
      VALUES ('raus', ${nummer}, 'vorlage', 'Hallo, hier ist Mara, die digitale Assistentin von FIAON.', 'read', 'fiaon_kkb_test', 'Mara', ${personId}, ${gestern}, ${gestern})`;
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
    const prot = (await sql`SELECT art, text FROM fiaon_mara_protokoll WHERE (nummer = ${nummer} OR person_id = ${personId}) AND am >= ${protVorher} ORDER BY id`.catch(() => [])) as any[];
    const aufgaben = (await sql`SELECT schluessel, titel, text FROM fiaon_betreiber_todos WHERE schluessel ~ ${`^wa-${personId}-`}`.catch(() => [])) as any[];
    const karten = (await sql`SELECT id, art, schluessel, status, empfehlung, belege::text AS belege, optionen::text AS optionen FROM fiaon_mara_entscheidungen WHERE person_id = ${personId} ORDER BY id`.catch(() => [])) as any[];
    return { erg, antwort: String(g?.antwort_text ?? ""), handlung: String(g?.antwort_handlung ?? ""), prot, aufgaben, karten, modell: MODELL.slice(vorher) };
  };
  try {
    await sql`DELETE FROM fiaon_settings WHERE key = ANY(${EINSTELLUNGEN})`;
    await sql`INSERT INTO fiaon_settings (key, value) VALUES ('mara_wa_an', 'an')`;
    kp.kiPauseZwischenspeicherLeeren();

    console.log("   e1 zahlend, „Ich gehe zum Anwalt“ → fester Satz, Karte, kein Modell, keine Aufgabe");
    {
      const k = await kunde("e1", { stufe: "kunde" });
      await gespraech("4915900372001", k.personId, ["Wenn das so weitergeht, gehe ich zum Anwalt."]);
      const r = await lauf("4915900372001", k.personId);
      ok(r.modell.length === 0, "kein Modellaufruf (fester Satz)");
      ok(r.antwort.includes(wa.WA_ENTSCHEIDUNG_SATZ.rechtlich!) && !sendePruefung(r.antwort).length, `der sichere Satz liegt bereit: „${kurz(r.antwort, 140)}“`);
      ok(r.karten.length === 1 && r.karten[0].art === "wa_rechtlich" && r.karten[0].status === "offen", "eine Karte „WhatsApp: Recht“ für Justin");
      ok(!r.aufgaben.length && r.prot.some((x: any) => x.art === "entscheidung") && !r.prot.some((x: any) => x.art === "uebergabe"), "keine Aufgabe beim Betreuer, Protokoll „entscheidung“");
      // Er schreibt weiter — das Modell antwortet (Hinweis), dieselbe Karte bekommt die Nachricht, kein zweiter fester Satz.
      await sql`INSERT INTO fiaon_whatsapp (richtung, nummer, typ, text, status, von, person_id, gesendet_am, created_at) VALUES ('raus', '4915900372001', 'text', ${r.antwort}, 'read', 'Mara Prüf', ${k.personId}, NOW() - INTERVAL '10 seconds', NOW() - INTERVAL '10 seconds')`;
      await sql`INSERT INTO fiaon_whatsapp (richtung, nummer, typ, text, status, person_id, empfangen_am, created_at) VALUES ('rein', '4915900372001', 'text', 'Mein Anwalt wartet. Wann kommt die Nachricht?', 'empfangen', ${k.personId}, NOW() - INTERVAL '5 seconds', NOW() - INTERVAL '5 seconds')`;
      plan = { antworten: ["Ich verstehe Sie. Ihr Anliegen liegt bei unserer Geschäftsführung, und Sie bekommen dazu eine schriftliche Nachricht."] };
      const r2 = await lauf("4915900372001", k.personId);
      ok(r2.modell.length >= 1 && r2.modell.some((x) => /SEINE SACHE LIEGT BEI UNSERER GESCHÄFTSFÜHRUNG/.test(x.system)), "Folge-Nachricht: das Modell antwortet mit dem Hinweis „liegt bei der Geschäftsführung“");
      ok(r2.karten.length === 1 && /Mein Anwalt wartet/.test(r2.karten[0].belege), "dieselbe Karte, aufgefrischt mit seiner neuen Nachricht");
      ok(!r2.aufgaben.length && !r2.antwort.includes(wa.WA_ENTSCHEIDUNG_SATZ.rechtlich!), "keine Aufgabe, kein zweites Mal derselbe feste Satz");
    }

    console.log("   e2 zahlend seit 5 Tagen, „Ich widerrufe“ → fester Satz, Karte; Klick „Widerruf annehmen“ beendet den Vertrag");
    {
      const k = await kunde("e2", { stufe: "kunde", tage: 5 });
      await gespraech("4915900372002", k.personId, ["Hiermit widerrufe ich meinen Vertrag."]);
      const r = await lauf("4915900372002", k.personId);
      ok(r.modell.length === 0 && r.antwort.includes(wa.WA_ENTSCHEIDUNG_SATZ.widerruf!), "fester Widerrufssatz, ohne Modell");
      const karte = r.karten.find((x: any) => x.art === "wa_widerruf");
      ok(karte && karte.empfehlung === "annehmen" && !r.aufgaben.length, "Karte „Widerruf“, Empfehlung „annehmen“, keine Aufgabe");
      const e = await me.entscheiden(Number(karte.id), "annehmen", { von: "Prüfstand E-372" });
      const [a] = (await sql`SELECT gekuendigt_am, kuendigung_quelle, vertrag_ende_am FROM fiaon_applications WHERE ref = ${k.ref}`) as any[];
      const [o] = (await sql`SELECT COUNT(*) FILTER (WHERE status = 'offen')::int AS offen, COUNT(*) FILTER (WHERE storno_grund = 'kuendigung_kulanz')::int AS kulanz FROM fiaon_abo_raten WHERE ref = ${k.ref}`) as any[];
      ok(e.ok && e.karte?.status === "entschieden" && a?.gekuendigt_am && a.kuendigung_quelle === "whatsapp" && Number(o.offen) === 0 && Number(o.kulanz) === 1,
        `Klick: Vertrag sofort beendet, offene Rate entfällt (${kurz(e.karte?.ergebnis ?? e.error, 160)})`);
      const e2 = await me.entscheiden(Number(karte.id), "annehmen", { von: "Prüfstand E-372" });
      ok(e2.ok && e2.schon, "zweiter Klick auf die entschiedene Karte tut nichts");
    }

    console.log("   e3 B (erste Zahlung offen), „Ich widerrufe“ → Mara fragt verbindlich nach dem Storno, keine Karte, keine Aufgabe");
    {
      const k = await kunde("e3", { stufe: "b" });
      await gespraech("4915900372003", k.personId, ["Ich widerrufe die Bestellung."]);
      plan = { antworten: [`Verstanden. ${ton.STORNO_RUECKFRAGE}`] };
      const r = await lauf("4915900372003", k.personId);
      ok(r.modell.some((x) => /ER WIDERRUFT SEINE UNBEZAHLTE BESTELLUNG/.test(x.system)), "das Modell weiß: Widerruf einer unbezahlten Bestellung = Storno (Hinweis)");
      ok(r.antwort.includes(ton.STORNO_RUECKFRAGE) && !r.karten.length && !r.aufgaben.length, "die Storno-Rückfrage, keine Karte, keine Aufgabe");
      // Er sagt Ja → kuendigung_aufnehmen bucht das Storno (ausstiegThema zählt den Widerruf bei unbezahlter Bestellung).
      await sql`INSERT INTO fiaon_whatsapp (richtung, nummer, typ, text, status, von, person_id, gesendet_am, created_at) VALUES ('raus', '4915900372003', 'text', ${r.antwort}, 'read', 'Mara Prüf', ${k.personId}, NOW() - INTERVAL '10 seconds', NOW() - INTERVAL '10 seconds')`;
      await sql`INSERT INTO fiaon_whatsapp (richtung, nummer, typ, text, status, person_id, empfangen_am, created_at) VALUES ('rein', '4915900372003', 'text', 'Ja', 'empfangen', ${k.personId}, NOW() - INTERVAL '5 seconds', NOW() - INTERVAL '5 seconds')`;
      plan = { werkzeug: { name: "kuendigung_aufnehmen", args: { zitat: "Ja" } }, antworten: ["{SO_SCHREIBEN}"] };
      const r2 = await lauf("4915900372003", k.personId);
      const [a] = (await sql`SELECT payment_status, gekuendigt_am FROM fiaon_applications WHERE ref = ${k.ref}`) as any[];
      ok(a?.payment_status === "cancelled" && a.gekuendigt_am && !r2.aufgaben.length && !r2.karten.length, `nach seinem Ja: storniert, keine Aufgabe, keine Karte („${kurz(r2.antwort, 120)}“)`);
    }

    console.log("   e4 zahlend, „Ich möchte kündigen“ → die verbindliche Rückfrage, keine Aufgabe (Protokoll „selbst“)");
    {
      const k = await kunde("e4", { stufe: "kunde" });
      await gespraech("4915900372004", k.personId, ["Ich möchte kündigen, das bringt mir nichts."]);
      plan = { antworten: [`Das verstehe ich. ${ton.KUENDIGUNG_RUECKFRAGE}`] };
      const r = await lauf("4915900372004", k.personId);
      ok(r.antwort.includes(ton.KUENDIGUNG_RUECKFRAGE) && !r.aufgaben.length && !r.karten.length, "Rückfrage, keine Aufgabe, keine Karte");
      ok(r.prot.some((x: any) => x.art === "selbst"), "Protokoll „selbst“ (vorher: Aufgabe „Kündigung, Widerruf oder Beschwerde“)");
    }

    console.log("   e5 zahlend, „kann nicht zahlen“ → Angebot der Ratenpause; „Ja“ → ratenpause_setzen verschiebt die Rate");
    {
      const k = await kunde("e5", { stufe: "kunde" });
      await gespraech("4915900372005", k.personId, ["Ich kann diesen Monat nicht zahlen, ich bin arbeitslos geworden."]);
      plan = { antworten: ["Das tut mir leid. Soll ich Ihre Raten einmal um einen Monat verschieben? Bis dahin bekommen Sie keine Erinnerung."] };
      const r = await lauf("4915900372005", k.personId);
      ok(r.modell.some((x) => /ER KANN GERADE NICHT ZAHLEN/.test(x.system) && x.tools.includes("ratenpause_setzen")), "das Modell bekommt den Hinweis und das Werkzeug ratenpause_setzen");
      ok(!r.aufgaben.length && !r.karten.length && !fordertZahlung(r.antwort), "keine Aufgabe, keine Karte, keine Zahlungsbitte");
      await sql`INSERT INTO fiaon_whatsapp (richtung, nummer, typ, text, status, von, person_id, gesendet_am, created_at) VALUES ('raus', '4915900372005', 'text', ${r.antwort}, 'read', 'Mara Prüf', ${k.personId}, NOW() - INTERVAL '10 seconds', NOW() - INTERVAL '10 seconds')`;
      await sql`INSERT INTO fiaon_whatsapp (richtung, nummer, typ, text, status, person_id, empfangen_am, created_at) VALUES ('rein', '4915900372005', 'text', 'Ja gerne', 'empfangen', ${k.personId}, NOW() - INTERVAL '5 seconds', NOW() - INTERVAL '5 seconds')`;
      const [vor] = (await sql`SELECT faellig_am::text AS f FROM fiaon_abo_raten WHERE ref = ${k.ref} AND rate_nr = 2`) as any[];
      plan = { werkzeug: { name: "ratenpause_setzen", args: { zitat: "Ja gerne" } }, antworten: ["{SO_SCHREIBEN}"] };
      const r2 = await lauf("4915900372005", k.personId);
      const [nach] = (await sql`SELECT faellig_am::text AS f FROM fiaon_abo_raten WHERE ref = ${k.ref} AND rate_nr = 2`) as any[];
      ok(nach.f > vor.f && /Erledigt — Ihre Rate 2 ist jetzt am/.test(r2.antwort) && !r2.aufgaben.length && !r2.karten.length, `Rate verschoben (${vor.f} → ${nach.f}), Satz aus dem Werkzeug, keine Aufgabe`);
      // Ein zweites Mal in 60 Tagen: Härtefall-Karte für Justin, NICHTS verschoben.
      await sql`INSERT INTO fiaon_whatsapp (richtung, nummer, typ, text, status, person_id, empfangen_am, created_at) VALUES ('rein', '4915900372005', 'text', 'Kann ich die Rate noch einmal aussetzen?', 'empfangen', ${k.personId}, NOW() - INTERVAL '2 seconds', NOW() - INTERVAL '2 seconds')`;
      plan = { werkzeug: { name: "ratenpause_setzen", args: { zitat: "noch einmal aussetzen" } }, antworten: ["Darüber entscheidet unsere Geschäftsführung — Sie bekommen dazu Bescheid."] };
      const r3 = await lauf("4915900372005", k.personId);
      const [nach2] = (await sql`SELECT faellig_am::text AS f FROM fiaon_abo_raten WHERE ref = ${k.ref} AND rate_nr = 2`) as any[];
      const hk = r3.karten.find((x: any) => x.art === "wa_ratenpause");
      ok(nach2.f === nach.f && hk && hk.empfehlung === "pause" && !r3.aufgaben.length, "zweite Pause in 60 Tagen: nichts verschoben, Härtefall-Karte (Empfehlung „Pause trotzdem setzen“), keine Aufgabe");
    }

    console.log("   e6 „Bitte rufen Sie mich an“ (kein Termin) → bleibt beim Betreuer");
    {
      const k = await kunde("e6", { stufe: "kunde" });
      await gespraech("4915900372006", k.personId, ["Bitte rufen Sie mich an, ich möchte das persönlich besprechen."]);
      plan = { antworten: ["Sehr gern, Ihr Betreuer ruft Sie an."], mensch: true, uebergabe: "Kunde möchte angerufen werden, um es persönlich zu besprechen." };
      const r = await lauf("4915900372006", k.personId);
      ok(r.aufgaben.length === 1 && /rueckruf|anliegen/.test(String(r.aufgaben[0].schluessel)) && !r.karten.length, `Aufgabe beim Betreuer (${r.aufgaben.map((x: any) => x.schluessel).join(", ")}), keine Karte`);
    }

    console.log("   e7 Lead (nie abgeschickt), „Löschen Sie meine Daten“ → fester Satz, Karte „Daten löschen“; Klick löscht");
    {
      const k = await kunde("e7", { stufe: "lead" });
      await gespraech("4915900372007", k.personId, ["Löschen Sie bitte alle meine Daten."]);
      const r = await lauf("4915900372007", k.personId);
      const karte = r.karten.find((x: any) => x.art === "wa_loeschen");
      ok(r.antwort.includes(ton.loeschAntwort("whatsapp")) && karte && karte.empfehlung === "loeschen" && !r.aufgaben.length, "Bestätigung liegt bereit, Karte „Daten löschen“ empfohlen, keine Aufgabe an die Leitung");
      const e = await me.entscheiden(Number(karte.id), "loeschen", { von: "Prüfstand E-372" });
      const [p] = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_persons WHERE id = ${k.personId}`) as any[];
      ok(e.ok && Number(p.n) === 0, `Klick: endgültig gelöscht (${kurz(e.karte?.ergebnis ?? e.error, 120)})`);
    }

    console.log("   e8 zahlend, keine E-Mail-Adresse — er schickt sie: angaben_eintragen trägt sie ein, der Link geht raus");
    {
      const k = await kunde("e8", { stufe: "kunde", email: null });
      NUMMERN.push("4915900372008");
      const ctx = { personId: k.personId, leadId: null, nummer: "4915900372008", kunde: "Meine Adresse ist pruef372-e8-neu@kunde.invalid", kundeFrei: "Meine Adresse ist pruef372-e8-neu@kunde.invalid", stufe: "kunde" as const };
      const vorher = KARTEN_AUFRUFE.length;
      const r = await wa.werkzeugAusfuehren("angaben_eintragen", { email: "pruef372-e8-neu@kunde.invalid" }, ctx);
      const [a] = (await sql`SELECT a.email, p.primary_email FROM fiaon_applications a JOIN fiaon_persons p ON p.id = a.person_id WHERE a.ref = ${k.ref}`) as any[];
      ok(r.aktion.ok && a?.email === "pruef372-e8-neu@kunde.invalid" && a.primary_email === "pruef372-e8-neu@kunde.invalid", "E-Mail an Bestellung UND Person (derselbe Weg wie die Akte)");
      ok(KARTEN_AUFRUFE.length === vorher + 1 && /eingetragen/.test(String(r.ergebnis.so_schreiben)) && /Link unserer Partnerbank/.test(String(r.ergebnis.so_schreiben)), `der Link ging raus, der Satz sagt beides („${kurz(r.ergebnis.so_schreiben, 140)}“)`);
      const r2 = await wa.werkzeugAusfuehren("angaben_eintragen", { email: "erfunden@kunde.invalid" }, ctx);
      ok(!r2.aktion.ok, "eine Adresse, die er nicht geschrieben hat, wird nicht eingetragen");
    }

    console.log("   e9 zahlend, Sachfrage — der erste Entwurf sagt „Ihr Betreuer meldet sich“ → harte Wand, zweiter Entwurf, keine Aufgabe");
    {
      const k = await kunde("e9", { stufe: "kunde" });
      await gespraech("4915900372009", k.personId, ["Wie lange dauert es nach der Zusage der Bank, bis ich die Karte habe?"]);
      plan = { antworten: ["Das prüft Ihr Betreuer, er meldet sich bei Ihnen.", "Nach der Zusage der Bank dauert es in der Regel 2–5 Werktage, meist haben Sie vorher schon Apple Pay."] };
      const r = await lauf("4915900372009", k.personId);
      ok(r.modell.some((x) => x.zweiter) && /2–5 Werktage/.test(r.antwort) && !/meldet sich/.test(r.antwort), "die Zusage fiel an der Wand, der zweite Entwurf ging raus");
      ok(!r.aufgaben.length && !r.karten.length, "keine Aufgabe, keine Karte");
    }

    console.log("   e10 zahlend, eine Frage, die niemand außer Justin beantworten kann → Karte „Frage an dich“");
    {
      const k = await kunde("e10", { stufe: "kunde" });
      await gespraech("4915900372010", k.personId, ["Die Seite bleibt nach der Adresse komplett schwarz."]);
      plan = { antworten: ["Danke für den Hinweis! Unsere Geschäftsführung klärt das, und Sie bekommen dazu Bescheid."], mensch: true, uebergabe: "Darstellung nach der Adresse schwarz — bitte technisch prüfen." };
      const r = await lauf("4915900372010", k.personId);
      ok(r.karten.length === 1 && r.karten[0].art === "wa_frage" && !r.aufgaben.length, "Karte „Frage an dich“ statt Aufgabe beim Betreuer");
      ok(!wa.istRueckfall(r.antwort) && /Geschäftsführung klärt/.test(r.antwort), "Maras ehrliche Antwort geht raus (mit mensch true ist „die Geschäftsführung klärt“ gedeckt) — kein Rückfallsatz");
      // Dasselbe, aber er nennt dabei die Karte (ein Thema, das Mara sonst selbst kann): die Zusage zwingt trotzdem zur Karte.
      await gespraech("4915900372012", k.personId, ["Die Seite für die Karte bleibt komplett schwarz."]);
      const r2 = await lauf("4915900372012", k.personId);
      ok(r2.karten.length === 1 && r2.karten[0].art === "wa_frage" && /Seite für die Karte/.test(r2.karten[0].belege) && !r2.aufgaben.length, "Zusage „Geschäftsführung klärt“ + Kartenthema → dieselbe Karte (nie „selbst“)");
    }

    console.log("   e11 B (abgeschickt), „Ich habe nichts beantragt“ → fester Satz, Karte „Bestellung stornieren“; Klick storniert ohne Mail");
    {
      const k = await kunde("e11", { stufe: "b" });
      await gespraech("4915900372011", k.personId, ["Ich habe nichts beantragt."]);
      const r = await lauf("4915900372011", k.personId);
      const karte = r.karten.find((x: any) => x.art === "wa_bestreitet");
      ok(r.modell.length === 0 && r.antwort.length > 0 && karte && karte.empfehlung === "stornieren" && !r.aufgaben.length, "fester Satz, Karte „Bestellung stornieren“, keine Aufgabe an die Leitung");
      const e = await me.entscheiden(Number(karte.id), "stornieren", { von: "Prüfstand E-372" });
      const [a] = (await sql`SELECT payment_status, gekuendigt_am FROM fiaon_applications WHERE ref = ${k.ref}`) as any[];
      ok(e.ok && a?.payment_status === "cancelled" && a.gekuendigt_am, `Klick: storniert (${kurz(e.karte?.ergebnis ?? e.error, 120)})`);
    }
  } catch (e) {
    fehler++;
    console.error("ABBRUCH:", e);
  } finally {
    plan = null;
    await aufraeumen().catch((e) => console.error("Aufräumen:", e));
    await sql`DELETE FROM fiaon_settings WHERE key = ANY(${EINSTELLUNGEN})`.catch(() => {});
    for (const r of einstellungVorher) await sql`INSERT INTO fiaon_settings (key, value) VALUES (${r.key}, ${r.value}) ON CONFLICT (key) DO UPDATE SET value = ${r.value}`.catch(() => {});
    const [rest2] = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_persons WHERE person_ref LIKE 'PRUEF372-%'`.catch(() => [{ n: -1 }])) as any[];
    ok(Number(rest2.n) === 0, `Aufgeräumt: keine PRUEF372-Personen mehr (${rest2.n})`);
    ok(!FREMD.length, `kein fremder Netzaufruf${FREMD.length ? ` (${FREMD.slice(0, 3).join(", ")})` : ""}`);
    await sql.end().catch(() => {});
  }
}

console.log(`\n${fehler ? "✗" : "✓"} ${geprueft - fehler}/${geprueft} Prüfungen bestanden${MIT_DB ? " (mit DB)" : " (offline)"}`);
process.exit(fehler ? 1 : 0);
