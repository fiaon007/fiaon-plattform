// ═══════════════════════════════════════════════════════════════════════════
// WARUM GEHT BEI FLORENTINE KEINE RECHNUNG RAUS?
//
// ── DIE MELDUNG (Florentine Lombardi, heute) ───────────────────────────────
// „Über 11 Kunden warten auf ihre Rechnung — ich kann ihnen keine Mail
// schicken."
//
// Das ist NICHT die Meldung von gestern (falsches Paket). Hier geht GAR NICHTS
// raus.
//
// ── DER VERDACHT, DEN DIESE MESSUNG PRÜFEN MUSS ───────────────────────────
// Gestern wurde die Auflösung „welche Bestellung gilt" verschärft und eine
// Referenzprüfung eingebaut. Beides kann zu viel ablehnen. Wer eine Wand baut,
// muss nachsehen, wen sie aufhält — und zwar an echten Konten, nicht am
// Quelltext.
//
// ── WIE GEMESSEN WIRD ─────────────────────────────────────────────────────
// Der Entscheidungsbaum von `zahlungsdatenSenden` wird SCHRITT FÜR SCHRITT
// nachgebildet, ohne zu senden. Für jeden Kunden fällt ein GRUND-CODE:
//
//   frei                  der Knopf geht
//   erste_rechnung        keine offene, aber eine rechnungsreife Bestellung
//                         → der Lauf stellt sie und sendet (also auch frei)
//   keine_email           keine zustellbare Adresse
//   keine_bestellung      gar keine Bestellung
//   alles_bezahlt         nichts offen
//   antrag_unfertig       Bestellung da, aber Antrag nicht abgeschlossen
//   nur_archiviert        nur archivierte/stornierte Bestellungen
//
// Codes, nicht Texte: Texte werden umformuliert, eine Statistik darüber bricht
// bei der ersten Verbesserung.
//
// NUR LESEND. Es wird keine Mail verschickt und nichts geschrieben.
//
//   npx tsx scripts/mess-sendesperre.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import { massgeblicheBestellung } from "../server/lib/fiaon-massgebliche-bestellung";
import { aufbereiten } from "../server/lib/fiaon-buchungen";

const log = (s = "") => console.log(s);
function titel(t: string): void { log(`\n${"═".repeat(78)}\n${t}\n${"═".repeat(78)}`); }
const feld = (v: unknown): string => {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const euro = (c: unknown) => `${(Number(c ?? 0) / 100).toFixed(2).replace(".", ",")} €`;

interface Befund {
  personId: number;
  name: string;
  agent: string | null;
  grund: string;
  /** Was die KARTE dem Agenten anzeigt (aus `buchungen`, clientseitig). */
  karteZeigt: string;
  paket: string | null;
  betrag: number | null;
  ref: string | null;
  email: string | null;
}

/**
 * Der Entscheidungsbaum, EINMAL — nachgebildet aus `zahlungsdatenSenden`.
 *
 * Er wird hier nachgebildet und nicht aufgerufen, weil der echte Lauf sendet.
 * Damit die Nachbildung nicht vom Original abweicht, prüft der Prüfstand
 * `pruef-sendesperre.ts` beide gegeneinander.
 */
async function grundFuer(personId: number): Promise<{
  grund: string; paket: string | null; betrag: number | null; ref: string | null; email: string | null;
}> {
  const b = await massgeblicheBestellung(personId);
  if (b) {
    if (!b.empfaenger) {
      return { grund: "keine_email", paket: b.paket, betrag: b.betragCents, ref: b.ref, email: null };
    }
    return { grund: "frei", paket: b.paket, betrag: b.betragCents, ref: b.ref, email: b.empfaenger };
  }

  // Kein offener Posten — aber vielleicht eine rechnungsreife Bestellung.
  const { RECHNUNGSREIF } = await import("../server/lib/fiaon-rechnung-stellen");
  const [reif] = (await sqlPool`
    SELECT a.ref, a.pack_name, a.amount_due,
           COALESCE(NULLIF(a.email, ''), NULLIF(a.contact_email, ''),
                    NULLIF(a.billing_email, '')) AS empfaenger
    FROM fiaon_applications a
    WHERE a.person_id = ${personId} AND a.merged_into IS NULL AND a.archived_at IS NULL
      AND a.payment_status = 'pending'
      AND a.status = ANY(${RECHNUNGSREIF as unknown as string[]})
    ORDER BY a.created_at DESC LIMIT 1
  `) as any[];
  if (reif) {
    return reif.empfaenger
      ? { grund: "erste_rechnung", paket: reif.pack_name, betrag: reif.amount_due, ref: reif.ref, email: reif.empfaenger }
      : { grund: "keine_email", paket: reif.pack_name, betrag: reif.amount_due, ref: reif.ref, email: null };
  }

  const [warum] = (await sqlPool`
    SELECT a.status, a.payment_status, a.pack_name FROM fiaon_applications a
    WHERE a.person_id = ${personId} AND a.merged_into IS NULL AND a.archived_at IS NULL
    ORDER BY a.created_at DESC LIMIT 1
  `) as any[];
  if (!warum) {
    // Gibt es überhaupt eine — nur archiviert?
    const [arch] = (await sqlPool`
      SELECT COUNT(*)::int AS n FROM fiaon_applications
      WHERE person_id = ${personId} AND merged_into IS NULL AND archived_at IS NOT NULL
    `) as any[];
    return {
      grund: Number(arch.n) > 0 ? "nur_archiviert" : "keine_bestellung",
      paket: null, betrag: null, ref: null, email: null,
    };
  }
  if (warum.payment_status === "paid") {
    return { grund: "alles_bezahlt", paket: warum.pack_name, betrag: null, ref: null, email: null };
  }
  return { grund: "antrag_unfertig", paket: warum.pack_name, betrag: null, ref: null, email: null };
}

async function main(): Promise<void> {
  mkdirSync("reports", { recursive: true });

  // ═════════════════════════════════════════════════════════════════════════
  titel("1. FLORENTINES BESTAND — JEDER KUNDE, JEDER GRUND");
  // ═════════════════════════════════════════════════════════════════════════
  const [flo] = (await sqlPool`
    SELECT id, name FROM fiaon_agents WHERE name ILIKE '%florentine%' LIMIT 1
  `) as any[];
  if (!flo) { log("  Florentine nicht gefunden."); await sqlPool.end(); return; }
  log(`\n  ${flo.name} (Kennung ${flo.id})`);

  // Ihre Tagesliste: dieselbe Grenze wie die Arbeitsliste.
  const ihre = (await sqlPool`
    SELECT p.id,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, p.primary_email, p.person_ref) AS name,
           p.primary_email, p.priority_tier,
           (SELECT COALESCE(JSON_AGG(JSON_BUILD_OBJECT(
                     'ref', a.ref, 'pack_name', a.pack_name, 'amount_due', a.amount_due,
                     'payment_status', a.payment_status, 'status', a.status,
                     'created_at', a.created_at, 'cancelled_at', a.cancelled_at,
                     'refunded_at', a.refunded_at, 'payment_reference', a.payment_reference,
                     'payment_due_date', a.payment_due_date, 'pack_key', a.pack_key
                   ) ORDER BY a.created_at), '[]'::json)
              FROM fiaon_applications a
              WHERE a.person_id = p.id AND a.merged_into IS NULL
                AND a.archived_at IS NULL AND a.gdpr_deleted_at IS NULL) AS buchungen_roh
    FROM fiaon_persons p
    WHERE p.assigned_agent_id = ${flo.id} AND p.merged_into_person_id IS NULL
      AND p.ist_test_am IS NULL AND NOT p.is_blocked
    ORDER BY p.priority_tier, p.id
  `) as any[];
  log(`  ${ihre.length} zugewiesene Kunden\n`);

  const befunde: Befund[] = [];
  const zaehler = new Map<string, number>();
  for (const p of ihre) {
    const g = await grundFuer(Number(p.id));
    // Was die KARTE anzeigt — die clientseitige Ableitung.
    const buch = aufbereiten(p.buchungen_roh);
    const hatOffene = buch.some((x: any) => x.offen);
    const allesBezahlt = buch.length > 0 && buch.every((x: any) => x.bezahlt);
    const karteZeigt = !p.primary_email ? "gesperrt: keine E-Mail"
      : buch.length === 0 ? "gesperrt: keine Bestellung"
      : !hatOffene && allesBezahlt ? "gesperrt: alles bezahlt"
      : !hatOffene ? "gesperrt: keine offene Bestellung"
      : "FREI";
    zaehler.set(g.grund, (zaehler.get(g.grund) ?? 0) + 1);
    befunde.push({
      personId: Number(p.id), name: String(p.name), agent: flo.name,
      grund: g.grund, karteZeigt, paket: g.paket, betrag: g.betrag,
      ref: g.ref, email: g.email ?? p.primary_email ?? null,
    });
  }

  log(`  ${"Grund (Server)".padEnd(20)} ${"Anzahl".padStart(7)}`);
  log(`  ${"-".repeat(30)}`);
  for (const [g, n] of Array.from(zaehler.entries()).sort((a, b) => b[1] - a[1])) {
    log(`  ${g.padEnd(20)} ${String(n).padStart(7)}`);
  }

  // ── DER WIDERSPRUCH: Karte sagt FREI, Server sperrt ─────────────────────
  titel("2. WO KARTE UND SERVER AUSEINANDERGEHEN");
  const widerspruch = befunde.filter((b) =>
    b.karteZeigt === "FREI" && b.grund !== "frei" && b.grund !== "erste_rechnung");
  log("");
  log(`  ${String(widerspruch.length).padStart(5)}  Kunden: Die Karte gibt den Knopf FREI, der Server lehnt ab`);
  log("         → genau das erlebt der Agent als „ich drücke und nichts passiert“");
  log("");
  for (const w of widerspruch.slice(0, 20)) {
    log(`     Person ${String(w.personId).padStart(6)}  ${String(w.name).slice(0, 26).padEnd(27)}`
      + ` Server: ${w.grund}`);
  }

  const umgekehrt = befunde.filter((b) =>
    b.karteZeigt !== "FREI" && (b.grund === "frei" || b.grund === "erste_rechnung"));
  log("");
  log(`  ${String(umgekehrt.length).padStart(5)}  Kunden: Die Karte SPERRT, obwohl der Server senden würde`);
  log("         → genau das erlebt der Agent als „der Knopf ist weg“");
  for (const u of umgekehrt.slice(0, 20)) {
    log(`     Person ${String(u.personId).padStart(6)}  ${String(u.name).slice(0, 26).padEnd(27)}`
      + ` Karte: ${u.karteZeigt}  Server: ${u.grund}`);
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("3. BESTANDSWEIT: LEBENDE OFFENE BESTELLUNG + E-MAIL, TROTZDEM GESPERRT");
  // ═════════════════════════════════════════════════════════════════════════
  // Die Zahl, die nach dem Fix 0 sein muss.
  const alle = (await sqlPool`
    SELECT p.id,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, p.person_ref) AS name,
           ag.name AS agent,
           (SELECT COALESCE(JSON_AGG(JSON_BUILD_OBJECT(
                     'ref', a.ref, 'pack_name', a.pack_name, 'amount_due', a.amount_due,
                     'payment_status', a.payment_status, 'status', a.status,
                     'created_at', a.created_at, 'cancelled_at', a.cancelled_at,
                     'refunded_at', a.refunded_at, 'payment_reference', a.payment_reference,
                     'payment_due_date', a.payment_due_date, 'pack_key', a.pack_key
                   ) ORDER BY a.created_at), '[]'::json)
              FROM fiaon_applications a
              WHERE a.person_id = p.id AND a.merged_into IS NULL
                AND a.archived_at IS NULL AND a.gdpr_deleted_at IS NULL) AS buchungen_roh
    FROM fiaon_persons p
    LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
    WHERE p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL AND NOT p.is_blocked
      AND EXISTS (
        SELECT 1 FROM fiaon_applications a
        WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.archived_at IS NULL
          AND a.gdpr_deleted_at IS NULL AND a.cancelled_at IS NULL
          AND a.payment_status IN ('pending_payment', 'claimed_paid', 'expired')
          AND COALESCE(NULLIF(a.email, ''), NULLIF(a.contact_email, ''),
                       NULLIF(a.billing_email, '')) IS NOT NULL)
  `) as any[];

  const gesperrtObwohl: any[] = [];
  for (const p of alle) {
    const buch = aufbereiten(p.buchungen_roh);
    const hatOffene = buch.some((x: any) => x.offen);
    const allesBezahlt = buch.length > 0 && buch.every((x: any) => x.bezahlt);
    // Die clientseitige Sperre — OHNE die E-Mail-Bedingung, denn die ist hier
    // per Abfrage erfüllt.
    const karteSperrt = buch.length === 0 || (!hatOffene && allesBezahlt) || !hatOffene;
    if (karteSperrt) gesperrtObwohl.push(p);
  }
  log("");
  log(`  ${String(alle.length).padStart(5)}  Personen mit lebender offener Bestellung UND zustellbarer E-Mail`);
  log(`  ${String(gesperrtObwohl.length).padStart(5)}  davon sperrt die KARTE trotzdem  ← muss 0 sein`);
  for (const g of gesperrtObwohl.slice(0, 15)) {
    const buch = aufbereiten(g.buchungen_roh);
    log(`     Person ${String(g.id).padStart(6)}  ${String(g.name).slice(0, 24).padEnd(25)}`
      + ` ${String(g.agent ?? "—").slice(0, 16).padEnd(17)}`
      + ` ${buch.length} Buchung(en): ${buch.map((b: any) => `${b.status ?? "?"}/${b.offen ? "offen" : "zu"}`).join(", ")}`);
  }

  // ── UND DIE GEGENRICHTUNG ───────────────────────────────────────────────
  titel("4. DIE ELF, DIE FLORENTINE MEINT");
  const wartend = befunde.filter((b) => b.grund === "frei" || b.grund === "erste_rechnung");
  const gesperrt = befunde.filter((b) => b.grund !== "frei" && b.grund !== "erste_rechnung");
  log("");
  log(`  ${String(wartend.length).padStart(5)}  Kunden, bei denen der Server SENDEN würde`);
  log(`  ${String(gesperrt.length).padStart(5)}  Kunden, bei denen er ablehnt`);
  log("");
  log("  Die sendbaren mit Betrag und Verwendungszweck:");
  for (const w of wartend.slice(0, 15)) {
    log(`     Person ${String(w.personId).padStart(6)}  ${String(w.name).slice(0, 24).padEnd(25)}`
      + ` ${String(w.paket ?? "—").slice(0, 26).padEnd(27)} ${euro(w.betrag).padStart(10)}`
      + `  ${w.grund}`);
  }

  writeFileSync("reports/sendesperre.csv",
    "bereich;person_id;name;agent;grund_server;karte_zeigt;paket;betrag_cents;ref;email\n"
    + befunde.map((b) => ["florentine", b.personId, b.name, b.agent, b.grund, b.karteZeigt,
      b.paket, b.betrag, b.ref, b.email].map(feld).join(";")).join("\n")
    + (befunde.length && gesperrtObwohl.length ? "\n" : "")
    + gesperrtObwohl.map((g) => ["bestandsweit_gesperrt", g.id, g.name, g.agent, "", "karte sperrt",
      "", "", "", ""].map(feld).join(";")).join("\n") + "\n",
    "utf8");
  log("");
  log("  reports/sendesperre.csv");
  log("");
  await sqlPool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
