// Prüfstand E-297 (07.10.2026): Mara verkauft härter — Bank-Satz nur auf Nachfrage, kein Rückzug beim Geld,
// ein Paket tiefer statt gleich Start. Offline, ohne KI. Aufruf:
//   env -i HOME=$HOME PATH=… DATABASE_URL=<lokal> node_modules/.bin/tsx scripts/pruef-mara-e297.ts
// Der Prüfstand setzt MARA_LIMIT_NENNEN und MARA_BANK_SATZ selbst (vor dem Laden der Module — die Regeltexte
// werden beim Laden gebaut, wie auf Render beim Start).
import fs from "fs";

let gut = 0, schlecht = 0;
function ok(b: unknown, was: string) { if (b) { gut++; console.log(`  ✓ ${was}`); } else { schlecht++; console.log(`  ✗ ${was}`); } }

async function main() {
  process.env.MARA_LIMIT_NENNEN = "an";
  process.env.MARA_BANK_SATZ = "nachfrage"; // so wie auf Render: die Regeltexte entstehen beim Laden
  const ton = await import("../shared/fiaon-mara-ton");
  process.env.MARA_BANK_SATZ = ""; // der erste Block prüft den alten Weg (zur Laufzeit gelesen)

  console.log("── Ohne Schalter: E-265 bleibt (Bank-Satz Pflicht neben dem Wunschlimit)");
  ok(!ton.bankSatzNurAufNachfrage(), "MARA_BANK_SATZ leer → nicht auf Nachfrage");
  ok(ton.bankZusatz().includes(ton.BANK_SATZ), "bankZusatz() trägt den Satz über die Bank");
  ok(ton.limitOhneBank("Bei uns kommen Sie zu Ihrer Visa-Kreditkarte mit Ihrem Wunschlimit von 25.000 €.") !== null, "Wunschlimit ohne Bank-Satz fällt wie bisher (limit_ohne_bank)");
  const mitBank = "Bei uns kommen Sie zu Ihrer Visa-Kreditkarte mit Ihrem Wunschlimit von 25.000 € — über den Rahmen entscheidet unsere Partnerbank.";
  ok(ton.bankSatzNurWennGefragt(mitBank, "Wann zahle ich?") === mitBank, "ohne Schalter nimmt bankSatzNurWennGefragt nichts heraus");

  console.log("── MARA_BANK_SATZ=nachfrage");
  process.env.MARA_BANK_SATZ = "nachfrage";
  ok(ton.bankSatzNurAufNachfrage(), "Schalter greift (zur Laufzeit gelesen)");
  ok(ton.bankZusatz() === "", "bankZusatz() leer — feste Sätze ohne Bank-Satz");
  ok(ton.bankZusatzAufFrage().includes(ton.BANK_SATZ), "bankZusatzAufFrage() behält ihn für Antworten auf seine Frage");
  ok(ton.limitPruefen("Bei uns kommen Sie zu Ihrer Visa-Kreditkarte mit Ihrem Wunschlimit von 25.000 €.").length === 0, "Wunschlimit genannt, ohne Bank-Satz: kein Befund");
  ok(ton.limitPruefen("Ihre Visa-Kreditkarte mit 15.000 € als Ziel in Ihrem Paket FIAON Ultra.").length === 0, "„… € als Ziel in Ihrem Paket“ ohne Bank-Satz: kein Befund");
  // Die Zusage-Wände bleiben hart.
  ok(ton.limitZusage("Sie bekommen Ihr Wunschlimit von 25.000 €.") !== null, "„Sie bekommen Ihr Wunschlimit …“ bleibt eine Zusage");
  ok(ton.limitPruefen("Ihr Rahmen von 25.000 € ist sicher.").length > 0, "„Ihr Rahmen … ist sicher“ bleibt hart");
  ok(ton.limitZusage("Bei uns kommen Sie zu Ihrer Visa-Kreditkarte mit Ihrem Wunschlimit von 25.000 €. Das bekommen Sie bei uns sicher.") !== null, "Rückverweis „Das bekommen Sie sicher“ bleibt hart");
  ok(ton.limitPruefen("Ihr Kreditrahmen über 25.000 €.").some((f) => f.art === "freigabe"), "fremde Form (Kreditrahmen über …) bleibt hart");
  ok(ton.bankSatzErgaenzen("Ihre Karte mit Ihrem Wunschlimit von 5.000 €.") === "Ihre Karte mit Ihrem Wunschlimit von 5.000 €.", "bankSatzErgaenzen hängt nichts mehr an");

  // Herausnehmen nur, wenn er nicht gefragt hat — und nie so, dass eine Zusage entsteht.
  const raus = ton.bankSatzNurWennGefragt(mitBank, "Wann kann ich überweisen?");
  ok(!ton.BANK_SATZ_MUSTER.test(raus) && raus.includes("25.000 €") && /Kreditkarte/.test(raus), `ungefragt: Bank-Satz raus, Karte und Ziel bleiben („${raus}“)`);
  ok(ton.bankSatzNurWennGefragt(mitBank, "Bekomme ich die 25.000 sicher?") === mitBank, "fragt er nach Sicherheit/Betrag: Bank-Satz bleibt");
  ok(ton.bankSatzNurWennGefragt(mitBank, "Wer entscheidet über mein Limit?") === mitBank, "fragt er, wer entscheidet: Bank-Satz bleibt");
  const eigenerSatz = "Ihre Visa-Kreditkarte mit Ihrem Wunschlimit von 5.000 € ist unser Ziel. Über den Rahmen entscheidet unsere Partnerbank. Zahlen Sie jetzt die Aktivierung.";
  const eigenerRaus = ton.bankSatzNurWennGefragt(eigenerSatz, "ok");
  ok(!ton.BANK_SATZ_MUSTER.test(eigenerRaus) && /Zahlen Sie jetzt die Aktivierung\.$/.test(eigenerRaus) && !/\s{2,}/.test(eigenerRaus), `eigener Satz über die Bank fällt sauber heraus („${eigenerRaus}“)`);
  const kommaForm = "Es geht um Ihre Visa-Kreditkarte, und über den Rahmen entscheidet die Bank. Machen Sie heute weiter?";
  ok(!ton.BANK_SATZ_MUSTER.test(ton.bankSatzNurWennGefragt(kommaForm, "hallo")), "Komma-Form „…, und über den Rahmen entscheidet die Bank“ fällt heraus");
  const zusageMitBank = "Mit Ihrem Wunschlimit von 25.000 € — über den Rahmen entscheidet unsere Partnerbank. Das bekommen Sie sicher.";
  ok(ton.limitPruefen(ton.bankSatzNurWennGefragt(zusageMitBank, "ok")).length >= ton.limitPruefen(zusageMitBank).length, "eine Zusage wird durch das Herausnehmen nie sendbar");

  // Feste Bausteine
  const ziel = { euro: 5000, art: "wunsch" as const, paketName: "FIAON Pro" };
  const lf = ton.bausteinLimitFrage({ kanal: "whatsapp", ziel, betrag: "59,99 €", link: "https://fiaon.com/zahlung/FIAON-E297AA" });
  ok(ton.BANK_SATZ_MUSTER.test(lf) && lf.includes("5.000 €"), "Antwort auf seine Limit-Frage: Zahl UND Satz über die Bank");
  const was = ton.bausteinWasIstFiaon({ kanal: "whatsapp", stufe: "zahlung_offen", ziel });
  ok(!ton.BANK_SATZ_MUSTER.test(was) && was.includes("5.000 €"), `„Was ist FIAON?“ ohne Bank-Satz („${was.slice(0, 90)}…“)`);
  const lead = ton.bausteinWasIstFiaon({ kanal: "whatsapp", stufe: "lead", link: "https://fiaon.com/a/Ab3dEf7hJk/w" });
  ok(!ton.BANK_SATZ_MUSTER.test(lead) && /fünf Minuten/.test(lead), "„Was ist FIAON?“ (Lead) ohne Bank-Satz");
  ok(ton.KARTE_REGEL_TEXT.includes("OHNE den Satz über die Bank") && !ton.KARTE_REGEL_TEXT.includes(`und im selben Satz „${ton.BANK_SATZ}“`), "KARTE_REGEL_TEXT sagt: Bank-Satz nur auf seine Frage");

  // Ein Paket tiefer, Zögern mit Frage
  const vorabHE = ton.bausteinVorabZahlen({ paketKey: "highend", betreuer: "Herr Stripling", link: null });
  ok(vorabHE.includes("FIAON Ultra") && !vorabHE.includes("FIAON Start"), `High-End: ein Paket tiefer ist Ultra, nicht Start („${vorabHE.slice(-90)}“)`);
  const vorabPro = ton.bausteinVorabZahlen({ paketKey: "pro", betreuer: null, link: null });
  ok(vorabPro.includes("FIAON Start"), "Pro: ein Paket tiefer ist Start");
  ok(!/kleiner einsteigen/.test(ton.bausteinVorabZahlen({ paketKey: "start", betreuer: null, link: null })), "Start: kein kleineres Paket");
  const zoeg = ton.bausteinZoegern({ link: "https://fiaon.com/a/Ab3dEf7hJk/w" });
  ok(/Was hält Sie noch zurück/.test(zoeg) && !/lassen Sie sich Zeit/i.test(zoeg), "Zögern: die Frage, was ihn hält — kein „lassen Sie sich Zeit“");
  for (const [name, t] of [["Vorab High-End", vorabHE], ["Zögern", zoeg], ["Was ist FIAON", was], ["Limit-Frage", lf]] as const) {
    const hart = ton.tonPruefung(t, { kanal: "whatsapp" }).filter((f) => f.schwere === "hart");
    ok(!hart.length, `Ton-Wand ohne harten Treffer: ${name}${hart.length ? ` (${hart.map((h) => h.id).join(", ")})` : ""}`);
  }

  console.log("── Mail und Aktion (Module mit gesetztem Schalter geladen)");
  const agent = await import("../server/lib/fiaon-postmeister-agent");
  const b = agent.mailAbschlussFormel("b", ziel);
  ok(!ton.BANK_SATZ_MUSTER.test(b) && b.includes("5.000 €") && b.includes(ton.AKTIVIERUNG_AUFRUF), "Mail-Abschluss B: Karte + Ziel + Aktivierung, ohne Bank-Satz");
  ok(!ton.BANK_SATZ_MUSTER.test(agent.mailAbschlussFormel("abbrecher", ziel)), "Mail-Abschluss Abbrecher ohne Bank-Satz");
  ok(!ton.BANK_SATZ_MUSTER.test(agent.mailAbschlussFormel("c", null)), "Mail-Abschluss C ohne Bank-Satz");
  ok(agent.MAIL_KARTE_REGEL.includes("OHNE den Satz über die Bank"), "MAIL_KARTE_REGEL: Bank-Satz nur auf seine Frage");
  const quelleMail = fs.readFileSync("server/lib/fiaon-postmeister-agent.ts", "utf8");
  ok(/text = bankSatzNurWennGefragt\(text, k\.kundeText \?\? ""\)/.test(quelleMail), "Postfach: letzte Stelle nimmt den ungefragten Bank-Satz heraus");
  const quelleAktion = fs.readFileSync("server/lib/fiaon-mara-aktion.ts", "utf8");
  ok(/text = bankSatzNurWennGefragt\(text, ""\)/.test(quelleAktion), "Aktion: Bank-Satz heraus (er hat nichts gefragt)");

  console.log("── WhatsApp: Rückzug beim Geld, Hürde, Auftrag");
  const wa = await import("../server/lib/fiaon-whatsapp-mara");
  const rueckzug = wa.verkaufsPruefung("Das verstehe ich — dann warten Sie besser, bis es für Sie passt. Ihre Visa-Kreditkarte bleibt Ihr Ziel.", { kunde: "Bei mir sind es aktuell noch 5,50 auf dem Konto", letzteDu: [], verkaufen: true });
  ok(rueckzug.some((h) => /Rückzug beim Geld/.test(h)), "„dann warten Sie besser“ → Hinweis für den zweiten Entwurf");
  const nichts = wa.verkaufsPruefung("Wenn das Geld gerade nicht da ist, unterschreiben Sie bitte nichts, was sich für Sie nicht gut anfühlt.", { kunde: "Aber ich hab das Geld nicht", letzteDu: [], verkaufen: true });
  ok(nichts.some((h) => /Rückzug beim Geld/.test(h)), "„unterschreiben Sie bitte nichts“ → Hinweis");
  const gut1 = wa.verkaufsPruefung("Kein Problem — wann kommt Ihr Gehalt, am 15.? Dann halte ich den Tag für Sie fest.", { kunde: "Ich habe gerade kein Geld", letzteDu: [], verkaufen: true });
  ok(!gut1.some((h) => /Rückzug/.test(h)), "Zahltag erfragen ist kein Rückzug");
  const heikel = wa.verkaufsPruefung("Dann warten Sie besser, bis Ihre Kündigung bestätigt ist.", { kunde: "Ich will kündigen", letzteDu: [], verkaufen: true });
  ok(!heikel.some((h) => /Rückzug/.test(h)), "bei Kündigung kein Verkaufs-Hinweis");
  const ungefragt = wa.verkaufsPruefung("Bei uns kommen Sie zu Ihrer Visa-Kreditkarte mit Ihrem Wunschlimit von 5.000 € — über den Rahmen entscheidet unsere Partnerbank.", { kunde: "Wie geht es weiter?", letzteDu: [], verkaufen: true });
  ok(ungefragt.some((h) => /die Bank entscheidet/.test(h)), "ungefragter Bank-Satz neben dem Wunschlimit → „lass es weg“");
  const gefragt = wa.verkaufsPruefung("Für Ihre Visa-Kreditkarte ist Ihr Wunschlimit von 5.000 € unser Ziel — über den Rahmen entscheidet unsere Partnerbank.", { kunde: "Wie hoch ist mein Limit?", letzteDu: [], verkaufen: true });
  ok(!gefragt.some((h) => /die Bank entscheidet/.test(h)), "auf seine Limit-Frage ist der Bank-Satz richtig");
  const rep = wa.reparieren("Ihre Visa-Kreditkarte mit Ihrem Wunschlimit von 5.000 € — über den Rahmen entscheidet unsere Partnerbank. Hier: https://fiaon.com/zahlung/FIAON-E297AA", { kunde: "ok, wie zahle ich?" });
  ok(!ton.BANK_SATZ_MUSTER.test(rep) && rep.includes("https://fiaon.com/zahlung/FIAON-E297AA"), `reparieren nimmt ihn ungefragt heraus, Link bleibt („${rep}“)`);
  ok(ton.BANK_SATZ_MUSTER.test(wa.reparieren("Ihr Wunschlimit von 5.000 € ist unser Ziel — über den Rahmen entscheidet unsere Partnerbank.", { kunde: "Bekomme ich das Limit sicher?" })), "reparieren lässt ihn auf seine Frage stehen");
  const quelleWa = fs.readFileSync("server/lib/fiaon-whatsapp-mara.ts", "utf8");
  ok(/GERADE KEIN GELD/.test(quelleWa) && /nie vom großen Paket direkt auf FIAON Start/.test(quelleWa), "Auftrag Regel 7: kein Geld → Zahltag festhalten; zu teuer → ein Paket tiefer");
  ok((quelleWa.match(/reparieren\(.*\{ (?:limit: true, )?kunde: pruef\.kunde \?\? "" \}\)/g) ?? []).length === 3, "alle drei Entwürfe laufen mit seiner Nachricht durch reparieren");

  console.log(`\n${schlecht ? "ROT" : "GRÜN"}: ${gut} bestanden, ${schlecht} fehlgeschlagen`);
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
