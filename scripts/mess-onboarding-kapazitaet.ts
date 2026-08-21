// ═══════════════════════════════════════════════════════════════════════════
// REICHT DIE ONBOARDING-KAPAZITÄT? — MESSEN, BEVOR WIR ETWAS SCHLIESSEN
//
// ── DIE FRAGE DES BETREIBERS (21.08.2026) ─────────────────────────────────
// „Dein Rückfall greift, wenn keine Onboarding-Zeit frei ist. Wenn Onboarding
// chronisch voll ist, feuert er dauerhaft und wir haben das alte Problem mit
// Etikett."
//
// Das ist die richtige Frage. Der Rückfall vom 21.08. ist kein Fix, wenn er
// jeden Tag greift — dann ist er nur eine höflichere Fassung des Fehlers.
//
// ── WAS DIESER LAUF MISST ─────────────────────────────────────────────────
//   1. Freie Onboarding-Slots je Mitarbeiter, 14 Tage, im Tagesraster.
//   2. Wie oft hat der Rückfall seit dem 20.08. gegriffen? (aus dem
//      Termin-Protokoll und der Vertretungs-Marke)
//   3. Wie viele Startgespräche wurden seit dem 20.08. ÜBERHAUPT gebucht —
//      damit „keins mehr falsch zugeordnet" nicht mit „gar keins" verwechselt
//      wird. Diese Verwechslung wäre der teuerste Trugschluss dieser Woche.
//   4. Bezahlte Kunden OHNE Startgespräch, mit Alter seit der Zahlung.
//
// NUR LESEND. Schreibt reports/bezahlt-ohne-onboarding.csv.
//
//   npx tsx scripts/mess-onboarding-kapazitaet.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import { freieSlots, rollenFuerBuchung, HORIZONT_TAGE } from "../server/lib/fiaon-termine";

const log = (s = "") => console.log(s);
function titel(t: string): void { log(`\n${"═".repeat(74)}\n${t}\n${"═".repeat(74)}`); }
const z = (n: number, b = 6) => String(n).padStart(b);

function csvFeld(w: unknown): string {
  const s = w == null ? "" : String(w);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main(): Promise<void> {
  titel("1 — FREIE ONBOARDING-SLOTS, 14 TAGE, JE MITARBEITER");
  const onboarder = (await sqlPool`
    SELECT id, COALESCE(NULLIF(first_name, ''), name) AS vorname, name
    FROM fiaon_agents
    WHERE active AND NOT COALESCE(is_test_account, FALSE) AND rolle = 'onboarding'
    ORDER BY id
  `) as any[];
  log(`  ${onboarder.length} aktive Onboarding-Konten\n`);

  // ── DIE SLOT-RECHNUNG KOMMT AUS DEM SERVER ──────────────────────────────
  // `freieSlots` ist die Funktion, die auch der Kunde sieht. Eine eigene
  // Rechnung hier würde eine andere Zahl liefern als die Terminwahl — und dann
  // wäre die Messung wertlos.
  //
  // Sie braucht eine Person (der Slot ist personenbezogen: Vorlauf, Belegung).
  // Genommen wird ein echter Kunde, der auf ein Startgespräch wartet — der
  // ungünstigste Fall ist hier der realistische.
  const [pruef] = (await sqlPool`
    SELECT p.id, COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                          'Ohne Namen') AS name
    FROM fiaon_persons p
    JOIN fiaon_applications a ON a.person_id = p.id AND a.payment_status = 'paid'
      AND a.merged_into IS NULL AND a.archived_at IS NULL
    WHERE p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL
      AND NOT COALESCE(p.is_blocked, FALSE)
      AND NOT EXISTS (SELECT 1 FROM fiaon_termine t
        WHERE t.person_id = p.id AND t.quelle = 'onboarding_call' AND t.status = 'erledigt')
    ORDER BY a.paid_at NULLS LAST LIMIT 1
  `) as any[];

  if (!pruef) {
    log("  Kein wartender Kunde als Prüffall — die Slot-Messung entfällt.");
  } else {
    const entscheid = await rollenFuerBuchung("onboarding_call", Number(pruef.id));
    const auskunft = await freieSlots(Number(pruef.id), sqlPool, "onboarding_call");
    log(`  Prüffall: ${pruef.name} (Person ${pruef.id})`);
    log(`  Entscheid: rollen=[${(entscheid.rollen ?? []).join(", ")}] `
      + `rueckfall=${entscheid.rueckfall} grund=${entscheid.grund}`);
    log(`  Angebotene Zeiten (nach Verknappung, wie der Kunde sie sieht): ${auskunft.slots.length}`
      + (auskunft.vertretung ? "  ← als VERTRETUNG" : ""));

    // Das ROHE Angebot je Mitarbeiter — ohne Verknappung. Das ist die
    // Kapazität; die Verknappung ist nur die Anzeige.
    log("\n  Rohe freie Zeiten je Onboarding-Mitarbeiter (15-Minuten-Takt):");
    for (const o of onboarder) {
      const [n] = (await sqlPool`
        SELECT COUNT(*)::int AS belegt FROM fiaon_termine
        WHERE agent_id = ${Number(o.id)} AND status IN ('gebucht','erledigt','verpasst')
          AND beginn BETWEEN NOW() AND NOW() + (${HORIZONT_TAGE} || ' days')::interval
      `) as any[];
      const fenster = (await sqlPool`
        SELECT wochentag, to_char(von,'HH24:MI') AS von, to_char(bis,'HH24:MI') AS bis
        FROM fiaon_agent_verfuegbarkeit WHERE agent_id = ${Number(o.id)} AND aktiv
        ORDER BY wochentag
      `) as any[];
      const minutenJeWoche = fenster.reduce((s, f) => {
        const [vh, vm] = String(f.von).split(":").map(Number);
        const [bh, bm] = String(f.bis).split(":").map(Number);
        return s + (bh * 60 + bm - vh * 60 - vm);
      }, 0);
      const plaetze = Math.floor((minutenJeWoche / 15) * (HORIZONT_TAGE / 7));
      log(`    ${String(o.name).padEnd(22)} ${z(plaetze, 5)} Plätze in ${HORIZONT_TAGE} Tagen, `
        + `${z(Number(n.belegt), 4)} belegt → ${z(plaetze - Number(n.belegt), 5)} frei`);
    }
  }

  titel("2 — HAT DER RÜCKFALL SEIT DEM 20.08. GEGRIFFEN?");
  // Zwei Quellen, weil eine allein lügen könnte: die Marke am Termin
  // (Migration 071, gilt erst ab heute) und die Rolle des Zuständigen (gilt
  // rückwirkend).
  const rueckfall = (await sqlPool`
    SELECT to_char(t.created_at AT TIME ZONE 'Europe/Berlin', 'YYYY-MM-DD') AS tag,
           COUNT(*)::int AS gesamt,
           COUNT(*) FILTER (WHERE COALESCE(ag.rolle, 'agent') <> 'onboarding')::int AS fremde_rolle,
           COUNT(*) FILTER (WHERE t.vertretung IS TRUE)::int AS markiert
    FROM fiaon_termine t
    LEFT JOIN fiaon_agents ag ON ag.id = t.agent_id
    WHERE t.quelle = 'onboarding_call' AND t.created_at >= '2026-08-20'
    GROUP BY 1 ORDER BY 1
  `) as any[];
  log("  Tag         gebucht  fremde Rolle  als Vertretung markiert");
  log("  " + "─".repeat(60));
  for (const r of rueckfall) {
    log(`  ${r.tag}  ${z(r.gesamt, 7)}  ${z(r.fremde_rolle, 12)}  ${z(r.markiert, 22)}`);
  }
  const gesamt = rueckfall.reduce((s, r) => s + Number(r.gesamt), 0);
  const fremd = rueckfall.reduce((s, r) => s + Number(r.fremde_rolle), 0);
  log(`\n  ${z(gesamt)}  Startgespräche seit dem 20.08. gebucht`);
  log(`  ${z(fremd)}  davon bei einer fremden Rolle`);
  // Genau die Verwechslung, vor der der Betreiber gewarnt hat.
  log(gesamt === 0
    ? "\n  ACHTUNG: NULL Buchungen. „Keins falsch zugeordnet\u201c heißt hier „gar keins\u201c —\n"
      + "  das ist kein Erfolg, sondern ein zweiter Befund."
    : `\n  Die Quote ist aussagekräftig: ${gesamt} Buchungen sind eine Grundlage.`);

  titel("3 — ABLEHNUNGEN: WIRD JEMAND ABGEWIESEN?");
  const abgelehnt = (await sqlPool`
    SELECT to_char(versucht_am AT TIME ZONE 'Europe/Berlin', 'YYYY-MM-DD') AS tag,
           COALESCE(grund, '-') AS grund, COUNT(*)::int AS n
    FROM fiaon_termin_versuche
    WHERE quelle = 'onboarding_call' AND ergebnis = 'abgelehnt'
      AND versucht_am >= '2026-08-20'
    GROUP BY 1, 2 ORDER BY 1, 3 DESC
  `) as any[];
  if (abgelehnt.length === 0) log("  Keine Ablehnung seit dem 20.08.");
  for (const r of abgelehnt) log(`  ${r.tag}  ${z(r.n, 5)}  ${r.grund}`);

  titel("4 — BEZAHLTE KUNDEN OHNE STARTGESPRÄCH");
  const wartend = (await sqlPool`
    SELECT p.id,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, 'Ohne Namen') AS name,
           p.primary_email AS email, p.primary_phone AS telefon,
           MIN(a.paid_at) AS bezahlt_am,
           MAX(a.pack_name) AS paket,
           ag.name AS betreuer,
           (SELECT t.beginn FROM fiaon_termine t
             WHERE t.person_id = p.id AND t.quelle = 'onboarding_call'
               AND t.abgesagt_am IS NULL AND t.status = 'gebucht'
             ORDER BY t.beginn LIMIT 1) AS termin_gebucht,
           EXISTS (SELECT 1 FROM fiaon_applications ax
             WHERE ax.person_id = p.id AND ax.merged_into IS NULL
               AND ax.onboarding_pflicht = FALSE
               AND NULLIF(TRIM(COALESCE(ax.onboarding_ausnahme_grund, '')), '') IS NOT NULL) AS ausnahme
    FROM fiaon_persons p
    JOIN fiaon_applications a ON a.person_id = p.id AND a.payment_status = 'paid'
      AND a.merged_into IS NULL AND a.archived_at IS NULL AND a.gdpr_deleted_at IS NULL
      AND NOT (a.type = 'schufa' OR a.ref LIKE 'FIAON-SCHUFA-%')
    LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
    WHERE p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL
      AND NOT COALESCE(p.is_blocked, FALSE)
      AND NOT EXISTS (SELECT 1 FROM fiaon_termine t
        WHERE t.person_id = p.id AND t.quelle = 'onboarding_call' AND t.status = 'erledigt')
    GROUP BY p.id, p.first_name, p.last_name, p.company_name, p.primary_email,
             p.primary_phone, ag.name
    ORDER BY MIN(a.paid_at) NULLS LAST
  `) as any[];

  const alter = (d: unknown) => d
    ? Math.floor((Date.now() - new Date(d as string).getTime()) / 86_400_000) : null;
  const ohneAusnahme = wartend.filter((w) => !w.ausnahme);
  const mitTermin = ohneAusnahme.filter((w) => w.termin_gebucht);
  const ueber14 = ohneAusnahme.filter((w) => (alter(w.bezahlt_am) ?? 0) > 14);
  const ohneDatum = ohneAusnahme.filter((w) => !w.bezahlt_am);

  log(`  ${z(wartend.length)}  bezahlte Kunden ohne geführtes Startgespräch`);
  log(`  ${z(wartend.length - ohneAusnahme.length)}  davon mit ausdrücklicher Ausnahme (gehören nicht dazu)`);
  log(`  ${z(ohneAusnahme.length)}  bleiben — das ist die Zahl für die Kachel`);
  log(`  ${z(mitTermin.length)}  davon haben einen Termin (warten also richtig)`);
  log(`  ${z(ohneAusnahme.length - mitTermin.length)}  haben KEINEN Termin`);
  log(`  ${z(ueber14.length)}  warten länger als 14 Tage seit der Zahlung`);
  if (ohneDatum.length > 0) {
    log(`  ${z(ohneDatum.length)}  ohne Zahlungsdatum (paid_at leer) — Alter unbekannt`);
  }

  const spanne = ohneAusnahme.map((w) => alter(w.bezahlt_am)).filter((x): x is number => x != null);
  if (spanne.length > 0) {
    spanne.sort((a, b) => a - b);
    log(`\n  Alter seit Zahlung: jüngster ${spanne[0]} Tage, `
      + `Mitte ${spanne[Math.floor(spanne.length / 2)]}, ältester ${spanne[spanne.length - 1]}`);
  }

  log("\n  Die zehn ältesten:");
  for (const w of ohneAusnahme.slice(0, 10)) {
    log(`    ${String(w.id).padEnd(8)} ${String(w.name).slice(0, 28).padEnd(29)} `
      + `${String(alter(w.bezahlt_am) ?? "?").padStart(4)} Tage  `
      + `${w.termin_gebucht ? "Termin steht" : "kein Termin"}  ${w.betreuer ?? "ohne Betreuer"}`);
  }

  mkdirSync("reports", { recursive: true });
  writeFileSync("reports/bezahlt-ohne-onboarding.csv", "\uFEFF" + [
    ["person_id", "name", "email", "telefon", "paket", "bezahlt_am", "tage_seit_zahlung",
      "termin_gebucht", "betreuer", "ausnahme"],
    ...wartend.map((w) => [
      w.id, w.name, w.email ?? "", w.telefon ?? "", String(w.paket ?? "").split("\n")[0],
      w.bezahlt_am ? new Date(w.bezahlt_am).toLocaleDateString("de-DE") : "",
      alter(w.bezahlt_am) ?? "",
      w.termin_gebucht ? new Date(w.termin_gebucht).toLocaleString("de-DE") : "",
      w.betreuer ?? "", w.ausnahme ? "ja" : "nein",
    ]),
  ].map((r) => r.map(csvFeld).join(";")).join("\n"));
  log(`\n  → reports/bezahlt-ohne-onboarding.csv (${wartend.length} Zeilen)`);

  await sqlPool.end();
}
main().catch(async (e) => { console.error(e); await sqlPool.end(); process.exit(1); });
