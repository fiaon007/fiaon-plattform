// ═══════════════════════════════════════════════════════════════════════════
// LOHNT SICH DIESER MENSCH?
//
// Der Vorgesetzte: „ich muss jeden Tag auf 1 Blick sehen — lohnt sich der
// Mitarbeiter? Sind die täglichen Kosten gedeckt? Ab wann macht er Gewinn?"
//
// ── DIE FORMEL, IN WORTEN ──────────────────────────────────────────────────
// KOSTEN eines Tages =
//     Festgehalt ÷ Arbeitstage im Monat        (falls eines vereinbart ist)
//   + bestätigte Stunden dieses Tages × Stundensatz
//   + Provisionen, die an diesem Tag gutgeschrieben wurden
//
// BEITRAG eines Tages =
//     Summe der Auftragswerte (base_amount_cents) der Abschlüsse dieses Tages
//   bzw. bei Forderungsmanagement: Summe der an diesem Tag eingezogenen Raten
//
// GEDECKT AB ist der Zeitpunkt, zu dem der aufgelaufene Beitrag die Kosten
// des Tages zum ersten Mal überschreitet.
//
// ── WORAUF ES ANKOMMT: KEINE ZWEITE UMSATZZÄHLUNG ──────────────────────────
// Der Beitrag kommt aus `fiaon_commissions.base_amount_cents` — genau der
// Spalte, aus der auch die Rangliste und die Monatszahlen rechnen. Eine
// eigene Zählung hier wäre eine zweite Wahrheit, und zwei Zahlen auf
// derselben Seite, die sich um drei Euro unterscheiden, kosten mehr
// Vertrauen als die ganze Ansicht wert ist.
//
// ── WAS DIESE ZAHL NICHT IST ───────────────────────────────────────────────
// Sie ist kein Deckungsbeitrag im buchhalterischen Sinn. Sie enthält keine
// Arbeitsplatzkosten, keine Abgaben, keine Werbekosten. Sie beantwortet EINE
// Frage: Hat dieser Mensch heute mehr hereingeholt, als er heute gekostet
// hat. Die Oberfläche sagt das ausdrücklich dazu.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";
import { berlinToday } from "./fiaon-time";

type Lauf = typeof sqlPool;

/** Wie viele Arbeitstage hat ein Monat? Einstellbar, Vorgabe 21. */
export async function arbeitstage(lauf: Lauf = sqlPool): Promise<number> {
  const [r] = (await lauf`
    SELECT value FROM fiaon_kalender_einstellung WHERE key = 'arbeitstage_pro_monat'
  `.catch(() => [] as any[])) as any[];
  const n = Number(r?.value);
  return Number.isFinite(n) && n >= 15 && n <= 31 ? n : 21;
}

export interface Wirtschaftlichkeit {
  agentId: number;
  /** Kosten heute in Cent, aufgeschlüsselt. */
  kosten: { gehaltAnteil: number; stunden: number; provisionen: number; gesamt: number };
  /** Beitrag heute in Cent. */
  beitrag: number;
  /** Deckungsgrad in Prozent, auf ganze Zahlen. */
  deckung: number;
  /** Wann die Kosten erstmals gedeckt waren — Berliner Uhrzeit, oder null. */
  gedecktAb: string | null;
  /** Der Monat bis heute. */
  monat: { kosten: number; beitrag: number; deckung: number; breakEvenTag: string | null };
  /** 30 Tage für die Verlaufslinie: je Tag Kosten und Beitrag. */
  verlauf: { tag: string; kosten: number; beitrag: number }[];
  /** Klartext für die Kachel. */
  satz: string;
}

/**
 * Die Rechnung für einen Menschen.
 *
 * NUR für den Vorgesetzten aufrufen. Die Funktion prüft das nicht selbst — die
 * Rechteprüfung sitzt in der Route, weil nur dort bekannt ist, wer fragt.
 */
export async function wirtschaftlichkeit(
  agentId: number, datum = berlinToday(), lauf: Lauf = sqlPool,
): Promise<Wirtschaftlichkeit> {
  const tage = await arbeitstage(lauf);

  const [a] = (await lauf`
    SELECT id, festgehalt_cents, gehalt_ab, rolle,
           COALESCE(stundensatz_cents, 0) AS stundensatz
    FROM fiaon_agents WHERE id = ${agentId}
  `.catch(async () => (await lauf`
    SELECT id, festgehalt_cents, gehalt_ab, rolle, 0 AS stundensatz
    FROM fiaon_agents WHERE id = ${agentId}
  `) as any[])) as any[];

  const gehalt = Number(a?.festgehalt_cents || 0);
  // Gilt das Gehalt an diesem Tag schon? Wer am 20. anfängt, kostet vorher
  // nichts — sonst zeigte jeder Tag davor einen erfundenen Verlust.
  const gehaltAktiv = gehalt > 0
    && (!a?.gehalt_ab || new Date(String(a.gehalt_ab)) <= new Date(`${datum}T23:59:59Z`));
  const gehaltAnteil = gehaltAktiv ? Math.round(gehalt / tage) : 0;

  // ── Kosten des Tages ────────────────────────────────────────────────────
  const [heute] = (await lauf`
    SELECT
      COALESCE((
        SELECT SUM(c.amount_cents) FROM fiaon_commissions c
        WHERE c.agent_id = ${agentId} AND c.status <> 'storniert'
          AND c.created_at >= date_trunc('day', ${datum}::date)
          AND c.created_at <  date_trunc('day', ${datum}::date) + INTERVAL '1 day'
      ), 0)::bigint AS provisionen,
      COALESCE((
        SELECT SUM(c.base_amount_cents) FROM fiaon_commissions c
        WHERE c.agent_id = ${agentId} AND c.status <> 'storniert'
          AND COALESCE(c.kind, '') <> 'stunden'
          AND c.created_at >= date_trunc('day', ${datum}::date)
          AND c.created_at <  date_trunc('day', ${datum}::date) + INTERVAL '1 day'
      ), 0)::bigint AS beitrag
  `) as any[];

  // ── BESTÄTIGTE STUNDEN DIESES TAGES ─────────────────────────────────────
  // Die Tabelle speichert MINUTEN, keinen Betrag — der Satz steht am
  // Menschen. Die erste Fassung dieser Funktion fragte nach `betrag_cents`;
  // die Spalte gibt es nicht, und in einer Transaktion riss der Fehler den
  // ganzen Lauf mit (ein gescheiterter Befehl vergiftet die Transaktion, das
  // nachgestellte .catch() kommt zu spät).
  //
  // „Bestätigt" heißt: `bestaetigt_am` gesetzt und nicht entfernt. Nicht
  // bestätigte Stunden sind eine Behauptung, keine Kosten.
  const [st] = (await lauf`
    SELECT COALESCE(SUM(minuten), 0)::bigint AS minuten
    FROM fiaon_stunden
    WHERE agent_id = ${agentId} AND tag = ${datum}::date
      AND bestaetigt_am IS NOT NULL AND entfernt_am IS NULL
  `) as any[];
  const satzCents = Number(a?.stundensatz || 0);

  const stundenKosten = Math.round((Number(st?.minuten || 0) / 60) * satzCents);
  const provisionen = Number(heute.provisionen);
  const beitrag = Number(heute.beitrag);
  const gesamtKosten = gehaltAnteil + stundenKosten + provisionen;

  // ── Wann war es gedeckt? ────────────────────────────────────────────────
  // Die Abschlüsse des Tages der Reihe nach aufsummieren; der erste, der die
  // Kostenlinie überschreitet, nennt die Uhrzeit.
  let gedecktAb: string | null = null;
  if (gesamtKosten > 0) {
    const schritte = (await lauf`
      SELECT created_at, base_amount_cents FROM fiaon_commissions
      WHERE agent_id = ${agentId} AND status <> 'storniert' AND COALESCE(kind, '') <> 'stunden'
        AND created_at >= date_trunc('day', ${datum}::date)
        AND created_at <  date_trunc('day', ${datum}::date) + INTERVAL '1 day'
      ORDER BY created_at
    `) as any[];
    let summe = 0;
    for (const s of schritte) {
      summe += Number(s.base_amount_cents);
      if (summe >= gesamtKosten) {
        gedecktAb = new Intl.DateTimeFormat("de-DE", {
          timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit",
        }).format(new Date(s.created_at));
        break;
      }
    }
  }

  // ── Der Monat bis heute ─────────────────────────────────────────────────
  const [m] = (await lauf`
    SELECT
      COALESCE(SUM(base_amount_cents) FILTER (WHERE COALESCE(kind,'') <> 'stunden'), 0)::bigint AS beitrag,
      COALESCE(SUM(amount_cents), 0)::bigint AS provisionen,
      COUNT(DISTINCT date_trunc('day', created_at))::int AS tage_mit_abschluss
    FROM fiaon_commissions
    WHERE agent_id = ${agentId} AND status <> 'storniert'
      AND created_at >= date_trunc('month', ${datum}::date)
      AND created_at < date_trunc('day', ${datum}::date) + INTERVAL '1 day'
  `) as any[];

  const tagImMonat = Number(datum.slice(8, 10));
  // Bisher verstrichene Arbeitstage, anteilig: Der 15. eines Monats mit 21
  // Arbeitstagen entspricht etwa 10 davon.
  const verstrichen = Math.max(1, Math.round((tagImMonat / 30) * tage));
  const monatKosten = (gehaltAktiv ? gehaltAnteil * verstrichen : 0) + Number(m.provisionen);
  const monatBeitrag = Number(m.beitrag);

  // Break-even: an welchem Tag hat der aufgelaufene Beitrag die aufgelaufenen
  // Kosten erstmals überholt?
  let breakEvenTag: string | null = null;
  if (monatKosten > 0) {
    const proTag = (await lauf`
      SELECT to_char(created_at AT TIME ZONE 'Europe/Berlin', 'YYYY-MM-DD') AS tag,
             SUM(base_amount_cents) FILTER (WHERE COALESCE(kind,'') <> 'stunden') AS beitrag
      FROM fiaon_commissions
      WHERE agent_id = ${agentId} AND status <> 'storniert'
        AND created_at >= date_trunc('month', ${datum}::date)
      GROUP BY tag ORDER BY tag
    `) as any[];
    let auf = 0;
    let i = 0;
    for (const t of proTag) {
      i++;
      auf += Number(t.beitrag || 0);
      if (auf >= gehaltAnteil * i + Number(m.provisionen)) { breakEvenTag = String(t.tag); break; }
    }
  }

  // ── Die Linie über 30 Tage ──────────────────────────────────────────────
  const verlaufRoh = (await lauf`
    SELECT to_char(d::date, 'YYYY-MM-DD') AS tag,
           COALESCE((
             SELECT SUM(c.base_amount_cents) FROM fiaon_commissions c
             WHERE c.agent_id = ${agentId} AND c.status <> 'storniert'
               AND COALESCE(c.kind,'') <> 'stunden'
               AND c.created_at >= d::date AND c.created_at < d::date + INTERVAL '1 day'
           ), 0)::bigint AS beitrag
    FROM generate_series(${datum}::date - INTERVAL '29 days', ${datum}::date, INTERVAL '1 day') d
  `) as any[];

  const deckung = gesamtKosten > 0
    ? Math.round((beitrag / gesamtKosten) * 100)
    : (beitrag > 0 ? 100 : 0);

  // ── Der Satz, den der Vorgesetzte im Vorbeigehen liest ────────────────────
  let satz: string;
  if (gesamtKosten === 0) {
    satz = "Heute keine Kosten hinterlegt — reine Provision.";
  } else if (gedecktAb) {
    satz = `Heute gedeckt ab ${gedecktAb} Uhr.`;
  } else if (beitrag === 0) {
    satz = "Heute noch nichts hereingeholt.";
  } else {
    satz = `Heute ${deckung} % gedeckt.`;
  }

  return {
    agentId,
    kosten: { gehaltAnteil, stunden: stundenKosten, provisionen, gesamt: gesamtKosten },
    beitrag, deckung, gedecktAb,
    monat: {
      kosten: monatKosten, beitrag: monatBeitrag,
      deckung: monatKosten > 0 ? Math.round((monatBeitrag / monatKosten) * 100) : (monatBeitrag > 0 ? 100 : 0),
      breakEvenTag,
    },
    verlauf: verlaufRoh.map((v) => ({
      tag: String(v.tag),
      kosten: gehaltAktiv ? gehaltAnteil : 0,
      beitrag: Number(v.beitrag),
    })),
    satz,
  };
}

/**
 * Die Summenzeile für den Kopf der Team-Zentrale: Was kostet das Team diesen
 * Monat, was hat es hereingeholt?
 */
export async function teamWirtschaftlichkeit(
  datum = berlinToday(), lauf: Lauf = sqlPool,
): Promise<{ personalkosten: number; umsatz: number; deckung: number; mitGehalt: number; satz: string }> {
  const tage = await arbeitstage(lauf);
  const tagImMonat = Number(datum.slice(8, 10));
  const verstrichen = Math.max(1, Math.round((tagImMonat / 30) * tage));

  const [g] = (await lauf`
    SELECT COALESCE(SUM(festgehalt_cents), 0)::bigint AS gehalt,
           COUNT(*) FILTER (WHERE festgehalt_cents > 0)::int AS mit_gehalt
    FROM fiaon_agents
    WHERE active AND NOT is_test_account
      AND (gehalt_ab IS NULL OR gehalt_ab <= ${datum}::date)
  `) as any[];

  const [u] = (await lauf`
    SELECT COALESCE(SUM(c.base_amount_cents) FILTER (WHERE COALESCE(c.kind,'') <> 'stunden'), 0)::bigint AS umsatz,
           COALESCE(SUM(c.amount_cents), 0)::bigint AS provisionen
    FROM fiaon_commissions c
    JOIN fiaon_agents a ON a.id = c.agent_id AND NOT a.is_test_account
    WHERE c.status <> 'storniert' AND c.created_at >= date_trunc('month', ${datum}::date)
  `) as any[];

  const gehaltAnteil = Math.round((Number(g.gehalt) / tage) * verstrichen);
  const personalkosten = gehaltAnteil + Number(u.provisionen);
  const umsatz = Number(u.umsatz);
  const deckung = personalkosten > 0 ? Math.round((umsatz / personalkosten) * 100) : (umsatz > 0 ? 100 : 0);

  return {
    personalkosten, umsatz, deckung, mitGehalt: Number(g.mit_gehalt),
    satz: personalkosten === 0
      ? "Diesen Monat keine Festgehälter hinterlegt."
      : deckung >= 100
        ? `Personalkosten diesen Monat zu ${deckung} % gedeckt.`
        : `Personalkosten diesen Monat zu ${deckung} % gedeckt — es fehlen `
          + `${((personalkosten - umsatz) / 100).toFixed(2).replace(".", ",")} €.`,
  };
}
