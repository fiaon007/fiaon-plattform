// ═══════════════════════════════════════════════════════════════════════════
// DIE LAGE EINES KUNDEN — Zahlung, Dokumente, Zugang
//
// Gemeldet am 06.08.2026 von der Vertriebsleitung:
//   „Damit ich Vertrieblern bei Fragen und kleineren Kundenproblemen direkt
//    helfen kann, ohne dass alles bei dir landet."
//
// Drei Fragen kommen im Tagesgeschäft immer wieder, und für alle drei musste
// bisher der Vorgesetzte angeschrieben werden:
//   1. Ist das Geld da? Und wenn der Kunde sagt, er habe überwiesen — stimmt das?
//   2. Welche Unterlagen fehlen dem Kunden noch?
//   3. Warum kommt der Kunde nicht in sein Konto?
//
// WARUM EINE EIGENE DATEI
// Die Antworten liegen in drei verschiedenen Ecken (Zahlungsspalten,
// Dokumentspalten als BYTEA, Login-Familienlogik). Würde jede Ansicht sie sich
// selbst zusammensuchen, entstünden drei Wahrheiten über denselben Kunden —
// genau der Fehler, der uns „Kunde ist in Heute, aber nicht in Meine Kunden"
// eingebracht hat.
//
// EINE BEWUSSTE GRENZE
// Die Vertriebsleitung sieht, OB ein Dokument vorliegt, seit wann und wie groß
// es ist — nicht seinen INHALT. Für die Frage „was fehlt noch?" ist der Inhalt
// nicht nötig, und ein Ausweisscan ist das sensibelste Dokument im Bestand. Wer
// ihn wirklich prüfen muss (KYC), tut das im Admin-Bereich. Datenminimierung ist
// hier keine Förmlichkeit: Sie ist der Unterschied zwischen einem Werkzeug und
// einem Datenleck mit Anlauf.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { fristAbgelaufenSql, nichtArchiviertSql, offeneZahlungSql } from "./fiaon-bestand-filter";

export interface ZahlungsLage {
  ref: string | null;
  zahlungsreferenz: string | null;   // = Verwendungszweck
  status: string | null;             // pending_payment | claimed_paid | paid | …
  betragCent: number | null;
  frist: string | null;
  bezahltAm: string | null;
  gemeldetAm: string | null;         // wann der Kunde „habe überwiesen" gesagt hat
  paket: string | null;
  /** Passende Bankeingänge (Verwendungszweck/Betrag) — der eigentliche Beweis. */
  bankeingaenge: {
    id: number; gebuchtAm: string | null; betragCent: number; einzahler: string | null;
    verwendungszweck: string | null; betragPasst: boolean | null; verbucht: boolean;
    treffer: "referenz" | "betrag" | "name";
  }[];
}

export interface DokumentLage {
  /** Was verlangt wird, hängt am Produkt: eine Bonitätsauskunft braucht keinen Ausweis. */
  benoetigt: string[];
  vorhanden: { art: string; label: string; groesseKb: number; seit: string | null }[];
  fehlend: { art: string; label: string }[];
  kycStatus: string | null;
  profilFertigAm: string | null;
}

export interface ZugangsLage {
  kannRein: boolean;
  code: string | null;
  grund: string;
  hinweis: string | null;
  /** Konkreter nächster Schritt für den Menschen am Telefon. */
  tun: string | null;
  kontoRef: string | null;
  status: string | null;
  kontoStatus: string | null;
  zahlungsStatus: string | null;
  passwortGesetzt: boolean;
  familie: number;
}

const DOK_SPALTEN: { art: string; spalte: string; label: string }[] = [
  { art: "ausweis", spalte: "id_card_pdf", label: "Ausweis" },
  { art: "kontoauszug", spalte: "bank_statement_pdf", label: "Kontoauszug" },
  { art: "schufa", spalte: "schufa_pdf", label: "SCHUFA-Auskunft" },
];

/**
 * Zahlungslage einer Person — inklusive der Bankeingänge, mit denen sich die
 * Behauptung „ich habe überwiesen" prüfen lässt.
 *
 * Die Treffersuche ist absichtlich dreistufig und benennt, WARUM ein Eingang
 * vorgeschlagen wird: Ein Treffer über die Referenz ist ein Beweis, ein Treffer
 * über den Betrag ein Hinweis, ein Treffer über den Namen eine Vermutung. Wer
 * bucht, soll den Unterschied sehen — sonst wird aus „gleicher Betrag" ein
 * „bezahlt", und das Geld fehlt später in der Kasse.
 */
export async function zahlungsLage(personId: number): Promise<ZahlungsLage[]> {
  const apps = await sqlPool`
    SELECT a.ref, a.payment_reference, a.payment_status, a.amount_due, a.payment_due_date,
           a.completed_at, a.pack_name, a.first_name, a.last_name, a.company_name,
           (SELECT MAX(cl.created_at) FROM fiaon_contact_log cl
             WHERE cl.ref = a.ref AND cl.outcome IN ('erreicht_zahlt_gleich', 'erreicht_zahlt_am')
               AND cl.voided_at IS NULL) AS gemeldet_am
    FROM fiaon_applications a
    WHERE a.person_id = ${personId} AND a.merged_into IS NULL
    ORDER BY a.created_at DESC
  `;

  const lagen: ZahlungsLage[] = [];
  for (const a of apps as any[]) {
    const betragCent = a.amount_due != null ? Math.round(Number(a.amount_due) * 100) : null;
    const name = [a.first_name, a.last_name].filter(Boolean).join(" ") || a.company_name || "";
    let eingaenge: any[] = [];
    if (a.payment_status !== "paid") {
      eingaenge = await sqlPool`
        SELECT id, booked_at, amount_cents, payer_name, reference_raw, amount_ok, applied,
               CASE
                 WHEN ${a.payment_reference ?? ""} <> '' AND (
                        UPPER(COALESCE(reference_raw, '')) LIKE '%' || UPPER(${a.payment_reference ?? "#"}) || '%'
                        OR UPPER(COALESCE(extracted_ref, '')) = UPPER(${a.payment_reference ?? "#"})
                        OR UPPER(COALESCE(matched_ref, '')) = UPPER(${a.ref})
                      ) THEN 'referenz'
                 WHEN ${betragCent ?? -1} > 0 AND amount_cents = ${betragCent ?? -1} THEN 'betrag'
                 ELSE 'name'
               END AS treffer
        FROM fiaon_bank_txns
        WHERE (
                (${a.payment_reference ?? ""} <> '' AND (
                   UPPER(COALESCE(reference_raw, '')) LIKE '%' || UPPER(${a.payment_reference ?? "#"}) || '%'
                   OR UPPER(COALESCE(extracted_ref, '')) = UPPER(${a.payment_reference ?? "#"})
                   OR UPPER(COALESCE(matched_ref, '')) = UPPER(${a.ref})))
                OR (${betragCent ?? -1} > 0 AND amount_cents = ${betragCent ?? -1}
                    AND booked_at > NOW() - INTERVAL '60 days')
                OR (${name} <> '' AND UPPER(COALESCE(payer_name, '')) LIKE '%' || UPPER(${name.split(" ").pop() || "#"}) || '%')
              )
          -- SCHON VERBUCHTE EINGÄNGE GEHÖREN NICHT MEHR HIERHER.
          -- Der erste Entwurf zeigte sie mit: Im Dialog standen dann sechs
          -- fremde Zahlungen über denselben Betrag, alle längst einem anderen
          -- Kunden zugeordnet. Ein Klick darauf wäre eine Fehlbuchung mit
          -- Provision gewesen. Ausnahme: ein Eingang, der ausdrücklich zu
          -- DIESER Bestellung zugeordnet ist — den darf man sehen.
          AND (NOT applied OR UPPER(COALESCE(matched_ref, '')) = UPPER(${a.ref}))
        ORDER BY (CASE WHEN UPPER(COALESCE(reference_raw, '')) LIKE '%' || UPPER(${a.payment_reference ?? "#"}) || '%' THEN 0 ELSE 1 END),
                 booked_at DESC NULLS LAST
        LIMIT 6
      `.catch(() => [] as any[]);
    }
    lagen.push({
      ref: a.ref,
      zahlungsreferenz: a.payment_reference,
      status: a.payment_status,
      betragCent,
      frist: a.payment_due_date,
      bezahltAm: a.payment_status === "paid" ? a.completed_at : null,
      gemeldetAm: a.gemeldet_am,
      paket: a.pack_name ? String(a.pack_name).split("\n")[0].trim() : null,
      bankeingaenge: (eingaenge as any[]).map((t) => ({
        id: Number(t.id),
        gebuchtAm: t.booked_at,
        betragCent: Number(t.amount_cents),
        einzahler: t.payer_name,
        verwendungszweck: t.reference_raw,
        betragPasst: t.amount_ok,
        verbucht: !!t.applied,
        treffer: t.treffer,
      })),
    });
  }
  return lagen;
}

/**
 * Dokumentlage. Welche Unterlagen ein Kunde braucht, hängt am Produkt:
 * Die Bonitätsauskunft (`type='schufa'`) ist eine Auskunft, die WIR liefern —
 * dafür braucht es keinen Ausweis des Kunden. Würde die Liste das ignorieren,
 * meldete sie bei jedem Bonitätskunden dauerhaft „Ausweis fehlt", und niemand
 * würde die Liste mehr ernst nehmen.
 */
export async function dokumentLage(personId: number): Promise<DokumentLage> {
  const [a] = await sqlPool`
    SELECT ref, type, kyc_status, profile_completed_at,
           (id_card_pdf IS NOT NULL) AS hat_ausweis, LENGTH(id_card_pdf) AS gr_ausweis,
           (bank_statement_pdf IS NOT NULL) AS hat_auszug, LENGTH(bank_statement_pdf) AS gr_auszug,
           (schufa_pdf IS NOT NULL) AS hat_schufa, LENGTH(schufa_pdf) AS gr_schufa,
           updated_at
    FROM fiaon_applications
    WHERE person_id = ${personId} AND merged_into IS NULL
    ORDER BY (payment_status = 'paid') DESC, created_at DESC
    LIMIT 1
  `;
  if (!a) {
    return { benoetigt: [], vorhanden: [], fehlend: [], kycStatus: null, profilFertigAm: null };
  }
  const istBonitaet = String(a.type || "") === "schufa";
  const benoetigt = istBonitaet ? ["schufa"] : ["ausweis", "kontoauszug"];
  const da: Record<string, { hat: boolean; gr: number | null }> = {
    ausweis: { hat: !!a.hat_ausweis, gr: a.gr_ausweis },
    kontoauszug: { hat: !!a.hat_auszug, gr: a.gr_auszug },
    schufa: { hat: !!a.hat_schufa, gr: a.gr_schufa },
  };
  const vorhanden = DOK_SPALTEN.filter((d) => da[d.art].hat).map((d) => ({
    art: d.art, label: d.label,
    groesseKb: Math.round(Number(da[d.art].gr || 0) / 1024),
    seit: a.updated_at,
  }));
  const fehlend = DOK_SPALTEN.filter((d) => benoetigt.includes(d.art) && !da[d.art].hat)
    .map((d) => ({ art: d.art, label: d.label }));
  return {
    benoetigt, vorhanden, fehlend,
    kycStatus: a.kyc_status || null,
    profilFertigAm: a.profile_completed_at || null,
  };
}

/**
 * Zugangslage: Kommt dieser Kunde in sein Konto — und wenn nicht, warum?
 *
 * Die Antwort wird NICHT nachgebaut, sondern von derselben Funktion geholt, die
 * der echte Login benutzt (`decideLogin` mit der echten Kontofamilie). Dazu wird
 * das GESPEICHERTE Passwort als Eingabe gereicht: Damit beantwortet die Diagnose
 * exakt die Frage „was passiert, wenn der Kunde sein richtiges Passwort
 * eintippt?".
 *
 * Eine nachgebaute Prüfung wäre hier besonders gefährlich: Genau eine solche
 * Abweichung hat 2026 dazu geführt, dass bezahlte Kunden monatelang ausgesperrt
 * waren, während jede Übersicht behauptete, alles sei in Ordnung.
 */
export async function zugangsLage(email: string): Promise<ZugangsLage> {
  const { loadLoginFamily } = await import("../routes/fiaon-antrag");
  const { decideLogin, pickAccountRow, storedPasswordOf } = await import("../fiaon-login-logic");
  const norm = String(email || "").trim().toLowerCase();
  if (!norm) {
    return {
      kannRein: false, code: null, grund: "Keine E-Mail-Adresse am Kunden hinterlegt.",
      hinweis: "Ohne E-Mail gibt es kein Konto — die Adresse muss zuerst erfasst werden.",
      tun: "E-Mail-Adresse in den Stammdaten ergänzen.",
      kontoRef: null, status: null, kontoStatus: null, zahlungsStatus: null,
      passwortGesetzt: false, familie: 0,
    };
  }
  const familie = await loadLoginFamily(norm);
  const konto = pickAccountRow(familie);
  const mitPasswort = familie.find((r: any) => storedPasswordOf(r) !== null);
  const passwort = mitPasswort ? storedPasswordOf(mitPasswort) : null;

  // Ohne Passwort im Bestand kann kein Passwort „richtig" sein — decideLogin
  // beantwortet diesen Fall selbst korrekt, deshalb wird auch dann gefragt.
  const urteil = decideLogin(familie, passwort ?? "\u0000kein-passwort\u0000");
  // Der Typ unterscheidet Erfolg und Ablehnung; nur die Ablehnung trägt Grund,
  // Code und Hinweis. Ohne diese Aufteilung müsste die Auskunft raten.
  const nein = urteil.granted === false ? urteil : null;

  const tunNach: Record<string, string> = {
    "AUTH-01": "Der Kunde tippt ein falsches Passwort. „Passwort vergessen“ auf der Login-Seite — Name, E-Mail und Geburtsdatum genügen.",
    "AUTH-02": "Für dieses Konto ist kein Passwort gespeichert. Der Kunde setzt es über „Passwort vergessen“ — dafür braucht er Name, E-Mail und Geburtsdatum.",
    "AUTH-03": "Die Zahlung ist noch nicht gebucht. Sobald sie steht, geht das Konto automatisch auf.",
    "AUTH-04": "Das Konto ist vom Vorgesetzten gesperrt. Das kann die Vertriebsleitung nicht aufheben — bitte an den Vorgesetzten.",
    "AUTH-05": "Technischer Fehler beim Login. Bitte an den Vorgesetzten, mit Uhrzeit und E-Mail des Kunden.",
  };

  return {
    kannRein: !nein,
    code: nein?.code ?? null,
    grund: nein ? (nein.reason || nein.error || "unbekannt") : "Der Kunde kommt mit seinem Passwort normal in sein Konto.",
    hinweis: nein?.hint ?? null,
    tun: nein ? (tunNach[String(nein.code)] ?? null) : null,
    kontoRef: konto?.ref ?? null,
    status: konto?.status ?? null,
    kontoStatus: konto?.account_status ?? null,
    zahlungsStatus: konto?.payment_status ?? null,
    passwortGesetzt: !!passwort,
    familie: familie.length,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ARBEITSLISTEN — was heute liegen bleibt, wenn es niemand anfasst
// ═══════════════════════════════════════════════════════════════════════════

/** Kopfzahlen für die Servicesicht der Vertriebsleitung. */
export async function serviceZahlen(): Promise<{
  gemeldet: number; fristAbgelaufen: number; offeneZahlungen: number;
  dokumenteFehlen: number; zugangOffen: number; bankOffen: number;
}> {
  // „Frist abgelaufen" kommt aus fristAbgelaufenSql — der einen Definition im
  // Haus (lib/fiaon-bestand-filter.ts). Sie umfasst den Altbestand
  // (payment_status='expired') UND die abgeleitete Form (offene Bestellung mit
  // Frist in der Vergangenheit). Seit dem 08.08.2026 wird 'expired' nicht mehr
  // geschrieben; ohne die abgeleitete Form würde diese Zahl langsam einfrieren
  // und wieder das zeigen, was am 06.08. schon einmal auseinanderlief.
  const [z] = await sqlPool.unsafe(`
    SELECT
      COUNT(*) FILTER (WHERE payment_status = 'claimed_paid')::int AS gemeldet,
      COUNT(*) FILTER (WHERE ${fristAbgelaufenSql("fiaon_applications")})::int AS frist_abgelaufen,
      COUNT(*) FILTER (WHERE ${offeneZahlungSql("fiaon_applications")})::int AS offene_zahlungen,
      COUNT(*) FILTER (WHERE payment_status = 'paid' AND type <> 'schufa'
                         AND (id_card_pdf IS NULL OR bank_statement_pdf IS NULL))::int AS dokumente_fehlen,
      COUNT(*) FILTER (WHERE payment_status = 'paid'
                         AND (account_status IS DISTINCT FROM 'active' OR password IS NULL))::int AS zugang_offen
    FROM fiaon_applications
    WHERE merged_into IS NULL AND gdpr_deleted_at IS NULL
      AND ${nichtArchiviertSql("fiaon_applications")}
  `);
  const [b] = await sqlPool`
    SELECT COUNT(*)::int AS offen FROM fiaon_bank_txns WHERE NOT applied
  `.catch(() => [{ offen: 0 }] as any[]);
  return {
    gemeldet: Number(z.gemeldet),
    fristAbgelaufen: Number(z.frist_abgelaufen),
    offeneZahlungen: Number(z.offene_zahlungen),
    dokumenteFehlen: Number(z.dokumente_fehlen),
    zugangOffen: Number(z.zugang_offen),
    bankOffen: Number(b?.offen || 0),
  };
}

const NAME = `COALESCE(
  NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)), ''),
  NULLIF(TRIM(a.company_name), ''), NULLIF(TRIM(a.contact_name), ''), a.email, a.ref)`;

/** Offene Zahlungen — die Liste, an der die Vertriebsleitung arbeitet. */
export async function offeneZahlungen(filter: string, q: string): Promise<any[]> {
  const wo: string[] = ["a.merged_into IS NULL", "a.gdpr_deleted_at IS NULL", nichtArchiviertSql("a")];
  if (filter === "gemeldet") wo.push("a.payment_status = 'claimed_paid'");
  else if (filter === "frist_abgelaufen") wo.push(fristAbgelaufenSql("a"));
  else if (filter === "zusage_heute") wo.push(offeneZahlungSql("a"), "p.promised_payment_date = CURRENT_DATE");
  else if (filter === "bankeingang") {
    // Die interessantesten Fälle: Es liegt ein unverbuchter Bankeingang, dessen
    // Verwendungszweck auf diese Bestellung zeigt. Hier ist das Geld belegt und
    // es fehlt nur der Klick.
    wo.push(offeneZahlungSql("a"));
    wo.push(`EXISTS (SELECT 1 FROM fiaon_bank_txns t WHERE NOT t.applied AND (
               UPPER(COALESCE(t.reference_raw,'')) LIKE '%' || UPPER(COALESCE(a.payment_reference,'#')) || '%'
               OR UPPER(COALESCE(t.extracted_ref,'')) = UPPER(COALESCE(a.payment_reference,'#'))
               OR UPPER(COALESCE(t.matched_ref,'')) = UPPER(a.ref)))`);
  } else wo.push(offeneZahlungSql("a"));

  const suche = q.trim();
  return await sqlPool.unsafe(`
    SELECT a.ref, a.payment_reference, a.payment_status, a.amount_due, a.payment_due_date,
           a.pack_name, a.email, a.person_id, ${NAME} AS name,
           -- Zahlungsbeleg: Wer bucht, sieht Bankeingang UND Beleg nebeneinander.
           (a.payment_proof IS NOT NULL) AS beleg_da, a.payment_proof_date, a.payment_proof_by,
           p.promised_payment_date, p.assigned_agent_id, ag.name AS agent_name,
           (SELECT MAX(cl.created_at) FROM fiaon_contact_log cl
             WHERE cl.ref = a.ref AND cl.voided_at IS NULL) AS letzter_kontakt,
           (SELECT COUNT(*) FROM fiaon_bank_txns t WHERE NOT t.applied AND (
              UPPER(COALESCE(t.reference_raw,'')) LIKE '%' || UPPER(COALESCE(a.payment_reference,'#')) || '%'
              OR UPPER(COALESCE(t.extracted_ref,'')) = UPPER(COALESCE(a.payment_reference,'#'))
              OR UPPER(COALESCE(t.matched_ref,'')) = UPPER(a.ref)))::int AS bank_treffer
    FROM fiaon_applications a
    LEFT JOIN fiaon_persons p ON p.id = a.person_id
    LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
    WHERE ${wo.join(" AND ")}
      AND ($1 = '' OR ${NAME} ILIKE '%' || $1 || '%' OR COALESCE(a.email,'') ILIKE '%' || $1 || '%'
           OR a.ref ILIKE '%' || $1 || '%' OR COALESCE(a.payment_reference,'') ILIKE '%' || $1 || '%')
    ORDER BY (a.payment_status = 'claimed_paid') DESC, a.payment_due_date ASC NULLS LAST
    LIMIT 300
  `, [suche]);
}

/** Bezahlte Kunden, denen Unterlagen fehlen. */
export async function fehlendeDokumente(q: string): Promise<any[]> {
  const suche = q.trim();
  return await sqlPool.unsafe(`
    SELECT a.ref, a.person_id, ${NAME} AS name, a.email, a.pack_name, a.type,
           a.kyc_status, a.completed_at, a.profile_completed_at,
           (a.id_card_pdf IS NULL) AS ausweis_fehlt,
           (a.bank_statement_pdf IS NULL) AS auszug_fehlt,
           p.assigned_agent_id, ag.name AS agent_name
    FROM fiaon_applications a
    LEFT JOIN fiaon_persons p ON p.id = a.person_id
    LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
    WHERE a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
      AND a.payment_status = 'paid' AND a.type <> 'schufa'
      AND (a.id_card_pdf IS NULL OR a.bank_statement_pdf IS NULL)
      AND ($1 = '' OR ${NAME} ILIKE '%' || $1 || '%' OR COALESCE(a.email,'') ILIKE '%' || $1 || '%'
           OR a.ref ILIKE '%' || $1 || '%')
    ORDER BY a.completed_at DESC NULLS LAST
    LIMIT 300
  `, [suche]);
}

/**
 * Bezahlte Kunden, deren Konto nicht offen ist. Bewusst schlank abgefragt (ohne
 * die BYTEA-Spalten) und in JS bewertet: Ein `LOWER(TRIM(...))`-Vergleich über
 * drei E-Mail-Spalten kann keinen Index nutzen und lief auf dem echten Bestand
 * ins Zeitlimit.
 */
export async function zugangsProbleme(q: string): Promise<any[]> {
  const suche = q.trim().toLowerCase();
  const rows = await sqlPool`
    SELECT a.ref, a.person_id, a.email, a.contact_email, a.billing_email,
           a.status, a.account_status, a.payment_status, a.password IS NOT NULL AS hat_passwort,
           a.pack_name, a.completed_at,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)), ''),
                    a.company_name, a.contact_name, a.email, a.ref) AS name,
           p.assigned_agent_id, ag.name AS agent_name
    FROM fiaon_applications a
    LEFT JOIN fiaon_persons p ON p.id = a.person_id
    LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
    WHERE a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
      AND a.payment_status = 'paid'
      AND (a.account_status IS DISTINCT FROM 'active' OR a.password IS NULL)
    ORDER BY a.completed_at DESC NULLS LAST
    LIMIT 200
  `;
  const treffer = (rows as any[]).filter((r) =>
    !suche || String(r.name || "").toLowerCase().includes(suche) || String(r.email || "").toLowerCase().includes(suche)
    || String(r.ref || "").toLowerCase().includes(suche));

  // Für jeden Fall die ECHTE Login-Auskunft holen — die Liste soll nicht raten.
  const ergebnis: any[] = [];
  for (const r of treffer.slice(0, 60)) {
    const lage = await zugangsLage(r.email || r.contact_email || r.billing_email || "");
    // Wer laut Login normal hineinkommt, gehört nicht in eine Arbeitsliste.
    if (lage.kannRein) continue;
    ergebnis.push({
      ref: r.ref, personId: r.person_id, name: r.name,
      email: r.email || r.contact_email || r.billing_email,
      paket: r.pack_name ? String(r.pack_name).split("\n")[0].trim() : null,
      agentName: r.agent_name, bezahltAm: r.completed_at,
      zugang: lage,
    });
  }
  return ergebnis;
}
