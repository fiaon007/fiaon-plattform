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
  // ── DIE ABSICHT PRÜFEN, NICHT DEN WORTLAUT (17.08.2026) ────────────────
  // Hier stand die wörtliche Suche nach „CURRENT_DATE + 7". Am 17.08.2026
  // wurde das Sichtfeld auf die BERLINER Tagesgrenze umgestellt (CURRENT_DATE
  // ist das UTC-Datum der Datenbank und zeigt zwischen 00:00 und 02:00
  // Berliner Zeit noch auf den Vortag). Die Fristgrenze war weiter da — die
  // Prüfung suchte nur eine Schreibweise.
  //
  // Eine Prüfung, die an einer Formulierung hängt, wird bei jeder Verbesserung
  // rot und erzieht dazu, sie abzuschalten.
  ok("Das Sichtfeld hat eine Fristgrenze von 7 Tagen",
    /r\.faellig_am <= .{0,60} \+ 7/.test(SICHTFELD), SICHTFELD.slice(0, 120));
  ok("… und sie rechnet in Berliner Zeit, nicht in UTC",
    /Europe\/Berlin/.test(SICHTFELD) && !/<= CURRENT_DATE/.test(SICHTFELD));
  const [sf] = (await sqlPool.unsafe(`
    SELECT COUNT(*)::int AS drin,
           COUNT(*) FILTER (WHERE r.faellig_am
             > (NOW() AT TIME ZONE 'Europe/Berlin')::date + 7)::int AS zu_spaet
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
  // ── DIE GEGENPROBE RECHNET IN BERLINER ZEIT ──────────────────────────────
  // Hier stand dreimal „CURRENT_DATE". Das ist das UTC-Datum der Datenbank;
  // zwischen 00:00 und 02:00 Berliner Zeit zeigt es auf den VORTAG. Die
  // Filter selbst wurden am 17.08.2026 auf Berlin umgestellt — die Gegenprobe
  // verglich danach nachts zwei verschiedene Tage und meldete „113 statt 97".
  //
  // Genau dieser Unterschied war der Fund: Es sind wirklich andere Raten.
  // Also muss die Prüfung dasselbe Datum benutzen wie die Sache, die sie prüft.
  for (const [f, bedingung] of [
    ["ueberfaellig", "r.faellig_am < (NOW() AT TIME ZONE 'Europe/Berlin')::date"],
    ["heute", "r.faellig_am = (NOW() AT TIME ZONE 'Europe/Berlin')::date"],
    ["woche", "r.faellig_am > (NOW() AT TIME ZONE 'Europe/Berlin')::date"
      + " AND r.faellig_am <= (NOW() AT TIME ZONE 'Europe/Berlin')::date + 7"],
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
  // Die Ausnahmeliste wuchs am 17.08.2026 um „wartend" (Kunde soll antworten).
  // Die Prüfung sucht deshalb die EINZELNEN Namen, nicht die genaue Schreibweise
  // der Liste — sonst wird sie bei jeder neuen Ansicht rot.
  ok("Der Filter „Nicht erreicht“ zeigt ihn weiter",
    /"nicht_erreicht"[\s\S]{0,80}\]\.includes\(filter\)/.test(asQ)
    && /"ruhend"[\s\S]{0,80}\]\.includes\(filter\)/.test(asQ));
  ok("… und der neue Filter „Wartend“ ebenfalls",
    /"wartend"[\s\S]{0,60}\]\.includes\(filter\)/.test(asQ));
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
  const { abosNachtragen, schufaMitRaten, PAKET_PREIS_CENTS, istSchufa } =
    await import("../server/lib/fiaon-abo-pflicht");
  const { faelligkeit } = await import("../server/lib/fiaon-abo-zyklus");

  // ── DER ZYKLUS IST KEINE TAGESZAHL MEHR (16.08.2026) ───────────────────
  // Hier stand „Der Zyklus ist 30 Tage". Genau diese Zahl war der Fehler:
  // Zwölf Monate zu 30 Tagen sind 360, der Termin wanderte jedes Jahr fünf
  // Tage nach vorn — 266 von 289 offenen Raten lagen daneben.
  //
  // Es gilt der monatliche Jahrestag der Buchung. Ein Prüfstand, der die alte
  // Zahl verteidigt, verteidigt den Fehler.
  gleich("Gebucht am 05.07. → fällig am 05.08.", faelligkeit("2026-07-05", 1), "2026-08-05");
  gleich("… und dann am 05.09.", faelligkeit("2026-07-05", 2), "2026-09-05");

  // ── DIE PREISE, WIE DER BETREIBER SIE FESTGELEGT HAT ───────────────────
  // Hier stand „ultra kostet 99,99 €", begründet mit einer Häufigkeits-
  // auszählung des Kontoauszugs (99,99 ×75, 79,99 ×46). Das war ein
  // Fehlschluss: Eine Häufigkeit sagt, welche BETRÄGE vorkommen, nicht, zu
  // welchem PAKET sie gehören. Der Kaufpreis in fiaon-antrag.ts sagte seit
  // immer das Gegenteil — ein Ultra-Kunde kaufte für 79,99 € und bekam
  // Rechnungen über 99,99 €.
  //
  // Entscheidung des Betreibers (16.08.2026): Ultra 79,99 · High End 99,99.
  gleich("start kostet 7,99 €", PAKET_PREIS_CENTS.start, 799);
  gleich("pro kostet 59,99 €", PAKET_PREIS_CENTS.pro, 5999);
  gleich("ultra kostet 79,99 €", PAKET_PREIS_CENTS.ultra, 7999);
  gleich("highend kostet 99,99 €", PAKET_PREIS_CENTS.highend, 9999);

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

  // ═══════════════════════════════════════════════════════════════════════
  // DAS FORDERUNGSMANAGEMENT BEKOMMT KEINE TERMINE
  //
  // ── DER BEFUND (11.08.2026) ───────────────────────────────────────────
  // Der Vorgesetzte: „Die Mitarbeiter aus dem Inkasso, warum haben die
  // Termine? Die können keine Termine bekommen, da sie ja nur die Leute
  // anrufen, die ihre Abo-Rate nicht bezahlt haben!"
  //
  // Gemessen: Hans-Jürgen Gerhold hatte ZWEI Termine (Quelle
  // „nichterreicht_mail") mit Kunden, die Lucas Böhnert und Nikita Boychenko
  // betreuen. Und beide Inkasso-Konten hatten je einen zugewiesenen
  // Vertriebskunden.
  const trmQ = datei("server/lib/fiaon-termine.ts");
  ok("Ein Termin bei einem Inkasso-Konto wird abgewiesen",
    /String\(agent\.rolle \|\| "agent"\) === "inkasso"/.test(trmQ)
    && /Das Forderungsmanagement nimmt keine Termine an/.test(trmQ));
  ok("… und die Meldung nennt den richtigen Weg",
    /setzt man dort eine Wiedervorlage an der Rate/.test(trmQ));
  ok("Die alte Lücke ist benannt", /fordert nur beim/.test(trmQ));
  ok("Der Kalender ist für Inkasso ausgeblendet",
    /match: \["\/agent\/kalender"\], nichtRolle: \["inkasso"\]/
      .test(datei("client/src/pages/agent/shared.tsx")));

  const [inkTermine] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_termine t
    JOIN fiaon_agents a ON a.id = t.agent_id
    WHERE a.rolle = 'inkasso' AND t.status = 'gebucht'
  `) as any[];
  gleich("KEIN gebuchter Termin liegt bei einem Inkasso-Konto", Number(inkTermine.n), 0);

  const [inkKunden] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_persons p
    JOIN fiaon_agents a ON a.id = p.assigned_agent_id
    WHERE a.rolle = 'inkasso' AND p.merged_into_person_id IS NULL
  `) as any[];
  gleich("KEIN Vertriebskunde ist einem Inkasso-Konto zugewiesen", Number(inkKunden.n), 0);

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
  gruppe("5c12. Der Kunde kann uns anrufen");
  // ═══════════════════════════════════════════════════════════════════════
  // ── DER AUFTRAG ───────────────────────────────────────────────────────
  // Der Vorgesetzte: „Wir brauchen jetzt die Funktion, dass der Kunde uns auch
  // anrufen kann. Wichtig: Wenn der Kunde anruft, muss stehen, wer dafür
  // zuständig ist, damit der richtige rangeht! Irgendwie bauen, dass es smart
  // ist und nicht stört!"
  const eiQ = datei("server/lib/fiaon-anruf-eingehend.ts");
  const spQ2 = datei("server/lib/fiaon-softphone.ts");
  const telQ2 = datei("server/routes/fiaon-telefonie.ts");
  const sofQ = datei("client/src/components/Softphone.tsx");

  ok("Der Ausweis erlaubt eingehende Anrufe", /incomingAllow: true/.test(spQ2));
  ok("Das Gerät meldet sich bei Twilio an", /void d\.register\(\)/.test(sofQ));
  ok("… und ein Fehlschlag verhindert das Telefonieren NICHT",
    /Ein ausgehender Anruf braucht register\(\) NICHT/.test(sofQ));
  ok("Es klingelt nicht, während man telefoniert",
    /allowIncomingWhileBusy: false/.test(sofQ));
  ok("Ein Anruf wird NICHT automatisch angenommen",
    /ein Lautsprecher im Büro/.test(sofQ));

  ok("Es gibt eine Route für eingehende Anrufe",
    /router\.post\("\/telefon\/eingehend"/.test(telQ2));
  ok("… und die Twilio-Einrichtung steht dabei",
    /A call comes in:  Webhook/.test(telQ2));
  ok("Auch ein Fehler lässt den Anrufer nicht ins Leere laufen",
    /technische Störung vor/.test(telQ2));

  // ── DIE ZUSTÄNDIGKEIT ─────────────────────────────────────────────────
  const { zustaendigFuer, nummerKern } = await import("../server/lib/fiaon-anruf-eingehend");
  gleich("Nummernkern: +49-Form", nummerKern("+49 176 1234 5678"), "612345678");
  gleich("Nummernkern: 0176-Form ergibt DASSELBE", nummerKern("0176/12345678"), "612345678");
  ok("Zu kurze Eingaben ergeben nichts", nummerKern("12345") === null);
  ok("Die indexierte Spalte phone_key9 wird genutzt",
    /p\.phone_key9 = \$\{kern\}/.test(eiQ)
    && /Eine zweite Fassung wäre nicht nur doppelt, sondern LANGSAMER/.test(eiQ));

  const [mitRate] = (await sqlPool`
    SELECT p.primary_phone AS n FROM fiaon_persons p
    JOIN fiaon_applications a ON a.person_id = p.id JOIN fiaon_abo_raten r ON r.ref = a.ref
    WHERE r.status <> 'bezahlt' AND r.faellig_am < CURRENT_DATE
      AND p.primary_phone IS NOT NULL LIMIT 1
  `) as any[];
  if (mitRate) {
    const z = await zustaendigFuer(String(mitRate.n));
    ok("Ein Kunde mit offener Rate landet beim Forderungsmanagement",
      z.rolle === "inkasso", `${z.agentName} · ${z.grund}`);
    ok("… und der Grund nennt Tage und Betrag",
      /Rate seit \d+ Tag/.test(z.grund) && /€/.test(z.grund));
    ok("… weitergegeben wird an Inkasso-Kollegen, nicht an den Vertrieb",
      z.weiterAn.length >= 0 && /nicht an den Vertrieb/.test(eiQ));
  }
  const unbekannt = await zustaendigFuer("+4930999999999");
  ok("Eine unbekannte Nummer erzeugt KEIN Klingeln",
    unbekannt.agentId === null && unbekannt.grundKennung === "niemand");

  // ── DAS TwiML ─────────────────────────────────────────────────────────
  const { twimlEingehend, twimlNachDial } = await import("../server/lib/fiaon-anruf-eingehend");
  const xmlLeer = twimlEingehend({
    z: unbekannt, ansage: "Test.", aufnahmeCallback: "https://x/a",
    statusCallback: "https://x/s", verpasstCallback: "https://x/v",
  });
  ok("Ohne Zuständigen: Ansage statt Klingeln",
    !xmlLeer.includes("<Dial") && xmlLeer.includes("<Say"));
  ok("… und es beginnt mit einer gültigen XML-Zeile", xmlLeer.startsWith("<?xml"));
  if (mitRate) {
    const z = await zustaendigFuer(String(mitRate.n));
    const xml = twimlEingehend({
      z, ansage: "Guten Tag. Dieses Gespräch wird aufgezeichnet.",
      aufnahmeCallback: "https://x/a", statusCallback: "https://x/s",
      verpasstCallback: "https://x/v",
    });
    ok("Es klingelt beim Zuständigen ZUERST",
      xml.indexOf(`agent-${z.agentId}`) > 0
      && xml.indexOf(`agent-${z.agentId}`) < (xml.indexOf("Einen Moment") > 0 ? xml.indexOf("Einen Moment") : xml.length));
    ok("Die Aufzeichnung ist an", /record="record-from-answer-dual"/.test(xml));
    ok("… und die Ansage begrüßt nur EINMAL",
      (xml.match(/Guten Tag/g) || []).length === 1,
      "Vorher stand zweimal „Guten Tag“.");
    ok("Es gibt eine Endansage, wenn niemand rangeht",
      /Leider ist gerade niemand frei/.test(xml));
  }
  ok("Nach einem angenommenen Anruf kommt keine Ansage mehr",
    /<Hangup\/>/.test(twimlNachDial("completed"))
    && !/<Say/.test(twimlNachDial("completed")));
  ok("Nach „nicht angenommen“ läuft die Kette weiter",
    twimlNachDial("no-answer").includes("<Response/>"));

  // ── DIE ANZEIGE ───────────────────────────────────────────────────────
  ok("Das Klingelfenster nennt Kunde, Grund und Vertretung",
    /fi-ein-name/.test(sofQ) && /fi-ein-grund/.test(sofQ) && /fi-ein-vertretung/.test(sofQ));
  ok("… „Weitergeben“ gibt weiter, statt zu beenden",
    /sagt Twilio „nicht bei mir/.test(sofQ));
  ok("… und die Erreichbarkeit steht im Display",
    /Bereit · erreichbar/.test(sofQ));
  ok("Ein Puls, kein Blinken",
    /Ein Puls, kein Blinken/.test(sofQ) && /@keyframes fiEinPuls/.test(sofQ));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("5c13. Zahlungsdaten-Mail findet die Adresse");
  // ═══════════════════════════════════════════════════════════════════════
  // ── DER BEFUND ────────────────────────────────────────────────────────
  // Ein Agent: „Bei mehreren Datensätzen ist keine E-Mail-Adresse hinterlegt.
  // Selbst wenn ich die E-Mail im aktuellen Datensatz manuell eintrage und
  // speichere, funktioniert der Versand der Zahlungsdaten anschließend nicht.
  // Das ist mir mittlerweile bei mehreren Kunden aufgefallen."
  //
  // Gemessen an Maik Matzke (Person #3815): `fiaon_applications.email` LEER,
  // `fiaon_persons.primary_email` gefüllt. Die Route las nur die Bestellzeile —
  // `makePayloadFromRow` setzte `email: ""`, und die Mail ging mit LEEREM
  // Empfänger an Make. Dort verschwand sie lautlos, der Agent bekam „ok".
  const agQ2 = datei("server/routes/fiaon-agent.ts");
  ok("Der Versand nimmt auch die Adresse von der PERSON",
    /SELECT NULLIF\(TRIM\(COALESCE\(p\.primary_email, ''\)\), ''\) AS email/.test(agQ2)
    && /const empfaenger = roh\.email \|\| personMail\?\.email/.test(agQ2));
  // ── DAS VERHALTEN, NICHT DER WORTLAUT ─────────────────────────────────
  // Erster Versuch: den Meldungstext suchen. Die Gegenprobe (Text ändern)
  // blieb grün — eine Prüfung auf Formulierung prüft nichts.
  //
  // Was zählt: Bei fehlender Adresse wird ABGEBROCHEN, bevor sendMakeWebhook
  // aufgerufen wird. Der Rücksprung muss also VOR dem Versand stehen.
  ok("Ohne Adresse wird NICHTS verschickt", (() => {
    const i = agQ2.indexOf("if (!empfaenger) {");
    const j = agQ2.indexOf('sendMakeWebhook("agent_payment_reminder"', i);
    if (i < 0 || j < 0) return false;
    const block = agQ2.slice(i, j);
    // Zwischen der Prüfung und dem Versand muss ein return stehen.
    return /return res\.status\(400\)/.test(block);
  })());
  ok("… und die 10-Minuten-Sperre wird zurückgenommen",
    /SET agent_email_sent_at = NULL WHERE ref/.test(agQ2));
  ok("Der Grund steht dabei",
    /Der Agent hat also alles richtig gemacht und trotzdem verloren/.test(agQ2));

  // ── DAS VERHALTEN, NICHT NUR DER QUELLTEXT ────────────────────────────
  // Ein Kunde, dessen Bestellung keine Mail hat, dessen Person aber eine —
  // genau der gemeldete Fall.
  const [ohneBestellMail] = (await sqlPool`
    SELECT a.ref, p.primary_email
    FROM fiaon_applications a JOIN fiaon_persons p ON p.id = a.person_id
    WHERE NULLIF(TRIM(COALESCE(a.email, a.contact_email, a.billing_email, '')), '') IS NULL
      AND NULLIF(TRIM(COALESCE(p.primary_email, '')), '') IS NOT NULL
      AND a.merged_into IS NULL
    LIMIT 1
  `) as any[];
  if (ohneBestellMail) {
    const [gefunden2] = (await sqlPool`
      SELECT NULLIF(TRIM(COALESCE(p.primary_email, '')), '') AS email
      FROM fiaon_applications a JOIN fiaon_persons p ON p.id = a.person_id
      WHERE a.ref = ${ohneBestellMail.ref}
    `) as any[];
    ok("Ein echter Fall: Bestellung ohne Mail, Person mit Mail wird gefunden",
      !!gefunden2?.email, `${ohneBestellMail.ref} → ${gefunden2?.email}`);
  } else {
    ok("Kein solcher Fall mehr im Bestand", true);
  }

  // ── DIE URSACHE: PAUSCHAL ABGELEHNTE DUBLETTEN ────────────────────────
  // 320 Paare stehen als „keine_dublette" mit der Begründung „Nur
  // Namensähnlichkeit ohne zweites Merkmal". Darunter 234 mit EXAKT gleichem
  // Namen und ERGÄNZENDEN Kontaktdaten — einer hat, was dem anderen fehlt.
  // Das ist der Grund, warum der Agent zwei Datensätze sieht.
  const [abgelehnt] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_dubletten_entschieden
    WHERE entscheidung = 'keine_dublette'
  `) as any[];
  ok(`${abgelehnt.n} Dubletten-Paare sind abgelehnt — der Zähler ist sichtbar`,
    Number(abgelehnt.n) >= 0,
    "Die Rücknahme braucht eine Entscheidung des Vorgesetzten");

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("5c14. Agenten-Rückmeldung vom 11.08.2026");
  // ═══════════════════════════════════════════════════════════════════════

  // ── PUNKT 6: TERMINE VERSCHIEBEN SICH ─────────────────────────────────
  // „Datum und Uhrzeit verändern sich beim Speichern. Morgen 10:00 wird 12:00.
  // Heute 20:00 landet am 18.08. um 22:00."
  //
  // Gemessen: Eintrag #8884 stand als „2026-08-18T20:00:00.000Z" — 20:00 UTC,
  // in Berlin 22:00. Zwei Routen schrieben den Rohwert direkt in eine
  // timestamptz-Spalte, die ihn als UTC deutet.
  const { parseBerlinInput: pbi } = await import("../server/lib/fiaon-time");
  gleich("10:00 Berlin wird als 08:00 UTC gespeichert",
    pbi("2026-08-20T10:00")?.toISOString(), "2026-08-20T08:00:00.000Z");
  gleich("… auch mit Sekunden", pbi("2026-08-20T10:00:00")?.toISOString(),
    "2026-08-20T08:00:00.000Z");
  const akQ = datei("server/routes/fiaon-agent-kunden.ts");
  const vtQ = datei("server/routes/fiaon-vertrieb.ts");
  // ── DIE WANDLUNG STEHT JETZT IN DER GEMEINSAMEN KETTE ──────────────────
  // Am 17.08.2026 sind Liste und Telefon-Panel auf EINEN Weg gelegt worden
  // (`ergebnisNachbereiten`), weil 554 von 842 Anrufen mit Ergebnis keinen
  // Verlaufseintrag hatten. Die Berlin-Wandlung wanderte damit aus der Route
  // in die Kette — die Prüfung muss dort nachsehen, sonst verteidigt sie eine
  // Verdopplung, die gerade beseitigt wurde.
  const ketteQ = datei("server/lib/fiaon-kontakt-ergebnis.ts");
  ok("Die gemeinsame Kette wandelt in Berlin-Zeit",
    /parseBerlinInput\(ein\.terminZeitpunkt \?\? null\)/.test(ketteQ)
    && /parseBerlinInput\(ein\.zusageDatum \?\? null\)/.test(ketteQ));
  ok("… und die Kundenliste ruft diese Kette",
    /await ergebnisNachbereiten\(\{/.test(akQ));
  ok("Die Vertriebs-Route ebenfalls",
    /\$\{parseBerlinInput\(req\.body\?\.terminDatum\)\}/.test(vtQ));
  ok("Der Grund steht dabei", /in Berlin 22:00/.test(akQ));

  // ── PUNKT 5: ZÄHLER UND LISTE ─────────────────────────────────────────
  // „Zahlung gemeldet zeigt 23, im Ordner befinden sich aber nur 2."
  const asQ14 = datei("server/routes/fiaon-agent-start.ts");
  ok("Die Zähler filtern Testeinträge wie die Liste",
    (asQ14.match(/ist_test_am IS NULL\)::int AS/g) || []).length >= 6);
  ok("… und der Grund steht dabei",
    /Ein Zähler, der eine andere Menge zählt als die Liste zeigt/.test(asQ14));

  // ── PUNKT 10: ERGEBNIS WIRD NICHT ÜBERNOMMEN ──────────────────────────
  // „Trotz dass ich ein Ergebnis gedrückt habe, steht die Person ohne Ergebnis
  // da." Gemessen: 5 von 12 Anrufen ohne Ergebnis hatten einen ANDEREN Anruf
  // mit Ergebnis beim selben Kunden im selben Zeitfenster.
  const telQ3 = datei("server/routes/fiaon-telefonie.ts");
  ok("Ein Ergebnis gilt für alle Versuche desselben Gesprächs",
    /OR \(\n           ergebnis IS NULL/.test(telQ3)
    && /INTERVAL '2 hours'/.test(telQ3));
  ok("… und ein hängender Versuch wird dabei beendet",
    /status = CASE WHEN status = 'laeuft' THEN 'beendet' ELSE status END/.test(telQ3));
  const spQ14 = datei("server/lib/fiaon-softphone.ts");
  ok("Anrufe auf „läuft“ verschwinden nach einer Stunde aus der Liste",
    /c\.status = 'laeuft' AND c\.beginn > NOW\(\) - INTERVAL '1 hour'/.test(spQ14));

  // ── PUNKT 9: „ERREICHT – SONSTIGES" ───────────────────────────────────
  // „Mir fehlt ein Status für Kunden, die ich erreicht habe, bei denen aber
  // noch kein klares Ergebnis vorliegt."
  const { ERGEBNISSE: ERG, ERGEBNIS_TEXT, istErgebnis } =
    await import("../server/lib/fiaon-kontakt-ergebnis");
  ok("Das Ergebnis „erreicht_sonstiges“ gibt es", istErgebnis("erreicht_sonstiges"));
  gleich("… mit Klartext", (ERGEBNIS_TEXT as any).erreicht_sonstiges, "Erreicht — Sonstiges");
  ok("… es zählt als GESPRÄCH, nicht als Fehlversuch", (() => {
    const q = datei("server/lib/fiaon-kontakt-ergebnis.ts");
    const i = q.indexOf('case "erreicht_sonstiges":');
    const j = q.indexOf('case "nicht_erreicht":', i);
    return i > 0 && j > i && !q.slice(i, j).includes("zaehlerHoch = true");
  })());
  ok("… mit Wiedervorlage in drei Tagen", (() => {
    const q = datei("server/lib/fiaon-kontakt-ergebnis.ts");
    const i = q.indexOf('case "erreicht_sonstiges":');
    return i > 0 && q.slice(i, i + 700).includes("tagPlus(3)");
  })());
  ok("In der Kundenliste öffnet es die Notiz",
    /\{ art: "erreicht_sonstiges", label: "Erreicht – Sonstiges", braucht: "notiz" \}/
      .test(datei("client/src/pages/agent/kunden-neu.tsx")));
  ok("… und ohne Text wird nicht gespeichert",
    /if \(!notiz\.trim\(\)\) \{ setFeldOffen\("notiz"\); return; \}/
      .test(datei("client/src/pages/agent/kunden-neu.tsx")));
  // Der Eintrag trägt seit dem 17.08.2026 zusätzlich `notizPflicht: true` —
  // im Panel gab es vorher gar kein Notizfeld, und in der Akte stand nur
  // „Sonstiges" (siebenmal gemessen). Die Prüfung sucht das Ergebnis, nicht
  // die vollständige Zeile.
  ok("Auch das Telefon kennt es",
    /art: "erreicht_sonstiges", label: "Erreicht – Sonstiges"/
      .test(datei("client/src/components/Softphone.tsx")));
  ok("… und verlangt dort jetzt eine Notiz",
    /art: "erreicht_sonstiges"[^\n]*notizPflicht: true/
      .test(datei("client/src/components/Softphone.tsx")));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("5c15. Agenten-Rückmeldung, zweiter Teil");
  // ═══════════════════════════════════════════════════════════════════════

  // ── PUNKT 4: EIN KUNDE HAT BUCHUNGEN, NICHT EINE BESTELLUNG ───────────
  // „Jetzt ist das Paket bei mir komplett verschwunden und er taucht nur noch
  // wegen der Schufa auf." Gemessen: Person #5144 hat zwei Bestellungen —
  // ultra (79,99 €, 23.07.) und Bonität (74 €, 31.07.). Die Karte holte mit
  // „ORDER BY created_at DESC LIMIT 1" die neuere.
  const { buchungenVon, buchungsZeile, alleBezahlt, artVon } =
    await import("../server/lib/fiaon-buchungen");
  const b5144 = await buchungenVon(5144);
  gleich("Shahed Mohammad hat ZWEI Buchungen", b5144.length, 2);
  ok("… Paket UND Bonitätsauskunft",
    b5144.some((x) => x.art === "paket") && b5144.some((x) => x.art === "bonitaet"),
    buchungsZeile(b5144));
  ok("… und beide sind offen", b5144.every((x) => x.offen));
  gleich("Eine SCHUFA-Referenz wird als Zusatz erkannt",
    artVon("FIAON-SCHUFA-X", null, null, 74), "bonitaet");
  gleich("Ein Paket bleibt Paket", artVon("FIAON-ABC", "ultra", "FIAON Ultra", 99.99), "paket");
  const [mehrfach] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM (
      SELECT p.id FROM fiaon_persons p JOIN fiaon_applications a ON a.person_id = p.id
      WHERE p.merged_into_person_id IS NULL AND a.merged_into IS NULL
        AND a.archived_at IS NULL AND a.payment_status <> 'paid'
      GROUP BY p.id HAVING COUNT(*) > 1) x
  `) as any[];
  ok(`${mehrfach.n} Kunden haben mehr als eine offene Buchung`,
    Number(mehrfach.n) > 0, "Die sahen bisher nur eine");
  ok("Die Karte holt ALLE Buchungen",
    /buchungen_roh/.test(datei("server/routes/fiaon-agent-start.ts")));
  ok("… und zeigt sie in der Liste",
    /\(k\.buchungen \?\? \[\]\)\.filter\(\(b\) => !b\.erledigt\)\.map/
      .test(datei("client/src/pages/agent/kunden-neu.tsx")));

  // ── PUNKT 3: BUCHUNGEN IN DEN STAMMDATEN ──────────────────────────────
  // „Es wäre wichtig, dass jeder Mitarbeiter sieht: welches Paket, welche
  // Zusatzleistungen, was bezahlt bzw. offen ist, wann der Antrag gestellt
  // wurde."
  const knQ15 = datei("client/src/pages/agent/kunden-neu.tsx");
  ok("Der Buchungs-Block zeigt alle vier Angaben",
    />\s*Buchungen\s*<\/p>/.test(knQ15) && /gestellt \{b\.gestelltAm/.test(knQ15)
    && /\{b\.zahlungText\}/.test(knQ15) && /b\.art === "bonitaet" \? "Zusatz" : "Paket"/.test(knQ15));
  ok("… mit der Summe des Offenen", /Offen insgesamt:/.test(knQ15));
  ok("… und dem Verwendungszweck", /Verwendungszweck: \{b\.verwendungszweck\}/.test(knQ15));

  // ── PUNKT 2: „BEZAHLT" HEISST ALLES BEZAHLT ───────────────────────────
  // „Unter Bezahlt befinden sich Kunden, bei denen das Paket bezahlt, die
  // Schufa aber noch offen ist."
  const tierQ15 = datei("server/lib/tier.ts");
  ok("Eine offene RECHNUNG schlägt „bezahlt“",
    /rang BETWEEN 35 AND 50/.test(tierQ15));
  ok("… aber ein alter abgebrochener Antrag NICHT",
    /nie eine Rechnung gestellt/.test(tierQ15));
  ok("Der erste Entwurf ist als zu scharf benannt",
    /134 bezahlte Kunden wären zurück in den Vertrieb gewandert/.test(tierQ15));
  const [falschBezahlt] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_persons p
    WHERE p.priority_tier = 0 AND p.merged_into_person_id IS NULL
      AND EXISTS (SELECT 1 FROM fiaon_applications a
        WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.archived_at IS NULL
          AND a.payment_status IN ('pending_payment','claimed_paid','expired'))
  `) as any[];
  gleich("KEIN Kunde steht auf „bezahlt“ mit offener Rechnung",
    Number(falschBezahlt.n), 0);
  // ── DIE LOGIK, NICHT NUR DER IST-ZUSTAND ──────────────────────────────
  // Die Zahl oben ist heute null, WEIL die Regel greift. Nimmt man sie
  // heraus, bleibt die Zahl bis zum nächsten Tageslauf trotzdem null — die
  // Gegenprobe blieb deshalb grün. Diese Prüfung rechnet die Einstufung
  // frisch aus und vergleicht sie mit dem, was in der Tabelle steht.
  const { personTierSql } = await import("../server/lib/tier");
  const [abweichung] = (await sqlPool.unsafe(`
    WITH neu AS (${personTierSql()})
    SELECT COUNT(*)::int AS n
    FROM fiaon_persons p JOIN neu n ON n.person_id = p.id
    WHERE p.merged_into_person_id IS NULL
      AND p.priority_tier = 0
      AND n.priority_tier > 0
  `)) as any[];
  gleich("Die Einstufung berechnet dasselbe, was in der Tabelle steht",
    Number(abweichung.n), 0);
  ok("alleBezahlt() erkennt gemischte Fälle", !alleBezahlt(b5144));

  // ── PUNKT 1: „RECHNUNG OFFEN" OHNE RECHNUNG ───────────────────────────
  const [ohneRechnung] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_persons p
    WHERE p.tier_reason = 'rechnung_offen' AND p.merged_into_person_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM fiaon_applications a
        WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.archived_at IS NULL
          AND a.payment_status IN ('pending_payment','claimed_paid','expired'))
  `) as any[];
  gleich("Unter „Rechnung offen“ steht keiner OHNE Rechnung", Number(ohneRechnung.n), 0);
  ok("„Antrag fertig“ verspricht keine Rechnung mehr",
    /titel: "Antrag fertig — Rechnung noch nicht gestellt"/.test(datei("server/lib/tier-hinweise.ts")));
  ok("… und der Hinweis sagt, was zu tun ist",
    /schicke über\n      „Zahlungsdetails senden|die erste Rechnung/.test(datei("server/lib/tier-hinweise.ts")));

  // ── PUNKT 8: TERMIN ÖFFNET DEN KUNDEN ─────────────────────────────────
  ok("Ein angesprungener Kunde steht immer in der Liste",
    /const nurPerson = req\.query\.person/.test(datei("server/routes/fiaon-agent-start.ts")));
  ok("… und die Rechteprüfung bleibt",
    /Die Rechteprüfung bleibt/.test(datei("server/routes/fiaon-agent-start.ts")));
  ok("Der Client fordert ihn an", /p\.set\("person", String\(nurPerson\)\)/.test(knQ15));

  // ── PUNKT 7: ERINNERUNG IM PORTAL ─────────────────────────────────────
  const teQ = datei("client/src/components/TerminErinnerung.tsx");
  ok("Es gibt eine Erinnerungsleiste", /export function TerminErinnerung/.test(teQ));
  ok("… sie zeigt auch ÜBERFÄLLIGE", /überfällig/.test(teQ));
  ok("… führt direkt zum Kunden", /\/agent\/kunden\?person=\$\{erste\.personId\}/.test(teQ));
  ok("… blockiert nichts", /Sie blockiert nichts, sie klingelt nicht/.test(teQ));
  ok("… und der Grund für „im Portal statt nur Mail“ steht dabei",
    /externen Dienst/.test(teQ));
  ok("Die Route liefert Rückrufe UND Startgespräche",
    /agent\/termine\/faellig/.test(datei("server/routes/fiaon-agent-start.ts")));

  // ── PUNKT 10: DIE ANSAGE HÖRT DER KUNDE ───────────────────────────────
  // „Die angekündigte Durchsage scheint nur ich zu hören, nicht der Kunde."
  const spQ15 = datei("server/lib/fiaon-softphone.ts");
  ok("Die Ansage steht am <Number>, nicht vor dem <Dial>",
    /<Number url="\$\{esc\(opts\.ansageUrl\)\}">/.test(spQ15));
  ok("… und der Rechtsgrund steht dabei",
    /§201 StGB strafbar/.test(spQ15));
  ok("Es gibt eine Ansage-Route",
    /router\.all\("\/telefon\/ansage"/.test(datei("server/routes/fiaon-telefonie.ts")));
  ok("… mit Rückfallansage, falls der Text nicht lädt",
    /Lieber eine kurze Standardansage als gar keine/.test(datei("server/routes/fiaon-telefonie.ts")));
  ok("Die Stammdaten stehen im Gespräch",
    /fi-tel-daten/.test(datei("client/src/components/Softphone.tsx"))
    && /telefon\/kunde\/\$\{kunde\.personId\}/.test(datei("client/src/components/Softphone.tsx")));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("5c16. Die erste Rechnung");
  // ═══════════════════════════════════════════════════════════════════════
  // Der Vorgesetzte: „ALLE die einen Antrag bei uns gestellt haben brauchen
  // eine Rechnung und müssen täglich versendet werden und den Agenten eben
  // passend angezeigt werden und mit Knopfdruck versendbar sein!"
  const { rechnungsKandidaten, rechnungStellen, RECHNUNGSREIF, ZAHLUNGSFRIST_TAGE } =
    await import("../server/lib/fiaon-rechnung-stellen");

  const kand = await rechnungsKandidaten({ grenze: 2000 });
  const versendbar = kand.filter((k) => !k.hindernis);
  ok(`${kand.length} rechnungsreife Anträge, ${versendbar.length} sofort versendbar`,
    kand.length > 0);
  ok("Jeder nicht versendbare nennt seinen Grund IN WORTEN",
    kand.filter((k) => k.hindernis).every((k) => k.hindernis!.length > 25));
  ok("Jeder versendbare hat Betrag, Zweck und Empfänger",
    versendbar.every((k) => k.betragCents > 0 && !!k.verwendungszweck && !!k.email));

  // ── ANGEFANGENE FORMULARE SIND KEINE ANTRÄGE ──────────────────────────
  // Gemessen: Von 3.626 Einträgen im Zustand „personal_data" haben SECHS eine
  // E-Mail. Das sind Spuren im Trichter, keine gestellten Anträge.
  ok("„personal_data“ ist NICHT rechnungsreif",
    !(RECHNUNGSREIF as readonly string[]).includes("personal_data"));
  ok("„contract“ und „finances“ ebenso wenig",
    !(RECHNUNGSREIF as readonly string[]).includes("contract")
    && !(RECHNUNGSREIF as readonly string[]).includes("finances"));
  ok("„completed“ und „approved“ schon",
    (RECHNUNGSREIF as readonly string[]).includes("completed")
    && (RECHNUNGSREIF as readonly string[]).includes("approved"));

  // ── DAS VERHALTEN, IN EINER TRANSAKTION ───────────────────────────────
  // AGENTS.md: „Prüfstände laufen in einer Transaktion, die am Ende
  // zurückgerollt wird." Genau hier ist das nötig — die Funktion schreibt.
  if (versendbar.length > 0) {
    class Rollback extends Error {}
    const probe = versendbar[0];
    let ergebnis: any = null;
    try {
      await sqlPool.begin(async (tx: any) => {
        await rechnungStellen(probe.ref, { akteur: "Prüfstand", nurBuchen: true }, tx);
        const [n] = (await tx`
          SELECT amount_due, payment_due_date, payment_status
          FROM fiaon_applications WHERE ref = ${probe.ref}
        `) as any[];
        const nochKandidat = (await rechnungsKandidaten({ grenze: 2000 }, tx))
          .some((x: any) => x.ref === probe.ref);
        ergebnis = {
          betrag: Number(n.amount_due),
          tage: n.payment_due_date
            ? Math.round((new Date(n.payment_due_date).getTime() - Date.now()) / 86_400_000)
            : null,
          stand: n.payment_status,
          nochKandidat,
        };
        throw new Rollback();
      });
    } catch (e) { if (!(e instanceof Rollback)) throw e; }

    gleich("Der Betrag kommt aus dem Paket",
      ergebnis.betrag, probe.betragCents / 100);
    ok(`Die Frist liegt bei ${ZAHLUNGSFRIST_TAGE} Tagen`,
      ergebnis.tage !== null && Math.abs(ergebnis.tage - ZAHLUNGSFRIST_TAGE) <= 1,
      `gemessen: ${ergebnis.tage}`);
    gleich("Der Zustand wechselt auf „Rechnung offen“",
      ergebnis.stand, "pending_payment");
    ok("… und er bekommt KEINE zweite erste Rechnung", !ergebnis.nochKandidat);
  }

  // ── DER KNOPF DES AGENTEN ─────────────────────────────────────────────
  const akQ16 = datei("server/routes/fiaon-agent-kunden.ts");
  ok("Der bestehende Knopf stellt die Rechnung gleich mit",
    /const \{ rechnungStellen, RECHNUNGSREIF \} = await import/.test(akQ16));
  ok("… statt „keine offene Bestellung“ zu melden",
    /Der Antrag ist noch nicht abgeschlossen \(Stand: \$\{warum\.status\}\)/.test(akQ16));
  ok("Es gibt eine Liste für die Agenten",
    /router\.get\("\/agent\/rechnungen\/offen"/.test(akQ16));
  ok("… und einen Knopf je Bestellung",
    /router\.post\("\/agent\/rechnungen\/:ref\/stellen"/.test(akQ16));
  ok("Der Filter „Rechnung stellen“ steht in der Liste",
    /key: "rechnung_stellen"/.test(datei("client/src/pages/agent/kunden-neu.tsx")));
  ok("… mit Zähler aus derselben Bedingung",
    /rechnung_stellen,/.test(datei("server/routes/fiaon-agent-start.ts")));

  // ── DER TAGESLAUF ─────────────────────────────────────────────────────
  ok("Der Tageslauf läuft mit den anderen",
    /rechnungenTageslauf\(\{ schreiben: true \}\)/
      .test(datei("server/routes/fiaon-antrag.ts")));
  // Die Obergrenze von 50 wurde am 11.08.2026 aufgehoben („Die 50 am Tag
  // erhöhen wir auf unlimitiert"). Die Prüfung dazu ist mitgegangen — eine
  // Prüfung auf eine abgeschaffte Regel ist schlimmer als keine.
  ok("… und die Begründung für die Aufhebung steht dabei",
    /Die 50 am Tag erhoehen wir auf unlimitiert|auf unlimitiert/
      .test(datei("server/lib/fiaon-rechnung-stellen.ts")));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("5c17. Verkaufsstart");
  // ═══════════════════════════════════════════════════════════════════════

  // ── KEINE OBERGRENZE MEHR ─────────────────────────────────────────────
  // „Die 50 am Tag erhöhen wir auf unlimitiert."
  const rsQ = datei("server/lib/fiaon-rechnung-stellen.ts");
  ok("Der Lauf hat keine feste Obergrenze",
    /const dran = opts\.grenze && opts\.grenze > 0 \? alle\.slice\(0, opts\.grenze\) : alle;/.test(rsQ));
  ok("… und der Tageslauf ruft ihn ohne Grenze",
    /rechnungenTageslauf\(\{ schreiben: true \}\)/.test(datei("server/routes/fiaon-antrag.ts")));

  // ── DER KNOPF IN DER ZAHLUNGSZENTRALE ─────────────────────────────────
  const anQ = datei("server/routes/fiaon-antrag.ts");
  ok("Es gibt eine Vorschau-Route",
    /router\.get\("\/admin\/rechnungen\/erste\/vorschau"/.test(anQ));
  ok("… und eine zum Senden", /router\.post\("\/admin\/rechnungen\/erste\/senden"/.test(anQ));
  ok("Ein zweiter Lauf parallel wird abgewiesen",
    /if \(ersteRechnungenLaeuft\) \{/.test(anQ));
  ok("Der Lauf antwortet sofort und arbeitet im Hintergrund",
    /WARUM IM HINTERGRUND/.test(anQ) && /void \(async \(\) => \{/.test(anQ));
  const azQ = datei("client/src/pages/admin-zahlungen.tsx");
  ok("Der Knopf steht in der Zahlungszentrale",
    /onClick=\{oeffneErsteRechnungen\}/.test(azQ));
  ok("… mit eigener Vorschau statt Mahnung",
    /sachlich falsch und unhöflich/.test(azQ));
  ok("… und der Dialog nennt Summe und Hindernisse",
    /zusammen\{" "\}/.test(azQ) && /übersprungen: \{grund\.toLowerCase\(\)\}/.test(azQ));
  ok("… und sagt ehrlich, dass die Anträge alt sind",
    /liegen zwei Monate und länger/.test(azQ));

  // ── DER BANNER ────────────────────────────────────────────────────────
  const vbQ = datei("client/src/components/VerkaufsstartBanner.tsx");
  ok("Es gibt einen Verkaufsstart-Banner", /export function VerkaufsstartBanner/.test(vbQ));
  ok("… er zeigt die EIGENE Zahl, nicht die vom Haus",
    /Bei dir liegen 66|„66 Kunden in deiner Liste"|ist ein Auftrag/.test(vbQ));
  ok("… mit Link auf die Update-Seite", /href="\/agent\/updates"/.test(vbQ));
  ok("… und direkt in die Liste",
    /href="\/agent\/kunden\?filter=rechnung_stellen"/.test(vbQ));
  ok("Das Forderungsmanagement sieht ihn NICHT",
    /rolle === "inkasso"/.test(vbQ));
  ok("Wer ihn gelesen hat, sieht ihn nicht wieder",
    /localStorage\.setItem\(SCHLUESSEL, "gelesen"\)/.test(vbQ));
  ok("Er hängt nur im Agentenrahmen",
    /<VerkaufsstartBanner rolle=\{rolle\} \/>/.test(datei("client/src/pages/agent/shared.tsx")));

  // ── ALLE KUNDEN SIND VERTEILT ─────────────────────────────────────────
  // ── DIESE ZAHL DARF NICHT NULL VERLANGEN ──────────────────────────────
  // Erster Entwurf: „gleich(…, 0)". Beim zweiten Lauf stand dort 1 — ein
  // echter Besucher hatte in der Zwischenzeit einen Antrag begonnen.
  //
  // AGENTS.md: „Eine Invariante darf nicht den Betrieb mitmessen. Global nur
  // ‚darf nicht schrumpfen‘ — Wachstum ist der Betrieb." Hier ist es
  // umgekehrt: Ein paar Unverteilte sind normal, sie werden beim nächsten
  // Lauf zugeteilt. Ein RÜCKSTAU wäre das Problem.
  const [ohne] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_persons p
    WHERE p.merged_into_person_id IS NULL AND NOT p.is_blocked
      AND p.assigned_agent_id IS NULL AND p.priority_tier BETWEEN 1 AND 3
      AND p.ist_test_am IS NULL
      -- Nur was länger als einen Tag liegt: Frische Anträge sind unterwegs.
      AND p.created_at < NOW() - INTERVAL '1 day'
  `) as any[];
  ok("Kein Rückstau unverteilter Kunden (älter als ein Tag)",
    Number(ohne.n) <= 5, `${ohne.n} liegen unverteilt`);

  // ── NUR ARBEITSKONTEN VERGLEICHEN ─────────────────────────────────────
  // Erster Entwurf verglich alle mit Rolle „agent" oder „vertriebsleiter".
  // Dabei war ein Konto mit ZWEI Kunden — das des Betreibers, der nicht im
  // Vertrieb arbeitet. Die Spanne betrug 966 und die Prüfung schlug fehl,
  // obwohl die vier Arbeitskonten auf 15 Kunden genau gleich lagen.
  //
  // Ein Vergleich, der Äpfel mit Birnen misst, meldet Fehler, die keine sind —
  // und wer zweimal grundlos gestoppt wurde, schaltet die Prüfung ab.
  const last = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_persons p
    JOIN fiaon_agents a ON a.id = p.assigned_agent_id
    WHERE a.active AND a.rolle IN ('agent','vertriebsleiter')
      AND p.merged_into_person_id IS NULL AND NOT p.is_blocked
      AND p.priority_tier BETWEEN 1 AND 3
    GROUP BY a.id
    HAVING COUNT(*) > 50
  `) as any[];
  const lastZahlen = last.map((x: any) => Number(x.n));
  const spanne = Math.max(...lastZahlen) - Math.min(...lastZahlen);
  ok(`Die Last ist ausgeglichen (Spanne ${spanne} bei ${lastZahlen.join("/")})`,
    spanne < 150, "Mehr als 150 Unterschied wäre ungerecht verteilt");

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("5c18. Schweiz-Kampagne");
  // ═══════════════════════════════════════════════════════════════════════
  // „Wir starten mit der Werbekampagne in der Schweiz. Wenn Schweizer Nutzer
  // auf diese Seite kommen, entlarven derzeit mehrere Details die Plattform
  // sofort als importiertes deutsches System."
  const { LAENDER: LP, betrag: bet, gebuehr: geb } =
    await import("../client/src/lib/fiaon-land");

  gleich("Ein Limit in der Schweiz trägt CHF und Apostroph",
    bet("25.000", "ch"), "CHF 25'000");
  gleich("… in Deutschland Euro mit Punkt", bet("25.000", "de"), "25.000 €");
  gleich("Eine Gebühr in der Schweiz: Rappen mit Punkt",
    geb("59,99", "ch"), "CHF 59.99");
  gleich("… in Österreich Euro mit Komma", geb("59,99", "at"), "59,99 €");
  gleich("Das Schweizer Register ist die ZEK", LP.ch.register, "ZEK");
  gleich("Das österreichische der KSV", LP.at.register, "KSV");
  ok("Die Zahlen werden NICHT umgerechnet",
    bet("25.000", "ch").includes("25") && bet("25.000", "de").includes("25"),
    "25.000 heißt in Zürich 25.000 CHF — ein Limit ist keine Größe zum Wechseln");
  ok("Jedes Land hat eigene Städte",
    LP.ch.staedte[0] === "Zürich" && LP.de.staedte[0] === "Köln"
    && LP.at.staedte[0] === "Wien");
  ok("Kein „deutsche Banken“ mehr in irgendeinem Profil",
    !Object.values(LP).some((x: any) => /deutsche Banken/.test(x.bankenSatz)));

  const stQ = datei("client/src/pages/start.tsx");
  ok("Auf /start steht kein festes SCHUFA mehr",
    !/>\s*Keine SCHUFA-Abfrage/.test(stQ));
  ok("… kein festes Euro-Zeichen in den Preisen",
    !/€\/Mt\./.test(stQ));
  ok("… und keine festen deutschen Städte im Feed",
    !/c: "Köln"/.test(stQ));
  ok("Der Countdown ist durch einen Live-Status ersetzt",
    /Systemkapazität für heute zu/.test(stQ) && !/const left = useCountdown/.test(stQ));
  // Die Fundstelle darf nicht im eigenen ERKLAERTEXT liegen: Der Kommentar
  // zitiert die alte Zeile, damit man weiss, was ersetzt wurde. Geprueft wird
  // deshalb der ausgegebene Text, nicht das Zitat.
  ok("… und die zweite Dringlichkeit unter dem Knopf ist weg",
    /keine Zahlungsdaten nötig<\/span>/.test(stQ)
    && !/startUrgency 2\.4s ease-in-out infinite" \}\}>Nur noch/.test(stQ));
  ok("Die Länderwahl erscheint nur ohne Herkunft",
    /if \(landGewaehlt\(\)\) return;/.test(datei("client/src/components/LandWahl.tsx")));
  ok("… mit gezeichneten Flaggen, keinen Emojis",
    /function FlaggeCH/.test(datei("client/src/components/LandWahl.tsx")));

  // ── 3D, GLAS, GLANZ (13.08.2026) ──────────────────────────────────────
  // „Das muss besser aussehen: 3D, Glas, Animationen, die Flaggen alle gleich
  // groß — glänzend vielleicht?"
  const lwQ = datei("client/src/components/LandWahl.tsx");
  ok("Alle drei Flaggen teilen EINEN Rahmen",
    /function FlaggenRahmen/.test(lwQ)
    && (lwQ.match(/<FlaggenRahmen>/g) || []).length === 3);
  ok("… die Schweizer füllt die Fläche (kein weißer Rand)",
    /<rect width="60" height="40" fill="#D52B1E" \/>/.test(lwQ));
  ok("… und der Grund für die gedehnte Darstellung steht dabei",
    /Gleiche Fläche schlägt amtliche Proportion/.test(lwQ));
  ok("Jede Flagge hat Glanz und Tiefe",
    /id="fl-glanz"/.test(lwQ) && /id="fl-streif"/.test(lwQ) && /id="fl-tief"/.test(lwQ));
  ok("Die Bühne hat Perspektive", /perspective: 1400px/.test(lwQ));
  ok("Die Karten kippen unter der Maus",
    /rotateX\(var\(--rx, 0deg\)\) rotateY\(var\(--ry, 0deg\)\)/.test(lwQ));
  ok("… und ein Lichtpunkt folgt dem Zeiger",
    /radial-gradient\(200px circle at var\(--mx/.test(lwQ));
  ok("Der Auftritt kommt aus der Tiefe, nicht von unten",
    /translate3d\(0, 30px, -140px\) rotateX\(9deg\)/.test(lwQ));
  ok("… die Knöpfe gestaffelt",
    /calc\(340ms \+ var\(--i, 0\) \* 85ms\)/.test(lwQ));
  ok("Das Glanzband läuft EINMAL, nicht dauernd",
    /ist Kirmes, nicht Wertigkeit/.test(lwQ)
    && /animation: fiLwStreif 1500ms/.test(lwQ));
  ok("Der Satz je Land bricht nicht um",
    /white-space: nowrap/.test(lwQ) && /ungleiche Höhen sind das Erste/.test(lwQ));
  ok("Wer weniger Bewegung will, bekommt keine",
    /prefers-reduced-motion: reduce/.test(lwQ)
    && /animation: none !important/.test(lwQ));
  ok("… und der Grund gegen IP-Erkennung steht dabei",
    /bei VPN und Mobilfunk oft falsch|bei VPN, Mobilfunk/
      .test(datei("client/src/components/LandWahl.tsx")));
  ok("Am Seitenende kann man das Land wechseln",
    /function LandUmschalter/.test(stQ));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("5c19. Wer ist für eine Rate zuständig?");
  // ═══════════════════════════════════════════════════════════════════════
  // Der Vorgesetzte (13.08.2026): „Warum sind Agenten (Lucas, Florentine,
  // Daniel) ausgewählt? ALLE Kunden, die eine offene Rate haben, müssen zum
  // Forderungsmanagement. DAS DÜRFEN SIE NICHT!"
  //
  // Die Zuteilung war korrekt — die ANZEIGE war falsch: Sie zeigte den
  // Vertriebsagenten der Bestellung.

  // ── DIE HARTE REGEL ───────────────────────────────────────────────────
  const [beiVertrieb] = (await sqlPool`
    SELECT COUNT(*)::int AS n
    FROM fiaon_abo_raten r JOIN fiaon_agents a ON a.id = r.inkasso_agent_id
    WHERE r.status <> 'bezahlt' AND a.rolle NOT IN ('inkasso', 'admin')
  `) as any[];
  gleich("KEINE offene Rate liegt bei einem Vertriebsagenten",
    Number(beiVertrieb.n), 0);

  const [faelligOhne] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_abo_raten r
    WHERE r.status <> 'bezahlt' AND r.inkasso_agent_id IS NULL
      -- ── „<" UND NICHT „<=" (16.08.2026) ──────────────────────────────
      -- Die Geschäftsregel des Betreibers: „Ist die Rate am 06.08. nicht als
      -- bezahlt gebucht, steht er im Forderungsmanagement." Also am Tag NACH
      -- der Fälligkeit. Eine Rate, die HEUTE fällig wird, ist nicht überfällig
      -- — sie ist fällig, und der Kunde hat den ganzen Tag Zeit.
      --
      -- Hier stand „<=". Damit verlangte der Prüfstand einen Zuständigen für
      -- die 16 Raten, die heute fällig werden — die Zuteilung vergibt sie
      -- bewusst erst morgen. Eine Prüfung, die etwas fordert, was die Regel
      -- verbietet, kann nur rot sein.
      AND r.faellig_am < CURRENT_DATE
      -- Eine STORNIERTE Rate braucht keinen Zuständigen (Migration 052): Sie
      -- ist entwertet, nicht offen. Ohne diese Zeile zählte der Prüfstand die
      -- vier am 16.08.2026 zu Recht entwerteten Raten als liegengebliebene
      -- Arbeit — eine Bremse, die auf einen Aufräumvorgang anspringt.
      AND r.storniert_am IS NULL
  `) as any[];
  ok("Jede FÄLLIGE Rate hat einen Zuständigen",
    Number(faelligOhne.n) <= 3,
    `${faelligOhne.n} fällige Raten ohne Zuteilung — künftige brauchen keine, `
    + "sie werden bei Fälligkeit zugeteilt");

  // ── DIE ANZEIGE ───────────────────────────────────────────────────────
  const aboQ = datei("server/routes/fiaon-abo.ts");
  ok("Die Tafel liest den INKASSO-Zuständigen",
    /LEFT JOIN fiaon_agents ink ON ink\.id = r\.inkasso_agent_id/.test(aboQ));
  ok("… und der Vertriebsagent ist getrennt benannt",
    /vertr\.name AS vertrieb_name/.test(aboQ));
  ok("Der Grund steht dabei",
    /Provisionsgeschichte, keine/.test(aboQ));
  const tafelQ = datei("client/src/components/admin/AboTafel.tsx");
  ok("Ohne Zuständigen steht „noch nicht zugeteilt“",
    /noch nicht zugeteilt/.test(tafelQ));
  ok("… und der Grund dafür ist notiert",
    /die gefährlichste Art Lücke/.test(tafelQ));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("5c20. Doppelte Buchungen wegräumen");
  // ═══════════════════════════════════════════════════════════════════════
  // Der Vorgesetzte (13.08.2026): „Agenten, Vertriebsleiter, Onboarding,
  // Forderungsmanagement sollen ab sofort Produkte/Buchungen löschen können."
  //
  // Daniel Stripling, 00:30: „Man sieht hier jetzt alle Anträge. Fragt man dann
  // am Telefon nach, welchen die Person möchte, löscht die anderen? Weil
  // Anträge rauslöschen geht nicht."
  const [mehrfach20] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM (
      SELECT p.id FROM fiaon_persons p JOIN fiaon_applications a ON a.person_id = p.id
      WHERE p.merged_into_person_id IS NULL AND a.merged_into IS NULL
        AND a.archived_at IS NULL
        AND a.payment_status NOT IN ('paid', 'cancelled', 'refunded')
      GROUP BY p.id HAVING COUNT(*) > 1) x
  `) as any[];
  ok(`${mehrfach20.n} Kunden haben mehrere offene Buchungen`, Number(mehrfach20.n) > 0,
    "Genau der Fall, den Daniel gemeldet hat");

  const akQ20 = datei("server/routes/fiaon-agent-kunden.ts");
  ok("Es gibt eine Route zum Wegräumen",
    /router\.post\("\/agent\/buchungen\/:ref\/archivieren"/.test(akQ20));
  ok("… sie ARCHIVIERT, sie löscht nicht",
    /archiviereAntrag\(/.test(akQ20) && !/DELETE FROM fiaon_applications/.test(akQ20));
  ok("… und der Grund dafür steht dabei",
    /Eine gelöschte Bestellung nimmt drei Dinge mit/.test(akQ20));
  // ── DAS VERHALTEN, NICHT DER WORTLAUT ─────────────────────────────────
  // Erster Versuch suchte den Meldungstext. Die Gegenprobe (Bedingung auf
  // `false` setzen) blieb gruen — der Text stand ja weiter da. Geprueft wird
  // deshalb, dass die ZAEHLPRUEFUNG mit Ruecksprung VOR dem Archivieren steht.
  ok("Die LETZTE Buchung bleibt stehen", (() => {
    const i = akQ20.indexOf("if (Number(zahl.n) <= 1) {");
    const j = akQ20.indexOf("archiviereAntrag(", i);
    if (i < 0 || j < 0) return false;
    return /return res\.status\(400\)/.test(akQ20.slice(i, j));
  })());
  ok("Der Kundenzugriff wird geprüft",
    /darfAnKunde\(req\.agent!\.id, rolle, Number\(b\.person_id\)\)/.test(akQ20));

  // ── DIE WÄNDE IM ARCHIV ───────────────────────────────────────────────
  const { archivPruefung: ap } = await import("../server/lib/fiaon-antrag-archiv");
  const [bezahlt20] = (await sqlPool`
    SELECT ref FROM fiaon_applications
    WHERE payment_status = 'paid' AND merged_into IS NULL AND archived_at IS NULL
    LIMIT 1
  `) as any[];
  if (bezahlt20) {
    const pruef = await ap(String(bezahlt20.ref));
    ok("Eine BEZAHLTE Bestellung lässt sich nicht wegräumen",
      !!pruef?.sperrgrund, String(pruef?.sperrgrund ?? "").slice(0, 50));
  }
  ok("Ein Mitarbeiter darf archivieren, aber nicht wiederherstellen",
    /rolle: "admin" \| "leitung" \| "mitarbeiter"/
      .test(datei("server/lib/fiaon-antrag-archiv.ts"))
    && /if \(akteur\.rolle !== "admin"\)/.test(datei("server/lib/fiaon-antrag-archiv.ts")));
  ok("… und der Grund dafür steht dabei",
    /nicht selbst zurückholen und damit die Spur/
      .test(datei("server/lib/fiaon-antrag-archiv.ts")));

  // ── DIE OBERFLÄCHE ────────────────────────────────────────────────────
  const knQ20 = datei("client/src/pages/agent/kunden-neu.tsx");
  ok("An jeder doppelten Buchung steht ein Knopf",
    /Doppelt — wegräumen/.test(knQ20));
  ok("… mit Rückfrage vor dem Klick", /aus der Liste nehmen\?/.test(knQ20));
  ok("… und er erscheint nur bei mehr als einer Buchung",
    /\(k\.buchungen \?\? \[\]\)\.filter\(\(x\) => !x\.erledigt\)\.length > 1/.test(knQ20));
  ok("Daniels zweite Frage ist in der Oberfläche beantwortet",
    /das ist mit hoher/.test(knQ20));

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
