import { useCallback, useEffect, useRef, useState } from "react";
import { FiaonGeraet, FiaonTastatur } from "@/components/FiaonGeraet";
import { telefonFehler, telefonFehlerText } from "@shared/fiaon-telefon-fehler";
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
  // ── AUTO-ADVANCE ────────────────────────────────────────────────────────
  // Wen haben wir in dieser Sitzung schon dokumentiert? Ohne diese Liste
  // schlägt das Telefon denselben Menschen wieder vor — die Wiedervorlage
  // steht zwar auf morgen, aber die Kundenliste im Server kennt sie erst nach
  // dem nächsten Ladevorgang.
  const [erledigte, setErledigte] = useState<number[]>([]);
  // Kam dieser Kunde aus der Liste (statt von Hand eingetippt)? Nur dann
  // zeigen wir die Marke „Nächster aus deiner Liste".
  const [ausListe, setAusListe] = useState(false);
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
  // ── ERREICHBARKEIT UND EINGEHENDE ANRUFE ────────────────────────────────
  // „Erreichbar" heißt: Twilio kennt diesen Browser und kann ihn klingeln
  // lassen. Es steht klein im Display — wer es nicht ist, soll das wissen,
  // bevor ein Kunde vergeblich anruft.
  const [erreichbar, setErreichbar] = useState(false);
  const [eingehend, setEingehend] = useState<{
    ruf: any; von: string;
    kunde: { id: number; name: string; paket: string | null; tageOffen: number | null; offenCents: number } | null;
    grund: string | null;
    fuerMich: boolean | null;
  } | null>(null);
  const [gelesen, setGelesen] = useState(false);
  const [ohneAufnahme, setOhneAufnahme] = useState(false);
  // Der Stand des Mikrofonrechts. Wird VOR dem ersten Wählversuch geklärt.
  const [mikrofon, setMikrofon] = useState<"offen" | "erlaubt" | "verweigert">("offen");
  // Hat das SDK schon einen Fehler MIT Twilio-Code gemeldet? Dann bleibt der
  // stehen — ein Code ist genauer als jede Vermutung.
  const codeGesehen = useRef(false);
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
  // ══════════════════════════════════════════════════════════════════════════
  // EIN HAKEN FÜR DIE ABNAHME
  //
  // ── WARUM ER NICHT AM GERÄT HÄNGT ────────────────────────────────────────
  // Erster Versuch: den Haken beim Aufbau des Twilio-Geräts setzen. Er wurde
  // nie gesetzt — das Gerät entsteht erst beim WÄHLEN, und lokal fehlen die
  // Zugangsdaten. Die Abnahme meldete „Testhaken fehlt".
  //
  // Ein echter eingehender Anruf braucht Twilio und einen Anrufer. Geprüft
  // werden soll aber die OBERFLÄCHE: Erscheint das Fenster, steht der richtige
  // Name darin, sind die Knöpfe zu treffen. Dafür genügt derselbe Zustand,
  // den das Ereignis setzen würde.
  //
  // Die Attrappe erzeugt KEINEN Anruf: `accept` und `reject` tun nichts.
  // ══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    (window as any).__fiaonTelefonTest = (von: string) => {
      setEingehend({
        ruf: { accept: () => {}, reject: () => {}, on: () => {} },
        von, kunde: null, grund: null, fuerMich: null,
      });
      void fetch(`/api/fiaon/telefon/eingehend/wer-ist-zustaendig?von=${encodeURIComponent(von)}`,
        { credentials: "include" })
        .then((r) => r.json())
        .then((j) => {
          if (!j?.ok) return;
          setEingehend((v) => v && v.von === von
            ? { ...v, kunde: j.kunde, grund: j.grund, fuerMich: j.fuerMich } : v);
        })
        .catch(() => {});
    };
    return () => { delete (window as any).__fiaonTelefonTest; };
  }, []);

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


  /**
   * Der Sparmodus.
   *
   * ── WARUM DIESER HAKEN HIER OBEN STEHT ────────────────────────────────────
   * Er stand zuerst hinter `if (!stand) return null;`. Der Browser meldete
   * „Rendered more hooks than during the previous render", und das ganze
   * Telefon verschwand hinter einem roten Fehlerfenster.
   *
   * React zählt Haken. Läuft einer nicht bei JEDEM Durchgang, verrutscht die
   * Zuordnung aller folgenden. Weder `tsc --noEmit` noch `vite build` finden
   * das — beide waren grün. Erst der laufende Browser zeigte es.
   *
   * ── DIE RÜCKMELDUNG ───────────────────────────────────────────────────────
   * Ein Agent (iPhone 15 Pro Max): „Am Laptop funktioniert es sehr gut — keine
   * Verzögerungen, keine Störgeräusche. Am Handy reagiert die Oberfläche
   * zeitversetzt, Buttons hängen kurz, und während des Telefonats habe ich
   * immer wieder ein starkes Klackern."
   *
   * Es liegt nicht am Gerät. Ein `backdrop-filter` auf einer
   * bildschirmfüllenden Fläche zwingt Safari, bei jedem Bild den gesamten
   * Hintergrund neu zu zeichnen. Läuft daneben WebRTC, konkurrieren Zeichnen
   * und Audio-Verarbeitung um dieselbe Rechenzeit — die Audio-Puffer laufen
   * leer, und das hört man als Klackern.
   *
   * Diese Marke am <body> schaltet die teuren Effekte ab, solange ein Ruf
   * läuft. Sie steht am body und nicht an einer Komponente, weil auch die
   * Seite DAHINTER Effekte hat: Der Space zeichnet ein Video, die
   * Mail-Zentrale eine Glasfläche. Beide malen weiter, während man
   * telefoniert — und beide sieht man in dem Moment gar nicht.
   */
  useEffect(() => {
    const laeuft = zustand === "waehlt" || zustand === "gespraech";
    // An der WURZEL, nicht am <body>: Das Gerät hängt in einem Portal, das
    // nicht unter <body> sitzt — eine body-Regel griff nachweislich nicht.
    const wurzel = document.documentElement;
    if (laeuft) wurzel.setAttribute("data-gespraech", "1");
    else wurzel.removeAttribute("data-gespraech");
    return () => wurzel.removeAttribute("data-gespraech");
  }, [zustand]);

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

  /**
   * Einen Browser-Fehler an den Server melden.
   *
   * ── WARUM DAS NÖTIG IST ───────────────────────────────────────────────────
   * Ein Fehler, der nur im Browser des Nutzers erscheint, ist aus der Ferne
   * nicht einkreisbar. Der Vorgesetzte kann einen Schnappschuss schicken —
   * aber ein Schnappschuss zeigt den Text, nicht das Objekt.
   *
   * Diese Meldung landet in der Telefon-Diagnose als Schritt 10. Beim
   * nächsten Mal kann ich sagen, WAS geworfen wurde, statt zu raten.
   */
  const fehlerMelden = async (wo: string, err: unknown) => {
    const e = (err ?? {}) as any;
    await fetch("/api/fiaon/telefon/browser-fehler", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wo,
        name: e?.name ?? null,
        code: e?.code ?? null,
        message: e?.message ?? null,
        description: e?.description ?? null,
        explanation: e?.explanation ?? null,
        causes: Array.isArray(e?.causes) ? e.causes.slice(0, 4) : null,
        // Die Browserkennung sagt, ob es ein iPhone ist — dort gelten
        // eigene Regeln für Mikrofon und Autoplay.
        browser: navigator.userAgent.slice(0, 200),
        roh: (() => {
          try { return JSON.stringify(err, Object.getOwnPropertyNames(e ?? {})).slice(0, 600); }
          catch { return String(err).slice(0, 600); }
        })(),
      }),
    }).catch(() => {});
  };

  /**
   * Warum ging das Mikrofon nicht auf?
   *
   * Die Browser werfen hier fünf verschiedene Namen, und jeder bedeutet etwas
   * anderes für den Menschen davor. „NotSupportedError" ist der tückischste:
   * Er heißt fast immer „keine https-Verbindung" — und niemand käme von dem
   * Wort auf diese Ursache.
   */
  const mikrofonGrund = (err: unknown): string => {
    const name = (err as any)?.name ?? "";
    switch (name) {
      case "NotAllowedError":
      case "PermissionDeniedError":
        return "Der Browser hat das Mikrofon nicht freigegeben. Klicke links in der Adresszeile "
          + "auf das Schloss (am iPhone auf „aA“) und erlaube das Mikrofon — danach die Seite "
          + "einmal neu laden.";
      case "NotFoundError":
      case "DevicesNotFoundError":
        return "Es ist kein Mikrofon angeschlossen. Ohne Mikrofon kann dich niemand hören.";
      case "NotReadableError":
      case "TrackStartError":
        return "Das Mikrofon ist von einem anderen Programm belegt. Schließe andere Telefon- "
          + "oder Besprechungsprogramme und versuche es erneut.";
      case "NotSupportedError":
        // Der häufigste Grund ist eine unsichere Herkunft. Browser geben für
        // getUserMedia auf http:// kein Mikrofon heraus — und melden das mit
        // diesem völlig unverständlichen Namen.
        return window.location.protocol !== "https:"
          ? `Diese Seite läuft über ${window.location.protocol.replace(":", "")} statt https. `
            + "Browser geben ein Mikrofon nur über eine gesicherte Verbindung heraus. "
            + "Öffne das Portal über https://www.fiaon.com."
          : "Dieser Browser unterstützt keinen Mikrofonzugriff. Auf dem iPhone braucht es Safari; "
            + "andere Browser auf iOS können kein WebRTC-Audio.";
      case "OverconstrainedError":
        return "Das angeschlossene Mikrofon passt nicht zu den Anforderungen. Wähle in den "
          + "Systemeinstellungen ein anderes Eingabegerät.";
      case "SecurityError":
        return "Der Browser hat den Zugriff aus Sicherheitsgründen blockiert. Das passiert bei "
          + "eingebetteten Seiten — öffne das Portal in einem eigenen Tab.";
      default:
        return `Das Mikrofon konnte nicht geöffnet werden${name ? ` (${name})` : ""}. `
          + "Der Vorgesetzte sieht den genauen Grund unter Einstellungen → Telefon.";
    }
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
    codeGesehen.current = false;

    // ── Das Browser-SDK ──────────────────────────────────────────────────
    // NACHGELADEN, nicht importiert: Das Paket bringt rund 300 KB mit. Wer
    // nie telefoniert — und ohne Zugangsdaten telefoniert niemand — soll es
    // auch nicht herunterladen müssen.
    // ══════════════════════════════════════════════════════════════════════
    // SCHRITT 1: DAS MIKROFON — VOR ALLEM ANDEREN
    //
    // ── DER FEHLER, DEN DAS BEHEBT ────────────────────────────────────────
    // Im Panel stand „Das Telefon konnte nicht starten, und der Fehler nennt
    // keinen Grund". Das ist mein eigener Rückfalltext für ein Fehlerobjekt,
    // in dem nichts Brauchbares steht.
    //
    // Ursache: Es gab KEINEN EINZIGEN getUserMedia-Aufruf im ganzen Panel.
    // Das Mikrofonrecht wurde nie angefragt. Twilios `connect()` fragt es
    // intern nach — und wenn der Nutzer es nie erteilt hat, wirft das SDK
    // einen Fehler, der je nach Browser und Fassung LEER sein kann. Genau
    // dieser leere Fehler landete in meinem Rückfalltext.
    //
    // Jetzt wird zuerst gefragt, und zwar mit eigener Meldung. Ein
    // Mikrofonrecht, das der Browser verweigert, ist kein Telefonfehler —
    // es ist eine Einstellung, die der Mensch selbst ändern kann.
    // ══════════════════════════════════════════════════════════════════════
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setZustand("bereit");
        setMeldung(
          "Dieser Browser kann kein Mikrofon freigeben. Auf dem iPhone braucht es Safari, "
          + "auf dem Rechner Chrome, Edge oder Safari — und in jedem Fall eine "
          + "https-Verbindung.",
        );
        return;
      }
      const strom = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Sofort wieder freigeben: Twilio holt sich seinen eigenen Strom. Wer
      // den hier offen lässt, hat in manchen Browsern zwei belegte Mikrofone
      // und eine leuchtende Anzeige, die nach dem Auflegen bleibt.
      for (const spur of strom.getTracks()) spur.stop();
      setMikrofon("erlaubt");
    } catch (err) {
      setZustand("bereit");
      setMikrofon("verweigert");
      setMeldung(mikrofonGrund(err));
      void fehlerMelden("mikrofon-vor-wahl", err);
      return;
    }

    // ══════════════════════════════════════════════════════════════════════
    // SCHRITT 2: DAS SDK
    // ══════════════════════════════════════════════════════════════════════
    let Device: any;
    try {
      ({ Device } = await import("@twilio/voice-sdk"));
    } catch (err) {
      // Ein fehlgeschlagenes Nachladen ist KEIN Telefonfehler: Es ist eine
      // Netzsache oder eine veraltete Fassung im Browser-Zwischenspeicher.
      setZustand("bereit");
      setMeldung(
        "Das Telefon-Modul konnte nicht geladen werden. Lade die Seite einmal hart neu "
        + "(Strg+Umschalt+R bzw. Cmd+Umschalt+R). Bleibt es dabei, ist die Verbindung gestört.",
      );
      void fehlerMelden("sdk-laden", err);
      return;
    }

    try {
      geraet.current?.destroy?.();
      const d = new Device(j.token, {
        // Opus zuerst: bessere Sprachqualität bei gleicher Bandbreite.
        codecPreferences: ["opus", "pcmu"] as any,
        // ── NICHT KLINGELN, WÄHREND MAN TELEFONIERT ────────────────────
        // Der Vorgesetzte: „Irgendwie bauen, dass es smart ist und nicht
        // stört!" Genau das ist hier gemeint: Wer gerade im Gespräch ist,
        // wird nicht unterbrochen. Twilio geht dann selbst zur nächsten
        // Stelle in der Kette weiter (siehe fiaon-anruf-eingehend.ts).
        allowIncomingWhileBusy: false,
      });
      geraet.current = d;
      d.on("error", (e: any) => {
        // ── DIESE MELDUNG HAT VORRANG ───────────────────────────────────
        // Der Device-Fehler trägt den TWILIO-CODE — er ist immer genauer als
        // meine Vermutung im catch-Zweig. Gemessen: Hier kam
        // „AccessTokenInvalid (20101)", während die Vermutung nur „fast immer
        // ein API-Key" sagen konnte. Der Code nennt es genau.
        //
        // `codeGesehen` merkt sich das, damit der nachfolgende catch-Zweig
        // die genaue Meldung nicht durch eine allgemeine ersetzt.
        codeGesehen.current = true;
        setMeldung(telefonFehlerText(e));
        void fehlerMelden("device-error", e);
        setZustand("ergebnis");
      });

      // ══════════════════════════════════════════════════════════════════
      // register() — JETZT RICHTIG
      //
      // ── DIE GESCHICHTE DIESER ZEILE ───────────────────────────────────
      // Heute Morgen hatte ich hier `await d.register()` eingebaut, in der
      // Annahme, es mache den Aufbau verlässlicher. Es machte ihn kaputt:
      // `register()` meldet das Gerät für EINGEHENDE Anrufe an, und der
      // Ausweis trug damals `incomingAllow: false`. Eine Anmeldung für
      // Eingang auf einem Ausweis ohne Eingangsrecht scheitert — mit einem
      // LEEREN Fehler, der geworfene Wert war buchstäblich `undefined`.
      //
      // Jetzt trägt der Ausweis `incomingAllow: true`, weil der Vorgesetzte
      // eingehende Anrufe braucht. Damit ist register() nicht nur erlaubt,
      // sondern NÖTIG: Ohne Anmeldung weiß Twilio nicht, dass dieser Browser
      // erreichbar ist, und das TwiML findet den Client „agent-<id>" nicht.
      //
      // ── ES SCHEITERT LEISE, WENN ES SCHEITERT ─────────────────────────
      // Ein ausgehender Anruf braucht register() NICHT. Wenn die Anmeldung
      // also fehlschlägt, darf sie das Telefonieren nicht verhindern — dann
      // ist man eben nur nicht erreichbar. Deshalb `.catch()` mit Vermerk
      // statt eines Abbruchs.
      // ══════════════════════════════════════════════════════════════════
      void d.register().then(() => {
        setErreichbar(true);
      }).catch((e: any) => {
        setErreichbar(false);
        // Kein setMeldung: Der Mensch wollte anrufen, nicht erreichbar sein.
        // Eine Fehlermeldung über die Erreichbarkeit würde hier nur den
        // Wählvorgang überdecken.
        console.warn("[TELEFON] Anmeldung für eingehende Anrufe fehlgeschlagen:", e);
        void fehlerMelden("register", e);
      });

      // ── EIN EINGEHENDER ANRUF ─────────────────────────────────────────
      // Er wird NICHT automatisch angenommen. Der Mensch sieht, wer anruft
      // und warum, und entscheidet. Ein Telefon, das von selbst abhebt, ist
      // ein Lautsprecher im Büro.
      d.on("incoming", (ruf: any) => {
        const von = String(ruf?.parameters?.From || "");
        setEingehend({ ruf, von, kunde: null, grund: null, fuerMich: null });
        // Wer ist das? Die Antwort kommt in Millisekunden und steht dann im
        // Klingelfenster — der Mensch weiß beim Abnehmen schon, worum es geht.
        void fetch(`/api/fiaon/telefon/eingehend/wer-ist-zustaendig?von=${encodeURIComponent(von)}`,
          { credentials: "include" })
          .then((r) => r.json())
          .then((j) => {
            if (!j?.ok) return;
            setEingehend((v) => v && v.von === von
              ? { ...v, kunde: j.kunde, grund: j.grund, fuerMich: j.fuerMich } : v);
          })
          .catch(() => {});
        // Legt der Anrufer auf, bevor jemand abnimmt, verschwindet das
        // Fenster von selbst. Ein Klingelfenster, das stehen bleibt, ist ein
        // Fehlalarm, den man wegklicken muss.
        ruf.on("cancel", () => setEingehend(null));
        ruf.on("disconnect", () => setEingehend(null));
        ruf.on("reject", () => setEingehend(null));
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
      void fehlerMelden("connect", err);
      if (codeGesehen.current) { setZustand("ergebnis"); return; }
      const f = telefonFehler(err);
      // ── EIN LEERER WURF IST EINE EIGENE AUSSAGE ───────────────────────
      // Gemessen: Der geworfene Wert war `undefined` — kein Objekt, keine
      // Nachricht, nichts. Das passiert beim Twilio-SDK, wenn die Verbindung
      // abbricht, bevor sie zustande kam: kein Netz zu Twilio, ein Ausweis,
      // den der Dienst ablehnt, oder eine Firewall, die WebRTC blockt.
      //
      // Vorher endete der Weg bei „der Fehler nennt keinen Grund". Das war
      // ehrlich und nutzlos. Jetzt stehen die drei Ursachen da, die es sein
      // können — und die Reihenfolge ist nach Häufigkeit sortiert.
      setMeldung(err === undefined || err === null
        ? "Das Telefon hat die Verbindung zu Twilio nicht aufbauen können und keinen Grund "
          + "genannt. Die drei häufigsten Ursachen, in dieser Reihenfolge:\n\n"
          + "1. Eine Firewall blockt WebRTC (UDP 10000–20000). Probiere ein anderes Netz — "
          + "am Handy einmal über Mobilfunk statt WLAN.\n"
          + "2. Der Zugangsausweis wurde abgelehnt. Der Vorgesetzte prüft das unter "
          + "Einstellungen → Telefon.\n"
          + "3. Eine alte Fassung im Browser. Lade die Seite hart neu "
          + "(Strg+Umschalt+R bzw. Cmd+Umschalt+R)."
        : f.code === null && !/Twilio-Fehler/.test(f.titel)
          ? `${telefonFehlerText(err)}\n\nRohfassung: ${f.roh.slice(0, 300)}`
          : telefonFehlerText(err));
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
    if (!j?.ok) return;

    setCallId(null);
    void laden();

    // ══════════════════════════════════════════════════════════════════════
    // AUTO-ADVANCE: DER NÄCHSTE KOMMT VON SELBST
    //
    // ── DER ANLASS ────────────────────────────────────────────────────────
    // Ein Agent, sinngemäß: „Wenn ich ‚Nicht erreicht' klicke, lande ich
    // wieder auf der Wähltastatur — mit der Nummer DESSELBEN Kunden. Um zum
    // nächsten zu kommen, muss ich auf ‚Anderen Kunden wählen', und dort steht
    // ein leeres Suchfeld. Ich muss die Nummer von Hand eintippen."
    //
    // Bisher: `setZustand("bereit")` — und `nummer` blieb stehen. Zwei Klicks
    // und eine Sucheingabe zwischen zwei Anrufen. Bei sechzig Gesprächen am
    // Tag sind das zwei Minuten reines Klicken; schlimmer ist der Bruch im
    // Rhythmus. Wer abarbeitet, will nicht suchen.
    //
    // ── WARUM NICHT AUTOMATISCH WÄHLEN ────────────────────────────────────
    // Der nächste Kunde wird GELADEN, nicht angerufen. Ein Telefon, das von
    // selbst wählt, nimmt dem Menschen die Entscheidung — und wer gerade
    // Luft holen oder eine Notiz zu Ende schreiben will, hat schon einen
    // klingelnden Hörer am Ohr. Ein Klick bleibt; zwei fallen weg.
    // ══════════════════════════════════════════════════════════════════════
    const erledigtJetzt = kunde?.personId ? [...erledigte, kunde.personId] : erledigte;
    setErledigte(erledigtJetzt);

    const n = await fetch(
      `/api/fiaon/telefon/naechster?ausser=${erledigtJetzt.join(",")}`,
      { credentials: "include" },
    ).catch(() => null);
    const nj = await n?.json().catch(() => null);

    if (nj?.ok && nj.kunde) {
      // Die Nummer steht, der Name steht — es fehlt nur noch der Griff zum
      // grünen Knopf. Die Marke „Nächster aus deiner Liste" sagt, woher er
      // kommt: Ein Kunde, der ungefragt im Wählfeld auftaucht, verunsichert.
      setNummer(nj.kunde.nummer);
      setKunde({ personId: nj.kunde.personId, name: nj.kunde.name });
      setAusListe(true);
      setZustand("bereit");
    } else {
      setNummer("");
      setKunde(null);
      setAusListe(false);
      setZustand("bereit");
      if (nj?.hinweis) setMeldung(`${j?.meldung ? `${j.meldung} ` : ""}${nj.hinweis}`);
    }
  };

  return (
    <>
      <style>{EINGEHEND_CSS}</style>

      {/* ══════════════════════════════════════════════════════════════════════
          DAS KLINGELFENSTER

          ── DER AUFTRAG (11.08.2026) ─────────────────────────────────────────
          Der Vorgesetzte: „Wenn der Kunde anruft, muss stehen, wer dafür
          zuständig ist, damit der richtige rangeht! Irgendwie bauen, dass es
          smart ist und nicht stört!"

          Also: KEIN Vollbild, keine Musik, kein Blockieren der Seite. Eine
          Karte oben rechts, die sagt, was man wissen muss, um in zwei Sekunden
          zu entscheiden:

            WER ruft an (Name, nicht nur die Nummer)
            WARUM landet er bei MIR (offene Rate? mein Kunde? Vertretung?)
            WAS ist offen (Betrag und Tage — der erste Satz am Telefon)

          Und wenn es NICHT für mich ist, steht das dort: „Vertretung für
          Diana". Dann weiß man, dass man nur einspringt.
          ══════════════════════════════════════════════════════════════════════ */}
      {eingehend && (
        <div className="fi-ein" role="alertdialog" aria-live="assertive"
             aria-label={`Anruf von ${eingehend.kunde?.name ?? eingehend.von}`}>
          <div className="fi-ein-kopf">
            <span className="fi-ein-puls" aria-hidden="true" />
            <span className="fi-ein-marke">
              {eingehend.fuerMich === false ? "Anruf · Vertretung" : "Anruf"}
            </span>
            <span className="fi-ein-nummer">{eingehend.von}</span>
          </div>

          <p className="fi-ein-name">
            {eingehend.kunde?.name ?? "Unbekannte Nummer"}
          </p>

          {/* Der Grund steht groß: Er entscheidet, wie das Gespräch beginnt. */}
          {eingehend.grund && (
            <p className="fi-ein-grund"
               data-dringend={eingehend.kunde?.tageOffen != null ? "1" : "0"}>
              {eingehend.grund}
            </p>
          )}

          {eingehend.kunde?.paket && (
            <p className="fi-ein-paket">{eingehend.kunde.paket}</p>
          )}

          {eingehend.fuerMich === false && (
            <p className="fi-ein-vertretung">
              Eigentlich zuständig ist jemand anderes — du springst ein.
            </p>
          )}

          <div className="fi-ein-tun">
            <button type="button" className="fi-ein-an"
                    onClick={() => {
                      // ── ANNEHMEN ─────────────────────────────────────────
                      // Das Telefon geht auf, damit man Notizen und Ergebnis
                      // gleich zur Hand hat. Ohne das müsste man während des
                      // Gesprächs erst suchen.
                      try { eingehend.ruf.accept(); } catch { /* schon weg */ }
                      setOffen(true);
                      setZustand("gespraech");
                      if (eingehend.kunde) {
                        // Der Kunde ist damit gesetzt: Ergebnis festhalten,
                        // Notiz und Akte beziehen sich auf ihn.
                        setKunde({ personId: eingehend.kunde.id, name: eingehend.kunde.name });
                        setNummer(eingehend.von);
                      }
                      setEingehend(null);
                    }}>
              Annehmen
            </button>
            <button type="button" className="fi-ein-ab"
                    onClick={() => {
                      // ── ABLEHNEN GIBT WEITER, ES BEENDET NICHT ───────────
                      // `reject()` sagt Twilio „nicht bei mir" — die Kette
                      // läuft dann zur nächsten Stelle. Der Kunde landet also
                      // nicht im Nichts, sondern beim Kollegen.
                      try { eingehend.ruf.reject(); } catch { /* schon weg */ }
                      setEingehend(null);
                    }}>
              Weitergeben
            </button>
          </div>
        </div>
      )}

      {/* ── Der schwebende Knopf ─────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        aria-label={offen ? "Telefon schließen" : "Telefon öffnen"}
        className="fi-telefonknopf fixed z-[290] flex items-center justify-center"
        style={{
          // 12 px über der unteren Kante statt 20: Auf 380 px steht darunter
          // die Filterleiste, und ein Knopf, der Bedienelemente verdeckt, ist
          // kein Knopf, sondern ein Hindernis.
          right: 16, bottom: 12, width: 58, height: 58, borderRadius: 999,
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
        {/* Der Sparmodus steht in index.css, nicht hier: Er gilt auch für die
            Seite DAHINTER — Space-Video, Mail-Glasflächen, Blasen-Schatten.
            Als Komponenten-Stil griff er nicht; die Stile der Komponenten
            werden später eingefügt und gewinnen bei gleicher Spezifität. */}

        {/* ── Statuszeile im Display ──────────────────────────────────── */}
        <div className="fi-tel-statuszeile">
          <span className="fi-tel-punkt" data-zustand={zustand} aria-hidden="true" />
          <span className="fi-tel-status-text">
            {zustand === "gespraech" ? `Im Gespräch · ${dauerText(sekunden)}`
              : zustand === "waehlt" ? "Wird verbunden"
              : zustand === "ergebnis" ? "Wie lief es?"
              // ── ERREICHBAR HEISST: ES KANN KLINGELN ─────────────────────
              // Wer den Tab schließt, ist nicht erreichbar — und ein Kunde
              // ruft dann vergeblich an. Das steht hier, damit es niemand
              // erst merkt, wenn sich jemand beschwert.
              : stand.bereit ? (erreichbar ? "Bereit · erreichbar" : "Bereit") : "Bald verfügbar"}
          </span>
          <button type="button" onClick={() => setOffen(false)} aria-label="Schließen"
                  className="fi-tel-zu">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor"
                 strokeWidth={1.8} strokeLinecap="round"><path d="m5 5 10 10M15 5 5 15" /></svg>
          </button>
        </div>

        {/* ── Die Richtlinie ist nicht angenommen ─────────────────────── */}
        {/* ══════════════════════════════════════════════════════════════════
            DIE RICHTLINIE STEHT IM DISPLAY

            ── DER BEFUND ────────────────────────────────────────────────────
            Der Vorgesetzte: „Man kann als neuer Mitarbeiter die Telefon-
            Richtlinie nicht bestätigen, es erscheint hinter dem Telefon (da
            ist alles geblurt, man erkennt nichts). Wenn man dann rausgeht und
            das bestätigt und seinen Namen eintippt, geht es noch immer nicht!"

            Zwei Fehler in einem:
            1. Die Tafel lag bei z-index 400, das Gerät bei 420. Sie erschien
               zwangsläufig HINTER einer Fläche mit 20 px Weichzeichnung.
            2. Wer sie doch erreichte, musste das Telefon verlassen — und kam
               in einen Zustand, in dem zwei Fenster übereinander um dieselbe
               Entscheidung baten.

            Die Lösung ist keine höhere Zahl, sondern ein anderer Ort: Die
            Annahme gehört DORTHIN, wo sie gebraucht wird. Wer das Telefon
            öffnet und noch nicht angenommen hat, liest und unterschreibt im
            Display — ohne es zu verlassen.
            ══════════════════════════════════════════════════════════════════ */}
        {richtlinie?.offen && zustand === "bereit" && (
          <div className="fi-tel-richtlinie">
            <p className="fi-tel-ri-kopf">
              {richtlinie.neufassung ? "Neue Fassung — bitte erneut lesen" : "Vor dem ersten Anruf"}
            </p>
            <p className="fi-tel-ri-titel">
              {richtlinie.text?.ueberschrift ?? "Telefon-Richtlinie"}
            </p>

            {/* Der volle Text, rollbar. Nicht gekürzt: Eine Erklärung, die man
                unterschreibt, muss man auch lesen können. */}
            <div className="fi-tel-ri-text">
              {richtlinie.text?.gratulation && (
                <p className="fi-tel-ri-stark">{richtlinie.text.gratulation}</p>
              )}
              {richtlinie.text?.einleitung && <p>{richtlinie.text.einleitung}</p>}

              {(richtlinie.text?.kann ?? []).length > 0 && (
                <>
                  <p className="fi-tel-ri-zwisch">Was du kannst</p>
                  {richtlinie.text.kann.map((k: any) => (
                    <p key={k.titel}><b>{k.titel}.</b> {k.text}</p>
                  ))}
                </>
              )}
              {(richtlinie.text?.kannNicht ?? []).length > 0 && (
                <>
                  <p className="fi-tel-ri-zwisch">Was ausdrücklich nicht geht</p>
                  {richtlinie.text.kannNicht.map((x: string) => (
                    <p key={x} className="fi-tel-ri-nicht">{x}</p>
                  ))}
                </>
              )}
              {(richtlinie.text?.pflichten ?? []).length > 0 && (
                <>
                  <p className="fi-tel-ri-zwisch">Deine Zusagen</p>
                  {richtlinie.text.pflichten.map((pf: any) => (
                    <p key={pf.nr}><b>{pf.nr}. {pf.titel}.</b> {pf.text}</p>
                  ))}
                </>
              )}
              {richtlinie.text?.schlusssatz && <p>{richtlinie.text.schlusssatz}</p>}
              {richtlinie.text?.hinweisProtokoll && (
                <p className="fi-tel-ri-leise">{richtlinie.text.hinweisProtokoll}</p>
              )}
            </div>

            <label className="fi-tel-ri-haken">
              <input type="checkbox" checked={gelesen}
                     onChange={(e) => setGelesen(e.target.checked)} />
              <span>Ich habe die Richtlinie gelesen und verstanden.</span>
            </label>
            <input value={nameGetippt} onChange={(e) => setNameGetippt(e.target.value)}
                   placeholder="Dein vollständiger Name" aria-label="Vollständiger Name"
                   className="fi-tel-ri-name" autoComplete="name" />
            <button type="button" onClick={() => void richtlinieAnnehmen()}
                    disabled={!gelesen || nameGetippt.trim().length < 3}
                    className="fi-tel-ri-knopf">
              Annehmen und telefonieren
            </button>
            <p className="fi-tel-ri-fuss">
              Festgehalten mit Zeitpunkt, Fassung {richtlinie.text?.version ?? "—"} und Gerätekennung.
            </p>
          </div>
        )}

        {kunde && <p className="fi-tel-kunde">{kunde.name}</p>}

        {/* ══════════════════════════════════════════════════════════════════
            DAS MIKROFON — UNABHÄNGIG VON ALLEM ANDEREN
            Der Knopf stand zuerst INNERHALB des Wähl-Bereichs und war damit
            nur sichtbar, wenn Twilio eingerichtet ist. Zwei Fehler darin:
            Das Mikrofonrecht hat mit Twilio nichts zu tun, und ich konnte es
            lokal nicht prüfen, weil dort keine Zugangsdaten liegen.

            Jetzt steht er ganz oben. Wer das Panel öffnet, kann das Recht
            erteilen — während er den Kunden sucht, nicht in der Sekunde, in
            der er anrufen will.
            ══════════════════════════════════════════════════════════════════ */}
            {/* ── DAS MIKROFON, BEVOR ES DARAUF ANKOMMT ───────────────────
            Der Nutzer soll das Recht erteilen, während er den Kunden
            sucht — nicht in der Sekunde, in der er anrufen will. Wer
            erst beim Wählen gefragt wird, hat den Kunden im Kopf und
            klickt die Frage weg. */}
        {mikrofon !== "erlaubt" && (
          <button type="button"
                  onClick={async () => {
                    try {
                      const st = await navigator.mediaDevices.getUserMedia({ audio: true });
                      for (const t of st.getTracks()) t.stop();
                      setMikrofon("erlaubt");
                      setMeldung(null);
                    } catch (e) {
                      setMikrofon("verweigert");
                      setMeldung(mikrofonGrund(e));
                      void fehlerMelden("mikrofon-knopf", e);
                    }
                  }}
                  className="fi-tel-mikrofon" data-stand={mikrofon}>
            <span className="fi-tel-mikrofon-marke" aria-hidden="true">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3Z" />
                <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
              </svg>
            </span>
            <span className="min-w-0 flex-1 text-left">
              <span className="fi-tel-mikrofon-titel">
            {mikrofon === "verweigert" ? "Mikrofon ist gesperrt" : "Mikrofon erlauben"}
              </span>
              <span className="fi-tel-mikrofon-text">
            {mikrofon === "verweigert"
                  ? "Ohne Mikrofon kann dich niemand hören. Erlaube es im Browser und tippe hier erneut."
                  : "Einmal antippen, damit der Browser fragt. Ohne Freigabe kann kein Anruf aufgebaut werden."}
              </span>
            </span>
          </button>
        )}


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
            {/* ── DER NÄCHSTE AUS DER LISTE ─────────────────────────────────
                Nach einem dokumentierten Ergebnis steht er hier schon: Name,
                Nummer, ein Griff zum grünen Knopf. Die Marke sagt, woher er
                kommt — ein Kunde, der ungefragt im Wählfeld auftaucht,
                verunsichert mehr, als er hilft. */}
            {kunde && ausListe && (
              <div className="fi-tel-naechster">
                <span className="fi-tel-naechster-marke">Nächster aus deiner Liste</span>
                <span className="fi-tel-naechster-name">{kunde.name}</span>
                <button type="button"
                        onClick={() => { setKunde(null); setNummer(""); setAusListe(false); }}
                        className="fi-tel-naechster-weg">
                  Anderen wählen
                </button>
              </div>
            )}

            {/* Kundensuche zuerst: Man ruft einen Menschen an, nicht eine
                Nummer. Die Nummer ist das Ergebnis, nicht der Anfang. */}
            {!kunde && (
              <button type="button"
                      onClick={async () => {
                        // Für den Fall, dass jemand mitten in der Liste
                        // aussteigt und wieder einsteigen will.
                        const n = await fetch(
                          `/api/fiaon/telefon/naechster?ausser=${erledigte.join(",")}`,
                          { credentials: "include" },
                        ).catch(() => null);
                        const nj = await n?.json().catch(() => null);
                        if (nj?.ok && nj.kunde) {
                          setNummer(nj.kunde.nummer);
                          setKunde({ personId: nj.kunde.personId, name: nj.kunde.name });
                          setAusListe(true);
                          setMeldung(null);
                        } else setMeldung(nj?.hinweis || "Keiner mehr offen.");
                      }}
                      className="fi-tel-holen">
                Nächsten aus meiner Liste holen
              </button>
            )}

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
                                setAusListe(false);
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

            <button type="button" onClick={() => void waehlen()}
                    disabled={nummer.length < 4 || mikrofon === "verweigert"}
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

      {/* ── DIE TAFEL ALS RÜCKFALL, ÜBER DEM GERÄT ───────────────────────
          Der Vorgesetzte: „Es erscheint hinter dem Telefon (da ist alles
          geblurt, man erkennt nichts)."

          Gemessen: Das Gerät liegt bei z-index 420, die Ebene bei 400. Die
          Tafel lag zwangsläufig darunter.

          Der Hauptweg führt jetzt durch das Display selbst — diese Tafel
          bleibt für den Fall, dass jemand sie von anderswo öffnet. Die
          Hülle hebt sie über das Gerät. */}
      <div className="fi-ri-ueber-geraet">
      <RichtlinienTafel
        offen={tafelOffen}
        daten={richtlinie}
        name={nameGetippt} onName={setNameGetippt}
        gelesen={gelesen} onGelesen={setGelesen}
        onZu={() => setTafelOffen(false)}
        onAnnehmen={() => void richtlinieAnnehmen()}
      />
      </div>
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

/* ── Die Richtlinie IM Display ─────────────────────────────────────────────
   Sie lag zuerst als eigene Ebene HINTER dem Gerät (z-index 400 gegen 420) —
   sichtbar nur als Schemen hinter einer Weichzeichnung. Jetzt steht sie dort,
   wo sie gebraucht wird. */
.fi-tel-richtlinie {
  margin-bottom: 14px; padding: 16px 16px 14px; border-radius: 20px;
  background: linear-gradient(178deg, rgba(252,211,77,.1), rgba(217,119,6,.05));
  box-shadow: inset 0 0 0 1px rgba(252,211,77,.26);
}
.fi-tel-ri-kopf {
  font-size: 9.5px; font-weight: 700; letter-spacing: .11em; text-transform: uppercase;
  color: #fcd34d; margin-bottom: 4px;
}
.fi-tel-ri-titel {
  font-size: 15.5px; font-weight: 700; color: #eef3fb; line-height: 1.3; margin-bottom: 10px;
}
/* Rollbar mit fester Höhe: Der volle Text passt nicht in ein Telefondisplay,
   und ihn zu kürzen wäre bei einer Erklärung, die man unterschreibt, falsch. */
.fi-tel-ri-text {
  max-height: 232px; overflow-y: auto; padding-right: 8px;
  font-size: 12.5px; line-height: 1.62; color: rgba(203,222,248,.86);
  -webkit-overflow-scrolling: touch;
}
.fi-tel-ri-text p { margin: 0 0 8px; }
.fi-tel-ri-text b { color: #eef3fb; font-weight: 650; }
.fi-tel-ri-stark { font-weight: 650; color: #eef3fb !important; }
.fi-tel-ri-zwisch {
  margin: 13px 0 6px !important; font-size: 10px; font-weight: 700;
  letter-spacing: .1em; text-transform: uppercase; color: rgba(148,183,236,.8);
}
.fi-tel-ri-nicht { padding-left: 14px; position: relative; }
.fi-tel-ri-nicht::before {
  content: ""; position: absolute; left: 2px; top: 8px;
  width: 5px; height: 5px; border-radius: 999px; background: rgba(252,165,165,.7);
}
.fi-tel-ri-leise { font-size: 11.5px; color: rgba(148,183,236,.62); }
.fi-tel-ri-text::-webkit-scrollbar { width: 4px; }
.fi-tel-ri-text::-webkit-scrollbar-thumb {
  background: rgba(148,183,236,.28); border-radius: 999px;
}

.fi-tel-ri-haken {
  display: flex; align-items: flex-start; gap: 9px; margin-top: 13px; cursor: pointer;
  font-size: 12.5px; line-height: 1.45; color: #eef3fb;
}
.fi-tel-ri-haken input {
  width: 17px; height: 17px; margin-top: 1px; flex-shrink: 0; accent-color: #3b82f6;
}
.fi-tel-ri-name {
  width: 100%; margin-top: 10px; padding: 11px 14px; border: 0; border-radius: 14px;
  font-size: 14px; color: #eef3fb; background: rgba(9,17,34,.5);
  box-shadow: inset 0 0 0 1px rgba(148,183,236,.24); outline: none;
}
.fi-tel-ri-name::placeholder { color: rgba(148,183,236,.42); }
.fi-tel-ri-name:focus { box-shadow: inset 0 0 0 1.5px rgba(59,130,246,.6); }
.fi-tel-ri-knopf {
  width: 100%; margin-top: 11px; padding: 13px; border: 0; cursor: pointer;
  border-radius: 16px; font-size: 14.5px; font-weight: 700; color: #fff;
  background: linear-gradient(178deg, #3b82f6, #1d4ed8);
  box-shadow: 0 12px 26px -12px rgba(29,78,216,.7);
  transition: filter 160ms, transform 140ms;
}
.fi-tel-ri-knopf:hover:not(:disabled) { filter: brightness(1.08); }
.fi-tel-ri-knopf:active:not(:disabled) { transform: translateY(1px); }
.fi-tel-ri-knopf:disabled { opacity: .3; cursor: default; box-shadow: none; }
.fi-tel-ri-fuss {
  margin-top: 8px; font-size: 10.5px; line-height: 1.45; color: rgba(148,183,236,.6);
}

/* ── Mikrofon-Schritt ──────────────────────────────────────────────────── */
.fi-tel-mikrofon {
  width: 100%; display: flex; align-items: center; gap: 12px;
  margin: 16px 0 0; padding: 13px 15px; border: 0; cursor: pointer; border-radius: 18px;
  background: linear-gradient(158deg, rgba(147,197,253,.16), rgba(59,130,246,.07));
  box-shadow: inset 0 0 0 1px rgba(147,197,253,.28);
  transition: box-shadow 200ms, transform 160ms;
}
.fi-tel-mikrofon:hover { transform: translateY(-1px); box-shadow: inset 0 0 0 1px rgba(147,197,253,.5); }
.fi-tel-mikrofon[data-stand="verweigert"] {
  background: linear-gradient(158deg, rgba(252,211,77,.16), rgba(217,119,6,.08));
  box-shadow: inset 0 0 0 1px rgba(252,211,77,.3);
}
.fi-tel-mikrofon-marke {
  width: 34px; height: 34px; border-radius: 12px; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  background: rgba(147,197,253,.2); color: #93c5fd;
}
.fi-tel-mikrofon[data-stand="verweigert"] .fi-tel-mikrofon-marke {
  background: rgba(252,211,77,.2); color: #fcd34d;
}
.fi-tel-mikrofon-titel { display: block; font-size: 13.5px; font-weight: 700; color: #eef3fb; }
.fi-tel-mikrofon-text {
  display: block; font-size: 11.5px; color: rgba(191,214,247,.76);
  margin-top: 2px; line-height: 1.45;
}

/* ── Der Nächste aus der Liste ─────────────────────────────────────────── */
.fi-tel-naechster {
  display: flex; align-items: center; gap: 9px; flex-wrap: wrap;
  margin-bottom: 12px; padding: 11px 14px; border-radius: 16px;
  background: linear-gradient(158deg, rgba(16,185,129,.16), rgba(5,150,105,.07));
  box-shadow: inset 0 0 0 1px rgba(16,185,129,.28);
}
.fi-tel-naechster-marke {
  font-size: 9.5px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
  color: #6ee7b7; white-space: nowrap;
}
.fi-tel-naechster-name {
  width: 100%; font-size: 15px; font-weight: 700; color: #eef3fb;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.fi-tel-naechster-weg {
  margin-left: auto; border: 0; background: none; cursor: pointer;
  font-size: 11.5px; font-weight: 600; color: rgba(191,214,247,.7);
}
.fi-tel-naechster-weg:hover { color: #eef3fb; }

.fi-tel-holen {
  width: 100%; margin-bottom: 10px; padding: 10px 14px; border: 0; cursor: pointer;
  border-radius: 14px; font-size: 12.5px; font-weight: 600;
  color: rgba(191,214,247,.86);
  background: rgba(148,183,236,.08);
  box-shadow: inset 0 0 0 1px rgba(148,183,236,.16);
  transition: background 180ms, color 180ms;
}
.fi-tel-holen:hover { background: rgba(148,183,236,.14); color: #eef3fb; }

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


const EINGEHEND_CSS = `
/* ═══════════════════════════════════════════════════════════════════════════
   DAS KLINGELFENSTER

   „Irgendwie bauen, dass es smart ist und nicht stört!"

   Eine Karte oben rechts. Sie überdeckt keine Arbeit, blockiert keine Eingabe
   und verschwindet von selbst, wenn der Anrufer auflegt. Was sie hat:

     * einen ruhigen Puls (kein Blinken — Blinken ist Alarm, nicht Anruf)
     * genug Kontrast, um im Augenwinkel aufzufallen
     * zwei Knöpfe, groß genug für den Daumen
   ═══════════════════════════════════════════════════════════════════════════ */
.fi-ein {
  position: fixed; z-index: 300;
  top: 14px; right: 14px; width: min(340px, calc(100vw - 28px));
  padding: 14px 16px 13px;
  border-radius: 20px;
  background: linear-gradient(158deg, #16305f, #0b1b3f 58%, #071129);
  box-shadow:
    0 2px 8px -3px rgba(7,17,41,.5),
    0 28px 60px -26px rgba(7,17,41,.85),
    inset 0 1px 0 rgba(255,255,255,.14),
    inset 0 0 0 1px rgba(255,255,255,.08);
  animation: fiEinAuf 340ms cubic-bezier(.32,.72,0,1) both;
}
@keyframes fiEinAuf {
  from { opacity: 0; transform: translateY(-12px) scale(.97); }
  to   { opacity: 1; transform: none; }
}

.fi-ein-kopf { display: flex; align-items: center; gap: 7px; margin-bottom: 8px; }
/* Ein Puls, kein Blinken: Er atmet zweimal je Sekunde und zieht das Auge an,
   ohne zu hetzen. */
.fi-ein-puls {
  width: 8px; height: 8px; border-radius: 999px; flex-shrink: 0;
  background: #34d399; box-shadow: 0 0 0 0 rgba(52,211,153,.7);
  animation: fiEinPuls 1.6s ease-out infinite;
}
@keyframes fiEinPuls {
  0%   { box-shadow: 0 0 0 0 rgba(52,211,153,.6); }
  70%  { box-shadow: 0 0 0 9px rgba(52,211,153,0); }
  100% { box-shadow: 0 0 0 0 rgba(52,211,153,0); }
}
.fi-ein-marke {
  font-size: 9.5px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase;
  color: rgba(191,214,247,.8) !important;
}
.fi-ein-nummer {
  margin-left: auto; font-size: 11px; font-variant-numeric: tabular-nums;
  color: rgba(191,214,247,.6) !important;
}

/* Der Name ist die wichtigste Zeile — er entscheidet, ob man rangeht. */
.fi-ein-name {
  font-size: 18px; font-weight: 700; line-height: 1.2;
  color: #f4f8ff !important;
  overflow-wrap: anywhere;
}
.fi-ein-grund {
  margin-top: 4px; font-size: 12.5px; line-height: 1.45;
  color: rgba(214,231,255,.86) !important;
}
/* Eine offene Rate ist der Grund, bei dem der erste Satz anders klingt. */
.fi-ein-grund[data-dringend="1"] { color: #fcd34d !important; font-weight: 600; }
.fi-ein-paket {
  margin-top: 2px; font-size: 11.5px;
  color: rgba(191,214,247,.66) !important;
}
.fi-ein-vertretung {
  margin-top: 7px; padding: 6px 9px; border-radius: 9px;
  background: rgba(255,255,255,.07);
  font-size: 11.5px; line-height: 1.45;
  color: rgba(214,231,255,.82) !important;
}

.fi-ein-tun { display: flex; gap: 8px; margin-top: 12px; }
.fi-ein-an, .fi-ein-ab {
  flex: 1 1 0; min-height: 42px; border: 0; border-radius: 13px; cursor: pointer;
  font-size: 13.5px; font-weight: 700;
  transition: transform 120ms ease, filter 120ms ease;
}
.fi-ein-an {
  background: linear-gradient(180deg, #34d399, #10b981);
  color: #04231a !important;
  box-shadow: 0 8px 18px -8px rgba(16,185,129,.7), inset 0 1px 0 rgba(255,255,255,.3);
}
.fi-ein-ab {
  background: rgba(255,255,255,.1);
  color: #e8f0fc !important;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.14);
}
.fi-ein-an:active, .fi-ein-ab:active { transform: scale(.97); }
.fi-ein-an:hover { filter: brightness(1.06); }

@media (max-width: 639px) {
  /* Auf dem Telefon oben über die ganze Breite: Dort ist rechts oben kein
     ruhiger Platz, und eine schmale Karte wäre schwer zu treffen. */
  .fi-ein { top: 10px; right: 10px; left: 10px; width: auto; border-radius: 18px; }
  .fi-ein-name { font-size: 17px; }
  .fi-ein-an, .fi-ein-ab { min-height: 46px; }
}

@media (prefers-reduced-motion: reduce) {
  .fi-ein { animation: none; }
  .fi-ein-puls { animation: none; box-shadow: 0 0 0 3px rgba(52,211,153,.35); }
}
`;
