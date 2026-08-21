// ═══════════════════════════════════════════════════════════════════════════
// MESSEN VOR ÄNDERN — Zuständigkeit, paid_at, Abo-Fälligkeit, Inkasso-Differenz
//
// Vier Fragen, die vor jeder Zeile Code beantwortet sein müssen:
//
//   1  Wie viele der 35 Startgespräche seit dem 20.08. wären mit der neuen
//      Regel („die Rolle bestimmt die Terminart") anders gelandet?
//   2  Woher kommen die 81 Kunden ohne `paid_at`? Welcher Weg setzt es nicht?
//   3  Stimmen die Abo-Fälligkeiten mit dem absoluten Zahldatum überein — oder
//      sind sie über die Monate weggewandert?
//   4  Welche Fälle stehen NUR in der Inkasso-Arbeitsliste (339) und nicht in
//      der Ableitung (151)? Und warum?
//
// NUR LESEND. Schreibt reports/paid-at-rekonstruktion.csv und
// reports/inkasso-differenz.csv.
//
//   npx tsx scripts/mess-zustaendigkeit-abo.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import { zustaendigeRolleSql, UEBERFAELLIG_AB_TAGEN } from "../server/lib/fiaon-zustaendigkeit";
import { ankerTag, faelligkeit, kurzTag } from "../server/lib/fiaon-abo-zyklus";

const log = (s = "") => console.log(s);
function titel(t: string): void { log(`\n${"═".repeat(74)}\n${t}\n${"═".repeat(74)}`); }
const z = (n: number, b = 6) => String(n).padStart(b);

function csvFeld(w: unknown): string {
  const s = w == null ? "" : String(w);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function csv(datei: string, kopf: string[], zeilen: unknown[][]): void {
  mkdirSync("reports", { recursive: true });
  writeFileSync(datei, "\uFEFF" + [kopf, ...zeilen].map((r) => r.map(csvFeld).join(";")).join("\n"));
  log(`\n  → ${datei} (${zeilen.length} Zeilen)`);
}

async function main(): Promise<void> {
  // ═══════════════════════════════════════════════════════════════════════
  titel("1 — WÄRE MIT DER NEUEN REGEL EIN TERMIN ANDERS GELANDET?");
  // ═══════════════════════════════════════════════════════════════════════
  // Die alte Regel: Die Quelle kam aus dem Link (`?art=start`), die Rolle aus
  // der Quelle. Die neue: Der Zustand des Kunden bestimmt die Quelle.
  //
  // Für jeden Termin seit dem 20.08. wird geprüft: Was hätte die Ableitung
  // ZUM ZEITPUNKT DER BUCHUNG gesagt? Näherung — der Zustand von heute, denn
  // rückwirkend ist er nicht rekonstruierbar. Das steht ausdrücklich hier,
  // damit die Zahl nicht mehr behauptet, als sie kann.
  const termine = (await sqlPool.unsafe(`
    SELECT t.id, t.quelle, t.beginn, t.created_at, t.quelle AS buchungsweg,
           COALESCE(ag.rolle, 'agent') AS gebucht_bei_rolle, ag.name AS gebucht_bei,
           p.id AS person_id,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), 'Ohne Namen') AS kunde,
           ${zustaendigeRolleSql("p")} AS soll_rolle
    FROM fiaon_termine t
    JOIN fiaon_persons p ON p.id = t.person_id
    LEFT JOIN fiaon_agents ag ON ag.id = t.agent_id
    WHERE t.created_at >= '2026-08-20' AND t.abgesagt_am IS NULL
    ORDER BY t.created_at
  `)) as any[];

  const QUELLE_FUER: Record<string, string> = {
    onboarding: "onboarding_call", vertrieb: "nichterreicht_mail", inkasso: "inkasso_call",
  };
  const ROLLEN_FUER: Record<string, string[]> = {
    onboarding: ["onboarding", "vertriebsleiter", "admin"],
    vertrieb: ["agent", "vertriebsleiter", "admin"],
    inkasso: ["inkasso", "vertriebsleiter", "admin"],
  };

  const andersQuelle = termine.filter((t) => QUELLE_FUER[String(t.soll_rolle)] !== String(t.quelle));
  const andersRolle = termine.filter((t) =>
    !ROLLEN_FUER[String(t.soll_rolle)].includes(String(t.gebucht_bei_rolle)));

  log(`  ${z(termine.length)}  Termine seit dem 20.08. (alle Arten)`);
  log(`  ${z(termine.filter((t) => String(t.quelle) === "onboarding_call").length)}  davon Startgespräche`);
  log(`  ${z(andersQuelle.length)}  hätten eine ANDERE Gesprächsart bekommen`);
  log(`  ${z(andersRolle.length)}  liegen bei einer Rolle, die NICHT zuständig ist`);

  log("\n  Aufschlüsselung nach Ist-Quelle → Soll-Quelle:");
  const paare = new Map<string, number>();
  for (const t of termine) {
    const k = `${t.quelle} → ${QUELLE_FUER[String(t.soll_rolle)]}`;
    paare.set(k, (paare.get(k) ?? 0) + 1);
  }
  for (const [k, n] of Array.from(paare.entries()).sort((a, b) => b[1] - a[1])) {
    log(`    ${z(n, 5)}  ${k}${k.split(" → ")[0] === k.split(" → ")[1] ? "  (unverändert)" : "  ← ANDERS"}`);
  }

  if (andersQuelle.length > 0) {
    log("\n  Die betroffenen Termine:");
    for (const t of andersQuelle.slice(0, 15)) {
      log(`    #${String(t.id).padEnd(5)} ${String(t.kunde).slice(0, 22).padEnd(23)} `
        + `${String(t.quelle).padEnd(20)} → ${String(QUELLE_FUER[String(t.soll_rolle)]).padEnd(20)} `
        + `liegt bei ${String(t.gebucht_bei ?? "-").slice(0, 18)} (${t.gebucht_bei_rolle})`);
    }
    if (andersQuelle.length > 15) log(`    … und ${andersQuelle.length - 15} weitere`);
  }

  // ═══════════════════════════════════════════════════════════════════════
  titel("2 — WOHER KOMMEN DIE KUNDEN OHNE ZAHLDATUM?");
  // ═══════════════════════════════════════════════════════════════════════
  const ohne = (await sqlPool`
    SELECT a.ref, a.person_id, a.payment_status, a.pack_key, a.amount_due,
           a.completed_at, a.created_at, a.updated_at, a.payment_reference,
           a.payment_proof_at, a.payment_proof_by, a.claimed_paid_at,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, 'Ohne Namen') AS name,
           -- Quelle A: eine angewendete Bankbuchung
           (SELECT MIN(t.booked_at) FROM fiaon_bank_txns t
             WHERE t.matched_ref = a.ref AND t.applied) AS bank_am,
           -- Quelle B: der Akteneintrag, mit dem ein Mensch es verbucht hat
           (SELECT MIN(cl.created_at) FROM fiaon_contact_log cl
             WHERE cl.ref = a.ref AND cl.voided_at IS NULL
               AND (cl.note ILIKE '%als bezahlt%' OR cl.note ILIKE '%Zahlung gebucht%'
                 OR cl.note ILIKE '%freigeschaltet%')) AS akte_am,
           -- Quelle C: die Willkommens-/Freischaltungsmail
           (SELECT MIN(l.created_at) FROM fiaon_mail_log l
             WHERE l.person_id = a.person_id AND l.status = 'versandt'
               AND l.event IN ('welcome', 'onboarding_einladung')) AS mail_am,
           -- Quelle D: die erste Rate der Kette (ein Monat vor ihrer Fälligkeit)
           (SELECT MIN(r.faellig_am) FROM fiaon_abo_raten r
             WHERE r.ref = a.ref AND r.storniert_am IS NULL) AS erste_faelligkeit
    FROM fiaon_applications a
    LEFT JOIN fiaon_persons p ON p.id = a.person_id
    WHERE a.payment_status = 'paid' AND a.paid_at IS NULL
      AND a.merged_into IS NULL AND a.archived_at IS NULL AND a.gdpr_deleted_at IS NULL
    ORDER BY a.completed_at NULLS LAST
  `) as any[];

  log(`  ${z(ohne.length)}  bezahlte Bestellungen OHNE paid_at`);
  const mitBank = ohne.filter((r) => r.bank_am);
  const mitAkte = ohne.filter((r) => !r.bank_am && r.akte_am);
  const mitMail = ohne.filter((r) => !r.bank_am && !r.akte_am && r.mail_am);
  const mitKette = ohne.filter((r) => !r.bank_am && !r.akte_am && !r.mail_am && r.erste_faelligkeit);
  const nurAbschluss = ohne.filter((r) => !r.bank_am && !r.akte_am && !r.mail_am && !r.erste_faelligkeit);
  log(`  ${z(mitBank.length)}  rekonstruierbar aus einer Bankbuchung   (bester Beleg)`);
  log(`  ${z(mitAkte.length)}  rekonstruierbar aus dem Akteneintrag`);
  log(`  ${z(mitMail.length)}  rekonstruierbar aus dem Zustellprotokoll`);
  log(`  ${z(mitKette.length)}  rekonstruierbar aus der Ratenkette      (schwächster Beleg)`);
  log(`  ${z(nurAbschluss.length)}  NICHT rekonstruierbar — nur der Antragsabschluss`);

  log("\n  Wann wurden diese Bestellungen abgeschlossen? (verrät den Weg)");
  const monate = new Map<string, number>();
  for (const r of ohne) {
    const m = r.completed_at ? new Date(r.completed_at).toISOString().slice(0, 7) : "(leer)";
    monate.set(m, (monate.get(m) ?? 0) + 1);
  }
  for (const [m, n] of Array.from(monate.entries()).sort()) log(`    ${m}  ${z(n, 5)}`);

  log("\n  Und wie viele HABEN ein paid_at? (zum Vergleich)");
  const [mit] = (await sqlPool`
    SELECT COUNT(*)::int AS n,
           COUNT(*) FILTER (WHERE paid_at IS NOT NULL)::int AS mit_datum
    FROM fiaon_applications
    WHERE payment_status = 'paid' AND merged_into IS NULL
      AND archived_at IS NULL AND gdpr_deleted_at IS NULL
  `) as any[];
  log(`    ${z(Number(mit.mit_datum))} von ${mit.n} bezahlten Bestellungen tragen ein paid_at `
    + `(${(100 * Number(mit.mit_datum) / Number(mit.n)).toFixed(1)} %)`);

  csv("reports/paid-at-rekonstruktion.csv",
    ["ref", "person_id", "name", "paket", "betrag", "abgeschlossen_am",
      "vorschlag_paid_at", "quelle_des_vorschlags", "guete",
      "bank_am", "akte_am", "mail_am", "erste_faelligkeit"],
    ohne.map((r) => {
      const bank = ankerTag(r.bank_am);
      const akte = ankerTag(r.akte_am);
      const mail = ankerTag(r.mail_am);
      const kette = r.erste_faelligkeit ? (() => {
        const d = new Date(`${ankerTag(r.erste_faelligkeit)}T12:00:00Z`);
        d.setUTCMonth(d.getUTCMonth() - 1);
        return d.toISOString().slice(0, 10);
      })() : null;
      const vorschlag = bank ?? akte ?? mail ?? kette;
      const quelle = bank ? "Bankbuchung" : akte ? "Akteneintrag"
        : mail ? "Zustellprotokoll" : kette ? "Ratenkette (ein Monat vor erster Fälligkeit)"
        : "keine Quelle";
      const guete = bank ? "sicher" : akte ? "gut" : mail ? "brauchbar" : kette ? "schwach" : "keine";
      return [r.ref, r.person_id ?? "", r.name, r.pack_key ?? "", r.amount_due ?? "",
        r.completed_at ? new Date(r.completed_at).toLocaleDateString("de-DE") : "",
        vorschlag ?? "", quelle, guete,
        bank ?? "", akte ?? "", mail ?? "",
        r.erste_faelligkeit ? ankerTag(r.erste_faelligkeit) : ""];
    }));

  // ═══════════════════════════════════════════════════════════════════════
  titel("3 — LIEGEN DIE FÄLLIGKEITEN AUF DEM JAHRESTAG DES ZAHLDATUMS?");
  // ═══════════════════════════════════════════════════════════════════════
  const raten = (await sqlPool`
    SELECT r.id, r.ref, r.rate_nr, r.faellig_am, r.betrag_cents, r.status,
           a.paid_at, a.pack_key, a.amount_due
    FROM fiaon_abo_raten r
    JOIN fiaon_applications a ON a.ref = r.ref
    WHERE r.storniert_am IS NULL AND a.paid_at IS NOT NULL AND a.merged_into IS NULL
    ORDER BY r.ref, r.rate_nr
  `) as any[];

  let passt = 0;
  let danebenTage: number[] = [];
  const abweichend: any[] = [];
  for (const r of raten) {
    const anker = ankerTag(r.paid_at);
    if (!anker) continue;
    // Rate 1 ist die Startzahlung und liegt AUF dem Anker; ab Rate 2 gilt der
    // Jahrestag. Genau die Rechnung aus fiaon-abo-zyklus.ts, nicht eine zweite.
    const soll = Number(r.rate_nr) === 1 ? anker : faelligkeit(anker, Number(r.rate_nr) - 1);
    const ist = ankerTag(r.faellig_am)!;
    if (ist === soll) passt++;
    else {
      const d = Math.round((new Date(`${ist}T12:00:00Z`).getTime()
        - new Date(`${soll}T12:00:00Z`).getTime()) / 86_400_000);
      danebenTage.push(d);
      abweichend.push({ ...r, soll, ist, d });
    }
  }
  log(`  ${z(raten.length)}  Raten mit bekanntem Zahldatum`);
  log(`  ${z(passt)}  liegen genau auf dem Jahrestag`);
  log(`  ${z(abweichend.length)}  weichen ab`);
  if (danebenTage.length > 0) {
    danebenTage.sort((a, b) => a - b);
    log(`      Abweichung: von ${danebenTage[0]} bis ${danebenTage[danebenTage.length - 1]} Tagen, `
      + `Mitte ${danebenTage[Math.floor(danebenTage.length / 2)]}`);
    log("\n  Die zehn stärksten Abweichungen:");
    for (const r of abweichend.sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 10)) {
      log(`    ${String(r.ref).padEnd(22)} Rate ${String(r.rate_nr).padStart(2)}  `
        + `ist ${r.ist}  soll ${r.soll}  (${r.d > 0 ? "+" : ""}${r.d} Tage)  ${r.status}`);
    }
  }

  // Der Monatsend-Fall, an dem sich jede Rechnung beweist.
  log("\n  Monatsende-Probe (reine Rechnung, ohne Datenbank):");
  for (const [anker, n, erwartet] of [
    ["2026-01-31", 1, "2026-02-28"], ["2026-01-31", 2, "2026-03-31"],
    ["2028-01-31", 1, "2028-02-29"], ["2026-07-05", 1, "2026-08-05"],
    ["2026-08-31", 1, "2026-09-30"], ["2026-08-31", 2, "2026-10-31"],
  ] as [string, number, string][]) {
    const ist = faelligkeit(anker, n);
    log(`    ${anker} + ${n} Monat(e) = ${ist}  ${ist === erwartet ? "ok" : `ROT (erwartet ${erwartet})`}`);
  }

  // Laufzeit: gibt es Ketten über 12 Monatsraten hinaus?
  const [lang] = (await sqlPool`
    SELECT COUNT(*)::int AS n, MAX(rate_nr)::int AS hoechste
    FROM fiaon_abo_raten WHERE storniert_am IS NULL AND rate_nr > 13
  `) as any[];
  log(`\n  Raten jenseits von Rate 13 (= 12 Monatsraten + Startzahlung): ${lang.n}`
    + ` (höchste Ratennummer im Bestand: ${lang.hoechste ?? "-"})`);

  // ═══════════════════════════════════════════════════════════════════════
  titel("4 — DIE INKASSO-DIFFERENZ: WER STEHT NUR IN DER ARBEITSLISTE?");
  // ═══════════════════════════════════════════════════════════════════════
  const diff = (await sqlPool.unsafe(`
    SELECT p.id AS person_id,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, 'Ohne Namen') AS name,
           ${zustaendigeRolleSql("p")} AS ableitung,
           (SELECT COUNT(*)::int FROM fiaon_abo_raten r
             JOIN fiaon_applications ar ON ar.ref = r.ref
             WHERE ar.person_id = p.id AND ar.merged_into IS NULL AND r.status <> 'bezahlt') AS offene_raten,
           (SELECT MIN(r.faellig_am) FROM fiaon_abo_raten r
             JOIN fiaon_applications ar ON ar.ref = r.ref
             WHERE ar.person_id = p.id AND ar.merged_into IS NULL AND r.status <> 'bezahlt') AS erste_faellig,
           (SELECT MAX(r.mahnstufe) FROM fiaon_abo_raten r
             JOIN fiaon_applications ar ON ar.ref = r.ref
             WHERE ar.person_id = p.id AND ar.merged_into IS NULL AND r.status <> 'bezahlt') AS mahnstufe,
           (SELECT COUNT(*)::int FROM fiaon_abo_raten r
             JOIN fiaon_applications ar ON ar.ref = r.ref
             WHERE ar.person_id = p.id AND ar.merged_into IS NULL AND r.status <> 'bezahlt'
               AND r.inkasso_agent_id IS NOT NULL) AS zugewiesen
    FROM fiaon_persons p
    WHERE p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL
      AND NOT COALESCE(p.is_blocked, FALSE)
      -- Die ARBEITSLISTE: jede offene Rate, unabhängig von Datum und Stufe.
      AND EXISTS (SELECT 1 FROM fiaon_abo_raten r
        JOIN fiaon_applications ar ON ar.ref = r.ref
        WHERE ar.person_id = p.id AND ar.merged_into IS NULL
          AND ar.gdpr_deleted_at IS NULL AND r.status <> 'bezahlt')
    ORDER BY p.id
  `)) as any[];

  const nurListe = diff.filter((r) => String(r.ableitung) !== "inkasso");
  const beide = diff.filter((r) => String(r.ableitung) === "inkasso");
  log(`  ${z(diff.length)}  in der ARBEITSLISTE (jede offene Rate)`);
  log(`  ${z(beide.length)}  auch in der ABLEITUNG (zustaendig = inkasso)`);
  log(`  ${z(nurListe.length)}  NUR in der Arbeitsliste — das ist die Differenz`);

  const heute = new Date().toISOString().slice(0, 10);
  const gruende = new Map<string, number>();
  for (const r of nurListe) {
    const f = r.erste_faellig ? ankerTag(r.erste_faellig)! : null;
    const grund = !f ? "Rate ohne Fälligkeitsdatum"
      : f > heute ? `Rate erst in der Zukunft fällig (${kurzTag(f)})`
      : "unklar";
    // Zukunftsraten nach Abstand bündeln, sonst gibt es 150 Einzelgründe.
    const k = grund.startsWith("Rate erst") ? "Rate ist noch NICHT fällig" : grund;
    gruende.set(k, (gruende.get(k) ?? 0) + 1);
  }
  log("\n  Warum stehen sie nur in der Arbeitsliste?");
  for (const [g, n] of Array.from(gruende.entries()).sort((a, b) => b[1] - a[1])) {
    log(`    ${z(n, 5)}  ${g}`);
  }
  log(`\n  (Überfällig heißt in der Ableitung: fällig vor mehr als ${UEBERFAELLIG_AB_TAGEN - 1} Tag(en))`);

  csv("reports/inkasso-differenz.csv",
    ["person_id", "name", "ableitung", "offene_raten", "erste_faelligkeit",
      "tage_bis_faellig", "hoechste_mahnstufe", "raten_mit_inkasso_agent", "nur_in_arbeitsliste"],
    diff.map((r) => {
      const f = r.erste_faellig ? ankerTag(r.erste_faellig)! : null;
      const tage = f ? Math.round((new Date(`${f}T12:00:00Z`).getTime()
        - new Date(`${heute}T12:00:00Z`).getTime()) / 86_400_000) : "";
      return [r.person_id, r.name, r.ableitung, r.offene_raten, f ?? "",
        tage, r.mahnstufe ?? "", r.zugewiesen,
        String(r.ableitung) !== "inkasso" ? "ja" : "nein"];
    }));

  await sqlPool.end();
}
main().catch(async (e) => { console.error(e); await sqlPool.end(); process.exit(1); });
