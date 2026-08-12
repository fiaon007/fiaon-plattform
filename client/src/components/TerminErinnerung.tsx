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
// ── WAS SIE NICHT TUT ──────────────────────────────────────────────────────
// Sie blockiert nichts, sie klingelt nicht, sie springt nicht in die Mitte.
// Ein Termin in zwanzig Minuten ist kein Notfall. Sie steht am oberen Rand,
// zählt herunter und lässt sich mit einem Klick auf den Kunden auflösen.
//
// Wer sie wegklickt, sieht sie in fünf Minuten wieder — ein Termin, den man
// wegklickt, ist nicht erledigt.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";

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

/** Wie weit im Voraus wird erinnert? */
const VORLAUF_MIN = 30;

/** Wie oft wird nachgesehen? */
const TAKT_MS = 60_000;

/** Nach dem Wegklicken: wie lange Ruhe? */
const SCHLUMMER_MS = 5 * 60_000;

export function TerminErinnerung() {
  const [faellig, setFaellig] = useState<Faellig[]>([]);
  const [schlummert, setSchlummert] = useState<Record<number, number>>({});

  const holen = useCallback(async () => {
    const r = await fetch(`/api/fiaon/agent/termine/faellig?vorlauf=${VORLAUF_MIN}`,
      { credentials: "include" }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (j?.ok) setFaellig(j.termine ?? []);
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

  const jetzt = Date.now();
  const zeigen = faellig.filter((t) => (schlummert[t.logId] ?? 0) < jetzt);
  if (zeigen.length === 0) return null;

  // Der dringendste zuerst — überfällige vor anstehenden.
  const sortiert = [...zeigen].sort((a, b) => a.inMinuten - b.inMinuten);
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

  return (
    <>
      <style>{ERINNERUNG_CSS}</style>
      <div className="fi-erin" role="status" aria-live="polite"
           data-ueberfaellig={erste.inMinuten < 0 ? "1" : "0"}>
        <span className="fi-erin-punkt" aria-hidden="true" />
        <span className="fi-erin-art">
          {erste.art === "startgespraech" ? "Startgespräch" : "Rückruf"}
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
