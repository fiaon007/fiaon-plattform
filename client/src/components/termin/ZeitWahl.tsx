// ═══════════════════════════════════════════════════════════════════════════
// ZEITWAHL — freie Zeiten als Tageszeilen mit Uhrzeit-Knöpfen (05.10.2026, E-283)
//
// Die Darstellung stammt aus dem neuen Antrag (client/src/pages/antrag-neu/
// sheets.tsx, TerminWahl): je Tag eine Zeile, darunter die Uhrzeiten als
// runde Knöpfe, erst drei Tage, dann „Weitere Tage". Dort hängt sie am
// Antrags-Kontext (useAntrag) und an den an-*-Klassen der Antragsseite — für
// den Kundenbereich nicht nutzbar. Hier steht sie NEUTRAL: Sie bekommt die
// Zeiten und meldet die Wahl. Laden, Buchen und alle Sätze gehören dem
// Aufrufer (zuerst: /app/mehr/limit, Limit-Gespräch).
//
// Die Farben kommen aus den Variablen des Kundenbereichs (app.css) mit
// Rückfallwerten — die Komponente sieht auch außerhalb von /app ordentlich aus.
// Knöpfe 44 px hoch: Daumenmaß auf dem Telefon.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";

/** Ein freier Platz, wie ihn freieSlots (server/lib/fiaon-termine.ts) liefert. */
export interface ZeitSlot {
  /** ISO-Zeitpunkt. */
  beginn: string;
  /** „JJJJ-MM-TT" in Berlin. */
  datum: string;
  /** „HH:MM" in Berlin. */
  uhrzeit: string;
  agentId: number;
  agentVorname?: string;
}

/** „Donnerstag, 08.10." aus einem Berliner Kalendertag — über 12:00 UTC, damit keine Zone den Tag verschiebt. */
export function zeitWahlTagName(datum: string): string {
  const d = new Date(`${datum}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return datum;
  return d.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: "UTC" });
}

export function ZeitWahl({ slots, gewaehlt, gesperrt = false, onWahl, tageAnfangs = 3, jeTag = 8 }: {
  slots: ZeitSlot[];
  /** `beginn` der Zeit, die gerade gebucht wird (hervorgehoben). */
  gewaehlt?: string | null;
  /** Während einer Buchung: keine zweite Wahl. */
  gesperrt?: boolean;
  onWahl: (s: ZeitSlot) => void;
  /** So viele Tage stehen zuerst da. */
  tageAnfangs?: number;
  /** Höchstens so viele Zeiten je Tag (der Server verknappt ohnehin, slotsProTag). */
  jeTag?: number;
}) {
  const [mehr, setMehr] = useState(false);
  const alleTage = useMemo(() => {
    const m = new Map<string, ZeitSlot[]>();
    for (const s of slots) { const l = m.get(s.datum) ?? []; l.push(s); m.set(s.datum, l); }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [slots]);
  const tage = mehr ? alleTage : alleTage.slice(0, tageAnfangs);

  return (
    <div data-fiaon="zeitwahl" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {tage.map(([datum, liste]) => (
        <div key={datum} role="group" aria-label={zeitWahlTagName(datum)} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 13, color: "var(--fi-text-leise, #64748b)" }}>{zeitWahlTagName(datum)}</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {liste.slice(0, jeTag).map((s) => {
              const an = gewaehlt === s.beginn;
              return (
                <button
                  key={`${s.beginn}-${s.agentId}`}
                  type="button"
                  aria-pressed={an}
                  disabled={gesperrt}
                  onClick={() => onWahl(s)}
                  style={{
                    minHeight: 44, padding: "0 16px", borderRadius: 999, font: "inherit", fontSize: 15,
                    border: `1px solid ${an ? "var(--fi-primaer, #1d4ed8)" : "var(--fi-linie, #e2e8f0)"}`,
                    background: an ? "var(--fi-flaeche-akzent, #eff6ff)" : "#fff",
                    color: an ? "var(--fi-primaer, #1d4ed8)" : "var(--fi-text, #0f172a)",
                    opacity: gesperrt && !an ? 0.55 : 1, cursor: gesperrt ? "default" : "pointer",
                  }}
                >
                  {s.uhrzeit}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {!mehr && alleTage.length > tageAnfangs && (
        <button type="button" onClick={() => setMehr(true)}
                style={{ alignSelf: "flex-start", border: 0, background: "none", padding: "6px 0", font: "inherit", fontSize: 15, fontWeight: 600, color: "var(--fi-primaer, #1d4ed8)", cursor: "pointer" }}>
          Weitere Tage
        </button>
      )}
    </div>
  );
}
