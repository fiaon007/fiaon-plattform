// ═══════════════════════════════════════════════════════════════════════════
// WEM GEHÖRT EIN ANRUF?
//
// ── DIE MELDUNG (Screenshot, 19.08.2026) ───────────────────────────────────
// In Lucas Böhnerts Gespräche-Tab steht ein Anruf, in dem „Herr Boyschenko“
// spricht — also Nikita Boychenko. Auch umgekehrt gemeldet.
//
// ── DIE ZWEI WEGE, DIE agent_id SETZEN ────────────────────────────────────
//   1. RAUS (server/routes/fiaon-telefonie.ts, POST /telefon/ausweis):
//      agent_id = req.agent!.id — die Sitzung, die gewählt hat. Richtig.
//   2. REIN (server/lib/fiaon-anruf-eingehend.ts):
//      agent_id = zustaendigFuer(...) — eine Kette aus Inkasso-Zuständigkeit,
//      Termin, BETREUER des Kunden und „wer zuletzt sprach“. Das ist die Frage
//      „wer SOLLTE rangehen“, nicht „wer hat gesprochen“.
//
// Ein eingehender Anruf, den Nikita annimmt, landet damit bei Lucas, wenn Lucas
// den Kunden betreut. Genau das zeigt der Screenshot.
//
// ── WAS DIESE MESSUNG BEANTWORTET ─────────────────────────────────────────
//   · Wie viele Anrufe hängen an einem Betreuer statt an einem Sprecher?
//   · Lässt sich rekonstruieren, wer wirklich gesprochen hat?
//   · Und der konkrete Fall Lucas/Nikita.
//
// NUR LESEND.
//
//   npx tsx scripts/mess-anruf-zuordnung.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";

const log = (s = "") => console.log(s);
function titel(t: string): void { log(`\n${"═".repeat(78)}\n${t}\n${"═".repeat(78)}`); }
const feld = (v: unknown): string => {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

async function main(): Promise<void> {
  mkdirSync("reports", { recursive: true });

  // ═════════════════════════════════════════════════════════════════════════
  titel("1. WIE VIELE ANRUFE GIBT ES, UND IN WELCHER RICHTUNG?");
  // ═════════════════════════════════════════════════════════════════════════
  const richtungen = (await sqlPool`
    SELECT COALESCE(richtung, '— leer —') AS richtung, COUNT(*)::int AS n,
           COUNT(*) FILTER (WHERE beginn::date = CURRENT_DATE)::int AS heute,
           MIN(beginn) AS erster, MAX(beginn) AS letzter
    FROM fiaon_calls GROUP BY 1 ORDER BY 2 DESC
  `) as any[];
  log("");
  log("  Richtung        Anrufe   heute   erster                letzter");
  for (const r of richtungen) {
    log(`  ${String(r.richtung).padEnd(15)}${String(r.n).padStart(6)}`
      + `${String(r.heute).padStart(8)}   ${String(r.erster).slice(0, 19)}   ${String(r.letzter).slice(0, 19)}`);
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("2. STIMMT agent_id MIT DEM BETREUER ÜBEREIN — ODER MIT DEM WÄHLENDEN?");
  // ═════════════════════════════════════════════════════════════════════════
  // Die entscheidende Trennung: Bei einem AUSGEHENDEN Anruf ist agent_id die
  // Sitzung, die gewählt hat. Weicht sie dort vom Betreuer ab, ist das RICHTIG
  // (ein Kollege hat für jemanden angerufen). Bei einem EINGEHENDEN Anruf ist
  // agent_id per Bauart der Betreuer — und damit eine Vermutung.
  const [ab] = (await sqlPool`
    SELECT
      COUNT(*)::int AS alle,
      COUNT(*) FILTER (WHERE COALESCE(k.richtung, 'raus') <> 'eingehend')::int AS raus,
      COUNT(*) FILTER (WHERE k.richtung = 'eingehend')::int AS rein,
      COUNT(*) FILTER (WHERE k.richtung = 'eingehend'
                         AND k.agent_id = p.assigned_agent_id)::int AS rein_gleich_betreuer,
      COUNT(*) FILTER (WHERE k.richtung = 'eingehend'
                         AND p.assigned_agent_id IS NOT NULL
                         AND k.agent_id <> p.assigned_agent_id)::int AS rein_anders,
      COUNT(*) FILTER (WHERE COALESCE(k.richtung, 'raus') <> 'eingehend'
                         AND p.assigned_agent_id IS NOT NULL
                         AND k.agent_id <> p.assigned_agent_id)::int AS raus_anders
    FROM fiaon_calls k
    LEFT JOIN fiaon_persons p ON p.id = k.person_id
  `) as any[];
  log("");
  log(`  ${String(ab.alle).padStart(6)}  Anrufe insgesamt`);
  log(`  ${String(ab.raus).padStart(6)}  ausgehend`);
  log(`  ${String(ab.raus_anders).padStart(6)}  … davon agent_id ≠ Betreuer  (RICHTIG: der Wählende zählt)`);
  log(`  ${String(ab.rein).padStart(6)}  eingehend`);
  log(`  ${String(ab.rein_gleich_betreuer).padStart(6)}  … davon agent_id = Betreuer  (VERMUTUNG, kein Nachweis)`);
  log(`  ${String(ab.rein_anders).padStart(6)}  … davon agent_id ≠ Betreuer`);

  // ═════════════════════════════════════════════════════════════════════════
  titel("3. LÄSST SICH REKONSTRUIEREN, WER GESPROCHEN HAT?");
  // ═════════════════════════════════════════════════════════════════════════
  // Die einzige Spur eines MENSCHEN an einem Anruf ist das Ergebnis: Es wird
  // von der Sitzung gesetzt, die es erfasst — und die Route prüft dabei
  // ausdrücklich `agent_id = req.agent!.id`. Ein Anruf mit Ergebnis hat also
  // einen belegten Bearbeiter. Ohne Ergebnis gibt es keinen Nachweis.
  const [spur] = (await sqlPool`
    SELECT COUNT(*)::int AS alle,
           COUNT(*) FILTER (WHERE ergebnis IS NOT NULL)::int AS mit_ergebnis,
           COUNT(*) FILTER (WHERE ergebnis IS NULL)::int AS ohne_ergebnis,
           COUNT(*) FILTER (WHERE richtung = 'eingehend' AND ergebnis IS NOT NULL)::int AS rein_mit_ergebnis,
           COUNT(*) FILTER (WHERE recording_url IS NOT NULL)::int AS mit_aufnahme,
           COUNT(*) FILTER (WHERE transkript IS NOT NULL)::int AS mit_transkript
    FROM fiaon_calls
  `) as any[];
  log("");
  log(`  ${String(spur.mit_ergebnis).padStart(6)}  Anrufe mit einem erfassten Ergebnis`);
  log("         → die Sitzung, die es erfasst hat, ist belegt (die Route prüft");
  log("           agent_id = eigene Kennung, sonst „Das ist nicht dein Anruf“)");
  log(`  ${String(spur.ohne_ergebnis).padStart(6)}  ohne Ergebnis — hier gibt es KEINEN Nachweis über den Sprecher`);
  log(`  ${String(spur.rein_mit_ergebnis).padStart(6)}  eingehende Anrufe mit Ergebnis`);
  log(`  ${String(spur.mit_aufnahme).padStart(6)}  mit Aufnahme`);
  log(`  ${String(spur.mit_transkript).padStart(6)}  mit Transkript (dort steht ein Name im Text)`);
  log("");
  log("  BEFUND ZUM UMHÄNGEN: Es gibt kein Sitzungs-Protokoll, aus dem sich für");
  log("  einen eingehenden Anruf ableiten ließe, WER abgenommen hat. Die Tabelle");
  log("  hat genau eine Agenten-Spalte, und `fiaon_agent_events` hält kein");
  log("  „Anruf angenommen“-Ereignis. Ein Umhängen wäre also ein Raten — und ein");
  log("  geratener Anruf im Profil eines Menschen ist schlimmer als ein leerer.");

  // ═════════════════════════════════════════════════════════════════════════
  titel("4. DER GEMELDETE FALL: LUCAS UND NIKITA");
  // ═════════════════════════════════════════════════════════════════════════
  const beide = (await sqlPool`
    SELECT id, name, rolle FROM fiaon_agents
    WHERE name ILIKE '%böhnert%' OR name ILIKE '%boehnert%'
       OR name ILIKE '%boychenko%' OR name ILIKE '%boyschenko%'
    ORDER BY id
  `) as any[];
  log("");
  for (const b of beide) log(`  ${b.name} — Kennung ${b.id}, Rolle ${b.rolle}`);

  const ids = beide.map((b) => Number(b.id));
  if (ids.length >= 2) {
    // Anrufe in ihren Profilen, bei denen der Kunde dem ANDEREN gehört.
    const kreuz = (await sqlPool`
      SELECT k.id, k.beginn, k.richtung, k.status, k.ergebnis, k.dauer_sek,
             k.agent_id, ag.name AS im_profil_von,
             p.assigned_agent_id, betreuer.name AS betreuer,
             (k.transkript IS NOT NULL) AS hat_transkript,
             (k.recording_url IS NOT NULL) AS hat_aufnahme,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                      p.company_name, k.nummer) AS kunde
      FROM fiaon_calls k
      LEFT JOIN fiaon_agents ag ON ag.id = k.agent_id
      LEFT JOIN fiaon_persons p ON p.id = k.person_id
      LEFT JOIN fiaon_agents betreuer ON betreuer.id = p.assigned_agent_id
      WHERE k.agent_id = ANY(${ids}::int[])
        AND p.assigned_agent_id = ANY(${ids}::int[])
        AND k.agent_id <> p.assigned_agent_id
      ORDER BY k.beginn DESC LIMIT 40
    `) as any[];
    log("");
    log(`  ${kreuz.length} Anrufe, die im Profil des einen stehen, während der Kunde`);
    log("  dem anderen gehört:");
    for (const k of kreuz) {
      log(`     ${String(k.beginn).slice(0, 19)}  ${String(k.richtung).padEnd(10)}`
        + ` im Profil: ${String(k.im_profil_von).slice(0, 16).padEnd(17)}`
        + ` Betreuer: ${String(k.betreuer).slice(0, 16).padEnd(17)}`
        + ` ${String(k.kunde).slice(0, 20)}`
        + `${k.ergebnis ? `  Ergebnis: ${k.ergebnis}` : "  OHNE Ergebnis"}`);
    }
    if (kreuz.length > 0) {
      log("");
      log("  Bei den AUSGEHENDEN darunter ist die Zuordnung richtig: Der Kollege");
      log("  hat gewählt, also gehört ihm der Anruf. Bei den EINGEHENDEN steht");
      log("  dort, wer zuständig war — nicht, wer sprach.");
    }

    // Die Stichprobe aus dem Auftrag: 20 Anrufe von heute je Agent.
    log("");
    log("  Stichprobe: Anrufe von heute je Agent (bis 20 je Mensch):");
    for (const b of beide) {
      const heute = (await sqlPool`
        SELECT k.id, k.beginn, k.richtung, k.ergebnis, k.dauer_sek,
               p.assigned_agent_id, betreuer.name AS betreuer,
               COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                        p.company_name, k.nummer) AS kunde
        FROM fiaon_calls k
        LEFT JOIN fiaon_persons p ON p.id = k.person_id
        LEFT JOIN fiaon_agents betreuer ON betreuer.id = p.assigned_agent_id
        WHERE k.agent_id = ${Number(b.id)} AND k.beginn::date = CURRENT_DATE
        ORDER BY k.beginn DESC LIMIT 20
      `) as any[];
      const fremd = heute.filter((h) => h.assigned_agent_id != null
        && Number(h.assigned_agent_id) !== Number(b.id));
      log(`     ${String(b.name).padEnd(20)} ${String(heute.length).padStart(3)} Anrufe heute,`
        + ` ${fremd.length} davon bei einem fremden Kunden`);
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("5. ALLE ANRUFE, BEI DENEN PROFIL UND BETREUER AUSEINANDERGEHEN");
  // ═════════════════════════════════════════════════════════════════════════
  const alleKreuz = (await sqlPool`
    SELECT k.id, k.beginn, COALESCE(k.richtung, 'raus') AS richtung, k.ergebnis,
           k.agent_id, ag.name AS im_profil_von,
           p.assigned_agent_id, betreuer.name AS betreuer,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, k.nummer) AS kunde
    FROM fiaon_calls k
    LEFT JOIN fiaon_agents ag ON ag.id = k.agent_id
    LEFT JOIN fiaon_persons p ON p.id = k.person_id
    LEFT JOIN fiaon_agents betreuer ON betreuer.id = p.assigned_agent_id
    WHERE p.assigned_agent_id IS NOT NULL AND k.agent_id <> p.assigned_agent_id
    ORDER BY k.beginn DESC
  `) as any[];
  const reinKreuz = alleKreuz.filter((k) => k.richtung === "eingehend");
  log("");
  log(`  ${String(alleKreuz.length).padStart(5)}  Anrufe, bei denen agent_id ≠ Betreuer`);
  log(`  ${String(reinKreuz.length).padStart(5)}  davon EINGEHEND — nur diese sind fragwürdig`);
  log(`  ${String(alleKreuz.length - reinKreuz.length).padStart(5)}  ausgehend — die sind richtig zugeordnet`);

  writeFileSync("reports/anruf-zuordnung.csv",
    "id;beginn;richtung;im_profil_von;agent_id;betreuer;betreuer_id;kunde;ergebnis;bewertung\n"
    + alleKreuz.map((k) => [k.id, String(k.beginn).slice(0, 19), k.richtung, k.im_profil_von,
      k.agent_id, k.betreuer, k.assigned_agent_id, k.kunde, k.ergebnis,
      k.richtung === "eingehend" ? "eingehend_vermutung" : "ausgehend_richtig",
    ].map(feld).join(";")).join("\n") + "\n", "utf8");
  log("");
  log("  reports/anruf-zuordnung.csv");
  log("");
  await sqlPool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
