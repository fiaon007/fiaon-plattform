// ═══════════════════════════════════════════════════════════════════════════
// CHEFBÜRO › BESUCHER — das Cockpit der eigenen Messung (15.10.2026, E-378)
//
// Justin: „Besucher hat nie funktioniert … ich brauche super detaillierte
// Aufschlüsselungen." Bis heute stand hier nur Microsoft Clarity: Summen der
// letzten drei Tage, zehn Abrufe am Tag, nur Besucher mit Einwilligung — und
// wegen doppelt verpackter Daten lud die Seite nie (E-377).
//
// Jetzt misst fiaon.com selbst, ohne Cookies (shared/fiaon-besuch.ts,
// server/lib/fiaon-besuch.ts), und diese Seite zeigt es — in der Reihenfolge,
// in der man fragt:
//   1. Wie viele?      Kopfzahlen mit Vergleich zum Zeitraum davor, Verlauf
//   2. Was wird draus? Trichter Besuch → Antrag → bezahlt, nach Kanal/Kampagne/Seite/Gerät
//   3. Wo?             Seiten, Einstieg, Ausstieg
//   4. Woher?          Kanal, Herkunft, Kampagne, Anzeige
//   5. Wer, wann?      Gerät, Sprache, Land, Wochentag × Stunde
//   6. Was sagt Google? Search Console (E-454) — ChefBesucherGoogle.tsx
//   7. Wo klemmt es?   Clarity (Wut-Klicks …) — ChefBesucherClarity.tsx
// JEDE Zeile jeder Liste filtert die GANZE Seite (Kampagne anklicken → alles
// zeigt nur noch diese Kampagne). Zeitraum und Filter stehen in der Adresse —
// ein Link zeigt genau diese Ansicht.
//
// Wenig Text (Justin 12.10.): Zahlen, Linien, kurze Beschriftungen. Was eine Zahl
// genau meint, steht im title der Kachel.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import "@/styles/chef-besucher.css";
import { API, Karte, zahl, eur } from "./chef-teile";
import ChefBesucherClarity, { dauerText } from "./ChefBesucherClarity";
import ChefBesucherGoogle from "./ChefBesucherGoogle";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGAENGE } from "@/pages/agent/rundgaenge";
import "@/styles/office-rundgang.css";
import {
  BESUCH_FILTER, BESUCH_ZEITRAEUME, OHNE,
  type BesuchFilter, type BesuchFilterSchluessel, type BesuchZeitraum,
} from "@shared/fiaon-besuch";

// ── Was der Server liefert (server/lib/fiaon-besuch.ts, besuchAuswertung) ──
interface Zahlen {
  sitzungen: number; besucher: number; seiten: number; absprung: number; dauerMs: number;
  geoeffnet: number; angelegt: number; abgeschickt: number; bezahlt: number; umsatzCents: number;
}
interface Zeile extends Zahlen { name: string }
interface Bereich { von: string; bis: string; tage: number; stunden: boolean }
interface Auswertung {
  ok: true;
  bereich: Bereich; vorherBereich: Bereich | null; messbeginn: string | null;
  live: { jetzt: number; seiten: { pfad: string; n: number }[] };
  kopf: Zahlen; vorher: Zahlen | null;
  verlauf: Zeile[]; verlaufVorher: Zeile[] | null;
  seiten: { pfad: string; aufrufe: number; dauerMs: number | null }[];
  einstiege: Zeile[]; ausstiege: Zeile[]; kanaele: Zeile[]; herkunft: Zeile[]; quellen: Zeile[];
  kampagnen: Zeile[]; inhalte: Zeile[]; gruppen: Zeile[]; geraete: Zeile[]; sprachen: Zeile[]; laender: Zeile[];
  heat: { wt: number; std: number; sitzungen: number }[];
}

// ── Formate ─────────────────────────────────────────────────────────────────
const prozent = (n: number, stellen = 1) =>
  `${(Number.isFinite(n) ? n : 0).toLocaleString("de-DE", { maximumFractionDigits: stellen })} %`;
const anteil = (teil: number, ganz: number) => (ganz > 0 ? (teil / ganz) * 100 : 0);
const tagKurz = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
const tagLang = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });
};
const GERAET: Record<string, string> = { mobil: "Handy", tablet: "Tablet", desktop: "Computer" };
let laenderNamen: Intl.DisplayNames | null | undefined;
let sprachNamen: Intl.DisplayNames | null | undefined;
function landName(code: string): string {
  if (code === OHNE) return "unbekannt";
  if (laenderNamen === undefined) { try { laenderNamen = new Intl.DisplayNames(["de"], { type: "region" }); } catch { laenderNamen = null; } }
  try { return laenderNamen?.of(code) ?? code; } catch { return code; }
}
function sprachName(code: string): string {
  if (code === OHNE) return "unbekannt";
  if (sprachNamen === undefined) { try { sprachNamen = new Intl.DisplayNames(["de"], { type: "language" }); } catch { sprachNamen = null; } }
  try { return sprachNamen?.of(code) ?? code; } catch { return code; }
}
const ohneText = (s: string) => (s === OHNE ? "ohne Angabe" : s);

/** Veränderung gegenüber vorher: Text und Ton. `hochGut = false` für die Absprungrate. */
function veraenderung(jetzt: number, vorher: number | null | undefined, hochGut = true): { text: string; ton: "gut" | "schlecht" | "gleich" } | null {
  if (vorher == null) return null;
  if (vorher === 0) return jetzt === 0 ? { text: "±0", ton: "gleich" } : { text: "neu", ton: hochGut ? "gut" : "schlecht" };
  const d = ((jetzt - vorher) / vorher) * 100;
  if (Math.abs(d) < 0.5) return { text: "±0 %", ton: "gleich" };
  const text = `${d > 0 ? "+" : "−"}${Math.abs(d).toLocaleString("de-DE", { maximumFractionDigits: Math.abs(d) < 10 ? 1 : 0 })} %`;
  return { text, ton: (d > 0) === hochGut ? "gut" : "schlecht" };
}

// ── Zustand in der Adresse ──────────────────────────────────────────────────
interface Ansicht { z: BesuchZeitraum; von: string; bis: string; vgl: boolean; filter: BesuchFilter }
function ansichtAusAdresse(): Ansicht {
  const q = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const z = (BESUCH_ZEITRAEUME.map((x) => x.key) as string[]).includes(q.get("z") || "") ? (q.get("z") as BesuchZeitraum) : "7";
  const filter: BesuchFilter = {};
  for (const k of Object.keys(BESUCH_FILTER) as BesuchFilterSchluessel[]) { const v = q.get(k); if (v) filter[k] = v; }
  return { z, von: q.get("von") || "", bis: q.get("bis") || "", vgl: q.get("vgl") !== "0", filter };
}
function ansichtAbfrage(a: Ansicht): string {
  const q = new URLSearchParams();
  q.set("z", a.z);
  if (a.z === "eigen" && a.von && a.bis) { q.set("von", a.von); q.set("bis", a.bis); }
  if (!a.vgl) q.set("vgl", "0"); else q.set("vgl", "1");
  for (const [k, v] of Object.entries(a.filter)) if (v) q.set(k, v);
  return q.toString();
}

// ═══════════════════════════════════════════════════════════════════════════
// DER VERLAUF — eine Linie, auf Wunsch mit dem Zeitraum davor (gestrichelt)
// ═══════════════════════════════════════════════════════════════════════════
type Kennzahl = "besucher" | "seiten" | "angelegt" | "bezahlt";
const KENNZAHLEN: { key: Kennzahl; label: string }[] = [
  { key: "besucher", label: "Besucher" }, { key: "seiten", label: "Seitenaufrufe" },
  { key: "angelegt", label: "Anträge" }, { key: "bezahlt", label: "Käufe" },
];

/** Eine runde Obergrenze für die Achse: 4 / 5 / 10 / 20 / 25 / 50 / 100 … */
function rundeObergrenze(max: number): number {
  if (max <= 4) return 4;
  const p = Math.pow(10, Math.floor(Math.log10(max)));
  for (const f of [1, 2, 2.5, 5, 10]) if (f * p >= max) return f * p;
  return 10 * p;
}

function Verlauf({ punkte, vorher, stunden, kennzahl }: {
  punkte: Zeile[]; vorher: Zeile[] | null; stunden: boolean; kennzahl: Kennzahl;
}) {
  const huelle = useRef<HTMLDivElement | null>(null);
  const [breite, setBreite] = useState(720);
  const [zeiger, setZeiger] = useState<number | null>(null);
  useEffect(() => {
    const el = huelle.current;
    if (!el) return;
    const messen = () => setBreite(Math.max(260, Math.round(el.clientWidth)));
    messen();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(messen);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = 220, L = 40, R = 12, O = 14, U = 26;
  const werte = punkte.map((p) => p[kennzahl]);
  const werteVorher = vorher && vorher.length === punkte.length ? vorher.map((p) => p[kennzahl]) : null;
  const oben = rundeObergrenze(Math.max(1, ...werte, ...(werteVorher ?? [])));
  const n = punkte.length;
  const x = (i: number) => L + (n <= 1 ? (breite - L - R) / 2 : (i / (n - 1)) * (breite - L - R));
  const y = (v: number) => O + (1 - v / oben) * (H - O - U);
  const linie = (w: number[]) => w.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const flaeche = n > 1 ? `${linie(werte)} L${x(n - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z` : "";
  const beschriftung = (i: number) => (stunden ? `${punkte[i].name}–${String(Number(punkte[i].name) + 1).padStart(2, "0")} Uhr` : tagLang(punkte[i].name));
  const schritt = Math.max(1, Math.ceil(n / Math.max(2, Math.floor((breite - L - R) / 70))));
  const xMarken = punkte.map((_, i) => i).filter((i) => (stunden ? i % (breite < 520 ? 6 : 3) === 0 : i % schritt === 0));
  const label = KENNZAHLEN.find((k) => k.key === kennzahl)?.label ?? "";

  const bewegen = (clientX: number) => {
    const el = huelle.current;
    if (!el || n === 0) return;
    const r = el.getBoundingClientRect();
    const i = n <= 1 ? 0 : Math.round(((clientX - r.left - L) / (breite - L - R)) * (n - 1));
    setZeiger(Math.max(0, Math.min(n - 1, i)));
  };
  const tasten = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") { e.preventDefault(); setZeiger((z) => Math.min(n - 1, (z ?? -1) + 1)); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); setZeiger((z) => Math.max(0, (z ?? n) - 1)); }
    else if (e.key === "Escape") setZeiger(null);
  };

  return (
    <div className="bz-verlauf" ref={huelle} tabIndex={0}
         aria-label={`${label} im Verlauf — mit den Pfeiltasten einzelne ${stunden ? "Stunden" : "Tage"} ansehen`}
         onPointerMove={(e) => bewegen(e.clientX)} onPointerLeave={() => setZeiger(null)}
         onPointerDown={(e) => bewegen(e.clientX)} onKeyDown={tasten} onBlur={() => setZeiger(null)}>
      <svg width={breite} height={H} viewBox={`0 0 ${breite} ${H}`} aria-hidden="true">
        {[0, oben / 2, oben].map((t) => (
          <g key={t}>
            <line x1={L} x2={breite - R} y1={y(t)} y2={y(t)} className="bz-gitter" />
            <text x={L - 8} y={y(t) + 4} textAnchor="end" className="bz-achse">{zahl(t)}</text>
          </g>
        ))}
        {xMarken.map((i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor={n > 1 && i === 0 ? "start" : n > 1 && i === n - 1 ? "end" : "middle"} className="bz-achse">
            {stunden ? punkte[i].name : tagKurz(punkte[i].name)}
          </text>
        ))}
        {werteVorher && <path d={linie(werteVorher)} className="bz-linie-vorher" />}
        {flaeche && <path d={flaeche} className="bz-flaeche" />}
        <path d={linie(werte)} className="bz-linie" />
        {n === 1 && <circle cx={x(0)} cy={y(werte[0])} r={5} className="bz-punkt" />}
        {zeiger != null && (
          <g>
            <line x1={x(zeiger)} x2={x(zeiger)} y1={O} y2={H - U} className="bz-fadenkreuz" />
            {werteVorher && <circle cx={x(zeiger)} cy={y(werteVorher[zeiger])} r={4} className="bz-punkt-vorher" />}
            <circle cx={x(zeiger)} cy={y(werte[zeiger])} r={5} className="bz-punkt" />
          </g>
        )}
      </svg>
      {zeiger != null && (
        <div className="bz-tipp" style={{ left: Math.min(Math.max(x(zeiger), 92), breite - 92) }} role="status">
          <span><b>{zahl(werte[zeiger])}</b> {label}</span>
          <small>{beschriftung(zeiger)}</small>
          {werteVorher && vorher && (
            <small className="bz-tipp-vorher"><i aria-hidden="true" /> {zahl(werteVorher[zeiger])} davor · {stunden ? `${vorher[zeiger].name} Uhr` : tagLang(vorher[zeiger].name)}</small>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EINE RANGLISTE — jede Zeile ist ein Filter für die ganze Seite
// ═══════════════════════════════════════════════════════════════════════════
interface RangZeile { name: string; wert: number; zusatz?: string }
function Rangliste({ titel, zeilen, schluessel, aktiv, waehlen, anzeige, leer, wertTitel }: {
  titel: string; zeilen: RangZeile[]; schluessel: BesuchFilterSchluessel; aktiv: string | undefined;
  waehlen: (k: BesuchFilterSchluessel, v: string) => void; anzeige?: (s: string) => string; leer?: string; wertTitel?: string;
}) {
  const [alle, setAlle] = useState(false);
  const max = Math.max(1, ...zeilen.map((z) => z.wert));
  const sichtbar = alle ? zeilen : zeilen.slice(0, 8);
  return (
    <div className="bz-rang">
      <h3>{titel}{wertTitel && <em>{wertTitel}</em>}</h3>
      {zeilen.length === 0 ? <p className="bz-leise">{leer ?? "Noch nichts in diesem Zeitraum."}</p> : (
        <ul>
          {sichtbar.map((z) => {
            const an = aktiv === z.name;
            const name = anzeige ? anzeige(z.name) : ohneText(z.name);
            return (
              <li key={z.name}>
                <button type="button" className={`bz-rang-zeile${an ? " an" : ""}`} aria-pressed={an}
                        onClick={() => waehlen(schluessel, z.name)} title={an ? "Filter lösen" : `Nur „${name}" zeigen`}>
                  <span className="bz-rang-name"><span>{name}</span>{z.zusatz && <small>{z.zusatz}</small>}</span>
                  <span className="bz-rang-zahl">{zahl(z.wert)}</span>
                  <span className="bz-rang-balken" aria-hidden="true"><i style={{ width: `${Math.max(2, (z.wert / max) * 100)}%` }} /></span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {zeilen.length > 8 && (
        <button type="button" className="bz-mehr" onClick={() => setAlle((a) => !a)}>
          {alle ? "weniger" : `alle ${zeilen.length}`}
        </button>
      )}
    </div>
  );
}

/** Bei Kampagnenangaben steht „ohne Angabe" am Ende — oben stehen die Kampagnen, nach denen man sucht. */
const ohneZuletzt = (l: Zeile[]) => [...l.filter((z) => z.name !== OHNE), ...l.filter((z) => z.name === OHNE)];

/** „3 Anträge · 1 Kauf" — nur, was nicht null ist. */
function ergebnisText(z: Zahlen): string | undefined {
  const t = [
    z.angelegt > 0 ? `${zahl(z.angelegt)} ${z.angelegt === 1 ? "Antrag" : "Anträge"}` : null,
    z.bezahlt > 0 ? `${zahl(z.bezahlt)} ${z.bezahlt === 1 ? "Kauf" : "Käufe"}` : null,
  ].filter(Boolean).join(" · ");
  return t || undefined;
}

// ═══════════════════════════════════════════════════════════════════════════
// DER TRICHTER
// ═══════════════════════════════════════════════════════════════════════════
const TRICHTER_NACH: { key: "kanaele" | "kampagnen" | "einstiege" | "geraete"; label: string; filter: BesuchFilterSchluessel }[] = [
  { key: "kanaele", label: "Kanal", filter: "kanal" },
  { key: "kampagnen", label: "Kampagne", filter: "kampagne" },
  { key: "einstiege", label: "Einstiegsseite", filter: "einstieg" },
  { key: "geraete", label: "Gerät", filter: "geraet" },
];

function Trichter({ k }: { k: Zahlen }) {
  const stufen = [
    { label: "Besuche", n: k.sitzungen, titel: "Sitzungen im Zeitraum" },
    { label: "Antrag geöffnet", n: k.geoeffnet, titel: "Sitzungen, in denen der Antrag geöffnet wurde" },
    { label: "Anträge angelegt", n: k.angelegt, titel: "Anträge mit Kontaktdaten, dem Besuch des Erstkontakts zugeordnet" },
    { label: "abgeschickt", n: k.abgeschickt, titel: "Davon abgeschickt (Hausregel: Schritt 8, eingereicht oder weiter)" },
    { label: "bezahlt", n: k.bezahlt, titel: "Davon mit erster Zahlung (Rate 1 oder Einmalkauf) — aus der einen Umsatz-Quelle" },
  ];
  const oben = Math.max(1, stufen[0].n);
  return (
    <ol className="bz-trichter">
      {stufen.map((s, i) => (
        <li key={s.label} title={s.titel}>
          <span className="bz-trichter-zahl">{zahl(s.n)}</span>
          <span className="bz-trichter-name">{s.label}</span>
          <span className="bz-trichter-quote">{i === 0 ? "" : prozent(anteil(s.n, stufen[i - 1].n))}</span>
          <span className="bz-trichter-balken" aria-hidden="true"><i style={{ width: `${s.n > 0 ? Math.max(1.5, (s.n / oben) * 100) : 0}%` }} /></span>
        </li>
      ))}
    </ol>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// WOCHENTAG × STUNDE
// ═══════════════════════════════════════════════════════════════════════════
const WOCHENTAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
function Wochenkarte({ heat }: { heat: Auswertung["heat"] }) {
  const karte = new Map(heat.map((h) => [`${h.wt}-${h.std}`, h.sitzungen]));
  const max = Math.max(1, ...heat.map((h) => h.sitzungen));
  return (
    <div className="bz-heat" role="table" aria-label="Sitzungen nach Wochentag und Stunde">
      <div className="bz-heat-zeile bz-heat-kopf" role="row">
        <span role="columnheader" />
        {Array.from({ length: 24 }, (_, h) => <span key={h} role="columnheader">{h % 6 === 0 ? h : ""}</span>)}
      </div>
      {WOCHENTAGE.map((tag, i) => (
        <div key={tag} className="bz-heat-zeile" role="row">
          <span role="rowheader">{tag}</span>
          {Array.from({ length: 24 }, (_, h) => {
            const n = karte.get(`${i + 1}-${h}`) ?? 0;
            const text = `${tag} ${String(h).padStart(2, "0")}–${String(h + 1).padStart(2, "0")} Uhr: ${zahl(n)} Sitzungen`;
            return (
              <span key={h} role="cell" className="bz-heat-zelle" tabIndex={n > 0 ? 0 : -1}
                    style={{ ["--a" as string]: n > 0 ? (0.16 + 0.84 * (n / max)).toFixed(3) : "0" } as CSSProperties}
                    title={text} aria-label={text} />
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE SEITE
// ═══════════════════════════════════════════════════════════════════════════
export default function ChefBesucher() {
  const [ansicht, setAnsicht] = useState<Ansicht>(ansichtAusAdresse);
  const [d, setD] = useState<Auswertung | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [runde, setRunde] = useState(0);
  const [live, setLive] = useState<Auswertung["live"] | null>(null);
  const [kennzahl, setKennzahl] = useState<Kennzahl>("besucher");
  const [trichterNach, setTrichterNach] = useState<(typeof TRICHTER_NACH)[number]["key"]>("kanaele");

  const abfrage = ansichtAbfrage(ansicht);

  // Ansicht → Adresse (ohne neuen Verlaufseintrag) und laden. Die alte Ansicht bleibt stehen, bis die neue da ist.
  useEffect(() => {
    try { window.history.replaceState(window.history.state, "", `${window.location.pathname}?${abfrage}`); } catch { /* egal */ }
    if (ansicht.z === "eigen" && !(ansicht.von && ansicht.bis)) return;
    let weg = false;
    setLaedt(true); setFehler(null);
    fetch(`${API}/chef/besucher?${abfrage}`, { credentials: "include" })
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (weg) return;
        if (r.status === 401) { setFehler("Die Anmeldung ist abgelaufen. Bitte neu anmelden."); return; }
        if (r.status === 403) { setFehler(j?.error || "Dafür reicht deine Stufe nicht."); return; }
        if (j?.ok) { setD(j as Auswertung); setLive((j as Auswertung).live); }
        else setFehler(j?.error || "Die Besucherzahlen ließen sich nicht laden.");
      })
      .catch(() => { if (!weg) setFehler("Keine Verbindung zum Server."); })
      .finally(() => { if (!weg) setLaedt(false); });
    return () => { weg = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abfrage, runde]);

  // „Gerade da" — alle 30 Sekunden, nur solange die Seite sichtbar ist.
  useEffect(() => {
    const holen = () => {
      if (document.visibilityState !== "visible") return;
      fetch(`${API}/chef/besucher/live`, { credentials: "include" })
        .then((r) => r.json()).then((j) => { if (j?.ok) setLive({ jetzt: j.jetzt, seiten: j.seiten }); })
        .catch(() => {});
    };
    const t = window.setInterval(holen, 30_000);
    return () => window.clearInterval(t);
  }, []);

  // Liegt der Zeitraum davor ganz vor dem Messbeginn, gibt es nichts zu vergleichen — dann keine „neu"-Marken
  // und keine Nulllinie, sondern ein ehrlicher Satz (E-378: keine erfundene Historie).
  const vergleichMoeglich = !!(d?.vorherBereich && d.messbeginn && d.vorherBereich.bis >= d.messbeginn);
  const kopfKacheln = useMemo(() => {
    if (!d) return [];
    const k = d.kopf, v = vergleichMoeglich ? d.vorher : null;
    const conv = anteil(k.bezahlt, k.besucher);
    const convVorher = v ? anteil(v.bezahlt, v.besucher) : null;
    const kacheln: { label: string; wert: string; titel: string; delta: ReturnType<typeof veraenderung>; klein?: string }[] = [
      { label: "Besucher", wert: zahl(k.besucher), titel: "Verschiedene Besucher je Tag, zusammengezählt — ohne Cookies erkennt die Messung niemanden über den Tag hinaus.", delta: veraenderung(k.besucher, v?.besucher) },
      { label: "Sitzungen", wert: zahl(k.sitzungen), titel: "Besuche mit weniger als 30 Minuten Pause.", delta: veraenderung(k.sitzungen, v?.sitzungen) },
      { label: "Seitenaufrufe", wert: zahl(k.seiten), titel: "Aufgerufene Seiten in diesen Sitzungen.", delta: veraenderung(k.seiten, v?.seiten), klein: k.sitzungen > 0 ? `${(k.seiten / k.sitzungen).toLocaleString("de-DE", { maximumFractionDigits: 1 })} je Sitzung` : undefined },
      { label: "Absprungrate", wert: prozent(k.absprung, 0), titel: "Sitzungen mit nur einer Seite.", delta: veraenderung(k.absprung, v?.absprung, false) },
      { label: "Ø Verweildauer", wert: dauerText(k.dauerMs), titel: "Sichtbare Zeit je Sitzung — mindestens die Spanne vom ersten bis zum letzten Aufruf.", delta: veraenderung(k.dauerMs, v?.dauerMs) },
      { label: "Anträge", wert: zahl(k.angelegt), titel: "Anträge mit Kontaktdaten, die in diesen Sitzungen begonnen wurden (Erstkontakt).", delta: veraenderung(k.angelegt, v?.angelegt), klein: k.abgeschickt > 0 ? `${zahl(k.abgeschickt)} abgeschickt` : undefined },
      { label: "Käufe", wert: zahl(k.bezahlt), titel: "Davon mit erster Zahlung. Der Betrag darunter: alles, was diese Anträge bisher bezahlt haben.", delta: veraenderung(k.bezahlt, v?.bezahlt), klein: k.umsatzCents > 0 ? eur(k.umsatzCents) : undefined },
      { label: "Conversion", wert: prozent(conv, 2), titel: "Käufe je Besucher.", delta: veraenderung(conv, convVorher) },
    ];
    return kacheln;
  }, [d, vergleichMoeglich]);

  const filterSetzen = (k: BesuchFilterSchluessel, v: string) =>
    setAnsicht((a) => {
      const f = { ...a.filter };
      if (f[k] === v) delete f[k]; else f[k] = v;
      return { ...a, filter: f };
    });
  const filterWeg = (k?: BesuchFilterSchluessel) =>
    setAnsicht((a) => {
      if (!k) return { ...a, filter: {} };
      const f = { ...a.filter }; delete f[k];
      return { ...a, filter: f };
    });
  const anzeigeFuer = (k: BesuchFilterSchluessel, v: string): string =>
    k === "land" ? landName(v) : k === "sprache" ? sprachName(v) : k === "geraet" ? (GERAET[v] ?? ohneText(v)) : ohneText(v);
  const filterListe = Object.entries(ansicht.filter) as [BesuchFilterSchluessel, string][];

  // ── Kopf und Steuerung (stehen immer, auch beim ersten Laden) ──────────
  const kopf = (
    <header className="cl-kopf bz-kopf">
      <p className="cl-augenbraue">Besucher · eigene Messung</p>
      <h1>Wer kommt — und was daraus wird</h1>
      <div className="bz-status">
        <span className={`bz-live${(live?.jetzt ?? 0) > 0 ? " an" : ""}`} title="Letzte Bewegung vor höchstens 5 Minuten">
          <i aria-hidden="true" /> <b>{zahl(live?.jetzt ?? 0)}</b> gerade da
        </span>
        {(live?.seiten ?? []).slice(0, 3).map((s) => (
          <span key={s.pfad} className="bz-live-seite">{s.pfad} <b>{s.n}</b></span>
        ))}
        <span className="bz-leise">ohne Cookies · Team und Roboter zählen nicht</span>
        <a className="bz-live-seite bz-sprung" href="#google" title="Zu den Google-Zahlen (Search Console)">Google ↓</a>
      </div>
    </header>
  );

  const steuerung = (
    <div className="bz-steuerung">
      <div className="cl-zeitraum bz-zeitraum" role="tablist" aria-label="Zeitraum">
        {BESUCH_ZEITRAEUME.map((z) => (
          <button key={z.key} type="button" role="tab" aria-selected={ansicht.z === z.key}
                  className={`cl-zeitraum-knopf${ansicht.z === z.key ? " an" : ""}`}
                  onClick={() => setAnsicht((a) => ({
                    ...a, z: z.key,
                    ...(z.key === "eigen" && !(a.von && a.bis) && d ? { von: d.bereich.von, bis: d.bereich.bis } : {}),
                  }))}>
            {z.label}
          </button>
        ))}
      </div>
      {ansicht.z === "eigen" && (
        <div className="bz-eigen">
          <label>von <input type="date" value={ansicht.von} max={ansicht.bis || undefined}
                            onChange={(e) => setAnsicht((a) => ({ ...a, von: e.target.value }))} /></label>
          <label>bis <input type="date" value={ansicht.bis} min={ansicht.von || undefined}
                            onChange={(e) => setAnsicht((a) => ({ ...a, bis: e.target.value }))} /></label>
        </div>
      )}
      <label className="bz-vergleich">
        <input type="checkbox" checked={ansicht.vgl} onChange={(e) => setAnsicht((a) => ({ ...a, vgl: e.target.checked }))} />
        Vergleich mit davor
      </label>
    </div>
  );

  const filterZeile = filterListe.length > 0 ? (
    <div className="bz-filter" role="group" aria-label="Aktive Filter">
      {filterListe.map(([k, v]) => (
        <button key={k} type="button" className="bz-filter-chip" onClick={() => filterWeg(k)} title="Filter lösen">
          <span>{BESUCH_FILTER[k]}</span> <b>{anzeigeFuer(k, v)}</b> <i aria-hidden="true">×</i>
        </button>
      ))}
      {filterListe.length > 1 && <button type="button" className="bz-filter-alle" onClick={() => filterWeg()}>alle lösen</button>}
    </div>
  ) : null;

  let inhalt: ReactNode = null;
  if (!d && laedt) {
    inhalt = <div className="cl-geruest" aria-hidden="true">{Array.from({ length: 6 }).map((_, i) => <span key={i} />)}</div>;
  } else if (!d && fehler) {
    inhalt = (
      <div className="cl-fehler" role="alert">
        <b>{fehler}</b>
        <button type="button" onClick={() => setRunde((r) => r + 1)}>Nochmal versuchen</button>
      </div>
    );
  } else if (d) {
    const k = d.kopf;
    const b = d.bereich;
    const vorMessbeginn = d.messbeginn != null && b.von < d.messbeginn;
    const trichter = TRICHTER_NACH.find((t) => t.key === trichterNach) ?? TRICHTER_NACH[0];
    const trichterZeilen = (d[trichter.key] as Zeile[]).slice(0, 15);
    const nurOhne = (l: Zeile[]) => l.length === 0 || l.every((z) => z.name === OHNE);
    const zeitraumText = b.von === b.bis ? tagLang(b.von) : `${tagKurz(b.von)} – ${tagKurz(b.bis)}${b.bis.slice(0, 4)}`;

    inhalt = (
      <div className={`bz-inhalt${laedt ? " laedt" : ""}`} aria-busy={laedt}>
        {fehler && <p className="cw-meldung" role="status">{fehler}</p>}
        {d.messbeginn == null ? (
          <div className="bz-hinweis" role="status">
            <b>Die Messung läuft.</b> Sobald jemand fiaon.com öffnet, stehen hier die ersten Zahlen.
          </div>
        ) : vorMessbeginn ? (
          <div className="bz-hinweis" role="status">
            Eigene Messung seit <b>{tagLang(d.messbeginn)}</b> — davor gibt es keine Zahlen.
          </div>
        ) : null}

        {/* ── 1. Wie viele ───────────────────────────────────────────────── */}
        <p className="bz-zeitraum-text">
          {zeitraumText}
          {d.vorherBereich && (vergleichMoeglich
            ? <span> · verglichen mit {tagKurz(d.vorherBereich.von)} – {tagKurz(d.vorherBereich.bis)}</span>
            : <span> · davor noch keine Messung — kein Vergleich</span>)}
        </p>
        <div className="bz-kacheln">
          {kopfKacheln.map((t) => (
            <Karte key={t.label} klasse="bz-kz" titel={t.titel}>
              <b>{t.wert}</b>
              <em>{t.label}</em>
              {(t.delta || t.klein) && (
                <small>
                  {t.delta && <span className={`bz-delta ${t.delta.ton}`}>{t.delta.text}</span>}
                  {t.klein && <span>{t.klein}</span>}
                </small>
              )}
            </Karte>
          ))}
        </div>

        <section className="bz-abschnitt">
          <div className="bz-abschnitt-kopf">
            <h2>Verlauf <em>{b.stunden ? "je Stunde" : "je Tag"}</em></h2>
            <div className="bz-schalter" role="tablist" aria-label="Kennzahl im Verlauf">
              {KENNZAHLEN.map((x) => (
                <button key={x.key} type="button" role="tab" aria-selected={kennzahl === x.key}
                        className={kennzahl === x.key ? "an" : ""} onClick={() => setKennzahl(x.key)}>{x.label}</button>
              ))}
            </div>
          </div>
          <div className="bz-karte">
            <Verlauf punkte={d.verlauf} vorher={vergleichMoeglich ? d.verlaufVorher : null} stunden={b.stunden} kennzahl={kennzahl} />
            {d.verlaufVorher && vergleichMoeglich && (
              <p className="bz-legende">
                <span><i className="bz-legende-jetzt" aria-hidden="true" /> {zeitraumText}</span>
                <span><i className="bz-legende-vorher" aria-hidden="true" /> davor</span>
              </p>
            )}
            <details className="bz-tabelle-auf">
              <summary>als Tabelle</summary>
              <div className="cw-tabelle-rahmen">
                <table className="cw-tabelle">
                  <thead><tr><th scope="col">{b.stunden ? "Stunde" : "Tag"}</th><th scope="col">Besucher</th><th scope="col">Sitzungen</th><th scope="col">Seiten</th><th scope="col">Anträge</th><th scope="col">Käufe</th></tr></thead>
                  <tbody>
                    {d.verlauf.map((z) => (
                      <tr key={z.name}>
                        <td>{b.stunden ? `${z.name} Uhr` : tagLang(z.name)}</td>
                        <td>{zahl(z.besucher)}</td><td>{zahl(z.sitzungen)}</td><td>{zahl(z.seiten)}</td>
                        <td>{zahl(z.angelegt)}</td><td>{zahl(z.bezahlt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        </section>

        {/* ── 2. Was daraus wird ─────────────────────────────────────────── */}
        <section className="bz-abschnitt">
          <div className="bz-abschnitt-kopf"><h2>Vom Besuch zum Kauf</h2></div>
          <div className="bz-karte">
            <Trichter k={k} />
          </div>
          <div className="bz-abschnitt-kopf bz-nach">
            <h3 className="bz-unterkopf">aufgeschlüsselt nach</h3>
            <div className="bz-schalter" role="tablist" aria-label="Trichter aufschlüsseln nach">
              {TRICHTER_NACH.map((t) => (
                <button key={t.key} type="button" role="tab" aria-selected={trichterNach === t.key}
                        className={trichterNach === t.key ? "an" : ""} onClick={() => setTrichterNach(t.key)}>{t.label}</button>
              ))}
            </div>
          </div>
          <div className="cw-tabelle-rahmen bz-trichter-tabelle">
            <table className="cw-tabelle">
              <thead>
                <tr>
                  <th scope="col">{trichter.label}</th>
                  <th scope="col">Besuche</th><th scope="col">Antrag auf</th><th scope="col">Anträge</th>
                  <th scope="col">abgeschickt</th><th scope="col">bezahlt</th><th scope="col">Umsatz</th><th scope="col" title="Käufe je Besuch">Quote</th>
                </tr>
              </thead>
              <tbody>
                {trichterZeilen.length === 0 && <tr><td colSpan={8} className="bz-leise">Noch keine Besuche in diesem Zeitraum.</td></tr>}
                {trichterZeilen.map((z) => {
                  const an = ansicht.filter[trichter.filter] === z.name;
                  return (
                    <tr key={z.name} className={`bz-klickzeile${an ? " an" : ""}`} tabIndex={0}
                        onClick={() => filterSetzen(trichter.filter, z.name)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); filterSetzen(trichter.filter, z.name); } }}
                        title={an ? "Filter lösen" : "Ganze Seite danach filtern"}>
                      <td className="bz-name-zelle">{anzeigeFuer(trichter.filter, z.name)}</td>
                      <td>{zahl(z.sitzungen)}</td>
                      <td>{zahl(z.geoeffnet)}</td>
                      <td>{zahl(z.angelegt)}</td>
                      <td>{zahl(z.abgeschickt)}</td>
                      <td>{z.bezahlt > 0 ? <b>{zahl(z.bezahlt)}</b> : "0"}</td>
                      <td>{z.umsatzCents > 0 ? eur(z.umsatzCents) : "—"}</td>
                      <td>{prozent(anteil(z.bezahlt, z.sitzungen), 2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── 3. Wo ──────────────────────────────────────────────────────── */}
        <section className="bz-abschnitt">
          <div className="bz-abschnitt-kopf"><h2>Seiten</h2></div>
          <div className="bz-raenge">
            <Rangliste titel="Meistgesehen" wertTitel="Aufrufe" schluessel="seite" aktiv={ansicht.filter.seite} waehlen={filterSetzen}
                       zeilen={d.seiten.map((s) => ({ name: s.pfad, wert: s.aufrufe, zusatz: s.dauerMs ? `Ø ${dauerText(s.dauerMs)} sichtbar` : undefined }))} />
            <Rangliste titel="Einstieg" wertTitel="Sitzungen" schluessel="einstieg" aktiv={ansicht.filter.einstieg} waehlen={filterSetzen}
                       zeilen={d.einstiege.map((z) => ({ name: z.name, wert: z.sitzungen, zusatz: `${prozent(z.absprung, 0)} Absprung${ergebnisText(z) ? ` · ${ergebnisText(z)}` : ""}` }))} />
            <Rangliste titel="Ausstieg" wertTitel="Sitzungen" schluessel="ausstieg" aktiv={ansicht.filter.ausstieg} waehlen={filterSetzen}
                       zeilen={d.ausstiege.map((z) => ({ name: z.name, wert: z.sitzungen }))} />
          </div>
        </section>

        {/* ── 4. Woher ───────────────────────────────────────────────────── */}
        <section className="bz-abschnitt">
          <div className="bz-abschnitt-kopf"><h2>Woher</h2></div>
          <div className="bz-raenge">
            <Rangliste titel="Kanal" wertTitel="Sitzungen" schluessel="kanal" aktiv={ansicht.filter.kanal} waehlen={filterSetzen}
                       zeilen={d.kanaele.map((z) => ({ name: z.name, wert: z.sitzungen, zusatz: ergebnisText(z) }))} />
            <Rangliste titel="Herkunft" wertTitel="Sitzungen" schluessel="herkunft" aktiv={ansicht.filter.herkunft} waehlen={filterSetzen}
                       anzeige={(s) => (s === OHNE ? "direkt / unbekannt" : s)}
                       zeilen={d.herkunft.map((z) => ({ name: z.name, wert: z.sitzungen, zusatz: ergebnisText(z) }))} />
            <Rangliste titel="Kampagne" wertTitel="Sitzungen" schluessel="kampagne" aktiv={ansicht.filter.kampagne} waehlen={filterSetzen}
                       leer="Noch keine Kampagnen-Angaben (utm_campaign)."
                       zeilen={nurOhne(d.kampagnen) ? [] : ohneZuletzt(d.kampagnen).map((z) => ({ name: z.name, wert: z.sitzungen, zusatz: ergebnisText(z) }))} />
            {!nurOhne(d.inhalte) && (
              <Rangliste titel="Anzeige" wertTitel="utm_content" schluessel="inhalt" aktiv={ansicht.filter.inhalt} waehlen={filterSetzen}
                         zeilen={ohneZuletzt(d.inhalte).map((z) => ({ name: z.name, wert: z.sitzungen, zusatz: ergebnisText(z) }))} />
            )}
            {!nurOhne(d.gruppen) && (
              <Rangliste titel="Anzeigengruppe" wertTitel="utm_term" schluessel="gruppe" aktiv={ansicht.filter.gruppe} waehlen={filterSetzen}
                         zeilen={ohneZuletzt(d.gruppen).map((z) => ({ name: z.name, wert: z.sitzungen, zusatz: ergebnisText(z) }))} />
            )}
            {!nurOhne(d.quellen) && (
              <Rangliste titel="Quelle" wertTitel="utm_source" schluessel="quelle" aktiv={ansicht.filter.quelle} waehlen={filterSetzen}
                         zeilen={ohneZuletzt(d.quellen).map((z) => ({ name: z.name, wert: z.sitzungen, zusatz: ergebnisText(z) }))} />
            )}
          </div>
        </section>

        {/* ── 5. Wer und wann ────────────────────────────────────────────── */}
        <section className="bz-abschnitt">
          <div className="bz-abschnitt-kopf"><h2>Wer und wann</h2></div>
          <div className="bz-raenge">
            <Rangliste titel="Gerät" wertTitel="Sitzungen" schluessel="geraet" aktiv={ansicht.filter.geraet} waehlen={filterSetzen}
                       anzeige={(s) => GERAET[s] ?? ohneText(s)}
                       zeilen={d.geraete.map((z) => ({ name: z.name, wert: z.sitzungen, zusatz: `${prozent(anteil(z.sitzungen, k.sitzungen), 0)}${ergebnisText(z) ? ` · ${ergebnisText(z)}` : ""}` }))} />
            <Rangliste titel="Land" wertTitel="Sitzungen" schluessel="land" aktiv={ansicht.filter.land} waehlen={filterSetzen}
                       anzeige={landName} zeilen={d.laender.map((z) => ({ name: z.name, wert: z.sitzungen }))} />
            <Rangliste titel="Sprache" wertTitel="Sitzungen" schluessel="sprache" aktiv={ansicht.filter.sprache} waehlen={filterSetzen}
                       anzeige={sprachName} zeilen={d.sprachen.map((z) => ({ name: z.name, wert: z.sitzungen }))} />
          </div>
          <div className="bz-karte bz-heat-karte">
            <h3 className="bz-unterkopf">Wochentag × Stunde <em>Beginn der Sitzung</em></h3>
            <Wochenkarte heat={d.heat} />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="cl bz">
      {kopf}
      <div className="bz-leiste">
        {steuerung}
        {filterZeile}
      </div>
      {inhalt}
      <ChefBesucherGoogle />
      <ChefBesucherClarity />
      <Rundgang raum="besucher" titel="Besucher" schritte={RUNDGAENGE.besucher.schritte} />
    </div>
  );
}
