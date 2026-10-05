import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { Download, Plus, Trash2 } from "lucide-react";
import { PageIntro, Tip } from "@/components/admin/PageHelp";
import { KUNDENSTATUS, zahlungsstatusText } from "@shared/fiaon-kundenstatus";

// ════════════════════════════════════════════════════════════════════
// /admin/finanzen — Finanz- & Sales-Analytics-Zentrale (Paket BD).
// ALLE Kennzahlen kommen serverseitig aggregiert; hier nur Anzeige.
// ════════════════════════════════════════════════════════════════════

const ACCENT = "#2563eb";

async function apiF(path: string, init?: RequestInit) {
  const res = await fetch(`/api/fiaon${path}`, {
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok && json?.ok, json };
}

function eur(cents: number | null | undefined) {
  if (cents == null) return "—";
  return `${(Number(cents) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}
function pct(v: number | null | undefined) {
  return v == null ? "—" : `${v.toLocaleString("de-DE")} %`;
}

type RangeKey = "heute" | "gestern" | "7t" | "30t" | "monat" | "custom";
function computeRange(key: RangeKey, custom: { from: string; to: string }): { from: string; to: string } {
  const now = new Date();
  const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const endOfDay = (d: Date) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
  if (key === "custom" && custom.from && custom.to) return { from: new Date(custom.from).toISOString(), to: endOfDay(new Date(custom.to)).toISOString() };
  if (key === "heute") return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() };
  if (key === "gestern") { const y = new Date(now.getTime() - 864e5); return { from: startOfDay(y).toISOString(), to: endOfDay(y).toISOString() }; }
  if (key === "monat") { const f = new Date(now.getFullYear(), now.getMonth(), 1); return { from: f.toISOString(), to: endOfDay(now).toISOString() }; }
  const days = key === "7t" ? 7 : 30;
  return { from: startOfDay(new Date(now.getTime() - days * 864e5)).toISOString(), to: endOfDay(now).toISOString() };
}

// P2-D: Jede Kennzahl bekommt einen Tooltip mit Klartext-Definition (tip).
function Kpi({ label, value, sub, tip }: { label: string; value: string; sub?: string; tip?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1 flex items-center">
        {label}
        {tip && <Tip text={tip} />}
      </p>
      <p className="text-lg font-bold tracking-tight text-slate-900 tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function FunnelBars({ title, hint, stages, color = ACCENT, footer }: { title: string; hint: string; stages: { label: string; value: number; rate: number | null; tip: string }[]; color?: string; footer?: string }) {
  const max = Math.max(1, ...stages.map((s) => s.value));
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[13px] font-semibold text-slate-800">{title}</p>
      </div>
      <p className="text-[11px] text-slate-400 mb-3">{hint}</p>
      <div className="space-y-2">
        {stages.map((s, i) => (
          <div key={s.label} className="flex items-center gap-3">
            <div className="w-36 text-[12px] text-slate-500 shrink-0 flex items-center">{s.label}<Tip text={s.tip} /></div>
            <div className="flex-1 h-7 rounded-lg bg-slate-100 overflow-hidden">
              <div className="h-full rounded-lg flex items-center px-2 text-[11px] font-semibold text-white" style={{ width: `${Math.max(6, (s.value / max) * 100)}%`, background: color }}>{s.value}</div>
            </div>
            <div className="w-20 text-right text-[12px] text-slate-400 shrink-0">{i > 0 ? pct(s.rate) : ""}</div>
          </div>
        ))}
      </div>
      {footer && <p className="text-[11px] text-slate-500 mt-3 pt-2 border-t border-slate-100">{footer}</p>}
    </div>
  );
}

function Funnels({ f, r }: { f: any; r: any }) {
  const lead = f.lead || {}, rl = r.lead || {};
  const ges = f.gesamt || {}, rg = r.gesamt || {};
  return (
    <div className="grid lg:grid-cols-2 gap-4 mb-5">
      <FunnelBars
        title="Lead-Funnel (nur Leads)"
        hint={`Nur aus Leads entstandene Anträge. Rate je Stufe = Stufe ÷ vorherige Stufe. Gesamt Lead→zahlend: ${pct(rl.gesamtLeadToBezahlt)}`}
        stages={[
          { label: "Leads", value: lead.leads || 0, rate: null, tip: "Alle Leads im Zeitraum (Bezugsgröße)" },
          // P2-D ehrlich: Massenmail ist KEIN Kontakt — diese Stufe heißt jetzt „Angeschrieben".
          { label: "Angeschrieben (Mail)", value: lead.angeschrieben ?? lead.kontaktiert ?? 0, rate: rl.leadToKontaktiert, tip: "Lead hat mindestens eine automatische Mail erhalten (Status nicht mehr 'neu'). Das ist KEIN persönlicher Kontakt." },
          { label: "Antrag gestellt", value: lead.antraege || 0, rate: rl.kontaktiertToAntrag, tip: "Konvertierte Leads ÷ angeschriebene Leads" },
          { label: zahlungsstatusText("claimed_paid"), value: lead.angekuendigt || 0, rate: rl.antragToAngekuendigt, tip: "Verknüpfte Order gemeldet/bezahlt ÷ Anträge" },
          { label: "Bezahlt", value: lead.bezahlt || 0, rate: rl.angekuendigtToBezahlt, tip: "Verknüpfte Order bezahlt ÷ angekündigt (nur echte, referenzierte Zahlungen)" },
        ]}
        footer={`Echt kontaktiert (dokumentiertes Agenten-Ergebnis): ${lead.kontaktiertEcht ?? "—"} von ${lead.leads || 0} Leads`}
      />
      <FunnelBars
        title="Gesamt-Funnel (inkl. Direkt)"
        hint={`ALLE Anträge im Zeitraum (auch Direktkunden ohne Lead). Antrag→bezahlt: ${pct(rg.antragToBezahlt)}`}
        color="#64748b"
        stages={[
          { label: "Antrag gestellt", value: ges.antraege || 0, rate: null, tip: "Alle Anträge/Bestellungen (Bezugsgröße)" },
          { label: zahlungsstatusText("claimed_paid"), value: ges.angekuendigt || 0, rate: rg.antragToAngekuendigt, tip: "Gemeldet/bezahlt ÷ Anträge" },
          { label: "Bezahlt", value: ges.bezahlt || 0, rate: rg.angekuendigtToBezahlt, tip: "Bezahlt ÷ angekündigt" },
        ]}
      />
    </div>
  );
}

function LineChart({ points, color = ACCENT }: { points: { date: string; v: number }[]; color?: string }) {
  const { path, max } = useMemo(() => {
    if (points.length === 0) return { path: "", max: 0 };
    const mx = Math.max(1, ...points.map((p) => p.v));
    const w = 100, h = 40;
    const step = points.length > 1 ? w / (points.length - 1) : 0;
    const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(2)},${(h - (p.v / mx) * h).toFixed(2)}`).join(" ");
    return { path: d, max: mx };
  }, [points]);
  if (points.length === 0) return <p className="text-[12px] text-slate-400">Keine Daten im Zeitraum.</p>;
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-24">
      <path d={path} fill="none" stroke={color} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// ════════════════════════════════════════════════════════════════════
// ANTRAGSWEG: ALT GEGEN NEU (05.10.2026, E-282)
// Justin: „ich will später wissen, wie der Weg performt und wie das alte".
// Zahlen: GET /admin/finance/antrag-vergleich (gleicher Zeitraum wie oben).
// Weiche: POST /admin/finance/antrag-weiche — wie viel Prozent der NEUEN
// Besucher /antrag-neu sehen. Unterschiede nur als Text-Pfeil, keine
// Doppelachsen: Die Wege haben verschieden viele Besucher, vergleichbar
// sind deshalb die Quoten, nicht die Stückzahlen.
// ════════════════════════════════════════════════════════════════════

const WEICHE_STUFEN_UI = [0, 10, 25, 50, 100];
const PAKET_NAME: Record<string, string> = { start: "Start", pro: "Pro", ultra: "Ultra", highend: "High-End", ohne: "ohne Paket" };

function zahl(n: number | null | undefined) {
  return n == null ? "—" : Number(n).toLocaleString("de-DE");
}
function minuten(n: number | null | undefined) {
  return n == null ? "—" : `${Number(n).toLocaleString("de-DE", { maximumFractionDigits: 1 })} Min.`;
}
function berlinZeit(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Unterschied neu gegen alt als Text-Pfeil. hoeherBesser=false bei Dauer. */
function Pfeil({ alt, neu, einheit, hoeherBesser = true }: { alt: number | null | undefined; neu: number | null | undefined; einheit: string; hoeherBesser?: boolean }) {
  if (alt == null || neu == null) return null;
  const diff = Math.round((neu - alt) * 10) / 10;
  if (diff === 0) return <span className="ml-1.5 text-[11px] text-slate-400 whitespace-nowrap">= gleich</span>;
  const besser = hoeherBesser ? diff > 0 : diff < 0;
  return (
    <span className={`ml-1.5 text-[11px] font-semibold whitespace-nowrap ${besser ? "text-emerald-600" : "text-rose-600"}`}>
      {diff > 0 ? "↑" : "↓"} {Math.abs(diff).toLocaleString("de-DE")} {einheit}
    </span>
  );
}

function paketZeile(pakete: { paket: string; abgeschickt: number }[] | undefined) {
  const l = (pakete || []).filter((p) => p.abgeschickt > 0).sort((a, b) => b.abgeschickt - a.abgeschickt);
  if (l.length === 0) return "—";
  return l.map((p) => `${PAKET_NAME[p.paket] ?? p.paket} ${p.abgeschickt.toLocaleString("de-DE")}`).join(" · ");
}

function geraeteZeile(geraete: { geraet: string; sitzungen: number }[] | undefined) {
  const l = geraete || [];
  const summe = l.reduce((s, g) => s + g.sitzungen, 0);
  if (summe === 0) return null;
  const name: Record<string, string> = { handy: "Handy", tablet: "Tablet", desktop: "Desktop", unbekannt: "unbekannt" };
  return l.map((g) => `${name[g.geraet] ?? g.geraet} ${Math.round((g.sitzungen / summe) * 100)} %`).join(" · ");
}

function WegTrichter({ titel, weg, farbe }: { titel: string; weg: any; farbe: string }) {
  const sitzungen: number = weg?.sitzungen ?? 0;
  const schritte: any[] = weg?.trichter ?? [];
  const geraete = geraeteZeile(weg?.geraete);
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4" data-fiaon={`antragsvergleich-trichter-${titel.startsWith("Alt") ? "alt" : "neu"}`}>
      <p className="text-[13px] font-semibold text-slate-800">{titel}</p>
      <p className="text-[11px] text-slate-400 mb-3">Balken = Anteil der {zahl(sitzungen)} geöffneten Sitzungen, die den Schritt gesehen haben. Rechts: Abbruch an diesem Schritt.</p>
      {sitzungen === 0 ? (
        <p className="text-[12px] text-slate-400">Noch keine gemessenen Sitzungen auf diesem Weg im Zeitraum.</p>
      ) : (
        <div className="space-y-1.5">
          {schritte.map((s) => (
            <div key={s.schritt} className="flex items-center gap-2">
              <div className="w-28 sm:w-36 text-[12px] text-slate-500 shrink-0 truncate" title={s.schritt}>{s.label}</div>
              <div className="flex-1 min-w-0 h-6 rounded-md bg-slate-100 overflow-hidden">
                <div className="h-full rounded-md flex items-center px-1.5 text-[11px] font-semibold text-white tabular-nums" style={{ width: `${Math.max(s.sitzungen > 0 ? 8 : 0, Math.min(100, s.anteil ?? 0))}%`, background: farbe }}>{s.sitzungen > 0 ? s.sitzungen : ""}</div>
              </div>
              <div className="w-12 text-right text-[12px] text-slate-600 tabular-nums shrink-0">{s.anteil == null ? "—" : `${Math.round(s.anteil)} %`}</div>
              <div className="w-10 text-right text-[11px] text-slate-400 tabular-nums shrink-0" title="Sitzungen, die hier zuletzt standen, ohne den Vertrag anzunehmen">{s.abbruch > 0 ? `−${s.abbruch}` : ""}</div>
            </div>
          ))}
        </div>
      )}
      {sitzungen > 0 && (
        <div className="text-[11px] text-slate-500 mt-3 pt-2 border-t border-slate-100 space-y-0.5">
          {weg.abbruchOhneSchritt > 0 && <p>Ohne gezeigten Schritt verlassen: {zahl(weg.abbruchOhneSchritt)}</p>}
          <p>Vertrag angenommen in {zahl(weg.angenommenSitzungen)} Sitzungen.</p>
          {geraete && <p>Geräte: {geraete}</p>}
        </div>
      )}
    </div>
  );
}

function FeldFehler({ titel, fehler }: { titel: string; fehler: { schritt: string | null; feld: string; anzahl: number }[] | undefined }) {
  const l = fehler || [];
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <p className="text-[13px] font-semibold text-slate-800">{titel}</p>
      <p className="text-[11px] text-slate-400 mb-2">Abgelehnte Eingaben je Feld (nur der Feldname, nie der Inhalt).</p>
      {l.length === 0 ? (
        <p className="text-[12px] text-slate-400">Noch keine Feldfehler im Zeitraum.</p>
      ) : (
        <table className="w-full text-[12.5px]">
          <tbody>
            {l.map((f, i) => (
              <tr key={`${f.schritt}-${f.feld}-${i}`} className="border-t border-slate-100 first:border-0">
                <td className="py-1 text-slate-700">{f.feld}</td>
                <td className="py-1 text-slate-400">{f.schritt ?? "—"}</td>
                <td className="py-1 text-right text-slate-800 font-semibold tabular-nums">{zahl(f.anzahl)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function AntragVergleich({ qs }: { qs: string }) {
  const [daten, setDaten] = useState<any>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [wahl, setWahl] = useState<number | null>(null);
  const [fragen, setFragen] = useState(false);
  const [speichert, setSpeichert] = useState(false);
  const [meldung, setMeldung] = useState<{ art: "ok" | "fehler"; text: string } | null>(null);

  const laden = useCallback(async () => {
    setLaedt(true); setFehler(null);
    const ab = new AbortController();
    const zeit = setTimeout(() => ab.abort(), 20_000);
    try {
      const r = await apiF(`/admin/finance/antrag-vergleich?${qs}`, { signal: ab.signal });
      if (r.ok) setDaten(r.json);
      else setFehler(r.json?.error || `Der Vergleich konnte nicht geladen werden (HTTP ${r.status}).`);
    } catch (e: any) {
      setFehler(e?.name === "AbortError" ? "Der Vergleich hat nach 20 Sekunden nicht geantwortet." : "Keine Verbindung zum Server — der Vergleich wurde nicht geladen.");
    } finally {
      clearTimeout(zeit);
      setLaedt(false);
    }
  }, [qs]);
  useEffect(() => { void laden(); }, [laden]);

  const weiche = daten?.weiche;
  const aktuell: number | null = weiche ? Number(weiche.anteil) : null;
  const gewaehlt = wahl ?? aktuell;
  const geaendert = gewaehlt != null && aktuell != null && gewaehlt !== aktuell;

  const speichern = async () => {
    if (gewaehlt == null) return;
    setSpeichert(true); setMeldung(null);
    try {
      const r = await apiF("/admin/finance/antrag-weiche", { method: "POST", body: JSON.stringify({ anteil: gewaehlt }) });
      if (r.ok) {
        setDaten((d: any) => d ? { ...d, weiche: { ...d.weiche, anteil: r.json.anteil, quelle: r.json.quelle, geaendertAm: r.json.geaendertAm, geaendertVon: r.json.geaendertVon } } : d);
        setWahl(null); setFragen(false);
        setMeldung({ art: "ok", text: `Gespeichert. Ab jetzt sehen ${r.json.anteil} % der neuen Besucher den neuen Antrag.` });
      } else {
        setMeldung({ art: "fehler", text: r.json?.error || `Nicht gespeichert (HTTP ${r.status}). Der bisherige Anteil gilt weiter.` });
      }
    } catch {
      setMeldung({ art: "fehler", text: "Keine Verbindung — nicht gespeichert. Der bisherige Anteil gilt weiter." });
    } finally {
      setSpeichert(false);
    }
  };

  const alt = daten?.alt, neu = daten?.neu, def = daten?.definitionen || {};
  const leer = !!daten && (alt?.sitzungenBasis ?? 0) === 0 && (alt?.angelegt ?? 0) === 0 && (neu?.sitzungen ?? 0) === 0 && (neu?.angelegt ?? 0) === 0;
  const wenig = !!daten && !leer && Math.min(alt?.sitzungenBasis ?? 0, neu?.sitzungen ?? 0) < 50;

  const zeilen: { label: string; tip?: string; a: string; n: string; pfeil?: ReactNode }[] = daten && !leer ? [
    { label: "Sitzungen", tip: def.sitzungen, a: zahl(alt.sitzungenBasis) + (alt.sitzungenHilfsweise ? " *" : ""), n: zahl(neu.sitzungen) },
    { label: "Antrag angelegt", tip: def.angelegt, a: zahl(alt.angelegt), n: zahl(neu.angelegt) },
    { label: "Abgeschickt", tip: def.abgeschickt, a: zahl(alt.abgeschickt), n: zahl(neu.abgeschickt) },
    { label: "Erste Rate bezahlt", tip: def.bezahlt, a: zahl(alt.bezahlt), n: zahl(neu.bezahlt) },
    { label: "Umsatz erste Raten", tip: def.umsatz, a: eur(alt.umsatzErsteRatenCents), n: eur(neu.umsatzErsteRatenCents) },
    { label: "Auskunft dazubestellt", tip: def.auskunft, a: zahl(alt.auskunft), n: zahl(neu.auskunft) },
    { label: "Termin gebucht", tip: def.termin, a: zahl(alt.termin), n: zahl(neu.termin) },
    { label: "FIAON-PIN festgelegt", tip: def.pin, a: "—", n: zahl(neu.pinGesetzt) },
    { label: "Pakete (abgeschickt)", a: paketZeile(alt.pakete), n: paketZeile(neu.pakete) },
    { label: "Median bis Abschicken", tip: def.median, a: minuten(alt.medianMinutenBisAbschicken), n: minuten(neu.medianMinutenBisAbschicken), pfeil: <Pfeil alt={alt.medianMinutenBisAbschicken} neu={neu.medianMinutenBisAbschicken} einheit="Min." hoeherBesser={false} /> },
  ] : [];
  const quoten: { label: string; k: string }[] = [
    { label: "Angelegt je Sitzung", k: "angelegtJeSitzung" },
    { label: "Abgeschickt je angelegt", k: "abgeschicktJeAngelegt" },
    { label: "Bezahlt je abgeschickt", k: "bezahltJeAbgeschickt" },
    { label: "Bezahlt je Sitzung", k: "bezahltJeSitzung" },
  ];

  return (
    <div className="mb-5" data-fiaon="antragsvergleich">
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4">
        <div className="flex items-start justify-between gap-3 mb-1">
          <p className="text-[13px] font-semibold text-slate-800">Antragsweg: alt gegen neu</p>
          <button onClick={() => void laden()} disabled={laedt} className="text-[12px] text-slate-500 hover:text-slate-800 disabled:text-slate-300 shrink-0">{laedt ? "Lädt…" : "Neu laden"}</button>
        </div>
        <p className="text-[11px] text-slate-400 mb-3">Alt = /antrag, neu = /antrag-neu. Anträge: im Zeitraum angelegt, bezahlt bis heute. Vergleichbar sind die Quoten — die Stückzahlen hängen am Anteil der Weiche.</p>

        {fehler && <p className="text-[12.5px] text-rose-600 mb-2" data-fiaon="antragsvergleich-fehler">{fehler}</p>}
        {laedt && !daten && !fehler && <p className="text-[12.5px] text-slate-400">Lädt…</p>}
        {leer && (
          <p className="text-[12.5px] text-slate-500 py-2" data-fiaon="antragsvergleich-leer">
            Noch keine Daten im gewählten Zeitraum. Die Messung beider Wege läuft seit dem 05.10.2026 — der neue Antrag erscheint hier, sobald die Weiche unten Besucher dorthin schickt.
          </p>
        )}

        {daten && !leer && (
          <>
            {wenig && <p className="text-[11.5px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3">Unter 50 Sitzungen auf mindestens einem Weg — die Quoten schwanken noch stark.</p>}
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-[12.5px] min-w-[300px]">
                <thead className="text-slate-400 text-[11px] uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-1 py-1.5 font-semibold">Kennzahl</th>
                    <th className="text-right px-1 py-1.5 font-semibold">Alt</th>
                    <th className="text-right px-1 py-1.5 font-semibold">Neu</th>
                  </tr>
                </thead>
                <tbody>
                  {zeilen.map((z) => (
                    <tr key={z.label} className="border-t border-slate-100">
                      <td className="px-1 py-1.5 text-slate-600"><span className="inline-flex items-center">{z.label}{z.tip && <Tip text={z.tip} />}</span></td>
                      <td className="px-1 py-1.5 text-right text-slate-800 tabular-nums">{z.a}</td>
                      <td className="px-1 py-1.5 text-right text-slate-800 tabular-nums">{z.n}{z.pfeil}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-slate-200"><td colSpan={3} className="px-1 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Quoten</td></tr>
                  {quoten.map((q) => (
                    <tr key={q.k} className="border-t border-slate-100">
                      <td className="px-1 py-1.5 text-slate-600">{q.label}</td>
                      <td className="px-1 py-1.5 text-right text-slate-800 font-semibold tabular-nums">{pct(alt.quoten?.[q.k])}</td>
                      <td className="px-1 py-1.5 text-right text-slate-800 font-semibold tabular-nums">{pct(neu.quoten?.[q.k])}<Pfeil alt={alt.quoten?.[q.k]} neu={neu.quoten?.[q.k]} einheit="Pp." /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {alt.sitzungenHilfsweise && (
              <p className="text-[11px] text-slate-500 mt-3 pt-2 border-t border-slate-100">
                * Alt: davon {zahl(alt.sitzungenHilfsweise.anzahl)} Sitzungen hilfsweise aus dem Klick-Protokoll ({berlinZeit(alt.sitzungenHilfsweise.von)} bis {berlinZeit(alt.sitzungenHilfsweise.bis)}, vor Beginn der Messung). Dort steht nur, wer ein Paket gewählt oder einen Schritt gewechselt hat — die Quoten je Sitzung sind für den alten Weg deshalb zu hoch.
              </p>
            )}
          </>
        )}
      </div>

      {daten && !leer && (
        <>
          <div className="grid lg:grid-cols-2 gap-4 mb-4">
            <WegTrichter titel="Alt · /antrag" weg={alt} farbe="#64748b" />
            <WegTrichter titel="Neu · /antrag-neu" weg={neu} farbe={ACCENT} />
          </div>
          <div className="grid lg:grid-cols-2 gap-4 mb-4">
            <FeldFehler titel="Häufigste Feldfehler · alt" fehler={alt.fehler} />
            <FeldFehler titel="Häufigste Feldfehler · neu" fehler={neu.fehler} />
          </div>
        </>
      )}

      {/* Die Weiche — wer sieht den neuen Antrag? */}
      <div className="bg-white border border-slate-200 rounded-xl p-4" data-fiaon="antrag-weiche">
        <p className="text-[13px] font-semibold text-slate-800 mb-1">Weiche: wer sieht den neuen Antrag?</p>
        {!weiche ? (
          <p className="text-[12px] text-slate-400">{laedt ? "Lädt…" : "Der Stand der Weiche ist nicht geladen."}</p>
        ) : (
          <>
            <p className="text-[12.5px] text-slate-600">
              Aktuell sehen <b className="text-slate-900 tabular-nums">{aktuell} %</b> der neuen Besucher den neuen Antrag.
              {weiche.quelle !== "render" && weiche.geaendertAm && <span className="text-slate-400"> Geändert am {berlinZeit(weiche.geaendertAm)}{weiche.geaendertVon ? ` von ${weiche.geaendertVon}` : ""}.</span>}
            </p>
            {/* E-283: Woher der Anteil kommt — ohne gespeicherte Stufe gilt die Render-Variable. */}
            {weiche.quelle === "render" && (
              <p className="text-[12px] text-amber-700 mt-0.5" data-fiaon="antrag-weiche-quelle">
                Steht auf {aktuell} % über die Render-Variable ANTRAG_NEU_ANTEIL — Speichern hier überschreibt sie. Zum dauerhaften Zurückstellen genügt die hier gespeicherte Stufe; die Variable muss nicht entfernt werden.
              </p>
            )}
            {weiche.quelle === "vorgabe" && (
              <p className="text-[12px] text-slate-500 mt-0.5" data-fiaon="antrag-weiche-quelle">
                Noch keine Stufe gespeichert und keine Render-Variable ANTRAG_NEU_ANTEIL gesetzt — es gilt 0 %.
              </p>
            )}
            <p className="text-[11px] text-slate-400 mt-0.5 mb-3">
              Zuteilungen im Zeitraum: alt {zahl(weiche.zuteilungen?.alt)} · neu {zahl(weiche.zuteilungen?.neu)}. Bei 1–99 % bleibt jeder Zugeteilte auf seinem Weg; bei 100 % kommen auch früher alt Zugeteilte in den neuen Antrag. Immer alt bleiben offene alte Anträge, gültige Weiter-Links aus Erinnerungsmails und Links mit einem Paket, das der neue Antrag nicht kennt (z. B. die Bonitätsauskunft). Persönliche Links (/a/…), /start und die Paketknöpfe der Website folgen der Weiche.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {WEICHE_STUFEN_UI.map((s) => (
                <button key={s} data-fiaon={`antrag-weiche-stufe-${s}`} onClick={() => { setWahl(s); setFragen(false); setMeldung(null); }}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border tabular-nums ${gewaehlt === s ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"}`}>{s} %</button>
              ))}
              <button data-fiaon="antrag-weiche-speichern" onClick={() => setFragen(true)} disabled={!geaendert || speichert}
                className="px-3 py-1.5 rounded-lg text-[12px] font-semibold border disabled:border-slate-200 disabled:text-slate-300 disabled:bg-slate-50"
                style={geaendert && !speichert ? { color: ACCENT, borderColor: ACCENT, background: "#fff" } : undefined}>Speichern</button>
              {!geaendert && !fragen && <span className="text-[11px] text-slate-400">Andere Stufe wählen, um zu speichern.</span>}
            </div>
            {fragen && geaendert && gewaehlt != null && (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3" data-fiaon="antrag-weiche-frage">
                <p className="text-[12.5px] text-slate-800 font-semibold">Ab jetzt sehen {gewaehlt} % der neuen Besucher den neuen Antrag.</p>
                <p className="text-[11.5px] text-slate-500 mt-0.5">
                  {gewaehlt === 0
                    ? "Bei 0 % ist die Weiche aus: Alle Besucher sehen den alten Antrag, auch wer schon dem neuen zugeteilt war. Die gespeicherte Stufe hält dauerhaft — auch wenn bei Render noch ANTRAG_NEU_ANTEIL steht."
                    : gewaehlt >= 100
                      ? "Alle neuen Besucher kommen in den neuen Antrag, auch wer früher dem alten zugeteilt war. Nur offene alte Anträge und gültige Weiter-Links aus Erinnerungsmails bleiben alt. Die Änderung gilt sofort, auf allen Servern spätestens nach 30 Sekunden."
                      : "Wer schon zugeteilt ist, bleibt auf seinem Weg. Die Änderung gilt sofort, auf allen Servern spätestens nach 30 Sekunden."}
                </p>
                <div className="flex gap-2 mt-2">
                  <button data-fiaon="antrag-weiche-bestaetigen" onClick={() => void speichern()} disabled={speichert}
                    className="px-3 py-1.5 rounded-lg text-white text-[12px] font-semibold disabled:opacity-60" style={{ background: ACCENT }}>{speichert ? "Speichert…" : "Ja, speichern"}</button>
                  <button onClick={() => setFragen(false)} disabled={speichert} className="px-3 py-1.5 rounded-lg text-[12px] font-semibold border border-slate-200 text-slate-600 bg-white">Abbrechen</button>
                </div>
              </div>
            )}
            {meldung && (
              <p className={`mt-3 text-[12.5px] ${meldung.art === "ok" ? "text-emerald-700" : "text-rose-600"}`} data-fiaon="antrag-weiche-meldung">{meldung.text}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function AdminFinanzenPage() {
  const [rangeKey, setRangeKey] = useState<RangeKey>("30t");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const range = useMemo(() => computeRange(rangeKey, custom), [rangeKey, custom]);
  const qs = `from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`;

  const [ov, setOv] = useState<any>(null);
  const [attr, setAttr] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [showBudget, setShowBudget] = useState(false);
  const [bForm, setBForm] = useState({ campaign: "", amountEur: "", periodStart: "", periodEnd: "", note: "" });
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      apiF(`/admin/finance/overview?${qs}`).then((r) => r.ok && setOv(r.json)),
      apiF(`/admin/finance/attribution?${qs}`).then((r) => r.ok && setAttr(r.json.data || [])),
      apiF(`/admin/finance/team?${qs}`).then((r) => r.ok && setTeam(r.json.data || [])),
      apiF(`/admin/finance/budget`).then((r) => r.ok && setBudgets(r.json.data || [])),
    ]).finally(() => setLoading(false));
  }, [qs]);
  useEffect(load, [load]);

  const addBudget = async () => {
    const r = await apiF("/admin/finance/budget", { method: "POST", body: JSON.stringify(bForm) });
    if (r.ok) { setShowBudget(false); setBForm({ campaign: "", amountEur: "", periodStart: "", periodEnd: "", note: "" }); load(); }
  };
  const delBudget = async (id: number) => { const r = await apiF(`/admin/finance/budget/${id}`, { method: "DELETE" }); if (r.ok) load(); };

  const RANGES: { key: RangeKey; label: string }[] = [
    { key: "heute", label: "Heute" }, { key: "gestern", label: "Gestern" }, { key: "7t", label: "7 Tage" },
    { key: "30t", label: "30 Tage" }, { key: "monat", label: "Dieser Monat" }, { key: "custom", label: "Custom" },
  ];

  return (
    <div className="px-4 sm:px-6 py-5 max-w-6xl mx-auto">
      <PageIntro
        id="finanzen"
        title="Finanzen & Sales"
        subtitle="Hier analysierst du Funnel, Umsatz, Marge und Kampagnen-Rentabilität — jede Kennzahl mit Klartext-Definition."
        steps={[
          "Wähle oben den Zeitraum. Zeit-Anker aller Umsatzzahlen ist der Bezahl-Zeitpunkt — „bezahlt“ heißt überall dasselbe (Status bezahlt + Zahlungsreferenz, ohne Dubletten und Alt-Import).",
          "Der Lead-Funnel zeigt nur Leads; „Angeschrieben (Mail)“ ist ehrlich benannt — eine Massenmail ist kein persönlicher Kontakt. „Echt kontaktiert“ zählt nur dokumentierte Agenten-Ergebnisse.",
          "CAC und Lead-Kosten brauchen ein eingetragenes Werbebudget (Abschnitt unten). LTV/CAC ist als ANNAHME gekennzeichnet — die 12 Monate Laufzeit sind nicht gemessen.",
          "Fahre mit der Maus über das ⓘ an jeder Kennzahl — dort steht die genaue Definition.",
          "Der Alt-Import (bezahlt importierte Alt-Kunden ohne Beleg) wird separat ausgewiesen und fließt bewusst in keine Kennzahl ein.",
          "„Antragsweg: alt gegen neu“ vergleicht /antrag mit /antrag-neu im gewählten Zeitraum: Sitzungen, angelegte, abgeschickte und bezahlte Anträge (erste Rate gebucht), die Quoten dazwischen, den Trichter je Schritt mit Abbrüchen und die häufigsten Feldfehler. Ein Pfeil zeigt, ob der neue Weg besser (grün) oder schlechter (rot) ist.",
          "Die Weiche darunter legt fest, wie viel Prozent der NEUEN Besucher den neuen Antrag sehen (0, 10, 25, 50 oder 100 %). Bei 1–99 % bleibt jeder Zugeteilte auf seinem Weg, bei 100 % kommen alle in den neuen Antrag. Offene alte Anträge und gültige Weiter-Links aus Erinnerungsmails bleiben immer alt. 0 % schaltet die Weiche ganz aus. Ist hier nichts gespeichert, gilt die Render-Variable ANTRAG_NEU_ANTEIL — der Satz unter dem Anteil sagt es dann.",
        ]}
      />

      <div className="flex flex-wrap items-center gap-2 mb-5">
        {RANGES.map((r) => (
          <button key={r.key} onClick={() => setRangeKey(r.key)}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border ${rangeKey === r.key ? "bg-slate-900 text-white border-slate-900" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>{r.label}</button>
        ))}
        {rangeKey === "custom" && (
          <span className="flex items-center gap-1">
            <input type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} className="px-2 py-1.5 rounded-lg border border-slate-200 text-[12px]" />
            <input type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} className="px-2 py-1.5 rounded-lg border border-slate-200 text-[12px]" />
          </span>
        )}
      </div>

      {loading && !ov ? <p className="text-[13px] text-slate-400">Lädt…</p> : ov && (
        <>
          <Funnels f={ov.funnel} r={ov.funnelRates} />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <Kpi label="Umsatz (brutto)" value={eur(ov.revenue.umsatzCents)} sub={`${ov.revenue.bezahltCount} bezahlt`} tip={ov.kpiDefs?.umsatz} />
            <Kpi label="Provisionen (Team)" value={eur(ov.revenue.provisionenCents)} tip="Alle nicht-stornierten Provisionseinträge im Zeitraum (own + override)." />
            <Kpi label="Netto FIAON" value={eur(ov.revenue.nettoCents)} sub={`Marge ${pct(ov.revenue.margePct)}`} tip="Umsatz minus Team-Provisionen. Keine sonstigen Kosten enthalten." />
            <Kpi label="Ø Abschlusswert (AOV)" value={eur(ov.revenue.aovCents)} tip="Umsatz ÷ bezahlte Kunden im Zeitraum (nur echte, referenzierte Zahlungen)." />
            <Kpi label="CAC" value={ov.cac.hasBudget ? eur(ov.cac.cacCents) : "Budget eintragen"} sub={ov.cac.hasBudget ? `Werbebudget ${eur(ov.cac.spendCents)}` : undefined} tip={ov.kpiDefs?.cac} />
            <Kpi label="Lead-Kosten" value={ov.cac.hasBudget ? eur(ov.cac.leadCostCents) : "Budget eintragen"} tip="Werbebudget ÷ Leads im Zeitraum." />
            {/* P2-D ehrlich: LTV/CAC ist eine ANNAHME (12 Monate Laufzeit sind nicht gemessen) */}
            <Kpi label="LTV/CAC (Annahme)" value={ov.cac.ltvCacRatio != null ? `~${ov.cac.ltvCacRatio}×` : "—"} sub={`Annahme: Kunde bleibt ${ov.cac.assumedLifetimeMonths} Mon. — nicht gemessen`} tip={ov.kpiDefs?.ltv} />
            <Kpi label="Bestand (bezahlt)" value={String(ov.revenue.bestandCount)} sub="all-time · eine Wahrheit" tip={ov.kpiDefs?.bezahlt} />
          </div>

          {/* P2-D: Alt-Import GETRENNT ausgewiesen — ehrlich statt versteckt */}
          {ov.revenue.altbestandCount > 0 && (
            <div className="mb-5 px-4 py-3 rounded-xl border border-slate-200 bg-white text-[12.5px] text-slate-600">
              <b className="text-slate-800 inline-flex items-center">Alt-Import (nicht im Umsatz):{ov.kpiDefs?.altbestand && <Tip text={ov.kpiDefs.altbestand} />}</b> {ov.revenue.altbestandCount} als bezahlt importierte Alt-Kunden ohne Zahlungsreferenz,
              davon {ov.revenue.altbestandOhneBetrag} ohne Betrag. Diese Datensätze fließen bewusst in KEINE Umsatz- oder Funnel-Kennzahl ein.
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-4 mb-5">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-[13px] font-semibold text-slate-800 mb-2">Umsatz / Tag</p>
              <LineChart points={(ov.series.revenue || []).map((p: any) => ({ date: p.date, v: p.cents }))} />
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-[13px] font-semibold text-slate-800 mb-2">Leads / Tag</p>
              <LineChart points={(ov.series.leads || []).map((p: any) => ({ date: p.date, v: p.count }))} color="#64748b" />
            </div>
          </div>

          {/* Umsatz je Paket-Tier */}
          {ov.revenue.perTier?.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 mb-5">
              <p className="text-[13px] font-semibold text-slate-800 mb-2">Umsatz je Paket</p>
              <table className="w-full text-[13px]">
                <tbody>
                  {ov.revenue.perTier.map((t: any, i: number) => (
                    <tr key={i} className="border-t border-slate-100 first:border-0">
                      <td className="py-1.5 text-slate-600">{t.pack}</td>
                      <td className="py-1.5 text-slate-400 text-right">{t.count}×</td>
                      <td className="py-1.5 text-slate-800 font-semibold text-right tabular-nums">{eur(t.cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* E-282: Antragsweg alt gegen neu + Weiche (eigener Lader, eigener Fehlerweg) */}
      <AntragVergleich qs={qs} />

      {/* Attribution */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-5">
        <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100">
          <p className="text-[13px] font-semibold text-slate-800">Quellen- & Kampagnen-Attribution</p>
          <a href={`/api/fiaon/admin/finance/export/attribution.csv?${qs}`} className="text-[12px] text-slate-500 inline-flex items-center gap-1.5 hover:text-slate-800"><Download size={13} /> CSV</a>
        </div>
        <table className="w-full text-[13px]">
          <thead className="bg-slate-50 text-slate-400 text-[11px] uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-2 font-semibold">Kampagne/Quelle</th>
              <th className="text-right px-4 py-2 font-semibold">Leads</th>
              <th className="text-right px-4 py-2 font-semibold">Konv.</th>
              <th className="text-right px-4 py-2 font-semibold">CR</th>
              <th className="text-right px-4 py-2 font-semibold">Umsatz</th>
              <th className="text-right px-4 py-2 font-semibold">CAC</th>
            </tr>
          </thead>
          <tbody>
            {attr.length === 0 && <tr><td colSpan={6} className="px-4 py-5 text-center text-slate-400">Keine Daten.</td></tr>}
            {attr.map((a, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="px-4 py-2 text-slate-700">{a.bucket}</td>
                <td className="px-4 py-2 text-right text-slate-500">{a.leads}</td>
                <td className="px-4 py-2 text-right text-slate-500">{a.konversionen}</td>
                <td className="px-4 py-2 text-right text-slate-500">{pct(a.conversionRate)}</td>
                <td className="px-4 py-2 text-right text-slate-800 font-semibold tabular-nums">{eur(a.umsatzCents)}</td>
                <td className="px-4 py-2 text-right text-slate-500">{a.cacCents != null ? eur(a.cacCents) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Team-Performance */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-5">
        <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100">
          <p className="text-[13px] font-semibold text-slate-800">Team-Performance</p>
          <a href={`/api/fiaon/admin/finance/export/team.csv?${qs}`} className="text-[12px] text-slate-500 inline-flex items-center gap-1.5 hover:text-slate-800"><Download size={13} /> CSV</a>
        </div>
        <table className="w-full text-[13px]">
          <thead className="bg-slate-50 text-slate-400 text-[11px] uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-2 font-semibold">Mitarbeiter</th>
              <th className="text-right px-4 py-2 font-semibold">Leads</th>
              <th className="text-right px-4 py-2 font-semibold">Kunden</th>
              <th className="text-right px-4 py-2 font-semibold">Abschl.</th>
              <th className="text-right px-4 py-2 font-semibold">Umsatz</th>
              <th className="text-right px-4 py-2 font-semibold">Provision</th>
            </tr>
          </thead>
          <tbody>
            {team.length === 0 && <tr><td colSpan={6} className="px-4 py-5 text-center text-slate-400">Keine Daten.</td></tr>}
            {team.map((t) => (
              <tr key={t.id} className="border-t border-slate-100">
                <td className="px-4 py-2 text-slate-700 font-semibold">{t.name}</td>
                <td className="px-4 py-2 text-right text-slate-500">{t.leads}</td>
                <td className="px-4 py-2 text-right text-slate-500">{t.kunden}</td>
                <td className="px-4 py-2 text-right text-slate-500">{t.abschluesse}</td>
                <td className="px-4 py-2 text-right text-slate-800 font-semibold tabular-nums">{eur(t.umsatzCents)}</td>
                <td className="px-4 py-2 text-right text-slate-500 tabular-nums">{eur(t.provisionCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Werbebudget (CAC) */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[13px] font-semibold text-slate-800">Werbebudget (für CAC)</p>
          <div className="flex items-center gap-2">
            <a href={`/api/fiaon/admin/finance/export/umsatz.csv?${qs}`} className="text-[12px] text-slate-500 inline-flex items-center gap-1.5 hover:text-slate-800"><Download size={13} /> Umsatz-CSV</a>
            <button onClick={() => setShowBudget((v) => !v)} className="text-[12px] font-semibold inline-flex items-center gap-1.5" style={{ color: ACCENT }}><Plus size={13} /> Budget eintragen</button>
          </div>
        </div>
        {showBudget && (
          <div className="grid sm:grid-cols-5 gap-2 mb-3">
            <input placeholder="Kampagne (leer = gesamt)" value={bForm.campaign} onChange={(e) => setBForm({ ...bForm, campaign: e.target.value })} className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-[13px]" />
            <input placeholder="Betrag €" value={bForm.amountEur} onChange={(e) => setBForm({ ...bForm, amountEur: e.target.value })} className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-[13px]" />
            <input type="date" value={bForm.periodStart} onChange={(e) => setBForm({ ...bForm, periodStart: e.target.value })} className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-[13px]" />
            <input type="date" value={bForm.periodEnd} onChange={(e) => setBForm({ ...bForm, periodEnd: e.target.value })} className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-[13px]" />
            <button onClick={addBudget} className="px-3 py-1.5 rounded-lg text-white text-[12px] font-semibold" style={{ background: ACCENT }}>Hinzufügen</button>
          </div>
        )}
        <div className="space-y-1">
          {budgets.length === 0 && <p className="text-[12px] text-slate-400">Noch kein Budget hinterlegt — CAC-Kennzahlen bleiben leer.</p>}
          {budgets.map((b) => (
            <div key={b.id} className="flex items-center gap-3 text-[12px] text-slate-600 border-t border-slate-100 py-1.5 first:border-0">
              <span className="font-semibold">{b.campaign || "Gesamt"}</span>
              <span>{eur(b.amount_cents)}</span>
              <span className="text-slate-400">{b.period_start} → {b.period_end}</span>
              <button onClick={() => delBudget(b.id)} className="ml-auto text-slate-400 hover:text-slate-700"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
