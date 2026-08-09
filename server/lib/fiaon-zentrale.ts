// ═══════════════════════════════════════════════════════════════════════════
// MAIL-ZENTRALE — Empfänger, Bausteine, Versand
//
// DER FALL, DER DAS AUSGELÖST HAT
// Florentine will einem Kunden nach dem Telefonat die Zahlungsdaten schicken.
// Bisher: Nachricht an den Betreiber, der macht es irgendwann. Ab jetzt:
// „Hi {Anrede}, wie besprochen: {Zahlungsdaten}" — zwanzig Sekunden.
//
// DIE DREI AUSSCHLÜSSE, DIE IMMER GELTEN
// Testeinträge, DSGVO-Gelöschte und archivierte Bestellungen fallen aus JEDER
// Zielgruppe — nicht als Filteroption, sondern fest. Eine Rundmail, die einen
// gelöschten Datensatz erreicht, ist ein meldepflichtiger Vorfall.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";
import { eigeneMailSenden } from "./fiaon-brevo";
import { mailProtokoll } from "./fiaon-mail-log";
import { terminLink } from "./fiaon-termine";
import { absoluteUrl } from "../fiaon-base-url";

type Lauf = typeof sqlPool;

/** Höchstens so viele Mails je Stunde — Zustellbarkeit ist ein Guthaben. */
export const PRO_STUNDE = 200;

export interface Empfaenger {
  personId: number | null;
  name: string;
  email: string;
  vorname: string;
  extern: boolean;
  zahlungsreferenz?: string | null;
  betrag?: string | null;
  agentVorname?: string | null;
  ref?: string | null;
}

// ───────────────────────────────────────────────────────────────────────────
// Bausteine
// ───────────────────────────────────────────────────────────────────────────

export const BAUSTEINE: { marke: string; titel: string; erklaerung: string }[] = [
  { marke: "{Anrede}", titel: "Anrede", erklaerung: "Der Vorname des Empfängers, sonst „du“." },
  { marke: "{Zahlungsdaten}", titel: "Zahlungsdaten", erklaerung: "Empfänger, IBAN, Betrag und der persönliche Verwendungszweck." },
  { marke: "{Terminlink}", titel: "Terminlink", erklaerung: "Persönlicher Link, über den der Kunde selbst eine Uhrzeit wählt." },
  { marke: "{Portal-Login}", titel: "Portal-Login", erklaerung: "Der Weg ins Konto." },
  { marke: "{Agent-Vorname}", titel: "Ansprechpartner", erklaerung: "Der Vorname des zuständigen Teammitglieds." },
];

const BANK = {
  empfaenger: "Schwarzott Global",
  iban: "AT02 2011 1849 5473 0900",
  bic: "GIBAATWWXXX",
};

/**
 * Bausteine je Empfänger einsetzen — SERVERSEITIG.
 *
 * Das ist der Kern: Bei zwei Empfängern stehen zwei verschiedene
 * Verwendungszwecke in zwei verschiedenen Mails. Würde der Browser das
 * ausfüllen, bekämen alle denselben — und die Buchhaltung dürfte raten, von
 * wem das Geld kam.
 */
export function bausteineFuellen(text: string, e: Empfaenger): string {
  const zahlung = e.zahlungsreferenz
    ? `Empfänger: ${BANK.empfaenger}\nIBAN: ${BANK.iban}\nBIC: ${BANK.bic}`
      + `${e.betrag ? `\nBetrag: ${Number(e.betrag).toFixed(2).replace(".", ",")} €` : ""}`
      + `\nVerwendungszweck: ${e.zahlungsreferenz}`
    : "(für diesen Empfänger liegt kein Verwendungszweck vor)";
  return text
    .replace(/\{Anrede\}/g, e.vorname || "du")
    .replace(/\{Zahlungsdaten\}/g, zahlung)
    .replace(/\{Terminlink\}/g, e.personId ? terminLink(e.personId) : "(kein Terminlink für externe Adressen)")
    .replace(/\{Portal-Login\}/g, absoluteUrl("/login"))
    .replace(/\{Agent-Vorname\}/g, e.agentVorname || "dein Ansprechpartner");
}

// ───────────────────────────────────────────────────────────────────────────
// Empfänger finden
// ───────────────────────────────────────────────────────────────────────────

/**
 * Die Ausschlüsse, die IMMER gelten. Kein Filter kann sie abwählen.
 *
 * `ist_test_am` kam mit diesem Paket dazu: Zehn „Justin Schwarzott"-Zeilen
 * standen bis heute als echte Kunden in jeder Zielgruppe.
 */
const IMMER_RAUS = `
  p.merged_into_person_id IS NULL
  AND p.ist_test_am IS NULL
  AND NOT p.is_blocked
  AND NOT EXISTS (SELECT 1 FROM fiaon_applications g
                    WHERE g.person_id = p.id AND g.gdpr_deleted_at IS NOT NULL)
  AND EXISTS (SELECT 1 FROM fiaon_applications l
                WHERE l.person_id = p.id AND l.merged_into IS NULL AND l.archived_at IS NULL)
`;

const MAIL_SQL = `COALESCE(NULLIF(p.primary_email, ''), (
  SELECT NULLIF(COALESCE(a.email, a.contact_email, a.billing_email), '')
  FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
  ORDER BY a.created_at DESC LIMIT 1))`;

const AUSWAHL = `
  p.id,
  COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
           p.company_name, p.contact_name, ${MAIL_SQL}) AS name,
  COALESCE(NULLIF(p.first_name, ''), p.contact_name, '') AS vorname,
  ${MAIL_SQL} AS email,
  COALESCE(NULLIF(ag.first_name, ''), ag.name) AS agent_vorname,
  (SELECT a2.payment_reference FROM fiaon_applications a2
    WHERE a2.person_id = p.id AND a2.merged_into IS NULL AND a2.archived_at IS NULL
    ORDER BY a2.created_at DESC LIMIT 1) AS zahlungsreferenz,
  (SELECT a3.amount_due FROM fiaon_applications a3
    WHERE a3.person_id = p.id AND a3.merged_into IS NULL AND a3.archived_at IS NULL
    ORDER BY a3.created_at DESC LIMIT 1) AS betrag,
  (SELECT a4.ref FROM fiaon_applications a4
    WHERE a4.person_id = p.id AND a4.merged_into IS NULL AND a4.archived_at IS NULL
    ORDER BY a4.created_at DESC LIMIT 1) AS ref
`;

function zuEmpfaenger(r: any): Empfaenger {
  return {
    personId: Number(r.id),
    name: String(r.name || `Person ${r.id}`),
    email: String(r.email),
    vorname: String(r.vorname || ""),
    extern: false,
    zahlungsreferenz: r.zahlungsreferenz || null,
    betrag: r.betrag != null ? String(r.betrag) : null,
    agentVorname: r.agent_vorname || null,
    ref: r.ref || null,
  };
}

/**
 * Autocomplete ab dem ersten Zeichen — über Namen, Adresse UND Aliase.
 *
 * Die Aliase sind der Punkt: Nach einer Zusammenführung trägt die Person ihre
 * neue Adresse, der Kollege am Telefon nennt aber die alte. Ohne Alias-Suche
 * findet er niemanden und legt einen zweiten Datensatz an.
 */
export async function empfaengerSuche(
  q: string, nurAgent: number | null = null, lauf: Lauf = sqlPool,
): Promise<Empfaenger[]> {
  const suche = q.trim();
  if (suche.length < 1) return [];
  const rows = (await lauf.unsafe(`
    SELECT ${AUSWAHL}
    FROM fiaon_persons p LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
    WHERE ${IMMER_RAUS}
      AND ($2::int IS NULL OR p.assigned_agent_id = $2::int)
      AND ${MAIL_SQL} IS NOT NULL
      AND (
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), p.company_name, p.contact_name, '') ILIKE '%' || $1 || '%'
        OR COALESCE(p.primary_email, '') ILIKE '%' || $1 || '%'
        OR EXISTS (SELECT 1 FROM fiaon_person_aliases al
                     WHERE al.person_id = p.id
                       AND (al.value_norm ILIKE '%' || $1 || '%' OR COALESCE(al.value_raw, '') ILIKE '%' || $1 || '%'))
      )
    ORDER BY name ASC
    LIMIT 20
  `, [suche, nurAgent])) as any[];
  return rows.map(zuEmpfaenger);
}

/** Die Filtergruppen mit ihrem SQL — eine Stelle für Zähler und Auswahl. */
const GRUPPEN: { schluessel: string; titel: string; wo: string }[] = [
  { schluessel: "alle_kunden", titel: "Alle Kunden", wo: "p.priority_tier BETWEEN 0 AND 2" },
  { schluessel: "alle_leads", titel: "Alle Leads", wo: "p.priority_tier = 3" },
  { schluessel: "rechnung_offen", titel: "Offene Rechnungen", wo: "p.tier_reason IN ('rechnung_offen','antrag_abgeschlossen')" },
  { schluessel: "zahlung_gemeldet", titel: "Zahlung gemeldet", wo: "p.priority_tier = 1" },
  { schluessel: "ueberfaellig", titel: "Überfällig", wo: "p.tier_reason = 'zahlungsfrist_abgelaufen'" },
  { schluessel: "bezahlt", titel: "Bezahlt", wo: "p.priority_tier = 0" },
  {
    schluessel: "abo_aktiv", titel: "Aktive Abonnenten",
    wo: `EXISTS (SELECT 1 FROM fiaon_applications ab WHERE ab.person_id = p.id
                  AND ab.merged_into IS NULL AND ab.payment_status = 'paid'
                  AND COALESCE(ab.pack_name, '') ILIKE '%abo%')`,
  },
  {
    schluessel: "geburtstag", titel: "Geburtstag in 7 Tagen",
    // Auf den Tag im Jahr gerechnet, nicht auf das Datum: Sonst träfe es
    // niemanden, weil das Geburtsjahr in der Vergangenheit liegt.
    //
    // `birthdate` ist eine Textspalte (Altbestand, teils leer, teils in
    // fremdem Format). Deshalb erst prüfen, ob überhaupt ein Datum drinsteht,
    // und dann sicher wandeln — ein einziger krummer Wert würde sonst die
    // ganze Zählung zum Absturz bringen.
    wo: `p.birthdate ~ '^\\d{4}-\\d{2}-\\d{2}' AND (
          CASE WHEN to_char(NOW() + INTERVAL '7 days', 'MM-DD') >= to_char(NOW(), 'MM-DD')
               THEN substring(p.birthdate from 6 for 5) BETWEEN to_char(NOW(), 'MM-DD')
                    AND to_char(NOW() + INTERVAL '7 days', 'MM-DD')
               -- Jahreswechsel: das Fenster läuft über den 31.12. hinaus.
               ELSE substring(p.birthdate from 6 for 5) >= to_char(NOW(), 'MM-DD')
                    OR substring(p.birthdate from 6 for 5) <= to_char(NOW() + INTERVAL '7 days', 'MM-DD')
          END)`,
  },
];

/**
 * Die Zähler für alle Gruppen — in EINER Abfrage.
 *
 * Der erste Entwurf stellte acht einzelne `COUNT(*)` hintereinander. Jede
 * musste über rund 4.800 Personen laufen und dabei je Zeile die
 * Unterabfragen für Adresse und Ausschlüsse auswerten; zusammen brauchte das
 * 8,4 Sekunden. Die Seite zeigte deshalb im Screenshot gar keine Gruppen —
 * sie wartete noch.
 *
 * `COUNT(*) FILTER (WHERE …)` beantwortet alle acht Fragen in einem
 * Tabellendurchlauf. Dieselben Bedingungen, dieselben Zahlen, ein Bruchteil
 * der Zeit.
 */
export async function filterGruppen(
  nurAgent: number | null = null, lauf: Lauf = sqlPool,
): Promise<{ schluessel: string; titel: string; anzahl: number }[]> {
  const spalten = GRUPPEN
    .map((g, i) => `COUNT(*) FILTER (WHERE ${g.wo})::int AS g${i}`)
    .join(",\n           ");
  const [z] = (await lauf.unsafe(`
    SELECT ${spalten}
    FROM fiaon_persons p
    WHERE ${IMMER_RAUS} AND ${MAIL_SQL} IS NOT NULL
      AND ($1::int IS NULL OR p.assigned_agent_id = $1::int)
  `, [nurAgent])) as any[];
  return GRUPPEN.map((g, i) => ({
    schluessel: g.schluessel, titel: g.titel, anzahl: Number((z as any)[`g${i}`] ?? 0),
  }));
}

export interface ZielgruppenEingabe {
  /** Einzeln gewählte Personen. */
  personIds?: number[];
  /** Gewählte Filtergruppen (kombinierbar — Vereinigung, nicht Schnitt). */
  gruppen?: string[];
  /** Von Hand getippte externe Adressen. */
  extern?: string[];
}

export async function zielgruppeLaden(
  ein: ZielgruppenEingabe, nurAgent: number | null = null, lauf: Lauf = sqlPool,
): Promise<{ empfaenger: Empfaenger[]; ausgeschlossen: string }> {
  const gesehen = new Set<string>();
  const aus: Empfaenger[] = [];

  const dazu = (e: Empfaenger) => {
    const k = e.email.toLowerCase();
    if (!e.email || gesehen.has(k)) return;
    gesehen.add(k);
    aus.push(e);
  };

  if (ein.personIds?.length) {
    const rows = (await lauf.unsafe(`
      SELECT ${AUSWAHL} FROM fiaon_persons p LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
      WHERE ${IMMER_RAUS} AND ${MAIL_SQL} IS NOT NULL
        AND p.id = ANY($1::int[]) AND ($2::int IS NULL OR p.assigned_agent_id = $2::int)
    `, [ein.personIds, nurAgent])) as any[];
    for (const r of rows) dazu(zuEmpfaenger(r));
  }

  for (const schluessel of ein.gruppen || []) {
    const g = GRUPPEN.find((x) => x.schluessel === schluessel);
    if (!g) continue;
    const rows = (await lauf.unsafe(`
      SELECT ${AUSWAHL} FROM fiaon_persons p LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
      WHERE ${IMMER_RAUS} AND ${MAIL_SQL} IS NOT NULL
        AND ($1::int IS NULL OR p.assigned_agent_id = $1::int) AND (${g.wo})
      LIMIT 5000
    `, [nurAgent])) as any[];
    for (const r of rows) dazu(zuEmpfaenger(r));
  }

  for (const roh of ein.extern || []) {
    const adresse = String(roh).trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(adresse)) continue;
    dazu({ personId: null, name: adresse, email: adresse, vorname: "", extern: true });
  }

  return {
    empfaenger: aus,
    ausgeschlossen: "Testeinträge, DSGVO-gelöschte und archivierte Datensätze sind immer ausgeschlossen.",
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Versand
// ───────────────────────────────────────────────────────────────────────────

export async function zentraleSenden(opts: {
  empfaenger: Empfaenger[];
  betreff: string;
  text: string;
  akteur: { name: string; agentId: number | null };
  lauf?: Lauf;
}): Promise<{
  versandt: number; fehlgeschlagen: number; vertagt: number; meldung: string;
  /** Je Empfänger: hat es geklappt, und wenn nicht — warum. */
  ergebnisse: {
    email: string; name: string; personId: number | null;
    ok: boolean; grund: string | null; protokollId: number | null;
  }[];
  /** Die verschiedenen Gründe, entdoppelt — für die Kopfzeile der Meldung. */
  gruende: string[];
}> {
  const lauf = opts.lauf ?? sqlPool;
  // ── STAFFELUNG ──────────────────────────────────────────────────────────
  // Was über 200 in der laufenden Stunde hinausgeht, wird nicht gesendet und
  // auch nicht stillschweigend verworfen: Der Absender erfährt die Zahl.
  const [z] = (await lauf`
    SELECT COUNT(*)::int AS n FROM fiaon_mail_log
    WHERE event = 'zentrale_freitext' AND created_at > NOW() - INTERVAL '1 hour'
  `) as any[];
  const rest = Math.max(0, PRO_STUNDE - Number(z?.n || 0));
  const jetzt = opts.empfaenger.slice(0, rest);
  const vertagt = opts.empfaenger.length - jetzt.length;

  let versandt = 0;
  let fehlgeschlagen = 0;
  // ── DAS EINZELERGEBNIS ──────────────────────────────────────────────────
  // Bis zum 11.08.2026 gab diese Funktion nur „1 fehlgeschlagen (Grund steht
  // im Protokoll)" zurück. Der Grund lag zu diesem Zeitpunkt bereits in
  // `r.grund` vor — er wurde ins Protokoll geschrieben und aus der Antwort
  // weggeworfen. Der Betreiber musste eine Tabelle suchen, um zu erfahren,
  // was die Zeile darüber schon wusste.
  const ergebnisse: {
    email: string; name: string; personId: number | null;
    ok: boolean; grund: string | null; protokollId: number | null;
  }[] = [];

  for (const e of jetzt) {
    const betreff = bausteineFuellen(opts.betreff, e);
    const text = bausteineFuellen(opts.text, e);
    const r = await eigeneMailSenden({ an: e.email, name: e.name, betreff, text });
    if (r.ok) versandt++; else fehlgeschlagen++;

    await mailProtokoll({
      event: "zentrale_freitext",
      personId: e.personId,
      empfaenger: e.email,
      status: r.ok ? "versandt" : "fehlgeschlagen",
      grund: r.grund ?? null,
      payload: { betreff },
      ausgeloestVon: opts.akteur.name,
      ausgeloestAgentId: opts.akteur.agentId,
    }, lauf);
    const [zeile] = (await lauf`
      UPDATE fiaon_mail_log SET betreff = ${betreff}, brevo_message_id = ${r.messageId}
      WHERE id = (SELECT MAX(id) FROM fiaon_mail_log WHERE event = 'zentrale_freitext')
      RETURNING id
    `.catch(() => [] as any[])) as any[];

    ergebnisse.push({
      email: e.email, name: e.name, personId: e.personId ?? null,
      ok: r.ok, grund: r.grund ?? null,
      // Die Kennung der Protokollzeile — damit die Oberfläche einen Knopf
      // „Im Protokoll öffnen" bauen kann, der GENAU auf diese Zeile springt
      // und nicht auf eine Liste, in der man wieder suchen muss.
      protokollId: zeile?.id ? Number(zeile.id) : null,
    });

    // Jede Mail in die Akte — sonst weiß der Kollege beim nächsten Anruf
    // nicht, dass der Kunde gestern angeschrieben wurde.
    if (e.ref) {
      await lauf`
        INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note, created_at)
        VALUES (${e.ref}, ${opts.akteur.agentId}, ${opts.akteur.name}, 'email_sent',
                ${`E-Mail „${betreff}“ ${r.ok ? "verschickt" : `NICHT verschickt (${r.grund})`} von ${opts.akteur.name}.`}, NOW())
      `.catch(() => {});
    }
  }

  // Die Meldung nennt den GRUND, nicht seinen Aufbewahrungsort. Sind alle
  // Fehler derselbe Fehler — der Regelfall, etwa eine gesperrte Server-IP —,
  // steht er direkt in der Zeile.
  const gruende = Array.from(new Set(
    ergebnisse.filter((x) => !x.ok && x.grund).map((x) => x.grund as string),
  ));
  let meldung: string;
  if (vertagt > 0) {
    meldung = `${versandt} verschickt. ${vertagt} nicht — das Stundenkontingent `
      + `von ${PRO_STUNDE} ist erreicht. Bitte in einer Stunde erneut.`;
  } else if (fehlgeschlagen === 0) {
    meldung = `${versandt} verschickt.`;
  } else if (gruende.length === 1) {
    meldung = `${versandt} verschickt, ${fehlgeschlagen} nicht: ${gruende[0]}`;
  } else {
    meldung = `${versandt} verschickt, ${fehlgeschlagen} nicht — aus `
      + `${gruende.length} verschiedenen Gründen. Sie stehen unten je Empfänger.`;
  }

  return { versandt, fehlgeschlagen, vertagt, meldung, ergebnisse, gruende };
}
