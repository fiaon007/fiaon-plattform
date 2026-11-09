// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — FALSCH ZUSAMMENGELEGTE FIRMEN-KARTEN TRENNEN: DER LAUF firmen_trennen (E-487, 09.11.2026)
//
// ── WARUM ─────────────────────────────────────────────────────────────────────
// Vor dem Fix legte globalLeadAufnehmen fremde Menschen über einen gleichen Firmennamen („Selbständig“, „Kleingewerbe“,
// „GmbH“ …) auf EINE Karte. Ihre Aufträge öffneten die Karte eines anderen Menschen — mit dessen Nummer, Notizen und „bitte
// nicht anrufen“; ihre Dossiers liefen als „Weitere Anfrage“ in dessen Mail-Faden. Der Eingang ist repariert; dieser Lauf
// trennt, was schon zusammengelegt ist — als Plattform-Code, denn in Produktion schreibt nie ein Skript von außen.
//
// ── WIE ───────────────────────────────────────────────────────────────────────
//   · Die Regel und der Plan stehen rein in shared/fiaon-firmen-trennen.ts (Prüfstand A rechnet mit demselben Planer):
//     Kandidat = Firmenname darf allein nicht verbinden, fremd nur bei ALLEM verschieden, gruppiert nach Person, Ziel =
//     vorhandene Karte der Person oder neu.
//   · Der Lauf liest einen Stand aller Verweise, plant, und führt JE GRUPPE EINE Transaktion aus: SET LOCAL lock_timeout = '3s',
//     Kartenkopf FOR UPDATE (frisch geprüft), Protokollzeile INSERT … ON CONFLICT (schluessel) DO NOTHING (kommt nichts zurück,
//     ist die Gruppe erledigt), dann umziehen. Jede Anweisung, die einen Verweis umzieht, trägt „AND firma_id = ${quelle}“
//     (beim Auftrag: der Link der Quelle) — nie wird eine Zeile einer dritten Karte angefasst, und ein zweiter Lauf ändert
//     nichts. Verweise, die auf KEINE Karte zeigen (Lead-Weg/Takt/WhatsApp mit leerer firma_id), werden nur gefüllt
//     („AND firma_id IS NULL“) — sonst fände der neue Kopf seine eigene Anfrage nur über die Mail.
//   · Was umzieht: Verlaufszeilen mit eindeutigem Bezug, Dossiers (Anfrage UND Buchungsmeldung des Gesprächs; mit neuem
//     Faden-Stamm, ohne die Message-IDs des fremden Fadens, firmaId/Cockpit-Link im gespeicherten Dossier), Lead-Weg, Takt,
//     Gespräche, WhatsApp, Daniels Aufträge (Anruf UND Gespräch „global-termin:<Termin>“; Link, Titel mit dem Namen statt des
//     Firmenfelds, Hinweis im Text), die Notiz-Blöcke des Eingangs. Was bleibt: alles ohne Bezug (Anrufe, Hand-Notizen,
//     Gesprächs-Mails) — im Zweifel beim Eigentümer, mit Vermerk.
//   · Der Stand der Quelle: Hat zuletzt der Eingang der fremden Person Status und Wiedervorlage gesetzt, gilt der Stand aus
//     dem letzten eigenen Ereignis (sonst ein Vermerk). Die neue Karte steht auf „Termin“, wenn ein umgezogenes Gespräch noch
//     kommt; hat Justin „Ich rufe selbst an“ gedrückt, ohne Wiedervorlage und mit „Justin ruft selbst an“.
//   · Zuständig für die neue Karte: wie der Auftrag, sonst die Anfrage, sonst die Quelle — nur ein aktives, nicht gesperrtes
//     Konto (wie im Eingang); sonst die Global-Zuständige (globalZustaendig), sonst niemand.
//   · Danach je Karte eine Zeile „Getrennt: …“ im Verlauf; die Protokollzeile in fiaon_firmen_trennung hält fest, was wohin
//     zog (bewegt) und wie der Kopf vorher war (vorher, mit Status und Wiedervorlage) — der Rückweg.
//   · Schalter fiaon_settings „firmen_trennen“: trocken (VORGABE — nur rechnen, Zahlen in die Lauf-Historie) | an | aus.
//     Nachbesserung (Gutachten, Mangel 1): Teil B des Prüfstands (lokale Datenbank) ist nicht gelaufen — darum schreibt der
//     Lauf erst nach Sicht der Historie und einem ausdrücklichen „an“. Höchstens FIRMEN_TRENNEN_DECKEL Trennungen je Lauf.
//   · Einmal 4 Minuten nach dem Deploy, danach stündlich (server/routes.ts). Die Historienzeile mit Zahlen schreibt der Lauf
//     selbst (stillerLauf kennt keine Meldung): bei Arbeit, bei einem neuen Plan der Trockenprobe, sonst alle 6 Stunden.
//
// Schema: dieselbe DDL nur hier (firmenTrennungSchema) — nur im Modus „an“, mit lock_timeout, nie im Eingang; „aus“ und
// „trocken“ ändern keine Tabelle. Keine Mail, keine WhatsApp, keine KI. Repo öffentlich: keine Kundendaten, keine Karten-
// oder Anfragenummern im Code.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { berlinToday } from "./fiaon-time";
import { laufMeldung } from "./fiaon-crons";
import {
  FIRMEN_TRENNEN_LAUF, FIRMEN_TRENNEN_SCHALTER, FIRMEN_TRENNEN_DECKEL, STAND_ERGEBNISSE_GLOBAL, trennModusLesen, trennKandidat,
  zusammengehoerig, zielKarteWaehlen, kartenPlanen, notizTrennen, paketwunschVonGruppe, getrenntSatzQuelle, getrenntSatzZiel,
  auftragHinweis, auftragTitelNeu, vermerkSatz, standKorrigiertSatz, standHinweisSatz, quellStandSoll, cockpitLink, auftragAnfrage, anfrageNummern,
  mailForm, nummer9Echt,
  type TrennModus, type TrennStand, type KartenPlan, type KartenPlanGruppe, type TrennKontakt, type KartenKopf, type KartenStand,
} from "@shared/fiaon-firmen-trennen";

type Lauf = typeof sqlPool;

/** Die Regel im Protokoll (regel-Spalte) — ändert sich die Regel, bekommt sie einen neuen Namen. */
const REGEL = "e487-firmenfeld-v2";

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMA — Protokoll-Tabelle und Spalte getrennt_aus (nur im Modus „an“, mit lock_timeout; erst im Katalog nachsehen)
// ═══════════════════════════════════════════════════════════════════════════
/** Nur Lesen (Katalog): gibt es Karten, Verlauf und das Protokoll schon? */
async function tabellenLage(lauf: Lauf): Promise<{ karten: boolean; verlauf: boolean; protokoll: boolean }> {
  const [k] = (await lauf`
    SELECT to_regclass('fiaon_firmen_leads') IS NOT NULL AS karten,
           to_regclass('fiaon_firmen_log') IS NOT NULL AS verlauf,
           to_regclass('fiaon_firmen_trennung') IS NOT NULL AS protokoll`) as any[];
  return { karten: !!k?.karten, verlauf: !!k?.verlauf, protokoll: !!k?.protokoll };
}

let schemaBereit: Promise<boolean> | null = null;

/** false = es gibt (noch) keine Firmen-Karten — dann hat der Lauf nichts zu tun. Legt Protokoll und Spalte an (nur „an“). */
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

/** Der Schalter „firmen_trennen“ (trocken | an | aus; leer = trocken). Ohne lesbare Einstellung gilt die Vorgabe. */
export async function trennModus(lauf: Lauf = sqlPool): Promise<TrennModus> {
  const [r] = (await lauf`SELECT value FROM fiaon_settings WHERE key = ${FIRMEN_TRENNEN_SCHALTER}`.catch(() => [])) as any[];
  return trennModusLesen(r?.value);
}

// ═══════════════════════════════════════════════════════════════════════════
// DER LESE-STAND — Karten mit Global-Bezug, und zu den Kandidaten alle Verweise und ihre Anfragen
// ═══════════════════════════════════════════════════════════════════════════
export interface TabellenDa {
  dossier: boolean; weg: boolean; takt: boolean; gespraech: boolean; wa: boolean; auftraege: boolean; anfragen: boolean;
  termine: boolean; agents: boolean;
}

async function tabellenDa(lauf: Lauf): Promise<TabellenDa> {
  const [t] = (await lauf`
    SELECT to_regclass('fiaon_lead_dossier') IS NOT NULL AS dossier, to_regclass('fiaon_lead_weg') IS NOT NULL AS weg,
           to_regclass('fiaon_lead_takt') IS NOT NULL AS takt, to_regclass('fiaon_lead_gespraech') IS NOT NULL AS gespraech,
           to_regclass('fiaon_wa_global') IS NOT NULL AS wa, to_regclass('fiaon_betreiber_todos') IS NOT NULL AS auftraege,
           to_regclass('fiaon_anfragen') IS NOT NULL AS anfragen, to_regclass('fiaon_termine') IS NOT NULL AS termine,
           to_regclass('fiaon_agents') IS NOT NULL AS agents`) as any[];
  return {
    dossier: !!t?.dossier, weg: !!t?.weg, takt: !!t?.takt, gespraech: !!t?.gespraech, wa: !!t?.wa, auftraege: !!t?.auftraege, anfragen: !!t?.anfragen,
    termine: !!t?.termine, agents: !!t?.agents,
  };
}

const n = (v: unknown): number => Number(v);
const nOderNull = (v: unknown): number | null => { const x = Number(v); return v != null && Number.isInteger(x) && x > 0 ? x : null; };
const textOderNull = (v: unknown): string | null => (v == null ? null : String(v));
/** postgres.js mag keine leeren Listen in ANY(…) — eine Kennung, die es nie gibt, statt eines leeren Arrays. */
const nieLeer = (ids: readonly number[]): number[] => (ids.length ? Array.from(ids) : [0]);
const nieLeerText = (werte: readonly string[]): string[] => (werte.length ? Array.from(werte) : ["-"]);
const eindeutig = (werte: readonly (number | null | undefined)[]): number[] =>
  Array.from(new Set(werte.filter((x): x is number => typeof x === "number" && Number.isInteger(x) && x > 0)));

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
  // Verlauf: art „global“ (Eingänge, Marken) und „anruf“ (für den Stand der Quelle) — in Zeit-Reihenfolge.
  const logs = ((await lauf`
    SELECT id, firma_id, art, ergebnis, notiz, created_at, agent_name FROM fiaon_firmen_log
     WHERE firma_id = ANY(${kid}) AND art IN ('global', 'anruf')
     ORDER BY created_at, id`) as any[]).map((l) => ({
    id: n(l.id), firma_id: n(l.firma_id), art: String(l.art), ergebnis: textOderNull(l.ergebnis), notiz: textOderNull(l.notiz),
    created_at: l.created_at as Date, agent_name: textOderNull(l.agent_name),
  }));
  for (const l of logs) if (l.art === "global" && l.ergebnis === "anfrage") anfrageNummern(l.notiz).forEach(merk);
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
  // Dossiers zur Anfrage — und die Buchungsmeldungen (anlass „termin“) an den Kandidaten. privat = SEIN Dossier klingt nach
  // Privatkunde (der neue Faden erbt es nie vom Eigentümer).
  const dossiers = da.dossier ? ((await lauf`
    SELECT id, anlass, anlass_id, firma_id, mail_basis_am, mail_ki_am, temperatur, faden_betreff, selbst_am,
           COALESCE(basis->'hinweis'->>'imBetreff', '') = 'true' AS privat
      FROM fiaon_lead_dossier
     WHERE (anlass = 'anfrage' AND (firma_id = ANY(${kid}) OR anlass_id = ANY(${ids})))
        OR (anlass = 'termin' AND firma_id = ANY(${kid}))`) as any[]).map((d) => ({
    id: n(d.id), anlass: String(d.anlass), anlass_id: n(d.anlass_id), firma_id: nOderNull(d.firma_id), mail_basis_am: d.mail_basis_am as Date | null,
    mail_ki_am: d.mail_ki_am as Date | null, temperatur: textOderNull(d.temperatur), faden_betreff: textOderNull(d.faden_betreff),
    selbst_am: d.selbst_am as Date | null, privat: !!d.privat,
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
    SELECT anfrage_id, firma_id, weg_am FROM fiaon_wa_global WHERE firma_id = ANY(${kid}) OR anfrage_id = ANY(${ids})`) as any[]).map((x) => ({
    anfrage_id: nOderNull(x.anfrage_id), firma_id: nOderNull(x.firma_id), weg_am: x.weg_am as Date | null,
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
  // Nie über eine Fantasienummer (123456789, 000000000 …) — Gutachten, Mangel 13.
  const nummern = Array.from(new Set(g.mitglieder.map((m) => nummer9Echt(m.telefon)).filter(Boolean)));
  if (!pids.length && !mails.length && !nummern.length) return null;
  // Nach Rang (Person, dann Mail, dann Nummer, dann die älteste) — die LIMIT-Grenze schneidet nie die passende Person ab.
  const zeilen = (sperren
    ? await q`
      SELECT id, person_id, email, telefon, ansprechpartner FROM fiaon_firmen_leads
       WHERE id <> ${quelleId}
         AND ((person_id IS NOT NULL AND person_id = ANY(${nieLeer(pids)}))
           OR (COALESCE(email, '') <> '' AND LOWER(TRIM(email)) = ANY(${nieLeerText(mails)}))
           OR RIGHT(REGEXP_REPLACE(COALESCE(telefon, ''), '\\D', '', 'g'), 9) = ANY(${nieLeerText(nummern)}))
       ORDER BY (person_id IS NOT NULL AND person_id = ANY(${nieLeer(pids)})) DESC,
                (COALESCE(email, '') <> '' AND LOWER(TRIM(email)) = ANY(${nieLeerText(mails)})) DESC, id
       LIMIT 20 FOR UPDATE`
    : await q`
      SELECT id, person_id, email, telefon, ansprechpartner FROM fiaon_firmen_leads
       WHERE id <> ${quelleId}
         AND ((person_id IS NOT NULL AND person_id = ANY(${nieLeer(pids)}))
           OR (COALESCE(email, '') <> '' AND LOWER(TRIM(email)) = ANY(${nieLeerText(mails)}))
           OR RIGHT(REGEXP_REPLACE(COALESCE(telefon, ''), '\\D', '', 'g'), 9) = ANY(${nieLeerText(nummern)}))
       ORDER BY (person_id IS NOT NULL AND person_id = ANY(${nieLeer(pids)})) DESC,
                (COALESCE(email, '') <> '' AND LOWER(TRIM(email)) = ANY(${nieLeerText(mails)})) DESC, id
       LIMIT 20`) as any[];
  const koepfe: KartenKopf[] = zeilen.map((z) => ({
    id: n(z.id), personId: nOderNull(z.person_id), email: textOderNull(z.email), telefon: textOderNull(z.telefon), name: textOderNull(z.ansprechpartner),
  }));
  return zielKarteWaehlen(quelleId, g.mitglieder, koepfe);
}

// ═══════════════════════════════════════════════════════════════════════════
// EINE GRUPPE TRENNEN — eine Transaktion
// ═══════════════════════════════════════════════════════════════════════════
export interface TrennZeilen { verlauf: number; dossier: number; auftraege: number; lead: number; notiz: number }
const keineZeilen = (): TrennZeilen => ({ verlauf: 0, dossier: 0, auftraege: 0, lead: 0, notiz: 0 });

export interface GruppenErgebnis {
  status: "getrennt" | "schon" | "uebersprungen"; zielId: number | null; zielNeu: boolean; zeilen: TrennZeilen; vermerk: boolean; stand: boolean;
}

const zahlen = (zeilen: any[], feld: string): number[] => zeilen.map((z) => n(z[feld]));

/** Dossiers (Anfrage oder Buchungsmeldung) auf die Zielkarte: eigener Faden-Stamm, ohne fremde Message-IDs, firmaId/Cockpit-Link. */
async function dossiersUmziehen(tx: any, alt: any[], quelle: number, zielId: number, fadenStamm: string): Promise<void> {
  for (const d of alt) {
    const url = d.cockpit ? String(d.cockpit).replace(/([?&]firma=)\d+/, `$1${zielId}`) : null;
    await tx`
      UPDATE fiaon_lead_dossier SET firma_id = ${zielId},
             faden_betreff = CASE WHEN faden_betreff IS NULL THEN NULL ELSE ${fadenStamm}::text END,
             mail_basis_id = NULL, mail_ki_id = NULL,
             basis = CASE WHEN jsonb_typeof(basis) = 'object'
                          THEN jsonb_set(CASE WHEN ${url}::text IS NULL THEN basis ELSE jsonb_set(basis, '{cockpitUrl}', to_jsonb(${url}::text)) END,
                                         '{firmaId}', to_jsonb(${zielId}::int))
                          ELSE basis END,
             updated_at = NOW()
       WHERE id = ${d.id} AND firma_id = ${quelle}`;
  }
}
const dossierProtokoll = (alt: any[]) => alt.map((d) => ({
  id: n(d.id), faden_betreff: textOderNull(d.faden_betreff), mail_basis_id: textOderNull(d.mail_basis_id), mail_ki_id: textOderNull(d.mail_ki_id), cockpit: textOderNull(d.cockpit),
}));

/** Eine Gruppe in EINER Transaktion trennen. Exportiert nur für den Prüfstand (A12 spielt sie mit einer Attrappe durch). */
export async function gruppeTrennen(lauf: Lauf, p: KartenPlan, g: KartenPlanGruppe, da: TabellenDa, heute: string, rueckfallAgent: number | null): Promise<GruppenErgebnis> {
  const quelle = p.quelleId;
  return await lauf.begin(async (tx: any): Promise<GruppenErgebnis> => {
    await tx`SET LOCAL lock_timeout = '3s'`;
    const nichts: GruppenErgebnis = { status: "uebersprungen", zielId: null, zielNeu: false, zeilen: keineZeilen(), vermerk: false, stand: false };
    const [q] = (await tx`
      SELECT id, firma, ansprechpartner, email, telefon, person_id, notiz, paketwunsch, global_am, status, wiedervorlage::text AS wv,
             zustaendig_agent_id
        FROM fiaon_firmen_leads WHERE id = ${quelle} FOR UPDATE`) as any[];
    // Frisch geprüft: noch ein Kandidat? Gehört ein Gruppen-Eingang inzwischen doch zum Kopf? Dann nicht trennen.
    if (!q || !trennKandidat(q.firma, q.ansprechpartner)) return nichts;
    const kopf: TrennKontakt = { personIds: [nOderNull(q.person_id)], email: textOderNull(q.email), telefon: textOderNull(q.telefon), name: textOderNull(q.ansprechpartner) };
    if (g.mitglieder.some((m) => zusammengehoerig(m, kopf))) return nichts;
    const kopfPerson = nOderNull(q.person_id);
    const firmaRoh = String(q.firma ?? "").trim();
    const standVorher: KartenStand = { status: String(q.status ?? ""), wiedervorlage: q.wv ? String(q.wv).slice(0, 10) : null };

    const [prot] = (await tx`
      INSERT INTO fiaon_firmen_trennung (schluessel, quell_firma_id, anfrage_ids, regel)
      VALUES (${g.schluessel}, ${quelle}, ${g.anfrageIds}::int[], ${REGEL})
      ON CONFLICT (schluessel) DO NOTHING
      RETURNING id`) as any[];
    if (!prot) return { ...nichts, status: "schon" };

    // Der Stand der Quelle (Gutachten, Mangel 5): Hat zuletzt der Eingang DIESER Gruppe Status und Wiedervorlage gesetzt?
    // Frisch und vor jedem Umzug — kam seither ein eigenes Ereignis (Anruf, Absage …), bleibt der Stand, wie er ist.
    let standZiehen = false;
    if (g.stand) {
      const [jl] = (await tx`
        SELECT id FROM fiaon_firmen_log
         WHERE firma_id = ${quelle} AND (art = 'anruf' OR (art = 'global' AND ergebnis = ANY(${Array.from(STAND_ERGEBNISSE_GLOBAL)})))
         ORDER BY created_at DESC, id DESC LIMIT 1`) as any[];
      standZiehen = !!jl && n(jl.id) === g.stand.zeileId;
    }

    // Die Notiz der Quelle — frisch und gesperrt: welche Blöcke des Eingangs wörtlich dastehen.
    const notiz = notizTrennen(textOderNull(q.notiz), g.blockZeilen);

    // Zuständig (Gutachten, Mangel 6): wie der Auftrag, sonst die Anfrage, sonst die Quelle — nur ein aktives, nicht gesperrtes
    // Konto (wie im Eingang); sonst die Global-Zuständige, sonst niemand. „Jetzt dran“ zeigt nur „niemand“ oder „ich“.
    const kandidaten = eindeutig([...g.zustaendigKandidaten, nOderNull(q.zustaendig_agent_id), rueckfallAgent]);
    const aktiv = da.agents && kandidaten.length
      ? (await tx`SELECT id FROM fiaon_agents WHERE id = ANY(${kandidaten}) AND active AND zugang_gesperrt_am IS NULL`) as any[]
      : [];
    const aktivSet = new Set(zahlen(aktiv, "id"));
    const zustaendig = kandidaten.find((x) => aktivSet.has(x)) ?? null;

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
                'global', 'wiedervorlage', ${zustaendig}::int, ${heute}::date,
                ${k.personId}::int, ${k.paketwunsch}, COALESCE(${k.am}::timestamptz, NOW()), COALESCE(${k.erstAm}::timestamptz, NOW()), NOW(), ${quelle})
        RETURNING id`) as any[];
      zielId = n(neu.id);
      zielNeu = true;
    }

    // ── Umziehen: jede Anweisung nur für Zeilen, die noch an der Quelle hängen ──
    const zeilen = keineZeilen();
    const bewegt: Record<string, unknown> = { zielNeu, ueber: ziel?.ueber ?? null, zustaendig };

    // 1. Verlaufszeilen mit eindeutigem Bezug (geplant nach Kennung).
    const verlauf = g.logIds.length
      ? (await tx`UPDATE fiaon_firmen_log SET firma_id = ${zielId} WHERE id = ANY(${g.logIds}) AND firma_id = ${quelle} RETURNING id`) as any[]
      : [];
    bewegt.verlauf = zahlen(verlauf, "id");
    zeilen.verlauf = verlauf.length;

    // 2. Dossiers der Anfragen: eigene Karte, eigener Faden-Stamm, ohne die Message-IDs des fremden Fadens (sonst hinge die
    //    nächste Mail per In-Reply-To wieder dort), firmaId und Cockpit-Link im gespeicherten Dossier (Nachtrag und Anruf-Karte).
    let selbst = false;
    if (da.dossier) {
      const alt = (await tx`
        SELECT id, faden_betreff, mail_basis_id, mail_ki_id, basis->>'cockpitUrl' AS cockpit, selbst_am FROM fiaon_lead_dossier
         WHERE anlass = 'anfrage' AND anlass_id = ANY(${g.anfrageIds}) AND firma_id = ${quelle} FOR UPDATE`) as any[];
      await dossiersUmziehen(tx, alt, quelle, zielId, g.fadenStamm);
      selbst = alt.some((d) => d.selbst_am != null);
      bewegt.dossier = dossierProtokoll(alt);
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
    let termine: number[] = [];
    if (da.gespraech && g.gespraechTermine.length) {
      const alt = (await tx`
        SELECT termin_id, faden_betreff, d2_id, d3_id FROM fiaon_lead_gespraech
         WHERE termin_id = ANY(${g.gespraechTermine}) AND firma_id = ${quelle}
           AND (${kopfPerson}::int IS NULL OR person_id IS DISTINCT FROM ${kopfPerson}::int) FOR UPDATE`) as any[];
      termine = zahlen(alt, "termin_id");
      if (alt.length) {
        // Eine echte Message-ID (<…>) gehört zum fremden Faden; die Marke bleibt („getrennt“), damit „D2 gesendet“ wahr bleibt.
        await tx`
          UPDATE fiaon_lead_gespraech SET firma_id = ${zielId},
                 faden_betreff = CASE WHEN faden_betreff IS NULL THEN NULL ELSE ${g.fadenStamm}::text END,
                 d2_id = CASE WHEN d2_id LIKE '<%' THEN 'getrennt' ELSE d2_id END,
                 d3_id = CASE WHEN d3_id LIKE '<%' THEN 'getrennt' ELSE d3_id END
           WHERE termin_id = ANY(${termine}) AND firma_id = ${quelle}`;
      }
      bewegt.gespraech = alt.map((x) => ({ termin_id: n(x.termin_id), faden_betreff: textOderNull(x.faden_betreff), d2_id: textOderNull(x.d2_id), d3_id: textOderNull(x.d3_id) }));
      zeilen.lead += alt.length;
    }

    // 4b. Die Buchungsmeldung dieser Gespräche (Dossier anlass „termin“, Gutachten Mangel 2): leadFadenZuTermin liest sie ZUERST —
    //     bliebe sie, landete eine Absage der getrennten Person im Mail-Faden des Eigentümers.
    if (da.dossier && termine.length) {
      const alt = (await tx`
        SELECT id, faden_betreff, mail_basis_id, mail_ki_id, basis->>'cockpitUrl' AS cockpit FROM fiaon_lead_dossier
         WHERE anlass = 'termin' AND anlass_id = ANY(${termine}) AND firma_id = ${quelle} FOR UPDATE`) as any[];
      await dossiersUmziehen(tx, alt, quelle, zielId, g.fadenStamm);
      bewegt.terminDossier = dossierProtokoll(alt);
      zeilen.dossier += alt.length;
    }

    // 5. WhatsApp (Mara Business).
    if (da.wa) {
      const um = (await tx`UPDATE fiaon_wa_global SET firma_id = ${zielId}, updated_at = NOW() WHERE anfrage_id = ANY(${g.anfrageIds}) AND firma_id = ${quelle} RETURNING anfrage_id`) as any[];
      const gefuellt = (await tx`UPDATE fiaon_wa_global SET firma_id = ${zielId}, updated_at = NOW() WHERE anfrage_id = ANY(${g.anfrageIds}) AND firma_id IS NULL RETURNING anfrage_id`) as any[];
      bewegt.whatsapp = { vonQuelle: zahlen(um, "anfrage_id"), gefuellt: zahlen(gefuellt, "anfrage_id") };
      zeilen.lead += um.length + gefuellt.length;
    }

    // 6. Daniels Aufträge: nur die mit dem Link der Quelle — zur Anfrage der Gruppe (Anruf, Rückruf, Antwort) und zu ihren
    //    umgezogenen Gesprächen („global-termin:<Termin>“, Gutachten Mangel 2: sonst öffnete der Termin-Auftrag die fremde Karte).
    if (da.auftraege) {
      const linkQuelle = cockpitLink(quelle);
      const linkZiel = cockpitLink(zielId);
      const schluessel = [
        ...g.anfrageIds.flatMap((a) => [`global-anfrage:${a}`, `global-rueckruf:${a}`, `global-antwort:${a}`]),
        ...termine.map((t) => `global-termin:${t}`),
      ];
      const alt = (await tx`
        SELECT id, titel, link FROM fiaon_betreiber_todos WHERE link = ${linkQuelle} AND schluessel = ANY(${schluessel}) FOR UPDATE`) as any[];
      const hinweis = auftragHinweis({ quelleId: quelle, zielId, firmaRoh, tagIso: heute });
      for (const a of alt) {
        // Der Titel trägt das Firmenfeld SEINER Anfrage — es kann sich in der Schreibweise vom Feld der Karte unterscheiden.
        const titel = auftragTitelNeu(auftragTitelNeu(String(a.titel ?? ""), firmaRoh, g.anzeige), g.kontakt.firma, g.anzeige);
        await tx`
          UPDATE fiaon_betreiber_todos SET link = ${linkZiel}, titel = ${titel},
                 text = CONCAT_WS(E'\n\n', NULLIF(text, ''), ${hinweis}::text), updated_at = NOW()
           WHERE id = ${a.id} AND link = ${linkQuelle}`;
      }
      bewegt.auftraege = alt.map((a) => ({ id: n(a.id), link: textOderNull(a.link), titel: textOderNull(a.titel) }));
      zeilen.auftraege = alt.length;
    }

    // ── Die neue Karte: „Termin“, wenn ein umgezogenes Gespräch noch kommt; „Ich rufe selbst an“ = ohne Wiedervorlage ──
    if (zielNeu) {
      const [kommt] = da.termine && termine.length
        ? (await tx`SELECT 1 AS ja FROM fiaon_termine WHERE id = ANY(${termine}) AND status = 'gebucht' AND beginn > NOW() LIMIT 1`) as any[]
        : [];
      if (kommt || selbst) {
        await tx`
          UPDATE fiaon_firmen_leads SET status = CASE WHEN ${!!kommt} THEN 'termin' ELSE status END,
                 wiedervorlage = CASE WHEN ${selbst} THEN NULL ELSE wiedervorlage END, updated_at = NOW()
           WHERE id = ${zielId}`;
      }
      bewegt.zielStand = { termin: !!kommt, selbst };
    }

    // ── Kopf der Quelle: Notiz ohne die umgezogenen Blöcke, global_am = jüngster eigener Eingang, Paketwunsch nur, wenn er
    //    nachweislich aus der Gruppe stammt (dann der jüngste eigene). person_id kann nie aus der Gruppe stammen (sonst gehörte
    //    sie zum Kopf). Status und Wiedervorlage nur, wenn der Eingang dieser Gruppe sie zuletzt gesetzt hat.
    const [rest] = (await tx`
      SELECT MAX(created_at) AS am FROM fiaon_firmen_log
       WHERE firma_id = ${quelle} AND art = 'global' AND ergebnis IN ('anfrage', 'termin_gebucht')`) as any[];
    const wunschAusGruppe = paketwunschVonGruppe(textOderNull(q.paketwunsch), g.texte, p.eigeneBelege);
    const eigenerWunsch = wunschAusGruppe ? p.eigenerWunsch : null;
    let standNeu: KartenStand | null = null;
    let standSatz: string | null = null;
    if (standZiehen && g.stand) {
      // Aus dem letzten eigenen Ereignis; ohne eindeutiges: ein „Termin“ gehörte der anderen Person → Wiedervorlage heute.
      const soll = quellStandSoll({ eigen: g.stand.eigen, wiedervorlageBehalten: g.stand.wiedervorlageBehalten, vorher: standVorher, heute });
      if (soll && (soll.status !== standVorher.status || soll.wiedervorlage !== standVorher.wiedervorlage)) {
        standNeu = soll;
        standSatz = standKorrigiertSatz({ anfrageIds: g.anfrageIds, vorher: standVorher, nachher: soll, eigenText: g.stand.eigen ? g.stand.eigenText : null });
      } else if (!soll) {
        standSatz = standHinweisSatz({ anfrageIds: g.anfrageIds, stand: standVorher, eigenText: g.stand.eigenText });
      }
    }
    await tx`
      UPDATE fiaon_firmen_leads SET
        notiz = CASE WHEN ${notiz.bloecke.length > 0} THEN NULLIF(${notiz.rest}::text, '') ELSE notiz END,
        global_am = COALESCE(${rest?.am ?? null}::timestamptz, global_am),
        paketwunsch = CASE WHEN ${wunschAusGruppe} THEN ${eigenerWunsch}::text ELSE paketwunsch END,
        status = CASE WHEN ${!!standNeu} THEN ${standNeu?.status ?? null}::text ELSE status END,
        wiedervorlage = CASE WHEN ${!!standNeu} THEN ${standNeu?.wiedervorlage ?? null}::date ELSE wiedervorlage END,
        updated_at = NOW()
      WHERE id = ${quelle}`;
    zeilen.notiz = notiz.bloecke.length;

    // ── Je Karte eine Zeile im Verlauf; dazu Vermerke für alles, was bewusst NICHT umzog, und für den Stand ──
    await tx`
      INSERT INTO fiaon_firmen_log (firma_id, agent_id, agent_name, art, ergebnis, notiz) VALUES
        (${quelle}, NULL, 'System', 'system', 'getrennt', ${getrenntSatzQuelle({ anfrageIds: g.anfrageIds, zielId, zielNeu, firmaRoh })}),
        (${zielId}, NULL, 'System', 'system', 'getrennt', ${getrenntSatzZiel({ anfrageIds: g.anfrageIds, quelleId: quelle, firmaRoh, selbst })})`;
    const vermerk = vermerkSatz({ anfrageIds: g.anfrageIds, notizNicht: notiz.nicht, zweideutig: g.zweideutig });
    if (vermerk) {
      await tx`INSERT INTO fiaon_firmen_log (firma_id, agent_id, agent_name, art, ergebnis, notiz) VALUES (${quelle}, NULL, 'System', 'system', 'getrennt_hinweis', ${vermerk})`;
    }
    if (standSatz) {
      await tx`INSERT INTO fiaon_firmen_log (firma_id, agent_id, agent_name, art, ergebnis, notiz) VALUES (${quelle}, NULL, 'System', 'system', 'getrennt_hinweis', ${standSatz})`;
    }

    // ── Das Protokoll: was wohin zog und wie der Kopf vorher war (mit Status und Wiedervorlage) — der Rückweg ──
    bewegt.notiz = { bloecke: notiz.bloecke, nichtGefunden: notiz.nicht };
    bewegt.vermerk = vermerk;
    bewegt.stand = standNeu ? { vorher: standVorher, nachher: standNeu } : standSatz ? { hinweis: standSatz } : null;
    const vorher = {
      notiz: textOderNull(q.notiz), global_am: q.global_am ? new Date(q.global_am).toISOString() : null,
      paketwunsch: textOderNull(q.paketwunsch), person_id: kopfPerson, firma: firmaRoh,
      status: standVorher.status, wiedervorlage: standVorher.wiedervorlage,
    };
    await tx`UPDATE fiaon_firmen_trennung SET ziel_firma_id = ${zielId}, bewegt = ${tx.json(bewegt)}, vorher = ${tx.json(vorher)} WHERE id = ${prot.id}`;
    return { status: "getrennt", zielId, zielNeu, zeilen, vermerk: !!vermerk, stand: !!standSatz };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// DER LAUF
// ═══════════════════════════════════════════════════════════════════════════
export interface TrennErgebnis {
  modus: TrennModus;
  karten: number; platzhalter: number; gruppen: number; getrennt: number; neu: number; schon: number;
  vermerke: number; uebersprungen: number; fehler: number;
  /** Quellkarten, deren Stand vom fremden Eingang kam (trocken: geplant; an: korrigiert oder mit Hinweis). */
  stand: number;
  /** Gruppen über dem Deckel je Lauf — nur gerechnet, nicht getrennt (der Lauf meldet sich dann als Fehler). */
  gedeckelt: number;
  zeilen: TrennZeilen;
  /** Je Gruppe: Quelle, Anfragen, Ziel („neu“ oder die vorhandene Karte) — in der Trockenprobe der Plan. Nie in der Meldung. */
  plan: { quelle: number; anfragen: number[]; ziel: number | "neu" }[];
  fehlerText: string | null;
}

function leeresErgebnis(modus: TrennModus): TrennErgebnis {
  return {
    modus, karten: 0, platzhalter: 0, gruppen: 0, getrennt: 0, neu: 0, schon: 0, vermerke: 0, uebersprungen: 0, fehler: 0, stand: 0, gedeckelt: 0,
    zeilen: keineZeilen(), plan: [], fehlerText: null,
  };
}

/**
 * Ein Durchgang: Schalter lesen, lesen, planen, je Gruppe trennen (oder in der Trockenprobe nur zählen). Wirft nur, wenn schon
 * das Lesen scheitert; eine gescheiterte Gruppe rollt allein zurück (Zähler fehler) — der nächste Lauf versucht sie neu.
 * Nachbesserung (Gutachten, Mangel 9): ERST der Schalter — „aus“ fasst keine Tabelle an, „trocken“ prüft nur im Katalog.
 */
export async function firmenTrennenLauf(opt: {
  modus?: TrennModus; lauf?: Lauf; deckel?: number;
  /** Prüfstand: die Rückfall-Zuständige vorgeben (null = keine) statt globalZustaendig zu fragen. */
  rueckfall?: number | null;
} = {}): Promise<TrennErgebnis> {
  const lauf = opt.lauf ?? sqlPool;
  const modus = opt.modus ?? (await trennModus(lauf));
  if (modus === "aus") return leeresErgebnis(modus);
  const lage = await tabellenLage(lauf);
  if (!lage.karten || !lage.verlauf) return leeresErgebnis(modus);
  if (modus === "an" && !(await firmenTrennungSchema(lauf))) return leeresErgebnis(modus);
  const protokollDa = modus === "an" || lage.protokoll;
  const deckel = Math.max(0, Math.floor(opt.deckel ?? FIRMEN_TRENNEN_DECKEL));
  const erg = leeresErgebnis(modus);
  const { stand, da } = await standLesen(lauf);
  const planung = kartenPlanen(stand);
  erg.karten = planung.karten;
  erg.platzhalter = planung.platzhalter;
  erg.uebersprungen = planung.uebersprungen;
  const heute = berlinToday();
  // Die Rückfall-Zuständige (globalZustaendig: aktiv, nicht gesperrt) — einmal je Lauf, nur wenn wirklich getrennt wird.
  let rueckfall: number | null | undefined = opt.rueckfall;
  for (const p of planung.plaene) {
    // Die Notiz der Karte in der Trockenprobe: Gruppe für Gruppe, wie die Transaktionen sie nacheinander sähen.
    let notizProbe = stand.karten.find((k) => k.id === p.quelleId)?.notiz ?? null;
    for (const g of p.gruppen) {
      erg.gruppen++;
      if (protokollDa) {
        const [schon] = (await lauf`SELECT 1 AS ja FROM fiaon_firmen_trennung WHERE schluessel = ${g.schluessel}`) as any[];
        if (schon) { erg.schon++; continue; }
      }
      const ueberDeckel = modus === "an" && erg.getrennt >= deckel;
      if (modus === "trocken" || ueberDeckel) {
        const ziel = await zielSuchen(lauf, p.quelleId, g, false);
        const notiz = notizTrennen(notizProbe, g.blockZeilen);
        notizProbe = notiz.rest;
        erg.plan.push({ quelle: p.quelleId, anfragen: g.anfrageIds, ziel: ziel ? ziel.id : "neu" });
        if (ueberDeckel) { erg.gedeckelt++; continue; }
        if (!ziel) erg.neu++;
        erg.zeilen.verlauf += g.logIds.length;
        erg.zeilen.dossier += g.dossierIds.length + g.terminDossierIds.length;
        erg.zeilen.auftraege += g.auftragIds.length;
        erg.zeilen.lead += g.wegAnfragen.length + g.taktAnfragen.length + g.gespraechTermine.length + g.waAnfragen.length;
        erg.zeilen.notiz += notiz.bloecke.length;
        if (notiz.nicht > 0 || g.zweideutig > 0) erg.vermerke++;
        if (g.stand) erg.stand++;
        continue;
      }
      try {
        if (rueckfall === undefined) {
          rueckfall = await import("./fiaon-global-termin").then((m) => m.globalZustaendig()).then((z) => z?.id ?? null).catch(() => null);
        }
        const r = await gruppeTrennen(lauf, p, g, da, heute, rueckfall ?? null);
        if (r.status === "schon") { erg.schon++; continue; }
        if (r.status === "uebersprungen") { erg.uebersprungen++; continue; }
        erg.getrennt++;
        if (r.zielNeu) erg.neu++;
        if (r.vermerk) erg.vermerke++;
        if (r.stand) erg.stand++;
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

/**
 * Die Zahlen für die Lauf-Historie — nur Zahlen (laufMeldung schwärzt alles andere), höchstens 14 Felder: seltene Zähler nur,
 * wenn sie nicht 0 sind, damit die Zeilen-Zahlen Platz behalten.
 */
export function trennMeldung(e: TrennErgebnis): string | null {
  const selten = (k: string, v: number): Record<string, number> => (v > 0 ? { [k]: v } : {});
  return laufMeldung(FIRMEN_TRENNEN_LAUF, {
    ...(e.modus === "trocken" ? { trocken: true } : {}),
    ...(e.modus === "aus" ? { aus: true } : {}),
    karten: e.karten, platzhalter: e.platzhalter, gruppen: e.gruppen, getrennt: e.getrennt, neu: e.neu,
    ...selten("schon", e.schon), ...selten("uebersprungen", e.uebersprungen), ...selten("vermerke", e.vermerke),
    ...selten("stand", e.stand), ...selten("gedeckelt", e.gedeckelt),
    zeilen: { ...e.zeilen },
  });
}

let letzteZeile = 0;
let letzterPlan = "";
/** Puls: auch ohne Arbeit eine Historienzeile je 6 Stunden — die Lauf-Ampel (gelb ab 26 h) bleibt ehrlich. */
const PULS_MS = 6 * 60 * 60_000;

/**
 * Für tageslauf (nurMitErgebnis): Die Zeile MIT Zahlen schreibt der Lauf selbst — bei Arbeit, bei einem neuen Plan in der
 * Trockenprobe, sonst als Puls alle 6 Stunden (Vermerke einer Trockenprobe lösen keine Zeile aus — Gutachten, Mangel 10).
 * Deshalb immer false (stillerLauf schriebe sonst eine zweite, leere Zeile). Eine gescheiterte Gruppe oder der Deckel wirft
 * am Ende — stillerLauf schreibt den Fehler in die Historie.
 */
export async function firmenTrennenTakt(): Promise<false> {
  const start = Date.now();
  const erg = await firmenTrennenLauf();
  if (erg.getrennt > 0 || erg.fehler > 0 || erg.gedeckelt > 0 || (erg.modus === "trocken" && erg.plan.length)) {
    console.log(`[FIRMEN-TRENNEN] ${erg.modus}: ${erg.karten} Karten, ${erg.platzhalter} Kandidaten, ${erg.gruppen} fremde Gruppe(n) — `
      + `${erg.modus === "trocken" ? `würde trennen: ${erg.plan.length}` : `getrennt: ${erg.getrennt}`} (${erg.neu} neue Karte(n)), schon erledigt ${erg.schon}, `
      + `Zeilen: Verlauf ${erg.zeilen.verlauf}, Dossier ${erg.zeilen.dossier}, Aufträge ${erg.zeilen.auftraege}, Lead ${erg.zeilen.lead}, Notiz ${erg.zeilen.notiz}`
      + `${erg.vermerke ? `, ${erg.vermerke} Vermerk(e)` : ""}${erg.stand ? `, Stand ${erg.stand}` : ""}${erg.gedeckelt ? `, über dem Deckel ${erg.gedeckelt}` : ""}`
      + `${erg.fehler ? `, ${erg.fehler} Fehler` : ""}.`);
  }
  if (erg.fehler > 0) {
    throw new Error(`firmen_trennen: ${erg.getrennt} getrennt, ${erg.fehler} Gruppe(n) zurückgerollt (der nächste Lauf versucht es neu) — ${erg.fehlerText ?? "unbekannt"}`.slice(0, 600));
  }
  if (erg.gedeckelt > 0) {
    throw new Error(`firmen_trennen: Deckel ${FIRMEN_TRENNEN_DECKEL} je Lauf erreicht — ${erg.getrennt} getrennt, ${erg.gedeckelt} weitere Gruppe(n) nur gerechnet. `
      + "Bitte die Historie prüfen; der nächste Lauf trennt die nächsten (oder Schalter „firmen_trennen“ auf „trocken“).");
  }
  const planText = JSON.stringify(erg.plan);
  const neuerPlan = erg.modus === "trocken" && planText !== letzterPlan;
  if (erg.getrennt > 0 || neuerPlan || Date.now() - letzteZeile >= PULS_MS) {
    letzteZeile = Date.now();
    letzterPlan = planText;
    await sqlPool`
      INSERT INTO fiaon_lauf_historie (name, ergebnis, begonnen, beendet, dauer_ms, meldung)
      VALUES (${FIRMEN_TRENNEN_LAUF}, 'erfolg', ${new Date(start)}, NOW(), ${Date.now() - start}, ${trennMeldung(erg)})`
      .catch((e: unknown) => console.error("[FIRMEN-TRENNEN] Historie:", String((e as Error)?.message ?? e).slice(0, 160)));
  }
  return false;
}
