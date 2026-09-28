/**
 * ═══════════════════════════════════════════════════════════════════
 * EIN gemeinsamer Datenbank-Pool für die gesamte Anwendung
 * ═══════════════════════════════════════════════════════════════════
 *
 * Warum das nötig war: Achtzehn Module haben sich je einen eigenen Pool
 * angelegt (max 2 bis 10). In Summe konnte die Anwendung damit rund
 * 73 gleichzeitige Verbindungen zur Datenbank aufbauen — dauerhaft, nicht
 * nur unter Last. Render-Postgres bringt keinen Verbindungs-Pooler mit,
 * die Obergrenze der Instanz gilt also unmittelbar. Wird sie erreicht,
 * scheitern Abfragen mit „too many connections" — und im Agent-Portal
 * sah das bislang aus wie eine leere Liste.
 *
 * Ein einziger Pool ist nicht nur sparsamer, sondern auch schneller:
 * Verbindungen werden wiederverwendet statt je Modul neu aufgebaut.
 *
 * Wichtig: Die API ist identisch mit der bisherigen (`sql\`…\``,
 * `sql.unsafe()`, `sql.json()`). An der Geschäftslogik ändert sich nichts.
 */
import postgres from "postgres";
import { ddlWache } from "./ddl-wache";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL fehlt — ohne Datenbank kann der Server nicht starten.");
}

/**
 * Obergrenze bewusst konservativ. Reicht für den Web-Service auf Standard
 * (1 CPU) locker aus: Node arbeitet einthreadig, mehr als eine Handvoll
 * paralleler Abfragen entsteht praktisch nie. Über POOL_MAX anpassbar,
 * falls später mehrere Instanzen laufen.
 */
const MAX = Math.max(2, Math.min(30, Number(process.env.POOL_MAX) || 12));

// ── DIE DDL-WACHE (E-254, 28.09.2026) ──────────────────────────────────
// Am 28.09. stand das Agentenportal 27 Minuten (14:53–15:20): Beim Deploy
// stellten sich die Tabellen-Prüfungen des neuen Servers (`ADD COLUMN IF NOT
// EXISTS` sperrt die Tabelle AUCH, wenn die Spalte schon da ist) hinter eine
// stundenlange Lesung — und dahinter jede weitere Abfrage, bis der Pool voll
// war. Die Wache prüft solche Anweisungen erst im Katalog (ohne Sperre) und
// lässt eine wirklich nötige höchstens 3 s auf ihre Sperre warten. Alles
// andere geht unverändert durch. Einzelheiten und Schalter: ./ddl-wache.ts.
export const sqlPool = ddlWache(postgres(process.env.DATABASE_URL, {
  ssl: "require",
  max: MAX,
  // Leerlaufende Verbindungen nach 30 s zurückgeben, damit die Instanz bei
  // Ruhe keine Plätze belegt.
  idle_timeout: 30,
  // Eine hängende Abfrage darf nicht dauerhaft einen Platz blockieren.
  connect_timeout: 15,
  // Bewusst großzügig. Die einzelnen Pools vorher hatten GAR KEIN Zeitlimit;
  // ein zu enges hier wäre eine neu eingebaute Fehlerquelle gewesen. Das
  // Limit soll ausschließlich echte Hänger abräumen, keine langsamen, aber
  // funktionierenden Abfragen abschneiden.
  connection: { statement_timeout: Number(process.env.DB_STATEMENT_TIMEOUT_MS) || 90_000 },
  onnotice: () => {},
}), "pool");

export default sqlPool;
