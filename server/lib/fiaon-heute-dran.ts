// ═══════════════════════════════════════════════════════════════════════════
// „HEUTE DRAN“ — DER SERVER SAMMELT, DIE REGELN ORDNEN (E-406 A, 19.10.2026)
//
// Die Regeln (Reihenfolge, eine Zeile je Kunde, Verteilung, Rückstau) stehen
// rein in shared/fiaon-heute-dran.ts. Hier wird nur GELESEN — aus den Orten,
// an denen heute schon Arbeit steht:
//
//   termin    fiaon_termine (heute, nicht abgesagt)              erledigt = geführt
//   rueckruf  fiaon_contact_log „rueckruf_termin“ + fiaon_rueckrufe
//                                                                erledigt = erledigt / heute angerufen
//   auftrag   fiaon_betreiber_todos (beim Mitarbeiter)          erledigt = heute zu (Automatik = „von allein“)
//   inkasso   offene Raten je Kunde im SICHTFELD (fiaon-inkasso.ts), ohne Grenze
//                                                                erledigt = Rate heute bezahlt oder bearbeitet
//   zahlung   fiaon_applications claimed_paid (≤ 14 Tage)       erledigt = Geld gebucht / heute angerufen
//   kyc       Unterlagen da, kyc pending, Vertrag läuft          erledigt = heute geprüft
//   anliegen  fiaon_tickets                                     erledigt = heute beantwortet
//   hitze     arbeitslisteLesen() (E-162/E-251, die Pipeline)   erledigt = frischer A/B heute angerufen
//   bonitaet  bonitaetArbeitsliste(), Auskunft bezahlt          erledigt = Auswertung heute gestartet
//
// NUR LESEND. Kein Pool-Nachschub, keine Zuteilung, kein Abhak-Speicher — der
// Plan wird je Aufruf neu gerechnet und zwei Minuten zwischengespeichert.
// Keine KI: Die Liste läuft auch in der KI-Pause. Eine Quelle, die gerade nicht
// lesbar ist, fehlt sichtbar („fehlend“) — der Rest steht trotzdem da.
//
// Vertriebssperre (fiaon_persons.is_blocked = „kein Kontakt, keine Anrufliste“):
// offene Termine und Rückrufe solcher Kunden stehen auf keiner Liste — wie auf
// dem Schreibtisch (fiaon-agent-start.ts). Service (Aufträge, Anliegen, KYC)
// bleibt. Heute schon Geführtes zählt weiter als erledigt (Prüfer-Fund 19.10.).
//
// Wer gehört zum Team? Aktiv, kein Test- oder Prüfkonto, nicht gesperrt, nicht
// in Schulung, nicht der Gründer. Was bei Justin (Test-/Prüfkonten, Gründer)
// liegt, bleibt bei ihm und wird nie verteilt. Was bei gesperrten oder
// gegangenen Konten liegt, gilt als „ohne Zuständigen“ und geht an die Rolle
// zur Lage (shared: ROLLEN_FUER_LAGE) — nichts verschwindet still.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import {
  planen, arbeitsMinuten, kurzGrund, auftragGrund, rateGrund, zielErlaubt, berlinTag,
  FRIST_ARTEN_ZUSAETZLICH, MELDUNG_HOECHSTENS_TAGE, MELDUNG_FRISCH_STUNDEN, RUECKRUF_RUECKBLICK_TAGE,
  type HeuteEintrag, type TeamMitglied, type TeamPlan, type PersonPlan,
} from "@shared/fiaon-heute-dran";
import { artRegel } from "@shared/fiaon-auftrag-arten";
import { terminArtAusQuelle } from "@shared/fiaon-termin-art";
import { produktkategorieSql } from "@shared/fiaon-produktkategorie";
import { LAEUFT_UNGEKUENDIGT_SQL } from "@shared/fiaon-kuendigung-regel";
import { kontaktZeileSql } from "./fiaon-pipeline-reihung";

type Lauf = typeof sqlPool;

/** So lange gilt ein gerechneter Plan (für alle Mitarbeiter derselbe Stand). */
export const PLAN_GUELTIG_MS = 2 * 60_000;

const MITTERNACHT_SQL = `(date_trunc('day', NOW() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin')`;
const HEUTE_SQL = `(NOW() AT TIME ZONE 'Europe/Berlin')::date`;
const NAME_SQL = (p: string) => `COALESCE(NULLIF(TRIM(CONCAT_WS(' ', ${p}.first_name, ${p}.last_name)), ''),
  NULLIF(TRIM(${p}.company_name), ''), NULLIF(TRIM(${p}.contact_name), ''))`;
/** Heute hat jemand mit diesem Menschen gesprochen oder es versucht (Gesprächsergebnis, Tagesbericht-Nachtrag). Zwei Indizes, kein ODER über zwei Spalten. */
const HEUTE_KONTAKT_SQL = (p: string) => `(EXISTS (SELECT 1 FROM fiaon_contact_log hk1
     WHERE hk1.person_id = ${p} AND ${kontaktZeileSql("hk1")} AND hk1.voided_at IS NULL AND hk1.created_at >= ${MITTERNACHT_SQL})
  OR EXISTS (SELECT 1 FROM fiaon_contact_log hk2 JOIN fiaon_applications hka ON hka.ref = hk2.ref
     WHERE hka.person_id = ${p} AND ${kontaktZeileSql("hk2")} AND hk2.voided_at IS NULL AND hk2.created_at >= ${MITTERNACHT_SQL}))`;

const akte = (personId: number) => `/agent/kunden?person=${personId}`;
const iso = (v: unknown): string | null => {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
const uhr = (v: unknown): string => {
  const d = v instanceof Date ? v : new Date(String(v));
  const t: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d)) t[p.type] = p.value;
  return `${t.hour ?? "??"}:${t.minute ?? "??"}`;
};
const tagMonat = (v: unknown): string => {
  const d = v instanceof Date ? v : new Date(String(v));
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", timeZone: "Europe/Berlin" });
};
const nameOder = (n: unknown, ersatz: string) => String(n ?? "").trim() || ersatz;
const zahl = (v: unknown): number | null => (v == null || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);

// ── Das Team ───────────────────────────────────────────────────────────────

export interface TeamStand {
  team: TeamMitglied[];
  /** Konten der Geschäftsführung (Test-/Prüfkonten, Gründer) — ihre Einträge stehen auf keiner Mitarbeiterliste. */
  betreiberIds: number[];
}

/** Wer heute zum Team gehört und wie lange er arbeitet (Verfügbarkeit, Team-Abwesenheit abgezogen). */
export async function teamLesen(lauf: Lauf = sqlPool, jetzt: Date = new Date()): Promise<TeamStand> {
  const agenten = (await lauf.unsafe(`
    SELECT a.id, COALESCE(NULLIF(TRIM(a.name), ''), TRIM(CONCAT_WS(' ', a.first_name, a.last_name))) AS name,
           COALESCE(a.rolle, 'agent') AS rolle, COALESCE(a.active, TRUE) AS aktiv,
           COALESCE(a.is_test_account, FALSE) AS test, COALESCE(a.pruefkonto, FALSE) AS pruefkonto,
           a.zugang_gesperrt_am IS NOT NULL AS gesperrt, COALESCE(a.schulung_offen, FALSE) AS schulung,
           COALESCE((SELECT json_agg(json_build_object('von', v.von::text, 'bis', v.bis::text))
                       FROM fiaon_agent_verfuegbarkeit v
                      WHERE v.agent_id = a.id AND COALESCE(v.aktiv, TRUE)
                        AND v.wochentag = EXTRACT(ISODOW FROM (NOW() AT TIME ZONE 'Europe/Berlin'))::int), '[]'::json) AS fenster
      FROM fiaon_agents a ORDER BY a.id`)) as any[];
  let gruender = 0;
  try { gruender = await (await import("../routes/fiaon-gruender-termin")).gruenderAgentId(); } catch { /* ohne Gründer-Einstellung */ }
  // Team-Abwesenheit (E-260): nur lesen — abwesenheitJetzt() würde ein Ablaufen in den Verlauf SCHREIBEN.
  let abw: { an: boolean; vertreterId: number | null; bis: string | null; fuer: number[] } | null = null;
  try { abw = await (await import("./fiaon-abwesenheit")).abwesenheitLesen(false, lauf); } catch { /* ohne Abwesenheit */ }
  const abwBis = abw?.an && abw.vertreterId && abw.bis ? new Date(abw.bis) : null;
  const abwesendBis = (id: number): Date | null => {
    if (!abwBis || Number.isNaN(abwBis.getTime()) || abwBis.getTime() <= jetzt.getTime()) return null;
    if (id === Number(abw!.vertreterId)) return null;
    if (abw!.fuer?.length && !abw!.fuer.map(Number).includes(id)) return null;
    return abwBis;
  };
  const heute = berlinTag(jetzt);
  const team: TeamMitglied[] = [];
  const betreiberIds: number[] = [];
  for (const a of agenten) {
    const id = Number(a.id);
    if (a.test || a.pruefkonto || id === Number(gruender)) { betreiberIds.push(id); continue; }
    if (!a.aktiv || a.gesperrt || a.schulung) continue;
    const fenster = Array.isArray(a.fenster) ? a.fenster : [];
    const bis = abwesendBis(id);
    // Team-Abwesenheit: Der Vertreter ruft an — er bekommt Termine und Fristfälle, wenn hier 0 Minuten bleiben.
    const vertreterId = bis ? Number(abw!.vertreterId) : null;
    let ab = 0;
    if (bis) {
      if (berlinTag(bis) !== heute) { team.push({ id, name: nameOder(a.name, `#${id}`), rolle: String(a.rolle), minuten: 0, vertreterId }); continue; }
      const t: Record<string, string> = {};
      for (const p of new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(bis)) t[p.type] = p.value;
      ab = Number(t.hour) * 60 + Number(t.minute);
      if (!Number.isFinite(ab)) ab = 24 * 60; // im Zweifel: heute nicht da
    }
    team.push({ id, name: nameOder(a.name, `#${id}`), rolle: String(a.rolle), minuten: arbeitsMinuten(fenster, ab), vertreterId });
  }
  return { team, betreiberIds };
}

// ── Die Quellen ────────────────────────────────────────────────────────────

/** 1 · Termine heute (nicht abgesagt). Erledigt = geführt. Offene Termine mit Vertriebssperre: nicht dabei. */
async function termine(lauf: Lauf): Promise<HeuteEintrag[]> {
  const { quelleUmleitbar } = await import("./fiaon-abwesenheit");
  const zeilen = (await lauf.unsafe(`
    SELECT t.id, t.person_id, t.agent_id, t.beginn, t.status, t.quelle, ${NAME_SQL("p")} AS name,
           COALESCE(p.is_blocked, FALSE) AS gesperrt
      FROM fiaon_termine t LEFT JOIN fiaon_persons p ON p.id = t.person_id
     WHERE (t.beginn AT TIME ZONE 'Europe/Berlin')::date = ${HEUTE_SQL}
       AND t.abgesagt_am IS NULL AND t.status IN ('gebucht', 'erledigt', 'verpasst')
       AND (p.id IS NULL OR (p.ist_test_am IS NULL AND p.merged_into_person_id IS NULL))`)) as any[];
  const aus: HeuteEintrag[] = [];
  for (const t of zeilen) {
    const pid = zahl(t.person_id);
    const art = terminArtAusQuelle(t.quelle).text;
    const erledigt = t.status === "erledigt";
    if (!erledigt && t.gesperrt === true) continue;
    aus.push({
      schluessel: `termin:${t.id}`, quelle: "termin", personId: pid, name: nameOder(t.name, "Termin"),
      grund: erledigt ? `${art} geführt` : t.status === "verpasst" ? "Termin verpasst – nachfassen" : kurzGrund(`${art} um ${uhr(t.beginn)} Uhr`),
      betragCents: null,
      ziel: pid ? (t.quelle === "global" ? `/agent/firmen?person=${pid}` : akte(pid)) : "/agent/kalender",
      zeit: iso(t.beginn), seit: iso(t.beginn), zustaendigId: zahl(t.agent_id), rolle: "vertrieb", erledigt,
      // Gründer-Gespräch und FIAON Global haben einen festen Gesprächspartner — nie in Vertretung (E-260).
      nieUmleiten: !quelleUmleitbar(t.quelle),
    });
  }
  return aus;
}

/** 2a · Vereinbarte Rückrufe (Gesprächsergebnis „Rückruf vereinbart“) heute und der letzten 14 Tage. */
async function rueckrufeVereinbart(lauf: Lauf): Promise<HeuteEintrag[]> {
  const zeilen = (await lauf.unsafe(`
    SELECT c.id, c.agent_id, c.scheduled_at, c.done_at, p.id AS person_id, p.assigned_agent_id, ${NAME_SQL("p")} AS name,
           COALESCE(p.is_blocked, FALSE) AS gesperrt,
           -- „beantwortet“: Nach der vereinbarten Zeit (2 Std. Vorlauf) gab es ein Gespräch oder einen Versuch.
           (SELECT MAX(x.created_at) FROM (
              SELECT k1.created_at FROM fiaon_contact_log k1 WHERE k1.person_id = p.id AND ${kontaktZeileSql("k1")} AND k1.voided_at IS NULL
                AND k1.created_at > c.created_at AND k1.created_at >= c.scheduled_at - INTERVAL '2 hours'
              UNION ALL
              SELECT k2.created_at FROM fiaon_contact_log k2 JOIN fiaon_applications ka ON ka.ref = k2.ref
               WHERE ka.person_id = p.id AND ${kontaktZeileSql("k2")} AND k2.voided_at IS NULL
                 AND k2.created_at > c.created_at AND k2.created_at >= c.scheduled_at - INTERVAL '2 hours') x) AS beantwortet_am
      FROM fiaon_contact_log c
      LEFT JOIN fiaon_applications ca ON ca.ref = c.ref
      JOIN fiaon_persons p ON p.id = COALESCE(c.person_id, ca.person_id)
     WHERE c.outcome = 'rueckruf_termin' AND c.voided_at IS NULL AND c.scheduled_at IS NOT NULL
       AND c.scheduled_at >= ${MITTERNACHT_SQL} - INTERVAL '${RUECKRUF_RUECKBLICK_TAGE} days'
       AND c.scheduled_at < ${MITTERNACHT_SQL} + INTERVAL '1 day'
       AND (c.done_at IS NULL OR c.done_at >= ${MITTERNACHT_SQL})
       AND p.ist_test_am IS NULL AND p.merged_into_person_id IS NULL`)) as any[];
  const aus: HeuteEintrag[] = [];
  const heute = berlinTag(new Date());
  for (const c of zeilen) {
    const pid = Number(c.person_id);
    const beantwortet = c.beantwortet_am ? new Date(c.beantwortet_am) : null;
    const beantwortetHeute = !!beantwortet && berlinTag(beantwortet) === heute;
    const erledigt = !!c.done_at || beantwortetHeute;
    if (!erledigt && beantwortet) continue; // an einem früheren Tag beantwortet — keine Arbeit mehr
    if (!erledigt && c.gesperrt === true) continue; // Vertriebssperre: kein Kontakt (wie der Schreibtisch)
    const heuteFaellig = berlinTag(c.scheduled_at) === heute;
    aus.push({
      schluessel: `rueckruf:${c.id}`, quelle: "rueckruf", personId: pid, name: nameOder(c.name, `Kunde #${pid}`),
      grund: erledigt ? "Rückruf geführt" : heuteFaellig ? `Rückruf um ${uhr(c.scheduled_at)} Uhr` : `Rückruf überfällig seit ${tagMonat(c.scheduled_at)}`,
      betragCents: null, ziel: akte(pid), zeit: iso(c.scheduled_at), seit: iso(c.scheduled_at),
      zustaendigId: zahl(c.assigned_agent_id) ?? zahl(c.agent_id), rolle: "vertrieb", erledigt,
    });
  }
  return aus;
}

/** 2b · Rückruf-Wünsche mit 24-Stunden-Frist (fiaon_rueckrufe). */
async function rueckrufWuensche(lauf: Lauf): Promise<HeuteEintrag[]> {
  const zeilen = (await lauf.unsafe(`
    SELECT r.id, r.ref, r.zustaendig_agent_id, r.frist_bis, r.status, r.erledigt_am, r.created_at,
           p.id AS person_id, p.assigned_agent_id, ${NAME_SQL("p")} AS name, COALESCE(p.is_blocked, FALSE) AS gesperrt
      FROM fiaon_rueckrufe r
      LEFT JOIN fiaon_applications ra ON ra.ref = r.ref AND r.person_id IS NULL
      LEFT JOIN fiaon_persons p ON p.id = COALESCE(r.person_id, ra.person_id)
     WHERE (r.status = 'offen' OR r.erledigt_am >= ${MITTERNACHT_SQL})
       AND (p.id IS NULL OR (p.ist_test_am IS NULL AND p.merged_into_person_id IS NULL))`)) as any[];
  const heute = berlinTag(new Date());
  const aus: HeuteEintrag[] = [];
  for (const r of zeilen) {
    const pid = zahl(r.person_id);
    const erledigt = r.status !== "offen";
    if (!erledigt && r.gesperrt === true) continue; // Vertriebssperre: kein Kontakt
    const fristHeute = !!r.frist_bis && berlinTag(r.frist_bis) === heute;
    const vorbei = !!r.frist_bis && new Date(r.frist_bis).getTime() < Date.now();
    aus.push({
      schluessel: `rueckrufwunsch:${r.id}`, quelle: "rueckruf", personId: pid, name: nameOder(r.name, "Rückruf-Wunsch"),
      grund: erledigt ? "Rückruf-Wunsch erledigt" : vorbei ? "Rückruf-Wunsch, Frist vorbei" : fristHeute ? `Rückruf-Wunsch bis ${uhr(r.frist_bis)} Uhr` : "Rückruf-Wunsch beantworten",
      betragCents: null,
      ziel: pid ? akte(pid) : r.ref ? `/agent/kunden?ref=${encodeURIComponent(String(r.ref))}` : "/agent/aufgaben",
      // Die Frist bleibt die Zeit, auch wenn sie vorbei ist: Ein Kunde, der schon zu lange wartet, bleibt oben
      // (Stufe 1, höchstens 14 Tage — versprechenHeuteDran). Vorher: zeit = null → Stufe 6 (Prüfer-Fund 19.10.).
      zeit: iso(r.frist_bis), seit: iso(r.created_at),
      zustaendigId: zahl(r.zustaendig_agent_id) ?? zahl(r.assigned_agent_id), rolle: "vertrieb", erledigt,
    });
  }
  return aus;
}

/** 3 · Aufträge beim Mitarbeiter (offen/in Arbeit; „wartet“ wartet auf eine Antwort der Leitung). */
async function auftraege(lauf: Lauf): Promise<HeuteEintrag[]> {
  const zeilen = (await lauf.unsafe(`
    SELECT t.id, t.titel, t.art, t.person_id, t.ref, t.zustaendig_agent_id, t.status, t.erledigt_art, t.faellig_am::text AS faellig_am,
           COALESCE(t.eingang_am, t.created_at) AS seit, ${NAME_SQL("p")} AS name
      FROM fiaon_betreiber_todos t LEFT JOIN fiaon_persons p ON p.id = t.person_id
     WHERE t.zustaendig_art = 'agent'
       AND (t.status IN ('offen', 'in_arbeit') OR (t.status = 'erledigt' AND t.erledigt_am >= ${MITTERNACHT_SQL}))
       AND (p.id IS NULL OR (p.ist_test_am IS NULL AND p.merged_into_person_id IS NULL))`)) as any[];
  const heute = berlinTag(new Date()) ?? "";
  const aus: HeuteEintrag[] = [];
  for (const t of zeilen) {
    const art = t.art ? String(t.art) : null;
    const frist = artRegel(art).frist === true || (!!art && FRIST_ARTEN_ZUSAETZLICH.includes(art));
    const erledigt = t.status === "erledigt";
    // Noch nicht fällig (und keine Frist) — dann ist es nicht heute dran.
    if (!erledigt && !frist && t.faellig_am && String(t.faellig_am).slice(0, 10) > heute) continue;
    const pid = zahl(t.person_id);
    aus.push({
      schluessel: `auftrag:${t.id}`, quelle: "auftrag", personId: pid,
      name: nameOder(t.name, kurzGrund(String(t.titel ?? "Auftrag"), 5)),
      grund: erledigt ? `${auftragGrund(art, t.titel)} – erledigt` : auftragGrund(art, t.titel),
      betragCents: null,
      ziel: pid ? `/agent/kunden?person=${pid}&auftrag=${t.id}`
        : t.ref ? `/agent/kunden?ref=${encodeURIComponent(String(t.ref))}&auftrag=${t.id}`
          : `/agent/aufgaben?reiter=auftraege&auftrag=${t.id}`,
      zeit: null, seit: iso(t.seit), zustaendigId: zahl(t.zustaendig_agent_id), rolle: "vertrieb", erledigt, frist, art,
      // Von der Automatik geschlossen (erledigt_art 'auto'): erledigt, aber keine eigene Arbeit.
      vonAllein: erledigt && t.erledigt_art === "auto",
    });
  }
  return aus;
}

/**
 * 4 · Inkasso: offene Raten bis heute fällig, eine Zeile je Kunde.
 *
 * Dieselben Raten wie die Inkasso-Liste (arbeitsliste in fiaon-inkasso.ts): das SICHTFELD (nur geschuldete Raten,
 * E-391/E-394) und die Wiedervorlage (eine Zusage für morgen nimmt die Rate heute vom Tisch). Aber OHNE Grenze und
 * gleich je Kunde gezählt — vorher las die Liste je Betreuer höchstens 200 Raten, sortiert „älteste zuerst“; bei mehr
 * fielen still genau die frischen weg (Prüfer-Fund 19.10., gemessen: #10 hat schon 137). Zusammengeführte Kunden
 * zählen beim Gewinner.
 */
async function inkasso(lauf: Lauf): Promise<HeuteEintrag[]> {
  const { SICHTFELD } = await import("./fiaon-inkasso");
  const zeilen = (await lauf.unsafe(`
    SELECT p.id AS person_id, MIN(a.ref) AS ref, p.assigned_agent_id, ${NAME_SQL("p")} AS name,
           MIN(COALESCE(NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)), ''), a.contact_name)) AS name_bestellung,
           COUNT(*)::int AS anzahl, SUM(r.betrag_cents)::bigint AS summe,
           MIN(${HEUTE_SQL} - r.faellig_am)::int AS juengste_tage,
           MAX(r.faellig_am)::text AS juengste_faellig,
           BOOL_AND(r.faellig_am >= ${HEUTE_SQL}) AS nur_heute
      FROM fiaon_abo_raten r
      JOIN fiaon_applications a ON a.ref = r.ref
      LEFT JOIN fiaon_persons p0 ON p0.id = a.person_id
      LEFT JOIN fiaon_persons p ON p.id = COALESCE(p0.merged_into_person_id, p0.id)
     WHERE ${SICHTFELD}
       AND r.faellig_am <= ${HEUTE_SQL}
       AND (r.inkasso_wiedervorlage IS NULL OR r.inkasso_wiedervorlage <= ${HEUTE_SQL})
     GROUP BY p.id, (CASE WHEN p.id IS NULL THEN a.ref END)`)) as any[];
  const aus: HeuteEintrag[] = [];
  for (const g of zeilen) {
    const pid = zahl(g.person_id);
    const juengste = Math.max(0, Number(g.juengste_tage) || 0);
    const summe = Number(g.summe || 0);
    aus.push({
      schluessel: pid ? `inkasso:p:${pid}` : `inkasso:ref:${g.ref}`, quelle: "inkasso", personId: pid,
      name: nameOder(g.name ?? g.name_bestellung, "Kunde"),
      grund: rateGrund(juengste, Number(g.anzahl) || 1), betragCents: summe || null,
      ziel: pid ? `/agent/inkasso?person=${pid}${g.nur_heute === true ? "&frist=heute" : ""}` : "/agent/inkasso",
      zeit: null, seit: g.juengste_faellig ? iso(String(g.juengste_faellig)) : null,
      zustaendigId: zahl(g.assigned_agent_id), rolle: "inkasso", erledigt: false, tageFaellig: juengste,
    });
  }
  // Erledigt heute: eine fällige Rate wurde heute bezahlt oder bearbeitet (Ergebnis im Raten-Protokoll).
  const fertig = (await lauf.unsafe(`
    SELECT a.person_id, p.assigned_agent_id, ${NAME_SQL("p")} AS name, COUNT(*)::int AS anzahl, SUM(r.betrag_cents)::bigint AS summe,
           BOOL_OR(r.status = 'bezahlt') AS bezahlt,
           (SELECT w.agent_id FROM fiaon_raten_arbeit w JOIN fiaon_abo_raten rw ON rw.id = w.rate_id
              JOIN fiaon_applications aw ON aw.ref = rw.ref
             WHERE aw.person_id = a.person_id AND w.created_at >= ${MITTERNACHT_SQL}
             ORDER BY w.created_at DESC LIMIT 1) AS bearbeiter
      FROM fiaon_abo_raten r
      JOIN fiaon_applications a ON a.ref = r.ref
      JOIN fiaon_persons p ON p.id = a.person_id
     WHERE r.faellig_am <= ${HEUTE_SQL} AND r.storniert_am IS NULL
       AND a.payment_status = 'paid' AND a.merged_into IS NULL AND p.ist_test_am IS NULL AND p.merged_into_person_id IS NULL
       AND ((r.status = 'bezahlt' AND r.bezahlt_am >= ${MITTERNACHT_SQL})
            OR EXISTS (SELECT 1 FROM fiaon_raten_arbeit w WHERE w.rate_id = r.id AND w.created_at >= ${MITTERNACHT_SQL}))
     GROUP BY a.person_id, p.assigned_agent_id, name`)) as any[];
  for (const f of fertig) {
    const pid = Number(f.person_id);
    aus.push({
      schluessel: `inkasso-erledigt:${pid}`, quelle: "inkasso", personId: pid, name: nameOder(f.name, `Kunde #${pid}`),
      grund: f.bezahlt ? (Number(f.anzahl) > 1 ? "Raten bezahlt" : "Rate bezahlt") : "Rate heute bearbeitet",
      betragCents: zahl(f.summe), ziel: `/agent/inkasso?person=${pid}`, zeit: null, seit: null,
      zustaendigId: zahl(f.assigned_agent_id) ?? zahl(f.bearbeiter), rolle: "inkasso", erledigt: true, tageFaellig: null,
      // Per Bank bezahlt, ohne dass heute jemand die Rate bearbeitet hat: gute Nachricht, keine eigene Arbeit.
      vonAllein: f.bearbeiter == null,
    });
  }
  return aus;
}

/** 5 · Zahlung gemeldet, nicht bestätigt (höchstens 14 Tage; ältere folgen der 14-Tage-Regel). */
async function zahlungGemeldet(lauf: Lauf): Promise<HeuteEintrag[]> {
  const { globalKundeSql, globalKundeBereit } = await import("./fiaon-global-kunde");
  await globalKundeBereit();
  // Liegt schon ein passender, ungebuchter Eingang im Bankbuch, gehört der Fall der Buchung — nicht ans Telefon.
  let eingang = new Set<number>();
  try {
    const { eingangOffenSql } = await import("./fiaon-zahlung-unverbucht");
    eingang = new Set(((await lauf.unsafe(eingangOffenSql())) as any[]).map((z) => Number(z.person_id)));
  } catch (e) { console.error("[HEUTE-DRAN] Bankabgleich nicht lesbar:", String(e).slice(0, 160)); }
  const zeilen = (await lauf.unsafe(`
    SELECT DISTINCT ON (p.id) p.id AS person_id, p.assigned_agent_id, ${NAME_SQL("p")} AS name,
           a.claimed_paid_at, a.amount_due, a.payment_status,
           (a.payment_status = 'paid') AS bezahlt, ${HEUTE_KONTAKT_SQL("p.id")} AS kontakt_heute
      FROM fiaon_applications a JOIN fiaon_persons p ON p.id = a.person_id
     WHERE a.claimed_paid_at >= NOW() - INTERVAL '${MELDUNG_HOECHSTENS_TAGE} days'
       AND a.merged_into IS NULL AND a.archived_at IS NULL AND a.cancelled_at IS NULL
       AND (a.payment_status = 'claimed_paid'
            OR (a.payment_status = 'paid' AND COALESCE(a.paid_at, a.completed_at) >= ${MITTERNACHT_SQL}))
       AND p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL AND NOT COALESCE(p.is_blocked, FALSE)
       AND NOT ${globalKundeSql("p.id")}
     ORDER BY p.id, (a.payment_status = 'claimed_paid') DESC, a.claimed_paid_at DESC`)) as any[];
  const aus: HeuteEintrag[] = [];
  for (const z of zeilen) {
    const pid = Number(z.person_id);
    const erledigt = z.bezahlt === true || z.kontakt_heute === true;
    if (!erledigt && eingang.has(pid)) continue;
    const stunden = (Date.now() - new Date(z.claimed_paid_at).getTime()) / 3_600_000;
    const betrag = zahl(z.amount_due);
    aus.push({
      schluessel: `zahlung:${pid}`, quelle: "zahlung", personId: pid, name: nameOder(z.name, `Kunde #${pid}`),
      grund: z.bezahlt ? "Zahlung eingegangen" : z.kontakt_heute ? "Zahlung gemeldet – heute angerufen"
        : stunden <= MELDUNG_FRISCH_STUNDEN ? "Zahlung gemeldet – Kunde anrufen" : "Zahlung gemeldet, nicht da – klären",
      betragCents: betrag != null && betrag > 0 ? Math.round(betrag * 100) : null,
      ziel: akte(pid), zeit: null, seit: iso(z.claimed_paid_at), zustaendigId: zahl(z.assigned_agent_id), rolle: "vertrieb", erledigt,
      // Geld eingegangen, ohne heutiges Gespräch: kam von allein (Bank), frisst keinen Platz.
      vonAllein: z.bezahlt === true && z.kontakt_heute !== true,
    });
  }
  return aus;
}

/** 6 · KYC offen — nur bei laufenden Verträgen; „erledigt“ = heute geprüft (Akte › Unterlagen › geprüft). */
async function kyc(lauf: Lauf): Promise<HeuteEintrag[]> {
  const { globalKundeSql, globalKundeBereit } = await import("./fiaon-global-kunde");
  await globalKundeBereit();
  const zeilen = (await lauf.unsafe(`
    SELECT DISTINCT ON (p.id) p.id AS person_id, p.assigned_agent_id, ${NAME_SQL("p")} AS name, a.documents_uploaded_at,
           EXISTS (SELECT 1 FROM fiaon_dokumente d WHERE d.person_id = p.id AND d.art = 'unterlage'
                     AND d.entfernt_am IS NULL AND d.geloescht_am IS NULL AND d.geprueft_am IS NULL) AS ungeprueft,
           EXISTS (SELECT 1 FROM fiaon_dokumente d WHERE d.person_id = p.id AND d.art = 'unterlage'
                     AND d.entfernt_am IS NULL AND d.geloescht_am IS NULL) AS hat_unterlagen,
           EXISTS (SELECT 1 FROM fiaon_dokumente d WHERE d.person_id = p.id AND d.art = 'unterlage'
                     AND d.geprueft_am >= ${MITTERNACHT_SQL}) AS heute_geprueft,
           (SELECT d.geprueft_von_agent_id FROM fiaon_dokumente d WHERE d.person_id = p.id AND d.art = 'unterlage'
                     AND d.geprueft_am >= ${MITTERNACHT_SQL} ORDER BY d.geprueft_am DESC LIMIT 1) AS pruefer
      FROM fiaon_applications a JOIN fiaon_persons p ON p.id = a.person_id
     WHERE a.merged_into IS NULL AND a.documents_uploaded_at IS NOT NULL AND COALESCE(a.kyc_status, 'pending') = 'pending'
       AND p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL
       AND EXISTS (SELECT 1 FROM fiaon_applications l WHERE l.person_id = p.id AND ${LAEUFT_UNGEKUENDIGT_SQL("l")})
       AND NOT ${globalKundeSql("p.id")}
     ORDER BY p.id, a.documents_uploaded_at DESC`)) as any[];
  const aus: HeuteEintrag[] = [];
  for (const z of zeilen) {
    const pid = Number(z.person_id);
    const erledigt = z.heute_geprueft === true && z.ungeprueft !== true;
    // Alles geprüft (an einem früheren Tag): Der Mitarbeiter ist fertig, die Freigabe macht die Verwaltung.
    if (!erledigt && z.hat_unterlagen === true && z.ungeprueft !== true) continue;
    aus.push({
      schluessel: `kyc:${pid}`, quelle: "kyc", personId: pid, name: nameOder(z.name, `Kunde #${pid}`),
      grund: erledigt ? "Unterlagen geprüft" : "Ausweis und Unterlagen prüfen", betragCents: null, ziel: akte(pid),
      zeit: null, seit: iso(z.documents_uploaded_at),
      zustaendigId: zahl(z.assigned_agent_id) ?? (erledigt ? zahl(z.pruefer) : null), rolle: "vertrieb", erledigt,
    });
  }
  return aus;
}

/**
 * 7 · Anliegen (fiaon_tickets). Erledigt = heute beantwortet.
 * Integration E-406 Welle 1 (A × C1): Hat MARA geantwortet (beantwortet_durch = 'mara'), ist es erledigt, aber keine
 * eigene Arbeit (`vonAllein`) — es frisst keinen Platz der Tagesmenge. Die Spalte legt C1 beim ersten Gebrauch an
 * (anliegenSchema); to_jsonb liest sie, ohne an ihr zu scheitern, solange sie noch fehlt.
 */
async function anliegen(lauf: Lauf): Promise<HeuteEintrag[]> {
  const zeilen = (await lauf.unsafe(`
    SELECT t.id, t.person_id, t.agent_id, t.betreff, t.status, t.beantwortet_am, t.beantwortet_von, t.created_at,
           (to_jsonb(t) ->> 'beantwortet_durch') AS beantwortet_durch,
           p.assigned_agent_id, ${NAME_SQL("p")} AS name
      FROM fiaon_tickets t LEFT JOIN fiaon_persons p ON p.id = t.person_id
     WHERE (t.status = 'offen' OR t.beantwortet_am >= ${MITTERNACHT_SQL})
       AND (p.id IS NULL OR (p.ist_test_am IS NULL AND p.merged_into_person_id IS NULL))`)) as any[];
  return zeilen.map((t) => {
    const erledigt = !!t.beantwortet_am && berlinTag(t.beantwortet_am) === berlinTag(new Date());
    const vonMara = erledigt && t.beantwortet_durch === "mara";
    return {
      schluessel: `anliegen:${t.id}`, quelle: "anliegen", personId: zahl(t.person_id), name: nameOder(t.name, "Anliegen"),
      grund: vonMara ? "Anliegen: Mara hat geantwortet" : erledigt ? "Anliegen beantwortet" : kurzGrund(`Anliegen: ${String(t.betreff ?? "").trim() || "beantworten"}`),
      betragCents: null, ziel: `/agent/anliegen?ticket=${t.id}`, zeit: null, seit: iso(t.created_at),
      zustaendigId: (erledigt ? zahl(t.beantwortet_von) : null) ?? zahl(t.agent_id) ?? zahl(t.assigned_agent_id),
      rolle: "vertrieb", erledigt, vonAllein: vonMara,
    } satisfies HeuteEintrag;
  });
}

const HITZE_GRUND: Record<string, string> = {
  zahlung_gemeldet: "Zahlung gemeldet – anrufen",
  antrag: "Antrag offen – anrufen",
  zusage: "Zahlungszusage fällig – anrufen",
  termin: "Termin heute",
  rueckruf: "Rückruf fällig",
  rate: "Rate fällig – anrufen",
  abbruch: "Antrag abgebrochen – nachfassen",
  lead: "Neuer Kontakt – erster Anruf",
};

/** 8 · Die Hitze-Liste (Pipeline, E-162/E-251) je Mitarbeiter — dieselben Karten, ohne Pool-Nachschub. */
async function hitze(lauf: Lauf, teamIds: number[]): Promise<HeuteEintrag[]> {
  const { arbeitslisteLesen } = await import("../routes/fiaon-office-vertrieb");
  const aus: HeuteEintrag[] = [];
  for (const id of teamIds) {
    const liste = await arbeitslisteLesen(id, lauf);
    for (const s of [...liste.slots, ...liste.wieder]) {
      const k = s.kunde ?? {};
      const pid = zahl(k.personId);
      if (!pid) continue;
      const h = k.hitze ?? {};
      const tier = Number(k.tier);
      // Stufe 0 mit fälliger Rate steht in der Pipeline als „Rate fällig“ — dafür ist die Inkasso-Quelle da (frisch
      // zuerst, Altbestand unten, Wiedervorlage beachtet). Hier nur Stufe A/B/C (Prüfstand-Fund 19.10.).
      if (!(tier === 1 || tier === 2 || tier === 3) || h.art === "rate") continue;
      const seitMin = zahl(h.seitMin);
      const frisch = (tier === 1 || tier === 2)
        && (h.sofort === true || ((h.art === "zahlung_gemeldet" || h.art === "antrag") && seitMin != null && seitMin <= MELDUNG_FRISCH_STUNDEN * 60));
      const grund = k.wiederGrund === "nicht_erreicht" ? "Nicht erreicht – nochmal anrufen"
        : h.sofort === true && tier === 2 ? "Neuer Antrag – jetzt anrufen"
          : HITZE_GRUND[String(h.art)] ?? "Anrufen";
      aus.push({
        schluessel: `hitze:${pid}`, quelle: "hitze", personId: pid, name: nameOder(k.name, `Kunde #${pid}`), grund,
        betragCents: null, ziel: akte(pid), zeit: null,
        seit: seitMin != null ? new Date(Date.now() - seitMin * 60_000).toISOString() : null,
        zustaendigId: id, rolle: "vertrieb", erledigt: false, hitzeFrisch: frisch,
      });
    }
  }
  // Erledigt heute: frische A/B-Kunden (Antrag oder Zahlungsmeldung ≤ 72 Std.), mit denen heute gesprochen wurde.
  if (teamIds.length) {
    const fertig = (await lauf.unsafe(`
      SELECT p.id, p.assigned_agent_id, ${NAME_SQL("p")} AS name
        FROM fiaon_persons p
       WHERE p.assigned_agent_id = ANY($1::int[]) AND p.priority_tier IN (1, 2)
         AND p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL AND NOT COALESCE(p.is_blocked, FALSE)
         AND (EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL AND NOT COALESCE(a.ist_entwurf, FALSE)
                        AND COALESCE(a.submitted_at, a.created_at) > NOW() - INTERVAL '${MELDUNG_FRISCH_STUNDEN} hours')
              OR EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
                        AND a.claimed_paid_at > NOW() - INTERVAL '${MELDUNG_FRISCH_STUNDEN} hours'))
         AND ${HEUTE_KONTAKT_SQL("p.id")}`, [teamIds])) as any[];
    for (const f of fertig) {
      const pid = Number(f.id);
      aus.push({
        schluessel: `hitze-erledigt:${pid}`, quelle: "hitze", personId: pid, name: nameOder(f.name, `Kunde #${pid}`),
        grund: "Heute angerufen", betragCents: null, ziel: akte(pid), zeit: null, seit: null,
        zustaendigId: zahl(f.assigned_agent_id), rolle: "vertrieb", erledigt: true, hitzeFrisch: true,
      });
    }
  }
  return aus;
}

/** 9 · Bezahlte Bonitätsauswertungen, die warten (bonitaetArbeitsliste, E-364): Unterlagen da → starten; fehlen → holen. */
async function bonitaet(lauf: Lauf): Promise<HeuteEintrag[]> {
  const { bonitaetArbeitsliste } = await import("./fiaon-bonitaet-arbeitsliste");
  const { liste } = await bonitaetArbeitsliste(lauf);
  const warten = liste.filter((z) => z.grundlage === "bezahlt" && (z.stand === "bereit" || z.stand === "fehlt"));
  const ids = warten.map((z) => z.personId);
  const betreuer = new Map<number, number | null>();
  if (ids.length) for (const p of (await lauf`SELECT id, assigned_agent_id FROM fiaon_persons WHERE id = ANY(${ids}::int[])`) as any[]) betreuer.set(Number(p.id), zahl(p.assigned_agent_id));
  const aus: HeuteEintrag[] = warten.map((z) => ({
    schluessel: `bonitaet:${z.personId}`, quelle: "bonitaet", personId: z.personId, name: z.name,
    grund: z.stand === "bereit" ? "Auswertung starten – Unterlagen da" : "Unterlagen für Auswertung holen",
    betragCents: null, ziel: akte(z.personId), zeit: null, seit: z.bezahltAm,
    zustaendigId: betreuer.get(z.personId) ?? null, rolle: "vertrieb", erledigt: false,
  }));
  // Erledigt heute: für einen Käufer der Auskunft wurde heute eine Auswertung gestartet.
  const fertig = (await lauf.unsafe(`
    SELECT DISTINCT ON (f.person_id) f.person_id, f.erstellt_von_id, p.assigned_agent_id, ${NAME_SQL("p")} AS name
      FROM fiaon_finanzauswertungen f JOIN fiaon_persons p ON p.id = f.person_id
     WHERE f.erstellt_am >= ${MITTERNACHT_SQL} AND f.status IN ('laeuft', 'entwurf', 'freigegeben')
       AND p.ist_test_am IS NULL AND p.merged_into_person_id IS NULL
       AND EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = f.person_id AND a.merged_into IS NULL
                     AND a.payment_status = 'paid' AND ${produktkategorieSql("a")} = 'auskunft')
     ORDER BY f.person_id, f.erstellt_am DESC`)) as any[];
  for (const f of fertig) {
    const pid = Number(f.person_id);
    aus.push({
      schluessel: `bonitaet-erledigt:${pid}`, quelle: "bonitaet", personId: pid, name: nameOder(f.name, `Kunde #${pid}`),
      grund: "Auswertung gestartet", betragCents: null, ziel: akte(pid), zeit: null, seit: null,
      zustaendigId: zahl(f.assigned_agent_id) ?? zahl(f.erstellt_von_id), rolle: "vertrieb", erledigt: true,
    });
  }
  return aus;
}

export const QUELLEN_TEXT: Record<string, string> = {
  termine: "Termine", rueckrufe: "Rückrufe", wuensche: "Rückruf-Wünsche", auftraege: "Aufträge", inkasso: "Inkasso",
  zahlung: "Zahlung gemeldet", kyc: "KYC", anliegen: "Anliegen", hitze: "Pipeline", bonitaet: "Bonität",
};

/** Alle Einträge aus allen Quellen. Eine Quelle, die scheitert, fehlt sichtbar — die anderen stehen trotzdem. */
export async function eintraegeLesen(lauf: Lauf, stand: TeamStand): Promise<{ eintraege: HeuteEintrag[]; fehlend: string[] }> {
  const teamIds = stand.team.map((m) => m.id);
  const quellen: [string, () => Promise<HeuteEintrag[]>][] = [
    ["termine", () => termine(lauf)],
    ["rueckrufe", () => rueckrufeVereinbart(lauf)],
    ["wuensche", () => rueckrufWuensche(lauf)],
    ["auftraege", () => auftraege(lauf)],
    ["inkasso", () => inkasso(lauf)],
    ["zahlung", () => zahlungGemeldet(lauf)],
    ["kyc", () => kyc(lauf)],
    ["anliegen", () => anliegen(lauf)],
    ["hitze", () => hitze(lauf, teamIds)],
    ["bonitaet", () => bonitaet(lauf)],
  ];
  const eintraege: HeuteEintrag[] = [];
  const fehlend: string[] = [];
  for (const [name, holen] of quellen) {
    try {
      for (const e of await holen()) {
        // Jedes Ziel ist eine Stelle im Office — nie das Chefbüro (Regel in shared, hier durchgesetzt).
        eintraege.push(zielErlaubt(e.ziel) ? e : { ...e, ziel: e.personId ? akte(e.personId) : "/agent/start" });
      }
    } catch (err) {
      console.error(`[HEUTE-DRAN] Quelle ${name} nicht lesbar:`, String((err as Error)?.message ?? err).slice(0, 200));
      fehlend.push(QUELLEN_TEXT[name] ?? name);
    }
  }
  return { eintraege, fehlend };
}

// ── Der Plan, zwischengespeichert ──────────────────────────────────────────

export interface PlanStand {
  stand: string;
  tag: string;
  plan: TeamPlan;
  fehlend: string[];
}

let zwischen: { bis: number; tag: string; wert: PlanStand } | null = null;
let laufend: Promise<PlanStand> | null = null;

/** Den Plan neu rechnen (ohne Zwischenspeicher) — für Prüfstände mit eigener Verbindung. */
export async function planRechnen(lauf: Lauf = sqlPool, jetzt: Date = new Date()): Promise<PlanStand> {
  const stand = await teamLesen(lauf, jetzt);
  const { eintraege, fehlend } = await eintraegeLesen(lauf, stand);
  const plan = planen(eintraege, stand.team, { jetzt, betreiberIds: stand.betreiberIds });
  return { stand: jetzt.toISOString(), tag: berlinTag(jetzt) ?? "", plan, fehlend };
}

/**
 * Der Plan für alle — höchstens PLAN_GUELTIG_MS alt; gleichzeitige Anfragen teilen sich eine Rechnung.
 * Ist der Stand von heute abgelaufen, kommt er sofort zurück und der neue wird im Hintergrund gerechnet —
 * niemand wartet auf dem Schreibtisch. Scheitert die neue Rechnung, bleibt der letzte Stand von heute.
 */
export async function heuteDranPlan(): Promise<PlanStand> {
  const jetzt = new Date();
  const tag = berlinTag(jetzt) ?? "";
  const vorhanden = zwischen && zwischen.tag === tag ? zwischen : null;
  if (vorhanden && vorhanden.bis > jetzt.getTime()) return vorhanden.wert;
  if (!laufend) {
    laufend = planRechnen(sqlPool, jetzt)
      .then((wert) => { zwischen = { bis: Date.now() + PLAN_GUELTIG_MS, tag, wert }; return wert; })
      .finally(() => { laufend = null; });
  }
  if (vorhanden) {
    laufend.catch((e) => console.error("[HEUTE-DRAN] Neuberechnung gescheitert, der letzte Stand bleibt:", String(e).slice(0, 200)));
    return vorhanden.wert;
  }
  return laufend;
}

/** Für Prüfstände: den Zwischenspeicher leeren. */
export function heuteDranVergessen(): void { zwischen = null; }

/** Die Liste EINES Mitarbeiters — null, wenn er heute nicht zum Team gehört (Testkonto, Geschäftsführung, gesperrt). */
export function personAusPlan(stand: PlanStand, agentId: number): PersonPlan | null {
  return stand.plan.personen.find((p) => p.agentId === Number(agentId)) ?? null;
}
