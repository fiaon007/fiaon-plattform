import { useEffect, useRef, useState } from "react";
import { FiaonEbene } from "./FiaonEbene";

// ═══════════════════════════════════════════════════════════════════════════
// FILTER — Schnell-Chips vorn, alles andere in einer Ebene
//
// ── DAS PROBLEM ────────────────────────────────────────────────────────────
// Die Kunden-Zentrale hatte vierzehn Filterknöpfe in zwei Reihen. Das ist
// keine Leiste mehr, das ist eine Wand: Man liest sie nicht, man sucht darin.
// Und was man gerade eingestellt hat, ließ sich nur erkennen, indem man alle
// vierzehn Knöpfe auf ihre Farbe prüfte.
//
// ── DIE ORDNUNG ────────────────────────────────────────────────────────────
// 1. SCHNELL-CHIPS: Stufen und Hauptstatus, eine Reihe. Das sind die Filter,
//    die man täglich benutzt.
// 2. EIN KNOPF „Filter" mit Zahl. Dahinter alles Übrige, nach Gruppen
//    sortiert, mit Zähler je Option.
// 3. AKTIVE FILTER als entfernbare Chips neben dem Suchfeld. Wer sehen will,
//    was eingestellt ist, liest eine Zeile — nicht vierzehn Farben.
//
// Auf dem Bildschirm ein Popover unter dem Knopf, auf 380 px ein Blatt von
// unten. Beides dieselbe Liste.
// ═══════════════════════════════════════════════════════════════════════════

export interface FilterOption {
  schluessel: string;
  titel: string;
  /** Zahl aus der Datenbank. `null` = nicht zählbar (z. B. Dubletten). */
  anzahl?: number | null;
  /** Ein Satz, warum man das filtern würde. */
  erklaerung?: string;
}

export interface FilterGruppe {
  titel: string;
  /** „schalter" = mehrere gleichzeitig, „einer" = nur einer aus der Gruppe. */
  art: "schalter" | "einer";
  optionen: FilterOption[];
}

/** Winkel — 20×20, 1,5 px. */
function Winkel({ auf }: { auf: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor"
         strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"
         aria-hidden="true" focusable="false"
         style={{ transform: auf ? "rotate(180deg)" : "none", transition: "transform 240ms cubic-bezier(.32,.72,0,1)" }}>
      <path d="m5.5 8 4.5 4.5L14.5 8" />
    </svg>
  );
}

function KreuzKlein() {
  return (
    <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor"
         strokeWidth={2} strokeLinecap="round" aria-hidden="true" focusable="false">
      <path d="m5 5 10 10M15 5 5 15" />
    </svg>
  );
}

export function FiaonFilter({
  gruppen, aktiv, onAendern, onZuruecksetzen,
}: {
  gruppen: FilterGruppe[];
  /** Was gerade an ist: Schlüssel → true oder Wert. */
  aktiv: Record<string, string | boolean>;
  onAendern: (schluessel: string, wert: string | boolean | null) => void;
  onZuruecksetzen: () => void;
}) {
  const [auf, setAuf] = useState(false);
  const [schmal, setSchmal] = useState(() => typeof window !== "undefined" && window.innerWidth < 640);
  const huelle = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const messen = () => setSchmal(window.innerWidth < 640);
    window.addEventListener("resize", messen);
    return () => window.removeEventListener("resize", messen);
  }, []);

  // Klick daneben schließt. Nur auf dem Bildschirm — das Blatt hat seinen
  // eigenen Schleier.
  useEffect(() => {
    if (!auf || schmal) return;
    const daneben = (e: MouseEvent) => {
      if (huelle.current && !huelle.current.contains(e.target as Node)) setAuf(false);
    };
    const taste = (e: KeyboardEvent) => { if (e.key === "Escape") setAuf(false); };
    document.addEventListener("mousedown", daneben);
    window.addEventListener("keydown", taste);
    return () => {
      document.removeEventListener("mousedown", daneben);
      window.removeEventListener("keydown", taste);
    };
  }, [auf, schmal]);

  const anzahlAktiv = Object.keys(aktiv).filter((k) => aktiv[k] !== false && aktiv[k] != null).length;

  const liste = (
    <>
      {gruppen.map((g) => (
        <div key={g.titel} className="fi-filter-gruppe">
          <p className="fi-filter-gruppe-titel">{g.titel}</p>
          {g.optionen.map((o) => {
            const an = aktiv[o.schluessel] !== undefined
              && aktiv[o.schluessel] !== false && aktiv[o.schluessel] != null;
            return (
              <button key={o.schluessel} type="button"
                      onClick={() => onAendern(o.schluessel, an ? null : true)}
                      className="fi-filter-zeile" data-an={an ? "1" : "0"}>
                <span className="fi-filter-kasten" aria-hidden="true">
                  {an && (
                    <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor"
                         strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="m4 10.5 4 4 8-9" />
                    </svg>
                  )}
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="fi-filter-titel">{o.titel}</span>
                  {o.erklaerung && <span className="fi-filter-erklaerung">{o.erklaerung}</span>}
                </span>
                {o.anzahl != null && <span className="fi-filter-zahl">{o.anzahl}</span>}
              </button>
            );
          })}
        </div>
      ))}
    </>
  );

  return (
    <div ref={huelle} className="fi-filter-huelle">
      <style>{FILTER_CSS}</style>

      <button type="button" onClick={() => setAuf((a) => !a)}
              className="fi-filter-knopf" data-an={anzahlAktiv > 0 ? "1" : "0"}
              aria-expanded={auf} aria-haspopup="dialog">
        <span>Filter</span>
        {anzahlAktiv > 0 && <span className="fi-filter-knopf-zahl">{anzahlAktiv}</span>}
        <Winkel auf={auf} />
      </button>

      {/* ── Bildschirm: Popover ──────────────────────────────────────────── */}
      {auf && !schmal && (
        <div className="fi-filter-popover" role="dialog" aria-label="Filter">
          <div className="fi-filter-popover-koerper">{liste}</div>
          <div className="fi-filter-popover-fuss">
            <button type="button" onClick={onZuruecksetzen} className="fi-filter-zurueck"
                    disabled={anzahlAktiv === 0}>
              Zurücksetzen
            </button>
            <button type="button" onClick={() => setAuf(false)} className="fi-filter-fertig">Fertig</button>
          </div>
        </div>
      )}

      {/* ── 380 px: Blatt von unten ──────────────────────────────────────── */}
      {schmal && (
        <FiaonEbene
          offen={auf} onZu={() => setAuf(false)}
          titel="Filter"
          ueberschrift={anzahlAktiv > 0 ? `${anzahlAktiv} aktiv` : "Nichts eingestellt"}
          kinder={liste}
          fuss={
            <div className="flex items-center gap-2">
              <button type="button" onClick={onZuruecksetzen} className="fi-filter-zurueck"
                      disabled={anzahlAktiv === 0}>
                Zurücksetzen
              </button>
              <button type="button" onClick={() => setAuf(false)} className="fi-filter-fertig ml-auto">
                Fertig
              </button>
            </div>
          }
        />
      )}
    </div>
  );
}

/**
 * Die aktiven Filter als entfernbare Chips.
 *
 * Steht neben dem Suchfeld. Der Punkt ist die Umkehrung: Nicht „welche der
 * vierzehn Knöpfe leuchten", sondern „das hier ist gerade eingestellt".
 */
export function FiaonFilterChips({
  chips, onEntfernen, onAlle,
}: {
  chips: { schluessel: string; titel: string }[];
  onEntfernen: (schluessel: string) => void;
  onAlle: () => void;
}) {
  if (chips.length === 0) return null;
  return (
    <div className="fi-chips">
      <style>{FILTER_CSS}</style>
      {chips.map((c) => (
        <button key={c.schluessel} type="button" onClick={() => onEntfernen(c.schluessel)}
                className="fi-chip" aria-label={`Filter ${c.titel} entfernen`}>
          <span>{c.titel}</span>
          <span className="fi-chip-kreuz" aria-hidden="true"><KreuzKlein /></span>
        </button>
      ))}
      {chips.length > 1 && (
        <button type="button" onClick={onAlle} className="fi-chip-alle">Alle entfernen</button>
      )}
    </div>
  );
}

const FILTER_CSS = `
.fi-filter-huelle { position: relative; display: inline-flex; }

/* ── Der Knopf ─────────────────────────────────────────────────────────── */
.fi-filter-knopf {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 0 13px; height: 42px; border: 0; cursor: pointer;
  border-radius: 14px; font-size: 13px; font-weight: 600; color: #475569;
  background: #fff;
  box-shadow: inset 0 0 0 1px #e2e8f0, 0 1px 2px rgba(15,23,42,.04);
  transition: box-shadow 180ms, color 180ms, transform 120ms;
}
.fi-filter-knopf:hover { box-shadow: inset 0 0 0 1px #cbd5e1, 0 4px 12px -6px rgba(15,23,42,.18); }
.fi-filter-knopf:active { transform: translateY(1px); }
.fi-filter-knopf[data-an="1"] {
  color: #1d4ed8;
  box-shadow: inset 0 0 0 1.5px rgba(29,78,216,.35), 0 6px 16px -8px rgba(29,78,216,.35);
}
.fi-filter-knopf-zahl {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 19px; height: 19px; padding: 0 5px; border-radius: 99px;
  font-size: 11px; font-weight: 700; font-variant-numeric: tabular-nums;
  background: #1d4ed8; color: #fff;
}

/* ── Popover: Glas, aus der Tiefe ──────────────────────────────────────── */
.fi-filter-popover {
  position: absolute; top: calc(100% + 9px); left: 0; z-index: 60;
  width: 340px; max-height: 62vh; display: flex; flex-direction: column;
  border-radius: 20px; overflow: hidden;
  background: rgba(255,255,255,.86);
  backdrop-filter: blur(24px) saturate(170%);
  -webkit-backdrop-filter: blur(24px) saturate(170%);
  box-shadow:
    0 34px 80px -28px rgba(11,18,38,.5),
    0 10px 26px -14px rgba(11,18,38,.3),
    inset 0 0 0 1px rgba(15,23,42,.075),
    inset 0 1px 0 rgba(255,255,255,.85);
  transform-origin: top left;
  animation: fiFilterAuf 260ms cubic-bezier(.32,.72,0,1) both;
}
@keyframes fiFilterAuf {
  from { opacity: 0; transform: translateY(-8px) scale(.96); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
.fi-filter-popover-koerper { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 13px; }
.fi-filter-popover-fuss {
  flex-shrink: 0; display: flex; align-items: center; gap: 8px; padding: 11px 13px;
  background: rgba(255,255,255,.6);
  box-shadow: inset 0 1px 0 rgba(15,23,42,.07);
}

/* ── Gruppen und Zeilen ────────────────────────────────────────────────── */
.fi-filter-gruppe { margin-bottom: 13px; }
.fi-filter-gruppe:last-child { margin-bottom: 0; }
.fi-filter-gruppe-titel {
  font-size: 10px; font-weight: 700; letter-spacing: .13em; text-transform: uppercase;
  color: #94a3b8; margin: 0 0 5px; padding: 0 4px;
}
.fi-filter-zeile {
  width: 100%; display: flex; align-items: flex-start; gap: 9px;
  padding: 8px 9px; border: 0; cursor: pointer; border-radius: 11px;
  background: none; text-align: left;
  transition: background 140ms;
}
.fi-filter-zeile:hover { background: rgba(15,23,42,.04); }
.fi-filter-zeile[data-an="1"] { background: rgba(29,78,216,.07); }
.fi-filter-kasten {
  flex-shrink: 0; width: 18px; height: 18px; border-radius: 6px; margin-top: 1px;
  display: inline-flex; align-items: center; justify-content: center;
  background: #fff; color: #fff;
  box-shadow: inset 0 0 0 1.5px #cbd5e1;
  transition: background 160ms, box-shadow 160ms;
}
.fi-filter-zeile[data-an="1"] .fi-filter-kasten {
  background: #1d4ed8; box-shadow: inset 0 0 0 1.5px #1d4ed8, 0 3px 8px -3px rgba(29,78,216,.6);
}
.fi-filter-titel { display: block; font-size: 13px; font-weight: 600; color: #1e293b; line-height: 1.35; }
.fi-filter-zeile[data-an="1"] .fi-filter-titel { color: #1d4ed8; }
.fi-filter-erklaerung {
  display: block; font-size: 11px; color: #94a3b8; line-height: 1.4; margin-top: 1px;
}
.fi-filter-zahl {
  flex-shrink: 0; font-size: 11.5px; font-weight: 600; color: #94a3b8;
  font-variant-numeric: tabular-nums; margin-top: 2px;
}

.fi-filter-zurueck {
  background: none; border: 0; cursor: pointer; padding: 6px 2px;
  font-size: 12.5px; font-weight: 600; color: #64748b;
}
.fi-filter-zurueck:disabled { opacity: .35; cursor: default; }
.fi-filter-fertig {
  margin-left: auto; padding: 8px 15px; border: 0; cursor: pointer; border-radius: 12px;
  font-size: 12.5px; font-weight: 700; color: #fff; background: #1d4ed8;
  box-shadow: 0 8px 18px -9px rgba(29,78,216,.6);
}

/* ── Chips ─────────────────────────────────────────────────────────────── */
.fi-chips { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.fi-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 0 8px 0 11px; height: 30px; border: 0; cursor: pointer;
  border-radius: 99px; font-size: 12px; font-weight: 600; color: #1d4ed8;
  background: rgba(29,78,216,.08);
  box-shadow: inset 0 0 0 1px rgba(29,78,216,.16);
  transition: background 150ms, box-shadow 150ms;
  animation: fiChipAuf 220ms cubic-bezier(.32,.72,0,1) both;
}
@keyframes fiChipAuf {
  from { opacity: 0; transform: scale(.86); }
  to   { opacity: 1; transform: scale(1); }
}
.fi-chip:hover { background: rgba(29,78,216,.14); box-shadow: inset 0 0 0 1px rgba(29,78,216,.3); }
.fi-chip-kreuz {
  display: inline-flex; align-items: center; justify-content: center;
  width: 17px; height: 17px; border-radius: 99px;
  background: rgba(29,78,216,.14); color: #1d4ed8;
  transition: background 150ms;
}
.fi-chip:hover .fi-chip-kreuz { background: rgba(29,78,216,.26); }
.fi-chip-alle {
  background: none; border: 0; cursor: pointer; padding: 0 6px; height: 30px;
  font-size: 12px; font-weight: 600; color: #94a3b8;
}
.fi-chip-alle:hover { color: #475569; }

@media (prefers-reduced-motion: reduce) {
  .fi-filter-popover, .fi-chip { animation: none !important; }
  .fi-filter-knopf, .fi-filter-zeile, .fi-filter-kasten, .fi-chip { transition: none !important; }
}
`;
