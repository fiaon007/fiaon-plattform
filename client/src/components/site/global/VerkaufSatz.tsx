// ═══════════════════════════════════════════════════════════════════════════
// SAUBERE UMBRÜCHE FÜR DIE SÄTZE DES VERKAUFSMOTORS (Register E-509, Feinschliff 13.11.2026)
//
// Justin: „achte auf die Formatierung, sodass alles clean aussieht“. Die Sätze selbst bleiben, wie sie in
// shared/fiaon-global-verkauf.ts stehen — hier wird nur gesteuert, WO eine Zeile enden darf:
//   · Ein Gedankenstrich steht nie am Zeilenanfang (das Leerzeichen davor wird ein geschütztes).
//   · Wörter mit Bindestrich bleiben zusammen („E-Mail“, „US-Dollar“, „Fast-Track“ — Wortbruch.tsx, bis 20 Zeichen).
//   · Kurze Klammern bleiben zusammen („(1 € = 1,1165 US-$)“), ebenso ein ausgeschriebenes Datum („6 November 2026“).
//   · Eine Zahl bleibt bei ihrer Einheit („2.799 €“, „1 Mio.“, “1 million”) — nie endet eine Zeile auf der nackten Zahl
//     (E-510, 13.11.2026: „Ab 1 / Mio. US-Dollar“ in der Tatsachenreihe der Bühne); ebenso „§ 138“.
// Die Spanne trägt die Klasse .fd-wort; global-verkauf.css gibt ihr in den Abschnitten des Verkaufsmotors white-space: nowrap.
// ═══════════════════════════════════════════════════════════════════════════
import { Fragment, type ReactNode } from "react";
import { ohneBindestrichBruch } from "@/components/site/global/Wortbruch";

export function sauber(text: string): ReactNode {
  return text.replace(/ ([—–]) /g, "\u00a0$1 ").replace(/(\d) (€|Mio\.|million\b)/g, "$1\u00a0$2").replace(/§ (\d)/g, "§\u00a0$1").split(/(\([^()]{1,26}\)|\d{1,2}\.? [A-ZÄÖÜ][a-zäöü]+ \d{4})/).map((teil, i) => (
    i % 2 ? <span key={i} className="fd-wort">{teil}</span> : <Fragment key={i}>{ohneBindestrichBruch(teil)}</Fragment>
  ));
}
