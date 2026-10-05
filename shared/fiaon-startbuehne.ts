/**
 * DIE STARTBÜHNE (E-287, 05./06.10.2026) — der Ladebildschirm ab dem ersten Byte.
 *
 * Justin, 05.10.2026 (mit Bildschirmfoto): „wenn man unsere Seite öffnet schaut das die ersten Sekunden
 * so komisch kacke aus … das soll nie passieren — lieber eine coole, moderne, spannende Ladeanimation".
 * Gemeint war der Vorab-Korpus für Suchmaschinen (server/lib/fiaon-seiten-seo.ts): Bis React startet,
 * stand er als Textseite im Fenster.
 *
 * 06.10.2026: Zwei Welten, zwei Motive — Justin wählte aus zwölf Entwürfen (Werkbank scratchpad/lader,
 * Jury + Schliff) „Riffelglas“ für Privat und „Fassade“ für FIAON Global (Business-Adressen). Die Motive
 * stehen in shared/fiaon-startbuehne-motive.ts (erzeugt). Beide liegen in index.html; ein Skript im Kopf
 * entscheidet VOR dem ersten Bild per Adresse, welches sichtbar ist. Dasselbe Motiv ist der Lader beim
 * Seitenwechsel (App.tsx, SeiteLaedt). Die Bühne geht erst, wenn die erste Seite wirklich steht
 * (App.tsx, StartbuehneWeg): Die Wurzel des Motivs bekommt „weg“ (Ausgang des Motivs), danach wird
 * die Hülle entfernt.
 *
 * Suchmaschinen: Der Korpus bleibt unverändert im HTML (kein display:none, kein anderer Inhalt für Bots);
 * die Bühne ist ein Ladebildschirm darüber. Ohne JavaScript blendet <noscript> sie aus, und spätestens
 * nach 9 Sekunden geht sie von selbst (CSS), falls das Skript nie startet.
 */
import { MOTIV_PRIVAT, MOTIV_BUSINESS, type BuehnenMotiv } from "./fiaon-startbuehne-motive";

/** Business-Adressen (FIAON Global) bekommen das Business-Motiv. */
export const BUSINESS_BUEHNE = /^\/(en\/)?business(\/|$)/;

/** Welches Motiv gilt für diese Adresse? `suche` = location.search (für ?bereich=business). */
export function buehnenMotiv(pfad: string, suche = ""): BuehnenMotiv {
  return BUSINESS_BUEHNE.test(pfad) || /[?&]bereich=business(&|$)/.test(suche) ? MOTIV_BUSINESS : MOTIV_PRIVAT;
}

/** Kleinste Standzeit ab Aufruf (ms) — je Motiv, damit der Auftakt nicht abreißt. */
export function buehneMindestensMs(motiv: BuehnenMotiv): number {
  return motiv.mindestensMs;
}

/** Skript für den Kopf von index.html: Welt wählen und Scrollen sperren, bevor irgendetwas gezeichnet wird. */
function kopfSkript(): string {
  return `<script>(function(){var d=document.documentElement;if(${BUSINESS_BUEHNE.toString()}.test(location.pathname)||/[?&]bereich=business(&|$)/.test(location.search))d.className+=" ld-business";d.className+=" ld-an";setTimeout(function(){d.classList.remove("ld-an")},9000)})()</script>`;
}

/** Die Startbühne für den Körper von index.html — vor #root, beide Motive in einer Hülle. */
export function startbuehneHtml(): string {
  const motiv = (m: BuehnenMotiv, welt: string) =>
    `<div class="${m.klasse} lader fi-motiv-${welt}" role="status" aria-label="${m.aria}">${m.innen}</div>`;
  return `<div id="fi-start">${motiv(MOTIV_PRIVAT, "privat")}${motiv(MOTIV_BUSINESS, "business")}</div>
    <noscript><style>#fi-start{display:none}</style></noscript>`;
}

/** Stil der Bühne — inline im Kopf von index.html, gilt für Start- und Seitenwechsel-Bühne. */
export const BUEHNE_STIL = `
#fi-start{position:fixed;inset:0;z-index:2147483000;animation:ldNotaus .5s ease 9s forwards}
html:not(.ld-business) #fi-start .fi-motiv-business,html.ld-business #fi-start .fi-motiv-privat{display:none}
#fi-start.zu{pointer-events:none}
html.ld-an,html.ld-an body{overflow:hidden}
@keyframes ldNotaus{to{opacity:0;visibility:hidden}}
${MOTIV_PRIVAT.stil}
${MOTIV_BUSINESS.stil}
`.trim();

/** Kopf-Einsatz (Stil + Weltwahl-Skript) für vite.config.ts. */
export function buehneKopf(): string {
  return `<style id="fi-buehne-stil">${BUEHNE_STIL}</style>${kopfSkript()}`;
}
