// ═══════════════════════════════════════════════════════════════════════════
// ROBOTER-UNTERSCHRIFTEN ENTWERTEN
//
// Am 06.08.2026 hat ein Playwright-Testlauf die Verpflichtungserklärung der
// Vertriebsleitung (Fassung 2.0) als „Daniel Stripling" angenommen — gegen die
// PRODUKTIONSdatenbank, von 127.0.0.1, mit HeadlessChrome. Niemand hat den Text
// gelesen, niemand hat unterschrieben. Der Eintrag sah aber aus wie ein
// Nachweis, und der Bereich stand offen.
//
// Dieser Lauf entwertet solche Einträge. Er LÖSCHT sie nicht:
//   · Hausregel: keine Hard-Deletes, nirgends — bei einem Rechtsnachweis gilt
//     sie doppelt.
//   · Verschwände die Zeile, wäre in einem Jahr nicht mehr erklärbar, warum es
//     zu diesem Zeitpunkt eine Annahme gab, die in der Tabelle fehlt. Ein
//     entwerteter Eintrag beantwortet beide Fragen: Es gab eine Unterschrift,
//     und sie war keine.
//
// Wirkung: `zusageStand` zählt widerrufene Annahmen nicht. Der betroffene
// Vertriebsleiter wird beim nächsten Öffnen erneut gefragt und unterschreibt
// selbst. Bis dahin liefert kein Datenweg des Bereichs Kundendaten aus (403).
//
// ECHTE ANNAHMEN BLEIBEN UNANGETASTET. Erkannt wird nur, was unbestreitbar
// maschinell war (istRoboterUnterschrift in lib/fiaon-vertrieb-zusage.ts).
//
//   npx tsx scripts/zusage-roboter-widerrufen.ts              → Vorschau
//   npx tsx scripts/zusage-roboter-widerrufen.ts --schreiben  → entwerten
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { sqlPool } from "../server/lib/db-pool";
import { ensureZusageTabelle, istRoboterUnterschrift } from "../server/lib/fiaon-vertrieb-zusage";

const SCHREIBEN = process.argv.includes("--schreiben");
const AKTEUR = "Betreiber (Bereinigung Roboter-Unterschriften)";

async function main(): Promise<void> {
  console.log("\n══ Verpflichtungserklärungen: Roboter-Unterschriften entwerten ══\n");
  await ensureZusageTabelle();

  const zeilen = await sqlPool`
    SELECT z.id, z.agent_id, z.version, z.name_getippt, z.ip, z.user_agent,
           z.accepted_at, z.widerrufen_am, z.widerruf_grund,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', ag.first_name, ag.last_name)), ''), ag.name, ag.email) AS agent
    FROM fiaon_vertrieb_zusagen z
    LEFT JOIN fiaon_agents ag ON ag.id = z.agent_id
    ORDER BY z.id
  `;

  const zuEntwerten: { id: number; grund: string; wer: string }[] = [];
  console.log("  Alle Annahmen im Bestand:\n");
  for (const z of zeilen as any[]) {
    const pruefung = istRoboterUnterschrift(z.ip, z.user_agent);
    const schon = z.widerrufen_am != null;
    const zeichen = schon ? "·" : pruefung.roboter ? "→" : " ";
    const bewertung = schon
      ? `bereits entwertet (${z.widerruf_grund ?? "ohne Grund"})`
      : pruefung.roboter
        ? `ROBOTER — ${pruefung.grund}`
        : "Mensch (bleibt gültig)";
    console.log(`  ${zeichen} #${String(z.id).padEnd(3)} Agent ${String(z.agent_id).padEnd(3)} ${String(z.agent ?? "?").slice(0, 22).padEnd(24)} ${String(z.version).padEnd(18)} ${String(z.ip ?? "-").padEnd(16)} ${bewertung}`);
    if (pruefung.roboter && !schon) {
      zuEntwerten.push({ id: Number(z.id), grund: pruefung.grund!, wer: String(z.agent ?? z.agent_id) });
    }
  }

  console.log(`\n  Zu entwerten: ${zuEntwerten.length}`);
  if (zuEntwerten.length === 0) {
    console.log("  Nichts zu tun.\n");
    await sqlPool.end();
    return;
  }
  if (!SCHREIBEN) {
    console.log("  Nur Vorschau. Ausführen mit --schreiben.\n");
    await sqlPool.end();
    return;
  }

  await sqlPool.begin(async (tx) => {
    for (const e of zuEntwerten) {
      await tx`
        UPDATE fiaon_vertrieb_zusagen SET
          widerrufen_am = NOW(),
          widerruf_grund = ${`Keine menschliche Unterschrift: ${e.grund}. Erzeugt von einem Browser-Testlauf gegen die Produktionsdatenbank.`},
          widerrufen_von = ${AKTEUR}
        WHERE id = ${e.id} AND widerrufen_am IS NULL
      `;
      await tx`
        INSERT INTO fiaon_agent_events (agent_id, type, meta, actor, reason)
        SELECT z.agent_id, 'vertrieb_zusage_widerrufen',
               ${JSON.stringify({ zusageId: e.id, grund: e.grund })},
               ${AKTEUR},
               ${"Roboter-Unterschrift entwertet — die Erklärung wird erneut verlangt"}
        FROM fiaon_vertrieb_zusagen z WHERE z.id = ${e.id}
      `;
      console.log(`  entwertet: #${e.id} (${e.wer})`);
    }
  });

  console.log(`\n  ${zuEntwerten.length} Unterschrift(en) entwertet, keine gelöscht.`);
  console.log("  Die betroffenen Vertriebsleiter werden beim nächsten Öffnen erneut gefragt.\n");
  await sqlPool.end();
}

main().catch((err) => {
  console.error("[ZUSAGE-WIDERRUF]", err);
  process.exit(1);
});
