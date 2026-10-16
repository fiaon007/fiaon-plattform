// Prüfstand E-393 (16.10.2026): Die Kündigung hängt nie an einer Zahlung, und in einer Antwort zu Kündigung oder
// Widerruf droht der Postmeister nie (Gericht, Inkasso, Anwalt, SCHUFA). Offline, ohne KI, ohne Datenbank — reine
// Funktionen aus shared/fiaon-wortverbote.ts, die Satzbausteine der Werkzeuge, das Hauswissen und ein Quelltext-Abgleich,
// dass jeder Sendeweg des Postmeisters die Sendesperre ruft. Aufruf:
//   env -i HOME=$HOME PATH=… DATABASE_URL=postgresql://pruef@127.0.0.1:9/keine node_modules/.bin/tsx scripts/pruef-e393-kuendigungssperre.ts
//
// Die Positivfälle sind die Satzformen aus den gesendeten Antworten vom 05.–29.09.2026 (Nachprüfung 16.10., ohne
// Kundendaten: Beträge, Daten und Orte vereinheitlicht).
import fs from "fs";
import path from "path";

let gut = 0, schlecht = 0;
function ok(b: unknown, was: string) { if (b) { gut++; console.log(`  ✓ ${was}`); } else { schlecht++; console.log(`  ✗ ${was}`); } }

async function main() {
  const w = await import("../shared/fiaon-wortverbote");
  const { kopplungFinden, drohungFinden, kuendigungsWand, kuendigungsLage, kuendigungSendeUrteil, kuendigungsSaetzeErsetzen, wandPruefen, wandUrteil, KOPPLUNG_ERSATZ, WIDERRUF_ERSATZ } = w;

  console.log("── 1 · Kopplung: die Sätze aus der Produktion werden erkannt");
  const kopplungen = [
    "Ohne die offene Rate 2 über 59,99 € können wir den Vertrag nicht beenden.",
    "Ohne Rate 2 über 99,99 € können wir den Vertrag nicht beenden; das ist die offene Bedingung.",
    "Ohne diese Zahlung können wir den Vertrag nicht beenden.",
    "Ohne diese letzte Rate können wir den Vertrag nach Ihrer Kündigung vom 26.08.2026 nicht beenden.",
    "Ohne diese Rate können wir den laufenden Vertrag nicht sauber klären oder beenden.",
    "Ohne diese offene Rate können wir den Vertrag nicht sauber abschließen.",
    "Ohne die offene Rate 2 über 99,99 €, fällig am 16.09.2026, können wir den Vertrag nicht beenden.",
    "Sobald die Zahlung eingegangen ist, erhalten Sie das Kündigungsschreiben, und der Vertrag ist beendet.",
    "Sobald die Zahlung eingegangen ist, ist Ihr Vertrag beendet.",
    "Sobald die Zahlung eingeht, erhalten Sie die Bestätigung, dass der Vertrag beendet ist.",
    "Sobald diese Rate eingegangen ist, erhalten Sie die endgültige Kündigungsbestätigung.",
    "Sobald die Zahlung eingegangen ist, kann die Beendigung abgeschlossen werden.",
    "Sobald der Zahlungseingang verbucht ist, erhalten Sie die Bestätigung zur Beendigung des Vertrags.",
    "Sobald der Eingang zugeordnet und verbucht ist, kann Ihr Vertrag beendet werden.",
    "Sobald die offene Rechnung beglichen wurde kündigen wir umgehend Ihr Konto (ich kann dies nicht tun, solange es eine offene Position gibt im System).",
    "Sobald die Zahlung eingegangen ist, ist Ihre Kündigung abgeschlossen.",
    "Danach ist Ihr Vertrag beendet, sobald die offenen Raten eingegangen sind.",
    "Wenn die Zahlung auf Rate 2 gebucht ist, ist Ihr Vertrag beendet.",
    "Mit dieser Zahlung endet Ihr Vertrag.",
    "Bis dahin bleibt die Rate fällig, und mit der Zahlung endet Ihr Vertrag.",
    "Der Vertrag läuft, bis die offene Rate bezahlt ist.",
    "Der Vertrag läuft bis zur Zahlung weiter.",
    "Die Rate war am 02.09.2026 fällig, und der Vertrag läuft bis zur Zahlung weiter.",
    "Bitte begleichen Sie diese Rate jetzt über die Zahlungsseite unten; der Vertrag läuft bis dahin weiter.",
    "Bitte begleichen Sie die Rate jetzt; nach Zahlungseingang ist der Vertrag beendet.",
    "Der Vertrag wurde am 14.07.2026 geschlossen und endet erst nach Zahlung dieser letzten Rate.",
    "Der Vertrag vom 14.07.2026 endet erst nach dieser letzten Rate.",
    "Der Vertrag endet, sobald die letzte offene Rate bezahlt ist.",
    "Eine Kündigung ist erst nach Zahlung aller offenen Raten möglich.",
    "Eine Kündigung ist bei offenen Rechnungen nicht möglich.",
    "Ihre Kündigung wird erst wirksam, wenn die Rate bezahlt ist.",
    "Ohne Zahlung kein Vertragsende.",
    "We cannot cancel your contract until the outstanding payment is received.",
  ];
  for (const s of kopplungen) ok(kopplungFinden(s), `Kopplung: „${s.slice(0, 80)}“`);
  ok(kopplungFinden("Ihre Kündigung ist vermerkt. Das geht aber erst nach der Zahlung der Rate 2."), "„Das geht erst nach der Zahlung“ mit der Kündigung im Satz davor");

  console.log("── 2 · Kopplung: richtige Sätze bleiben frei");
  const frei = [
    "Ihre Kündigung gilt zum 30.10.2026, unabhängig von der Zahlung. Die Rate 2 über 59,99 € bleibt bis dahin zu zahlen.",
    "Ihre Kündigung bleibt davon unberührt; die offene Rate bleibt bis zur Buchung offen.",
    "Ihre Kündigung ist heute bei uns eingegangen und gilt zum Ende Ihres laufenden Abrechnungsmonats, dem 30.10.2026. Ihre offene Rate vom 15.10.2026 über 59,99 € zahlen Sie bitte noch, danach kommt nichts mehr.",
    "Ihr Vertrag endet am 30.10.2026; bis dahin bleibt die Rate 2 zu zahlen.",
    "Ihre Kündigung hängt nicht an einer Zahlung — sie gilt auch, solange noch eine Rate offen ist.",
    "Zu welchem Tag Ihr Vertrag endet und ob bis dahin noch eine Rate offen ist, bestätigen wir Ihnen in einer zweiten E-Mail, sobald wir die Kündigung in Ihrem Konto gebucht haben.",
    "Nach Ihrer Zahlung mit Ihrem Verwendungszweck schalten wir umgehend Ihren Account frei, damit Sie schnellstmöglich zu Ihrer eigenen Visa-Kreditkarte kommen.",
    "Ihr Vertrag ist beendet; es ist nichts mehr offen.",
    "Ein Storno ist nicht mehr möglich, weil Rate 1 bereits bezahlt wurde.",
    "Bis ein rechtzeitiger Widerruf belegt ist, bleibt Rate 2 über 99,99 € offen.",
    "Unabhängig davon bleibt Rate 2 über 59,99 € fällig am 13.09.2026.",
    "Vormerken kann ich sie noch nicht, weil Sie schreiben, dass Sie erst nach der Überweisung kündigen möchten.",
    "Die Rückzahlung kann ich so nicht bestätigen, weil hier bisher nur eine Zahlung gebucht ist.",
    "Bitte begleichen Sie sie über die Zahlungsseite, falls der Widerruf nicht bestätigt wird.",
    "Eine Kündigung nach der ersten Zahlung ist bei uns nicht gebucht, deshalb kann ich sie nicht rückwirkend bestätigen.",
    "Eine Beendigung oder Forderungsfreiheit kann ich bei der bestrittenen Forderung nicht selbst verbindlich bestätigen.",
    "Möchten Sie, dass ich Ihren Vertrag jetzt kündige? Ein kurzes Ja genügt.",
    "Your cancellation is effective regardless of payment; the instalment due before then remains payable.",
    "Settled claim three years from settlement; contract data deleted on termination; open claims have no period until settlement.",
  ];
  for (const s of frei) ok(!kopplungFinden(s), `frei: „${s.slice(0, 80)}“`);

  console.log("── 3 · Kulanz-Ausstieg (Jahresvertrag): frei — beim Widerruf nicht");
  const kulanz = "Bitte begleichen Sie Ihre offene Rate über 59,99 €, dann lasse ich Sie aus Kulanz gerne aus dem Vertrag — danach kommt nichts mehr.";
  const kulanz2 = "Die vorzeitige Beendigung aus Kulanz setzt die Zahlung der offenen Rate 2 über 59,99 € voraus — die Rate selbst bleibt ohnehin zu zahlen.";
  ok(!kopplungFinden(kulanz) && !kopplungFinden(kulanz2), "Kulanz-Sätze (so_schreiben, Härte-Stufe 2) sind keine Kopplung");
  ok(!!kopplungFinden(kulanz2, { widerruf: true }), "… beim Widerruf schon (kein Ausstieg gegen Zahlung)");
  ok(!!kopplungFinden("Ohne die Rate können wir Sie auch aus Kulanz nicht vorzeitig aus dem Vertrag entlassen."), "„… können wir nicht …“ bleibt Kopplung, auch mit „Kulanz“");

  console.log("── 4 · Drohung: erkannt");
  const drohungen = [
    "Bleibt die Zahlung aus, übergeben wir die Forderung an das für Musterstadt zuständige Amtsgericht.",
    "Bleibt die Zahlung aus, übergeben wir die Forderung an das für Musterstadt zuständige Bezirksgericht zur Eintreibung.",
    "Bleibt die Zahlung aus, bereiten wir die gerichtliche Eintreibung beim zuständigen Bezirksgericht vor.",
    "Bleibt sie unbezahlt, übergeben wir die Forderung samt Kosten an das zuständige Betreibungsamt.",
    "Die Kosten dafür tragen dann Sie.",
    "Wir übergeben die Forderung an ein Inkassobüro.",
    "Andernfalls geht die Forderung an unser Forderungsmanagement.",
    "Wir behalten uns rechtliche Schritte vor.",
    "Wir müssen sonst unseren Anwalt einschalten.",
    "Wir melden die offene Forderung an die SCHUFA.",
    "Es droht ein negativer SCHUFA-Eintrag.",
    "Herr Muster ruft Sie an, bevor etwas eskaliert.",
    "Wir beantragen einen Mahnbescheid.",
    "We will pass the claim to a debt collection agency.",
  ];
  for (const s of drohungen) ok(drohungFinden(s), `Drohung: „${s.slice(0, 80)}“`);

  console.log("── 5 · Drohung: was der Kunde tut, was verneint wird und Produktsprache bleiben frei");
  const keine = [
    "Daniel ruft Sie dazu an, weil Sie rechtliche Schritte genannt haben.",
    "Wenn Sie rechtliche Schritte einleiten möchten, steht Ihnen das frei.",
    "Ihr Anwalt kann sich gern direkt an uns wenden.",
    "Den Weg über Ihren Anwalt brauchen Sie für die Kündigung nicht zu gehen.",
    "Eine bestrittene Forderung melden wir nicht an Auskunfteien.",
    "Ich verstehe, dass Insolvenz und Pfändungen gerade sehr belastend sind.",
    "Bitte senden Sie zur Privatinsolvenz auch den Nachweis des Insolvenzgerichts.",
    "Ihre negativen Einträge sehen wir uns in Ihrer Bonitätsauswertung an.",
    "Es entstehen Ihnen keine zusätzlichen Kosten.",
    "Wir geben nichts an ein Inkassobüro.",
    "Mit dem Inkassokosten-Prüfer sehen Sie, welche Gebühren zulässig sind.",
    "Ihre SCHUFA-Auskunft liegt schon vor.",
    "Frau Muster ist über Ihre Nachricht und den Anwaltshinweis informiert.",
    "Ich habe Ihre Nachricht an die Leitung gegeben. Der Hinweis auf rechtliche Schritte ist mit dabei.",
  ];
  for (const s of keine) ok(!drohungFinden(s), `frei: „${s.slice(0, 80)}“`);

  console.log("── 6 · Lage: Kündigung/Widerruf erkannt");
  ok(kuendigungsLage({ flags: { widerruf: true } }).widerruf && kuendigungsLage({ flags: { widerruf: true } }).bezug, "Lampe widerruf → Widerruf + Bezug");
  ok(kuendigungsLage({ eingang: "Hiermit widerrufe ich meinen Vertrag vom 20.08." }).widerruf, "„widerrufe“ im Kundentext → Widerruf");
  ok(kuendigungsLage({ kundenlage: "gekuendigt" }).bezug, "Lage gekuendigt → Bezug");
  ok(kuendigungsLage({ kuendigungInAkte: true }).bezug, "Kündigung in der Akte → Bezug");
  ok(kuendigungsLage({ eingang: "Ich möchte mein Abo kündigen." }).bezug, "„kündigen“ im Kundentext → Bezug");
  ok(kuendigungsLage({ kategorien: ["kuendigung"] }).bezug, "Kategorie kuendigung → Bezug");
  ok(kuendigungsLage({ antwort: "Ihre Kündigung gilt zum 30.10.2026." }).bezug, "Antwort spricht von Kündigung → Bezug");
  ok(!kuendigungsLage({ eingang: "Wann bekomme ich meine Karte?", antwort: "Ihr Link kommt nach der Bonitätsauswertung." }).bezug, "Kartenfrage → kein Bezug");

  console.log("── 7 · Die Wand für Kündigung/Widerruf");
  const gericht = "Bleibt die Zahlung aus, übergeben wir die Forderung an das zuständige Amtsgericht.";
  ok(kuendigungsWand(gericht, { bezug: true }).length === 1, "Drohung mit Bezug → verboten");
  ok(kuendigungsWand(gericht, { bezug: false }).length === 0, "Drohung ohne Kündigung/Widerruf → nicht diese Wand (Härte-Stufe bei bloßer Zahlungsverweigerung, Justin E-135)");
  ok(kuendigungsWand(kulanz2, { bezug: true, widerruf: true }).some((t) => /Widerruf/.test(t.hinweis)), "Kulanz-Satz beim Widerruf → verboten, Hinweis nennt den Widerrufssatz");
  ok(kuendigungsWand("Ohne diese Zahlung können wir den Vertrag nicht beenden. Die Kosten dafür tragen dann Sie.", { bezug: false }).length === 2, "Kopplung macht selbst den Bezug — dann zählt auch die Drohung");

  console.log("── 8 · Die Sendesperre (automatisch wie von Hand)");
  // Der Fall Person 12314 (08.09.2026), Satzformen ohne Kundendaten.
  const fall = "Ihren Widerruf vom 27.08.2026 haben wir erhalten. Wir haben einen Vertrag, den Sie am 20.08.2026 geschlossen haben. Ohne die offene Rate 2 über 59,99 € können wir den Vertrag nicht beenden. Bleibt die Zahlung aus, übergeben wir die Forderung an das für Musterstadt zuständige Amtsgericht. Ersparen Sie uns beiden diesen Aufwand und begleichen Sie die Rate — der Weg steht unten.";
  const u = kuendigungSendeUrteil({ antwort: fall, eingang: "Ich habe den Vertrag am 27.08. widerrufen und zahle nichts.", flags: { widerruf: true }, kundenlage: "gekuendigt" });
  ok(u.gesperrt && u.treffer.length === 2 && /Kündigung an Zahlung geknüpft/.test(u.grund) && /Drohung/.test(u.grund), `Fall 12314 → gesperrt (${u.grund.slice(0, 90)}…)`);
  const richtig = "Ihre Kündigung ist heute bei uns eingegangen und gilt zum Ende Ihres laufenden Abrechnungsmonats, dem 30.10.2026 — unabhängig von der Zahlung. Ihre offene Rate vom 15.10.2026 über 59,99 € zahlen Sie bitte noch, danach kommt nichts mehr.";
  ok(!kuendigungSendeUrteil({ antwort: richtig, eingang: "Ich kündige.", flags: { kuendigung: true }, kundenlage: "gekuendigt" }).gesperrt, "richtige Kündigungsantwort → frei");
  ok(!kuendigungSendeUrteil({ antwort: `${kulanz} Die schriftliche Bestätigung bekommen Sie gleich per E-Mail.`, eingang: "Ich kündige meinen Vertrag.", flags: { kuendigung: true } }).gesperrt, "Jahresvertrag-Kulanzsatz bei Kündigung → frei");
  ok(kuendigungSendeUrteil({ antwort: kulanz, eingang: "Ich widerrufe meinen Vertrag.", flags: { widerruf: true } }).gesperrt, "Kulanzsatz beim Widerruf → gesperrt");
  ok(kuendigungSendeUrteil({ antwort: "Sobald die Zahlung eingegangen ist, ist Ihr Vertrag beendet.", eingang: "Wann kommt meine Karte?" }).gesperrt, "Kopplung auch ohne Kündigungswort im Kundentext → gesperrt");
  ok(!kuendigungSendeUrteil({ antwort: "Die Rate 3 über 79,99 € ist fällig und bleibt zu zahlen. Bleibt die Zahlung aus, übergeben wir die Forderung an das zuständige Amtsgericht.", eingang: "Zahle ich nicht." }).gesperrt, "bloße Zahlungsverweigerung ohne Kündigung → nicht gesperrt (außerhalb E-393)");
  ok(kuendigungSendeUrteil({ antwort: "Die Rate 3 über 79,99 € ist fällig und bleibt zu zahlen. Bleibt die Zahlung aus, übergeben wir die Forderung an das zuständige Amtsgericht.", eingang: "Zahle ich nicht.", kuendigungInAkte: true }).gesperrt, "… mit Kündigung in der Akte → gesperrt");

  console.log("── 9 · Ersatzsatz für den Entwurf");
  const e1 = kuendigungsSaetzeErsetzen(fall, { bezug: true, widerruf: true });
  ok(e1.entfernt.length === 2 && e1.text.includes(WIDERRUF_ERSATZ) && !kopplungFinden(e1.text, { widerruf: true }) && !drohungFinden(e1.text), "Widerruf: Kopplung und Drohung raus, Widerrufssatz rein");
  const e2 = kuendigungsSaetzeErsetzen("Ihre Kündigung ist vermerkt.\n\nOhne diese Rate können wir den Vertrag nicht beenden. Sobald die Zahlung eingegangen ist, erhalten Sie das Kündigungsschreiben.", { bezug: true });
  ok(e2.entfernt.length === 2 && e2.text.split(KOPPLUNG_ERSATZ).length === 2 && e2.text.startsWith("Ihre Kündigung ist vermerkt."), "Kündigung: zwei Kopplungen raus, der Ersatzsatz genau einmal, Absatz davor bleibt");
  const e3 = kuendigungsSaetzeErsetzen(richtig, { bezug: true });
  ok(e3.entfernt.length === 0 && e3.text === richtig, "richtiger Text bleibt unverändert");
  const e4 = kuendigungsSaetzeErsetzen("Ihre Kündigung ist vermerkt. Das geht erst nach der Zahlung der Rate 2.", { bezug: true });
  ok(e4.entfernt.length === 1 && e4.text.includes(KOPPLUNG_ERSATZ), "„Das geht erst nach der Zahlung“ (Bezug im Satz davor) wird ersetzt");

  console.log("── 10 · Die Wortwand kennt die Kopplung überall (Mail, WhatsApp, Bericht)");
  const t = wandPruefen("Ohne die offene Rate 2 können wir den Vertrag nicht beenden.");
  ok(t.length === 1 && t[0].art === "verboten" && !wandUrteil(t).sendbar, "wandPruefen: Kopplung ist verboten → nicht sendbar");
  ok(wandPruefen(richtig).length === 0, "wandPruefen: richtige Kündigungsantwort ohne Treffer");
  ok(wandPruefen(kulanz).length === 0, "wandPruefen: Kulanzsatz ohne Treffer");
  ok(wandPruefen(gericht).length === 0, "wandPruefen: die Drohung allein ist Sache der Kündigungswand (Kontext)");
  const { sendePruefung } = await import("../server/lib/fiaon-whatsapp");
  ok(sendePruefung("Sobald die Zahlung eingegangen ist, ist Ihr Vertrag beendet.").some((x) => /Verbotenes Wort/.test(x)), "WhatsApp-Sendeprüfung hält die Kopplung");

  console.log("── 11 · Satzbausteine der Werkzeuge und Hauswissen");
  const wz = await import("../server/lib/fiaon-postmeister-werkzeuge");
  const r1 = [{ nr: 2, cents: 5999, faellig: "15.10.2026" }];
  const r2 = [{ nr: 2, cents: 5999, faellig: "15.10.2026" }, { nr: 3, cents: 5999, faellig: "15.11.2026" }];
  for (const [name, satz] of [
    ["Jahresvertrag, eine Rate", wz.kuendigungSatz("letzte_rate", r1)],
    ["Jahresvertrag, zwei Raten", wz.kuendigungSatz("letzte_rate", r2)],
    ["Altvertrag, eine Rate", wz.kuendigungSatz("letzte_rate", r1, { formlos: true, endeTag: "2026-10-30" })],
    ["Altvertrag, zwei Raten", wz.kuendigungSatz("letzte_rate", r2, { formlos: true, endeTag: "2026-10-30" })],
    ["bereits gekündigt", wz.kuendigungSatz("bereits", r1)],
    ["sofort beendet (Altvertrag)", wz.kuendigungSatz("sofort_beendet", [], { formlos: true, endeTag: "2026-10-30" })],
  ] as const) ok(!kopplungFinden(satz) && !drohungFinden(satz), `kuendigungSatz ${name}: „${satz.slice(0, 90)}…“`);
  ok(/Kulanz/.test(wz.kuendigungSatz("letzte_rate", r1)) && /Rate 2 über 59,99 €/.test(wz.kuendigungSatz("letzte_rate", r1)), "Jahresvertrag: Rate bleibt genannt, Ausstieg heißt Kulanz");
  ok(!kopplungFinden(wz.kuendigungVormerken.beschreibung), "Beschreibung kuendigung_vormerken ohne Kopplung");
  const { wissenFakten } = await import("../shared/fiaon-wissen");
  const wissen = wissenFakten();
  ok(!kopplungFinden(wissen), "Hauswissen ohne Kopplung (vorher: „Sobald diese letzte Rate eingegangen ist, geht das Kündigungsschreiben raus“)");
  ok(/unabhängig von jeder Zahlung/.test(wissen) && /Kündigungsschreiben/.test(wissen), "Hauswissen: Kündigung sofort bestätigt, unabhängig von jeder Zahlung");
  ok(/nie Teil einer Antwort auf eine Kündigung oder einen Widerruf/.test(wissen), "Hauswissen: Gerichtsweg nie in einer Kündigungs-/Widerrufsantwort");

  console.log("── 12 · Quelltext: Prompt und jeder Sendeweg");
  const wurzel = process.cwd();
  const lies = (d: string) => fs.readFileSync(path.join(wurzel, d), "utf8");
  const agent = lies("server/lib/fiaon-postmeister-agent.ts");
  ok(/IN EINER ANTWORT ZU KÜNDIGUNG ODER WIDERRUF DROHST DU NIE/.test(agent), "Prompt: Drohverbot steht");
  ok(/ein\.kuendigungsBezug\s*\n?\s*\/\/[^\n]*\n[^\n]*\n\s*\? `\(3\) „Ihre Kündigung gilt trotzdem/.test(agent), "Prompt: Härte-Stufe (3) ohne Gericht, wenn Kündigung/Widerruf");
  ok(/kuendigungsBezug: kl\.bezug, widerruf: kl\.widerruf/.test(agent), "Prompt bekommt Bezug und Widerruf aus kuendigungsLage");
  ok(/kuendigungsWand\(t, kuendigungsLageFuer\(t\)\)/.test(agent) && /kuendigungsSaetzeErsetzen\(text, kl\)/.test(agent), "Agent: Prüfung und Ersatzsatz eingebaut");
  ok(!/bevor etwas eskaliert`/.test(lies("server/lib/fiaon-postmeister-werkzeuge.ts")), "eskalation_vorbereiten kündigt keine Eskalation mehr an");
  const lauf = lies("server/lib/fiaon-postmeister-lauf.ts");
  const zentrale = lies("server/routes/fiaon-postmeister-zentrale.ts");
  const alt = lies("server/routes/fiaon-postmeister.ts");
  const n = (s: string, re: RegExp) => (s.match(re) || []).length;
  ok(n(lauf, /antwortSenden\(/g) === 2 && n(lauf, /kuendigungSendeUrteil\(/g) === 2, "Lauf: beide Sendewege (automatisch, nachholen) mit Sendesperre");
  ok(/!mensch && !e393\.gesperrt;/.test(lauf), "Lauf: gesperrt → nie automatisch");
  ok(n(zentrale, /antwortSenden\(/g) === 1 && n(zentrale, /kuendigungSendeUrteil\(/g) === 1, "Zentrale (So senden, Alle senden, Entscheidungskarte, Betreuer) mit Sendesperre");
  ok(n(alt, /kuendigungSendeUrteil\(/g) === 2, "Alte Route: Automatik v1 und Einzel-/Sammelfreigabe mit Sendesperre (Abmeldung ist fester Text)");
  const abmeldung = (alt.match(/verstanden — wir haben Sie ab sofort[^`]*/) || [""])[0];
  ok(abmeldung.length > 50 && !kopplungFinden(abmeldung) && !drohungFinden(abmeldung), "fester Abmeldetext ohne Kopplung und Drohung");

  console.log(`\n${schlecht ? "✗" : "✓"} ${gut}/${gut + schlecht} Prüfungen bestanden (offline)`);
  if (schlecht) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
