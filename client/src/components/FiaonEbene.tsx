import { useCallback, useEffect, useRef, useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// FIAON-EBENE — das eine Bauteil für jeden Dialog im Haus
//
// ── WAS VORHER FALSCH WAR ──────────────────────────────────────────────────
// Jeder Dialog hatte seinen eigenen weißen Kasten über `rgba(7,11,22,.6)`.
// Das ist der Standardlook jeder Web-App seit 2015: Der Hintergrund wird
// erschlagen, der Kasten schwebt nicht, er klebt. Der Betreiber hat das zu
// Recht abgelehnt.
//
// ── DIE DREI ENTSCHEIDUNGEN ────────────────────────────────────────────────
//
// 1. DER SCHLEIER HELLT AUF, STATT ZU VERDUNKELN.
//    Statt Schwarz liegt eine kühle, halbdurchsichtige Aufhellung über der
//    Seite, dazu eine starke Unschärfe und eine leichte Sättigung. Der
//    Hintergrund bleibt LESBAR als Struktur — man weiß, wo man ist. Ein
//    schwarzer Schleier sagt „hier ist nichts mehr"; Glas sagt „das hier liegt
//    darüber".
//
// 2. DIE EBENE TRITT AUS DER TIEFE EIN.
//    Eine `perspective`-Bühne mit `translateZ` und einer minimalen Kippung
//    (rotateX). Die Ebene kommt dem Auge ENTGEGEN, statt von unten
//    hereinzurutschen. Der Unterschied ist derselbe wie zwischen einer Tür,
//    die aufgeht, und einem Zettel, der hochgeschoben wird.
//
// 3. GLAS NUR AUF DEN SCHWEBENDEN SCHICHTEN.
//    Kopf- und Fußleiste sind Glas (sie liegen über dem rollenden Inhalt und
//    dürfen ihn durchscheinen lassen). Der Körper ist MASSIV — Text auf Glas
//    ist auf einem 380-px-Telefon bei Sonne unlesbar, und Lesbarkeit gewinnt
//    gegen Effekt.
//
// Auf 380 px wird daraus ein Blatt in voller Breite mit Grabber, das man nach
// unten wischen kann. Kein Gerät im Gerät.
//
// `prefers-reduced-motion` schaltet alle Bewegung ab — die Tiefe bleibt über
// Schatten erhalten.
// ═══════════════════════════════════════════════════════════════════════════

export interface EbeneProps {
  offen: boolean;
  onZu: () => void;
  /** Für Screenreader — Pflicht. */
  titel: string;
  /** Kleine Zeile über dem Titel. */
  ueberschrift?: string;
  /** Zweite Zeile unter dem Titel. */
  unterzeile?: string;
  /** Eigener Kopf statt Titel/Unterzeile. */
  kopf?: React.ReactNode;
  /** Die Fußleiste — Glas, klebt unten. */
  fuss?: React.ReactNode;
  /** Ein Zeichen links im Kopf. */
  marke?: React.ReactNode;
  breite?: number;
  /** Rechts angedockt statt zentriert (Softphone). */
  andocken?: "mitte" | "rechts-unten";
  /** Kein Schließkreuz — für Ebenen, aus denen man nur über eine Aktion kommt. */
  ohneKreuz?: boolean;
  kinder: React.ReactNode;
}

/** Kreuz — 20×20, 1,5 px, currentColor. */
function Kreuz({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor"
         strokeWidth={1.6} strokeLinecap="round" aria-hidden="true" focusable="false">
      <path d="m5 5 10 10M15 5 5 15" />
    </svg>
  );
}

let ebenenZaehler = 0;

export function FiaonEbene({
  offen, onZu, titel, ueberschrift, unterzeile, kopf, fuss, marke,
  breite = 560, andocken = "mitte", ohneKreuz = false, kinder,
}: EbeneProps) {
  const [schmal, setSchmal] = useState(() => typeof window !== "undefined" && window.innerWidth < 640);
  const [zieht, setZieht] = useState(0);
  const [geht, setGeht] = useState(false);
  const blatt = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    const messen = () => setSchmal(window.innerWidth < 640);
    window.addEventListener("resize", messen);
    return () => window.removeEventListener("resize", messen);
  }, []);

  // ── Escape und Rollsperre ────────────────────────────────────────────────
  // Der Zähler ist wichtig: Liegen zwei Ebenen übereinander (Lösch-Dialog über
  // Kundenliste), darf die obere beim Schließen die Rollsperre nicht aufheben.
  useEffect(() => {
    if (!offen) return;
    const taste = (e: KeyboardEvent) => { if (e.key === "Escape") schliessen(); };
    window.addEventListener("keydown", taste);
    ebenenZaehler++;
    const vorher = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", taste);
      ebenenZaehler = Math.max(0, ebenenZaehler - 1);
      if (ebenenZaehler === 0) document.body.style.overflow = vorher;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offen]);

  /** Erst die Austritts-Bewegung, dann wirklich zu. */
  const schliessen = useCallback(() => {
    const reduziert = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduziert) { onZu(); return; }
    setGeht(true);
    setTimeout(() => { setGeht(false); setZieht(0); onZu(); }, 190);
  }, [onZu]);

  if (!offen) return null;

  // ── Wischen zum Schließen (nur schmal) ───────────────────────────────────
  // Ab 90 px Zugweg geht sie zu. Darunter federt sie zurück — ein versehentlich
  // angetippter Dialog soll nicht verschwinden.
  const zugStart = (e: React.TouchEvent) => {
    if (!schmal) return;
    // Nur greifen, wenn der Inhalt oben steht. Sonst würde jedes Scrollen im
    // Dialog als Wischen gelesen.
    if ((blatt.current?.querySelector("[data-ebene-rolle]")?.scrollTop ?? 0) > 4) return;
    startY.current = e.touches[0].clientY;
  };
  const zugLauf = (e: React.TouchEvent) => {
    if (startY.current == null) return;
    const d = e.touches[0].clientY - startY.current;
    if (d > 0) setZieht(d);
  };
  const zugEnde = () => {
    if (zieht > 90) schliessen();
    else setZieht(0);
    startY.current = null;
  };

  const rechtsUnten = andocken === "rechts-unten" && !schmal;

  return (
    <>
      <style>{EBENEN_CSS}</style>

      {/* ── Der Glas-Schleier ─────────────────────────────────────────────
          Aufhellend, nicht verdunkelnd. Zwei Schichten: eine kühle Tönung und
          ein weicher blauer Schein von unten, der die Ebene wie beleuchtet
          erscheinen lässt. */}
      <div
        className={`fi-ebene-schleier ${geht ? "fi-ebene-schleier-weg" : ""}`}
        onClick={schliessen}
        aria-hidden="true"
      />

      <div
        className={`fi-ebene-buehne ${rechtsUnten ? "fi-ebene-buehne-ecke" : ""}`}
        style={{ perspective: schmal ? "none" : "1400px" }}
      >
        <div
          ref={blatt}
          role="dialog"
          aria-modal="true"
          aria-label={titel}
          className={`fi-ebene ${schmal ? "fi-ebene-blatt" : "fi-ebene-mitte"} ${geht ? "fi-ebene-weg" : ""}`}
          style={{
            maxWidth: schmal ? "100%" : breite,
            transform: zieht ? `translateY(${zieht}px)` : undefined,
            transition: zieht ? "none" : undefined,
          }}
          onTouchStart={zugStart}
          onTouchMove={zugLauf}
          onTouchEnd={zugEnde}
        >
          {/* Der Grabber — sagt ohne Worte „hier ziehen". */}
          {schmal && <div className="fi-ebene-grabber" aria-hidden="true"><span /></div>}

          {/* ── Kopf: Glas ─────────────────────────────────────────────── */}
          <div className="fi-ebene-kopf">
            {kopf ?? (
              <div className="flex items-start gap-3">
                {marke && <span className="fi-ebene-marke shrink-0">{marke}</span>}
                <div className="min-w-0 flex-1">
                  {ueberschrift && <p className="fi-ebene-ueberschrift">{ueberschrift}</p>}
                  <h2 className="fi-ebene-titel">{titel}</h2>
                  {unterzeile && <p className="fi-ebene-unterzeile">{unterzeile}</p>}
                </div>
                {!ohneKreuz && (
                  <button type="button" onClick={schliessen} aria-label="Schließen" className="fi-ebene-kreuz shrink-0">
                    <Kreuz />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── Körper: massiv, damit Text lesbar bleibt ────────────────── */}
          <div className="fi-ebene-koerper" data-ebene-rolle>
            {kinder}
          </div>

          {/* ── Fuß: Glas ──────────────────────────────────────────────── */}
          {fuss && <div className="fi-ebene-fuss">{fuss}</div>}
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Das CSS. Als String, damit das Bauteil ohne Änderung an der globalen
// Stildatei überall funktioniert — und damit die Werte NEBEN der Begründung
// stehen.
// ═══════════════════════════════════════════════════════════════════════════

const EBENEN_CSS = `
/* ── Schleier ──────────────────────────────────────────────────────────── */
.fi-ebene-schleier {
  position: fixed; inset: 0; z-index: 400;
  /* AUFHELLEN, nicht verdunkeln. Der kühle Ton nimmt dem Hintergrund die
     Aufmerksamkeit, ohne ihn zu löschen. */
  background:
    radial-gradient(120% 90% at 50% 115%, rgba(37,99,235,.20), transparent 62%),
    linear-gradient(180deg, rgba(226,236,250,.62), rgba(203,218,240,.70));
  backdrop-filter: blur(22px) saturate(150%);
  -webkit-backdrop-filter: blur(22px) saturate(150%);
  animation: fiSchleierAuf 260ms cubic-bezier(.32,.72,0,1) both;
}
.fi-ebene-schleier-weg { animation: fiSchleierZu 190ms cubic-bezier(.32,.72,0,1) both; }
@keyframes fiSchleierAuf { from { opacity: 0 } to { opacity: 1 } }
@keyframes fiSchleierZu { from { opacity: 1 } to { opacity: 0 } }

/* ── Bühne ─────────────────────────────────────────────────────────────── */
.fi-ebene-buehne {
  position: fixed; inset: 0; z-index: 401;
  display: flex; align-items: center; justify-content: center;
  padding: 24px; pointer-events: none;
}
/* Rechts unten angedockt: Das Gerät soll aus dem Telefon-Knopf zu wachsen
   scheinen. Der Abstand nach unten ist GRÖSSER als der Knopf hoch ist (58 px
   plus 20 px Rand), sonst liegt es darauf und verdeckt ihn. */
.fi-ebene-buehne-ecke {
  align-items: flex-end; justify-content: flex-end;
  padding: 24px 24px 92px;
}
.fi-ebene-buehne-ecke .fi-ebene { max-height: min(76vh, 720px); }
@media (max-width: 639px) {
  .fi-ebene-buehne { align-items: flex-end; justify-content: center; padding: 0; }
}

/* ── Die Ebene ─────────────────────────────────────────────────────────── */
.fi-ebene {
  pointer-events: auto;
  width: 100%;
  display: flex; flex-direction: column;
  max-height: min(88vh, 900px);
  overflow: hidden;
  background: #fff;
  /* Vier Schatten übereinander: ein weiter Wurf für die Höhe, ein enger für
     die Kante, ein blauer Schein fürs CI, eine innere Lichtkante oben. Ein
     einzelner Schatten sieht immer nach Vorlage aus. */
  box-shadow:
    0 60px 140px -40px rgba(11,18,38,.55),
    0 18px 44px -22px rgba(11,18,38,.34),
    0 0 0 1px rgba(15,23,42,.07),
    0 0 60px -20px rgba(37,99,235,.22),
    inset 0 1px 0 rgba(255,255,255,.9);
}
.fi-ebene-mitte {
  border-radius: 26px;
  animation: fiEbeneAuf 420ms cubic-bezier(.32,.72,0,1) both;
}
.fi-ebene-blatt {
  border-radius: 26px 26px 0 0;
  max-height: 92vh;
  animation: fiBlattAuf 380ms cubic-bezier(.32,.72,0,1) both;
  transition: transform 260ms cubic-bezier(.32,.72,0,1);
}
.fi-ebene-weg { animation: fiEbeneZu 190ms cubic-bezier(.4,0,1,1) both; }

/* DER EINTRITT AUS DER TIEFE: von 140 px hinter der Bühne, leicht gekippt und
   klein, dem Auge entgegen. Kein Hochschieben, kein Aufpoppen. */
@keyframes fiEbeneAuf {
  from { opacity: 0; transform: translateZ(-140px) translateY(26px) rotateX(7deg) scale(.94); }
  60%  { opacity: 1; }
  to   { opacity: 1; transform: translateZ(0) translateY(0) rotateX(0) scale(1); }
}
@keyframes fiEbeneZu {
  from { opacity: 1; transform: translateZ(0) scale(1); }
  to   { opacity: 0; transform: translateZ(-70px) translateY(14px) scale(.97); }
}
@keyframes fiBlattAuf {
  from { opacity: 0; transform: translateY(46px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Grabber ───────────────────────────────────────────────────────────── */
.fi-ebene-grabber {
  padding: 9px 0 3px; display: flex; justify-content: center; flex-shrink: 0;
  touch-action: none; cursor: grab;
}
.fi-ebene-grabber span {
  display: block; width: 42px; height: 4.5px; border-radius: 99px;
  background: rgba(15,23,42,.16);
}

/* ── Kopf: Glas über dem rollenden Inhalt ──────────────────────────────── */
.fi-ebene-kopf {
  flex-shrink: 0; padding: 18px 24px 15px;
  background: rgba(255,255,255,.72);
  backdrop-filter: blur(16px) saturate(160%);
  -webkit-backdrop-filter: blur(16px) saturate(160%);
  /* Haarlinie plus ein Hauch Schatten nach unten: So sieht man beim Scrollen,
     dass der Kopf ÜBER dem Inhalt liegt. */
  box-shadow: inset 0 -1px 0 rgba(15,23,42,.07), 0 10px 22px -20px rgba(11,18,38,.5);
  position: relative; z-index: 2;
}
@media (max-width: 639px) { .fi-ebene-kopf { padding: 12px 18px 13px; } }

.fi-ebene-ueberschrift {
  font-size: 10.5px; font-weight: 600; letter-spacing: .2em;
  text-transform: uppercase; color: #94a3b8; margin: 0;
}
.fi-ebene-titel {
  font-size: 19px; font-weight: 700; letter-spacing: -.015em;
  color: #0f172a; margin: 1px 0 0; line-height: 1.25;
}
.fi-ebene-unterzeile {
  font-size: 12.5px; color: #64748b; margin: 3px 0 0; line-height: 1.45;
}
.fi-ebene-marke {
  width: 36px; height: 36px; border-radius: 11px;
  display: inline-flex; align-items: center; justify-content: center;
  background: linear-gradient(160deg, rgba(37,99,235,.13), rgba(29,78,216,.07));
  color: #1d4ed8;
  box-shadow: inset 0 0 0 1px rgba(37,99,235,.16);
}
.fi-ebene-kreuz {
  width: 32px; height: 32px; border-radius: 999px;
  display: inline-flex; align-items: center; justify-content: center;
  background: rgba(15,23,42,.045); color: #64748b; border: 0;
  transition: background 160ms, color 160ms, transform 160ms;
}
.fi-ebene-kreuz:hover { background: rgba(15,23,42,.085); color: #0f172a; transform: rotate(90deg); }

/* ── Körper: MASSIV. Text auf Glas ist bei Sonne unlesbar. ─────────────── */
.fi-ebene-koerper {
  flex: 1 1 auto; min-height: 0; overflow-y: auto;
  padding: 18px 24px 22px; background: #fff;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}
@media (max-width: 639px) { .fi-ebene-koerper { padding: 15px 18px 20px; } }

/* ── Fuß: Glas ─────────────────────────────────────────────────────────── */
.fi-ebene-fuss {
  flex-shrink: 0; padding: 15px 24px;
  background: rgba(255,255,255,.78);
  backdrop-filter: blur(16px) saturate(160%);
  -webkit-backdrop-filter: blur(16px) saturate(160%);
  box-shadow: inset 0 1px 0 rgba(15,23,42,.07), 0 -12px 24px -22px rgba(11,18,38,.5);
  position: relative; z-index: 2;
}
@media (max-width: 639px) {
  /* Sicherheitsabstand fürs Telefon: Unter der Fußleiste liegt bei iOS die
     Wischleiste des Systems. */
  .fi-ebene-fuss { padding: 13px 18px calc(13px + env(safe-area-inset-bottom, 0px)); }
}

/* ── Bewegung abschaltbar. Die Tiefe bleibt über die Schatten. ─────────── */
@media (prefers-reduced-motion: reduce) {
  .fi-ebene, .fi-ebene-schleier, .fi-ebene-mitte, .fi-ebene-blatt,
  .fi-ebene-weg, .fi-ebene-schleier-weg {
    animation: none !important; transition: none !important;
  }
  .fi-ebene-kreuz:hover { transform: none; }
}
`;

// ═══════════════════════════════════════════════════════════════════════════
// AUFKLAPPBARE KARTE — für Einwände im Gesprächsblatt und ähnliche Listen
//
// Eine Endloswand aus Text liest niemand. Eine Reihe geschlossener Karten mit
// je einer Frage liest man — und öffnet die eine, die gerade dran ist.
// ═══════════════════════════════════════════════════════════════════════════

export function FiaonKlappe({
  titel, unterzeile, kinder, offenVorgabe = false, aktion,
}: {
  titel: string; unterzeile?: string; kinder: React.ReactNode;
  offenVorgabe?: boolean; aktion?: React.ReactNode;
}) {
  const [auf, setAuf] = useState(offenVorgabe);
  return (
    <div className="fi-klappe" data-auf={auf ? "1" : "0"}>
      <style>{KLAPPE_CSS}</style>
      <button type="button" onClick={() => setAuf((a) => !a)} className="fi-klappe-kopf" aria-expanded={auf}>
        <span className="fi-klappe-winkel" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor"
               strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
            <path d="m7.5 4.5 6 5.5-6 5.5" />
          </svg>
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="fi-klappe-titel">{titel}</span>
          {unterzeile && <span className="fi-klappe-unter">{unterzeile}</span>}
        </span>
      </button>
      <div className="fi-klappe-inhalt">
        <div className="fi-klappe-innen">
          {kinder}
          {aktion && <div className="mt-2">{aktion}</div>}
        </div>
      </div>
    </div>
  );
}

const KLAPPE_CSS = `
.fi-klappe {
  border-radius: 14px; background: #f8fafc;
  box-shadow: inset 0 0 0 1px rgba(15,23,42,.055);
  transition: background 200ms, box-shadow 200ms;
}
.fi-klappe[data-auf="1"] {
  background: #fff;
  box-shadow: 0 10px 26px -18px rgba(11,18,38,.4), inset 0 0 0 1px rgba(37,99,235,.18);
}
.fi-klappe-kopf {
  width: 100%; display: flex; align-items: flex-start; gap: 9px;
  padding: 11px 13px; background: none; border: 0; cursor: pointer; text-align: left;
}
.fi-klappe-winkel {
  color: #94a3b8; margin-top: 1px; flex-shrink: 0;
  transition: transform 240ms cubic-bezier(.32,.72,0,1), color 200ms;
}
.fi-klappe[data-auf="1"] .fi-klappe-winkel { transform: rotate(90deg); color: #1d4ed8; }
.fi-klappe-titel { display: block; font-size: 13px; font-weight: 700; color: #0f172a; line-height: 1.35; }
.fi-klappe-unter { display: block; font-size: 11.5px; color: #94a3b8; margin-top: 1px; }
/* Grid-Trick: Auf- und Zuklappen mit echter Höhenanimation, ohne die Höhe
   in JavaScript zu messen. */
.fi-klappe-inhalt {
  display: grid; grid-template-rows: 0fr;
  transition: grid-template-rows 280ms cubic-bezier(.32,.72,0,1);
}
.fi-klappe[data-auf="1"] .fi-klappe-inhalt { grid-template-rows: 1fr; }
.fi-klappe-innen { overflow: hidden; padding: 0 13px; }
.fi-klappe[data-auf="1"] .fi-klappe-innen { padding-bottom: 13px; }
@media (prefers-reduced-motion: reduce) {
  .fi-klappe, .fi-klappe-winkel, .fi-klappe-inhalt { transition: none !important; }
}
`;
