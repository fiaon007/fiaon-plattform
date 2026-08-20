// ═══════════════════════════════════════════════════════════════════════════
// WAND: KEINE AUSGEZAHLTE PROVISION OHNE BELEG
//
// ── DER BEFUND (20.08.2026) ────────────────────────────────────────────────
// FIAON-COM-2026-0011: 386,40 € ausgezahlt, KEIN PDF — und das System
// verweigerte die Herstellung, weil die Wand vor „Überschreiben" auch das
// „Erstellen" verbot.
//
// Zwei Dinge werden hier geprüft:
//   1. Der BESTAND: keine Abrechnung ohne PDF (Zählprobe).
//   2. Der WEG: Eine Freigabe erzeugt den Beleg ZWINGEND — und wenn der Druck
//      scheitert, meldet sie einen Fehler statt still „ausgezahlt".
//
// ── DIE ROT-PROBE BRICHT DEN DRUCK ABSICHTLICH ────────────────────────────
// Sie läuft gegen ein TESTKONTO mit einer eigenen Auszahlung, die im selben Lauf
// entfernt wird. An echten Auszahlungen wird NICHTS angefasst.
//
//   npx tsx scripts/pruef-beleg-zwingend.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { readFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import { testkontoStilllegen } from "../server/lib/fiaon-mitarbeiter-sicht";

let bestanden = 0;
let fehlgeschlagen = 0;
const log = (s = "") => console.log(s);
function ok(name: string, b: boolean, detail = ""): void {
  if (b) { bestanden++; log(`  PASS  ${name}`); }
  else { fehlgeschlagen++; log(`  FAIL  ${name}${detail ? `  → ${detail}` : ""}`); }
}
function gruppe(t: string): void { log(`\n── ${t} ${"─".repeat(Math.max(0, 54 - t.length))}`); }
function ohneKommentar(t: string): string {
  return t.split("\n").filter((z) => {
    const x = z.trim();
    return !x.startsWith("//") && !x.startsWith("*") && !x.startsWith("/*");
  }).join("\n");
}

const stillzulegen: number[] = [];
const auszahlungenWeg: number[] = [];

async function main(): Promise<void> {
  log("\n══ Wand: kein ausgezahlter Beleg ohne PDF ══");

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("1. Die Zählprobe am Bestand");
  // ═════════════════════════════════════════════════════════════════════════
  const jeStatus = (await sqlPool`
    SELECT COALESCE(p.status, '(keine)') AS status,
           COUNT(*)::int AS alle,
           COUNT(*) FILTER (WHERE s.pdf_base64 IS NULL)::int AS ohne_pdf
      FROM fiaon_commission_statements s
      LEFT JOIN fiaon_payouts p ON p.id = s.payout_id
     GROUP BY 1 ORDER BY 1
  `) as any[];
  for (const r of jeStatus) {
    log(`        ${String(r.status).padEnd(18)} ${String(r.alle).padStart(3)} Abrechnungen, `
      + `${r.ohne_pdf} ohne PDF`);
  }
  const [z] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_commission_statements WHERE pdf_base64 IS NULL
  `) as any[];
  ok("Keine Abrechnung ohne PDF", Number(z.n) === 0,
    `${z.n} ohne Beleg — npx tsx scripts/abrechnung-belege-nachziehen.ts --schreiben`);

  // Und die nachträglich hergestellten sind als solche gekennzeichnet.
  const [nach] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_commission_statements WHERE pdf_nachtraeglich
  `) as any[];
  log(`        ${nach.n} Beleg(e) wurden NACHTRÄGLICH hergestellt (gekennzeichnet).`);

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("2. Die Regel im Quelltext");
  // ═════════════════════════════════════════════════════════════════════════
  const onb = ohneKommentar(readFileSync("server/routes/fiaon-onboarding.ts", "utf8"));
  const abr = ohneKommentar(readFileSync("server/routes/fiaon-abrechnungen.ts", "utf8"));
  const team = ohneKommentar(readFileSync("server/routes/fiaon-team.ts", "utf8"));

  ok("Die Wand greift nur, wenn ein PDF DA IST",
    /hatPdf && ausgezahlt/.test(onb),
    "sie sperrt wieder allein nach Status — dann bleibt ein fehlender Beleg fehlend");
  ok("Fehlt das PDF, wird es auch bei „ausgezahlt“ erzeugt",
    !/if \(String\(s\.auszahlung_status \?\? ""\) === "ausgezahlt"\) \{\s*return \{\s*ok: false/.test(onb));
  ok("Die Erst-Erzeugung wird als nachträglich gekennzeichnet",
    /pdf_nachtraeglich = \$\{ausgezahlt\}/.test(onb));
  ok("Eine ersetzte Fassung wird ARCHIVIERT, nicht gelöscht",
    /pdf_base64_ersetzt = pdf_base64/.test(onb));
  ok("Auch die Route sperrt nur bei vorhandenem Beleg",
    /=== "ausgezahlt" && r\.pdf_base64/.test(abr));

  // ── DER KERN: DIE FREIGABE WARTET AUF DEN BELEG ──────────────────────────
  ok("Die Freigabe WARTET auf die Abrechnung (await)",
    /await generateCommissionStatement\(id\)/.test(team),
    "sie feuert wieder ohne await — genau die Ursache von 0011");
  ok("Sie wertet aus, ob das PDF fehlt",
    /erg\.pdfFehlt/.test(team));
  ok("Und antwortet dann mit einem FEHLER statt „ok“",
    /code: "BELEG_FEHLT"/.test(team) && /status\(502\)/.test(team));
  ok("`generateCommissionStatement` gibt den Druckfehler nach oben",
    /pdfFehlt: !pdfBase64, pdfGrund/.test(onb));
  ok("Der irreführende Hinweis in der PDF-Route ist korrigiert",
    !/solange die Auszahlung nicht abgeschlossen ist/.test(abr),
    "der Satz steht noch da — er war genau im Fall seines Auftretens falsch");

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("3. Freigabe → Beleg, am eigenen Prüffall");
  // ═════════════════════════════════════════════════════════════════════════
  const bcrypt = (await import("bcryptjs")).default;
  const mail = `pruef-beleg-${Date.now().toString(36)}@pruefstand.test`;
  const [k] = (await sqlPool`
    INSERT INTO fiaon_agents (name, email, password_hash, rolle, active, is_test_account,
                              distribution_active, created_at, commission_rate_bp)
    VALUES ('Prüfstand Beleg (Testkonto)', ${mail},
            ${await bcrypt.hash(`P-${Math.random()}`, 10)}, 'agent', TRUE, TRUE, FALSE, NOW(), 2000)
    RETURNING id
  `) as any[];
  const agentId = Number(k.id);
  stillzulegen.push(agentId);

  // Eine Auszahlung mit zwei Positionen — eine mit Satz, eine Pauschale.
  // Damit prüft der Lauf BEIDE Tabellen des Belegs (der ungünstigste Fall).
  const [p] = (await sqlPool`
    INSERT INTO fiaon_payouts (agent_id, status, amount_cents, requested_at)
    VALUES (${agentId}, 'angefordert', 3500, NOW())
    RETURNING id
  `) as any[];
  const payoutId = Number(p.id);
  auszahlungenWeg.push(payoutId);
  await sqlPool`
    INSERT INTO fiaon_commissions
      (agent_id, payout_id, ref, payment_reference, pack_name, kind,
       base_amount_cents, rate_bp, amount_cents, status, note, created_at)
    VALUES
      (${agentId}, ${payoutId}, 'FIAON-PRUEFBELEG-1', 'FIAON-PRUEFBELEG-1', 'FIAON Pro', 'own',
       10000, 2000, 2000, 'in_auszahlung', NULL, NOW()),
      (${agentId}, ${payoutId}, 'FIAON-PRUEFBELEG-2', 'PRUEF-BONUS', NULL, 'feedback_bonus',
       0, 0, 1500, 'in_auszahlung', 'Einmalige Gutschrift (Prüfstand)', NOW())
  `;

  const { generateCommissionStatement } = await import("../server/routes/fiaon-onboarding");
  const erg = await generateCommissionStatement(payoutId);
  ok("Die Freigabe erzeugt eine Abrechnung", erg.ok === true);
  ok("Und das PDF fehlt NICHT", erg.pdfFehlt !== true, String(erg.pdfGrund ?? ""));
  const [neu] = (await sqlPool`
    SELECT statement_no, (pdf_base64 IS NOT NULL) AS hat_pdf, net_cents
      FROM fiaon_commission_statements WHERE payout_id = ${payoutId}
  `) as any[];
  ok("Zählprobe im selben Lauf: der Beleg liegt vor", neu?.hat_pdf === true);
  log(`        ${neu?.statement_no} · ${(Number(neu?.net_cents ?? 0) / 100).toFixed(2)} €`);

  // Der Bonus ohne Satz muss in der Pauschal-Tabelle stehen, nicht als
  // Provision mit leerer Prozentspalte.
  if (neu?.hat_pdf) {
    const [voll] = (await sqlPool`
      SELECT pdf_base64 FROM fiaon_commission_statements WHERE payout_id = ${payoutId}
    `) as any[];
    const { pdfTextJeSeite } = await import("../server/lib/fiaon-pdf-lesen");
    const text = (await pdfTextJeSeite(Buffer.from(String(voll.pdf_base64), "base64"))).join(" ");
    const iPausch = text.indexOf("Pauschal");
    const iBonus = text.indexOf("Einmalige Gutschrift");
    ok("Die Gutschrift ohne Satz steht in der Pauschal-Tabelle",
      iPausch > 0 && iBonus > iPausch,
      `Pauschal ab ${iPausch}, Gutschrift ab ${iBonus}`);
    ok("Beide Tabellen sind im Beleg",
      /Provisionen aus Verk/.test(text) && /Pauschal/.test(text));
  }

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("4. Rot-Probe: den Druck absichtlich brechen");
  // ═════════════════════════════════════════════════════════════════════════
  // Eine zweite Auszahlung, und der Druck wird über eine unmögliche Vorgabe
  // zum Scheitern gebracht: Die Firmierung liefert einen Wert, an dem der
  // Renderer scheitert. Sauberer Weg ohne Quelltext-Änderung: ein Datensatz,
  // dessen `lines_json` beim Rendern eine Ausnahme auslöst — hier über eine
  // Auszahlung OHNE Positionen und mit zerstörtem Agenten-Bezug.
  const [p2] = (await sqlPool`
    INSERT INTO fiaon_payouts (agent_id, status, amount_cents, requested_at)
    VALUES (${agentId}, 'angefordert', 1000, NOW())
    RETURNING id
  `) as any[];
  auszahlungenWeg.push(Number(p2.id));

  // Der Druck wird gebrochen, indem die Umgebungsvariable für Chromium auf einen
  // Pfad zeigt, den es nicht gibt. `abrechnungPdf` wirft dann.
  const alterPfad = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = "/nicht/vorhanden/chromium";
  let ergRot: any = null;
  try {
    ergRot = await generateCommissionStatement(Number(p2.id));
  } finally {
    if (alterPfad == null) delete process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
    else process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = alterPfad;
  }
  if (ergRot?.pdfFehlt === true) {
    ok("Rot-Probe: der gebrochene Druck wird GEMELDET (pdfFehlt)", true);
    ok("Und der Grund kommt mit", String(ergRot.pdfGrund ?? "").length > 0,
      String(ergRot.pdfGrund ?? "").slice(0, 80));
  } else {
    // Chromium liess sich nicht brechen (etwa weil ein anderer Pfad greift).
    // Das wird AUSDRÜCKLICH gemeldet — ein stilles Überspringen wäre eine
    // Scheinprüfung (AGENTS.md).
    log("        Der Druck liess sich über die Umgebungsvariable nicht brechen.");
    log("        Geprüft wird deshalb nur der WEG: gibt die Funktion pdfFehlt zurück?");
    ok("Der Rückgabewert kennt `pdfFehlt`",
      ergRot != null && "pdfFehlt" in ergRot, JSON.stringify(ergRot));
  }

  await aufraeumen();
  log(`\n        Prüfdaten entfernt: ${auszahlungenWeg.length} Auszahlungen, `
    + `${stillzulegen.length} Testkonto.`);
  log(`\n══ ${bestanden} ok, ${fehlgeschlagen} rot ══\n`);
  await sqlPool.end();
  if (fehlgeschlagen > 0) process.exit(1);
}

/**
 * Aufräumen läuft IMMER.
 *
 * Hier wird ausnahmsweise HART gelöscht — es sind Zeilen, die dieser Lauf im
 * selben Durchgang selbst angelegt hat, an einem Testkonto. Die Hausregel
 * „keine Hard-Deletes" schützt gewachsene Daten, nicht Prüfstands-Abfall; ein
 * archivierter Prüf-Beleg würde in jeder Abrechnungsliste auftauchen.
 */
async function aufraeumen(): Promise<void> {
  for (const id of auszahlungenWeg) {
    await sqlPool`DELETE FROM fiaon_commission_statements WHERE payout_id = ${id}`.catch(() => {});
    await sqlPool`DELETE FROM fiaon_commissions WHERE payout_id = ${id}`.catch(() => {});
    await sqlPool`DELETE FROM fiaon_payouts WHERE id = ${id}`.catch(() => {});
  }
  for (const id of stillzulegen) {
    await sqlPool`DELETE FROM fiaon_commissions WHERE agent_id = ${id}`.catch(() => {});
    await testkontoStilllegen(id).catch(() => {});
  }
}

main().catch(async (e) => {
  console.error(e);
  await aufraeumen();
  await sqlPool.end();
  process.exit(1);
});
