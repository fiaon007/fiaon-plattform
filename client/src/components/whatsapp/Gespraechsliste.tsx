// ═══════════════════════════════════════════════════════════════════════════
// DIE GESPRÄCHSLISTE (E-248)
//
// · Zeit wie im Telefon: „10:23", „Gestern", „Samstag", sonst „21.09.".
// · Vorschau mit dem, der zuletzt schrieb: „Mara: …", „Florentine: …",
//   „Automatische Antwort · …" — vorher stand „Du: " auch vor Maras Sätzen.
// · Ungelesen als Punkt im Blau-Paar; EINE Stufen-Palette für Liste und Fall
//   (vorher war A links grün und rechts rot).
// ═══════════════════════════════════════════════════════════════════════════
import { listenVorschau, listenZeit, nummerLesbar, stufeKlasse, stufeText, type Gespraech } from "./wr-format";

export type ListenFilter = "alle" | "ungelesen" | "offen";

export function Gespraechsliste({ liste, gewaehlt, onWaehlen, suche, setSuche, filter, setFilter, onNeu, ich }: {
  liste: Gespraech[] | null; gewaehlt: string | null; onWaehlen: (nummer: string) => void;
  suche: string; setSuche: (s: string) => void; filter: ListenFilter; setFilter: (f: ListenFilter) => void;
  onNeu: () => void; ich: number | null;
}) {
  return (
    <aside className="wr-liste" aria-label="Gespräche">
      <div className="wr-suchfeld">
        <input type="search" value={suche} onChange={(e) => setSuche(e.target.value)} placeholder="Suchen" aria-label="Gespräche durchsuchen: Name, Nummer oder Text" />
        <button type="button" className="wr-neu" onClick={onNeu} title="Neues Gespräch beginnen" aria-label="Neues Gespräch beginnen">
          <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true"><path d="M9 3.5v11M3.5 9h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        </button>
      </div>
      <div className="wr-filter" role="group" aria-label="Filter">
        {([["alle", "Alle"], ["ungelesen", "Ungelesen"], ["offen", "Fenster offen"]] as const).map(([k, t]) => (
          <button key={k} type="button" className={filter === k ? "an" : ""} aria-pressed={filter === k} onClick={() => setFilter(k)}>{t}</button>
        ))}
      </div>
      <div className="wr-zeilen">
        {!liste ? <p className="wr-leer">Lädt …</p>
          : liste.length === 0 ? <p className="wr-leer">{suche || filter !== "alle" ? "Nichts gefunden." : "Noch kein Gespräch. Sobald jemand schreibt oder Mara jemanden anschreibt, steht es hier."}</p>
            : liste.map((g) => {
              const v = listenVorschau(g);
              return (
                <button key={g.nummer} type="button" className={`wr-zeile${g.nummer === gewaehlt ? " an" : ""}${g.ungelesen ? " ungelesen" : ""}`}
                  onClick={() => onWaehlen(g.nummer)} aria-current={g.nummer === gewaehlt ? "true" : undefined}>
                  <span className="wr-avatar" aria-hidden="true">{(g.name ?? "?").slice(0, 1).toUpperCase()}</span>
                  <span className="wr-zeile-text">
                    <span className="wr-zeile-kopf">
                      <b>{g.name ?? nummerLesbar(g.nummer)}</b>
                      <time className="wr-zeile-zeit" dateTime={g.letzte.am}>{listenZeit(g.letzte.am)}</time>
                    </span>
                    <span className="wr-zeile-unten">
                      <span className={`wr-vorschau${g.letzte.auto ? " auto" : ""}`}>
                        {v.wer && <em>{v.wer}{v.wer === "Automatische Antwort" ? " · " : ": "}</em>}{v.text}
                      </span>
                      {g.ungelesen > 0 && <span className="wr-punkt" aria-label={`${g.ungelesen} ungelesen`}>{g.ungelesen}</span>}
                    </span>
                    <span className="wr-marken">
                      {g.stufe && <span className={`wr-marke stufe-${stufeKlasse(g.stufe)}`}>{g.stufe === "Kunde" ? "Kunde" : stufeText(g.stufe).replace("Stufe ", "")}</span>}
                      {g.fensterBis && <span className="wr-marke offen">Fenster offen</span>}
                      {!g.maraAn && <span className="wr-marke">Mara aus</span>}
                      {g.bearbeiter && ich !== g.bearbeiter.id && <span className="wr-marke warn">jemand liest mit</span>}
                    </span>
                  </span>
                </button>
              );
            })}
      </div>
    </aside>
  );
}
