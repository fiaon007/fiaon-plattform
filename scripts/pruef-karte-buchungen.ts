// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: DIE KARTENAKTUALISIERUNG DARF DIE BUCHUNGEN NICHT LÖSCHEN
//
// ── DIE ZWEI MELDUNGEN, DIE HIER ZUSAMMENLAUFEN (30.08.2026) ───────────────
//   „Paket neu angelegt / E-Mail ergänzt — Versand bleibt trotzdem gesperrt."
//   „Produkt anlegen: keine Bestellung vorhanden."
//
// Beide kamen aus EINER Zeile: `kartePayload` (server/routes/fiaon-agent-kunden.ts)
// lieferte kein Feld `buchungen`. Die Liste lieferte es, die Einzelkarte nicht.
// Nach jeder Änderung holt die Oberfläche die Karte einzeln nachgeladen — und
// ersetzte damit eine gefüllte Buchungsliste durch `undefined`. Die
// Sperrgrund-Ableitung in kunden-neu.tsx liest `k.buchungen ?? []`, fand eine
// leere Liste und sagte folgerichtig „Keine Bestellung vorhanden".
//
// Die Aktualisierung hat die Daten nicht bloß nicht erneuert — sie hat sie
// GELÖSCHT. Wer die E-Mail nachtrug, sperrte sich damit den Versand.
//
// ── WARUM DIESER PRÜFSTAND ÜBER ECHTES HTTP GEHT ───────────────────────────
// Ein Blick in den Quelltext hätte den Fehler nie gefunden: Dort stand nichts
// Falsches, es FEHLTE etwas. Geprüft wird deshalb die ANTWORT der Route — und
// zwar die, die ein Agent bekommt.
//
// ── KEINE ECHTEN VORGÄNGE ──────────────────────────────────────────────────
// Es wird nur GELESEN (GET). Das Testkonto wird am Ende über
// `testkontoStilllegen` markiert und stillgelegt, die Testperson und ihre
// Bestellung werden archiviert (kein Hard-Delete, AGENTS.md).
//
//   Server muss laufen:  PORT=5188 npm run dev
//   npx tsx scripts/pruef-karte-buchungen.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { sqlPool } from "../server/lib/db-pool";
import { testkontoStilllegen } from "../server/lib/fiaon-mitarbeiter-sicht";

const BASIS = process.env.PRUEF_BASIS || "http://127.0.0.1:5188";
let bestanden = 0;
let fehlgeschlagen = 0;
const fehler: string[] = [];
const log = (s = "") => console.log(s);
function ok(name: string, bedingung: boolean, detail = ""): void {
  if (bedingung) { bestanden++; log(`  PASS  ${name}`); }
  else { fehlgeschlagen++; fehler.push(name); log(`  FAIL  ${name}${detail ? `  → ${detail}` : ""}`); }
}

const stempel = Date.now().toString(36).toUpperCase();
// `.test` ist reserviert (RFC 2606) und kann niemandem gehören.
const MAIL = `pruef-karte-${stempel}@pruefstand.test`;
const REF = `FIAON-PKB${stempel}-1`;

async function main(): Promise<void> {
  log("\n══ Prüfstand: Kartenaktualisierung und Buchungen ══\n");

  const bcrypt = (await import("bcryptjs")).default;
  const pass = `P-${Math.random().toString(36).slice(2)}`;
  const [agent] = (await sqlPool`
    INSERT INTO fiaon_agents (name, email, password_hash, rolle, active, is_test_account,
                              distribution_active, created_at)
    VALUES (${`Prüfstand Karte (Testkonto) ${stempel}`}, ${MAIL},
            ${await bcrypt.hash(pass, 10)}, 'agent', TRUE, TRUE, FALSE, NOW())
    RETURNING id
  `) as any[];
  const agentId = Number(agent.id);

  // Die Testperson gehört diesem Testkonto — sonst greift die Besitzprüfung in
  // `meinePerson` und die Route antwortet 404 (richtig, aber nicht das, was
  // hier geprüft werden soll).
  const [person] = (await sqlPool`
    INSERT INTO fiaon_persons (person_ref, kind, account_status, priority_tier,
                               first_name, last_name, primary_email, assigned_agent_id, created_at)
    VALUES (${`FIAON-P-PKB${stempel}`}, 'private', 'pending', 2,
            'Prüfstand', ${`Karte${stempel}`}, ${MAIL}, ${agentId}, NOW())
    RETURNING id
  `) as any[];
  const personId = Number(person.id);

  await sqlPool`
    INSERT INTO fiaon_applications (ref, person_id, type, status, payment_status, pack_key,
                                    pack_name, amount_due, assigned_agent_id, created_at)
    VALUES (${REF}, ${personId}, 'private', 'completed', 'pending_payment', 'ultra',
            ${"FIAON Ultra\n(Elite Konto)"}, '79.99', ${agentId}, NOW())
  `;

  // ── DIE VORBEDINGUNG HERSTELLEN, DIE EIN MENSCH AUCH HERSTELLT ──────────
  // Erster Lauf: acht rote Prüfungen, alle mit HTTP 403 „Onboarding nicht
  // abgeschlossen". Das ist RICHTIGES Verhalten (`customerDataGate` in
  // server/routes/fiaon-onboarding.ts) — ein frisches Konto darf keine
  // Kundendaten sehen. Ein Prüfstand, der die Vorbedingung nicht herstellt,
  // prüft eine Sperre und meldet sie als Fehler.
  //
  // Die Zustimmungen und der Vertrag entstehen hier für ein TESTKONTO, sind
  // als PRUEFSTAND gekennzeichnet und werden am Ende entfernt. Das ist der Weg,
  // den AGENTS.md ausdrücklich erlaubt („gegen Testdaten, die im selben Lauf
  // zurückgerollt oder entfernt werden") — und ausdrücklich NICHT eine Annahme
  // im Namen eines echten Menschen.
  // `getActiveTemplate` ist nicht exportiert, deshalb wird die Vorlage hier
  // selbst gelesen — aus `fiaon_contract_templates`. NICHT aus
  // `fiaon_agent_contract_templates`: Die gibt es nicht, und ein erster Entwurf
  // ist genau darauf hereingefallen (dieselbe Verwechslung steht in AGENTS.md).
  const { ONBOARDING_DOCS, ensureOnboardingTables } =
    await import("../server/routes/fiaon-onboarding");
  await ensureOnboardingTables();
  for (const d of ONBOARDING_DOCS as any[]) {
    await sqlPool`
      INSERT INTO fiaon_agent_consents (agent_id, doc_key, doc_version, accepted_at, ip, user_agent)
      VALUES (${agentId}, ${d.key}, ${d.version}, NOW(), '127.0.0.1', 'PRUEFSTAND karte-buchungen')
    `.catch((e) => log(`  (Zustimmung ${d.key}: ${e?.message ?? e})`));
  }
  const [vorlage] = (await sqlPool`
    SELECT version FROM fiaon_contract_templates WHERE status = 'active'
    ORDER BY version DESC LIMIT 1
  `.catch(() => [])) as any[];
  if (vorlage) {
    await sqlPool`
      INSERT INTO fiaon_agent_contracts (agent_id, template_version, status, signed_at,
                                         signature_name, signature_mode, ip, user_agent,
                                         variables_json, rendered_html, doc_hash)
      VALUES (${agentId}, ${vorlage.version}, 'signed', NOW(),
              ${`PRUEFSTAND ${stempel}`}, 'typed', '127.0.0.1', 'PRUEFSTAND karte-buchungen',
              ${JSON.stringify({ pruefstand: stempel })},
              ${"<p>PRUEFSTAND — kein Rechtsnachweis.</p>"},
              ${`pruefstand-${stempel}`})
    `.catch((e) => log(`  (Vertrag: ${e?.message ?? e})`));
  } else {
    // Ein stilles Weiterlaufen wäre hier falsch: Ohne aktive Vorlage kann das
    // Gate NIE offen sein, und alle folgenden Prüfungen wären rot, ohne dass
    // etwas kaputt ist. Das muss dastehen, sonst sucht der nächste Leser den
    // Fehler in der Route.
    log("  !! Keine aktive Vertragsvorlage in fiaon_contract_templates.");
    log("     Das Gate (customerDataGate) kann damit nicht offen sein — die");
    log("     folgenden Prüfungen sagen dann nichts über die Karte aus.");
  }

  try {
    // ── Anmelden ───────────────────────────────────────────────────────────
    const an = await fetch(`${BASIS}/api/fiaon/agent/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: MAIL, password: pass }),
    });
    ok("Anmeldung des Testkontos", an.ok, `HTTP ${an.status}`);
    const keks = (an.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
    ok("Sitzungskeks erhalten", keks.length > 0);

    // ── DIE EIGENTLICHE PRÜFUNG: die Antwort der Einzelkarte ───────────────
    const r = await fetch(`${BASIS}/api/fiaon/agent/crm/kunden/${personId}`, {
      headers: { Cookie: keks },
    });
    ok("Die Einzelkarte antwortet", r.ok, `HTTP ${r.status}`);
    const j = await r.json().catch(() => null);
    const karte = j?.kunde;
    ok("Die Antwort enthält eine Karte", !!karte, JSON.stringify(j).slice(0, 160));

    // Das ist der Fehler von damals — und die Prüfung, die er nicht überlebt:
    ok("Die Karte hat ein Feld „buchungen“ (nicht undefined)",
      karte?.buchungen !== undefined,
      `buchungen = ${JSON.stringify(karte?.buchungen)}`);
    ok("Die Buchungen sind eine Liste", Array.isArray(karte?.buchungen));
    ok("Die angelegte Bestellung steht drin",
      Array.isArray(karte?.buchungen) && karte.buchungen.some((b: any) => b.ref === REF),
      `gefunden: ${JSON.stringify((karte?.buchungen ?? []).map((b: any) => b.ref))}`);

    // ── DIE ABLEITUNG, DIE DIE OBERFLÄCHE RECHNET ──────────────────────────
    // Nachgerechnet mit derselben Bedingung wie in kunden-neu.tsx. Ein Feld,
    // das existiert, aber die Sperre trotzdem auslöst, wäre nichts gewonnen.
    const buchungen = (karte?.buchungen ?? []) as any[];
    const hatOffene = buchungen.some((b) => b.offen);
    ok("Die Sperrgrund-Ableitung findet eine Bestellung", buchungen.length > 0,
      `${buchungen.length} Buchungen`);
    ok("… und darunter eine OFFENE (der Versand ist damit nicht gesperrt)", hatOffene,
      `Zustände: ${buchungen.map((b) => b.zahlungsstand).join(", ")}`);

    // ── UND DER WEG, DEN DER PRODUKT-DIALOG NIMMT ──────────────────────────
    // Er sucht sich eine Referenz aus den Buchungen. Ist die Liste leer, meldet
    // er „Diese Akte hat keine Bestellung" — genau die zweite Meldung.
    const refFuerProdukt = buchungen.find((b) => !b.erledigt)?.ref ?? buchungen[0]?.ref;
    ok("Der Produkt-Dialog findet eine Referenz zum Anhängen", !!refFuerProdukt,
      `ref = ${refFuerProdukt}`);
  } finally {
    // ── AUFRÄUMEN LÄUFT IMMER ──────────────────────────────────────────────
    // Nicht nur im Erfolgsfall: Ein Aufräumen, das nur bei Erfolg läuft, läuft
    // genau dann nicht, wenn etwas liegen geblieben ist (AGENTS.md 19.08.2026).
    await sqlPool`
      UPDATE fiaon_applications SET archived_at = NOW(),
             archiv_grund = 'Testeintrag (Prüfstand Karte/Buchungen)'
      WHERE ref = ${REF}
    `.catch(async () => {
      await sqlPool`UPDATE fiaon_applications SET archived_at = NOW() WHERE ref = ${REF}`.catch(() => {});
    });
    await sqlPool`
      UPDATE fiaon_persons SET ist_test_am = NOW(), is_blocked = TRUE,
             assigned_agent_id = NULL, updated_at = NOW()
      WHERE id = ${personId}
    `.catch(() => {});
    // Die Prüfstands-Zustimmungen und der Prüfstands-Vertrag verschwinden mit
    // dem Konto. Sie sind keine Rechtsnachweise über einen Menschen — sie
    // gehören zu einer Kennung, die es nach diesem Lauf nicht mehr gibt.
    await sqlPool`DELETE FROM fiaon_agent_consents WHERE agent_id = ${agentId}`.catch(() => {});
    await sqlPool`DELETE FROM fiaon_agent_contracts WHERE agent_id = ${agentId}`.catch(() => {});
    await testkontoStilllegen(agentId).catch(() => {});
  }

  log(`\n══ Ergebnis: ${bestanden} bestanden, ${fehlgeschlagen} fehlgeschlagen ══\n`);
  if (fehler.length > 0) {
    log("Fehlgeschlagen:");
    for (const f of fehler) log(`  · ${f}`);
    log("");
  }
  await sqlPool.end();
  process.exit(fehlgeschlagen > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
