/**
 * ═══════════════════════════════════════════════════════════════════
 * GRUSS + BERLIN-STUNDE — PRÜFUNG MIT FESTEN UHRZEITEN (nur rechnend)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Prüft die Tageszeit-Erkennung an festgelegten Zeitpunkten, statt sie
 * „gerade mal auszuprobieren". Der Fehler vom 28.07.2026 (um 09:30 Uhr
 * stand „Guten Abend" auf der Startseite) war genau deshalb unentdeckt:
 * Getestet wurde abends — da war das falsche Ergebnis zufällig richtig.
 *
 * Abgedeckt: Tagesgrenzen, Mitternacht, beide Zeitumstellungen, Sicht aus
 * einer anderen Zeitzone (Bangkok, Wien) und nicht bestimmbare Stunden.
 *
 * Verwendung: npx tsx scripts/gruss-test.ts     (Laufzeit < 1 s)
 * Hartes Zeitlimit: 60 s.
 */

import { berlinStunde, grussFuerStunde, gruss, monatName } from "../client/src/pages/agent/zeit";

const abbruch = setTimeout(() => {
  console.error("⏱  Zeitlimit 60 s erreicht — Abbruch.");
  process.exit(3);
}, 60_000);

let fehler = 0;
function pruefe(titel: string, ist: unknown, soll: unknown, hinweis = "") {
  const ok = ist === soll;
  if (!ok) fehler++;
  console.log(`${ok ? "✅" : "❌"} ${titel}`);
  if (!ok) console.log(`     erwartet „${soll}", bekommen „${ist}"`);
  else if (hinweis) console.log(`     ${hinweis}`);
}

// ── 1. Der gemeldete Fall: 09:30 Uhr österreichische Zeit = 09:30 Berlin ────
// (Österreich und Deutschland liegen in derselben Zeitzone.)
const morgens = new Date("2026-07-28T07:30:00Z"); // 09:30 Berlin (Sommerzeit)
pruefe("09:30 Berlin → Stunde", berlinStunde(morgens), 9);
pruefe("09:30 Berlin → Gruß", gruss(morgens), "Guten Morgen", "der gemeldete Fehlerfall");

// ── 2. Grenzen: 5–11 Morgen, 11–18 Tag, 18–5 Abend ─────────────────────────
const berlinSommer = (stunde: number, minute = 0) =>
  new Date(Date.UTC(2026, 6, 15, stunde - 2, minute)); // Juli: Berlin = UTC+2

const grenzen: [number, string][] = [
  [4, "Guten Abend"],   // 04:59 gehört noch zur Nacht
  [5, "Guten Morgen"],  // Grenze
  [10, "Guten Morgen"],
  [11, "Guten Tag"],    // Grenze
  [17, "Guten Tag"],
  [18, "Guten Abend"],  // Grenze
  [23, "Guten Abend"],
];
for (const [h, soll] of grenzen) {
  pruefe(`${String(h).padStart(2, "0")}:00 Berlin`, gruss(berlinSommer(h)), soll);
}
pruefe("04:59 Berlin", gruss(berlinSommer(4, 59)), "Guten Abend");
pruefe("10:59 Berlin", gruss(berlinSommer(10, 59)), "Guten Morgen");
pruefe("17:59 Berlin", gruss(berlinSommer(17, 59)), "Guten Tag");

// ── 3. Mitternacht: keine „24", kein Durchfall ─────────────────────────────
pruefe("00:00 Berlin → Stunde", berlinStunde(new Date("2026-07-15T22:00:00Z")), 0);
pruefe("00:00 Berlin → Gruß", gruss(new Date("2026-07-15T22:00:00Z")), "Guten Abend");
pruefe("00:30 Berlin → Stunde", berlinStunde(new Date("2026-07-15T22:30:00Z")), 0);

// ── 4. Zeitumstellung (der eigentliche Grund für Europe/Berlin) ────────────
// Winterzeit: Berlin = UTC+1
pruefe("Winter 09:30 Berlin (08:30 UTC)", berlinStunde(new Date("2026-01-15T08:30:00Z")), 9);
pruefe("Winter Gruß", gruss(new Date("2026-01-15T08:30:00Z")), "Guten Morgen");
// Umstellung Sommerzeit 2026: 29.03., 02:00 → 03:00 Berlin
pruefe("Sommerzeit-Beginn 01:30 (00:30 UTC)", berlinStunde(new Date("2026-03-29T00:30:00Z")), 1);
pruefe("Sommerzeit-Beginn 03:30 (01:30 UTC)", berlinStunde(new Date("2026-03-29T01:30:00Z")), 3);
// Umstellung Winterzeit 2026: 25.10., 03:00 → 02:00 Berlin
pruefe("Winterzeit-Ende 02:30 Sommer (00:30 UTC)", berlinStunde(new Date("2026-10-25T00:30:00Z")), 2);
pruefe("Winterzeit-Ende 02:30 Winter (01:30 UTC)", berlinStunde(new Date("2026-10-25T01:30:00Z")), 2);

// ── 5. Andere Zeitzone des Betrachters ändert NICHTS ──────────────────────
// Der Zeitpunkt ist absolut; die Prozess-Zeitzone darf nicht durchschlagen.
const alt = process.env.TZ;
for (const tz of ["Asia/Bangkok", "Europe/Vienna", "America/New_York", "UTC"]) {
  process.env.TZ = tz;
  pruefe(`Sicht aus ${tz}`, gruss(morgens), "Guten Morgen");
}
process.env.TZ = alt;

// ── 6. Unbestimmbare Stunde ⇒ neutraler Gruß, NIE „Abend" ─────────────────
pruefe("Ungültiges Datum → Stunde", berlinStunde(new Date("kaputt")), null);
pruefe("Ungültiges Datum → Gruß", gruss(new Date("kaputt")), "Hallo");
pruefe("null → Gruß", grussFuerStunde(null), "Hallo");
pruefe("NaN → Gruß", grussFuerStunde(Number.NaN), "Hallo");
pruefe("99 → Gruß", grussFuerStunde(99), "Hallo");
pruefe("-1 → Gruß", grussFuerStunde(-1), "Hallo");

// ── 7. Monatsname (steht unter dem Kontostand) ────────────────────────────
pruefe("Monat Juli", monatName(new Date("2026-07-15T10:00:00Z")), "Juli");
pruefe("Monat März", monatName(new Date("2026-03-15T10:00:00Z")), "März");
// 01.01. um 00:30 Berlin ist in UTC noch der 31.12. — der Monat muss der
// deutsche sein, nicht der UTC-Monat.
pruefe("Jahreswechsel 00:30 Berlin", monatName(new Date("2025-12-31T23:30:00Z")), "Januar");

// ── 8. GLEICHE FEHLERKLASSE IM VERSANDFENSTER? ────────────────────────────
// Nachfass-Engine und Zahlungserinnerungen entscheiden mit berlinHour()
// (server/routes/fiaon-antrag.ts, server/routes/fiaon-leads.ts), ob gerade
// versendet werden darf (hartes Fenster 08–20 Uhr Berlin). Hier wird GENAU
// dieses Muster mit festen Zeitpunkten nachgerechnet — ohne den Server zu
// starten. Ergebnis wird im Bericht genannt, auch wenn alles stimmt.
function serverBerlinHour(at: Date): number {
  const parts = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", hour12: false }).formatToParts(at);
  const h = parseInt(parts.find((p) => p.type === "hour")?.value || "", 10);
  return Number.isFinite(h) ? h % 24 : new Date().getUTCHours();
}
const imFenster = (at: Date) => {
  const h = serverBerlinHour(at);
  return h >= 8 && h < 20;
};

console.log("\n── Versandfenster (Server-Muster, hart 08–20 Uhr Berlin) ──");
pruefe("Server-Stunde 09:30 Sommer", serverBerlinHour(new Date("2026-07-28T07:30:00Z")), 9);
pruefe("Server-Stunde 09:30 Winter", serverBerlinHour(new Date("2026-01-15T08:30:00Z")), 9);
pruefe("Server-Stunde Mitternacht", serverBerlinHour(new Date("2026-07-15T22:00:00Z")), 0);
pruefe("07:59 Berlin → kein Versand", imFenster(new Date("2026-07-15T05:59:00Z")), false);
pruefe("08:00 Berlin → Versand", imFenster(new Date("2026-07-15T06:00:00Z")), true);
pruefe("19:59 Berlin → Versand", imFenster(new Date("2026-07-15T17:59:00Z")), true);
pruefe("20:00 Berlin → kein Versand", imFenster(new Date("2026-07-15T18:00:00Z")), false);
pruefe("03:00 Berlin → kein Versand", imFenster(new Date("2026-07-15T01:00:00Z")), false);
// Winterzeit: Berlin = UTC+1 — die Grenzen verschieben sich in UTC mit.
pruefe("Winter 08:00 Berlin → Versand", imFenster(new Date("2026-01-15T07:00:00Z")), true);
pruefe("Winter 07:59 Berlin → kein Versand", imFenster(new Date("2026-01-15T06:59:00Z")), false);

clearTimeout(abbruch);
if (fehler > 0) {
  console.error(`\n❌ ${fehler} Prüfung(en) fehlgeschlagen.`);
  process.exit(1);
}
console.log("\n✅ Tageszeit und Gruß stimmen zu allen geprüften Zeitpunkten.");
