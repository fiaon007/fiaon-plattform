// ═══════════════════════════════════════════════════════════════════════════
// BEZAHLTES ANRECHNEN — EIN GUTHABEN WIRD ZUM ABO (E-354, 14.10.2026)
//
// Justin (Fall Dogan Cengiz, Team-Chat 14.10.): Er hat damals das 99,99-€-Paket
// bezahlt und wollte kündigen; jetzt will er die bezahlten 99,99 € für das
// kleinste Paket über ein Jahr nutzen. „Gib dem Kunden das 7,99-Paket, er hat
// bereits 99,99 bezahlt, die sollen ihm auf das Abo angerechnet werden … stelle
// es überall um, dass wir es sehen, aber auch der Kunde richtig.“
//
// ── DIE REGEL ─────────────────────────────────────────────────────────────
//   Quelle  eine STORNIERTE Bestellung derselben Person mit bezahlten Raten
//           (das Geld ist da, die Leistung endete) — abzüglich dessen, was
//           schon angerechnet wurde.
//   Ziel    eine NICHT bezahlte Abo-Bestellung derselben Person (kein
//           Einmalkauf, keine Raten), Preis aus dem Katalog.
//   Rechnung  Raten = min(12, ⌊Guthaben / Preis⌋), jede als bezahlt mit
//           quelle 'anrechnung'. Bleibt ein Rest, mindert er die nächste Rate
//           (innerhalb der zwölf sofort, sonst Rate 13 bei Verlängerung).
//
// ── WAS NICHT PASSIERT ────────────────────────────────────────────────────
//   · Kein Umsatz: Das Geld wurde am Tag der Zahlung gezählt. UMSATZ_QUELLE_SQL
//     lässt Raten mit quelle 'anrechnung' aus — sonst stünde es doppelt.
//   · Keine Provision, keine Zahlungsmail: Es kommt kein Geld herein; der Weg
//     geht bewusst NICHT über rateBezahltBuchen / mark-paid / onCustomerPaid.
//   · Kein Geld wird bewegt, keine Bestellung storniert, nichts gelöscht.
// Nur auf Knopfdruck der Geschäftsführung (Akte › Verwaltung), mit Vorschau.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { paketPreisCents } from "@shared/fiaon-pakete";
import { istKeinAboPaket } from "./fiaon-kein-abo";
import { ankerTag, faelligkeit } from "./fiaon-abo-zyklus";
import { berlinToday } from "./fiaon-time";

type Lauf = typeof sqlPool;
export const ANRECHNUNG_QUELLE = "anrechnung";
/** Ein Jahresvertrag hat zwölf Raten (ABO_LAUFZEIT_RATEN in fiaon-abo.ts). */
const LAUFZEIT = 12;

let bereit: Promise<void> | null = null;
export function ensureAnrechnungTabelle(): Promise<void> {
  if (!bereit) {
    bereit = (async () => {
      await sqlPool.begin(async (tx: any) => {
        await tx`SET LOCAL lock_timeout = '5s'`;
        await tx`CREATE TABLE IF NOT EXISTS fiaon_anrechnungen (
          id BIGSERIAL PRIMARY KEY, person_id BIGINT NOT NULL, quelle_ref TEXT NOT NULL, ziel_ref TEXT NOT NULL,
          guthaben_cents INTEGER NOT NULL, raten INTEGER NOT NULL, raten_cents INTEGER NOT NULL,
          rest_cents INTEGER NOT NULL DEFAULT 0, rest_verbraucht_cents INTEGER NOT NULL DEFAULT 0,
          von TEXT, von_agent_id BIGINT, notiz TEXT, am TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
        await tx`CREATE INDEX IF NOT EXISTS fiaon_anrechnungen_ziel_idx ON fiaon_anrechnungen (ziel_ref)`;
        await tx`CREATE INDEX IF NOT EXISTS fiaon_anrechnungen_quelle_idx ON fiaon_anrechnungen (quelle_ref)`;
      });
    })().catch((e) => { bereit = null; throw e; });
  }
  return bereit;
}

export interface AnrechnungPlan {
  guthabenCents: number; preisCents: number; raten: number; ratenCents: number; restCents: number;
  /** Wohin der Rest geht: auf die nächste Rate im Jahr, auf Rate 13 bei Verlängerung, oder nichts. */
  restAuf: "naechste_rate" | "verlaengerung" | null;
  /** Fälligkeiten der angerechneten Raten (Rate 1 = heute). */
  faelligkeiten: string[];
  bisMonat: string | null;
}

/** Die Rechnung — ohne Datenbank (Prüfstand ruft sie direkt). */
export function anrechnungPlanen(guthabenCents: number, preisCents: number, anker: string): AnrechnungPlan | null {
  if (!(guthabenCents > 0) || !(preisCents > 0)) return null;
  const raten = Math.min(LAUFZEIT, Math.floor(guthabenCents / preisCents));
  if (raten < 1) return null;
  const ratenCents = raten * preisCents;
  const restCents = guthabenCents - ratenCents;
  // Rate 1 ist der Anker selbst; faelligkeit(anker, n) ist der n-te Monat danach (n ≥ 1).
  const faelligkeiten = Array.from({ length: raten }, (_, i) => (i === 0 ? anker : faelligkeit(anker, i)));
  return {
    guthabenCents, preisCents, raten, ratenCents, restCents,
    restAuf: restCents <= 0 ? null : raten < LAUFZEIT ? "naechste_rate" : "verlaengerung",
    faelligkeiten, bisMonat: faelligkeiten[faelligkeiten.length - 1] ?? null,
  };
}

const ZIEL_OFFEN = ["pending", "pending_payment", "claimed_paid", "processing"];

/** Was sich bei dieser Person anrechnen lässt — für die Karte in der Akte. */
export async function anrechnungLage(personId: number, lauf: Lauf = sqlPool): Promise<{
  quellen: { ref: string; paket: string | null; bezahltCents: number; angerechnetCents: number; verfuegbarCents: number }[];
  ziele: { ref: string; paket: string | null; preisCents: number; status: string }[];
  bisher: { quelleRef: string; zielRef: string; guthabenCents: number; raten: number; restCents: number; am: string; von: string | null }[];
}> {
  await ensureAnrechnungTabelle();
  const { personFamilie } = await import("./fiaon-unterlagen-link");
  const familie = await personFamilie(personId, lauf);
  const bestellungen = (await lauf`
    SELECT a.ref, a.pack_key, a.pack_name, a.payment_status, a.merged_into, a.archived_at,
           (SELECT COALESCE(SUM(r.betrag_cents), 0)::int FROM fiaon_abo_raten r
             WHERE r.ref = a.ref AND r.status = 'bezahlt' AND r.storniert_am IS NULL AND COALESCE(r.quelle, '') <> ${ANRECHNUNG_QUELLE}) AS bezahlt_cents,
           (SELECT COALESCE(SUM(x.guthaben_cents), 0)::int FROM fiaon_anrechnungen x WHERE x.quelle_ref = a.ref) AS angerechnet_cents,
           (SELECT COUNT(*)::int FROM fiaon_abo_raten r WHERE r.ref = a.ref AND r.storniert_am IS NULL) AS raten
      FROM fiaon_applications a
     WHERE a.person_id = ANY(${familie}) AND a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
     ORDER BY a.created_at`) as any[];
  const quellen = bestellungen
    .filter((b) => b.payment_status === "cancelled" && Number(b.bezahlt_cents) > 0)
    .map((b) => ({
      ref: String(b.ref), paket: b.pack_name ?? null, bezahltCents: Number(b.bezahlt_cents), angerechnetCents: Number(b.angerechnet_cents),
      verfuegbarCents: Math.max(0, Number(b.bezahlt_cents) - Number(b.angerechnet_cents)),
    }))
    .filter((q) => q.verfuegbarCents > 0);
  const ziele = bestellungen
    .filter((b) => ZIEL_OFFEN.includes(String(b.payment_status)) && !b.archived_at && Number(b.raten) === 0
      && !istKeinAboPaket(b.pack_key) && paketPreisCents(b.pack_key) > 0)
    .map((b) => ({ ref: String(b.ref), paket: b.pack_name ?? null, preisCents: paketPreisCents(b.pack_key), status: String(b.payment_status) }));
  const bisher = ((await lauf`
    SELECT quelle_ref, ziel_ref, guthaben_cents, raten, rest_cents, am, von FROM fiaon_anrechnungen
     WHERE person_id = ANY(${familie}) ORDER BY am DESC`) as any[]).map((x) => ({
    quelleRef: String(x.quelle_ref), zielRef: String(x.ziel_ref), guthabenCents: Number(x.guthaben_cents), raten: Number(x.raten),
    restCents: Number(x.rest_cents), am: new Date(x.am).toISOString(), von: x.von ?? null,
  }));
  return { quellen, ziele, bisher };
}

/**
 * Anrechnen. `trocken` (Vorgabe true) rechnet nur und sagt, was geschähe.
 * Eine Transaktion: Ziel bezahlt + aktiv + voll freigeschaltet, Raten 1…n bezahlt (quelle 'anrechnung'),
 * ggf. die nächste offene Rate gemindert, Vermerk in fiaon_anrechnungen und im Verlauf beider Bestellungen.
 */
export async function anrechnen(opts: {
  personId: number; quelleRef: string; zielRef: string; wer: { name: string; agentId: number | null }; trocken?: boolean; heute?: string;
}, lauf: Lauf = sqlPool): Promise<{ ok: boolean; text: string; plan?: AnrechnungPlan }> {
  const trocken = opts.trocken !== false;
  const lage = await anrechnungLage(opts.personId, lauf);
  const quelle = lage.quellen.find((q) => q.ref === opts.quelleRef);
  const ziel = lage.ziele.find((z) => z.ref === opts.zielRef);
  if (!quelle) return { ok: false, text: "Diese Bestellung hat kein anrechenbares Guthaben (storniert, bezahlt, noch nicht angerechnet)." };
  if (!ziel) return { ok: false, text: "Das Ziel muss eine noch nicht bezahlte Abo-Bestellung derselben Person ohne Raten sein." };
  const heute = opts.heute ?? berlinToday();
  const plan = anrechnungPlanen(quelle.verfuegbarCents, ziel.preisCents, heute);
  if (!plan) return { ok: false, text: `Das Guthaben (${(quelle.verfuegbarCents / 100).toFixed(2)} €) deckt nicht einmal eine Rate.` };
  if (trocken) return { ok: true, text: "Vorschau", plan };

  const euro = (c: number) => `${(c / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  const tag = (iso: string) => iso.split("-").reverse().join(".");
  await lauf.begin(async (tx: any) => {
    await tx`SELECT pg_advisory_xact_lock(hashtext(${`fiaon_anrechnung:${opts.personId}`}))`;
    // Erneut prüfen in der Transaktion: Ziel noch offen und ohne Raten, Guthaben noch frei.
    const [z] = (await tx`SELECT ref, payment_status, payment_reference, pack_key FROM fiaon_applications WHERE ref = ${ziel.ref} FOR UPDATE`) as any[];
    const [nr] = (await tx`SELECT COUNT(*)::int AS n FROM fiaon_abo_raten WHERE ref = ${ziel.ref} AND storniert_am IS NULL`) as any[];
    const [schon] = (await tx`SELECT COALESCE(SUM(guthaben_cents), 0)::int AS c FROM fiaon_anrechnungen WHERE quelle_ref = ${quelle.ref}`) as any[];
    if (!z || !ZIEL_OFFEN.includes(String(z.payment_status)) || Number(nr.n) > 0 || Number(schon.c) !== quelle.angerechnetCents) {
      throw new Error("Der Stand hat sich gerade geändert — bitte die Akte neu laden.");
    }
    const referenz = z.payment_reference || z.ref;
    await tx`
      UPDATE fiaon_applications
         SET payment_status = 'paid', paid_at = NOW(), account_status = 'active',
             onboarding_stufe = 'voll_aktiv', freigeschaltet_am = COALESCE(freigeschaltet_am, NOW()),
             freigeschaltet_von = COALESCE(freigeschaltet_von, ${opts.wer.name}),
             freigabe_grund = COALESCE(freigabe_grund, ${`Anrechnung aus ${quelle.ref}`}), updated_at = NOW()
       WHERE ref = ${ziel.ref}`;
    for (let i = 0; i < plan.raten; i++) {
      const n = i + 1;
      await tx`
        INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status, bezahlt_am, quelle, notiz)
        VALUES (${ziel.ref}, ${n}, ${n === 1 ? referenz : `${referenz}-${n}`}, ${plan.preisCents}, ${plan.faelligkeiten[i]}::date, 'bezahlt', NOW(),
                ${ANRECHNUNG_QUELLE}, ${`Angerechnet aus ${quelle.ref} (bereits bezahlt) — kein neuer Zahlungseingang.`})`;
    }
    // Rest innerhalb des Jahres: Er mindert sofort die nächste Rate. Sonst bleibt er für Rate 13 (Verlängerung).
    let restVerbraucht = 0;
    if (plan.restAuf === "naechste_rate") {
      const n = plan.raten + 1;
      const betrag = Math.max(0, plan.preisCents - plan.restCents);
      restVerbraucht = plan.restCents;
      await tx`
        INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status, quelle, notiz)
        VALUES (${ziel.ref}, ${n}, ${`${referenz}-${n}`}, ${betrag}, ${faelligkeit(heute, plan.raten)}::date, 'offen', 'auto',
                ${`${euro(plan.restCents)} Guthaben aus ${quelle.ref} angerechnet (statt ${euro(plan.preisCents)}).`})`;
    }
    await tx`
      INSERT INTO fiaon_anrechnungen (person_id, quelle_ref, ziel_ref, guthaben_cents, raten, raten_cents, rest_cents, rest_verbraucht_cents, von, von_agent_id, notiz)
      VALUES (${opts.personId}, ${quelle.ref}, ${ziel.ref}, ${plan.guthabenCents}, ${plan.raten}, ${plan.ratenCents}, ${plan.restCents}, ${restVerbraucht},
              ${opts.wer.name}, ${opts.wer.agentId}, ${`${plan.raten} × ${euro(plan.preisCents)} bis ${tag(plan.bisMonat ?? heute)}`})`;
    const satz = `${euro(plan.guthabenCents)} aus ${quelle.ref} (${quelle.paket ?? "Paket"}, storniert, bereits bezahlt) auf ${ziel.ref} (${ziel.paket ?? "Paket"}) angerechnet: `
      + `${plan.raten} Rate${plan.raten === 1 ? "" : "n"} à ${euro(plan.preisCents)} bezahlt, Abo läuft bis ${tag(plan.bisMonat ?? heute)}`
      + `${plan.restCents > 0 ? `; Rest ${euro(plan.restCents)} ${plan.restAuf === "naechste_rate" ? "mindert die nächste Rate" : "wird bei Verlängerung auf Rate 13 angerechnet"}` : ""}. `
      + "Kein neuer Zahlungseingang, kein Umsatz, keine Provision.";
    for (const ref of [ziel.ref, quelle.ref]) {
      await tx`INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
               VALUES (${ref}, ${opts.personId}, ${opts.wer.agentId}, ${opts.wer.name}, 'system', ${satz})`;
    }
  });
  // Kundenstufe nachziehen (bezahlt) — Fehler hier halten die Anrechnung nicht auf.
  try {
    const { personTierAktualisieren } = await import("./tier");
    await personTierAktualisieren(lauf, { personId: opts.personId, ref: ziel.ref });
  } catch (e) { console.error("[ANRECHNUNG] Stufe:", String((e as Error)?.message || e).slice(0, 160)); }
  console.log(`[ANRECHNUNG] ${opts.wer.name}: ${quelle.ref} → ${ziel.ref}, ${plan.raten} Raten, Rest ${plan.restCents} Cent.`);
  return { ok: true, text: `Angerechnet: ${plan.raten} Raten bezahlt, Abo läuft bis ${tag(plan.bisMonat ?? heute)}.`, plan };
}

/**
 * Für naechsteRateAnlegen: Gibt es für diese Bestellung noch ein Guthaben aus einer Anrechnung
 * (Rest bei Verlängerung), mindert es die neue Rate und wird verbraucht. Ohne Tabelle: kein Guthaben.
 */
export async function guthabenVerbrauchen(ref: string, betragCents: number, lauf: Lauf = sqlPool): Promise<{ betragCents: number; angerechnetCents: number; notiz: string | null }> {
  const [t] = (await lauf`SELECT to_regclass('fiaon_anrechnungen') IS NOT NULL AS da`) as any[];
  if (!t?.da) return { betragCents, angerechnetCents: 0, notiz: null };
  const offen = (await lauf`
    SELECT id, quelle_ref, rest_cents - rest_verbraucht_cents AS frei FROM fiaon_anrechnungen
     WHERE ziel_ref = ${ref} AND rest_cents > rest_verbraucht_cents ORDER BY id`) as any[];
  let rest = betragCents;
  let angerechnet = 0;
  const quellen: string[] = [];
  for (const o of offen) {
    if (rest <= 0) break;
    const nimm = Math.min(rest, Number(o.frei));
    if (nimm <= 0) continue;
    await lauf`UPDATE fiaon_anrechnungen SET rest_verbraucht_cents = rest_verbraucht_cents + ${nimm} WHERE id = ${o.id}`;
    rest -= nimm; angerechnet += nimm; quellen.push(String(o.quelle_ref));
  }
  const euro = (c: number) => `${(c / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  return { betragCents: rest, angerechnetCents: angerechnet, notiz: angerechnet > 0 ? `${euro(angerechnet)} Guthaben aus ${quellen.join(", ")} angerechnet.` : null };
}

/** Für Prüfstand und Anzeige: ein Kalendertag aus einem Zeitstempel. */
export const anrechnungTag = (v: unknown) => ankerTag(v as any);
