import { useEffect, useState } from "react";
import { MarkeFunke } from "./Softphone";

// ═══════════════════════════════════════════════════════════════════════════
// GESPRÄCHSBLATT — fünf Sekunden lesen statt zwei Minuten suchen
//
// Abschnitte mit Ziffernmarken, je einer mit Kopieren-Knopf. Die Ziffern sind
// kein Schmuck: Wer beim Telefonieren kurz wegschaut, findet über „3" zurück,
// wo er war — über eine Überschrift nicht.
//
// Der Fußsatz steht auf JEDEM Blatt und ist nicht wegklickbar.
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
    <span aria-hidden="true"
          className="inline-flex items-center justify-center shrink-0 text-[11px] font-bold tabular-nums"
          style={{ width: 20, height: 20, borderRadius: 6, background: "rgba(29,78,216,.08)", color: "#1d4ed8" }}>
      {n}
    </span>
  );
}

function Abschnitt({
  n, titel, text, children,
}: { n: number; titel: string; text?: string; children?: React.ReactNode }) {
  const [kopiert, setKopiert] = useState(false);
  return (
    <section className="mb-5">
      <div className="flex items-center gap-2 mb-1.5">
        <Ziffer n={n} />
        <h3 className="text-[11px] font-bold uppercase tracking-[.1em] flex-1" style={{ color: "var(--fi-text-still, #64748b)" }}>
          {titel}
        </h3>
        {text && (
          <button type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(text);
                    setKopiert(true);
                    setTimeout(() => setKopiert(false), 1600);
                  }}
                  className="text-[11px] font-semibold" style={{ color: kopiert ? "#047857" : "#94a3b8" }}>
            {kopiert ? "kopiert" : "kopieren"}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function Skelett({ h = 14, w = "100%" }: { h?: number; w?: string | number }) {
  return (
    <div style={{
      height: h, width: w, borderRadius: 6,
      background: "linear-gradient(90deg,#f1f5f9,#e8eef6,#f1f5f9)",
      backgroundSize: "200% 100%", animation: "blattSkelett 1.4s ease-in-out infinite",
    }} />
  );
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

  useEffect(() => {
    if (!offen) return;
    const zu = (e: KeyboardEvent) => { if (e.key === "Escape") onZu(); };
    window.addEventListener("keydown", zu);
    return () => window.removeEventListener("keydown", zu);
  }, [offen, onZu]);

  if (!offen) return null;

  return (
    <>
      <style>{`@keyframes blattSkelett { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
      <div className="fixed inset-0 z-[380]" onClick={onZu} aria-hidden="true"
           style={{ background: "rgba(7,11,22,.55)", backdropFilter: "blur(9px)", WebkitBackdropFilter: "blur(9px)" }} />
      <div className="fixed inset-0 z-[381] flex items-end sm:items-center justify-center sm:p-6 pointer-events-none">
        <div role="dialog" aria-modal="true" aria-label="Gesprächsblatt"
             className="w-full flex flex-col overflow-hidden pointer-events-auto"
             style={{
               maxWidth: 560, maxHeight: "90vh", background: "#fff",
               borderRadius: 22, boxShadow: "0 40px 120px -24px rgba(13,26,63,.5)",
             }}>
          <div className="px-5 sm:px-7 pt-5 pb-4 shrink-0" style={{ borderBottom: "1px solid #f1f5f9" }}>
            <div className="flex items-start gap-3">
              <span className="shrink-0 inline-flex items-center justify-center"
                    style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(29,78,216,.08)", color: "#1d4ed8" }}>
                <MarkeFunke size={17} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10.5px] font-semibold uppercase tracking-[.2em] text-slate-400">
                  Vor dem Anruf
                </p>
                <h2 className="text-[18px] font-bold tracking-tight text-slate-900 truncate">
                  {blatt?.profil.zeile ?? "Gesprächsblatt"}
                </h2>
              </div>
              <button type="button" onClick={onZu} aria-label="Schließen"
                      className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-slate-50 text-slate-400">
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
                  <path d="m5 5 10 10M15 5 5 15" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-4">
            {fehler && <p className="text-[13px] text-amber-700 font-semibold">{fehler}</p>}

            {!blatt && !fehler && (
              <div className="space-y-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i}>
                    <Skelett h={11} w={90} />
                    <div className="mt-2"><Skelett h={13} /></div>
                    <div className="mt-1.5"><Skelett h={13} w="80%" /></div>
                  </div>
                ))}
              </div>
            )}

            {blatt && (
              <>
                <Abschnitt n={1} titel="Kurzprofil">
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    {blatt.profil.werte.map((w) => (
                      <div key={w.was} className="min-w-0">
                        <dt className="text-[10.5px] text-slate-400">{w.was}</dt>
                        <dd className="text-[13px] font-semibold text-slate-800 break-words">{w.wert}</dd>
                      </div>
                    ))}
                  </dl>
                </Abschnitt>

                {blatt.aufhaenger.length > 0 && (
                  <Abschnitt n={2} titel="Aufhänger" text={blatt.aufhaenger.join("\n")}>
                    <ul className="space-y-1">
                      {blatt.aufhaenger.map((a, i) => (
                        <li key={i} className="text-[13px] text-slate-700 leading-relaxed">{a}</li>
                      ))}
                    </ul>
                  </Abschnitt>
                )}

                <Abschnitt n={3} titel="Was bisher besprochen wurde" text={blatt.historie}>
                  <p className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap">{blatt.historie}</p>
                  {blatt.historieHerkunft === "roh" && (
                    <p className="text-[11px] text-slate-400 mt-1.5">
                      Rohe Einträge — die Verdichtung war gerade nicht verfügbar.
                    </p>
                  )}
                </Abschnitt>

                <Abschnitt n={4} titel="Nächster Schritt" text={blatt.naechsteAktion.titel}>
                  <p className="text-[14px] font-bold text-slate-900">{blatt.naechsteAktion.titel}</p>
                  <p className="text-[12.5px] text-slate-500 leading-relaxed mt-0.5">{blatt.naechsteAktion.warum}</p>
                </Abschnitt>

                {blatt.einwaende.length > 0 && (
                  <Abschnitt n={5} titel="Wenn er das sagt">
                    <div className="space-y-2.5">
                      {blatt.einwaende.map((e) => (
                        <div key={e.schluessel} className="p-3 rounded-xl" style={{ background: "#f8fafc" }}>
                          <p className="text-[12.5px] font-bold text-slate-900">„{e.sagt}"</p>
                          <p className="text-[12.5px] text-slate-600 leading-relaxed mt-1">{e.antwort}</p>
                          <button type="button"
                                  onClick={() => void navigator.clipboard?.writeText(e.antwort)}
                                  className="text-[11px] font-semibold text-slate-400 mt-1.5">
                            kopieren
                          </button>
                        </div>
                      ))}
                    </div>
                  </Abschnitt>
                )}

                {/* Nicht wegklickbar. Ein Blatt ohne diesen Satz wäre eine
                    Behauptung statt einer Hilfe. */}
                <p className="text-[11px] text-slate-400 leading-snug pt-3"
                   style={{ borderTop: "1px solid #f1f5f9" }}>
                  {blatt.fussSatz}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
