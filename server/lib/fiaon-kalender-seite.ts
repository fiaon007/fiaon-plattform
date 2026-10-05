// ═══════════════════════════════════════════════════════════════════════════
// DIE EINRICHTUNGSSEITE /kalender/<token> (29.09.2026, E-263)
//
// Warum eine Seite zwischen Mail und Kalender: Ein webcal://-Link in einer
// Mail ist unsicher — Gmail macht ihn nicht klickbar, und Brevos Klick-
// verfolgung schreibt Links um. Die Mail trägt deshalb https://…/kalender/
// <token>, und HIER stehen die drei Wege: iPhone/Mac (webcal://), Google
// („per URL hinzufügen") und „Link kopieren" für Outlook und alles andere.
// Dazu der Zustand („aktiv — zuletzt abgerufen vor 12 Min. von Apple") — ein
// zweiter Klick auf „Alle Termine" landet hier und sagt: Du musst nichts tun.
//
// Server-HTML ohne Login, ohne fremde Schriften oder Skripte (der Token steht
// in der Adresse — nichts soll ihn als Referer mitnehmen), noindex. Dunkles
// Navy wie das Chefbüro, 380 px tauglich.
// ═══════════════════════════════════════════════════════════════════════════
import {
  KALENDER_TEXT, kalenderZustandSatz, type KalenderAboSicht,
} from "../../shared/fiaon-kalender-abo";
import { markeSvg } from "@shared/fiaon-marke";

/** Die Wortmarke (E-286), weiß auf dem dunklen Grund der Seite. */
const MARKE = markeSvg("fiaon", "#ffffff", "20px");

const esc = (s: unknown) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const STIL = `
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  body { min-height: 100vh; background: #0a1730; background-image: linear-gradient(160deg, #12264f 0%, #0a1730 55%, #081226 100%);
         color: #E6EDF7; font: 300 15px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  main { max-width: 560px; margin: 0 auto; padding: 40px 16px 56px; }
  .marke { line-height: 0; }
  h1 { font-weight: 400; font-size: 26px; line-height: 1.25; letter-spacing: -.01em; margin: 18px 0 8px; }
  p { margin: 0 0 12px; color: #A7B4CA; }
  .zustand { margin: 18px 0 22px; padding: 12px 14px; border-radius: 12px; border: 1px solid rgba(148,170,210,.2); background: rgba(255,255,255,.03); color: #E6EDF7; }
  .zustand.aktiv { border-color: rgba(61,214,140,.45); }
  .zustand.aktiv::before { content: ""; display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #3DD68C; margin-right: 8px; vertical-align: 1px; }
  .wege { display: grid; gap: 10px; margin: 0 0 8px; }
  .knopf { display: flex; align-items: center; justify-content: center; min-height: 48px; padding: 12px 18px; border-radius: 12px;
           border: 1px solid rgba(148,170,210,.25); background: rgba(255,255,255,.04); color: #E6EDF7; text-decoration: none;
           font-family: inherit; font-size: 16px; font-weight: 400; line-height: 1.3; cursor: pointer; text-align: center; width: 100%; }
  .knopf.haupt { background: #288DFA; border-color: #288DFA; color: #fff; }
  .knopf small { display: block; }
  .klein { font-size: 12.5px; color: #74839E; margin: 2px 2px 14px; }
  .kopie { display: grid; gap: 8px; margin-top: 4px; }
  .kopie input { width: 100%; min-height: 44px; padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(148,170,210,.2);
                 background: rgba(0,0,0,.25); color: #E6EDF7; font: 300 13px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; }
  h2 { font-weight: 400; font-size: 15px; color: #E6EDF7; margin: 28px 0 8px; }
  ul { margin: 0; padding-left: 18px; color: #A7B4CA; }
  li { margin: 0 0 8px; }
  .fuss { margin-top: 32px; font-size: 12px; color: #74839E; }
  @media (hover: hover) { .knopf:hover { border-color: rgba(140,194,255,.6); } .knopf.haupt:hover { background: #1D4ED8; border-color: #1D4ED8; } }
`;

/** Die Seite für ein gültiges Abo. */
export function kalenderSeiteHtml(s: KalenderAboSicht, jetzt: Date = new Date()): string {
  const team = s.umfang === "team";
  const titel = team ? "Die Termine des Teams in deinem Kalender" : "Deine FIAON-Termine in deinem Kalender";
  const zustand = kalenderZustandSatz(s, jetzt);
  return `<!doctype html>
<html lang="de"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<title>FIAON · Kalender-Abo</title>
<style>${STIL}</style>
</head><body><main>
  <div class="marke">${MARKE}</div>
  <h1>${esc(titel)}</h1>
  <p>Einmal abonnieren — danach kommen neue Termine von selbst, verschobene ändern sich, abgesagte verschwinden. Nichts steht doppelt.</p>
  ${team ? `<p>Hier stehen die Termine der Mitarbeiter, ohne deine eigenen — die kommen über „Meine Termine“. ${esc(KALENDER_TEXT.chefBeide)}</p>` : ""}
  <div class="zustand${s.aktiv ? " aktiv" : ""}" data-zustand="${s.aktiv ? "aktiv" : s.zuletztAbgerufenAm ? "still" : "neu"}">${esc(zustand)}</div>

  <div class="wege">
    <a class="knopf haupt" href="${esc(s.links.webcal)}">iPhone / iPad / Mac — abonnieren</a>
    <a class="knopf" href="${esc(s.links.google)}" target="_blank" rel="noreferrer noopener">Google Kalender — per URL hinzufügen</a>
  </div>
  <p class="klein">${esc(KALENDER_TEXT.googleHandy)}</p>

  <div class="kopie">
    <button type="button" class="knopf" id="kopieren">Outlook / anderes: Link kopieren</button>
    <input id="link" readonly value="${esc(s.links.ics)}" aria-label="Abo-Adresse">
  </div>
  <p class="klein" id="kopiert" role="status"></p>

  <h2>Gut zu wissen</h2>
  <ul>
    <li>${esc(KALENDER_TEXT.tempo)}</li>
    <li>${esc(KALENDER_TEXT.nichtDoppelt)}</li>
    <li>${esc(KALENDER_TEXT.apple)}</li>
    <li>${esc(KALENDER_TEXT.googleWecker)}</li>
    <li>${esc(KALENDER_TEXT.ohne)}</li>
    <li>${esc(KALENDER_TEXT.persoenlich)} ${team ? "Neu erzeugen: Chefbüro → Mara → Termine → „Termine in deinem Kalender“." : "Neu erzeugen: Portal → Calendar → „In meinen Kalender“."}</li>
  </ul>
  <p class="fuss">FIAON · Diese Seite ist nur für dich. Sie steht in keiner Suchmaschine.</p>
</main>
<script>
  (function () {
    var k = document.getElementById("kopieren"), f = document.getElementById("link"), m = document.getElementById("kopiert");
    if (!k || !f) return;
    k.addEventListener("click", function () {
      var fertig = function (ok) { m.textContent = ok ? "Kopiert. In Outlook: Kalender hinzufügen → Aus dem Internet → Adresse einfügen." : "Bitte die Adresse oben markieren und kopieren."; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(f.value).then(function () { fertig(true); }, function () { f.select(); fertig(false); });
      else { f.select(); try { fertig(document.execCommand("copy")); } catch (e) { fertig(false); } }
    });
  })();
</script>
</body></html>`;
}

/**
 * Dieselbe Seite für unbekannt, widerrufen, gesperrt oder falsch — verrät nicht, ob es den Link je gab.
 * Nennt beide Wege zum neuen Link: Das Team-Abo gibt es nur im Chefbüro (Gegenprüfung 29.09.2026).
 */
export function kalenderUnbekanntHtml(): string {
  return `<!doctype html>
<html lang="de"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<title>FIAON · Kalender-Link</title>
<style>${STIL}</style>
</head><body><main>
  <div class="marke">${MARKE}</div>
  <h1>Dieser Kalender-Link gilt nicht (mehr).</h1>
  <p>Vielleicht wurde ein neuer Link erzeugt — dann hört der alte sofort auf. Den aktuellen findest du im Portal unter Calendar → „In meinen Kalender“ · als Chef: Chefbüro → Mara → Termine → „Termine in deinem Kalender“.</p>
  <p>Hattest du den alten Link abonniert, zeigt dieser Kalender keine Termine mehr — lösch ihn in deiner Kalender-App.</p>
</main></body></html>`;
}
