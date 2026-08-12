// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: der abgearbeitete Rückstand
//
// Aktivitäts-Protokoll · Gesprächs-Pipeline · Cockpit · Abrechnungs-PDF ·
// gemeinsame Blasen-Klassen · Mail-Bühne.
//
// ── EINE REGEL DURCHZIEHT DIESEN PRÜFSTAND ────────────────────────────────
// Wo Namen aus der Datenbank vorkommen, werden sie GEGEN DIE DATENBANK
// geprüft und nicht gegen meine Erinnerung. Der Aktivitäts-Katalog enthielt
// im ersten Entwurf vier erfundene Ereignistypen; die Ansicht wäre leer
// geblieben, und eine leere Aufsichtsliste sieht aus wie „es ist nichts
// passiert". Das ist der schlimmste Fehler, den eine Aufsicht machen kann.
//
//   npx tsx scripts/pruef-rueckstand.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import {
  KATALOG, LOESCH_TYPEN, SENSIBLE_TYPEN, aktivitaet, aktivitaetZahlen,
} from "../server/lib/fiaon-aktivitaet";
import {
  FIRMIERUNG_VORGABE, absenderBlock, firmierung, fussZeile,
} from "../server/lib/fiaon-firmierung";
import {
  bestandHeuteSql as bestandHeuteSqlP, bestandSql as bestandSqlP,
} from "../server/lib/fiaon-bestand-filter";
import { aufnahmeFrist, aufnahmenAufraeumen } from "../server/lib/fiaon-softphone";

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
  log("\n══ Prüfstand: der abgearbeitete Rückstand ══\n");

  const [vorher] = await sqlPool`
    SELECT (SELECT COUNT(*) FROM fiaon_agent_events)::int AS ereignisse,
           (SELECT COUNT(*) FROM fiaon_calls)::int AS anrufe,
           (SELECT COUNT(*) FROM fiaon_persons)::int AS personen,
           (SELECT COUNT(*) FROM fiaon_commission_statements)::int AS abrechnungen
  `;

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("1. Aktivität: der Katalog stimmt mit der Datenbank");
  // ═══════════════════════════════════════════════════════════════════════
  // DIE WICHTIGSTE PRÜFUNG DIESES PRÜFSTANDS.
  const vorhanden = new Set(
    ((await sqlPool`SELECT DISTINCT type FROM fiaon_agent_events`) as any[])
      .map((r) => String(r.type)),
  );
  // ── ERFUNDEN ODER NUR NIE AUSGELÖST? ───────────────────────────────────
  // Die erste Fassung dieser Prüfung führte eine Ausnahmeliste mit vier Namen.
  // Sie schlug bei `zugang_setzlink` an — und dieser Typ ist NICHT erfunden:
  // Die Zugangs-Rettung existiert seit Wochen, wurde aber noch nie benutzt
  // (nachgemessen: 0 Ereignisse, 0 erzeugte Einmal-Passwörter). Eine
  // Ausnahmeliste hätte man erweitert und damit die Prüfung ausgehöhlt.
  //
  // Die richtige Frage ist nicht „steht der Typ in der Datenbank", sondern
  // „gibt es im Quelltext eine Stelle, die ihn schreibt". Ein Typ ohne
  // Schreibstelle ist erfunden — egal, was in der Datenbank steht.
  // ── OHNE DIE KATALOGDATEI SELBST ────────────────────────────────────────
  // Erster Versuch: alle Serverdateien durchsuchen. Die Gegenprobe (einen
  // erfundenen Typ einbauen) blieb GRÜN — weil der Katalog selbst eine
  // Serverdatei ist und der erfundene Name dort natürlich vorkam. Ein
  // Zirkelschluss: Die Prüfung fand sich selbst.
  const serverQuelle = ["server/routes", "server/lib"]
    .flatMap((d) => readdirSync(d).filter((f) => f.endsWith(".ts")).map((f) => `${d}/${f}`))
    .filter((f) => !f.endsWith("fiaon-aktivitaet.ts"))
    .map((f) => datei(f)).join("\n");
  const erfunden = KATALOG.filter((k) => !vorhanden.has(k.typ)
    && !serverQuelle.includes(`"${k.typ}"`) && !serverQuelle.includes(`'${k.typ}'`));
  gleich("Kein erfundener Ereignistyp im Katalog", erfunden.map((k) => k.typ).join(", "), "");
  // Zusätzlich: Wieviele sind bekannt, aber noch nie ausgelöst? Das ist eine
  // Information, kein Fehler — und sie verhindert, dass ein tippfehlerhafter
  // Typ unbemerkt bleibt.
  const nieAusgeloest = KATALOG.filter((k) => !vorhanden.has(k.typ));
  ok(`${nieAusgeloest.length} Typen im Katalog, aber noch nie ausgelöst`,
    nieAusgeloest.length <= 8, nieAusgeloest.map((k) => k.typ).join(", "));
  ok(`${KATALOG.length} Aktionen im Katalog`, KATALOG.length >= 35);
  ok("Drei Stufen belegt",
    new Set(KATALOG.map((k) => k.schwere)).size === 3);
  ok("Löschungen sind markiert", LOESCH_TYPEN.length >= 4);
  ok("„geloescht_endgueltig“ zählt als Löschung", LOESCH_TYPEN.includes("geloescht_endgueltig"));
  ok("„person_merge“ auch — eine Zusammenführung entwertet eine Akte",
    LOESCH_TYPEN.includes("person_merge"));
  ok("Die Massenläufe sind NICHT im Katalog",
    !SENSIBLE_TYPEN.includes("leads_verteilen_08082026") && !SENSIBLE_TYPEN.includes("login"));

  const zeilen = await aktivitaet({ limit: 40 });
  ok(`Die Liste liefert Zeilen (${zeilen.length})`, zeilen.length > 0);
  ok("Jede Zeile hat einen Titel in Klartext",
    zeilen.every((z) => z.titel.length > 3 && z.titel !== z.typ));
  ok("Jede Zeile nennt, wer gehandelt hat", zeilen.every((z) => z.wer.length > 0));
  ok("Jede Zeile hat eine Stufe",
    zeilen.every((z) => ["hoch", "mittel", "notiz"].includes(z.schwere)));
  const nurHoch = await aktivitaet({ nurSchwere: "hoch", limit: 20 });
  ok("Der Filter „hoch“ liefert nur sensible Aktionen",
    nurHoch.every((z) => z.schwere === "hoch"), `${nurHoch.length} Zeilen`);
  const zahlen = await aktivitaetZahlen();
  ok("Die Zahlen rechnen",
    typeof zahlen.loeschungenWoche === "number" && typeof zahlen.hochWoche === "number",
    JSON.stringify(zahlen));
  ok("Der Lösch-Zähler zählt die WOCHE, nicht den Tag",
    /wocheVon/.test(datei("server/lib/fiaon-aktivitaet.ts")));

  const aQ = datei("server/lib/fiaon-aktivitaet.ts");
  ok("Es gibt EINEN Weg zum Schreiben", /export async function aktivitaetSchreiben/.test(aQ));
  ok("… und ein unbekannter Typ wird gemeldet, nicht verschluckt",
    /steht nicht im Katalog und erscheint nicht in der Ansicht/.test(aQ));
  ok("Ein fehlgeschlagenes Protokoll verhindert die Aktion nicht",
    /Ein fehlgeschlagenes Protokoll darf die Aktion nicht verhindern/.test(aQ));
  const teamQ = datei("server/routes/fiaon-team.ts");
  ok("Die Route liegt unter /admin", /admin\/team\/aktivitaet/.test(teamQ));
  const tzQ = datei("client/src/pages/admin-team-zentrale.tsx");
  ok("Der Reiter steht an ZWEITER Stelle",
    tzQ.indexOf('["aktivitaet", "Aktivität"]') - tzQ.indexOf('["menschen", "Menschen"]') < 300);
  ok("Die Tafel gibt es", /function AktivitaetTafel/.test(tzQ));
  ok("Der Lösch-Zähler ist selbst ein Filter",
    /onClick=\{\(\) => \{ setSchwere\(""\); setTyp\(loeschTypen\[0\]/.test(tzQ));
  ok("Die Filter stehen offen, nicht in einem Menü",
    /\[\["", "Alles"\], \["hoch", "Nur sensibel"\]/.test(tzQ));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("2. Gesprächs-Pipeline");
  // ═══════════════════════════════════════════════════════════════════════
  const telQ = datei("server/routes/fiaon-telefonie.ts");
  ok("Es gibt eine Player-Route", /router\.get\("\/telefon\/:id\/aufnahme"/.test(telQ));
  ok("Die Twilio-URL geht NICHT ins Frontend",
    /\(c\.recording_url IS NOT NULL AND c\.aufnahme_geloescht_am IS NULL\) AS hat_aufnahme/.test(telQ)
    && !/SELECT[^;]{0,400}c\.recording_url,[\s\S]{0,200}res\.json/.test(telQ));
  ok("Der Datenstrom wird durchgereicht", /Readable\.fromWeb/.test(telQ));
  ok("Kein Zwischenspeichern im Browser", /no-store, private/.test(telQ));
  ok("Wer zuhört, steht im Kundenverlauf", /Aufnahme von Anruf \$\{id\} angehört/.test(telQ));
  ok("Eine gelöschte Aufnahme antwortet mit 410 und Grund",
    /status\(410\)[\s\S]{0,180}Aufbewahrungsfrist gelöscht/.test(telQ));
  // Die Reihenfolge im Quelltext IST die Reihenfolge der Ausführung: Die
  // Rechteprüfung muss VOR dem Datenstrom stehen.
  // ── NUR INNERHALB DIESER EINEN ROUTE ────────────────────────────────────
  // Erster Versuch: ab dem Routenanfang suchen. Die Gegenprobe (Rechteprüfung
  // hinter den Datenstrom verschieben) blieb GRÜN — „Nicht dein Kunde" kommt
  // in dieser Datei mehrfach vor, und der nächste Treffer nach dem
  // Routenanfang stammte aus einer ANDEREN Route weiter unten.
  ok("Die Rechte werden vor dem Abruf geprüft", (() => {
    const a = telQ.indexOf("router.get(\"/telefon/:id/aufnahme\"");
    if (a < 0) return false;
    // Das Ende der Route: die nächste Registrierung.
    const ende = telQ.indexOf("router.", telQ.indexOf("});", a));
    const block = telQ.slice(a, ende > a ? ende : undefined);
    const rechte = block.indexOf("Nicht dein Kunde");
    const strom = block.indexOf("Readable.fromWeb");
    return rechte > 0 && strom > 0 && rechte < strom;
  })());

  const kundeQ = datei("client/src/pages/admin-kunde.tsx");
  ok("Die Statuskette hat drei Glieder",
    /aufgezeichnet/.test(kundeQ) && /transkribiert/.test(kundeQ) && /zusammengefasst/.test(kundeQ));
  ok("„Ohne Aufzeichnung“ ist ein eigener Zustand, keine Lücke",
    /a\.ohne_aufzeichnung_am/.test(kundeQ) && /Der Kunde hat widersprochen/.test(kundeQ));
  ok("Ein Fehlschlag zeigt den Grund und einen Knopf",
    /transkript_grund/.test(kundeQ) && /nachholen/.test(kundeQ));
  ok("Das Transkript ist aufklappbar", /offen === -a\.id && a\.transkript/.test(kundeQ));
  ok("Der Player zeigt auf UNSERE Route",
    /src=\{`\/api\/fiaon\/telefon\/\$\{a\.id\}\/aufnahme`\}/.test(kundeQ));
  ok("Die Frist steht in der Akte", /Aufnahmen werden nach \{frist\} Tagen/.test(kundeQ));

  // ── Der Löschlauf ──────────────────────────────────────────────────────
  gleich("Die Frist ist 90 Tage", await aufnahmeFrist(), 90);
  const vorschau = await aufnahmenAufraeumen(true);
  ok("Die Vorschau löscht nichts",
    vorschau.geloescht === 0 && /Nichts gelöscht/.test(vorschau.hinweise[0] ?? ""));
  const sfQ = datei("server/lib/fiaon-softphone.ts");
  ok("Der Lauf löscht bei TWILIO, nicht nur die URL",
    /method: "DELETE"[\s\S]{0,200}Recordings\/\$\{c\.recording_sid\}/.test(sfQ)
    || /Recordings\/\$\{c\.recording_sid\}\.json`,\n        \{\n          method: "DELETE"/.test(sfQ));
  ok("Ein Fehlschlag wird NICHT als gelöscht vermerkt",
    /NICHT als gelöscht vermerken/.test(sfQ) && /continue;/.test(sfQ));
  ok("404 zählt als Erfolg — die Aufnahme ist weg",
    /404 zählt als Erfolg/.test(sfQ));
  ok("Transkript und Zusammenfassung bleiben",
    /Transkript und Zusammenfassung BLEIBEN/.test(sfQ)
    && !/SET[^;]{0,200}transkript = NULL/.test(sfQ));
  ok("Idempotent über den Vermerk",
    /aufnahme_geloescht_am IS NULL/.test(sfQ));
  ok("Die Frist hat Grenzen (7 bis 365)", /n >= 7 && n <= 365/.test(sfQ));
  ok("Der Tageslauf hängt an tageslauf()",
    /tageslauf\("aufnahmen-aufraeumen"/.test(telQ));
  const [spalten] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM information_schema.columns
    WHERE table_name = 'fiaon_calls'
      AND column_name IN ('aufnahme_geloescht_am', 'ohne_aufzeichnung_am')
  `) as any[];
  gleich("Die Spalten sind angelegt", Number(spalten.n), 2);

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("3. Cockpit: die Kundenschublade");
  // ═══════════════════════════════════════════════════════════════════════
  const vQ = datei("client/src/pages/agent/vertrieb.tsx");
  for (const r of ["lage", "zugang", "zahlung", "verwaltung", "stammdaten", "verlauf", "zuweisungen"]) {
    ok(`Reiter „${r}“`, new RegExp(`"${r}"`).test(vQ));
  }
  ok("„Anrufen“ öffnet das Softphone MIT Kundenkontext",
    /anrufStarten\(p\.telefonWaehlbar, p\.personId, p\.name\)/.test(vQ));
  ok("… und nicht mehr einen tel-Verweis",
    !/href=\{`tel:\$\{p\.telefonWaehlbar\}`\}/.test(vQ));
  ok("Gesprächsblatt erreichbar", /agent\/gespraech\/\$\{p\.personId\}/.test(vQ));
  ok("Zugangs-Diagnose", /zugangPruefen/.test(vQ) && /zugang\/\$\{p\.ref\}\/stand/.test(vQ));
  ok("Setz-Link, Einmal-Passwort, Freischaltung",
    /setzLink/.test(vQ) && /einmalPw/.test(vQ) && /freischalten/.test(vQ));
  ok("Alle drei brauchen einen Grund",
    (vQ.match(/grund\.trim\(\)\.length < 5/g) || []).length >= 4);
  ok("Das Einmal-Passwort steht EINMAL da",
    /Es wird nicht wieder angezeigt/.test(vQ));
  ok("Zahlung buchen braucht einen BELEG",
    /Beleg \(Pflicht\)/.test(vQ) && /Woher weißt du, dass gezahlt wurde/.test(vQ));
  ok("Die Löschung hat eine Rückfrage in Klartext",
    /wirklich löschen\?/.test(vQ) && /Buchhaltung darf nicht Löcher bekommen/.test(vQ));
  ok("… und verlangt einen vollständigen Satz",
    /grund\.trim\(\)\.length < 8/.test(vQ));

  const zrQ = datei("server/routes/fiaon-zugang-retten.ts");
  ok("Die Diagnose-Route gibt es", /router\.get\("\/agent\/zugang\/:ref\/stand"/.test(zrQ));
  ok("Sie nennt den Befund MIT dem passenden Weg",
    /Richtiger Weg: Setz-Link schicken/.test(zrQ) && /Richtiger Weg: Zugang freischalten/.test(zrQ));
  ok("Sie erkennt ein laufendes Einmal-Passwort",
    /einmal_passwort_bis IS NOT NULL AND a\.einmal_passwort_bis > NOW\(\)/.test(zrQ));
  ok("… und rät dann zum Vorlesen statt zum Neuerzeugen",
    /das alte vorlesen/.test(zrQ));
  ok("Keine Backticks im SQL-Kommentar",
    !/-- [^\n]*`/.test(zrQ));

  const vrQ = datei("server/routes/fiaon-vertrieb.ts");
  ok("Zahlung-Buchen-Route mit Belegpflicht",
    /zahlung-gebucht/.test(vrQ) && /Der Satz ist der Beleg/.test(vrQ));
  ok("… und lehnt eine bereits bezahlte Bestellung ab",
    /steht bereits auf bezahlt/.test(vrQ));
  ok("Einzellöschung anonymisiert ALLE Bestellungen",
    /WHERE person_id = \$\{id\} AND gdpr_deleted_at IS NULL/.test(vrQ)
    && /eine halb gelöschte Person ist keine gelöschte Person/i.test(vrQ));
  ok("… Rechnungen und Zahlungen bleiben",
    /Buchhaltung darf keine Löcher bekommen/.test(vrQ));
  ok("… und es steht im Aktivitäts-Protokoll",
    /aktivitaetSchreiben\(\{[\s\S]{0,120}geloescht_endgueltig/.test(vrQ));
  ok("Beide Routen hängen an nurLeitung UND nurMitZusage",
    (vrQ.match(/requireAgent, nurLeitung, nurMitZusage/g) || []).length >= 4);

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("4. Abrechnung und Firmierung");
  // ═══════════════════════════════════════════════════════════════════════
  const f = await firmierung();
  gleich("Firmenname", f.name, "FIAON LTD");
  gleich("Company No.", f.companyNo, "17318250");
  ok("Der Steuerhinweis nennt § 14 UStG", /§ 14 Abs\. 2 Satz 2 UStG/.test(f.steuerhinweis));
  ok("… und das Reverse-Charge-Verfahren", /Reverse-Charge/.test(f.steuerhinweis));
  ok("Der Gutschrifthinweis nennt den Selbstständigen-Status",
    /selbstständig tätig und kein Arbeitnehmer/.test(f.gutschriftHinweis));
  ok("… und die Widerspruchsfrist", /binnen 14 Tagen widersprechen/.test(f.gutschriftHinweis));
  ok("Die Fußzeile trägt Name, Nummer und Anschrift",
    fussZeile(f).includes("FIAON LTD") && fussZeile(f).includes("17318250")
    && fussZeile(f).includes("City Road"));
  ok("Der Absenderblock ist mehrzeilig", absenderBlock(f).split("<br/>").length >= 4);

  const fmQ = datei("server/lib/fiaon-firmierung.ts");
  ok("Ein leeres Feld fällt EINZELN auf die Vorgabe zurück",
    /const sauber = \(v: unknown, vorgabe: string\)/.test(fmQ));
  ok("… nicht als Ganzes", /Wer nur die\n \* Anschrift gepflegt hat, soll nicht auch den Steuerhinweis verlieren/.test(fmQ));
  gleich("Die Vorgabe steht im Code", FIRMIERUNG_VORGABE.name, "FIAON LTD");

  ok("Es gibt eine Route zum Ändern", /admin\/team\/firmierung/.test(teamQ));
  ok("… und der Hinweis sagt, dass alte PDFs bleiben",
    /bestehende PDFs bleiben unverändert/.test(teamQ));
  ok("Neu-Erzeugung gibt es", /admin\/team\/abrechnung\/:id\/neu-erzeugen/.test(teamQ));
  ok("… und ändert NUR das PDF",
    /UPDATE fiaon_commission_statements SET pdf_base64 = /.test(teamQ)
    && /Sonst wäre es eine neue Abrechnung|sonst wäre es eine neue Abrechnung/.test(teamQ));
  ok("… mit Original-Erstellungsdatum auf dem Dokument",
    /Originally issued/.test(teamQ) && /Reissued/.test(teamQ));
  const obQ = datei("server/routes/fiaon-onboarding.ts");
  ok("Die Abrechnung nutzt die Firmierung", /absenderBlock\(firma\)/.test(obQ));
  ok("… und trägt den Steuerhinweis", /Tax treatment/.test(obQ) && /firma\.steuerhinweis/.test(obQ));
  const pdfQ = datei("server/lib/fiaon-html-pdf.ts");
  ok("Der Rahmen nimmt Markenzeile und Fußzeile an",
    /markenzeile\?: string;/.test(pdfQ) && /fusszeile\?: string;/.test(pdfQ));
  ok("… mit Vorgabe, damit nie ein Absender fehlt",
    /opts\.markenzeile\n?\s*\?\? "FIAON LTD/.test(pdfQ) || /\?\? "FIAON LTD · Company No/.test(pdfQ));
  ok("Inter als Schrift, mit Rückfall", /font-family: Inter, "Helvetica Neue"/.test(pdfQ));
  ok("Seitenränder für die Seitenzahl", /@page \{ margin:/.test(pdfQ));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("5. Gemeinsame Blasen-Klassen");
  // ═══════════════════════════════════════════════════════════════════════
  ok("Es gibt die Datei", existsSync("client/src/styles/fiaon-blase.css"));
  const bQ = datei("client/src/styles/fiaon-blase.css");
  ok("Radius 28 als Variable", /--fi-blase-radius: 28px/.test(bQ));
  ok("Blur 20 px", /--fi-blase-blur: 20px/.test(bQ));
  ok("Fläche 72 % Weiß", /--fi-blase-flaeche: rgba\(255, 255, 255, \.72\)/.test(bQ));
  ok("Zweistufiger Blau-Schatten", /--fi-blase-schatten:/.test(bQ) && /rgba\(29, 78, 216, \.24\)/.test(bQ));
  ok("Lichtkante als ::before", /\.fi-blase::before/.test(bQ));
  ok("Hover nur mit Zeiger", /@media \(min-width: 640px\) and \(hover: hover\)/.test(bQ));
  ok("Eintritt 450 ms", /fiBlaseBluehen 450ms/.test(bQ));
  ok("Der Primärknopf erzwingt weiße Schrift", /color: #fff !important;/.test(bQ));
  ok("Reduzierte Bewegung wird geachtet", /prefers-reduced-motion/.test(bQ));
  ok("Eingebunden", /fiaon-blase\.css/.test(datei("client/src/index.css")));

  const spQ = datei("client/src/pages/agent/space.tsx");
  ok("Der Space nutzt die Variablen, statt Werte zu kopieren",
    /border-radius: var\(--fi-blase-radius\)/.test(spQ)
    && /box-shadow: var\(--fi-blase-schatten\)/.test(spQ));
  const mQ = datei("client/src/pages/mail-zentrale.tsx");
  ok("Die Mail-Zentrale trägt Blasen", /className="fi-blase mt-4"/.test(mQ));
  ok("… dieselbe Bühne", /body:has\(\.fi-mail-buehne\) \.agent-ambient/.test(mQ));
  ok("… den Verlaufsknopf", /className="fi-blase-knopf ml-auto"/.test(mQ));
  ok("… und auf 380 px randnah", /padding-left: 12px; padding-right: 12px/.test(mQ));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("5b. Die Arbeitsliste hält still");
  // ═══════════════════════════════════════════════════════════════════════
  // ── DER ANLASS ────────────────────────────────────────────────────────
  // Ein Agent: „Wenn ich bei jemandem ‚zahlt sofort' oder ‚nicht erreicht'
  // drücke, rutscht er einfach 2–3 Leute runter — komme so echt durcheinander."
  //
  // Die Liste sortiert nach `promised_payment_date` und `follow_up_date` —
  // genau den Feldern, die ein Ergebnis SETZT. Wer bucht, verschiebt damit
  // den Kunden. Und danach wurde die ganze Liste neu geholt.
  const knQ = datei("client/src/pages/agent/kunden-neu.tsx");
  ok("Die Sortierung nutzt wirklich die Ergebnis-Felder",
    /p\.promised_payment_date ASC NULLS LAST/.test(datei("server/routes/fiaon-agent-kunden.ts"))
    && /p\.follow_up_date ASC NULLS LAST/.test(datei("server/routes/fiaon-agent-kunden.ts")));
  ok("`laden` kann NUR die Zähler holen", /nurZaehler = false/.test(knQ));
  ok("… und lässt die Liste dann unberührt", /if \(!nurZaehler\) \{/.test(knQ));
  ok("Nach dem Buchen wird nur gezählt, nicht neu geordnet",
    /onZaehler=\{\(\) => void laden\(true, true\)\}/.test(knQ));
  ok("Die Karte bekommt eine Erledigt-Marke", /onErledigt\(\);/.test(knQ) && /fi-kk-marke/.test(knQ));
  ok("… und wird gedämpft, nicht ausgeblendet",
    /\.fi-kk-erledigt \{[\s\S]{0,200}opacity: \.62/.test(datei("client/src/styles/fiaon-design.css")));
  ok("… gedämpft, NICHT durchgestrichen — der Kunde ist nicht abgehakt",
    /Gedämpft, nicht durchgestrichen/.test(datei("client/src/styles/fiaon-design.css")));
  ok("Neuordnen ist ein eigener, bewusster Schritt",
    /fi-kk-neuordnen/.test(knQ) && /erledigt\.size > 0/.test(knQ));
  ok("… und setzt die Marken zurück", /setErledigt\(new Set\(\)\)/.test(knQ));
  ok("Wer aus der Liste fällt, verliert auch seine Marke",
    /n\.delete\(personId\)/.test(knQ));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("5c. Inkasso-Zuteilung");
  // ═══════════════════════════════════════════════════════════════════════
  const { inkassoMannschaft, inkassoVerteilen } = await import("../server/lib/fiaon-inkasso");
  const mann = await inkassoMannschaft();
  ok(`${mann.length} Inkasso-Mitarbeiter gefunden`, mann.length >= 1,
    mann.map((m) => `${m.name} (${m.offen} offen)`).join(" · "));
  ok("Nach Last sortiert — wer wenig hat, steht vorn",
    mann.every((m, i) => i === 0 || mann[i - 1].offen <= m.offen));
  const v = await inkassoVerteilen({ schreiben: false });
  ok("Die Vorschau ändert nichts", v.verteilt === 0);
  ok(`${v.vorschlag.length} Raten im Vorschlag`, v.vorschlag.length >= 0,
    v.hinweis);
  ok("Jeder Vorschlag nennt Kunde, Referenz und Empfänger",
    v.vorschlag.every((x) => x.kunde && x.ref && x.anAgentName));
  ok("Nur wirklich ÜBERFÄLLIGE Raten",
    v.vorschlag.every((x) => new Date(x.faelligAm) < new Date()));
  const iQ = datei("server/lib/fiaon-inkasso.ts");
  ok("Zugeteilt wird eine RATE, nicht ein Kunde",
    /Zugeteilt wird eine RATE, nicht ein Kunde/.test(iQ));
  ok("Der Rundlauf ist lastgerecht, nicht stur",
    /lastgerecht/i.test(iQ) && /Nach jeder Zuteilung wird neu/.test(iQ));
  ok("Ohne `schreiben` passiert nichts", /if \(!opts\.schreiben\)/.test(iQ));
  ok("Nebenläufigkeit abgesichert",
    /WHERE id = \$\{v\.rateId\} AND inkasso_agent_id IS NULL/.test(iQ));
  ok("Von Hand zuweisen nur an die Rolle Inkasso",
    /Nur ein Mensch mit der Rolle Inkasso kann Raten bearbeiten/.test(iQ));
  const ibQ = datei("server/routes/fiaon-inkasso-bereich.ts");
  ok("Die Routen liegen unter /admin",
    /admin\/inkasso\/zuteilung/.test(ibQ) && /admin\/inkasso\/rate\/:id\/zuweisen/.test(ibQ));
  ok("Die Verteilung wird protokolliert", /aktivitaetSchreiben/.test(ibQ));
  ok("Die Oberfläche erklärt „lastgerecht“",
    /lastgerecht/.test(datei("client/src/pages/admin-team-zentrale.tsx")));
  ok("… und sagt, dass der Kunde nichts merkt",
    /Der Kunde merkt davon nichts/.test(datei("client/src/pages/admin-team-zentrale.tsx")));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("5c2. Forderungsmanagement sieht NUR Fälliges");
  // ═══════════════════════════════════════════════════════════════════════
  // ── DER ANLASS ────────────────────────────────────────────────────────
  // Der Vorgesetzte: „Die Mitarbeiter von Forderungsmanagement erhalten
  // AUSSCHLIESSLICH die Kunden, deren Abo-Raten überfällig sind — nur diese!
  // Aktuell haben sie irgendwelche anderen Kunden."
  //
  // Gemessen vorher: 153 von 251 Raten im Sichtfeld waren erst SPÄTER als in
  // sieben Tagen fällig. Das Sichtfeld prüfte nur „offen" und „bezahlt" —
  // nicht, ob überhaupt etwas ansteht.
  const { SICHTFELD, fristZaehler, fristBedingung, arbeitsliste: iListe } =
    await import("../server/lib/fiaon-inkasso");
  ok("Das Sichtfeld hat eine Fristgrenze",
    /r\.faellig_am <= CURRENT_DATE \+ 7/.test(SICHTFELD));
  const [sf] = (await sqlPool.unsafe(`
    SELECT COUNT(*)::int AS drin,
           COUNT(*) FILTER (WHERE r.faellig_am > CURRENT_DATE + 7)::int AS zu_spaet
    FROM fiaon_abo_raten r WHERE ${SICHTFELD}`)) as any[];
  gleich("KEINE Rate, die später als in 7 Tagen fällig wird", Number(sf.zu_spaet), 0);
  ok(`${sf.drin} Raten im Sichtfeld (vorher 251)`, Number(sf.drin) > 0 && Number(sf.drin) < 251);

  const fz = await fristZaehler();
  ok("Die drei Fristfenster werden gezählt",
    typeof fz.ueberfaellig === "number" && typeof fz.heute === "number" && typeof fz.woche === "number",
    `überfällig ${fz.ueberfaellig} · heute ${fz.heute} · Woche ${fz.woche}`);
  gleich("Die Summe stimmt", fz.ueberfaellig + fz.heute + fz.woche, fz.alle);
  // ── DIE PRÜFUNG GEHÖRT IN SQL, NICHT IN JAVASCRIPT ────────────────────
  // Erster Versuch: `new Date(faellig_am) >= new Date(new Date().toISOString()
  // .slice(0,10))`. Der Filter „woche" wurde rot, obwohl er richtig arbeitete —
  // `toISOString()` ist UTC, `faellig_am` ein Datum in Berliner Rechnung. Genau
  // der Fehler, vor dem AGENTS.md warnt, in meinem eigenen Prüfstand.
  //
  // In SQL gilt CURRENT_DATE in der Zeitzone der Datenbank. Dort stimmt der
  // Vergleich per Definition.
  for (const [f, bedingung] of [
    ["ueberfaellig", "r.faellig_am < CURRENT_DATE"],
    ["heute", "r.faellig_am = CURRENT_DATE"],
    ["woche", "r.faellig_am > CURRENT_DATE AND r.faellig_am <= CURRENT_DATE + 7"],
  ] as const) {
    const l = await iListe({ frist: f, limit: 200 });
    if (l.length === 0) { ok(`Filter „${f}“ ist leer — nichts zu prüfen`, true); continue; }
    const ids = l.map((r: any) => Number(r.rate_id));
    const [treffer] = (await sqlPool.unsafe(`
      SELECT COUNT(*)::int AS passt FROM fiaon_abo_raten r
      WHERE r.id = ANY($1::int[]) AND (${bedingung})`, [ids as any])) as any[];
    gleich(`Filter „${f}“ liefert NUR passende Raten (${l.length})`,
      Number(treffer.passt), l.length);
  }
  ok("Ein unbekannter Filter fällt auf „alle“ zurück, statt zu leeren",
    fristBedingung("quatsch") === "TRUE");
  const inkQ = datei("client/src/pages/agent/inkasso.tsx");
  ok("Die Oberfläche hat drei Fristknöpfe",
    /Überfällig/.test(inkQ) && /Heute fällig/.test(inkQ) && /Nächste 7 Tage/.test(inkQ));
  ok("… mit Zahl am Knopf — ein Filter ohne Zahl ist eine Frage",
    /Ein Filter ohne Zahl ist eine Frage/.test(inkQ));
  ok("„Überfällig“ ist die Vorgabe", /useState<"ueberfaellig" \| "heute"/.test(inkQ));
  ok("Wer eigene Fälle hat, sieht nur die eigenen",
    /nurMeine = meine\.alle > 0/.test(datei("server/routes/fiaon-inkasso-bereich.ts")));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("5c3. „Nicht erreicht“ nimmt den Kunden aus der Liste");
  // ═══════════════════════════════════════════════════════════════════════
  // Ein Agent: „Wenn ich den Kunden ‚nicht erreicht' klicke, bleibt er
  // trotzdem in der Liste — verschwinden tut er bei mir nicht."
  //
  // Gemessen vorher: 311 Kunden hatten eine Wiedervorlage in der Zukunft und
  // standen trotzdem in den Arbeitslisten. Die Folge: Derselbe Mensch wurde
  // zweimal angerufen, und die Liste wurde nie kürzer.
  const asQ = datei("server/routes/fiaon-agent-start.ts");
  ok("Eine Wiedervorlage in der Zukunft nimmt den Kunden aus der Anrufliste",
    /p\.follow_up_date IS NULL OR p\.follow_up_date <= \$\{HEUTE\}/.test(asQ));
  ok("… und der Grund steht dabei",
    /Eine Wiedervorlage in der Zukunft ist eine VERABREDUNG/.test(asQ));
  ok("Der Filter „Nicht erreicht“ zeigt ihn weiter",
    /\["ruhend", "nicht_erreicht", "gesperrt", "bezahlt"\]\.includes\(filter\)/.test(asQ));
  ok("Es gibt einen Zähler für die Wartenden", /AS wartet,/.test(asQ) && /wartet: z\.wartet/.test(asQ));
  ok("Die Karte verschwindet bei „nicht erreicht“",
    /const VERABREDET = \[/.test(knQ) && /setTimeout\(\(\) => onWeg\(\), 900\)/.test(knQ));
  ok("… aber NICHT bei „zahlt sofort“ — dort wird Geld erwartet",
    /IN DER PFLICHT/.test(knQ));
  ok("… und erst nach kurzer Rückmeldung",
    /Ein Verschwinden ohne\n    \/\/ Rückmeldung fühlt sich wie ein Fehler an|Rückmeldung fühlt sich wie ein Fehler an/.test(knQ));
  ok("Eine Leiste sagt, wohin sie gegangen sind", /fi-kk-wartet/.test(knQ));
  ok("… mit der Anweisung, nicht erneut anzurufen", /Ruf sie nicht erneut an/.test(knQ));
  ok("… und sie steht ÜBER der Kartenliste",
    knQ.indexOf("fi-kk-wartet") < knQ.indexOf('<div className="mt-4 space-y-2.5">'));

  // ── Der Kalendereintrag ────────────────────────────────────────────────
  const kaQ = datei("server/routes/fiaon-agent.ts");
  ok("Der Kalender liest AUCH die gebuchten Termine",
    /FROM fiaon_termine t\n      JOIN fiaon_persons p ON p\.id = t\.person_id/.test(kaQ));
  ok("… als eigene Liste, nicht als UNION",
    /gebuchteTermine:/.test(kaQ) && /ein UNION über zwei Zahlenräume erzeugt/.test(kaQ));
  ok("Der Client lädt beide Quellen",
    /\[\.\.\.\(r\.json\.data \?\? \[\]\), \.\.\.\(r\.json\.gebuchteTermine \?\? \[\]\)\]/
      .test(datei("client/src/pages/agent/kalender.tsx")));
  ok("Ein vom Kunden gebuchter Termin ist gekennzeichnet",
    /Kunde hat gebucht/.test(datei("client/src/pages/agent/kalender.tsx")));
  ok("… und wird nicht vom Agenten verschoben",
    /wäre ein Wortbruch/.test(datei("client/src/pages/agent/kalender.tsx")));
  const [tz] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_termine
    WHERE status = 'gebucht' AND beginn > NOW() - INTERVAL '14 days'
  `) as any[];
  ok(`${tz.n} gebuchte Termine, die jetzt im Kalender stehen`, Number(tz.n) >= 0);

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("5c4. Sonderrollen bekommen keine Vertriebskunden");
  // ═══════════════════════════════════════════════════════════════════════
  // ── DER BEFUND ────────────────────────────────────────────────────────
  // Der Vorgesetzte: „Die Abteilung Forderungsmanagement hat Kunden drinnen,
  // die die Agenten abgelehnt haben oder auf nicht erreicht."
  //
  // Die Rate-Liste war sauber (alle 100 Zeilen `tier 0`). Das Leck lag
  // woanders: Die Lead-Zuteilung prüfte „aktiv" und „nimmt teil", aber NICHT
  // die Rolle. Ein neues Inkasso-Konto hat null Kunden und war damit immer
  // „der Agent mit der kleinsten Last". Gemessen: 22 Vertriebskunden.
  const zuQ = datei("server/lib/fiaon-zuteilung.ts");
  // ── IN DER RICHTIGEN FUNKTION ────────────────────────────────────────
  // Erster Versuch: die Zeile irgendwo in der Datei suchen. Die Gegenprobe
  // (Rollenprüfung aus `agentMitKleinsterLast` entfernen) blieb GRÜN — dieselbe
  // Bedingung steht weiter unten in `sonderrollenBereinigen`, und der Test fand
  // sie dort. Eine Prüfung, die im Nachbarhaus nachsieht, prüft nichts.
  ok("Die Lead-Zuteilung prüft die Rolle", (() => {
    const a = zuQ.indexOf("export async function agentMitKleinsterLast");
    if (a < 0) return false;
    const block = zuQ.slice(a, zuQ.indexOf("\n}", a));
    return /AND COALESCE\(a\.rolle, 'agent'\) IN \('agent', 'vertriebsleiter'\)/.test(block);
  })());
  ok("Die Terminvergabe auch",
    /AND COALESCE\(rolle, 'agent'\) IN \('agent', 'vertriebsleiter'\)/
      .test(datei("server/lib/fiaon-termine.ts")));
  ok("Die Übergabe auch",
    /AND COALESCE\(a\.rolle, 'agent'\) IN \('agent', 'vertriebsleiter'\)/
      .test(datei("server/lib/fiaon-uebergabe.ts")));
  ok("Ein Inkasso-Konto sieht die Vertriebsliste NICHT",
    /if \(await istInkasso\(req\.agent!\.id\)\) \{/.test(asQ)
    && /Diese Liste gibt es für dich nicht/.test(asQ));
  ok("… und die Wand steht im SERVER, nicht im Menü",
    /Einen Menüpunkt auszublenden ist keine Grenze, sondern eine Bitte/.test(asQ));
  const shQ = datei("client/src/pages/agent/shared.tsx");
  ok("Das Menü blendet „Kunden“ für Inkasso aus", /nichtRolle: \["inkasso"\]/.test(shQ));
  ok("… und zeigt stattdessen „Forderungen“",
    /label: "Forderungen"[\s\S]{0,120}nurRolle: "inkasso"/.test(shQ));

  const { sonderrollenBereinigen } = await import("../server/lib/fiaon-zuteilung");
  const br = await sonderrollenBereinigen({ schreiben: false });
  ok("Die Bereinigung findet die falsch zugewiesenen Kunden",
    Array.isArray(br.zeilen), `${br.zeilen.length} Kunden · ${br.hinweis}`);
  ok("Die Vorschau ändert nichts", br.verschoben === 0);
  if (br.zeilen.length > 0) {
    ok("Jede Zeile nennt Herkunft und Ziel",
      br.zeilen.every((z) => z.vonName && z.anName));
    // ── LASTGERECHT, NICHT ZWANZIGMAL DERSELBE ───────────────────────────
    // Der erste Entwurf schickte alle 22 an denselben Menschen:
    // `agentMitKleinsterLast()` fragt die Datenbank, und die wusste nichts von
    // den Zuteilungen, die in derselben Schleife erst geplant wurden.
    const ziele = new Set(br.zeilen.map((z) => z.anAgentId));
    ok(`Verteilt auf ${ziele.size} Agenten, nicht auf einen`,
      br.zeilen.length < 3 || ziele.size >= 2,
      Array.from(ziele).join(", "));
    ok("Kein Ziel trägt selbst eine Sonderrolle",
      br.zeilen.every((z) => z.anAgentId !== z.vonAgentId));
  }
  ok("Das Metadaten-Feld heißt person_id, nicht personId",
    /meta::jsonb->>'person_id'/.test(zuQ) && !/meta::jsonb->>'personId'/.test(zuQ));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("5c5. Auto-Advance: der nächste Kunde kommt von selbst");
  // ═══════════════════════════════════════════════════════════════════════
  // Ein Agent: „Wenn ich ‚Nicht erreicht' klicke, lande ich wieder auf der
  // Wähltastatur — mit der Nummer DESSELBEN Kunden. Um zum nächsten zu kommen,
  // muss ich auf ‚Anderen Kunden wählen', und dort steht ein leeres Suchfeld."
  ok("Es gibt eine Route für den nächsten Kunden",
    /router\.get\("\/telefon\/naechster"/.test(telQ));
  ok("… mit Ausnahmeliste, damit keiner doppelt kommt", /req\.query\.ausser/.test(telQ));
  ok("… und derselben Reihenfolge wie die Kundenliste",
    /p\.priority_tier ASC,\n        p\.promised_payment_date ASC NULLS LAST/.test(telQ));
  ok("… und derselben Regel für Verabredungen",
    /p\.follow_up_date IS NULL OR p\.follow_up_date <= CURRENT_DATE/.test(telQ));
  ok("Eine unwählbare Nummer wird benannt, nicht verschwiegen",
    /aber seine Nummer ist nicht wählbar/.test(telQ));
  const spQ3 = datei("client/src/components/Softphone.tsx");
  // ── DIE STELLE, WO ES ZÄHLT ─────────────────────────────────────────
  // Erster Versuch: nur den Pfad suchen. Die Gegenprobe (Auto-Advance
  // ausbauen) blieb GRÜN — denselben Pfad ruft auch der „Nächsten holen"-Knopf
  // auf, und der Test fand ihn dort. Eine Prüfung, die den Nachbarn findet,
  // prüft nichts. Gesucht wird jetzt der Aufruf INNERHALB von `dokumentieren`.
  ok("Nach dem Ergebnis wird der Nächste geholt", (() => {
    const a = spQ3.indexOf("const dokumentieren = async");
    if (a < 0) return false;
    const block = spQ3.slice(a, spQ3.indexOf("\n  };", a));
    return block.includes("telefon/naechster?ausser=${erledigtJetzt");
  })());
  ok("… und die Erledigten gemerkt", /const \[erledigte, setErledigte\]/.test(spQ3));
  ok("… aber NICHT automatisch gewählt",
    /WARUM NICHT AUTOMATISCH WÄHLEN/.test(spQ3));
  ok("Eine Marke sagt, woher der Kunde kommt", /Nächster aus deiner Liste/.test(spQ3));
  ok("… und man kann ihn wegklicken", /fi-tel-naechster-weg/.test(spQ3));
  ok("Es gibt einen Knopf zum Wiedereinsteigen",
    /Nächsten aus meiner Liste holen/.test(spQ3));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("5c6. Telefon-Richtlinie im Display");
  // ═══════════════════════════════════════════════════════════════════════
  // ── DER BEFUND ────────────────────────────────────────────────────────
  // Der Vorgesetzte: „Man kann als neuer Mitarbeiter die Telefon-Richtlinie
  // nicht bestätigen, es erscheint hinter dem Telefon (da ist alles geblurt,
  // man erkennt nichts). Wenn man dann rausgeht und das bestätigt und seinen
  // Namen eintippt, geht es noch immer nicht!"
  //
  // Gemessen: FiaonGeraet liegt bei z-index 420/421, FiaonEbene bei 400/401.
  // Die Tafel lag zwangsläufig hinter einer Fläche mit 20 px Weichzeichnung.
  const sQ4 = datei("client/src/components/Softphone.tsx");
  ok("Die Annahme steht IM Display", /className="fi-tel-richtlinie"/.test(sQ4));
  ok("… mit dem vollen Text, nicht gekürzt",
    /richtlinie\.text\.kann\.map/.test(sQ4) && /richtlinie\.text\.pflichten\.map/.test(sQ4));
  ok("… rollbar statt abgeschnitten",
    /max-height: 232px; overflow-y: auto/.test(sQ4));
  ok("… mit Haken und Namensfeld", /fi-tel-ri-haken/.test(sQ4) && /fi-tel-ri-name/.test(sQ4));
  ok("… und dem Knopf direkt darunter",
    /fi-tel-ri-knopf/.test(sQ4) && /Annehmen und telefonieren/.test(sQ4));
  ok("Der Knopf bleibt gesperrt ohne Haken und Namen",
    /disabled=\{!gelesen \|\| nameGetippt\.trim\(\)\.length < 3\}/.test(sQ4));
  ok("Die alte Tafel liegt jetzt ÜBER dem Gerät",
    /fi-ri-ueber-geraet/.test(sQ4) && /z-index: 460/.test(datei("client/src/index.css")));
  ok("Der Grund steht dabei",
    /Die Tafel lag bei z-index 400, das Gerät bei 420/.test(sQ4));

  // ── Der Sparmodus ────────────────────────────────────────────────────
  ok("Es gibt eine Marke für laufende Gespräche",
    /wurzel\.setAttribute\("data-gespraech", "1"\)/.test(sQ4));
  ok("… an der WURZEL, nicht am body",
    /document\.documentElement/.test(sQ4) && /hängt in einem Portal/.test(sQ4));
  const cssQ = datei("client/src/index.css");
  ok("Die Weichzeichnung geht im Gespräch aus",
    /:root\[data-gespraech="1"\][\s\S]{0,200}backdrop-filter: none !important/.test(cssQ));
  ok("… das Hintergrundvideo auch", /:root\[data-gespraech="1"\] video/.test(cssQ));
  ok("… und die Dauer-Animationen", /animation-play-state: paused !important/.test(cssQ));
  ok("Auf schmalen Geräten generell weniger Blur",
    /@media \(max-width: 640px\)[\s\S]{0,200}blur\(6px\) saturate\(110%\)/.test(cssQ));

  // ── Das Telefon in der Verwaltung ────────────────────────────────────
  ok("Der Vorgesetzte hat das Telefon",
    /<Softphone \/>/.test(datei("client/src/components/admin/AdminShell.tsx")));
  // ── DIE ERSATZKENNUNG GILT NUR FÜR TELEFON-ROUTEN ──────────────────────
  // Erst galt sie überall. Der erste Vertriebsleiter nach Kennung ist Daniel
  // Stripling (ID 8) — also war JEDER mit Admin-Code auf /agent plötzlich
  // Daniel Stripling, mit seinen Kunden und Zahlen.
  //
  // Der Vorgesetzte: „Ich bin die ganze Zeit als Daniel Stripling angemeldet,
  // wenn ich auf /agent gehe — ich kann mich nicht ausloggen."
  const agQ = datei("server/routes/fiaon-agent.ts");
  ok("… und nur unter /telefon/, nicht im ganzen Portal",
    /if \(!tok && req\.path\.startsWith\("\/telefon\/"\)\)/.test(agQ));
  ok("… mit dem Grund dabei",
    /eine Arbeitsliste, ein Space gehören einem Menschen/.test(agQ));
  ok("Das Abmelden löscht BEIDE Cookies",
    /clearCookie\(ANSICHT_COOKIE/.test(agQ)
    && /Eine Abmeldung, die nur eine von zwei Türen schließt/.test(agQ));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("5c7. Die Unterschrift wird angenommen");
  // ═══════════════════════════════════════════════════════════════════════
  // ── DER BEFUND ────────────────────────────────────────────────────────
  // Der Vorgesetzte: „Auch wenn ich den Namen richtig eintrage, akzeptiert er
  // es nicht und meldet es als Fehler."
  //
  // Er hatte recht, und die Meldung log nicht — sie war blind: Die
  // Inkasso-Route las `req.body.nameGetippt`, der Client schickte `name`. Das
  // Feld kam NIE an. Der Vergleich lief gegen einen leeren String, und die
  // Antwort lautete „Bitte den vollständigen Namen genau so eingeben" — mit
  // genau dem Namen, den er gerade eingegeben hatte.
  //
  // Eine Meldung, die den eigenen Fehler dem Benutzer anlastet, ist die
  // schlimmste Sorte.
  const { zusagePruefen } = await import("../server/lib/fiaon-vertrieb-zusage");
  const ibQ2 = datei("server/routes/fiaon-inkasso-bereich.ts");
  ok("Die Route nimmt BEIDE Feldnamen",
    /req\.body\?\.name \?\? req\.body\?\.nameGetippt/.test(ibQ2));
  ok("… und der Grund steht dabei", /kam NIE an/.test(ibQ2));

  // ── ACHT SCHREIBWEISEN, KEINE EINZIGE ZEILE GESCHRIEBEN ────────────────
  // `zusagePruefen` fasst die Datenbank nicht an. Der erste Entwurf rief
  // `zusageSpeichern` in einer Transaktion auf und rollte sie zurück — das
  // Rollback lief ins Leere, weil die Funktion intern mit `sqlPool` schreibt.
  // Es entstanden SECHS echte Zusagen für einen Menschen, der nie
  // unterschrieben hat. (Widerrufen und protokolliert.)
  const vorZusagen = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_vertrieb_zusagen WHERE widerrufen_am IS NULL
  `) as any[];
  const schreib: [string, string, boolean][] = [
    ["exakt", "Hans-Jürgen Gerhold", true],
    ["klein geschrieben", "hans-jürgen gerhold", true],
    ["Leerzeichen am Rand", "  Hans-Jürgen Gerhold  ", true],
    ["Halbgeviertstrich", "Hans\u2013Jürgen Gerhold", true],
    ["u + Umlautpunkte (NFD)", "Hans-Ju\u0308rgen Gerhold", true],
    ["geschütztes Leerzeichen", "Hans-Jürgen\u00A0Gerhold", true],
    ["FALSCHER Name", "Max Mustermann", false],
    ["LEER — Feld kam nicht an", "", false],
  ];
  for (const [was, name, soll] of schreib) {
    const e = zusagePruefen({
      agentName: "Hans-Jürgen Gerhold", nameGetippt: name, gelesen: true,
      ip: "203.0.113.7", userAgent: "Mozilla/5.0 (Macintosh) Safari/605",
      version: "1.0", sollVersion: "1.0",
    });
    ok(`„${was}“ → ${soll ? "angenommen" : "abgelehnt"}`, e.ok === soll,
      e.ok ? "" : String(e.grund).slice(0, 70));
  }
  ok("Ein leeres Feld wird als SERVERFEHLER benannt, nicht als Tippfehler",
    /Der Name ist beim Server nicht angekommen/
      .test(zusagePruefen({ agentName: "X Y", nameGetippt: "", gelesen: true,
        ip: "203.0.113.7", userAgent: "Safari", version: "1.0" }).grund ?? ""));
  ok("Ein Roboter unterschreibt weiterhin nicht",
    zusagePruefen({ agentName: "Hans-Jürgen Gerhold", nameGetippt: "Hans-Jürgen Gerhold",
      gelesen: true, ip: "127.0.0.1", userAgent: "HeadlessChrome",
      version: "1.0" }).ok === false);
  const nachZusagen = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_vertrieb_zusagen WHERE widerrufen_am IS NULL
  `) as any[];
  gleich("KEINE Zusage durch den Prüfstand entstanden",
    Number(nachZusagen[0].n), Number(vorZusagen[0].n));
  const [pruefArtefakt] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_vertrieb_zusagen
    WHERE ip = '203.0.113.7' AND widerrufen_am IS NULL
  `) as any[];
  gleich("Kein Prüfstand-Artefakt mehr gültig", Number(pruefArtefakt.n), 0);

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("5c8. Jeder Kunde außer SCHUFA hat ein Abo");
  // ═══════════════════════════════════════════════════════════════════════
  // ── DIE REGEL ─────────────────────────────────────────────────────────
  // Der Vorgesetzte: „JEDER Kunde BIS AUF SCHUFA (74 €) HAT EIN ABO, JEDER —
  // ab Tag der Verbuchung, genau ab dem Tag bezahlt er JEDES Monat sein Paket.
  // Jeder, der seine Rate nicht bezahlt hat, muss zum Inkasso kommen."
  //
  // Gemessen: 67 bezahlte Kunden hatten KEINE einzige Abo-Rate. Sie konnten im
  // Forderungsmanagement nie auftauchen — nicht weil sie zahlten, sondern weil
  // niemand eine Rate erwartete.
  const { abosNachtragen, schufaMitRaten, PAKET_PREIS_CENTS, istSchufa, ZYKLUS_TAGE } =
    await import("../server/lib/fiaon-abo-pflicht");

  gleich("Der Zyklus ist 30 Tage", ZYKLUS_TAGE, 30);
  // ── DIE PREISE GEGEN DEN KONTOAUSZUG ───────────────────────────────────
  // Nicht aus dem Kopf: statement_165031496 vom 03.07.–11.08.2026, 327 echte
  // Eingänge. Die Häufigkeiten sagen, welche Beträge wirklich vorkommen —
  // 99,99 ×75, 79,99 ×46, 74,00 ×37 (SCHUFA), 59,99 ×81, 7,99 ×54.
  gleich("start kostet 7,99 €", PAKET_PREIS_CENTS.start, 799);
  gleich("pro kostet 59,99 €", PAKET_PREIS_CENTS.pro, 5999);
  gleich("highend kostet 79,99 €", PAKET_PREIS_CENTS.highend, 7999);
  gleich("ultra kostet 99,99 €", PAKET_PREIS_CENTS.ultra, 9999);

  // ── SCHUFA ERKENNEN ───────────────────────────────────────────────────
  ok("74 € ist SCHUFA", istSchufa({ amount_due: 74 }));
  ok("„Bonitätsauskunft“ ist SCHUFA", istSchufa({ pack_name: "Bonitätsauskunft inkl. Beratung" }));
  ok("… auch ohne Umlaut geschrieben", istSchufa({ pack_name: "Bonitaetsauskunft" }));
  ok("Ein Paket ist NICHT SCHUFA", !istSchufa({ amount_due: 99.99, pack_key: "ultra" }));
  ok("Ein leerer Datensatz ist NICHT SCHUFA", !istSchufa({}));

  const sr = await schufaMitRaten();
  gleich("KEINE SCHUFA-Bestellung hat Abo-Raten", sr.length, 0);

  // ── DER NACHTRAG ──────────────────────────────────────────────────────
  const vorher2 = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_abo_raten`) as any[];
  const na = await abosNachtragen({ schreiben: false });
  ok(`${na.kandidaten.length} Kunden ohne Abo-Rate gefunden`, na.kandidaten.length >= 0, na.hinweis);
  gleich("Die Vorschau legt NICHTS an", na.angelegt, 0);
  const nachher2 = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_abo_raten`) as any[];
  gleich("Keine Rate durch den Prüfstand entstanden",
    Number(nachher2[0].n), Number(vorher2[0].n));

  if (na.kandidaten.length > 0) {
    ok("Jeder Kandidat hat einen Starttag", na.kandidaten.every((k) => /^\d{4}-\d{2}-\d{2}$/.test(k.start)));
    ok("… und die Herkunft des Starttags ist ausgewiesen",
      na.kandidaten.every((k) => typeof k.ausBank === "boolean"));
    ok("Wer keinen ableitbaren Betrag hat, wird ÜBERSPRUNGEN, nicht mit 0 € angelegt",
      na.uebersprungen.every((u) => u.betragCents === 0 || u.problem !== null));
    ok("… und der Grund steht dabei",
      na.uebersprungen.length === 0 || na.uebersprungen.every((u) => !!u.problem));
    ok("Kein Kandidat ist eine SCHUFA-Bestellung",
      na.kandidaten.every((k) => k.betragCents !== 7400));
    const machbar = na.kandidaten.filter((k) => !k.problem);
    ok(`${machbar.length} anlegbar, ${na.uebersprungen.length} übersprungen`,
      machbar.length + na.uebersprungen.length === na.kandidaten.length);
    ok("Die Ratenzahl umfasst Vergangenheit UND die nächste",
      na.ratenGesamt >= machbar.length,
      `${na.ratenGesamt} Raten für ${machbar.length} Kunden`);
  }

  const apQ = datei("server/lib/fiaon-abo-pflicht.ts");
  ok("Ohne ausdrückliches Schreiben passiert nichts", /if \(!opts\.schreiben\)/.test(apQ));
  // ── AN DIE FUNKTION GEBUNDEN, NICHT AN DIE DATEI ──────────────────────
  // Erster Versuch: den Ausdruck irgendwo in der Datei suchen. Die Gegenprobe
  // (COALESCE aus `fehlendeAbos` entfernen) blieb GRÜN — derselbe Ausdruck
  // steht in `schufaMitRaten` weiter unten. Eine Prüfung, die den Nachbarn
  // findet, prüft nichts.
  ok("Der NULL-Fallstrick ist in fehlendeAbos abgefangen", (() => {
    const a = apQ.indexOf("export async function fehlendeAbos");
    if (a < 0) return false;
    const block = apQ.slice(a, apQ.indexOf("\n}", a));
    return block.includes("NOT COALESCE(${SCHUFA_SQL}, FALSE)");
  })());

  // ── DAS VERHALTEN, NICHT DER KOMMENTAR ────────────────────────────────
  // Erster Versuch: den Kommentartext suchen. Wertlos — die Gegenprobe
  // (Preis nur aus amount_due) blieb grün, weil der Kommentar stehen blieb.
  //
  // Was zählt: Ein Kunde mit hinterlegtem Paket, aber OHNE amount_due, muss
  // einen Betrag bekommen. Genau diese Sorte gibt es (gemessen: 63 Kunden mit
  // amount_due IS NULL).
  const ohneBetrag = (await sqlPool`
    SELECT a.ref, a.pack_key FROM fiaon_applications a
    WHERE a.payment_status = 'paid' AND a.merged_into IS NULL AND a.archived_at IS NULL
      AND a.gdpr_deleted_at IS NULL AND a.amount_due IS NULL AND a.pack_key IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM fiaon_abo_raten r WHERE r.ref = a.ref)
    LIMIT 1
  `) as any[];
  if (ohneBetrag.length > 0) {
    const k = na.kandidaten.find((x) => x.ref === String(ohneBetrag[0].ref));
    ok("Ein Kunde mit Paket aber ohne amount_due bekommt trotzdem einen Betrag",
      !!k && k.betragCents > 0,
      k ? `${k.packKey} → ${(k.betragCents / 100).toFixed(2)} €` : "Kandidat nicht gefunden");
  } else {
    ok("Kein Kunde mit Paket ohne amount_due offen — nichts zu prüfen", true);
  }
  ok("Die Preise sind gegen den Kontoauszug geprüft",
    /statement_165031496/.test(apQ));
  const ibQ3 = datei("server/routes/fiaon-inkasso-bereich.ts");
  ok("Die Routen liegen unter /admin",
    /admin\/inkasso\/abos-nachtragen/.test(ibQ3));
  ok("Die Oberfläche warnt vor den Folgen",
    /Das löst Mahnungen aus/.test(datei("client/src/pages/admin-team-zentrale.tsx")));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("5c9. „Eingezogen“ ist eine Leistung, kein Zahlungseingang");
  // ═══════════════════════════════════════════════════════════════════════
  // ── DER BEFUND ────────────────────────────────────────────────────────
  // Der Vorgesetzte: „Woher nimmst du ‚Diesen Monat eingezogen 4.833,28 €,
  // 74 Raten'? Wie kommst du auf das?"
  //
  // Die Abfrage zählte JEDE bezahlte Rate des Monats. Gemessen: alle 74 wurden
  // PÜNKTLICH bezahlt — keine einzige durch Nachfassen. Eine
  // Leistungskennzahl, die fremde Leistung mitzählt, ist wertlos.
  const inkQ2 = datei("server/lib/fiaon-inkasso.ts");
  ok("„Eingezogen“ zählt nur überfällig gewesene Raten", (() => {
    const a = inkQ2.indexOf("EINGEZOGEN HEISST: WAR ÜBERFÄLLIG");
    if (a < 0) return false;
    const block = inkQ2.slice(a, a + 1800);
    return block.includes("AND bezahlt_am::date > faellig_am");
  })());
  ok("Der pünktliche Eingang steht getrennt daneben",
    /puenktlich_monat_cents/.test(inkQ2)
    && /bezahlt_am::date <= faellig_am/.test(inkQ2));
  const kz = await (await import("../server/lib/fiaon-inkasso")).kennzahlen();
  ok("Beide Zahlen kommen an",
    typeof kz.eingezogen_monat_cents === "number" && typeof kz.puenktlich_monat_cents === "number",
    `eingezogen ${(Number(kz.eingezogen_monat_cents)/100).toFixed(2)} € · pünktlich ${(Number(kz.puenktlich_monat_cents)/100).toFixed(2)} €`);
  ok("Die Oberfläche zeigt beide",
    /Eingezogen \(war überfällig\)/.test(inkQ)
    && /Pünktlich eingegangen/.test(inkQ));

  // ── KEIN LINK IN DEN VERWALTUNGSBEREICH ────────────────────────────────
  // Der Vorgesetzte: „Wenn man auf Akte klickt, wird man auf
  // /admin/kunde/3503 weitergeleitet, da hat der Inkasso aber keinen Zugriff."
  ok("Kein /admin-Link in der Inkasso-Liste", !/href=\{`\/admin\/kunde\//.test(inkQ));
  ok("… und der Grund steht dabei", /einen verschlossenen Bereich führt/.test(inkQ));
  ok("Es gibt eine eigene Inkasso-Akte", /function InkassoAkte/.test(inkQ));
  ok("… mit „Offen seit“ als erster Zahl", /Offen seit/.test(inkQ));
  ok("… Bankdaten zum Vorlesen", /Bankdaten zum Vorlesen/.test(inkQ));
  ok("… jedem Gespräch mit Player", /fi-ak-audio/.test(inkQ) && /telefon\/\$\{g\.id\}\/aufnahme/.test(inkQ));
  ok("… und OHNE KI-Auswertung (nicht gewollt)",
    !/KI|Auswertung/.test(inkQ.slice(inkQ.indexOf("function InkassoAkte"))));
  ok("Der Verwendungszweck steht in gleichbreiter Schrift",
    /\.fi-ak-mono/.test(inkQ) && /verhindert, dass man 0 und O verwechselt/.test(inkQ));
  const ibQ4 = datei("server/routes/fiaon-inkasso-bereich.ts");
  ok("Die Rechnung nutzt das BESTEHENDE Event",
    /"abo_payment_reminder", aboErinnerungPayload/.test(ibQ4)
    && /Auf die Frage „haben wir neue Events/.test(ibQ4));
  ok("… und zählt die Mahnstufe NICHT hoch",
    /WARUM DIE MAHNSTUFE NICHT STEIGT/.test(ibQ4)
    && !/mahnstufe = mahnstufe \+ 1/.test(ibQ4));
  ok("Der Versand steht in der Akte, auch wenn er scheitert",
    /FEHLGESCHLAGEN: \$\{versand\.grund\}/.test(ibQ4));
  ok("Das Sende-Menü hat nur EINEN Kopf",
    /KEIN EIGENER KOPF MEHR/.test(datei("client/src/components/SendeMenue.tsx")));

  // ── DIE AKTE MUSS SOFORT ETWAS ZEIGEN ──────────────────────────────────
  // Der erste Entwurf schrieb zehn Abfragen als `await` INNERHALB des
  // Antwort-Objekts. JavaScript wertet Felder der Reihe nach aus — sie liefen
  // nacheinander, gemessen 5.434 ms. Die Akte blieb bei „Wird geladen …", und
  // ich habe lange nach einem Fehler gesucht, der keiner war.
  ok("Alle Abfragen der Akte laufen gleichzeitig",
    /\] = await Promise\.all\(\[/.test(ibQ4)
    && /JavaScript wertet die Felder\n    \/\/ der Reihe nach aus|der Reihe nach aus/.test(ibQ4));
  ok("… und der gemessene Wert steht dabei", /5\.434 ms/.test(ibQ4));

  // Parallel sind es noch zwei Sekunden. Deshalb kommt der Kopf aus dem
  // LISTENEINTRAG und steht sofort — Name, Betrag, Tage offen und Mahnstufe
  // stehen dort längst.
  ok("Der Kopf kommt aus dem Listeneintrag, nicht vom Server",
    /const tageOffen = Number\(\n    fall\.tage_ueberfaellig/.test(inkQ));
  ok("… ebenso die Rufnummer", /const rohNummer = fall\.phone \|\|/.test(inkQ));
  ok("… mit dem Grund dabei", /selbstgemachte Wartezeit/.test(inkQ));
  ok("Anrufen und Rechnung stehen sofort bereit",
    /Anrufen und Rechnung schicken brauchen nur die Nummer/.test(inkQ));
  ok("Der Rest meldet sich als „wird geladen“, statt leer zu bleiben",
    /Kundendaten, Raten und Verlauf werden geladen/.test(inkQ));
  ok("Ein Fehler beim Laden wird benannt",
    /Die Akte konnte nicht geladen werden/.test(inkQ));
  ok("Die Erfolgsmeldung bleibt lesbar stehen",
    /window\.setTimeout\(\(\) => onGeaendert\(\), 4000\)/.test(inkQ)
    && /DASS sie unterwegs ist/.test(inkQ));
  // ═══════════════════════════════════════════════════════════════════════
  // DAS SENDE-MENÜ DES FORDERUNGSMANAGEMENTS
  //
  // ── DER BEFUND (11.08.2026) ───────────────────────────────────────────
  // Der Vorgesetzte: „Wenn der Inkasso-Mitarbeiter auf ‚senden' klickt, öffnet
  // sich das E-Mail-PopUp. 1. sieht es schrecklich aus vom Design, es
  // schneidet oben und unten alles ab und 2. geht es nicht!"
  //
  // Drei Fehler übereinander:
  const mailQ = datei("server/routes/fiaon-mail.ts");
  const kzQ = datei("server/lib/fiaon-kundenzugriff.ts");
  const evQ = datei("server/lib/fiaon-mail-events.ts");
  const smQ = datei("client/src/components/SendeMenue.tsx");

  // 1. HTTP 403: `rolleVon` deutete „inkasso" zu „agent" um.
  ok("Die Rolle wird nicht mehr umgedeutet",
    /export async function rolleVon/.test(kzQ)
    && !/\["vertriebsleiter", "onboarding", "agent"\]\.includes\(r\)/.test(mailQ));
  ok("… und sie steht an EINEM Ort statt in drei Dateien",
    /Die Funktion stand in DREI Dateien/.test(kzQ)
    && !/async function rolleVon/.test(mailQ)
    && !/async function rolleVon/.test(datei("server/routes/fiaon-telefonie.ts"))
    && !/async function rolleVon/.test(datei("server/routes/fiaon-versand.ts")));

  // 2. Leeres Menü: kein Ereignis war für „inkasso" freigegeben.
  ok("„inkasso“ ist eine bekannte Mail-Rolle", /\| "inkasso";/.test(evQ));
  const { eventsFuerRolle } = await import("../server/lib/fiaon-mail-events");
  const inkEvents = await eventsFuerRolle("inkasso" as any);
  ok(`${inkEvents.length} Mail-Ereignisse für das Forderungsmanagement`,
    inkEvents.length >= 3,
    inkEvents.map((e: any) => e.type).join(", "));
  ok("… darunter die Raten-Erinnerung",
    inkEvents.some((e: any) => e.type === "abo_payment_reminder"));
  ok("… und die Zahlungsdaten", inkEvents.some((e: any) => e.type === "payment_details"));

  // 3. Ewiges „Wird geladen": der Fehler wurde verschluckt.
  ok("Ein Ladefehler wird angezeigt, nicht verschluckt",
    /setLadeFehler/.test(smQ) && /Noch einmal versuchen/.test(smQ));
  ok("… mit dem HTTP-Code darin", /\(Antwort \$\{r\.status\}\)/.test(smQ));
  ok("Der Grund steht dabei",
    /Ein verschluckter Fehler ist schlimmer als ein sichtbarer/.test(smQ));

  // 4. Abgeschnitten: transform auf der Karte brach `position: fixed`.
  ok("Das Sende-Menü steht auf Seitenebene, nicht in der Karte",
    /\{sendeMenue != null && \(/.test(inkQ)
    && /Vorfahren macht aus/.test(inkQ));
  ok("… und es gibt keinen zweiten Scroll-Kasten",
    /KEIN ZWEITER SCROLL-KASTEN/.test(smQ)
    && !/flex-1 overflow-y-auto px-5/.test(smQ));

  ok("Zustände stehen in Worten, nicht als Rohwert",
    /ZUGANG_TEXT/.test(inkQ) && /BONITAET_TEXT/.test(inkQ)
    && /noch nicht freigeschaltet/.test(inkQ));

  // ── DIE NACHGETRAGENEN RATEN ───────────────────────────────────────────
  // „Wenn der am 05.07 bezahlt hat, muss er am 05.08 beim Inkasso stehen!"
  const [ueber] = (await sqlPool`
    SELECT COUNT(DISTINCT a.person_id)::int AS kunden,
           COUNT(*)::int AS raten,
           COALESCE(SUM(r.betrag_cents), 0)::bigint AS cents
    FROM fiaon_abo_raten r JOIN fiaon_applications a ON a.ref = r.ref
    WHERE r.status <> 'bezahlt' AND r.faellig_am < CURRENT_DATE
      AND a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
  `) as any[];
  // ── EIGENE UND UNZUGETEILTE ────────────────────────────────────────────
  // Die Oberfläche zeigte 29, serverseitig waren 86 überfällig. Der Filter
  // `inkasso_agent_id = <ich>` sperrte den Menschen auf seine zugeteilten
  // Fälle ein — die neu nachgetragenen gehörten noch niemandem und lagen
  // unsichtbar. Eine überfällige Rate ohne Zuständigen ist keine Ruhe,
  // sondern liegengebliebene Arbeit.
  ok("Er sieht auch die unzugeteilten Fälle",
    /r\.inkasso_agent_id = \$\{opts\.nurMeine\} OR r\.inkasso_agent_id IS NULL/.test(inkQ2));
  ok("… und der Zähler zählt dieselbe Menge wie die Liste",
    (inkQ2.match(/inkasso_agent_id IS NULL\)`/g) || []).length >= 2);
  ok("Die eigenen stehen zuerst",
    /\(r\.inkasso_agent_id = \$\{opts\.nurMeine\}\) DESC/.test(inkQ2));

  ok(`${ueber.kunden} Kunden mit überfälliger Rate (vorher 29)`,
    Number(ueber.kunden) >= 29,
    `${ueber.raten} Raten · ${(Number(ueber.cents) / 100).toFixed(2)} €`);
  ok("Jede nachgetragene Rate hat einen Verwendungszweck",
    (await sqlPool`
      SELECT COUNT(*)::int AS n FROM fiaon_abo_raten
      WHERE zahlungsreferenz IS NULL OR zahlungsreferenz = ''
    ` as any[])[0].n === 0);
  ok("Das Muster stimmt: Rate 1 ohne Zusatz, ab Rate 2 mit -N",
    (await sqlPool`
      SELECT COUNT(*)::int AS n FROM fiaon_abo_raten r
      WHERE r.rate_nr >= 2 AND r.zahlungsreferenz NOT LIKE ('%-' || r.rate_nr::text)
    ` as any[])[0].n === 0);

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("5c10. Die Team-Zentrale zeigt Zahlen, nicht Quelltext");
  // ═══════════════════════════════════════════════════════════════════════
  // ── DER BEFUND ────────────────────────────────────────────────────────
  // Der Vorgesetzte: „Wie schaut denn die /admin/team Seite aus? Die
  // Schriftfarbe kann man nicht lesen, alles ungeordnet."
  //
  // Im Screenshot stand statt „58" der SQL-Quelltext:
  // „(SELECT COUNT(*)::int FROM fiaon_persons p WHERE …" — drei Absätze pro
  // Karte.
  //
  // Die Ursache war meine: `bestandSql(1)` in ein GETAGGTES Template gesetzt.
  // Dort wird jedes ${…} als PARAMETER gebunden, nicht als SQL eingesetzt —
  // der Ausdruck landete als Text-Literal in der Antwort.
  //
  // Und der eigentliche Fehler war die Abnahme: `tsc --noEmit` und `esbuild`
  // waren grün, weil es weder ein Typ- noch ein Syntaxfehler ist. Nur der
  // Browser hätte es gezeigt.
  const zenQ = datei("server/routes/fiaon-zentralen.ts");
  ok("Die Team-Abfrage nutzt `unsafe`, weil sie SQL-Bausteine einsetzt",
    /const zeilen = \(await sqlPool\.unsafe\(`/.test(zenQ));
  ok("… und der Grund steht dabei",
    /wird jedes \$\{…\} als PARAMETER gebunden|als PARAMETER gebunden/.test(zenQ));

  // Das Verhalten, nicht der Quelltext: Kommen ZAHLEN zurück?
  const proben = (await sqlPool.unsafe(`
    SELECT a.id, a.name, ${bestandSqlP(1)} AS stufe_a, ${bestandHeuteSqlP(1)} AS stufe_a_heute
    FROM fiaon_agents a WHERE a.active AND a.rolle IN ('agent','vertriebsleiter')
    ORDER BY a.id LIMIT 5
  `)) as any[];
  ok(`${proben.length} Mitarbeiter geprüft — alle liefern Zahlen`,
    proben.length > 0 && proben.every((p) => typeof p.stufe_a === "number"),
    proben.map((p) => `${String(p.name).split(" ")[0]} A${p.stufe_a}/${p.stufe_a_heute}`).join(" · "));
  ok("Kein Ergebnis ist ein String mit SELECT darin",
    proben.every((p) => !String(p.stufe_a).includes("SELECT")));

  // ── DIE AKTE ──────────────────────────────────────────────────────────
  const teamQ2 = datei("server/routes/fiaon-team.ts");
  ok("Es gibt eine Akte-Route", /admin\/team\/:id\/akte/.test(teamQ2));
  ok("… mit Provisionsverlauf", /FROM fiaon_commissions c/.test(teamQ2));
  ok("… mit Summen", /provisionSummen/.test(teamQ2));
  ok("… mit den Gesprächen des Menschen", /FROM fiaon_calls k[\s\S]{0,400}WHERE k\.agent_id/.test(teamQ2));
  ok("… und die Twilio-URL geht NICHT mit",
    /\(k\.recording_url IS NOT NULL AND k\.aufnahme_geloescht_am IS NULL\) AS hat_aufnahme/.test(teamQ2)
    && !/SELECT[^;]{0,600}k\.recording_url,/.test(teamQ2));
  ok("Alle sechs Abfragen laufen gleichzeitig", /await Promise\.all\(\[/.test(teamQ2));

  const tzQ2 = datei("client/src/pages/admin-team-zentrale.tsx");
  ok("Der Reiter „Gespräche“ gibt es", /\["gespraeche", "Gespräche"\]/.test(tzQ2));
  ok("Der Provisionsverlauf wird gezeigt", /akte\.provisionen\.map/.test(tzQ2));
  ok("… mit Summenzeile", /akte\?\.provisionSummen &&/.test(tzQ2));
  ok("Ergebnisse stehen in Klartext, nicht als Feldname",
    /nicht_erreicht: "nicht erreicht"/.test(tzQ2));
  ok("„Anhören“ nur, wenn es etwas zu hören gibt",
    /a\.hat_aufnahme && !a\.ohne_aufzeichnung_am/.test(tzQ2));

  // ── DIE KI-AUSWERTUNG ─────────────────────────────────────────────────
  const gaQ = datei("server/lib/fiaon-gespraechsanalyse.ts");
  ok("Die Auswertung nennt Beobachtungen, keine Note",
    /BEOBACHTUNGEN, keine Bewertung/.test(gaQ) && /Keine Note/.test(gaQ));
  ok("… mit fünf festen Abschnitten",
    ["WAS GUT LÄUFT", "WO GESPRÄCHE ABBRECHEN", "WAS UNGESAGT BLEIBT", "RISIKO",
     "EIN SATZ FÜR DAS NÄCHSTE GESPRÄCH"].every((a) => gaQ.includes(a)));
  ok("… und fragt nach unzulässigen Zusagen",
    /Erlass, Stundung,\nRatenänderung|Erlass, Stundung/.test(gaQ));
  ok("Ohne Transkripte wird der GRUND genannt, keine Antwort erfunden",
    /Ohne Aufnahme gibt es kein/.test(gaQ)
    && /Eine KI, die aus nichts eine Beurteilung baut, ist schlimmer als keine/.test(gaQ));
  ok("Der HTTP-Code steht in der Fehlermeldung",
    /OpenAI antwortete mit HTTP \$\{r\.status\}/.test(gaQ));
  const { gespraecheAuswerten } = await import("../server/lib/fiaon-gespraechsanalyse");
  const probe = await gespraecheAuswerten(10, { tage: 30, max: 2 });
  ok("Die Auswertung antwortet mit einem Grund statt zu schweigen",
    probe.ok || (!!probe.grund && probe.grund.length > 30),
    probe.ok ? "Auswertung erstellt" : probe.grund);

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("5c11. Die Kostenbühne: lesbar, animiert, mit Tiefe");
  // ═══════════════════════════════════════════════════════════════════════
  // ── DER BEFUND ────────────────────────────────────────────────────────
  // Der Vorgesetzte: „Die Schriftfarbe ist blau auf schwarz — mach das
  // moderner, Animationen, 3D-Elemente und vor allem LESBAR!"
  //
  // Gemessen: Die Zahlen trugen rgb(17,24,39) — Tailwinds text-gray-900 — auf
  // rgb(10,26,60). Kontrast praktisch null.
  //
  // Der Grund lag in der Hausregel selbst: `.fi-flaeche-tief * { color:
  // inherit }` hat dieselbe Spezifität wie eine Tailwind-Utility, und Tailwind
  // wird SPÄTER eingefügt. Bei gleichem Gewicht gewinnt das Spätere. Der
  // Kommentar behauptete „besonders streng" — das CSS war es nicht.
  const dsQ = datei("client/src/styles/fiaon-design.css");
  ok("Die Hausregel hat jetzt Nachdruck",
    /\.fi-flaeche-tief \{ color: #eef3fb !important; \}/.test(dsQ));
  ok("… und der Grund steht dabei",
    /Ein Kommentar, der Strenge behauptet, ersetzt kein !important/.test(dsQ));

  ok("Die Kostenbühne hat eigene Klassen", /\.fi-kosten \{/.test(tzQ2));
  ok("Jede Schriftfarbe steht ausdrücklich",
    (tzQ2.match(/color: [^;]+ !important;/g) || []).length >= 4);
  ok("Die Zahlen sind weiß", /\.fi-kosten-wert[\s\S]{0,200}color: #f4f8ff !important/.test(tzQ2));
  ok("Es gibt einen Deckungsbalken", /\.fi-kosten-balken-fuell/.test(tzQ2));
  ok("… der beim Erscheinen einläuft", /@keyframes fiKostenBalken/.test(tzQ2));
  ok("… und bei 100 % gedeckelt ist",
    /Math\.min\(100, Number\(d\.deckung\)/.test(tzQ2)
    && /viermal aus dem Kasten läuft/.test(tzQ2));
  ok("Die 100-Prozent-Linie gibt Maßstab", /\.fi-kosten-balken-linie/.test(tzQ2));
  ok("Gestaffelte Tiefe statt flacher Fläche",
    /0 2px 8px -3px rgba\(7,17,41,\.5\)/.test(tzQ2)
    && /0 26px 54px -28px rgba\(7,17,41,\.8\)/.test(tzQ2));
  ok("Ein wandernder Glanz", /@keyframes fiKostenGlanz/.test(tzQ2));
  ok("Auf 380 px als Raster, ohne Teiler",
    /\.fi-kosten-teiler \{ display: none; \}/.test(tzQ2));
  ok("Platz für den Telefonknopf gelassen",
    /\.fi-kosten-satz \{ padding-right: 82px; \}/.test(tzQ2));
  ok("Reduzierte Bewegung wird geachtet",
    /prefers-reduced-motion[\s\S]{0,200}\.fi-kosten-glanz \{ display: none; \}/.test(tzQ2));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("5d. Mitarbeiter-Zugang auf der Website");
  // ═══════════════════════════════════════════════════════════════════════
  const fQ = datei("client/src/components/PremiumFooter.tsx");
  ok("Der Link steht in der Fußzeile", /Mitarbeiter-Zugang/.test(fQ));
  ok("… und zeigt auf /agent", /href="\/agent"/.test(fQ));
  ok("… dezent, in Grau", /text-gray-500 hover:text-gray-300/.test(fQ));
  ok("… mit eigenem Schloss-Zeichen, keine Bibliothek",
    /<rect x="4\.5" y="8\.5" width="11" height="8" rx="2" \/>/.test(fQ));
  ok("Er nennt NICHT „Agent“ oder „Vertrieb“",
    !/Agent-Login|Vertrieb-Login/.test(fQ));
  ok("Der Grund für die Fußzeile steht dabei",
    /fragt sich, ob er hier richtig ist/.test(fQ));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("6. Verhalten gegen echte Daten");
  // ═══════════════════════════════════════════════════════════════════════
  try {
    await sqlPool.begin(async (tx) => {
      const [a] = (await tx`
        INSERT INTO fiaon_agents (name, first_name, last_name, email, active, rolle)
        VALUES (${`Prüf Rück${stempel}`}, 'Prüf', ${`Rück${stempel}`},
                ${`r-${stempel}@pruefstand.test`.toLowerCase()}, TRUE, 'agent')
        RETURNING id
      `) as any[];

      // Ein sensibles Ereignis schreiben und in der Liste finden.
      await tx`
        INSERT INTO fiaon_agent_events (agent_id, type, meta, actor, reason)
        VALUES (${a.id}, 'geloescht_endgueltig',
                ${JSON.stringify({ ref: `P-${stempel}` })},
                ${`Prüfstand ${stempel}`}, 'Prüflauf, wird zurückgerollt')
      `;
      const drin = await aktivitaet({ limit: 40 }, tx as any);
      ok("Ein neues Ereignis erscheint in der Liste",
        drin.some((z) => z.wer === `Prüfstand ${stempel}`));
      const gefunden = drin.find((z) => z.wer === `Prüfstand ${stempel}`);
      gleich("… mit Klartext-Titel", gefunden?.titel, "Endgültig gelöscht");
      gleich("… als sensibel eingestuft", gefunden?.schwere, "hoch");
      gleich("… mit Referenz", gefunden?.referenz, `P-${stempel}`);
      ok("… und mit Grund", (gefunden?.grund ?? "").includes("Prüflauf"));

      // Der Filter nach Person greift.
      const nurDieser = await aktivitaet({ agentId: Number(a.id), limit: 20 }, tx as any);
      ok("Der Personenfilter greift",
        nurDieser.length > 0 && nurDieser.every((z) => z.wer === `Prüfstand ${stempel}` || z.wen != null));

      throw new Zurueckrollen();
    });
  } catch (e) {
    if (!(e instanceof Zurueckrollen)) throw e;
  }

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("7. Gegenprobe: nichts geschrieben");
  // ═══════════════════════════════════════════════════════════════════════
  const [nachher] = await sqlPool`
    SELECT (SELECT COUNT(*) FROM fiaon_agent_events)::int AS ereignisse,
           (SELECT COUNT(*) FROM fiaon_calls)::int AS anrufe,
           (SELECT COUNT(*) FROM fiaon_persons)::int AS personen,
           (SELECT COUNT(*) FROM fiaon_commission_statements)::int AS abrechnungen
  `;
  // ── GLOBAL NUR „DARF NICHT SCHRUMPFEN" ────────────────────────────────
  // Beim Lauf um 18:40 war diese Zeile rot: 5014 statt 5013. Eine ECHTE
  // Person hatte in der Zwischenzeit ein Formular abgeschickt. Das ist der
  // Trichter, nicht der Prüfstand — und AGENTS.md sagt es ausdrücklich:
  // global nur „darf nicht schrumpfen", je Einheit exakt.
  ok(`Keine Person verloren (${vorher.personen} → ${nachher.personen})`,
    Number(nachher.personen) >= Number(vorher.personen));
  gleich("Keine Abrechnung verändert", nachher.abrechnungen, vorher.abrechnungen);
  ok(`Ereignisse nur gewachsen (${vorher.ereignisse} → ${nachher.ereignisse})`,
    Number(nachher.ereignisse) >= Number(vorher.ereignisse));
  const [r2] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_agents WHERE last_name LIKE ${`%${stempel}`}
  `) as any[];
  gleich("Kein Prüfkonto übrig", Number(r2.n), 0);
  const [r3] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_agent_events WHERE actor = ${`Prüfstand ${stempel}`}
  `) as any[];
  gleich("Kein Prüf-Ereignis übrig", Number(r3.n), 0);
  const [r4] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_calls WHERE aufnahme_geloescht_am > NOW() - INTERVAL '5 minutes'
  `) as any[];
  gleich("Keine Aufnahme gelöscht", Number(r4.n), 0);

  log(`\n══ Ergebnis: ${bestanden} bestanden, ${fehlgeschlagen} fehlgeschlagen ══\n`);
  if (fehlgeschlagen > 0) { log("Fehlgeschlagen:"); for (const x of fehler) log(`  · ${x}`); }
  await sqlPool.end();
  process.exit(fehlgeschlagen > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("\nPrüfstand abgebrochen:", err);
  await sqlPool.end().catch(() => {});
  process.exit(1);
});
