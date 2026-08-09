// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: Feinschliff — die gemeldeten Bugs und der Ebenen-Standard
//
// Dieser Prüfstand prüft überwiegend QUELLTEXT. Das ist Absicht: Die gemeldeten
// Fehler waren keine Datenfehler, sondern Baufehler — ein nicht abonnierter
// Zustand, ein Menüpunkt auf die falsche Adresse, ein fehlender Knopf. Solche
// Fehler fängt man dort, wo sie entstehen.
//
// Was sich am Verhalten prüfen lässt (Filterzahlen, Admin-Sendegrenze,
// Mitarbeiter-Löschung), wird gegen echte Daten in einer zurückgerollten
// Transaktion geprüft.
//
//   npx tsx scripts/pruef-feinschliff.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";

const ECHT_MAKE = process.env.MAKE_WEBHOOK_URL;
process.env.MAKE_WEBHOOK_URL = "http://attrappe.pruefstand.invalid/keine-echten-mails";

import { existsSync, readFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import { brevoKlartext, brevoNichtEingerichtet } from "../server/lib/fiaon-brevo-fehler";
import { filterZahlen, kundenListe } from "../server/lib/fiaon-kundenzentrale";
import { GEDANKEN } from "../server/lib/fiaon-gedanken";
import {
  ABSTAND_MINUTEN, DICHTE_MAX, DICHTE_MIN, DICHTE_VORGABE,
  FENSTER_BIS, FENSTER_VON, tagesBauplan,
} from "../server/lib/fiaon-space-engine";
import { PIN_GRENZE } from "../server/routes/fiaon-space";

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
function gruppe(t: string): void { log(`\n── ${t} ${"─".repeat(Math.max(0, 50 - t.length))}`); }

class Zurueckrollen extends Error {}
const stempel = Date.now().toString(36).toUpperCase();

const datei = (p: string) => readFileSync(p, "utf8");

async function main(): Promise<void> {
  log("\n══ Prüfstand: Feinschliff ══\n");

  const [vorher] = await sqlPool`
    SELECT (SELECT COUNT(*) FROM fiaon_agents)::int AS agenten,
           (SELECT COUNT(*) FROM fiaon_commissions)::int AS provisionen,
           (SELECT COUNT(*) FROM fiaon_persons)::int AS personen
  `;

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("1. Bug: Filterklick ohne Wirkung");
  // ═══════════════════════════════════════════════════════════════════════
  const kunden = datei("client/src/pages/admin-kunden.tsx");
  ok("Die Seite abonniert den Suchteil der Adresse", /const suche = useSearch\(\)/.test(kunden));
  ok("… und leitet die Filter daraus ab", /new URLSearchParams\(suche\), \[suche\]/.test(kunden));
  ok("Der Ladeeffekt hängt am abonnierten Wert", /useEffect\(\(\) => \{ void laden\(\); \}, \[laden, suche\]\)/.test(kunden));
  ok("`laden` liest NICHT mehr window.location",
    !/const p = new URLSearchParams\(window\.location\.search\);[\s\S]{0,200}zentrale\/kunden/.test(kunden));
  ok("Auch das Setzen geht vom abonnierten Stand aus",
    /const p = new URLSearchParams\(suche\);/.test(kunden));
  ok("Kein window.location.search mehr im Code (nur im Kommentar)",
    (kunden.match(/window\.location\.search/g) || []).length <= 3);

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("2. Bug: Admin-Mail-Zentrale");
  // ═══════════════════════════════════════════════════════════════════════
  const app = datei("client/src/App.tsx");
  ok("Es gibt eine eigene Admin-Route", /path="\/admin\/mail-zentrale"/.test(app));
  ok("… hinter der Admin-Hülle", /path="\/admin\/mail-zentrale" component=\{admin\(/.test(app));
  const shell = datei("client/src/components/admin/AdminShell.tsx");
  ok("Der Menüpunkt zeigt nicht mehr auf die Team-Fassung",
    !/path: "\/agent\/mail-zentrale"/.test(shell));
  ok("… sondern auf die eigene", /path: "\/admin\/mail-zentrale"/.test(shell));

  const mz = datei("client/src/pages/mail-zentrale.tsx");
  ok("Die Seite kennt beide Wege", /const basis = alsAdmin \? "\/api\/fiaon\/admin\/mail\/zentrale"/.test(mz));
  ok("Unter /admin läuft sie OHNE AgentShell", /if \(alsAdmin\) return <Inhalt \/>;/.test(mz));
  ok("Es gibt keine zweite Seite", !existsSync("client/src/pages/admin-mail-zentrale.tsx"));

  const mailRouten = datei("server/routes/fiaon-mail.ts");
  for (const weg of ["suche", "gruppen", "vorschau", "senden", "test"]) {
    ok(`Admin-Endpunkt vorhanden: ${weg}`, mailRouten.includes(`"/admin/mail/zentrale/${weg}"`));
  }
  ok("Der Vorgesetzte hat eine höhere Grenze", /const ADMIN_GRENZE = 5000/.test(mailRouten));
  ok("Das Team bleibt bei zehn", /rolle === "admin" \|\| rolle === "vertriebsleiter" \? 5000 : 10/.test(mailRouten));
  ok("Der Admin-Weg benutzt DIESELBE Sendefunktion",
    /admin\/mail\/zentrale\/senden[\s\S]{0,1400}zentraleSenden/.test(mailRouten));
  ok("… und dieselbe Zielgruppen-Funktion",
    /admin\/mail\/zentrale\/vorschau[\s\S]{0,300}zielgruppeLaden/.test(mailRouten));
  ok("Die Vorschau-Pflicht gilt auch für den Vorgesetzten",
    /admin\/mail\/zentrale\/senden[\s\S]{0,1200}ist eine Vorschau nötig/.test(mailRouten));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("3. Bug: „Alle prüfen“ und Brevo in Klartext");
  // ═══════════════════════════════════════════════════════════════════════
  ok("Die Route existiert", /router\.post\("\/admin\/mail\/alle-pruefen"/.test(mailRouten));
  ok("Sie geht jeden Zweig durch", /for \(const e of alle\)[\s\S]{0,300}zweigPruefen/.test(mailRouten));
  ok("… zählt sauber und beanstandet", /sauber, beanstandet/.test(mailRouten));
  ok("… und verlangt eine Testadresse", /braucht es eine Testadresse/.test(mailRouten));
  ok("Brevo-Fehler kommen als Klartext zurück", /brevo: brevoKlar/.test(mailRouten));

  // Der IP-Fehler, den der Vorgesetzte gesehen hat.
  const ipFehler = brevoKlartext(401,
    '{"message":"Unrecognised IP address 35.160.120.126, unauthorized","code":"unauthorized"}');
  ok("Der IP-Fehler wird erkannt", ipFehler.behebbar);
  ok("… nennt die IP im Titel", /35\.160\.120\.126/.test(ipFehler.titel));
  ok("… und die Adresse zum Freigeben",
    ipFehler.anleitung.some((a) => a.includes("app.brevo.com/security/authorised_ips")));
  ok("… mit der Alternative, die Beschränkung abzuschalten",
    ipFehler.anleitung.some((a) => /Beschränkung ganz ab/.test(a)));
  ok("Die rohe Antwort bleibt aufhebbar", ipFehler.roh.includes("Unrecognised"));

  const keyFehler = brevoKlartext(401, '{"code":"unauthorized","message":"Key not found"}');
  ok("Ein ungültiger Schlüssel wird anders erklärt als eine IP-Sperre",
    /Schlüssel abgelehnt/.test(keyFehler.titel));
  gleich("Ein 429 ist behebbar (löst sich selbst)", brevoKlartext(429, "").behebbar, true);
  gleich("Ein 500 ist NICHT unser Fehler", brevoKlartext(503, "").behebbar, false);
  ok("Fehlender Schlüssel ist eine Lücke, kein Fehler",
    /kein Brevo-Schlüssel hinterlegt/.test(brevoNichtEingerichtet().titel));

  const brevoLib = datei("server/lib/fiaon-brevo.ts");
  ok("JEDER Brevo-Aufruf läuft durch die Übersetzung",
    /klartext: BrevoKlartext/.test(brevoLib) && /brevoKlartext\(res\.status, text\)/.test(brevoLib));
  ok("… auch wenn die Verbindung ganz ausfällt", /brevoKlartext\(0,/.test(brevoLib));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("4. Bug: /admin/leistung");
  // ═══════════════════════════════════════════════════════════════════════
  ok("Die Route leitet um",
    /path="\/admin\/leistung" component=\{\(\) => <Umleitung/.test(app));
  ok("Kein Import mehr auf die Altseite", !/admin-leistung/.test(app));
  ok("Kein Menüpunkt mehr", !/path: "\/admin\/leistung"/.test(shell));
  const zentrale = datei("client/src/pages/admin-team-zentrale.tsx");
  ok("Die Rangliste steht in der Team-Zentrale", /Rangliste Monat/.test(zentrale));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("5. Bug: Team-Zentrale vollständig");
  // ═══════════════════════════════════════════════════════════════════════
  ok("„Teammitglied anlegen“ steht als Knopf im Kopf",
    /setEinladen\(true\)[\s\S]{0,200}Teammitglied anlegen/.test(zentrale));
  ok("Das Mitarbeiter-Detail hat einen Verwaltungs-Reiter", /"verwaltung", "Verwaltung"/.test(zentrale));

  const team = datei("server/routes/fiaon-team.ts");
  // Die Vollständigkeitsliste — jede Funktion muss eine Route haben.
  for (const [name, muster] of [
    ["Anlegen/Einladen", 'router.post("/admin/agents"'],
    ["Einladung erneut", '/admin/agents/:id/reinvite'],
    ["Passwort-Reset", '/admin/agents/:id/force-reset'],
    ["Deaktivieren", '/admin/agents/:id/toggle'],
    ["Rolle ändern", '/admin/agents/:id/rolle'],
    ["Provisionssatz", '/admin/agents/:id/update'],
    ["Manuelle Provision", '/admin/agents/:id/commissions/manual'],
    ["Bankdaten", '/admin/team/agents/:id/bank'],
    ["Kunden umhängen", '/admin/team/reassign'],
    ["Löschen (Vorschau)", '/admin/agents/:id/loesch-vorschau'],
    ["Löschen (ausführen)", '/admin/agents/:id/loeschen'],
  ] as const) {
    ok(`Route vorhanden: ${name}`, team.includes(muster), muster);
  }
  // Und im Detail erreichbar, ohne Seitenwechsel.
  for (const [name, muster] of [
    ["Rolle", "/admin/agents/${m.id}/rolle"],
    ["Reset", "/admin/agents/${m.id}/force-reset"],
    ["Reinvite", "/admin/agents/${m.id}/reinvite"],
    ["Deaktivieren", "/admin/agents/${m.id}/toggle"],
    ["Bank", "/admin/team/agents/${m.id}/bank"],
    ["Löschen", "/admin/agents/${m.id}/loeschen"],
  ] as const) {
    ok(`Im Detail bedienbar: ${name}`, zentrale.includes(muster), muster);
  }
  ok("Alle vier Rollen sind im Detail wählbar",
    ["agent", "vertriebsleiter", "onboarding", "inkasso"]
      .every((r) => new RegExp(`wert: "${r}"`).test(zentrale)));

  // ── Texte brechen um, statt zu kürzen ────────────────────────────────
  ok("Der Name im Detail bricht um", /overflowWrap: "anywhere"/.test(zentrale));
  ok("Die Reiterleiste rollt statt umzubrechen", /overflow-x-auto/.test(zentrale));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("6. Bug: Spaltenname in der Kunden-Zentrale");
  // ═══════════════════════════════════════════════════════════════════════
  ok("Die letzte Spalte heißt „Letzter Kontakt“", /<span>Letzter Kontakt<\/span>/.test(kunden));
  gleich("… und nicht mehr zweimal „Kontakt“",
    (kunden.match(/<span>Kontakt<\/span>/g) || []).length, 1);

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("7. Der Ebenen-Standard");
  // ═══════════════════════════════════════════════════════════════════════
  const ebene = datei("client/src/components/FiaonEbene.tsx");
  // Der Kommentar oben in der Datei ERKLÄRT den alten Wert — er darf ihn
  // nennen. Geprüft wird der CSS-Block, nicht der Fließtext.
  const ebeneCss = ebene.slice(ebene.indexOf("const EBENEN_CSS"));
  ok("Der Schleier hellt AUF statt zu verdunkeln",
    /rgba\(226,236,250,\.62\)/.test(ebeneCss) && !/rgba\(7,11,22/.test(ebeneCss));
  ok("Er ist Glas", /backdrop-filter: blur\(22px\) saturate\(150%\)/.test(ebene));
  ok("Die Ebene tritt aus der Tiefe ein", /translateZ\(-140px\)[\s\S]{0,60}rotateX\(7deg\)/.test(ebene));
  ok("… auf einer perspective-Bühne", /perspective: schmal \? "none" : "1400px"/.test(ebene));
  ok("Kopf und Fuß sind Glas, der Körper ist massiv",
    /\.fi-ebene-kopf \{[\s\S]{0,200}backdrop-filter/.test(ebene)
    && /\.fi-ebene-koerper \{[\s\S]{0,200}background: #fff/.test(ebene));
  ok("Vier Schatten für die Tiefe",
    (ebene.match(/0 60px 140px -40px|0 18px 44px -22px|0 0 60px -20px|inset 0 1px 0/g) || []).length >= 4);
  ok("Auf 380 px ein Blatt mit Grabber", /fi-ebene-grabber/.test(ebene));
  ok("… das man nach unten wischen kann", /zieht > 90/.test(ebene));
  ok("Escape schließt", /e\.key === "Escape"/.test(ebene));
  ok("Bewegung ist abschaltbar", /prefers-reduced-motion: reduce/.test(ebene));
  ok("Verschachtelte Ebenen heben die Rollsperre nicht zu früh auf",
    /ebenenZaehler === 0/.test(ebene));

  // ── Migration ────────────────────────────────────────────────────────
  for (const [name, pfad] of [
    ["E-Mail-Menü", "client/src/components/SendeMenue.tsx"],
    ["Gesprächsblatt", "client/src/components/Gespraechsblatt.tsx"],
    ["Softphone", "client/src/components/Softphone.tsx"],
    ["Kunden-Zentrale (Löschen)", "client/src/pages/admin-kunden.tsx"],
    ["Team-Detail", "client/src/pages/admin-team-zentrale.tsx"],
  ] as const) {
    const q = datei(pfad);
    ok(`Migriert auf FiaonEbene: ${name}`, /<FiaonEbene/.test(q));
    // Nur echte Stilangaben zählen — die Kommentare erklären, was ersetzt
    // wurde, und dürfen den alten Wert nennen.
    ok(`… kein schwarzer Schleier mehr: ${name}`,
      !/background: "rgba\(7,11,22/.test(q) && !/background:\s*rgba\(7,11,22/.test(q));
  }

  // ── Gesprächsblatt verdichtet ────────────────────────────────────────
  const blatt = datei("client/src/components/Gespraechsblatt.tsx");
  ok("Das Blatt hat einen 3-Zeilen-Kern", /fi-gb-kern-wer[\s\S]{0,600}fi-gb-kern-schritt/.test(blatt));
  ok("Die Einwände sind aufklappbare Karten", /<FiaonKlappe/.test(blatt));
  ok("… die erste steht offen", /offenVorgabe=\{i === 0\}/.test(blatt));
  ok("Ziffernmarken je Abschnitt", /fi-gb-ziffer/.test(blatt));
  ok("Kopieren je Abschnitt UND je Karte",
    (blatt.match(/fi-gb-kopieren/g) || []).length >= 3);
  ok("Der Fußsatz liegt auf der Glasleiste", /fuss=\{blatt \? \([\s\S]{0,200}fussSatz/.test(blatt));

  // ── Softphone-Gerät ──────────────────────────────────────────────────
  const tel = datei("client/src/components/Softphone.tsx");
  ok("Das Gerät hat eine dunkle Fassung", /linear-gradient\(172deg, #101a2f/.test(tel));
  ok("Tasten haben Druckgefühl", /\.fi-tel-taste:active[\s\S]{0,140}inset 0 2px 5px/.test(tel));
  ok("Eine Statuszeile mit Punkt", /fi-tel-punkt\[data-zustand="gespraech"\]/.test(tel));
  ok("… mit Dauer im Gespräch", /Im Gespräch · \$\{dauerText\(sekunden\)\}/.test(tel));
  ok("Der Einrichtungs-Zustand ist eine Karte", /fi-tel-karte-titel/.test(tel));
  ok("Der schwebende Knopf kommt dem Zeiger entgegen", /translateZ\(30px\)/.test(tel));

  // ── Filter-Dropdown ──────────────────────────────────────────────────
  const filter = datei("client/src/components/FiaonFilter.tsx");
  ok("Filter liegen in einem Popover", /fi-filter-popover/.test(filter));
  ok("… mit Gruppen und Zählern", /FilterGruppe/.test(filter) && /fi-filter-zahl/.test(filter));
  ok("… und Zurücksetzen", /onZuruecksetzen/.test(filter));
  ok("Auf 380 px ein Blatt", /<FiaonEbene[\s\S]{0,300}titel="Filter"/.test(filter));
  ok("Aktive Filter erscheinen als entfernbare Chips", /FiaonFilterChips/.test(filter));
  ok("Die Kunden-Zentrale benutzt beides",
    /<FiaonFilter/.test(kunden) && /<FiaonFilterChips/.test(kunden));
  ok("Die Filterwand ist weg (keine 14 Knöpfe mehr)",
    !/SPEZIAL\.map\(\(f\) =>/.test(kunden));
  ok("Die Schlüssel sind vom Anzeigetext getrennt",
    /SPEZIAL_SCHLUESSEL/.test(kunden) && /SPEZIAL_TITEL/.test(kunden));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("8. Space 2.0");
  // ═══════════════════════════════════════════════════════════════════════
  const space = datei("client/src/pages/agent/space.tsx");
  // ── AUF SPACE V4 NACHGEZOGEN (11.08.2026) ─────────────────────────────
  // Der Vorgesetzte hat v3 abgelehnt: zu schmal, zu nah an der Kopfzeile. Der
  // Feed ist jetzt 760 px breit und die Bühne dunkel. Diese Prüfungen maßen
  // die alten Zahlen — sie prüften Gestaltung, die es nicht mehr gibt.
  // Volle Breite (11.08.2026): 900 px Feed, drei Spalten erst ab 1780 px
  // Fenster — der Verwaltungsbereich verliert 240 px an seine Seitenleiste,
  // und bei 1440 verfügbarer Breite passten drei feste Spalten nicht.
  ok("Drei Spalten mit breitem Feed",
    /grid-template-columns: 260px minmax\(560px, 900px\) 260px/.test(space));
  ok("Zwei Spalten unter 1780 px", /max-width: 1779px/.test(space));
  ok("Auf 380 px randlos", /border-radius: 0; padding: 16px;/.test(space));
  // Vier Lagen Schatten: Kontakt, Streuung, Farbschein, Lichtkante. Ein
  // einzelner Schatten sieht immer nach Vorlage aus.
  ok("Karten tragen die volle Schattenstaffel",
    /0 26px 56px -28px rgba\(3,8,22,\.7\)/.test(space)
    && /0 0 60px -26px rgba\(96,165,250,\.42\)/.test(space)
    && /inset 0 1px 0 rgba\(255,255,255,1\)/.test(space));
  ok("Der Komposer öffnet sich beim Fokus", /onFocus=\{\(\) => setGross\(true\)\}/.test(space));
  ok("… und lädt ein statt zu fordern", /Was lief gut\?/.test(space));
  ok("Reaktionen mit eigenen SVG-Marken, keine Emojis",
    /REAKTIONS_MARKE/.test(space) && !/[\u{1F300}-\u{1FAFF}]/u.test(space));
  ok("Der Zähler springt beim Ändern", /@keyframes fiSpSprung/.test(space));
  // Das Feld heißt `meine` — so liefert es feedLesen(). Die erste Fassung
  // dieses Tests prüfte auf `meineReaktion`, einen Namen, den ich erfunden
  // hatte; im Feed stand deshalb bei jedem Beitrag „Invalid Date".
  ok("Reaktionen wirken sofort (ohne auf den Server zu warten)",
    /setDaten\(\(d: any\) => d && \{[\s\S]{0,400}meine: war === art \? null : art/.test(space));
  ok("Die Feldnamen stimmen mit feedLesen überein",
    /p\.am/.test(space) && /p\.autorAvatar/.test(space) && !/createdAt|avatarUrl/.test(space));
  ok("Ein kaputter Zeitstempel zeigt kein „Invalid Date“",
    /Number\.isNaN\(d\.getTime\(\)\)\) return ""/.test(space));
  ok("Neue Beiträge treten mit Animation ein", /@keyframes fiSpPostAuf/.test(space));
  ok("Kommentare sind einklappbar", /kommentarZu === p\.id/.test(space));

  const shared = datei("client/src/pages/agent/shared.tsx");
  ok("Space ist die Startseite nach dem Login",
    /location === "\/agent"\) navigate\("\/agent\/space"/.test(shared));
  ok("„Start“ bleibt als eigener Punkt", /path="\/agent\/start"/.test(app));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("9. Content-Engine und Seed");
  // ═══════════════════════════════════════════════════════════════════════
  gleich("Es gibt 180 Gedanken", GEDANKEN.length, 180);
  ok("Jede Nummer nur einmal", new Set(GEDANKEN.map((g) => g.nr)).size === GEDANKEN.length);
  ok("Kein Gedanke doppelt", new Set(GEDANKEN.map((g) => g.text)).size === GEDANKEN.length);

  const plan20 = tagesBauplan("2026-08-11", 20);
  gleich("Der Bauplan liefert genau die Zielmenge", plan20.length, 20);
  const zeiten = plan20.map((b) => b.am.getTime());
  ok("Chronologisch sortiert", zeiten.every((t, i) => i === 0 || t >= zeiten[i - 1]));
  const abstaende = zeiten.slice(1).map((t, i) => (t - zeiten[i]) / 60_000);
  ok(`Mindestabstand eingehalten (${Math.min(...abstaende)} Min)`,
    Math.min(...abstaende) >= ABSTAND_MINUTEN, String(Math.min(...abstaende)));
  const stunden = plan20.map((b) => b.am.getUTCHours());
  ok(`Alles im Fenster ${FENSTER_VON}–${FENSTER_BIS} Uhr`,
    Math.min(...stunden) >= FENSTER_VON && Math.max(...stunden) <= FENSTER_BIS,
    `${Math.min(...stunden)}–${Math.max(...stunden)}`);
  ok("Schlüssel sind eindeutig",
    new Set(plan20.map((b) => `${b.art}|${b.schluessel}`)).size === plan20.length);

  // Der Punkt: Zwei Tage hintereinander dürfen sich nicht wiederholen.
  const a1 = tagesBauplan("2026-08-11", 20).map((b) => b.text);
  const a2 = tagesBauplan("2026-08-12", 20).map((b) => b.text);
  const doppelt = a1.filter((t) => a2.includes(t)).length;
  gleich("Kein Beitrag wiederholt sich am Folgetag", doppelt, 0);

  // Die Dichte wird respektiert.
  for (const z of [5, 12, 20, 40] as const) {
    gleich(`Ziel ${z} ergibt ${z} Beiträge`, tagesBauplan("2026-08-11", z).length, z);
  }
  ok("Der Vorgesetzte kann mindestens 10 bis 15 pro Tag einstellen",
    DICHTE_MIN <= 10 && DICHTE_MAX >= 15 && DICHTE_VORGABE >= 15,
    `${DICHTE_MIN}–${DICHTE_MAX}, Vorgabe ${DICHTE_VORGABE}`);

  const engine = datei("server/lib/fiaon-space-engine.ts");
  ok("Ereignis-Posts sind idempotent (ON CONFLICT)", /ON CONFLICT \(auto_art, auto_schluessel\)/.test(engine));
  ok("Abschluss-Posts nennen NUR Vorname und Zahl",
    /Abschluss des Tages geholt/.test(engine) && !/primary_email|person_id.*name/.test(engine));
  ok("Testkonten erzeugen keine Abschluss-Posts", /if \(!a \|\| a\.is_test_account\) return false/.test(engine));
  ok("Ein Tag ohne Abschluss bekommt keine Rangliste",
    /if \(zeilen\.length === 0\) return false/.test(engine));

  const seed = datei("scripts/space-seed.ts");
  ok("Das Seed-Skript hat eine Vorschau", /VORSCHAU\. Nichts geschrieben/.test(seed));
  ok("… und schreibt nur mit --schreiben", /const SCHREIBEN = process\.argv\.includes\("--schreiben"\)/.test(seed));
  ok("Ereignis-Posts kommen aus ECHTEN Daten",
    /FROM fiaon_commissions c/.test(seed) && !/Math\.random/.test(seed));
  ok("Der Lauf benutzt denselben Bauplan wie die Engine", /tagesBauplan\(datum, ziel\)/.test(seed));

  const followup = datei("server/routes/fiaon-followup.ts");
  ok("Der Space-Lauf greift NICHT mehr nur vor sieben Uhr",
    !/if \(stunde < 7\) await m\.spaceTageslauf/.test(followup));
  const agentQuelle = datei("server/routes/fiaon-agent.ts");
  ok("Der Abschluss-Post entsteht im Geschäftsvorgang", /postAbschluss\(Number\(app\.assigned_agent_id\)\)/.test(agentQuelle));
  ok("… und wirft die Provisionsbuchung nicht um",
    /try \{[\s\S]{0,200}postAbschluss[\s\S]{0,120}catch/.test(agentQuelle));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("10. Space: Chips, Pin-Grenze, Bild, Nachladen");
  // ═══════════════════════════════════════════════════════════════════════
  const spaceRouten = datei("server/routes/fiaon-space.ts");
  gleich("Höchstens zwei angepinnte Beiträge", PIN_GRENZE, 2);
  ok("Bei erreichter Grenze wird GEFRAGT, nicht verdrängt",
    /grenzeErreicht: true/.test(spaceRouten) && /Welcher soll weichen/.test(spaceRouten));
  ok("… und der zu Lösende muss angepinnt sein",
    /nicht angepinnt/.test(spaceRouten));

  ok("Der Akten-Chip wird gegen das Sichtfeld geprüft",
    /nur Akten anhängen, die du selbst betreust/.test(spaceRouten));
  ok("Die Aktensuche zeigt nur eigene Kunden",
    /nurEigene = rolle === "agent" \? req\.agent!\.id : null/.test(spaceRouten));
  ok("Im Feed steht NUR die Referenz, kein Name",
    /akteRef: p\.akte_ref/.test(datei("server/lib/fiaon-space.ts"))
    && !/akte_name/.test(spaceRouten));

  ok("Bilder werden einzeln abgeholt, nicht im Feed",
    /space\/bild\/:id/.test(spaceRouten) && /\(p\.bild IS NOT NULL\) AS hat_bild/.test(datei("server/lib/fiaon-space.ts")));
  ok("Nur JPEG, PNG, WebP", /image\\\/\(\?:jpeg\|png\|webp\)/.test(spaceRouten));
  ok("Es gibt eine Größengrenze", /2_500_000/.test(spaceRouten));

  ok("Der Feed lädt über einen Anker, nicht über ein Offset",
    /vorId/.test(datei("server/lib/fiaon-space.ts")));
  ok("Angepinntes nur auf der ersten Seite", /AND NOT p\.angepinnt/.test(datei("server/lib/fiaon-space.ts")));
  ok("Nachladen markiert NICHT als gesehen", /if \(!vorId\) \{/.test(spaceRouten));

  const spaceSeite = datei("client/src/pages/agent/space.tsx");
  ok("Unendliches Scrollen über einen Beobachter", /IntersectionObserver/.test(spaceSeite));
  ok("… mit Vorlauf", /rootMargin: "400px"/.test(spaceSeite));
  ok("„Neue Beiträge“ als Pille, nicht eingefügt", /fi-sp-pill/.test(spaceSeite));
  ok("Bilder werden IM BROWSER verkleinert", /createImageBitmap/.test(spaceSeite));
  ok("Die Aktensuche ist entprellt", /setTimeout\(async \(\) => \{[\s\S]{0,200}akte-suche/.test(spaceSeite));
  ok("Der Akten-Chip erklärt sich selbst", /Akte öffnen — wenn du berechtigt bist/.test(spaceSeite));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("11. Akte: Bestellungen verwalten");
  // ═══════════════════════════════════════════════════════════════════════
  const zentralenQuelle = datei("server/routes/fiaon-zentralen.ts");
  ok("Es gibt eine Vorschau", /admin\/bestellungen\/vorschau/.test(zentralenQuelle));
  ok("… und eine Ausführung", /admin\/bestellungen\/entfernen/.test(zentralenQuelle));
  ok("Bezahlte werden archiviert statt gelöscht",
    /const bezahlt = String\(r\.payment_status\) === "paid"[\s\S]{0,600}art = "archivieren"/.test(zentralenQuelle));
  ok("Auch mit Rechnung, Provision oder Raten",
    /hatRechnung \|\| hatProvision \|\| hatRaten/.test(zentralenQuelle));
  ok("§ 147 AO steht in der Begründung", /147 AO/.test(zentralenQuelle));
  ok("Bestätigung durch wörtliches Eintippen", /Bitte zur Bestätigung genau eintippen/.test(zentralenQuelle));
  ok("Jede Löschung wird protokolliert", /INSERT INTO fiaon_loeschungen/.test(zentralenQuelle));
  const akte = datei("client/src/pages/admin-kunde.tsx");
  ok("Die Akte hat Mehrfachauswahl", /gewaehlteRefs/.test(akte));
  ok("… und den Dialog auf der FiaonEbene",
    /<FiaonEbene[\s\S]{0,300}Was mit diesen Bestellungen passiert/.test(akte));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("12. Das eigene Gesicht");
  // ═══════════════════════════════════════════════════════════════════════
  const agentQ = datei("server/routes/fiaon-agent.ts");
  ok("Die Anmeldung lädt den Avatar mit",
    /SELECT id, name, email, first_name, active, session_epoch, avatar, rolle/.test(agentQ));
  ok("… und legt ihn an den Request", /avatar: rows\[0\]\.avatar \?\? null/.test(agentQ));
  ok("Der Space liefert das eigene Bild aus", /avatar: ichAvatar/.test(spaceRouten));
  ok("Die Space-Oberfläche benutzt es",
    (spaceSeite.match(/src=\{ich\?\.avatar/g) || []).length >= 3);
  ok("Keine erzwungenen Initialen mehr im Space", !/<Avatar src=\{null\}/.test(spaceSeite));
  const sharedQ = datei("client/src/pages/agent/shared.tsx");
  ok("Auch die Kopfzeile zeigt das Bild", /<Avatar src=\{agent\.avatar \?\? null\}/.test(sharedQ));
  ok("Der Typ kennt das Feld", /avatar\?: string \| null/.test(sharedQ));

  // Gegen echte Daten: Wer ein Bild hat, muss es geliefert bekommen.
  const [mitBild] = (await sqlPool`
    SELECT id, LENGTH(avatar) AS n FROM fiaon_agents
    WHERE active AND avatar IS NOT NULL ORDER BY id LIMIT 1
  `) as any[];
  ok("Es gibt Konten mit hinterlegtem Bild", !!mitBild && Number(mitBild.n) > 1000,
    mitBild ? `${mitBild.n} Zeichen` : "keins");

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("13. Prüfkonto statt Attrappe");
  // ═══════════════════════════════════════════════════════════════════════
  const [pk] = (await sqlPool`
    SELECT id, is_test_account, pruefkonto FROM fiaon_agents
    WHERE LOWER(email) = 'office@schwarzott-global.com'
  `) as any[];
  ok("Das Konto des Vorgesetzten ist als Prüfkonto markiert", !!pk?.pruefkonto);
  ok("… und bleibt zugleich als Test gekennzeichnet", !!pk?.is_test_account);

  const telQ = datei("server/routes/fiaon-telefonie.ts");
  ok("Telefonie fragt nach BEIDEM", /is_test_account, pruefkonto FROM fiaon_agents/.test(telQ));
  ok("… und lässt das Prüfkonto durch",
    /return !!a\?\.is_test_account && !a\?\.pruefkonto;/.test(telQ));
  const teamQ = datei("server/routes/fiaon-team.ts");
  ok("Die Rollensperre nimmt das Prüfkonto aus",
    /vorher\.is_test_account && !vorher\.pruefkonto && rolle !== "agent"/.test(teamQ));
  ok("Für echte Attrappen bleibt sie", /keine erhöhte Rolle bekommen/.test(teamQ));

  // Die Sperren, die BLEIBEN müssen: Ein echter Kunde darf nie auf einem
  // Prüfkonto landen. Das ist keine Vergesslichkeit, das ist die Grenze.
  for (const [name, pfad, muster] of [
    ["Automatische Verteilung", "server/lib/fiaon-zuteilung.ts", "AND NOT a.is_test_account"],
    ["Terminangebote", "server/lib/fiaon-termine.ts", "AND NOT is_test_account"],
    ["Wiedereinstiegs-Mails", "server/lib/fiaon-wiedereinstieg.ts", "tg.is_test_account"],
    ["Kundenübergabe", "server/lib/fiaon-uebergabe.ts", "COALESCE(a.is_test_account, FALSE) = FALSE"],
  ] as const) {
    ok(`Bleibt gesperrt (Kundenkontakt): ${name}`, datei(pfad).includes(muster), muster);
  }

  // Die Prüfung selbst, gegen echte Daten.
  const konten = (await sqlPool`
    SELECT id, is_test_account, pruefkonto FROM fiaon_agents WHERE active
  `) as any[];
  const darfTelefonieren = (k: any) => !(!!k.is_test_account && !k.pruefkonto);
  ok("Das Prüfkonto darf telefonieren",
    darfTelefonieren(konten.find((k) => Number(k.id) === Number(pk.id))));
  const attrappen = konten.filter((k) => k.is_test_account && !k.pruefkonto);
  ok(`Attrappen bleiben gesperrt (${attrappen.length} Stück)`,
    attrappen.every((k) => !darfTelefonieren(k)));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("14. Erste Schritte: erledigt heißt erledigt");
  // ═══════════════════════════════════════════════════════════════════════
  const schritteQ = datei("shared/fiaon-onboarding-schritte.ts");
  const esQ = datei("server/routes/fiaon-erste-schritte.ts");

  // Der Sackgassen-Fund: Die Zusage gab es für die Rolle „agent" nirgends.
  ok("Die Zusage steht NICHT mehr in der gemeinsamen Liste",
    !/const GEMEINSAM: Schritt\[\] = \[[\s\S]{0,400}schluessel: "zusage"/.test(schritteQ));
  gleich("Sie steht bei genau drei Rollen",
    (schritteQ.match(/schluessel: "zusage"/g) || []).length, 3);
  ok("… und jede davon hat einen Weg dorthin",
    /schluessel: "zusage"[\s\S]{0,300}ziel: \{ href: "\/agent\/vertrieb"/.test(schritteQ)
    && /schluessel: "zusage"[\s\S]{0,300}ziel: \{ href: "\/agent\/startgespraeche"/.test(schritteQ)
    && /schluessel: "zusage"[\s\S]{0,300}ziel: \{ href: "\/agent\/inkasso"/.test(schritteQ));

  ok("Der Space wird automatisch erkannt", /space: a\.space_gesehen_am/.test(esQ));
  ok("Der Vertrag folgt seinem eigenen Text (Zugang = Vertrag)",
    /a\.hat_passwort \? a\.beitritt : null/.test(esQ));
  ok("Ein Besuch der Zielseite zählt", /erste-schritte\/besucht\/:schluessel/.test(esQ));
  ok("… und wird beim Klick gemeldet",
    /erste-schritte\/besucht\/\$\{s\.schluessel\}/.test(datei("client/src/components/ErsteSchritte.tsx")));
  ok("Die Besuchsmeldung kann nur echte Schritte setzen",
    /if \(!erlaubt\.includes\(schluessel\)\) return res\.json\(\{ ok: true, vermerkt: false \}\)/.test(esQ));

  // Gegen echte Daten: Kein Mensch darf einen Schritt haben, den er nicht
  // erreichen kann.
  const { streckeFuer } = await import("../shared/fiaon-onboarding-schritte");
  const menschen = (await sqlPool`
    SELECT a.id, a.rolle,
           (SELECT COUNT(*)::int FROM fiaon_vertrieb_zusagen z
             WHERE z.agent_id = a.id AND z.widerrufen_am IS NULL) AS zusagen
    FROM fiaon_agents a WHERE a.active AND NOT a.is_test_account
  `) as any[];
  const sackgasse = menschen.filter((m) => {
    const hat = streckeFuer(String(m.rolle)).schritte.some((sc) => sc.schluessel === "zusage");
    // Eine Zusage im Weg zu haben ist nur dann in Ordnung, wenn es die Rolle
    // auch wirklich gibt — sonst ist es ein Häkchen ohne Knopf.
    return hat && String(m.rolle) === "agent";
  });
  gleich("Niemand hat einen unerreichbaren Schritt", sackgasse.length, 0);
  for (const rolle of ["agent", "vertriebsleiter", "onboarding", "inkasso"] as const) {
    const st = streckeFuer(rolle).schritte;
    ok(`Strecke ${rolle}: jeder Schritt ist erreichbar`,
      st.every((sc) => sc.automatisch || sc.ziel || sc.schluessel === "liste_verstanden"),
      st.filter((sc) => !sc.automatisch && !sc.ziel).map((sc) => sc.schluessel).join(", "));
  }

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("15. Space-Design");
  // ═══════════════════════════════════════════════════════════════════════
  ok("Die Bühne liegt auf der Hülle, nicht in der Bühne selbst",
    /body:has\(\.fi-sp-buehne\) \.agent-ambient,/.test(spaceSeite));
  ok("… und gilt auch im Verwaltungsbereich",
    /body:has\(\.fi-sp-buehne\) \.admin-flaeche \{/.test(spaceSeite));
  // DURCHSCHEINEND, nicht deckend: Das Hintergrundvideo muss durch die Bühne
  // sichtbar bleiben — deckendes Navy hätte es vollständig verdeckt.
  ok("Die Bühne ist dunkles CI-Navy, aber durchscheinend",
    /rgba\(13,28,63,\.82\) 0%, rgba\(10,26,60,\.86\) 44%, rgba\(7,17,41,\.9\) 100%/.test(spaceSeite));
  ok("Die helle Wäsche des Raums ist im Space aus",
    /body:has\(\.fi-sp-buehne\) \.fi-raum-waesche \{ display: none; \}/.test(spaceSeite));
  ok("Die Breitengrenze der Hülle ist aufgehoben",
    /max-width: none;/.test(spaceSeite) && /main\[class\*="max-w-"\]/.test(spaceSeite));
  // Der Kommentar ZITIERT den alten Text, um zu erklären, was ersetzt wurde —
  // er darf ihn nennen. Geprüft wird, dass er nicht mehr GERENDERT wird.
  ok("Die Seitenspalte zeigt echte Zahlen, keine Hausordnung",
    /fi-sp-tag-zahlen/.test(spaceSeite)
    && !/fi-sp-seiten-text">\s*\n?\s*Was hier steht/.test(spaceSeite)
    && !/<p className="fi-sp-seiten-titel">Der Raum<\/p>/.test(spaceSeite));
  ok("Die Bühne hat Tiefe", /perspective: 1600px/.test(spaceSeite));
  ok("Karten sind Glas", /backdrop-filter: blur\(26px\) saturate\(150%\)/.test(spaceSeite));
  ok("… mit Lichtkante oben", /\.fi-sp-karte::after/.test(spaceSeite));
  ok("Beiträge treten aus der Tiefe ein", /translateZ\(-44px\) rotateX\(4deg\)/.test(spaceSeite));
  ok("… und kommen dem Zeiger entgegen", /\.fi-sp-post:hover[\s\S]{0,80}translateZ\(12px\)/.test(spaceSeite));
  ok("Der Komposer hebt sich beim Fokus an", /transform: translateZ\(18px\)/.test(spaceSeite));
  ok("Reaktionen haben eine Welle", /@keyframes fiSpWelle/.test(spaceSeite));
  ok("Knöpfe haben Druckgefühl",
    /\.fi-sp-senden:active[\s\S]{0,120}inset 0 2px 5px/.test(spaceSeite));
  ok("Alles auf der CI-Akzentfarbe",
    /#1d4ed8/.test(spaceSeite) && !/#7c3aed|#db2777|#ea580c/.test(spaceSeite));
  ok("Keine Emojis", !/[\u{1F300}-\u{1FAFF}]/u.test(spaceSeite));
  ok("Bewegung ist abschaltbar", /prefers-reduced-motion: reduce/.test(spaceSeite));
  ok("… die Tiefe bleibt trotzdem",
    /prefers-reduced-motion: reduce\)[\s\S]{0,400}\.fi-sp-post:hover \{ transform: none; \}/.test(spaceSeite));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("16. Verhalten gegen echte Daten");
  // ═══════════════════════════════════════════════════════════════════════
  // Die Zählprobe, die gestern den Archiv-Fehler fand — sie bleibt.
  const zahlen = await filterZahlen();
  for (const [name, f, s] of [
    ["Stufe A", { stufe: ["A"] }, "stufe_a"],
    ["Stufe B", { stufe: ["B"] }, "stufe_b"],
    ["Ohne Agent", { ohneAgent: true }, "ohne_agent"],
  ] as const) {
    const l = await kundenListe({ ...(f as any), limit: 10 });
    gleich(`Filterzahl hält, was sie verspricht: ${name}`, l.gesamt, Number(zahlen[s]));
  }

  try {
    await sqlPool.begin(async (tx) => {
      // ── Mitarbeiter-Löschung ─────────────────────────────────────────
      const [ohneGeld] = (await tx`
        INSERT INTO fiaon_agents (name, first_name, last_name, email, active)
        VALUES (${`Prüf Feinschliff${stempel}`}, 'Prüf', ${`Feinschliff${stempel}`},
                ${`fs-${stempel}@pruefstand.test`.toLowerCase()}, TRUE)
        RETURNING id
      `) as any[];
      const [mitGeld] = (await tx`
        INSERT INTO fiaon_agents (name, first_name, last_name, email, active)
        VALUES (${`Prüf Geld${stempel}`}, 'Prüf', ${`Geld${stempel}`},
                ${`fsg-${stempel}@pruefstand.test`.toLowerCase()}, TRUE)
        RETURNING id
      `) as any[];
      await tx`
        INSERT INTO fiaon_commissions (agent_id, ref, base_amount_cents, rate_bp, amount_cents, status, kind)
        VALUES (${mitGeld.id}, ${`FS-${stempel}`}, 10000, 1500, 1500, 'bestaetigt', 'own')
      `;

      const einteilen = async (id: number) => {
        const [a] = (await tx`
          SELECT (SELECT COUNT(*)::int FROM fiaon_commissions c WHERE c.agent_id = a.id) AS provisionen,
                 (SELECT COUNT(*)::int FROM fiaon_payouts p WHERE p.agent_id = a.id) AS auszahlungen
          FROM fiaon_agents a WHERE a.id = ${id}
        `) as any[];
        return Number(a.provisionen) > 0 || Number(a.auszahlungen) > 0 ? "anonymisiert" : "endgueltig";
      };
      gleich("Ohne Provision: endgültig löschbar", await einteilen(Number(ohneGeld.id)), "endgueltig");
      gleich("MIT Provision: nur anonymisiert", await einteilen(Number(mitGeld.id)), "anonymisiert");

      // Der Kern: Eine Provision überlebt die Anonymisierung.
      await tx`
        UPDATE fiaon_agents SET name = ${`Gelöscht #${mitGeld.id}`},
          email = ${`geloescht-${mitGeld.id}@anonym.invalid`}, active = FALSE
        WHERE id = ${mitGeld.id}
      `;
      const [p] = (await tx`
        SELECT amount_cents, agent_id FROM fiaon_commissions WHERE ref = ${`FS-${stempel}`}
      `) as any[];
      ok("Die Provision bleibt nach der Anonymisierung lesbar", Number(p.amount_cents) === 1500);
      gleich("… und dem Konto zugeordnet", Number(p.agent_id), Number(mitGeld.id));

      const [weg] = (await tx`
        SELECT name, email, active FROM fiaon_agents WHERE id = ${mitGeld.id}
      `) as any[];
      ok("Der Name ist weg", /^Gelöscht #/.test(String(weg.name)));
      ok("… die Adresse auch", /anonym\.invalid$/.test(String(weg.email)));
      ok("… und das Konto ist gesperrt", weg.active === false);

      throw new Zurueckrollen();
    });
  } catch (e) {
    if (!(e instanceof Zurueckrollen)) throw e;
  }

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("17. Gegenprobe: nichts geschrieben");
  // ═══════════════════════════════════════════════════════════════════════
  const [nachher] = await sqlPool`
    SELECT (SELECT COUNT(*) FROM fiaon_agents)::int AS agenten,
           (SELECT COUNT(*) FROM fiaon_commissions)::int AS provisionen,
           (SELECT COUNT(*) FROM fiaon_persons)::int AS personen
  `;
  gleich("Kein Mitarbeiter übrig", nachher.agenten, vorher.agenten);
  gleich("Keine Provision übrig", nachher.provisionen, vorher.provisionen);
  ok(`Personen nicht verloren (${vorher.personen} → ${nachher.personen})`,
    Number(nachher.personen) >= Number(vorher.personen));
  const [reste] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_agents WHERE last_name LIKE ${`%${stempel}`}
  `) as any[];
  gleich("Keine eigene Zeile übrig", Number(reste.n), 0);

  process.env.MAKE_WEBHOOK_URL = ECHT_MAKE;
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
