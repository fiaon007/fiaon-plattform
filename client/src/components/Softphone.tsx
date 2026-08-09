import { useCallback, useEffect, useRef, useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// SOFTPHONE — der schwebende Knopf und das Gerät dahinter
//
// Der Knopf ist das Prunkstück: Er liegt unten rechts über allem, aus Glas,
// mit einem Schatten, der ihn über die Seite hebt. Beim Zeigen kommt er dem
// Zeiger ENTGEGEN (translateZ) statt nur die Farbe zu wechseln — der
// Unterschied zwischen „anklickbar" und „will angefasst werden".
//
// Das Panel ist auf dem Bildschirm ein GERÄT: abgerundeter Körper, dunkle
// Fassung, Anzeige, Tastatur. Nicht aus Verspieltheit — ein Telefon bedient
// man anders als ein Formular, und die Form sagt einem das, bevor man liest.
// Auf 380 px wird daraus ein Blatt in voller Breite; ein Gerät im Gerät wäre
// dort albern.
//
// OHNE ZUGANGSDATEN existiert alles, und der Bildschirm sagt ruhig, dass noch
// etwas fehlt. Kein Absturz, kein leerer Kasten, kein toter Knopf ohne Grund.
// ═══════════════════════════════════════════════════════════════════════════

interface OffenerAnruf {
  id: number; nummer: string; name: string; beginn: string; dauer_sek: number | null; person_id: number | null;
}

interface Stand {
  bereit: boolean;
  abgeschaltet: boolean;
  hinweis: string;
  maxMinuten: number;
  offene: OffenerAnruf[];
  testkonto: boolean;
}

/** Die Ergebnisse — Wortlaut wie in der Kundenliste, damit nichts auseinanderläuft. */
const ERGEBNISSE: { art: string; label: string; braucht?: "zusage" | "termin" }[] = [
  { art: "erreicht_zahlt_gleich", label: "Zahlt sofort" },
  { art: "erreicht_zahlt_am", label: "Zahlt am …", braucht: "zusage" },
  { art: "nicht_erreicht", label: "Nicht erreicht" },
  { art: "mailbox", label: "Mailbox besprochen" },
  { art: "rueckruf_termin", label: "Rückruf vereinbart", braucht: "termin" },
  { art: "erreicht_abgelehnt", label: "Erreicht – abgelehnt" },
  { art: "nummer_falsch", label: "Falsche Nummer" },
];

/** Hörer — 20×20, 1,5 px, currentColor. */
export function MarkeHoerer({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor"
         strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M6.6 3.2 8.2 6a1 1 0 0 1-.2 1.2L6.7 8.4a.9.9 0 0 0-.2 1c.5 1.2 1.3 2.3 2.3 3.2 1 .9 2.1 1.6 3.3 2a.9.9 0 0 0 1-.2l1.2-1.2a1 1 0 0 1 1.2-.2l2.8 1.5c.4.2.6.7.4 1.1l-.9 1.7c-.3.5-.8.8-1.4.7-2.9-.3-5.7-1.7-7.9-3.9C6.4 12 5 9.2 4.7 6.3c-.1-.6.2-1.1.7-1.4l1.7-.9c.4-.2.9 0 1.1.4Z" />
    </svg>
  );
}

/** Die Funken-Linie der Wortmarke — für das Gesprächsblatt. */
export function MarkeFunke({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor"
         strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M3 16c2.4-1.2 4.1-3.1 5.2-5.6C9.3 7.8 11.1 5.9 13.6 5" />
      <path d="M15.4 3.2v3.1M17 4.7h-3.1" />
      <circle cx="6.2" cy="6.4" r="1" />
      <circle cx="16.4" cy="13.6" r="1" />
    </svg>
  );
}

function dauerText(sek: number): string {
  const m = Math.floor(sek / 60);
  const s = sek % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ═══════════════════════════════════════════════════════════════════════════

export function Softphone() {
  const [stand, setStand] = useState<Stand | null>(null);
  const [offen, setOffen] = useState(false);
  const [nummer, setNummer] = useState("");
  const [kunde, setKunde] = useState<{ personId: number; name: string } | null>(null);
  const [zustand, setZustand] = useState<"bereit" | "waehlt" | "gespraech" | "ergebnis">("bereit");
  const [callId, setCallId] = useState<number | null>(null);
  const [sekunden, setSekunden] = useState(0);
  const [stumm, setStumm] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [datumFeld, setDatumFeld] = useState<"zusage" | "termin" | null>(null);
  const [datum, setDatum] = useState("");
  const uhr = useRef<ReturnType<typeof setInterval> | null>(null);

  const laden = useCallback(async () => {
    const r = await fetch("/api/fiaon/telefon/stand", { credentials: "include" }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (j?.ok) setStand(j);
  }, []);

  useEffect(() => { void laden(); }, [laden]);

  // Von außen anrufen: Die Kundenkarte schickt ein Ereignis mit Kontext.
  useEffect(() => {
    const hoer = (e: Event) => {
      const d = (e as CustomEvent).detail || {};
      setNummer(String(d.nummer || ""));
      setKunde(d.personId ? { personId: Number(d.personId), name: String(d.name || "") } : null);
      setOffen(true);
      setZustand("bereit");
    };
    window.addEventListener("fiaon-anrufen", hoer);
    return () => window.removeEventListener("fiaon-anrufen", hoer);
  }, []);

  useEffect(() => {
    if (zustand === "gespraech") {
      uhr.current = setInterval(() => setSekunden((s) => s + 1), 1000);
    } else if (uhr.current) {
      clearInterval(uhr.current);
      uhr.current = null;
    }
    return () => { if (uhr.current) clearInterval(uhr.current); };
  }, [zustand]);

  if (!stand) return null;

  const offeneAnzahl = stand.offene?.length ?? 0;

  const waehlen = async () => {
    setMeldung(null);
    setZustand("waehlt");
    const r = await fetch("/api/fiaon/telefon/ausweis", {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nummer, personId: kunde?.personId ?? null }),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (!j?.ok) {
      setZustand("bereit");
      setMeldung(j?.error || "Der Anruf konnte nicht aufgebaut werden.");
      return;
    }
    setCallId(j.callId);
    setSekunden(0);
    // Hier setzt das Twilio-Browser-SDK an: `new Device(j.token).connect(...)`.
    // Ohne Zugangsdaten kommt dieser Zweig nie zustande — die Route hat
    // vorher abgelehnt.
    setZustand("gespraech");
  };

  const auflegen = () => {
    setZustand("ergebnis");
    void laden();
  };

  const dokumentieren = async (art: string) => {
    if (!callId) { setZustand("bereit"); return; }
    const r = await fetch(`/api/fiaon/telefon/${callId}/ergebnis`, {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ergebnis: art,
        zusageDatum: datumFeld === "zusage" ? datum : null,
        terminDatum: datumFeld === "termin" ? datum : null,
      }),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setMeldung(j?.meldung || j?.error || null);
    setDatumFeld(null); setDatum("");
    if (j?.ok) { setZustand("bereit"); setCallId(null); void laden(); }
  };

  return (
    <>
      {/* ── Der schwebende Knopf ─────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        aria-label={offen ? "Telefon schließen" : "Telefon öffnen"}
        className="fi-telefonknopf fixed z-[290] flex items-center justify-center"
        style={{
          right: 20, bottom: 20, width: 58, height: 58, borderRadius: 999,
          background: "linear-gradient(160deg, #2563eb, #1d4ed8)",
          color: "#fff",
          boxShadow: "0 18px 40px -12px rgba(29,78,216,.65), inset 0 1px 0 rgba(255,255,255,.28)",
          border: "1px solid rgba(255,255,255,.18)",
        }}
      >
        <MarkeHoerer size={23} />
        {/* Die Erinnerungsmarke. Nicht wegklickbar — solange ein Gespräch
            undokumentiert ist, bleibt sie stehen. */}
        {offeneAnzahl > 0 && (
          <span aria-label={`${offeneAnzahl} Anrufe ohne Ergebnis`}
                className="absolute flex items-center justify-center text-[11px] font-bold tabular-nums"
                style={{
                  top: -3, right: -3, minWidth: 22, height: 22, borderRadius: 999,
                  background: "#b45309", color: "#fff", border: "2px solid #fff",
                  boxShadow: "0 4px 10px -2px rgba(180,83,9,.6)",
                }}>
            {offeneAnzahl}
          </span>
        )}
      </button>
      <style>{`
        .fi-telefonknopf { transition: transform 240ms cubic-bezier(.32,.72,0,1), box-shadow 240ms; }
        .fi-telefonknopf:hover {
          transform: translateY(-3px) scale(1.06);
          box-shadow: 0 26px 56px -14px rgba(29,78,216,.75), inset 0 1px 0 rgba(255,255,255,.34);
        }
        .fi-telefonknopf:active { transform: translateY(-1px) scale(1.01); }
        @media (max-width: 640px) { .fi-telefonknopf { right: 14px; bottom: 76px; } }
        @keyframes fiGeraetAuf {
          from { opacity: 0; transform: perspective(1200px) translateY(30px) translateZ(-90px) rotateX(9deg); }
          to   { opacity: 1; transform: perspective(1200px) translateY(0) translateZ(0) rotateX(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .fi-telefonknopf, .fi-geraet { transition: none !important; animation: none !important; }
        }
      `}</style>

      {offen && (
        <>
          <div className="fixed inset-0 z-[295]" onClick={() => setOffen(false)} aria-hidden="true"
               style={{ background: "rgba(7,11,22,.45)", backdropFilter: "blur(7px)", WebkitBackdropFilter: "blur(7px)" }} />
          <div className="fixed inset-0 z-[296] flex items-end sm:items-center sm:justify-end pointer-events-none"
               style={{ padding: 0 }}>
            <div
              role="dialog" aria-modal="true" aria-label="Telefon"
              className="fi-geraet w-full pointer-events-auto flex flex-col overflow-hidden"
              style={{
                maxWidth: 340,
                margin: "0 auto",
                marginRight: typeof window !== "undefined" && window.innerWidth >= 640 ? 24 : "auto",
                marginBottom: typeof window !== "undefined" && window.innerWidth >= 640 ? 24 : 0,
                maxHeight: "88vh",
                background: "linear-gradient(170deg, #10192e, #0b1220)",
                borderRadius: typeof window !== "undefined" && window.innerWidth >= 640 ? 30 : "24px 24px 0 0",
                padding: 10,
                boxShadow: "0 44px 100px -24px rgba(7,11,22,.72), inset 0 1px 0 rgba(255,255,255,.1)",
                animation: "fiGeraetAuf 460ms cubic-bezier(.32,.72,0,1) both",
              }}
            >
              {/* Der Gerätekörper: dunkle Fassung, helle Anzeige darin. */}
              <div className="flex flex-col overflow-hidden"
                   style={{ background: "#f8fafc", borderRadius: 22, flex: 1, minHeight: 0 }}>

                <div className="px-4 pt-3.5 pb-3 shrink-0" style={{ borderBottom: "1px solid #eef2f7" }}>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-400 flex-1">
                      {zustand === "gespraech" ? "Im Gespräch"
                        : zustand === "waehlt" ? "Wird verbunden"
                        : zustand === "ergebnis" ? "Wie lief es?"
                        : stand.bereit ? "Telefon" : "Telefon — bald verfügbar"}
                    </span>
                    <button type="button" onClick={() => setOffen(false)} aria-label="Schließen"
                            className="w-7 h-7 rounded-full flex items-center justify-center bg-slate-100 text-slate-400">
                      <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
                        <path d="m5 5 10 10M15 5 5 15" />
                      </svg>
                    </button>
                  </div>
                  {kunde && (
                    <p className="mt-1 text-[13.5px] font-bold text-slate-900 truncate">{kunde.name}</p>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-3.5">
                  {/* ── Nicht eingerichtet ──────────────────────────────── */}
                  {!stand.bereit && (
                    <div className="py-4 text-center">
                      <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-3"
                            style={{ background: "rgba(29,78,216,.07)", color: "#1d4ed8" }}>
                        <MarkeHoerer size={22} />
                      </span>
                      <p className="text-[14px] font-bold text-slate-900">Noch nicht freigeschaltet</p>
                      <p className="text-[12.5px] text-slate-500 leading-relaxed mt-1.5">{stand.hinweis}</p>
                      <p className="text-[11.5px] text-slate-400 leading-relaxed mt-3">
                        Alles andere ist fertig: Wähltastatur, Aufzeichnung, Gesprächsergebnis und
                        die automatische Zusammenfassung. Es fehlt nur der Telefonanbieter.
                      </p>
                    </div>
                  )}
                  {stand.bereit && stand.testkonto && (
                    <p className="py-4 text-[13px] text-slate-500 text-center">
                      Testkonten können nicht telefonieren.
                    </p>
                  )}

                  {/* ── Wählen ──────────────────────────────────────────── */}
                  {stand.bereit && !stand.testkonto && zustand === "bereit" && (
                    <>
                      <input value={nummer} onChange={(e) => setNummer(e.target.value)}
                             inputMode="tel" placeholder="+49 …"
                             aria-label="Rufnummer"
                             className="w-full text-center text-[22px] font-semibold tabular-nums tracking-wide bg-transparent outline-none py-2"
                             style={{ color: "#0f172a" }} />
                      <div className="grid grid-cols-3 gap-2 mt-3">
                        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((t) => (
                          <button key={t} type="button" onClick={() => setNummer((n) => n + t)}
                                  className="rounded-2xl text-[19px] font-semibold text-slate-800 bg-white active:scale-95 transition-transform"
                                  style={{ height: 46, border: "1px solid #e8eef6", boxShadow: "0 1px 2px rgba(15,23,42,.04)" }}>
                            {t}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <button type="button" onClick={() => setNummer((n) => n.slice(0, -1))}
                                disabled={!nummer}
                                className="px-3 rounded-xl text-[12.5px] font-semibold text-slate-500 bg-white disabled:opacity-30"
                                style={{ height: 46, border: "1px solid #e8eef6" }}>
                          Löschen
                        </button>
                        <button type="button" onClick={() => void waehlen()} disabled={nummer.length < 4}
                                className="flex-1 rounded-xl text-[15px] font-bold text-white inline-flex items-center justify-center gap-2 disabled:opacity-30"
                                style={{ height: 46, background: "linear-gradient(160deg,#059669,#047857)" }}>
                          <MarkeHoerer size={17} /> Anrufen
                        </button>
                      </div>
                    </>
                  )}

                  {/* ── Verbinden / Gespräch ────────────────────────────── */}
                  {(zustand === "waehlt" || zustand === "gespraech") && (
                    <div className="py-3 text-center">
                      <p className="text-[24px] font-semibold tabular-nums text-slate-900">
                        {zustand === "gespraech" ? dauerText(sekunden) : "…"}
                      </p>
                      <p className="text-[13px] text-slate-500 mt-0.5">{nummer}</p>
                      <p className="text-[11px] text-slate-400 mt-2 leading-snug">
                        Zu Beginn läuft die Ansage zur Aufzeichnung. Höchstdauer {stand.maxMinuten} Minuten.
                      </p>
                      <div className="grid grid-cols-3 gap-2 mt-4">
                        <button type="button" onClick={() => setStumm((s) => !s)}
                                className="rounded-xl text-[12px] font-semibold py-2.5"
                                style={stumm
                                  ? { background: "#1d4ed8", color: "#fff" }
                                  : { background: "#fff", border: "1px solid #e8eef6", color: "#475569" }}>
                          {stumm ? "Stumm an" : "Stumm"}
                        </button>
                        <button type="button" className="rounded-xl text-[12px] font-semibold py-2.5 bg-white text-slate-600"
                                style={{ border: "1px solid #e8eef6" }}>
                          Tasten
                        </button>
                        <button type="button" onClick={auflegen}
                                className="rounded-xl text-[12px] font-bold text-white py-2.5"
                                style={{ background: "linear-gradient(160deg,#dc2626,#b91c1c)" }}>
                          Auflegen
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── Ergebnis ────────────────────────────────────────── */}
                  {zustand === "ergebnis" && (
                    <>
                      <p className="text-[12.5px] text-slate-500 leading-relaxed mb-2.5">
                        Ein Klick, dann ist es dokumentiert — Wiedervorlage und Zusage setzt das System selbst.
                      </p>
                      {datumFeld && (
                        <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)}
                               className="w-full mb-2 px-3 py-2.5 rounded-xl text-[13.5px] bg-white"
                               style={{ border: "1px solid #e8eef6" }} />
                      )}
                      <div className="grid grid-cols-2 gap-1.5">
                        {ERGEBNISSE.map((e) => (
                          <button key={e.art} type="button"
                                  onClick={() => {
                                    if (e.braucht && datumFeld !== e.braucht) { setDatumFeld(e.braucht); return; }
                                    void dokumentieren(e.art);
                                  }}
                                  className="rounded-xl text-[12px] font-semibold py-2.5 px-2 bg-white text-slate-700 text-left"
                                  style={{ border: "1px solid #e8eef6" }}>
                            {e.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  {meldung && (
                    <p className="mt-3 text-[12px] leading-snug px-3 py-2 rounded-xl"
                       style={{ background: "rgba(217,119,6,.08)", color: "#b45309" }}>
                      {meldung}
                    </p>
                  )}

                  {/* ── Offene Gespräche ────────────────────────────────── */}
                  {zustand === "bereit" && offeneAnzahl > 0 && (
                    <div className="mt-4 pt-3" style={{ borderTop: "1px solid #eef2f7" }}>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#b45309] mb-1.5">
                        {offeneAnzahl} ohne Ergebnis
                      </p>
                      {stand.offene.slice(0, 4).map((a) => (
                        <button key={a.id} type="button"
                                onClick={() => { setCallId(a.id); setNummer(a.nummer); setZustand("ergebnis"); }}
                                className="w-full text-left py-1.5 text-[12px] text-slate-600">
                          <b className="text-slate-800">{a.name}</b>
                          <span className="ml-2 text-slate-400">
                            {new Date(a.beginn).toLocaleString("de-DE", {
                              day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                              timeZone: "Europe/Berlin",
                            })}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

/** Von überall aus anrufen — die Kundenkarte schickt nur ein Ereignis. */
export function anrufStarten(nummer: string, personId?: number | null, name?: string): void {
  window.dispatchEvent(new CustomEvent("fiaon-anrufen", { detail: { nummer, personId, name } }));
}
