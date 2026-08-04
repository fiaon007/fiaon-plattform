// ═══════════════════════════════════════════════════════════════════════════
// Reparatur: Telefonnummern ohne Ländervorwahl
//
// Gemeldet von den Agenten: „Beim Anrufen fehlt die Vorwahl, ich kann den Kunden
// nicht direkt anrufen." Gemessen am 04.08.2026: 2.058 von 4.521 Personen hatten
// in `primary_phone` eine Nummer ohne „+", obwohl in der zugehörigen Bestellung
// `phone_country_code` daneben stand. Beim Anlegen der Person wurde nur die
// nationale Nummer übernommen.
//
// Die Anzeige ist inzwischen reparaturfest (server/lib/fiaon-telefon.ts setzt zur
// Laufzeit zusammen). Dieses Skript räumt zusätzlich die DATEN auf, damit auch
// Suche, Export und künftige Auswertungen die vollständige Nummer sehen.
//
// Standard ist eine VORSCHAU. Erst `--schreiben` ändert etwas.
//   npx tsx scripts/repariere-telefonnummern.ts
//   npx tsx scripts/repariere-telefonnummern.ts --schreiben
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { sqlPool } from "../server/lib/db-pool";
import { waehlbareNummer } from "../server/lib/fiaon-telefon";

const SCHREIBEN = process.argv.includes("--schreiben");

(async () => {
  const kandidaten = await sqlPool`
    SELECT p.id, p.primary_phone, p.country,
           (SELECT a.phone FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.merged_into IS NULL AND NULLIF(a.phone,'') IS NOT NULL
             ORDER BY a.created_at DESC LIMIT 1) AS app_phone,
           (SELECT a.phone_country_code FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.merged_into IS NULL AND NULLIF(a.phone,'') IS NOT NULL
             ORDER BY a.created_at DESC LIMIT 1) AS app_vorwahl,
           (SELECT NULLIF(a.country,'') FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.merged_into IS NULL AND NULLIF(a.country,'') IS NOT NULL
             ORDER BY a.created_at DESC LIMIT 1) AS app_country
    FROM fiaon_persons p
    WHERE p.merged_into_person_id IS NULL
      AND p.primary_phone IS NOT NULL
      AND p.primary_phone NOT LIKE '+%'
  `;

  console.log(`${kandidaten.length} Personen mit Nummer ohne Ländervorwahl\n`);

  let reparabel = 0;
  let offen = 0;
  const beispiele: string[] = [];

  for (const p of kandidaten as any[]) {
    const tel = waehlbareNummer(
      [
        { nummer: p.app_phone, vorwahl: p.app_vorwahl },
        { nummer: p.primary_phone, vorwahl: p.app_vorwahl },
      ],
      p.country || p.app_country,
    );
    if (tel.waehlbar) {
      reparabel++;
      if (beispiele.length < 8) beispiele.push(`  ${String(p.primary_phone).padEnd(18)} → ${tel.waehlbar}`);
      if (SCHREIBEN) {
        // Nur `primary_phone` wird angefasst. `phone_key9` (die letzten neun
        // Ziffern) bleibt unverändert richtig — die Vorwahl ändert die letzten
        // neun Ziffern nicht, also bleiben alle Dubletten-Vergleiche gültig.
        await sqlPool`
          UPDATE fiaon_persons SET primary_phone = ${tel.waehlbar}, updated_at = NOW()
          WHERE id = ${p.id}
        `;
      }
    } else {
      offen++;
    }
  }

  console.log("Beispiele:");
  console.log(beispiele.join("\n"));
  console.log(`\nReparabel: ${reparabel}`);
  console.log(`Ohne erkennbares Land (bleiben unverändert, Oberfläche zeigt „Vorwahl fehlt"): ${offen}`);
  console.log(SCHREIBEN ? "\nGeschrieben." : "\nNur Vorschau — mit --schreiben ausführen.");
  await sqlPool.end();
})().catch(async (e) => { console.error(e); await sqlPool.end(); process.exit(1); });
