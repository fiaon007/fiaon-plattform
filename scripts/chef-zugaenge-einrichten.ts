// ═══════════════════════════════════════════════════════════════════════════
// CHEF-ZUGÄNGE EINRICHTEN (26.08.2026)
//
// Justin: „Und schalte ihn für Florentine, Daniel und mich frei — vergebe uns
//          allen ein zufälliges Passwort, beim ersten Login muss man das
//          ändern."
//
// ── WAS HIER PASSIERT ────────────────────────────────────────────────────
// 1. Die Spalte `passwort_wechsel_noetig` auf fiaon_agents anlegen. Der Code
//    verweist längst darauf (fiaon-zugang-retten.ts liest sie), aber sie
//    existierte nur auf fiaon_applications — beim Kunden, nicht beim
//    Mitarbeiter. Der Zwangswechsel lief bei Mitarbeitern also ins Leere.
// 2. Die Admin-Stufe setzen: inhaber (Justin) > geschaeftsfuehrung
//    (Florentine) > leitung (Daniel). Sie wird laut Kommentar in
//    fiaon-chef-zugang.ts „von Hand gesetzt — KEINE Migration befüllt sie",
//    und genau das ist bisher nie geschehen.
// 3. Je Person ein neues Zufallspasswort setzen und den Wechsel erzwingen.
//
// ── WARUM DIE PASSWÖRTER HIER AUSGEGEBEN WERDEN ──────────────────────────
// Sie erscheinen EINMAL auf Justins Bildschirm und stehen nirgends sonst —
// nicht in der Datenbank (dort liegt nur der Hash), nicht im Repository,
// nicht in einer Datei. Wer sie weitergibt, tut das mündlich oder über einen
// Kanal seiner Wahl. Beim ersten Anmelden müssen sie ohnehin geändert werden.
//
// Aufruf:  npx tsx scripts/chef-zugaenge-einrichten.ts [--setzen]
// ═══════════════════════════════════════════════════════════════════════════
import { randomBytes } from "node:crypto";
import { sqlPool } from "../server/lib/db-pool";

const ECHT = process.argv.includes("--setzen");

/** Ein Passwort, das man einmal vorlesen kann: keine verwechselbaren Zeichen. */
function passwortErzeugen(): string {
  const zeichen = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const b = randomBytes(20);
  let p = "";
  for (let i = 0; i < 16; i++) p += zeichen[b[i] % zeichen.length];
  // Gruppiert lesbar: xxxx-xxxx-xxxx-xxxx
  return `${p.slice(0, 4)}-${p.slice(4, 8)}-${p.slice(8, 12)}-${p.slice(12, 16)}`;
}

const LEUTE: { id: number; stufe: "inhaber" | "geschaeftsfuehrung" | "leitung" }[] = [
  { id: 928, stufe: "inhaber" },             // Justin Schwarzott
  { id: 10, stufe: "geschaeftsfuehrung" },   // Florentine Lombardi
  { id: 8, stufe: "leitung" },               // Daniel Stripling
];

(async () => {
  // ── 1. Die fehlende Spalte ───────────────────────────────────────────────
  if (ECHT) {
    await sqlPool.begin(async (tx) => {
      await tx`SET LOCAL lock_timeout = '5s'`;
      await tx.unsafe(`ALTER TABLE fiaon_agents ADD COLUMN IF NOT EXISTS passwort_wechsel_noetig BOOLEAN NOT NULL DEFAULT FALSE`);
      await tx.unsafe(`ALTER TABLE fiaon_agents ADD COLUMN IF NOT EXISTS passwort_gesetzt_am TIMESTAMPTZ`);
    });
    console.log("Spalten passwort_wechsel_noetig / passwort_gesetzt_am sichergestellt.\n");
  }

  // Mitarbeiter-Passwoerter liegen als BCRYPT vor (fiaon-agent.ts prueft mit
  // bcrypt.compare) — nicht als scrypt wie bei Kunden. Ein Hash der falschen
  // Art waere ein Konto, in das niemand mehr hineinkommt.
  const bcrypt = (await import("bcryptjs")).default;

  console.log("── ZUGÄNGE ──");
  const ausgabe: string[] = [];
  for (const l of LEUTE) {
    const [a] = (await sqlPool`SELECT id, name, email, admin_stufe FROM fiaon_agents WHERE id = ${l.id}`) as any[];
    if (!a) { console.log(`   ✗  Konto ${l.id} nicht gefunden`); continue; }
    const pw = passwortErzeugen();
    if (ECHT) {
      await sqlPool`
        UPDATE fiaon_agents
           SET admin_stufe = ${l.stufe},
               password_hash = ${await bcrypt.hash(pw, 12)},
               passwort_wechsel_noetig = TRUE,
               passwort_gesetzt_am = NOW(),
               session_epoch = COALESCE(session_epoch, 0) + 1
         WHERE id = ${l.id}`;
    }
    console.log(`   ${String(a.name).padEnd(22)} ${String(l.stufe).padEnd(19)} ${a.email}`);
    ausgabe.push(`${a.name}\n   E-Mail:   ${a.email}\n   Passwort: ${pw}\n   Stufe:    ${l.stufe}`);
  }

  if (!ECHT) {
    console.log("\nProbelauf. Mit --setzen werden Stufen und Passwörter wirklich gesetzt.");
    await sqlPool.end();
    return;
  }

  console.log("\n" + "═".repeat(66));
  console.log("DIE PASSWÖRTER — einmalig, sie stehen nirgends sonst");
  console.log("═".repeat(66));
  ausgabe.forEach((z) => console.log("\n" + z));
  console.log("\nBeim ersten Anmelden verlangt die Plattform eine Änderung.");
  console.log("Alle bestehenden Sitzungen dieser Konten wurden beendet.");
  await sqlPool.end();
})();
