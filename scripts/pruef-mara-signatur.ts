// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: MARAS SIGNATURKARTE IM KUNDENDIENST (E-340, 12.10.2026)
//
// Justin: „eine sehr seriöse Signatur mit Profilbild an JEDER E-Mail“. Die Radar-Mails tragen die Karte seit E-337;
// seit E-340 auch jede Antwort, die Mara aus welcome@/support@ unterschreibt (Postmeister, Freigabe in der Zentrale,
// Nachholen, Mara-Aktion — alle über antwortBauen).
//
// Ohne Datenbank, ohne Netz, ohne Mailversand. Geprüft wird:
//   A  Mara-Antworten tragen die Karte: Porträt, „Digitale Assistentin“ (KI-VO Art. 50) in der Sprache der Mail,
//      Team und Adresse des Postfachs — und NICHT „FIAON Global“, /business oder „Antwortet meist in wenigen
//      Minuten“ (im Kundendienst warten viele Antworten als Entwurf; Messung 12.10.: 111 Entwürfe, 51 sofort).
//   B  Die Textunterschrift steht im HTML nicht mehr, in der Textfassung unverändert; ein Nachsatz (Stopp-Satz der
//      Mara-Aktion) bleibt erhalten — auch in fremdsprachigen Mails ohne Leerzeile davor.
//   C  Ohne Maras Namen im Gruß (js@-Gruß „Justin Schwarzott“, Teamgruß ohne Agentin) KEINE Karte.
//   D  Byte-Beleg gegen die Fassung vor dem Umbau (git archive BASIS): jede Mailwerk-Vorlage (DE und EN, HTML und
//      Text), jede Radar-Karte und jede Nicht-Mara-Antwort ist Byte für Byte gleich; bei Mara-Antworten die
//      Textfassung ebenso.
//   E  Gmail-Dunkelmodus: weißer Kartengrund (bgcolor + Klasse fiaon-karte) und <font color> an jeder Zeile.
//
// Aufruf: npx tsx scripts/pruef-mara-signatur.ts        (Exit 1 bei Fehlern; PRUEF_BASIS=<commit> für eine andere Basis)
// ═══════════════════════════════════════════════════════════════════════════
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

for (const k of ["BREVO_API_KEY", "OPENAI_API_KEY", "GOOGLE_SA_KEY", "DATABASE_URL_EXTERN", "RADAR_SEITE"]) delete process.env[k];
process.env.DATABASE_URL = "postgresql://nobody@127.0.0.1:1/none";

const WURZEL = path.resolve(new URL("..", import.meta.url).pathname);
const BASIS = process.env.PRUEF_BASIS || "9a50db5d";
let fehler = 0;
let geprueft = 0;
const ok = (bed: unknown, was: string) => { geprueft++; if (!bed) { fehler++; console.log(`  ✗ ${was}`); } };
const abschnitt = (t: string) => console.log(`\n${t}`);

const at = await import("../server/lib/fiaon-postmeister-antworttext");
const sig = await import("../server/lib/fiaon-signatur");
const geruest = await import("../server/mail/geruest");
const { VORLAGEN, VORLAGEN_EN } = await import("../server/mail/motor");

const schritt = { art: "zahlung", url: "https://fiaon.com/zahlung/FIAON-TJSA01", text: "x" } as any;
const kern = "vielen Dank für Ihre Nachricht. Ihre Rate über 99,99 € ist offen.\n\nSie können sie bequem über die Zahlungsseite begleichen.";
const welcome = at.grussMitAgent("Freundliche Grüße\nIhr FIAON Welcome-Team\nwelcome@fiaon.com · fiaon.com", "Mara Lindner");
const support = at.grussMitAgent("Freundliche Grüße\nIhr FIAON-Support\nsupport@fiaon.com · fiaon.com", "Mara Lindner");
const STOPP = "Möchten Sie keine Nachrichten mehr von mir, genügt eine kurze Antwort mit „Stopp“.";

/** Dieselben Fälle für alt und neu. */
const faelle = (m: typeof at) => ({
  maraDe: m.antwortBauen({ anrede: "Guten Tag Herr Muster,", kern, gruss: welcome, schritt, betreff: "Re: Rate", sprache: "de", agentName: "Mara Lindner" }),
  maraEn: m.antwortBauen({ anrede: "Dear Mr Muster,", kern: "Thank you.\n\nYour instalment is open.", gruss: support, schritt, betreff: "Re: Rate", sprache: "en", agentName: "Mara Lindner" }),
  maraOhneKnopf: m.antwortBauen({ anrede: "Guten Tag Frau Beispiel,", kern: "gern helfe ich Ihnen weiter.", gruss: welcome, schritt: null, betreff: "Re: Frage", sprache: "de", agentName: "Mara Lindner" }),
  aktionDe: m.antwortBauen({ anrede: "Guten Tag Herr Muster,", kern, gruss: `${welcome}\n\n${STOPP}`, schritt, betreff: "Ihre Rate", sprache: "de", agentName: "Mara Lindner", knopfText: "Verwendungszweck und Zahlungsdaten ansehen" }),
  aktionNl: m.antwortBauen({ anrede: "Geachte heer Muster,", kern: "Dank u.", gruss: `${welcome}\n\n${STOPP}`, schritt, betreff: "Uw termijn", sprache: "nl", agentName: "Mara Lindner" }),
  ausText: m.antwortAusText("Guten Tag Herr Muster,\n\nDanke. Ihre Rate ist offen.\n\nRechnung ansehen und bezahlen: https://fiaon.com/zahlung/FIAON-TJSA01\n\nFreundliche Grüße\nMara\nFIAON Welcome-Team", { schritt, betreff: "Re: x", sprache: "de", agentName: "Mara Lindner", gruss: welcome }),
  justin: m.antwortBauen({ anrede: "Guten Tag Herr Muster,", kern, gruss: "Freundliche Grüße\nJustin Schwarzott", schritt, betreff: "Re: x", sprache: "de", agentName: "Mara Lindner" }),
  ohneAgent: m.antwortBauen({ anrede: "Guten Tag Herr Muster,", kern, gruss: "Freundliche Grüße\nIhr FIAON Welcome-Team\nwelcome@fiaon.com · fiaon.com", schritt, betreff: "Re: x", sprache: "de", agentName: "" }),
  team: m.antwortBauen({ anrede: "Guten Tag,", kern, gruss: "Freundliche Grüße\nIhr FIAON-Team\nfiaon.com", schritt: null, betreff: "Re: x", sprache: "de" }),
});
const neu = faelle(at);
const MARA = ["maraDe", "maraEn", "maraOhneKnopf", "aktionDe", "aktionNl", "ausText"] as const;
const OHNE = ["justin", "ohneAgent", "team"] as const;

abschnitt("A · Mara-Antworten tragen die Karte");
for (const f of MARA) {
  const h = neu[f].html;
  ok(h.includes("https://fiaon.com/mail/signatur/mara.png"), `${f}: Porträt fehlt`);
  ok(/>Mara Lindner</.test(h), `${f}: Name auf der Karte fehlt`);
  ok(!/FIAON Global|fiaon\.com\/business|Antwortet meist/.test(h), `${f}: Global-/Radar-Zeile in einer Kundendienst-Mail`);
  ok(!h.includes("punkt.gif"), `${f}: Punkt-GIF (Status-Zeile) im Kundendienst`);
  ok((h.match(/mail\/signatur\/mara\.png/g) ?? []).length === 1, `${f}: Karte nicht genau einmal`);
}
ok(neu.maraDe.html.includes("Digitale Assistentin") && neu.maraDe.html.includes(">FIAON Welcome-Team<") && neu.maraDe.html.includes('href="mailto:welcome@fiaon.com"'), "welcome@: Rolle, Team oder Adresse fehlt");
ok(neu.maraEn.html.includes("Digital Assistant") && !neu.maraEn.html.includes("Digitale Assistentin") && neu.maraEn.html.includes(">FIAON-Support<") && neu.maraEn.html.includes("mailto:support@fiaon.com"), "support@ englisch: Rolle/Team/Adresse falsch");
ok(neu.aktionNl.html.includes("Digitale assistent"), "Niederländisch: Rolle nicht in der Sprache der Mail");
ok(neu.maraDe.html.indexOf("mara.png") < neu.maraDe.html.indexOf("Rechnung ansehen und bezahlen"), "Karte steht nicht vor dem Knopf (direkt nach den Absätzen)");
ok(neu.maraDe.html.indexOf(">Freundliche Grüße<") > 0 && neu.maraDe.html.indexOf(">Freundliche Grüße<") < neu.maraDe.html.indexOf("mara.png"), "Abschiedsformel nicht über der Karte");
ok(neu.maraEn.html.includes(">Kind regards<"), "Englische Abschiedsformel fehlt über der Karte");

abschnitt("B · Textunterschrift: im HTML ersetzt, im Text erhalten; Nachsatz bleibt");
for (const f of MARA) {
  ok(!/Mara Lindner<br \/>FIAON/.test(neu[f].html), `${f}: Textunterschrift steht noch im HTML`);
  ok(/Mara Lindner\nFIAON[ -](Welcome-Team|Support)/.test(neu[f].text), `${f}: Textfassung verlor die Unterschrift`);
}
ok(neu.aktionDe.html.includes(STOPP) && neu.aktionDe.html.indexOf(STOPP) > neu.aktionDe.html.indexOf("mara.png"), "Stopp-Satz fehlt unter der Karte (Mara-Aktion)");
ok(neu.aktionNl.html.includes(STOPP), "Fremdsprachige Mara-Aktion: Stopp-Satz ging verloren (keine Leerzeile davor)");
ok(neu.aktionDe.text.endsWith(STOPP), "Textfassung der Mara-Aktion endet nicht mit dem Stopp-Satz");

abschnitt("C · Ohne Maras Namen im Gruß keine Karte");
for (const f of OHNE) ok(!neu[f].html.includes("mail/signatur/"), `${f}: Karte, obwohl Mara nicht unterschreibt`);
ok(neu.justin.html.includes("Justin Schwarzott"), "js@-Gruß verschwand");

abschnitt("E · Gmail-Dunkelmodus");
{
  const karte = sig.signaturHtml(sig.maraKundendienst({ name: "Mara Lindner", rolle: "Digitale Assistentin", team: "FIAON Welcome-Team", email: "welcome@fiaon.com" }));
  ok(/class="fiaon-karte" bgcolor="#ffffff"/.test(karte) && karte.includes("background-color:#ffffff;"), "Kartengrund nicht weiß abgesichert");
  ok((karte.match(/<font color=/g) ?? []).length >= 4, "Zeilen ohne <font color> (Gmail-Inversion)");
  ok(neu.maraDe.html.includes(".fiaon-karte, .fiaon-karte td { background-color:#ffffff !important; }"), "Gerüst-Regel für .fiaon-karte fehlt");
}

abschnitt(`D · Byte-Beleg gegen ${BASIS}`);
const alt = mkdtempSync(path.join(tmpdir(), "fiaon-pruef-signatur-"));
try {
  const tar = execFileSync("git", ["-C", WURZEL, "archive", BASIS, "server/mail/geruest.ts", "server/lib/fiaon-signatur.ts", "server/lib/fiaon-postmeister-antworttext.ts", "server/lib/db-pool.ts", "server/lib/ddl-wache.ts"], { maxBuffer: 64 * 1024 * 1024 });
  writeFileSync(path.join(alt, "basis.tar"), tar);
  execFileSync("tar", ["-xf", "basis.tar"], { cwd: alt });
  // db-pool (Altfassung) lädt „postgres“ — Pakete aus dem Arbeitsbaum, verbunden wird nie.
  symlinkSync(path.join(WURZEL, "node_modules"), path.join(alt, "node_modules"));
  const geruestAlt = await import(path.join(alt, "server/mail/geruest.ts"));
  const sigAlt = await import(path.join(alt, "server/lib/fiaon-signatur.ts"));
  const atAlt = await import(path.join(alt, "server/lib/fiaon-postmeister-antworttext.ts"));
  let vorlagen = 0;
  for (const [name, liste] of [["de", VORLAGEN], ["en", VORLAGEN_EN]] as const) {
    for (const [k, b] of Object.entries(liste as Record<string, any>)) {
      vorlagen++;
      ok(geruestAlt.mailHtml(b) === geruest.mailHtml(b), `Vorlage ${name}/${k}: HTML anders als vor dem Umbau`);
      ok(geruestAlt.mailText(b) === geruest.mailText(b), `Vorlage ${name}/${k}: Text anders als vor dem Umbau`);
    }
  }
  console.log(`  ${vorlagen} Mailwerk-Vorlagen (HTML + Text) gegen das alte Gerüst verglichen.`);
  const radar = (m: any) => [
    m.signaturHtml(m.maraSignatur("Justin Schwarzott", { telefon: "+49 30 1234567" })),
    m.signaturHtml(m.maraSignatur("Justin Schwarzott")),
    m.signaturHtml({ person: "justin", name: "Justin Schwarzott", rolle: "Gründer", telefon: "+49 30 1", seite: "https://fiaon.com/business?utm_source=radar", termin: "https://fiaon.com/business#gespraech" }),
    m.htmlAusText("Hallo Herr Muster,\n\nEin Satz.\n\nViele Grüße\nMara Lindner\nDigitale Assistentin\n\n—\nFIAON LTD · Fuß", m.maraSignatur("Justin Schwarzott")),
    m.signaturText(m.maraSignatur("Justin Schwarzott")),
  ];
  const ra = radar(sigAlt);
  const rn = radar(sig);
  ra.forEach((x: string, i: number) => ok(x === rn[i], `Radar-Karte ${i}: anders als vor dem Umbau`));
  const vorher = faelle(atAlt);
  for (const f of OHNE) {
    ok(vorher[f].html === neu[f].html, `${f}: HTML anders als vor dem Umbau`);
    ok(vorher[f].text === neu[f].text, `${f}: Text anders als vor dem Umbau`);
  }
  for (const f of MARA) {
    ok(vorher[f].text === neu[f].text, `${f}: Textfassung anders als vor dem Umbau`);
    ok(vorher[f].html !== neu[f].html, `${f}: HTML unverändert — Karte fehlt`);
  }
} catch (e) {
  ok(false, `Basis ${BASIS} nicht lesbar (${e instanceof Error ? e.message.split("\n")[0] : e}) — PRUEF_BASIS=<commit> setzen.`);
} finally {
  rmSync(alt, { recursive: true, force: true });
}

console.log(`\n${fehler ? `✗ ${fehler} von ${geprueft} Prüfungen rot` : `✓ alle ${geprueft} Prüfungen grün`}`);
process.exit(fehler ? 1 : 0);
