// ═══════════════════════════════════════════════════════════════════════════
// RÜCKRUFE MIT FRIST — das Loch, durch das Kunden fielen
//
// ── DER HINTERGRUND ────────────────────────────────────────────────────────
// Ein Kunde rief an. Es wurde „notiert". Niemand meldete sich.
//
// GEMESSEN am 16.08.2026: 23 offene Rückruf-Termine, 19 überfällig, **18
// länger als 24 Stunden** — ohne Eskalation, ohne dass es irgendwo auffiel.
// Dazu: eingehende Support-Mails werden gespeichert, aber KEINEM zugeteilt und
// erzeugen KEINE Aufgabe. Sie liegen.
//
// ── DIE REGEL ──────────────────────────────────────────────────────────────
// Jeder Rückruf-Wunsch bekommt eine Frist von 24 Stunden und einen Menschen.
//   · Zuständiger vorhanden  → er bekommt ihn.
//   · Kein Zuständiger       → die Vertriebsleitung.
// Läuft die Frist ab: Eskalations-Karte im Admin UND eine Team-Nachricht an
// die Leitung. Erledigen geht NUR mit Ergebnis-Notiz.
//
// ── WARUM 24 STUNDEN UND NICHT „ZEITNAH" ───────────────────────────────────
// „Zeitnah" ist keine Frist, sondern eine Absichtserklärung. Eine Zahl kann
// ablaufen, eine Absicht nicht — und nur was ablaufen kann, kann eskalieren.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";
import { formatBerlin } from "./fiaon-time";
import { absoluteUrl } from "../fiaon-base-url";

type Lauf = typeof sqlPool;

/** Die Frist. Eine Zahl, ein Ort. */
export const FRIST_STUNDEN = 24;

export type RueckrufQuelle = "mail_inbound" | "telefon" | "manuell" | "portal";

export interface RueckrufEingabe {
  personId?: number | null;
  ref?: string | null;
  quelle: RueckrufQuelle;
  quelleId?: string | null;
  /** Was der Kunde will — in SEINEN Worten, nicht zusammengefasst. */
  anliegen: string;
  /** Telefon oder Mail, über die er erreichbar ist. */
  kontakt?: string | null;
}

/**
 * Wer ist zuständig? Der Betreuer des Kunden, sonst die Vertriebsleitung.
 *
 * Nicht „irgendwer mit der kleinsten Last": Ein Rückruf gehört dem Menschen,
 * der den Kunden kennt. Erst wenn es keinen gibt, entscheidet die Leitung.
 */
async function zustaendigFuer(personId: number | null, lauf: Lauf): Promise<number | null> {
  if (personId) {
    const [p] = (await lauf`
      SELECT assigned_agent_id FROM fiaon_persons
      WHERE id = ${personId} AND merged_into_person_id IS NULL
    `) as any[];
    if (p?.assigned_agent_id) return Number(p.assigned_agent_id);
  }
  const [l] = (await lauf`
    SELECT id FROM fiaon_agents
    WHERE active AND rolle = 'vertriebsleiter' AND NOT COALESCE(is_test_account, FALSE)
    ORDER BY id LIMIT 1
  `) as any[];
  return l ? Number(l.id) : null;
}

/**
 * Nimmt einen Rückruf-Wunsch auf. Idempotent über `quelle` + `quelle_id`:
 * Eine Mail, die zweimal zugestellt wird, erzeugt EINEN Rückruf.
 */
export async function rueckrufAufnehmen(
  ein: RueckrufEingabe, lauf: Lauf = sqlPool,
): Promise<{ id: number | null; neu: boolean; zustaendig: number | null }> {
  const anliegen = String(ein.anliegen || "").trim().slice(0, 4000);
  if (!anliegen) return { id: null, neu: false, zustaendig: null };

  if (ein.quelleId) {
    const [da] = (await lauf`
      SELECT id, zustaendig_agent_id FROM fiaon_rueckrufe
      WHERE quelle = ${ein.quelle} AND quelle_id = ${ein.quelleId}
    `) as any[];
    if (da) return { id: Number(da.id), neu: false, zustaendig: da.zustaendig_agent_id ?? null };
  }

  const zustaendig = await zustaendigFuer(ein.personId ?? null, lauf);
  const [r] = (await lauf`
    INSERT INTO fiaon_rueckrufe
      (person_id, ref, quelle, quelle_id, anliegen, kontakt, zustaendig_agent_id, frist_bis)
    VALUES (${ein.personId ?? null}, ${ein.ref ?? null}, ${ein.quelle},
            ${ein.quelleId ?? null}, ${anliegen}, ${ein.kontakt ?? null},
            ${zustaendig}, NOW() + (${FRIST_STUNDEN} || ' hours')::interval)
    RETURNING id
  `) as any[];

  // Der Verlaufseintrag: Wer die Akte öffnet, soll den Wunsch sehen — nicht
  // nur der Zuständige in seiner Aufgabenliste.
  if (ein.ref) {
    await lauf`
      INSERT INTO fiaon_contact_log (person_id, ref, agent_id, agent_name, type, note)
      VALUES (${ein.personId ?? null}, ${ein.ref}, NULL, 'System', 'system',
              ${`Rückruf-Wunsch aufgenommen (${ein.quelle}), Frist ${FRIST_STUNDEN} Stunden: ${anliegen.slice(0, 500)}`})
    `.catch(() => {});
  }

  // Und eine Aufgabe im bestehenden Aufgaben-Modul: Der Zuständige arbeitet
  // dort, nicht in einer zweiten Liste, die er erst öffnen müsste.
  if (zustaendig) {
    await lauf`
      INSERT INTO fiaon_vermerke
        (art, ref, text, sicht, zustaendig_agent_id, faellig_am, dringend, autor_art, autor_name)
      VALUES ('aufgabe', ${ein.ref ?? null},
              ${`RÜCKRUF binnen ${FRIST_STUNDEN} h: ${anliegen.slice(0, 900)}`},
              'privat', ${zustaendig},
              (NOW() + (${FRIST_STUNDEN} || ' hours')::interval)::date, TRUE, 'system', 'System')
    `.catch((e) => console.error("[RUECKRUF] Aufgabe:", e));
  }

  console.log(`[RUECKRUF] #${r.id} aufgenommen (${ein.quelle}) → Agent ${zustaendig ?? "niemand"}`);
  return { id: Number(r.id), neu: true, zustaendig };
}

/**
 * Erledigen — NUR mit Ergebnis-Notiz.
 *
 * Ein Rückruf, der ohne Ergebnis abgehakt wird, ist ein erledigter Haken und
 * keine Auskunft. Genau das war der Ausgangsfehler: „wird notiert."
 */
export async function rueckrufErledigen(
  id: number, von: { name: string; agentId: number | null }, notiz: string,
  lauf: Lauf = sqlPool,
): Promise<{ ok: boolean; error?: string }> {
  const text = String(notiz || "").trim();
  if (text.length < 10) {
    return {
      ok: false,
      error: "Bitte kurz festhalten, was besprochen wurde (mindestens 10 Zeichen). "
        + "Ein Rückruf ohne Ergebnis ist der Fehler, den dieser Mechanismus verhindern soll.",
    };
  }
  const [r] = (await lauf`
    UPDATE fiaon_rueckrufe
    SET status = 'erledigt', ergebnis_notiz = ${text.slice(0, 4000)},
        erledigt_am = NOW(), erledigt_von = ${von.name}, updated_at = NOW()
    WHERE id = ${id} AND status = 'offen'
    RETURNING person_id, ref, anliegen
  `) as any[];
  if (!r) return { ok: false, error: "Dieser Rückruf ist nicht mehr offen." };

  if (r.ref) {
    await lauf`
      INSERT INTO fiaon_contact_log (person_id, ref, agent_id, agent_name, type, note)
      VALUES (${r.person_id}, ${r.ref}, ${von.agentId}, ${von.name}, 'result',
              ${`Rückruf erledigt: ${text.slice(0, 2000)}`})
    `.catch(() => {});
  }
  // Die zugehörige Aufgabe schließen — sonst steht sie weiter da.
  await lauf`
    UPDATE fiaon_vermerke
    SET status = 'erledigt', erledigt_am = NOW(), erledigt_von = ${von.name}, updated_at = NOW()
    WHERE art = 'aufgabe' AND status = 'offen' AND text LIKE ${`RÜCKRUF binnen%${String(r.anliegen).slice(0, 40)}%`}
  `.catch(() => {});
  return { ok: true };
}

/**
 * Der Tageslauf: Wer die Frist gerissen hat, eskaliert.
 *
 * Zwei Wirkungen, und beide sind nötig:
 *   · Eine Karte im Admin — der Betreiber SIEHT es.
 *   · Eine Team-Nachricht an die Leitung — jemand wird ANGESPROCHEN.
 * Eine Karte allein wird übersehen, eine Nachricht allein verschwindet im
 * Posteingang.
 *
 * Idempotent über `eskaliert_am`: Ein zweiter Lauf eskaliert nicht erneut.
 */
export async function rueckrufeEskalieren(lauf: Lauf = sqlPool): Promise<{
  eskaliert: number; gemeldet: number;
}> {
  const faellig = (await lauf`
    SELECT r.id, r.anliegen, r.kontakt, r.frist_bis, r.person_id, r.ref,
           r.zustaendig_agent_id,
           ag.name AS agent_name,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, p.contact_name, 'Ohne Namen') AS kunde
    FROM fiaon_rueckrufe r
    LEFT JOIN fiaon_agents ag ON ag.id = r.zustaendig_agent_id
    LEFT JOIN fiaon_persons p ON p.id = r.person_id
    WHERE r.status = 'offen' AND r.frist_bis < NOW() AND r.eskaliert_am IS NULL
    ORDER BY r.frist_bis
    LIMIT 50
  `) as any[];
  if (faellig.length === 0) return { eskaliert: 0, gemeldet: 0 };

  let gemeldet = 0;
  for (const r of faellig) {
    await lauf`
      UPDATE fiaon_rueckrufe SET eskaliert_am = NOW(), updated_at = NOW() WHERE id = ${r.id}
    `;
    // Die Karte für den Betreiber: eine Aufgabe „für den Betreiber".
    await lauf`
      INSERT INTO fiaon_vermerke
        (art, ref, text, sicht, fuer_betreiber, faellig_am, dringend, autor_art, autor_name)
      VALUES ('aufgabe', ${r.ref ?? null},
              ${`FRIST GERISSEN — Rückruf an ${r.kunde} seit ${formatBerlin(r.frist_bis)} offen.`
                + `${r.agent_name ? ` Zuständig: ${r.agent_name}.` : " Niemand zuständig."}`
                + ` Anliegen: ${String(r.anliegen).slice(0, 600)}`},
              'team', TRUE, (NOW() AT TIME ZONE 'Europe/Berlin')::date, TRUE, 'system', 'System')
    `.catch((e) => console.error("[RUECKRUF] Eskalationskarte:", e));

    // Und die Nachricht an die Leitung.
    try {
      const leitung = (await lauf`
        SELECT id, name, email, COALESCE(NULLIF(first_name,''), name) AS vorname
        FROM fiaon_agents
        WHERE active AND rolle = 'vertriebsleiter' AND NOT COALESCE(is_test_account, FALSE)
      `) as any[];
      for (const l of leitung) {
        if (!l.email) continue;
        const { eigeneMailSenden } = await import("./fiaon-brevo");
        const erg = await eigeneMailSenden({
          an: String(l.email), name: String(l.vorname),
          betreff: `Frist gerissen: Rückruf an ${r.kunde}`,
          text: `Hallo ${l.vorname},\n\n`
            + `ein Rückruf-Wunsch ist seit ${formatBerlin(r.frist_bis)} überfällig.\n\n`
            + `Kunde: ${r.kunde}\n`
            + `Zuständig: ${r.agent_name ?? "niemand"}\n`
            + (r.kontakt ? `Kontakt: ${r.kontakt}\n` : "")
            + `Anliegen: ${String(r.anliegen).slice(0, 800)}\n\n`
            + `Zu den Aufgaben: ${absoluteUrl("/admin/aufgaben")}\n\n`
            + `Die Frist sind ${FRIST_STUNDEN} Stunden ab Eingang. Ein Kunde, der `
            + `angerufen hat und nichts hört, ruft nicht ein zweites Mal an.`,
        });
        if (erg.ok) gemeldet++;
      }
    } catch (e) {
      console.error("[RUECKRUF] Meldung an die Leitung:", e);
    }
  }
  console.log(`[RUECKRUF] ${faellig.length} Frist(en) gerissen, ${gemeldet} Meldung(en) raus.`);
  return { eskaliert: faellig.length, gemeldet };
}

/** Die Arbeitsliste eines Menschen — oder alle, für den Betreiber. */
export async function rueckrufListe(
  opts: { agentId?: number | null; nurOffen?: boolean } = {}, lauf: Lauf = sqlPool,
): Promise<any[]> {
  return (await lauf`
    SELECT r.id, r.anliegen, r.kontakt, r.quelle, r.frist_bis, r.status,
           r.eskaliert_am, r.created_at, r.person_id, r.ref,
           r.ergebnis_notiz, r.erledigt_am, r.erledigt_von,
           ag.name AS zustaendig,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, p.contact_name, 'Ohne Namen') AS kunde,
           (r.status = 'offen' AND r.frist_bis < NOW()) AS ueberfaellig,
           GREATEST(0, EXTRACT(EPOCH FROM (r.frist_bis - NOW()))/3600)::int AS stunden_rest
    FROM fiaon_rueckrufe r
    LEFT JOIN fiaon_agents ag ON ag.id = r.zustaendig_agent_id
    LEFT JOIN fiaon_persons p ON p.id = r.person_id
    WHERE (${opts.agentId ?? null}::int IS NULL OR r.zustaendig_agent_id = ${opts.agentId ?? null})
      AND (${opts.nurOffen === false} OR r.status = 'offen')
    ORDER BY (r.status = 'offen') DESC, r.frist_bis ASC
    LIMIT 200
  `) as any[];
}

/** Zahlen für die Admin-Karte. */
export async function rueckrufZahlen(lauf: Lauf = sqlPool): Promise<{
  offen: number; ueberfaellig: number; eskaliert: number; ohneZustaendigen: number;
}> {
  const [z] = (await lauf`
    SELECT COUNT(*) FILTER (WHERE status = 'offen')::int AS offen,
           COUNT(*) FILTER (WHERE status = 'offen' AND frist_bis < NOW())::int AS ueberfaellig,
           COUNT(*) FILTER (WHERE status = 'offen' AND eskaliert_am IS NOT NULL)::int AS eskaliert,
           COUNT(*) FILTER (WHERE status = 'offen' AND zustaendig_agent_id IS NULL)::int AS ohne
    FROM fiaon_rueckrufe
  `) as any[];
  return {
    offen: Number(z.offen), ueberfaellig: Number(z.ueberfaellig),
    eskaliert: Number(z.eskaliert), ohneZustaendigen: Number(z.ohne),
  };
}
