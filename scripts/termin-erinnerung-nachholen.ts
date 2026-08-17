// ═══════════════════════════════════════════════════════════════════════════
// VERBRAUCHTE TERMIN-ERINNERUNGEN NACHHOLEN
//
// ── WAS PASSIERT IST ───────────────────────────────────────────────────────
// `runTerminErinnerungen` setzte `erinnert_am` für alle fälligen Termine in
// EINEM UPDATE — und sendete danach. Scheiterte der Versand, blieb die Marke
// stehen: Die Erinnerung war verbraucht, der Kunde bekam nichts.
//
// GEMESSEN am 17.08.2026: 91 Termine mit Marke, 56 mit erfolgreichem Versand.
// **35 verbraucht ohne Zustellung** — 33 wegen fehlendem Versandkanal, 2 ohne
// E-Mail-Adresse beim Kunden.
//
// ── WAS DIESER LAUF TUT UND WAS NICHT ──────────────────────────────────────
// Er nimmt die Marke NUR bei Terminen zurück, die noch in der ZUKUNFT liegen.
// Der nächste Terminlauf schickt die Erinnerung dann erneut.
//
// Für vergangene Termine wird NICHTS nachgesendet. Eine Erinnerung an ein
// Gespräch, das vorgestern war, ist peinlich und beschädigt mehr, als sie
// gutmacht. Sie werden nur GEZÄHLT — damit der Betreiber weiß, wie viele
// No-Shows in den Zeitraum fielen.
//
// ── VORSCHAU ZUERST ────────────────────────────────────────────────────────
//   npx tsx scripts/termin-erinnerung-nachholen.ts              (nur ansehen)
//   npx tsx scripts/termin-erinnerung-nachholen.ts --schreiben  (ausführen)
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";

const SCHREIBEN = process.argv.includes("--schreiben");
const log = (s = "") => console.log(s);

function feld(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function csv(name: string, zeilen: Record<string, unknown>[]): string {
  mkdirSync("reports", { recursive: true });
  const pfad = `reports/${name}`;
  if (zeilen.length === 0) { writeFileSync(pfad, "keine Treffer\n", "utf8"); return pfad; }
  const kopf = Object.keys(zeilen[0]);
  writeFileSync(pfad, `${[kopf.join(";"), ...zeilen.map((z) => kopf.map((k) => feld(z[k])).join(";"))].join("\n")}\n`, "utf8");
  return pfad;
}

async function main(): Promise<void> {
  log(`\n══ Termin-Erinnerungen nachholen ${SCHREIBEN ? "(SCHREIBT)" : "(VORSCHAU)"} ══\n`);

  // Termine mit Marke, deren Versand NICHT erfolgreich war.
  const alle = (await sqlPool`
    SELECT t.id, t.beginn, t.beginn::text AS beginn_text, t.status, t.quelle,
           t.erinnert_am::text AS erinnert_am, t.person_id, t.agent_id,
           t.beginn > NOW() + INTERVAL '30 minutes' AS nachholbar,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, p.contact_name, 'Ohne Namen') AS kunde,
           p.primary_email AS mail,
           ag.name AS betreuer,
           (SELECT l.status FROM fiaon_mail_log l
             WHERE l.event = 'termin_erinnerung' AND l.person_id = t.person_id
               AND l.created_at BETWEEN t.erinnert_am - INTERVAL '5 minutes'
                                    AND t.erinnert_am + INTERVAL '15 minutes'
             ORDER BY l.created_at DESC LIMIT 1) AS protokoll,
           (SELECT l.grund FROM fiaon_mail_log l
             WHERE l.event = 'termin_erinnerung' AND l.person_id = t.person_id
               AND l.created_at BETWEEN t.erinnert_am - INTERVAL '5 minutes'
                                    AND t.erinnert_am + INTERVAL '15 minutes'
             ORDER BY l.created_at DESC LIMIT 1) AS grund
    FROM fiaon_termine t
    LEFT JOIN fiaon_persons p ON p.id = t.person_id
    LEFT JOIN fiaon_agents ag ON ag.id = t.agent_id
    WHERE t.erinnert_am IS NOT NULL
    ORDER BY t.beginn DESC
  `) as any[];

  const ohneErfolg = alle.filter((t) => t.protokoll !== "versandt");
  const nachholbar = ohneErfolg.filter((t) => t.nachholbar && t.status === "gebucht");
  const vorbei = ohneErfolg.filter((t) => !t.nachholbar);

  log(`  ${String(alle.length).padStart(5)}  Termine mit gesetzter Erinnerungs-Marke`);
  log(`  ${String(alle.length - ohneErfolg.length).padStart(5)}  … davon wirklich versandt`);
  log(`  ${String(ohneErfolg.length).padStart(5)}  … davon VERBRAUCHT ohne Zustellung`);
  log(`  ${String(nachholbar.length).padStart(5)}  … davon nachholbar (Termin in der Zukunft, noch gebucht)`);
  log(`  ${String(vorbei.length).padStart(5)}  … davon vorbei — wird NICHT nachgesendet`);

  // Was ist aus den vergangenen geworden?
  const [nsz] = (await sqlPool`
    SELECT COUNT(*) FILTER (WHERE status = 'verpasst')::int AS verpasst,
           COUNT(*) FILTER (WHERE status = 'erledigt')::int AS erledigt,
           COUNT(*) FILTER (WHERE status = 'abgesagt')::int AS abgesagt,
           COUNT(*)::int AS gesamt
    FROM fiaon_termine
    WHERE erinnert_am IS NOT NULL AND beginn < NOW()
  `) as any[];
  log(`\n  DIE VERGANGENEN ERINNERTEN TERMINE (${nsz.gesamt}):`);
  log(`    ${String(nsz.verpasst).padStart(5)}  nicht erschienen`);
  log(`    ${String(nsz.erledigt).padStart(5)}  erledigt`);
  log(`    ${String(nsz.abgesagt).padStart(5)}  abgesagt`);
  if (Number(nsz.gesamt) > 0) {
    const quote = Math.round((Number(nsz.verpasst) / Number(nsz.gesamt)) * 100);
    log(`\n    No-Show-Quote: ${quote} %. Wie viele davon erschienen wären, wenn die`);
    log("    Erinnerung angekommen wäre, weiß niemand — und genau das ist der Punkt.");
  }

  log("\n  Woran der Versand lag:");
  const gruende = new Map<string, number>();
  for (const t of ohneErfolg) {
    const g = String(t.grund || t.protokoll || "kein Protokolleintrag");
    gruende.set(g, (gruende.get(g) ?? 0) + 1);
  }
  for (const [g, n] of Array.from(gruende.entries()).sort((a, b) => b[1] - a[1])) {
    log(`    ${String(n).padStart(4)} × ${g}`);
  }

  if (nachholbar.length > 0) {
    log("\n  DIESE ERINNERUNGEN WERDEN NEU EINGEPLANT:");
    for (const t of nachholbar) {
      log(`    Termin ${String(t.id).padStart(4)}  ${t.beginn_text.slice(0, 16)}  `
        + `${String(t.kunde).slice(0, 28).padEnd(28)}  ${t.mail ? "Adresse da" : "OHNE ADRESSE"}`
        + `  ${t.betreuer ?? "ohne Betreuer"}`);
    }
    const ohneMail = nachholbar.filter((t) => !t.mail);
    if (ohneMail.length > 0) {
      log(`\n    ${ohneMail.length} davon haben keine E-Mail-Adresse an der Person. Die`);
      log("    Marke wird trotzdem zurückgenommen: Die Auflösung geht über Aliase und");
      log("    Bestellzeile (fiaon-empfaenger.ts) und findet vielleicht doch eine.");
    }
  }

  log(`\n  CSV: ${csv("nachhol-termin-erinnerungen.csv", ohneErfolg.map((t) => ({
    id: t.id, beginn: t.beginn_text, status: t.status, kunde: t.kunde,
    mail: t.mail ?? "", betreuer: t.betreuer ?? "", protokoll: t.protokoll ?? "",
    grund: t.grund ?? "", nachholbar: t.nachholbar ? "ja" : "nein",
  })))}`);

  if (!SCHREIBEN) {
    log("\n  Das war die VORSCHAU. Es wurde nichts geändert.");
    log("  Ausführen mit: npx tsx scripts/termin-erinnerung-nachholen.ts --schreiben\n");
    await sqlPool.end();
    return;
  }

  if (nachholbar.length === 0) {
    log("\n  Nichts nachzuholen.\n");
    await sqlPool.end();
    return;
  }

  const ids = nachholbar.map((t) => Number(t.id));
  const zurueck = (await sqlPool`
    UPDATE fiaon_termine
    SET erinnert_am = NULL, updated_at = NOW()
    WHERE id = ANY(${ids}::int[])
      -- Noch einmal die Zukunftsbedingung: Zwischen Vorschau und Schreiben
      -- kann eine Stunde liegen, und ein Termin kann inzwischen vorbei sein.
      AND beginn > NOW() + INTERVAL '30 minutes'
      AND status = 'gebucht'
    RETURNING id
  `) as any[];

  log(`\n  ${zurueck.length} Erinnerung(en) neu eingeplant.`);
  log("  Der nächste Terminlauf verschickt sie — sofern ein Versandkanal steht.");
  log("  Ohne Kanal steht ab jetzt „übersprungen (kein Kanal)“ im Zustellprotokoll,");
  log("  und die Marke bleibt frei. Nichts wird mehr lautlos verbraucht.\n");

  // Zählprobe
  const [probe] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_termine
    WHERE id = ANY(${ids}::int[]) AND erinnert_am IS NULL
  `) as any[];
  log(`  Zählprobe: ${probe.n} von ${ids.length} stehen jetzt ohne Marke.\n`);

  await sqlPool.end();
}

main().catch(async (e) => {
  console.error(e);
  await sqlPool.end().catch(() => {});
  process.exit(1);
});
