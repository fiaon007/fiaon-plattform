// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: DER ZUSTAND SAGT DIE WAHRHEIT, UND DIE NUMMER WIRD NICHT GERATEN
//
// ── DIE BEFUNDE (Videoauswertung des Anrufs bei Nikita, 19.08.2026) ────────
//   (a) Am Pegelbalken stand „sehr leise", der Balken war leer — und der Anruf
//       ging trotzdem raus.
//   (b) Direkt nach „Anrufen" stand „IM GESPRÄCH · 00:00" mit laufender Uhr,
//       obwohl es beim Kunden erst klingelte.
//   (d) Der Kundenname stand zweimal im Gesprächsfenster.
//
// Dazu der Fund aus der Nummernprüfung: Für Kunde Maurizio Pampanini (CH,
// Winkel) wurde dreimal +49797435749 gewählt — richtig wäre +41797435749.
//
// ── WAS HIER GEPRÜFT WIRD ─────────────────────────────────────────────────
//   1. Die Zustandsfolge aus SIMULIERTEN SDK-Ereignissen:
//      waehlt → klingelt → gespraech → ergebnis
//   2. ROT-PROBE: Die Uhr darf im Zustand „klingelt" NICHT laufen.
//   3. Die Nummer wird nicht geraten: national ohne Land → Ablehnung.
//   4. Der Bestandsfall Maurizio ergibt +41…, nicht +49…
//   5. Die Ziffern-Zerstörung bei nicht-zweistelligen Vorwahlen ist behoben.
//
// ── WARUM DAS OHNE BROWSER GEHT ───────────────────────────────────────────
// Die Zustandsfolge wird gegen eine NACHBILDUNG der Handler geprüft, die aus
// derselben Quelldatei gelesen wird. Der Browsertest
// (scripts/pruef-telefon-bild.ts) zeigt danach die Bilder — beides zusammen,
// nicht eines statt des anderen: Ein Quelltext-Test beweist keine Anzeige, und
// ein Bildtest kann keine SDK-Ereignisse erzeugen, die es im Prüflauf nicht gibt.
//
// NUR LESEND (die Nummernprüfung fragt den Bestand ab, schreibt nichts).
//
//   npx tsx scripts/pruef-telefon-zustand.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { readFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import { nummerNormalisieren, vorwahlFuerLand, wahlPruefen } from "../server/lib/fiaon-softphone";
import { nummerAusZeile } from "../server/lib/fiaon-telefon";

let bestanden = 0;
let fehlgeschlagen = 0;
const fehler: string[] = [];
const log = (s = "") => console.log(s);
function ok(name: string, bedingung: boolean, detail = ""): void {
  if (bedingung) { bestanden++; log(`  PASS  ${name}`); }
  else { fehlgeschlagen++; fehler.push(name); log(`  FAIL  ${name}${detail ? `  → ${detail}` : ""}`); }
}
function gleich(name: string, ist: unknown, soll: unknown): void {
  ok(name, String(ist) === String(soll), `ist „${ist}“, soll „${soll}“`);
}
function gruppe(t: string): void { log(`\n── ${t} ${"─".repeat(Math.max(0, 52 - t.length))}`); }

// ═══════════════════════════════════════════════════════════════════════════
// DIE NACHBILDUNG: EIN SOFTPHONE-ZUSTAND OHNE REACT
//
// Sie folgt genau den Handlern aus Softphone.tsx. Damit sie nicht auseinander
// laufen, prüft Gruppe 6 den Quelltext gegen diese Nachbildung — eine
// Nachbildung, die vom Original abweicht, prüft sich selbst und nichts sonst.
// ═══════════════════════════════════════════════════════════════════════════
type Zustand = "bereit" | "waehlt" | "klingelt" | "gespraech" | "ergebnis";

class Panel {
  zustand: Zustand = "bereit";
  sekunden = 0;
  /** Läuft die Uhr? Im echten Panel entscheidet das der Effekt an `zustand`. */
  get uhrLaeuft(): boolean { return this.zustand === "gespraech"; }
  verlauf: Zustand[] = [];

  private setze(z: Zustand): void {
    this.zustand = z;
    this.verlauf.push(z);
  }

  waehlen(): void { this.setze("waehlt"); }
  /** SDK: `call.on("ringing")` */
  ringing(): void { if (this.zustand !== "gespraech") this.setze("klingelt"); }
  /** SDK: `call.on("accept")` — der Mensch hebt ab. */
  accept(): void { this.sekunden = 0; this.setze("gespraech"); }
  /** SDK: `call.on("disconnect")` */
  disconnect(): void { this.setze("ergebnis"); }
  /** Eine Sekunde Wanduhr. */
  tick(): void { if (this.uhrLaeuft) this.sekunden += 1; }
}

async function main(): Promise<void> {
  log("\n══ Prüfstand: Telefon-Zustand und Nummernwahl ══");

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("1. Die Zustandsfolge aus SDK-Ereignissen");
  // ═════════════════════════════════════════════════════════════════════════
  const p = new Panel();
  gleich("Vorher: bereit", p.zustand, "bereit");
  p.waehlen();
  gleich("Nach dem Klick: waehlt", p.zustand, "waehlt");
  ok("… und die Uhr läuft NICHT", !p.uhrLaeuft);
  p.ringing();
  gleich("Nach „ringing“: klingelt", p.zustand, "klingelt");
  p.accept();
  gleich("Nach „accept“: gespraech", p.zustand, "gespraech");
  ok("… und JETZT läuft die Uhr", p.uhrLaeuft);
  p.disconnect();
  gleich("Nach „disconnect“: ergebnis", p.zustand, "ergebnis");
  gleich("Die ganze Folge", p.verlauf.join(" → "),
    "waehlt → klingelt → gespraech → ergebnis");

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("2. ROT-PROBE: Die Uhr darf im Klingeln nicht laufen");
  // ═════════════════════════════════════════════════════════════════════════
  // Genau der Befund aus dem Video: „IM GESPRÄCH · 00:00" mit laufender Uhr,
  // während es beim Kunden erst klingelte.
  const r = new Panel();
  r.waehlen();
  r.ringing();
  for (let i = 0; i < 12; i++) r.tick();
  gleich("Nach 12 Sekunden Klingeln stehen 0 Sekunden auf der Uhr", r.sekunden, 0);
  ok("Der Zustand ist weiter „klingelt“, nicht „gespraech“", r.zustand === "klingelt");
  r.accept();
  for (let i = 0; i < 3; i++) r.tick();
  gleich("Erst nach dem Abheben zählt sie — 3 Sekunden", r.sekunden, 3);

  // ── UND DIE UMGEKEHRTE RICHTUNG ──────────────────────────────────────────
  // Die Reihenfolge der SDK-Ereignisse ist nicht garantiert. Ein „ringing" NACH
  // einem „accept" darf die Uhr nicht wieder anhalten.
  const s = new Panel();
  s.waehlen(); s.accept();
  s.ringing();
  gleich("Ein spätes „ringing“ wirft nicht zurück", s.zustand, "gespraech");
  ok("… und die Uhr läuft weiter", s.uhrLaeuft);

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("3. Die Nummer wird NICHT geraten");
  // ═════════════════════════════════════════════════════════════════════════
  const ohneLand = await wahlPruefen("0797435749", sqlPool, null);
  ok("National ohne Land → abgelehnt", !ohneLand.erlaubt);
  ok("… mit einem Grund, der sagt, was zu tun ist",
    /Ländervorwahl|Vorwahl/i.test(String(ohneLand.grund)) && /Akte|ergänz/i.test(String(ohneLand.grund)),
    `grund: ${ohneLand.grund}`);

  const mitCH = await wahlPruefen("0797435749", sqlPool, "CH");
  ok("Mit Land CH → erlaubt", mitCH.erlaubt, `grund: ${mitCH.grund}`);
  gleich("… und die Nummer ist schweizerisch", mitCH.nummer, "+41797435749");

  const mitAT = await wahlPruefen("06649280033", sqlPool, "AT");
  gleich("Eine österreichische national → +43", mitAT.nummer, "+43664928003" + "3");

  // Eine internationale Eingabe braucht kein Land.
  const intl = await wahlPruefen("+436601234567", sqlPool, null);
  ok("International geschrieben braucht kein Land", intl.erlaubt, `grund: ${intl.grund}`);

  gleich("vorwahlFuerLand(CH)", vorwahlFuerLand("CH"), "+41");
  gleich("vorwahlFuerLand(AT)", vorwahlFuerLand("AT"), "+43");
  gleich("vorwahlFuerLand(leer)", vorwahlFuerLand(""), "null");

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("4. Der Bestandsfall aus dem Video");
  // ═════════════════════════════════════════════════════════════════════════
  const [maurizio] = (await sqlPool`
    SELECT id, primary_phone, country, city FROM fiaon_persons WHERE id = 11479
  `) as any[];
  if (!maurizio) {
    ok("Person 11479 (Maurizio Pampanini) gefunden", false, "nicht im Bestand");
  } else {
    gleich("Rohwert unverändert im Bestand", maurizio.primary_phone, "0797435749");
    gleich("Land in der Akte", maurizio.country, "CH");
    const w = nummerAusZeile(maurizio);
    gleich("Über die Kundenkarte: +41…", w.waehlbar, "+41797435749");
    const geprueft = await wahlPruefen(String(maurizio.primary_phone), sqlPool, maurizio.country);
    gleich("Über die Wähltastatur MIT Land: +41…", geprueft.nummer, "+41797435749");
    ok("Beide Wege stimmen jetzt überein", w.waehlbar === geprueft.nummer,
      `Karte ${w.waehlbar}, Tastatur ${geprueft.nummer}`);
    // Und der Beweis, dass es vorher anders war:
    gleich("Ohne Land geraten wäre es (der alte Weg)",
      nummerNormalisieren(String(maurizio.primary_phone), "+49"), "+49797435749");
    // Die drei Anrufe vom 19.08. stehen noch im Protokoll.
    const [alt] = (await sqlPool`
      SELECT COUNT(*)::int AS n FROM fiaon_calls WHERE nummer = '+49797435749'
    `) as any[];
    ok("Die falsch gewählten Anrufe stehen im Protokoll", Number(alt.n) >= 3,
      `${alt.n} Anrufe an +49797435749`);
  }

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("5. Keine Ziffer geht mehr verloren");
  // ═════════════════════════════════════════════════════════════════════════
  // Der alte Ausdruck /^(\+\d{2})0+/ nahm ZWEI Ziffern als Landesvorwahl an und
  // fraß bei längeren Vorwahlen eine Ziffer aus der Ortsnetzkennzahl.
  gleich("Ukraine +380… bleibt vollständig",
    nummerNormalisieren("+380677197080"), "+380677197080");
  gleich("USA +1 609… bleibt vollständig",
    nummerNormalisieren("+16096405036"), "+16096405036");
  // Und die Regel, die gewollt war, gilt weiter:
  gleich("+43 0660… → Amtskennzahl weg",
    nummerNormalisieren("+4306601503979"), "+436601503979");
  gleich("+49 0341… → Amtskennzahl weg",
    nummerNormalisieren("+49034127108328"), "+4934127108328");
  gleich("+41 079… bleibt (keine Amtskennzahl)",
    nummerNormalisieren("+41797435749"), "+41797435749");

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("6. Der Quelltext folgt derselben Regel wie die Nachbildung");
  // ═════════════════════════════════════════════════════════════════════════
  // Eine Nachbildung, die vom Original abweicht, prüft sich selbst und nichts
  // sonst. Deshalb wird hier gegen die echte Datei gemessen.
  const q = readFileSync("client/src/components/Softphone.tsx", "utf8");
  const ohneKommentar = q
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");

  ok("Der Zustand kennt „klingelt“", /"klingelt"/.test(ohneKommentar));
  ok("Es gibt einen „ringing“-Handler", /\.on\(\s*"ringing"/.test(ohneKommentar));
  ok("„accept“ setzt gespraech", /\.on\(\s*"accept".*setZustand\("gespraech"\)/s.test(ohneKommentar));
  // DIE ENTSCHEIDENDE PRÜFUNG: kein unbedingtes Weiterschieben mehr.
  //
  // ── DIESE PRÜFUNG WAR IM ERSTEN ENTWURF WIRKUNGSLOS ────────────────────
  // Sie lautete:
  //     ohneKommentar.slice(indexOf('c.on("warning-cleared"'), indexOf("} catch (err)"))
  //
  // `indexOf` ohne Startposition findet das ERSTE Vorkommen im ganzen Text — und
  // `} catch (err)` steht in dieser Datei mehrfach, das erste Mal WEIT VOR der
  // Handler-Kette. Das Ende lag damit vor dem Anfang, `slice` gab einen leeren
  // Text zurück, und die Prüfung war grün, weil sie nichts durchsucht hat.
  //
  // Aufgefallen ist es nur durch die Rot-Probe: Der Fehler aus dem Video wurde
  // absichtlich wieder eingebaut, und die Prüfung blieb grün (AGENTS.md: „Ein
  // Prüfstand muss rot werden können"). Jetzt sucht das Ende AB dem Anfang.
  const von = ohneKommentar.indexOf('c.on("warning-cleared"');
  ok("Die Handler-Kette ist im Quelltext gefunden", von > 0);
  const bis = ohneKommentar.indexOf("} catch (err)", von);
  ok("Und ihr Ende dahinter", bis > von, `von ${von}, bis ${bis}`);
  const nachHandlern = ohneKommentar.slice(von, bis > von ? bis : undefined);
  ok("Der geprüfte Abschnitt ist nicht leer", nachHandlern.length > 40,
    `${nachHandlern.length} Zeichen — eine leere Prüfung ist immer grün`);
  ok("Kein unbedingtes setZustand(\"gespraech\") nach den Handlern",
    !/setZustand\("gespraech"\)/.test(nachHandlern),
    "genau diese Zeile war der Fehler aus dem Video");
  // Die Uhr hängt am Zustand „gespraech".
  ok("Die Uhr läuft nur im Zustand gespraech",
    /if \(zustand === "gespraech"\)\s*\{\s*uhr\.current = setInterval/.test(ohneKommentar));
  ok("Die Anzeige zeigt die Dauer nur im Gespräch",
    /zustand === "gespraech" \? dauerText\(sekunden\) : "···"/.test(ohneKommentar));
  ok("Im Klingeln steht der Hinweis zum Freizeichen",
    /sprich nicht ins Freizeichen/.test(q));

  // ── DER KNOPF IST GESPERRT ──────────────────────────────────────────────
  // ── DIE PRÜFUNG WAR ZU ENG (aufgefallen am 31.08.2026) ──────────────────
  // Sie verlangte die Sperrbedingung ZEICHENGENAU. Als die Probenpflicht
  // dazukam (`|| probePflicht`), wurde sie rot — obwohl die Sperre nicht
  // schwächer, sondern stärker geworden war.
  //
  // Eine Prüfung, die bei jeder Erweiterung rot wird, wird beim zweiten Mal
  // angepasst, ohne sie zu lesen. Sie prüft jetzt, dass BEIDE Gründe im
  // `disabled` stehen — nicht, in welcher Reihenfolge und mit welchem Abstand.
  const knopf = ohneKommentar.slice(
    ohneKommentar.indexOf("void waehlen()"),
    ohneKommentar.indexOf("void waehlen()") + 700,
  );
  ok("Der Anrufknopf kennt die Stumm-Sperre",
    /disabled=\{[^}]*stummVerdacht/.test(knopf),
    knopf.replace(/\s+/g, " ").slice(0, 160));
  ok("… und die Pflicht zur Sprechprobe",
    /disabled=\{[^}]*probePflicht/.test(knopf),
    "ohne sie kann der erste Anruf ohne jeden Nachweis rausgehen");
  ok("… und nennt beide Gründe getrennt",
    /Mikrofon prüfen/.test(knopf) && /Erst Sprechprobe/.test(knopf),
    "ein Knopf, der den falschen Grund nennt, schickt jemanden auf die falsche Suche");
  ok("Die Sperre braucht Zeit UND Pegel (kein Fehlalarm beim Öffnen)",
    /stummVerdacht\s*=[\s\S]{0,240}pegel != null[\s\S]{0,120}stilleSek >= SPERRE_NACH_SEKUNDEN/
      .test(ohneKommentar));

  // ── DAS SDK BEKOMMT DAS GERÄT ───────────────────────────────────────────
  ok("Das gewählte Gerät geht an das SDK (setInputDevice)",
    /setInputDevice\(/.test(ohneKommentar),
    "ohne diesen Aufruf nimmt Twilio immer das Standardgerät");
  ok("Auch getUserMedia benutzt das gewählte Gerät",
    !/getUserMedia\(\{\s*audio:\s*true\s*\}\)/.test(ohneKommentar),
    "irgendwo steht noch `{ audio: true }` — das ist der Standard, nicht die Wahl");
  ok("Es gibt eine Gerätewahl in der Oberfläche",
    /eingabegeraeteHolen/.test(ohneKommentar) && /Eingabegerät/.test(q));
  ok("Es gibt eine Sprechprobe", /sprechprobe/.test(ohneKommentar) && /MediaRecorder/.test(ohneKommentar));

  // ── DER NAME STEHT EINMAL ───────────────────────────────────────────────
  ok("Der Name im Kopf ist im Gespräch ausgeblendet",
    /zustand !== "waehlt" && zustand !== "klingelt" && zustand !== "gespraech"/
      .test(ohneKommentar),
    "sonst steht er neben dem großen Namen ein zweites Mal");
  ok("Die Ansichten sind nachzählbar markiert",
    /data-ansicht="gespraech"/.test(ohneKommentar) && /data-ansicht="ergebnis"/.test(ohneKommentar));

  log(`\n══ Ergebnis: ${bestanden} bestanden, ${fehlgeschlagen} fehlgeschlagen ══\n`);
  if (fehler.length > 0) {
    log("Fehlgeschlagen:");
    for (const f of fehler) log(`  · ${f}`);
    log("");
  }
  await sqlPool.end();
  process.exit(fehlgeschlagen > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
