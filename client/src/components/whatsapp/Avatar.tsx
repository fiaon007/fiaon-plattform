// ═══════════════════════════════════════════════════════════════════════════
// DAS RUNDE BILD (20.10.2026) — Initialen auf einem Ton aus dem Blau-Paar
//
// Wie bei WhatsApp steht vor jedem Gespräch ein rundes Bild. Fotos gibt es
// nicht (Meta gibt sie nicht heraus) — also Initialen, und derselbe Mensch hat
// immer dieselbe Farbe. Ohne Namen (nur Nummer) eine stille Silhouette.
// Der grüne Punkt unten rechts heißt: Das 24-Stunden-Fenster ist offen.
// ═══════════════════════════════════════════════════════════════════════════
import { avatarTon, initialen } from "./wr-format";
import { ZPerson } from "./Symbole";

export function Avatar({ name, schluessel, groesse = "m", offen = false, offenTitel }: {
  name: string | null | undefined;
  /** Woran die Farbe hängt (die Nummer) — so wechselt sie nicht, wenn der Name nachkommt. */
  schluessel: string;
  groesse?: "s" | "m" | "l" | "xl";
  /** Das 24-Stunden-Fenster ist offen (grüner Punkt). */
  offen?: boolean;
  offenTitel?: string;
}) {
  const i = initialen(name);
  return (
    <span className={`wr-avatar g-${groesse} ton-${i ? avatarTon(schluessel) : "leer"}`} aria-hidden="true">
      {i ? <span className="wr-avatar-text">{i}</span> : <ZPerson g={groesse === "xl" ? 44 : groesse === "l" ? 26 : 22} />}
      {offen && <span className="wr-offen-punkt" title={offenTitel} />}
    </span>
  );
}
