// ═══════════════════════════════════════════════════════════════════════════
// DIE EINGABE (E-248)
//
// GEMESSEN am 28.09.: Im Office war das Feld 23 px breit (Handy 26 px) — die
// Knopfleiste daneben nahm ihm den Platz, der Platzhalter stand senkrecht
// („N a c"). Enter machte eine neue Zeile, nur ⌘+Enter sendete (unter Windows
// und am Handy unbrauchbar), drei schnelle ⌘+Enter schickten DREI Nachrichten,
// und der Entwurf für Kunde A stand nach dem Wechsel im Feld von Kunde B.
//
// Jetzt:
// · [+] · Feld · Senden in einem Raster — das Feld hat immer den Rest (min. 60 %).
// · Das Feld wächst von 1 bis 6 Zeilen, dann scrollt es. 16 px (iOS zoomt sonst).
//   E-IT-H (08.10.2026, Punkt 15): Die Höchsthöhe ist 36 % der Chathöhe,
//   höchstens 320 px (am großen Bildschirm rund zwölf Zeilen) — eine Quelle in
//   shared/fiaon-wa-raum.ts; ohne Chathöhe bleibt es bei sechs Zeilen.
// · Rechner: Enter sendet, Umschalt+Enter neue Zeile. Touch: Enter ist eine
//   neue Zeile, der Knopf sendet. Während einer Wortbildung (IME) nie senden.
// · Die Sperre gegen Doppelversand sitzt im Rahmen (ein Ref, kein State —
//   State wäre bei drei Tastendrücken im selben Takt noch nicht gesetzt).
// · Der Entwurf gehört der Nummer (der Rahmen hält ihn je Nummer).
// · Höchstens 4.096 Zeichen (Meta), Zähler ab 3.500.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { FELD_ANTEIL_CHAT, FELD_HOECHSTENS_PX } from "@shared/fiaon-wa-raum";
import { VorlagenBlatt } from "./VorlagenBlatt";
import type { RaumLinks, Vorlage } from "./wr-format";

export const TEXT_GRENZE = 4096;
const ZAEHLER_AB = 3500;
const ZEILE_PX = 22;
const MAX_ZEILEN = 6;

/** Touch-Gerät ohne Maus: dort ist Enter eine neue Zeile. */
export function istTouch(): boolean {
  try { return window.matchMedia("(hover: none) and (pointer: coarse)").matches; } catch { return false; }
}

export function Eingabe({
  nummer, name, fensterOffen, lage, wert, setWert, onSenden, sendet,
  vorlagen, links, onVorlage, blattOffen, setBlattOffen, fokus,
}: {
  nummer: string; name: string | null; fensterOffen: boolean;
  /** Die Zeile über dem Feld: Fenster, Mara, wer mitliest. */
  lage: ReactNode;
  wert: string; setWert: (t: string) => void;
  onSenden: (text: string) => void; sendet: boolean;
  vorlagen: Vorlage[]; links: RaumLinks | null; onVorlage: (v: Vorlage) => void;
  blattOffen: boolean; setBlattOffen: (auf: boolean) => void;
  /** Steigt der Zähler, bekommt das Feld den Fokus (Gespräch geöffnet, gesendet). */
  fokus: number;
}) {
  const feld = useRef<HTMLTextAreaElement>(null);

  // Mitwachsen bis 36 % der Chathöhe (höchstens 320 px), dann scrollt das Feld selbst. Gerechnet wird
  // hier — getComputedStyle lieferte min(36cqh, …) nicht immer aufgelöst (dann blieb es bei 150 px).
  useLayoutEffect(() => {
    const el = feld.current; if (!el) return;
    el.style.height = "auto";
    const chatHoehe = (el.closest(".wr-chat") as HTMLElement | null)?.clientHeight ?? 0;
    const max = chatHoehe > 0
      ? Math.max(ZEILE_PX * 2 + 18, Math.min(FELD_HOECHSTENS_PX, Math.round(chatHoehe * FELD_ANTEIL_CHAT)))
      : ZEILE_PX * MAX_ZEILEN + 18;
    el.style.height = `${Math.min(el.scrollHeight + 2, max)}px`;
    el.style.overflowY = el.scrollHeight + 2 > max ? "auto" : "hidden";
  }, [wert, nummer, fensterOffen]);

  // Fokus: am Rechner beim Öffnen und nach dem Senden. Am Handy nicht von
  // selbst — sonst springt die Tastatur auf, bevor man gelesen hat.
  useEffect(() => {
    if (!fokus || !fensterOffen || istTouch()) return;
    const el = feld.current; if (!el) return;
    el.focus({ preventScroll: true });
    const ende = el.value.length; el.setSelectionRange(ende, ende);
  }, [fokus, fensterOffen, nummer]);

  const absenden = () => {
    const t = wert.trim();
    if (!t || sendet || t.length > TEXT_GRENZE) return;
    onSenden(t);
  };

  const taste = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter") return;
    // Wortbildung (IME, z. B. Diktat oder asiatische Tastaturen): Enter bestätigt dort das Wort.
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.shiftKey || e.altKey) return;                         // neue Zeile
    if (istTouch() && !(e.metaKey || e.ctrlKey)) return;         // Touch: Enter = neue Zeile
    e.preventDefault();
    absenden();
  };

  const linkEinsetzen = (url: string) => {
    const el = feld.current;
    const vorn = el ? wert.slice(0, el.selectionStart ?? wert.length) : wert;
    const hinten = el ? wert.slice(el.selectionEnd ?? wert.length) : "";
    const luftVorn = vorn && !/\s$/.test(vorn) ? " " : "";
    const luftHinten = hinten && !/^\s/.test(hinten) ? " " : "";
    const neu = `${vorn}${luftVorn}${url}${luftHinten}${hinten}`.slice(0, TEXT_GRENZE);
    setWert(neu);
    setBlattOffen(false);
    requestAnimationFrame(() => {
      const f = feld.current; if (!f) return;
      const pos = (vorn + luftVorn + url).length;
      f.focus({ preventScroll: true }); f.setSelectionRange(pos, pos);
    });
  };

  const zaehler = wert.length >= ZAEHLER_AB ? `${wert.length.toLocaleString("de-DE")} / ${TEXT_GRENZE.toLocaleString("de-DE")}` : "";

  return (
    <div className="wr-eingabe">
      {blattOffen && (
        <VorlagenBlatt vorlagen={vorlagen} links={links} name={name} fensterOffen={fensterOffen} sendet={sendet}
          onVorlage={onVorlage} onLink={linkEinsetzen} onZu={() => setBlattOffen(false)} />
      )}
      <div className="wr-lage">{lage}</div>
      {fensterOffen ? (
        <>
          <div className="wr-zeile-eingabe">
            <button type="button" className={`wr-plus${blattOffen ? " an" : ""}`} aria-label="Vorlagen und persönliche Links" aria-expanded={blattOffen}
              title="Vorlagen und persönliche Links" onClick={() => setBlattOffen(!blattOffen)}>
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M9 3.5v11M3.5 9h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            </button>
            <textarea
              ref={feld}
              className="wr-feld-text"
              value={wert}
              rows={1}
              maxLength={TEXT_GRENZE}
              onChange={(e) => setWert(e.target.value)}
              onKeyDown={taste}
              placeholder={name ? `Nachricht an ${name.split(/\s+/)[0]}` : "Nachricht"}
              aria-label="Nachricht"
              enterKeyHint="enter"
              autoComplete="off"
              spellCheck
            />
            {/* Der Knopf nimmt dem Feld den Fokus nicht: Sonst schließt am Handy die
                Tastatur zwischen Berühren und Loslassen, der Knopf rutscht unter dem
                Finger weg und der Tipp geht ins Leere (so im Prüfstand gemessen). */}
            <button type="button" className="wr-senden" aria-label={sendet ? "Sendet …" : "Senden"} title="Senden"
              disabled={sendet || !wert.trim()} onPointerDown={(e) => e.preventDefault()} onMouseDown={(e) => e.preventDefault()} onClick={absenden}>
              {sendet
                ? <span className="wr-senden-dreht" aria-hidden="true" />
                : <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.4 20.4 21 12 3.4 3.6v6.4l12.6 2-12.6 2z" fill="currentColor" /></svg>}
            </button>
          </div>
          <div className="wr-hilfe">
            <span className="wr-tasten">Enter sendet · Umschalt + Enter neue Zeile</span>
            <span className={`wr-zaehler${wert.length > TEXT_GRENZE - 96 ? " knapp" : ""}`} aria-live="polite">{zaehler}</span>
          </div>
        </>
      ) : (
        <div className="wr-zu-zeile">
          <p>Jetzt geht nur eine <b>freigegebene Vorlage</b> — antwortet der Mensch, ist freies Schreiben wieder offen.</p>
          <button type="button" className="wr-knopf voll" aria-expanded={blattOffen} onClick={() => setBlattOffen(!blattOffen)}>
            {blattOffen ? "Schließen" : `Vorlage wählen${vorlagen.length ? ` (${vorlagen.length})` : ""}`}
          </button>
        </div>
      )}
    </div>
  );
}
