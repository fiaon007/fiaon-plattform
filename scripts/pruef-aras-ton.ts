// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND (ohne Datenbank, ohne Netz): das Ton-Werk der Brücke (E-408, Justin 20.10.2026 nachmittags, Anruf 16:
// „bricht ab wie Funkprobleme … schlechte Qualität und zu leise“). Mit simulierter Uhr und einem Twilio-Modell, das den
// Ton in Echtzeit abspielt und Marken erst zurückmeldet, wenn der Ton davor gespielt ist.
//
//   npx tsx scripts/pruef-aras-ton.ts            (alles)
//   npx tsx scripts/pruef-aras-ton.ts --wav <o>  (zusätzlich Hörproben „wie bisher“ / „neu“ als WAV)
//
// Geprüft: Abtastratenwandlung (Durchlass, Sperre, Stückgrenzen), Pegel-Regelung (−16 dBFS ±3, kein Pumpen), Begrenzer
// (nie über −1 dBFS), Takt bei drei Lieferarten wie gemessen (Echtzeit mit Schwankung, stoßweise 300 ms/250 ms, 3 % zu
// langsam): 0 Lücken mitten in der Rede, Vorrat ≤ 1,5 s, keine wachsende Verzögerung, `clear` leert sofort — jeweils mit
// Rot-Probe auf dem alten Weg (sofort weiter, ≤ 500 ms, ohne Regelung).
// ═══════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import path from "node:path";
import {
  Tonwerk, Pegelwerk, Begrenzer, Abwaerts24zu8, Aufwaerts8zu24, mulawZuPcm16, rmsDbfs, tiefpassFir,
  TON_ZIEL_DBFS, TON_GRENZE_DBFS, VORLAUF_START_MS, VORSPRUNG_MAX_MS, RAHMEN, type TonwerkOpt,
} from "../server/lib/fiaon-aras-ton";
import { alsWav } from "../server/lib/fiaon-aras-atmo";

let gut = 0, schlecht = 0;
function ok(text: string, bedingung: boolean, fund = ""): void {
  if (bedingung) { gut++; console.log(`  ok    ${text}${fund ? `  (${fund})` : ""}`); } else { schlecht++; console.log(`  ROT   ${text}${fund ? `  →  ${fund}` : ""}`); }
}
function titel(t: string): void { console.log(`\n${"─".repeat(74)}\n${t}\n${"─".repeat(74)}`); }
const db = (x: number) => 20 * Math.log10(Math.max(1e-9, x));

// ── Testsignale ─────────────────────────────────────────────────────────────
function sinus(hz: number, rate: number, ms: number, dbfs: number): Int16Array {
  const n = Math.round((rate * ms) / 1000), a = 10 ** (dbfs / 20) * 32767 * Math.SQRT2, x = new Int16Array(n);
  for (let i = 0; i < n; i++) x[i] = Math.round(a * Math.sin((2 * Math.PI * hz * i) / rate));
  return x;
}
/** Sprachähnlich: Grundton 150 Hz mit Obertönen, Silben (4 Hz) — auf `dbfs` RMS. */
function silben(ms: number, dbfs: number, rate = 8000, start = 0): Int16Array {
  const n = Math.round((rate * ms) / 1000), roh = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = (start + i) / rate;
    let v = 0;
    for (let k = 1; k <= 14; k++) v += Math.sin(2 * Math.PI * 150 * k * t + k) / k;
    roh[i] = v * (0.35 + 0.65 * Math.sin(Math.PI * 4 * t) ** 2);
  }
  let s = 0; for (const v of roh) s += v * v;
  const f = (10 ** (dbfs / 20) * 32767) / Math.sqrt(s / n), x = new Int16Array(n);
  for (let i = 0; i < n; i++) x[i] = Math.max(-32768, Math.min(32767, Math.round(roh[i] * f)));
  return x;
}
/** Ein Gespräch: Redebeiträge (je 2,5 s Rede) mit Pausen (0,8 s) — wie GPT-Live es schickt (auch die Stille). */
function gespraech(beitraege: number, dbfs = -24): { pcm: Int16Array; rede: [number, number][] } {
  const teile: Int16Array[] = []; const rede: [number, number][] = [];
  let ms = 0;
  for (let b = 0; b < beitraege; b++) {
    teile.push(new Int16Array(800 * 8)); ms += 800;
    teile.push(silben(2500, dbfs, 8000, ms * 8)); rede.push([ms, ms + 2500]); ms += 2500;
  }
  teile.push(new Int16Array(1200 * 8)); ms += 1200;
  const n = teile.reduce((s, x) => s + x.length, 0), pcm = new Int16Array(n);
  let o = 0; for (const t of teile) { pcm.set(t, o); o += t.length; }
  return { pcm, rede };
}

// ── Lieferarten (gemessen an echten GPT-Live-Sitzungen 20.10.: 100-ms-Stücke, Abstände median 100, p95 116–126, max 199–345 ms) ──
type Lieferung = { am: number; von: number; bis: number }[];
function zufall(start: number): () => number { let a = start >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function lieferung(art: "echtzeit_schwankend" | "stossweise" | "langsam", gesamtMs: number): Lieferung {
  const l: Lieferung = [], r = zufall(1020);
  let am = 0;
  for (let k = 0; k * 100 < gesamtMs; k++) {
    const soll = art === "langsam" ? k * 103 : k * 100;
    if (art === "echtzeit_schwankend") {
      // Wie gemessen: Abstände um 100 ms (meist ±8, jeder vierte bis +26, selten ein Aufholer, ab und zu ein Hänger bis +245)
      // OHNE späteres Aufholen — im Mittel ~1,5 % langsamer als Echtzeit (gemessen 0,4–3,3 %).
      const w = r();
      const d = w < 0.70 ? 100 + (r() - 0.5) * 16 : w < 0.95 ? 108 + r() * 18 : w < 0.99 ? 70 + r() * 20 : 200 + r() * 145;
      am = k === 0 ? 0 : am + d;
    } else if (art === "stossweise") {
      // 300 ms Stoß (fünfeinhalb Stücke), dann 250 ms Pause — im Mittel Echtzeit
      const zyklus = Math.floor(k / 6), i = k % 6;
      am = zyklus * 600 + i * 55;
    } else am = soll;
    l.push({ am, von: k * 800, bis: Math.min((k + 1) * 800, gesamtMs * 8) });
  }
  return l;
}

/** Twilio-Modell: spielt jeden Rahmen in Echtzeit ab (ab Ankunft, hinter dem Vorrat); Marken kommen, wenn gespielt. */
class TwilioModell {
  spielEnde = 0;
  gespielt: { start: number; rede: boolean; pcm: Int16Array }[] = [];
  marken: { am: number; name: string }[] = [];
  gesendet = 0;
  maxVorratMs = 0;
  rahmen(t: number, mulaw: Buffer): void {
    const pcm = mulawZuPcm16(mulaw);
    const start = Math.max(t, this.spielEnde);
    this.gespielt.push({ start, rede: rmsDbfs(pcm) > -45, pcm });
    this.spielEnde = start + (pcm.length / 8);
    this.maxVorratMs = Math.max(this.maxVorratMs, this.spielEnde - t);
    this.gesendet += 1;
  }
  marke(_t: number, name: string): void { this.marken.push({ am: this.spielEnde, name }); }
  clear(t: number): { name: string }[] { this.spielEnde = t; this.gespielt = this.gespielt.filter((g) => g.start < t); const m = this.marken; this.marken = []; return m; }
  faellig(t: number): string[] { const f = this.marken.filter((m) => m.am <= t).map((m) => m.name); this.marken = this.marken.filter((m) => m.am > t); return f; }
  /**
   * Hörbare Lücken mitten in der Rede: Stille (auch „Twilio leer“) zwischen zwei Rede-Rahmen, `abMs`–350 ms lang. Schon
   * 5–30 ms klingen am Telefon wie Knistern („Funkprobleme“) — darum zählt der Prüfstand ab 5 ms (das Werk meldet ab 40 ms).
   */
  luecken(abMs = 5): number[] {
    const z = [...this.gespielt].sort((a, b) => a.start - b.start);
    const aus: number[] = [];
    void z;
    let letzteRedeEnde = -1, still = 0, pos = 0;
    for (const g of z) {
      if (g.start > pos) still += g.start - pos;            // Twilio lief leer
      if (g.rede) {
        if (letzteRedeEnde >= 0 && still >= abMs && still <= 350) aus.push(Math.round(still));
        letzteRedeEnde = g.start + 20; still = 0;
      } else still += 20;
      pos = g.start + 20;
    }
    return aus;
  }
  /** RMS der gespielten Rede (dBFS) — wie beim Kunden nach µ-law. */
  redePegel(): number {
    let s = 0, n = 0;
    for (const g of this.gespielt) if (g.rede) { for (const v of g.pcm) s += (v / 32768) ** 2; n += g.pcm.length; }
    return n ? 10 * Math.log10(s / n) : -120;
  }
  spitze(): number { let m = 0; for (const g of this.gespielt) for (const v of g.pcm) m = Math.max(m, Math.abs(v)); return db(m / 32768); }
  alsPcm(): Int16Array {
    const z = [...this.gespielt].sort((a, b) => a.start - b.start);
    if (!z.length) return new Int16Array(0);
    const ende = z[z.length - 1].start + 20, aus = new Int16Array(Math.ceil(ende * 8));
    for (const g of z) aus.set(g.pcm.subarray(0, Math.max(0, Math.min(g.pcm.length, aus.length - Math.round(g.start * 8)))), Math.round(g.start * 8));
    return aus;
  }
}

/** Ein Durchlauf mit simulierter Uhr (10-ms-Takt wie in der Brücke). */
function durchlauf(e: { quelle: Int16Array; lieferung: Lieferung; alt?: boolean; clearBei?: number; opt?: Partial<TonwerkOpt> }) {
  let T = 0;
  const tw = new TwilioModell();
  const redeBeginn: number[] = [];
  const werk = new Tonwerk({ senden: (m) => tw.rahmen(T, m), marke: (n) => tw.marke(T, n), jetzt: () => T, alt: e.alt, quelle: "pcmu8k", beiRedeBeginn: (g) => redeBeginn.push(g), ...(e.opt ?? {}) });
  const ende = (e.lieferung[e.lieferung.length - 1]?.am ?? 0) + 3000;
  let i = 0;
  for (T = 0; T <= ende; T += 10) {
    while (i < e.lieferung.length && e.lieferung[i].am <= T) { const l = e.lieferung[i++]; werk.einspeisen(e.quelle.subarray(l.von, l.bis)); }
    if (e.clearBei && T === e.clearBei) { for (const m of tw.clear(T)) werk.markeZurueck(m.name); werk.leeren(); }
    for (const name of tw.faellig(T)) werk.markeZurueck(name);
    werk.takt();
  }
  return { tw, werk, stat: werk.statistik(), redeBeginn };
}

async function main(): Promise<void> {
  // ── 1. Abtastratenwandlung ───────────────────────────────────────────────
  titel("1. ABTASTRATENWANDLUNG 24 kHz → 8 kHz (Anti-Aliasing) und 8 kHz → 24 kHz");
  {
    const pegelNach = (hz: number) => { const a = new Abwaerts24zu8(); const y = a.push(sinus(hz, 24000, 600, -10)); return rmsDbfs(y, 800, y.length - 100) - -10; };
    const d1k = pegelNach(1000), d33 = pegelNach(3300), d5k = pegelNach(5000), d6k = pegelNach(6000), d9k = pegelNach(9000);
    ok("1 kHz geht unverändert durch (±0,5 dB)", Math.abs(d1k) < 0.5, `${d1k.toFixed(2)} dB`);
    ok("3,3 kHz (Telefonband) bleibt hörbar (≥ −3 dB)", d33 > -3, `${d33.toFixed(2)} dB`);
    ok("5 kHz (würde auf 3 kHz falten) ist ≥ 50 dB gedämpft", d5k < -50, `${d5k.toFixed(1)} dB`);
    ok("6 und 9 kHz ebenso (≥ 50 dB)", d6k < -50 && d9k < -50, `${d6k.toFixed(1)} / ${d9k.toFixed(1)} dB`);
    // Rot-Probe: ohne Tiefpass (jede dritte Probe) faltet 5 kHz voll ins Telefonband
    const s5 = sinus(5000, 24000, 600, -10), naiv = new Int16Array(Math.floor(s5.length / 3));
    for (let i = 0; i < naiv.length; i++) naiv[i] = s5[i * 3];
    ok("Rot-Probe: ohne Tiefpass faltet 5 kHz hörbar zurück (kaum gedämpft)", rmsDbfs(naiv) - -10 > -3, `${(rmsDbfs(naiv) - -10).toFixed(1)} dB`);
    // Stückgrenzen: in 100-ms-Stücken = am Stück
    const x = silben(2000, -20, 24000);
    const ganz = new Abwaerts24zu8().push(x), st = new Abwaerts24zu8(), teile: Int16Array[] = [];
    for (let o = 0; o < x.length; o += 2400) teile.push(st.push(x.subarray(o, o + 2400)));
    const zus = new Int16Array(teile.reduce((s, t) => s + t.length, 0)); let o = 0; for (const t of teile) { zus.set(t, o); o += t.length; }
    ok("Stückweise (100 ms) = am Stück (keine Knackser an den Grenzen)", zus.length === ganz.length && zus.every((v, i) => Math.abs(v - ganz[i]) <= 1), `${zus.length}/${ganz.length}`);
    const auf = new Aufwaerts8zu24().push(sinus(1000, 8000, 600, -10));
    ok("8 → 24 kHz: 1 kHz bleibt (±0,5 dB), dreifache Länge", auf.length === 3 * 4800 && Math.abs(rmsDbfs(auf, 2400, auf.length - 300) - -10) < 0.5, `${(rmsDbfs(auf, 2400, auf.length - 300) - -10).toFixed(2)} dB`);
    // Spiegelbild bei 7 kHz (8 − 1) muss weg: Energie oberhalb 4 kHz messen (Hochpass = Signal − Tiefpass)
    const h = tiefpassFir(121, 3700, 24000, 8), tief = new Float64Array(auf.length);
    for (let n = 120; n < auf.length; n++) { let s = 0; for (let k = 0; k < 121; k++) s += h[k] * auf[n - k]; tief[n] = s; }
    let hoch = 0, ges = 0; for (let n = 2400; n < auf.length - 300; n++) { const d = auf[n - 60] - tief[n]; hoch += d * d; ges += auf[n - 60] ** 2; }
    ok("8 → 24 kHz: Spiegelbilder über 4 kHz ≥ 40 dB unter dem Nutzsignal", 10 * Math.log10(hoch / ges) < -40, `${(10 * Math.log10(hoch / ges)).toFixed(1)} dB`);
  }

  // ── 2. Pegel ─────────────────────────────────────────────────────────────
  titel(`2. PEGEL: Rede sanft auf ${TON_ZIEL_DBFS} dBFS (±3), kein Pumpen, Begrenzer bei ${TON_GRENZE_DBFS} dBFS`);
  {
    for (const ein of [-24, -30, -12]) {
      const pw = new Pegelwerk(), x = silben(6000, ein);
      const aus: Int16Array[] = [];
      let maxSchritt = 0, letzte = pw.db;
      for (let i = 0; i < x.length; i += RAHMEN) { aus.push(pw.rahmen(x.subarray(i, i + RAHMEN)).pcm); maxSchritt = Math.max(maxSchritt, Math.abs(pw.db - letzte)); letzte = pw.db; }
      const y = new Int16Array(aus.reduce((s, a) => s + a.length, 0)); let o = 0; for (const a of aus) { y.set(a, o); o += a.length; }
      const nach = rmsDbfs(y, 3 * 8000, y.length);
      ok(`Rede bei ${ein} dBFS → nach der Regelung ${nach.toFixed(1)} dBFS (Ziel ${TON_ZIEL_DBFS} ±3)`, Math.abs(nach - TON_ZIEL_DBFS) <= 3);
      ok(`… ohne Pumpen: höchstens 0,12 dB je 20 ms (6 dB/s)`, maxSchritt <= 0.1201, `${maxSchritt.toFixed(3)} dB`);
    }
    {
      const pw = new Pegelwerk();
      for (let i = 0; i < 100; i++) pw.rahmen(silben(20, -24, 8000, i * 160));
      const vor = pw.db;
      for (let i = 0; i < 200; i++) pw.rahmen(new Int16Array(RAHMEN));     // 4 s Stille
      ok("In Pausen bleibt die Verstärkung stehen (zieht kein Rauschen hoch)", Math.abs(pw.db - vor) < 0.001, `${vor.toFixed(2)} → ${pw.db.toFixed(2)} dB`);
    }
    ok("Rot-Probe: ohne Regelung bleibt GPT-Lives Rede bei −24 dBFS (außerhalb ±3)", Math.abs(rmsDbfs(silben(3000, -24)) - TON_ZIEL_DBFS) > 3);
    const bg = new Begrenzer(), heiss = sinus(400, 8000, 500, -0.2);
    for (let i = 0; i < heiss.length; i++) heiss[i] = Math.round(heiss[i] * 1.0);
    const b = bg.anwenden(heiss);
    let m = 0; for (const v of b) m = Math.max(m, Math.abs(v));
    ok(`Begrenzer: eine Spitze bei −0,2 dBFS kommt bei höchstens ${TON_GRENZE_DBFS} dBFS heraus`, db(m / 32767) <= TON_GRENZE_DBFS + 0.05, `${db(m / 32767).toFixed(2)} dBFS`);
    const bg2 = new Begrenzer(), leise = silben(500, -20), b2 = bg2.anwenden(leise);
    ok("Begrenzer: leise Rede bleibt unverändert (nur 23 Proben ≈ 3 ms später)", leise.subarray(0, leise.length - 23).every((v, i) => Math.abs(b2[i + 23] - v) <= 1));
  }

  // ── 3. Takt zu Twilio ────────────────────────────────────────────────────
  titel("3. TAKT ZU TWILIO: drei Lieferarten wie gemessen — 0 Lücken in der Rede, Rot-Probe auf dem alten Weg");
  const g = gespraech(4);
  const gesamtMs = g.pcm.length / 8;
  const wav: Record<string, Int16Array> = {};
  for (const art of ["echtzeit_schwankend", "stossweise", "langsam"] as const) {
    const l = lieferung(art, gesamtMs);
    const neu = durchlauf({ quelle: g.pcm, lieferung: l });
    const alt = durchlauf({ quelle: g.pcm, lieferung: l, alt: true });
    const ln = neu.tw.luecken(), la = alt.tw.luecken();
    ok(`${art}: 0 Lücken mitten in der Rede (ab 5 ms)`, ln.length === 0 && neu.stat.luecken.anzahl === 0, `${ln.length} Lücken${ln.length ? ` (${ln.slice(0, 5).join(", ")} ms)` : ""} · Werk ${neu.stat.luecken.anzahl}`);
    if (art !== "stossweise") ok(`Rot-Probe ${art}: der alte Weg reißt Lücken in die Rede (Knistern/„Funkprobleme“)`, la.length > 0, `${la.length} Lücken, längste ${la.length ? Math.max(...la) : 0} ms, ${la.filter((x) => x >= 40).length} davon ≥ 40 ms`);
    else ok(`${art}: alter Weg zum Vergleich`, true, `${la.length} Lücken`);
    ok(`${art}: Rede beim Kunden ≈ ${TON_ZIEL_DBFS} dBFS (±3)`, Math.abs(neu.tw.redePegel() - TON_ZIEL_DBFS) <= 3, `${neu.tw.redePegel().toFixed(1)} dBFS · alt ${alt.tw.redePegel().toFixed(1)}`);
    ok(`${art}: Spitze nie über ${TON_GRENZE_DBFS} dBFS`, neu.tw.spitze() <= TON_GRENZE_DBFS + 0.1, `${neu.tw.spitze().toFixed(2)} dBFS`);
    ok(`${art}: Vorrat bei Twilio nie über ${VORSPRUNG_MAX_MS} ms (+ ein Rahmen)`, neu.tw.maxVorratMs <= VORSPRUNG_MAX_MS + 20, `${Math.round(neu.tw.maxVorratMs)} ms`);
    // Verzögerung: jeder Redebeginn ist höchstens Vorlauf + 60 ms nach seiner Lieferung zu hören (keine wachsende Verzögerung)
    const verz = g.rede.map(([von]) => {
      const geliefert = l.find((x) => x.bis > von * 8)?.am ?? 0;
      const gehoert = neu.tw.gespielt.filter((x) => x.rede).map((x) => x.start).find((s) => s >= geliefert) ?? 0;
      return gehoert - geliefert;
    });
    ok(`${art}: Redebeginn ≤ Vorlauf + 60 ms nach Lieferung — auch beim 4. Beitrag (keine wachsende Verzögerung)`, verz.every((v) => v <= neu.stat.vorlaufMs + 60), `${verz.map((v) => Math.round(v)).join(" / ")} ms`);
    if (art === "echtzeit_schwankend") { wav.neu = neu.tw.alsPcm(); wav.alt = alt.tw.alsPcm(); }
  }

  titel("4. LÜCKE, CLEAR, ANLAUT, ANTWORTZEIT");
  {
    // Lieferpause von 600 ms mitten in der Rede: weich überbrückt (ausblenden, einblenden), gezählt, Vorlauf wächst
    const l = lieferung("echtzeit_schwankend", gesamtMs).map((x) => ({ ...x, am: x.am + (x.am >= 1500 ? 600 : 0) }));
    const r = durchlauf({ quelle: g.pcm, lieferung: l });
    ok("Lieferpause 600 ms mitten in der Rede: als EINE Lücke gezählt, Vorlauf danach höher", r.stat.luecken.anzahl === 1 && r.stat.vorlaufMs > VORLAUF_START_MS, JSON.stringify(r.stat.luecken) + ` · Vorlauf ${r.stat.vorlaufMs}`);
    const z = [...r.tw.gespielt].sort((a, b) => a.start - b.start);
    const i = z.findIndex((x, k) => k > 0 && x.rede && !z[k - 1].rede && z[k - 1].start > 1000 && x.start < 4500);
    const ersterNach = i > 0 ? z[i].pcm : null;
    ok("… nach der Lücke weich eingeblendet (keine harte Kante)", !!ersterNach && Math.abs(ersterNach[0]) < 2000 && Math.abs(ersterNach[5]) < 4000, ersterNach ? `${ersterNach[0]}, ${ersterNach[5]}` : "—");
    // clear: nach dem Leeren kommt nichts Altes mehr, der Vorrat steht sofort wieder
    const c = durchlauf({ quelle: g.pcm, lieferung: lieferung("echtzeit_schwankend", gesamtMs), clearBei: 2000 });
    const nachClear = c.tw.gespielt.filter((x) => x.start >= 2000 && x.start < 2300 && x.rede);
    ok("clear: danach keine alte Rede mehr (die nächsten 300 ms still oder neue Rede erst nach dem Vorlauf)", nachClear.length === 0, `${nachClear.length} Rede-Rahmen`);
    // Lange Pause: GPT-Lives Stille fällt weg — der Vorrat wächst nicht über den Vorlauf
    const still = new Int16Array(20 * 8000); const ls = lieferung("echtzeit_schwankend", 20_000);
    const s = durchlauf({ quelle: still, lieferung: ls });
    ok("20 s nur Stille: Vorrat bleibt beim Vorlauf (keine wachsende Verzögerung)", s.tw.maxVorratMs <= VORLAUF_START_MS + 40, `${Math.round(s.tw.maxVorratMs)} ms`);
    // Anlaut: 40 ms vor der Rede gehen mit (ein leiser Konsonant am Anfang bleibt)
    const anlaut = new Int16Array(3000 * 8); anlaut.set(silben(30, -48, 8000), 1000 * 8 - 240); anlaut.set(silben(1500, -24, 8000), 1000 * 8);
    const a = durchlauf({ quelle: anlaut, lieferung: lieferung("echtzeit_schwankend", 3000) });
    const zz = [...a.tw.gespielt].sort((x, y) => x.start - y.start), haupt = zz.findIndex((x) => rmsDbfs(x.pcm) > -30);
    ok("Anlaut: der leise Anfang (30 ms bei −48 dBFS) vor der Rede wird mitgeschickt", haupt >= 2 && zz.slice(haupt - 2, haupt).some((x) => rmsDbfs(x.pcm) > -70), `Rahmen davor: ${zz.slice(Math.max(0, haupt - 2), haupt).map((x) => rmsDbfs(x.pcm).toFixed(0)).join(", ")} dBFS`);
    ok("Antwortzeit: der Redebeginn wird gemeldet (Uhrzeit, wann der Kunde ihn hört)", g.rede.length === 4 && r.redeBeginn.length >= 4, `${r.redeBeginn.length} Meldungen`);
  }

  const k = process.argv.indexOf("--wav");
  if (k > 0 && process.argv[k + 1]) {
    const ordner = process.argv[k + 1];
    fs.mkdirSync(ordner, { recursive: true });
    fs.writeFileSync(path.join(ordner, "pruefstand-wie-bisher.wav"), alsWav(wav.alt));
    fs.writeFileSync(path.join(ordner, "pruefstand-neu.wav"), alsWav(wav.neu));
    console.log(`\n  Hörproben: ${ordner}`);
  }
  console.log(`\n${schlecht ? "ROT" : "GRÜN"}: ${gut} ok, ${schlecht} rot`);
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error("ABBRUCH:", e); process.exit(2); });
