/**
 * DIE STARTBÜHNE (E-287, 05.10.2026) — der Ladebildschirm ab dem ersten Byte.
 *
 * Justin, 05.10.2026 (mit Bildschirmfoto): „wenn man unsere Seite öffnet schaut das die ersten Sekunden
 * so komisch kacke aus … das soll nie passieren — lieber eine coole, moderne, spannende Ladeanimation".
 * Gemeint war der Vorab-Korpus für Suchmaschinen (server/lib/fiaon-seiten-seo.ts): Bis React startet,
 * stand er als Textseite im Fenster.
 *
 * Jetzt liegt über allem sofort die Bühne „Aufwärts“ (Vorschlag B, von Justin aus drei Entwürfen gewählt;
 * die Weltkugel wollte er dort ausdrücklich nicht): eine steigende Lichtkurve, dann die Wortmarke. Sie geht
 * erst, wenn die erste Seite wirklich steht (App.tsx, StartbuehneWeg). Derselbe Bildschirm ist der Lader beim
 * Seitenwechsel (App.tsx, SeiteLaedt) — eine Quelle für beide, Stil inline in index.html (vite.config.ts),
 * damit er ohne das große Stilblatt greift.
 *
 * Suchmaschinen: Der Korpus bleibt unverändert im HTML (kein display:none, kein anderer Inhalt für Bots);
 * die Bühne ist ein Ladebildschirm darüber. Ohne JavaScript blendet <noscript> sie aus, und spätestens
 * nach 9 Sekunden geht sie von selbst (CSS), falls das Skript nie startet.
 */
import { MARKE_BOX, MARKE_PFAD } from "./fiaon-marke";

/** Helle Seiten bekommen die helle Bühne (wie bisher der Lader beim Seitenwechsel). */
export const HELLE_BUEHNE = /^\/(en\/)?business(\/|$)|^\/(privacy|datenschutz)\/?$/;

/** Kleinste Standzeit ab Aufruf (ms): so lange brauchen Kurve und Buchstaben (E-287, Vorschlag B). */
export const BUEHNE_MINDESTENS_MS = 1250;

/** Die fünf Buchstaben der Wortmarke einzeln — sie steigen nacheinander aus der Grundlinie auf. */
function buchstaben(): string[] {
  const teile = MARKE_PFAD.fiaon.split("Z M");
  return teile.map((t, i) => `${i === 0 ? "" : "M"}${t}${i === teile.length - 1 ? "" : "Z"}`);
}

/** Die steigende Kurve — quer für breite Fenster, hoch für das Telefon (gleichmäßig skaliert, kein Verzerren). */
const KURVE = {
  quer: { vb: "0 0 1000 600", d: "M-40 560 C 240 548, 350 452, 500 392 S 790 172, 1040 118", ende: [1040, 118] },
  hoch: { vb: "0 0 600 1000", d: "M-30 930 C 140 905, 210 720, 300 620 S 470 300, 640 210", ende: [640, 210] },
} as const;

function kurveSvg(art: keyof typeof KURVE): string {
  const k = KURVE[art];
  return `<svg class="ld-kurve ${art}" viewBox="${k.vb}" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><path class="k-linie" d="${k.d}" pathLength="1"/><circle class="k-punkt" r="6"><animateMotion dur="1s" begin="0.05s" fill="freeze" calcMode="spline" keyTimes="0;1" keyPoints="0;1" keySplines=".45 0 .2 1" path="${k.d}"/></circle></svg>`;
}

/**
 * Das Innere der Bühne (Vorschlag B „Aufwärts“, Justin 05.10.2026): Eine Lichtlinie zeichnet eine steigende
 * Kurve — wie ein Score, der nach oben geht —, ein Lichtpunkt fährt mit; dann steigen die fünf Buchstaben
 * der Wortmarke nacheinander aus der Grundlinie auf. `kennung` bleibt für eindeutige Kennungen reserviert.
 */
export function buehneInnen(_kennung: string): string {
  const m = MARKE_BOX.fiaon;
  return `<div class="ld-raster"></div>${kurveSvg("quer")}${kurveSvg("hoch")}
<svg class="ld-marke" viewBox="${m.x} ${m.y} ${m.b} ${m.h}" role="img" aria-label="FIAON">${buchstaben().map((d, i) => `<path style="animation-delay:${(0.4 + i * 0.06).toFixed(2)}s" d="${d}"/>`).join("")}</svg>`;
}

/** Die Startbühne für index.html — vor #root, mit Hell-Weiche und Scroll-Sperre bis zur ersten Seite. */
export function startbuehneHtml(): string {
  return `<div id="fi-start" class="ld" role="status" aria-label="FIAON lädt">${buehneInnen("S")}</div>
    <script>(function(){var d=document.documentElement,b=document.getElementById("fi-start");if(${HELLE_BUEHNE.toString()}.test(location.pathname))b.className+=" hell";d.className+=" ld-an";setTimeout(function(){d.classList.remove("ld-an")},9000)})()</script>
    <noscript><style>#fi-start{display:none}</style></noscript>`;
}

/** Stil der Bühne — inline im Kopf von index.html, gilt für Start- und Seitenwechsel-Bühne. */
export const BUEHNE_STIL = `
.ld{position:fixed;inset:0;z-index:60;display:grid;place-items:center;overflow:hidden;animation:ldEin .2s ease both;
 background:radial-gradient(ellipse 70% 60% at 72% 28%,rgba(37,99,235,.2),transparent 70%),radial-gradient(ellipse 50% 45% at 10% 95%,rgba(37,99,235,.1),transparent 70%),#0a1426}
#fi-start{z-index:2147483000;animation:ldNotaus .5s ease 9s forwards;transition:opacity .55s ease,visibility 0s linear .55s}
#fi-start.weg{opacity:0;visibility:hidden;pointer-events:none}
#fi-start.weg .ld-marke{transform:translateY(-6px) scale(1.03);transition:transform .55s cubic-bezier(.22,1,.36,1)}
html.ld-an,html.ld-an body{overflow:hidden}
@keyframes ldEin{from{opacity:0}to{opacity:1}}
@keyframes ldNotaus{to{opacity:0;visibility:hidden}}
.ld-raster{position:absolute;inset:0;background:repeating-linear-gradient(180deg,transparent 0,transparent calc(25vh - 1px),rgba(255,255,255,.035) calc(25vh - 1px),rgba(255,255,255,.035) 25vh)}
.ld-kurve{position:absolute;inset:0;width:100%;height:100%}
.ld-kurve.hoch{display:none}
@media (orientation:portrait){.ld-kurve.quer{display:none}.ld-kurve.hoch{display:block}}
.ld-kurve .k-linie{fill:none;stroke:#3b82f6;stroke-width:2.5;stroke-linecap:round;vector-effect:non-scaling-stroke;stroke-dasharray:1;stroke-dashoffset:1;animation:ldZug 1s cubic-bezier(.45,0,.2,1) .05s forwards,ldLeise .8s ease 1.3s forwards}
.ld-kurve .k-punkt{fill:#bfdbfe;filter:drop-shadow(0 0 6px rgba(147,197,253,.9))}
@keyframes ldZug{to{stroke-dashoffset:0}}
@keyframes ldLeise{to{opacity:.28}}
.ld-marke{position:relative;display:block;height:54px;width:auto;aspect-ratio:${MARKE_BOX.fiaon.b}/${MARKE_BOX.fiaon.h};overflow:hidden}
.ld-marke path{fill:#fff;transform:translateY(760px);animation:ldSteigen .6s cubic-bezier(.22,1,.36,1) forwards}
@keyframes ldSteigen{to{transform:none}}
@media (max-width:640px){.ld-marke{height:42px}}
.ld.hell{background:radial-gradient(ellipse 70% 60% at 72% 28%,rgba(29,78,216,.07),transparent 70%),#fff}
.ld.hell .ld-raster{background:repeating-linear-gradient(180deg,transparent 0,transparent calc(25vh - 1px),rgba(12,26,46,.05) calc(25vh - 1px),rgba(12,26,46,.05) 25vh)}
.ld.hell .k-linie{stroke:#1d4ed8}
.ld.hell .k-punkt{fill:#1d4ed8;filter:none}
.ld.hell .ld-marke path{fill:#0c1a2e}
@media (prefers-reduced-motion:reduce){.ld-kurve .k-linie{animation:none;stroke-dashoffset:0;opacity:.28}.ld-kurve .k-punkt{display:none}.ld-marke path{animation:none;transform:none}}
`.trim();
