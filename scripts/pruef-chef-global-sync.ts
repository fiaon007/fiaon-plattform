// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: CHEFBÜRO › GLOBAL-MANDATE SYNCHRON MIT DEM KUNDENPORTAL (E-443, 28.10.2026)
//
// Justin: „Man kann über das Chef-Dashboard kaum arbeiten, es läuft nicht synchron mit dem Kundenportal.“
// Die Daten hatten EINE Quelle — kaputt waren Nachladen, Neu-Markierung und Aufgaben. Rein — keine Datenbank, kein Netz.
//   F1  NACHLADEN   useDaten(takt): leise alle 60 s bei sichtbarem Tab + beim Zurückkehren; kein „lädt …“, kein Fehler,
//                   Formulare bleiben; andere Aufrufer unverändert
//   F2  NEU-MARKE   GET der Akte schreibt nichts; „neu“ je Kunden-Dokument; gesehen = Datei öffnen / „Alle als gesehen“
//   F3  AUFGABEN    EIN Weg ins Chefbüro (globalChefMandatPfad); gesehen/gelesen erledigt die passende Aufgabe (Schlüssel)
//   F4  BITTE NEU   ablehnen mit Grund, Art korrigieren; abgelehnt zählt nicht; Portal zeigt Grund; Upload vorbelegt; keine Mail
//   F5  BEZAHLT     Chefbüro und Portal aus derselben Quelle (payment_status = paid, Datum COALESCE(paid_at, completed_at))
//   F6  ZÄHLUNG     Aufgabe zum Upload zählt mit derselben Liste wie das Portal (Begleitvertrag: nur Reisepass)
//   E-451 (28.10.2026) A Zahl am Menüpunkt · B Weg des Kunden · C Begleit Zahlung/Start · D Akte ↔ Angebot · E Zuständigkeit
//
//   env -i PATH="$PATH" HOME="$HOME" TZ=Europe/Berlin node_modules/.bin/tsx scripts/pruef-chef-global-sync.ts   (Exit 1 bei ROT)
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from "node:fs";
import path from "node:path";

for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY"]) if (process.env[k]) { console.error(`ABBRUCH: ${k} ist gesetzt.`); process.exit(3); }
process.env.DATABASE_URL = "postgres://pruefstand:ohne@127.0.0.1:1/keine-datenbank";
const netz: string[] = [];
globalThis.fetch = (async (input: any) => { netz.push(String(input?.url ?? input)); throw new Error("Prüfstand: kein Netz"); }) as typeof fetch;

const B = await import("../shared/fiaon-global-bereich");
const { globalChefMandatPfad, globalOfficeAuftragPfad } = await import("../shared/fiaon-global-wege");
const { wandPruefen, wandUrteil } = await import("../shared/fiaon-wortverbote");

const WURZEL = path.resolve(import.meta.dirname ?? ".", "..");
const datei = (p: string) => readFileSync(path.join(WURZEL, p), "utf8");
let gut = 0; const rot: string[] = [];
function ok(bed: boolean, text: string, fund = ""): void { if (bed) { gut++; return; } rot.push(text); console.log(`  ROT   ${text}${fund ? `  →  ${fund}` : ""}`); }
const gleich = (ist: unknown, soll: unknown, text: string) => ok(JSON.stringify(ist) === JSON.stringify(soll), text, `ist ${JSON.stringify(ist)}, soll ${JSON.stringify(soll)}`);
const abschnitt = (t: string) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 70 - t.length))}`);
/** Der Körper einer Funktion im Quelltext — vom Kopf bis zur nächsten Funktion/Route auf oberster Ebene. */
function koerper(src: string, kopf: string): string {
  const i = src.indexOf(kopf);
  if (i < 0) return "";
  const rest = src.slice(i + kopf.length);
  const ende = rest.search(/\n(export |async function |function |router\.|const [A-Z_]+ =|\/\/ ── )/);
  return kopf + (ende < 0 ? rest : rest.slice(0, ende));
}

const teile = datei("client/src/components/admin/chef-teile.tsx");
const chef = datei("client/src/components/admin/ChefGlobal.tsx");
const portal = datei("client/src/pages/global-portal.tsx");
const mandat = datei("server/lib/fiaon-global-mandat.ts");
const bereich = datei("server/lib/fiaon-global-bereich.ts");
const routen = datei("server/routes/fiaon-chef-global.ts");
const unterschrift = datei("server/lib/fiaon-global-unterschrift.ts");
const akteKomplett = datei("server/lib/fiaon-global-akte-komplett.ts");
const auftrag = datei("server/lib/fiaon-global-auftrag.ts");
const rundgaenge = datei("client/src/pages/agent/rundgaenge.ts");
const css = datei("client/src/styles/chef-global-raum.css");

// ═══ F1 NACHLADEN ═════════════════════════════════════════════════════════════
abschnitt("F1 Nachladen");
ok(/export function useDaten<T>\(pfad: string \| null, abhaengig: unknown\[\] = \[\], takt\?: number\)/.test(teile), "useDaten: dritter Parameter `takt` ist freiwillig (andere Aufrufer unverändert)");
const leise = koerper(teile, "const leise = () => {");
ok(leise.length > 0, "useDaten hat einen leisen Lauf");
ok(!/setLaedt|setFehler\((?!null\))/.test(leise), "der leise Lauf setzt weder „lädt …“ noch einen Fehler (nach Erfolg räumt er einen alten weg)", leise.slice(0, 200));
ok(/document\.visibilityState !== "visible"/.test(leise), "leise nur bei sichtbarem Tab");
ok(/catch\(\(\) => \{ \/\* leise/.test(leise), "Fehlschlag im Hintergrund: alte Daten bleiben stehen");
ok(/pfadJetzt\.current === p/.test(leise), "eine Antwort für ein anderes Mandat wird verworfen");
ok(/window\.setInterval\(leise, takt\)/.test(teile) && /addEventListener\("visibilitychange", leise\)/.test(teile), "Takt + Zurückkehren in den Tab (Muster business-auftrag.tsx)");
ok(/removeEventListener\("visibilitychange", leise\)/.test(teile) && /clearInterval\(uhr\)/.test(teile), "Uhr und Lauscher werden beim Verlassen abgebaut");
ok(/if \(!takt \|\| pfad === null\) return;/.test(teile), "ohne takt: kein Nachladen (bisherige Räume unverändert)");
ok(/const NACHLADEN_MS = 60_000;/.test(chef), "Global-Raum: Takt 60 s wie das Portal");
ok(/useDaten<Liste & \{ ok: true \}>\("\/chef\/global\/mandate", \[\], NACHLADEN_MS\)/.test(chef), "Liste (Kacheln, Zähler) lädt nach");
ok(/\/chef\/global\/mandate\/\$\{encodeURIComponent\(gref\)\}`, \[\], NACHLADEN_MS\)/.test(chef), "die geöffnete Akte lädt nach");
ok((chef.match(/NACHLADEN_MS\)/g) ?? []).length >= 4, "auch „Akte komplett“ und „Leistungen“ laden nach");
const aufrufeMitTakt = ["client/src/components/admin/ChefGlobalAuftraege.tsx", "client/src/components/admin/ChefGlobalZugaenge.tsx"]
  .map((p) => { try { return datei(p); } catch { return ""; } }).filter((x) => /useDaten<[^>]*>\([^)]*,[^)]*,\s*\d/.test(x));
ok(aufrufeMitTakt.length === 0, "andere Chef-Räume rufen useDaten weiter ohne Takt");
// Offene Eingaben: Formulare des Überblicks sind eigener State, kein Effekt setzt sie aus den geladenen Daten zurück.
ok(/useState\(m\.naechsterSchritt\?\.text \?\? ""\)/.test(chef) && !/setSchritt\(m\./.test(chef) && !/setStichtag\(m\./.test(chef), "„Nächster Schritt“/Stichtag: kein Neu-Setzen aus nachgeladenen Daten");
ok(!/useEffect\(\(\) => \{[^}]*set(Hinweis|Form|Text|Notiz|Grund)\(m\./.test(chef), "kein Effekt überschreibt Eingaben aus `m`");
ok(/const \[grund, setGrund\] = useState<string \| null>\(null\)/.test(chef) && /<DokumentZeile key=\{d\.id\}/.test(chef), "„Bitte neu“-Eingabe: eigener State je Zeile (key = Dokument-id) — überlebt das Nachladen");
ok(/Neue Daten vom Server: übernehmen, solange niemand tippt/.test(datei("client/src/components/global/GlobalStationen.tsx")), "Stationen-Editor schützt laufende Eingaben (bestehend)");
ok(/<MandatAkte key=\{gewaehlt\}/.test(chef) && /className="cgr-reiter-inhalt" key=\{reiter\}/.test(chef), "Nachladen remountet weder Akte noch Reiter (key nur Mandat/Reiter)");

// ═══ F2 NEU-MARKE ═════════════════════════════════════════════════════════════
abschnitt("F2 Neu-Marke");
const chefSicht = koerper(mandat, "export async function globalMandatChefSicht(");
ok(chefSicht.length > 0 && !/UPDATE fiaon_global_dokumente/.test(chefSicht) && !/UPDATE /.test(chefSicht), "GET der Chef-Akte schreibt nichts mehr");
ok(/neu: d\.von === "kunde" && !!z && !z\.fiaon_gesehen_am/.test(chefSicht), "jedes Kunden-Dokument liefert `neu` (fiaon_gesehen_am leer) — nur in der Chef-Sicht");
ok(!/neu:/.test(koerper(mandat, "function dokumentZusatz(")), "dokumentZusatz (auch Kunde) bekommt kein `neu`");
ok(/SELECT id, von, art, titel, kunde_gelesen_am, fiaon_gesehen_am/.test(mandat), "dokumentZusatzLesen liest `von` und fiaon_gesehen_am");
const getDok = koerper(routen, 'router.get("/chef/global/mandate/:ref/dokument/:id"');
ok(/globalChefGesehen\(ref\(req\), \[Number\(req\.params\.id\)\]/.test(getDok), "Öffnen/Herunterladen im Chefbüro (bestehende Dokument-Route) = gesehen");
ok(getDok.indexOf("res.end(d.inhalt)") < getDok.indexOf("globalChefGesehen"), "gesehen erst NACH dem Ausliefern, ohne es aufzuhalten");
const postGesehen = koerper(routen, 'router.post("/chef/global/mandate/:ref/gesehen"');
ok(/requireChef\("leitung"\)/.test(postGesehen) && /globalChefGesehen\(ref\(req\), "alle"/.test(postGesehen), "POST …/gesehen „Alle als gesehen markieren“ (requireChef leitung wie die Nachbarn)");
const gesehen = koerper(mandat, "export async function globalChefGesehen(");
ok(/von = 'kunde' AND fiaon_gesehen_am IS NULL/.test(gesehen) && /globalKundenAufgabenErledigen\(ref, wer\)/.test(gesehen), "globalChefGesehen: nur Kunden-Uploads, danach Aufgaben erledigen");
ok(/d\.von = 'kunde' AND d\.fiaon_gesehen_am IS NULL AND d\.geloescht_am IS NULL\) AS uploads_neu/.test(mandat), "Kachel „Neue Uploads“ und Zähler der Liste: dieselbe Bedingung wie `neu`");
ok(/\{d\.neu && <em className="blau">Neu<\/em>\}/.test(chef), "Dokumentzeile: dezente Marke „Neu“");
ok(/Alle als gesehen markieren/.test(chef) && /tun\("\/gesehen", "POST"\)/.test(chef), "Tresor: Knopf „Alle als gesehen markieren“");
ok(/onClick=\{\(\) => geoeffnet\?\.\(d\)\}/.test(chef) && /leise\(\); onGeaendert\(\);/.test(chef), "Datei geöffnet → Akte und Liste laden leise nach (Marke/Kachel sofort richtig)");
ok(/\.cgr-dok-marken em\.blau/.test(css), "Stil für die Marke „Neu“");

// ═══ F3 AUFGABEN ══════════════════════════════════════════════════════════════
abschnitt("F3 Aufgaben");
gleich(globalChefMandatPfad("FIAON-AB12CD34-EF56"), "/chef/global?mandat=FIAON-AB12CD34-EF56", "globalChefMandatPfad: Chef-Akte");
gleich(globalChefMandatPfad("A B&C"), "/chef/global?mandat=A%20B%26C", "globalChefMandatPfad kodiert");
gleich(globalOfficeAuftragPfad("X-1"), "/agent/global/X-1", "Office-Pfad bleibt für Office-Wege");
const eingang = koerper(bereich, "export async function eingangMelden(");
ok(/link: globalChefMandatPfad\(l\.ref\)/.test(eingang) && !/globalOfficeAuftragPfad/.test(eingang), "Kunden-Upload: Aufgabe verlinkt die Chef-Akte");
const nachricht = koerper(bereich, "export async function globalKundenNachricht(");
ok(/link: globalChefMandatPfad\(ref\)/.test(nachricht) && !/globalOfficeAuftragPfad/.test(nachricht), "Kunden-Nachricht: Aufgabe verlinkt die Chef-Akte");
ok(/link: globalChefMandatPfad\(ref\)/.test(unterschrift) && /link: globalChefMandatPfad\(ref\)/.test(akteKomplett), "digitale Unterschrift und unterschriebener Scan: derselbe Helfer");
for (const [n, src] of [["bereich", bereich], ["mandat", mandat], ["unterschrift", unterschrift], ["akte-komplett", akteKomplett]] as const) ok(!src.includes("`/chef/global?mandat="), `${n}: kein selbst gebauter Chef-Link mehr`);
// Die Schlüssel, wie sie angelegt werden — und wie die Erledigung sie zerlegt (split_part 1-basiert = split 0-basiert + 1).
ok(/schluessel: `global:\$\{l\.ref\}:eingang:\$\{berlinToday\(\)\}`/.test(eingang), "Schlüssel Upload: global:<ref>:eingang:<Berliner Tag>");
ok(/schluessel: `global:\$\{ref\}:nachricht:\$\{berlinToday\(\)\}`/.test(nachricht), "Schlüssel Nachricht: global:<ref>:nachricht:<Tag>");
ok(/schluessel: `global:\$\{ref\}:signatur:\$\{d\.id\}:\$\{nachweis\.nr\}`/.test(unterschrift), "Schlüssel Unterschrift: global:<ref>:signatur:<Original>:<Nr>");
ok(/schluessel: `global:\$\{ref\}:scan:\$\{id\}`/.test(akteKomplett), "Schlüssel Scan: global:<ref>:scan:<Original>");
const REF = "FIAON-AB12CD34-EF56";
gleich(`global:${REF}:eingang:2026-10-28`.split(":")[3], "2026-10-28", "split_part(…, 4) liefert beim Upload den Tag (Referenz ohne Doppelpunkt)");
gleich(`global:${REF}:signatur:10:1`.split(":").slice(2, 4), ["signatur", "10"], "split_part 3/4 bei der Unterschrift: Art und Original");
gleich(`global:${REF}:scan:7`.split(":").slice(2, 4), ["scan", "7"], "split_part 3/4 beim Scan: Art und Original");
ok(!REF.includes(":"), "Referenzen enthalten keinen Doppelpunkt");
const erledigen = koerper(mandat, "export async function globalKundenAufgabenErledigen(");
ok(/LIKE \$\{`global:\$\{ref\}:eingang:%`\}/.test(erledigen) && /split_part\(t\.schluessel, ':', 4\)/.test(erledigen) && /AT TIME ZONE 'Europe\/Berlin'/.test(erledigen), "Upload-Aufgabe: erledigt, sobald von diesem Berliner Tag nichts Ungesehenes mehr liegt");
ok(/LIKE \$\{`global:\$\{ref\}:signatur:%`\}/.test(erledigen) && /LIKE \$\{`global:\$\{ref\}:scan:%`\}/.test(erledigen) && /d\.unterschrift_von_id::text/.test(erledigen), "Unterschrift/Scan: erledigt, sobald die unterschriebene Fassung gesehen ist");
ok(/'irs_ss4'/.test(erledigen) && /= 'scan'/.test(erledigen), "SS-4-Scan bleibt offen (echter Handgriff: zurück an den Registered Agent)");
ok(/status = 'erledigt', erledigt_am = COALESCE\(t\.erledigt_am, NOW\(\)\)/.test(erledigen) && /AND t\.status <> 'erledigt'/.test(erledigen), "Muster der Erledigung wie bei der Anfragen-Antwort");
ok((erledigen.match(/\.catch\(/g) ?? []).length >= 2, "Erledigen hält keinen Weg auf (Fehler nur ins Log)");
const gelesen = koerper(mandat, "export async function globalMandatAnfragenGelesen(");
ok(/LIKE \$\{`global:\$\{ref\}:nachricht:%`\}/.test(gelesen) && /status = 'erledigt'/.test(gelesen), "Nachricht im Chefbüro gelesen → Nachrichten-Aufgabe erledigt");
ok(/LIKE \$\{`global:\$\{ref\}:nachricht:%`\}/.test(koerper(mandat, "export async function globalMandatAntwort(")), "beantwortet → erledigt (bestehend)");
ok(/anfragen-gelesen`, "POST"\)\.then\(\(\) => \{ neu\(\); onGeaendert\(\); \}\)/.test(chef), "nach „gelesen“ lädt auch die Akte neu (Zahl am Reiter stimmt)");

// ═══ F4 BITTE NEU / ART ═══════════════════════════════════════════════════════
abschnitt("F4 Bitte neu, Art ändern");
const A = (art: string, am: string, abgelehntAm?: string, grund?: string, id = 1) => ({ id, art, am, abgelehntAm: abgelehntAm ?? null, abgelehntGrund: grund ?? null });
const GRUND = "Foto statt Scan — bitte als PDF-Scan.";
let ab = B.globalOffeneAblehnungen([A("reisepass", "2026-10-23T13:00:00.000Z", "2026-10-28T09:00:00.000Z", GRUND)]);
gleich(ab.map((x) => [x.art, x.grund]), [["reisepass", GRUND]], "abgelehnter Pass: Ablehnung offen");
ab = B.globalOffeneAblehnungen([A("reisepass", "2026-10-23T13:00:00.000Z", "2026-10-28T09:00:00.000Z", GRUND), A("reisepass", "2026-10-28T10:00:00.000Z", undefined, undefined, 2)]);
gleich(ab.length, 0, "neuer Upload derselben Art NACH der Ablehnung löst sie");
ab = B.globalOffeneAblehnungen([A("reisepass", "2026-10-20T10:00:00.000Z", undefined, undefined, 2), A("reisepass", "2026-10-23T13:00:00.000Z", "2026-10-28T09:00:00.000Z", GRUND)]);
gleich(ab.length, 1, "ein ÄLTERER Pass löst die Ablehnung nicht");
ab = B.globalOffeneAblehnungen([A("registerauszug", "2026-10-23T13:00:00.000Z", "2026-10-28T09:00:00.000Z", GRUND), A("gesellschafterliste", "2026-10-28T11:00:00.000Z", undefined, undefined, 2)]);
gleich(ab.length, 0, "Gesellschafterliste nach abgelehntem Registerauszug löst (dieselbe Unterlage)");
ab = B.globalOffeneAblehnungen([A("sonstiges", "2026-10-23T13:00:00.000Z", "2026-10-28T09:00:00.000Z", "Bitte die Seite vollständig."), A("reisepass", "2026-10-28T11:00:00.000Z", undefined, undefined, 2)]);
gleich(ab.length, 1, "ein Upload anderer Art löst nichts");

// Begleitvertrag (nur Reisepass): der einzige Pass ist abgelehnt → fehlt, mit Grund — Portal zeigt ihn unter „Für Sie zu tun“.
const doks = [A("sonstiges", "2026-10-23T13:00:00.000Z"), A("reisepass", "2026-10-23T14:00:00.000Z", "2026-10-28T09:00:00.000Z", GRUND, 5)];
const offen = B.globalOffeneAblehnungen(doks);
const stand = B.globalUnterlagenStand(doks.filter((d) => !d.abgelehntAm).map((d) => d.art), "de", false, true, offen);
gleich(stand.map((u) => [u.art, u.vorhanden, u.abgelehnt?.grund ?? null]), [["reisepass", false, GRUND]], "abgelehnter Pass zählt NICHT als vorhanden — mit Grund");
gleich(B.globalNachreichen(offen, stand, "de"), [], "kein Doppel: der Pass steht schon als fehlende Unterlage");
const standOhne = B.globalUnterlagenStand(["reisepass"], "de", false, true, offen);
gleich(standOhne[0].vorhanden, true, "ist ein gültiger Pass da, zählt er (Ablehnung bleibt als „bitte neu“)");
gleich(B.globalNachreichen(offen, standOhne, "de").map((x) => [x.art, x.titel, x.grund]), [["reisepass", "Reisepass", GRUND]], "… und steht dann als „bitte neu einreichen“");
const sonst = B.globalOffeneAblehnungen([A("sonstiges", "2026-10-27T16:20:00.000Z", "2026-10-28T09:00:00.000Z", "Bitte die unterschriebene Seite 2 mitschicken.")]);
gleich(B.globalNachreichen(sonst, B.globalUnterlagenStand(["reisepass"], "en", false, true, sonst), "en").map((x) => x.titel), ["Other document"], "abgelehntes „Sonstiges“ erscheint im Portal (englisch übersetzt)");
gleich(B.globalUnterlagenStand(["reisepass"], "de").filter((u) => !u.vorhanden).length, 4, "ohne Ablehnungen: unveränderte Unterlagenliste (Aufrufer ohne 5. Parameter)");
// Kundentext: gesiezt, kurz, durch die Wand.
const satzDe = B.GLOBAL_VERLAUF_TEXT.de.dokumentNeu("Reisepass", GRUND);
const satzEn = B.GLOBAL_VERLAUF_TEXT.en.dokumentNeu("Passport", "Photo instead of a scan — please upload a PDF scan.");
ok(/Bitte reichen Sie „Reisepass“ neu ein: Foto statt Scan/.test(satzDe) && satzDe.length < 200, "Verlauf (de): gesiezt, mit Grund, kurz", satzDe);
ok(/^Please submit “Passport” again: /.test(satzEn), "Verlauf (en)", satzEn);
for (const x of [satzDe, satzEn]) ok(wandUrteil(wandPruefen(x)).sendbar, `Wand lässt den Satz durch: ${x.slice(0, 40)} …`);
ok(B.GLOBAL_ABLEHNUNG_GRUND_MIN >= 5 && B.GLOBAL_ABLEHNUNG_GRUND_MAX <= 400, "Grund: Pflicht, kurz (Grenzen)");
// Schema und Zählung
ok(/ADD COLUMN IF NOT EXISTS abgelehnt_am TIMESTAMPTZ/.test(bereich) && /ADD COLUMN IF NOT EXISTS abgelehnt_grund TEXT/.test(bereich) && /SET LOCAL lock_timeout = '3s'/.test(koerper(bereich, "export function ensureGlobalBereich(")), "Spalten zur Laufzeit (IF NOT EXISTS, lock_timeout) in ensureGlobalBereich");
ok((bereich.match(/abgelehnt_am IS NULL/g) ?? []).length >= 3, "abgelehnte Dokumente zählen nirgends (Upload-Aufgabe, Office-Liste, Tageslauf)");
ok(/dokumente\.filter\(\(d\) => !d\.abgelehnt_am\)/.test(bereich) && /globalOffeneAblehnungen\(/.test(bereich) && /globalNachreichen\(/.test(bereich), "Sicht (Portal/Office/Chef): Unterlagen ohne abgelehnte, mit Grund und „nachreichen“");
ok(/abgelehnt: \{ am: iso\(d\.abgelehnt_am\), grund:/.test(bereich), "jedes Dokument trägt seine Ablehnung (Portal-Tresor zeigt „Bitte neu einreichen“)");
// Ändern im Chefbüro
const aendern = koerper(mandat, "export async function globalMandatDokumentAendern(");
ok(/ein\.ablehnen/.test(aendern) && /GLOBAL_ABLEHNUNG_GRUND_MIN/.test(aendern) && /kundensatz\(grund\)/.test(aendern), "ablehnen: Pflicht-Grund, durch die Wand");
ok(/d\.von !== "kunde"/.test(aendern) && /unterschrift_von_id/.test(aendern), "nur Kunden-Uploads, nie eine unterschriebene Fassung");
ok(/artNeu\.art === "post"/.test(aendern) && /globalDokumentArt\(ein\.art\)/.test(aendern), "Art: nur gültige Dokumentarten (ohne Post)");
ok(/art: "dokument_neu".*sichtbar: true/.test(aendern), "Verlaufszeile für den Kunden beim Ablehnen");
ok(!/bereichMail|globalMailSenden|mailRendern/.test(aendern), "KEINE automatische Mail an den Kunden");
ok(/fiaon_gesehen_am = CASE WHEN \$\{sieht\}/.test(aendern) && /globalKundenAufgabenErledigen/.test(aendern), "Ablehnen/Art ändern = gesehen (Aufgabe erledigt sich)");
ok(/ablehnungZurueck/.test(aendern) && /ablehnungZurueck: true/.test(chef), "„bitte neu“ lässt sich zurücknehmen");
ok(/data-fiaon="chef-dok-ablehnen"/.test(chef) && /\{ ablehnen: grund\.trim\(\) \}/.test(chef) && /\{ art: e\.target\.value \}/.test(chef), "Chefbüro: „Bitte neu …“ mit Grund und Art-Auswahl je Kunden-Upload");
ok(/const kundeFrei = d\.von === "kunde" && !d\.unterschriebeneFassungVon/.test(chef), "Knöpfe nur bei Kunden-Uploads ohne Unterschrifts-Nachweis");
ok(/fehlendeUnterlagen\.length === 0 && nachreichen\.length === 0/.test(chef), "„Nichts offen.“ nur, wenn auch keine Unterlage fehlt");
// Portal
ok(/const nachreichen: T\[\] = darfHochladen \? \(a\.nachreichen \?\? \[\]\) : \[\]/.test(portal), "Portal liest „nachreichen“");
ok(/w\.neuTitel\(x\.titel\)/.test(portal) && /u\.abgelehnt\?\.grund \? `\$\{u\.titel\} — \$\{u\.abgelehnt\.grund\}`/.test(portal), "„Für Sie zu tun“: fehlende Unterlage mit Grund + „Bitte neu einreichen“");
ok(/const artVorschlag = \[fehlend\.find\(\(u: T\) => u\.abgelehnt\)\?\.art, nachreichen\[0\]\?\.art, fehlend\[0\]\?\.art\]/.test(portal) && /if \(!artGewaehlt\) setArtRoh\(artVorschlag\)/.test(portal), "Upload: Art vorbelegt (abgelehnt → nachreichen → fehlend), bis der Kunde selbst wählt");
ok(/ton: "st-abgelehnt"/.test(portal), "Tresor im Portal: Marke „Bitte neu einreichen“");
ok(/neuTitel: \(x: string\) => `Bitte neu einreichen: \$\{x\}`/.test(portal) && /neuTitel: \(x: string\) => `Please submit again: \$\{x\}`/.test(portal), "Portal-Texte de/en (gesiezt)");

// ═══ F5 BEZAHLT ═══════════════════════════════════════════════════════════════
abschnitt("F5 Bezahlt");
ok(/zahlung: \{ status: bezahlt \? "bezahlt" : "offen"/.test(bereich) && /const bezahlt = String\(b\.payment_status\) === "paid"/.test(bereich), "Portal: bezahlt = payment_status paid (Quelle)");
ok(/bezahltAm: iso\(l\.akte\.bezahlt_am\) \?\? \(String\(l\.b\.payment_status\) === "paid" \? iso\(l\.b\.paid_at \?\? l\.b\.completed_at\) : null\)/.test(bereich), "Chef/Office: Bezahlt-Datum aus derselben Quelle, Tag wie die Umsatz-Quelle");
ok(/COALESCE\(a\.paid_at, a\.completed_at\)/.test(datei("server/lib/fiaon-umsatz-quelle.ts")), "Umsatz-Quelle nimmt denselben Tag");
ok(/claimed_paid_at, archived_at,[\s\S]{0,160}paid_at\n/.test(koerper(auftrag, "async function bestellungLesen(")), "bestellungLesen liest paid_at");
ok(/m\.bezahltAm \? datum\(m\.bezahltAm\) : m\.zahlung\?\.status === "bezahlt" \? "bezahlt" : "offen"/.test(chef), "Chefbüro zeigt „offen“ nur, wenn auch das Portal „offen“ zeigt");

// ═══ F6 ZÄHLUNG ═══════════════════════════════════════════════════════════════
abschnitt("F6 Zählung der Upload-Aufgabe");
ok(!/von 5/.test(eingang.split("\n").filter((z) => !z.trim().startsWith("//")).join("\n")), "eingangMelden: kein festes „von 5“ (Code, ohne Kommentare)");
ok(/globalUnterlagenStand\(arten\.map\(\(a\) => String\(a\.art\)\), "de", json<Record<string, any>>\(l\.akte\.firma, \{\}\)\.art === "privat", istAngebotsPaket\(l\.akte\.paket_key\)\)/.test(eingang), "eingangMelden: dieselben Parameter wie die Sicht (privat, Angebots-Paket)");
ok(/unterlagen = globalUnterlagenStand\(dokumente\.filter[^\n]*firma\.art === "privat", individuell, ablehnungen\)/.test(bereich), "Sicht: privat + individuell wie bisher");
const nurPass = B.globalUnterlagenStand(["reisepass"], "de", false, true);
gleich(B.globalUnterlagenEingangSatz(nurPass), "Damit liegt die verlangte Unterlage vor.", "Begleitvertrag mit Pass: „liegt vor“ (vorher: „4 von 5 fehlen“)");
gleich(B.globalUnterlagenEingangSatz(B.globalUnterlagenStand(["sonstiges"], "de", false, true)), "Es fehlt noch die verlangte Unterlage: Reisepass.", "Begleitvertrag ohne Pass: nennt den Pass");
gleich(B.globalUnterlagenEingangSatz(B.globalUnterlagenStand(["reisepass"], "de")), "Es fehlen noch 4 von 5 Unterlagen der Liste: Adressnachweis, Gesellschafterliste oder Handelsregisterauszug, Name der US-Gesellschaft, Beschreibung der Geschäftstätigkeit.", "Paket: 4 von 5 mit Namen");
gleich(B.globalUnterlagenEingangSatz(B.globalUnterlagenStand(["reisepass", "adressnachweis", "namenswunsch"], "de", true)), "Es fehlt noch 1 von 4 Unterlagen der Liste: Beschreibung der Geschäftstätigkeit.", "privat: 4 statt 5, Einzahl „fehlt“");
gleich(B.globalUnterlagenEingangSatz(B.globalUnterlagenStand(["reisepass", "adressnachweis", "registerauszug", "namenswunsch", "taetigkeitsbeschreibung"], "de")), "Damit liegen ALLE Unterlagen der Liste vor.", "alle da");
ok(/if \(offen === 0\) await aufgabeErledigen\(`global:\$\{l\.ref\}:unterlagen`/.test(eingang), "„alle da“ erledigt die Nachfass-Aufgabe — trifft jetzt auch beim Begleitvertrag ein");
ok(/offeneUnterlagen: globalUnterlagenStand\(artenJe\.get\(String\(r\.ref\)\) \?\? \[\], "de", firma\.art === "privat", istAngebotsPaket\(r\.paket_key\)\)/.test(bereich), "Office-Liste: dieselbe Zählung");

// ═══ RUNDGANG & HAUSREGELN ════════════════════════════════════════════════════
abschnitt("Rundgang & Hausregeln");
ok(/export const RUNDGANG_CHEF_GLOBAL: RundgangSchritt\[\]/.test(rundgaenge) && /chefGlobal: \{ titel: "Global-Mandate", schritte: RUNDGANG_CHEF_GLOBAL \}/.test(rundgaenge), "Rundgang des Raums Global-Mandate");
ok(/RUNDGAENGE\.chefGlobal\.schritte/.test(chef), "Raum zeigt seinen Rundgang");
const rg = koerper(rundgaenge, "export const RUNDGANG_CHEF_GLOBAL");
for (const w of ["jede Minute", "„Neu“", "Alle als gesehen markieren", "Bitte neu", "Eine Mail geht nicht raus", "SS-4"]) ok(rg.includes(w), `Rundgang erklärt: ${w}`);
ok(/„bitte neu“ markiert, steht sie hier wieder auf „fehlt noch“/.test(rundgaenge), "Office-Rundgang (Global-Akte) zieht mit");
const geaendert = [teile, chef, portal, mandat, bereich, routen, rundgaenge].join("\n");
ok(!/FIAON-MV[0-9A-Z]{6}/.test(geaendert), "keine echte Kunden-Referenz im Quelltext");
ok((geaendert.match(/E-443 \(28\.10\.2026\)/g) ?? []).length >= 10, "Stellen tragen „E-443 (28.10.2026)“");

// ═══ GUTACHTEN (Korrektheit, Kundensicht, Chef-Bedienung) ═════════════════════
abschnitt("Gutachten: Nachbesserungen");
// Kundensicht 2: maßgeblich ist der UPLOAD-Zeitpunkt des abgelehnten Dokuments, nicht der Zeitpunkt der Ablehnung.
{
  const foto = { id: 1, art: "reisepass", am: "2026-10-28T08:00:00.000Z", abgelehntAm: "2026-10-28T10:00:00.000Z", abgelehntGrund: "Foto statt Scan — bitte als PDF-Scan" };
  const scan = { id: 2, art: "reisepass", am: "2026-10-28T08:05:00.000Z" };
  const doks = [foto, scan];
  gleich(B.globalOffeneAblehnungen(doks).length, 0, "Foto 10:00, Scan 10:05, Foto um 12:00 abgelehnt → nichts offen (der Scan gilt)");
  const st = B.globalUnterlagenStand(["reisepass"], "de", false, true, B.globalOffeneAblehnungen(doks));
  gleich(B.globalNachreichen(B.globalOffeneAblehnungen(doks), st).length, 0, "… und kein „Bitte neu einreichen: Reisepass“ neben „vorhanden“");
  ok(!B.globalAblehnungOffen(foto, doks), "globalAblehnungOffen: ersetzt durch den jüngeren Scan");
  // Gewollt bleibt: ein älterer Pass gilt, der neuere wird abgelehnt → der Kunde soll neu einreichen.
  const alt = { id: 3, art: "reisepass", am: "2026-10-01T08:00:00.000Z" };
  const neuAbgelehnt = { id: 4, art: "reisepass", am: "2026-10-20T08:00:00.000Z", abgelehntAm: "2026-10-21T08:00:00.000Z", abgelehntGrund: "Abgelaufen — bitte den neuen Pass" };
  gleich(B.globalOffeneAblehnungen([alt, neuAbgelehnt]).map((x) => x.id), [4], "älterer Pass gilt, neuerer abgelehnt → bleibt offen");
  // Ablehnung, dann neuer Upload → erledigt.
  const nachher = { id: 5, art: "reisepass", am: "2026-10-22T08:00:00.000Z" };
  ok(!B.globalAblehnungOffen(neuAbgelehnt, [alt, neuAbgelehnt, nachher]), "neuer Upload nach der Ablehnung → erledigt");
  ok(B.globalAblehnungOffen(neuAbgelehnt, [alt, neuAbgelehnt]), "ohne neuen Upload → offen");
}
// Kundensicht 1 / Chef 1: der Kunde sieht „Bitte neu einreichen“ nur, solange die Ablehnung offen ist; das Chefbüro „ersetzt“.
ok(/const ablehnungOffen = new Set\(stand\.filter\(\(x\) => globalAblehnungOffen\(x, stand\)\)/.test(bereich), "Sicht: offene Ablehnungen je Dokument einmal gebildet");
ok(/d\.abgelehnt_am && \(fuer === "office" \|\| ablehnungOffen\.has\(Number\(d\.id\)\)\)/.test(bereich), "Kunde bekommt `abgelehnt` nur bei offener Ablehnung");
ok(/fuer === "office" && !ablehnungOffen\.has\(Number\(d\.id\)\) \? \{ erledigt: true \}/.test(bereich), "Office/Chef: erledigte Ablehnung trägt `erledigt`");
ok(/<em className="leise">ersetzt<\/em>/.test(chef) && /\.cgr-dok-grund\.ersetzt/.test(css), "Chefbüro: graue Marke „ersetzt“");
// Kundensicht 3: der Angebotsweg zählt einen abgelehnten Pass nicht als „erhalten und geprüft“.
for (const f of ["server/lib/fiaon-global-angebot-begleit.ts", "server/lib/fiaon-global-angebot-kapital.ts"]) {
  ok(/art = 'reisepass' AND geloescht_am IS NULL AND abgelehnt_am IS NULL/.test(datei(f)), `${f.split("/").pop()}: abgelehnter Pass zählt nicht`);
  ok(/m\.ensureGlobalBereich\(\)/.test(datei(f)), `${f.split("/").pop()}: Spalte vorher sichergestellt`);
}
// Korrektheit 3: genau die abgelehnte Datei noch einmal → klarer Satz statt „liegt im Tresor“.
{
  const k = koerper(bereich, "export async function globalKundenDokument(");
  ok(/if \(d\.doppelt\) \{[\s\S]{0,200}SELECT abgelehnt_am FROM fiaon_global_dokumente WHERE id = \$\{d\.id\} AND ref = \$\{ref\}/.test(k) && /nein\(409, t\(s, "Diese Datei hatten wir bereits als nicht geeignet markiert/.test(k), "gleiche abgelehnte Datei → 409 mit Kundentext");
  ok(wandUrteil(wandPruefen("Diese Datei hatten wir bereits als nicht geeignet markiert. Bitte laden Sie einen neuen Scan hoch.")).sendbar && wandUrteil(wandPruefen("We had already marked this file as unsuitable. Please upload a new scan.")).sendbar, "Kundentext besteht die Wortwand");
}
// Korrektheit 1 + 5 / Chef 3: gelöschte Teil-Fassungen zählen nicht; ein Scan vom Team gilt als gesehen.
{
  const e = koerper(mandat, "export async function globalKundenAufgabenErledigen(");
  ok(/d\.unterschrift_von_id IS NOT NULL AND d\.geloescht_am IS NULL/.test(e), "Unterschrifts-Erledigung: nur nicht gelöschte Fassungen");
  ok(/\(\(d\.von = 'kunde' AND d\.fiaon_gesehen_am IS NOT NULL\) OR d\.von = 'fiaon'\)/.test(e), "Scan/Fassung vom Team gilt als gesehen");
  ok(/irs_ss4/.test(e), "SS-4 bleibt offen");
  ok(/if \(!kunde\) \{[\s\S]{0,200}globalKundenAufgabenErledigen\(ref/.test(akteKomplett), "Team-Scan erledigt seine Aufgabe sofort");
}
// Korrektheit 4 / Kundensicht 5: Rücknahme schreibt die sichtbare Gegenzeile.
{
  const a = koerper(mandat, "export async function globalMandatDokumentAendern(");
  ok(/else if \(zurueck\) \{[\s\S]{0,400}art: "dokument_ok", text: GLOBAL_VERLAUF_TEXT\[sprache\]\.dokumentWiederOk\([\s\S]{0,120}sichtbar: true/.test(a), "Rücknahme: sichtbare Zeile „ist in Ordnung“");
  gleich(B.GLOBAL_VERLAUF_TEXT.de.dokumentWiederOk("Reisepass"), "„Reisepass“ ist in Ordnung — Sie müssen nichts neu einreichen.", "Gegenzeile de (gesiezt)");
  gleich(B.GLOBAL_VERLAUF_TEXT.en.dokumentWiederOk("Passport"), "“Passport” is in order — there is nothing you need to submit again.", "Gegenzeile en");
  for (const x of [B.GLOBAL_VERLAUF_TEXT.de.dokumentWiederOk("Reisepass"), B.GLOBAL_VERLAUF_TEXT.en.dokumentWiederOk("Passport")]) ok(wandUrteil(wandPruefen(x)).sendbar, `Wortwand: ${x}`);
  // Kundensicht 4: Art nur, wenn der Kunde sie selbst einreichen darf — am Server und in der Auswahl.
  ok(/if \(!globalKundeDarfArt\(artNeu\.art\)\) return nein\(400/.test(a), "Art ändern: nur Arten, die der Kunde einreicht (Server)");
  ok(/if \(!globalKundeDarfArt\(artNeu\?\.art \?\? d\.art\)\) return nein\(400/.test(a), "„bitte neu“ nur bei einer Art, die der Kunde einreicht (Server)");
  ok(/globalKundeDarfArt\(a\.art\) \|\| a\.art === d\.art/.test(chef), "Art ändern: Auswahl im Chefbüro ebenso");
  ok(B.GLOBAL_DOKUMENTARTEN.some((x: any) => x.von === "fiaon" && !B.globalKundeDarfArt(x.art)), "es gibt FIAON-Arten, die der Kunde nicht wählen darf (Probe)");
  // Chef 4: Doppelklick — Knopf gesperrt, und der Server schreibt keine zweite Kundenzeile.
  ok(/const schonSo = grund !== undefined && !!d\.abgelehnt_am && String\(d\.abgelehnt_grund \?\? ""\) === grund/.test(a), "Server: gleiche Ablehnung zweimal → keine zweite Zeile");
}
ok(/disabled=\{laeuft \|\| grund\.trim\(\)\.length < 8\}/.test(chef), "Chefbüro: „Als bitte neu markieren“ gesperrt, solange es läuft");
// Kundensicht 7: Sprache des Kunden beim Grund.
ok(/Der Kunde liest Englisch — den Grund bitte auf Englisch schreiben/.test(chef) && /sprache=\{m\.sprache\}/.test(chef), "Chefbüro: Hinweis bei englischem Kunden");
// Korrektheit 2 / Chef 5: veraltete leise Antwort überschreibt keinen frischen Stand.
{
  const lz = koerper(teile, "const leise = () => {");
  ok(/const stand = useRef\(0\)/.test(teile) && /stand\.current \+= 1/.test(teile), "useDaten: Stand-Zähler, jeder laute Lauf zählt hoch");
  ok(/const start = stand\.current/.test(lz) && /stand\.current === start/.test(lz), "leiser Lauf verwirft die Antwort nach einem lauten Lauf");
}
// Chef 2 + 7: „antworten“ unter „Jetzt zu tun“ und neue Nachrichten bei offenem Reiter gelten als gelesen — EINE Stelle.
ok(/if \(reiter !== "anfragen" \|\| anfragenUngelesen === 0 \|\| gelesenLaeuft\.current\) return;/.test(chef), "gelesen: Effekt auf Reiter „Anfragen“ (Reiter, „antworten“, Nachladen)");
ok((chef.match(/anfragen-gelesen/g) ?? []).length === 1, "gelesen wird nur an einer Stelle gesendet");
// Chef 6: „Zum Tresor“ wählt zuerst die abgelehnte Unterlage.
ok(/fehlend\.find\(\(u: T\) => u\.abgelehnt && erlaubt\(u\.art\)\) \?\? fehlend\.find\(\(u: T\) => erlaubt\(u\.art\)\)/.test(portal), "Portal: „Zum Tresor“ wählt die abgelehnte Unterlage vor");
// Kundensicht 8 / Chef 8: das bisherige Portal zeigt Grund und „Bitte neu einreichen“.
{
  const alt = datei("client/src/pages/business-auftrag.tsx");
  ok(/abgelehnt\?: \{ grund: string \}/.test(alt) && /nachreichen\?: \{ art: string; titel: string; grund: string \}\[\]/.test(alt), "bisheriges Portal: Typen");
  ok(/u\.abgelehnt\?\.grund \?/.test(alt) && /\(a\.nachreichen \?\? \[\]\)\.map/.test(alt), "bisheriges Portal: Grund und Nachreichen sichtbar");
}
for (const w of ["„ersetzt“", "nur Arten, die der Kunde selbst einreicht", "Englisch", "„antworten“ unter „Jetzt zu tun“", "Scan selbst hoch"]) ok(rg.includes(w), `Rundgang erklärt: ${w}`);

// ═══ E-451 (28.10.2026): AUSBAU — MENÜ-ZAHL, WEG DES KUNDEN, BEGLEIT-VERLAUF, AKTE ↔ ANGEBOT, ZUSTÄNDIGKEIT ═════════
// Die Datenbank-Wege prüft scripts/pruef-e451-lokal.ts gegen die lokale Kopie; hier Quelltext und reine Teile.
{
  const shell = datei("client/src/components/admin/ChefShell.tsx");
  const shellCss = datei("client/src/styles/chefbuero.css");
  const agentRoute = datei("server/routes/fiaon-agent.ts");
  const angebot = datei("server/lib/fiaon-global-angebot.ts");
  const startg = datei("server/lib/fiaon-global-angebot-startgespraech.ts");
  const zusatz = datei("server/lib/fiaon-global-zusatz.ts");
  const todo = datei("server/routes/fiaon-betreiber-todo.ts");
  const { BEGLEIT_PORTAL } = await import("../shared/fiaon-global-angebot-begleit");

  abschnitt("E-451 A Zahl am Menüpunkt");
  const nz = koerper(mandat, "export async function globalChefNeuZahl(");
  ok(nz.length > 0, "globalChefNeuZahl vorhanden");
  ok(!/\b(UPDATE|INSERT|DELETE)\b/.test(nz), "die Zahl liest nur (kein UPDATE/INSERT/DELETE)");
  ok(/d\.von = 'kunde' AND d\.fiaon_gesehen_am IS NULL AND d\.geloescht_am IS NULL/.test(nz) && /n\.von = 'kunde' AND n\.gelesen_fiaon_am IS NULL/.test(nz), "dieselben Bedingungen wie die Zahl am Mandat (Uploads/Fassungen ungesehen, Nachrichten ungelesen)");
  ok(/d\.von = 'kunde' AND d\.fiaon_gesehen_am IS NULL AND d\.geloescht_am IS NULL\) AS uploads_neu/.test(koerper(mandat, "export async function globalMandateListe(")), "… die Liste zählt genauso (gleiche Quelle)");
  ok(/g\.ist_test_am IS NULL/.test(nz) && /<> 'storniert'/.test(nz) && /archived_at IS NOT NULL/.test(nz), "ohne Test-Akten und Stornos (wie die Kennzahlen)");
  ok(/von = 'kunde'/.test(koerper(datei("server/lib/fiaon-global-unterschrift.ts"), "  const d = await dokumentSpeichern({ ref, von: kunde ? \"kunde\"")) || /dokumentSpeichern\(\{ ref, von: kunde \? "kunde" : "fiaon"/.test(unterschrift), "unterschriebene Fassung des Kunden ist ein Kunden-Dokument (zählt über dieselbe Bedingung)");
  ok(/router\.get\("\/chef\/global\/neu-zahl", requireChef\("leitung"\)/.test(routen), "Endpunkt GET /chef/global/neu-zahl mit requireChef(leitung)");
  ok(/fetch\("\/api\/fiaon\/chef\/global\/neu-zahl"/.test(shell) && /window\.setInterval\(holen, 60_000\)/.test(shell), "Menü fragt im Takt des Raums (60 s)");
  ok(/document\.visibilityState !== "visible"/.test(koerper(shell, "    const holen = () => {")) && /addEventListener\("visibilitychange", holen\)/.test(shell), "nur bei sichtbarem Tab, sofort beim Zurückkehren");
  ok(/addEventListener\("chef-global-geaendert", holen\)/.test(shell) && /dispatchEvent\(new Event\("chef-global-geaendert"\)\)/.test(chef), "Global-Raum meldet Änderungen → Zahl lädt sofort nach");
  ok(/removeEventListener\("chef-global-geaendert", holen\)/.test(shell) && /window\.clearInterval\(uhr\)/.test(shell), "Uhr und Lauscher werden abgebaut");
  ok(/r\.key === "global" && globalNeu > 0 && \(\s*<em className="cb-zahl"/.test(shell), "Zahl nur am Punkt „Global-Mandate“ und nur, wenn > 0");
  ok(/\.cb-punkt \.cb-zahl\{/.test(shellCss) && /\.cb\.cb-schmal \.cb-leiste \.cb-punkt \.cb-zahl\{position:absolute/.test(shellCss), "Pille im offenen und im eingeklappten Menü");

  abschnitt("E-451 B Der Weg des Kunden");
  ok(!/import \{[^}]*GLOBAL_ETAPPEN[^}]*\} from "@shared\/fiaon-global-bereich"/.test(chef) && !/GLOBAL_ETAPPEN\.map/.test(chef), "Chef-Akte rendert nicht mehr fest GLOBAL_ETAPPEN");
  ok(/\(m\.etappen as \{ nr: number; titel: string; text\?: string; stand: string \}\[\]\)\.map/.test(chef) && /<b>\{e\.titel\}<\/b>/.test(chef), "Chef-Akte rendert die Etappen der Server-Sicht (dieselbe wie das Portal)");
  ok(/begleit && sprache !== "en" && \(e\.nr === 1 \|\| e\.nr === 2 \|\| e\.nr === 3 \|\| e\.nr === 4\) \? BEGLEIT_PORTAL\.etappen\[e\.nr\]/.test(bereich), "Server-Sicht: Begleitvertrag → BEGLEIT_PORTAL.etappen (für Portal UND Chefbüro)");
  gleich([1, 2, 3, 4].map((n) => typeof (BEGLEIT_PORTAL.etappen as any)[n]?.titel), ["string", "string", "string", "string"], "BEGLEIT_PORTAL hat Titel für Etappe 1–4");

  abschnitt("E-451 C Begleit-Akte: Zahlung und Start");
  const zs = koerper(akteKomplett, "export async function begleitZahlungStartAbgleich(");
  ok(zs.length > 0, "begleitZahlungStartAbgleich vorhanden");
  ok(/g\.bezahlt_am IS NULL/.test(zs) && /g\.gestartet_am IS NULL/.test(zs), "nur leere Felder (nie überschreiben)");
  ok(/COALESCE\(b\.paid_at, b\.completed_at\)/.test(zs) && /b\.payment_status = 'paid'/.test(zs), "Zahlungstag aus derselben Quelle wie Chefbüro/Umsatz (paid_at, sonst completed_at)");
  ok((zs.match(/\(g\.bestaetigungen->>'begleitvertrag'\) = 'true'/g) ?? []).length === 2, "nur Begleit-Akten");
  ok(/gestartet_am = g\.created_at/.test(zs) && /g\.status IN \('gestartet', 'abgeschlossen'\)/.test(zs), "Start = Anlage der Akte, nur laufende/abgeschlossene");
  ok(!/bereichMail|globalMailSenden|mailSenden|verlaufSchreiben/.test(zs), "keine Mail, keine zweite Verlaufszeile (die Zeilen leitet verlaufBauen ab)");
  ok(/T\.zahlung/.test(koerper(bereich, "function verlaufBauen(")) && /l\.akte\.bezahlt_am && BEZAHLT\.includes\(l\.status\)/.test(bereich), "Verlauf leitet „Zahlung eingegangen.“ aus bezahlt_am ab (bestehend)");
  ok(/begleitZahlungStartAbgleich\(ref\)/.test(agentRoute), "beim Bestätigen einer Zahlung (onCustomerPaid) für genau diese Bestellung");
  ok(/begleitZahlungStartAbgleich\(\)/.test(koerper(akteKomplett, "export async function globalAkteAbgleich(")), "… und im halbstündlichen Abgleich (Bestand)");
  ok(/begleitZahlungStartAbgleich\(anker\)/.test(akteKomplett), "… und beim Anlegen der Begleit-Akte");
  ok(!/router\.get[\s\S]{0,400}begleitZahlungStartAbgleich/.test(routen), "kein GET schreibt (Chef-Routen rufen den Abgleich nicht)");

  abschnitt("E-451 D Akte ↔ Angebot");
  const vk = koerper(akteKomplett, "export async function begleitAngebotVerknuepfen(");
  ok(vk.length > 0, "begleitAngebotVerknuepfen vorhanden");
  ok(/a\.auftrag_ref IS NULL/.test(vk) && /a\.fassung LIKE 'IA-BEGLEIT-%'/.test(vk), "nur Begleit-Angebote ohne auftrag_ref");
  ok(/\(SELECT COUNT\(\*\) FROM fiaon_global_auftraege g2 WHERE g2\.angebot_id = a\.id\) = 1/.test(vk) && /NOT EXISTS \(SELECT 1 FROM fiaon_global_angebote x WHERE x\.auftrag_ref = g\.ref\)/.test(vk), "nur wenn eindeutig (eine Akte je Angebot, Akte nicht schon vergeben)");
  ok(/begleitAngebotVerknuepfen\(angebotId\)/.test(koerper(akteKomplett, "export async function globalBegleitAkteAnlegen(")), "Knopf „Global-Akte anlegen“ verknüpft (auch wiederholt)");
  ok(/begleitAngebotVerknuepfen\(\)/.test(koerper(akteKomplett, "export async function globalAkteAbgleich(")), "halbstündlicher Abgleich verknüpft den Bestand");
  ok(/if \(\/\^IA-\(BEGLEIT\|KOOP\)-\/\.test\(String\(z\.fassung \?\? ""\)\)\) return \{ status: "nicht_bereit"/.test(startg), "Startgespräch: Begleit/Koop → nicht_bereit (kein automatischer Termin)");
  ok(/AND fassung NOT LIKE 'IA-KAPITAL-%'\s*\n\s*-- E-451[^\n]*\n\s*AND fassung NOT LIKE 'IA-BEGLEIT-%'/.test(angebot), "Stundenlauf „Startgespräch nachholen“ schließt den Begleitvertrag aus");
  ok(/AND fassung NOT LIKE 'IA-BEGLEIT-%' AND fassung NOT LIKE 'IA-KOOP-%' LIMIT 20/.test(angebot), "Stundenlauf „Nachholen“ schloss ihn schon aus (bestehend)");
  ok(/if \(istBegleitFassung\(fa\?\.fassung\)\) return \{ ok: true, grund: "Begleitvertrag — keine automatische Bestätigungsmail"/.test(angebot), "Bestätigungsmail: Begleitvertrag → nichts (bestehend)");
  ok(/WHERE auftrag_ref = \$\{ref1\} LIMIT 1/.test(koerper(angebot, "export async function angebotSichtZurAkte(")) && /IA-BEGLEIT-/.test(koerper(angebot, "export async function angebotSichtZurAkte(")), "Portal/Chefbüro finden den Begleitvertrag über auftrag_ref (begleitSichtZurAkte)");

  abschnitt("E-451 E Zuständigkeit");
  const ziel = koerper(auftrag, "export async function globalAufgabenZiel(");
  ok(ziel.length > 0 && /a\.test \? \{ agentId: null, anBetreiber: true \} : \{ agentId: id \}/.test(ziel) && /\(await globalEinstellungen\(\)\)\.zustaendigAgentId/.test(ziel), "EINE Regel: Mitarbeiter → er, Leitung (Testkonto) → Board, leer/inaktiv/gesperrt → Vorgabe");
  const alt = /zustaendig_agent_id \? Number\([^)]*zustaendig_agent_id\) : null\) \?\? \(await globalEinstellungen\(\)\)\.zustaendigAgentId/;
  for (const [n, q] of [["bereich", bereich], ["unterschrift", unterschrift], ["akte-komplett", akteKomplett], ["zusatz", zusatz]] as const) {
    ok(!alt.test(q), `${n}: kein eigenes „zuständig ?? Vorgabe“ mehr`);
  }
  ok((bereich.match(/\.\.\.\(await globalAufgabenZiel\(l\.akte\.zustaendig_agent_id\)\)/g) ?? []).length === 2 && /const ziel = await globalAufgabenZiel\(g\.zustaendig_agent_id\)/.test(bereich) && /globalOfficeAuftragPfad\(ref\), \.\.\.ziel,/.test(bereich), "Upload, Nachricht und Tageslauf folgen der Akte");
  ok(/\.\.\.\(await globalAufgabenZiel\(l\?\.akte\?\.zustaendig_agent_id\)\)/.test(unterschrift) && /\.\.\.\(await globalAufgabenZiel\(l\.akte\.zustaendig_agent_id\)\)/.test(akteKomplett), "digitale Unterschrift und Scan folgen der Akte");
  ok((zusatz.match(/globalAufgabenZiel\(l\??\.akte\?\.zustaendig_agent_id\)/g) ?? []).length === 2, "Zusatzdienste folgen der Akte");
  ok(/router\.post\("\/chef\/global\/mandate\/:ref\/zustaendig", requireChef\("leitung"\)/.test(routen), "Route POST …/zustaendig (requireChef leitung)");
  ok(/zustaendigkeit: await zustaendigkeitSicht\(office\)/.test(mandat) && /portalNennt: office\.ansprechpartner\?\.name/.test(mandat), "Chef-Sicht: Zuständigkeit aus derselben Sicht wie das Portal (ansprechpartner)");
  const zs2 = koerper(mandat, "export async function globalMandatZustaendigSetzen(");
  ok(/zustaendig_art = 'agent'/.test(zs2) && /delegieren\(/.test(zs2) && /sichtbar: false/.test(zs2) && !/bereichMail|globalMailSenden/.test(zs2), "Setzen: offene Mitarbeiter-Aufgaben wandern, interne Verlaufszeile, keine Mail");
  ok(/^export async function delegieren\(/m.test(todo), "delegieren ist exportiert (eine Übergabe-Logik)");
  ok(/<Zustaendigkeit m=\{m\} tun=\{tun\} \/>/.test(chef) && /tun\("\/zustaendig", "POST", \{ agentId: Number\(wahl\) \}\)/.test(chef), "Chef-Akte: Block „Zuständig“ mit Festlegen");
  ok(/Zuständig: \{m\.zustaendig \? m\.zustaendig\.name : "nicht festgelegt"\}/.test(chef), "Kopf der Akte zeigt die Zuständigkeit immer (auch „nicht festgelegt“)");
  ok(/const \[wahl, setWahl\] = useState<string>\(z\.agentId \? String\(z\.agentId\) : ""\)/.test(chef) && !/setWahl\(m\./.test(chef), "Auswahl ist eigener State — das Nachladen überschreibt sie nicht");
  ok(/ANGEBOT_ANSPRECHPARTNER\.find\(\(p\) => p\.email === mail\)\?\.telefon/.test(bereich), "Portal: die gesetzte Person behält ihre Geschäftsnummer (Hausadresse)");
  for (const w of ["Zahl am Menüpunkt", "Zuständig: EINE Person", "Der Weg des Kunden"]) ok(rg.includes(w), `Rundgang erklärt: ${w}`);
}

ok(netz.length === 0, "kein Netzzugriff", netz.join(", "));
console.log(`\n${gut} ok, ${rot.length} rot.`);
if (rot.length) process.exitCode = 1;
