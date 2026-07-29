/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WISE PHASE 0 — DIE WAHRHEIT HOLEN (schreibt NICHTS)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Holt die vollständige Umsatzhistorie live bei Wise, ordnet jeden Eingang zu
 * und stellt ihn dem gegenüber, was im System steht. Am Ende stehen vier
 * Zahlen, die der Betreiber wirklich braucht:
 *
 *   1 · STIMMT              — Geld da, korrekt verbucht
 *   2 · FEHLT IM SYSTEM     — Geld da, nicht verbucht  ← das verlorene Geld
 *   3 · IM SYSTEM, KEIN GELD— als bezahlt geführt, kein Eingang auffindbar
 *   4 · NICHT ZUORDENBAR    — Eingang ohne sicheren Treffer, mit Vorschlägen
 *
 * Dieses Skript ist ABSICHTLICH ohne jeden Schreibzugriff: keine Buchung, kein
 * Status, keine E-Mail, keine Provision. Es darf gefahrlos jederzeit laufen.
 *
 * VERWENDUNG
 *   npx tsx scripts/wise-phase0.ts                  → voller Bericht
 *   npx tsx scripts/wise-phase0.ts --von 2024-01-01 → ab Datum
 *   npx tsx scripts/wise-phase0.ts --felder         → Feldnamen der Wise-Antwort
 *                                                     (nur Namen, keine Werte)
 *
 * In Render:  Shell öffnen → obigen Befehl ausführen. Der Token wird dort aus
 * der Umgebung gelesen; lokal muss WISE_API_TOKEN in .env stehen.
 */

import "dotenv/config";
import { sqlPool } from "../server/lib/db-pool";
import { holeAlleUmsaetze, ordneEin, schluesselStatus, WiseError, type WiseTxn } from "../server/lib/wise-api";
import { findApp } from "../server/routes/fiaon-reconcile";
import { nameTokens, ordneZu, type Kandidat, type Zuordnung } from "../server/lib/zahlungs-zuordnung";

const args = process.argv.slice(2);
const argWert = (name: string): string | null => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] ?? null : null;
};
const VON = new Date(argWert("--von") || "2023-01-01T00:00:00.000Z");
const NUR_FELDER = args.includes("--felder");

const eur = (c: number) => (c / 100).toLocaleString("de-DE", { minimumFractionDigits: 2 }) + " €";
const log = (s = "") => console.log(s);
const linie = (z = "─") => log(z.repeat(74));

async function main(): Promise<void> {
  const t0 = Date.now();

  // ── Ist-Stand im System (die Vergleichsbasis) ─────────────────────────────
  const [ist] = await sqlPool`
    SELECT
      COUNT(*) FILTER (WHERE payment_status = 'paid')::int                       AS bezahlt_zeilen,
      COALESCE(SUM(ROUND(amount_due::numeric * 100)) FILTER (WHERE payment_status = 'paid'), 0)::bigint AS bezahlt_cents,
      COUNT(*) FILTER (WHERE payment_status = 'pending_payment')::int            AS offen,
      COUNT(*) FILTER (WHERE payment_status = 'claimed_paid')::int               AS behauptet
    FROM fiaon_applications
    WHERE merged_into IS NULL AND gdpr_deleted_at IS NULL
  `;
  const [ledger] = await sqlPool`
    SELECT COUNT(*)::int AS zeilen,
           COUNT(*) FILTER (WHERE applied)::int AS verbucht,
           COALESCE(SUM(amount_cents), 0)::bigint AS summe,
           COALESCE(SUM(amount_cents) FILTER (WHERE applied), 0)::bigint AS summe_verbucht,
           COUNT(*) FILTER (WHERE match_status = 'unmatched')::int AS offen,
           COUNT(*) FILTER (WHERE match_status = 'manual')::int AS manuell
    FROM fiaon_bank_txns
  `.catch(() => [{ zeilen: 0, verbucht: 0, summe: 0, summe_verbucht: 0, offen: 0, manuell: 0 }] as any);

  log();
  log("WISE PHASE 0 — IST-STAND VOR DEM ABGLEICH");
  linie("═");
  log(`Im System als bezahlt geführt ... ${ist.bezahlt_zeilen} Bestellungen · ${eur(Number(ist.bezahlt_cents))}`);
  log(`Offen / Zahlung behauptet ....... ${ist.offen} / ${ist.behauptet}`);
  log(`Ledger fiaon_bank_txns .......... ${ledger.zeilen} Eingänge · ${eur(Number(ledger.summe))}`);
  log(`  davon verbucht ................ ${ledger.verbucht} · ${eur(Number(ledger.summe_verbucht))}`);
  log(`  davon unzugeordnet / manuell .. ${ledger.offen} / ${ledger.manuell}`);
  log();

  // ── Zugangsmittel prüfen, bevor irgendetwas abgerufen wird ─────────────────
  // Kontoauszüge verlangen bei Wise eine Signatur. Fehlt der private
  // Schlüssel, soll das in der ersten Sekunde stehen — nicht nach dem halben
  // Abruf und nicht getarnt als „keine Umsätze".
  const schluessel = schluesselStatus();
  log(`Zugangstoken .................... ${process.env.WISE_API_TOKEN ? "gesetzt" : "FEHLT"}`);
  log(`Privater Schlüssel (Signatur) ... ${schluessel.ok ? schluessel.text : "FEHLT/UNBRAUCHBAR"}`);
  if (!schluessel.ok) {
    log(`  ${schluessel.text}`);
    log("  Ohne Signatur weist Wise jeden Kontoauszug mit 403 ab.");
  }
  log();

  // ── Live bei Wise abholen ─────────────────────────────────────────────────
  log(`Wise-Abruf ab ${VON.toISOString().slice(0, 10)} …`);
  let umsaetze: WiseTxn[];
  try {
    const erg = await holeAlleUmsaetze(VON, new Date(), (s) => log(`  ${s}`));
    umsaetze = erg.txns;
  } catch (err) {
    log();
    if (err instanceof WiseError) {
      console.error(`❌ Wise-Abruf fehlgeschlagen: ${err.message}`);
      console.error("   Der Ist-Stand oben stammt aus der Datenbank und ist gültig.");
      console.error("   Es wurde nichts verändert.");
    } else {
      console.error("❌ Unerwarteter Fehler:", err);
    }
    await sqlPool.end();
    process.exit(1);
  }

  if (NUR_FELDER) {
    const beispiel = umsaetze.find((t) => t.direction === "CREDIT") ?? umsaetze[0];
    log();
    log("Feldnamen der Wise-Antwort (nur Namen, KEINE Werte):");
    const keys = (o: any, prefix = ""): string[] =>
      o && typeof o === "object" && !Array.isArray(o)
        ? Object.keys(o).flatMap((k) => [prefix + k, ...keys(o[k], `${prefix}${k}.`)])
        : [];
    log("  " + keys(beispiel?.raw).join("\n  "));
    await sqlPool.end();
    return;
  }

  const eingaenge = umsaetze.filter((t) => t.direction === "CREDIT");
  const ausgaenge = umsaetze.length - eingaenge.length;

  // ── Einordnung: nicht jeder Eingang ist eine Kundenzahlung ────────────────
  const nachArt = new Map<string, WiseTxn[]>();
  for (const t of eingaenge) {
    const art = ordneEin(t);
    const arr = nachArt.get(art) ?? [];
    arr.push(t);
    nachArt.set(art, arr);
  }
  const kundenzahlungen = nachArt.get("kundenzahlung") ?? [];

  log();
  log("WAS AUF DEM KONTO PASSIERT IST");
  linie();
  log(`Umsätze gesamt .................. ${umsaetze.length}`);
  log(`  Ausgänge (bleiben außen vor) .. ${ausgaenge}`);
  log(`  Eingänge ...................... ${eingaenge.length}`);
  for (const [art, liste] of [...nachArt.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const summe = liste.reduce((s, t) => s + t.amountCents, 0);
    log(`    ${art.padEnd(16)} ${String(liste.length).padStart(4)} · ${eur(summe)}`);
  }

  // ── Doppelimport-Prüfung gegen das bestehende Ledger ──────────────────────
  const vorhanden = new Set<string>(
    (await sqlPool`SELECT txn_id FROM fiaon_bank_txns WHERE txn_id IS NOT NULL`.catch(() => []))
      .map((r: any) => String(r.txn_id)),
  );
  const bekannt = eingaenge.filter((t) => vorhanden.has(t.referenceNumber)).length;
  log();
  log(`Bereits im Ledger (gleiche Wise-ID) ... ${bekannt} von ${eingaenge.length}`);
  log(`Neu hinzukommend ...................... ${eingaenge.length - bekannt}`);
  if (vorhanden.size > 0 && bekannt === 0) {
    log("⚠️  Keine einzige Überschneidung — die alten CSV-Zeilen nutzen offenbar eine");
    log("    andere ID-Form. Ein Neuimport würde sie verdoppeln. Der Sync muss die");
    log("    Altzeilen deshalb archivieren statt danebenzuschreiben.");
  }

  // ── Kandidaten laden ──────────────────────────────────────────────────────
  const roh = await sqlPool`
    SELECT ref, payment_reference, amount_due, payment_status, iban, email, person_id, created_at,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', first_name, last_name)), ''), contact_name, company_name, email) AS name
    FROM fiaon_applications
    WHERE merged_into IS NULL AND gdpr_deleted_at IS NULL
  `;
  const kandidaten: Kandidat[] = roh.map((r: any) => ({
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

  // Vorfilter: nur Kandidaten mit gemeinsamem Namensanfang oder exaktem Betrag.
  // Ohne ihn liefe jeder Eingang gegen alle 5.963 Zeilen — das sprengt die
  // 60-Sekunden-Grenze, ohne die Trefferqualität zu verbessern.
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
  const vorfilter = (t: WiseTxn): Kandidat[] => {
    const menge = new Set<Kandidat>();
    for (const p of new Set(nameTokens(t.payerName).map((x) => x.slice(0, 3)))) {
      for (const k of nachPraefix.get(p) ?? []) menge.add(k);
    }
    for (const k of nachBetrag.get(t.amountCents) ?? []) menge.add(k);
    return [...menge];
  };

  const refSuche = async (ref: string) => {
    const app = await findApp(ref);
    return app ? { ref: app.ref, personId: null } : null;
  };

  // ── Zuordnen ──────────────────────────────────────────────────────────────
  log();
  log(`Ordne ${kundenzahlungen.length} Kundenzahlungen zu …`);
  const zuordnungen: Array<{ t: WiseTxn; z: Zuordnung }> = [];
  for (const t of kundenzahlungen) {
    const z = await ordneZu(
      { amountCents: t.amountCents, payerName: t.payerName, senderAccount: t.senderAccount,
        referenceRaw: [t.paymentReference, t.description].filter(Boolean).join(" ") || null },
      vorfilter(t),
      refSuche,
    );
    zuordnungen.push({ t, z });
  }

  const nachMethode = new Map<string, number>();
  for (const { z } of zuordnungen) nachMethode.set(z.methode, (nachMethode.get(z.methode) ?? 0) + 1);

  log();
  log("ZUORDNUNG IN STUFEN");
  linie();
  for (const [m, label] of [
    ["referenz", "1 · Referenz im Verwendungszweck (sicher)"],
    ["iban", "2 · Absender-IBAN stimmt überein (sicher)"],
    ["name_betrag", "3 · Betrag exakt + Name eindeutig (hoch)"],
    ["vorschlag", "4 · Vorschläge — Mensch entscheidet"],
    ["offen", "— · Kein Kandidat"],
  ] as const) {
    const n = nachMethode.get(m) ?? 0;
    const summe = zuordnungen.filter((x) => x.z.methode === m).reduce((s, x) => s + x.t.amountCents, 0);
    log(`  ${label.padEnd(46)} ${String(n).padStart(4)} · ${eur(summe)}`);
  }

  // ── Die vier Kategorien ───────────────────────────────────────────────────
  const bezahltImSystem = new Map<string, number>();
  for (const k of kandidaten) if (k.paymentStatus === "paid") bezahltImSystem.set(k.ref, k.sollCents);

  const stimmt: typeof zuordnungen = [];
  const fehlt: typeof zuordnungen = [];
  const getroffen = new Set<string>();
  for (const x of zuordnungen) {
    if (!x.z.ref || !x.z.automatisch) continue;
    getroffen.add(x.z.ref);
    if (bezahltImSystem.has(x.z.ref)) stimmt.push(x);
    else fehlt.push(x);
  }
  const ohneGeld = [...bezahltImSystem.keys()].filter((ref) => !getroffen.has(ref));
  const nichtZuordenbar = zuordnungen.filter((x) => !x.z.automatisch);

  const summeVon = (l: typeof zuordnungen) => l.reduce((s, x) => s + x.t.amountCents, 0);
  const ohneGeldCents = ohneGeld.reduce((s, ref) => s + (bezahltImSystem.get(ref) ?? 0), 0);

  log();
  log("DER ABGLEICH — VIER KATEGORIEN");
  linie("═");
  log(`1 · STIMMT ................. ${String(stimmt.length).padStart(4)} · ${eur(summeVon(stimmt))}`);
  log(`2 · FEHLT IM SYSTEM ........ ${String(fehlt.length).padStart(4)} · ${eur(summeVon(fehlt))}   ← Geld da, nicht verbucht`);
  log(`3 · IM SYSTEM, KEIN GELD ... ${String(ohneGeld.length).padStart(4)} · ${eur(ohneGeldCents)}   ← nur prüfen, NICHT zurücksetzen`);
  log(`4 · NICHT ZUORDENBAR ....... ${String(nichtZuordenbar.length).padStart(4)} · ${eur(summeVon(nichtZuordenbar))}`);
  linie();

  if (fehlt.length > 0) {
    log();
    log("KATEGORIE 2 — bisher nicht verbuchte Zahlungen (erste 25):");
    for (const x of fehlt.slice(0, 25)) {
      log(`  ${(x.t.bookedAt?.toISOString().slice(0, 10) ?? "—")}  ${eur(x.t.amountCents).padStart(11)}  ${x.z.ref}  ${(x.t.payerName ?? "—").slice(0, 28)}`);
      log(`     ${x.z.begruendung}`);
    }
    if (fehlt.length > 25) log(`  … und ${fehlt.length - 25} weitere`);
  }

  if (nichtZuordenbar.length > 0) {
    log();
    log("KATEGORIE 4 — Prüfliste mit Vorschlägen (erste 15):");
    for (const x of nichtZuordenbar.slice(0, 15)) {
      log(`  ${(x.t.bookedAt?.toISOString().slice(0, 10) ?? "—")}  ${eur(x.t.amountCents).padStart(11)}  ${(x.t.payerName ?? "—").slice(0, 30)}`);
      log(`     Zweck: ${(x.t.paymentReference ?? x.t.description ?? "—").slice(0, 70)}`);
      if (x.z.vorschlaege.length === 0) log("     → kein Vorschlag");
      for (const v of x.z.vorschlaege) log(`     → ${v.ref} · ${v.name.slice(0, 26)} · ${v.begruendung}`);
    }
    if (nichtZuordenbar.length > 15) log(`  … und ${nichtZuordenbar.length - 15} weitere`);
  }

  if (ohneGeld.length > 0) {
    log();
    log("KATEGORIE 3 — als bezahlt geführt, kein Eingang gefunden (erste 20):");
    log("  ACHTUNG: NICHT automatisch zurücksetzen — das sperrt Kunden aus ihrem Konto.");
    for (const ref of ohneGeld.slice(0, 20)) {
      const k = kandidaten.find((c) => c.ref === ref)!;
      log(`  ${ref}  ${eur(k.sollCents).padStart(11)}  ${k.name.slice(0, 30)}`);
    }
    if (ohneGeld.length > 20) log(`  … und ${ohneGeld.length - 20} weitere`);
  }

  log();
  log(`Fertig in ${((Date.now() - t0) / 1000).toFixed(1)} s — es wurde NICHTS geschrieben.`);
  log();
  await sqlPool.end();
}

main().catch(async (err) => {
  console.error("Phase 0 fehlgeschlagen:", err);
  await sqlPool.end().catch(() => {});
  process.exit(1);
});
