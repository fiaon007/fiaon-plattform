// ═══════════════════════════════════════════════════════════════════════════
// INKASSO — Forderungsmanagement an der RATE
//
// ── DAS SICHTFELD IST DIE WICHTIGSTE ZEILE IN DIESER DATEI ─────────────────
// Inkasso sieht AUSSCHLIESSLICH bezahlte Kunden mit laufender Ratenzahlung.
// Keine Leads, keine unbezahlten Bestellungen, keine Verkaufslisten, keine
// Dokumentinhalte. Die Grenze steht als WHERE-Bedingung im Server — nicht als
// Filter in der Oberfläche, den man mit einem geänderten Parameter umgeht.
//
// Das ist dieselbe Bauweise wie beim Vertrieb: Wer eine Grenze in die
// Darstellung legt, hat keine Grenze, sondern eine Bitte.
//
// ── WARUM AN DER RATE UND NICHT AN DER PERSON ──────────────────────────────
// Der Vertrieb dokumentiert an der Person: eine Wiedervorlage, eine Zusage.
// Das reicht dort, weil es um EINE offene Sache geht. Bei Ratenzahlung sind
// gleichzeitig mehrere Raten im Spiel — „zahlt am 20." muss sich auf Rate 3
// beziehen, nicht auf den Menschen. Sonst überschreibt die Zusage für Rate 4
// die für Rate 3, und niemand merkt es.
//
// ── WAS ES HIER NICHT GIBT ─────────────────────────────────────────────────
// Erlass, Stundung, Kürzung, Storno. Nicht als gesperrter Knopf, sondern
// überhaupt nicht: Es existiert keine Funktion in dieser Datei, die einen
// Ratenbetrag oder eine Fälligkeit ändert. Wer einen Nachlass braucht, geht
// über die Weitergabe an den Vorgesetzten.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";
import { berlinToday, berlinPlusTage } from "./fiaon-time";

type Lauf = typeof sqlPool;

/** Nach Stufe 3 plus dieser Frist wird angerufen statt gemahnt. */
export const ANRUF_PFLICHT_TAGE_VORGABE = 7;

export async function anrufPflichtTage(lauf: Lauf = sqlPool): Promise<number> {
  const [r] = (await lauf`SELECT value FROM fiaon_settings WHERE key = 'inkasso_anruf_tage'`) as any[];
  const n = Number(r?.value);
  return Number.isFinite(n) && n >= 0 ? n : ANRUF_PFLICHT_TAGE_VORGABE;
}

/**
 * DIE SICHTFELD-GRENZE.
 *
 * Eine Rate ist für Inkasso nur sichtbar, wenn:
 *   · die Bestellung dahinter BEZAHLT ist (`payment_status = 'paid'`),
 *   · sie nicht archiviert und nicht DSGVO-gelöscht ist,
 *   · sie nicht zusammengeführt wurde,
 *   · die Rate selbst offen ist.
 *
 * Als Textbaustein, weil er in vier Abfragen gebraucht wird — vier Fassungen
 * wären vier Gelegenheiten, eine zu vergessen.
 */
/**
 * ── DIE FRISTGRENZE, DIE HIER GEFEHLT HAT ──────────────────────────────────
 * Der Vorgesetzte: „Die Mitarbeiter von Forderungsmanagement erhalten
 * AUSSCHLIESSLICH die Kunden, deren Abo-Raten überfällig sind — nur diese!
 * Aktuell haben sie irgendwelche anderen Kunden."
 *
 * Gemessen am 11.08.2026: **153 von 251** Raten im Sichtfeld waren erst
 * SPÄTER als in sieben Tagen fällig. Das Sichtfeld prüfte nur „offen" und
 * „Kunde hat bezahlt" — nicht, ob überhaupt etwas ansteht.
 *
 * Eine Arbeitsliste, in der drei von fünf Zeilen nichts zu tun geben, ist
 * keine Arbeitsliste. Wer sie benutzt, lernt sie zu überfliegen — und
 * übersieht dann auch die zwei, bei denen es brennt.
 *
 * Die Grenze: bis SIEBEN TAGE in die Zukunft. Nicht enger, weil eine Rate,
 * die übermorgen fällig wird, den freundlichen Anruf VORHER verdient — das
 * ist der Unterschied zwischen Forderungsmanagement und Mahnwesen. Nicht
 * weiter, weil alles darüber hinaus noch keine Aufgabe ist.
 */
export const SICHTFELD = `
  r.status = 'offen'
  AND r.faellig_am <= CURRENT_DATE + 7
  AND EXISTS (
    SELECT 1 FROM fiaon_applications a
    WHERE a.ref = r.ref
      AND a.payment_status = 'paid'
      AND a.merged_into IS NULL
      AND a.archived_at IS NULL
      AND a.gdpr_deleted_at IS NULL
  )`;

/**
 * Die drei Fristfenster.
 *
 * Nicht als Zahl, sondern als Bedingung: So kann die Oberfläche filtern, ohne
 * dass jemand ein Datum berechnet — und die Grenze steht an einer Stelle.
 */
export const FRIST_FILTER = {
  alle: "TRUE",
  ueberfaellig: "r.faellig_am < CURRENT_DATE",
  heute: "r.faellig_am = CURRENT_DATE",
  woche: "r.faellig_am > CURRENT_DATE AND r.faellig_am <= CURRENT_DATE + 7",
} as const;

export type FristFenster = keyof typeof FRIST_FILTER;

export function fristBedingung(f?: string | null): string {
  return f && f in FRIST_FILTER ? FRIST_FILTER[f as FristFenster] : FRIST_FILTER.alle;
}

export type RatenErgebnis = "zahlt_am" | "ueberwiesen_beleg" | "nicht_erreicht" | "eskalation";

export const RATEN_ERGEBNISSE: {
  art: RatenErgebnis; label: string; braucht?: "datum" | "notiz"; hinweis: string;
}[] = [
  {
    art: "zahlt_am", label: "Zahlt Rate am …", braucht: "datum",
    hinweis: "Die Rate kommt an diesem Tag wieder auf deinen Tisch.",
  },
  {
    art: "ueberwiesen_beleg", label: "Rate überwiesen — Beleg da",
    hinweis: "Geht in die Verbuchungs-Warteschlange. Gebucht wird nach Kontoabgleich, nicht durch dich.",
  },
  {
    art: "nicht_erreicht", label: "Nicht erreicht",
    hinweis: "Zählt den Versuch und legt die Rate auf morgen.",
  },
  {
    art: "eskalation", label: "Härtefall — an den Vorgesetzten", braucht: "notiz",
    hinweis: "Erzeugt eine Aufgabe für den Vorgesetzten. Nachlass und Stundung entscheidet nur er.",
  },
];

export function istRatenErgebnis(v: unknown): v is RatenErgebnis {
  return RATEN_ERGEBNISSE.some((e) => e.art === v);
}

export interface RatenWirkung {
  wiedervorlage: string | null;
  zusage: string | null;
  eskaliert: boolean;
  meldung: string;
}

/**
 * Ein Ratenergebnis anwenden.
 *
 * Nach demselben Muster wie `ergebnisAnwenden` im Vertrieb — und mit demselben
 * Grundsatz: `undefined` heißt unverändert, `null` heißt ausdrücklich löschen.
 * Ein pauschales Überschreiben aller Spalten würde bei „nicht erreicht" die
 * Zahlungszusage stillschweigend entfernen.
 */
export async function ratenErgebnisAnwenden(
  opts: {
    rateId: number;
    ergebnis: RatenErgebnis;
    agentId: number;
    agentName: string;
    zusageDatum?: string | null;
    notiz?: string | null;
  },
  lauf: Lauf = sqlPool,
): Promise<{ ok: boolean; fehler?: string } & Partial<RatenWirkung>> {
  const [rate] = (await lauf`
    SELECT r.id, r.ref, r.rate_nr, r.betrag_cents, r.zahlungsreferenz, r.faellig_am, r.mahnstufe
    FROM fiaon_abo_raten r WHERE r.id = ${opts.rateId} AND r.status = 'offen'
  `) as any[];
  if (!rate) return { ok: false, fehler: "Diese Rate ist nicht mehr offen." };

  let wiedervorlage: string | null = null;
  let zusage: string | null = null;
  let eskaliert = false;
  let meldung = "";

  switch (opts.ergebnis) {
    case "zahlt_am": {
      const d = String(opts.zusageDatum || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        return { ok: false, fehler: "Für eine Zusage brauche ich ein Datum." };
      }
      if (d < berlinToday()) {
        return { ok: false, fehler: "Ein zugesagtes Datum in der Vergangenheit ist keine Zusage." };
      }
      zusage = d;
      // Einen Tag NACH der Zusage nachsehen: Am Tag selbst ist das Geld noch
      // nicht gebucht, ein Anruf wäre verfrüht und würde als Misstrauen
      // ankommen.
      wiedervorlage = berlinPlusTage(1, new Date(`${d}T12:00:00Z`));
      meldung = `Zusage für den ${d} festgehalten. Die Rate kommt am Tag danach wieder auf deinen Tisch.`;
      break;
    }
    case "ueberwiesen_beleg":
      // Drei Tage: So lange braucht eine Überweisung im Zweifel, bis sie im
      // Kontoabgleich auftaucht. Bucht der Vorgesetzte vorher, verschwindet die
      // Rate ohnehin aus der Liste.
      wiedervorlage = berlinPlusTage(3);
      meldung = "Vermerkt. Die Buchung macht der Kontoabgleich — die Rate bleibt bis dahin offen.";
      break;
    case "nicht_erreicht":
      wiedervorlage = berlinPlusTage(1);
      meldung = "Nicht erreicht — morgen erneut.";
      break;
    case "eskalation": {
      const n = String(opts.notiz || "").trim();
      // Pflicht-Notiz: Eine Weitergabe ohne Begründung ist für den Vorgesetzten
      // wertlos — er sieht eine Aufgabe und weiß nicht, worum es geht.
      if (n.length < 10) {
        return {
          ok: false,
          fehler: "Bitte schreib in zwei Sätzen, was der Kunde gesagt hat. Ohne Begründung kann der Vorgesetzte nicht entscheiden.",
        };
      }
      eskaliert = true;
      // Aus der Liste, bis der Vorgesetzte entschieden hat — sonst ruft man den
      // Menschen morgen wieder an, obwohl der Fall gerade geprüft wird.
      wiedervorlage = berlinPlusTage(14);
      meldung = "An den Vorgesetzten weitergegeben. Die Rate ruht, bis er entschieden hat.";
      await lauf`
        INSERT INTO fiaon_vermerke (art, ref, text, sicht, fuer_betreiber, dringend, status, autor_art, autor_agent_id, autor_name)
        VALUES ('aufgabe', ${rate.ref},
                ${`Härtefall aus dem Forderungsmanagement — Rate ${rate.rate_nr} `
                  + `(${(Number(rate.betrag_cents) / 100).toFixed(2).replace(".", ",")} €, `
                  + `Verwendungszweck ${rate.zahlungsreferenz}, fällig ${String(rate.faellig_am).slice(0, 10)}, `
                  + `Mahnstufe ${rate.mahnstufe}).\n\n${n}\n\n`
                  + `Nachlass, Stundung und Storno entscheidet nur der Vorgesetzte — `
                  + `im Inkasso-Bereich gibt es diese Wege nicht.`},
                'betreiber', TRUE, TRUE, 'offen', 'agent', ${opts.agentId}, ${opts.agentName})
      `;
      break;
    }
  }

  await lauf`
    INSERT INTO fiaon_raten_arbeit (rate_id, ref, agent_id, agent_name, ergebnis, zusage_am, wiedervorlage, notiz)
    VALUES (${rate.id}, ${rate.ref}, ${opts.agentId}, ${opts.agentName}, ${opts.ergebnis},
            ${zusage}, ${wiedervorlage}, ${opts.notiz ?? null})
  `;

  await lauf`
    UPDATE fiaon_abo_raten SET
      inkasso_wiedervorlage = ${wiedervorlage},
      inkasso_zusage_am = ${opts.ergebnis === "zahlt_am" ? zusage : null},
      inkasso_versuche = inkasso_versuche + ${opts.ergebnis === "nicht_erreicht" ? 1 : 0},
      inkasso_agent_id = ${opts.agentId},
      inkasso_letzte_arbeit = NOW(),
      eskaliert_am = ${eskaliert ? new Date() : null},
      updated_at = NOW()
    WHERE id = ${rate.id}
  `;

  // In die Kundenakte — der Vertrieb soll sehen, dass hier gearbeitet wird.
  await lauf`
    INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, outcome, note)
    VALUES (${rate.ref}, ${opts.agentId}, ${opts.agentName}, 'result',
            ${`rate_${opts.ergebnis}`},
            ${`Forderungsmanagement, Rate ${rate.rate_nr}: ${meldung}`
              + (opts.notiz ? `\n${opts.notiz}` : "")})
  `;

  return { ok: true, wiedervorlage, zusage, eskaliert, meldung };
}

// ───────────────────────────────────────────────────────────────────────────
// Arbeitsliste
// ───────────────────────────────────────────────────────────────────────────

/**
 * Die EINE Reihenfolge.
 *
 * 1. Anruf-Pflicht: Stufe 3 erreicht und die Frist verstrichen — der
 *    automatische Versand ist zu Ende, jetzt muss ein Mensch anrufen.
 * 2. Gebrochene Zusage: Der Kunde hat ein Datum genannt und es ist vorbei.
 *    Das steigt bewusst nach oben — eine gebrochene Zusage ist mehr wert als
 *    eine, die noch nie gegeben wurde: Man weiß, dass der Mensch erreichbar
 *    ist und sich gemeldet hat.
 * 3. Überfällig nach Mahnstufe, ABSTEIGEND: Stufe 3 vor 2 vor 1. Je später,
 *    desto dringender.
 * 4. Heute fällig.
 * 5. Alles andere.
 */
export async function arbeitsliste(
  opts: { limit?: number; nurMeine?: number | null; frist?: string | null } = {},
  lauf: Lauf = sqlPool,
): Promise<any[]> {
  const heute = berlinToday();
  const frist = await anrufPflichtTage(lauf);

  return (await lauf`
    SELECT r.id AS rate_id, r.ref, r.rate_nr, r.betrag_cents, r.zahlungsreferenz,
           r.faellig_am, r.mahnstufe, r.erinnerungen, r.letzte_erinnerung_at,
           r.inkasso_wiedervorlage, r.inkasso_zusage_am, r.inkasso_versuche,
           r.eskaliert_am, r.notiz,
           a.person_id, a.payment_reference, SPLIT_PART(a.pack_name, E'\\n', 1) AS paket,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)), ''),
                    a.contact_name, a.email) AS name,
           COALESCE(NULLIF(a.email, ''), a.contact_email) AS email,
           a.phone, a.phone_country_code,
           (r.faellig_am < ${heute}::date) AS ueberfaellig,
           (${heute}::date - r.faellig_am) AS tage_ueberfaellig,
           -- Anruf-Pflicht: höchste Stufe erreicht UND die Frist verstrichen.
           (r.mahnstufe >= 3 AND r.faellig_am < (${heute}::date - ${14 + frist}::int)) AS anruf_pflicht,
           -- Gebrochene Zusage: ein Datum wurde genannt und ist vorbei.
           (r.inkasso_zusage_am IS NOT NULL AND r.inkasso_zusage_am < ${heute}::date) AS zusage_gebrochen,
           (SELECT COUNT(*)::int FROM fiaon_abo_raten x
             WHERE x.ref = r.ref AND x.status = 'bezahlt') AS raten_bezahlt,
           (SELECT COUNT(*)::int FROM fiaon_abo_raten x WHERE x.ref = r.ref) AS raten_gesamt,
           (SELECT w.agent_name FROM fiaon_raten_arbeit w
             WHERE w.rate_id = r.id ORDER BY w.created_at DESC LIMIT 1) AS letzter_bearbeiter,
           (SELECT w.ergebnis FROM fiaon_raten_arbeit w
             WHERE w.rate_id = r.id ORDER BY w.created_at DESC LIMIT 1) AS letztes_ergebnis
    FROM fiaon_abo_raten r
    JOIN fiaon_applications a ON a.ref = r.ref
    WHERE ${lauf.unsafe(SICHTFELD)}
      -- Das Fristfenster: überfällig, heute fällig, oder in den nächsten
      -- sieben Tagen. Ohne Angabe alle drei.
      AND (${lauf.unsafe(fristBedingung(opts.frist))})
      -- Eine Wiedervorlage in der Zukunft nimmt die Rate vom Tisch. Wer eine
      -- Zusage für den 20. hat, ruft nicht am 15. wieder an.
      AND (r.inkasso_wiedervorlage IS NULL OR r.inkasso_wiedervorlage <= ${heute}::date)
      ${opts.nurMeine ? lauf`AND r.inkasso_agent_id = ${opts.nurMeine}` : lauf``}
    ORDER BY
      (r.mahnstufe >= 3 AND r.faellig_am < (${heute}::date - ${14 + frist}::int)) DESC,
      (r.inkasso_zusage_am IS NOT NULL AND r.inkasso_zusage_am < ${heute}::date) DESC,
      (r.faellig_am < ${heute}::date) DESC,
      r.mahnstufe DESC,
      r.faellig_am ASC,
      r.id ASC
    LIMIT ${Math.min(200, opts.limit ?? 60)}
  `) as any[];
}

/**
 * Wie viele Raten stehen in jedem Fristfenster?
 *
 * Ein Filterknopf ohne Zahl ist eine Frage; mit Zahl ist er eine Auskunft.
 * Wer sieht „Überfällig 29", weiß, wo er anfängt.
 */
export async function fristZaehler(
  opts: { nurMeine?: number | null } = {}, lauf: Lauf = sqlPool,
): Promise<{ ueberfaellig: number; heute: number; woche: number; alle: number }> {
  const heute = berlinToday();
  const [z] = (await lauf`
    SELECT
      COUNT(*) FILTER (WHERE r.faellig_am < CURRENT_DATE)::int AS ueberfaellig,
      COUNT(*) FILTER (WHERE r.faellig_am = CURRENT_DATE)::int AS heute,
      COUNT(*) FILTER (WHERE r.faellig_am > CURRENT_DATE)::int AS woche,
      COUNT(*)::int AS alle
    FROM fiaon_abo_raten r
    WHERE ${lauf.unsafe(SICHTFELD)}
      AND (r.inkasso_wiedervorlage IS NULL OR r.inkasso_wiedervorlage <= ${heute}::date)
      ${opts.nurMeine ? lauf`AND r.inkasso_agent_id = ${opts.nurMeine}` : lauf``}
  `) as any[];
  return {
    ueberfaellig: Number(z.ueberfaellig), heute: Number(z.heute),
    woche: Number(z.woche), alle: Number(z.alle),
  };
}

/** Kennzahlen für den Kopf — und für die Übersichten von Leitung und Vorgesetzter. */
export async function kennzahlen(lauf: Lauf = sqlPool): Promise<Record<string, any>> {
  const heute = berlinToday();
  const frist = await anrufPflichtTage(lauf);
  const [z] = (await lauf.unsafe(`
    SELECT
      COUNT(*) FILTER (WHERE r.faellig_am = $1::date)::int AS heute_anzahl,
      COALESCE(SUM(r.betrag_cents) FILTER (WHERE r.faellig_am = $1::date), 0)::bigint AS heute_cents,
      COUNT(*) FILTER (WHERE r.faellig_am < $1::date)::int AS ueberfaellig_anzahl,
      COALESCE(SUM(r.betrag_cents) FILTER (WHERE r.faellig_am < $1::date), 0)::bigint AS ueberfaellig_cents,
      COALESCE(SUM(r.betrag_cents) FILTER (WHERE r.faellig_am < $1::date AND r.mahnstufe = 1), 0)::bigint AS stufe1_cents,
      COALESCE(SUM(r.betrag_cents) FILTER (WHERE r.faellig_am < $1::date AND r.mahnstufe = 2), 0)::bigint AS stufe2_cents,
      COALESCE(SUM(r.betrag_cents) FILTER (WHERE r.faellig_am < $1::date AND r.mahnstufe >= 3), 0)::bigint AS stufe3_cents,
      COUNT(*) FILTER (WHERE r.mahnstufe >= 3 AND r.faellig_am < ($1::date - $2::int))::int AS anruf_pflicht,
      COUNT(*) FILTER (WHERE r.inkasso_zusage_am IS NOT NULL AND r.inkasso_zusage_am >= $1::date)::int AS zusagen_aktiv,
      COUNT(*) FILTER (WHERE r.inkasso_zusage_am IS NOT NULL AND r.inkasso_zusage_am < $1::date)::int AS zusagen_gebrochen,
      COUNT(*) FILTER (WHERE r.eskaliert_am IS NOT NULL)::int AS eskaliert
    FROM fiaon_abo_raten r WHERE ${SICHTFELD}
  `, [heute, 14 + frist])) as any[];

  // Eingezogen: bezahlte Raten dieses Monats. Berlin-Zeit, nicht UTC — sonst
  // gehören die ersten zwei Stunden des Ersten noch zum Vormonat.
  const [m] = (await lauf`
    SELECT COUNT(*)::int AS anzahl, COALESCE(SUM(betrag_cents), 0)::bigint AS cents
    FROM fiaon_abo_raten
    WHERE status = 'bezahlt'
      AND bezahlt_am >= date_trunc('month', ${heute}::date)
  `) as any[];

  // Einzugsquote: Von allen Raten, die diesen Monat fällig WAREN, wie viele
  // sind bezahlt? Ohne den Nenner „fällig gewesen" wäre die Zahl bedeutungslos.
  const [q] = (await lauf`
    SELECT COUNT(*)::int AS faellig_gewesen,
           COUNT(*) FILTER (WHERE status = 'bezahlt')::int AS davon_bezahlt
    FROM fiaon_abo_raten
    WHERE faellig_am >= date_trunc('month', ${heute}::date)
      AND faellig_am <= ${heute}::date
      AND status <> 'storniert'
  `) as any[];

  return {
    ...z,
    eingezogen_monat_anzahl: Number(m.anzahl),
    eingezogen_monat_cents: Number(m.cents),
    quote: Number(q.faellig_gewesen) > 0
      ? Math.round((Number(q.davon_bezahlt) / Number(q.faellig_gewesen)) * 100) : null,
    quote_nenner: Number(q.faellig_gewesen),
    anruf_pflicht_tage: frist,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Vergütung
// ───────────────────────────────────────────────────────────────────────────

/**
 * PLATZHALTER-VORGABEN.
 *
 * Absichtlich runde, auffällige Werte. Die Oberfläche schreibt daneben „vom
 * Vorgesetzter zu bestätigen", und `verguetung_bestaetigt_am` bleibt leer, bis er
 * es getan hat. Ein stiller Vorgabewert, den niemand prüft, wird sonst zur
 * echten Abrechnung.
 */
export const VERGUETUNG_VORGABE = {
  stundensatzCents: 1500,          // 15,00 € — Platzhalter
  praemieArt: "euro" as "euro" | "prozent",
  praemieWert: 200,                // 2,00 € je eingezogener Rate — Platzhalter
};

/**
 * Prämie für eine eingezogene Rate buchen.
 *
 * WIRD AUS DEM BESTEHENDEN BUCHUNGSWEG GERUFEN (`/admin/abo/raten/:id/bezahlt`),
 * nicht daneben. Eine zweite Buchungsstelle wäre die sichere Quelle für doppelte
 * Provisionen.
 *
 * ZWEI BEDINGUNGEN, beide nötig:
 *   · Die Rate wurde DOKUMENTIERT bearbeitet. Ohne Arbeit keine Prämie —
 *     Selbstzahler-Raten erzeugen keine.
 *   · Die Prämie wurde noch nicht gebucht. Der Schutz sitzt in einer eindeutigen
 *     `ref` (`RATE-<id>`), nicht in einer Abfrage davor: Zwei gleichzeitige
 *     Buchungen würden eine Abfrage beide passieren.
 */
export async function praemieBuchen(
  rateId: number, lauf: Lauf = sqlPool,
): Promise<{ gebucht: boolean; grund: string; agentId?: number; cents?: number }> {
  const [rate] = (await lauf`
    SELECT r.id, r.ref, r.rate_nr, r.betrag_cents, r.zahlungsreferenz
    FROM fiaon_abo_raten r WHERE r.id = ${rateId}
  `) as any[];
  if (!rate) return { gebucht: false, grund: "Rate nicht gefunden." };

  // Wer hat zuletzt gearbeitet? Nur echte Arbeit zählt — eine Eskalation ist
  // eine Weitergabe, kein Einzug.
  const [arbeit] = (await lauf`
    SELECT w.agent_id, w.agent_name, w.ergebnis, w.created_at
    FROM fiaon_raten_arbeit w
    WHERE w.rate_id = ${rateId} AND w.ergebnis IN ('zahlt_am', 'ueberwiesen_beleg', 'nicht_erreicht')
    ORDER BY w.created_at DESC LIMIT 1
  `) as any[];
  if (!arbeit) {
    return { gebucht: false, grund: "Keine dokumentierte Bearbeitung — Selbstzahler, keine Prämie." };
  }

  const [agent] = (await lauf`
    SELECT id, inkasso_praemie_art, inkasso_praemie_wert, verguetung_bestaetigt_am
    FROM fiaon_agents WHERE id = ${arbeit.agent_id} AND active
  `) as any[];
  if (!agent) return { gebucht: false, grund: "Bearbeiter nicht mehr aktiv." };
  if (!agent.verguetung_bestaetigt_am) {
    return {
      gebucht: false,
      grund: "Die Vergütung dieses Mitarbeiters ist noch nicht vom Vorgesetzter bestätigt — "
        + "es wird nichts gebucht, was niemand freigegeben hat.",
    };
  }

  const art = String(agent.inkasso_praemie_art || VERGUETUNG_VORGABE.praemieArt);
  const wert = Number(agent.inkasso_praemie_wert ?? VERGUETUNG_VORGABE.praemieWert);
  const cents = art === "prozent"
    ? Math.round((Number(rate.betrag_cents) * wert) / 10_000)  // wert in Basispunkten
    : wert;
  if (cents <= 0) return { gebucht: false, grund: "Prämie ist null." };

  const ref = `RATE-${rate.id}`;
  const [schon] = (await lauf`
    SELECT id FROM fiaon_commissions WHERE ref = ${ref} AND status <> 'storniert'
  `) as any[];
  if (schon) return { gebucht: false, grund: "Prämie für diese Rate ist schon gebucht." };

  await lauf`
    INSERT INTO fiaon_commissions
      (agent_id, ref, payment_reference, pack_name, base_amount_cents, rate_bp, amount_cents, status, kind, note)
    VALUES (${arbeit.agent_id}, ${ref}, ${rate.zahlungsreferenz}, 'Forderungsmanagement',
            ${rate.betrag_cents}, ${art === "prozent" ? wert : 0}, ${cents}, 'bestaetigt', 'inkasso',
            ${`Eingezogene Rate ${rate.rate_nr} zu ${rate.ref} — zuletzt bearbeitet von `
              + `${arbeit.agent_name} (${arbeit.ergebnis}).`})
  `;
  console.log(`[INKASSO] Prämie ${(cents / 100).toFixed(2)} € an Agent ${arbeit.agent_id} für Rate ${rate.id}`);
  return { gebucht: true, grund: "gebucht", agentId: Number(arbeit.agent_id), cents };
}

/** Der Verdienst dieses Monats — Stunden plus Prämien. */
export async function verdienst(agentId: number, lauf: Lauf = sqlPool): Promise<Record<string, any>> {
  const [a] = (await lauf`
    SELECT stundensatz_cents, inkasso_praemie_art, inkasso_praemie_wert, verguetung_bestaetigt_am
    FROM fiaon_agents WHERE id = ${agentId}
  `) as any[];
  const satz = Number(a?.stundensatz_cents ?? VERGUETUNG_VORGABE.stundensatzCents);

  const [st] = (await lauf`
    SELECT COALESCE(SUM(minuten) FILTER (WHERE bestaetigt_am IS NOT NULL), 0)::int AS bestaetigt_min,
           COALESCE(SUM(minuten) FILTER (WHERE bestaetigt_am IS NULL), 0)::int AS offen_min
    FROM fiaon_stunden
    WHERE agent_id = ${agentId} AND entfernt_am IS NULL
      AND tag >= date_trunc('month', ${berlinToday()}::date)
  `) as any[];

  const [pr] = (await lauf`
    SELECT COUNT(*)::int AS anzahl, COALESCE(SUM(amount_cents), 0)::bigint AS cents
    FROM fiaon_commissions
    WHERE agent_id = ${agentId} AND kind = 'inkasso' AND status <> 'storniert'
      AND created_at >= date_trunc('month', ${berlinToday()}::date)
  `) as any[];

  const stundenCents = Math.round((Number(st.bestaetigt_min) / 60) * satz);
  return {
    stundensatzCents: satz,
    bestaetigtMinuten: Number(st.bestaetigt_min),
    offeneMinuten: Number(st.offen_min),
    stundenCents,
    praemienAnzahl: Number(pr.anzahl),
    praemienCents: Number(pr.cents),
    gesamtCents: stundenCents + Number(pr.cents),
    verguetungBestaetigt: !!a?.verguetung_bestaetigt_am,
    praemieArt: String(a?.inkasso_praemie_art || VERGUETUNG_VORGABE.praemieArt),
    praemieWert: Number(a?.inkasso_praemie_wert ?? VERGUETUNG_VORGABE.praemieWert),
  };
}


// ═══════════════════════════════════════════════════════════════════════════
// ZUTEILUNG — wer bearbeitet welche überfällige Rate?
//
// ── DIE FRAGE DES VORGESETZTEN ─────────────────────────────────────────────
// „Hans-Jürgen Gerhold ist unser neuer Mitarbeiter für Inkasso — wie teile
// ich ihm Kunden zu? Wir bekommen noch 1–2 weitere, wie mache ich das mit
// den überfälligen Zahlungen?"
//
// ── WARUM DAS NICHT WIE BEIM VERTRIEB LÄUFT ────────────────────────────────
// Im Vertrieb gehört ein KUNDE dauerhaft einem Menschen. Beim Inkasso ist
// das falsch: Zugeteilt wird eine RATE, nicht ein Kunde. Ein Kunde hat zwölf
// Raten, und wenn Rate 3 überfällig ist und Rate 7 später auch, muss nicht
// derselbe Mensch dran sein — er ist vielleicht im Urlaub oder nicht mehr da.
//
// Zweiter Unterschied: Eine überfällige Rate ist DRINGEND. Sie darf nicht
// warten, bis jemand sie von Hand verteilt. Deshalb läuft die Verteilung
// automatisch, und die Zuteilung von Hand ist der Ausnahmefall.
//
// ── DER RUNDLAUF ───────────────────────────────────────────────────────────
// Gleichmäßig, aber nicht stur: Wer schon mehr offene Fälle hat, bekommt
// weniger neue. Sonst hätte der eine 40 Fälle und der andere 8, nur weil
// einer davon zwei Wochen krank war.
// ═══════════════════════════════════════════════════════════════════════════

/** Die aktiven Inkasso-Mitarbeiter, nach aktueller Last sortiert. */
export async function inkassoMannschaft(lauf: Lauf = sqlPool): Promise<{
  id: number; name: string; offen: number; heuteBearbeitet: number;
}[]> {
  const r = (await lauf`
    SELECT a.id, a.name,
           (SELECT COUNT(*)::int FROM fiaon_abo_raten r
             WHERE r.inkasso_agent_id = a.id AND r.status <> 'bezahlt') AS offen,
           (SELECT COUNT(*)::int FROM fiaon_raten_arbeit w
             WHERE w.agent_id = a.id
               AND w.created_at >= (CURRENT_DATE)::timestamp AT TIME ZONE 'Europe/Berlin') AS heute
    FROM fiaon_agents a
    WHERE a.active AND a.rolle = 'inkasso' AND NOT a.is_test_account
    ORDER BY offen ASC, a.id ASC
  `) as any[];
  return r.map((x) => ({
    id: Number(x.id), name: String(x.name),
    offen: Number(x.offen), heuteBearbeitet: Number(x.heute),
  }));
}

/**
 * Überfällige Raten verteilen.
 *
 * ── OHNE `schreiben` PASSIERT NICHTS ───────────────────────────────────────
 * Eine Verteilung greift in die Arbeit mehrerer Menschen ein. Wer sie zum
 * ersten Mal anschaut, will sehen, was passieren WÜRDE — nicht, was passiert
 * IST. Dieselbe Regel wie bei jedem Massenlauf im Haus.
 */
export async function inkassoVerteilen(
  opts: { schreiben?: boolean; nurAgentId?: number | null; anzahl?: number } = {},
  lauf: Lauf = sqlPool,
): Promise<{
  mannschaft: { id: number; name: string; offen: number }[];
  unverteilt: number;
  vorschlag: { rateId: number; ref: string; kunde: string; faelligAm: string; betragCents: number;
               anAgentId: number; anAgentName: string }[];
  verteilt: number;
  hinweis: string;
}> {
  const mannschaft = await inkassoMannschaft(lauf);
  if (mannschaft.length === 0) {
    return {
      mannschaft: [], unverteilt: 0, vorschlag: [], verteilt: 0,
      hinweis: "Es gibt keinen aktiven Mitarbeiter mit der Rolle Inkasso. Lege zuerst "
        + "einen an — in der Team-Zentrale unter „Teammitglied anlegen“, Position „Inkasso“.",
    };
  }

  // ── DIE OFFENEN FÄLLE ───────────────────────────────────────────────────
  // Nur was WIRKLICH überfällig ist und noch niemandem gehört. Eine Rate, die
  // heute fällig wird, ist nicht überfällig — sie ist fällig.
  const offen = (await lauf`
    SELECT r.id, r.ref, r.faellig_am, r.betrag_cents,
           TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')) AS kunde
    FROM fiaon_abo_raten r
    LEFT JOIN fiaon_applications a ON a.ref = r.ref
    LEFT JOIN fiaon_persons p ON p.id = a.person_id
    WHERE ${lauf.unsafe(SICHTFELD)}
      AND r.status <> 'bezahlt'
      AND r.faellig_am < CURRENT_DATE
      AND r.inkasso_agent_id IS NULL
    ORDER BY r.faellig_am ASC, r.id ASC
    LIMIT ${Math.min(500, Math.max(1, opts.anzahl ?? 200))}
  `) as any[];

  // ── DER RUNDLAUF, LASTGERECHT ───────────────────────────────────────────
  // Jeder Mensch bekommt der Reihe nach einen Fall — aber die Reihe beginnt
  // bei dem mit den WENIGSTEN offenen Fällen. Nach jeder Zuteilung wird neu
  // sortiert. So gleicht sich ein Rückstand von selbst aus, statt sich zu
  // verfestigen.
  const last = new Map(mannschaft.map((m) => [m.id, m.offen]));
  const ziel = opts.nurAgentId
    ? mannschaft.filter((m) => m.id === opts.nurAgentId)
    : mannschaft;
  if (ziel.length === 0) {
    return {
      mannschaft, unverteilt: offen.length, vorschlag: [], verteilt: 0,
      hinweis: "Dieser Mensch hat nicht die Rolle Inkasso.",
    };
  }

  const vorschlag = offen.map((r) => {
    const naechster = [...ziel].sort((a, b) =>
      (last.get(a.id) ?? 0) - (last.get(b.id) ?? 0) || a.id - b.id)[0];
    last.set(naechster.id, (last.get(naechster.id) ?? 0) + 1);
    return {
      rateId: Number(r.id), ref: String(r.ref),
      kunde: String(r.kunde ?? "").trim() || "Ohne Namen",
      faelligAm: new Date(r.faellig_am).toISOString().slice(0, 10),
      betragCents: Number(r.betrag_cents ?? 0),
      anAgentId: naechster.id, anAgentName: naechster.name,
    };
  });

  if (!opts.schreiben) {
    return {
      mannschaft, unverteilt: offen.length, vorschlag, verteilt: 0,
      hinweis: offen.length === 0
        ? "Es gibt keine überfällige Rate ohne Zuständigen. Alles ist verteilt."
        : `${offen.length} überfällige ${offen.length === 1 ? "Rate" : "Raten"} ohne Zuständigen. `
          + "Das ist die Vorschau — es wurde nichts geändert.",
    };
  }

  let verteilt = 0;
  for (const v of vorschlag) {
    // `inkasso_agent_id IS NULL` in der Bedingung: Läuft die Verteilung
    // zweimal gleichzeitig, gewinnt der erste Lauf. Ohne diese Bedingung
    // könnte der zweite eine bereits zugeteilte Rate übernehmen.
    const r = await lauf`
      UPDATE fiaon_abo_raten
      SET inkasso_agent_id = ${v.anAgentId}, updated_at = NOW()
      WHERE id = ${v.rateId} AND inkasso_agent_id IS NULL
      RETURNING id
    `;
    if ((r as any[]).length > 0) verteilt++;
  }

  console.log(`[INKASSO] ${verteilt} Raten verteilt auf ${ziel.length} Menschen.`);
  return {
    mannschaft: await inkassoMannschaft(lauf),
    unverteilt: offen.length - verteilt, vorschlag, verteilt,
    hinweis: `${verteilt} ${verteilt === 1 ? "Rate" : "Raten"} zugeteilt.`,
  };
}

/** Eine einzelne Rate von Hand zuweisen — für den Ausnahmefall. */
export async function inkassoRateZuweisen(
  rateId: number, agentId: number | null, wer: string, lauf: Lauf = sqlPool,
): Promise<{ ok: boolean; grund?: string }> {
  if (agentId !== null) {
    const [a] = (await lauf`
      SELECT id, rolle FROM fiaon_agents WHERE id = ${agentId} AND active
    `) as any[];
    if (!a) return { ok: false, grund: "Diesen Mitarbeiter gibt es nicht." };
    if (String(a.rolle) !== "inkasso") {
      return { ok: false, grund: "Nur ein Mensch mit der Rolle Inkasso kann Raten bearbeiten." };
    }
  }
  const r = await lauf`
    UPDATE fiaon_abo_raten SET inkasso_agent_id = ${agentId}, updated_at = NOW()
    WHERE id = ${rateId} RETURNING ref
  `;
  if ((r as any[]).length === 0) return { ok: false, grund: "Diese Rate gibt es nicht." };
  console.log(`[INKASSO] Rate ${rateId} ${agentId ? `an ${agentId}` : "freigegeben"} von ${wer}.`);
  return { ok: true };
}
