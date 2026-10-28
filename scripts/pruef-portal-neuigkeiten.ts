// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-456 — „NEU FÜR SIE" IM GLOBAL-PORTAL (reine Funktionen + Quelltext, ohne Datenbank)
//
//   env -i HOME="$HOME" PATH="$PATH" TZ=Europe/Berlin CRONS=aus DOTENV_CONFIG_PATH=/dev/null \
//     DATABASE_URL=postgresql://pruef@127.0.0.1:9/keine node_modules/.bin/tsx scripts/pruef-portal-neuigkeiten.ts
//
// Prüft: welche Neuigkeiten aus welchen Daten entstehen, die Zeitgrenze (gesehen / 14 Tage / Akte jünger),
// Sortierung (handeln → Antwort → jüngstes), ein Thema = eine Zeile, Texte gesiezt und ohne Interna/Partnernamen,
// DE und EN, die ITIN nie als Wert — und im Quelltext: Vorschau vermerkt nichts, Lesen schreibt nichts.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from "node:fs";
import {
  GLOBAL_NEUIGKEITEN_ERSTFENSTER_TAGE, GLOBAL_NEUIGKEITEN_MAX, GLOBAL_NEUIGKEITEN_WOERTER, globalNeuigkeitenBauen, globalNeuigkeitenGrenze, globalNeuigkeitSatzSauber,
  type GlobalNeuigkeit, type NeuigkeitenQuelle,
} from "../shared/fiaon-global-neuigkeiten";
import { GLOBAL_STATION_VERLAUF } from "../shared/fiaon-global-stationen";

let gut = 0; const rot: string[] = [];
function ok(bed: boolean, text: string, fund?: unknown) {
  if (bed) { gut++; console.log(`  ok    ${text}`); return; }
  rot.push(text); console.log(`  ROT   ${text}${fund !== undefined ? `  →  ${JSON.stringify(fund).slice(0, 600)}` : ""}`);
}
const kopf = (x: string) => console.log(`\n── ${x} ${"─".repeat(Math.max(0, 70 - x.length))}`);

const JETZT = "2026-10-29T10:00:00.000Z";
const vor = (stunden: number) => new Date(Date.parse(JETZT) - stunden * 3600_000).toISOString();
const GRENZE = vor(48);
const leer = (): NeuigkeitenQuelle => ({ grenze: GRENZE, verlauf: [], dokumente: [], nachrichten: [], plus: {} });
const PLUS = { usTelefon: "+13075550148", usAdresse: "412 W 17th Street, Suite 210\nCheyenne, WY 82001", ein: "12-3456789", aktenzeichen: "2026-001234567", duns: "12-345-6789", itinMaske: "•••-••-4321", itinVorhanden: true, agentAdresse: "30 N Gould St\nSheridan, WY 82801" };
const ZIELE = new Set(["uebersicht", "fahrplan", "gesellschaft", "tresor", "post", "adressen", "anfragen", "kapital"]);
let vid = 1; let did = 1;
const station = (feld: string, am: string, s: "de" | "en" = "de") => ({ id: vid++, art: "station", text: (GLOBAL_STATION_VERLAUF as any)[feld][s], am });
const doc = (art: string, am: string, extra: Partial<NeuigkeitenQuelle["dokumente"][number]> = {}) => ({ id: did++, von: "fiaon" as const, art, am, sichtbar: true, gelesen: false, ...extra });

// ── 1 ZEITGRENZE ─────────────────────────────────────────────────────────────
kopf("1  Zeitgrenze");
{
  const g1 = globalNeuigkeitenGrenze({ gesehenAm: vor(5), akteSeit: vor(24 * 100), jetzt: JETZT });
  ok(g1 === vor(5), "gesehen gesetzt → genau dieser Zeitpunkt", g1);
  const g2 = globalNeuigkeitenGrenze({ gesehenAm: null, akteSeit: vor(24 * 100), jetzt: JETZT });
  ok(g2 === vor(24 * GLOBAL_NEUIGKEITEN_ERSTFENSTER_TAGE), `erstes Öffnen, alte Akte → höchstens ${GLOBAL_NEUIGKEITEN_ERSTFENSTER_TAGE} Tage zurück`, g2);
  const g3 = globalNeuigkeitenGrenze({ gesehenAm: null, akteSeit: vor(24 * 3), jetzt: JETZT });
  ok(g3 === vor(24 * 3), "erstes Öffnen, Akte 3 Tage alt → seit Einrichtung der Akte (das Spätere)", g3);
  const g4 = globalNeuigkeitenGrenze({ gesehenAm: "kaputt", akteSeit: null, jetzt: JETZT });
  ok(g4 === vor(24 * 14), "unlesbare Werte → 14-Tage-Fenster", g4);
  // Altes wird nicht gezeigt: eine Nummer von vor 20 Tagen beim allerersten Öffnen.
  const q = { ...leer(), grenze: g2, verlauf: [station("usTelefon", vor(24 * 20))], plus: PLUS };
  ok(globalNeuigkeitenBauen(q, "de").liste.length === 0, "erstes Öffnen: Nummer von vor 20 Tagen flutet nicht");
  const q2 = { ...leer(), grenze: vor(5), verlauf: [station("usTelefon", vor(6))], plus: PLUS };
  ok(globalNeuigkeitenBauen(q2, "de").liste.length === 0, "vor dem letzten „Gesehen“ → nicht neu");
  const q3 = { ...leer(), grenze: vor(5), verlauf: [station("usTelefon", vor(5))], plus: PLUS };
  ok(globalNeuigkeitenBauen(q3, "de").liste.length === 0, "genau auf der Grenze → nicht neu (streng danach)");
}

// ── 2 EINE NEUIGKEIT: US-NUMMER ──────────────────────────────────────────────
kopf("2  Eine Neuigkeit: US-Nummer groß");
{
  const e = globalNeuigkeitenBauen({ ...leer(), verlauf: [station("usTelefon", vor(2))], plus: PLUS }, "de");
  const n = e.liste[0];
  ok(e.liste.length === 1 && n.art === "telefon", "Stationszeile „Telefon eingerichtet“ → Neuigkeit telefon", e);
  ok(n?.ziel === "adressen", "Ziel: Nummer & Adressen", n?.ziel);
  ok(n?.gross?.wert === "+1 307 555 0148", "großer Wert = die Nummer, lesbar formatiert", n?.gross);
  ok(n?.titel === "Ihre US-Telefonnummer ist da", "Titel kurz und gesiezt", n?.titel);
  ok(n?.am === vor(2), "Zeitpunkt der Quelle", n?.am);
  // Stationszeile ohne Wert in plus (geleert): Neuigkeit ja, ohne großen Wert.
  const o = globalNeuigkeitenBauen({ ...leer(), verlauf: [station("usTelefon", vor(2))] }, "de").liste[0];
  ok(!!o && !o.gross, "Wert inzwischen geleert → Zeile ohne großen Wert (nie ein leerer Wert)", o);
}

// ── 3 MEHRERE: Nummer + Articles + EIN (ein Thema = eine Zeile) ─────────────
kopf("3  Mehrere: Nummer + Articles + EIN, ohne Doppelte");
{
  const q: NeuigkeitenQuelle = {
    ...leer(), plus: PLUS,
    verlauf: [
      station("usTelefon", vor(30)), station("ein", vor(3)),
      { id: vid++, art: "schritt", text: "EIN erteilt.", am: vor(3) },
      { id: vid++, art: "schritt", text: "Erledigt: EIN der Gesellschaft.", am: vor(3) },
      { id: vid++, art: "schritt", text: "Nächster Schritt: Wir bereiten Ihr Konto vor.", am: vor(1) },
      { id: vid++, art: "dokument", text: "Sie haben ein Dokument hochgeladen: Reisepass (pass.pdf).", am: vor(1) },
    ],
    dokumente: [doc("gruendungsurkunde", vor(10)), doc("ein_brief", vor(2)), { ...doc("reisepass", vor(1)), von: "kunde" }],
  };
  const e = globalNeuigkeitenBauen(q, "de");
  const arten = e.liste.map((x) => x.art);
  ok(e.liste.length === 3, "genau drei Zeilen (Telefon, Urkunde, EIN)", e.liste.map((x) => [x.art, x.titel]));
  ok(arten.includes("telefon") && arten.includes("urkunde") && arten.includes("ein"), "Arten telefon, urkunde, ein", arten);
  const ein = e.liste.find((x) => x.art === "ein");
  ok(ein?.gross?.wert === "12-3456789" && ein?.ziel === "gesellschaft", "EIN: der Wert gewinnt gegen Schreiben und „Erledigt“ (Ziel Firmendaten)", ein);
  ok(ein?.am === vor(2), "EIN: Zeitpunkt = jüngste Quelle (das Schreiben)", ein?.am);
  const urk = e.liste.find((x) => x.art === "urkunde");
  ok(urk?.ziel === "tresor" && /Gründungsurkunde/.test(urk.titel) && /Articles of Organization/.test(urk.satz), "Urkunde → Tresor, nennt die Articles of Organization", urk);
  ok(e.liste.map((x) => x.art).join(",") === "ein,urkunde,telefon", "Reihenfolge: jüngstes zuerst", e.liste.map((x) => x.art));
  ok(!e.liste.some((x) => /Nächster Schritt|hochgeladen/.test(x.titel + x.satz)), "„Nächster Schritt“ und eigene Uploads erscheinen nicht");
  // Nur das EIN-Schreiben neu (Wert älter) → Zeile führt in den Tresor.
  const nur = globalNeuigkeitenBauen({ ...leer(), plus: PLUS, dokumente: [doc("ein_brief", vor(2))] }, "de").liste[0];
  ok(nur?.art === "ein" && nur.ziel === "tresor" && !nur.gross, "nur das EIN-Schreiben neu → „liegt bereit“, Ziel Tresor", nur);
}

// ── 4 WEITERE QUELLEN ────────────────────────────────────────────────────────
kopf("4  Adresse, Agent, Eintragung, ITIN, D-U-N-S, Konto, Schritte, Weg, Kapital");
{
  const q: NeuigkeitenQuelle = {
    ...leer(), plus: PLUS,
    verlauf: [
      station("usAdresse", vor(9)), station("agentAdresse", vor(8)), station("aktenzeichen", vor(7)), station("itin", vor(6)), station("duns", vor(5)), station("kontoEroeffnetAm", vor(4)),
      { id: vid++, art: "schritt", text: "Erledigt: Gesellschaft eingetragen.", am: vor(7) },
      { id: vid++, art: "schritt", text: "Erledigt: Name geprüft.", am: vor(20) },
      { id: vid++, art: "schritt", text: "Beantragt: ITIN.", am: vor(21) },
      { id: vid++, art: "etappe", text: "Etappe 2 hat begonnen: Erste Firmenkarte.", am: vor(22) },
      { id: vid++, art: "kapital", text: "Karte: Zugesagt.", am: vor(23) },
    ],
  };
  const e = globalNeuigkeitenBauen(q, "de", 50);
  const by = (a: string) => e.liste.find((x) => x.art === a);
  ok(by("adresse")?.gross?.wert === PLUS.usAdresse && by("adresse")?.ziel === "adressen", "Geschäftsadresse → Nummer & Adressen, mehrzeilig groß", by("adresse"));
  ok(by("agent")?.ziel === "adressen" && !/northwest/i.test(JSON.stringify(by("agent"))), "Agent: Anschrift für Behördenpost, ohne Anbieternamen", by("agent"));
  ok(by("eingetragen")?.gross?.wert === PLUS.aktenzeichen && e.liste.filter((x) => x.art === "eingetragen").length === 1, "Eintragung: einmal, mit Registernummer", e.liste.filter((x) => x.art === "eingetragen"));
  const itin = by("itin");
  ok(!!itin && !itin.gross && !/4321|\d{3}-\d{2}-\d{4}/.test(JSON.stringify(itin)), "ITIN: Neuigkeit ohne Wert und ohne Maske", itin);
  ok(by("duns")?.gross?.wert === PLUS.duns, "D-U-N-S groß", by("duns"));
  ok(by("konto")?.ziel === "kapital" && !by("konto")?.gross, "Konto eröffnet → Banken & Kapital, nie eine Kontonummer", by("konto"));
  ok(by("schritt")?.titel === "Erledigt: Firmenname gesichert" && by("schritt")?.ziel === "fahrplan", "„Erledigt: Name geprüft.“ → in Kundenworten, Ziel Ihr Weg", by("schritt"));
  ok(by("beantragt")?.titel === "Beantragt: Ihre persönliche Steuernummer", "„Beantragt: ITIN.“ → eigene Zeile", by("beantragt"));
  ok(by("weg")?.satz === "Etappe 2 hat begonnen: Erste Firmenkarte." && by("weg")?.ziel === "fahrplan", "Etappe → „Ihr Weg geht weiter“ mit dem Satz", by("weg"));
  ok(by("kapital")?.ziel === "kapital", "Kapital-Zusage → Banken & Kapital", by("kapital"));
  ok(e.liste.every((x) => ZIELE.has(x.ziel)), "jedes Ziel ist eine Seite des Portals", e.liste.map((x) => x.ziel));
  // „Adresse und Telefon“ erledigt ohne Nummer → Adresse
  const ad = globalNeuigkeitenBauen({ ...leer(), plus: { usAdresse: PLUS.usAdresse }, verlauf: [{ id: vid++, art: "schritt", text: "Erledigt: US-Adresse und Telefonnummer.", am: vor(1) }] }, "de").liste[0];
  ok(ad?.art === "adresse", "„US-Adresse und Telefonnummer“ erledigt ohne Nummer → Adresse", ad);
}

// ── 5 DOKUMENTE, POST, UNTERSCHRIFT, BITTE NEU, ANTWORT + SORTIERUNG ─────────
kopf("5  Dokumente, Post, Unterschrift, bitte neu, Antwort — Sortierung");
{
  const q: NeuigkeitenQuelle = {
    ...leer(), plus: PLUS,
    verlauf: [station("usTelefon", vor(1))],
    dokumente: [
      doc("info", vor(5), { titel: "Anleitung eSIM einrichten" }),
      doc("sonstiges", vor(6), { titel: "Tello Zugangsdaten" }),
      doc("post", vor(7)), doc("post", vor(8)),
      doc("vollmacht", vor(20), { unterschriftGefordert: true }),
      doc("steuer", vor(19), { unterschriftGefordert: true, unterschrieben: true }),
      doc("info", vor(4), { gelesen: true, titel: "Schon gelesen" }),
      doc("info", vor(4), { sichtbar: false, titel: "Intern" }),
      doc("info", vor(24 * 9), { titel: "Zu alt" }),
      { ...doc("reisepass", vor(30)), von: "kunde", abgelehntAm: vor(10), abgelehntGrund: "Foto statt Scan — bitte als PDF-Scan", ablehnungOffen: true },
      { ...doc("adressnachweis", vor(30)), von: "kunde", abgelehntAm: vor(10), abgelehntGrund: "unscharf", ablehnungOffen: false },
    ],
    nachrichten: [{ id: 1, von: "fiaon", am: vor(3), gelesen: false }, { id: 2, von: "fiaon", am: vor(2), gelesen: false }, { id: 3, von: "fiaon", am: vor(2), gelesen: true }, { id: 4, von: "kunde", am: vor(1), gelesen: false }],
  };
  const e = globalNeuigkeitenBauen(q, "de", 50);
  const arten = e.liste.map((x) => x.art);
  ok(arten.slice(0, 2).sort().join(",") === "bitte_neu,unterschrift", "zuerst, was der Kunde tun muss (unterschreiben, neu einreichen)", arten);
  ok(arten[2] === "antwort", "dann die Antworten", arten);
  ok(arten.slice(3).join(",") === "telefon,dokument,post", "dann das Übrige, jüngstes zuerst", arten);
  const ant = e.liste.find((x) => x.art === "antwort");
  ok(ant?.titel === "2 neue Antworten auf Ihre Anfragen" && ant.ziel === "anfragen", "zwei ungelesene Antworten (gelesene + eigene zählen nicht)", ant);
  const u = e.liste.filter((x) => x.art === "unterschrift");
  ok(u.length === 1 && u[0].titel === "Bitte unterschreiben: Vollmacht" && u[0].handeln === true, "nur die offene Unterschrift, mit handeln-Marke", u);
  const lang = globalNeuigkeitenBauen({ ...leer(), dokumente: [doc("vollmacht", vor(1), { unterschriftGefordert: true, titel: "Ergänzung zu Ihrem Auftrag – Ihre Befugnisse für FIAON" })] }, "de").liste[0];
  ok(lang?.titel === "Ein Dokument wartet auf Ihre Unterschrift" && lang.satz.startsWith("Ergänzung zu Ihrem Auftrag"), "langer Dokumenttitel → kurzer Titel, Dokumentname im Satz", lang);
  const kurzT = globalNeuigkeitenBauen({ ...leer(), dokumente: [doc("vollmacht", vor(1), { unterschriftGefordert: true, titel: "Vollmacht für die Bank" })] }, "de").liste[0];
  ok(kurzT?.titel === "Bitte unterschreiben: Vollmacht für die Bank", "kurzer Dokumenttitel → im Titel", kurzT);
  const bn = e.liste.filter((x) => x.art === "bitte_neu");
  ok(bn.length === 1 && bn[0].titel === "Bitte neu einreichen: Reisepass" && bn[0].satz.startsWith("Foto statt Scan"), "„bitte neu“ nur, solange offen — mit dem Grund", bn);
  const d = e.liste.find((x) => x.art === "dokument");
  ok(d?.titel === "2 neue Dokumente im Tresor", "zwei neue Dokumente (gelesen/intern/zu alt zählen nicht)", d);
  ok(!!d && /Anleitung eSIM einrichten/.test(d.satz) && !/tello/i.test(d.satz) && /Sonstiges Dokument/.test(d.satz), "Titel aus dem Tresor — mit Partnernamen → die Art statt des Titels", d?.satz);
  ok(e.liste.find((x) => x.art === "post")?.titel === "2 neue Briefe für Ihre Gesellschaft", "Post zusammengefasst → Briefkasten", e.liste.find((x) => x.art === "post"));
  ok(e.liste.find((x) => x.art === "post")?.ziel === "post", "Post → Seite Post");
}

// ── 6 INTERNA, SIE-FORM, ENGLISCH ────────────────────────────────────────────
kopf("6  Ohne Interna, gesiezt, Englisch");
{
  const frei = globalNeuigkeitenBauen({ ...leer(), verlauf: [{ id: vid++, art: "notiz", text: "Ihr Agent Northwest hat die Unterlagen bestätigt.", am: vor(1) }] }, "de").liste[0];
  ok(frei?.art === "mitteilung" && frei.satz === "Ihr Ansprechpartner hat etwas für Sie notiert.", "Notiz mit Anbieternamen → fester Satz des Hauses", frei);
  const fein = globalNeuigkeitenBauen({ ...leer(), verlauf: [{ id: vid++, art: "notiz", text: "Ihre Unterlagen sind vollständig — danke.", am: vor(1) }] }, "de").liste[0];
  ok(fein?.satz === "Ihre Unterlagen sind vollständig — danke.", "saubere Notiz → ihr Satz");
  ok(!globalNeuigkeitSatzSauber("Tello eSIM") && !globalNeuigkeitSatzSauber("Provision 30 %") && globalNeuigkeitSatzSauber("Ihre Nummer steht."), "Interna-Wand: Tello, Provision gesperrt");
  // Alles, was je entstehen kann: DE + EN, alle Themen.
  const alles: NeuigkeitenQuelle = {
    ...leer(), plus: PLUS,
    verlauf: [
      ...Object.keys(GLOBAL_STATION_VERLAUF).map((f) => station(f, vor(1))),
      { id: vid++, art: "schritt", text: "Erledigt: Operating Agreement unterschrieben.", am: vor(2) },
      { id: vid++, art: "schritt", text: "Erledigt: Frühere Gesellschaft gelöscht.", am: vor(2) },
      { id: vid++, art: "schritt", text: "Beantragt: US-Geschäftskonto.", am: vor(2) },
      { id: vid++, art: "notiz", text: "x", am: vor(2) },
    ],
    dokumente: [doc("gruendungsurkunde", vor(1)), doc("itin_bescheid", vor(1)), doc("post", vor(1)), doc("info", vor(1)), doc("vollmacht", vor(1), { unterschriftGefordert: true }),
      { ...doc("reisepass", vor(30)), von: "kunde", abgelehntAm: vor(1), abgelehntGrund: null, ablehnungOffen: true }],
    nachrichten: [{ id: 9, von: "fiaon", am: vor(1), gelesen: false }],
  };
  const SIE_DU = /\b(du|dich|dir|dein|deine|deinen|deinem|deiner|euch|euer)\b/i;
  const VERBOTEN = /northwest|tello|registered agents inc|incfile|provision|intern\b|bank-?tauglich|garant/i;
  for (const s of ["de", "en"] as const) {
    const l: GlobalNeuigkeit[] = globalNeuigkeitenBauen(alles, s, 99).liste;
    ok(l.length >= 15, `${s}: alle Themen entstehen (${l.length})`, l.map((x) => x.art));
    const texte = l.flatMap((x) => [x.titel, x.satz, x.gross?.titel ?? ""]);
    ok(!texte.some((x) => VERBOTEN.test(x)), `${s}: keine Partner- oder Hausinterna`, texte.filter((x) => VERBOTEN.test(x)));
    if (s === "de") ok(!texte.some((x) => SIE_DU.test(x)), "de: durchgehend gesiezt", texte.filter((x) => SIE_DU.test(x)));
    if (s === "de") ok(texte.filter((x) => /\b(Sie|Ihr|Ihre|Ihren|Ihrem|Ihrer)\b/.test(x)).length >= 10, "de: spricht den Kunden mit Sie/Ihr an");
    if (s === "en") ok(!texte.some((x) => /[äöüß]|\b(Ihre|Sie|und|der|die)\b/.test(x)), "en: kein deutsches Wort", texte.filter((x) => /[äöüß]|\b(Ihre|Sie|und|der|die)\b/.test(x)));
    ok(l.every((x) => x.titel.length <= 60 && x.satz.length <= 181), `${s}: Titel kurz (≤ 60), Satz ≤ 180`, l.filter((x) => x.titel.length > 60 || x.satz.length > 181).map((x) => x.titel));
    ok(l.every((x) => ZIELE.has(x.ziel)), `${s}: jedes Ziel gültig`);
    ok(new Set(l.map((x) => x.id)).size === l.length, `${s}: jede id einmal`);
  }
  // EN-Akte: die englischen Stationssätze werden genauso erkannt.
  const en = globalNeuigkeitenBauen({ ...leer(), plus: PLUS, verlauf: [station("usTelefon", vor(1), "en"), { id: vid++, art: "schritt", text: "EIN issued.", am: vor(1) }] }, "en").liste;
  ok(en.map((x) => x.art).sort().join(",") === "ein,telefon" && en.find((x) => x.art === "telefon")?.titel === "Your US phone number is ready", "EN-Akte: englische Sätze erkannt, englische Titel", en);
  const W = GLOBAL_NEUIGKEITEN_WOERTER;
  ok(W.de.titel === "Neu für Sie" && W.en.titel === "New for you" && W.de.verstanden === "Verstanden", "Fenster-Wörter DE/EN");
}

// ── 7 HÖCHSTZAHL ─────────────────────────────────────────────────────────────
kopf("7  Höchstzahl im Fenster");
{
  const q: NeuigkeitenQuelle = { ...leer(), plus: PLUS, verlauf: ["usTelefon", "usAdresse", "privatAdresse", "agentAdresse", "aktenzeichen", "ein", "itin", "duns"].map((f, i) => station(f, vor(i + 1))) };
  const e = globalNeuigkeitenBauen(q, "de");
  ok(e.liste.length === GLOBAL_NEUIGKEITEN_MAX && e.weitere === 2, `${GLOBAL_NEUIGKEITEN_MAX} Zeilen + „2 weitere“`, { n: e.liste.length, weitere: e.weitere });
  ok(globalNeuigkeitenBauen(leer(), "de").liste.length === 0, "ohne Quellen → leer (kein Fenster)");
}

// ── 8 QUELLTEXT: Vorschau vermerkt nichts, Lesen schreibt nichts ────────────
kopf("8  Quelltext: Vorschau, Lesen, Fenster");
{
  const route = readFileSync("server/routes/fiaon-global-bereich.ts", "utf8");
  const post = route.slice(route.indexOf('"/global/mein-auftrag/:ref/neuigkeiten/gesehen"'));
  const block = post.slice(0, post.indexOf("\n});"));
  ok(block.length > 0 && block.indexOf("istVorschau(req)") > -1 && block.indexOf("istVorschau(req)") < block.indexOf("globalNeuigkeitenGesehen"), "POST gesehen: Vorschau-Wand VOR dem Schreiben", block.slice(0, 400));
  ok(/zutritt\(req, res\)/.test(block), "POST gesehen: derselbe Zutritt wie das Portal");
  const lib = readFileSync("server/lib/fiaon-global-neuigkeiten.ts", "utf8");
  const lesen = lib.slice(lib.indexOf("export async function globalNeuigkeitenKunde"), lib.indexOf("export async function globalNeuigkeitenGesehen"));
  ok(!/UPDATE|INSERT|DELETE/i.test(lesen.replace(/\/\/.*$/gm, "")), "Lesen (globalNeuigkeitenKunde) enthält kein UPDATE/INSERT/DELETE");
  ok(/GREATEST\(COALESCE\(neuigkeiten_gesehen_am/.test(lib) && /Math\.min\(/.test(lib), "Gesehen geht nie zurück und nie über „jetzt“ hinaus");
  const bereich = readFileSync("server/lib/fiaon-global-bereich.ts", "utf8");
  ok(/ADD COLUMN IF NOT EXISTS neuigkeiten_gesehen_am TIMESTAMPTZ/.test(bereich), "Spalte per Laufzeit-DDL (ADD COLUMN IF NOT EXISTS)");
  const seite = readFileSync("client/src/pages/global-portal.tsx", "utf8");
  ok(/if \(vorschau \|\| !neuDaten\) return;/.test(seite) && /neuigkeiten"\) === "zeigen"/.test(seite), "Seite: Vorschau sendet kein „gesehen“; Fenster dort nur mit ?neuigkeiten=zeigen");
  const fenster = readFileSync("client/src/pages/global-portal-neuigkeiten.tsx", "utf8");
  ok(/aria-modal="true"/.test(fenster) && /aria-labelledby="gpneu-titel"/.test(fenster) && /"Escape"/.test(fenster) && /"Tab"/.test(fenster), "Fenster: aria-modal, Titel, Esc, Fokus gefangen");
  const css = readFileSync("client/src/styles/global-portal-neuigkeiten.css", "utf8");
  ok(/prefers-reduced-motion/.test(css) && /max-width: 640px/.test(css) && /min-height: 44px/.test(css), "CSS: Bewegung reduzieren, Handy-Blatt, Knöpfe ≥ 44 px");
  ok(!/font(-weight)?:\s*(600|700|800|900)\b|font:\s*(600|700|800|900)\s/.test(css), "CSS: keine Schrift 600+");
  const keyframes = css.match(/@keyframes[^{]+\{[^@]*?\}\s*\}/g) ?? [];
  ok(keyframes.length >= 5 && keyframes.every((k) => !/(width|height|top|left|margin|padding)\s*:/.test(k)), "Bewegung nur über transform/opacity (Keyframes)", keyframes.filter((k) => /(width|height|top|left|margin|padding)\s*:/.test(k)));
  ok(!/\b(gold|#d4af37|#c9a227)\b/i.test(css), "kein Gold");
}

console.log(`\nERGEBNIS: ${gut} grün, ${rot.length} rot`);
if (rot.length) { console.log(rot.map((x) => `  - ${x}`).join("\n")); process.exit(1); }
