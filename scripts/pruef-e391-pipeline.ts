// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-391 (16.10.2026) — „HAB IN DER PIPELINE WIEDER NUR C-KUNDEN"
//
// Daniel Stripling, 16.10.2026. Gemessen (Produktion, nur lesend, 19:30):
// links 0 A, 0 B, 6 C; rechts 31 A, 455 B, 103 Rate, 39 C; rechts oben eine
// A-Kundin „Zahlung prüfen" — die große Karte zeigte trotzdem einen C-Lead.
//
// Drei Ursachen, drei Änderungen:
//   1. Die große Karte nahm immer zuerst links (slots[0] ?? wieder[0]).
//      → fokusWahl/grosseKarteId (shared/fiaon-pipeline-fokus.ts): Dringlichkeit
//        über BEIDE Spalten; Handauswahl, Anruf und offene Akte halten die Karte.
//   2. Links bleibt zwangsläufig C (A/B nach dem ersten Anruf rechts) — und die
//      Spalte sagte nicht, warum. → Kopfzeile „Alle neuen A/B sind angerufen —
//      n A/B warten rechts." (vorrat_wieder_ab in der VORHANDENEN Zähler-Abfrage).
//   3. Sechs C-Leads sperrten den Nachschub (fehlt = 0), auch wenn A/B im Pool
//      lagen. → nachschubZiehen zieht A/B gegen die A/B-Plätze; Deckel und
//      „nur nie angerufen" bleiben.
//
// Drei Teile:
//   1. DIE REGEL (rein, ohne Datenbank) — mit Rotprobe gegen „links zuerst".
//   2. QUELLTEXT — Band/Jetzt aus demselben Ausdruck wie ORDER BY, keine neue
//      Abfrage, Nachschub-Tor, Kopfzeile, Seite nutzt die Regel.
//   3. LOKALE DATENBANK (nur 127.0.0.1:54329/fiaon_…, eine Transaktion, am Ende
//      zurückgerollt): arbeitslisteLesen (fokusId, Band, vorrat.wiederAb),
//      EXPLAIN-Beleg „keine zusätzliche Unterabfrage je Zeile", nachschubZiehen.
//
//   node_modules/.bin/tsx scripts/pruef-e391-pipeline.ts                (Teil 1+2)
//   env -i PATH="$PATH" HOME="$HOME" \
//     DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/fiaon_…?sslmode=require' \
//     node_modules/.bin/tsx scripts/pruef-e391-pipeline.ts              (Teil 1–3)
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from "node:fs";

for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "WHATSAPP_TOKEN", "TWILIO_AUTH_TOKEN", "OPENAI_API_KEY", "ANTHROPIC_API_KEY"]) {
  if (process.env[k]) { console.error(`${k} ist gesetzt — Abbruch, der Prüfstand darf nichts versenden.`); process.exit(3); }
}
process.env.CRONS = "aus";
const FREMD: string[] = [];
const echtFetch = globalThis.fetch;
globalThis.fetch = (async (eingabe: any, init?: any) => {
  const u = String(typeof eingabe === "string" ? eingabe : eingabe?.url ?? eingabe);
  if (/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(u)) return echtFetch(eingabe, init);
  FREMD.push(u);
  throw new Error(`Prüfstand: kein Netz (${u})`);
}) as typeof fetch;

import { fokusWahl, fokusRang, grosseKarteId, fokusKarte, neuKopfzeile, type FokusKarte } from "../shared/fiaon-pipeline-fokus";

let gruen = 0, rot = 0;
const fehler: string[] = [];
function ok(name: string, b: boolean, detail: unknown = ""): void {
  if (b) { gruen++; console.log(`  PASS  ${name}`); }
  else { rot++; fehler.push(name); console.log(`  FAIL  ${name}  → ${typeof detail === "string" ? detail : JSON.stringify(detail)?.slice(0, 900)}`); }
}
function gleich(name: string, ist: unknown, soll: unknown): void {
  ok(name, JSON.stringify(ist) === JSON.stringify(soll), `ist ${JSON.stringify(ist)}, soll ${JSON.stringify(soll)}`);
}
const abschnitt = (t: string) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 66 - t.length))}`);
const quelle = (pfad: string) => readFileSync(new URL(`../${pfad}`, import.meta.url), "utf8");
/** Ohne Kommentarzeilen — wer die ABWESENHEIT von Code prüft, darf den Kommentar „VORHER …" nicht finden (AGENTS.md). */
const ohneKommentare = (t: string) => t.split("\n").filter((z) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(z)).join("\n");

// Karten-Bausteine für Teil 1
let nr = 100;
const L = (tier: number, o: { sofort?: boolean; jetzt?: boolean } = {}): FokusKarte => ({ personId: ++nr, tier, ...o });
const R = (tier: number, band: number): FokusKarte => ({ personId: ++nr, tier, band });
/** Die alte Regel (pipeline.tsx bis 16.10.2026): links zuerst. */
const alteRegel = (links: FokusKarte[], rechts: FokusKarte[]) => (links[0] ?? rechts[0])?.personId ?? null;

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("1a. Fokuswahl über beide Spalten");
// ═══════════════════════════════════════════════════════════════════════════
{
  // DER BEFUND: links sechs C, rechts oben eine A-Kundin „Zahlung prüfen" (Band 1).
  const links = [L(3), L(3), L(3), L(3), L(3), L(3)];
  const rechts = [R(1, 1), R(2, 4), R(2, 4), R(0, 4), R(3, 5)];
  gleich("Befund Daniel: links nur C, rechts Band 1 (A, Zahlung prüfen) → große Karte RECHTS", fokusWahl(links, rechts), rechts[0].personId);
  ok("… Rotprobe: die alte Regel (links zuerst) nahm den C-Lead", alteRegel(links, rechts) === links[0].personId);
}
{
  const links = [L(1), L(3)];
  const rechts = [R(2, 4), R(0, 4)];
  gleich("Links A, rechts nur Band 4 → links A", fokusWahl(links, rechts), links[0].personId);
}
{
  const links = [L(1, { sofort: true }), L(2)];
  const rechts = [R(2, 0), R(1, 1)];
  gleich("Band 0 (Termin/Rückruf jetzt) schlägt alles — auch die Sofort-Spur", fokusWahl(links, rechts), rechts[0].personId);
  const links2 = [L(3, { jetzt: true }), L(1, { sofort: true })];
  const rechts2 = [R(1, 1), R(2, 3)];
  gleich("… links mit Uhrzeit jetzt schlägt ebenso Sofort-Spur und Band 1", fokusWahl(links2, rechts2), links2[0].personId);
  const rechts3 = [R(2, 0)];
  gleich("… rechts Band 0 und links „jetzt“ gleichrangig → rechts zuerst", fokusWahl(links2, rechts3), rechts3[0].personId);
}
{
  const links = [L(1), L(2, { sofort: true })];
  const rechts = [R(1, 1)];
  gleich("Sofort-Spur (B, Antrag vor Minuten) schlägt rechts Band 1 — und den Nicht-Sofort-A links davor", fokusWahl(links, rechts), links[1].personId);
  ok("… eine C-Karte ist nie Sofort-Spur (Rang wie links C)", fokusRang(L(3, { sofort: true }), "links") === 8);
}
{
  const r2 = R(2, 2), r1 = R(1, 1);
  gleich("Band 1 vor Band 2", fokusWahl([], [r2, r1]), r1.personId);
  const r3 = R(2, 3); const lab = L(2);
  gleich("Rechts Band 3 (frisch) vor links A/B", fokusWahl([lab], [R(2, 4), r3]), r3.personId);
  const r4 = R(2, 4); const lc = L(3); const la = L(1);
  gleich("Links A/B vor rechts Band 4 (auch wenn links ein C davor steht)", fokusWahl([lc, la], [r4]), la.personId);
  gleich("Rechts Band 4 vor links C", fokusWahl([lc], [r4]), r4.personId);
  const r5 = R(3, 5);
  gleich("Links C vor rechts C (Band 5)", fokusWahl([lc], [r5]), lc.personId);
}
{
  // Präzise Rangfolge: 1 jetzt · 2 Sofort · 3 Band 1 · 4 Band 2 · 5 Band 3 · 6 links A/B · 7 Band 4 · 8 links C · 9 Band 5
  const reihe = [
    fokusRang(R(2, 0), "rechts"), fokusRang(L(1, { sofort: true }), "links"), fokusRang(R(1, 1), "rechts"), fokusRang(R(2, 2), "rechts"),
    fokusRang(R(2, 3), "rechts"), fokusRang(L(2), "links"), fokusRang(R(0, 4), "rechts"), fokusRang(L(3), "links"), fokusRang(R(3, 5), "rechts"),
  ];
  gleich("Rangfolge 1–9 genau wie im Bauplan", reihe, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  gleich("Rechts ohne Band (alter Server): Stufe A/B/Rate wie Band 4, Stufe C wie Band 5",
    [fokusRang({ personId: 1, tier: 2 }, "rechts"), fokusRang({ personId: 2, tier: 3 }, "rechts")], [7, 9]);
}
{
  const a = R(2, 4), b = R(1, 4);
  gleich("Gleicher Rang → die Reihenfolge der Spalte bleibt (vorne gewinnt)", fokusWahl([], [a, b]), a.personId);
  const c = L(3), d = L(3);
  gleich("… links genauso", fokusWahl([c, d], []), c.personId);
  gleich("Keine Karten → keine große Karte", fokusWahl([], []), null);
}

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("1b. Welche Karte die Seite groß zeigt (grosseKarteId)");
// ═══════════════════════════════════════════════════════════════════════════
{
  const links = [L(3), L(3)];
  const rechts = [R(1, 1), R(2, 4)];
  const basis = { links, rechts, gewaehlt: null, gezeigt: null, halten: false, vorschlag: null };
  gleich("Ohne Wahl und ohne Vorschlag: die Regel (rechts Band 1)", grosseKarteId(basis), rechts[0].personId);
  gleich("Handauswahl hat Vorrang (ein C-Lead links, selbst angetippt)", grosseKarteId({ ...basis, gewaehlt: links[1].personId }), links[1].personId);
  gleich("… auch gegen den Vorschlag des Servers", grosseKarteId({ ...basis, gewaehlt: links[1].personId, vorschlag: rechts[0].personId }), links[1].personId);
  gleich("Handauswahl, die nicht mehr in einer Spalte steht, zählt nicht", grosseKarteId({ ...basis, gewaehlt: 999_999 }), rechts[0].personId);
  gleich("Während Anruf/Akte (halten) bleibt die gezeigte Karte — auch wenn der Server anderes vorschlägt",
    grosseKarteId({ ...basis, halten: true, gezeigt: links[0].personId, vorschlag: rechts[0].personId }), links[0].personId);
  gleich("… ohne halten gilt der Vorschlag", grosseKarteId({ ...basis, halten: false, gezeigt: links[0].personId, vorschlag: rechts[1].personId }), rechts[1].personId);
  gleich("… die gezeigte ist weg (Ergebnis gebucht) → Vorschlag", grosseKarteId({ ...basis, halten: true, gezeigt: 999_998, vorschlag: rechts[1].personId }), rechts[1].personId);
  gleich("Vorschlag weg (Karte entfernt) → dieselbe Regel hier", grosseKarteId({ ...basis, vorschlag: 999_997 }), rechts[0].personId);
  gleich("fokusKarte liest Band, jetzt und Sofort-Spur von der Karte",
    fokusKarte({ personId: 5, tier: 2, band: 1, jetzt: false, hitze: { sofort: true } }), { personId: 5, tier: 2, band: 1, sofort: true, jetzt: false });
}

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("1c. Kopfzeile der linken Spalte");
// ═══════════════════════════════════════════════════════════════════════════
gleich("Links nur C, rechts 486 A/B → ehrlicher Satz", neuKopfzeile([{ tier: 3 }, { tier: 3 }], 486), "Alle neuen A/B sind angerufen — 486 A/B warten rechts.");
gleich("Links leer → derselbe Satz", neuKopfzeile([], 12), "Alle neuen A/B sind angerufen — 12 A/B warten rechts.");
gleich("Ein A/B rechts → Einzahl", neuKopfzeile([{ tier: 3 }], 1), "Alle neuen A/B sind angerufen — 1 A/B wartet rechts.");
gleich("Kein A/B rechts → nur der erste Satz", neuKopfzeile([{ tier: 3 }], 0), "Alle neuen A/B sind angerufen.");
gleich("Steht links ein B → keine Kopfzeile", neuKopfzeile([{ tier: 3 }, { tier: 2 }], 486), null);
gleich("Steht links ein A → keine Kopfzeile", neuKopfzeile([{ tier: 1 }], 5), null);

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("2. Quelltext");
// ═══════════════════════════════════════════════════════════════════════════
const ov = quelle("server/routes/fiaon-office-vertrieb.ts");
const lesen = ov.slice(ov.indexOf("export async function arbeitslisteLesen("), ov.indexOf("// GET /agent/vertrieb/pausiert"));
const zug = ov.slice(ov.indexOf("export async function nachschubZiehen("), ov.indexOf('router.get("/agent/vertrieb/arbeitsliste"'));
ok("arbeitslisteLesen und nachschubZiehen gefunden", lesen.length > 2000 && zug.length > 1000);
ok("Rechts: das Band ist der ERSTE Schlüssel von wiederOrdnung (wiederBandSql)", /function wiederOrdnung\(lv: string, ev: string\): string \{\s*\n\s*return `\s*\n\s*\$\{wiederBandSql\(lv, ev\)\},/.test(ov));
ok("… und dieselbe Funktion mit denselben Argumenten als Spalte wieder_band — Postgres rechnet sie einmal",
  /const ordnung = wiederOrdnung\("v\.lv", "v\.ev"\);/.test(ov) && /SELECT p\.\*, v\.lv, \$\{wiederBandSql\("v\.lv", "v\.ev"\)\} AS wieder_band FROM fiaon_persons p/.test(lesen));
ok("Links: „jetzt“ ist der erste Schlüssel von NEU_ORDNUNG und als Spalte neu_jetzt_rang gewählt",
  /const NEU_ORDNUNG = `\s*\n\s*\$\{NEU_JETZT_RANG\},/.test(ov) && /SELECT p\.\*, \$\{NEU_JETZT_RANG\} AS neu_jetzt_rang FROM fiaon_persons p/.test(lesen) && /ORDER BY \$\{NEU_ORDNUNG\} LIMIT \$\{SLOTS\}/.test(lesen));
ok("Keine neue Abfrage in arbeitslisteLesen: weiter genau fünf (links, links-Rest, Zähler, rechts, heute)", (ohneKommentare(lesen).match(/lauf\.unsafe\(/g) || []).length === 5, (lesen.match(/lauf\.unsafe\(/g) || []).length);
ok("vorrat_wieder_ab steht in der VORHANDENEN Zähler-Abfrage, aus derselben Spalte „wieder“ (OFFSET 0)",
  /COUNT\(\*\) FILTER \(WHERE z\.wieder\)::int AS vorrat_wieder,\s*\n\s*COUNT\(\*\) FILTER \(WHERE z\.wieder AND z\.stufe IN \(1, 2\)\)::int AS vorrat_wieder_ab/.test(lesen)
  && /OFFSET 0\) z`, \[me\]/.test(lesen));
ok("Rückgabe: fokusId aus fokusWahl über beide Spalten, vorrat.wiederAb", /fokusId: fokusWahl\(slots\.map\(\(s\) => fokusKarte\(s\.kunde\)\), wieder\.map\(\(s\) => fokusKarte\(s\.kunde\)\)\)/.test(lesen)
  && /wiederAb: Number\(z\.vorrat_wieder_ab \|\| 0\)/.test(lesen));
ok("Karten tragen band (rechts) und jetzt (links)", /band: r\.wieder_band == null \? null : Number\(r\.wieder_band\)/.test(lesen) && /jetzt: r\.neu_jetzt_rang != null && Number\(r\.neu_jetzt_rang\) === 0/.test(lesen));
// Nachschub-Tor
ok("Nachschub: A/B-Plätze gezählt (ab) in DERSELBEN Zählabfrage", /SELECT COUNT\(\*\)::int AS n, COUNT\(\*\) FILTER \(WHERE p\.priority_tier IN \(1, 2\)\)::int AS ab FROM fiaon_persons p/.test(zug));
ok("Nachschub: fehltAb gegen SLOTS; Abbruch nur, wenn weder Plätze noch A/B-Plätze fehlen",
  /const fehltAb = SLOTS - Number\(zeile\?\.ab \?\? 0\);/.test(zug) && /if \(fehlt <= 0 && fehltAb <= 0\) return;/.test(zug));
ok("Nachschub Rotprobe: das alte Tor „if (fehlt <= 0) return;“ ist weg", !/if \(fehlt <= 0\) return;/.test(ohneKommentare(zug)));
ok("Nachschub: Deckel SLOTS * 3 bleibt und steht VOR jedem Zug",
  zug.indexOf("if (Number(alle?.n ?? 0) >= SLOTS * 3) return;") > 0 && zug.indexOf("if (Number(alle?.n ?? 0) >= SLOTS * 3) return;") < zug.indexOf("await ziehen(true, fehltAb)"));
ok("Nachschub: erst A/B (nurAb), dann der alte Zug für die Restplätze", /const gezogenAb = fehltAb > 0 \? await ziehen\(true, fehltAb\) : 0;\s*\n\s*if \(fehlt - gezogenAb > 0\) await ziehen\(false, fehlt - gezogenAb\);/.test(zug)
  && /\$\{nurAb \? "AND p\.priority_tier IN \(1, 2\)" : ""\}/.test(zug));
{
  const where = zug.slice(zug.indexOf("SELECT p.id FROM fiaon_persons p"), zug.indexOf("ORDER BY ${POOL_ORDNUNG}"));
  ok("Nachschub: gezogen wird weiter NUR aus dem Pool, nur nie Angerufene, nur wer links erscheint",
    /p\.assigned_agent_id IS NULL AND p\.mandat_seit IS NULL/.test(where) && /AND \$\{NIE_SQL\}/.test(where) && /AND \$\{JETZT_ERREICHBAR_SQL\}/.test(where)
    && /COALESCE\(p\.unreachable_count, 0\) = 0/.test(where) && /AND \$\{KEIN_GLOBAL_KUNDE_SQL\}/.test(where));
}
ok("poolNachschub ruft den Zug weiter mit dem Pool (Route unverändert)", (ov.match(/await nachschubZiehen\(me\);/g) || []).length === 2);
// Seite
const pt = quelle("client/src/pages/agent/pipeline.tsx");
const ptCode = ohneKommentare(pt);
ok("Seite: große Karte über grosseKarteId (Handauswahl, halten bei Anruf/Akte, Vorschlag, Regel)",
  /const id = grosseKarteId\(\{/.test(pt) && /gewaehlt: fokusId, gezeigt: gezeigterFokus\.current,/.test(pt) && /halten: offen !== null \|\| anrufAktiv\.current, vorschlag: fokusVorschlag,/.test(pt));
ok("Seite Rotprobe: „slots[0] ?? wieder[0]“ (links zuerst) steht nicht mehr im Code", !/slots\[0\] \?\? wieder\[0\]/.test(ptCode));
ok("Seite: Vorschlag des Servers wird übernommen", /setFokusVorschlag\(r\.json\.fokusId != null && Number\(r\.json\.fokusId\) > 0 \? Number\(r\.json\.fokusId\) : null\);/.test(pt));
ok("Seite: Kopfzeile links aus neuKopfzeile mit vorrat.wiederAb, unter „Neu für dich“",
  /neuKopfzeile\(slots\.map\(\(s\) => s\.kunde\), vorrat\.wiederAb\)/.test(pt) && /data-fiaon="neu-kopf"><span>\{neuKopf\}<\/span>/.test(pt)
  && pt.indexOf('data-fiaon="neu-kopf"') > pt.indexOf("<b>Neu für dich</b>") && pt.indexOf('data-fiaon="neu-kopf"') < pt.indexOf("<b>Wieder dran</b>"));
ok("Seite: Spalten unverändert — beide Karussells filtern nur die große Karte heraus",
  /const kleine = useMemo\(\(\) => slots\.filter\(\(s\) => s\.kunde\.personId !== \(fokusSlot\?\.kunde\.personId \?\? -1\)\), \[slots, fokusSlot\]\);/.test(pt)
  && /const wiederOhneFokus = useMemo\(\(\) => wieder\.filter\(\(s\) => s\.kunde\.personId !== \(fokusSlot\?\.kunde\.personId \?\? -1\)\), \[wieder, fokusSlot\]\);/.test(pt));
ok("Seite: Nachladen weiter nie während Anruf oder offener Akte", /if \(document\.visibilityState !== "visible" \|\| offen !== null \|\| anrufAktiv\.current\) return;/.test(pt));
const rg = quelle("client/src/pages/agent/rundgaenge.ts");
ok("Rundgang nachgezogen (große Karte aus beiden Reihen, Kopfzeile links, A/B-Nachschub)",
  rg.includes("Sie kommt aus BEIDEN Reihen") && rg.includes("Alle neuen A/B sind angerufen") && rg.includes("wenn deine Plätze voll mit Leads ohne Antrag sind"));

// ═══════════════════════════════════════════════════════════════════════════
const DBURL = String(process.env.DATABASE_URL ?? "");
if (!/^postgres(ql)?:\/\/[^@]*@(127\.0\.0\.1|localhost):54329\/fiaon_/.test(DBURL)) {
  console.log("\n── 3. Datenbank: ÜBERSPRUNGEN (nur gegen die lokale Kopie 127.0.0.1:54329/fiaon_…, nie gegen die Produktion)");
} else {
  await datenbankTeil();
}

async function datenbankTeil(): Promise<void> {
  const { sqlPool } = await import("../server/lib/db-pool");
  const { globalKundeBereit } = await import("../server/lib/fiaon-global-kunde");
  const { fehlversuchTabelle } = await import("../server/lib/fiaon-fehlversuch");
  const { berlinToday } = await import("../server/lib/fiaon-time");
  const { plusKalendertage } = await import("../shared/fiaon-wiedervorlage");
  const ovm = await import("../server/routes/fiaon-office-vertrieb");

  // AGENTS.md, Falle 1: DDL über den globalen Pool VOR der Transaktion.
  await fehlversuchTabelle();
  await globalKundeBereit();
  const heute = berlinToday();
  const tagVor = (t: number) => plusKalendertage(heute, -t);
  const MARKE = `PRUEFE391-${Date.now().toString(36)}`;
  class Zurueckrollen extends Error {}
  let lfd = 0;

  try {
    await sqlPool.begin(async (tx: any) => {
      const agent = async (name: string): Promise<number> => {
        const [a] = await tx`
          INSERT INTO fiaon_agents (email, name, first_name, rolle, active, is_test_account)
          VALUES (${`${MARKE.toLowerCase()}-${++lfd}@pruefstand.invalid`}, ${`${name} ${MARKE}`}, ${name}, 'agent', TRUE, TRUE)
          RETURNING id`;
        return Number(a.id);
      };
      const person = async (o: { agent: number | null; tier: number; reason?: string; zaehler?: number; wv?: string | null; zusage?: string | null }): Promise<number> => {
        const [p] = await tx`
          INSERT INTO fiaon_persons (person_ref, first_name, last_name, assigned_agent_id, priority_tier, tier_reason,
                                     unreachable_count, follow_up_date, promised_payment_date, primary_email, primary_phone, created_at)
          VALUES (${`${MARKE}-P${++lfd}`}, 'Prüf', ${`Person${lfd}`}, ${o.agent}, ${o.tier}, ${o.reason ?? "rechnung_offen"},
                  ${o.zaehler ?? 0}, ${o.wv ?? null}, ${o.zusage ?? null},
                  ${`p${lfd}-${MARKE.toLowerCase()}@pruefstand.invalid`}, ${`+4915177${String(200000 + lfd)}`},
                  NOW() - INTERVAL '60 days')
          RETURNING id`;
        return Number(p.id);
      };
      const antrag = async (o: { person: number; vorStunden: number; zahlung?: string; gemeldetVorStunden?: number }): Promise<string> => {
        const ref = `FIAON-${MARKE}-A${++lfd}`;
        await tx`
          INSERT INTO fiaon_applications (ref, payment_reference, person_id, created_at, submitted_at, current_step, status,
                                          payment_status, claimed_paid_at, pack_key, pack_name, ist_entwurf)
          VALUES (${ref}, ${`FI-${MARKE}-${lfd}`}, ${o.person},
                  NOW() - (${o.vorStunden}::int * INTERVAL '1 hour'), NOW() - (${o.vorStunden}::int * INTERVAL '1 hour'),
                  8, 'submitted', ${o.zahlung ?? "pending_payment"},
                  ${o.gemeldetVorStunden != null ? tx`NOW() - (${o.gemeldetVorStunden}::int * INTERVAL '1 hour')` : null},
                  'basis', 'FIAON Basis', FALSE)`;
        return ref;
      };
      const ergebnis = async (o: { ref: string; agent: number; outcome: string; vorStunden: number }) => {
        await tx`
          INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, outcome, note, created_at)
          VALUES (${o.ref}, NULL, ${o.agent}, 'Prüfstand', 'result', ${o.outcome}, ${MARKE}, NOW() - (${o.vorStunden}::int * INTERVAL '1 hour'))`;
      };
      // Bausteine wie in pruef-it-a.ts:
      const leadC = (ag: number | null) => person({ agent: ag, tier: 3, reason: "nur_lead" });
      /** Stufe A, Zahlung gemeldet vor 7 Tagen, Zusage vor 5 Tagen, seither nicht versucht → rechts Band 1 „Zahlung prüfen“. */
      const aZahlungPruefen = async (ag: number) => {
        const p = await person({ agent: ag, tier: 1, reason: "zahlung_angekuendigt", wv: tagVor(1), zusage: tagVor(5) });
        const ref = await antrag({ person: p, vorStunden: 24 * 20, zahlung: "claimed_paid", gemeldetVorStunden: 24 * 7 });
        await ergebnis({ ref, agent: ag, outcome: "erreicht_zahlt_am", vorStunden: 24 * 6 });
        return p;
      };
      /** Stufe B, vor 30 Tagen nicht erreicht, alte Wiedervorlage → rechts Band 4. */
      const bAlt = async (ag: number) => {
        const p = await person({ agent: ag, tier: 2, zaehler: 1, wv: tagVor(25) });
        const ref = await antrag({ person: p, vorStunden: 24 * 40 });
        await ergebnis({ ref, agent: ag, outcome: "nicht_erreicht", vorStunden: 24 * 30 });
        return p;
      };
      const ids = (l: { kunde: any }[]) => l.map((w) => Number(w.kunde.personId));

      // ═══════════════════════════════════════════════════════════════════
      abschnitt("3a. arbeitslisteLesen — der Befund (links nur C, rechts A „Zahlung prüfen“)");
      // ═══════════════════════════════════════════════════════════════════
      {
        const ad = await agent("Daniel");
        const c1 = await leadC(ad), c2 = await leadC(ad), c3 = await leadC(ad);
        const a = await aZahlungPruefen(ad);
        const b = await bAlt(ad);
        const l = await ovm.arbeitslisteLesen(ad, tx, { wiederBis: 50 });
        gleich("Links stehen die drei C-Leads (Spalte unverändert)", ids(l.slots).sort(), [c1, c2, c3].sort());
        gleich("Rechts: A „Zahlung prüfen“ vor B (Reihenfolge der Spalte unverändert)", ids(l.wieder), [a, b]);
        gleich("Karten rechts tragen das Band: A = 1, B = 4", l.wieder.map((w) => w.kunde.band), [1, 4]);
        gleich("… und links „jetzt“ = false", l.slots.map((w) => w.kunde.jetzt), [false, false, false]);
        gleich("fokusId = die A-Kundin rechts", l.fokusId, a);
        ok("Rotprobe: die alte Regel (slots[0] ?? wieder[0]) hätte einen C-Lead gezeigt", [c1, c2, c3].includes(ids(l.slots)[0]) && ids(l.slots)[0] !== l.fokusId);
        gleich("vorrat: rechts 2, davon A/B 2", [l.vorrat.wieder, l.vorrat.wiederAb], [2, 2]);
        gleich("Kopfzeile links", neuKopfzeile(l.slots.map((w) => w.kunde), l.vorrat.wiederAb), "Alle neuen A/B sind angerufen — 2 A/B warten rechts.");
        // Ein Ratenkunde rechts zählt nicht als A/B.
        const r = await person({ agent: ad, tier: 0, reason: "bezahlt" });
        const rref = await antrag({ person: r, vorStunden: 24 * 50, zahlung: "paid" });
        await tx`INSERT INTO fiaon_abo_raten (ref, rate_nr, betrag_cents, faellig_am, zahlungsreferenz, status)
                 VALUES (${rref}, 2, 4999, ${tagVor(20)}::date, ${`R-${MARKE}`}, 'offen')`;
        await ergebnis({ ref: rref, agent: ad, outcome: "nicht_erreicht", vorStunden: 24 * 15 });
        const l2 = await ovm.arbeitslisteLesen(ad, tx, { wiederBis: 50 });
        gleich("Mit fälliger Rate rechts: vorrat.wieder 3, A/B bleibt 2", [l2.vorrat.wieder, l2.vorrat.wiederAb], [3, 2]);
        gleich("… Zahl links (vorrat.neu) unverändert 3", l2.vorrat.neu, 3);
      }

      // ═══════════════════════════════════════════════════════════════════
      abschnitt("3b. arbeitslisteLesen — links A vor rechts Band 4, Band 0 und Sofort-Spur");
      // ═══════════════════════════════════════════════════════════════════
      {
        const ag = await agent("LinksA");
        const c = await leadC(ag);
        const a = await person({ agent: ag, tier: 1, reason: "zahlung_angekuendigt" });
        await antrag({ person: a, vorStunden: 24 * 4, zahlung: "claimed_paid", gemeldetVorStunden: 24 * 3 });
        const b = await bAlt(ag);
        const l = await ovm.arbeitslisteLesen(ag, tx);
        gleich("Links A vor C (NEU_ORDNUNG unverändert), rechts B Band 4", [ids(l.slots), ids(l.wieder), l.wieder[0]?.kunde.band], [[a, c], [b], 4]);
        gleich("fokusId = links A (Band 4 rechts ist weniger dringend)", l.fokusId, a);
        gleich("Kopfzeile links: keine (es steht ein A)", neuKopfzeile(l.slots.map((w) => w.kunde), l.vorrat.wiederAb), null);
        // Band 0: Termin jetzt beim Mitarbeiter — schlägt den A links.
        await tx`INSERT INTO fiaon_termine (person_id, agent_id, beginn, dauer_min, quelle, status)
                 VALUES (${b}, ${ag}, NOW(), 20, 'onboarding', 'gebucht')`;
        const l0 = await ovm.arbeitslisteLesen(ag, tx);
        gleich("Termin jetzt → rechts Band 0, große Karte rechts", [l0.wieder.find((w) => Number(w.kunde.personId) === b)?.kunde.band, l0.fokusId], [0, b]);
      }
      {
        const ag = await agent("Sofort");
        const a = await aZahlungPruefen(ag);
        const s = await person({ agent: ag, tier: 2 });
        await antrag({ person: s, vorStunden: 2 });
        const l = await ovm.arbeitslisteLesen(ag, tx);
        gleich("Antrag vor 2 Stunden, nie angerufen → links, Sofort-Spur", [ids(l.slots), l.slots[0]?.kunde.hitze?.sofort], [[s], true]);
        gleich("Sofort-Spur schlägt rechts Band 1", [l.wieder[0]?.kunde.band, l.fokusId], [1, s]);
      }

      // ═══════════════════════════════════════════════════════════════════
      abschnitt("3c. EXPLAIN — keine zusätzliche Unterabfrage je Zeile");
      // ═══════════════════════════════════════════════════════════════════
      {
        // Die echten Abfragen mitschneiden (gleiche Transaktion), dann ohne die neuen Spalten vergleichen.
        const ag = await agent("Plan");
        const mit: string[] = [];
        const schreiber = { unsafe: (q: string, p?: any[]) => { mit.push(q); return tx.unsafe(q, p); } };
        await ovm.arbeitslisteLesen(ag, schreiber);
        const qWieder = mit.find((q) => q.includes("AS wieder_band")) ?? "";
        const qLinks = mit.find((q) => q.includes("AS neu_jetzt_rang")) ?? "";
        const qZaehler = mit.find((q) => q.includes("AS vorrat_wieder_ab")) ?? "";
        ok("Drei Abfragen mitgeschnitten", !!qWieder && !!qLinks && !!qZaehler, mit.length);
        const subplans = async (q: string) => {
          const plan = await tx.unsafe(`EXPLAIN (VERBOSE, COSTS OFF) ${q}`, [ag]);
          return plan.map((r: any) => String(r["QUERY PLAN"])).filter((z: string) => /^\s*SubPlan \d+/.test(z)).length;
        };
        /** Schneidet die neue Spalte aus der inneren Auswahl (von „bis“ bis „ AS name“) und ihren Abgriff außen. */
        const ohneSpalte = (q: string, bis: string, name: string) => {
          const i = q.indexOf(bis) + bis.length, ende = ` AS ${name}`, j = q.indexOf(ende, i) + ende.length;
          return i < bis.length || j < ende.length ? q : (q.slice(0, i) + q.slice(j)).replace(`, p.${name}`, "");
        };
        const wiederOhne = ohneSpalte(qWieder, "SELECT p.*, v.lv", "wieder_band");
        ok("… Gegenstück ohne wieder_band gebaut", !/ AS wieder_band|p\.wieder_band/.test(wiederOhne) && wiederOhne.includes("SELECT p.*, v.lv FROM fiaon_persons p"));
        const [sw, sw0] = [await subplans(qWieder), await subplans(wiederOhne)];
        // Rotprobe: ein NICHT gleicher Ausdruck (+ 0) wird getrennt gerechnet — die Zählung merkt das.
        const swk = await subplans(qWieder.replace(" AS wieder_band", " + 0 AS wieder_band"));
        ok(`Rotprobe: ein abweichender Band-Ausdruck brächte eigene SubPlans (${swk} > ${sw})`, swk > sw, { swk, sw });
        ok(`Rechts: gleich viele SubPlans mit und ohne Band-Spalte (${sw} = ${sw0}) — das Band wird mit der Sortierung einmal gerechnet`, sw === sw0 && sw > 0, { sw, sw0 });
        const linksOhne = ohneSpalte(qLinks, "SELECT p.*", "neu_jetzt_rang");
        ok("… Gegenstück ohne neu_jetzt_rang gebaut", !linksOhne.includes("neu_jetzt_rang") && linksOhne.includes("SELECT p.* FROM fiaon_persons p"));
        const [sl, sl0] = [await subplans(qLinks), await subplans(linksOhne)];
        ok(`Links: gleich viele SubPlans mit und ohne neu_jetzt_rang (${sl} = ${sl0})`, sl === sl0 && sl > 0, { sl, sl0 });
        const zaehlerOhne = qZaehler.replace(/,\s*\n\s*COUNT\(\*\) FILTER \(WHERE z\.wieder AND z\.stufe IN \(1, 2\)\)::int AS vorrat_wieder_ab/, "");
        ok("… Gegenstück ohne vorrat_wieder_ab gebaut", !zaehlerOhne.includes("vorrat_wieder_ab"));
        const [sz, sz0] = [await subplans(qZaehler), await subplans(zaehlerOhne)];
        ok(`Zähler: die dritte Zahl kostet keine SubPlan (${sz} = ${sz0})`, sz === sz0 && sz > 0, { sz, sz0 });
        // Rotprobe: ohne OFFSET 0 zieht Postgres die Unterabfrage hoch und kopiert „wieder“ in jede Zählung.
        const ohneSperre = qZaehler.replace("OFFSET 0) z", ") z");
        const szk = await subplans(ohneSperre);
        ok(`Rotprobe: ohne OFFSET 0 wird die Bedingung kopiert — mehr SubPlans (${szk} > ${sz})`, ohneSperre !== qZaehler && szk > sz, { szk, sz });
      }

      // ═══════════════════════════════════════════════════════════════════
      abschnitt("3d. nachschubZiehen — C-Leads sperren den A/B-Nachschub nicht mehr");
      // ═══════════════════════════════════════════════════════════════════
      {
        const an = await agent("Nachschub");
        const sechsC: number[] = [];
        for (let i = 0; i < 6; i++) sechsC.push(await leadC(an));
        const poolA = await person({ agent: null, tier: 1, reason: "zahlung_angekuendigt" });
        await antrag({ person: poolA, vorStunden: 30, zahlung: "claimed_paid", gemeldetVorStunden: 30 });
        const poolB = await person({ agent: null, tier: 2 }); await antrag({ person: poolB, vorStunden: 50 });
        const poolBAngerufen = await person({ agent: null, tier: 2 });
        const refBA = await antrag({ person: poolBAngerufen, vorStunden: 24 * 6 });
        await ergebnis({ ref: refBA, agent: an, outcome: "nicht_erreicht", vorStunden: 24 * 5 });
        await tx`UPDATE fiaon_persons SET unreachable_count = 0, follow_up_date = NULL WHERE id = ${poolBAngerufen}`;
        const poolC = await leadC(null);
        const betreuer = async (id: number) => { const [r] = await tx`SELECT assigned_agent_id FROM fiaon_persons WHERE id = ${id}`; return r?.assigned_agent_id == null ? null : Number(r.assigned_agent_id); };
        const [vor] = await tx`SELECT COUNT(*)::int AS n FROM fiaon_persons WHERE assigned_agent_id = ${an} AND priority_tier BETWEEN 1 AND 3`;
        ok("Rotprobe: sechs C halten die sechs Plätze — das alte Tor (fehlt = SLOTS − 6 = 0) zog nichts", Number(vor.n) === 6);
        await ovm.nachschubZiehen(an, tx);
        gleich("A und B aus dem Pool kommen trotzdem (A/B gegen A/B-Plätze)", [await betreuer(poolA), await betreuer(poolB)], [an, an]);
        gleich("Der schon angerufene B bleibt im Pool (nur nie Angerufene)", await betreuer(poolBAngerufen), null);
        gleich("Der C im Pool bleibt im Pool (die Plätze sind voll)", await betreuer(poolC), null);
        const l = await ovm.arbeitslisteLesen(an, tx);
        gleich("Links jetzt A, B vor den C (Reihung A→B→C unverändert); große Karte = A", [ids(l.slots).slice(0, 2), l.slots.length, l.fokusId], [[poolA, poolB], 6, poolA]);
        await ovm.nachschubZiehen(an, tx);
        const [nach] = await tx`SELECT COUNT(*)::int AS n FROM fiaon_persons WHERE assigned_agent_id = ${an}`;
        gleich("Zweiter Aufbau zieht nichts mehr (kein Horten)", Number(nach.n), 8);

        // Deckel SLOTS * 3: 18 unberührte → auch A/B werden nicht gezogen.
        const ak = await agent("Deckel");
        for (let i = 0; i < 18; i++) await leadC(ak);
        const poolA2 = await person({ agent: null, tier: 1, reason: "zahlung_angekuendigt" });
        await antrag({ person: poolA2, vorStunden: 30, zahlung: "claimed_paid", gemeldetVorStunden: 30 });
        await ovm.nachschubZiehen(ak, tx);
        gleich("Deckel: Wer 18 Unberührte hält, bekommt auch kein A", await betreuer(poolA2), null);

        // Ohne C auf den Plätzen: wie vorher — erst A/B, dann C bis sechs.
        const ac = await agent("Leer");
        await ovm.nachschubZiehen(ac, tx);
        gleich("Leere Liste: A, dann C aus dem Pool (alter Zug für die Restplätze)", [await betreuer(poolA2), await betreuer(poolC), await betreuer(poolBAngerufen)], [ac, ac, null]);
      }

      throw new Zurueckrollen();
    });
  } catch (e) {
    if (!(e instanceof Zurueckrollen)) { rot++; fehler.push(`Abbruch: ${(e as Error)?.message}`); console.log("  FAIL  Abbruch", e); }
  }
  const [rest] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_persons WHERE person_ref LIKE ${`${MARKE}%`}`) as any[];
  gleich("Zurückgerollt — keine Prüfperson bleibt stehen", Number(rest.n), 0);
  await sqlPool.end({ timeout: 5 });
}

console.log(`\n${rot === 0 ? "GRÜN" : "ROT"}: ${gruen} bestanden, ${rot} fehlgeschlagen${FREMD.length ? ` · Netzversuche: ${FREMD.join(", ")}` : ""}`);
if (rot) { console.log(fehler.map((f) => `  · ${f}`).join("\n")); process.exit(1); }
process.exit(0);
