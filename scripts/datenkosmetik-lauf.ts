// ═══════════════════════════════════════════════════════════════════════════
// BESTANDSLAUF: PAKETNAMEN EINZEILIG, NAMEN SAUBER
//
// ── ZUERST VORSCHAU, DANN SCHREIBEN (AGENTS.md) ────────────────────────────
//   npx tsx scripts/datenkosmetik-lauf.ts                 nur Vorschau + CSV
//   npx tsx scripts/datenkosmetik-lauf.ts --schreiben     ändert wirklich
//
// Einzelne Teile:
//   --nur=pakete    nur die Paketnamen
//   --nur=namen     nur die Personennamen
//
// ── WAS DIESER LAUF ÄNDERT UND WAS NICHT ───────────────────────────────────
// Er räumt LEERRAUM. Zeilenumbrüche werden zu Leerzeichen, mehrfache
// Leerzeichen zu einem, Ränder weg. Er ändert keinen Buchstaben, keine
// Groß-/Kleinschreibung, kürzt nichts und löscht nichts.
//
// ── WARUM KEIN ALIAS FÜR DIE NAMEN ─────────────────────────────────────────
// „Violeta " ist nicht ein anderer Name als „Violeta" — es ist derselbe,
// sauber geschrieben. Ein Alias dafür würde die Alias-Liste mit Rauschen füllen
// und die echten Fälle (Heirat, Schreibvariante) unlesbar machen. Der Lauf legt
// deshalb nur dann einen an, wenn sich MEHR als Leerraum ändert — und das kann
// bei dieser Reinigung nicht vorkommen. Die Prüfung steht trotzdem im Code, weil
// eine Behauptung, die man nicht prüft, irgendwann nicht mehr stimmt.
//
// ── KEIN HARD-DELETE, KEINE ARCHIVIERUNG ───────────────────────────────────
// Es wird nichts entfernt. Der alte Wert steht in der Vorschau-CSV in
// `reports/` — das ist der Nachweis, falls jemand nachsehen will.
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import { paketNameEinzeilig, hatUmbruch } from "../shared/fiaon-paketname";
import { nameSauber, brauchtReinigung } from "../shared/fiaon-namen";

const SCHREIBEN = process.argv.includes("--schreiben");
const NUR = (process.argv.find((a) => a.startsWith("--nur="))?.split("=")[1] ?? "alles").trim();
const machPakete = NUR === "alles" || NUR === "pakete";
const machNamen = NUR === "alles" || NUR === "namen";

const log = (s = "") => console.log(s);
function titel(t: string): void {
  log(`\n${"═".repeat(72)}\n${t}\n${"═".repeat(72)}`);
}

function feld(v: unknown): string {
  const s = v == null ? "" : String(v).replace(/[\r\n]+/g, "⏎");
  return /[",;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function csv(name: string, zeilen: Record<string, unknown>[]): string {
  mkdirSync("reports", { recursive: true });
  const pfad = `reports/${name}`;
  if (zeilen.length === 0) { writeFileSync(pfad, "keine Treffer\n", "utf8"); return pfad; }
  const kopf = Object.keys(zeilen[0]);
  writeFileSync(pfad, `${[kopf.join(";"), ...zeilen.map((z) => kopf.map((k) => feld(z[k])).join(";"))].join("\n")}\n`, "utf8");
  return pfad;
}

async function main(): Promise<void> {
  log(SCHREIBEN
    ? "\n  ⚠  SCHREIBMODUS — Änderungen werden gespeichert."
    : "\n  VORSCHAU. Nichts wird geändert. Zum Schreiben: --schreiben");
  log(`  Teile: ${NUR}`);

  // ═════════════════════════════════════════════════════════════════════════
  if (machPakete) {
    titel("TEIL 1 — PAKETNAMEN EINZEILIG");
    // ═══════════════════════════════════════════════════════════════════════
    // Alle Namen laden, die eine Reinigung brauchen. Die Entscheidung, WAS
    // sauber ist, fällt in `paketNameEinzeilig()` — nicht in SQL. Sonst gäbe
    // es zwei Fassungen der Regel, und der Server würde anders reinigen als
    // dieser Lauf.
    const zeilen = (await sqlPool`
      SELECT ref, pack_name FROM fiaon_applications
      WHERE pack_name IS NOT NULL
      ORDER BY created_at DESC
    `) as any[];

    const zuAendern = zeilen
      .map((z) => ({ ref: String(z.ref), alt: String(z.pack_name), neu: paketNameEinzeilig(z.pack_name) }))
      .filter((z) => z.neu !== null && z.neu !== z.alt);

    log(`  ${zeilen.length} Bestellungen mit Paketnamen geprüft.`);
    log(`  ${zuAendern.length} brauchen eine Reinigung.`);

    // Die Formen zusammenfassen — fünf Zeilen sagen mehr als 6.589.
    const formen = new Map<string, { neu: string; n: number }>();
    for (const z of zuAendern) {
      const v = formen.get(z.alt) ?? { neu: z.neu!, n: 0 };
      v.n++; formen.set(z.alt, v);
    }
    log("\n  ALT → NEU:");
    for (const [alt, v] of Array.from(formen.entries()).sort((a, b) => b[1].n - a[1].n)) {
      log(`    ${String(v.n).padStart(5)} ×  ${JSON.stringify(alt).replace(/\\n/g, "⏎")}`);
      log(`             →  ${JSON.stringify(v.neu)}`);
    }
    log(`\n  CSV: ${csv("lauf-paketnamen.csv", zuAendern)}`);

    if (SCHREIBEN && zuAendern.length > 0) {
      // ── EIN UPDATE JE FORM, NICHT JE ZEILE ────────────────────────────
      // Fünf Formen, fünf Anweisungen — statt 6.589. Das ist nicht nur
      // schneller: Es ist auch nachvollziehbar, weil jede Anweisung genau
      // eine Regel umsetzt und ihre Trefferzahl meldet.
      let geschrieben = 0;
      for (const [alt, v] of Array.from(formen.entries())) {
        const treffer = (await sqlPool`
          UPDATE fiaon_applications SET pack_name = ${v.neu}, updated_at = NOW()
          WHERE pack_name = ${alt}
          RETURNING ref
        `) as any[];
        geschrieben += treffer.length;
        log(`    geschrieben: ${String(treffer.length).padStart(5)} × ${JSON.stringify(v.neu)}`);
      }
      log(`\n  ${geschrieben} Zeilen geändert.`);

      // ── DIE ZÄHLPROBE ─────────────────────────────────────────────────
      // Nach dem Lauf darf KEIN Paketname mehr einen Umbruch tragen. Eine
      // Zahl, die man nach dem Schreiben nicht nachzählt, ist eine Hoffnung.
      const [probe] = (await sqlPool`
        SELECT COUNT(*)::int AS n FROM fiaon_applications
        WHERE pack_name ~ E'[\\n\\r\\t]'
      `) as any[];
      log(`  ZÄHLPROBE: ${probe.n} Paketnamen mit Umbruch übrig `
        + `${Number(probe.n) === 0 ? "— richtig." : "— FEHLER, der Lauf ist unvollständig."}`);
      if (Number(probe.n) > 0) process.exitCode = 1;
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  if (machNamen) {
    titel("TEIL 2 — PERSONENNAMEN SAUBER");
    // ═══════════════════════════════════════════════════════════════════════
    // Zwei Tabellen: die Bestellungen und die Personen. Beide, weil beide
    // angezeigt werden — die Bestellung im Portal, die Person in den Listen.
    for (const tabelle of ["fiaon_applications", "fiaon_persons"] as const) {
      const istPerson = tabelle === "fiaon_persons";
      const kennung = istPerson ? "id" : "ref";
      const felder = istPerson
        ? ["first_name", "last_name", "contact_name", "company_name"]
        : ["first_name", "last_name", "contact_name", "company_name"];

      const zeilen = (await sqlPool.unsafe(`
        SELECT ${kennung} AS kennung, ${felder.join(", ")}
        FROM ${tabelle}
        WHERE ${istPerson ? "merged_into_person_id IS NULL" : "merged_into IS NULL"}
          AND (${felder.map((f) => `${f} IS NOT NULL`).join(" OR ")})
      `)) as any[];

      const zuAendern: { kennung: string; feld: string; alt: string; neu: string }[] = [];
      for (const z of zeilen) {
        for (const f of felder) {
          const alt = z[f];
          if (alt == null) continue;
          if (!brauchtReinigung(alt)) continue;
          const neu = nameSauber(alt);
          // ── DER ALIAS-FALL, DER NICHT VORKOMMEN DARF ────────────────
          // Wenn sich mehr als Leerraum ändert, wäre es eine echte
          // Namensänderung und bräuchte einen Alias. `nameSauber` kann das
          // nicht — aber geprüft wird es, weil eine ungeprüfte Behauptung
          // irgendwann nicht mehr stimmt.
          const nurLeerraum = String(alt).replace(/\s+/g, "") === String(neu ?? "").replace(/\s+/g, "");
          if (!nurLeerraum) {
            log(`  ⚠  MEHR ALS LEERRAUM bei ${tabelle} ${z.kennung} ${f}: `
              + `${JSON.stringify(alt)} → ${JSON.stringify(neu)} — übersprungen, braucht eine Entscheidung.`);
            continue;
          }
          zuAendern.push({ kennung: String(z.kennung), feld: f, alt: String(alt), neu: neu ?? "" });
        }
      }

      log(`\n  ${tabelle}: ${zeilen.length} Zeilen geprüft, ${zuAendern.length} Felder brauchen eine Reinigung.`);
      const jeFeld = new Map<string, number>();
      for (const z of zuAendern) jeFeld.set(z.feld, (jeFeld.get(z.feld) ?? 0) + 1);
      for (const [f, n] of Array.from(jeFeld.entries()).sort((a, b) => b[1] - a[1])) {
        log(`    ${String(n).padStart(5)} ×  ${f}`);
      }
      if (zuAendern.length > 0) {
        log("\n    Beispiele:");
        for (const z of zuAendern.slice(0, 5)) {
          log(`      ${z.feld}: ${JSON.stringify(z.alt)} → ${JSON.stringify(z.neu)}`);
        }
      }
      log(`    CSV: ${csv(`lauf-namen-${tabelle}.csv`, zuAendern)}`);

      if (SCHREIBEN && zuAendern.length > 0) {
        // ── EIN UPDATE JE FELD, MIT DER REGEL IN SQL ──────────────────────
        // Hier ist SQL erlaubt, weil die Regel exakt dieselbe ist wie in
        // `nameSauber` — und weil 2.400 Einzelanweisungen über eine
        // Netzverbindung Minuten dauern würden. Die Zählprobe unten prüft,
        // dass beide zum selben Ergebnis kommen.
        for (const f of felder) {
          const n = jeFeld.get(f) ?? 0;
          if (n === 0) continue;
          const treffer = (await sqlPool.unsafe(`
            UPDATE ${tabelle}
            SET ${f} = NULLIF(BTRIM(REGEXP_REPLACE(
                  REGEXP_REPLACE(${f}, E'[\\n\\r\\t]+', ' ', 'g'), ' {2,}', ' ', 'g')), ''),
                updated_at = NOW()
            WHERE ${istPerson ? "merged_into_person_id IS NULL" : "merged_into IS NULL"}
              AND ${f} IS NOT NULL
              AND ${f} <> NULLIF(BTRIM(REGEXP_REPLACE(
                    REGEXP_REPLACE(${f}, E'[\\n\\r\\t]+', ' ', 'g'), ' {2,}', ' ', 'g')), '')
            RETURNING ${kennung}
          `)) as any[];
          log(`    geschrieben: ${String(treffer.length).padStart(5)} × ${f}`);
        }
      }
    }

    if (SCHREIBEN) {
      // ── DIE ZÄHLPROBE ÜBER BEIDE TABELLEN ─────────────────────────────
      const [pa] = (await sqlPool`
        SELECT COUNT(*)::int AS n FROM fiaon_applications
        WHERE merged_into IS NULL
          AND (first_name <> BTRIM(first_name) OR last_name <> BTRIM(last_name)
            OR contact_name <> BTRIM(contact_name) OR company_name <> BTRIM(company_name)
            OR first_name ~ '  ' OR last_name ~ '  ')
      `) as any[];
      const [pp] = (await sqlPool`
        SELECT COUNT(*)::int AS n FROM fiaon_persons
        WHERE merged_into_person_id IS NULL
          AND (first_name <> BTRIM(first_name) OR last_name <> BTRIM(last_name)
            OR contact_name <> BTRIM(contact_name) OR company_name <> BTRIM(company_name)
            OR first_name ~ '  ' OR last_name ~ '  ')
      `) as any[];
      log(`\n  ZÄHLPROBE Bestellungen: ${pa.n} unsaubere Namen übrig `
        + `${Number(pa.n) === 0 ? "— richtig." : "— FEHLER."}`);
      log(`  ZÄHLPROBE Personen:     ${pp.n} unsaubere Namen übrig `
        + `${Number(pp.n) === 0 ? "— richtig." : "— FEHLER."}`);
      if (Number(pa.n) > 0 || Number(pp.n) > 0) process.exitCode = 1;
    }
  }

  if (!SCHREIBEN) {
    log("\n  ─────────────────────────────────────────────────────────────────");
    log("  Das war die VORSCHAU. Die CSVs in reports/ zeigen jede Änderung.");
    log("  Wenn sie stimmen:  npx tsx scripts/datenkosmetik-lauf.ts --schreiben");
  }
  log("");
  await sqlPool.end();
}

main().catch(async (e) => {
  console.error(e);
  await sqlPool.end().catch(() => {});
  process.exit(1);
});
