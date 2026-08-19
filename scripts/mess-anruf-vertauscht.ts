// ═══════════════════════════════════════════════════════════════════════════
// WESSEN GESPRÄCH IST ES — UND ZU WEM GEHÖRT DER NAME?
//
// ── DIE MELDUNG (19.08.2026) ───────────────────────────────────────────────
// „Gespräche-Tab zeigt fremde Anrufe + Kundenname stimmt nicht zum Gespräch.
// Bei ALLEN Mitarbeitern sind die Telefongespräche vertauscht, nicht nur bei
// einer."
//
// Screenshot-Befund: Rifka Rovcanin (Onboarding) sieht 14 Gespräche, darunter
// nachweislich fremde; der Kundenname links passt oft nicht zum Inhalt.
//
// ── ZWEI GETRENNTE FEHLER, DIE GLEICH AUSSEHEN ────────────────────────────
// 1. WEM gehört der Anruf? (`agent_id`) — bei eingehenden Anrufen aus der
//    ZUSTÄNDIGKEIT geraten, nicht belegt. Ein geratener Anruf im Profil eines
//    Menschen wird als Leistungsnachweis gelesen.
// 2. WESSEN Name steht dran? (`person_id`) — bis zum Fix am 17.08.2026 wurde
//    die Person aus der OFFENEN KARTE gespeichert, nicht aus der gewählten
//    Nummer. Aufnahme, Transkript und KI-Notiz hängen dann an der falschen Akte.
//
// Dieser Lauf misst beide. NUR LESEND. CSV nach reports/.
//
//   npx tsx scripts/mess-anruf-vertauscht.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import { NUMMER_PASST_SQL, FIX_ZEITPUNKT } from "../server/lib/fiaon-anruf-pruefung";

const log = (s = "") => console.log(s);
function titel(t: string): void { log(`\n${"═".repeat(76)}\n${t}\n${"═".repeat(76)}`); }
const z = (n: unknown, b = 6) => String(n).padStart(b);

function csv(datei: string, kopf: string[], zeilen: unknown[][]): void {
  mkdirSync("reports", { recursive: true });
  const feld = (w: unknown) => {
    const s = w == null ? "" : String(w);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  writeFileSync(datei, "\uFEFF" + [kopf, ...zeilen].map((r) => r.map(feld).join(";")).join("\n"));
  log(`\n  → ${datei} (${zeilen.length} Zeilen)`);
}

async function main(): Promise<void> {
  // ═════════════════════════════════════════════════════════════════════════
  titel("1 — DIE HERKUNFT DER ZUORDNUNG, JE MITARBEITER");
  // ═════════════════════════════════════════════════════════════════════════
  // `zuordnung_herkunft` (Migration 066): gewaehlt und ergebnis sind BELEGT,
  // zustaendigkeit ist GERATEN. Die dritte Sorte hat in keinem Profil etwas zu
  // suchen.
  const jeAgent = (await sqlPool`
    SELECT ag.id, ag.name, ag.rolle,
           COUNT(*)::int AS gesamt,
           COUNT(*) FILTER (WHERE k.zuordnung_herkunft = 'gewaehlt')::int AS gewaehlt,
           COUNT(*) FILTER (WHERE k.zuordnung_herkunft = 'ergebnis')::int AS ergebnis,
           COUNT(*) FILTER (WHERE k.zuordnung_herkunft = 'zustaendigkeit')::int AS geraten,
           COUNT(*) FILTER (WHERE k.zuordnung_herkunft IS NULL)::int AS ohne_marke
      FROM fiaon_calls k
      JOIN fiaon_agents ag ON ag.id = k.agent_id
     GROUP BY 1, 2, 3
     ORDER BY gesamt DESC
  `) as any[];
  log("  Mitarbeiter               Rolle          gesamt gewaehlt ergebnis GERATEN ohne");
  log("  " + "─".repeat(74));
  let geratenGesamt = 0;
  for (const a of jeAgent) {
    geratenGesamt += Number(a.geraten);
    log(`  ${String(a.name).slice(0, 25).padEnd(25)} ${String(a.rolle ?? "-").padEnd(14)}`
      + `${z(a.gesamt)} ${z(a.gewaehlt, 8)} ${z(a.ergebnis, 8)} ${z(a.geraten, 7)} ${z(a.ohne_marke, 4)}`);
  }
  log(`\n  ${geratenGesamt} Anrufe stehen in einem Profil, OHNE dass belegt ist, wer sie geführt hat.`);
  log("  Genau diese verschwinden mit der neuen Regel aus allen Profilen —");
  log("  sie bleiben an der Kundenakte sichtbar.");

  // ═════════════════════════════════════════════════════════════════════════
  titel("2 — RIFKA ROVCANIN: DIE 14 EINTRÄGE, ZEILE FÜR ZEILE");
  // ═════════════════════════════════════════════════════════════════════════
  const [rifka] = (await sqlPool`
    SELECT id, name, rolle FROM fiaon_agents
     WHERE name ILIKE '%rifka%' OR name ILIKE '%rovcanin%'
     ORDER BY id LIMIT 1
  `) as any[];
  if (!rifka) {
    log("  Kein Mitarbeiter „Rifka Rovcanin“ gefunden — die Meldung nennt einen Namen,");
    log("  der im Bestand nicht steht (AGENTS.md: Namen im Auftrag sind Hinweise).");
  } else {
    log(`  ${rifka.name} (Kennung ${rifka.id}, Rolle ${rifka.rolle ?? "-"})\n`);
    const ihre = (await sqlPool.unsafe(`
      SELECT k.id, k.beginn, k.richtung, k.nummer, k.dauer_sek, k.ergebnis,
             k.zuordnung_herkunft, k.agent_id, k.person_id,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                      p.company_name, p.contact_name, '(keine Person)') AS angezeigter_kunde,
             betreuer.name AS kunde_betreuer,
             (${NUMMER_PASST_SQL("k", "p")}) AS nummer_passt
        FROM fiaon_calls k
        LEFT JOIN fiaon_persons p ON p.id = k.person_id
        LEFT JOIN fiaon_agents betreuer ON betreuer.id = p.assigned_agent_id
       WHERE k.agent_id = ${Number(rifka.id)}
       ORDER BY k.beginn DESC
    `)) as any[];
    log(`  ${ihre.length} Einträge in ihrem Gespräche-Tab.\n`);
    log("  Datum       Richtung   angezeigter Kunde         Herkunft        Nr. passt?  Betreuer");
    log("  " + "─".repeat(96));
    for (const c of ihre) {
      const d = new Date(c.beginn).toLocaleString("de-DE",
        { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
      log(`  ${d.padEnd(12)} ${String(c.richtung ?? "-").padEnd(10)} `
        + `${String(c.angezeigter_kunde).slice(0, 24).padEnd(25)} `
        + `${String(c.zuordnung_herkunft ?? "(leer)").padEnd(15)} `
        + `${(c.nummer_passt === null ? "keine Person" : c.nummer_passt ? "ja" : "NEIN").padEnd(11)} `
        + `${String(c.kunde_betreuer ?? "-").slice(0, 18)}`);
    }
    const geraten = ihre.filter((c) => c.zuordnung_herkunft === "zustaendigkeit").length;
    const falscheNummer = ihre.filter((c) => c.nummer_passt === false).length;
    log(`\n  ${geraten} davon sind GERATEN (eingehend, aus der Zuständigkeit) — nicht ihre Gespräche.`);
    log(`  ${falscheNummer} davon tragen einen Namen, dessen Nummer NICHT die gewählte ist.`);
    csv("reports/anruf-rifka.csv",
      ["anruf_id", "beginn", "richtung", "gewaehlte_nummer", "angezeigter_kunde",
        "person_id", "herkunft", "nummer_passt", "kunde_betreuer", "dauer_sek", "ergebnis"],
      ihre.map((c) => [c.id,
        new Date(c.beginn).toLocaleString("de-DE", { timeZone: "Europe/Berlin" }),
        c.richtung, c.nummer, c.angezeigter_kunde, c.person_id ?? "",
        c.zuordnung_herkunft ?? "", c.nummer_passt === null ? "" : c.nummer_passt ? "ja" : "NEIN",
        c.kunde_betreuer ?? "", c.dauer_sek ?? "", c.ergebnis ?? ""]));
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("3 — PASST DIE GEWÄHLTE NUMMER ZUR VERKNÜPFTEN PERSON?");
  // ═════════════════════════════════════════════════════════════════════════
  const [g] = (await sqlPool.unsafe(`
    SELECT COUNT(*)::int AS gesamt,
           COUNT(*) FILTER (WHERE k.person_id IS NULL)::int AS ohne_person,
           COUNT(*) FILTER (WHERE k.person_id IS NOT NULL
                            AND (${NUMMER_PASST_SQL("k", "p")}))::int AS passt,
           COUNT(*) FILTER (WHERE k.person_id IS NOT NULL
                            AND NOT (${NUMMER_PASST_SQL("k", "p")}))::int AS passt_nicht
      FROM fiaon_calls k
      LEFT JOIN fiaon_persons p ON p.id = k.person_id
  `)) as any[];
  log(`  ${z(g.gesamt)}  Anrufe insgesamt`);
  log(`  ${z(g.passt)}  Nummer gehört zur verknüpften Person`);
  log(`  ${z(g.passt_nicht)}  Nummer gehört NICHT zur verknüpften Person  ← der falsche Name`);
  log(`  ${z(g.ohne_person)}  ohne Person (unbekannte Nummer — kein Fehler)`);

  // ── DER WIRKLICHE STICHTAG KOMMT AUS DEN DATEN ─────────────────────────
  // Der Fix liegt im Commit vom 17.08.2026 09:31. Wann er in Produktion
  // wirkte, sagt der Commit nicht (zwischen Commit und Deploy schreibt die
  // alte Fassung weiter, AGENTS.md). Also nach Tagen aufgeschlüsselt.
  titel("4 — DIE ABWEICHUNG NACH TAGEN (wo wirkte der Fix?)");
  const tage = (await sqlPool.unsafe(`
    SELECT (k.beginn AT TIME ZONE 'Europe/Berlin')::date AS tag,
           COUNT(*)::int AS anrufe,
           COUNT(*) FILTER (WHERE k.person_id IS NOT NULL
                            AND NOT (${NUMMER_PASST_SQL("k", "p")}))::int AS falsch
      FROM fiaon_calls k
      LEFT JOIN fiaon_persons p ON p.id = k.person_id
     WHERE k.beginn > NOW() - INTERVAL '30 days'
     GROUP BY 1 ORDER BY 1
  `)) as any[];
  log("  Tag          Anrufe  falsch verknüpft   Anteil");
  log("  " + "─".repeat(52));
  for (const t of tage) {
    const q = Number(t.anrufe) > 0 ? Math.round((Number(t.falsch) / Number(t.anrufe)) * 100) : 0;
    log(`  ${String(t.tag).slice(0, 10)}   ${z(t.anrufe, 6)}  ${z(t.falsch, 15)}   ${z(q, 4)} %`);
  }
  log(`\n  Nomineller Stichtag (Commit): ${FIX_ZEITPUNKT}`);

  // ═════════════════════════════════════════════════════════════════════════
  titel("5 — WOHIN GEHÖREN DIE FALSCHEN? (eindeutig oder unklar)");
  // ═════════════════════════════════════════════════════════════════════════
  // Ein Umhängen ist nur erlaubt, wenn die gewählte Nummer GENAU EINE Person
  // trifft. Mehrere Treffer heißen: nicht entscheidbar, also Marke setzen.
  const falsch = (await sqlPool.unsafe(`
    WITH falschzu AS (
      SELECT k.id, k.beginn, k.nummer, k.person_id, k.agent_id, k.richtung,
             RIGHT(REGEXP_REPLACE(COALESCE(k.nummer, ''), '[^0-9]', '', 'g'), 9) AS key9,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                      p.company_name, '(?)') AS falscher_name
        FROM fiaon_calls k
        LEFT JOIN fiaon_persons p ON p.id = k.person_id
       WHERE k.person_id IS NOT NULL AND NOT (${NUMMER_PASST_SQL("k", "p")})
    )
    SELECT f.*, t.treffer, t.ziel_id, t.ziel_name
      FROM falschzu f
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS treffer,
               MIN(kandidat.id) AS ziel_id,
               MIN(COALESCE(NULLIF(TRIM(CONCAT_WS(' ', kandidat.first_name, kandidat.last_name)), ''),
                            kandidat.company_name)) AS ziel_name
          FROM fiaon_persons kandidat
         WHERE kandidat.merged_into_person_id IS NULL
           AND LENGTH(f.key9) = 9
           AND (kandidat.phone_key9 = f.key9
                OR EXISTS (SELECT 1 FROM fiaon_person_aliases al
                            WHERE al.person_id = kandidat.id AND al.kind = 'phone'
                              AND RIGHT(REGEXP_REPLACE(al.value_norm, '[^0-9]', '', 'g'), 9) = f.key9))
      ) t ON TRUE
     ORDER BY f.beginn DESC
  `)) as any[];

  const eindeutig = falsch.filter((f) => Number(f.treffer) === 1);
  const mehrfach = falsch.filter((f) => Number(f.treffer) > 1);
  const keinTreffer = falsch.filter((f) => Number(f.treffer ?? 0) === 0);
  log(`  ${z(falsch.length)}  falsch verknüpfte Anrufe`);
  log(`  ${z(eindeutig.length)}  davon EINDEUTIG umhängbar (Nummer trifft genau eine Person)`);
  log(`  ${z(mehrfach.length)}  mehrere Personen mit dieser Nummer → Marke „Zuordnung unklar"`);
  log(`  ${z(keinTreffer.length)}  keine Person zu dieser Nummer → Marke „Zuordnung unklar"`);

  log("\n  Die zehn jüngsten eindeutigen Fälle:");
  log("  Anruf  Datum         steht bei                 gehört zu");
  log("  " + "─".repeat(72));
  for (const f of eindeutig.slice(0, 10)) {
    const d = new Date(f.beginn).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" });
    log(`  ${z(f.id, 5)}  ${d.padEnd(12)}  ${String(f.falscher_name).slice(0, 24).padEnd(25)} `
      + `${String(f.ziel_name ?? "?").slice(0, 24)}`);
  }

  csv("reports/anruf-falsch-verknuepft.csv",
    ["anruf_id", "beginn", "richtung", "gewaehlte_nummer", "steht_bei_person", "steht_bei_name",
      "treffer", "gehoert_zu_person", "gehoert_zu_name", "wirkung"],
    falsch.map((f) => [f.id,
      new Date(f.beginn).toLocaleString("de-DE", { timeZone: "Europe/Berlin" }),
      f.richtung, f.nummer, f.person_id, f.falscher_name, f.treffer ?? 0,
      Number(f.treffer) === 1 ? f.ziel_id : "", Number(f.treffer) === 1 ? f.ziel_name : "",
      Number(f.treffer) === 1 ? "umhaengen" : "Marke unklar"]));

  // ═════════════════════════════════════════════════════════════════════════
  titel("6 — DIE VERLAUFSEINTRÄGE AN DEN FALSCHEN AKTEN");
  // ═════════════════════════════════════════════════════════════════════════
  // Jeder Anruf mit Ergebnis hat einen Eintrag in `fiaon_contact_log` an der
  // Bestellung der (falschen) Person. Der muss mit.
  const [vl] = (await sqlPool.unsafe(`
    SELECT COUNT(*)::int AS n
      FROM fiaon_calls k
      JOIN fiaon_persons p ON p.id = k.person_id
      JOIN fiaon_applications a ON a.person_id = k.person_id
      JOIN fiaon_contact_log cl ON cl.ref = a.ref
       AND cl.created_at BETWEEN k.beginn - INTERVAL '5 minutes'
                            AND COALESCE(k.ende, k.beginn) + INTERVAL '30 minutes'
     WHERE k.person_id IS NOT NULL AND NOT (${NUMMER_PASST_SQL("k", "p")})
       AND cl.voided_at IS NULL
  `)) as any[];
  log(`  ${z(vl.n)}  Verlaufseinträge stehen im Zeitfenster eines falsch verknüpften Anrufs.`);
  log("          Sie werden beim Umhängen mitgenommen (soft entfernt und neu gesetzt).");

  await sqlPool.end();
}

main().catch(async (e) => { console.error(e); await sqlPool.end(); process.exit(1); });
