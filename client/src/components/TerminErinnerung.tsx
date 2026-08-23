// ═══════════════════════════════════════════════════════════════════════════
// DIE TERMIN-ERINNERUNG
//
// ── DER AUFTRAG (11.08.2026) ───────────────────────────────────────────────
// Ein Agent: „Bei gebuchten Terminen/Rückrufen gibt es aktuell keine
// Erinnerung, wodurch Termine schnell übersehen oder verpasst werden können.
// Vorschlag: Eine automatische Erinnerung integrieren, z. B. als interne
// Benachrichtigung oder per E-Mail/SMS."
//
// ── WARUM IM PORTAL UND NICHT NUR PER MAIL ─────────────────────────────────
// Eine Mail-Erinnerung gibt es bereits: `runCallbackReminders` schickt sechzig
// Minuten vorher `agent_callback_reminder` über Make. Sie hängt damit an einem
// externen Dienst, einer Zweig-Konfiguration und einem Postfach, das offen
// sein muss.
//
// Wer im Portal arbeitet, sieht diese Leiste sofort — ohne Mail, ohne zweites
// Fenster, ohne Abhängigkeit. Beides zusammen ist besser als eines von beiden:
// Die Mail erreicht ihn, wenn er weg ist; die Leiste, wenn er da ist.
//
// ── ZWEI STUFEN STATT EINER (23.08.2026, Plan §16, E-044) ──────────────────
// 1. DIE LEISTE (unverändert): steht am oberen Rand, zählt herunter, deckt
//    Rückrufe UND Termine ab, auch überfällige. Sie blockiert nichts.
// 2. DAS POPUP (neu): 5, 2 und 1 Minute vor jedem eigenen gebuchten Termin
//    springt einmal je Schwelle ein zentriertes Glas-Popup auf — denn ab
//    jetzt wird Pünktlichkeit serverseitig GEMESSEN (fiaon_termin_treue),
//    und wer den Anruf verpasst, wird der Leitung gemeldet. Ein Popup, das
//    man nicht übersehen kann, ist die faire Vorstufe dieser Messung.
//    Merker je Termin+Schwelle in sessionStorage: einmal gezeigt ist gezeigt,
//    auch nach einem Seitenwechsel. Datenquelle ist /agent/termine — die
//    Terminliste liefert Name, Uhrzeit UND Telefonnummer für „Jetzt anrufen".
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import "@/styles/office-termintreue.css";

interface Faellig {
  logId: number;
  personId: number;
  name: string;
  /** ISO-Zeitpunkt. */
  wann: string;
  /** Minuten bis zum Termin — negativ heißt überfällig. */
  inMinuten: number;
  notiz: string | null;
  art: "rueckruf" | "startgespraech";
}

/** Ein eigener gebuchter Termin aus /agent/termine — die Quelle des Popups. */
interface EigenTermin {
  id: number;
  personId: number;
  name: string;
  telefon: string | null;
  /** ISO-Zeitpunkt des Beginns. */
  beginn: string;
  /** „14:30" — vom Server in Europe/Berlin gerechnet. */
  uhrzeit: string;
  status: string;
}

/** Wie weit im Voraus wird erinnert? */
const VORLAUF_MIN = 30;

/** Wie oft wird nachgesehen? */
const TAKT_MS = 60_000;

/** Nach dem Wegklicken: wie lange Ruhe? */
const SCHLUMMER_MS = 5 * 60_000;

/** Die Popup-Schwellen in Minuten vor dem Beginn — je Termin einmal. */
const SCHWELLEN = [5, 2, 1] as const;

/** Der sessionStorage-Merker: dieser Termin, diese Schwelle — schon gezeigt? */
const merker = (terminId: number, schwelle: number) => `fiaon-tt-${terminId}-${schwelle}`;

export function TerminErinnerung() {
  const [faellig, setFaellig] = useState<Faellig[]>([]);
  const [schlummert, setSchlummert] = useState<Record<number, number>>({});
  const [termine, setTermine] = useState<EigenTermin[]>([]);
  const [popup, setPopup] = useState<EigenTermin | null>(null);
  // Der Sekundentakt für Schwellen und Countdown. Er tickt nur, wenn er
  // gebraucht wird — siehe den Effekt unten.
  const [, setTick] = useState(0);

  const holen = useCallback(async () => {
    const [leiste, liste] = await Promise.all([
      fetch(`/api/fiaon/agent/termine/faellig?vorlauf=${VORLAUF_MIN}`,
        { credentials: "include" }).then((r) => r.json()).catch(() => null),
      fetch(`/api/fiaon/agent/termine`,
        { credentials: "include" }).then((r) => r.json()).catch(() => null),
    ]);
    if (leiste?.ok) setFaellig(leiste.termine ?? []);
    if (liste?.ok) {
      setTermine(((liste.termine ?? []) as EigenTermin[]).filter((t) => t.status === "gebucht"));
    }
  }, []);

  useEffect(() => {
    void holen();
    // ── DER TAKT IST EINE MINUTE, NICHT ZEHN SEKUNDEN ────────────────────
    // Ein Termin verschiebt sich nicht sekündlich. Häufigeres Nachfragen
    // kostet Datenbank-Runden und bringt nichts, was ein Mensch merken würde.
    const uhr = window.setInterval(() => void holen(), TAKT_MS);
    // Wer den Tab wieder öffnet, will den aktuellen Stand sehen — nicht den
    // von vor einer Stunde.
    const beiRueckkehr = () => { if (!document.hidden) void holen(); };
    document.addEventListener("visibilitychange", beiRueckkehr);
    return () => {
      window.clearInterval(uhr);
      document.removeEventListener("visibilitychange", beiRueckkehr);
    };
  }, [holen]);

  // ── DER SEKUNDENTAKT — NUR WENN ETWAS ANSTEHT ──────────────────────────
  // Der 1-Sekunden-Tick läuft ausschließlich, solange das Popup offen ist
  // oder ein Termin in den nächsten sechs Minuten beginnt. Den ganzen Tag
  // sekündlich zu rendern wäre Arbeit ohne Publikum.
  const naechsterBeginn = termine.reduce<number | null>((min, t) => {
    const b = new Date(t.beginn).getTime();
    return b > Date.now() && (min === null || b < min) ? b : min;
  }, null);
  const tickNoetig = popup !== null
    || (naechsterBeginn !== null && naechsterBeginn - Date.now() < 6 * 60_000);
  useEffect(() => {
    if (!tickNoetig) return;
    const i = window.setInterval(() => setTick((n) => n + 1), 1_000);
    return () => window.clearInterval(i);
  }, [tickNoetig]);

  // ── DIE SCHWELLENPRÜFUNG (T−5 / T−2 / T−1) ─────────────────────────────
  // Bei jedem Tick: Für jeden gebuchten Termin und jede noch nicht gezeigte
  // Schwelle, deren Fenster erreicht ist, wird der Merker gesetzt und das
  // Popup geöffnet. Wer die Seite erst bei T−90 s lädt, verbraucht 5 und 2
  // in einem Zug und sieht EIN Popup — nicht drei nacheinander.
  useEffect(() => {
    const jetzt = Date.now();
    let zeigen: EigenTermin | null = null;
    for (const t of termine) {
      const rest = new Date(t.beginn).getTime() - jetzt;
      if (rest <= 0 || rest > SCHWELLEN[0] * 60_000) continue;
      for (const s of SCHWELLEN) {
        if (rest > s * 60_000) continue;
        const key = merker(t.id, s);
        if (sessionStorage.getItem(key)) continue;
        try { sessionStorage.setItem(key, "1"); } catch { /* voll oder gesperrt — dann eben mehrfach */ }
        zeigen = t;
      }
    }
    if (zeigen) setPopup(zeigen);
  });

  const jetzt = Date.now();
  const zeigenListe = faellig.filter((t) => (schlummert[t.logId] ?? 0) < jetzt);

  // Der dringendste zuerst — überfällige vor anstehenden.
  const sortiert = [...zeigenListe].sort((a, b) => a.inMinuten - b.inMinuten);
  const erste = sortiert[0];
  const weitere = sortiert.length - 1;

  const zeit = (t: Faellig) => {
    if (t.inMinuten < -60) return `seit ${Math.round(-t.inMinuten / 60)} Std überfällig`;
    if (t.inMinuten < 0) return `seit ${-t.inMinuten} Min überfällig`;
    if (t.inMinuten === 0) return "jetzt";
    if (t.inMinuten < 60) return `in ${t.inMinuten} Min`;
    return new Date(t.wann).toLocaleTimeString("de-DE", {
      hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin",
    }) + " Uhr";
  };

  // Countdown des Popups: m:ss bis zum Beginn, „jetzt" ab dem Beginn.
  const restSek = popup ? Math.max(0, Math.round((new Date(popup.beginn).getTime() - jetzt) / 1000)) : 0;
  const countdown = restSek > 0
    ? `${Math.floor(restSek / 60)}:${String(restSek % 60).padStart(2, "0")}`
    : "jetzt";

  const anrufen = () => {
    if (!popup?.telefon) return;
    window.dispatchEvent(new CustomEvent("fiaon-anrufen", {
      detail: { nummer: popup.telefon, personId: popup.personId, name: popup.name },
    }));
    setPopup(null);
  };

  return (
    <>
      {erste && (
        <>
          <style>{ERINNERUNG_CSS}</style>
          <div className="fi-erin" role="status" aria-live="polite"
               data-ueberfaellig={erste.inMinuten < 0 ? "1" : "0"}>
            <span className="fi-erin-punkt" aria-hidden="true" />
            {/* ── DIE ART AUS DER EINEN ABLEITUNG (30.08.2026) ────────────────
                Hier stand „Startgespräch" / „Rückruf" aus einem Feld, das nur
                diese Leiste kennt — die dritte Fassung derselben Frage. Jetzt
                kommt der Text vom Server aus shared/fiaon-termin-art.ts, damit
                Leiste, Kalender, Termin-Zentrale und Mail dasselbe Wort benutzen.
                Der Rückfall bleibt, damit ein alter Client nichts Leeres zeigt. */}
            <span className="fi-erin-art"
                  title={(erste as any).terminArtErklaerung || undefined}
                  style={(erste as any).terminArtTon
                    ? { color: (erste as any).terminArtTon }
                    : undefined}>
              {(erste as any).terminArtText
                || (erste.art === "startgespraech" ? "Onboarding" : "Rückruf")}
            </span>
            <span className="fi-erin-zeit">{zeit(erste)}</span>

            {/* Der Klick führt DIREKT zum Kunden — Punkt 8 derselben Rückmeldung:
                „Beim Klick auf den Termin direkt den zugehörigen Kundendatensatz
                öffnen." */}
            <Link href={`/agent/kunden?person=${erste.personId}`} className="fi-erin-name">
              {erste.name}
            </Link>

            {erste.notiz && <span className="fi-erin-notiz">{erste.notiz}</span>}

            {weitere > 0 && (
              <span className="fi-erin-mehr">
                +{weitere} {weitere === 1 ? "weiterer" : "weitere"}
              </span>
            )}

            <button type="button" className="fi-erin-zu"
                    aria-label="Erinnerung für fünf Minuten ausblenden"
                    onClick={() => setSchlummert((s) => ({ ...s, [erste.logId]: Date.now() + SCHLUMMER_MS }))}>
              Später
            </button>
          </div>
        </>
      )}

      {/* ── DAS POPUP (E-044) ──────────────────────────────────────────────
          Zentriertes Glas im Office-Stil: .of-modal aus office.css, eigene
          Ergänzungen unter .tt- in office-termintreue.css. */}
      {popup && (
        <div className="of-modal-hintergrund tt-hintergrund" role="dialog" aria-modal="true"
             aria-label={`Terminerinnerung: ${popup.name}`}>
          <div className="of-modal tt-popup">
            <span className="of-modal-pille blau">Dein Termin</span>
            <h2>{popup.name}</h2>
            <p>Das Gespräch beginnt um <span className="tt-uhrzeit">{popup.uhrzeit} Uhr</span>.
              {" "}Ruf pünktlich an — der Kunde wartet.</p>
            <div className={`tt-countdown${restSek <= 60 ? " knapp" : ""}`} aria-live="polite">
              {countdown}
              <small>{restSek > 0 ? "bis zum Beginn" : "es geht los"}</small>
            </div>
            <div className="of-modal-knoepfe">
              <button type="button" className="of-modal-knopf" onClick={anrufen} disabled={!popup.telefon}>
                Jetzt anrufen
              </button>
              <Link href={`/agent/pipeline?person=${popup.personId}`} className="of-modal-knopf still"
                    onClick={() => setPopup(null)}>
                Zur Akte
              </Link>
              <button type="button" className="tt-zu" onClick={() => setPopup(null)}>
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const ERINNERUNG_CSS = `
/* ── DIE ERINNERUNGSLEISTE ──────────────────────────────────────────────────
   Am oberen Rand, über allem, aber nur 38 px hoch. Sie nimmt keine Arbeit
   weg — man kann darunter weiterlesen und weiterklicken. */
.fi-erin {
  position: fixed; z-index: 280;
  top: 0; left: 0; right: 0;
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  min-height: 38px; padding: 7px 14px;
  background: linear-gradient(178deg, #16305f, #0b1b3f 70%);
  box-shadow: 0 6px 20px -10px rgba(7,17,41,.6), inset 0 -1px 0 rgba(255,255,255,.08);
  animation: fiErinAuf 300ms cubic-bezier(.32,.72,0,1) both;
}
@keyframes fiErinAuf { from { transform: translateY(-100%); } to { transform: none; } }
.fi-erin[data-ueberfaellig="1"] {
  background: linear-gradient(178deg, #7c2d12, #431407 70%);
}

.fi-erin-punkt {
  width: 7px; height: 7px; border-radius: 999px; flex-shrink: 0;
  background: #fcd34d; box-shadow: 0 0 0 0 rgba(252,211,77,.7);
  animation: fiErinPuls 2s ease-out infinite;
}
.fi-erin[data-ueberfaellig="1"] .fi-erin-punkt { background: #fca5a5; }
@keyframes fiErinPuls {
  0% { box-shadow: 0 0 0 0 rgba(252,211,77,.55); }
  70% { box-shadow: 0 0 0 8px rgba(252,211,77,0); }
  100% { box-shadow: 0 0 0 0 rgba(252,211,77,0); }
}

/* Jede Schriftfarbe steht ausdrücklich: Auf dunklem Grund gewinnt sonst eine
   geerbte Tailwind-Farbe, und der Text ist unlesbar (gemessen am 11.08.2026
   in der Kostenleiste). */
.fi-erin-art {
  font-size: 9.5px; font-weight: 700; letter-spacing: .13em; text-transform: uppercase;
  color: rgba(191,214,247,.8) !important;
}
.fi-erin-zeit {
  font-size: 12.5px; font-weight: 700;
  color: #fcd34d !important;
}
.fi-erin[data-ueberfaellig="1"] .fi-erin-zeit { color: #fca5a5 !important; }
.fi-erin-name {
  font-size: 13.5px; font-weight: 700; text-decoration: none;
  color: #f4f8ff !important;
  border-bottom: 1px solid rgba(244,248,255,.35);
}
.fi-erin-name:hover { border-bottom-color: #f4f8ff; }
.fi-erin-notiz {
  font-size: 12px; min-width: 0; overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; max-width: 40ch;
  color: rgba(214,231,255,.72) !important;
}
.fi-erin-mehr {
  font-size: 11.5px;
  color: rgba(191,214,247,.62) !important;
}
.fi-erin-zu {
  margin-left: auto; flex-shrink: 0; border: 0; cursor: pointer;
  padding: 5px 12px; border-radius: 999px;
  font-size: 11.5px; font-weight: 700;
  background: rgba(255,255,255,.13); color: #e8f0fc !important;
}
.fi-erin-zu:hover { background: rgba(255,255,255,.2); }

/* Der Seiteninhalt rutscht nach unten, damit die Leiste nichts verdeckt. */
body:has(.fi-erin) { padding-top: 38px; }

@media (max-width: 639px) {
  .fi-erin { padding: 6px 11px; gap: 7px; }
  .fi-erin-notiz { display: none; }
  .fi-erin-name { font-size: 13px; }
  body:has(.fi-erin) { padding-top: 44px; }
}

@media (prefers-reduced-motion: reduce) {
  .fi-erin { animation: none; }
  .fi-erin-punkt { animation: none; box-shadow: 0 0 0 3px rgba(252,211,77,.3); }
}
`;
