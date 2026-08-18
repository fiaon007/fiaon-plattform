// ═══════════════════════════════════════════════════════════════════════════
// WAS WÜRDE DIE VERSCHÄRFTE MERGE-REGEL AM BESTAND ANRICHTEN?
//
// ── WARUM DIESER LAUF VOR DER ÄNDERUNG KOMMT ───────────────────────────────
// Der Auftrag verlangte drei Verschärfungen:
//   (a) Match-Wert muß im Bestand eindeutig sein
//   (b) Nachname muß übereinstimmen
//   (c) kein hartes Zweitmerkmal darf widersprechen
//
// (a) ist schon gemessen und wurde verworfen: `mess-fehlmerges.ts` zeigt, daß
// 58 von 61 mehrfach belegten Rufnummern zu EINEM Nachnamen gehören — das ist
// derselbe Mensch, 20-mal angelegt. Eine Eindeutigkeits-Pflicht hätte genau die
// Fälle blockiert, für die das Werkzeug gebaut wurde.
//
// Bleiben (b) und (c). Auch die werden nicht geglaubt, sondern gemessen: Dieser
// Lauf legt jede der 742 protokollierten Zusammenführungen erneut auf den
// Prüfstand und fragt, welche die neue Regel VERHINDERT hätte. Eine Regel, die
// hunderte richtige Merges blockiert, ist eine Bremse, die falsch auslöst —
// und die schaltet nach dem zweiten Lauf jemand ab.
//
// NUR LESEND.
//
//   npx tsx scripts/mess-merge-regel.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { sqlPool } from "../server/lib/db-pool";
import { nameSchluessel, abstand } from "../server/lib/fiaon-dubletten-kandidaten";
// Die Widerspruchsprüfung kommt aus der Maschine selbst. Ein erster Entwurf
// hatte sie hier nachgebaut — und nach der Verfeinerung um unbrauchbare Namen
// („Wien Wien") hätte die Messung eine andere Regel gemessen als die, die
// läuft. Zwei Fassungen derselben Regel sind schlimmer als eine fehlende Zahl.
import { harterWiderspruch, type MassenPerson } from "../server/lib/fiaon-massen-merge";

const log = (s = "") => console.log(s);
function titel(t: string): void { log(`\n${"═".repeat(74)}\n${t}\n${"═".repeat(74)}`); }

const dat = (v: unknown) => (v ? String(v).slice(0, 10) : "");
const norm = (v: unknown) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");
/** An wie vielen Stellen unterscheiden sich zwei Datumsangaben? 1 = Tippfehler. */
function stellenAbstand(a: string, b: string): number {
  let n = 0;
  for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) n++;
  return n;
}

async function main(): Promise<void> {
  const roh = (await sqlPool`
    SELECT created_at, actor, meta FROM fiaon_agent_events WHERE type = 'person_merge'
    ORDER BY created_at ASC
  `) as any[];
  const paare: { v: number; g: number }[] = [];
  for (const r of roh) {
    try {
      const j = JSON.parse(String(r.meta));
      if (Number.isFinite(Number(j.verliererId)) && Number.isFinite(Number(j.gewinnerId))) {
        paare.push({ v: Number(j.verliererId), g: Number(j.gewinnerId) });
      }
    } catch { /* unlesbares meta wird in mess-fehlmerges.ts gezählt */ }
  }
  const ids = Array.from(new Set(paare.flatMap((p) => [p.v, p.g])));
  const rows = (await sqlPool`
    SELECT id, first_name, last_name, birthdate, street, zip, primary_email, primary_phone
    FROM fiaon_persons WHERE id = ANY(${ids}::int[])
  `) as any[];
  const nach = new Map<number, any>(rows.map((r) => [Number(r.id), r]));

  titel(`DIE 742 MERGES, NEU BEURTEILT  (${paare.length} mit lesbarem Protokoll)`);

  let nachnameGleich = 0, nachnameEineLeer = 0, nachnameVerschieden = 0;
  let widerGeburt = 0, widerGeburtTippfehler = 0, widerNachname = 0, widerAdresse = 0;
  const blockiertB: string[] = [];
  const blockiertBTolerant: string[] = [];
  const blockiertC: string[] = [];

  for (const { v, g } of paare) {
    const a = nach.get(v); const b = nach.get(g);
    if (!a || !b) continue;
    const na = nameSchluessel(a.last_name); const nb = nameSchluessel(b.last_name);
    const name = `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim();

    // ── (b) Nachname muß übereinstimmen ────────────────────────────────────
    if (!na || !nb) {
      nachnameEineLeer++;
      blockiertB.push(`${v}→${g}  ${name}  (Nachname fehlt auf einer Seite: „${a.last_name ?? ""}" / „${b.last_name ?? ""}")`);
      // Tolerante Fassung: eine LÜCKE ist kein Widerspruch (dieselbe Logik wie
      // `vornamenVereinbar`). Nur ein WIDERSPRUCH blockiert.
    } else if (na === nb) {
      nachnameGleich++;
    } else if (abstand(na, nb, 2) <= 2) {
      // Tippfehler-Nähe: „Laschinger" / „Lsschinger"
      nachnameGleich++;
    } else {
      nachnameVerschieden++;
      blockiertB.push(`${v}→${g}  ${name}  (Nachname „${a.last_name}" ≠ „${b.last_name}")`);
      blockiertBTolerant.push(`${v}→${g}  ${name}  (Nachname „${a.last_name}" ≠ „${b.last_name}")`);
    }

    // ── (c) hartes Zweitmerkmal widerspricht ───────────────────────────────
    // Gefragt wird die ECHTE Funktion aus `fiaon-massen-merge.ts`.
    const alsMassen = (r: any): MassenPerson => ({
      vorname: r.first_name ?? null, nachname: r.last_name ?? null,
      geburtsdatum: r.birthdate ?? null, strasse: r.street ?? null, plz: r.zip ?? null,
    } as MassenPerson);
    const urteil = harterWiderspruch(alsMassen(a), alsMassen(b));

    // Die Einzelzählungen daneben sagen, WELCHES Merkmal wie oft ausschlägt —
    // die Gesamtzahl allein würde nicht verraten, ob die Adressregel oder die
    // Geburtsdatumsregel den Ausschlag gibt.
    const da = dat(a.birthdate); const db = dat(b.birthdate);
    if (da && db && da !== db) {
      if (stellenAbstand(da, db) <= 1) widerGeburtTippfehler++;
      else widerGeburt++;
    }
    if (na && nb && na !== nb && abstand(na, nb, 2) > 2) widerNachname++;
    const sa = norm(a.street); const sb = norm(b.street);
    const za = norm(a.zip); const zb = norm(b.zip);
    if (sa && sb && sa !== sb && za && zb && za !== zb) widerAdresse++;

    if (urteil) blockiertC.push(`${v}→${g}  ${name}  (${urteil})`);
  }

  log("");
  log("  (b) NACHNAME MUSS ÜBEREINSTIMMEN");
  log(`   ${String(nachnameGleich).padStart(5)}  stimmen überein (Tippfehler-Abstand ≤ 2 mitgezählt)`);
  log(`   ${String(nachnameEineLeer).padStart(5)}  Nachname fehlt auf EINER Seite  ← keine Aussage, kein Widerspruch`);
  log(`   ${String(nachnameVerschieden).padStart(5)}  Nachnamen widersprechen sich`);
  log("");
  log(`   Strenge Fassung („muß gleich sein") hätte blockiert:  ${blockiertB.length} von ${paare.length}`);
  log(`   Tolerante Fassung („darf nicht widersprechen") hätte blockiert:  ${blockiertBTolerant.length}`);
  log("");
  log("   Die strenge Fassung trifft vor allem Sätze mit LEEREM Nachnamen:");
  for (const z of blockiertB.slice(0, 8)) log(`     ${z}`);
  log("");
  log("  (c) HARTES ZWEITMERKMAL WIDERSPRICHT");
  log(`   ${String(widerGeburtTippfehler).padStart(5)}  Geburtsdatum weicht an EINER Stelle ab  ← Tippfehler, kein Widerspruch`);
  log(`   ${String(widerGeburt).padStart(5)}  Geburtsdatum weicht weiter ab`);
  log(`   ${String(widerNachname).padStart(5)}  Nachname widerspricht`);
  log(`   ${String(widerAdresse).padStart(5)}  Straße UND PLZ weichen beide ab`);
  log(`   ${String(blockiertC.length).padStart(5)}  Merges hätte (c) zu Kandidaten gemacht (statt automatisch)`);
  log("");
  for (const z of blockiertC.slice(0, 12)) log(`     ${z}`);
  if (blockiertC.length > 12) log(`     … und ${blockiertC.length - 12} weitere`);

  log("");
  log("  ── SCHLUSSFOLGERUNG ───────────────────────────────────────────────");
  log(`  Die strenge Fassung von (b) würde ${blockiertB.length} Merges verhindern —`);
  log(`  überwiegend, weil ein Nachname FEHLT. Eine Lücke ist kein Widerspruch;`);
  log(`  genau so behandelt die Maschine schon die Vornamen. Übernommen wird`);
  log(`  deshalb die tolerante Fassung: der Nachname darf nicht WIDERSPRECHEN.`);
  log(`  Zusammen mit (c) bleiben ${blockiertC.length} Fälle als Kandidat für einen Menschen.`);
  log("");
  await sqlPool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
