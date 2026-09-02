import { wandPruefen, wandUrteil } from "@shared/fiaon-wortverbote";

const faelle: [string, string[], number][] = [
  ["Wir garantieren Ihnen die Löschung.", [], 1],
  ["Ihre Betreuerin Lisa ruft Sie morgen an.", ["notiz_an_betreuer"], 0],
  ["Ihre Betreuerin ruft Sie morgen an.", [], 1],
  ["Wir haben Sie aus dem Verteiler genommen.", ["werbesperre_setzen"], 0],
  ["Wir haben Sie aus dem Verteiler genommen.", [], 1],
  ["Bitte überweisen Sie auf DE86 2022 0800 0047 7193 24.", [], 1],
  ["Gerne helfen wir Ihnen weiter, zögern Sie nicht.", [], 2],
  ["Ihr Paket ist im Status pending_payment.", [], 1],
  ["Wir organisieren gerne einen Dolmetscher.", [], 1],
  ["Die Karte und PIN senden wir Ihnen zu.", [], 1],
  ["Sie hatten mir geraten, das zu prüfen.", [], 0],
  ["Ihre Kündigung ist vermerkt, die letzte Rate bleibt offen.", ["kuendigung_vormerken"], 0],
  ["Innerhalb von 48 Stunden erhalten Sie eine Bestätigung.", [], 1],
];

let ok = true;
for (const [t, w, n] of faelle) {
  const g = wandPruefen(t, w);
  if (g.length !== n) {
    ok = false;
    console.log("FEHLER: erwartet", n, "gefunden", g.length, "|", t.slice(0, 55), "|", g.map((x) => x.treffer).join(" / "));
  }
}
console.log(ok ? "ALLE 13 WAND-FÄLLE OK" : "FEHLER");
console.log("Floskel:", JSON.stringify(wandUrteil(wandPruefen("Gerne helfen wir Ihnen weiter."))));
console.log("Garantie:", JSON.stringify(wandUrteil(wandPruefen("Wir garantieren das."))));
process.exit(ok ? 0 : 1);
