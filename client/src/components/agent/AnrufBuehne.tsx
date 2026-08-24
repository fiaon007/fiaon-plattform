// ═══════════════════════════════════════════════════════════════════════════
// DIE ANRUFBÜHNE — die Hülle des Softphones, neu gedacht (24.08.2026)
//
// ── DER AUFTRAG (Justin) ───────────────────────────────────────────────────
// „Man drückt in der Akte auf anrufen — dann ruft man den Kunden an und
// unterhält sich mit ihm, tippt Sachen, verschickt Sachen. (Wenn man aktuell
// das Phone minimiert, sieht man es nicht mehr.) … Das gesamte Design vom
// Phone, und wenn man's minimiert, das soll VIEL VIEL moderner, cinematischer
// aussehen und funktional sein — perfekt bedienbar auf Handy und PC. Und lass
// dir was anderes einfallen, weg mit dem Handy, das ist unpraktisch —
// irgendwas 3D mit guten Animationen, Farbverläufen und sowas."
//
// ── WAS VORHER FALSCH WAR, UND ZWAR NICHT NUR OPTISCH ──────────────────────
// Der alte `FiaonGeraet` zeichnete ein Telefon: Titanrahmen, Kantenlicht,
// Displaybett, Glasreflex. Das sah für sich genommen gut aus — aber es machte
// drei Dinge kaputt, die im Alltag zählen:
//
//  1. ES SPERRTE DIE SEITE. Ein Schleier über allem plus
//     `document.body.style.overflow = "hidden"`. Genau währenddessen soll der
//     Mitarbeiter aber in der Akte tippen, Zahlungsdaten schicken, einen
//     Termin buchen. Er konnte es nicht.
//  2. DAS GERÄT IM GERÄT. Am Rechner ein gezeichnetes Telefon mitten im Bild,
//     das den halben Platz für einen Rahmen ausgab, der nichts kann.
//  3. MINIMIEREN HIESS VERSCHWINDEN. Wer zuklappte, sah nicht mehr, dass ein
//     Gespräch läuft. Justin hat genau das gemeldet.
//
// ── WAS DIE BÜHNE STATTDESSEN IST ──────────────────────────────────────────
// Eine schwebende Glaskonsole, die NEBEN der Arbeit liegt statt davor:
//
//  · KEIN SCHLEIER, KEINE SPERRE, solange ein Gespräch läuft. Die Akte bleibt
//    bedienbar — das ist der ganze Punkt. Nur die Wählansicht (Tastatur,
//    Suche) legt sich als eigene Fläche darüber, dort arbeitet ohnehin
//    niemand nebenher.
//  · DREI GRÖSSEN statt auf/zu: `voll` (wählen), `konsole` (im Gespräch,
//    kompakt an der Ecke) und `pille` (minimiert — eine schmale Leiste, die
//    IMMER sichtbar bleibt, mit Name, laufender Zeit, Stumm und Auflegen).
//  · ECHTE TIEFE: Die Konsole steht in einer Perspektive, kippt leicht zum
//    Zeiger, trägt gestaffelte Schatten und darunter ein langsam wanderndes
//    Farbfeld („Aurora"), das durch das Glas schimmert. Nicht gemalt —
//    gerechnet.
//  · Am Handy ist sie eine Lade von unten, die nur so hoch wird wie ihr
//    Inhalt. Minimiert bleibt eine Leiste über dem Daumen stehen.
//
// Kurz: Das Telefon ist kein Gegenstand mehr, den man ansieht, sondern eine
// Fläche, an der man arbeitet, während man spricht.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import "@/styles/anruf-buehne.css";

export type BuehnenGroesse = "voll" | "konsole" | "pille";

export function AnrufBuehne({
  offen, groesse, onZu, onGroesse, kopf, children, titel,
}: {
  offen: boolean;
  /** `voll` = wählen · `konsole` = im Gespräch · `pille` = minimiert. */
  groesse: BuehnenGroesse;
  onZu: () => void;
  onGroesse: (g: BuehnenGroesse) => void;
  /** Was in der minimierten Leiste steht — Name, Zeit, zwei Knöpfe. */
  kopf?: ReactNode;
  children: ReactNode;
  titel: string;
}) {
  const [drin, setDrin] = useState(false);
  const [schmal, setSchmal] = useState(
    () => typeof window !== "undefined" && window.innerWidth <= 700,
  );
  const [zieht, setZieht] = useState(0);
  const buehne = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const messen = () => setSchmal(window.innerWidth <= 700);
    window.addEventListener("resize", messen);
    return () => window.removeEventListener("resize", messen);
  }, []);

  // Einen Rahmen später einhängen, sonst sieht der Browser keinen Übergang.
  useEffect(() => {
    if (!offen) { setDrin(false); return; }
    const t = window.setTimeout(() => setDrin(true), 20);
    return () => window.clearTimeout(t);
  }, [offen]);

  // ── DIE SEITE WIRD NUR IN DER WÄHLANSICHT GESPERRT ───────────────────────
  // VORHER galt die Sperre immer. Wer telefonierte, konnte in der Akte weder
  // scrollen noch tippen — bei einem Werkzeug, dessen Zweck genau das ist.
  // NACHHER nur bei `voll`: Dort liegt die Tastatur über allem, und dahinter
  // soll niemand blättern.
  useEffect(() => {
    if (!offen || groesse !== "voll") return;
    const vorher = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = vorher; };
  }, [offen, groesse]);

  // Escape: aus der Wählansicht heraus zumachen, im Gespräch nur verkleinern.
  // Ein versehentliches Escape darf kein laufendes Gespräch beenden.
  useEffect(() => {
    if (!offen) return;
    const taste = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (groesse === "voll") onZu(); else onGroesse("pille");
    };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [offen, groesse, onZu, onGroesse]);

  // Die Konsole neigt sich zum Zeiger — nur auf Geräten mit echtem Zeiger.
  // Am Telefon stünde sie nach der ersten Berührung dauerhaft schief.
  const neigen = (e: React.MouseEvent) => {
    const el = buehne.current;
    if (!el || schmal || groesse !== "konsole") return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--ab-neig-y", `${(x * 6).toFixed(2)}deg`);
    el.style.setProperty("--ab-neig-x", `${(-y * 4).toFixed(2)}deg`);
  };
  const geradeStellen = () => {
    const el = buehne.current;
    if (!el) return;
    el.style.removeProperty("--ab-neig-y");
    el.style.removeProperty("--ab-neig-x");
  };

  if (!offen) return null;

  /** Das wandernde Farbfeld hinter dem Glas — der „cinematische" Teil. */
  const aurora = (
    <div className="ab-aurora" aria-hidden="true">
      <i className="ab-aurora-a" /><i className="ab-aurora-b" /><i className="ab-aurora-c" />
    </div>
  );

  // ── MINIMIERT: die Leiste, die nie verschwindet ─────────────────────────
  if (groesse === "pille") {
    return createPortal(
      <div className={`ab-pille${schmal ? " schmal" : ""}`} data-drin={drin ? "1" : "0"}
           role="region" aria-label={`${titel} – minimiert`}>
        {aurora}
        <button type="button" className="ab-pille-auf" onClick={() => onGroesse("konsole")}
                aria-label="Telefon wieder öffnen">
          <span className="ab-welle" aria-hidden="true"><i /><i /><i /><i /><i /></span>
        </button>
        <div className="ab-pille-inhalt">{kopf}</div>
      </div>,
      document.body,
    );
  }

  const inhalt = (
    <div ref={buehne}
         className={`ab-flaeche ${groesse}${schmal ? " schmal" : ""}`}
         data-drin={drin ? "1" : "0"}
         role="dialog" aria-modal={groesse === "voll" ? "true" : undefined} aria-label={titel}
         onMouseMove={neigen} onMouseLeave={geradeStellen}
         style={zieht ? { transform: `translateY(${zieht}px)`, transition: "none" } : undefined}>
      {aurora}

      {/* Der Griff: am Handy zum Ziehen, am Rechner die Knopfzeile. */}
      <div className="ab-griff"
           onTouchStart={(e) => { (e.currentTarget as any)._start = e.touches[0].clientY; }}
           onTouchMove={(e) => {
             const s = (e.currentTarget as any)._start ?? 0;
             setZieht(Math.max(0, e.touches[0].clientY - s));
           }}
           onTouchEnd={() => {
             // Ziehen VERKLEINERT, es beendet nichts. Ein laufendes Gespräch
             // darf niemals an einer Wischgeste hängen.
             if (zieht > 100) onGroesse(groesse === "voll" ? "konsole" : "pille");
             setZieht(0);
           }}>
        <span className="ab-griff-strich" aria-hidden="true" />
        <div className="ab-griff-knoepfe">
          <button type="button" className="ab-klein" onClick={() => onGroesse("pille")}
                  title="Verkleinern – das Gespräch läuft weiter" aria-label="Verkleinern">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14" /></svg>
          </button>
          <button type="button" className="ab-klein" onClick={onZu}
                  title="Schließen" aria-label="Schließen">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
      </div>

      <div className="ab-inhalt">{children}</div>
    </div>
  );

  return createPortal(
    <>
      {/* Der Schleier NUR beim Wählen. Im Gespräch bleibt die Akte offen —
          das ist der Kern des Umbaus. */}
      {groesse === "voll" && <div className="ab-schleier" onClick={() => onGroesse("konsole")} aria-hidden="true" />}
      {inhalt}
    </>,
    document.body,
  );
}
