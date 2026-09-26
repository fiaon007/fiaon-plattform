// Die Bestellübersicht unmittelbar über „Zahlungspflichtig annehmen" (§ 312j Abs. 2 BGB, E-244).
// Inhalt und Quellen: ./bestelluebersicht-daten.ts. Die Farben kommen aus Hilfsklassen, die
// antrag-dunkel.css unter .antrag-dk umfärbt — dieselbe Übersicht steht hell auf /zustimmung.
// Handy: Titel über dem Wert (keine Querrolle bei 320 px); ab sm: zwei Spalten.
import type { AuskunftArt } from "@shared/fiaon-auskunft";
import { bestellUebersicht } from "./bestelluebersicht-daten";

export function Bestelluebersicht({ packKey, zusatz = null, className = "" }: {
  packKey: string | null | undefined;
  zusatz?: AuskunftArt | null;
  className?: string;
}) {
  const u = bestellUebersicht(packKey, zusatz);
  if (!u) return null;
  return (
    <section aria-labelledby="bestelluebersicht-titel" data-bestelluebersicht={u.packKey}
      className={`rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3.5 sm:px-5 sm:py-4 ${className}`}>
      <h3 id="bestelluebersicht-titel" className="text-[11px] font-semibold text-[#2563eb] uppercase tracking-[.18em] mb-2">
        Ihre Bestellung im Überblick
      </h3>
      {/* Trennlinien als border-t (nicht divide-y): nur border-slate-200 färbt antrag-dunkel.css sicher um. */}
      <dl>
        {u.zeilen.map((z) => (
          <div key={z.id} data-zeile={z.id} className="py-2 border-t border-slate-200 first:border-t-0 grid grid-cols-1 sm:grid-cols-[8.5rem_1fr] gap-x-4 gap-y-0.5 min-w-0">
            <dt className="text-[11.5px] text-slate-500">{z.titel}</dt>
            <dd className={`min-w-0 break-words leading-relaxed ${z.stark ? "text-[14px] font-semibold text-slate-900" : "text-[12.5px] text-slate-700"}`}
              style={{ fontVariantNumeric: "tabular-nums" }}>
              {z.wert}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-[11px] text-slate-500 leading-relaxed mt-2">{u.fuss}</p>
      <p className="text-[11.5px] mt-2 flex flex-wrap gap-x-4 gap-y-1">
        <a href="/agb" target="_blank" rel="noopener noreferrer" className="text-blue-700 underline underline-offset-2">AGB</a>
        <a href="/widerrufsbelehrung" target="_blank" rel="noopener noreferrer" className="text-blue-700 underline underline-offset-2">Widerrufsbelehrung</a>
        <a href="/datenschutz" target="_blank" rel="noopener noreferrer" className="text-blue-700 underline underline-offset-2">Datenschutz</a>
      </p>
    </section>
  );
}
