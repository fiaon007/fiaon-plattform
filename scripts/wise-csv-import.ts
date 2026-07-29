/**
 * ═══════════════════════════════════════════════════════════════════════════
 * KONTOAUSZUG EINLESEN UND ABGLEICHEN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Liest den aus der Wise-Weboberfläche heruntergeladenen Kontoauszug, ordnet
 * jeden Eingang in Stufen zu und stellt Bank und System gegenüber.
 *
 * WAS DIESES SKRIPT NICHT TUT — und zwar in keinem Lauf:
 *   · Es setzt keine Bestellung auf „bezahlt".
 *   · Es rührt `confirmed_email_sent_at` und die übrigen Versandmerker nicht an.
 *   · Es verschickt keine einzige E-Mail.
 *   · Es bucht keine Provision.
 *
 * Geschrieben wird — und auch das nur mit `--apply` — ausschliesslich in das
 * Bankbuch `fiaon_bank_txns`. Das Verbuchen bleibt ein eigener, ausdrücklicher
 * Schritt. Erst sehen, dann buchen.
 *
 *   npx tsx scripts/wise-csv-import.ts auszug.csv            → nur Bericht
 *   npx tsx scripts/wise-csv-import.ts auszug.csv --apply    → Bankbuch füllen
 *   npx tsx scripts/wise-csv-import.ts auszug.csv --details 40
 *   npx tsx scripts/wise-csv-import.ts auszug.csv --ersatzschluessel
 *
 * Mehrere Zeiträume nacheinander sind vorgesehen: Die Transaktions-ID ist der
 * Schlüssel, bereits bekannte Zeilen werden erkannt und nicht verdoppelt.
 */

import "dotenv/config";
import fs from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import { CsvFehler, entdoppele, leseWiseCsv, type CsvZeile } from "../server/lib/wise-csv";
import { findApp } from "../server/routes/fiaon-reconcile";
import { nameTokens, ordneZu, type Kandidat, type Zuordnung } from "../server/lib/zahlungs-zuordnung";

const args = process.argv.slice(2);
const argWert = (name: string): string | null => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] ?? null : null;
};
const DATEI = args.find((a) => !a.startsWith("--") && a !== argWert("--details")) ?? null;
const APPLY = args.includes("--apply");
const ERSATZ = args.includes("--ersatzschluessel");
const DETAILS = Number(argWert("--details") ?? 25);

const log = (s = "") => console.log(s);
const linie = (z = "─") => log(z.repeat(78));
const eur = (c: number) => `${(c / 100).toFixed(2).replace(".", ",")} €`;
const pad = (s: unknown, n: number) => String(s).padStart(n);

async function main(): Promise<void> {
  if (!DATEI) {
    console.error("Aufruf: npx tsx scripts/wise-csv-import.ts <auszug.csv> [--apply] [--details N] [--ersatzschluessel]");
    process.exit(1);
  }
  if (!fs.existsSync(DATEI)) {
    console.error(`Datei nicht gefunden: ${DATEI}`);
    process.exit(1);
  }

  // ── Lesen ─────────────────────────────────────────────────────────────────
  const roh = fs.readFileSync(DATEI, "utf8");
  let befund;
  try {
    befund = leseWiseCsv(roh, { ersatzschluessel: ERSATZ });
  } catch (err) {
    log();
    if (err instanceof CsvFehler) {
      console.error("❌ Der Kontoauszug konnte nicht gelesen werden.\n");
      console.error(err.message);
    } else {
      console.error("❌ Unerwarteter Fehler beim Lesen:", err);
    }
    log("\nEs wurde nichts verändert.");
    await sqlPool.end();
    process.exit(1);
  }

  log();
  log("KONTOAUSZUG — LESEN UND ABGLEICHEN");
  linie("═");
  log(`Datei .......................... ${DATEI}`);
  log(`Trennzeichen ................... ${befund.trennzeichen === "\t" ? "Tabulator" : `„${befund.trennzeichen}"`}`);
  log();
  log("Erkannte Spalten:");
  for (const [feld, s] of Object.entries(befund.spalten)) {
    log(`  ${feld.padEnd(15)} ${s ? `„${s.kopf}"` : "— nicht vorhanden"}`);
  }
  if (!befund.spalten.absenderKonto) {
    log("  Hinweis: Ohne Absender-IBAN entfällt Zuordnungsstufe 2. Kein Fehler,");
    log("           es bleiben Referenz, Name und Betrag.");
  }

  const { eindeutig: eingaenge, doppelt } = entdoppele(befund.eingaenge);
  const summe = (l: CsvZeile[]) => l.reduce((s, z) => s + z.amountCents, 0);

  log();
  log("Was in der Datei steht:");
  log(`  Datenzeilen .................. ${pad(befund.datenzeilen, 5)}`);
  log(`  Eingänge ..................... ${pad(eingaenge.length, 5)} · ${eur(summe(eingaenge))}`);
  log(`  Ausgänge (bleiben aussen vor)  ${pad(befund.ausgaenge.length, 5)} · ${eur(summe(befund.ausgaenge))}`);
  log(`  Interne Umbuchungen .......... ${pad(befund.intern.length, 5)} · ${eur(summe(befund.intern))}`);
  log(`  Übersprungen ................. ${pad(befund.uebersprungen.length, 5)}`);
  if (doppelt > 0) log(`  Dubletten in der Datei ....... ${pad(doppelt, 5)} (gleiche Transaktions-ID)`);
  if (befund.ohneDatum > 0) log(`  Ohne lesbares Datum .......... ${pad(befund.ohneDatum, 5)} (Zuordnung geht trotzdem)`);
  if (befund.ersatzschluesselVerwendet > 0) {
    log(`  ⚠️  Ersatzschlüssel gebildet ... ${pad(befund.ersatzschluesselVerwendet, 5)}`);
    log("      Zwei gleiche Zahlungen am selben Tag wären nicht unterscheidbar.");
  }
  if (befund.uebersprungen.length > 0) {
    log();
    log("  Übersprungene Zeilen (jede einzeln benannt):");
    for (const u of befund.uebersprungen.slice(0, DETAILS)) log(`    Zeile ${pad(u.zeileNr, 5)}: ${u.grund}`);
    if (befund.uebersprungen.length > DETAILS) log(`    … und ${befund.uebersprungen.length - DETAILS} weitere`);
  }

  if (eingaenge.length === 0) {
    log("\nKein einziger Eingang in der Datei. Nichts zu tun.");
    await sqlPool.end();
    return;
  }

  // ── Ist-Stand im System ───────────────────────────────────────────────────
  const roh2 = await sqlPool`
    SELECT ref, payment_reference, amount_due, payment_status, iban, email, person_id, created_at,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', first_name, last_name)), ''), contact_name, company_name, email) AS name
    FROM fiaon_applications
    WHERE merged_into IS NULL AND gdpr_deleted_at IS NULL
  `;
  const kandidaten: Kandidat[] = roh2.map((r: any) => ({
    ref: r.ref,
    paymentReference: r.payment_reference,
    sollCents: Math.round(Number(r.amount_due || 0) * 100),
    paymentStatus: String(r.payment_status || ""),
    name: String(r.name || ""),
    email: r.email,
    iban: r.iban,
    personId: r.person_id != null ? Number(r.person_id) : null,
    createdAt: r.created_at ? new Date(r.created_at) : null,
  }));
  const nachRef = new Map(kandidaten.map((k) => [k.ref, k]));
  const bezahlte = kandidaten.filter((k) => k.paymentStatus === "paid");
  const behauptet = kandidaten.filter((k) => k.paymentStatus === "claimed_paid");

  // Vorfilter, sonst läuft jeder Eingang gegen alle Zeilen.
  const nachPraefix = new Map<string, Kandidat[]>();
  const nachBetrag = new Map<number, Kandidat[]>();
  for (const k of kandidaten) {
    for (const t of new Set(nameTokens(k.name).map((x) => x.slice(0, 3)))) {
      const arr = nachPraefix.get(t) ?? [];
      arr.push(k);
      nachPraefix.set(t, arr);
    }
    const arr = nachBetrag.get(k.sollCents) ?? [];
    arr.push(k);
    nachBetrag.set(k.sollCents, arr);
  }
  const vorfilter = (z: CsvZeile): Kandidat[] => {
    const menge = new Set<Kandidat>();
    for (const p of new Set(nameTokens(z.payerName).map((x) => x.slice(0, 3)))) {
      for (const k of nachPraefix.get(p) ?? []) menge.add(k);
    }
    for (const k of nachBetrag.get(z.amountCents) ?? []) menge.add(k);
    return [...menge];
  };
  const refSuche = async (ref: string) => {
    const app = await findApp(ref);
    return app ? { ref: app.ref, personId: null } : null;
  };

  // ── Zuordnen ──────────────────────────────────────────────────────────────
  log();
  log(`Ordne ${eingaenge.length} Eingänge zu …`);
  const paare: Array<{ z: CsvZeile; zu: Zuordnung }> = [];
  for (const z of eingaenge) {
    const zu = await ordneZu(
      {
        amountCents: z.amountCents,
        payerName: z.payerName,
        senderAccount: z.senderAccount,
        referenceRaw: z.referenceRaw,
      },
      vorfilter(z),
      refSuche,
    );
    paare.push({ z, zu });
  }

  const nachMethode = new Map<string, { n: number; cents: number }>();
  for (const { z, zu } of paare) {
    const e = nachMethode.get(zu.methode) ?? { n: 0, cents: 0 };
    e.n++;
    e.cents += z.amountCents;
    nachMethode.set(zu.methode, e);
  }

  const BESCHRIFTUNG: Record<string, string> = {
    referenz: "Referenz im Zweck (sicher)",
    iban: "Absender-IBAN (sicher)",
    name_betrag: "Name + Betrag eindeutig (hoch)",
    vorschlag: "Vorschlag — Mensch entscheidet",
    offen: "Kein Kandidat",
  };

  log();
  log("ZUORDNUNG IN STUFEN");
  linie();
  for (const stufe of ["referenz", "iban", "name_betrag", "vorschlag", "offen"]) {
    const e = nachMethode.get(stufe) ?? { n: 0, cents: 0 };
    log(`  ${BESCHRIFTUNG[stufe].padEnd(34)} ${pad(e.n, 5)} · ${eur(e.cents)}`);
  }
  const automatisch = paare.filter((p) => p.zu.automatisch);
  const quote = eingaenge.length > 0 ? Math.round((automatisch.length / eingaenge.length) * 100) : 0;
  log();
  log(`  Sicher zuordenbar .................. ${pad(automatisch.length, 5)} von ${eingaenge.length} (${quote} %)`);
  log(`  Der bisherige Weg schaffte ......... ${pad(9, 5)} von 100`);

  // ── Die vier Kategorien ───────────────────────────────────────────────────
  const zugeordneteRefs = new Map<string, number>();
  for (const { z, zu } of paare) {
    if (zu.ref) zugeordneteRefs.set(zu.ref, (zugeordneteRefs.get(zu.ref) ?? 0) + z.amountCents);
  }

  const katA = paare.filter((p) => p.zu.ref && nachRef.get(p.zu.ref)?.paymentStatus === "paid");
  const katB = paare.filter((p) => p.zu.ref && nachRef.get(p.zu.ref)?.paymentStatus !== "paid");
  const katC = bezahlte.filter((k) => !zugeordneteRefs.has(k.ref));
  const katD = paare.filter((p) => !p.zu.ref);

  log();
  log("BANK GEGEN SYSTEM — DIE VIER FÄLLE");
  linie("═");
  log(`  1 · Geld da, System sagt bezahlt ....... ${pad(katA.length, 5)} · ${eur(summe(katA.map((p) => p.z)))}`);
  log("      Stimmt überein. Nichts zu tun.");
  log(`  2 · Geld da, System sagt NICHT bezahlt . ${pad(katB.length, 5)} · ${eur(summe(katB.map((p) => p.z)))}`);
  log("      Diese Kunden haben bezahlt und gelten im System als offen.");
  log("      Sie werden gemahnt und stehen in den Agentenlisten. Das ist der Schaden.");
  log(`  3 · System sagt bezahlt, kein Geld ..... ${pad(katC.length, 5)} · Soll ${eur(katC.reduce((s, k) => s + k.sollCents, 0))}`);
  log("      Als bezahlt geführt, ohne Beleg im Kontoauszug.");
  log(`  4 · Geld da, niemand zuzuordnen ........ ${pad(katD.length, 5)} · ${eur(summe(katD.map((p) => p.z)))}`);
  log("      Prüfliste für den Menschen.");

  // ── Die Frage nach den „bezahlt"-Markierungen ─────────────────────────────
  const mitBeleg = bezahlte.filter((k) => zugeordneteRefs.has(k.ref));
  log();
  log("HABEN DIE „BEZAHLT\"-MARKIERUNGEN EINEN ECHTEN BANKEINGANG?");
  linie("═");
  log(`  Als bezahlt geführt ............ ${pad(bezahlte.length, 5)} · Soll ${eur(bezahlte.reduce((s, k) => s + k.sollCents, 0))}`);
  log(`    mit Beleg im Auszug .......... ${pad(mitBeleg.length, 5)}`);
  log(`    OHNE Beleg im Auszug ......... ${pad(katC.length, 5)}`);
  if (bezahlte.length > 0) {
    log(`    Belegquote ................... ${pad(Math.round((mitBeleg.length / bezahlte.length) * 100), 5)} %`);
  }
  log();
  log("  Wichtig zur Einordnung: „ohne Beleg\" heisst nicht „hat nicht bezahlt\".");
  log("  Es heisst nur, dass in DIESER Datei kein passender Eingang steht. Deckt der");
  log("  Auszug nicht den gesamten Zeitraum ab, ist die Zahl erwartungsgemäß hoch.");
  if (befund.ohneDatum < eingaenge.length) {
    const daten = eingaenge.map((z) => z.bookedAt).filter(Boolean) as Date[];
    if (daten.length > 0) {
      const von = new Date(Math.min(...daten.map((d) => d.getTime())));
      const bis = new Date(Math.max(...daten.map((d) => d.getTime())));
      log(`  Diese Datei deckt ab: ${von.toISOString().slice(0, 10)} bis ${bis.toISOString().slice(0, 10)}.`);
    }
  }

  log();
  log(`  Zusätzlich: „Kunde sagt bezahlt\" ... ${pad(behauptet.length, 5)}`);
  const behauptetBelegt = behauptet.filter((k) => zugeordneteRefs.has(k.ref));
  log(`    davon mit Beleg im Auszug .... ${pad(behauptetBelegt.length, 5)} → hat wirklich bezahlt`);
  log(`    ohne Beleg ................... ${pad(behauptet.length - behauptetBelegt.length, 5)} → offen, gehört auf die Admin-Liste`);

  // ── Details zum Nachsehen ─────────────────────────────────────────────────
  if (katB.length > 0) {
    log();
    log(`FALL 2 IM EINZELNEN — bezahlt, aber im System offen (max. ${DETAILS})`);
    linie();
    for (const { z, zu } of katB.slice(0, DETAILS)) {
      const k = nachRef.get(zu.ref!);
      log(`  ${(z.bookedAt?.toISOString().slice(0, 10) ?? "—").padEnd(11)} ${pad(eur(z.amountCents), 11)}  ${(k?.name ?? "").slice(0, 26).padEnd(26)} ${k?.paymentStatus ?? ""}`);
      log(`              ${zu.begruendung}`);
    }
    if (katB.length > DETAILS) log(`  … und ${katB.length - DETAILS} weitere`);
  }

  if (katD.length > 0) {
    log();
    log(`FALL 4 IM EINZELNEN — Prüfliste (max. ${DETAILS})`);
    linie();
    for (const { z, zu } of katD.slice(0, DETAILS)) {
      log(`  ${(z.bookedAt?.toISOString().slice(0, 10) ?? "—").padEnd(11)} ${pad(eur(z.amountCents), 11)}  ${(z.payerName ?? "—").slice(0, 26).padEnd(26)} ${(z.referenceRaw ?? "").slice(0, 30)}`);
      for (const v of zu.vorschlaege) log(`              Vorschlag: ${v.name} — ${v.begruendung}`);
    }
    if (katD.length > DETAILS) log(`  … und ${katD.length - DETAILS} weitere`);
  }

  // ── Bankbuch schreiben ────────────────────────────────────────────────────
  const bekannt = new Set<string>(
    (await sqlPool`SELECT txn_id FROM fiaon_bank_txns WHERE txn_id IS NOT NULL`.catch(() => []))
      .map((r: any) => String(r.txn_id)),
  );
  const neu = eingaenge.filter((z) => !bekannt.has(z.txnId));

  log();
  log("BANKBUCH");
  linie("═");
  log(`  Bereits bekannt (gleiche ID) ... ${pad(eingaenge.length - neu.length, 5)}`);
  log(`  Neu ............................ ${pad(neu.length, 5)}`);

  if (!APPLY) {
    log();
    log("  PROBELAUF — es wurde nichts geschrieben.");
    log("  Mit --apply werden die Eingänge in fiaon_bank_txns aufgenommen.");
    log("  Auch dann gilt: keine Bestellung wird auf bezahlt gesetzt, keine E-Mail geht raus.");
    await sqlPool.end();
    return;
  }

  let geschrieben = 0;
  for (const { z, zu } of paare) {
    const status = zu.automatisch ? "matched" : "unmatched";
    const betragOk = zu.betragPasst;
    const erkannt = zu.ref ?? null;
    await sqlPool`
      INSERT INTO fiaon_bank_txns
        (txn_id, booked_at, amount_cents, currency, payer_name, reference_raw,
         extracted_ref, matched_ref, match_status, amount_ok, note)
      VALUES
        (${z.txnId}, ${z.bookedAt}, ${z.amountCents}, ${z.currency}, ${z.payerName},
         ${z.referenceRaw}, ${erkannt}, ${zu.automatisch ? erkannt : null}, ${status},
         ${betragOk}, ${zu.begruendung})
      ON CONFLICT (txn_id) DO UPDATE SET
        amount_cents  = EXCLUDED.amount_cents,
        currency      = EXCLUDED.currency,
        payer_name    = EXCLUDED.payer_name,
        reference_raw = EXCLUDED.reference_raw,
        extracted_ref = EXCLUDED.extracted_ref,
        -- Eine von Hand gesetzte oder bereits verbuchte Zuordnung ist mehr wert
        -- als jede Automatik. Sie wird nie überschrieben.
        matched_ref = CASE WHEN fiaon_bank_txns.match_status IN ('manual','ignored') OR fiaon_bank_txns.applied
                           THEN fiaon_bank_txns.matched_ref ELSE EXCLUDED.matched_ref END,
        match_status = CASE WHEN fiaon_bank_txns.match_status IN ('manual','ignored') OR fiaon_bank_txns.applied
                            THEN fiaon_bank_txns.match_status ELSE EXCLUDED.match_status END,
        amount_ok   = EXCLUDED.amount_ok,
        note        = EXCLUDED.note,
        updated_at  = NOW()
    `;
    geschrieben++;
  }

  log();
  log(`  ${geschrieben} Eingänge ins Bankbuch geschrieben.`);
  log("  Keine Bestellung wurde auf bezahlt gesetzt. Keine E-Mail verschickt.");
  log("  Weiter unter /admin/kontoabgleich: prüfen und verbuchen.");

  await sqlPool.end();
}

main().catch(async (err) => {
  console.error("\n❌ Fehler:", err?.message || err);
  await sqlPool.end().catch(() => {});
  process.exit(1);
});
