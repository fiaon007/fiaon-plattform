// ═══════════════════════════════════════════════════════════════════════════
// AdresseSuche — ein Feld, das die Adresse beim Tippen vervollständigt (23.08.2026)
//
// Der Kunde tippt „Musterstr 12 Ber…", sieht Vorschläge mit Hausnummer, PLZ
// und Ort, wählt einen — fertig. PLZ und Ort erscheinen dann als bestätigte
// Zeile (änderbar). Wer keinen Vorschlag findet, tippt weiter wie bisher:
// Die Felder PLZ/Ort klappen auf, sobald er das Feld verlässt.
// Vorschläge kommen von /api/fiaon/adresse (Photon/OSM über unseren Server).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from "react";

export interface AdressWert { street: string; zip: string; city: string; country: string }
interface Vorschlag { strasse: string; plz: string; ort: string; land: "DE" | "AT" | "CH"; vollstaendig: boolean }

const LANDNAME: Record<string, string> = { DE: "Deutschland", AT: "Österreich", CH: "Schweiz" };

export function AdresseSuche({ wert, land, onChange, errors, platzhalter }: {
  wert: AdressWert; land: string; onChange: (w: Partial<AdressWert>) => void;
  errors: { street?: string; zip?: string; city?: string }; platzhalter: { street: string; zip: string; city: string };
}) {
  const [liste, setListe] = useState<Vorschlag[]>([]);
  const [offen, setOffen] = useState(false);
  const [aktiv, setAktiv] = useState(-1);
  const [laedt, setLaedt] = useState(false);
  const [manuell, setManuell] = useState(!!(wert.zip || wert.city));
  const [gewaehlt, setGewaehlt] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  const ab = useRef<AbortController | null>(null);
  const letzteFrage = useRef("");

  // Schließen beim Klick daneben
  useEffect(() => {
    const h = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOffen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);

  const suchen = (q: string) => {
    if (timer.current) window.clearTimeout(timer.current);
    const frage = q.trim();
    if (frage.length < 3) { setListe([]); setOffen(false); return; }
    timer.current = window.setTimeout(async () => {
      ab.current?.abort(); const c = new AbortController(); ab.current = c;
      letzteFrage.current = frage; setLaedt(true);
      try {
        const r = await fetch(`/api/fiaon/adresse?q=${encodeURIComponent(frage)}&land=${encodeURIComponent(land || "DE")}`, { signal: c.signal });
        const j = await r.json().catch(() => null);
        if (letzteFrage.current !== frage) return;
        const l: Vorschlag[] = j?.vorschlaege || [];
        setListe(l); setOffen(l.length > 0); setAktiv(l.length ? 0 : -1);
      } catch { /* abgebrochen oder offline — der Kunde tippt weiter */ }
      finally { if (letzteFrage.current === frage) setLaedt(false); }
    }, 160);
  };

  const [nummerFehlt, setNummerFehlt] = useState(false);
  const tippen = (v: string) => { setGewaehlt(false); if (/\d/.test(v)) setNummerFehlt(false); onChange({ street: v }); suchen(v); };
  const waehlen = (v: Vorschlag) => {
    // Justin, 23.08.2026: „Hausnummer muss angeführt werden." Hat der Vorschlag keine Nummer,
    // bleibt die getippte erhalten (Löwengasse 20 → Vorschlag „Löwengasse" → „Löwengasse 20").
    const getippt = String(wert.street || "").match(/\s(\d+\s?[a-zA-Z]?(?:[\/-]\d+)?)\s*$/);
    const strasse = v.vollstaendig ? v.strasse : getippt ? `${v.strasse} ${getippt[1].trim()}` : `${v.strasse} `;
    setNummerFehlt(!v.vollstaendig && !getippt);
    onChange({ street: strasse, zip: v.plz, city: v.ort, country: v.land });
    setGewaehlt(true); setManuell(true); setOffen(false); setListe([]);
  };
  const taste = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!offen || !liste.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setAktiv((a) => Math.min(a + 1, liste.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setAktiv((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (aktiv >= 0) waehlen(liste[aktiv]); }
    else if (e.key === "Escape") setOffen(false);
  };

  return (
    <div className="antrag-adresse" ref={wrap}>
      <label className="block text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">Adresse</label>
      <div className="relative">
        <input
          type="text" value={wert.street} onChange={(e) => tippen(e.target.value)} onKeyDown={taste}
          onFocus={() => { if (liste.length) setOffen(true); }}
          onBlur={() => { if (wert.street && !gewaehlt) window.setTimeout(() => setManuell(true), 150); }}
          placeholder={`${platzhalter.street} – einfach lostippen`}
          autoComplete="street-address" inputMode="text" aria-autocomplete="list" aria-expanded={offen}
          className="w-full px-4 py-3 pr-11 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 font-medium text-base outline-none transition-all duration-300 ease-in-out focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
        />
        <span className="antrag-adresse-zeichen" aria-hidden="true">
          {laedt ? <i className="dreht" /> : gewaehlt ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          )}
        </span>
        {offen && liste.length > 0 && (
          <ul className="antrag-adresse-liste" role="listbox">
            {liste.map((v, i) => (
              <li key={`${v.strasse}|${v.plz}|${v.ort}`} role="option" aria-selected={i === aktiv}
                  className={i === aktiv ? "aktiv" : ""}
                  onMouseEnter={() => setAktiv(i)} onMouseDown={(e) => { e.preventDefault(); waehlen(v); }}>
                <b>{v.strasse}</b>
                <span>{[v.plz, v.ort].filter(Boolean).join(" ")} · {LANDNAME[v.land] || v.land}</span>
              </li>
            ))}
            <li className="quelle" aria-hidden="true">Vorschläge aus OpenStreetMap · Sie können jederzeit selbst weitertippen</li>
          </ul>
        )}
      </div>
      {errors.street && <p className="mt-1 text-xs text-red-500">{errors.street}</p>}
      {nummerFehlt && <p className="mt-1.5 text-[12px] font-medium" style={{ color: "#f59e0b" }}>Bitte noch die Hausnummer ergänzen – einfach hinter die Straße tippen.</p>}
      {!manuell && !errors.zip && !errors.city && (
        <p className="mt-1.5 text-[11.5px] text-gray-400">Straße und Hausnummer tippen – PLZ und Ort ergänzen sich. <button type="button" className="antrag-adresse-link" onClick={() => setManuell(true)}>Lieber selbst eingeben</button></p>
      )}
      {(manuell || errors.zip || errors.city) && (
        <div className="grid grid-cols-[1fr,2fr] gap-3 mt-3">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">PLZ</label>
            <input type="text" value={wert.zip} onChange={(e) => { setGewaehlt(false); onChange({ zip: e.target.value }); }} placeholder={platzhalter.zip} inputMode="numeric" autoComplete="postal-code"
                   className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 font-medium text-base outline-none transition-all duration-300 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300" />
            {errors.zip && <p className="mt-1 text-xs text-red-500">{errors.zip}</p>}
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">Ort</label>
            <input type="text" value={wert.city} onChange={(e) => { setGewaehlt(false); onChange({ city: e.target.value }); }} placeholder={platzhalter.city} autoComplete="address-level2"
                   className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 font-medium text-base outline-none transition-all duration-300 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300" />
            {errors.city && <p className="mt-1 text-xs text-red-500">{errors.city}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
