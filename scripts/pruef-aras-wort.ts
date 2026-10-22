// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND (offline): ARAS hält ihr Wort — die reinen Erkenner aus shared/fiaon-aras-wort.ts (E-408 Scheibe 3,
// Auswertung der echten Gespräche 21./22.10.2026): Identität vor dem Anliegen, Zahltag-Sätze, Streitfall, Ansage statt
// Mensch, Wort halten bis zum Schluss. Die Sätze sind den echten Gesprächen nachgebaut — Namen und Nummern erfunden.
//
//   npx tsx scripts/pruef-aras-wort.ts
// ═══════════════════════════════════════════════════════════════════════════
import * as W from "../shared/fiaon-aras-wort";

let gut = 0, schlecht = 0;
const log = (s = "") => console.log(s);
function ok(text: string, bedingung: boolean, fund = ""): void {
  if (bedingung) { gut++; log(`  ok    ${text}`); } else { schlecht++; log(`  ROT   ${text}${fund ? `  →  ${fund}` : ""}`); }
}
function titel(t: string): void { log(`\n${"─".repeat(74)}\n${t}\n${"─".repeat(74)}`); }
/** Erwartung je Satz: alle Treffer in einer Zeile, die Abweichungen als Fund. */
function alle<T>(text: string, faelle: [string, T][], f: (s: string) => T): void {
  const falsch = faelle.filter(([s, soll]) => f(s) !== soll).map(([s, soll]) => `„${s}“ → ${String(f(s))} (soll ${String(soll)})`);
  ok(text, falsch.length === 0, falsch.join(" | "));
}

// Donnerstag, 22.10.2026 (Berlin)
const H = "2026-10-22";

titel("2. ZAHLTAG-SÄTZE (Echtgespräch 22.10.: „es geht immer am Ersten bei mir“ — „dann notier ich mir den Ersten“, eingetragen: nichts)");
alle("Wie bisher: „Ja, heute noch.“ → heute, „Morgen“ → morgen; „Heute noch nicht.“ und „Weiß ich noch nicht“ → null", [
  ["Ja, heute noch.", H], ["Morgen", "2026-10-23"], ["Heute noch nicht.", null], ["Weiß ich noch nicht", null], ["heut no", H],
], (s) => W.zahltagAusKunde(s, H));
alle("Monatserste: „am Ersten“ (auch im langen Satz), „Anfang nächsten Monat(s)“, „zum Monatswechsel“ → 01.11.", [
  ["es geht immer am Ersten bei mir", "2026-11-01"],
  ["Ich habe Ihnen gesagt, es geht immer am Ersten bei mir, weil ich nicht ... Darum habe ich das jetzt so früher bekommen", "2026-11-01"],
  ["Anfang nächsten Monat", "2026-11-01"], ["Anfang des nächsten Monats", "2026-11-01"], ["Anfang des Monats", "2026-11-01"], ["zum Monatswechsel", "2026-11-01"],
  ["am Ersten, früher geht's nicht", "2026-11-01"], ["Anfang November", "2026-11-01"],
], (s) => W.zahltagAusKunde(s, H));
alle("Heute ist der Erste: „am Ersten“ → heute; „Anfang nächsten Monats“ → der nächste Erste", [
  ["am Ersten", "2026-11-01"], ["Anfang nächsten Monats", "2026-12-01"], ["Anfang des Monats", "2026-11-01"],
], (s) => W.zahltagAusKunde(s, "2026-11-01"));
alle("Tageszahl: „am Fünfzehnten“, „am 15.“, „zum 15ten“, „bis zum 15.“ → der nächste 15.; mit Monat: „am 3. Dezember“, „den dritten Dezember“", [
  ["am Fünfzehnten", "2026-11-15"], ["am 15.", "2026-11-15"], ["zum 15ten", "2026-11-15"], ["bis zum 15. um 10 Uhr", "2026-11-15"],
  ["am 3. Dezember", "2026-12-03"], ["den dritten Dezember", "2026-12-03"], ["am Zweiundzwanzigsten", H],
], (s) => W.zahltagAusKunde(s, H));
alle("Daten: „am 30.10.“, „am 30.10“, „30.10.2026“; über den Jahreswechsel „am 3.1.“ (am 20.12.)", [
  ["am 30.10.", "2026-10-30"], ["am 30.10", "2026-10-30"], ["Ich überweise am 30.10.2026", "2026-10-30"],
], (s) => W.zahltagAusKunde(s, H));
ok("… „am 3.1.“ am 20.12.2026 → 03.01.2027", W.zahltagAusKunde("am 3.1.", "2026-12-20") === "2027-01-03");
alle("Wochentage (heute Donnerstag): „Freitag“ → morgen; „nächsten Dienstag“ / „Dienstag nächste Woche“ / „Nee, erst nächsten Dienstag“ → Dienstag der nächsten Kalenderwoche; „übernächsten Montag“", [
  ["Freitag", "2026-10-23"], ["am Freitag", "2026-10-23"], ["Donnerstag", "2026-10-29"], ["nächsten Dienstag", "2026-10-27"], ["Dienstag nächste Woche", "2026-10-27"],
  ["Nee, erst nächsten Dienstag", "2026-10-27"], ["nächste Woche Mittwoch", "2026-10-28"], ["übernächsten Montag", "2026-11-02"],
], (s) => W.zahltagAusKunde(s, H));
alle("„nächsten Dienstag“ am Montag 19.10. → 27.10. (nicht morgen — dann sagt man „morgen“); am Sonntag 25.10. → 27.10.", [
  ["2026-10-19", "2026-10-27"], ["2026-10-25", "2026-10-27"],
], (h) => W.zahltagAusKunde("nächsten Dienstag", h));
alle("Übermorgen, Monatsende, „in drei Tagen“, „in zwei Wochen“, Verneinung mit Ersatz („Heute nicht, aber morgen“)", [
  ["übermorgen", "2026-10-24"], ["Ende des Monats", "2026-10-31"], ["Monatsende", "2026-10-31"], ["am Letzten", "2026-10-31"], ["Ende nächsten Monats", "2026-11-30"],
  ["in drei Tagen", "2026-10-25"], ["in zwei Wochen", "2026-11-05"], ["Heute nicht, aber morgen", "2026-10-23"], ["Nicht heute, sondern Freitag", "2026-10-23"], ["Ich zahl's gleich", H],
], (s) => W.zahltagAusKunde(s, H));
alle("Rot-Probe: Vergangenheit, > 45 Tage, zwei Tage, Unklares, kein Zahltag → null (dann fragt ARAS nach)", [
  ["am 20.10.", null], ["am 3.1.", null], ["Ende Dezember", null], ["Freitag oder Montag", null], ["heute oder morgen", null], ["Mitte nächster Woche", null],
  ["wenn das Gehalt kommt", null], ["nächste Woche", null], ["vielleicht Freitag", null], ["gleich", null], ["Guten Morgen", null], ["zum ersten Mal", null],
  ["die erste Rate", null], ["Heute bin ich unterwegs", null], ["Ich hab am Ersten schon überwiesen", null], ["um 15 Uhr", null], ["am 15 Euro", null], ["letzten Freitag", null],
  ["Nein", null], ["Vor dem Ersten geht's nicht", null],
], (s) => W.zahltagAusKunde(s, H));
alle("ARAS fragt nach dem ZAHLTAG — nie nach der Zeit für einen Rückruf", [
  ["Geht sich des heute noch aus?", true], ["Wann schaffen Sie die Überweisung — heute noch?", true], ["I wollt nur kurz fragen, wann’s bei Ihnen passt, dann ist alles wieder im grünen Bereich.", true],
  ["Bis wann geht sich des aus?", true], ["Wann passt es Ihnen für einen Rückruf?", false], ["Wann kann ich Sie wieder anrufen?", false], ["Haben Sie sonst noch eine Frage?", false],
], (s) => W.arasFragtNachZahltag(s));
alle("ARAS sagt „notiert“ — auch „des merk i mir“, „hab i notiert“, „hab mir … vermerkt“; nie eine Notiz fürs Team, nie ein Rückruf-Termin", [
  ["Super, dann notier i mir heute.", true], ["Alles klar, das hab ich notiert.", true], ["Okay, Verstehe, am Ersten geht's am besten, des merk i mir.", true],
  ["Ihre Überweisung für heute hab i notiert", true], ["I hab mir Ihre Zusage für heute schon vermerkt", true], ["Dann notiere ich mir den Dienstag.", true],
  ["I habs fürs Team notiert.", false], ["i hab Ihre Frage zur automatischen Übertragung notiert, damit Ihnen das Team …", false], ["Dann trag ich Sie für morgen um zehn ein.", false],
  ["Haben Sie sich das notiert?", false], ["Das ist noch nicht notiert.", false],
], (s) => W.arasBehauptetNotiert(s));

titel("5. WORT HALTEN BIS ZUM SCHLUSS (angekündigt, nichts geschickt — die echten Sätze, mit „glei“, „rüber“, „aufs Handy“, „zu“)");
alle("Zusagen (Zukunft) — je TEILSATZ, beide Wortstellungen", [
  ["I schick Ihnen glei die Rechnung zu, seins so gut und zahlens ma die ein", true],
  ["Der Link kommt gleich per WhatsApp an", true],
  ["i schick Ihnen die Rechnung schnell per WhatsApp rüber", true],
  ["Dann schick i Ihnen den Link gleich rüber, damit Sie es in Ruhe erledigen können, (lacht) wos, manchmal vergisst man sowas ja einfach.", true],
  ["I schick's Ihnen glei aufs Handy.", true], ["I schick Ihnen des glei rüber.", true], ["Den Link schick i Ihnen glei zu.", true],
  ["schick i Ihnen gleich per WhatsApp an die Nummer mit der Neun-Neun am Ende.", true],
  ["Na klar, den Link, den i grad erwähnt hab, den schick i Ihnen aufs Handy, dann könnens des in Ruhe anschauen.", true],
  ["Die Karte, äh, der Link, mein ich, den bekommt er gleich, damit er alles in Ruhe sehen kann.", true],
  ["Ich schicke Ihnen jetzt einen Link, mit dem Sie das bequem erledigen.", true], ["Sie kriegen glei die Rechnung aufs Handy.", true],
], (s) => W.arasKuendigtZusendungAn(s));
alle("Koordination 22.10.: eine ANDERE Frage danach macht aus der Zusage kein Angebot — eine Zustimmungs-Frage im selben Satz schon", [
  ["Der Link kommt gleich per WhatsApp an — habens sonst noch a Frage?", true],
  ["I schick Ihnen glei an Link, damit Sie's bequem erledigen können — geht sich des heute noch aus?", true],
  ["I schick Ihnen glei den Link — passt des?", false],
  ["Ich schick Ihnen den Link gleich aufs Handy, mit allen Infos, auch zum Widerruf — passt das?", false],
  ["I schick Ihnen die Rechnung gleich aufs Handy — über WhatsApp, passt?", false],
  ["Soll ich Ihnen die Rechnung schicken?", false], ["Wenn Sie möchten, schick ich Ihnen den Link.", false], ["Ich kann Ihnen den Link schicken.", false],
], (s) => W.arasKuendigtZusendungAn(s));
alle("… und das sind Angebote (dann zählt erst sein Ja)", [
  ["I schick Ihnen glei den Link — passt des?", true], ["Ich schick Ihnen den Link gleich aufs Handy, mit allen Infos, auch zum Widerruf — passt das?", true],
  ["I schick Ihnen die Rechnung gleich aufs Handy — über WhatsApp, passt?", true], ["Soll ich Ihnen die Rechnung schicken?", true],
  ["Wenn Sie möchten, schick ich Ihnen den Link.", true], ["Der Link kommt gleich per WhatsApp an — habens sonst noch a Frage?", false],
], (s) => W.arasBietetZusendungAn(s));
ok("Angebot über zwei Zeilen (Echtgespräch 22.10.): „Passt es, wenn i's Ihnen jetzt schick?“ / „Ist das so recht für Sie?“ nach der Ankündigung — ohne die Zeile davor kein Angebot",
  W.arasBietetZusendungAn("Passt es, wenn i's Ihnen jetzt schick?", "Dann schick i Ihnen den Link gleich rüber.") && W.arasBietetZusendungAn("Ist das so recht für Sie?", "Ich schick Ihnen gleich den Link, ganz bequem per WhatsApp.")
  && !W.arasBietetZusendungAn("Ist das so recht für Sie?", "Darf ich unser Gespräch kurz aufzeichnen?") && !W.arasBietetZusendungAn("Passt es, wenn i's Ihnen jetzt schick?"));
alle("Rot-Probe: kein Zahlungslink — der Link zum Hochladen (Unterlagen), „I schick Ihnen nix“, das Perfekt", [
  ["Ich schick Ihnen den Link zum Hochladen per Mail.", false], ["I schick Ihnen nix.", false], ["Den Link hab i Ihnen geschickt.", false], ["Ich schick Ihnen nichts mehr.", false],
], (s) => W.arasKuendigtZusendungAn(s));
alle("Behauptet erledigt — auch „den Link … hab i Ihnen grad per WhatsApp geschickt“, „is gleich auf WhatsApp bei Ihnen“", [
  ["Der Link ist raus.", true], ["Der Link ist gleich per WhatsApp bei Ihnen.", true], ["Der Link is gleich auf WhatsApp bei Ihnen.", true], ["Hab Ihnen die Rechnung grad geschickt.", true],
  ["Und den Link zur Zahlung hab i Ihnen grad per WhatsApp geschickt, ganz fix.", true], ["Die Mail mit dem Link ist jetzt raus.", true],
  ["I schick Ihnen glei die Rechnung zu.", false], ["Der Link ist noch nicht raus.", false], ["Haben Sie den Link bekommen?", false],
], (s) => W.arasBehauptetZusendung(s));
alle("Sein Weg: „Ja, per E-Mail, bitte“ → mail; „bei WhatsApp“ / „aufs Handy“ → whatsapp; verneint zählt nicht", [
  ["Ja, per E-Mail, bitte", "mail"], ["Ja, schicken Sie das bei WhatsApp", "whatsapp"], ["Ja, aufs Handy bitte", "whatsapp"], ["nicht per WhatsApp, lieber per Mail", "mail"],
  ["Ich hab kein WhatsApp", null], ["Ja, das passt", null],
], (s) => W.kundeWunschWeg(s));
ok("Er will den Link: „Ja, per E-Mail, bitte“, „Ja, schicken Sie das bei WhatsApp“ — „Nein, bitte nichts schicken“ nie", W.kundeWillZusendung("Ja, per E-Mail, bitte") && W.kundeWillZusendung("Ja, schicken Sie das bei WhatsApp") && !W.kundeWillZusendung("Nein, bitte nichts schicken."));
ok("Teilsätze: an „.“, „?“, „…“ und Gedankenstrichen — nie im Wort („E-Mail“, „Neun-Neun“)",
  JSON.stringify(W.teilsaetze("Der Link kommt gleich per E-Mail an — habens sonst noch a Frage?")) === JSON.stringify([{ text: "Der Link kommt gleich per E-Mail an", frage: false }, { text: "habens sonst noch a Frage?", frage: true }])
  && W.teilsaetze("Dann schick i Ihnen den Link gleich rüber … Passt es, wenn i's Ihnen jetzt schick?").length === 2);

titel("1. IDENTITÄT VOR DEM ANLIEGEN (Auswertung: „Grüß Sie, Herr X! … habens an Moment?“ — „Ja“ — „Ihre Rate über 99 Euro 99“)");
alle("ARAS fragt nach der Person (auch Wienerisch und „Mit wem habe ich das Vergnügen?“) — „Habens an Moment?“ ist keine Frage nach der Person", [
  ["Spreche ich mit Herrn Huber selbst?", true], ["Spreche ich mit Herrn Huber persönlich?", true], ["Mit wem spreche ich, bitte?", true], ["Mit wem habe ich das Vergnügen, bitte?", true], ["Sprech i mit'm Herrn Huber?", true],
  ["Bin ich da richtig bei Frau Musterfrau?", true], ["Sind Sie Herr Huber?", true], ["Habens an Moment?", false], ["Haben Sie einen kurzen Moment?", false],
  // Abstimmung 22.10. (Prüf-Regel): der Gruß mit Namen ist KEINE Frage nach der Person
  ["Grüß Sie, Herr Hollerbach! ARAS spricht hier, die digitale Mitarbeiterin von FIAON aus dem Kundenteam. Kurz vorweg: I bin a KI, aber a nette. Habens an Moment?", false],
], (s) => W.arasFragtIdentitaet(s));
const huber = { anrede: "Herr" as const, nachname: "Hollerbach", vorname: "Markus" };
alle("Seine Antwort — dieselbe Bestätigung wie die Prüf-Regel: Ja („ja“, „am Apparat“, „bin ich“, „genau“, „selber“, „I bins“) · sein Name (Nach- oder Vorname, unscharf, zerrissen: „Holler“) · Nein (die Frau, „ich hol ihn“) · keine Antwort („Worum geht's?“, „Freilich“, „Mhm“)", [
  ["Ja", "ja"], ["Ja?", "ja"], ["Ja, am Apparat.", "ja"], ["Hallo, ja, am Apparat", "ja"], ["I bins", "ja"], ["Höchstpersönlich", "ja"], ["Bin ich.", "ja"], ["Genau.", "ja"], ["Ja, selber.", "ja"], ["Selber am Apparat.", "ja"],
  ["Markus", "name"], ["Na, freilich", null], ["Mhm", null], ["Freilich!", null], ["Passt, worum geht's?", null], ["I bin grad im Auto.", null],
  ["Hollerbach", "name"], ["- Holler", "name"], ["Ja, genau, Hollerbach.", "name"], ["Markus Hollerbach", "name"], ["Hollerbak, ja?", "name"],
  ["Nein, hier ist seine Frau.", "nein"], ["Hier ist Frau Hollerbach.", "nein"], ["Hier ist Anna Hollerbach", "nein"], ["Moment, ich hol ihn.", "nein"], ["Er ist grad nicht da.", "nein"], ["Na", "nein"],
  ["Worum geht's?", null], ["Wer ist da?", null], ["Hallo?", null], ["Wer will das wissen?", null],
], (s) => W.identitaetAntwort(s, huber));
alle("Name unscharf: gleicher Klang (Kölner Phonetik), Doppelname — nie „Hallo“, „über“, „mehr“", [
  ["Ja, Mayer", true], ["Meyer hier", true], ["Schmitt", true], ["Ja, Lüdenscheidt", true], ["Hallo?", false], ["über WhatsApp", false], ["mehr nicht", false],
], (s) => W.nameGenannt(s, s.includes("Mayer") || s.includes("Meyer") ? "Meier" : s.includes("Schmitt") ? "Schmidt" : s.includes("Lüdenscheidt") ? "Müller-Lüdenscheidt" : /über|mehr/.test(s) ? (s.includes("über") ? "Huber" : "Meier") : "Hallorann"));
ok("Kölner Phonetik wie im Lehrbuch: Meier = Mayer = 67, Schmidt = Schmitt = 862, Wikipedia = 3412", W.koelnerPhonetik("Meier") === "67" && W.koelnerPhonetik("Mayer") === "67" && W.koelnerPhonetik("Schmidt") === "862" && W.koelnerPhonetik("Schmitt") === "862" && W.koelnerPhonetik("Wikipedia") === "3412");
alle("Das Anliegen in ARAS' Satz (vor der Bestätigung zu früh; auch mit Umlaut vorn: „Überweisung“, „überfällig“) — Gruß, KI-Hinweis, Frage nach der Person, Aufnahme-Frage, ein Name wie „Ratenberger“ und „14.30 Uhr“ sind es nicht", [
  ["I ruf an wegen Ihrer offenen Rate über neunundneunzig Euro neunundneunzig.", true], ["I ruf wegen Ihrem Kreditkartenpaket an", true], ["Es geht um Ihren Antrag.", true],
  ["Wann schaffen Sie die Überweisung — heute noch?", true], ["Des is scho überfällig.", true], ["Ihre Anträge liegen vor.", true], ["Ihr Monatsentgelt ist noch offen.", true],
  ["Grüß Sie, Herr Ratenberger!", false], ["I ruf um 14.30 Uhr wieder an.", false],
  ["Es sind neunundneunzig Euro.", true], ["Mit der Aktivierung, also Ihrer ersten Monatsrate …", true], ["Nach Ihrer Zahlung schalten wir umgehend Ihren Account frei.", true],
  ["Grüß Sie, Herr Huber! ARAS spricht hier, die digitale Mitarbeiterin von FIAON aus dem Kundenteam.", false], ["Kurz vorweg: I bin a KI, aber a nette.", false],
  ["Spreche ich mit Herrn Huber selbst?", false], ["Darf ich unser Gespräch kurz aufzeichnen, damit alles sauber dokumentiert ist?", false], ["Im Auftrag von Herrn Prüfer.", false],
], (s) => W.arasNenntAnliegen(s) !== null);

titel("3. STREITFALL (Echtgespräch 21.10.: „Betrugsanzeige erstattet“ — ARAS kündigte trotzdem die Rechnung an)");
alle("Betrug, (Straf-)Anzeige, Polizei, Anwalt, Verbraucherzentrale, Abzocke, „nie etwas unterschrieben/bestellt“", [
  ["Ich hab eine Betrugsanzeige erstattet.", "anzeige"], ["Ich hab Strafanzeige gestellt.", "anzeige"], ["Ich hab Sie angezeigt.", "anzeige"], ["Ich werde Sie anzeigen.", "anzeige"],
  ["Das ist Betrug!", "betrug"], ["Ihr seid Betrüger.", "betrug"], ["Ich geh zur Polizei.", "polizei"], ["Das geht an meinen Anwalt.", "anwalt"], ["Ich verklage Sie.", "anwalt"],
  ["Ich hab mich bei der Verbraucherzentrale beschwert.", "verbraucherzentrale"], ["Die Arbeiterkammer weiß Bescheid.", "verbraucherzentrale"], ["Abzocke ist das!", "abzocke"],
  ["Ich hab nie etwas unterschrieben.", "nie_unterschrieben"], ["Ich hab das nie bestellt.", "nie_unterschrieben"], ["Ich hab mit Ihnen nichts zu tun.", "nie_unterschrieben"],
  ["Ich hab das nicht bestellt.", "nie_unterschrieben"], ["Ich hab nichts unterschrieben!", "nie_unterschrieben"],
], (s) => W.streitFall(s)?.art ?? null);
alle("Rot-Probe: kein Streitfall — „Anzeige auf Instagram“, „ich bin doch kein Betrüger“, „noch nicht abgeschlossen“, „Hab ich das nicht schon unterschrieben?“, „nie eine Karte bekommen“, „zeigt nichts an“", [
  ["Ich hab Sie über eine Anzeige auf Instagram gefunden.", null], ["Ich bin doch kein Betrüger, ich zahl schon.", null], ["Ich hab den Antrag noch nicht abgeschlossen.", null],
  ["Hab ich das nicht schon unterschrieben?", null], ["Moment, hab ich den Vertrag nicht unterschrieben?", null], ["Den hab ich doch bereits unterschrieben, nicht?", null],
  ["Ich hab nie eine Karte bekommen.", null], ["Die App zeigt mir nichts an.", null], ["Ich zahl morgen.", null],
], (s) => W.streitFall(s)?.art ?? null);
ok("Der Kern für Justins Aufgabe: seine Worte + was es ist, ≤ 400 Zeichen, ARAS ist aus", /^Streitfall am Telefon \(Anzeige erstattet\/angedroht\): „Ich hab eine Betrugsanzeige erstattet\.“ — ARAS hat nichts mehr gefordert und ist für diese Person aus/.test(W.streitAufgabeText("Ich hab eine Betrugsanzeige erstattet.", "anzeige")) && W.streitAufgabeText("x".repeat(900), "betrug").length <= 400);

titel("4. ANSAGE STATT MENSCH (38–95 s gegen „… nach dem Ton“, Anruf-Assistenten, vorgelesene Nummern — gezählt als „erreicht“)");
alle("Ansagen (Mailbox, Mobilbox, „nach dem Ton“, „nicht erreichbar“, Anruf-Assistent, vorgelesene Rufnummer, Englisch)", [
  ["Hallo, dies ist die Mailbox von 0170. Bitte hinterlassen Sie eine Nachricht nach dem Signalton.", true], ["Bitte sprechen Sie nach dem Ton.", true],
  ["Der Teilnehmer ist zurzeit nicht erreichbar.", true], ["Sie sind verbunden mit der Mobilbox von", true], ["Hinterlassen Sie Ihren Namen und Ihre Telefonnummer.", true],
  ["Hallo, die Person, die Sie anrufen, nutzt einen Filterdienst und erhält eine Kopie dieser Unterhaltung. Nennen Sie bitte Ihren Namen und den Grund Ihres Anrufs.", true],
  ["Wenn Sie Ihren Namen und den Grund für Ihren Anruf nennen, sehe ich nach, ob die Person verfügbar ist.", true], ["Null eins sieben null eins zwei drei vier fünf sechs", true],
  ["Willkommen bei der Combox von", true], ["Ich bin gerade nicht erreichbar, sprich mir einfach drauf.", true], ["The person you are calling is not available.", true],
], (s) => W.istAnsage(s));
alle("Rot-Probe: ein Mensch — „Hallo, ja?“, „Ja, am Apparat.“, „Ich hab Ihre Nachricht auf meiner Mailbox gehört.“, „Wer ist da?“", [
  ["Hallo, ja?", false], ["Ja, am Apparat.", false], ["Ich hab Ihre Nachricht auf meiner Mailbox gehört.", false], ["Wer ist da?", false], ["Hollerbach?", false], ["Ich zahl am Ersten.", false],
], (s) => W.istAnsage(s));

log(`\n${schlecht === 0 ? "GRÜN" : "ROT"}: ${gut} ok, ${schlecht} rot\n`);
process.exit(schlecht === 0 ? 0 : 1);
