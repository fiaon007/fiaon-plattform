// ═══════════════════════════════════════════════════════════════════════════
// DER VERKAUFSSTART
//
// ── DER AUFTRAG (11.08.2026) ───────────────────────────────────────────────
// Der Vorgesetzte: „Setze den Agenten (nur den Agenten) einen Banner mit Link
// auf die Agenten-Update-Seite, wo wir ankündigen, dass wir nun viele Kunden zu
// bearbeiten haben, erkläre es genau und Verkaufsstart."
//
// ── WARUM EIN EIGENER BANNER UND NICHT DIE UPDATE-ZEILE ────────────────────
// Es gibt bereits eine Leiste „58 neue Neuerungen — ansehen & lernen". Die
// zählt Änderungen. Eine Zahl, die von 36 auf 58 steigt, ist Rauschen: Wer sie
// dreimal weggeklickt hat, sieht sie beim vierten Mal nicht mehr.
//
// Der Verkaufsstart ist keine Änderung, sondern eine Ansage. Er bekommt eine
// eigene Leiste, andere Farbe, andere Worte — und er verschwindet erst, wenn
// jemand ihn gelesen hat.
//
// ── WER IHN SIEHT ──────────────────────────────────────────────────────────
// „nur den Agenten" — die Leiste hängt in `shared.tsx`, dem Rahmen des
// Agentenbereichs. Der Verwaltungsbereich hat einen anderen Rahmen und sieht
// sie nicht.
//
// Das Forderungsmanagement bekommt sie ebenfalls nicht: Es arbeitet an
// überfälligen Raten, nicht an Neukunden. Eine Ansage über 264 Rechnungen wäre
// dort eine Nachricht ohne Adressaten.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { Link } from "wouter";

/** Wer ihn gelesen hat, sieht ihn nicht wieder. */
const SCHLUESSEL = "fiaon_verkaufsstart_2026_08_11";

export function VerkaufsstartBanner({ rolle }: { rolle?: string | null }) {
  const [weg, setWeg] = useState(true);
  const [zahl, setZahl] = useState<number | null>(null);

  useEffect(() => {
    // Das Forderungsmanagement arbeitet an Raten, nicht an Neukunden.
    if (rolle === "inkasso" || rolle === "onboarding") return;
    try {
      if (window.localStorage.getItem(SCHLUESSEL) === "gelesen") return;
    } catch { /* privater Modus — dann eben jedes Mal */ }
    setWeg(false);

    // ── DIE EIGENE ZAHL, NICHT DIE GESAMTE ────────────────────────────────
    // „264 Kunden warten" ist eine Nachricht an alle und damit an niemanden.
    // „Bei dir liegen 66" ist ein Auftrag.
    // ── OHNE `sort` ─────────────────────────────────────────────────────
    // Erster Versuch: `&sort=alt`. Diese Sortierung gibt es nicht
    // (`ORDNUNG` kennt sie nicht), die Route antwortete mit einem Fehler und
    // die Zahl blieb leer — der Banner zeigte den allgemeinen Text statt
    // „66 Kunden in deiner Liste".
    void fetch("/api/fiaon/agent/kunden/liste?filter=rechnung_stellen",
      { credentials: "include" })
      .then((r) => r.json())
      .then((j) => { if (j?.ok) setZahl(j.zaehler?.rechnung_stellen ?? null); })
      .catch(() => {});
  }, [rolle]);

  if (weg) return null;

  return (
    <>
      <style>{START_CSS}</style>
      <div className="fi-start" role="region" aria-label="Verkaufsstart">
        <div className="fi-start-inhalt">
          <span className="fi-start-marke">Verkaufsstart</span>

          <p className="fi-start-text">
            {zahl != null && zahl > 0 ? (
              <>
                <b>{zahl} Kunden</b> in deiner Liste haben einen fertigen Antrag,
                aber nie eine Rechnung bekommen — manche seit über zwei Monaten.
              </>
            ) : (
              <>
                Ab heute liegt Arbeit in deiner Liste, die es vorher nicht gab:
                Kunden mit fertigem Antrag, die nie eine Rechnung bekommen haben.
              </>
            )}
          </p>

          <Link href="/agent/updates" className="fi-start-mehr">
            Was das heißt und wie es geht
          </Link>

          <Link href="/agent/kunden?filter=rechnung_stellen" className="fi-start-los">
            Zur Liste
          </Link>

          {/* ── EINE EIGENE BESCHRIFTUNG ──────────────────────────────────
              „Verstanden" steht dreimal im Agentenrahmen (Update-Hinweis,
              Team-Nachricht, hier). Die Abnahme traf deshalb den falschen
              Knopf und meldete, der Banner ließe sich nicht schließen.
              Ein Wort, das dreimal dasselbe verspricht, ist kein Wort. */}
          <button type="button" className="fi-start-zu" aria-label="Verkaufsstart gelesen"
                  onClick={() => {
                    try { window.localStorage.setItem(SCHLUESSEL, "gelesen"); } catch { /* egal */ }
                    setWeg(true);
                  }}>
            Gelesen
          </button>
        </div>
      </div>
    </>
  );
}

const START_CSS = `
/* ── DIE VERKAUFSSTART-LEISTE ───────────────────────────────────────────────
   Kräftiger als die Update-Zeile darunter, aber keine Warnung: Das hier ist
   eine gute Nachricht — es gibt Arbeit, und Arbeit heißt Provision. */
.fi-start {
  position: relative;
  background: linear-gradient(96deg, #0f2d5e, #1d4ed8 62%, #2563eb);
  box-shadow: inset 0 -1px 0 rgba(255,255,255,.12);
}
.fi-start-inhalt {
  max-width: 72rem; margin: 0 auto;
  padding: 9px 16px;
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
}

/* Jede Farbe steht ausdrücklich: Auf dunklem Grund gewinnt sonst eine geerbte
   Tailwind-Farbe, und der Text verschwindet. */
.fi-start-marke {
  flex-shrink: 0;
  padding: 3px 9px; border-radius: 999px;
  background: rgba(255,255,255,.16);
  font-size: 9.5px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase;
  color: #ffffff !important;
}
.fi-start-text {
  min-width: 0; flex: 1 1 22ch;
  font-size: 12.5px; line-height: 1.45;
  color: rgba(233,241,255,.94) !important;
}
.fi-start-text b { color: #ffffff !important; font-weight: 700; }

.fi-start-mehr, .fi-start-los, .fi-start-zu {
  flex-shrink: 0; text-decoration: none; cursor: pointer; border: 0;
  font-size: 12px; font-weight: 700;
  padding: 6px 13px; border-radius: 999px;
  transition: filter 120ms ease, background 120ms ease;
}
.fi-start-mehr {
  background: transparent; color: #cfe0ff !important;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.28);
}
.fi-start-mehr:hover { background: rgba(255,255,255,.1); }
.fi-start-los {
  background: #ffffff; color: #14305f !important;
  box-shadow: 0 4px 12px -5px rgba(0,0,0,.4);
}
.fi-start-los:hover { filter: brightness(.96); }
.fi-start-zu {
  margin-left: auto; background: transparent;
  color: rgba(207,224,255,.75) !important;
}
.fi-start-zu:hover { color: #ffffff !important; }

@media (max-width: 639px) {
  .fi-start-inhalt { padding: 9px 12px; gap: 8px; }
  .fi-start-text { flex-basis: 100%; }
  .fi-start-zu { margin-left: 0; }
}
`;
