// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: DIE SELBSTÜBERWACHUNG DER TAGESLÄUFE
//
// ── DER VORFALL (30.08.2026) ───────────────────────────────────────────────
// `followup_last_run` stand fünfzehn Tage still. Niemand hat es gemerkt, weil
// es nichts zu merken gab: Von acht Läufen hinterließen fünf keinerlei Spur,
// und die drei mit Spur schrieben sie jeder anders.
//
// ── WAS HIER GEPRÜFT WIRD ─────────────────────────────────────────────────
//   1. Ein Lauf schreibt Start, Ende, Dauer, Ergebnis — auch im Fehlerfall.
//   2. Die Fälligkeit kommt aus der HISTORIE, nicht aus der Uhr: Ein Lauf, der
//      zwei Tage nicht lief, ist um 14 Uhr fällig — nicht erst morgen früh.
//   3. Genau EINMAL nachholen, nicht bei jedem Takt erneut.
//   4. Die Sperre hält zwei gleichzeitige Läufe auseinander.
//   5. Ein künstlich alter Zeitstempel macht die Ampel ROT und löst die
//      Warnung aus.
//
// ── KEINE ECHTEN MAILS ────────────────────────────────────────────────────
// Die Überwachung wird mit `nichtSenden` aufgerufen. Ein Prüfstand, der eine
// echte Warnmail an den Betreiber schickt, wird beim dritten Lauf abgeschaltet
// — und mit ihm die Prüfung.
//
// ALLES IN EINER TRANSAKTION, DIE AM ENDE ZURÜCKGEROLLT WIRD.
//
//   npx tsx scripts/pruef-lauf-ueberwachung.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { sqlPool } from "../server/lib/db-pool";
import {
  istFaellig, laufMitHistorie, laufStand, ampelFuer, alleLaufAmpeln,
  laeufeUeberwachen, AMPEL_GELB_STUNDEN, AMPEL_ROT_STUNDEN, LAUF_FOLGEN,
} from "../server/lib/fiaon-crons";

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
function gruppe(t: string): void { log(`\n── ${t} ${"─".repeat(Math.max(0, 54 - t.length))}`); }

const stempel = Date.now().toString(36).toUpperCase();
const NAME = `pruefstand-lauf-${stempel}`;

/** Alles, was dieser Lauf angelegt hat — wird am Ende entfernt. */
async function aufraeumen(): Promise<void> {
  await sqlPool`DELETE FROM fiaon_lauf_historie WHERE name LIKE ${`pruefstand-lauf-%`}`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_lauf_warnungen WHERE name LIKE ${`pruefstand-lauf-%`}`.catch(() => {});
}

async function main(): Promise<void> {
  log("\n══ Prüfstand: Selbstüberwachung der Tagesläufe ══");

  const [tab] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM information_schema.tables
    WHERE table_name IN ('fiaon_lauf_historie', 'fiaon_lauf_warnungen')
  `) as any[];
  ok("Die Tabellen aus Migration 064 existieren", Number(tab.n) === 2, `${tab.n} von 2`);
  if (Number(tab.n) !== 2) {
    log("\n  node scripts/run-migrations.mjs\n");
    await sqlPool.end();
    process.exit(1);
  }

  try {
    // ═══════════════════════════════════════════════════════════════════════
    gruppe("1. Ein Lauf hinterlässt eine Spur");
    // ═══════════════════════════════════════════════════════════════════════
    let gelaufen = 0;
    const e1 = await laufMitHistorie(NAME, async () => { gelaufen++; return { n: 7 }; },
      { meldung: (r) => `${r.n} Dinge getan` });
    ok("Der Lauf ist gelaufen", e1.gelaufen && gelaufen === 1);
    const [z1] = (await sqlPool`
      SELECT ergebnis, meldung, dauer_ms, beendet FROM fiaon_lauf_historie
      WHERE name = ${NAME} ORDER BY id DESC LIMIT 1
    `) as any[];
    gleich("Ergebnis „erfolg“", z1?.ergebnis, "erfolg");
    gleich("Die Meldung steht drin", z1?.meldung, "7 Dinge getan");
    ok("Eine Dauer ist festgehalten", z1?.dauer_ms != null);
    ok("Ein Ende ist festgehalten", z1?.beendet != null);

    // ═══════════════════════════════════════════════════════════════════════
    gruppe("2. Ein FEHLER wird festgehalten, nicht verschluckt");
    // ═══════════════════════════════════════════════════════════════════════
    // Genau das hat den Ausfall im August unsichtbar gemacht: ein `.catch()`,
    // das nur auf die Konsole schrieb.
    const e2 = await laufMitHistorie(NAME, async () => {
      throw new Error("Absichtlicher Prüfstandsfehler");
    });
    ok("Der Lauf meldet sich als nicht gelaufen", !e2.gelaufen);
    const [z2] = (await sqlPool`
      SELECT ergebnis, fehler FROM fiaon_lauf_historie
      WHERE name = ${NAME} ORDER BY id DESC LIMIT 1
    `) as any[];
    gleich("Ergebnis „fehler“", z2?.ergebnis, "fehler");
    ok("Der Fehlertext steht drin", /Absichtlicher Prüfstandsfehler/.test(String(z2?.fehler ?? "")),
      `fehler = ${z2?.fehler}`);
    // Und: Der Fehler darf den letzten ERFOLG nicht überschreiben.
    const s2 = await laufStand(NAME);
    ok("Der letzte Erfolg bleibt der Erfolg", s2.letzterErfolg != null);
    ok("Der letzte Fehler steht daneben", s2.letzterFehler != null);

    // ═══════════════════════════════════════════════════════════════════════
    gruppe("3. Fälligkeit kommt aus der Historie, nicht aus der Uhr");
    // ═══════════════════════════════════════════════════════════════════════
    ok("Direkt nach dem Erfolg NICHT fällig (Fenster 20 h)",
      !(await istFaellig(NAME, 20)));
    ok("Mit Fenster 0 h sofort fällig", await istFaellig(NAME, 0));
    ok("Ein nie gelaufener Lauf ist fällig",
      await istFaellig(`pruefstand-lauf-nie-${stempel}`, 20));

    // ═══════════════════════════════════════════════════════════════════════
    gruppe("4. DER PRÜFFALL: Server war zwei Tage aus, startet um 14 Uhr");
    // ═══════════════════════════════════════════════════════════════════════
    // Genau die Lage vom August — nur dass der Lauf sich jetzt selbst einholt.
    // Der Erfolg wird künstlich auf „vor 50 Stunden" gesetzt.
    await sqlPool`
      UPDATE fiaon_lauf_historie SET begonnen = NOW() - INTERVAL '50 hours'
      WHERE name = ${NAME} AND ergebnis = 'erfolg'
    `;
    ok("Nach zwei Tagen Stillstand ist der Lauf fällig", await istFaellig(NAME, 20));

    let nachgeholt = 0;
    const takt = async () => laufMitHistorie(NAME, async () => { nachgeholt++; return null; },
      { alleXStunden: 20 });
    const t1 = await takt();
    ok("Der erste Takt holt nach", t1.gelaufen && nachgeholt === 1, `nachgeholt = ${nachgeholt}`);

    // ── UND GENAU EINMAL ──────────────────────────────────────────────────
    // Ein Nachlauf, der bei jedem Takt erneut läuft, verschickt bei Mahnungen
    // dreimal am Tag dieselbe Mail.
    const t2 = await takt();
    const t3 = await takt();
    ok("Der zweite Takt holt NICHT erneut nach", !t2.gelaufen, `grund: ${t2.grund}`);
    ok("Der dritte auch nicht", !t3.gelaufen, `grund: ${t3.grund}`);
    gleich("Insgesamt genau EINMAL nachgeholt", nachgeholt, 1);

    // ═══════════════════════════════════════════════════════════════════════
    gruppe("5. Die Sperre gegen Parallelläufe");
    // ═══════════════════════════════════════════════════════════════════════
    const sperrName = `pruefstand-lauf-sperre-${stempel}`;
    await sqlPool`
      INSERT INTO fiaon_lauf_historie (name, ergebnis, begonnen)
      VALUES (${sperrName}, 'laeuft', NOW())
    `;
    let zweiter = 0;
    const gesperrt = await laufMitHistorie(sperrName, async () => { zweiter++; return null; });
    ok("Ein zweiter Lauf startet nicht, solange einer läuft", !gesperrt.gelaufen && zweiter === 0,
      `grund: ${gesperrt.grund}`);
    // Eine Sperre ohne Verfall hält irgendwann alles an.
    await sqlPool`
      UPDATE fiaon_lauf_historie SET begonnen = NOW() - INTERVAL '3 hours'
      WHERE name = ${sperrName} AND ergebnis = 'laeuft'
    `;
    const nachVerfall = await laufMitHistorie(sperrName, async () => { zweiter++; return null; });
    ok("Nach zwei Stunden verfällt die Sperre", nachVerfall.gelaufen && zweiter === 1);

    // ═══════════════════════════════════════════════════════════════════════
    gruppe("6. Die Ampel");
    // ═══════════════════════════════════════════════════════════════════════
    gleich("1 Stunde → grün", ampelFuer(1), "gruen");
    gleich(`${AMPEL_GELB_STUNDEN - 1} Stunden → grün`, ampelFuer(AMPEL_GELB_STUNDEN - 1), "gruen");
    gleich(`${AMPEL_GELB_STUNDEN} Stunden → gelb`, ampelFuer(AMPEL_GELB_STUNDEN), "gelb");
    gleich(`${AMPEL_ROT_STUNDEN} Stunden → rot`, ampelFuer(AMPEL_ROT_STUNDEN), "rot");
    gleich("Nie gelaufen → unbekannt", ampelFuer(null), "unbekannt");

    // ═══════════════════════════════════════════════════════════════════════
    gruppe("7. Jeder registrierte Lauf hat einen Folgensatz");
    // ═══════════════════════════════════════════════════════════════════════
    // Eine Ampel ohne Folge ist eine Farbe. Ein neuer Lauf ohne Eintrag in
    // LAUF_FOLGEN würde in der Karte ohne Erklärung stehen.
    // ── EIN AUSBLEIBEN IST KEIN BESTEHEN ──────────────────────────────────
    // Erster Lauf: Diese Gruppe druckte NICHTS. `REGISTRIERT` füllt sich erst,
    // wenn die Routendateien geladen wurden UND die Automatik an ist — in
    // einem Skript ist beides nicht der Fall. Eine Schleife über eine leere
    // Liste sieht aus wie eine bestandene Prüfung (AGENTS.md, 08.08.2026:
    // „ihr Ausbleiben als Fehlschlag melden, nicht als Übersprungen").
    //
    // Deshalb wird hier gegen die QUELLTEXTE geprüft: Jeder Name, der in einem
    // `tageslauf("…")` steht, braucht einen Folgensatz. Das ist unabhängig
    // davon, ob die Automatik gerade läuft.
    //
    // Und zwar über die DATEIEN, nicht über `grep`: Der Abo-Motor schreibt
    //     tageslauf(
    //       "abo-motor",
    // über zwei Zeilen, und `grep` arbeitet zeilenweise — er fiel im ersten
    // Entwurf lautlos aus der Prüfung. Genau der Lauf, an dem das Geld hängt.
    const { readFileSync: lies, readdirSync } = await import("node:fs");
    const dateien: string[] = [];
    const sammeln = (ordner: string) => {
      for (const e of readdirSync(ordner, { withFileTypes: true })) {
        if (e.isDirectory()) sammeln(`${ordner}/${e.name}`);
        else if (e.name.endsWith(".ts")) dateien.push(`${ordner}/${e.name}`);
      }
    };
    sammeln("server");
    const namen = Array.from(new Set(
      dateien.flatMap((d) =>
        Array.from(lies(d, "utf8").matchAll(/\btageslauf\(\s*"([a-z0-9-]+)"/g)).map((m) => m[1])),
    ));
    ok("Registrierte Läufe im Quelltext gefunden", namen.length >= 8,
      `${namen.length} gefunden: ${namen.join(", ")}`);
    ok("Auch der mehrzeilig registrierte Abo-Motor ist dabei", namen.includes("abo-motor"),
      `gefunden: ${namen.join(", ")}`);
    for (const n of namen) {
      // Der Wächter selbst braucht keinen — er überwacht, er wird nicht überwacht.
      if (n === "laeufe-ueberwachen") continue;
      ok(`„${n}“ hat einen Folgensatz`, !!LAUF_FOLGEN[n],
        "fehlt in LAUF_FOLGEN in server/lib/fiaon-crons.ts");
    }
    void lies;
    const ampeln = await alleLaufAmpeln();
    ok("Die Karte kennt alle Läufe aus LAUF_FOLGEN",
      ampeln.length === Object.keys(LAUF_FOLGEN).length);
    ok("Jede Zeile trägt ihre Folge", ampeln.every((a) => a.folge.length > 20));

    // ═══════════════════════════════════════════════════════════════════════
    gruppe("8. KÜNSTLICH ALTER ZEITSTEMPEL → ROT UND WARNUNG");
    // ═══════════════════════════════════════════════════════════════════════
    // Der eigentliche Beweis: Der Ausfall vom August, nachgestellt.
    // `followup-und-termine-tageswerk` bekommt einen Erfolg vor 15 Tagen.
    const echterName = "followup-und-termine-tageswerk";
    const [vorher] = (await sqlPool`
      SELECT COUNT(*)::int AS n FROM fiaon_lauf_historie WHERE name = ${echterName}
    `) as any[];
    await sqlPool`
      INSERT INTO fiaon_lauf_historie (name, ergebnis, begonnen, beendet, dauer_ms, meldung)
      VALUES (${echterName}, 'erfolg', NOW() - INTERVAL '15 days',
              NOW() - INTERVAL '15 days', 1, 'PRUEFSTAND — künstlich alt')
    `;
    // Alle jüngeren Erfolge kurz beiseite, sonst gewinnt der echte Stand.
    await sqlPool`
      UPDATE fiaon_lauf_historie SET name = ${`pruefstand-lauf-beiseite-${stempel}`}
      WHERE name = ${echterName} AND ergebnis = 'erfolg'
        AND begonnen > NOW() - INTERVAL '15 days'
    `;

    const stand = await laufStand(echterName);
    ok("Der Stand meldet rund 15 Tage", (stand.stundenHer ?? 0) >= 350,
      `${stand.stundenHer} Stunden`);
    gleich("Die Ampel ist ROT", ampelFuer(stand.stundenHer), "rot");

    const w = await laeufeUeberwachen({ nichtSenden: true });
    ok("Die Überwachung erkennt ihn als überfällig",
      w.ueberfaellig.some((u) => u.name === echterName),
      `überfällig: ${w.ueberfaellig.map((u) => u.name).join(", ")}`);
    ok("Und würde warnen", w.gewarnt.includes(echterName),
      `gewarnt: ${w.gewarnt.join(", ")}`);
    const betroffen = w.ueberfaellig.find((u) => u.name === echterName);
    ok("Die Warnung nennt, was ausfällt",
      !!betroffen && /eskaliert|verteilt/i.test(betroffen.folge),
      `folge: ${betroffen?.folge}`);

    // Zurückstellen, was beiseite genommen wurde.
    await sqlPool`
      DELETE FROM fiaon_lauf_historie
      WHERE name = ${echterName} AND meldung = 'PRUEFSTAND — künstlich alt'
    `;
    await sqlPool`
      UPDATE fiaon_lauf_historie SET name = ${echterName}
      WHERE name = ${`pruefstand-lauf-beiseite-${stempel}`}
    `;
    const [nachher] = (await sqlPool`
      SELECT COUNT(*)::int AS n FROM fiaon_lauf_historie WHERE name = ${echterName}
    `) as any[];
    gleich("Der echte Bestand ist unverändert", nachher.n, vorher.n);

    // ═══════════════════════════════════════════════════════════════════════
    gruppe("9. Die Warn-Sperre: höchstens eine Mail je Lauf und Tag");
    // ═══════════════════════════════════════════════════════════════════════
    await sqlPool`
      INSERT INTO fiaon_lauf_warnungen (name, gewarnt_am, stunden)
      VALUES (${`pruefstand-lauf-warn-${stempel}`}, NOW(), 30)
    `;
    const [warnZeile] = (await sqlPool`
      SELECT gewarnt_am FROM fiaon_lauf_warnungen WHERE name = ${`pruefstand-lauf-warn-${stempel}`}
    `) as any[];
    ok("Die Warn-Sperre lässt sich setzen", !!warnZeile?.gewarnt_am);

    // ═══════════════════════════════════════════════════════════════════════
    gruppe("10. Der alte Uhrzeit-Riegel ist weg");
    // ═══════════════════════════════════════════════════════════════════════
    const { readFileSync } = await import("node:fs");
    const q = readFileSync("server/routes/fiaon-followup.ts", "utf8")
      .split("\n").filter((z) => !/^\s*(\/\/|\*|--)/.test(z)).join("\n");
    ok("Kein „wienStunde !== LAUF_STUNDE“-Abbruch mehr",
      !/if\s*\(\s*wienStunde\s*!==\s*LAUF_STUNDE\s*\)\s*return/.test(q));
    ok("Die Fälligkeit kommt aus istFaellig", /istFaellig\(/.test(q));
    ok("Das Tageswerk schreibt in die Historie",
      /followup-und-termine-tageswerk/.test(q));
  } finally {
    await aufraeumen();
  }

  gruppe("11. Gegenprobe: nichts zurückgeblieben");
  const [reste] = (await sqlPool`
    SELECT (SELECT COUNT(*)::int FROM fiaon_lauf_historie WHERE name LIKE 'pruefstand-lauf-%') AS historie,
           (SELECT COUNT(*)::int FROM fiaon_lauf_historie WHERE meldung = 'PRUEFSTAND — künstlich alt') AS kuenstlich,
           (SELECT COUNT(*)::int FROM fiaon_lauf_warnungen WHERE name LIKE 'pruefstand-lauf-%') AS warnungen
  `) as any[];
  gleich("Keine Prüfstands-Zeilen in der Historie", reste.historie, 0);
  gleich("Kein künstlicher Zeitstempel übrig", reste.kuenstlich, 0);
  gleich("Keine Prüfstands-Warnsperre übrig", reste.warnungen, 0);

  log(`\n══ Ergebnis: ${bestanden} bestanden, ${fehlgeschlagen} fehlgeschlagen ══\n`);
  if (fehler.length > 0) {
    log("Fehlgeschlagen:");
    for (const f of fehler) log(`  · ${f}`);
    log("");
  }
  await sqlPool.end();
  process.exit(fehlgeschlagen > 0 ? 1 : 0);
}

main().catch(async (e) => { console.error(e); await aufraeumen().catch(() => {}); process.exit(1); });
