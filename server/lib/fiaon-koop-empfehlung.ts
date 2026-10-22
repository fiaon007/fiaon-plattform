// ═══════════════════════════════════════════════════════════════════════════
// EMPFEHLUNGEN DES PARTNERS AN FIAON — DATENBANK UND WEGE (Register E-419, 22.10.2026)
// Regeln und Texte: shared/fiaon-koop-empfehlung.ts. Tabelle: db/migrations/117_koop_empfehlungen.sql (dieselbe DDL hier).
//
//   · Melden: Partner im Partnerbereich (quelle „partner“, Aufgabe an Justin) oder Leitung im Chefbüro (quelle „fiaon“).
//   · Verknüpfen: Die Leitung ordnet der Meldung die Person zu (person_id) — erst dann zählen Zahlungen.
//   · Rechnen: Zahlungen der Person aus UMSATZ_QUELLE_SQL ab der Meldung, KOOP_PROVISION_MONATE lang, ohne Durchlaufposten.
//   · Ausgezahlt: Betrag je Meldung von Hand (ausgezahlt_cents) — die Liste zeigt verdient / ausgezahlt / offen.
// Wirft nach außen nur Ergebnis-Objekte; die Partnersicht scheitert nie an dieser Liste.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { UMSATZ_QUELLE_SQL } from "./fiaon-umsatz-quelle";
import {
  KOOP_DURCHLAUF_SCHLUESSEL, KOOP_PROVISION_MONATE, KOOP_EMPFEHLUNG_STAND_TEXT, koopProvisionAus, koopProvisionCents, koopEmpfehlungAus,
  koopBerechnungAusgesetzt, type KoopEmpfehlungStand,
} from "@shared/fiaon-koop-empfehlung";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type Ergebnis<T extends object = {}> = ({ ok: true } & T) | { ok: false; error: string; status?: number };
const nein = (error: string, status = 400): { ok: false; error: string; status: number } => ({ ok: false, error, status });
const json = <T,>(v: unknown, f: T): T => { if (v == null) return f; if (typeof v === "string") { try { return JSON.parse(v) as T; } catch { return f; } } return v as T; };
const eur = (c: number) => `${(Math.round(c) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const tag = (d: Date | string) => new Date(d).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" });

let bereit: Promise<void> | null = null;
/** Dieselbe DDL wie Migration 117 — additiv. */
export function ensureEmpfehlungTabelle(): Promise<void> {
  if (!bereit) {
    bereit = (async () => {
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_koop_empfehlungen (
          id BIGSERIAL PRIMARY KEY,
          angebot_id INTEGER NOT NULL,
          person_id INTEGER,
          name TEXT NOT NULL,
          telefon TEXT,
          email TEXT,
          notiz TEXT,
          quelle VARCHAR(20) NOT NULL DEFAULT 'fiaon',
          gemeldet_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          ausgezahlt_cents INTEGER NOT NULL DEFAULT 0,
          entfernt_am TIMESTAMPTZ,
          eingetragen_von TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_koop_empfehlungen_angebot_idx ON fiaon_koop_empfehlungen (angebot_id) WHERE entfernt_am IS NULL`;
    })().catch((e) => { bereit = null; throw e; });
  }
  return bereit;
}

export interface KoopEmpfehlungZeile {
  id: number; name: string; telefon: string | null; email: string | null; notiz: string | null; quelle: string; personId: number | null;
  gemeldetAm: string; gemeldetText: string; bisText: string; stand: KoopEmpfehlungStand; standText: string;
  umsatzCents: number; provisionCents: number; ausgezahltCents: number; offenCents: number;
  umsatz: string; provision: string; ausgezahlt: string; offen: string;
}
export interface KoopEmpfehlungSicht {
  prozent: number | null; berechnungAusgesetzt: boolean; monate: number;
  liste: KoopEmpfehlungZeile[];
  summe: { umsatz: string; provision: string; ausgezahlt: string; offen: string; provisionCents: number; offenCents: number };
}

/** Die Liste mit Umsatz und Provision je Meldung — für Partnerbereich und Chefbüro. */
export async function koopEmpfehlungSicht(z: { [k: string]: any }): Promise<KoopEmpfehlungSicht> {
  await ensureEmpfehlungTabelle();
  const schalter = json<Record<string, unknown>>(z.schalter, {});
  const prov = koopProvisionAus(schalter);
  const zeilen = (await sqlPool`
    SELECT * FROM fiaon_koop_empfehlungen WHERE angebot_id = ${Number(z.id)} AND entfernt_am IS NULL ORDER BY gemeldet_am DESC LIMIT 300`) as any[];
  const personen = Array.from(new Set(zeilen.map((x) => x.person_id).filter((x) => x != null).map(Number)));
  const geld = personen.length ? ((await sqlPool.unsafe(`
    WITH q AS (${UMSATZ_QUELLE_SQL})
    SELECT e.id, COALESCE(SUM(q.cents), 0)::int AS cents, COUNT(q.ref)::int AS n
      FROM fiaon_koop_empfehlungen e
      LEFT JOIN q ON q.person_id = e.person_id AND q.am >= e.gemeldet_am AND q.am < e.gemeldet_am + make_interval(months => $2)
       AND NOT EXISTS (SELECT 1 FROM fiaon_applications ax WHERE ax.ref = q.ref AND ax.pack_key = ANY($3::text[]))
     WHERE e.angebot_id = $1 AND e.entfernt_am IS NULL AND e.person_id IS NOT NULL
     GROUP BY e.id`, [Number(z.id), KOOP_PROVISION_MONATE, [...KOOP_DURCHLAUF_SCHLUESSEL]])) as any[]) : [];
  // Ob es schon ein Gespräch/eine Bestellung gibt (für den Stand „im Gespräch“) — irgendeine Bestellzeile der Person nach der Meldung.
  const bestellt = personen.length ? ((await sqlPool`
    SELECT DISTINCT e.id FROM fiaon_koop_empfehlungen e JOIN fiaon_applications a ON a.person_id = e.person_id AND a.created_at >= e.gemeldet_am - interval '30 days'
     WHERE e.angebot_id = ${Number(z.id)} AND e.entfernt_am IS NULL`) as any[]).map((x) => Number(x.id)) : [];
  const liste: KoopEmpfehlungZeile[] = zeilen.map((x) => {
    const g = geld.find((y) => Number(y.id) === Number(x.id));
    const umsatz = Number(g?.cents ?? 0);
    const provision = prov ? koopProvisionCents(umsatz, prov.prozent) : 0;
    const ausgezahlt = Number(x.ausgezahlt_cents ?? 0);
    const stand: KoopEmpfehlungStand = umsatz > 0 ? "kunde" : x.person_id != null && bestellt.includes(Number(x.id)) ? "im_gespraech" : "gemeldet";
    const bis = new Date(x.gemeldet_am); bis.setMonth(bis.getMonth() + KOOP_PROVISION_MONATE);
    return {
      id: Number(x.id), name: String(x.name), telefon: x.telefon ?? null, email: x.email ?? null, notiz: x.notiz ?? null, quelle: String(x.quelle),
      personId: x.person_id != null ? Number(x.person_id) : null,
      gemeldetAm: new Date(x.gemeldet_am).toISOString(), gemeldetText: tag(x.gemeldet_am), bisText: tag(bis), stand, standText: KOOP_EMPFEHLUNG_STAND_TEXT[stand],
      umsatzCents: umsatz, provisionCents: provision, ausgezahltCents: ausgezahlt, offenCents: Math.max(0, provision - ausgezahlt),
      umsatz: eur(umsatz), provision: eur(provision), ausgezahlt: eur(ausgezahlt), offen: eur(Math.max(0, provision - ausgezahlt)),
    };
  });
  const s = liste.reduce((a, x) => ({ u: a.u + x.umsatzCents, p: a.p + x.provisionCents, z: a.z + x.ausgezahltCents, o: a.o + x.offenCents }), { u: 0, p: 0, z: 0, o: 0 });
  return {
    prozent: prov?.prozent ?? null, berechnungAusgesetzt: koopBerechnungAusgesetzt(schalter), monate: KOOP_PROVISION_MONATE, liste,
    summe: { umsatz: eur(s.u), provision: eur(s.p), ausgezahlt: eur(s.z), offen: eur(s.o), provisionCents: s.p, offenCents: s.o },
  };
}

/** Eine Empfehlung festhalten. Partner (quelle „partner“): Aufgabe an Justin, damit jemand anruft und die Person zuordnet. */
export async function koopEmpfehlungEintragen(
  z: { [k: string]: any },
  roh: unknown, wer: string, quelle: "partner" | "fiaon", partnerName?: string,
): Promise<Ergebnis<{ id: number }>> {
  const e = koopEmpfehlungAus(roh);
  if (!e.ok) return nein(e.error);
  if (quelle === "partner" && (roh as any)?.einverstanden !== true) return nein("Bitte bestätigen Sie, dass die Person einverstanden ist, dass wir sie kontaktieren.");
  await ensureEmpfehlungTabelle();
  if (e.personId) {
    const [p] = (await sqlPool`SELECT id FROM fiaon_persons WHERE id = ${e.personId} LIMIT 1`) as any[];
    if (!p) return nein(`Person ${e.personId} gibt es nicht.`);
  }
  const [doppelt] = (await sqlPool`
    SELECT id FROM fiaon_koop_empfehlungen WHERE angebot_id = ${Number(z.id)} AND entfernt_am IS NULL AND lower(name) = ${e.name.toLowerCase()} LIMIT 1`) as any[];
  if (doppelt) return nein("Diese Empfehlung steht schon in der Liste.", 409);
  const [r] = (await sqlPool`
    INSERT INTO fiaon_koop_empfehlungen (angebot_id, person_id, name, telefon, email, notiz, quelle, eingetragen_von)
    VALUES (${Number(z.id)}, ${e.personId}, ${e.name}, ${e.telefon}, ${e.email}, ${e.notiz}, ${quelle}, ${wer})
    RETURNING id`) as any[];
  const id = Number(r.id);
  const { verlaufAngebot } = await import("./fiaon-global-angebot");
  await verlaufAngebot(Number(z.id), wer, `Empfehlung an FIAON: ${e.name}${e.personId ? ` (Person ${e.personId})` : ""}`).catch(() => {});
  if (quelle === "partner") {
    const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
    await auftragFuerKunden({
      personId: null, ref: null,
      titel: `Neue Empfehlung von ${partnerName ?? "einem Partner"}: ${e.name}`,
      text: [`${partnerName ?? "Ein Partner"} hat im Partnerbereich jemanden empfohlen (Kooperation ${String(z.angebot_ref ?? "")}).`,
        `Name: ${e.name}`, e.telefon ? `Telefon: ${e.telefon}` : "", e.email ? `E-Mail: ${e.email}` : "", e.notiz ? `Notiz: ${e.notiz}` : "",
        "Bitte kontaktieren und im Chefbüro (Global-Aufträge → Angebote → Kooperation) die Person zuordnen — erst dann zählt die Provision."].filter(Boolean).join("\n"),
      anBetreiber: true, dringend: true, schluessel: `koop-empfehlung:${id}`, bereich: "konten", quelle: "global", autorName: "FIAON Partnerbereich",
      link: "/chef/s/global-auftraege?reiter=angebote",
    }).catch((err) => console.error(`[KOOP] Aufgabe zur Empfehlung ${id}:`, err));
  }
  return { ok: true, id };
}

/** Leitung: Person zuordnen, Auszahlung festhalten oder Meldung entfernen. */
export async function koopEmpfehlungAendern(z: { [k: string]: any }, eid: number, roh: any, wer: string): Promise<Ergebnis> {
  await ensureEmpfehlungTabelle();
  const [x] = (await sqlPool`SELECT * FROM fiaon_koop_empfehlungen WHERE id = ${eid} AND angebot_id = ${Number(z.id)} AND entfernt_am IS NULL`) as any[];
  if (!x) return nein("Diese Empfehlung gibt es nicht.", 404);
  const { verlaufAngebot } = await import("./fiaon-global-angebot");
  if (roh?.entfernen === true) {
    await sqlPool`UPDATE fiaon_koop_empfehlungen SET entfernt_am = NOW() WHERE id = ${eid}`;
    await verlaufAngebot(Number(z.id), wer, `Empfehlung entfernt: ${x.name}`).catch(() => {});
    return { ok: true };
  }
  if (roh?.personId !== undefined) {
    const pid = roh.personId === null || roh.personId === "" ? null : Number(roh.personId);
    if (pid !== null && !(Number.isInteger(pid) && pid > 0)) return nein("Bitte eine gültige Personen-Nummer.");
    if (pid !== null) { const [p] = (await sqlPool`SELECT id FROM fiaon_persons WHERE id = ${pid} LIMIT 1`) as any[]; if (!p) return nein(`Person ${pid} gibt es nicht.`); }
    await sqlPool`UPDATE fiaon_koop_empfehlungen SET person_id = ${pid} WHERE id = ${eid}`;
    await verlaufAngebot(Number(z.id), wer, `Empfehlung ${x.name}: Person ${pid ?? "— (gelöst)"}`).catch(() => {});
  }
  if (roh?.ausgezahltCents !== undefined) {
    const c = Math.round(Number(roh.ausgezahltCents));
    if (!Number.isFinite(c) || c < 0 || c > 10_000_000) return nein("Bitte einen gültigen Betrag für „ausgezahlt“.");
    await sqlPool`UPDATE fiaon_koop_empfehlungen SET ausgezahlt_cents = ${c} WHERE id = ${eid}`;
    await verlaufAngebot(Number(z.id), wer, `Empfehlung ${x.name}: ausgezahlt ${eur(c)}`).catch(() => {});
  }
  return { ok: true };
}

/** Leitung: Provision in Prozent und „Berechnung ausgesetzt“ (Kontakte kosten 0 €, keine Monatsrechnung). */
export async function koopProvisionSetzen(z: { [k: string]: any }, roh: any, wer: string): Promise<Ergebnis> {
  const neu: Record<string, unknown> = {};
  const teile: string[] = [];
  if (roh?.prozent !== undefined) {
    const p = roh.prozent === null || roh.prozent === "" ? null : Number(String(roh.prozent).replace(",", "."));
    if (p !== null && !(Number.isFinite(p) && p > 0 && p <= 50)) return nein("Provision bitte zwischen 0 und 50 %.");
    neu.provision = p === null ? null : { prozent: Math.round(p * 100) / 100, seit: new Date().toISOString().slice(0, 10) };
    teile.push(p === null ? "Provision entfernt" : `Provision ${String(p).replace(".", ",")} %`);
  }
  if (roh?.berechnungAusgesetzt !== undefined) {
    neu.berechnungAusgesetzt = roh.berechnungAusgesetzt === true;
    teile.push(roh.berechnungAusgesetzt === true ? "Berechnung der Kontakte ausgesetzt (0 €, keine Monatsrechnung)" : "Berechnung der Kontakte wieder aktiv");
  }
  if (!teile.length) return nein("Nichts zu ändern.");
  await sqlPool`UPDATE fiaon_global_angebote SET schalter = COALESCE(schalter, '{}'::jsonb) || ${sqlPool.json(neu as any)}, updated_at = NOW() WHERE id = ${Number(z.id)}`;
  const { verlaufAngebot } = await import("./fiaon-global-angebot");
  await verlaufAngebot(Number(z.id), wer, teile.join(" · ")).catch(() => {});
  return { ok: true };
}
