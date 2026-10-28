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
  KOOP_DURCHLAUF_SCHLUESSEL, KOOP_DURCHLAUF_ABZUG_SQL, KOOP_PROVISION_MONATE, KOOP_EMPFEHLUNG_STAND_TEXT, koopProvisionAus, koopProvisionCents, koopEmpfehlungAus,
  koopBerechnungAusgesetzt, koopMonatsbericht, type KoopEmpfehlungStand,
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
  /** E-420: Monatsabrechnungen per Gutschrift und die (maskierte) Bankverbindung des Partners. */
  gutschriften: { id: number; nummer: string; monatText: string; betrag: string; stand: string }[];
  bank: { inhaber: string; maske: string } | null;
  /** E-421: der zuletzt verschickte Monatsbericht. */
  letzterBericht: { monatText: string; am: string } | null;
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
    SELECT e.id, COALESCE(SUM(q.cents - ${KOOP_DURCHLAUF_ABZUG_SQL}), 0)::int AS cents, COUNT(q.ref)::int AS n
      FROM fiaon_koop_empfehlungen e
      LEFT JOIN q ON q.person_id = e.person_id AND q.am >= e.gemeldet_am AND q.am < e.gemeldet_am + make_interval(months => $2)
       AND NOT EXISTS (SELECT 1 FROM fiaon_applications ax WHERE ax.ref = q.ref AND ax.pack_key = ANY($3::text[]))
     WHERE e.angebot_id = $1 AND e.entfernt_am IS NULL AND e.person_id IS NOT NULL
     GROUP BY e.id`, [Number(z.id), KOOP_PROVISION_MONATE, [...KOOP_DURCHLAUF_SCHLUESSEL]])) as any[]) : [];
  // Ob es schon ein Gespräch/eine Bestellung gibt (für den Stand „im Gespräch“) — irgendeine Bestellzeile der Person nach der Meldung.
  const bestellt = personen.length ? ((await sqlPool`
    SELECT DISTINCT e.id FROM fiaon_koop_empfehlungen e JOIN fiaon_applications a ON a.person_id = e.person_id AND a.created_at >= e.gemeldet_am - interval '30 days'
     WHERE e.angebot_id = ${Number(z.id)} AND e.entfernt_am IS NULL`) as any[]).map((x) => Number(x.id)) : [];
  // E-420: Ausgezahlt = von Hand eingetragen + Posten aus Gutschriften, deren Banking-Auftrag ausgeführt ist.
  const gs = await koopGutschriftenListe(Number(z.id)).catch(() => []);
  const ausGs = new Map<number, number>();
  for (const g of gs) if (g.stand === "ausgezahlt") for (const p of g.posten) ausGs.set(p.empfehlungId, (ausGs.get(p.empfehlungId) ?? 0) + p.provisionCents);
  const liste: KoopEmpfehlungZeile[] = zeilen.map((x) => {
    const g = geld.find((y) => Number(y.id) === Number(x.id));
    const umsatz = Number(g?.cents ?? 0);
    const provision = prov ? koopProvisionCents(umsatz, prov.prozent) : 0;
    const ausgezahlt = Number(x.ausgezahlt_cents ?? 0) + (ausGs.get(Number(x.id)) ?? 0);
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
    gutschriften: gs.map((g) => ({ id: g.id, nummer: g.nummer, monatText: g.monatText, betrag: g.betrag, stand: g.stand })),
    bank: koopBankMaske(schalter),
    letzterBericht: await koopLetzterBericht(Number(z.id)).catch(() => null),
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

// ═══════════════════════════════════════════════════════════════════════════
// MONATSABRECHNUNG PER GUTSCHRIFT (E-420, 22.10.2026)
//
// Justin: „bau die automatische Monatsabrechnung mit Gutschrift“. Ablauf je Partner mit Provision, für jeden abgeschlossenen
// Monat (frühestens am 3. des Folgemonats — Puffer für Buchungen mit Eingangstag im Vormonat):
//   1. Posten = jede gebuchte Zahlung eines zugeordneten empfohlenen Kunden in diesem Monat (UMSATZ_QUELLE_SQL), innerhalb der
//      12 Monate ab Meldung, ohne Durchlaufposten; Provision je Zahlung = kaufmännisch gerundet.
//   2. Summe > 0 → Gutschrift mit fortlaufender Nummer FIAON-GS-JJJJ-NNNNN (fiaon_counters „gutschrift-JJJJ“), PDF, Mail an den Partner.
//   3. Bankverbindung im Partnerbereich hinterlegt → Zahlungsauftrag im FIAON Banking (Entwurf des Inhabers, Beleg = Gutschrift-PDF);
//      ausgezahlt ist die Gutschrift erst, wenn die Buchhaltung den Auftrag ausgeführt hat (E-347). Ohne Bankverbindung: Bitte in der
//      Mail und Aufgabe an Justin; der Auftrag entsteht im nächsten Lauf, sobald die IBAN da ist.
// Nie doppelt: UNIQUE(angebot_id, monat) unter Advisory-Lock. Bewegt nie selbst Geld.
// ═══════════════════════════════════════════════════════════════════════════
const GS_SPERRE = 4_200_420;
let gsBereit: Promise<void> | null = null;
/** Dieselbe DDL wie Migration 118 — additiv. */
export function ensureGutschriftTabelle(): Promise<void> {
  if (!gsBereit) {
    gsBereit = (async () => {
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_koop_gutschriften (
          id BIGSERIAL PRIMARY KEY,
          angebot_id INTEGER NOT NULL,
          monat VARCHAR(7) NOT NULL,
          nummer TEXT NOT NULL UNIQUE,
          prozent NUMERIC(5,2) NOT NULL,
          betrag_cents INTEGER NOT NULL,
          posten JSONB NOT NULL DEFAULT '[]'::jsonb,
          erstellt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          mail_am TIMESTAMPTZ,
          mail_ergebnis TEXT,
          auftrag_id INTEGER,
          aufgabe_am TIMESTAMPTZ,
          UNIQUE (angebot_id, monat)
        )`;
    })().catch((e) => { gsBereit = null; throw e; });
  }
  return gsBereit;
}

const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
export const gsMonatText = (m: string) => `${MONATE[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
const berlinMonat = (d: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit" }).format(d).slice(0, 7);
const berlinTagNr = (d: Date) => Number(new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "numeric" }).format(d));
const vormonat = (m: string) => { const [j, mo] = m.split("-").map(Number); return mo === 1 ? `${j - 1}-12` : `${j}-${String(mo - 1).padStart(2, "0")}`; };

export interface GsPosten { empfehlungId: number; name: string; ref: string; am: string; umsatzCents: number; provisionCents: number }
/** Die Posten eines Monats (Berliner Kalendermonat) — rein lesend. */
export async function koopGutschriftPosten(angebotId: number, monat: string, prozent: number): Promise<GsPosten[]> {
  await ensureEmpfehlungTabelle();
  const roh = (await sqlPool.unsafe(`
    WITH q AS (${UMSATZ_QUELLE_SQL})
    SELECT e.id AS eid, e.name, q.ref, q.am, (q.cents - ${KOOP_DURCHLAUF_ABZUG_SQL}) AS cents
      FROM fiaon_koop_empfehlungen e
      JOIN q ON q.person_id = e.person_id AND q.am >= e.gemeldet_am AND q.am < e.gemeldet_am + make_interval(months => $2)
     WHERE e.angebot_id = $1 AND e.entfernt_am IS NULL AND e.person_id IS NOT NULL
       AND to_char(q.am AT TIME ZONE 'Europe/Berlin', 'YYYY-MM') = $3
       AND NOT EXISTS (SELECT 1 FROM fiaon_applications ax WHERE ax.ref = q.ref AND ax.pack_key = ANY($4::text[]))
     ORDER BY q.am`, [angebotId, KOOP_PROVISION_MONATE, monat, [...KOOP_DURCHLAUF_SCHLUESSEL]])) as any[];
  return roh.map((r) => ({ empfehlungId: Number(r.eid), name: String(r.name), ref: String(r.ref), am: new Date(r.am).toISOString(), umsatzCents: Number(r.cents), provisionCents: koopProvisionCents(Number(r.cents), prozent) }));
}

async function gutschriftNummer(jahr: number, tx: any): Promise<string> {
  const name = `gutschrift-${jahr}`;
  await tx`INSERT INTO fiaon_counters (name, value) VALUES (${name}, 0) ON CONFLICT (name) DO NOTHING`;
  const [r] = (await tx`UPDATE fiaon_counters SET value = value + 1 WHERE name = ${name} RETURNING value`) as any[];
  return `FIAON-GS-${jahr}-${String(r.value).padStart(5, "0")}`;
}

/** Legt die Gutschrift eines Monats an (genau einmal). Rückgabe null = nichts zu tun (keine Provision oder schon da). */
export async function koopGutschriftAnlegen(z: { [k: string]: any }, monat: string): Promise<{ id: number; nummer: string; betragCents: number } | null> {
  await ensureGutschriftTabelle();
  const prov = koopProvisionAus(json<Record<string, unknown>>(z.schalter, {}));
  if (!prov) return null;
  const posten = await koopGutschriftPosten(Number(z.id), monat, prov.prozent);
  const betrag = posten.reduce((s, p) => s + p.provisionCents, 0);
  if (betrag <= 0) return null;
  return sqlPool.begin(async (tx: any) => {
    await tx`SELECT pg_advisory_xact_lock(${GS_SPERRE}, ${Number(z.id)})`;
    const [da] = (await tx`SELECT id FROM fiaon_koop_gutschriften WHERE angebot_id = ${Number(z.id)} AND monat = ${monat}`) as any[];
    if (da) return null;
    const nummer = await gutschriftNummer(Number(monat.slice(0, 4)), tx);
    const [r] = (await tx`
      INSERT INTO fiaon_koop_gutschriften (angebot_id, monat, nummer, prozent, betrag_cents, posten)
      VALUES (${Number(z.id)}, ${monat}, ${nummer}, ${prov.prozent}, ${betrag}, ${tx.json(posten as any)}) RETURNING id`) as any[];
    return { id: Number(r.id), nummer, betragCents: betrag };
  });
}

/** Die Gutschrift als PDF (FIAON-Rahmen). */
export async function koopGutschriftPdf(id: number): Promise<{ pdf: Buffer; dateiname: string } | null> {
  await ensureGutschriftTabelle();
  const [g] = (await sqlPool`SELECT * FROM fiaon_koop_gutschriften WHERE id = ${id}`) as any[];
  if (!g) return null;
  const { angebotLesen } = await import("./fiaon-global-angebot");
  const { koopDatenAus } = await import("./fiaon-global-angebot-koop");
  const { koopPartnerName } = await import("@shared/fiaon-global-angebot-koop");
  const z = await angebotLesen({ id: Number(g.angebot_id) });
  if (!z) return null;
  const d = koopDatenAus(z);
  const p = d.partner as any;
  const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const posten = json<GsPosten[]>(g.posten, []);
  const zeilen = posten.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(tag(x.am))}</td><td>${esc(x.name)}</td><td style="text-align:right">${esc(eur(x.umsatzCents))}</td><td style="text-align:right">${esc(eur(x.provisionCents))}</td></tr>`).join("");
  const prozentText = String(Number(g.prozent)).replace(".", ",");
  const body = `
    <table style="width:100%;font-size:9.5pt;margin-bottom:14px" cellpadding="3"><tr>
      <td style="vertical-align:top;width:55%"><b>Gutschriftsempfänger</b><br>${esc(koopPartnerName(p))}${p.firma ? `<br>${esc(p.firma)}` : ""}<br>${esc(p.strasse)}<br>${esc(p.plz)} ${esc(p.ort)}</td>
      <td style="vertical-align:top"><b>Gutschrift-Nr.</b> ${esc(g.nummer)}<br><b>Datum</b> ${esc(tag(g.erstellt_am))}<br><b>Zeitraum</b> ${esc(gsMonatText(g.monat))}<br><b>Vertrag</b> ${esc(d.ref)}</td>
    </tr></table>
    <p>Provision ${esc(prozentText)} % auf die Zahlungen der von Ihnen empfohlenen Kunden (Tippgeber-Vereinbarung zum Kooperationsvertrag ${esc(d.ref)}).</p>
    <table style="width:100%;border-collapse:collapse;font-size:9pt" border="0" cellpadding="4">
      <thead><tr style="border-bottom:1px solid #0f2044;text-align:left"><th>#</th><th>Zahlungseingang</th><th>Empfohlener Kunde</th><th style="text-align:right">Zahlung</th><th style="text-align:right">Provision</th></tr></thead>
      <tbody>${zeilen}</tbody>
      <tfoot><tr style="border-top:1px solid #0f2044"><td colspan="4"><strong>Gutschriftsbetrag</strong></td><td style="text-align:right"><strong>${esc(eur(Number(g.betrag_cents)))}</strong></td></tr></tfoot>
    </table>
    <p style="font-size:8.5pt;color:#475569;margin-top:14px">Gutschrift im Sinne des § 14 Abs. 2 Satz 2 UStG. Die Leistung wird an die FIAON LTD (Vereinigtes Königreich) erbracht; Leistungsort ist der Sitz des Leistungsempfängers — die Gutschrift weist deshalb keine Umsatzsteuer aus. Widerspricht der Empfänger dieser Gutschrift, verliert sie ihre Wirkung als Rechnung. Auszahlung binnen vierzehn Tagen auf das im Partnerbereich hinterlegte Konto.</p>`;
  const { wrapFiaonDocument, htmlZuPdfMitFusszeile } = await import("./fiaon-html-pdf");
  const titel = `Gutschrift ${g.nummer}`;
  const html = wrapFiaonDocument({ documentTitle: "Gutschrift", subtitle: `Provision · ${gsMonatText(g.monat)}`, bodyHtml: body, markenzeile: "FIAON LTD · Company No. 17318250 · 128 City Road, London, EC1V 2NX, United Kingdom" });
  const pdf = await htmlZuPdfMitFusszeile({ html, titel, fusszeile: `FIAON LTD · ${g.nummer} · ${d.ref}`, rand: { oben: "18mm", unten: "20mm", links: "16mm", rechts: "16mm" } });
  return { pdf, dateiname: `${g.nummer}.pdf` };
}

/** Bankverbindung des Partners (selbst im Partnerbereich hinterlegt) — verschlüsselt im Schalter, angezeigt nur maskiert. */
export async function koopBankSetzen(z: { [k: string]: any }, roh: any, wer: string): Promise<Ergebnis<{ maske: string }>> {
  const { ibanSauber, ibanGueltig } = await import("./fiaon-buchhaltung");
  const inhaber = String(roh?.inhaber ?? "").replace(/[<>\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
  const iban = ibanSauber(String(roh?.iban ?? ""));
  if (inhaber.length < 3) return nein("Bitte den Kontoinhaber angeben.");
  if (!ibanGueltig(iban)) return nein("Diese IBAN ist nicht gültig — bitte noch einmal prüfen.");
  const { encryptSecret } = await import("../routes/fiaon-agent");
  const maske = `${iban.slice(0, 4)} •••• ${iban.slice(-4)}`;
  await sqlPool`UPDATE fiaon_global_angebote SET schalter = COALESCE(schalter, '{}'::jsonb) || ${sqlPool.json({ bank: { inhaber, ibanEnc: encryptSecret(iban), maske, am: new Date().toISOString() } } as any)}, updated_at = NOW() WHERE id = ${Number(z.id)}`;
  const { verlaufAngebot } = await import("./fiaon-global-angebot");
  await verlaufAngebot(Number(z.id), wer, `Bankverbindung für Provisionen hinterlegt (${maske})`).catch(() => {});
  return { ok: true, maske };
}
function bankAus(schalter: unknown): { inhaber: string; ibanEnc: string; maske: string } | null {
  const b = json<Record<string, any>>(schalter, {}).bank;
  return b && typeof b.ibanEnc === "string" && typeof b.inhaber === "string" ? { inhaber: b.inhaber, ibanEnc: b.ibanEnc, maske: String(b.maske ?? "") } : null;
}

/** Zahlungsauftrag im Banking (Entwurf des Inhabers, Beleg = PDF) — nur mit Bankverbindung, nur einmal je Gutschrift. */
async function gutschriftAuftrag(g: any, z: { [k: string]: any }): Promise<number | null> {
  if (g.auftrag_id) return Number(g.auftrag_id);
  const bank = bankAus(z.schalter);
  if (!bank) return null;
  const { decryptSecret } = await import("../routes/fiaon-agent");
  const iban = decryptSecret(bank.ibanEnc);
  if (!iban) return null;
  const pdf = await koopGutschriftPdf(Number(g.id));
  const B = await import("./fiaon-buchhaltung");
  const a = await B.auftragAnlegen({
    empfaenger: bank.inhaber, iban, betragCents: Number(g.betrag_cents),
    zweck: `Gutschrift ${g.nummer} · Provision ${gsMonatText(g.monat)}`, kategorie: "Provision Partner",
    belegName: pdf?.dateiname ?? null, belegBase64: pdf ? pdf.pdf.toString("base64") : null,
  }, B.inhaber());
  await sqlPool`UPDATE fiaon_koop_gutschriften SET auftrag_id = ${a.id} WHERE id = ${Number(g.id)} AND auftrag_id IS NULL`;
  return a.id;
}

/** Stundenlauf (aus koopLieferLauf): Gutschriften für abgeschlossene Monate, Mail, Banking-Auftrag, Aufgabe. Wirft nie. */
export async function koopGutschriftenLauf(jetzt = new Date()): Promise<{ angelegt: number; mails: number; auftraege: number }> {
  let angelegt = 0; let mails = 0; let auftraege = 0;
  try {
    await ensureGutschriftTabelle(); await ensureEmpfehlungTabelle();
    const partner = (await sqlPool`
      SELECT * FROM fiaon_global_angebote WHERE fassung LIKE 'IA-KOOP-%' AND status = 'angenommen' AND (schalter->'provision'->>'prozent') IS NOT NULL`) as any[];
    const bis = berlinTagNr(jetzt) >= 3 ? vormonat(berlinMonat(jetzt)) : vormonat(vormonat(berlinMonat(jetzt)));
    for (const z of partner) {
      const [erste] = (await sqlPool`SELECT MIN(gemeldet_am) AS m FROM fiaon_koop_empfehlungen WHERE angebot_id = ${Number(z.id)} AND entfernt_am IS NULL AND person_id IS NOT NULL`) as any[];
      if (!erste?.m) continue;
      for (let m = berlinMonat(new Date(erste.m)); m <= bis; m = (() => { const [j, mo] = m.split("-").map(Number); return mo === 12 ? `${j + 1}-01` : `${j}-${String(mo + 1).padStart(2, "0")}`; })()) {
        if (await koopGutschriftAnlegen(z, m).catch((e) => { console.error(`[KOOP] Gutschrift ${z.angebot_ref} ${m}:`, e); return null; })) angelegt++;
      }
    }
    // E-421: Erst der Monatsbericht — er trägt die Gutschrift des Monats als Anhang (dann keine zweite Mail).
    {
      const { angebotLesen } = await import("./fiaon-global-angebot");
      for (const roh of partner) {
        const z = await angebotLesen({ id: Number(roh.id) }).catch(() => null);
        if (z) await koopMonatsberichtSenden(z, bis).catch((e) => console.error(`[KOOP] Monatsbericht ${roh.angebot_ref} ${bis}:`, e));
      }
    }
    // Versand, Banking-Auftrag und Aufgabe — auch für Gutschriften, deren Bankverbindung erst später kam.
    const offen = (await sqlPool`SELECT * FROM fiaon_koop_gutschriften WHERE mail_am IS NULL OR auftrag_id IS NULL OR aufgabe_am IS NULL ORDER BY id LIMIT 50`) as any[];
    const { koopDatenAus } = await import("./fiaon-global-angebot-koop");
    const { koopPartnerAnrede } = await import("@shared/fiaon-global-angebot-koop");
    const { angebotLesen } = await import("./fiaon-global-angebot");
    for (const g of offen) {
      const z = await angebotLesen({ id: Number(g.angebot_id) });
      if (!z) continue;
      const d = koopDatenAus(z);
      const auftragId = await gutschriftAuftrag(g, z).catch((e) => { console.error(`[KOOP] Auftrag zu ${g.nummer}:`, e); return null; });
      if (auftragId && !g.auftrag_id) {
        auftraege++;
        // Die Aufgabe entstand vielleicht schon ohne Bankverbindung — Titel und Text nachziehen (der Schlüssel legt nie eine zweite an).
        if (g.aufgabe_am) await sqlPool`
          UPDATE fiaon_betreiber_todos SET titel = ${`Gutschrift ${g.nummer}: ${eur(Number(g.betrag_cents))} Provision an ${d.partner.vorname} ${d.partner.nachname} — im Banking freigeben`},
                 text = ${`Provision ${gsMonatText(g.monat)} aus dem Kooperationsvertrag ${d.ref}. Die Bankverbindung ist jetzt da: Im FIAON Banking › Aufträge liegt der Zahlungsauftrag als Entwurf (Beleg = Gutschrift) — einreichen bzw. „Zur Freigabe“ an Florentine. Das System bewegt kein Geld selbst.`},
                 updated_at = NOW()
           WHERE schluessel = ${`koop-gutschrift:${g.id}`} AND status <> 'erledigt'`.catch(() => {});
      }
      if (!g.mail_am) {
        const pdf = await koopGutschriftPdf(Number(g.id));
        const { koopPartnerLink } = await import("./fiaon-koop-lieferung");
        const ohneBank = !bankAus(z.schalter);
        const { freitextSenden } = await import("../mail/motor");
        const text = [
          `Ihre Provision für ${gsMonatText(g.monat)} ist abgerechnet: ${eur(Number(g.betrag_cents))} (${String(Number(g.prozent)).replace(".", ",")} % auf die Zahlungen Ihrer empfohlenen Kunden). Die Gutschrift ${g.nummer} mit allen Posten liegt bei.`,
          ohneBank ? "Damit wir überweisen können, hinterlegen Sie bitte einmal Ihre Bankverbindung in Ihrem Partnerbereich (Abschnitt „Ihre Auszahlungen“)." : "Wir überweisen den Betrag in den nächsten Tagen auf Ihr hinterlegtes Konto.",
          `Ihr Partnerbereich: ${koopPartnerLink(z)}`,
        ].join("\n\n");
        const r = await freitextSenden({ an: d.partner.email, betreff: `Ihre Gutschrift ${g.nummer} — Provision ${gsMonatText(g.monat)}`, text, anrede: `${koopPartnerAnrede(d.partner)},`, absender: "accounting", anhaenge: pdf ? [{ name: pdf.dateiname, inhalt: pdf.pdf }] : [] });
        const { mailProtokoll } = await import("./fiaon-mail-log");
        await mailProtokoll({ event: "koop_gutschrift", personId: z.person_id != null ? Number(z.person_id) : null, empfaenger: d.partner.email, status: r.ok ? "versandt" : "fehlgeschlagen", grund: r.grund ?? null, payload: { betreff: g.nummer }, ausgeloestVon: "Kooperation (Automatik)", brevoMessageId: r.messageId }).catch(() => {});
        await sqlPool`UPDATE fiaon_koop_gutschriften SET mail_am = ${r.ok ? new Date() : null}, mail_ergebnis = ${r.ok ? "versandt" : String(r.grund ?? "fehlgeschlagen").slice(0, 300)} WHERE id = ${Number(g.id)}`;
        if (r.ok) mails++;
      }
      if (!g.aufgabe_am) {
        const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
        await auftragFuerKunden({
          personId: null, ref: null,
          titel: `Gutschrift ${g.nummer}: ${eur(Number(g.betrag_cents))} Provision an ${d.partner.vorname} ${d.partner.nachname} — ${auftragId ? "im Banking freigeben" : "Bankverbindung fehlt noch"}`,
          text: [`Provision ${gsMonatText(g.monat)} aus dem Kooperationsvertrag ${d.ref} (${String(Number(g.prozent)).replace(".", ",")} %). Gutschrift-PDF ging automatisch an den Partner.`,
            auftragId ? "Im FIAON Banking › Aufträge liegt der Zahlungsauftrag als Entwurf (Beleg = Gutschrift) — einreichen bzw. „Zur Freigabe“ an Florentine." : "Der Partner hat noch keine Bankverbindung hinterlegt; der Zahlungsauftrag entsteht automatisch, sobald er sie im Partnerbereich einträgt.",
            "Das System bewegt kein Geld selbst."].join("\n"),
          anBetreiber: true, dringend: false, schluessel: `koop-gutschrift:${g.id}`, bereich: "konten", quelle: "global", autorName: "FIAON Kooperation", link: "/chef/s/global-auftraege?reiter=angebote",
        }).then(() => sqlPool`UPDATE fiaon_koop_gutschriften SET aufgabe_am = NOW() WHERE id = ${Number(g.id)}`).catch((e) => console.error(`[KOOP] Aufgabe zu ${g.nummer}:`, e));
      }
    }
  } catch (e) {
    console.error("[KOOP] Gutschriften-Lauf:", e instanceof Error ? e.message : e);
  }
  return { angelegt, mails, auftraege };
}

/** Gutschriften eines Partners für Partnerbereich und Chefbüro (Stand aus dem Banking: ausgeführt = ausgezahlt). */
export async function koopGutschriftenListe(angebotId: number): Promise<{ id: number; nummer: string; monatText: string; betrag: string; betragCents: number; stand: "abgerechnet" | "zur Auszahlung" | "ausgezahlt"; posten: GsPosten[] }[]> {
  await ensureGutschriftTabelle();
  const [t] = (await sqlPool`SELECT to_regclass('public.fiaon_buch_auftrag') AS t`) as any[];
  const rows = (t?.t
    ? await sqlPool`SELECT g.*, b.status AS auftrag_status FROM fiaon_koop_gutschriften g LEFT JOIN fiaon_buch_auftrag b ON b.id = g.auftrag_id WHERE g.angebot_id = ${angebotId} ORDER BY g.monat DESC`
    : await sqlPool`SELECT g.*, NULL AS auftrag_status FROM fiaon_koop_gutschriften g WHERE g.angebot_id = ${angebotId} ORDER BY g.monat DESC`) as any[];
  return rows.map((g) => ({
    id: Number(g.id), nummer: String(g.nummer), monatText: gsMonatText(String(g.monat)), betrag: eur(Number(g.betrag_cents)), betragCents: Number(g.betrag_cents),
    stand: g.auftrag_status === "ausgefuehrt" ? "ausgezahlt" : g.auftrag_id ? "zur Auszahlung" : "abgerechnet",
    posten: json<GsPosten[]>(g.posten, []),
  }));
}
export function koopBankMaske(schalter: unknown): { inhaber: string; maske: string } | null {
  const b = bankAus(schalter);
  return b ? { inhaber: b.inhaber, maske: b.maske } : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// MONATSBERICHT AN DEN PARTNER (E-421) — Texte: koopMonatsbericht in shared/fiaon-koop-empfehlung.ts.
// Einmal je Partner und Monat (Tabelle fiaon_koop_monatsberichte, Migration 119), ab dem 3. für den Vormonat, nur solange
// mindestens eine Empfehlung im Monat zählt. Höchstens drei Versuche; die Gutschrift des Monats hängt an.
// ═══════════════════════════════════════════════════════════════════════════
let mbBereit: Promise<void> | null = null;
export function ensureMonatsberichtTabelle(): Promise<void> {
  if (!mbBereit) {
    mbBereit = (async () => {
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_koop_monatsberichte (
          id BIGSERIAL PRIMARY KEY,
          angebot_id INTEGER NOT NULL,
          monat VARCHAR(7) NOT NULL,
          versuche INTEGER NOT NULL DEFAULT 1,
          gesendet_am TIMESTAMPTZ,
          ergebnis TEXT,
          gutschrift_id BIGINT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (angebot_id, monat)
        )`;
    })().catch((e) => { mbBereit = null; throw e; });
  }
  return mbBereit;
}

async function koopLetzterBericht(angebotId: number): Promise<{ monatText: string; am: string } | null> {
  await ensureMonatsberichtTabelle();
  const [r] = (await sqlPool`SELECT monat, gesendet_am FROM fiaon_koop_monatsberichte WHERE angebot_id = ${angebotId} AND gesendet_am IS NOT NULL ORDER BY monat DESC LIMIT 1`) as any[];
  return r ? { monatText: gsMonatText(String(r.monat)), am: tag(r.gesendet_am) } : null;
}

/** Der Bericht eines Monats — für Versand und Vorschau im Chefbüro. null = in diesem Monat zählt keine Empfehlung. */
export async function koopMonatsberichtBauen(z: { [k: string]: any }, monat: string) {
  await ensureEmpfehlungTabelle(); await ensureGutschriftTabelle();
  const prov = koopProvisionAus(json<Record<string, unknown>>(z.schalter, {}));
  if (!prov) return null;
  const zaehlt = (await sqlPool`
    SELECT id, to_char(gemeldet_am AT TIME ZONE 'Europe/Berlin', 'YYYY-MM') AS m FROM fiaon_koop_empfehlungen
     WHERE angebot_id = ${Number(z.id)} AND entfernt_am IS NULL
       AND to_char(gemeldet_am AT TIME ZONE 'Europe/Berlin', 'YYYY-MM') <= ${monat}
       AND to_char((gemeldet_am + make_interval(months => ${KOOP_PROVISION_MONATE})) AT TIME ZONE 'Europe/Berlin', 'YYYY-MM') >= ${monat}`) as any[];
  if (!zaehlt.length) return null;
  const neuIds = new Set(zaehlt.filter((x) => x.m === monat).map((x) => Number(x.id)));
  const sicht = await koopEmpfehlungSicht(z);
  const [g] = (await sqlPool`SELECT * FROM fiaon_koop_gutschriften WHERE angebot_id = ${Number(z.id)} AND monat = ${monat}`) as any[];
  const posten = g ? [] : await koopGutschriftPosten(Number(z.id), monat, prov.prozent);
  const { koopDatenAus } = await import("./fiaon-global-angebot-koop");
  const { koopPartnerAnrede } = await import("@shared/fiaon-global-angebot-koop");
  const { koopPartnerLink } = await import("./fiaon-koop-lieferung");
  const d = koopDatenAus(z as any);
  const bericht = koopMonatsbericht({
    monatText: gsMonatText(monat), anrede: `${koopPartnerAnrede(d.partner)},`, prozent: prov.prozent, link: koopPartnerLink(z as any),
    liste: sicht.liste.map((x) => ({ name: x.name, standText: x.standText, provision: x.provision, neu: neuIds.has(x.id) })),
    zahlen: {
      gesamt: sicht.liste.length, kunden: sicht.liste.filter((x) => x.stand === "kunde").length, neu: neuIds.size,
      monatProvision: eur(posten.reduce((a, p) => a + p.provisionCents, 0)), verdient: sicht.summe.provision, ausgezahlt: sicht.summe.ausgezahlt, offen: sicht.summe.offen,
    },
    gutschrift: g ? { nummer: String(g.nummer), betrag: eur(Number(g.betrag_cents)) } : null,
    bank: sicht.bank ? { maske: sicht.bank.maske } : null,
  });
  return { bericht, gutschrift: g ?? null, an: String(d.partner.email ?? "") };
}

/** Der Baustein-Teil für den Mail-Motor (FIAON-Partner-Kopf, eigener Fuß). */
export function koopMonatsberichtBaustein(b: ReturnType<typeof koopMonatsbericht>, monatText: string) {
  return {
    absaetze: b.absaetze, daten: b.daten, knopf: b.knopf, knopf2: b.knopf2, fussnote: b.fussnote, anhang: b.anhang,
    preheader: `Ihr Überblick für ${monatText}: Empfehlungen, Stand und Provision.`, persoenlich: false,
    bereich: "business" as const, kopfSatz: "FIAON Partner", rechtsSatz: "Diese Übersicht gehört zu Ihrer Tippgeber-Vereinbarung mit FIAON.",
  };
}

/** Schickt den Bericht eines Monats genau einmal (höchstens drei Versuche). Wirft nicht nach außen über den Lauf hinaus. */
export async function koopMonatsberichtSenden(z: { [k: string]: any }, monat: string): Promise<boolean> {
  await ensureMonatsberichtTabelle();
  const [schon] = (await sqlPool`SELECT gesendet_am, versuche FROM fiaon_koop_monatsberichte WHERE angebot_id = ${Number(z.id)} AND monat = ${monat}`) as any[];
  if (schon && (schon.gesendet_am || Number(schon.versuche) >= 3)) return false;
  const bau = await koopMonatsberichtBauen(z, monat);
  if (!bau) return false;
  // Platz nehmen (atomar): neu anlegen oder einen offenen Versuch hochzählen — ein zweiter Lauf bekommt keine Zeile zurück.
  const [platz] = (await sqlPool`
    INSERT INTO fiaon_koop_monatsberichte (angebot_id, monat) VALUES (${Number(z.id)}, ${monat})
    ON CONFLICT (angebot_id, monat) DO UPDATE SET versuche = fiaon_koop_monatsberichte.versuche + 1
     WHERE fiaon_koop_monatsberichte.gesendet_am IS NULL AND fiaon_koop_monatsberichte.versuche < 3 AND fiaon_koop_monatsberichte.ergebnis IS NOT NULL
    RETURNING id`) as any[];
  if (!platz) return false;
  const g = bau.gutschrift;
  const pdf = g ? await koopGutschriftPdf(Number(g.id)) : null;
  const { freitextSenden } = await import("../mail/motor");
  const r = await freitextSenden({
    an: bau.an, betreff: bau.bericht.betreff, text: bau.bericht.text, absender: g ? "accounting" : "welcome",
    anhaenge: pdf ? [{ name: pdf.dateiname, inhalt: pdf.pdf }] : [], baustein: koopMonatsberichtBaustein(bau.bericht, gsMonatText(monat)),
  });
  const { mailProtokoll } = await import("./fiaon-mail-log");
  await mailProtokoll({ event: "koop_monatsbericht", personId: z.person_id != null ? Number(z.person_id) : null, empfaenger: bau.an, status: r.ok ? "versandt" : "fehlgeschlagen", grund: r.grund ?? null, payload: { betreff: bau.bericht.betreff }, ausgeloestVon: "Kooperation (Automatik)", brevoMessageId: r.messageId }).catch(() => {});
  await sqlPool`UPDATE fiaon_koop_monatsberichte SET gesendet_am = ${r.ok ? new Date() : null}, ergebnis = ${r.ok ? "versandt" : String(r.grund ?? "fehlgeschlagen").slice(0, 300)}, gutschrift_id = ${g ? Number(g.id) : null} WHERE id = ${Number(platz.id)}`;
  if (r.ok && g) await sqlPool`UPDATE fiaon_koop_gutschriften SET mail_am = NOW(), mail_ergebnis = 'im Monatsbericht' WHERE id = ${Number(g.id)} AND mail_am IS NULL`;
  if (r.ok) {
    const { verlaufAngebot } = await import("./fiaon-global-angebot");
    await verlaufAngebot(Number(z.id), "Kooperation (Automatik)", `Monatsbericht ${gsMonatText(monat)} an den Partner${g ? ` (mit Gutschrift ${g.nummer})` : ""}`).catch(() => {});
  }
  return r.ok;
}
