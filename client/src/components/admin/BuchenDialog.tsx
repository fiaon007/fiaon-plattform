import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Check } from "lucide-react";
import { ACCENT } from "./AdminShell";

// ═══════════════════════════════════════════════════════════════════════════
// Buchen-Dialog — „Ich habe das Geld gesehen, und zwar an diesem Tag"
//
// Warum kein confirm(): Ein Browser-Bestätigungsfenster kann kein Datumsfeld
// anzeigen. Seit die Zahlungen manuell gebucht werden, können zwischen dem
// Eingang auf dem Konto und dem Klick Tage liegen — und die Fälligkeit der
// nächsten Monatsrate rechnet ab dem EINGANG, nicht ab dem Klick. Ohne dieses
// Feld würde jede verspätete Buchung den Zyklus des Kunden nach hinten
// verschieben.
//
// Der Dialog zeigt immer, WAS gebucht wird: Name, Rate, Referenz, Betrag.
// Beim Buchen einer Abo-Rate muss unmissverständlich sein, welche Rate gemeint
// ist — sonst bucht man Rate 3 auf eine Zahlung für Rate 2.
// ═══════════════════════════════════════════════════════════════════════════

export interface BuchenZiel {
  /** Überschrift, z. B. „Erstzahlung buchen" oder „Abo-Rate 2 buchen" */
  titel: string;
  name: string;
  /** Verwendungszweck, mit dem der Kunde überwiesen hat */
  referenz: string;
  betragText: string;
  /** Zusatzzeilen, z. B. Paket oder bisherige Fälligkeit */
  zeilen?: { label: string; wert: string }[];
  /** Was nach dem Buchen passiert — in Klartext, vor dem Klick. */
  folgen: string[];
}

function heuteIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

const CSS = `
.bd-hinter{
  position:fixed; inset:0; z-index:100; background:rgba(7,11,22,.6);
  -webkit-backdrop-filter:blur(7px); backdrop-filter:blur(7px);
  animation:bdAuf 220ms cubic-bezier(.32,.72,0,1) both;
}
.bd-fenster{
  position:relative; width:100%; max-width:440px; max-height:92vh; overflow-y:auto;
  border-radius:22px; padding:18px;
  background:linear-gradient(180deg, rgba(255,255,255,.98), rgba(250,252,255,.98));
  border:1px solid rgba(255,255,255,.7);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.9), 0 40px 90px -20px rgba(13,26,63,.6);
  animation:bdHoch 340ms cubic-bezier(.32,.72,0,1) both;
}
@keyframes bdAuf{from{opacity:0}to{opacity:1}}
@keyframes bdHoch{from{opacity:0; transform:translateY(16px) scale(.98)}to{opacity:1; transform:none}}
@media (max-width:640px){
  .bd-huelle{ align-items:flex-end !important; padding:0 !important; }
  .bd-fenster{ max-width:none; border-radius:22px 22px 0 0; }
}
@media (prefers-reduced-motion: reduce){ .bd-hinter,.bd-fenster{ animation:none !important } }
`;

export default function BuchenDialog({ ziel, busy, onAbbrechen, onBuchen }: {
  ziel: BuchenZiel;
  busy?: boolean;
  onAbbrechen: () => void;
  /** Bekommt das tatsächliche Zahlungsdatum als „YYYY-MM-DD". */
  onBuchen: (zahlungsdatum: string) => void;
}) {
  const heute = heuteIso();
  const [datum, setDatum] = useState(heute);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const taste = (e: KeyboardEvent) => { if (e.key === "Escape") onAbbrechen(); };
    document.addEventListener("keydown", taste);
    const vorher = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setTimeout(() => ref.current?.focus(), 120);
    return () => {
      document.removeEventListener("keydown", taste);
      document.body.style.overflow = vorher;
    };
  }, [onAbbrechen]);

  // Nächste Fälligkeit direkt anzeigen — so sieht man VOR dem Klick, was das
  // gewählte Datum bewirkt.
  const naechste = (() => {
    const d = new Date(`${datum}T12:00:00Z`);
    if (isNaN(d.getTime())) return null;
    d.setUTCDate(d.getUTCDate() + 30);
    return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  })();

  const zuAlt = datum < heute;

  return createPortal(
    <>
      <style>{CSS}</style>
      <div className="bd-hinter" onClick={onAbbrechen} />
      <div className="bd-huelle fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
        <div className="bd-fenster pointer-events-auto" role="dialog" aria-modal="true" aria-label={ziel.titel}>
          <div className="flex items-start gap-3 mb-3">
            <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "var(--fi-flaeche-erfolg,#ecfdf5)", color: "#059669" }}>
              <Check size={17} strokeWidth={2.4} />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-[15px] font-bold text-slate-900">{ziel.titel}</h3>
              <p className="text-[12px] text-slate-500 truncate">{ziel.name}</p>
            </div>
            <button type="button" onClick={onAbbrechen}
              className="shrink-0 w-8 h-8 rounded-lg border bg-white flex items-center justify-center text-slate-400 hover:text-slate-700"
              style={{ borderColor: "var(--a3-linie,#e4e9f2)" }} aria-label="Abbrechen">
              <X size={15} />
            </button>
          </div>

          {/* Was gebucht wird */}
          <dl className="rounded-xl border overflow-hidden mb-3" style={{ borderColor: "var(--a3-linie,#e4e9f2)" }}>
            <div className="flex items-center justify-between px-3 py-2" style={{ background: "#fbfcfe" }}>
              <dt className="text-[11.5px] text-slate-500">Verwendungszweck</dt>
              <dd className="text-[12.5px] font-bold text-slate-900">{ziel.referenz}</dd>
            </div>
            <div className="flex items-center justify-between px-3 py-2"
              style={{ boxShadow: "inset 0 1px 0 rgba(226,232,240,.8)" }}>
              <dt className="text-[11.5px] text-slate-500">Betrag</dt>
              <dd className="text-[13px] font-bold text-slate-900 a3-zahl">{ziel.betragText}</dd>
            </div>
            {(ziel.zeilen || []).map((z) => (
              <div key={z.label} className="flex items-center justify-between px-3 py-2"
                style={{ boxShadow: "inset 0 1px 0 rgba(226,232,240,.8)" }}>
                <dt className="text-[11.5px] text-slate-500">{z.label}</dt>
                <dd className="text-[12px] text-slate-700 truncate max-w-[60%]">{z.wert}</dd>
              </div>
            ))}
          </dl>

          {/* Zahlungsdatum */}
          <label className="block mb-1 text-[12px] font-semibold text-slate-700">
            Tatsächlicher Zahlungseingang
          </label>
          <input
            ref={ref}
            type="date"
            value={datum}
            max={heute}
            onChange={(e) => setDatum(e.target.value)}
            className="w-full h-[42px] px-3 rounded-xl border bg-white text-[14px] outline-none"
            style={{ borderColor: "var(--a3-linie,#e4e9f2)" }}
          />
          <p className="mt-1.5 text-[11.5px] text-slate-500 leading-snug">
            {zuAlt
              ? `Rückdatiert — die nächste Monatsrate wird auf den ${naechste} gelegt (30 Tage ab Eingang, nicht ab heute).`
              : `Nächste Monatsrate wird auf den ${naechste} gelegt.`}
          </p>

          {/* Folgen */}
          <ul className="mt-3 space-y-1">
            {ziel.folgen.map((f) => (
              <li key={f} className="flex gap-2 text-[12px] text-slate-600 leading-snug">
                <span className="shrink-0 mt-[6px] w-1 h-1 rounded-full bg-slate-300" />
                <span>{f}</span>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2 mt-4">
            <button type="button" onClick={() => onBuchen(datum)} disabled={busy}
              className="flex-1 h-[42px] rounded-xl text-[13px] font-bold text-white disabled:opacity-50"
              style={{ background: `linear-gradient(180deg,${ACCENT},#1e40af)`, boxShadow: "0 4px 14px -6px rgba(29,78,216,.7)" }}>
              {busy ? "Buche …" : "Als bezahlt buchen"}
            </button>
            <button type="button" onClick={onAbbrechen} disabled={busy}
              className="h-[42px] px-4 rounded-xl border bg-white text-[13px] font-semibold text-slate-600"
              style={{ borderColor: "var(--a3-linie,#e4e9f2)" }}>
              Abbrechen
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
