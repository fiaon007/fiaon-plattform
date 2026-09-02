// Holt die veröffentlichten Ratgeber-Artikel aus der Datenbank in eine
// JSON-Datei, die scripts/ratgeber-pruefen.ts messen kann. Nur lesend.
//   DBURL=… npx tsx scripts/ratgeber-lesen.ts /tmp/ratgeber.json
//   npx tsx scripts/ratgeber-pruefen.ts /tmp/ratgeber.json
//
// Ohne diesen Leser hat der Prüfstand keine Eingabe — er misst eine Datei, die
// sonst nichts im Verzeichnis erzeugt.
import postgres from "postgres";
import fs from "node:fs";
(async () => {
  const sql = postgres(process.env.DBURL!, { ssl: "require", max: 1 });
  await sql`SET default_transaction_read_only = on`;
  const rows = await sql`SELECT slug, titel, untertitel, teaser, inhalt, kategorie, land, keyword,
                                faq, meta_titel, meta_beschreibung, lesezeit, quelle
                         FROM fiaon_ratgeber WHERE status = ${"veroeffentlicht"} ORDER BY slug`;
  fs.writeFileSync(process.argv[2], JSON.stringify(rows, null, 1));
  console.log(`${rows.length} Artikel → ${process.argv[2]}`);
  await sql.end();
})();
