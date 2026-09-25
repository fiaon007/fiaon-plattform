/**
 * Prüfstand RESET-05 (24.09.2026): Passwort setzen scheitert nie mehr an einem utm-Skalar.
 *
 * Läuft NUR gegen eine lokale Test-Datenbank (127.0.0.1) – nie gegen Produktion:
 *   DATABASE_URL='postgresql://fiaon@127.0.0.1:54339/pruef_reset?sslmode=require' node --import tsx scripts/pruef-reset-utm-skalar.ts
 * Rotprobe (alter Ausdruck, muss rot werden): PRUEF_ROT=1 … dieselbe Zeile.
 *
 * Geprüft wird der WÖRTLICHE Ausdruck aus den drei Quelltextstellen (fiaon-antrag.ts, fiaon-zugang.ts ×2),
 * ausgeführt auf den sechs Formen, die utm in der Produktion hat: Objekt mit/ohne password, JSON-Zeichenkette,
 * Zahl, Liste, NULL.
 *
 * 25.09.2026 (E-242): Der Ausdruck kürzt utm jetzt auf die Erlaubnisliste (lib/fiaon-utm.ts) und macht
 * Text-/Listen-Altformen zu {} — dort lag das Klartext-Passwort nach E-152 weiter. Die Erwartungen unten
 * sind entsprechend nachgezogen; der ausführliche Prüfstand ist scripts/pruef-utm-erlaubnisliste.ts.
 */
import postgres from "postgres";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const url = process.env.DATABASE_URL || "";
if (!/@127\.0\.0\.1:\d+\//.test(url)) {
  console.error("ABBRUCH: DATABASE_URL muss eine lokale Test-Datenbank (127.0.0.1) sein.");
  process.exit(2);
}

const ALT = "utm = COALESCE(utm, '{}'::jsonb) - 'password'";
const NEU = "utm = CASE WHEN utm IS NULL THEN NULL WHEN jsonb_typeof(utm) = 'object' THEN (SELECT COALESCE(jsonb_object_agg(k, v), '{}'::jsonb) FROM jsonb_each(utm) AS u(k, v) WHERE k = ANY(${UTM_SCHLUESSEL_LISTE}::text[])) ELSE '{}'::jsonb END";
const flach = (t: string) => t.replace(/\s+/g, " ");
let fehler = 0;
const pruefe = (ok: boolean, text: string) => { console.log(`${ok ? "OK  " : "ROT "} ${text}`); if (!ok) fehler++; };

// 1. Quelltext: der neue Ausdruck an allen drei Stellen, der alte nirgends mehr im Server.
const stellen = [["server/routes/fiaon-antrag.ts", 1], ["server/lib/fiaon-zugang.ts", 2]] as const;
for (const [datei, soll] of stellen) {
  const n = flach(readFileSync(datei, "utf8")).split(NEU).length - 1;
  pruefe(n === soll, `${datei}: ${n}× neuer Ausdruck (Soll ${soll})`);
}
function dateien(ordner: string): string[] {
  return readdirSync(ordner).flatMap((n) => {
    const p = join(ordner, n);
    return statSync(p).isDirectory() ? dateien(p) : /\.tsx?$/.test(n) ? [p] : [];
  });
}
const alteStellen = dateien("server").filter((p) => readFileSync(p, "utf8").includes(ALT));
pruefe(alteStellen.length === 0, `alter Ausdruck im Server: ${alteStellen.length} Stellen ${alteStellen.join(", ")}`);

// 2. Datenbank: derselbe Ausdruck auf allen utm-Formen.
const ausdruck = process.env.PRUEF_ROT === "1" ? ALT : NEU.replace("${UTM_SCHLUESSEL_LISTE}", "$3");
const { UTM_SCHLUESSEL_LISTE } = await import("../server/lib/fiaon-utm");
const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  await sql`DROP TABLE IF EXISTS pruef_reset_utm`;
  await sql`CREATE TABLE pruef_reset_utm (ref TEXT PRIMARY KEY, password TEXT, utm JSONB, updated_at TIMESTAMPTZ)`;
  const formen: [string, unknown][] = [
    ["objekt-mit", { password: "alt-klartext", utm_source: "meta" }],
    ["objekt-ohne", { utm_source: "google", quelle: "fremd" }],
    ["zeichenkette", JSON.stringify({ password: "alt", utm_source: "make" })],
    ["zahl", 7],
    ["liste", ["a", "password"]],
    ["null", null],
  ];
  for (const [ref, utm] of formen) {
    await sql`INSERT INTO pruef_reset_utm (ref, utm) VALUES (${ref}, ${utm === null ? null : sql.json(utm as any)})`;
  }
  for (const [ref] of formen) {
    try {
      const [zeile] = await sql.unsafe(
        `UPDATE pruef_reset_utm SET password = $1, ${ausdruck}, updated_at = NOW() WHERE ref = $2 RETURNING ref, password, utm`,
        ausdruck === ALT ? ["neuer-hash", ref] : ["neuer-hash", ref, UTM_SCHLUESSEL_LISTE],
      );
      const utm = zeile.utm;
      let erwartet: unknown = {};
      if (ref === "objekt-mit") erwartet = { utm_source: "meta" };
      if (ref === "objekt-ohne") erwartet = { utm_source: "google" };
      if (ref === "null") erwartet = null;
      pruefe(zeile.password === "neuer-hash" && JSON.stringify(utm) === JSON.stringify(erwartet),
        `${ref}: Passwort gesetzt, utm ${JSON.stringify(utm)}`);
    } catch (e: any) {
      pruefe(false, `${ref}: UPDATE scheitert – ${e?.message}`);
    }
  }
  await sql`DROP TABLE IF EXISTS pruef_reset_utm`;
} finally {
  await sql.end();
}
console.log(fehler === 0 ? "\nGRÜN: Passwort setzen übersteht jede utm-Form." : `\nROT: ${fehler} Befund(e).`);
process.exit(fehler === 0 ? 0 : 1);
