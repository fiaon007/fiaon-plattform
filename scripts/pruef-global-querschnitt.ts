// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: FIAON GLOBAL — DER QUERSCHNITT (17.09.2026, E-188)
//
// Ohne Datenbank, ohne Netz, ohne Browser, ohne Mailversand. Geprüft werden die
// REINEN Entscheidungen hinter den Lücken, die nach dem Bestellweg offen waren:
//
//   A  Der ruhige Zahlungstakt        Tag 3 / 7 / 10, Sonntag, Nacht, Zeitumstellung,
//                                      Idempotenz, „überwiesen gemeldet", bezahlt/storniert —
//                                      dazu ein Halbstunden-Durchlauf über 14 Tage.
//   B  Die Tür zum Privatbereich      nur Global / Global + Privat / nur Privat / nichts —
//                                      UND der Beleg, dass sich für Familien OHNE
//                                      Global-Auftrag nichts ändert: alte Fassung gegen
//                                      neue, über 3.770 erzeugte Fälle.
//   C  Die Mails in zwei Sprachen     Paare gleich gebaut, keine deutschen Reste im
//                                      Englischen, Wortwand + schärfere Global-Regeln,
//                                      englische Verbote, kein Drohwort, keine Bankdaten,
//                                      der Link zu „Mein Auftrag" trägt ein gültiges Token.
//   D  Das Gerüst, PDF-Fuß, Rechnung  Jede deutsche Mail des Hauses ist nach dem Umbau
//                                      Byte für Byte dieselbe wie davor (SHA-256 gegen die
//                                      Fassung aus `git archive <BASIS>`); ebenso die
//                                      deutschen Rechnungen. „Page X of Y" und die englische
//                                      Zweitzeile der Rechnung nur für englische Aufträge.
//   E  Storno, Zugang, Mara-Wand      Eingabeprüfung, Drossel je Adresse, Werkzeug-Sperre.
//   F  Zahlungsseite                  beide Wörterbuch-Hälften tragen dieselben Schlüssel,
//                                      Englisch nur für den englischen Firmenauftrag.
//   G  Verdrahtung                    Lauf im Register, Ereignisse registriert, Pflichtmail/
//                                      Zahlungspost in der Frequenzbremse.
//
// BASIS ist der Commit, von dem der Querschnitt abzweigt (vor dem Umbau). Wer den
// Prüfstand später auf einem anderen Stand fährt: PRUEF_BASIS=<commit> setzen.
// Vorlagen, die seither absichtlich geändert wurden, vergleicht Teil D nur noch
// durch das Gerüst (altes Gerüst gegen neues, derselbe Baustein) — so bleibt der
// Beleg gültig, ohne dass jede Textänderung ihn rot macht.
//
// Aufruf: npx tsx scripts/pruef-global-querschnitt.ts        (Exit 1 bei Fehlern)
// ═══════════════════════════════════════════════════════════════════════════
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Mehrere Module laden den Datenbank-Pool beim Import. Er verbindet sich erst bei der ersten
// Abfrage — und dieser Prüfstand stellt keine. Damit das auch dann gilt, wenn in der Umgebung
// die Produktionsadresse steht, zeigt die Adresse hier ins Leere.
process.env.DATABASE_URL = "postgres://pruefstand:ohne@127.0.0.1:1/keine-datenbank";

const WURZEL = path.resolve(import.meta.dirname ?? ".", "..");
// 18.09.2026: Basis ist der Stand VOR dem Merge des Querschnitts (c9f299a) — er enthält die
// absichtlichen Änderungen seitdem (Mail-Fuß, Rechnung „Auftrags-Nr.“); verglichen wird, dass der
// Querschnitt selbst keine deutsche Mail und keine deutsche Rechnung verändert.
const BASIS = process.env.PRUEF_BASIS || "c9f299a";
// 18.09.2026 abends: Nach dem Mail-Umbau (fix/mails-0918: Knöpfe, Du-Form, Absender) sind deutsche
// Mails absichtlich anders als vor dem Querschnitt. Der Byte-Vergleich hat seinen Zweck erfüllt und
// läuft nur noch, wenn PRUEF_BASIS ausdrücklich gesetzt ist.
const BYTEVERGLEICH = !!process.env.PRUEF_BASIS;

let fehler = 0; let geprueft = 0;
const ok = (bedingung: boolean, was: string) => { geprueft++; if (!bedingung) { fehler++; console.log(`  FEHLER  ${was}`); } };
const abschnitt = (t: string) => console.log(`\n── ${t} ${"─".repeat(Math.max(3, 72 - t.length))}`);
const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const lies = (rel: string) => readFileSync(path.join(WURZEL, rel), "utf8");

// ═══ A · DER ZAHLUNGSTAKT ═══════════════════════════════════════════════════
abschnitt("A · Zahlungstakt: Tag 3 / 7 / 10, Fenster, Idempotenz");
const takt = await import("../server/lib/fiaon-global-zahlungstakt");
const { berlinZeitpunkt, berlinDatum, berlinWochentag, berlinPlusTage } = await import("../server/lib/fiaon-time");
const um = (tag: string, hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return berlinZeitpunkt(tag, h * 60 + m); };
const plus = (tag: string, n: number) => berlinPlusTage(n, um(tag, "12:00"));
type Stand = Parameters<typeof takt.zahlungstaktStufe>[0];
const stand = (erstellt: Date, mehr: Partial<Stand> = {}): Stand =>
  ({ status: "offen", erstelltAm: erstellt, erinnerung1Am: null, erinnerung2Am: null, aufgabeAm: null, zahlungGemeldetAm: null, ...mehr });

{
  // Auftrag am Montag, 14.09.2026, 10:00 Uhr Berlin.
  const t0 = "2026-09-14"; const a = um(t0, "10:00");
  ok(berlinWochentag(t0) === 1, "Probe-Kalender: 14.09.2026 ist kein Montag");
  for (const n of [0, 1, 2]) ok(takt.zahlungstaktStufe(stand(a), um(plus(t0, n), "11:00")) === null, `Tag ${n}: es geht schon etwas raus`);
  ok(takt.zahlungstaktStufe(stand(a), um(plus(t0, 3), "11:00")) === "erinnerung_1", "Tag 3: Erinnerung 1 fehlt");
  ok(takt.zahlungstaktStufe(stand(a, { erinnerung1Am: um(plus(t0, 3), "11:00") }), um(plus(t0, 3), "11:30")) === null, "Tag 3: Erinnerung 1 ginge ein zweites Mal raus");
  for (const n of [4, 5, 6]) ok(takt.zahlungstaktStufe(stand(a, { erinnerung1Am: um(plus(t0, 3), "11:00") }), um(plus(t0, n), "11:00")) === null, `Tag ${n}: zwischen den Stufen geht etwas raus`);
  ok(takt.zahlungstaktStufe(stand(a, { erinnerung1Am: um(plus(t0, 3), "11:00") }), um(plus(t0, 7), "09:00")) === "erinnerung_2", "Tag 7: Erinnerung 2 fehlt");
  const beide = { erinnerung1Am: um(plus(t0, 3), "11:00"), erinnerung2Am: um(plus(t0, 7), "09:00") };
  for (const n of [7, 8, 9]) ok(takt.zahlungstaktStufe(stand(a, beide), um(plus(t0, n), "15:00")) === null, `Tag ${n}: nach Erinnerung 2 geht noch etwas raus`);
  ok(takt.zahlungstaktStufe(stand(a, beide), um(plus(t0, 10), "08:00")) === "aufgabe", "Tag 10: die Aufgabe „anrufen“ fehlt");
  ok(takt.zahlungstaktStufe(stand(a, { ...beide, aufgabeAm: um(plus(t0, 10), "08:00") }), um(plus(t0, 10), "08:30")) === null, "Tag 10: die Aufgabe entstünde ein zweites Mal");
  ok(takt.zahlungstaktStufe(stand(a, { ...beide, aufgabeAm: um(plus(t0, 10), "08:00") }), um(plus(t0, 25), "10:00")) === null, "Tag 25: nach der Aufgabe geht noch etwas raus");
  // Ab Tag 10 nie mehr eine Mail — auch wenn keine Erinnerung je rausging (Dienst stand).
  ok(takt.zahlungstaktStufe(stand(a), um(plus(t0, 12), "10:00")) === "aufgabe", "Tag 12 ohne jede Erinnerung: es käme eine Mail statt der Aufgabe");

  // Das Fenster: 8–20 Uhr.
  const tag3 = plus(t0, 3);
  ok(takt.zahlungstaktStufe(stand(a), um(tag3, "07:59")) === null, "07:59 Uhr: Mail vor dem Sendefenster");
  ok(takt.zahlungstaktStufe(stand(a), um(tag3, "08:00")) === "erinnerung_1", "08:00 Uhr: Fenster ist noch zu");
  ok(takt.zahlungstaktStufe(stand(a), um(tag3, "19:59")) === "erinnerung_1", "19:59 Uhr: Fenster ist schon zu");
  ok(takt.zahlungstaktStufe(stand(a), um(tag3, "20:00")) === null, "20:00 Uhr: Mail nach dem Sendefenster");
  ok(takt.zahlungstaktStufe(stand(a), um(tag3, "02:30")) === null, "02:30 Uhr: Mail in der Nacht");
  ok(takt.imSendefenster(um("2026-09-19", "12:00")) === true, "Samstag gehört zum Fenster (Mo–Sa)");
  ok(takt.imSendefenster(um("2026-09-20", "12:00")) === false, "Sonntag gehört NICHT zum Fenster");

  // Nur offene Aufträge.
  for (const s of ["bezahlt", "gestartet", "abgeschlossen", "storniert", "nicht_offen"]) {
    for (const n of [3, 7, 10]) ok(takt.zahlungstaktStufe(stand(a, { status: s }), um(plus(t0, n), "11:00")) === null, `Status ${s}, Tag ${n}: der Takt arbeitet an einem nicht offenen Auftrag`);
  }
  // „Überwiesen" gemeldet: keine Mail, die Aufgabe am zehnten Tag entsteht trotzdem.
  const gemeldet = { zahlungGemeldetAm: um(plus(t0, 1), "18:00") };
  ok(takt.zahlungstaktStufe(stand(a, gemeldet), um(plus(t0, 3), "11:00")) === null, "Zahlung gemeldet: Erinnerung 1 geht trotzdem raus");
  ok(takt.zahlungstaktStufe(stand(a, gemeldet), um(plus(t0, 7), "11:00")) === null, "Zahlung gemeldet: Erinnerung 2 geht trotzdem raus");
  ok(takt.zahlungstaktStufe(stand(a, gemeldet), um(plus(t0, 10), "11:00")) === "aufgabe", "Zahlung gemeldet: die Aufgabe am zehnten Tag fehlt");
}
{
  // Auftrag am Donnerstag, 17.09.2026 → Tag 3 ist ein SONNTAG. Der Montag holt nach.
  const t0 = "2026-09-17"; const a = um(t0, "16:45");
  ok(berlinWochentag(plus(t0, 3)) === 7, "Probe-Kalender: 20.09.2026 ist kein Sonntag");
  ok(takt.zahlungstaktStufe(stand(a), um(plus(t0, 3), "12:00")) === null, "Sonntag: Erinnerung 1 geht raus");
  ok(takt.zahlungstaktStufe(stand(a), um(plus(t0, 4), "08:05")) === "erinnerung_1", "Montag nach dem Sonntag: Erinnerung 1 wird nicht nachgeholt");
  // Stufe 1 verspätet (Tag 6) → nicht am Tag 7 gleich die zweite hinterher.
  const spaet = { erinnerung1Am: um(plus(t0, 6), "10:00") };
  ok(takt.zahlungstaktStufe(stand(a, spaet), um(plus(t0, 7), "10:00")) === null, "Erinnerung 1 kam am Tag 6 — Erinnerung 2 folgt schon am Tag 7");
  ok(takt.zahlungstaktStufe(stand(a, spaet), um(plus(t0, 8), "10:00")) === "erinnerung_2", "Erinnerung 1 kam am Tag 6 — Erinnerung 2 kommt am Tag 8 nicht");
  // Auftrag am Mittwoch → Tag 3 ist Samstag: Samstag sendet.
  ok(takt.zahlungstaktStufe(stand(um("2026-09-16", "09:00")), um("2026-09-19", "10:00")) === "erinnerung_1", "Tag 3 am Samstag: Erinnerung 1 fehlt");
}
{
  // Zeitumstellung: Auftrag Fr 23.10.2026, 23:30 Uhr; in der Nacht zum 25.10. wird die Uhr zurückgestellt.
  const a = um("2026-10-23", "23:30");
  ok(takt.berlinTageSeit(a, um("2026-10-26", "08:00")) === 3, `Zeitumstellung: 23.10. 23:30 → 26.10. 08:00 sind ${takt.berlinTageSeit(a, um("2026-10-26", "08:00"))} statt 3 Tage`);
  ok(takt.zahlungstaktStufe(stand(a), um("2026-10-26", "08:00")) === "erinnerung_1", "Zeitumstellung: Erinnerung 1 am Montag, 26.10., fehlt");
  // Kurz nach Mitternacht Berlin (UTC noch Vortag): gezählt wird der BERLINER Kalendertag.
  const b = um("2026-09-14", "00:10");
  ok(berlinDatum(b) === "2026-09-14" && b.toISOString().slice(0, 10) === "2026-09-13", "Probe: 00:10 Uhr Berlin liegt nicht am UTC-Vortag");
  ok(takt.berlinTageSeit(b, um("2026-09-17", "09:00")) === 3, "Auftrag um 00:10 Uhr Berlin: Tage werden nach UTC gezählt");
  ok(takt.taktAnlassStufe("erinnerung_1", false) === 1 && takt.taktAnlassStufe("erinnerung_2", true) === 2, "Anlass-Satz: Stufe 1/2 vertauscht");
  ok(takt.taktAnlassStufe("erinnerung_2", false) === 1, "Anlass-Satz: „zweite und letzte Erinnerung“, obwohl es keine erste gab");
}
{
  // Halbstunden-Durchlauf über 14 Tage — wie der Lauf tickt. Für jeden Wochentag als Auftragstag und
  // vier Uhrzeiten: genau eine Erinnerung 1, eine Erinnerung 2, eine Aufgabe; in dieser Reihenfolge; nie
  // außerhalb des Fensters; nie vor Tag 3 / 7 / 10; zwischen den Erinnerungen mindestens zwei Kalendertage.
  let laeufe = 0;
  for (let w = 0; w < 7; w++) for (const zeit of ["00:10", "09:20", "14:00", "23:40"]) {
    const t0 = plus("2026-09-14", w); const a = um(t0, zeit);
    const s = stand(a); const log: { stufe: string; am: Date }[] = [];
    for (let i = 0; i <= 14 * 48; i++) {
      const jetzt = new Date(a.getTime() + i * 30 * 60_000);
      const stufe = takt.zahlungstaktStufe(s, jetzt);
      if (!stufe) continue;
      log.push({ stufe, am: jetzt });
      if (stufe === "erinnerung_1") s.erinnerung1Am = jetzt; else if (stufe === "erinnerung_2") s.erinnerung2Am = jetzt; else s.aufgabeAm = jetzt;
    }
    laeufe++;
    const wo = `Auftrag ${t0} ${zeit}`;
    ok(log.map((l) => l.stufe).join(",") === "erinnerung_1,erinnerung_2,aufgabe", `${wo}: Folge ist „${log.map((l) => l.stufe).join(",")}“`);
    ok(log.every((l) => takt.imSendefenster(l.am)), `${wo}: eine Stufe fiel außerhalb des Sendefensters`);
    const tage = log.map((l) => takt.berlinTageSeit(a, l.am));
    ok(tage[0] >= 3 && tage[0] <= 4 && tage[1] >= 7 && tage[1] <= 8 && tage[2] >= 10 && tage[2] <= 11, `${wo}: Stufen an den Tagen ${tage.join("/")} statt 3/7/10 (Sonntag: +1)`);
    ok(log.length < 2 || takt.berlinTageSeit(log[0].am, log[1].am) >= takt.TAKT_MINDESTABSTAND_TAGE, `${wo}: Erinnerungen folgen zu dicht`);
  }
  console.log(`  ${laeufe} Durchläufe (7 Wochentage × 4 Uhrzeiten, je 673 Takte): jede Stufe genau einmal.`);
}
{
  const q = lies("server/lib/fiaon-global-zahlungstakt.ts");
  ok(/WHERE ref = \$1 AND \$\{spalte\} IS NULL AND status = 'offen'/.test(q), "Lauf: die Marke wird nicht mehr bedingt genommen (IS NULL AND status = 'offen') — zwei Instanzen könnten doppelt senden");
  ok(/WHERE g\.status = 'offen'/.test(q) && /payment_status/.test(q), "Lauf: liest nicht mehr nur offene Aufträge");
  ok(/darfAnEmpfaenger\(an, "global_zahlung_erinnerung"\)/.test(q), "Lauf: fragt die Frequenzbremse nicht mehr (hart unzustellbare Adressen!)");
  ok(!/UPDATE\s+fiaon_applications|INSERT INTO fiaon_(commissions|abo_raten|bank)/i.test(q), "Lauf: fasst Bestellung oder Geld an");
}

// ═══ B · DIE TÜR ZUM PRIVATBEREICH ══════════════════════════════════════════
abschnitt("B · Login: nur Global / Global + Privat / nur Privat / nichts");
const login = await import("../server/fiaon-login-logic");
type Zeile = Record<string, unknown>;
const G = (mehr: Zeile = {}): Zeile => ({ ref: "FIAON-GLOBAL-1", type: "business", pack_key: "global_struktur", payment_status: "paid", status: "submitted", account_status: "active", merged_into: null, password: null, ...mehr });
const P = (mehr: Zeile = {}): Zeile => ({ ref: "FIAON-PRIVAT-1", type: "private", pack_key: "pro", payment_status: "paid", status: "payment_completed", account_status: "active", merged_into: null, password: "geheim-123", ...mehr });
{
  ok(login.globalKontoLage([G()]) === "nur_global", "Lage: ein bezahlter Global-Auftrag ist nicht „nur_global“");
  ok(login.globalKontoLage([G(), P()]) === "global_und_privat", "Lage: Global + bezahltes Privatpaket ist nicht „global_und_privat“");
  ok(login.globalKontoLage([P()]) === "nur_privat", "Lage: Privatkunde ist nicht „nur_privat“");
  ok(login.globalKontoLage([]) === "nichts" && login.globalKontoLage([G({ payment_status: "pending_payment" })]) === "nichts", "Lage: nichts bezahlt ist nicht „nichts“");
  ok(login.globalKontoLage([P({ type: "business", pack_key: "business_pro" })]) === "nur_privat", "Lage: ein eingestelltes Business-ABO gilt als Global");
  ok(login.globalKontoLage([G({ merged_into: "FIAON-X" })]) === "nichts", "Lage: eine zusammengeführte Dublette zählt mit");
  ok(login.globalKontoLage([G(), P({ ref: "FIAON-SCHUFA-9", type: "schufa", pack_key: "schufa" })]) === "global_und_privat", "Lage: Global + bezahlte Auskunft ist nicht „global_und_privat“");

  // nur Global, kein Passwort (der Normalfall des Firmenkunden)
  let v = login.decideLogin([G()], "irgendwas") as any;
  ok(v.granted === false && v.code === "AUTH-06" && v.globalZugang === true && v.status === 403 && v.ref === "FIAON-GLOBAL-1", `nur Global, kein Passwort: ${JSON.stringify(v)}`);
  ok(!v.actionHref && !/passwort-vergessen/i.test(JSON.stringify(v)), "nur Global: der Hinweis schickt den Firmenkunden in den Privatkunden-Reset");
  // nur Global, Passwort an der Global-Zeile („Zugang retten") — richtig und falsch getippt
  v = login.decideLogin([G({ password: "einmal-77" })], "einmal-77") as any;
  ok(v.granted === false && v.code === "AUTH-06" && v.globalZugang === true, "nur Global, richtiges Passwort: der Privatbereich ginge auf");
  v = login.decideLogin([G({ password: "einmal-77" })], "falsch") as any;
  ok(v.granted === false && v.code === "AUTH-01" && !v.globalZugang, "nur Global, FALSCHES Passwort: die Meldung verrät den Firmenauftrag");
  // Global + Privat bezahlt: der Privatbereich bleibt — und das Konto ist NIE der Global-Auftrag, egal in welcher Reihenfolge
  for (const fam of [[G(), P()], [P(), G()], [G({ password: "einmal-77" }), P()]]) {
    v = login.decideLogin(fam, "geheim-123") as any;
    ok(v.granted === true && v.account?.ref === "FIAON-PRIVAT-1", `Global + Privat: Konto ist ${v.account?.ref ?? v.code}`);
    ok(login.pickAccountRow(fam)?.ref === "FIAON-PRIVAT-1", "Global + Privat: pickAccountRow wählt den Firmenauftrag");
  }
  // Global bezahlt + eigener Privat-Antrag MIT Passwort, noch unbezahlt: bleibt wie vor E-188
  const offenPrivat = P({ payment_status: "pending_payment", status: "submitted", account_status: null });
  v = login.decideLogin([G(), offenPrivat], "geheim-123") as any;
  ok(v.granted === true && v.account?.ref === "FIAON-PRIVAT-1", "Global bezahlt + unbezahlter Privat-Antrag mit Passwort: der Kauf von Global sperrt den bestehenden Login aus");
  ok(login.istNurFirmenkunde([G(), offenPrivat]) === false, "istNurFirmenkunde: Privat-Antrag mit Passwort wird übergangen (Anmelde-Link)");
  // … derselbe Mensch OHNE Passwort am Privat-Antrag (abgebrochener Antrag): Wegweiser
  const abgebrochen = P({ payment_status: "pending", status: "step_2", account_status: null, password: null });
  v = login.decideLogin([G(), abgebrochen], "x") as any;
  ok(v.code === "AUTH-06", "Global bezahlt + abgebrochener Privat-Antrag ohne Passwort: kein Wegweiser zu „Mein Auftrag“");
  ok(login.istNurFirmenkunde([G(), abgebrochen]) === true && login.istNurFirmenkunde([G()]) === true, "istNurFirmenkunde: reiner Firmenkunde nicht erkannt");
  ok(login.istNurFirmenkunde([G({ password: "einmal-77" }), abgebrochen], G({ password: "einmal-77" })) === true, "istNurFirmenkunde: Passwort an der Global-Zeile öffnet den Privatbereich");
  // nichts bezahlt: neutral, kein Wegweiser
  v = login.decideLogin([G({ payment_status: "pending_payment" })], "x") as any;
  ok(v.code === "AUTH-01" && !v.globalZugang, "Global unbezahlt: die neutrale Meldung ist weg");
  // nur Privat: unverändert — und nie der Wegweiser
  v = login.decideLogin([P()], "geheim-123") as any;
  ok(v.granted === true && v.account?.ref === "FIAON-PRIVAT-1", "nur Privat: Login geht nicht mehr");
  ok(login.istNurFirmenkunde([P()]) === false && login.istNurFirmenkunde([]) === false, "istNurFirmenkunde: Privatkunde gilt als Firmenkunde");
  // Der Hinweistext: gesiezt, Wortwand
  const { wandPruefen } = await import("../shared/fiaon-wortverbote");
  const hinweis = `${login.GLOBAL_LOGIN_HINWEIS.error} ${login.GLOBAL_LOGIN_HINWEIS.hint}`;
  ok(wandPruefen(hinweis).length === 0, `Login-Hinweis: Wortwand ${JSON.stringify(wandPruefen(hinweis))}`);
  ok(!/\b(du|dein|deine|dir|dich)\b/i.test(hinweis), "Login-Hinweis duzt");
}

// ── Der Beleg: Familien OHNE Global-Auftrag — alte Fassung gegen neue ───────
abschnitt(`B · Beleg: kein Privatkunden-Login ändert sich (gegen ${BASIS})`);
const alt = mkdtempSync(path.join(tmpdir(), "fiaon-pruef-basis-"));
let altGeladen = false;
try {
  const tar = execFileSync("git", ["-C", WURZEL, "archive", BASIS, "server/mail", "server/fiaon-login-logic.ts", "server/lib/fiaon-kunde-session.ts", "server/lib/fiaon-html-pdf.ts", "server/fiaon-invoice.ts", "server/fiaon-base-url.ts"], { maxBuffer: 64 * 1024 * 1024 });
  execFileSync("tar", ["-x", "-C", alt], { input: tar });
  writeFileSync(path.join(alt, "package.json"), '{"type":"module"}');
  altGeladen = true;
} catch (e) {
  ok(false, `Die Basis ${BASIS} lässt sich nicht aus git lesen (${e instanceof Error ? e.message.split("\n")[0] : e}) — ohne sie gibt es keinen Beleg. PRUEF_BASIS=<commit> setzen.`);
}

if (altGeladen) {
  const loginAlt = await import(path.join(alt, "server/fiaon-login-logic.ts"));
  // Zwölf Zeilen-Urbilder ohne jeden Global-Schlüssel — alles, woran Login und Kontowahl hängen.
  const URBILDER: Zeile[] = [
    { type: "private", pack_key: "pro", payment_status: "paid", status: "payment_completed", account_status: "active", password: "geheim-123" },
    { type: "private", pack_key: "start", payment_status: "paid", status: "documents_submitted", account_status: "active", password: null },
    { type: "private", pack_key: "ultra", payment_status: "paid", status: "completed", account_status: "suspended", password: "geheim-123" },
    { type: "private", pack_key: "pro", payment_status: "pending_payment", status: "submitted", account_status: null, password: "geheim-123" },
    { type: "private", pack_key: "pro", payment_status: "claimed_paid", status: "submitted", account_status: null, password: "anderes-9" },
    { type: "private", pack_key: null, payment_status: "pending", status: "step_2", account_status: null, password: null },
    { type: "schufa", pack_key: "schufa", payment_status: "paid", status: "completed", account_status: "active", password: null, schufa: true },
    { type: "schufa", pack_key: "highend", payment_status: "pending_payment", status: "submitted", account_status: null, password: "geheim-123", schufa: true },
    { type: "business", pack_key: "business_pro", payment_status: "paid", status: "payment_completed", account_status: "active", password: "geheim-123" },
    { type: "private", pack_key: "pro", payment_status: "paid", status: "payment_completed", account_status: "active", password: "geheim-123", dublette: true },
    { type: "private", pack_key: "highend", payment_status: "cancelled", status: "submitted", account_status: null, password: null, utm: { password: "geheim-123" } },
    { type: "private", pack_key: "pro", payment_status: "expired", status: "completed", account_status: "active", password: "" },
  ];
  const zeile = (u: Zeile, i: number): Zeile => {
    const { schufa, dublette, ...rest } = u as any;
    return { ...rest, ref: schufa ? `FIAON-SCHUFA-${i}` : `FIAON-FALL-${i}`, merged_into: dublette ? "FIAON-FALL-GEWINNER" : null };
  };
  const familien: Zeile[][] = [[]];
  for (let a = 0; a < URBILDER.length; a++) {
    familien.push([zeile(URBILDER[a], 1)]);
    for (let b = 0; b < URBILDER.length; b++) {
      familien.push([zeile(URBILDER[a], 1), zeile(URBILDER[b], 2)]);
      for (let c = 0; c < URBILDER.length; c++) familien.push([zeile(URBILDER[a], 1), zeile(URBILDER[b], 2), zeile(URBILDER[c], 3)]);
    }
  }
  const bild = (v: any) => JSON.stringify(v.granted
    ? { granted: true, account: v.account?.ref, matched: v.matched?.ref }
    : { granted: false, status: v.status, code: v.code, reason: v.reason, ref: v.ref, error: v.error, hint: v.hint, action: v.action, actionHref: v.actionHref, extra: Object.keys(v).filter((k) => k === "globalZugang") });
  let faelle = 0; let abweichungen = 0; let erstes = "";
  for (const fam of familien) {
    for (const pw of ["geheim-123", "falsch-000"]) {
      faelle++;
      const n = bild(login.decideLogin(fam, pw)); const a = bild(loginAlt.decideLogin(fam, pw));
      if (n !== a) { abweichungen++; erstes ||= `Passwort ${pw} · ${JSON.stringify(fam)} · alt ${a} · neu ${n}`; }
    }
    const pn = login.pickAccountRow(fam)?.ref ?? null; const pa = loginAlt.pickAccountRow(fam)?.ref ?? null;
    if (pn !== pa) { abweichungen++; erstes ||= `pickAccountRow · ${JSON.stringify(fam)} · alt ${pa} · neu ${pn}`; }
    if (login.globalKontoLage(fam) === "nur_global" || login.globalKontoLage(fam) === "global_und_privat" || login.istNurFirmenkunde(fam)) { abweichungen++; erstes ||= `Lage „Global“ ohne Global-Zeile · ${JSON.stringify(fam)}`; }
  }
  ok(abweichungen === 0, `${abweichungen} von ${faelle} Fällen entscheiden anders als vor dem Umbau — erster: ${erstes}`);
  console.log(`  ${familien.length} Familien ohne Global-Auftrag × 2 Passwörter = ${faelle} Entscheidungen, dazu die Kontowahl: ${abweichungen} Abweichungen zur Fassung ${BASIS}.`);
}

// ═══ C · DIE MAILS IN ZWEI SPRACHEN ═════════════════════════════════════════
abschnitt("C · Mails: Paare, Sprache, Wortwand, Verbote");
const { wandPruefen } = await import("../shared/fiaon-wortverbote");
const motor = await import("../server/mail/motor");
const vorlagen = await import("../server/mail/vorlagen/global");
const auftrag = await import("../server/lib/fiaon-global-auftrag");
const { GLOBAL_PAKETE } = await import("../shared/fiaon-global");

// Die schärferen Global-Regeln stehen in scripts/pruef-wortwand-de.ts (dort nicht exportiert, und der
// Import würde den ganzen Prüfstand ausführen). Statt einer dritten Kopie liest dieser Prüfstand die
// Liste aus dessen Quelltext — läuft sie dort weiter, läuft sie hier mit.
const SCHAERFER: { muster: RegExp; grund: string }[] = [];
for (const m of lies("scripts/pruef-wortwand-de.ts").matchAll(/\{ muster: \/(.+?)\/([a-z]*), grund: "([^"]+)" \}/g)) SCHAERFER.push({ muster: new RegExp(m[1], m[2]), grund: m[3] });
ok(SCHAERFER.length >= 10, `Die schärferen Global-Regeln ließen sich nicht aus scripts/pruef-wortwand-de.ts lesen (${SCHAERFER.length} gefunden)`);
// Dieselben Grenzen auf Englisch — plus die Verbote aus scripts/seo-wortverbote-en.ts (guarantee, advice, recommend, affiliate).
const SCHAERFER_EN: { muster: RegExp; grund: string }[] = [
  { muster: /\bup to\b/i, grund: "„up to“ ist ein Spitzenwert-Versprechen" },
  { muster: /\b(capital one|american express|amex|bank of america|chase|mercury|brex|ramp)\b/i, grund: "kein Bankname" },
  { muster: /\b(within|in)\s+\d+\s*(–|-|to)?\s*\d*\s*(days|working days|weeks|months)\b/i, grund: "keine Frist mit Ziffer" },
  { muster: /\b0\s?%/, grund: "kein Zinssatz als Zahl" },
  { muster: /\brecommend\w*\b/i, grund: "keine Empfehlung" },
  { muster: /\b(without|no) collateral\b|\bunsecured\b/i, grund: "die persönliche Haftung IST die Sicherheit" },
  { muster: /\bconsult(ing|ancy)\b/i, grund: "Selbstbezeichnung" },
  { muster: /\bsave tax|tax saving|tax advantage/i, grund: "kein Steuerversprechen" },
  { muster: /\baffiliate/i, grund: "Wortverbot" },
];
const EN_SATZ_ERLAUBT = /\b(no|not|never|nobody|no one|cannot|can't|neither|nor|without|instead)\b/i;
function englischeVerbote(text: string): string[] {
  const funde: string[] = [];
  for (const r of SCHAERFER_EN) if (r.muster.test(text)) funde.push(`${r.grund}: „${text.match(r.muster)?.[0]}“`);
  for (const m of text.matchAll(/\b(guarantee[sd]?|advice)\b/gi)) {
    const a = Math.max(text.lastIndexOf(". ", m.index!), text.lastIndexOf("\n", m.index!), 0);
    const bRoh = [text.indexOf(". ", m.index!), text.indexOf("\n", m.index!)].filter((x) => x >= 0);
    const satz = text.slice(a, bRoh.length ? Math.min(...bRoh) + 1 : text.length);
    if (!EN_SATZ_ERLAUBT.test(satz)) funde.push(`„${m[0]}“ ohne Verneinung: ${satz.trim().slice(0, 100)}`);
  }
  return funde;
}
// Deutsche Reste in einer englischen Mail: Umlaute und die Wörter, die das Gerüst und die Vorlagen deutsch tragen.
const DEUTSCHER_REST = /[äöüÄÖÜß]|\b(und|oder|nicht|der|die|das|den|dem|ein|eine|Ihr|Ihre|Ihren|Ihrem|Sie|wir|uns|mit|für|auf|von|zur|zum|ist|sind|Auftrag|Rechnung|Zahlung|Zahlungsseite|Vertrag|Paket|Betrag|Verwendungszweck|Ansprechpartner|Stichtag|Fragen|Antworten|Impressum|Datenschutz|Abmelden|Nachricht|automatisch|Guten Tag|Erinnerung|einmalig|Unterlagen|Bezahlt|Zahlbar)\b/;
const DROHWORT_DE = /\b(mahnung|mahnstufe|mahngebühr|letzte frist|letztmalig|inkasso|gericht|mahnverfahren|rechtliche schritte|gebühr|verzug|sperr)/i;
const DROHWORT_EN = /\b(final notice|final demand|debt collect|legal action|court|late fee|penalt|default|overdue|suspend)/i;
const IBAN = /\b[A-Z]{2}\d{2}[ ]?[A-Z0-9]{4}[ ]?\d{4}/;

const AKTE = (sprache: "de" | "en") => ({
  ref: "FIAON-PRUEFSTAND-0001", paket_key: "global_kapital", vertrag_sprache: sprache, email: "M.Muster@Muster-GmbH.example ",
  firma: { name: "Muster & Söhne <b>GmbH</b>", ort: "München", land: "DE" }, firma_name: "Muster & Söhne GmbH", zustaendig_agent_id: 8,
  ansprechpartner: { anrede: "Herr", vorname: "Max", nachname: "Muster", funktion: "Geschäftsführer", email: "m.muster@muster-gmbh.example", telefon: "+491711234567" },
});
const BESTELLUNG = { ref: "FIAON-PRUEFSTAND-0001", person_id: 4711, pack_key: "global_kapital", pack_name: "FIAON Global Kapital", payment_reference: "FIAON-A1B2C3", payment_status: "pending_payment", payment_due_date: new Date("2026-09-24T10:00:00Z"), amount_due: "9999.00", company_name: "Muster & Söhne GmbH", contact_name: "Max Muster" };
const GEDECKT: Record<string, string[]> = { global_start: ["aufgabe_an_betreuer"] };
const kapital = GLOBAL_PAKETE.find((p) => p.key === "global_kapital")!;

const ereignisse = Object.keys(vorlagen.GLOBAL_VORLAGEN_PAARE);
ok(["global_auftrag", "global_zahlung_erinnerung", "global_start", "global_stichtag"].every((e) => ereignisse.includes(e)), `Vorlagen fehlen: ${ereignisse.join(", ")}`);
// global_zugang lebt seit dem Merge (18.09.2026) EINMAL in vorlagen/global-bereich.ts — beide Sprachen im Motor.
ok(!!motor.VORLAGEN.global_zugang && !!motor.VORLAGEN_EN.global_zugang && !ereignisse.includes("global_zugang"), "global_zugang: nicht genau eine Vorlage je Sprache");
for (const event of ereignisse) {
  const paar = vorlagen.GLOBAL_VORLAGEN_PAARE[event];
  // Aufbau der Paare: gleich viele Absätze und Datenzeilen, dieselben Knöpfe, dieselben Platzhalter.
  const platzhalter = (b: unknown) => Array.from(new Set(Array.from(JSON.stringify(b).matchAll(/\{\{params\.([a-z_0-9]+)\}\}/g)).map((m) => m[1]))).sort().join(",");
  ok(paar.de.absaetze.length === paar.en.absaetze.length, `${event}: ${paar.de.absaetze.length} deutsche, ${paar.en.absaetze.length} englische Absätze`);
  ok((paar.de.daten ?? []).length === (paar.en.daten ?? []).length, `${event}: Datenkasten de/en ungleich lang`);
  ok(paar.de.knopf?.url === paar.en.knopf?.url && paar.de.knopf2?.url === paar.en.knopf2?.url, `${event}: Knöpfe de/en führen an verschiedene Orte`);
  ok(platzhalter(paar.de) === platzhalter(paar.en), `${event}: Platzhalter de „${platzhalter(paar.de)}“ ≠ en „${platzhalter(paar.en)}“`);
  ok(paar.de.sprache === undefined && paar.en.sprache === "en", `${event}: Rahmensprache falsch gesetzt (de muss OHNE Angabe bleiben)`);
  ok(!!paar.de.kopfSatz && !!paar.de.rechtsSatz && !!paar.en.kopfSatz && !!paar.en.rechtsSatz, `${event}: Kopf- oder Rechtssatz der Global-Linie fehlt`);
  ok(!paar.de.karteZiel && !paar.en.karteZiel, `${event}: trägt den Kartenblock der Privatkundenlinie`);

  for (const sprache of ["de", "en"] as const) {
    const token = auftrag.globalTokenErzeugen("FIAON-PRUEFSTAND-0001");
    const nutzlast = auftrag.globalMailNutzlast(AKTE(sprache), BESTELLUNG, {
      ansprechpartner: sprache === "en" ? "Mr Example" : "Herr Beispiel", token,
      zusatz: { stichtag_text: auftrag.globalTagText("2026-10-30", sprache), anlass: vorlagen.GLOBAL_ERINNERUNG_ANLASS[sprache][event === "global_zahlung_erinnerung" ? 2 : 1] },
    });
    const mail = motor.mailRendern(event, nutzlast);
    ok(!!mail, `${event}/${sprache}: fehlt im Motor`);
    if (!mail) continue;
    const wo = `${event}/${sprache}`;
    ok(mail.fehlend.length === 0, `${wo}: Platzhalter ohne Wert — ${mail.fehlend.join(", ")}`);
    ok(!/\{\{|\}\}|%%/.test(mail.html + mail.text + mail.betreff), `${wo}: ungefüllter Platzhalter im Ergebnis`);
    ok(!/Bonität ist machbar|keine Löschung berechtigter Einträge|Ihr Ziel bleibt die eigene Karte/.test(mail.html), `${wo}: trägt Sätze der Privatkundenlinie`);
    ok(mail.html.includes("FIAON Global"), `${wo}: Kopfsatz „FIAON Global“ fehlt`);
    ok(!IBAN.test(mail.text) && !/\bBIC\b|\bIBAN\b/.test(mail.text.replace(/IBAN, amount|IBAN, Betrag/g, "")), `${wo}: Bankdaten im Mailtext`);
    ok(!mail.html.includes("<b>GmbH</b>") && nutzlast.firma.includes("&lt;b&gt;GmbH&lt;/b&gt;"), `${wo}: HTML aus dem Firmennamen wird nicht entschärft`);
    ok(sprache === "en" ? /^€\d{1,3}(,\d{3})*\.\d{2}$/.test(nutzlast.betrag_text) : /^\d{1,3}(\.\d{3})*,\d{2}\s€$/.test(nutzlast.betrag_text), `${wo}: Betrag „${nutzlast.betrag_text}“ nicht im Zahlenbild der Sprache`);
    ok(nutzlast.email === "m.muster@muster-gmbh.example", `${wo}: Empfänger ist nicht die Adresse der Akte, klein und ohne Leerraum`);
    if (sprache === "de") {
      ok(mail.html.includes('lang="de"') && mail.text.includes("Impressum: fiaon.com/impressum"), `${wo}: deutscher Rahmen fehlt`);
      ok(mail.betreff.includes("FIAON Global Kapital") || event === "global_stichtag", `${wo}: Paketname fehlt im Betreff („${mail.betreff}“)`);
      for (const t of wandPruefen(mail.text, GEDECKT[event] ?? [])) ok(false, `${wo}: Wortwand [${t.art}] „${t.treffer}“ — ${t.hinweis}`);
      for (const r of SCHAERFER) ok(!r.muster.test(mail.text), `${wo}: E-188-Regel „${r.grund}“ → „${mail.text.match(r.muster)?.[0]}“`);
      // Drohworte zählen dort, wo es um offenes Geld geht — der Kostensatz der Rollen („Gebühren der Behörden") ist keine Drohung.
      if (event === "global_zahlung_erinnerung") ok(!DROHWORT_DE.test(mail.text), `${wo}: Drohwort „${mail.text.match(DROHWORT_DE)?.[0]}“`);
      ok(!/\b(du|dein|deine|dir|dich)\b/.test(mail.text), `${wo}: duzt den Kunden`);
    } else {
      ok(mail.html.includes('lang="en"') && !mail.html.includes('lang="de"'), `${wo}: lang-Attribut ist nicht „en“`);
      ok(mail.text.includes("Legal notice: fiaon.com/impressum") && mail.html.includes(">Privacy<"), `${wo}: englischer Rahmen fehlt`);
      ok(mail.betreff.includes(`FIAON ${kapital.en.name}`) || event === "global_stichtag", `${wo}: englischer Paketname fehlt im Betreff („${mail.betreff}“)`);
      // Eigennamen und Adressen sind keine deutschen Reste.
      // Der Textteil schreibt den Titel in GROSSBUCHSTABEN — deshalb zählt zusätzlich der sichtbare Text des HTML-Teils.
      const sichtbar = mail.html.slice(mail.html.indexOf("<body")).split(nutzlast.firma).join("·").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#\d+;|&[a-z]+;/g, " ");
      const nackt = `${mail.text}\n${sichtbar}`.replace(/Muster & Söhne <b>GmbH<\/b>|Muster &amp; Söhne &lt;b&gt;GmbH&lt;\/b&gt;|Mr Muster|Mr Example|https?:\/\/\S+|fiaon\.com\/\S+|FIAON-[A-Z0-9-]+/g, "·");
      const rest = nackt.match(DEUTSCHER_REST);
      ok(!rest, `${wo}: deutscher Rest „${rest?.[0]}“ in „…${rest ? nackt.slice(Math.max(0, (rest.index ?? 0) - 40), (rest.index ?? 0) + 40).replace(/\s+/g, " ") : ""}…“`);
      ok(!DEUTSCHER_REST.test(mail.betreff.replace(/FIAON-[A-Z0-9-]+/g, "")), `${wo}: deutscher Rest im Betreff „${mail.betreff}“`);
      for (const f of englischeVerbote(mail.text)) ok(false, `${wo}: englisches Verbot — ${f}`);
      if (event === "global_zahlung_erinnerung") ok(!DROHWORT_EN.test(mail.text), `${wo}: Drohwort „${mail.text.match(DROHWORT_EN)?.[0]}“`);
      ok(!/\d{2}\.\d{2}\.\d{4}/.test(mail.text), `${wo}: Datum im deutschen Zahlenbild`);
    }
    if (paar[sprache].knopf?.url.includes("mein_auftrag_url") || paar[sprache].knopf2?.url.includes("mein_auftrag_url")) {
      const m = mail.html.match(/href="([^"]*\/business\/auftrag\/([^"?]+)\?t=([^"&]+))"/);
      ok(!!m, `${wo}: der Link zu „Mein Auftrag“ fehlt im HTML`);
      ok(!!m && decodeURIComponent(m[2]) === "FIAON-PRUEFSTAND-0001" && auftrag.globalTokenPruefen("FIAON-PRUEFSTAND-0001", decodeURIComponent(m[3])) === "gueltig", `${wo}: der Link zu „Mein Auftrag“ trägt kein gültiges Token für diesen Auftrag`);
      ok(!!m && auftrag.globalTokenPruefen("FIAON-FREMDER-AUFTRAG", decodeURIComponent(m[3])) === null, `${wo}: das Token öffnet einen fremden Auftrag`);
    }
    if (event === "global_zahlung_erinnerung") {
      ok(mail.html.includes("/zahlung/FIAON-A1B2C3"), `${wo}: Knopf zur Zahlungsseite fehlt`);
      ok(mail.text.includes(vorlagen.GLOBAL_ERINNERUNG_ANLASS[sprache][2]), `${wo}: der Anlass-Satz steht nicht in der Mail`);
      ok(motor.absenderFuer(event).email === motor.absenderFuer("global_auftrag").email, `${wo}: Absender ist nicht die Buchhaltung wie bei der Rechnung`);
    }
  }
}
{
  // Ohne `sprache` (oder mit „de") bleibt es die deutsche Fassung; eine Privatkunden-Mail reagiert auf `sprache: "en"` gar nicht.
  const n = auftrag.globalMailNutzlast(AKTE("de"), BESTELLUNG, { ansprechpartner: "Herr Beispiel", token: auftrag.globalTokenErzeugen("FIAON-PRUEFSTAND-0001") });
  const { sprache: _weg, ...ohne } = n;
  ok(motor.mailRendern("global_zugang", ohne)?.html === motor.mailRendern("global_zugang", n)?.html, "global_zugang: ohne Sprachfeld kommt nicht die deutsche Fassung");
  ok(Object.keys(motor.VORLAGEN_EN).every((e) => e.startsWith("global_")), `Englische Fassungen außerhalb von FIAON Global: ${Object.keys(motor.VORLAGEN_EN).filter((e) => !e.startsWith("global_")).join(", ")}`);
  const probe = { email: "k@example.org", vorname: "Kim", payment_reference: "FIAON-A1B2C3", amount_due: "59,99", pack_name: "FIAON Pro" };
  ok(motor.mailRendern("payment_details", probe)?.html === motor.mailRendern("payment_details", { ...probe, sprache: "en" })?.html, "payment_details ändert sich durch sprache: \"en\" in der Nutzlast");
  ok(auftrag.globalSpracheVon({ vertrag_sprache: " EN " }) === "en" && auftrag.globalSpracheVon({}) === "de" && auftrag.globalSpracheVon({ vertrag_sprache: "fr" }) === "de", "globalSpracheVon: Rückfall ist nicht Deutsch");
  // Die Unterlagenliste: gleiche Länge, und die Anlass-Sätze passieren die Wand.
  ok(vorlagen.GLOBAL_UNTERLAGEN.length === vorlagen.GLOBAL_UNTERLAGEN_EN.length, "Unterlagenliste de/en ungleich lang");
  for (const s of [1, 2] as const) ok(wandPruefen(vorlagen.GLOBAL_ERINNERUNG_ANLASS.de[s]).length === 0, `Anlass-Satz ${s}: Wortwand`);
}

{
  // Die Bestätigung des Erstgesprächs (global_termin): Global-Rahmen statt Privatkunden-Rahmen, und englisch für /en/business.
  const termin = await import("../server/mail/vorlagen/termin");
  const { globalTerminPayload } = await import("../server/lib/fiaon-global-termin");
  const de = termin.TERMIN_VORLAGEN.global_termin; const en = termin.GLOBAL_TERMIN_EN.global_termin;
  const platzhalter = (b: unknown) => Array.from(new Set(Array.from(JSON.stringify(b).matchAll(/\{\{params\.([a-z_0-9]+)\}\}/g)).map((m) => m[1]))).sort().join(",");
  ok(de.absaetze.length === en.absaetze.length && (de.daten ?? []).length === (en.daten ?? []).length && de.knopf?.url === en.knopf?.url && de.knopf2?.url === en.knopf2?.url && platzhalter(de) === platzhalter(en), "global_termin: das Paar de/en ist nicht gleich gebaut");
  const ein = { email: "m.muster@muster-gmbh.example", name: "Max Muster", firma: "Muster GmbH", telefon: "+49 171 1234567", paketText: "Global Kapital (6.999 €)", ansprechpartner: "Daniel", datumText: "Donnerstag, 24.09.2026", uhrzeit: "14:30", stornoToken: "abc123", beginn: "2026-09-24T12:30:00Z", paket: "global_kapital" };
  for (const sprache of ["de", "en"] as const) {
    const mail = motor.mailRendern("global_termin", globalTerminPayload({ ...ein, sprache }));
    const wo = `global_termin/${sprache}`;
    ok(!!mail && mail.fehlend.length === 0, `${wo}: Platzhalter ohne Wert — ${mail?.fehlend.join(", ")}`);
    if (!mail) continue;
    ok(mail.html.includes("FIAON Global") && !/Bonität ist machbar|keine Löschung berechtigter Einträge/.test(mail.html), `${wo}: trägt den Privatkunden-Rahmen`);
    if (sprache === "de") {
      for (const t of wandPruefen(mail.text, ["aufgabe_an_betreuer"])) ok(false, `${wo}: Wortwand [${t.art}] „${t.treffer}“`);
      for (const r of SCHAERFER) ok(!r.muster.test(mail.text), `${wo}: E-188-Regel „${r.grund}“`);
      ok(mail.text.includes("Donnerstag, 24.09.2026"), `${wo}: deutsches Datum fehlt`);
    } else {
      const sichtbar = mail.html.slice(mail.html.indexOf("<body")).replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#\d+;|&[a-z]+;/g, " ");
      const nackt = `${mail.text}\n${sichtbar}`.replace(/Muster GmbH|Max Muster|Daniel|https?:\/\/\S+|fiaon\.com\/\S+/g, "·");
      const rest = nackt.match(DEUTSCHER_REST);
      ok(!rest, `${wo}: deutscher Rest „${rest?.[0]}“ in „…${rest ? nackt.slice(Math.max(0, (rest.index ?? 0) - 40), (rest.index ?? 0) + 40).replace(/\s+/g, " ") : ""}…“`);
      for (const f of englischeVerbote(mail.text)) ok(false, `${wo}: englisches Verbot — ${f}`);
      ok(mail.text.includes("Thursday, 24 September 2026") && mail.text.includes("14:30 (German time)"), `${wo}: Datum/Uhrzeit nicht im englischen Bild (deutsche Zeit)`);
      ok(mail.text.includes(`FIAON ${kapital.en.name}`), `${wo}: englischer Paketname fehlt`);
    }
  }
}

// ═══ D · DAS GERÜST: DEUTSCHE MAILS BYTE-GLEICH ═════════════════════════════
abschnitt(`D · Gerüst: deutsche Mails byte-gleich (gegen ${BASIS})`);
if (altGeladen && BYTEVERGLEICH) {
  const geruestAlt = await import(path.join(alt, "server/mail/geruest.ts"));
  const motorAlt = await import(path.join(alt, "server/mail/motor.ts"));
  const geruestNeu = await import("../server/mail/geruest");
  const { MAKE_EVENT_REGISTRY } = await import("../server/make-events-registry");
  const beispiel = (event: string): Record<string, unknown> => ({ ...(MAKE_EVENT_REGISTRY.find((d: any) => d.type === event)?.example ?? {}) });

  // (1) Dieselben Bausteine durch das alte und das neue Gerüst: HTML und Text, Byte für Byte.
  let bausteine = 0; let ungleich: string[] = [];
  for (const [event, b] of Object.entries(motor.VORLAGEN)) {
    bausteine++;
    if (sha(geruestAlt.mailHtml(b)) !== sha(geruestNeu.mailHtml(b))) ungleich.push(`${event} (HTML)`);
    if (sha(geruestAlt.mailText(b)) !== sha(geruestNeu.mailText(b))) ungleich.push(`${event} (Text)`);
  }
  // … auch mit Abmeldezeile, persönlicher Mail und Kartenblock — die Zweige, die der Umbau anfasst.
  const sonder = { betreff: "Probe", preheader: "Probe", titel: "Probe", absaetze: ["Ein Absatz.\nZweite Zeile."], abmeldeUrl: "https://fiaon.com/abmelden/abc", fussnote: "Fußnote" };
  for (const b of [sonder, { ...sonder, persoenlich: true }, { ...sonder, karteZiel: true }, { ...sonder, kopfSatz: "FIAON Global", rechtsSatz: "Rollensatz." }, { ...sonder, sprache: "de" as const }]) {
    bausteine++;
    if (sha(geruestAlt.mailHtml(b)) !== sha(geruestNeu.mailHtml(b))) ungleich.push(`Sonderbaustein ${JSON.stringify(Object.keys(b).slice(6))} (HTML)`);
    if (sha(geruestAlt.mailText(b)) !== sha(geruestNeu.mailText(b))) ungleich.push(`Sonderbaustein ${JSON.stringify(Object.keys(b).slice(6))} (Text)`);
  }
  ok(ungleich.length === 0, `Das neue Gerüst rendert deutsche Bausteine anders: ${ungleich.join(", ")}`);
  console.log(`  ${bausteine} deutsche Bausteine × (HTML + Text) durch altes und neues Gerüst: ${ungleich.length} Abweichungen.`);

  // (2) Die fertige Mail (Motor + Gerüst + Vorlage) mit der Beispiel-Nutzlast des Registers — für jede
  //     Vorlage, deren Baustein seit der Basis nicht absichtlich geändert wurde.
  let gleich = 0; let geaendert: string[] = []; let anders: string[] = [];
  for (const event of Object.keys(motorAlt.VORLAGEN)) {
    if (JSON.stringify(motorAlt.VORLAGEN[event]) !== JSON.stringify(motor.VORLAGEN[event])) { geaendert.push(event); continue; }
    const a = motorAlt.mailRendern(event, beispiel(event)); const n = motor.mailRendern(event, beispiel(event));
    if (!a || !n || sha(a.betreff + a.html + a.text) !== sha(n.betreff + n.html + n.text) || a.absender.email !== n.absender.email) anders.push(event); else gleich++;
  }
  ok(anders.length === 0, `Fertige Mails weichen ab: ${anders.join(", ")}`);
  ok(geaendert.every((e) => e.startsWith("global_")), `Seit ${BASIS} geänderte Vorlagen AUSSERHALB von FIAON Global: ${geaendert.filter((e) => !e.startsWith("global_")).join(", ")}`);
  ok(gleich >= 50, `Nur ${gleich} fertige Mails verglichen — die Basis passt nicht zum Stand`);
  console.log(`  ${gleich} fertige Mails (Betreff + HTML + Text, SHA-256) byte-gleich zur Fassung ${BASIS}; absichtlich geändert: ${geaendert.join(", ") || "keine"}.`);

  // (3) Der PDF-Fuß: deutsch wörtlich wie vor dem Umbau, englisch „Page … of …".
  const pdfNeu = await import("../server/lib/fiaon-html-pdf");
  const pdfAltQuelle = readFileSync(path.join(alt, "server/lib/fiaon-html-pdf.ts"), "utf8");
  const de = pdfNeu.fusszeilenVorlage("FIAON Global · Auftrag <1>"); const en = pdfNeu.fusszeilenVorlage("FIAON Global · Order <1>", "en");
  ok(pdfAltQuelle.includes('`Seite <span class="pageNumber"></span> von <span class="totalPages"></span></span>`'), "Basis: die alte Fußzeile steht nicht mehr so im Quelltext — Vergleich prüfen");
  ok(de.includes('Seite <span class="pageNumber"></span> von <span class="totalPages"></span></span>') && de === pdfNeu.fusszeilenVorlage("FIAON Global · Auftrag <1>", "de"), "PDF-Fuß deutsch: nicht mehr „Seite X von Y“");
  ok(en.includes('Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>') && !/Seite|von </.test(en), "PDF-Fuß englisch: nicht „Page X of Y“");
  ok(de.includes("&lt;1&gt;") && de.replace("Seite", "Page").replace(" von ", " of ").replace("Auftrag", "Order") === en, "PDF-Fuß: die Sprachen unterscheiden sich in mehr als den zwei Wörtern");
  ok(/sprache: d\.sprache/.test(lies("server/lib/fiaon-global-vertrag.ts")), "Vertrag: reicht die Sprache nicht an die Fußzeile durch");

  // (4) Die Rechnung: deutsch Byte für Byte wie vor dem Umbau (Privatkunde, Firmenkunde ohne und mit
  //     Reverse Charge); die englische Zweitzeile erscheint NUR mit rechnung_sprache = "en" am Firmenauftrag.
  const PDFDocument = (await import("pdfkit")).default;
  const rechnungNeu = await import("../server/fiaon-invoice");
  const rechnungAlt = await import(path.join(alt, "server/fiaon-invoice.ts"));
  const zeichne = (render: (doc: any, a: any) => void, zeile: any): Promise<string> => new Promise((ja, nein) => {
    const doc = new PDFDocument({ size: "A4", margin: 50, info: { CreationDate: new Date("2026-09-17T10:00:00Z") } });
    const teile: Buffer[] = []; doc.on("data", (c: Buffer) => teile.push(c)); doc.on("error", nein);
    doc.on("end", () => ja(Buffer.concat(teile).toString("latin1").replace(/\/ID \[[^\]]*\]/g, "").replace(/\/CreationDate \([^)]*\)/g, "")));
    render(doc, zeile); doc.end();
  });
  const kopf = { ref: "FIAON-MB2XK4LQ-7T9A", invoice_number: "FIAON-INV-2026-00321", invoice_date: "2026-09-17T10:00:00Z", payment_reference: "FIAON-A1B2C3", payment_due_date: "2026-09-24T10:00:00Z" };
  const privat = { ...kopf, pack_key: "pro", pack_name: "FIAON Pro", amount_due: "59.99", first_name: "Kim", last_name: "Beispiel", street: "Weg 1", zip: "10115", city: "Berlin", email: "kim@example.org" };
  const firma = { ...kopf, pack_key: "global_kapital", pack_name: "FIAON Global Kapital", amount_due: "6999.00", company_name: "Muster & Söhne Projektentwicklungsgesellschaft mbH", contact_name: "Max Muster", street: "Beispielweg 12", zip: "80331", city: "München", country: "DE", tax_id: "DE123456789", contact_email: "m.muster@muster-gmbh.example" };
  for (const [name, zeile] of Object.entries({ "Privatkunde": privat, "Privatkunde mit rechnung_sprache en": { ...privat, rechnung_sprache: "en" }, "Firmenkunde": firma, "Firmenkunde Reverse Charge": { ...firma, rechnung_ust_modus: "reverse_charge" } })) {
    ok(sha(await zeichne(rechnungNeu.renderInvoicePdf, zeile)) === sha(await zeichne(rechnungAlt.renderInvoicePdf, zeile)), `Rechnung „${name}“: nicht mehr byte-gleich zur Fassung ${BASIS}`);
  }
  for (const modus of ["none", "reverse_charge"]) {
    const de = await zeichne(rechnungNeu.renderInvoicePdf, { ...firma, rechnung_ust_modus: modus });
    const en = await zeichne(rechnungNeu.renderInvoicePdf, { ...firma, rechnung_ust_modus: modus, rechnung_sprache: "en" });
    ok(en !== de && en.length > de.length, `Rechnung en (${modus}): trägt keine englische Zweitzeile`);
    ok((en.match(/\/Type \/Page\b/g) ?? []).length === 1, `Rechnung en (${modus}): läuft über mehr als eine Seite`);
  }
  // Fünf Zeichenstellen der Bestellrechnung (Kunde, Betreuer, Verwaltung, ZIP-Export, Mail-Anhang) — jede setzt die Sprache.
  for (const [d, muster] of [["server/lib/fiaon-rechnung-pdf.ts", /await zeichnen\(a\)/g], ["server/routes/fiaon-antrag.ts", /renderInvoicePdf\(doc, /g], ["server/routes/fiaon-agent.ts", /renderInvoicePdf\(doc, /g]] as const) {
    const q = lies(d);
    ok((q.match(/await rechnungsSpracheSetzen\(sqlPool, /g) ?? []).length === (q.match(muster) ?? []).length, `${d}: nicht jede Zeichenstelle der Bestellrechnung setzt die Sprache — der Kunde sähe eine andere Rechnung als das Haus`);
  }
}
rmSync(alt, { recursive: true, force: true });

// ═══ E · STORNO, ZUGANG, MARA-WAND ══════════════════════════════════════════
abschnitt("E · Storno, Zugang, Mara-Wand");
{
  const { globalStornoPruefen } = await import("../server/lib/fiaon-global-storno");
  const gut = (v: any) => v.ok === true; const nein = (v: any) => v.ok === false;
  ok(gut(globalStornoPruefen({ status: "offen", bezahlt: false }, { grund: "Kunde will nicht mehr." })), "Storno offen mit Grund wird abgelehnt");
  ok(nein(globalStornoPruefen({ status: "offen", bezahlt: false }, { grund: "  " })), "Storno ohne Grund geht durch");
  ok(nein(globalStornoPruefen({ status: "offen", bezahlt: false }, { grund: "Kunde will nicht mehr.", erstattung: true })), "Erstattung ohne gebuchte Zahlung geht durch");
  ok(nein(globalStornoPruefen({ status: "gestartet", bezahlt: true }, { grund: "zu kurz" })), "Storno BEZAHLT mit Grund unter zehn Zeichen geht durch");
  ok(nein(globalStornoPruefen({ status: "gestartet", bezahlt: true }, { grund: "a        b" })), "Storno BEZAHLT: Leerzeichen zählen als Grund");
  ok(gut(globalStornoPruefen({ status: "gestartet", bezahlt: true }, { grund: "Kunde beendet vor der Gründung.", erstattung: true })), "Storno bezahlt mit Satz und Erstattung wird abgelehnt");
  ok((globalStornoPruefen({ status: "bezahlt", bezahlt: true }, { grund: "Kunde beendet vor der Gründung.", erstattung: "true" }) as any).daten?.erstattung === false, "Erstattung: der TEXT „true“ zählt als Ja (nur boolean true)");
  ok(nein(globalStornoPruefen({ status: "storniert", bezahlt: false }, { grund: "noch einmal stornieren" })), "Ein stornierter Auftrag lässt sich erneut stornieren");
  ok(nein(globalStornoPruefen({ status: "abgeschlossen", bezahlt: true }, { grund: "nach Abschluss stornieren" })), "Ein abgeschlossener Auftrag lässt sich stornieren");
  const q = lies("server/lib/fiaon-global-storno.ts");
  ok(!/INSERT INTO fiaon_(commissions|abo_raten|bank|zahlung)|UPDATE fiaon_(commissions|bank)/i.test(q), "Storno: schreibt selbst eine Geldbuchung");
  ok(/anBetreiber: true/.test(q) && /Erstattung veranlassen/.test(q), "Storno: die Erstattung ist keine Aufgabe an Justin mehr");
  ok(/requireChef\("leitung"\)/.test(lies("server/routes/fiaon-global.ts").split('"/admin/global/auftraege/:ref/storno"')[1]?.slice(0, 80) ?? ""), "Storno-Route steht nicht hinter requireChef(\"leitung\")");
  ok(/senden\(z\.ref, "storno"/.test(lies("client/src/components/admin/ChefGlobalAuftraege.tsx")), "Storno: die Leitungs-Seite hat keinen Knopf zur Route");
}
{
  const z = await import("../server/lib/fiaon-global-zugang");
  ok(z.globalZugangAdresse("  M.Muster@Muster-GmbH.example ") === "m.muster@muster-gmbh.example", "Zugang: Adresse wird nicht geglättet");
  for (const falsch of ["", "kein-at", "a@b", "a b@c.de", "x".repeat(250) + "@a.de", null, undefined]) ok(z.globalZugangAdresse(falsch) === null, `Zugang: „${String(falsch).slice(0, 20)}“ gilt als Adresse`);
  z.globalZugangDrosselLeeren();
  const t = Date.UTC(2026, 8, 17, 10, 0, 0);
  ok([0, 1, 2].every((i) => z.globalZugangErlaubt("a@firma.example", t + i * 1000)), "Zugang: die ersten drei Anforderungen je Stunde werden gebremst");
  ok(z.globalZugangErlaubt("a@firma.example", t + 5000) === false, "Zugang: die vierte Anforderung in einer Stunde geht durch");
  ok(z.globalZugangErlaubt("b@firma.example", t + 5000) === true, "Zugang: die Drossel einer Adresse bremst eine andere");
  ok(z.globalZugangErlaubt("a@firma.example", t + 61 * 60 * 1000) === true, "Zugang: nach einer Stunde bleibt die Adresse gesperrt");
  z.globalZugangDrosselLeeren();
  const q = lies("server/lib/fiaon-global-zugang.ts");
  ok(/g\.status <> 'storniert'/.test(q) && /LIMIT \$\{HOECHSTENS_AUFTRAEGE\}/.test(q), "Zugang: stornierte Aufträge oder der Deckel je Anforderung fehlen in der Abfrage");
  ok(/globalMailSenden\("global_zugang", akte, b/.test(q), "Zugang: die Mail geht nicht an die Adresse der AKTE (globalMailSenden nimmt sie von dort)");
}
{
  const w = await import("../server/lib/fiaon-postmeister-werkzeuge");
  const namen = w.POSTMEISTER_WERKZEUGE.map((x: any) => x.name);
  for (const n of w.NUR_PRIVATKUNDEN_WERKZEUGE) ok(namen.includes(n), `Mara-Wand nennt ein Werkzeug, das es nicht gibt: ${n}`);
  for (const n of ["kuendigung_vormerken", "mahnstopp_setzen", "eskalation_vorbereiten", "konto_freischalten", "terminlink_bauen"]) {
    ok(typeof w.globalWerkzeugSperre(n, true) === "string", `Mara: ${n} läuft an einem Global-Auftrag`);
    ok(w.globalWerkzeugSperre(n, false) === null, `Mara: ${n} ist für PRIVATKUNDEN gesperrt`);
  }
  for (const n of ["zahlungslink_bauen", "rechnung_anhaengen", "notiz_an_betreuer", "aufgabe_an_betreuer", "vermerk_schreiben", "werbesperre_setzen"]) ok(w.globalWerkzeugSperre(n, true) === null, `Mara: ${n} ist an einem Global-Auftrag gesperrt — ohne es kann sie nichts weitergeben`);
  ok(w.globalWerkzeugSperre("global_zugang_senden", true) === null && typeof w.globalWerkzeugSperre("global_zugang_senden", false) === "string", "Mara: global_zugang_senden ist nicht auf Global-Aufträge beschränkt");
  ok(w.werkzeugVonName("kuendigung_vormerken") !== undefined && w.werkzeugVonName("kuendigung_vormerken")!.ausfuehren.toString().includes("globalWerkzeugSperre"), "Mara: werkzeugVonName liefert das Werkzeug OHNE die Wand (Freigabe in der Werkbank liefe daran vorbei)");
  // Jedes Privatkunden-Werkzeug, das an Geld, Vertrag oder Zugang geht, muss in der Wand stehen.
  const heikel = namen.filter((n: string) => /kuendig|mahn|eskalation|freischalt|raten|verschieb|storno/.test(n));
  ok(heikel.every((n: string) => w.NUR_PRIVATKUNDEN_WERKZEUGE.has(n)), `Mara: heikles Werkzeug ohne Wand — ${heikel.filter((n: string) => !w.NUR_PRIVATKUNDEN_WERKZEUGE.has(n)).join(", ")}`);
}

// ═══ F · ZAHLUNGSSEITE ══════════════════════════════════════════════════════
abschnitt("F · Zahlungsseite: Wörterbuch de/en");
{
  const { ZAHLUNG_WOERTER } = await import("../client/src/i18n/zahlung");
  const form = (o: Record<string, unknown>) => Object.entries(o).map(([k, v]) => `${k}:${Array.isArray(v) ? `[${v.length}]` : typeof v}`).sort().join(" ");
  ok(form(ZAHLUNG_WOERTER.de) === form(ZAHLUNG_WOERTER.en), "Zahlungsseite: die Hälften tragen nicht dieselben Schlüssel in derselben Form");
  const flach = (o: Record<string, unknown>) => Object.values(o).map((v) => typeof v === "function" ? (v as (...a: string[]) => string)("Muster Ltd", "FIAON Global Capital") : Array.isArray(v) ? v.join(" ") : String(v)).join("\n");
  const en = flach(ZAHLUNG_WOERTER.en).replace(/GiroCode/g, "·");
  ok(!DEUTSCHER_REST.test(en), `Zahlungsseite en: deutscher Rest „${en.match(DEUTSCHER_REST)?.[0]}“`);
  for (const f of englischeVerbote(en)) ok(false, `Zahlungsseite en: ${f}`);
  const de = flach(ZAHLUNG_WOERTER.de);
  ok(!/\b(Wähle|lade|tippe|öffne|dein|deine)\b/.test(de), "Zahlungsseite de: duzt");
  ok(!/empfohlen/i.test(ZAHLUNG_WOERTER.de.schnellFirma) && !/recommend/i.test(ZAHLUNG_WOERTER.en.schnellFirma), "Zahlungsseite: der Firmenauftrag spricht eine Empfehlung aus");
  const seite = lies("client/src/pages/zahlung.tsx");
  ok(/!!order\?\.firmenauftrag && order\.sprache === "en"/.test(seite), "Zahlungsseite: Englisch hängt nicht mehr an Firmenauftrag UND Sprache — Privatkunden könnten englisch lesen");
  ok(/sprache/.test(lies("server/lib/fiaon-zahlungsauftrag.ts")) && /firmenauftrag \? \{ firmenauftrag: true[^}]*sprache/.test(lies("server/lib/fiaon-zahlungsauftrag.ts")), "GET /payment-order: das Feld sprache fehlt beim Firmenauftrag");
}

// ═══ G · VERDRAHTUNG ════════════════════════════════════════════════════════
abschnitt("G · Verdrahtung: Lauf, Ereignisse, Frequenzbremse, Türen");
{
  ok(/tageslauf\('global_zahlung_takt'/.test(lies("server/routes.ts")), "Der Lauf global_zahlung_takt ist nicht registriert (server/routes.ts)");
  ok(/\n  global_zahlung_takt: \{/.test(lies("server/lib/fiaon-crons.ts")), "Der Lauf global_zahlung_takt fehlt im Register LAUF_FOLGEN — die Lauf-Überwachung sähe seinen Ausfall nicht");
  const { MAKE_EVENT_REGISTRY } = await import("../server/make-events-registry");
  for (const e of ["global_zahlung_erinnerung", "global_zugang"]) {
    ok(MAKE_EVENT_REGISTRY.some((d: any) => d.type === e), `Ereignis ${e} fehlt im Register`);
    ok(new RegExp(`\\| "${e}"`).test(lies("server/make-webhook.ts")), `Ereignis ${e} fehlt im Typ MakeEventType`);
    ok(new RegExp(`\\n  ${e}: \\{`).test(lies("server/lib/fiaon-mail-events.ts")), `Ereignis ${e} fehlt im Mailwerk (fiaon-mail-events.ts)`);
  }
  const freq = await import("../server/lib/fiaon-mail-frequenz");
  ok(freq.PFLICHTMAILS.has("global_zugang"), "global_zugang ist keine Pflichtmail — die Bremse könnte dem Firmenkunden die einzige Tür zuhalten");
  ok(!freq.PFLICHTMAILS.has("global_zahlung_erinnerung"), "global_zahlung_erinnerung ist Pflichtmail — dann prüft niemand mehr hart unzustellbare Adressen");
  ok(/"global_zahlung_erinnerung",\n\]\);/.test(lies("server/lib/fiaon-mail-frequenz.ts")), "global_zahlung_erinnerung steht nicht in ZAHLUNGSPOST — eine Werbesperre hielte die Erinnerung an die Rechnung auf");
  // Die drei Türen rufen dieselbe Funktion.
  const antrag = lies("server/routes/fiaon-antrag.ts"); const app = lies("server/routes/fiaon-app-login.ts");
  ok((antrag.match(/globalZugangSenden\(/g) ?? []).length >= 2, "Login und „Passwort vergessen“ schicken den Link nicht beide über globalZugangSenden");
  ok(/istNurFirmenkunde\(family\)/.test(app) && /globalZugangSenden\(/.test(app), "Der Anmelde-Link von /app kennt den Firmenkunden nicht");
  ok(/verdict\.globalZugang/.test(antrag), "POST /login wertet globalZugang nicht aus");
  // Das Wissen des Assistenten und der Postmeisterin: nur, was stimmt.
  const { globalWissen } = await import("../shared/fiaon-wissen");
  const gw = globalWissen();
  ok(/„Mein Auftrag“/.test(gw) && /KEIN Passwort/.test(gw) && /ausschließlich an die Adresse, die am Auftrag steht/.test(gw), "Wissen: „Mein Auftrag“ (kein Passwort, Link nur an die Adresse des Auftrags) fehlt");
  ok(/zuständige Person/.test(gw) && /Startgespräch/.test(gw), "Wissen: die zuständige Person und das Startgespräch fehlen");
  ok(/gelten die Abo-Regeln unter VERTRAG UND KÜNDIGUNG NICHT/.test(gw) && /weder Storno noch Erstattung/.test(gw), "Wissen: Storno/Erstattung bei FIAON Global — die Abo-Regeln würden gelten");
  ok(/fiaon\.com\/business\/start/.test(gw) && /fiaon\.com\/business#gespraech/.test(gw) && /EINMALIG/.test(gw) && /auf (eigenes|Ihr) Mandat/.test(gw), "Wissen: Einmalpreis, Direktauftrag, Gespräch oder Mandatssatz fehlen");
  ok(!/\b[A-Z]{2}\d{2}[ ]?\d{4}[ ]?\d{4}/.test(gw), "Wissen: Bankdaten im Global-Block");
  ok(/KEIN ABO/.test(lies("server/lib/fiaon-postmeister-dossier.ts")) && /istGlobalPaket\(a\?\.pack_key\)/.test(lies("server/lib/fiaon-postmeister-dossier.ts")), "Postmeister-Dossier: ein Firmenauftrag bekäme die Zwölf-Monats-Regeln als Vertrag");
  // „Zugang retten" der Leitung vergibt für einen Firmenauftrag kein Passwort.
  const retten = lies("server/routes/fiaon-zugang-retten.ts");
  ok((retten.match(/nurRettung, keinFirmenauftrag, async/g) ?? []).length === 3, "Zugang retten: nicht alle drei Wege (Setz-Link, Einmal-Passwort, freischalten) stehen hinter der Firmenauftrag-Wand");
  // Tier: Global geht nicht in die Bewertung ein; wer sonst nichts hat, ist -1/ausgeschlossen.
  const { personTierSql } = await import("../server/lib/tier");
  const sql = personTierSql();
  ok(/firmenkunde AS \(/.test(sql) && /THEN -1/.test(sql) && /'ausgeschlossen'/.test(sql), "tier.ts: der Firmenkunde steht wieder im Privatvertrieb");
  ok((sql.match(/'global_struktur', 'global_banking', 'global_kapital', 'global_vip'/g) ?? []).length === 2, "tier.ts: die Global-Schlüssel kommen nicht aus dem Katalog in beide Teilabfragen");
}

console.log(`\n${"═".repeat(74)}`);
console.log(fehler === 0 ? `QUERSCHNITT: alle ${geprueft} Prüfungen grün.` : `QUERSCHNITT: ${fehler} von ${geprueft} Prüfungen ROT.`);
if (fehler) process.exitCode = 1;
