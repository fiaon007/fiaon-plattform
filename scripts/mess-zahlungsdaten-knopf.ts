// ═══════════════════════════════════════════════════════════════════════════
// WARUM IST DER ZAHLUNGSDATEN-KNOPF GESPERRT?
//
// ── DIE MELDUNG (Daniel Stripling, 27.08.2026) ─────────────────────────────
// „Ich kann die Zahlungsdaten nicht jedem schicken."
//
// Bevor eine Regel geändert wird, muss dastehen, WIE OFT sie greift und
// WARUM. Dieser Lauf geht die Tagesliste durch und bewertet jede Person mit
// derselben Funktion, die die Oberfläche benutzt (`versandStatus` aus
// `server/lib/fiaon-versand.ts`) — keine zweite Fassung der Regel.
//
// NUR LESEND.
//
//   npx tsx scripts/mess-zahlungsdaten-knopf.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
//  ist die Funktion, die das Sende-Menü benutzt — ein
// erster Entwurf riet `versandStatus`, die es nicht gibt. Wer eine fremde
// Funktion aufruft, liest erst ihre Signatur.
import { versandErlaubtViele } from "../server/lib/fiaon-versand";

const log = (s = "") => console.log(s);
function titel(t: string): void { log(`\n${"═".repeat(72)}\n${t}\n${"═".repeat(72)}`); }

async function main(): Promise<void> {
  // ═════════════════════════════════════════════════════════════════════════
  titel("DIE TAGESLISTE — wer steht heute drauf?");
  // ═════════════════════════════════════════════════════════════════════════
  // Dieselbe Bedingung wie die Arbeitsliste: fällige Wiedervorlage, nicht
  // gesperrt, nicht im Wartezustand.
  const personen = (await sqlPool`
    SELECT DISTINCT p.id,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, 'Unbekannt') AS name,
           p.primary_email, p.wartet_auf,
           ag.name AS agent_name,
           (SELECT a.payment_status FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.merged_into IS NULL
             ORDER BY a.created_at DESC LIMIT 1) AS letzter_zustand
    FROM fiaon_persons p
    LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
    WHERE p.merged_into_person_id IS NULL
      AND COALESCE(p.ist_test_am::text, '') = ''
      AND (p.follow_up_date IS NULL OR p.follow_up_date <= CURRENT_DATE)
      AND COALESCE(p.is_blocked, FALSE) = FALSE
      AND EXISTS (
        SELECT 1 FROM fiaon_applications a WHERE a.person_id = p.id
          AND a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
      )
    ORDER BY p.id
    LIMIT 600
  `) as any[];
  log(`  ${String(personen.length).padStart(5)}  Personen in der Tagesliste (bis 600)`);

  // ═════════════════════════════════════════════════════════════════════════
  titel("DER KNOPF „ZAHLUNGSDATEN SENDEN“ — je Person bewertet");
  // ═════════════════════════════════════════════════════════════════════════
  const gruende = new Map<string, number>();
  const beispiele = new Map<string, string>();
  let erlaubt = 0;
  const zeilen: string[] = [];

  for (const p of personen) {
    const st = await versandErlaubtViele(Number(p.id), ["payment_details"])
      .catch(() => null);
    const eintrag = (st as any)?.["payment_details"] ?? null;
    if (!eintrag) {
      gruende.set("(Bewertung scheiterte)", (gruende.get("(Bewertung scheiterte)") ?? 0) + 1);
      continue;
    }
    if (eintrag.erlaubt) {
      erlaubt++;
    } else {
      const g = String(eintrag.grund ?? "(ohne Grund)");
      gruende.set(g, (gruende.get(g) ?? 0) + 1);
      if (!beispiele.has(g)) beispiele.set(g, `${p.name} (${p.letzter_zustand ?? "—"})`);
    }
    zeilen.push([p.id, p.name, p.agent_name ?? "", p.letzter_zustand ?? "",
                 p.primary_email ? "ja" : "nein",
                 eintrag.erlaubt ? "SENDBAR" : String(eintrag.grund ?? "")].join(";"));
  }

  log(`  ${String(erlaubt).padStart(5)}  SENDBAR`);
  log(`  ${String(personen.length - erlaubt).padStart(5)}  gesperrt`);
  log("");
  log("  DIE GRÜNDE:");
  for (const [g, n] of Array.from(gruende.entries()).sort((a, b) => b[1] - a[1])) {
    log(`  ${String(n).padStart(5)}  ${g}`);
    log(`         z. B. ${beispiele.get(g) ?? "—"}`);
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("DIE STRITTIGEN FÄLLE");
  // ═════════════════════════════════════════════════════════════════════════
  // ── claimed_paid: DER KUNDE FRAGT OFT GENAU DANN NACH ──────────────────
  // „Ich habe überwiesen" heißt nicht „das Geld ist da". Und der häufigste
  // Anruf danach ist: „Können Sie mir die Daten nochmal schicken?"
  const [cp] = (await sqlPool`
    SELECT COUNT(DISTINCT p.id)::int AS n
    FROM fiaon_persons p
    JOIN fiaon_applications a ON a.person_id = p.id AND a.merged_into IS NULL
    WHERE p.merged_into_person_id IS NULL AND COALESCE(p.ist_test_am::text, '') = ''
      AND a.payment_status = 'claimed_paid'
      AND NULLIF(TRIM(COALESCE(p.primary_email, '')), '') IS NOT NULL
  `) as any[];
  log(`  ${String(cp.n).padStart(5)}  Personen mit gemeldeter Zahlung (claimed_paid) und E-Mail`);

  const [nurExpired] = (await sqlPool`
    SELECT COUNT(DISTINCT p.id)::int AS n
    FROM fiaon_persons p
    WHERE p.merged_into_person_id IS NULL AND COALESCE(p.ist_test_am::text, '') = ''
      AND EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = p.id
                    AND a.merged_into IS NULL AND a.payment_status = 'expired')
      AND NOT EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = p.id
                    AND a.merged_into IS NULL
                    AND a.payment_status IN ('pending_payment', 'claimed_paid'))
  `) as any[];
  log(`  ${String(nurExpired.n).padStart(5)}  Personen, deren Bestellungen NUR abgelaufen sind`);

  const [ohneMail] = (await sqlPool`
    SELECT COUNT(DISTINCT p.id)::int AS n
    FROM fiaon_persons p
    WHERE p.merged_into_person_id IS NULL AND COALESCE(p.ist_test_am::text, '') = ''
      AND NULLIF(TRIM(COALESCE(p.primary_email, '')), '') IS NULL
      AND EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = p.id
                    AND a.merged_into IS NULL AND a.archived_at IS NULL
                    AND a.payment_status IN ('pending_payment', 'claimed_paid'))
  `) as any[];
  log(`  ${String(ohneMail.n).padStart(5)}  Personen mit offener Bestellung, aber OHNE E-Mail`);
  log("         Die brauchen einen Anruf und eine nachgetragene Adresse — der");
  log("         Knopf soll das SAGEN und den Weg dorthin öffnen.");

  mkdirSync("reports", { recursive: true });
  writeFileSync("reports/mess-zahlungsdaten-knopf.csv",
    `person_id;name;agent;letzter_zustand;hat_email;bewertung\n${zeilen.join("\n")}\n`, "utf8");
  log("\n  CSV: reports/mess-zahlungsdaten-knopf.csv\n");
  await sqlPool.end();
}

main().catch(async (e) => {
  console.error(e);
  await sqlPool.end().catch(() => {});
  process.exit(1);
});
