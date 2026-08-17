// ═══════════════════════════════════════════════════════════════════════════
// EINE BONITÄTS-WAHRHEIT
//
// ── DER BEFUND (22.08.2026) ────────────────────────────────────────────────
// Für die Frage „wie steht dieser Kunde bei der Bonitätsauskunft?" gab es DREI
// Teilwahrheiten, und jede Anzeige mischte sie anders:
//
//   (1) BEZAHLT   — eine eigene Bestellzeile (type='schufa'), weil ein Kauf
//                   sonst einen zweiten Kunden erzeugt hätte
//   (2) DOKUMENT  — `schufa_pdf` am Kundendatensatz
//   (3) GEPRÜFT   — `schufa_status` ('pending' | 'approved' | 'changes_requested')
//
// GEMESSEN im Bestand:
//   30 zahlende Kunden hatten die Auskunft BEZAHLT, aber kein Dokument —
//      das Portal forderte sie weiter zum Kaufen auf. Sie haben zweimal
//      dasselbe angeboten bekommen.
//   31 hatten ein Dokument SELBST hochgeladen, ohne etwas zu kaufen —
//      auch sie sahen „kaufen".
//   35 Dokumente liegen zur Prüfung, 0 sind geprüft. Niemand sieht sie.
//
// Und 60 Stellen im Code lasen die drei Felder einzeln.
//
// ── DIE REGEL ──────────────────────────────────────────────────────────────
// Was sich ausrechnen lässt, wird AUSGERECHNET (AGENTS.md, nach demselben
// Vorfall bei der Kontostufe). Diese Datei ist die einzige Stelle, die aus den
// drei Teilen einen Zustand macht, und alle Anzeigen lesen ihn.
//
// ── DIE ZUORDNUNG LÄUFT ÜBER DIE PERSON ────────────────────────────────────
// Die alte Route `/bonitaet-status/:ref` verband Kauf und Kunde über die
// E-MAIL — „weil es keine andere Verbindung gibt". Seit dem Kontakt-Umzug
// (20.08.2026, Migration 059) hängen 104 der 113 Bestellungen an einer
// `person_id`. Die Person ist die belastbare Verbindung; die E-Mail bleibt als
// Rückfall für die 9 alten Zeilen ohne Person.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";

/** Preis der Auskunft in Euro. Steht auch in fiaon-antrag.ts (SCHUFA_PRICE). */
export const BONITAET_PREIS = 74;

export type BonitaetStufe =
  /** Nichts da: nicht gekauft, kein Dokument. */
  | "nichts"
  /** Gekauft, Zahlung noch offen. */
  | "zahlung_offen"
  /** Bezahlt, aber die Auskunft liegt noch nicht vor. Wir sind dran. */
  | "beschaffung_laeuft"
  /** Ein Dokument liegt vor und wartet auf Prüfung. */
  | "liegt_zur_pruefung"
  /** Geprüft und in Ordnung. */
  | "geprueft"
  /** Geprüft und beanstandet — der Kunde muss nachliefern. */
  | "beanstandet";

export interface BonitaetStand {
  stufe: BonitaetStufe;
  /** Ein Satz für die Verwaltung: was ist der Fall? */
  grund: string;
  /** Ein Satz für den Kunden — direkte Anrede, ohne Fachwort. */
  fuerKunden: string;
  /** Was ist als nächstes zu tun, und von wem? */
  naechsterSchritt: string;
  /** Rohdaten, für Anzeigen, die Einzelteile brauchen (Knöpfe, Verlinkung). */
  bezahlt: boolean;
  zahlungOffen: boolean;
  hatDokument: boolean;
  dokumentGeprueft: boolean;
  /** Die Bestell-Referenz der Auskunft, wenn es eine gibt. */
  bestellRef: string | null;
  /**
   * Darf dem Kunden „Auskunft bestellen (74 €)" angeboten werden?
   *
   * ── DER KERN DES AUFTRAGS ───────────────────────────────────────────────
   * NEIN, wenn er schon bezahlt hat (30 Fälle) — und auch nicht, wenn er sein
   * Dokument selbst hochgeladen hat (31 Fälle). Wer eine Auskunft hat, braucht
   * keine zweite; wer bezahlt hat, hat sie schon gekauft.
   */
  darfKaufen: boolean;
  /** Darf er (noch) selbst eine Datei hochladen? */
  darfHochladen: boolean;
}

interface Zeilen {
  schufa_pdf_da?: boolean | null;
  schufa_status?: string | null;
  kauf_status?: string | null;
  kauf_ref?: string | null;
}

/**
 * Die Ableitung — eine Funktion, die aus den drei Teilen einen Zustand macht.
 *
 * Bewusst OHNE Datenbankzugriff: So kann sie auf eine einzelne Zeile, auf eine
 * Sammelabfrage und auf einen Prüffall angewendet werden. Zwei Fassungen
 * derselben Regel (eine in TypeScript, eine in SQL) sind die Ursache der
 * Widersprüche, die dieser Auftrag beseitigt.
 */
export function bonitaetAbleiten(z: Zeilen): BonitaetStand {
  const hatDokument = z.schufa_pdf_da === true;
  // ── DREI SCHREIBWEISEN FÜR DASSELBE (22.08.2026) ─────────────────────────
  // Die Route /review validiert 'approved' | 'pending' | 'changes_requested'.
  // Die Verwaltungsansicht (AdminAppDetail.tsx) schreibt aber 'rejected' und
  // 'requested' — Werte, die keine andere Anzeige kennt.
  //
  // GEMESSEN: Im Bestand steht ausschließlich 'pending' (6.890 Zeilen), also
  // hat noch niemand geprüft und der Widerspruch war folgenlos. Er wird hier
  // trotzdem aufgelöst, statt auf den ersten Klick zu warten: Wer 'rejected'
  // schreibt, meint 'changes_requested'.
  const rohStatus = String(z.schufa_status ?? "pending");
  const status = rohStatus === "rejected" || rohStatus === "requested"
    ? "changes_requested"
    : rohStatus;
  const kauf = String(z.kauf_status ?? "");
  const bezahlt = kauf === "paid";
  const zahlungOffen = ["pending_payment", "claimed_paid"].includes(kauf);

  const roh = {
    bezahlt, zahlungOffen, hatDokument,
    dokumentGeprueft: status === "approved",
    bestellRef: z.kauf_ref ?? null,
  };

  // ── DIE REIHENFOLGE IST DIE ENTSCHEIDUNG ─────────────────────────────────
  // Ein vorliegendes Dokument schlägt alles: Ist die Auskunft da, ist die Frage
  // „gekauft oder nicht" für den Kunden erledigt.
  if (hatDokument && status === "approved") {
    return {
      ...roh, stufe: "geprueft",
      grund: "Die Bonitätsauskunft liegt vor und ist geprüft.",
      fuerKunden: "Deine Bonitätsauskunft liegt vor und ist geprüft.",
      naechsterSchritt: "Nichts zu tun.",
      darfKaufen: false, darfHochladen: false,
    };
  }
  if (hatDokument && status === "changes_requested") {
    return {
      ...roh, stufe: "beanstandet",
      grund: "Das eingereichte Dokument wurde beanstandet.",
      fuerKunden: "Mit deiner Auskunft gibt es ein Problem — bitte lade sie erneut hoch.",
      naechsterSchritt: "Der Kunde muss nachliefern. Der Beanstandungsgrund steht in der Akte.",
      darfKaufen: false, darfHochladen: true,
    };
  }
  if (hatDokument) {
    return {
      ...roh, stufe: "liegt_zur_pruefung",
      grund: "Ein Dokument liegt vor und wartet auf Prüfung."
        + (bezahlt ? " Der Kunde hat außerdem bezahlt." : ""),
      fuerKunden: "Deine Auskunft ist bei uns eingegangen — wir sehen sie durch.",
      // GEMESSEN: 35 Dokumente liegen, 0 sind geprüft. Niemand sah sie.
      naechsterSchritt: "Ein Mitarbeiter muss das Dokument prüfen (Akte → Dokumente).",
      darfKaufen: false, darfHochladen: true,
    };
  }

  // ── BEZAHLT, ABER NOCH KEIN DOKUMENT ─────────────────────────────────────
  // Der 30-Fälle-Fehler: Hier stand im Portal „kaufen".
  if (bezahlt) {
    return {
      ...roh, stufe: "beschaffung_laeuft",
      grund: "Die Auskunft ist bezahlt, liegt aber noch nicht vor.",
      fuerKunden: "Deine Bonitätsauskunft ist bezahlt — wir beschaffen sie für dich.",
      naechsterSchritt: "Auskunft beschaffen und im Kundendatensatz hinterlegen.",
      // NICHT kaufen: Er hat bezahlt. Aber hochladen darf er — wenn er selbst
      // schneller ist als wir, soll ihn nichts daran hindern.
      darfKaufen: false, darfHochladen: true,
    };
  }
  if (zahlungOffen) {
    return {
      ...roh, stufe: "zahlung_offen",
      grund: "Die Auskunft ist bestellt, die Zahlung steht noch aus.",
      fuerKunden: "Deine Bestellung ist da — sobald die Zahlung eingeht, beschaffen wir die Auskunft.",
      naechsterSchritt: "Zahlungseingang abwarten oder im Kontoabgleich zuordnen.",
      darfKaufen: false, darfHochladen: true,
    };
  }

  return {
    ...roh, stufe: "nichts",
    grund: "Keine Auskunft vorhanden und keine bestellt.",
    fuerKunden: "Noch keine Bonitätsauskunft vorhanden.",
    naechsterSchritt: "Der Kunde kann sie bestellen oder selbst hochladen.",
    darfKaufen: true, darfHochladen: true,
  };
}

/** Die kurze Marke für Listen und Kacheln. */
export const BONITAET_MARKE: Record<BonitaetStufe, string> = {
  nichts: "Keine Auskunft",
  zahlung_offen: "Bestellt — Zahlung offen",
  beschaffung_laeuft: "Bezahlt — wird beschafft",
  liegt_zur_pruefung: "Liegt zur Prüfung",
  geprueft: "Geprüft",
  beanstandet: "Beanstandet",
};

/** Farbton je Stufe — bernstein heißt „jemand muss etwas tun". */
export const BONITAET_TON: Record<BonitaetStufe, string> = {
  nichts: "#64748b",
  zahlung_offen: "#d97706",
  beschaffung_laeuft: "#2563eb",
  liegt_zur_pruefung: "#d97706",
  geprueft: "#059669",
  beanstandet: "#dc2626",
};

/**
 * Der Stand für EINEN Kunden, aus der Datenbank.
 *
 * @param ref Referenz des Kundendatensatzes (nicht der Auskunft-Bestellung).
 */
export async function bonitaetFuer(ref: string): Promise<BonitaetStand | null> {
  const [a] = (await sqlPool`
    SELECT a.schufa_pdf IS NOT NULL AS schufa_pdf_da,
           a.schufa_status,
           -- ── DIE ZUORDNUNG: PERSON ZUERST, E-MAIL ALS RÜCKFALL ─────────
           -- Die alte Route verband nur über die E-Mail. Seit dem
           -- Kontakt-Umzug hängen 104 von 113 Bestellungen an einer Person;
           -- für die 9 alten Zeilen bleibt die Adresse.
           sb.payment_status AS kauf_status,
           sb.ref AS kauf_ref
    FROM fiaon_applications a
    LEFT JOIN LATERAL (
      SELECT s.payment_status, s.ref
      FROM fiaon_applications s
      WHERE (COALESCE(s.type, '') = 'schufa' OR s.ref LIKE 'FIAON-SCHUFA-%')
        AND s.merged_into IS NULL
        AND (
          (a.person_id IS NOT NULL AND s.person_id = a.person_id)
          OR (s.person_id IS NULL AND fiaon_mail_norm(s.email) IS NOT NULL
              AND fiaon_mail_norm(s.email) IN (
                fiaon_mail_norm(a.email), fiaon_mail_norm(a.contact_email),
                fiaon_mail_norm(a.billing_email)))
        )
      -- Eine bezahlte Bestellung schlägt eine offene: Wer zweimal bestellt und
      -- einmal bezahlt hat, hat bezahlt.
      ORDER BY (s.payment_status = 'paid') DESC, s.created_at DESC
      LIMIT 1
    ) sb ON TRUE
    WHERE a.ref = ${ref} AND a.merged_into IS NULL
    LIMIT 1
  `) as any[];
  if (!a) return null;
  return bonitaetAbleiten(a);
}

/**
 * Der Stand für VIELE Kunden — eine Abfrage statt N.
 *
 * Für Listen (Verwalten-Tabelle, Lage-Tafel). Sie benutzt DIESELBE Ableitung:
 * Die Abfrage holt nur die drei Teile, gerechnet wird in TypeScript.
 */
export async function bonitaetFuerViele(
  refs: string[],
): Promise<Map<string, BonitaetStand>> {
  const karte = new Map<string, BonitaetStand>();
  if (refs.length === 0) return karte;
  const zeilen = (await sqlPool`
    SELECT a.ref,
           a.schufa_pdf IS NOT NULL AS schufa_pdf_da,
           a.schufa_status,
           sb.payment_status AS kauf_status,
           sb.ref AS kauf_ref
    FROM fiaon_applications a
    LEFT JOIN LATERAL (
      SELECT s.payment_status, s.ref
      FROM fiaon_applications s
      WHERE (COALESCE(s.type, '') = 'schufa' OR s.ref LIKE 'FIAON-SCHUFA-%')
        AND s.merged_into IS NULL
        AND (
          (a.person_id IS NOT NULL AND s.person_id = a.person_id)
          OR (s.person_id IS NULL AND fiaon_mail_norm(s.email) IS NOT NULL
              AND fiaon_mail_norm(s.email) IN (
                fiaon_mail_norm(a.email), fiaon_mail_norm(a.contact_email),
                fiaon_mail_norm(a.billing_email)))
        )
      ORDER BY (s.payment_status = 'paid') DESC, s.created_at DESC
      LIMIT 1
    ) sb ON TRUE
    WHERE a.ref = ANY(${refs}) AND a.merged_into IS NULL
  `) as any[];
  for (const z of zeilen) karte.set(String(z.ref), bonitaetAbleiten(z));
  return karte;
}
