// ═══════════════════════════════════════════════════════════════════════════
// Den Anteilskaufvertrag in die Datenbank einspielen — EINMALIG.
//
// Aufruf:  npx tsx scripts/scp-vertrag-einspielen.ts "<Pfad zur PDF>"
//
// WARUM SO: Das Repository ist öffentlich. Der Vertrag darf niemals in einen
// Commit geraten — Git vergisst nichts. Dieses Skript liest die Datei von
// Justins Rechner und schreibt sie direkt in die Datenbank; die PDF berührt
// das Repository nie.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { sqlPool } from "../server/lib/db-pool";
import { ensureScpTabellen } from "../server/routes/fiaon-datenraum-scp";

const pfad = process.argv[2];
if (!pfad || !existsSync(pfad)) {
  console.error("Pfad zur PDF angeben.\nBeispiel:\n  npx tsx scripts/scp-vertrag-einspielen.ts ~/Desktop/vertrag.pdf");
  process.exit(1);
}

(async () => {
  await ensureScpTabellen();
  const daten = readFileSync(pfad);
  if (daten.subarray(0, 4).toString() !== "%PDF") {
    console.error("Das ist keine PDF-Datei.");
    process.exit(1);
  }
  const pruefsumme = createHash("sha256").update(daten).digest("hex");
  await sqlPool`
    INSERT INTO scp_dokumente (schluessel, dateiname, datei, pruefsumme)
    VALUES ('anteilskaufvertrag', 'SWP-Anteilskaufvertrag.pdf', ${daten}, ${pruefsumme})
    ON CONFLICT (schluessel) DO UPDATE
      SET dateiname = EXCLUDED.dateiname, datei = EXCLUDED.datei,
          pruefsumme = EXCLUDED.pruefsumme, updated_at = NOW()`;
  const [z] = (await sqlPool`
    SELECT length(datei) AS bytes, pruefsumme FROM scp_dokumente WHERE schluessel = 'anteilskaufvertrag'`) as any[];
  console.log(`Eingespielt: ${Number(z.bytes).toLocaleString("de-DE")} Bytes`);
  console.log(`Prüfsumme:   ${String(z.pruefsumme).slice(0, 32)} …`);
  await sqlPool.end();
})();
