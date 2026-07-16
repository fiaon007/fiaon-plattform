// Ticket #13 — Regressionstest Zeitzone. KEIN DB-Zugriff nötig.
// Prüft, dass eine naive datetime-local-Eingabe („2026-07-15T12:30") als
// Europe/Berlin-Wandzeit interpretiert und als korrekter UTC-Zeitpunkt gespeichert
// wird — unabhängig von der Server-Zeitzone (Render=UTC) oder dem Standort des
// Betrachters (Bangkok). Zusätzlich Sommer-/Winterzeit (DST) und Anzeige.
// Aufruf: npx tsx scripts/test-berlin-time.ts
import { parseBerlinInput, berlinOffsetMinutes, formatBerlin } from "../server/lib/fiaon-time";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log(`  PASS  ${name}${detail ? `  → ${detail}` : ""}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? `  → ${detail}` : ""}`); }
}

// 1) Sommerzeit: 15.07.2026 12:30 Berlin (CEST, UTC+2) → 10:30 UTC.
const summer = parseBerlinInput("2026-07-15T12:30");
check("Sommer: 12:30 Berlin = 10:30 UTC", summer?.toISOString() === "2026-07-15T10:30:00.000Z", summer?.toISOString());

// 2) Winterzeit: 15.01.2026 12:30 Berlin (CET, UTC+1) → 11:30 UTC.
const winter = parseBerlinInput("2026-01-15T12:30");
check("Winter: 12:30 Berlin = 11:30 UTC", winter?.toISOString() === "2026-01-15T11:30:00.000Z", winter?.toISOString());

// 3) Reines Datum → 00:00 Berlin.
const dateOnly = parseBerlinInput("2026-07-15");
check("Datum ohne Zeit = 00:00 Berlin (=22:00 UTC Vortag)", dateOnly?.toISOString() === "2026-07-14T22:00:00.000Z", dateOnly?.toISOString());

// 4) Bereits mit Zeitzone (Z) → unverändert absolut.
const withZ = parseBerlinInput("2026-07-15T10:30:00.000Z");
check("ISO mit Z bleibt absoluter Zeitpunkt", withZ?.toISOString() === "2026-07-15T10:30:00.000Z", withZ?.toISOString());

// 5) Leere/ungültige Eingabe → null.
check("leer → null", parseBerlinInput("") === null);
check("null → null", parseBerlinInput(null) === null);

// 6) Offset-Funktion: Juli = +120 Min, Januar = +60 Min.
check("Offset Juli = 120 Min", berlinOffsetMinutes(new Date("2026-07-15T10:30:00Z")) === 120);
check("Offset Januar = 60 Min", berlinOffsetMinutes(new Date("2026-01-15T11:30:00Z")) === 60);

// 7) Der Rückruf-Reminder feuert am korrekten absoluten Zeitpunkt: Der Abstand
//    zwischen gespeichertem UTC-Instant und „jetzt" ist DST-unabhängig korrekt.
//    (Wir prüfen: 12:30 Berlin im Sommer entspricht wirklich 10:30 UTC.)
check("Reminder-Instant korrekt (Sommer)", summer?.getUTCHours() === 10 && summer?.getUTCMinutes() === 30);

// 8) Anzeige immer Berlin, egal welche „Betrachter"-TZ: formatBerlin nutzt fest Europe/Berlin.
const shown = formatBerlin("2026-07-15T10:30:00.000Z");
check("Anzeige zeigt 12:30 (Berlin)", shown.includes("12:30"), shown);

console.log(`\n  Ergebnis: ${pass} PASS / ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
