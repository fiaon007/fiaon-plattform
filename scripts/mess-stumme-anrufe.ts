// ═══════════════════════════════════════════════════════════════════════════
// STUMME ANRUFE UND GEWÄHLTE NUMMERN — DIE ZWEI MESSUNGEN ZUM VIDEOBEFUND
//
// ── DER ANLASS (Videoauswertung, Anruf bei Nikita vom 19.08.2026) ──────────
// Auf dem Wählbild stand am Pegelbalken „sehr leise", der Balken war leer — und
// der Anruf ging trotzdem raus. Wenn das Team regelmäßig mit stummem Mikrofon
// anruft, ist die gemeldete Erreichbarkeit von 2 aus 158 ERKLÄRT und keine Frage
// der Nummern-Reputation.
//
// ── WAS DIESE MESSUNG BEANTWORTEN KANN ────────────────────────────────────
//   1. Wie viele ausgehende Anrufe der letzten 7 Tage waren auffällig kurz
//      (unter 5 Sekunden Gesprächszeit)? Je Mitarbeiter.
//   2. Was steht in den am 30.08.2026 eingebauten Verbindungsspuren
//      (`transkript_grund`) — ICE-Fehler, Twilio-Warnungen, Stumm-Verdacht?
//   3. Weicht die gewählte Nummer vom gespeicherten Rohwert ab — mehr als nur
//      im Format?
//
// ── UND WAS SIE NICHT KANN, AUSDRÜCKLICH ──────────────────────────────────
// Es gibt KEINE Aufzeichnung des Mikrofonpegels vergangener Anrufe. Die
// Pegelmessung ist am 30.08.2026 eingebaut worden und schreibt erst seit dem
// 31.08. eine Marke („stumm_verdacht") in die Verbindungsspur. Für den Anruf vom
// 19.08. existiert diese Zahl nicht und lässt sich nicht rückwirkend erzeugen.
//
// „Kurzes Gespräch" ist deshalb ein INDIZ, kein Beweis: Ein Mensch, der abhebt
// und sofort auflegt, sieht in den Daten genauso aus wie einer, der nichts hört.
// Wer diesen Unterschied behauptet, ohne ihn messen zu können, liefert eine
// falsche Auskunft — und die ist schlimmer als eine fehlende Zahl.
//
// NUR LESEND.
//
//   npx tsx scripts/mess-stumme-anrufe.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import { nummerNormalisieren } from "../server/lib/fiaon-softphone";

const log = (s = "") => console.log(s);
function titel(t: string): void { log(`\n${"═".repeat(78)}\n${t}\n${"═".repeat(78)}`); }
const feld = (v: unknown): string => {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
/** Nur die Ziffern — für den Vergleich „ist es dieselbe Nummer?". */
const ziffern = (s: unknown): string => String(s ?? "").replace(/\D/g, "");

async function main(): Promise<void> {
  mkdirSync("reports", { recursive: true });

  // ═════════════════════════════════════════════════════════════════════════
  titel("1. AUSGEHENDE ANRUFE DER LETZTEN 7 TAGE — JE MITARBEITER");
  // ═════════════════════════════════════════════════════════════════════════
  const jeAgent = (await sqlPool`
    SELECT ag.name,
           COUNT(*)::int AS versuche,
           COUNT(*) FILTER (WHERE c.status = 'beendet')::int AS angenommen,
           -- Der Kern der Frage: abgehoben, aber praktisch kein Gespräch.
           COUNT(*) FILTER (WHERE c.status = 'beendet'
                              AND COALESCE(c.dauer_sek, 0) BETWEEN 1 AND 4)::int AS unter_5s,
           COUNT(*) FILTER (WHERE c.status = 'beendet'
                              AND COALESCE(c.dauer_sek, 0) = 0)::int AS null_sek,
           ROUND(AVG(c.dauer_sek) FILTER (WHERE c.status = 'beendet'
                                            AND c.dauer_sek > 0))::int AS schnitt_sek,
           -- Die Verbindungsspuren aus Paket 30 (30.08.2026).
           COUNT(*) FILTER (WHERE c.transkript_grund LIKE '%ice=failed%')::int AS ice_fehler,
           COUNT(*) FILTER (WHERE c.transkript_grund LIKE '%stumm_verdacht%')::int AS stumm_verdacht,
           COUNT(*) FILTER (WHERE c.transkript_grund LIKE '%warnung=%')::int AS warnungen
    FROM fiaon_calls c
    JOIN fiaon_agents ag ON ag.id = c.agent_id
    WHERE c.beginn > NOW() - INTERVAL '7 days' AND c.richtung = 'raus'
    GROUP BY ag.name
    ORDER BY COUNT(*) DESC
  `) as any[];

  log("");
  log(`  ${"Mitarbeiter".padEnd(24)} ${"Vers.".padStart(6)} ${"angen.".padStart(7)}`
    + ` ${"<5 s".padStart(6)} ${"0 s".padStart(5)} ${"Ø s".padStart(5)}`
    + ` ${"ICE".padStart(4)} ${"stumm".padStart(6)} ${"Warn".padStart(5)}`);
  log(`  ${"-".repeat(76)}`);
  for (const a of jeAgent) {
    const quote = Number(a.versuche) > 0
      ? Math.round((Number(a.angenommen) / Number(a.versuche)) * 100) : 0;
    log(`  ${String(a.name).slice(0, 23).padEnd(24)} ${String(a.versuche).padStart(6)}`
      + ` ${`${a.angenommen} (${quote}%)`.padStart(7)}`
      + ` ${String(a.unter_5s).padStart(6)} ${String(a.null_sek).padStart(5)}`
      + ` ${String(a.schnitt_sek ?? "—").padStart(5)} ${String(a.ice_fehler).padStart(4)}`
      + ` ${String(a.stumm_verdacht).padStart(6)} ${String(a.warnungen).padStart(5)}`);
  }
  if (jeAgent.length === 0) log("  Keine ausgehenden Anrufe in den letzten 7 Tagen.");

  // ── DIE EHRLICHE EINORDNUNG ─────────────────────────────────────────────
  const [gesamt] = (await sqlPool`
    SELECT COUNT(*)::int AS versuche,
           COUNT(*) FILTER (WHERE status = 'beendet')::int AS angenommen,
           COUNT(*) FILTER (WHERE transkript_grund IS NOT NULL)::int AS mit_spur,
           COUNT(*) FILTER (WHERE transkript_grund LIKE '%stumm_verdacht%')::int AS stumm
    FROM fiaon_calls WHERE beginn > NOW() - INTERVAL '7 days' AND richtung = 'raus'
  `) as any[];
  log("");
  log(`  ${gesamt.versuche} Versuche, ${gesamt.angenommen} angenommen.`);
  log(`  ${gesamt.mit_spur} Anrufe tragen eine Verbindungsspur, ${gesamt.stumm} eine Stumm-Marke.`);
  if (Number(gesamt.stumm) === 0) {
    log("");
    log("  ── ZUR LESART ──────────────────────────────────────────────────────");
    log("  Die Stumm-Marke wird erst seit dem 31.08.2026 geschrieben. Eine 0 heißt");
    log("  hier NICHT „es gab keine stummen Anrufe“, sondern „für den Zeitraum");
    log("  wurde es nicht gemessen“. Für den Anruf vom 19.08. gibt es diese Zahl");
    log("  nicht und sie lässt sich nicht rückwirkend erzeugen.");
    log("  Was bleibt, ist das INDIZ „<5 s“ — und das ist zweideutig: Wer abhebt");
    log("  und sofort auflegt, sieht genauso aus wie einer, der nichts hört.");
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("2. DIE NUMMER AUS DEM VIDEO: +49797435749");
  // ═════════════════════════════════════════════════════════════════════════
  const gesucht = "+49797435749";
  log("");
  log(`  Eingabe im Video:      ${gesucht}   (${ziffern(gesucht).length} Ziffern)`);
  log(`  Normalisiert (Server): ${nummerNormalisieren(gesucht) ?? "— ABGELEHNT —"}`);
  log("");
  // ── EINE DEUTSCHE MOBILNUMMER IST SIE NICHT ──────────────────────────────
  // +49 und dann 797435749: neun Ziffern nach der Landesvorwahl. Deutsche
  // Rufnummern haben nach der 49 in der Regel zehn bis elf Ziffern, und die
  // Ortsnetzkennzahl 797 gibt es nicht. Das ist kein Formatproblem, hier fehlt
  // eine Stelle.
  log(`  Ziffern nach +49: ${ziffern(gesucht).slice(2).length} (${ziffern(gesucht).slice(2)})`);
  log("  Deutsche Rufnummern tragen nach der 49 üblicherweise 10 bis 11 Ziffern.");
  log("  Eine Ortsnetzkennzahl 797 gibt es nicht — hier fehlt eine Stelle.");
  log("");

  const kandidaten = (await sqlPool`
    SELECT p.id, p.person_ref, p.primary_phone,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name) AS name,
           (SELECT a.ref FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.merged_into IS NULL
             ORDER BY a.created_at DESC LIMIT 1) AS ref
    FROM fiaon_persons p
    WHERE p.merged_into_person_id IS NULL
      AND (REGEXP_REPLACE(COALESCE(p.primary_phone, ''), '\\D', '', 'g') LIKE ${`%${ziffern(gesucht).slice(-8)}%`}
           OR LOWER(COALESCE(p.last_name, '')) LIKE '%pampanini%')
    LIMIT 10
  `) as any[];

  if (kandidaten.length === 0) {
    log("  Kein Kunde mit dieser Nummer oder dem Namen Pampanini gefunden.");
  }
  for (const k of kandidaten) {
    const roh = String(k.primary_phone ?? "");
    const norm = nummerNormalisieren(roh);
    log(`  Person ${k.id} (${k.ref ?? k.person_ref}) — ${k.name}`);
    log(`     Rohwert gespeichert: „${roh}“   (${ziffern(roh).length} Ziffern)`);
    log(`     Normalisiert:        ${norm ?? "— ABGELEHNT —"}`);
    log(`     An Twilio ginge:     ${norm ?? "(gar nichts — der Anruf würde abgelehnt)"}`);
    log(`     Ziffern gleich?      ${norm && ziffern(roh) === ziffern(norm) ? "ja" : "NEIN"}`);
    log(`     = Video-Nummer?      ${norm === gesucht ? "ja" : `nein (Video: ${gesucht})`}`);
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("3. BESTANDSWEIT: WEICHT DIE GEWÄHLTE FORM VOM ROHWERT AB?");
  // ═════════════════════════════════════════════════════════════════════════
  // Die Frage ist nicht „sieht es anders aus" (Leerzeichen und Klammern fallen
  // weg, das ist der Zweck), sondern „sind es ANDERE ZIFFERN". Jede fehlende
  // oder zusätzliche Stelle ist ein Anruf bei einem anderen Menschen.
  const alle = (await sqlPool`
    SELECT p.id, p.person_ref, p.primary_phone,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, p.person_ref) AS name
    FROM fiaon_persons p
    WHERE p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL
      AND COALESCE(p.primary_phone, '') <> ''
  `) as any[];

  const abweichungen: any[] = [];
  const abgelehnt: any[] = [];
  let gleich = 0;
  let nurFormat = 0;
  for (const p of alle) {
    const roh = String(p.primary_phone);
    const norm = nummerNormalisieren(roh);
    if (!norm) { abgelehnt.push({ ...p, grund: "nicht wählbar" }); continue; }
    const zRoh = ziffern(roh);
    const zNorm = ziffern(norm);
    if (zRoh === zNorm) { gleich++; continue; }
    // Die eine ERLAUBTE Abweichung: Der Rohwert beginnt mit 0 (nationale
    // Schreibweise) und die normalisierte Form ersetzt sie durch die
    // Landesvorwahl. Dieselbe Nummer, andere Notation.
    // Und die ZWEITE erlaubte: Der Rohwert trägt die Amtskennzahl 0 NACH der
    // Landesvorwahl („+43 0660…"), ein häufiger Tippfehler. Sie zu entfernen ist
    // der Zweck der Normalisierung, nicht ihr Fehler — „+43 0660 1503979" und
    // „+43 660 1503979" sind dieselbe Nummer.
    //
    // Ohne diese Regel meldete die Messung 3 Abweichungen, die alle richtig
    // waren. Eine Messung, die korrektes Verhalten als Fehler zählt, schickt
    // jemanden auf die Suche nach einem Fehler, den es nicht gibt.
    const nationalZuInternational =
      (zNorm.startsWith("43") && zRoh.replace(/^0/, "") === zNorm.slice(2))
      || (zNorm.startsWith("49") && zRoh.replace(/^0/, "") === zNorm.slice(2))
      || (zNorm.startsWith("41") && zRoh.replace(/^0/, "") === zNorm.slice(2))
      // Rohwert schon international, nur mit 00 statt +
      || zRoh.replace(/^00/, "") === zNorm
      // Amtskennzahl nach der DACH-Vorwahl entfernt
      || (/^4[139]/.test(zNorm) && zRoh.replace(/^(4[139])0+/, "$1") === zNorm);
    if (nationalZuInternational) { nurFormat++; continue; }
    abweichungen.push({
      id: p.id, ref: p.person_ref, name: p.name, roh, norm,
      zRoh, zNorm,
      differenz: zNorm.length - zRoh.length,
    });
  }

  log("");
  log(`  ${String(alle.length).padStart(6)}  Kunden mit Telefonnummer`);
  log(`  ${String(gleich).padStart(6)}  identische Ziffernfolge (nur Trennzeichen entfernt)`);
  log(`  ${String(nurFormat).padStart(6)}  nationale Schreibweise in internationale übersetzt (0… → +43/+49/+41)`);
  log(`  ${String(abgelehnt.length).padStart(6)}  gar nicht wählbar — der Server lehnt sie ab (KEIN Fehlanruf)`);
  log(`  ${String(abweichungen.length).padStart(6)}  ECHTE ZIFFERN-ABWEICHUNGEN`);
  log("");
  if (abweichungen.length === 0) {
    log("  Keine einzige. Jede gewählte Nummer trägt dieselben Ziffern wie der");
    log("  gespeicherte Rohwert — es gibt keinen Anruf beim falschen Menschen");
    log("  durch die Normalisierung.");
  } else {
    log("  Jede dieser Zeilen ist ein möglicher Anruf beim falschen Menschen:");
    for (const a of abweichungen.slice(0, 25)) {
      log(`     Person ${String(a.id).padStart(6)}  „${a.roh}“ → ${a.norm}`
        + `  (${a.zRoh.length} → ${a.zNorm.length} Ziffern, ${a.differenz > 0 ? "+" : ""}${a.differenz})`
        + `  ${String(a.name).slice(0, 24)}`);
    }
    if (abweichungen.length > 25) log(`     … und ${abweichungen.length - 25} weitere (siehe CSV)`);
  }

  // Wie viele der abgelehnten haben zu wenige Ziffern — wie die Video-Nummer?
  const zuKurz = abgelehnt.filter((a) => ziffern(a.primary_phone).length < 10).length;
  log("");
  log(`  Von den ${abgelehnt.length} nicht wählbaren haben ${zuKurz} weniger als 10 Ziffern —`);
  log("  dieselbe Art Fehler wie die Nummer aus dem Video. Sie führen NICHT zu");
  log("  einem Fehlanruf, sondern zu einer Ablehnung vor dem Wählen.");

  // ═════════════════════════════════════════════════════════════════════════
  titel("4. DIE GEFÄHRLICHE SORTE: NATIONALE NUMMER, GERATENES LAND");
  // ═════════════════════════════════════════════════════════════════════════
  // Das ist der Fehler aus dem Video, und er ist eine andere Art als Abschnitt 3:
  // Dort ging es um Ziffern, hier um die Landesvorwahl. Eine geratene Vorwahl
  // erzeugt keine kaputte Nummer, sondern eine GÜLTIGE — die einem anderen
  // Menschen gehört.
  const national = (await sqlPool`
    SELECT p.id, p.person_ref, p.primary_phone, p.country, p.city,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, p.person_ref) AS name
    FROM fiaon_persons p
    WHERE p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL
      AND p.primary_phone LIKE '0%' AND p.primary_phone NOT LIKE '00%'
    ORDER BY COALESCE(p.country, 'ZZ'), p.id
  `) as any[];

  const { vorwahlFuerLand } = await import("../server/lib/fiaon-softphone");
  let richtig = 0;
  const falschGeraten: any[] = [];
  const ohneLand: any[] = [];
  for (const p of national) {
    const vw = vorwahlFuerLand(p.country);
    if (!vw) { ohneLand.push(p); continue; }
    if (vw === "+49") { richtig++; continue; } // Der alte Rat traf zu.
    falschGeraten.push({ ...p, richtig: vw, geraten: "+49" });
  }

  log("");
  log(`  ${String(national.length).padStart(6)}  Kunden mit national geschriebener Nummer (führende 0)`);
  log(`  ${String(richtig).padStart(6)}  davon in Deutschland — der alte Rat „+49“ traf zufällig zu`);
  log(`  ${String(falschGeraten.length).padStart(6)}  FALSCH GERATEN: Land bekannt und NICHT Deutschland`);
  log(`  ${String(ohneLand.length).padStart(6)}  ohne Land in der Akte — nicht entscheidbar`);
  log("");
  for (const f of falschGeraten) {
    log(`     Person ${String(f.id).padStart(6)}  „${f.primary_phone}“  ${f.country}/${f.city ?? "—"}`
      + `  gewählt wurde ${f.geraten}…  richtig ist ${f.richtig}…  ${String(f.name).slice(0, 22)}`);
  }
  if (falschGeraten.length > 0) {
    log("");
    log("  Jede dieser Zeilen ist ein Anruf an eine FREMDE, existierende Nummer.");
    log("  Seit dem 31.08.2026 nimmt `wahlPruefen` das Land aus der Akte — und");
    log("  verweigert, wenn keines dasteht, statt zu raten.");
  }
  if (ohneLand.length > 0) {
    log("");
    log(`  Die ${ohneLand.length} ohne Land werden ab jetzt ABGELEHNT statt geraten. Das ist die`);
    log("  richtige Richtung: Ein verweigerter Anruf kostet eine Nachfrage, ein");
    log("  geratener klingelt bei einem Fremden.");
    for (const o of ohneLand.slice(0, 10)) {
      log(`     Person ${String(o.id).padStart(6)}  „${o.primary_phone}“  ${String(o.name).slice(0, 30)}`);
    }
  }

  writeFileSync("reports/nummern-geratenes-land.csv",
    "art;person_id;person_ref;name;rohwert;land;stadt;geraten;richtig\n"
    + falschGeraten.map((f) => ["falsch_geraten", f.id, f.person_ref, f.name, f.primary_phone,
      f.country, f.city, f.geraten, f.richtig].map(feld).join(";")).join("\n")
    + (falschGeraten.length && ohneLand.length ? "\n" : "")
    + ohneLand.map((o) => ["ohne_land", o.id, o.person_ref, o.name, o.primary_phone,
      o.country ?? "", o.city ?? "", "+49", ""].map(feld).join(";")).join("\n") + "\n",
    "utf8");

  writeFileSync("reports/nummern-abweichungen.csv",
    "art;person_id;person_ref;name;rohwert;gewaehlt;ziffern_roh;ziffern_gewaehlt;differenz\n"
    + abweichungen.map((a) => ["ziffern_abweichung", a.id, a.ref, a.name, a.roh, a.norm,
      a.zRoh.length, a.zNorm.length, a.differenz].map(feld).join(";")).join("\n")
    + (abweichungen.length && abgelehnt.length ? "\n" : "")
    + abgelehnt.map((a) => ["nicht_waehlbar", a.id, a.person_ref, a.name, a.primary_phone, "",
      ziffern(a.primary_phone).length, 0, ""].map(feld).join(";")).join("\n") + "\n",
    "utf8");
  writeFileSync("reports/stumme-anrufe.csv",
    "mitarbeiter;versuche;angenommen;unter_5s;null_sek;schnitt_sek;ice_fehler;stumm_verdacht;warnungen\n"
    + jeAgent.map((a) => [a.name, a.versuche, a.angenommen, a.unter_5s, a.null_sek,
      a.schnitt_sek ?? "", a.ice_fehler, a.stumm_verdacht, a.warnungen].map(feld).join(";")).join("\n") + "\n",
    "utf8");

  log("");
  log("  reports/stumme-anrufe.csv");
  log("  reports/nummern-abweichungen.csv");
  log("");
  await sqlPool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
