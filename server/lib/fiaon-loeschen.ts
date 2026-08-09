// ═══════════════════════════════════════════════════════════════════════════
// LÖSCHEN — der gefährlichste Knopf im Haus
//
// „Löschen" bedeutet für zwei Personen zwei völlig verschiedene Dinge, und der
// Unterschied ist keine Vorliebe, sondern Gesetz:
//
//   ENDGÜLTIG      Ein Lead, der nie gezahlt hat, hinterlässt keine
//                  Buchhaltungsspur. Er darf vollständig verschwinden — und
//                  nach Art. 17 DSGVO auf Verlangen sogar müssen.
//
//   ANONYMISIERT   Wer bezahlt hat, hat eine Rechnung. Rechnungen sind nach
//                  § 147 AO zehn Jahre aufzubewahren. Die PERSON verschwindet
//                  (Name, Adresse, Ausweis), die BUCHUNG bleibt lesbar.
//
// Wer beides „löschen" nennt und gleich behandelt, verletzt entweder das eine
// oder das andere Gesetz. Deshalb entscheidet nicht der Klickende, sondern der
// Zustand der Daten — und der Dialog zeigt VOR dem Klick, was mit wem passiert.
//
// KEINE STILLE ÜBERRASCHUNG: `vorschau()` liefert exakt dieselbe Einteilung,
// die `ausfuehren()` danach anwendet. Beide rufen dieselbe Funktion.
// ═══════════════════════════════════════════════════════════════════════════

import { randomBytes } from "node:crypto";
import { sqlPool } from "./db-pool";

type Lauf = typeof sqlPool;

export type LoeschArt = "endgueltig" | "anonymisiert" | "gesperrt";

export interface LoeschKandidat {
  personId: number;
  name: string;
  email: string | null;
  art: LoeschArt;
  /** Warum diese Einstufung — im Klartext, für den Dialog. */
  begruendung: string;
  refs: string[];
  bezahlt: number;
  provisionen: number;
}

export interface LoeschVorschau {
  kandidaten: LoeschKandidat[];
  endgueltig: number;
  anonymisiert: number;
  gesperrt: number;
  /** Der Wortlaut, den der Mensch tippen muss. */
  bestaetigung: string;
  hinweise: string[];
}

/**
 * Was passiert mit dieser Auswahl?
 *
 * Wird von der Vorschau UND von der Ausführung gerufen. Eine zweite Einteilung
 * daneben wäre genau die Art Fehler, bei der ein Kunde verschwindet, dessen
 * Rechnung noch gebraucht wird.
 */
export async function einteilen(
  personIds: number[], lauf: Lauf = sqlPool,
): Promise<LoeschKandidat[]> {
  if (personIds.length === 0) return [];
  const rows = (await lauf`
    SELECT p.id,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, p.contact_name, p.primary_email, p.person_ref) AS name,
           p.primary_email, p.is_blocked, p.ist_test_am,
           (SELECT ARRAY_AGG(a.ref) FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.merged_into IS NULL) AS refs,
           (SELECT COUNT(*)::int FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.payment_status = 'paid') AS bezahlt,
           (SELECT COUNT(*)::int FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.invoice_number IS NOT NULL) AS rechnungen,
           (SELECT COUNT(*)::int FROM fiaon_commissions c
             JOIN fiaon_applications a ON a.ref = c.ref
             WHERE a.person_id = p.id) AS provisionen,
           (SELECT COUNT(*)::int FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.gdpr_deleted_at IS NOT NULL) AS schon_geloescht
    FROM fiaon_persons p
    WHERE p.id = ANY(${personIds}) AND p.merged_into_person_id IS NULL
  `) as any[];

  return rows.map((r) => {
    const bezahlt = Number(r.bezahlt);
    const rechnungen = Number(r.rechnungen);
    const provisionen = Number(r.provisionen);
    let art: LoeschArt = "endgueltig";
    let begruendung = "Keine Zahlung, keine Rechnung, keine Provision — darf vollständig verschwinden.";

    if (Number(r.schon_geloescht) > 0) {
      art = "gesperrt";
      begruendung = "Für diesen Datensatz liegt bereits eine DSGVO-Löschung vor.";
    } else if (bezahlt > 0 || rechnungen > 0 || provisionen > 0) {
      art = "anonymisiert";
      const teile: string[] = [];
      if (bezahlt > 0) teile.push(`${bezahlt} bezahlte ${bezahlt === 1 ? "Bestellung" : "Bestellungen"}`);
      if (rechnungen > 0) teile.push(`${rechnungen} ${rechnungen === 1 ? "Rechnung" : "Rechnungen"}`);
      if (provisionen > 0) teile.push(`${provisionen} gebuchte ${provisionen === 1 ? "Provision" : "Provisionen"}`);
      begruendung = `${teile.join(", ")} — die Person wird anonymisiert, die Buchungsdaten bleiben `
        + "aufbewahrungspflichtig lesbar (§ 147 AO, zehn Jahre).";
    }
    return {
      personId: Number(r.id),
      name: String(r.name || `Person ${r.id}`),
      email: r.primary_email || null,
      art, begruendung,
      refs: (r.refs || []).filter(Boolean),
      bezahlt, provisionen,
    };
  });
}

export async function vorschau(personIds: number[], lauf: Lauf = sqlPool): Promise<LoeschVorschau> {
  const kandidaten = await einteilen(personIds, lauf);
  const endgueltig = kandidaten.filter((k) => k.art === "endgueltig").length;
  const anonymisiert = kandidaten.filter((k) => k.art === "anonymisiert").length;
  const gesperrt = kandidaten.filter((k) => k.art === "gesperrt").length;

  const hinweise: string[] = [];
  if (endgueltig > 0) {
    hinweise.push(`${endgueltig} ${endgueltig === 1 ? "Eintrag verschwindet" : "Einträge verschwinden"} `
      + "vollständig — Name, Kontaktdaten, Unterlagen, Verlauf. Das lässt sich nicht rückgängig machen.");
  }
  if (anonymisiert > 0) {
    hinweise.push(`${anonymisiert} ${anonymisiert === 1 ? "Person wird" : "Personen werden"} anonymisiert. `
      + "Name und Kontaktdaten sind danach weg, die Rechnungen bleiben für die Buchhaltung lesbar — "
      + "das schreibt § 147 AO vor und lässt sich nicht abwählen.");
  }
  if (gesperrt > 0) {
    hinweise.push(`${gesperrt} ${gesperrt === 1 ? "Eintrag wird" : "Einträge werden"} übersprungen: bereits gelöscht.`);
  }
  const wirksam = endgueltig + anonymisiert;
  return {
    kandidaten, endgueltig, anonymisiert, gesperrt,
    bestaetigung: `${wirksam} ${wirksam === 1 ? "Eintrag" : "Einträge"} löschen`,
    hinweise,
  };
}

export interface LoeschErgebnis {
  endgueltig: number;
  anonymisiert: number;
  uebersprungen: number;
  stapel: string;
  meldung: string;
}

/**
 * Führt die Löschung aus.
 *
 * @param bestaetigung Muss wörtlich dem Vorschau-Text entsprechen. Ein
 *                     Kontrollkästchen klickt man weg, ohne es zu lesen; einen
 *                     Satz mit einer Zahl darin tippt man nicht versehentlich.
 */
export async function ausfuehren(
  personIds: number[],
  akteur: string,
  bestaetigung: string,
  grund: string | null = null,
  lauf: Lauf = sqlPool,
): Promise<{ ok: boolean; fehler?: string } & Partial<LoeschErgebnis>> {
  const v = await vorschau(personIds, lauf);
  if (v.endgueltig + v.anonymisiert === 0) {
    return { ok: false, fehler: "Nichts zu löschen — alle gewählten Einträge sind bereits gelöscht." };
  }
  if (String(bestaetigung || "").trim() !== v.bestaetigung) {
    return {
      ok: false,
      fehler: `Bitte zur Bestätigung genau eintippen: „${v.bestaetigung}“`,
    };
  }

  const stapel = `L-${new Date().toISOString().slice(0, 10)}-${randomBytes(3).toString("hex").toUpperCase()}`;
  let endgueltig = 0;
  let anonymisiert = 0;

  for (const k of v.kandidaten) {
    if (k.art === "gesperrt") continue;
    if (k.art === "endgueltig") {
      await endgueltigLoeschen(k, akteur, stapel, grund, lauf);
      endgueltig++;
    } else {
      await anonymisieren(k, akteur, stapel, grund, lauf);
      anonymisiert++;
    }
  }

  console.log(`[LOESCHEN] ${stapel}: ${endgueltig} endgültig, ${anonymisiert} anonymisiert (${akteur})`);
  return {
    ok: true, endgueltig, anonymisiert, uebersprungen: v.gesperrt, stapel,
    meldung: `${endgueltig + anonymisiert} erledigt: ${endgueltig} endgültig gelöscht, `
      + `${anonymisiert} anonymisiert${v.gesperrt ? `, ${v.gesperrt} übersprungen` : ""}. Vorgang ${stapel}.`,
  };
}

/**
 * Vollständig weg.
 *
 * Reihenfolge nach Fremdschlüsseln von innen nach außen. Die Person zuletzt,
 * damit ein Abbruch in der Mitte keine verwaisten Zeilen hinterlässt, die auf
 * eine nicht mehr vorhandene Person zeigen.
 */
async function endgueltigLoeschen(
  k: LoeschKandidat, akteur: string, stapel: string, grund: string | null, lauf: Lauf,
): Promise<void> {
  // Das Protokoll ZUERST — sonst fehlt es, wenn danach etwas schiefgeht.
  await lauf`
    INSERT INTO fiaon_loeschungen (art, person_id, person_name, refs, grund, akteur, stapel)
    VALUES ('endgueltig', ${k.personId}, ${k.name}, ${k.refs.join(", ") || null}, ${grund}, ${akteur}, ${stapel})
  `;
  if (k.refs.length > 0) {
    await lauf`DELETE FROM fiaon_contact_log WHERE ref = ANY(${k.refs})`;
    await lauf`DELETE FROM fiaon_vermerke WHERE ref = ANY(${k.refs})`;
  }
  await lauf`DELETE FROM fiaon_mail_log WHERE person_id = ${k.personId}`;
  await lauf`DELETE FROM fiaon_termine WHERE person_id = ${k.personId}`;
  await lauf`DELETE FROM fiaon_person_aliases WHERE person_id = ${k.personId}`;
  await lauf`DELETE FROM fiaon_applications WHERE person_id = ${k.personId}`;
  await lauf`DELETE FROM fiaon_persons WHERE id = ${k.personId}`;
}

/**
 * Person weg, Buchung bleibt.
 *
 * Nutzt denselben Weg wie die bestehende Einzel-Löschung in
 * `/admin/applications/:ref/gdpr-delete` — dieselben Spalten, dieselbe
 * Anonymisierung. Es gibt keine zweite Definition davon, was „anonymisiert"
 * heißt.
 */
async function anonymisieren(
  k: LoeschKandidat, akteur: string, stapel: string, grund: string | null, lauf: Lauf,
): Promise<void> {
  await lauf`
    INSERT INTO fiaon_loeschungen (art, person_id, person_name, refs, grund, akteur, stapel)
    VALUES ('anonymisiert', ${k.personId}, ${k.name}, ${k.refs.join(", ") || null}, ${grund}, ${akteur}, ${stapel})
  `;
  for (const ref of k.refs) {
    const [a] = (await lauf`SELECT id, invoice_number FROM fiaon_applications WHERE ref = ${ref}`) as any[];
    if (!a) continue;
    await lauf`
      UPDATE fiaon_applications SET
        first_name = 'Gelöscht', last_name = '(DSGVO)', contact_name = NULL,
        email = ${`geloescht-${a.id}@anonym.invalid`}, contact_email = NULL, billing_email = NULL,
        phone = NULL, phone_country_code = NULL, contact_phone = NULL,
        street = NULL, zip = NULL, city = NULL,
        bank_statement_pdf = NULL, id_card_pdf = NULL, schufa_pdf = NULL,
        utm = NULL,
        payment_status = CASE WHEN payment_status IN ('pending_payment','claimed_paid','expired')
                              THEN 'cancelled' ELSE payment_status END,
        cancelled_at = CASE WHEN payment_status IN ('pending_payment','claimed_paid','expired')
                            THEN NOW() ELSE cancelled_at END,
        account_status = 'suspended',
        gdpr_deleted_at = NOW(),
        updated_at = NOW()
      WHERE ref = ${ref}
    `;
    await lauf`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
      VALUES (${ref}, NULL, ${akteur}, 'system',
              ${`Gelöscht (DSGVO, Vorgang ${stapel}): personenbezogene Daten anonymisiert, Unterlagen entfernt. `
                + `Rechnungsdaten (${a.invoice_number || "keine Rechnung"}) bleiben nach § 147 AO erhalten.`})
    `;
  }
  // Die Person selbst: Kontaktdaten weg, Zeile bleibt als Anker für die
  // Bestellungen. Aus jeder Liste fällt sie über `gdpr_deleted_at`.
  await lauf`
    UPDATE fiaon_persons SET
      first_name = 'Gelöscht', last_name = '(DSGVO)', contact_name = NULL, company_name = NULL,
      primary_email = NULL, primary_phone = NULL,
      assigned_agent_id = NULL, betreuung_seit = NULL,
      priority_tier = -1, tier_reason = 'ausgeschlossen',
      is_blocked = TRUE,
      updated_at = NOW()
    WHERE id = ${k.personId}
  `;
  await lauf`DELETE FROM fiaon_person_aliases WHERE person_id = ${k.personId}`;
}
