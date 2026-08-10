// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: Veredelung II
//
// Fehlergründe am Ort des Geschehens · Mail-Zentrale · Knopf-Kontrast ·
// Space v3 · Favicon · Wirtschaftlichkeit · Als-Mitarbeiter-Ansicht.
//
// Die Ansichts-Sitzung bekommt die schärfste Prüfung: Ihr Katalog schreibender
// Routen wird AUS DEN REGISTRIERTEN ROUTEN ABGELEITET, nicht von Hand
// gepflegt. Eine Liste würde bei der nächsten neuen Route veralten — und
// genau die eine wäre dann das Leck.
//
//   npx tsx scripts/pruef-veredelung.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";

const ECHT_MAKE = process.env.MAKE_WEBHOOK_URL;
process.env.MAKE_WEBHOOK_URL = "http://attrappe.pruefstand.invalid/keine-echten-mails";

import { readFileSync, existsSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import { STRECKEN } from "../shared/fiaon-onboarding-schritte";
import {
  ansichtNurLesen, ansichtTokenBauen, ansichtTokenPruefen, ANSICHT_MINUTEN,
} from "../server/lib/fiaon-ansicht";
import { teamWirtschaftlichkeit, wirtschaftlichkeit } from "../server/lib/fiaon-wirtschaftlichkeit";
import { titelFuer } from "../client/src/lib/fiaon-titel";

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

class Zurueckrollen extends Error {}
const stempel = Date.now().toString(36).toUpperCase();

async function main(): Promise<void> {
  log("\n══ Prüfstand: Veredelung II ══\n");

  const [vorher] = await sqlPool`
    SELECT (SELECT COUNT(*) FROM fiaon_agents)::int AS agenten,
           (SELECT COUNT(*) FROM fiaon_posts)::int AS posts,
           (SELECT COUNT(*) FROM fiaon_commissions)::int AS provisionen
  `;

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("1. Nikita: keine stille Versetzung mehr");
  // ═══════════════════════════════════════════════════════════════════════
  const [nikita] = (await sqlPool`
    SELECT id, name, rolle FROM fiaon_agents WHERE id = 13
  `) as any[];
  gleich("Nikita ist wieder Vertrieb", nikita?.rolle, "agent");
  const [zurueck] = (await sqlPool`
    SELECT meta FROM fiaon_agent_events
    WHERE agent_id = 13 AND type = 'rolle_geaendert' ORDER BY created_at DESC LIMIT 1
  `) as any[];
  ok("Die Rückstellung steht im Protokoll", !!zurueck);
  ok("… mit Begründung", /Rueckstellung|Rückstellung/.test(JSON.stringify(zurueck?.meta ?? {})));

  // Der Vorgesetzte: „Der Onboarding und Inkasso Mitarbeiter kommen erst!"
  const belegt = (await sqlPool`
    SELECT rolle, COUNT(*)::int AS n FROM fiaon_agents
    WHERE active AND rolle IN ('onboarding', 'inkasso') GROUP BY rolle
  `) as any[];
  gleich("Niemand sitzt auf Onboarding oder Inkasso", belegt.length, 0);

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("2. Tote Links");
  // ═══════════════════════════════════════════════════════════════════════
  const app = datei("client/src/App.tsx");
  const routen = new Set<string>();
  for (const m of app.matchAll(/path="([^"]+)"/g)) routen.add(m[1]);

  const ziele = new Set<string>();
  for (const st of Object.values(STRECKEN)) {
    for (const sc of st.schritte) if (sc.ziel) ziele.add(sc.ziel.href);
    ziele.add(st.ersteAufgabe.href);
  }
  const tot = [...ziele].filter((z) => !routen.has(z.split("?")[0].split("#")[0]));
  gleich("Kein Ziel der Einarbeitung führt ins Leere", tot.length, 0);
  if (tot.length) log(`        tot: ${tot.join(", ")}`);
  ok("/agent/verfuegbarkeit ist nirgends mehr verlinkt",
    !/href: "\/agent\/verfuegbarkeit"/.test(datei("shared/fiaon-onboarding-schritte.ts")));
  ok("Die Zeiten liegen im Profil, mit Sprungmarke",
    /id="erreichbarkeit"/.test(datei("client/src/pages/agent/profil.tsx")));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("3. Fehlergründe am Ort des Geschehens");
  // ═══════════════════════════════════════════════════════════════════════
  const zentraleQ = datei("server/lib/fiaon-zentrale.ts");
  ok("„Grund steht im Protokoll“ ist verschwunden",
    !/Grund steht im Protokoll/.test(zentraleQ.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, "")));
  ok("Das Ergebnis kommt je Empfänger zurück", /ergebnisse\.push\(\{/.test(zentraleQ));
  ok("… mit Grund", /grund: r\.grund \?\? null/.test(zentraleQ));
  ok("… und der Kennung der Protokollzeile", /protokollId: zeile\?\.id/.test(zentraleQ));
  ok("Ein einzelner Grund steht direkt in der Meldung",
    /gruende\.length === 1/.test(zentraleQ) && /nicht: \$\{gruende\[0\]\}/.test(zentraleQ));

  const mailSeite = datei("client/src/pages/mail-zentrale.tsx");
  ok("Die Oberfläche zeigt eine Ergebnis-Karte", /function ErgebnisKarte/.test(mailSeite));
  ok("… je Empfänger mit Klartext-Grund", /\{e\.grund \|\|/.test(mailSeite));
  ok("… mit Tiefverweis ins Protokoll", /mail-protokoll\?id=\$\{e\.protokollId/.test(mailSeite));
  ok("… und einem Weg zur Behebung bei IP-Sperre",
    /So behebst du das/.test(mailSeite) && /diagnose#ausgangs-ip/.test(mailSeite));

  // Die IP-Diagnose.
  const ipQ = datei("server/lib/fiaon-server-ip.ts");
  ok("Der Server merkt sich seine Ausgangsadresse", /export async function eigeneIPMerken/.test(ipQ));
  ok("… beim Start", /eigeneIPMerken/.test(datei("server/index.ts")));
  ok("Jede blockierte IP wird vorgemerkt", /ipVormerken/.test(datei("server/lib/fiaon-brevo-fehler.ts")));
  ok("Es gibt eine Diagnose-Route", /admin\/diagnose\/ausgangs-ip/.test(datei("server/routes/fiaon-diagnose.ts")));
  ok("Die Empfehlung ist ehrlich (Sperre abschalten)",
    /Fass ohne Boden/.test(ipQ) && /empfohlen: die Beschränkung dort ganz abschalten/.test(ipQ));

  const { ipDiagnose, gesehenIPs } = await import("../server/lib/fiaon-server-ip");
  const diag = await ipDiagnose();
  ok(`Gesehene Adressen: ${(await gesehenIPs()).length}`, Array.isArray(diag.ips));
  ok("Die Anleitung nennt die Brevo-Adresse",
    diag.anleitung.some((a) => a.includes("app.brevo.com/security/authorised_ips")));

  // Der ECHTE Fehler des Vorgesetzten — steht er in der Datenbank?
  const [echt] = (await sqlPool`
    SELECT grund FROM fiaon_mail_log WHERE grund ILIKE '%Freigabeliste%'
    ORDER BY created_at DESC LIMIT 1
  `) as any[];
  ok("Der echte Fehlergrund liegt im Protokoll vor", !!echt?.grund,
    echt?.grund ? String(echt.grund).slice(0, 70) : "keiner");

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("4. Mail-Zentrale: ein Empfängerfeld");
  // ═══════════════════════════════════════════════════════════════════════
  ok("Ein Feld für Kunden UND freie Adressen",
    /Name, Kundennummer oder E-Mail eintippen/.test(mailSeite));
  ok("Enter macht aus einer Adresse einen Chip",
    /e\.key !== "Enter"/.test(mailSeite) && /extern: true \} as Treffer\]/.test(mailSeite));
  ok("Gruppen liegen hinter EINEM Knopf", /setGruppenWahl\(true\)/.test(mailSeite));
  ok("… in einer FiaonEbene", /<FiaonEbene[\s\S]{0,300}Eine ganze Gruppe anschreiben/.test(mailSeite));
  ok("Die alte Knopfwand ist weg",
    !/Oder eine Gruppe/.test(mailSeite));
  ok("Das alte externe Extrafeld ist weg",
    !/Externe Adressen, mit Komma getrennt/.test(mailSeite));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("5. Knopf-System");
  // ═══════════════════════════════════════════════════════════════════════
  const cssQ = datei("client/src/styles/fiaon-design.css");
  ok("Primärknopf: Verlauf, Glanzkante, Farbschatten", /\.fi-knopf-primaer \{/.test(cssQ));
  ok("… Schrift IMMER weiß", /color: #fff !important;/.test(cssQ));
  ok("… auch bei verschachtelten Beschriftungen",
    /\.fi-knopf-primaer \* \{ color: inherit; \}/.test(cssQ));
  ok("… mit Druckgefühl", /\.fi-knopf-primaer:active[\s\S]{0,140}inset 0 2px 5px/.test(cssQ));
  ok("Sekundär ist Glas",
    /\.fi-knopf-glas \{/.test(cssQ) && /\.fi-knopf-glas[\s\S]{0,600}backdrop-filter: blur\(18px\)/.test(cssQ));
  ok("Gefahr ist zurückhaltend, Fläche erst im Dialog",
    /\.fi-knopf-gefahr \{[\s\S]{0,400}background: transparent/.test(cssQ)
    && /\.fi-knopf-gefahr-voll \{/.test(cssQ));
  ok("Das dunkle CI-Blau ist als Fläche verfügbar",
    /--fi-tief: #0a1a3c/.test(cssQ) && /\.fi-flaeche-tief/.test(cssQ));
  ok("Auf dunkler Fläche ist alles hell",
    /\.fi-flaeche-tief, \.fi-flaeche-tief \* \{ color: inherit; \}/.test(cssQ));

  const shellQ = datei("client/src/components/admin/AdminShell.tsx");
  ok("Kein slate-400 mehr auf „Sperren“", !/text-slate-400 hover:text-slate-600">Sperren/.test(shellQ));
  ok("… und nicht auf der Suche", !/bg-white text-\[12px\] text-slate-400/.test(shellQ));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("6. Space v3");
  // ═══════════════════════════════════════════════════════════════════════
  const spaceSeite = datei("client/src/pages/agent/space.tsx");
  const spaceRouten = datei("server/routes/fiaon-space.ts");
  const spaceLib = datei("server/lib/fiaon-space.ts");

  ok("Der alte Pfeil ist weg, FIAON hat ein Gesicht",
    /function SystemAvatar/.test(spaceSeite) && !/function AutoMarke/.test(spaceSeite));
  ok("… dieselbe Geste wie das Favicon", /M40 44 L50 34/.test(spaceSeite));
  ok("Jede Beitragsart hat eine Kennmarke", /const ART_MARKE/.test(spaceSeite));

  gleich("Genau zwei Reaktionen", (spaceLib.match(/REAKTIONEN = \["gut", "schlecht"\]/g) || []).length, 1);
  ok("Gefällt mir und Gefällt mir nicht",
    /titel: "Gefällt mir"/.test(spaceSeite) && /titel: "Gefällt mir nicht"/.test(spaceSeite));
  const [reste] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_post_reaktionen WHERE art NOT IN ('gut', 'schlecht')
  `) as any[];
  gleich("Keine alten Reaktionsarten übrig", Number(reste.n), 0);

  ok("Angepinntes steht in einer Leiste", /fi-sp-pinleiste/.test(spaceSeite));
  ok("… einzeilig und aufklappbar", /setPinOffen\(offen \? null : p\.id\)/.test(spaceSeite));
  ok("… und NICHT mehr im Feed", /const posts = alle\.filter\(\(p\) => !p\.angepinnt\)/.test(spaceSeite));

  ok("Eigener Beitrag ist änderbar", /router\.patch\("\/agent\/space\/:id"/.test(spaceRouten));
  ok(`… für ${15} Minuten`, /BEARBEITEN_MINUTEN = 15/.test(spaceRouten));
  ok("… danach nicht mehr", /alterMinuten > BEARBEITEN_MINUTEN/.test(spaceRouten));
  ok("… mit sichtbarer Marke", /bearbeitet_am = NOW\(\)/.test(spaceRouten) && /bearbeitet<\/span>/.test(spaceSeite));
  ok("Eigener Beitrag ist zurücknehmbar (weich)",
    /geloescht_at = NOW\(\)/.test(spaceRouten) && /Du kannst nur eigene Beiträge löschen/.test(spaceRouten));
  ok("Leitung darf jeden entfernen", /if \(!leitung && Number\(post\.autor_agent_id\)/.test(spaceRouten));

  ok("Auf Kommentare lässt sich antworten", /antwort_auf/.test(spaceRouten));
  ok("… genau EINE Ebene tief",
    /elternteil = e\.antwort_auf \? Number\(e\.antwort_auf\) : Number\(e\.id\)/.test(spaceRouten));
  ok("Eigener Kommentar ist löschbar", /space\/kommentar\/:id/.test(spaceRouten));
  ok("Ab drei Kommentaren wird eingeklappt", /oben\.slice\(0, 3\)/.test(spaceSeite));

  ok("Es gibt einen Admin-Space", /router\.get\("\/admin\/space"/.test(spaceRouten));
  ok("… mit Schreiben", /router\.post\("\/admin\/space"/.test(spaceRouten));
  ok("… Reagieren und Kommentieren",
    /admin\/space\/:id\/reaktion/.test(spaceRouten) && /admin\/space\/:id\/kommentar/.test(spaceRouten));
  ok("… Moderation und Anpinnen",
    /router\.delete\("\/admin\/space\/:id"/.test(spaceRouten) && /admin\/space\/:id\/anpinnen/.test(spaceRouten));
  ok("… und dem Umschalter „als FIAON“", /alsFiaon/.test(spaceRouten));
  ok("Die Oberfläche kennt beide Türen", /const basisWeg = alsAdmin/.test(spaceSeite));
  ok("Unter /admin OHNE AgentShell", /return alsAdmin \? inhalt : <AgentShell>/.test(spaceSeite));
  ok("Die Route ist eingehängt", /path="\/admin\/space"/.test(app));
  ok("… und steht im Menü", /path: "\/admin\/space"/.test(shellQ));

  // Die Pin-Grenze gilt auch dort.
  const [pins] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_posts WHERE angepinnt AND geloescht_at IS NULL
  `) as any[];
  ok(`Angepinnt derzeit: ${pins.n} (Grenze greift beim nächsten Anpinnen)`, Number(pins.n) >= 0);

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("7. Favicon und Browser-Identität");
  // ═══════════════════════════════════════════════════════════════════════
  for (const f of ["favicon.svg", "favicon-32.png", "apple-touch-icon.png",
                   "icon-maskable-512.png", "site.webmanifest"]) {
    ok(`Vorhanden: ${f}`, existsSync(`client/public/${f}`));
  }
  const html = datei("client/index.html");
  ok("SVG-Favicon eingebunden", /rel="icon" type="image\/svg\+xml"/.test(html));
  ok("PNG als Rückfall", /rel="icon" type="image\/png"/.test(html));
  ok("Apple-Touch-Icon", /rel="apple-touch-icon"/.test(html));
  ok("Manifest", /rel="manifest"/.test(html));
  ok("Theme-Farbe im CI-Dunkelblau", /content="#0A1A3C"/.test(html));
  const svg = datei("client/public/favicon.svg");
  ok("Die Marke ist ein F, kein Bildzeichen", /<rect x="19" y="17"/.test(svg));
  ok("… auf CI-Dunkelblau", /#0A1A3C/.test(svg));

  gleich("Titel Kunden-Zentrale", titelFuer("/admin/kunden"), "Kunden · FIAON");
  gleich("Titel Space", titelFuer("/agent/space"), "Space · FIAON");
  gleich("Titel Admin-Space", titelFuer("/admin/space"), "Space · FIAON");
  gleich("Öffentliche Seiten behalten ihren Titel", titelFuer("/"), null);
  ok("Der Titel wird beim Verlassen zurückgesetzt",
    /return \(\) => \{ document\.title = vorher; \}/.test(datei("client/src/lib/fiaon-titel.ts")));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("8. Wirtschaftlichkeit");
  // ═══════════════════════════════════════════════════════════════════════
  const [wa] = (await sqlPool`
    SELECT agent_id FROM fiaon_commissions WHERE status <> 'storniert'
    GROUP BY agent_id ORDER BY COUNT(*) DESC LIMIT 1
  `) as any[];
  const w = await wirtschaftlichkeit(Number(wa.agent_id));

  // DIE ZÄHLPROBE: Der Monatsumsatz muss GENAU dem entsprechen, was die
  // Rangliste rechnet. Zwei Zahlen auf derselben Seite, die sich um drei Euro
  // unterscheiden, kosten mehr Vertrauen als die ganze Ansicht wert ist.
  const [ref] = (await sqlPool`
    SELECT COALESCE(SUM(base_amount_cents) FILTER (WHERE amount_cents > 0 AND status != 'storniert'), 0)::bigint AS revenue
    FROM fiaon_commissions WHERE agent_id = ${wa.agent_id}
      AND created_at >= date_trunc('month', CURRENT_DATE)
  `) as any[];
  gleich("Keine zweite Umsatzzählung", w.monat.beitrag, Number(ref.revenue));

  gleich("Der Verlauf umfasst 30 Tage", w.verlauf.length, 30);
  ok("Es gibt einen Klartext-Satz", w.satz.length > 10, w.satz);
  ok("Kosten sind aufgeschlüsselt",
    typeof w.kosten.gehaltAnteil === "number" && typeof w.kosten.stunden === "number");
  const t = await teamWirtschaftlichkeit();
  ok("Die Summenzeile rechnet", typeof t.deckung === "number", t.satz);

  const wQ = datei("server/lib/fiaon-wirtschaftlichkeit.ts");
  ok("Arbeitstage statt Kalendertage", /arbeitstage/.test(wQ) && !/\/ 30\b/.test(wQ.split("verstrichen")[0]));
  ok("Ein Gehalt vor dem Startdatum kostet nichts", /gehaltAktiv/.test(wQ));
  ok("Die Grenzen der Zahl stehen dabei",
    /kein Deckungsbeitrag im buchhalterischen Sinn/.test(wQ));

  // GEHALT DARF NUR DER BETREIBER SEHEN.
  const teamQ = datei("server/routes/fiaon-team.ts");
  ok("Die Gehaltsroute liegt unter /admin", /admin\/team\/agents\/:id\/verguetung/.test(teamQ));
  ok("Wirtschaftlichkeit ebenfalls", /admin\/team\/wirtschaftlichkeit/.test(teamQ));
  // Response-Grep: Keine Nicht-Admin-Route darf das Feld je ausliefern.
  const nichtAdmin = ["server/routes/fiaon-agent.ts", "server/routes/fiaon-vertrieb.ts",
                      "server/routes/fiaon-agent-kunden.ts", "server/routes/fiaon-space.ts"];
  for (const f of nichtAdmin) {
    if (!existsSync(f)) continue;
    ok(`Kein Gehalt in ${f.split("/").pop()}`, !/festgehalt/i.test(datei(f)));
  }
  ok("Gehaltsänderungen werden protokolliert", /verguetung_geaendert/.test(teamQ));

  // Einladung mit Rolle.
  ok("Die Einladung trägt die Rolle", /const rolleNeu = ROLLEN_ERLAUBT\.includes/.test(teamQ));
  ok("… und wird gegen eine Liste geprüft",
    /ROLLEN_ERLAUBT = \["agent", "vertriebsleiter", "onboarding", "inkasso"\]/.test(teamQ));
  ok("… samt Vergütungsmodell", /MODELLE_ERLAUBT/.test(teamQ));
  const inviteQ = datei("client/src/components/admin/TeamVerwaltung.tsx");
  ok("Die Oberfläche fragt ZUERST die Position", /Wofür wird diese Person arbeiten/.test(inviteQ));
  ok("… und zeigt je Modell die passenden Felder", /const felder = MODELLE\[modell\]/.test(inviteQ));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("9. Als-Mitarbeiter-Ansicht");
  // ═══════════════════════════════════════════════════════════════════════
  const tok = ansichtTokenBauen(42);
  const geprueft = ansichtTokenPruefen(tok);
  gleich("Ein Token trägt die Kennung", geprueft?.agentId, 42);
  ok("… und läuft ab", (geprueft?.bis ?? 0) > Date.now());
  gleich("Gültigkeit in Minuten", ANSICHT_MINUTEN, 30);
  ok("Ein verfälschtes Token wird abgelehnt",
    ansichtTokenPruefen(tok.slice(0, -4) + "0000") === null);
  ok("Ein abgelaufenes Token wird abgelehnt",
    ansichtTokenPruefen("42.1000000000000.deadbeef") === null);
  ok("Unsinn wird abgelehnt", ansichtTokenPruefen("hallo") === null);
  ok("Kein Token = kein Problem", ansichtTokenPruefen(undefined) === null);

  // ── DER KATALOG: JEDE schreibende Methode wird abgelehnt ────────────────
  // Aus den registrierten Routen abgeleitet, nicht von Hand gepflegt.
  const routenDateien = ["fiaon-agent", "fiaon-space", "fiaon-agent-kunden",
                         "fiaon-team", "fiaon-mail", "fiaon-erste-schritte"];
  const schreibendeWege: { methode: string; pfad: string }[] = [];
  for (const f of routenDateien) {
    const pfad = `server/routes/${f}.ts`;
    if (!existsSync(pfad)) continue;
    for (const m of datei(pfad).matchAll(/router\.(post|put|patch|delete)\("([^"]+)"/g)) {
      schreibendeWege.push({ methode: m[1].toUpperCase(), pfad: m[2] });
    }
  }
  ok(`Katalog aus den Routen abgeleitet: ${schreibendeWege.length} schreibende Wege`,
    schreibendeWege.length > 25);

  // Jede davon durch die Middleware schicken.
  let abgelehnt = 0;
  let durchgelassen: string[] = [];
  for (const w2 of schreibendeWege) {
    const req: any = { method: w2.methode, path: w2.pfad, cookies: { fiaon_ansicht: tok } };
    let status = 0; let koerper: any = null;
    const res: any = {
      status(c: number) { status = c; return this; },
      json(b: any) { koerper = b; return this; },
    };
    let weiter = false;
    ansichtNurLesen(req, res, () => { weiter = true; });
    if (!weiter && status === 403 && koerper?.code === "NUR_ANSICHT") abgelehnt++;
    else if (w2.pfad.endsWith("/ansicht/beenden")) abgelehnt++;   // die eine erlaubte
    else durchgelassen.push(`${w2.methode} ${w2.pfad}`);
  }
  gleich("JEDE schreibende Route wird abgelehnt", durchgelassen.length, 0);
  if (durchgelassen.length) log(`        durchgelassen: ${durchgelassen.slice(0, 5).join(", ")}`);
  ok(`… geprüft: ${abgelehnt} Wege`, abgelehnt === schreibendeWege.length);

  // Lesen bleibt erlaubt.
  let lesenGeht = false;
  ansichtNurLesen(
    { method: "GET", path: "/agent/space", cookies: { fiaon_ansicht: tok } } as any,
    { status() { return this; }, json() { return this; } } as any,
    () => { lesenGeht = true; },
  );
  ok("Lesen bleibt erlaubt", lesenGeht);

  // Das Beenden muss durchkommen — sonst sitzt man fest.
  let beendenGeht = false;
  ansichtNurLesen(
    { method: "POST", path: "/agent/ansicht/beenden", cookies: { fiaon_ansicht: tok } } as any,
    { status() { return this; }, json() { return this; } } as any,
    () => { beendenGeht = true; },
  );
  ok("Das Beenden kommt durch — sonst käme man nicht heraus", beendenGeht);

  // Ohne Ansicht ändert die Middleware nichts.
  let normalGeht = false;
  ansichtNurLesen(
    { method: "POST", path: "/agent/space", cookies: {} } as any,
    { status() { return this; }, json() { return this; } } as any,
    () => { normalGeht = true; },
  );
  ok("Ohne Ansicht bleibt alles wie bisher", normalGeht);

  ok("Die Sitzung benutzt NIE das echte Cookie",
    /ANSICHT_COOKIE = "fiaon_ansicht"/.test(datei("server/lib/fiaon-ansicht.ts"))
    && !/fiaon_agent_token/.test(datei("server/lib/fiaon-ansicht.ts")));
  ok("Signaturvergleich ist zeitgleich", /timingSafeEqual/.test(datei("server/lib/fiaon-ansicht.ts")));
  // Der Typ wird AUSGESCHRIEBEN, nicht zusammengesetzt: Ein Ereignistyp aus
  // einem Template ist im Quelltext nicht suchbar, und der Aktivitäts-
  // Prüfstand hielt ihn deshalb für erfunden.
  ok("Start und Ende werden protokolliert",
    /"ansicht_gestartet" : "ansicht_beendet"/.test(datei("server/lib/fiaon-ansicht.ts")));
  ok("Die Wand hängt VOR allen Routen", /ansichtNurLesen/.test(datei("server/routes.ts")));
  ok("Nur der Vorgesetzte startet sie", /admin\/team\/ansicht\/:id/.test(teamQ));
  const sharedQ = datei("client/src/pages/agent/shared.tsx");
  ok("Der Banner ist da", /function AnsichtsBanner/.test(sharedQ));
  ok("… dunkelblau und oben fixiert", /position: "fixed", top: 0/.test(sharedQ));
  ok("… mit Namen und Beenden-Knopf",
    /Du siehst das Portal als \{agent\.name\}/.test(sharedQ) && /ansicht\/beenden/.test(sharedQ));
  ok("Der Knopf steht im Mitarbeiter-Detail",
    /Portal ansehen als \{m\.first_name/.test(datei("client/src/pages/admin-team-zentrale.tsx")));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("10. Telefon: Fehler in Klartext");
  // ═══════════════════════════════════════════════════════════════════════
  const { telefonFehler, telefonFehlerText } = await import("../shared/fiaon-telefon-fehler");

  // DER Fall, der in Produktion „undefined" ergab: ein Error OHNE message.
  const leer = new Error();
  ok("Ein Fehler ohne Text ergibt nie „undefined“",
    !/undefined/.test(telefonFehlerText(leer)), telefonFehlerText(leer));
  for (const attrappe of [null, undefined, {}, "", 0, { code: 0 }, new Error("")]) {
    const t = telefonFehlerText(attrappe);
    ok(`Kein „undefined“ bei ${JSON.stringify(attrappe) ?? "undefined"}`,
      t.length > 10 && !/undefined/.test(t));
  }
  gleich("Twilio 31402 wird erkannt", telefonFehler({ code: 31402 }).code, 31402);
  ok("… mit Klartext", /Mikrofon/.test(telefonFehler({ code: 31402 }).titel));
  ok("… und einem Handgriff", telefonFehler({ code: 31402 }).rat.length > 20);
  ok("Ein verschachtelter Code wird gefunden",
    telefonFehler({ originalError: { code: 21215 } }).code === 21215);
  ok("Geo-Sperre nennt die Console-Stelle",
    /Geographic Permissions/.test(telefonFehler({ code: 21215 }).rat));
  ok("Die Rohfassung bleibt fürs Protokoll",
    telefonFehler({ code: 31000, message: "x" }).roh.includes("31000"));
  ok("Softphone benutzt die Normalisierung",
    /telefonFehlerText/.test(datei("client/src/components/Softphone.tsx")));
  ok("… und NICHT mehr err.message",
    !/err instanceof Error \? err\.message : String\(err\)/.test(datei("client/src/components/Softphone.tsx")));

  const diagQ = datei("server/lib/fiaon-telefon-diagnose.ts");
  for (const [nr, was] of [[1, "Zugangsdaten"], [2, "Konto erreichbar"], [3, "API-Key"],
                           [4, "TwiML-App"], [5, "Absendernummer"], [6, "Geo"], [7, "Browser"]] as const) {
    ok(`Diagnose prüft Schritt ${nr}: ${was}`, new RegExp(`nr: ${nr},`).test(diagQ));
  }
  ok("Die Diagnose fragt Twilio SELBST, nicht die eigene Konfiguration",
    /api\.twilio\.com/.test(diagQ) && /Applications\/\$\{env/.test(diagQ));
  ok("Die TwiML-Soll-Adresse ist definiert",
    /telefon\/twiml/.test(diagQ) && /export function twimlSollUrl/.test(diagQ));
  ok("Es gibt eine Route dafür", /admin\/telefon\/diagnose/.test(datei("server/routes/fiaon-telefonie.ts")));
  ok("… und eine Karte in den Einstellungen",
    /Verbindung prüfen/.test(datei("client/src/pages/admin-einstellungen.tsx")));

  const { telefonDiagnose, twimlSollUrl } = await import("../server/lib/fiaon-telefon-diagnose");
  gleich("Die Soll-Adresse ist die öffentliche",
    twimlSollUrl(), "https://www.fiaon.com/api/fiaon/telefon/twiml");
  const dg = await telefonDiagnose();
  ok("Die Diagnose läuft durch und meldet konkret",
    dg.schritte.length >= 1 && dg.schritte.every((x: any) => x.befund.length > 10));
  ok("… und nennt bei Fehlern, was zu tun ist",
    dg.schritte.filter((x: any) => x.stand === "fehler").every((x: any) => !!x.rat));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("11. E-Mail-Rahmen: nur FIAON");
  // ═══════════════════════════════════════════════════════════════════════
  const { rahmen, rahmenText } = await import("../server/lib/fiaon-brevo");
  const mailHtml = rahmen("Test", "Hallo,\n\ndas ist ein Text.", false);
  ok("„Schwarzott“ steht in keiner Kundenmail", !/Schwarzott/i.test(mailHtml));
  ok("Die Marke steht im Kopf", /FIAON<\/div>/.test(mailHtml));
  ok("Impressum verlinkt", /fiaon\.com\/impressum/.test(mailHtml));
  ok("Datenschutz verlinkt", /fiaon\.com\/datenschutz/.test(mailHtml));
  ok("Kein Abmelde-Hinweis bei einer persönlichen Mail", !/keine Mails/.test(mailHtml));
  const htmlG = rahmen("Test", "Hallo", true);
  ok("… aber bei Gruppenversand schon", /keine Mails/.test(htmlG));
  const txt = rahmenText("Hallo,\n\ndas ist ein Text.", false);
  ok("Es gibt eine Textfassung", txt.includes("FIAON") && txt.includes("Impressum:"));
  ok("… ohne Schwarzott", !/Schwarzott/i.test(txt));
  const brevoQ = datei("server/lib/fiaon-brevo.ts");
  ok("Mehrteilig gesendet", /textContent: rahmenText/.test(brevoQ));
  ok("Absendername ist die Marke", /sender: \{ name: "FIAON"/.test(brevoQ));
  ok("Reply-To gesetzt", /replyTo: \{ name: "FIAON"/.test(brevoQ));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("12. Der Raum");
  // ═══════════════════════════════════════════════════════════════════════
  for (const f of ["raum-1080.mp4", "raum-720.mp4", "raum-1080.webm", "raum-poster.jpg"]) {
    ok(`Vorhanden: ${f}`, existsSync(`client/public/${f}`));
  }
  const { statSync } = await import("node:fs");
  const mb = (f: string) => statSync(`client/public/${f}`).size / 1048576;
  ok(`Desktop unter 4 MB (${mb("raum-1080.mp4").toFixed(2)})`, mb("raum-1080.mp4") < 4);
  ok(`Mobil unter 2 MB (${mb("raum-720.mp4").toFixed(2)})`, mb("raum-720.mp4") < 2);
  const raumQ = datei("client/src/components/FiaonRaum.tsx");
  ok("Poster steht sofort im Markup", /raum-poster\.jpg/.test(raumQ));
  // Nicht bloß „das Wort kommt vor": Die Startfunktion MUSS über den
  // Leerlauf-Rückruf laufen. Die erste Fassung dieser Prüfung blieb grün,
  // als ich den Rückruf auf null setzte — das Wort stand ja noch im
  // Kommentar daneben.
  ok("Video kommt erst nach dem Inhalt",
    /const ric = \(window as any\)\.requestIdleCallback;/.test(raumQ)
    && /ric \? ric\(start, \{ timeout: 2500 \}\)/.test(raumQ));
  ok("Reduzierte Bewegung liefert KEIN Video", /prefers-reduced-motion: reduce\)"\)\.matches\) return/.test(raumQ));
  ok("Datensparmodus wird geachtet", /saveData/.test(raumQ));
  ok("Schmal nutzt die 720er-Fassung", /schmal \? "\/raum-720\.mp4"/.test(raumQ));
  ok("Inhaltsdichte Seiten bekommen weniger", /dicht \? 0\.12 : 0/.test(raumQ));
  ok("Der Regler steht in den Einstellungen",
    /raumStaerkeSetzen/.test(datei("client/src/pages/admin-einstellungen.tsx")));
  ok("Die Vorgabe ist NICHT „aus“ (Number(null) === 0)",
    /if \(roh === null \|\| roh === ""\) return 2;/.test(raumQ));
  ok("Der Raum liegt hinter allem, einmal für alle Bereiche",
    /<FiaonRaum \/>/.test(app));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("13. Verhalten gegen echte Daten");
  // ═══════════════════════════════════════════════════════════════════════
  try {
    await sqlPool.begin(async (tx) => {
      const [a] = (await tx`
        INSERT INTO fiaon_agents (name, first_name, last_name, email, active, rolle,
                                  festgehalt_cents, gehalt_ab, verguetungsmodell)
        VALUES (${`Prüf Vered${stempel}`}, 'Prüf', ${`Vered${stempel}`},
                ${`v-${stempel}@pruefstand.test`.toLowerCase()}, TRUE, 'agent',
                252000, CURRENT_DATE - 10, 'fest_plus_provision')
        RETURNING id
      `) as any[];

      const w2 = await wirtschaftlichkeit(Number(a.id), undefined, tx as any);
      // 2520 € auf 21 Arbeitstage = 120 € am Tag.
      gleich("Tageskosten aus Festgehalt", w2.kosten.gehaltAnteil, 12000);
      gleich("Ohne Abschluss kein Beitrag", w2.beitrag, 0);
      gleich("… also 0 % gedeckt", w2.deckung, 0);
      ok("… und der Satz sagt es", /noch nichts hereingeholt/.test(w2.satz), w2.satz);

      // Ein Abschluss über 200 € deckt die 120 € nicht ganz? Doch — 200 > 120.
      await tx`
        INSERT INTO fiaon_commissions (agent_id, ref, base_amount_cents, rate_bp, amount_cents, status, kind)
        VALUES (${a.id}, ${`V-${stempel}`}, 20000, 1500, 3000, 'bestaetigt', 'own')
      `;
      const w3 = await wirtschaftlichkeit(Number(a.id), undefined, tx as any);
      gleich("Beitrag ist der Auftragswert", w3.beitrag, 20000);
      gleich("Kosten = Gehaltsanteil + Provision", w3.kosten.gesamt, 12000 + 3000);
      ok("… gedeckt, mit Uhrzeit", !!w3.gedecktAb, String(w3.gedecktAb));
      ok("… und der Satz nennt sie", /gedeckt ab/.test(w3.satz), w3.satz);

      // Ein Gehalt, das erst morgen beginnt, kostet heute nichts.
      await tx`UPDATE fiaon_agents SET gehalt_ab = CURRENT_DATE + 5 WHERE id = ${a.id}`;
      const w4 = await wirtschaftlichkeit(Number(a.id), undefined, tx as any);
      gleich("Gehalt vor dem Startdatum kostet nichts", w4.kosten.gehaltAnteil, 0);

      throw new Zurueckrollen();
    });
  } catch (e) {
    if (!(e instanceof Zurueckrollen)) throw e;
  }

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("14. Gegenprobe: nichts geschrieben");
  // ═══════════════════════════════════════════════════════════════════════
  const [nachher] = await sqlPool`
    SELECT (SELECT COUNT(*) FROM fiaon_agents)::int AS agenten,
           (SELECT COUNT(*) FROM fiaon_posts)::int AS posts,
           (SELECT COUNT(*) FROM fiaon_commissions)::int AS provisionen
  `;
  gleich("Kein Mitarbeiter übrig", nachher.agenten, vorher.agenten);
  gleich("Keine Provision übrig", nachher.provisionen, vorher.provisionen);
  ok(`Beiträge nicht verloren (${vorher.posts} → ${nachher.posts})`,
    Number(nachher.posts) >= Number(vorher.posts));
  const [r2] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_agents WHERE last_name LIKE ${`%${stempel}`}
  `) as any[];
  gleich("Keine eigene Zeile übrig", Number(r2.n), 0);

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
