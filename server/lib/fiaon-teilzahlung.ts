// ═══════════════════════════════════════════════════════════════════════════
// TEILZAHLUNGEN AUF EINE FIAON-GLOBAL-RECHNUNG — EINE QUELLE (E-469, 30.10.2026)
//
// Justin, 30.10.2026: Ein Global-Kunde hat einen Teil seiner Rechnung überwiesen. Die Zahlung soll verbucht sein,
// die Rechnung „X € bezahlt, Y € offen“ zeigen, der Rest bis zur (verlängerten) Frist fällig sein — und überall,
// auch im Chefbüro, soll dasselbe stehen.
//
// Bis heute (E-277) hieß eine Teilzahlung: keine Buchung, nur eine Aufgabe. Grund war richtig: alsBezahltBuchen
// kennt keinen Betrag — eine Teilzahlung als „bezahlt“ zu buchen, hätte die Rechnung voll bezahlt gezeigt und den
// Rest nie mehr erinnert. Für Global-Rechnungen (Einmalpreis, keine Ratenkette) gibt es jetzt den Zwischenstand:
//
//   · fiaon_teilzahlungen — EINE Zeile je Bankeingang (bank_txn_id/txn_id UNIQUE: nie zweimal derselbe Eingang),
//     Betrag, Eingangstag, Summe danach, wer gebucht hat. Die Datenbank selbst verweigert eine Summe über dem
//     Rechnungsbetrag (CHECK) und einen zweiten Abschluss je Rechnung (Teil-Index).
//   · Gebucht wird NUR hier (teilzahlungBuchen) — aus dem Chefbüro (Konto › Zubuchen › „Als Teilzahlung buchen“),
//     über POST /admin/zahlungen/bankeingang-nachholen {modus: "teilzahlung"} und scripts/global-teilzahlung-buchen.ts.
//     Der Bankeingang wird in derselben Transaktion verbucht (applied, matched_ref = Bestellung, Vermerk).
//   · Erreicht die Summe den Rechnungsbetrag, läuft der NORMALE Bezahlt-Weg genau einmal: alsBezahltBuchen mit dem
//     Datum der letzten Zahlung (Status, Provision nach Hausregel, Start, Startmail). Kommt der Rest mit der Referenz
//     im Zweck und auf den Cent genau, bucht ihn die Bank-Automatik selbst über diesen Weg (liveVerbuchen).
//   · Überzahlung wird nie gebucht — wie bisher eine Aufgabe an die Zahlungsstelle (erstatten oder verrechnen).
//
// Wer anzeigt, liest teilzahlungenLesen() (Zahlungsseite, Kundenportal, Mails, Rechnungs-PDF, Chefbüro). Umsatz zählt
// jede Teilzahlung am Eingangstag (UMSATZ_QUELLE_SQL); die bezahlte Bestellung zählt dann nicht noch einmal.
// Privat-Raten (Abo-Motor) berührt das nicht: Bestellungen mit Ratenkette sind nie teilzahlbar.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { berlinDatum, berlinToday } from "./fiaon-time";
import { refVergleichsform } from "./fiaon-zahlungsauftrag";
import { istGlobalPaket, paket as katalogPaket } from "@shared/fiaon-pakete";
import type { NachholZeile } from "./fiaon-bank-nachholen";

// ── Schema ───────────────────────────────────────────────────────────────────
let bereit: Promise<void> | null = null;
/** Dieselbe DDL wie db/migrations/127_global_teilzahlungen.sql — additiv, idempotent. */
export function ensureTeilzahlungen(): Promise<void> {
  if (!bereit) {
    bereit = (async () => {
      // Steht die Tabelle schon, kein DDL — so läuft auch eine nur lesende Verbindung (Vorschau des Buchungs-Skripts).
      const [da] = (await sqlPool`
        SELECT to_regclass('public.fiaon_teilzahlungen') AS t,
               EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fiaon_teilzahlungen' AND column_name = 'erstattung_am') AS spalte`) as any[];
      if (da?.t && da?.spalte) return;
      await sqlPool.begin(async (tx: any) => {
        await tx`SET LOCAL lock_timeout = '5s'`;
        await tx.unsafe(`
          CREATE TABLE IF NOT EXISTS fiaon_teilzahlungen (
            id BIGSERIAL PRIMARY KEY,
            ref VARCHAR NOT NULL,
            payment_reference VARCHAR,
            rechnungsnummer VARCHAR,
            bank_txn_id INTEGER NOT NULL UNIQUE,
            txn_id VARCHAR NOT NULL UNIQUE,
            betrag_cents INTEGER NOT NULL CHECK (betrag_cents > 0),
            eingang_am DATE NOT NULL,
            soll_cents INTEGER NOT NULL CHECK (soll_cents > 0),
            summe_nachher_cents INTEGER NOT NULL,
            schliesst_ab BOOLEAN NOT NULL DEFAULT FALSE,
            gebucht_von TEXT NOT NULL,
            notiz TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CHECK (summe_nachher_cents <= soll_cents)
          )`);
        await tx.unsafe(`CREATE INDEX IF NOT EXISTS fiaon_teilzahlungen_ref_idx ON fiaon_teilzahlungen (ref)`);
        await tx.unsafe(`CREATE UNIQUE INDEX IF NOT EXISTS fiaon_teilzahlungen_ein_abschluss ON fiaon_teilzahlungen (ref) WHERE schliesst_ab`);
        // E-469 Nachtrag: Storno MIT Erstattung — ab da zählt die Teilzahlung nicht mehr als Umsatz (wie eine stornierte Global-Zahlung).
        await tx.unsafe(`ALTER TABLE fiaon_teilzahlungen ADD COLUMN IF NOT EXISTS erstattung_am TIMESTAMPTZ`);
      });
    })().catch((e) => { bereit = null; throw e; });
  }
  return bereit;
}

/** Steht die Tabelle (oder lässt sie sich anlegen)? false nur auf einer nur lesenden Verbindung vor dem ersten Deploy. */
export async function teilzahlungenBereit(): Promise<boolean> {
  try { await ensureTeilzahlungen(); return true; } catch (e) {
    const [da] = (await sqlPool`SELECT to_regclass('public.fiaon_teilzahlungen') AS t`) as any[];
    if (!da?.t) return false;
    throw e;
  }
}

/**
 * Darf eine Rechnung in Teilen bezahlt werden? Nur FIAON Global: die Pakete und Individualangebote (art „global“)
 * und die Einzelrechnungen mit Global-Zahlungsseite (LLC-Gründung, Fast-Track …). Nie ein Privatpaket — dort
 * trägt die Ratenkette (Abo-Motor) jede Zahlung.
 */
export function istTeilzahlbar(packKey: unknown): boolean {
  return istGlobalPaket(packKey) || katalogPaket(packKey)?.zahlungsseite === "global";
}

const eur = (c: number) => `${(Math.round(c) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const tagText = (iso: string | null | undefined) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "—");
const isoTag = (v: unknown): string | null => {
  if (!v) return null;
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : berlinDatum(d);
};

// ── Lesen: der Stand je Rechnung ─────────────────────────────────────────────
export interface TeilzahlungEintrag { am: string; cents: number; txnId: string; abschluss: boolean }
export interface TeilzahlungStand {
  ref: string;
  /** Summe aller gebuchten Teilzahlungen (Cent). */
  bezahltCents: number;
  zahlungen: TeilzahlungEintrag[];
  /** Tag der letzten Teilzahlung (Berlin, JJJJ-MM-TT). */
  letzteAm: string | null;
}

/** Die Teilzahlungen zu diesen Bestellungen (fiaon_applications.ref). Nur Rechnungen MIT Teilzahlung stehen in der Karte. */
export async function teilzahlungenLesen(refs: string[]): Promise<Map<string, TeilzahlungStand>> {
  const aus = new Map<string, TeilzahlungStand>();
  const liste = Array.from(new Set(refs.filter(Boolean).map(String)));
  if (!liste.length) return aus;
  // Nur lesende Verbindung vor dem ersten Deploy: Ohne Tabelle gibt es keine Teilzahlung — leer statt Fehler.
  if (!(await teilzahlungenBereit())) return aus;
  const zeilen = (await sqlPool`
    SELECT ref, betrag_cents, eingang_am::text AS am, txn_id, schliesst_ab
      FROM fiaon_teilzahlungen WHERE ref = ANY(${liste}) ORDER BY ref, eingang_am, id`) as any[];
  for (const z of zeilen) {
    const ref = String(z.ref);
    const s = aus.get(ref) ?? { ref, bezahltCents: 0, zahlungen: [], letzteAm: null };
    const e: TeilzahlungEintrag = { am: String(z.am), cents: Number(z.betrag_cents), txnId: String(z.txn_id), abschluss: !!z.schliesst_ab };
    s.zahlungen.push(e);
    s.bezahltCents += e.cents;
    s.letzteAm = e.am;
    aus.set(ref, s);
  }
  return aus;
}

/** Summe der Teilzahlungen einer Bestellung (0, wenn keine). */
export async function teilSummeCents(ref: string): Promise<number> {
  return (await teilzahlungenLesen([ref])).get(ref)?.bezahltCents ?? 0;
}

/**
 * Was eine Anzeige braucht: Rechnungsbetrag, bezahlt, offen. `null`, wenn es keine Teilzahlung gibt oder die
 * Rechnung voll bezahlt ist (dann zeigt jede Seite „bezahlt“ wie bisher).
 */
export function teilAnzeige(sollCents: number, stand: TeilzahlungStand | null | undefined, paymentStatus: unknown):
  { sollCents: number; bezahltCents: number; offenCents: number; zahlungen: TeilzahlungEintrag[]; letzteAm: string | null } | null {
  if (!stand || stand.bezahltCents <= 0) return null;
  if (String(paymentStatus ?? "") === "paid") return null;
  return { sollCents, bezahltCents: stand.bezahltCents, offenCents: Math.max(0, sollCents - stand.bezahltCents), zahlungen: stand.zahlungen, letzteAm: stand.letzteAm };
}

export { teilzahlungSatz } from "@shared/fiaon-teilzahlung";

/**
 * Für den Rechnungs-Renderer (renderInvoicePdf ist synchron): die Teilzahlungen an die Zeile hängen.
 * Gerufen aus rechnungsSpracheSetzen — dem einen Schritt, den JEDER Aufrufer vor dem Zeichnen macht.
 */
export async function rechnungTeilzahlungenSetzen(a: any): Promise<void> {
  if (!a?.ref || a.rate_id || !istTeilzahlbar(a.pack_key) || String(a.payment_status ?? "") === "paid") return;
  const s = (await teilzahlungenLesen([String(a.ref)])).get(String(a.ref));
  if (!s) return;
  a.teilzahlungen = s.zahlungen;
  a.teil_bezahlt_cents = s.bezahltCents;
}

// ── Das Ziel: die Rechnung, auf die der Eingang soll ─────────────────────────
interface ZielRechnung {
  ref: string; paymentReference: string; rechnungsnummer: string | null; packKey: string; packName: string;
  sollCents: number; status: string; personId: number | null; kunde: string | null; faelligAm: string | null; hatRaten: boolean;
}

async function zielLesen(roh: unknown): Promise<{ ok: true; z: ZielRechnung } | { ok: false; status: number; error: string }> {
  const t = String(roh ?? "").trim();
  if (!t || t.length > 60) return { ok: false, status: 400, error: "Ziel fehlt — bitte die Bestellnummer (FIAON-…-…) oder den Verwendungszweck der Rechnung angeben." };
  const vgl = refVergleichsform(t);
  const apps = (await sqlPool`
    SELECT ref, payment_reference, invoice_number, pack_key, pack_name, ROUND(COALESCE(amount_due, 0) * 100)::int AS soll,
           payment_status, person_id, payment_due_date,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', first_name, last_name)), ''), company_name, contact_name) AS kunde,
           EXISTS (SELECT 1 FROM fiaon_abo_raten r WHERE r.ref = fiaon_applications.ref) AS hat_raten
      FROM fiaon_applications
     WHERE merged_into IS NULL
       AND (ref = ${t} OR UPPER(REGEXP_REPLACE(COALESCE(payment_reference, ''), '[^A-Za-z0-9]', '', 'g')) = ${vgl})`) as any[];
  if (apps.length !== 1) return { ok: false, status: 404, error: apps.length ? `Ziel ${t} ist nicht eindeutig.` : `Zu ${t} gibt es keine Rechnung.` };
  const a = apps[0];
  if (!a.payment_reference) return { ok: false, status: 409, error: `Die Bestellung ${a.ref} hat keinen Verwendungszweck — keine Rechnung zum Bezahlen.` };
  return {
    ok: true,
    z: {
      ref: String(a.ref), paymentReference: String(a.payment_reference), rechnungsnummer: a.invoice_number ? String(a.invoice_number) : null,
      packKey: String(a.pack_key ?? ""), packName: String(a.pack_name ?? a.pack_key ?? ""), sollCents: Number(a.soll || 0),
      status: String(a.payment_status ?? ""), personId: a.person_id != null ? Number(a.person_id) : null,
      kunde: a.kunde ? String(a.kunde) : null, faelligAm: isoTag(a.payment_due_date), hatRaten: !!a.hat_raten,
    },
  };
}

/** Offene Zustände, in denen eine Rechnung Geld annimmt. „expired“ ist nur das Zahlungsfenster (Grundsatz 02.09.: nie deaktivieren). */
const OFFEN = ["pending_payment", "claimed_paid", "expired"];

// ── Prüfen (schreibt nichts) ─────────────────────────────────────────────────
export interface TeilzahlungPlan {
  ref: string; zahlungsreferenz: string; rechnungsnummer: string | null;
  sollCents: number; bisherCents: number; dieserCents: number; nachherCents: number; offenCents: number;
  /** Dieser Eingang schließt die Rechnung ab → normaler Bezahlt-Weg (alsBezahltBuchen) mit dem Eingangstag. */
  abschluss: boolean;
  ueberzahlung: boolean;
  faelligAm: string | null;
  eingangAm: string;
}
export interface TeilzahlungAntwort {
  status: number; ok: boolean; error?: string;
  zeile?: NachholZeile & { teilzahlung?: TeilzahlungPlan | null };
}

async function kopf(bank: number | string): Promise<{ status: number; ok: boolean; error?: string; zeile?: NachholZeile }> {
  let id = typeof bank === "number" ? bank : NaN;
  if (typeof bank === "string") {
    const [r] = (await sqlPool`SELECT id FROM fiaon_bank_txns WHERE txn_id = ${bank} LIMIT 1`) as any[];
    if (!r) return { status: 404, ok: false, error: "Diesen Bankeingang gibt es nicht." };
    id = Number(r.id);
  }
  const { kopfLesen } = await import("./fiaon-bank-nachholen");
  return kopfLesen(id);
}

/**
 * DIE PRÜFUNG — dieselbe Rechnung wie die Buchung, ohne zu schreiben. `buchen = true` heißt: der Klick ist erlaubt.
 * Eine Überzahlung ist NICHT buchbar (`teilzahlung.ueberzahlung`), die Buchung legt dann eine Aufgabe an.
 */
export async function teilzahlungPruefen(bank: number | string, zielRoh: unknown): Promise<TeilzahlungAntwort> {
  const k = await kopf(bank);
  if (!k.ok || !k.zeile) return { status: k.status, ok: false, error: k.error, zeile: k.zeile };
  const zeile: NachholZeile & { teilzahlung?: TeilzahlungPlan | null } = { ...k.zeile, teilzahlung: null };
  const nein = (error: string, status = 409): TeilzahlungAntwort => ({ status, ok: false, error, zeile: { ...zeile, ergebnis: error, unklar: error, buchen: false } });
  const zl = await zielLesen(zielRoh);
  if (!zl.ok) return nein(zl.error, zl.status);
  const z = zl.z;
  zeile.zielVomMenschen = z.paymentReference;
  Object.assign(zeile, { ziel: z.paymentReference, bestellung: z.ref, kunde: z.kunde, personId: z.personId, regel: null, rateId: null, rateNr: null });
  if (!istTeilzahlbar(z.packKey)) return nein(`${z.paymentReference} ist keine FIAON-Global-Rechnung — Teilzahlungen gibt es nur dort (Privatpakete laufen über die Raten).`);
  if (z.hatRaten) return nein(`${z.paymentReference} hat eine Ratenkette — Zahlungen laufen über die Raten, nicht als Teilzahlung.`);
  if (!OFFEN.includes(z.status)) return nein(`Die Rechnung ${z.rechnungsnummer ?? z.paymentReference} steht auf „${z.status}“ — nur offene Rechnungen nehmen eine Teilzahlung an.`);
  if (!(z.sollCents > 0)) return nein(`Die Rechnung ${z.paymentReference} hat keinen Betrag.`);
  // Steht der Eingang schon in einer bezahlten Rate (Sperre aus liveVerbuchen) oder schon als Teilzahlung?
  const [verbraucht] = (await sqlPool`
    SELECT (SELECT zahlungsreferenz FROM fiaon_abo_raten WHERE status = 'bezahlt' AND POSITION(${`Bankeingang ${zeile.txnId}`} IN COALESCE(notiz, '')) > 0 LIMIT 1) AS rate`) as any[];
  const schonTeil = Array.from((await teilzahlungenLesen([z.ref])).values()).some((x) => x.zahlungen.some((y) => y.txnId === zeile.txnId))
    ? z.ref : await teilRefZuEingang(zeile.txnId);
  if (verbraucht?.rate) return nein(`Dieser Eingang steht schon in der bezahlten Rate ${verbraucht.rate}.`);
  if (schonTeil) return nein(`Dieser Eingang ist schon als Teilzahlung zu ${schonTeil} gebucht.`);
  const { pruefeZahlungsdatum } = await import("../routes/fiaon-abo");
  const p = pruefeZahlungsdatum(zeile.datum);
  if (p.fehler) return nein(`Eingangstag ${tagText(zeile.datum)}: ${p.fehler}`);

  const bisher = await teilSummeCents(z.ref);
  const nachher = bisher + zeile.betragCents;
  const plan: TeilzahlungPlan = {
    ref: z.ref, zahlungsreferenz: z.paymentReference, rechnungsnummer: z.rechnungsnummer,
    sollCents: z.sollCents, bisherCents: bisher, dieserCents: zeile.betragCents, nachherCents: Math.min(nachher, z.sollCents),
    offenCents: Math.max(0, z.sollCents - nachher), abschluss: nachher === z.sollCents, ueberzahlung: nachher > z.sollCents,
    faelligAm: z.faelligAm, eingangAm: zeile.datum,
  };
  zeile.teilzahlung = plan;
  const was = `Rechnung ${z.rechnungsnummer ?? z.paymentReference} (${z.packName}) über ${eur(z.sollCents)}`;
  if (plan.ueberzahlung) {
    const grund = `Überzahlung: ${eur(zeile.betragCents)} auf ${was} — schon bezahlt ${eur(bisher)}, offen nur ${eur(z.sollCents - bisher)}. Wird NICHT gebucht; „Jetzt buchen“ legt eine Aufgabe an die Zahlungsstelle an (erstatten oder verrechnen).`;
    zeile.ergebnis = grund; zeile.unklar = grund; zeile.buchen = false;
    zeile.hinweise.push(grund);
    return { status: 200, ok: true, zeile };
  }
  zeile.buchen = true;
  zeile.unklar = null;
  zeile.ergebnis = plan.abschluss
    ? `würde als Teilzahlung buchen und die Rechnung abschließen: ${eur(zeile.betragCents)} → ${was}${bisher ? ` (mit ${eur(bisher)} vorher)` : ""} — danach bezahlt per ${tagText(zeile.datum)}`
    : `würde als Teilzahlung buchen: ${eur(zeile.betragCents)} → ${was} — danach ${eur(plan.nachherCents)} bezahlt, ${eur(plan.offenCents)} offen${z.faelligAm ? ` bis ${tagText(z.faelligAm)}` : ""}`;
  zeile.mails = plan.abschluss
    ? ["wie bei jeder Erstzahlung: Start des Auftrags mit Aufgabe und Startmail an den Kunden (genau einmal)"]
    : ["keine Mail an den Kunden — Zahlungsseite, Kundenportal und Rechnung zeigen sofort den Restbetrag"];
  zeile.provision = plan.abschluss
    ? ["Mitarbeiter-Provision nach Hausregel bei Vollzahlung (Schalter provision_automatik: vorgemerkt oder gebucht)", "Partner-Provision (Kooperation): je gebuchter Zahlung aus der Umsatz-Quelle — Gutschrift im Folgemonat"]
    : ["Mitarbeiter-Provision: erst mit der Vollzahlung (Hausregel unverändert)", "Partner-Provision (Kooperation): je gebuchter Zahlung aus der Umsatz-Quelle — diese Teilzahlung zählt anteilig"];
  if (z.status === "expired") zeile.hinweise.push("Die Zahlungsfrist war abgelaufen (nur das Zahlungsfenster) — die Rechnung nimmt das Geld trotzdem an.");
  if (!plan.abschluss && z.faelligAm && z.faelligAm < berlinToday()) zeile.hinweise.push(`Die Zahlungsfrist (${tagText(z.faelligAm)}) liegt in der Vergangenheit — für den Rest ggf. neu setzen (Verwaltungsakte › Konditionen › Zahlungsfrist).`);
  if (bisher) zeile.hinweise.push(`Schon gebucht: ${eur(bisher)} in ${(await teilzahlungenLesen([z.ref])).get(z.ref)?.zahlungen.length ?? 0} Teilzahlung(en).`);
  return { status: 200, ok: true, zeile };
}

/** Zu welcher Rechnung ist dieser Eingang schon als Teilzahlung gebucht? (null = keiner / Tabelle fehlt noch) */
export async function teilRefZuEingang(txnId: string): Promise<string | null> {
  const [da] = (await sqlPool`SELECT to_regclass('public.fiaon_teilzahlungen') AS t`) as any[];
  if (!da?.t) return null;
  const [r] = (await sqlPool`SELECT ref FROM fiaon_teilzahlungen WHERE txn_id = ${txnId} LIMIT 1`) as any[];
  return r?.ref ? String(r.ref) : null;
}

// ── Buchen ───────────────────────────────────────────────────────────────────
const inArbeit = new Set<string>();

/**
 * SCHARF BUCHEN — erst die Prüfung, dann in EINER Transaktion: Bestellung sperren (FOR UPDATE), Summe neu lesen,
 * Bankeingang verbuchen, Teilzahlung eintragen, Satz in die Akte. Danach, nur beim Abschluss: alsBezahltBuchen.
 * `erwartet`: was der Mensch in der Vorschau gesehen hat (Ziel, bisher gebucht) — weicht es ab, wird nicht gebucht.
 */
export async function teilzahlungBuchen(
  bank: number | string,
  opts: { ziel: unknown; wer: string; erwartet?: { ziel?: string | null; bisherCents?: number | null } | null },
): Promise<TeilzahlungAntwort & { abschluss?: boolean; bezahlt?: { ok: boolean; fehler?: string } | null; aufgabe?: string | null; aufgabenErledigt?: number }> {
  const probe = await teilzahlungPruefen(bank, opts.ziel);
  if (!probe.ok || !probe.zeile) return probe;
  const zeile = probe.zeile;
  const plan = zeile.teilzahlung!;
  const wer = String(opts.wer || "Bankbuch").slice(0, 80);
  const e = opts.erwartet;
  if (e && ((e.ziel != null && e.ziel !== zeile.ziel) || (e.bisherCents != null && Number(e.bisherCents) !== plan.bisherCents))) {
    return { status: 409, ok: false, error: `Der Stand hat sich seit der Vorschau geändert (jetzt ${eur(plan.bisherCents)} schon bezahlt auf ${zeile.ziel}) — bitte neu prüfen.`, zeile };
  }
  if (plan.ueberzahlung) {
    const aufgabe = await ueberzahlungAufgabe(zeile, plan, wer);
    return { status: 409, ok: false, error: `Überzahlung — nicht gebucht. ${aufgabe ?? "Aufgabe ließ sich nicht anlegen."}`, zeile, aufgabe };
  }
  await ensureTeilzahlungen();
  if (inArbeit.has(zeile.txnId) || inArbeit.has(plan.ref)) return { status: 409, ok: false, error: "Dieser Eingang oder diese Rechnung wird gerade schon gebucht.", zeile };
  inArbeit.add(zeile.txnId); inArbeit.add(plan.ref);
  const anlass = `Teilzahlung (${wer})`;
  let abschluss = false;
  try {
    const erg = await sqlPool.begin(async (tx: any) => {
      await tx`SET LOCAL lock_timeout = '5s'`;
      const [a] = (await tx`
        SELECT ref, payment_status, ROUND(COALESCE(amount_due, 0) * 100)::int AS soll
          FROM fiaon_applications WHERE ref = ${plan.ref} AND merged_into IS NULL FOR UPDATE`) as any[];
      if (!a) throw new Error("WEG");
      if (!OFFEN.includes(String(a.payment_status))) throw new Error(`STATUS:${a.payment_status}`);
      if (Number(a.soll) !== plan.sollCents) throw new Error("BETRAG_GEAENDERT");
      const [s] = (await tx`SELECT COALESCE(SUM(betrag_cents), 0)::int AS summe FROM fiaon_teilzahlungen WHERE ref = ${plan.ref}`) as any[];
      const bisher = Number(s?.summe || 0);
      if (bisher !== plan.bisherCents) throw new Error("STAND_GEAENDERT");
      const nachher = bisher + zeile.betragCents;
      if (nachher > plan.sollCents) throw new Error("UEBERZAHLUNG");
      const fertig = nachher === plan.sollCents;
      const satz = `${anlass}: ${eur(zeile.betragCents)} als Teilzahlung auf Rechnung ${plan.rechnungsnummer ?? plan.zahlungsreferenz} (${plan.zahlungsreferenz}) gebucht — jetzt ${eur(nachher)} von ${eur(plan.sollCents)} bezahlt${fertig ? ", Rechnung abgeschlossen" : `, offen ${eur(plan.sollCents - nachher)}`}.`;
      const bt = (await tx`
        UPDATE fiaon_bank_txns
           SET applied = TRUE, applied_at = NOW(), matched_ref = ${plan.ref}, match_status = 'matched',
               note = CONCAT_WS(' · ', NULLIF(note, ''), ${satz}::text), updated_at = NOW()
         WHERE id = ${zeile.id} AND NOT applied AND COALESCE(match_status, '') <> 'ignored'
         RETURNING id`) as any[];
      if (!bt.length) throw new Error("SCHON_VERBUCHT");
      await tx`
        INSERT INTO fiaon_teilzahlungen (ref, payment_reference, rechnungsnummer, bank_txn_id, txn_id, betrag_cents, eingang_am,
                                         soll_cents, summe_nachher_cents, schliesst_ab, gebucht_von, notiz)
        VALUES (${plan.ref}, ${plan.zahlungsreferenz}, ${plan.rechnungsnummer}, ${zeile.id}, ${zeile.txnId}, ${zeile.betragCents}, ${zeile.datum}::date,
                ${plan.sollCents}, ${nachher}, ${fertig}, ${wer}, ${`Absender ${(zeile.absender || "—").slice(0, 80)}, Zweck „${(zeile.zweck || "—").slice(0, 120)}“`})`;
      await tx`
        INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
        VALUES (${plan.ref}, NULL, 'System', 'system',
                ${`Bankeingang ${zeile.txnId} vom ${tagText(zeile.datum)} über ${eur(zeile.betragCents)} (${(zeile.absender || "ohne Namen").slice(0, 60)}) als Teilzahlung gebucht — ${eur(nachher)} von ${eur(plan.sollCents)} bezahlt${fertig ? "; Rechnung damit voll bezahlt" : `; offen ${eur(plan.sollCents - nachher)}${plan.faelligAm ? ` bis ${tagText(plan.faelligAm)}` : ""}`} (${anlass}).`})`;
      return { fertig, nachher };
    });
    abschluss = erg.fertig;
    console.log(`[TEILZAHLUNG] ${zeile.txnId} → ${plan.ref}: ${eur(zeile.betragCents)} gebucht, jetzt ${eur(erg.nachher)} von ${eur(plan.sollCents)}${abschluss ? " — Rechnung abgeschlossen" : ""} (${anlass})`);
  } catch (err: any) {
    const m = String(err?.message || err);
    const fehler = m === "SCHON_VERBUCHT" ? "Dieser Eingang ist schon verbucht."
      : m === "STAND_GEAENDERT" ? "Inzwischen wurde eine andere Teilzahlung gebucht — bitte neu prüfen."
      : m === "UEBERZAHLUNG" ? "Mit diesem Eingang wäre die Rechnung überzahlt — nicht gebucht, bitte neu prüfen."
      : m === "BETRAG_GEAENDERT" ? "Der Rechnungsbetrag hat sich geändert — bitte neu prüfen."
      : m === "WEG" ? "Die Bestellung gibt es nicht mehr."
      : m.startsWith("STATUS:") ? `Die Rechnung steht inzwischen auf „${m.slice(7)}“ — nichts gebucht.`
      : /duplicate key|unique/i.test(m) ? "Die Datenbank verweigert es: Dieser Eingang ist schon als Teilzahlung gebucht (oder die Rechnung schon abgeschlossen)."
      : /check constraint/i.test(m) ? "Die Datenbank verweigert es: Die Summe läge über dem Rechnungsbetrag."
      : null;
    if (fehler) return { status: 409, ok: false, error: fehler, zeile };
    throw err;
  } finally {
    inArbeit.delete(zeile.txnId); inArbeit.delete(plan.ref);
  }

  // Offene Bankbuch-Aufgaben dieses Eingangs (Teil-, Über-, Rückzahlung) sind erledigt — das Geld ist verbucht.
  const { bankAufgabenSchliessen } = await import("./fiaon-bank-nachholen");
  const aufgabenErledigt = await bankAufgabenSchliessen([zeile.txnId], anlass,
    `Als Teilzahlung gebucht: ${eur(zeile.betragCents)} auf ${plan.zahlungsreferenz}. Nichts erstatten — das Geld ist verbucht.`);

  // ── Abschluss: der NORMALE Bezahlt-Weg, genau einmal ───────────────────────
  let bezahlt: { ok: boolean; fehler?: string } | null = null;
  if (abschluss) bezahlt = await teilzahlungAbschliessen(plan.ref, `teilzahlung:${zeile.txnId}`);
  const nachZeile = { ...zeile, schonVerbucht: true, ergebnis: abschluss
    ? (bezahlt?.ok ? `Gebucht — Rechnung voll bezahlt per ${tagText(zeile.datum)}, Auftrag startet über den normalen Weg.` : `Gebucht — Rechnung voll bezahlt, aber der Bezahlt-Weg meldete: ${bezahlt?.fehler ?? "unbekannt"}. Bitte „Abschluss nachholen“ (Skript --nachholen).`)
    : `Gebucht — ${eur(plan.nachherCents)} von ${eur(plan.sollCents)} bezahlt, ${eur(plan.offenCents)} offen${plan.faelligAm ? ` bis ${tagText(plan.faelligAm)}` : ""}.` };
  return { status: 200, ok: true, zeile: nachZeile, abschluss, bezahlt, aufgabenErledigt };
}

/**
 * Summe = Rechnungsbetrag, Bestellung noch nicht bezahlt → alsBezahltBuchen mit dem Tag der letzten Teilzahlung.
 * Idempotent: Ist die Bestellung schon bezahlt oder die Summe kleiner, passiert nichts. Auch als Nachhol-Weg, falls
 * der Bezahlt-Weg nach der Buchung einmal scheiterte (Skript --nachholen).
 */
export async function teilzahlungAbschliessen(ref: string, quelle: string): Promise<{ ok: boolean; fehler?: string }> {
  // Wirft nie: Ein Fehler hier darf die schon verbuchte Teilzahlung nicht zurückdrehen (liveVerbuchen setzt im Fehlerfall den
  // Bankvermerk neu) — er meldet sich als Ergebnis, nachholbar mit --nachholen.
  try { return await abschliessenKern(ref, quelle); } catch (e: any) {
    console.error(`[TEILZAHLUNG] ${ref}: Abschluss:`, e);
    return { ok: false, fehler: String(e?.message || e).slice(0, 200) };
  }
}
async function abschliessenKern(ref: string, quelle: string): Promise<{ ok: boolean; fehler?: string }> {
  const [a] = (await sqlPool`
    SELECT payment_reference, payment_status, ROUND(COALESCE(amount_due, 0) * 100)::int AS soll FROM fiaon_applications WHERE ref = ${ref} AND merged_into IS NULL`) as any[];
  if (!a) return { ok: false, fehler: "Bestellung nicht gefunden" };
  if (String(a.payment_status) === "paid") return { ok: true };
  const s = (await teilzahlungenLesen([ref])).get(ref);
  if (!s || s.bezahltCents !== Number(a.soll)) return { ok: false, fehler: `Summe ${eur(s?.bezahltCents ?? 0)} ist nicht der Rechnungsbetrag ${eur(Number(a.soll))}` };
  try {
    const { alsBezahltBuchen } = await import("../routes/fiaon-antrag");
    const erg = await alsBezahltBuchen(String(a.payment_reference), { zahlungsdatum: s.letzteAm, quelle });
    if (!erg.ok) {
      console.error(`[TEILZAHLUNG] ${ref}: Bezahlt-Weg abgelehnt: ${erg.error}`);
      return { ok: false, fehler: erg.error };
    }
    console.log(`[TEILZAHLUNG] ${ref}: voll bezahlt per ${s.letzteAm} — normaler Bezahlt-Weg gelaufen (${quelle}).`);
    return { ok: true };
  } catch (e: any) {
    console.error(`[TEILZAHLUNG] ${ref}: Bezahlt-Weg:`, e);
    return { ok: false, fehler: String(e?.message || e).slice(0, 200) };
  }
}

/**
 * DIE SPERRE FÜR ALLE ANDEREN BEZAHLT-WEGE (E-469 Nachtrag, Gegenprüfung 30.10.2026).
 * mark-paid, Vertriebsleitung, Kontoabgleich (applyTxn) und die Bank-Automatik kennen keinen gezahlten Betrag. Hat eine
 * Rechnung Teilzahlungen und ist die Summe kleiner als der Rechnungsbetrag, würden sie sie „bezahlt“ setzen, obwohl Geld
 * fehlt — und der Rest fiele aus dem Umsatz (keine abschließende Teilzahlung). Dann: klar ablehnen. null = frei.
 */
export async function teilzahlungSperre(refOderZweck: { ref?: string | null; paymentReference?: string | null }): Promise<string | null> {
  if (!(await teilzahlungenBereit())) return null;
  const [a] = (await sqlPool`
    SELECT a.ref, ROUND(COALESCE(a.amount_due, 0) * 100)::int AS soll,
           (SELECT COALESCE(SUM(tz.betrag_cents), 0)::int FROM fiaon_teilzahlungen tz WHERE tz.ref = a.ref) AS teil
      FROM fiaon_applications a
     WHERE a.merged_into IS NULL AND (a.ref = ${refOderZweck.ref ?? ""} OR a.payment_reference = ${refOderZweck.paymentReference ?? ""})
     LIMIT 1`) as any[];
  if (!a || !(Number(a.teil) > 0) || Number(a.teil) >= Number(a.soll)) return null;
  return `Teilzahlungen vorhanden (${eur(Number(a.teil))} von ${eur(Number(a.soll))} gebucht, offen ${eur(Number(a.soll) - Number(a.teil))}) — bitte über „Als Teilzahlung buchen“ (Chefbüro › Konto › Zubuchen). Als „bezahlt“ gilt die Rechnung erst, wenn die Teilzahlungen den Betrag erreichen.`;
}

/**
 * DIESELBE SPERRE, ECHT ATOMAR — für Wege, die „bezahlt“ in einer Transaktion schreiben (alsBezahltBuchen, applyTxn).
 * Sperrt die Bestellzeile(n) FOR UPDATE — dieselbe Reihenfolge wie teilzahlungBuchen (erst die Bestellung) — und liest die
 * Summe der Teilzahlungen DANACH neu. Eine Teilzahlung, die parallel committet, ist damit entweder schon gezählt oder wartet,
 * bis dieser Weg fertig ist (und findet die Rechnung dann bezahlt). Ohne Teilzahlungen ändert sich nichts außer der kurzen Sperre.
 * Liefert den Ablehnungstext oder null.
 */
export async function teilzahlungSperreInTx(tx: any, wo: { ref?: string | null; paymentReference?: string | null }): Promise<string | null> {
  const [da] = (await tx`SELECT to_regclass('public.fiaon_teilzahlungen') AS t`) as any[];
  const zeilen = (await tx`
    SELECT ref, ROUND(COALESCE(amount_due, 0) * 100)::int AS soll FROM fiaon_applications
     WHERE ${wo.ref ? tx`ref = ${wo.ref} AND merged_into IS NULL` : tx`payment_reference = ${wo.paymentReference ?? ""}`}
     FOR UPDATE`) as any[];
  if (!da?.t) return null;
  for (const a of zeilen) {
    const [s] = (await tx`SELECT COALESCE(SUM(betrag_cents), 0)::int AS summe FROM fiaon_teilzahlungen WHERE ref = ${a.ref}`) as any[];
    const teil = Number(s?.summe || 0);
    if (teil > 0 && teil < Number(a.soll)) {
      return `Teilzahlungen vorhanden (${eur(teil)} von ${eur(Number(a.soll))} gebucht, offen ${eur(Number(a.soll) - teil)}) — bitte über „Als Teilzahlung buchen“ (Chefbüro › Konto › Zubuchen). Als „bezahlt“ gilt die Rechnung erst, wenn die Teilzahlungen den Betrag erreichen.`;
    }
  }
  return null;
}

/**
 * Storno MIT Erstattung (globalAuftragStornieren): die Teilzahlungen dieser Rechnung zählen ab jetzt nicht mehr als Umsatz —
 * genau wie eine stornierte Global-Einmalzahlung. Bewegt kein Geld (das macht Justin von Hand). Liefert die erstattete Summe.
 */
export async function teilzahlungenErstattungVermerken(ref: string): Promise<number> {
  if (!(await teilzahlungenBereit())) return 0;
  const zeilen = (await sqlPool`
    UPDATE fiaon_teilzahlungen SET erstattung_am = COALESCE(erstattung_am, NOW()) WHERE ref = ${ref} RETURNING betrag_cents`) as any[];
  return zeilen.reduce((s, z) => s + Number(z.betrag_cents), 0);
}

/** Überzahlung: keine Buchung, eine Aufgabe an die Zahlungsstelle — derselbe Schlüssel wie bankeingangAufgabe (E-277). */
async function ueberzahlungAufgabe(zeile: NachholZeile, plan: TeilzahlungPlan, wer: string): Promise<string | null> {
  try {
    const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
    const erg = await auftragFuerKunden({
      personId: zeile.personId, ref: plan.ref,
      titel: `Überzahlung: ${eur(zeile.betragCents)} auf ${plan.zahlungsreferenz} (offen nur ${eur(plan.sollCents - plan.bisherCents)})`.slice(0, 160),
      text: `Bankeingang ${zeile.txnId} vom ${tagText(zeile.datum)} über ${eur(zeile.betragCents)}, Absender „${(zeile.absender || "—").slice(0, 80)}“, Zweck „${(zeile.zweck || "—").slice(0, 120)}“. `
        + `Rechnung ${plan.rechnungsnummer ?? plan.zahlungsreferenz} über ${eur(plan.sollCents)}, schon als Teilzahlung gebucht ${eur(plan.bisherCents)}, offen ${eur(plan.sollCents - plan.bisherCents)}. `
        + "Er wird NICHT gebucht — sonst stünde mehr Geld auf der Rechnung, als sie kostet. Bitte entscheiden: erstatten (Überweisung im Banking über die Buchhaltung) oder mit einer anderen offenen Rechnung verrechnen.",
      schluessel: `bank-nachholen:ueberzahlung:${zeile.txnId}`,
      quelle: "bankbuch", bereich: "konten", autorName: `Teilzahlung (${wer})`,
      link: `/akte/${plan.ref}`,
      anBetreiber: true,
    });
    await sqlPool`
      UPDATE fiaon_bank_txns
         SET note = CONCAT_WS(' · ', NULLIF(note, ''), ${`Teilzahlung (${wer}): Überzahlung auf ${plan.zahlungsreferenz} — Aufgabe an die Zahlungsstelle, nicht gebucht.`}::text), updated_at = NOW()
       WHERE id = ${zeile.id} AND NOT applied`;
    return erg.id ? "Aufgabe an die Zahlungsstelle angelegt." : null;
  } catch (e: any) {
    console.error("[TEILZAHLUNG] Aufgabe Überzahlung:", String(e?.message || e).slice(0, 160));
    return null;
  }
}
