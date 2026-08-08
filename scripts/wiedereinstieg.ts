// ═══════════════════════════════════════════════════════════════════════════
// WIEDEREINSTIEG — Terminangebot statt Spät-Mahnung
//
// Wer seit über 14 Tagen nichts von uns gehört hat und noch eine offene
// Rechnung trägt, bekommt keine dritte Zahlungserinnerung, sondern einen
// Terminlink. Eine Mahnung nach sechs Wochen Funkstille liest sich wie ein
// Inkassoschreiben für etwas, das der Kunde längst abgehakt hat.
//
// Die ZIELGRUPPE und alle AUSSCHLÜSSE stehen in
// server/lib/fiaon-wiedereinstieg.ts — dieselbe Abfrage, die auch die
// Tagesstaffel im Cron benutzt. Dieses Skript ist die Vorschau, die CSV und
// der Auslöser, nicht eine zweite Fassung der Regel.
//
//   npx tsx scripts/wiedereinstieg.ts              # Vorschau + CSV
//   npx tsx scripts/wiedereinstieg.ts --schreiben  # erste Staffel senden
//   npx tsx scripts/wiedereinstieg.ts --kennzahl   # versandt/gebucht/Quote
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import {
  wiedereinstiegKandidaten, wiedereinstiegKennzahl, wiedereinstiegTagesstaffel,
  STAFFEL_PRO_TAG, STILLE_TAGE,
} from "../server/lib/fiaon-wiedereinstieg";

const SCHREIBEN = process.argv.includes("--schreiben");
const NUR_KENNZAHL = process.argv.includes("--kennzahl");

const feld = (v: unknown): string => {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const tage = (iso: string | null): string =>
  iso ? String(Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000)) : "nie";

async function main(): Promise<void> {
  console.log("\n══ Wiedereinstieg: Terminangebot an stille Kunden ══\n");

  if (NUR_KENNZAHL) {
    const k = await wiedereinstiegKennzahl();
    console.log(`  Mails versandt:   ${k.versandt}`);
    console.log(`  Termine gebucht:  ${k.gebucht}`);
    console.log(`  Quote:            ${k.quote} %`);
    console.log(`  Noch offen:       ${k.offen}\n`);
    await sqlPool.end();
    return;
  }

  const alle = await wiedereinstiegKandidaten(null);
  console.log(`  Zielgruppe:            ${alle.length} Personen`);
  console.log(`  Bedingung:             Stufe A oder B, offene Zahlung, seit ${STILLE_TAGE}+ Tagen still, E-Mail vorhanden`);
  console.log(`  Ausgeschlossen:        bezahlt, abgelehnt, gesperrt, DSGVO, Testkonten,`);
  console.log(`                         Kunden mit Termin, Kunden mit bereits versandtem Terminlink`);
  console.log(`  Staffel:               höchstens ${STAFFEL_PRO_TAG} am Tag\n`);

  mkdirSync("reports", { recursive: true });
  const kopf = ["person_id", "name", "email", "stufe", "grund", "letzter_kontakt", "tage_still", "versuche", "ruht"];
  const zeilen = alle.map((k) => [
    k.personId, k.name, k.email, k.stufe, k.tierGrund,
    k.letzterKontakt ? k.letzterKontakt.slice(0, 10) : "nie",
    tage(k.letzterKontakt), k.versuche, k.ruht ? "ja" : "",
  ].map(feld).join(";"));
  writeFileSync("reports/wiedereinstieg.csv", `${kopf.join(";")}\n${zeilen.join("\n")}\n`, "utf8");
  console.log("  Vorschau: reports/wiedereinstieg.csv\n");

  const jeStufe = alle.reduce<Record<string, number>>((m, k) => ({ ...m, [k.stufe]: (m[k.stufe] || 0) + 1 }), {});
  console.log(`  Je Stufe: ${Object.entries(jeStufe).map(([s, n]) => `${s}: ${n}`).join(" · ") || "—"}`);
  console.log("\n  Die ersten zehn:");
  for (const k of alle.slice(0, 10)) {
    console.log(`    ${String(k.personId).padEnd(6)} ${k.stufe}  ${k.name.slice(0, 26).padEnd(28)} `
      + `${tage(k.letzterKontakt).padStart(4)} Tage still  ${k.email}`);
  }

  if (alle.length === 0) {
    console.log("\n  Niemand fällt in die Zielgruppe. Nichts zu tun.\n");
    await sqlPool.end();
    return;
  }
  if (!SCHREIBEN) {
    console.log(`\n  Nur Vorschau — es ging KEINE Mail raus.`);
    console.log(`  Erste Staffel senden: npx tsx scripts/wiedereinstieg.ts --schreiben\n`);
    await sqlPool.end();
    return;
  }

  console.log(`\n  Sende die erste Staffel (höchstens ${STAFFEL_PRO_TAG}) …\n`);
  const erg = await wiedereinstiegTagesstaffel({ force: true });
  console.log(`  Versandt:        ${erg.versandt}`);
  console.log(`  Fehlgeschlagen:  ${erg.fehlgeschlagen}`);
  if (erg.fehlgeschlagen > 0) {
    console.log(`\n  Die Fehlschläge stehen mit Grund in fiaon_mail_log und im Kundenverlauf.`);
    console.log(`  Häufigste Ursache: der Make-Zweig 'nicht_erreicht_termin' fehlt noch.`);
    const zeile = (await sqlPool`
      SELECT grund FROM fiaon_mail_log WHERE event = 'nicht_erreicht_termin' AND status = 'fehlgeschlagen'
      ORDER BY id DESC LIMIT 1
    `) as any[];
    if (zeile[0]) console.log(`  Zuletzt: ${zeile[0].grund}`);
  }
  const rest = await wiedereinstiegKandidaten(null);
  console.log(`\n  Noch offen: ${rest.length} — der Tageslauf schickt die nächste Staffel morgen.\n`);
  await sqlPool.end();
}

main().catch(async (err) => {
  console.error("\nAbgebrochen:", err);
  await sqlPool.end().catch(() => {});
  process.exit(1);
});
