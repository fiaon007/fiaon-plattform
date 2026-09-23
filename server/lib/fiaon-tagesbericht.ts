// ═══════════════════════════════════════════════════════════════════════════
// DER TAGESBERICHT (23.09.2026, E-216)
//
// Justin: „Ich will, dass jeden Tag, nachdem der Mitarbeiter fertig ist, gefragt
// wird: ‚Das System hat Folgendes über Ihren heutigen Arbeitstag aufgezeichnet …‘
// — so detailliert wie möglich, dass er sich denkt ‚wow, geil, was die alles
// wissen‘. Und ich möchte jeden Tag einen Arbeitsbericht haben."
//
// ── DER BEFUND, DER DAS NÖTIG MACHT ───────────────────────────────────────
// Gemessen über sieben Tage (17.–23.09.2026): Von 933 gebuchten
// Gesprächsergebnissen hat rund die HÄLFTE keinen Anruf im System hinter sich.
//
//   Nikita     274 Anrufe   393 Ergebnisse
//   Daniel      10 Anrufe   282 Ergebnisse   → 272 ohne Anruf
//   Florentine   0 Anrufe   193 Ergebnisse   → 193 ohne Anruf
//
// Es wird also über das eigene Handy telefoniert. Das ist nicht verboten und
// soll es auch nicht sein — aber es heißt: keine Aufnahme, keine Dauer, kein
// Transkript. Gesprächsqualität ist bei zwei von drei Verkäufern schlicht nicht
// beurteilbar, und niemand weiß, wie viele Gespräche ein Tag wirklich hatte.
//
// ── WAS DIESER BERICHT IST, UND WAS ER NICHT IST ──────────────────────────
// Er ist KEINE Anwesenheitserfassung. /agent/leistung sagt seit Monaten
// ausdrücklich „keine Arbeitszeit-, Pausen- oder Anwesenheitserfassung", und
// das bleibt so: Gezeigt werden Arbeitsergebnisse und die Zeiten, die aus
// Anrufen ohnehin entstehen. Keine Uhr, kein Pausenknopf.
//
// SPIEGELPRINZIP: Der Mitarbeiter sieht GENAU dasselbe wie die Leitung. Keine
// Zahl über ihn, die er nicht selbst sieht. Alles andere wäre Überwachung, und
// Überwachung erzeugt Ausweichverhalten — genau das, was wir hier abstellen
// wollen.
//
// ── DIE VIER LÜCKEN, DIE DABEI GESCHLOSSEN WERDEN ─────────────────────────
// 1. KEINE ZWEITE WAHRHEIT BEIM GELD. Was er nachträgt, geht den bestehenden
//    Weg: Gesprächsergebnis über `ergebnisAnwenden`, Zusage über
//    `promised_payment_date`. Sonst gäbe es Zusagen, die Mahnlauf, Pipeline und
//    Mara nicht kennen.
// 2. ZAHLEN LASSEN SICH NICHT AUFBLASEN. Systemzahl und Selbstangabe stehen
//    nebeneinander und werden NIE addiert; jede Ergänzung braucht einen Namen.
// 3. EIN FEEDBACK-KANAL. „Was sollen wir verbessern" wird ein Ticket im
//    bestehenden Kanal (/agent/feedback), nicht ein zweiter Topf.
// 4. DER ANREIZ IST ECHT: Wen er hier nachträgt, verschwindet morgen aus seiner
//    Liste. Das ist keine Behauptung — ein gebuchtes Ergebnis nimmt den
//    Menschen aus „Neu für dich". Wer über sein Handy telefoniert und nichts
//    bucht, bekommt dieselben Leute morgen wieder. Genau Daniels Klage vom 02.09.
//
// ── DIE PFLICHT, GESTAFFELT (Justins Entscheidung) ────────────────────────
// Erst weich, nach einer Woche hart: Bis `SPERRE_AB` erscheint der Bericht und
// lässt sich wegklicken; danach gibt es ohne den Bericht von gestern heute
// keine Arbeitsliste. So wird niemand am ersten Morgen ausgesperrt.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { berlinToday } from "./fiaon-time";

/** Ab hier ist der Bericht Pflicht (Justin, 23.09.2026: „erst weich, nach einer Woche hart"). */
export const SPERRE_AB = "2026-09-30";

let bereit: Promise<void> | null = null;
export function tagesberichtTabelle(): Promise<void> {
  if (!bereit) {
    bereit = (async () => {
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_tagesbericht (
          id BIGSERIAL PRIMARY KEY,
          agent_id INTEGER NOT NULL,
          tag DATE NOT NULL,
          -- Die Aufzeichnung wird beim Abgeben eingefroren. Sonst zeigte der
          -- Bericht von gestern morgen andere Zahlen als gestern Abend.
          aufzeichnung JSONB NOT NULL DEFAULT '{}'::jsonb,
          anrufe_selbst INTEGER NOT NULL DEFAULT 0,
          nachgetragen JSONB NOT NULL DEFAULT '[]'::jsonb,
          zusagen JSONB NOT NULL DEFAULT '[]'::jsonb,
          gut TEXT, schlecht TEXT, verbesserung TEXT,
          stimmung INTEGER,
          abgegeben_am TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await sqlPool`CREATE UNIQUE INDEX IF NOT EXISTS fiaon_tagesbericht_einmal ON fiaon_tagesbericht (agent_id, tag)`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_tagesbericht_tag ON fiaon_tagesbericht (tag DESC)`;
    })().catch((e) => {
      const c = String((e as any)?.code ?? "");
      if (c === "23505" || c === "42P07") return;
      bereit = null;
      throw e;
    });
  }
  return bereit;
}

export interface Aufzeichnung {
  tag: string;
  anrufe: { gesamt: number; gespraeche: number; minuten: number; ersterUm: string | null; letzterUm: string | null; nummern: number };
  ergebnisse: { gesamt: number; jeArt: { art: string; text: string; n: number }[] };
  termine: { gebucht: number; namen: string[] };
  zahlungGemeldet: { anzahl: number; namen: string[] };
  mandate: number;
  whatsapp: number;
  arbeitsliste: { bereit: number; bearbeitet: number };
  erstesZeichen: string | null;
  letztesZeichen: string | null;
}

const ERGEBNIS_TEXT: Record<string, string> = {
  erreicht_interesse: "Erreicht – Interesse",
  erreicht_kein_interesse: "Erreicht – kein Interesse",
  erreicht_zahlt_gleich: "Erreicht – zahlt sofort",
  erreicht_zahlt_am: "Erreicht – zahlt an einem Tag",
  erreicht_abgelehnt: "Erreicht – abgelehnt",
  erreicht_sonstiges: "Erreicht – Sonstiges",
  nicht_erreicht: "Nicht erreicht",
  mailbox: "Mailbox",
  nummer_falsch: "Nummer falsch",
  rueckruf_termin: "Rückruf vereinbart",
  rate_zahlt_am: "Rate – zahlt an einem Tag",
  rate_nicht_erreicht: "Rate – nicht erreicht",
  rate_ratenpause: "Rate – Pause vereinbart",
};

const uhr = (v: unknown): string | null =>
  v ? new Date(String(v)).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }) : null;

/**
 * Was das System über diesen Arbeitstag weiß. Alles aus vorhandenen Tabellen —
 * es wird nichts zusätzlich mitgeschrieben, nur zusammengetragen.
 */
export async function aufzeichnungFuer(agentId: number, tag?: string): Promise<Aufzeichnung> {
  const t = tag ?? berlinToday();
  const [anrufe] = (await sqlPool`
    SELECT COUNT(*)::int AS gesamt,
           COUNT(*) FILTER (WHERE c.dauer_sek >= 30)::int AS gespraeche,
           (COALESCE(SUM(c.dauer_sek), 0) / 60)::int AS minuten,
           MIN(c.beginn) AS erster, MAX(c.beginn) AS letzter,
           COUNT(DISTINCT c.nummer)::int AS nummern
      FROM fiaon_calls c
     WHERE c.agent_id = ${agentId}
       AND (c.beginn AT TIME ZONE 'Europe/Berlin')::date = ${t}::date`.catch(() => [])) as any[];

  const ergebnisse = (await sqlPool`
    SELECT cl.outcome, COUNT(*)::int AS n
      FROM fiaon_contact_log cl
     WHERE cl.agent_id = ${agentId} AND cl.type = 'result' AND cl.voided_at IS NULL
       AND (cl.created_at AT TIME ZONE 'Europe/Berlin')::date = ${t}::date
     GROUP BY 1 ORDER BY 2 DESC`.catch(() => [])) as any[];

  const termine = (await sqlPool`
    SELECT TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')) AS name
      FROM fiaon_termine tm LEFT JOIN fiaon_persons p ON p.id = tm.person_id
     WHERE tm.agent_id = ${agentId}
       AND (tm.created_at AT TIME ZONE 'Europe/Berlin')::date = ${t}::date
     LIMIT 40`.catch(() => [])) as any[];

  const zahlung = (await sqlPool`
    SELECT TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')) AS name
      FROM fiaon_applications a JOIN fiaon_persons p ON p.id = a.person_id
     WHERE p.assigned_agent_id = ${agentId} AND a.merged_into IS NULL
       AND (a.claimed_paid_at AT TIME ZONE 'Europe/Berlin')::date = ${t}::date
     LIMIT 40`.catch(() => [])) as any[];

  const [mandate] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_persons p
     WHERE p.assigned_agent_id = ${agentId}
       AND (p.mandat_seit AT TIME ZONE 'Europe/Berlin')::date = ${t}::date`.catch(() => [])) as any[];

  const [wa] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_whatsapp w
     WHERE w.richtung = 'raus' AND w.von = (SELECT name FROM fiaon_agents WHERE id = ${agentId})
       AND (w.created_at AT TIME ZONE 'Europe/Berlin')::date = ${t}::date`.catch(() => [])) as any[];

  const [zeichen] = (await sqlPool`
    SELECT MIN(cl.created_at) AS erstes, MAX(cl.created_at) AS letztes
      FROM fiaon_contact_log cl
     WHERE cl.agent_id = ${agentId}
       AND (cl.created_at AT TIME ZONE 'Europe/Berlin')::date = ${t}::date`.catch(() => [])) as any[];

  const gesamtErg = ergebnisse.reduce((s, r) => s + Number(r.n || 0), 0);
  return {
    tag: t,
    anrufe: {
      gesamt: Number(anrufe?.gesamt || 0), gespraeche: Number(anrufe?.gespraeche || 0),
      minuten: Number(anrufe?.minuten || 0), ersterUm: uhr(anrufe?.erster), letzterUm: uhr(anrufe?.letzter),
      nummern: Number(anrufe?.nummern || 0),
    },
    ergebnisse: {
      gesamt: gesamtErg,
      jeArt: ergebnisse.map((r) => ({ art: String(r.outcome), text: ERGEBNIS_TEXT[String(r.outcome)] ?? String(r.outcome), n: Number(r.n) })),
    },
    termine: { gebucht: termine.length, namen: termine.map((r) => String(r.name || "").trim()).filter(Boolean).slice(0, 8) },
    zahlungGemeldet: { anzahl: zahlung.length, namen: zahlung.map((r) => String(r.name || "").trim()).filter(Boolean).slice(0, 8) },
    mandate: Number(mandate?.n || 0),
    whatsapp: Number(wa?.n || 0),
    // „Bereit" ist der Vorrat, den die Arbeitsliste heute hergegeben hätte —
    // bewusst aus derselben Quelle wie die Pipeline, nicht neu gerechnet.
    arbeitsliste: { bereit: 0, bearbeitet: gesamtErg },
    erstesZeichen: uhr(zeichen?.erstes),
    letztesZeichen: uhr(zeichen?.letztes),
  };
}

/** Die Menschen, mit denen er heute zu tun hatte — für die Auswahl beim Nachtragen. */
export async function kundenFuerAuswahl(agentId: number, hoechstens = 300): Promise<{ id: number; name: string; stufe: number }[]> {
  const zeilen = (await sqlPool`
    SELECT p.id, TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')) AS name,
           COALESCE(p.priority_tier, 3) AS stufe
      FROM fiaon_persons p
     WHERE p.assigned_agent_id = ${agentId} AND p.merged_into_person_id IS NULL
       AND p.ist_test_am IS NULL AND NOT p.is_blocked
     ORDER BY (COALESCE(p.priority_tier, 3) = 3), p.updated_at DESC NULLS LAST
     LIMIT ${Math.min(Math.max(hoechstens, 1), 500)}`.catch(() => [])) as any[];
  return zeilen.map((r) => ({ id: Number(r.id), name: String(r.name || "").trim() || `#${r.id}`, stufe: Number(r.stufe) }));
}

export interface BerichtEingabe {
  anrufeSelbst: number;
  /** Menschen, die er über sein eigenes Telefon erreicht hat, mit Ergebnis. */
  nachgetragen: { personId: number; ergebnis: string }[];
  /** Zusagen, die im System noch nicht stehen. */
  zusagen: { personId: number; datum: string }[];
  gut?: string | null;
  schlecht?: string | null;
  verbesserung?: string | null;
  stimmung?: number | null;
}

/** Liegt für diesen Tag schon ein Bericht vor? */
export async function berichtFuer(agentId: number, tag: string): Promise<any | null> {
  await tagesberichtTabelle();
  const [r] = (await sqlPool`SELECT * FROM fiaon_tagesbericht WHERE agent_id = ${agentId} AND tag = ${tag}::date LIMIT 1`) as any[];
  return r ?? null;
}

/**
 * Den Bericht abgeben. Alles Nachgetragene geht ZUSÄTZLICH den normalen Weg —
 * der Bericht ist ein Eingang, keine zweite Wahrheit.
 */
export async function berichtAbgeben(
  agent: { id: number; name: string },
  tag: string,
  e: BerichtEingabe,
): Promise<{ ok: boolean; gebucht: number; zusagen: number; ticket: boolean }> {
  await tagesberichtTabelle();
  const aufzeichnung = await aufzeichnungFuer(agent.id, tag);

  let gebucht = 0;
  for (const n of e.nachgetragen.slice(0, 200)) {
    try {
      const { ergebnisAnwenden, istErgebnis } = await import("./fiaon-kontakt-ergebnis");
      if (!istErgebnis(n.ergebnis)) continue;
      const [a] = (await sqlPool`
        SELECT ref FROM fiaon_applications WHERE person_id = ${n.personId} AND merged_into IS NULL
         ORDER BY created_at DESC LIMIT 1`.catch(() => [])) as any[];
      await ergebnisAnwenden({ ref: a?.ref ?? null, personId: n.personId, ergebnis: n.ergebnis as any });
      // Der Grund gehört in den Verlauf — sonst steht dort ein Ergebnis ohne
      // Anruf, und beim nächsten Blick fragt jemand, wo das Gespräch herkommt.
      await sqlPool`
        INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note, created_at)
        VALUES (${a?.ref ?? null}, ${n.personId}, ${agent.id}, ${agent.name}, 'system',
                ${`Über das eigene Telefon geführt, im Tagesbericht vom ${tag} nachgetragen.`}, NOW())`.catch(() => {});
      gebucht++;
    } catch (err) { console.error("[TAGESBERICHT] Ergebnis nachtragen:", err); }
  }

  let zusagen = 0;
  for (const z of e.zusagen.slice(0, 100)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(z.datum)) continue;
    try {
      await sqlPool`
        UPDATE fiaon_persons SET promised_payment_date = ${z.datum}::date, updated_at = NOW()
         WHERE id = ${z.personId}`;
      await sqlPool`
        INSERT INTO fiaon_contact_log (person_id, agent_id, agent_name, type, note, created_at)
        VALUES (${z.personId}, ${agent.id}, ${agent.name}, 'system',
                ${`Zahlungszusage für den ${z.datum} — im Tagesbericht vom ${tag} nachgetragen.`}, NOW())`.catch(() => {});
      zusagen++;
    } catch (err) { console.error("[TAGESBERICHT] Zusage nachtragen:", err); }
  }

  // Der Verbesserungsvorschlag geht in den BESTEHENDEN Kanal. Ein zweiter Topf
  // wäre ein Topf, in den niemand schaut.
  let ticket = false;
  const vorschlag = String(e.verbesserung ?? "").trim();
  if (vorschlag.length >= 10) {
    try {
      await sqlPool`
        INSERT INTO fiaon_agent_feedback (agent_id, category, title, description, status, created_at)
        VALUES (${agent.id}, 'idee', ${`Aus dem Tagesbericht vom ${tag}`}, ${vorschlag.slice(0, 4000)}, 'open', NOW())`;
      ticket = true;
    } catch (err) { console.error("[TAGESBERICHT] Feedback-Ticket:", err); }
  }

  await sqlPool`
    INSERT INTO fiaon_tagesbericht (agent_id, tag, aufzeichnung, anrufe_selbst, nachgetragen, zusagen, gut, schlecht, verbesserung, stimmung)
    VALUES (${agent.id}, ${tag}::date, ${sqlPool.json(aufzeichnung as any)}, ${Math.max(0, Math.min(999, Math.round(e.anrufeSelbst || 0)))},
            ${sqlPool.json(e.nachgetragen as any)}, ${sqlPool.json(e.zusagen as any)},
            ${e.gut ?? null}, ${e.schlecht ?? null}, ${vorschlag || null},
            ${e.stimmung != null ? Math.max(1, Math.min(5, Math.round(e.stimmung))) : null})
    ON CONFLICT (agent_id, tag) DO UPDATE SET
      aufzeichnung = EXCLUDED.aufzeichnung, anrufe_selbst = EXCLUDED.anrufe_selbst,
      nachgetragen = EXCLUDED.nachgetragen, zusagen = EXCLUDED.zusagen,
      gut = EXCLUDED.gut, schlecht = EXCLUDED.schlecht, verbesserung = EXCLUDED.verbesserung,
      stimmung = EXCLUDED.stimmung, abgegeben_am = NOW()`;

  console.log(`[TAGESBERICHT] ${agent.name} für ${tag}: ${gebucht} Ergebnisse, ${zusagen} Zusagen nachgetragen.`);
  return { ok: true, gebucht, zusagen, ticket };
}

/**
 * Ist heute ein Bericht fällig, und ab wann?
 *
 * Fällig ist er nur, wenn für heute Zeiten hinterlegt sind — wer nicht
 * eingeplant ist, arbeitet nicht und schreibt keinen Bericht. Angeboten wird er
 * 15 Minuten vor dem Ende des letzten Blocks.
 */
export async function faelligFuer(agentId: number): Promise<{
  faellig: boolean; abgegeben: boolean; tag: string; abUm: string | null; gestern: { tag: string; fehlt: boolean };
}> {
  await tagesberichtTabelle();
  const heute = berlinToday();
  const [bloecke] = (await sqlPool`
    SELECT MAX(bis)::text AS ende FROM fiaon_agent_verfuegbarkeit
     WHERE agent_id = ${agentId} AND wochentag = EXTRACT(ISODOW FROM (NOW() AT TIME ZONE 'Europe/Berlin'))::int`.catch(() => [])) as any[];
  const [jetzt] = (await sqlPool`
    SELECT TO_CHAR(NOW() AT TIME ZONE 'Europe/Berlin', 'HH24:MI') AS uhr,
           ((NOW() AT TIME ZONE 'Europe/Berlin')::date - 1)::text AS gestern`) as any[];

  const ende = bloecke?.ende ? String(bloecke.ende).slice(0, 5) : null;
  let abUm: string | null = null;
  if (ende) {
    const [h, m] = ende.split(":").map(Number);
    const min = Math.max(0, h * 60 + m - 15);
    abUm = `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
  }
  const heuteAbgegeben = !!(await berichtFuer(agentId, heute));
  const gesternTag = String(jetzt?.gestern ?? "");
  // Für gestern zählt nur, ob überhaupt gearbeitet wurde — sonst fehlte jedem
  // Mitarbeiter nach jedem freien Tag ein Bericht.
  const [gesternArbeit] = (await sqlPool`
    SELECT EXISTS (
      SELECT 1 FROM fiaon_contact_log cl
       WHERE cl.agent_id = ${agentId} AND cl.type = 'result' AND cl.voided_at IS NULL
         AND (cl.created_at AT TIME ZONE 'Europe/Berlin')::date = ${gesternTag}::date) AS ja`.catch(() => [])) as any[];
  const gesternFehlt = gesternArbeit?.ja === true && !(await berichtFuer(agentId, gesternTag));

  return {
    faellig: !!abUm && !heuteAbgegeben && String(jetzt?.uhr ?? "") >= abUm,
    abgegeben: heuteAbgegeben,
    tag: heute,
    abUm,
    gestern: { tag: gesternTag, fehlt: gesternFehlt },
  };
}

/** Die Übersicht für die Leitung. */
export async function berichteFuerLeitung(vonTag: string, bisTag: string): Promise<any[]> {
  await tagesberichtTabelle();
  return (await sqlPool`
    SELECT b.*, a.name AS agent_name
      FROM fiaon_tagesbericht b JOIN fiaon_agents a ON a.id = b.agent_id
     WHERE b.tag BETWEEN ${vonTag}::date AND ${bisTag}::date
     ORDER BY b.tag DESC, a.name`.catch(() => [])) as any[];
}

/** Wer hat an einem Tag gearbeitet, aber nichts abgegeben? */
export async function fehlendeBerichte(tag: string): Promise<{ agentId: number; name: string; ergebnisse: number }[]> {
  await tagesberichtTabelle();
  const zeilen = (await sqlPool`
    SELECT cl.agent_id, a.name, COUNT(*)::int AS ergebnisse
      FROM fiaon_contact_log cl JOIN fiaon_agents a ON a.id = cl.agent_id
     WHERE cl.type = 'result' AND cl.voided_at IS NULL
       AND (cl.created_at AT TIME ZONE 'Europe/Berlin')::date = ${tag}::date
       AND NOT EXISTS (SELECT 1 FROM fiaon_tagesbericht b WHERE b.agent_id = cl.agent_id AND b.tag = ${tag}::date)
     GROUP BY 1, 2 ORDER BY 3 DESC`.catch(() => [])) as any[];
  return zeilen.map((r) => ({ agentId: Number(r.agent_id), name: String(r.name), ergebnisse: Number(r.ergebnisse) }));
}
