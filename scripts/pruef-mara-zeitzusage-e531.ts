// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: KEINE ZEIT-ZUSAGEN — NACHBESSERUNG 2 UND 3 (E-531, 25.11.2026)
//
// Die Abnahme-Gegenprüfung fand an der Zeit-Wand (maraZeitZusage, server/lib/fiaon-postmeister-werkzeuge.ts) drei Dinge:
//   wa#1     Häufige Zusagen kamen durch: Futur („Wir werden uns zeitnah melden“), Umstellung („Gern rufen wir Sie heute
//            zurück“), Nebensatz („…, damit sich jemand zeitnah meldet“), Datum, Uhrzeit, Spannen, „bald“, Englisch ohne
//            „you“, Türkisch „en kısa sürede“, andere Sprachen gar nicht.
//   wa#2     Antworten auf dem Terminlink-Weg wurden angehalten („Sie hatten heute um einen Rückruf gebeten – wählen Sie …“),
//            „wie vereinbart“ und „dann“ nach dem Termin-Satz zählten nicht.
//   senden#3/wa#8  Der Kalender deckte zu viel: dieselbe Uhrzeit an einem anderen Tag, „Termin“ allein, ein ganzer Satz
//            samt zweiter Zusage.
// Nachbesserung 3 (Abnahme-Prüfung der Nachbesserung 2):
//   (1) Die Ausnahme „sein Wunsch“ gab UNSERE Zusagen frei („Sie werden morgen wie gewünscht zurückgerufen.“) — jetzt feste
//       Liste plus Sperre; die 25 Sätze, die die alte Wand fing und Nachbesserung 2 freigab, sind Pflicht-Treffer (3b).
//   (2) „wie vereinbart“/„dann“ nie mit einer Stelle; „dann“ nur nach Kalendertext oder Tag UND Uhrzeit; Tageszeit (4b).
//   (3) wa#8-Rest: eine zweite Zusage OHNE Zeit im Satz mit dem Termin ist ein Treffer (4c).
//   (4) Falsche Treffer: Beträge, „bis bald“, „by e-mail“, „…, melden Sie sich bitte heute“, „nicht auf Sie zu“ (2b).
//   (5) Eile unter einer Bedingung nur ohne weitere Zeit im Satz (1c).  (6) Restlücken (1b).  (7) Sendewand ohne Fantasie-Feld.
// Geprüft in BEIDE Richtungen (Zusage erkannt, harmloser Satz frei), ohne Netz und ohne Datenbank, alle Sätze erfunden.
// Heute ist hier fest Mittwoch, 25.11.2026 (morgen = Donnerstag 26.11., „am Montag“ = 30.11.).
//
//   env -i PATH="$PATH" HOME="$HOME" TZ=Europe/Berlin CRONS=aus DATABASE_URL="postgresql://vorschau:vorschau@127.0.0.1:1/vorschau" \
//     ./node_modules/.bin/tsx scripts/pruef-mara-zeitzusage-e531.ts
// ═══════════════════════════════════════════════════════════════════════════
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID", "META_SYSTEM_TOKEN",
  "OPENAI_API_KEY", "GOOGLE_SA_KEY", "GMAIL_CLIENT_SECRET", "RESEND_API_KEY", "TWILIO_AUTH_TOKEN", "VAPID_PRIVATE_KEY", "DATABASE_URL_EXTERN"]) {
  if (process.env[k]) { console.error(`${k} ist gesetzt — Abbruch, der Prüfstand darf nichts versenden.`); process.exit(3); }
}
process.env.DATABASE_URL = "postgresql://nobody@127.0.0.1:1/none";
process.env.CRONS = "aus";
process.env.SESSION_SECRET ||= "pruefstand-nur-lokal";

// ── Kein Netz: jeder Aufruf wird mitgeschrieben und scheitert ─────────────
const FREMD: string[] = [];
globalThis.fetch = (async (eingabe: any) => {
  const u = String(typeof eingabe === "string" ? eingabe : eingabe?.url ?? eingabe);
  FREMD.push(u);
  throw new Error(`Prüfstand: kein Netz (${u})`);
}) as typeof fetch;

let geprueft = 0, fehler = 0;
function ok(bed: unknown, text: string, zeigen?: unknown) {
  geprueft++;
  if (bed) console.log(`  ✓ ${text}`);
  else { fehler++; console.log(`  ✗ ${text}${zeigen !== undefined ? `\n      → ${JSON.stringify(zeigen).slice(0, 400)}` : ""}`); }
}
const abschnitt = (t: string) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 70 - t.length))}`);

const wz = await import("../server/lib/fiaon-postmeister-werkzeuge");
const ton = await import("../shared/fiaon-mara-ton");
const { KARTE_ZEIT_SATZ } = await import("../shared/fiaon-karten-weg");

/** Fest: Mittwoch, 25.11.2026, 11 Uhr Berliner Zeit. */
const JETZT = new Date("2026-11-25T10:00:00Z");
const zz = (t: string, kalender?: string[]) => wz.maraZeitZusage(t, kalender ? { kalender, jetzt: JETZT } : { jetzt: JETZT });
/** So schreibt der Kalender den Termin (dieselbe Funktion wie bestehenderTermin/aufgabe_an_betreuer). */
const kt = (iso: string) => ton.zeitFuerKunde(new Date(iso), JETZT);
const MORGEN_10 = kt("2026-11-26T09:00:00Z");
const HEUTE_15 = kt("2026-11-25T14:00:00Z");
const MONTAG_10 = kt("2026-11-30T09:00:00Z");
const FREITAG_LANG = kt("2026-12-04T09:00:00Z");

// ═══ 0 · DER KALENDERTEXT ═════════════════════════════════════════════════
abschnitt("0 · Kalendertexte wie aus zeitFuerKunde");
ok(MORGEN_10 === "morgen um 10 Uhr" && HEUTE_15 === "heute um 15 Uhr" && MONTAG_10 === "am Montag um 10 Uhr" && FREITAG_LANG === "am Freitag, 4. Dezember, um 10 Uhr",
  `zeitFuerKunde liefert die erwarteten Texte (${MORGEN_10} · ${HEUTE_15} · ${MONTAG_10} · ${FREITAG_LANG})`);

// ═══ 1 · wa#1: ZUSAGEN, DIE JETZT ERKANNT WERDEN ══════════════════════════
abschnitt("1 · wa#1 — Zusagen werden erkannt (vorher frei)");
for (const t of [
  // Die Sätze der Gegenprüfung
  "Wir werden uns zeitnah bei Ihnen melden.",
  "Wir werden uns schnellstmöglich bei Ihnen melden.",
  "Ich werde mich morgen bei Ihnen melden.",
  "Wir kommen heute noch auf Sie zurück.",
  "Wir geben Ihnen bis Freitag Bescheid.",
  "Gern rufen wir Sie heute noch zurück.",
  "Wir rufen Sie um 15 Uhr an.",
  "Wir melden uns am 30.11. bei Ihnen.",
  "Sie erhalten innerhalb von 1–2 Werktagen eine Rückmeldung.",
  "Sie erhalten heute noch eine E-Mail von unserer Buchhaltung.",
  "We will be in touch shortly.",
  "You will receive a response within 24 hours.",
  "En kısa sürede size dönüş yapacağız.",
  "Wir werden uns morgen bei Ihnen melden.",
  "Wir melden uns bald bei Ihnen.",
  "Wir melden uns so schnell wie möglich bei Ihnen.",
  "Wir melden uns nächsten Montag bei Ihnen.",
  "Wir melden uns in 2-3 Tagen bei Ihnen.",
  "Wir melden uns innerhalb von 1–2 Werktagen bei Ihnen.",
  "Wir antworten Ihnen morgen.",
  "Wir kommen morgen auf Sie zu.",
  "We will reach out shortly.",
  "Our team will reach out tomorrow.",
  "We will be in touch tomorrow.",
  "You will get a reply within 1-2 business days.",
  "Wir informieren Sie morgen.",
  "Wir werden Ihnen morgen Bescheid geben.",
  "Unsere Kollegen werden sich morgen bei Ihnen melden.",
  "Ich habe veranlasst, dass sich Herr Muster heute bei Ihnen meldet.",
  "Ich leite Ihren Rückrufwunsch weiter, damit sich jemand zeitnah bei Ihnen meldet.",
  "Wir melden uns am 1. Dezember bei Ihnen.",
  "Wir rufen Sie am 30.11. an.",
  "Herr Muster hat den Auftrag dazu bekommen und meldet sich am 07.12.2026 bei Ihnen.",
  // Darüber hinaus (E-531 Nachbesserung 2): Uhrzeit-Fenster, Wochentag allein, Feiertage, „meldet er sich“, Umstellung
  "Herr Muster ruft Sie zwischen 14 und 16 Uhr an.",
  "Wir melden uns Montag bei Ihnen.",
  "Wir melden uns nach den Feiertagen bei Ihnen.",
  "Dann meldet er sich heute noch bei Ihnen.",
  "Er ruft Sie morgen früh an.",
  "Dann ruft Herr Muster Sie an.",
  "Morgen ruft Sie Ihr Betreuer zurück.",
  "Dann meldet sich unsere Leitung bei Ihnen.",
  "Frau Beispiel ist Ihre feste Ansprechpartnerin und meldet sich telefonisch zu den offenen Punkten.",
  "Rufen Sie uns gern an, sonst melden wir uns morgen bei Ihnen.",
  "Sie bekommen demnächst eine Nachricht von uns.",
  "Someone from our team will contact you on Monday.",
  // Andere Sprachen (nur Futur-Zusagen, nie die Bitte an ihn)
  "Nasz doradca zadzwoni do Pana jutro.",
  "Мы свяжемся с вами завтра.",
  "Le llamaremos mañana.",
  "La contatteremo domani.",
  "Vă vom contacta mâine.",
  "Ozveme sa Vám zajtra.",
  "Nous vous rappellerons demain.",
  "Javit ćemo vam se sutra.",
  "Entraremos em contacto amanhã.",
  "Danışmanınız 24 saat içinde size dönüş yapacak.",
]) ok(zz(t).length > 0, `Treffer: „${t}“`);

// ═══ 1b · NACHBESSERUNG 3 (6): RESTLÜCKEN ═════════════════════════════════
abschnitt("1b · Nachbesserung 3 — Restlücken (vorher frei)");
for (const t of [
  // „(ich) rufe Sie … an“
  "Ich rufe Sie morgen an.",
  "Ich rufe Sie heute noch zurück.",
  // Das Nachricht-Wort vor „erhalten Sie“
  "Eine Rückmeldung erhalten Sie morgen.",
  "Eine Antwort von uns bekommen Sie spätestens am Freitag.",
  // „folgt/kommt/erfolgt + Zeit“ mit einem Nachricht-Wort
  "Die Antwort folgt morgen.",
  "Eine Rückmeldung folgt bis Freitag.",
  "Die Nachricht kommt morgen.",
  "Morgen folgt die Antwort.",
  "Die schriftliche Rückmeldung kommt heute.",
  "Die Rückmeldung erfolgt innerhalb von 2 Werktagen.",
  // „Zeit + hören Sie von uns“
  "Morgen hören Sie von uns.",
  "Von uns hören Sie morgen.",
  "Spätestens am Freitag hören Sie von uns.",
  // umgestellt: „Morgen werden Sie angerufen“
  "Morgen werden Sie wie gewünscht angerufen.",
  "Heute noch werden Sie zurückgerufen.",
]) ok(zz(t).length > 0, `Treffer: „${t}“`);
for (const t of [
  // Gegenproben: SEINE Nachricht, kein Nachricht-Wort, keine Zeit
  "Eine Antwort von Ihnen kommt hoffentlich bald.",
  "Wir freuen uns, wenn Ihre Rückmeldung bald kommt.",
  "Danke für Ihre Nachricht von heute, wir kommen gern darauf zurück.",
  "Ihre Nachricht ist heute bei uns angekommen.",
  "Die Antwort auf Ihre Frage folgt hier:",
  "Die schriftliche Bestätigung kommt gleich per E-Mail.",
  "Eine Antwort auf Ihre Frage erhalten Sie hier:",
  "Von uns hören Sie nur Gutes.",
  "Ich rufe Sie nicht an, Sie bekommen alles schriftlich.",
]) ok(zz(t).length === 0, `kein Treffer: „${t}“`, zz(t)[0]);

// ═══ 1c · NACHBESSERUNG 3 (5): EILE UNTER BEDINGUNG NUR OHNE WEITERE ZEIT ═══
abschnitt("1c · Nachbesserung 3 — „umgehend, sobald …“ nur ohne weitere Zeit im Satz");
for (const t of [
  "Wir melden uns umgehend, sobald die Prüfung erledigt ist, spätestens aber am Freitag.",
  "Wir melden uns umgehend, sobald die Zahlung eingegangen ist; die Leitung ruft Sie zeitnah an.",
]) ok(zz(t).length > 0, `Treffer (weitere Zeit im Satz): „${t}“`);
for (const t of [
  "Wir melden uns umgehend, sobald die Prüfung erledigt ist.",
  "Wir melden uns umgehend, sobald Ihre Zahlung bis Freitag eingegangen ist.",
  "Wir melden uns umgehend, sobald Ihre Zahlung über 99 € eingegangen ist.",
  "Sobald die Zahlung da ist, melden wir uns umgehend und schalten alles frei.",
]) ok(zz(t).length === 0, `kein Treffer (die Eile hängt an der Bedingung): „${t}“`, zz(t)[0]);

// ═══ 2 · HARMLOSE SÄTZE BLEIBEN FREI ══════════════════════════════════════
abschnitt("2 · Harmlose Sätze bleiben frei");
for (const t of [
  // Vorgabe der Gegenprüfung
  "Die Widerrufsfrist beträgt 14 Tage.",
  "Sobald Ihre Zahlung eingegangen ist, schaltet das System Sie frei.",
  "Sie erhalten eine Bestätigung per E-Mail.",
  "Bitte melden Sie sich bis Freitag bei uns.",
  "Wir haben Ihnen am 24.11. geschrieben.",
  "Ihr Vertrag läuft bis zum 31.12.2026.",
  "Unsere Öffnungszeiten: Mo–Fr 9–18 Uhr.",
  // Die erlaubten Sätze aus dem Auftrag an Mara und den festen Bausteinen
  "Die schriftliche Bestätigung bekommen Sie gleich per E-Mail.",
  "Ihre Kündigung ist verarbeitet; die schriftliche Bestätigung bekommen Sie gleich separat per E-Mail.",
  wz.E531_UEBERGABE_SATZ,
  `${ton.NACH_DEM_EINGANG_SATZ}.`,
  `${ton.nachDemEingang({ anfang: true, ziel: { art: "wunsch", euro: 5000 } })}.`,
  `${ton.nachDerZuordnung({ anfang: true, betrag: "99 €", ziel: { art: "paket", euro: 2500 } })}.`,
  KARTE_ZEIT_SATZ,
  "Ihr Rückrufwunsch liegt jetzt bei unserem Team.",
  "Unsere digitale Mitarbeiterin ARAS – eine KI – kann Sie morgen zwischen 14 und 16 Uhr anrufen. Passt Ihnen das?",
  // Gegenproben gegen zu breite Regeln (Kontaktwort + irgendeine Zeit)
  "Werden Sie sich heute noch bei uns melden?",
  "Bitte geben Sie uns bis Freitag Bescheid.",
  "Sie erreichen uns Montag bis Freitag von 9 bis 18 Uhr.",
  "Die Rate ist erst am 01.12. fällig.",
  "Ihre Kündigung gilt zum 30.11.2026.",
  "Wir melden uns so schnell wie möglich, sobald Ihre Zahlung eingegangen ist.",
  "Sobald wir Neuigkeiten haben, informieren wir Sie umgehend.",
  "Ich freue mich, wenn es für Sie bald losgeht.",
  "Wir freuen uns, bald von Ihnen zu hören.",
  "Danke für Ihre schnelle Antwort von heute.",
  "Danke für Ihren Anruf heute Morgen.",
  "Ihr Rückrufwunsch von heute ist notiert.",
  "Wenn Sie Fragen haben, rufen Sie uns gern heute noch an.",
  "Wenn es Ihnen passt, rufen Sie gern morgen an.",
  "Es ist wichtig, dass Sie sich heute noch melden.",
  "Danke, dass Sie sich heute gemeldet haben.",
  "Wenn Sie mögen, antworten Sie mir heute noch kurz.",
  "Damit Sie schnellstmöglich starten können, laden Sie bitte die Unterlagen hoch.",
  "Bitte laden Sie die fehlenden Unterlagen zeitnah hoch, damit wir den Prozess weiterführen können.",
  "Der Anmelde-Link kommt sofort an Ihre hinterlegte E-Mail-Adresse.",
  "Sie bekommen nach der Buchung sofort eine Bestätigung per E-Mail.",
  "Die Karte ist nach der Zusage der Bank in der Regel bald bei Ihnen.",
  "Über den Knopf unten haben Sie alles sofort zur Hand — am besten überweisen Sie gleich heute.",
  "Schaffen Sie die Überweisung heute noch?",
  "Es tut mir leid, dass sich gestern niemand gemeldet hat.",
  "Der Rückruf heute hat leider nicht geklappt, das tut mir leid.",
  "Der Rückruf am 23.11. hat leider nicht stattgefunden.",
  "Die Bank ruft Sie nicht an.",
  "Bis bald!",
  // Andere Sprachen: Bitte an ihn ist keine Zusage
  "Puede llamarnos hoy.",
  "Proszę do nas zadzwonić dzisiaj.",
  "Позвоните нам сегодня.",
  "",
]) ok(zz(t).length === 0, `kein Treffer: „${t || "(leer)"}“`, zz(t)[0]);

// ═══ 2b · NACHBESSERUNG 3 (4): FALSCHE TREFFER DER PRÜFUNG ════════════════
abschnitt("2b · Nachbesserung 3 — falsche Treffer der Prüfung sind frei");
for (const t of [
  // Beträge mit Tausenderpunkt sind kein Datum (nach der zweiten Zahl keine Ziffer)
  "Sie erhalten eine Rückmeldung zu Ihrem Wunschlimit bis 10.000 €.",
  "Wir melden uns mit einem Angebot ab 2.500 € bei Ihnen.",
  "Die Zahlung ist bis 10.000 € möglich.",
  // „bis bald“ ist ein Gruß
  "Wir melden uns dann wieder – bis bald!",
  "Ich melde mich wieder, bis bald!",
  "Wir melden uns bei Ihnen, bis bald!",
  // englisch „by e-mail“ ohne Absender — das Gegenstück zum erlaubten deutschen Kündigungs-Satz
  "You will receive the written confirmation by e-mail shortly.",
  // „…, melden Sie sich bitte heute“ ist die Bitte an ihn
  "Damit die Zahlung bis Freitag eingeht, melden Sie sich bitte heute noch bei Ihrer Bank.",
  "Damit Ihre Unterlagen bis Freitag vollständig sind, melden Sie sich bitte heute noch bei uns.",
  // verneint: „… nicht auf Sie zu“
  "Weitere Kosten kommen bis zum 31.12. nicht auf Sie zu.",
  "Ab 01.12. kommen keine Kosten mehr auf Sie zu.",
  "Ab Januar kommt nichts mehr auf Sie zu.",
]) ok(zz(t).length === 0, `kein Treffer: „${t}“`, zz(t)[0]);
for (const t of [
  // Gegenproben: dieselben Formen als echte Zusage bleiben Treffer
  "Wir melden uns bis zum 1.12. bei Ihnen.",
  "Wir melden uns am 30.11.2026 bei Ihnen.",
  "Wir melden uns bald bei Ihnen.",
  "You will receive an e-mail from our team tomorrow.",
  "You will receive an update by e-mail shortly.",
  "Ich habe veranlasst, dass sich Herr Muster heute bei Ihnen meldet.",
  "Wir kommen heute noch auf Sie zu, damit keine Fristen verstreichen.",
  "Wir kommen nicht erst morgen auf Sie zu, sondern heute.",
]) ok(zz(t).length > 0, `Treffer: „${t}“`);
// Bewusst streng gelassen (im Zweifel Entwurf statt Versand; in echten Antworten 0-mal): „heute“ kann hier auch „im Lauf
// des Tages“ heißen, „melden uns dann“ ist eine Zusage ohne klare Zeit, „Ruft Sie … an“ als Bedingung kann eine Zusage
// verstecken („Ruft Sie Herr X nicht an, …“). Diese Sätze werden ein Entwurf — das ist eine Entscheidung, kein Versehen.
for (const t of [
  "Gerne informieren wir Sie heute über die nächsten Schritte.",
  "Wir sind bis 18 Uhr erreichbar und melden uns dann.",
  "Ruft Sie jemand an und gibt sich als FIAON aus, legen Sie bitte auf.",
]) ok(zz(t).length > 0, `Bewusst streng → Treffer (Entwurf): „${t}“`);

// ═══ 3 · wa#2: SEIN WUNSCH, SEINE BUCHUNG (Terminlink-Weg) ════════════════
abschnitt("3 · wa#2 — Terminlink-Weg frei, unsere Zusagen bleiben Treffer");
const LINK = "https://fiaon.com/termin/abc123";
for (const t of [
  `Sie hatten heute um einen Rückruf gebeten. Wählen Sie hier gern eine Zeit, die Ihnen passt: ${LINK}`,
  `Ihren Rückruf für morgen Vormittag können Sie hier direkt eintragen: ${LINK}`,
  "Sie möchten heute zurückgerufen werden – hier können Sie direkt eine Zeit wählen.",
  "Den Rückruf für morgen haben Sie abgesagt.",
  `Sie haben um einen Rückruf am Montag gebeten – buchen Sie dafür bitte hier einen Termin: ${LINK}`,
  "Möchten Sie morgen angerufen werden?",
  "Sie hatten am 2. September schon um Rückruf gebeten.",
  "Sie hatten am Sonntag wegen eines Trauerfalls schon um den Rückruf gebeten, das habe ich weitergegeben.",
  "Sie hatten am 01.12. um einen Rückruf gebeten.",
]) ok(zz(t).length === 0, `frei (sein Wunsch / seine Buchung): „${t}“`, zz(t)[0]);
// Bewusst streng (im Zweifel Entwurf): Steht im Satz noch eine Zeit außerhalb seines Wunschs, gilt die Ausnahme nicht —
// „…, das erfolgt heute noch“ hätte sonst kein Muster. Das trifft auch harmlose Mischsätze; die Antwort wird ein Entwurf.
ok(zz("Sie hatten heute um einen Rückruf gebeten, die Rate ist erst am 01.12. fällig.").length > 0,
  "Bewusst streng: sein Wunsch + eine weitere Zeit im selben Satz → Treffer (Entwurf statt Versand)");
for (const t of [
  "Wie gewünscht erfolgt der Rückruf heute.",
  "Wie Sie gebeten haben, erfolgt der Rückruf heute um 15 Uhr.",
  "Sie haben um einen Rückruf gebeten — der Rückruf erfolgt heute.",
  "Sie möchten heute zurückgerufen werden – das erfolgt heute noch.",
  "Sie hatten um einen Rückruf gebeten; Herr Muster ruft Sie morgen an.",
  "Wir buchen Sie für morgen um 10 Uhr für den Rückruf ein.",
  "Wir haben Sie für den Rückruf morgen gebucht.",
  "Sie werden morgen angerufen.",
  "Ihr Rückruf ist für morgen eingetragen.",
]) ok(zz(t).length > 0, `Treffer (unsere Zusage): „${t}“`);

// ═══ 3b · NACHBESSERUNG 3 (1): „SEIN WUNSCH“ NUR AUS DER FESTEN LISTE ═════
abschnitt("3b · Nachbesserung 3 — unsere Zusagen mit „gewünscht/für Sie“ sind wieder Treffer");
// Diese Sätze fing die alte Wand (Stand vor Nachbesserung 2); die Wunsch-Ausnahme von Nachbesserung 2 gab sie frei, weil
// „Sie“ und „gewünscht/eingetragen“ irgendwo im Satzteil standen. „Sie“ ist hier aber nicht der Wünschende, sondern der,
// mit dem WIR etwas tun (Objekt, Passiv, Empfang). Ermittelt durch Vergleich alte Wand gegen Nachbesserung 2, ohne Kalender:
// die 19 Sätze der Prüfung und 6 weitere derselben Art. Alle sind Pflicht-Treffer.
const ALTE_TREFFER = [
  // die 19 der Prüfung
  "Sie werden morgen wie gewünscht zurückgerufen.",
  "Sie werden wie gewünscht morgen um 10 Uhr angerufen.",
  "Sie werden wie gewünscht morgen von Herrn Muster angerufen.",
  "Sie werden wie angefragt morgen angerufen.",
  "Den Rückruf erhalten Sie heute wie gewünscht.",
  "Den Rückruf bekommen Sie wie gewünscht morgen.",
  "Der Rückruf erfolgt morgen wie Sie möchten.",
  "Wir haben für Sie morgen um 10 Uhr einen Rückruf eingetragen.",
  "Ich habe für Sie morgen einen Rückruf eingetragen.",
  "Den Rückruf morgen um 10 Uhr haben wir für Sie gebucht.",
  "Unser Team hat Sie für morgen zum Rückruf eingetragen.",
  "Frau Beispiel hat Sie für morgen zum Rückruf eingetragen.",
  "Sie sind für morgen um 10 Uhr für einen Rückruf eingetragen.",
  "Sie wurden für einen Rückruf morgen um 10 Uhr eingetragen.",
  "Sie stehen für morgen um 10 Uhr für den Rückruf eingetragen.",
  "Wie gewünscht haben wir für Sie den Rückruf morgen um 10 Uhr eingetragen.",
  "Einen Anruf von Herrn Muster bekommen Sie morgen wie gewünscht.",
  "Gern, Sie werden heute noch wie gewünscht zurückgerufen.",
  "Ich habe den Rückruf für morgen für Sie eingetragen.",
  // 6 weitere derselben Art
  "Ich habe den Rückruf für Sie für morgen um 10 Uhr eingetragen.",
  "Der Rückruf ist für Sie morgen um 10 Uhr eingetragen.",
  "Für Sie ist morgen ein Rückruf eingetragen.",
  "Sie sind morgen für den Rückruf eingetragen.",
  "Sie wurden heute für den Rückruf gebucht.",
  "Ihr Betreuer hat den Rückruf für Sie auf morgen eingetragen.",
];
ok(ALTE_TREFFER.length === 25, `25 Pflicht-Sätze aus dem Vergleich (${ALTE_TREFFER.length})`);
for (const t of ALTE_TREFFER) ok(zz(t).length > 0, `Treffer (alte Wand fing ihn, Nachbesserung 2 nicht): „${t}“`);
for (const t of [
  // Die Sperre gewinnt: andere Leute, Herr/Frau X, „für Sie“, „wie Sie es wünschten“ im Satzteil
  "Die Kollegen haben Sie für morgen zum Rückruf eingetragen.",
  "Herr Muster und Frau Beispiel haben Sie für morgen zum Rückruf eingetragen.",
  "Die Kollegen können Sie für morgen zum Rückruf eintragen.",
  "Die Kollegen tragen Sie morgen für den Rückruf ein.",
  "Sie hatten Frau Beispiel um einen Rückruf heute gebeten.",
  "Den Rückruf für morgen haben wir für Sie eingetragen, wie Sie es wünschten.",
  "So wie Sie es möchten, erfolgt der Rückruf morgen.",
  // „eingetragen/gebucht“ stehen bewusst nicht in der Liste: „Sie“ kann auch „die Kollegen“ sein — hat ER gebucht,
  // steht der Termin im Kalender und deckt den Satz dort (Abschnitt 4).
  "Sie haben den Rückruf für morgen eingetragen.",
  "Die Kollegen sind informiert. Sie haben den Rückruf für morgen eingetragen.",
]) ok(zz(t).length > 0, `Treffer (Sperre / nicht in der Liste): „${t}“`);
for (const t of [
  // weitere Formen SEINES Wunschs bleiben frei
  "Wir haben Ihren Wunsch notiert: Sie möchten morgen zurückgerufen werden.",
  `Bitte buchen Sie Ihren Rückruf für morgen hier: ${LINK}`,
  `Wählen Sie für Ihren Rückruf morgen hier eine Zeit: ${LINK}`,
  `Hier können Sie sich für einen Rückruf morgen eintragen: ${LINK}`,
  "Über diesen Link können Sie Ihren Rückruf für morgen selbst buchen.",
  "Wann möchten Sie morgen angerufen werden?",
  "Gern, möchten Sie morgen zurückgerufen werden?",
  "Den Rückruf für heute haben Sie storniert.",
  "Sie baten heute um einen Rückruf.",
  "Sie hatten uns heute um einen Rückruf gebeten.",
  "Sie hatten heute um einen Rückruf gebeten – bis bald!",
  "Den Rückruf für morgen haben Sie abgesagt, er erfolgt also nicht.",
]) ok(zz(t).length === 0, `frei (sein Wunsch): „${t}“`, zz(t)[0]);
ok(zz("Sie hatten um einen Rückruf gebeten, der morgen erfolgen soll.").length > 0,
  "Sein Wunsch + „der morgen erfolgen soll“ (Zeit im Rest des Satzes) → Treffer");
ok(zz("Herr Muster ruft Sie morgen um 10 Uhr an.", [MORGEN_10]).length === 0 && zz("Sie haben den Rückruf für morgen um 10 Uhr gebucht.", [MORGEN_10]).length === 0,
  "Seine echte Buchung deckt der Kalender (nicht die Wunsch-Liste)");

// ═══ 4 · KALENDER-DECKUNG (senden#3, wa#8, wa#2) ══════════════════════════
abschnitt("4 · Kalender — Uhrzeit nur am richtigen Tag, Rest des Satzes, „wie vereinbart“, „dann“");
const fall = (t: string, kalender: string[] | undefined, treffer: boolean, warum: string) =>
  ok((zz(t, kalender).length > 0) === treffer, `${treffer ? "Treffer" : "frei"}: „${t}“ mit ${kalender ? JSON.stringify(kalender) : "ohne Kalender"} — ${warum}`, zz(t, kalender)[0]);
// senden#3 / wa#8: Uhrzeit allein deckt nicht mehr
fall("Herr Muster ruft Sie heute um 10 Uhr an.", [MORGEN_10], true, "heute ≠ morgen (senden#3)");
fall("Herr Muster ruft Sie morgen um 10 Uhr an.", [MORGEN_10], false, "derselbe Tag, dieselbe Uhrzeit");
fall("Herr Muster ruft Sie am Donnerstag um 10 Uhr an.", [MORGEN_10], false, "morgen ist Donnerstag");
fall("Herr Muster ruft Sie am Donnerstag, 26.11., um 10 Uhr an.", [MORGEN_10], false, "Wochentag und Datum passen");
fall("Herr Muster ruft Sie am Freitag um 10 Uhr an.", [MORGEN_10], true, "Freitag ist nicht morgen");
fall("Herr Muster ruft Sie um 10 Uhr an.", [MORGEN_10], true, "ohne Tag heißt heute — der Termin ist morgen");
fall("Wir rufen Sie um 15 Uhr an.", [HEUTE_15], false, "ohne Tag heißt heute — der Termin ist heute um 15 Uhr");
fall("Wir rufen Sie um 15 Uhr an.", [kt("2026-11-25T15:00:00Z")], true, "heute um 16 Uhr ist eine andere Uhrzeit");
fall("Herr Muster ruft Sie morgen um 11 Uhr an.", [MORGEN_10], true, "andere Uhrzeit");
fall("Herr Muster ruft Sie morgen zwischen 10 und 12 Uhr an.", [MORGEN_10], true, "eine zweite Uhrzeit, die der Kalender nicht hat");
fall("Herr Muster ruft Sie am Montag um 10 Uhr an.", [MONTAG_10], false, "„am Montag um 10 Uhr“ (30.11.)");
fall("Herr Muster ruft Sie am Montag, 30.11., um 10 Uhr an.", [MONTAG_10], false, "Montag = 30.11.");
fall("Herr Muster ruft Sie am Dienstag, 1.12., um 10 Uhr an.", [MONTAG_10], true, "anderer Tag");
fall("Ihr Termin ist am Freitag, 04.12., um 10:00 Uhr.", [FREITAG_LANG], false, "kein Zusage-Satz, Datum passt");
fall("Ihr Rückruf ist am Freitag, 4. Dezember, um 10 Uhr eingetragen.", [FREITAG_LANG], false, "der Kalendertext steht wörtlich im Satz");
fall("Der Rückruf steht im Kalender: morgen um 10 Uhr.", [MORGEN_10], false, "der Kalendertext steht wörtlich im Satz");
fall("Der Rückruf steht im Kalender: morgen um 10 Uhr.", undefined, true, "ohne Kalender bleibt es eine Zusage");
fall("Ihr Rückruf ist für morgen eingetragen.", [MORGEN_10], false, "der richtige Tag ohne Uhrzeit");
// wa#8: Rest des Satzes, „Termin“ allein
fall("Ihr Termin am Montag um 10 Uhr steht, und unsere Leitung meldet sich außerdem heute bei Ihnen.", [MONTAG_10], true, "zweite Zusage im selben Satz (wa#8)");
fall("Herr Muster ruft Sie heute um 15 Uhr an und meldet sich heute Abend noch per Mail.", [HEUTE_15], true, "zweite Zusage im selben Satz");
fall("Ihr Rückruf morgen um 10 Uhr steht – bis bald!", [MORGEN_10], false, "„bis bald“ ist keine zweite Zusage");
fall("Herr Muster ruft Sie morgen um 10 Uhr an – heute ist er leider nicht im Haus.", [MORGEN_10], false, "der Rest verspricht nichts");
fall("Ihre Betreuerin meldet sich vor Ihrem Termin noch einmal bei Ihnen.", [MONTAG_10], true, "„vor Ihrem Termin“ ist kein Termin (wa#8)");
fall("Herr Muster ruft Sie zum vereinbarten Termin an.", [MORGEN_10], false, "„zum vereinbarten Termin“ mit echtem Termin");
fall("Herr Muster ruft Sie zum vereinbarten Termin an.", undefined, true, "ohne Kalender hält es niemand");
fall("Herr Muster ruft Sie heute zum Termin an.", [MORGEN_10], true, "„heute“ ist eine andere Zeit");
// wa#2: „wie vereinbart“, „dann“ direkt nach dem Termin-Satz
fall("Herr Muster ruft Sie wie vereinbart an.", [MORGEN_10], false, "„wie vereinbart“ mit echtem Termin");
fall("Herr Muster ruft Sie wie vereinbart an.", undefined, true, "ohne Kalender");
fall("Herr Muster ruft Sie zur vereinbarten Zeit an.", [MORGEN_10], false, "„zur vereinbarten Zeit“ mit echtem Termin");
fall("Ihr Rückruf ist für morgen um 10 Uhr eingetragen. Herr Muster ruft Sie dann an.", [MORGEN_10], false, "„dann“ direkt nach dem Termin-Satz");
fall("Ihr Rückruf ist für morgen um 10 Uhr eingetragen. Herr Muster ruft Sie dann an.", undefined, true, "ohne Kalender beide Sätze");
fall("Ihr Rückruf ist für morgen eingetragen. Herr Muster ruft Sie um 10 Uhr an.", [MORGEN_10], false, "die Uhrzeit gehört zum Tag des Satzes davor");
fall("Ihr Rückruf ist für Freitag, 4. Dezember, um 10 Uhr eingetragen. Herr Muster ruft Sie dann an.", [FREITAG_LANG], false, "„4. Dezember“ beendet keinen Satz");
fall("Ihr Rückruf ist am 04.12. um 10 Uhr eingetragen. Herr Muster ruft Sie dann an.", [FREITAG_LANG], false, "„04.12. um“ beendet keinen Satz");
fall("Herr Muster ruft Sie dann an.", [MORGEN_10], true, "„dann“ ohne Termin-Satz davor");
fall("Danke für Ihre Geduld. Herr Muster ruft Sie dann an.", [MORGEN_10], true, "der Satz davor nennt keinen Termin");
fall("Wie vereinbart ruft Sie Herr Muster am Freitag an.", [MORGEN_10], true, "„wie vereinbart“ mit einer anderen Zeit");
// wa#2: ein Termin nur aus dem Brief der Geschäftsleitung (Fall-Akte, js@) steht nicht im Kalender → bewusst Entwurf
fall("Herr Muster ruft Sie wie zugesagt am Montag um 10 Uhr an.", [], true, "Termin nur im js@-Brief — bewusst Entwurf, ein Mensch gibt frei");
{
  const r = zz("Danke für Ihre Nachricht. Ihr Rückruf ist für morgen um 10 Uhr eingetragen. Herr Muster ruft Sie dann an. Unsere Leitung meldet sich außerdem heute.", [MORGEN_10]);
  ok(r.length === 1 && r[0].satz === "Unsere Leitung meldet sich außerdem heute.", `Ganze Antwort: nur die zusätzliche Zusage ist ein Treffer (${r.map((x) => x.satz).join(" | ")})`);
}

// ═══ 4b · NACHBESSERUNG 3 (2): „WIE VEREINBART“, „DANN“, TAGESZEIT ════════
abschnitt("4b · Nachbesserung 3 — „wie vereinbart“/„dann“ nie mit einer Stelle, „dann“ nur nach Tag UND Uhrzeit, Tageszeit");
// (a) eine Stelle (ZZ_WER) im Satz: Das verspricht jemand anderes als der Termin
fall("Die Geschäftsführung meldet sich wie vereinbart bei Ihnen.", [MONTAG_10], true, "eine Stelle im Satz");
fall("Unsere Leitung meldet sich wie besprochen persönlich bei Ihnen.", [MORGEN_10], true, "eine Stelle im Satz");
fall("Ihr Rückruf ist für morgen um 10 Uhr eingetragen. Ihre Betreuerin ruft Sie dann an.", [MORGEN_10], true, "„dann“ mit einer Stelle — bewusst Entwurf (Herr/Frau X geht)");
// (b) „dann“ nur nach dem Kalendertext oder Tag UND Uhrzeit
fall("Danke für Ihre Nachricht von heute. Herr Muster meldet sich dann bei Ihnen.", [HEUTE_15], true, "der Satz davor nennt nur den Tag");
fall("Morgen ist bei uns viel los. Herr Muster ruft Sie dann an.", [MORGEN_10], true, "der Satz davor nennt nur den Tag");
fall("Ihr Rückruf ist für morgen eingetragen. Herr Muster ruft Sie dann an.", [MORGEN_10], true, "Tag ohne Uhrzeit reicht für „dann“ nicht");
fall("Der Rückruf steht im Kalender: morgen um 10 Uhr. Herr Muster ruft Sie dann an.", [MORGEN_10], false, "der Kalendertext steht im Satz davor");
fall("Ihr Rückruf ist für Donnerstag um 10 Uhr eingetragen. Herr Muster ruft Sie dann an.", [MORGEN_10], false, "Tag UND Uhrzeit im Satz davor");
// … und im selben Satz dieselbe Regel
fall("Ihr Rückruf morgen um 10 Uhr ist eingetragen; Herr Muster ruft Sie dann an.", [MORGEN_10], false, "„dann“ im selben Satz, Kalendertext davor");
fall("Ihr Rückruf ist für morgen eingetragen; Herr Muster ruft Sie dann an.", [MORGEN_10], true, "„dann“ im selben Satz, nur der Tag");
fall("Herr Muster ruft Sie morgen um 10 Uhr an, und dann meldet sich Frau Beispiel.", [MORGEN_10], true, "„dann“ nach einer eigenen Zusage = eine zweite Zusage");
// (c) Tageszeit muss zur Uhrzeit des Termins passen
fall("Herr Muster ruft Sie morgen Abend an.", [MORGEN_10], true, "Abend ≠ 10 Uhr");
fall("Herr Muster ruft Sie heute Abend an.", [HEUTE_15], true, "Abend ≠ 15 Uhr");
fall("Herr Muster ruft Sie wie vereinbart am Abend an.", [MORGEN_10], true, "„wie vereinbart“ mit einer eigenen Tageszeit");
fall("Herr Muster ruft Sie morgen früh an.", [MORGEN_10], false, "früh passt zu 10 Uhr");
fall("Herr Muster ruft Sie am Donnerstagvormittag an.", [MORGEN_10], false, "Donnerstagvormittag passt zu morgen 10 Uhr");
fall("Herr Muster ruft Sie heute Nachmittag um 15 Uhr an.", [HEUTE_15], false, "Nachmittag passt zu 15 Uhr");

// ═══ 4c · NACHBESSERUNG 3 (3): wa#8-REST — ZWEITE ZUSAGE OHNE ZEIT ════════
abschnitt("4c · Nachbesserung 3 — eine zweite Zusage ohne Zeit im Satz mit dem Termin ist ein Treffer");
fall("Herr Muster ruft Sie morgen um 10 Uhr an, und Frau Beispiel meldet sich bei Ihnen.", [MORGEN_10], true, "zweite Zusage ohne Zeit (der Fall der Prüfung)");
fall("Herr Muster ruft Sie morgen um 10 Uhr an und die Geschäftsleitung meldet sich persönlich bei Ihnen.", [MORGEN_10], true, "zweite Zusage ohne Zeit");
fall("Herr Muster ruft Sie morgen an und die Geschäftsleitung meldet sich persönlich bei Ihnen.", [MORGEN_10], true, "Tag ohne Uhrzeit + zweite Zusage");
fall("Frau Beispiel meldet sich bei Ihnen, und Herr Muster ruft Sie morgen um 10 Uhr an.", [MORGEN_10], true, "die zweite Zusage steht vorn");
fall("Ihr Rückruf ist für morgen um 10 Uhr eingetragen, und Frau Beispiel meldet sich vorher bei Ihnen.", [MORGEN_10], true, "zweite Zusage neben dem Termin-Satzteil");
fall("Herr Muster ruft Sie am Donnerstag um 10 Uhr an, und Frau Beispiel meldet sich bei Ihnen.", [MORGEN_10], true, "Tag und Uhrzeit passen, zweite Zusage");
fall("Herr Muster ruft Sie wie vereinbart an, und Frau Beispiel meldet sich bei Ihnen.", [MORGEN_10], true, "auch bei „wie vereinbart“");
fall("Herr Muster ruft Sie an, morgen um 10 Uhr, und Frau Beispiel meldet sich auch.", [MORGEN_10], true, "Termin allein + zwei Zusagen");
fall("Ihr Termin am Montag um 10 Uhr steht, und unsere Leitung meldet sich außerdem bei Ihnen.", [MONTAG_10], true, "zweite Zusage einer Stelle");
// frei bleibt: Der Termin gehört zu genau EINER Zusage
fall("Herr Muster ruft Sie an, morgen um 10 Uhr.", [MORGEN_10], false, "der Termin steht allein in seinem Satzteil");
fall("Herr Muster ruft Sie, wie besprochen, morgen um 10 Uhr an.", [MORGEN_10], false, "Einschub zwischen Kommas");
fall("Herr Muster ruft Sie an – und zwar morgen um 10 Uhr.", [MORGEN_10], false, "„und zwar“ + Termin");
fall("Ihr Berater, Herr Muster, ruft Sie morgen um 10 Uhr an.", [MORGEN_10], false, "Beisatz zwischen Kommas");
fall("Herr Muster ruft Sie morgen um 10 Uhr an, wie besprochen.", [MORGEN_10], false, "„wie besprochen“ hinten");
fall("Herr Muster ruft Sie morgen um 10 Uhr an und bespricht mit Ihnen die nächsten Schritte.", [MORGEN_10], false, "kein zweites Versprechen");
// die Sätze aus dem Werkzeug-Ergebnis (aufgabe_an_betreuer), wie Mara sie übernimmt
fall("Der Rückruf steht im Kalender: morgen um 10 Uhr ruft Herr Muster an.", [MORGEN_10], false, "Werkzeug-Satz mit Person");
fall("Herr Muster meldet sich zum eingetragenen Termin: morgen um 10 Uhr.", [MORGEN_10], false, "Werkzeug-Satz „meldet sich zum eingetragenen Termin“");
fall("Es steht schon ein Termin: Herr Muster ruft Sie morgen um 10 Uhr an.", [MORGEN_10], false, "Werkzeug-Satz „Es steht schon ein Termin“");
// bewusst streng: der Termin-Satzteil sagt selbst etwas, daneben eine Zusage ohne „dann“ → Entwurf
fall("Ihr Rückruf ist für morgen um 10 Uhr eingetragen, Herr Muster ruft Sie an.", [MORGEN_10], true, "bewusst streng: ohne „dann“ zwei Aussagen → Entwurf");

// ═══ 5 · GANZE ANTWORTEN ══════════════════════════════════════════════════
abschnitt("5 · Ganze Antworten (Anrede, Kern, Knopf, Gruß)");
{
  const terminweg = `Guten Morgen Herr Muster,\n\nvielen Dank für Ihre Nachricht. Sie hatten heute um einen Rückruf gebeten — wählen Sie hier gern eine Zeit, die Ihnen passt: ${LINK}\n\nTermin wählen: ${LINK}\n\nFreundliche Grüße\nMara\nFIAON Welcome-Team`;
  ok(zz(terminweg).length === 0, "Antwort mit Terminlink auf seinen Rückrufwunsch → kein Treffer", zz(terminweg)[0]);
  const zusage = `Guten Tag Frau Beispiel,\n\nvielen Dank für Ihre Geduld. Wir werden uns zeitnah bei Ihnen melden. Die Rate ist erst am 01.12. fällig.\n\nFreundliche Grüße\nMara`;
  const r = zz(zusage);
  ok(r.length === 1 && r[0].satz === "Wir werden uns zeitnah bei Ihnen melden.", `Antwort mit einer Zusage → genau dieser Satz (${r.map((x) => x.satz).join(" | ")})`);
}

// ═══ 6 · ROBUST ═══════════════════════════════════════════════════════════
abschnitt("6 · Robust: nie werfen, nicht langsam");
{
  let wurf = "";
  for (const x of [null, undefined, 0, {}, "   ", "\n\n\n", "https://fiaon.com/a.b.c?x=1"]) {
    try { wz.maraZeitZusage(x as any, { kalender: [null, undefined, "", "x", "morgen um 10 Uhr"] }); } catch (e) { wurf = `${JSON.stringify(x)}: ${String(e)}`; }
  }
  ok(!wurf, `Seltsame Eingaben werfen nie (${wurf || "keine"})`);
  ok(Array.isArray(wz.maraZeitZusage("Wir melden uns morgen.")) && wz.maraZeitZusage("Wir melden uns morgen.").length === 1, "Ohne `jetzt` (wie im Lauf) läuft es mit der echten Uhr");
  const lang = ("Guten Tag. Sie hatten heute um einen Rückruf gebeten. Die Rate ist erst am 01.12. fällig, und wir melden uns, sobald die Bestätigung da ist. ").repeat(150);
  const t0 = Date.now(); const r = zz(lang, [MORGEN_10, HEUTE_15]); const ms = Date.now() - t0;
  ok(r.length === 0 && ms < 4_000, `${lang.length} Zeichen in ${ms} ms, kein Treffer`);
}

// ═══ 7 · DIE SENDEWAND NIMMT DIE NEUE PRÜFUNG ═════════════════════════════
// Ohne Kunde (personId null → kein bestehenderTermin aus der Datenbank) und ohne Adresse: Leere `adressen` setzen die
// Schleifen-Zählung ohne Datenbank auf 0 — die Schleifen-Bremse läuft also mit, lässt aber durch (Nachbesserung 3: das
// frühere Feld „bremseAus“ gab es in e531Sendewand nie; die Ausnahme heißt dort `ausnahme` und wird hier nicht gebraucht).
abschnitt("7 · e531Sendewand (ohne Kunde; leere Adressen → Schleifen-Zählung 0 ohne Datenbank)");
{
  const lauf = await import("../server/lib/fiaon-postmeister-lauf");
  const wand = (text: string, kalender: string[] = []) => lauf.e531Sendewand({ id: 0, text, personId: null, adressen: [], kalender });
  const a = await wand("Gern rufen wir Sie heute noch zurück.");
  ok(!!a && /Zeit-Zusage/.test(a.grund) && /Gern rufen wir Sie heute noch zurück/.test(String(a.mangel)), `Zusage → Entwurf mit Mangel (${a?.grund})`);
  const b = await wand(`Sie hatten heute um einen Rückruf gebeten. Wählen Sie hier gern eine Zeit: ${LINK}`);
  ok(b === null, `Terminlink auf seinen Wunsch → darf raus (${b?.grund ?? "null"})`);
  const c = await wand("Herr Muster ruft Sie morgen um 10 Uhr an.", ["morgen um 10 Uhr"]);
  ok(c === null, `Gedeckt durch den Kalender → darf raus (${c?.grund ?? "null"})`);
}

abschnitt("Netz");
ok(FREMD.length === 0, `Kein Netzaufruf (${FREMD.length ? FREMD.join(", ") : "keiner"})`);

console.log(`\n${fehler ? "✗" : "✓"} ${geprueft - fehler}/${geprueft} Prüfungen bestanden (offline, E-531 Zeit-Zusagen)`);
process.exit(fehler ? 1 : 0);
