import "dotenv/config";
import { sqlPool } from "../server/lib/db-pool";
import { berlinToday } from "../server/lib/fiaon-time";
const [r] = await sqlPool`SELECT NOW() AS utc, NOW() AT TIME ZONE 'Europe/Berlin' AS berlin` as any[];
console.log("DB NOW (UTC):", r.utc);
console.log("DB Berlin:   ", r.berlin);
console.log("berlinToday():", berlinToday());
const [t] = await sqlPool`
  SELECT date_trunc('day', ${berlinToday()}::date) AS von,
         date_trunc('day', ${berlinToday()}::date) + INTERVAL '1 day' AS bis,
         (NOW() >= date_trunc('day', ${berlinToday()}::date)
          AND NOW() < date_trunc('day', ${berlinToday()}::date) + INTERVAL '1 day') AS jetzt_drin` as any[];
console.log("Fenster:", t.von, "→", t.bis);
console.log("Zaehlt eine Buchung von JETZT mit?", t.jetzt_drin);
await sqlPool.end();
