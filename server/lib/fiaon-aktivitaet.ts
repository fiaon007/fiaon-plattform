// ═══════════════════════════════════════════════════════════════════════════
// AKTIVITÄT — was die Leitung tut, besonders die Löschungen
//
// Der Vorgesetzte: „Der Vorgesetzte muss sehen, was die Leitung tut —
// besonders Löschungen."
//
// ── WARUM DAS KEINE NEUE TABELLE BRAUCHT ───────────────────────────────────
// `fiaon_agent_events` sammelt seit Monaten alles: Rollenwechsel,
// Zuweisungen, Zusammenführungen, Zusagen, Vergütungsänderungen. 8.900
// Zeilen. Eine zweite Tabelle daneben wäre der klassische Fehler — zwei
// Wahrheiten über dasselbe, und beim nächsten Bericht weiß niemand, welche
// gilt.
//
// Was fehlt, ist nicht die Erfassung, sondern die SICHT: Aus 8.900 Zeilen,
// von denen 7.100 automatische Massenläufe sind, muss der Vorgesetzte die
// zwanzig herausbekommen, bei denen ein Mensch etwas Schwerwiegendes getan
// hat.
//
// ── DER KATALOG IST DIE EIGENTLICHE ARBEIT ─────────────────────────────────
// Welche Aktion ist sensibel? Nicht „alles, was ein Mensch tut" — dann wäre
// die Liste wieder 8.900 Zeilen lang. Sensibel ist, was
//   · unumkehrbar ist (Löschung, Archivierung),
//   · Geld bewegt (Zahlung buchen, Vergütung ändern),
//   · Zugang verschafft (Passwort, Freischaltung, Portal-Ansicht),
//   · oder Verantwortung verschiebt (Umhängen, Rollenwechsel).
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";
import { monatsfenster, tagfenster } from "./fiaon-tagfenster";

type Lauf = typeof sqlPool;

export type Schwere = "hoch" | "mittel" | "notiz";

interface Eintrag {
  /** Der Ereignistyp in der Datenbank. */
  typ: string;
  /** Was ein Mensch darunter versteht. */
  titel: string;
  schwere: Schwere;
  /** Zählt als Löschung für den Zähler auf der Karte? */
  loeschung?: boolean;
}

/**
 * Der Katalog sensibler Aktionen.
 *
 * Bewusst eine LISTE und keine Regel („alles mit 'delete' im Namen"): Eine
 * Regel übersieht `gdpr_delete`, `antrag_archiviert` und `person_merge`, und
 * sie fängt `leads_verteilen_08082026` mit ein, weil dort etwas mit Daten
 * passierte. Der Katalog ist von Hand gepflegt, dafür stimmt er.
 */
export const KATALOG: Eintrag[] = [
  // ── DIE NAMEN SIND NACHGESEHEN, NICHT ERFUNDEN ──────────────────────────
  // Die erste Fassung dieses Katalogs enthielt `kunde_geloescht`,
  // `zahlung_gebucht`, `zugang_gerettet`, `einmal_passwort`. Keiner dieser
  // Typen existiert. Die Wirklichkeit heißt `geloescht_endgueltig`,
  // `vertrieb_zahlung_gebucht`, `zugang_setzlink`, `zugang_einmalpasswort` —
  // abgefragt mit `SELECT DISTINCT type FROM fiaon_agent_events`.
  //
  // Ein Katalog aus erfundenen Namen hätte eine leere Liste ergeben, und die
  // leere Liste hätte ausgesehen wie „es ist nichts passiert". Das ist die
  // schlimmste Art Fehler in einer Aufsichtsfunktion.

  // ── Unumkehrbar ─────────────────────────────────────────────────────────
  { typ: "geloescht_endgueltig", titel: "Endgültig gelöscht", schwere: "hoch", loeschung: true },
  { typ: "antrag_archiviert", titel: "Antrag archiviert", schwere: "mittel", loeschung: true },
  { typ: "person_merge", titel: "Kunden zusammengeführt", schwere: "mittel", loeschung: true },
  { typ: "dubletten_verworfen", titel: "Dubletten verworfen", schwere: "notiz" },
  { typ: "vertrieb_zusage_geloescht", titel: "Zusage gelöscht", schwere: "hoch", loeschung: true },
  { typ: "vertrieb_zusage_widerrufen", titel: "Zusage entwertet", schwere: "hoch" },
  { typ: "kunde_als_test_markiert", titel: "Als Testkunde markiert", schwere: "mittel" },

  // ── Geld ────────────────────────────────────────────────────────────────
  { typ: "vertrieb_zahlung_gebucht", titel: "Zahlung als bezahlt gebucht", schwere: "hoch" },
  { typ: "payout_paid", titel: "Auszahlung als bezahlt markiert", schwere: "hoch" },
  { typ: "commission_cancelled", titel: "Provision storniert", schwere: "hoch" },
  { typ: "commission_manual", titel: "Provision von Hand angelegt", schwere: "mittel" },
  { typ: "commission_statement_issued", titel: "Abrechnung erstellt", schwere: "notiz" },
  { typ: "desired_salary_set", titel: "Wunschgehalt gesetzt", schwere: "notiz" },
  { typ: "bank_changed", titel: "Bankdaten geändert", schwere: "hoch" },
  { typ: "bank_viewed_by_admin", titel: "Bankdaten eingesehen", schwere: "mittel" },
  { typ: "commission_created", titel: "Provision angelegt", schwere: "notiz" },
  { typ: "override_created", titel: "Leitungsprovision angelegt", schwere: "notiz" },
  { typ: "payout_requested", titel: "Auszahlung angefordert", schwere: "notiz" },

  // ── Zugang ──────────────────────────────────────────────────────────────
  { typ: "zugang_setzlink", titel: "Zugang gerettet (Setz-Link)", schwere: "hoch" },
  { typ: "zugang_einmalpasswort", titel: "Einmal-Passwort erzeugt", schwere: "hoch" },
  { typ: "zugang_freigeschaltet", titel: "Zugang freigeschaltet", schwere: "hoch" },
  { typ: "force_reset", titel: "Passwort-Zurücksetzung erzwungen", schwere: "hoch" },
  { typ: "konto_reaktiviert", titel: "Konto reaktiviert", schwere: "mittel" },
  { typ: "vertrieb_sperre", titel: "Kunde gesperrt", schwere: "mittel" },
  { typ: "ansicht_gestartet", titel: "Portal als Mitarbeiter angesehen", schwere: "hoch" },
  { typ: "ansicht_beendet", titel: "Portal-Ansicht beendet", schwere: "notiz" },
  { typ: "password_reset_requested", titel: "Passwort-Zurücksetzung angefordert", schwere: "notiz" },
  { typ: "password_set", titel: "Passwort gesetzt", schwere: "notiz" },
  { typ: "password_changed", titel: "Passwort geändert", schwere: "notiz" },

  // ── Verantwortung ───────────────────────────────────────────────────────
  { typ: "rolle_geaendert", titel: "Rolle geändert", schwere: "hoch" },
  { typ: "verguetung_geaendert", titel: "Vergütung geändert", schwere: "hoch" },
  { typ: "invited", titel: "Person eingeladen", schwere: "mittel" },
  { typ: "person_owner_changed", titel: "Kunde umgehängt", schwere: "notiz" },
  { typ: "vertrieb_zuweisung", titel: "Kunden zugewiesen", schwere: "notiz" },
  { typ: "person_betreuer_entschieden", titel: "Betreuung entschieden", schwere: "notiz" },
  { typ: "uebergabe_blockiert", titel: "Übergabe blockiert", schwere: "mittel" },
  { typ: "vertrieb_stammdaten", titel: "Stammdaten geändert", schwere: "mittel" },
  { typ: "vertrieb_zahlungsdaten", titel: "Zahlungsdaten verschickt", schwere: "notiz" },

  // ── Nachweise ───────────────────────────────────────────────────────────
  { typ: "vertrieb_zusage_angenommen", titel: "Verpflichtungserklärung angenommen", schwere: "mittel" },
  { typ: "contract_signed", titel: "Vertrag unterschrieben", schwere: "mittel" },
  { typ: "contract_variables_updated", titel: "Vertragsdaten geändert", schwere: "notiz" },
  { typ: "consent_accepted", titel: "Einwilligung erteilt", schwere: "notiz" },
];

const NACH_TYP = new Map(KATALOG.map((k) => [k.typ, k]));

/** Nur die Typen, die überhaupt in der Ansicht auftauchen. */
export const SENSIBLE_TYPEN = KATALOG.map((k) => k.typ);

/** Die Typen, die als Löschung zählen. */
export const LOESCH_TYPEN = KATALOG.filter((k) => k.loeschung).map((k) => k.typ);

export interface AktivitaetZeile {
  id: number;
  typ: string;
  titel: string;
  schwere: Schwere;
  /** Wer hat es getan? */
  wer: string;
  /** Wen betrifft es? */
  wen: string | null;
  /** Die Referenz zum Nachschlagen — Kundennummer, Bestellreferenz. */
  referenz: string | null;
  grund: string | null;
  am: string;
}

/**
 * Die Liste.
 *
 * ── WARUM DIE MASSENLÄUFE HERAUSFALLEN ─────────────────────────────────────
 * `leads_verteilen_08082026` steht 2.566 Mal in der Tabelle — ein einmaliger
 * Lauf, der Leads verteilt hat. Diese Zeilen sind für die Nachvollziehbarkeit
 * dieses Laufs wichtig und für die Frage „was hat die Leitung heute getan"
 * völlig wertlos. Sie fallen über den Katalog heraus, nicht über eine
 * Höchstzahl: Eine Grenze würde bei echter Aktivität ebenfalls abschneiden.
 */
export async function aktivitaet(opts: {
  agentId?: number | null;
  typ?: string | null;
  von?: string | null;
  bis?: string | null;
  nurSchwere?: Schwere | null;
  limit?: number;
} = {}, lauf: Lauf = sqlPool): Promise<AktivitaetZeile[]> {
  const typen = opts.typ && NACH_TYP.has(opts.typ)
    ? [opts.typ]
    : opts.nurSchwere
      ? KATALOG.filter((k) => k.schwere === opts.nurSchwere).map((k) => k.typ)
      : SENSIBLE_TYPEN;

  const zeilen = (await lauf`
    SELECT e.id, e.type, e.meta, e.reason, e.actor, e.created_at,
           e.agent_id, e.from_agent_id, e.to_agent_id,
           a.name AS agent_name, f.name AS von_name, t.name AS zu_name
    FROM fiaon_agent_events e
    LEFT JOIN fiaon_agents a ON a.id = e.agent_id
    LEFT JOIN fiaon_agents f ON f.id = e.from_agent_id
    LEFT JOIN fiaon_agents t ON t.id = e.to_agent_id
    WHERE e.type = ANY(${typen})
      AND (${opts.agentId ?? null}::int IS NULL
           OR e.agent_id = ${opts.agentId ?? null}::int
           OR e.from_agent_id = ${opts.agentId ?? null}::int
           OR e.to_agent_id = ${opts.agentId ?? null}::int)
      AND (${opts.von ?? null}::text IS NULL
           OR e.created_at >= (${opts.von ?? null}::date)::timestamp AT TIME ZONE 'Europe/Berlin')
      AND (${opts.bis ?? null}::text IS NULL
           OR e.created_at < ((${opts.bis ?? null}::date + 1))::timestamp AT TIME ZONE 'Europe/Berlin')
    ORDER BY e.created_at DESC
    LIMIT ${Math.min(400, Math.max(10, opts.limit ?? 120))}
  `) as any[];

  return zeilen.map((r) => {
    const k = NACH_TYP.get(String(r.type));
    let meta: any = {};
    try { meta = typeof r.meta === "string" ? JSON.parse(r.meta) : (r.meta ?? {}); } catch { /* egal */ }
    return {
      id: Number(r.id),
      typ: String(r.type),
      titel: k?.titel ?? String(r.type),
      schwere: k?.schwere ?? "notiz",
      // `actor` ist der Handelnde, wenn er gesetzt ist. Sonst der Agent, an
      // dem das Ereignis hängt — bei einem Rollenwechsel ist das der
      // Betroffene, nicht der Handelnde, deshalb steht „System" davor.
      wer: String(r.actor || r.von_name || "System"),
      wen: r.agent_name ? String(r.agent_name) : (r.zu_name ? String(r.zu_name) : null),
      referenz: String(meta.ref ?? meta.referenz ?? meta.personId ?? meta.person_id ?? "") || null,
      grund: String(r.reason ?? meta.grund ?? meta.reason ?? "") || null,
      am: new Date(r.created_at).toISOString(),
    };
  });
}

/**
 * Die Zahlen für die Karte.
 *
 * Der Lösch-Zähler zählt die WOCHE, nicht den Tag: „0 Löschungen heute" sagt
 * nichts, weil an den meisten Tagen nichts gelöscht wird. Eine Woche ist der
 * Zeitraum, in dem ein Muster erkennbar wird.
 */
export async function aktivitaetZahlen(lauf: Lauf = sqlPool): Promise<{
  loeschungenWoche: number;
  hochWoche: number;
  heute: number;
  letzteLoeschung: { titel: string; wer: string; am: string } | null;
}> {
  const tag = tagfenster();
  const wocheVon = new Date(tag.von.getTime() - 6 * 24 * 60 * 60 * 1000);

  const [z] = (await lauf`
    SELECT
      COUNT(*) FILTER (WHERE type = ANY(${LOESCH_TYPEN}) AND created_at >= ${wocheVon})::int AS loeschungen,
      COUNT(*) FILTER (WHERE type = ANY(${KATALOG.filter((k) => k.schwere === "hoch").map((k) => k.typ)})
                       AND created_at >= ${wocheVon})::int AS hoch,
      COUNT(*) FILTER (WHERE type = ANY(${SENSIBLE_TYPEN}) AND created_at >= ${tag.von})::int AS heute
    FROM fiaon_agent_events
  `) as any[];

  const [letzte] = (await lauf`
    SELECT e.type, e.actor, e.created_at, f.name AS von_name
    FROM fiaon_agent_events e
    LEFT JOIN fiaon_agents f ON f.id = e.from_agent_id
    WHERE e.type = ANY(${LOESCH_TYPEN})
    ORDER BY e.created_at DESC LIMIT 1
  `) as any[];

  return {
    loeschungenWoche: Number(z.loeschungen),
    hochWoche: Number(z.hoch),
    heute: Number(z.heute),
    letzteLoeschung: letzte
      ? {
        titel: NACH_TYP.get(String(letzte.type))?.titel ?? String(letzte.type),
        wer: String(letzte.actor || letzte.von_name || "System"),
        am: new Date(letzte.created_at).toISOString(),
      }
      : null,
  };
}

/**
 * Ein Ereignis schreiben — der EINE Weg.
 *
 * ── WARUM ES DIESE FUNKTION BRAUCHT ────────────────────────────────────────
 * Es gibt 21 Stellen im Haus, die von Hand in `fiaon_agent_events` schreiben.
 * Jede mit eigener Spaltenwahl: manche setzen `actor`, manche `from_agent_id`,
 * manche schreiben den Grund in `reason`, manche in `meta.grund`. Beim Bau
 * der Ansicht musste ich alle vier Varianten lesen können.
 *
 * Neue Stellen nehmen diese Funktion. Die alten bleiben — sie umzuschreiben
 * hieße, 21 funktionierende Aufrufe für Ordnung anzufassen.
 */
export async function aktivitaetSchreiben(opts: {
  typ: string;
  /** Wer handelt. */
  wer: string;
  /** Der betroffene Mitarbeiter, falls es einen gibt. */
  agentId?: number | null;
  /** Referenz auf Kunde, Bestellung, Zahlung. */
  referenz?: string | null;
  grund?: string | null;
  meta?: Record<string, unknown>;
}, lauf: Lauf = sqlPool): Promise<void> {
  if (!SENSIBLE_TYPEN.includes(opts.typ)) {
    // Kein Abbruch: Ein unbekannter Typ soll geschrieben werden, damit nichts
    // verloren geht. Aber er taucht in der Ansicht nicht auf, und das soll
    // im Protokoll stehen — sonst sucht jemand stundenlang.
    console.warn(`[AKTIVITÄT] Typ „${opts.typ}" steht nicht im Katalog und erscheint nicht in der Ansicht.`);
  }
  await lauf`
    INSERT INTO fiaon_agent_events (agent_id, type, meta, actor, reason)
    VALUES (${opts.agentId ?? null}, ${opts.typ},
            ${JSON.stringify({ ...(opts.meta ?? {}), ref: opts.referenz ?? null })},
            ${opts.wer}, ${opts.grund ?? null})
  `.catch((e) => {
    // Ein fehlgeschlagenes Protokoll darf die Aktion nicht verhindern — aber
    // es muss auffallen.
    console.error(`[AKTIVITÄT] Eintrag „${opts.typ}" nicht geschrieben:`, e);
  });
}

/** Die Monatszahl für die Team-Zentrale. */
export async function aktivitaetMonat(lauf: Lauf = sqlPool): Promise<number> {
  const m = monatsfenster();
  const [r] = (await lauf`
    SELECT COUNT(*)::int AS n FROM fiaon_agent_events
    WHERE type = ANY(${SENSIBLE_TYPEN}) AND created_at >= ${m.von}
  `) as any[];
  return Number(r.n);
}
