// ═══════════════════════════════════════════════════════════════════════════
// MARA SUCHT DIE ZAHLUNG SELBST — zahlung_suchen (E-401 3/6, 19.10.2026)
//
// Justin (19.10.2026): „Mach Mara und co fix fertig, damit die wirklich GUT arbeitet und selbst arbeitet.“
// Gemessen (nur lesend, 19.10.): 92 offene Aufträge „Stufe A klären“, 282 Menschen mit „Zahlung gemeldet, nicht
// bestätigt“ seit über 7 Tagen. Schrieb einer „habe bezahlt“, bat Mara um den Beleg — nachgesehen hat ein Mensch.
//
// Jetzt sieht der SERVER im Bankbuch nach, bevor Mara schreibt (wie zahlungslink_bauen vorab), für die Mail
// (fiaon-postmeister-agent.ts) und für WhatsApp (fiaon-whatsapp-mara.ts) — derselbe Weg:
//   1. Lesen: seine Bestellungen, offenen Raten und alle Eingänge der letzten 21 Tage (fiaon_bank_txns).
//   2. Rechnen: shared/fiaon-zahlung-suchen.ts (rein, mit Prüfstand) — gebucht, gefunden, unterwegs, abweichend.
//   3. Handeln — NIE buchen. Ein gefundener, noch nicht gebuchter Eingang geht als Vorschlag auf die bestehende
//      Karte „Geld eingegangen“ (fiaon-mara-entscheidungen.ts, art eingang_unverbucht, Schlüssel eingang:<id>):
//      der Fund steht in fiaon_mara_zahlung_funde, die Karte liest ihn (Beleg „Kunde meldet Zahlung“ und, wenn die
//      Trockenprobe „würde buchen“ sagt, der Knopf „Zubuchen auf Rate N“). Gebucht wird nur mit dem Klick eines
//      Menschen über bankeingangBuchen — derselbe eine Weg mit Erwartungs-Stempel (Lage geändert → keine Buchung).
//      Dazu ein Vermerk in der Akte (einmal je Eingang und Person).
//   4. Sagen: der Hinweis für Maras Auftrag und der eine Satz („Ich habe Ihre Überweisung über … gefunden …“).
//      Die Antwortprüfung (zahlungAntwortFunde) hält jede Zusage, die nicht im Bankbuch steht.
//
// Nie bei Global-Kunden (E-272: raus aus Privat-Abläufen). Testpersonen: rechnen ja, schreiben nichts (kein Fund,
// keine Karte, kein Vermerk). Erstattungen und Buchungen macht Mara nie.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { berlinDatum, berlinToday } from "./fiaon-time";
import {
  zahlungSuchen, zahlungHinweis, zahlungSatz, zahlungKurz, trefferZeile, meldetBezahlt, ZAHLUNG_SUCHEN_TAGE,
  type ZsErgebnis, type ZsTreffer, type ZsBestellung, type ZsRate, type ZsEingang, type ZsPerson,
} from "@shared/fiaon-zahlung-suchen";
import { VERTRAGSENDE_SPALTEN_SQL, ratenNachVertragsende } from "@shared/fiaon-kuendigung-regel";
import { abgeschicktSql } from "@shared/fiaon-antrag-stand";

type Lauf = typeof sqlPool;
export type ZsKanal = "mail" | "whatsapp";

/** Was der Server Mara und der Akte mitgibt. */
export interface ZahlungsLage {
  ergebnis: ZsErgebnis;
  /** Der Block für Maras Auftrag (vorab). */
  hinweis: string;
  /** Der eine Satz, den die Antwort sagen soll (auch der sichere Satz auf WhatsApp). */
  satz: string;
  /** Für die Handlungsliste der Postmeister-Zeile bzw. das WhatsApp-Protokoll. */
  handlung: string;
  /** Kurzform für werkzeugDaten.zahlung_suchen (Belegprüfung: Daten und Beträge). */
  daten: ReturnType<typeof zahlungKurz>;
  /** Eingänge (fiaon_bank_txns.id), die jetzt mit Maras Fund im Mara-Steuerpult liegen. */
  vorgelegt: number[];
  /** Ältere, gebuchte Zahlungen aus der Akte (Datum, Betrag) — ein Satz darüber ist frei (zahlungAntwortFunde). */
  frueher: { datum: string; cents: number }[];
  /** Testperson — gerechnet, nichts geschrieben. */
  test: boolean;
}

/** Ein Fund, den Mara der Karte „Geld eingegangen“ mitgibt. */
export interface MaraFund {
  bankTxnId: number;
  personId: number;
  kanal: ZsKanal;
  quelle: string | null;
  /** E-401 Nachbesserung: „moeglich“ = nur der Name passt — ein Prüfauftrag, nie ein Zubuchen-Knopf. */
  stand: "gefunden" | "abweichend" | "moeglich";
  /** Ziel in der Schreibweise der Datenbank — nur bei gleichem Betrag (und nie bei „moeglich“). */
  ziel: string | null;
  bestellung: string | null;
  rateNr: number | null;
  /** Aus der Trockenprobe — nur wenn sie „würde buchen“ sagt; dann gibt es den Knopf „Zubuchen“. */
  erwartet: { regel: string | null; ziel: string | null; rateId: number | null } | null;
  probe: string | null;
  wege: string;
  am: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// WANN SUCHEN
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Mail: Er meldet eine Zahlung (Lampe zahlung_behauptet oder seine Worte) oder steht als „Zahlung gemeldet“ in der
 * Akte. WhatsApp ruft direkt bei waSelbstThema „bezahlt“. Rein.
 */
export function zahlungSuchenNoetig(e: { flags?: Record<string, unknown> | null; lage?: string | null; kundeText?: string | null }): boolean {
  return !!e.flags?.zahlung_behauptet || e.lage === "zahlung_gemeldet" || meldetBezahlt(String(e.kundeText ?? ""));
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE TABELLE DER FUNDE
// ═══════════════════════════════════════════════════════════════════════════
let bereit: Promise<void> | null = null;
export function fundTabelle(lauf: Lauf = sqlPool): Promise<void> {
  if (!bereit) {
    bereit = (async () => {
      await lauf`
        CREATE TABLE IF NOT EXISTS fiaon_mara_zahlung_funde (
          id BIGSERIAL PRIMARY KEY,
          bank_txn_id INTEGER NOT NULL,
          person_id INTEGER NOT NULL,
          kanal TEXT NOT NULL,
          quelle TEXT,
          stand TEXT NOT NULL,
          ziel TEXT,
          bestellung TEXT,
          rate_nr INTEGER,
          erwartet JSONB,
          probe TEXT,
          wege TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          aktualisiert_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (bank_txn_id, person_id)
        )`;
    })().catch((e) => { bereit = null; throw e; });
  }
  return bereit;
}

/** Maras Funde zu diesen Eingängen (neueste zuerst). Ohne Tabelle (frische DB, lesende Messung): keine. */
export async function maraFundeFuer(ids: number[], lauf: Lauf = sqlPool): Promise<MaraFund[]> {
  const nur = ids.filter((n) => Number.isInteger(n) && n > 0);
  if (!nur.length) return [];
  const [t] = (await lauf.unsafe(`SELECT to_regclass('public.fiaon_mara_zahlung_funde') IS NOT NULL AS da`).catch(() => [])) as any[];
  if (!t?.da) return [];
  const zeilen = (await lauf.unsafe(
    `SELECT * FROM fiaon_mara_zahlung_funde WHERE bank_txn_id = ANY($1::int[]) ORDER BY aktualisiert_am DESC, id DESC`, [nur]).catch(() => [])) as any[];
  return zeilen.map((z) => ({
    bankTxnId: Number(z.bank_txn_id), personId: Number(z.person_id), kanal: z.kanal === "whatsapp" ? "whatsapp" : "mail",
    quelle: z.quelle ?? null, stand: z.stand === "abweichend" ? "abweichend" : z.stand === "moeglich" ? "moeglich" : "gefunden", ziel: z.ziel ?? null, bestellung: z.bestellung ?? null,
    rateNr: z.rate_nr != null ? Number(z.rate_nr) : null,
    erwartet: z.erwartet ? (typeof z.erwartet === "string" ? JSON.parse(z.erwartet) : z.erwartet) : null,
    probe: z.probe ?? null, wege: String(z.wege ?? ""), am: new Date(z.aktualisiert_am ?? z.created_at).toISOString(),
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
// LESEN
// ═══════════════════════════════════════════════════════════════════════════
const UNTERWEGS = "Airwallex: Geld ist UNTERWEGS";

export interface ZahlungsDaten {
  person: ZsPerson & { test: boolean };
  bestellungen: ZsBestellung[];
  raten: ZsRate[];
  eingaenge: ZsEingang[];
  frueher: { datum: string; cents: number }[];
}

/** Alles, was der Abgleich braucht — nur lesend. null, wenn es die Person nicht gibt. */
export async function zahlungsDatenLesen(personId: number, lauf: Lauf = sqlPool, o: { tage?: number } = {}): Promise<ZahlungsDaten | null> {
  const [p] = (await lauf`
    SELECT id, first_name, last_name, ist_test_am FROM fiaon_persons WHERE id = ${personId} LIMIT 1`.catch(() => [])) as any[];
  if (!p) return null;
  // Alle Bestellungen (auch zusammengeführte: deren Nummer kann im Bankbuch stehen) — geschuldet wird nur aus lebenden.
  const apps = (await lauf.unsafe(`
    SELECT a.ref, a.payment_reference, a.payment_status, a.first_name, a.last_name, a.merged_into, a.letzte_rate_nr,
           ROUND(COALESCE(a.amount_due, 0) * 100)::int AS soll, a.paid_at,
           (${abgeschicktSql("a")}) AS abgeschickt, ${VERTRAGSENDE_SPALTEN_SQL("a")}
      FROM fiaon_applications a
     WHERE a.person_id = $1 AND a.gdpr_deleted_at IS NULL`, [personId])) as any[];
  const lebend = apps.filter((a) => !a.merged_into);
  const bestellungen: ZsBestellung[] = apps.map((a) => ({
    ref: String(a.ref), zahlungsreferenz: a.payment_reference ? String(a.payment_reference) : null,
    vorname: a.first_name ?? null, nachname: a.last_name ?? null,
    erstzahlungOffen: !a.merged_into && !!a.abgeschickt && ["pending_payment", "claimed_paid"].includes(String(a.payment_status)),
    sollCents: Number(a.soll || 0),
  }));
  const lebendeRefs = lebend.map((a) => String(a.ref));
  const ratenRoh = lebendeRefs.length ? (await lauf`
    SELECT id, ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status, bezahlt_am, storniert_am
      FROM fiaon_abo_raten WHERE ref = ANY(${lebendeRefs})`.catch(() => [])) as any[] : [];
  const offen = ratenRoh.filter((r) => r.status === "offen" && !r.storniert_am && !r.bezahlt_am);
  const raten: ZsRate[] = [];
  for (const a of lebend) {
    const seine = offen.filter((r) => r.ref === a.ref)
      // Jahresvertrag gekündigt: bis zur letzten Rate; Altvertrag gekündigt: nie eine Rate nach dem Vertragsende.
      .filter((r) => !(a.gekuendigt_am && !a.kuendigung_zurueckgenommen_am && a.letzte_rate_nr != null && Number(r.rate_nr) > Number(a.letzte_rate_nr)));
    const { nachEnde } = ratenNachVertragsende(a, seine);
    for (const r of seine) {
      if (nachEnde.includes(r)) continue;
      raten.push({
        id: Number(r.id), ref: String(r.ref), nr: Number(r.rate_nr), zahlungsreferenz: r.zahlungsreferenz ? String(r.zahlungsreferenz) : null,
        cents: Number(r.betrag_cents) || 0, faellig: r.faellig_am ? berlinDatum(new Date(r.faellig_am)) : null,
      });
    }
  }
  const tage = Math.max(1, Math.min(90, Math.round(Number(o.tage ?? ZAHLUNG_SUCHEN_TAGE)) || ZAHLUNG_SUCHEN_TAGE));
  // Alle Eingänge des Fensters (es sind wenige, ~90 in 21 Tagen) — der Abgleich entscheidet rein. Die Rate eines gebuchten
  // Eingangs steht in ihrer Notiz („Bankeingang <txn>“).
  const txns = (await lauf.unsafe(`
    SELECT t.id, t.txn_id, t.booked_at, t.amount_cents, t.payer_name, t.reference_raw, t.extracted_ref, t.matched_ref,
           t.applied, t.match_status, LEFT(COALESCE(t.note, ''), 60) AS note,
           (SELECT r.rate_nr FROM fiaon_abo_raten r WHERE t.applied AND r.status = 'bezahlt' AND r.ref = t.matched_ref
               AND POSITION(t.txn_id IN COALESCE(r.notiz, '')) > 0 ORDER BY r.rate_nr LIMIT 1) AS rate_nr
      FROM fiaon_bank_txns t
     WHERE t.amount_cents > 0 AND t.booked_at >= (CURRENT_DATE - ($1::int + 1))`, [tage])) as any[];
  const eingaenge: ZsEingang[] = txns.map((t) => ({
    id: Number(t.id), txnId: String(t.txn_id), datum: t.booked_at ? berlinDatum(new Date(t.booked_at)) : "", cents: Number(t.amount_cents) || 0,
    zahler: t.payer_name ?? null, zweck: t.reference_raw ?? null, erkannteRef: t.extracted_ref ?? null, zugeordnet: t.matched_ref ?? null,
    gebucht: t.applied === true, ignoriert: t.match_status === "ignored", unterwegs: String(t.note ?? "").startsWith(UNTERWEGS),
    rateNr: t.rate_nr != null ? Number(t.rate_nr) : null,
  }));
  // Ältere, gebuchte Zahlungen (Akte) — Raten mit Zahltag und bezahlte Bestellungen.
  const frueher = [
    ...ratenRoh.filter((r) => r.status === "bezahlt" && r.bezahlt_am).map((r) => ({ datum: berlinDatum(new Date(r.bezahlt_am)), cents: Number(r.betrag_cents) || 0 })),
    ...apps.filter((a) => a.payment_status === "paid" && a.paid_at).map((a) => ({ datum: berlinDatum(new Date(a.paid_at)), cents: Number(a.soll || 0) })),
  ];
  return {
    person: { vorname: p.first_name ?? null, nachname: p.last_name ?? null, test: !!p.ist_test_am },
    bestellungen, raten, eingaenge, frueher,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HANDELN — der Fund auf die Karte, ein Vermerk; nie buchen
// ═══════════════════════════════════════════════════════════════════════════
const WEG_KURZ: Record<string, string> = { zuordnung: "Bankbuch", referenz: "Referenz", name: "Name" };

async function vermerkEinmal(personId: number, ref: string | null, kanal: ZsKanal, text: string, marke: string, lauf: Lauf): Promise<void> {
  const { akteRef } = await import("./fiaon-postmeister-werkzeuge");
  const r = await akteRef(personId, ref).catch(() => null);
  const [schon] = (await lauf`
    SELECT 1 FROM fiaon_contact_log WHERE person_id = ${personId} AND agent_id IS NULL AND type = 'system'
       AND POSITION(${marke} IN note) > 0 LIMIT 1`.catch(() => [])) as any[];
  if (schon) return;
  await lauf`
    INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
    VALUES (${r}, ${personId}, NULL, ${kanal === "whatsapp" ? "Mara" : "Postmeister"}, 'system', ${`${text.slice(0, 860)} ${marke}`})`.catch(() => {});
}

/** Einen Fund festhalten (Trockenprobe für den Knopf) — Karte und Vermerk dazu. Wirft nie. */
async function fundVorlegen(t: ZsTreffer, o: { personId: number; kanal: ZsKanal; quelle: string | null; ref: string | null }, lauf: Lauf): Promise<boolean> {
  try {
    await fundTabelle(lauf);
    let erwartet: MaraFund["erwartet"] = null;
    let probe: string | null = null;
    // E-401 Nachbesserung: Nur bei einem SICHEREN Fund (Referenz/Zuordnung, Betrag gleich) ein Ziel und die Trockenprobe —
    // „moeglich“ (nur der Name) bekommt nie den Zubuchen-Knopf.
    const ziel = t.stand === "gefunden" && t.ziel ? t.ziel.referenz : null;
    if (ziel) {
      // Die Trockenprobe mit SEINEM Ziel — bucht nichts. Sagt sie „würde buchen“, bekommt die Karte den Knopf.
      const { bankeingangTrockenprobe } = await import("./fiaon-bank-nachholen");
      const p = await bankeingangTrockenprobe(t.eingang.id, { ziel });
      probe = String(p.zeile?.ergebnis || p.error || "").slice(0, 300) || null;
      if (p.ok && p.zeile?.buchen) erwartet = { regel: p.zeile.regel ?? null, ziel: p.zeile.ziel ?? null, rateId: p.zeile.rateId ?? null };
    }
    const wege = t.stand === "moeglich"
      ? `nur Name — bitte prüfen${t.ziel && t.ziel.cents === t.eingang.cents ? " (Betrag gleich)" : " (Betrag weicht ab)"}`
      : t.wege.map((w) => WEG_KURZ[w] ?? w).join(" + ") + (t.stand === "gefunden" ? " + Betrag gleich" : " (Betrag weicht ab)");
    await lauf`
      INSERT INTO fiaon_mara_zahlung_funde (bank_txn_id, person_id, kanal, quelle, stand, ziel, bestellung, rate_nr, erwartet, probe, wege)
      VALUES (${t.eingang.id}, ${o.personId}, ${o.kanal}, ${o.quelle}, ${t.stand}, ${ziel}, ${t.stand === "moeglich" ? null : t.ziel?.ref ?? null}, ${t.stand === "moeglich" ? null : t.ziel?.rateNr ?? null},
              ${erwartet ? JSON.stringify(erwartet) : null}::text::jsonb, ${probe}, ${wege})
      ON CONFLICT (bank_txn_id, person_id) DO UPDATE
         SET kanal = EXCLUDED.kanal, quelle = EXCLUDED.quelle, stand = EXCLUDED.stand, ziel = EXCLUDED.ziel, bestellung = EXCLUDED.bestellung,
             rate_nr = EXCLUDED.rate_nr, erwartet = EXCLUDED.erwartet, probe = EXCLUDED.probe, wege = EXCLUDED.wege, aktualisiert_am = NOW()`;
    // Die Karte sofort (nicht erst beim nächsten Sammeln) — derselbe Bau wie der Sammler (eingangKarteJetzt).
    const { eingangKarteJetzt } = await import("./fiaon-mara-entscheidungen");
    const karte = await eingangKarteJetzt(t.eingang.id).catch((e) => {
      console.warn("[MARA-ZAHLUNG] Karte:", String((e as Error)?.message ?? e).slice(0, 160));
      return null;
    });
    await vermerkEinmal(o.personId, o.ref ?? t.ziel?.ref ?? null, o.kanal,
      `Mara hat die gemeldete Zahlung im Bankbuch gesucht (${o.kanal === "whatsapp" ? "WhatsApp" : "Mail"}): ${trefferZeile(t)} `
      + `${erwartet ? `Vorschlag zum Zubuchen auf ${t.ziel?.rateNr ? `Rate ${t.ziel.rateNr}` : ziel} liegt im Mara-Steuerpult (Karte „Geld eingegangen“) — gebucht wird erst mit dem Klick.`
        : t.stand === "moeglich" ? `Eingang über ${(t.eingang.cents / 100).toFixed(2).replace(".", ",")} € vom ${t.eingang.datum.split("-").reverse().join(".")}: nur der Name des Zahlers passt — liegt im Mara-Steuerpult zum Prüfen (kein Zubuchen-Vorschlag).`
        : "Liegt im Mara-Steuerpult (Karte „Geld eingegangen“) zum Zuordnen."}`,
      `[Zahlungsfund #${t.eingang.id}]`, lauf);
    return !!karte;
  } catch (e) {
    console.warn("[MARA-ZAHLUNG] Fund vorlegen:", String((e as Error)?.message ?? e).slice(0, 200));
    return false;
  }
}

/**
 * zahlung_suchen — lesen, rechnen, Fund vorlegen, Hinweis bauen. null: keine Person, Global-Kunde oder Lesefehler
 * (dann sagt Mara nichts über den Eingang — wie bisher im Zweifel).
 */
export async function zahlungSuchenBehandeln(ein: {
  personId: number | null;
  ref?: string | null;
  kanal: ZsKanal;
  /** „Mail #7110“ / „WhatsApp #123“ — steht am Fund. */
  quelle?: string | null;
  jetzt?: Date;
  tage?: number;
}, lauf: Lauf = sqlPool): Promise<ZahlungsLage | null> {
  if (!ein.personId) return null;
  const personId = Number(ein.personId);
  try {
    const { istGlobalKunde } = await import("./fiaon-global-kunde");
    if (await istGlobalKunde(personId).catch(() => false)) return null;
    const d = await zahlungsDatenLesen(personId, lauf, { tage: ein.tage });
    if (!d) return null;
    const heute = berlinToday(ein.jetzt ?? new Date());
    const ergebnis = zahlungSuchen({ person: d.person, bestellungen: d.bestellungen, raten: d.raten, eingaenge: d.eingaenge, heute, tage: ein.tage });
    const vorgelegt: number[] = [];
    if (!d.person.test) {
      for (const t of ergebnis.treffer.filter((x) => x.stand === "gefunden" || x.stand === "abweichend" || x.stand === "moeglich").slice(0, 3)) {
        if (await fundVorlegen(t, { personId, kanal: ein.kanal, quelle: ein.quelle ?? null, ref: ein.ref ?? null }, lauf)) vorgelegt.push(t.eingang.id);
      }
    }
    const satz = zahlungSatz(ergebnis);
    const h = ergebnis.haupt;
    const handlung = h
      ? `zahlung_suchen: ${trefferZeile(h)}${vorgelegt.length ? ` Liegt im Mara-Steuerpult zum Zuordnen (Eingang ${vorgelegt.map((n) => `#${n}`).join(", ")}).` : ""}`
      : `zahlung_suchen: kein passender Eingang in den letzten ${ergebnis.tage} Tagen — Mara bittet um Datum und Beleg.`;
    return {
      ergebnis, satz, handlung, vorgelegt, frueher: d.frueher, test: d.person.test,
      hinweis: zahlungHinweis(ergebnis, { kanal: ein.kanal, kartenGelegt: vorgelegt.length > 0 }),
      daten: zahlungKurz(ergebnis),
    };
  } catch (e) {
    console.warn("[MARA-ZAHLUNG] zahlung_suchen:", String((e as Error)?.message ?? e).slice(0, 200));
    return null;
  }
}
