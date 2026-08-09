// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: Space v5, Mail-Bugs, Vertriebsliste, Menü, Telefon-callerId
//
// Was hier gemessen wird, ist zum Teil GESTALTUNG. Das ist ungewöhnlich für
// einen Prüfstand — aber die Spezifikation zu Space v5 nennt konkrete Zahlen
// (Radius 28, Blur 20 px, Fläche 72 % Weiß, Feed 720 px, Abstand 20 px), und
// eine Zahl, die man nennt, kann man auch nachmessen. Die Werte, die nur im
// Browser entstehen, prüft `.schuss/v5.ts` am gerenderten Element.
//
//   npx tsx scripts/pruef-space5.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { readFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import { twimlAusgehend } from "../server/lib/fiaon-softphone";

let bestanden = 0;
let fehlgeschlagen = 0;
const fehler: string[] = [];
const log = (s = "") => console.log(s);
function ok(name: string, b: boolean, detail = ""): void {
  if (b) { bestanden++; log(`  PASS  ${name}`); }
  else { fehlgeschlagen++; fehler.push(name); log(`  FAIL  ${name}${detail ? `  → ${detail}` : ""}`); }
}
function gleich(name: string, ist: unknown, soll: unknown): void {
  ok(name, String(ist) === String(soll), `ist ${JSON.stringify(ist)}, soll ${JSON.stringify(soll)}`);
}
function gruppe(t: string): void { log(`\n── ${t} ${"─".repeat(Math.max(0, 52 - t.length))}`); }
const datei = (p: string) => readFileSync(p, "utf8");

async function main(): Promise<void> {
  log("\n══ Prüfstand: Space v5, Mail, Vertrieb, Menü ══\n");

  const [vorher] = await sqlPool`
    SELECT (SELECT COUNT(*) FROM fiaon_posts)::int AS posts,
           (SELECT COUNT(*) FROM fiaon_mail_log)::int AS mails
  `;

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("1. Telefon: die Nummer kommt an");
  // ═══════════════════════════════════════════════════════════════════════
  // ── DER FEHLER, DEN DIESE GRUPPE FESTHÄLT ─────────────────────────────
  // Die TwiML-Antwort enthielt `callerId=""` — ein LEERES Attribut. Twilio
  // lehnt einen Ruf ohne gültige Absendernummer ab, und im Log stand ein
  // Abbruch ohne erkennbaren Grund. Nach außen sah die Antwort wohlgeformt
  // aus; keine Konfigurationsprüfung hätte das gezeigt.
  const basis = { an: "+4930111111111", ansage: "Test", aufnahmeCallback: "https://x/a", statusCallback: "https://x/s" };

  const leer = twimlAusgehend({ ...basis, von: "" });
  ok("Ohne Absendernummer KEIN Dial", !/<Dial\s/.test(leer));
  ok("… und kein leeres callerId-Attribut", !/callerId=""/.test(leer));
  ok("… sondern eine Ansage, die den Grund nennt",
    /keine Absendernummer hinterlegt/.test(leer));
  ok("… und Auflegen statt stiller Stille", /<Hangup\/>/.test(leer));

  const schief = twimlAusgehend({ ...basis, von: "030901820" });
  ok("Eine Nummer ohne Ländervorwahl wird abgelehnt", !/<Dial\s/.test(schief));
  ok("… mit Hinweis auf die internationale Schreibweise",
    /internationale[nr]? Schreibweise/.test(schief));

  const ohneZiel = twimlAusgehend({ ...basis, an: "", von: "+4930901820950" });
  ok("Ohne Zielnummer KEIN Dial", !/<Dial\s/.test(ohneZiel));
  ok("… mit dem Rat, neu zu laden", /neu laden/.test(ohneZiel));

  const gut = twimlAusgehend({ ...basis, von: "+4930901820950" });
  ok("Mit beiden Nummern wird gewählt", /<Dial\s/.test(gut) && /<Number>\+4930111111111<\/Number>/.test(gut));
  ok("… mit gefülltem callerId", /callerId="\+4930901820950"/.test(gut));
  ok("… mit Aufnahme-Rückruf", /recordingStatusCallback="https:\/\/x\/a"/.test(gut));

  const sQ = datei("client/src/components/Softphone.tsx");
  ok("Der Browser sendet „An“, nicht das reservierte „To“",
    /params: \{ An: j\.nummer, Ziel: j\.nummer \}/.test(sQ) && !/params: \{ To:/.test(sQ));
  const telQ = datei("server/routes/fiaon-telefonie.ts");
  ok("Die TwiML-Route liest An zuerst",
    /b\?\.An \|\| b\?\.Ziel \|\| b\?\.PhoneNumber \|\| b\?\.To/.test(telQ));
  const dQ = datei("server/lib/fiaon-telefon-diagnose.ts");
  ok("Die Diagnose zeigt die Probeantwort (Schritt 9)", /nr: 9,/.test(dQ));
  ok("… und erkennt ein leeres callerId", /callerId=""/.test(dQ));
  ok("Der Telefonknopf steht 12 px über der Kante", /bottom: 12,/.test(sQ));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("2. Mail: getippte Adresse geht nicht verloren");
  // ═══════════════════════════════════════════════════════════════════════
  const mQ = datei("client/src/pages/mail-zentrale.tsx");
  ok("Es gibt eine gemeinsame Übernahme-Funktion",
    /const adresseUebernehmen = \(still = false\): boolean =>/.test(mQ));
  ok("Enter übernimmt", /e\.key !== "Enter" && e\.key !== "," && e\.key !== ";"/.test(mQ));
  ok("… Komma und Semikolon ebenfalls", /e\.key !== ","/.test(mQ));
  ok("… das Verlassen des Feldes ebenfalls",
    /onBlur=\{\(\) => \{[\s\S]{0,260}adresseUebernehmen\(true\)/.test(mQ));
  ok("DER BUG: das Senden übernimmt jetzt auch",
    /if \(!adresseUebernehmen\(\)\) return;\n    setBusy\("vorschau"\)/.test(mQ));
  ok("Ein Tippfehler bekommt einen Hinweis AM FELD",
    /setFeldHinweis/.test(mQ) && /keine vollständige E-Mail-Adresse/.test(mQ));
  ok("… und beim Verlassen nur, wenn ein @ drin war",
    /if \(!still \|\| wert\.includes\("@"\)\)/.test(mQ));
  ok("Ein angehängtes Komma wird abgeschnitten", /replace\(\/\[,;\]\+\$\/, ""\)/.test(mQ));

  // Die Prüfung der Adresslogik selbst — dieselbe Regel wie im Client.
  const gueltig = (w: string) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(w.trim().replace(/[,;]+$/, ""));
  for (const [wert, soll] of [
    ["kunde@example.de", true],
    ["kunde@example.de,", true],
    ["kunde@example", false],
    ["kunde@", false],
    ["Müller", false],
    ["a@b.co", true],
    ["", false],
  ] as const) {
    gleich(`„${wert}" ${soll ? "gilt" : "gilt nicht"}`, gueltig(wert), soll);
  }

  ok("Die Gruppenwahl ist eine FiaonEbene, kein freies Popover",
    /<FiaonEbene\s+offen=\{gruppenWahl\}/.test(mQ));
  const eQ = datei("client/src/components/FiaonEbene.tsx");
  ok("Ebenen haben eine Höhenbegrenzung mit innerem Rollen",
    /max-height: min\(/.test(eQ));
  ok("… und auf 380 px 92 vh", /max-height: 92vh/.test(eQ));

  // ── KI: der Grund, nicht „nicht verfügbar" ────────────────────────────
  const { kiEntwurf } = await import("../server/lib/fiaon-mail-ki");
  const echt = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  const ohneKey = await kiEntwurf("entwurf", "kunde hat gezahlt, beleg fehlt");
  ok("Fehlt der Schlüssel, sagt es das",
    !ohneKey.ok && /fehlt der Schlüssel OPENAI_API_KEY/.test(ohneKey.grund ?? ""), ohneKey.grund);
  process.env.OPENAI_API_KEY = "sk-proj-absichtlich-falsch";
  const falsch = await kiEntwurf("entwurf", "kunde hat gezahlt, beleg fehlt");
  ok("Ein ungültiger Schlüssel nennt den HTTP-Code",
    !falsch.ok && /HTTP 401/.test(falsch.grund ?? ""), falsch.grund);
  process.env.OPENAI_API_KEY = echt;
  ok("Die Oberfläche rendert den Grund als Karte",
    /Der Entwurf ist nicht entstanden/.test(mQ) && /\{kiFehler\}/.test(mQ));
  ok("… mit Zusatz bei 401", /Die KI antwortete mit HTTP 401/.test(mQ));
  ok("Ein leerer Entwurf gilt NICHT als Erfolg",
    /Die KI hat einen leeren Entwurf geliefert/.test(datei("server/lib/fiaon-mail-ki.ts")));
  ok("Der Admin hat einen eigenen KI-Weg",
    /admin\/mail\/zentrale\/ki/.test(datei("server/routes/fiaon-mail.ts")));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("3. Space v5: die Blasen-Bühne");
  // ═══════════════════════════════════════════════════════════════════════
  const spQ = datei("client/src/pages/agent/space.tsx");
  // 1. Bühne
  ok("Bühne: Verlauf von Weiß nach CI-Hellblau, kein Navy-Vollton",
    /rgba\(255,255,255,\.85\) 0%/.test(spQ)
    && /rgba\(219,232,251,\.65\) 100%/.test(spQ)
    && !/linear-gradient\(178deg, rgba\(13,28,63/.test(spQ));
  ok("Keine Sternkörnung mehr", !/Sternkörnung/.test(spQ) || !/radial-gradient\(1\.1px/.test(spQ));
  ok("Die helle Wäsche des Raums ist im Space aus",
    /\.fi-raum-waesche \{ display: none; \}/.test(spQ));
  // 2. Blase
  ok("Radius 28", /border-radius: 28px;/.test(spQ));
  ok("Glas: blur 20 px", /backdrop-filter: blur\(20px\) saturate\(160%\)/.test(spQ));
  ok("Fläche 72 % Weiß", /background: rgba\(255,255,255,\.72\)/.test(spQ));
  ok("Haarlinie oben als Lichtkante",
    /\.fi-sp-karte::before/.test(spQ) && /rgba\(255,255,255,\.9\) 22%/.test(spQ));
  ok("Zweistufiger Blau-Schatten",
    /0 2px 8px -2px rgba\(29,78,216,\.1\)/.test(spQ) && /0 18px 44px -20px rgba\(29,78,216,\.24\)/.test(spQ));
  ok("Innenabstand 24", /border-radius: 28px;\n  padding: 24px;/.test(spQ));
  ok("Eintritt: Aufsteigen und Aufblühen, 450 ms",
    /fiSpBluehen 450ms/.test(spQ) && /scale\(\.97\)/.test(spQ));
  ok("Hover hebt 4 px", /\.fi-sp-post:hover \{\n    transform: translateY\(-4px\)/.test(spQ));
  ok("Avatar 44 mit Verlaufs-Ring",
    /size=\{44\}/.test(spQ) && /0 0 0 3\.5px rgba\(59,130,246,\.42\)/.test(spQ));
  // 3. Akzent
  ok("Kennmarken tragen einen Verlauf",
    /\.fi-sp-artmarke \{[\s\S]{0,400}background: linear-gradient\(158deg, #3b82f6, #1d4ed8\)/.test(spQ));
  ok("… mit erzwungen weißer Schrift", /color: #fff !important;/.test(spQ));
  ok("… und KEINER Inline-Farbe mehr",
    !/className="fi-sp-artmarke" style=\{\{ color:/.test(spQ));
  ok("Der Systemavatar bleibt navy — das einzige dunkle Element",
    /\.fi-sp-systemavatar[\s\S]{0,200}#14264f, #0a1a3c 62%, #071129/.test(spQ));
  // 4. Komposer
  ok("Komposer wächst beim Fokus", /\.fi-sp-komposer-gross[\s\S]{0,120}scale\(1\.008\)/.test(spQ));
  ok("Veröffentlichen mit Verlauf und Glanzkante",
    /\.fi-sp-senden[\s\S]{0,300}linear-gradient\(178deg, #3b82f6, #1d4ed8 58%/.test(spQ)
    && /inset 0 1px 0 rgba\(255,255,255,\.38\)/.test(spQ));
  // 5. Spalten
  ok("Feed 720 px mittig", /grid-template-columns: 260px minmax\(480px, 720px\) 280px/.test(spQ));
  ok("Profil-Avatar 72 px", /size=\{72\}/.test(spQ));
  ok("Auf 380 px randnah, 12 px", /padding: 16px 12px 0/.test(spQ));
  ok("Kennzahlen als Wischleiste über dem Feed",
    /\.fi-sp-tageskopf[\s\S]{0,200}scroll-snap-type: x mandatory/.test(spQ));
  // 6. Pin-Leiste
  ok("Pin-Leiste einzeilig im Ruhezustand", /\.fi-sp-pinreihe \{/.test(spQ));
  ok("… und nur 40 px hoch je Zeile", /min-height: 40px;/.test(spQ));
  ok("… bei zwei Pins, nicht drei",
    /alle\.filter\(\(p\) => p\.angepinnt\)\.slice\(0, 2\)/.test(spQ));
  ok("Aufgeklappt steht sie untereinander",
    /\.fi-sp-pinreihe:has\(\.fi-sp-pinzeile\[data-offen="1"\]\) \{ flex-direction: column; \}/.test(spQ));
  // 7. Abstände
  ok("32 px Luft unter der Kopfzeile", /padding: 32px 20px 0/.test(spQ));
  ok("20 px zwischen Blasen",
    /\.fi-sp-post \{\n  margin-bottom: 20px;/.test(spQ) && /gap: 20px;/.test(spQ));
  ok("Bestätigung an der Karte (aus v4)", /fi-sp-bestaetigung/.test(spQ));
  ok("Reaktionszähler federt einmal",
    /fiSpFeder 460ms cubic-bezier\(\.28,1\.6,\.4,1\)/.test(spQ));
  // 8. Beide Rollen
  const app = datei("client/src/App.tsx");
  ok("/admin landet im Space", /path="\/admin" component=\{\(\) => <Umleitung nach="\/admin\/space"/.test(app));
  ok("Beide Rollen, eine Datei", /const basisWeg = alsAdmin/.test(spQ));
  ok("Der Verwaltungsbereich hat eine eigene Umbruchschwelle",
    /max-width: 1580px[\s\S]{0,160}\.admin-flaeche \.fi-sp-buehne/.test(spQ));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("4. Vertriebsliste entzerrt");
  // ═══════════════════════════════════════════════════════════════════════
  const vQ = datei("client/src/pages/agent/vertrieb.tsx");
  ok("Zwei Zeilen: Name oben, Zahlen unten", /\.fi-vb-kopf/.test(vQ) && /\.fi-vb-zahlen/.test(vQ));
  ok("Der Name bricht NICHT um, er wird gekürzt",
    /\.fi-vb-name \{[\s\S]{0,400}white-space: nowrap; overflow: hidden; text-overflow: ellipsis/.test(vQ));
  ok("Zahlen als beschriftete Paare mit festem Abstand",
    /\.fi-vb-paar/.test(vQ) && /\.fi-vb-zahlen \{\n                display: flex; align-items: baseline; gap: 16px/.test(vQ));
  ok("Auf 380 px als 2×2-Raster",
    /grid-template-columns: 1fr 1fr;\n                  gap: 6px 12px;/.test(vQ));
  ok("Mindesthöhe je Zeile", /min-height: 66px;/.test(vQ));
  ok("Der Chevron sitzt vertikal zentriert", /\.fi-vb-winkel[\s\S]{0,80}align-self: center/.test(vQ));
  ok("Die Chips-Leiste macht dem Telefonknopf Platz",
    /\.fi-vb-chips \{ padding-right: 82px; \}/.test(vQ));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("5. Menü-Ordnung");
  // ═══════════════════════════════════════════════════════════════════════
  const navQ = datei("client/src/pages/agent/shared.tsx");
  const ordnung: string[] = [];
  for (const m of navQ.matchAll(/\{ href: "\/agent\/[a-z-]+", label: "([^"]+)"/g)) ordnung.push(m[1]);
  const soll = ["Space", "Start", "Kunden", "Mail", "Aufgaben", "Kalender", "Verdienst"];
  gleich("Die ersten sieben Punkte in der geforderten Reihenfolge",
    ordnung.slice(0, 7).join(" · "), soll.join(" · "));
  ok("Mail steht VOR Aufgaben", ordnung.indexOf("Mail") < ordnung.indexOf("Aufgaben"));
  ok("Space steht ganz vorn", ordnung[0] === "Space");
  // Es gibt nur EINE Definition — mobil und Desktop teilen sie.
  gleich("Nur eine Navigationsdefinition",
    (navQ.match(/label: "Aufgaben"/g) || []).length, 1);
  ok("Die mobile Leiste liest dieselbe Liste",
    /NAV\b|MENUE\b|navPunkte/.test(navQ));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("6. Gegenprobe: nichts geschrieben");
  // ═══════════════════════════════════════════════════════════════════════
  const [nachher] = await sqlPool`
    SELECT (SELECT COUNT(*) FROM fiaon_posts)::int AS posts,
           (SELECT COUNT(*) FROM fiaon_mail_log)::int AS mails
  `;
  ok(`Keine Beiträge verloren (${vorher.posts} → ${nachher.posts})`,
    Number(nachher.posts) >= Number(vorher.posts));
  gleich("Keine Mail geschrieben", nachher.mails, vorher.mails);

  log(`\n══ Ergebnis: ${bestanden} bestanden, ${fehlgeschlagen} fehlgeschlagen ══\n`);
  if (fehlgeschlagen > 0) { log("Fehlgeschlagen:"); for (const f of fehler) log(`  · ${f}`); }
  await sqlPool.end();
  process.exit(fehlgeschlagen > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("\nPrüfstand abgebrochen:", err);
  await sqlPool.end().catch(() => {});
  process.exit(1);
});
