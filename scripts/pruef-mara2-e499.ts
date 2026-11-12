// Prüfstand E-499 (12.11.2026) — MARA 2.0, Teil 1: Die Kündigung. Klar erklärt = sofort gebucht, nie zweimal fragen.
// Alle Sätze sind erfunden, gebaut nach den Mustern echter Kundenmails (ohne Namen, ohne Kennungen).
// Offline, ohne KI, ohne Datenbank (nur reine Funktionen). Aufruf:
//   env -i HOME=$HOME PATH=… DATABASE_URL=postgresql://pruef@127.0.0.1:9/keine node_modules/.bin/tsx scripts/pruef-mara2-e499.ts

let gut = 0, schlecht = 0;
function ok(b: unknown, was: string) { if (b) { gut++; console.log(`  ✓ ${was}`); } else { schlecht++; console.log(`  ✗ ${was}`); } }

async function main() {
  const W = await import("../server/lib/fiaon-postmeister-werkzeuge");
  const A = await import("../server/lib/fiaon-postmeister-agent");
  const urteil = (t: string, unbezahlt = false) => W.austrittsWille(t, { unbezahlt }).urteil;

  console.log("── 1 · Klare Erklärung in seinen Worten → „klar“ (wird gebucht)");
  const klar: [string, boolean?][] = [
    ["Sehr geehrte Damen und Herren, hiermit kündige ich einen eventuell bestehenden Vertrag mit sofortiger Wirkung!"],
    ["Ja, ich möchte diesen Vertrag jetzt kündigen."],
    ["Could you please cancel my subscription?"],
    ["Vielen Dank. Ersuche um Kündigung meines Accounts."],
    ["Ich bitte Sie um Stornierung meiner Kreditkarte Antrag!"],
    ["Hiermit ist diese Kreditkarte mit sofortiger Wirkung gekündigt, da ich den Kredit nie bekommen habe."],
    ["Guten Tag, hirmit Stonie ich meinn Vertrag bei Ihnn, mit sofortiger Wirkung."],
    ["Leider kann ich die Rate im Moment nicht bezahlen und möchte diesen Account mit sofortiger Wirkung kündigen."],
    ["Hallo, wie oft denn noch, ich habe vor 2 Monaten schon gekündigt!!!!"],
    ["Ich beende das Fiaon Verhältnis."],
    ["Hallo, ich will den Antrag zurückziehen, weil mir das nicht viel bringt, wenn ich keinen Kredit habe."],
    ["Okay, dann würde ich den Vertrag kündigen."],
    ["Hallo. Muss kündigen. Habe keinen Kredit."],
    ["Sehr geehrte Frau Lindner, hier ist das klare Ja zur endgültigen Beendigung der Zusammenarbeit."],
    ["Dann widerspreche ich allem, will nichts mehr."],
    ["Ich habe den Vertrag fristgerecht widerrufen."],
    ["Ich hatte gekündigt."],
    ["Das sind die Zahlungen und jetzt kündigen Sie endlich das und überweisen Sie mir mein Geld. Von meinem/meiner Galaxy gesendet"],
    ["Guten Tag, hiermit bestelle ich meine Anfrage ab."],
    ["Ich verzichte auf Ihre Dienstleistung."],
    ["Nachdem ich die Kündigung rechtzeitig eingebracht habe, gibt es Ihrerseits keinerlei Anspruch auf Zahlung."],
    ["Können Sie bitte aufhören, mir Rechnungen zu senden, ich habe im August gekündigt."],
    ["Danke, hat sich erledigt.", true],
    ["Danke, kein Interesse mehr.", true],
    ["Ich habe alles abgebrochen.", true],
  ];
  for (const [s, unbez] of klar) ok(urteil(s, !!unbez) === "klar", `klar: „${s.slice(0, 70)}“`);

  console.log("── 2 · Frage oder Überlegung → „frage“ (einmal freundlich nachfragen)");
  for (const s of [
    "Wie kann ich kündigen?",
    "Kann ich es auch stornieren",
    "Bis wann kann ich den Vertrag kündigen?",
    "Ich überlege, ob ich kündigen soll.",
    "Welche Kündigungsfrist habe ich?",
    "Ich denke darüber nach, das Abo zu kündigen.",
    "Vielleicht kündige ich.",
    "Ich möchte wissen, wie ich den Vertrag kündigen kann.",
  ]) ok(urteil(s) === "frage", `frage: „${s}“`);

  console.log("── 3 · Drohung oder Bedingung → „bedingt“ (Kündigung nicht ansprechen)");
  for (const s of [
    "Ich will meine Karte, oder ich kündige jetzt.",
    "Sollte ich bis 15.11. keine Karte haben, kündige ich.",
    "Hallo, sollten wir kurzfristig keine Lösung bzw. die versprochene Karte nicht erreichen, werde ich alle Zahlungen einstellen und die Vereinbarung kündigen.",
    "Wenn sich bis Freitag niemand meldet, kündige ich.",
    "Sonst kündige ich den Vertrag.",
  ]) ok(urteil(s) === "bedingt", `bedingt: „${s.slice(0, 70)}“`);

  console.log("── 4 · Kein Austritt aus UNSEREM Vertrag → „nichts“");
  for (const s of [
    "Ich kündige nicht, ich möchte nur meine Karte.",
    "Bitte kündigen Sie nicht meinen Vertrag, ich zahle morgen.",
    "Mein Mann will kündigen, ich aber nicht.",
    "Ich habe meinen Handyvertrag gekündigt.",
    "Mir wurde gekündigt, deshalb kann ich gerade nicht zahlen.",
    "Mein Arbeitgeber hat mir gekündigt.",
    "Ich habe meinen Job gekündigt und zahle nächste Woche.",
    "Meine Wohnung wurde gekündigt, ich ziehe um.",
    "Danke für die Stornierung.",
    "Ich habe gekündigt. Nein, war ein Scherz, ich bleibe.",
    "Wo finde ich meine Kündigungsbestätigung?",
    "Bitte senden Sie mir die Widerrufsbelehrung.",
    "Möchten Sie Ihren Vertrag kündigen? Ein kurzes Ja genügt.",
    "Wann kommt meine Karte?",
    "Stopp",
  ]) ok(urteil(s) === "nichts", `nichts: „${s.slice(0, 70)}“`);
  ok(urteil("Danke, hat sich erledigt.", false) === "nichts", "„hat sich erledigt“ beim ZAHLENDEN Kunden ist keine Kündigung");
  ok(urteil("Sie sollten die Kündigung endlich bestätigen, ich habe im Juli gekündigt.") === "klar", "„Sie sollten …“ ist eine Aufforderung, keine Bedingung");

  console.log("── 5 · Nur SEINE Worte zählen (Fußzeile der Mail-App, unser Zitat)");
  const mitZitat = "Ja\n\nVon meinem/meiner Galaxy gesendet\n-------- Ursprüngliche Nachricht --------\nVon: FIAON\nMöchten Sie Ihren Vertrag kündigen? Ein kurzes Ja genügt.";
  ok(W.eigenerKern(mitZitat).trim() === "Ja", "eigenerKern: alles hinter der App-Fußzeile fällt weg");
  ok(urteil("Danke für die Info.\n\nGesendet mit der GMX Mail App\nIhre Kündigung können Sie jederzeit erklären.") === "nichts", "unser Satz hinter der App-Fußzeile ist nie seine Erklärung");
  const eigen = W.kundenTeil("Sehr geehrte Damen und Herren,\nhiermit kündige ich meinen Vertrag.\n\nMara Lindner ,\nbitte um Bestätigung.");
  ok(/kündige ich meinen Vertrag/.test(eigen) && /Bestätigung/.test(eigen), "kundenTeil: die Anrede „Mara Lindner ,“ schneidet seinen Text nicht mehr ab");
  const mitSignatur = W.kundenTeil("Bitte kündigen.\n\nMara Lindner\nDigitale Assistentin\nFIAON\nIhre Monatsrate ist fällig.");
  ok(!/Monatsrate/.test(mitSignatur), "kundenTeil: unsere Signatur („Mara Lindner ⏎ Digitale Assistentin“) beginnt weiter das Zitat");
  ok(W.zitierterTeil(mitZitat).includes("Ein kurzes Ja genügt"), "zitierterTeil: liefert unseren Text unter seiner Antwort");
  ok(W.frageImZitat(W.zitierterTeil(mitZitat)), "frageImZitat: erkennt unsere Rückfrage im Zitat (Entwurf, den ein Mensch aus Gmail gesendet hat)");
  ok(!W.frageImZitat("Ihre Monatsrate 2 ist fällig. Bitte überweisen Sie 59,99 €."), "frageImZitat: eine Zahlungserinnerung ist keine Rückfrage");

  console.log("── 6 · Unsere Rückfrage — in jedem Wortlaut");
  for (const s of [
    "Möchten Sie Ihren Vertrag kündigen? Ein kurzes Ja genügt.",
    "Möchten Sie, dass ich Ihre Bestellung jetzt storniere? Ein kurzes Ja genügt.",
    "Damit ich die Kündigung für Sie buchen kann, antworten Sie bitte mit Ja.",
    "Soll ich den Vertrag für Sie beenden?",
  ]) ok(W.austrittsFrageGestellt(s), `Rückfrage erkannt: „${s.slice(0, 60)}“`);
  ok(!W.austrittsFrageGestellt("Ihre Kündigung ist gebucht. Die Bestätigung kommt gleich per E-Mail."), "eine Bestätigung ist keine Rückfrage");
  ok(!W.austrittsFrageGestellt("Haben Sie die Karte schon beantragt?"), "eine andere Frage ist keine Kündigungs-Rückfrage");

  console.log("── 7 · Sein Ja auf die Rückfrage");
  for (const s of [
    "Ja", "Ja bitte", "Ja, ich möchte diesen Vertrag jetzt kündigen.", "Guten Abend, Mara Lindner, Ja, bitte kündigen Sie.",
    "Sehr geehrte Frau Lindner, ja. Mit freundlichen Grüßen Max Muster", "Yes please", "Genau", "Bitte kündigen", "Ok",
    "Jawohl, bitte beenden Sie den Vertrag zum nächstmöglichen Zeitpunkt.",
  ]) ok(W.bejahtAustritt(s), `Ja: „${s}“`);
  for (const s of [
    "Nein", "Ja, aber erst wenn ich die Karte habe", "Ja, wenn ich mein Geld zurückbekomme", "Ja, ich habe gestern überwiesen",
    "Ja, wann kommt meine Karte?", "Bitte rufen Sie mich an", "Ok, ich zahle morgen", "Ich kündige nicht", "Ja oder was meinen Sie",
    "Gerne einen Termin am Montag",
  ]) ok(!W.bejahtAustritt(s), `kein Ja: „${s}“`);

  for (const s of ["Ja ich überlege noch", "Ja, vielleicht später", "Ja, eigentlich schon, weiß es noch nicht"]) ok(!W.bejahtAustritt(s), `kein Ja (Vorbehalt): „${s}“`);

  console.log("── 7b · WhatsApp: das Ja mit mehr Worten auf Maras verbindliche Rückfrage");
  const ton = await import("../shared/fiaon-mara-ton");
  const frage = { text: `Verstehe ich. ${ton.KUENDIGUNG_RUECKFRAGE}`, am: new Date(), vorlage: null, vonMara: true };
  const breit = (k: string, l: any = frage) => ton.jaAufKuendigungsAngebot(k, l) || (ton.jaAufKuendigungsAngebot("ja", l) && W.bestaetigtAustrittBreit(k, {}));
  for (const s of ["Ja", "Ja bitte Kündigung bestätigen", "Ja, nehmen Sie die Kündigung auf. Da Sie Ihren Vertrag nicht eingehalten haben", "Ich möchte kündigen", "Bitte kündigen Sie jetzt endlich", "Jawohl, kündigen"])
    ok(breit(s), `WhatsApp bestätigt: „${s.slice(0, 60)}“`);
  for (const s of ["Ok", "Ja, aber erst nächsten Monat", "Ja ich überlege noch", "Nein", "Ich kündige nicht", "Wie lange läuft der Vertrag?", "Ja, ich habe überwiesen", "Ich kündige. Nein, war ein Scherz."])
    ok(!breit(s), `WhatsApp bestätigt NICHT: „${s}“`);
  ok(!breit("Ja bitte Kündigung bestätigen", { text: "Möchten Sie wissen, wann Ihre Kündigung wirksam würde?", am: new Date(), vorlage: null, vonMara: true }), "ohne die verbindliche Rückfrage davor zählt kein Ja");
  ok(!breit("Ich möchte kündigen", { text: "Ihre Karte ist unterwegs.", am: new Date(), vorlage: null, vonMara: true }), "ohne Rückfrage bleibt „Ich möchte kündigen“ Schritt 1 (Mara fragt einmal)");
  ok(!breit("Ja bitte Kündigung bestätigen", { ...frage, am: new Date(Date.now() - 30 * 3600_000) }), "Rückfrage älter als 24 Stunden: kein Ja");

  console.log("── 8 · Nie zweimal fragen (rueckfrageEntfernen)");
  const zwei = "Guten Tag Herr Muster,\n\nIhre Nachricht ist angekommen. Möchten Sie Ihren Vertrag kündigen? Ein kurzes Ja genügt.\n\nIhre Rechnung finden Sie in Ihrem Bereich.";
  const ohne = A.rueckfrageEntfernen(zwei);
  ok(!A.rueckfrageGestellt(ohne), "die Rückfrage ist aus dem Text");
  ok(/Ihre Nachricht ist angekommen\./.test(ohne) && /Ihre Rechnung finden Sie/.test(ohne), "der Rest der Antwort bleibt");
  ok(ohne.split(/\n{2,}/).length === 3, "die Absätze bleiben");
  ok(A.rueckfrageEntfernen("Damit ich es buchen kann, antworten Sie bitte kurz mit Ja.").trim() === "", "„antworten Sie bitte mit Ja“ fällt weg");

  console.log("── 9 · Rücknahme und Grund");
  ok(W.austrittZurueckgenommen("Ich habe gekündigt. Ich nehme die Kündigung zurück."), "Rücknahme der Kündigung erkannt");
  ok(!W.austrittZurueckgenommen("Ich will den Antrag zurückziehen."), "„Antrag zurückziehen“ ist keine Rücknahme einer Kündigung");
  ok(/keinen Kredit/.test(W.austrittsGrund("Ich kündige. Leider habe ich keinen Kredit bekommen.")), "austrittsGrund: der Satz mit dem Grund");
  ok(W.austrittsGrund("Ich kündige hiermit.") === "", "austrittsGrund: ohne Grund leer");

  ok(!W.austrittZurueckgenommen("Hat sich erledigt.", { unbezahlt: true }), "unbezahlt: „Hat sich erledigt“ ist die Absage, keine Rücknahme");
  ok(W.austrittZurueckgenommen("Hat sich erledigt, ich bleibe.", { unbezahlt: false }), "zahlend: „Hat sich erledigt“ bleibt eine Rücknahme");

  console.log("── 9b · Alte Kündigungen nachholen (nachholFaelle, rein)");
  const N = await import("../server/lib/fiaon-kuendigung-nachholen");
  const z = (id: number, ref: string, text: string, tag: string, mehr: Partial<{ davor: string | null; flags: Record<string, unknown>; bezahlt: boolean }> = {}) =>
    ({ id, personId: 1, ref, text, empfangenAm: `2026-10-${tag}T10:00:00.000Z`, davor: mehr.davor ?? null, flags: mehr.flags ?? null, bezahlt: mehr.bezahlt ?? true });
  const f1 = N.nachholFaelle([
    z(1, "A", "Wann kommt meine Karte?", "01"),
    z(2, "A", "Hiermit kündige ich meinen Vertrag mit sofortiger Wirkung.", "03"),
    z(3, "A", "Wie oft denn noch, ich habe gekündigt!", "09"),
  ]).faelle;
  ok(f1.length === 1 && f1[0].postmeisterId === 2 && f1[0].am.startsWith("2026-10-03") && f1[0].art === "klar", "je Bestellung die FRÜHESTE klare Mail, mit ihrem Tag");
  ok(N.nachholFaelle([z(1, "B", "Ich kündige.", "02"), z(2, "B", "Ich nehme die Kündigung zurück, ich bleibe.", "04")]).faelle.length === 0, "spätere Rücknahme → nie buchen");
  ok(N.nachholFaelle([z(1, "B", "Ich kündige.", "02"), z(2, "B", "Ich kündige nicht, ich möchte nur meine Karte.", "04")]).faelle.length === 0, "späteres „ich kündige nicht“ → nie buchen");
  ok(N.nachholFaelle([z(1, "C", "Hiermit widerrufe ich den Vertrag.", "02", { flags: { widerruf: true } })]).faelle.length === 0, "Widerruf-Lampe → entscheidet ein Mensch");
  ok(N.nachholFaelle([z(1, "C", "Ich kündige, ich habe das nie bestellt.", "02", { flags: { bestreitet: true } })]).faelle.length === 0, "Bestreiten → nie von selbst");
  ok(N.nachholFaelle([z(1, "D", "Ich will meine Karte, oder ich kündige jetzt.", "02")]).faelle.length === 0, "Drohung → kein Fall");
  ok(N.nachholFaelle([z(1, "D", "Wie kann ich kündigen?", "02")]).faelle.length === 0, "Frage → kein Fall");
  const ja = N.nachholFaelle([z(1, "E", "Ja, bitte.", "05", { davor: "Möchten Sie Ihren Vertrag kündigen? Ein kurzes Ja genügt." })]).faelle;
  ok(ja.length === 1 && ja[0].art === "ja", "sein Ja auf unsere Rückfrage → Fall „ja“");
  ok(N.nachholFaelle([z(1, "E", "Ja, bitte.", "05", { davor: "Ihre Karte ist unterwegs." })]).faelle.length === 0, "ein Ja ohne unsere Rückfrage → kein Fall");
  ok(N.nachholFaelle([z(1, "F", "Hat sich erledigt.", "05", { bezahlt: false })]).faelle.length === 1, "unbezahlt: „Hat sich erledigt“ → Storno-Fall");
  ok(N.nachholFaelle([z(1, "F", "Hat sich erledigt.", "05", { bezahlt: true })]).faelle.length === 0, "zahlend: „Hat sich erledigt“ → kein Fall");

  const stichtag = "2026-10-05T00:00:00.000Z";
  ok(N.nachholFaelle([z(1, "S", "Ich kündige.", "03"), z(2, "T", "Ich kündige.", "07")], { nurVor: stichtag }).faelle.map((f: any) => f.ref).join() === "S", "Stichtag: nur Mails davor begründen einen Fall (Altbestand)");
  ok(N.nachholFaelle([z(1, "S", "Ich kündige.", "03"), z(2, "S", "Ich nehme die Kündigung zurück.", "07")], { nurVor: stichtag }).faelle.length === 0, "Stichtag: eine spätere Rücknahme zählt weiter");
  ok(new Date(N.NACHHOL_NUR_VOR).getTime() === Date.UTC(2026, 10, 12, 8, 9), "Stichtag = E-499 live (12.11.2026 09:09 Berliner Zeit)");

  console.log("── 9c · Widerruf einer unbezahlten Bestellung = Storno, das Mara selbst erledigt (E-369 wieder wirksam)");
  const wr = { widerruf: true, rechtlich: true };
  ok(W.rechtlichNurWegenWiderruf(wr, "Re: Ihr Antrag\nHiermit widerrufe ich meinen Vertrag innerhalb der 14 Tage."), "reiner Widerruf: „rechtlich“ brennt nur seinetwegen");
  ok(!W.rechtlichNurWegenWiderruf({ ...wr, droht_anwalt: true }, "Ich widerrufe, sonst gehe ich zum Anwalt."), "mit Anwalt: bleibt beim Menschen");
  ok(!W.rechtlichNurWegenWiderruf({ ...wr, bestreitet: true }, "Ich widerrufe, ich habe das nie bestellt."), "mit Bestreiten: bleibt beim Menschen");
  ok(!W.rechtlichNurWegenWiderruf(wr, "Ich widerrufe und bitte um Rückzahlung meiner 59,99 Euro."), "Geld zurück: bleibt beim Menschen");
  ok(!W.rechtlichNurWegenWiderruf(wr, "Ich widerrufe. Bitte löschen Sie meine Daten."), "Löschwunsch: bleibt beim Menschen");
  ok(!W.rechtlichNurWegenWiderruf(wr, "Widerruf gemäß § 355 BGB."), "Paragraf: bleibt beim Menschen");
  ok(!W.rechtlichNurWegenWiderruf({ rechtlich: true }, "Bitte stornieren."), "ohne Lampe Widerruf: nie");
  const ruhigW = "Ihren Widerruf habe ich aufgenommen. Ihre Bestellung ist storniert; es bleibt nichts offen.";
  ok(A.maraSelbstSendbar({ flags: wr, lage: "unbezahlt", global: false, text: ruhigW, ruhe: true, stornoGebucht: true, rechtlichNurWiderruf: true }), "Storno gebucht + nur Widerruf → Mara sendet selbst");
  ok(!A.maraSelbstSendbar({ flags: wr, lage: "unbezahlt", global: false, text: ruhigW, ruhe: true, stornoGebucht: true }), "ohne das Merkmal bleibt „rechtlich“ beim Menschen (wie bisher)");
  ok(!A.maraSelbstSendbar({ flags: wr, lage: "unbezahlt", global: false, text: ruhigW, ruhe: true, stornoGebucht: false, rechtlichNurWiderruf: true }), "ohne gebuchtes Storno: nie selbst");
  ok(!A.maraSelbstSendbar({ flags: { ...wr, droht_anwalt: true }, lage: "unbezahlt", global: false, text: ruhigW, ruhe: true, stornoGebucht: true, rechtlichNurWiderruf: true }), "Anwalt bleibt immer beim Menschen");
  ok(N.nachholFaelle([z(1, "W", "Hiermit widerrufe ich mit sofortiger Wirkung den Vertrag.", "02", { flags: wr, bezahlt: false })]).faelle.length === 1, "Nachholen: Widerruf einer unbezahlten Bestellung → Storno-Fall");
  ok(N.nachholFaelle([z(1, "W", "Hiermit widerrufe ich mit sofortiger Wirkung den Vertrag.", "02", { flags: wr, bezahlt: true })]).faelle.length === 0, "Nachholen: Widerruf nach Zahlung → entscheidet ein Mensch");
  ok(N.nachholFaelle([z(1, "W", "Ich widerrufe und will mein Geld zurück.", "02", { flags: wr, bezahlt: false })]).faelle.length === 0, "Nachholen: Widerruf mit Geld-zurück → entscheidet ein Mensch");

  console.log("── 10 · Maras Tagesbericht (reine Teile)");
  const T = await import("../server/lib/fiaon-mara-tagesbericht");
  const um = (iso: string) => new Date(iso);
  ok(!T.tagesberichtFaellig(um("2026-11-12T18:59:00Z"), "").faellig, "19:59 Berliner Zeit: noch nicht fällig");
  ok(T.tagesberichtFaellig(um("2026-11-12T19:01:00Z"), "").faellig, "20:01 Berliner Zeit: fällig");
  ok(T.tagesberichtFaellig(um("2026-07-01T18:01:00Z"), "").faellig, "Sommerzeit: 20:01 Berliner Zeit ist 18:01 UTC");
  ok(!T.tagesberichtFaellig(um("2026-11-12T20:30:00Z"), "2026-11-12").faellig, "heute schon gesendet: nicht noch einmal");
  ok(T.tagesberichtFaellig(um("2026-11-13T19:05:00Z"), "2026-11-12").faellig, "am nächsten Abend wieder fällig");
  ok(T.tagesberichtFaellig(um("2026-11-12T19:30:00Z"), "2026-11-12#f2").faellig, "nach zwei Fehlversuchen: dritter Versuch");
  ok(!T.tagesberichtFaellig(um("2026-11-12T19:30:00Z"), "2026-11-12#f3").faellig, "nach drei Fehlversuchen: Schluss für heute");
  const leer: any = { tag: "2026-11-12", von: "2026-11-11T19:00:00Z", bis: "2026-11-12T19:00:00Z", erledigt: 0, zeilen: [], mails: 0, whatsapps: 0, termine: 0,
    postfach: null, kuendigungen: null, geld: null, karten: null, haengt: [], ki: null, verlauf: [] };
  ok(/ruhig/.test(T.tagesberichtKurz(leer).join(" ")) && /wartet gerade nichts/.test(T.tagesberichtKurz(leer).join(" ")), "leerer Tag: ehrlicher Satz, kein Zahlenfriedhof");
  const voll: any = { ...leer, erledigt: 12, mails: 5, whatsapps: 6, termine: 1,
    zeilen: [{ art: "wa_antwort", n: 6, text: "WhatsApp-Antworten", link: "", werkzeug: null }],
    postfach: { rein: 9, selbstBeantwortet: 5, entwuerfeWarten: 2, entwuerfeAlt: 40 },
    kuendigungen: { gebucht: 1, postfachGebucht: [{ kunde: "Max <Muster>", ergebnis: "Die Kündigung ist gebucht." }], postfachOffen: [] },
    geld: { heuteCents: 15998, zahlungen: 2, nachMaraCents: 7999, nachMaraZahlungen: 1 }, karten: { entscheidungen: 1, minuten: 2, aeltesteTage: 0 } };
  const html = T.tagesberichtHtml(voll), mail = T.tagesberichtMail(voll);
  ok(/159,98 €/.test(html) && /Max &lt;Muster&gt;/.test(html), "PDF-Rumpf: Geld deutsch formatiert, Namen maskiert (kein HTML aus Daten)");
  ok(/2 Entwürfe im Postfach/.test(T.tagesberichtKurz(voll).join(" ")) && /40<\/td><td>ältere Entwürfe/.test(html), "alte Entwürfe (über 14 Tage) stehen getrennt — oben zählt nur, was wirklich wartet");
  ok(/12 erledigt · 1 für dich/.test(mail.betreff) && mail.dateiname === "Mara_Tagesbericht_2026-11-12.pdf", "Mail: Betreff und Dateiname");
  ok(/Guten Abend Justin/.test(mail.text) && /Mara$/.test(mail.text), "Mail: Maras Stimme, mit Gruß");

  console.log(`\n${gut} bestanden, ${schlecht} fehlgeschlagen`);
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
