// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-IT-A (08.10.2026) — PIPELINE / INTELLIGENTE WIEDERVORLAGE
//
// Justins Entscheidung (08.10.2026), Punkt (1):
//   · „Zahlt sofort" → nach 3 Werktagen wieder dran; „zahlt am X" → Werktag nach X.
//   · Nicht erreicht: Abstand wächst; ab dem 6. Fehlversuch 14 Tage Pause.
//   · Gerade bearbeitet → nie am nächsten Tag wieder vorn (Rotation nach dem
//     letzten Versuch, ältester zuerst innerhalb gleicher Dringlichkeit).
//   · Stufe A pausiert höchstens 3 Werktage; ab dem 9. Fehlversuch die Leitung.
//   · Abgelaufene Zusagen: kein Dauer-Spitzenplatz.
//   · Ratenkunden (Stufe 0) verlieren Wiedervorlage/Zusage nicht mehr im Takt.
//   · Doppelbuchungen (binnen Minuten) zählen nicht doppelt.
//
// GEGENPRÜFUNG (08.10.2026) — fünf Befunde, je mit Fall und Rotprobe:
//   G1 Stufe A ließ sich von Hand auf 1/2 Wochen schieben → Deckel 3 Werktage
//      (Regel, Route, Oberfläche), auch bei „Sonstiges" und mit Leitung.
//   G2 Frische stellte gestern Bearbeitete heute vorn → „gerade bearbeitet"
//      nie im Frische-Band, im Band hinten; Frische hebt die Pause ab 6 nicht auf.
//   G3 Mara-/WhatsApp-Zusagen von Ratenkunden löschte der Takt → je Feld nach Datum.
//   G4 Stufe A mit alter Zusage zeigte „Zusage nicht gehalten" → „Zahlung gemeldet".
//   G5 Tagesbericht-Nachträge zählten als System-Ergebnisse (E-216) → Systemzeile
//      mit Marke und Berichtstag; die Pipeline erkennt sie trotzdem als Kontakt.
//
// Drei Teile:
//   1. DIE REGEL (rein, ohne Datenbank) — shared/fiaon-wiedervorlage.ts, mit
//      Rotproben gegen absichtlich falsche Fassungen.
//   2. QUELLTEXT — jede Funktion hat einen Knopf/eine Anzeige, eine Quelle,
//      keine alte Staffel mehr, Rundgang und Feed nachgezogen.
//   3. LOKALE DATENBANK (nur 127.0.0.1, eine Transaktion, am Ende
//      zurückgerollt): ergebnisAnwenden, Entprellung, Stufe A/Leitung/Ruhe,
//      Rückruf beantwortet, Ratenweg + Einstufung (Stufe 0 behält / verliert),
//      die Reihung der Arbeitsliste (arbeitslisteLesen) mit Rotation,
//      Tagespause, einmaliger Zusage, ohne Lücke zwischen den Spalten, die
//      Zahl „pausiert" und die Situation der Akte — mit Rotprobe gegen die
//      alte Reihung.
//
//   npx tsx scripts/pruef-it-a.ts                                   (Teil 1+2)
//   env -i PATH="$PATH" HOME="$HOME" \
//     DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_it_a?sslmode=require' \
//     node_modules/.bin/tsx scripts/pruef-it-a.ts                   (Teil 1–3)
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync } from "node:fs";

for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "WHATSAPP_TOKEN", "TWILIO_AUTH_TOKEN", "OPENAI_API_KEY", "ANTHROPIC_API_KEY"]) {
  if (process.env[k]) { console.error(`${k} ist gesetzt — Abbruch, der Prüfstand darf nichts versenden.`); process.exit(3); }
}
process.env.CRONS = "aus";
// Kein Netz außer localhost — eine Terminlink-Mail ab dem 6. Fehlversuch ginge sonst raus.
const FREMD: string[] = [];
const echtFetch = globalThis.fetch;
globalThis.fetch = (async (eingabe: any, init?: any) => {
  const u = String(typeof eingabe === "string" ? eingabe : eingabe?.url ?? eingabe);
  if (/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(u)) return echtFetch(eingabe, init);
  FREMD.push(u);
  throw new Error(`Prüfstand: kein Netz (${u})`);
}) as typeof fetch;

import {
  plusWerktage, plusKalendertage, istWerktag, naechsterWerktag, nurIsoDatum, datumKurz, tageZwischen,
  naechsterVersuch, staffelNachFehlversuch, wiederDranText, grundAusLetztemErgebnis, ratenErgebnisAlsKontakt,
  handwahlDatum, handwahlPruefen, handwahlErlaubt, handwahlMoeglich, stufeADeckel, stufeADeckeln, STUFE_A_HINWEIS,
  HANDWAHL, FEHLVERSUCH_STAFFEL, GRUND_TEXT,
  ZAHLT_SOFORT_WERKTAGE, PAUSE_AB_FEHLVERSUCH, PAUSE_KALENDERTAGE, RUHEND_AB_FEHLVERSUCH, LEITUNG_AB_FEHLVERSUCH,
  STUFE_A_HOECHSTENS_WERKTAGE, FRISCH_TAGE, TAGESPAUSE_STUNDEN, ENTPRELLUNG_MINUTEN, HANDWAHL_HOECHSTENS_TAGE,
} from "../shared/fiaon-wiedervorlage";

let gruen = 0, rot = 0;
const fehler: string[] = [];
function ok(name: string, b: boolean, detail: unknown = ""): void {
  if (b) { gruen++; console.log(`  PASS  ${name}`); }
  else { rot++; fehler.push(name); console.log(`  FAIL  ${name}  → ${typeof detail === "string" ? detail : JSON.stringify(detail)?.slice(0, 900)}`); }
}
function gleich(name: string, ist: unknown, soll: unknown): void {
  ok(name, JSON.stringify(ist) === JSON.stringify(soll), `ist ${JSON.stringify(ist)}, soll ${JSON.stringify(soll)}`);
}
const abschnitt = (t: string) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 66 - t.length))}`);
const quelle = (pfad: string) => readFileSync(new URL(`../${pfad}`, import.meta.url), "utf8");

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("1a. Werktage (Mo–Fr), Berliner Kalendertage");
// ═══════════════════════════════════════════════════════════════════════════
// 2026-10-08 ist ein Donnerstag, 2026-10-09 ein Freitag, 10./11. Sa/So.
gleich("Do 08.10. ist ein Werktag", istWerktag("2026-10-08"), true);
gleich("Sa 10.10. ist kein Werktag", istWerktag("2026-10-10"), false);
gleich("So 11.10. ist kein Werktag", istWerktag("2026-10-11"), false);
gleich("Freitag + 2 Werktage = Dienstag", plusWerktage("2026-10-09", 2), "2026-10-13");
gleich("Freitag + 1 Werktag = Montag", plusWerktage("2026-10-09", 1), "2026-10-12");
gleich("Donnerstag + 3 Werktage = Dienstag", plusWerktage("2026-10-08", 3), "2026-10-13");
gleich("Samstag + 1 Werktag = Montag", plusWerktage("2026-10-10", 1), "2026-10-12");
gleich("Sonntag + 0 Werktage = Sonntag (kein Sprung ohne Auftrag)", plusWerktage("2026-10-11", 0), "2026-10-11");
gleich("Monatswechsel: Fr 30.10. + 1 Werktag = Mo 02.11.", plusWerktage("2026-10-30", 1), "2026-11-02");
gleich("Jahreswechsel: Do 31.12.2026 + 2 Werktage = Mo 04.01.2027", plusWerktage("2026-12-31", 2), "2027-01-04");
gleich("Sommerzeitende (25.10.) verschiebt nichts: Fr 23.10. + 1 = Mo 26.10.", plusWerktage("2026-10-23", 1), "2026-10-26");
gleich("Nächster Werktag von Samstag = Montag", naechsterWerktag("2026-10-10"), "2026-10-12");
gleich("Nächster Werktag von Mittwoch = Mittwoch", naechsterWerktag("2026-10-14"), "2026-10-14");
gleich("plusKalendertage 14 über das Monatsende", plusKalendertage("2026-10-22", 14), "2026-11-05");
gleich("tageZwischen", tageZwischen("2026-10-08", "2026-10-22"), 14);
gleich("datumKurz", datumKurz("2026-10-14"), "Mi 14.10.");
gleich("nurIsoDatum nimmt einen Zeitstempel", nurIsoDatum("2026-10-08T22:00:00.000Z"), "2026-10-08");
gleich("nurIsoDatum lehnt den 30.02. ab", nurIsoDatum("2026-02-30"), null);
// ── Der alte Fehler (Gegenprüfung 7): nurDatum bekam eine ZAHL → null.
gleich("nurIsoDatum lehnt eine Zahl ab (statt still null zu SCHREIBEN, rechnet die Regel selbst)", nurIsoDatum(1760000000000), null);
// Rotprobe: Eine Fassung, die Wochenenden mitzählt, fiele hier durch.
{
  const kaputt = (iso: string, n: number) => plusKalendertage(iso, n);
  ok("Rotprobe: Wochenenden mitzählen ergäbe Fr+2 = So (≠ Di) — der Prüfstand würde rot", kaputt("2026-10-09", 2) !== "2026-10-13");
}

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("1b. Die Ergebnisse (Heute = Do 08.10.2026)");
// ═══════════════════════════════════════════════════════════════════════════
const H = "2026-10-08";
{
  const r = naechsterVersuch({ ergebnis: "erreicht_zahlt_gleich", heute: H });
  gleich("Zahlt sofort → 3 Werktage (Di 13.10.)", r.datum, "2026-10-13");
  gleich("… Grund „Zahlung prüfen“", [r.grund, GRUND_TEXT[r.grund]], ["zahlung_pruefen", "Zahlung prüfen"]);
  ok("… nie am nächsten Tag (alte Regel: Fr 09.10.)", r.datum !== "2026-10-09");
  ok("… Text nennt Tag und Grund", r.text === "Wieder dran am Di 13.10. · Zahlung prüfen", r.text);
}
gleich("Zahlt am Fr 16.10. → Werktag danach (Mo 19.10.)", naechsterVersuch({ ergebnis: "erreicht_zahlt_am", heute: H, zusageDatum: "2026-10-16" }).datum, "2026-10-19");
gleich("Zahlt am Sa 17.10. → Mo 19.10.", naechsterVersuch({ ergebnis: "erreicht_zahlt_am", heute: H, zusageDatum: "2026-10-17" }).datum, "2026-10-19");
gleich("Zahlt am Mi 14.10. → Do 15.10.", naechsterVersuch({ ergebnis: "erreicht_zahlt_am", heute: H, zusageDatum: "2026-10-14" }).datum, "2026-10-15");
gleich("Zahlt am — Zeitstempel statt Datum wird gelesen", naechsterVersuch({ ergebnis: "erreicht_zahlt_am", heute: H, zusageDatum: "2026-10-14T00:00:00.000Z" }).datum, "2026-10-15");
gleich("Zahlt am (Tag schon vorbei) → nächster Werktag", naechsterVersuch({ ergebnis: "erreicht_zahlt_am", heute: H, zusageDatum: "2026-10-01" }).datum, "2026-10-09");
gleich("Zahlt am — Grund „Zusage prüfen“", naechsterVersuch({ ergebnis: "erreicht_zahlt_am", heute: H, zusageDatum: "2026-10-16" }).grund, "zusage_pruefen");
gleich("Erreicht – Sonstiges → 3 Werktage", naechsterVersuch({ ergebnis: "erreicht_sonstiges", heute: H }).datum, "2026-10-13");
gleich("Falsche Nummer → 3 Werktage", naechsterVersuch({ ergebnis: "nummer_falsch", heute: H }).datum, "2026-10-13");
gleich("Anrufer blockiert → heute (Kollege ruft gleich an)", naechsterVersuch({ ergebnis: "nummer_blockiert", heute: H }).datum, H);
gleich("Abgelehnt → keine Wiedervorlage", naechsterVersuch({ ergebnis: "erreicht_abgelehnt", heute: H }).datum, null);
gleich("Rückruf → genau der vereinbarte Tag", naechsterVersuch({ ergebnis: "rueckruf_termin", heute: H, terminDatum: "2026-10-20T14:30:00" }).datum, "2026-10-20");
gleich("Rückruf ohne Tag → nächster Werktag", naechsterVersuch({ ergebnis: "rueckruf_termin", heute: H }).datum, "2026-10-09");

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("1c. Staffel nicht erreicht / Mailbox (Zählerstand NACH dem Versuch)");
// ═══════════════════════════════════════════════════════════════════════════
const ne = (n: number, x: Partial<{ stufeA: boolean; frisch: boolean; gewaehlt: string }> = {}) =>
  naechsterVersuch({ ergebnis: "nicht_erreicht", heute: H, versucheNachher: n, ...x });
gleich("1. Fehlversuch → +2 Werktage (Mo 12.10.)", ne(1).datum, "2026-10-12");
gleich("2. → +3 Werktage (Di 13.10.)", ne(2).datum, "2026-10-13");
gleich("3. → +5 Werktage (Do 15.10.)", ne(3).datum, "2026-10-15");
gleich("4. → +5 Werktage", ne(4).datum, "2026-10-15");
gleich("5. → +7 Tage (Do 15.10.)", ne(5).datum, "2026-10-15");
gleich("6. → 14 Tage Pause (Do 22.10.), Grund „pausiert“", [ne(6).datum, ne(6).grund, ne(6).pausiert], ["2026-10-22", "pausiert", true]);
gleich("8. → weiter 14 Tage", ne(8).datum, "2026-10-22");
gleich("9. → ruhend, ohne Datum", [ne(9).datum, ne(9).ruhend, ne(9).grund], [null, true, "ruhend"]);
gleich("Mailbox folgt derselben Staffel", naechsterVersuch({ ergebnis: "mailbox", heute: H, versucheNachher: 2 }).datum, "2026-10-13");
{
  let wachsend = true; let vorher = "";
  for (let n = 1; n <= 8; n++) { const d = ne(n).datum!; if (d < vorher) wachsend = false; vorher = d; }
  ok("Der Abstand wächst nie zurück (1 … 8)", wachsend);
  ok("Kein Fehlversuch führt zum nächsten Tag (ohne Frische)", [1, 2, 3, 4, 5, 6, 7, 8].every((n) => ne(n).datum! > "2026-10-09"));
}
gleich("Stufe A, 1. → +2 Werktage", ne(1, { stufeA: true }).datum, "2026-10-12");
gleich("Stufe A, 3. → höchstens 3 Werktage (Di 13.10.)", ne(3, { stufeA: true }).datum, "2026-10-13");
gleich("Stufe A, 6. → höchstens 3 Werktage, NICHT pausiert", [ne(6, { stufeA: true }).datum, ne(6, { stufeA: true }).pausiert], ["2026-10-13", false]);
gleich("Stufe A, 9. → Leitung, nicht ruhend, 3 Werktage", [ne(9, { stufeA: true }).leitung, ne(9, { stufeA: true }).ruhend, ne(9, { stufeA: true }).datum], [true, false, "2026-10-13"]);
gleich("Frisch (Antrag ≤ 3 Tage), 1. → nächster Werktag (Fr 09.10.)", ne(1, { frisch: true }).datum, "2026-10-09");
gleich("Frisch, 3. → nächster Werktag", ne(3, { frisch: true }).datum, "2026-10-09");
gleich("Freitags frisch → Montag, nicht Samstag", naechsterVersuch({ ergebnis: "nicht_erreicht", heute: "2026-10-09", versucheNachher: 1, frisch: true }).datum, "2026-10-12");
// G2: Die Frische hebt die Pause ab dem 6. Fehlversuch NICHT mehr auf.
gleich("G2: frisch, 5. → nächster Werktag (bis zum 5. gilt die Frische)", ne(5, { frisch: true }).datum, "2026-10-09");
gleich("G2: frisch, 6. → 14 Tage Pause, pausiert (vorher: +1 Werktag)", [ne(6, { frisch: true }).datum, ne(6, { frisch: true }).pausiert, ne(6, { frisch: true }).grund], ["2026-10-22", true, "pausiert"]);
gleich("G2: frisch + Stufe A, 6. → 3 Werktage (Stufe-A-Deckel, keine Pause)", [ne(6, { frisch: true, stufeA: true }).datum, ne(6, { frisch: true, stufeA: true }).pausiert], ["2026-10-13", false]);
{
  // Rotprobe: die Fassung vor der Gegenprüfung (Frische immer über der Pause) gäbe den Folgetag.
  const altFrisch = (n: number) => (n >= 1 ? plusWerktage(H, 1) : H);
  ok("G2 Rotprobe: alte Fassung gäbe beim 6. Fehlversuch Fr 09.10. — die neue Do 22.10.", altFrisch(6) === "2026-10-09" && ne(6, { frisch: true }).datum === "2026-10-22");
}
gleich("Staffel-Tabelle: Pause ab dem 6., 14 Tage", [FEHLVERSUCH_STAFFEL.at(-1)?.ab, FEHLVERSUCH_STAFFEL.at(-1)?.kalendertage, PAUSE_AB_FEHLVERSUCH, PAUSE_KALENDERTAGE], [6, 14, 6, 14]);
gleich("Werte der Entscheidung", [ZAHLT_SOFORT_WERKTAGE, STUFE_A_HOECHSTENS_WERKTAGE, RUHEND_AB_FEHLVERSUCH, LEITUNG_AB_FEHLVERSUCH, FRISCH_TAGE, TAGESPAUSE_STUNDEN, ENTPRELLUNG_MINUTEN, HANDWAHL_HOECHSTENS_TAGE], [3, 3, 9, 9, 3, 20, 30, 60]);
gleich("staffelNachFehlversuch nennt den Abstand", staffelNachFehlversuch({ versuche: 3, heute: H }).abstand, "+5 Werktage");
// Rotprobe: die ALTE Staffel (+1 Tag bei 1–2, Stufe A nie gestreckt) fiele hier durch.
{
  const alt = (n: number, a: boolean) => (n >= 3 && !a ? plusKalendertage(H, n >= 6 ? 7 : 3) : plusKalendertage(H, 1));
  ok("Rotprobe: alte Staffel gäbe beim 1. Versuch den Folgetag — die neue nicht", alt(1, false) === "2026-10-09" && ne(1).datum !== alt(1, false));
  ok("Rotprobe: alte Staffel ließ Stufe A beim 7. Versuch jeden Tag fällig — die neue wartet", alt(7, true) === "2026-10-09" && ne(7, { stufeA: true }).datum === "2026-10-13");
}

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("1d. Wahl von Hand, Texte, Gründe, Ratenweg");
// ═══════════════════════════════════════════════════════════════════════════
gleich("Wahl „in 1 Woche“ gewinnt bei nicht erreicht", [ne(2, { gewaehlt: "2026-10-15" }).datum, ne(2, { gewaehlt: "2026-10-15" }).grund], ["2026-10-15", "von_hand"]);
gleich("Wahl in der Vergangenheit zählt nicht", ne(2, { gewaehlt: "2026-10-01" }).datum, "2026-10-13");
gleich("Wahl über 60 Tage wird gedeckelt", handwahlPruefen("2027-03-01", H), plusKalendertage(H, 60));
gleich("Ruhend schlägt die Wahl von Hand", ne(9, { gewaehlt: "2026-10-15" }).ruhend, true);
gleich("G1: Stufe A ab 9 + Wahl 20.10. → gedeckelt auf Di 13.10., Leitung bleibt", [ne(9, { stufeA: true, gewaehlt: "2026-10-20" }).datum, ne(9, { stufeA: true, gewaehlt: "2026-10-20" }).leitung, ne(9, { stufeA: true, gewaehlt: "2026-10-20" }).grund, ne(9, { stufeA: true, gewaehlt: "2026-10-20" }).gedeckelt], ["2026-10-13", true, "leitung", true]);
gleich("Abgelehnt ignoriert die Wahl", naechsterVersuch({ ergebnis: "erreicht_abgelehnt", heute: H, gewaehlt: "2026-10-15" }).datum, null);
gleich("Zahlt am ignoriert die Wahl (das Datum ist die Zusage)", naechsterVersuch({ ergebnis: "erreicht_zahlt_am", heute: H, zusageDatum: "2026-10-16", gewaehlt: "2026-10-30" }).datum, "2026-10-19");
gleich("Wahl erlaubt bei zahlt sofort / Sonstiges / nicht erreicht / Mailbox / falsche Nummer", ["erreicht_zahlt_gleich", "erreicht_sonstiges", "nicht_erreicht", "mailbox", "nummer_falsch", "erreicht_zahlt_am", "rueckruf_termin", "erreicht_abgelehnt", "nummer_blockiert"].map(handwahlErlaubt), [true, true, true, true, true, false, false, false, false]);
gleich("Knöpfe der Wahl", HANDWAHL.map((h) => h.schluessel), ["regel", "woche", "zwei_wochen"]);
gleich("„in 1 Woche“ ab Do = Do + 7", handwahlDatum("woche", H), "2026-10-15");
gleich("„in 1 Woche“ ab Sa landet auf Montag", handwahlDatum("woche", "2026-10-10"), "2026-10-19");
gleich("„heute“", handwahlDatum("heute", H), H);
gleich("„regel“ hat kein Datum", handwahlDatum("regel", H), null);
gleich("Text heute", wiederDranText(H, "uebergabe", H), "Wieder dran heute · Übergabe an Kollegen");
gleich("Text morgen", wiederDranText("2026-10-09", "erneut_versuchen", H), "Wieder dran morgen (Fr 09.10.) · Erneut anrufen");
ok("Text ruhend", /Ruhend/.test(wiederDranText(null, "ruhend", H)));
gleich("Grund aus dem letzten Ergebnis", [
  grundAusLetztemErgebnis("erreicht_zahlt_gleich", 0), grundAusLetztemErgebnis("erreicht_zahlt_am", 0),
  grundAusLetztemErgebnis("rate_zahlt_am", 0), grundAusLetztemErgebnis("nicht_erreicht", 2),
  grundAusLetztemErgebnis("rate_nicht_erreicht", 7), grundAusLetztemErgebnis("rueckruf_termin", 0),
  grundAusLetztemErgebnis(null, 0)],
  ["zahlung_pruefen", "zusage_pruefen", "zusage_pruefen", "erneut_versuchen", "pausiert", "rueckruf", "wiedervorlage"]);
gleich("Ratenweg → dieselben Arten", ["zahlt_am", "ueberwiesen_beleg", "nicht_erreicht", "ratenpause", "nummer_blockiert", "eskalation"].map((a) => ratenErgebnisAlsKontakt(a as any)),
  ["erreicht_zahlt_am", "erreicht_zahlt_gleich", "nicht_erreicht", "erreicht_sonstiges", null, null]);

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("1e. G1 — Stufe A wartet höchstens 3 Werktage, auch von Hand");
// ═══════════════════════════════════════════════════════════════════════════
{
  const zweiW = handwahlDatum("zwei_wochen", H)!;
  const eineW = handwahlDatum("woche", H)!;
  gleich("Deckel ab Do 08.10. = Di 13.10.", stufeADeckel(H), "2026-10-13");
  const r2 = ne(2, { stufeA: true, gewaehlt: zweiW });
  gleich("Stufe A, 2. Fehlversuch, „in 2 Wochen“ → Di 13.10. (Befund: 22.10.)", [r2.datum, r2.grund, r2.gedeckelt], ["2026-10-13", "von_hand", true]);
  ok("… der Text sagt den Grund", r2.text.includes(STUFE_A_HINWEIS), r2.text);
  const rs = naechsterVersuch({ ergebnis: "erreicht_sonstiges", heute: H, stufeA: true, gewaehlt: zweiW });
  gleich("Stufe A, „Sonstiges“ + „in 2 Wochen“ → Di 13.10.", [rs.datum, rs.gedeckelt], ["2026-10-13", true]);
  gleich("Stufe A, „zahlt sofort“ + „in 1 Woche“ → Di 13.10.", naechsterVersuch({ ergebnis: "erreicht_zahlt_gleich", heute: H, stufeA: true, gewaehlt: eineW }).datum, "2026-10-13");
  gleich("Stufe A, „Mailbox“ + Datum 30.10. → Di 13.10.", naechsterVersuch({ ergebnis: "mailbox", heute: H, versucheNachher: 1, stufeA: true, gewaehlt: "2026-10-30" }).datum, "2026-10-13");
  gleich("Stufe A, Wahl innerhalb des Deckels (Mo 12.10.) bleibt, nicht gedeckelt", [ne(2, { stufeA: true, gewaehlt: "2026-10-12" }).datum, ne(2, { stufeA: true, gewaehlt: "2026-10-12" }).gedeckelt], ["2026-10-12", false]);
  gleich("Stufe A, „zahlt am 30.10.“ — vereinbart, NICHT gedeckelt (Mo 02.11.)", naechsterVersuch({ ergebnis: "erreicht_zahlt_am", heute: H, stufeA: true, zusageDatum: "2026-10-30" }).datum, "2026-11-02");
  gleich("Stufe A, Rückruf am 27.10. — vereinbart, NICHT gedeckelt", naechsterVersuch({ ergebnis: "rueckruf_termin", heute: H, stufeA: true, terminDatum: "2026-10-27" }).datum, "2026-10-27");
  gleich("Stufe B, „in 2 Wochen“ bleibt (Do 22.10.)", ne(2, { gewaehlt: zweiW }).datum, "2026-10-22");
  gleich("stufeADeckeln: nur Stufe A, nur nach hinten", [stufeADeckeln("2026-10-22", H, true), stufeADeckeln("2026-10-22", H, false), stufeADeckeln("2026-10-09", H, true), stufeADeckeln(null, H, true)],
    [{ datum: "2026-10-13", gedeckelt: true }, { datum: "2026-10-22", gedeckelt: false }, { datum: "2026-10-09", gedeckelt: false }, { datum: null, gedeckelt: false }]);
  gleich("Knöpfe bei Stufe A: „nach Regel“ ja, „1 Woche“/„2 Wochen“ nein; „heute“ ja", ["regel", "woche", "zwei_wochen", "heute"].map((k) => handwahlMoeglich(k, H, true)), [true, false, false, true]);
  gleich("Knöpfe ohne Stufe A: alle", ["regel", "woche", "zwei_wochen"].map((k) => handwahlMoeglich(k, H, false)), [true, true, true]);
  // Rotprobe: die Fassung vor der Gegenprüfung übernahm die Wahl ungedeckelt.
  const altWahl = (gewaehlt: string) => gewaehlt;
  ok("G1 Rotprobe: alte Fassung gäbe 22.10. — die neue 13.10.", altWahl(zweiW) === "2026-10-22" && r2.datum === "2026-10-13");
}

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("2. Quelltext — eine Quelle, Knöpfe, Rundgang");
// ═══════════════════════════════════════════════════════════════════════════
{
  const regel = quelle("shared/fiaon-wiedervorlage.ts");
  ok("Die Regel ist rein: kein Import aus server/, keine Datenbank", !/from ["']\.\.\/server|db-pool|sqlPool/.test(regel));
  const ke = quelle("server/lib/fiaon-kontakt-ergebnis.ts");
  ok("ergebnisAnwenden rechnet mit der einen Regel (naechsterVersuch)", /naechsterVersuch\(\{/.test(ke));
  const keCode = ke.split("\n").filter((z) => !/^\s*(\/\/|\*)/.test(z)).join("\n");
  ok("Der Datumsfehler „zahlt am“ ist weg (keine Zahl mehr an nurDatum)", !/nurDatum\(new Date\(/.test(keCode) && /nurDatum\(new Date\(/.test(ke));
  ok("Kein eigener Tagesrechner mehr (tagPlus) in fiaon-kontakt-ergebnis.ts", !/const tagPlus/.test(ke));
  ok("Der Zähler wird entprellt gezählt (fehlversuchZaehlen), nicht roh hochgezählt", /fehlversuchZaehlen/.test(ke) && !/unreachable_count = unreachable_count \+ 1/.test(ke));
  ok("Ein neues Ergebnis beantwortet den alten Rückruf (done_at)", /UPDATE fiaon_contact_log SET done_at = NOW\(\)/.test(ke));
  const nee = quelle("server/lib/fiaon-nicht-erreicht.ts");
  ok("fiaon-nicht-erreicht.ts: kein eigenes tagPlus mit Serverzeit mehr", !/function tagPlus/.test(nee));
  ok("… Staffel für Termin-/Startgespräch-verpasst aus der einen Regel", /staffelNachFehlversuch\(/.test(nee));
  ok("… Stufe A an die Leitung mit höchstens 3 Werktagen", /plusWerktage\(berlinToday\(\), STUFE_A_HOECHSTENS_WERKTAGE\)/.test(nee));
  const ink = quelle("server/lib/fiaon-inkasso.ts");
  ok("Ratenweg: Person über die eine Regel, Rate behält ihre Frist", /ratenErgebnisAlsKontakt\(opts\.ergebnis\)/.test(ink) && /personWiedervorlage/.test(ink) && /inkasso_wiedervorlage = \$\{wiedervorlage\}/.test(ink));
  ok("Ratenweg: kein eigenes Hochzählen der Person mehr", !/\+ \$\{zaehlerPlus\}/.test(ink) && /fehlversuchZaehlen\(pid, lauf\)/.test(ink));
  const tier = quelle("server/lib/tier.ts");
  ok("Einstufung: beide Löschstellen über EIN Aufräumen (ratenArbeitAufraeumenSql), je Feld", /ratenArbeitAufraeumenSql\(true\), \[personId\]/.test(tier) && /ratenArbeitAufraeumenSql\(false\)/.test(tier));
  const reih = quelle("server/lib/fiaon-pipeline-reihung.ts");
  ok("G3: Behalten hängt am Datum (Zusage/Wiedervorlage nach dem Tag der letzten Zahlung), nicht nur am Gesprächsergebnis",
    /p\.promised_payment_date > \$\{LETZTE_ZAHLUNG_TAG_SQL\}/.test(reih) && /p\.follow_up_date > \$\{LETZTE_ZAHLUNG_TAG_SQL\}/.test(reih)
    && /promised_payment_date = CASE WHEN k\.zusage_bleibt/.test(reih) && /follow_up_date = CASE WHEN k\.wv_bleibt/.test(reih));
  ok("G2: „gerade bearbeitet“ = vorheriger Werktag oder heute (Mo → Fr)", /WHEN 1 THEN 3 WHEN 7 THEN 2 ELSE 1 END/.test(reih) && /export function geradeBearbeitetSql/.test(reih));
  ok("G5: Tagesbericht-Nachtrag zählt für die Pipeline als Kontakt (kontaktZeileSql in LETZTER_KONTAKT_SQL)", /kontaktZeileSql\("ck"\)/.test(reih) && /kontaktZeileSql\("cm"\)/.test(reih) && /TAGESBERICHT_NACHTRAG_MARKE = "Tagesbericht-Nachtrag"/.test(reih));
  ok("Einstufung: kein bedingungsloses Löschen bei Stufe ≤ 0 mehr", !/WHERE merged_into_person_id IS NULL AND priority_tier <= 0\s*\n\s*AND \(promised_payment_date IS NOT NULL OR follow_up_date IS NOT NULL\)\s*\n\s*`;/.test(tier));
  const ov = quelle("server/routes/fiaon-office-vertrieb.ts");
  ok("Arbeitsliste: rechte Spalte nach wiederOrdnung (Rotation), linke bleibt HITZE", /const ordnung = wiederOrdnung\("v\.lv", "v\.ev"\)/.test(ov) && /ORDER BY \$\{NEU_ORDNUNG\}/.test(ov));
  ok("G2: Frische-Band nur für nicht gerade Bearbeitete; im Band gerade Bearbeitete zuletzt",
    /WHEN \$\{frischUnbearbeitetSql\(ev, lv\)\} THEN 3/.test(ov) && /CASE WHEN \$\{geradeBearbeitetSql\(lv\)\} THEN 1 ELSE 0 END,\s*\n\s*\$\{FENSTER_ORDNUNG\}/.test(ov)
    && !/WHEN \$\{frischBandSql\(ev\)\} THEN 3/.test(ov));
  ok("G4: Stufe A zeigt „Zahlung gemeldet“ vor einer alten Zusage", /const zusageGebrochen = !!z\.zusage_iso && String\(z\.zusage_iso\) < heute && tier !== 1;/.test(ov));
  ok("G4: Karte einer fälligen Zusage auf Stufe A heißt „Zahlung prüfen“", /Number\(r\.priority_tier\) === 1 \|\| grundAusLetztemErgebnis/.test(ov));
  ok("G5: „nie angerufen“ kennt den Tagesbericht-Nachtrag (NIE_SQL über kontaktZeileSql)", /cn\.person_id = p\.id AND \$\{kontaktZeileSql\("cn"\)\}/.test(ov) && /an\.person_id = p\.id AND \$\{kontaktZeileSql\("cr"\)\}/.test(ov));
  ok("G5: „heute erledigt“ zählt weiter nur Gesprächsergebnisse (type result)", /WHERE cl\.agent_id = \$1 AND cl\.type = 'result' AND cl\.voided_at IS NULL/.test(ov));
  ok("… letzter Versuch EINMAL je Zeile (LATERAL)", /CROSS JOIN LATERAL \(SELECT \$\{LETZTER_VERSUCH_SQL\} AS lv, \$\{EREIGNIS_SQL\} AS ev\) v/.test(ov));
  ok("… keine Lücke: rechts = NOT LINKS_SQL", /`NOT \$\{LINKS_SQL\}`/.test(ov));
  ok("… Tagespause mit Ausnahme Termin heute / offener Rückruf", /WIEDER_TAGESPAUSE = `\(NOT \$\{tagespauseSql\("v\.lv"\)\} OR \$\{TERMIN_HEUTE_SQL\} OR \$\{rueckrufOffenSql\("v\.lv"\)\}\)`/.test(ov));
  ok("… Zusage nur noch einmal dringend (zusageOffenSql statt „≤ heute“)", /const ZUSAGE_SQL = zusageOffenSql\(\);/.test(ov) && !/const ZUSAGE_SQL = `\(p\.promised_payment_date IS NOT NULL AND p\.promised_payment_date <= \$\{HEUTE\}\)`/.test(ov));
  ok("… Pool-Rückfall lässt Pausierte beim Betreuer", /AND \(p\.follow_up_date IS NULL OR p\.follow_up_date < \$\{HEUTE\} - 7\)/.test(ov));
  ok("… RATE_FAELLIG_SQL/EREIGNIS_SQL weiter von hier ausgeführt (Telefonkartei)", /export \{ RATE_FAELLIG_SQL, EREIGNIS_SQL \};/.test(ov) && ov.includes("export const JETZT_ERREICHBAR_SQL"));
  ok("… Kopf „heute erledigt · pausiert“ und Route „pausiert“", /heute: \{ datum: heute, erledigt:/.test(ov) && /router\.get\("\/agent\/vertrieb\/pausiert"/.test(ov));
  const ak = quelle("server/routes/fiaon-agent-kunden.ts");
  ok("Route „Wiedervorlage von Hand“ (heute / 1 Woche / 2 Wochen / Datum) mit Verlaufseintrag", /router\.post\("\/agent\/crm\/kunden\/:personId\/wiedervorlage"/.test(ak) && /Wiedervorlage von Hand gesetzt/.test(ak));
  ok("„Zusage“-Route geht über ergebnisAnwenden (keine eigene „+1 Tag“-Fassung)", /ergebnis: "erreicht_zahlt_am", zusageDatum: datum/.test(ak) && !/follow_up_date = \$\{datum\}::date \+ 1/.test(ak));
  ok("G1: Route „Wiedervorlage von Hand“ deckelt Stufe A (stufeADeckeln mit priority_tier = 1)",
    /const deckel = stufeADeckeln\(gewuenscht, heute, Number\(stufeZeile\?\.priority_tier\) === 1\);/.test(ak) && /SET follow_up_date = \$\{datum\}::date/.test(ak) && /gedeckelt: deckel\.gedeckelt/.test(ak));
  const tb = quelle("server/lib/fiaon-tagesbericht.ts");
  // Nur der Schreibweg (nachtraegeBuchen) — die Lesestellen (aufzeichnungFuer …) zählen zu Recht type 'result'.
  const tbNachtrag = tb.slice(tb.indexOf("export async function nachtraegeBuchen("), tb.indexOf("export async function berichtAbgeben("))
    .split("\n").filter((z) => !/^\s*(\/\/|\*)/.test(z)).join("\n");
  ok("G5: Tagesbericht-Nachtrag ist eine Systemzeile mit Marke — KEIN type 'result' mehr",
    tbNachtrag.length > 200 && !/'result'/.test(tbNachtrag) && (tbNachtrag.match(/'system',/g) || []).length === 2 && /\$\{TAGESBERICHT_NACHTRAG_MARKE\} vom \$\{tagDe\}/.test(tb));
  ok("G5: … mit dem Mittag des Berichtstags (nie später als jetzt) und der Regel ab dem Berichtstag (amTag)",
    (tb.match(/LEAST\(NOW\(\), \(\$\{tag\}::date \+ TIME '12:00'\) AT TIME ZONE 'Europe\/Berlin'\)/g) || []).length === 2 && (tb.match(/amTag: tag \}, lauf\)/g) || []).length === 2);
  ok("G5: Nachträge prüfbar (nachtraegeBuchen mit lauf), berichtAbgeben ruft sie", /export async function nachtraegeBuchen\(/.test(tb) && /await nachtraegeBuchen\(agent, tag, e\.nachgetragen, e\.zusagen\)/.test(tb));
  ok("G1: ergebnisAnwenden kennt Stufe A bei JEDEM Ergebnis (nicht nur bei Fehlversuchen)",
    /if \(personId\) \{\s*\n\s*const \{ fehlversuchZaehlen, wiedervorlageKontext \} = await import\("\.\/fiaon-fehlversuch"\);\s*\n\s*if \(zaehlerHoch\) \{/.test(ke)
    && /const k = await wiedervorlageKontext\(personId, lauf\);/.test(ke));
  ok("G1: Stufe A an die Leitung deckelt auch eine übergebene Wahl", /stufeADeckeln\(gewaehlt, berlinToday\(\), true\)/.test(nee));
  const mara = quelle("server/lib/fiaon-whatsapp-mara.ts");
  ok("Mara-Zusage setzt die Wiedervorlage der einen Regel", /naechsterVersuch\(\{ ergebnis: "erreicht_zahlt_am", heute, zusageDatum: datum \}\)/.test(mara));
  ok("Übergabe nach „blockiert“: Wiedervorlage heute in BERLIN (hebt die Tagespause auf)",
    /follow_up_date = \(NOW\(\) AT TIME ZONE 'Europe\/Berlin'\)::date/.test(quelle("server/lib/fiaon-uebergabe.ts")));
  const av = quelle("server/lib/fiaon-anrufversuche.ts");
  ok("Telefonkartei liest Frische und Pause aus derselben Regel", /FRISCH_TAGE = FRISCH_TAGE_REGEL/.test(av) && /PAUSE_STUNDEN = TAGESPAUSE_STUNDEN/.test(av));
  const mig = existsSync(new URL("../db/migrations/097_fehlversuch_marke.sql", import.meta.url)) ? quelle("db/migrations/097_fehlversuch_marke.sql") : "";
  ok("Migration 097: eigene kleine Tabelle, IF NOT EXISTS, kein ALTER an fiaon_persons", /CREATE TABLE IF NOT EXISTS fiaon_fehlversuch_marke/.test(mig) && !/ALTER TABLE fiaon_persons/i.test(mig) && /lock_timeout/.test(mig));

  // ── Bedienbar: Knöpfe und Anzeigen ───────────────────────────────────────
  const pl = quelle("client/src/pages/agent/pipeline.tsx");
  const ew = quelle("client/src/components/agent/ErgebnisWahl.tsx");
  const wv = quelle("client/src/components/agent/WiedervorlageWahl.tsx");
  ok("Akte (dunkel): Wahl „nach Regel · 1 Woche · 2 Wochen“ über den Ergebnis-Knöpfen", /<WiedervorlageWahl wahl=\{wahl\} onWahl=\{setWahl\}/.test(pl));
  ok("Akte: „→ Mi 15.10.“ unter jedem Ergebnis-Knopf (vorschauFuer)", /vorschauFuer\(e\.art, kontext, wahl, heute\)/.test(pl) && /className="pi-ew-wann"/.test(pl));
  ok("Akte: die Wahl geht als wiedervorlage an den Server", /wiedervorlage: d \}/.test(pl) && /mitWahl\(offen\.art, zusatz\)/.test(pl));
  ok("Akte: Chip „Wieder dran am …“ und Knopf „Heute wieder dran“", /data-fiaon="akte-wieder-dran"/.test(pl) && /data-fiaon="akte-heute-wieder-dran"/.test(pl) && /\/agent\/crm\/kunden\/\$\{k\.personId\}\/wiedervorlage/.test(pl));
  ok("Pipeline: „heute erledigt X · Y pausiert“ und die Liste mit „Heute wieder dran“", /data-fiaon="pausiert-oeffnen"/.test(pl) && /function PausiertListe\(/.test(pl) && /api\("\/agent\/vertrieb\/pausiert"\)/.test(pl) && /data-fiaon="heute-wieder-dran"/.test(pl));
  ok("Karte: „zuletzt versucht vor … Tagen“ und der Grund", /function versuchText\(/.test(pl) && /k\.wiederText \|\| "Zusage prüfen"/.test(pl));
  ok("Kundenkarte (hell): dieselbe Wahl, dieselbe Weitergabe", /<WiedervorlageWahl wahl=\{wahl\}/.test(ew) && /wiedervorlage: wv/.test(ew));
  ok("G4: Fokus-Karte und Akte-Kopf behandeln eine alte Zusage auf Stufe A nicht als „nachfassen“/rot",
    /if \(z\?\.dringend && k\.tier !== 1\) return `Zahlungszusage/.test(pl) && /zusage\.dringend && k\.tier !== 1 \? " dringend" : ""/.test(pl));
  ok("G1: Wahl-Bauteil graut „1/2 Wochen“ bei Stufe A aus und sagt warum", /disabled=\{!moeglich\}/.test(wv) && /handwahlMoeglich\(h\.schluessel, heute, stufeA\)/.test(wv) && /data-fiaon="wiedervorlage-stufe-a"/.test(wv));
  ok("G1: Akte, Kundenkarte und Kundenliste geben Stufe A an das Bauteil", /stufeA=\{kontext\?\.stufeA === true\}/.test(pl) && /wahlDatum\(wahl, heute, kontext\?\.stufeA === true\)/.test(pl)
    && /stufeA=\{stufeA\}/.test(ew) && /wahlDatum\(wahl, heuteBerlin\(\), stufeA\)/.test(ew) && /stufeA=\{k\.tier === 1\}/.test(quelle("client/src/pages/agent/kunden-neu.tsx")));
  ok("Ein Bauteil, dieselbe Rechnung wie der Server (naechsterVersuch aus shared)", /from "@shared\/fiaon-wiedervorlage"/.test(wv) && /naechsterVersuch\(\{/.test(wv));
  ok("Haken stehen über dem ersten return (PausiertListe, ErgebnisWahlDunkel)", (() => {
    const pa = pl.slice(pl.indexOf("function PausiertListe("), pl.indexOf("function KleineKarte("));
    const ew2 = pl.slice(pl.indexOf("function ErgebnisWahlDunkel("), pl.indexOf("function ProduktDunkel("));
    const hakenNachReturn = (t: string) => { const r = t.indexOf("return ("); return r > 0 && /use(State|Effect|Callback|Memo|Ref)\(/.test(t.slice(r)); };
    return !hakenNachReturn(pa) && !hakenNachReturn(ew2);
  })());
  const rg = quelle("client/src/pages/agent/rundgaenge.ts");
  ok("Rundgang Pipeline: Regel, „pausiert“, „Heute wieder dran“, Rotation", /Jedes Ergebnis sagt dir, wann der Mensch wieder dran ist/.test(rg) && /Wer pausiert, ist nicht verloren/.test(rg) && /Heute wieder dran/.test(rg) && /rotiert die Liste/.test(rg));
  ok("Rundgang: der alte Satz „morgen rechts unter Wieder dran“ ist weg", !/Wen du nicht erreichst, siehst du heute nicht wieder — morgen rechts/.test(rg));
  ok("Rundgang ehrlich nach der Gegenprüfung: frisch „hinten“, Stufe A auch von Hand, gerade bearbeitet „auch nicht mit frischem Antrag“",
    /dort aber hinten, hinter allen, die länger/.test(rg) && /auch wenn du „in 1 Woche“ wählst/.test(rg) && /auch nicht mit frischem Antrag/.test(rg) && /ausgegraut/.test(rg));
  const up = quelle("client/src/pages/agent/updates-data.ts");
  ok("Feed-Eintrag für das Team", /id: "2026-10-08-wiedervorlage-regel"/.test(up));

  // ── FERTIGSTELLUNG (08.10.2026): die drei niedrigen Funde der Gegenprüfung ──
  // N1 Schulung nannte noch „Zahlt sofort → morgen“; N2 die große Liste (sort=arbeit)
  // hielt jede abgelaufene Zusage auf Rang 2; N3 „pausiert“ zählte Menschen, die
  // „Heute wieder dran“ gar nicht zurückholen kann (Zusage ab heute, Termin später).
  const acad = quelle("shared/fiaon-academy.ts");
  const acadMod = await import("../shared/fiaon-academy");
  const acadText = JSON.stringify(acadMod);
  ok("N1: Schulung „ergebnis“ nennt die Regel aus shared (ZAHLT_SOFORT_WERKTAGE), nicht mehr „auf morgen“",
    /import \{ ZAHLT_SOFORT_WERKTAGE \} from "\.\/fiaon-wiedervorlage"/.test(acad) && !/Wiedervorlage auf morgen/.test(acad)
    && acadText.includes(`nach ${ZAHLT_SOFORT_WERKTAGE} Werktagen wieder`) && acadText.includes("am Werktag danach zurück"));
  const ast = quelle("server/routes/fiaon-agent-start.ts");
  ok("N2: Große Liste (sort=arbeit) reiht eine abgelaufene Zusage nur einmal vorn (zusageOffenSql), kein Dauer-Rang 2",
    /WHEN \$\{zusageOffenSql\(\)\} THEN 2/.test(ast) && !/promised_payment_date <= \$\{HEUTE\} THEN 2/.test(ast)
    && /import \{ zusageOffenSql \} from "\.\.\/lib\/fiaon-pipeline-reihung"/.test(ast));
  const pausiertSql = ov.slice(ov.indexOf("const PAUSIERT_SQL = `"), ov.indexOf("const POOL_RUECKFALL_TAGE"));
  ok("N3: „pausiert“ ohne Zusage ab heute und ohne Termin an einem späteren Tag (dieselben Ausschlüsse wie die Liste)",
    /p\.promised_payment_date IS NULL OR p\.promised_payment_date < \$\{HEUTE\}/.test(pausiertSql)
    && /tzp\.status = 'gebucht' AND tzp\.abgesagt_am IS NULL/.test(pausiertSql) && /::date > \$\{HEUTE\}\)/.test(pausiertSql));
  ok("N3: „Heute wieder dran“ sagt auch „Termin am …“ und „heute schon erreicht“",
    /Er hat einen Termin am \$\{st\.termin_am\}/.test(ak) && /Er wurde heute schon erreicht — ab morgen steht er wieder in der Liste\./.test(ak));

  // ── Nachprüfung 08.10.2026: JEDER BENUTZTE NAME IST AUCH IMPORTIERT ──────
  // Nach den Neustarts fehlten in der Route „Heute wieder dran" die Importe
  // stufeADeckeln/STUFE_A_HINWEIS (ReferenceError → HTTP 500 bei jedem Klick)
  // und in stufeAAnLeitung der Deckel. Die Muster-Prüfungen oben sahen es nicht.
  // Hier: Jeder Name, den die drei neuen Module ausführen und eine geänderte
  // Datei benutzt, ist dort importiert (statisch oder per await import) oder
  // selbst definiert. Kommentare zählen nicht.
  const modulExporte = (pfad: string) => [...quelle(pfad).matchAll(/^export (?:const|function|async function|type|interface|class|let) ([A-Za-z_]\w*)/gm)].map((m) => m[1]);
  const MODULE: Record<string, string[]> = {
    "fiaon-wiedervorlage": modulExporte("shared/fiaon-wiedervorlage.ts"),
    "fiaon-pipeline-reihung": modulExporte("server/lib/fiaon-pipeline-reihung.ts"),
    "fiaon-fehlversuch": modulExporte("server/lib/fiaon-fehlversuch.ts"),
  };
  const NUTZER = [
    "client/src/components/agent/ErgebnisWahl.tsx", "client/src/components/agent/WiedervorlageWahl.tsx",
    "client/src/pages/agent/kunden-neu.tsx", "client/src/pages/agent/pipeline.tsx", "client/src/pages/agent/rundgaenge.ts",
    "client/src/pages/agent/updates-data.ts", "server/lib/fiaon-anrufversuche.ts", "server/lib/fiaon-inkasso.ts",
    "server/lib/fiaon-kontakt-ergebnis.ts", "server/lib/fiaon-nicht-erreicht.ts", "server/lib/fiaon-tagesbericht.ts",
    "server/lib/fiaon-uebergabe.ts", "server/lib/fiaon-whatsapp-mara.ts", "server/lib/tier.ts",
    "server/routes/fiaon-agent-kunden.ts", "server/routes/fiaon-agent-start.ts", "server/routes/fiaon-office-vertrieb.ts",
    "shared/fiaon-academy.ts", "shared/fiaon-raten-ergebnisse.ts", "server/lib/fiaon-fehlversuch.ts",
    "server/lib/fiaon-pipeline-reihung.ts",
  ];
  const ohneKommentare = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
  const fehlendeImporte = (pfad: string, roh: string): string[] => {
    const aus: string[] = [];
    // Bekannt: import { a, b as c } from "…", const { a, b: c } = await import("…"), eigene Definitionen.
    const bekannt = new Set<string>();
    for (const m of roh.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["'][^"']*["']/g)) {
      for (const teil of m[1].split(",")) { const n = teil.trim().replace(/^type\s+/, "").split(/\s+as\s+/).pop()!.trim(); if (n) bekannt.add(n); }
    }
    for (const m of roh.matchAll(/(?:const|let)\s*\{([^}]*)\}\s*=\s*await\s+import\(/g)) {
      for (const teil of m[1].split(",")) { const n = teil.trim().split(":").pop()!.trim(); if (n) bekannt.add(n); }
    }
    for (const m of roh.matchAll(/\b(?:const|let|var|function|class|type|interface)\s+([A-Za-z_]\w*)/g)) bekannt.add(m[1]);
    for (const [modul, namen] of Object.entries(MODULE)) {
      if (pfad.includes(modul)) continue;
      for (const n of namen) {
        if (bekannt.has(n)) continue;
        // Benutzt = eigenständiger Bezeichner (nicht obj.n, kein Objektschlüssel „n:“, nicht Teil eines Worts).
        if (new RegExp(`(?<![\\w$.])${n}(?![\\w$])(?!\\s*:(?!:))`).test(roh)) aus.push(`${pfad}: ${n} (aus ${modul})`);
      }
    }
    return aus;
  };
  gleich("Nachprüfung: Jeder benutzte Name aus Wiedervorlage-Regel, Reihung und Fehlversuch ist importiert (kein ReferenceError)",
    NUTZER.flatMap((pfad) => fehlendeImporte(pfad, ohneKommentare(quelle(pfad)))), []);
  // Rotprobe: der Stand nach den Neustarts (Import ohne stufeADeckeln/STUFE_A_HINWEIS) wäre aufgefallen.
  const IMPORT_NEU = `import { handwahlDatum, handwahlPruefen, wiederDranText, stufeADeckeln, STUFE_A_HINWEIS } from "@shared/fiaon-wiedervorlage";`;
  const IMPORT_ALT = `import { handwahlDatum, handwahlPruefen, wiederDranText } from "@shared/fiaon-wiedervorlage";`;
  gleich("Rotprobe: ohne die zwei Importe meldet die Prüfung genau die Route „Heute wieder dran“",
    ak.includes(IMPORT_NEU) ? fehlendeImporte("server/routes/fiaon-agent-kunden.ts", ohneKommentare(ak.replace(IMPORT_NEU, IMPORT_ALT))) : ["Import fehlt"],
    ["server/routes/fiaon-agent-kunden.ts: STUFE_A_HINWEIS (aus fiaon-wiedervorlage)", "server/routes/fiaon-agent-kunden.ts: stufeADeckeln (aus fiaon-wiedervorlage)"]);
  const NEE_NEU = "  plusWerktage, staffelNachFehlversuch, stufeADeckeln,\n";
  gleich("Rotprobe: ohne den Import in fiaon-nicht-erreicht meldet die Prüfung stufeADeckeln",
    nee.includes(NEE_NEU) ? fehlendeImporte("server/lib/fiaon-nicht-erreicht.ts", ohneKommentare(nee.replace(NEE_NEU, "  plusWerktage, staffelNachFehlversuch,\n"))) : ["Import fehlt"],
    ["server/lib/fiaon-nicht-erreicht.ts: stufeADeckeln (aus fiaon-wiedervorlage)"]);
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. LOKALE DATENBANK
// ═══════════════════════════════════════════════════════════════════════════
const DBURL = String(process.env.DATABASE_URL ?? "");
if (!/^postgres(ql)?:\/\/[^@]*@(127\.0\.0\.1|localhost):54329\/fiaon_/.test(DBURL)) {
  console.log("\n── 3. Datenbank: ÜBERSPRUNGEN (nur gegen die lokale Kopie 127.0.0.1:54329/fiaon_…, nie gegen die Produktion)");
} else {
  await datenbankTeil();
}

async function datenbankTeil(): Promise<void> {
  const { sqlPool } = await import("../server/lib/db-pool");
  const { berlinToday } = await import("../server/lib/fiaon-time");
  const { ergebnisAnwenden } = await import("../server/lib/fiaon-kontakt-ergebnis");
  const { ratenErgebnisAnwenden } = await import("../server/lib/fiaon-inkasso");
  const { alleTierAktualisieren, personTierAktualisieren } = await import("../server/lib/tier");
  const { nachtraegeBuchen } = await import("../server/lib/fiaon-tagesbericht");
  const { fehlversuchTabelle } = await import("../server/lib/fiaon-fehlversuch");
  const { globalKundeBereit } = await import("../server/lib/fiaon-global-kunde");
  const ov = await import("../server/routes/fiaon-office-vertrieb");
  const reihung = await import("../server/lib/fiaon-pipeline-reihung");
  const { EREIGNIS_SQL } = reihung;

  // AGENTS.md, Falle 1: DDL über den globalen Pool VOR der Transaktion.
  await fehlversuchTabelle();
  await globalKundeBereit();
  const heute = berlinToday();
  const MARKE = `PRUEFITA-${Date.now().toString(36)}`;
  class Zurueckrollen extends Error {}
  let lfd = 0;

  try {
    await sqlPool.begin(async (tx: any) => {
      // ── Bausteine ───────────────────────────────────────────────────────
      const agent = async (name: string): Promise<number> => {
        const [a] = await tx`
          INSERT INTO fiaon_agents (email, name, first_name, rolle, active, is_test_account)
          VALUES (${`${MARKE.toLowerCase()}-${++lfd}@pruefstand.invalid`}, ${`${name} ${MARKE}`}, ${name}, 'agent', TRUE, TRUE)
          RETURNING id`;
        return Number(a.id);
      };
      const person = async (o: { agent: number | null; tier: number; reason?: string; zaehler?: number; wv?: string | null; zusage?: string | null }): Promise<number> => {
        const [p] = await tx`
          INSERT INTO fiaon_persons (person_ref, first_name, last_name, assigned_agent_id, priority_tier, tier_reason,
                                     unreachable_count, follow_up_date, promised_payment_date, primary_email, primary_phone, created_at)
          VALUES (${`${MARKE}-P${++lfd}`}, 'Prüf', ${`Person${lfd}`}, ${o.agent}, ${o.tier}, ${o.reason ?? "rechnung_offen"},
                  ${o.zaehler ?? 0}, ${o.wv ?? null}, ${o.zusage ?? null},
                  ${`p${lfd}-${MARKE.toLowerCase()}@pruefstand.invalid`}, ${`+4915177${String(100000 + lfd)}`},
                  -- Alt angelegt: Sonst wäre jeder Prüfmensch „frisch" (EREIGNIS_SQL nimmt auch p.created_at).
                  NOW() - INTERVAL '60 days')
          RETURNING id`;
        return Number(p.id);
      };
      // Zeitpunkte: „vor n Stunden" oder ein Berliner Zeitpunkt („JJJJ-MM-TT HH:MM", amBerlin) —
      // Letzteres für Fälle, die am Kalender hängen (vorheriger Werktag), damit der Prüfstand
      // nicht von der Uhrzeit des Laufs abhängt.
      const zeit = (vorStunden: number, amBerlin?: string) => amBerlin
        ? tx`(${amBerlin}::timestamp AT TIME ZONE 'Europe/Berlin')`
        : tx`NOW() - (${vorStunden}::int * INTERVAL '1 hour')`;
      const antrag = async (o: { person: number; vorStunden: number; amBerlin?: string; zahlung?: string; status?: string; schritt?: number; bezahltVorStunden?: number; gemeldetVorStunden?: number }): Promise<string> => {
        const ref = `FIAON-${MARKE}-A${++lfd}`;
        await tx`
          INSERT INTO fiaon_applications (ref, payment_reference, person_id, created_at, submitted_at, current_step, status,
                                          payment_status, paid_at, claimed_paid_at, pack_key, pack_name, ist_entwurf)
          VALUES (${ref}, ${`FI-${MARKE}-${lfd}`}, ${o.person},
                  ${zeit(o.vorStunden, o.amBerlin)},
                  ${o.schritt === 0 ? null : zeit(o.vorStunden, o.amBerlin)},
                  ${o.schritt ?? 8}, ${o.status ?? "submitted"}, ${o.zahlung ?? "pending_payment"},
                  ${o.bezahltVorStunden != null ? tx`NOW() - (${o.bezahltVorStunden}::int * INTERVAL '1 hour')` : null},
                  ${o.gemeldetVorStunden != null ? tx`NOW() - (${o.gemeldetVorStunden}::int * INTERVAL '1 hour')` : null},
                  'basis', 'FIAON Basis', FALSE)`;
        return ref;
      };
      const ergebnisZeile = async (o: { ref: string; person?: number | null; agent: number; outcome: string; vorStunden: number; amBerlin?: string; geplantVorStunden?: number }) => {
        await tx`
          INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, outcome, note, scheduled_at, created_at)
          VALUES (${o.ref}, ${o.person ?? null}, ${o.agent}, 'Prüfstand', 'result', ${o.outcome}, ${MARKE},
                  ${o.geplantVorStunden != null ? tx`NOW() - (${o.geplantVorStunden}::int * INTERVAL '1 hour')` : null},
                  ${zeit(o.vorStunden, o.amBerlin)})`;
      };
      const anruf = async (o: { person: number; agent: number; vorStunden: number; status: string }) => {
        await tx`
          INSERT INTO fiaon_calls (agent_id, person_id, nummer, richtung, status, beginn, twilio_sid)
          VALUES (${o.agent}, ${o.person}, '+491517700000', 'raus', ${o.status},
                  NOW() - (${o.vorStunden}::int * INTERVAL '1 hour'), ${`CA${MARKE}${++lfd}`})`;
      };
      const zustand = async (id: number) => {
        const [z] = await tx`
          SELECT unreachable_count, to_char(follow_up_date, 'YYYY-MM-DD') AS wv, to_char(promised_payment_date, 'YYYY-MM-DD') AS zusage,
                 ruhe_seit, priority_tier FROM fiaon_persons WHERE id = ${id}`;
        return { zaehler: Number(z.unreachable_count), wv: z.wv as string | null, zusage: z.zusage as string | null, ruht: !!z.ruhe_seit, stufe: Number(z.priority_tier) };
      };
      const tagVor = (tage: number) => plusKalendertage(heute, -tage);
      // Der vorige Werktag (Mo → Fr) — „gerade bearbeitet" heißt: an ihm oder heute versucht.
      let vorWT = plusKalendertage(heute, -1); while (!istWerktag(vorWT)) vorWT = plusKalendertage(vorWT, -1);

      // ═══════════════════════════════════════════════════════════════════
      abschnitt("3a. ergebnisAnwenden — dieselbe Regel in der Datenbank");
      // ═══════════════════════════════════════════════════════════════════
      const ag = await agent("Ergebnis");
      {
        const p = await person({ agent: ag, tier: 2 }); const ref = await antrag({ person: p, vorStunden: 24 * 20 });
        const w = await ergebnisAnwenden({ ref, personId: p, ergebnis: "erreicht_zahlt_gleich" }, tx);
        const z = await zustand(p);
        gleich("Zahlt sofort → Wiedervorlage +3 Werktage, Zusage heute", [z.wv, z.zusage], [plusWerktage(heute, 3), heute]);
        ok("… Meldung sagt „Wieder dran am …“", /Wieder dran am .* · Zahlung prüfen/.test(w.meldung), w.meldung);
        gleich("… Wirkung trägt Grund und Text", [w.grund, w.text?.startsWith("Wieder dran")], ["zahlung_pruefen", true]);
      }
      {
        // Ein Freitag in der Zukunft — die Wiedervorlage ist der Montag danach.
        let fr = plusKalendertage(heute, 7); while (new Date(`${fr}T12:00:00Z`).getUTCDay() !== 5) fr = plusKalendertage(fr, 1);
        const p = await person({ agent: ag, tier: 2 }); const ref = await antrag({ person: p, vorStunden: 24 * 20 });
        await ergebnisAnwenden({ ref, personId: p, ergebnis: "erreicht_zahlt_am", zusageDatum: fr }, tx);
        const z = await zustand(p);
        gleich("Zahlt am (Freitag) → Montag danach, NICHT NULL (Gegenprüfung 7: vorher NULL)", [z.wv, z.zusage], [plusWerktage(fr, 1), fr]);
        const [a] = await tx`SELECT to_char(promised_pay_date, 'YYYY-MM-DD') AS d FROM fiaon_applications WHERE ref = ${ref}`;
        gleich("… dieselbe Zusage an der Bestellung", a.d, fr);
      }
      {
        const p = await person({ agent: ag, tier: 2 }); const ref = await antrag({ person: p, vorStunden: 24 * 20 });
        const w1 = await ergebnisAnwenden({ ref, personId: p, ergebnis: "nicht_erreicht" }, tx);
        let z = await zustand(p);
        gleich("Nicht erreicht (1.) → Zähler 1, +2 Werktage", [z.zaehler, z.wv, w1.gezaehlt], [1, plusWerktage(heute, 2), true]);
        const w2 = await ergebnisAnwenden({ ref, personId: p, ergebnis: "nicht_erreicht" }, tx);
        z = await zustand(p);
        gleich("Doppelbuchung binnen Minuten (Softphone + Akte) → Zähler bleibt 1", [z.zaehler, w2.gezaehlt], [1, false]);
        ok("… die Meldung sagt es", /nicht doppelt/.test(w2.meldung), w2.meldung);
        const w3 = await ergebnisAnwenden({ ref, personId: p, ergebnis: "mailbox" }, tx);
        gleich("… auch Mailbox derselben Minute zählt nicht", [(await zustand(p)).zaehler, w3.gezaehlt], [1, false]);
        await tx`UPDATE fiaon_fehlversuch_marke SET am = NOW() - INTERVAL '31 minutes' WHERE person_id = ${p}`;
        const w4 = await ergebnisAnwenden({ ref, personId: p, ergebnis: "nicht_erreicht" }, tx);
        z = await zustand(p);
        gleich("Nach 31 Minuten zählt der nächste Versuch (2.) → +3 Werktage", [z.zaehler, z.wv, w4.gezaehlt], [2, plusWerktage(heute, 3), true]);
        await ergebnisAnwenden({ ref, personId: p, ergebnis: "erreicht_sonstiges" }, tx);
        z = await zustand(p);
        gleich("Erreicht → Zähler 0, Sonstiges +3 Werktage", [z.zaehler, z.wv], [0, plusWerktage(heute, 3)]);
        const w5 = await ergebnisAnwenden({ ref, personId: p, ergebnis: "nicht_erreicht" }, tx);
        gleich("… nach dem Gespräch zählt ein Fehlversuch sofort wieder (Marke zurückgesetzt)", [(await zustand(p)).zaehler, w5.gezaehlt], [1, true]);
      }
      {
        const p = await person({ agent: ag, tier: 2, zaehler: 5 }); const ref = await antrag({ person: p, vorStunden: 24 * 20 });
        await ergebnisAnwenden({ ref, personId: p, ergebnis: "nicht_erreicht" }, tx);
        const z = await zustand(p);
        gleich("6. Fehlversuch (Stufe B) → 14 Tage Pause", [z.zaehler, z.wv], [6, naechsterWerktag(plusKalendertage(heute, 14))]);
        const [m] = await tx`SELECT COUNT(*)::int AS n FROM fiaon_mail_log WHERE person_id = ${p}`;
        ok("… Terminlink-Versuch protokolliert (ohne Schlüssel und ohne Netz: nichts ging raus)", Number(m.n) >= 1 && FREMD.length === 0, { mails: m.n, fremd: FREMD });
      }
      {
        const p = await person({ agent: ag, tier: 2, zaehler: 8 }); const ref = await antrag({ person: p, vorStunden: 24 * 20 });
        await ergebnisAnwenden({ ref, personId: p, ergebnis: "nicht_erreicht" }, tx);
        const z = await zustand(p);
        gleich("9. Fehlversuch (Stufe B) → ruhend, keine Wiedervorlage", [z.zaehler, z.ruht, z.wv], [9, true, null]);
      }
      {
        const p = await person({ agent: ag, tier: 1, reason: "zahlung_angekuendigt", zaehler: 5 });
        const ref = await antrag({ person: p, vorStunden: 24 * 20, zahlung: "claimed_paid", gemeldetVorStunden: 24 * 20 });
        await ergebnisAnwenden({ ref, personId: p, ergebnis: "nicht_erreicht" }, tx);
        const z = await zustand(p);
        gleich("Stufe A, 6. Fehlversuch → höchstens 3 Werktage (vorher: jeden Tag fällig)", [z.zaehler, z.wv, z.ruht], [6, plusWerktage(heute, 3), false]);
        await tx`UPDATE fiaon_persons SET unreachable_count = 8 WHERE id = ${p}`;
        await tx`UPDATE fiaon_fehlversuch_marke SET am = NOW() - INTERVAL '1 hour' WHERE person_id = ${p}`;
        await ergebnisAnwenden({ ref, personId: p, ergebnis: "nicht_erreicht" }, tx);
        const z9 = await zustand(p);
        const [auf] = await tx`SELECT COUNT(*)::int AS n FROM fiaon_vermerke WHERE art = 'aufgabe' AND ref = ${ref} AND text LIKE 'Zahlung gemeldet, %'`;
        gleich("Stufe A, 9. → Leitung bekommt die Aufgabe, ruht NICHT, 3 Werktage", [z9.zaehler, z9.ruht, z9.wv, Number(auf.n)], [9, false, plusWerktage(heute, 3), 1]);
      }
      {
        const p = await person({ agent: ag, tier: 2 }); const ref = await antrag({ person: p, vorStunden: 30 });
        await ergebnisAnwenden({ ref, personId: p, ergebnis: "nicht_erreicht" }, tx);
        gleich("Frischer Antrag (30 Std.) → nächster Werktag", (await zustand(p)).wv, plusWerktage(heute, 1));
      }
      {
        const p = await person({ agent: ag, tier: 2 }); const ref = await antrag({ person: p, vorStunden: 24 * 20 });
        await ergebnisZeile({ ref, agent: ag, outcome: "rueckruf_termin", vorStunden: 30, geplantVorStunden: 6 });
        await ergebnisZeile({ ref, agent: ag, outcome: "rueckruf_termin", vorStunden: 1, geplantVorStunden: -30 });
        await ergebnisAnwenden({ ref, personId: p, ergebnis: "nicht_erreicht" }, tx);
        const r = await tx`SELECT (scheduled_at <= NOW()) AS faellig, done_at IS NOT NULL AS erledigt FROM fiaon_contact_log WHERE ref = ${ref} AND outcome = 'rueckruf_termin' ORDER BY scheduled_at`;
        gleich("Ein Ergebnis nach der Rückrufzeit beantwortet den fälligen Rückruf — der künftige bleibt offen",
          r.map((x: any) => [x.faellig, x.erledigt]), [[true, true], [false, false]]);
      }
      {
        const p = await person({ agent: ag, tier: 2 }); const ref = await antrag({ person: p, vorStunden: 24 * 20 });
        let wahl = plusKalendertage(heute, 7); while (!istWerktag(wahl)) wahl = plusKalendertage(wahl, 1);
        const w = await ergebnisAnwenden({ ref, personId: p, ergebnis: "nicht_erreicht", wiedervorlage: wahl }, tx);
        gleich("Wahl von Hand „in 1 Woche“ gewinnt", [(await zustand(p)).wv, w.grund], [wahl, "von_hand"]);
      }

      // ── G1: Stufe A — auch von Hand höchstens 3 Werktage ─────────────────
      {
        const zweiW = handwahlDatum("zwei_wochen", heute)!;
        const p = await person({ agent: ag, tier: 1, reason: "zahlung_angekuendigt" });
        const ref = await antrag({ person: p, vorStunden: 24 * 20, zahlung: "claimed_paid", gemeldetVorStunden: 24 * 20 });
        const w = await ergebnisAnwenden({ ref, personId: p, ergebnis: "erreicht_sonstiges", wiedervorlage: zweiW }, tx);
        gleich("G1: Stufe A + „Sonstiges“ + „in 2 Wochen“ → 3 Werktage (Befund: 14 Tage, Stufe nie gefragt)", (await zustand(p)).wv, plusWerktage(heute, 3));
        ok("… die Meldung nennt den Deckel", w.meldung.includes(STUFE_A_HINWEIS), w.meldung);
        const w2 = await ergebnisAnwenden({ ref, personId: p, ergebnis: "nicht_erreicht", wiedervorlage: zweiW }, tx);
        gleich("G1: Stufe A + „nicht erreicht“ + „in 2 Wochen“ → 3 Werktage", [(await zustand(p)).wv, w2.grund], [plusWerktage(heute, 3), "von_hand"]);
      }
      {
        const zweiW = handwahlDatum("zwei_wochen", heute)!;
        const p = await person({ agent: ag, tier: 1, reason: "zahlung_angekuendigt", zaehler: 8 });
        const ref = await antrag({ person: p, vorStunden: 24 * 20, zahlung: "claimed_paid", gemeldetVorStunden: 24 * 20 });
        await ergebnisAnwenden({ ref, personId: p, ergebnis: "nicht_erreicht", wiedervorlage: zweiW }, tx);
        const z = await zustand(p);
        const [auf] = await tx`SELECT COUNT(*)::int AS n FROM fiaon_vermerke WHERE art = 'aufgabe' AND ref = ${ref} AND text LIKE 'Zahlung gemeldet, %'`;
        gleich("G1: Stufe A, 9. Fehlversuch + „in 2 Wochen“ → Leitung UND 3 Werktage (Befund: 14 Tage)", [z.zaehler, z.wv, Number(auf.n)], [9, plusWerktage(heute, 3), 1]);
      }
      {
        const p = await person({ agent: ag, tier: 1, reason: "zahlung_angekuendigt" });
        const ref = await antrag({ person: p, vorStunden: 24 * 20, zahlung: "claimed_paid", gemeldetVorStunden: 24 * 20 });
        const zusageTag = plusKalendertage(heute, 20);
        await ergebnisAnwenden({ ref, personId: p, ergebnis: "erreicht_zahlt_am", zusageDatum: zusageTag }, tx);
        gleich("G1: Stufe A, „zahlt am“ in 20 Tagen — vereinbart, nicht gedeckelt", (await zustand(p)).wv, plusWerktage(zusageTag, 1));
      }
      {
        // G2 in der Datenbank: frisch + 6. Fehlversuch → Pause, nicht nächster Werktag.
        const p = await person({ agent: ag, tier: 2, zaehler: 5 }); const ref = await antrag({ person: p, vorStunden: 30 });
        await ergebnisAnwenden({ ref, personId: p, ergebnis: "nicht_erreicht" }, tx);
        gleich("G2: frischer Antrag, 6. Fehlversuch → 14 Tage Pause (vorher +1 Werktag)", (await zustand(p)).wv, naechsterWerktag(plusKalendertage(heute, 14)));
      }

      // ═══════════════════════════════════════════════════════════════════
      abschnitt("3b. Ratenweg und Einstufung — Stufe 0 behält ihre Arbeit");
      // ═══════════════════════════════════════════════════════════════════
      const ar = await agent("Rate");
      {
        const p = await person({ agent: ar, tier: 0, reason: "bezahlt" });
        const ref = await antrag({ person: p, vorStunden: 24 * 40, zahlung: "paid", status: "completed", bezahltVorStunden: 24 * 30 });
        await tx`INSERT INTO fiaon_abo_raten (ref, rate_nr, betrag_cents, faellig_am, zahlungsreferenz, status, bezahlt_am)
                 VALUES (${ref}, 1, 4999, ${tagVor(30)}::date, ${`R1-${MARKE}`}, 'bezahlt', NOW() - INTERVAL '30 days')`;
        const [r2] = await tx`INSERT INTO fiaon_abo_raten (ref, rate_nr, betrag_cents, faellig_am, zahlungsreferenz, status)
                 VALUES (${ref}, 2, 4999, ${tagVor(10)}::date, ${`R2-${MARKE}`}, 'offen') RETURNING id`;
        const e1 = await ratenErgebnisAnwenden({ rateId: Number(r2.id), ergebnis: "nicht_erreicht", agentId: ar, agentName: "Prüfstand" }, tx);
        let z = await zustand(p);
        gleich("Rate nicht erreicht → Person +2 Werktage (die eine Regel, nicht „morgen“)", [e1.ok, z.zaehler, z.wv], [true, 1, plusWerktage(heute, 2)]);
        const [rr] = await tx`SELECT to_char(inkasso_wiedervorlage, 'YYYY-MM-DD') AS wv, inkasso_versuche FROM fiaon_abo_raten WHERE id = ${r2.id}`;
        gleich("… die RATE behält ihre eigene Frist (Collections: morgen)", [rr.wv, Number(rr.inkasso_versuche)], [plusKalendertage(heute, 1), 1]);
        const e2 = await ratenErgebnisAnwenden({ rateId: Number(r2.id), ergebnis: "nicht_erreicht", agentId: ar, agentName: "Prüfstand" }, tx);
        z = await zustand(p);
        const [rr2] = await tx`SELECT inkasso_versuche FROM fiaon_abo_raten WHERE id = ${r2.id}`;
        gleich("… Doppelbuchung an der Rate zählt weder an Person noch Rate doppelt", [e2.ok, z.zaehler, Number(rr2.inkasso_versuche)], [true, 1, 1]);
        await alleTierAktualisieren(tx);
        z = await zustand(p);
        gleich("Einstufungstakt (alle 20 Min.) lässt die Wiedervorlage des Ratenkunden STEHEN", [z.stufe, z.wv], [0, plusWerktage(heute, 2)]);

        // Zusage für die Rate bleibt auch stehen.
        let tag = plusKalendertage(heute, 5);
        const e3 = await ratenErgebnisAnwenden({ rateId: Number(r2.id), ergebnis: "zahlt_am", agentId: ar, agentName: "Prüfstand", zusageDatum: tag }, tx);
        await alleTierAktualisieren(tx);
        z = await zustand(p);
        gleich("Raten-Zusage (zahlt am) überlebt den Takt, Wiedervorlage Werktag danach", [e3.ok, z.zusage, z.wv, z.zaehler], [true, tag, plusWerktage(tag, 1), 0]);
        tag = "";
      }
      {
        // Erstzahler: alte Verkaufs-Zusage VOR der Zahlung → wird gelöscht, auch mit fälliger Rate.
        const p = await person({ agent: ar, tier: 0, reason: "bezahlt", wv: tagVor(1), zusage: tagVor(3) });
        const ref = await antrag({ person: p, vorStunden: 24 * 40, zahlung: "paid", status: "completed", bezahltVorStunden: 2 });
        await tx`INSERT INTO fiaon_abo_raten (ref, rate_nr, betrag_cents, faellig_am, zahlungsreferenz, status)
                 VALUES (${ref}, 2, 4999, ${tagVor(1)}::date, ${`R3-${MARKE}`}, 'offen')`;
        await ergebnisZeile({ ref, agent: ar, outcome: "erreicht_zahlt_gleich", vorStunden: 24 * 3 });
        await alleTierAktualisieren(tx);
        const z = await zustand(p);
        gleich("Gesprochen VOR der Zahlung → alte Zusage/Wiedervorlage gelöscht (kein „Zusage gebrochen“ ganz oben)", [z.stufe, z.wv, z.zusage], [0, null, null]);
      }
      {
        // Stufe 0 OHNE fällige Rate: wie bisher gelöscht.
        const p = await person({ agent: ar, tier: 0, reason: "bezahlt", wv: plusKalendertage(heute, 3) });
        const ref = await antrag({ person: p, vorStunden: 24 * 40, zahlung: "paid", status: "completed", bezahltVorStunden: 24 * 20 });
        await ergebnisZeile({ ref, agent: ar, outcome: "nicht_erreicht", vorStunden: 2 });
        await alleTierAktualisieren(tx);
        gleich("Stufe 0 ohne fällige Rate → Arbeitsdaten gelöscht (wie bisher)", (await zustand(p)).wv, null);
      }

      {
        // G3: Mara (zahlungszusage_merken) — Zusage + Wiedervorlage, aber KEIN Gesprächsergebnis.
        const p = await person({ agent: ar, tier: 0, reason: "bezahlt" });
        const ref = await antrag({ person: p, vorStunden: 24 * 40, zahlung: "paid", status: "completed", bezahltVorStunden: 24 * 30 });
        await tx`INSERT INTO fiaon_abo_raten (ref, rate_nr, betrag_cents, faellig_am, zahlungsreferenz, status, bezahlt_am)
                 VALUES (${ref}, 1, 4999, ${tagVor(30)}::date, ${`R4-${MARKE}`}, 'bezahlt', NOW() - INTERVAL '30 days')`;
        await tx`INSERT INTO fiaon_abo_raten (ref, rate_nr, betrag_cents, faellig_am, zahlungsreferenz, status)
                 VALUES (${ref}, 2, 4999, ${tagVor(5)}::date, ${`R5-${MARKE}`}, 'offen')`;
        await ergebnisZeile({ ref, agent: ar, outcome: "erreicht_zahlt_gleich", vorStunden: 24 * 35 });
        const tag = plusKalendertage(heute, 6);
        const wv = naechsterVersuch({ ergebnis: "erreicht_zahlt_am", heute, zusageDatum: tag }).datum!;
        await tx`UPDATE fiaon_persons SET promised_payment_date = ${tag}::date, follow_up_date = ${wv}::date WHERE id = ${p}`;
        await tx`INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note, created_at)
                 VALUES (${ref}, ${p}, NULL, 'Mara', 'system', ${`WhatsApp: Zahlungszusage für den ${tag} (${MARKE}).`}, NOW())`;
        const [altRegel] = await tx.unsafe(`SELECT (COALESCE(p.priority_tier, 0) = 0 AND ${reihung.RATE_FAELLIG_SQL}
            AND ${reihung.LETZTER_KONTAKT_SQL} > ${reihung.LETZTE_ZAHLUNG_SQL}) AS behalten FROM fiaon_persons p WHERE p.id = $1`, [p]);
        ok("G3 Rotprobe: die alte Behalten-Regel (nur Gesprächsergebnis) hätte Maras Zusage gelöscht", altRegel?.behalten === false, altRegel);
        await alleTierAktualisieren(tx);
        let z = await zustand(p);
        gleich("G3: Maras Zusage eines Ratenkunden überlebt den 20-Minuten-Takt (Zusage + Wiedervorlage)", [z.stufe, z.zusage, z.wv], [0, tag, wv]);
        await personTierAktualisieren(tx, { personId: p });
        z = await zustand(p);
        gleich("G3: … und die Einstufung der einzelnen Person", [z.zusage, z.wv], [tag, wv]);
      }
      {
        // G3, je Feld: Erstzahlung heute (Rate 2 schon fällig) — die alte Verkaufs-Zusage
        // liegt VOR der Zahlung und fällt, eine Wiedervorlage NACH dem Zahltag bleibt.
        const p = await person({ agent: ar, tier: 0, reason: "bezahlt", wv: plusKalendertage(heute, 2), zusage: tagVor(3) });
        const ref = await antrag({ person: p, vorStunden: 24 * 40, zahlung: "paid", status: "completed", bezahltVorStunden: 1 });
        await tx`INSERT INTO fiaon_abo_raten (ref, rate_nr, betrag_cents, faellig_am, zahlungsreferenz, status)
                 VALUES (${ref}, 2, 4999, ${tagVor(1)}::date, ${`R6-${MARKE}`}, 'offen')`;
        await ergebnisZeile({ ref, agent: ar, outcome: "erreicht_zahlt_gleich", vorStunden: 24 * 3 });
        await alleTierAktualisieren(tx);
        const z = await zustand(p);
        gleich("G3: je Feld — alte Zusage (vor der Zahlung) fällt, Wiedervorlage nach dem Zahltag bleibt", [z.zusage, z.wv], [null, plusKalendertage(heute, 2)]);
      }

      // ═══════════════════════════════════════════════════════════════════
      abschnitt("3c. Arbeitsliste — Rotation, Tagespause, Zusage einmal, keine Lücke");
      // ═══════════════════════════════════════════════════════════════════
      // Alle Zeitpunkte so gewählt, dass das Ergebnis NICHT von der Uhrzeit des
      // Laufs abhängt: „gerade bearbeitet" (G2) ist entweder sicher (vorheriger
      // Werktag als Berliner Zeitpunkt, vor 2 Stunden) oder sicher nicht (≥ 5 Tage).
      const al = await agent("Liste");
      const P: Record<string, number> = {};
      const R: Record<string, string> = {};
      const anlegen = async (name: string, o: { tier?: number; zaehler?: number; wv?: string | null; zusage?: string | null; antragVorStunden?: number | null; antragAmBerlin?: string; reason?: string; bezahlt?: boolean }) => {
        P[name] = await person({ agent: al, tier: o.tier ?? 2, zaehler: o.zaehler ?? 1, wv: o.wv ?? null, zusage: o.zusage ?? null, reason: o.reason });
        if (o.antragVorStunden !== null) R[name] = await antrag({ person: P[name], vorStunden: o.antragVorStunden ?? 24 * 40, amBerlin: o.antragAmBerlin,
          ...(o.tier === 3 ? { zahlung: "pending", status: "started", schritt: 0 } : {}),
          ...(o.bezahlt ? { zahlung: "paid", status: "completed", bezahltVorStunden: 24 * 30 } : {}) });
      };
      await anlegen("alt", { wv: tagVor(25) });           await ergebnisZeile({ ref: R.alt, agent: al, outcome: "nicht_erreicht", vorStunden: 24 * 30 });
      await anlegen("mittel", { wv: tagVor(8) });          await ergebnisZeile({ ref: R.mittel, agent: al, outcome: "nicht_erreicht", vorStunden: 24 * 10 });
      // Zusage vor 12 Tagen, seither (vor 5 Tagen) schon versucht → KEIN Spitzenplatz mehr.
      await anlegen("zusageVersucht", { wv: tagVor(1), zusage: tagVor(12) });
      await ergebnisZeile({ ref: R.zusageVersucht, agent: al, outcome: "erreicht_zahlt_gleich", vorStunden: 24 * 12 });
      await ergebnisZeile({ ref: R.zusageVersucht, agent: al, outcome: "nicht_erreicht", vorStunden: 24 * 5 });
      // Zusage vor 5 Tagen, seither nicht versucht → EINMAL ganz vorn („Zahlung prüfen“).
      await anlegen("zusageOffen", { zaehler: 0, wv: heute, zusage: tagVor(5) });
      await ergebnisZeile({ ref: R.zusageOffen, agent: al, outcome: "erreicht_zahlt_gleich", vorStunden: 24 * 5 });
      // Rückruf vor 7 Tagen fällig, vor 6 Tagen versucht → beantwortet, kein Dauerrang.
      await anlegen("rueckrufBeantwortet", { wv: tagVor(1) });
      await ergebnisZeile({ ref: R.rueckrufBeantwortet, agent: al, outcome: "rueckruf_termin", vorStunden: 24 * 8, geplantVorStunden: 24 * 7 });
      await ergebnisZeile({ ref: R.rueckrufBeantwortet, agent: al, outcome: "nicht_erreicht", vorStunden: 24 * 6 });
      // Am vorigen Werktag um 15 Uhr versucht, Wiedervorlage heute.
      await anlegen("gestern", { zaehler: 2, wv: heute }); await ergebnisZeile({ ref: R.gestern, agent: al, outcome: "nicht_erreicht", vorStunden: 0, amBerlin: `${vorWT} 15:00` });
      // G2 — DER BEFUND: Antrag am vorigen Werktag, dort um 17 Uhr „nicht erreicht“, Wiedervorlage heute (Frische).
      await anlegen("frischGestern", { wv: heute, antragAmBerlin: `${vorWT} 10:00` });
      await ergebnisZeile({ ref: R.frischGestern, agent: al, outcome: "nicht_erreicht", vorStunden: 0, amBerlin: `${vorWT} 17:00` });
      // G2 — frisch und vor 2 Stunden versucht (sicher frisch, sicher gerade bearbeitet).
      await anlegen("frischHeute", { wv: heute, antragVorStunden: 3 }); await ergebnisZeile({ ref: R.frischHeute, agent: al, outcome: "nicht_erreicht", vorStunden: 2 });
      // G2 — frisch und NICHT gerade bearbeitet: Rate heute fällig, zuletzt vor 10 Tagen versucht → Frische-Band.
      await anlegen("rateFrisch", { tier: 0, zaehler: 0, reason: "bezahlt", bezahlt: true });
      await tx`INSERT INTO fiaon_abo_raten (ref, rate_nr, betrag_cents, faellig_am, zahlungsreferenz, status)
               VALUES (${R.rateFrisch}, 2, 4999, ${heute}::date, ${`R7-${MARKE}`}, 'offen')`;
      await ergebnisZeile({ ref: R.rateFrisch, agent: al, outcome: "nicht_erreicht", vorStunden: 24 * 10 });
      await anlegen("lead", { tier: 3, reason: "antrag_abgebrochen", wv: tagVor(30) }); await ergebnisZeile({ ref: R.lead, agent: al, outcome: "nicht_erreicht", vorStunden: 24 * 40 });
      // Nie ein Gesprächsergebnis, aber Zähler 1 (WhatsApp-Altlast), kein Antrag → vorher in KEINER Spalte.
      await anlegen("luecke", { tier: 3, reason: "nur_lead", antragVorStunden: null });
      // Vor 2 Stunden angerufen (ohne Ergebnis), alte Wiedervorlage → Tagespause.
      await anlegen("heuteAngerufen", { wv: tagVor(5) }); await ergebnisZeile({ ref: R.heuteAngerufen, agent: al, outcome: "nicht_erreicht", vorStunden: 24 * 30 });
      await anruf({ person: P.heuteAngerufen, agent: al, vorStunden: 2, status: "niemand_erreicht" });
      // Ein FEHLGESCHLAGENER Wählvorgang ist kein Versuch — keine Pause durch eine Störung.
      await anlegen("stoerung", { wv: tagVor(5) }); await ergebnisZeile({ ref: R.stoerung, agent: al, outcome: "nicht_erreicht", vorStunden: 24 * 35 });
      await anruf({ person: P.stoerung, agent: al, vorStunden: 1, status: "fehlgeschlagen" });
      // Vor 2 Stunden versucht, aber von Hand „heute wieder dran“ → Pause aufgehoben (aber hinten).
      await anlegen("handHeute", { wv: heute }); await ergebnisZeile({ ref: R.handHeute, agent: al, outcome: "nicht_erreicht", vorStunden: 2 });
      await anlegen("pausiert", { zaehler: 6, wv: plusKalendertage(heute, 12) }); await ergebnisZeile({ ref: R.pausiert, agent: al, outcome: "nicht_erreicht", vorStunden: 24 * 2 });
      await anlegen("neu", { zaehler: 0, antragVorStunden: 24 * 2 });

      const namen = (ids: number[]) => ids.map((id) => Object.keys(P).find((k) => P[k] === id) ?? `#${id}`);
      const geradeBearbeitet = async (ids: number[]): Promise<Record<number, boolean>> => {
        const z = await tx.unsafe(`SELECT p.id, ${reihung.geradeBearbeitetSql()} AS gb, ${reihung.frischBandSql()} AS frisch
                                     FROM fiaon_persons p WHERE p.id = ANY($1::int[])`, [ids]);
        return Object.fromEntries(z.map((r: any) => [Number(r.id), r.gb === true]));
      };
      let liste = await ov.arbeitslisteLesen(al, tx, { wiederBis: 50 });
      let rechts = namen(liste.wieder.map((w) => Number(w.kunde.personId)));
      const links = namen(liste.slots.map((w) => Number(w.kunde.personId)));
      gleich("Rechts, ganze Reihe: Zusage offen → frische Rate → am längsten nicht versucht … → gerade Bearbeitete → Stufe C", rechts,
        ["zusageOffen", "rateFrisch", "stoerung", "alt", "mittel", "rueckrufBeantwortet", "zusageVersucht",
         "gestern", "frischGestern", "frischHeute", "handHeute", "luecke", "lead"]);
      const sechs = await ov.arbeitslisteLesen(al, tx);
      gleich("Die Route zeigt davon die ersten sechs", namen(sechs.wieder.map((w) => Number(w.kunde.personId))), rechts.slice(0, 6));
      ok("Links steht der Neue — und nur er", links.includes("neu") && !links.some((n) => rechts.includes(n)), { links, rechts });
      gleich("Vorrat rechts: alle außer Tagespause und Pausierten", liste.vorrat.wieder, 13);
      ok("Tagespause: vor 2 Std. angerufen → heute nicht noch einmal", !rechts.includes("heuteAngerufen"));
      ok("Pausiert (Wiedervorlage in 12 Tagen) → nicht in der Liste", !rechts.includes("pausiert") && !links.includes("pausiert"));
      ok("„heute erledigt / pausiert“ am Kopf", liste.heute.pausiert >= 1 && typeof liste.heute.erledigt === "number" && liste.heute.datum === heute, liste.heute);

      // ── N3 (Fertigstellung 08.10.2026): „pausiert“ zählt nur, wen die Wiedervorlage zurückhält ──
      {
        const ap = await agent("Pausiert");
        const mk = async (o: { zusage?: string | null }) => {
          const id = await person({ agent: ap, tier: 2, zaehler: 3, wv: plusKalendertage(heute, 10), zusage: o.zusage ?? null });
          const ref = await antrag({ person: id, vorStunden: 24 * 40 });
          await ergebnisZeile({ ref, agent: ap, outcome: "nicht_erreicht", vorStunden: 24 * 2 });
          return id;
        };
        await mk({});                                                  // echt pausiert
        await mk({ zusage: plusKalendertage(heute, 3) });              // Zusage in 3 Tagen → hält die Zusage, nicht die Regel
        const mitTermin = await mk({});                                // Termin in 4 Tagen → hält der Termin
        await tx`INSERT INTO fiaon_termine (person_id, agent_id, beginn, dauer_min, quelle, status)
                 VALUES (${mitTermin}, ${ap}, ((${plusKalendertage(heute, 4)}::date + TIME '10:00') AT TIME ZONE 'Europe/Berlin'), 20, 'onboarding', 'gebucht')`;
        const lp = await ov.arbeitslisteLesen(ap, tx);
        gleich("N3: „Y pausiert“ zählt nur den echt Pausierten (nicht Zusage ab heute, nicht Termin später)", lp.heute.pausiert, 1);
        const [roh] = await tx`SELECT COUNT(*)::int AS n FROM fiaon_persons WHERE assigned_agent_id = ${ap} AND follow_up_date > ${heute}::date`;
        ok("N3 Rotprobe: die alte Bedingung (nur „Wiedervorlage in der Zukunft“) hätte 3 gezählt", Number(roh.n) === 3, roh);
        ok("N3: keiner der drei steht in einer Spalte", lp.wieder.length === 0 && lp.slots.length === 0, { wieder: lp.wieder.length, slots: lp.slots.length });
      }
      const zo = liste.wieder.find((w) => Number(w.kunde.personId) === P.zusageOffen)?.kunde;
      gleich("Karte der offenen Zusage: „Zahlung prüfen“, zusageOffen", [zo?.wiederGrund, zo?.wiederText, zo?.zusageOffen], ["zusage", "Zahlung prüfen", true]);
      const altKarte = liste.wieder.find((w) => Number(w.kunde.personId) === P.alt)?.kunde;
      ok("Karte trägt den letzten Versuch (vor 30 Tagen)", !!altKarte?.letzterVersuch && Math.round((Date.now() - new Date(altKarte.letzterVersuch).getTime()) / 86_400_000) === 30, altKarte?.letzterVersuch);

      // ── G2: gerade Bearbeitete nie vorn ───────────────────────────────────
      const gb = await geradeBearbeitet(Object.values(P));
      ok("G2: Die Prüfmenschen sind, was sie sein sollen (gestern/frischGestern/frischHeute/handHeute gerade bearbeitet; alt, stoerung, rateFrisch nicht)",
        gb[P.gestern] && gb[P.frischGestern] && gb[P.frischHeute] && gb[P.handHeute] && !gb[P.alt] && !gb[P.stoerung] && !gb[P.rateFrisch] && !gb[P.zusageVersucht], gb);
      ok("G2 (Befund): Am vorigen Werktag bearbeitet, frischer Antrag, Wiedervorlage heute → NICHT oben, hinter allen nicht gerade Bearbeiteten",
        rechts.indexOf("frischGestern") > rechts.indexOf("zusageVersucht") && rechts.indexOf("frischGestern") >= 7, rechts);
      {
        const [fr] = await tx.unsafe(`SELECT ${reihung.frischBandSql()} AS frisch FROM fiaon_persons p WHERE p.id = $1`, [P.frischHeute]);
        ok("G2 Rotprobe: frischHeute IST frisch — die alte Reihung (Band 3 = frisch) hätte ihn vor „stoerung“ gestellt; die neue stellt ihn dahinter",
          fr?.frisch === true && rechts.indexOf("frischHeute") > rechts.indexOf("stoerung"), { frisch: fr?.frisch, rechts });
      }
      ok("G2: Die frische, NICHT bearbeitete Rate steht im Frische-Band direkt hinter der offenen Zusage", rechts[1] === "rateFrisch", rechts);
      {
        // Innerhalb von Band 4 kommt kein gerade Bearbeiteter vor einem nicht gerade Bearbeiteten.
        const band4 = ["stoerung", "alt", "mittel", "rueckrufBeantwortet", "zusageVersucht", "gestern", "frischGestern", "frischHeute", "handHeute"];
        const reihe = rechts.filter((n) => band4.includes(n)).map((n) => gb[P[n]] ? 1 : 0);
        ok("G2: In Band 4 stehen alle gerade Bearbeiteten hinter allen anderen", reihe.every((v, i) => i === 0 || reihe[i - 1] <= v), reihe);
      }

      // Rotprobe: die ALTE Reihung (Zusage ≤ heute = Rang 2 auf Dauer, sonst jüngstes Ereignis)
      // hätte die seit Tagen versuchte Zusage vorn gehalten.
      const vergleich = [P.zusageOffen, P.zusageVersucht, P.alt, P.mittel, P.gestern].map(Number).join(", ");
      const altReihung = await tx.unsafe(`
        SELECT p.id FROM fiaon_persons p WHERE p.id IN (${vergleich})
         ORDER BY CASE WHEN p.promised_payment_date IS NOT NULL AND p.promised_payment_date <= (NOW() AT TIME ZONE 'Europe/Berlin')::date THEN 0 ELSE 1 END,
                  (${EREIGNIS_SQL} AT TIME ZONE 'Europe/Berlin')::date DESC, p.id DESC`);
      const altNamen = namen(altReihung.map((r: any) => Number(r.id)));
      ok("Rotprobe: alte Reihung → versuchte Zusage auf den ersten zwei Plätzen; neue → Platz 7", altNamen.slice(0, 2).includes("zusageVersucht") && rechts.indexOf("zusageVersucht") === 6, { altNamen, rechts });
      {
        // N2 (Fertigstellung 08.10.2026): Die große Pipeline-Liste (/agent/kunden/liste, sort=arbeit)
        // reiht nach derselben Regel — die seither versuchte Zusage verliert Rang 2.
        const { ORDNUNG } = await import("../server/routes/fiaon-agent-start");
        const gl = await tx.unsafe(`SELECT p.id FROM fiaon_persons p WHERE p.id IN (${vergleich}) ORDER BY ${ORDNUNG.arbeit}`);
        const glNamen = namen(gl.map((r: any) => Number(r.id)));
        gleich("N2: Große Liste (sort=arbeit): offene Zusage vorn, die seither versuchte nach Wartezeit eingereiht", glNamen, ["zusageOffen", "alt", "mittel", "zusageVersucht", "gestern"]);
      }

      // ── Rotation: Wer bearbeitet wird, geht ans Ende ─────────────────────
      await ergebnisZeile({ ref: R.alt, agent: al, outcome: "nicht_erreicht", vorStunden: 0 });
      await ergebnisAnwenden({ ref: R.alt, personId: P.alt, ergebnis: "nicht_erreicht" }, tx);
      await ergebnisZeile({ ref: R.zusageOffen, agent: al, outcome: "nicht_erreicht", vorStunden: 0 });
      await ergebnisAnwenden({ ref: R.zusageOffen, personId: P.zusageOffen, ergebnis: "nicht_erreicht" }, tx);
      liste = await ov.arbeitslisteLesen(al, tx);
      rechts = namen(liste.wieder.map((w) => Number(w.kunde.personId)));
      gleich("Nach zwei Ergebnissen rücken die Nächsten nach — die Bearbeiteten sind weg",
        rechts, ["rateFrisch", "stoerung", "mittel", "rueckrufBeantwortet", "zusageVersucht", "gestern"]);
      ok("„heute erledigt“ zählt die zwei Ergebnisse des Tages", liste.heute.erledigt >= 2, liste.heute);
      // Morgen-Simulation: Wiedervorlage abgelaufen, letzter Versuch vor 22/23 Stunden (sicher
      // „gerade bearbeitet“) → hinter allen anderen seines Bandes, nicht vorn.
      await tx`UPDATE fiaon_persons SET follow_up_date = ${tagVor(1)}::date WHERE id = ${P.alt}`;
      await tx`UPDATE fiaon_contact_log SET created_at = NOW() - INTERVAL '23 hours' WHERE ref = ${R.alt} AND created_at > NOW() - INTERVAL '1 minute'`;
      await tx`UPDATE fiaon_persons SET follow_up_date = ${tagVor(1)}::date WHERE id = ${P.zusageOffen}`;
      await tx`UPDATE fiaon_contact_log SET created_at = NOW() - INTERVAL '22 hours' WHERE ref = ${R.zusageOffen} AND created_at > NOW() - INTERVAL '1 minute'`;
      liste = await ov.arbeitslisteLesen(al, tx, { wiederBis: 50 });
      rechts = namen(liste.wieder.map((w) => Number(w.kunde.personId)));
      gleich("Am nächsten Tag: zuerst alle, die nicht gerade bearbeitet wurden", rechts.slice(0, 5), ["rateFrisch", "stoerung", "mittel", "rueckrufBeantwortet", "zusageVersucht"]);
      ok("… der gestern Bearbeitete steht NICHT vorn (Rotation)", rechts.indexOf("alt") >= 5, rechts);
      ok("… und die Zusage, nach der versucht wurde, auch nicht mehr", rechts[0] !== "zusageOffen" && rechts.indexOf("zusageOffen") >= 5, rechts);
      // Die hinteren: Lead (Stufe C) zuletzt, Lücke davor.
      for (const n of ["rateFrisch", "frischHeute", "frischGestern", "stoerung", "mittel", "zusageVersucht", "rueckrufBeantwortet", "gestern", "handHeute"]) {
        await tx`UPDATE fiaon_persons SET follow_up_date = ${plusKalendertage(heute, 9)}::date WHERE id = ${P[n]}`;
      }
      liste = await ov.arbeitslisteLesen(al, tx);
      rechts = namen(liste.wieder.map((w) => Number(w.kunde.personId)));
      gleich("Ohne die Vorderen: alt, zusageOffen (gestern versucht), dann Stufe C — die frühere Lücke vor dem Lead", rechts, ["alt", "zusageOffen", "luecke", "lead"]);

      // ═══════════════════════════════════════════════════════════════════
      abschnitt("3d. Akte (kundenSituation) und „pausiert“");
      // ═══════════════════════════════════════════════════════════════════
      const sit = await ov.kundenSituation(P.pausiert, tx);
      gleich("Akte: pausiert, Datum, Grund", [sit?.wiedervorlage?.pausiert, sit?.wiedervorlage?.am, sit?.wiedervorlage?.grund], [true, plusKalendertage(heute, 12), "pausiert"]);
      ok("Akte: Text „Wieder dran am …“", /^Wieder dran am .* · Pause nach vielen Fehlversuchen$/.test(String(sit?.wiedervorlage?.text)), sit?.wiedervorlage?.text);
      ok("Akte: Lage bleibt erhalten (Situation lädt mit den neuen Feldern)", !!sit?.art, sit?.art);
      const sitZ = await ov.kundenSituation(P.zusageVersucht, tx);
      gleich("Akte: die gebrochene Zusage bleibt als Lage stehen (nur die Reihung lässt sie los)", sitZ?.art, "zusage_gebrochen");
      const sitF = await ov.kundenSituation(P.frischHeute, tx);
      gleich("Akte: Frische wird erkannt (für die Vorschau)", [sitF?.wiedervorlage?.frisch, sitF?.wiedervorlage?.versuche], [true, 1]);

      // ── G4: Stufe A mit alter Zusage ─────────────────────────────────────
      const aa = await agent("StufeA");
      const pA = await person({ agent: aa, tier: 1, reason: "zahlung_angekuendigt", wv: tagVor(1), zusage: tagVor(5) });
      const refA = await antrag({ person: pA, vorStunden: 24 * 20, zahlung: "claimed_paid", gemeldetVorStunden: 24 * 7 });
      await ergebnisZeile({ ref: refA, agent: aa, outcome: "erreicht_zahlt_am", vorStunden: 24 * 6 });
      const pB = await person({ agent: aa, tier: 2, wv: tagVor(1), zusage: tagVor(5) });
      const refB = await antrag({ person: pB, vorStunden: 24 * 20 });
      await ergebnisZeile({ ref: refB, agent: aa, outcome: "erreicht_zahlt_am", vorStunden: 24 * 6 });
      const sitA = await ov.kundenSituation(pA, tx);
      gleich("G4: Stufe A mit abgelaufener Zusage → „Zahlung gemeldet“ (Eingang prüfen), nicht „Zusage nicht gehalten“", [sitA?.art, sitA?.zusageAm], ["zahlung_gemeldet", tagVor(5)]);
      const sitB = await ov.kundenSituation(pB, tx);
      gleich("G4 Rotprobe: dieselbe Lage auf Stufe B bleibt „Zusage nicht gehalten“", sitB?.art, "zusage_gebrochen");
      const listeA = await ov.arbeitslisteLesen(aa, tx);
      const kA = listeA.wieder.find((w) => Number(w.kunde.personId) === pA)?.kunde;
      const kB = listeA.wieder.find((w) => Number(w.kunde.personId) === pB)?.kunde;
      gleich("G4: Karte Stufe A „Zahlung prüfen“, Stufe B „Zusage prüfen“", [kA?.wiederText, kB?.wiederText], ["Zahlung prüfen", "Zusage prüfen"]);

      // ═══════════════════════════════════════════════════════════════════
      abschnitt("3e. G5 — Tagesbericht-Nachtrag: Kontakt für die Pipeline, kein System-Ergebnis");
      // ═══════════════════════════════════════════════════════════════════
      {
        const at = await agent("Bericht");
        const pN = await person({ agent: at, tier: 2 }); await antrag({ person: pN, vorStunden: 24 * 40 });
        const pE = await person({ agent: at, tier: 2 }); await antrag({ person: pE, vorStunden: 24 * 40 });
        const pZ = await person({ agent: at, tier: 2 }); await antrag({ person: pZ, vorStunden: 24 * 40 });
        const zusageTag = plusKalendertage(heute, 4);
        const erg = await nachtraegeBuchen({ id: at, name: `Bericht ${MARKE}` }, vorWT,
          [{ personId: pN, ergebnis: "nicht_erreicht" }, { personId: pE, ergebnis: "erreicht_sonstiges" }],
          [{ personId: pZ, datum: zusageTag }], tx);
        gleich("Nachträge gebucht: 2 Ergebnisse, 1 Zusage", [erg.gebucht, erg.zusagen], [2, 1]);
        const [zl] = await tx`
          SELECT COUNT(*) FILTER (WHERE type = 'result')::int AS ergebnisse,
                 COUNT(*) FILTER (WHERE type = 'system' AND note LIKE ${`${reihung.TAGESBERICHT_NACHTRAG_MARKE}%`})::int AS nachtraege,
                 COUNT(*) FILTER (WHERE type = 'system' AND note LIKE ${`${reihung.TAGESBERICHT_NACHTRAG_MARKE}%`} AND outcome IS NOT NULL)::int AS mit_outcome,
                 BOOL_AND(created_at = ((${vorWT}::date + TIME '12:00') AT TIME ZONE 'Europe/Berlin'))
                   FILTER (WHERE type = 'system' AND note LIKE ${`${reihung.TAGESBERICHT_NACHTRAG_MARKE}%`}) AS mittag
            FROM fiaon_contact_log WHERE person_id IN (${pN}, ${pE}, ${pZ})`;
        gleich("G5: Systemzeilen mit Marke, OHNE outcome, KEIN type 'result' (E-216: nie addiert), Zeitpunkt Mittag des Berichtstags",
          [zl.ergebnisse, zl.nachtraege, zl.mit_outcome, zl.mittag], [0, 3, 0, true]);
        const lb = await ov.arbeitslisteLesen(at, tx);
        gleich("G5: „heute erledigt“ des Mitarbeiters bleibt 0 (Selbstangabe zählt nicht als System-Ergebnis)", lb.heute.erledigt, 0);
        gleich("G5: Die Regel rechnet ab dem Berichtstag: nicht erreicht → +2 Werktage ab dem vorigen Werktag", [(await zustand(pN)).wv, (await zustand(pN)).zaehler], [plusWerktage(vorWT, 2), 1]);
        ok("G5 Rotprobe: ab heute gerechnet wäre es ein anderer Tag", plusWerktage(vorWT, 2) !== plusWerktage(heute, 2));
        gleich("G5: erreicht über das eigene Telefon → Zähler 0, +3 Werktage ab dem Berichtstag", [(await zustand(pE)).zaehler, (await zustand(pE)).wv], [0, plusWerktage(vorWT, 3)]);
        gleich("G5: Zusage aus dem Bericht → Zusage + Werktag danach", [(await zustand(pZ)).zusage, (await zustand(pZ)).wv], [zusageTag, plusWerktage(zusageTag, 1)]);
        const [lv] = await tx.unsafe(`SELECT (${reihung.LETZTER_VERSUCH_SQL}) = ((($2)::date + TIME '12:00') AT TIME ZONE 'Europe/Berlin') AS gleich,
                                               ${reihung.geradeBearbeitetSql()} AS gb FROM fiaon_persons p WHERE p.id = $1`, [pE, vorWT]);
        gleich("G5: Die Rotation sieht den Nachtrag als letzten Versuch (Berichtstag 12 Uhr) — gerade bearbeitet", [lv?.gleich, lv?.gb], [true, true]);
        // „Nie angerufen“? Nein — erreicht übers eigene Telefon ist ein Kontakt.
        await tx`UPDATE fiaon_persons SET follow_up_date = ${heute}::date WHERE id = ${pE}`;
        const lb2 = await ov.arbeitslisteLesen(at, tx);
        ok("G5: Der übers eigene Telefon Erreichte steht NICHT links unter „Neu für dich“ (vorher: „nie angerufen“), sondern rechts",
          !lb2.slots.some((w) => Number(w.kunde.personId) === pE) && lb2.wieder.some((w) => Number(w.kunde.personId) === pE),
          { links: lb2.slots.map((w) => w.kunde.personId), rechts: lb2.wieder.map((w) => w.kunde.personId) });
        const [nieAlt] = await tx`SELECT NOT EXISTS (SELECT 1 FROM fiaon_contact_log WHERE person_id = ${pE} AND type = 'result' AND voided_at IS NULL) AS nie`;
        ok("G5 Rotprobe: nach dem alten „nie angerufen“ (nur type 'result') galt er als nie angerufen", nieAlt.nie === true);
      }

      throw new Zurueckrollen();
    });
  } catch (e) {
    if (!(e instanceof Zurueckrollen)) { rot++; fehler.push(`Abbruch: ${(e as Error)?.message}`); console.log("  FAIL  Abbruch", e); }
  }
  // Nachweis: nichts blieb stehen.
  const [rest] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_persons WHERE person_ref LIKE ${`${MARKE}%`}`) as any[];
  gleich("Zurückgerollt — keine Prüfperson bleibt stehen", Number(rest.n), 0);
  await sqlPool.end({ timeout: 5 });
}

console.log(`\n${rot === 0 ? "GRÜN" : "ROT"}: ${gruen} bestanden, ${rot} fehlgeschlagen${FREMD.length ? ` · Netzversuche: ${FREMD.join(", ")}` : ""}`);
if (rot) { console.log(fehler.map((f) => `  · ${f}`).join("\n")); process.exit(1); }
process.exit(0);
