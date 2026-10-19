// Gemeinsame Kleinteile der Aras-Reiter (E-409).
import { ARAS_SPIELARTEN, SPIELART_TEXT, type ArasSpielart } from "@shared/fiaon-ki-team";

export { ARAS_SPIELARTEN, SPIELART_TEXT };
export type { ArasSpielart };

export function SpielartWahl({ wert, onChange, nur }: { wert: string; onChange: (s: string) => void; nur?: readonly string[] }) {
  const liste = nur ? ARAS_SPIELARTEN.filter((s) => nur.includes(s)) : ARAS_SPIELARTEN;
  return (
    <select value={wert} onChange={(e) => onChange(e.target.value)} aria-label="Spielart">
      {liste.map((s) => <option key={s} value={s}>{SPIELART_TEXT[s]}</option>)}
    </select>
  );
}

export const ERGEBNIS_TEXT: Record<string, string> = {
  erreicht_zahlt_am: "Zusage", erreicht_zahlt_gleich: "zahlt gleich", mailbox: "Mailbox", nicht_erreicht: "nicht erreicht",
  uebergeben: "übergeben", abgebrochen: "abgebrochen", kein_interesse: "kein Interesse", rueckruf: "Rückruf",
};
export const ergebnisText = (e: string | null | undefined) => (e ? (ERGEBNIS_TEXT[e] ?? e.replace(/_/g, " ")) : "—");
