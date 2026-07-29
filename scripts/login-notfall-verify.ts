/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NACHWEIS AM ECHTEN BESTAND — „kommen die Kunden nach dem Fix wieder rein?"
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * NUR LESEND. Kein UPDATE, kein DELETE, keine Mail, kein Webhook.
 *
 * Spielt für JEDE bezahlte Kundenfamilie beide Logins gegeneinander:
 *
 *   ALT  = die jüngste Antragszeile der E-Mail, exakter Vergleich (der Bug)
 *   NEU  = die ganze Familie + Kontoauflösung (decideLogin, dieselbe Funktion,
 *          die der Endpunkt benutzt)
 *
 * Als Passwort wird das im Datensatz hinterlegte genommen — es liegt im Klartext
 * in der Datenbank. Damit ist der Vergleich echt und nicht simuliert.
 *
 * ⚠ NEBENBEFUND: Kundenpasswörter stehen im KLARTEXT in `password` bzw.
 *   `utm->>'password'`. Das ist unabhängig von diesem Notfall zu beheben
 *   (Hashing), gehört aber nicht in denselben Schritt: Ein Wechsel auf Hashes
 *   ohne Übergang würde alle Kunden erneut aussperren.
 *
 * Verwendung:  npx tsx scripts/login-notfall-verify.ts
 */

import "dotenv/config";
import postgres from "postgres";
import { decideLogin, storedPasswordOf, pickAccountRow, LOGIN_CODES } from "../server/fiaon-login-logic";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL fehlt.");
  process.exit(2);
}
const sql = postgres(process.env.DATABASE_URL, {
  ssl: "require",
  max: 3,
  connect_timeout: 15,
  connection: { statement_timeout: 20000 },
});

function loginKeyOf(row: any): string | null {
  const raw = row?.email || row?.contact_email || row?.billing_email || "";
  const key = String(raw).trim().toLowerCase();
  return key || null;
}

async function main() {
  console.log("NACHWEIS AM ECHTEN BESTAND (nur lesend)");
  console.log(`Stand: ${new Date().toISOString()}\n`);

  // EINE schlanke Abfrage über alle Zeilen (ohne die schweren bytea-Spalten),
  // Gruppierung dann in JS. Ein `LOWER(TRIM(...)) = ANY(...)` über drei Spalten
  // kann keinen Index nutzen und lief ins Zeitlimit.
  const rows = await sql`
    SELECT id, ref, type, status, account_status, payment_status, payment_reference,
           merged_into, email, contact_email, billing_email,
           first_name, last_name, contact_name, birthdate, pack_key, pack_name, approved_limit,
           password, utm::text AS utm_string, created_at
    FROM fiaon_applications
    WHERE gdpr_deleted_at IS NULL
    ORDER BY created_at DESC NULLS LAST, id DESC
  `;

  const paidKeys = new Set<string>();
  for (const row of rows) {
    if (row.payment_status !== "paid") continue;
    const key = loginKeyOf(row);
    if (key) paidKeys.add(key);
  }

  const families = new Map<string, any[]>();
  for (const row of rows) {
    const key = loginKeyOf(row);
    if (!key || !paidKeys.has(key)) continue;
    if (!families.has(key)) families.set(key, []);
    families.get(key)!.push(row);
  }

  let altOk = 0, neuOk = 0, repariert = 0, ohnePasswort = 0, zahlungOffen = 0, gesperrt = 0;
  const repairedSamples: string[] = [];
  const stillLocked: string[] = [];

  families.forEach((family, key) => {
    // Das Passwort, das der Kunde kennt: irgendeines aus seiner Familie.
    const known = family.map((r) => storedPasswordOf(r)).find((p) => p !== null) ?? null;

    // ── ALTER Login: nur die jüngste Zeile, exakter E-Mail-Vergleich.
    const newest = family[0];
    const altStored = storedPasswordOf(newest);
    const altWouldPass =
      known !== null && altStored === known &&
      (["completed", "documents_submitted", "payment_completed"].includes(newest.status) || newest.payment_status === "paid") &&
      newest.account_status !== "suspended";

    // ── NEUER Login: ganze Familie + Kontoauflösung.
    const verdict = known === null ? null : decideLogin(family, known);
    const neuWouldPass = verdict?.granted === true;

    if (altWouldPass) altOk++;
    if (neuWouldPass) neuOk++;

    if (!altWouldPass && neuWouldPass) {
      repariert++;
      if (repairedSamples.length < 12) {
        repairedSamples.push(`${key} — alter Login las ${newest.ref}, Konto ist ${(verdict as any).account.ref}`);
      }
    }
    if (known === null) {
      ohnePasswort++;
      if (stillLocked.length < 12) stillLocked.push(`${key} (${pickAccountRow(family)?.ref})`);
    } else if (verdict && !verdict.granted) {
      if (verdict.code === LOGIN_CODES.PAYMENT_PENDING) zahlungOffen++;
      else if (verdict.code === LOGIN_CODES.SUSPENDED) gesperrt++;
    }
  });

  const pad = (s: string) => s.padEnd(56, ".");
  console.log(`  ${pad("Bezahlte Kundenfamilien geprüft")} ${families.size}`);
  console.log(`  ${pad("Konnten sich mit dem ALTEN Login anmelden")} ${altOk}`);
  console.log(`  ${pad("Können sich mit dem NEUEN Login anmelden")} ${neuOk}`);
  console.log(`  ${pad("→ durch den Fix wieder freigeschaltet")} ${repariert}`);
  console.log(`  ${pad("brauchen „Passwort vergessen\" (nie ein Passwort)")} ${ohnePasswort}`);
  console.log(`  ${pad("Zahlung am Konto offen (AUTH-03, korrekt)")} ${zahlungOffen}`);
  console.log(`  ${pad("gesperrt (AUTH-04, Entscheidung des Betreibers)")} ${gesperrt}`);

  if (repairedSamples.length > 0) {
    console.log("\n  Beispiele, die der Fix repariert:");
    for (const s of repairedSamples) console.log(`    ${s}`);
  }
  if (stillLocked.length > 0) {
    console.log("\n  Brauchen aktiv „Passwort vergessen\" (Arbeitsliste /admin/login-lockouts):");
    for (const s of stillLocked) console.log(`    ${s}`);
  }

  // ── Ist der Rettungsweg für die Ausgesperrten überhaupt begehbar? ─────────
  // „Passwort vergessen" verlangt Vorname + Nachname + E-Mail + Geburtsdatum.
  // Fehlt eines davon im Datensatz, kann sich der Kunde NICHT selbst befreien —
  // dann muss der Betreiber ihn anrufen. Genau das muss er vorher wissen.
  console.log("\n  Rettungsweg „Passwort vergessen\" für die Ausgesperrten:");
  let begehbar = 0, nichtBegehbar = 0;
  const blocked: string[] = [];
  families.forEach((family, key) => {
    const known = family.map((r) => storedPasswordOf(r)).find((p) => p !== null) ?? null;
    if (known !== null) return; // kommt ohnehin rein
    // Der Reset prüft gegen JEDE Zeile der Familie (Kontoauflösung).
    const usable = family.some(
      (r) => String(r.first_name ?? "").trim() !== "" && String(r.last_name ?? "").trim() !== "" && !!r.birthdate,
    );
    if (usable) begehbar++;
    else {
      nichtBegehbar++;
      const acc = pickAccountRow(family);
      if (blocked.length < 20) {
        blocked.push(`${key} (${acc?.ref}) — fehlt: ${[
          String(acc?.first_name ?? "").trim() === "" ? "Vorname" : null,
          String(acc?.last_name ?? "").trim() === "" ? "Nachname" : null,
          !acc?.birthdate ? "Geburtsdatum" : null,
        ].filter(Boolean).join(", ") || "Angaben nur in anderer Zeile"}`);
      }
    }
  });
  console.log(`    ${pad("können sich selbst befreien")} ${begehbar}`);
  console.log(`    ${pad("brauchen den Betreiber (Angaben fehlen)")} ${nichtBegehbar}`);
  for (const b of blocked) console.log(`      ${b}`);

  // Sicherheits-Gegenprobe: Der Fix darf NIEMANDEN hereinlassen, der vorher
  // durch das Zahlungs-Gate gestoppt wurde.
  let gateVerletzt = 0;
  families.forEach((family) => {
    const known = family.map((r) => storedPasswordOf(r)).find((p) => p !== null) ?? null;
    if (known === null) return;
    const verdict = decideLogin(family, known);
    if (!verdict.granted) return;
    const acc = verdict.account;
    const gateOk =
      ["completed", "documents_submitted", "payment_completed"].includes(acc.status) || acc.payment_status === "paid";
    if (!gateOk) gateVerletzt++;
  });
  console.log(`\n  Zugangs-Gate umgangen (muss 0 sein) ............... ${gateVerletzt}`);
  if (gateVerletzt > 0) {
    console.log("  FEHLER: Der Fix lässt jemanden ohne Freischaltung durch.");
    await sql.end();
    process.exit(1);
  }

  await sql.end();
}

main().catch(async (e) => {
  console.error("FEHLER:", e instanceof Error ? e.message : e);
  await sql.end().catch(() => {});
  process.exit(1);
});
