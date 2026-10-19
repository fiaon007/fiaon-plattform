// Prüfstand E-406 C1 (19.10.2026), offline: Mara beantwortet Anliegen aus dem Kundenbereich.
// Ohne Datenbank, ohne Netz, ohne Schlüssel. Prüft die reinen Regeln (shared/fiaon-mara-anliegen.ts: heikel, Urteil,
// Senden, Knopf, Schalter), den Antworttext (anliegenAntwortBauen), die Kanal-Sätze in zahlung_suchen und
// angaben_aendern (Anliegen wie Mail, Mail unverändert), den Kanal im Agenten und die Verdrahtung (Takt, Route,
// Steuerpult, Kundenbereich, Rundgang, Team-Update). Datenbank-Teil: scripts/pruef-mara-anliegen-db.ts.
//   env -i HOME=$HOME PATH=$PATH TZ=Europe/Berlin CRONS=aus DATABASE_URL=postgresql://pruef@127.0.0.1:9/keine \
//     node_modules/.bin/tsx scripts/pruef-mara-anliegen.ts
// Alle Namen und Texte sind erfunden.
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "TWILIO_AUTH_TOKEN", "VAPID_PRIVATE_KEY"]) delete process.env[k];
process.env.DATABASE_URL ||= "postgresql://pruef@127.0.0.1:9/keine";
process.env.CRONS = "aus";
import { readFileSync } from "node:fs";

let gut = 0, schlecht = 0;
function ok(b: unknown, was: string, extra: unknown = "") {
  if (b) { gut++; console.log(`  ✓ ${was}`); }
  else { schlecht++; console.log(`  ✗ ${was}${extra !== "" ? ` — ${typeof extra === "string" ? extra : JSON.stringify(extra)}` : ""}`); }
}
const lies = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

async function main() {
  const R = await import("../shared/fiaon-mara-anliegen");
  const { anliegenHeikel, heikelAusEinordnung, anliegenUrteil, anliegenSendeUrteil, anliegenKnopfErlaubt, anliegenSchalterAn, maraStandSatz,
    anliegenHandPruefung, anliegenBuendelTeilen, anliegenZuAlt } = R;

  console.log("── 1 · Schalter (Standard AN)");
  ok(anliegenSchalterAn(undefined) && anliegenSchalterAn(null) && anliegenSchalterAn(""), "fehlt / leer → an");
  ok(anliegenSchalterAn("an") && anliegenSchalterAn("1"), "„an“ → an");
  ok(!anliegenSchalterAn("aus") && !anliegenSchalterAn("AUS") && !anliegenSchalterAn("0") && !anliegenSchalterAn("false"), "„aus“ / 0 / false → aus");

  console.log("── 2 · Heikel am Text (vor jeder KI)");
  const H = (betreff: string, text: string, dringend = false) => anliegenHeikel({ betreff, text, dringend })?.art ?? null;
  const heikelFaelle: [string, string, string, string, boolean?][] = [
    ["Kündigung", "Kündigung", "Bitte die Kündigung per sofort veranlassen!", "kuendigung"],
    ["Kündigung im Text", "Frage", "Hallo. Bitte die Kündigung sofort einleiten! Ich zahle ab sofort keine Raten mehr ein!", "kuendigung"],
    ["Storno", "Bestellung", "Bitte stornieren Sie meine Bestellung.", "kuendigung"],
    ["Vertrag beenden", "Vertrag", "Ich möchte meinen Vertrag beenden.", "kuendigung"],
    ["Widerruf", "Widerruf", "Hiermit widerrufe ich meinen Vertrag.", "widerruf"],
    ["Erstattung", "Geld", "Ich will mein Geld zurück, sofort.", "erstattung"],
    ["Rückerstattung", "Frage", "Wann bekomme ich die Rückerstattung?", "erstattung"],
    ["Löschwunsch", "Daten", "Bitte löschen Sie meine Daten.", "loeschen"],
    ["DSGVO", "Auskunft", "Nach DSGVO verlange ich die Löschung.", "loeschen"],
    ["Anwalt", "Ärger", "Mein Anwalt wird sich bei Ihnen melden.", "recht"],
    ["Klage", "Letzte Warnung", "Sonst reiche ich Klage ein.", "recht"],
    ["Amtsgericht (Wortteil)", "Brief", "Ich habe einen Brief vom Amtsgericht bekommen.", "recht"],
    ["Gerichtsvollzieher", "Besuch", "Morgen kommt der Gerichtsvollzieher.", "recht"],
    ["Verbraucherzentrale", "Info", "Ich habe mich an die Verbraucherzentrale gewandt.", "recht"],
    ["Betrug", "Unverschämt", "Das ist Betrug, ich habe das nie bestellt.", "bestreitet"],
    ["Bestreiten", "Forderung", "Ich bestreite diese Forderung.", "bestreitet"],
    ["Beschwerde", "Beschwerde", "Ich möchte mich über Ihren Service beschweren.", "beschwerde"],
    ["keine Werbung", "Mails", "Bitte keine Werbung mehr an mich.", "werbewiderspruch"],
    ["nicht mehr anrufen", "Anrufe", "Bitte rufen Sie mich nicht mehr an.", "werbewiderspruch"],
    ["in Ruhe lassen", "Bitte", "Lassen Sie mich endlich in Ruhe.", "werbewiderspruch"],
    ["Dringend-Kästchen", "Brief vom Inkasso", "Ich habe Post mit Frist bekommen, was soll ich tun?", "frist", true],
    ["Betreff DRINGEND:", "DRINGEND: Brief mit Frist", "Frist bis Freitag.", "frist"],
  ];
  for (const [name, b, t, art, d] of heikelFaelle) ok(H(b, t, !!d) === art, `${name} → ${art}`, H(b, t, !!d));

  console.log("── 3 · NICHT heikel — das beantwortet Mara");
  const harmlos: [string, string, string][] = [
    ["Karte", "Karte", "Wann bekomme ich meine Karte? Ich habe alles bezahlt."],
    ["DKB abgelehnt", "Bank", "Das Konto bei der Bank wurde abgelehnt, wie komme ich jetzt an meine Karte?"],
    ["vergessen?", "Gespräch heute 17 Uhr", "Haben Sie mich vergessen?"],
    ["Aufschub", "Telefonat", "Ich habe Aufschub bis Montag bekommen, damit ich es zahlen kann."],
    ["Link", "Link zur Partnerbank", "Der Link zur Partnerbank kam nicht an."],
    ["Umzug", "Neue Adresse", "Ich bin umgezogen: Musterweg 1, 12345 Musterstadt."],
    ["Ankündigung", "Rate", "Danke für die Ankündigung der Rate."],
    ["überwiesen", "Zahlung", "Ich habe gestern überwiesen."],
    ["Passwort", "Login", "Ich komme nicht in meinen Bereich, Passwort vergessen."],
    // E-406 Nachbesserung: die neuen Erstattungs-Regeln greifen nicht bei jedem „zurück“.
    ["Rückruf + bezahlt", "Rückruf", "Bitte rufen Sie mich zurück, ich habe die Rate bezahlt."],
    ["Urlaub zurück", "Zahlung", "Ich komme aus dem Urlaub zurück und zahle dann."],
    ["Unterlagen zurück", "Unterlagen", "Ich schicke Ihnen die Unterlagen zurück."],
    ["Englisch harmlos", "Card", "When will I get my card? I paid everything."],
  ];
  for (const [name, b, t] of harmlos) ok(H(b, t) === null, `${name} → nicht heikel`, anliegenHeikel({ betreff: b, text: t }));

  console.log("── 3b · ROT-FÄLLE Nachbesserung (Prüfer 19.10.): was heikelArt nicht sieht — vorher alle „nicht heikel“");
  const rotFaelle: [string, string, string][] = [
    ["Rückzahlung", "Ich möchte eine Rückzahlung meiner Gebühr.", "erstattung"],
    ["überweisen … zurück", "Bitte überweisen Sie mir die 49 € zurück, ich habe zu viel bezahlt.", "erstattung"],
    ["zahlen … zurück", "Zahlen Sie mir den Betrag bitte zurück.", "erstattung"],
    ["zurücküberweisen", "Können Sie mir das Geld zurücküberweisen?", "erstattung"],
    ["refund", "I want a refund of my payment please.", "erstattung"],
    ["pay back", "Can you pay me back the fee?", "erstattung"],
    ["delete (englisch)", "Please delete my account and all my data.", "loeschen"],
    ["GDPR", "According to the GDPR, I request that you remove my data.", "loeschen"],
    ["Inkasso", "Ich habe einen Brief vom Inkasso bekommen", "recht"],
    ["Inkassobüro", "Ein Inkassobüro schreibt mir wegen Ihrer Forderung.", "recht"],
    ["cancel (englisch)", "I want to cancel my contract.", "kuendigung"],
    ["withdrawal (englisch)", "I exercise my right of withdrawal.", "widerruf"],
    ["lawyer (englisch)", "I will take legal action and call my lawyer.", "recht"],
    ["complaint (englisch)", "I want to make a complaint about your service.", "beschwerde"],
  ];
  for (const [name, t, art] of rotFaelle) ok(H("Frage", t) === art, `${name} → ${art}`, H("Frage", t));

  console.log("── 4 · Heikel nach der Einordnung (KI + Riegel)");
  const E = (flags: Record<string, boolean>, kategorien: string[] = []) => heikelAusEinordnung({ flags, kategorien })?.art ?? null;
  ok(E({ kuendigung: true }) === "kuendigung", "Lampe kuendigung → kuendigung");
  ok(E({ widerruf: true, kuendigung: true }) === "widerruf", "Widerruf gewinnt vor Kündigung");
  ok(E({ beschwerde: true }) === "beschwerde", "Lampe beschwerde → beschwerde");
  ok(E({ droht_anwalt: true }) === "recht" && E({ rechtlich: true }) === "recht" && E({}, ["rechtlich"]) === "recht", "Anwalt / rechtlich → recht");
  ok(E({ bestreitet: true }) === "bestreitet", "bestreitet → bestreitet");
  ok(E({ stopp: true }) === "werbewiderspruch" && E({}, ["abmeldung"]) === "werbewiderspruch", "Stopp / Abmeldung → werbewiderspruch");
  ok(E({}, ["beschwerde"]) === "beschwerde" && E({}, ["kuendigung"]) === "kuendigung", "Kategorien zählen auch");
  ok(E({ zahlung_behauptet: true, rueckruf_wunsch: true, zahlungsunfaehig: true, auskunft_fehlt: true }) === null, "„habe bezahlt“, Rückruf, „kann nicht zahlen“, Auskunft → Mara antwortet (wie E-369)");

  console.log("── 5 · Das Urteil je Anliegen");
  const MITTAG = new Date("2026-10-20T12:00:00+02:00");
  const NACHT = new Date("2026-10-20T03:00:00+02:00");
  const basis: import("../shared/fiaon-mara-anliegen").AnliegenFakten = {
    schalterAn: true, kiPause: false, deckelErreicht: false, jetzt: MITTAG, mitPerson: true, global: false, test: false,
    alterTage: 0, heuteBeantwortet: 0, heikel: null,
  };
  const U = (f: Partial<typeof basis>) => anliegenUrteil({ ...basis, ...f });
  ok(U({}).art === "mara", "alles gut → mara");
  ok(U({ schalterAn: false }).art === "warten", "Schalter aus → warten (nichts geschrieben)");
  ok(U({ kiPause: true }).art === "warten" && /nachgeholt/.test((U({ kiPause: true }) as any).grund), "KI-Pause → warten, wird nachgeholt");
  ok(U({ deckelErreicht: true }).art === "warten", "Kostendeckel → warten");
  ok(U({ jetzt: NACHT }).art === "warten", "03:00 Berlin → warten bis 8 Uhr");
  ok(U({ jetzt: new Date("2026-10-20T20:00:00+02:00") }).art === "warten", "20:00 Berlin → warten");
  ok(U({ jetzt: new Date("2026-10-20T08:00:00+02:00") }).art === "mara", "08:00 Berlin → mara");
  ok(U({ global: true }).art === "nie", "FIAON Global → nie");
  ok(U({ test: true }).art === "nie", "Testperson → nie");
  ok(U({ global: true, heikel: { art: "kuendigung", grund: "x" } }).art === "nie", "Global schlägt heikel (gar nichts schreiben)");
  ok(U({ mitPerson: false }).art === "mensch", "ohne Akte → mensch");
  const h = U({ heikel: { art: "beschwerde", grund: "Beschwerde — ein Mensch antwortet." } });
  ok(h.art === "mensch" && (h as any).heikel === "beschwerde", "heikel → mensch mit Art", h);
  ok(U({ alterTage: R.ANLIEGEN_MAX_TAGE + 1 }).art === "mensch", `älter als ${R.ANLIEGEN_MAX_TAGE} Tage → mensch`);
  ok(U({ alterTage: R.ANLIEGEN_MAX_TAGE }).art === "mara", `genau ${R.ANLIEGEN_MAX_TAGE} Tage → mara`);
  ok(U({ heuteBeantwortet: R.ANLIEGEN_JE_PERSON_TAG }).art === "warten", `${R.ANLIEGEN_JE_PERSON_TAG} Antworten heute → warten bis morgen`);
  ok(U({ kiPause: true, global: true }).art === "warten", "Reihenfolge: erst die Bremsen, dann die Wände");

  console.log("── 5b · Bündel: zu alte Anliegen bleiben beim Menschen (Nachbesserung, Prüfer 19.10.)");
  const J = new Date("2026-10-19T12:00:00+02:00");
  const alt27 = { id: 1, created_at: new Date("2026-09-22T10:00:00+02:00") };
  const alt20 = { id: 2, created_at: new Date("2026-09-29T10:00:00+02:00") };
  const neu = { id: 3, created_at: new Date("2026-10-19T09:00:00+02:00") };
  const vor14 = { id: 4, created_at: new Date(J.getTime() - R.ANLIEGEN_MAX_TAGE * 86_400_000 - 3_600_000) };
  const b1 = anliegenBuendelTeilen([alt27, neu], J);
  ok(b1.buendel.map((x) => x.id).join() === "3" && b1.zuAlt.map((x) => x.id).join() === "1", "27 Tage alt + heute → Bündel nur das neue, das alte beim Menschen", b1);
  const b2 = anliegenBuendelTeilen([alt27, alt20], J);
  ok(b2.buendel.map((x) => x.id).join() === "2" && b2.zuAlt.map((x) => x.id).join() === "1", "alle zu alt → nur das jüngste im Bündel (Urteil: zu alt)", b2);
  const b3 = anliegenBuendelTeilen([vor14, neu], J);
  ok(b3.buendel.map((x) => x.id).join() === "4,3" && b3.zuAlt.length === 0, `genau ${R.ANLIEGEN_MAX_TAGE} Tage → noch im Bündel (dieselbe Grenze wie das Urteil)`, b3);
  ok(anliegenZuAlt(R.ANLIEGEN_MAX_TAGE + 1) && !anliegenZuAlt(R.ANLIEGEN_MAX_TAGE), "eine Grenze: anliegenZuAlt");

  console.log("── 6 · Senden oder beim Menschen lassen");
  const S = (f: Partial<Parameters<typeof anliegenSendeUrteil>[0]>) => anliegenSendeUrteil({
    text: "Guten Tag", automatischErlaubt: true, mensch: null, e393Gesperrt: false, heikel: null, ...f,
  });
  ok(S({}).senden === true, "sauber, automatisch erlaubt → senden");
  ok(S({ automatischErlaubt: false, grund: "Entwurf: ohne Beleg" }).senden === false, "Prüfung nicht sauber → Vorschlag");
  ok(S({ mensch: "rechtliches Anliegen" }).senden === false, "menschNoetig → Vorschlag");
  ok(S({ e393Gesperrt: true, e393Grund: "E-393" }).senden === false, "E-393-Sperre → Vorschlag");
  ok(S({ heikel: { art: "kuendigung", grund: "k" } }).senden === false, "heikel → nie senden");
  ok(S({ text: "  " }).senden === false, "leerer Text → nie senden");

  console.log("── 6b · Wenn ein MENSCH antwortet (Nachbesserung, Prüfer 19.10.: vorher ungeprüft)");
  const HP = (o: Partial<Parameters<typeof anliegenHandPruefung>[0]>) => anliegenHandPruefung({ antwort: "Guten Tag, Ihr Vorgang ist vollständig.", eingang: "Wie ist der Stand?", betreff: "Stand", ...o });
  ok(HP({}).ok === true, "sauberer Text → speichern");
  const rest = HP({ antwort: "Guten Tag, Ihre Kündigung wird wirksam, sobald die letzte Rate bezahlt ist.", eingang: "Ich möchte kündigen.", betreff: "Kündigung" });
  ok(rest.ok === false && /E-393/.test((rest as any).grund) && /umschreiben/.test((rest as any).grund), "ROT: Rest-Kopplung „wirksam, sobald die letzte Rate bezahlt ist“ → angehalten, mit Hinweis", rest);
  const gar = HP({ antwort: "Ich garantiere Ihnen, dass Sie Ihre Karte bekommen." });
  ok(gar.ok === false && /garantiere/.test((gar as any).grund), "ROT: Wortwand „garantiere“ → angehalten", gar);
  ok(HP({ antwort: "Bitte überweisen Sie an BE09 9058 0000 0000." }).ok === false, "ROT: gesperrte Bankverbindung → angehalten");
  ok(HP({ antwort: "Guten Tag, ich rufe Sie morgen um 10 Uhr an." }).ok === true, "eigene Zusage des Mitarbeiters („ich rufe Sie an“) → speichern (er tut es selbst)");
  const vorschlag = "Guten Tag Frau Probe,\n\nIhre Betreuerin ruft Sie morgen an und klärt das.\n\nFreundliche Grüße\nMara";
  const uebernommen = HP({ antwort: vorschlag, maraEntwurf: vorschlag, maraWerkzeuge: [] });
  ok(uebernommen.ok === false && /Maras Vorschlag/.test((uebernommen as any).grund), "ROT: übernommener Vorschlag mit ungedeckter Zusage → angehalten", uebernommen);
  ok(HP({ antwort: vorschlag, maraEntwurf: vorschlag, maraWerkzeuge: ["aufgabe_an_betreuer"] }).ok === true, "dieselbe Zusage, gedeckt durch Maras Werkzeug (Aufgabe lief) → speichern");
  ok(HP({ antwort: "Guten Tag Frau Probe,\n\nich rufe Sie morgen selbst an.\n\nFreundliche Grüße", maraEntwurf: vorschlag, maraWerkzeuge: [] }).ok === true, "Vorschlag umgeschrieben (eigener Satz) → speichern");

  console.log("── 7 · Der Knopf im Kundenbereich");
  ok(anliegenKnopfErlaubt("https://fiaon.com/zahlen/FIAON-X1"), "fiaon.com → erlaubt");
  ok(anliegenKnopfErlaubt("https://www.fiaon.com/t/abc"), "Unterdomain → erlaubt");
  ok(anliegenKnopfErlaubt("/app/mehr/hilfe"), "Pfad im Haus → erlaubt");
  ok(!anliegenKnopfErlaubt("http://fiaon.com/x"), "http → nein");
  ok(!anliegenKnopfErlaubt("https://fiaon.com.boese.invalid/x"), "fremde Domain, die so aussieht → nein");
  ok(!anliegenKnopfErlaubt("//boese.invalid/x") && !anliegenKnopfErlaubt("javascript:alert(1)") && !anliegenKnopfErlaubt(""), "// / javascript: / leer → nein");

  console.log("── 8 · Sätze auf /agent/anliegen (kurz)");
  for (const s of ["beantwortet", "entwurf", "mensch", "fehler"] as const) {
    const t = maraStandSatz(s, s === "mensch" ? "Kündigung oder Storno — ein Mensch antwortet." : null) ?? "";
    ok(t.length > 0 && t.length <= 90, `${s}: „${t}“ (${t.length} Zeichen)`);
  }
  ok(maraStandSatz(null) === null, "ohne Stand kein Satz");
  const mitGrund = maraStandSatz("entwurf", "E-393 gesperrt — Kündigung an Zahlung geknüpft") ?? "";
  ok(/E-393 gesperrt/.test(mitGrund), "Vorschlag: der Grund steht sichtbar im Satz (nicht nur im Tooltip)", mitGrund);
  ok((maraStandSatz("entwurf", "x".repeat(400)) ?? "").length <= 170, "Vorschlag: langer Grund gekürzt");

  console.log("── 9 · Antworttext für den Kundenbereich (anliegenAntwortBauen)");
  const { anliegenAntwortBauen, antwortBauen } = await import("../server/lib/fiaon-postmeister-antworttext");
  const a = anliegenAntwortBauen({
    anrede: "Guten Tag Frau Muster,", kern: "Guten Tag Frau Muster,\n\nIhre Rate & Ihr Link sind bereit.\nZahlen Sie hier: https://fiaon.com/zahlen/FIAON-X1\n\nMara",
    gruss: "Freundliche Grüße\nMara Lindner\nFIAON-Team", schritt: { art: "zahlung", url: "https://fiaon.com/zahlen/FIAON-X1", text: "" } as any, sprache: "de", agentName: "Mara Lindner",
  });
  ok(a.text.startsWith("Guten Tag Frau Muster,\n\n"), "beginnt mit der Anrede des Servers (eine)", a.text);
  ok((a.text.match(/Guten Tag/g) || []).length === 1, "doppelte Anrede des Modells entfernt");
  ok(a.text.includes("Ihre Rate & Ihr Link") && !a.text.includes("&amp;"), "reiner Text: & bleibt & (React escapt selbst)");
  ok(!a.text.includes("https://"), "keine Adresse im Text — sie steht im Knopf");
  ok(a.text.trimEnd().endsWith("Mara Lindner\nDigitale Assistentin · FIAON-Team") && (a.text.match(/Mara/g) || []).length === 1, "Gruß mit Mara genau einmal (Modell-Unterschrift entfernt), darunter „Digitale Assistentin“ (KI-Offenlegung)", a.text.slice(-60));
  const en = anliegenAntwortBauen({ anrede: "Dear Mr Sample,", kern: "Thank you.", gruss: "Kind regards\nMara Lindner\nFIAON-Team", sprache: "en", agentName: "Mara Lindner" });
  ok(!/Digitale Assistentin/.test(en.text) && /Mara Lindner\n.+ · FIAON-Team$/.test(en.text), "in Englisch die Rolle der Sprache", en.text.slice(-60));
  ok(a.knopf?.url === "https://fiaon.com/zahlen/FIAON-X1" && a.knopf?.text === "Rechnung ansehen und bezahlen", "Knopf getrennt, Text der Sprache", a.knopf);
  ok(anliegenAntwortBauen({ anrede: "Hallo,", kern: "Danke.", gruss: "Gruß" }).knopf === null, "ohne Schritt kein Knopf");
  // E-406 Nachbesserung: der Verweis im älteren Bündel-Anliegen in der Sprache der Antwort (vorher fest Deutsch).
  const { anliegenVerweisKern, grussMitAgent } = await import("../server/lib/fiaon-postmeister-antworttext");
  const am = new Date("2026-10-19T10:00:00+02:00");
  const gr = grussMitAgent("Freundliche Grüße\nIhr FIAON-Team", "Mara Lindner");
  const vEn = anliegenAntwortBauen({ anrede: "Dear Ms Sample,", gruss: gr, sprache: "en", agentName: "Mara Lindner", kern: anliegenVerweisKern({ sprache: "en", betreff: "Card", am }) }).text;
  ok(/I have answered your message/.test(vEn) && /19 October 2026/.test(vEn) && /Kind regards/.test(vEn), "ROT: Verweis auf Englisch — Satz, Datum, Gruß", vEn);
  ok(!/Ihre|Anliegen|Grüße|beantwortet|Digitale/.test(vEn), "ROT: keine deutschen Wörter im englischen Verweis (E-248 #5591)", vEn);
  const vDe = anliegenVerweisKern({ sprache: "de", betreff: "Karte", am });
  ok(/mit beantwortet/.test(vDe) && /„Karte“/.test(vDe) && /19\. Oktober 2026/.test(vDe), "Verweis auf Deutsch wie bisher (Datum ausgeschrieben)", vDe);
  for (const sp of ["fr", "es", "it", "nl", "pl", "ro", "tr", "bg", "ru"]) {
    const v = anliegenVerweisKern({ sprache: sp, betreff: "Karte", am });
    ok(v !== vDe && v.includes("Karte") && v.includes("2026"), `Verweis in ${sp}`, v);
  }
  ok(anliegenVerweisKern({ sprache: "xx", betreff: "Karte", am }) === vDe, "unbekannte Sprache → Deutsch (wie rahmenFuer)");
  // Die Mail bleibt, wie sie war (Knopfzeile im Text, &amp; im HTML-Teil).
  const m = antwortBauen({ anrede: "Guten Tag Frau Muster,", kern: "Ihre Rate & Ihr Link.", gruss: "Freundliche Grüße\nIhr FIAON-Support", schritt: { art: "zahlung", url: "https://fiaon.com/zahlen/FIAON-X1", text: "" } as any, betreff: "x", sprache: "de" });
  ok(m.text.includes("Rechnung ansehen und bezahlen: https://fiaon.com/zahlen/FIAON-X1"), "Mail-Text unverändert: Knopfzeile mit Adresse");

  console.log("── 10 · Kanal in zahlung_suchen und angaben_aendern (Anliegen wie Mail, Mail unverändert)");
  const ZS = await import("../shared/fiaon-zahlung-suchen");
  const leer = { art: "nichts", treffer: [], ohneEingang: [], tage: 21, haupt: null } as any;
  let zsMail = "", zsAnl = "", zsWa = "";
  try { zsMail = ZS.zahlungHinweis(leer, { kanal: "mail" }); zsAnl = ZS.zahlungHinweis(leer, { kanal: "anliegen" }); zsWa = ZS.zahlungHinweis(leer, { kanal: "whatsapp" }); } catch (e) { ok(false, "zahlungHinweis wirft", String(e)); }
  ok(zsMail.length > 0 && zsAnl === zsMail, "zahlung_suchen: Anliegen bekommt denselben Auftrag wie die Mail");
  ok(zsWa !== zsMail && /Kein Kollege, kein Termin/.test(zsWa), "WhatsApp bleibt bei seinem Satz");
  const AG = await import("../shared/fiaon-angaben-aendern");
  const lage = (kanal: any) => ({ kanal, ergebnisse: [{ feld: "anschrift", stand: "mensch", grund: "Ausland" }, { feld: "telefon", stand: "geaendert", vorher: "+491511111111", nachher: "+491522222222" }], verboten: ["name"] } as any);
  ok(AG.angabenHinweis(lage("anliegen")) === AG.angabenHinweis(lage("mail")), "angaben_aendern: Auftrag im Anliegen = Mail (Aufgabe Fall 4)");
  ok(AG.angabenSatz(lage("anliegen")) === AG.angabenSatz(lage("mail")), "angaben_aendern: Kundensatz im Anliegen = Mail");
  ok(/Karte/.test(AG.angabenHinweis(lage("whatsapp"))), "WhatsApp unverändert (Karte an Justin)");
  ok(/Aufgabe/.test(AG.angabenHinweis(lage("mail"))), "Mail unverändert (Aufgabe)");

  console.log("── 11 · Der Kanal im Agenten");
  const AGT = await import("../server/lib/fiaon-postmeister-agent");
  ok(AGT.ANLIEGEN_OHNE_WERKZEUGE.includes("kuendigung_vormerken"), "kein Kündigungs-Werkzeug im Anliegen");
  ok(AGT.ANLIEGEN_OHNE_WERKZEUGE.includes("rechnung_anhaengen"), "kein Anhang im Anliegen");
  ok(AGT.ANLIEGEN_OHNE_WERKZEUGE.includes("global_zugang_senden"), "kein Global-Zugang im Anliegen");
  ok(/KEINE E-MAIL/.test(AGT.ANLIEGEN_KANAL_BLOCK) && /Kundenbereich/.test(AGT.ANLIEGEN_KANAL_BLOCK), "Auftrag sagt: Antwort im Kundenbereich, keine Mail");
  ok(/keine Rechnung als PDF|kein „anbei“/.test(AGT.ANLIEGEN_KANAL_BLOCK), "Auftrag sagt: kein Anhang");
  const agentQuelle = lies("server/lib/fiaon-postmeister-agent.ts");
  ok(/const dienst = anliegen \? ANLIEGEN_DIENST : "postmeister-antwort";/.test(agentQuelle), "eigener KI-Dienst nur im Anliegen, Mail bleibt postmeister-antwort");
  ok(/kostenHeute\(dienst\)/.test(agentQuelle) && /ANLIEGEN_TAG_EURO/.test(agentQuelle), "Kostendeckel je Dienst (ANLIEGEN_TAG_EURO)");
  ok(/if \(anliegen\) return \{ \.\.\.leer, grund: loesch/.test(agentQuelle), "Löschwunsch / Abstreiten im Anliegen: keine feste Mail-Antwort");
  ok(/anliegen\s*\n?\s*\? werkzeuge\.find\(\(x\) => x\.name === String\(ruf\.function\?\.name/.test(agentQuelle), "erfundener Werkzeug-Aufruf läuft im Anliegen nie");
  ok(/k\.kanal !== "anliegen" && schrittFinal\?\.art === "auskunft"/.test(agentQuelle), "keine angehängte Rechnung im Anliegen");
  ok(/dienst: k\.dienst \?\? "postmeister-antwort"/.test(agentQuelle), "Umformulierung im selben Dienst");
  const kc = await import("../server/lib/fiaon-ki-claude");
  ok(kc.KUNDEN_DIENSTE.has(R.ANLIEGEN_DIENST), "mara-anliegen ist ein Kunden-Dienst (großes Modell / A/B wie die Mail)");
  const bil = await import("../server/lib/fiaon-mara-bilanz");
  ok((bil.MARA_DIENSTE as readonly string[]).includes(R.ANLIEGEN_DIENST), "mara-anliegen zählt in Maras Bilanz");

  console.log("── 12 · Verdrahtung");
  const routes = lies("server/routes.ts");
  ok(/tageslauf\('mara_anliegen'/.test(routes) && /nurMitErgebnis: true/.test(routes.slice(routes.indexOf("tageslauf('mara_anliegen'"))), "Takt mara_anliegen (5 Min., Historie nur mit Ergebnis)");
  const tickets = lies("server/routes/fiaon-tickets.ts");
  ok(/anliegenAntwortSpeichern\(/.test(tickets), "Menschen-Antwort über dieselbe Stelle wie Mara (Anliegen, Akte, Benachrichtigung)");
  ok(/antwort_knopf/.test(tickets), "Kunde bekommt den Knopf mit");
  const iPruef = tickets.indexOf("anliegenHandPruefen(id, antwort)"), iSpeichern = tickets.indexOf("anliegenAntwortSpeichern({");
  ok(iPruef > 0 && iSpeichern > iPruef && /if \(!pruefung\.ok\) return res\.status\(400\)/.test(tickets), "ROT: Menschen-Antwort wird VOR dem Speichern geprüft (400 mit Hinweis)");
  ok(/mara_stand, t\.mara_grund, t\.mara_heikel, t\.mara_entwurf/.test(tickets), "Mitarbeiter sehen Maras Stand und Vorschlag");
  const lib = lies("server/lib/fiaon-mara-anliegen.ts");
  ok(/pushBeiEreignis\(Number\(t\.person_id\), "antwort_anliegen"/.test(lib), "Benachrichtigung „Antwort auf Ihr Anliegen“ wird gesendet");
  ok(/WHERE id = \$\{ein\.id\} AND status = 'offen' AND antwort IS NULL/.test(lib), "Mara speichert nur, solange niemand geantwortet hat");
  ok(/NOT \$\{globalKundeSql\(/.test(lib) && /p\.ist_test_am IS NULL/.test(lib), "Takt holt Global-Kunden und Testpersonen gar nicht erst");
  ok(/kuendigungSendeUrteil\(/.test(lib) && /menschNoetig\(/.test(lib), "E-393-Sperre und menschNoetig wie im Postfach");
  ok(/anliegenBuendelTeilen\(/.test(lib) && /!imVerlauf\.has\(bid\)/.test(lib), "Bündel ohne zu alte Anliegen; „mit beantwortet“ nur, was Mara im Verlauf sah");
  ok(/ORDER BY \(t\.id = ANY\(\$\{ids\}::int\[\]\)\) DESC, t\.created_at DESC/.test(lib), "Verlauf: Bündel immer, dann die jüngsten (nicht die 20 ältesten)");
  ok(/anliegenVerweisKern\(\{ sprache,/.test(lib) && !/sprache: "de", agentName: name/.test(lib), "Verweis in der Sprache der Antwort (nicht fest Deutsch)");
  ok(/mara_werkzeuge = \$\{lauf\.json\(handlungKurz/.test(lib), "Vorschlag merkt sich die Werkzeuge seines Laufs");
  ok(!/JSON\.stringify\([^)]*\)\}::jsonb/.test(lib), "JSON-Spalten mit lauf.json (kein Text in jsonb — sonst fehlt der Knopf im Kundenbereich)");
  const pult = lies("server/routes/fiaon-mara-steuerpult.ts");
  ok(/router\.get\("\/chef\/mara\/anliegen"/.test(pult) && /router\.post\("\/chef\/mara\/anliegen"/.test(pult), "Schalter im Steuerpult (GET/POST /chef/mara/anliegen)");
  const chefMara = lies("client/src/components/admin/ChefMara.tsx");
  ok(/MaraAnliegenSchalter/.test(chefMara), "Schalter im Reiter Mail des Mara-Steuerpults (keine neue Seite)");
  const hilfe = lies("client/src/pages/app/Hilfe.tsx");
  ok(/antwort_knopf/.test(hilfe), "Kundenbereich zeigt den Knopf unter der Antwort");
  // /agent/anliegen zeigt die Seite tickets.tsx (App.tsx; anliegen.tsx ist die alte Fassung unter /agent/anliegen-alt).
  const seite = lies("client/src/pages/agent/tickets.tsx");
  ok(/path="\/agent\/anliegen" component=\{AgentTicketsPage\}/.test(lies("client/src/App.tsx")), "/agent/anliegen ist tickets.tsx");
  ok(/mara_entwurf/.test(seite) && /Vorschlag übernehmen/.test(seite), "/agent/anliegen: Maras Vorschlag übernehmen");
  ok(/maraStandSatz/.test(seite), "/agent/anliegen: Maras Hinweis (heikel, zu alt …)");
  ok(/a\.mara_stand === "mensch" \|\| a\.mara_stand === "entwurf" \? a\.mara_grund/.test(seite), "/agent/anliegen: beim Vorschlag steht der Grund sichtbar");
  const rg = lies("client/src/pages/agent/rundgaenge.ts");
  ok(/E-406/.test(rg) && /Mara/.test(rg.slice(rg.indexOf("E-406"), rg.indexOf("E-406") + 900)), "Rundgang /agent/anliegen erklärt Mara");
  const upd = lies("client/src/pages/agent/updates-data.ts");
  const listeAb = upd.indexOf("export const AGENT_UPDATES");
  const erstesId = upd.indexOf('id: "', listeAb);
  ok(listeAb > -1 && upd.slice(erstesId, erstesId + 40).includes("2026-10-19-mara-anliegen"), "Team-Update ganz oben", upd.slice(erstesId, erstesId + 40));

  console.log(`\n${gut} gut, ${schlecht} schlecht`);
  console.log(schlecht ? `✗ ${gut}/${gut + schlecht} Prüfungen bestanden` : `✓ ${gut}/${gut} Prüfungen bestanden (offline)`);
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
