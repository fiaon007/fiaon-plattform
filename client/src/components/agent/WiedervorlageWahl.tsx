// ═══════════════════════════════════════════════════════════════════════════
// „WIEDER DRAN" — DIE WAHL VON HAND UND DIE VORSCHAU (E-IT-A, 08.10.2026)
//
// Die Regel (shared/fiaon-wiedervorlage.ts) entscheidet, wann ein Mensch nach
// einem Ergebnis wieder in der Pipeline steht. Vorher konnte die Oberfläche
// keine eigene Wiedervorlage schicken — die Route nahm sie an, aber weder die
// Akte noch ErgebnisWahl schickten sie je (Befund (1)). Jetzt:
//   · „nach Regel · in 1 Woche · in 2 Wochen" vor dem Ergebnis-Klick, mit dem
//     Datum daneben („→ Mi 15.10."),
//   · und unter jedem Ergebnis-Knopf, wann der Mensch danach wieder dran ist.
// Ein Bauteil für Akte (dunkel, pipeline.tsx) und Kundenkarte (hell,
// ErgebnisWahl.tsx) — die Daten kommen aus derselben Regel wie beim Server.
// ═══════════════════════════════════════════════════════════════════════════
import {
  HANDWAHL, handwahlDatum, handwahlErlaubt, handwahlMoeglich, datumKurz, naechsterVersuch, istFehlversuch,
  STUFE_A_HINWEIS,
} from "@shared/fiaon-wiedervorlage";
import { brauchtDatum, istErgebnis } from "@shared/fiaon-kontakt-ergebnis-liste";

/** Heute in Berlin, „JJJJ-MM-TT" — nicht die Zeitzone des Rechners. */
export function heuteBerlin(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" });
}

/** Was die Vorschau über den Menschen wissen muss (aus der Situation der Akte). */
export interface WiedervorlageKontext {
  versuche: number;
  stufeA: boolean;
  frisch: boolean;
}

/**
 * Die gewählte Wiedervorlage als Datum — null heißt „nach Regel".
 * Gegenprüfung 08.10.2026: Bei Stufe A gibt es „1/2 Wochen" nicht (höchstens
 * 3 Werktage) — eine noch stehende Wahl fällt dann auf „nach Regel" zurück.
 * Der Server deckelt zusätzlich (naechsterVersuch, Route „Wiedervorlage").
 */
export function wahlDatum(wahl: string, heute: string = heuteBerlin(), stufeA = false): string | null {
  if (wahl === "regel" || !handwahlMoeglich(wahl, heute, stufeA)) return null;
  return handwahlDatum(wahl, heute);
}

/**
 * „→ Mi 15.10." unter einem Ergebnis-Knopf — dieselbe Rechnung wie der Server
 * (naechsterVersuch). null, wenn es ohne weitere Angabe (Datum der Zusage, des
 * Rückrufs) nichts Ehrliches zu sagen gibt.
 */
export function vorschauFuer(art: string, kontext: WiedervorlageKontext | null | undefined, wahl: string, heute: string = heuteBerlin()): string | null {
  if (!kontext || !istErgebnis(art)) return null;
  // Zusage und Rückruf hängen am Datum, das erst im Feld gewählt wird (vorschauMitDatum).
  if (brauchtDatum(art)) return null;
  const r = naechsterVersuch({
    ergebnis: art, heute,
    versucheNachher: istFehlversuch(art) ? kontext.versuche + 1 : kontext.versuche,
    stufeA: kontext.stufeA, frisch: kontext.frisch,
    gewaehlt: handwahlErlaubt(art) ? wahlDatum(wahl, heute, kontext.stufeA) : null,
  });
  if (r.grund === "abgelehnt") return "→ aus allen Listen";
  if (r.grund === "uebergabe") return "→ geht an Kollegen";
  if (r.ruhend) return "→ ruhend";
  return r.datum ? `→ ${datumKurz(r.datum)}` : null;
}

/** „Wieder dran am Do 16.10." für „zahlt am X" bzw. den Rückruf — sobald das Datum gewählt ist. */
export function vorschauMitDatum(art: string, datum: string, heute: string = heuteBerlin()): string | null {
  if (!istErgebnis(art) || !/^\d{4}-\d{2}-\d{2}$/.test(datum)) return null;
  const r = naechsterVersuch({ ergebnis: art, heute, zusageDatum: datum, terminDatum: datum });
  return r.datum ? `Wieder dran am ${datumKurz(r.datum)}` : null;
}

export function WiedervorlageWahl({ wahl, onWahl, heute = heuteBerlin(), stufeA = false, knopfKlasse, rahmenKlasse, textKlasse }: {
  wahl: string;
  onWahl: (schluessel: string) => void;
  heute?: string;
  /** Stufe A (Zahlung gemeldet): „1/2 Wochen" ausgegraut, Hinweis „höchstens 3 Werktage". */
  stufeA?: boolean;
  /** Klassen des Knopfes — die Akte ist dunkel, die Kundenkarte hell. */
  knopfKlasse: (aktiv: boolean) => string;
  rahmenKlasse?: string;
  textKlasse?: string;
}) {
  return (
    <div className={rahmenKlasse ?? "pi-reihe"} data-fiaon="wiedervorlage-wahl" role="radiogroup" aria-label="Wann wieder dran?">
      <span className={textKlasse}>Wieder dran:</span>
      {HANDWAHL.map((h) => {
        const d = handwahlDatum(h.schluessel, heute);
        const moeglich = handwahlMoeglich(h.schluessel, heute, stufeA);
        // Eine Wahl, die bei Stufe A nicht gilt, ist nie „aktiv" — sonst sähe
        // der Mitarbeiter „in 2 Wochen" markiert, und es gälte die Regel.
        const aktiv = moeglich ? wahl === h.schluessel : false;
        const aktivRegel = h.schluessel === "regel" && !handwahlMoeglich(wahl, heute, stufeA);
        return (
          <button key={h.schluessel} type="button" role="radio" aria-checked={aktiv || aktivRegel}
                  data-fiaon={`wiedervorlage-${h.schluessel}`} disabled={!moeglich}
                  title={moeglich ? undefined : STUFE_A_HINWEIS}
                  className={knopfKlasse(aktiv || aktivRegel)} style={moeglich ? undefined : { opacity: 0.45, cursor: "not-allowed" }}
                  onClick={() => { if (moeglich) onWahl(h.schluessel); }}>
            {h.text}{d ? ` → ${datumKurz(d)}` : ""}
          </button>
        );
      })}
      {stufeA && (
        <span className={textKlasse} data-fiaon="wiedervorlage-stufe-a">{STUFE_A_HINWEIS}</span>
      )}
      {wahl !== "regel" && handwahlMoeglich(wahl, heute, stufeA) && (
        <span className={textKlasse} data-fiaon="wiedervorlage-hinweis">
          gilt für Zahlt sofort, Nicht erreicht, Mailbox, Sonstiges, Falsche Nummer
        </span>
      )}
    </div>
  );
}
