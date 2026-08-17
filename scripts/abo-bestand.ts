// ═══════════════════════════════════════════════════════════════════════════
// BESTAND IN ORDNUNG BRINGEN — vier Läufe, jeder mit Vorschau
//
//   npx tsx scripts/abo-bestand.ts                    alle vier, nur Vorschau
//   npx tsx scripts/abo-bestand.ts storno             ein einzelner Lauf
//   npx tsx scripts/abo-bestand.ts zyklus --schreiben
//
// DIE LÄUFE
//   storno   Raten an Bestellungen OHNE bezahltes Paket entwerten (kein
//            Hard-Delete), Mahnstufen neutralisieren.
//   zyklus   Künftige Fälligkeiten auf den Jahrestag der Buchung ausrichten.
//            Bezahlte Raten bleiben unangetastet.
//   preise   Ultra 79,99 / High End 99,99 an OFFENEN Bestellungen und deren
//            offenen Raten. Bezahltes und Angekündigtes wird nur ausgewiesen.
//   anrufe   Anrufe, deren Nummer nicht zur verknüpften Person passt, an die
//            richtige Person umhängen.
//
// OHNE `--schreiben` PASSIERT NICHTS. Jeder Lauf legt eine CSV in reports/ ab.
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import { berlinToday } from "../server/lib/fiaon-time";
import { ankerTag, faelligkeit, kurzTag, zyklenBis } from "../server/lib/fiaon-abo-zyklus";
import { paketPreisCents } from "../shared/fiaon-pakete";
import { nummerKern } from "../server/lib/fiaon-anruf-eingehend";

const SCHREIBEN = process.argv.includes("--schreiben");
const WELCHE = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const laeuft = (name: string) => WELCHE.length === 0 || WELCHE.includes(name);

const log = (s = "") => console.log(s);
function titel(t: string): void {
  log(`\n${"═".repeat(70)}\n${t}${SCHREIBEN ? "   [SCHREIBT]" : "   [VORSCHAU]"}\n${"═".repeat(70)}`);
}

function feld(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function csv(datei: string, zeilen: Record<string, unknown>[]): string {
  mkdirSync("reports", { recursive: true });
  const pfad = `reports/${datei}`;
  if (zeilen.length === 0) { writeFileSync(pfad, "keine Treffer\n", "utf8"); return pfad; }
  const kopf = Object.keys(zeilen[0]);
  writeFileSync(pfad, `${[kopf.join(";"), ...zeilen.map((z) => kopf.map((k) => feld(z[k])).join(";"))].join("\n")}\n`, "utf8");
  return pfad;
}

/** Der Tag nach einer Fälligkeit — ab dann steht die Rate im Forderungsmanagement. */
function faelligkeitPlusEinTag(tag: string): string {
  const d = new Date(`${tag}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Ein Verlaufseintrag je Mensch — sonst weiß in vier Wochen niemand mehr, warum. */
async function verlauf(ref: string, text: string): Promise<void> {
  await sqlPool`
    INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
    VALUES (${ref}, NULL, 'System', 'system', ${text})
  `.catch(() => {});
}

// ═══════════════════════════════════════════════════════════════════════════
async function storno(): Promise<void> {
  titel("1. RATEN OHNE BEZAHLTES PAKET ENTWERTEN");
  // Entscheidung des Betreibers (16.08.2026): NUR Bestellungen ohne
  // payment_status = 'paid'. Die strengere Lesart („keine angewendete
  // Bankbuchung") träfe 196 Raten über 13.156 € — aber der Bank-Import deckt
  // nur den 03.07. bis 03.08. ab. Von 130 im August verbuchten Bestellungen
  // haben nur 24 eine Bankzeile. Diese Raten zu entwerten hieße, echte
  // Forderungen zu vernichten, weil eine CSV fehlt.
  const treffer = (await sqlPool`
    SELECT r.id, r.ref, r.rate_nr, r.betrag_cents, r.faellig_am, r.mahnstufe,
           r.erinnerungen, a.payment_status, a.person_id,
           TRIM(COALESCE(a.first_name,'') || ' ' || COALESCE(a.last_name,'')) AS name
    FROM fiaon_abo_raten r
    JOIN fiaon_applications a ON a.ref = r.ref
    WHERE r.status = 'offen' AND r.storniert_am IS NULL
      AND a.payment_status IS DISTINCT FROM 'paid'
    ORDER BY r.ref, r.rate_nr
  `) as any[];

  // Gegenprobe zur Ausweisung im Report — nicht zum Anfassen.
  const [ohneBank] = (await sqlPool`
    SELECT COUNT(*)::int AS n, COALESCE(SUM(r.betrag_cents),0)::bigint AS cents
    FROM fiaon_abo_raten r JOIN fiaon_applications a ON a.ref = r.ref
    WHERE r.status = 'offen' AND r.storniert_am IS NULL
      AND a.payment_status = 'paid'
      AND NOT EXISTS (SELECT 1 FROM fiaon_bank_txns t WHERE t.matched_ref = a.ref AND t.applied)
  `) as any[];

  log(`  ${treffer.length} Rate(n) an Bestellungen ohne bezahltes Paket.`);
  log(`  ${treffer.filter((t) => Number(t.mahnstufe) >= 1).length} davon tragen eine Mahnstufe.`);
  log(`  Nicht angefasst: ${ohneBank.n} Raten bezahlter Bestellungen ohne Bankzeile `
    + `(${(Number(ohneBank.cents) / 100).toFixed(2)} €) — Lücke im Bank-Import, keine Zahlungsverweigerung.`);
  log(`  CSV: ${csv("bestand-storno-raten.csv", treffer)}`);
  if (!SCHREIBEN || treffer.length === 0) return;

  for (const t of treffer) {
    await sqlPool`
      UPDATE fiaon_abo_raten
      SET storniert_am = NOW(),
          storno_grund = ${`Bestellung steht auf „${t.payment_status}" — für ein unbezahltes Paket entsteht keine Rate.`},
          status = 'storniert',
          -- Die Mahnstufe wird neutralisiert: Sonst startet eine später
          -- richtig angelegte Rate desselben Kunden auf Stufe 2.
          mahnstufe = 0,
          inkasso_agent_id = NULL, inkasso_wiedervorlage = NULL, inkasso_zusage_am = NULL,
          updated_at = NOW()
      WHERE id = ${t.id}
    `;
    await verlauf(t.ref,
      `Abo-Rate ${t.rate_nr} (${(Number(t.betrag_cents) / 100).toFixed(2)} €) storniert: `
      + `Die Bestellung ist nicht als bezahlt gebucht (${t.payment_status}). `
      + `Mahnstufe zurückgesetzt, geplante Mahnungen entfallen.`);
  }
  const [probe] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_abo_raten r JOIN fiaon_applications a ON a.ref = r.ref
    WHERE r.status = 'offen' AND r.storniert_am IS NULL AND a.payment_status IS DISTINCT FROM 'paid'
  `) as any[];
  log(`  ${treffer.length} storniert. ZÄHLPROBE: ${probe.n} offene Raten ohne bezahltes Paket (Soll 0).`);
}

// ═══════════════════════════════════════════════════════════════════════════
async function zyklus(): Promise<void> {
  titel("2. FÄLLIGKEITEN AUF DEN JAHRESTAG DER BUCHUNG AUSRICHTEN");
  const heute = berlinToday();
  const offen = (await sqlPool`
    SELECT r.id, r.ref, r.rate_nr, r.faellig_am, r.betrag_cents, a.person_id,
           TRIM(COALESCE(a.first_name,'') || ' ' || COALESCE(a.last_name,'')) AS name,
           COALESCE(a.paid_at, (SELECT MIN(t.booked_at) FROM fiaon_bank_txns t
                                 WHERE t.matched_ref = a.ref AND t.applied),
                    a.completed_at) AS anker_at
    FROM fiaon_abo_raten r
    JOIN fiaon_applications a ON a.ref = r.ref
    WHERE r.status = 'offen' AND r.storniert_am IS NULL
      AND a.payment_status = 'paid' AND a.merged_into IS NULL
      AND a.archived_at IS NULL AND a.gdpr_deleted_at IS NULL
    ORDER BY r.ref, r.faellig_am
  `) as any[];

  // ── WELCHER ZYKLUS IST DIESE RATE? DER NÄCHSTGELEGENE ───────────────────
  // Zwei Regeln haben sich als falsch erwiesen, beide mit Schaden:
  //
  //   „rate_nr − 1"     — scheitert an den 33 Ketten ohne Startzahlung (aus
  //                       dem alten Bestandsnachtrag), deren Rate 1 bereits
  //                       eine Monatsrate ist.
  //   „Position in der  — scheitert an den 16 Ketten mit LÜCKE. Beispiel
  //    Kette"             FIAON-MR5HP4D8-OPLQ: Rate 1 (Startzahlung) und
  //                       Rate 3, Rate 2 fehlt. Die Position hätte Rate 3 auf
  //                       den 04.08. gezogen — 29 Tage nach vorn, der Kunde
  //                       wäre über Nacht überfällig gewesen, ohne etwas
  //                       falsch gemacht zu haben.
  //
  // Richtig ist der Jahrestag, der dem bisherigen Termin AM NÄCHSTEN liegt.
  // Die Abweichung ist eine Drift von wenigen Tagen (30 statt ~31) — der
  // gemeinte Monat ist immer der, der am nächsten liegt. Für MR5HP4D8:
  // alt 01.09., Jahrestage 04.08. und 04.09. → 04.09., drei Tage Korrektur.
  const naechsterZyklus = (anker: string, alt: string, gesperrt: Set<number>) => {
    let bestN = 1, bestAbstand = Infinity;
    // 36 Monate ab dem Anker decken jeden Bestand ab; alles darüber wäre eine
    // Rate, die seit drei Jahren offen steht, und die gibt es nicht.
    for (let n = 1; n <= 36; n++) {
      if (gesperrt.has(n)) continue;
      const abstand = Math.abs(
        Date.parse(`${faelligkeit(anker, n)}T12:00:00Z`) - Date.parse(`${alt}T12:00:00Z`));
      if (abstand < bestAbstand) { bestAbstand = abstand; bestN = n; }
    }
    return bestN;
  };

  const plan: Record<string, unknown>[] = [];
  // Je Bestellung: welche Zyklen sind schon vergeben? Zwei offene Raten
  // dürfen nicht auf denselben Monat fallen — das wäre die Doppelrechnung,
  // die dieser Lauf gerade verhindern soll.
  const vergeben = new Map<string, Set<number>>();
  for (const r of offen) {
    const anker = ankerTag(r.anker_at);
    if (!anker) continue;
    const alt = ankerTag(r.faellig_am)!;
    if (!vergeben.has(r.ref)) vergeben.set(r.ref, new Set());
    const gesperrt = vergeben.get(r.ref)!;
    const n = naechsterZyklus(anker, alt, gesperrt);
    gesperrt.add(n);
    const neu = faelligkeit(anker, n);
    if (neu === alt) continue;
    plan.push({
      rate_id: r.id, ref: r.ref, name: r.name, person_id: r.person_id,
      rate_nr: r.rate_nr, zyklus: n, anker, alt, neu,
      verschiebung_tage: Math.round(
        (Date.parse(`${neu}T12:00:00Z`) - Date.parse(`${alt}T12:00:00Z`)) / 86_400_000),
    });
  }

  log(`  ${offen.length} offene Raten bezahlter Kunden geprüft.`);
  log(`  ${plan.length} Fälligkeiten liegen nicht auf dem Jahrestag.`);
  const vor = plan.filter((p) => Number(p.verschiebung_tage) < 0).length;
  log(`  ${vor} werden nach vorn, ${plan.length - vor} nach hinten korrigiert.`);
  log(`  CSV (alt → neu je Kunde): ${csv("bestand-zyklus-abgleich.csv", plan)}`);
  if (!SCHREIBEN || plan.length === 0) return;

  for (const p of plan) {
    const neu = p.neu as string;
    // Der Überfällig-Stempel muss mitwandern, sonst behauptet die
    // Inkasso-Karte einen Rückstand, den es nach neuem Termin nicht gibt.
    // Bewusst hier gerechnet und nicht als CASE in SQL: Ein Parameter, der in
    // einem CASE dreimal auftaucht, lässt Postgres seinen Typ nicht bestimmen
    // („could not determine data type of parameter").
    const ueberfaellig = neu < heute ? faelligkeitPlusEinTag(neu) : null;
    await sqlPool`
      UPDATE fiaon_abo_raten
      SET faellig_am = ${neu}::date,
          ueberfaellig_seit = ${ueberfaellig}::date,
          -- CONCAT_WS ist polymorph: Ohne ::text kann Postgres den Typ des
          -- Parameters nicht bestimmen und lehnt die Anweisung ab.
          notiz = CONCAT_WS(' · ', NULLIF(notiz,''),
                  ${`Fälligkeit auf den Jahrestag der Buchung korrigiert (${p.alt} → ${neu})`}::text),
          updated_at = NOW()
      WHERE id = ${p.rate_id as number}
    `;
  }
  await sqlPool`
    INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
    SELECT DISTINCT r.ref, NULL, 'System', 'system',
           'Abo-Zyklus korrigiert: Die Monatsrate ist ab jetzt am Jahrestag der Buchung fällig, nicht mehr alle 30 Tage.'
    FROM fiaon_abo_raten r WHERE r.id = ANY(${plan.map((p) => p.rate_id as number)})
  `.catch(() => {});

  // Zählprobe: keine zwei offenen Raten derselben Bestellung am selben Tag.
  const [dopp] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM (
      SELECT ref, faellig_am FROM fiaon_abo_raten
      WHERE status = 'offen' AND storniert_am IS NULL
      GROUP BY 1,2 HAVING COUNT(*) > 1
    ) x
  `) as any[];
  log(`  ${plan.length} Fälligkeiten korrigiert. ZÄHLPROBE Doppelrechnungen: ${dopp.n} (Soll 0).`);
}

// ═══════════════════════════════════════════════════════════════════════════
async function preise(): Promise<void> {
  titel("3. PREISE — ULTRA 79,99 · HIGH END 99,99");
  const falsch = (await sqlPool`
    SELECT a.ref, a.pack_key, a.amount_due, a.payment_status, a.person_id,
           TRIM(COALESCE(a.first_name,'') || ' ' || COALESCE(a.last_name,'')) AS name
    FROM fiaon_applications a
    WHERE a.pack_key IN ('ultra','highend') AND a.merged_into IS NULL
      AND a.gdpr_deleted_at IS NULL AND a.amount_due IS NOT NULL
      AND a.amount_due <> (CASE a.pack_key WHEN 'ultra' THEN 79.99 ELSE 99.99 END)
    ORDER BY a.payment_status, a.pack_key
  `) as any[];

  const OFFEN = ["pending_payment", "pending", "expired"];
  const korrigierbar = falsch.filter((f) => OFFEN.includes(String(f.payment_status)));
  const nurAusweisen = falsch.filter((f) => !OFFEN.includes(String(f.payment_status)));

  log(`  ${falsch.length} Bestellungen mit falschem Betrag.`);
  log(`  ${korrigierbar.length} offen → werden korrigiert.`);
  log(`  ${nurAusweisen.length} bezahlt/angekündigt/storniert → NUR ausgewiesen, nicht angefasst.`);
  log(`     (Ein bezahlter Betrag ist eine Tatsache. Wer ihn nachträglich ändert, `
    + `fälscht die Buchhaltung.)`);
  log(`  CSV: ${csv("bestand-preise.csv", falsch.map((f) => ({
    ...f, soll: (paketPreisCents(f.pack_key) / 100).toFixed(2),
    wird_korrigiert: OFFEN.includes(String(f.payment_status)) ? "ja" : "nein — nur Report",
  })))}`);

  // Und die offenen RATEN, die aus dem vertauschten Katalog entstanden sind.
  const ratenFalsch = (await sqlPool`
    SELECT r.id, r.ref, r.rate_nr, r.betrag_cents, a.pack_key,
           TRIM(COALESCE(a.first_name,'') || ' ' || COALESCE(a.last_name,'')) AS name
    FROM fiaon_abo_raten r
    JOIN fiaon_applications a ON a.ref = r.ref
    WHERE r.status = 'offen' AND r.storniert_am IS NULL
      AND a.pack_key IN ('ultra','highend')
      AND r.betrag_cents <> (CASE a.pack_key WHEN 'ultra' THEN 7999 ELSE 9999 END)
    ORDER BY a.pack_key, r.ref
  `) as any[];
  log(`  ${ratenFalsch.length} OFFENE Raten mit dem vertauschten Betrag.`);
  log(`  CSV: ${csv("bestand-preise-raten.csv", ratenFalsch.map((r) => ({
    ...r, soll_cents: paketPreisCents(r.pack_key),
  })))}`);
  if (!SCHREIBEN) return;

  for (const f of korrigierbar) {
    const soll = paketPreisCents(f.pack_key) / 100;
    await sqlPool`
      UPDATE fiaon_applications SET amount_due = ${soll}, updated_at = NOW() WHERE ref = ${f.ref}
    `;
    await verlauf(f.ref,
      `Paketpreis korrigiert: ${f.pack_key} kostet ${soll.toFixed(2).replace(".", ",")} €, `
      + `hinterlegt waren ${Number(f.amount_due).toFixed(2).replace(".", ",")} €. `
      + `Ursache: zwei widersprüchliche Preislisten im System.`);
  }
  for (const r of ratenFalsch) {
    const soll = paketPreisCents(r.pack_key);
    await sqlPool`
      UPDATE fiaon_abo_raten
      SET betrag_cents = ${soll},
          notiz = CONCAT_WS(' · ', NULLIF(notiz,''),
                  ${`Betrag auf den Katalogpreis korrigiert (${(Number(r.betrag_cents) / 100).toFixed(2)} → ${(soll / 100).toFixed(2)} €)`}::text),
          updated_at = NOW()
      WHERE id = ${r.id}
    `;
  }
  const [probe] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_abo_raten r JOIN fiaon_applications a ON a.ref = r.ref
    WHERE r.status = 'offen' AND r.storniert_am IS NULL AND a.pack_key IN ('ultra','highend')
      AND r.betrag_cents <> (CASE a.pack_key WHEN 'ultra' THEN 7999 ELSE 9999 END)
  `) as any[];
  log(`  ${korrigierbar.length} Bestellungen und ${ratenFalsch.length} Raten korrigiert.`);
  log(`  ZÄHLPROBE offene Raten mit falschem Betrag: ${probe.n} (Soll 0).`);
  log(`  HINWEIS: Rechnungs-PDFs korrigierter Bestellungen müssen neu erzeugt werden `
    + `(reports/bestand-preise.csv enthält die Referenzen).`);
}

// ═══════════════════════════════════════════════════════════════════════════
async function anrufe(): Promise<void> {
  titel("4. ANRUFE AN DIE RICHTIGE PERSON HÄNGEN");
  const alle = (await sqlPool`
    SELECT c.id, c.person_id, c.ref, c.nummer, c.beginn, c.richtung, c.ergebnis,
           c.recording_url IS NOT NULL AS hat_aufnahme,
           NULLIF(c.transkript,'') IS NOT NULL AS hat_transkript,
           NULLIF(c.zusammenfassung,'') IS NOT NULL AS hat_zusammenfassung,
           TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')) AS bisher
    FROM fiaon_calls c
    JOIN fiaon_persons p ON p.id = c.person_id
    WHERE c.person_id IS NOT NULL AND NULLIF(c.nummer,'') IS NOT NULL
    ORDER BY c.beginn DESC
  `) as any[];

  const { personZurNummer } = await import("../server/lib/fiaon-anruf-zuordnung");
  const eindeutig: Record<string, unknown>[] = [];
  const unklar: Record<string, unknown>[] = [];

  for (const c of alle) {
    const kern = nummerKern(c.nummer);
    if (!kern) continue;
    const z = await personZurNummer(c.nummer);
    // Passt die Nummer zur verknüpften Person? Dann ist alles in Ordnung.
    if (z.kandidaten.some((k) => k.personId === Number(c.person_id))) continue;

    const zeile = {
      call_id: c.id, beginn: c.beginn, nummer: c.nummer, richtung: c.richtung,
      bisher_person: c.person_id, bisher_name: c.bisher,
      neu_person: z.person?.personId ?? "", neu_name: z.person?.name ?? "",
      hat_aufnahme: c.hat_aufnahme, hat_transkript: c.hat_transkript,
      hat_zusammenfassung: c.hat_zusammenfassung, ergebnis: c.ergebnis ?? "",
    };
    if (z.person && !z.mehrdeutig) eindeutig.push(zeile);
    else unklar.push({ ...zeile, grund: z.person ? "mehrere Personen tragen diese Nummer" : "Nummer gehört niemandem" });
  }

  log(`  ${alle.length} Anrufe mit Personenbezug geprüft.`);
  log(`  ${eindeutig.length} eindeutig falsch zugeordnet → werden umgehängt.`);
  log(`  ${unklar.length} unklar → bleiben stehen und bekommen die Marke „Zuordnung prüfen".`);
  log(`  Davon mit Aufnahme: ${[...eindeutig, ...unklar].filter((z) => z.hat_aufnahme).length}, `
    + `mit Transkript: ${[...eindeutig, ...unklar].filter((z) => z.hat_transkript).length}.`);
  log(`  CSV: ${csv("bestand-anrufe-umhaengen.csv", eindeutig)}`);
  log(`  CSV: ${csv("bestand-anrufe-pruefen.csv", unklar)}`);
  if (!SCHREIBEN) return;

  for (const z of eindeutig) {
    const [neueRef] = (await sqlPool`
      SELECT ref FROM fiaon_applications
      WHERE person_id = ${z.neu_person as number} AND merged_into IS NULL AND archived_at IS NULL
      ORDER BY created_at DESC LIMIT 1
    `) as any[];
    // Aufnahme, Transkript und Zusammenfassung stehen in DERSELBEN Zeile —
    // sie wandern mit, ohne dass etwas kopiert werden muss.
    await sqlPool`
      UPDATE fiaon_calls
      SET person_id = ${z.neu_person as number}, ref = ${neueRef?.ref ?? null}, updated_at = NOW()
      WHERE id = ${z.call_id as number}
    `;
    // Der falsche Verlaufseintrag an der FREMDEN Akte wird entwertet, nicht
    // gelöscht — und an der richtigen neu gesetzt.
    await sqlPool`
      UPDATE fiaon_contact_log
      SET voided_at = NOW(),
          note = CONCAT(note, E'\n[Korrigiert am ', TO_CHAR(NOW(), 'DD.MM.YYYY'),
                        ': Dieser Anruf gehörte zu einer anderen Person und wurde umgehängt.]')
      WHERE person_id = ${z.bisher_person as number}
        AND type = 'system' AND note ILIKE '%Anruf-Zusammenfassung%'
        AND created_at::date = ${String(z.beginn).slice(0, 10)}::date
    `.catch(() => {});
    if (neueRef?.ref) {
      await verlauf(String(neueRef.ref),
        `Anruf vom ${String(z.beginn).slice(0, 10)} (${z.nummer}) dieser Akte zugeordnet — `
        + `er hing zuvor an einer anderen Person. Aufnahme, Transkript und Zusammenfassung sind mitgewandert.`);
    }
  }
  for (const z of unklar) {
    await sqlPool`
      UPDATE fiaon_calls
      SET transkript_grund = COALESCE(NULLIF(transkript_grund,'') || ' · ', '')
                             || ${`Zuordnung prüfen: ${z.grund}`},
          updated_at = NOW()
      WHERE id = ${z.call_id as number}
    `;
  }
  log(`  ${eindeutig.length} umgehängt, ${unklar.length} markiert.`);
}

// ═══════════════════════════════════════════════════════════════════════════
async function main(): Promise<void> {
  log(`\nBestandsläufe am ${berlinToday()} (Europe/Berlin).`);
  if (!SCHREIBEN) log("VORSCHAU — es wird nichts geschrieben. Mit --schreiben ausführen.");

  if (laeuft("storno")) await storno();
  if (laeuft("zyklus")) await zyklus();
  if (laeuft("preise")) await preise();
  if (laeuft("anrufe")) await anrufe();

  log("");
  await sqlPool.end();
}

main().catch(async (e) => {
  console.error(e);
  await sqlPool.end().catch(() => {});
  process.exit(1);
});
