// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND MARA-AKTION, GEDÄCHTNIS, STEUERPULT (21.09.2026) — ohne Netz, ohne DB
//
//   npx tsx scripts/pruef-mara-aktion.ts
//
// Prüft die Wände, die ohne Datenbank prüfbar sind: die Nachprüfung jeder
// Mail, das Bündeln der Absätze, das Gedächtnis (nie Sensibles), und im
// Quelltext die Stopp- und Rücksichtsregeln, die Stufenwand (C gesperrt),
// den Anlauf und die Tür des Steuerpults.
//
// E-276 (02.10.2026): dazu die Aktion, die selbst verkauft (Abschluss aus den Bausteinen, kein Termin, Stufe A ohne
// Zahlungsbitte, Ersatzfassung) und — mit --db gegen eine EIGENE lokale Test-DB — die Runde, der unscharfe Abgleich
// mit ungebuchten Eingängen und der Anspruch je Mensch (Doppel-Durchgang → eine Mail). Modell und Gmail sind dabei
// Attrappen (maraAktionLauf({ schreiben, senden })); es geht nichts raus.
//
//   PGSSLMODE=require createdb -h 127.0.0.1 -p 54329 -U fiaon -T fiaon_pruefstand fiaon_e276b
//   DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_e276b?sslmode=require' npx tsx scripts/pruef-mara-aktion.ts --db
//   Eigene Datensätze (Personen PRUEF276A-…, Referenzen FIAON-P276…) werden am Ende entfernt.
// ═══════════════════════════════════════════════════════════════════════════
const MIT_DB = process.argv.includes("--db");
for (const k of ["BREVO_API_KEY", "OPENAI_API_KEY", "GOOGLE_SA_KEY", "GMAIL_CLIENT_SECRET", "RESEND_API_KEY", "DATABASE_URL_EXTERN"]) {
  if (MIT_DB && process.env[k]) { console.error(`${k} ist gesetzt — Abbruch, der Prüfstand darf nichts versenden.`); process.exit(3); }
}
if (MIT_DB && !/127\.0\.0\.1:54329\/fiaon_/.test(String(process.env.DATABASE_URL))) { console.error("--db NUR gegen eine lokale Test-DB (127.0.0.1:54329)!"); process.exit(3); }
if (!MIT_DB) process.env.DATABASE_URL = "postgresql://nobody@127.0.0.1:1/none";
process.env.CRONS = "aus";
import { readFileSync } from "node:fs";

let geprueft = 0, fehler = 0;
function ok(bed: unknown, text: string) {
  geprueft++;
  if (bed) console.log(`  ✓ ${text}`); else { fehler++; console.log(`  ✗ ${text}`); }
}
const { absaetzeFassen, aktionPruefen } = await import("../server/lib/fiaon-mara-aktion");
const { istSensibel } = await import("../server/lib/fiaon-mara-gedaechtnis");
const quelle = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

console.log("── Nachprüfung jeder Mail ─────────────────────────────────────────");
// E-265 (29.09.2026): Die gute Mail stellt die Visa-Kreditkarte vorn (Justin: „VIEL MEHR AUF DIE KREDITKARTEN!").
// E-276 (02.10.2026): ohne Termin und ohne „fehlt mir nur noch“ — mit Justins Abschluss (Aktivierung, Verwendungszweck).
const gut = "Hier ist Mara Lindner von FIAON. Bei uns kommen Sie zu Ihrer eigenen Visa-Kreditkarte, mit Ihrem Wunschlimit von 5.000 € als Ziel — über den Rahmen entscheidet unsere Partnerbank. Nach der Aktivierung sind Sie bei Herrn Stripling in besten Händen.\n\nZahlen Sie jetzt die Aktivierung, Ihre erste Monatsrate über 59,99 € — mit Ihrem Verwendungszweck FIAON-AB12CD ist Ihr Account sofort nach Eingang aktiv, und Sie bekommen direkt den fertigen Link unserer Partnerbank für Ihren Kartenantrag! Über den Knopf unten ist es in zwei Minuten erledigt. Einen schönen Abend wünsche ich Ihnen.";
ok(aktionPruefen("Ihr Account wartet auf einen Schritt", gut).length === 0, "Eine gute Mail besteht die Prüfung");
// E-265 (#1388 „Florentine hat Ihnen heute …"): mit der Mitarbeiterliste ist der Vorname allein ein Mangel.
const TEAM = [{ vorname: "Florentine", nachname: "Lombardi", anrede: "Frau" as const }, { vorname: "Daniel", nachname: "Stripling", anrede: "Herr" as const }];
ok(aktionPruefen("Kurz zu Ihrer Karte", gut.replace("Herrn Stripling", "Daniel"), { mitarbeiter: TEAM }).some((x) => /Herr\/Frau Nachname/.test(x)), "Vorname eines Mitarbeiters allein fällt durch (#1388)");
ok(aktionPruefen("Kurz zu Ihrer Karte", gut, { mitarbeiter: TEAM }).length === 0, "„Herrn Stripling“ besteht mit der Mitarbeiterliste");
ok(aktionPruefen("Kurz zu Ihrer Karte", gut.replace("Visa-Kreditkarte", "Karte")).some((x) => /Kreditkarte/.test(x)), "Ohne „Kreditkarte“ fällt die Mail durch (1 von 368 am 29.09.)");
const m = aktionPruefen("Jetzt zugreifen!", "Ich garantiere Ihnen die Karte innerhalb von 3 Tagen. Schau auf www.fiaon.com vorbei, dann kannst du loslegen.");
ok(m.some((x) => /garant/i.test(x)), "„garantieren“ fällt durch");
ok(m.some((x) => /innerhalb von/.test(x)), "Feste Frist fällt durch");
ok(m.some((x) => /URL/.test(x)), "Adresse im Text fällt durch");
ok(m.some((x) => /Du-Form/.test(x)), "Du-Form fällt durch");
ok(m.some((x) => /Rechnung kommt nicht vor/.test(x)), "Mail ohne offene Rechnung fällt durch");
ok(m.some((x) => /Ausrufezeichen/.test(x)), "Ausrufezeichen im Betreff fällt durch");
ok(aktionPruefen("Kurz zu Ihrer Karte", "Sehr geehrte Frau Muster, " + gut).some((x) => /Anrede oder Gruß/.test(x)), "Eigene Anrede im Text fällt durch (setzt der Server)");
ok(aktionPruefen("Kurz zu Ihrer Karte", gut.replace("Ihr", "Ich empfehle Ihnen Ihr")).some((x) => /empfehl/i.test(x)), "„ich empfehle“ fällt durch");

console.log("── Absätze ────────────────────────────────────────────────────────");
ok(absaetzeFassen("Eins.\n\nZwei.\n\nDrei.\n\nVier.\n\nFünf.").split("\n\n").length === 3, "Fünf Ein-Satz-Absätze werden zu drei");
ok(absaetzeFassen("A eins.\nA zwei.\n\nB.") === "A eins. A zwei.\n\nB.", "Zeilenumbruch im Absatz wird Leerzeichen, zwei Absätze bleiben");

console.log("── Gedächtnis ─────────────────────────────────────────────────────");
ok(istSensibel("Kunde ist gerade krank und im Krankenhaus"), "Gesundheit wird nie gemerkt");
ok(istSensibel("Er ist Muslim und fastet gerade"), "Religion wird nie gemerkt");
ok(!istSensibel("Arbeitet im Schichtdienst, abends ab 19 Uhr erreichbar"), "Erreichbarkeit wird gemerkt");
ok(!istSensibel("Will die Karte für den Urlaub im Oktober"), "Ziel des Kunden wird gemerkt");

console.log("── Regeln im Quelltext ────────────────────────────────────────────");
const aktion = quelle("server/lib/fiaon-mara-aktion.ts");
for (const [muster, satz] of [
  [/werbung_gesperrt_am IS NULL/, "Werbesperre stoppt"],
  [/is_blocked, FALSE\) = FALSE/, "Vertriebssperre stoppt"],
  [/payment_status = 'paid'/, "Wer bezahlt hat, bekommt nichts mehr"],
  [/fiaon_telefonkartei_storno/, "Storno stoppt"],
  [/stopp\\\\\\\\\?"/, "„Stopp“-Antwort stoppt"],
  [/fiaon_mara_ausschluss/, "Aus der Aktion genommen stoppt"],
  [/INTERVAL '7 days'\)/, "Kunde schreibt selbst → 7 Tage Pause"],
  [/INTERVAL '12 hours'/, "Mitarbeiter gerade dran → Pause"],
  [/INTERVAL '6 hours'/, "Andere Mail gerade raus → Pause"],
  [/'gebounct', 'blockiert', 'spam'/, "Zustellproblem stoppt"],
  [/INTERVAL '2 days' WHEN 2 THEN INTERVAL '4 days' WHEN 3 THEN INTERVAL '7 days' ELSE INTERVAL '14 days'/, "Takt 2 / 4 / 7 / 14 Tage"],
  // Der Anlauf 200/400/800 ist am 22.09.2026 entfallen (fiaon-mara-aktion.ts) — geprüft wird, dass er weg bleibt.
  [/Kein Anlauf mehr/, "Kein Anlauf mehr (seit 22.09.2026)"],
  [/x === "A" \|\| x === "B"/, "Stufe C lässt sich nicht einschalten"],
  [/gekuendigt_am IS NULL AND a\.cancelled_at IS NULL/, "Gekündigt und storniert bleiben draußen"],
  [/kostenHeute\(DIENST\)/, "Eigener Kostendeckel"],
] as [RegExp, string][]) ok(muster.test(aktion), satz);
ok(/requireChef\("inhaber"\)/.test(quelle("server/routes/fiaon-mara-steuerpult.ts")), "Steuerpult nur für Stufe Inhaber");
const agent = quelle("server/lib/fiaon-postmeister-agent.ts");
ok(/merken: \{ type: "array"/.test(agent) && /gedaechtnisMerken\(ein\.personId, roh\?\.merken/.test(agent), "Mara merkt sich nach jeder Antwort Neues");
ok(/ERSTES NEIN/.test(agent) && /erst beim ZWEITEN ausdrücklichen Nein/.test(agent), "Beim ersten „zahle ich nicht“ freundlich, Härte erst beim zweiten Nein");
ok(/DEIN TON: herzlich, positiv und motivierend/.test(agent), "Neuer Ton in jeder Antwort");
ok(/maxZeichen: 20_000/.test(agent), "Größerer Weg des Kunden für Antworten");
const weg = quelle("server/lib/fiaon-kundenweg.ts");
ok(/insgesamt \$\{rest\.length\}× seit/.test(weg), "Gleiche Automatik-Mails im Weg zusammengefasst");
ok(/Mara schreibt von sich aus/.test(weg) && /event <> 'mara_aktion'/.test(weg), "Maras Aktions-Mails stehen einmal im Weg (mit Inhalt)");

// ═══════════════════════════════════════════════════════════════════════════
// E-276 (02.10.2026): DIE AKTION VERKAUFT SELBST — UND DIE RUNDE
// ═══════════════════════════════════════════════════════════════════════════
console.log("── E-276: Abschluss aus den Bausteinen ────────────────────────────");
const A276 = await import("../server/lib/fiaon-mara-aktion");
const TON = await import("../shared/fiaon-mara-ton");
const { KARTE_ZEIT_SATZ: ZEIT } = await import("../shared/fiaon-karten-weg");
const { fordertZahlung } = await import("../server/lib/fiaon-postmeister-agent");
const ziel = { euro: 5000, art: "wunsch" as const, paketName: "FIAON Pro" };
const absB = A276.aktionAbschluss({ stufe: "B", ziel, betrag: "99,99 €", verwendungszweck: "FIAON-AB12CD" });
ok(absB.includes(`${TON.AKTIVIERUNG_AUFRUF}, Ihre erste Monatsrate über 99,99 €`), "B: „Zahlen Sie jetzt die Aktivierung, Ihre erste Monatsrate über 99,99 €“");
ok(absB.includes(TON.nachDemEingang({ ref: "FIAON-AB12CD" })), "B: „mit Ihrem Verwendungszweck FIAON-AB12CD ist Ihr Account sofort nach Eingang aktiv …“");
ok(absB.includes(TON.TEMPO_SATZ) && absB.includes(TON.ZAHL_KNOPF_MAIL) && absB.includes(ZEIT), "B: Tempo, Zeit bis zur Karte (2–5 Werktage nach der Zusage der Bank), Knopf");
ok(TON.ausrufezeichen(absB) === 1, "B: genau ein „!“");
ok(!/termin/i.test(absB) && !/melde|meldet/i.test(absB), "B: kein Termin, kein „meldet sich“");
const absBL = A276.aktionAbschluss({ stufe: "B", ziel, betrag: "99,99 €", verwendungszweck: "FIAON-AB12CD", luecke: ["Geburtsdatum"] });
ok(!/direkt den fertigen Link/.test(absBL) && /es fehlt noch: Geburtsdatum/.test(absBL), "B mit Antragslücke: kein „direkt der Link“, sondern was fehlt");
const absA = A276.aktionAbschluss({ stufe: "A", ziel, betrag: "99,99 €", verwendungszweck: "FIAON-AB12CD" });
ok(!fordertZahlung(absA), "A: keine Zahlungsaufforderung im Abschluss");
ok(/Sobald wir Ihre Zahlung über 99,99 € zugeordnet haben, ist Ihr Account sofort aktiv/.test(absA), "A: „Sobald wir Ihre Zahlung … zugeordnet haben, ist Ihr Account sofort aktiv …“");
ok(absA.includes(A276.A_HILFE_SATZ) && /Verwendungszweck und die Zahlungsdaten/.test(absA), "A: Hilfe — Beleg als Antwort, Verwendungszweck über den Knopf");
ok(A276.A_KNOPF_TEXT === "Verwendungszweck und Zahlungsdaten ansehen" && !fordertZahlung(A276.A_KNOPF_TEXT), "A: Knopf „Verwendungszweck und Zahlungsdaten ansehen“");

console.log("── E-276: Nachprüfung (Termin, Verweis, Stufe A, Wahrheit) ───────");
const ersB = A276.ersatzKern({ stufe: "B", name: "Mara Lindner", abschluss: absB, tageszeit: "Abend" });
const ersA = A276.ersatzKern({ stufe: "A", name: "Mara Lindner", abschluss: absA, tageszeit: "Nacht", gemeldetAm: "01.10.2026" });
ok(A276.aktionPruefen("Ihre Karte wartet auf die Aktivierung", ersB, { stufe: "B", mitarbeiter: TEAM }).length === 0, "Ersatzfassung B besteht die Prüfung");
ok(A276.aktionPruefen("Ihre Zahlung und Ihre Karte", ersA, { stufe: "A", mitarbeiter: TEAM }).length === 0, "Ersatzfassung A besteht die Prüfung (auch als Stufe A)");
ok(A276.aktionHinweise("x", ersB, { stufe: "B" }).length === 0 && A276.aktionHinweise("x", ersA, { stufe: "A" }).length === 0, "Ersatzfassungen ohne weiche Befunde");
ok(/Eine gute Nacht wünsche ich Ihnen\./.test(ersA) && /Einen schönen Abend wünsche ich Ihnen\./.test(ersB), "Wunsch zur Tageszeit grammatisch („Eine gute Nacht“)");
const alt = "Hier ist Mara Lindner von FIAON. Bei uns kommen Sie zu Ihrer eigenen Visa-Kreditkarte — über den Rahmen entscheidet unsere Partnerbank. Der nächste Schritt ist Ihre erste Monatsrate über 99,99 €.\n\nSobald Ihre Zahlung gebucht ist, schaltet das System Sie frei, und ich vereinbare Ihren Termin mit Herrn Stripling — antworten Sie mir einfach mit einer Zeit, die Ihnen passt. Einen schönen Abend.";
ok(A276.aktionPruefen("Kurz zu Ihrer Karte", alt).some((x) => /Termin/.test(x)), "Altes Beispiel mit Termin fällt durch (Mail 1719–1723)");
ok(A276.aktionPruefen("Kurz zu Ihrer Karte", gut.replace("Über den Knopf unten", "Herr Stripling meldet sich bei Ihnen. Über den Knopf unten")).some((x) => /Verweis auf einen Kollegen/.test(x)), "„Herr Stripling meldet sich“ fällt durch (Verweis)");
ok(A276.aktionPruefen("Ihre Zahlung", ersA.replace(A276.A_HILFE_SATZ, "Zahlen Sie jetzt die Aktivierung über den Knopf unten."), { stufe: "A" }).some((x) => /Erneute Zahlungsaufforderung/.test(x)), "Stufe A: „Zahlen Sie jetzt …“ fällt durch");
ok(A276.aktionPruefen("Ihre Zahlung", ersA.replace(A276.A_HILFE_SATZ, "Überweisen Sie am besten gleich heute."), { stufe: "A" }).some((x) => /Erneute Zahlungsaufforderung/.test(x)), "Stufe A: „Überweisen Sie am besten gleich heute“ fällt durch");
ok(A276.aktionPruefen("Kurz zu Ihrer Karte", gut.replace(TON.nachDemEingang({ ref: "FIAON-AB12CD" }), "Ihr Account ist sofort nach Zahlungseingang aktiv, und Sie bekommen direkt den fertigen Link unserer Partnerbank für Ihren Kartenantrag")).some((x) => /Verwendungszweck/.test(x)), "„sofort nach Zahlungseingang aktiv“ ohne Verwendungszweck fällt durch");
ok(A276.aktionPruefen("Kurz zu Ihrer Karte", gut.replace("Über den Knopf unten", "Wir kümmern uns darum, dass die Karte schnell versendet wird. Über den Knopf unten")).length > 0, "„… dass die Karte schnell versendet wird“ fällt durch");
ok(A276.aktionPruefen("Kurz zu Ihrer Karte", gut.replace("Über den Knopf unten", "Wir sind keine Bank. Über den Knopf unten")).length > 0, "„Wir sind keine Bank“ fällt durch");
ok(A276.aktionHinweise("x", gut.replace("Einen schönen Abend wünsche ich Ihnen.", "Ich freue mich! Einen schönen Abend!"), { stufe: "B" }).some((x) => /Ausrufezeichen/.test(x)), "Mehr als ein „!“ → zweiter Entwurf");
ok(TON.ausrufezeichen(A276.nurEinAusrufezeichen("Toll! Super! Prima!")) === 1 && A276.nurEinAusrufezeichen("Toll! Super!") === "Toll! Super.", "Übrige „!“ werden Punkte");
ok(A276.aktionHinweise("x", gut.replace(/Zahlen Sie jetzt die Aktivierung, /, ""), { stufe: "B" }).some((x) => /klare Aufforderung/.test(x)), "B ohne klare Aufforderung → zweiter Entwurf");

console.log("── E-276: Auftrag und Lauf im Quelltext ───────────────────────────");
const prompt = aktion.slice(aktion.indexOf("function aktionsPrompt("), aktion.indexOf("export function absaetzeFassen"));
ok(!/ich vereinbare Ihren Termin mit \$\{/.test(aktion) && !/mit einer Zeit, die Ihnen passt"\)/.test(prompt), "Justins altes Beispiel mit Termin ist aus dem Auftrag");
ok(/KEIN Termin, kein Anruf, kein Rückruf als Ziel/.test(prompt) && /SO SCHLIESST DU AB/.test(prompt) && /ein\.abschluss/.test(prompt), "Auftrag: kein Termin, Abschluss aus den Bausteinen");
ok(/KEINE Bitte um Zahlung/.test(prompt), "Auftrag Stufe A: keine Zahlungsbitte");
ok(/ON CONFLICT \(person_id\) WHERE status = 'in_arbeit' DO NOTHING/.test(aktion) && /fiaon_mara_aktion_in_arbeit_uidx ON fiaon_mara_aktion \(person_id\) WHERE status = 'in_arbeit'/.test(aktion), "Anspruch je Mensch über den eindeutigen Index");
const lauf = aktion.slice(aktion.indexOf("export async function maraAktionLauf("));
ok(lauf.indexOf("eingangOffenFuer(k.personId)") > 0 && lauf.indexOf("eingangOffenFuer(k.personId)") < lauf.indexOf("m = await schreiben(k, e)"), "Ungebuchter Eingang wird direkt vor dem Schreiben geprüft");
ok(/ungebuchter Eingang — buchen statt anschreiben/.test(lauf), "… und als „abgelehnt“ mit Grund vermerkt");
ok(/status = 'abgebrochen'[\s\S]{0,200}status = 'in_arbeit' AND created_at < NOW\(\) - make_interval\(mins => \$\{ANSPRUCH_MINUTEN\}\)/.test(lauf) && A276.ANSPRUCH_MINUTEN === 30, "Liegen gebliebene Ansprüche nach 30 Min. → „abgebrochen“");
ok(lauf.indexOf("menschSperre(k.personId)") > 0 && lauf.indexOf("menschSperre(k.personId)") < lauf.indexOf("m = await schreiben(k, e)"), "menschSperre bleibt direkt vor dem Schreiben");
ok(A276.AKTION_PARALLEL >= 1 && A276.AKTION_PARALLEL <= 4, `Höchstens vier gleichzeitig (${A276.AKTION_PARALLEL})`);

console.log("── E-276: Runde (rein) ────────────────────────────────────────────");
const jetzt = Date.parse("2026-10-02T19:30:00Z");
ok(A276.rundeAktiv("", jetzt) === null && A276.rundeAktiv("aus", jetzt) === null && A276.rundeAktiv(null, jetzt) === null, "Ohne Wert keine Runde");
ok(A276.rundeAktiv("2026-10-02T19:00:00Z", jetzt) === "2026-10-02T19:00:00.000Z", "Runde seit 19:00 läuft um 19:30");
ok(A276.rundeAktiv("2026-10-01T19:00:00Z", jetzt) === null, "Nach 24 Stunden endet die Runde von selbst");
ok(A276.rundeAktiv("2026-10-02T21:00:00Z", jetzt) === null, "Eine Runde in der Zukunft gilt nicht");

if (MIT_DB) {
  console.log("── E-276: Runde, Eingang, Anspruch (lokale Test-DB) ───────────────");
  const { sqlPool: sql } = await import("../server/lib/db-pool");
  const U = await import("../server/lib/fiaon-zahlung-unverbucht");
  await A276.aktionTabellen();
  const einstVorher = (await sql`SELECT key, value FROM fiaon_settings WHERE key LIKE 'mara_aktion_%'`) as any[];
  const personen: Record<string, number> = {};
  const aufraeumen = async () => {
    const ids = Object.values(personen);
    if (ids.length) {
      await sql`DELETE FROM fiaon_mara_aktion WHERE person_id = ANY(${ids})`;
      await sql`DELETE FROM fiaon_mail_log WHERE person_id = ANY(${ids})`.catch(() => {});
      await sql`DELETE FROM fiaon_contact_log WHERE person_id = ANY(${ids})`.catch(() => {});
    }
    await sql`DELETE FROM fiaon_bank_txns WHERE txn_id LIKE 'PRUEF276-%'`;
    await sql`DELETE FROM fiaon_applications WHERE ref LIKE 'FIAON-P276%'`;
    await sql`DELETE FROM fiaon_persons WHERE person_ref LIKE 'PRUEF276A-%'`;
    await sql`DELETE FROM fiaon_settings WHERE key LIKE 'mara_aktion_%'`;
    for (const z of einstVorher) await sql`INSERT INTO fiaon_settings (key, value) VALUES (${z.key}, ${z.value}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  };
  await aufraeumen();
  try {
    for (const [k, v] of [["mara_aktion_an", "an"], ["mara_aktion_je_stunde", "500"], ["mara_aktion_tag_euro", "500"], ["mara_aktion_stufen", "A,B"], ["mara_aktion_runde_seit", ""]])
      await A276.einstellungSetzen(k, v);
    const person = async (kurz: string, o: { vor?: string; nach?: string; werbesperre?: boolean; blockiert?: boolean; test?: boolean } = {}) => {
      const [p] = (await sql`INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_email, werbung_gesperrt_am, is_blocked, ist_test_am)
        VALUES (${`PRUEF276A-${kurz}`}, ${o.vor ?? "Max"}, ${o.nach ?? `Prüfer${kurz}`}, ${`pruef276a-${kurz.toLowerCase()}@kunde.invalid`},
                ${o.werbesperre ? new Date() : null}, ${!!o.blockiert}, ${o.test ? new Date() : null}) RETURNING id`) as any[];
      personen[kurz] = Number(p.id);
      return Number(p.id);
    };
    const antrag = async (kurz: string, o: { ref: string; zweck: string; stufe: "A" | "B"; vorStunden: number; vor?: string; nach?: string }) => {
      const pid = personen[kurz];
      await sql`INSERT INTO fiaon_applications (ref, person_id, type, status, pack_key, pack_name, payment_reference, payment_status, amount_due, first_name, last_name, email, created_at, submitted_at, claimed_paid_at)
        VALUES (${o.ref}, ${pid}, 'private', 'submitted', 'pro', 'FIAON Pro', ${o.zweck}, ${o.stufe === "A" ? "claimed_paid" : "pending_payment"}, 99.99,
                ${o.vor ?? "Max"}, ${o.nach ?? `Prüfer${kurz}`}, ${`pruef276a-${kurz.toLowerCase()}@kunde.invalid`},
                NOW() - make_interval(hours => ${o.vorStunden}), NOW() - make_interval(hours => ${o.vorStunden}),
                ${o.stufe === "A" ? sql`NOW() - make_interval(hours => ${o.vorStunden})` : null})`;
    };
    const eingang = async (nr: number, o: { zweck?: string; erkannt?: string; zahler?: string }) =>
      sql`INSERT INTO fiaon_bank_txns (txn_id, booked_at, amount_cents, payer_name, reference_raw, extracted_ref, match_status, applied)
          VALUES (${`PRUEF276-${nr}`}, NOW() - INTERVAL '2 hours', 9999, ${o.zahler ?? "Jemand Anders"}, ${o.zweck ?? null}, ${o.erkannt ?? null}, 'unmatched', FALSE)`;

    // B1: vor 3 Tagen beantragt, gestern schon eine Aktionsmail (Takt: erst in 2 Tagen wieder); B2: frisch (vor 1 h);
    // A1: Zahlung vor 2 h gemeldet; Wände: Werbesperre, Vertriebssperre, Testkonto; Eingänge: E1 (verkürzte Bestellnummer
    // „FIAONQ7X2K9“), E2 („Fisimatenten-W4N8P2“), E3 (Zahlername); S1: liegen gebliebener Anspruch vor 31 Min.
    await person("B1"); await antrag("B1", { ref: "FIAON-P276B1XX-0001", zweck: "FIAON-P276B1", stufe: "B", vorStunden: 72 });
    await sql`INSERT INTO fiaon_mara_aktion (person_id, ref, stufe, schritt, status, betreff, gesendet_am, created_at) VALUES (${personen.B1}, 'FIAON-P276B1XX-0001', 'B', 1, 'gesendet', 'gestern', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day')`;
    await person("B2"); await antrag("B2", { ref: "FIAON-P276B2XX-0002", zweck: "FIAON-P276B2", stufe: "B", vorStunden: 1 });
    await person("A1"); await antrag("A1", { ref: "FIAON-P276A1XX-0003", zweck: "FIAON-P276A1", stufe: "A", vorStunden: 2 });
    await person("W1", { werbesperre: true }); await antrag("W1", { ref: "FIAON-P276W1XX-0004", zweck: "FIAON-P276W1", stufe: "B", vorStunden: 72 });
    await person("W2", { blockiert: true }); await antrag("W2", { ref: "FIAON-P276W2XX-0005", zweck: "FIAON-P276W2", stufe: "B", vorStunden: 72 });
    await person("W3", { test: true }); await antrag("W3", { ref: "FIAON-P276W3XX-0006", zweck: "FIAON-P276W3", stufe: "A", vorStunden: 72 });
    await person("E1"); await antrag("E1", { ref: "FIAON-Q7X2K9AB-Z3BT", zweck: "FIAON-R8M3N1", stufe: "B", vorStunden: 72 });
    await person("E2"); await antrag("E2", { ref: "FIAON-P276E2XX-0008", zweck: "FIAON-W4N8P2", stufe: "B", vorStunden: 72 });
    await person("E3", { vor: "Kunigunde", nach: "Prüfstandlerin" }); await antrag("E3", { ref: "FIAON-P276E3XX-0009", zweck: "FIAON-P276E3", stufe: "A", vorStunden: 72, vor: "Kunigunde", nach: "Prüfstandlerin" });
    await person("S1"); await antrag("S1", { ref: "FIAON-P276S1XX-0010", zweck: "FIAON-P276S1", stufe: "B", vorStunden: 72 });
    await sql`INSERT INTO fiaon_mara_aktion (person_id, ref, stufe, schritt, status, created_at) VALUES (${personen.S1}, 'FIAON-P276S1XX-0010', 'B', 1, 'in_arbeit', NOW() - INTERVAL '31 minutes')`;
    await eingang(1, { zweck: "/ROC/NOTPROVIDED//FIAONQ7X2K9", erkannt: "FIAONQ7X2K9" });
    await eingang(2, { zweck: "Fisimatenten-W4N8P2" });
    await eingang(3, { zweck: "Kreditkarte", zahler: "KUNIGUNDE PRUEFSTANDLERIN" });

    console.log("  · Eingang (unscharf)");
    ok(await U.eingangOffenFuer(personen.E1), "„FIAONQ7X2K9“ gehört zu FIAON-Q7X2K9AB-Z3BT (verkürzte Bestellnummer)");
    ok(await U.eingangOffenFuer(personen.E2), "„Fisimatenten-W4N8P2“ gehört zu FIAON-W4N8P2 (Zahlungsreferenz im Zweck)");
    ok(await U.eingangOffenFuer(personen.E3), "Zahlername „KUNIGUNDE PRUEFSTANDLERIN“ gehört zu Kunigunde Prüfstandlerin");
    ok(!(await U.eingangOffenFuer(personen.B1)) && !(await U.eingangOffenFuer(personen.A1)), "Ohne passenden Eingang: nicht ausgelassen");

    const ids = (l: { personId: number }[]) => new Set(l.map((k) => k.personId));
    console.log("  · Ohne Runde: der Takt");
    const takt = ids(await A276.kandidatenLaden(500, ["A", "B"], { rundeSeit: null }));
    ok(!takt.has(personen.B1) && !takt.has(personen.B2) && !takt.has(personen.A1), "Takt hält B1 (gestern geschrieben), B2 und A1 (frisch) zurück");

    console.log("  · Runde jetzt");
    await A276.einstellungSetzen("mara_aktion_runde_seit", "jetzt");
    const e1 = await A276.einstellungenLesen();
    ok(!!e1.rundeSeit && Math.abs(Date.parse(e1.rundeSeit) - Date.now()) < 120_000, "„jetzt“ setzt die Runde auf die Uhrzeit des Speicherns");
    const runde = ids(await A276.kandidatenLaden(500, ["A", "B"]));
    ok(runde.has(personen.B1) && runde.has(personen.B2) && runde.has(personen.A1), "Runde: B1, B2 und A1 sind fällig — trotz Takt");
    ok(!runde.has(personen.W1) && !runde.has(personen.W2) && !runde.has(personen.W3), "Runde: Werbesperre, Vertriebssperre und Testkonto bleiben draußen");
    ok(!runde.has(personen.E1) && !runde.has(personen.E2) && !runde.has(personen.E3), "Runde: wer womöglich ungebucht gezahlt hat, bleibt draußen");
    const st0 = await A276.rundeStand();
    ok(!!st0 && st0.geschrieben === 0 && st0.offen >= 3, `Stand der Runde: 0 geschrieben, ${st0?.offen} offen`);

    console.log("  · Durchgang (Attrappen für Modell und Gmail)");
    const gesendetAn: Record<number, number> = {};
    const texte: Record<number, string> = {};
    const schreiben = async (k: any) => {
      const abs = A276.aktionAbschluss({ stufe: k.stufe, betrag: "99,99 €", verwendungszweck: k.zahlungsreferenz });
      const kern = A276.ersatzKern({ stufe: k.stufe, name: "Mara Lindner", abschluss: abs, tageszeit: "Abend" });
      texte[k.personId] = kern;
      await new Promise((r) => setTimeout(r, 30));
      return { ok: true, grund: null, betreff: "Prüfstand", text: kern, html: `<p>${kern}</p>`, kern, kostenCents: 0, maengel: [] };
    };
    let n = 0;
    const senden = async (_p: string, m: { an: string }) => {
      const pid = Object.entries(personen).find(([kk]) => `pruef276a-${kk.toLowerCase()}@kunde.invalid` === m.an)?.[1] ?? -1;
      gesendetAn[pid] = (gesendetAn[pid] ?? 0) + 1;
      n++;
      return { id: `pruef-${n}`, threadId: `pruef-t-${n}` };
    };
    // Zwei Durchgänge zugleich: der zweite wartet nicht, er sagt „läuft schon“ — danach ein dritter, der nichts mehr findet.
    const [r1, r2] = await Promise.all([A276.maraAktionLauf({ schreiben, senden }), A276.maraAktionLauf({ schreiben, senden })]);
    ok(r2.grund === "läuft schon" || r1.grund === "läuft schon", "Zweiter gleichzeitiger Durchgang im selben Prozess: „läuft schon“");
    const r3 = await A276.maraAktionLauf({ schreiben, senden });
    ok((gesendetAn[personen.B1] ?? 0) === 1 && (gesendetAn[personen.B2] ?? 0) === 1 && (gesendetAn[personen.A1] ?? 0) === 1, "B1, B2, A1 bekommen genau EINE Mail (Doppel-Durchgang → eine Mail)");
    ok(r3.gesendet === 0, "Dritter Durchgang in derselben Runde schreibt niemandem ein zweites Mal");
    for (const w of ["W1", "W2", "W3", "E1", "E2", "E3"]) ok(!gesendetAn[personen[w]], `${w}: keine Mail`);
    ok(!fordertZahlung(texte[personen.A1] ?? "") && !/termin/i.test(texte[personen.A1] ?? ""), "A1: ohne Zahlungsbitte, ohne Termin");
    ok(!!fordertZahlung(texte[personen.B1] ?? "") && !/termin/i.test(texte[personen.B1] ?? ""), "B1: klare Aufforderung, ohne Termin");
    const [s1] = (await sql`SELECT status FROM fiaon_mara_aktion WHERE person_id = ${personen.S1} AND created_at < NOW() - INTERVAL '30 minutes'`) as any[];
    ok(s1?.status === "abgebrochen", "Liegen gebliebener Anspruch (31 Min.) → „abgebrochen“");
    const [offen] = (await sql`SELECT COUNT(*)::int AS n FROM fiaon_mara_aktion WHERE status = 'in_arbeit' AND person_id = ANY(${Object.values(personen)})`) as any[];
    ok(offen.n === 0, "Nach dem Durchgang hängt kein Anspruch mehr");
    const st1 = await A276.rundeStand();
    ok(!!st1 && st1.geschrieben >= 3, `Stand der Runde: ${st1?.geschrieben} geschrieben, ${st1?.offen} offen`);

    console.log("  · Anspruch direkt");
    const [x1] = (await sql`INSERT INTO fiaon_mara_aktion (person_id, ref, stufe, schritt, status) VALUES (${personen.B2}, 'x', 'B', 9, 'in_arbeit') ON CONFLICT (person_id) WHERE status = 'in_arbeit' DO NOTHING RETURNING id`) as any[];
    const [x2] = (await sql`INSERT INTO fiaon_mara_aktion (person_id, ref, stufe, schritt, status) VALUES (${personen.B2}, 'x', 'B', 9, 'in_arbeit') ON CONFLICT (person_id) WHERE status = 'in_arbeit' DO NOTHING RETURNING id`) as any[];
    ok(!!x1 && !x2, "Zweiter Anspruch auf denselben Menschen scheitert still (eindeutiger Index)");
    const mitAnspruch = ids(await A276.kandidatenLaden(500, ["A", "B"]));
    ok(!mitAnspruch.has(personen.B2), "Wer gerade in Arbeit ist, steht nicht in der Schlange");
    await sql`DELETE FROM fiaon_mara_aktion WHERE id = ${x1.id}`;

    console.log("  · Neue Runde, ein Eingang kommt dazu");
    await A276.einstellungSetzen("mara_aktion_runde_seit", "aus");
    await new Promise((r) => setTimeout(r, 20));
    await A276.einstellungSetzen("mara_aktion_runde_seit", "jetzt");
    ok(ids(await A276.kandidatenLaden(500, ["A", "B"])).has(personen.B2), "Neue Runde: B2 ist wieder fällig (einmal je Runde)");
    await eingang(4, { zweck: "FIAON-P276B2 danke" });
    ok(await U.eingangOffenFuer(personen.B2), "Der neue Eingang „FIAON-P276B2 danke“ gehört zu B2");
    const vorB2 = gesendetAn[personen.B2] ?? 0;
    await A276.maraAktionLauf({ schreiben, senden });
    ok((gesendetAn[personen.B2] ?? 0) === vorB2, "B2: keine Mail, solange sein Eingang ungebucht ist");
    ok((gesendetAn[personen.B1] ?? 0) === 2, "B1: in der neuen Runde wieder genau eine Mail");

    console.log("  · Runde aus → alte Regeln");
    await A276.einstellungSetzen("mara_aktion_runde_seit", "aus");
    const e2 = await A276.einstellungenLesen();
    const ohne = ids(await A276.kandidatenLaden(500, ["A", "B"]));
    ok(e2.rundeSeit === null && !ohne.has(personen.B1) && !ohne.has(personen.A1), "Runde aus: Takt und Rücksicht gelten wieder");
    ok((await A276.rundeStand()) === null, "Runde aus: kein Stand");
  } finally {
    await aufraeumen();
    const [rest] = (await sql`SELECT (SELECT COUNT(*) FROM fiaon_persons WHERE person_ref LIKE 'PRUEF276A-%')::int AS p, (SELECT COUNT(*) FROM fiaon_bank_txns WHERE txn_id LIKE 'PRUEF276-%')::int AS t`) as any[];
    ok(rest.p === 0 && rest.t === 0, "Aufgeräumt: keine Prüf-Personen, keine Prüf-Eingänge");
    await sql.end({ timeout: 2 }).catch(() => {});
  }
}

console.log(`\n${fehler === 0 ? "✓" : "✗"} ${geprueft - fehler}/${geprueft} Prüfungen bestanden`);
process.exit(fehler === 0 ? 0 : 1);
