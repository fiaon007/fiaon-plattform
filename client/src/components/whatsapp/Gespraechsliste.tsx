// ═══════════════════════════════════════════════════════════════════════════
// DIE GESPRÄCHSLISTE (E-248 · E-IT-H · Neubau 20.10.2026)
//
// Justin, 20.10.2026: „mach das bitte neu und richtig – das es schön, cleanes
// WhatsApp ist, wie man es kennt … aber viel übersichtlicher".
//
// NEU wie bei WhatsApp:
// · Kopf mit „WhatsApp", Stift (neues Gespräch) und ⋮ (Schrift, Liste schmal,
//   Maras Schritte, Rundgang) — vorher eine Knopfwand über dem Raum.
// · EINE Reihe Chips statt 2 × 2 Knöpfen: Mit Antwort · Alle · Ungelesen ·
//   Wartet · Fenster offen („Wartet" = der Kunde schrieb zuletzt, niemand
//   antwortete). Reicht die Breite nicht, rollt die Reihe seitlich.
// · Zeile in ZWEI Zeilen: rundes Bild (Initialen, grüner Punkt = Fenster
//   offen), Name mit kleiner Stufe, Zeit rechts; darunter Häkchen, wer
//   schrieb, eine Zeile Vorschau, rechts ein Zeichen (✦ Mara antwortet ·
//   Person = ein Mensch) und die Ungelesen-Zahl. Vorher drei Zeilen mit
//   Chips „Fenster offen · Mara aus · jemand liest mit" an fast jeder Zeile.
// · „liest mit" nur noch, solange es stimmt (zwei Minuten, liestMit in shared),
//   als kleines Auge mit Namen im Titel.
//
// BLEIBT (E-IT-H, Gegenprüfung 08.10.2026): Standard „Mit Antwort"; beim
// Suchen gilt er nicht (wirksamerFilter) — die Suche läuft über ALLE eigenen
// Gespräche, der Chip ruht, eine Zeile sagt warum. Bei „Ungelesen" o. ä. bietet
// die leere Liste „In allen Gesprächen suchen". „Ältere Gespräche laden" je 200
// bis 1.000, danach der Weg über die Suche. Die Schiene (nur Bilder) bleibt.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from "react";
import { LISTEN_FILTER, STANDARD_FILTER, liestMit, wirksamerFilter, type ListenFilter } from "@shared/fiaon-wa-raum";
import { hakenStufe, listenVorschau, listenZeit, nummerLesbar, stufeKlasse, type Gespraech, type MedienArt } from "./wr-format";
import { Avatar } from "./Avatar";
import {
  ZAuge, ZBild, ZDokument, ZFrage, ZFunke, ZHaken, ZKlappeLinks, ZKlappeRechts, ZMenue, ZMikro, ZNeu, ZOrt, ZPerson,
  ZSchliessen, ZSchrift, ZSchritte, ZSuche, ZVideo, ZVorlage, ZWarnung, ZLaden,
} from "./Symbole";

export type { ListenFilter };

export interface RaumMenueWahl {
  schriftGross: boolean; onSchrift: () => void;
  alleSchritte: boolean; onAlleSchritte: () => void;
  onRundgang: () => void;
}

/** Das kleine Medien-Zeichen vor der Vorschau („📷 Foto"). */
function MedienZeichen({ art }: { art: MedienArt | null }) {
  if (art === "bild" || art === "sticker") return <ZBild g={15} className="wr-vz" />;
  if (art === "audio") return <ZMikro g={15} className="wr-vz" />;
  if (art === "video") return <ZVideo g={15} className="wr-vz" />;
  if (art === "dokument") return <ZDokument g={15} className="wr-vz" />;
  if (art === "standort") return <ZOrt g={15} className="wr-vz" />;
  if (art === "kontakt") return <ZPerson g={15} className="wr-vz" />;
  return null;
}

/** Die Stufe als kleines Zeichen am Namen: A · B · C · Kunde. */
export function Stufe({ stufe }: { stufe: string | null | undefined }) {
  if (!stufe) return null;
  const k = stufeKlasse(stufe);
  return (
    <span className={`wr-stufe stufe-${k}`} title={stufe === "Kunde" ? "Kunde (bezahlt)" : `Stufe ${stufe}`}>
      {stufe === "Kunde" ? "Kunde" : stufe}
    </span>
  );
}

/** Das ⋮-Menü oben in der Liste. */
function RaumMenue({ wahl, onSchmal }: { wahl: RaumMenueWahl; onSchmal?: () => void }) {
  const [auf, setAuf] = useState(false);
  const halter = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!auf) return;
    const klick = (e: PointerEvent) => { if (halter.current && !halter.current.contains(e.target as Node)) setAuf(false); };
    const taste = (e: KeyboardEvent) => { if (e.key === "Escape") setAuf(false); };
    window.addEventListener("pointerdown", klick);
    window.addEventListener("keydown", taste);
    return () => { window.removeEventListener("pointerdown", klick); window.removeEventListener("keydown", taste); };
  }, [auf]);
  const und = (f: () => void) => () => { setAuf(false); f(); };
  return (
    <div className="wr-menue-halter" ref={halter}>
      <button type="button" className={`wr-ikon wr-menue-knopf${auf ? " an" : ""}`} aria-haspopup="menu" aria-expanded={auf}
        aria-label="Menü: Schrift, Liste, Maras Schritte, Rundgang" title="Menü" onClick={() => setAuf(!auf)}>
        <ZMenue />
      </button>
      {auf && (
        <div className="wr-menue" role="menu">
          <button type="button" role="menuitemcheckbox" aria-checked={wahl.schriftGross} className="wr-menue-punkt wr-schrift-knopf"
            title="Schrift und Blasen im ganzen Raum größer — dein Browser merkt es sich" onClick={und(wahl.onSchrift)}>
            <ZSchrift g={18} /><span>Schrift größer</span>{wahl.schriftGross && <i className="wr-haekchen" aria-hidden="true">✓</i>}
          </button>
          {onSchmal && (
            <button type="button" role="menuitem" className="wr-menue-punkt wr-liste-klapp" title="Nur die Bilder zeigen — mehr Platz für den Chat" onClick={und(onSchmal)}>
              <ZKlappeLinks g={18} /><span>Liste schmal</span>
            </button>
          )}
          <button type="button" role="menuitemcheckbox" aria-checked={wahl.alleSchritte} className="wr-menue-punkt wr-schritte-knopf"
            title="Was Mara intern getan hat (Zeiten geholt, Termin eingetragen …) überall aufgeklappt zeigen" onClick={und(wahl.onAlleSchritte)}>
            <ZSchritte g={18} /><span>Maras Schritte zeigen</span>{wahl.alleSchritte && <i className="wr-haekchen" aria-hidden="true">✓</i>}
          </button>
          <button type="button" role="menuitem" className="wr-menue-punkt wr-rundgang-knopf" title="Der Raum erklärt sich Schritt für Schritt" onClick={und(wahl.onRundgang)}>
            <ZFrage g={18} /><span>Rundgang</span>
          </button>
        </div>
      )}
    </div>
  );
}

export function Gespraechsliste({
  liste, gewaehlt, onWaehlen, suche, setSuche, filter, setFilter, onNeu, ich, schmal = false, onSchmal, mehr = false, onMehr, gekappt = false,
  kopf, menue,
}: {
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
  /** Unsere Nummer und wessen Gespräche (Kopf der Liste). */
  kopf: { nummer: string | null; bereit: boolean; alles: boolean } | null;
  menue: RaumMenueWahl;
}) {
  const jetzt = Date.now();

  // ── Die Schiene ──────────────────────────────────────────────────────────
  if (schmal) {
    return (
      <aside className="wr-liste schmal" aria-label="Gespräche (schmal)">
        <div className="wr-schiene-kopf">
          {onSchmal && (
            <button type="button" className="wr-ikon wr-liste-klapp" onClick={() => onSchmal(false)} title="Liste wieder ausklappen" aria-label="Liste ausklappen">
              <ZKlappeRechts />
            </button>
          )}
          <button type="button" className="wr-ikon wr-neu" onClick={onNeu} title="Neues Gespräch beginnen" aria-label="Neues Gespräch beginnen"><ZNeu /></button>
          {/* Auch in der Schiene erreichbar: Schrift, Maras Schritte, Rundgang („Liste schmal“ ist hier schon an). */}
          <RaumMenue wahl={menue} />
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
                  <Avatar name={g.name} schluessel={g.nummer} offen={!!g.fensterBis} />
                  {g.ungelesen > 0 && <span className="wr-punkt" aria-hidden="true">{g.ungelesen}</span>}
                </button>
              );
            })}
          {mehr && onMehr && (
            <button type="button" className="wr-ikon wr-mehr-rund" onClick={onMehr} title="Ältere Gespräche laden" aria-label="Ältere Gespräche laden">
              <ZLaden g={18} />
            </button>
          )}
        </div>
      </aside>
    );
  }

  // ── Die volle Liste ──────────────────────────────────────────────────────
  // Was wirklich gilt (beim Suchen nie „Mit Antwort") — der Chip zeigt es, die leere Liste sagt es.
  const sucht = suche.trim() !== "";
  const wirksam = wirksamerFilter(filter, suche);
  const filterName = LISTEN_FILTER.find((f) => f.wert === wirksam)?.text ?? "";
  const leerText = sucht
    ? wirksam === "alle"
      ? "Nichts gefunden, auch nicht in Gesprächen ohne Antwort. Gesucht wird nach Name und Nummer, ab vier Zeichen auch in allen Nachrichten."
      : `Unter „${filterName}“ nichts gefunden.`
    : filter === "antwort"
      ? "Noch kein Gespräch, in dem ein Kunde selbst geschrieben hat."
      : filter === "wartet" ? "Niemand wartet auf eine Antwort."
        : filter !== "alle" ? "Nichts gefunden."
          : "Noch kein Gespräch. Sobald jemand schreibt oder Mara jemanden anschreibt, steht es hier.";
  const unterzeile = kopf?.bereit
    ? `${kopf.nummer ?? "—"} · ${kopf.alles ? "alle Gespräche" : "deine Kunden"}`
    : kopf ? "Noch nicht eingerichtet — die Zugangswerte fehlen." : " ";
  return (
    <aside className="wr-liste" aria-label="Gespräche">
      <header className="wr-kopf wr-liste-kopf">
        <div className="wr-liste-titel">
          <h1>WhatsApp</h1>
          <small title={kopf?.bereit ? "Unsere Nummer — alles läuft über sie, nie über ein privates Telefon" : undefined}>{unterzeile}</small>
        </div>
        <div className="wr-kopf-knoepfe">
          <button type="button" className="wr-ikon wr-neu" onClick={onNeu} title="Neues Gespräch beginnen" aria-label="Neues Gespräch beginnen"><ZNeu /></button>
          <RaumMenue wahl={menue} onSchmal={onSchmal ? () => onSchmal(true) : undefined} />
        </div>
      </header>
      <div className="wr-suchfeld">
        <ZSuche g={17} className="wr-such-lupe" />
        <input type="search" value={suche} onChange={(e) => setSuche(e.target.value)} placeholder="Suchen"
          title="Name und Nummer — ab vier Zeichen auch Wörter aus allen Nachrichten"
          aria-label="Gespräche durchsuchen: Name, Nummer oder Text" enterKeyHint="search" autoComplete="off" />
        {sucht && (
          <button type="button" className="wr-such-weg" onClick={() => setSuche("")} aria-label="Suche leeren" title="Suche leeren"><ZSchliessen g={16} /></button>
        )}
      </div>
      <div className="wr-filter">
        <div className="wr-chips" role="group" aria-label="Filter">
          {LISTEN_FILTER.map((f) => {
            // Beim Suchen kann „Mit Antwort“ nichts ändern — dann ruht er, statt ins Leere zu klicken.
            const still = sucht && f.wert === "antwort";
            return (
              <button key={f.wert} type="button" className={wirksam === f.wert ? "an" : ""} aria-pressed={wirksam === f.wert} disabled={still}
                title={still ? "Beim Suchen zählen alle Gespräche — ohne Suchtext gilt wieder „Mit Antwort“" : f.titel} onClick={() => setFilter(f.wert)}>{f.text}</button>
            );
          })}
        </div>
        {/* Im Filterblock, nicht daneben: die Liste ist ein Raster (Kopf · Suche · Filter · Zeilen). */}
        {sucht && wirksam !== filter && (
          <p className="wr-still wr-filter-hinweis">Die Suche läuft über alle deine Gespräche, auch die ohne Antwort.</p>
        )}
      </div>
      <div className="wr-zeilen">
        {!liste ? (
          <div className="wr-geruest" aria-label="Lädt …" role="status">
            {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="wr-geruest-zeile"><span /><span><i /><i /></span></div>)}
          </div>
        ) : liste.length === 0 ? (
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
            const raus = g.letzte.richtung === "raus";
            const haken = raus ? hakenStufe(g.letzte) : null;
            const fremd = liestMit(g.bearbeiter, ich, jetzt) ? (g.bearbeiter?.name?.split(/\s+/)[0] || "Jemand") : null;
            const name = g.name ?? nummerLesbar(g.nummer);
            const maraTitel = g.maraAn ? "Mara antwortet hier" : g.maraAusGrund === "schalter" ? "Mara ist hier aus — ein Mensch antwortet" : "Mara pausiert — ein Mensch schreibt";
            return (
              <button key={g.nummer} type="button" className={`wr-zeile${g.nummer === gewaehlt ? " an" : ""}${g.ungelesen ? " ungelesen" : ""}`}
                onClick={() => onWaehlen(g.nummer)} aria-current={g.nummer === gewaehlt ? "true" : undefined}>
                <Avatar name={g.name} schluessel={g.nummer} offen={!!g.fensterBis}
                  offenTitel={g.fensterBis ? `Fenster offen bis ${listenZeit(g.fensterBis)} — frei schreiben möglich` : undefined} />
                <span className="wr-zeile-text">
                  <span className="wr-zeile-kopf">
                    <b className="wr-zeile-name">{name}</b>
                    <Stufe stufe={g.stufe} />
                    <time className="wr-zeile-zeit" dateTime={g.letzte.am}>{listenZeit(g.letzte.am)}</time>
                  </span>
                  <span className="wr-zeile-unten">
                    <span className={`wr-vorschau${g.letzte.auto ? " auto" : ""}`}>
                      {fremd && <span className="wr-liest" title={`${fremd} hat das Gespräch gerade offen — nicht doppelt antworten`}><ZAuge g={15} /></span>}
                      {haken === "fehler" ? <ZWarnung g={15} className="wr-vz fehler" />
                        : haken ? <ZHaken doppelt={haken !== "gesendet"} className={`wr-vz-haken${haken === "gelesen" ? " gelesen" : ""}`} /> : null}
                      {v.wer && <em>{v.wer}{v.wer === "Automatische Antwort" ? " · " : ": "}</em>}
                      {v.vorlage && <ZVorlage g={15} className="wr-vz" />}
                      <MedienZeichen art={v.medien} />
                      <span className="wr-vorschau-text">{v.text}</span>
                    </span>
                    <span className="wr-zeile-zeichen">
                      <span className={`wr-wer-antwortet ${g.maraAn ? "mara" : "mensch"}`} title={maraTitel} aria-label={maraTitel}>
                        {g.maraAn ? <ZFunke g={15} /> : <ZPerson g={15} />}
                      </span>
                      {g.ungelesen > 0 && <span className="wr-punkt" aria-label={`${g.ungelesen} ungelesen`}>{g.ungelesen}</span>}
                    </span>
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
