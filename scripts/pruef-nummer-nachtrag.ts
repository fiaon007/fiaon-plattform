// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: DIE NUMMER OHNE LAND WIRD ZUR ARBEITSLISTE
//
// ── DER ANLASS (31.08.2026) ────────────────────────────────────────────────
// Seit dem 31.08.2026 verweigert `wahlPruefen` eine national geschriebene Nummer
// ohne Land, statt „+49" zu raten. Belegt war der Schaden im Anrufprotokoll:
// Kunde Maurizio Pampanini (Winkel, CH), Nummer 0797435749 — eine gültige
// SCHWEIZER Mobilnummer. Gewählt wurde dreimal +49797435749.
//
// Die Verweigerung ist richtig und macht 18 Kunden unanrufbar. Dieser Prüfstand
// zeigt, dass der Weg heraus funktioniert — und dass die Sperre bleibt, solange
// niemand ihn geht.
//
// ── WAS HIER GEPRÜFT WIRD ─────────────────────────────────────────────────
//   1. Ohne Land: nicht wählbar (die Sperre steht).
//   2. Land ergänzt: sofort wählbar, und zwar mit der RICHTIGEN Vorwahl.
//   3. Der Vorschlag: aus PLZ/Ort abgeleitet, aber nie automatisch gesetzt.
//   4. Der Filter findet genau diese Kunden, der Zähler stimmt.
//
// ALLES IN EINER TRANSAKTION, DIE AM ENDE ZURÜCKGEROLLT WIRD.
//
//   npx tsx scripts/pruef-nummer-nachtrag.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { sqlPool } from "../server/lib/db-pool";
import { waehlbareNummer } from "../server/lib/fiaon-telefon";
import { wahlPruefen, vorwahlFuerLand } from "../server/lib/fiaon-softphone";
import { landVorschlag } from "../server/routes/fiaon-agent-kunden";

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

class Zurueckrollen extends Error {}
const stempel = Date.now().toString(36).toUpperCase();

async function main(): Promise<void> {
  log("\n══ Prüfstand: Nummer ohne Land ══");

  // ── DER BESTAND ─────────────────────────────────────────────────────────
  gruppe("1. Der Bestand: wie viele sind es?");
  const [z] = (await sqlPool`
    SELECT COUNT(*)::int AS ohne_land
    FROM fiaon_persons
    WHERE merged_into_person_id IS NULL AND ist_test_am IS NULL
      AND COALESCE(primary_phone, '') LIKE '0%'
      AND COALESCE(primary_phone, '') NOT LIKE '00%'
      AND COALESCE(NULLIF(TRIM(country), ''), '') = ''
  `) as any[];
  log(`  ${String(z.ohne_land).padStart(5)}  Kunden mit nationaler Nummer und ohne Land`);
  ok("Die Zählung läuft", Number.isFinite(Number(z.ohne_land)));

  try {
    await sqlPool.begin(async (tx) => {
      // ── DREI PRÜFFÄLLE, EINER JE LAND ────────────────────────────────────
      // Der ungünstigste Fall, nicht der erstbeste: Eine SCHWEIZER Nummer, bei
      // der der alte Rat „+49" eine gültige deutsche Nummer erzeugt hätte —
      // also genau der Fall, der niemandem auffällt.
      const anlegen = async (o: {
        marke: string; nummer: string; plz?: string; ort?: string;
      }) => {
        const [p] = (await tx`
          INSERT INTO fiaon_persons (person_ref, kind, account_status, priority_tier,
                                     first_name, last_name, primary_phone, zip, city, created_at)
          VALUES (${`FIAON-P-PNN${stempel}${o.marke}`}, 'private', 'pending', 2,
                  'Prüf', ${`Nummer${stempel}`}, ${o.nummer},
                  ${o.plz ?? null}, ${o.ort ?? null}, NOW())
          RETURNING id, primary_phone, country, zip, city
        `) as any[];
        return p;
      };

      const ch = await anlegen({ marke: "CH", nummer: "0797435749", plz: "8185", ort: "Winkel" });
      const at = await anlegen({ marke: "AT", nummer: "06649280033", plz: "1010", ort: "Wien" });
      const de = await anlegen({ marke: "DE", nummer: "01761234567", plz: "10115", ort: "Berlin" });
      const unklar = await anlegen({ marke: "XX", nummer: "0664111222", plz: "4020" });

      // ═══════════════════════════════════════════════════════════════════
      gruppe("2. Ohne Land: die Sperre steht");
      // ═══════════════════════════════════════════════════════════════════
      for (const [name, p] of [["CH-Fall", ch], ["AT-Fall", at], ["DE-Fall", de]] as const) {
        const w = waehlbareNummer([{ nummer: p.primary_phone }], p.country);
        ok(`${name}: über die Karte NICHT wählbar`, w.waehlbar === null,
          `waehlbar = ${w.waehlbar}`);
        ok(`${name}: mit Hinweis auf die fehlende Vorwahl`,
          !!w.hinweis && /Vorwahl/i.test(w.hinweis), `hinweis = ${w.hinweis}`);
        const pr = await wahlPruefen(String(p.primary_phone), tx as any, null);
        ok(`${name}: über die Tastatur ABGELEHNT`, !pr.erlaubt, `grund = ${pr.grund}`);
      }

      // ═══════════════════════════════════════════════════════════════════
      gruppe("3. Land ergänzt: sofort wählbar, mit der RICHTIGEN Vorwahl");
      // ═══════════════════════════════════════════════════════════════════
      const faelle: [string, any, string, string][] = [
        ["CH", ch, "CH", "+41797435749"],
        ["AT", at, "AT", "+436649280033"],
        ["DE", de, "DE", "+491761234567"],
      ];
      for (const [name, p, land, erwartet] of faelle) {
        await tx`UPDATE fiaon_persons SET country = ${land} WHERE id = ${p.id}`;
        const [neu] = (await tx`
          SELECT primary_phone, country FROM fiaon_persons WHERE id = ${p.id}
        `) as any[];
        const w = waehlbareNummer([{ nummer: neu.primary_phone }], neu.country);
        gleich(`${name}: die Karte wählt ${erwartet}`, w.waehlbar, erwartet);
        const pr = await wahlPruefen(String(neu.primary_phone), tx as any, neu.country);
        ok(`${name}: die Tastatur erlaubt es`, pr.erlaubt, `grund = ${pr.grund}`);
        gleich(`${name}: … mit derselben Nummer`, pr.nummer, erwartet);
        ok(`${name}: beide Wege stimmen überein`, w.waehlbar === pr.nummer,
          `Karte ${w.waehlbar}, Tastatur ${pr.nummer}`);
      }

      // ── DIE ENTSCHEIDENDE ZEILE ────────────────────────────────────────
      // Der CH-Fall mit dem alten Rat: eine gültige, aber FREMDE Nummer.
      const { nummerNormalisieren } = await import("../server/lib/fiaon-softphone");
      gleich("GEGENPROBE: der alte Rat hätte +49797435749 erzeugt",
        nummerNormalisieren("0797435749", "+49"), "+49797435749");
      ok("… und das ist eine ANDERE Nummer als +41797435749",
        nummerNormalisieren("0797435749", "+49") !== "+41797435749");

      // ═══════════════════════════════════════════════════════════════════
      gruppe("4. Der Vorschlag: hilfreich, aber nie gesetzt");
      // ═══════════════════════════════════════════════════════════════════
      gleich("Winkel → CH", landVorschlag({ zip: "8185", city: "Winkel" }).land, "CH");
      gleich("Wien → AT", landVorschlag({ zip: "1010", city: "Wien" }).land, "AT");
      gleich("Fünfstellige PLZ → DE", landVorschlag({ zip: "10115", city: "Berlin" }).land, "DE");
      gleich("Vierstellig ohne bekannten Ort → kein Vorschlag",
        landVorschlag({ zip: "4020" }).land, "null");
      ok("… und der Grund sagt, warum",
        /vierstellig/i.test(landVorschlag({ zip: "4020" }).grund),
        landVorschlag({ zip: "4020" }).grund);
      ok("Ohne Adresse kein Vorschlag", landVorschlag({}).land === null);

      // Und die WICHTIGSTE Prüfung: Der Vorschlag steht nicht in der Person.
      const [unklarNachher] = (await tx`
        SELECT country FROM fiaon_persons WHERE id = ${unklar.id}
      `) as any[];
      ok("Der Vorschlag wurde NICHT automatisch gespeichert",
        !unklarNachher.country,
        `country = ${unklarNachher.country} — eine geratene Vorwahl ist der Fehler selbst`);

      // ═══════════════════════════════════════════════════════════════════
      gruppe("5. Der Filter findet genau diese Kunden");
      // ═══════════════════════════════════════════════════════════════════
      // Dieselbe Bedingung wie in der Arbeitsliste (fiaon-agent-start.ts).
      const [gefunden] = (await tx`
        SELECT COUNT(*)::int AS n FROM fiaon_persons p
        WHERE p.person_ref LIKE ${`FIAON-P-PNN${stempel}%`}
          AND COALESCE(p.primary_phone, '') LIKE '0%'
          AND COALESCE(p.primary_phone, '') NOT LIKE '00%'
          AND COALESCE(NULLIF(TRIM(p.country), ''), '') = ''
      `) as any[];
      // Drei haben jetzt ein Land, einer nicht.
      gleich("Nach dem Nachtragen bleibt genau einer im Filter", gefunden.n, 1);
      log("         (der Fall mit vierstelliger PLZ ohne erkennbaren Ort —");
      log("          bei ihm gibt es keinen Vorschlag, also bleibt er stehen)");

      // Eine Nummer mit 00 gehört NICHT in den Filter: Das ist die alte
      // Auslandsschreibweise und braucht kein Land.
      const [mit00] = (await tx`
        INSERT INTO fiaon_persons (person_ref, kind, account_status, priority_tier,
                                   first_name, primary_phone, created_at)
        VALUES (${`FIAON-P-PNN${stempel}00`}, 'private', 'pending', 2, 'Prüf',
                '00436601234567', NOW())
        RETURNING id, primary_phone, country
      `) as any[];
      const [imFilter] = (await tx`
        SELECT COUNT(*)::int AS n FROM fiaon_persons
        WHERE id = ${mit00.id}
          AND COALESCE(primary_phone, '') LIKE '0%'
          AND COALESCE(primary_phone, '') NOT LIKE '00%'
      `) as any[];
      gleich("Eine 00-Nummer steht NICHT im Filter", imFilter.n, 0);
      const w00 = waehlbareNummer([{ nummer: mit00.primary_phone }], null);
      gleich("… und ist ohne Land wählbar", w00.waehlbar, "+436601234567");

      gleich("vorwahlFuerLand deckt alle Auswahlwerte ab",
        ["DE", "AT", "CH", "IT", "RO", "SK"].every((l) => !!vorwahlFuerLand(l)), "true");

      // ═══════════════════════════════════════════════════════════════════
      gruppe("6. EINE Tafel der Landesvorwahlen, nicht zwei");
      // ═══════════════════════════════════════════════════════════════════
      // Am 31.08.2026 entstand in `fiaon-softphone.ts` eine zweite Tafel. Beim
      // Nachmessen ging sie prompt auseinander: eine kannte SK, die andere RO,
      // keine TR. Zwei Kunden waren dadurch nicht anrufbar — nur wegen der
      // Doppelung. Jetzt liest `vorwahlFuerLand` die Tafel aus fiaon-telefon.ts.
      const { LAND_VORWAHL } = await import("../server/lib/fiaon-telefon");
      for (const l of ["DE", "AT", "CH", "SK", "TR", "UA", "US", "RO", "SI"]) {
        gleich(`${l}: beide Wege nennen dieselbe Vorwahl`,
          vorwahlFuerLand(l), `+${LAND_VORWAHL[l]}`);
      }
      gleich("Ein unbekanntes Kürzel gibt null", vorwahlFuerLand("XX"), "null");

      // ═══════════════════════════════════════════════════════════════════
      gruppe("7. Der Filter ist deckungsgleich mit der Oberfläche");
      // ═══════════════════════════════════════════════════════════════════
      // Die Arbeitsliste filtert in SQL, die Karte entscheidet in TypeScript.
      // Gehen die auseinander, zeigt der Filter andere Leute als die Anzeige —
      // und der Zähler zählt Kunden, die längst anrufbar sind.
      //
      // GEMESSEN: Der erste Entwurf des Filters fragte nach „führende Null ohne
      // Land". Der einzige Kunde, der wirklich nicht anrufbar ist, hat GAR KEINE
      // führende Null — der Filter hätte ihn nicht gefunden.
      const { nichtWaehlbarSql } = await import("../server/lib/fiaon-telefon");
      const sqlTreffer = (await tx.unsafe(`
        SELECT p.id FROM fiaon_persons p
        WHERE p.person_ref LIKE '${`FIAON-P-PNN${stempel}`}%'
          AND ${nichtWaehlbarSql("p")}`)) as any[];
      const alle = (await tx`
        SELECT id, primary_phone, country FROM fiaon_persons
        WHERE person_ref LIKE ${`FIAON-P-PNN${stempel}%`}
          AND COALESCE(primary_phone, '') <> ''
      `) as any[];
      const tsTreffer = alle.filter((x) =>
        !waehlbareNummer([{ nummer: x.primary_phone }], x.country).waehlbar);
      const sqlIds = new Set(sqlTreffer.map((x) => Number(x.id)));
      const tsIds = new Set(tsTreffer.map((x) => Number(x.id)));
      gleich("Der Filter findet dieselbe Anzahl wie die Oberfläche",
        sqlIds.size, tsIds.size);
      ok("… und dieselben Personen",
        [...sqlIds].every((i) => tsIds.has(i)) && [...tsIds].every((i) => sqlIds.has(i)),
        `SQL ${[...sqlIds].join(",")} / TS ${[...tsIds].join(",")}`);

      // Eine internationale Nummer ohne Land ist wählbar und gehört NICHT hinein.
      const [intl] = (await tx`
        INSERT INTO fiaon_persons (person_ref, kind, account_status, priority_tier,
                                   first_name, primary_phone, created_at)
        VALUES (${`FIAON-P-PNN${stempel}INT`}, 'private', 'pending', 2, 'Prüf',
                '+436601234567', NOW())
        RETURNING id, primary_phone, country
      `) as any[];
      const [imFilterIntl] = (await tx.unsafe(`
        SELECT COUNT(*)::int AS n FROM fiaon_persons p
        WHERE p.id = ${Number(intl.id)} AND ${nichtWaehlbarSql("p")}`)) as any[];
      gleich("Eine +43-Nummer ohne Land steht NICHT im Filter", imFilterIntl.n, 0);

      throw new Zurueckrollen();
    });
  } catch (e) {
    if (!(e instanceof Zurueckrollen)) throw e;
  }

  gruppe("8. Gegenprobe: nichts zurückgeblieben");
  const [reste] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_persons WHERE person_ref LIKE ${`FIAON-P-PNN${stempel}%`}
  `) as any[];
  gleich("Zurückgerollt: Personen", reste.n, 0);

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
