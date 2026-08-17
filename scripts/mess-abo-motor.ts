// ═══════════════════════════════════════════════════════════════════════════
// MESSUNG VOR DEN FIXES — die Zahlen hinter dem Teamfeedback
//
// Jede Behauptung aus dem Teamfeedback wird hier GEZÄHLT, bevor irgendetwas
// geändert wird. Ohne diese Zahlen weiß hinterher niemand, ob ein Fix etwas
// bewirkt hat oder nur etwas verschoben.
//
// NUR LESEN. Dieses Skript schreibt nichts, ändert nichts, verschickt nichts.
//
//   npx tsx scripts/mess-abo-motor.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import { berlinToday } from "../server/lib/fiaon-time";

const log = (s = "") => console.log(s);
function titel(t: string): void {
  log(`\n${"═".repeat(70)}\n${t}\n${"═".repeat(70)}`);
}
function zahl(name: string, v: unknown, hinweis = ""): void {
  log(`  ${String(v).padStart(7)}  ${name}${hinweis ? `  — ${hinweis}` : ""}`);
}

const befund: Record<string, unknown> = {};

/** CSV-Feld sicher einpacken. */
function feld(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function csvSchreiben(datei: string, zeilen: Record<string, unknown>[]): string {
  mkdirSync("reports", { recursive: true });
  const pfad = `reports/${datei}`;
  if (zeilen.length === 0) {
    writeFileSync(pfad, "keine Treffer\n", "utf8");
    return pfad;
  }
  const kopf = Object.keys(zeilen[0]);
  const text = [kopf.join(";"), ...zeilen.map((z) => kopf.map((k) => feld(z[k])).join(";"))].join("\n");
  writeFileSync(pfad, `${text}\n`, "utf8");
  return pfad;
}

async function main(): Promise<void> {
  const heute = berlinToday();
  log(`\nMessung am ${heute} (Europe/Berlin) — reine Lesezugriffe.\n`);

  // ═════════════════════════════════════════════════════════════════════════
  titel("1. RATEN AN BESTELLUNGEN OHNE BEZAHLTES PAKET");
  // Die Team-Meldung: „3. Mahnung, ohne je eine Rate gezahlt zu haben" und
  // „Vertriebsfälle stehen in der Inkasso-Liste".
  //
  // Drei Stufen von „bezahlt", die unterschieden werden müssen:
  //   (a) payment_status = 'paid'          — irgendwer hat es gesetzt
  //   (b) es gibt eine ANGEWENDETE Bankbuchung (fiaon_bank_txns.applied)
  //   (c) die Geschäftsregel des Betreibers: NUR (b) ist eine Buchung.
  // ═════════════════════════════════════════════════════════════════════════
  const [r1] = (await sqlPool`
    SELECT
      COUNT(*)::int AS offen_gesamt,
      COUNT(*) FILTER (WHERE a.payment_status IS DISTINCT FROM 'paid')::int AS ohne_paid,
      COUNT(*) FILTER (WHERE a.payment_status IS DISTINCT FROM 'paid' AND r.mahnstufe >= 1)::int AS ohne_paid_mahn1,
      COUNT(*) FILTER (WHERE a.payment_status IS DISTINCT FROM 'paid' AND r.mahnstufe >= 3)::int AS ohne_paid_mahn3,
      COUNT(*) FILTER (WHERE NOT EXISTS (
        SELECT 1 FROM fiaon_bank_txns t WHERE t.matched_ref = a.ref AND t.applied))::int AS ohne_bank,
      COUNT(*) FILTER (WHERE r.mahnstufe >= 1 AND NOT EXISTS (
        SELECT 1 FROM fiaon_bank_txns t WHERE t.matched_ref = a.ref AND t.applied))::int AS ohne_bank_mahn1,
      COUNT(*) FILTER (WHERE r.mahnstufe >= 3 AND NOT EXISTS (
        SELECT 1 FROM fiaon_bank_txns t WHERE t.matched_ref = a.ref AND t.applied))::int AS ohne_bank_mahn3
    FROM fiaon_abo_raten r
    JOIN fiaon_applications a ON a.ref = r.ref
    WHERE r.status = 'offen'
  `) as any[];
  zahl("offene Raten insgesamt", r1.offen_gesamt);
  zahl("… davon Bestellung NICHT payment_status='paid'", r1.ohne_paid);
  zahl("… davon mit Mahnstufe >= 1", r1.ohne_paid_mahn1, "diese Menschen wurden gemahnt");
  zahl("… davon mit Mahnstufe >= 3", r1.ohne_paid_mahn3, "letzte Mahnung erhalten");
  log("");
  zahl("… davon OHNE angewendete Bankbuchung", r1.ohne_bank, "Geschäftsregel: keine Buchung");
  zahl("… davon mit Mahnstufe >= 1", r1.ohne_bank_mahn1);
  zahl("… davon mit Mahnstufe >= 3", r1.ohne_bank_mahn3);
  befund.raten = r1;

  // Die Team-Meldung wörtlich: Mahnstufe 3, aber NIE eine Rate bezahlt.
  const nieBezahlt = (await sqlPool`
    SELECT r.id, r.ref, r.rate_nr, r.mahnstufe, r.faellig_am, r.betrag_cents,
           a.payment_status, a.person_id,
           TRIM(COALESCE(a.first_name,'') || ' ' || COALESCE(a.last_name,'')) AS name,
           EXISTS (SELECT 1 FROM fiaon_bank_txns t WHERE t.matched_ref = a.ref AND t.applied) AS bank_ok
    FROM fiaon_abo_raten r
    JOIN fiaon_applications a ON a.ref = r.ref
    WHERE r.status = 'offen' AND r.mahnstufe >= 3
      AND NOT EXISTS (SELECT 1 FROM fiaon_abo_raten x WHERE x.ref = r.ref AND x.status = 'bezahlt')
    ORDER BY r.faellig_am
  `) as any[];
  log("");
  zahl("Raten auf Mahnstufe 3, deren Kunde NIE eine Rate bezahlt hat", nieBezahlt.length);
  zahl("… davon ohne Bankbuchung", nieBezahlt.filter((z) => !z.bank_ok).length);
  befund.mahnstufe3OhneZahlung = nieBezahlt.length;
  log(`  CSV: ${csvSchreiben("mess-mahnstufe3-ohne-zahlung.csv", nieBezahlt)}`);

  // SCHUFA darf niemals eine Rate haben.
  const [schufa] = (await sqlPool`
    SELECT COUNT(DISTINCT a.ref)::int AS bestellungen, COUNT(r.id)::int AS raten,
           COUNT(r.id) FILTER (WHERE r.status = 'offen')::int AS raten_offen
    FROM fiaon_applications a
    JOIN fiaon_abo_raten r ON r.ref = a.ref
    WHERE (a.amount_due = 74 OR a.pack_key = 'schufa'
           OR a.pack_name ILIKE '%onitäts%' OR a.pack_name ILIKE '%onitaets%'
           OR a.ref LIKE 'FIAON-SCHUFA-%' OR a.type = 'schufa')
  `) as any[];
  log("");
  zahl("SCHUFA-Bestellungen MIT Raten", schufa.bestellungen, "dürfen es nie geben");
  zahl("… Raten insgesamt / davon offen", `${schufa.raten}/${schufa.raten_offen}`);
  befund.schufa = schufa;

  // ═════════════════════════════════════════════════════════════════════════
  titel("2. DER ZYKLUS — Jahrestag oder 30-Tage-Trift?");
  // Geschäftsregel: gebucht am 05.07. → fällig am 05.08., 05.09., …
  // Der Code rechnet +30 Tage. Nach einem halben Jahr sind das sechs Tage
  // Abweichung; nach einem Jahr über eine Woche.
  // ═════════════════════════════════════════════════════════════════════════
  const zyklus = (await sqlPool`
    SELECT a.ref, a.person_id,
           TRIM(COALESCE(a.first_name,'') || ' ' || COALESCE(a.last_name,'')) AS name,
           (SELECT MIN(t.booked_at)::date FROM fiaon_bank_txns t
             WHERE t.matched_ref = a.ref AND t.applied) AS bank_tag,
           a.completed_at::date AS completed_tag,
           r.rate_nr, r.faellig_am, r.betrag_cents
    FROM fiaon_applications a
    JOIN fiaon_abo_raten r ON r.ref = a.ref AND r.status = 'offen'
    WHERE a.payment_status = 'paid' AND a.merged_into IS NULL
      AND a.archived_at IS NULL AND a.gdpr_deleted_at IS NULL
  `) as any[];
  let anker = 0, passt = 0;
  const abweichungen: Record<string, unknown>[] = [];
  for (const z of zyklus) {
    const ankerTag = z.bank_tag ?? z.completed_tag;
    if (!ankerTag) continue;
    anker++;
    const ankerTagNr = new Date(ankerTag).getUTCDate();
    const faelligTagNr = new Date(z.faellig_am).getUTCDate();
    if (ankerTagNr === faelligTagNr) passt++;
    else {
      abweichungen.push({
        ref: z.ref, name: z.name, anker: String(ankerTag).slice(0, 10),
        anker_tag: ankerTagNr, faellig_am: String(z.faellig_am).slice(0, 10),
        faellig_tag: faelligTagNr, rate_nr: z.rate_nr,
      });
    }
  }
  zahl("offene Raten bezahlter Kunden mit Ankertag", anker);
  zahl("… deren Fälligkeit auf dem Jahrestag liegt", passt);
  zahl("… deren Fälligkeit VERSCHOBEN ist", abweichungen.length, "30-Tage-Trift");
  befund.zyklusAbweichung = abweichungen.length;
  log(`  CSV: ${csvSchreiben("mess-zyklus-abweichung.csv", abweichungen)}`);

  // ═════════════════════════════════════════════════════════════════════════
  titel("3. EINE ZEILE PRO MENSCH? — der Zusner-Befund");
  // ═════════════════════════════════════════════════════════════════════════
  const liste = (await sqlPool`
    SELECT r.id AS rate_id, r.ref, r.rate_nr, r.faellig_am, r.mahnstufe,
           a.person_id,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)), ''),
                    a.contact_name, a.email) AS name
    FROM fiaon_abo_raten r
    JOIN fiaon_applications a ON a.ref = r.ref
    WHERE r.status <> 'bezahlt'
      AND r.faellig_am <= CURRENT_DATE + 7
      AND EXISTS (SELECT 1 FROM fiaon_applications x WHERE x.ref = r.ref
                    AND x.payment_status = 'paid' AND x.merged_into IS NULL
                    AND x.archived_at IS NULL AND x.gdpr_deleted_at IS NULL)
  `) as any[];
  const jeName = new Map<string, any[]>();
  const jePerson = new Map<string, any[]>();
  for (const z of liste) {
    const n = String(z.name ?? "?").trim().toLowerCase();
    if (!jeName.has(n)) jeName.set(n, []);
    jeName.get(n)!.push(z);
    const p = z.person_id == null ? `ohne:${z.ref}` : `p:${z.person_id}`;
    if (!jePerson.has(p)) jePerson.set(p, []);
    jePerson.get(p)!.push(z);
  }
  zahl("Zeilen in der Inkasso-Arbeitsliste (Sichtfeld)", liste.length);
  zahl("verschiedene Namen", jeName.size);
  zahl("verschiedene person_id (bzw. ohne)", jePerson.size);
  zahl("Namen, die mehr als einmal vorkommen",
    Array.from(jeName.values()).filter((v) => v.length > 1).length);
  zahl("Raten ohne person_id", liste.filter((z) => z.person_id == null).length);

  const mehrfach = Array.from(jeName.entries())
    .filter(([, v]) => v.length > 1)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 15);
  log("\n  Die häufigsten Wiederholungen:");
  for (const [n, v] of mehrfach) {
    const personen = new Set(v.map((x: any) => String(x.person_id)));
    const refs = new Set(v.map((x: any) => x.ref));
    log(`    ${String(v.length).padStart(3)}×  ${n}  — ${personen.size} person_id, ${refs.size} Bestellung(en)`);
  }
  befund.inkassoZeilen = liste.length;
  befund.inkassoNamen = jeName.size;
  befund.inkassoPersonen = jePerson.size;
  log(`\n  CSV: ${csvSchreiben("mess-inkasso-wiederholungen.csv",
    mehrfach.flatMap(([n, v]) => v.map((x: any) => ({
      name: n, person_id: x.person_id, ref: x.ref, rate_nr: x.rate_nr,
      faellig_am: String(x.faellig_am).slice(0, 10), mahnstufe: x.mahnstufe,
    }))))}`);

  // Der genannte Fall.
  const zusner = (await sqlPool`
    SELECT r.id AS rate_id, r.ref, r.rate_nr, r.status, r.faellig_am, r.mahnstufe,
           a.person_id, a.payment_status,
           TRIM(COALESCE(a.first_name,'') || ' ' || COALESCE(a.last_name,'')) AS name,
           a.email, a.created_at::date AS angelegt
    FROM fiaon_abo_raten r
    JOIN fiaon_applications a ON a.ref = r.ref
    WHERE a.last_name ILIKE '%zusner%' OR a.first_name ILIKE '%zusner%'
       OR a.contact_name ILIKE '%zusner%' OR a.company_name ILIKE '%zusner%'
    ORDER BY r.ref, r.rate_nr
  `) as any[];
  log(`\n  Fall „Zusner": ${zusner.length} Raten`);
  for (const z of zusner) {
    log(`    ${z.name} · person_id ${z.person_id} · ${z.ref} · Rate ${z.rate_nr} `
      + `· ${z.status} · fällig ${String(z.faellig_am).slice(0, 10)} · Stufe ${z.mahnstufe} `
      + `· Bestellung ${z.payment_status}`);
  }
  const zusnerPersonen = (await sqlPool`
    SELECT p.id, p.first_name, p.last_name, p.primary_email, p.primary_phone,
           p.merged_into_person_id
    FROM fiaon_persons p
    WHERE p.last_name ILIKE '%zusner%' OR p.first_name ILIKE '%zusner%'
  `) as any[];
  log(`  Personen mit Namen „Zusner": ${zusnerPersonen.length}`);
  for (const p of zusnerPersonen) {
    log(`    #${p.id} ${p.first_name} ${p.last_name} · ${p.primary_email ?? "—"} `
      + `· ${p.primary_phone ?? "—"}${p.merged_into_person_id ? ` · zusammengeführt in #${p.merged_into_person_id}` : ""}`);
  }
  befund.zusnerRaten = zusner.length;
  befund.zusnerPersonen = zusnerPersonen.length;

  // ═════════════════════════════════════════════════════════════════════════
  titel("4. AUFNAHMEN AN DER FALSCHEN PERSON");
  // Ein Anruf gehört zu der Person, deren NUMMER gewählt wurde. Passt die
  // Nummer zu keiner Nummer und keinem Alias der verknüpften Person, hängt
  // die Aufnahme an einer fremden Akte.
  // ═════════════════════════════════════════════════════════════════════════
  const anrufe = (await sqlPool`
    SELECT c.id, c.person_id, c.ref, c.nummer, c.richtung, c.beginn,
           c.recording_url IS NOT NULL AS hat_aufnahme,
           NULLIF(c.transkript, '') IS NOT NULL AS hat_transkript,
           NULLIF(c.zusammenfassung, '') IS NOT NULL AS hat_zusammenfassung,
           c.ergebnis,
           p.first_name, p.last_name, p.primary_phone, p.phone_key9
    FROM fiaon_calls c
    JOIN fiaon_persons p ON p.id = c.person_id
    WHERE c.person_id IS NOT NULL AND NULLIF(c.nummer, '') IS NOT NULL
  `) as any[];
  // Alle bekannten Nummern je Person: primary_phone + Aliase + Bestellungen.
  const nummernJePerson = new Map<number, Set<string>>();
  const schluessel9 = (v: unknown): string | null => {
    const d = String(v ?? "").replace(/\D/g, "");
    return d.length >= 9 ? d.slice(-9) : null;
  };
  for (const q of (await sqlPool`
    SELECT person_id, value_norm AS nummer FROM fiaon_person_aliases WHERE kind = 'phone'
    UNION ALL
    SELECT id AS person_id, primary_phone AS nummer FROM fiaon_persons WHERE primary_phone IS NOT NULL
    UNION ALL
    SELECT person_id, CONCAT(COALESCE(phone_country_code,''), COALESCE(phone,'')) AS nummer
      FROM fiaon_applications WHERE person_id IS NOT NULL AND NULLIF(phone,'') IS NOT NULL
    UNION ALL
    SELECT person_id, CONCAT(COALESCE(phone_country_code,''), COALESCE(contact_phone,'')) AS nummer
      FROM fiaon_applications WHERE person_id IS NOT NULL AND NULLIF(contact_phone,'') IS NOT NULL
    UNION ALL
    SELECT person_id, telefon AS nummer FROM fiaon_leads
      WHERE person_id IS NOT NULL AND NULLIF(telefon,'') IS NOT NULL
  `) as any[]) {
    const k = schluessel9(q.nummer);
    if (!k || q.person_id == null) continue;
    const id = Number(q.person_id);
    if (!nummernJePerson.has(id)) nummernJePerson.set(id, new Set());
    nummernJePerson.get(id)!.add(k);
  }
  // Wem gehört eine Nummer?
  const personZuNummer = new Map<string, Set<number>>();
  for (const [pid, keys] of Array.from(nummernJePerson.entries())) {
    for (const k of Array.from(keys)) {
      if (!personZuNummer.has(k)) personZuNummer.set(k, new Set());
      personZuNummer.get(k)!.add(pid);
    }
  }

  const falsch: Record<string, unknown>[] = [];
  let ohneSchluessel = 0;
  for (const c of anrufe) {
    const k = schluessel9(c.nummer);
    if (!k) { ohneSchluessel++; continue; }
    const bekannt = nummernJePerson.get(Number(c.person_id));
    if (bekannt?.has(k)) continue;
    const besitzer = Array.from(personZuNummer.get(k) ?? []);
    falsch.push({
      call_id: c.id, beginn: c.beginn, richtung: c.richtung, nummer: c.nummer,
      verknuepfte_person: c.person_id,
      verknuepfter_name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(),
      nummer_gehoert_zu: besitzer.join("|") || "unbekannt",
      eindeutig: besitzer.length === 1,
      hat_aufnahme: c.hat_aufnahme, hat_transkript: c.hat_transkript,
      hat_zusammenfassung: c.hat_zusammenfassung, ergebnis: c.ergebnis ?? "",
      ref: c.ref ?? "",
    });
  }
  zahl("Anrufe mit person_id und Nummer", anrufe.length);
  zahl("… Nummer nicht auswertbar", ohneSchluessel);
  zahl("… Nummer passt NICHT zur verknüpften Person", falsch.length);
  zahl("… davon eindeutig einer anderen Person zuzuordnen",
    falsch.filter((f) => f.eindeutig).length);
  zahl("… davon mit Aufnahme", falsch.filter((f) => f.hat_aufnahme).length);
  zahl("… davon mit Transkript", falsch.filter((f) => f.hat_transkript).length);
  zahl("… davon mit KI-Zusammenfassung", falsch.filter((f) => f.hat_zusammenfassung).length);
  befund.anrufeFalsch = falsch.length;
  befund.anrufeFalschEindeutig = falsch.filter((f) => f.eindeutig).length;
  log(`  CSV: ${csvSchreiben("mess-anrufe-falsche-person.csv", falsch)}`);

  // ═════════════════════════════════════════════════════════════════════════
  titel("5. WER BEKOMMT KEINE MAIL? — Empfänger-Auflösung");
  // Die Auflösung geht heute über die BESTELLZEILE (a.email/contact/billing).
  // Die Person weiß es oft besser: primary_email plus E-Mail-Aliase.
  // ═════════════════════════════════════════════════════════════════════════
  const [mail] = (await sqlPool`
    WITH offene AS (
      SELECT DISTINCT a.person_id, a.ref,
             COALESCE(NULLIF(TRIM(a.email),''), NULLIF(TRIM(a.contact_email),''),
                      NULLIF(TRIM(a.billing_email),'')) AS bestell_mail
      FROM fiaon_abo_raten r
      JOIN fiaon_applications a ON a.ref = r.ref
      WHERE r.status = 'offen' AND a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
    )
    SELECT
      COUNT(*)::int AS bestellungen_offen,
      COUNT(*) FILTER (WHERE bestell_mail IS NULL)::int AS ohne_bestell_mail,
      COUNT(*) FILTER (WHERE bestell_mail IS NULL AND person_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM fiaon_persons p WHERE p.id = offene.person_id
          AND NULLIF(TRIM(p.primary_email),'') IS NOT NULL))::int AS rettbar_ueber_person,
      COUNT(*) FILTER (WHERE bestell_mail IS NULL AND person_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM fiaon_person_aliases al WHERE al.person_id = offene.person_id
          AND al.kind = 'email'))::int AS rettbar_ueber_alias
    FROM offene
  `) as any[];
  zahl("Bestellungen mit offener Rate", mail.bestellungen_offen);
  zahl("… ohne E-Mail AN DER BESTELLZEILE", mail.ohne_bestell_mail, "heutiger Versandweg scheitert");
  zahl("… davon über person.primary_email rettbar", mail.rettbar_ueber_person);
  zahl("… davon über einen E-Mail-Alias rettbar", mail.rettbar_ueber_alias);
  befund.mail = mail;

  // Die WAHRE Zahl: keine Adresse, egal wo man nachsieht.
  const ohneJede = (await sqlPool`
    SELECT DISTINCT a.ref, a.person_id,
           TRIM(COALESCE(a.first_name,'') || ' ' || COALESCE(a.last_name,'')) AS name,
           (SELECT COUNT(*)::int FROM fiaon_abo_raten r2
             WHERE r2.ref = a.ref AND r2.status = 'offen') AS offene_raten
    FROM fiaon_abo_raten r
    JOIN fiaon_applications a ON a.ref = r.ref
    WHERE r.status = 'offen' AND a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
      AND COALESCE(NULLIF(TRIM(a.email),''), NULLIF(TRIM(a.contact_email),''),
                   NULLIF(TRIM(a.billing_email),'')) IS NULL
      AND NOT EXISTS (SELECT 1 FROM fiaon_persons p WHERE p.id = a.person_id
                        AND NULLIF(TRIM(p.primary_email),'') IS NOT NULL)
      AND NOT EXISTS (SELECT 1 FROM fiaon_person_aliases al
                        WHERE al.person_id = a.person_id AND al.kind = 'email')
    ORDER BY 1
  `) as any[];
  zahl("… ÜBERHAUPT keine zustellbare Adresse", ohneJede.length, "die wahre Zahl");
  befund.ohneJedeMail = ohneJede.length;
  log(`  CSV: ${csvSchreiben("mess-ohne-zustellbare-mail.csv", ohneJede)}`);

  // Wie oft weicht die Person von der Bestellzeile ab? (stille Fehlleitung)
  const [abweich] = (await sqlPool`
    SELECT COUNT(*)::int AS c
    FROM fiaon_applications a
    JOIN fiaon_persons p ON p.id = a.person_id
    WHERE a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
      AND NULLIF(TRIM(a.email),'') IS NOT NULL
      AND NULLIF(TRIM(p.primary_email),'') IS NOT NULL
      AND LOWER(TRIM(a.email)) <> LOWER(TRIM(p.primary_email))
  `) as any[];
  zahl("Bestellzeilen, deren E-Mail von der Person abweicht", abweich.c,
    "hier entscheidet die Quelle über den Empfänger");
  befund.mailAbweichung = abweich.c;

  // Zustellprotokoll der letzten 30 Tage.
  const protokoll = (await sqlPool`
    SELECT status, COUNT(*)::int AS c FROM fiaon_mail_log
    WHERE created_at > NOW() - INTERVAL '30 days'
    GROUP BY status ORDER BY c DESC
  `) as any[];
  log("\n  Versandprotokoll, letzte 30 Tage:");
  for (const p of protokoll) log(`    ${String(p.c).padStart(6)}  ${p.status}`);
  befund.protokoll30 = protokoll;

  // ═════════════════════════════════════════════════════════════════════════
  titel("6. EINE NUMMERNQUELLE? — Person gegen Bestellzeile");
  // ═════════════════════════════════════════════════════════════════════════
  const [tel] = (await sqlPool`
    SELECT
      COUNT(*)::int AS verknuepft,
      COUNT(*) FILTER (WHERE NULLIF(TRIM(p.primary_phone),'') IS NULL
        AND NULLIF(TRIM(a.phone),'') IS NOT NULL)::int AS person_leer_bestellung_hat,
      COUNT(*) FILTER (WHERE p.phone_key9 IS NOT NULL
        AND RIGHT(regexp_replace(COALESCE(a.phone,''), '\\D', '', 'g'), 9) <> ''
        AND p.phone_key9 <> RIGHT(regexp_replace(COALESCE(a.phone,''), '\\D', '', 'g'), 9))::int AS unterschiedlich
    FROM fiaon_applications a
    JOIN fiaon_persons p ON p.id = a.person_id
    WHERE a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL AND p.merged_into_person_id IS NULL
  `) as any[];
  zahl("Bestellungen mit Person", tel.verknuepft);
  zahl("… Person hat KEINE Nummer, die Bestellung schon", tel.person_leer_bestellung_hat);
  zahl("… Person und Bestellung tragen VERSCHIEDENE Nummern", tel.unterschiedlich,
    "zwei Kollegen sehen zwei Wahrheiten");
  befund.telefon = tel;

  // ═════════════════════════════════════════════════════════════════════════
  titel("7. PREISE — Ultra und High End");
  // Betreiber: Ultra = 79,99 €, High End = 99,99 €.
  // ═════════════════════════════════════════════════════════════════════════
  const preise = (await sqlPool`
    SELECT a.pack_key, a.amount_due, a.payment_status, COUNT(*)::int AS c
    FROM fiaon_applications a
    WHERE a.pack_key IN ('ultra','highend') AND a.merged_into IS NULL
      AND a.gdpr_deleted_at IS NULL
    GROUP BY 1,2,3 ORDER BY 1,2,3
  `) as any[];
  log("  pack_key   amount_due  payment_status        Anzahl");
  for (const p of preise) {
    log(`  ${String(p.pack_key).padEnd(10)} ${String(p.amount_due).padStart(10)}  `
      + `${String(p.payment_status).padEnd(20)} ${String(p.c).padStart(6)}`);
  }
  const [preisFalsch] = (await sqlPool`
    SELECT
      COUNT(*) FILTER (WHERE a.pack_key = 'ultra'   AND a.amount_due <> 79.99)::int AS ultra_falsch,
      COUNT(*) FILTER (WHERE a.pack_key = 'highend' AND a.amount_due <> 99.99)::int AS highend_falsch,
      COUNT(*) FILTER (WHERE a.pack_key = 'ultra'   AND a.amount_due <> 79.99
        AND a.payment_status NOT IN ('paid','claimed_paid'))::int AS ultra_korrigierbar,
      COUNT(*) FILTER (WHERE a.pack_key = 'highend' AND a.amount_due <> 99.99
        AND a.payment_status NOT IN ('paid','claimed_paid'))::int AS highend_korrigierbar
    FROM fiaon_applications a
    WHERE a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL AND a.amount_due IS NOT NULL
  `) as any[];
  log("");
  zahl("Ultra mit anderem Betrag als 79,99", preisFalsch.ultra_falsch);
  zahl("… davon offen (korrigierbar)", preisFalsch.ultra_korrigierbar);
  zahl("High End mit anderem Betrag als 99,99", preisFalsch.highend_falsch);
  zahl("… davon offen (korrigierbar)", preisFalsch.highend_korrigierbar);

  // Und die Raten, die aus dem VERTAUSCHTEN Katalog entstanden sind.
  const [ratenPreis] = (await sqlPool`
    SELECT
      COUNT(*) FILTER (WHERE a.pack_key = 'ultra'   AND r.betrag_cents = 9999)::int AS ultra_9999,
      COUNT(*) FILTER (WHERE a.pack_key = 'ultra'   AND r.betrag_cents = 7999)::int AS ultra_7999,
      COUNT(*) FILTER (WHERE a.pack_key = 'highend' AND r.betrag_cents = 9999)::int AS highend_9999,
      COUNT(*) FILTER (WHERE a.pack_key = 'highend' AND r.betrag_cents = 7999)::int AS highend_7999
    FROM fiaon_abo_raten r
    JOIN fiaon_applications a ON a.ref = r.ref
    WHERE r.status = 'offen'
  `) as any[];
  log("");
  log("  Offene Raten nach Paket und Betrag (Soll: ultra 7999, highend 9999):");
  zahl("ultra   mit 99,99", ratenPreis.ultra_9999, "falsch");
  zahl("ultra   mit 79,99", ratenPreis.ultra_7999, "richtig");
  zahl("highend mit 99,99", ratenPreis.highend_9999, "richtig");
  zahl("highend mit 79,99", ratenPreis.highend_7999, "falsch");
  befund.preise = { ...preisFalsch, ...ratenPreis };

  // ═════════════════════════════════════════════════════════════════════════
  titel("BEFUND ALS JSON");
  // ═════════════════════════════════════════════════════════════════════════
  mkdirSync("reports", { recursive: true });
  writeFileSync("reports/mess-abo-motor.json", `${JSON.stringify(befund, null, 2)}\n`, "utf8");
  log("  reports/mess-abo-motor.json");
  log("");

  await sqlPool.end();
}

main().catch(async (e) => {
  console.error(e);
  await sqlPool.end().catch(() => {});
  process.exit(1);
});
