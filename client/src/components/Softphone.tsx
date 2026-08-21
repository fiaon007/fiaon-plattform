import { useCallback, useEffect, useRef, useState } from "react";
import { FiaonGeraet, FiaonTastatur } from "@/components/FiaonGeraet";
import { telefonFehler, telefonFehlerText } from "@shared/fiaon-telefon-fehler";
import { ERGEBNIS_LISTE, NOTIZ_MINDESTLAENGE } from "@shared/fiaon-kontakt-ergebnis-liste";
// Die sieben Schritte des Startgesprächs — DAS Bauteil, nicht eine zweite
// Fassung davon. Es wird nur gerendert, wenn ein eigener Termin vorliegt.
import { OnboardingCockpit } from "@/components/agent/OnboardingCockpit";
import { FiaonEbene } from "./FiaonEbene";
// Gerätewahl, Pegelrechnung und die Hörbarkeitsschwellen stehen an EINER Stelle:
// Sie werden hier an vier Stellen gebraucht (Balken, Sperre, Sprechprobe,
// Warnung im Gespräch) und in der Twilio-Verbindung noch einmal.
import {
  eingabegeraeteHolen, gewaehltesGeraet, geraetSpeichern, tonAuflagen,
  pegelAusZeitdaten, pegelText, HOERBAR_AB, SPERRE_NACH_SEKUNDEN,
  WARNUNG_NACH_SEKUNDEN, probeBestanden, probeMerken, type Eingabegeraet,
} from "@/lib/fiaon-mikrofon";

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
  /**
   * Wer ist angemeldet? Gebraucht fuer die gespeicherte Mikrofon-Wahl.
   *
   * Sie wird JE MITARBEITER gemerkt und nicht je Browser: Zwei Menschen an einem
   * Rechner (Schulung, Springer) haben verschiedene Headsets. Ohne die Kennung
   * wuerde der zweite das Geraet des ersten erben.
   */
  agentId?: number | null;
  /**
   * Der Tagesstand der Absendernummer.
   *
   * ── EIN HINWEIS, KEINE SPERRE (19.08.2026) ──────────────────────────────
   * Bis heute war das eine Grenze, die das Wählen ab 100 Anrufen verweigert hat
   * — sie hat 26 Gespräche des Vertriebs blockiert. Jetzt zählt sie nur noch.
   *
   * `hinweis` ist `null`, solange nichts zu sagen ist. Der Satz kommt vom
   * SERVER und wird hier nicht zusammengebaut: Das Panel gibt es auf dem
   * Desktop und auf 380 px, und zwei Fassungen liefen auseinander.
   */
  kontingent?: {
    heute: number;
    schwelle: number;
    warnSchwelle: number;
    stufe: "ruhig" | "hinweis" | "warnung";
    hinweis: string | null;
  } | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE ERGEBNISSE KOMMEN AUS `shared/` (19.08.2026)
//
// Hier stand die VIERTE handgeschriebene Fassung derselben Liste — acht Werte
// statt neun (`nummer_blockiert` fehlte), eigene Beschriftungen, eigenes
// `notizPflicht` und die 10 als Zahl im Quelltext. Vier Fassungen sind der
// Grund, warum „Erreicht – Sonstiges" dreimal gemeldet wurde.
//
// ── WARUM HIER KEIN `ErgebnisWahl` STEHT ──────────────────────────────────
// Das Softphone rendert IN einem Telefongehäuse mit eigener Formsprache
// (`fi-tel-*`). Ein Bauteil mit den Knopfklassen der Kundenkarte hineinzuwuchten
// würde die Anzeige zerlegen — und der Screenshot müsste es beweisen. Geteilt
// wird deshalb, was auseinanderlaufen KANN: die Liste, die Beschriftungen, die
// Notizpflicht und ihre Mindestlänge. Die Darstellung bleibt gerätespezifisch.
//
// `scripts/pruef-ergebnis-eine-liste.ts` verbietet eine fünfte Fassung.
// ═══════════════════════════════════════════════════════════════════════════
const ERGEBNISSE = ERGEBNIS_LISTE.map((e) => ({
  art: e.art,
  label: e.knopf,
  braucht: e.braucht === "zusage" || e.braucht === "termin" ? e.braucht : undefined,
  /** Notiz ist PFLICHT: Ohne sie sagt das Ergebnis dem nächsten Menschen nichts. */
  notizPflicht: e.braucht === "notiz" ? true : undefined,
}));

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
  // ── WEN RUFE ICH GLEICH AN? ─────────────────────────────────────────────
  // Der Server beantwortet das anhand der GEWÄHLTEN NUMMER, nicht anhand der
  // offenen Kundenkarte. Beides kann auseinandergehen: Wer eine Karte offen
  // hat und nebenher eine andere Nummer eintippt, hätte sonst geglaubt, er
  // ruft den Kunden auf der Karte an — und die Aufnahme landete dort.
  const [wem, setWem] = useState<{
    person: { id: number; name: string } | null; anzeige: string; mehrdeutig: boolean;
  } | null>(null);
  // ── AUTO-ADVANCE ────────────────────────────────────────────────────────
  // Wen haben wir in dieser Sitzung schon dokumentiert? Ohne diese Liste
  // schlägt das Telefon denselben Menschen wieder vor — die Wiedervorlage
  // steht zwar auf morgen, aber die Kundenliste im Server kennt sie erst nach
  // dem nächsten Ladevorgang.
  const [erledigte, setErledigte] = useState<number[]>([]);
  // Kam dieser Kunde aus der Liste (statt von Hand eingetippt)? Nur dann
  // zeigen wir die Marke „Nächster aus deiner Liste".
  const [ausListe, setAusListe] = useState(false);
  // ══════════════════════════════════════════════════════════════════════════
  // DER ZUSTAND MUSS DIE WAHRHEIT SAGEN (31.08.2026)
  //
  // ── DER BEFUND (Videoauswertung, Anruf Nikita vom 19.08.) ─────────────────
  // Direkt nach dem Klick auf „Anrufen" stand da „IM GESPRÄCH · 00:00" mit
  // laufender Uhr — beim Kunden hatte es zu diesem Zeitpunkt noch nicht einmal
  // geklingelt.
  //
  // ── DIE URSACHE ───────────────────────────────────────────────────────────
  // Am Ende des Wählvorgangs stand ein unbedingtes
  //
  //     setZustand("gespraech");
  //
  // gleich NACH dem Registrieren der Ereignis-Handler. Der Handler für „accept"
  // (der echte Moment, in dem der Mensch abhebt) war korrekt — er kam nur nie
  // zum Tragen, weil die Zeile darunter den Zustand ohnehin sofort weiterschob.
  //
  // ── WARUM DAS MEHR IST ALS EINE FALSCHE BESCHRIFTUNG ─────────────────────
  // Der Agent glaubt, die Leitung stehe, und begrüßt einen Menschen, der noch
  // gar nicht dran ist. Seine ersten Sätze gehen ins Freizeichen. Wenn der Kunde
  // dann abhebt, ist die Begrüßung vorbei — und er hört jemanden, der mitten im
  // Satz ist oder gerade Luft holt. Aus dem Blickwinkel des Kunden: „nimmt ab,
  // keiner spricht."
  //
  // ── DIE VIER ZUSTÄNDE ─────────────────────────────────────────────────────
  //   waehlt    Der Ausweis wird geholt, das SDK verbindet sich zu Twilio.
  //   klingelt  Twilio hat gewählt, beim Kunden klingelt es (SDK-Ereignis
  //             „ringing"). Das gibt es nur, weil das TwiML
  //             `answerOnBridge="true"` trägt: Ohne das Attribut würde Twilio
  //             sofort durchstellen und ein Freizeichen einspielen — dann wäre
  //             „accept" bedeutungslos und dieser Zustand nicht messbar.
  //   gespraech Der Mensch hat abgehoben (SDK-Ereignis „accept"). ERST HIER
  //             läuft die Uhr.
  //   ergebnis  Aufgelegt.
  const [zustand, setZustand] = useState<
    "bereit" | "waehlt" | "klingelt" | "gespraech" | "ergebnis"
  >("bereit");
  const [callId, setCallId] = useState<number | null>(null);
  const [sekunden, setSekunden] = useState(0);
  const [stumm, setStumm] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [datumFeld, setDatumFeld] = useState<"zusage" | "termin" | null>(null);
  // ── DIE NOTIZ ZUM ERGEBNIS ──────────────────────────────────────────────
  // Bei „Erreicht — Sonstiges" Pflicht (min. 10 Zeichen), bei allen anderen
  // freiwillig. GEMESSEN: siebenmal im Panel gedrückt — es gab hier gar kein
  // Feld dafür, und in der Akte stand nur „Sonstiges".
  const [notiz, setNotiz] = useState("");
  const [notizFuer, setNotizFuer] = useState<string | null>(null);
  const [notizFehler, setNotizFehler] = useState<string | null>(null);
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
  // ── DIE KUNDENDATEN FÜRS GESPRÄCH ──────────────────────────────────────
  // „Während des Anrufs kann ich die Stammdaten nicht vernünftig einsehen."
  // Erst beim Verbinden geholt, damit die Wähltastatur nicht wartet.
  //
  // ── WARUM HIER EINE PERSONEN-KENNUNG DANEBEN STEHT (30.08.2026) ─────────
  // Meldung des Teams: „Beim Öffnen/Anrufen verschiedener Kunden erscheinen
  // dieselben Stammdaten (Adresse, E-Mail, Paket)." Der Verdacht lag auf einer
  // Fehl-Zusammenführung. GEMESSEN: 742 Merges nachgerechnet, kein einziger
  // hat zwei verschiedene Menschen verschmolzen. Die Ursache stand hier:
  //
  //   Der Ladewächter hieß `!gespraechsDaten` und die Abhängigkeitsliste des
  //   Effekts nur `[zustand]`. Nach dem ERSTEN Gespräch war das Feld gefüllt —
  //   damit war die Bedingung für jeden weiteren Anruf falsch, und es wurde
  //   nie wieder geladen. Zurückgesetzt hat es niemand: `setGespraechsDaten`
  //   kam im ganzen Bauteil genau einmal vor. Jeder Anruf ab dem zweiten zeigte
  //   die Daten des ERSTEN Kunden — und zwar genau die fünf Felder aus der
  //   Meldung (Paket, Offen, Verwendungszweck, E-Mail, Ort).
  //
  // Der naheliegende Weg wäre, an alle acht `setKunde`-Stellen ein Zurücksetzen
  // zu hängen. Das ist die Regel, die drei Oberflächen einzeln kennen müssen —
  // an der vierten wird sie vergessen. Stattdessen trägt der Datensatz, ZU WEM
  // er gehört. Die Anzeige vergleicht das mit dem aktuellen Kunden: Passt es
  // nicht, wird nichts gezeigt. Ein vergessenes Zurücksetzen kann damit keine
  // fremden Stammdaten mehr einblenden.
  const [gespraechsDaten, setGespraechsDaten] = useState<{ personId: number; kunde: any } | null>(null);
  // ── WARUM KEINE DATEN DA SIND (21.08.2026) ──────────────────────────────
  // Der Ladevorgang verschluckte jede Absage: `if (!j?.ok) return;` — und dann
  // stand „Wird geladen …" für immer. Das ist die Meldung „Onboarding sieht
  // keine Kundendaten": kein Ausfall, sondern ein 403 ohne Stimme.
  const [datenFehler, setDatenFehler] = useState<string | null>(null);
  /** Das Cockpit mit den sieben Schritten — offen WÄHREND des Gesprächs. */
  const [cockpitOffen, setCockpitOffen] = useState(false);
  // Der Stand des Mikrofonrechts. Wird VOR dem ersten Wählversuch geklärt.
  const [mikrofon, setMikrofon] = useState<"offen" | "erlaubt" | "verweigert">("offen");
  // ══════════════════════════════════════════════════════════════════════════
  // DER MIKROFONPEGEL — GEGEN „KUNDE NIMMT AB, HÖRT NICHTS"
  //
  // ── DIE MELDUNG (Team, 30.08.2026) ────────────────────────────────────────
  // „Der Kunde nimmt ab, aber es spricht niemand."
  //
  // ── WARUM EIN BALKEN UND KEINE PRÜFUNG ───────────────────────────────────
  // Das Panel wusste bisher nur, ob das Mikrofon ERLAUBT ist. Erlaubt heißt
  // nicht, dass es liefert: Ein stummgeschaltetes Headset, ein falsch gewähltes
  // Eingabegerät, ein Mikrofonschalter am Kabel — in allen drei Fällen sagt der
  // Browser „erlaubt" und überträgt Stille. Der Agent merkt es erst, wenn der
  // Kunde auflegt.
  //
  // Eine automatische Prüfung („ist das Mikro in Ordnung?") kann das nicht
  // beantworten: Stille ist ein zulässiger Zustand, solange niemand spricht.
  // Deshalb ein BALKEN — der Mensch sieht in einer halben Sekunde, ob sein
  // Sprechen ankommt, und braucht dafür kein Urteil des Programms.
  //
  // ── UND EINE WARNUNG, DIE ZÄHLT ──────────────────────────────────────────
  // Im GESPRÄCH wird gezählt, wie lange der Eingang bei null liegt. Zehn
  // Sekunden Stille sind im Gespräch kein Zufall mehr — dann kommt die Warnung.
  // Kürzer wäre ein Fehlalarm bei jeder Pause.
  // ══════════════════════════════════════════════════════════════════════════
  const [pegel, setPegel] = useState<number | null>(null);
  const [stilleSek, setStilleSek] = useState(0);
  const pegelKette = useRef<{ ctx: AudioContext; strom: MediaStream; timer: number } | null>(null);
  // ── DIE GERÄTEWAHL (31.08.2026) ─────────────────────────────────────────
  // Bis heute gab es keine: `getUserMedia({ audio: true })` nahm den Standard,
  // und das Twilio-SDK ebenfalls. Wer ein stummes Standardgerät hatte, konnte in
  // der Anwendung nichts dagegen tun.
  const [geraete, setGeraete] = useState<Eingabegeraet[]>([]);
  const [geraetId, setGeraetId] = useState<string | null>(null);
  const [geraetFehler, setGeraetFehler] = useState<string | null>(null);
  // Die Sprechprobe: 2 Sekunden aufnehmen, sofort abspielen. Wer sich selbst
  // hört, ist sendebereit — das ist der einzige Beweis, den ein Mensch ohne
  // Messtechnik führen kann.
  const [probe, setProbe] = useState<"aus" | "laeuft" | "spielt" | "fertig">("aus");
  const [probeFehler, setProbeFehler] = useState<string | null>(null);
  const probeUrl = useRef<string | null>(null);
  // ══════════════════════════════════════════════════════════════════════════
  // STUMM-VERDACHT: DIE BEDINGUNG, DIE DEN KNOPF SPERRT
  //
  // Wahr, wenn der Eingangspegel länger als SPERRE_NACH_SEKUNDEN unter der
  // Hörbarkeitsschwelle liegt. Abgeleitet und nicht gespeichert: Ein zweiter
  // Zustand daneben würde beim ersten vergessenen `set` auseinanderlaufen — und
  // dann sperrt der Knopf, obwohl der Balken ausschlägt.
  //
  // `pegel == null` sperrt NICHT. Das heißt „wird noch gemessen" (die Messkette
  // braucht einen Moment) und nicht „kein Signal". Wer beim Öffnen des Panels
  // eine Sperre sieht, hält sie für einen Fehler der Anwendung.
  const stummVerdacht = mikrofon === "erlaubt"
    && pegel != null && pegel < HOERBAR_AB
    && stilleSek >= SPERRE_NACH_SEKUNDEN;

  // ── DIE PROBENPFLICHT (31.08.2026) ──────────────────────────────────────
  // Einmal je Mitarbeiter UND je Gerät. Zwei getrennte Gründe, den Knopf zu
  // sperren — sie werden absichtlich NICHT zusammengeworfen: Der Agent muss
  // wissen, ob sein Mikrofon stumm ist oder ob er nur noch die Probe braucht.
  const probePflicht = mikrofon === "erlaubt" && geraete.length > 0
    && !probeBestanden(stand?.agentId, geraetId) && probe !== "fertig";
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

  // Die Stammdaten des Menschen, der GERADE in der Leitung ist. Die
  // Abhängigkeitsliste nennt `kunde?.personId` ausdrücklich — ohne sie lief der
  // Effekt beim Kundenwechsel nicht erneut (siehe die Begründung am Zustand).
  const gespraechsPersonId = kunde?.personId ?? null;
  useEffect(() => {
    if (zustand !== "gespraech" || !gespraechsPersonId) return;
    // `abgebrochen` fängt den Wettlauf: Wechselt der Agent den Kunden, während
    // die Antwort noch unterwegs ist, darf sie nicht mehr ankommen. Dasselbe
    // Muster wie bei der Nummernauflösung weiter unten.
    let abgebrochen = false;
    setDatenFehler(null);
    void fetch(`/api/fiaon/telefon/kunde/${gespraechsPersonId}`, { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        if (abgebrochen) return;
        // ── JEDER AUSGANG IST SICHTBAR ────────────────────────────────────
        // Hier stand `if (!j?.ok) return;`. Ein 403 („kein Startgespräch zu
        // diesem Kunden") wurde damit zu einem ewigen „Wird geladen …" —
        // ununterscheidbar von einem Ausfall. Genau das haben Viktoria und
        // Rifka als „ich sehe keine Kundendaten" gemeldet.
        if (!j?.ok) {
          setDatenFehler(j?.error || "Die Kundendaten konnten nicht geladen werden.");
          return;
        }
        setGespraechsDaten({ personId: gespraechsPersonId, kunde: j.kunde });
      })
      .catch(() => {
        if (!abgebrochen) {
          setDatenFehler("Keine Verbindung zum Server — die Kundendaten fehlen. Das Gespräch läuft weiter.");
        }
      });
    return () => { abgebrochen = true; };
  }, [zustand, gespraechsPersonId]);

  useEffect(() => {
    if (zustand === "gespraech") {
      uhr.current = setInterval(() => setSekunden((s) => s + 1), 1000);
    } else if (uhr.current) {
      clearInterval(uhr.current);
      uhr.current = null;
    }
    return () => { if (uhr.current) clearInterval(uhr.current); };
  }, [zustand]);

  // ── DIE PEGELMESSUNG ──────────────────────────────────────────────────────
  // Sie läuft, wenn das Panel offen ist und das Mikrofon erlaubt ist — also
  // VOR dem ersten Anruf und während des Gesprächs. Nicht dauerhaft im
  // Hintergrund: Ein offener Audiostrom zeigt in manchen Browsern ein
  // Aufnahme-Symbol, und ein Symbol ohne Anlass beunruhigt.
  useEffect(() => {
    const aus = () => {
      const k = pegelKette.current;
      if (!k) return;
      window.clearInterval(k.timer);
      for (const t of k.strom.getTracks()) t.stop();
      void k.ctx.close().catch(() => {});
      pegelKette.current = null;
      setPegel(null);
      setStilleSek(0);
    };

    if (!offen || mikrofon !== "erlaubt") { aus(); return aus; }
    if (pegelKette.current) return;

    let abgebrochen = false;
    void (async () => {
      try {
        // ── AM GEWÄHLTEN GERÄT MESSEN, NICHT AM STANDARD (31.08.2026) ────
        // Hier stand `getUserMedia({ audio: true })`. Der Balken maß damit
        // immer das Standardgerät — auch dann, wenn der Agent ein anderes
        // gewählt hatte. Ein Balken, der ein anderes Gerät misst als der
        // Anruf benutzt, ist schlimmer als keiner: Er beruhigt falsch.
        const strom = await navigator.mediaDevices.getUserMedia(tonAuflagen(geraetId));
        if (abgebrochen) { for (const t of strom.getTracks()) t.stop(); return; }
        setGeraetFehler(null);
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new Ctx();
        const quelle = ctx.createMediaStreamSource(strom);
        const messer = ctx.createAnalyser();
        messer.fftSize = 512;
        quelle.connect(messer);
        const daten = new Uint8Array(messer.frequencyBinCount);

        const timer = window.setInterval(() => {
          messer.getByteTimeDomainData(daten);
          const wert = pegelAusZeitdaten(daten);
          setPegel(wert);
          // Die Schwelle kommt aus fiaon-mikrofon.ts — dieselbe, die auch die
          // Sperre und die Warnung im Gespräch benutzen.
          setStilleSek((s) => (wert < HOERBAR_AB ? s + 0.2 : 0));
        }, 200);

        pegelKette.current = { ctx, strom, timer };
      } catch (e) {
        // ── `exact` KANN SCHEITERN, UND DAS IST DER ZWECK ────────────────
        // Fehlt das gewählte Gerät (Headset abgezogen), gibt es hier einen
        // Fehler statt eines stillen Ausweichens auf ein anderes Mikrofon.
        // Der Fehler wird ANGEZEIGT — sonst stünde der Agent vor einem leeren
        // Balken und wüsste nicht, warum.
        setPegel(null);
        const name = (e as any)?.name;
        if (name === "OverconstrainedError" || name === "NotFoundError") {
          setGeraetFehler(
            "Das gewählte Mikrofon ist nicht mehr da (abgezogen oder umbenannt). "
            + "Wähl unten ein anderes aus.",
          );
        }
      }
    })();

    return () => { abgebrochen = true; aus(); };
    // `geraetId` gehört in die Abhängigkeiten: Bei einem Gerätewechsel muss die
    // Messkette neu aufgebaut werden, sonst misst der Balken weiter das alte.
  }, [offen, mikrofon, geraetId]);

  // ══════════════════════════════════════════════════════════════════════════
  // DEN STUMMEN ANRUF IM PROTOKOLL MARKIEREN (31.08.2026)
  //
  // ── WARUM DAS NICHT NUR EINE ANZEIGE SEIN DARF ────────────────────────────
  // Die Warnung im Gespräch hilft dem Agenten, der gerade telefoniert. Sie hilft
  // NICHT bei der Frage „warum kommen bei Nikita nur 2 von 158 Anrufen durch?" —
  // dafür braucht es eine Spur, die den Anruf überlebt.
  //
  // Genau EINMAL je Anruf: `stummGemeldet` hält fest, ob die Marke schon
  // draußen ist. Ohne diesen Merker schickte der 200-Millisekunden-Takt fünfmal
  // je Sekunde eine Meldung.
  const stummGemeldet = useRef<number | null>(null);
  useEffect(() => {
    if (zustand !== "gespraech" || !callId) return;
    if (stilleSek < WARNUNG_NACH_SEKUNDEN) return;
    if (stummGemeldet.current === callId) return;
    stummGemeldet.current = callId;
    void fetch(`/api/fiaon/telefon/${callId}/verbindung`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ art: "stumm_verdacht", wert: `${Math.floor(stilleSek)}s`, pegel }),
    }).catch(() => { /* Diagnose darf ein Gespräch nie stören. */ });
  }, [zustand, callId, stilleSek, pegel]);

  // ── DIE GERÄTELISTE LADEN ────────────────────────────────────────────────
  // Erst NACH erteilter Erlaubnis: Vorher liefert `enumerateDevices` leere
  // Namen, und eine Auswahlliste aus vier leeren Einträgen ist schlimmer als
  // keine. `devicechange` fängt das eingesteckte Headset im laufenden Betrieb.
  useEffect(() => {
    if (!offen || mikrofon !== "erlaubt") return;
    let weg = false;
    const laden = async () => {
      const liste = await eingabegeraeteHolen();
      if (weg) return;
      setGeraete(liste);
      // Die gespeicherte Wahl nur übernehmen, wenn das Gerät noch existiert.
      // Ein Verweis auf ein abgezogenes Headset würde jeden Anruf blockieren.
      const gemerkt = gewaehltesGeraet(stand?.agentId);
      if (gemerkt && liste.some((g) => g.deviceId === gemerkt)) setGeraetId(gemerkt);
      else if (gemerkt) {
        geraetSpeichern(stand?.agentId, null);
        setGeraetId(null);
      }
    };
    void laden();
    navigator.mediaDevices?.addEventListener?.("devicechange", laden);
    return () => {
      weg = true;
      navigator.mediaDevices?.removeEventListener?.("devicechange", laden);
    };
  }, [offen, mikrofon, stand?.agentId]);

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
    // „klingelt" gehoert dazu: Auch waehrend des Klingelns will man keine
    // Video-Effekte im Hintergrund rechnen lassen.
    const laeuft = zustand === "waehlt" || zustand === "klingelt" || zustand === "gespraech";
    // An der WURZEL, nicht am <body>: Das Gerät hängt in einem Portal, das
    // nicht unter <body> sitzt — eine body-Regel griff nachweislich nicht.
    const wurzel = document.documentElement;
    if (laeuft) wurzel.setAttribute("data-gespraech", "1");
    else wurzel.removeAttribute("data-gespraech");
    return () => wurzel.removeAttribute("data-gespraech");
  }, [zustand]);

  // ── WEM GEHÖRT DIE GETIPPTE NUMMER? ───────────────────────────────────
  // Fragt den Server, sobald die Nummer lang genug ist, um etwas zu bedeuten.
  // 350 ms Verzögerung, damit nicht bei jedem Tastendruck eine Abfrage geht.
  //
  // ── WARUM DIESER HAKEN HIER OBEN STEHT ────────────────────────────────
  // Er stand zuerst weiter unten, HINTER „if (!stand) return null". Der
  // Browser meldete daraufhin „Rendered more hooks than during the previous
  // render" und die halbe Verwaltung war weiß — sichtbar geworden erst auf
  // dem Screenshot der Browser-Abnahme. React zählt Haken in jedem Durchlauf,
  // und hinter einem Ausstieg werden es unterschiedlich viele.
  //
  // Dieselbe Falle steht ein paar Zeilen weiter unten schon einmal
  // dokumentiert. Eine Regel, die man zweimal vergisst, gehört an die Stelle,
  // an der man sie vergisst.
  useEffect(() => {
    const ziffern = nummer.replace(/\D/g, "");
    if (ziffern.length < 7) { setWem(null); return; }
    let abgebrochen = false;
    const t = setTimeout(() => {
      void fetch(`/api/fiaon/telefon/wem?nummer=${encodeURIComponent(nummer)}`, { credentials: "include" })
        .then((r) => r.json())
        .then((j) => {
          if (abgebrochen || !j?.ok) return;
          setWem({ person: j.person ?? null, anzeige: String(j.anzeige || ""), mehrdeutig: !!j.mehrdeutig });
        })
        .catch(() => {});
    }, 350);
    return () => { abgebrochen = true; clearTimeout(t); };
  }, [nummer]);

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

  // ══════════════════════════════════════════════════════════════════════════
  // DIE SPRECHPROBE
  //
  // Zwei Sekunden aufnehmen, sofort abspielen. Der einzige Beweis, den ein
  // Mensch ohne Messtechnik führen kann: Wer sich selbst hört, ist sendebereit.
  //
  // Sie nimmt AUSDRÜCKLICH über `tonAuflagen(geraetId)` auf, also über dasselbe
  // Gerät, das der Anruf benutzt. Eine Probe über ein anderes Gerät wäre eine
  // Beruhigung ohne Aussage.
  //
  // ── WAS HIER NICHT PASSIERT ───────────────────────────────────────────────
  // Die Aufnahme verlässt den Browser nicht. Sie wird nicht hochgeladen, nicht
  // gespeichert, und die Objekt-URL wird nach dem Abspielen wieder freigegeben.
  // Eine Sprachaufnahme eines Mitarbeiters auf dem Server wäre ein
  // Datenschutzvorgang, den niemand bestellt hat.
  const sprechprobe = async () => {
    setProbeFehler(null);
    if (!window.MediaRecorder) {
      setProbeFehler("Dieser Browser kann keine Sprechprobe aufnehmen. Nimm Chrome, Edge oder Safari.");
      return;
    }
    let strom: MediaStream | null = null;
    try {
      strom = await navigator.mediaDevices.getUserMedia(tonAuflagen(geraetId));
      const rec = new MediaRecorder(strom);
      const teile: Blob[] = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) teile.push(e.data); };
      rec.onstop = () => {
        for (const t of strom!.getTracks()) t.stop();
        if (teile.length === 0) {
          setProbe("aus");
          setProbeFehler("Es wurde nichts aufgenommen — das Gerät liefert keine Daten.");
          return;
        }
        if (probeUrl.current) URL.revokeObjectURL(probeUrl.current);
        probeUrl.current = URL.createObjectURL(new Blob(teile, { type: rec.mimeType || "audio/webm" }));
        const ton = new Audio(probeUrl.current);
        setProbe("spielt");
        ton.onended = () => {
          setProbe("fertig");
          // Erst wenn sie ABGESPIELT wurde, gilt sie als bestanden: Ein Klick
          // auf „Sprechprobe" allein beweist nichts — gehört haben muss man sie.
          probeMerken(stand?.agentId, geraetId);
        };
        // Ein blockiertes Abspielen ist kein Fehler des Mikrofons — der Satz
        // muss das unterscheiden, sonst tauscht jemand ein gesundes Headset aus.
        ton.play().catch(() => {
          setProbe("fertig");
          setProbeFehler("Der Browser hat das Abspielen blockiert. Tippe einmal auf die Seite und probier es erneut.");
        });
      };
      setProbe("laeuft");
      rec.start();
      window.setTimeout(() => { if (rec.state !== "inactive") rec.stop(); }, 2000);
    } catch (e) {
      for (const t of strom?.getTracks() ?? []) t.stop();
      setProbe("aus");
      const name = (e as any)?.name;
      setProbeFehler(name === "OverconstrainedError" || name === "NotFoundError"
        ? "Das gewählte Mikrofon ist nicht erreichbar. Wähl ein anderes aus."
        : "Die Sprechprobe hat nicht funktioniert. Prüfe die Mikrofon-Erlaubnis im Browser.");
    }
  };

  const waehlen = async () => {
    setMeldung(null);
    setZustand("waehlt");
    // `personId` ist nur noch ein VORSCHLAG aus der offenen Karte. Der Server
    // entscheidet anhand der gewählten Nummer und schickt in `anruftPerson`
    // zurück, wem der Anruf wirklich gehört.
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
    // Die Wahrheit über den Anruf kommt vom Server: Er folgt der gewählten
    // Nummer. Weicht sie von der offenen Karte ab, wird die Anzeige HIER
    // korrigiert — sonst stünde während des Gesprächs ein falscher Name.
    if (j.anruftPerson) {
      setKunde({ personId: Number(j.anruftPerson.id), name: String(j.anruftPerson.name) });
    } else if (j.zuordnungPflicht) {
      setKunde(null);
      setMeldung("Unbekannte Nummer — bitte im Ergebnis-Schritt zuordnen, zu wem dieser Anruf gehört.");
    }

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
      // Mit dem GEWÄHLTEN Gerät, nicht mit dem Standard (31.08.2026). Hier
      // stand `{ audio: true }` — der Browser nahm sein Standardmikrofon, und
      // das war im Video das stumme.
      const strom = await navigator.mediaDevices.getUserMedia(tonAuflagen(geraetId));
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

      // ══════════════════════════════════════════════════════════════════════
      // DEM SDK SAGEN, WELCHES MIKROFON ES NEHMEN SOLL (31.08.2026)
      //
      // ── DER HAUPTVERDÄCHTIGE, BESTÄTIGT ─────────────────────────────────
      // Diese vier Zeilen fehlten. Das Twilio-SDK holt sich seinen eigenen
      // Audiostrom und nimmt dafür das Gerät, das der Browser als STANDARD
      // führt — der `getUserMedia`-Aufruf oben hat darauf keinen Einfluss, er
      // wird ja sofort wieder freigegeben.
      //
      // Damit war jede Gerätewahl in der Anwendung wirkungslos: Der Balken
      // konnte am richtigen Mikrofon messen und der Anruf trotzdem über das
      // stumme laufen. Genau die Lage aus dem Video — „sehr leise" am Balken
      // und beim Kunden niemand zu hören.
      //
      // `d.audio.setInputDevice` ist der einzige Weg, dem SDK ein Gerät
      // vorzugeben. Ein Fehlschlag ist kein Abbruch: Dann telefoniert der Agent
      // über den Standard — schlechter als gewollt, aber besser als kein Anruf.
      // Er wird PROTOKOLLIERT, damit der Fall nicht unsichtbar bleibt.
      if (geraetId && d.audio?.setInputDevice) {
        try {
          await d.audio.setInputDevice(geraetId);
        } catch (e) {
          void fehlerMelden("mikrofon-an-sdk", e);
          setMeldung(
            "Das gewählte Mikrofon konnte nicht an die Telefonie übergeben werden — "
            + "der Anruf läuft über das Standardgerät. Wenn dich der Kunde nicht hört, "
            + "leg auf und mach die Sprechprobe.",
          );
        }
      }
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
        ruf.on("reject", () => setEingehend(null));
        // ── NACH DEM AUFLEGEN KOMMT DER ERGEBNIS-SCHRITT (21.08.2026) ────
        // Beim AUSGEHENDEN Anruf tut „disconnect" genau das (Zeile weiter
        // unten). Beim eingehenden wurde nur das Klingelfenster geschlossen —
        // wer angerufen wurde, blieb im Zustand „gespraech" stehen und musste
        // von Hand auf „auflegen" drücken, um überhaupt zu den Ergebnissen zu
        // kommen. `laden()` holt dabei die offenen Anrufe nach; daraus
        // bestimmt `dokumentieren` die Anruf-Kennung, die es beim eingehenden
        // Anruf sonst nicht gibt.
        ruf.on("disconnect", () => {
          setEingehend(null);
          setZustand((z) => (z === "gespraech" || z === "klingelt" ? "ergebnis" : z));
          void laden();
        });
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
      // ── „ringing": ES KLINGELT BEIM KUNDEN ────────────────────────────
      // Nur wegen `answerOnBridge="true"` im TwiML bekommt der Browser dieses
      // Ereignis überhaupt. Bis zum 31.08.2026 wurde es nicht ausgewertet — der
      // Zustand sprang direkt auf „im Gespräch".
      c.on("ringing", () => {
        // Nicht zurückschalten, wenn schon abgehoben wurde: Die Reihenfolge der
        // SDK-Ereignisse ist nicht garantiert, und ein „klingelt" NACH einem
        // „accept" würde die Uhr wieder anhalten.
        setZustand((z) => (z === "gespraech" ? z : "klingelt"));
      });
      c.on("accept", () => { setSekunden(0); setZustand("gespraech"); });
      c.on("disconnect", () => { setZustand("ergebnis"); void laden(); });
      c.on("cancel", () => { setZustand("ergebnis"); void laden(); });
      c.on("reject", () => { setMeldung("Der Ruf wurde abgelehnt."); setZustand("ergebnis"); });

      // ══════════════════════════════════════════════════════════════════════
      // ICE- UND VERBINDUNGSSTATUS AM ANRUF PROTOKOLLIEREN (30.08.2026)
      //
      // ── WARUM ─────────────────────────────────────────────────────────────
      // „Der Kunde nimmt ab, aber es spricht niemand." Der Mikrofonpegel deckt
      // die eine Hälfte ab (unser Eingang). Die andere Hälfte ist der WEG: Bei
      // Einweg-Audio ist typischerweise der Medienpfad in eine Richtung nicht
      // aufgebaut — ein NAT/Firewall-Problem, das sich im ICE-Zustand zeigt und
      // NUR dort.
      //
      // Diese Zustände sind flüchtig: Sie stehen für Sekunden in der
      // Verbindung und sind nach dem Auflegen weg. Wer hinterher fragt „warum
      // hat der Kunde nichts gehört?", hat keine Daten. Deshalb werden sie
      // festgehalten — an den Anruf, nicht in die Browserkonsole.
      //
      // ── WAS DAS NICHT IST ─────────────────────────────────────────────────
      // Keine Diagnose. Das Panel entscheidet nicht, WORAN es lag — es hält
      // fest, was war. Die Deutung braucht Twilios Sicht dazu (Region, Codec),
      // und die steht im Report als Betreiber-TODO.
      const zustandMelden = (art: string, wert: string) => {
        void fetch(`/api/fiaon/telefon/${j.callId}/verbindung`, {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ art, wert, pegel }),
        }).catch(() => { /* Diagnose darf ein Gespräch nie stören */ });
      };
      try {
        const pc = (c as any).getRTCPeerConnection?.() as RTCPeerConnection | undefined;
        if (pc) {
          pc.addEventListener("iceconnectionstatechange", () => {
            // Nur die aussagekräftigen Zustände: „checking" und „completed"
            // kommen bei jedem gesunden Anruf und wären Rauschen.
            const s = pc.iceConnectionState;
            if (s === "failed" || s === "disconnected" || s === "connected") {
              zustandMelden("ice", s);
            }
          });
          pc.addEventListener("connectionstatechange", () => {
            const s = pc.connectionState;
            if (s === "failed" || s === "disconnected") zustandMelden("verbindung", s);
          });
        }
      } catch { /* Ohne Zugriff auf die Verbindung gibt es keine Diagnose — kein Fehler. */ }
      // Twilios eigene Warnungen (Paketverlust, kein Audio) — genau die
      // Ereignisse, die bei Einweg-Audio feuern.
      c.on("warning", (name: string) => zustandMelden("warnung", String(name)));
      c.on("warning-cleared", (name: string) => zustandMelden("warnung_weg", String(name)));

      // ── HIER STAND `setZustand("gespraech")` ──────────────────────────────
      // Unbedingt, gleich nach dem Registrieren der Handler. Das war der Fehler
      // aus der Videoauswertung: „IM GESPRÄCH · 00:00" mit laufender Uhr,
      // während beim Kunden noch nichts klingelte. Der „accept"-Handler oben war
      // richtig — diese Zeile hat ihn nur überholt.
      //
      // Es wird hier NICHTS gesetzt. Der Zustand bleibt „waehlt", bis das SDK
      // „ringing" oder „accept" meldet. Wer den Zustand vorwegnimmt, behauptet
      // etwas über die Gegenseite, das er nicht wissen kann.
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

  // ═══════════════════════════════════════════════════════════════════════
  // DAS ERGEBNIS AUS DEM PANEL — ES VERPUFFTE STILL (Vika, 21.08.2026, 16:46)
  //
  // ── DIE MELDUNG ────────────────────────────────────────────────────────
  // „Ich kann es anklicken, aber es wird nicht angenommen." Im Telefon-Panel.
  // Über die Kundenliste ging dasselbe Ergebnis.
  //
  // ── DIE URSACHE, IN EINER ZEILE ────────────────────────────────────────
  // Hier stand:
  //
  //     if (!callId) { setZustand("bereit"); return; }
  //
  // Keine Anfrage, keine Meldung, kein Eintrag in der Konsole — der Klick
  // sprang zurück auf die Wähltastatur, als hätte man nichts gedrückt.
  //
  // Und `callId` IST bei einem eingehenden Anruf null: Gesetzt wird sie nur
  // an einer einzigen Stelle, in der Antwort des Wählvorgangs (`j.callId`).
  // Der Knopf „Annehmen" setzt Zustand, Kunde und Nummer — die Kennung des
  // Anrufs nicht. Wer angerufen WIRD, konnte sein Gespräch also nie
  // dokumentieren. Dasselbe gilt nach einem Wählversuch, der vor der Antwort
  // scheitert: Auch dort landet man im Ergebnis-Schritt ohne Kennung.
  //
  // ── DIE BEHEBUNG: ZWEI WEGE, KEIN STILLER ──────────────────────────────
  //  1. Die Kennung nachschlagen. Der Server liefert mit `stand.offene`
  //     ohnehin die eigenen Anrufe ohne Ergebnis — darunter der eben
  //     beendete. Passt die Nummer, ist es seiner.
  //  2. Bleibt sie leer, aber der Kunde ist bekannt, geht das Ergebnis über
  //     DIESELBE Route wie in der Kundenliste
  //     (`/agent/crm/kunden/:id/aktivitaet`). Beide Routen laufen im Server
  //     durch `ergebnisNachbereiten` — es ist wirklich ein Weg, nicht zwei.
  //  3. Geht beides nicht, steht das ROT im Panel. Ein Ergebnis, das
  //     verschwindet, ist schlimmer als eines, das sich weigert.
  // ═══════════════════════════════════════════════════════════════════════
  const dokumentieren = async (art: string) => {
    // Die Kennung des Anrufs — gesetzt beim Wählen, sonst aus den offenen
    // Gesprächen dieses Menschen nachgeschlagen (eingehender Anruf).
    const nummerGleich = (a: string, b: string) =>
      a.replace(/\D/g, "").slice(-9) === b.replace(/\D/g, "").slice(-9);
    const offeneListe: { id: number; nummer: string; personId?: number | null }[] =
      (stand?.offene ?? []) as any[];
    const gefunden = callId
      ?? (nummer ? offeneListe.find((a) => a.nummer && nummerGleich(String(a.nummer), nummer))?.id : null)
      ?? null;

    const personId = kunde?.personId ?? null;
    if (!gefunden && !personId) {
      setNotizFehler(null);
      setMeldung(
        "Dieses Ergebnis lässt sich nicht zuordnen: Zu diesem Anruf gibt es weder eine "
        + "Anruf-Kennung noch einen erkannten Kunden. Ordne den Anruf über „Anderen Kunden "
        + "wählen" + "\u201c zu — oder trag das Ergebnis in der Kundenliste ein.",
      );
      return;
    }

    const ziel = gefunden
      ? `/api/fiaon/telefon/${gefunden}/ergebnis`
      : `/api/fiaon/agent/crm/kunden/${personId}/aktivitaet`;
    // Die Kundenliste nennt das Feld `art`, die Anrufroute `ergebnis`. Beide
    // Namen gehen mit; der Server liest jeweils seinen. Das ist billiger als
    // eine Umbenennung in zwei Routen mitten in einem Notfall.
    const koerper = {
      ergebnis: art,
      art,
      notiz: notiz.trim() || null,
      zusageDatum: datumFeld === "zusage" ? datum : null,
      terminDatum: datumFeld === "termin" ? datum : null,
    };

    const r = await fetch(ziel, {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(koerper),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    // Verlangt der Server eine Notiz, bleibt das Feld offen und sagt warum —
    // statt das Ergebnis stillschweigend zu verwerfen.
    if (j?.brauchtNotiz) {
      setNotizFuer(art);
      setNotizFehler(j.error || "Bitte eine Notiz eintragen.");
      return;
    }
    // ── AUCH DER STUMME AUSGANG BEKOMMT EINEN SATZ ────────────────────────
    // Vorher stand hier `setMeldung(j?.meldung || j?.error || null)`. Bei
    // einem Netzfehler ist `j` null, und dann setzte diese Zeile die Meldung
    // auf NICHTS — derselbe Eindruck wie beim toten Knopf.
    setMeldung(j?.meldung || j?.error
      || (r == null
        ? "Keine Verbindung zum Server — das Ergebnis ist NICHT gespeichert. "
          + "Prüf dein Netz und drück noch einmal."
        : `Der Server hat mit ${r.status} geantwortet und keinen Grund genannt. `
          + "Das Ergebnis ist nicht gespeichert."));
    setDatumFeld(null); setDatum("");
    if (!j?.ok) return;
    setNotiz(""); setNotizFuer(null); setNotizFehler(null);

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

  // ── DAS COCKPIT NEBEN DEM LAUFENDEN ANRUF ───────────────────────────────
  // Es ersetzt das Telefon nicht, es liegt daneben: Wer während des Gesprächs
  // auflegen müsste, um die Agenda zu lesen, liest sie nicht. Der Termin kommt
  // aus derselben Antwort wie die Kundendaten.
  const cockpitDaten = gespraechsDaten && kunde
    && gespraechsDaten.personId === kunde.personId ? gespraechsDaten.kunde : null;

  return (
    <>
      <style>{EINGEHEND_CSS}</style>

      {cockpitOffen && cockpitDaten?.termin && kunde && (
        <OnboardingCockpit
          termin={{
            id: Number(cockpitDaten.termin.id),
            personId: kunde.personId,
            name: cockpitDaten.name || kunde.name,
            telefon: nummer || null,
            email: cockpitDaten.email ?? null,
            beginn: String(cockpitDaten.termin.beginn),
            datumText: new Date(cockpitDaten.termin.beginn)
              .toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "long" }),
            uhrzeit: new Date(cockpitDaten.termin.beginn)
              .toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" }),
            dauerMin: Number(cockpitDaten.termin.dauerMin ?? 15),
            status: String(cockpitDaten.termin.status),
            paket: cockpitDaten.paket ?? null,
            zahlungsstand: cockpitDaten.zahlungsstand ?? null,
          }}
          onZu={() => setCockpitOffen(false)}
          onFertig={(m) => { setCockpitOffen(false); setMeldung(m); void laden(); }}
        />
      )}

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
                      // ── DIE NUMMER GEHT IMMER MIT (21.08.2026) ──────────
                      // Sie stand bis heute NUR im `if` darunter — also nur,
                      // wenn der Anrufer erkannt wurde. Bei einer unbekannten
                      // Nummer blieb `nummer` leer, und damit fand
                      // `dokumentieren` später weder Anruf-Kennung noch
                      // Kunden: Der Ergebnis-Klick war tot (Vikas Meldung).
                      setNummer(eingehend.von);
                      if (eingehend.kunde) {
                        // Der Kunde ist damit gesetzt: Ergebnis festhalten,
                        // Notiz und Akte beziehen sich auf ihn.
                        setKunde({ personId: eingehend.kunde.id, name: eingehend.kunde.name });
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
        <style>{TELEFON_DATEN_CSS}</style>
        {/* Der Sparmodus steht in index.css, nicht hier: Er gilt auch für die
            Seite DAHINTER — Space-Video, Mail-Glasflächen, Blasen-Schatten.
            Als Komponenten-Stil griff er nicht; die Stile der Komponenten
            werden später eingefügt und gewinnen bei gleicher Spezifität. */}

        {/* ── Statuszeile im Display ──────────────────────────────────── */}
        <div className="fi-tel-statuszeile">
          <span className="fi-tel-punkt" data-zustand={zustand} aria-hidden="true" />
          <span className="fi-tel-status-text">
            {zustand === "gespraech" ? `Im Gespräch · ${dauerText(sekunden)}`
              // Kein „Im Gespräch", solange es nur klingelt — und keine Uhr.
              : zustand === "klingelt" ? "Es klingelt beim Kunden"
              : zustand === "waehlt" ? "Verbinde …"
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

        {/* ══════════════════════════════════════════════════════════════════
            DER NAME STEHT NUR EINMAL (31.08.2026)

            ── DER BEFUND (Videoauswertung) ────────────────────────────────
            „Der Kundenname steht im Gesprächsfenster zweimal."

            Diese Zeile stand ohne Zustandsbedingung da — also in JEDEM
            Zustand. Im Gespräch zeigt die große Ansicht den Namen ohnehin
            als `fi-tel-gross-name`; hier kam er ein zweites Mal darüber.

            Auf dem Wählbild ist er richtig (man will wissen, wen man
            anwählt), im Gespräch ist er doppelt. Also nur dort, wo die
            große Ansicht ihn NICHT zeigt.
            ══════════════════════════════════════════════════════════════ */}
        {kunde && zustand !== "waehlt" && zustand !== "klingelt" && zustand !== "gespraech" && (
          <p className="fi-tel-kunde">{kunde.name}</p>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            „DU RUFST [NAME] AN" — VOR DEM WÄHLEN
            Der Satz steht hier und nicht in einer Meldung nach dem Verbinden.
            Eine Warnung, die kommt, wenn es schon klingelt, ist keine.
            Grün: bekannte Nummer. Gelb: unbekannt — dann muss die Zuordnung
            im Ergebnis-Schritt nachgeholt werden.
            ══════════════════════════════════════════════════════════════ */}
        {wem && zustand === "bereit" && (
          <p className="fi-tel-wem" data-unbekannt={wem.person ? undefined : "ja"}
             data-mehrdeutig={wem.mehrdeutig ? "ja" : undefined}>
            {wem.anzeige}
          </p>
        )}

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
        {/* ══════════════════════════════════════════════════════════════════
            DER PEGELBALKEN — VOR DEM ERSTEN ANRUF
            „Der Kunde nimmt ab, aber es spricht niemand." Erlaubt heißt nicht,
            dass das Mikrofon liefert: stummes Headset, falsches Eingabegerät,
            Schalter am Kabel. Der Agent sagt „Test" und SIEHT, ob es ankommt —
            bevor ein Kunde in der Leitung ist.
            ══════════════════════════════════════════════════════════════════ */}
        {mikrofon === "erlaubt" && zustand === "bereit" && (
          <div className="fi-tel-mik" data-stumm={stummVerdacht ? "1" : "0"}>
            <div className="fi-tel-pegel">
              <span className="fi-tel-pegel-marke">Mikrofon</span>
              <span className="fi-tel-pegel-bahn" aria-hidden="true">
                <span className="fi-tel-pegel-fuellung" style={{ width: `${pegel ?? 0}%` }} />
              </span>
              <span className="fi-tel-pegel-text">{pegelText(pegel)}</span>
            </div>

            {/* ══════════════════════════════════════════════════════════════
                DIE WAND, NICHT DER HINWEIS (31.08.2026)

                Am 30.08. wurde hier ein Balken eingebaut. Das Video vom Anruf
                bei Nikita zeigt, warum das nicht genügt: Am Balken stand „sehr
                leise", der Balken war leer — und der Anruf ging trotzdem raus.

                Ein Hinweis, der einen Fehler nur BESCHREIBT, wird im Arbeitsfluss
                überlesen. Wer sechzig Gespräche am Tag führt, liest keine
                Randnotiz, er drückt den grünen Knopf.

                Deshalb ist der Knopf jetzt GESPERRT (siehe `stummVerdacht`) —
                und daneben stehen die zwei Wege heraus, statt nur der Vorwurf.
                ══════════════════════════════════════════════════════════════ */}
            {stummVerdacht && (
              <p className="fi-tel-mik-warnung" role="alert">
                <b>Dein Mikrofon liefert kein Signal</b> — der Kunde würde dich
                nicht hören. Anrufen ist gesperrt, bis etwas ankommt.
              </p>
            )}
            {geraetFehler && <p className="fi-tel-mik-warnung" role="alert">{geraetFehler}</p>}

            {/* ── DIE PROBENPFLICHT BEIM ERSTEN MAL (31.08.2026) ─────────
                Ein leerer Balken zeigt nur den einen Fall: Das Mikrofon liefert
                NICHTS. Es gibt einen zweiten, den kein Balken zeigt — der Ton
                geht in ein anderes Gerät als in die Telefonie, oder er ist zu
                leise, um am anderen Ende anzukommen. Beides sieht am Balken
                gesund aus. Nur das eigene Ohr entscheidet das. */}
            {probePflicht && !stummVerdacht && (
              <p className="fi-tel-mik-hinweis">
                <b>Einmal die Sprechprobe, bitte.</b> Ein Balken kann täuschen —
                wenn du dich selbst hörst, kommt dein Ton auch beim Kunden an.
                Danach ist sie freiwillig.
              </p>
            )}

            {/* ── (i) GERÄTEWAHL ─────────────────────────────────────────
                Bis zum 31.08.2026 gab es sie NICHT: `getUserMedia({audio:true})`
                und das SDK nahmen beide den Browser-Standard. Wer ein stummes
                Standardgerät hatte, konnte in der Anwendung nichts dagegen tun.
                Die Wahl wird je Mitarbeiter gemerkt und beim Anruf über
                `d.audio.setInputDevice` an Twilio übergeben. */}
            {geraete.length > 0 && (
              <label className="fi-tel-mik-wahl">
                <span>Eingabegerät</span>
                <select
                  value={geraetId ?? ""}
                  onChange={(e) => {
                    const v = e.target.value || null;
                    setGeraetId(v);
                    geraetSpeichern(stand?.agentId, v);
                    setProbe("aus");
                    setProbeFehler(null);
                  }}
                >
                  <option value="">Standard des Browsers</option>
                  {geraete.map((g) => (
                    <option key={g.deviceId} value={g.deviceId}>{g.label}</option>
                  ))}
                </select>
              </label>
            )}

            {/* ── (ii) SPRECHPROBE ────────────────────────────────────────
                Der einzige Beweis, den ein Mensch ohne Messtechnik führen kann:
                Wer sich selbst hört, ist sendebereit. Ein Balken kann man
                falsch deuten; die eigene Stimme nicht. */}
            <div className="fi-tel-mik-probe">
              <button type="button" onClick={() => void sprechprobe()}
                      disabled={probe === "laeuft" || probe === "spielt"}
                      className="fi-tel-mik-probe-knopf">
                {probe === "laeuft" ? "Sag einen Satz … (2 s)"
                  : probe === "spielt" ? "Wird abgespielt …"
                  : probe === "fertig" ? "Noch einmal prüfen"
                  : "Sprechprobe"}
              </button>
              <span className="fi-tel-mik-probe-text">
                {probe === "laeuft" ? "Ich nehme zwei Sekunden auf."
                  : probe === "spielt" ? "Hörst du dich selbst? Dann bist du sendebereit."
                  : probe === "fertig" ? "Wenn du dich gehört hast, ist alles in Ordnung."
                  : "Zwei Sekunden aufnehmen und sofort abspielen."}
              </span>
            </div>
            {probeFehler && <p className="fi-tel-mik-warnung">{probeFehler}</p>}
          </div>
        )}

        {mikrofon !== "erlaubt" && (
          <button type="button"
                  onClick={async () => {
                    try {
                      // Auch die ERSTMALIGE Erlaubnis über das gewählte Gerät:
                      // Sonst fragt der Browser die Freigabe für den Standard ab,
                      // und der Agent erteilt sie für ein Mikrofon, das er nicht
                      // benutzen will. Beim ersten Mal ist `geraetId` ohnehin
                      // leer — dann verhält es sich wie vorher.
                      const st = await navigator.mediaDevices.getUserMedia(tonAuflagen(geraetId));
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
            {/* ══════════════════════════════════════════════════════════════
                DER TAGESSTAND DER NUMMER — DEZENT, UND OHNE FOLGEN

                Er erscheint erst ab der Schwelle und sagt ausdrücklich, dass
                weitergearbeitet werden kann. Grau, keine Farbe, kein Symbol:
                Wer hier eine Warnfarbe sieht, hört auf zu wählen — und genau
                das soll nicht passieren.

                Rot ist Fehlern vorbehalten; hier ist kein Fehler. Die
                Dringlichkeit gehört dem Betreiber (Diagnose + Mail), nicht dem
                Menschen am Telefon.
               ══════════════════════════════════════════════════════════════ */}
            {stand.kontingent?.hinweis && (
              <p data-fiaon="anruf-tagesstand"
                 style={{
                   margin: "0 0 12px", padding: "8px 11px",
                   fontSize: 11.5, lineHeight: 1.5,
                   color: "rgba(191,214,247,.62)",
                   background: "rgba(191,214,247,.06)",
                   border: "1px solid rgba(191,214,247,.12)",
                   borderRadius: 12,
                 }}>
                {stand.kontingent.hinweis}
              </p>
            )}

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

            {/* ══════════════════════════════════════════════════════════════
                DER KNOPF IST GESPERRT, WENN DAS MIKROFON NICHTS LIEFERT

                ── DER BEFUND (Videoauswertung, 31.08.2026) ────────────────
                Am Pegelbalken stand „sehr leise", der Balken war leer — und der
                Anruf ging trotzdem raus. Der Balken vom 30.08. war ein HINWEIS,
                und ein Hinweis im Arbeitsfluss wird überlesen. Wer sechzig
                Gespräche am Tag führt, drückt den grünen Knopf.

                Die Sperre kostet einen Anruf, der ohnehin nichts geworden wäre —
                und spart dem Kunden das Erlebnis „nimmt ab, keiner spricht", das
                unsere Nummer bei ihm verbrennt.

                `title` nennt den Grund: Ein gesperrter Knopf ohne Begründung
                wird als Fehler der Anwendung gemeldet, nicht als Hinweis gelesen.
                ══════════════════════════════════════════════════════════════ */}
            <button type="button" onClick={() => void waehlen()}
                    disabled={nummer.length < 4 || mikrofon === "verweigert"
                              || stummVerdacht || probePflicht}
                    title={stummVerdacht
                      ? "Dein Mikrofon liefert kein Signal — der Kunde würde dich nicht hören."
                      : probePflicht
                        ? "Mach einmal die Sprechprobe. Wer sich selbst hört, ist sendebereit."
                        : undefined}
                    className="fi-tel-gruen">
              {/* Zwei Sperrgründe, zwei Aufschriften. „Mikrofon prüfen" bei
                  einem stummen Gerät wäre bei fehlender Probe falsch: Das Gerät
                  ist in Ordnung, es fehlt nur der Nachweis. Ein Knopf, der den
                  falschen Grund nennt, schickt jemanden auf die falsche Suche. */}
              <MarkeHoerer size={19} />{" "}
              {stummVerdacht ? "Mikrofon prüfen"
                : probePflicht ? "Erst Sprechprobe"
                : "Anrufen"}
            </button>
            {kunde && (
              <button type="button" onClick={() => { setKunde(null); setNummer(""); }}
                      className="fi-tel-neben" style={{ width: "100%", marginTop: 8 }}>
                Anderen Kunden wählen
              </button>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            NUR EINE HAUPTANSICHT — UND ZWAR NACHWEISLICH (31.08.2026)

            ── DER BEFUND (Videoauswertung) ────────────────────────────────
            „Beim Wechsel Gespräch → Ergebnis werden beide Ansichten
            gleichzeitig gezeichnet (Namen/Zahlen doppelt, unlesbar)."

            Die Blöcke schließen sich über `zustand === …` eigentlich aus. Genau
            das ist die Falle: Es SIEHT aus wie eine Garantie, ist aber nur eine
            Übereinkunft zwischen vier verstreuten Bedingungen. Wer eine fünfte
            Ansicht dazwischensetzt und die Bedingung falsch abschreibt, erzeugt
            wieder zwei gleichzeitige Ansichten — und niemand merkt es, weil kein
            Prüfstand darauf sieht.

            `data-ansicht` macht die Ansicht MESSBAR: Der Browsertest zählt die
            Knoten mit diesem Merkmal, und mehr als einer ist ein Fehlschlag.
            Eine Regel, die man nachzählen kann, hält.
            ══════════════════════════════════════════════════════════════════ */}
        {(zustand === "waehlt" || zustand === "klingelt" || zustand === "gespraech") && (
          <div style={{ textAlign: "center", paddingTop: 18 }}
               data-ansicht="gespraech" data-zustand={zustand}>
            <p className="fi-tel-gross-name" data-rolle="kundenname">{kunde?.name ?? nummer}</p>
            {/* Die Uhr läuft NUR im Gespräch. Im klingelnden Zustand stand hier
                bis zum 31.08.2026 „00:00" mit laufendem Timer — der Agent hielt
                die Leitung für offen und sprach ins Freizeichen. */}
            <p className="fi-tel-uhr">{zustand === "gespraech" ? dauerText(sekunden) : "···"}</p>
            {kunde && <p className="fi-tel-nummer">{nummer}</p>}

            {/* ══════════════════════════════════════════════════════════════
                DER HINWEIS IM KLINGELNDEN ZUSTAND

                Er steht hier und nicht als Meldung nach dem Verbinden: Wer
                schon gesprochen hat, dem hilft der Hinweis nicht mehr.
                ══════════════════════════════════════════════════════════════ */}
            {zustand === "klingelt" && (
              <p className="fi-tel-klingelt-hinweis">
                Warte, bis der Kunde abhebt — sprich nicht ins Freizeichen.
              </p>
            )}
            {zustand === "waehlt" && (
              <p className="fi-tel-klingelt-hinweis">Verbinde …</p>
            )}

            {/* ══════════════════════════════════════════════════════════════
                DIE STAMMDATEN WÄHREND DES GESPRÄCHS

                ── DER BEFUND (11.08.2026) ────────────────────────────────────
                Ein Agent: „Während des Anrufs kann ich die Stammdaten und
                Kundendetails nicht vernünftig einsehen."

                Er hat recht: Hier stand nur Name, Dauer und Nummer. Wer am
                Telefon gefragt wird „welches Paket habe ich denn gebucht?",
                musste das Gespräch verlassen.

                Jetzt steht das Wichtigste da — Paket, offener Betrag,
                Verwendungszweck. Eingeklappt, damit die große Uhr bleibt: Wer
                sie braucht, tippt einmal.
                ══════════════════════════════════════════════════════════════ */}
            {/* ══════════════════════════════════════════════════════════════
                DIE WARNUNG IM GESPRÄCH (30.08.2026)
                Zehn Sekunden Stille am Eingang sind im laufenden Gespräch kein
                Zufall. Kürzer wäre ein Fehlalarm bei jeder Sprechpause; länger
                hätte der Kunde schon aufgelegt.
                ══════════════════════════════════════════════════════════════ */}
            {/* Acht Sekunden (WARNUNG_NACH_SEKUNDEN), nicht zehn: Der Wert steht
                jetzt in fiaon-mikrofon.ts neben der Sperrschwelle, damit beide
                nicht auseinanderlaufen. Und nur im GESPRÄCH — im klingelnden
                Zustand spricht niemand, da wäre die Warnung ein Fehlalarm. */}
            {zustand === "gespraech" && stilleSek >= WARNUNG_NACH_SEKUNDEN && (
              <div className="fi-tel-stillwarnung" role="alert">
                <b>Der Kunde hört dich vermutlich nicht.</b> Seit {Math.floor(stilleSek)} Sekunden
                kommt an deinem Mikrofon nichts an. Prüfe den Stummschalter am Headset
                und das Eingabegerät.
              </div>
            )}

            {kunde && (() => {
              // DIE WAND: Es werden nur Daten gezeigt, die zu DIESEM Kunden
              // gehören. Solange die Kennung nicht übereinstimmt, steht
              // „Wird geladen …" da — nie die Daten des vorigen Gesprächs.
              // Fremde Stammdaten am Telefon sind schlimmer als eine Lücke:
              // Der Agent liest dem Menschen dessen eigene Angaben falsch vor.
              const daten = gespraechsDaten && gespraechsDaten.personId === kunde.personId
                ? gespraechsDaten.kunde
                : null;
              return (
              /* ══════════════════════════════════════════════════════════════
                 AUFGEKLAPPT, WENN EIN STARTGESPRÄCH LÄUFT (21.08.2026)

                 Für einen Verkäufer ist die Nummer die Hauptsache und die
                 Kundendaten ein Nachschlagewerk — deshalb war der Block
                 zugeklappt. Für ein Startgespräch ist es umgekehrt: Der Kunde
                 hat bezahlt, und das Gespräch beginnt mit seinem Stand. Wer
                 dafür erst aufklappen muss, sieht ihn nicht.
                 ══════════════════════════════════════════════════════════════ */
              <details className="fi-tel-daten" open={!!daten?.termin}>
                <summary>Kundendaten</summary>
                {!daten && !datenFehler && <p className="fi-tel-daten-laedt">Wird geladen …</p>}
                {/* Der Grund, warum nichts da ist — statt „Wird geladen …" bis
                    zum Auflegen. */}
                {!daten && datenFehler && (
                  <p className="fi-tel-daten-fehler" role="alert">{datenFehler}</p>
                )}
                {daten && (
                  <>
                    <div className="fi-tel-daten-raster">
                      {([
                        ["Kunde", daten.name],
                        ["Paket", daten.paket || daten.buchungen?.map((b: any) =>
                          `${b.bezeichnung}${b.bezahlt ? " ✓" : ""}`).join(", ")],
                        ["Zahlung", daten.zahlungsstand],
                        ["Offen", daten.offenCents
                          ? `${(daten.offenCents / 100).toFixed(2).replace(".", ",")} €` : null],
                        ["SCHUFA", daten.schufaStand],
                        ["Offene Punkte", daten.offenePunkte?.length
                          ? daten.offenePunkte.join(", ") : "keine"],
                        ["Verwendungszweck", daten.verwendungszweck],
                        ["E-Mail", daten.email],
                        ["Ort", daten.ort],
                        ["Kunde seit", daten.kundeSeit],
                      ] as const).filter(([, w]) => w).map(([t, w]) => (
                        <div key={t}>
                          <span className="fi-tel-daten-marke">{t}</span>
                          <span className="fi-tel-daten-wert">{w}</span>
                        </div>
                      ))}
                    </div>
                    {/* ══════════════════════════════════════════════════════
                        „GESPRÄCH FÜHREN" — DIE SIEBEN SCHRITTE IM ANRUF

                        Das Cockpit gab es nur auf /agent/startgespraeche, und
                        zwar nur über die Termin-Karte. Wer aus dem Telefon
                        heraus arbeitete — also genau während des Gesprächs —
                        kam nicht hin und führte es aus dem Gedächtnis.
                        ══════════════════════════════════════════════════════ */}
                    {daten.termin && (
                      <button type="button" onClick={() => setCockpitOffen(true)}
                              data-fiaon="cockpit-oeffnen"
                              className="fi-tel-cockpit">
                        Gespräch führen — die 7 Schritte
                        {daten.termin.vertretung ? " (Vertretung)" : ""}
                      </button>
                    )}
                  </>
                )}
              </details>
              );
            })()}

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
          <div data-ansicht="ergebnis">
            <p className="fi-tel-karte-text" style={{ marginBottom: 12 }}>
              Ein Klick, dann ist es dokumentiert — Wiedervorlage und Zusage setzt das System selbst.
            </p>
            {datumFeld && (
              <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)}
                     aria-label="Datum" className="fi-tel-datum" />
            )}
            {/* ── DAS NOTIZFELD ──────────────────────────────────────────
                Es erscheint, sobald ein Ergebnis eine Notiz braucht — oder
                wenn der Mensch es selbst aufklappt. Der Text landet im
                Verlauf der Akte UND am Anruf neben der Aufnahme. */}
            {notizFuer && (
              <div style={{ marginBottom: 10 }}>
                <textarea value={notiz} onChange={(e) => { setNotiz(e.target.value); setNotizFehler(null); }}
                          rows={3} autoFocus
                          placeholder="Was wurde besprochen oder vereinbart?"
                          aria-label="Notiz zum Ergebnis"
                          className="fi-tel-notiz" />
                <p className="fi-tel-notiz-fuss" data-fehler={notizFehler ? "ja" : undefined}>
                  {/* Die Mindestlänge kommt aus `shared/` — hier stand die 10
                      als Zahl, und der Server prüfte seine eigene. Zwei Zahlen
                      für dieselbe Grenze gehen beim ersten Ändern auseinander. */}
                  {notizFehler
                    ?? (ERGEBNISSE.find((e) => e.art === notizFuer)?.notizPflicht
                      ? `Pflicht — noch ${Math.max(0, NOTIZ_MINDESTLAENGE - notiz.trim().length)} Zeichen`
                      : "Freiwillig. Steht danach im Verlauf der Akte.")}
                </p>
              </div>
            )}
            <div className="fi-tel-ergebnisse">
              {ERGEBNISSE.map((e) => (
                <button key={e.art} type="button"
                        onClick={() => {
                          if (e.braucht && datumFeld !== e.braucht) { setDatumFeld(e.braucht); return; }
                          // Pflicht-Notiz: erst das Feld zeigen, dann senden.
                          if (e.notizPflicht && notiz.trim().length < NOTIZ_MINDESTLAENGE) {
                            setNotizFuer(e.art);
                            setNotizFehler(notiz.trim().length > 0
                              ? `Noch etwas ausführlicher, bitte (mindestens ${NOTIZ_MINDESTLAENGE} Zeichen).`
                              : null);
                            return;
                          }
                          void dokumentieren(e.art);
                        }}
                        className="fi-tel-ergebnis"
                        data-pflicht={e.notizPflicht ? "ja" : undefined}>
                  {e.label}
                </button>
              ))}
            </div>
            {/* Freiwillige Notiz zu JEDEM anderen Ergebnis. */}
            {!notizFuer && (
              <button type="button" onClick={() => setNotizFuer("frei")}
                      className="fi-tel-notiz-auf">
                Notiz hinzufügen
              </button>
            )}
          </div>
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
/* ── DER PEGELBALKEN ───────────────────────────────────────────────────────
   Bernstein bei Stille, nicht Rot: Stille ist ein HINWEIS, kein Fehler — es
   könnte auch einfach niemand sprechen. Eine Farbe, die anklagt, wird
   weggeklickt.

   Er sitzt IM Mikrofon-Kasten und braucht deshalb keine eigene Fläche: Der
   erste Entwurf hatte eine (helle) und stand als weiße Pille im dunklen
   Display — sichtbar erst auf dem Screenshot der Abnahme. */
.fi-tel-pegel { display: flex; align-items: center; gap: 9px; }
.fi-tel-pegel-marke {
  font-size: 9.5px; font-weight: 700; letter-spacing: .14em;
  text-transform: uppercase; color: #93c5fd; flex-shrink: 0;
}
.fi-tel-pegel-bahn {
  position: relative; flex: 1; height: 6px; min-width: 40px;
  border-radius: 999px; background: rgba(9,20,45,.6); overflow: hidden;
  box-shadow: inset 0 0 0 1px rgba(147,197,253,.18);
}
.fi-tel-pegel-fuellung {
  display: block; height: 100%; border-radius: 999px;
  background: linear-gradient(90deg, #34d399, #10b981);
  transition: width .12s linear;
}
.fi-tel-pegel[data-still="1"] .fi-tel-pegel-fuellung { background: #fcd34d; }
.fi-tel-pegel-text {
  font-size: 11px; color: rgba(191,214,247,.7); flex-shrink: 0;
}
.fi-tel-pegel[data-still="1"] .fi-tel-pegel-text { color: #fcd34d; font-weight: 600; }
.fi-tel-mik[data-stumm="1"] .fi-tel-pegel-text { color: #fecaca; }
.fi-tel-mik[data-stumm="1"] .fi-tel-pegel-marke { color: #fecaca; }

/* ══════════════════════════════════════════════════════════════════════════
   DER MIKROFON-KASTEN — IM DUNKLEN GERÄT

   ── AUFGEFALLEN AM SCREENSHOT (31.08.2026) ──────────────────────────────
   Der erste Entwurf trug helle Flächen (Weiß bei 75 Prozent, Text in Grau
   #64748b). Auf einer weißen Seite wäre das richtig gewesen — das
   Telefon ist aber ein dunkelblaues Gerät. Auf dem Bild stand eine weiße Pille
   mitten im dunklen Display, und die grauen Beschriftungen waren darauf kaum
   zu lesen.

   Genau das meint AGENTS.md mit „Der Screenshot ist Teil der Abnahme": Der
   Client-Build war grün, der Prüfstand war grün, und das Bild zeigte einen
   Fremdkörper.

   Jetzt dieselbe Sprache wie der Rest des Displays: durchscheinendes Weiß über
   dem Navy, Text in #dbe8fb, Beschriftungen in #93c5fd.
   ══════════════════════════════════════════════════════════════════════════ */
.fi-tel-mik {
  margin: 14px 0 4px; padding: 11px 13px; border-radius: 15px;
  background: linear-gradient(158deg, rgba(255,255,255,.09), rgba(255,255,255,.04));
  box-shadow: inset 0 0 0 1px rgba(147,197,253,.2);
}
/* Bernstein, nicht Rot, solange nur der Pegel fehlt — und Rot erst, wenn der
   Anruf dadurch gesperrt ist. Ein Zustand, der etwas VERHINDERT, darf kräftiger
   sprechen als einer, der nur hinweist. */
.fi-tel-mik[data-stumm="1"] {
  background: linear-gradient(158deg, rgba(248,113,113,.16), rgba(248,113,113,.07));
  box-shadow: inset 0 0 0 1px rgba(248,113,113,.42);
}
.fi-tel-mik-warnung {
  margin: 8px 0 0; font-size: 12px; line-height: 1.5; color: #fecaca;
}
.fi-tel-mik-warnung b { color: #fff; }
/* Der Probenhinweis: bernstein, nicht rot — es ist kein Defekt, sondern ein
   fehlender Nachweis. */
.fi-tel-mik-hinweis {
  margin: 8px 0 0; font-size: 12px; line-height: 1.5; color: #fcd34d;
}
.fi-tel-mik-hinweis b { color: #fff; }
.fi-tel-mik-wahl { display: flex; align-items: center; gap: 9px; margin-top: 10px; }
.fi-tel-mik-wahl > span {
  font-size: 9.5px; font-weight: 700; letter-spacing: .14em;
  text-transform: uppercase; color: #93c5fd; flex-shrink: 0;
}
.fi-tel-mik-wahl select {
  flex: 1; min-width: 0; font-size: 12px; padding: 6px 8px;
  border-radius: 9px; border: 0;
  box-shadow: inset 0 0 0 1px rgba(147,197,253,.28);
  background: rgba(9,20,45,.72); color: #dbe8fb;
}
.fi-tel-mik-probe { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
.fi-tel-mik-probe-knopf {
  flex-shrink: 0; font-size: 12px; font-weight: 650; padding: 7px 13px;
  border-radius: 999px; border: 0; cursor: pointer;
  color: #0a1a3c; background: linear-gradient(178deg, #bfdbfe, #93c5fd);
}
.fi-tel-mik-probe-knopf:disabled { opacity: .5; cursor: default; }
.fi-tel-mik-probe-text { font-size: 11px; line-height: 1.4; color: rgba(191,214,247,.66); }

/* Der Hinweis im klingelnden Zustand — „sprich nicht ins Freizeichen". */
.fi-tel-klingelt-hinweis {
  margin: 12px auto 0; max-width: 236px;
  font-size: 12.5px; line-height: 1.5; color: #fcd34d;
}

.fi-tel-stillwarnung {
  margin: 8px 0; padding: 9px 11px; border-radius: 10px;
  background: rgba(180,83,9,.1); border: 1px solid rgba(180,83,9,.3);
  color: #92400e; font-size: 12px; line-height: 1.45;
}

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

.fi-tel-notiz {
  width: 100%; border-radius: 10px; padding: 9px 11px; font-size: 13px; line-height: 1.5;
  color: #eef3fb; background: rgba(255,255,255,.06); border: 0; outline: none; resize: vertical;
  box-shadow: inset 0 0 0 1px rgba(191,214,247,.18);
}
.fi-tel-notiz:focus { box-shadow: inset 0 0 0 1px rgba(120,170,240,.42); }
.fi-tel-notiz-fuss {
  margin: 5px 0 0; font-size: 11px; color: rgba(191,214,247,.62);
}
.fi-tel-notiz-fuss[data-fehler="ja"] { color: #f3b9b9; font-weight: 600; }
.fi-tel-notiz-auf {
  margin-top: 10px; font-size: 11.5px; font-weight: 600; color: rgba(191,214,247,.72);
  background: none; border: 0; text-decoration: underline; text-underline-offset: 2px;
}
.fi-tel-ergebnis[data-pflicht="ja"]::after {
  content: "·"; margin-left: 5px; color: rgba(240,220,180,.9);
}
.fi-tel-kunde {
  text-align: center; font-size: 15px; font-weight: 700; color: #eef3fb;
  margin: 0 0 12px; letter-spacing: -.01em;
}
/* „Du rufst [Name] an." — die Auskunft, wem die Nummer gehört. */
.fi-tel-wem {
  text-align: center; font-size: 12.5px; font-weight: 600; margin: 0 0 12px;
  padding: 7px 10px; border-radius: 9px; line-height: 1.35;
  color: #bfe3c8; background: rgba(48,132,74,.16);
  box-shadow: inset 0 0 0 1px rgba(120,200,150,.24);
}
.fi-tel-wem[data-unbekannt="ja"] {
  color: #f0dcb4; background: rgba(160,120,30,.18);
  box-shadow: inset 0 0 0 1px rgba(220,180,90,.26);
}
.fi-tel-wem[data-mehrdeutig="ja"] {
  color: #f3cfcf; background: rgba(150,50,50,.18);
  box-shadow: inset 0 0 0 1px rgba(220,120,120,.28);
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

const TELEFON_DATEN_CSS = `
/* ── STAMMDATEN IM GESPRÄCH ────────────────────────────────────────────────
   Eingeklappt, damit die große Uhr sichtbar bleibt. Wer sie braucht, tippt
   einmal — das ist schneller, als das Gespräch zu verlassen. */
.fi-tel-daten {
  margin: 12px 14px 0; text-align: left;
  border-radius: 12px; overflow: hidden;
  background: rgba(255,255,255,.06);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.09);
}
.fi-tel-daten > summary {
  padding: 8px 12px; cursor: pointer; list-style: none;
  font-size: 11.5px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase;
  color: rgba(191,214,247,.8) !important;
}
.fi-tel-daten > summary::-webkit-details-marker { display: none; }
.fi-tel-daten > summary::after { content: " ▾"; opacity: .55; }
.fi-tel-daten[open] > summary::after { content: " ▴"; }
.fi-tel-daten-raster { padding: 2px 12px 10px; display: flex; flex-direction: column; gap: 6px; }
.fi-tel-daten-raster > div { display: flex; gap: 9px; align-items: baseline; }
.fi-tel-daten-marke {
  width: 92px; flex-shrink: 0;
  font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
  color: rgba(191,214,247,.6) !important;
}
.fi-tel-daten-wert {
  min-width: 0; flex: 1; font-size: 12.5px; line-height: 1.4;
  overflow-wrap: anywhere;
  color: #eef4ff !important;
}
.fi-tel-daten-laedt {
  padding: 2px 12px 10px; font-size: 12px;
  color: rgba(191,214,247,.6) !important;
}
/* Der GRUND, warum keine Daten da sind. Bernstein, nicht Grau: „Wird geladen"
   in Grau war genau die Meldung „ich sehe nichts". */
.fi-tel-daten-fehler {
  padding: 2px 12px 10px; font-size: 12px; line-height: 1.45; font-weight: 600;
  color: #fcd34d !important;
}
/* ── „GESPRÄCH FÜHREN" ────────────────────────────────────────────────────
   Er steht IM Datenblock und nicht in der Knopfleiste: Dort konkurriert er
   mit Stumm, Tastatur und Auflegen — drei Knöpfe, die man im Reflex trifft. */
.fi-tel-cockpit {
  display: block; width: calc(100% - 24px); margin: 2px 12px 12px;
  padding: 10px 12px; min-height: 44px;
  border: 0; border-radius: 10px; cursor: pointer;
  font-size: 12.5px; font-weight: 700; text-align: left;
  background: rgba(96,165,250,.22); color: #eef4ff;
  box-shadow: inset 0 0 0 1px rgba(147,197,253,.35);
}
.fi-tel-cockpit:hover { background: rgba(96,165,250,.32); }
`;
