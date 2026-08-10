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
  gleich("Keine Person verloren oder hinzugekommen", nachher.personen, vorher.personen);
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
