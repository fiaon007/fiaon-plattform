// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: DIE WEICHE ALT/NEU — WER LANDET WO? (05.10.2026, E-283)
//
// Justin: „Stelle den neuen Antrag live, überall für die Privatkunden, also
// auch auf fiaon.com/start". Bis hier gab es für die Weiche keinen Prüfstand —
// und mit der alten Erlaubtliste blieb /start auch bei 100 % beim alten Weg,
// ohne dass es jemand merkte. Fünf Teile, alle ohne Datenbank und ohne Anfrage:
//   1. Link-Ausnahme: Adresse → bleibt alt ja/nein (die Sperrliste).
//   2. Die Links von /start (unverändert: pack, src=wa, utm_*, ref) lösen keine Ausnahme aus.
//   3. Die Regel bei 0 / 50 / 100 % mit und ohne Cookie, offenem Antrag, Roboter.
//   4. Woher der Anteil kommt: Zeile im Chefbüro, Render-Variable, Vorgabe.
//   5. Roboter-Muster: CUBOT ist ein Mensch, Googlebot nicht.
//   6. Die Auskunft-Parameter für den neuen Antrag (auskunftVorabAus).
//
//   env -i PATH="$PATH" HOME="$HOME" DATABASE_URL=postgresql://pruef@127.0.0.1:9/keine \
//     npx tsx scripts/pruef-antrag-weiche.ts
// ═══════════════════════════════════════════════════════════════════════════
import {
  weicheLinkAusnahme, weicheRegel, anteilBestimmen, anteilAusRender, istWeicheRoboter, type WeicheUrteil,
} from "../server/lib/fiaon-antrag-weiche";
import { auskunftVorabAus } from "../shared/fiaon-auskunft-buendel";

let ok = 0, fehl = 0;
function pruef(name: string, bed: boolean, info = "") {
  if (bed) ok++; else { fehl++; console.log(`  ✗ ${name}${info ? ` — ${info}` : ""}`); }
}

// ── 1. Link-Ausnahme: bleibt diese Adresse beim alten Weg? ────────────────
const LINKS: [string, boolean, string][] = [
  // Einstiege, die jetzt in die normale Entscheidung gehen (bei 100 % → neu)
  ["?pack=pro&utm_source=x", false, "/start mit Paket und Kampagne"],
  ["?pack=pro&src=wa&utm_source=fb&utm_campaign=c1&ref=abc", false, "alter /start-Link (noch in Anzeigen und Verläufen)"],
  ["?src=wa", false, "WhatsApp-Landing ohne Paket"],
  ["?l=ABC&k=w", false, "persönlicher Link /a/<code>/w"],
  ["?l=Ab3dEf7hJk&k=f", false, "Meta-Formular /fb"],
  ["?quelle=link-abgelaufen", false, "abgelaufener /a/-Code"],
  ["?quelle=empfehlung", false, "Empfehlung über /start"],
  ["?lead=5", false, "Rückfall ?lead= (alte Mails)"],
  ["?gad_source=1", false, "Google Ads"],
  ["?gad_source=1&gad_campaignid=123&gclid=x", false, "Google Ads mit Kampagne"],
  ["?srsltid=AfmBOo", false, "organische Google-Suche"],
  ["?_gl=1*abc*_ga*MTIz", false, "Google-Tag über Domains"],
  ["?fbclid=IwAR0&utm_source=facebook", false, "Meta-Klick"],
  ["?src=auskunft_da", false, "Mail „Ihre Auskunft ist da“ (neuer Weg liest es)"],
  ["?src=auskunft&auskunft=1", false, "Paket mit Auskunft (neuer Weg liest es)"],
  ["?auskunft=1", false, "auskunft=1 allein"],
  ["?src=auskunft&auskunft=0", false, "nach bestellter Auskunft"],
  ["?pack=start&src=privatkunden", false, "/privatkunden"],
  ["?pack=pro&src=preise", false, "/preise"],
  ["?pack=ultra&src=konzept", false, "/plattform-konzept"],
  ["?pack=highend&src=en", false, "/en"],
  ["?pack=high-end", false, "Schreibweise high-end"],
  ["?paket=HighEnd", false, "paket= in anderer Schreibweise"],
  ["?pack=", false, "leeres pack= ist kein Paket"],
  ["", false, "ohne Parameter"],
  // Bleibt alt: kann nur der alte Weg
  ["?pack=schufa", true, "Auskunft-Paket → alter Weg leitet auf /bonitaet-antrag"],
  ["?pack=auskunft_privat", true, "Auskunft einzeln"],
  ["?pack=auskunft_firma&utm_source=x", true, "Firmen-Auskunft mit Kampagne"],
  ["?pack=auskunft", true, "Auskunft (alter Schlüssel)"],
  ["?pack=business_pro", true, "eingestelltes Business-Paket"],
  ["?weiter=x.y.z", true, "Weiter-Link aus der Erinnerung"],
  ["?WEITER=x.y.z", true, "Weiter-Link groß geschrieben"],
  ["?step=3", true, "Entwicklungs-Abkürzung step"],
  ["?skip=true&skipPayment=true", true, "Entwicklungs-Abkürzung skip"],
  ["?skippayment=true", true, "skippayment klein"],
  ["?utm_source=x&weiter=a.b.c", true, "Weiter-Link mit Kampagne"],
];
for (const [suche, erwartet, was] of LINKS) {
  pruef(`Link ${suche || "(leer)"} → ${erwartet ? "alt" : "Entscheidung"} (${was})`, weicheLinkAusnahme(suche) === erwartet, `bekam ${weicheLinkAusnahme(suche)}`);
}

// ── 2. Die Links von /start ───────────────────────────────────────────────
// /start bleibt, wie es ist (Justin 05.10.2026: „entferne bei /start gar nichts“).
// Seine Paketknöpfe bauen /antrag?pack=…&src=wa[&utm_*][&ref] — genau diese Form
// muss die Sperrliste durchlassen, sonst bliebe /start beim alten Antrag.
for (const suche of [
  "?pack=start&src=wa", "?pack=pro&src=wa", "?pack=ultra&src=wa", "?pack=highend&src=wa",
  "?pack=pro&src=wa&utm_source=fb&utm_medium=paid&utm_campaign=herbst&utm_term=t&utm_content=c",
  "?pack=ultra&src=wa&ref=empfehlung", "?src=wa",
]) {
  pruef(`/start-Link ${suche} → Entscheidung (kein alter Weg)`, weicheLinkAusnahme(suche) === false, `bekam ${weicheLinkAusnahme(suche)}`);
}

// ── 3. Die Regel ──────────────────────────────────────────────────────────
const ID = "abcdef0123456789ab";
const lage = (t: Partial<Parameters<typeof weicheRegel>[0]>) =>
  weicheRegel({ anteil: 0, roboter: false, link: false, offen: null, cookie: null, zufall: 50, neueId: ID, ...t });
function erwarte(name: string, u: WeicheUrteil, weg: string, grund: string, cookie: string | null, dauerhaft: boolean | null, zuteilung: boolean) {
  const cookieOk = cookie === null ? u.cookie === null : u.cookie?.wert === cookie && u.cookie?.dauerhaft === dauerhaft;
  pruef(name, u.weg === weg && u.grund === grund && cookieOk && u.zuteilung === zuteilung, JSON.stringify(u));
}
// 0 % — die Weiche ist aus
erwarte("0 %: ohne alles → alt, kein Cookie", lage({ anteil: 0 }), "alt", "aus", null, null, false);
erwarte("0 %: Cookie neu wird übergangen → alt", lage({ anteil: 0, cookie: { weg: "neu", id: ID } }), "alt", "aus", null, null, false);
erwarte("0 %: offener NEUER Antrag → neu", lage({ anteil: 0, offen: "neu" }), "neu", "antrag_offen", null, null, false);
erwarte("0 %: offener neuer Antrag, aber Weiter-Link → alt", lage({ anteil: 0, offen: "neu", link: true }), "alt", "aus", null, null, false);
// 50 %
erwarte("50 %: ohne Cookie, Würfel 10 → neu, dauerhaftes Cookie, gemessen", lage({ anteil: 50, zufall: 10 }), "neu", "zugeteilt", `neu.${ID}`, true, true);
erwarte("50 %: ohne Cookie, Würfel 90 → alt, dauerhaftes Cookie, gemessen", lage({ anteil: 50, zufall: 90 }), "alt", "zugeteilt", `alt.${ID}`, true, true);
erwarte("50 %: Cookie alt bleibt alt", lage({ anteil: 50, zufall: 1, cookie: { weg: "alt", id: ID } }), "alt", "cookie", null, null, false);
erwarte("50 %: Cookie neu bleibt neu", lage({ anteil: 50, zufall: 99, cookie: { weg: "neu", id: ID } }), "neu", "cookie", null, null, false);
erwarte("50 %: Link-Ausnahme ohne Cookie → alt + Sitzungs-Cookie", lage({ anteil: 50, link: true }), "alt", "link", `alt.${ID}`, false, false);
erwarte("50 %: Link-Ausnahme mit Cookie neu → alt, Cookie bleibt", lage({ anteil: 50, link: true, cookie: { weg: "neu", id: ID } }), "alt", "link", null, null, false);
erwarte("50 %: Roboter → alt", lage({ anteil: 50, roboter: true, zufall: 1 }), "alt", "roboter", null, null, false);
erwarte("50 %: offener alter Antrag → alt", lage({ anteil: 50, offen: "alt", zufall: 1 }), "alt", "antrag_offen", null, null, false);
// 100 %
erwarte("100 %: ohne Cookie, höchster Würfel → neu", lage({ anteil: 100, zufall: 99.999 }), "neu", "zugeteilt", `neu.${ID}`, true, true);
erwarte("100 %: Cookie alt.<id> → umgeschrieben auf neu.<id>, nicht gemessen", lage({ anteil: 100, cookie: { weg: "alt", id: "1234567890abcdef" } }), "neu", "umgeschrieben", "neu.1234567890abcdef", true, false);
erwarte("100 %: Cookie neu bleibt neu", lage({ anteil: 100, cookie: { weg: "neu", id: ID } }), "neu", "cookie", null, null, false);
erwarte("100 %: Link-Ausnahme → alt, aber KEIN Sitzungs-Cookie alt", lage({ anteil: 100, link: true }), "alt", "link", null, null, false);
erwarte("100 %: offener ALTER Antrag bleibt alt", lage({ anteil: 100, offen: "alt" }), "alt", "antrag_offen", null, null, false);
erwarte("100 %: offener alter Antrag schlägt Cookie alt (kein Umschreiben)", lage({ anteil: 100, offen: "alt", cookie: { weg: "alt", id: ID } }), "alt", "antrag_offen", null, null, false);
erwarte("100 %: offener neuer Antrag → neu", lage({ anteil: 100, offen: "neu" }), "neu", "antrag_offen", null, null, false);
erwarte("100 %: Roboter → alt", lage({ anteil: 100, roboter: true }), "alt", "roboter", null, null, false);
// Die Würfel: genau der Anteil der Zuteilungen geht auf neu (Grenzen).
{
  let neu = 0;
  for (let z = 0; z < 100; z++) if (lage({ anteil: 25, zufall: z }).weg === "neu") neu++;
  pruef("25 %: von 100 gleichverteilten Würfen genau 25 neu", neu === 25, `bekam ${neu}`);
}

// ── 4. Woher der Anteil kommt ─────────────────────────────────────────────
const A = (zeile: string | null, render: unknown, wert: number, quelle: string, was: string) => {
  const a = anteilBestimmen(zeile, render);
  pruef(`Anteil: ${was}`, a.wert === wert && a.quelle === quelle, JSON.stringify(a));
};
A(null, undefined, 0, "vorgabe", "keine Zeile, keine Variable → 0 (Vorgabe)");
A(null, "", 0, "vorgabe", "keine Zeile, leere Variable → 0 (Vorgabe)");
A(null, "100", 100, "render", "keine Zeile, Variable 100 → 100 (Render)");
A(null, " 50 ", 50, "render", "Variable mit Leerzeichen");
A(null, "0", 0, "render", "Variable 0 ist ein Wert (Render)");
A(null, "abc", 0, "vorgabe", "Variable ungültig → 0 (Vorgabe)");
A(null, "101", 0, "vorgabe", "Variable über 100 → 0");
A(null, "12.5", 0, "vorgabe", "Variable keine ganze Zahl → 0");
A(null, "-1", 0, "vorgabe", "Variable negativ → 0");
A("0", "100", 0, "chefbuero", "Zeile 0 schlägt Variable 100 (Zurückstellen im Chefbüro)");
A("25", "100", 25, "chefbuero", "Zeile 25 schlägt Variable 100");
A("100", undefined, 100, "chefbuero", "Zeile 100 ohne Variable");
A("", "100", 0, "chefbuero", "leere Zeile gilt als 0 und schlägt die Variable");
pruef("anteilAusRender: \"7\" → 7", anteilAusRender("7") === 7);
pruef("anteilAusRender: nichts → null", anteilAusRender(undefined) === null);

// ── 5. Roboter oder Mensch? ───────────────────────────────────────────────
const MENSCHEN: [string, string][] = [
  ["CUBOT X30 (Leerzeichen)", "Mozilla/5.0 (Linux; Android 10; CUBOT X30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"],
  ["CUBOT_X19", "Mozilla/5.0 (Linux; Android 9; CUBOT_X19 Build/PPR1.180610.011) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36"],
  ["CUBOT KINGKONG im WebView", "Mozilla/5.0 (Linux; Android 12; CUBOT KINGKONG 7 Build/SP1A.210812.016; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/118.0.0.0 Mobile Safari/537.36"],
  ["iPhone Safari", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"],
  ["Chrome Windows", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"],
  ["Samsung Internet", "Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36"],
  ["Telegram-Browser (Menschen)", "Mozilla/5.0 (Linux; Android 13; SM-A536B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 Telegram-Android/10.2.6 (Samsung SM-A536B; Android 13; SDK 33; AVERAGE)"],
  ["Instagram-Browser", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.0 (iPhone14,5; iOS 17_4; de_DE; de; scale=3.00; 1170x2532)"],
];
const ROBOTER: [string, string][] = [
  ["Googlebot", "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"],
  ["Googlebot Smartphone", "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"],
  ["bingbot", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0.1938.76 Safari/537.36"],
  ["AhrefsBot", "Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)"],
  ["AdsBot-Google", "AdsBot-Google (+http://www.google.com/adsbot.html)"],
  ["Slackbot", "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)"],
  ["Discordbot", "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)"],
  ["GPTBot", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)"],
  ["TelegramBot", "TelegramBot (like TwitterBot)"],
  ["Facebook-Vorschau", "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"],
  ["WhatsApp-Vorschau", "WhatsApp/2.23.20.0 A"],
  ["Baiduspider", "Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)"],
  ["HeadlessChrome", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36"],
  ["curl", "curl/8.4.0"],
  ["leere Kennung", ""],
];
for (const [was, ua] of MENSCHEN) pruef(`Mensch: ${was}`, !istWeicheRoboter(ua));
for (const [was, ua] of ROBOTER) pruef(`Roboter: ${was}`, istWeicheRoboter(ua));

// ── 6. Auskunft-Parameter für den neuen Antrag ────────────────────────────
const V: [string, string][] = [
  ["?src=auskunft&auskunft=1", "gewuenscht"],
  ["?auskunft=1", "gewuenscht"],
  ["?src=auskunft", "gewuenscht"],
  ["?src=auskunft&auskunft=0", "bestellt"],
  ["?src=auskunft_da", "da"],
  ["?src=auskunft_da&auskunft=1", "da"],
  ["?src=wa&pack=pro", ""],
  ["", ""],
];
for (const [suche, erwartet] of V) pruef(`Auskunft ${suche || "(leer)"} → ${erwartet || "nichts"}`, auskunftVorabAus(suche) === erwartet, `bekam ${auskunftVorabAus(suche)}`);

console.log(`\n${fehl === 0 ? "GRÜN" : "ROT"} — ${ok} ok, ${fehl} rot (pruef-antrag-weiche)`);
process.exit(fehl === 0 ? 0 : 1);
