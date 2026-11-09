// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-476 Scheibe 4 (05.11.2026): LEAD-MAILS AUS EINEM GUSS — Willkommen sofort aus js@, Nachfass N1–N3 im selben
// Faden, Antworten in js@ landen richtig, Bestätigung/Erinnerungen im Business-Rahmen „FIAON Global“, Privatkunden-Weiche.
//
//   A  REIN (immer, ohne Datenbank, ohne Netz):
//      Seine Antworten für den Kunden (Sie-Form, ohne Betrag, deutsch + britisch) · W für JEDE Antwort-Kombination beider
//      Meta-Formulare (Kapital 4×4×4, US 5×4×5) in beiden Sprachen durch die Wand (Platzhalter-Wache, Wortwand, Global-Regeln,
//      kein Bank-Satz, keine Zahl, kein „Geschenk“, kein Partnername, Sie-Form) · Website/Nachtrag/Bestandskunde/Österreich/
//      ohne Link · wer anruft (Wochentag, nie „morgen“) · N1/N2/N3 · Platzhalter-Wache · Stopp-Tabelle · Mail-Budget ·
//      Werktage/Feiertage/Fälligkeit/Sendefenster · „keine Mails“ (eindeutig, nie ein Halbsatz) · Wunschzeit · Privat-Weiche ·
//      die Matrix „Mail – Auslöser – Absender – Stopp“ gegen den Motor · global_termin (de + en) · Vortag-Absatz · die
//      Datenzeilen-Regel des Motors · Info-Mail-Fassungen · HTML/Text im Gmail-Stil · Quelltext-Wände.
//   B  LOKALE DATENBANK — eine WEGWERF-KOPIE (DATABASE_URL auf 127.0.0.1:54329/fiaon_pruefstand…), Gmail und die Meldungen an
//      Justin über Attrappen: Schalter AUS → nichts · Einschalten = Zählbeginn, Altbestand still · W nach der Ruhe genau
//      einmal (Link, Unterschrift, Fuß, Protokoll versandweg google, Cockpit, N1-Fälligkeit) · zweiter Eingang derselben
//      Adresse · Handmail · Buchung in der Ruhezeit (Bestätigung mit SEINEN Sätzen) · unklarer Versand → Gesendet-Abgleich,
//      kein zweiter Versand · Postfach gestört → kein Versuch verbraucht · N1 im Faden (Schalter, Fälligkeit, Budget) ·
//      Antwort → Stopp + Auftrag mit Wunschzeit + Meldung · „keine Mails“ · Rückläufer · Justin schreibt selbst · Privat-Weg
//      (Beschwerde → Leitung, Privatkunde → Betreuer, Bestandskunde → eigene Fassung) · Info-Mail-Urteil · Dossier-Satz ·
//      wer anruft (mit Abwesenheits-Stand) · die Läufe lead_post/lead_nachfass · „nicht erreicht“ mit persönlichem Link ·
//      Vorschau · das Entwurf-Skript (--lokal) ändert nichts.
//
//   env -i HOME="$HOME" PATH="$PATH" TZ=Europe/Berlin CRONS=aus node_modules/.bin/tsx scripts/pruef-lead-mails.ts   (nur A)
//   createdb -h 127.0.0.1 -p 54329 -U fiaon -T fiaon_pruefstand fiaon_pruefstand_lm4; dann mit
//     DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_lm4?sslmode=require'   (A + B), danach dropdb.
//
// Verschickt nichts: Schlüssel in der Umgebung → Abbruch; Lead-Mails über die Gmail-Attrappe, Mails an Justin über die
// Meldungs-Attrappe, Kundenmails des Motors ohne Brevo-Schlüssel (Protokoll „fehlgeschlagen“). Repo öffentlich: nur erfundene
// Menschen (*.example, Nullnummern).
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

if (!process.env.DATABASE_URL) process.env.DATABASE_URL = "postgresql://pruef@127.0.0.1:9/keine";
const URL_DB = String(process.env.DATABASE_URL);
const LOKAL_DB = /@(127\.0\.0\.1|localhost):54329\/fiaon_pruefstand[A-Za-z0-9_]*(\?|$)/.test(URL_DB);
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "TWILIO_AUTH_TOKEN", "WHATSAPP_TOKEN", "META_APP_SECRET", "META_SYSTEM_TOKEN", "DATABASE_URL_EXTERN", "OPENREGISTER_API_KEY", "GMAIL_SERVICE_ACCOUNT_JSON", "GOOGLE_SA_KEY"]) {
  if (process.env[k]) { console.error(`ABBRUCH: ${k} ist gesetzt — dieser Prüfstand läuft nur ohne Schlüssel und nur gegen eine lokale Datenbank.`); process.exit(3); }
}
if (String(process.env.CRONS ?? "").toLowerCase() !== "aus") { console.error("ABBRUCH: bitte mit CRONS=aus starten."); process.exit(3); }

let geprueft = 0, fehler = 0;
const ok = (b: unknown, t: string) => { geprueft++; if (!b) { fehler++; console.log(`  ✗ ${t}`); } };
const gleich = (ist: unknown, soll: unknown, t: string) => ok(ist === soll, `${t} — ist: ${JSON.stringify(ist)}, soll: ${JSON.stringify(soll)}`);
const abschnitt = (t: string) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 70 - t.length))}`);
const WURZEL = join(dirname(fileURLToPath(import.meta.url)), "..");
const lies = (p: string) => readFileSync(join(WURZEL, p), "utf8");
const BANK_SATZ = /entscheidet das jeweilige Institut|Institut entscheidet|Bank entscheidet|die Bank entscheidet|institution decides|bank decides/i;
// Viele Fälle, eine Zeile je Regel: sammeln, dann auswerten.
const sammel = new Map<string, string[]>();
const pruefe = (b: unknown, regel: string, fall: string) => { if (!sammel.has(regel)) sammel.set(regel, []); if (!b) sammel.get(regel)!.push(fall); };
const sammelAus = (n: number) => {
  sammel.forEach((faelle, regel) => ok(faelle.length === 0, `${regel} (${n} Fassungen)${faelle.length ? ` — ${faelle.length}× z. B. ${faelle.slice(0, 3).join(" | ")}` : ""}`));
  sammel.clear();
};
const jsonLesen = (v: unknown): any => { let o: any = v; for (let i = 0; i < 2 && typeof o === "string"; i++) { try { o = JSON.parse(o); } catch { break; } } return o; };

const T = await import("../shared/fiaon-global-lead-texte");
const GL = await import("../shared/fiaon-global-lead");
const LP = await import("../server/lib/fiaon-global-lead-post");
const { mailRendern, absenderFuer, antwortAnFuer } = await import("../server/mail/motor");
const { MAKE_EVENT_REGISTRY } = await import("../server/make-events-registry");
const { wandPruefen } = await import("../shared/fiaon-wortverbote");
const { radarBankVorbehalt } = await import("../shared/fiaon-radar");
const { globalInfoMail } = await import("../shared/fiaon-global-vertrieb");
const { GLOBAL_PAKETE, GLOBAL_GELD_ZURUECK, globalPreisText } = await import("../shared/fiaon-global");
const { FIAON_FIRMA } = await import("../shared/fiaon-firma");
const { istFeiertag } = await import("../shared/fiaon-feiertage");

type Antwort = { schluessel: string | null; frage: string; antwort: string; code: string | null };
const A = (code: string): Antwort => ({ schluessel: code.replace(/_\d+$/, ""), frage: `${code}?`, antwort: code, code });
const LINK = { url: "https://fiaon.com/g/AbCdEfGh23", anzeige: "fiaon.com/g/AbCdEfGh23", bis: new Date("2026-12-05T10:00:00Z") };
const JETZT = new Date("2026-11-05T14:00:00Z"); // Donnerstag, 15:00 Uhr Berlin
const RUF = { kollege: "Daniel Beispiel", weiblich: false, art: "heute" as const };
const W = (over: Record<string, unknown> = {}) => T.willkommenText({
  sprache: "de", name: "Max Mustermann", kanal: "meta", antworten: [], mitNachricht: false, paketName: null, oesterreich: false,
  bestandskunde: false, link: LINK, eingangAm: new Date(JETZT.getTime() - 12 * 60_000), jetzt: JETZT, ruf: RUF, ...over,
} as any);
const klar = (m: any) => T.leadMailKlartext(m);

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("A1 Seine Antworten für den Kunden — Sie-Form, ohne Betrag (deutsch + britisch)");
{
  const de = Object.keys(GL.KUNDEN_SATZ).sort(), en = Object.keys(T.KUNDEN_SATZ_EN).sort();
  gleich(en.join(","), de.join(","), "dieselben Options-Schlüssel deutsch und englisch");
  for (const k of de) {
    const sd = GL.KUNDEN_SATZ[k], se = T.KUNDEN_SATZ_EN[k] ?? "";
    pruefe(!/\d|\$|€/.test(sd + se), "kein Betrag, keine Ziffer", k);
    pruefe(!/\b(ich|mein\w*|noch offen)\b/i.test(sd), "deutsch ohne „ich/mein/noch offen“ (kein Formular-Echo)", k);
    pruefe(!/\b(du|dich|dir|dein\w*)\b/i.test(sd), "deutsch siezt", k);
    pruefe(!/\b(my|still open)\b/i.test(se), "englisch ohne „my/still open“", k);
    pruefe(!sd === !se, "leer genau dann, wenn auch die andere Sprache leer ist", k);
  }
  sammelAus(de.length);
  const a = ["vorhaben_3", "kapitalrahmen_ziel_2", "wann_starten_1"].map(A);
  gleich(T.kundenSatzFuer(a, "de"), "Sie möchten beides: den Weg zum Kapital und ein Geschäft in den USA. Ihr Ziel für den Kapitalrahmen liegt mir vor. Sie möchten so bald wie möglich starten.", "kundenSatzFuer: Justins Stimme");
  ok(T.kundenSatzFuer(a, "de", "wir").includes("liegt uns vor") && T.kundenSatzFuer(a, "en", "wir").includes("We have your target"), "Rahmen-Stimme „wir“ (Bestätigung)");
  gleich(T.angabenSatz(a, "de"), "Ihre Angaben aus dem Formular liegen uns vor. Sie möchten so bald wie möglich beides angehen: den Weg zum Kapital und ein Geschäft in den USA.", "angabenSatz: EIN Satz aus Vorhaben × Start — ohne Rahmen, ohne Klammer, ohne Betrag (Gutachten Lead-Sicht, Mangel 4)");
  ok(T.angabenSatz(a, "en").startsWith("We have the details from your form. You would like to pursue both as soon as possible"), "angabenSatz britisch");
  ok(!T.angabenSatz(["wofuer_2", "wann_gruenden_1", "rolle_2"].map(A), "de").includes("Geschäftsführung"), "angabenSatz: die Rolle steht nie im Kundentext");
  gleich(T.angabenSatz([], "de"), "", "ohne Antworten: leer (der Absatz entfällt)");
  gleich(T.angabenSatz([A("kapitalrahmen_ziel_2")], "de"), "Ihre Angaben aus dem Formular liegen uns vor.", "nur der Rahmen: nur der Einleitungssatz");
  gleich(T.angabenSatz([A("kapitalrahmen_ziel_4")], "de"), "", "Rahmen „weiß nicht“: leer");
  gleich(T.angabenSatz([{ schluessel: null, frage: "Was planen Sie?", antwort: "250.000 $ Kredit", code: null }], "de"), "", "Freitext ohne Code: nie ein Echo");
}

abschnitt("A2 W Willkommen — jede Antwort-Kombination beider Meta-Formulare, deutsch und britisch, durch die Wand");
{
  const reihe = (p: string, n: number) => Array.from({ length: n }, (_, i) => `${p}_${i + 1}`);
  const kombis = (f: string[][]) => f[0].flatMap((x) => f[1].flatMap((y) => f[2].map((z) => [x, y, z])));
  const formulare: [string, string[][]][] = [
    ["Kapital", kombis([reihe("vorhaben", 4), reihe("kapitalrahmen_ziel", 4), reihe("wann_starten", 4)])],
    ["US", kombis([reihe("wofuer", 5), reihe("wann_gruenden", 4), reihe("rolle", 5)])],
  ];
  let n = 0;
  for (const [form, liste] of formulare) {
    for (const codes of liste) for (const sprache of ["de", "en"] as const) {
      n++;
      const antworten = codes.map(A);
      const m = W({ sprache, antworten });
      const fall = `${form} ${codes.join("+")} ${sprache}`;
      const funde = await LP.leadMailPruefen(m);
      pruefe(funde.length === 0, "Wand: kein Fund", `${fall}: ${funde.join("; ")}`);
      const k = klar(m);
      const seine = String((m.bloecke[1] as any).text ?? "");
      pruefe(k.includes(LINK.url), "der persönliche Link steht drin", fall);
      pruefe(sprache === "de" ? k.startsWith("Guten Tag Max Mustermann,") : k.startsWith("Dear Max Mustermann,"), "Anrede", fall);
      pruefe(sprache === "de" ? k.includes("Ihre Angaben sind bei mir angekommen.") : k.includes("Your details have reached me."), "„angekommen“, nie „gelesen“ (Gutachten 1, Mangel 16)", fall);
      pruefe(!/gelesen/i.test(k), "kein „gelesen“", fall);
      pruefe(!/\d/.test(seine), "seine Angaben ohne Ziffer (kein Betrag)", fall);
      const vs = T.vorhabenSatz(antworten, sprache);
      pruefe(!vs.satz || seine.includes(vs.satz), "sein Vorhaben steht als EIN Satz drin (Gutachten Lead-Sicht, Mangel 4)", fall);
      pruefe(!/liegt mir vor|I have your target|Geschäftsführung|managing director|eigenes Unternehmen|own a business/i.test(k), "kein „liegt mir vor“, kein Rahmen-Satz, keine Rolle im Kundentext", fall);
      pruefe(!/(Sie möchten[^.]*\.)\s*Sie möchten/.test(seine) && !/(You would like[^.]*\.)\s*You would like/.test(seine), "nie zwei „Sie möchten“-Sätze hintereinander", fall);
      const woerter = (seine.toLowerCase().match(/[a-zäöüß]{5,}/g) ?? []);
      pruefe(woerter.length === new Set(woerter).size, "im Vorhaben-Absatz kein Wort doppelt (kein „starten … bald starten“)", fall);
      pruefe((k.match(/[–—]/g) ?? []).length <= 1, "höchstens ein Gedankenstrich je Mail (Gutachten Lead-Sicht, Mangel 19)", fall);
      pruefe(!/genau dann|at exactly that time/i.test(k), "keine Zusage „wir rufen Sie genau dann an“ (Gutachten Lead-Sicht, Mangel 2)", fall);
      const kap = sprache === "de" ? "Erst die US-Gesellschaft, dann der Weg zum Kapital" : "First the US company, then the route to capital";
      pruefe(k.includes(kap) === T.willKapital(antworten), "Kapital-Satz genau dann, wenn er den Weg zum Kapital will", fall);
      pruefe(k.toLowerCase().includes(sprache === "de" ? "wir kümmern uns um alles bis zur unterschrift bei der bank." : "we take care of everything right through to the signature at the bank."), "Justins Satz statt „von Anfang bis Ende“ (Gutachten 1, Mangel 8)", fall);
      pruefe(!vs.folge || seine.endsWith(vs.folge), "der Folgesatz zum Start passt zu seiner Antwort (und wiederholt den Start nicht)", fall);
      pruefe(k.includes(sprache === "de" ? "Steuerberatern und Unternehmensberatern" : "tax advisers and business consultants"), "Partner-Satz (Deutschland/Schweiz)", fall);
      pruefe(m.betreff === T.LEAD_BETREFF[sprache] && m.fussSatz === T.LEAD_FUSS_SATZ[sprache] && m.gruss === T.LEAD_GRUSS[sprache], "Betreff, Abmelde-Satz, Gruß", fall);
      pruefe(sprache === "de" ? k.includes("auf Deutsch") : !k.includes("auf Deutsch") && k.includes("by phone"), "Gesprächssprache", fall);
    }
  }
  sammelAus(n);
}

abschnitt("A3 W-Fassungen: Website, Nachtrag, Bestandskunde, Österreich, ohne persönlichen Link, britisch");
{
  const faelle: [string, any][] = [];
  const web = W({ kanal: "website" });
  faelle.push(["Website", web]);
  ok(klar(web).includes("Sie möchten wissen, wie FIAON Global für Sie funktioniert.") && !klar(web).includes("Erst die US-Gesellschaft"), "Website ohne Nachricht: neutraler Satz, keine Liste, kein Kapital-Satz");
  const webN = W({ kanal: "website", mitNachricht: true });
  faelle.push(["Website mit Nachricht", webN]);
  ok(klar(webN).includes("Sie haben uns kurz beschrieben, worum es Ihnen geht. Genau darauf gehe ich im Gespräch ein."), "Website mit Nachricht: nie zitiert, nur „Sie haben uns kurz beschrieben“");
  const webP = W({ kanal: "website", paketName: "FIAON Global Struktur (2.499 €)" });
  faelle.push(["Website mit Paket", webP]);
  ok(klar(webP).includes("Sie interessieren sich für FIAON Global Struktur.") && !/2\.499|€/.test(klar(webP)), "Paketwunsch nur mit Namen, nie mit Preis");
  const echo = W({ antworten: [{ schluessel: "x", frage: "Wie viel Kapital?", antwort: "250.000 $", code: null }] });
  faelle.push(["Meta ohne bekannte Option", echo]);
  ok(!klar(echo).includes("250.000") && klar(echo).includes("Sie möchten wissen, wie FIAON Global für Sie funktioniert."), "Meta-Antwort ohne bekannte Option: kein Formular-Echo, neutraler Satz");
  const nach = W({ eingangAm: new Date(JETZT.getTime() - 2 * 3_600_000) });
  faelle.push(["Nachtrag", nach]);
  ok(klar(nach).includes("vielen Dank für Ihre Anfrage von heute.") && !/entschuldigen|angekommen|05\.11\./i.test(klar(nach)), "Nachtrag am selben Tag (2 Std.): „von heute“, keine Entschuldigung, kein Datum, kein „angekommen“ (Gutachten Lead-Sicht, Mangel 14)");
  ok(!klar(W()).includes("ntschuldigen Sie"), "nach 12 Minuten: kein Nachtrag");
  const spaet = W({ eingangAm: new Date(JETZT.getTime() - 13 * 3_600_000) });
  faelle.push(["Nachtrag nach 13 Std.", spaet]);
  ok(klar(spaet).includes("Sie hatten sich heute bei uns gemeldet. Entschuldigen Sie bitte, dass Sie erst jetzt von mir hören, und vielen Dank für Ihre Anfrage."), "nach mehr als 12 Stunden: die Entschuldigung, „heute“ statt Datum");
  const gesternAbend = W({ eingangAm: new Date("2026-11-04T20:30:00Z") });
  faelle.push(["Nachtrag gestern Abend", gesternAbend]);
  ok(klar(gesternAbend).includes("Sie hatten sich gestern Abend bei uns gemeldet."), "Nachtrag: „gestern Abend“");
  const nachEn = W({ sprache: "en", eingangAm: new Date(JETZT.getTime() - 26 * 3_600_000) });
  faelle.push(["Nachtrag en", nachEn]);
  ok(klar(nachEn).includes("You contacted us yesterday. Please excuse that you are only hearing from me now, and thank you for your enquiry."), "Nachtrag britisch: „yesterday“, kein Datum");
  const best = W({ bestandskunde: true });
  faelle.push(["Bestandskunde", best]);
  ok(klar(best).includes("vielen Dank für Ihre Anfrage. Schön, dass Sie sich auch für FIAON Global interessieren. Ihre Angaben sind bei mir angekommen."), "Bestandskunde mit Global-Interesse: eigene Fassung (Gutachten 1, Mangel 1)");
  const wunsch = W({ kanal: "website", wunschzeit: "Dienstag ab 14 Uhr" });
  faelle.push(["Rückruf mit Wunschzeit", wunsch]);
  ok(klar(wunsch).includes("Sie möchten am liebsten zu dieser Zeit angerufen werden: Dienstag ab 14 Uhr. Mein Kollege Daniel Beispiel meldet sich dann bei Ihnen.")
    && klar(wunsch).includes("Lieber gleich einen festen Termin mit mir? Hier geht es, Ihre Angaben sind schon eingetragen:") && !klar(wunsch).includes("Passt Ihnen keine der Zeiten"), "Rückruf statt Termin: seine Wunschzeit gilt, der Link nur als Angebot (Gutachten Lead-Sicht, Mangel 7)");
  const wunschBoese = W({ kanal: "website", wunschzeit: "jederzeit, siehe www.preis-sofort.example" });
  faelle.push(["Wunschzeit mit Adresse", wunschBoese]);
  ok(!klar(wunschBoese).includes("preis-sofort") && klar(wunschBoese).includes("Passt Ihnen keine der Zeiten"), "eine Wunschzeit mit Adresse steht nie in Justins Mail");
  const leerKal = W({ kalenderLeer: true });
  faelle.push(["Kalender leer", leerKal]);
  ok(!klar(leerKal).includes(LINK.url) && !/wählen Sie hier/.test(klar(leerKal)) && klar(leerKal).includes("vereinbart mit Ihnen einen Termin"), "Kalender leer: kein „hier wählen Sie“, sondern wer anruft und den Termin vereinbart (Gutachten Lead-Sicht, Mangel 8)");
  const at = W({ oesterreich: true, antworten: ["vorhaben_1", "kapitalrahmen_ziel_1", "wann_starten_2"].map(A) });
  faelle.push(["Österreich", at]);
  ok(klar(at).includes("mit einem festen Ansprechpartner und Partner-Anwälten dahinter.") && !/Steuerberat|Unternehmensberat/.test(klar(at)), "Österreich: ohne Steuerberater-/Unternehmensberater-Satz (Gutachten 1, Mangel 11)");
  const atEn = W({ sprache: "en", oesterreich: true });
  faelle.push(["Österreich en", atEn]);
  ok(klar(atEn).includes("partner lawyers behind it") && !/tax advis|consultant/.test(klar(atEn)), "Österreich britisch: nur die Anwälte");
  const ohne = W({ link: { url: "https://fiaon.com/#gespraech", anzeige: "fiaon.com/#gespraech", vorausgefuellt: false } });
  faelle.push(["ohne persönlichen Link", ohne]);
  ok(klar(ohne).includes("Ihren Termin mit mir wählen Sie hier:") && !klar(ohne).includes("schon eingetragen"), "ohne persönlichen Link: kein „Ihre Angaben sind schon eingetragen“");
  const leer = W({ name: "" });
  faelle.push(["ohne Namen", leer]);
  const adr = W({ name: "Gewinn Jetzt www.preis-sofort.example" });
  faelle.push(["Name mit Adresse", adr]);
  ok(klar(adr).startsWith("Guten Tag,\n") && !klar(adr).includes("preis-sofort"), "ein Name, der nach Adresse aussieht, kommt nie in die Anrede (Gutachten Sicherheit, Mangel 4)");
  ok(klar(leer).startsWith("Guten Tag,\n") && klar(W({ name: " ", sprache: "en" })).startsWith("Good day,\n"), "ohne Namen: „Guten Tag,“ / „Good day,“");
  for (const art of ["heute", "ab", "persoenlich", "versucht"] as const) for (const sprache of ["de", "en"] as const) {
    faelle.push([`Ruf ${art} ${sprache}`, W({ sprache, ruf: { kollege: "Daniel Beispiel", art, abTag: new Date("2026-11-09T09:00:00Z") } })]);
  }
  faelle.push(["ohne Kollegen", W({ ruf: { kollege: null, art: "persoenlich" } })]);
  for (const [name, m] of faelle) {
    const funde = await LP.leadMailPruefen(m);
    pruefe(funde.length === 0, "jede Fassung: Wand ohne Fund", `${name}: ${funde.join("; ")}`);
    pruefe(!/\bmorgen\b|\btomorrow\b/i.test(klar(m)), "nie „morgen“ (nach Mitternacht falsch, Gutachten 1, Mangel 3)", name);
    pruefe((klar(m).match(/[–—]/g) ?? []).length <= 1, "höchstens ein Gedankenstrich", name);
  }
  sammelAus(faelle.length);
}

abschnitt("A3b Die Link-Wand: was der Lead tippt, wird nie zur fremden Adresse in Justins Mail (Gutachten Sicherheit, Mangel 4)");
{
  ok(T.fremdeAdressen("Ihr Link https://fiaon.com/g/AbCdEfGh23 und www.fiaon.com").length === 0, "fiaon.com ist erlaubt");
  ok(T.fremdeAdressen("viel Erfolg mit https://evil.example/login.").length === 1 && T.fremdeAdressen("siehe preis-sofort.example").length === 1, "jede andere Adresse ist ein Fund");
  ok(T.fremdeAdressen("Treffen am 12.11. um 14.30 Uhr, z. B. bei der U.S. Bank") .length === 0, "Datum, Uhrzeit, Abkürzungen sind keine Adressen");
  const boese = { ...W(), anrede: "Guten Tag Gewinn Jetzt www.preis-sofort.example," };
  ok((await LP.leadMailPruefen(boese as any)).some((f: string) => /fremde Adresse/.test(f)), "die Wand hält eine Mail mit fremder Adresse an");
  // Fix 09.11.2026 (E-481): Maras eigener WhatsApp-Link (wa.me mit dem festen Satz) hielt jede Willkommens-Mail an — „%20“ galt als
  // Prozentzahl, wa.me als fremde Adresse. Jetzt prüft die Wand den Satz; ein Link zu einer anderen Nummer oder mit anderem Text bleibt ein Fund.
  {
    const MB = await import("../shared/fiaon-mara-business");
    const nr = "4915100000000", kennung = "AbCdEfGh23";
    for (const sprache of ["de", "en"] as const) {
      const eigen = MB.waGlobalLink(nr, kennung, sprache)!;
      const mitWa = W({ sprache, whatsapp: { url: eigen } });
      ok(klar(mitWa).includes(eigen), `W mit WhatsApp-Block enthält Maras Link (${sprache})`);
      const funde = await LP.leadMailPruefen(mitWa, { maraNummer: nr });
      ok(funde.length === 0, `W mit Maras eigenem WhatsApp-Link geht durch die Wand (${sprache}): ${funde.join("; ")}`);
      gleich(MB.eigenerWaSatz(eigen, nr), MB.waGlobalSatz(kennung, sprache), `eigenerWaSatz liefert den Satz im Klartext (${sprache})`);
      ok((await LP.leadMailPruefen(W({ sprache, whatsapp: { url: MB.waGlobalLink(nr, null, sprache)! } }), { maraNummer: nr })).length === 0, `auch ohne Kennung (${sprache})`);
      const andereNr = W({ sprache, whatsapp: { url: MB.waGlobalLink("4915199999999", kennung, sprache)! } });
      ok((await LP.leadMailPruefen(andereNr, { maraNummer: nr })).some((f: string) => /fremde Adresse/.test(f)), `Link zu einer anderen Nummer bleibt eine fremde Adresse (${sprache})`);
      const andererText = W({ sprache, whatsapp: { url: `https://wa.me/${nr}?text=${encodeURIComponent("Kredit 100% sicher, ruf an")}` } });
      ok((await LP.leadMailPruefen(andererText, { maraNummer: nr })).length > 0, `Link mit fremdem Text bleibt ein Fund (${sprache})`);
      ok((await LP.leadMailPruefen(mitWa, { maraNummer: null })).some((f: string) => /fremde Adresse|Prozentzahl/.test(f)), `ohne bekannte Mara-Nummer bleibt die Wand streng (${sprache})`);
    }
    gleich(MB.eigenerWaSatz("https://wa.me/4915100000000?text=Hallo&foo=1", nr), null, "Zusatz-Parameter: kein eigener Link");
    gleich(MB.eigenerWaSatz("http://wa.me/4915100000000?text=x", nr), null, "nur https");
    gleich(MB.eigenerWaSatz("https://wa.me/4915100000000?text=%E0%A4%A", nr), null, "kaputte Kodierung: kein eigener Link");
  }
  gleich(T.firmaFuerText("https://evil.example/login"), null, "Firma als Adresse: nie in N3");
  gleich(T.firmaFuerText("Muster Logistik GmbH"), "Muster Logistik GmbH", "echte Firma: bleibt");
  gleich(T.wunschzeitFuerText("Di 14–16 Uhr"), "Di 14–16 Uhr", "Wunschzeit: harmlos bleibt");
  gleich(T.wunschzeitFuerText("<a href=x>jetzt</a>"), null, "Wunschzeit mit Code: nie");
}

abschnitt("A3c Was der Lead mit seiner Antwort will — Absage, keine Mails, keine Anrufe (Gutachten Sicherheit 6 + 13, Lead-Sicht 1)");
{
  const art = (kern: string, betreff = "Re: Ihre Anfrage", vorab: string | null = null) => T.leadAntwortArt({ kern, betreff, vorab });
  for (const t of ["Kein Interesse.", "Nein, danke", "nicht interessiert", "Stopp", "No thanks", "Not interested", "Nein.", "Habe kein Interesse mehr.", "Bitte kontaktieren Sie mich nicht mehr."]) {
    ok(art(t).art === "absage" && art(t).keineAnrufe, `„${t}“ → schriftliche Absage (kein Anruf mehr)`);
  }
  for (const t of ["Bitte keine Mails mehr.", "abmelden", "Please remove me from your list.", "keine weiteren Mails bitte"]) ok(art(t).art === "keine_mails", `„${t}“ → nur keine Mails (anrufen erlaubt)`);
  ok(art("", "Stopp").art === "keine_mails" && art("This message was automatically generated by Gmail.", "Stopp").art === "keine_mails", "die Abmelde-Mail des Mailprogramms (Betreff „Stopp“, leer) → keine Mails, kein Auftrag");
  ok(art("Bitte nicht anrufen, nur per Mail. Wie läuft die Gründung ab?").art === "antwort" && art("Bitte nicht anrufen, nur per Mail.").keineAnrufe, "„bitte nicht anrufen, nur per Mail“ → Antwort ohne Anruf-Auftrag");
  ok(art("Danke, bis Donnerstag!").art === "antwort" && !art("Danke, bis Donnerstag!").keineAnrufe, "„Danke, bis Donnerstag“ → eine Antwort");
  ok(art("Ich habe kein Interesse an einem Kredit, nur an der Gründung.").art === "antwort", "„kein Interesse an …, nur an …“ ist Interesse");
  ok(art("Bitte schreiben Sie mir nicht mehr.", "Re: x", "kein_interesse").art === "keine_mails", "Vorprüfung „kein Interesse“ ohne eindeutige Absage → keine Mails");
}

abschnitt("A4 Wer ruft an — der Wochentag, nie eine Zusage ohne Dienst");
{
  const MO = new Date("2026-11-09T09:00:00Z");
  gleich(T.rufSatz({ kollege: "Daniel Beispiel", art: "heute" }, "de"), "Falls Sie bis dahin noch keinen Termin gewählt haben, ruft Sie mein Kollege Daniel Beispiel heute noch kurz an.", "im Dienst: heute");
  gleich(T.rufSatz({ kollege: "Daniel Beispiel", art: "ab", abTag: MO }, "de"), "Falls Sie bis dahin noch keinen Termin gewählt haben, ruft Sie mein Kollege Daniel Beispiel am Montag ab 9 Uhr kurz an.", "nachts/Wochenende: der Wochentag");
  gleich(T.rufSatz({ kollege: "Daniela Beispiel", weiblich: true, art: "persoenlich" }, "de"), "Falls Sie bis dahin noch keinen Termin gewählt haben, meldet sich meine Kollegin Daniela Beispiel persönlich bei Ihnen.", "abwesend/unbekannt: persönlich, „meine Kollegin“");
  gleich(T.rufSatz({ kollege: "Daniel Beispiel", art: "versucht" }, "de"), "Mein Kollege Daniel Beispiel hat schon versucht, Sie anzurufen, und meldet sich gern noch einmal persönlich bei Ihnen.", "schon angerufen: ehrlich");
  gleich(T.rufSatz({ kollege: null, art: "heute" }, "de"), "Falls Sie bis dahin noch keinen Termin gewählt haben, melden wir uns persönlich bei Ihnen.", "niemand zuständig: „wir“");
  gleich(T.rufSatz({ kollege: "Daniel Beispiel", art: "ab", abTag: null }, "de"), "Falls Sie bis dahin noch keinen Termin gewählt haben, meldet sich mein Kollege Daniel Beispiel persönlich bei Ihnen.", "„ab“ ohne Tag: persönlich");
  gleich(T.rufSatz({ kollege: "Daniel Beispiel", art: "ab", abTag: MO }, "en"), "If you have not chosen a time by then, my colleague Daniel Beispiel will give you a quick call on Monday from 9 am (German time).", "britisch mit deutscher Zeit");
}

abschnitt("A5 N1 · N2 · N3 — im selben Faden, mit dem Link, mit Wissen");
{
  const WAM = new Date("2026-11-05T09:30:00Z");
  const N = (stufe: 1 | 2 | 3, over: Record<string, unknown> = {}) => T.nachfassText(stufe, {
    sprache: "de", name: "Max Mustermann", link: LINK, willkommenAm: WAM, jetzt: new Date("2026-11-06T09:30:00Z"),
    anrufVersuch: null, angaben: "antworten", firma: "Muster Logistik GmbH", ...over,
  } as any);
  const faelle: [string, any][] = [];
  const n1 = N(1); faelle.push(["N1", n1]);
  ok(klar(n1).includes("kurz nachgefragt, ob meine Nachricht von gestern angekommen ist.") && klar(n1).includes("Ihr Termin mit mir ist in einer Minute gebucht, Ihre Angaben sind schon eingetragen:\nhttps://fiaon.com/g/AbCdEfGh23"), "N1: Nachfrage „von gestern“ + derselbe Link, „in einer Minute“ (Gutachten Lead-Sicht, Mangel 15)");
  ok(klar(n1).includes("Oder nennen Sie mir in einer kurzen Antwort zwei, drei Zeiten, dann stimmen wir den Termin mit Ihnen ab.") && !/genau dann/.test(klar(n1)), "N1: keine Zusage „genau dann“ (Gutachten Lead-Sicht, Mangel 2)");
  const n1k = N(1, { kalenderLeer: true }); faelle.push(["N1 Kalender leer", n1k]);
  ok(!klar(n1k).includes(LINK.url) && klar(n1k).includes("Online sind meine Zeiten gerade vergeben."), "N1 ohne freie Zeit: kein Link-Versprechen");
  const n1w = N(1, { jetzt: new Date("2026-11-09T09:30:00Z") }); faelle.push(["N1 nach dem Wochenende", n1w]);
  ok(klar(n1w).includes("ob meine Nachricht vom Donnerstag angekommen ist."), "N1 nach dem Wochenende: „vom Donnerstag“");
  const n1a = N(1, { anrufVersuch: { am: new Date("2026-11-06T08:30:00Z"), kollege: "Daniel Beispiel" } }); faelle.push(["N1 nach Anrufversuch", n1a]);
  ok(klar(n1a).includes("mein Kollege Daniel Beispiel hat heute versucht, Sie anzurufen, leider ohne Glück.") && !klar(n1a).includes("kurz nachgefragt"), "N1 nach „nicht erreicht“: sagt genau das (übernimmt die Info-Mail)");
  const n1aw = N(1, { anrufVersuch: { am: new Date("2026-11-06T08:30:00Z"), kollege: "Daniela Beispiel", weiblich: true } }); faelle.push(["N1 Kollegin", n1aw]);
  ok(klar(n1aw).includes("meine Kollegin Daniela Beispiel hat heute versucht"), "N1: „meine Kollegin“");
  const n2 = N(2); faelle.push(["N2", n2]);
  ok(klar(n2).includes("1. Sie erzählen mir in zwei, drei Sätzen, was Sie vorhaben (Ihre Angaben aus dem Formular habe ich schon).") && klar(n2).includes("Dreißig Minuten, kostenlos, am Telefon:\nhttps://fiaon.com/g/AbCdEfGh23"), "N2: der Ablauf, „Ihre Angaben habe ich schon“, der Link");
  const n2n = N(2, { angaben: "nachricht" }); faelle.push(["N2 Nachricht", n2n]);
  ok(klar(n2n).includes("(Ihre Nachricht habe ich schon)."), "N2 nach einer Website-Nachricht");
  const n2o = N(2, { angaben: null }); faelle.push(["N2 ohne Angaben", n2o]);
  ok(klar(n2o).includes("was Sie vorhaben.") && !klar(n2o).includes("habe ich schon"), "N2 ohne Angaben: ohne Zusatz");
  const n3 = N(3); faelle.push(["N3", n3]);
  ok(klar(n3).includes("ich möchte Sie nicht mit Mails überhäufen – das ist meine letzte Nachricht zu Ihrer Anfrage.") && klar(n3).includes("Ihr Link https://fiaon.com/g/AbCdEfGh23 gilt noch bis 05.12.2026, und eine kurze Antwort auf diese Mail genügt.") && klar(n3).includes("Ich wünsche Ihnen viel Erfolg mit Muster Logistik GmbH."), "N3: letzte Mail, Link mit Gültigkeit, Firma");
  const n3u = N(3, { firma: "https://evil.example/login" }); faelle.push(["N3 Firma als Adresse", n3u]);
  ok(klar(n3u).includes("Ich wünsche Ihnen viel Erfolg.") && !klar(n3u).includes("evil"), "N3: eine Firma, die eine Adresse ist, steht nie im Satz (Gutachten Sicherheit, Mangel 4)");
  const n3o = N(3, { link: { ...LINK, bis: null }, firma: null }); faelle.push(["N3 ohne Datum/Firma", n3o]);
  ok(klar(n3o).includes("gilt noch eine Weile") && klar(n3o).includes("Ich wünsche Ihnen viel Erfolg."), "N3 ohne Gültigkeit/Firma: ohne Lücke");
  for (const stufe of [1, 2, 3] as const) faelle.push([`N${stufe} en`, N(stufe, { sprache: "en" })]);
  ok(klar(N(1, { sprache: "en" })).includes("Just a quick note to check whether my message from yesterday reached you."), "N1 britisch");
  for (const [name, m] of faelle) {
    const funde = await LP.leadMailPruefen(m);
    pruefe(funde.length === 0, "jede Fassung: Wand ohne Fund", `${name}: ${funde.join("; ")}`);
    pruefe(m.betreff === `Re: ${T.LEAD_BETREFF[m.sprache as "de" | "en"]}`, "Betreff „Re: …“ (Faden)", name);
    pruefe(m.fussSatz === T.LEAD_FUSS_SATZ[m.sprache as "de" | "en"], "Abmelde-Satz in jeder Mail", name);
    pruefe(T.platzhalterWache(klar(m)).length === 0, "Platzhalter-Wache still", name);
  }
  sammelAus(faelle.length);
}

abschnitt("A6 Die Platzhalter-Wache — keine Mail mit Lücke");
{
  const soll: [string, string][] = [
    ["Guten Tag {{params.name}},", "geschweifte Klammer (Platzhalter)"],
    ["Guten Tag [Name],", "eckiger Platzhalter"],
    ["Guten Tag undefined,", "„undefined“/„null“/„NaN“"],
    ["Guten Tag null,", "„undefined“/„null“/„NaN“"],
    ["Ihr Paket ()", "leere Klammer oder leere Anführung"],
    ["Ihre Firma „“ ist eingetragen", "leere Klammer oder leere Anführung"],
    ["Guten Tag Max , schön", "Leerzeichen vor Satzzeichen (leerer Wert)"],
    ["Ihr Link: https://fiaon.com/g/ gilt", "Link ohne Code"],
    ["Ihr Link: https://fiaon.com/g/AbC gilt", "Link ohne Code"],
    ["Ihre  Angaben", "doppelte Leerstelle im Satz"],
  ];
  for (const [text, wache] of soll) ok(T.platzhalterWache(text).includes(wache), `„${text}“ → ${wache}`);
  for (const text of ["Ihr Link: https://fiaon.com/g/AbCdEfGh23", "Die Nullnummer bleibt.", "Ihre Angaben (etwa 30 Minuten) – gern.", klar(W()), klar(W({ sprache: "en" }))]) {
    gleich(T.platzhalterWache(text).join("; "), "", `still bei „${text.slice(0, 40).replace(/\n/g, " ")}…“`);
  }
}

abschnitt("A7 Die Stopp-Tabelle — die erste zutreffende Regel");
{
  const LEER = { privat: false, kunde: false, abgemeldet: false, unzustellbar: false, termin: false, antwort: false, vonHand: false, anrufErgebnis: null, firmaStatus: null, infoMail: false, angebot: false };
  gleich(T.leadStoppGrund(LEER), null, "nichts → es darf weitergehen");
  for (const [feld, grund] of [["privat", "privat"], ["kunde", "kunde"], ["abgemeldet", "abgemeldet"], ["unzustellbar", "unzustellbar"], ["termin", "termin"], ["antwort", "antwort"], ["vonHand", "von_hand"], ["infoMail", "info_mail"], ["angebot", "angebot"]] as const) {
    gleich(T.leadStoppGrund({ ...LEER, [feld]: true }), grund, `${feld} → ${grund}`);
  }
  for (const e of T.STOPP_ANRUF) gleich(T.leadStoppGrund({ ...LEER, anrufErgebnis: e }), "ergebnis", `Anruf „${e}“ → Stopp (der Mensch übernimmt)`);
  for (const e of ["nicht_erreicht", "mailbox"]) gleich(T.leadStoppGrund({ ...LEER, anrufErgebnis: e }), null, `Anruf „${e}“ → weiter (N1 sagt es)`);
  for (const s of T.STOPP_FIRMA) gleich(T.leadStoppGrund({ ...LEER, firmaStatus: s }), "kein_interesse", `Firma „${s}“ → Stopp`);
  gleich(T.leadStoppGrund({ ...LEER, firmaStatus: "wiedervorlage" }), null, "Firma „wiedervorlage“ → weiter");
  gleich(T.leadStoppGrund({ ...LEER, privat: true, kunde: true, termin: true }), "privat", "Privat-Weg vor allem anderen");
  gleich(T.leadStoppGrund({ ...LEER, termin: true, antwort: true }), "termin", "Termin vor Antwort");
  const gruende = ["privat", "kunde", "abgemeldet", "unzustellbar", "termin", "antwort", "von_hand", "ergebnis", "kein_interesse", "info_mail", "angebot"] as const;
  ok(gruende.every((g) => !!T.STOPP_TEXT[g]), "jeder Stopp-Grund hat seinen Satz fürs Cockpit");
}

abschnitt("A8 Das Mail-Budget — höchstens eine am Tag, fünf bis zum Gespräch");
{
  gleich(T.LEAD_POST_VORGABE.budgetTag, 1, "Tagesdeckel 1");
  gleich(T.LEAD_POST_VORGABE.budgetGesamt, 5, "Gesamtdeckel 5");
  gleich(T.leadMailBudget({ letzte24h: 0, gesamt: 0 }).ok, true, "erste Mail: ja");
  gleich(T.leadMailBudget({ letzte24h: 1, gesamt: 1 }).ok, false, "zweite am selben Tag: nein");
  gleich(T.leadMailBudget({ letzte24h: 0, gesamt: 4 }).ok, true, "die fünfte: ja");
  gleich(T.leadMailBudget({ letzte24h: 0, gesamt: 5 }).ok, false, "die sechste: nein");
}

abschnitt("A9 Werktage, Feiertage, Fälligkeit (10 Uhr Berlin), Sendefenster");
{
  const DE = LP.feiertagFuer("DE"), AT = LP.feiertagFuer("AT");
  ok(istFeiertag("DE", "2026-12-25") && istFeiertag("AT", "2026-12-08") && !istFeiertag("DE", "2026-12-08"), "Feiertags-Kalender DE/AT");
  gleich(T.werktagPlus("2026-12-24", 1, DE), "2026-12-28", "Heiligabend +1 Werktag → Montag 28.12. (Weihnachten, Wochenende)");
  gleich(T.werktagPlus("2026-11-06", 1, DE), "2026-11-09", "Freitag +1 → Montag");
  gleich(T.werktagPlus("2026-11-05", 3, DE), "2026-11-10", "Donnerstag +3 → Dienstag");
  gleich(T.werktagPlus("2026-11-05", 7, DE), "2026-11-16", "Donnerstag +7 → Montag übernächste Woche");
  gleich(T.werktagPlus("2026-12-07", 1, AT), "2026-12-09", "Österreich: 8.12. ist Feiertag");
  gleich(T.werktagPlus("2026-12-07", 1, DE), "2026-12-08", "Deutschland: 8.12. ist Werktag");
  const nacht = new Date("2026-11-05T22:00:00Z"); // Do 23:00 Berlin
  gleich(LP.nachfassFaelligAm(nacht, 1).toISOString(), "2026-11-09T09:00:00.000Z", "W Do 23 Uhr → Anruf Fr → N1 erst Mo 10 Uhr (Gutachten Lead-Sicht, Mangel 5)");
  gleich(LP.nachfassFaelligAm(new Date("2026-11-04T22:55:00Z"), 1).toISOString(), "2026-11-06T09:00:00.000Z", "W Mi 23:55 → N1 nicht vor 10 Uhr am übernächsten Tag (Fr)");
  gleich(LP.nachfassFaelligAm(new Date("2026-11-05T09:00:00Z"), 1).toISOString(), "2026-11-06T09:00:00.000Z", "W Do 10 Uhr (im Dienst) → N1 Fr 10 Uhr (24 Stunden)");
  gleich(LP.nachfassFaelligAm(new Date("2026-11-05T14:00:00Z"), 1).toISOString(), "2026-11-06T14:00:00.000Z", "W Do 15 Uhr → N1 frühestens 24 Stunden später");
  gleich(LP.nachfassFaelligAm(nacht, 2).toISOString(), "2026-11-10T09:00:00.000Z", "→ N2 Di 10 Uhr (+3 Werktage)");
  gleich(LP.nachfassFaelligAm(nacht, 3).toISOString(), "2026-11-16T09:00:00.000Z", "→ N3 Mo 10 Uhr (+7 Werktage)");
  gleich(LP.nachfassFaelligAm(new Date("2026-06-05T08:00:00Z"), 1).toISOString(), "2026-06-08T08:00:00.000Z", "Sommerzeit: Fr 10 Uhr → Mo 10 Uhr MESZ");
  gleich(LP.nachfassFaelligAm(new Date("2026-12-24T09:00:00Z"), 1).toISOString(), "2026-12-28T09:00:00.000Z", "über Weihnachten");
  gleich(T.imSendefenster(new Date("2026-11-09T09:00:00Z"), DE), true, "Mo 10:00 im Fenster");
  gleich(T.imSendefenster(new Date("2026-11-09T07:59:00Z"), DE), false, "Mo 08:59 nicht");
  gleich(T.imSendefenster(new Date("2026-11-09T16:59:00Z"), DE), true, "Mo 17:59 im Fenster");
  gleich(T.imSendefenster(new Date("2026-11-09T17:00:00Z"), DE), false, "Mo 18:00 nicht");
  gleich(T.imSendefenster(new Date("2026-11-07T09:00:00Z"), DE), false, "Samstag nicht");
  gleich(T.imSendefenster(new Date("2026-12-25T09:00:00Z"), DE), false, "Weihnachten nicht");
}

abschnitt("A10 „keine Mails“ — eindeutig, nie ein Halbsatz");
{
  for (const t of ["keine Mails", "Bitte keine Mails mehr.", "Keine weiteren Mails bitte", "Stopp", "STOP!", "abmelden", "Kein Interesse.", "Habe kein Interesse.",
    "No more emails please", "Please remove me from your list.", "Können Sie mich bitte austragen?", "Schreiben Sie mir bitte nicht mehr.",
    "Keine Mails mehr.\n\nViele Grüße\nMax Mustermann", "Nein, danke", "Ich möchte keine Mails von Ihnen."]) {
    ok(T.keineMailsGewuenscht(t), `„${t.replace(/\n/g, " ⏎ ")}“ → Abmeldung`);
  }
  for (const t of ["Ich habe keine Mail mit dem Link bekommen, können Sie mich anrufen?", "Ich habe kein Interesse an einem Kredit, nur an der Gründung.",
    "Sind Sie so etwas wie ein One-Stop-Shop?", "Passt Ihnen Mittwoch 14 Uhr?", "Keine Eile – nächste Woche passt auch.",
    "Kein Interesse.\n\nAber eine Frage hätte ich noch: Wie lange dauert die Gründung einer LLC in Delaware ungefähr, und was brauchen Sie dafür von mir?"]) {
    ok(!T.keineMailsGewuenscht(t), `„${t.slice(0, 60).replace(/\n/g, " ⏎ ")}…“ → keine Abmeldung (er fragt nach)`);
  }
}

abschnitt("A11 Die Wunschzeit in seiner Antwort");
{
  const j = JETZT; // Do 05.11. 15:00 Berlin
  const w = (t: string) => { const r = T.wunschzeitErkennen(t, j); return r ? `${r.tag} ${r.zeit}` : null; };
  gleich(w("Passt Ihnen Mittwoch 14 Uhr?"), "2026-11-11 14:00", "„Mittwoch 14 Uhr“");
  gleich(w("Gern morgen um 10"), "2026-11-06 10:00", "„morgen um 10“");
  gleich(w("am 12.11. um 15:30 wäre gut"), "2026-11-12 15:30", "„am 12.11. um 15:30“");
  gleich(w("tomorrow at 3 pm works"), "2026-11-06 15:00", "„tomorrow at 3 pm“");
  gleich(w("heute um 17 Uhr"), "2026-11-05 17:00", "„heute um 17 Uhr“ (noch in der Zukunft)");
  gleich(w("heute um 9"), null, "„heute um 9“ liegt zurück → keine");
  gleich(w("Donnerstag 10 Uhr"), "2026-11-12 10:00", "derselbe Wochentag = nächste Woche");
  gleich(w("Guten Morgen, gerne nächste Woche"), null, "„Guten Morgen“ ist ein Gruß, „nächste Woche“ uneindeutig");
  gleich(w("Freitag 22 Uhr"), null, "22 Uhr: außerhalb 7–20 Uhr");
  gleich(w("Fr. Müller ruft Sie zurück"), null, "„Fr.“ ist kein Freitag");
  gleich(w("Montag"), null, "ohne Uhrzeit: keine");
}

abschnitt("A12 Die Privatkunden-Weiche — nach dem Anliegen");
{
  const pw = (ein: Partial<{ nachricht: string | null; privatBestand: boolean; zahlend: boolean; firmaBrauchbar: boolean; globalInteresse: boolean }>) =>
    T.privatWeiche({ nachricht: null, privatBestand: false, zahlend: false, firmaBrauchbar: true, globalInteresse: false, ...ein }).weg;
  gleich(pw({ nachricht: "Seit Wochen meldet sich niemand. Das ist eine Frechheit, ich will mein Geld zurück." }), "beschwerde", "drei starke Signale → Beschwerde");
  gleich(pw({ nachricht: "Das wurde mir so versprochen.", privatBestand: true }), "beschwerde", "ein starkes Signal + Privat-Bestand → Beschwerde");
  gleich(pw({ nachricht: "Das wurde mir so versprochen." }), "global", "ein starkes Signal, Firma, kein Bestand → Global (keine Fehlweiche)");
  gleich(pw({ privatBestand: true, firmaBrauchbar: false }), "privat", "Privat-Bestand ohne Global-Interesse, ohne Firma → Privatkunde");
  gleich(pw({ privatBestand: true, firmaBrauchbar: false, globalInteresse: true }), "bestandskunde", "Privat-Bestand MIT Global-Interesse → bleibt Global-Lead");
  gleich(pw({ privatBestand: true }), "bestandskunde", "Privat-Bestand mit echter Firma → bleibt Global-Lead");
  gleich(pw({}), "global", "nichts → Global");
}

abschnitt("A13 Die Matrix „Mail – Auslöser – Absender – Stopp“ gegen den Motor");
{
  gleich(T.LEAD_MAIL_MATRIX.length, 10, "zehn Mails (mit der Absage global_termin_absage)");
  for (const z of T.LEAD_MAIL_MATRIX) ok(z.antwortAn.startsWith("js@") && z.stopp.trim().length > 1 && z.ausloeser.trim().length > 5, `${z.mail}: Antwort an js@, Auslöser und Stopp benannt`);
  ok(T.LEAD_MAIL_MATRIX.filter((z) => /^(W|N\d)/.test(z.mail)).every((z) => z.absender.startsWith("js@")), "W, N1–N3: aus js@ (Justin)");
  for (const ev of ["global_termin", "global_termin_erinnerung", "global_termin_kurz", "global_nicht_erreicht", "global_termin_absage"]) {
    const a = absenderFuer(ev), r = antwortAnFuer(ev, { antwort_an: "js@fiaon.com" });
    ok(a.name === "FIAON Global" && a.email === "welcome@fiaon.com", `${ev}: Absender „FIAON Global“ <welcome@> (Business-Rahmen, nie „FIAON Welcome“)`);
    gleich(r.email, LP.LEAD_POSTFACH, `${ev}: beim Lead-Gespräch Antworten an Justin (js@)`);
    gleich(antwortAnFuer(ev).email, "welcome@fiaon.com", `${ev}: ohne Lead (Startgespräch zahlender Kunden) Antworten an welcome@ (Gutachten Technik, Mangel 9)`);
    gleich(antwortAnFuer(ev, { antwort_an: "boese@fremd.example" }).email, "welcome@fiaon.com", `${ev}: eine fremde Antwort-Adresse gilt nie`);
    ok(T.LEAD_MAIL_MATRIX.some((z) => z.mail.endsWith(ev) && z.absender === "FIAON Global <welcome@>"), `${ev}: steht so in der Matrix`);
  }
  const tb = absenderFuer("termin_bestaetigung"), tr = antwortAnFuer("termin_bestaetigung");
  ok(tb.name !== "FIAON Global" && tr.email === tb.email, "termin_bestaetigung (Privatkunden) unverändert: Antwort an den Absender");
}

abschnitt("A14 Bestätigung global_termin (de + en): seine Sätze, keine Platzhalter-Zeilen, Pflichtzeile, kein Institut-Satz");
{
  const { globalTerminPayload } = await import("../server/lib/fiaon-global-termin");
  const ant = ["vorhaben_3", "kapitalrahmen_ziel_2", "wann_starten_1"].map(A);
  for (const sprache of ["de", "en"] as const) {
    const lab = sprache === "de" ? { firma: "Unternehmen: ", paket: "Paketwunsch: ", angaben: "Ihre Angaben aus dem Formular liegen uns vor.", nr: `${FIAON_FIRMA.register} Nr. ${FIAON_FIRMA.companyNo}` }
      : { firma: "Company: ", paket: "Package of interest: ", angaben: "We have the details from your form.", nr: `${FIAON_FIRMA.register} No. ${FIAON_FIRMA.companyNo}` };
    const basis = { email: "lead@pruef.example", name: "Max Mustermann", telefon: "+49 30 00000000", ansprechpartner: "Justin Schwarzott", datumText: "11.11.2026", uhrzeit: "14:00", stornoToken: "a".repeat(48), sprache, beginn: new Date("2026-11-11T13:00:00Z") };
    const meta = mailRendern("global_termin", globalTerminPayload({ ...basis, firma: "Max Mustermann (Firma noch offen)", paketText: null, paket: null, angabenSatz: T.angabenSatz(ant, sprache), lead: true }) as any)!;
    ok(!!meta && meta.fehlend.length === 0, `${sprache} Meta-Lead: kein Platzhalter ohne Wert (${meta?.fehlend.join(",")})`);
    ok(meta.text.includes(lab.angaben) && meta.text.includes(T.vorhabenSatz(ant, sprache).satz), `${sprache}: „Ihre Angaben liegen uns vor“ mit seinem Vorhaben in einem Satz`);
    ok(!/\$|€|\(Beides/.test(meta.text), `${sprache}: kein Betrag, keine Klammer aus dem Formular`);
    ok(!meta.text.includes("Firma noch offen") && !meta.text.includes(lab.firma), `${sprache}: Platzhalter-Firma → Zeile „Unternehmen“ entfällt`);
    ok(!meta.text.includes(lab.paket), `${sprache}: kein Paketwunsch → keine Zeile „noch offen“`);
    ok(meta.text.includes(lab.nr) || meta.html.includes(lab.nr), `${sprache}: Pflichtzeile mit Registernummer im Fuß`);
    ok(!BANK_SATZ.test(meta.text) && !radarBankVorbehalt(meta.text), `${sprache}: KEIN Institut-Satz (E-468)`);
    ok(meta.absender.name === "FIAON Global" && meta.absender.email === "welcome@fiaon.com" && meta.antwortAn.email === "js@fiaon.com", `${sprache}: FIAON Global <welcome@>, Antwort an js@`);
    if (sprache === "de") ok(!/\b(du|dich|dir|dein\w*)\b/i.test(meta.text), "de: Sie-Form");
    ok(meta.html.includes(sprache === "de" ? "Diese Nachricht betrifft Ihr Gespräch mit FIAON Global." : "This message relates to your booked call.") && !/Vorgang|your order/.test(meta.html) && !meta.text.includes("fiaon.com/business ·") && !meta.html.includes(">fiaon.com/business<"), `${sprache}: Fuß ohne „Vorgang/order“, Link fiaon.com (Gutachten Lead-Sicht, Mangel 17)`);
    ok(meta.text.includes(sprache === "de" ? "FIAON koordiniert; Rechts- und Steuerberatung leisten Partnerkanzleien auf Ihr Mandat." : "FIAON coordinates; legal and tax matters are handled by partner lawyers and tax advisers under your own engagement."), `${sprache}: der Rollensatz ohne „Bank“ (Gutachten Sicherheit, Mangel 12)`);
    // Gutachten Sicherheit, Mangel 1 (KRITISCH): was ein Besucher tippt, wird nie zu klickbarem HTML in unserer Mail.
    const boese = mailRendern("global_termin", globalTerminPayload({ ...basis, name: '<a href="https://evil.example/login">Termin bestätigen</a>', firma: '<img src="https://evil.example/x.png">Muster GmbH', telefon: '<a href="https://evil.example">+49</a>', paketText: '<b>x</b>', paket: null, angabenSatz: "", lead: true }) as any)!;
    ok(!/<a href="https:\/\/evil/.test(boese.html) && !/<img src="https:\/\/evil/.test(boese.html) && boese.html.includes("&lt;a href="), `${sprache}: HTML aus Name, Firma, Telefon steht nur unschädlich in der Bestätigung`);
    const web = mailRendern("global_termin", globalTerminPayload({ ...basis, firma: "Muster Logistik GmbH", paketText: sprache === "de" ? "Global Struktur" : null, paket: GLOBAL_PAKETE[0].key, angabenSatz: "" }) as any)!;
    ok(!!web && web.fehlend.length === 0 && web.text.includes(`${lab.firma}Muster Logistik GmbH`) && web.text.includes(lab.paket), `${sprache} Website-Lead: Firma und Paket stehen, keine Lücke`);
    ok(!web.text.includes(lab.angaben), `${sprache} ohne Antworten: kein Angaben-Absatz`);
  }
}

abschnitt("A15 Vortag-Mail: der freigegebene Absatz — mit Antworten nur, was fehlt");
{
  gleich(T.vorbereitungHtml(null, "de"), T.VORBEREITUNG_FREIGEGEBEN.de.replace(/\n/g, "<br />"), "ohne Antworten: Wort für Wort der freigegebene Absatz (E-458)");
  gleich(T.vorbereitungHtml([], "en"), T.VORBEREITUNG_FREIGEGEBEN.en.replace(/\n/g, "<br />"), "britisch ebenso");
  const v1 = T.vorbereitungHtml(["vorhaben_3", "kapitalrahmen_ziel_2"].map(A), "de");
  ok(v1.includes("Ihre Angaben aus dem Formular liegen uns vor. Damit das Gespräch Ihnen viel bringt, notieren Sie gern noch, wo Sie bzw. Ihr Unternehmen ansässig sind.") && !v1.includes("– ") && !v1.includes("liegen mir vor") && !v1.includes("was Sie in den USA vorhaben"), "Vorhaben + Rahmen bekannt: EIN Satz (uns, keine Liste mit einem Punkt — Gutachten Lead-Sicht, Mangel 13)");
  const v2 = T.vorbereitungHtml([A("wofuer_1")], "de");
  ok(v2.includes("ansässig sind,") && v2.includes("welches Ziel Sie für Ihren Kapitalrahmen haben.") && !v2.includes("was Sie in den USA vorhaben"), "nur das Vorhaben bekannt: Sitz + Rahmen");
  const v3 = T.vorbereitungHtml([A("kapitalrahmen_ziel_1")], "en");
  ok(v3.includes("where you or your company are based,") && v3.includes("what you plan to do in the US") && !v3.includes("capital limit"), "nur der Rahmen bekannt (britisch): Sitz + Vorhaben");
  ok(!/\d|\$|€/.test(v1 + v2 + v3), "keine Zahl, nichts vom Lead");
  const def = MAKE_EVENT_REGISTRY.find((e: any) => e.type === "global_termin_erinnerung") as any;
  const m = mailRendern("global_termin_erinnerung", { ...def.example, vorbereitung_html: v1, antwort_an: "js@fiaon.com" })!;
  ok(!!m && m.fehlend.length === 0 && m.text.includes("wo Sie bzw. Ihr Unternehmen ansässig sind") && !/<br/.test(m.text), "Vortag-Mail rendert, der Absatz steht im Text-Teil als Zeilen");
  ok(m.absender.name === "FIAON Global" && m.antwortAn.email === "js@fiaon.com", "Vortag (Lead-Gespräch): FIAON Global, Antwort an js@");
  // Gutachten Lead-Sicht, Mangel 3: die Absage durch uns — Business-Rahmen, nie die Privat-Vorlage.
  const abs = MAKE_EVENT_REGISTRY.find((e: any) => e.type === "global_termin_absage") as any;
  for (const sprache of ["de", "en"] as const) {
    const a = mailRendern("global_termin_absage", { ...abs.example, ...(sprache === "en" ? { sprache: "en" } : {}), antwort_an: "js@fiaon.com" })!;
    ok(!!a && a.fehlend.length === 0 && a.absender.name === "FIAON Global" && a.antwortAn.email === "js@fiaon.com", `Absage ${sprache}: rendert, FIAON Global, Antwort an js@`);
    ok(!/Bonität|Akte|SCHUFA|Löschung|\b(du|dich|dir|dein\w*)\b/i.test(a.text) && a.text.includes(abs.example.neu_buchen_link), `Absage ${sprache}: kein Privat-Rahmen („Bonität“, „Akte“), Sie-Form, der persönliche Link`);
    ok(!wandPruefen(a.text, ["aufgabe_an_betreuer", "notiz_an_betreuer"]).some((f: any) => f.art !== "floskel") && !radarBankVorbehalt(a.text), `Absage ${sprache}: Wortwand und Bank-Satz sauber`);
  }
}

abschnitt("A16 Motor: eine Datenzeile aus nur einem leeren Platzhalter entfällt — und zählt als Lücke (außer wahlweise)");
{
  const def = MAKE_EVENT_REGISTRY.find((e: any) => e.type === "termin_bestaetigung") as any;
  const mit = mailRendern("termin_bestaetigung", def.example)!;
  ok(mit.text.includes("Gespräch: ") && !mit.fehlend.includes("termin_art"), "mit Terminart: Zeile „Gespräch“ steht");
  const { termin_art: _weg, ...ohne } = def.example;
  const o = mailRendern("termin_bestaetigung", ohne)!;
  ok(!o.text.includes("Gespräch: ") && o.fehlend.includes("termin_art"), "ohne Terminart: die leere Zeile entfällt UND bleibt eine gemeldete Lücke");
}

abschnitt("A17 Info-Mail nach dem Anruf: Einstieg passend zum Anruf, kein Institut-Satz, Lead ohne Preisliste");
{
  for (const art of ["erreicht", "nicht_erreicht", "neutral"] as const) {
    const m = globalInfoMail({ ansprechpartner: "Frau Beispiel", firma: "Beispiel GmbH", agentName: "Daniel Beispiel", art });
    // Der Umfang der Geld-zurück-Zusage (Vertrag Ziffer 6: „Entscheidungen von Banken … nicht Gegenstand dieser Zusage“) bleibt
    // Wort für Wort — er ist keine Verkaufsformel, sondern die Grenze der Zusage. Jeder ANDERE Bank-Satz ist raus (E-468).
    const ohneZusage = m.text.split(GLOBAL_GELD_ZURUECK.de.bedingungen).join("");
    ok(!BANK_SATZ.test(ohneZusage) && !radarBankVorbehalt(ohneZusage), `${art}: kein Institut-Satz (E-468) — ${radarBankVorbehalt(ohneZusage) ?? ""}`);
    ok(!GLOBAL_GELD_ZURUECK.aktiv || m.text.includes(GLOBAL_GELD_ZURUECK.de.bedingungen), `${art}: die Bedingungen der Geld-zurück-Zusage unverändert`);
    ok(wandPruefen(m.text).length === 0, `${art}: Wortwand (${wandPruefen(m.text).map((f) => f.treffer).join(", ")})`);
    ok(m.text.includes("wir kümmern uns um alles bis zur Unterschrift bei der Bank"), `${art}: Justins Satz`);
  }
  const e = globalInfoMail({ firma: "B GmbH", agentName: "D", art: "erreicht" });
  const n = globalInfoMail({ firma: "B GmbH", agentName: "D", art: "nicht_erreicht" });
  const u = globalInfoMail({ firma: "B GmbH", agentName: "D", art: "neutral" });
  ok(e.text.includes("danke für das Gespräch eben") && e.betreff.includes("die Unterlagen zu unserem Gespräch"), "erreicht: „danke für das Gespräch eben“");
  ok(n.text.includes("ich habe heute versucht, Sie zu erreichen") && !n.text.includes("danke für das Gespräch"), "nicht erreicht: ehrlich, kein Dank für ein Gespräch, das nie war");
  ok(!u.text.includes("danke für das Gespräch") && !u.text.includes("versucht") && u.betreff.includes("in Kürze, worum es geht"), "ohne Anruf: neutral");
  ok(globalInfoMail({ firma: "X", agentName: "Y" }).text.includes("danke für das Gespräch eben"), "alter Aufruf ohne „art“: unverändert „erreicht“");
  const lead = globalInfoMail({ firma: "B GmbH", agentName: "D", art: "neutral", lead: { link: "https://fiaon.com/g/AbCdEfGh23", gespraechMit: "Justin Schwarzott" } });
  ok(lead.text.includes("https://fiaon.com/g/AbCdEfGh23") && lead.text.includes("bespricht Justin Schwarzott mit Ihnen im Gespräch"), "Lead vor dem Gespräch: sein Link, das Gespräch mit Justin");
  ok(!GLOBAL_PAKETE.some((g) => lead.text.includes(globalPreisText(g.key))) && !lead.text.includes("#pakete"), "… und KEINE Preisliste (sie nähme das Gespräch vorweg)");
}

abschnitt("A18 Die Mail im Gmail-Stil: Link, echte Unterschrift, Abmelde-Satz, Pflichtangaben");
{
  const m = W();
  const html = await LP.leadMailHtml(m, "<div>Justin Schwarzott<br>Gründer</div>");
  ok(html.includes(`<a href="${LINK.url}">${LINK.anzeige}</a>`), "Link mit lesbarer Anzeige (ohne https://)");
  ok(html.includes('class="gmail_signature"') && html.includes("Justin Schwarzott<br>Gründer"), "Unterschrift im Gmail-Rahmen — wie von Hand geschrieben");
  ok(html.includes(T.LEAD_FUSS_SATZ.de.replace(/„/g, "„")) && html.includes("Impressum") && html.includes("Datenschutz"), "Abmelde-Satz und Pflichtangaben im Fuß");
  const text = await LP.leadMailText(m, "Justin Schwarzott\nGründer");
  ok(text.includes("\n-- \nJustin Schwarzott\nGründer") && text.includes(T.LEAD_FUSS_SATZ.de) && text.includes("Impressum: "), "Text-Teil: Unterschrift, Abmelde-Satz, Impressum");
  const textEn = await LP.leadMailText(W({ sprache: "en" }), "Justin Schwarzott");
  const htmlEn = await LP.leadMailHtml(W({ sprache: "en" }), "");
  ok(textEn.includes(`${FIAON_FIRMA.register} No. ${FIAON_FIRMA.companyNo}`) && textEn.includes("Legal notice: ") && textEn.includes("Privacy: ") && !textEn.includes("Impressum") && htmlEn.includes(">Legal notice<"), "britische Mail: Fuß auf Englisch (Legal notice, Privacy, No.)");
  const boes = W({ name: "<b>Max</b> Mustermann" });
  ok(!(await LP.leadMailHtml(boes, "")).includes("<b>Max</b>"), "Name wird im HTML entschärft");
}

abschnitt("A19 Quelltext-Wände");
{
  const post = lies("server/lib/fiaon-global-lead-post.ts");
  const termin = lies("server/lib/fiaon-global-termin.ts");
  const annehmen = termin.split("export async function globalAnfrageAnnehmen(")[1]?.split("\n}\n")[0] ?? "";
  ok(annehmen.length > 500 && !/CREATE TABLE|ALTER TABLE|leadPostSchema\(|leadWegSchema\(/.test(annehmen), "Eingang (globalAnfrageAnnehmen): keine Tabellen-Anweisung — er wartet auf nichts Neues");
  ok(annehmen.indexOf("status = 'privat'") > 0 && annehmen.indexOf("status = 'privat'") < annehmen.indexOf("globalLeadAufnehmen"), "Privat-Weg: Stand „privat“ VOR dem Firmen-Lead (der dann gar nicht entsteht)");
  ok(/if \(!privatWeg\) try \{\s*const \{ globalLeadAufnehmen \}/.test(annehmen), "Privat-Weg: kein Firmen-Lead");
  ok(!/from ["'][^"']*aras|arasAnruf|fiaon-aras/i.test(post), "Lead-Mails: kein ARAS, nie");
  ok(/function versandErlaubt\(\): boolean \{ return CRONS_AN \|\| !!attrappe; \}/.test(post), "nur im Betrieb (CRONS_AN) oder über die Prüfstand-Attrappe");
  ok(post.includes("export const LEAD_POSTFACH = \"js@fiaon.com\""), "Postfach js@");
  ok(/UPDATE fiaon_lead_weg SET willkommen_laeuft = NOW\(\)[\s\S]{0,300}willkommen_laeuft IS NULL/.test(post), "Willkommen atomar beansprucht (zwei Läufe → eine Mail)");
  const weg = lies("server/lib/fiaon-lead-weg.ts");
  ok((weg.split("export async function globalLeadAbsender(")[1] ?? "").slice(0, 2500).includes("'privat'") && (weg.split("export async function offeneAnfrageFuer(")[1] ?? "").slice(0, 900).includes("'privat'"), "Mara-Weiche 0c und Buchungs-Zuordnung lassen den Privat-Weg aus");
  ok(/fiaon_lead_weg/.test(lies("server/lib/fiaon-radar-faden.ts")), "Radar-Postlauf überspringt die Fäden der Lead-Mails (keine Doppelbearbeitung in js@)");
  const routes = lies("server/routes.ts"), crons = lies("server/lib/fiaon-crons.ts");
  ok(/tageslauf\('lead_post'/.test(routes) && /tageslauf\('lead_nachfass'/.test(routes), "Läufe lead_post und lead_nachfass sind registriert");
  ok(/lead_post:\s*\{/.test(crons) && /lead_nachfass:\s*\{/.test(crons) && /VERKAUFSLAEUFE[\s\S]*?\n  lead_nachfass: \(e\) =>/.test(crons), "LAUF_FOLGEN kennt beide, der Wächter der Verkaufsläufe den Nachfass");
  const skript = lies("scripts/lead-willkommen-entwuerfe.ts");
  ok(skript.includes("neueMailEntwurf(") && !/neueMailSendenMitFaden|antwortSenden\(|mailDirektSenden|eigeneMailSenden|\.senden\(/.test(skript), "Entwurf-Skript: nur Entwürfe, kein Sende-Aufruf");
  ok(skript.includes("default_transaction_read_only") && skript.includes("JUSTIN_GO"), "Entwurf-Skript: Produktion nur lesend, Entwürfe nur mit Justins Wort");
  const motor = lies("server/mail/motor.ts");
  ok(/replyTo: mail\.antwortAn \?\? mail\.absender/.test(motor), "Motor: Reply-To aus antwortAnFuer");
  const reg = lies("server/make-events-registry.ts"), mw = lies("server/make-webhook.ts"), ev = lies("server/lib/fiaon-mail-events.ts");
  for (const e of ["global_lead_willkommen", "global_lead_nachfass", "global_info"]) ok(reg.includes(`type: "${e}"`) && mw.includes(`"${e}"`) && ev.includes(e), `${e}: im Register, im Ereignis-Typ, im Mailwerk`);
  const firmen = lies("server/routes/fiaon-firmen.ts");
  ok(/infoMailUrteil\(/.test(firmen) && /infoMailVermerken\(/.test(firmen) && /vonName: "FIAON Global"/.test(firmen), "Info-Mail-Route: Urteil, Vermerk, Absendername FIAON Global");
  ok(!/kein_interesse\b[^\n]*\|\|[^\n]*keineMailsGewuenscht/.test(post) || post.includes('vorab === "kein_interesse" || keineMailsGewuenscht(kern)'), "Abmeldung: Radar-Regel ODER der eindeutige Lead-Satz");
}

abschnitt("A20 E-487 (09.11.2026): Maras WhatsApp-Link auch in N1–N3; das Willkommen hängt nie mehr still");
{
  const MB = await import("../shared/fiaon-mara-business");
  const nr = "4915100000000", kennung = "AbCdEfGh23";
  const WAM = new Date("2026-11-05T09:30:00Z");
  const N = (stufe: 1 | 2 | 3, over: Record<string, unknown> = {}) => T.nachfassText(stufe, {
    sprache: "de", name: "Max Mustermann", link: LINK, willkommenAm: WAM, jetzt: new Date("2026-11-06T09:30:00Z"),
    anrufVersuch: null, angaben: "antworten", firma: "Muster Logistik GmbH", ...over,
  } as any);
  for (const sprache of ["de", "en"] as const) {
    const url = MB.waGlobalLink(nr, kennung, sprache)!;
    for (const stufe of [1, 2, 3] as const) {
      const m = N(stufe, { sprache, whatsapp: { url } });
      const k = klar(m);
      const block = m.bloecke.find((b: any) => b.art === "link" && b.url === url) as any;
      pruefe(!!block && k.includes(url), "N mit WhatsApp-Block enthält Maras Link", `N${stufe} ${sprache}`);
      pruefe(block?.anzeige === (sprache === "en" ? "Message Mara on WhatsApp" : "Mara auf WhatsApp schreiben"), "Anzeige wie in W („Mara auf WhatsApp schreiben“)", `N${stufe} ${sprache}`);
      const funde = await LP.leadMailPruefen(m, { maraNummer: nr });
      pruefe(funde.length === 0, "die Wand-Ausnahme aus d395d8cf (eigenerWaSatz) gilt auch im Nachfass — kein Fund", `N${stufe} ${sprache}: ${funde.join("; ")}`);
      pruefe((k.match(/[–—]/g) ?? []).length <= 1, "höchstens ein Gedankenstrich (die WhatsApp-Zeile bringt keinen)", `N${stufe} ${sprache}`);
      pruefe(T.platzhalterWache(k).length === 0, "Platzhalter-Wache still", `N${stufe} ${sprache}`);
      pruefe(sprache !== "de" || !/\b(du|dich|dir|dein\w*)\b/i.test(k), "Sie-Form", `N${stufe} ${sprache}`);
      const fremd = N(stufe, { sprache, whatsapp: { url: MB.waGlobalLink("4915199999999", kennung, sprache)! } });
      pruefe((await LP.leadMailPruefen(fremd, { maraNummer: nr })).some((f: string) => /fremde Adresse/.test(f)), "ein Link zu einer anderen Nummer bleibt eine fremde Adresse", `N${stufe} ${sprache}`);
      pruefe((await LP.leadMailPruefen(m, { maraNummer: null })).length > 0, "ohne bekannte Mara-Nummer bleibt die Wand streng", `N${stufe} ${sprache}`);
    }
  }
  sammelAus(6);
  const n1 = klar(N(1, { whatsapp: { url: MB.waGlobalLink(nr, kennung, "de")! } }));
  ok(n1.includes("Lieber schriftlich? Schreiben Sie meiner digitalen Assistentin Mara auf WhatsApp:"), "N1: „Lieber schriftlich?“ wie in W");
  const n3 = N(3, { whatsapp: { url: MB.waGlobalLink(nr, kennung, "de")! } });
  const i3 = n3.bloecke.findIndex((b: any) => b.art === "link" && /wa\.me/.test(b.url));
  ok(i3 > 0 && i3 === n3.bloecke.length - 2 && /Auch auf WhatsApp erreichen Sie meine digitale Assistentin Mara:/.test(klar(n3)), "N3: die WhatsApp-Zeile vor dem Gruß „viel Erfolg“");
  for (const stufe of [1, 2, 3] as const) ok(!klar(N(stufe)).includes("wa.me") && !klar(N(stufe)).includes("WhatsApp"), `N${stufe} ohne Link (Mara Business aus): Wortlaut wie bisher`);
  const lage = { ...LP.musterLage("de"), weg: { code: null, codeBis: null, willkommenAm: WAM, willkommenStatus: "gesendet", willkommenVersuche: 1, willkommenLaeuft: null, gmailFaden: "f", gmailErsteId: "f", nachfassStufe: 0, nachfassAm: null, nachfassFaellig: null, nachfassLaeuft: null, stoppAm: null, stoppGrund: null, abgemeldetAm: null, antwortAm: null } };
  ok(klar(LP.nachfassFuer(1, lage as any, LINK, new Date("2026-11-06T09:30:00Z"), { whatsapp: { url: MB.waGlobalLink(nr, kennung, "de")! } })).includes("wa.me/4915100000000"), "nachfassFuer reicht Maras Link durch");

  // Das Willkommen hängt nie mehr still (Befund 05.–09.11.: 0 Willkommens-Mails, kein Alarm).
  const post = lies("server/lib/fiaon-global-lead-post.ts");
  const fehler = post.split("async function willkommenFehler(")[1]?.split("\n}\n")[0] ?? "";
  ok(/willkommen_versuche = willkommen_versuche \+ CASE WHEN \$\{wand\} THEN 1 ELSE 0 END/.test(fehler) && /if \(wand \|\| versuche >= 3\)/.test(fehler) && /alarmMelden\("lead-takt:lead-mail"/.test(fehler), "ein Fund der Wand zählt einen Versuch und meldet SOFORT (wie beim Nachfass)");
  ok(/willkommenFehler\(anfrageId, `Wand: \$\{funde\.join\("; "\)\}`, lauf, "wand"\)/.test(post), "W: die Wand ruft willkommenFehler mit „wand“");
  const laufW = post.split("export async function leadPostLauf(")[1]?.split("\n}\n")[0] ?? "";
  const laufCode = laufW.split("\n").filter((z) => !z.trim().startsWith("//")).join("\n");
  ok(!/ORDER BY a\.id LIMIT 5/.test(laufCode) && /ORDER BY COALESCE\(w\.updated_at, a\.created_at\) ASC, a\.id ASC LIMIT \$\{WILLKOMMEN_KANDIDATEN\}/.test(laufW), "Kandidaten: nach COALESCE(updated_at, Eingang), nicht mehr „ORDER BY a.id LIMIT 5“ (fünf kaputte Zeilen sperrten alle)");
  ok(/NOT \(w\.willkommen_status = 'fehler' AND w\.updated_at > \$\{jetzt\}::timestamptz - \$\{WILLKOMMEN_PAUSE_MIN\}::int \* INTERVAL '1 minute'\)/.test(laufW), "eine Zeile mit „fehler“ macht 30 Minuten Pause statt alle 2 Minuten vorn zu stehen");
  gleich(LP.WILLKOMMEN_PAUSE_MIN, 30, "Pause 30 Minuten");
  ok(LP.WILLKOMMEN_KANDIDATEN >= 20, `höheres Limit (${LP.WILLKOMMEN_KANDIDATEN}, vorher 5)`);
  ok(laufW.indexOf("willkommenMitTerminAuslassen(lauf)") > 0 && laufW.indexOf("willkommenMitTerminAuslassen(lauf)") < laufW.indexOf("const kandidaten"), "Anfragen mit Termin bleiben nicht als „fehler“ stehen — vor den Kandidaten aufgeräumt");
  const termin = post.split("async function willkommenMitTerminAuslassen(")[1]?.split("\n}\n")[0] ?? "";
  ok(/willkommen_status = 'ausgelassen', willkommen_grund = \$\{STOPP_TEXT\.termin\}/.test(termin) && /IN \('', 'fehler', 'wartet'\)/.test(termin) && /COALESCE\(a\.status, ''\) = 'termin' OR EXISTS \(SELECT 1 FROM fiaon_lead_gespraech g WHERE g\.anfrage_id = a\.id\)/.test(termin), "… „ausgelassen“ mit dem Grund „hat ein Gespräch (Termin)“ — nie eine gesendete Zeile");
  ok(/whatsapp: await maraWhatsappLink\(link\.url, lage\.sprache\)/.test(post.split("export async function nachfassSenden(")[1] ?? ""), "N1–N3 im Betrieb: mit Maras WhatsApp-Link (wie W)");
}

// ═══════════════════════════════════════════════════════════════════════════
if (LOKAL_DB) {
  abschnitt("B0 Aufbau (Wegwerf-Kopie, erfundene Menschen, Attrappen)");
  const { sqlPool: sql } = await import("../server/lib/db-pool");
  const G = await import("../server/lib/fiaon-global-termin");
  const M = await import("../server/lib/fiaon-meta-leads");
  const D = await import("../server/lib/fiaon-lead-dossier");
  const LW = await import("../server/lib/fiaon-lead-weg");
  const GG = await import("../server/lib/fiaon-global-gespraech");
  const LAUF = randomBytes(3).toString("hex");
  const DOM = `lm-${LAUF}.example`;
  const mail = (n: number) => `lm-${LAUF}-${n}@${DOM}`;
  const nummer = (n: number) => `+4915100${String(parseInt(LAUF, 16) % 1000).padStart(3, "0")}${String(n).padStart(3, "0")}`;
  const JS = LP.LEAD_POSTFACH;
  const dossierPost: any[] = [], wegPost: any[] = [], meldungen: any[] = [];
  LW.leadWegVersandSetzen(async (m: any) => { wegPost.push(m); return { ok: true, messageId: `<lmw-${LAUF}-${wegPost.length}@example.com>` }; });
  D.dossierVersandSetzen(async (m: any) => { dossierPost.push(m); return { ok: true, messageId: `<lmd-${LAUF}-${dossierPost.length}@example.com>` }; });
  LP.leadPostMeldungSetzen(async (m: any) => { meldungen.push(m); return { ok: true, messageId: `<lmm-${LAUF}-${meldungen.length}@example.com>` }; });

  // ── Die Gmail-Attrappe: ein Postfach js@ im Speicher ──
  type Post = { id: string; threadId: string; ordner: "sent" | "inbox"; von: string; an: string; vonName?: string; betreff: string; text: string; html?: string; datum: Date; auto?: boolean };
  const post: Post[] = [];
  let pn = 0;
  const pid = () => `lm${LAUF}x${++pn}`;
  const handschrift = new Set<string>();
  let fehlerNachVersand: string | null = null, fehlerVorVersand: string | null = null;
  LP.leadPostGmailSetzen({
    async senden(pf, i) {
      if (fehlerVorVersand) { const f = fehlerVorVersand; fehlerVorVersand = null; throw new Error(f); }
      const id = pid();
      post.push({ id, threadId: id, ordner: "sent", von: pf, an: i.an, vonName: i.vonName, betreff: i.betreff, text: i.text, html: i.html, datum: new Date() });
      if (fehlerNachVersand) { const f = fehlerNachVersand; fehlerNachVersand = null; throw new Error(f); }
      return { id, threadId: id };
    },
    async antworten(pf, ziel, i) {
      const id = pid();
      const erste = post.find((p) => p.id === ziel.id);
      post.push({ id, threadId: ziel.threadId, ordner: "sent", von: pf, an: ziel.an, vonName: i.vonName, betreff: `Re: ${erste?.betreff ?? ""}`, text: i.text, html: i.html, datum: new Date() });
      return { id, threadId: ziel.threadId };
    },
    async gesendetSuchen(_pf, an, ab) {
      const p = post.find((x) => x.ordner === "sent" && x.an === an && x.datum.getTime() >= ab.getTime() - 60_000);
      return p ? { id: p.id, threadId: p.threadId } : null;
    },
    async schonGeschrieben(an) { return handschrift.has(an); },
    async suchen(_pf, q) {
      const qq = q.toLowerCase();
      const liste = qq.includes("(from:mailer-daemon") ? post.filter((p) => p.ordner === "inbox" && /mailer-daemon|postmaster/.test(p.von))
        : /(^|\s)in:sent/.test(qq) ? post.filter((p) => p.ordner === "sent")
          // Nachbesserung: die Faden-Suche (Posteingang ohne Rückläufer — der Leser filtert selbst auf unsere Fäden).
          : qq.includes("-from:mailer-daemon") ? post.filter((p) => p.ordner === "inbox" && !/mailer-daemon|postmaster/.test(p.von))
            : post.filter((p) => p.ordner === "inbox" && qq.includes(p.von.toLowerCase()));
      return liste.map((p) => ({ id: p.id, threadId: p.threadId }));
    },
    async lesen(_pf, id) {
      const p = post.find((x) => x.id === id)!;
      return { id: p.id, threadId: p.threadId, labelIds: [], von: p.von, vonAdresse: p.von.toLowerCase(), an: p.an, betreff: p.betreff,
        messageIdHeader: `<${p.id}@example.com>`, datum: p.datum, text: p.text, snippet: p.text.slice(0, 120), autoHinweis: !!p.auto,
        antwortAn: null, references: null, anhaenge: [] } as any;
    },
    async absender() { return { name: "Justin Schwarzott", signaturHtml: "<div>Justin Schwarzott<br>Gründer, FIAON</div>", signaturText: "Justin Schwarzott\nGründer, FIAON", quelle: "attrappe" }; },
  });
  const eingang = (von: string, threadId: string, betreff: string, text: string, auto = false) => {
    const id = pid();
    post.push({ id, threadId, ordner: "inbox", von, an: JS, betreff, text, datum: new Date(), auto });
    return id;
  };
  const anAdresse = (adr: string) => post.filter((p) => p.ordner === "sent" && p.an === adr);
  const weg = async (id: number) => ((await sql`SELECT * FROM fiaon_lead_weg WHERE anfrage_id = ${id}`) as any[])[0];
  const firmaVon = async (adr: string) => Number(((await sql`SELECT id FROM fiaon_firmen_leads WHERE LOWER(email) = ${adr} ORDER BY id LIMIT 1`) as any[])[0]?.id ?? 0);
  const cockpit = async (firmaId: number, ergebnis: string) => Number(((await sql`SELECT COUNT(*)::int AS n FROM fiaon_firmen_log WHERE firma_id = ${firmaId} AND ergebnis = ${ergebnis}`) as any[])[0]?.n ?? 0);
  const spaeter = (min: number) => new Date(Date.now() + min * 60_000);

  const setze = (k: string, v: string) => sql`INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${k}, ${v}, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  const [kal] = (await sql`INSERT INTO fiaon_agents (name, first_name, email, active, is_test_account, rolle) VALUES ('Pruef Kalender', 'Pruef', ${`kal-${LAUF}@example.com`}, TRUE, TRUE, 'agent') RETURNING id`) as any[];
  const [zst] = (await sql`INSERT INTO fiaon_agents (name, first_name, email, active, is_test_account, rolle) VALUES ('Pruef Vertrieb', 'Pruef', ${`vt-${LAUF}@example.com`}, TRUE, FALSE, 'agent') RETURNING id`) as any[];
  const [bet] = (await sql`INSERT INTO fiaon_agents (name, first_name, email, active, is_test_account, rolle) VALUES ('Pruef Betreuung', 'Pruef', ${`bt-${LAUF}@example.com`}, TRUE, FALSE, 'agent') RETURNING id`) as any[];
  const KAL = Number(kal.id), ZST = Number(zst.id), BET = Number(bet.id);
  for (const wt of [1, 2, 3, 4, 5]) await sql`INSERT INTO fiaon_agent_verfuegbarkeit (agent_id, wochentag, von, bis, aktiv) VALUES (${KAL}, ${wt}, '07:00', '20:00', TRUE), (${ZST}, ${wt}, '07:00', '20:00', TRUE)`;
  await setze("gruender_termin_agent_id", String(KAL));
  await setze("global_zustaendig_agent_id", String(ZST));
  await sql`DELETE FROM fiaon_settings WHERE key = ANY(${["global_kalender_agent_id", "global_lead_pro_tag", "global_kalender_gesamt_pro_tag", "lead_dossier_an",
    T.LEAD_POST_SCHLUESSEL.willkommenAn, T.LEAD_POST_SCHLUESSEL.nachfassAn, T.LEAD_POST_SCHLUESSEL.ab, T.LEAD_POST_SCHLUESSEL.ruheMin]})`;
  await setze("global_termin_pro_tag", "8");
  await M.metaTabellen();
  await D.leadDossierSchema();
  await LW.leadWegSchema();
  await GG.ensureGlobalGespraechSpalten();
  await LP.leadPostSchema();
  const kontakt = (n: number, over: Record<string, unknown> = {}) => ({
    name: `Lm Person${n}`, vorname: "Lm", nachname: `Person${n}`, firma: `Lm Handel ${LAUF} ${n} GmbH`, email: mail(n), telefon: nummer(n),
    paket: null, paketText: null, land: "DE", sprache: "de" as const, ...over,
  });
  const META_TEXT = "Über das Meta-Sofortformular (Prüfung).\nVorhaben: vorhaben_3\nKapitalrahmen ziel: kapitalrahmen_ziel_2\nWann starten: wann_starten_1";
  const anfrage = async (n: number, opt: { text?: string | null; over?: Record<string, unknown>; meta?: boolean } = {}) => (await G.globalAnfrageAnnehmen({
    kontakt: kontakt(n, opt.over) as any, wunschzeit: null, text: opt.text ?? null, ip: opt.meta ? "meta-sofortformular" : `198.51.100.${n % 250}`,
    ...(opt.meta ? { herkunft: { wo: "Meta-Sofortformular", quelle: "meta", autor: "Meta" } } : {}),
  })).anfrageId;
  ok(KAL > 0 && ZST > 0 && BET > 0, "Testkonten angelegt");

  abschnitt("B1 Schalter AUS (Vorgabe) — Einschalten setzt den Zählbeginn, der Altbestand bleibt still");
  const e0 = await LP.leadPostEinstellungen();
  ok(!e0.willkommenAn && !e0.nachfassAn && e0.ab === null && e0.ruheMin === 10, "Vorgabe: beide AUS, kein Zählbeginn, 10 Minuten Ruhe");
  const A0 = await anfrage(0);
  gleich((await LP.willkommenSenden(A0, { jetzt: spaeter(11) })).ergebnis, "aus", "Schalter AUS → keine Mail");
  await LP.leadPostLauf(spaeter(11)); // der erste Lauf nach dem Start schreibt den Stundenpuls
  gleich(await LP.leadPostLauf(spaeter(11)), false, "Lauf bei AUS ohne Arbeit: keine Historienzeile (nur der Stundenpuls)");
  gleich(anAdresse(mail(0)).length, 0, "Lauf bei AUS: nichts gesendet");
  const e1 = await LP.leadPostSchalten("willkommen", true);
  ok(e1.willkommenAn && !!e1.ab && Math.abs(Date.parse(e1.ab!) - Date.now()) < 60_000, "EIN → Zählbeginn = jetzt");
  const r0 = await LP.willkommenSenden(A0, { jetzt: spaeter(11) });
  ok(r0.ergebnis === "ausgelassen" && r0.grund === "Altbestand", `Anfrage vor dem Zählbeginn → still (nur das Entwurf-Skript) (${r0.grund})`);
  gleich((await weg(A0))?.willkommen_status, "ausgelassen", "… als „ausgelassen“ gemerkt");
  gleich(anAdresse(mail(0)).length, 0, "nichts gesendet");
  ok(String(await LP.leadMailHinweis(A0)).startsWith("Keine Willkommens-Mail: vor dem Zählbeginn"), "Dossier-Satz: „Keine Willkommens-Mail: vor dem Zählbeginn …“");

  abschnitt("B2 W: nach 10 Minuten Ruhe genau EINE Mail aus js@ — Link, Unterschrift, Fuß, Protokoll, Cockpit");
  const A1 = await anfrage(1, { text: "Wir liefern nach Texas und brauchen dort eine Gesellschaft." });
  ok(String(await LP.leadMailHinweis(A1)).includes("geht nach 10 Minuten Ruhe hinaus"), "Dossier-Satz vor dem Versand: „geht nach 10 Minuten Ruhe hinaus“");
  const r1a = await LP.willkommenSenden(A1, { jetzt: spaeter(2) });
  ok(r1a.ergebnis === "wartet" && /Ruhe/.test(String(r1a.grund)), "2 Minuten nach dem Eingang: wartet (Ruhe — eine Buchung über den Danke-Knopf käme sonst hinter die Mail)");
  gleich(anAdresse(mail(1)).length, 0, "noch nichts gesendet");
  const r1 = await LP.willkommenSenden(A1, { jetzt: spaeter(11) });
  gleich(r1.ergebnis, "gesendet", `nach 11 Minuten: gesendet (${r1.grund ?? ""})`);
  const w1 = anAdresse(mail(1));
  gleich(w1.length, 1, "genau EINE Mail");
  const wg1 = await weg(A1);
  const code1 = String(wg1?.code ?? "");
  ok(w1[0]?.von === JS && w1[0]?.vonName === "Justin Schwarzott" && w1[0]?.betreff === "Ihre Anfrage bei FIAON Global", "aus js@ als Justin, Betreff „Ihre Anfrage bei FIAON Global“");
  ok(code1.length === 10 && w1[0].text.includes(`https://fiaon.com/g/${code1}`) && String(w1[0].html).includes(`https://fiaon.com/g/${code1}`), "sein persönlicher Link (Scheibe 3)");
  ok(w1[0].text.includes("Sie haben uns kurz beschrieben, worum es Ihnen geht") && !w1[0].text.includes("Texas"), "Website-Nachricht: nie zitiert");
  ok(w1[0].text.includes(T.LEAD_FUSS_SATZ.de) && w1[0].text.includes("Impressum: ") && String(w1[0].html).includes("gmail_signature"), "Abmelde-Satz, Pflichtangaben, echte Unterschrift");
  ok(/[Kk]ollege Pruef Vertrieb/.test(w1[0].text) && !BANK_SATZ.test(w1[0].text) && !/\bmorgen\b/i.test(w1[0].text), "die zuständige Person als „mein Kollege“, kein Bank-Satz, nie „morgen“");
  ok(wg1?.willkommen_status === "gesendet" && !!wg1?.willkommen_am && wg1?.gmail_faden === w1[0].threadId && wg1?.gmail_erste_id === w1[0].id, "lead_weg: gesendet, Faden gemerkt");
  gleich(new Date(wg1?.nachfass_faellig).getTime(), LP.nachfassFaelligAm(new Date(wg1?.willkommen_am), 1, "DE").getTime(), "N1 fällig: nächster Werktag 10 Uhr");
  const [ml1] = (await sql`SELECT event, status, art, payload FROM fiaon_mail_log WHERE LOWER(empfaenger) = ${mail(1)} ORDER BY id DESC LIMIT 1`) as any[];
  ok(ml1?.event === "global_lead_willkommen" && ml1?.status === "versandt" && jsonLesen(ml1?.payload)?.versandweg === "google", "Versandprotokoll: global_lead_willkommen, versandweg google (der Brevo-Abgleich lässt sie aus)");
  gleich(Number(((await sql`SELECT COUNT(*)::int AS n FROM fiaon_lead_post WHERE anfrage_id = ${A1} AND art = 'willkommen'`) as any[])[0]?.n), 1, "fiaon_lead_post: eine Zeile");
  const F1 = await firmaVon(mail(1));
  gleich(await cockpit(F1, "lead_mail"), 1, "Cockpit: „Willkommens-Mail von Justin“");
  const r1b = await LP.willkommenSenden(A1, { jetzt: spaeter(12) });
  ok(r1b.ergebnis === "ausgelassen" && anAdresse(mail(1)).length === 1, "zweiter Aufruf: nichts (schon gesendet)");
  ok(String(await LP.leadMailHinweis(A1)).startsWith("Willkommens-Mail von dir (js@) mit Terminlink ist raus"), "Dossier-Satz danach: „ist raus“");

  abschnitt("B3 Kein zweites Willkommen: zweiter Eingang derselben Adresse, Handmail");
  const A1b = await anfrage(1);
  const r1c = await LP.willkommenSenden(A1b, { jetzt: spaeter(11) });
  ok(r1c.ergebnis === "ausgelassen" && anAdresse(mail(1)).length === 1, `zweiter Eingang derselben Adresse → kein zweites Willkommen (${r1c.grund})`);
  // Nachbesserung (Gutachten Lead-Sicht, Mangel 8): die neuere Anfrage derselben Adresse beendet den Nachfass der älteren.
  const lage1b = await LP.leadLageLesen(A1);
  ok(!!lage1b?.stopp.neuere && T.leadStoppGrund(lage1b.stopp) === "neuere_anfrage", "eine neuere Anfrage derselben Adresse → Stopp „neuere Anfrage“ für die ältere");
  // Für den Rest des Prüfstands gilt wieder die erste Anfrage (die zweite zählt als Test-Eingang).
  await sql`UPDATE fiaon_anfragen SET ist_test = TRUE WHERE id = ${A1b}`;
  const A3 = await anfrage(3);
  handschrift.add(mail(3));
  const r3 = await LP.willkommenSenden(A3, { jetzt: spaeter(11) });
  ok(r3.ergebnis === "ausgelassen" && r3.grund === "Handmail" && anAdresse(mail(3)).length === 0, "Justin schrieb in 14 Tagen schon von Hand → kein Willkommen");

  abschnitt("B4 Buchung in der Ruhezeit (Meta-Lead über seinen Link) → kein Willkommen; die Bestätigung trägt SEINE Sätze");
  const A5 = await anfrage(5, { meta: true, text: META_TEXT, over: { firma: "Lm Person5 (Firma noch offen)" } });
  const lage5 = await LP.leadLageLesen(A5);
  ok(lage5?.kanal === "meta" && lage5.antworten.map((a) => a.code).join(",") === "vorhaben_3,kapitalrahmen_ziel_2,wann_starten_1", "Meta-Lead: seine Antworten mit Codes gelesen");
  const link5 = await LW.leadCodeSichern(A5);
  const angebot = await G.globalAngebotLaden();
  const tag = angebot.tage[0];
  const b5 = tag ? await G.globalTerminBuchen({ kontakt: kontakt(5, { firma: "Lm Person5 (Firma noch offen)" }) as any, tag: tag.tag, zeit: tag.zeiten[0], thema: null, code: link5!.code }) : ({ ok: false, error: "kein Tag" } as any);
  ok(b5.ok, `Buchung über den persönlichen Link: ${b5.ok ? "ok" : b5.error}`);
  const r5 = await LP.willkommenSenden(A5, { jetzt: spaeter(11) });
  ok(r5.ergebnis === "ausgelassen" && /Termin/.test(String(r5.grund)) && anAdresse(mail(5)).length === 0, `gebucht → kein Willkommen (${r5.grund})`);
  gleich((await weg(A5))?.stopp_grund, "termin", "Stopp „termin“ gemerkt");
  const [bm5] = (await sql`SELECT payload FROM fiaon_mail_log WHERE LOWER(empfaenger) = ${mail(5)} AND event = 'global_termin' ORDER BY id DESC LIMIT 1`) as any[];
  const p5 = jsonLesen(bm5?.payload) ?? {};
  ok(String(p5.angaben_satz ?? "").startsWith("Ihre Angaben aus dem Formular liegen uns vor. Sie möchten so bald wie möglich beides angehen") && !/\d|\$|€/.test(String(p5.angaben_satz)), "Bestätigung: „Ihre Angaben liegen uns vor“ + sein Vorhaben in einem Satz, ohne Betrag");
  ok(p5.antwort_an === "js@fiaon.com", "Bestätigung eines Lead-Gesprächs: Antworten an Justin (antwort_an in der Nutzlast)");
  ok(p5.firma === "" && p5.paket === "", "Bestätigung: Platzhalter-Firma und fehlender Paketwunsch → leer (die Zeilen entfallen)");

  abschnitt("B5 Unklarer Versand → der Gesendet-Ordner entscheidet (nie ein blinder zweiter Versand); Postfach gestört → kein Versuch verbraucht");
  const A6 = await anfrage(6);
  fehlerNachVersand = "socket hang up";
  const r6 = await LP.willkommenSenden(A6, { jetzt: spaeter(11) });
  ok(r6.ergebnis === "unklar" && anAdresse(mail(6)).length === 1, "Netz bricht NACH dem Versand ab → „unklar“");
  const wg6 = await weg(A6);
  ok(wg6?.willkommen_status === "unklar" && !!wg6?.willkommen_laeuft && !wg6?.willkommen_am, "… willkommen_laeuft bleibt (der Abgleich entscheidet)");
  const r6b = await LP.willkommenSenden(A6, { jetzt: spaeter(12) });
  ok(r6b.ergebnis === "wartet" && anAdresse(mail(6)).length === 1, "nächster Versuch: wartet — kein zweiter Versand");
  await sql`UPDATE fiaon_lead_weg SET willkommen_laeuft = NOW() - INTERVAL '16 minutes' WHERE anfrage_id = ${A6}`;
  await LP.leadPostLauf(spaeter(13));
  const wg6b = await weg(A6);
  ok(wg6b?.willkommen_status === "gesendet" && !!wg6b?.willkommen_am && wg6b?.gmail_erste_id === anAdresse(mail(6))[0].id && anAdresse(mail(6)).length === 1, "Abgleich: im Gesendet-Ordner gefunden → nachgebucht, genau eine Mail");
  const A6b = await anfrage(16);
  fehlerVorVersand = "HTTP 429 rateLimitExceeded";
  const r16 = await LP.willkommenSenden(A6b, { jetzt: spaeter(11) });
  const wg16 = await weg(A6b);
  ok(r16.ergebnis === "wartet" && Number(wg16?.willkommen_versuche) === 0 && !wg16?.willkommen_laeuft && anAdresse(mail(16)).length === 0, "Postfach gestört (429) → wartet, kein Versuch verbraucht");
  const r16b = await LP.willkommenSenden(A6b, { jetzt: spaeter(12) });
  ok(r16b.ergebnis === "gesendet" && anAdresse(mail(16)).length === 1, "nächster Lauf: gesendet");

  abschnitt("B6 N1: nächster Werktag ~10 Uhr, im selben Faden — Schalter, Fälligkeit, Budget");
  // Das Willkommen liegt einen Tag zurück (Frequenzbremse und Budget zählen echte Zeit).
  await sql`UPDATE fiaon_mail_log SET created_at = created_at - INTERVAL '26 hours' WHERE LOWER(empfaenger) = ${mail(1)} AND event = 'global_lead_willkommen'`;
  const f1 = new Date((await weg(A1)).nachfass_faellig);
  const JN1 = new Date(f1.getTime() + 30 * 60_000);
  gleich((await LP.nachfassSenden(A1, { jetzt: JN1 })).ergebnis, "aus", "Nachfass-Schalter AUS (Vorgabe) → nichts");
  await LP.leadPostSchalten("nachfass", true);
  const vor = await LP.nachfassSenden(A1, { jetzt: new Date(f1.getTime() - 60_000) });
  ok(vor.ergebnis === "wartet" && vor.grund === "noch nicht fällig", "vor der Fälligkeit: wartet");
  // Nachbesserung (Gutachten Lead-Sicht, Mangel 5): W hat Daniels Anruf angekündigt, im Cockpit steht noch keiner → N1 wartet
  // EINMAL einen Werktag (keine zweite Zusage vor dem Anruf); danach geht er.
  const versch = await LP.nachfassSenden(A1, { jetzt: JN1 });
  ok(versch.ergebnis === "wartet" && /angekündigte Anruf fehlt/.test(String(versch.grund)) && anAdresse(mail(1)).length === 1, `angekündigter Anruf fehlt → N1 einen Werktag später (${versch.grund})`);
  ok(!!(await weg(A1))?.nachfass_verschoben_am, "… einmal gemerkt (nachfass_verschoben_am)");
  await sql`UPDATE fiaon_lead_weg SET nachfass_faellig = ${f1} WHERE anfrage_id = ${A1}`;
  const n1 = await LP.nachfassSenden(A1, { jetzt: JN1 });
  ok(n1.ergebnis === "gesendet" && n1.stufe === 1, `N1 gesendet (${n1.grund ?? ""})`);
  const s1 = anAdresse(mail(1));
  ok(s1.length === 2 && s1[1].threadId === s1[0].threadId && s1[1].betreff === "Re: Ihre Anfrage bei FIAON Global", "N1 im selben Faden (Re:)");
  ok(s1[1].text.includes("kurz nachgefragt, ob meine Nachricht") && s1[1].text.includes(`https://fiaon.com/g/${code1}`), "N1: die Nachfrage + derselbe Link");
  const wgn = await weg(A1);
  const mind2 = GL.berlinZeit(new Date(wgn.nachfass_faellig));
  ok(Number(wgn.nachfass_stufe) === 1 && new Date(wgn.nachfass_faellig).getTime() >= LP.nachfassFaelligAm(new Date(wgn.willkommen_am), 2, "DE").getTime() && mind2.stunde === 10, "Stufe 1, N2 fällig frühestens +3 Werktage (und zwei Werktage nach N1) um 10 Uhr");
  const [ml1n] = (await sql`SELECT event FROM fiaon_mail_log WHERE LOWER(empfaenger) = ${mail(1)} ORDER BY id DESC LIMIT 1`) as any[];
  gleich(ml1n?.event, "global_lead_nachfass", "Versandprotokoll: global_lead_nachfass");
  // Budget: eine Lead-Mail am selben (Berliner) Tag → die nächste rückt einen Werktag weiter, nie verloren.
  await sql`UPDATE fiaon_mail_log SET created_at = ${JN1} WHERE LOWER(empfaenger) = ${mail(1)} AND event = 'global_lead_nachfass'`;
  await sql`UPDATE fiaon_lead_weg SET nachfass_faellig = ${new Date(JN1.getTime() + 60_000)} WHERE anfrage_id = ${A1}`;
  const nb = await LP.nachfassSenden(A1, { jetzt: new Date(JN1.getTime() + 5 * 60_000) });
  ok(nb.ergebnis === "wartet" && /heute schon/.test(String(nb.grund)), `Budget: höchstens eine Lead-Mail am Tag → wartet (${nb.grund})`);
  const wgb = await weg(A1);
  const naechster = T.werktagPlus(GL.berlinZeit(JN1).iso, 1, LP.feiertagFuer("DE"));
  ok(GL.berlinZeit(new Date(wgb.nachfass_faellig)).iso === naechster && GL.berlinZeit(new Date(wgb.nachfass_faellig)).stunde === 10, "… und rückt einen Werktag weiter (10 Uhr)");
  gleich(anAdresse(mail(1)).length, 2, "keine dritte Mail");

  abschnitt("B7 Antwort in js@ → Cockpit-Zeile, Nachfass-Stopp, Meldung im Dossier-Faden, Rückruf-Auftrag mit Wunschzeit");
  // Der Leser läuft nur mit Willkommen AN, Zählbeginn und Not-Aus AN (Gutachten Technik, Mangel 1).
  await LP.leadPostSchalten("antworten", false);
  eingang(mail(1), s1[0].threadId, "Re: Ihre Anfrage bei FIAON Global", "Kurz vorab: ich melde mich.");
  gleich((await LP.leadAntwortenLesen()).gelesen, 0, "Not-Aus „Antworten lesen“ AUS → der Leser liest nichts");
  post.splice(post.length - 1, 1);
  await LP.leadPostSchalten("antworten", true);
  // Daniels Anruf-Auftrag zu Anfrage 1 ist erledigt (sonst hinge die Antwort als Beitrag an ihm — Fall unten).
  await sql`UPDATE fiaon_betreiber_todos SET status = 'erledigt' WHERE schluessel = ${`global-anfrage:${A1}`}`;
  meldungen.length = 0;
  const aId = eingang(mail(1), s1[0].threadId, "Re: Ihre Anfrage bei FIAON Global",
    "Guten Tag Herr Schwarzott,\n\npasst Ihnen Mittwoch 14 Uhr?\n\nViele Grüße\nLm Person1\n\nAm Do., 05.11.2026 um 10:00 schrieb Justin Schwarzott:\n> vielen Dank für Ihre Anfrage");
  const ae = await LP.leadAntwortenLesen();
  ok(ae.antworten === 1 && ae.abmeldungen === 0 && ae.vonHand === 0, `eine Antwort erkannt (${JSON.stringify(ae)})`);
  const wga = await weg(A1);
  ok(!!wga.antwort_am && wga.stopp_grund === "antwort" && wga.nachfass_faellig === null, "antwort_am, Stopp „antwort“, kein Nachfass mehr fällig");
  void aId;
  const [au] = (await sql`SELECT titel, text, zustaendig_agent_id FROM fiaon_betreiber_todos WHERE schluessel = ${`global-antwort:${A1}`}`) as any[];
  ok(Number(au?.zustaendig_agent_id) === ZST && /Wunschzeit Mittwoch/.test(String(au?.titel)), `Rückruf-Auftrag an die zuständige Person — mit der erkannten Wunschzeit (${au?.titel})`);
  ok(/die Plattform antwortet nie selbst/.test(String(au?.text)) && !/Am Do\./.test(String(au?.text)), "Auftrag: Auszug ohne das Zitat, die Plattform antwortet nie selbst");
  ok(meldungen.length === 1 && /ANTWORT DES LEADS/.test(String(meldungen[0]?.text)) && !/Am Do\./.test(String(meldungen[0]?.text)), "Meldung an Justin — kurz, keine Aufgabe");
  gleich(await cockpit(F1, "antwort"), 1, "Cockpit: „Der Lead hat Justin geantwortet“");
  const nach = await LP.nachfassSenden(A1, { jetzt: new Date(JN1.getTime() + 7 * 86_400_000) });
  ok(nach.ergebnis === "ausgelassen" && anAdresse(mail(1)).length === 2, "kein N2 nach der Antwort");
  gleich((await LP.leadAntwortenLesen()).antworten, 0, "dieselbe Antwort nie zweimal (gmail_id)");
  // Nachbesserung (Gutachten Technik Mangel 1, Lead-Sicht Mangel 1): EIN Auftrag je Anfrage, die Meldung an Justin nur einmal.
  meldungen.length = 0;
  eingang(mail(1), s1[0].threadId, "Re: Ihre Anfrage bei FIAON Global", "Und noch eine Frage: geht es auch ohne Notar?");
  gleich((await LP.leadAntwortenLesen()).antworten, 1, "zweite Antwort desselben Leads gelesen");
  gleich(Number(((await sql`SELECT COUNT(*)::int AS n FROM fiaon_betreiber_todos WHERE schluessel LIKE 'global-antwort:%' AND titel LIKE ${`%Lm Handel ${LAUF} 1 GmbH%`}`) as any[])[0]?.n), 1, "… und weiter GENAU EIN Rückruf-Auftrag (die zweite Mail hängt sich an)");
  gleich(meldungen.length, 0, "… keine zweite Meldung an Justin (die Mails liegen ohnehin bei ihm)");
  // Antwort im Faden von einer anderen Adresse (Gutachten Technik, Mangel 12 b).
  eingang(`assistenz-${LAUF}@${DOM}`, s1[0].threadId, "Re: Ihre Anfrage bei FIAON Global", "Ich bin die Assistenz von Herrn Person1 — passt auch Freitag?");
  gleich((await LP.leadAntwortenLesen()).antworten, 1, "eine Antwort im Faden von einer anderen Adresse wird erkannt");
  // Justin antwortet selbst im Faden → der offene Rückruf-Auftrag entfällt (Lead-Sicht, Mangel 1 Nr. 5).
  post.push({ id: pid(), threadId: s1[0].threadId, ordner: "sent", von: JS, an: mail(1), betreff: "Re: Ihre Anfrage bei FIAON Global", text: "Gern, ich rufe Sie Mittwoch an. Justin", datum: new Date() });
  await LP.leadAntwortenLesen();
  gleich(((await sql`SELECT status FROM fiaon_betreiber_todos WHERE schluessel = ${`global-antwort:${A1}`}`) as any[])[0]?.status, "erledigt", "Justin schreibt selbst im Faden → der Rückruf-Auftrag schließt sich");
  // Altbestand (vor dem Zählbeginn, ohne Willkommen): der Leser liest seine Mails nie.
  eingang(mail(0), pid(), "Frage", "Ich hatte vor einer Weile angefragt — wie ist der Stand?");
  const alt0 = await LP.leadAntwortenLesen();
  ok(alt0.antworten === 0 && Number(((await sql`SELECT COUNT(*)::int AS n FROM fiaon_betreiber_todos WHERE schluessel = ${`global-antwort:${A0}`}`) as any[])[0]?.n) === 0, "Altbestand: keine Antwort gelesen, kein Auftrag (Gutachten Technik, Mangel 1)");
  // Termin: eine Antwort auf die Bestätigung („Danke, bis Donnerstag“) legt keinen Rückruf-Auftrag an.
  meldungen.length = 0;
  eingang(mail(5), pid(), "Re: Ihr Gespräch zu FIAON Global", "Danke, bis Donnerstag!");
  gleich((await LP.leadAntwortenLesen()).antworten, 1, "Antwort eines Leads mit Termin gelesen");
  gleich(Number(((await sql`SELECT COUNT(*)::int AS n FROM fiaon_betreiber_todos WHERE schluessel = ${`global-antwort:${A5}`}`) as any[])[0]?.n), 0, "… kein Rückruf-Auftrag (er hat schon ein Gespräch)");
  ok(meldungen.length === 1 && /schon ein Gespräch bei dir/.test(String(meldungen[0]?.text)), "… Justin erfährt es (betrifft vermutlich Verschieben oder die Nummer)");
  // Offener Anruf-Auftrag: die Antwort hängt sich an DIESEN (mit Wunschzeit), kein zweiter Auftrag.
  eingang(mail(16), anAdresse(mail(16))[0].threadId, "Re: Ihre Anfrage bei FIAON Global", "Gern telefonisch, am besten Mittwoch 15 Uhr.");
  gleich((await LP.leadAntwortenLesen()).antworten, 1, "Antwort bei offenem Anruf-Auftrag gelesen");
  gleich(Number(((await sql`SELECT COUNT(*)::int AS n FROM fiaon_betreiber_todos WHERE schluessel = ${`global-antwort:${A6b}`}`) as any[])[0]?.n), 0, "… kein zweiter Auftrag");
  const [offenA] = (await sql`SELECT id, faellig_am::text AS f FROM fiaon_betreiber_todos WHERE schluessel = ${`global-anfrage:${A6b}`}`) as any[];
  const [beitragA] = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_betreiber_todo_beitraege WHERE todo_id = ${offenA?.id ?? 0} AND text LIKE '%Wunschzeit Mittwoch%'`.catch(() => [{ n: -1 }])) as any[];
  ok(Number(beitragA?.n) >= 1, `… die Antwort steht mit der Wunschzeit am offenen Anruf-Auftrag (${beitragA?.n}, fällig ${offenA?.f})`);

  abschnitt("B8 „keine Mails“ → Sperre, kein Rückruf; Rückläufer → Stopp; Justin schreibt selbst → Stopp");
  const A7 = await anfrage(7);
  gleich((await LP.willkommenSenden(A7, { jetzt: spaeter(11) })).ergebnis, "gesendet", "W an Lead 7");
  meldungen.length = 0;
  const id7 = eingang(mail(7), anAdresse(mail(7))[0].threadId, "Re: Ihre Anfrage bei FIAON Global", "Bitte keine Mails mehr.\n\nGruß\nLm");
  const ae7 = await LP.leadAntwortenLesen();
  ok(ae7.abmeldungen === 1 && ae7.antworten === 0, `Abmeldung erkannt (${JSON.stringify(ae7)})`);
  const wg7 = await weg(A7);
  ok(!!wg7.abgemeldet_am && wg7.stopp_grund === "abgemeldet" && (await LP.leadLageLesen(A7))?.stopp.abgemeldet, "abgemeldet_am, Stopp „abgemeldet“, die Lage kennt es");
  gleich(Number(((await sql`SELECT COUNT(*)::int AS n FROM fiaon_betreiber_todos WHERE schluessel = ${`global-antwort:${id7}`}`) as any[])[0]?.n), 0, "Abmeldung: kein Rückruf-Auftrag");
  ok(meldungen.some((m) => /ABMELDUNG/.test(String(m.text))), "Meldung an Justin: ABMELDUNG");
  const A8 = await anfrage(8);
  gleich((await LP.willkommenSenden(A8, { jetzt: spaeter(11) })).ergebnis, "gesendet", "W an Lead 8");
  meldungen.length = 0;
  eingang("mailer-daemon@googlemail.com", anAdresse(mail(8))[0].threadId, "Delivery Status Notification (Failure)",
    `Address not found\n\nYour message wasn't delivered to ${mail(8)} because the address couldn't be found, or is unable to receive mail.`, true);
  const ae8 = await LP.leadAntwortenLesen();
  ok(ae8.ruecklaeufer === 1, `Rückläufer erkannt (${JSON.stringify(ae8)})`);
  ok((await weg(A8))?.stopp_grund === "unzustellbar" && (await cockpit(await firmaVon(mail(8)), "ruecklaeufer")) === 1 && meldungen.some((m) => /RÜCKLÄUFER/.test(String(m.text))), "Stopp „unzustellbar“, Cockpit-Zeile, Meldung an Justin");
  const A9 = await anfrage(9);
  gleich((await LP.willkommenSenden(A9, { jetzt: spaeter(11) })).ergebnis, "gesendet", "W an Lead 9");
  post.push({ id: pid(), threadId: anAdresse(mail(9))[0].threadId, ordner: "sent", von: JS, an: mail(9), betreff: "Re: Ihre Anfrage bei FIAON Global", text: "Guten Tag, ich rufe Sie gleich an. Justin", datum: new Date() });
  const ae9 = await LP.leadAntwortenLesen();
  ok(ae9.vonHand === 1 && (await weg(A9))?.stopp_grund === "von_hand", `Justin schreibt selbst im Faden → Stopp „von_hand“ (${JSON.stringify(ae9)}); seine automatischen Mails zählen nicht`);

  // Nachbesserung (Gutachten Sicherheit, Mangel 6): „kein Interesse“ ist eine schriftliche Absage — kein Anruf mehr.
  const A13 = await anfrage(13);
  gleich((await LP.willkommenSenden(A13, { jetzt: spaeter(11) })).ergebnis, "gesendet", "W an Lead 13");
  eingang(mail(13), anAdresse(mail(13))[0].threadId, "Re: Ihre Anfrage bei FIAON Global", "Kein Interesse.\n\nGruß");
  const ae13 = await LP.leadAntwortenLesen();
  ok(ae13.abmeldungen === 1, `Absage erkannt (${JSON.stringify(ae13)})`);
  const [au13] = (await sql`SELECT status FROM fiaon_betreiber_todos WHERE schluessel = ${`global-anfrage:${A13}`}`) as any[];
  const [f13] = (await sql`SELECT status FROM fiaon_firmen_leads WHERE id = ${await firmaVon(mail(13))}`) as any[];
  ok(au13?.status === "erledigt" && f13?.status === "kein_interesse", `schriftliche Absage: Daniels Anruf-Auftrag geschlossen, Firma „kein Interesse“ (${au13?.status}, ${f13?.status})`);
  ok((await cockpit(await firmaVon(mail(13)), "abgesagt")) === 1, "Cockpit: „Nicht anrufen — schriftlich abgesagt“");
  // Die Abmelde-Mail des Mailprogramms (List-Unsubscribe, Betreff „Stopp“, Automatik-Kennung) — nur keine Mails, anrufen erlaubt.
  const A14 = await anfrage(14);
  gleich((await LP.willkommenSenden(A14, { jetzt: spaeter(11) })).ergebnis, "gesendet", "W an Lead 14");
  eingang(mail(14), pid(), "Stopp", "This message was automatically generated by Gmail.", true);
  const ae14 = await LP.leadAntwortenLesen();
  ok(ae14.abmeldungen === 1 && ae14.automatisch === 0, `Abmelde-Mail des Mailprogramms → Abmeldung, nicht „automatisch“ (${JSON.stringify(ae14)})`);
  ok((await weg(A14))?.stopp_grund === "abgemeldet" && ((await sql`SELECT status FROM fiaon_betreiber_todos WHERE schluessel = ${`global-anfrage:${A14}`}`) as any[])[0]?.status !== "erledigt", "… keine Lead-Mail mehr, Daniels Anruf-Auftrag bleibt offen (anrufen erlaubt)");

  abschnitt("B9 Privatkunden-Weiche: Beschwerde → Leitung, Privatkunde → Betreuer, Bestandskunde → eigene Fassung");
  const A10 = await anfrage(10, { text: "Seit Wochen meldet sich niemand bei mir. Das ist eine Frechheit, ich will mein Geld zurück." });
  const [an10] = (await sql`SELECT status, zustaendig_agent_id FROM fiaon_anfragen WHERE id = ${A10}`) as any[];
  ok(an10?.status === "privat" && an10?.zustaendig_agent_id == null, "Beschwerde → Stand „privat“, niemandem aus dem Vertrieb zugeteilt");
  gleich(await firmaVon(mail(10)), 0, "kein Firmen-Lead (nicht in Daniels Liste)");
  const [au10] = (await sql`SELECT titel, zustaendig_agent_id FROM fiaon_betreiber_todos WHERE schluessel = ${`global-anfrage:${A10}`}`) as any[];
  ok(/^Beschwerde über das Global-Formular/.test(String(au10?.titel)) && au10?.zustaendig_agent_id == null, "Auftrag „Beschwerde …“ an die Leitung — nie an Daniel");
  ok(!(await LW.globalLeadAbsender(mail(10))), "Mara-Weiche 0c greift nicht (der Privat-Weg ist kein Business-Lead)");
  const r10 = await LP.willkommenSenden(A10, { jetzt: spaeter(11) });
  ok(r10.ergebnis === "ausgelassen" && anAdresse(mail(10)).length === 0, "keine Mail von Justin");
  ok(String(await LP.leadMailHinweis(A10)).startsWith("Privat-Weg"), "Dossier-Satz: Privat-Weg");
  const [p11] = (await sql`INSERT INTO fiaon_persons (person_ref, primary_email, assigned_agent_id) VALUES (${`LM-${LAUF}-P11`}, ${mail(11)}, ${BET}) RETURNING id`) as any[];
  await sql`INSERT INTO fiaon_applications (ref, email, payment_reference, payment_status, type, person_id) VALUES (${`LM-${LAUF}-11`}, ${mail(11)}, ${`LM${LAUF}11`}, 'paid', 'private', ${Number(p11.id)})`;
  const A11 = await anfrage(11, { text: "Ich habe eine Frage zu meiner Kreditkarte.", over: { firma: "Privatperson · Lm Person11" } });
  const [an11] = (await sql`SELECT status FROM fiaon_anfragen WHERE id = ${A11}`) as any[];
  const [au11] = (await sql`SELECT titel, zustaendig_agent_id FROM fiaon_betreiber_todos WHERE schluessel = ${`global-anfrage:${A11}`}`) as any[];
  ok(an11?.status === "privat" && /^Privatkunde schreibt über das Global-Formular/.test(String(au11?.titel)) && Number(au11?.zustaendig_agent_id) === BET, `Privatkundin ohne Global-Interesse → ihr Betreuer (${au11?.zustaendig_agent_id})`);
  gleich(await firmaVon(mail(11)), 0, "kein Firmen-Lead");
  await sql`INSERT INTO fiaon_applications (ref, email, payment_reference, payment_status, type) VALUES (${`LM-${LAUF}-12`}, ${mail(12)}, ${`LM${LAUF}12`}, 'pending', 'private')`;
  const A12 = await anfrage(12, { over: { paketText: "Global Struktur", paket: GLOBAL_PAKETE[0].key } });
  const [an12] = (await sql`SELECT COALESCE(status, 'neu') AS status FROM fiaon_anfragen WHERE id = ${A12}`) as any[];
  ok(an12?.status !== "privat" && (await firmaVon(mail(12))) > 0, "Bestandskunde MIT Global-Interesse → bleibt Global-Lead (Firmen-Cockpit)");
  gleich((await LP.willkommenSenden(A12, { jetzt: spaeter(11) })).ergebnis, "gesendet", "W an den Bestandskunden");
  ok(anAdresse(mail(12))[0]?.text.includes("Schön, dass Sie sich auch für FIAON Global interessieren") && anAdresse(mail(12))[0]?.text.includes("Sie interessieren sich für Global Struktur."), "eigene Fassung „Bestandskunde“, Paket nur mit Namen");

  abschnitt("B10 Info-Mail nach dem Anruf: nie bei Termin, N1 übernimmt „nicht erreicht“, nach „erreicht“ kein Tagesdeckel");
  const u0 = await LP.infoMailUrteil({ email: `kalt-${LAUF}@${DOM}`, telefon: null }, null);
  ok(!u0.lead && !u0.sperre && u0.art === "neutral", "Kaltakquise ohne Anruf: wie bisher, neutraler Einstieg");
  const u5 = await LP.infoMailUrteil({ email: mail(5), telefon: null }, "erreicht_interesse");
  ok(u5.lead && /Gespräch \(Termin\)/.test(String(u5.sperre)), "Lead mit Termin: keine Info-Mail (die Bestätigung hat er)");
  const u10 = await LP.infoMailUrteil({ email: mail(10), telefon: null }, "erreicht_interesse");
  ok(!u10.lead && !u10.sperre, "Privat-Weg: kein Business-Lead → die Info-Mail ist dort kein Thema der Lead-Regeln");
  const u12 = await LP.infoMailUrteil({ email: mail(12), telefon: null }, "nicht_erreicht");
  ok(u12.lead && /Nachfass-Mail übernimmt/.test(String(u12.sperre)), "„nicht erreicht“ bei laufendem Nachfass: N1 übernimmt — keine zweite Mail");
  const u12b = await LP.infoMailUrteil({ email: mail(12), telefon: null }, "erreicht_interesse");
  ok(u12b.lead && !u12b.sperre && u12b.art === "erreicht" && /^https:\/\/fiaon\.com\/g\/[A-Za-z0-9]{10}$/.test(String(u12b.link)), "nach „erreicht“: erlaubt (er hat darum gebeten — kein Tagesdeckel), mit seinem Link");
  const u12c = await LP.infoMailUrteil({ email: mail(12), telefon: null }, null);
  ok(u12c.lead && /Mail-Budget/.test(String(u12c.sperre)), "ohne Anruf am Tag des Willkommens: Tagesdeckel");
  await LP.infoMailVermerken(A12, mail(12), "FIAON Global — die Unterlagen zu unserem Gespräch");
  const [ml12] = (await sql`SELECT event FROM fiaon_mail_log WHERE LOWER(empfaenger) = ${mail(12)} ORDER BY id DESC LIMIT 1`) as any[];
  ok((await weg(A12))?.stopp_grund === "info_mail" && ml12?.event === "global_info", "nach der Info-Mail: Nachfass gestoppt, Protokoll global_info");

  abschnitt("B11 Wer anruft — mit dem Abwesenheits-Stand");
  const lz = { zustaendig: { id: ZST, name: "Pruef Vertrieb", weiblich: false }, letzterAnruf: null, land: "DE" };
  gleich((await LP.rufLageFuer(lz, new Date("2026-11-09T09:00:00Z"))).art, "heute", "Montag 10 Uhr: heute");
  const rn = await LP.rufLageFuer(lz, new Date("2026-11-07T22:00:00Z"));
  ok(rn.art === "ab" && GL.berlinZeit(rn.abTag!).iso === "2026-11-09", "Samstagnacht: Montag ab 9 Uhr");
  const rf = await LP.rufLageFuer(lz, new Date("2026-11-09T05:00:00Z"));
  ok(rf.art === "ab" && GL.berlinZeit(rf.abTag!).iso === "2026-11-09", "Montag 6 Uhr: heute ab 9 Uhr (mit Wochentag)");
  const rs = await LP.rufLageFuer(lz, new Date("2026-11-09T16:30:00Z"));
  ok(rs.art === "ab" && GL.berlinZeit(rs.abTag!).iso === "2026-11-10", "Montag 17:30: Dienstag");
  const rw = await LP.rufLageFuer(lz, new Date("2026-12-24T16:00:00Z"));
  ok(rw.art === "ab" && GL.berlinZeit(rw.abTag!).iso === "2026-12-28", "Heiligabend 17 Uhr: Montag nach Weihnachten");
  gleich((await LP.rufLageFuer({ ...lz, letzterAnruf: { ergebnis: "nicht_erreicht", am: new Date(), wer: null } }, new Date())).art, "versucht", "schon angerufen, nicht erreicht: „versucht“");
  gleich((await LP.rufLageFuer({ ...lz, zustaendig: null }, new Date())).kollege, null, "niemand zuständig: „wir“");

  abschnitt("B12 Die Läufe: lead_post (Willkommen) und lead_nachfass (Fenster)");
  const A15 = await anfrage(15);
  const lauf1 = await LP.leadPostLauf(spaeter(11));
  ok(lauf1 === true && anAdresse(mail(15)).length === 1, "lead_post: das Willkommen der neuen Anfrage, eine Historienzeile");
  await LP.leadPostLauf(spaeter(12));
  gleich(anAdresse(mail(15)).length, 1, "zweiter Lauf: nichts doppelt");
  const SA = new Date(Date.parse(`${T.werktagPlus(GL.berlinZeit(new Date()).iso, 1, () => false)}T09:00:00Z`));
  const samstag = (() => { let d = new Date(); for (let i = 0; i < 8 && GL.berlinZeit(d).tag !== 6; i++) d = new Date(d.getTime() + 86_400_000); return new Date(Date.parse(`${GL.berlinZeit(d).iso}T09:00:00Z`)); })();
  const nls = await LP.leadNachfassLauf(samstag);
  ok(nls.versandt === 0 && (nls.faellig === 0 || /außerhalb/.test(String(nls.grund))), `Samstag: nichts (außerhalb Mo–Fr 9–18 Uhr) (${JSON.stringify(nls)})`);
  void SA;
  const naechsterWerktag = new Date(LP.nachfassFaelligAm(new Date(), 1, "DE").getTime() + 30 * 60_000);
  const vorN = anAdresse(mail(15)).length;
  const gestoppt = [7, 8, 9, 12].map((n) => anAdresse(mail(n)).length);
  // Nachbesserung (Gutachten Lead-Sicht, Mangel 5): kein eingetragener Anruf → jeder N1 wartet EINMAL einen Werktag.
  const nlw0 = await LP.leadNachfassLauf(naechsterWerktag);
  ok(nlw0.versandt === 0 && nlw0.faellig >= 1 && anAdresse(mail(15)).length === vorN, `nächster Werktag: der angekündigte Anruf fehlt → N1 wartet einen Werktag (${JSON.stringify(nlw0)})`);
  await sql`UPDATE fiaon_lead_weg SET nachfass_faellig = ${new Date(naechsterWerktag.getTime() - 60_000)} WHERE nachfass_verschoben_am IS NOT NULL AND stopp_am IS NULL AND nachfass_stufe = 0 AND nachfass_faellig IS NOT NULL`;
  const nlw = await LP.leadNachfassLauf(naechsterWerktag);
  ok(nlw.faellig >= 1 && nlw.versandt === nlw.faellig && anAdresse(mail(15)).length === vorN + 1, `einen Werktag später: alle fälligen N1 gehen hinaus (${JSON.stringify(nlw)})`);
  gleich([7, 8, 9, 12].map((n) => anAdresse(mail(n)).length).join(","), gestoppt.join(","), "gestoppte Leads (abgemeldet, Rückläufer, von Hand, Info-Mail) bekommen keinen Nachfass");
  await LP.leadPostSchalten("nachfass", false);
  const aus = await LP.leadNachfassLauf(naechsterWerktag);
  ok(aus.aus && aus.versandt === 0, "Nachfass AUS → der Lauf meldet „aus“, sendet nichts");

  abschnitt("B13 „nicht erreicht“ beim Lead-Gespräch: der persönliche Link (vorausgefüllt)");
  if (b5.ok) {
    await GG.globalNichtErreichtSenden(b5.terminId);
    const [ne] = (await sql`SELECT payload FROM fiaon_mail_log WHERE LOWER(empfaenger) = ${mail(5)} AND event = 'global_nicht_erreicht' ORDER BY id DESC LIMIT 1`) as any[];
    const pne = jsonLesen(ne?.payload) ?? {};
    ok(String(pne.link_kalender ?? "").endsWith(`/g/${link5!.code}`), `Knopf „Neue Zeit wählen“ = sein Link (${pne.link_kalender})`);
  } else ok(false, "B13 braucht die Buchung aus B4");

  abschnitt("B14 Vorschau (Lead-Motor) und das Entwurf-Skript (--lokal): sendet nichts, ändert nichts");
  for (const art of ["willkommen", "n1", "n2", "n3"] as const) {
    const v = await LP.leadMailVorschau({ art, sprache: "de" });
    ok(v.funde.length === 0 && v.html.includes("fiaon.com/g/AbCdEfGh23") && v.html.includes("gmail_signature"), `Vorschau ${art} (Musterlead): Wand ohne Fund, Link, Unterschrift`);
  }
  const v1 = await LP.leadMailVorschau({ anfrageId: A1, art: "willkommen" });
  ok(v1.html.includes(`/g/${code1}`) && v1.funde.length === 0, "Vorschau zu einer echten Anfrage: ihr Link");
  const zaehlen = async () => JSON.stringify(((await sql`
    SELECT (SELECT COUNT(*) FROM fiaon_lead_weg)::int AS weg, (SELECT COUNT(*) FROM fiaon_mail_log)::int AS log,
           (SELECT COUNT(*) FROM fiaon_lead_post)::int AS post, (SELECT COUNT(*) FROM fiaon_betreiber_todos)::int AS todo`) as any[])[0]);
  const vorher = await zaehlen();
  let ausgabe = "";
  try {
    ausgabe = execFileSync(join(WURZEL, "node_modules/.bin/tsx"), [join(WURZEL, "scripts/lead-willkommen-entwuerfe.ts"), String(A3), String(A10), String(A1), "--lokal"], {
      cwd: WURZEL, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 120_000,
      env: { HOME: String(process.env.HOME ?? ""), PATH: String(process.env.PATH ?? ""), TZ: "Europe/Berlin", CRONS: "aus", DATABASE_URL: URL_DB },
    });
  } catch (e: any) { ausgabe = `FEHLER ${String(e?.stdout ?? "")}${String(e?.stderr ?? e?.message ?? e)}`; }
  ok(/Vorschau — nichts angelegt, nichts gesendet/.test(ausgabe), `Entwurf-Skript: Vorschau ohne Gmail (${ausgabe.slice(-160).replace(/\n/g, " ")})`);
  ok(/Anfrage #\d+[\s\S]*Ihre Anfrage bei FIAON Global/.test(ausgabe) && /übersprungen: Privat-Weg/.test(ausgabe) && /übersprungen: schon angeschrieben/.test(ausgabe), "… die Fassung für Lead 3, Privat-Weg und „schon angeschrieben“ übersprungen");
  gleich(await zaehlen(), vorher, "… und die Datenbank ist unverändert (nur lesend)");

  abschnitt("B15 Flut-Schutz (Gutachten Sicherheit, Mangel 2): ein Anschluss, viele Anfragen — und der Tagesdeckel");
  {
    const viaIp = async (n: number, ip: string) => (await G.globalAnfrageAnnehmen({ kontakt: kontakt(n) as any, wunschzeit: null, text: null, ip })).anfrageId;
    await viaIp(60, "203.0.113.77"); await viaIp(61, "203.0.113.77");
    const F3 = await viaIp(62, "203.0.113.77");
    const rf = await LP.willkommenSenden(F3, { jetzt: spaeter(11) });
    ok(rf.ergebnis === "ausgelassen" && rf.grund === "flut", `drei Website-Anfragen vom selben Anschluss in 24 Stunden: kein Willkommen aus js@ (${rf.ergebnis}/${rf.grund})`);
    gleich(anAdresse(mail(62)).length, 0, "… nichts gesendet");
    ok(((await sql`SELECT 1 FROM fiaon_betreiber_todos WHERE schluessel = ${`global-anfrage:${F3}`} AND status <> 'erledigt'`) as any[]).length === 1, "… Daniels Anruf-Auftrag steht trotzdem");
    // Tagesdeckel (hier 1, heute ging schon mindestens ein Willkommen): die Mail wartet bis morgen — kein „ausgelassen“.
    await setze(T.LEAD_POST_SCHLUESSEL.willkommenMaxTag, "1");
    const F4 = await anfrage(63);
    const rd = await LP.willkommenSenden(F4, { jetzt: spaeter(11) });
    ok(rd.ergebnis === "wartet" && /Tagesdeckel/.test(String(rd.grund)), `Tagesdeckel erreicht: die Mail wartet bis morgen (${rd.ergebnis}/${rd.grund})`);
    ok(!["ausgelassen", "gesendet"].includes(String((await weg(F4))?.willkommen_status ?? "")), "… nicht als „ausgelassen“ gemerkt");
    await sql`DELETE FROM fiaon_settings WHERE key = ${T.LEAD_POST_SCHLUESSEL.willkommenMaxTag}`;
    gleich((await LP.willkommenSenden(F4, { jetzt: spaeter(11) })).ergebnis, "gesendet", "Deckel wieder auf der Vorgabe: sie geht");
  }

  LP.leadPostGmailSetzen(null); LP.leadPostMeldungSetzen(null); LW.leadWegVersandSetzen(null); D.dossierVersandSetzen(null);
  await sql.end?.({ timeout: 5 });
} else {
  console.log("\n(B übersprungen — keine lokale Prüfdatenbank in DATABASE_URL)");
}

console.log(`\n${fehler ? "✗" : "✓"} ${geprueft - fehler}/${geprueft} Prüfungen grün.`);
process.exit(fehler ? 1 : 0);
