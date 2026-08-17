// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: DIE ZWEIG-AMPEL UND DIE NACHSCHAU
//
// ── DER VORFALL (21.08.2026) ───────────────────────────────────────────────
// Der Betreiber setzte BREVO_API_KEY. Die Zweigprüfung scheiterte bei ALLEN 35
// Ereignissen identisch mit „Brevo hat mit HTTP 400 geantwortet" — während das
// Zustellprotokoll die Testmails als versandt zeigte und er sie EMPFING.
//
// Ursache: `ereignisseFuer()` schickte `endDate` auf MORGEN. Brevo lehnt ein
// Enddatum in der Zukunft mit 400 ab. Der Versand war gesund; die Nachschau
// war kaputt. Die Kachel meldete „35 ohne Zweig" — eine falsche Anschuldigung.
//
// ── WAS HIER BEWIESEN WIRD ─────────────────────────────────────────────────
//   1  Die Abfrage schickt kein Zukunftsdatum mehr (und `days` nicht zusammen
//      mit startDate/endDate — laut Brevo-Referenz unzulässig).
//   2  Ein 400 wird als „unsere Abfrage ist falsch" ausgewiesen, NICHT als
//      Brevo-Problem und NICHT als fehlender Zweig.
//   3  Drei getrennte Zustände, und „Prüfung gestört" zählt NICHT als
//      „ohne Zweig".
//   4  Eine gestörte Prüfung markiert KEINEN Zweig als fehlend (kein
//      verifikationSpeichern mit false).
//   5  Einzel- und Sammelprüfung benutzen DIESELBE Funktion.
//
// Die Zustände werden mit einer Attrappe geprüft: 400 → gestört, leere Liste →
// Zweig fehlt, Treffer → bestätigt. Ohne Attrappe bräuchte es einen echten
// Schlüssel und echte Mails.
//
//   npx tsx scripts/pruef-zweigampel.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { readFileSync } from "node:fs";

let ok = 0;
let rot = 0;
const fehler: string[] = [];
function pruef(name: string, bedingung: boolean, hinweis = ""): void {
  if (bedingung) { ok++; console.log(`  ok    ${name}`); }
  else { rot++; fehler.push(name); console.log(`  ROT   ${name}${hinweis ? `  → ${hinweis}` : ""}`); }
}
function titel(t: string): void { console.log(`\n${"─".repeat(72)}\n${t}\n${"─".repeat(72)}`); }
const lies = (p: string) => { try { return readFileSync(p, "utf8"); } catch { return ""; } };

/**
 * Quelltext OHNE Kommentare.
 *
 * ── WARUM DAS NÖTIG IST (21.08.2026) ──────────────────────────────────────
 * Die Prüfung „das Zukunftsdatum ist weg" wurde rot — obwohl es weg war. Sie
 * traf den KOMMENTAR, in dem der alte Code zitiert steht („Hier stand: …
 * endDate=${bis}").
 *
 * Wer die ABWESENHEIT von Code prüft, muss Kommentare ausschließen. Sonst ist
 * jede gute Dokumentation eines behobenen Fehlers ein neuer Fehlalarm — und
 * die naheliegende Reaktion wäre, die Begründung zu löschen. Genau falsch.
 */
function ohneKommentare(quelle: string): string {
  return quelle
    .split("\n")
    .filter((z) => !/^\s*(\/\/|\*|\/\*)/.test(z))
    .join("\n");
}

async function main(): Promise<void> {
  const brevo = lies("server/lib/fiaon-brevo.ts");
  const fehlerDatei = lies("server/lib/fiaon-brevo-fehler.ts");
  const zustellung = lies("server/lib/fiaon-zustellung.ts");
  const route = lies("server/routes/fiaon-mail.ts");

  // ═════════════════════════════════════════════════════════════════════════
  titel("1. DIE ABFRAGE — kein Zukunftsdatum mehr");
  // ═════════════════════════════════════════════════════════════════════════
  // Ohne Kommentare geprüft: Der alte Code steht dort absichtlich zitiert.
  const brevoCode = ohneKommentare(brevo);
  // ── DIE RICHTUNG IST DER UNTERSCHIED, NICHT DIE ZAHL ─────────────────
  // Zweiter Fehlalarm: Ein Verbot von „86_400_000" traf die legitime
  // Umrechnung `(Date.now() - seit) / 86_400_000` — Millisekunden pro Tag.
  //
  // Der Fehler war nicht die Zahl, sondern das PLUS: `Date.now() + 86_400_000`
  // ergab morgen. Minus ergibt eine Dauer. Wer eine Zahl verbietet, verbietet
  // auch ihren richtigen Gebrauch.
  pruef("Das Zukunftsdatum ist weg",
    !/endDate=/.test(brevoCode) && !/Date\.now\(\)\s*\+\s*86_400_000/.test(brevoCode),
    "endDate lag einen Tag in der Zukunft (Date.now() PLUS ein Tag) — genau der 400-Grund");
  // Auch diese Prüfung liest den kommentarfreien Text: Sonst genügt es, „days"
  // in einen Kommentar zu schreiben, damit sie grün wird. In der Rot-Probe
  // blieb sie deshalb grün, obwohl der Code das alte Datumsfenster hatte.
  pruef("Die Abfrage benutzt „days“",
    /&days=\$\{tage\}/.test(brevoCode),
    "Brevo-Referenz: „Number of days in the past including today“ — kann kein Zukunftsdatum enthalten");
  pruef("„days“ steht NICHT zusammen mit startDate/endDate",
    !/days=[^`]*startDate/.test(brevoCode) && !/startDate=[^`]*days=/.test(brevoCode),
    "laut Referenz unzulässig: „Not compatible with startDate and endDate“");
  pruef("Die Tageszahl bleibt in Brevos Grenzen",
    /Math\.min\(90,/.test(brevoCode), "Referenz: maximum 90");
  pruef("Die Tageszahl ist mindestens 1",
    /Math\.max\(1,/.test(brevoCode), "0 Tage wäre wieder ein 400");
  pruef("Das Limit reicht für einen Sammellauf",
    /limit=\$\{Math\.min\(2500,/.test(brevoCode),
    "35 Mails erzeugen je mehrere Ereignisse — mit 100 fehlen Treffer, und das sähe aus wie „Zweig fehlt“");
  pruef("Beide Schreibweisen der messageId werden gelesen",
    /e\.messageId \? String\(e\.messageId\)/.test(brevo) && /e\["message-id"\]/.test(brevo),
    "die Referenz nennt messageId, ältere Antworten message-id");

  // ── DIE VOLLE ANTWORT INS LOG ──────────────────────────────────────────
  pruef("Die vollständige Brevo-Antwort wird geloggt",
    /BREVO-NACHSCHAU\] Abfrage gescheitert/.test(brevo) && /antwort: r\.klartext\.roh/.test(brevo),
    "eine Fehlermeldung ohne die Antwort des Gegenübers schickt den nächsten Leser auf dieselbe Suche");
  pruef("… mit dem angefragten Pfad daneben",
    /pfad: `\/smtp\/statistics\/events/.test(brevo),
    "sonst weiß niemand, WAS Brevo beanstandet hat");

  // ═════════════════════════════════════════════════════════════════════════
  titel("2. HTTP 400 HEISST: WIR HABEN DEN FEHLER");
  // ═════════════════════════════════════════════════════════════════════════
  const { brevoKlartext } = await import("../server/lib/fiaon-brevo-fehler");

  const k400 = brevoKlartext(400, JSON.stringify({
    message: "endDate must be lower than or equal to today", code: "invalid_parameter",
  }));
  pruef("Ein 400 wird uns zugeschrieben, nicht Brevo",
    k400.wer === "wir", `wer=${k400.wer}`);
  pruef("Der Titel sagt, dass die PRÜFUNG gestört ist",
    /Prüfung selbst ist gestört/.test(k400.titel), k400.titel);
  pruef("Er sagt ausdrücklich: nicht der Versand",
    /nicht der Versand/i.test(k400.titel));
  pruef("Brevos eigener Satz wird zitiert",
    k400.titel.includes("endDate must be lower than or equal to today"),
    "der Betreiber soll nicht raten müssen");
  pruef("Die Anleitung sagt: nichts in Make zu tun",
    k400.anleitung.some((z) => /Nichts in Make/i.test(z)),
    "genau hier entstand die falsche Anschuldigung");
  pruef("Sie sagt, dass keine Zustellung verloren geht",
    k400.anleitung.some((z) => /geht keine Zustellung verloren/i.test(z)));
  pruef("Die rohe Antwort bleibt erhalten",
    k400.roh.includes("invalid_parameter"));

  // Zur Gegenprobe: Ein 401 bleibt eine Einstellung, ein 500 bleibt bei Brevo.
  pruef("401 bleibt eine Einstellung", brevoKlartext(401, "{}").wer === "einstellung");
  pruef("503 bleibt bei Brevo", brevoKlartext(503, "{}").wer === "brevo");
  pruef("Ein 404 gilt auch als unser Fehler",
    brevoKlartext(404, "{}").wer === "wir",
    "ein falscher Pfad ist kein Brevo-Problem");

  // ═════════════════════════════════════════════════════════════════════════
  titel("3. DREI ZUSTÄNDE — und „gestört“ zählt nicht als „ohne Zweig“");
  // ═════════════════════════════════════════════════════════════════════════
  // ── AUS DREI WURDEN VIER ZUSTÄNDE (23.08.2026) ─────────────────────────
  // Diese Prüfung stand auf der Einzeiler-Schreibweise der Vereinigung. Mit dem
  // vierten Zustand („veraltet") steht sie über mehrere Zeilen — ein Regex auf
  // die Formatierung wäre beim nächsten Zustand wieder rot. Also auf die
  // BESTANDTEILE prüfen, nicht auf ihre Anordnung.
  pruef("Es gibt vier Zustände im Typ",
    ["\"bestaetigt\"", "\"zweig_fehlt\"", "\"pruefung_gestoert\"", "\"veraltet\""]
      .every((z) => zustellung.includes(z)),
    "bestätigt · Zweig fehlt · Prüfung gestört · veraltet");
  pruef("Der Sammellauf zählt sie getrennt",
    /bestaetigt: number;/.test(zustellung) && /zweigFehlt: number;/.test(zustellung)
      && /gestoert: number;/.test(zustellung));
  pruef("Die Route gibt „gestoert“ eigenständig heraus",
    /gestoert: lauf\.gestoert,/.test(route),
    "sonst landet es wieder in „beanstandet“ und die Kachel beschuldigt den Betreiber");
  pruef("„beanstandet“ ist jetzt NUR noch „Zweig fehlt“",
    /beanstandet: lauf\.zweigFehlt,/.test(route));

  // ── DER WICHTIGSTE PUNKT ───────────────────────────────────────────────
  // Eine Prüfung, die nicht stattfand, darf keinen Zweig als fehlend markieren.
  const gestoertBlock = zustellung.slice(
    zustellung.indexOf("if (!nachschau.ok)"),
    zustellung.indexOf("if (!nachschau.ok)") + 700);
  pruef("Eine gestörte Nachschau markiert KEINEN Zweig als fehlend",
    gestoertBlock.length > 100 && !/verifikationSpeichern/.test(gestoertBlock),
    "sonst steht in der Datenbank „geprüft und gescheitert“, obwohl nichts geprüft wurde");
  pruef("… und das ist im Quelltext begründet",
    zustellung.includes("BEWUSST NICHT als") && zustellung.includes("Eine Prüfung,"),
    "eine Wand ohne Begründung wird beim nächsten Umbau entfernt");
  pruef("Ohne Schlüssel ist jeder Zweig „gestört“, nicht „fehlt“",
    /zustand: "pruefung_gestoert" as ZweigZustand,\n        text: OHNE_SCHLUESSEL/.test(zustellung)
      || /gestoert: events\.length,/.test(zustellung),
    "über die Zweige ist ohne Schlüssel NICHTS gesagt");
  pruef("Ein Versandfehler an Make ist ebenfalls „gestört“",
    /Über den Zweig ist damit nichts gesagt/.test(zustellung),
    "Make hat die Mail nicht angenommen — das sagt nichts über den Zweig");

  // ═════════════════════════════════════════════════════════════════════════
  titel("4. DER LAUF IST SCHNELL — und eine Logik, nicht zwei");
  // ═════════════════════════════════════════════════════════════════════════
  // ── DIE ÜBERHOLTE REGEL ────────────────────────────────────────────────
  // Hier stand „dann EINMAL gewartet, EINMAL gefragt". Genau das war der Fehler
  // vom 22.08.2026: 34 falsche Rot-Marken, weil Brevo 1–3 Minuten braucht.
  // Die Regel ist ersetzt, nicht gelöscht — damit niemand meint, das Polling
  // sei ein Versehen.
  pruef("Alle Mails werden gestaffelt abgeschickt, dann MEHRMALS gefragt",
    /1\. ALLE SENDEN/.test(zustellung)
      && /GEDULD: MEHRMALS NACHFRAGEN, NICHT EINMAL/.test(zustellung));
  pruef("Es gibt EINEN Brevo-Abruf für alle Zweige",
    (zustellung.match(/await nachschauSammel\(/g) ?? []).length === 1,
    "35 Abrufe reizen die Bremse (HTTP 429)");
  pruef("Die Staffel gegen Make-Drosselung ist da",
    /staffelMs \?\? 200/.test(zustellung),
    "ein gedrosselter Versand sähe aus wie ein fehlender Zweig");
  pruef("Der Fortschritt wird gemeldet",
    /fortschritt\?: \(s: \{/.test(zustellung)
      && /bestaetigt\?: number; naechsteFrageInMs\?: number; runde\?: number;/.test(zustellung),
    "sonst sieht die Seite aus, als hinge sie — und ein Abbruch erzeugt falsche Rot-Marken");
  pruef("Die Dauer steht in der Antwort",
    /dauerSekunden: lauf\.dauerSekunden,/.test(route),
    "damit die Verbesserung nachweisbar ist");
  pruef("Die alte 35er-Schleife ist weg",
    !/for \(const e of alle\) \{\s*const p = await zweigPruefen/.test(route));

  pruef("Die Einzelprüfung benutzt DIESELBE Funktion",
    /nur: \[String\(req\.params\.event\)\]/.test(route),
    "zwei Fassungen derselben Prüfung gehen auseinander — jemand korrigiert die eine und vergisst die andere");
  pruef("Der Sammellauf kann auf einzelne Ereignisse eingeschränkt werden",
    /nur\?: string\[\];/.test(zustellung));

  // ── DIE RECHNUNG ───────────────────────────────────────────────────────
  // Vorher: 35 × (Versand + 4 s Wartezeit) ≥ 140 s, dazu 35 Brevo-Abrufe.
  // Jetzt:  35 × 200 ms Staffel (7 s) + 25 s Wartezeit + 1 Abruf ≈ 33 s.
  const vorher = 35 * 4;
  const jetzt = Math.round((35 * 200) / 1000) + 25 + 2;
  console.log(`        Vorher: ~${vorher} s (35 × 4 s Wartezeit, 35 Brevo-Abrufe)`);
  console.log(`        Jetzt:  ~${jetzt} s (7 s Staffel + 25 s Wartezeit + 1 Abruf)`);
  pruef("Der Lauf bleibt unter 90 Sekunden", jetzt < 90, `${jetzt} s gerechnet`);

  // ═════════════════════════════════════════════════════════════════════════
  titel("5. DIE GEDULD — mehrmals nachfragen statt einmal");
  // ═════════════════════════════════════════════════════════════════════════
  // ── DER FEHLER VOM 22.08.2026 ──────────────────────────────────────────
  // Der Lauf wartete EINMAL 25 Sekunden und meldete dann für 34 von 35
  // Ereignissen „die Testmail kam nicht bei Brevo an" — während die Mails im
  // Postfach lagen. Brevo trägt Ereignisse mit 1–3 MINUTEN Verzug ein.
  const zCode = ohneKommentare(zustellung);
  // Das Fenster zählt ab „wartenAb“ (nach dem Versand), nicht ab „start“ —
  // ein erster Entwurf zählte ab Lauf-Beginn, und die 34 Probemails
  // verbrauchten einen Teil davon. Der Prüfstand hat das gefunden.
  pruef("Es wird MEHRMALS nachgefragt, nicht einmal",
    /while \(Date\.now\(\) - wartenAb < bisMs\)/.test(zCode),
    "eine einzige Abfrage nach 25 s war der Fehler");
  pruef("Das Wartefenster beginnt NACH dem Versand",
    /const wartenAb = Date\.now\(\);/.test(zCode),
    "sonst verbrauchen die 34 gestaffelten Probemails einen Teil davon");
  pruef("Das Zeitfenster geht bis 4 Minuten",
    /opts\.maxWartenMs \?\? 240_000/.test(zCode),
    "Brevos Verzug ist 1–3 Minuten");
  pruef("Der Takt ist 30 Sekunden",
    /opts\.taktMs \?\? 30_000/.test(zCode));
  pruef("Bestätigtes bleibt bestätigt",
    /bestaetigteEreignisse\.set\(e\.type, meine\)/.test(zCode)
      && /!bestaetigteEreignisse\.has\(e\.type\)/.test(zCode),
    "sonst könnte ein späterer Durchgang ein Ergebnis wieder verwerfen");
  pruef("Sind alle da, endet der Lauf sofort",
    /if \(nochOffen\(\)\.length === 0\) break;/.test(zCode),
    "Tempo bleibt, wenn alles in Ordnung ist");
  pruef("Bei kaputter Abfrage wird NICHT weitergepollt",
    /if \(!nachschau\.ok\) \{[\s\S]{0,120}break;/.test(zCode),
    "4 Minuten denselben HTTP-400 zu wiederholen hilft niemandem");
  pruef("Der Fortschritt meldet den Zählerstand",
    /bestaetigt: bestaetigteEreignisse\.size/.test(zCode));

  // ── DIE DIAGNOSE ────────────────────────────────────────────────────────
  pruef("Bei Misserfolg steht die gesuchte Adresse dabei",
    /Diagnose: gesucht wurde/.test(zustellung));
  pruef("… und das Zeitfenster", /ab \$\{suchAb\.toLocaleTimeString/.test(zustellung));
  pruef("… und die Zahl der gefundenen Brevo-Ereignisse",
    /Brevo lieferte \$\{gefundeneGesamt\} Ereignisse/.test(zustellung));
  pruef("Bei 0 gefundenen sagt sie, dass es NICHT am Zweig liegt",
    /also NICHTS\. Dann liegt es nicht am einzelnen Zweig/.test(zustellung),
    "sonst sucht der Betreiber wieder in Make");

  // ── „NUR NACHSEHEN" ─────────────────────────────────────────────────────
  pruef("Es gibt einen Weg OHNE neue Probemails",
    /nurNachsehen\?: boolean;/.test(zustellung)
      && /for \(const e of opts\.nurNachsehen \? \[\] : events\)/.test(zCode),
    "35 unnötige Mails kosten Zustellreputation");
  pruef("Er wartet beim ersten Durchgang nicht",
    /if \(!\(opts\.nurNachsehen && runden === 0\)\)/.test(zCode),
    "die Mails sind von vorhin — es gibt nichts, worauf man wartet");
  pruef("Er sucht ab dem letzten Versand, nicht ab jetzt",
    /opts\.suchAb \?\? new Date\(start - 120_000\)/.test(zCode));
  pruef("Die Route bietet ihn an",
    /const nurNachsehen = req\.body\?\.nurNachsehen === true;/.test(route));
  pruef("Sie sucht den letzten TEST-Versand",
    /art = 'test'/.test(route),
    "die Spalte heißt art, nicht ist_test — ein erster Entwurf fiel still zurück");
  pruef("Der Knopf steht in der Oberfläche",
    /Nur nachsehen/.test(lies("client/src/pages/admin-events.tsx")));

  // ── DAS VERALTETE EREIGNIS ──────────────────────────────────────────────
  pruef("Veraltete Ereignisse werden nicht geprüft",
    /const lebende = alleEvents\.filter\(\(e\) => !e\.deprecated\)/.test(zCode),
    "followup_48h bekam eine Probemail und zählte als „Zweig fehlt“");
  pruef("Sie bekommen einen eigenen Zustand",
    /\| "veraltet"/.test(zustellung));
  pruef("Sie zählen in KEINER Summe mit",
    /veraltet: veraltete\.length,/.test(zCode)
      && !/zweigFehlt \+= .*veraltet/.test(zCode),
    "eine Ampel, die einen gelöschten Zweig anmahnt, wird ignoriert");
  const events = lies("client/src/pages/admin-events.tsx");
  pruef("Die Oberfläche zeigt sie als erledigt",
    /ist veraltet und/.test(events) && /gelöscht<\/b> werden/.test(events));

  // ── DIE ZEITANGABEN STIMMEN ÜBEREIN ────────────────────────────────────
  // Zweimal in zwei Tagen ist eine Angabe an einer Stelle korrigiert und an der
  // anderen vergessen worden. Also wird es geprüft.
  pruef("Der Dialog nennt 4 Minuten, nicht mehr 34 Sekunden",
    /bis zu 4 Minuten/.test(events) && !/\{Math\.round\(\(anzahl \* 0\.2\) \+ 27\)\} Sekunden/.test(events),
    "dieselbe Zahl an zwei Stellen wird einmal korrigiert");
  pruef("Die Leiste nennt denselben Takt",
    /alle 30 Sekunden<\/b> bei Brevo nach/.test(events));
  pruef("Die Leiste bewegt sich (Sekundenzähler)",
    /setVerstrichen\(\(v\) => v \+ 1\)/.test(events),
    "eine Anzeige, die stillsteht, wird abgebrochen");

  console.log(`\n${"═".repeat(72)}`);
  console.log(`  ${ok} ok · ${rot} rot`);
  if (rot > 0) console.log(`\n  ROT:\n${fehler.map((f) => `    · ${f}`).join("\n")}`);
  console.log(`${"═".repeat(72)}\n`);
  process.exit(rot > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
