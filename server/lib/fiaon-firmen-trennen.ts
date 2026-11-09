// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — FALSCH ZUSAMMENGELEGTE FIRMEN-KARTEN TRENNEN: DER LAUF firmen_trennen (E-487, 09.11.2026)
//
// ── WARUM ─────────────────────────────────────────────────────────────────────
// Vor dem Platzhalter-Fix legte globalLeadAufnehmen fremde Menschen über einen Platzhalter im Firmenfeld („Selbständig“, „GmbH“ …)
// auf EINE Karte. Ihre Aufträge öffneten die Karte eines anderen Menschen — mit dessen Nummer, Notizen und „bitte nicht anrufen“;
// ihre Dossiers liefen als „Weitere Anfrage“ in dessen Mail-Faden. Der Eingang ist repariert; dieser Lauf trennt, was schon
// zusammengelegt ist — als Plattform-Code, denn in Produktion schreibt nie ein Skript von außen.
//
// ── WIE ───────────────────────────────────────────────────────────────────────
//   · Die Regel und der Plan stehen rein in shared/fiaon-firmen-trennen.ts (Prüfstand A rechnet mit demselben Planer):
//     nur Platzhalter-Karten, fremd nur bei ALLEM verschieden, gruppiert nach Person, Ziel = vorhandene Karte der Person oder neu.
//   · Der Lauf liest einen Stand aller Verweise, plant, und führt JE GRUPPE EINE Transaktion aus: SET LOCAL lock_timeout = '3s',
//     Kartenkopf FOR UPDATE (frisch geprüft), Protokollzeile INSERT … ON CONFLICT (schluessel) DO NOTHING (kommt nichts zurück,
//     ist die Gruppe erledigt), dann umziehen. Jede Anweisung, die einen Verweis umzieht, trägt „AND firma_id = ${quelle}“
//     (beim Auftrag: der Link der Quelle) — nie wird eine Zeile einer dritten Karte angefasst, und ein zweiter Lauf ändert
//     nichts. Verweise, die auf KEINE Karte zeigen (Lead-Weg/Takt/WhatsApp mit leerer firma_id), werden nur gefüllt
//     („AND firma_id IS NULL“) — sonst fände der neue Kopf seine eigene Anfrage nur über die Mail.
//   · Was umzieht: Verlaufszeilen mit eindeutigem Anfrage-Bezug, Dossiers (mit neuem Faden-Stamm, ohne die Message-IDs des
//     fremden Fadens, firmaId/Cockpit-Link im gespeicherten Dossier), Lead-Weg, Takt, Gespräche, WhatsApp, Daniels Aufträge
//     (Link, Titel mit dem Namen statt des Platzhalters, Hinweis im Text), die Notiz-Blöcke des Eingangs. Was bleibt: alles ohne
//     Anfrage-Bezug (Anrufe, Hand-Notizen, Gesprächs-Mails) — im Zweifel beim Eigentümer, mit Vermerk.
//   · Danach je Karte eine Zeile „Getrennt: …“ im Verlauf; die Protokollzeile in fiaon_firmen_trennung hält fest, was wohin
//     zog (bewegt) und wie der Kopf vorher war (vorher) — der Rückweg.
//   · Schalter fiaon_settings „firmen_trennen“: an (Vorgabe) | trocken (nur rechnen, Zahlen in die Lauf-Historie) | aus.
//   · Einmal 4 Minuten nach dem Deploy (die Reparatur), danach stündlich als Sicherheitsnetz (server/routes.ts). Die
//     Historienzeile mit Zahlen schreibt der Lauf selbst (stillerLauf kennt keine Meldung): bei Arbeit, sonst alle 6 Stunden.
//
// Schema: dieselbe DDL nur hier (firmenTrennungSchema) — im Lauf, mit lock_timeout, nie im Eingang. Keine Mail, keine
// WhatsApp, keine KI. Repo öffentlich: keine Kundendaten, keine Karten- oder Anfragenummern im Code.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { berlinToday } from "./fiaon-time";
import { laufMeldung } from "./fiaon-crons";
import {
  FIRMEN_TRENNEN_LAUF, FIRMEN_TRENNEN_SCHALTER, trennModusLesen, trennKandidat, zusammengehoerig, zielKarteWaehlen, kartenPlanen, notizTrennen,
  paketwunschVonGruppe, getrenntSatzQuelle, getrenntSatzZiel, auftragHinweis, auftragTitelNeu, vermerkSatz, cockpitLink, auftragAnfrage,
  anfrageNummern, mailForm, nummer9,
  type TrennModus, type TrennStand, type KartenPlan, type KartenPlanGruppe, type TrennKontakt, type KartenKopf,
} from "@shared/fiaon-firmen-trennen";
import { leadAnzeigeName, paketwunschAus } from "@shared/fiaon-global-lead";

type Lauf = typeof sqlPool;

/** Die Regel im Protokoll (regel-Spalte) — ändert sich die Regel, bekommt sie einen neuen Namen. */
const REGEL = "e487-platzhalter-v1";

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMA — Protokoll-Tabelle und Spalte getrennt_aus (nur im Lauf, mit lock_timeout; erst im Katalog nachsehen)
// ═══════════════════════════════════════════════════════════════════════════
let schemaBereit: Promise<boolean> | null = null;

/** false = es gibt (noch) keine Firmen-Karten — dann hat der Lauf nichts zu tun. */
export function firmenTrennungSchema(lauf: Lauf = sqlPool): Promise<boolean> {
  if (!schemaBereit) {
    schemaBereit = (async () => {
      const [k] = (await lauf`
        SELECT to_regclass('fiaon_firmen_leads') IS NOT NULL AS karten,
               to_regclass('fiaon_firmen_log') IS NOT NULL AS verlauf,
               to_regclass('fiaon_firmen_trennung') IS NOT NULL AS protokoll,
               EXISTS (SELECT 1 FROM pg_attribute
                        WHERE attrelid = to_regclass('fiaon_firmen_leads') AND attname = 'getrennt_aus' AND NOT attisdropped) AS spalte`) as any[];
      if (!k?.karten || !k?.verlauf) return false;
      if (!k.protokoll || !k.spalte) {
        // Lieber nach 3 s aufgeben (nächster Lauf in einer Stunde) als sich hinter eine lange Lesung zu stellen und das Cockpit
        // anzuhalten (Muster ensureFirmen).
        await lauf.begin(async (tx: any) => {
          await tx`SET LOCAL lock_timeout = '3s'`;
          await tx`
            CREATE TABLE IF NOT EXISTS fiaon_firmen_trennung (
              id SERIAL PRIMARY KEY,
              schluessel TEXT NOT NULL UNIQUE,
              quell_firma_id INTEGER NOT NULL,
              ziel_firma_id INTEGER,
              anfrage_ids INTEGER[] NOT NULL,
              regel TEXT NOT NULL,
              bewegt JSONB,
              vorher JSONB,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`;
          await tx`CREATE INDEX IF NOT EXISTS fiaon_firmen_trennung_quelle_idx ON fiaon_firmen_trennung (quell_firma_id)`;
          await tx`ALTER TABLE fiaon_firmen_leads ADD COLUMN IF NOT EXISTS getrennt_aus INTEGER`;
        });
      }
      return true;
    })().then((ok) => { if (!ok) schemaBereit = null; return ok; }, (e) => { schemaBereit = null; throw e; });
  }
  return schemaBereit;
}

/** Der Schalter „firmen_trennen“ (an | trocken | aus; leer = an). */
export async function trennModus(lauf: Lauf = sqlPool): Promise<TrennModus> {
  const [r] = (await lauf`SELECT value FROM fiaon_settings WHERE key = ${FIRMEN_TRENNEN_SCHALTER}`) as any[];
  return trennModusLesen(r?.value);
}

// ═══════════════════════════════════════════════════════════════════════════
// DER LESE-STAND — Karten mit Global-Bezug, und zu den Platzhalter-Karten alle Verweise und ihre Anfragen
// ═══════════════════════════════════════════════════════════════════════════
interface TabellenDa { dossier: boolean; weg: boolean; takt: boolean; gespraech: boolean; wa: boolean; auftraege: boolean; anfragen: boolean }

async function tabellenDa(lauf: Lauf): Promise<TabellenDa> {
  const [t] = (await lauf`
    SELECT to_regclass('fiaon_lead_dossier') IS NOT NULL AS dossier, to_regclass('fiaon_lead_weg') IS NOT NULL AS weg,
           to_regclass('fiaon_lead_takt') IS NOT NULL AS takt, to_regclass('fiaon_lead_gespraech') IS NOT NULL AS gespraech,
           to_regclass('fiaon_wa_global') IS NOT NULL AS wa, to_regclass('fiaon_betreiber_todos') IS NOT NULL AS auftraege,
           to_regclass('fiaon_anfragen') IS NOT NULL AS anfragen`) as any[];
  return {
    dossier: !!t?.dossier, weg: !!t?.weg, takt: !!t?.takt, gespraech: !!t?.gespraech, wa: !!t?.wa, auftraege: !!t?.auftraege, anfragen: !!t?.anfragen,
  };
}

const n = (v: unknown): number => Number(v);
const nOderNull = (v: unknown): number | null => { const x = Number(v); return v != null && Number.isInteger(x) && x > 0 ? x : null; };
const textOderNull = (v: unknown): string | null => (v == null ? null : String(v));
/** postgres.js mag keine leeren Listen in ANY(…) — eine Kennung, die es nie gibt, statt eines leeren Arrays. */
const nieLeer = (ids: readonly number[]): number[] => (ids.length ? Array.from(ids) : [0]);
const nieLeerText = (werte: readonly string[]): string[] => (werte.length ? Array.from(werte) : ["-"]);

export async function standLesen(lauf: Lauf = sqlPool): Promise<{ stand: TrennStand; da: TabellenDa }> {
  const da = await tabellenDa(lauf);
  const karten = ((await lauf`
    SELECT id, firma, ansprechpartner, email, telefon, person_id, notiz, paketwunsch, zustaendig_agent_id
      FROM fiaon_firmen_leads WHERE global_am IS NOT NULL OR quelle = 'global'`) as any[]).map((k) => ({
    id: n(k.id), firma: textOderNull(k.firma), ansprechpartner: textOderNull(k.ansprechpartner), email: textOderNull(k.email),
    telefon: textOderNull(k.telefon), person_id: nOderNull(k.person_id), notiz: textOderNull(k.notiz), paketwunsch: textOderNull(k.paketwunsch),
    zustaendig_agent_id: nOderNull(k.zustaendig_agent_id),
  }));
  const leer: TrennStand = { karten, anfragen: [], dossiers: [], wege: [], takte: [], gespraeche: [], wa: [], auftraege: [], logs: [] };
  const kid = karten.filter((k) => trennKandidat(k.firma, k.ansprechpartner)).map((k) => k.id);
  if (!kid.length) return { stand: leer, da };
  const links = kid.map(cockpitLink);

  // 1. Welche Anfragen hängen an den Kandidaten? (dieselben Verweise wie kartenPlanen)
  const anf = new Set<number>();
  const merk = (v: unknown) => { const x = nOderNull(v); if (x) anf.add(x); };
  if (da.dossier) for (const r of (await lauf`SELECT anlass_id FROM fiaon_lead_dossier WHERE anlass = 'anfrage' AND firma_id = ANY(${kid})`) as any[]) merk(r.anlass_id);
  if (da.weg) for (const r of (await lauf`SELECT anfrage_id FROM fiaon_lead_weg WHERE firma_id = ANY(${kid})`) as any[]) merk(r.anfrage_id);
  if (da.takt) for (const r of (await lauf`SELECT anfrage_id FROM fiaon_lead_takt WHERE firma_id = ANY(${kid})`) as any[]) merk(r.anfrage_id);
  if (da.gespraech) for (const r of (await lauf`SELECT anfrage_id FROM fiaon_lead_gespraech WHERE firma_id = ANY(${kid}) AND anfrage_id IS NOT NULL`) as any[]) merk(r.anfrage_id);
  if (da.wa) for (const r of (await lauf`SELECT anfrage_id FROM fiaon_wa_global WHERE firma_id = ANY(${kid}) AND anfrage_id IS NOT NULL`) as any[]) merk(r.anfrage_id);
  if (da.auftraege) for (const r of (await lauf`SELECT schluessel FROM fiaon_betreiber_todos WHERE link = ANY(${links})`) as any[]) merk(auftragAnfrage(r.schluessel));
  const logs = ((await lauf`
    SELECT id, firma_id, art, ergebnis, notiz, created_at, agent_name FROM fiaon_firmen_log
     WHERE firma_id = ANY(${kid}) AND art = 'global'`) as any[]).map((l) => ({
    id: n(l.id), firma_id: n(l.firma_id), art: String(l.art), ergebnis: textOderNull(l.ergebnis), notiz: textOderNull(l.notiz),
    created_at: l.created_at as Date, agent_name: textOderNull(l.agent_name),
  }));
  for (const l of logs) if (l.ergebnis === "anfrage") anfrageNummern(l.notiz).forEach(merk);
  const anfIds = Array.from(anf);

  // 2. Die Zeilen selbst — an den Kandidaten ODER zu ihren Anfragen (Marken einer Anfrage, deren Verweis noch leer ist).
  const ids = nieLeer(anfIds);
  const anfragen = da.anfragen && anfIds.length ? ((await lauf`
    SELECT id, name, email, telefon, firma, person_id, created_at, land, COALESCE(ist_test, FALSE) AS ist_test, text, zustaendig_agent_id
      FROM fiaon_anfragen WHERE id = ANY(${ids}) AND art = 'global'`) as any[]).map((a) => ({
    id: n(a.id), name: textOderNull(a.name), email: textOderNull(a.email), telefon: textOderNull(a.telefon), firma: textOderNull(a.firma),
    person_id: nOderNull(a.person_id), created_at: a.created_at as Date, land: textOderNull(a.land), ist_test: !!a.ist_test,
    text: textOderNull(a.text), zustaendig_agent_id: nOderNull(a.zustaendig_agent_id),
  })) : [];
  const dossiers = da.dossier ? ((await lauf`
    SELECT id, anlass_id, firma_id, mail_basis_am, mail_ki_am, temperatur, faden_betreff FROM fiaon_lead_dossier
     WHERE anlass = 'anfrage' AND (firma_id = ANY(${kid}) OR anlass_id = ANY(${ids}))`) as any[]).map((d) => ({
    id: n(d.id), anlass_id: n(d.anlass_id), firma_id: nOderNull(d.firma_id), mail_basis_am: d.mail_basis_am as Date | null,
    mail_ki_am: d.mail_ki_am as Date | null, temperatur: textOderNull(d.temperatur), faden_betreff: textOderNull(d.faden_betreff),
  })) : [];
  const wege = da.weg ? ((await lauf`
    SELECT anfrage_id, firma_id, willkommen_am, nachfass_am FROM fiaon_lead_weg WHERE firma_id = ANY(${kid}) OR anfrage_id = ANY(${ids})`) as any[]).map((w) => ({
    anfrage_id: n(w.anfrage_id), firma_id: nOderNull(w.firma_id), willkommen_am: w.willkommen_am as Date | null, nachfass_am: w.nachfass_am as Date | null,
  })) : [];
  const takte = da.takt ? ((await lauf`
    SELECT anfrage_id, firma_id, t1_am, e15_am, e60_am, e120_am, vertretung_am FROM fiaon_lead_takt
     WHERE firma_id = ANY(${kid}) OR anfrage_id = ANY(${ids})`) as any[]).map((t) => ({
    anfrage_id: n(t.anfrage_id), firma_id: nOderNull(t.firma_id), t1_am: t.t1_am as Date | null, e15_am: t.e15_am as Date | null,
    e60_am: t.e60_am as Date | null, e120_am: t.e120_am as Date | null, vertretung_am: t.vertretung_am as Date | null,
  })) : [];
  const gespraeche = da.gespraech ? ((await lauf`
    SELECT termin_id, anfrage_id, firma_id, person_id, created_at, d2_am FROM fiaon_lead_gespraech
     WHERE firma_id = ANY(${kid}) OR anfrage_id = ANY(${ids})`) as any[]).map((g) => ({
    termin_id: n(g.termin_id), anfrage_id: nOderNull(g.anfrage_id), firma_id: nOderNull(g.firma_id), person_id: nOderNull(g.person_id),
    created_at: g.created_at as Date | null, d2_am: g.d2_am as Date | null,
  })) : [];
  const wa = da.wa ? ((await lauf`
    SELECT anfrage_id, firma_id FROM fiaon_wa_global WHERE firma_id = ANY(${kid}) OR anfrage_id = ANY(${ids})`) as any[]).map((x) => ({
    anfrage_id: nOderNull(x.anfrage_id), firma_id: nOderNull(x.firma_id),
  })) : [];
  const schluessel = anfIds.map((a) => `global-anfrage:${a}`);
  const auftraege = da.auftraege ? ((await lauf`
    SELECT id, schluessel, link, zustaendig_agent_id FROM fiaon_betreiber_todos
     WHERE link = ANY(${links}) OR schluessel = ANY(${nieLeerText(schluessel)})`) as any[]).map((a) => ({
    id: n(a.id), schluessel: textOderNull(a.schluessel), link: textOderNull(a.link), zustaendig_agent_id: nOderNull(a.zustaendig_agent_id),
  })) : [];
  return { stand: { karten, anfragen, dossiers, wege, takte, gespraeche, wa, auftraege, logs }, da };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE ZIELSUCHE — eine vorhandene Karte derselben Person (person_id, Mail, 9 Ziffern), nie die Quelle
// ═══════════════════════════════════════════════════════════════════════════
async function zielSuchen(q: any, quelleId: number, g: KartenPlanGruppe, sperren: boolean): Promise<{ id: number; ueber: string } | null> {
  const pids = Array.from(new Set(g.personIds));
  const mails = Array.from(new Set(g.mitglieder.map((m) => mailForm(m.email)).filter(Boolean)));
  const nummern = Array.from(new Set(g.mitglieder.map((m) => nummer9(m.telefon)).filter(Boolean)));
  if (!pids.length && !mails.length && !nummern.length) return null;
  const zeilen = (sperren
    ? await q`
      SELECT id, person_id, email, telefon FROM fiaon_firmen_leads
       WHERE id <> ${quelleId}
         AND ((person_id IS NOT NULL AND person_id = ANY(${nieLeer(pids)}))
           OR (COALESCE(email, '') <> '' AND LOWER(TRIM(email)) = ANY(${nieLeerText(mails)}))
           OR RIGHT(REGEXP_REPLACE(COALESCE(telefon, ''), '\\D', '', 'g'), 9) = ANY(${nieLeerText(nummern)}))
       ORDER BY id LIMIT 20 FOR UPDATE`
    : await q`
      SELECT id, person_id, email, telefon FROM fiaon_firmen_leads
       WHERE id <> ${quelleId}
         AND ((person_id IS NOT NULL AND person_id = ANY(${nieLeer(pids)}))
           OR (COALESCE(email, '') <> '' AND LOWER(TRIM(email)) = ANY(${nieLeerText(mails)}))
           OR RIGHT(REGEXP_REPLACE(COALESCE(telefon, ''), '\\D', '', 'g'), 9) = ANY(${nieLeerText(nummern)}))
       ORDER BY id LIMIT 20`) as any[];
  const koepfe: KartenKopf[] = zeilen.map((z) => ({ id: n(z.id), personId: nOderNull(z.person_id), email: textOderNull(z.email), telefon: textOderNull(z.telefon) }));
  return zielKarteWaehlen(quelleId, g.mitglieder, koepfe);
}

// ═══════════════════════════════════════════════════════════════════════════
// EINE GRUPPE TRENNEN — eine Transaktion
// ═══════════════════════════════════════════════════════════════════════════
export interface TrennZeilen { verlauf: number; dossier: number; auftraege: number; lead: number; notiz: number }
const keineZeilen = (): TrennZeilen => ({ verlauf: 0, dossier: 0, auftraege: 0, lead: 0, notiz: 0 });

interface GruppenErgebnis { status: "getrennt" | "schon" | "uebersprungen"; zielId: number | null; zielNeu: boolean; zeilen: TrennZeilen; vermerk: boolean }

const zahlen = (zeilen: any[], feld: string): number[] => zeilen.map((z) => n(z[feld]));

async function gruppeTrennen(lauf: Lauf, p: KartenPlan, g: KartenPlanGruppe, da: TabellenDa, heute: string): Promise<GruppenErgebnis> {
  const quelle = p.quelleId;
  return await lauf.begin(async (tx: any): Promise<GruppenErgebnis> => {
    await tx`SET LOCAL lock_timeout = '3s'`;
    const nichts: GruppenErgebnis = { status: "uebersprungen", zielId: null, zielNeu: false, zeilen: keineZeilen(), vermerk: false };
    const [q] = (await tx`
      SELECT id, firma, ansprechpartner, email, telefon, person_id, notiz, paketwunsch, global_am
        FROM fiaon_firmen_leads WHERE id = ${quelle} FOR UPDATE`) as any[];
    // Frisch geprüft: noch ein Platzhalter? Gehört ein Gruppen-Eingang inzwischen doch zum Kopf? Dann nicht trennen.
    if (!q || !trennKandidat(q.firma, q.ansprechpartner)) return nichts;
    const kopf: TrennKontakt = { personIds: [nOderNull(q.person_id)], email: textOderNull(q.email), telefon: textOderNull(q.telefon), name: textOderNull(q.ansprechpartner) };
    if (g.mitglieder.some((m) => zusammengehoerig(m, kopf))) return nichts;
    const kopfPerson = nOderNull(q.person_id);
    const firmaRoh = String(q.firma ?? "").trim();

    const [prot] = (await tx`
      INSERT INTO fiaon_firmen_trennung (schluessel, quell_firma_id, anfrage_ids, regel)
      VALUES (${g.schluessel}, ${quelle}, ${g.anfrageIds}::int[], ${REGEL})
      ON CONFLICT (schluessel) DO NOTHING
      RETURNING id`) as any[];
    if (!prot) return { ...nichts, status: "schon" };

    // Die Notiz der Quelle — frisch und gesperrt: welche Blöcke des Eingangs wörtlich dastehen.
    const notiz = notizTrennen(textOderNull(q.notiz), g.blockZeilen);

    // Das Ziel: die vorhandene Karte dieser Person, sonst eine neue — ganz oben in „Jetzt dran“ (Wiedervorlage heute).
    const ziel = await zielSuchen(tx, quelle, g, true);
    let zielId: number;
    let zielNeu = false;
    if (ziel) {
      zielId = ziel.id;
      if (notiz.bloecke.length) {
        await tx`UPDATE fiaon_firmen_leads SET notiz = CONCAT_WS(E'\n', NULLIF(notiz, ''), ${notiz.bloecke.join("\n")}::text), updated_at = NOW() WHERE id = ${zielId}`;
      }
    } else {
      const k = g.kontakt;
      const [neu] = (await tx`
        INSERT INTO fiaon_firmen_leads
          (firma, ansprechpartner, telefon, email, ort, notiz, quelle, status, zustaendig_agent_id, wiedervorlage,
           person_id, paketwunsch, global_am, created_at, updated_at, getrennt_aus)
        VALUES (${k.firma.slice(0, 200)}, ${k.name || null}, ${k.telefon || null}, ${k.email || null}, ${k.land}, ${notiz.bloecke.length ? notiz.bloecke.join("\n") : null},
                'global', 'wiedervorlage', ${g.zustaendigAgentId}::int, ${heute}::date,
                ${k.personId}::int, ${k.paketwunsch}, COALESCE(${k.am}::timestamptz, NOW()), COALESCE(${k.erstAm}::timestamptz, NOW()), NOW(), ${quelle})
        RETURNING id`) as any[];
      zielId = n(neu.id);
      zielNeu = true;
    }

    // ── Umziehen: jede Anweisung nur für Zeilen, die noch an der Quelle hängen ──
    const zeilen = keineZeilen();
    const bewegt: Record<string, unknown> = { zielNeu, ueber: ziel?.ueber ?? null };

    // 1. Verlaufszeilen mit eindeutigem Anfrage-Bezug (geplant nach Kennung).
    const verlauf = g.logIds.length
      ? (await tx`UPDATE fiaon_firmen_log SET firma_id = ${zielId} WHERE id = ANY(${g.logIds}) AND firma_id = ${quelle} RETURNING id`) as any[]
      : [];
    bewegt.verlauf = zahlen(verlauf, "id");
    zeilen.verlauf = verlauf.length;

    // 2. Dossiers: eigene Karte, eigener Faden-Stamm, ohne die Message-IDs des fremden Fadens (sonst hinge die nächste Mail per
    //    In-Reply-To wieder dort), firmaId und Cockpit-Link im gespeicherten Dossier (Nachtrag und Anruf-Karte lesen sie).
    if (da.dossier) {
      const alt = (await tx`
        SELECT id, faden_betreff, mail_basis_id, mail_ki_id, basis->>'cockpitUrl' AS cockpit FROM fiaon_lead_dossier
         WHERE anlass = 'anfrage' AND anlass_id = ANY(${g.anfrageIds}) AND firma_id = ${quelle} FOR UPDATE`) as any[];
      for (const d of alt) {
        const url = d.cockpit ? String(d.cockpit).replace(/([?&]firma=)\d+/, `$1${zielId}`) : null;
        await tx`
          UPDATE fiaon_lead_dossier SET firma_id = ${zielId},
                 faden_betreff = CASE WHEN faden_betreff IS NULL THEN NULL ELSE ${g.fadenStamm}::text END,
                 mail_basis_id = NULL, mail_ki_id = NULL,
                 basis = CASE WHEN jsonb_typeof(basis) = 'object'
                              THEN jsonb_set(CASE WHEN ${url}::text IS NULL THEN basis ELSE jsonb_set(basis, '{cockpitUrl}', to_jsonb(${url}::text)) END,
                                             '{firmaId}', to_jsonb(${zielId}::int))
                              ELSE basis END,
                 updated_at = NOW()
           WHERE id = ${d.id} AND firma_id = ${quelle}`;
      }
      bewegt.dossier = alt.map((d) => ({ id: n(d.id), faden_betreff: textOderNull(d.faden_betreff), mail_basis_id: textOderNull(d.mail_basis_id), mail_ki_id: textOderNull(d.mail_ki_id), cockpit: textOderNull(d.cockpit) }));
      zeilen.dossier = alt.length;
    }

    // 3. Lead-Weg und Takt: umziehen (zeigt auf die Quelle) bzw. füllen (zeigt auf keine Karte).
    if (da.weg) {
      const um = (await tx`UPDATE fiaon_lead_weg SET firma_id = ${zielId}, updated_at = NOW() WHERE anfrage_id = ANY(${g.anfrageIds}) AND firma_id = ${quelle} RETURNING anfrage_id`) as any[];
      const gefuellt = (await tx`UPDATE fiaon_lead_weg SET firma_id = ${zielId}, updated_at = NOW() WHERE anfrage_id = ANY(${g.anfrageIds}) AND firma_id IS NULL RETURNING anfrage_id`) as any[];
      bewegt.weg = { vonQuelle: zahlen(um, "anfrage_id"), gefuellt: zahlen(gefuellt, "anfrage_id") };
      zeilen.lead += um.length + gefuellt.length;
    }
    if (da.takt) {
      const um = (await tx`UPDATE fiaon_lead_takt SET firma_id = ${zielId}, updated_at = NOW() WHERE anfrage_id = ANY(${g.anfrageIds}) AND firma_id = ${quelle} RETURNING anfrage_id`) as any[];
      const gefuellt = (await tx`UPDATE fiaon_lead_takt SET firma_id = ${zielId}, updated_at = NOW() WHERE anfrage_id = ANY(${g.anfrageIds}) AND firma_id IS NULL RETURNING anfrage_id`) as any[];
      bewegt.takt = { vonQuelle: zahlen(um, "anfrage_id"), gefuellt: zahlen(gefuellt, "anfrage_id") };
      zeilen.lead += um.length + gefuellt.length;
    }

    // 4. Gespräche der Gruppe (über die Anfrage oder eine Person der Gruppe) — nie eines der Person des Kartenkopfs.
    if (da.gespraech && g.gespraechTermine.length) {
      const alt = (await tx`
        SELECT termin_id, faden_betreff, d2_id, d3_id FROM fiaon_lead_gespraech
         WHERE termin_id = ANY(${g.gespraechTermine}) AND firma_id = ${quelle}
           AND (${kopfPerson}::int IS NULL OR person_id IS DISTINCT FROM ${kopfPerson}::int) FOR UPDATE`) as any[];
      if (alt.length) {
        // Eine echte Message-ID (<…>) gehört zum fremden Faden; die Marke bleibt („getrennt“), damit „D2 gesendet“ wahr bleibt.
        await tx`
          UPDATE fiaon_lead_gespraech SET firma_id = ${zielId},
                 faden_betreff = CASE WHEN faden_betreff IS NULL THEN NULL ELSE ${g.fadenStamm}::text END,
                 d2_id = CASE WHEN d2_id LIKE '<%' THEN 'getrennt' ELSE d2_id END,
                 d3_id = CASE WHEN d3_id LIKE '<%' THEN 'getrennt' ELSE d3_id END
           WHERE termin_id = ANY(${zahlen(alt, "termin_id")}) AND firma_id = ${quelle}`;
      }
      bewegt.gespraech = alt.map((x) => ({ termin_id: n(x.termin_id), faden_betreff: textOderNull(x.faden_betreff), d2_id: textOderNull(x.d2_id), d3_id: textOderNull(x.d3_id) }));
      zeilen.lead += alt.length;
    }

    // 5. WhatsApp (Mara Business).
    if (da.wa) {
      const um = (await tx`UPDATE fiaon_wa_global SET firma_id = ${zielId}, updated_at = NOW() WHERE anfrage_id = ANY(${g.anfrageIds}) AND firma_id = ${quelle} RETURNING anfrage_id`) as any[];
      const gefuellt = (await tx`UPDATE fiaon_wa_global SET firma_id = ${zielId}, updated_at = NOW() WHERE anfrage_id = ANY(${g.anfrageIds}) AND firma_id IS NULL RETURNING anfrage_id`) as any[];
      bewegt.whatsapp = { vonQuelle: zahlen(um, "anfrage_id"), gefuellt: zahlen(gefuellt, "anfrage_id") };
      zeilen.lead += um.length + gefuellt.length;
    }

    // 6. Daniels Aufträge: nur die mit dem Link der Quelle und dem Schlüssel einer Gruppen-Anfrage.
    if (da.auftraege) {
      const linkQuelle = cockpitLink(quelle);
      const linkZiel = cockpitLink(zielId);
      const schluessel = g.anfrageIds.flatMap((a) => [`global-anfrage:${a}`, `global-rueckruf:${a}`, `global-antwort:${a}`]);
      const alt = (await tx`
        SELECT id, titel, link FROM fiaon_betreiber_todos WHERE link = ${linkQuelle} AND schluessel = ANY(${schluessel}) FOR UPDATE`) as any[];
      const anzeige = leadAnzeigeName(g.kontakt.firma, g.kontakt.name);
      const hinweis = auftragHinweis({ quelleId: quelle, zielId, firmaRoh, tagIso: heute });
      for (const a of alt) {
        await tx`
          UPDATE fiaon_betreiber_todos SET link = ${linkZiel}, titel = ${auftragTitelNeu(String(a.titel ?? ""), firmaRoh, anzeige)},
                 text = CONCAT_WS(E'\n\n', NULLIF(text, ''), ${hinweis}::text), updated_at = NOW()
           WHERE id = ${a.id} AND link = ${linkQuelle}`;
      }
      bewegt.auftraege = alt.map((a) => ({ id: n(a.id), link: textOderNull(a.link), titel: textOderNull(a.titel) }));
      zeilen.auftraege = alt.length;
    }

    // ── Kopf der Quelle: Notiz ohne die umgezogenen Blöcke, global_am = jüngster eigener Eingang, Paketwunsch nur, wenn er
    //    nachweislich aus der Gruppe stammt. person_id kann nie aus der Gruppe stammen (sonst gehörte sie zum Kopf);
    //    status und wiedervorlage bleiben — sie zeigen die letzte Handlung an dieser Karte.
    const [rest] = (await tx`
      SELECT MAX(created_at) AS am FROM fiaon_firmen_log
       WHERE firma_id = ${quelle} AND art = 'global' AND ergebnis IN ('anfrage', 'termin_gebucht')`) as any[];
    const wunschAusGruppe = paketwunschVonGruppe(textOderNull(q.paketwunsch), g.texte, p.eigeneBelege);
    const eigenerWunsch = wunschAusGruppe ? (p.eigeneBelege.map((t) => paketwunschAus(t)).filter((w): w is string => !!w).pop() ?? null) : null;
    await tx`
      UPDATE fiaon_firmen_leads SET
        notiz = CASE WHEN ${notiz.bloecke.length > 0} THEN NULLIF(${notiz.rest}::text, '') ELSE notiz END,
        global_am = COALESCE(${rest?.am ?? null}::timestamptz, global_am),
        paketwunsch = CASE WHEN ${wunschAusGruppe} THEN ${eigenerWunsch}::text ELSE paketwunsch END,
        updated_at = NOW()
      WHERE id = ${quelle}`;
    zeilen.notiz = notiz.bloecke.length;

    // ── Je Karte eine Zeile im Verlauf; dazu ein Vermerk für alles, was bewusst NICHT umzog ──
    await tx`
      INSERT INTO fiaon_firmen_log (firma_id, agent_id, agent_name, art, ergebnis, notiz) VALUES
        (${quelle}, NULL, 'System', 'system', 'getrennt', ${getrenntSatzQuelle({ anfrageIds: g.anfrageIds, zielId, zielNeu, firmaRoh })}),
        (${zielId}, NULL, 'System', 'system', 'getrennt', ${getrenntSatzZiel({ anfrageIds: g.anfrageIds, quelleId: quelle, firmaRoh })})`;
    const vermerk = vermerkSatz({ anfrageIds: g.anfrageIds, notizNicht: notiz.nicht, zweideutig: g.zweideutig });
    if (vermerk) {
      await tx`INSERT INTO fiaon_firmen_log (firma_id, agent_id, agent_name, art, ergebnis, notiz) VALUES (${quelle}, NULL, 'System', 'system', 'getrennt_hinweis', ${vermerk})`;
    }

    // ── Das Protokoll: was wohin zog und wie der Kopf vorher war — der Rückweg ──
    bewegt.notiz = { bloecke: notiz.bloecke, nichtGefunden: notiz.nicht };
    bewegt.vermerk = vermerk;
    const vorher = {
      notiz: textOderNull(q.notiz), global_am: q.global_am ? new Date(q.global_am).toISOString() : null,
      paketwunsch: textOderNull(q.paketwunsch), person_id: kopfPerson, firma: firmaRoh,
    };
    await tx`UPDATE fiaon_firmen_trennung SET ziel_firma_id = ${zielId}, bewegt = ${tx.json(bewegt)}, vorher = ${tx.json(vorher)} WHERE id = ${prot.id}`;
    return { status: "getrennt", zielId, zielNeu, zeilen, vermerk: !!vermerk };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// DER LAUF
// ═══════════════════════════════════════════════════════════════════════════
export interface TrennErgebnis {
  modus: TrennModus;
  karten: number; platzhalter: number; gruppen: number; getrennt: number; neu: number; schon: number;
  vermerke: number; uebersprungen: number; fehler: number;
  zeilen: TrennZeilen;
  /** Je Gruppe: Quelle, Anfragen, Ziel („neu“ oder die vorhandene Karte) — in der Trockenprobe der Plan. Nie in der Meldung. */
  plan: { quelle: number; anfragen: number[]; ziel: number | "neu" }[];
  fehlerText: string | null;
}

function leeresErgebnis(modus: TrennModus): TrennErgebnis {
  return { modus, karten: 0, platzhalter: 0, gruppen: 0, getrennt: 0, neu: 0, schon: 0, vermerke: 0, uebersprungen: 0, fehler: 0, zeilen: keineZeilen(), plan: [], fehlerText: null };
}

/**
 * Ein Durchgang: lesen, planen, je Gruppe trennen (oder in der Trockenprobe nur zählen). Wirft nur, wenn schon das Lesen
 * scheitert; eine gescheiterte Gruppe rollt allein zurück (Zähler fehler) — der nächste Lauf versucht sie neu.
 */
export async function firmenTrennenLauf(opt: { modus?: TrennModus; lauf?: Lauf } = {}): Promise<TrennErgebnis> {
  const lauf = opt.lauf ?? sqlPool;
  if (!(await firmenTrennungSchema(lauf))) return leeresErgebnis(opt.modus ?? "an");
  const modus = opt.modus ?? (await trennModus(lauf));
  const erg = leeresErgebnis(modus);
  if (modus === "aus") return erg;
  const { stand, da } = await standLesen(lauf);
  const planung = kartenPlanen(stand);
  erg.karten = planung.karten;
  erg.platzhalter = planung.platzhalter;
  erg.uebersprungen = planung.uebersprungen;
  const heute = berlinToday();
  for (const p of planung.plaene) {
    // Die Notiz der Karte in der Trockenprobe: Gruppe für Gruppe, wie die Transaktionen sie nacheinander sähen.
    let notizProbe = stand.karten.find((k) => k.id === p.quelleId)?.notiz ?? null;
    for (const g of p.gruppen) {
      erg.gruppen++;
      const [schon] = (await lauf`SELECT 1 AS ja FROM fiaon_firmen_trennung WHERE schluessel = ${g.schluessel}`) as any[];
      if (schon) { erg.schon++; continue; }
      if (modus === "trocken") {
        const ziel = await zielSuchen(lauf, p.quelleId, g, false);
        const notiz = notizTrennen(notizProbe, g.blockZeilen);
        notizProbe = notiz.rest;
        erg.plan.push({ quelle: p.quelleId, anfragen: g.anfrageIds, ziel: ziel ? ziel.id : "neu" });
        if (!ziel) erg.neu++;
        erg.zeilen.verlauf += g.logIds.length;
        erg.zeilen.dossier += g.dossierIds.length;
        erg.zeilen.auftraege += g.auftragIds.length;
        erg.zeilen.lead += g.wegAnfragen.length + g.taktAnfragen.length + g.gespraechTermine.length + g.waAnfragen.length;
        erg.zeilen.notiz += notiz.bloecke.length;
        if (notiz.nicht > 0 || g.zweideutig > 0) erg.vermerke++;
        continue;
      }
      try {
        const r = await gruppeTrennen(lauf, p, g, da, heute);
        if (r.status === "schon") { erg.schon++; continue; }
        if (r.status === "uebersprungen") { erg.uebersprungen++; continue; }
        erg.getrennt++;
        if (r.zielNeu) erg.neu++;
        if (r.vermerk) erg.vermerke++;
        erg.plan.push({ quelle: p.quelleId, anfragen: g.anfrageIds, ziel: r.zielId ?? "neu" });
        (Object.keys(erg.zeilen) as (keyof TrennZeilen)[]).forEach((k) => { erg.zeilen[k] += r.zeilen[k]; });
      } catch (e) {
        erg.fehler++;
        const text = String((e as Error)?.message ?? e).slice(0, 200);
        erg.fehlerText = erg.fehlerText ?? text;
        console.error(`[FIRMEN-TRENNEN] Gruppe an Karte #${p.quelleId} nicht getrennt (zurückgerollt):`, text);
      }
    }
  }
  return erg;
}

/** Die Zahlen für die Lauf-Historie — nur Zahlen (laufMeldung schwärzt alles andere), höchstens 14 Felder. */
export function trennMeldung(e: TrennErgebnis): string | null {
  return laufMeldung(FIRMEN_TRENNEN_LAUF, {
    ...(e.modus === "trocken" ? { trocken: true } : {}),
    ...(e.modus === "aus" ? { aus: true } : {}),
    karten: e.karten, platzhalter: e.platzhalter, gruppen: e.gruppen, getrennt: e.getrennt, neu: e.neu, schon: e.schon,
    vermerke: e.vermerke, uebersprungen: e.uebersprungen, zeilen: { ...e.zeilen },
  });
}

let letzteZeile = 0;
let letzterPlan = "";
/** Puls: auch ohne Arbeit eine Historienzeile je 6 Stunden — die Lauf-Ampel (gelb ab 26 h) bleibt ehrlich. */
const PULS_MS = 6 * 60 * 60_000;

/**
 * Für tageslauf (nurMitErgebnis): Die Zeile MIT Zahlen schreibt der Lauf selbst — bei Arbeit, bei einem neuen Plan in der
 * Trockenprobe, sonst als Puls alle 6 Stunden. Deshalb immer false (stillerLauf schriebe sonst eine zweite, leere Zeile).
 * Eine gescheiterte Gruppe wirft am Ende — stillerLauf schreibt den Fehler in die Historie.
 */
export async function firmenTrennenTakt(): Promise<false> {
  const start = Date.now();
  const erg = await firmenTrennenLauf();
  if (erg.getrennt > 0 || erg.fehler > 0 || (erg.modus === "trocken" && erg.plan.length)) {
    console.log(`[FIRMEN-TRENNEN] ${erg.modus}: ${erg.karten} Karten, ${erg.platzhalter} mit Platzhalter, ${erg.gruppen} fremde Gruppe(n) — `
      + `${erg.modus === "trocken" ? `würde trennen: ${erg.plan.length}` : `getrennt: ${erg.getrennt}`} (${erg.neu} neue Karte(n)), schon erledigt ${erg.schon}, `
      + `Zeilen: Verlauf ${erg.zeilen.verlauf}, Dossier ${erg.zeilen.dossier}, Aufträge ${erg.zeilen.auftraege}, Lead ${erg.zeilen.lead}, Notiz ${erg.zeilen.notiz}`
      + `${erg.vermerke ? `, ${erg.vermerke} Vermerk(e)` : ""}${erg.fehler ? `, ${erg.fehler} Fehler` : ""}.`);
  }
  if (erg.fehler > 0) {
    throw new Error(`firmen_trennen: ${erg.getrennt} getrennt, ${erg.fehler} Gruppe(n) zurückgerollt (der nächste Lauf versucht es neu) — ${erg.fehlerText ?? "unbekannt"}`.slice(0, 600));
  }
  const planText = JSON.stringify(erg.plan);
  const neuerPlan = erg.modus === "trocken" && planText !== letzterPlan;
  if (erg.getrennt > 0 || erg.vermerke > 0 || neuerPlan || Date.now() - letzteZeile >= PULS_MS) {
    letzteZeile = Date.now();
    letzterPlan = planText;
    await sqlPool`
      INSERT INTO fiaon_lauf_historie (name, ergebnis, begonnen, beendet, dauer_ms, meldung)
      VALUES (${FIRMEN_TRENNEN_LAUF}, 'erfolg', ${new Date(start)}, NOW(), ${Date.now() - start}, ${trennMeldung(erg)})`
      .catch((e: unknown) => console.error("[FIRMEN-TRENNEN] Historie:", String((e as Error)?.message ?? e).slice(0, 160)));
  }
  return false;
}
