// ═══════════════════════════════════════════════════════════════════════════
// WARUM KANN HERR HERTEL KEINE ZEIT WÄHLEN?
//
// ── DIE MELDUNG (telefonisch, 19.08.2026) ──────────────────────────────────
// Ein Kunde kann im Startgespräch-Kalender keine Zeit auswählen.
//
// ── DER WICHTIGSTE MESSWERT ────────────────────────────────────────────────
// Wie viele freie Zeiten stehen in den nächsten 14 Tagen überhaupt zur
// Verfügung — je Tag, und von WELCHEN Mitarbeitern?
//
// Die Rolle „onboarding" ist unbesetzt. Es gibt einen protokollierten Rückfall
// auf Vertrieb und Leitung (`rollenMitRueckfall`). Greift der nicht mehr, sieht
// der Kunde eine leere Woche — und das erlebt er als „ich kann keine Zeit
// wählen". Eine leere Fläche erklärt sich nicht selbst.
//
// ── UND DIE VERSUCHE ──────────────────────────────────────────────────────
// Seit dem 30.08.2026 wird jeder Buchungsversuch protokolliert
// (`fiaon_termin_versuche`, Migration 062). Jetzt wird ausgelesen, statt zu
// raten: Ergebnis-Codes, Häufigkeit, Uhrzeiten, betroffene Personen.
//
// NUR LESEND.
//
//   npx tsx scripts/mess-slots.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";

const log = (s = "") => console.log(s);
function titel(t: string): void { log(`\n${"═".repeat(78)}\n${t}\n${"═".repeat(78)}`); }
const feld = (v: unknown): string => {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

async function main(): Promise<void> {
  mkdirSync("reports", { recursive: true });

  // ═════════════════════════════════════════════════════════════════════════
  titel("1. DIE BUCHUNGSVERSUCHE — AUSGELESEN, NICHT GERATEN");
  // ═════════════════════════════════════════════════════════════════════════
  const [stand] = (await sqlPool`
    SELECT COUNT(*)::int AS gesamt, MIN(versucht_am) AS seit,
           COUNT(*) FILTER (WHERE ergebnis = 'gebucht')::int AS gebucht,
           COUNT(*) FILTER (WHERE ergebnis = 'abgelehnt')::int AS abgelehnt
    FROM fiaon_termin_versuche
  `) as any[];
  log("");
  log(`  ${String(stand.gesamt).padStart(5)}  Versuche protokolliert (seit ${stand.seit ?? "—"})`);
  log(`  ${String(stand.gebucht).padStart(5)}  gebucht`);
  log(`  ${String(stand.abgelehnt).padStart(5)}  abgelehnt`);
  if (Number(stand.gesamt) === 0) {
    log("");
    log("  ── ZUR LESART ──────────────────────────────────────────────────────");
    log("  Kein einziger Versuch. Das heißt NICHT „es hat niemand versucht“ und");
    log("  auch nicht „alles klappt“ — es heißt: In der Zeit seit dem Einbau am");
    log("  30.08.2026 hat niemand die Buchungsseite benutzt, oder sie war nicht");
    log("  erreichbar. Für den Anruf von Herrn Hertel gibt es diese Zahl nicht.");
    log("  Der Befund muss deshalb aus den SLOTS kommen (Abschnitt 3).");
  } else {
    const gruende = (await sqlPool`
      SELECT grund, COUNT(*)::int AS n FROM fiaon_termin_versuche
      WHERE ergebnis = 'abgelehnt' GROUP BY grund ORDER BY n DESC
    `) as any[];
    log("");
    for (const g of gruende) log(`     ${String(g.grund).padEnd(20)} ${String(g.n).padStart(5)}`);
    const stunden = (await sqlPool`
      SELECT EXTRACT(HOUR FROM versucht_am AT TIME ZONE 'Europe/Berlin')::int AS stunde,
             COUNT(*) FILTER (WHERE ergebnis = 'gebucht')::int AS gebucht,
             COUNT(*) FILTER (WHERE ergebnis = 'abgelehnt')::int AS abgelehnt
      FROM fiaon_termin_versuche GROUP BY 1 ORDER BY 1
    `) as any[];
    log("");
    log("  Nach Stunde (Berlin):");
    for (const s of stunden) {
      log(`     ${String(s.stunde).padStart(2, "0")} Uhr  gebucht ${String(s.gebucht).padStart(4)}`
        + `  abgelehnt ${String(s.abgelehnt).padStart(4)}`);
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("2. HERR HERTEL");
  // ═════════════════════════════════════════════════════════════════════════
  const hertel = (await sqlPool`
    SELECT p.id, p.person_ref, p.primary_email, p.primary_phone,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name) AS name,
           p.priority_tier,
           (SELECT COUNT(*)::int FROM fiaon_termine t WHERE t.person_id = p.id) AS termine,
           (SELECT COUNT(*)::int FROM fiaon_termin_versuche v WHERE v.person_id = p.id) AS versuche
    FROM fiaon_persons p
    WHERE p.merged_into_person_id IS NULL
      AND (LOWER(COALESCE(p.last_name, '')) LIKE '%hertel%'
        OR LOWER(COALESCE(p.company_name, '')) LIKE '%hertel%')
  `) as any[];
  log("");
  if (hertel.length === 0) log("  Kein Kunde namens Hertel im Bestand.");
  for (const h of hertel) {
    log(`  Person ${h.id} (${h.person_ref}) — ${h.name}`);
    log(`     Stufe ${h.priority_tier}, ${h.termine} Termin(e), ${h.versuche} protokollierte Versuche`);
    log(`     ${h.primary_email ?? "keine Mail"} / ${h.primary_phone ?? "keine Nummer"}`);
    const v = (await sqlPool`
      SELECT versucht_am, ergebnis, grund, slot_beginn, agent_id, quelle
      FROM fiaon_termin_versuche WHERE person_id = ${h.id} ORDER BY versucht_am DESC
    `) as any[];
    for (const x of v) {
      log(`        ${String(x.versucht_am).slice(0, 19)}  ${x.ergebnis}`
        + `${x.grund ? ` (${x.grund})` : ""}  Slot ${x.slot_beginn ?? "—"}`);
    }
    if (v.length === 0) {
      log("        Keine protokollierten Versuche — er hat die Seite nie geöffnet,");
      log("        ODER er hat es vor dem 30.08.2026 versucht (da wurde noch nicht");
      log("        protokolliert), ODER die Seite hat ihm gar keine Zeiten gezeigt.");
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("3. DER WICHTIGSTE MESSWERT: FREIE SLOTS JE TAG, 14 TAGE");
  // ═════════════════════════════════════════════════════════════════════════
  const { freieSlots, rollenMitRueckfall } = await import("../server/lib/fiaon-termine");

  // Wer darf Startgespräche annehmen — und greift der Rückfall?
  const rollen = await rollenMitRueckfall("onboarding");
  log("");
  log(`  Rollen für „onboarding“ nach Rückfall: ${JSON.stringify(rollen)}`);
  const [besetzt] = (await sqlPool`
    SELECT COUNT(*) FILTER (WHERE COALESCE(rolle, 'agent') = 'onboarding' AND active
                              AND NOT COALESCE(is_test_account, FALSE))::int AS onboarding,
           COUNT(*) FILTER (WHERE COALESCE(rolle, 'agent') IN ('agent', 'vertriebsleiter') AND active
                              AND NOT COALESCE(is_test_account, FALSE))::int AS vertrieb
    FROM fiaon_agents
  `) as any[];
  log(`  Aktive Mitarbeiter mit Rolle onboarding: ${besetzt.onboarding}`);
  log(`  Aktive im Vertrieb/Leitung (der Rückfall): ${besetzt.vertrieb}`);

  // Ein wartender Kunde als Bezugspunkt: Die Slots hängen am Besitzschutz.
  const [wartend] = (await sqlPool`
    SELECT p.id, COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                          p.company_name, p.person_ref) AS name
    FROM fiaon_persons p
    JOIN fiaon_applications a ON a.person_id = p.id AND a.merged_into IS NULL
      AND a.payment_status = 'paid'
    WHERE p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL
      AND NOT EXISTS (SELECT 1 FROM fiaon_termine t WHERE t.person_id = p.id)
    ORDER BY a.paid_at ASC NULLS LAST LIMIT 1
  `) as any[];
  log("");
  log(`  Bezugskunde (bezahlt, ohne Termin): Person ${wartend?.id} — ${wartend?.name}`);

  for (const quelle of ["onboarding_call", "nichterreicht_mail"] as const) {
    const auskunft = await freieSlots(Number(wartend?.id ?? 0), sqlPool, quelle);
    const jeTag = new Map<string, { anzahl: number; agenten: Set<string> }>();
    for (const s of auskunft.slots) {
      const tag = String(s.beginn).slice(0, 10);
      if (!jeTag.has(tag)) jeTag.set(tag, { anzahl: 0, agenten: new Set() });
      const e = jeTag.get(tag)!;
      e.anzahl++;
      e.agenten.add(String((s as any).agentName ?? (s as any).agentId ?? "?"));
    }
    log("");
    log(`  ── Quelle „${quelle}“ ─────────────────────────────────────────────`);
    log(`     ${auskunft.slots.length} freie Zeiten insgesamt in den nächsten 14 Tagen`);
    if ((auskunft as any).hinweis) log(`     Hinweis: ${(auskunft as any).hinweis}`);
    if (auskunft.slots.length === 0) {
      log("     ⚠ KEINE EINZIGE. Der Kunde sieht einen leeren Kalender.");
    }
    for (const [tag, e] of Array.from(jeTag.entries()).sort()) {
      log(`     ${tag}  ${String(e.anzahl).padStart(3)} Zeiten  von ${Array.from(e.agenten).join(", ").slice(0, 60)}`);
    }
    // Und die Tage OHNE Zeiten — das ist die Frage des Kunden.
    const heute = new Date();
    const leer: string[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(heute.getTime() + i * 86_400_000);
      const tag = d.toISOString().slice(0, 10);
      if (!jeTag.has(tag)) leer.push(tag);
    }
    log(`     Tage OHNE freie Zeit: ${leer.length} von 14${leer.length > 0 ? ` (${leer.slice(0, 8).join(", ")}${leer.length > 8 ? " …" : ""})` : ""}`);
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("4. DIE VERFÜGBARKEITSFENSTER — HAT ÜBERHAUPT JEMAND ZEITEN HINTERLEGT?");
  // ═════════════════════════════════════════════════════════════════════════
  const fenster = (await sqlPool`
    SELECT ag.id, ag.name, COALESCE(ag.rolle, 'agent') AS rolle, ag.active,
           COUNT(v.id)::int AS fenster,
           COUNT(v.id) FILTER (WHERE v.aktiv)::int AS aktive
    FROM fiaon_agents ag
    LEFT JOIN fiaon_termin_verfuegbarkeit v ON v.agent_id = ag.id
    WHERE ag.active AND NOT COALESCE(ag.is_test_account, FALSE)
    GROUP BY ag.id, ag.name, ag.rolle, ag.active
    ORDER BY aktive DESC, ag.name
  `.catch(() => [])) as any[];
  log("");
  log(`  ${"Mitarbeiter".padEnd(24)} ${"Rolle".padEnd(16)} ${"Fenster".padStart(8)} ${"aktiv".padStart(6)}`);
  log(`  ${"-".repeat(58)}`);
  for (const f of fenster) {
    log(`  ${String(f.name).slice(0, 23).padEnd(24)} ${String(f.rolle).padEnd(16)}`
      + ` ${String(f.fenster).padStart(8)} ${String(f.aktive).padStart(6)}`);
  }
  const ohneFenster = fenster.filter((f) => Number(f.aktive) === 0).length;
  log("");
  log(`  ${ohneFenster} von ${fenster.length} aktiven Mitarbeitern haben KEIN aktives Zeitfenster.`);
  log("  Ohne Fenster gibt es keine Slots — dann ist der Kalender leer, ganz");
  log("  unabhängig von Rollen und Rückfall.");

  writeFileSync("reports/slots.csv",
    "mitarbeiter;rolle;fenster;aktive_fenster\n"
    + fenster.map((f) => [f.name, f.rolle, f.fenster, f.aktive].map(feld).join(";")).join("\n") + "\n",
    "utf8");
  log("");
  log("  reports/slots.csv");
  log("");
  await sqlPool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
