// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: KEIN UPDATE- ODER CHANGELOG-DATUM LIEGT IN DER ZUKUNFT
//
// ── WARUM ES DIESE WAND GIBT (19.08.2026) ──────────────────────────────────
// `client/src/pages/agent/updates-data.ts` enthielt achtzehn Einträge mit
// einem Datum in der Zukunft, der vorderste zwölf Tage. Die Ursache war keine
// falsche Uhr und kein Tippfehler, sondern eine Gewohnheit: Jede Sitzung hat
// den obersten Eintrag angesehen und einen Tag dazugezählt
// (scripts/mess-update-daten.ts belegt den monoton wachsenden Versatz).
//
// Eine Gewohnheit hört nicht auf, weil jemand sie einmal bemerkt hat. Deshalb
// diese Prüfung.
//
// ── WARUM GEGEN DIE DATENBANKZEIT ──────────────────────────────────────────
// Der Auftrag verlangt es ausdrücklich, und er hat recht: Die lokale Uhr ist
// genau die Quelle, die man nicht prüfen kann, wenn man ihr misstraut. Die
// Datenbank ist eine zweite, unabhängige Uhr — und die, an der der Betrieb
// hängt. Läuft die Umgebung vor oder nach, fällt es hier auf.
//
// Der Vergleich läuft in Europe/Berlin (AGENTS.md), nicht in UTC: Ein Eintrag
// von heute Abend wäre in UTC noch heute und in Berlin schon morgen — oder
// umgekehrt, und dann wird die Wand nachts grundlos rot. Ein Prüfstand, der
// wegen der Uhrzeit rot wird, wird abgeschaltet.
//
// NUR LESEND.
//
//   npx tsx scripts/pruef-daten-zukunft.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { readFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";

let gut = 0;
let schlecht = 0;
const log = (s = "") => console.log(s);
function ok(text: string, bedingung: boolean, fund = ""): void {
  if (bedingung) { gut++; log(`  ok    ${text}`); }
  else { schlecht++; log(`  ROT   ${text}${fund ? `\n        ${fund}` : ""}`); }
}
const lies = (p: string) => { try { return readFileSync(p, "utf8"); } catch { return ""; } };

async function main(): Promise<void> {
  // ── DIE ZWEITE UHR ──────────────────────────────────────────────────────
  const [z] = (await sqlPool`
    SELECT (NOW() AT TIME ZONE 'Europe/Berlin')::date::text AS heute
  `) as any[];
  const heute = String(z.heute);
  const lokal = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });

  log("");
  log(`  Datenbankzeit (Europe/Berlin): ${heute}`);
  log(`  Lokale Uhr    (Europe/Berlin): ${lokal}`);
  log("");
  // Kein Fehlschlag, sondern eine MELDUNG: Wenn die beiden auseinandergehen,
  // ist das der wichtigste Satz des Laufs — aber die Prüfung selbst läuft
  // gegen die Datenbank weiter.
  if (heute !== lokal) {
    log("  ⚠ Die beiden Uhren gehen auseinander. Gemessen wird gegen die");
    log("    Datenbank — an ihr hängt der Betrieb.");
    log("");
  } else {
    log("  Beide stimmen überein.");
    log("");
  }

  // ═══════════════════════════════════════════════════════════════════════
  log("── 1. Agenten-Updates ────────────────────────────────────────────");
  // ═══════════════════════════════════════════════════════════════════════
  const updates = lies("client/src/pages/agent/updates-data.ts");
  ok("updates-data.ts ist lesbar", updates.length > 0);

  const paare = Array.from(updates.matchAll(/id:\s*"([^"]+)",\s*\n\s*date:\s*"([^"]+)"/g))
    .map((m) => ({ id: m[1], datum: m[2] }));
  ok(`Es gibt Einträge (${paare.length})`, paare.length > 0);

  const zukunft = paare.filter((p) => p.datum > heute);
  ok("Kein Eintrag trägt ein Datum in der Zukunft", zukunft.length === 0,
    zukunft.map((p) => `${p.datum}  ${p.id}`).join("\n        "));

  const unlesbar = paare.filter((p) => !/^\d{4}-\d{2}-\d{2}$/.test(p.datum));
  ok("Jedes Datum steht als JJJJ-MM-TT", unlesbar.length === 0,
    unlesbar.map((p) => `${p.datum}  ${p.id}`).join("; "));

  // ── DIE REIHENFOLGE ───────────────────────────────────────────────────
  // Die Datei sagt „Neueste zuerst". Nach der Korrektur der Zukunftsdaten war
  // genau das gebrochen: Einträge vom 17.08. standen über solchen vom 19.08.
  // Eine falsche Reihenfolge ist der erste sichtbare Hinweis darauf, dass
  // jemand wieder ein Datum erfunden hat.
  const verdreht: string[] = [];
  for (let i = 1; i < paare.length; i++) {
    if (paare[i].datum > paare[i - 1].datum) {
      verdreht.push(`${paare[i].id} (${paare[i].datum}) steht unter `
        + `${paare[i - 1].id} (${paare[i - 1].datum})`);
    }
  }
  ok("Die Liste ist absteigend sortiert (Neueste zuerst)", verdreht.length === 0,
    verdreht.join("\n        "));

  // ═══════════════════════════════════════════════════════════════════════
  log("");
  log("── 2. CHANGELOG.md ───────────────────────────────────────────────");
  // ═══════════════════════════════════════════════════════════════════════
  const changelog = lies("CHANGELOG.md");
  ok("CHANGELOG.md ist lesbar", changelog.length > 0);

  // ── GEPRÜFT WERDEN DIE ÜBERSCHRIFTEN, NICHT JEDES DATUM IM TEXT ─────────
  // Ein erster Entwurf suchte JEDE Datumsangabe in der Datei und wurde rot
  // an diesem Satz:
  //
  //     „Freischaltung ab 01.10.2026 in DE/AT/CH geplant"
  //
  // Das ist ein PLAN, und ein Plan liegt zu Recht in der Zukunft. Rot war die
  // Prüfung, richtig war die Datei. Eine Prüfung mit Fehlalarmen ist schlechter
  // als keine (AGENTS.md) — nach dem zweiten Mal schaltet sie jemand ab.
  //
  // Die Behauptung, um die es geht, steht in der ÜBERSCHRIFT: „## TT.MM.JJJJ —
  // …" heißt „an diesem Tag ist das passiert". Nur die kann falsch in der
  // Zukunft liegen.
  const ueberschriften = Array.from(
    changelog.matchAll(/^## (\d{2})\.(\d{2})\.(20\d\d)(.*)$/gm),
  ).map((m) => ({
    text: `${m[1]}.${m[2]}.${m[3]}`,
    datum: `${m[3]}-${m[2]}-${m[1]}`,
    titel: m[4].trim().slice(0, 60),
  }));
  ok(`Es wurden Eintrags-Überschriften gefunden (${ueberschriften.length})`,
    ueberschriften.length > 0);

  const clZukunft = ueberschriften.filter((d) => d.datum > heute);
  ok("Keine CHANGELOG-Überschrift liegt in der Zukunft", clZukunft.length === 0,
    clZukunft.map((d) => `${d.text} ${d.titel}`).join("\n        "));

  // ═══════════════════════════════════════════════════════════════════════
  log("");
  log("── 3. Datumsangaben in Quelltext-Kommentaren ─────────────────────");
  // ═══════════════════════════════════════════════════════════════════════
  // Die Zukunftsdaten standen nicht nur in den Updates: Auch Kommentare in
  // server/ und client/ trugen sie („── DER EIGENTLICHE SCHUTZ (31.08.2026)").
  // Ein Kommentar mit einem falschen Datum schickt den nächsten Leser auf die
  // Suche nach einem Commit, den es nicht gibt.
  //
  // Diese Prüfung ist eine OBERGRENZE, kein Verbot (AGENTS.md): Der Bestand
  // wird beim ersten Lauf festgehalten; NEUE Fälle werden rot. Eine Prüfung,
  // die zweihundert Altfälle meldet, wird nach dem zweiten Lauf abgeschaltet.
  const { execFileSync } = await import("node:child_process");
  let treffer: string[] = [];
  try {
    const aus = execFileSync("grep", [
      "-rInE", "--include=*.ts", "--include=*.tsx",
      "\\b[0-9]{2}\\.[0-9]{2}\\.20[0-9]{2}\\b", "server", "client/src", "shared", "scripts",
    ], { encoding: "utf8", maxBuffer: 40 * 1024 * 1024 });
    treffer = aus.split("\n").filter(Boolean).flatMap((zeile) => {
      const m = zeile.match(/\b(\d{2})\.(\d{2})\.(20\d\d)\b/);
      if (!m) return [];
      const datum = `${m[3]}-${m[2]}-${m[1]}`;
      if (datum <= heute) return [];
      return [`${zeile.split(":")[0]}  →  ${m[0]}`];
    });
  } catch {
    // grep endet mit 1, wenn es nichts findet — das ist der gute Fall.
  }
  const einmalig = Array.from(new Set(treffer));

  // ── OBERGRENZE, KEIN VERBOT ───────────────────────────────────────────
  // GEMESSEN am 19.08.2026: 166 Fundstellen in rund hundert Dateien. Sie alle
  // auf ihr echtes Datum zu bringen ist mehrtägige Arbeit — und jedes einzelne
  // Datum müsste aus dem Git-Verlauf der jeweiligen Datei belegt werden. Ein
  // geratenes Datum wäre wieder eine Behauptung (AGENTS.md: „Eine sichtbare
  // Lücke ist ehrlich; eine gefüllte Lücke ist eine Behauptung").
  //
  // Also die Wand statt der Hälfte: Der Bestand ist geduldet, NEUE Fundstellen
  // werden rot. Wer die Zahl senkt, senkt auch diese Grenze.
  //
  // Ein Verbot wäre hier falsch: Eine Prüfung, die 166 Altfälle meldet, ist
  // nach dem zweiten Lauf abgeschaltet — und fängt dann auch die 167. nicht.
  // 166 waren es beim ersten Lauf; die Dateien dieses Auftrags sind schon
  // korrigiert. Die Grenze folgt dem Bestand nach UNTEN — sonst hält sie eine
  // Lücke offen, die gerade geschlossen wurde.
  // 164 → 163 am 19.08.2026: Mit `pages/agent/heute.tsx` (tote Fassung, hing an
  // keiner Route) ist eine Fundstelle weggefallen. Die Obergrenze wird
  // NACHGEZOGEN, sobald sie sinkt — sonst hält die Wand die Lücke offen, die
  // gerade geschlossen wurde.
  const BESTAND_KOMMENTARE = 163;
  log("");
  for (const t of einmalig.slice(0, 15)) log(`     ${t}`);
  if (einmalig.length > 15) log(`     … und ${einmalig.length - 15} weitere`);
  log("");
  log(`     Bestand am 19.08.2026: ${BESTAND_KOMMENTARE}. Jetzt: ${einmalig.length}.`);
  ok(`Keine NEUE Datumsangabe in der Zukunft (Obergrenze ${BESTAND_KOMMENTARE})`,
    einmalig.length <= BESTAND_KOMMENTARE,
    `${einmalig.length} Fundstellen — ${einmalig.length - BESTAND_KOMMENTARE} mehr als der `
    + "geduldete Bestand. Die neuen stehen oben in der Liste.");
  if (einmalig.length < BESTAND_KOMMENTARE) {
    log(`  Hinweis: ${BESTAND_KOMMENTARE - einmalig.length} Fundstellen sind weg. `
      + `Setz BESTAND_KOMMENTARE auf ${einmalig.length} — sonst hält die Wand`);
    log("  die Lücke offen, die gerade geschlossen wurde.");
  }

  log("");
  log(`${gut} ok, ${schlecht} rot.`);
  log("");
  await sqlPool.end();
  if (schlecht > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
