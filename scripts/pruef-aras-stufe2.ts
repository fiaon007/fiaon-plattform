// Prüfstand (Justin 22.10.2026: „Stufe 2“): der Einmal-Schalter ab Fr 23.10. 09:30 Berlin — nur aus Stufe 1, genau einmal.
// Nur gegen die lokale Prüf-DB:
//   DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_stufe2?sslmode=require' \
//   DATABASE_URL_EXTERN='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_stufe2?sslmode=require' \
//   npx tsx scripts/pruef-aras-stufe2.ts
let gut = 0, schlecht = 0;
const ok = (was: string, b: unknown, extra = "") => { if (b) { gut++; console.log(`  ✓ ${was}`); } else { schlecht++; console.log(`  ✗ ${was}${extra ? ` — ${extra}` : ""}`); } };

async function main() {
  const { STUFEN, stufenGrenzen, rateTagErlaubt } = await import("../shared/fiaon-aras");
  console.log("── rein");
  ok("Stufe 2 = 150 am Tag, 2 gleichzeitig, 60 €", STUFEN[2].versucheJeTag === 150 && STUFEN[2].parallel === 2 && STUFEN[2].tagEuro === 60);
  ok("Stufe 2 und 3 nur überfällige Raten (Tag 1–45, nie heute/morgen fällig)", [2, 3].every((s) => rateTagErlaubt(s, 1) && rateTagErlaubt(s, 45) && !rateTagErlaubt(s, 0) && !rateTagErlaubt(s, -1)));
  const g = stufenGrenzen({ stufe: 2, parallel: 2, tagEuro: 60, spielarten: { rate: true, willkommen: true, termin: true } });
  ok("mit den Schaltern 2 / 60 € greift Stufe 2 voll", g.parallel === 2 && g.tagEuro === 60 && g.versucheJeTag === 150);
  ok("ohne die Schalter (1 / 20 €) bliebe Stufe 2 bei 1 Leitung und 20 € — darum setzt der Schalter beide", stufenGrenzen({ stufe: 2, parallel: 1, tagEuro: 20, spielarten: {} }).parallel === 1);

  if (!/(?:127\.0\.0\.1|localhost):54329\//.test(String(process.env.DATABASE_URL))) { console.log("\n(DB-Teil übersprungen: keine lokale Prüf-DB)"); return; }
  console.log("── Datenbank (lokal)");
  const { sqlPool } = await import("../server/lib/db-pool");
  const { arasSchema, arasSchemaZuruecksetzen } = await import("../server/lib/fiaon-aras-schema");
  const { einstellungSetzen } = await import("../server/lib/fiaon-aras-plan");
  const { stufe2Pruefen, STUFE2_MERKER } = await import("../server/lib/fiaon-aras-golive");
  arasSchemaZuruecksetzen(); await arasSchema();
  const wert = async (k: string) => String(((await sqlPool`SELECT value FROM fiaon_settings WHERE key = ${k}`) as any[])[0]?.value ?? "");
  const anfang = async (stufe: string) => {
    await sqlPool`DELETE FROM fiaon_settings WHERE key = ${STUFE2_MERKER}`;
    await einstellungSetzen("aras_stufe", stufe, "pruefstand"); await einstellungSetzen("aras_parallel", "1", "pruefstand"); await einstellungSetzen("aras_tag_euro", "20", "pruefstand");
  };
  await anfang("1");
  ok("vor Fr 23.10. 09:30 → nichts", !(await stufe2Pruefen(sqlPool, new Date("2026-10-23T09:29:00+02:00"))) && (await wert("aras_stufe")) === "1" && !(await wert(STUFE2_MERKER)));
  ok("ab 09:30 aus Stufe 1 → läuft", await stufe2Pruefen(sqlPool, new Date("2026-10-23T09:31:00+02:00")));
  ok("… Stufe 2, 2 gleichzeitig, 60 € am Tag", (await wert("aras_stufe")) === "2" && (await wert("aras_parallel")) === "2" && (await wert("aras_tag_euro")) === "60", `${await wert("aras_stufe")}/${await wert("aras_parallel")}/${await wert("aras_tag_euro")}`);
  ok("zweiter Lauf → nie wieder (Merker)", !(await stufe2Pruefen(sqlPool, new Date("2026-10-23T09:40:00+02:00"))));
  await einstellungSetzen("aras_stufe", "1", "pruefstand");
  ok("… auch nicht, nachdem jemand von Hand zurück auf 1 stellt", !(await stufe2Pruefen(sqlPool, new Date("2026-10-23T11:00:00+02:00"))) && (await wert("aras_stufe")) === "1");
  await anfang("0");
  ok("Rot-Probe: steht ARAS auf Stufe 0 (angehalten), bleibt sie dort — der Schalter läuft einmal und ändert nichts", (await stufe2Pruefen(sqlPool, new Date("2026-10-23T09:31:00+02:00"))) && (await wert("aras_stufe")) === "0" && (await wert("aras_parallel")) === "1");
  const [p] = (await sqlPool`SELECT text FROM fiaon_mara_protokoll WHERE text LIKE 'Stufe 2 (Justin 22.10.) NICHT geschaltet%' ORDER BY id DESC LIMIT 1`) as any[];
  ok("… und das Protokoll sagt es", /Stufe 0/.test(String(p?.text)));
  await sqlPool.end({ timeout: 2 });
}

main()
  .catch((e) => { schlecht++; console.error("ABBRUCH:", e); })
  .finally(() => { console.log(`\n${gut} Prüfungen bestanden, ${schlecht} rot.`); process.exit(schlecht ? 1 : 0); });
