import { useCallback, useEffect, useRef, useState } from "react";
import { FiaonEbene } from "./FiaonEbene";

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
  const [tastenOffen, setTastenOffen] = useState(false);
  const [datum, setDatum] = useState("");
  const uhr = useRef<ReturnType<typeof setInterval> | null>(null);
  // Das Twilio-Gerät und die laufende Verbindung. Als Referenz, nicht als
  // Zustand: Ein neu gerendertes Gerät würde die Verbindung abreißen.
  const geraet = useRef<any>(null);
  const verbindung = useRef<any>(null);

  const laden = useCallback(async () => {
    const r = await fetch("/api/fiaon/telefon/stand", { credentials: "include" }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (j?.ok) setStand(j);
  }, []);

  useEffect(() => { void laden(); }, [laden]);

  // Ein Gespräch, das beim Seitenwechsel weiterläuft, kostet weiter Geld und
  // ist für den Kunden am anderen Ende eine offene Leitung ins Nichts.
  useEffect(() => () => {
    try { verbindung.current?.disconnect?.(); } catch { /* schon getrennt */ }
    try { geraet.current?.destroy?.(); } catch { /* schon weg */ }
  }, []);

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

    // ── Das Browser-SDK ──────────────────────────────────────────────────
    // NACHGELADEN, nicht importiert: Das Paket bringt rund 300 KB mit. Wer
    // nie telefoniert — und ohne Zugangsdaten telefoniert niemand — soll es
    // auch nicht herunterladen müssen.
    try {
      const { Device } = await import("@twilio/voice-sdk");
      geraet.current?.destroy?.();
      const d = new Device(j.token, {
        // Opus zuerst: bessere Sprachqualität bei gleicher Bandbreite.
        codecPreferences: ["opus", "pcmu"] as any,
        // Kein Klingeln im Browser — eingehende Rufe laufen extern.
        allowIncomingWhileBusy: false,
      });
      geraet.current = d;
      d.on("error", (e: any) => {
        setMeldung(`Telefonfehler: ${e?.message || "unbekannt"}`);
        setZustand("ergebnis");
      });
      const c = await d.connect({ params: { To: j.nummer } });
      verbindung.current = c;
      // „accept" ist der Moment, in dem der Gegenüber abnimmt — erst dann
      // läuft die Uhr. Sonst zählt sie das Klingeln mit, und die Dauer im
      // Protokoll passt nicht zur Twilio-Abrechnung.
      c.on("accept", () => { setSekunden(0); setZustand("gespraech"); });
      c.on("disconnect", () => { setZustand("ergebnis"); void laden(); });
      c.on("cancel", () => { setZustand("ergebnis"); void laden(); });
      c.on("reject", () => { setMeldung("Der Ruf wurde abgelehnt."); setZustand("ergebnis"); });
      setZustand("gespraech");
    } catch (err) {
      setMeldung(`Das Telefon konnte nicht starten: ${err instanceof Error ? err.message : String(err)}`);
      setZustand("ergebnis");
    }
  };

  const auflegen = () => {
    // Erst wirklich auflegen, dann die Oberfläche umschalten. Umgekehrt sähe
    // es beendet aus, während das Gespräch weiterläuft — und weiter kostet.
    try { verbindung.current?.disconnect?.(); } catch { /* schon getrennt */ }
    try { geraet.current?.destroy?.(); } catch { /* schon weg */ }
    verbindung.current = null;
    geraet.current = null;
    setZustand("ergebnis");
    void laden();
  };

  const stummSchalten = () => {
    const neu = !stumm;
    try { verbindung.current?.mute?.(neu); } catch { /* ohne Verbindung wirkungslos */ }
    setStumm(neu);
  };

  /** Eine Ziffer INS GESPRÄCH senden — für Sprachmenüs der Gegenseite. */
  const tasteSenden = (t: string) => {
    try { verbindung.current?.sendDigits?.(t); } catch { /* wirkungslos */ }
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
        /* ── DER SCHWEBENDE KNOPF ─────────────────────────────────────────
           Vier Schichten Schatten: ein weiter blauer Wurf für die Höhe, ein
           enger für die Kante, eine Lichtkante innen oben, ein Ring außen.
           Beim Zeigen kommt er dem Zeiger ENTGEGEN (translateZ auf einer
           eigenen perspective-Bühne) statt nur die Farbe zu wechseln — der
           Unterschied zwischen „anklickbar" und „will angefasst werden".

           Der weiche Ring darunter (::after) pulst langsam, solange nichts
           offen ist: eine Einladung, kein Alarm. */
        .fi-telefonknopf {
          perspective: 600px;
          transform-style: preserve-3d;
          transition:
            transform 300ms cubic-bezier(.32,.72,0,1),
            box-shadow 300ms cubic-bezier(.32,.72,0,1),
            filter 200ms;
        }
        .fi-telefonknopf::after {
          content: ""; position: absolute; inset: -9px; border-radius: 999px;
          background: radial-gradient(circle, rgba(37,99,235,.30), transparent 70%);
          opacity: 0; transition: opacity 300ms; pointer-events: none;
        }
        .fi-telefonknopf:hover {
          transform: translateY(-5px) translateZ(30px) scale(1.07);
          box-shadow:
            0 34px 68px -16px rgba(29,78,216,.82),
            0 10px 24px -10px rgba(29,78,216,.5),
            inset 0 1.5px 0 rgba(255,255,255,.42),
            0 0 0 1px rgba(255,255,255,.24);
          filter: brightness(1.06);
        }
        .fi-telefonknopf:hover::after { opacity: 1; }
        .fi-telefonknopf:active { transform: translateY(-1px) translateZ(6px) scale(1.005); }
        .fi-telefonknopf:focus-visible {
          outline: none;
          box-shadow:
            0 0 0 3px #fff, 0 0 0 6px rgba(37,99,235,.55),
            0 24px 50px -14px rgba(29,78,216,.7);
        }
        @media (max-width: 640px) { .fi-telefonknopf { right: 14px; bottom: 76px; } }
        @media (prefers-reduced-motion: reduce) {
          .fi-telefonknopf { transition: none !important; }
          .fi-telefonknopf:hover { transform: none; }
        }
      `}</style>

      {/* ── Das Gerät auf der FiaonEbene ───────────────────────────────
          Rechts unten angedockt, damit es aus dem Knopf zu wachsen scheint.
          Der Gerätekörper ist eine dunkle Fassung UM die helle Anzeige — ein
          Telefon bedient man anders als ein Formular, und die Form sagt einem
          das, bevor man liest. */}
      <FiaonEbene
        offen={offen} onZu={() => setOffen(false)}
        titel="Telefon"
        breite={356}
        andocken="rechts-unten"
        kopf={
          <div className="flex items-center gap-2">
            <span className="fi-tel-punkt" data-zustand={zustand} aria-hidden="true" />
            <span className="text-[10.5px] font-bold uppercase tracking-[.18em] text-slate-400 flex-1">
              {zustand === "gespraech" ? `Im Gespräch · ${dauerText(sekunden)}`
                : zustand === "waehlt" ? "Wird verbunden"
                : zustand === "ergebnis" ? "Wie lief es?"
                : stand.bereit ? "Bereit" : "Bald verfügbar"}
            </span>
            <button type="button" onClick={() => setOffen(false)} aria-label="Schließen" className="fi-ebene-kreuz">
              <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor"
                   strokeWidth={1.8} strokeLinecap="round"><path d="m5 5 10 10M15 5 5 15" /></svg>
            </button>
          </div>
        }
        kinder={
          <div className="fi-tel-koerper">
            <style>{TELEFON_CSS}</style>

            {kunde && <p className="fi-tel-kunde">{kunde.name}</p>}

            {/* ── Nicht eingerichtet: eine Karte, kein Fehlertext ───────── */}
            {!stand.bereit && (
              <div className="fi-tel-karte">
                <span className="fi-tel-karte-marke" aria-hidden="true"><MarkeHoerer size={22} /></span>
                <p className="fi-tel-karte-titel">Noch nicht freigeschaltet</p>
                <p className="fi-tel-karte-text">{stand.hinweis}</p>
                <p className="fi-tel-karte-klein">
                  Wähltastatur, Aufzeichnung, Gesprächsergebnis und die automatische
                  Zusammenfassung sind fertig gebaut. Es fehlt nur der Telefonanbieter.
                </p>
              </div>
            )}
            {stand.bereit && stand.testkonto && (
              <p className="fi-tel-karte-text" style={{ textAlign: "center", padding: "18px 0" }}>
                Testkonten können nicht telefonieren.
              </p>
            )}

            {/* ── Wählen ───────────────────────────────────────────────── */}
            {stand.bereit && !stand.testkonto && zustand === "bereit" && (
              <>
                <input value={nummer} onChange={(e) => setNummer(e.target.value)}
                       inputMode="tel" placeholder="+49 …" aria-label="Rufnummer"
                       className="fi-tel-anzeige" />
                <div className="fi-tel-tastatur">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((t) => (
                    <button key={t} type="button" onClick={() => setNummer((n) => n + t)} className="fi-tel-taste">
                      {t}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <button type="button" onClick={() => setNummer((n) => n.slice(0, -1))}
                          disabled={!nummer} className="fi-tel-neben">Löschen</button>
                  <button type="button" onClick={() => void waehlen()} disabled={nummer.length < 4}
                          className="fi-tel-gruen">
                    <MarkeHoerer size={17} /> Anrufen
                  </button>
                </div>
              </>
            )}

            {/* ── Verbinden / Gespräch ─────────────────────────────────── */}
            {(zustand === "waehlt" || zustand === "gespraech") && (
              <div style={{ textAlign: "center", padding: "6px 0" }}>
                <p className="fi-tel-uhr">{zustand === "gespraech" ? dauerText(sekunden) : "···"}</p>
                <p className="fi-tel-nummer">{nummer}</p>
                <p className="fi-tel-karte-klein" style={{ marginTop: 8 }}>
                  Zu Beginn läuft die Ansage zur Aufzeichnung. Höchstdauer {stand.maxMinuten} Minuten.
                </p>
                <div className="fi-tel-dreier">
                  <button type="button" onClick={stummSchalten}
                          className="fi-tel-neben" data-an={stumm ? "1" : "0"}>
                    {stumm ? "Stumm an" : "Stumm"}
                  </button>
                  <button type="button" onClick={() => setTastenOffen((t) => !t)}
                          className="fi-tel-neben" data-an={tastenOffen ? "1" : "0"}>
                    Tasten
                  </button>
                  <button type="button" onClick={auflegen} className="fi-tel-rot">Auflegen</button>
                </div>
                {tastenOffen && (
                  <div className="fi-tel-tastatur" style={{ marginTop: 10 }}>
                    {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((t) => (
                      <button key={t} type="button" onClick={() => tasteSenden(t)}
                              className="fi-tel-taste" style={{ height: 40, fontSize: 16 }}>
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Ergebnis ─────────────────────────────────────────────── */}
            {zustand === "ergebnis" && (
              <>
                <p className="fi-tel-karte-text" style={{ marginBottom: 10 }}>
                  Ein Klick, dann ist es dokumentiert — Wiedervorlage und Zusage setzt das System selbst.
                </p>
                {datumFeld && (
                  <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)}
                         aria-label="Datum" className="fi-tel-datum" />
                )}
                <div className="fi-tel-ergebnisse">
                  {ERGEBNISSE.map((e) => (
                    <button key={e.art} type="button"
                            onClick={() => {
                              if (e.braucht && datumFeld !== e.braucht) { setDatumFeld(e.braucht); return; }
                              void dokumentieren(e.art);
                            }}
                            className="fi-tel-ergebnis">
                      {e.label}
                    </button>
                  ))}
                </div>
              </>
            )}

            {meldung && <p className="fi-tel-meldung">{meldung}</p>}

            {/* ── Offene Gespräche ─────────────────────────────────────── */}
            {zustand === "bereit" && offeneAnzahl > 0 && (
              <div className="fi-tel-offen">
                <p className="fi-tel-offen-titel">{offeneAnzahl} ohne Ergebnis</p>
                {stand.offene.slice(0, 4).map((a) => (
                  <button key={a.id} type="button"
                          onClick={() => { setCallId(a.id); setNummer(a.nummer); setZustand("ergebnis"); }}
                          className="fi-tel-offen-zeile">
                    <b>{a.name}</b>
                    <span>{new Date(a.beginn).toLocaleString("de-DE", {
                      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                      timeZone: "Europe/Berlin",
                    })}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        }
      />
    </>
  );
}

/** Von überall aus anrufen — die Kundenkarte schickt nur ein Ereignis. */
export function anrufStarten(nummer: string, personId?: number | null, name?: string): void {
  window.dispatchEvent(new CustomEvent("fiaon-anrufen", { detail: { nummer, personId, name } }));
}


// ═══════════════════════════════════════════════════════════════════════════
// Das Gerät. Dunkle Fassung um eine helle Anzeige, Tasten mit Druckgefühl.
//
// Warum eine Fassung: Ein Telefon-Panel, das aussieht wie ein Formular, wird
// wie ein Formular bedient — man liest erst, dann klickt man. Ein Gerät greift
// man. Die Form entscheidet, wie schnell jemand ist.
// ═══════════════════════════════════════════════════════════════════════════
const TELEFON_CSS = `
/* Die Fassung: Der Körper der Ebene wird selbst dunkel, die Anzeige liegt
   als hellere Fläche darin. */
.fi-tel-koerper {
  margin: -18px -24px -22px;
  padding: 14px;
  background: linear-gradient(172deg, #101a2f, #0a1020 60%, #0d1428);
  min-height: 300px;
}
@media (max-width: 639px) { .fi-tel-koerper { margin: -15px -18px -20px; padding: 12px; } }

.fi-tel-koerper > * { position: relative; z-index: 1; }

.fi-tel-kunde {
  font-size: 13.5px; font-weight: 700; color: #e8eef8; margin: 0 0 11px;
  padding: 8px 12px; border-radius: 12px;
  background: rgba(255,255,255,.06);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.08);
  overflow-wrap: anywhere;
}

/* ── Statuspunkt im Kopf ───────────────────────────────────────────────── */
.fi-tel-punkt {
  width: 7px; height: 7px; border-radius: 99px; flex-shrink: 0;
  background: #cbd5e1;
}
.fi-tel-punkt[data-zustand="bereit"] { background: #94a3b8; }
.fi-tel-punkt[data-zustand="waehlt"] {
  background: #d97706;
  animation: fiTelPuls 1.1s ease-in-out infinite;
}
.fi-tel-punkt[data-zustand="gespraech"] {
  background: #059669;
  box-shadow: 0 0 0 3px rgba(5,150,105,.18);
  animation: fiTelPuls 1.8s ease-in-out infinite;
}
.fi-tel-punkt[data-zustand="ergebnis"] { background: #2563eb; }
@keyframes fiTelPuls { 0%,100% { opacity: 1 } 50% { opacity: .35 } }

/* ── Anzeige ───────────────────────────────────────────────────────────── */
.fi-tel-anzeige {
  width: 100%; text-align: center; background: none; border: 0; outline: none;
  font-size: 23px; font-weight: 600; letter-spacing: .04em;
  font-variant-numeric: tabular-nums; color: #f1f5f9;
  padding: 12px 0 14px;
}
.fi-tel-anzeige::placeholder { color: rgba(226,236,250,.28); }

.fi-tel-uhr {
  font-size: 27px; font-weight: 600; font-variant-numeric: tabular-nums;
  color: #f1f5f9; margin: 6px 0 0; letter-spacing: .03em;
}
.fi-tel-nummer { font-size: 13px; color: rgba(226,236,250,.55); margin: 2px 0 0; }

/* ── Tasten mit Druckgefühl ────────────────────────────────────────────── */
.fi-tel-tastatur { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.fi-tel-taste {
  height: 46px; border: 0; cursor: pointer;
  border-radius: 15px;
  font-size: 19px; font-weight: 600; color: #e8eef8;
  /* Zwei Verläufe: die Taste selbst und eine Lichtkante oben. Dazu ein
     Schatten UNTER der Taste — das ist der Unterschied zwischen einem Feld
     und einem Knopf, den man drücken kann. */
  background: linear-gradient(178deg, rgba(255,255,255,.11), rgba(255,255,255,.045));
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.16),
    inset 0 0 0 1px rgba(255,255,255,.06),
    0 3px 8px -3px rgba(0,0,0,.6);
  transition: transform 90ms cubic-bezier(.32,.72,0,1), box-shadow 90ms, background 140ms;
}
.fi-tel-taste:hover { background: linear-gradient(178deg, rgba(255,255,255,.15), rgba(255,255,255,.07)); }
.fi-tel-taste:active {
  /* Hineindrücken: nach unten UND der Schatten verschwindet. */
  transform: translateY(2px) scale(.975);
  box-shadow: inset 0 2px 5px rgba(0,0,0,.45), inset 0 0 0 1px rgba(255,255,255,.05);
}

/* ── Knöpfe ────────────────────────────────────────────────────────────── */
.fi-tel-neben {
  flex: 0 0 auto; padding: 0 13px; height: 46px; border: 0; cursor: pointer;
  border-radius: 14px; font-size: 12.5px; font-weight: 600; color: #cbd5e1;
  background: rgba(255,255,255,.07);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.08);
  transition: background 140ms, color 140ms, transform 90ms;
}
.fi-tel-neben:hover:not(:disabled) { background: rgba(255,255,255,.12); color: #fff; }
.fi-tel-neben:active:not(:disabled) { transform: translateY(1px); }
.fi-tel-neben:disabled { opacity: .3; cursor: default; }
.fi-tel-neben[data-an="1"] {
  background: linear-gradient(170deg, #2563eb, #1d4ed8); color: #fff;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.22), 0 6px 16px -8px rgba(37,99,235,.7);
}

.fi-tel-gruen, .fi-tel-rot {
  flex: 1 1 auto; height: 46px; border: 0; cursor: pointer; border-radius: 14px;
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  font-size: 15px; font-weight: 700; color: #fff;
  transition: transform 90ms, box-shadow 140ms, filter 140ms;
}
.fi-tel-gruen {
  background: linear-gradient(168deg, #10b981, #047857);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.24), 0 12px 26px -12px rgba(5,150,105,.75);
}
.fi-tel-rot {
  background: linear-gradient(168deg, #ef4444, #b91c1c);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.22), 0 12px 26px -12px rgba(185,28,28,.75);
  font-size: 12.5px;
}
.fi-tel-gruen:hover:not(:disabled), .fi-tel-rot:hover { filter: brightness(1.07); }
.fi-tel-gruen:active:not(:disabled), .fi-tel-rot:active { transform: translateY(2px) scale(.985); }
.fi-tel-gruen:disabled { opacity: .3; cursor: default; box-shadow: none; }

.fi-tel-dreier { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-top: 14px; }
.fi-tel-dreier > * { flex: 1 1 auto; }

/* ── Karte für „nicht eingerichtet" ────────────────────────────────────── */
.fi-tel-karte {
  padding: 20px 16px; border-radius: 18px; text-align: center;
  background: rgba(255,255,255,.05);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.08);
}
.fi-tel-karte-marke {
  display: inline-flex; align-items: center; justify-content: center;
  width: 48px; height: 48px; border-radius: 15px; margin-bottom: 11px;
  background: linear-gradient(160deg, rgba(59,130,246,.28), rgba(37,99,235,.12));
  color: #93c5fd;
  box-shadow: inset 0 0 0 1px rgba(147,197,253,.2);
}
.fi-tel-karte-titel { font-size: 14.5px; font-weight: 700; color: #f1f5f9; margin: 0; }
.fi-tel-karte-text {
  font-size: 12.5px; color: rgba(226,236,250,.66); line-height: 1.6; margin: 7px 0 0;
}
.fi-tel-karte-klein {
  font-size: 11.5px; color: rgba(226,236,250,.42); line-height: 1.55; margin: 11px 0 0;
}

/* ── Ergebnis-Knöpfe ───────────────────────────────────────────────────── */
.fi-tel-ergebnisse { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
.fi-tel-ergebnis {
  padding: 11px 10px; border: 0; cursor: pointer; border-radius: 13px;
  font-size: 12px; font-weight: 600; color: #e8eef8; text-align: left;
  background: rgba(255,255,255,.07);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.08);
  transition: background 140ms, transform 90ms;
}
.fi-tel-ergebnis:hover { background: rgba(37,99,235,.28); }
.fi-tel-ergebnis:active { transform: translateY(1px); }

.fi-tel-datum {
  width: 100%; padding: 11px 12px; margin-bottom: 8px; border: 0; border-radius: 13px;
  font-size: 13.5px; color: #f1f5f9; background: rgba(255,255,255,.08);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.1);
}
.fi-tel-meldung {
  margin: 12px 0 0; padding: 9px 12px; border-radius: 13px;
  font-size: 12px; line-height: 1.5;
  background: rgba(217,119,6,.16); color: #fcd34d;
  overflow-wrap: anywhere;
}

/* ── Offene Gespräche ──────────────────────────────────────────────────── */
.fi-tel-offen { margin-top: 16px; padding-top: 13px; box-shadow: inset 0 1px 0 rgba(255,255,255,.08); }
.fi-tel-offen-titel {
  font-size: 10px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
  color: #fcd34d; margin: 0 0 6px;
}
.fi-tel-offen-zeile {
  width: 100%; display: flex; gap: 8px; align-items: baseline;
  padding: 6px 0; background: none; border: 0; cursor: pointer; text-align: left;
  font-size: 12px; color: rgba(226,236,250,.6);
}
.fi-tel-offen-zeile b { color: #e8eef8; font-weight: 600; overflow-wrap: anywhere; }
.fi-tel-offen-zeile span { margin-left: auto; flex-shrink: 0; font-variant-numeric: tabular-nums; }

@media (prefers-reduced-motion: reduce) {
  .fi-tel-taste, .fi-tel-neben, .fi-tel-gruen, .fi-tel-rot, .fi-tel-ergebnis { transition: none !important; }
  .fi-tel-punkt { animation: none !important; }
}
`;
