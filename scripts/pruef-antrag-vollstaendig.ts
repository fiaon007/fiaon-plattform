// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: DIE ZWEI FASSUNGEN DER VOLLSTÄNDIGKEITS-REGEL
//
// `server/lib/fiaon-antrag-vollstaendig.ts` beantwortet „ist der Antrag fertig?"
// zweimal: als TypeScript (`antragVollstaendig`, für eine Zeile) und als SQL
// (`antragVollstaendigSql`, für 1.000 Zeilen in einer Abfrage).
//
// AGENTS.md erlaubt das ausdrücklich NUR, wenn ein Prüfstand beide
// GEGENEINANDER hält — „an jeder Konstellation". Genau das tut dieser Lauf:
// Er bewertet den ganzen Bestand einmal mit SQL und einmal mit TypeScript und
// vergleicht Zeile für Zeile.
//
// Dazu prüft er die Fehlerklasse, aus der der Auftrag kam: den Rückfall auf den
// ERSTEN Schritt bei einem unbekannten Formularschritt.
//
// NUR LESEND — keine Transaktion nötig, weil nichts geschrieben wird.
//
//   npx tsx scripts/pruef-antrag-vollstaendig.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { readFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import {
  PFLICHTFELDER, PFLICHTFELDER_FIRMA, antragVollstaendig, antragVollstaendigSql,
  fehlendeFelder, fehlendeFelderAusdruckSql, FORMULAR_SCHRITTE_SQL,
} from "../server/lib/fiaon-antrag-vollstaendig";
import { SCHRITT_ZUSTAND, zustandFuerSchritt } from "../shared/fiaon-antrag-schritte";
import { RECHNUNGSREIF } from "../server/lib/fiaon-rechnung-stellen";

let bestanden = 0;
let fehlgeschlagen = 0;
const log = (s = "") => console.log(s);
function ok(name: string, b: boolean, detail = ""): void {
  if (b) { bestanden++; log(`  PASS  ${name}`); }
  else { fehlgeschlagen++; log(`  FAIL  ${name}${detail ? `  → ${detail}` : ""}`); }
}
function gruppe(t: string): void { log(`\n── ${t} ${"─".repeat(Math.max(0, 56 - t.length))}`); }

async function main(): Promise<void> {
  log("\n══ Prüfstand: Antrags-Vollständigkeit ══");

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("1. Die Schritt-Zuordnung fällt NICHT auf den Anfang zurück");
  // ═════════════════════════════════════════════════════════════════════════
  // Das ist der Fehler, der 35 fertige Anträge als „im Formular" markiert hat.
  ok("Schritt 9 ergibt nicht „started“", zustandFuerSchritt(9) !== "started",
    `ergab ${zustandFuerSchritt(9)}`);
  ok("Schritt 9 ist rechnungsreif",
    (RECHNUNGSREIF as readonly string[]).includes(zustandFuerSchritt(9)),
    `${zustandFuerSchritt(9)} steht nicht in RECHNUNGSREIF`);
  // Der ungünstigste Fall, nicht der erstbeste: weit jenseits der Liste.
  for (const s of [10, 12, 99]) {
    ok(`Ein unbekannter Schritt ${s} fällt auf den HÖCHSTEN, nicht den ersten`,
      zustandFuerSchritt(s) !== "started", `ergab ${zustandFuerSchritt(s)}`);
  }
  ok("Schritt 0 bleibt „started“", zustandFuerSchritt(0) === "started");
  ok("Jeder Schritt 0..9 hat eine Zuordnung",
    Array.from({ length: 10 }, (_, i) => i).every((i) => SCHRITT_ZUSTAND[i]));

  // ── DIE ALTE ZEILE DARF NICHT ZURÜCKKOMMEN ──────────────────────────────
  // Ein Grep auf Abwesenheit trifft sonst den Kommentar, der erklärt, warum sie
  // weg ist (AGENTS.md). Also den kommentarfreien Text prüfen.
  const antragQuelle = readFileSync("client/src/pages/antrag.tsx", "utf8");
  const ohneKommentar = antragQuelle
    .split("\n")
    .filter((z) => !z.trim().startsWith("//") && !z.trim().startsWith("*") && !z.trim().startsWith("/*"))
    .join("\n");
  ok("Kein Index-Rückfall auf „started“ mehr im Formular",
    !/\]\[step\]\s*\|\|\s*["']started["']/.test(ohneKommentar));
  ok("Das Formular benutzt `zustandFuerSchritt`",
    /zustandFuerSchritt\(step\)/.test(ohneKommentar));
  ok("Der Schritt-Schreiber verschluckt seinen Fehler nicht mehr",
    !/currentStep: step[\s\S]{0,400}?\.catch\(\(\)\s*=>\s*\{\s*\}\)/.test(ohneKommentar));

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("2. TypeScript und SQL sagen dasselbe — am ganzen Bestand");
  // ═════════════════════════════════════════════════════════════════════════
  const spalten = Array.from(new Set(
    [...PFLICHTFELDER, ...PFLICHTFELDER_FIRMA].map((f) => f.spalte),
  ));
  const zeilen = (await sqlPool.unsafe(`
    SELECT a.ref, a.type, a.status, a.billing_method,
           ${spalten.map((s) => `a.${s}`).join(", ")},
           ${antragVollstaendigSql("a")} AS sql_voll,
           ${fehlendeFelderAusdruckSql("a")} AS sql_fehlt
      FROM fiaon_applications a
     WHERE a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
     ORDER BY a.updated_at DESC NULLS LAST
     LIMIT 4000
  `)) as any[];
  log(`        ${zeilen.length} Anträge bewertet.`);

  const uneinigVoll: string[] = [];
  const uneinigFehlt: string[] = [];
  for (const z of zeilen) {
    if (Boolean(z.sql_voll) !== antragVollstaendig(z)) uneinigVoll.push(String(z.ref));
    const ts = fehlendeFelder(z).join(", ");
    const sq = String(z.sql_fehlt ?? "");
    if (ts !== sq) uneinigFehlt.push(`${z.ref}: TS „${ts}“ ≠ SQL „${sq}“`);
  }
  ok("„Ist vollständig?“ — beide Fassungen stimmen bei JEDER Zeile überein",
    uneinigVoll.length === 0,
    `${uneinigVoll.length} Abweichungen, z. B. ${uneinigVoll.slice(0, 3).join(", ")}`);
  ok("„Was fehlt?“ — beide Fassungen nennen dieselben Felder in derselben Folge",
    uneinigFehlt.length === 0,
    `${uneinigFehlt.length} Abweichungen, z. B. ${uneinigFehlt.slice(0, 2).join(" | ")}`);

  // Und die Regel muss überhaupt etwas unterscheiden — eine Bedingung, die
  // immer wahr (oder immer falsch) ist, wäre grün und wertlos.
  const wieViele = zeilen.filter((z) => z.sql_voll).length;
  ok("Die Regel trennt wirklich (nicht alles gleich)",
    wieViele > 0 && wieViele < zeilen.length,
    `${wieViele} von ${zeilen.length} gelten als vollständig`);

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("3. Die Fehlt-Angabe ist Klartext, keine Spaltennamen");
  // ═════════════════════════════════════════════════════════════════════════
  const namen = [...PFLICHTFELDER, ...PFLICHTFELDER_FIRMA].map((f) => f.name);
  ok("Kein Pflichtfeld-Name enthält einen Unterstrich (also keinen Spaltennamen)",
    namen.every((n) => !n.includes("_")), namen.filter((n) => n.includes("_")).join(", "));
  ok("Kein Name trägt Anführungszeichen (sie werden als SQL-Literal eingesetzt)",
    namen.every((n) => !n.includes("'")));
  const beispiel = zeilen.find((z) => !z.sql_voll && z.sql_fehlt);
  ok("Mindestens ein Fall nennt seine Lücke im Klartext", !!beispiel,
    "kein Beispiel gefunden");
  if (beispiel) log(`        Beispiel ${beispiel.ref}: „Es fehlt: ${beispiel.sql_fehlt}“`);

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("4. Der Bestand: kein fertiger Antrag hängt mehr im Formular");
  // ═════════════════════════════════════════════════════════════════════════
  // AGENTS.md: Bestandsprüfungen trennen Altbestand von Neuzugang. Frisches
  // wird GEMELDET, nicht gewertet — sonst wird der Prüfstand rot, weil der
  // Produktionsserver noch die alte Fassung ausliefert.
  const [alt] = (await sqlPool.unsafe(`
    SELECT COUNT(*)::int AS n FROM fiaon_applications a
     WHERE a.merged_into IS NULL AND a.archived_at IS NULL AND a.gdpr_deleted_at IS NULL
       AND a.payment_status NOT IN ('paid', 'refunded')
       AND a.status IN (${FORMULAR_SCHRITTE_SQL})
       AND ${antragVollstaendigSql("a")}
       AND a.updated_at < NOW() - INTERVAL '1 hour'
  `)) as any[];
  ok("Altbestand: 0 vollständige Anträge auf einem Formularschritt",
    Number(alt.n) === 0, `${alt.n} übrig — Nachzieh-Lauf erneut aufrufen`);

  const [frisch] = (await sqlPool.unsafe(`
    SELECT COUNT(*)::int AS n FROM fiaon_applications a
     WHERE a.merged_into IS NULL AND a.archived_at IS NULL AND a.gdpr_deleted_at IS NULL
       AND a.payment_status NOT IN ('paid', 'refunded')
       AND a.status IN (${FORMULAR_SCHRITTE_SQL})
       AND ${antragVollstaendigSql("a")}
       AND a.updated_at >= NOW() - INTERVAL '1 hour'
  `)) as any[];
  log(`        Neuzugang (< 1 h): ${frisch.n} — gemeldet, nicht gewertet.`);
  if (Number(frisch.n) > 0) {
    log("        Das ist erwartbar, solange die alte Fassung von antrag.tsx läuft.");
    log("        Nach dem Deploy: npx tsx scripts/antrag-zustand-nachziehen.ts --schreiben");
  }

  log(`\n══ ${bestanden} ok, ${fehlgeschlagen} rot ══\n`);
  await sqlPool.end();
  if (fehlgeschlagen > 0) process.exit(1);
}

main().catch(async (e) => { console.error(e); await sqlPool.end(); process.exit(1); });
