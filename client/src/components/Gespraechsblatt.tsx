import { useEffect, useState } from "react";
import { FiaonEbene, FiaonKlappe } from "./FiaonEbene";
import { MarkeFunke } from "./Softphone";

// ═══════════════════════════════════════════════════════════════════════════
// GESPRÄCHSBLATT — ein Briefing, kein Textexport
//
// ── WAS DER BETREIBER BEANSTANDET HAT ──────────────────────────────────────
// Die erste Fassung war eine Wand: fünf Abschnitte gleichgewichtig
// untereinander, die Einwände als Endlosliste. Wer dreißig Sekunden vor dem
// Anruf draufschaut, findet darin nicht, was er braucht.
//
// ── DIE NEUE HIERARCHIE ────────────────────────────────────────────────────
// 1. DER KERN, drei Zeilen, groß: WER · ZUSTAND · NÄCHSTER SCHRITT. Wenn man
//    nur das liest, kann man das Gespräch führen.
// 2. Darunter die Belege: Kurzprofil als Datenraster, Aufhänger, Historie.
// 3. Die Einwände als GESCHLOSSENE Karten — eine Reihe Fragen, von denen man
//    die eine öffnet, die gerade kommt.
//
// Ziffernmarken bleiben: Wer beim Telefonieren wegschaut, findet über „3"
// zurück, wo er war — über eine Überschrift nicht.
// ═══════════════════════════════════════════════════════════════════════════

interface Blatt {
  personId: number;
  profil: { zeile: string; werte: { was: string; wert: string }[] };
  aufhaenger: string[];
  historie: string;
  historieHerkunft: "ki" | "roh" | "leer";
  naechsteAktion: { titel: string; warum: string };
  einwaende: { schluessel: string; sagt: string; wann: string; antwort: string }[];
  fussSatz: string;
  ausCache: boolean;
}

function Ziffer({ n }: { n: number }) {
  return (
    <span aria-hidden="true" className="fi-gb-ziffer">{n}</span>
  );
}

function Abschnitt({
  n, titel, text, kinder,
}: { n: number; titel: string; text?: string; kinder: React.ReactNode }) {
  const [kopiert, setKopiert] = useState(false);
  return (
    <section className="fi-gb-abschnitt">
      <div className="fi-gb-kopfzeile">
        <Ziffer n={n} />
        <h3 className="fi-gb-titel">{titel}</h3>
        {text && (
          <button type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(text);
                    setKopiert(true);
                    setTimeout(() => setKopiert(false), 1600);
                  }}
                  className="fi-gb-kopieren" style={kopiert ? { color: "#047857" } : undefined}>
            {kopiert ? "kopiert" : "kopieren"}
          </button>
        )}
      </div>
      {kinder}
    </section>
  );
}

function Skelett({ h = 14, w = "100%" }: { h?: number; w?: string | number }) {
  return <div className="fi-gb-skelett" style={{ height: h, width: w }} />;
}

export function Gespraechsblatt({
  personId, offen, onZu,
}: { personId: number; offen: boolean; onZu: () => void }) {
  const [blatt, setBlatt] = useState<Blatt | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    if (!offen) return;
    setBlatt(null); setFehler(null);
    fetch(`/api/fiaon/gespraechsblatt/${personId}`, { credentials: "include" })
      .then((r) => r.json())
      .then((j) => { if (j?.ok) setBlatt(j.blatt); else setFehler(j?.error || "Nicht ladbar."); })
      .catch(() => setFehler("Nicht ladbar."));
  }, [offen, personId]);

  // Der Kern: drei Werte, die auch ohne den Rest reichen.
  const stufe = blatt?.profil.werte.find((w) => w.was === "Stufe")?.wert;
  const status = blatt?.profil.werte.find((w) => w.was === "Status")?.wert;

  return (
    <FiaonEbene
      offen={offen} onZu={onZu}
      titel={blatt?.profil.zeile ?? "Gesprächsblatt"}
      ueberschrift="Vor dem Anruf"
      marke={<MarkeFunke size={17} />}
      breite={580}
      fuss={blatt ? (
        // Der Fußsatz ist nicht wegklickbar und liegt auf Glas — er begleitet
        // das Blatt, statt am Ende zu versanden.
        <p className="fi-gb-fuss">{blatt.fussSatz}</p>
      ) : undefined}
      kinder={
        <>
          <style>{GB_CSS}</style>

          {fehler && <p className="fi-gb-fehler">{fehler}</p>}

          {!blatt && !fehler && (
            <div className="space-y-5">
              <Skelett h={70} />
              {[0, 1, 2].map((i) => (
                <div key={i}>
                  <Skelett h={11} w={90} />
                  <div className="mt-2"><Skelett h={13} /></div>
                  <div className="mt-1.5"><Skelett h={13} w="78%" /></div>
                </div>
              ))}
            </div>
          )}

          {blatt && (
            <>
              {/* ── 1. DER KERN ───────────────────────────────────────────
                  Drei Zeilen, groß, auf getöntem Grund. Das ist das, was ein
                  Mensch in den drei Sekunden liest, die er wirklich hat. */}
              <div className="fi-gb-kern">
                <p className="fi-gb-kern-wer">{blatt.profil.zeile}</p>
                {(stufe || status) && (
                  <p className="fi-gb-kern-zustand">{[stufe, status].filter(Boolean).join(" · ")}</p>
                )}
                <p className="fi-gb-kern-schritt">
                  <span aria-hidden="true" className="fi-gb-pfeil">
                    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor"
                         strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 10h11m0 0-4.5-4.5M15 10l-4.5 4.5" />
                    </svg>
                  </span>
                  {blatt.naechsteAktion.titel}
                </p>
              </div>

              <Abschnitt n={1} titel="Kurzprofil" kinder={
                <dl className="fi-gb-raster">
                  {blatt.profil.werte.map((w) => (
                    <div key={w.was}>
                      <dt>{w.was}</dt>
                      <dd>{w.wert}</dd>
                    </div>
                  ))}
                </dl>
              } />

              {blatt.aufhaenger.length > 0 && (
                <Abschnitt n={2} titel="Aufhänger" text={blatt.aufhaenger.join("\n")} kinder={
                  <ul className="fi-gb-liste">
                    {blatt.aufhaenger.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                } />
              )}

              <Abschnitt n={3} titel="Was bisher besprochen wurde" text={blatt.historie} kinder={
                <>
                  <p className="fi-gb-text">{blatt.historie}</p>
                  {blatt.historieHerkunft === "roh" && (
                    <p className="fi-gb-hinweis">
                      Rohe Einträge — die Verdichtung war gerade nicht verfügbar.
                    </p>
                  )}
                </>
              } />

              <Abschnitt n={4} titel="Nächster Schritt" text={blatt.naechsteAktion.titel} kinder={
                <>
                  <p className="fi-gb-stark">{blatt.naechsteAktion.titel}</p>
                  <p className="fi-gb-text" style={{ marginTop: 2 }}>{blatt.naechsteAktion.warum}</p>
                </>
              } />

              {blatt.einwaende.length > 0 && (
                <Abschnitt n={5} titel="Wenn er das sagt" kinder={
                  <div className="space-y-1.5">
                    {blatt.einwaende.map((e, i) => (
                      <FiaonKlappe
                        key={e.schluessel}
                        titel={`„${e.sagt}“`}
                        unterzeile={e.wann}
                        // Die erste ist offen: Ein Stapel geschlossener Karten
                        // sieht sonst aus wie eine Liste ohne Inhalt.
                        offenVorgabe={i === 0}
                        kinder={<p className="fi-gb-text">{e.antwort}</p>}
                        aktion={
                          <button type="button"
                                  onClick={() => void navigator.clipboard?.writeText(e.antwort)}
                                  className="fi-gb-kopieren">
                            kopieren
                          </button>
                        }
                      />
                    ))}
                  </div>
                } />
              )}
            </>
          )}
        </>
      }
    />
  );
}

const GB_CSS = `
/* ── Der Kern ──────────────────────────────────────────────────────────── */
.fi-gb-kern {
  padding: 15px 17px; border-radius: 16px; margin-bottom: 22px;
  background: linear-gradient(165deg, rgba(37,99,235,.075), rgba(37,99,235,.025));
  box-shadow: inset 0 0 0 1px rgba(37,99,235,.14);
}
.fi-gb-kern-wer {
  font-size: 17px; font-weight: 700; letter-spacing: -.012em;
  color: #0f172a; margin: 0; line-height: 1.3;
}
.fi-gb-kern-zustand {
  font-size: 12.5px; font-weight: 600; color: #1d4ed8; margin: 3px 0 0; line-height: 1.4;
}
.fi-gb-kern-schritt {
  display: flex; align-items: flex-start; gap: 7px;
  font-size: 14px; font-weight: 700; color: #0f172a;
  margin: 11px 0 0; padding-top: 11px; line-height: 1.35;
  box-shadow: inset 0 1px 0 rgba(37,99,235,.14);
}
.fi-gb-pfeil { color: #1d4ed8; flex-shrink: 0; margin-top: 1px; }

/* ── Abschnitte ────────────────────────────────────────────────────────── */
.fi-gb-abschnitt { margin-bottom: 22px; }
.fi-gb-abschnitt:last-child { margin-bottom: 4px; }
.fi-gb-kopfzeile { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.fi-gb-ziffer {
  display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
  width: 21px; height: 21px; border-radius: 7px;
  font-size: 11px; font-weight: 700; font-variant-numeric: tabular-nums;
  background: rgba(37,99,235,.09); color: #1d4ed8;
}
.fi-gb-titel {
  flex: 1 1 auto; margin: 0;
  font-size: 10.5px; font-weight: 700; letter-spacing: .11em;
  text-transform: uppercase; color: #94a3b8;
}
.fi-gb-kopieren {
  background: none; border: 0; cursor: pointer; padding: 2px 0;
  font-size: 11px; font-weight: 600; color: #94a3b8;
  transition: color 160ms;
}
.fi-gb-kopieren:hover { color: #1d4ed8; }

/* ── Datenraster ───────────────────────────────────────────────────────── */
.fi-gb-raster { display: grid; grid-template-columns: 1fr 1fr; gap: 9px 18px; margin: 0; }
.fi-gb-raster dt { font-size: 10.5px; color: #94a3b8; margin: 0; }
.fi-gb-raster dd {
  font-size: 13px; font-weight: 600; color: #1e293b; margin: 1px 0 0;
  /* UMBRECHEN, nicht kürzen: Ein abgeschnittener Verwendungszweck ist
     wertlos — genau ihn liest man am Telefon vor. */
  overflow-wrap: anywhere; line-height: 1.35;
}

.fi-gb-liste { margin: 0; padding: 0; list-style: none; }
.fi-gb-liste li {
  font-size: 13px; color: #334155; line-height: 1.55; padding-left: 13px; position: relative;
}
.fi-gb-liste li::before {
  content: ""; position: absolute; left: 2px; top: 9px;
  width: 4px; height: 4px; border-radius: 99px; background: #cbd5e1;
}
.fi-gb-text { font-size: 13px; color: #334155; line-height: 1.6; margin: 0; white-space: pre-wrap; }
.fi-gb-stark { font-size: 14px; font-weight: 700; color: #0f172a; margin: 0; }
.fi-gb-hinweis { font-size: 11px; color: #94a3b8; margin: 6px 0 0; }
.fi-gb-fehler { font-size: 13px; font-weight: 600; color: #b45309; margin: 0; }
.fi-gb-fuss { font-size: 11px; color: #94a3b8; line-height: 1.5; margin: 0; }

/* ── Skelett ───────────────────────────────────────────────────────────── */
.fi-gb-skelett {
  border-radius: 7px;
  background: linear-gradient(90deg, #f1f5f9, #e6edf7, #f1f5f9);
  background-size: 200% 100%;
  animation: fiGbSkelett 1.4s ease-in-out infinite;
}
@keyframes fiGbSkelett { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
@media (prefers-reduced-motion: reduce) { .fi-gb-skelett { animation: none } }

@media (max-width: 420px) { .fi-gb-raster { grid-template-columns: 1fr; } }
`;
