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
// 1. DIE LEISTE: steht am oberen Rand, zählt herunter, deckt Rückrufe UND
//    Termine ab, auch überfällige. Sie blockiert nichts.
// 2. DAS POPUP: 5, 2 und 1 Minute vor jedem eigenen gebuchten Termin springt
//    einmal je Schwelle ein zentriertes Glas-Popup auf — denn ab jetzt wird
//    Pünktlichkeit serverseitig GEMESSEN (fiaon_termin_treue). Merker je
//    Termin+Schwelle in sessionStorage. Datenquelle ist /agent/termine.
//
// ── DIE LEISTE, NEU (24.08.2026, Justins Meldung) ──────────────────────────
// VORHER: flex-wrap ließ die Leiste am Handy zwei-/dreizeilig umbrechen und
// den Office-Kopf verdecken (der ist sticky top:0 und rutschte DARUNTER);
// „Später" schlummerte nur fünf Minuten und kam wieder; lange Inhalte wurden
// hart abgeschnitten.
// NACHHER:
//   1. Eine Zeile, feste Höhe 40 px + safe-area-top, Ellipsis. Der Inhalt
//      rückt per body-padding nach unten, und die stickigen Office-Teile
//      (.of-kopf, .of-leiste) bekommen hier ihren top-Versatz — die Leiste
//      reiht sich ÜBER dem Office-Kopf ein statt ihn zu überlappen.
//   2. Passt der Inhalt nicht in die Zeile, läuft er ruhig durch (~30–40 s
//      je Runde), pausiert bei Hover/Touch; prefers-reduced-motion: statisch
//      mit Ellipsis (erster Eintrag + „+N"-Zähler).
//   3. „Später" merkt sich JEDEN gerade gezeigten Eintrag in sessionStorage
//      (fiaon-erin-weg-<art>-<id>) — weggeklickt bleibt weg, bis ein NEUER
//      Eintrag ansteht. Die T−5/2/1-Popups bleiben davon unberührt.
//   4. Abgesagte/erledigte/verpasste Termine und Personen, deren letztes
//      heutiges Ergebnis „abgelehnt/blockiert" war, filtert der Server
//      (/agent/termine/faellig, fiaon-agent-start.ts) seit demselben Tag.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
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
  terminArtText?: string | null;
  terminArtTon?: string | null;
  terminArtErklaerung?: string | null;
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

/** Die Popup-Schwellen in Minuten vor dem Beginn — je Termin einmal. */
const SCHWELLEN = [5, 2, 1] as const;

/** Der sessionStorage-Merker: dieser Termin, diese Schwelle — schon gezeigt? */
const merker = (terminId: number, schwelle: number) => `fiaon-tt-${terminId}-${schwelle}`;

/** Der sessionStorage-Merker der Leiste: dieser Eintrag wurde weggeklickt. */
const wegMerker = (t: Faellig) => `fiaon-erin-weg-${t.art}-${t.logId}`;

export function TerminErinnerung() {
  const [faellig, setFaellig] = useState<Faellig[]>([]);
  const [termine, setTermine] = useState<EigenTermin[]>([]);
  const [popup, setPopup] = useState<EigenTermin | null>(null);
  // Der Sekundentakt für Schwellen und Countdown. Er tickt nur, wenn er
  // gebraucht wird — siehe den Effekt unten.
  const [, setTick] = useState(0);
  // Zwingt nach „Später" einen neuen Render — die Wahrheit liegt im Storage.
  const [, setWegTick] = useState(0);

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

  // ── DIE LEISTE: was gezeigt wird ───────────────────────────────────────
  // Weggeklickte Einträge bleiben weg (sessionStorage, Punkt 3 oben).
  const zeigenListe = faellig.filter((t) => {
    try { return !sessionStorage.getItem(wegMerker(t)); } catch { return true; }
  });
  // Der dringendste zuerst — überfällige vor anstehenden.
  const sortiert = [...zeigenListe].sort((a, b) => a.inMinuten - b.inMinuten);
  const erste = sortiert[0];
  const weitere = sortiert.length - 1;

  const ausblenden = () => {
    for (const t of sortiert) {
      try { sessionStorage.setItem(wegMerker(t), "1"); } catch { /* dann eben wieder */ }
    }
    setWegTick((n) => n + 1);
  };

  // ── DAS LAUFBAND ───────────────────────────────────────────────────────
  // Passt alles in die Zeile: statisch. Sonst: eine ruhige Runde in 30–40 s,
  // zwei identische Gruppen, Verschiebung um -50 % = nahtloser Übergang.
  const bandRef = useRef<HTMLDivElement | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [dauer, setDauer] = useState(35);
  const [pause, setPause] = useState(false);
  const pauseTimer = useRef<number | null>(null);
  const listeKey = sortiert.map((t) => `${t.art}:${t.logId}`).join("|");
  useEffect(() => { setLaeuft(false); }, [listeKey]);
  useEffect(() => {
    if (laeuft) return;
    const el = bandRef.current;
    if (!el) return;
    if (el.scrollWidth > el.clientWidth + 4) {
      // ~30–40 s je Runde, längerer Inhalt läuft etwas länger.
      setDauer(Math.min(40, Math.max(30, Math.round(el.scrollWidth / 30))));
      setLaeuft(true);
    }
  }, [laeuft, listeKey]);
  useEffect(() => () => { if (pauseTimer.current) window.clearTimeout(pauseTimer.current); }, []);
  const anfassen = () => {
    setPause(true);
    if (pauseTimer.current) window.clearTimeout(pauseTimer.current);
    pauseTimer.current = window.setTimeout(() => setPause(false), 4000);
  };

  const zeit = (t: Faellig) => {
    if (t.inMinuten < -60) return `seit ${Math.round(-t.inMinuten / 60)} Std überfällig`;
    if (t.inMinuten < 0) return `seit ${-t.inMinuten} Min überfällig`;
    if (t.inMinuten === 0) return "jetzt";
    if (t.inMinuten < 60) return `in ${t.inMinuten} Min`;
    return new Date(t.wann).toLocaleTimeString("de-DE", {
      hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin",
    }) + " Uhr";
  };

  /** Ein Eintrag im Band: Art · Zeit · Name (Klick → Akte) · Notiz. */
  const eintrag = (t: Faellig, praefix: string) => (
    <span className="fi-erin-seg" key={`${praefix}${t.art}-${t.logId}`}>
      <span className="fi-erin-art"
            title={t.terminArtErklaerung || undefined}
            style={t.terminArtTon ? { color: t.terminArtTon } : undefined}>
        {t.terminArtText || (t.art === "startgespraech" ? "Onboarding" : "Rückruf")}
      </span>
      <span className="fi-erin-zeit" data-ueber={t.inMinuten < 0 ? "1" : "0"}>{zeit(t)}</span>
      {/* Der Klick führt DIREKT zum Kunden — Punkt 8 der Rückmeldung vom
          11.08.: „Beim Klick auf den Termin direkt den zugehörigen
          Kundendatensatz öffnen." */}
      <Link href={`/agent/kunden?person=${t.personId}`} className="fi-erin-name">{t.name}</Link>
      {t.notiz && <span className="fi-erin-notiz">{t.notiz}</span>}
    </span>
  );

  const jetzt = Date.now();

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
               data-ueberfaellig={erste.inMinuten < 0 ? "1" : "0"}
               onMouseEnter={() => setPause(true)}
               onMouseLeave={() => setPause(false)}
               onTouchStart={anfassen}>
            <span className="fi-erin-punkt" aria-hidden="true" />
            <div className="fi-erin-band" ref={bandRef}>
              <div className={`fi-erin-lauf${laeuft ? " laufend" : ""}${pause ? " pause" : ""}`}
                   style={laeuft ? { animationDuration: `${dauer}s` } : undefined}>
                <span className="fi-erin-gruppe">{sortiert.map((t) => eintrag(t, ""))}</span>
                {laeuft && <span className="fi-erin-gruppe kopie" aria-hidden="true">{sortiert.map((t) => eintrag(t, "kopie-"))}</span>}
              </div>
            </div>
            {weitere > 0 && <span className="fi-erin-mehr">+{weitere}</span>}
            <button type="button" className="fi-erin-zu"
                    aria-label="Diese Erinnerungen ausblenden — neue erscheinen wieder"
                    onClick={ausblenden}>
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
   Eine Zeile, feste Höhe 40 px + safe-area-top. Sie nimmt keine Arbeit weg —
   man kann darunter weiterlesen und weiterklicken. */
.fi-erin {
  position: fixed; z-index: 280;
  top: 0; left: 0; right: 0;
  display: flex; align-items: center; gap: 10px; flex-wrap: nowrap;
  height: calc(40px + env(safe-area-inset-top, 0px));
  padding: env(safe-area-inset-top, 0px) 12px 0 14px;
  overflow: hidden;
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

/* ── DAS LAUFBAND ───────────────────────────────────────────────────────────
   Statisch, solange alles passt. Läuft der Inhalt über, schiebt sich das Band
   in 30–40 s um eine Gruppenbreite (-50 %) — zwei identische Gruppen machen
   den Übergang nahtlos. Hover/Touch pausiert. */
.fi-erin-band {
  flex: 1 1 auto; min-width: 0; overflow: hidden; align-self: stretch;
  display: flex; align-items: center;
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 12px, #000 calc(100% - 12px), transparent);
  mask-image: linear-gradient(90deg, transparent, #000 12px, #000 calc(100% - 12px), transparent);
}
.fi-erin-lauf { display: inline-flex; align-items: center; flex: 0 0 auto; max-width: 100%; }
.fi-erin-lauf.laufend { max-width: none; animation: fiErinLauf 35s linear infinite; }
@keyframes fiErinLauf { from { transform: translateX(0); } to { transform: translateX(-50%); } }
.fi-erin:hover .fi-erin-lauf.laufend, .fi-erin-lauf.laufend.pause { animation-play-state: paused; }
.fi-erin-gruppe { display: inline-flex; align-items: center; gap: 26px; padding-right: 26px; min-width: 0; }
.fi-erin-seg { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; min-width: 0; }

/* Jede Schriftfarbe steht ausdrücklich: Auf dunklem Grund gewinnt sonst eine
   geerbte Tailwind-Farbe, und der Text ist unlesbar (gemessen am 11.08.2026
   in der Kostenleiste). */
.fi-erin-art {
  font-size: 9.5px; font-weight: 700; letter-spacing: .13em; text-transform: uppercase;
  color: rgba(191,214,247,.8) !important; flex-shrink: 0;
}
.fi-erin-zeit {
  font-size: 12.5px; font-weight: 700; flex-shrink: 0;
  color: #fcd34d !important;
}
.fi-erin-zeit[data-ueber="1"] { color: #fca5a5 !important; }
.fi-erin-name {
  font-size: 13.5px; font-weight: 700; text-decoration: none;
  color: #f4f8ff !important;
  border-bottom: 1px solid rgba(244,248,255,.35);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 34ch;
}
.fi-erin-name:hover { border-bottom-color: #f4f8ff; }
.fi-erin-notiz {
  font-size: 12px; min-width: 0; overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; max-width: 34ch;
  color: rgba(214,231,255,.72) !important;
}
.fi-erin-mehr {
  flex-shrink: 0; font-size: 11px; font-weight: 700;
  padding: 2px 8px; border-radius: 999px;
  background: rgba(255,255,255,.1);
  color: rgba(191,214,247,.85) !important;
}
.fi-erin-zu {
  flex-shrink: 0; border: 0; cursor: pointer;
  padding: 5px 12px; border-radius: 999px;
  font-size: 11.5px; font-weight: 700;
  background: rgba(255,255,255,.13); color: #e8f0fc !important;
}
.fi-erin-zu:hover { background: rgba(255,255,255,.2); }

/* ── DIE EINREIHUNG ÜBER DEM OFFICE-KOPF ────────────────────────────────────
   Der Seiteninhalt rutscht per body-padding nach unten. Der Office-Kopf ist
   sticky top:0 und würde beim Scrollen UNTER die Leiste rutschen (gemessen am
   24.08.2026 am Handy) — deshalb bekommen .of-kopf und .of-leiste hier ihren
   Versatz. office.css bleibt unangetastet; die Regel lebt bei der Leiste,
   die sie verursacht. */
body:has(.fi-erin) { --fi-erin-hoehe: calc(40px + env(safe-area-inset-top, 0px)); padding-top: var(--fi-erin-hoehe); }
body:has(.fi-erin) .of-kopf { top: var(--fi-erin-hoehe); }
body:has(.fi-erin) .of-leiste { top: calc(84px + var(--fi-erin-hoehe)); max-height: calc(100vh - 100px - var(--fi-erin-hoehe)); }

@media (max-width: 639px) {
  .fi-erin { padding-left: 11px; padding-right: 9px; gap: 7px; }
  .fi-erin-gruppe { gap: 18px; padding-right: 18px; }
  .fi-erin-name { font-size: 13px; max-width: 24ch; }
  .fi-erin-notiz { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .fi-erin { animation: none; }
  .fi-erin-punkt { animation: none; box-shadow: 0 0 0 3px rgba(252,211,77,.3); }
  /* Statisch mit Ellipsis: erster Eintrag + „+N"-Zähler, kein Laufband. */
  .fi-erin-lauf.laufend { animation: none; max-width: 100%; }
  .fi-erin-gruppe.kopie { display: none; }
  .fi-erin-gruppe .fi-erin-seg:not(:first-child) { display: none; }
}
`;
