// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND MIT DATENBANK: DIE KI-KASSE (E-458, 29.10.2026)
//
// Gegen eine EIGENE Kopie der lokalen Prüf-DB (nie Produktion), ohne Netz (fetch ist nachgebaut):
//   1. nutzungMerken schreibt cached_tokens und echte Dollar-Cent; kostenHeute zählt den Berliner Tag
//   2. Die Kasse bremst B2B, wenn der Topf leer ist — OHNE Netzaufruf; Antworten an Menschen laufen weiter
//   3. Gesamtdeckel: dann wartet auch das Postfach (KiPausiertFehler „kasse“, Meldung „KI pausiert — KI-Kasse …“)
//   4. Nachhol-Bremse nach einer Pause: Antworten zuerst
//   5. Die Lage fürs Chefbüro (Töpfe, Status, Cache-Quote, Bremsungen)
//   6. Register: Anteile speichern (falsch → abgelehnt, richtig → gilt sofort)
//   7. Die alten Deckel einmal auf echte Dollar (nur im Produktionsdienst — hier simuliert), genau einmal
//
//   createdb -h 127.0.0.1 -p 54329 -U fiaon -T fiaon_pruefstand fiaon_pruefstand_e458k
//   env -i PATH="$PATH" HOME="$HOME" TZ=Europe/Berlin DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_e458k?sslmode=require' \
//     SESSION_SECRET=pruefstand-nur-lokal DOTENV_CONFIG_PATH=/dev/null CRONS=aus node_modules/.bin/tsx scripts/pruef-ki-kasse-db.ts
// ═══════════════════════════════════════════════════════════════════════════
for (const k of ["BREVO_API_KEY", "WHATSAPP_TOKEN", "GOOGLE_SA_KEY", "TWILIO_AUTH_TOKEN", "ANTHROPIC_API_KEY"]) {
  if (process.env[k]) { console.error(`${k} ist gesetzt — Abbruch, der Prüfstand darf nichts versenden.`); process.exit(3); }
}
if (!/127\.0\.0\.1:54329\/fiaon_pruefstand_e458k(\?|$)/.test(String(process.env.DATABASE_URL))) { console.error("NUR gegen die eigene lokale Kopie fiaon_pruefstand_e458k!"); process.exit(3); }
process.env.CRONS = "aus";
process.env.OPENAI_API_KEY = "sk-pruef-lokal-e458";
process.env.KI_ANBIETER = "openai";

let netz = 0;
(globalThis as any).fetch = async (input: any) => {
  const url = typeof input === "string" ? input : String(input?.url ?? input);
  if (!/api\.openai\.com/.test(url)) throw new Error(`Kein Netz im Prüfstand: ${url}`);
  netz++;
  return new Response(JSON.stringify({ id: "resp_pruef", status: "completed", output: [], usage: { input_tokens: 10, output_tokens: 2 } }), { status: 200, headers: { "content-type": "application/json" } });
};

let gut = 0, schlecht = 0;
const ok = (b: unknown, was: string, extra = "") => { if (b) { gut++; console.log(`  ✓ ${was}`); } else { schlecht++; console.log(`  ✗ ${was}${extra ? ` — ${extra}` : ""}`); } };

const { sqlPool: sql } = await import("../server/lib/db-pool");
const S = await import("../server/lib/fiaon-postmeister-schema");
const KS = await import("../server/lib/fiaon-ki-kasse");
const P = await import("../server/lib/fiaon-ki-pause");
const E = await import("../server/lib/fiaon-ki-einstellungen");

const SCHLUESSEL = ["ki_kasse_an", "ki_kasse_tag_usd", "ki_kasse_anteile", "ki_kasse_nachhol_je_stunde", "ki_pause", "ki_kasse_umgestellt", "mara_aktion_tag_euro", "mara_wa_tag_euro", "postmeister_tag_euro"];
const aufraeumen = async () => {
  await sql`DELETE FROM fiaon_settings WHERE key = ANY(${SCHLUESSEL})`;
  await sql`DELETE FROM fiaon_ki_nutzung WHERE created_at > NOW() - INTERVAL '3 days'`;
};
const setzen = async (k: string, v: string) => { await sql`INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${k}, ${v}, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`; };
const zeile = async (dienst: string, cents: number, vorMin = 1) => {
  await sql`INSERT INTO fiaon_ki_nutzung (dienst, modell, prompt_tokens, completion_tokens, reasoning_tokens, dauer_ms, kosten_cents, ok, created_at)
            VALUES (${dienst}, 'gpt-5.5', 1000, 100, 0, 10, ${cents}, TRUE, NOW() - make_interval(mins => ${vorMin}))`;
};
const neu = () => { KS.kasseZuruecksetzen(); P.kiPauseZwischenspeicherLeeren(); };
const rufen = async (dienst: string) => {
  const vorher = netz;
  try {
    await P.openaiFetch(dienst, "/responses", { method: "POST", headers: { Authorization: "Bearer sk-pruef-lokal-e458", "Content-Type": "application/json" }, body: "{}" });
    return { netz: netz - vorher, fehler: null as any };
  } catch (e) { return { netz: netz - vorher, fehler: e as any }; }
};

try {
  await S.postmeisterSchema();
  await aufraeumen();
  neu();

  console.log("── 1 · Protokoll: echte Dollar, Cache, Berliner Tag");
  await S.nutzungMerken({ dienst: "postmeister-antwort", modell: "gpt-5.5", dauerMs: 1200, ok: true,
    usage: { prompt_tokens: 20_000, completion_tokens: 800, prompt_tokens_details: { cached_tokens: 15_000 } } });
  const [r] = (await sql`SELECT cached_tokens, kosten_cents::float AS c FROM fiaon_ki_nutzung WHERE dienst = 'postmeister-antwort' ORDER BY id DESC LIMIT 1`) as any[];
  ok(Number(r?.cached_tokens) === 15_000, "cached_tokens steht in der Zeile", JSON.stringify(r));
  ok(Math.abs(Number(r?.c) - 5.65) < 1e-6, "Kosten 5,65 Cent (5.000 × 0,5 + 15.000 × 0,05 + 800 × 3 je 1.000)", String(r?.c));
  ok(Math.abs((await S.kostenHeute("postmeister-antwort")) - 0.0565) < 1e-6, "kostenHeute: 0,0565 $");
  await sql`INSERT INTO fiaon_ki_nutzung (dienst, modell, prompt_tokens, completion_tokens, kosten_cents, ok, created_at)
            VALUES ('postmeister-antwort', 'gpt-5.5', 1, 1, 500, TRUE, (date_trunc('day', NOW() AT TIME ZONE 'Europe/Berlin') - INTERVAL '1 minute') AT TIME ZONE 'Europe/Berlin')`;
  ok(Math.abs((await S.kostenHeute("postmeister-antwort")) - 0.0565) < 1e-6, "ROT-PROBE eine Zeile von 23:59 Berlin gestern zählt nicht zu heute");

  console.log("── 2 · B2B-Topf leer: der Radar wartet, ohne Netz");
  await aufraeumen();
  await setzen("ki_kasse_tag_usd", "10");
  neu();
  let x = await rufen("radar");
  ok(!x.fehler && x.netz === 1, "frischer Tag: Radar ruft OpenAI");
  await zeile("radar", 760);
  neu();
  x = await rufen("radar");
  ok(P.istKiPause(x.fehler) && x.fehler?.art === "kasse" && x.netz === 0, "ROT-PROBE 7,60 $ von 7,50 $ (B2B 75 % von 10 $): KiPausiertFehler „kasse“, kein Netzaufruf", String(x.fehler?.message ?? "").slice(0, 120));
  ok(/^KI pausiert — KI-Kasse: Anteil „B2B-Neukunden“/.test(String(x.fehler?.message)), "Meldung: „KI pausiert — KI-Kasse: Anteil „B2B-Neukunden“ …“");
  x = await rufen("postmeister-antwort");
  ok(!x.fehler && x.netz === 1, "das Postfach antwortet weiter");
  ok(!(await P.kiPausiert()) && !(await P.kiPauseLesen(true)).an, "keine gespeicherte Pause, kein Band — die Kasse ist keine KI-Pause");

  console.log("── 3 · Gesamtdeckel: dann wartet auch das Postfach");
  await zeile("postmeister-antwort", 260);
  neu();
  x = await rufen("postmeister-antwort");
  ok(P.istKiPause(x.fehler) && x.fehler?.art === "kasse" && x.netz === 0 && /Tagesdeckel erreicht/.test(String(x.fehler?.message)), "ROT-PROBE 10,20 $ von 10 $: Postfach wartet bis 0 Uhr, kein Netz");
  await setzen("ki_kasse_an", "aus");
  neu();
  x = await rufen("radar");
  ok(!x.fehler && x.netz === 1, "Kasse aus: nur messen, nie bremsen");
  await setzen("ki_kasse_an", "an");

  console.log("── 4 · Nachhol-Bremse nach einer Pause");
  await aufraeumen();
  await setzen("ki_pause", JSON.stringify({ an: false, art: "abrechnung", seit: new Date(Date.now() - 3 * 3_600_000).toISOString(), aufgehobenAm: new Date(Date.now() - 10 * 60_000).toISOString(), verlauf: [] }));
  neu();
  x = await rufen("ocr");
  ok(P.istKiPause(x.fehler) && x.netz === 0 && /zuerst die Antworten an Menschen/.test(String(x.fehler?.message)), "erste halbe Stunde: Texterkennung wartet");
  x = await rufen("mara-whatsapp");
  ok(!x.fehler && x.netz === 1, "… WhatsApp-Antworten holen sofort nach");
  await zeile("postmeister-antwort", 820, 5);
  neu();
  x = await rufen("mara-whatsapp");
  ok(P.istKiPause(x.fehler) && x.netz === 0 && /Nachhol-Bremse/.test(String(x.fehler?.message)), "ROT-PROBE 8,20 $ in der letzten Stunde: auch WhatsApp wartet ein paar Minuten");

  console.log("── 5 · Die Lage fürs Chefbüro");
  await aufraeumen();
  await setzen("ki_kasse_tag_usd", "55");
  await zeile("radar", 1200);
  await zeile("mara-aktion", 300);
  await S.nutzungMerken({ dienst: "mara-whatsapp", modell: "gpt-5.5", dauerMs: 900, ok: true, usage: { input_tokens: 10_000, output_tokens: 200, input_tokens_details: { cached_tokens: 6_000 } } });
  neu();
  await rufen("mara-aktion"); // 3 $ von 2,75 $ → gebremst (Anteil Privat)
  const lage = await KS.kasseLage();
  const topf = (k: string) => lage.toepfe.find((t) => t.key === k)!;
  // WhatsApp: 4.000 × 0,5 + 6.000 × 0,05 + 200 × 3 je 1.000 = 2,0 + 0,3 + 0,6 = 2,9 Cent
  ok(lage.tagUsd === 55 && Math.abs(lage.summeCents - (1200 + 300 + 2.9)) < 0.01, `Summe heute ${(lage.summeCents / 100).toFixed(4)} $ (Radar 12 + Aktion 3 + WhatsApp 0,029)`);
  ok(topf("b2b").grenzeCents === 4125 && topf("b2b").cents === 1200 && topf("privat").gebremst >= 1, "Töpfe: B2B 12 $ von 41,25 $; Privat gebremst");
  ok(lage.status === "laeuft" && /Läuft/.test(lage.statusText), "Status: läuft");
  ok(lage.cache.some((c) => c.dienst === "mara-whatsapp" && c.quote === 60), "Cache-Quote heute: WhatsApp 60 %");
  ok(lage.bremsen.some((b) => /mara-aktion · anteil/.test(b.text)), "Bremsung steht im Protokoll (Dienst ki-kasse)");
  ok(lage.modelle.find((m) => m.aufgabe === "postfach")?.modell === "gpt-5.5" && lage.modelle.find((m) => m.aufgabe === "einordnen")?.schluessel === "ki_modell_einordnen", "Modell je Aufgabe: Postfach gpt-5.5 (fest), Einordnen umschaltbar");

  console.log("── 6 · Anteile speichern");
  const falsch = await E.einstellungSetzen("ki_kasse_anteile", '{"b2b":80,"menschen":10,"privat":5,"haus":5,"reserve":5}', "Prüfstand");
  ok(!falsch.ok && (falsch as any).status === 400, "105 % → abgelehnt, nichts gespeichert");
  const richtig = await E.einstellungSetzen("ki_kasse_anteile", '{"b2b":60,"menschen":20,"privat":5,"haus":10,"reserve":5}', "Prüfstand");
  ok(richtig.ok, "60/20/5/10/5 gespeichert");
  const lage2 = await KS.kasseLage();
  ok(lage2.toepfe.find((t) => t.key === "b2b")!.grenzeCents === 3300, "gilt sofort: B2B-Topf jetzt 33 $");
  const sicht = await E.einstellungenLesen();
  ok(sicht.werte.ki_kasse_tag_usd === "55" && sicht.werte.postmeister_tag_euro === "40", "Einstellungen-Seite: Gesamtdeckel 55, Postfach-Deckel 40 (Vorgabe)");

  console.log("── 7 · Die alten Deckel einmal auf echte Dollar");
  await aufraeumen();
  await setzen("mara_aktion_tag_euro", "80");
  await setzen("postmeister_tag_euro", "5");
  // Zwei alte Zeilen (vor E-458: ohne cached_tokens, alte Hausrechnung) und eine Claude-Zeile, die bleiben muss.
  await sql`INSERT INTO fiaon_ki_nutzung (dienst, modell, prompt_tokens, completion_tokens, kosten_cents, ok, created_at) VALUES
            ('postmeister-antwort', 'gpt-5.5', 20000, 800, 3.3, TRUE, NOW() - INTERVAL '2 hours'),
            ('ocr', 'gpt-4.1-2025-04-14', 2000, 4000, 3.4, TRUE, NOW() - INTERVAL '3 hours'),
            ('mara-whatsapp', 'claude-opus-5-5', 1000, 100, 7.7, TRUE, NOW() - INTERVAL '3 hours')`;
  neu();
  P.kiPauseProduktionSimulieren(false);
  await KS.kasseTakt();
  ok((await sql`SELECT value FROM fiaon_settings WHERE key = 'mara_aktion_tag_euro'` as any[])[0]?.value === "80", "außerhalb des Produktionsdienstes: nichts umgestellt");
  KS.kasseZuruecksetzen();
  P.kiPauseProduktionSimulieren(true);
  await KS.kasseTakt();
  const w = async (k: string) => String((await sql`SELECT value FROM fiaon_settings WHERE key = ${k}` as any[])[0]?.value ?? "");
  ok((await w("mara_aktion_tag_euro")) === "30" && (await w("postmeister_tag_euro")) === "17" && (await w("mara_wa_tag_euro")) === "", "umgestellt: Aktion 80 → 30 $, Postfach 5 → 17 $, WhatsApp ohne Wert bleibt bei der Vorgabe");
  ok(/"faktor":3\.3/.test(await w("ki_kasse_umgestellt")), "Marke ki_kasse_umgestellt mit Vorher→Nachher");
  const alt = (await sql`SELECT modell, kosten_cents::float AS c FROM fiaon_ki_nutzung
                           WHERE created_at BETWEEN NOW() - INTERVAL '4 hours' AND NOW() - INTERVAL '90 minutes' ORDER BY modell`) as any[];
  const c = (m: string) => Number(alt.find((z) => z.modell === m)?.c);
  ok(Math.abs(c("gpt-5.5") - 12.4) < 1e-6 && Math.abs(c("gpt-4.1-2025-04-14") - 3.6) < 1e-6, "alte Zeilen nachgerechnet: gpt-5.5 3,3 → 12,4 Cent, gpt-4.1 3,4 → 3,6 Cent", JSON.stringify(alt));
  ok(Math.abs(c("claude-opus-5-5") - 7.7) < 1e-6, "Claude-Zeile bleibt, wie sie ist");
  ok(/"nachgerechnet":\{"zeilen":\d+/.test(await w("ki_kasse_umgestellt")), "Marke nennt die nachgerechneten Zeilen", (await w("ki_kasse_umgestellt")).slice(0, 200));
  await setzen("mara_aktion_tag_euro", "12");
  KS.kasseZuruecksetzen();
  await KS.kasseTakt();
  ok((await w("mara_aktion_tag_euro")) === "12", "ROT-PROBE ein zweiter Lauf stellt nie noch einmal um");
  P.kiPauseProduktionSimulieren(null);
} finally {
  await aufraeumen().catch(() => {});
  await sql.end({ timeout: 5 }).catch(() => {});
}

console.log(`\n${gut} Prüfungen bestanden, ${schlecht} rot.`);
process.exit(schlecht ? 1 : 0);
