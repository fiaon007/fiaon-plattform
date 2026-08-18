// ═══════════════════════════════════════════════════════════════════════════
// DAS DOPPELPRÄFIX +49 +49 — WO ENTSTEHT ES, UND WIE OFT?
//
// ── DIE MELDUNG (Team, 30.08.2026) ─────────────────────────────────────────
// „Im Inkasso steht +49 +49 vor der Nummer. Im Vertrieb ist sie richtig."
//
// ── DER UNTERSCHIED ZWISCHEN DEN ZWEI ANSICHTEN ────────────────────────────
// Der Vertrieb bekommt vom Server ein Feld `telefonWaehlbar`, das durch
// `waehlbareNummer` (server/lib/fiaon-telefon.ts) gelaufen ist. Das Inkasso
// bekommt die ROHWERTE `phone` und `phone_country_code` und setzt sie in der
// Oberfläche selbst zusammen:
//
//     ${f.phone_country_code || "+49"}${String(f.phone).replace(/^0/, "")}
//
// Steht in `phone` schon „+491711790779" und in `phone_country_code` „+49",
// ergibt das „+49+491711790779". Das `replace(/^0/)` greift nicht, weil die
// Nummer mit „+" beginnt und nicht mit einer Null.
//
// Dieser Lauf misst deshalb ZWEI Dinge getrennt:
//   1. Wie viele Zeilen würden in der Inkasso-Ansicht ein Doppelpräfix zeigen?
//      (Das ist ein ANZEIGEFEHLER — die Daten sind in Ordnung.)
//   2. Wie viele ROHWERTE tragen selbst schon ein Doppelpräfix?
//      (Das ist ein DATENFEHLER — der muss bereinigt werden.)
//
// Die Unterscheidung ist der ganze Punkt: Würde man nur die Daten bereinigen,
// bliebe die Anzeige falsch. Würde man nur die Anzeige reparieren, bliebe die
// kaputte Nummer in der Datenbank und die nächste Ansicht fällt darauf herein.
//
// NUR LESEND.
//
//   npx tsx scripts/mess-doppelpraefix.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import { waehlbareNummer } from "../server/lib/fiaon-telefon";

const log = (s = "") => console.log(s);
function titel(t: string): void { log(`\n${"═".repeat(74)}\n${t}\n${"═".repeat(74)}`); }
const feld = (v: unknown): string => {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * Die Zusammensetzung, die die Inkasso-Ansicht heute macht — nachgebaut, damit
 * gemessen wird, was ein Mensch WIRKLICH sieht, und nicht, was richtig wäre.
 */
function wieInkassoEsBaut(phone: string | null, vorwahl: string | null): string | null {
  if (!phone) return null;
  return `${vorwahl || "+49"}${String(phone).replace(/^0/, "")}`;
}

/** Trägt eine Zeichenkette mehr als ein „+" oder eine doppelte Ländervorwahl? */
function istDoppelpraefix(s: string | null): boolean {
  if (!s) return false;
  if ((s.match(/\+/g) ?? []).length > 1) return true;
  const d = s.replace(/\D/g, "");
  // +4949…, +4343…, +4141… — dieselbe Vorwahl zweimal hintereinander.
  return /^(49|43|41)\1/.test(d);
}

async function main(): Promise<void> {
  mkdirSync("reports", { recursive: true });

  // ═════════════════════════════════════════════════════════════════════════
  titel("1. WAS DIE INKASSO-ANSICHT ZEIGT — der Anzeigefehler");
  // ═════════════════════════════════════════════════════════════════════════
  // Genau die Zeilen, die im Inkasso auflaufen: offene Raten mit ihrer
  // Bestellung. Dieselbe Verbindung wie in `inkassoListe`.
  const inkassoZeilen = (await sqlPool`
    SELECT DISTINCT a.ref, a.phone, a.phone_country_code, a.person_id,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)), ''),
                    a.contact_name, a.email) AS name
    FROM fiaon_abo_raten r
    JOIN fiaon_applications a ON a.ref = r.ref
    WHERE r.status <> 'bezahlt' AND r.storniert_am IS NULL
  `) as any[];

  let inkassoKaputt = 0;
  let inkassoUnwaehlbar = 0;
  const beispiele: any[] = [];
  for (const z of inkassoZeilen) {
    const gebaut = wieInkassoEsBaut(z.phone, z.phone_country_code);
    const richtig = waehlbareNummer([{ nummer: z.phone, vorwahl: z.phone_country_code }]).waehlbar;
    if (istDoppelpraefix(gebaut)) {
      inkassoKaputt++;
      if (beispiele.length < 12) {
        beispiele.push({ ref: z.ref, name: z.name, phone: z.phone, vw: z.phone_country_code, gebaut, richtig });
      }
    } else if (gebaut && !richtig) {
      inkassoUnwaehlbar++;
    }
  }
  log(`  ${String(inkassoZeilen.length).padStart(6)}  Zeilen stehen im Forderungsmanagement (offene Raten)`);
  log(`  ${String(inkassoKaputt).padStart(6)}  davon zeigen ein DOPPELPRÄFIX  ← der gemeldete Fehler`);
  log(`  ${String(inkassoUnwaehlbar).padStart(6)}  weitere sind gar nicht wählbar (Vorwahl fehlt wirklich)`);
  if (beispiele.length > 0) {
    log("");
    log("  Beispiele (Rohwert → was das Inkasso baut → was richtig wäre):");
    for (const b of beispiele) {
      log(`   ${String(b.name ?? "").slice(0, 22).padEnd(24)} phone=${String(b.phone).padEnd(18)} vw=${String(b.vw ?? "—").padEnd(5)}`);
      log(`     ${String(b.gebaut).padEnd(22)} → richtig: ${b.richtig ?? "(nicht wählbar)"}`);
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("2. ROHWERTE MIT DOPPELPRÄFIX — der Datenfehler");
  // ═════════════════════════════════════════════════════════════════════════
  // Hier zählt nur, was WIRKLICH falsch in der Datenbank steht. Ein Rohwert wie
  // „+49+491711790779" ist unabhängig von jeder Anzeige kaputt.
  const rohBestellung = (await sqlPool`
    SELECT ref, person_id, phone, phone_country_code, contact_phone
    FROM fiaon_applications
    WHERE phone ~ '\\+.*\\+' OR contact_phone ~ '\\+.*\\+'
       OR regexp_replace(COALESCE(phone, ''), '\\D', '', 'g') ~ '^(49|43|41)\\1'
       OR regexp_replace(COALESCE(contact_phone, ''), '\\D', '', 'g') ~ '^(49|43|41)\\1'
  `) as any[];
  const rohPerson = (await sqlPool`
    SELECT id, person_ref, primary_phone
    FROM fiaon_persons
    WHERE merged_into_person_id IS NULL
      AND (primary_phone ~ '\\+.*\\+'
           OR regexp_replace(COALESCE(primary_phone, ''), '\\D', '', 'g') ~ '^(49|43|41)\\1')
  `) as any[];

  log(`  ${String(rohBestellung.length).padStart(6)}  Bestellungen mit doppeltem Präfix im Rohwert`);
  log(`  ${String(rohPerson.length).padStart(6)}  Personen mit doppeltem Präfix in primary_phone`);
  for (const r of rohBestellung.slice(0, 10)) {
    log(`   ${r.ref}  phone=„${r.phone}“  vw=„${r.phone_country_code ?? ""}“  contact=„${r.contact_phone ?? ""}“`);
  }
  for (const r of rohPerson.slice(0, 10)) {
    log(`   Person ${r.id} (${r.person_ref})  primary_phone=„${r.primary_phone}“`);
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("3. DIE URSACHE IN DEN DATEN — Vorwahl doppelt vorhanden");
  // ═════════════════════════════════════════════════════════════════════════
  // Das ist die Konstellation, aus der die Anzeige das Doppelpräfix BAUT:
  // Die Nummer trägt die Vorwahl schon, und daneben steht sie noch einmal.
  const [beides] = (await sqlPool`
    SELECT
      COUNT(*) FILTER (WHERE COALESCE(phone, '') <> '' AND COALESCE(phone_country_code, '') <> '')::int AS mit_beidem,
      COUNT(*) FILTER (WHERE phone LIKE '+%' AND COALESCE(phone_country_code, '') <> '')::int AS phone_schon_plus,
      COUNT(*) FILTER (WHERE regexp_replace(COALESCE(phone, ''), '\\D', '', 'g')
                         LIKE regexp_replace(COALESCE(phone_country_code, ''), '\\D', '', 'g') || '%'
                       AND COALESCE(phone_country_code, '') <> ''
                       AND COALESCE(phone, '') <> '')::int AS vorwahl_doppelt
    FROM fiaon_applications
  `) as any[];
  log(`  ${String(beides.mit_beidem).padStart(6)}  Bestellungen haben Nummer UND getrennte Vorwahl`);
  log(`  ${String(beides.phone_schon_plus).padStart(6)}  davon trägt die Nummer schon ein „+“  ← hier baut das Inkasso Unsinn`);
  log(`  ${String(beides.vorwahl_doppelt).padStart(6)}  davon beginnt die Nummer mit denselben Ziffern wie die Vorwahl`);

  // ── CSV für die Bereinigung ──────────────────────────────────────────────
  const kopf = ["quelle", "kennung", "feld", "ist", "vorwahl", "soll"];
  const zeilen: string[] = [];
  for (const r of rohBestellung) {
    for (const f of ["phone", "contact_phone"] as const) {
      const wert = r[f];
      if (!wert || !istDoppelpraefix(String(wert))) continue;
      const soll = waehlbareNummer([{ nummer: wert, vorwahl: null }]).waehlbar;
      zeilen.push(["bestellung", r.ref, f, wert, r.phone_country_code ?? "", soll ?? ""].map(feld).join(";"));
    }
  }
  for (const r of rohPerson) {
    const soll = waehlbareNummer([{ nummer: r.primary_phone, vorwahl: null }]).waehlbar;
    zeilen.push(["person", r.id, "primary_phone", r.primary_phone, "", soll ?? ""].map(feld).join(";"));
  }
  writeFileSync("reports/doppelpraefix.csv", `${kopf.join(";")}\n${zeilen.join("\n")}\n`, "utf8");

  log("");
  log(`  Vorschau: reports/doppelpraefix.csv (${zeilen.length} Zeilen)`);
  log("");
  log("  ── SCHLUSSFOLGERUNG ───────────────────────────────────────────────");
  log(`  Anzeigefehler im Inkasso: ${inkassoKaputt} Zeilen.`);
  log(`  Datenfehler im Bestand:   ${zeilen.length} Werte.`);
  log("  Beide brauchen eine eigene Behandlung — die Anzeige durch EINE");
  log("  Normalisierungsfunktion, der Bestand durch einen Bereinigungslauf.");
  log("");
  await sqlPool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
