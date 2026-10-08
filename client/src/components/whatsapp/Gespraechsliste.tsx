// ═══════════════════════════════════════════════════════════════════════════
// DIE GESPRÄCHSLISTE (E-248)
//
// · Zeit wie im Telefon: „10:23", „Gestern", „Samstag", sonst „21.09.".
// · Vorschau mit dem, der zuletzt schrieb: „Mara: …", „Florentine: …",
//   „Automatische Antwort · …" — vorher stand „Du: " auch vor Maras Sätzen.
// · Ungelesen als Punkt im Blau-Paar; EINE Stufen-Palette für Liste und Fall
//   (vorher war A links grün und rechts rot).
//
// E-IT-H (08.10.2026, Punkt 15):
// · Filter aus shared/fiaon-wa-raum.ts — Standard „Mit Antwort" (Gespräche, in
//   denen der Kunde geschrieben hat; 63 % der Zeilen waren reine Vorlagen
//   ohne Antwort), „Alle" ist ein Klick.
// · « macht die Liste zur SCHIENE: nur Bild, Ungelesen-Zahl und grüner
//   Fenster-Punkt — der Chat bekommt die Breite. » klappt sie wieder auf.
// · Am Ende „Ältere Gespräche laden" (je 200, höchstens 1.000), solange der
//   Server sagt, dass es mehr gibt.
// · Gegenprüfung (08.10.2026): Eine Suche läuft über ALLE eigenen Gespräche —
//   „Mit Antwort" gilt beim Suchen nicht (wirksamerFilter, dieselbe Regel wie
//   der Server). Vorher fand die Suche im Standard niemanden, dem bisher nur
//   wir geschrieben hatten, sagte „Nichts gefunden" und bot keinen Ausweg —
//   der Mitarbeiter begann dann über „+" ein zweites Gespräch mit einer
//   weiteren, bezahlten Vorlage. Bei „Ungelesen"/„Fenster offen" bietet die
//   leere Liste „In allen Gesprächen suchen".
// ═══════════════════════════════════════════════════════════════════════════
import { LISTEN_FILTER, STANDARD_FILTER, wirksamerFilter, type ListenFilter } from "@shared/fiaon-wa-raum";
import { listenVorschau, listenZeit, nummerLesbar, stufeKlasse, stufeText, type Gespraech } from "./wr-format";

export type { ListenFilter };

const Plus = () => (
  <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true"><path d="M9 3.5v11M3.5 9h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
);
const Pfeil = ({ rechts }: { rechts?: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true" style={rechts ? { transform: "scaleX(-1)" } : undefined}>
    <path d="M9.5 4.5 5 9l4.5 4.5M13.5 4.5 9 9l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const anfang = (g: Gespraech) => (g.name ?? "?").trim().slice(0, 1).toUpperCase() || "?";

export function Gespraechsliste({ liste, gewaehlt, onWaehlen, suche, setSuche, filter, setFilter, onNeu, ich, schmal = false, onSchmal, mehr = false, onMehr, gekappt = false }: {
  liste: Gespraech[] | null; gewaehlt: string | null; onWaehlen: (nummer: string) => void;
  suche: string; setSuche: (s: string) => void; filter: ListenFilter; setFilter: (f: ListenFilter) => void;
  onNeu: () => void; ich: number | null;
  /** E-IT-H: als Schiene (nur Bilder). */
  schmal?: boolean;
  /** Umschalten Liste ↔ Schiene — fehlt am Handy (dort gibt es keine Schiene). */
  onSchmal?: (an: boolean) => void;
  /** Der Server hat mehr Gespräche, als geladen sind. */
  mehr?: boolean; onMehr?: () => void;
  /** Es gibt mehr, aber die Höchstgrenze (1.000) ist geladen — ältere nur über die Suche. */
  gekappt?: boolean;
}) {
  // ── Die Schiene ──────────────────────────────────────────────────────────
  if (schmal) {
    return (
      <aside className="wr-liste schmal" aria-label="Gespräche (schmal)">
        <div className="wr-schiene-kopf">
          {onSchmal && (
            <button type="button" className="wr-ikon wr-liste-klapp" onClick={() => onSchmal(false)} title="Liste wieder ausklappen" aria-label="Liste ausklappen">
              <Pfeil rechts />
            </button>
          )}
          <button type="button" className="wr-neu" onClick={onNeu} title="Neues Gespräch beginnen" aria-label="Neues Gespräch beginnen"><Plus /></button>
        </div>
        <div className="wr-zeilen">
          {!liste ? <p className="wr-leer" aria-live="polite">…</p>
            : liste.map((g) => {
              const v = listenVorschau(g);
              const name = g.name ?? nummerLesbar(g.nummer);
              return (
                <button key={g.nummer} type="button" className={`wr-rund${g.nummer === gewaehlt ? " an" : ""}`}
                  onClick={() => onWaehlen(g.nummer)} aria-current={g.nummer === gewaehlt ? "true" : undefined}
                  title={`${name} — ${v.wer ? `${v.wer}: ` : ""}${v.text}`}
                  aria-label={`${name}${g.ungelesen ? `, ${g.ungelesen} ungelesen` : ""}${g.fensterBis ? ", Fenster offen" : ""}`}>
                  <span className="wr-avatar" aria-hidden="true">{anfang(g)}</span>
                  {g.ungelesen > 0 && <span className="wr-punkt" aria-hidden="true">{g.ungelesen}</span>}
                  {g.fensterBis && <span className="wr-offen-punkt" aria-hidden="true" />}
                </button>
              );
            })}
          {mehr && onMehr && (
            <button type="button" className="wr-ikon wr-mehr-rund" onClick={onMehr} title="Ältere Gespräche laden" aria-label="Ältere Gespräche laden">
              <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true"><path d="M9 4v10M4.5 9.5 9 14l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          )}
        </div>
      </aside>
    );
  }

  // ── Die volle Liste ──────────────────────────────────────────────────────
  // Was wirklich gilt (beim Suchen nie „Mit Antwort") — der Knopf zeigt es, die leere Liste sagt es.
  const sucht = suche.trim() !== "";
  const wirksam = wirksamerFilter(filter, suche);
  const filterName = LISTEN_FILTER.find((f) => f.wert === wirksam)?.text ?? "";
  const leerText = sucht
    ? wirksam === "alle"
      ? "Nichts gefunden, auch nicht in Gesprächen ohne Antwort. Gesucht wird nach Name und Nummer, ab vier Zeichen auch in allen Nachrichten."
      : `Unter „${filterName}“ nichts gefunden.`
    : filter === "antwort"
      ? "Noch kein Gespräch, in dem ein Kunde selbst geschrieben hat."
      : filter !== "alle" ? "Nichts gefunden."
        : "Noch kein Gespräch. Sobald jemand schreibt oder Mara jemanden anschreibt, steht es hier.";
  return (
    <aside className="wr-liste" aria-label="Gespräche">
      <div className="wr-suchfeld">
        <input type="search" value={suche} onChange={(e) => setSuche(e.target.value)} placeholder="Suchen" aria-label="Gespräche durchsuchen: Name, Nummer oder Text" />
        <button type="button" className="wr-neu" onClick={onNeu} title="Neues Gespräch beginnen" aria-label="Neues Gespräch beginnen"><Plus /></button>
        {onSchmal && (
          <button type="button" className="wr-ikon wr-liste-klapp" onClick={() => onSchmal(true)} title="Liste schmal machen — mehr Platz für den Chat" aria-label="Liste schmal machen">
            <Pfeil />
          </button>
        )}
      </div>
      <div className="wr-filter" role="group" aria-label="Filter">
        {LISTEN_FILTER.map((f) => {
          // Beim Suchen kann „Mit Antwort“ nichts ändern — dann ist er still, statt ins Leere zu klicken.
          const still = sucht && f.wert === "antwort";
          return (
            <button key={f.wert} type="button" className={wirksam === f.wert ? "an" : ""} aria-pressed={wirksam === f.wert} disabled={still}
              title={still ? "Beim Suchen zählen alle Gespräche — ohne Suchtext gilt wieder „Mit Antwort“" : f.titel} onClick={() => setFilter(f.wert)}>{f.text}</button>
          );
        })}
        {/* Im Filterblock, nicht daneben: die Liste ist ein Raster aus drei Zeilen (Suche · Filter · Zeilen). */}
        {sucht && wirksam !== filter && (
          <p className="wr-still wr-filter-hinweis">Die Suche läuft über alle deine Gespräche, auch die ohne Antwort.</p>
        )}
      </div>
      <div className="wr-zeilen">
        {!liste ? <p className="wr-leer">Lädt …</p>
          : liste.length === 0 ? (
            <div className="wr-leer">
              <p>{leerText}</p>
              {wirksam !== "alle" && (
                <button type="button" className="wr-klein wr-leer-knopf" onClick={() => setFilter("alle")}>
                  {sucht ? "In allen Gesprächen suchen" : "Alle Gespräche zeigen"}
                </button>
              )}
            </div>
          )
            : liste.map((g) => {
              const v = listenVorschau(g);
              return (
                <button key={g.nummer} type="button" className={`wr-zeile${g.nummer === gewaehlt ? " an" : ""}${g.ungelesen ? " ungelesen" : ""}`}
                  onClick={() => onWaehlen(g.nummer)} aria-current={g.nummer === gewaehlt ? "true" : undefined}>
                  <span className="wr-avatar" aria-hidden="true">{anfang(g)}</span>
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
        {liste && liste.length > 0 && mehr && onMehr && (
          <div className="wr-mehr-zeile">
            <button type="button" className="wr-klein" onClick={onMehr}>Ältere Gespräche laden</button>
          </div>
        )}
        {liste && liste.length > 0 && gekappt && (
          <p className="wr-still wr-ende">Ältere Gespräche findest du über die Suche.</p>
        )}
        {liste && liste.length > 0 && !mehr && !gekappt && filter === STANDARD_FILTER && !sucht && (
          <p className="wr-still wr-ende">Das sind alle Gespräche mit Antwort. Nur angeschrieben, ohne Antwort: Filter „Alle“.</p>
        )}
      </div>
    </aside>
  );
}
