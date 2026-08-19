// ═══════════════════════════════════════════════════════════════════════════
// „ERGEBNIS FESTHALTEN" — EIN BAUTEIL FÜR ALLE WEGE
//
// ── DIE MELDUNG, ZUM DRITTEN MAL (Daniel Stripling, 19.08.2026) ────────────
// „Wenn ich bei einem Kunden auf ‚Erreicht – Sonstiges' klicke, passiert
// aktuell nichts."
//
// ── WAS WIRKLICH PASSIERTE (gemessen am Quelltext) ────────────────────────
// `client/src/pages/agent/kunden-neu.tsx`, Zeile 1497 ff.:
//
//     if (e.braucht === "notiz") {
//       if (!notiz.trim()) { setFeldOffen("notiz"); return; }
//       void ergebnis(e.art);
//     }
//
// Der Zustand `feldOffen` kannte den Wert „notiz" (Zeile 630). Angezeigt wurde
// er nie: Es gab Blöcke für `feldOffen === "zusage"` (1527) und
// `feldOffen === "termin"` (1540) — und KEINEN für „notiz".
//
// Der Klick setzte also einen Zustand, den kein Bauteil liest, und kehrte
// zurück. Keine Anfrage, kein Feld, keine Meldung. Der Knopf war tot, und weil
// er nicht einmal ins Netz griff, sah man auch in der Konsole nichts.
//
// ── WARUM EIN BAUTEIL UND NICHT DER VIERTE FLICKEN ────────────────────────
// Die Ergebnisliste stand an vier Stellen (siehe
// `shared/fiaon-kontakt-ergebnis-liste.ts`). Die Notizpflicht kannten drei
// davon; eine der drei war eine Datei, die keine Route mehr lud, und ihr Fix
// wurde beim Aufräumen mitgelöscht. AGENTS.md: „Eine Regel, die drei
// Oberflächen einzeln kennen müssen, wird an der vierten vergessen."
//
// Dieses Bauteil ist die Oberfläche zu dieser Regel — Softphone, Kundenkarte
// und jeder weitere Weg rendern es, statt sie nachzubauen.
//
// ── DIE HAUSREGEL, DIE ES ERFÜLLT ─────────────────────────────────────────
// „Eine Sperre ohne Erklärung ist eine Sackgasse." Deshalb: Zeichenzähler,
// Begründung am Knopf (nicht im `title`), Vorlagen zum Antippen, und JEDER
// Ausgang sichtbar — Erfolg wie Fehler.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from "react";
import {
  ERGEBNIS_LISTE, NOTIZ_MINDESTLAENGE, NOTIZ_VORLAGEN, pruefeNotiz,
  type Ergebnis,
} from "@shared/fiaon-kontakt-ergebnis-liste";

/** Was ein Aufrufer zurückgibt, damit das Bauteil den Ausgang anzeigen kann. */
export interface ErgebnisAusgang {
  ok: boolean;
  /** Bei `ok: false` der Klartext — er wird ROT und WÖRTLICH angezeigt. */
  fehler?: string | null;
}

interface Props {
  /**
   * Speichert das Ergebnis. Das Bauteil erwartet einen Ausgang und zeigt ihn an
   * — ein `void`-Rückgabewert wäre die stille Variante, die diesen Fehler
   * überhaupt erst erzeugt hat.
   */
  onErgebnis: (
    art: Ergebnis,
    zusatz: { notiz?: string; zusageDatum?: string; terminDatum?: string; terminZeit?: string },
  ) => Promise<ErgebnisAusgang>;
  /** Läuft gerade ein Ergebnis? Dann sind alle Knöpfe gesperrt. */
  laeuft?: string | null;
  /** Für die Rückfrage bei „Anrufer blockiert" — sonst steht dort „der Kunde". */
  kundeName?: string;
  /** Heute als JJJJ-MM-TT (Berlin) — das Bauteil rät keine Zeitzone. */
  heute: string;
  /** Vorgabe für Datumsfelder, üblicherweise morgen. */
  vorgabeDatum: string;
  /** Kompakte Reihe (Softphone) oder breite Reihe (Kundenkarte). */
  dicht?: boolean;
}

export function ErgebnisWahl({
  onErgebnis, laeuft, kundeName, heute, vorgabeDatum, dicht,
}: Props) {
  // ── ALLE HAKEN STEHEN ÜBER DEM ERSTEN RETURN ────────────────────────────
  // AGENTS.md, zweimal in Softphone.tsx gelernt: „Rendered more hooks than
  // during the previous render" macht die halbe Verwaltung weiß, und weder
  // Typcheck noch Build sehen es.
  const [offen, setOffen] = useState<null | { art: Ergebnis; braucht: "zusage" | "termin" | "notiz" }>(null);
  const [notiz, setNotiz] = useState("");
  const [datum, setDatum] = useState(vorgabeDatum);
  const [zeit, setZeit] = useState("10:00");
  const [fehler, setFehler] = useState<string | null>(null);
  const notizFeld = useRef<HTMLTextAreaElement | null>(null);

  // Das Feld bekommt den Schreibzeiger, sobald es aufgeht. Wer am Telefon
  // sitzt, soll tippen können, ohne erst zu klicken.
  useEffect(() => {
    if (offen?.braucht === "notiz") notizFeld.current?.focus();
  }, [offen]);

  const notizLaenge = notiz.trim().length;
  const notizFehlt = Math.max(0, NOTIZ_MINDESTLAENGE - notizLaenge);

  const speichern = async (art: Ergebnis, zusatz: Parameters<Props["onErgebnis"]>[1]) => {
    setFehler(null);
    const a = await onErgebnis(art, zusatz);
    // ── JEDER AUSGANG IST SICHTBAR ────────────────────────────────────────
    // Auch der Fehlerfall: Ein `catch`, das nichts anzeigt, verwandelt einen
    // Serverfehler in „der Knopf geht nicht".
    if (!a.ok) { setFehler(a.fehler || "Nicht gespeichert. Bitte erneut versuchen."); return; }
    setOffen(null); setNotiz(""); setFehler(null);
  };

  const anklicken = (art: Ergebnis) => {
    const e = ERGEBNIS_LISTE.find((x) => x.art === art)!;
    setFehler(null);
    // Zweiter Klick auf denselben Knopf schließt das Feld wieder.
    if (e.braucht && offen?.art === art) { setOffen(null); return; }
    if (e.braucht) { setOffen({ art, braucht: e.braucht }); return; }
    if (e.gibtAb && !confirm(
      `${kundeName || "Der Kunde"} hat deine Nummer blockiert?\n\n`
      + "Der Kunde geht sofort an den Kollegen mit dem kleinsten Bestand, der bei "
      + "ihm noch nicht blockiert wurde. Er verschwindet aus deiner Liste.\n\n"
      + "Wichtig: Die Provision folgt dem, der den Abschluss dokumentiert.",
    )) return;
    void speichern(art, {});
  };

  const feldRahmen = "mt-2.5 p-3 rounded-xl";
  const feldStil = { background: "var(--fi-seite)" };

  return (
    <div data-fiaon="ergebnis-wahl">
      <div className={`flex flex-wrap items-center ${dicht ? "gap-1.5" : "gap-2"}`}>
        {ERGEBNIS_LISTE.map((e) => (
          <button key={e.art} type="button" disabled={!!laeuft}
                  data-fiaon={`ergebnis-${e.art}`}
                  aria-expanded={offen?.art === e.art ? true : undefined}
                  onClick={() => anklicken(e.art)}
                  className={`fi-zweitknopf font-medium ${dicht
                    ? "px-2.5 py-2 text-[12px]" : "px-3 py-2.5 text-[12.5px]"}`}
                  style={offen?.art === e.art
                    ? { borderColor: "var(--fi-primaer)", color: "var(--fi-primaer)" }
                    : undefined}>
            {laeuft === e.art ? "…" : e.knopf}
          </button>
        ))}
      </div>

      {/* ── DER FEHLER STEHT AM BAUTEIL, NICHT IN EINEM TOOLTIP ───────────
          AGENTS.md: „Der Grund steht als TEXT am Knopf, nicht im Tooltip" —
          einen Tooltip sieht auf dem Telefon niemand. */}
      {fehler && (
        <p className="mt-2 text-[12.5px] font-semibold leading-snug"
           data-fiaon="ergebnis-fehler" role="alert"
           style={{ color: "#b91c1c" }}>
          {fehler}
        </p>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          DAS PFLICHT-NOTIZFELD — DER BLOCK, DER GEFEHLT HAT

          Genau hier lag der Fehler: Der Knopf setzte „notiz", und es gab
          nichts, was darauf reagierte. Jetzt geht das Feld auf, nimmt den
          Schreibzeiger und sagt, wie viele Zeichen noch fehlen.
          ══════════════════════════════════════════════════════════════════ */}
      {offen?.braucht === "notiz" && (
        <div className={feldRahmen} style={feldStil} data-fiaon="ergebnis-notizfeld">
          <label htmlFor="fi-ergebnis-notiz" className="block text-[12px] font-semibold mb-1.5"
                 style={{ color: "var(--fi-text-leise)" }}>
            Was wurde besprochen, und wie seid ihr verblieben?
          </label>
          <textarea id="fi-ergebnis-notiz" ref={notizFeld} value={notiz}
                    onChange={(ev) => setNotiz(ev.target.value)}
                    placeholder="Zum Beispiel: Kunde wartet noch auf eine Rückbuchung, ruft nächste Woche selbst an."
                    className="w-full px-2.5 py-2 rounded-lg border bg-white text-[13px] outline-none"
                    style={{ borderColor: "var(--fi-linie)", minHeight: 76, resize: "vertical" }} />

          {/* Die Vorlagen aus Daniels Meldung — antippen füllt, bleibt änderbar. */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {NOTIZ_VORLAGEN.map((v) => (
              <button key={v.kurz} type="button"
                      data-fiaon="notiz-vorlage"
                      onClick={() => {
                        setNotiz((alt) => (alt.trim() ? alt : v.text));
                        notizFeld.current?.focus();
                      }}
                      className="px-2.5 py-1 rounded-full text-[11.5px] font-semibold"
                      style={{
                        background: "#fff", border: "1px solid var(--fi-linie)",
                        color: "var(--fi-text-leise)",
                      }}>
                {v.kurz}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-2.5">
            <button type="button" disabled={notizFehlt > 0 || !!laeuft}
                    data-fiaon="notiz-speichern"
                    onClick={() => void speichern(offen.art, { notiz: notiz.trim() })}
                    className="px-3 py-2 text-[12px] font-bold rounded-xl"
                    style={notizFehlt > 0 || laeuft
                      ? { background: "#f1f5f9", color: "#94a3b8", border: "1px solid #e2e8f0", cursor: "not-allowed" }
                      : { background: "var(--fi-primaer)", color: "#fff" }}>
              {laeuft ? "Speichert …" : "Erreicht – Sonstiges speichern"}
            </button>
            <button type="button" onClick={() => { setOffen(null); setFehler(null); }}
                    className="text-[12px] font-semibold"
                    style={{ color: "var(--fi-text-still)" }}>
              Abbrechen
            </button>
            {/* Der Zeichenzähler ERKLÄRT die Sperre, statt sie nur zu setzen. */}
            <span className="text-[11.5px] font-semibold"
                  data-fiaon="notiz-zaehler"
                  style={{ color: notizFehlt > 0 ? "#b45309" : "#64748b" }}>
              {notizFehlt > 0
                ? `Noch ${notizFehlt} Zeichen — ohne Notiz ist das Gespräch verloren.`
                : `${notizLaenge} Zeichen — das genügt.`}
            </span>
          </div>
        </div>
      )}

      {offen?.braucht === "zusage" && (
        <div className={`${feldRahmen} flex flex-wrap items-center gap-2`} style={feldStil}
             data-fiaon="ergebnis-zusagefeld">
          <label className="text-[12px] font-semibold" style={{ color: "var(--fi-text-leise)" }}>Zahlt am</label>
          <input type="date" value={datum} min={heute} onChange={(ev) => setDatum(ev.target.value)}
                 className="px-2.5 py-2 rounded-lg border text-[13px] outline-none bg-white"
                 style={{ borderColor: "var(--fi-linie)" }} />
          <button type="button" disabled={!datum || !!laeuft}
                  onClick={() => void speichern(offen.art, { zusageDatum: datum })}
                  className="fi-primaerknopf px-3 py-2 text-[12px] font-bold text-white">
            Zusage speichern
          </button>
        </div>
      )}

      {offen?.braucht === "termin" && (
        <div className={`${feldRahmen} flex flex-wrap items-center gap-2`} style={feldStil}
             data-fiaon="ergebnis-terminfeld">
          <label className="text-[12px] font-semibold" style={{ color: "var(--fi-text-leise)" }}>Rückruf am</label>
          <input type="date" value={datum} min={heute} onChange={(ev) => setDatum(ev.target.value)}
                 className="px-2.5 py-2 rounded-lg border text-[13px] outline-none bg-white"
                 style={{ borderColor: "var(--fi-linie)" }} />
          <label className="text-[12px] font-semibold" style={{ color: "var(--fi-text-leise)" }}>um</label>
          <input type="time" value={zeit} step={900} onChange={(ev) => setZeit(ev.target.value)}
                 className="px-2.5 py-2 rounded-lg border text-[13px] outline-none bg-white"
                 style={{ borderColor: "var(--fi-linie)" }} />
          <button type="button" disabled={!datum || !!laeuft}
                  onClick={() => void speichern(offen.art, { terminDatum: datum, terminZeit: zeit })}
                  className="fi-primaerknopf px-3 py-2 text-[12px] font-bold text-white">
            Termin speichern
          </button>
        </div>
      )}
    </div>
  );
}

export { pruefeNotiz };
