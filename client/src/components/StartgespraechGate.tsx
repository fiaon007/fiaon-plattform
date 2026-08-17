import { useCallback, useEffect, useMemo, useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// STARTGESPRÄCH — die Tafel beim ersten Login
//
// Ein Mensch hat bezahlt und sieht sein Konto zum ersten Mal. Genau hier ist
// der Moment, ihm fünfzehn Minuten mit einem Menschen anzubieten — später
// öffnet er das Konto seltener, und irgendwann gar nicht mehr.
//
// ── ZWEI HÄRTEN, UND WARUM (16.08.2026) ────────────────────────────────────
// Hier stand: „KEIN HARTES GATE. Später buchen bleibt immer möglich." Für den
// BESTAND gilt das weiter, und zwar mit einer Zahl: GEMESSEN hatten 349
// bezahlte Kunden **null** Startgespräche. Eine harte Pflicht für alle hätte
// am Tag des Deploys 349 zahlende Menschen vor eine verschlossene Tür
// gestellt — das ist Support-Feuer, kein Onboarding.
//
// Für NEU aktivierte Kunden ist das Startgespräch dagegen PFLICHT: Der Account
// wird erst danach voll freigeschaltet, also ist der Termin kein Angebot,
// sondern der nächste Schritt. Dann gibt es kein „Später" — buchen oder
// ausloggen. Der Server verweigert das „Später" ebenfalls (HTTP 403); die
// Wand steht nicht in dieser Datei.
//
// Ausgesperrt ist deshalb niemand: Wer wartet, sieht sein Konto, seine
// Rechnungen, seine Unterlagen und die Bonitätsauskunft. Nur Fahrplan und
// Inhalte warten mit ihm.
//
// Der Auftritt ist derselbe wie bei der Verpflichtungserklärung im
// Mitarbeiterportal: Glas nur auf der schwebenden Ebene, Haarlinien statt
// Balken, Eintritt aus der Tiefe. Dieselbe Klasse von Moment, also dieselbe
// Sprache.
// ═══════════════════════════════════════════════════════════════════════════

interface Slot { beginn: string; datum: string; uhrzeit: string; agentId: number; agentVorname: string }

interface Lage {
  faellig: boolean;
  banner: boolean;
  /** Harte Pflicht: kein „Später", buchen oder ausloggen. */
  pflicht?: boolean;
  vorname: string | null;
  termin: { datumText: string; uhrzeit: string; agentVorname: string } | null;
  token: string | null;
}

const WOCHENTAG = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

function tagText(datumISO: string): string {
  const [y, m, d] = datumISO.split("-").map(Number);
  const heute = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
  const morgen = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date(Date.now() + 86_400_000));
  if (datumISO === heute) return "Heute";
  if (datumISO === morgen) return "Morgen";
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${WOCHENTAG[dt.getUTCDay()]}, ${d}. ${dt.toLocaleDateString("de-DE", { month: "long", timeZone: "UTC" })}`;
}

export function StartgespraechGate({ kundenRef }: { kundenRef: string }) {
  const [lage, setLage] = useState<Lage | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [gewaehlt, setGewaehlt] = useState<Slot | null>(null);
  const [tageOffen, setTageOffen] = useState(2);
  const [bucht, setBucht] = useState(false);
  const [fertig, setFertig] = useState<{ datumText: string; uhrzeit: string; agentVorname: string } | null>(null);
  const [zu, setZu] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(async () => {
    const res = await fetch(`/api/fiaon/kunde/${encodeURIComponent(kundenRef)}/startgespraech`).catch(() => null);
    const json = await res?.json().catch(() => null);
    if (!json?.ok) return;
    setLage(json);
    if (json.token) {
      const s = await fetch(`/api/fiaon/termin/${encodeURIComponent(json.token)}?art=start`).catch(() => null);
      const sj = await s?.json().catch(() => null);
      if (sj?.ok) setSlots(sj.slots || []);
    }
  }, [kundenRef]);

  useEffect(() => { void laden(); }, [laden]);

  const tage = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots) {
      const l = map.get(s.datum) || [];
      l.push(s);
      map.set(s.datum, l);
    }
    return Array.from(map.entries());
  }, [slots]);

  const buchen = async () => {
    if (!gewaehlt || !lage?.token) return;
    setBucht(true);
    const res = await fetch(`/api/fiaon/termin/${encodeURIComponent(lage.token)}/buchen`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ beginn: gewaehlt.beginn, agentId: gewaehlt.agentId, quelle: "onboarding_call" }),
    }).catch(() => null);
    const json = await res?.json().catch(() => null);
    setBucht(false);
    if (!json?.ok) {
      setFehler(json?.error || "Der Termin konnte nicht gebucht werden. Bitte wähl eine andere Zeit.");
      void laden();
      return;
    }
    setFertig(json.termin);
  };

  const spaeter = async () => {
    setZu(true);
    await fetch(`/api/fiaon/kunde/${encodeURIComponent(kundenRef)}/startgespraech/spaeter`, { method: "POST" })
      .catch(() => null);
  };

  if (!lage) return null;

  // ── Der dezente Dauerbanner ──────────────────────────────────────────────
  if ((lage.banner || zu) && !fertig && !lage.termin) {
    return (
      <div className="mb-4 rounded-2xl px-4 py-3 flex flex-wrap items-center gap-3"
           style={{ background: "rgba(29,78,216,.05)", border: "1px solid rgba(29,78,216,.18)" }}>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold text-slate-900">Dein Startgespräch steht noch aus</p>
          <p className="text-[12.5px] text-slate-600 mt-0.5">
            15 Minuten, in denen dir jemand FIAON persönlich erklärt. Du wählst die Uhrzeit.
          </p>
        </div>
        {lage.token && (
          <a href={`/termin/${lage.token}?art=start`}
             className="shrink-0 px-4 py-2.5 rounded-xl text-[13px] font-bold text-white bg-[#1d4ed8] hover:bg-[#1e40af]"
             style={{ minHeight: 42 }}>
            Termin wählen
          </a>
        )}
      </div>
    );
  }

  if (!lage.faellig || zu) return null;

  // ── EINE TAFEL, DIE NICHTS ANBIETEN KANN, ERSCHEINT NICHT ────────────────
  // Gibt es (noch) niemanden mit der Onboarding-Rolle, sind auch keine Zeiten
  // frei. Ein Vollbild-Gate mit dem Satz „Gerade sind keine Zeiten frei" ist
  // für einen Menschen, der gerade bezahlt hat, eine Zumutung: Es hält ihn
  // auf und bietet ihm nichts. Gesehen im Screenshot vom 08.08.2026, bevor
  // die Rolle vergeben war.
  //
  // `slots.length === 0` ist dabei kein Rateschluss — der Server hat schon
  // geantwortet, sonst wäre `lage` null.
  if (slots.length === 0) return null;

  return (
    <>
      <div className="fixed inset-0 z-[200]"
           style={{ background: "rgba(7,11,22,.62)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}
           aria-hidden="true" />
      <div className="fixed inset-0 z-[201] flex items-center justify-center p-3 sm:p-6 fi-buehne">
        <div role="dialog" aria-modal="true" aria-labelledby="start-titel"
             className="w-full flex flex-col overflow-hidden"
             style={{
               maxWidth: 640, maxHeight: "92vh", background: "#fff", borderRadius: 24,
               boxShadow: "0 40px 120px -24px rgba(13,26,63,.55), inset 0 1px 0 rgba(255,255,255,.7)",
               animation: "zusageAuf 620ms cubic-bezier(.32,.72,0,1) both",
               transformStyle: "preserve-3d",
             }}>

          <div className="fi-glas px-6 sm:px-9 pt-6 pb-5 shrink-0" style={{ transform: "translateZ(24px)" }}>
            <p className="text-[10.5px] font-semibold uppercase tracking-[.22em] text-slate-400">
              {fertig ? "Termin steht" : "Dein Start"}
            </p>
            <h1 id="start-titel" className="mt-2 text-[22px] sm:text-[30px] font-bold tracking-tight leading-[1.1]">
              <span className="fi-gradient-text">
                {fertig
                  ? "Wir sprechen uns."
                  : `Willkommen bei FIAON${lage.vorname ? `, ${lage.vorname.trim()}` : ""}.`}
              </span>
            </h1>
            <div className="mt-4" style={{ height: 1, background: "linear-gradient(90deg, rgba(29,78,216,.28), rgba(15,23,42,.06) 40%, transparent)" }} />
          </div>

          <div className="flex-1 overflow-y-auto px-6 sm:px-9 py-6">
            {fertig ? (
              <p className="text-[15px] text-slate-700 leading-relaxed">
                <b className="text-slate-900">{fertig.datumText} um {fertig.uhrzeit} Uhr</b> — {fertig.agentVorname} ruft dich an.
                Du bekommst gleich eine Bestätigung per E-Mail, mit einem Link zum Verschieben.
              </p>
            ) : (
              <>
                <p className="text-[15px] text-slate-700 leading-relaxed">
                  Buch dein persönliches Startgespräch — <b className="text-slate-900">15 Minuten</b>, in denen
                  dir jemand zeigt, wie du FIAON nutzt und worauf es bei deinen Unterlagen ankommt.
                  Du wählst die Uhrzeit, wir rufen dich an.
                </p>

                {fehler && (
                  <p className="mt-4 text-[13px] font-semibold text-amber-700">{fehler}</p>
                )}

                <div className="mt-5 space-y-5">
                    {tage.slice(0, tageOffen).map(([datum, liste]) => (
                      <div key={datum}>
                        <p className="text-[12px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                          {tagText(datum)}
                        </p>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {liste.map((s) => {
                            const an = gewaehlt?.beginn === s.beginn;
                            return (
                              <button key={`${s.agentId}-${s.beginn}`} type="button"
                                      onClick={() => setGewaehlt(an ? null : s)}
                                      className={`rounded-xl text-[14px] font-semibold transition-all ${
                                        an ? "bg-[#1d4ed8] text-white border border-[#1d4ed8]"
                                           : "bg-white text-slate-900 border border-slate-200 hover:border-slate-400"
                                      }`}
                                      style={{ minHeight: 46 }}>
                                {s.uhrzeit}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  {tage.length > tageOffen && (
                    <button type="button" onClick={() => setTageOffen((n) => n + 3)}
                            className="w-full rounded-xl text-[13px] font-semibold text-slate-700 border border-slate-200 bg-white hover:bg-slate-50"
                            style={{ minHeight: 44 }}>
                      Weitere Tage anzeigen
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="px-6 sm:px-9 py-5 shrink-0 flex flex-wrap items-center gap-3"
               style={{ borderTop: "1px solid rgba(15,23,42,.07)", background: "#fff" }}>
            {fertig ? (
              <button type="button" onClick={() => setZu(true)}
                      className="w-full rounded-xl text-[15px] font-bold text-white bg-[#1d4ed8] hover:bg-[#1e40af]"
                      style={{ minHeight: 48 }}>
                Weiter zu meinem Konto
              </button>
            ) : (
              <>
                {lage?.pflicht ? (
                  /* ── PFLICHT: BUCHEN ODER AUSLOGGEN ───────────────────────
                     Kein „Später". Der Kunde ist bezahlt und eingelassen —
                     aber der Fahrplan öffnet sich erst nach dem Gespräch.
                     Abmelden bleibt immer möglich: Eine Tafel, aus der man
                     nicht herauskommt, ist eine Falle. */
                  <button type="button"
                          onClick={() => {
                            // Derselbe Weg wie der Abmelden-Knopf im Portal —
                            // nicht ein zweiter, der die Sitzung anders räumt.
                            sessionStorage.removeItem("fiaon_user");
                            window.location.href = "/login";
                          }}
                          className="text-[13px] font-semibold text-slate-400 hover:text-slate-700">
                    Abmelden
                  </button>
                ) : (
                  <button type="button" onClick={() => void spaeter()}
                          className="text-[13px] font-semibold text-slate-500 hover:text-slate-800">
                    Später buchen
                  </button>
                )}
                <button type="button" onClick={() => void buchen()} disabled={!gewaehlt || bucht}
                        className="ml-auto px-5 rounded-xl text-[15px] font-bold text-white bg-[#1d4ed8] hover:bg-[#1e40af] disabled:opacity-40"
                        style={{ minHeight: 48 }}>
                  {bucht ? "Wird gebucht …" : gewaehlt ? `${tagText(gewaehlt.datum)}, ${gewaehlt.uhrzeit} Uhr buchen` : "Zeit wählen"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
