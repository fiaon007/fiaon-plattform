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
ok(!/setLaedt|setFehler/.test(leise), "der leise Lauf setzt weder „lädt …“ noch einen Fehler", leise.slice(0, 200));
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

ok(netz.length === 0, "kein Netzzugriff", netz.join(", "));
console.log(`\n${gut} ok, ${rot.length} rot.`);
if (rot.length) process.exitCode = 1;
