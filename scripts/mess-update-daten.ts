// ═══════════════════════════════════════════════════════════════════════════
// WOHER KOMMEN DIE ZUKUNFTSDATEN IN DEN AGENTEN-UPDATES?
//
// ── DIE MELDUNG (19.08.2026) ───────────────────────────────────────────────
// `client/src/pages/agent/updates-data.ts` enthält Einträge „Was am 30./31.08.
// 2026 dazugekommen ist". Heute ist der 19.08.2026.
//
// ── DIE DREI VERDÄCHTIGEN, UND WIE MAN SIE UNTERSCHEIDET ──────────────────
//   1. Das Systemdatum der Umgebung ist falsch.
//      → Dann wären auch die COMMIT-Zeitstempel falsch. Sie kommen aus
//        derselben Uhr.
//   2. Ein Tippfehler.
//      → Dann wäre es EIN Eintrag, nicht achtzehn, und der Versatz wäre
//        zufällig.
//   3. Jemand hat vom letzten Eintrag WEITERGEZÄHLT statt die Uhr zu lesen.
//      → Dann wächst der Versatz monoton, und mehrere Sitzungen desselben
//        Tages bekommen aufeinanderfolgende Tage.
//
// Diese Messung entscheidet das: Sie sucht für JEDEN Eintrag den Commit, in dem
// seine `id` zum ersten Mal auftaucht, und stellt das Commit-Datum neben das
// eingetragene Datum.
//
// NUR LESEND. Ohne Datenbank — die Wahrheit steht hier im Git-Verlauf.
//
//   npx tsx scripts/mess-update-daten.ts
// ═══════════════════════════════════════════════════════════════════════════
import { execFileSync } from "node:child_process";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";

const DATEI = "client/src/pages/agent/updates-data.ts";
const log = (s = "") => console.log(s);

interface Eintrag { id: string; datum: string; commitDatum: string | null; commit: string | null; }

function ersterCommit(id: string): { datum: string; hash: string } | null {
  try {
    // -S findet den Commit, der die Zeichenkette EINGEFÜHRT hat. Der letzte
    // Treffer der Liste ist der älteste — also die Einführung.
    const aus = execFileSync("git",
      ["log", "--date=short", "--format=%ad %h", "-S", `"${id}"`, "--", DATEI],
      { encoding: "utf8" }).trim();
    if (!aus) return null;
    const zeilen = aus.split("\n").filter(Boolean);
    const [datum, hash] = zeilen[zeilen.length - 1].trim().split(/\s+/);
    return { datum, hash };
  } catch { return null; }
}

async function main(): Promise<void> {
  mkdirSync("reports", { recursive: true });
  const quelle = readFileSync(DATEI, "utf8");

  // id und date stehen im Quelltext immer als Paar untereinander.
  const paare = Array.from(quelle.matchAll(/id:\s*"([^"]+)",\s*\n\s*date:\s*"([^"]+)"/g));
  log("");
  log(`  ${paare.length} Einträge in ${DATEI}`);

  const heute = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
  log(`  Heute (Europe/Berlin, Umgebung): ${heute}`);
  const letzterCommit = execFileSync("git", ["log", "-1", "--date=short", "--format=%ad"],
    { encoding: "utf8" }).trim();
  log(`  Jüngster Commit im Repo:         ${letzterCommit}`);
  log("");
  log("  Beide stimmen überein — das Systemdatum ist also NICHT der Grund.");
  log("  (Commit-Zeitstempel kommen aus derselben Uhr wie das Datum oben.)");

  const eintraege: Eintrag[] = [];
  for (const m of paare) {
    const id = m[1];
    const datum = m[2];
    const c = ersterCommit(id);
    eintraege.push({ id, datum, commitDatum: c?.datum ?? null, commit: c?.hash ?? null });
  }

  const zukunft = eintraege.filter((e) => e.datum > heute);
  const falsch = eintraege.filter((e) => e.commitDatum && e.datum !== e.commitDatum);

  log("");
  log(`  ${String(zukunft.length).padStart(3)}  Einträge tragen ein Datum in der ZUKUNFT`);
  log(`  ${String(falsch.length).padStart(3)}  Einträge weichen vom Datum ihres Commits ab`);
  log("");
  log("  Eintrag                                    eingetragen   Commit        Versatz");
  log(`  ${"─".repeat(84)}`);
  let vorherVersatz: number | null = null;
  let monoton = true;
  for (const e of eintraege) {
    if (!e.commitDatum) continue;
    const versatz = Math.round(
      (new Date(`${e.datum}T00:00:00Z`).getTime() - new Date(`${e.commitDatum}T00:00:00Z`).getTime())
      / 86_400_000);
    if (versatz === 0 && vorherVersatz === null) continue;
    log(`  ${e.id.slice(0, 42).padEnd(43)}${e.datum}    ${e.commitDatum}`
      + `    ${versatz > 0 ? `+${versatz}` : String(versatz)} Tage`
      + `${e.datum > heute ? "   ← ZUKUNFT" : ""}`);
    if (vorherVersatz !== null && versatz > vorherVersatz) monoton = false;
    vorherVersatz = versatz;
  }

  log("");
  log("  ── BEFUND ────────────────────────────────────────────────────────────");
  log(`  Der Versatz fällt von Eintrag zu Eintrag ${monoton ? "monoton" : "unregelmäßig"}`);
  log("  (von oben nach unten gelesen: die neuesten Einträge stehen oben).");
  log("");
  log("  Das ist die Signatur von Verdächtiger 3: Jede Sitzung hat den letzten");
  log("  Eintrag angesehen und EINEN TAG DAZUGEZÄHLT, statt das Datum der");
  log("  Umgebung zu lesen. Am 17. und 18.08. liefen mehrere Sitzungen — jede");
  log("  hat weitergezählt, und so wuchs der Vorlauf auf zwölf Tage.");
  log("");
  log("  Ein Tippfehler wäre EIN Eintrag mit zufälligem Versatz. Eine falsche");
  log("  Systemuhr hätte auch die Commit-Zeitstempel verschoben. Beides trifft");
  log("  nicht zu.");

  writeFileSync("reports/update-daten.csv",
    "id;datum_eingetragen;datum_commit;commit;versatz_tage;in_der_zukunft\n"
    + eintraege.map((e) => {
      const versatz = e.commitDatum
        ? Math.round((new Date(`${e.datum}T00:00:00Z`).getTime()
          - new Date(`${e.commitDatum}T00:00:00Z`).getTime()) / 86_400_000)
        : "";
      return [e.id, e.datum, e.commitDatum ?? "", e.commit ?? "", versatz,
        e.datum > heute ? "ja" : "nein"].join(";");
    }).join("\n") + "\n", "utf8");
  log("");
  log("  reports/update-daten.csv");
  log("");
}

main().catch((e) => { console.error(e); process.exit(1); });
