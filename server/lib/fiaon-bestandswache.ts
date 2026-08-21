// ═══════════════════════════════════════════════════════════════════════════
// DIE BESTANDSWACHE — WAS UNSICHTBAR IST, WIRD GEMELDET
//
// ── WOFÜR SIE DA IST ──────────────────────────────────────────────────────
// Am 21.08.2026 lagen fünf Kunden (drei zahlend), sechs Provisionen über
// 591,60 € und drei Termine an zwei Konten, die eine falsch gesetzte
// Testkonto-Marke trugen. Nichts war gelöscht, nichts falsch zugeordnet — es
// fiel nur aus jeder Liste heraus. Seit dem 04.07.2026. Aufgefallen ist es
// beim Aufräumen nach einem Prüflauf, also durch Zufall.
//
// Ein Zustand, der 48 Tage überlebt, weil niemand hinsieht, braucht keinen
// besseren Vorsatz, sondern einen Lauf.
//
// ── WAS SIE PRÜFT ─────────────────────────────────────────────────────────
//   1. Produktive Datensätze an Prüfstands-Konten (Kunden, Termine,
//      Provisionen) — das ist der Vorfall selbst.
//   2. Offene Vormerkungen aus dem Datenbank-Trigger
//      (`fiaon_testkonto_warnungen`, Migration 072).
//   3. Bezahlte Kunden ohne Startgespräch, älter als 14 Tage — sie warten,
//      und niemand ruft an.
//   4. Kunden ganz OHNE Betreuer. Sie sind aus einem anderen Grund unsichtbar,
//      aber genauso teuer.
//
// ── SIE SPERRT NICHTS ─────────────────────────────────────────────────────
// Sie schreibt einen Protokolleintrag und schickt höchstens EINE Mail am Tag.
// Kein Zustand wird von selbst geändert: Was ein Mensch entscheiden muss
// (welcher Mitarbeiter übernimmt), entscheidet kein Lauf.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";
import { istTestkontoSql } from "./fiaon-mitarbeiter-sicht";

type Lauf = typeof sqlPool;

export interface Befund {
  /** Kurzname für Protokoll und Kachel. */
  art: string;
  /** Was ein Mensch darüber wissen muss. */
  klartext: string;
  anzahl: number;
  /** Wiegt das Geld oder nur Ordnung? Nur `schwer` löst eine Mail aus. */
  gewicht: "schwer" | "leicht";
  /** Wo man es ansieht. */
  wo: string;
}

/** Ab wann ist ein bezahlter Kunde ohne Startgespräch ein Befund? */
export const ONBOARDING_GEDULD_TAGE = 14;

/**
 * Ab wie vielen Vertretungen an einem Tag geht eine Warnung raus?
 *
 * Drei. Eine einzelne Vertretung ist Alltag (jemand ist krank, ein Kalender
 * ist gerade voll). Drei an einem Tag heißen: Die zuständige Rolle hat
 * strukturell keine Zeit — und dann ist die Vertretung auf dem Weg, der
 * Normalfall zu werden. Genau das ist am 19./20.08.2026 passiert, und es hat
 * niemand bemerkt, weil es nirgends stand.
 */
export const VERTRETUNG_WARNSCHWELLE = 3;

export async function bestandPruefen(lauf: Lauf = sqlPool): Promise<Befund[]> {
  const befunde: Befund[] = [];

  // ── 1. PRODUKTIVES AN PRÜFSTANDS-KONTEN ─────────────────────────────────
  const [an] = (await lauf.unsafe(`
    SELECT
      (SELECT COUNT(*)::int FROM fiaon_persons p JOIN fiaon_agents a ON a.id = p.assigned_agent_id
        WHERE ${istTestkontoSql("a")} AND p.merged_into_person_id IS NULL
          AND p.ist_test_am IS NULL) AS personen,
      (SELECT COUNT(*)::int FROM fiaon_persons p JOIN fiaon_agents a ON a.id = p.assigned_agent_id
        WHERE ${istTestkontoSql("a")} AND p.merged_into_person_id IS NULL
          AND p.ist_test_am IS NULL
          AND EXISTS (SELECT 1 FROM fiaon_applications ap WHERE ap.person_id = p.id
            AND ap.merged_into IS NULL AND ap.archived_at IS NULL
            AND ap.payment_status = 'paid')) AS bezahlte,
      (SELECT COUNT(*)::int FROM fiaon_termine t JOIN fiaon_agents a ON a.id = t.agent_id
        WHERE ${istTestkontoSql("a")} AND t.abgesagt_am IS NULL AND t.beginn > NOW()) AS termine,
      (SELECT COUNT(*)::int FROM fiaon_commissions c JOIN fiaon_agents a ON a.id = c.agent_id
        WHERE ${istTestkontoSql("a")}) AS provisionen
  `)) as any[];
  const summe = Number(an.personen) + Number(an.termine) + Number(an.provisionen);
  if (summe > 0) {
    befunde.push({
      art: "an_pruefstandskonto",
      klartext: `${an.personen} Kunden (${an.bezahlte} davon zahlend), ${an.termine} kommende Termine `
        + `und ${an.provisionen} Provisionen hängen an Prüfstands-Konten. `
        + "Jede Team-Ansicht filtert diese Konten heraus — die Datensätze sind unsichtbar.",
      anzahl: summe,
      // Bezahlte Kunden oder Provisionen wiegen Geld. Ein Testeintrag nicht.
      gewicht: Number(an.bezahlte) > 0 || Number(an.provisionen) > 0 ? "schwer" : "leicht",
      wo: "npx tsx scripts/pruefstands-konten-lauf.ts",
    });
  }

  // ── 2. OFFENE VORMERKUNGEN AUS DEM TRIGGER ──────────────────────────────
  // Ein Prüfstand, der sich einen Kunden leiht, erzeugt hier eine Zeile und
  // gibt ihn im `finally` zurück. Was länger als einen Tag steht, ist liegen
  // geblieben — genau der Fall, der am 21.08. zwei echte Termine erwischt hat.
  const [vor] = (await lauf`
    SELECT COUNT(*)::int AS n FROM fiaon_testkonto_warnungen
    WHERE erledigt_am IS NULL AND bemerkt_am < NOW() - INTERVAL '1 day'
  `.catch(() => [{ n: 0 }])) as any[];
  if (Number(vor?.n ?? 0) > 0) {
    befunde.push({
      art: "vormerkung_offen",
      klartext: `${vor.n} Vormerkungen aus dem Datenbank-Trigger stehen seit über einem Tag offen. `
        + "Ein Prüfstand hat einen Datensatz geliehen und nicht zurückgegeben.",
      anzahl: Number(vor.n),
      gewicht: "schwer",
      wo: "Tabelle fiaon_testkonto_warnungen",
    });
  }

  // ── 3. BEZAHLT, ABER KEIN STARTGESPRÄCH ─────────────────────────────────
  // ── `paid_at`, NICHT `updated_at` (korrigiert 21.08.2026) ───────────────
  // Der erste Entwurf nahm `MAX(ap.updated_at)` als Zahlungsdatum. Diese
  // Spalte wird von jedem Lauf angefasst — sie ist bei fast allen Zeilen von
  // heute. Ergebnis: „0 Kunden warten länger als 14 Tage", während es 204
  // waren. Ein Datum, das etwas anderes bedeutet als sein Name verspricht, ist
  // schlimmer als ein fehlendes.
  const [ob] = (await lauf.unsafe(`
    SELECT COUNT(*)::int AS n,
           COUNT(*) FILTER (WHERE tage > ${ONBOARDING_GEDULD_TAGE})::int AS alt,
           COUNT(*) FILTER (WHERE tage IS NULL)::int AS ohne_datum
    FROM (
      SELECT p.id, EXTRACT(DAY FROM NOW() - MIN(ap.paid_at))::int AS tage
      FROM fiaon_persons p
      JOIN fiaon_applications ap ON ap.person_id = p.id
       AND ap.merged_into IS NULL AND ap.archived_at IS NULL
       AND ap.payment_status = 'paid'
       AND NOT (ap.type = 'schufa' OR ap.ref LIKE 'FIAON-SCHUFA-%')
      WHERE p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL
        AND NOT COALESCE(p.is_blocked, FALSE)
        AND NOT EXISTS (SELECT 1 FROM fiaon_termine t
          WHERE t.person_id = p.id AND t.quelle = 'onboarding_call'
            AND t.status = 'erledigt')
        -- Eine ausdrückliche Ausnahme ist kein Befund (fiaon-kundenstufe.ts).
        AND NOT EXISTS (SELECT 1 FROM fiaon_applications ax
          WHERE ax.person_id = p.id AND ax.merged_into IS NULL
            AND ax.onboarding_pflicht = FALSE
            AND NULLIF(TRIM(COALESCE(ax.onboarding_ausnahme_grund, '')), '') IS NOT NULL)
      GROUP BY p.id
    ) x
  `)) as any[];
  if (Number(ob.alt) > 0) {
    befunde.push({
      art: "bezahlt_ohne_onboarding",
      klartext: `${ob.n} bezahlte Kunden haben kein geführtes Startgespräch, `
        + `${ob.alt} davon warten länger als ${ONBOARDING_GEDULD_TAGE} Tage seit der Zahlung`
        + (Number(ob.ohne_datum) > 0
          ? ` (bei ${ob.ohne_datum} fehlt das Zahlungsdatum, ihr Alter ist unbekannt)` : "")
        + ".",
      anzahl: Number(ob.alt),
      gewicht: "schwer",
      wo: "/admin/hub — Kachel „Bezahlt ohne Startgespräch“",
    });
  }

  // ── 4. GAR KEIN BETREUER ────────────────────────────────────────────────
  const [ohne] = (await lauf`
    SELECT COUNT(*)::int AS n FROM fiaon_persons p
    WHERE p.assigned_agent_id IS NULL AND p.merged_into_person_id IS NULL
      AND p.ist_test_am IS NULL AND NOT COALESCE(p.is_blocked, FALSE)
      AND EXISTS (SELECT 1 FROM fiaon_applications ap WHERE ap.person_id = p.id
        AND ap.merged_into IS NULL AND ap.archived_at IS NULL
        AND ap.payment_status = 'paid')
  `) as any[];
  if (Number(ohne.n) > 0) {
    befunde.push({
      art: "bezahlt_ohne_betreuer",
      klartext: `${ohne.n} zahlende Kunden haben GAR KEINEN Betreuer.`,
      anzahl: Number(ohne.n),
      gewicht: "schwer",
      wo: "/admin/kunden",
    });
  }

  // ── 5. VERTRETUNGEN VON HEUTE ───────────────────────────────────────────
  // Der Auftrag: „Warn-Mail an Admin ab 3 Vertretungen an einem Tag." Drei
  // an einem Tag ist kein Einzelfall mehr, sondern ein Kalender, der nicht
  // reicht — und der Betreiber soll es am selben Tag erfahren, nicht in der
  // Wochenauswertung.
  const [vert] = (await lauf`
    SELECT COUNT(*)::int AS n FROM fiaon_termine t
    WHERE t.vertretung IS TRUE AND t.abgesagt_am IS NULL
      AND (t.created_at AT TIME ZONE 'Europe/Berlin')::date
          = (NOW() AT TIME ZONE 'Europe/Berlin')::date
  `.catch(() => [{ n: 0 }])) as any[];
  if (Number(vert?.n ?? 0) >= VERTRETUNG_WARNSCHWELLE) {
    befunde.push({
      art: "vertretungen_heute",
      klartext: `${vert.n} Termine sind heute als VERTRETUNG gebucht worden. `
        + "Die zuständige Rolle hatte keine freie Zeit — Vertretung ist erlaubt, "
        + "aber drei an einem Tag heißt, dass der Kalender nicht reicht.",
      anzahl: Number(vert.n),
      gewicht: "schwer",
      wo: "/admin/hub — Karte „Was niemand sieht“, Liste „Termine in Vertretung“",
    });
  }

  return befunde;
}

/**
 * Der Tageslauf: prüfen, protokollieren, höchstens einmal am Tag warnen.
 *
 * `nichtSenden` für Prüfstände — sie sollen die Kette prüfen, nicht dem
 * Betreiber Post schicken.
 */
export async function bestandswache(
  opts: { nichtSenden?: boolean } = {},
): Promise<{ befunde: Befund[]; gewarnt: boolean; grund: string }> {
  const befunde = await bestandPruefen();
  const schwer = befunde.filter((b) => b.gewicht === "schwer");

  // Protokoll IMMER — auch der ruhige Tag ist eine Auskunft. Ohne ihn ist
  // „keine Meldung" nicht von „Lauf ausgefallen" zu unterscheiden.
  await sqlPool`
    INSERT INTO fiaon_agent_events (agent_id, type, meta, actor, reason)
    VALUES (NULL, 'bestandswache',
            ${JSON.stringify({ befunde: befunde.map((b) => ({ art: b.art, anzahl: b.anzahl })) })},
            'System',
            ${befunde.length === 0
              ? "Bestandswache: nichts Unsichtbares gefunden."
              : `Bestandswache: ${befunde.map((b) => `${b.art}=${b.anzahl}`).join(", ")}`})
  `.catch((e) => console.error("[WACHE] Protokolleintrag nicht geschrieben:", e));

  if (schwer.length === 0) {
    console.log("[WACHE] Nichts Unsichtbares gefunden.");
    return { befunde, gewarnt: false, grund: "keine schweren Befunde" };
  }
  console.warn(`[WACHE] ${schwer.length} schwere Befunde: `
    + schwer.map((b) => `${b.art}=${b.anzahl}`).join(", "));

  if (opts.nichtSenden) return { befunde, gewarnt: false, grund: "Versand unterdrückt" };

  // Höchstens eine Mail am Tag — eine Warnung, die stündlich kommt, wird zur
  // Gewohnheit und dann zum Filter.
  const [letzte] = (await sqlPool`
    SELECT created_at FROM fiaon_agent_events
    WHERE type = 'bestandswache_warnung' ORDER BY created_at DESC LIMIT 1
  `.catch(() => [])) as any[];
  if (letzte?.created_at && Date.now() - new Date(letzte.created_at).getTime() < 20 * 3_600_000) {
    return { befunde, gewarnt: false, grund: "heute schon gewarnt" };
  }

  const an = process.env.BETREIBER_MAIL || process.env.ADMIN_EMAIL || "";
  const text = [
    "Die Bestandswache hat Datensätze gefunden, die in keiner Liste auftauchen.",
    "",
    ...schwer.map((b) => `· ${b.klartext}\n  Nachsehen: ${b.wo}`),
    "",
    befunde.length > schwer.length
      ? "Außerdem (leichter): " + befunde.filter((b) => b.gewicht === "leicht")
        .map((b) => b.klartext).join(" ")
      : "",
    "",
    "Diese Mail kommt höchstens einmal am Tag.",
  ].filter(Boolean).join("\n");

  if (!an) {
    // „Konnte nicht warnen" ist etwas anderes als „musste nicht warnen".
    console.error("[WACHE] Keine Betreiber-Adresse (BETREIBER_MAIL) — Warnung nur im Protokoll.");
  } else {
    const { eigeneMailSenden } = await import("./fiaon-brevo");
    const versand = await eigeneMailSenden({
      an,
      betreff: `FIAON: ${schwer.length} unsichtbare Bestände`,
      text,
    });
    if (!versand.ok) console.error(`[WACHE] Warnmail an ${an} scheiterte: ${versand.grund}`);
  }

  await sqlPool`
    INSERT INTO fiaon_agent_events (agent_id, type, meta, actor, reason)
    VALUES (NULL, 'bestandswache_warnung',
            ${JSON.stringify({ befunde: schwer.map((b) => ({ art: b.art, anzahl: b.anzahl })) })},
            'System', ${text.slice(0, 1500)})
  `.catch((e) => console.error("[WACHE] Warnungs-Protokoll nicht geschrieben:", e));

  return { befunde, gewarnt: true, grund: "gemeldet" };
}
