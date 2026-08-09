import { useCallback, useEffect, useRef, useState } from "react";
import { FiaonGeraet, FiaonTastatur } from "@/components/FiaonGeraet";
import { telefonFehlerText } from "@shared/fiaon-telefon-fehler";
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

/**
 * Die Richtlinien-Tafel.
 *
 * ── WARUM SIE NICHT WEGKLICKBAR IST ────────────────────────────────────────
 * Man kann sie schließen — aber ohne Annahme bleibt das Wählen gesperrt, und
 * zwar SERVERSEITIG. Eine Tafel, die man einfach wegschiebt und danach
 * telefoniert, wäre eine Beruhigung für die Firma und keine Absicherung für
 * den Menschen, der aufzeichnet.
 */
function RichtlinienTafel({
  offen, daten, name, onName, gelesen, onGelesen, onZu, onAnnehmen,
}: {
  offen: boolean; daten: any;
  name: string; onName: (v: string) => void;
  gelesen: boolean; onGelesen: (v: boolean) => void;
  onZu: () => void; onAnnehmen: () => void;
}) {
  const t = daten?.text;
  return (
    <FiaonEbene
      offen={offen && !!t} onZu={onZu}
      titel={t?.ueberschrift ?? "Telefon-Richtlinie"}
      ueberschrift={daten?.neufassung ? "Neue Fassung — bitte erneut lesen" : "Vor dem ersten Anruf"}
      breite={640}
      kinder={t ? (
        <>
          <p className="text-[14.5px] font-bold" style={{ color: "var(--fi-text)" }}>{t.gratulation}</p>
          <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: "var(--fi-text-leise)" }}>
            {t.einleitung}
          </p>

          <p className="fi-ri-titel">Was du kannst</p>
          {t.kann.map((k: any) => (
            <div key={k.titel} className="fi-ri-kann">
              <p className="fi-ri-kann-titel">{k.titel}</p>
              <p className="fi-ri-kann-text">{k.text}</p>
            </div>
          ))}

          <p className="fi-ri-titel">Was ausdrücklich nicht geht</p>
          <ul className="fi-ri-nicht">
            {t.kannNicht.map((x: string) => <li key={x}>{x}</li>)}
          </ul>

          <p className="fi-ri-titel">Deine Zusagen</p>
          {t.pflichten.map((pf: any) => (
            <div key={pf.nr} className="fi-ri-pflicht">
              <span className="fi-ri-ziffer">{pf.nr}</span>
              <div className="min-w-0 flex-1">
                <p className="fi-ri-pflicht-titel">{pf.titel}</p>
                <p className="fi-ri-pflicht-text">{pf.text}</p>
              </div>
            </div>
          ))}

          <p className="mt-4 text-[13px] leading-relaxed" style={{ color: "var(--fi-text-leise)" }}>
            {t.schlusssatz}
          </p>
          <p className="mt-3 px-3.5 py-2.5 rounded-xl text-[11.5px] leading-relaxed"
             style={{ background: "rgba(15,23,42,.04)", color: "var(--fi-text-still)" }}>
            {t.hinweisProtokoll}
          </p>

          <label className="fi-ri-haken">
            <input type="checkbox" checked={gelesen} onChange={(e) => onGelesen(e.target.checked)} />
            <span>Ich habe die Richtlinie gelesen und verstanden.</span>
          </label>
          <input value={name} onChange={(e) => onName(e.target.value)}
                 placeholder="Dein vollständiger Name" aria-label="Name"
                 className="fi-ri-name" />
          <p className="mt-1.5 text-[11px]" style={{ color: "var(--fi-text-still)" }}>
            Deine Annahme wird mit Zeitpunkt, Fassung {t.version} und Gerätekennung festgehalten.
          </p>
          <style>{RICHTLINIE_CSS}</style>
        </>
      ) : null}
      fuss={
        <div className="flex items-center gap-2">
          <button type="button" onClick={onZu}
                  className="text-[13px] font-semibold" style={{ color: "var(--fi-text-still)" }}>
            Später
          </button>
          <button type="button" onClick={onAnnehmen}
                  disabled={!gelesen || name.trim().length < 3}
                  className="ml-auto fi-knopf-primaer px-5">
            Annehmen und telefonieren
          </button>
        </div>
      }
    />
  );
}

const RICHTLINIE_CSS = `
.fi-ri-titel {
  font-size: 10.5px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
  color: var(--fi-text-still, #64748b); margin: 22px 0 9px;
}
.fi-ri-kann {
  padding: 11px 14px; border-radius: 14px; margin-bottom: 7px;
  background: linear-gradient(158deg, rgba(59,130,246,.07), rgba(29,78,216,.025));
  box-shadow: inset 0 0 0 1px rgba(37,99,235,.14);
}
.fi-ri-kann-titel { font-size: 13px; font-weight: 700; color: #1d4ed8; margin: 0; }
.fi-ri-kann-text { font-size: 12.5px; line-height: 1.55; color: var(--fi-text-leise, #475569); margin: 2px 0 0; }
.fi-ri-nicht { margin: 0; padding-left: 18px; }
.fi-ri-nicht li {
  font-size: 12.5px; line-height: 1.6; color: #92400e; margin-bottom: 5px;
}
.fi-ri-pflicht { display: flex; gap: 12px; margin-bottom: 13px; }
.fi-ri-ziffer {
  flex-shrink: 0; width: 26px; height: 26px; border-radius: 9px;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 12.5px; font-weight: 700; color: #fff;
  background: linear-gradient(158deg, #2563eb, #1d4ed8);
  box-shadow: 0 5px 12px -6px rgba(29,78,216,.6);
}
.fi-ri-pflicht-titel { font-size: 13.5px; font-weight: 700; color: var(--fi-text, #0f172a); margin: 2px 0 0; }
.fi-ri-pflicht-text { font-size: 12.5px; line-height: 1.62; color: var(--fi-text-leise, #475569); margin: 3px 0 0; }
.fi-ri-haken {
  display: flex; align-items: flex-start; gap: 10px; margin-top: 18px; cursor: pointer;
  font-size: 13px; font-weight: 600; color: var(--fi-text, #0f172a);
}
.fi-ri-haken input { margin-top: 2px; width: 17px; height: 17px; flex-shrink: 0; }
.fi-ri-name {
  width: 100%; margin-top: 11px; padding: 11px 14px; border: 0; outline: none;
  border-radius: 14px; background: rgba(15,23,42,.04);
  box-shadow: inset 0 0 0 1px rgba(15,23,42,.08);
  font-size: 14px; font-family: inherit; color: var(--fi-text, #0f172a);
}
.fi-ri-name:focus { box-shadow: inset 0 0 0 1px rgba(37,99,235,.34), 0 0 0 4px rgba(37,99,235,.09); }
`;

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
  // Kundensuche im Display — man wählt einen Menschen, nicht eine Nummer.
  const [suche, setSuche] = useState("");
  const [treffer, setTreffer] = useState<any[]>([]);
  // Die Richtlinie: bis sie angenommen ist, sperrt der Server das Wählen.
  const [richtlinie, setRichtlinie] = useState<any>(null);
  const [tafelOffen, setTafelOffen] = useState(false);
  const [nameGetippt, setNameGetippt] = useState("");
  const [gelesen, setGelesen] = useState(false);
  const [ohneAufnahme, setOhneAufnahme] = useState(false);
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

  // ── HOOKS STEHEN VOR JEDEM RETURN ──────────────────────────────────────
  // Diese zwei Effekte standen zuerst weiter unten, hinter `if (!stand)
  // return null` — React zählt dann in zwei Durchläufen unterschiedlich viele
  // Hooks und bricht ab („Rendered more hooks than during the previous
  // render"). Die Seite war weiß.
  // Die Richtlinie beim Öffnen holen — nicht beim Wählen. Wer erst beim
  // Druck auf „Anrufen" erfährt, dass er etwas lesen muss, hat den Kunden
  // schon im Kopf.
  useEffect(() => {
    if (!offen) return;
    void fetch("/api/fiaon/telefon/richtlinie", { credentials: "include" })
      .then((r) => r.json()).then((j) => { if (j?.ok) setRichtlinie(j); })
      .catch(() => {});
  }, [offen]);

  // Kundensuche, entprellt.
  useEffect(() => {
    if (suche.trim().length < 2) { setTreffer([]); return; }
    const uhr = window.setTimeout(async () => {
      const r = await fetch(`/api/fiaon/telefon/suche?q=${encodeURIComponent(suche)}`,
        { credentials: "include" }).catch(() => null);
      const j = await r?.json().catch(() => null);
      setTreffer(j?.ok ? j.treffer : []);
    }, 280);
    return () => window.clearTimeout(uhr);
  }, [suche]);


  if (!stand) return null;

  const offeneAnzahl = stand.offene?.length ?? 0;

  const richtlinieAnnehmen = async () => {
    const r = await fetch("/api/fiaon/telefon/richtlinie", {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nameGetippt, gelesen, pruefwert: richtlinie?.pruefwert }),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (!j?.ok) { setMeldung(j?.error || "Annahme fehlgeschlagen."); return; }
    setTafelOffen(false);
    setRichtlinie((v: any) => v && { ...v, offen: false });
  };

  const aufnahmeStoppen = async () => {
    if (!callId) return;
    const r = await fetch(`/api/fiaon/telefon/${callId}/ohne-aufzeichnung`, {
      method: "POST", credentials: "include",
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setOhneAufnahme(true);
    setMeldung(j?.meldung || "Die Aufnahme ist beendet.");
  };

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
      // Der Server sperrt das Wählen, bis die Richtlinie angenommen ist
      // (HTTP 412). Statt einer Fehlermeldung öffnet sich dann die Tafel —
      // der Mensch soll lesen, nicht rätseln.
      if (j?.richtlinieOffen) {
        setRichtlinie((v: any) => ({ ...(v ?? {}), offen: true, neufassung: !!j.neufassung }));
        setTafelOffen(true);
        setMeldung(null);
        return;
      }
      setMeldung(j?.error || "Der Anruf konnte nicht aufgebaut werden.");
      return;
    }
    setCallId(j.callId);
    setSekunden(0);
    setOhneAufnahme(false);

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
        setMeldung(telefonFehlerText(e));
        setZustand("ergebnis");
      });
      // ── „To" IST BEI TWILIO RESERVIERT ────────────────────────────────
      // Das Browser-SDK setzt `To` selbst — auf die Client-Identität, nicht
      // auf die gewählte Nummer. Ein eigener Parameter mit diesem Namen wird
      // dabei überschrieben. Im Twilio-Log stand deshalb bei jedem
      // Browser-Anruf eine LEERE To-Spalte, und die TwiML-Antwort konnte
      // keine Nummer wählen — obwohl die Selbstdiagnose alles grün meldete.
      //
      // `An` ist nicht reserviert und kommt unverändert an. `Ziel` geht als
      // zweiter Name mit: kostet nichts und überlebt eine Umbenennung.
      const c = await d.connect({ params: { An: j.nummer, Ziel: j.nummer } });
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
      // NICHT `err.message`: Twilio-Fehler SIND Error-Instanzen, tragen ihre
      // Aussage aber in code/description/explanation. In Produktion stand
      // deshalb „Das Telefon konnte nicht starten: undefined".
      setMeldung(telefonFehlerText(err));
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
      {/* ══════════════════════════════════════════════════════════════════
          DAS GERÄT
          Vorher lag das Telefon als Ebene rechts unten am Rand. Der
          Vorgesetzte wollte ein zentriertes Gerät — und er hat recht: Ein
          Anruf ist keine Randnotiz, sondern das Einzige, was man in dieser
          Minute tut.
          ══════════════════════════════════════════════════════════════════ */}
      <FiaonGeraet offen={offen} onZu={() => setOffen(false)} titel="Telefon">
        <style>{TELEFON_CSS}</style>

        {/* ── Statuszeile im Display ──────────────────────────────────── */}
        <div className="fi-tel-statuszeile">
          <span className="fi-tel-punkt" data-zustand={zustand} aria-hidden="true" />
          <span className="fi-tel-status-text">
            {zustand === "gespraech" ? `Im Gespräch · ${dauerText(sekunden)}`
              : zustand === "waehlt" ? "Wird verbunden"
              : zustand === "ergebnis" ? "Wie lief es?"
              : stand.bereit ? "Bereit" : "Bald verfügbar"}
          </span>
          <button type="button" onClick={() => setOffen(false)} aria-label="Schließen"
                  className="fi-tel-zu">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor"
                 strokeWidth={1.8} strokeLinecap="round"><path d="m5 5 10 10M15 5 5 15" /></svg>
          </button>
        </div>

        {/* ── Die Richtlinie ist nicht angenommen ─────────────────────── */}
        {richtlinie?.offen && zustand === "bereit" && (
          <button type="button" onClick={() => setTafelOffen(true)} className="fi-tel-sperre">
            <span className="fi-tel-sperre-marke" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor"
                   strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <rect x="4.5" y="9" width="11" height="8" rx="2" />
                <path d="M7 9V6.8a3 3 0 0 1 6 0V9" />
              </svg>
            </span>
            <span className="min-w-0 flex-1 text-left">
              <span className="fi-tel-sperre-titel">
                {richtlinie.neufassung ? "Neue Fassung der Richtlinie" : "Telefon-Richtlinie lesen"}
              </span>
              <span className="fi-tel-sperre-text">
                Bevor du zum ersten Mal wählst — vier Absätze, sie betreffen dich persönlich.
              </span>
            </span>
          </button>
        )}

        {kunde && <p className="fi-tel-kunde">{kunde.name}</p>}

        {/* ── Nicht eingerichtet ──────────────────────────────────────── */}
        {!stand.bereit && (
          <div className="fi-tel-karte">
            <span className="fi-tel-karte-marke" aria-hidden="true"><MarkeHoerer size={22} /></span>
            <p className="fi-tel-karte-titel">Noch nicht freigeschaltet</p>
            <p className="fi-tel-karte-text">{stand.hinweis}</p>
          </div>
        )}
        {stand.bereit && stand.testkonto && (
          <p className="fi-tel-karte-text" style={{ textAlign: "center", padding: "18px 0" }}>
            Testkonten können nicht telefonieren.
          </p>
        )}

        {/* ── Wählen ──────────────────────────────────────────────────── */}
        {stand.bereit && !stand.testkonto && zustand === "bereit" && !richtlinie?.offen && (
          <>
            {/* Kundensuche zuerst: Man ruft einen Menschen an, nicht eine
                Nummer. Die Nummer ist das Ergebnis, nicht der Anfang. */}
            {!kunde && (
              <div className="fi-tel-suche-feld">
                <input value={suche} onChange={(e) => setSuche(e.target.value)}
                       placeholder="Kunde suchen …" aria-label="Kunde suchen"
                       className="fi-tel-suche" />
                {treffer.length > 0 && (
                  <div className="fi-tel-treffer">
                    {treffer.slice(0, 5).map((t: any) => (
                      <button key={t.personId} type="button" className="fi-tel-treffer-zeile"
                              onClick={() => {
                                setKunde({ personId: t.personId, name: t.name });
                                setNummer(t.nummer || "");
                                setSuche(""); setTreffer([]);
                              }}>
                        <b>{t.name}</b><span>{t.nummer}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <input value={nummer} onChange={(e) => setNummer(e.target.value)}
                   inputMode="tel" placeholder="+49 …" aria-label="Rufnummer"
                   className="fi-tel-anzeige" />

            <FiaonTastatur onZiffer={(z) => setNummer((n) => n + z)}
                           onLoeschen={() => setNummer((n) => n.slice(0, -1))} />

            {/* ── DER PFLICHTSATZ ─────────────────────────────────────────
                Er steht ÜBER dem Anrufknopf, nicht darunter und nicht in
                einem Hinweisfeld. Wer ihn vergisst, macht sich nach
                § 201 StGB persönlich strafbar — das ist keine Zeile für
                das Kleingedruckte. */}
            {richtlinie?.hinweisSatz && (
              <p className="fi-tel-pflichtsatz">
                <span className="fi-tel-pflichtsatz-marke">Zu Beginn sagen</span>
                „{richtlinie.hinweisSatz}“
              </p>
            )}

            <button type="button" onClick={() => void waehlen()} disabled={nummer.length < 4}
                    className="fi-tel-gruen">
              <MarkeHoerer size={19} /> Anrufen
            </button>
            {kunde && (
              <button type="button" onClick={() => { setKunde(null); setNummer(""); }}
                      className="fi-tel-neben" style={{ width: "100%", marginTop: 8 }}>
                Anderen Kunden wählen
              </button>
            )}
          </>
        )}

        {/* ── Verbinden / Gespräch ────────────────────────────────────── */}
        {(zustand === "waehlt" || zustand === "gespraech") && (
          <div style={{ textAlign: "center", paddingTop: 18 }}>
            <p className="fi-tel-gross-name">{kunde?.name ?? nummer}</p>
            <p className="fi-tel-uhr">{zustand === "gespraech" ? dauerText(sekunden) : "···"}</p>
            {kunde && <p className="fi-tel-nummer">{nummer}</p>}

            {!ohneAufnahme ? (
              <button type="button" onClick={() => void aufnahmeStoppen()} className="fi-tel-widerspruch">
                Ohne Aufzeichnung fortsetzen
              </button>
            ) : (
              <p className="fi-tel-ohne-marke">Aufzeichnung beendet — auf Kundenwunsch</p>
            )}

            <div className="fi-tel-dreier">
              <button type="button" onClick={stummSchalten}
                      className="fi-tel-rund" data-an={stumm ? "1" : "0"} aria-label="Stumm">
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3Z" />
                  <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
                  {stumm && <path d="m4 4 16 16" />}
                </svg>
              </button>
              <button type="button" onClick={auflegen} className="fi-tel-auflegen" aria-label="Auflegen">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"
                     style={{ transform: "rotate(135deg)" }}>
                  <path d="M4.5 3.5h3.6l1.8 4.5-2.3 1.4a12 12 0 0 0 5.5 5.5l1.4-2.3 4.5 1.8v3.6a1.5 1.5 0 0 1-1.7 1.5A16.5 16.5 0 0 1 3 5.2 1.5 1.5 0 0 1 4.5 3.5Z" />
                </svg>
              </button>
              <button type="button" onClick={() => setTastenOffen((t) => !t)}
                      className="fi-tel-rund" data-an={tastenOffen ? "1" : "0"} aria-label="Tastatur">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  {[0, 1, 2].map((r) => [0, 1, 2].map((c) => (
                    <circle key={`${r}-${c}`} cx={6 + c * 6} cy={5 + r * 6} r="1.5" />
                  )))}
                </svg>
              </button>
            </div>

            {tastenOffen && (
              <div style={{ marginTop: 14 }}>
                <FiaonTastatur klein onZiffer={tasteSenden} />
              </div>
            )}
            <p className="fi-tel-karte-klein" style={{ marginTop: 14 }}>
              Höchstdauer {stand.maxMinuten} Minuten.
            </p>
          </div>
        )}

        {/* ── Ergebnis ───────────────────────────────────────────────── */}
        {zustand === "ergebnis" && (
          <>
            <p className="fi-tel-karte-text" style={{ marginBottom: 12 }}>
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

        {/* ── Offene Gespräche ───────────────────────────────────────── */}
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
      </FiaonGeraet>

      {/* ── Die Richtlinien-Tafel ───────────────────────────────────────── */}
      <RichtlinienTafel
        offen={tafelOffen}
        daten={richtlinie}
        name={nameGetippt} onName={setNameGetippt}
        gelesen={gelesen} onGelesen={setGelesen}
        onZu={() => setTafelOffen(false)}
        onAnnehmen={() => void richtlinieAnnehmen()}
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
/* ═══════════════════════════════════════════════════════════════════════════
   IM DISPLAY — helle Schrift auf dunklem CI-Navy
   Alles hier lebt im Gerätekörper (FiaonGeraet). Deshalb sind die Farben
   umgekehrt zum Rest des Systems: hell auf dunkel, nicht dunkel auf hell.
   ═══════════════════════════════════════════════════════════════════════════ */

.fi-tel-statuszeile {
  display: flex; align-items: center; gap: 9px; margin-bottom: 16px;
}
.fi-tel-status-text {
  flex: 1 1 auto; font-size: 10.5px; font-weight: 700;
  letter-spacing: .18em; text-transform: uppercase;
  color: rgba(191,214,247,.7); font-variant-numeric: tabular-nums;
}
.fi-tel-zu {
  flex-shrink: 0; width: 28px; height: 28px; border: 0; cursor: pointer;
  border-radius: 999px; display: inline-flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,.09); color: rgba(238,243,251,.8);
}
.fi-tel-zu:hover { background: rgba(255,255,255,.16); color: #fff; }

/* Der Statuspunkt pulst im Gespräch — dort ist die Zeit das Wichtigste. */
.fi-tel-punkt {
  width: 8px; height: 8px; border-radius: 999px; flex-shrink: 0;
  background: rgba(191,214,247,.5);
}
.fi-tel-punkt[data-zustand="waehlt"] { background: #fcd34d; animation: fiTelPuls 1.1s ease-in-out infinite; }
.fi-tel-punkt[data-zustand="gespraech"] { background: #34d399; animation: fiTelPuls 1.6s ease-in-out infinite; }
.fi-tel-punkt[data-zustand="ergebnis"] { background: #fb923c; }
@keyframes fiTelPuls {
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 currentColor; }
  50% { opacity: .55; box-shadow: 0 0 0 5px rgba(255,255,255,.06); }
}

/* ── Die Sperre, solange die Richtlinie offen ist ──────────────────────── */
.fi-tel-sperre {
  width: 100%; display: flex; align-items: center; gap: 12px;
  padding: 14px 15px; border: 0; cursor: pointer; border-radius: 18px;
  background: linear-gradient(158deg, rgba(252,211,77,.16), rgba(217,119,6,.08));
  box-shadow: inset 0 0 0 1px rgba(252,211,77,.28);
  transition: box-shadow 200ms, transform 160ms;
}
.fi-tel-sperre:hover { transform: translateY(-1px); box-shadow: inset 0 0 0 1px rgba(252,211,77,.5); }
.fi-tel-sperre-marke {
  width: 36px; height: 36px; border-radius: 12px; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  background: rgba(252,211,77,.18); color: #fcd34d;
}
.fi-tel-sperre-titel { display: block; font-size: 13.5px; font-weight: 700; color: #fde68a; }
.fi-tel-sperre-text { display: block; font-size: 11.5px; color: rgba(253,230,138,.72); margin-top: 2px; line-height: 1.45; }

/* ── Kundensuche und Anzeige ───────────────────────────────────────────── */
.fi-tel-suche-feld { position: relative; margin-bottom: 12px; }
.fi-tel-suche {
  width: 100%; height: 42px; padding: 0 15px; border: 0; outline: none;
  border-radius: 999px; background: rgba(255,255,255,.08);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.1);
  font-size: 14px; color: #eef3fb; font-family: inherit;
}
.fi-tel-suche::placeholder { color: rgba(191,214,247,.5); }
.fi-tel-suche:focus { background: rgba(255,255,255,.13); box-shadow: inset 0 0 0 1px rgba(147,197,253,.4); }
.fi-tel-treffer {
  position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 10;
  border-radius: 16px; overflow: hidden; padding: 5px;
  background: rgba(13,28,63,.96);
  backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px);
  box-shadow: 0 24px 50px -20px rgba(3,8,22,.9), inset 0 0 0 1px rgba(255,255,255,.1);
}
.fi-tel-treffer-zeile {
  width: 100%; display: flex; align-items: baseline; gap: 8px;
  padding: 9px 11px; border: 0; cursor: pointer; border-radius: 11px;
  background: none; text-align: left; transition: background 140ms;
}
.fi-tel-treffer-zeile:hover { background: rgba(255,255,255,.09); }
.fi-tel-treffer-zeile b { font-size: 13.5px; font-weight: 600; color: #eef3fb; }
.fi-tel-treffer-zeile span {
  margin-left: auto; font-size: 11.5px; color: rgba(191,214,247,.62);
  font-variant-numeric: tabular-nums;
}

.fi-tel-kunde {
  text-align: center; font-size: 15px; font-weight: 700; color: #eef3fb;
  margin: 0 0 12px; letter-spacing: -.01em;
}
.fi-tel-anzeige {
  width: 100%; text-align: center; border: 0; outline: none; background: none;
  font-size: 27px; font-weight: 300; letter-spacing: .02em;
  color: #eef3fb; padding: 8px 0 16px; font-variant-numeric: tabular-nums;
  font-family: inherit;
}
.fi-tel-anzeige::placeholder { color: rgba(191,214,247,.34); }

/* ── Der Pflichtsatz ──────────────────────────────────────────────────────
   Er steht ÜBER dem Anrufknopf. Wer ihn vergisst, macht sich persönlich
   strafbar — deshalb keine kleine graue Zeile. */
.fi-tel-pflichtsatz {
  margin: 18px 0 14px; padding: 12px 14px; border-radius: 15px;
  background: linear-gradient(158deg, rgba(255,255,255,.09), rgba(255,255,255,.04));
  box-shadow: inset 0 0 0 1px rgba(147,197,253,.2);
  font-size: 12.5px; line-height: 1.55; color: #dbe8fb; font-style: italic;
}
.fi-tel-pflichtsatz-marke {
  display: block; font-size: 9.5px; font-weight: 700; letter-spacing: .14em;
  text-transform: uppercase; color: #93c5fd; margin-bottom: 5px; font-style: normal;
}

/* ── Knöpfe ────────────────────────────────────────────────────────────── */
.fi-tel-gruen {
  width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 9px;
  height: 54px; border: 0; cursor: pointer; border-radius: 999px;
  font-size: 15.5px; font-weight: 650; color: #fff;
  background: linear-gradient(178deg, #34d399, #10b981 58%, #059669);
  box-shadow: 0 16px 34px -14px rgba(5,150,105,.8), inset 0 1px 0 rgba(255,255,255,.3);
  transition: transform 140ms, filter 180ms, box-shadow 200ms;
}
.fi-tel-gruen:hover:not(:disabled) { filter: brightness(1.07); transform: translateY(-1.5px); }
.fi-tel-gruen:active:not(:disabled) { transform: translateY(1px) scale(.99); box-shadow: inset 0 2px 6px rgba(3,40,26,.5); }
.fi-tel-gruen:disabled { opacity: .3; box-shadow: none; cursor: default; }

.fi-tel-neben {
  height: 40px; padding: 0 16px; border: 0; cursor: pointer; border-radius: 999px;
  font-size: 12.5px; font-weight: 600; color: rgba(238,243,251,.82);
  background: rgba(255,255,255,.08);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.09);
  transition: background 160ms;
}
.fi-tel-neben:hover:not(:disabled) { background: rgba(255,255,255,.15); }
.fi-tel-neben:disabled { opacity: .35; cursor: default; }
.fi-tel-neben[data-an="1"] { background: rgba(147,197,253,.24); color: #fff; }

.fi-tel-dreier {
  display: flex; align-items: center; justify-content: center; gap: 26px; margin-top: 26px;
}
.fi-tel-rund {
  width: 54px; height: 54px; border: 0; cursor: pointer; border-radius: 999px;
  display: inline-flex; align-items: center; justify-content: center;
  color: rgba(238,243,251,.86);
  background: linear-gradient(178deg, rgba(255,255,255,.14), rgba(255,255,255,.06));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.2), 0 6px 14px -8px rgba(0,0,0,.7);
  transition: background 160ms, transform 100ms;
}
.fi-tel-rund:hover { background: rgba(255,255,255,.2); }
.fi-tel-rund:active { transform: scale(.93); }
.fi-tel-rund[data-an="1"] { background: #eef3fb; color: #0a1a3c; }
.fi-tel-auflegen {
  width: 66px; height: 66px; border: 0; cursor: pointer; border-radius: 999px;
  display: inline-flex; align-items: center; justify-content: center; color: #fff;
  background: linear-gradient(178deg, #f87171, #ef4444 58%, #dc2626);
  box-shadow: 0 16px 34px -12px rgba(220,38,38,.8), inset 0 1px 0 rgba(255,255,255,.3);
  transition: transform 120ms, filter 180ms;
}
.fi-tel-auflegen:hover { filter: brightness(1.08); }
.fi-tel-auflegen:active { transform: scale(.93); }

.fi-tel-widerspruch {
  margin-top: 18px; padding: 10px 18px; border: 0; cursor: pointer; border-radius: 999px;
  font-size: 12.5px; font-weight: 650; color: #fde68a;
  background: rgba(252,211,77,.13);
  box-shadow: inset 0 0 0 1px rgba(252,211,77,.3);
  transition: background 160ms;
}
.fi-tel-widerspruch:hover { background: rgba(252,211,77,.22); }
.fi-tel-ohne-marke {
  margin-top: 18px; font-size: 12px; font-weight: 650; color: #fcd34d;
}

/* ── Gespräch ──────────────────────────────────────────────────────────── */
.fi-tel-gross-name {
  font-size: 22px; font-weight: 600; color: #eef3fb; margin: 0;
  letter-spacing: -.015em; overflow-wrap: anywhere;
}
.fi-tel-uhr {
  font-size: 34px; font-weight: 200; color: #eef3fb; margin: 8px 0 0;
  font-variant-numeric: tabular-nums; letter-spacing: .03em;
}
.fi-tel-nummer {
  font-size: 13px; color: rgba(191,214,247,.62); margin: 4px 0 0;
  font-variant-numeric: tabular-nums;
}

/* ── Karten und Randfälle ──────────────────────────────────────────────── */
.fi-tel-karte {
  text-align: center; padding: 26px 18px; border-radius: 20px;
  background: linear-gradient(158deg, rgba(255,255,255,.08), rgba(255,255,255,.035));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.12), inset 0 0 0 1px rgba(255,255,255,.07);
}
.fi-tel-karte-marke {
  width: 46px; height: 46px; border-radius: 15px; margin: 0 auto 12px;
  display: inline-flex; align-items: center; justify-content: center;
  background: rgba(147,197,253,.16); color: #93c5fd;
}
.fi-tel-karte-titel { font-size: 15px; font-weight: 700; color: #eef3fb; margin: 0; }
.fi-tel-karte-text {
  font-size: 12.5px; line-height: 1.6; color: rgba(191,214,247,.78); margin: 7px 0 0;
}
.fi-tel-karte-klein { font-size: 11px; line-height: 1.55; color: rgba(191,214,247,.55); margin: 8px 0 0; }

.fi-tel-datum {
  width: 100%; height: 44px; padding: 0 14px; border: 0; outline: none;
  border-radius: 14px; margin-bottom: 11px;
  background: rgba(255,255,255,.09); color: #eef3fb;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.1);
  font-size: 14px; font-family: inherit;
}
.fi-tel-ergebnisse { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.fi-tel-ergebnis {
  padding: 13px 11px; border: 0; cursor: pointer; border-radius: 15px;
  font-size: 12.5px; font-weight: 600; color: #eef3fb; text-align: center;
  background: linear-gradient(178deg, rgba(255,255,255,.12), rgba(255,255,255,.06));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.16);
  transition: background 160ms, transform 110ms;
}
.fi-tel-ergebnis:hover { background: rgba(255,255,255,.2); }
.fi-tel-ergebnis:active { transform: scale(.97); }

.fi-tel-meldung {
  margin-top: 14px; padding: 11px 14px; border-radius: 14px;
  background: rgba(252,211,77,.12); color: #fde68a;
  font-size: 12px; line-height: 1.55; font-weight: 600;
}

.fi-tel-offen { margin-top: 22px; padding-top: 16px; box-shadow: inset 0 1px 0 rgba(255,255,255,.09); }
.fi-tel-offen-titel {
  font-size: 10.5px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase;
  color: #fcd34d; margin: 0 0 8px;
}
.fi-tel-offen-zeile {
  width: 100%; display: flex; align-items: baseline; gap: 8px;
  padding: 9px 12px; border: 0; cursor: pointer; border-radius: 12px;
  background: rgba(255,255,255,.055); margin-bottom: 5px; text-align: left;
  transition: background 150ms;
}
.fi-tel-offen-zeile:hover { background: rgba(255,255,255,.12); }
.fi-tel-offen-zeile b { font-size: 13px; font-weight: 600; color: #eef3fb; }
.fi-tel-offen-zeile span {
  margin-left: auto; font-size: 11px; color: rgba(191,214,247,.6);
  font-variant-numeric: tabular-nums;
}

@media (prefers-reduced-motion: reduce) {
  .fi-tel-punkt { animation: none !important; }
  .fi-tel-gruen, .fi-tel-rund, .fi-tel-auflegen, .fi-tel-ergebnis { transition: none !important; }
}
`;

