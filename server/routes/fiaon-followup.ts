// ═══════════════════════════════════════════════════════════════════════════
// FIAON FOLLOW-UP-ENGINE
//
// Drei Aufgaben, die niemand von Hand erledigen kann:
//   Tageslauf     06:00 Europe/Vienna — fällige und überfällige Fälle zählen,
//                 Liegenbleiber nach 7 Tagen ohne Aktivität eskalieren.
//   Nachschub     Fällt ein Agent unter 20 offene Tier-1-Fälle, wird aus der
//                 Reserve auf 30 aufgefüllt. Tier 2 analog auf 60.
//   Auto-Assign   Eine neu entstandene oder aufgestiegene Tier-1-Person geht
//                 sofort an den Agenten mit den wenigsten offenen Tier-1.
//
// ══ WARUM EIN LOCK, OBWOHL DIE MAHN-ENGINE KEINEN HAT ═════════════════════
// Die bestehende Mahn-Engine läuft als `setInterval` im Web-Prozess. Auf einer
// Instanz ist das richtig; bei zwei Instanzen mahnt jede eigenständig, und der
// Kunde bekommt die Erinnerung doppelt. Genau dieser Fehler soll sich hier nicht
// wiederholen: Der Tageslauf holt sich vorher einen Lock-Eintrag in
// `fiaon_settings`. Bekommt er ihn nicht, läuft schon jemand — dann tut er
// nichts.
//
// Der Lock ist ein Zeitstempel in der Zukunft, kein Wahrheitswert. Stirbt eine
// Instanz mitten im Lauf, verfällt er von selbst; ein Wahrheitswert würde den
// Job dauerhaft blockieren und niemand würde es merken.
//
// ══ WARUM KEIN ECHTER CRON-DIENST ═════════════════════════════════════════
// Bewusst dasselbe Muster wie die Mahn-Engine: `setInterval` im Web-Prozess.
// Ein zusätzlicher Render-Dienst wäre eine neue Betriebskomponente, die
// separat überwacht, deployt und bezahlt werden muss. Mit Lock ist das Muster
// tragfähig — und die Umstellung auf einen echten Cron bleibt später möglich,
// weil der Lauf über eine Route auch von aussen anstossbar ist.
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { getSettings } from "./fiaon-agent";
import { versandErlaubtOderProtokoll } from "../lib/fiaon-versandkanal";
import { anrufHinweis, ABSAGE_HINWEIS } from "../../shared/fiaon-termin-text";

const router = Router();

/** Ohne dokumentierte Aktivität so lange → Eskalation. */
export const ESKALATION_TAGE = 7;
/** Stunde des Tageslaufs in Europe/Vienna. */
const LAUF_STUNDE = 6;
/** Wie lange ein Lock gilt, falls die Instanz mitten im Lauf stirbt. */
const LOCK_MINUTEN = 15;

// ───────────────────────────────────────────────────────────────────────────
// Lock
// ───────────────────────────────────────────────────────────────────────────

/**
 * Versucht, den Tageslauf zu beanspruchen. Gibt `true` nur der EINEN Instanz,
 * die zuerst da ist.
 *
 * Der Trick steckt in der `WHERE`-Bedingung des `ON CONFLICT`-Zweigs: Sie
 * greift nur, wenn der bestehende Lock abgelaufen ist. Postgres wertet das
 * atomar aus — zwei gleichzeitige Aufrufe können nicht beide gewinnen.
 */
async function holeLock(schluessel: string): Promise<boolean> {
  const bis = new Date(Date.now() + LOCK_MINUTEN * 60_000).toISOString();
  const jetzt = new Date().toISOString();
  const rows = await sqlPool`
    INSERT INTO fiaon_settings (key, value, updated_at)
    VALUES (${schluessel}, ${bis}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = ${bis}, updated_at = NOW()
    WHERE fiaon_settings.value < ${jetzt}
    RETURNING key
  `;
  return rows.length > 0;
}

async function gibLockFrei(schluessel: string): Promise<void> {
  await sqlPool`
    UPDATE fiaon_settings SET value = ${new Date(0).toISOString()}, updated_at = NOW()
    WHERE key = ${schluessel}
  `.catch(() => {});
}

// ───────────────────────────────────────────────────────────────────────────
// Auto-Assign
// ───────────────────────────────────────────────────────────────────────────

/**
 * Der Agent mit den wenigsten OFFENEN Tier-1-Fällen — aber nur, wenn er noch
 * UNTER dem Deckel liegt.
 *
 * Die Deckel-Prüfung ist nicht optional, sie ist der Sinn des Deckels. Ohne sie
 * verteilt der erste Tageslauf die gesamte Reserve auf Agenten, die schon voll
 * sind: Beim ersten Lauf am 03.08.2026 standen danach 36 bis 37 Tier-1-Fälle bei
 * jedem, die Reserve war leer, und der Nachschub hatte nichts mehr zum
 * Auffüllen. Sind alle am Deckel, bleibt die Person in der Reserve — das ist
 * die richtige Antwort, nicht eine Überlastung.
 *
 * „Offen“ heißt: nicht gesperrt. Ein gesperrter Kunde ist keine Arbeit und darf
 * die Auslastung nicht künstlich erhöhen — sonst bekommt der Agent mit den
 * meisten Absagen die meisten neuen Fälle.
 */
async function agentMitWenigstenTier1(): Promise<number | null> {
  const s = await getSettings();
  const cap1 = parseInt(s.pool_cap_tier1 ?? "30", 10);
  const [a] = await sqlPool`
    SELECT a.id
    FROM fiaon_agents a
    LEFT JOIN fiaon_persons p
      ON p.assigned_agent_id = a.id
     AND p.merged_into_person_id IS NULL
     AND p.priority_tier = 1
     AND NOT p.is_blocked
     AND p.ist_test_am IS NULL
    WHERE a.active AND a.distribution_active AND NOT a.is_test_account
    GROUP BY a.id
    HAVING count(p.id) < ${cap1}
    ORDER BY count(p.id) ASC, a.id ASC
    LIMIT 1
  `;
  return a?.id ?? null;
}

/**
 * Weist eine Tier-1-Person sofort zu und hinterlässt einen Hinweis in ihrer
 * Timeline.
 *
 * Es gibt kein Benachrichtigungssystem pro Agent — `fiaon_agent_updates` ist ein
 * Rundschreiben an alle. Statt eine neue Tabelle zu erfinden, landet der Hinweis
 * dort, wo der Agent ohnehin hinsieht: im Verlauf des Kunden. Zusätzlich zählt
 * das Dashboard solche Zugänge als „neu bei dir".
 */
export async function autoAssignTier1(personId: number): Promise<number | null> {
  const { ensureBetreuungSpalte } = await import("../lib/tier");
  await ensureBetreuungSpalte(sqlPool);
  const [p] = await sqlPool`
    SELECT id, priority_tier, assigned_agent_id, is_blocked, betreuung_seit
    FROM fiaon_persons WHERE id = ${personId} AND merged_into_person_id IS NULL
  `;
  if (!p || p.priority_tier !== 1 || p.is_blocked || p.assigned_agent_id) return null;
  // BESITZSCHUTZ: Eine betreute Person wird nie automatisch vergeben. Sie
  // gehört dem, der sie angerufen hat — auch wenn die Zuweisung fehlt (genau so
  // stand Axel Conrad ohne Agent da, nachdem eine Erstverteilung ihn Daniel
  // weggenommen hatte). Wer sie zurückholt, ist ein Mensch, nicht die Automatik.
  if (p.betreuung_seit) {
    console.log(`[FIAON-FOLLOWUP] Auto-Assign übersprungen: Person ${personId} ist seit ${p.betreuung_seit} betreut`);
    return null;
  }

  const agentId = await agentMitWenigstenTier1();
  if (!agentId) return null;

  await sqlPool.begin(async (tx) => {
    await tx`SELECT set_config('fiaon.reason', 'auto_assign_tier1', true)`;
    await tx`SELECT set_config('fiaon.actor', 'system:followup', true)`;
    await tx`
      UPDATE fiaon_persons SET assigned_agent_id = ${agentId}, follow_up_date = CURRENT_DATE
      WHERE id = ${personId} AND assigned_agent_id IS NULL
    `;
  });

  // Hinweis in die Timeline — an die jüngste Bestellung der Person.
  const [ref] = await sqlPool`
    SELECT ref FROM fiaon_applications
    WHERE person_id = ${personId} AND merged_into IS NULL AND archived_at IS NULL
    ORDER BY created_at DESC LIMIT 1
  `;
  if (ref) {
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note, created_at)
      VALUES (${ref.ref}, NULL, 'System', 'system',
              'Neu bei dir: Der Kunde ist auf Priorität 1 aufgestiegen (Zahlung gemeldet oder Rechnung offen). Heute anrufen.',
              NOW())
    `.catch(() => {});
  }
  console.log(`[FIAON-FOLLOWUP] Auto-Assign: Person ${personId} → Agent ${agentId}`);
  return agentId;
}

// ───────────────────────────────────────────────────────────────────────────
// Nachschub
// ───────────────────────────────────────────────────────────────────────────

/**
 * Füllt einen Agenten aus der Reserve auf, wenn er unter die Schwelle fällt.
 *
 * Reihenfolge der Reserve ist dieselbe wie bei der Erstverteilung: Tier 1 nach
 * Zusagedatum, Tier 2 nach frischestem Antrag. Wer als nächstes dran wäre, soll
 * auch als nächstes vergeben werden — sonst versickert die dringendste Arbeit
 * unten in der Reserve.
 *
 * @param nurAgent Nur diesen Agenten prüfen (nach einer Statusänderung).
 */
export async function nachschub(nurAgent?: number): Promise<{ tier1: number; tier2: number; tier3: number }> {
  const { ensureBetreuungSpalte } = await import("../lib/tier");
  await ensureBetreuungSpalte(sqlPool);
  const s = await getSettings();
  const cap1 = parseInt(s.pool_cap_tier1 ?? "30", 10);
  const cap2 = parseInt(s.pool_cap_tier2 ?? "60", 10);
  // Stufe C (Leads) hat einen eigenen, weiten Deckel. Sie ist die Kür: Sie
  // wird erst gearbeitet, wenn A und B leer sind, kostet also keinen Platz in
  // der Pflicht — aber ein zu enger Deckel ließe den Vorrat wieder versickern.
  const cap3 = parseInt(s.pool_cap_tier3 ?? "800", 10);
  const schwelle = parseInt(s.pool_refill_threshold ?? "20", 10);
  const ergebnis = { tier1: 0, tier2: 0, tier3: 0 };

  const agenten = (await sqlPool`
    SELECT a.id,
           count(p.id) FILTER (WHERE p.priority_tier = 1)::int AS offen1,
           count(p.id) FILTER (WHERE p.priority_tier = 2)::int AS offen2,
           count(p.id) FILTER (WHERE p.priority_tier = 3)::int AS offen3
    FROM fiaon_agents a
    LEFT JOIN fiaon_persons p
      ON p.assigned_agent_id = a.id AND p.merged_into_person_id IS NULL AND NOT p.is_blocked
    WHERE a.active AND a.distribution_active AND NOT a.is_test_account
      AND (${nurAgent ?? null}::int IS NULL OR a.id = ${nurAgent ?? null}::int)
    GROUP BY a.id ORDER BY a.id
  `) as any[];

  for (const a of agenten) {
    // Die Reihenfolge ist die Geschäftsregel: erst A auffüllen, dann B, dann C.
    // Wer noch Pflicht offen hat, bekommt keine Kür nachgelegt.
    for (const [tier, offen, cap] of [[1, a.offen1, cap1], [2, a.offen2, cap2], [3, a.offen3, cap3]] as const) {
      // Die Schwelle gilt bewusst nur für Tier 1. Tier 2 wird aufgefüllt, sobald
      // Platz ist: Dort ist der Deckel das wirksame Mittel gegen Horten, nicht
      // die Untergrenze.
      if (tier === 1 && offen >= schwelle) continue;
      const luecke = cap - offen;
      if (luecke <= 0) continue;

      const kandidaten = (await sqlPool`
        SELECT p.id FROM fiaon_persons p
        WHERE p.assigned_agent_id IS NULL
          AND p.merged_into_person_id IS NULL
          AND p.priority_tier = ${tier}
          AND NOT p.is_blocked
          -- BESITZSCHUTZ (05.08.2026): Nur unberührte Personen kommen aus der
          -- Reserve. Wer schon einmal dokumentiert betreut wurde, bleibt bei
          -- seinem Betreuer — auch dann, wenn die Zuweisung verloren ging.
          -- Ohne diese Zeile verteilte der Nachschub fremde Kunden weiter und
          -- zwei Mitarbeiter riefen denselben Menschen an.
          AND p.betreuung_seit IS NULL
          AND p.ist_test_am IS NULL
        ORDER BY
          (p.promised_payment_date IS NULL),
          p.promised_payment_date ASC NULLS LAST,
          (SELECT MAX(ap.created_at) FROM fiaon_applications ap
            WHERE ap.person_id = p.id AND ap.merged_into IS NULL AND ap.archived_at IS NULL) DESC NULLS LAST,
          p.id ASC
        LIMIT ${luecke}
      `) as any[];
      if (kandidaten.length === 0) continue;

      const ids = kandidaten.map((k) => k.id);
      await sqlPool.begin(async (tx) => {
        await tx`SELECT set_config('fiaon.reason', 'nachschub', true)`;
        await tx`SELECT set_config('fiaon.actor', 'system:followup', true)`;
        await tx`
          UPDATE fiaon_persons SET assigned_agent_id = ${a.id}
          WHERE id = ANY(${ids}) AND assigned_agent_id IS NULL
        `;
      });
      if (tier === 1) ergebnis.tier1 += ids.length;
      else if (tier === 2) ergebnis.tier2 += ids.length;
      else ergebnis.tier3 += ids.length;
      console.log(`[FIAON-FOLLOWUP] Nachschub: Agent ${a.id} +${ids.length} Tier-${tier} (war ${offen}, Deckel ${cap})`);
    }
  }
  return ergebnis;
}

// ───────────────────────────────────────────────────────────────────────────
// Tageslauf
// ───────────────────────────────────────────────────────────────────────────

export type Tageslauf = {
  ausgefuehrt: boolean;
  grund?: string;
  heuteFaellig: number;
  ueberfaellig: number;
  eskalationen: number;
  autoAssign: number;
  nachschubTier1: number;
  nachschubTier2: number;
  nachschubTier3: number;
};

/**
 * Der 06:00-Lauf.
 *
 * @param opts.force Zeitfenster und Tagessperre übergehen (Admin-Auslöser).
 */
export async function runFollowUpTageslauf(opts: { force?: boolean } = {}): Promise<Tageslauf> {
  const leer: Tageslauf = {
    ausgefuehrt: false, heuteFaellig: 0, ueberfaellig: 0, eskalationen: 0,
    autoAssign: 0, nachschubTier1: 0, nachschubTier2: 0, nachschubTier3: 0,
  };

  // Stunde in Europe/Vienna — NICHT die Serverzeit. Render läuft in UTC; ohne
  // Zeitzone wäre der Lauf im Sommer um 08:00 und im Winter um 07:00 Ortszeit.
  //
  // Sie ist seit dem 30.08.2026 keine SPERRE mehr, sondern nur noch die
  // bevorzugte Zeit: Sie steht in der Meldung, damit im Protokoll erkennbar
  // bleibt, ob der Lauf zur gewünschten Stunde kam oder nachgeholt wurde.
  const wienStunde = Number(
    new Intl.DateTimeFormat("de-AT", { timeZone: "Europe/Vienna", hour: "numeric", hour12: false })
      .format(new Date()),
  );
  const zurGewuenschtenStunde = wienStunde === LAUF_STUNDE;
  const heute = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Vienna" }).format(new Date());

  // ══════════════════════════════════════════════════════════════════════════
  // DIE EINSTUFUNG LÄUFT VOR DEN SPERREN — BEI JEDEM TAKT (30.08.2026)
  //
  // ── DER BEFUND ────────────────────────────────────────────────────────────
  // Am 30.08.2026 wichen 188 gespeicherte Stufen von der Ableitung ab, darunter
  // 142 Kunden mit OFFENER RECHNUNG im kalten Fach. Der Nachzug lag längst hier
  // im Tageslauf — er ist nur nie gelaufen:
  //
  //   `followup_last_run` stand auf 2026-08-03, während der Kalender den
  //   18.08.2026 zeigte. FÜNFZEHN TAGE.
  //
  // GEMESSEN, dass es nicht die Funktion war: `alleTierAktualisieren` direkt
  // aufgerufen läuft durch und schreibt genau die abweichenden Zeilen. Der
  // 20-Minuten-Takt lebt auch (`runVerpassteTermine` hat am 18.08. um 02:53
  // Termine markiert). Es waren die drei Rückgaben ÜBER diesem Block: Der Lauf
  // darf nur in der 6-Uhr-Stunde (Wien) weitermachen. Wer in dieser einen
  // Stunde nicht läuft — Neustart, Deploy, ein schlafender Dienst —, hat den
  // Tag verloren. Und mit ihm die Einstufung.
  //
  // ── DIE TRENNUNG ──────────────────────────────────────────────────────────
  // Zwei Dinge waren in einem Zeitfenster zusammengebunden, die nicht
  // zusammengehören:
  //
  //   · Die VERTEILUNG und die Mahn-Staffel dürfen genau einmal am Tag laufen.
  //     Zweimal hieße zwei Mails an denselben Menschen. Das Fenster ist richtig.
  //   · Die EINSTUFUNG ist eine Korrektur. Sie ist idempotent, sie schreibt nur
  //     abweichende Zeilen, und sie kostet eine Abfrage. Sie an ein Tagesfenster
  //     zu binden heißt: Ein verpasstes Fenster kostet einen Tag falscher
  //     Arbeitslisten — und bei fünfzehn verpassten Fenstern liegen 142 Kunden
  //     mit offener Rechnung im kalten Fach.
  //
  // Deshalb steht die Einstufung jetzt VOR den Sperren und läuft bei jedem
  // Takt. Sie braucht den Lock nicht: Zwei gleichzeitige Läufe schreiben
  // dasselbe Ergebnis.
  //
  // Der Fehler wird NICHT mehr verschluckt. Vorher hing ein `.catch()` daran,
  // das nur auf die Konsole schrieb — ein stiller Programmfehler hätte genau
  // diesen Schaden erzeugt, ohne dass jemand es merkt. Jetzt wird gezählt.
  // ══════════════════════════════════════════════════════════════════════════
  try {
    const { alleTierAktualisieren } = await import("../lib/tier");
    const t = await alleTierAktualisieren(sqlPool);
    if (t.geaendert > 0) {
      console.log(`[FIAON-FOLLOWUP] Einstufung nachgezogen: ${t.geaendert} Person(en).`);
    }
  } catch (e) {
    // Ein Fehler hier ist ein FEHLER, keine Randnotiz: Ohne aktuelle Einstufung
    // arbeitet das ganze Haus auf veralteten Listen.
    console.error("[FIAON-FOLLOWUP] !! Einstufung fehlgeschlagen — Arbeitslisten "
      + "veralten, bis das behoben ist:", e);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FÄLLIGKEIT STATT UHRZEIT (30.08.2026)
  //
  // Hier stand:
  //     if (wienStunde !== LAUF_STUNDE) return …
  //
  // Der Gedanke war richtig: Mahnungen und Zuteilungen sollen morgens laufen,
  // nicht mitten am Tag. Die Folge war es nicht. Wer in dieser EINEN Stunde
  // nicht lebt — Neustart, Deploy, ein schlafender Dienst —, hat den Tag
  // verloren. Und den nächsten, und den übernächsten: GEMESSEN standen
  // `followup_last_run` und der Kalender fünfzehn Tage auseinander.
  //
  // Ein Fenster ohne Nachhol-Logik ist eine Wette darauf, dass der Server zur
  // richtigen Minute wach ist. Diese Wette hat das Haus fünfzehn Tage lang
  // verloren, ohne es zu merken.
  //
  // ── DIE NEUE BEDINGUNG ────────────────────────────────────────────────────
  // „Liegt der letzte ERFOLGREICHE Durchlauf mehr als 20 Stunden zurück?" Damit
  // läuft er weiter einmal am Tag — aber wenn er den Morgen verpasst, holt der
  // nächste Takt ihn nach, und zwar GENAU EINMAL.
  //
  // Die Morgenstunde bleibt als BEVORZUGUNG: Ist der letzte Erfolg noch keine
  // 20 Stunden her, passiert nichts. Ist er älter und es ist die 6-Uhr-Stunde,
  // läuft er sofort. Ist er älter und die Stunde ist vorbei, läuft er trotzdem
  // — lieber um 14 Uhr als gar nicht.
  //
  // 20 statt 24 Stunden: Bei exakt 24 würde ein Lauf, der heute um 06:05
  // erfolgreich war, morgen um 06:00 als „noch nicht fällig" gelten und erst
  // übermorgen wieder laufen. Die Stunde wandert dann täglich nach hinten.
  const FAELLIG_NACH_STUNDEN = 20;
  if (!opts.force) {
    const { istFaellig } = await import("../lib/fiaon-crons");
    if (!(await istFaellig("followup-und-termine-tageswerk", FAELLIG_NACH_STUNDEN))) {
      return { ...leer, grund: `noch nicht fällig (letzter Erfolg unter ${FAELLIG_NACH_STUNDEN} h)` };
    }
    // Der alte Merker bleibt bestehen und wird weiter geschrieben — die
    // Zahlungsansicht und der Wächter lesen ihn. Er ist ab jetzt eine
    // ABSCHRIFT der Historie, nicht mehr die Sperre.
  }

  if (!(await holeLock("followup_lock"))) {
    return { ...leer, grund: "eine andere Instanz läuft" };
  }

  try {
    // 0 · Die Einstufung ist oben schon gelaufen — VOR jeder Zuweisung.
    //
    // Der Tageslauf verteilt Tier-1-Personen. Läuft er auf veralteten Tiers, gibt
    // er bezahlte Kunden an Agenten weiter — genau das ist am 05.08.2026
    // passiert: Ein Kunde zahlte bei Daniel und landete anschließend in
    // Florentines Liste. Die Reihenfolge „Einstufung vor Verteilung" gilt
    // deshalb weiter; sie steht jetzt nur nicht mehr hinter dem Tagesfenster.

    // 1 · Auto-Assign für herrenlose Tier-1-Personen
    const herrenlos = (await sqlPool`
      SELECT id FROM fiaon_persons
      WHERE assigned_agent_id IS NULL AND merged_into_person_id IS NULL
        AND priority_tier = 1 AND NOT is_blocked AND ist_test_am IS NULL
      ORDER BY promised_payment_date ASC NULLS LAST, id ASC
      LIMIT 200
    `) as any[];
    let autoAssign = 0;
    for (const h of herrenlos) {
      const zugewiesen = await autoAssignTier1(h.id);
      if (zugewiesen) autoAssign++;
      // Sind alle Agenten am Deckel, liefert autoAssignTier1 null. Dann bringt
      // es nichts, die restlichen Kandidaten einzeln abzufragen — sie bleiben
      // alle in der Reserve. Ohne diesen Abbruch wären es bis zu 200 nutzlose
      // Abfragen pro Tageslauf.
      else break;
    }

    // 2 · Nachschub für alle
    const nach = await nachschub();

    // 3 · Eskalation: seit ESKALATION_TAGE keine dokumentierte Aktivität.
    //     Es wird NICHT umverteilt — nur markiert. Wem der Kunde weggenommen
    //     wird, entscheidet ein Mensch im Rotations-Tool.
    const eskaliert = (await sqlPool`
      SELECT p.id, p.assigned_agent_id,
             (SELECT ap.ref FROM fiaon_applications ap
               WHERE ap.person_id = p.id AND ap.merged_into IS NULL AND ap.archived_at IS NULL
               ORDER BY ap.created_at DESC LIMIT 1) AS ref
      FROM fiaon_persons p
      WHERE p.assigned_agent_id IS NOT NULL
        AND p.merged_into_person_id IS NULL
        AND NOT p.is_blocked
        AND p.priority_tier IN (1, 2)
        AND COALESCE((
          SELECT MAX(c.created_at) FROM fiaon_contact_log c
          JOIN fiaon_applications ap2 ON ap2.ref = c.ref
          WHERE ap2.person_id = p.id AND c.voided_at IS NULL AND c.agent_id IS NOT NULL
        ), p.assigned_at, NOW() - INTERVAL '99 days') < NOW() - (${ESKALATION_TAGE} || ' days')::interval
        -- Nicht jeden Tag erneut melden: nur, wenn heute noch kein Hinweis steht.
        AND NOT EXISTS (
          SELECT 1 FROM fiaon_contact_log c2
          JOIN fiaon_applications ap3 ON ap3.ref = c2.ref
          WHERE ap3.person_id = p.id AND c2.type = 'system'
            AND c2.note LIKE 'Liegt seit%'
            AND c2.created_at::date = CURRENT_DATE
        )
      LIMIT 500
    `) as any[];

    for (const e of eskaliert) {
      if (!e.ref) continue;
      await sqlPool`
        INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note, created_at)
        VALUES (${e.ref}, NULL, 'System', 'system',
                ${`Liegt seit über ${ESKALATION_TAGE} Tagen ohne dokumentierten Kontakt. Bitte anrufen oder abgeben.`},
                NOW())
      `.catch(() => {});
    }

    // 4 · Zahlen für das Protokoll
    const [z] = await sqlPool`
      SELECT
        count(*) FILTER (
          WHERE NOT is_blocked AND priority_tier IN (1, 2) AND assigned_agent_id IS NOT NULL
            AND (promised_payment_date = CURRENT_DATE
                 OR (follow_up_date IS NOT NULL AND follow_up_date <= CURRENT_DATE))
        )::int AS heute_faellig,
        count(*) FILTER (
          WHERE NOT is_blocked AND assigned_agent_id IS NOT NULL
            AND promised_payment_date IS NOT NULL AND promised_payment_date < CURRENT_DATE
        )::int AS ueberfaellig
      FROM fiaon_persons WHERE merged_into_person_id IS NULL
    `;

    await sqlPool`
      INSERT INTO fiaon_settings (key, value, updated_at) VALUES ('followup_last_run', ${heute}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = ${heute}, updated_at = NOW()
    `;

    // ── DER ERFOLG GEHT IN DIE HISTORIE ───────────────────────────────────
    // Unter EIGENEM Namen, nicht unter „followup-und-termine": Dieser Name
    // gehört dem 20-Minuten-Takt, der auch Termin-Erinnerungen und den Space
    // bedient und alle 20 Minuten Erfolg meldet. Würde das Tageswerk denselben
    // Namen benutzen, wäre es nach dem ersten Takt für 20 Stunden „nicht
    // fällig" — und liefe nie wieder.
    //
    // Zwei Läufe, zwei Namen. Die Ampel zeigt beide getrennt, und genau das
    // will man sehen: Der Takt kann laufen, während das Tageswerk steht.
    await sqlPool`
      INSERT INTO fiaon_lauf_historie (name, ergebnis, begonnen, beendet, dauer_ms, meldung)
      VALUES ('followup-und-termine-tageswerk', 'erfolg', NOW(), NOW(), 0,
              ${`${autoAssign} zugeteilt, ${eskaliert.length} eskaliert, `
                + `Nachschub ${nach.tier1}/${nach.tier2}/${nach.tier3}`
                + (zurGewuenschtenStunde ? "" : ` (nachgeholt um ${wienStunde} Uhr)`)})
    `.catch((e) => console.error("[FIAON-FOLLOWUP] Historie:", e));

    const ergebnis: Tageslauf = {
      ausgefuehrt: true,
      heuteFaellig: z.heute_faellig,
      ueberfaellig: z.ueberfaellig,
      eskalationen: eskaliert.length,
      autoAssign,
      nachschubTier1: nach.tier1,
      nachschubTier2: nach.tier2,
      nachschubTier3: nach.tier3,
    };
    console.log(
      `[FIAON-FOLLOWUP] Tageslauf: ${ergebnis.heuteFaellig} fällig, ${ergebnis.ueberfaellig} überfällig, ` +
      `${ergebnis.eskalationen} eskaliert, ${autoAssign} auto-zugewiesen, ` +
      `Nachschub +${nach.tier1}/+${nach.tier2}/+${nach.tier3}`,
    );
    return ergebnis;
  } finally {
    await gibLockFrei("followup_lock");
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Termin-Erinnerungen — 24 Stunden vorher, genau einmal
// ───────────────────────────────────────────────────────────────────────────

/**
 * Erinnert Kunden an ihren Termin am nächsten Tag.
 *
 * IDEMPOTENZ OHNE LOCK: Das `UPDATE … RETURNING` beansprucht die Zeilen in
 * derselben Anweisung, in der es sie findet. Wer als zweiter kommt — ein
 * paralleler Prozess, ein Neustart, ein zweiter Aufruf in derselben Minute —
 * findet `erinnert_am IS NOT NULL` und bekommt nichts zurück. Dasselbe Muster
 * benutzt `runCallbackReminders` für die Rückruf-Erinnerungen der Agenten.
 */
export async function runTerminErinnerungen(): Promise<number> {
  // ── OHNE KANAL LÄUFT NICHTS, UND ES WIRD PROTOKOLLIERT ────────────────
  // Hier stand nur „if (!process.env.MAKE_WEBHOOK_URL) return 0". Das
  // verhinderte den Lauf — aber STILL: Der Betreiber sah nirgends, dass eine
  // Automatik seit Tagen nicht arbeitet. Jetzt steht einmal am Tag eine Zeile
  // „übersprungen (kein Kanal)" im Zustellprotokoll.
  if (!(await versandErlaubtOderProtokoll("Termin-Erinnerungen"))) return 0;

  const faellig = (await sqlPool`
    UPDATE fiaon_termine SET erinnert_am = NOW()
    WHERE id IN (
      SELECT t.id FROM fiaon_termine t
      WHERE t.status = 'gebucht' AND t.erinnert_am IS NULL
        AND t.beginn BETWEEN NOW() AND NOW() + INTERVAL '24 hours'
    )
    RETURNING id, person_id, agent_id, beginn, storno_token, quelle
  `) as any[];
  if (faellig.length === 0) return 0;

  const { versendenUndProtokollieren } = await import("../lib/fiaon-mail-log");
  const { berlinDatumText, berlinUhrzeit, stornoLink } = await import("../lib/fiaon-termine");
  const { terminArtAusQuelle } = await import("../../shared/fiaon-termin-art");
  let versandt = 0;
  let fehlgeschlagen = 0;
  let nochmal = 0;
  for (const t of faellig) {
    const [p] = (await sqlPool`
      SELECT COALESCE(NULLIF(p.first_name, ''), p.contact_name) AS vorname, p.last_name AS nachname,
             COALESCE(NULLIF(p.primary_email, ''), (
               SELECT NULLIF(COALESCE(a.email, a.contact_email, a.billing_email), '')
               FROM fiaon_applications a
               WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
               ORDER BY a.created_at DESC LIMIT 1
             )) AS email,
             COALESCE(NULLIF(ag.first_name, ''), ag.name) AS agent_vorname,
             (SELECT a2.ref FROM fiaon_applications a2
               WHERE a2.person_id = p.id AND a2.merged_into IS NULL AND a2.archived_at IS NULL
               ORDER BY a2.created_at DESC LIMIT 1) AS ref
      FROM fiaon_persons p LEFT JOIN fiaon_agents ag ON ag.id = ${t.agent_id}
      WHERE p.id = ${t.person_id}
    `) as any[];
    if (!p) continue;
    const ergebnis = await versendenUndProtokollieren(
      "termin_erinnerung",
      {
        email: String(p.email || ""),
        vorname: p.vorname || null,
        nachname: p.nachname || null,
        agent_vorname: String(p.agent_vorname || "Ihr Ansprechpartner"),
        termin_datum: berlinDatumText(t.beginn),
        termin_uhrzeit: berlinUhrzeit(t.beginn),
        // Die Terminart, aus derselben Ableitung wie die Bestätigung und die
        // Oberfläche. BETREIBER-TODO: als {{params.termin_art}} in die
        // Brevo-Vorlage aufnehmen.
        termin_art: terminArtAusQuelle(t.quelle).text,
        storno_link: t.storno_token ? stornoLink(String(t.storno_token)) : "",
        // Derselbe fertige Satz wie in der Bestätigung — für
        // {{params.hinweis_anruf}} in der Brevo-Vorlage. In der Erinnerung ist
        // er noch wichtiger: Sie kommt 24 Stunden vor dem Termin, also genau
        // dann, wenn der Mensch überlegt, was er vorbereiten muss.
        hinweis_anruf: anrufHinweis(String(p.agent_vorname || "")),
        hinweis_absage: ABSAGE_HINWEIS,
      },
      {
        personId: Number(t.person_id),
        verlaufRef: p.ref || null,
        verlaufText: `Terminerinnerung versandt (morgen ${berlinUhrzeit(t.beginn)} Uhr).`,
      },
    );
    if (ergebnis.status === "versandt") {
      versandt++;
      continue;
    }
    // ══════════════════════════════════════════════════════════════════════
    // EINE ERINNERUNG, DIE NICHT RAUSGING, IST NICHT VERBRAUCHT
    //
    // ── DER BEFUND (17.08.2026) ───────────────────────────────────────────
    // Das UPDATE oben setzt `erinnert_am` für ALLE fälligen Termine, BEVOR
    // gesendet wird. Das ist gegen Doppelversand richtig — aber es fehlte die
    // Gegenbewegung: Scheitert der Versand, blieb die Marke stehen.
    //
    // GEMESSEN: 91 Termine mit Marke, nur 56 mit erfolgreichem Versand.
    // **35 Erinnerungen verbraucht, ohne dass der Kunde etwas bekam.** Acht
    // der Termine lagen noch in der Zukunft.
    //
    // Jetzt wird die Marke zurückgenommen — aber nur, wenn der Termin noch
    // in der ZUKUNFT liegt. Eine Erinnerung an einen vergangenen Termin ist
    // peinlich; sie darf nicht beim nächsten Lauf doch noch rausgehen.
    // ══════════════════════════════════════════════════════════════════════
    const zurueck = (await sqlPool`
      UPDATE fiaon_termine SET erinnert_am = NULL, updated_at = NOW()
      WHERE id = ${t.id} AND beginn > NOW() + INTERVAL '30 minutes'
      RETURNING id
    `) as any[];
    fehlgeschlagen++;
    if (zurueck.length > 0) nochmal++;
    console.warn(`[FIAON-FOLLOWUP] Termin ${t.id}: Erinnerung ${ergebnis.status} `
      + `(${ergebnis.grund ?? "ohne Grund"})`
      + `${zurueck.length > 0 ? " — Marke zurückgenommen, wird erneut versucht" : ""}`);
  }
  if (versandt) console.log(`[FIAON-FOLLOWUP] Termin-Erinnerungen versendet: ${versandt}/${faellig.length}`);
  if (fehlgeschlagen) {
    console.warn(`[FIAON-FOLLOWUP] ${fehlgeschlagen} Erinnerung(en) nicht versandt, `
      + `${nochmal} davon werden erneut versucht.`);
  }
  return versandt;
}

// ── Registrierung im bestehenden Muster: setInterval im Web-Prozess ─────────
// Alle 20 Minuten nachsehen, ob es 6 Uhr in Wien ist. Ein stündlicher Takt
// könnte die Stunde bei ungünstigem Startzeitpunkt verpassen.
// ── KEINE TAGESLÄUFE AUF EINEM ENTWICKLUNGSRECHNER ─────────────────────────
// Am 08.08.2026 lief hier lokal ein Entwicklungsserver gegen die
// PRODUKTIONSDATENBANK. Der neu eingebaute Wiedereinstiegs-Lauf feuerte nach
// zwanzig Minuten und markierte 26 echte Kunden als angeschrieben — ohne dass
// eine einzige Mail rausging, weil die Entwicklungsmaschine keinen
// Mail-Kanal hat. Der Schaden war reparabel, die Lehre bleibt:
//
// Tagesläufe starten nur, wenn dieser Prozess der Betrieb IST. Erkennbar an
// NODE_ENV=production oder am ausdrücklichen Flag CRONS=an. Wer lokal einen
// Lauf prüfen will, ruft ihn von Hand auf — dann weiß er auch, dass er es tut.
import { tageslauf } from "../lib/fiaon-crons";

// ── EINE REGISTRATUR FÜR ALLE LÄUFE (17.08.2026) ──────────────────────────
// Hier stand `setInterval` mit einer eigenen `if (!CRONS_AN) return`-Zeile.
// Sie war richtig — aber sie war eine Kopie. Von sieben zeitgesteuerten Läufen
// im Haus gingen zwei an der Bremse VORBEI (fiaon-leads.ts), einer prüfte
// selbst (fiaon-abo.ts), einer hatte diese Kopie hier, und nur drei nahmen die
// Registratur.
//
// Eine Regel, die an fünf Stellen anders geschrieben ist, ist keine Regel. Ab
// jetzt geht jeder Lauf durch `tageslauf` — dort steht die Bremse EINMAL, und
// eine neue Aufrufstelle kann sie nicht vergessen.
// ═══════════════════════════════════════════════════════════════════════════
// DER WÄCHTER ÜBER DEN WÄCHTERN (30.08.2026)
//
// Er hängt am selben 20-Minuten-Takt wie der Folgelauf und prüft, ob ein
// registrierter Lauf zu lange ausgeblieben ist. Bleibt einer aus, geht eine
// Mail an den Betreiber und ein Eintrag ins Protokoll.
//
// ── WARUM ER NICHT SEIN EIGENER TAGESLAUF IST ─────────────────────────────
// Ein Wächter, der sich selbst überwachen müsste, verschiebt das Problem nur um
// eine Ebene. Er hängt deshalb an einem Takt, der ohnehin läuft — und wenn
// DIESER Takt steht, steht die ganze Automatik, und das merkt man an allem
// anderen. Ein eigener Lauf hätte genau dieselbe Ausfallart wie das, was er
// bewacht.
tageslauf("laeufe-ueberwachen", async () => {
  const m = await import("../lib/fiaon-crons");
  return await m.laeufeUeberwachen();
}, 20 * 60 * 1000);

// ═══════════════════════════════════════════════════════════════════════════
// DIE BESTANDSWACHE
//
// ── WARUM SIE HIER STEHT ──────────────────────────────────────────────────
// Neben der Lauf-Überwachung, weil sie dieselbe Aufgabe hat: bemerken, was
// niemand bemerkt. Am 21.08.2026 lagen fünf Kunden, drei Termine und 591,60 €
// Provision 48 Tage lang unsichtbar an zwei falsch markierten Konten —
// gefunden hat es ein Zufall beim Aufräumen.
//
// `alleXStunden: 20` statt einer festen Uhrzeit: Ein Server, der um 6 Uhr
// schläft, hätte den Tag sonst verpasst (siehe die Begründung an `tageslauf`).
// ═══════════════════════════════════════════════════════════════════════════
tageslauf("bestandswache", async () => {
  const m = await import("../lib/fiaon-bestandswache");
  return await m.bestandswache();
}, 60 * 60 * 1000, { beimStartNach: 90_000, alleXStunden: 20 });

tageslauf("followup-und-termine", async () => {
  return await runFollowUpTageslauf();
  // Die Terminerinnerung hängt NICHT am 6-Uhr-Tageslauf: Ein Termin um 09:20
  // braucht seine Erinnerung am Vortag um 09:20, nicht um 6 Uhr morgens. Der
  // 20-Minuten-Takt trifft das Fenster genau genug.
  runTerminErinnerungen().catch((err) => console.error("[FIAON-FOLLOWUP] Termin-Erinnerungen:", err));
  // Die Wiedereinstiegs-Staffel (Teil 4) — höchstens 50 am Tag, damit weder
  // die Zustellbarkeit noch das Team von Rückläufern überrollt wird.
  import("../lib/fiaon-wiedereinstieg")
    .then((m) => m.wiedereinstiegTagesstaffel())
    .catch((err) => console.error("[FIAON-FOLLOWUP] Wiedereinstieg:", err));
  // Startgespräch: die eine Einladung 48 Stunden nach dem Überspringen, und
  // das Aufräumen unerledigter Termine.
  import("./fiaon-startgespraech")
    .then(async (m) => { await m.runStartgespraechEinladungen(); await m.runVerpassteTermine(); })
    .catch((err) => console.error("[FIAON-FOLLOWUP] Startgespräch:", err));
  // Zustell-Abgleich: Was ist aus den Mails der letzten Tage geworden?
  // Ohne Brevo-Schlüssel geht der Lauf sofort wieder schlafen.
  import("../lib/fiaon-zustellung")
    .then((m) => m.zustellungAbgleichen())
    .catch((err) => console.error("[FIAON-FOLLOWUP] Zustellung:", err));
  // ── Space: JEDEN Lauf, nicht nur vor sieben ──────────────────────────────
  // Bis zum 11.08.2026 stand hier `if (stunde < 7)`. Das passte, solange der
  // Space genau einen Beitrag pro Tag bekam. Die Content-Engine verteilt
  // zwanzig über den Tag — mit der alten Bedingung wäre kein einziger davon
  // erschienen, und der Feed wäre wieder leer gewesen.
  //
  // `spaceTageslauf` entscheidet selbst, was zu dieser Stunde fällig ist, und
  // ist über die Auto-Schlüssel idempotent.
  import("../lib/fiaon-space")
    .then((m) => m.spaceTageslauf())
    .catch((err) => console.error("[FIAON-FOLLOWUP] Space:", err));
}, 20 * 60 * 1000);

// ───────────────────────────────────────────────────────────────────────────
// Admin-Auslöser (für Tests und den Betrieb)
// ───────────────────────────────────────────────────────────────────────────
router.post("/admin/followup/run", async (_req: Request, res: Response) => {
  try {
    const ergebnis = await runFollowUpTageslauf({ force: true });
    res.json({ ok: true, ...ergebnis });
  } catch (err) {
    console.error("[FIAON-FOLLOWUP] run:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/admin/followup/nachschub", async (req: Request, res: Response) => {
  try {
    const nurAgent = req.body?.agentId ? Number(req.body.agentId) : undefined;
    const ergebnis = await nachschub(nurAgent);
    res.json({ ok: true, ...ergebnis });
  } catch (err) {
    console.error("[FIAON-FOLLOWUP] nachschub:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
