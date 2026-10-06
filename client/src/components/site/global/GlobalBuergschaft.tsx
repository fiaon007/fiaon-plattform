// ═══════════════════════════════════════════════════════════════════════════
// DAS PERSÖNLICHE ANGEBOT MIT BÜRGSCHAFTSZUSAGE (06.10.2026, E-293)
//
// Wortlaut, Schalter und Begründung: GLOBAL_BUERGSCHAFT_SEITE in
// shared/fiaon-global.ts (Start: aus). Diese Komponente zeigt ihn ruhig auf
// Papier — keine Glasfläche, keine Tafel-Optik, damit er nicht wie ein fünftes
// Paket wirkt. Links Text, Plakette und das Schaubild „Wer bürgt wofür“, rechts
// „Was dabei gilt“ mit allen fünf Bedingungen, der Verbindungssatz und der
// Aufruf — alles in einem Bildschirm, nichts geklappt (Blickfang-Regel, BGH
// I ZR 194/06): Die Bedingungen stehen im selben Sichtfeld wie die Zusage.
//
// Das Schaubild sagt, was der Satz sagt: Das Institut finanziert Ihre
// Gesellschaft, die Bürgin bürgt auf Anforderung gegenüber dem Institut, ein
// Rückgriff geht nur auf die Gesellschaft. Zwischen Bürgin und „Sie“ gibt es
// absichtlich KEINE Linie. Die Plakette ist reines SVG im Uhren-Metall: keine
// Rosette, kein Adler, keine Sterne, kein Wort wie „geprüft“.
//
// 06.10.2026 (E-293, Scheibe B): Der Block bleibt aus (GLOBAL_BUERGSCHAFT_SEITE
// .aktiv = false), ist aber fertig bewegt — Schaubild und Plakette laufen
// einmal, sobald der Abschnitt data-an="1" trägt (Ablauf an den Funktionen).
// ═══════════════════════════════════════════════════════════════════════════
import { useId, useRef, type ReactNode } from "react";
import { useEinmalSichtbar, useNeigung } from "@/components/site/global/bewegung";

export interface BuergschaftTexte {
  auge: string; h2: string; text: string;
  schaubild: { titel: string; institut: string; gesellschaft: string; buergin: string; sie: string; finanzierung: string; buergschaft: string; rueckgriff: string };
  plakette: string;
  gilt: { titel: string; punkte: readonly string[] };
  aufruf: string; knopf: string;
}

/** Die Plakette: drei Haarlinien-Ringe, Ringschrift, Monogramm. Bewegung (Scheibe B, 06.10.2026): beim Hineinscrollen
 *  einmal „Prägung“ (scale 1.06 → 1, der weite Schatten zieht sich zusammen), danach ein Lichtstreif; mit Maus neigt sie
 *  sich ±4° (useNeigung). Keine Schleife. */
export function Plakette({ text, groesse = 120 }: { text: string; groesse?: number }) {
  const id = useId().replace(/:/g, "");
  const ref = useRef<HTMLSpanElement>(null);
  useNeigung(ref);
  const initialen = text.split(/\s+/).filter((w) => /^[A-ZÄÖÜ]/.test(w) && w !== "LLC").slice(0, 2).map((w) => w[0]).join("");
  return (
    <span ref={ref} className="fg-plakette-buehne" style={{ width: groesse, height: groesse }} aria-hidden="true">
      <span className="fg-plakette">
        <svg viewBox="0 0 120 120">
          <defs><path id={`ring-${id}`} d="M60 60 m-41 0 a41 41 0 1 1 82 0 a41 41 0 1 1 -82 0" /></defs>
          <circle cx="60" cy="60" r="56" className="r1" />
          <circle cx="60" cy="60" r="50" className="r2" />
          <circle cx="60" cy="60" r="32" className="r3" />
          {/* Einmal rundherum, gleichmäßig gesperrt (textLength = Umfang des Rings). */}
          <text className="ring"><textPath href={`#ring-${id}`} startOffset="0" textLength={Math.round(2 * Math.PI * 41) - 6} lengthAdjust="spacing">{`${text} · `}</textPath></text>
          <text x="60" y="67" textAnchor="middle" className="mono">{initialen}</text>
        </svg>
        <span className="fg-plakette-licht" />
      </span>
    </span>
  );
}

type Punkt = readonly [number, number];
/** Pfeilspitze (6 px lang, 8 px breit) am Ende `ende`, ausgerichtet an der Tangente vom Punkt `vor`. Als eigener Pfad
 *  statt marker-end: Ein Marker stünde schon da, bevor sich die Linie gezeichnet hat (06.10.2026, Scheibe B). */
function spitze([ex, ey]: Punkt, [vx, vy]: Punkt): string {
  const l = Math.hypot(ex - vx, ey - vy) || 1;
  const dx = (ex - vx) / l, dy = (ey - vy) / l;
  const bx = ex - dx * 6, by = ey - dy * 6;
  const f = (n: number) => n.toFixed(1);
  return `M${f(bx - dy * 4)} ${f(by + dx * 4)} L${ex} ${ey} L${f(bx + dy * 4)} ${f(by - dx * 4)}`;
}

/** Ein Pfeil des Schaubilds: Linie (zeichnet sich), Spitze und Beschriftung (blenden danach ein). `n` = Reihenfolge. */
function Pfeil({ d, ende, vor, n, gestrichelt, children }: { d: string; ende: Punkt; vor: Punkt; n: number; gestrichelt?: boolean; children: ReactNode }) {
  // Gestrichelt (Rückgriff): Die Linie zeichnet sich durchgezogen (stroke-dasharray wird fürs Zeichnen gebraucht und
  // kann nicht zugleich „4 4“ sein); eine Maske mit Strichen 4 4 lässt nur die Striche durch. 06.10.2026 (E-293): Maske
  // statt einer darübergelegten Linie in Papierfarbe — die stimmte nur auf dem Hintergrund --stein.
  const maske = `fg-rueckgriff-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <g className={`fg-pfeil p${n}${gestrichelt ? " gestrichelt" : ""}`}>
      {gestrichelt && (
        <mask id={maske} maskUnits="userSpaceOnUse" x="-20" y="-20" width="640" height="400">
          <path d={d} className="luecken" />
        </mask>
      )}
      <path d={d} className="pfeil" pathLength={1} mask={gestrichelt ? `url(#${maske})` : undefined} />
      <path d={spitze(ende, vor)} className="spitze" />
      <g className="beschriftung">{children}</g>
    </g>
  );
}

/** „Wer bürgt wofür“: vier Kästen, drei Pfeile — Institut, Ihre Gesellschaft, Bürgin, Sie.
 *  Ablauf bei data-an (Scheibe B): Kästen blenden ein (300 ms), dann zeichnen sich Finanzierung, Bürgschaft und
 *  Rückgriff nacheinander (je 500 ms, 150 ms Abstand), jede Beschriftung nach ihrem Pfeil. Zwischen Bürgin und „Sie“
 *  gibt es keine Linie. */
function Schaubild({ s }: { s: BuergschaftTexte["schaubild"] }) {
  return (
    <figure className="fg-schaubild" role="img" aria-label={s.titel}>
      <svg viewBox="0 0 600 300" className="d" aria-hidden="true">
        <g className="kaesten">
          <rect x="200" y="20" width="120" height="44" rx="10" /><text x="260" y="47" textAnchor="middle">{s.institut}</text>
          <rect x="180" y="128" width="160" height="44" rx="10" /><text x="260" y="155" textAnchor="middle">{s.gesellschaft}</text>
          <rect x="372" y="128" width="140" height="56" rx="10" className="buergin" />
          <text x="442" y="152" textAnchor="middle">{s.buergin.split(" · ")[0]}</text>
          <text x="442" y="170" textAnchor="middle" className="klein">{s.buergin.split(" · ")[1] ?? ""}</text>
          <rect x="220" y="236" width="80" height="40" rx="10" /><text x="260" y="261" textAnchor="middle">{s.sie}</text>
          <line x1="260" y1="172" x2="260" y2="236" className="gesellschafter" />
        </g>
        <Pfeil n={1} d="M260 64 L260 126" ende={[260, 126]} vor={[260, 64]}><text x="268" y="100" className="klein">{s.finanzierung}</text></Pfeil>
        <Pfeil n={2} d="M442 128 C442 70 400 42 322 42" ende={[322, 42]} vor={[400, 42]}><text x="446" y="88" className="klein">{s.buergschaft}</text></Pfeil>
        <Pfeil n={3} d="M400 184 C380 210 330 200 300 172" ende={[300, 172]} vor={[330, 200]} gestrichelt><text x="352" y="222" className="klein">{s.rueckgriff}</text></Pfeil>
      </svg>
      <svg viewBox="0 0 343 340" className="m" aria-hidden="true">
        <g className="kaesten">
          <rect x="111" y="10" width="120" height="44" rx="10" /><text x="171" y="37" textAnchor="middle">{s.institut}</text>
          <rect x="91" y="118" width="160" height="44" rx="10" /><text x="171" y="145" textAnchor="middle">{s.gesellschaft}</text>
          <rect x="8" y="230" width="150" height="56" rx="10" className="buergin" />
          <text x="83" y="254" textAnchor="middle">{s.buergin.split(" · ")[0]}</text>
          <text x="83" y="272" textAnchor="middle" className="klein">{s.buergin.split(" · ")[1] ?? ""}</text>
          <rect x="231" y="236" width="80" height="40" rx="10" /><text x="271" y="261" textAnchor="middle">{s.sie}</text>
          {/* Gesellschafter-Linie steiler und weiter rechts: Die Beschriftung „Rückgriff …“ lief am Handy durch sie hindurch
              (06.10.2026, Scheibe B); die Beschriftung steht jetzt zweizeilig zwischen Pfeil und Linie. */}
          <path d="M240 162 L271 236" className="gesellschafter" />
        </g>
        <Pfeil n={1} d="M171 54 L171 116" ende={[171, 116]} vor={[171, 54]}><text x="179" y="90" className="klein">{s.finanzierung}</text></Pfeil>
        <Pfeil n={2} d="M30 230 C10 140 40 40 109 32" ende={[109, 32]} vor={[40, 40]}>
          <text x="34" y="186" className="klein">{s.buergschaft.split(" ").slice(0, 1).join(" ")}</text>
          <text x="34" y="199" className="klein">{s.buergschaft.split(" ").slice(1).join(" ")}</text>
        </Pfeil>
        <Pfeil n={3} d="M120 230 L150 164" ende={[150, 164]} vor={[120, 230]} gestrichelt><text x="156" y="200" className="klein">{s.rueckgriff.split(" ").slice(0, 2).join(" ")}</text>
          <text x="156" y="213" className="klein">{s.rueckgriff.split(" ").slice(2).join(" ")}</text>
        </Pfeil>
      </svg>
    </figure>
  );
}

export default function GlobalBuergschaft({ texte, verbunden, onGespraech }: { texte: BuergschaftTexte; verbunden: string; onGespraech: () => void }) {
  const ref = useRef<HTMLElement>(null);
  useEinmalSichtbar(ref);
  return (
    <section ref={ref} id="persoenliches-angebot" className="fg-sek stein fg-buergschaft" style={{ scrollMarginTop: 72 }}>
      {/* Desktop: links Text und Bild, rechts die Bedingungen. Handy: die Bedingungen unmittelbar nach dem Text, das Bild danach. */}
      <div className="fg-rahmen fg-buergschaft-raster">
        <div className="fg-buergschaft-text">
          {/* Am Handy steht die Plakette (88 px) neben der Überschrift statt in einer eigenen Zeile — der Block war
              dort 1.836 px hoch (06.10.2026, Gutachten; aria-hidden, also kein doppelter Inhalt). */}
          <div className="fg-buergschaft-kopf">
            <div><span className="fg-auge">{texte.auge}</span><h2 className="fg-h2">{texte.h2}</h2></div>
            <span className="fg-buergschaft-plakette-m"><Plakette text={texte.plakette} groesse={88} /></span>
          </div>
          <p className="fg-lead">{texte.text}</p>
        </div>
        <div className="fg-buergschaft-bild">
          <span className="fg-buergschaft-plakette-d"><Plakette text={texte.plakette} /></span>
          <Schaubild s={texte.schaubild} />
        </div>
        <aside className="fg-buergschaft-gilt" aria-label={texte.gilt.titel}>
          <h3>{texte.gilt.titel}</h3>
          <ul>{texte.gilt.punkte.map((p) => <li key={p}>{p}</li>)}</ul>
          <p className="fg-buergschaft-verbunden">{verbunden}</p>
          <p className="fg-buergschaft-aufruf">{texte.aufruf}</p>
          <button type="button" className="fg-knopf" onClick={onGespraech}>{texte.knopf}</button>
        </aside>
      </div>
    </section>
  );
}
