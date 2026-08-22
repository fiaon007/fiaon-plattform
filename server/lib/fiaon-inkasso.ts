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
// EINE Normalisierung für Anzeige UND Wahl — dieselbe, die der Vertrieb benutzt.
import { waehlbareNummer } from "./fiaon-telefon";

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
 *
 * NACH HINTEN gibt es KEINE Grenze. Der Vorgesetzte: „ALLE Kunden, die
 * ÜBERFÄLLIG sind oder waren, egal welche Mahnstufe." Eine Rate, die seit
 * neunzig Tagen offen ist, ist dringender als eine von gestern — sie fällt
 * nicht aus dem Blick, nur weil sie alt ist.
 *
 * ── „status <> bezahlt“ STATT „status = offen“ ─────────────────────────────
 * Die erste Fassung fragte nach „offen". Eine Rate, die auf „gemahnt",
 * „eskaliert" oder sonst einen Zwischenstand gesetzt wird, verschwand damit
 * lautlos aus dem Forderungsmanagement — genau die, um die man sich am
 * meisten kümmern muss. Heute steht dort zwar bei allen 29 „offen"; die
 * Bedingung darf aber nicht davon abhängen, dass niemand je einen neuen
 * Status einführt.
 */
// ═══════════════════════════════════════════════════════════════════════════
// „HEUTE" IST BERLIN, NICHT UTC
//
// ── DER BEFUND (17.08.2026, nachts vom Prüfstand gefunden) ────────────────
// Hier stand überall „CURRENT_DATE“. Das ist das Datum der DATENBANK, und die
// läuft in UTC. Zwischen 00:00 und 02:00 Berliner Sommerzeit (im Winter 00:00
// bis 01:00) ist „CURRENT_DATE“ noch der VORTAG.
//
// Was das heißt: Eine Rate, die heute überfällig wird, gilt in diesem Fenster
// als „heute fällig“ und wird NICHT zugeteilt — die Bedingung
// „faellig_am < CURRENT_DATE“ ist falsch, obwohl der Tag in Berlin längst
// gewechselt hat. Der Tageslauf
// läuft stündlich, der Fehler heilt sich also um 02:00 von selbst; aber die
// Zahlen im Kopf der Liste („X überfällig, Y heute") waren nachts falsch, und
// wer um 00:30 arbeitet, sah eine andere Wahrheit als sein Kollege um 03:00.
//
// Gefunden hat es der Prüfstand scripts/pruef-abo-motor.ts, der eine Rate auf
// „gestern" nach BERLINER Rechnung setzt — und dann keine Zuteilung sah.
//
// AGENTS.md: „Zeitzone ist Europe/Berlin — über server/lib/fiaon-time.ts, nie
// über new Date()." Das gilt für das SQL-Datum genauso.
// ═══════════════════════════════════════════════════════════════════════════
const HEUTE_BERLIN = "(NOW() AT TIME ZONE 'Europe/Berlin')::date";

export const SICHTFELD = `
  r.status <> 'bezahlt'
  AND r.faellig_am <= ${HEUTE_BERLIN} + 7
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
  ueberfaellig: `r.faellig_am < ${HEUTE_BERLIN}`,
  heute: `r.faellig_am = ${HEUTE_BERLIN}`,
  woche: `r.faellig_am > ${HEUTE_BERLIN} AND r.faellig_am <= ${HEUTE_BERLIN} + 7`,
} as const;

export type FristFenster = keyof typeof FRIST_FILTER;

export function fristBedingung(f?: string | null): string {
  return f && f in FRIST_FILTER ? FRIST_FILTER[f as FristFenster] : FRIST_FILTER.alle;
}

export type RatenErgebnis = "zahlt_am" | "ueberwiesen_beleg" | "nicht_erreicht"
  | "nummer_blockiert" | "eskalation";

/**
 * Wie viele Tage ruht eine Rate, deren Nummer uns blockiert?
 *
 * Nicht `null`: Die Arbeitsliste zeigt Raten mit LEERER Wiedervorlage sofort
 * wieder an („IS NULL OR <= heute"). „Aussetzen" heißt hier also ein Datum in
 * der Zukunft, nicht das Löschen des Datums — sonst stünde der Fall morgen
 * wieder da, und der Agent wählt eine Nummer, die ihn wegdrückt.
 */
const BLOCKIERT_RUHE_TAGE = 30;

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
  // ── DIE BLOCKIER-MARKE, JETZT AUCH HIER (30.08.2026) ────────────────────
  // Der Vertrieb hat sie seit Wochen, das Forderungsmanagement nicht — und
  // gerade dort blockieren Menschen die Nummer. Ohne diesen Knopf blieb dem
  // Agenten nur „Nicht erreicht", und die Rate kam am nächsten Tag wieder auf
  // den Tisch: Er wählte dieselbe Nummer, die ihn wegdrückt, bis zur
  // Eskalationsstufe.
  {
    art: "nummer_blockiert", label: "Nummer blockiert uns",
    hinweis: `Die Nummer wird markiert und die Rate ruht ${BLOCKIERT_RUHE_TAGE} Tage. `
      + "Anrufen bringt hier nichts mehr — der Weg läuft über Mail und Mahnung.",
  },
  {
    art: "eskalation", label: "Härtefall — an den Vorgesetzten", braucht: "notiz",
    hinweis: "Erzeugt eine Aufgabe für den Vorgesetzten. Nachlass und Stundung entscheidet nur er.",
  },
];

/** Ab dem wievielten vergeblichen Versuch ruht eine Rate — und wie lange. */
export const NICHT_ERREICHT_RUHE_AB = 5;
export const NICHT_ERREICHT_RUHE_TAGE = 14;

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
    SELECT r.id, r.ref, r.rate_nr, r.betrag_cents, r.zahlungsreferenz, r.faellig_am, r.mahnstufe,
           COALESCE(r.inkasso_versuche, 0)::int AS inkasso_versuche
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
    case "nicht_erreicht": {
      // ── NACH FÜNF VERSUCHEN RUHT DIE RATE (22.08.2026, C17a / V-8) ──────
      // Vorher stur +1 Tag, ohne Ende: Wer nie abnahm, stand jeden Morgen
      // wieder oben — und jeder Anruf kostete Zeit, die bei erreichbaren
      // Kunden fehlte. Die Mahnungen laufen weiter; in 14 Tagen ist er
      // wieder dran. Dieselbe Idee wie der Ruhe-Pool im Vertrieb.
      const versucheDanach = Number(rate.inkasso_versuche || 0) + 1;
      if (versucheDanach >= NICHT_ERREICHT_RUHE_AB) {
        wiedervorlage = berlinPlusTage(NICHT_ERREICHT_RUHE_TAGE);
        meldung = `${versucheDanach}. Versuch ohne Erfolg — die Rate ruht ${NICHT_ERREICHT_RUHE_TAGE} Tage. `
          + "Die Mahnungen laufen weiter; der Anrufweg pausiert.";
      } else {
        wiedervorlage = berlinPlusTage(1);
        meldung = `Nicht erreicht (${versucheDanach}. Versuch) — morgen erneut.`;
      }
      break;
    }
    case "nummer_blockiert":
      wiedervorlage = berlinPlusTage(BLOCKIERT_RUHE_TAGE);
      meldung = `Nummer blockiert uns — die Rate ruht ${BLOCKIERT_RUHE_TAGE} Tage. `
        + "Die Mahnungen laufen weiter, der Anrufweg ist zu.";
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

  // ── IN DIE KUNDENAKTE ───────────────────────────────────────────────────
  // Der Vertrieb soll sehen, dass hier gearbeitet wird.
  //
  // ── EINE AUSNAHME BEI DER SCHREIBWEISE, UND ZWAR MIT GRUND ──────────────
  // Alle Ratenergebnisse landen als `rate_<art>` im Verlauf — so ist erkennbar,
  // dass sie aus dem Forderungsmanagement kommen und nicht aus dem Vertrieb.
  //
  // „Nummer blockiert uns" ist der eine Fall, wo das schaden würde. Diese
  // Tatsache wird nämlich GELESEN: `server/lib/fiaon-uebergabe.ts` fragt
  //
  //     WHERE cl.outcome = 'nummer_blockiert'
  //
  // um zu wissen, bei welchem Kollegen der Kunde schon blockiert hat. Ein
  // Eintrag als `rate_nummer_blockiert` wäre für diese Abfrage unsichtbar —
  // zwei Schreibweisen für dieselbe Tatsache, und die Übergabe schickt den
  // Kunden an jemanden, der längst weggedrückt wurde. AGENTS.md nennt genau
  // das: „Wer einen Status schreibt, prüft, welche Werte die Leser kennen."
  //
  // Deshalb trägt dieser eine Fall die HAUSWEITE Schreibweise, und die Herkunft
  // steht im Text. Die Marke ist die Tatsache, nicht die Abteilung.
  const outcomeFuerAkte = opts.ergebnis === "nummer_blockiert"
    ? "nummer_blockiert"
    : `rate_${opts.ergebnis}`;
  await lauf`
    INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, outcome, note)
    VALUES (${rate.ref}, ${opts.agentId}, ${opts.agentName}, 'result',
            ${outcomeFuerAkte},
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
  // Die letzte Stufe kommt aus EINER Quelle (MAHNSTUFEN in fiaon-abo.ts).
  // Hier stand hart „>= 3", während der Motor bis Stufe 5 sendet — die
  // Karte meldete „Versand beendet", und es kamen noch zwei Mails.
  const { MAHNSTUFEN } = await import("../routes/fiaon-abo");
  const letzteStufe = MAHNSTUFEN.length;

  const zeilen = (await lauf`
    SELECT r.id AS rate_id, r.ref, r.rate_nr, r.betrag_cents, r.zahlungsreferenz,
           r.faellig_am, r.mahnstufe, r.erinnerungen, r.letzte_erinnerung_at,
           r.inkasso_wiedervorlage, r.inkasso_zusage_am, r.inkasso_versuche,
           r.eskaliert_am, r.notiz,
           -- Lastschrift (22.08.2026): Eine geplatzte Lastschrift ist ein
           -- eigener Fall, ein gekündigtes Mandat ein anderer erster Satz.
           r.lastschrift_status, r.lastschrift_grund, r.lastschrift_am,
           p.gc_mandate_status,
           a.person_id, a.payment_reference, SPLIT_PART(a.pack_name, E'\\n', 1) AS paket,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)), ''),
                    a.contact_name, a.email) AS name,
           COALESCE(NULLIF(a.email, ''), a.contact_email) AS email,
           -- Die Rohwerte bleiben in der Antwort (Anzeige „so steht es in der
           -- Akte“), aber die WÄHLBARE Form entsteht unten aus
           -- „waehlbareNummer“ — nicht in der Oberfläche. Begründung dort.
           a.phone, a.phone_country_code, a.contact_phone, a.country,
           (r.faellig_am < ${heute}::date) AS ueberfaellig,
           (${heute}::date - r.faellig_am) AS tage_ueberfaellig,
           -- Anruf-Pflicht: höchste Stufe erreicht UND die Frist verstrichen.
           (r.mahnstufe >= ${letzteStufe} AND r.faellig_am < (${heute}::date - ${14 + frist}::int)) AS anruf_pflicht,
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
    LEFT JOIN fiaon_persons p ON p.id = a.person_id
    WHERE ${lauf.unsafe(SICHTFELD)}
      -- Das Fristfenster: überfällig, heute fällig, oder in den nächsten
      -- sieben Tagen. Ohne Angabe alle drei.
      AND (${lauf.unsafe(fristBedingung(opts.frist))})
      -- Eine Wiedervorlage in der Zukunft nimmt die Rate vom Tisch. Wer eine
      -- Zusage für den 20. hat, ruft nicht am 15. wieder an.
      AND (r.inkasso_wiedervorlage IS NULL OR r.inkasso_wiedervorlage <= ${heute}::date)
      -- ══════════════════════════════════════════════════════════════════
      -- SEINE FÄLLE UND DIE, DIE NIEMANDEM GEHÖREN
      --
      -- ── DER BEFUND (11.08.2026) ───────────────────────────────────────
      -- Der Vorgesetzte: „ALLE Kunden, die ÜBERFÄLLIG sind oder waren."
      --
      -- Gemessen: Die Oberfläche zeigte 29, serverseitig waren 86 überfällig.
      -- Der Grund war diese Zeile: die Gleichheit auf inkasso_agent_id sperrte
      -- den Menschen auf seine zugeteilten Fälle ein. Die 57 neu
      -- nachgetragenen gehörten noch niemandem — und lagen damit unsichtbar.
      --
      -- Eine überfällige Rate, die niemandem gehört, ist keine Ruhe, sondern
      -- liegengebliebene Arbeit. Wer den Bereich öffnet, muss sie sehen.
      ${opts.nurMeine
        ? lauf`AND (r.inkasso_agent_id = ${opts.nurMeine} OR r.inkasso_agent_id IS NULL)`
        : lauf``}
    ORDER BY
      -- Die eigenen zuerst: Wer zugeteilt ist, hat Vorrang vor dem, was
      -- herumliegt — sonst arbeitet man an fremden Fällen, während die eigenen
      -- warten.
      ${opts.nurMeine ? lauf`(r.inkasso_agent_id = ${opts.nurMeine}) DESC,` : lauf``}
      (r.mahnstufe >= ${letzteStufe} AND r.faellig_am < (${heute}::date - ${14 + frist}::int)) DESC,
      -- Geplatzte Lastschrift vor gebrochener Zusage: Hier hat die Bank
      -- schon Nein gesagt, und jede Rücklastschrift kostet FIAON Gebühren.
      (r.lastschrift_status = 'fehlgeschlagen') DESC,
      (r.inkasso_zusage_am IS NOT NULL AND r.inkasso_zusage_am < ${heute}::date) DESC,
      (r.faellig_am < ${heute}::date) DESC,
      r.mahnstufe DESC,
      r.faellig_am ASC,
      r.id ASC
    LIMIT ${Math.min(200, opts.limit ?? 60)}
  `) as any[];

  // ═══════════════════════════════════════════════════════════════════════════
  // DIE WÄHLBARE NUMMER ENTSTEHT HIER, NICHT IN DER OBERFLÄCHE (30.08.2026)
  //
  // ── DIE MELDUNG ───────────────────────────────────────────────────────────
  // „Im Forderungsmanagement steht +49 +49 vor der Nummer. Im Vertrieb ist sie
  // richtig."
  //
  // ── DIE URSACHE ───────────────────────────────────────────────────────────
  // Diese Liste lieferte nur die Rohwerte, und die Oberfläche setzte sie selbst
  // zusammen — an zwei Stellen in inkasso.tsx:
  //
  //     ${"$"}{f.phone_country_code || "+49"}${"$"}{String(f.phone).replace(/^0/, "")}
  //
  // Steht in `phone` schon „+436642204641" und daneben „+43", ergibt das
  // „+43+436642204641". Das `replace(/^0/)` greift nicht, weil die Nummer mit
  // einem Plus beginnt und nicht mit einer Null.
  //
  // GEMESSEN (scripts/mess-doppelpraefix.ts): 21 von 385 Zeilen der Arbeitsliste
  // zeigten ein Doppelpräfix.
  //
  // ── UND DER GEFÄHRLICHERE TEIL DERSELBEN ZEILE ────────────────────────────
  // Der Rückfall „|| '+49'" hängte eine DEUTSCHE Vorwahl an österreichische
  // Nummern (gemessen: „Christa Kainz", phone „+436641924910", keine getrennte
  // Vorwahl → „+49+436641924910"). Hätte man nur das doppelte Plus entfernt,
  // wäre „+4943664…" gewählt worden — ein fremder Teilnehmer. AGENTS.md sagt es
  // seit dem ersten Tag: Eine geratene Vorwahl ruft einen fremden Menschen an.
  //
  // `waehlbareNummer` hat für genau diesen Fall Regel 5: Ohne Vorwahl wird die
  // Nummer ANGEZEIGT, aber nicht wählbar gemacht, und der Grund steht dabei.
  // Deshalb gibt es hier keinen Rückfall auf „+49".
  // ═══════════════════════════════════════════════════════════════════════════
  return zeilen.map((r) => ({ ...r, ...telefonFelder(r) }));
}

/**
 * Die drei Telefon-Felder aus EINER Quelle — für Rate-Zeilen und Personenkarten.
 *
 * Reihenfolge der Quellen wie in `nummerAusZeile`: die Nummer der Bestellung mit
 * ihrer getrennten Vorwahl zuerst, dann die Kontaktnummer. Zwei Reihenfolgen für
 * dieselbe Frage wären zwei Wahrheiten.
 */
function telefonFelder(r: any): {
  telefonAnzeige: string | null; telefonWaehlbar: string | null; telefonHinweis: string | null;
} {
  const t = waehlbareNummer(
    [
      { nummer: r?.phone, vorwahl: r?.phone_country_code },
      { nummer: r?.contact_phone },
    ],
    r?.country,
  );
  return { telefonAnzeige: t.anzeige, telefonWaehlbar: t.waehlbar, telefonHinweis: t.hinweis };
}

// ═══════════════════════════════════════════════════════════════════════════
// EINE ZEILE PRO MENSCH
//
// ── DER BEFUND (16.08.2026) ────────────────────────────────────────────────
// Team: „Zusner dreimal, Namen wiederholen sich beim Scrollen."
//
// Gemessen: 213 Zeilen in der Arbeitsliste für 180 Menschen. 21 Namen kamen
// mehrfach vor. Der Spitzenfall heißt Peter Zußner (mit ß), person_id 3417 —
// EINE Person, ZWEI bezahlte Pro-Bestellungen, je drei offene Raten.
//
// Also KEINE Personen-Dublette: Weder gibt es zwei Datensätze zu ihm, noch
// hilft die Merge-Maschine hier. Es sind zwei echte parallele Abos desselben
// Menschen — er wird doppelt abgerechnet — und die Liste zeigte jede Rate als
// eigene Zeile.
//
// ── WARUM DAS MEHR IST ALS EINE ANSICHTSFRAGE ──────────────────────────────
// Wer dieselbe Person fünfmal in der Liste hat, ruft sie fünfmal an. Oder er
// ruft sie einmal an, dokumentiert an EINER Rate, und die anderen vier bleiben
// als „unbearbeitet" stehen. Beides ist falsch, und beides sieht in der
// Statistik aus wie fleißige Arbeit.
//
// ── DIE ARBEIT BLEIBT AN DER RATE ──────────────────────────────────────────
// Gruppiert wird nur die ANZEIGE. Zusage, Wiedervorlage und Prämie hängen
// weiter an der einzelnen Rate — sonst überschriebe die Zusage für Rate 4 die
// für Rate 3, und genau das steht oben in dieser Datei als Begründung.
// ═══════════════════════════════════════════════════════════════════════════

export interface InkassoPerson {
  personId: number | null;
  name: string;
  email: string | null;
  phone: string | null;
  phoneCountryCode: string | null;
  /** Anzeigeform, z. B. „+43 664 2204641". Nie selbst zusammensetzen. */
  telefonAnzeige: string | null;
  /** Für den Anruf — nur gesetzt, wenn die Nummer wirklich wählbar ist. */
  telefonWaehlbar: string | null;
  /** Warum nicht wählbar? Klartext für die Oberfläche. */
  telefonHinweis: string | null;
  /** Die Raten dieses Menschen, dringendste zuerst. */
  raten: any[];
  /** Wie viele Raten, wie viel Geld. */
  anzahl: number;
  summeCents: number;
  /** Die dringendste Rate — sie bestimmt die Sortierung der Karte. */
  dringendste: any;
  /** Mehr als eine BESTELLUNG mit offenen Raten: paralleles Zweit-Abo. */
  bestellungen: number;
  zweitAbo: boolean;
  /** „Abo aktiv seit 05.07. · nächste Rate 05.09. · Rechnung geht automatisch raus" */
  zyklusText?: string;
  anker?: string | null;
}

/**
 * Die Arbeitsliste, nach Menschen gruppiert.
 *
 * Die Reihenfolge der Karten ist die Reihenfolge der jeweils DRINGENDSTEN
 * Rate. `arbeitsliste` sortiert bereits richtig — die erste Rate einer Person
 * ist damit ihre dringendste, und die Reihenfolge des ersten Auftretens ist
 * die richtige Kartenreihenfolge. Ein zweites Sortierkriterium hier wäre eine
 * zweite Definition von „dringend".
 */
export async function arbeitslistePersonen(
  opts: { limit?: number; nurMeine?: number | null; frist?: string | null } = {},
  lauf: Lauf = sqlPool,
): Promise<InkassoPerson[]> {
  const raten = await arbeitsliste(opts, lauf);
  const karten: InkassoPerson[] = [];
  const index = new Map<string, InkassoPerson>();

  for (const r of raten) {
    // Ohne person_id gibt es keinen Menschen, an dem man gruppieren könnte —
    // dann bleibt die Bestellung die Einheit. Gemessen: 0 solche Fälle, aber
    // eine Gruppierung, die bei NULL alle in einen Topf wirft, wäre eine
    // Karte mit fremden Menschen darin.
    const schluessel = r.person_id != null ? `p:${r.person_id}` : `ref:${r.ref}`;
    let karte = index.get(schluessel);
    if (!karte) {
      karte = {
        personId: r.person_id != null ? Number(r.person_id) : null,
        name: String(r.name ?? "Ohne Namen"),
        email: r.email ?? null,
        phone: r.phone ?? null,
        phoneCountryCode: r.phone_country_code ?? null,
        // Dieselben Felder wie an der Rate-Zeile, aus derselben Funktion. Die
        // Karte darf nicht anders wählen als die Zeile darunter.
        telefonAnzeige: r.telefonAnzeige ?? null,
        telefonWaehlbar: r.telefonWaehlbar ?? null,
        telefonHinweis: r.telefonHinweis ?? null,
        raten: [], anzahl: 0, summeCents: 0, dringendste: r,
        bestellungen: 0, zweitAbo: false,
      };
      index.set(schluessel, karte);
      karten.push(karte);
    }
    karte.raten.push(r);
    karte.anzahl++;
    karte.summeCents += Number(r.betrag_cents || 0);
  }

  // ── DER ZYKLUS IM KLARTEXT ──────────────────────────────────────────────
  // „Abo aktiv seit 05.07. · nächste Rate 05.09. · Rechnung geht automatisch
  // raus." Derselbe Satz wie in der Akte und in der Zahlungszentrale, aus
  // derselben Funktion — wer am Telefon etwas anderes vorliest als das, was
  // im Kundenportal steht, hat ein Gespräch verloren, bevor es anfängt.
  const { ankerTag, zyklusText } = await import("./fiaon-abo-zyklus");
  const ankerJeRef = new Map<string, string | null>();
  const alleRefs = Array.from(new Set(raten.map((r) => String(r.ref))));
  if (alleRefs.length > 0) {
    for (const a of (await lauf`
      SELECT a.ref, a.abo_gestoppt_am,
             COALESCE(a.paid_at, (SELECT MIN(t.booked_at) FROM fiaon_bank_txns t
                                   WHERE t.matched_ref = a.ref AND t.applied),
                      a.completed_at) AS anker_at
      FROM fiaon_applications a WHERE a.ref = ANY(${alleRefs}::text[])
    `) as any[]) {
      ankerJeRef.set(String(a.ref), a.abo_gestoppt_am ? null : ankerTag(a.anker_at));
    }
  }

  for (const k of karten) {
    const refs = new Set(k.raten.map((r) => String(r.ref)));
    k.bestellungen = refs.size;
    const anker = ankerJeRef.get(String(k.dringendste.ref)) ?? null;
    (k as any).zyklusText = zyklusText(anker);
    (k as any).anker = anker;
    // Zwei Bestellungen mit offenen Raten heißt: Der Mensch zahlt zweimal für
    // dasselbe. Das ist keine Inkasso-Aufgabe, sondern eine Frage an den
    // Betreiber — deshalb nur eine Marke, kein automatischer Stopp.
    k.zweitAbo = refs.size > 1;
  }
  return karten;
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
      COUNT(*) FILTER (WHERE r.faellig_am < ${sqlPool.unsafe(HEUTE_BERLIN)})::int AS ueberfaellig,
      COUNT(*) FILTER (WHERE r.faellig_am = ${sqlPool.unsafe(HEUTE_BERLIN)})::int AS heute,
      COUNT(*) FILTER (WHERE r.faellig_am > ${sqlPool.unsafe(HEUTE_BERLIN)})::int AS woche,
      COUNT(*)::int AS alle
    FROM fiaon_abo_raten r
    WHERE ${lauf.unsafe(SICHTFELD)}
      AND (r.inkasso_wiedervorlage IS NULL OR r.inkasso_wiedervorlage <= ${heute}::date)
      -- Dieselbe Regel wie in der Arbeitsliste: eigene UND unzugeteilte. Ein
      -- Zähler, der eine andere Menge zählt als die Liste zeigt, ist der
      -- schlimmere Fehler — dann traut man keiner Zahl mehr.
      ${opts.nurMeine
        ? lauf`AND (r.inkasso_agent_id = ${opts.nurMeine} OR r.inkasso_agent_id IS NULL)`
        : lauf``}
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

  // ══════════════════════════════════════════════════════════════════════
  // EINGEZOGEN HEISST: WAR ÜBERFÄLLIG UND IST JETZT BEZAHLT
  //
  // ── DER BEFUND (11.08.2026) ───────────────────────────────────────────
  // Der Vorgesetzte: „Woher nimmst du ‚Diesen Monat eingezogen 4.833,28 €,
  // 74 Raten'? Wie kommst du auf das?"
  //
  // Die Abfrage zählte JEDE bezahlte Rate des Monats — ohne Sichtfeld, ohne
  // jeden Bezug zum Forderungsmanagement. Die meisten dieser 74 Raten wurden
  // pünktlich und von selbst bezahlt; das Inkasso hat sie nie gesehen.
  //
  // „Eingezogen" ist ein Leistungswort. Es darf nur zählen, was ohne
  // Nachfassen NICHT gekommen wäre: eine Rate, die überfällig WAR und danach
  // bezahlt wurde. Alles andere ist normaler Zahlungseingang und gehört in
  // die Buchhaltung, nicht in die Kennzahl einer Abteilung.
  // ══════════════════════════════════════════════════════════════════════
  const [m] = (await lauf`
    SELECT COUNT(*)::int AS anzahl, COALESCE(SUM(betrag_cents), 0)::bigint AS cents
    FROM fiaon_abo_raten
    WHERE status = 'bezahlt'
      AND bezahlt_am >= date_trunc('month', ${heute}::date)
      -- Die Rate war überfällig, als sie bezahlt wurde. Ohne diese Zeile ist
      -- es keine Einzugsleistung, sondern ein Zahlungseingang.
      AND bezahlt_am::date > faellig_am
  `) as any[];

  // Der Zahlungseingang OHNE Nachfassen — getrennt ausgewiesen. Beide Zahlen
  // nebeneinander sind ehrlich; eine allein führt in die Irre.
  const [puenktlich] = (await lauf`
    SELECT COUNT(*)::int AS anzahl, COALESCE(SUM(betrag_cents), 0)::bigint AS cents
    FROM fiaon_abo_raten
    WHERE status = 'bezahlt'
      AND bezahlt_am >= date_trunc('month', ${heute}::date)
      AND bezahlt_am::date <= faellig_am
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
    puenktlich_monat_anzahl: Number(puenktlich.anzahl),
    puenktlich_monat_cents: Number(puenktlich.cents),
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
// ── DIE ALTE REGEL, UND WARUM SIE ERSETZT WURDE (30.08.2026) ───────────────
// Hier stand bis zum 30.08.2026:
//
//   „Im Vertrieb gehört ein KUNDE dauerhaft einem Menschen. Beim Inkasso ist
//    das falsch: Zugeteilt wird eine RATE, nicht ein Kunde. Ein Kunde hat
//    zwölf Raten, und wenn Rate 3 überfällig ist und Rate 7 später auch, muss
//    nicht derselbe Mensch dran sein — er ist vielleicht im Urlaub oder nicht
//    mehr da."
//
// Der Gedanke war die Vertretung, und die ist richtig. Die Folge war es nicht:
// Weil JEDE Rate einzeln an den mit der kleinsten Last ging, landete ein Kunde
// mit mehreren offenen Raten bei ZWEI Menschen. Das Team hat es gemeldet
// („bei Hans UND Diana"), und die Messung hat es bestätigt — GEMESSEN am
// 30.08.2026: 7 Personen mit offenen Raten bei zwei Zuständigen, jedes Mal im
// Muster „Hans-Jürgen 1 Rate, Diana der Rest".
//
// Für den Kunden heißt das zwei Mahnanrufe von zwei Fremden, die nichts
// voneinander wissen. Für das Haus heißt es doppelte Arbeit an einer Forderung.
//
// ── DIE NEUE REGEL: EIN MENSCH, EIN ZUSTÄNDIGER ────────────────────────────
//   1. Hat die PERSON schon einen Inkasso-Zuständigen (irgendeine ihrer Raten),
//      folgen alle weiteren Raten diesem Menschen.
//   2. Erst wenn die Person niemanden hat, greift die kleinste Last.
//   3. Innerhalb eines Laufs zählt die Person als EINE Einheit — nicht als
//      so viele Einheiten, wie sie Raten hat.
//
// Die Vertretung bleibt möglich: `inkassoRateZuweisen` und die Zuteilung von
// Hand sind unberührt. Sie ist eine ENTSCHEIDUNG eines Menschen, nicht das
// Ergebnis eines Rundlaufs.
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
               AND w.created_at >= ${lauf.unsafe(HEUTE_BERLIN)}::timestamp AT TIME ZONE 'Europe/Berlin') AS heute
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
               anAgentId: number; anAgentName: string;
               /** „person" = folgt dem bestehenden Zuständigen, „last" = neu über die kleinste Last. */
               grund: "person" | "last" }[];
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
    SELECT r.id, r.ref, r.faellig_am, r.betrag_cents, a.person_id,
           TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')) AS kunde,
           -- Der schon zuständige Mensch DIESER PERSON: irgendeine ihrer noch
           -- nicht bezahlten Raten, die bereits jemandem gehört. Steht hier ein
           -- Wert, ist die Zuteilung entschieden — die kleinste Last kommt gar
           -- nicht mehr zum Zug.
           (SELECT r2.inkasso_agent_id
              FROM fiaon_abo_raten r2
              JOIN fiaon_applications a2 ON a2.ref = r2.ref
             WHERE a2.person_id = a.person_id
               AND r2.inkasso_agent_id IS NOT NULL
               AND r2.status <> 'bezahlt'
             ORDER BY r2.faellig_am ASC, r2.id ASC
             LIMIT 1) AS person_agent_id
    FROM fiaon_abo_raten r
    LEFT JOIN fiaon_applications a ON a.ref = r.ref
    LEFT JOIN fiaon_persons p ON p.id = a.person_id
    WHERE ${lauf.unsafe(SICHTFELD)}
      AND r.status <> 'bezahlt'
      AND r.faellig_am < ${lauf.unsafe(HEUTE_BERLIN)}
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

  // ── EIN MENSCH, EIN ZUSTÄNDIGER ─────────────────────────────────────────
  // `jePerson` merkt sich die Entscheidung für die Dauer des Laufs. Ohne diese
  // Karte würde die zweite Rate derselben Person erneut in den Rundlauf gehen
  // und bei einem anderen landen — genau der gemeldete Fehler, nur innerhalb
  // eines Laufs statt über zwei Läufe hinweg.
  const jePerson = new Map<number, { id: number; name: string }>();
  const nameVon = new Map(mannschaft.map((m) => [m.id, m.name]));

  // Bestehende Zuständigkeiten ZUERST eintragen: Sie sind die stärkste Regel
  // und dürfen nicht davon abhängen, in welcher Reihenfolge die Raten kommen.
  for (const r of offen) {
    const pid = r.person_id != null ? Number(r.person_id) : null;
    const schon = r.person_agent_id != null ? Number(r.person_agent_id) : null;
    if (pid == null || schon == null || jePerson.has(pid)) continue;
    // Nur wenn dieser Mensch noch in der Mannschaft ist. Ist er ausgeschieden,
    // wird die Person neu zugeteilt — eine Forderung darf nicht an einem Konto
    // hängen, das niemand mehr öffnet.
    const name = nameVon.get(schon);
    if (name) jePerson.set(pid, { id: schon, name });
  }

  const vorschlag = offen.map((r) => {
    const pid = r.person_id != null ? Number(r.person_id) : null;
    const schonZugeteilt = pid != null ? jePerson.get(pid) : undefined;

    let naechster: { id: number; name: string };
    let grund: "person" | "last";
    if (schonZugeteilt && (!opts.nurAgentId || schonZugeteilt.id === opts.nurAgentId)) {
      naechster = schonZugeteilt;
      grund = "person";
    } else {
      naechster = [...ziel].sort((a, b) =>
        (last.get(a.id) ?? 0) - (last.get(b.id) ?? 0) || a.id - b.id)[0];
      grund = "last";
      // Die Last wächst nur bei einer NEUEN Person. Folgt eine Rate dem
      // bestehenden Zuständigen, ist das keine zusätzliche Zuteilung — sonst
      // würde ein Kunde mit zwölf Raten die Mannschaft zwölffach belasten und
      // die Verteilung der übrigen Kunden verzerren.
      last.set(naechster.id, (last.get(naechster.id) ?? 0) + 1);
      if (pid != null) jePerson.set(pid, naechster);
    }

    return {
      rateId: Number(r.id), ref: String(r.ref),
      kunde: String(r.kunde ?? "").trim() || "Ohne Namen",
      faelligAm: new Date(r.faellig_am).toISOString().slice(0, 10),
      betragCents: Number(r.betrag_cents ?? 0),
      anAgentId: naechster.id, anAgentName: naechster.name,
      grund,
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
