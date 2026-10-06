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
// ═══════════════════════════════════════════════════════════════════════════
import { useId, useRef } from "react";
import { useEinmalSichtbar } from "@/components/site/global/bewegung";

export interface BuergschaftTexte {
  auge: string; h2: string; text: string;
  schaubild: { titel: string; institut: string; gesellschaft: string; buergin: string; sie: string; finanzierung: string; buergschaft: string; rueckgriff: string };
  plakette: string;
  gilt: { titel: string; punkte: readonly string[] };
  aufruf: string; knopf: string;
}

/** Die Plakette: drei Haarlinien-Ringe, Ringschrift, Monogramm. */
export function Plakette({ text, groesse = 120 }: { text: string; groesse?: number }) {
  const id = useId().replace(/:/g, "");
  const initialen = text.split(/\s+/).filter((w) => /^[A-ZÄÖÜ]/.test(w) && w !== "LLC").slice(0, 2).map((w) => w[0]).join("");
  return (
    <span className="fg-plakette" style={{ width: groesse, height: groesse }} aria-hidden="true">
      <svg viewBox="0 0 120 120">
        <defs><path id={`ring-${id}`} d="M60 60 m-41 0 a41 41 0 1 1 82 0 a41 41 0 1 1 -82 0" /></defs>
        <circle cx="60" cy="60" r="56" className="r1" />
        <circle cx="60" cy="60" r="50" className="r2" />
        <circle cx="60" cy="60" r="32" className="r3" />
        {/* Einmal rundherum, gleichmäßig gesperrt (textLength = Umfang des Rings). */}
        <text className="ring"><textPath href={`#ring-${id}`} startOffset="0" textLength={Math.round(2 * Math.PI * 41) - 6} lengthAdjust="spacing">{`${text} · `}</textPath></text>
        <text x="60" y="67" textAnchor="middle" className="mono">{initialen}</text>
      </svg>
    </span>
  );
}

/** „Wer bürgt wofür“: vier Kästen, drei Pfeile — Institut, Ihre Gesellschaft, Bürgin, Sie. */
function Schaubild({ s }: { s: BuergschaftTexte["schaubild"] }) {
  const pfeil = useId().replace(/:/g, "");
  return (
    <figure className="fg-schaubild" role="img" aria-label={s.titel}>
      <svg viewBox="0 0 600 300" className="d" aria-hidden="true">
        <defs><marker id={pfeil} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L8 4 L0 8" /></marker></defs>
        <rect x="200" y="20" width="120" height="44" rx="10" /><text x="260" y="47" textAnchor="middle">{s.institut}</text>
        <rect x="180" y="128" width="160" height="44" rx="10" /><text x="260" y="155" textAnchor="middle">{s.gesellschaft}</text>
        <rect x="372" y="128" width="140" height="56" rx="10" className="buergin" />
        <text x="442" y="152" textAnchor="middle">{s.buergin.split(" · ")[0]}</text>
        <text x="442" y="170" textAnchor="middle" className="klein">{s.buergin.split(" · ")[1] ?? ""}</text>
        <rect x="220" y="236" width="80" height="40" rx="10" /><text x="260" y="261" textAnchor="middle">{s.sie}</text>
        <line x1="260" y1="172" x2="260" y2="236" className="gesellschafter" />
        <path d="M260 64 L260 126" markerEnd={`url(#${pfeil})`} className="pfeil" pathLength={1} />
        <text x="268" y="100" className="klein">{s.finanzierung}</text>
        <path d="M442 128 C442 70 400 42 322 42" markerEnd={`url(#${pfeil})`} className="pfeil" pathLength={1} />
        <text x="446" y="88" className="klein">{s.buergschaft}</text>
        <path d="M400 184 C380 210 330 200 300 172" markerEnd={`url(#${pfeil})`} className="pfeil gestrichelt" />
        <text x="352" y="222" className="klein">{s.rueckgriff}</text>
      </svg>
      <svg viewBox="0 0 343 340" className="m" aria-hidden="true">
        <defs><marker id={`${pfeil}m`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L8 4 L0 8" /></marker></defs>
        <rect x="111" y="10" width="120" height="44" rx="10" /><text x="171" y="37" textAnchor="middle">{s.institut}</text>
        <rect x="91" y="118" width="160" height="44" rx="10" /><text x="171" y="145" textAnchor="middle">{s.gesellschaft}</text>
        <rect x="8" y="230" width="150" height="56" rx="10" className="buergin" />
        <text x="83" y="254" textAnchor="middle">{s.buergin.split(" · ")[0]}</text>
        <text x="83" y="272" textAnchor="middle" className="klein">{s.buergin.split(" · ")[1] ?? ""}</text>
        <rect x="231" y="236" width="80" height="40" rx="10" /><text x="271" y="261" textAnchor="middle">{s.sie}</text>
        <path d="M216 162 L262 236" className="gesellschafter" />
        <path d="M171 54 L171 116" markerEnd={`url(#${pfeil}m)`} className="pfeil" />
        <text x="179" y="90" className="klein">{s.finanzierung}</text>
        <path d="M30 230 C10 140 40 40 109 32" markerEnd={`url(#${pfeil}m)`} className="pfeil" />
        <text x="34" y="186" className="klein">{s.buergschaft.split(" ").slice(0, 1).join(" ")}</text>
        <text x="34" y="199" className="klein">{s.buergschaft.split(" ").slice(1).join(" ")}</text>
        <path d="M120 230 L150 164" markerEnd={`url(#${pfeil}m)`} className="pfeil gestrichelt" />
        <text x="158" y="214" className="klein">{s.rueckgriff}</text>
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
