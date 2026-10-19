// ═══════════════════════════════════════════════════════════════════════════
// /vertrag-bestaetigen/:token — DERSELBE VERTRAG FÜR JEDEN ABSCHLUSSWEG (19.10.2026, E-398)
//
// Wer nicht über /antrag-neu bestellt hat (Anlage durch den Betreuer, alter
// Antrag), bekommt per Mail einen persönlichen Link hierher: derselbe
// Vertragstext wie in /antrag-neu, dieselbe Übersicht über dem Knopf, derselbe
// AGB-Haken und Sofort-Haken, danach die Vertragsbestätigung mit PDF.
//   · abschluss    — unterschreiben + „Zahlungspflichtig annehmen“ (wortgleich /antrag-neu)
//   · bestaetigung — bestehender Vertrag + „Zahlungspflichtig bestellen“ (EuGH C-400/22, Entwurf LEXR)
// Server: server/lib/fiaon-vertrag-bestaetigen.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import GlassNav from "@/components/GlassNav";
import PremiumFooter from "@/components/PremiumFooter";

interface Stand {
  ok: boolean; grund?: "unbekannt" | "fertig" | "beendet" | "kein_paket"; error?: string;
  modus?: "abschluss" | "bestaetigung"; name?: string;
  paket?: { key: string; name: string; rateCents: number; gesamtCents: number; limits: number[] };
  limitVorschlag?: number; bestelltAm?: string | null; angenommenAm?: string | null;
  fassungen?: { agb: string; vertrag: string; leistung: string }; knopf?: string; haken?: { agb: string; sofort: string };
}

const eur = (c: number) => `${(c / 100).toLocaleString("de-DE", { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 })} €`;
const tag = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" }) : "");

/** Ein schlichtes Unterschriftsfeld — gezeichnet oder (Knopf) mit dem eigenen Namen geschrieben. */
function Unterschrift({ name, onPng }: { name: string; onPng: (png: { daten: string; getippt: boolean } | null) => void }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const zieht = useRef(false);
  const punkte = useRef(0);
  const vorbereiten = () => {
    const c = cv.current; if (!c) return null;
    const r = c.getBoundingClientRect();
    if (c.width !== Math.round(r.width * 2)) { c.width = Math.round(r.width * 2); c.height = Math.round(r.height * 2); }
    const g = c.getContext("2d")!; g.lineWidth = 3.2; g.lineCap = "round"; g.lineJoin = "round"; g.strokeStyle = "#0f172a";
    return { c, g, r };
  };
  const pos = (e: React.PointerEvent) => { const r = cv.current!.getBoundingClientRect(); return { x: (e.clientX - r.left) * 2, y: (e.clientY - r.top) * 2 }; };
  const leeren = () => { const v = vorbereiten(); if (v) v.g.clearRect(0, 0, v.c.width, v.c.height); punkte.current = 0; onPng(null); };
  const tippen = () => {
    const v = vorbereiten(); if (!v || !name.trim()) return;
    v.g.clearRect(0, 0, v.c.width, v.c.height);
    v.g.fillStyle = "#0f172a"; v.g.font = `italic ${Math.round(v.c.height * 0.36)}px 'Brush Script MT', 'Segoe Script', cursive`;
    v.g.textBaseline = "middle"; v.g.fillText(name.trim(), v.c.width * 0.06, v.c.height * 0.55, v.c.width * 0.88);
    punkte.current = 99; onPng({ daten: v.c.toDataURL("image/png"), getippt: true });
  };
  return (
    <div>
      <div className="rounded-xl border border-slate-300 bg-white" style={{ height: 150, touchAction: "none" }}>
        <canvas ref={cv} style={{ width: "100%", height: "100%", display: "block" }} aria-label="Unterschriftsfeld" role="img"
          onPointerDown={(e) => { const v = vorbereiten(); if (!v) return; zieht.current = true; (e.target as Element).setPointerCapture?.(e.pointerId); const p = pos(e); v.g.beginPath(); v.g.moveTo(p.x, p.y); }}
          onPointerMove={(e) => { if (!zieht.current) return; const g = cv.current!.getContext("2d")!; const p = pos(e); g.lineTo(p.x, p.y); g.stroke(); punkte.current++; }}
          onPointerUp={() => { zieht.current = false; if (punkte.current > 8) onPng({ daten: cv.current!.toDataURL("image/png"), getippt: false }); }}
          onPointerCancel={() => { zieht.current = false; }} />
      </div>
      <div className="mt-2 flex flex-wrap gap-4 text-[13px]">
        <button type="button" className="text-blue-700 underline underline-offset-2" onClick={tippen}>Mit meinem Namen unterschreiben</button>
        <button type="button" className="text-slate-600 underline underline-offset-2" onClick={leeren}>Neu unterschreiben</button>
      </div>
    </div>
  );
}

export default function VertragBestaetigenPage() {
  const { token = "" } = useParams<{ token: string }>();
  const [stand, setStand] = useState<Stand | null>(null);
  const [limit, setLimit] = useState<number>(0);
  const [agb, setAgb] = useState(false);
  const [sofort, setSofort] = useState(false);
  const [png, setPng] = useState<{ daten: string; getippt: boolean } | null>(null);
  const [vertrag, setVertrag] = useState<string | null>(null);
  const [vertragOffen, setVertragOffen] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [fertig, setFertig] = useState<string | null>(null);

  useEffect(() => { if (fertig) window.scrollTo(0, 0); }, [fertig]);
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Ihr Vertrag — FIAON";
    fetch(`/api/fiaon/vertrag-bestaetigen/${encodeURIComponent(token)}/stand`).then((r) => r.json()).then((s: Stand) => {
      setStand(s);
      if (s.limitVorschlag) setLimit(s.limitVorschlag);
    }).catch(() => setStand({ ok: false, error: "Der Vertrag konnte gerade nicht geladen werden." }));
  }, [token]);

  useEffect(() => {
    if (!vertragOffen || !limit) return;
    let weg = false;
    fetch(`/api/fiaon/vertrag-bestaetigen/${encodeURIComponent(token)}/vertrag?limit=${limit}&sofort=${sofort ? 1 : 0}`)
      .then((r) => r.json()).then((d) => { if (!weg) setVertrag(d?.html ?? null); }).catch(() => {});
    return () => { weg = true; };
  }, [vertragOffen, limit, sofort, token]);

  async function annehmen() {
    if (!stand?.ok || laeuft) return;
    setFehler(null);
    if (!agb) { setFehler("Bitte setzen Sie den Haken bei den AGB."); return; }
    if (stand.modus === "abschluss" && !png) { setFehler("Bitte unterschreiben Sie im Feld."); return; }
    setLaeuft(true);
    try {
      const r = await fetch(`/api/fiaon/vertrag-bestaetigen/${encodeURIComponent(token)}/annehmen`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit, sofort, hakenAgb: agb, knopf: stand.knopf, fassungen: stand.fassungen,
          unterschrift: png ? { png: png.daten, getippt: png.getippt } : null }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d?.ok) { setFehler(d?.error || "Das hat gerade nicht geklappt. Bitte versuchen Sie es gleich noch einmal."); return; }
      setFertig(d.angenommenAm);
    } catch {
      setFehler("Keine Verbindung. Bitte versuchen Sie es gleich noch einmal.");
    } finally { setLaeuft(false); }
  }

  const rahmen = (inhalt: React.ReactNode) => (
    <div className="min-h-screen bg-white text-gray-900 antialiased" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <GlassNav />
      <main className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 py-20 sm:py-24">{inhalt}</main>
      <PremiumFooter />
    </div>
  );

  if (!stand) return rahmen(<p className="text-slate-500">Ihr Vertrag wird geladen …</p>);
  if (fertig || stand.grund === "fertig") {
    return rahmen(
      <section className="fiaon-glass-panel rounded-2xl p-6 sm:p-8" data-vertrag="fertig">
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 mb-3">Vielen Dank — Ihr Vertrag ist gespeichert</h1>
        <p className="text-slate-700 leading-relaxed">
          {fertig ? `Gespeichert am ${tag(fertig)}.` : `Schon erledigt am ${tag(stand.angenommenAm)}.`} Ihren Vertrag mit Leistungsbeschreibung und
          Widerrufsbelehrung bekommen Sie per E-Mail als PDF. Sie finden ihn außerdem in Ihrem Kundenbereich.
        </p>
      </section>,
    );
  }
  if (!stand.ok) {
    return rahmen(
      <section className="fiaon-glass-panel rounded-2xl p-6 sm:p-8" data-vertrag="fehler">
        <h1 className="text-2xl font-semibold text-slate-900 mb-3">{stand.grund === "beendet" ? "Dieser Vertrag ist beendet" : "Dieser Link passt nicht"}</h1>
        <p className="text-slate-700 leading-relaxed">{stand.grund === "beendet" ? "Es gibt nichts mehr zu bestätigen." : (stand.error || "Bitte schreiben Sie uns an support@fiaon.com — wir schicken Ihnen einen neuen Link.")}</p>
      </section>,
    );
  }

  const p = stand.paket!;
  const best = stand.modus === "bestaetigung";
  return rahmen(
    <>
      <div className="mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">{best ? "Ihr Vertrag – bitte bestätigen" : "Ihr Vertrag"}</h1>
        <p className="text-slate-600 leading-relaxed">
          {best
            ? `Guten Tag ${stand.name}, Sie haben am ${tag(stand.bestelltAm)} das Paket ${p.name} bestellt. Hier ist Ihr Vertrag vollständig. An Paket, Rate und Laufzeit ändert sich nichts.`
            : `Guten Tag ${stand.name}, für Sie ist das Paket ${p.name} angelegt. Bitte lesen Sie Ihren Vertrag und nehmen Sie ihn mit Ihrer Unterschrift an.`}
        </p>
      </div>
      <section className="fiaon-glass-panel rounded-2xl p-6 sm:p-8" data-vertrag="formular">
        {/* Die Übersicht direkt über dem Knopf (§ 312j Abs. 2 BGB) */}
        <h2 className="text-[13px] font-semibold text-slate-500 uppercase tracking-wider mb-3">Ihre Bestellung</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[14.5px] mb-4">
          <dt className="text-slate-500">Paket</dt><dd className="font-semibold">{p.name}</dd>
          <dt className="text-slate-500">Monatlicher Betrag</dt><dd className="font-semibold">{eur(p.rateCents)}</dd>
          <dt className="text-slate-500">Laufzeit</dt><dd>12 Monate, zusammen {eur(p.gesamtCents)}; danach monatlich kündbar</dd>
          <dt className="text-slate-500">Zahlung</dt><dd>Überweisung, monatlich im Voraus</dd>
        </dl>
        <label htmlFor="vb-limit" className="block text-[12px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Ihr Ziel-Limit (Ihre Angabe)</label>
        <select id="vb-limit" value={limit} onChange={(e) => setLimit(Number(e.target.value))}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[15px] mb-4">
          {p.limits.map((l) => <option key={l} value={l}>{eur(l * 100)}</option>)}
        </select>
        <p className="text-[13px] text-slate-600 mb-4">
          <button type="button" className="text-blue-700 underline underline-offset-2" onClick={() => setVertragOffen(!vertragOffen)}>{vertragOffen ? "Vertrag ausblenden" : "Vollständigen Vertrag lesen"}</button>
          {" · "}<a href={`/agb/${stand.fassungen!.agb}`} target="_blank" rel="noopener" className="text-blue-700 underline underline-offset-2">AGB</a>
          {" · "}<a href="/widerrufsbelehrung" target="_blank" rel="noopener" className="text-blue-700 underline underline-offset-2">Widerrufsbelehrung</a>
        </p>
        {vertragOffen ? (
          <div className="mb-5 max-h-[420px] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-[13px] leading-relaxed text-slate-800" data-vertrag="text">
            {vertrag ? <div dangerouslySetInnerHTML={{ __html: vertrag }} /> : "Der Vertrag wird geladen …"}
          </div>
        ) : null}
        <label className="flex gap-3 items-start mb-3 text-[14px] text-slate-700 cursor-pointer">
          <input type="checkbox" className="mt-1 h-4 w-4" checked={agb} onChange={(e) => setAgb(e.target.checked)} />
          <span>{stand.haken!.agb}</span>
        </label>
        <label className="flex gap-3 items-start mb-5 text-[13px] text-slate-600 cursor-pointer">
          <input type="checkbox" className="mt-1 h-4 w-4" checked={sofort} onChange={(e) => setSofort(e.target.checked)} />
          <span>{stand.haken!.sofort} <i>(freiwillig)</i></span>
        </label>
        {!best ? (
          <div className="mb-5">
            <div className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Ihre Unterschrift</div>
            <Unterschrift name={stand.name ?? ""} onPng={setPng} />
          </div>
        ) : null}
        {fehler ? <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-[13.5px] font-medium text-red-700">{fehler}</p> : null}
        <button type="button" disabled={laeuft} onClick={() => void annehmen()}
          className="fiaon-btn-gradient w-full rounded-full px-6 py-3.5 text-[15px] font-semibold text-white disabled:opacity-60" style={{ minHeight: 48 }}>
          {laeuft ? "Wird gespeichert …" : stand.knopf}
        </button>
        <p className="mt-3 text-[12.5px] text-slate-500 leading-relaxed">
          {eur(p.rateCents)} im Monat für 12 Monate (zusammen {eur(p.gesamtCents)}). Bereits gezahlte Beträge zählen mit. Als Verbraucher können Sie den Vertrag binnen vierzehn Tagen widerrufen; Einzelheiten stehen in der Widerrufsbelehrung. Vertrag, Bestätigung und Widerrufsbelehrung kommen sofort per E-Mail.
        </p>
      </section>
    </>,
  );
}
