// Prüfstand E-401 (4/6, 19.10.2026), ohne Datenbank: Mara ändert Anschrift, E-Mail und Telefon selbst (angaben_aendern).
// Die reine Erkennung (shared/fiaon-angaben-aendern.ts) — welches Feld, welcher neue Wert, plausibel, was Mara nie ändert —,
// die Sätze, der Hinweis, die Antwortprüfung, die Wände und der Einbau in Postfach und WhatsApp (Quelltext).
// Alle Personen, Anschriften, Adressen und Nummern sind erfunden.
//   env -i HOME="$HOME" PATH="$PATH" TZ=Europe/Berlin DATABASE_URL=postgresql://nobody@127.0.0.1:1/none \
//     node_modules/.bin/tsx scripts/pruef-mara-angaben.ts
process.env.DATABASE_URL = "postgresql://nobody@127.0.0.1:1/none";
process.env.CRONS = "aus";
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "TWILIO_AUTH_TOKEN", "WISE_API_TOKEN", "AIRWALLEX_API_KEY", "DATABASE_URL_EXTERN"]) delete process.env[k];
// Modell-Attrappe für den WhatsApp-Entwurf (Abschnitt 11) — sonst kein Netz.
process.env.OPENAI_API_KEY = "sk-pruef-lokal-e401ag";
process.env.KI_ANBIETER = "openai";
const ANTWORTEN: string[] = [];
let modellRufe = 0, netz = 0;
globalThis.fetch = (async (u: any) => {
  const url = String(u?.url ?? u);
  if (url.startsWith("https://api.openai.com/")) {
    modellRufe++;
    const antwort = ANTWORTEN.shift() ?? "Danke.";
    return new Response(JSON.stringify({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ antwort, gemerkt: "", mensch: false, uebergabe: "" }) }] }],
      usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 } }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  netz++;
  return new Response("kein Netz im Prüfstand", { status: 599 });
}) as any;

import { readFileSync } from "node:fs";
import {
  angabenErkennen, angabenWunsch, angabenSatz, angabenHinweis, angabenAntwortFunde, angabenMenschNoetig, feldSatz, verbotenErkennen,
  telefonNorm, telefonText, telefonMaske, nummerE164, waNummerGleich, mailGrundform, mailGleich, mailPlausibel, mailMaske, nummerGleich, plzPlausibel, landNorm, landAus,
  grossSchreiben, strasseAus, anschriftText, anschriftSchluessel, bestaetigungsMail, hinweisAlteMail, hinweisTelefonMail, LINK_STUNDEN,
  type AngabenLageRein, type FeldErgebnis, type FeldWunsch,
} from "../shared/fiaon-angaben-aendern";
import { tonPruefung } from "../shared/fiaon-mara-ton";
import { wandPruefen } from "../shared/fiaon-wortverbote";

let gut = 0, schlecht = 0;
function ok(b: unknown, was: string, extra: unknown = "") {
  if (b) { gut++; console.log(`  ✓ ${was}`); }
  else { schlecht++; console.log(`  ✗ ${was}${extra !== "" ? ` — ${typeof extra === "string" ? extra : JSON.stringify(extra)}` : ""}`); }
}
const abschnitt = (t: string) => console.log(`\n── ${t}`);
const wunsch = (text: string, feld: string, o: Parameters<typeof angabenErkennen>[1] = {}): FeldWunsch | undefined =>
  angabenErkennen(text, o).wuensche.find((w) => w.feld === feld);
const voll = (w: FeldWunsch | undefined) => (w && w.art === "voll" ? (w as any).wert : null);

async function main() {
  abschnitt("1 · Normalformen");
  ok(telefonNorm("0151 2345 6789") === "+4915123456789" && telefonNorm("0049 151 23456789") === "+4915123456789" && telefonNorm("+49 (0) 151 23456789") === "+4915123456789",
    "Telefon DE: 0151 …, 0049 …, +49 (0) … → +49…");
  ok(telefonNorm("0664 1234567", "AT") === "+436641234567" && telefonNorm("079 123 45 67", "CH") === "+41791234567", "Telefon mit dem Land der Akte: 0664 → +43, 079 → +41");
  ok(telefonNorm("12345") === null && telefonNorm("+41 79 123") === null && telefonNorm("abc") === null && telefonNorm("4915123456789") === "+4915123456789", "Telefon: zu kurz, CH ohne neun Ziffern, Text → null; 49… ohne + → +49…");
  ok(telefonText("+4915123456789") === "+49 151 23456789" && telefonMaske("+4915123456789") === "+49 151 ••••6789", "Telefon: Anzeige und Maske");
  ok(nummerGleich("+49 151 23456789", "015123456789") && nummerGleich("4915123456789", "+4915123456789") && !nummerGleich("0151 1", "0151 1"), "nummerGleich: letzte neun Ziffern, mindestens sieben");
  ok(waNummerGleich("4915123456789", "+49 151 23456789") && waNummerGleich("4915123456789", "015123456789", "DE") && waNummerGleich("436641234567", "0664 1234567", "AT")
    && !waNummerGleich("4315123456789", "+4915123456789") && !waNummerGleich("4915123456789", "+4915123456780") && waNummerGleich("905321234567", "+90 532 123 45 67")
    && nummerE164("004369912345678") === "+4369912345678", "WhatsApp-Absender: ganze Nummer mit Landesvorwahl (gleiches Ende in einem anderen Land zählt nicht)");
  ok(mailGrundform("Max.Probe+fiaon@googlemail.com") === "maxprobe@gmail.com" && mailGleich("max.probe@gmail.com", "MAXPROBE@gmail.com") && !mailGleich("a@b.de", "a@c.de") && !mailGleich("", ""),
    "mailGleich: Gmail-Grundform, groß/klein egal, leer ist nie gleich");
  ok(mailPlausibel("neu.probe@beispiel.de") === null && !!mailPlausibel("neu@gmail.con") && !!mailPlausibel("neu@gmial.com") && !!mailPlausibel("neu..x@beispiel.de") && !!mailPlausibel("x@fiaon.com") && !!mailPlausibel("kein-at.de"),
    "mailPlausibel: Form, Tippfehler (gmail.con, gmial), Doppelpunkt, fiaon.com");
  ok(mailMaske("max.probe@beispiel.de") === "m••••••••@b•••••••.de", "mailMaske", mailMaske("max.probe@beispiel.de"));
  ok(plzPlausibel("10115", "DE") && !plzPlausibel("1010", "DE") && plzPlausibel("1010", "AT") && !plzPlausibel("10115", "AT") && plzPlausibel("8001", "CH") && !plzPlausibel("00123", "DE"), "plzPlausibel: DE fünf, AT/CH vier Ziffern");
  ok(landNorm("Deutschland") === "DE" && landNorm("AT") === "AT" && landNorm("Österreich") === "AT" && landNorm("CH") === "CH" && landNorm("BG") === null && landNorm("") === null, "landNorm");
  ok(landAus("Ich wohne jetzt in Österreich") === "AT" && landAus("von Deutschland nach Österreich") === null && landAus("Hallo") === null, "landAus: nur eindeutig");
  ok(grossSchreiben("frankfurt am main") === "Frankfurt am Main" && grossSchreiben("Halle (Saale)") === "Halle (Saale)" && grossSchreiben("an der kirche 4") === "An der Kirche 4", "grossSchreiben nur bei reiner Kleinschrift");
  ok(strasseAus("Meine neue Adresse ist Neuweg 2") === "Neuweg 2" && strasseAus("In der Au 5") === "In der Au 5" && strasseAus("Hauptstraße 12/3/7") === "Hauptstraße 12/3/7"
    && strasseAus("Am Markt 3a") === "Am Markt 3a" && strasseAus("Tel 0151 Neuweg 2") === "Neuweg 2" && strasseAus("ohne Nummer") === null, "strasseAus: Einleitung weg, Zusätze (12/3/7, 3a) bleiben");
  ok(anschriftSchluessel({ strasse: "Musterstr. 5", plz: "54321", ort: "Neustadt" }) === anschriftSchluessel({ strasse: "musterstraße 5", plz: "54321", ort: "NEUSTADT" }), "anschriftSchluessel: Str. = Straße, groß/klein egal");

  abschnitt("2 · Der Wunsch — nur ausdrücklich");
  for (const t of ["Hallo, ich bin umgezogen. Meine neue Adresse: Neuweg 2, 54321 Neustadt", "Bitte ändern Sie meine Anschrift auf Neuweg 2, 54321 Neustadt",
    "Adressänderung: Neuweg 2, 54321 Neustadt", "Meine neue Handynummer ist 0151 23456789", "Bitte ändern Sie meine E-Mail-Adresse auf neu@beispiel.de",
    "meine neue email ist neu@beispiel.de", "Ich habe geheiratet und heiße jetzt anders", "Meine neue IBAN lautet DE89 3704 0044 0532 0130 00", "neue adresse hauptstr 5 10115 berlin"]) {
    ok(angabenWunsch(t), `Wunsch erkannt: „${t.slice(0, 60)}“`);
  }
  for (const t of ["Ich brauche dringend die karte auf meine adresse", "Wegen meinem Umzug kann ich gerade nicht zahlen", "Ich habe eine neue Mail von Ihnen bekommen, danke",
    "Am 19.10.2026 Umzug nach Berlin", "Meine Adresse: Altweg 1, 12345 Altstadt — wann kommt die Karte?", "Hat sich Ihre Bankverbindung geändert?",
    "Bitte rufen Sie mich unter 0151 23456789 an", "Ich habe die Rate über 59,99 € am 12.10. überwiesen", "Haben Sie meine Kundennummer? Die neue Kundennummer ist 4711"]) {
    ok(!angabenWunsch(t), `kein Wunsch: „${t.slice(0, 60)}“`, angabenErkennen(t));
  }

  abschnitt("3 · Anschrift");
  ok(JSON.stringify(voll(wunsch("Hallo, ich bin umgezogen. Meine neue Adresse: Neuweg 2, 54321 Neustadt. Grüße", "anschrift")))
    === JSON.stringify({ strasse: "Neuweg 2", plz: "54321", ort: "Neustadt", land: "DE" }), "eine Zeile mit Komma → DE");
  ok(voll(wunsch("Meine neue Adresse ist Neuweg 2 54321 Neustadt", "anschrift"))?.strasse === "Neuweg 2", "ohne Komma");
  ok(JSON.stringify(voll(wunsch("Guten Tag,\nbitte ändern Sie meine Anschrift:\nMax Probe\nIn der Au 5\n6020 Innsbruck\nÖsterreich\nDanke", "anschrift", { landBisher: "AT" })))
    === JSON.stringify({ strasse: "In der Au 5", plz: "6020", ort: "Innsbruck", land: "AT" }), "Anschriftenblock über Zeilen (Name, Straße, PLZ Ort, Land)");
  ok(voll(wunsch("Ich wohne jetzt in der Hauptstraße 12/3/7, 1010 Wien", "anschrift", { landBisher: "AT" }))?.strasse === "Hauptstraße 12/3/7", "AT mit Stiege/Tür (12/3/7)");
  const zk = voll(wunsch("neue adresse: hauptstr 5, 10115 berlin bitte ändern", "anschrift"));
  ok(zk?.strasse === "Hauptstr 5" && zk?.ort === "Berlin", "alles klein geschrieben → ordentlich groß", zk);
  ok(voll(wunsch("Ich bin umgezogen von Altweg 1, 12345 Altstadt nach Neuweg 2, 54321 Neustadt", "anschrift", { bisher: { anschrift: { strasse: "Altweg 1", plz: "12345", ort: "Altstadt" } } }))?.strasse === "Neuweg 2",
    "„von … nach …“: die gespeicherte fällt weg, die neue bleibt");
  ok(voll(wunsch("Neue Adresse: Bahnhofstrasse 1, CH-8001 Zürich", "anschrift"))?.land === "CH" && voll(wunsch("Neue Adresse: Ringstraße 3, A-4020 Linz", "anschrift"))?.land === "AT",
    "Länderkennung vor der PLZ (CH-, A-)");
  ok(voll(wunsch("Neue Anschrift: Neuweg 2, 54321 Neustadt, Deutschland", "anschrift"))?.land === "DE", "Land hinter dem Ort");
  const ohneLand = wunsch("Adressänderung: Hauptplatz 1, 9020 Klagenfurt", "anschrift", { landBisher: "DE" });
  ok(ohneLand?.art === "unvollstaendig" && (ohneLand as any).fehlt.some((f: string) => /Land/.test(f)), "vier Ziffern ohne Land (Akte DE) → fragt nach dem Land", ohneLand);
  ok(voll(wunsch("Adressänderung: Hauptplatz 1, 9020 Klagenfurt", "anschrift", { landBisher: "AT" }))?.land === "AT", "vier Ziffern, Akte AT → AT");
  const plzFalsch = wunsch("Neue Adresse: Neuweg 2, 1234 Neustadt, Deutschland", "anschrift");
  ok(plzFalsch?.art === "unklar", "PLZ passt nicht zum Land → unklar", plzFalsch);
  const ohneStr = wunsch("Meine neue Adresse: 54321 Neustadt", "anschrift");
  ok(ohneStr?.art === "unvollstaendig" && (ohneStr as any).fehlt.includes("Straße mit Hausnummer"), "ohne Straße → unvollständig (Straße mit Hausnummer)", ohneStr);
  ok(wunsch("Bitte ändern Sie meine Adresse", "anschrift")?.art === "unvollstaendig", "Wunsch ohne Anschrift → unvollständig");
  const ausl = wunsch("Neue Adresse: Via Roma 5, 00184 Rom, Italien", "anschrift");
  ok(ausl?.art === "unklar" && (ausl as any).ausland === true, "Ausland → unklar (ausland, ein Mensch)", ausl);
  const zwei = wunsch("Neue Adresse: Neuweg 2, 54321 Neustadt oder Bergweg 7, 65432 Bergdorf", "anschrift");
  ok(zwei?.art === "unklar", "zwei neue Anschriften → unklar", zwei);
  const nurAlt = wunsch("Ich bin umgezogen.\n\nMax Probe\nAltweg 1\n12345 Altstadt", "anschrift", { bisher: { anschrift: { strasse: "Altweg 1", plz: "12345", ort: "Altstadt" } } });
  ok(nurAlt?.art === "unvollstaendig", "„umgezogen“ und nur die alte Anschrift (Signatur) → nach der neuen fragen", nurAlt);

  abschnitt("4 · E-Mail-Adresse");
  ok(voll(wunsch("Bitte ändern Sie meine E-Mail-Adresse auf neu.probe@beispiel.de", "email", { absender: "alt.probe@beispiel.de" })) === "neu.probe@beispiel.de", "neue Adresse im Text, Absender bleibt draußen");
  ok(voll(wunsch("Meine neue E-Mail-Adresse: NEU.Probe@Beispiel.DE\n--\nMax Probe\nalt.probe@beispiel.de", "email", { absender: "Max Probe <alt.probe@beispiel.de>".match(/<(.+)>/)![1] })) === "neu.probe@beispiel.de",
    "Signatur mit der Absenderadresse stört nicht, klein geschrieben");
  ok(voll(wunsch("Ab sofort bitte an meine neue Mailadresse neu@beispiel.de schreiben, alte war alt@beispiel.de", "email", { bisher: { email: "alt@beispiel.de" } })) === "neu@beispiel.de",
    "„alte war …“: die gespeicherte fällt weg");
  ok(wunsch("meine neue email ist neu@gmail.con", "email")?.art === "unklar", "Tippfehler → unklar");
  ok(wunsch("Meine neue E-Mail-Adresse ist a@beispiel.de oder b@beispiel.de", "email")?.art === "unklar", "zwei neue → unklar");
  ok(wunsch("Ich habe eine neue E-Mail-Adresse, bitte ändern", "email")?.art === "unvollstaendig", "Wunsch ohne Adresse → unvollständig");
  ok(!wunsch("Meine neue E-Mail-Adresse ist info@fiaon.com", "email") || wunsch("Meine neue E-Mail-Adresse ist info@fiaon.com", "email")?.art !== "voll", "eine FIAON-Adresse ist nie seine");

  abschnitt("5 · Telefonnummer");
  ok(voll(wunsch("Meine neue Handynummer ist 0151 23456789", "telefon")) === "+4915123456789", "DE mobil");
  ok(voll(wunsch("Ich habe eine neue Nummer: 0664 1234567", "telefon", { landBisher: "AT" })) === "+436641234567", "AT (Land der Akte)");
  ok(voll(wunsch("Neue Telefonnummer +49 (0) 170 1234567, die alte 0151 23456789 bitte löschen", "telefon", { bisher: { telefon: "+4915123456789" } })) === "+491701234567",
    "neue und alte im Text → die neue");
  ok(voll(wunsch("Ich habe die Rate 59,99 € am 12.10. überwiesen, meine neue Nummer ist +49 170 1234567", "telefon")) === "+491701234567", "Betrag und Datum sind keine Nummer");
  ok(wunsch("Meine neue Nummer ist 0151 2345678 oder 0170 7654321", "telefon")?.art === "unklar", "zwei neue → unklar");
  ok(wunsch("Ich habe eine neue Handynummer", "telefon")?.art === "unvollstaendig", "Wunsch ohne Nummer → unvollständig");
  const misch = angabenErkennen("Neue Adresse: Neuweg 123 54321 Neustadt, neue Nummer 0151 23456789");
  ok(voll(misch.wuensche.find((w) => w.feld === "telefon")) === "+4915123456789" && voll(misch.wuensche.find((w) => w.feld === "anschrift"))?.plz === "54321",
    "Anschrift und Nummer zusammen — Hausnummer + PLZ werden keine Telefonnummer", misch);

  abschnitt("6 · Was Mara nie ändert (Name, Geburtsdatum, Bank, Ausweis)");
  ok(verbotenErkennen("Ich habe geheiratet und heiße jetzt anders").includes("name") && verbotenErkennen("Namensänderung bitte").includes("name"), "Name");
  ok(verbotenErkennen("Mein Geburtsdatum ist falsch eingetragen").includes("geburtsdatum"), "Geburtsdatum");
  ok(verbotenErkennen("Meine neue IBAN lautet DE89 3704 0044 0532 0130 00").includes("bank") && !verbotenErkennen("Hat sich Ihre Bankverbindung geändert?").length
    && !verbotenErkennen("Wie lautet Ihre IBAN?").length, "Bank — nur SEINE Bankverbindung, nie unsere");
  ok(verbotenErkennen("Meine Ausweisnummer hat sich geändert, neuer Ausweis").includes("ausweis"), "Ausweis");
  ok(!verbotenErkennen("Ich habe ein neues Konto bei der Partnerbank eröffnet").length, "„neues Konto“ (Partnerbank) ist keine Bankverbindung");

  abschnitt("7 · Sätze und Hinweis");
  const e = (o: Partial<FeldErgebnis> & Pick<FeldErgebnis, "feld" | "stand">): FeldErgebnis => ({ vorher: null, nachher: null, ...o });
  const A = e({ feld: "anschrift", stand: "geaendert", vorher: "Altweg 1, 12345 Altstadt", nachher: "Neuweg 2, 54321 Neustadt" });
  const M = e({ feld: "email", stand: "link_geschickt", vorher: "alt@beispiel.de", nachher: "neu@beispiel.de" });
  const T = e({ feld: "telefon", stand: "geaendert", vorher: "+4915123456789", nachher: "+491701234567" });
  const lage = (ergebnisse: FeldErgebnis[], o: Partial<AngabenLageRein> = {}): AngabenLageRein => ({ kanal: "mail", ergebnisse, verboten: [], ...o });
  ok(feldSatz(A, "mail") === "Ich habe Ihre neue Anschrift gespeichert: Neuweg 2, 54321 Neustadt.", "Anschrift gespeichert", feldSatz(A, "mail"));
  ok(/an neu@beispiel\.de einen Bestätigungslink geschickt/.test(feldSatz(M, "mail")) && new RegExp(`${LINK_STUNDEN} Stunden`).test(feldSatz(M, "mail")) && /bisherige Adresse hinterlegt/.test(feldSatz(M, "mail")),
    "E-Mail: Link an die neue, 48 Stunden, bis dahin die bisherige");
  ok(feldSatz(T, "mail") === "Ihre neue Telefonnummer +49 170 1234567 ist gespeichert.", "Telefon gespeichert");
  ok(/hinterlegten E-Mail-Adresse schreiben.*fiaon\.com\/app\/mehr\/daten/.test(angabenSatz(lage([e({ feld: "anschrift", stand: "fremder_absender" })]))), "fremder Absender (Mail): hinterlegte Adresse oder Kundenbereich");
  ok(/hinterlegten Telefonnummer schreiben/.test(angabenSatz(lage([e({ feld: "email", stand: "fremder_absender" })], { kanal: "whatsapp" }))), "fremder Absender (WhatsApp): hinterlegte Nummer");
  ok(/Ihren Namen ändere ich nicht selbst — das prüft ein Kollege/.test(angabenSatz(lage([], { verboten: ["name"] }))), "verboten (Mail): ein Kollege prüft (Aufgabe Fall 4)");
  ok(/Ihren Namen ändere ich nicht selbst — das prüft unsere Geschäftsführung persönlich, und Sie bekommen dazu eine Nachricht\./.test(angabenSatz(lage([], { verboten: ["name"], kanal: "whatsapp" })))
    && /Ihre neue Nummer prüft unsere Geschäftsführung persönlich/.test(feldSatz(e({ feld: "telefon", stand: "mensch" }), "whatsapp")), "WhatsApp: die Geschäftsführung (Karte) — der Satz wie E-372");
  ok(angabenMenschNoetig(lage([], { verboten: ["bank"] })) && angabenMenschNoetig(lage([e({ feld: "telefon", stand: "mensch" })])) && !angabenMenschNoetig(lage([A, M, T])), "Mensch nötig: verboten oder stand mensch");
  ok(/Testkonto: Ihre Anschrift würde ich auf Neuweg 2, 54321 Neustadt ändern/.test(feldSatz(e({ feld: "anschrift", stand: "probe", waere: "geaendert", nachher: "Neuweg 2, 54321 Neustadt" }), "mail")), "Testkonto: „würde …“, nichts gespeichert");
  const h = angabenHinweis(lage([A, M, T], { verboten: ["geburtsdatum"] }));
  ok(/^ANGABEN \(angaben_aendern ist gelaufen/.test(h) && /Anschrift: GESPEICHERT \(Altweg 1, 12345 Altstadt → Neuweg 2, 54321 Neustadt\)/.test(h) && /E-Mail-Adresse: NOCH NICHT GEÄNDERT/.test(h)
    && /Geburtsdatum: ändert Mara NIE selbst — dafür gibst du wie bisher eine Aufgabe/.test(h) && /KEINE Aufgabe/.test(h), "Hinweis: je Feld, E-Mail noch nicht geändert, verboten → Aufgabe (Mail)", h);
  ok(/der Server legt es Justin vor/.test(angabenHinweis(lage([], { verboten: ["name"], kanal: "whatsapp" }))) && /auch nicht angaben_eintragen/.test(angabenHinweis(lage([A], { kanal: "whatsapp" }))), "Hinweis WhatsApp: Karte, kein angaben_eintragen");
  ok(/Dafür gibst du eine Aufgabe \(aufgabe_an_betreuer, Fall 4\)/.test(angabenHinweis(lage([e({ feld: "email", stand: "mensch", grund: "vergeben" })])))
    && /Der Server legt es Justin vor/.test(angabenHinweis(lage([e({ feld: "telefon", stand: "mensch" })], { kanal: "whatsapp" }))), "Hinweis „mensch“: Mail → Aufgabe Fall 4, WhatsApp → Karte");
  ok(/NIE die gespeicherte Adresse/.test(angabenHinweis(lage([e({ feld: "anschrift", stand: "fremder_absender" })]))), "Hinweis fremder Absender: nie die gespeicherte Adresse nennen");
  const bm = bestaetigungsMail({ name: "Max Probe", neu: "neu@beispiel.de" });
  ok(/Guten Tag Max Probe/.test(bm.text) && /neu@beispiel\.de/.test(bm.text) && /Erst danach gilt/.test(bm.text) && /48 Stunden/.test(bm.fuss) && bm.knopf === "E-Mail-Adresse bestätigen", "Bestätigungsmail an die NEUE Adresse");
  const ha = hinweisAlteMail({ name: null, neu: "neu@beispiel.de" });
  ok(!ha.text.includes("neu@beispiel.de") && ha.text.includes(mailMaske("neu@beispiel.de")) && /Waren Sie das nicht\?/.test(ha.text), "Hinweis an die alte Adresse: neue nur maskiert, „Waren Sie das nicht?“");
  const ht = hinweisTelefonMail({ name: null, alt: "+4915123456789", neu: "+491701234567" });
  ok(ht.text.includes("+49 151 ••••6789 → +49 170 •••4567") && !ht.text.includes("1701234567"), "Telefon-Hinweis: beide Nummern maskiert", ht.text);

  abschnitt("8 · Die Antwortprüfung (hart)");
  const L = lage([A, M, T]);
  ok(!angabenAntwortFunde(`Vielen Dank! ${angabenSatz(L)}`, L).length, "der Satz selbst besteht", angabenAntwortFunde(angabenSatz(L), L));
  ok(angabenAntwortFunde("Ich habe Ihre neue E-Mail-Adresse gespeichert. Ihre neue Anschrift Neuweg 2, 54321 Neustadt und Nummer 1234567 auch.", L).some((f) => /E-Mail-Adresse sei geändert/.test(f)),
    "„E-Mail-Adresse gespeichert“ vor dem Klick → hart");
  ok(angabenAntwortFunde("Danke, ich habe alles geändert.", lage([A])).some((f) => /Anschrift nicht/.test(f)), "geändert, aber die Anschrift (PLZ) fehlt → hart");
  ok(angabenAntwortFunde("Ihre Nummer ist gespeichert.", lage([T])).some((f) => /Telefonnummer nicht/.test(f)), "Nummer gespeichert ohne die Nummer → hart");
  ok(angabenAntwortFunde("Danke für Ihre Nachricht.", lage([M])).some((f) => /Bestätigungslink/.test(f)), "Link geschickt, aber nicht erwähnt → hart");
  const U = lage([e({ feld: "anschrift", stand: "unvollstaendig", fehlt: ["Postleitzahl"] })]);
  ok(angabenAntwortFunde("Ihre neue Adresse ist eingetragen.", U).length > 0 && !angabenAntwortFunde(angabenSatz(U), U).length, "unvollständig: „eingetragen“ hart, die Frage frei");
  const V = lage([], { verboten: ["name"] });
  ok(angabenAntwortFunde("Ich habe Ihren Nachnamen geändert.", V).some((f) => /Mara nie selbst/.test(f)) && !angabenAntwortFunde("Ihren Namen ändere ich nicht selbst — das prüft ein Kollege.", V).length,
    "Name: „geändert“ hart, „prüft ein Kollege“ frei");
  const F = lage([e({ feld: "email", stand: "fremder_absender" })], { geheim: ["alt.probe@beispiel.de", "+4915123456789"] });
  ok(angabenAntwortFunde("Ihre hinterlegte Adresse ist alt.probe@beispiel.de — bitte schreiben Sie von dort.", F).some((f) => /gespeicherte Daten/.test(f)), "fremder Absender: gespeicherte Adresse genannt → hart");
  ok(angabenAntwortFunde("Bitte melden Sie sich unter 0151 23456789.", F).some((f) => /gespeicherte Daten/.test(f)), "fremder Absender: gespeicherte Nummer genannt → hart");
  ok(angabenAntwortFunde("Danke.", F).some((f) => /sicher macht/.test(f)) && !angabenAntwortFunde(angabenSatz(F), F).length, "fremder Absender: der Weg (hinterlegt/Kundenbereich) muss drinstehen");
  ok(!angabenAntwortFunde("Ihre bisherige Adresse bleibt hinterlegt, bis Sie klicken.", lage([M])).filter((f) => /sei geändert/.test(f)).length, "„bisherige … hinterlegt“ ist keine Behauptung");

  abschnitt("9 · Die Sätze bestehen Maras Wände (Ton Mail/WhatsApp, Wortwand, WhatsApp-Sendewand)");
  const wa = await import("../server/lib/fiaon-whatsapp");
  const { selbstErledigtTreffer } = await import("../shared/fiaon-mara-ton");
  const alle: [string, AngabenLageRein][] = [
    ["alles", L], ["unvollständig", U], ["verboten", V], ["fremd Mail", F], ["fremd WA", lage([e({ feld: "anschrift", stand: "fremder_absender" })], { kanal: "whatsapp" })],
    ["mensch WA", lage([e({ feld: "telefon", stand: "mensch" })], { kanal: "whatsapp" })], ["verboten WA", lage([], { verboten: ["name", "bank"], kanal: "whatsapp" })],
    ["alles WA", lage([A, M, T], { kanal: "whatsapp" })], ["schon so", lage([e({ feld: "anschrift", stand: "schon_so", nachher: "Neuweg 2, 54321 Neustadt" })])],
    ["unklar", lage([e({ feld: "email", stand: "unklar" }), e({ feld: "telefon", stand: "unklar" })])],
  ];
  for (const [name, l] of alle) {
    const s = angabenSatz(l);
    const tonM = tonPruefung(s, { kanal: "mail" }).filter((b) => b.schwere === "hart");
    const tonW = tonPruefung(s, { kanal: "whatsapp" }).filter((b) => b.schwere === "hart");
    const wand = wandPruefen(s, []).filter((t) => t.art !== "floskel");
    ok(s && !tonM.length && !tonW.length && !wand.length && !wa.sendePruefung(s).length, `Satz (${name}): kein harter Ton-Treffer, keine Wortwand, WhatsApp-Sendewand frei`, { s, tonM, tonW, wand, send: wa.sendePruefung(s) });
    if (l.kanal === "whatsapp") ok(!selbstErledigtTreffer(s).abgabe && !selbstErledigtTreffer(s).anruf, `Satz (${name}): auf WhatsApp kein „Abschieben“ (E-275)`, selbstErledigtTreffer(s));
  }

  abschnitt("10 · Einbau (Quelltext): der Server handelt vor dem Modell, ein Speicherweg, der Link ändert erst beim Klick");
  const q = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  const ohneKommentare = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const pm = ohneKommentare(q("server/lib/fiaon-postmeister-agent.ts"));
  const iA = pm.indexOf("angabenAendernBehandeln(");
  ok(iA > 0 && iA < pm.indexOf("const nachrichten: any[] = [") && pm.includes("vorab.push(angaben.hinweis)") && /absender: ein\.mail\.von/.test(pm), "Postfach: angaben_aendern läuft VOR dem Modell, mit dem Absender, Hinweis vorab");
  ok(/!akte\?\.global/.test(pm.slice(iA - 300, iA)), "Postfach: nie beim Global-Kunden");
  const sperre = pm.match(/const angabenAufgabeUnnoetig = [\s\S]*?;\n/)?.[0] ?? "";
  const reSperre = new RegExp(sperre.match(/&& \/(\\b\(\?:adress[\s\S]*?)\/i\.test/)?.[1] ?? "§§§", "i");
  ok(reSperre.test("Adresse ändern") && reSperre.test("Neue Handynummer eintragen") && reSperre.test("neue Nummer") && !reSperre.test("Vertragsnummer für Bescheinigung") && !reSperre.test("Kündigung prüfen"),
    "Postfach: die Aufgabensperre greift bei Anschrift/Nummer/Mail, nicht bei „Vertragsnummer“", sperre.slice(0, 200));
  ok(/angabenAntwortFunde\(t, k\.angaben\)/.test(pm) && /zahlung: zahlungGesucht, angaben,/.test(pm) && /angabenAufgabeUnnoetig\(w\.name, p\)/.test(pm), "Postfach: Antwortprüfung und keine Aufgabe für Erledigtes");
  ok(/Anschrift, E-Mail-Adresse und Telefonnummer ändert der SERVER selbst/.test(q("server/lib/fiaon-postmeister-agent.ts")) && /ändert der Server selbst, E-401/.test(q("server/lib/fiaon-postmeister-werkzeuge.ts")),
    "Postfach: Fall 4 nennt nur noch Name, Geburtsdatum, Bank, Ausweis");
  const wq = ohneKommentare(q("server/lib/fiaon-whatsapp-mara.ts"));
  ok(/kanal: "whatsapp", kundeText: kundeFrei, nummer, quelle: `WhatsApp #\$\{neuesteRein\.id\}`/.test(wq) && wq.includes("...(angabenLage ? [angabenLage.hinweis] : [])"), "WhatsApp: derselbe Weg mit der Nummer, Hinweis");
  ok(/angabenAntwortFunde\(a, pruef\.angaben\)/.test(wq) && /angaben: angabenLage \?/.test(wq) && /angabenLage\.satz/.test(wq), "WhatsApp: harte Prüfung im Entwurf, sicherer Satz");
  ok(/anlass: "vorlegen" as const, grund: `Änderungswunsch:/.test(wq) && /\|\| !!angabenLage\?\.mensch/.test(wq), "WhatsApp: was Mara nie ändert → Karte (vorlegen), Zusage gedeckt");
  ok(/ctx\.angabenServer/.test(wq) && /angabenServer: angabenLage \?/.test(wq), "WhatsApp: angaben_eintragen fasst die bearbeiteten Felder nicht noch einmal an");
  const ag = ohneKommentare(q("server/lib/fiaon-mara-angaben-aendern.ts"));
  ok(/updateCustomerContact\(g\.ref, body/.test(ag) && /updateCustomerContact\(g\.ref, \{ phone:/.test(ag) && /updateCustomerContact\(g\.ref, \{ email: String\(z\.nachher\) \}/.test(ag),
    "ein Speicherweg: updateCustomerContact (Anschrift, Telefon, E-Mail erst beim Bestätigen)");
  ok(!/UPDATE\s+fiaon_applications\s+SET\s+(?:email|phone|street|zip|city|first_name|last_name|birthdate)/i.test(ag) && !/UPDATE\s+fiaon_persons\s+SET\s+(?:primary_email|primary_phone|street|zip|city|first_name|last_name)/i.test(ag),
    "kein eigener Schreibweg für E-Mail, Telefon, Anschrift oder Namen (nur das Land, das der Speicherweg nicht kennt)");
  ok(/istGlobalKunde/.test(ag) && /g\.test/.test(ag) && /mailGleich\(m, absender\)/.test(ag) && /waNummerGleich\(ein\.nummer, n, /.test(ag), "Global → nichts; Testperson → probe; Absender gegen die gespeicherten Adressen/Nummern");
  ok(/timingSafeEqual/.test(ag) && /createHmac\("sha256"/.test(ag) && /ablauf_am/.test(ag) && /stand = 'bestaetigt', bestaetigt_am = NOW\(\)[\s\S]{0,120}stand = 'link_geschickt' AND bestaetigt_am IS NULL/.test(ag),
    "Einmal-Link: HMAC, Ablauf, zeitkonstant verglichen, genau einmal beansprucht");
  const rt = ohneKommentare(q("server/routes/fiaon-angaben.ts"));
  const get = rt.slice(rt.indexOf('router.get("/angaben/email/:token"'), rt.indexOf('router.post("/angaben/email/:token"'));
  ok(/emailLinkPruefen\(/.test(get) && !/emailBestaetigen\(/.test(get) && /<form method="post">/.test(rt) && /emailBestaetigen\(/.test(rt.slice(rt.indexOf("router.post"))),
    "Route: GET zeigt nur den Knopf (Link-Vorschauen ändern nichts), POST bestätigt");
  ok(/fiaon-angaben'\)\)\.default/.test(q("server/routes.ts")), "Route eingehängt (/api/fiaon/angaben/email/:token)");

  abschnitt("11 · WhatsApp-Entwurf (entwerfen, Modell-Attrappe): die Wand hält jedes falsche „geändert“");
  {
    const mara = await import("../server/lib/fiaon-whatsapp-mara");
    const LW = lage([A, M], { kanal: "whatsapp" });
    const ew = () => mara.entwerfen("SYSTEM (Prüfstand)", { kunde: "Neue Adresse Neuweg 2, 54321 Neustadt, neue Mail neu@beispiel.de", letzteDu: [], verkaufen: false, angaben: LW }, null);
    ANTWORTEN.length = 0; ANTWORTEN.push("Erledigt, Ihre neue E-Mail-Adresse ist gespeichert.", "Erledigt, Ihre neue E-Mail-Adresse ist gespeichert.");
    const w1 = await ew();
    ok(w1.funde.some((x) => /E-Mail-Adresse sei geändert/.test(x)), "beide Entwürfe „E-Mail gespeichert“ → harter Mangel (maraAntwortet nimmt dann den sicheren Satz)", w1.funde);
    ANTWORTEN.length = 0; ANTWORTEN.push("Erledigt, alles geändert!", `Danke! ${angabenSatz(LW)}`);
    const w2 = await ew();
    ok(w2.zweiter && w2.antwort === `Danke! ${angabenSatz(LW)}` && !w2.funde.length, "„alles geändert“ → zweiter Entwurf mit dem richtigen Satz geht", { antwort: w2.antwort, funde: w2.funde });
    ok(netz === 0 && modellRufe === 4, `kein Netz außer der Attrappe (${netz}), vier Modellrufe (${modellRufe})`);
  }

  console.log(`\n${schlecht ? "✗" : "✓"} ${gut}/${gut + schlecht} Prüfungen bestanden (offline)`);
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
