// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: DIE INKASSO-ARBEITSLISTE LIEFERT EINE WÄHLBARE NUMMER
//
// ── DIE MELDUNG (Team, 30.08.2026) ─────────────────────────────────────────
// „Im Forderungsmanagement steht +49 +49 vor der Nummer. Im Vertrieb ist sie
// richtig."
//
// ── DIE URSACHE ───────────────────────────────────────────────────────────
// Die Arbeitsliste lieferte nur die Rohwerte, und die Oberfläche setzte die
// Nummer an ZWEI Stellen selbst zusammen:
//
//     ${vorwahl || "+49"}${nummer.replace(/^0/, "")}
//
// Trug die Nummer schon ein Plus, entstand „+43+436642204641". Und der
// Rückfall „+49" hängte eine deutsche Vorwahl an österreichische Nummern —
// das hätte einen FREMDEN Teilnehmer gewählt.
//
// ── WAS HIER GEPRÜFT WIRD ─────────────────────────────────────────────────
// Nicht die Hilfsfunktion allein (die war nie kaputt), sondern die ANTWORT der
// Arbeitsliste — also das, was die Oberfläche wirklich bekommt. Ein Prüfstand
// an `waehlbareNummer` wäre grün geblieben, während der Fehler bestand.
//
// ALLES IN EINER TRANSAKTION, DIE AM ENDE ZURÜCKGEROLLT WIRD.
//
//   npx tsx scripts/pruef-inkasso-nummer.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { sqlPool } from "../server/lib/db-pool";
import { arbeitsliste, arbeitslistePersonen } from "../server/lib/fiaon-inkasso";

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
function gruppe(t: string): void { log(`\n── ${t} ${"─".repeat(Math.max(0, 58 - t.length))}`); }

class Zurueckrollen extends Error {}
const stempel = Date.now().toString(36).toUpperCase();
const REF = (s: string) => `FIAON-PIN${stempel}-${s}`;

/** Trägt eine Zeichenkette mehr als ein Plus oder eine doppelte Vorwahl? */
function istDoppelpraefix(s: string | null): boolean {
  if (!s) return false;
  if ((s.match(/\+/g) ?? []).length > 1) return true;
  return /^(49|43|41)\1/.test(s.replace(/\D/g, ""));
}

async function main(): Promise<void> {
  log("\n══ Prüfstand: Rufnummern im Forderungsmanagement ══");

  try {
    await sqlPool.begin(async (tx) => {
      const person = async (felder: Record<string, unknown>): Promise<number> => {
        const [r] = await tx`
          INSERT INTO fiaon_persons ${tx({
            person_ref: `FIAON-P-PIN${stempel}${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
            kind: "private", account_status: "pending", priority_tier: 2, ...felder,
          } as any)} RETURNING id
        `;
        return Number(r.id);
      };
      const bestellung = async (felder: Record<string, unknown>): Promise<string> => {
        const [r] = await tx`
          INSERT INTO fiaon_applications ${tx({
            type: "private", status: "completed", payment_status: "paid",
            pack_key: "ultra", pack_name: "FIAON Ultra", amount_due: "79.99", ...felder,
          } as any)} RETURNING ref
        `;
        return String(r.ref);
      };
      // Eine überfällige Rate — sonst steht die Zeile nicht in der Arbeitsliste.
      const rate = async (ref: string) => {
        await tx`
          INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents,
                                       faellig_am, status, mahnstufe)
          VALUES (${ref}, 1, ${`PIN-${stempel}`}, 7999,
                  CURRENT_DATE - 30, 'offen', 3)
        `;
      };

      // ── DIE PRÜFFÄLLE: der ungünstigste Fall, nicht der erstbeste ────────
      // Genau die Konstellationen, die im Bestand gemessen wurden.
      const faelle = [
        {
          marke: "AT-MIT-VW",
          titel: "Österreichische Nummer MIT passender getrennter Vorwahl",
          phone: "+436642204641", vorwahl: "+43", land: "AT",
          soll: "+436642204641",
        },
        {
          marke: "AT-OHNE-VW",
          titel: "Österreichische Nummer OHNE getrennte Vorwahl",
          // Der gefährliche Fall: Hier hängte die Oberfläche „+49" davor.
          phone: "+436641924910", vorwahl: null, land: "AT",
          soll: "+436641924910",
        },
        {
          marke: "DE-MIT-VW",
          titel: "Deutsche Nummer mit Plus UND getrennter Vorwahl",
          phone: "+4915770475432", vorwahl: "+49", land: "DE",
          soll: "+4915770475432",
        },
        {
          marke: "DE-NATIONAL",
          titel: "Nationale Schreibweise mit getrennter Vorwahl (Normalfall)",
          phone: "01711790779", vorwahl: "+49", land: "DE",
          soll: "+491711790779",
        },
        {
          marke: "DE-00",
          titel: "Alte Auslandsschreibweise 0049",
          phone: "00491711790780", vorwahl: null, land: "DE",
          soll: "+491711790780",
        },
      ];

      gruppe("1. Jede Konstellation liefert genau eine wählbare Nummer");
      const ids: Record<string, number> = {};
      for (const f of faelle) {
        const pid = await person({
          first_name: "Prüf", last_name: `Nummer${stempel}`,
          primary_phone: f.phone, country: f.land,
        });
        ids[f.marke] = pid;
        const ref = await bestellung({
          ref: REF(f.marke), person_id: pid,
          first_name: "Prüf", last_name: `Nummer${stempel}`,
          phone: f.phone, phone_country_code: f.vorwahl, country: f.land,
        });
        await rate(ref);
      }

      const zeilen = await arbeitsliste({ limit: 200 }, tx as any);
      for (const f of faelle) {
        const z = (zeilen as any[]).find((x) => x.ref === REF(f.marke));
        ok(`${f.titel}: Zeile gefunden`, !!z);
        if (!z) continue;
        gleich(`${f.titel}: wählbare Nummer`, z.telefonWaehlbar, f.soll);
        ok(`${f.titel}: KEIN Doppelpräfix`, !istDoppelpraefix(z.telefonWaehlbar),
          `telefonWaehlbar = „${z.telefonWaehlbar}“`);
        ok(`${f.titel}: Anzeige vorhanden`, !!z.telefonAnzeige, `anzeige = ${z.telefonAnzeige}`);
      }

      gruppe("2. Die Personenkarte wählt dieselbe Nummer wie die Zeile");
      const karten = await arbeitslistePersonen({ limit: 200 }, tx as any);
      for (const f of faelle) {
        const k = (karten as any[]).find((x) => x.personId === ids[f.marke]);
        ok(`${f.titel}: Karte gefunden`, !!k);
        if (!k) continue;
        gleich(`${f.titel}: Karte = Zeile`, k.telefonWaehlbar, f.soll);
      }

      gruppe("3. Ohne Vorwahl und ohne Land: NICHT wählbar, mit Begründung");
      // AGENTS.md: Eine geratene Vorwahl ruft einen fremden Menschen an. Lieber
      // ein ehrlicher Hinweis als ein Anruf beim falschen Teilnehmer. Genau das
      // hat der alte „+49"-Rückfall getan.
      const pidOhne = await person({
        first_name: "Prüf", last_name: `Ohne${stempel}`, primary_phone: "1711790781",
      });
      const refOhne = await bestellung({
        ref: REF("OHNE"), person_id: pidOhne,
        first_name: "Prüf", last_name: `Ohne${stempel}`,
        phone: "1711790781", phone_country_code: null, country: null,
      });
      await rate(refOhne);
      const zeilen2 = await arbeitsliste({ limit: 200 }, tx as any);
      const zOhne = (zeilen2 as any[]).find((x) => x.ref === REF("OHNE"));
      ok("Zeile ohne Vorwahl gefunden", !!zOhne);
      ok("… ist NICHT wählbar", zOhne?.telefonWaehlbar == null,
        `telefonWaehlbar = ${zOhne?.telefonWaehlbar}`);
      ok("… nennt den Grund im Klartext",
        /vorwahl/i.test(String(zOhne?.telefonHinweis ?? "")),
        `hinweis = ${zOhne?.telefonHinweis}`);
      ok("… zeigt die Nummer trotzdem an", !!zOhne?.telefonAnzeige);

      gruppe("4. Kein Rohwert-Zusammenbau mehr in der Oberfläche");
      // Der Quelltext-Teil dieser Prüfung: Die Oberfläche darf die Nummer nicht
      // wieder selbst bauen. Ein reiner Datentest würde das nicht bemerken —
      // jemand könnte die Felder liefern und daneben weiter selbst rechnen.
      const { readFileSync } = await import("node:fs");
      const quelle = readFileSync("client/src/pages/agent/inkasso.tsx", "utf8");
      // ── KOMMENTARE HERAUS, UND ZWAR RICHTIG ─────────────────────────────
      // Erster Entwurf filterte Zeilen, die mit „//" oder „/*" beginnen. Beide
      // Prüfungen wurden rot — an der eigenen Begründung: Die alte Formel steht
      // im JSX-Kommentar darüber, und ein JSX-Kommentar beginnt mit „{/*",
      // nicht mit „/*". Die Fortsetzungszeilen beginnen ohnehin mit Text.
      //
      // AGENTS.md kennt den Fall zweimal („Ein Grep auf die Abwesenheit von
      // Code trifft die Begründung") und die Lehre dazu: Die naheliegende
      // Reaktion wäre, die Begründung zu löschen. Genau falsch — der Kommentar
      // ist der Grund, warum niemand die Formel wieder einbaut.
      //
      // Also werden ganze Blöcke entfernt, nicht Zeilen bewertet.
      const ohneKommentar = quelle
        .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, " ")  // JSX-Kommentare
        .replace(/\/\*[\s\S]*?\*\//g, " ")            // Blockkommentare
        .replace(/^\s*\/\/.*$/gm, " ");               // Zeilenkommentare
      ok("Kein „|| \"+49\"“-Rückfall mehr im Inkasso",
        !/\|\|\s*"\+49"/.test(ohneKommentar));
      ok("Kein handgebautes Zusammensetzen aus phone_country_code",
        !/phone_country_code\s*\|\|/.test(ohneKommentar));
      ok("Die Oberfläche benutzt telefonWaehlbar",
        /telefonWaehlbar/.test(ohneKommentar));

      throw new Zurueckrollen();
    });
  } catch (e) {
    if (!(e instanceof Zurueckrollen)) throw e;
  }

  gruppe("5. Gegenprobe: nichts zurückgeblieben");
  const [reste] = (await sqlPool`
    SELECT (SELECT COUNT(*)::int FROM fiaon_applications WHERE ref LIKE ${`FIAON-PIN${stempel}%`}) AS bestellungen,
           (SELECT COUNT(*)::int FROM fiaon_persons WHERE person_ref LIKE ${`FIAON-P-PIN${stempel}%`}) AS personen,
           (SELECT COUNT(*)::int FROM fiaon_abo_raten WHERE zahlungsreferenz = ${`PIN-${stempel}`}) AS raten
  `) as any[];
  gleich("Zurückgerollt: Bestellungen", reste.bestellungen, 0);
  gleich("Zurückgerollt: Personen", reste.personen, 0);
  gleich("Zurückgerollt: Raten", reste.raten, 0);

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
