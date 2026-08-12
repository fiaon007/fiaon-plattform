// ═══════════════════════════════════════════════════════════════════════════
// „AUS WELCHEM LAND KOMMST DU?"
//
// ── DER AUFTRAG (11.08.2026) ───────────────────────────────────────────────
// „Wenn man auf die Plattform kommt, muss gefragt werden (Österreich,
// Deutschland oder Schweiz) oder vielleicht nur Flaggen? Es muss auf jeden Fall
// TOP aussehen (unser CI ist sehr hochwertig)."
//
// ── DREI FLAGGEN, DREI NAMEN ───────────────────────────────────────────────
// Nur Flaggen wären zu wenig: Wer die Seite auf einem Telefon im Sonnenlicht
// öffnet, unterscheidet Schwarz-Rot-Gold nicht sicher von Rot-Weiß-Rot. Der
// Name steht dabei — das kostet nichts und nimmt jeden Zweifel.
//
// Die Flaggen sind SVG, kein Emoji: AGENTS.md verbietet Emojis, und
// Flaggen-Emojis werden auf Windows ohnehin als Buchstabenpaar dargestellt
// („DE" statt einer Flagge). Ein Design, das auf einem Drittel der Geräte
// bricht, ist keins.
//
// ── WARUM KEINE IP-ERKENNUNG ───────────────────────────────────────────────
// Sie ist bei VPN, Mobilfunk und Firmennetzen oft falsch. Einem Schweizer
// Deutschland zu zeigen ist schlimmer, als ihn zu fragen: Er merkt sofort, dass
// die Seite nicht für ihn gemacht ist, und geht.
//
// Die Kampagne liefert `?land=ch` mit — dann wird gar nicht gefragt. Diese
// Auswahl erscheint nur für Besucher ohne Herkunft.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { LAENDER, landGewaehlt, landSchreiben, type Land } from "@/lib/fiaon-land";

/* ── Die Flaggen. Gezeichnet, nicht getippt. ─────────────────────────────── */

function FlaggeDE() {
  return (
    <svg viewBox="0 0 60 40" width="100%" height="100%" aria-hidden="true">
      <rect width="60" height="13.33" fill="#000000" />
      <rect y="13.33" width="60" height="13.33" fill="#DD0000" />
      <rect y="26.66" width="60" height="13.34" fill="#FFCE00" />
    </svg>
  );
}

function FlaggeAT() {
  return (
    <svg viewBox="0 0 60 40" width="100%" height="100%" aria-hidden="true">
      <rect width="60" height="13.33" fill="#ED2939" />
      <rect y="13.33" width="60" height="13.33" fill="#FFFFFF" />
      <rect y="26.66" width="60" height="13.34" fill="#ED2939" />
    </svg>
  );
}

function FlaggeCH() {
  // Das Schweizerkreuz ist quadratisch — auf einer 3:2-Fläche würde es
  // verzerren. Deshalb ein quadratisches Feld mit weißem Rand darum.
  return (
    <svg viewBox="0 0 60 40" width="100%" height="100%" aria-hidden="true">
      <rect width="60" height="40" fill="#FFFFFF" />
      <rect x="10" width="40" height="40" fill="#DA291C" />
      <rect x="27" y="9" width="6" height="22" fill="#FFFFFF" />
      <rect x="19" y="17" width="22" height="6" fill="#FFFFFF" />
    </svg>
  );
}

const FLAGGEN: Record<Land, () => JSX.Element> = {
  de: FlaggeDE, at: FlaggeAT, ch: FlaggeCH,
};

/** Was der Besucher im jeweiligen Land bekommt — ein Satz je Land. */
const VERSPRECHEN: Record<Land, string> = {
  de: "Limits in Euro · ohne SCHUFA-Abfrage",
  at: "Limits in Euro · ohne KSV-Abfrage",
  ch: "Limits in Franken · ohne ZEK-Abfrage",
};

export function LandWahl({ onWahl }: { onWahl: (l: Land) => void }) {
  const [offen, setOffen] = useState(false);
  const [gehtRaus, setGehtRaus] = useState<Land | null>(null);

  useEffect(() => {
    // Wer schon gewählt hat oder über die Kampagne kommt, sieht das nie.
    if (landGewaehlt()) return;
    // Ein Lidschlag Verzögerung: Die Seite ist dann gezeichnet, und die
    // Auswahl legt sich darüber statt mit ihr zu erscheinen. Das wirkt
    // ruhiger als ein Aufblitzen beim ersten Bild.
    const t = window.setTimeout(() => setOffen(true), 260);
    return () => window.clearTimeout(t);
  }, []);

  if (!offen) return null;

  const waehlen = (l: Land) => {
    setGehtRaus(l);
    landSchreiben(l);
    // Die Karte darf ihre Bewegung beenden, bevor die Seite umschaltet.
    window.setTimeout(() => { setOffen(false); onWahl(l); }, 260);
  };

  return (
    <>
      <style>{LAND_CSS}</style>
      <div className="fi-lw" role="dialog" aria-modal="true" aria-label="Land wählen">
        <div className="fi-lw-grund" />
        <div className="fi-lw-karte" data-raus={gehtRaus ? "1" : "0"}>
          {/* Die Marke zuerst: Wer hier landet, soll wissen, wo er ist,
              bevor er eine Frage beantwortet. */}
          <p className="fi-lw-marke">FIAON</p>
          <h2 className="fi-lw-frage">Wo bist du zu Hause?</h2>
          <p className="fi-lw-warum">
            Wir zeigen dir Limits, Gebühren und Bedingungen in deiner Währung —
            und die Regeln, die für dich gelten.
          </p>

          <div className="fi-lw-reihe">
            {(["ch", "de", "at"] as Land[]).map((l) => {
              const p = LAENDER[l];
              const Flagge = FLAGGEN[l];
              return (
                <button key={l} type="button" className="fi-lw-knopf"
                        data-gewaehlt={gehtRaus === l ? "1" : "0"}
                        onClick={() => waehlen(l)}>
                  <span className="fi-lw-flagge"><Flagge /></span>
                  <span className="fi-lw-name">{p.name}</span>
                  <span className="fi-lw-satz">{VERSPRECHEN[l]}</span>
                </button>
              );
            })}
          </div>

          <p className="fi-lw-fuss">
            Du kannst das jederzeit unten auf der Seite ändern.
          </p>
        </div>
      </div>
    </>
  );
}

const LAND_CSS = `
/* ═══════════════════════════════════════════════════════════════════════════
   DIE LÄNDERWAHL

   „Es muss auf jeden Fall TOP aussehen (unser CI ist sehr hochwertig)."

   Also: tiefer Marineverlauf wie die Karten, echtes Glas (backdrop-filter),
   eine Lichtkante oben, und Bewegung, die aus der Ruhe kommt — keine
   Sprungfeder. Nichts blinkt, nichts drängt.
   ═══════════════════════════════════════════════════════════════════════════ */
.fi-lw {
  position: fixed; inset: 0; z-index: 400;
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
}
.fi-lw-grund {
  position: absolute; inset: 0;
  background: rgba(7, 17, 38, .72);
  backdrop-filter: blur(14px) saturate(120%);
  -webkit-backdrop-filter: blur(14px) saturate(120%);
  animation: fiLwGrund 420ms ease both;
}
@keyframes fiLwGrund { from { opacity: 0; } to { opacity: 1; } }

.fi-lw-karte {
  position: relative;
  width: min(680px, 100%);
  padding: 34px 30px 26px;
  border-radius: 26px;
  background:
    radial-gradient(120% 80% at 20% 0%, rgba(59,130,246,.18), transparent 60%),
    linear-gradient(158deg, #12294f 0%, #0b1b3f 52%, #071129 100%);
  box-shadow:
    0 1px 0 rgba(255,255,255,.16) inset,
    0 0 0 1px rgba(255,255,255,.07) inset,
    0 40px 90px -30px rgba(4, 10, 26, .9),
    0 8px 24px -12px rgba(4, 10, 26, .6);
  animation: fiLwAuf 520ms cubic-bezier(.22,1,.36,1) both;
}
@keyframes fiLwAuf {
  from { opacity: 0; transform: translateY(26px) scale(.965); filter: blur(6px); }
  to   { opacity: 1; transform: none; filter: blur(0); }
}
.fi-lw-karte[data-raus="1"] {
  animation: fiLwZu 260ms cubic-bezier(.4,0,1,1) both;
}
@keyframes fiLwZu {
  to { opacity: 0; transform: translateY(-10px) scale(.985); filter: blur(4px); }
}

/* Jede Schriftfarbe steht ausdrücklich — auf dunklem Grund gewinnt sonst eine
   geerbte Tailwind-Farbe, und der Text ist unlesbar. */
.fi-lw-marke {
  font-size: 11px; font-weight: 800; letter-spacing: .34em;
  color: rgba(147, 184, 240, .85) !important;
  margin-bottom: 14px;
}
.fi-lw-frage {
  font-size: clamp(22px, 4.4vw, 30px); font-weight: 700; line-height: 1.15;
  letter-spacing: -.01em;
  color: #f6f9ff !important;
}
.fi-lw-warum {
  margin-top: 9px; max-width: 46ch;
  font-size: 13.5px; line-height: 1.55;
  color: rgba(203, 222, 250, .8) !important;
}

.fi-lw-reihe {
  margin-top: 24px;
  display: grid; gap: 11px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.fi-lw-knopf {
  display: flex; flex-direction: column; align-items: flex-start; gap: 3px;
  padding: 16px 15px 15px;
  border: 0; border-radius: 17px; cursor: pointer; text-align: left;
  background: rgba(255,255,255,.055);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.09);
  transition: background 180ms ease, transform 180ms cubic-bezier(.22,1,.36,1),
              box-shadow 180ms ease;
}
.fi-lw-knopf:hover {
  background: rgba(255,255,255,.1);
  transform: translateY(-3px);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.2),
              0 14px 30px -14px rgba(2, 8, 22, .8);
}
.fi-lw-knopf:active { transform: translateY(-1px) scale(.99); }
/* Die gewählte Karte leuchtet kurz auf, während die Ansicht wechselt — eine
   Bestätigung, die man spürt, ohne sie zu lesen. */
.fi-lw-knopf[data-gewaehlt="1"] {
  background: rgba(96, 165, 250, .22);
  box-shadow: inset 0 0 0 1px rgba(147, 197, 253, .5),
              0 0 30px -6px rgba(96, 165, 250, .5);
}

.fi-lw-flagge {
  width: 42px; height: 28px; border-radius: 5px; overflow: hidden;
  margin-bottom: 9px;
  box-shadow: 0 2px 6px -2px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.14);
}
.fi-lw-name {
  font-size: 14.5px; font-weight: 700;
  color: #ffffff !important;
}
.fi-lw-satz {
  font-size: 11.5px; line-height: 1.4;
  color: rgba(186, 210, 245, .72) !important;
}

.fi-lw-fuss {
  margin-top: 18px;
  font-size: 11.5px;
  color: rgba(160, 187, 226, .6) !important;
}

@media (max-width: 599px) {
  .fi-lw { padding: 14px; align-items: flex-end; }
  .fi-lw-karte { padding: 26px 20px 20px; border-radius: 22px; }
  /* Untereinander: Drei Spalten auf 360 px ergeben 100-px-Kacheln, in denen
     der Ländername umbricht. */
  .fi-lw-reihe { grid-template-columns: 1fr; gap: 9px; }
  .fi-lw-knopf { flex-direction: row; align-items: center; gap: 13px; padding: 13px 14px; }
  .fi-lw-flagge { margin-bottom: 0; flex-shrink: 0; }
  .fi-lw-name { flex-shrink: 0; }
  .fi-lw-satz { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .fi-lw-grund, .fi-lw-karte { animation: none; }
  .fi-lw-knopf { transition: none; }
  .fi-lw-knopf:hover { transform: none; }
}
`;
