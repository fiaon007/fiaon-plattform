// Prüfstand E-408 (20.10.2026): Aras' Büro-Atmosphäre — selbst erzeugt, nahtlos, leise genug, ohne Übersteuern.
// Offline, ohne Datenbank:  npx tsx scripts/pruef-aras-atmo.ts
// Hörproben schreiben:      npx tsx scripts/pruef-aras-atmo.ts --wav <ordner>
import fs from "node:fs";
import path from "node:path";
import { atmoErzeugen, atmoSchleife, atmoMischen, alsWav, ATMO_ARTEN, ATMO_PEGEL_DBFS, ATMO_SPITZE_DBFS, ATMO_ABSTAND_DB, ATMO_RATE, ATMO_SEKUNDEN } from "../server/lib/fiaon-aras-atmo";
import { TON_ZIEL_DBFS } from "../server/lib/fiaon-aras-ton";

let gut = 0, schlecht = 0;
const ok = (b: unknown, was: string, extra = "") => { if (b) { gut++; console.log(`  ✓ ${was}`); } else { schlecht++; console.log(`  ✗ ${was}${extra ? ` — ${extra}` : ""}`); } };
const db = (x: number) => 20 * Math.log10(Math.max(1e-9, x));
const rmsDb = (a: Int16Array, von = 0, bis = a.length) => { let s = 0; for (let i = von; i < bis; i++) s += (a[i] / 32767) ** 2; return db(Math.sqrt(s / Math.max(1, bis - von))); };
const spitze = (a: Int16Array) => { let m = 0; for (const v of a) m = Math.max(m, Math.abs(v)); return m; };

for (const art of ATMO_ARTEN) {
  console.log(`── ${art}`);
  const t0 = Date.now();
  const a = atmoErzeugen(art);
  const ms = Date.now() - t0;
  ok(a.length === ATMO_SEKUNDEN * ATMO_RATE, `Länge ${ATMO_SEKUNDEN} s bei 8 kHz`);
  ok(ms < 3000, `in ${ms} ms gerechnet (einmal je Prozess)`);
  const pegel = rmsDb(a);
  ok(Math.abs(pegel - ATMO_PEGEL_DBFS[art]) < 2.5, `Pegel ${pegel.toFixed(1)} dBFS ≈ ${ATMO_PEGEL_DBFS[art]} (±2,5)`);
  const sp = db(spitze(a) / 32767);
  ok(sp <= ATMO_SPITZE_DBFS[art], `kein Klick im Ohr: Spitze ${sp.toFixed(1)} dBFS ≤ ${ATMO_SPITZE_DBFS[art]}`);
  // Gleichmäßig: kein Abschnitt ist stumm oder doppelt so laut (je 5 s)
  const stuecke: number[] = [];
  for (let s = 0; s + 5 * ATMO_RATE <= a.length; s += 5 * ATMO_RATE) stuecke.push(rmsDb(a, s, s + 5 * ATMO_RATE));
  const spanne = Math.max(...stuecke) - Math.min(...stuecke);
  ok(spanne < 9, `gleichmäßig über die Schleife (Spanne der 5-s-Abschnitte ${spanne.toFixed(1)} dB)`);
  // Nahtlos: der Sprung vom Ende zum Anfang ist nicht größer als ein üblicher Schritt
  const schritte: number[] = [];
  for (let i = 1; i < a.length; i++) schritte.push(Math.abs(a[i] - a[i - 1]));
  schritte.sort((x, y) => x - y);
  const p999 = schritte[Math.floor(schritte.length * 0.999)];
  const naht = Math.abs(a[0] - a[a.length - 1]);
  ok(naht <= p999, `Schleife ohne Knacks (Naht ${naht} ≤ 99,9 %-Schritt ${p999})`);
  ok(atmoErzeugen(art).every((v, i) => v === a[i]), "deterministisch (gleicher Startwert → gleicher Klang)");
}

console.log("── Mischen");
{
  const leise = atmoSchleife("buero_leise");
  ok(atmoSchleife("buero_leise") === leise, "Schleife wird je Prozess nur einmal gerechnet");
  const nur = atmoMischen(null, 160, "buero_leise", 0);
  ok(nur.pcm.every((v, i) => v === leise[i]) && nur.pos === 160, "ohne Sprache: reine Atmo, Position läuft weiter");
  const ende = atmoMischen(null, 320, "buero_leise", leise.length - 160);
  ok(ende.pos === 160 && ende.pcm[160] === leise[0], "über das Schleifenende hinweg nahtlos weiter");
  const sprache = new Int16Array(160).fill(12000);
  const m = atmoMischen(sprache, 160, "buero_leise", 0);
  ok(m.pcm.every((v, i) => v === 12000 + leise[i]), "Sprache + Atmo = Summe (unter der Grenze unverändert)");
  const laut = atmoMischen(new Int16Array(160).fill(32767), 160, "buero", 0);
  ok(laut.pcm.every((v) => v <= 32767 && v >= -32767), "volle Sprache: weiche Grenze, kein Überlauf");
  ok(atmoMischen(null, 160, "buero_leise", -5).pos === 155, "negative Position wird in die Schleife gelegt");
}

// Justin 20.10.2026 (abends): „Büro leiser“ — gehört bei Rede um −24 dBFS mit Atmo −49 / −43 dBFS (25 / 19 dB darunter).
// Seit dem Ton-Werk (Rede auf −16 dBFS geregelt) bleibt genau dieser ABSTAND: Atmo −41 / −35 dBFS, Spitzen −24 / −19.
ok(ATMO_ABSTAND_DB.buero_leise === 25 && ATMO_ABSTAND_DB.buero === 19 && ATMO_ARTEN.every((a) => ATMO_PEGEL_DBFS[a] === TON_ZIEL_DBFS - ATMO_ABSTAND_DB[a]),
  "Abstand zur Rede wie von Justin freigegeben (25 / 19 dB unter der Rede, Rede jetzt −16 dBFS → −41 / −35 dBFS)");
ok(ATMO_SPITZE_DBFS.buero_leise === -24 && ATMO_SPITZE_DBFS.buero === -19, "Spitzen mit der Rede +8 dB (−24 / −19 dBFS) — ein Tastenklick bleibt weit unter Aras' Stimme");
{
  const alt = atmoErzeugen("buero").map((v) => Math.round(v * 10 ** (-8 / 20))) as Int16Array; // −8 dB = die Atmo ohne Mitziehen
  ok(Math.abs(rmsDb(alt) - ATMO_PEGEL_DBFS.buero) > 2.5, "Rot-Probe: Atmo NICHT mitgezogen (−8 dB, Abstand zur lauteren Rede zu groß) fällt im Pegel-Test auf", `${rmsDb(alt).toFixed(1)} dBFS`);
}

// Rot-Probe: eine absichtlich zu laute Atmo würde den Pegel-Test reißen
{
  const zuLaut = atmoErzeugen("buero").map((v) => Math.max(-32767, Math.min(32767, v * 8))) as Int16Array;
  ok(Math.abs(rmsDb(zuLaut) - ATMO_PEGEL_DBFS.buero) > 2.5 && db(spitze(zuLaut) / 32767) > ATMO_SPITZE_DBFS.buero, "Rot-Probe: 8× lauter fällt im Pegel- und Spitzen-Test auf");
}

const i = process.argv.indexOf("--wav");
if (i > 0 && process.argv[i + 1]) {
  const ordner = process.argv[i + 1];
  fs.mkdirSync(ordner, { recursive: true });
  for (const art of ATMO_ARTEN) {
    const a = atmoSchleife(art).slice(0, 30 * ATMO_RATE);
    fs.writeFileSync(path.join(ordner, `aras-${art}-echt.wav`), alsWav(a));
    const lauter = a.map((v) => Math.max(-32767, Math.min(32767, v * 8))) as Int16Array; // +18 dB nur zum Reinhören
    fs.writeFileSync(path.join(ordner, `aras-${art}-zum-reinhoeren.wav`), alsWav(lauter));
  }
  console.log(`  Hörproben: ${ordner}`);
}

console.log(`\n${gut} Prüfungen bestanden, ${schlecht} rot.`);
process.exit(schlecht ? 1 : 0);
