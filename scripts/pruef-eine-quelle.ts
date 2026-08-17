// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: DIE EINE DATENQUELLE
//
// ── WAS BEWIESEN WERDEN MUSS ───────────────────────────────────────────────
//   1  Die Wand hält: Ein direkter Schreibversuch auf die ZEILEN-Spalte landet
//      an der PERSON. Das ist die Rot-Probe, die der Auftrag verlangt.
//   2  Der Bestand ist umgezogen: Keine lebende Zeile trägt einen Kontaktwert,
//      den die Person nicht kennt (als Hauptwert oder Alias).
//   3  Kein Mensch bleibt ohne E-Mail, wenn eine an seiner Bestellung steht —
//      der Fall Bianco/Rechtsteiner.
//   4  Doppelgänger werden GEMELDET statt still verschluckt.
//   5  Die Ampel sagt die Wahrheit, wenn der Brevo-Schlüssel fehlt.
//
// Schreibende Prüfungen laufen in einer Transaktion, die zurückgerollt wird.
//
//   npx tsx scripts/pruef-eine-quelle.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { readFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";

let ok = 0;
let rot = 0;
const fehler: string[] = [];

function pruef(name: string, bedingung: boolean, hinweis = ""): void {
  if (bedingung) { ok++; console.log(`  ok    ${name}`); }
  else { rot++; fehler.push(name); console.log(`  ROT   ${name}${hinweis ? `  → ${hinweis}` : ""}`); }
}
function titel(t: string): void { console.log(`\n${"─".repeat(72)}\n${t}\n${"─".repeat(72)}`); }
const lies = (p: string) => { try { return readFileSync(p, "utf8"); } catch { return ""; } };

async function main(): Promise<void> {
  // ═════════════════════════════════════════════════════════════════════════
  titel("DIE WAND — hält sie einem direkten Schreibversuch stand?");
  // ═════════════════════════════════════════════════════════════════════════
  // Der Auftrag verlangt: „Ein absichtlicher Schreibversuch auf die alte Spalte
  // muss nachweislich an der Person landen."
  await sqlPool.begin(async (tx: any) => {
    const marke = `PRUEF-QUELLE-${Date.now().toString(36).toUpperCase()}`;
    const [p] = (await tx`
      INSERT INTO fiaon_persons (person_ref, kind, first_name, last_name, created_at, updated_at)
      VALUES (${`FIAON-P-Q${Date.now().toString(36).slice(-5)}`}, 'private', 'Quelle', 'Probe', NOW(), NOW())
      RETURNING id
    `) as any[];

    // ── FALL 1: Person leer → sie übernimmt ────────────────────────────────
    await tx`
      INSERT INTO fiaon_applications (ref, type, status, person_id, email, phone, phone_country_code, created_at, updated_at)
      VALUES (${marke}, 'private', 'started', ${p.id},
              'wand-probe@example.invalid', '1761110000', '+49', NOW(), NOW())
    `;
    const [n1] = (await tx`SELECT primary_email, primary_phone FROM fiaon_persons WHERE id = ${p.id}`) as any[];
    pruef("Schreibversuch auf die Zeile landet an der Person (E-Mail)",
      n1.primary_email === "wand-probe@example.invalid", String(n1.primary_email));
    pruef("… und die Nummer, mit zusammengesetzter Vorwahl",
      String(n1.primary_phone) === "+491761110000", String(n1.primary_phone));

    // ── FALL 2: Person hat schon einen Wert → sie behält ihn, Alias entsteht ─
    await tx`UPDATE fiaon_applications SET email = 'zweite@example.invalid' WHERE ref = ${marke}`;
    const [n2] = (await tx`SELECT primary_email FROM fiaon_persons WHERE id = ${p.id}`) as any[];
    pruef("Die Person BEHÄLT ihren Wert",
      n2.primary_email === "wand-probe@example.invalid",
      "sonst wäre der letzte Schreibvorgang die Wahrheit — ein Zufall, keine Regel");
    const al = (await tx`
      SELECT kind, value_norm FROM fiaon_person_aliases WHERE person_id = ${p.id}
    `) as any[];
    pruef("Der abweichende Wert wird ALIAS",
      al.some((a: any) => a.value_norm === "zweite@example.invalid"),
      JSON.stringify(al));

    // ── FALL 3: Der Wert gehört schon einem ANDEREN → Doppelgänger ─────────
    const [q] = (await tx`
      INSERT INTO fiaon_persons (person_ref, kind, first_name, last_name, primary_email, created_at, updated_at)
      VALUES (${`FIAON-P-R${Date.now().toString(36).slice(-5)}`}, 'private', 'Quelle', 'Fremd',
              'gehoert-einem-anderen@example.invalid', NOW(), NOW())
      RETURNING id
    `) as any[];
    await tx`
      UPDATE fiaon_applications SET email = 'gehoert-einem-anderen@example.invalid' WHERE ref = ${marke}
    `;
    const [dg] = (await tx`
      SELECT COUNT(*)::int AS n FROM fiaon_doppelgaenger
      WHERE (person_a = ${p.id} AND person_b = ${q.id}) OR (person_a = ${q.id} AND person_b = ${p.id})
    `) as any[];
    pruef("Eine fremde Adresse erzeugt einen DOPPELGÄNGER-Hinweis",
      Number(dg.n) === 1,
      "vorher scheiterte das still (ON CONFLICT DO NOTHING) — der Hinweis war weg");
    const [n3] = (await tx`SELECT primary_email FROM fiaon_persons WHERE id = ${q.id}`) as any[];
    pruef("Der fremde Mensch behält seine Adresse",
      n3.primary_email === "gehoert-einem-anderen@example.invalid");

    // ── FALL 4: Auch ein LEAD schreibt an die Person durch ─────────────────
    const [r] = (await tx`
      INSERT INTO fiaon_persons (person_ref, kind, first_name, last_name, created_at, updated_at)
      VALUES (${`FIAON-P-S${Date.now().toString(36).slice(-5)}`}, 'private', 'Lead', 'Probe', NOW(), NOW())
      RETURNING id
    `) as any[];
    await tx`
      INSERT INTO fiaon_leads (vorname, nachname, email, telefon, quelle, person_id, erstellt_am, updated_at)
      VALUES ('Lead', 'Probe', 'lead-wand@example.invalid', '+491762220000', 'pruefstand', ${r.id}, NOW(), NOW())
    `;
    const [n4] = (await tx`SELECT primary_email, primary_phone FROM fiaon_persons WHERE id = ${r.id}`) as any[];
    pruef("Ein Lead schreibt seine E-Mail an die Person durch",
      n4.primary_email === "lead-wand@example.invalid", String(n4.primary_email));
    pruef("… und seine Nummer", String(n4.primary_phone).includes("1762220000"),
      String(n4.primary_phone));

    throw new Error("ROLLBACK");
  }).catch((e: any) => { if (e.message !== "ROLLBACK") throw e; });

  // ═════════════════════════════════════════════════════════════════════════
  titel("DIE TRIGGER SIND SCHARF");
  // ═════════════════════════════════════════════════════════════════════════
  const trigger = (await sqlPool`
    SELECT tgname, tgrelid::regclass::text AS tabelle, tgenabled
    FROM pg_trigger
    WHERE tgname IN ('fiaon_app_kontakt_trigger', 'fiaon_lead_kontakt_trigger')
  `) as any[];
  pruef("Der Trigger an den Bestellungen ist da",
    trigger.some((t) => t.tgname === "fiaon_app_kontakt_trigger" && t.tgenabled === "O"),
    JSON.stringify(trigger));
  pruef("Der Trigger an den Leads ist da",
    trigger.some((t) => t.tgname === "fiaon_lead_kontakt_trigger" && t.tgenabled === "O"));
  const [fn] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM pg_proc
    WHERE proname IN ('fiaon_kontakt_an_person', 'fiaon_mail_norm', 'fiaon_nummer_norm', 'fiaon_app_nummer')
  `) as any[];
  pruef("Alle vier Hilfsfunktionen existieren", Number(fn.n) === 4, `${fn.n} von 4`);

  // ═════════════════════════════════════════════════════════════════════════
  titel("DER BESTAND — ist er umgezogen?");
  // ═════════════════════════════════════════════════════════════════════════
  const [b] = (await sqlPool`
    SELECT
      (SELECT COUNT(*)::int FROM fiaon_applications a
        WHERE a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL AND a.person_id IS NOT NULL
          AND fiaon_mail_norm(a.email) IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM fiaon_persons p WHERE p.id = a.person_id
            AND fiaon_mail_norm(p.primary_email) = fiaon_mail_norm(a.email))
          AND NOT EXISTS (SELECT 1 FROM fiaon_person_aliases al
            WHERE al.person_id = a.person_id AND al.kind = 'email'
              AND al.value_norm = fiaon_mail_norm(a.email))
          -- Doppelgänger sind erklärt: Die Adresse gehört nachweislich einem
          -- anderen Menschen, und der Hinweis steht in fiaon_doppelgaenger.
          AND NOT EXISTS (SELECT 1 FROM fiaon_doppelgaenger d
            WHERE d.wert = fiaon_mail_norm(a.email)
              AND (d.person_a = a.person_id OR d.person_b = a.person_id))) AS mail_unbekannt,
      (SELECT COUNT(*)::int FROM fiaon_applications a
        WHERE a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL AND a.person_id IS NOT NULL
          AND fiaon_nummer_norm(fiaon_app_nummer(a.phone, a.phone_country_code, a.contact_phone)) IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM fiaon_persons p WHERE p.id = a.person_id
            AND RIGHT(fiaon_nummer_norm(p.primary_phone), 9)
              = RIGHT(fiaon_nummer_norm(fiaon_app_nummer(a.phone, a.phone_country_code, a.contact_phone)), 9))
          AND NOT EXISTS (SELECT 1 FROM fiaon_person_aliases al
            WHERE al.person_id = a.person_id AND al.kind = 'phone'
              AND al.value_norm = fiaon_nummer_norm(fiaon_app_nummer(a.phone, a.phone_country_code, a.contact_phone)))) AS nummer_unbekannt,
      (SELECT COUNT(*)::int FROM fiaon_persons p
        WHERE p.merged_into_person_id IS NULL AND fiaon_mail_norm(p.primary_email) IS NULL
          AND EXISTS (SELECT 1 FROM fiaon_applications a
            WHERE a.person_id = p.id AND a.merged_into IS NULL
              AND fiaon_mail_norm(a.email) IS NOT NULL)) AS ohne_mail
  `) as any[];
  pruef("Keine Bestellung mit unbekannter E-Mail", Number(b.mail_unbekannt) === 0,
    `${b.mail_unbekannt} übrig`);
  pruef("Keine Bestellung mit unbekannter Nummer", Number(b.nummer_unbekannt) === 0,
    `${b.nummer_unbekannt} übrig`);
  pruef("Kein Mensch ohne E-Mail, wenn eine am Antrag steht", Number(b.ohne_mail) === 0,
    `${b.ohne_mail} — der Fall Bianco/Rechtsteiner`);

  // Die gemeldeten Fälle, namentlich.
  for (const name of ["Bianco", "Rechtsteiner"]) {
    const [p] = (await sqlPool`
      SELECT p.id, p.primary_email FROM fiaon_persons p
      WHERE p.merged_into_person_id IS NULL AND p.last_name ILIKE ${`%${name}%`}
        AND EXISTS (SELECT 1 FROM fiaon_applications a
          WHERE a.person_id = p.id AND a.merged_into IS NULL)
      ORDER BY p.id LIMIT 1
    `) as any[];
    pruef(`${name}: die Person hat jetzt eine E-Mail`,
      !!p && String(p.primary_email ?? "").includes("@"),
      `Person ${p?.id}: ${p?.primary_email ?? "keine"}`);
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("DIE DOPPELGÄNGER — gemeldet statt verschluckt");
  // ═════════════════════════════════════════════════════════════════════════
  const [d] = (await sqlPool`
    SELECT COUNT(*)::int AS n,
           COUNT(*) FILTER (WHERE stand = 'offen')::int AS offen,
           COUNT(*) FILTER (WHERE merkmal = 'email')::int AS ueber_mail,
           COUNT(*) FILTER (WHERE quelle = 'trigger')::int AS vom_trigger
    FROM fiaon_doppelgaenger
  `) as any[];
  pruef("Es gibt Kandidaten", Number(d.n) > 0, "der Lauf hat nichts gefunden");
  console.log(`        ${d.n} Kandidaten · ${d.offen} offen · ${d.ueber_mail} über die E-Mail `
    + `· ${d.vom_trigger} vom Trigger gemeldet`);
  for (const name of ["Bianco", "Matzke", "Schlabs"]) {
    const [t] = (await sqlPool`
      SELECT COUNT(*)::int AS n FROM fiaon_doppelgaenger d
      WHERE EXISTS (SELECT 1 FROM fiaon_persons p
        WHERE (p.id = d.person_a OR p.id = d.person_b) AND p.last_name ILIKE ${`%${name}%`})
    `) as any[];
    pruef(`${name}: als Kandidat erkannt`, Number(t.n) > 0);
  }

  // ── KEINE ZWEITE KANDIDATENLISTE ───────────────────────────────────────
  // Diese Tabelle war zuerst als Arbeitsliste gedacht — ein Fehler im Namen der
  // Reparatur: Es gibt längst eine Dubletten-Maschine mit vier Stufen unter
  // /admin/dubletten. Zwei Listen für dieselbe Frage sind das Doppelmodell,
  // das dieser Auftrag beseitigt.
  const [lauf] = (await sqlPool`
    SELECT COUNT(*) FILTER (WHERE quelle = 'lauf' AND stand = 'offen')::int AS offen_lauf,
           COUNT(*) FILTER (WHERE quelle = 'trigger')::int AS vom_trigger
    FROM fiaon_doppelgaenger
  `) as any[];
  pruef("Die Tabelle ist ein PROTOKOLL, keine zweite Arbeitsliste",
    Number(lauf.offen_lauf) === 0,
    `${lauf.offen_lauf} Lauf-Einträge stehen noch auf „offen“ — die Arbeitsliste ist /admin/dubletten`);
  pruef("Was der Trigger findet, steht drin", Number(lauf.vom_trigger) > 0,
    "eine Kollision im Moment des Schreibens sieht die Live-Suche nicht");

  // ── UND DER UMZUG HAT DIE BESTEHENDE ANSICHT GEFÜTTERT ─────────────────
  // Der eigentliche Beweis: Weil die E-Mails jetzt an den PERSONEN stehen,
  // findet die bestehende Maschine die Paare von selbst.
  const { findeKandidaten } = await import("../server/lib/fiaon-dubletten-kandidaten");
  const k = await findeKandidaten({ grenze: 200 });
  const ueberMail = k.filter((x: any) => x.stufe === "email").length;
  pruef("Die bestehende Dubletten-Ansicht zeigt die neuen Funde",
    ueberMail >= 10,
    `${ueberMail} über die E-Mail — vor dem Umzug waren es 3 Kandidaten insgesamt`);
  const bianco = k.some((x: any) =>
    JSON.stringify(x).toLowerCase().includes("bianco"));
  pruef("Bianco steht in der bestehenden Ansicht", bianco,
    "dort wird entschieden, nicht in meiner Tabelle");

  // ── DIE ÜBERHOLTE ABLEHNUNG ────────────────────────────────────────────
  // Bianco war unsichtbar, weil das Paar am 08.08.2026 abgehakt wurde:
  // „Nur Namensähnlichkeit ohne zweites Merkmal." Damals richtig — Person 3598
  // hatte keine E-Mail. Seit dem Umzug teilen beide eine.
  const quelle = lies("server/lib/fiaon-dubletten-kandidaten.ts");
  pruef("Eine Ablehnung „ohne zweites Merkmal“ wird ungültig, wenn eines auftaucht",
    /ohne zweites Merkmal%/.test(quelle) && /pa\.phone_key9 = pb\.phone_key9/.test(quelle),
    "sonst konserviert das System einen alten Wissensstand");
  // AGENTS.md: Regex-Literale niemals über zwei Zeilen. Der erste Entwurf
  // zitierte einen mehrzeiligen Kommentar wörtlich — samt Zeilenumbruch und
  // Kommentarstrichen. Ergebnis: „Unterminated regular expression", der
  // Prüfstand startete nicht. Also ein einzeiliger Ausschnitt.
  pruef("Ablehnungen mit ANDERER Begründung bleiben gültig",
    quelle.includes("Diese Entscheidung wird nicht überstimmt"),
    "wer das Merkmal gesehen und trotzdem entschieden hat, wird nicht überstimmt");

  const [verdeckt] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_dubletten_entschieden e
    WHERE e.entscheidung = 'keine_dublette'
      AND e.begruendung ILIKE '%ohne zweites Merkmal%'
      AND EXISTS (
        SELECT 1 FROM fiaon_persons pa, fiaon_persons pb
        WHERE pa.id = e.person_a AND pb.id = e.person_b
          AND pa.merged_into_person_id IS NULL AND pb.merged_into_person_id IS NULL
          AND ((LOWER(BTRIM(COALESCE(pa.primary_email, ''))) <> ''
                AND LOWER(BTRIM(COALESCE(pa.primary_email, '')))
                  = LOWER(BTRIM(COALESCE(pb.primary_email, ''))))
            OR (COALESCE(pa.phone_key9, '') <> '' AND pa.phone_key9 = pb.phone_key9)))
  `) as any[];
  console.log(`        ${verdeckt.n} Paare waren durch überholte Ablehnungen verdeckt `
    + `— sie erscheinen jetzt wieder`);
  pruef("Es waren mehrere, nicht nur Bianco", Number(verdeckt.n) > 1,
    "ein Einzelfall wäre Zufall, mehrere sind ein Muster");
  const [einzig] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM pg_indexes
    WHERE indexname = 'fiaon_doppelgaenger_paar_idx'
  `) as any[];
  pruef("Ein Paar steht nur einmal in der Liste", Number(einzig.n) === 1,
    "ohne den Index würde jeder Fall zweimal entschieden");

  // ═════════════════════════════════════════════════════════════════════════
  titel("DAS ARCHIV — Forensik für den späteren DROP");
  // ═════════════════════════════════════════════════════════════════════════
  const [ar] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_kontakt_archiv`) as any[];
  pruef("Das Archiv ist gefüllt", Number(ar.n) > 5000, `${ar.n} Werte`);
  const archLeser = lies("server/routes/fiaon-kunden.ts") + lies("server/routes/fiaon-antrag.ts");
  pruef("Die Anwendung liest das Archiv NICHT",
    !/fiaon_kontakt_archiv/.test(archLeser),
    "es ist Forensik, keine zweite Datenquelle");

  // ═════════════════════════════════════════════════════════════════════════
  titel("DIE AMPEL — sagt sie die Wahrheit?");
  // ═════════════════════════════════════════════════════════════════════════
  const events = lies("client/src/pages/admin-events.tsx");
  pruef("Ohne Brevo-Schlüssel erscheint eine erklärende Karte",
    /Bestätigung inaktiv: BREVO_API_KEY fehlt/.test(events));
  pruef("Sie sagt, dass die gelben Marken NICHT „Zweig fehlt“ bedeuten",
    /bedeuten <b>nicht<\/b>, dass Zweige fehlen/.test(events),
    "sonst sucht der Betreiber einen Fehler, den es nicht gibt");
  pruef("Sie nennt die gemessene Zahl", /10\.431 Mails in 30 Tagen/.test(events));
  pruef("Sie nennt die Handlung", /in den Umgebungsvariablen des Deployments/.test(events));
  const [brevo] = [{ gesetzt: Boolean(process.env.BREVO_API_KEY) }];
  console.log(`        BREVO_API_KEY hier: ${brevo.gesetzt ? "gesetzt" : "FEHLT — die Karte greift"}`);

  pruef("„E-Mail-Events“ hat eine eigene Marke",
    /ZeichenMailPruefung/.test(lies("client/src/components/admin/AdminShell.tsx")),
    "vorher dasselbe Zeichen wie die Mail-Zentrale, direkt darüber");
  pruef("Die Marke ist selbst gezeichnet, 1,5 px, currentColor",
    /strokeWidth = 1\.5/.test(lies("client/src/components/admin/ZeichenMailPruefung.tsx"))
      && /currentColor/.test(lies("client/src/components/admin/ZeichenMailPruefung.tsx")));

  // ═════════════════════════════════════════════════════════════════════════
  console.log(`\n${"═".repeat(72)}`);
  console.log(`  ${ok} ok · ${rot} rot`);
  if (rot > 0) console.log(`\n  ROT:\n${fehler.map((f) => `    · ${f}`).join("\n")}`);
  console.log(`${"═".repeat(72)}\n`);
  await sqlPool.end();
  process.exit(rot > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await sqlPool.end().catch(() => {});
  process.exit(1);
});
