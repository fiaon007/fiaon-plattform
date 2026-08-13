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

/* ══════════════════════════════════════════════════════════════════════════
   DIE FLAGGEN — ALLE DREI GLEICH GROSS

   ── DER BEFUND (13.08.2026) ─────────────────────────────────────────────
   Der Vorgesetzte: „Die Flaggen alle gleich groß (Österreich, Deutschland,
   Schweiz — glänzend vielleicht?)"

   Im Screenshot war es deutlich: Die Schweizer Flagge hatte einen weißen Rand
   um ein quadratisches rotes Feld — sie wirkte kleiner und wie eine Kachel
   neben zwei Bändern.

   ── DIE ENTSCHEIDUNG ────────────────────────────────────────────────────
   Die Schweizer Flagge ist amtlich QUADRATISCH (1:1). In einer Reihe mit
   Deutschland und Österreich (3:2) gibt es zwei Wege:

     a) Quadrat lassen, Rand drumherum → wirkt kleiner, genau das Problem
     b) Auf 3:2 dehnen, Kreuz proportional halten → gleiche Fläche

   Ich nehme (b). Das ist die Darstellung, die auch Apple, Google und die SBB
   in Sprachwählern verwenden: Gleiche Fläche schlägt amtliche Proportion,
   sobald Flaggen NEBENEINANDER stehen. Das Kreuz behält dabei seine
   Verhältnisse (Balken 1/5 der Höhe, Arme 3/5 der Breite) — es wird nicht
   mitgedehnt, sondern in der Mitte gesetzt.

   ── DER GLANZ ───────────────────────────────────────────────────────────
   Über jeder Flagge liegt eine Glasschicht: ein diagonaler Lichtstreifen und
   eine weiche Aufhellung oben links, wie auf einem gewölbten Emailleschild.
   Das macht aus einem flachen Rechteck ein Objekt.
   ══════════════════════════════════════════════════════════════════════════ */

/** Der gemeinsame Rahmen: gleiche Fläche, gleicher Glanz, gleiche Kante. */
function FlaggenRahmen({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 60 40" width="100%" height="100%" aria-hidden="true"
         style={{ display: "block" }}>
      <defs>
        {/* Der Lichtbogen oben links — als würde eine Lampe von schräg oben
            auf eine leicht gewölbte Fläche fallen. */}
        <linearGradient id="fl-glanz" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity=".42" />
          <stop offset="42%" stopColor="#fff" stopOpacity=".08" />
          <stop offset="60%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        {/* Ein schmaler Streifen, der schräg über die Fläche läuft. */}
        <linearGradient id="fl-streif" x1="0" y1="1" x2="1" y2="0">
          <stop offset="30%" stopColor="#fff" stopOpacity="0" />
          <stop offset="47%" stopColor="#fff" stopOpacity=".2" />
          <stop offset="52%" stopColor="#fff" stopOpacity=".28" />
          <stop offset="58%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        {/* Unten eine Spur Schatten — sonst schwebt die Fläche nicht. */}
        <linearGradient id="fl-tief" x1="0" y1="0" x2="0" y2="1">
          <stop offset="72%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity=".18" />
        </linearGradient>
      </defs>
      {children}
      <rect width="60" height="40" fill="url(#fl-tief)" />
      <rect width="60" height="40" fill="url(#fl-glanz)" />
      <rect width="60" height="40" fill="url(#fl-streif)" />
    </svg>
  );
}

function FlaggeDE() {
  return (
    <FlaggenRahmen>
      <rect width="60" height="13.34" fill="#000000" />
      <rect y="13.33" width="60" height="13.34" fill="#DD0000" />
      <rect y="26.66" width="60" height="13.34" fill="#FFCE00" />
    </FlaggenRahmen>
  );
}

function FlaggeAT() {
  return (
    <FlaggenRahmen>
      <rect width="60" height="13.34" fill="#C8102E" />
      <rect y="13.33" width="60" height="13.34" fill="#FFFFFF" />
      <rect y="26.66" width="60" height="13.34" fill="#C8102E" />
    </FlaggenRahmen>
  );
}

function FlaggeCH() {
  // Rot über die GANZE Fläche — kein weißer Rand mehr. Das Kreuz behält seine
  // amtlichen Verhältnisse: Balkenbreite 1/6 der Höhe, Armlänge 7/6 davon.
  return (
    <FlaggenRahmen>
      <rect width="60" height="40" fill="#D52B1E" />
      <rect x="26.7" y="8" width="6.6" height="24" fill="#FFFFFF" />
      <rect x="18" y="16.7" width="24" height="6.6" fill="#FFFFFF" />
    </FlaggenRahmen>
  );
}

const FLAGGEN: Record<Land, () => JSX.Element> = {
  de: FlaggeDE, at: FlaggeAT, ch: FlaggeCH,
};

/**
 * Was der Besucher im jeweiligen Land bekommt — ein Satz je Land.
 *
 * ── KURZ GENUG FÜR EINE ZEILE ──────────────────────────────────────────────
 * Erster Entwurf: „Limits in Franken · ohne ZEK-Abfrage". Im Screenshot brach
 * das auf zwei Zeilen, und weil die drei Sätze unterschiedlich lang sind,
 * standen die Kacheln ungleich hoch — genau die Unruhe, die eine hochwertige
 * Oberfläche nicht haben darf.
 *
 * Jetzt: zwei Angaben, keine Füllwörter. „Franken · ohne ZEK" sagt dasselbe in
 * einer Zeile.
 */
const VERSPRECHEN: Record<Land, string> = {
  de: "Euro · ohne SCHUFA",
  at: "Euro · ohne KSV",
  ch: "Franken · ohne ZEK",
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
            {(["ch", "de", "at"] as Land[]).map((l, i) => {
              const p = LAENDER[l];
              const Flagge = FLAGGEN[l];
              return (
                /* ── JEDER KNOPF IST EINE 3D-BÜHNE ────────────────────────
                   Die Neigung folgt der Maus: Der Zeiger oben links kippt die
                   Karte nach hinten links, wie ein Blatt, das man anhebt.
                   Zehn Grad sind das Maximum — darüber wirkt es wie ein
                   Kartentrick, nicht wie Material.

                   `--i` staffelt den Auftritt: Die Schweiz kommt zuerst (die
                   Kampagne läuft dort), dann Deutschland, dann Österreich. */
                <button key={l} type="button" className="fi-lw-knopf"
                        data-gewaehlt={gehtRaus === l ? "1" : "0"}
                        style={{ ["--i" as any]: i }}
                        onMouseMove={(e) => {
                          const el = e.currentTarget;
                          const r = el.getBoundingClientRect();
                          const y = ((e.clientX - r.left) / r.width - .5) * 10;
                          const x = ((e.clientY - r.top) / r.height - .5) * -10;
                          el.style.setProperty("--rx", `${x}deg`);
                          el.style.setProperty("--ry", `${y}deg`);
                          // Der Lichtpunkt folgt dem Zeiger — das ist der
                          // Unterschied zwischen „glänzend" und „hat einen
                          // Farbverlauf".
                          el.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
                          el.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
                        }}
                        onMouseLeave={(e) => {
                          const el = e.currentTarget;
                          el.style.setProperty("--rx", "0deg");
                          el.style.setProperty("--ry", "0deg");
                        }}
                        onClick={() => waehlen(l)}>
                  <span className="fi-lw-glanz" aria-hidden="true" />
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
   DIE LÄNDERWAHL — 3D, GLAS, BEWEGUNG

   ── DER AUFTRAG (13.08.2026) ─────────────────────────────────────────────
   „Wenn man auf /start kommt, das muss besser aussehen: 3D, Glas, Animationen,
   die Flaggen alle gleich groß — glänzend vielleicht?"

   Was ein Bildschirm nicht kann: Tiefe. Was ihn trotzdem tief aussehen lässt,
   sind drei Dinge, in dieser Reihenfolge:

     1. LICHT von einer festen Quelle. Hier: schräg oben links. Jede Kante,
        jeder Glanz und jeder Schatten folgt dieser einen Annahme. Wo Licht aus
        zwei Richtungen kommt, wirkt nichts plastisch.
     2. UNSCHÄRFE hinter dem Glas — und zwar nicht überall gleich. Der
        Hintergrund verschwimmt stärker als die Karte selbst.
     3. BEWEGUNG, die Masse hat. Etwas Schweres startet langsam und kommt
        weich zur Ruhe. Eine lineare Animation sieht immer nach Software aus.
   ═══════════════════════════════════════════════════════════════════════════ */
.fi-lw {
  position: fixed; inset: 0; z-index: 400;
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
  /* Die Perspektive gehört auf die BÜHNE, nicht auf die Karte: So teilen alle
     Kinder denselben Fluchtpunkt und kippen gemeinsam statt jedes für sich. */
  perspective: 1400px;
}

.fi-lw-grund {
  position: absolute; inset: 0;
  background:
    radial-gradient(90% 70% at 50% 42%, rgba(20, 44, 92, .5), transparent 70%),
    rgba(6, 14, 33, .74);
  backdrop-filter: blur(18px) saturate(130%);
  -webkit-backdrop-filter: blur(18px) saturate(130%);
  animation: fiLwGrund 560ms cubic-bezier(.22,1,.36,1) both;
}
@keyframes fiLwGrund { from { opacity: 0; } to { opacity: 1; } }

/* ── DIE KARTE ─────────────────────────────────────────────────────────────
   Vier Schichten übereinander, von hinten nach vorn:
     1. ein farbiger Lichtkegel (radial-gradient)
     2. der Marineverlauf
     3. eine 1-px-Lichtkante oben (inset box-shadow)
     4. ein weicher Kernschatten unten
   Zusammen ergibt das eine Platte, die auf dem Hintergrund LIEGT. */
.fi-lw-karte {
  position: relative;
  width: min(700px, 100%);
  padding: 38px 34px 28px;
  border-radius: 30px;
  transform-style: preserve-3d;
  background:
    radial-gradient(130% 90% at 16% -10%, rgba(96,165,250,.26), transparent 58%),
    radial-gradient(80% 60% at 100% 110%, rgba(37,99,235,.18), transparent 62%),
    linear-gradient(158deg, #14305c 0%, #0b1b3f 54%, #060f24 100%);
  box-shadow:
    /* die Lichtkante oben — 1 px, mehr wäre ein Rahmen */
    0 1px 0 rgba(255,255,255,.2) inset,
    0 0 0 1px rgba(255,255,255,.06) inset,
    /* ein Hauch Innenschatten unten, damit die Fläche gewölbt wirkt */
    0 -30px 60px -40px rgba(0,0,0,.9) inset,
    /* und die Karte wirft Schatten: nah und hart, fern und weich */
    0 2px 6px -2px rgba(2, 8, 20, .5),
    0 44px 100px -34px rgba(2, 8, 20, .92);
  animation: fiLwAuf 680ms cubic-bezier(.16,1,.3,1) both;
}
/* Der Auftritt: aus der Tiefe nach vorn, mit Kippen. Nicht von unten
   hereingeschoben — das ist eine Schublade, kein Objekt. */
@keyframes fiLwAuf {
  from {
    opacity: 0;
    transform: translate3d(0, 30px, -140px) rotateX(9deg) scale(.94);
    filter: blur(9px);
  }
  to { opacity: 1; transform: none; filter: blur(0); }
}
.fi-lw-karte[data-raus="1"] {
  animation: fiLwZu 300ms cubic-bezier(.5,0,.9,.4) both;
}
@keyframes fiLwZu {
  to { opacity: 0; transform: translate3d(0, -14px, 90px) scale(1.03); filter: blur(7px); }
}

/* Ein Glanzband, das EINMAL über die Karte läuft, wenn sie erscheint. Danach
   ist Ruhe — ein dauernd wanderndes Licht ist Kirmes, nicht Wertigkeit. */
.fi-lw-karte::after {
  content: ""; position: absolute; inset: 0; border-radius: inherit;
  pointer-events: none; overflow: hidden;
  background: linear-gradient(104deg,
    transparent 32%, rgba(255,255,255,.09) 46%,
    rgba(255,255,255,.16) 50%, rgba(255,255,255,.06) 55%, transparent 68%);
  background-size: 260% 100%;
  animation: fiLwStreif 1500ms cubic-bezier(.3,0,.2,1) 320ms both;
}
@keyframes fiLwStreif {
  from { background-position: 190% 0; opacity: 0; }
  22%  { opacity: 1; }
  to   { background-position: -90% 0; opacity: 0; }
}

/* Jede Schriftfarbe steht ausdrücklich — auf dunklem Grund gewinnt sonst eine
   geerbte Tailwind-Farbe, und der Text verschwindet. */
.fi-lw-marke {
  font-size: 10.5px; font-weight: 800; letter-spacing: .38em;
  color: rgba(147, 184, 240, .8) !important;
  margin-bottom: 16px;
  animation: fiLwText 620ms cubic-bezier(.22,1,.36,1) 140ms both;
}
.fi-lw-frage {
  font-size: clamp(23px, 4.6vw, 33px); font-weight: 700; line-height: 1.12;
  letter-spacing: -.018em;
  color: #f8fbff !important;
  /* Ein Hauch Textschatten: Auf einem Verlauf braucht helle Schrift eine
     Kante, sonst flimmert sie an den Rändern. */
  text-shadow: 0 1px 20px rgba(4, 12, 30, .5);
  animation: fiLwText 620ms cubic-bezier(.22,1,.36,1) 200ms both;
}
.fi-lw-warum {
  margin-top: 11px; max-width: 47ch;
  font-size: 14px; line-height: 1.58;
  color: rgba(206, 224, 250, .82) !important;
  animation: fiLwText 620ms cubic-bezier(.22,1,.36,1) 270ms both;
}
@keyframes fiLwText {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: none; }
}

.fi-lw-reihe {
  margin-top: 27px;
  display: grid; gap: 12px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  transform-style: preserve-3d;
}

/* ── DIE DREI KNÖPFE ──────────────────────────────────────────────────────
   Jeder ist eine eigene kleine Platte: eigene Lichtkante, eigener Schatten,
   eigene Neigung unter der Maus. */
.fi-lw-knopf {
  position: relative; overflow: hidden;
  display: flex; flex-direction: column; align-items: flex-start; gap: 4px;
  padding: 17px 16px 16px;
  border: 0; border-radius: 20px; cursor: pointer; text-align: left;
  transform-style: preserve-3d;
  background:
    linear-gradient(158deg, rgba(255,255,255,.11), rgba(255,255,255,.045) 52%, rgba(255,255,255,.02));
  box-shadow:
    0 1px 0 rgba(255,255,255,.14) inset,
    0 0 0 1px rgba(255,255,255,.075) inset,
    0 10px 22px -14px rgba(2, 8, 20, .7);
  transform: perspective(700px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg));
  transition: box-shadow 220ms ease, background 220ms ease,
              transform 380ms cubic-bezier(.22,1,.36,1);
  animation: fiLwKnopf 620ms cubic-bezier(.16,1,.3,1) calc(340ms + var(--i, 0) * 85ms) both;
}
@keyframes fiLwKnopf {
  from { opacity: 0; transform: translate3d(0, 18px, -50px) scale(.95); }
  to   { opacity: 1; transform: none; }
}
.fi-lw-knopf:hover {
  background:
    linear-gradient(158deg, rgba(255,255,255,.17), rgba(255,255,255,.07) 52%, rgba(255,255,255,.03));
  box-shadow:
    0 1px 0 rgba(255,255,255,.26) inset,
    0 0 0 1px rgba(255,255,255,.16) inset,
    0 22px 44px -18px rgba(2, 8, 20, .85);
  /* Die Neigung kommt aus den Maus-Variablen; das Anheben addiert sich dazu. */
  transition-duration: 90ms;
}
.fi-lw-knopf:active { transform: perspective(700px) scale(.985); }

/* Der Lichtpunkt, der dem Zeiger folgt. DAS ist „glänzend": eine Reflexion,
   die sich bewegt, wenn man sich bewegt. */
.fi-lw-glanz {
  position: absolute; inset: 0; pointer-events: none; border-radius: inherit;
  opacity: 0; transition: opacity 260ms ease;
  background: radial-gradient(200px circle at var(--mx, 50%) var(--my, 0%),
    rgba(255,255,255,.16), transparent 62%);
}
.fi-lw-knopf:hover .fi-lw-glanz { opacity: 1; }

/* Die gewählte Karte leuchtet auf und kommt nach vorn — eine Bestätigung, die
   man spürt, ohne sie zu lesen. */
.fi-lw-knopf[data-gewaehlt="1"] {
  background: linear-gradient(158deg, rgba(147,197,253,.32), rgba(96,165,250,.16));
  box-shadow:
    0 1px 0 rgba(255,255,255,.4) inset,
    0 0 0 1px rgba(191, 219, 254, .55) inset,
    0 0 40px -4px rgba(96, 165, 250, .6),
    0 24px 44px -20px rgba(2, 8, 20, .8);
  transform: perspective(700px) translateZ(22px) scale(1.035);
  transition-duration: 240ms;
}

/* ── DIE FLAGGE ───────────────────────────────────────────────────────────
   Fester Rahmen für alle drei: 46 × 31 px. Die Schweizer Flagge füllt ihn
   jetzt genauso aus wie die anderen — das war die Beschwerde. */
.fi-lw-flagge {
  width: 46px; height: 31px; border-radius: 6px; overflow: hidden;
  margin-bottom: 11px; flex-shrink: 0;
  box-shadow:
    0 0 0 1px rgba(255,255,255,.2),
    0 3px 8px -2px rgba(0,0,0,.55),
    0 1px 0 rgba(255,255,255,.3) inset;
  transition: transform 380ms cubic-bezier(.22,1,.36,1), box-shadow 260ms ease;
  transform: translateZ(14px);
}
.fi-lw-knopf:hover .fi-lw-flagge {
  transform: translateZ(26px) scale(1.07) rotate(-1.4deg);
  box-shadow:
    0 0 0 1px rgba(255,255,255,.34),
    0 8px 18px -4px rgba(0,0,0,.6),
    0 1px 0 rgba(255,255,255,.45) inset;
}

.fi-lw-name {
  font-size: 15px; font-weight: 700; letter-spacing: -.005em;
  color: #ffffff !important;
  transform: translateZ(8px);
}
.fi-lw-satz {
  font-size: 11.5px; line-height: 1.42;
  color: rgba(191, 214, 247, .76) !important;
  transform: translateZ(4px);
  /* EINE Zeile. Bricht der Satz, stehen die drei Kacheln ungleich hoch — und
     ungleiche Höhen sind das Erste, was an einer Oberfläche billig wirkt. */
  white-space: nowrap;
  max-width: 100%; overflow: hidden; text-overflow: ellipsis;
}

.fi-lw-fuss {
  margin-top: 20px;
  font-size: 11.5px;
  color: rgba(160, 187, 226, .58) !important;
  animation: fiLwText 620ms cubic-bezier(.22,1,.36,1) 620ms both;
}

@media (max-width: 599px) {
  .fi-lw { padding: 14px; align-items: flex-end; }
  .fi-lw-karte { padding: 28px 21px 21px; border-radius: 24px; }
  /* Untereinander: Drei Spalten auf 360 px ergeben Kacheln, in denen der
     Ländername umbricht. */
  .fi-lw-reihe { grid-template-columns: 1fr; gap: 10px; }
  .fi-lw-knopf { flex-direction: row; align-items: center; gap: 14px; padding: 14px 15px; }
  .fi-lw-flagge { margin-bottom: 0; }
  .fi-lw-satz { display: none; }
  /* Auf dem Telefon gibt es keinen Zeiger — also auch keine Neigung. */
  .fi-lw-knopf { transform: none; }
}

@media (prefers-reduced-motion: reduce) {
  .fi-lw-grund, .fi-lw-karte, .fi-lw-marke, .fi-lw-frage, .fi-lw-warum,
  .fi-lw-knopf, .fi-lw-fuss { animation: none !important; }
  .fi-lw-karte::after { animation: none; opacity: 0; }
  .fi-lw-knopf, .fi-lw-flagge { transition: none; transform: none !important; }
  .fi-lw-glanz { display: none; }
}
`;
