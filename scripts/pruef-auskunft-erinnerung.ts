// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: DIE ZAHLUNGSERINNERUNG AN OFFENE BONITÄTSAUSKÜNFTE (26.09.2026, E-244)
//
// Justin: „Jeder, der die SCHUFA offen hat, braucht eine E-Mail mit Zahlungserinnerung."
// Regeln: server/lib/fiaon-auskunft-erinnerung.ts · Text: server/mail/vorlagen/auskunft-erinnerung.ts
//
//   1. Rein: Stufen Tag 1/4/10/18/Dauer, Nachholen (genau eine Mail in der Stufe des Alters),
//      Mindestabstand, Dauer 0 = Schluss, nächste Fälligkeit, Zeitumstellung, Einstellungen.
//   2. Rein: die Tür — „Zahlung gemeldet" nie, Werbesperre lässt durch, unzustellbar/Mahnstopp/Test/
//      archiviert nie, gekündigt/Dokument/Vertriebssperre mit Grund und Storno-Vorschlag.
//   3. Rein: die Mail — je Stufe ehrlicher Betreff, beide Sätze aus dem Auftrag, Knopf auf
//      /zahlung/<Verwendungszweck>, QR, AT/CH nie „SCHUFA", Belehrung nur mit mit_belehrung,
//      kein Karten-Block, Wortwand, Absender Accounting.
//   4. Quelltext: Paket-Mahnmaschine (payment_reminder, Einzel- und Sammelversand) nimmt keine Auskunft;
//      Tür/Motor/Register/Frequenz kennen das Ereignis; Lauf in routes.ts angemeldet.
//   5. Lokale Test-DB: der echte Lauf mit Brevo-Attrappe — wer bekommt was, Marken, Protokoll,
//      Verlauf, Belehrung nur beim ersten Mal, Nachholen, Aufgabe ab Tag 30 (einmal), Idempotenz
//      (zweiter Lauf, zwei Läufe gleichzeitig), Fehlschlag nimmt die Marke zurück, Tagesdeckel,
//      Schalter aus, Sendefenster.
//   6. Verkaufstakt: offene Bestellung JEDEN Alters und stornierte sperren das Angebot; ersetzte nicht.
//   7. Chefseite: GET /chef/auskunft (Karte + Tabelle ohne Archivierte/Tests), Einstellung mit Protokoll
//      und Erlaubnisliste, Stornieren (nur offen), Mahnstopp.
//   8. Gesamtdurchsicht 26.09.2026: Fassung „Frage" für Bestellungen ohne Erklärung des Kunden (Takt 1/4/10/18
//      + höchstens zwei Dauer-Nachfragen, Kauflink statt Zahlungsdaten, Werbesperre, Kauflink zeigt eine andere
//      Bestellung), Tür-Grund „bezahlt", 24-Stunden-Grenze, Aufgabe erst 7 Tage nach der letzten Mail,
//      auskunftWiderrufStand (nur echte Wahl-Sätze, Einstufung jüngste/Beginn erste, nachgeholte Belehrung + 1 Tag).
//   9. Gegenprüfung 26.09.2026 (in Teil 3 und 8): Vertragsbestätigung mit Belehrung SOFORT nach der Bestätigung über Kauflink
//      oder Bestellseite (einmal), Betreuer-Bestellung ohne Zahlungsdaten mit sofortiger Frage „frisch" (Firma und Kunde
//      selbst unverändert), Werbesperre der Frage auch an Kopf-Person und Adresse, zurückgehaltene Frage → Aufgabe ab Tag 30.
//
// NUR gegen die lokale Test-DB; Brevo ist eine Attrappe (fetch abgefangen), kein Netz, kein Make.
//   env -i PATH="$PATH" HOME="$HOME" DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand?sslmode=require' \
//     SESSION_SECRET=pruefstand-nur-lokal DOTENV_CONFIG_PATH=/dev/null npx tsx scripts/pruef-auskunft-erinnerung.ts
//   … --ohne-datenbank   nur die Teile 1–4
// ═══════════════════════════════════════════════════════════════════════════
const OHNE_DB = process.argv.includes("--ohne-datenbank");
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "WHATSAPP_TOKEN", "WHATSAPP_WABA_ID", "WHATSAPP_PHONE_ID", "META_SYSTEM_TOKEN",
  "OPENAI_API_KEY", "AUSKUNFT_API_URL", "AUSKUNFT_API_KEY", "GMAIL_CLIENT_SECRET", "RESEND_API_KEY"]) {
  if (process.env[k]) { console.error(`${k} ist gesetzt — Abbruch, der Prüfstand darf nichts versenden.`); process.exit(3); }
}
process.env.CRONS = "aus";
if (OHNE_DB) process.env.DATABASE_URL = "postgresql://keine-datenbank.invalid/pruefstand";
else if (!/127\.0\.0\.1:54329\/fiaon_pruefstand/.test(String(process.env.DATABASE_URL))) { console.error("NUR gegen die lokale Test-DB!"); process.exit(3); }
process.env.SESSION_SECRET ||= "pruefstand-nur-lokal";

// ── Brevo-Attrappe VOR jedem Import ──
process.env.BREVO_API_KEY = "pruef-lokal-kein-schluessel";
process.env.MAKE_WEBHOOK_URL = "";
type BrevoMail = { an: string; betreff: string; html: string; text: string; tags: string[]; absender: string };
const BREVO: BrevoMail[] = [];
const FREMD: string[] = [];
/** Adressen, bei denen „Brevo" mit 500 antwortet — der Fehlschlag-Fall. */
const BREVO_FEHLER = new Set<string>();
const echtFetch = globalThis.fetch;
globalThis.fetch = (async (eingabe: any, init?: any) => {
  const u = String(typeof eingabe === "string" ? eingabe : eingabe instanceof URL ? eingabe.href : eingabe?.url ?? eingabe);
  if (/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(u)) return echtFetch(eingabe, init);
  if (u.startsWith("https://api.brevo.com/")) {
    const b = JSON.parse(String(init?.body ?? "{}"));
    const an = String(b.to?.[0]?.email ?? "").toLowerCase();
    if (BREVO_FEHLER.has(an)) return new Response(JSON.stringify({ message: "Prüfstand: Brevo streikt" }), { status: 500 });
    BREVO.push({ an, betreff: String(b.subject ?? ""), html: String(b.htmlContent ?? ""), text: String(b.textContent ?? ""), tags: b.tags ?? [], absender: `${String(b.sender?.name ?? "")} <${String(b.sender?.email ?? "")}>` });
    return new Response(JSON.stringify({ messageId: `<e244-${BREVO.length}@lokal>` }), { status: 201, headers: { "Content-Type": "application/json" } });
  }
  FREMD.push(u);
  throw new Error(`Prüfstand: kein Netz (${u})`);
}) as typeof fetch;

import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import type { AddressInfo } from "node:net";

let gruen = 0, rot = 0;
const fehler: string[] = [];
function ok(name: string, b: boolean, detail: unknown = ""): void {
  if (b) { gruen++; console.log(`  PASS  ${name}`); }
  else { rot++; fehler.push(name); console.log(`  FAIL  ${name}  → ${typeof detail === "string" ? detail : JSON.stringify(detail)?.slice(0, 700)}`); }
}
const abschnitt = (t: string) => console.log(`\n── ${t}`);
const lies = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const warte = (ms: number) => new Promise((r) => setTimeout(r, ms));

const er = await import("../server/lib/fiaon-auskunft-erinnerung");
const vorlage = await import("../server/mail/vorlagen/auskunft-erinnerung");
const motor = await import("../server/mail/motor");
const { KARTE_SATZ } = await import("../server/mail/geruest");
const { berlinDatum, berlinZeitpunkt } = await import("../server/lib/fiaon-time");
const { istSendezeit } = await import("../server/lib/fiaon-auskunft-verkauf");

/** YYYY-MM-DD plus n Tage (Kalender, ohne Zeitzone). */
const plusTage = (iso: string, n: number) => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const um = (iso: string, hhmm: string) => { const [h, mi] = hhmm.split(":").map(Number); return berlinZeitpunkt(iso, h * 60 + mi); };

// ═══ 1. Rein: Stufen ════════════════════════════════════════════════════════
abschnitt("1. Stufen, Nachholen, Mindestabstand (rein)");
{
  const T0 = "2026-10-05"; // Montag
  const bestellt = um(T0, "15:00");
  const tag = (n: number, hhmm = "12:00") => um(plusTage(T0, n), hhmm);
  const f = (stufe: number, letzte: Date | null, n: number, dauer = 7) => er.faelligeStufe({ bestelltAm: bestellt, stufe, letzteAm: letzte }, tag(n), dauer);
  ok("Tag 0 (Bestelltag): nichts — die Zahlungsdaten gingen eben raus", f(0, null, 0) === null);
  // Gesamtdurchsicht 26.09.2026 (bewusste Änderung): Bestellung 15:00 → Tag 1 erst ab 15:00 (24 Stunden).
  ok("Tag 1: Stufe 1 — ab 24 Stunden (12:00 noch nicht, 15:00 ja)", f(0, null, 1) === null && er.faelligeStufe({ bestelltAm: bestellt, stufe: 0, letzteAm: null }, tag(1, "15:00"), 7) === 1);
  // Gesamtdurchsicht 26.09.2026 (bewusste Änderung): Tag 1 zählt weiter am Berliner Kalender, aber keine Mail vor 24 Stunden.
  ok("Bestellung 23:50, Tag 1 00:05: noch nichts (24-Stunden-Grenze), Tag 1 23:50: Stufe 1",
    er.faelligeStufe({ bestelltAm: um(T0, "23:50"), stufe: 0, letzteAm: null }, um(plusTage(T0, 1), "00:05"), 7) === null
    && er.faelligeStufe({ bestelltAm: um(T0, "23:50"), stufe: 0, letzteAm: null }, um(plusTage(T0, 1), "23:50"), 7) === 1);
  ok("Bestellung 18:00, Tag 1 12:00: noch nichts; 18:00: Stufe 1",
    er.faelligeStufe({ bestelltAm: um(T0, "18:00"), stufe: 0, letzteAm: null }, um(plusTage(T0, 1), "12:00"), 7) === null
    && er.faelligeStufe({ bestelltAm: um(T0, "18:00"), stufe: 0, letzteAm: null }, um(plusTage(T0, 1), "18:00"), 7) === 1);
  ok("nächste Fälligkeit einer Bestellung um 21:00: nicht Tag 1 (Fenster endet 20:30, 24 Stunden erst danach), sondern Tag 2",
    er.naechsteFaelligkeit({ bestelltAm: um(T0, "21:00"), stufe: 0, letzteAm: null }, um(T0, "21:05"), 7) === plusTage(T0, 2));
  ok("Bestellung 23:50 → Tag 1 gilt noch (23:50 liegt nach 24 Stunden, aber außerhalb des Fensters) — nächste = Tag 2",
    er.naechsteFaelligkeit({ bestelltAm: um(T0, "23:50"), stufe: 0, letzteAm: null }, um(T0, "23:55"), 7) === plusTage(T0, 2));
  ok("Tag 3 nach Stufe 1 an Tag 1: nichts", f(1, tag(1), 3) === null);
  ok("Tag 4: Stufe 2", f(1, tag(1), 4) === 2);
  ok("Tag 10: Stufe 3", f(2, tag(4), 10) === 3);
  ok("Tag 18: Stufe 4", f(3, tag(10), 18) === 4);
  ok("Tag 24: noch nichts (Dauer 7)", f(4, tag(18), 24) === null);
  ok("Tag 25: Dauerstufe 5", f(4, tag(18), 25) === 5);
  ok("Tag 32: Dauerstufe 6", f(5, tag(25), 32) === 6);
  ok("Mindestabstand: Stufe 1 verspätet an Tag 3 → Tag 4 nichts, Tag 5 Stufe 2", f(1, tag(3), 4) === null && f(1, tag(3), 5) === 2);
  ok("Nachholen: nie erinnert, Tag 45 → GENAU EINE Mail, Dauerstufe 7 (4 + ⌊27/7⌋)", f(0, null, 45) === 7);
  ok("Nachholen: Tag 12 → Stufe 3 (Stufen 1 und 2 übersprungen)", f(0, null, 12) === 3);
  ok("nach dem Nachholen an Tag 45: Tag 46 nichts (Stufe 8 wäre fällig, aber Mindestabstand)", f(7, tag(45), 46) === null);
  ok("nach dem Nachholen an Tag 45: Tag 51 nichts, Tag 52 Stufe 8 (Dauer-Abstand zur letzten Mail)", f(7, tag(45), 51) === null && f(7, tag(45), 52) === 8);
  ok("Nachholen an Tag 17 (Stufe 3) → Tag 18 nichts, Tag 19 Stufe 4", f(3, tag(17), 18) === null && f(3, tag(17), 19) === 4);
  ok("Dauer 0: nach Stufe 4 Schluss (auch Tag 90)", f(4, tag(18), 90, 0) === null && er.stufeFuerAlter(90, 0) === 4);
  ok("Dauer 0: Nachholen an Tag 45 → Stufe 4", f(0, null, 45, 0) === 4);
  ok("Dauer 14: Tag 32 = Stufe 5, Tag 46 = Stufe 6", er.stufeFuerAlter(32, 14) === 5 && er.stufeFuerAlter(46, 14) === 6);
  const a = f(2, tag(4), 10), b = f(2, tag(4), 10);
  ok("idempotent: dieselbe Eingabe, dieselbe Antwort — und die gesetzte Marke liefert die Stufe nie wieder", a === 3 && b === 3 && f(3, tag(10), 10) === null && f(3, tag(10), 11) === null);
  // Zeitumstellung 25.10.2026 (Sommer → Winter): Tage zählen am Kalender, nicht in 24-Stunden-Blöcken.
  const vorUmstellung = um("2026-10-24", "23:30");
  ok("Zeitumstellung: 24.10. 23:30 → 25.10. 00:30 ist Tag 1, → 28.10. ist Tag 4",
    er.berlinTageSeit(vorUmstellung, um("2026-10-25", "00:30")) === 1 && er.berlinTageSeit(vorUmstellung, um("2026-10-28", "08:00")) === 4);
  ok("nächste Fälligkeit: Stufe 1 an Tag 1 verschickt → Tag 4", er.naechsteFaelligkeit({ bestelltAm: bestellt, stufe: 1, letzteAm: tag(1) }, tag(1), 7) === plusTage(T0, 4));
  ok("nächste Fälligkeit: heute fällig → heute", er.naechsteFaelligkeit({ bestelltAm: bestellt, stufe: 0, letzteAm: null }, tag(2), 7) === plusTage(T0, 2));
  ok("nächste Fälligkeit: Dauer 0 nach Stufe 4 → keine", er.naechsteFaelligkeit({ bestelltAm: bestellt, stufe: 4, letzteAm: tag(18) }, tag(20), 0) === null);
  ok("Stufentexte", er.stufeText(1) === "1. Erinnerung (Tag 1)" && er.stufeText(4) === "4. Erinnerung (Tag 18)" && er.stufeText(6) === "Dauererinnerung 2" && er.stufeText(0) === "noch keine");
  // ── Gesamtdurchsicht 26.09.2026: der Takt der Frage ──
  const q = (stufe: number, letzte: Date | null, n: number, dauer = 7) => er.faelligeStufe({ bestelltAm: bestellt, stufe, letzteAm: letzte }, tag(n), dauer, "frage");
  ok("Frage: Tag 1/4/10/18 wie die Erinnerung", er.faelligeStufe({ bestelltAm: bestellt, stufe: 0, letzteAm: null }, tag(1, "15:00"), 7, "frage") === 1 && q(1, tag(1), 4) === 2 && q(2, tag(4), 10) === 3 && q(3, tag(10), 18) === 4);
  ok("Frage: nach Tag 18 zwei Dauer-Nachfragen (Tag 25, Tag 32), dann Schluss (Tag 39, Tag 90)",
    q(4, tag(18), 25) === 5 && q(5, tag(25), 32) === 6 && q(6, tag(32), 39) === null && q(6, tag(32), 90) === null);
  ok("Frage: Nachholen an Tag 45 → Stufe 5 (erste Dauer-Nachfrage, nicht die Stufe des Alters), 7 Tage später Stufe 6, dann nie mehr",
    q(0, null, 45) === 5 && q(5, tag(45), 51) === null && q(5, tag(45), 52) === 6 && q(6, tag(52), 59) === null && q(6, tag(52), 200) === null);
  ok("Frage: Dauer 0 → nach Stufe 4 Schluss, Nachholen an Tag 45 → Stufe 4", q(4, tag(18), 60, 0) === null && q(0, null, 45, 0) === 4);
  ok("Frage: nächste Fälligkeit nach der zweiten Dauer-Nachfrage → keine",
    er.naechsteFaelligkeit({ bestelltAm: bestellt, stufe: 6, letzteAm: tag(52) }, tag(53), 7, 120, "frage") === null
    && er.naechsteFaelligkeit({ bestelltAm: bestellt, stufe: 5, letzteAm: tag(45) }, tag(46), 7, 120, "frage") === plusTage(T0, 52));
  ok("Frage: Stufentexte", er.stufeText(2, "frage") === "2. Nachfrage (Tag 4)" && er.stufeText(6, "frage") === "Dauer-Nachfrage 2 von 2");
  ok("Frage aus einer früheren Erinnerung mit Dauerstufe 8: keine weitere Frage", q(8, tag(40), 60) === null);
  const std = er.erinnerungEinstellungenLesen({});
  ok("Einstellungen: Standard AN, 50 am Tag, Dauer 7", std.an === true && std.proTag === 50 && std.dauerTage === 7, std);
  const aus = er.erinnerungEinstellungenLesen({ auskunft_erinnerung_an: "0", auskunft_erinnerung_pro_tag: "9999", auskunft_erinnerung_dauer_tage: "0" });
  ok("Einstellungen: „0“ schaltet aus, Deckel auf 200 begrenzt, Dauer 0 bleibt 0", aus.an === false && aus.proTag === 200 && aus.dauerTage === 0, aus);
  ok("Einstellungen: Unsinn = Standard", er.erinnerungEinstellungenLesen({ auskunft_erinnerung_an: "ja", auskunft_erinnerung_pro_tag: "-3" }).an === true
    && er.erinnerungEinstellungenLesen({ auskunft_erinnerung_pro_tag: "-3" }).proTag === 50);
  ok("Sendefenster Mo–So 07:00–20:30", !istSendezeit(um("2026-10-11", "06:59")) && istSendezeit(um("2026-10-11", "07:00")) && istSendezeit(um("2026-10-11", "20:30")) && !istSendezeit(um("2026-10-11", "20:31")));
}

// ═══ 2. Rein: die Tür ══════════════════════════════════════════════════════
abschnitt("2. Die Tür (rein)");
{
  const basis: import("../server/lib/fiaon-auskunft-erinnerung").TuerZeile = {
    status: "pending_payment", archiviert: false, test: false, paymentReference: "FIAON-SCHUFA-X", mail: "kunde@beispiel.de",
    mahnstopp: false, unzustellbar: false, gekuendigt: false, dokument: false, vertriebssperre: false, werbesperre: false,
  };
  const u = (z: Partial<typeof basis>) => er.tuerUrteil({ ...basis, ...z });
  ok("offen: erinnern", u({}).erinnern && u({}).grund === null);
  ok("Zahlung gemeldet: NIE — sichtbar mit Grund", !u({ status: "claimed_paid" }).erinnern && u({ status: "claimed_paid" }).grund === "gemeldet" && u({ status: "claimed_paid" }).zeigen);
  ok("Zahlung gemeldet mit Werbesperre, gekündigt …: trotzdem nie", !u({ status: "claimed_paid", werbesperre: true, gekuendigt: true }).erinnern);
  ok("Werbesperre: erinnern (Zahlungspost)", u({ werbesperre: true }).erinnern);
  ok("Mahnstopp: nie", !u({ mahnstopp: true }).erinnern && u({ mahnstopp: true }).grund === "mahnstopp");
  ok("hart unzustellbar: nie", !u({ unzustellbar: true }).erinnern && u({ unzustellbar: true }).grund === "unzustellbar");
  ok("Test: nie und nicht in der Tabelle", !u({ test: true }).erinnern && !u({ test: true }).zeigen);
  ok("Testadresse (.test / @example.): nie", !u({ mail: "a@b.test" }).erinnern && !u({ mail: "x@example.com" }).erinnern);
  ok("archiviert: nie und nicht in der Tabelle", !u({ archiviert: true }).erinnern && !u({ archiviert: true }).zeigen);
  ok("ohne Verwendungszweck / ohne Mail: nie, mit Grund", u({ paymentReference: null }).grund === "ohne_zweck" && u({ mail: null }).grund === "ohne_mail");
  for (const [feld, grund] of [["gekuendigt", "gekuendigt"], ["dokument", "dokument"], ["vertriebssperre", "vertriebssperre"]] as const) {
    const x = u({ [feld]: true } as any);
    ok(`${feld}: keine Mail, Grund „${er.TUER_GRUND_TEXT[grund]}“, Vorschlag stornieren`, !x.erinnern && x.grund === grund && x.stornieren && x.zeigen);
  }
  ok("andere Status (ersetzt, storniert): nie, nicht in der Tabelle", !u({ status: "superseded" }).erinnern && !u({ status: "cancelled" }).zeigen);
  // Gegenprüfung 26.09.2026 (MRRXTXV6): Mahnstopp an einer anderen Bestellung derselben Person zählt.
  const mp = u({ mahnstoppPerson: true });
  ok("Mahnstopp an anderer Bestellung der Person: nie, eigener Grund, kein Storno-Vorschlag", !mp.erinnern && mp.grund === "mahnstopp_person" && mp.zeigen && !mp.stornieren, mp);
  ok("Mahnstopp an anderer Bestellung schlägt die Werbesperre; mit Vertriebssperre bleibt „stornieren?“ sichtbar (keine Mail)",
    !u({ mahnstoppPerson: true, werbesperre: true }).erinnern && !u({ mahnstoppPerson: true, vertriebssperre: true }).erinnern
    && u({ mahnstoppPerson: true, vertriebssperre: true }).grund === "vertriebssperre" && u({ mahnstoppPerson: true, vertriebssperre: true }).stornieren);
  // Gegenprüfung 26.09.2026: die Aufgabe ab Tag 30 — mit Storno-Vorschlag kein Anruf, nur an den Betreiber.
  const imTakt = er.aufgabeKopf({ name: "Max", betreuerId: 7 }, u({}));
  ok("Aufgabe im Takt: „anrufen oder stornieren“ an den Betreuer", imTakt.mitAnruf && !imTakt.anBetreiber && imTakt.agentId === 7 && /anrufen oder stornieren/.test(imTakt.titel), imTakt);
  ok("Aufgabe im Takt ohne Betreuer: an den Betreiber", er.aufgabeKopf({ name: "Max", betreuerId: null }, u({})).anBetreiber);
  // ── Gesamtdurchsicht 26.09.2026: Fassung, „bezahlt", Werbesperre bei der Frage, Aufgabe erst nach der Mail ──
  ok("ohne Angabe „erklaert“ (alte Form): Erinnerung", u({}).fassung === "erinnerung" && er.fassungFuer({}) === "erinnerung");
  const fr = u({ erklaert: false });
  ok("ohne Erklärung des Kunden: Fassung „Frage“, im Takt, kein Grund", fr.erinnern && fr.fassung === "frage" && fr.grund === null, fr);
  ok("mit Erklärung: Fassung „Erinnerung“", u({ erklaert: true }).fassung === "erinnerung" && u({ erklaert: true }).erinnern);
  const fw = u({ erklaert: false, werbesperre: true });
  ok("Frage + Werbesperre: keine Mail, Grund „werbesperre_frage“, Vorschlag stornieren", !fw.erinnern && fw.grund === "werbesperre_frage" && fw.stornieren && fw.zeigen, fw);
  ok("Erinnerung + Werbesperre: weiter erinnern (Zahlungspost)", u({ erklaert: true, werbesperre: true }).erinnern);
  const bz = u({ bezahltPerson: true });
  ok("schon eine bezahlte Auskunft an der Person: keine Mail, Grund „bezahlt“, stornieren?", !bz.erinnern && bz.grund === "bezahlt" && bz.stornieren && /bezahlte/.test(er.TUER_GRUND_TEXT.bezahlt), bz);
  ok("„bezahlt“ auch bei der Frage und vor gekündigt", u({ bezahltPerson: true, erklaert: false }).grund === "bezahlt" && u({ bezahltPerson: true, gekuendigt: true }).grund === "bezahlt");
  ok("Zahlung gemeldet bleibt vorn (auch mit bezahlt/ohne Erklärung)", u({ status: "claimed_paid", bezahltPerson: true, erklaert: false }).grund === "gemeldet");
  const kb = er.aufgabeKopf({ name: "Max", betreuerId: 7 }, bz);
  ok("Aufgabe „bezahlt“: „stornieren?“ an den Betreiber, ohne Anruf", !kb.mitAnruf && kb.anBetreiber && /stornieren\?/.test(kb.titel) && /bezahlte Auskunft/.test(kb.titel), kb);
  const kf = er.aufgabeKopf({ name: "Max", betreuerId: 7 }, fr);
  ok("Aufgabe Frage: „ohne Bestätigung des Kunden — anrufen oder stornieren“ an den Betreuer", kf.mitAnruf && kf.agentId === 7 && /ohne Bestätigung des Kunden — anrufen oder stornieren/.test(kf.titel), kf);
  const kfw = er.aufgabeKopf({ name: "Max", betreuerId: 7 }, fw);
  ok("Aufgabe Frage + Werbesperre: „stornieren?“, kein Anruf", !kfw.mitAnruf && kfw.anBetreiber && /stornieren\?/.test(kfw.titel), kfw);
  // aufgabeFaellig — rein
  const H = um("2026-11-20", "12:00");
  const vor = (n: number) => new Date(H.getTime() - n * 86_400_000);
  const af = (o: { tage: number; stufe?: number; letzte?: number | null; aufgabe?: boolean }, urteil = u({}), dauer = 7) =>
    er.aufgabeFaellig({ aufgabeAm: o.aufgabe ? vor(1) : null, angelegt: vor(o.tage), stufe: o.stufe ?? 0, letzteAm: o.letzte == null ? null : vor(o.letzte) }, urteil, H, dauer);
  ok("Aufgabe im Takt: Tag 45 ohne jede Mail → nein (erst Mail, dann 7 Tage)", af({ tage: 45 }) === false);
  ok("Aufgabe im Takt: Mail vor 3 Tagen → nein; vor 7 Tagen → ja", af({ tage: 45, stufe: 7, letzte: 3 }) === false && af({ tage: 45, stufe: 7, letzte: 7 }) === true);
  ok("Aufgabe im Takt: unter Tag 30 nie (auch 10 Tage nach der Mail)", af({ tage: 29, stufe: 4, letzte: 10 }) === false);
  ok("Aufgabe „stornieren?“: ab Tag 30 auch ohne Mail", af({ tage: 30 }, u({ gekuendigt: true })) === true && af({ tage: 29 }, u({ gekuendigt: true })) === false);
  ok("Aufgabe: schon angelegt → nie wieder", af({ tage: 60, stufe: 7, letzte: 20, aufgabe: true }) === false);
  ok("Aufgabe Frage: nach der ersten Dauer-Nachfrage (7 Tage) nein — die zweite kommt noch", af({ tage: 52, stufe: 5, letzte: 7 }, fr) === false);
  ok("Aufgabe Frage: nach der zweiten Dauer-Nachfrage (7 Tage) ja — Schluss + einmal Aufgabe", af({ tage: 59, stufe: 6, letzte: 7 }, fr) === true);
  ok("Aufgabe: Mahnstopp/gemeldet nie", af({ tage: 60, stufe: 7, letzte: 20 }, u({ mahnstopp: true })) === false && af({ tage: 60, stufe: 7, letzte: 20 }, u({ status: "claimed_paid" })) === false);
  for (const [feld, wort] of [["vertriebssperre", "Vertriebssperre"], ["gekuendigt", "gekündigt"], ["dokument", "Dokument"]] as const) {
    const k = er.aufgabeKopf({ name: "Max", betreuerId: 7 }, u({ [feld]: true } as any));
    ok(`Aufgabe bei ${feld}: „stornieren?“, KEIN Anruf, an den Betreiber (nicht an den Betreuer)`, !k.mitAnruf && k.anBetreiber && k.agentId === null
      && /stornieren\?/.test(k.titel) && !/anrufen/.test(k.titel) && k.titel.includes(wort), k);
  }
}

// ═══ 3. Rein: die Mail ═════════════════════════════════════════════════════
abschnitt("3. Die Mail (Motor, rein)");
const WORTWAND: [RegExp, string][] = [
  [/garant/i, "Garantie"], [/zusag|versprech/i, "Zusage"], [/perfekt/i, "perfekt"], [/ein für alle mal/i, "ein für alle Mal"],
  [/score/i, "Score"], [/\blimit/i, "Limit"], [/letzte (frist|mahnung|erinnerung|chance)/i, "letzte Frist"], [/gebühr/i, "Gebühr"],
  [/inkasso|mahnverfahren|rechtliche schritte/i, "Drohung"], [/alle(n)? auskunfteien/i, "alle Auskunfteien"],
  [/\b\d+\s*(tage|tagen|stunden|werktage)\b/i, "Frist mit Zahl"], [/\p{Extended_Pictographic}/u, "Emoji"],
  [/wir löschen|gelöscht werden|löschung garantiert/i, "Löschzusage"], [/akte wartet|konto aktivieren|ihr bereich geht auf/i, "Paket-Satz"],
];
{
  const nutz = (o: Record<string, unknown> = {}) => ({
    email: "max@beispiel.de", anrede: "Guten Tag Max Mustermann,", antrag_id: "FIAON-SCHUFA-MPRUEF-AB12", payment_reference: "FIAON-SCHUFA-MPRUEF",
    paket: "Bonitätsauskunft inkl. Handlungsplan", betrag: "74.00", bestellt_am: "22.09.2026", stufe: 1, mit_belehrung: "nein",
    auskunft_art: "privat", auskunft_land: "DE", auskunfteien: "SCHUFA, CRIF und Creditreform Boniversum", auskunft_bestellt_am: "22.09.2026", ...o,
  });
  const r = (o: Record<string, unknown> = {}) => motor.mailRendern(vorlage.AUSKUNFT_ERINNERUNG_EVENT, nutz(o))!;
  const betreffe = new Set<string>();
  for (const stufe of [1, 2, 3, 4, 5, 6]) {
    const m = r({ stufe });
    betreffe.add(m.betreff);
    const koerper = `${m.betreff}\n${m.text}`;
    const treffer = WORTWAND.filter(([re]) => re.test(koerper)).map(([, t]) => t);
    ok(`Stufe ${stufe}: ohne Platzhalter-Rest, Wortwand sauber („${m.betreff}“)`, m.fehlend.length === 0 && treffer.length === 0 && !/\{\{/.test(m.html), { fehlend: m.fehlend, treffer });
    ok(`Stufe ${stufe}: beide Sätze aus dem Auftrag, Betrag, IBAN, Verwendungszweck`, m.text.includes(vorlage.SCHON_UEBERWIESEN_SATZ) && m.text.includes(vorlage.NICHT_MEHR_SATZ)
      && /74,00 €/.test(m.text) && /IBAN/.test(m.text) && m.text.includes("FIAON-SCHUFA-MPRUEF"));
  }
  ok("jede Stufe (1–4 und Dauer) hat ihren eigenen Betreff", betreffe.size === 5, [...betreffe]);
  const m1 = r();
  ok("Knopf auf /zahlung/<Verwendungszweck>, GiroCode aus derselben Referenz", m1.html.includes("https://fiaon.com/zahlung/FIAON-SCHUFA-MPRUEF") && m1.html.includes("/api/fiaon/zahlung/FIAON-SCHUFA-MPRUEF/qr.png"));
  ok("Absender FIAON Accounting", m1.absender.name === "FIAON Accounting", m1.absender);
  ok("kein Karten-Block, kein Werbesatz (Zahlungspost)", !m1.html.includes(KARTE_SATZ.slice(0, 40)) && !/abmelden/i.test(m1.html));
  ok("DE: nennt SCHUFA", /SCHUFA, CRIF/.test(m1.text));
  ok("ohne Belehrung: kein Widerrufsrecht im Text", !/Widerrufsrecht|Muster-Widerrufsformular|Vertragsbestätigung/.test(m1.text));
  const mb = r({ mit_belehrung: "ja" });
  ok("mit Belehrung: Vertragsbestätigung, Widerrufsbelehrung und Muster-Formular", /Vertragsbestätigung/i.test(mb.text) && /Widerruf/.test(mb.text) && /Muster-Widerrufsformular/i.test(mb.text), mb.text.slice(-600));
  ok("mit Belehrung: Betreff sagt es", /Vertragsbestätigung/.test(mb.betreff));
  for (const [land, bei] of [["AT", "KSV1870 und CRIF"], ["CH", "CRIF und Intrum"]] as const) {
    for (const mit of ["nein", "ja"]) {
      const m = r({ auskunft_land: land, auskunfteien: bei, mit_belehrung: mit, stufe: mit === "ja" ? 1 : 3 });
      ok(`${land}${mit === "ja" ? " mit Belehrung" : ""}: nie „SCHUFA“ (Betreff, HTML, Text), nennt ${bei}`, !/schufa/i.test(`${m.betreff}${m.html}${m.text}`.replace(/FIAON-SCHUFA-/g, "")) && m.text.includes(bei));
    }
  }
  const ohneLand = motor.mailRendern(vorlage.AUSKUNFT_ERINNERUNG_EVENT, { ...nutz(), auskunfteien: "", auskunft_land: "" })!;
  ok("ohne Land: „den Auskunfteien Ihres Landes“ statt einer geratenen SCHUFA", ohneLand.text.includes("den Auskunfteien Ihres Landes") && !/SCHUFA,/.test(ohneLand.text));
  // ── Gegenprüfung 26.09.2026: die NACHGEHOLTE Belehrung ──
  ok("Muster-Satz der Quelle ist der erwartete (sonst greift der Ersatz nicht)", vorlage.MUSTER_FRIST_SATZ === "Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.", vorlage.MUSTER_FRIST_SATZ);
  const mn = r({ mit_belehrung: "ja", widerruf_wahl: "nicht_verlangt", widerruf_ab: "06.10.2026", stufe: 5 });
  ok("nachgeholt: nie „ab dem Tag des Vertragsabschlusses“ (HTML und Text)", !mn.text.includes("ab dem Tag des Vertragsabschlusses") && !mn.html.includes("ab dem Tag des Vertragsabschlusses"));
  ok("nachgeholt: Frist ab Erhalt dieser E-Mail, mit Hinweis davor", mn.text.includes(vorlage.NACHGEHOLT_FRIST_SATZ) && mn.text.includes(vorlage.NACHGEHOLT_HINWEIS)
    && mn.text.indexOf(vorlage.NACHGEHOLT_HINWEIS) < mn.text.indexOf(vorlage.NACHGEHOLT_FRIST_SATZ));
  ok("nachgeholt: kein altes „ab dem 06.10.2026“ (rechnete ab der Bestellung)", !mn.text.includes("06.10.2026"), mn.text.match(/.{60}06\.10\.2026.{20}/)?.[0]);
  ok("nachgeholt: der Rest des Musters bleibt wörtlich (Widerrufsrecht, Folgen, Formular)", mn.text.includes("Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.")
    && /Muster-Widerrufsformular/i.test(mn.text) && /Folgen des Widerrufs/i.test(mn.text));
  // ── Gegenprüfung 26.09.2026: der Leistungssatz folgt Wahl und Lieferweg ──
  const lk = (o: Record<string, unknown>) => vorlage.erinnerungLeistungSatz({ auskunft_art: "privat", ...o });
  ok("Leistung, Einkauf, nicht verlangt: „erst nach Ablauf der Widerrufsfrist“", /erst nach Ablauf der Widerrufsfrist/.test(lk({ auskunft_liefermodus: "einkauf", widerruf_wahl: "nicht_verlangt" }))
    && /beschaffen wir/.test(lk({ auskunft_liefermodus: "einkauf", widerruf_wahl: "nicht_verlangt" })));
  ok("Leistung, Einkauf, verlangt/offen: ohne Wartesatz", !/Widerrufsfrist/.test(lk({ auskunft_liefermodus: "einkauf", widerruf_wahl: "verlangt" })) && !/Widerrufsfrist/.test(lk({})));
  ok("Leistung, Vollmacht: Hinweis auf die eigene Mail zum Unterschreiben", /Vollmacht und Anfragen am Bildschirm unterschreiben/.test(lk({ auskunft_liefermodus: "vollmacht" })));
  ok("Leistung, Vollmacht + nicht verlangt: Anfragen erst nach Ablauf der Frist", /übermitteln wir die Anfragen erst nach Ablauf der Widerrufsfrist/.test(lk({ auskunft_liefermodus: "vollmacht", widerruf_wahl: "nicht_verlangt" })));
  ok("Leistung, Firma: nie ein Wartesatz (kein Widerrufsrecht), Wirtschaftsauskunfteien", !/Widerrufsfrist/.test(vorlage.erinnerungLeistungSatz({ auskunft_art: "firma", widerruf_wahl: "nicht_verlangt" }))
    && /Wirtschaftsauskunfteien/.test(vorlage.erinnerungLeistungSatz({ auskunft_art: "firma" })));
  const mNf = r({ stufe: 3, widerruf_wahl: "nicht_verlangt", auskunft_liefermodus: "einkauf" });
  ok("Mail Stufe 3 bei „nicht verlangt“: kein „beginnen wir mit Ihrer Auskunft“, Wartesatz drin", !/beginnen wir/.test(mNf.text) && /erst nach Ablauf der Widerrufsfrist/.test(mNf.text));
  const firma = r({ auskunft_art: "firma", mit_belehrung: "ja" });
  ok("Firma: Wirtschaftsauskunfteien genannt, kein Verbraucher-Widerrufsformular", /Wirtschaftsauskunfteien/.test(firma.text) && !/Muster-Widerrufsformular/i.test(firma.text));
  ok("Motor kennt die Vorlage, Absender-Rolle accounting", motor.hatVorlage("auskunft_zahlung_erinnerung") && motor.absenderFuer("auskunft_zahlung_erinnerung").email === motor.absenderFuer("payment_reminder").email);

  // ── Gesamtdurchsicht 26.09.2026: die Fassung „Frage" ──
  const KAUF = "https://www.fiaon.com/api/fiaon/auskunft/bestellen?p=4711&art=privat&exp=1799999999000&sig=0f3a9b7c2e4d0f3a9b7c2e4d0f3a9b7c";
  const fq = (o: Record<string, unknown> = {}) => r({ fassung: "frage", kauf_url: KAUF, mit_belehrung: "nein", ...o });
  const fBetreffe = new Set<string>();
  for (const stufe of [1, 2, 3, 4, 5, 6]) {
    const m = fq({ stufe });
    fBetreffe.add(m.betreff);
    const koerper = `${m.betreff}\n${m.text}`;
    const treffer = WORTWAND.filter(([re]) => re.test(koerper)).map(([, t]) => t);
    ok(`Frage Stufe ${stufe}: ohne Platzhalter-Rest, Wortwand sauber („${m.betreff}“)`, m.fehlend.length === 0 && treffer.length === 0 && !/\{\{/.test(m.html), { fehlend: m.fehlend, treffer });
    ok(`Frage Stufe ${stufe}: KEINE Zahlungsaufforderung (keine IBAN/BIC/Empfänger, kein GiroCode, kein Zahlungsseiten-Knopf, kein „Schon überwiesen“)`,
      !/IBAN|BIC|Empfänger|GiroCode|qr\.png|\/zahlung\//i.test(`${m.html}${m.text}`) && !m.text.includes(vorlage.SCHON_UEBERWIESEN_SATZ));
    ok(`Frage Stufe ${stufe}: keine Vertragsbestätigung, kein „danke für Ihre Bestellung“, keine Belehrung`,
      !/Vertragsbestätigung|danke für Ihre Bestellung|Widerrufsformular|Hiermit bestätigen/i.test(`${m.betreff}${m.text}`));
    ok(`Frage Stufe ${stufe}: Betrag genannt, Satz „Möchten Sie sie nicht mehr? …“, Knopf auf den Kauflink`,
      /74,00 €/.test(m.text) && m.text.includes(vorlage.FRAGE_NICHT_MEHR_SATZ) && (m.html.includes(KAUF) || m.html.includes(KAUF.replace(/&/g, "&amp;"))) && m.text.includes(vorlage.FRAGE_ZAHLUNG_SATZ), m.text.slice(0, 400));
  }
  ok("Frage Stufe 1: Betreff wörtlich aus dem Auftrag", fq({ stufe: 1 }).betreff === vorlage.FRAGE_BETREFF && vorlage.FRAGE_BETREFF === "Zu Ihrer Bonitätsauskunft ist noch eine Bestellung offen — möchten Sie sie noch?");
  ok("Frage: drei Betreffe (erste, Nachfrage 2–4, Dauer)", fBetreffe.size === 3, [...fBetreffe]);
  const fErst = fq({ stufe: 5, erste_nachfrage: "ja" });
  ok("Frage: erste Nachfrage beim Nachholen (Dauerstufe 5) — Betreff aus dem Auftrag, nie „noch einmal“, keine Marke „Nachfrage“",
    fErst.betreff === vorlage.FRAGE_BETREFF && !/noch einmal|weiterhin/i.test(fErst.text) && !/Nachfrage<\/|>Nachfrage</.test(fErst.html), fErst.betreff);
  ok("Frage: auch mit mit_belehrung „ja“ in der Nutzlast keine Belehrung (die Fassung entscheidet)", !/Widerrufsformular|Vertragsbestätigung/i.test(fq({ mit_belehrung: "ja" }).text));
  ok("Frage: Absender Accounting, kein Karten-Block", fq().absender.name === "FIAON Accounting" && !fq().html.includes(KARTE_SATZ.slice(0, 40)));
  for (const [land, bei] of [["AT", "KSV1870 und CRIF"], ["CH", "CRIF und Intrum"]] as const) {
    const m = fq({ auskunft_land: land, auskunfteien: bei, stufe: 5 });
    ok(`Frage ${land}: nie „SCHUFA“, nennt ${bei}`, !/schufa/i.test(`${m.betreff}${m.html}${m.text}`.replace(/FIAON-SCHUFA-/g, "")) && m.text.includes(bei));
  }
  const fOhneKauf = motor.mailRendern(vorlage.AUSKUNFT_ERINNERUNG_EVENT, { ...nutz({ fassung: "frage" }) })!;
  ok("Frage ohne kauf_url: Knopf entfällt (nie ein leerer Link)", !fOhneKauf.html.includes('href=""') && !fOhneKauf.html.includes("{{params.kauf_url}}"), fOhneKauf.fehlend);

  // ── Nachbesserung 26.09.2026 (Gegenprüfung): die Frage beim Anlegen („frisch") und die Vertragsbestätigung nach der Bestätigung ──
  const fFrisch = fq({ stufe: 1, erste_nachfrage: "ja", frisch: "ja", bestellt_am: "26.09.2026" });
  const wwF = WORTWAND.filter(([re]) => re.test(`${fFrisch.betreff}\n${fFrisch.text}`)).map(([, t]) => t);
  ok("Frage frisch: eigener Betreff, „angelegt worden“, nie „seit dem … offen“/„noch?“, keine Bankdaten, Kauflink, Wortwand sauber",
    fFrisch.betreff === vorlage.FRAGE_BETREFF_FRISCH && /angelegt worden/.test(fFrisch.text) && /Möchten Sie die Auskunft\?/.test(fFrisch.text) && !/seit dem|noch\?|noch einmal/.test(`${fFrisch.betreff}${fFrisch.text}`)
    && !/IBAN|GiroCode|\/zahlung\//.test(`${fFrisch.html}${fFrisch.text}`) && (fFrisch.html.includes(KAUF) || fFrisch.html.includes(KAUF.replace(/&/g, "&amp;"))) && fFrisch.text.includes(vorlage.FRAGE_ZAHLUNG_SATZ)
    && fFrisch.fehlend.length === 0 && wwF.length === 0, { b: fFrisch.betreff, wwF });
  const bs = (o: Record<string, unknown> = {}) => r({ fassung: "bestaetigung", mit_belehrung: "ja", belehrung_nachgeholt: "ja", bestaetigt_am: "26.09.2026", bestellt_am: "16.07.2026", auskunft_bestellt_am: "16.07.2026", stufe: 5, ...o });
  const mB = bs();
  const bb = vorlage.auskunftBestaetigungBaustein({ bestaetigt_am: "26.09.2026", auskunft_art: "privat" });
  const wwB = WORTWAND.filter(([re]) => re.test(`${bb.betreff}\n${bb.absaetze.join("\n")}`)).map(([, t]) => t);
  ok("Bestätigung: Betreff, „danke“, Bankdaten + GiroCode + Zahlungsseite, Wortwand (Kopf) sauber, keine Platzhalter-Reste",
    mB.betreff === vorlage.BESTAETIGUNG_BETREFF && /Danke für Ihre Bestätigung/.test(mB.html) && /IBAN/.test(mB.text) && mB.html.includes("/zahlung/FIAON-SCHUFA-MPRUEF")
    && mB.html.includes("qr.png") && mB.fehlend.length === 0 && !/\{\{/.test(mB.html) && wwB.length === 0, { b: mB.betreff, f: mB.fehlend, wwB });
  ok("Bestätigung: Vertragsbestätigung, NACHGEHOLTE Belehrung (Frist ab Zugang dieser Mail), Muster-Formular",
    /Ihre Vertragsbestätigung/.test(mB.text) && mB.text.includes(vorlage.NACHGEHOLT_FRIST_SATZ) && mB.text.includes(vorlage.NACHGEHOLT_HINWEIS)
    && !mB.text.includes("ab dem Tag des Vertragsabschlusses") && /Muster-Widerrufsformular/i.test(mB.text));
  ok("Bestätigung: „Von Ihnen bestätigt am 26.09.2026“, nie das alte Anlagedatum 16.07.2026", mB.text.includes("Von Ihnen bestätigt am:") && mB.text.includes("26.09.2026") && !mB.text.includes("16.07.2026"),
    mB.text.match(/.{40}16\.07\.2026.{20}/)?.[0]);
  ok("Bestätigung: kein „Schon überwiesen?“, kein „nicht mehr?“, keine Frage-Sätze", !mB.text.includes(vorlage.SCHON_UEBERWIESEN_SATZ) && !mB.text.includes(vorlage.NICHT_MEHR_SATZ)
    && !mB.text.includes(vorlage.FRAGE_ZAHLUNG_SATZ));
  const mBn = bs({ widerruf_wahl: "nicht_verlangt", auskunft_liefermodus: "einkauf" });
  ok("Bestätigung bei „nicht verlangt“: Wartesatz, Wahl in der Belehrung", /erst nach Ablauf der Widerrufsfrist/.test(mBn.text) && /Ihre Wahl bei der Bestellung/.test(mBn.text));
  for (const [land, bei] of [["AT", "KSV1870 und CRIF"], ["CH", "CRIF und Intrum"]] as const) {
    const m = bs({ auskunft_land: land, auskunfteien: bei });
    ok(`Bestätigung ${land}: nie „SCHUFA“, nennt ${bei}`, !/schufa/i.test(`${m.betreff}${m.html}${m.text}`.replace(/FIAON-SCHUFA-/g, "")) && m.text.includes(bei));
  }
}

// ═══ 4. Quelltext ══════════════════════════════════════════════════════════
abschnitt("4. Quelltext: Paket-Mahnmaschine, Tür, Register");
{
  const antrag = lies("server/routes/fiaon-antrag.ts");
  const claim = antrag.slice(antrag.indexOf("async function claimReminderBatch("), antrag.indexOf("function reminderPayload("));
  ok("payment_reminder (claimReminderBatch, Einzel- und Sammelversand) nimmt keine Auskunft", /NOT \(\$\{sqlPool\.unsafe\(produktkategorieSql\("fa"\)\)\} = 'auskunft'\)/.test(claim));
  const vorschau = antrag.slice(antrag.indexOf('router.get("/admin/payments/bulk-reminder/preview"'), antrag.indexOf('router.get("/admin/payments/bulk-reminder/status"'));
  ok("Sammelversand: Vorschau und Start-Zählung ohne Auskunft und Global", (vorschau.match(/NOT IN \('global', 'auskunft'\)/g) ?? []).length === 2);
  ok("Sammelversand läuft durch claimReminderBatch", /claimReminderBatch\(BULK_BATCH/.test(vorschau));
  const tuer = lies("server/make-webhook.ts");
  ok("Tür: Ereignistyp, Anreicherung, nurMotor, Privatlinie", /\| "auskunft_zahlung_erinnerung"/.test(tuer) && /eventType === "auskunft_zahlung_erinnerung"\) \{/.test(tuer)
    && /"auskunft_kundenpreis", "auskunft_zahlung_erinnerung", "schufa_requested"/.test(tuer) && /\n  "auskunft_zahlung_erinnerung",\n\]\);/.test(tuer));
  const freq = lies("server/lib/fiaon-mail-frequenz.ts");
  const zp = freq.slice(freq.indexOf("const ZAHLUNGSPOST"), freq.indexOf("]);", freq.indexOf("const ZAHLUNGSPOST")));
  const pf = freq.slice(freq.indexOf("export const PFLICHTMAILS"), freq.indexOf("]);", freq.indexOf("export const PFLICHTMAILS")));
  ok("Frequenz: ZAHLUNGSPOST (Werbesperre lässt durch), NICHT Pflichtmail (unzustellbar sperrt)", zp.includes('"auskunft_zahlung_erinnerung"') && !pf.includes('"auskunft_zahlung_erinnerung"'));
  ok("Register: make-events-registry und fiaon-mail-events", /type: "auskunft_zahlung_erinnerung"/.test(lies("server/make-events-registry.ts")) && /\n  auskunft_zahlung_erinnerung: \{/.test(lies("server/lib/fiaon-mail-events.ts")));
  ok("Lauf auskunft_erinnerung alle 30 Minuten in routes.ts", /tageslauf\('auskunft_erinnerung', .*erinnerungLauf\(\), 30 \* 60 \* 1000/.test(lies("server/routes.ts")));
  const verkauf = lies("server/lib/fiaon-auskunft-verkauf.ts");
  ok("Verkaufstakt: OHNE_AUSKUNFT_SQL ohne 21-Tage-Grenze", !/OFFEN_WIEDERVERWENDEN_TAGE\} days/.test(verkauf) && /'paid', 'claimed_paid', 'pending_payment', 'cancelled'/.test(verkauf));
  const auskunft = lies("server/lib/fiaon-auskunft.ts");
  // Integration 26.09.2026 (E-244, „Offene Auskunft jeden Alters"), bewusste Änderung: Auch die Kaufwege kennen kein Alter mehr.
  ok("Kaufwege: offenWiederverwendbar ohne 21-Tage-Grenze", !/OFFEN_WIEDERVERWENDEN_TAGE/.test(auskunft.replace(/\/\/.*$/gm, "")) && /if \(o\.status === "claimed_paid"\) return true;/.test(auskunft));
}

if (OHNE_DB) {
  console.log(`\n${gruen} von ${gruen + rot} Prüfungen bestanden${rot ? ` — ${rot} FEHLER:\n  · ${fehler.join("\n  · ")}` : ""}. (ohne Datenbank)`);
  process.exit(rot ? 1 : 0);
}

// ═══ 5. Lokale Test-DB: der echte Lauf ═════════════════════════════════════
const { sqlPool } = await import("../server/lib/db-pool");
const verkauf = await import("../server/lib/fiaon-auskunft-verkauf");
const { produktkategorieSql } = await import("../server/lib/fiaon-produktkategorie");
const MARKE = `E244ER${Date.now().toString(36).toUpperCase()}`;
const klein = MARKE.toLowerCase();
const adresse = (n: string) => `${klein}-${n.toLowerCase()}@pruef.invalid`;
const ids: number[] = [], refs: string[] = [];
const start = new Date();
const HEUTE = berlinDatum(new Date());
const MITTAG = um(HEUTE, "12:00");
/** vor n Berliner Tagen, 10:00 */
const vorTagen = (n: number) => um(plusTage(HEUTE, -n), "10:00");
const EIGENE = [verkauf.SCHALTER_ERINNERUNG_AN, verkauf.SCHALTER_ERINNERUNG_PRO_TAG, verkauf.SCHALTER_ERINNERUNG_DAUER];
const alteEinstellungen = (await sqlPool`SELECT key, value FROM fiaon_settings WHERE key = ANY(${EIGENE})`) as any[];
const setze = async (key: string, value: string) => { await sqlPool`
  INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${key}, ${value}, NOW()) ON CONFLICT (key) DO UPDATE SET value = ${value}, updated_at = NOW()`; };

async function person(name: string, o: { werbesperre?: boolean; blockiert?: boolean; test?: boolean } = {}) {
  const [p] = (await sqlPool`
    INSERT INTO fiaon_persons (person_ref, kind, first_name, last_name, primary_email, werbung_gesperrt_am, is_blocked, ist_test_am, created_at, updated_at)
    VALUES (${`PRUEF-${MARKE}-${name}`}, 'private', ${name}, 'Prüfstand', ${adresse(name)}, ${o.werbesperre ? new Date() : null}, ${!!o.blockiert}, ${o.test ? new Date() : null}, NOW(), NOW())
    RETURNING id`) as any[];
  ids.push(Number(p.id));
  return Number(p.id);
}
/**
 * Gesamtdurchsicht 26.09.2026: Standard „erklärt" — der Beschaffungsauftrag des Kunden über den Kauflink steht im Verlauf
 * (eine der Erklärungen aus KUNDENERKLAERUNG_SQL, ohne Einfluss auf die Wahl zum Beginn). erklaert: false = Altbestand → Frage.
 */
async function auskunft(personId: number, name: string, o: { tage: number; status?: string; land?: string; archiviert?: boolean; mahnstopp?: boolean; pack?: string; erklaert?: boolean; betrag?: number } ): Promise<string> {
  const ref = `FIAON-SCHUFA-PRUEF${MARKE}${refs.length}`;
  refs.push(ref);
  const angelegt = vorTagen(o.tage);
  await sqlPool`
    INSERT INTO fiaon_applications (ref, type, status, pack_key, pack_name, payment_status, person_id, first_name, last_name, email, country,
                                    amount_due, created_at, updated_at, payment_reference, archived_at, mahnstopp_am, claimed_paid_at, paid_at)
    VALUES (${ref}, 'schufa', 'submitted', ${o.pack ?? "schufa"}, 'Bonitätsauskunft inkl. Handlungsplan', ${o.status ?? "pending_payment"}, ${personId},
            ${name}, 'Prüfstand', ${adresse(name)}, ${o.land ?? "DE"}, ${o.betrag ?? 74}, ${angelegt}, ${angelegt}, ${`P${MARKE}${refs.length}`},
            ${o.archiviert ? new Date() : null}, ${o.mahnstopp ? new Date() : null}, ${o.status === "claimed_paid" ? vorTagen(Math.max(0, o.tage - 1)) : null},
            ${o.status === "paid" ? angelegt : null})`;
  if (o.erklaert !== false) {
    await sqlPool`INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note, created_at)
                  VALUES (${ref}, ${personId}, NULL, 'Kunde (Kauflink aus der E-Mail)', 'system',
                          ${"Beschaffungsauftrag ERTEILT über den Kauflink der E-Mail (Prüfstand)."}, ${angelegt})`;
  }
  return ref;
}
async function paket(personId: number, name: string, o: { gekuendigt?: boolean; mahnstopp?: boolean } = {}) {
  const ref = `FIAON-PRUEF${MARKE}P${refs.length}`;
  refs.push(ref);
  await sqlPool`
    INSERT INTO fiaon_applications (ref, type, status, current_step, pack_key, payment_status, person_id, first_name, last_name, email, country,
                                    created_at, updated_at, paid_at, payment_reference, gekuendigt_am, mahnstopp_am)
    VALUES (${ref}, 'private', 'submitted', 8, 'pro', 'paid', ${personId}, ${name}, 'Prüfstand', ${adresse(name)}, 'DE',
            ${vorTagen(60)}, ${vorTagen(60)}, ${vorTagen(59)}, ${`Q${MARKE}${refs.length}`}, ${o.gekuendigt ? new Date() : null}, ${o.mahnstopp ? new Date() : null})`;
  return ref;
}
const zeile = async (ref: string) => ((await sqlPool`
  SELECT payment_status, mahnstopp_am, auskunft_erinnerung_stufe AS stufe, auskunft_erinnerung_am AS am, auskunft_erinnerung_ruhe_bis AS ruhe,
         auskunft_erinnerung_hinweis AS hinweis, auskunft_erinnerung_aufgabe_am AS aufgabe FROM fiaon_applications WHERE ref = ${ref}`) as any[])[0];
const mailsAn = (name: string) => BREVO.filter((b) => b.an === adresse(name));

let server: any = null;
try {
  abschnitt("5. Der Lauf gegen die lokale Test-DB (Brevo-Attrappe)");
  await er.ensureErinnerungSpalten();
  for (const k of EIGENE) await sqlPool`DELETE FROM fiaon_settings WHERE key = ${k}`;  // Standard: an, 50, 7

  const P1 = await person("Eins"); const E1 = await auskunft(P1, "Eins", { tage: 1 });
  const P2 = await person("Zwei"); const E2 = await auskunft(P2, "Zwei", { tage: 5 }); await paket(P2, "Zwei");
  await sqlPool`INSERT INTO fiaon_mail_log (event, person_id, empfaenger, status, art, payload, created_at)
                VALUES ('payment_details', ${P2}, ${adresse("Zwei")}, 'versandt', 'echt', ${sqlPool.json({ antrag_id: E2, produktkategorie: "auskunft" })}, ${vorTagen(5)})`;
  const P3 = await person("Wien"); const E3 = await auskunft(P3, "Wien", { tage: 45, land: "AT" });
  const P4 = await person("Gemeldet"); const E4 = await auskunft(P4, "Gemeldet", { tage: 40, status: "claimed_paid" });
  const P5 = await person("Sperre", { werbesperre: true }); const E5 = await auskunft(P5, "Sperre", { tage: 4 });
  const P6 = await person("Stopp"); const E6 = await auskunft(P6, "Stopp", { tage: 40, mahnstopp: true });
  const P7 = await person("Test", { test: true }); const E7 = await auskunft(P7, "Test", { tage: 4 });
  const P8 = await person("Archiv"); const E8 = await auskunft(P8, "Archiv", { tage: 4, archiviert: true });
  const P9 = await person("Ersetzt"); const E9 = await auskunft(P9, "Ersetzt", { tage: 4, status: "superseded" });
  const P10 = await person("Kuendig"); const E10 = await auskunft(P10, "Kuendig", { tage: 35 }); await paket(P10, "Kuendig", { gekuendigt: true });
  const P11 = await person("Dokument"); const E11 = await auskunft(P11, "Dokument", { tage: 4 });
  await sqlPool`INSERT INTO fiaon_dokumente (person_id, art, dateiname, mime, bytes, inhalt, quelle, doc_hash)
                VALUES (${P11}, 'schufa', 'auskunft.pdf', 'application/pdf', 4, ${Buffer.from("%PDF")}, 'kunde', ${`pruef-${MARKE}-dok`})`;
  const P12 = await person("Kein", { blockiert: true }); const E12 = await auskunft(P12, "Kein", { tage: 4 });
  const P13 = await person("Bounce"); const E13 = await auskunft(P13, "Bounce", { tage: 4 });
  await sqlPool`INSERT INTO fiaon_mail_log (event, person_id, empfaenger, status, art, zustellung, created_at)
                VALUES ('payment_details', ${P13}, ${adresse("Bounce")}, 'versandt', 'echt', 'gebounct', NOW() - INTERVAL '3 days')`;
  const P14 = await person("Heute"); const E14 = await auskunft(P14, "Heute", { tage: 0 });
  const P15 = await person("Zuerich"); const E15 = await auskunft(P15, "Zuerich", { tage: 12, land: "CH" });
  // Belehrung schon da — als jsonb-TEXT gespeichert (Hausfalle: payload #>> '{}')
  await sqlPool`INSERT INTO fiaon_mail_log (event, person_id, empfaenger, status, art, payload, created_at)
                VALUES ('payment_details', ${P15}, ${adresse("Zuerich")}, 'versandt', 'echt', ${sqlPool.json(JSON.stringify({ antrag_id: E15, produktkategorie: "auskunft" }) as any)}, ${vorTagen(12)})`;
  // Gegenprüfung 26.09.2026 (MRRXTXV6): Mahnstopp nur an der PAKET-Zeile, Auskunft 35 Tage offen.
  const P23 = await person("PaketStopp"); const E23 = await auskunft(P23, "PaketStopp", { tage: 35 }); await paket(P23, "PaketStopp", { mahnstopp: true });
  const ALLE = [E1, E2, E3, E4, E5, E6, E7, E8, E9, E10, E11, E12, E13, E14, E15, E23];

  const u = await er.erinnerungUebersicht(MITTAG);
  const eigene = u.bestellungen.filter((b) => ALLE.includes(b.ref)).map((b) => b.ref);
  ok("Übersicht: ersetzte Bestellung steht nicht darin, alle anderen schon", !eigene.includes(E9) && eigene.length === 15, eigene.length);

  // ── Lauf 1 ──
  const l1 = await er.erinnerungLauf(MITTAG, { refs: ALLE });
  await warte(1500);  // das Mail-Protokoll schreibt nebenbei
  const erwartet = ["Eins", "Zwei", "Wien", "Sperre", "Zuerich"];
  const bekommen = [...new Set(BREVO.map((b) => b.an))].sort();
  ok(`Lauf 1: genau fünf Erinnerungen (${erwartet.join(", ")})`, l1.versandt === 5 && JSON.stringify(bekommen) === JSON.stringify(erwartet.map(adresse).sort()), { l1, bekommen });
  for (const n of ["Gemeldet", "Stopp", "Test", "Archiv", "Ersetzt", "Kuendig", "Dokument", "Kein", "Bounce", "Heute", "PaketStopp"]) {
    ok(`keine Mail an „${n}“`, mailsAn(n).length === 0);
  }
  ok("Tags und Absender: auskunft_zahlung_erinnerung von Accounting", BREVO.every((b) => b.tags.includes("auskunft_zahlung_erinnerung") && /accounting/i.test(b.absender)), BREVO.map((b) => b.absender));
  const s1 = await zeile(E1), s2 = await zeile(E2), s3 = await zeile(E3), s5 = await zeile(E5), s15 = await zeile(E15);
  ok("Marken: Eins Stufe 1, Zwei Stufe 2, Wien Stufe 7 (nachgeholt), Sperre Stufe 2, Zürich Stufe 3",
    s1.stufe === 1 && s2.stufe === 2 && s3.stufe === 7 && s5.stufe === 2 && s15.stufe === 3, [s1.stufe, s2.stufe, s3.stufe, s5.stufe, s15.stufe]);
  const m1 = mailsAn("Eins")[0], m2 = mailsAn("Zwei")[0], m3 = mailsAn("Wien")[0], m15 = mailsAn("Zuerich")[0];
  ok("Eins (keine Belehrung protokolliert): mit Vertragsbestätigung und Widerrufsbelehrung", /Muster-Widerrufsformular/i.test(m1?.text ?? "") && /Vertragsbestätigung/.test(m1?.betreff ?? ""), m1?.betreff);
  ok("Zwei (Zahlungsdaten in der Auskunft-Fassung protokolliert): ohne Belehrung", !!m2 && !/Widerrufsformular|Vertragsbestätigung/i.test(`${m2.betreff}${m2.text}`));
  ok("Zürich (Belehrung als jsonb-Text protokolliert): ohne Belehrung, nie SCHUFA", !!m15 && !/Widerrufsformular/i.test(m15.text) && !/schufa/i.test(`${m15.betreff}${m15.html}`.replace(/FIAON-SCHUFA-/g, "")) && /CRIF und Intrum/.test(m15.text));
  ok("Wien (Belehrung nachgeholt): Frist ab Erhalt dieser Mail, nie „ab dem Tag des Vertragsabschlusses“", !!m3 && m3.text.includes(vorlage.NACHGEHOLT_FRIST_SATZ) && !m3.text.includes("ab dem Tag des Vertragsabschlusses"));
  ok("PaketStopp: Marke unberührt (Stufe 0)", Number((await zeile(E23)).stufe || 0) === 0);
  ok("Wien (AT, Tag 45): eine Mail, Dauerstufe, mit Belehrung, KSV1870, nie SCHUFA", mailsAn("Wien").length === 1 && /Offene Bestellung/.test(m3?.betreff ?? "")
    && /Muster-Widerrufsformular/i.test(m3?.text ?? "") && /KSV1870/.test(m3?.text ?? "") && !/schufa/i.test(`${m3?.betreff}${m3?.html}${m3?.text}`.replace(/FIAON-SCHUFA-/g, "")), m3?.betreff);
  ok("Knopf zur Zahlungsseite mit dem Verwendungszweck", !!m1 && m1.html.includes(`https://fiaon.com/zahlung/P${MARKE}1`));
  const log = (await sqlPool`
    SELECT (CASE WHEN jsonb_typeof(payload) = 'string' THEN (payload #>> '{}')::jsonb ELSE payload END) AS p, status
      FROM fiaon_mail_log WHERE event = 'auskunft_zahlung_erinnerung' AND person_id = ANY(${ids})`) as any[];
  ok("Mail-Protokoll: fünf Einträge „versandt“ mit antrag_id und stufe", log.length === 5 && log.every((l) => l.status === "versandt" && refs.includes(String(l.p?.antrag_id)) && Number(l.p?.stufe) >= 1), log.map((l) => [l.status, l.p?.antrag_id, l.p?.stufe]));
  ok("Mail-Protokoll: nachgeholte Belehrung belegt (belehrung_nachgeholt nur mit mit_belehrung)", log.some((l) => l.p?.antrag_id === E1 && l.p?.mit_belehrung === "ja" && l.p?.belehrung_nachgeholt === "ja")
    && log.every((l) => (l.p?.mit_belehrung === "ja") === (l.p?.belehrung_nachgeholt === "ja")));
  const verl = (await sqlPool`SELECT ref, note FROM fiaon_contact_log WHERE ref = ANY(${ALLE}) AND note LIKE 'Zahlungserinnerung verschickt%'`) as any[];
  ok("Verlauf: je Mail ein Vermerk an der Bestellung, Belehrung genannt", verl.length === 5 && verl.some((v) => v.ref === E1 && v.note.includes(er.VERMERK_BELEHRUNG)) && verl.some((v) => v.ref === E2 && !v.note.includes(er.VERMERK_BELEHRUNG)));
  const todos = (await sqlPool`SELECT schluessel, titel, text FROM fiaon_betreiber_todos WHERE schluessel LIKE ${`auskunft:FIAON-SCHUFA-PRUEF${MARKE}%`}`) as any[];
  // Gesamtdurchsicht 26.09.2026 (bewusste Änderung): Wien (Tag 45) bekam eben seine ERSTE Mail — die Aufgabe „anrufen oder
  // stornieren" kommt erst 7 Tage danach (unten). Kündig (Storno-Vorschlag, keine Mail) bleibt ab Tag 30.
  ok("Aufgabe im Lauf 1: nur Kündig (Storno-Vorschlag) — nicht Wien (erste Mail eben erst raus), nicht Gemeldet, nicht Mahnstopp (auch nicht an der Paket-Zeile), nicht unter 30 Tagen",
    todos.length === 1 && todos.some((t) => t.schluessel === `auskunft:${E10}:offen-30` && /stornieren/.test(t.text)), todos.map((t) => t.schluessel));
  const tK = todos.find((t) => t.schluessel === `auskunft:${E10}:offen-30`);
  ok("Aufgabe Kündig: Titel „stornieren?“, kein Anruf", !!tK && /stornieren\?/.test(tK.titel) && !/anrufen/i.test(`${tK.titel}`) && /NICHT anrufen/.test(tK.text), tK?.titel);
  const vAuf = (await sqlPool`SELECT note FROM fiaon_contact_log WHERE ref = ${E10} AND note LIKE 'Zahlungserinnerung: seit%'`) as any[];
  ok("Verlauf der Aufgabe nennt den echten Empfänger (Betreiber) und „stornieren?“", vAuf.length === 1 && /„stornieren\?“ an den Betreiber/.test(vAuf[0].note), vAuf[0]?.note);
  // Wien: die Erinnerung 8 Tage zurückdrehen → jetzt die Aufgabe (einmal), und sie nennt die letzte Erinnerung.
  await sqlPool`UPDATE fiaon_applications SET auskunft_erinnerung_am = auskunft_erinnerung_am - INTERVAL '8 days' WHERE ref = ${E3}`;
  const lW = await er.erinnerungLauf(MITTAG, { refs: [E3] });
  const tW = ((await sqlPool`SELECT titel, text FROM fiaon_betreiber_todos WHERE schluessel = ${`auskunft:${E3}:offen-30`}`) as any[])[0];
  ok("Wien, 8 Tage nach der Erinnerung: Aufgabe „anrufen oder stornieren“ (einmal), keine neue Mail", lW.aufgaben === 1 && lW.versandt === 0 && !!tW && /anrufen oder stornieren/.test(tW.titel), { lW, t: tW?.titel });
  ok("Aufgabe nennt die letzte Erinnerung", String(tW?.text ?? "").includes("Dauererinnerung 3"), tW?.text);

  // ── Idempotenz ──
  const vorher = BREVO.length;
  const l2 = await er.erinnerungLauf(MITTAG, { refs: ALLE });
  ok("zweiter Lauf gleich danach: nichts (Marke), keine zweite Aufgabe", l2.versandt === 0 && l2.aufgaben === 0 && BREVO.length === vorher, l2);
  const P16 = await person("Doppelt"); const E16 = await auskunft(P16, "Doppelt", { tage: 2 });
  const [la, lb] = await Promise.all([er.erinnerungLauf(MITTAG, { refs: [E16] }), er.erinnerungLauf(MITTAG, { refs: [E16] })]);
  ok("zwei Läufe gleichzeitig (zwei Instanzen): genau EINE Mail", la.versandt + lb.versandt === 1 && mailsAn("Doppelt").length === 1, [la.versandt, lb.versandt]);

  // ── Belehrung nur beim ersten Mal: Eins drei Tage zurückdrehen → Stufe 2 ohne Belehrung ──
  await sqlPool`UPDATE fiaon_applications SET created_at = ${vorTagen(4)}, auskunft_erinnerung_am = NOW() - INTERVAL '3 days' WHERE ref = ${E1}`;
  await er.erinnerungLauf(MITTAG, { refs: [E1] });
  const e1b = mailsAn("Eins");
  ok("Eins, Stufe 2: ohne Belehrung (schon in Textform protokolliert)", e1b.length === 2 && !/Widerrufsformular|Vertragsbestätigung/i.test(`${e1b[1].betreff}${e1b[1].text}`) && (await zeile(E1)).stufe === 2, e1b.map((m) => m.betreff));

  // ── Fehlschlag: Marke zurück, Ruhe ──
  const P18 = await person("Streik"); const E18 = await auskunft(P18, "Streik", { tage: 4 });
  BREVO_FEHLER.add(adresse("Streik"));
  const lf = await er.erinnerungLauf(MITTAG, { refs: [E18] });
  const s18 = await zeile(E18);
  ok("Brevo streikt: Fehler gezählt, Marke zurück (Stufe 0), Ruhe gesetzt, Grund notiert", lf.fehler === 1 && Number(s18.stufe || 0) === 0 && !s18.am && !!s18.ruhe && /nicht verschickt/.test(String(s18.hinweis)), { lf, s18 });
  BREVO_FEHLER.delete(adresse("Streik"));
  const lf2 = await er.erinnerungLauf(MITTAG, { refs: [E18] });
  ok("in der Ruhe: kein neuer Versuch", lf2.versandt === 0 && mailsAn("Streik").length === 0);

  // ── Tagesdeckel ──
  const P17 = await person("Deckel"); const E17 = await auskunft(P17, "Deckel", { tage: 4 });
  const schon = await er.heuteVersandt();
  await setze(verkauf.SCHALTER_ERINNERUNG_PRO_TAG, String(schon));
  const ld = await er.erinnerungLauf(MITTAG, { refs: [E17] });
  ok(`Tagesdeckel (${schon} erreicht): nichts, Grund genannt`, ld.versandt === 0 && /Tagesdeckel/.test(String(ld.grund)) && mailsAn("Deckel").length === 0, ld);
  await sqlPool`DELETE FROM fiaon_settings WHERE key = ${verkauf.SCHALTER_ERINNERUNG_PRO_TAG}`;

  // ── Schalter aus, Sendefenster ──
  await setze(verkauf.SCHALTER_ERINNERUNG_AN, "0");
  const lx = await er.erinnerungLauf(MITTAG, { refs: [E17] });
  ok("Schalter aus: nichts", lx.versandt === 0 && /aus/.test(String(lx.grund)));
  await sqlPool`DELETE FROM fiaon_settings WHERE key = ${verkauf.SCHALTER_ERINNERUNG_AN}`;
  const ln = await er.erinnerungLauf(um(HEUTE, "20:31"), { refs: [E17] });
  const lm = await er.erinnerungLauf(um(HEUTE, "06:59"), { refs: [E17] });
  ok("Sendefenster: 20:31 und 06:59 nichts", ln.versandt === 0 && lm.versandt === 0 && /Sendefenster/.test(String(ln.grund)));
  const lo = await er.erinnerungLauf(um(HEUTE, "20:30"), { refs: [E17] });
  ok("20:30: geht noch raus", lo.versandt === 1 && mailsAn("Deckel").length === 1, lo);

  // ═══ 6. Verkaufstakt ═══════════════════════════════════════════════════════
  abschnitt("6. Verkaufstakt: offene Bestellung jeden Alters sperrt das Angebot");
  const kat = (await sqlPool.unsafe(`SELECT ref, ${produktkategorieSql("fa")} AS k FROM fiaon_applications fa WHERE ref = ANY($1)`, [ALLE])) as any[];
  ok("jede Prüfbestellung ist für die Paket-Mahnmaschine „auskunft“ (also ausgenommen)", kat.length === ALLE.length && kat.every((z) => z.k === "auskunft"));
  const imPool = async (pid: number) => await verkauf.personImPool(pid);
  const alt = await imPool(P10);  // 35 Tage offen, gekündigtes Paket
  const zwei = await imPool(P2);  // 5 Tage offen, laufendes Paket
  ok("Paket-Kunde mit offener Auskunft (5 Tage): hatAuskunft", !!zwei && zwei.hatAuskunft, zwei);
  const P20 = await person("Alt"); await paket(P20, "Alt"); await auskunft(P20, "Alt", { tage: 40 });
  const p20 = await imPool(P20);
  ok("Paket-Kunde mit offener Auskunft (40 Tage): hatAuskunft — bis E-243 wäre er wieder im Verkauf gewesen", !!p20 && p20.hatAuskunft, p20);
  const P21 = await person("Storniert"); await paket(P21, "Storniert"); await auskunft(P21, "Storniert", { tage: 10, status: "cancelled" });
  await sqlPool`UPDATE fiaon_applications SET cancelled_at = NOW() WHERE person_id = ${P21} AND type = 'schufa'`;
  const p21 = await imPool(P21);
  ok("stornierte Auskunft: hatAuskunft (kein neues Angebot nach „ich möchte sie nicht mehr“)", !!p21 && p21.hatAuskunft, p21);
  const P22 = await person("Ersatz"); await paket(P22, "Ersatz"); await auskunft(P22, "Ersatz", { tage: 30, status: "superseded" });
  const p22 = await imPool(P22);
  ok("nur ersetzte Auskunft: wieder im Verkauf (hatAuskunft nein)", !!p22 && !p22.hatAuskunft, p22);
  const altStand = { stufe: "offen" as const, offen: { ref: "x", paymentReference: "x", betragCents: 7400, status: "pending_payment", angelegt: vorTagen(40).toISOString(), art: "privat" as const } };
  ok("standVerkaufbar: offene Bestellung (40 Tage) nie verkaufbar; „nichts“ ja", verkauf.standVerkaufbar(altStand) !== null && verkauf.standVerkaufbar({ stufe: "nichts", offen: null }) === null);
  const { offenWiederverwendbar } = await import("../server/lib/fiaon-auskunft");
  // Integration 26.09.2026 (E-244), bewusste Änderung: Die 40 Tage alte 74-€-Bestellung bleibt der Kaufweg (ihre Referenz) — wie die Erinnerung sie nennt.
  ok("Kaufweg: 40 Tage alte Bestellung (74 €) wird wiederverwendet — keine neue daneben", offenWiederverwendbar({ offen: altStand.offen, preis: { art: "privat", mitAbo: true, cents: 7400, key: "schufa", text: "74,00 €" } as any }) === true);
  void alt;

  // ═══ 7. Chefseite ══════════════════════════════════════════════════════════
  abschnitt("7. Chefseite: Karte, Tabelle, Einstellung, Stornieren, Mahnstopp");
  const express = (await import("express")).default;
  const cookieParser = (await import("cookie-parser")).default;
  const chefRouter = (await import("../server/routes/fiaon-chef-auskunft")).default;
  const app = express();
  app.use(cookieParser()); app.use(express.json());
  app.use("/api/fiaon", chefRouter);
  server = app.listen(0);
  const basis = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/fiaon`;
  const keks = () => {
    const exp = Date.now() + 3_600_000;
    const sig = createHmac("sha256", process.env.SESSION_SECRET!).update(`chefzugang:9001:geschaeftsfuehrung:${exp}`).digest("hex").slice(0, 40);
    return `fiaon_chef=9001.geschaeftsfuehrung.${exp}.${sig}`;
  };
  const holen = async (pfad: string, init: RequestInit = {}) => {
    const r = await echtFetch(`${basis}${pfad}`, { ...init, headers: { cookie: keks(), "content-type": "application/json", ...(init.headers || {}) } });
    return { status: r.status, json: await r.json().catch(() => null) as any };
  };
  const post = (pfad: string, body: unknown) => holen(pfad, { method: "POST", body: JSON.stringify(body) });
  const g = await holen("/chef/auskunft");
  ok("GET /chef/auskunft lädt, mit Karte „Zahlungserinnerung“", g.status === 200 && g.json?.ok && g.json?.erinnerung?.an === true && g.json.erinnerung.proTag === 50 && g.json.erinnerung.dauerTage === 7
    // Gesamtdurchsicht 26.09.2026: Wiens Marke ist für die Aufgabe um 8 Tage zurückgedreht — eine Erinnerung weniger „heute".
    && g.json.erinnerung.heuteVersandt >= 6 && g.json.erinnerung.heuteVersandt === (await er.heuteVersandt()), { status: g.status, er: g.json?.erinnerung });
  const tab = (g.json?.offen ?? []).filter((o: any) => ALLE.includes(o.ref) || o.ref === E16 || o.ref === E17 || o.ref === E18);
  const zeig = (ref: string) => tab.find((o: any) => o.ref === ref);
  ok("Tabelle: ohne Archivierte und Tests", !zeig(E7) && !zeig(E8) && !zeig(E9) && !!zeig(E1) && !!zeig(E4));
  ok("Tabelle: Stufe und Datum der letzten Erinnerung, nächste Fälligkeit", zeig(E2)?.erinnerung?.stufe === 2 && !!zeig(E2)?.erinnerung?.letzteAm && /^\d{4}-\d{2}-\d{2}$/.test(String(zeig(E2)?.erinnerung?.naechste)), zeig(E2)?.erinnerung);
  ok("Tabelle: Gründe — gemeldet, Mahnstopp, gekündigt (stornieren?), Dokument, Vertriebssperre, unzustellbar",
    /Zahlung gemeldet/.test(zeig(E4)?.erinnerung?.grund) && /Mahnstopp/.test(zeig(E6)?.erinnerung?.grund) && zeig(E10)?.erinnerung?.stornieren === true
    && /Dokument/.test(zeig(E11)?.erinnerung?.grund) && /Vertriebssperre/.test(zeig(E12)?.erinnerung?.grund) && /unzustellbar/.test(zeig(E13)?.erinnerung?.grund));
  ok("Tabelle: Mahnstopp an der Paket-Zeile als eigener Grund", /anderen Bestellung/.test(zeig(E23)?.erinnerung?.grund ?? ""), zeig(E23)?.erinnerung);
  ok("Tabelle: Alter in Berliner Kalendertagen (Wien 45)", zeig(E3)?.tage === 45, zeig(E3)?.tage);
  ok("Tabelle: Werbesperre erinnert trotzdem (kein Grund)", zeig(E5)?.erinnerung?.grund === null && zeig(E5)?.werbesperre === true);
  const falsch = await post("/chef/auskunft/einstellung", { key: "auskunft_erinnerung_pro_tag", value: "999" });
  ok("Einstellung außerhalb der Erlaubnis (999) → 400", falsch.status === 400);
  const richtig = await post("/chef/auskunft/einstellung", { key: "auskunft_erinnerung_pro_tag", value: "40" });
  ok("Einstellung „je Tag 40“: gespeichert, im Protokoll „50 (Standard) → 40“", richtig.status === 200 && richtig.json?.einstellungen?.erinnerung?.proTag === 40
    && (richtig.json?.protokoll ?? []).some((p: any) => /Zahlungserinnerungen je Tag: 50 \(Standard\) → 40/.test(p.text)), richtig.json?.protokoll?.[0]);
  const ausKnopf = await post("/chef/auskunft/einstellung", { key: "auskunft_erinnerung_an", value: "0" });
  ok("Zahlungserinnerung aus: im Protokoll „an (Standard) → aus“", ausKnopf.status === 200 && ausKnopf.json?.einstellungen?.erinnerung?.an === false
    && (ausKnopf.json?.protokoll ?? []).some((p: any) => /Zahlungserinnerung: an \(Standard\) → aus/.test(p.text)));
  for (const k of EIGENE) await sqlPool`DELETE FROM fiaon_settings WHERE key = ${k}`;
  const st = await post("/chef/auskunft/stornieren", { ref: E12 });
  ok("Stornieren (offen, Vertriebssperre): storniert, Verlauf geschrieben", st.status === 200 && (await zeile(E12)).payment_status === "cancelled"
    && ((await sqlPool`SELECT 1 FROM fiaon_contact_log WHERE ref = ${E12} AND note LIKE 'Bestellung storniert%'`) as any[]).length === 1, st);
  const gP = await holen("/chef/auskunft");
  ok("Storno steht im Protokoll der Steuerung", (gP.json?.protokoll ?? []).some((p: any) => /storniert/.test(p.text)), gP.json?.protokoll?.slice(0, 3));
  const st2 = await post("/chef/auskunft/stornieren", { ref: E12 });
  ok("zweites Stornieren derselben Bestellung: 409, keine zweite Verlaufszeile", st2.status === 409
    && ((await sqlPool`SELECT 1 FROM fiaon_contact_log WHERE ref = ${E12} AND note LIKE 'Bestellung storniert%'`) as any[]).length === 1, st2);
  const stG = await post("/chef/auskunft/stornieren", { ref: E4 });
  ok("Stornieren bei „Zahlung gemeldet“: abgelehnt (409), nichts geändert", stG.status === 409 && (await zeile(E4)).payment_status === "claimed_paid", stG);
  const stX = await post("/chef/auskunft/stornieren", { ref: `FIAON-SCHUFA-GIBTSNICHT${MARKE}` });
  const stPaket = await post("/chef/auskunft/stornieren", { ref: refs.find((r) => r.startsWith(`FIAON-PRUEF${MARKE}P`)) });
  ok("Stornieren: unbekannt → 404, Paket-Bestellung → 404 (nur Auskünfte)", stX.status === 404 && stPaket.status === 404, [stX.status, stPaket.status]);
  const P19 = await person("Halt"); const E19 = await auskunft(P19, "Halt", { tage: 4 });
  const ms = await post("/chef/auskunft/mahnstopp", { ref: E19, an: true });
  const lms = await er.erinnerungLauf(MITTAG, { refs: [E19] });
  ok("Mahnstopp: gesetzt, danach keine Erinnerung", ms.status === 200 && !!(await zeile(E19)).mahnstopp_am && lms.versandt === 0 && mailsAn("Halt").length === 0);
  const ms2 = await post("/chef/auskunft/mahnstopp", { ref: E19, an: false });
  const lms2 = await er.erinnerungLauf(MITTAG, { refs: [E19] });
  ok("Mahnstopp aufgehoben: die Erinnerung läuft wieder", ms2.status === 200 && !(await zeile(E19)).mahnstopp_am && lms2.versandt === 1);

  // ═══ 8. Gesamtdurchsicht 26.09.2026: Frage, „bezahlt", Widerrufsstand ═════════════════════════════════════
  abschnitt("8. Frage ohne Erklärung des Kunden, Tür-Grund „bezahlt“, Aufgabe, Widerrufsstand");
  const AK = await import("../server/lib/fiaon-auskunft");
  const LF = await import("../server/lib/fiaon-auskunft-lieferung");
  const notiz = (ref: string, pid: number, autor: string, note: string, am: Date, voided = false) => sqlPool`
    INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note, created_at, voided_at)
    VALUES (${ref}, ${pid}, NULL, ${autor}, 'system', ${note}, ${am}, ${voided ? new Date() : null})`;
  const NICHT = "Bonitätsauskunft über den Kauflink der E-Mail zahlungspflichtig beauftragt (74 €). Beginn vor Ablauf der Widerrufsfrist NICHT verlangt — mit der Anforderung erst nach Ablauf der 14-tägigen Widerrufsfrist beginnen.";
  const VERL = "Bonitätsauskunft im Kundenbereich zahlungspflichtig beauftragt (74 €). Beginn vor Ablauf der Widerrufsfrist AUSDRÜCKLICH VERLANGT — Hinweis auf anteiligen Wertersatz und Erlöschen des Widerrufsrechts bei vollständiger Erfüllung bestätigt.";
  const LIEFER = "Bonitätsauskunft: Lieferung gestartet — 3 Anfragen an SCHUFA, CRIF und Creditreform Boniversum angelegt (Vorgänge #1, #2, #3). Mail „Bitte unterschreiben“: gesendet. Aufgabe #9. Übermittlung an die Auskunfteien erst ab 30.09.2026 (Beginn vor Ablauf der Widerrufsfrist nicht verlangt).";

  // ── die EINE Erkennung ──
  const PK = await person("Erklaerung");
  const K1 = await auskunft(PK, "Erklaerung", { tage: 20, erklaert: false });
  await notiz(K1, PK, "Kunde (Bestellseite)", "Bonitätsauskunft zahlungspflichtig bestellt über /bonitaet-antrag — Knopf „Zahlungspflichtig bestellen“ am 06.09.2026.", vorTagen(20));
  const K2 = await auskunft(PK, "Erklaerung", { tage: 20, erklaert: false });
  await notiz(K2, PK, "Daniel Stripling", "Bonitätsauskunft (74,00 €) auf Kundenwunsch aus der Akte bestellt — Verwendungszweck X.", vorTagen(20));
  await notiz(K2, PK, "System", "Offene Bonitätsauskunft zahlungspflichtig beauftragt (von einem System geschrieben — kein Kunde).", vorTagen(19));
  await notiz(K2, PK, "System", LIEFER, vorTagen(1));
  const K3 = await auskunft(PK, "Erklaerung", { tage: 20, erklaert: false });
  await notiz(K3, PK, "Kunde (Kauflink aus der E-Mail)", NICHT, vorTagen(3), true);  // zurückgenommen — zählt nicht
  const K4 = await auskunft(PK, "Erklaerung", { tage: 20, erklaert: false });
  await notiz(K4, PK, "Mara", NICHT, vorTagen(3));  // echte Wahl (egal wer schrieb): Erklärung
  const erk = new Map((await er.offeneBestellungen(sqlPool, 50, [K1, K2, K3, K4])).map((b) => [b.ref, b.erklaert]));
  ok("Erkennung: Bestellseite-Klick = erklärt; Betreuer/System-Notiz + Lieferungsnotiz = nicht; zurückgenommene Wahl = nicht; echte Wahl = erklärt",
    erk.get(K1) === true && erk.get(K2) === false && erk.get(K3) === false && erk.get(K4) === true, Object.fromEntries(erk));

  // ── Frage-Fälle ──
  const PF = await person("Frage"); await paket(PF, "Frage"); const F1 = await auskunft(PF, "Frage", { tage: 45, erklaert: false });
  const PFW = await person("FrageWien"); const F2 = await auskunft(PFW, "FrageWien", { tage: 12, erklaert: false, land: "AT" });
  const PFS = await person("FrageSperre", { werbesperre: true }); const F3 = await auskunft(PFS, "FrageSperre", { tage: 35, erklaert: false });
  const PFT = await person("FrageTeuer"); await paket(PFT, "FrageTeuer"); const F4 = await auskunft(PFT, "FrageTeuer", { tage: 20, erklaert: false, betrag: 149, pack: "auskunft_privat" });
  const PB = await person("Bezahlt"); await auskunft(PB, "Bezahlt", { tage: 40, status: "paid" }); const F5 = await auskunft(PB, "Bezahlt", { tage: 5 });
  const PKo = await person("Kopf"); const PKm = await person("KopfAlt");
  await sqlPool`UPDATE fiaon_persons SET merged_into_person_id = ${PKo} WHERE id = ${PKm}`;
  await auskunft(PKo, "Kopf", { tage: 30, status: "paid" }); const F6 = await auskunft(PKm, "KopfAlt", { tage: 6 });
  const PFE = await person("FrageEnde"); await paket(PFE, "FrageEnde"); const F7 = await auskunft(PFE, "FrageEnde", { tage: 60, erklaert: false });
  await sqlPool`UPDATE fiaon_applications SET auskunft_erinnerung_stufe = 6, auskunft_erinnerung_am = NOW() - INTERVAL '8 days' WHERE ref = ${F7}`;
  const PFM = await person("FrageMitte"); await paket(PFM, "FrageMitte"); const F8 = await auskunft(PFM, "FrageMitte", { tage: 52, erklaert: false });
  await sqlPool`UPDATE fiaon_applications SET auskunft_erinnerung_stufe = 5, auskunft_erinnerung_am = NOW() - INTERVAL '8 days' WHERE ref = ${F8}`;
  const FR = [F1, F2, F3, F4, F5, F6, F7, F8];
  const vorF = BREVO.length;
  const lF = await er.erinnerungLauf(MITTAG, { refs: FR });
  await warte(1500);
  ok("Lauf Frage: drei verschickt, alle drei als Frage (Frage, FrageWien, FrageMitte); FrageTeuer zurückgehalten",
    lF.versandt === 3 && lF.fragen === 3 && lF.zurueckgehalten === 1 && lF.mitBelehrung === 0, lF);
  for (const n of ["FrageSperre", "FrageTeuer", "Bezahlt", "KopfAlt", "Kopf", "FrageEnde"]) ok(`keine Mail an „${n}“`, mailsAn(n).length === 0);
  const mF = mailsAn("Frage")[0], mW = mailsAn("FrageWien")[0], mM = mailsAn("FrageMitte")[0];
  ok("Frage (Tag 45, nie gefragt): erste Nachfrage — Betreff aus dem Auftrag, Betrag, Satz „nicht mehr“, KEINE Bankdaten, kein Zahlungsseiten-Knopf",
    !!mF && mF.betreff === vorlage.FRAGE_BETREFF && /74,00 €/.test(mF.text) && mF.text.includes(vorlage.FRAGE_NICHT_MEHR_SATZ)
    && !/IBAN|BIC|GiroCode|\/zahlung\//.test(`${mF.html}${mF.text}`) && !/Vertragsbestätigung|danke für Ihre Bestellung|Widerrufsformular/i.test(`${mF.betreff}${mF.text}`), mF?.betreff);
  const href = (m?: BrevoMail) => (m?.html.match(/href="(https?:\/\/[^"]*\/auskunft\/bestellen\?[^"]*)"/)?.[1] ?? "").replace(/&amp;/g, "&");
  const linkF = href(mF);
  ok("Frage: Knopf = signierter Kauflink der Person", new URL(linkF || "https://x.invalid/").searchParams.get("p") === String(PF) && /sig=[0-9a-f]{32}/.test(linkF), linkF);
  ok("FrageWien (AT): Nachfrage, nie „SCHUFA“, KSV1870", !!mW && !/schufa/i.test(`${mW.betreff}${mW.html}${mW.text}`.replace(/FIAON-SCHUFA-/g, "")) && /KSV1870/.test(mW.text) && mW.betreff === vorlage.FRAGE_BETREFF, mW?.betreff);
  ok("FrageMitte (Stufe 5 vor 8 Tagen): zweite Dauer-Nachfrage (Stufe 6), Dauer-Betreff", !!mM && Number((await zeile(F8)).stufe) === 6 && /möchten Sie sie noch\?/.test(mM.betreff) && mM.betreff !== vorlage.FRAGE_BETREFF, mM?.betreff);
  const sF = await zeile(F1), sW = await zeile(F2), sT = await zeile(F4);
  ok("Marken: Frage Stufe 5 (erste Dauer-Nachfrage), FrageWien Stufe 3; FrageTeuer Stufe 0 mit Ruhe und Hinweis „kein Bestätigungsformular“",
    sF.stufe === 5 && sW.stufe === 3 && Number(sT.stufe || 0) === 0 && !!sT.ruhe && /Bestätigungsformular/.test(String(sT.hinweis)) && /anrufen oder stornieren/.test(String(sT.hinweis)), [sF.stufe, sW.stufe, sT.stufe, sT.hinweis]);
  const logF = (await sqlPool`
    SELECT (CASE WHEN jsonb_typeof(payload) = 'string' THEN (payload #>> '{}')::jsonb ELSE payload END) AS p
      FROM fiaon_mail_log WHERE event = 'auskunft_zahlung_erinnerung' AND person_id = ${PF}`) as any[];
  ok("Mail-Protokoll: Fassung „frage“, mit_belehrung „nein“, Kauflink verborgen", logF.length === 1 && logF[0].p?.fassung === "frage" && logF[0].p?.mit_belehrung === "nein" && logF[0].p?.kauf_url === "[verborgen]", logF.map((l) => l.p));
  const vF = (await sqlPool`SELECT note FROM fiaon_contact_log WHERE ref = ${F1} AND agent_name = 'System'`) as any[];
  ok("Verlauf: „Nachfrage zur Bestellung verschickt“, ohne Wahl-Marke und ohne Belehrungs-Vermerk", vF.length === 1 && /^Nachfrage zur Bestellung verschickt/.test(vF[0].note)
    && !vF[0].note.includes(AK.WIDERRUF_WAHL_MARKE) && !vF[0].note.includes(er.VERMERK_BELEHRUNG), vF.map((v) => v.note));
  ok("die Frage zählt nie als Belehrung", !(await er.belehrungProtokolliert(F1, `P${MARKE}`)) && (await er.belehrungNachgeholtAm(F1)) === null);
  const uF = await er.erinnerungUebersicht(MITTAG);
  const zF = (r: string) => uF.zeilen.get(r)!;
  ok("Übersicht: Fassung „frage“ an den Frage-Fällen, „erinnerung“ an „Bezahlt“; ohneErklaerung zählt sie",
    zF(F1).fassung === "frage" && zF(F2).fassung === "frage" && zF(F5).fassung === "erinnerung" && uF.ohneErklaerung >= 6 && zF(F1).stufeText === "Dauer-Nachfrage 1 von 2", [zF(F1), uF.ohneErklaerung]);
  ok("Übersicht: „bezahlt“ (auch an der Kopf-Person) mit Vorschlag stornieren", zF(F5).grundArt === "bezahlt" && zF(F5).stornieren && zF(F6).grundArt === "bezahlt" && zF(F6).stornieren, [zF(F5), zF(F6)]);
  ok("Übersicht: Werbesperre + ohne Erklärung → „stornieren?“", zF(F3).grundArt === "werbesperre_frage" && zF(F3).stornieren);
  ok("Übersicht: FrageEnde (zwei Dauer-Nachfragen durch) → keine nächste, Grund „Nachfragen beendet“", zF(F7).naechste === null && /Nachfragen beendet/.test(String(zF(F7).grund)), zF(F7));
  const tF = (await sqlPool`SELECT schluessel, titel, text FROM fiaon_betreiber_todos WHERE schluessel = ANY(${FR.map((r) => `auskunft:${r}:offen-30`)})`) as any[];
  const tE = tF.find((t) => t.schluessel.includes(F7)), tS = tF.find((t) => t.schluessel.includes(F3));
  ok("Aufgaben: FrageEnde „ohne Bestätigung — anrufen oder stornieren“ (keine Zahlungsseite), FrageSperre „stornieren?“; nicht Frage (eben gefragt), nicht FrageMitte (eben gefragt)",
    tF.length === 2 && !!tE && /ohne Bestätigung des Kunden — anrufen oder stornieren/.test(tE.titel) && /KEINE Zahlungsseite/.test(tE.text) && !/\/zahlung\//.test(tE.text)
    && !!tS && /stornieren\?/.test(tS.titel) && !/anrufen/.test(tS.titel), tF.map((t) => t.titel));

  // ── der Kauflink aus der Frage: Formular zu IHREM Betrag, Bestätigung → Erklärung → Erinnerung ──
  app.use(express.urlencoded({ extended: true }));
  app.use("/api/fiaon", (await import("../server/routes/fiaon-auskunft-kauf")).default);
  const lokal = linkF.replace(/^https?:\/\/[^/]+\/api\/fiaon/, basis);
  const gK = await echtFetch(lokal, { redirect: "manual" });
  const seiteK = await gK.text();
  ok("Kauflink GET: Formular (kein Sprung zur Zahlungsseite), Betrag 74,00 €, Pflicht-Haken", gK.status === 200 && /74(,00)? €/.test(seiteK) && /Zahlungspflichtig beauftragen/.test(seiteK), { status: gK.status, ort: gK.headers.get("location") });
  const pK = await echtFetch(lokal, { method: "POST", redirect: "manual", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "auftrag=ja" });
  ok("Kauflink POST (ohne Sofort-Haken): weiter zur Zahlungsseite DIESER Bestellung", pK.status === 303 && String(pK.headers.get("location")).includes(`/zahlung/P${MARKE}`), { status: pK.status, ort: pK.headers.get("location") });
  await warte(1500);  // die Vertragsbestätigung geht im Hintergrund (die Weiterleitung wartet nicht)
  const nachK = (await er.offeneBestellungen(sqlPool, 5, [F1]))[0];
  ok("nach der Bestätigung: erklärt → Fassung „Erinnerung“ (dieselbe Bestellung, keine neue)", !!nachK && nachK.erklaert && er.tuerUrteil(nachK).fassung === "erinnerung"
    && ((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_applications WHERE person_id = ${PF} AND type = 'schufa'`) as any[])[0].n === 1);
  // ── Nachbesserung (Gegenprüfung): die Vertragsbestätigung SOFORT nach der Bestätigung, nicht erst mit der nächsten Erinnerung ──
  const mBst = mailsAn("Frage")[1];
  ok("sofort nach der Bestätigung: Vertragsbestätigung mit Zahlungsdaten und nachgeholter Belehrung (nicht erst mit der nächsten Erinnerung)",
    !!mBst && mBst.betreff === vorlage.BESTAETIGUNG_BETREFF && /IBAN/.test(mBst.text) && mBst.text.includes(vorlage.NACHGEHOLT_FRIST_SATZ)
    && /Muster-Widerrufsformular/i.test(mBst.text) && mBst.text.includes(`P${MARKE}`), mBst?.betreff);
  ok("Vertragsbestätigung: „Von Ihnen bestätigt am“ heute, nie das Anlagedatum vor 45 Tagen",
    !!mBst && mBst.text.includes("Von Ihnen bestätigt am:") && mBst.text.includes(er.datumText(new Date())) && !mBst.text.includes(er.datumText(vorTagen(45))));
  const logB = (await sqlPool`
    SELECT (CASE WHEN jsonb_typeof(payload) = 'string' THEN (payload #>> '{}')::jsonb ELSE payload END) AS p
      FROM fiaon_mail_log WHERE event = 'auskunft_zahlung_erinnerung' AND person_id = ${PF} ORDER BY created_at`) as any[];
  const vB = (await sqlPool`SELECT note FROM fiaon_contact_log WHERE ref = ${F1} AND note LIKE ${`${er.VERMERK_BESTAETIGUNG}%`}`) as any[];
  const zB = (await sqlPool`SELECT auskunft_bestaetigung_am AS b, auskunft_erinnerung_am AS am, auskunft_erinnerung_stufe AS stufe FROM fiaon_applications WHERE ref = ${F1}`) as any[];
  ok("Protokoll: Mail-Protokoll fassung „bestaetigung“ mit_belehrung „ja“; Verlauf mit Belehrungs-Vermerk; Marke gesetzt, Stufe unverändert",
    logB.length === 2 && logB[1].p?.fassung === "bestaetigung" && logB[1].p?.mit_belehrung === "ja" && vB.length === 1 && vB[0].note.includes(er.VERMERK_BELEHRUNG)
    && !!zB[0].b && Date.now() - new Date(zB[0].am).getTime() < 60_000 && Number(zB[0].stufe) === 5, { logB: logB.map((l) => l.p?.fassung), vB, zB });
  ok("Belehrung gilt jetzt als protokolliert (die nächste Erinnerung trägt sie nicht noch einmal)", await er.belehrungProtokolliert(F1, null));
  const zweit = await er.bestaetigungNachErklaerung(F1, "kauflink");
  const pK2 = await echtFetch(lokal, { method: "POST", redirect: "manual", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "auftrag=ja" });
  await warte(800);
  ok("einmal je Bestellung: zweiter Aufruf „schon verschickt“, zweiter Klick schickt keine zweite", !zweit.versandt && /schon/.test(zweit.grund) && pK2.status === 303
    && mailsAn("Frage").length === 2, { zweit, n: mailsAn("Frage").length });
  const wK = await LF.auskunftWiderrufStand(F1);
  const belehrt0 = await er.belehrungNachgeholtAm(F1);
  ok("Widerrufsstand nach der Bestätigung: „nicht verlangt“, Frist ab Zugang der Vertragsbestätigung (+1 Tag) — nicht ab der Anlage vor 45 Tagen",
    !!belehrt0 && wK.verlangt === false && wK.ab === LF.anforderungAb(new Date(belehrt0.getTime() + 86_400_000)) && wK.warten, { wK, belehrt0 });
  await sqlPool`UPDATE fiaon_applications SET auskunft_erinnerung_am = NOW() - INTERVAL '8 days' WHERE ref = ${F1}`;
  // Eine Woche später — auch für den Tagesdeckel je Empfänger (Frage + Vertragsbestätigung liefen heute).
  await sqlPool`UPDATE fiaon_mail_log SET created_at = created_at - INTERVAL '8 days' WHERE person_id = ${PF}`;
  const lK = await er.erinnerungLauf(MITTAG, { refs: [F1] });
  await warte(1200);
  const mK = mailsAn("Frage")[2];
  ok("danach die Zahlungserinnerung — OHNE zweite Belehrung (sie ging mit der Vertragsbestätigung)", lK.versandt === 1 && lK.fragen === 0 && lK.mitBelehrung === 0
    && !!mK && !/Vertragsbestätigung/.test(mK.betreff) && /IBAN/.test(mK.text) && !mK.text.includes(vorlage.NACHGEHOLT_FRIST_SATZ), { lK, b: mK?.betreff, h: (await zeile(F1)).hinweis });

  // ── Nachbesserung (Gegenprüfung): Bestellung durch den Betreuer — keine Zahlungsdaten, sofort die Frage ──
  const PBt = await person("Betreuer"); await paket(PBt, "Betreuer");
  const vorBt = BREVO.length;
  const bBt = await AK.auskunftBestellen({ personId: PBt, quelle: "betreuer", von: "Prüf-Betreuer", agentId: null });
  if (bBt.ref) refs.push(bBt.ref);
  await warte(1500);
  const mBt = BREVO.slice(vorBt).filter((m) => m.an === adresse("Betreuer"));
  const zBt = ((await sqlPool`SELECT payment_status, payment_email_sent_at, auskunft_erinnerung_stufe AS stufe, invoice_number FROM fiaon_applications WHERE ref = ${bBt.ref}`) as any[])[0];
  const pdBt = (await sqlPool`SELECT 1 FROM fiaon_mail_log WHERE event = 'payment_details' AND person_id = ${PBt}`) as any[];
  ok("Betreuer legt an: neue Bestellung, ohneKundenerklaerung, Frage verschickt", bBt.ok && bBt.art === "neu" && bBt.ohneKundenerklaerung === true && bBt.frageVersandt === true, bBt);
  ok("Betreuer: KEINE Zahlungsdaten (payment_details) — genau EINE Mail, die Frage „frisch“ ohne Bankdaten, Knopf auf den Kauflink",
    pdBt.length === 0 && mBt.length === 1 && mBt[0].betreff === vorlage.FRAGE_BETREFF_FRISCH && !/IBAN|\/zahlung\//.test(`${mBt[0].html}${mBt[0].text}`)
    && /auskunft\/bestellen\?/.test(mBt[0].html), mBt.map((m) => m.betreff));
  ok("Betreuer: Zeile offen mit Rechnungsnummer, payment_email_sent_at gesetzt, Marke Stufe 1", zBt?.payment_status === "pending_payment" && !!zBt?.payment_email_sent_at && Number(zBt?.stufe) === 1, zBt);
  const vBt = ((await sqlPool`SELECT note FROM fiaon_contact_log WHERE ref = ${bBt.ref} ORDER BY id`) as any[]).map((z) => String(z.note));
  ok("Betreuer: Verlauf „Zahlungsdaten NICHT verschickt“ + „Nachfrage … beim Anlegen“, kein „Erste Rechnung gestellt“",
    vBt.some((n) => n.startsWith(er.VERMERK_ZAHLUNGSDATEN_ZURUECK)) && vBt.some((n) => /^Nachfrage zur Bestellung verschickt: 1\. Nachfrage \(Tag 1\) beim Anlegen/.test(n))
    && !vBt.some((n) => /Erste Rechnung gestellt/.test(n)), vBt);
  const lBt = await er.erinnerungLauf(MITTAG, { refs: [bBt.ref!] });
  const uBt = (await er.erinnerungUebersicht(MITTAG)).zeilen.get(bBt.ref!);
  ok("Betreuer: am selben Tag keine zweite Mail; nächste Nachfrage Tag 4", lBt.versandt === 0 && uBt?.fassung === "frage" && uBt?.naechste === plusTage(HEUTE, 4), { lBt, uBt });
  // der Kunde bestätigt über den Knopf der Frage → sofort die Vertragsbestätigung
  const linkBt = href(mBt[0]).replace(/^https?:\/\/[^/]+\/api\/fiaon/, basis);
  const gBt = await echtFetch(linkBt, { redirect: "manual" });
  const pBt = await echtFetch(linkBt, { method: "POST", redirect: "manual", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "auftrag=ja&sofort=ja" });
  await warte(1500);
  const mBt2 = BREVO.slice(vorBt).filter((m) => m.an === adresse("Betreuer"));
  ok("Betreuer-Bestellung bestätigt (sofort verlangt): Formular, dann Zahlungsseite, sofort die Vertragsbestätigung mit Belehrung",
    gBt.status === 200 && pBt.status === 303 && mBt2.length === 2 && mBt2[1].betreff === vorlage.BESTAETIGUNG_BETREFF && mBt2[1].text.includes(vorlage.NACHGEHOLT_FRIST_SATZ),
    { g: gBt.status, p: pBt.status, b: mBt2.map((m) => m.betreff) });
  ok("… und ist danach erklärt, „verlangt“", (await er.offeneBestellungen(sqlPool, 5, [bBt.ref!]))[0]?.erklaert === true && (await LF.auskunftWiderrufStand(bBt.ref!)).verlangt === true);
  // Firma über den Betreuer: unverändert Zahlungsdaten (kein Bestätigungsformular für Firmen)
  const PBf = await person("BetreuerFirma"); await paket(PBf, "BetreuerFirma");
  const bBf = await AK.auskunftBestellen({ personId: PBf, art: "firma", quelle: "betreuer", von: "Prüf-Betreuer", agentId: null });
  if (bBf.ref) refs.push(bBf.ref);
  await warte(1500);
  ok("Betreuer, Firma: wie bisher Zahlungsdaten (kein Formular für Firmen), keine Frage", bBf.ok && bBf.art === "neu" && !bBf.ohneKundenerklaerung
    && mailsAn("BetreuerFirma").length === 1 && !/bestätigen Sie/.test(mailsAn("BetreuerFirma")[0]?.betreff ?? ""), { bBf, b: mailsAn("BetreuerFirma").map((m) => m.betreff) });
  // Kunde selbst (Kaufkarte): unverändert Zahlungsdaten
  const PKk = await person("Kaufkarte"); await paket(PKk, "Kaufkarte");
  const bKk = await AK.auskunftBestellen({ personId: PKk, quelle: "kundenbereich", von: "Kunde (Kundenbereich)" });
  if (bKk.ref) refs.push(bKk.ref);
  await warte(4500);  // die Anreicherung wartet bei einer frischen Bestellung bis rund drei Sekunden auf die Wahl
  ok("Kunde selbst (Kundenbereich): wie bisher Zahlungsdaten mit Vertragsbestätigung, keine Frage", bKk.ok && !bKk.ohneKundenerklaerung
    && mailsAn("Kaufkarte").length === 1 && /Zahlungs|Vertrag|Auskunft/.test(mailsAn("Kaufkarte")[0]?.betreff ?? "") && mailsAn("Kaufkarte")[0]?.betreff !== vorlage.FRAGE_BETREFF_FRISCH,
    mailsAn("Kaufkarte").map((m) => m.betreff));

  // ── Bestellseite: dieselbe Vertragsbestätigung, wenn sie eine alte Bestellung ohne Erklärung wiederverwendet ──
  const { AUSKUNFT_BESCHAFFUNGSAUFTRAG_TEXT } = await import("../shared/fiaon-auskunft");
  const zust = { zustimmungen: { seite: "/bonitaet-antrag", knopf: "Zahlungspflichtig bestellen", bestelltAm: new Date().toISOString(), fassung: "2026-09-25b",
    preis: { text: "74,00 €", mitAbo: true, steuer: "Endpreis" }, verbraucher: true, land: "DE",
    punkte: [{ schluessel: "beschaffungsauftrag", text: AUSKUNFT_BESCHAFFUNGSAUFTRAG_TEXT("privat"), zugestimmt: true, am: new Date().toISOString() }] } };
  const PBs = await person("Bestellseite"); await paket(PBs, "Bestellseite");
  const Bs1 = await auskunft(PBs, "Bestellseite", { tage: 20, erklaert: false });
  await AK.auskunftBestellungBelegen(Bs1, zust, { ip: "127.0.0.1", ua: "Prüfstand" });
  await warte(1500);
  ok("Bestellseite bestätigt eine 20 Tage alte Bestellung ohne Erklärung: sofort die Vertragsbestätigung", mailsAn("Bestellseite").length === 1
    && mailsAn("Bestellseite")[0].betreff === vorlage.BESTAETIGUNG_BETREFF, mailsAn("Bestellseite").map((m) => m.betreff));
  const PBn = await person("BestellseiteNeu"); await paket(PBn, "BestellseiteNeu");
  const Bs2 = await auskunft(PBn, "BestellseiteNeu", { tage: 0, erklaert: false });
  await sqlPool`UPDATE fiaon_applications SET created_at = NOW() WHERE ref = ${Bs2}`;
  await AK.auskunftBestellungBelegen(Bs2, zust, { ip: "127.0.0.1", ua: "Prüfstand" });
  await warte(800);
  ok("Bestellseite, eben angelegte Bestellung: keine zweite Bestätigung (die hat payment_details)", mailsAn("BestellseiteNeu").length === 0);

  // ── Werbesperre der Frage: auch an der Kopf-Person und an der Adresse ──
  const PWk = await person("SperreKopf", { werbesperre: true }); const PWa = await person("SperreKopfAlt");
  await sqlPool`UPDATE fiaon_persons SET merged_into_person_id = ${PWk} WHERE id = ${PWa}`;
  const Wk1 = await auskunft(PWa, "SperreKopfAlt", { tage: 12, erklaert: false });
  const PAd = await person("SperreAdresse"); await paket(PAd, "SperreAdresse");
  const Ad1 = await auskunft(PAd, "SperreAdresse", { tage: 12, erklaert: false });
  const PAx = await person("SperreAdresseAnders", { werbesperre: true });
  await sqlPool`UPDATE fiaon_persons SET primary_email = ${adresse("SperreAdresse")} WHERE id = ${PAx}`;
  const uW = await er.offeneBestellungen(sqlPool, 5, [Wk1]);
  const lSp = await er.erinnerungLauf(MITTAG, { refs: [Wk1, Ad1] });
  ok("Werbesperre an der Kopf-Person: „stornieren?“ (keine Frage)", er.tuerUrteil(uW[0]).grund === "werbesperre_frage", er.tuerUrteil(uW[0]));
  ok("Werbesperre eines anderen Menschen an derselben Adresse: Frage zurückgehalten mit Hinweis", lSp.versandt === 0 && mailsAn("SperreAdresse").length === 0
    && /Werbesperre an dieser E-Mail-Adresse/.test(String((await zeile(Ad1)).hinweis)), { lSp, h: (await zeile(Ad1)).hinweis });

  // ── zurückgehaltene Frage: ab Tag 30 einmal die Aufgabe ──
  const PZt = await person("FrageTeuer30"); await paket(PZt, "FrageTeuer30");
  const Zt = await auskunft(PZt, "FrageTeuer30", { tage: 35, erklaert: false, betrag: 149, pack: "auskunft_privat" });
  const lZ1 = await er.erinnerungLauf(MITTAG, { refs: [Zt] });
  await sqlPool`UPDATE fiaon_applications SET auskunft_erinnerung_ruhe_bis = NULL WHERE ref = ${Zt}`;
  const lZ2 = await er.erinnerungLauf(MITTAG, { refs: [Zt] });
  const tZ = (await sqlPool`SELECT titel, text FROM fiaon_betreiber_todos WHERE schluessel = ${`auskunft:${Zt}:offen-30`}`) as any[];
  ok("zurückgehaltene Frage (Tag 35, Kauflink zeigt kein Formular): Aufgabe „ohne Bestätigung — anrufen oder stornieren“ mit dem Grund, ohne Zahlungsseite",
    lZ1.zurueckgehalten === 1 && lZ2.aufgaben === 1 && tZ.length === 1 && /ohne Bestätigung des Kunden — anrufen oder stornieren/.test(tZ[0].titel)
    && /zurückgehalten/.test(tZ[0].text) && !/\/zahlung\//.test(tZ[0].text) && !/Kaufkarte/.test(tZ[0].text), { lZ1, lZ2, tZ });
  ok("rein: frageZurueckgehalten nur mit Hinweis und Stufe 0", er.frageZurueckgehalten({ stufe: 0, hinweis: "x" }, { erinnern: true, fassung: "frage" } as any)
    && !er.frageZurueckgehalten({ stufe: 1, hinweis: "x" }, { erinnern: true, fassung: "frage" } as any) && !er.frageZurueckgehalten({ stufe: 0, hinweis: null }, { erinnern: true, fassung: "frage" } as any));
  ok("Aufgabentext der Frage nennt keine Kaufkarte mehr", !/Kaufkarte/.test(lies("server/lib/fiaon-auskunft-erinnerung.ts").slice(lies("server/lib/fiaon-auskunft-erinnerung.ts").indexOf("async function aufgabeAnlegen"))));

  // ── auskunftWiderrufStand: nur echte Wahl-Sätze, Einstufung jüngste, Beginn erste ──
  const PW = await person("Widerruf");
  const W1 = await auskunft(PW, "Widerruf", { tage: 30, erklaert: false });
  await notiz(W1, PW, "Kunde (Kauflink aus der E-Mail)", NICHT, vorTagen(20));
  await notiz(W1, PW, "System", LIEFER, vorTagen(1));
  const w1 = await LF.auskunftWiderrufStand(W1);
  ok("Systemnotiz der Lieferung zählt NICHT als Wahl: Frist ab der Wahl vor 20 Tagen (vorbei), nicht ab dem Liefertag", w1.verlangt === false && w1.ab === LF.anforderungAb(vorTagen(20)) && !w1.warten, w1);
  await notiz(W1, PW, "Kunde (Kundenbereich)", NICHT, vorTagen(5));
  const w1b = await LF.auskunftWiderrufStand(W1);
  ok("zweite Wahl „nicht verlangt“ (vor 5 Tagen): Fristbeginn bleibt die ERSTE", w1b.ab === LF.anforderungAb(vorTagen(20)) && !w1b.warten, w1b);
  const W2 = await auskunft(PW, "Widerruf", { tage: 30, erklaert: false });
  await notiz(W2, PW, "Kunde (Kauflink aus der E-Mail)", NICHT, vorTagen(20));
  await notiz(W2, PW, "Kunde (Kundenbereich)", VERL, vorTagen(3));
  ok("Einstufung aus der JÜNGSTEN Wahl (verlangt)", (await LF.auskunftWiderrufStand(W2)).verlangt === true);
  const W3 = await auskunft(PW, "Widerruf", { tage: 30, erklaert: false });
  await notiz(W3, PW, "Kunde (Kauflink aus der E-Mail)", VERL, vorTagen(3), true);
  await notiz(W3, PW, "Kunde (Kauflink aus der E-Mail)", NICHT, vorTagen(4));
  ok("zurückgenommene Wahl zählt nicht", (await LF.auskunftWiderrufStand(W3)).verlangt === false);
  const W4 = await auskunft(PW, "Widerruf", { tage: 30, erklaert: false });
  await notiz(W4, PW, "Kunde (Kauflink aus der E-Mail)", NICHT, vorTagen(20));
  await notiz(W4, PW, "System", `Zahlungserinnerung verschickt: Dauererinnerung 2 an x — ${er.VERMERK_BELEHRUNG} (Textform). Betrag 74,00 €.`, vorTagen(2));
  const w4 = await LF.auskunftWiderrufStand(W4);
  ok("nachgeholte Belehrung (Verlauf) vor 2 Tagen: Frist ab Belehrung + 1 Tag → wartet", w4.ab === LF.anforderungAb(new Date(vorTagen(2).getTime() + 86_400_000)) && w4.warten, w4);
  const W5 = await auskunft(PW, "Widerruf", { tage: 30, erklaert: false });
  await notiz(W5, PW, "Kunde (Kauflink aus der E-Mail)", NICHT, vorTagen(20));
  await sqlPool`INSERT INTO fiaon_mail_log (event, person_id, empfaenger, status, art, payload, created_at)
                VALUES ('auskunft_zahlung_erinnerung', ${PW}, ${adresse("Widerruf")}, 'versandt', 'echt', ${sqlPool.json(JSON.stringify({ antrag_id: W5, mit_belehrung: "ja" }) as any)}, ${vorTagen(3)})`;
  const w5 = await LF.auskunftWiderrufStand(W5);
  ok("nachgeholte Belehrung nur im Mail-Protokoll (jsonb als Text) vor 3 Tagen: Frist ab dort + 1 Tag", w5.ab === LF.anforderungAb(new Date(vorTagen(3).getTime() + 86_400_000)) && w5.warten, w5);
  // auskunftStand/offenOhneWahl: die Lieferungsnotiz allein ist keine Wahl
  const PS = await person("StandWahl"); const S1 = await auskunft(PS, "StandWahl", { tage: 30, erklaert: false });
  await notiz(S1, PS, "System", LIEFER, vorTagen(1));
  const st1 = await AK.auskunftStand(PS, sqlPool, "privat", { land: false });
  ok("auskunftStand: nur die Lieferungsnotiz → wahlDa false, offenOhneWahl (Formular) true", st1.offen?.ref === S1 && st1.offen?.wahlDa === false && AK.offenOhneWahl(st1), st1.offen);

  // ── Chefseite: Fassung sichtbar ──
  const gF = await holen("/chef/auskunft");
  const zeileF = (gF.json?.offen ?? []).find((o: any) => o.ref === F2);
  ok("GET /chef/auskunft: Zeile trägt fassung „frage“, Karte zählt „bestätigen lassen“", zeileF?.erinnerung?.fassung === "frage" && Number(gF.json?.erinnerung?.ohneErklaerung) >= 1, { e: zeileF?.erinnerung, n: gF.json?.erinnerung?.ohneErklaerung });
} finally {
  server?.close();
  const muster = `${klein}-%`;
  await sqlPool`DELETE FROM fiaon_mail_log WHERE person_id = ANY(${ids}) OR LOWER(empfaenger) LIKE ${muster}`;
  await sqlPool`DELETE FROM fiaon_contact_log WHERE person_id = ANY(${ids}) OR ref = ANY(${refs})`;
  await sqlPool`DELETE FROM fiaon_betreiber_todos WHERE schluessel LIKE ${`auskunft:FIAON-SCHUFA-PRUEF${MARKE}%`}`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_dokumente WHERE person_id = ANY(${ids})`;
  await sqlPool`DELETE FROM fiaon_auskunft_klicks WHERE person_id = ANY(${ids})`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_betreiber_todos WHERE schluessel LIKE ${`auskunft:FIAON-SCHUFA-%`} AND schluessel = ANY(${refs.map((r) => `auskunft:${r}:offen-30`)})`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_applications WHERE person_id = ANY(${ids}) OR ref = ANY(${refs})`;
  await sqlPool`DELETE FROM fiaon_persons WHERE id = ANY(${ids})`;
  await sqlPool`DELETE FROM fiaon_admin_log WHERE agent_id = 9001 AND zeit >= ${start}`.catch(() => {});
  // Der Brevo-Streik (Fehlschlag-Fall) meldet sich als Diagnose „mail_direkt_fehler" — die Adresse steht dort maskiert
  // („e2***@pruef.invalid"), deshalb über Ereignis, Prüf-Domain und Zeitraum (nur dieser Prüfstand sendet das Ereignis dorthin).
  await sqlPool`DELETE FROM fiaon_diagnostics WHERE code = 'mail_direkt_fehler' AND created_at >= ${start}
                  AND message LIKE '%auskunft_zahlung_erinnerung%' AND message LIKE '%@pruef.invalid%'`.catch(() => {});
  for (const k of EIGENE) await sqlPool`DELETE FROM fiaon_settings WHERE key = ${k}`;
  for (const a of alteEinstellungen) await setze(String(a.key), String(a.value));
  const rest = ((await sqlPool`SELECT (SELECT COUNT(*) FROM fiaon_persons WHERE id = ANY(${ids}))::int AS p,
    (SELECT COUNT(*) FROM fiaon_applications WHERE ref = ANY(${refs}))::int AS a,
    (SELECT COUNT(*) FROM fiaon_mail_log WHERE person_id = ANY(${ids}))::int AS m,
    (SELECT COUNT(*) FROM fiaon_betreiber_todos WHERE schluessel LIKE ${`auskunft:FIAON-SCHUFA-PRUEF${MARKE}%`})::int AS t,
    (SELECT COUNT(*) FROM fiaon_diagnostics WHERE created_at >= ${start} AND message LIKE '%auskunft_zahlung_erinnerung%' AND message LIKE '%@pruef.invalid%')::int AS d`) as any[])[0];
  console.log(`\nAufgeräumt (Marke ${MARKE}): ${ids.length} Menschen, ${refs.length} Bestellungen — übrig ${JSON.stringify(rest)}`);
  console.log(`Brevo-Attrappe: ${BREVO.length} Mails angenommen; fremde Netzaufrufe: ${FREMD.length}${FREMD.length ? ` (${FREMD.slice(0, 3).join(", ")})` : ""}`);
  console.log(`\n${gruen} von ${gruen + rot} Prüfungen bestanden${rot ? ` — ${rot} FEHLER:\n  · ${fehler.join("\n  · ")}` : ""}.`);
  await (sqlPool as any).end?.({ timeout: 2 }).catch(() => {});
  process.exit(rot || FREMD.length ? 1 : 0);
}
