// ═══════════════════════════════════════════════════════════════════════════
// WISE-AUTOMATIK — der Kontoauszug holt sich selbst (01.09.2026)
//
// BISHER: Justin exportiert von Hand eine CSV aus Wise, übergibt sie, dann
// werden Eingänge verbucht. Zwischen Geldeingang und Verbuchung lagen dadurch
// Stunden bis Tage — und im Feedback vom 01.09. stand genau das: Kunden haben
// bezahlt, das System weiß es noch nicht.
//
// WARUM ES „ANGEBLICH KEINE API GIBT": Wise verlangt für Kontoauszüge von
// Geschäftskonten eine starke Kundenauthentifizierung (SCA). Die läuft NICHT
// über SMS, sondern über ein Schlüsselpaar: Der ÖFFENTLICHE Schlüssel wird
// einmal im Wise-Konto hinterlegt (Einstellungen → API-Tokens → Public Keys),
// der PRIVATE liegt bei uns (WISE_SCA_PRIVATE_KEY). Jede Auszugs-Abfrage
// bekommt von Wise eine Einmal-Nummer (Header x-2fa-approval), wir signieren
// sie mit dem privaten Schlüssel und wiederholen die Abfrage. Vollautomatisch.
//
// WAS DIE AUTOMATIK TUT (Fassung 2, gleicher Tag — Justins Auftrag „alles
// LIVE verbucht"):
//   · Sie liest alle 30 Minuten die Gutschriften der letzten Tage und trägt
//     NEUE ins Bankbuch (fiaon_bank_txns) ein.
//   · Den GLASKLAREN Fall bucht sie sofort selbst — Referenz trifft genau
//     eine offene Bestellung/Rate, Betrag stimmt auf den Cent — über
//     DIESELBEN Wege wie der Mensch (alsBezahltBuchen/rateBezahltBuchen):
//     Freischaltung, Aktivierungsmail, Provision, Ratenkette. Details und
//     Grenzen in liveVerbuchen() unten.
//   · Alles Unklare bleibt Vorschlag im Bankbuch, mit dem Grund in der Notiz.
//   · Der Webhook (/api/fiaon/wise/webhook) ist nur ein WECKER: Wise meldet
//     „Geld ist da", wir stoßen den Einleser an. Dem Webhook-Inhalt wird
//     NICHT vertraut — die Wahrheit holt sich der signierte Auszug selbst.
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Request, type Response } from "express";
import { createSign } from "crypto";
import { sqlPool } from "../lib/db-pool";
import { tageslauf } from "../lib/fiaon-crons";
import { RATEN_MUSTER, refVergleichsform } from "../lib/fiaon-zahlungsauftrag";
import { readChef } from "./fiaon-chef-zugang";

const router = Router();
const WISE_BASIS = "https://api.wise.com";

function wiseToken(): string {
  return String(process.env.WISE_API_TOKEN || "").trim();
}

/** Privater SCA-Schlüssel; erlaubt sowohl echtes PEM als auch \n-escaped aus der Env. */
function scaSchluessel(): string | null {
  const roh = String(process.env.WISE_SCA_PRIVATE_KEY || "").trim();
  if (!roh) return null;
  return roh.includes("BEGIN") ? roh.replace(/\\n/g, "\n") : null;
}

async function wiseGet(pfad: string, extraHeaders: Record<string, string> = {}): Promise<globalThis.Response> {
  return fetch(`${WISE_BASIS}${pfad}`, {
    headers: { Authorization: `Bearer ${wiseToken()}`, "Content-Type": "application/json", ...extraHeaders },
  });
}

/**
 * GET mit SCA-Wiederholung: Antwortet Wise mit 403 und einer Einmal-Nummer,
 * signieren wir sie (RSA-SHA256, base64) und fragen erneut. Ohne hinterlegten
 * Schlüssel geben wir die 403 unverändert zurück — der Status-Endpunkt macht
 * daraus eine verständliche Meldung.
 */
let letzteScaDiagnose: string | null = null;
async function wiseGetMitSca(pfad: string): Promise<globalThis.Response> {
  const erste = await wiseGet(pfad);
  if (erste.status !== 403) return erste;
  const ott = erste.headers.get("x-2fa-approval");
  const key = scaSchluessel();
  if (!ott || !key) {
    letzteScaDiagnose = `1. Antwort 403 ohne ${!ott ? "x-2fa-approval-Header" : "privaten Schlüssel"} — Ergebnis-Header: ${erste.headers.get("x-2fa-approval-result") || "-"}, Körper: ${(await erste.clone().text().catch(() => "")).slice(0, 200)}`;
    return erste;
  }
  const signatur = createSign("RSA-SHA256").update(ott).sign(key, "base64");
  const zweite = await wiseGet(pfad, { "x-2fa-approval": ott, "X-Signature": signatur });
  if (zweite.status === 403) {
    letzteScaDiagnose = `2. Antwort nach Signatur weiter 403 — Ergebnis-Header: ${zweite.headers.get("x-2fa-approval-result") || "-"}, Körper: ${(await zweite.clone().text().catch(() => "")).slice(0, 200)}`;
  } else {
    letzteScaDiagnose = null;
  }
  return zweite;
}

// ── Profil und Kontostand finden (einmal, dann gemerkt) ─────────────────────
let profilId: number | null = null;
let balanceId: number | null = null;

async function verbindungFinden(): Promise<{ profilId: number; balanceId: number }> {
  if (profilId && balanceId) return { profilId, balanceId };
  const pRes = await wiseGet("/v2/profiles");
  if (!pRes.ok) throw new Error(`Profile: HTTP ${pRes.status} ${await pRes.text().then((t) => t.slice(0, 200))}`);
  const profile = (await pRes.json()) as any[];
  const business = profile.find((p) => String(p.type).toUpperCase() === "BUSINESS") || profile[0];
  if (!business?.id) throw new Error("Kein Wise-Profil am Token");
  const bRes = await wiseGet(`/v4/profiles/${business.id}/balances?types=STANDARD`);
  if (!bRes.ok) throw new Error(`Balances: HTTP ${bRes.status}`);
  const balances = (await bRes.json()) as any[];
  const eur = balances.find((b) => b.currency === "EUR");
  if (!eur?.id) throw new Error("Kein EUR-Kontostand im Wise-Profil");
  profilId = Number(business.id);
  balanceId = Number(eur.id);
  return { profilId, balanceId };
}

// ── Referenz-Erkennung: gleiche Logik wie der Mensch beim CSV-Lesen ─────────
export function refErkennen(text: string): string | null {
  const t = String(text || "");
  // „FIAON-XXXXXX", „Fiaon XXXXXX", auch mit Raten-Anhang „-2"; Tippfehler wie
  // „Fiacon" fängt die Automatik bewusst NICHT — die bleiben Handarbeit.
  const m = t.match(/FIAON[\s-]*([A-Z0-9]{6})(-\d{1,2})?/i);
  if (!m) return null;
  return `FIAON-${m[1].toUpperCase()}${m[2] || ""}`;
}

let letzterLauf: { wann: string; neu: number; gebucht: number; gesehen: number; fehler: string | null } | null = null;

/**
 * Der Einleser: Gutschriften der letzten Tage holen, Neues ins Bankbuch,
 * Glasklares live verbuchen. Rückgabe: gesehen / neu / davon gebucht.
 */
export async function wiseEinlesen(tage = 5): Promise<{ gesehen: number; neu: number; gebucht: number }> {
  const { profilId: pid, balanceId: bid } = await verbindungFinden();
  const bis = new Date();
  const von = new Date(bis.getTime() - tage * 24 * 60 * 60 * 1000);
  const pfad = `/v1/profiles/${pid}/balance-statements/${bid}/statement.json` +
    `?currency=EUR&intervalStart=${von.toISOString()}&intervalEnd=${bis.toISOString()}&type=COMPACT`;
  const res = await wiseGetMitSca(pfad);
  if (res.status === 403) {
    throw new Error((scaSchluessel()
      ? "SCA abgelehnt — ist der öffentliche Schlüssel im Wise-Konto hinterlegt (Einstellungen → API-Tokens → Public Keys)?"
      : "SCA nötig, aber WISE_SCA_PRIVATE_KEY ist nicht gesetzt.")
      + (letzteScaDiagnose ? ` [Diagnose: ${letzteScaDiagnose}]` : ""));
  }
  if (!res.ok) throw new Error(`Auszug: HTTP ${res.status} ${await res.text().then((t) => t.slice(0, 200))}`);
  const auszug = (await res.json()) as any;
  const gutschriften = ((auszug.transactions || []) as any[]).filter(
    (t) => t.type === "CREDIT" && String(t.details?.type || "").toUpperCase() === "DEPOSIT" && t.referenceNumber,
  );

  let neu = 0;
  let gebucht = 0;
  for (const g of gutschriften) {
    const zweck = String(g.details?.paymentReference || g.details?.description || "");
    const ref = refErkennen(zweck);
    const basisVgl = ref ? refVergleichsform(ref.replace(/-\d{1,2}$/, "")) : null;
    const cents = Math.round(Number(g.amount?.value || 0) * 100);
    const eingefuegt = await sqlPool`
      INSERT INTO fiaon_bank_txns (txn_id, booked_at, amount_cents, currency, payer_name, reference_raw, extracted_ref, matched_ref, match_status, amount_ok, applied, note)
      SELECT ${g.referenceNumber}, ${g.date}, ${cents}, 'EUR',
             ${String(g.details?.senderName || "")}, ${zweck}, ${ref},
             ziel.ref,
             -- Abnahme-Fund 02.09.: match_status spricht die Sprache der
             -- Verbuchungs-Übersicht (matched|unmatched) — "matched" NUR bei
             -- gefundener Bestellung; amount_ok macht "weicht ab" ehrlich.
             CASE WHEN ziel.ref IS NOT NULL THEN 'matched' ELSE 'unmatched' END,
             CASE WHEN ziel.ref IS NULL THEN NULL
                  ELSE (ROUND(ziel.amount_due * 100) = ${cents}) END,
             false,
             'Wise-Automatik — zur Freischaltung vorgemerkt, noch NICHT gebucht'
      FROM (SELECT ref, amount_due FROM (
              SELECT a.ref, a.amount_due, 1 AS o FROM fiaon_applications a
              WHERE UPPER(REGEXP_REPLACE(COALESCE(a.payment_reference, ''), '[^A-Za-z0-9]', '', 'g')) = ${basisVgl}
                AND a.merged_into IS NULL
              ORDER BY a.created_at DESC LIMIT 1
            ) t
            UNION ALL SELECT NULL, NULL WHERE NOT EXISTS (
              SELECT 1 FROM fiaon_applications a2
              WHERE UPPER(REGEXP_REPLACE(COALESCE(a2.payment_reference, ''), '[^A-Za-z0-9]', '', 'g')) = ${basisVgl}
                AND a2.merged_into IS NULL)
           ) ziel
      WHERE NOT EXISTS (SELECT 1 FROM fiaon_bank_txns b WHERE b.txn_id = ${g.referenceNumber})
      RETURNING id
    `;
    if (eingefuegt.length === 0) continue;
    neu += 1;
    console.log(`[WISE] Neuer Eingang ${g.referenceNumber}: ${g.amount?.value} € von ${g.details?.senderName || "?"} (${ref || "ohne Referenz"})`);
    const erg = await liveVerbuchen(g.referenceNumber, ref, cents, String(g.date || "").slice(0, 10));
    if (erg.gebucht) gebucht += 1;
  }
  letzterLauf = { wann: new Date().toISOString(), neu, gebucht, gesehen: gutschriften.length, fehler: null };
  return { gesehen: gutschriften.length, neu, gebucht };
}

// ═══════════════════════════════════════════════════════════════════════════
// LIVE-VERBUCHUNG (01.09.2026, Justins Auftrag: „alles LIVE verbucht")
//
// Automatisch gebucht wird NUR der glasklare Fall — dieselben Regeln, nach
// denen bisher der Mensch gebucht hat:
//   · Erstzahlung: Referenz trifft GENAU EINE offene Bestellung
//     (pending_payment/claimed_paid) und der Betrag stimmt AUF DEN CENT →
//     derselbe Weg wie der mark-paid-Knopf (alsBezahltBuchen): Status,
//     Aktivierungsmail, Provision, Ratenkette.
//   · Monatsrate: Referenz nennt die Raten-Nummer (FIAON-XXXXXX-2) und trifft
//     genau diese offene Rate mit exaktem Betrag → rateBezahltBuchen
//     (Folge-Rate, Ratenprovision).
//   · Regel B (01.10.2026): Referenz OHNE Ratennummer, Bestellung schon
//     bezahlt → die älteste offene fällige Rate, wenn Betrag (±1 €) und
//     Deckung je Kunde passen (Einzelheiten an regelBPruefen unten).
// ALLES ANDERE — Betrag weicht ab, Referenz unklar, Tippfehler wie „Fiacon",
// Kündigung, Deckung unklar — bleibt Vorschlag im Bankbuch für den Menschen.
// Die Fälle van Beuzekom (Doppelzahlung), Demurtas (Nachzügler) und Harder
// (Startzahlung ohne Beleg) vom 31.08./01.09. sind GENAU die Sorte, die diese
// Automatik bewusst NICHT anfasst.
//
// E-235 (24.09.2026): Seit dem 08.08. tragen neue Bestellungen FIAONXXXXXX
// (ohne Strich), ihre Raten FIAONXXXXXX-N. refErkennen setzt den Strich immer
// ein, verglichen wurde aber exakt — 0 Treffer, der Eingang blieb liegen
// (Beleg: AWX-ab5e210f…, 18.09., 99,99 €). Verglichen wird jetzt in der
// Vergleichsform (refVergleichsform), gebucht und vermerkt mit der Schreibweise
// aus der Datenbank. Mehrdeutig bleibt mehrdeutig: dann bucht nichts.
//
// Optionen:
//   `trocken` — dieselbe Regel, aber kein Vermerk und keine Buchung: die
//     Vorschau „was würde gebucht", bevor ein Mensch einen Nachhol-Lauf freigibt.
//   `ueberzahlungBisCents` — NUR für den von Hand freigegebenen Nachhol-Lauf
//     (Route unten): eine Erstzahlung darf so viele Cent ÜBER dem Soll liegen
//     (höchstens 100). Nie darunter. Die Automatik ruft ohne → centgenau wie bisher.
//   `anlass` — wer bucht; steht in Vermerk und Ratennotiz (Vorgabe: Automatik).
// ═══════════════════════════════════════════════════════════════════════════
export interface VerbuchenErgebnis {
  gebucht: boolean;
  grund: string;
  /** Welcher Zweig griff — für Vorschau und Protokoll des Nachhol-Laufs. */
  regel?: "rate" | "erstzahlung" | "regel_b";
  /** Raten- bzw. Bestellreferenz in der Schreibweise der Datenbank. */
  ziel?: string;
  /** fiaon_applications.ref der Bestellung, zu der das Geld gehört. */
  bestellung?: string;
  rateId?: number;
  rateNr?: number;
  /** Regel B: die Deckungsrechnung, auf der die Entscheidung beruht. */
  deckung?: RegelBDeckung;
}

export async function liveVerbuchen(
  txnId: string, ref: string | null, cents: number, datum: string,
  opts: { trocken?: boolean; ueberzahlungBisCents?: number; anlass?: string } = {},
): Promise<VerbuchenErgebnis> {
  const wer = opts.anlass || "Wise-Automatik";
  const vermerk = async (note: string, applied = false, zielBestellung: string | null = null) => {
    if (opts.trocken) return;
    // Beim Verbuchen hält das Bankbuch fest, WELCHER Bestellung das Geld gehört
    // (matched_ref) — Rückholung, Kundenlage und die Deckungsrechnung von Regel B
    // lesen genau diese Spalte.
    await sqlPool`
      UPDATE fiaon_bank_txns SET note = ${note}, applied = ${applied},
             applied_at = ${applied ? new Date() : null},
             matched_ref = COALESCE(${zielBestellung}::text, matched_ref),
             match_status = CASE WHEN ${zielBestellung}::text IS NULL THEN match_status ELSE 'matched' END,
             updated_at = NOW()
      WHERE txn_id = ${txnId}
    `.catch(() => {});
  };
  try {
    if (!ref || !datum) return { gebucht: false, grund: "keine Referenz" };

    // ── NIE DOPPELT (01.10.2026) ───────────────────────────────────────────
    // Der UNIQUE-Index fiaon_raten_ein_eingang_eine_rate schützt nur Wise
    // (TRANSFER-…); für Airwallex (AWX-…) gibt es keinen Datenbankschutz. Ein
    // Eingang, der schon verbucht ist oder schon in einer bezahlten Rate steht,
    // wird deshalb hier — vor jedem Zweig — abgewiesen.
    const [verbraucht] = (await sqlPool`
      SELECT
        (SELECT applied FROM fiaon_bank_txns WHERE txn_id = ${txnId} LIMIT 1) AS applied,
        (SELECT zahlungsreferenz FROM fiaon_abo_raten
          WHERE status = 'bezahlt' AND POSITION(${`Bankeingang ${txnId}`} IN COALESCE(notiz, '')) > 0
          LIMIT 1) AS rate
    `) as any[];
    if (verbraucht?.applied === true) return { gebucht: false, grund: "Eingang ist schon verbucht" };
    if (verbraucht?.rate) {
      await vermerk(`${wer}: Dieser Eingang steht schon in der bezahlten Rate ${verbraucht.rate} — nicht noch einmal gebucht.`);
      return { gebucht: false, grund: `Eingang schon verbraucht (Rate ${verbraucht.rate})` };
    }

    // ── Monatsrate: FIAON-XXXXXX-N, seit 08.08. auch FIAONXXXXXX-N ─────────
    if (RATEN_MUSTER.test(ref)) {
      const raten = (await sqlPool`
        SELECT id, ref, rate_nr, zahlungsreferenz, betrag_cents, status FROM fiaon_abo_raten
        WHERE UPPER(REGEXP_REPLACE(zahlungsreferenz, '[^A-Za-z0-9]', '', 'g')) = ${refVergleichsform(ref)}
          AND storniert_am IS NULL
      `) as any[];
      if (raten.length !== 1) return { gebucht: false, grund: "Rate nicht eindeutig", regel: "rate" };
      const rateRef = String(raten[0].zahlungsreferenz);
      const basis = { regel: "rate" as const, ziel: rateRef, bestellung: String(raten[0].ref), rateId: Number(raten[0].id), rateNr: Number(raten[0].rate_nr) };
      if (String(raten[0].status) === "bezahlt") {
        await vermerk(`${wer}: Rate ${rateRef} ist bereits als bezahlt gebucht — Eingang bitte von Hand zuordnen (Doppelzahlung?).`);
        return { gebucht: false, grund: "Rate schon bezahlt", ...basis };
      }
      if (Number(raten[0].betrag_cents) !== cents) {
        await vermerk(`${wer}: Rate ${rateRef} gefunden, aber Betrag weicht ab (${(cents / 100).toFixed(2)} € statt ${(Number(raten[0].betrag_cents) / 100).toFixed(2)} €) — bitte von Hand buchen.`);
        return { gebucht: false, grund: "Betrag weicht ab", ...basis };
      }
      if (opts.trocken) return { gebucht: false, grund: `würde buchen: Rate ${rateRef}`, ...basis };
      const { rateBezahltBuchen } = await import("./fiaon-abo");
      const erg = await rateBezahltBuchen({
        rateId: Number(raten[0].id), zahlungsdatum: datum, quelle: "bank",
        notiz: `Bankeingang ${txnId} — ${opts.anlass ? `gebucht (${opts.anlass})` : "automatisch gebucht (Wise-Automatik)"}`,
      });
      if (erg.ok && !erg.schonBezahlt) {
        await vermerk(`${wer}: LIVE verbucht — Rate ${rateRef} bezahlt per ${datum} (Ratenprovision nach Schalter: gebucht oder vorgemerkt).`, true, basis.bestellung);
        console.log(`[WISE] LIVE verbucht: Rate ${rateRef} (${(cents / 100).toFixed(2)} €)`);
        return { gebucht: true, grund: "Rate gebucht", ...basis };
      }
      await vermerk(`${wer}: Rate ${rateRef} NICHT automatisch gebucht (${erg.ok ? "war schon bezahlt" : erg.error || "abgelehnt"}) — bitte prüfen.`);
      return { gebucht: false, grund: erg.ok ? "schon bezahlt" : String(erg.error || "abgelehnt"), ...basis };
    }

    // ── Erstzahlung: exakt EINE offene Bestellung, Betrag auf den Cent ────
    const apps = (await sqlPool`
      SELECT ref, payment_reference, payment_status, ROUND(amount_due * 100)::int AS soll_cents, gekuendigt_am, person_id
      FROM fiaon_applications
      WHERE UPPER(REGEXP_REPLACE(COALESCE(payment_reference, ''), '[^A-Za-z0-9]', '', 'g')) = ${refVergleichsform(ref)}
        AND merged_into IS NULL
    `) as any[];
    if (apps.length !== 1) return { gebucht: false, grund: apps.length === 0 ? "keine Bestellung zur Referenz" : "Referenz mehrdeutig" };
    const app = apps[0];
    // alsBezahltBuchen sucht exakt — also mit der Schreibweise aus der Datenbank.
    const bestellRef = String(app.payment_reference);

    // ── Regel B: bezahlte Bestellung, Eingang ohne Ratennummer ────────────
    if (String(app.payment_status) === "paid") {
      const b = await regelBPruefen({
        txnId, bestellung: String(app.ref), bestellRef, cents, datum, gekuendigtAm: app.gekuendigt_am ?? null,
        personId: app.person_id != null ? Number(app.person_id) : null,
      });
      const basis = { regel: "regel_b" as const, ziel: b.rate?.zahlungsreferenz ?? bestellRef, bestellung: String(app.ref), rateId: b.rate?.id, rateNr: b.rate?.rateNr, deckung: b.deckung };
      if (!b.ok || !b.rate) {
        await vermerk(`${wer}: Bestellung ${bestellRef} ist bezahlt, der Eingang nennt keine Ratennummer — Regel B bucht nicht: ${b.grund}. Bitte von Hand zuordnen.`);
        return { gebucht: false, grund: `Regel B: ${b.grund}`, ...basis };
      }
      const abw = cents - b.rate.betragCents;
      const abwText = abw === 0 ? "" : ` (Abweichung ${abw > 0 ? "+" : ""}${(abw / 100).toFixed(2)} €)`;
      if (opts.trocken) return { gebucht: false, grund: `würde buchen: Rate ${b.rate.zahlungsreferenz} (Regel B)${abwText}`, ...basis };
      const { rateBezahltBuchen } = await import("./fiaon-abo");
      const erg = await rateBezahltBuchen({
        rateId: b.rate.id, zahlungsdatum: datum, quelle: "bank",
        notiz: `Bankeingang ${txnId} — Regel B: Eingang ohne Ratennummer (${bestellRef}), älteste offene Rate${abwText}`
          + (opts.anlass ? `, gebucht (${opts.anlass})` : ", automatisch gebucht"),
      });
      if (erg.ok && !erg.schonBezahlt) {
        await vermerk(`${wer}: LIVE verbucht (Regel B) — Eingang ohne Ratennummer → Rate ${b.rate.zahlungsreferenz} bezahlt per ${datum}${abwText}. ${b.deckung?.text ?? ""}`.trim(), true, String(app.ref));
        console.log(`[WISE] LIVE verbucht (Regel B): ${bestellRef} → Rate ${b.rate.zahlungsreferenz} (${(cents / 100).toFixed(2)} €)`);
        return { gebucht: true, grund: "Rate gebucht (Regel B)", ...basis };
      }
      await vermerk(`${wer}: Regel B — Rate ${b.rate.zahlungsreferenz} NICHT gebucht (${erg.ok ? "war schon bezahlt" : erg.error || "abgelehnt"}) — bitte prüfen.`);
      return { gebucht: false, grund: erg.ok ? "schon bezahlt" : String(erg.error || "abgelehnt"), ...basis };
    }

    const basis = { regel: "erstzahlung" as const, ziel: bestellRef, bestellung: String(app.ref) };
    if (!["pending_payment", "claimed_paid"].includes(String(app.payment_status))) {
      await vermerk(`${wer}: Bestellung ${bestellRef} steht auf '${app.payment_status}' — nichts automatisch gebucht, bitte von Hand zuordnen (Rate? Doppelzahlung?).`);
      return { gebucht: false, grund: `Status ${app.payment_status}`, ...basis };
    }
    const soll = Number(app.soll_cents);
    const zuViel = cents - soll;
    const toleranz = Math.max(0, Math.min(100, Math.floor(Number(opts.ueberzahlungBisCents) || 0)));
    if (!(zuViel === 0 || (zuViel > 0 && zuViel <= toleranz))) {
      await vermerk(`${wer}: Bestellung ${bestellRef} gefunden, aber Betrag weicht ab (${(cents / 100).toFixed(2)} € statt ${(soll / 100).toFixed(2)} €) — bitte von Hand buchen.`);
      return { gebucht: false, grund: "Betrag weicht ab", ...basis };
    }
    const ueberText = zuViel > 0 ? ` (Überzahlung ${(zuViel / 100).toFixed(2)} €)` : "";
    if (opts.trocken) return { gebucht: false, grund: `würde buchen: Erstzahlung ${bestellRef}${ueberText}`, ...basis };
    const { alsBezahltBuchen } = await import("./fiaon-antrag");
    const erg = await alsBezahltBuchen(bestellRef, { zahlungsdatum: datum, quelle: opts.anlass ? `bankeingang:${txnId}` : "wise-automatik" });
    if (erg.ok) {
      await vermerk(`${wer}: LIVE verbucht — ${bestellRef} bezahlt per ${datum}${ueberText}, Kunde freigeschaltet (Aktivierungsmail + Provision nach Schalter über den einen Buchungsweg).`, true, String(app.ref));
      console.log(`[WISE] LIVE verbucht: ${bestellRef} (${(cents / 100).toFixed(2)} €) — Kunde freigeschaltet`);
      return { gebucht: true, grund: "Erstzahlung gebucht", ...basis };
    }
    await vermerk(`${wer}: ${bestellRef} NICHT automatisch gebucht (${erg.error}) — bitte prüfen.`);
    return { gebucht: false, grund: String(erg.error), ...basis };
  } catch (e: any) {
    console.error("[WISE] liveVerbuchen:", e?.message || e);
    await vermerk(`${wer}: Buchungsversuch fehlgeschlagen (${String(e?.message || e).slice(0, 120)}) — bitte von Hand buchen.`);
    return { gebucht: false, grund: "Fehler" };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// REGEL B — DIE RATE OHNE NUMMER (01.10.2026, Justins Go: „Raten live stellen")
//
// Kunden zahlen ihre Monatsrate meist mit der Bestellreferenz ohne „-N"
// („FIAON 596FE4 2", „FIAON J8UU3U 3", „VZ. FIAONMSYOCC. 2.Rate"). Die
// Bestellung ist längst bezahlt, also landete jeder dieser Eingänge bisher bei
// „steht auf 'paid' — bitte von Hand zuordnen". Regel B ordnet ihn der
// ÄLTESTEN offenen Rate zu — aber nur, wenn ALLES davon stimmt:
//
//   1. Die Bestellung ist bezahlt, nicht gekündigt (Kündigungen sind Streit-
//      und Kulanzfälle — dort entscheidet ein Mensch), und Rate 1 ist bezahlt.
//      Gegenprüfung 01.10.2026: Auch eine BEANTRAGTE, noch unbearbeitete
//      Kündigung sperrt — Formular (cancellation_requests 'pending'), offene
//      Kündigungs-Aufgabe (fiaon_betreiber_todos) oder unbeantwortete
//      Kündigungsmail im Postfach (fiaon_postmeister, Kategorie kuendigung).
//      Grund „Kündigung beantragt – Mensch entscheidet": Der Eingang bleibt
//      vorgemerkt, nichts wird gebucht (kuendigungOffen unten).
//   2. Die älteste offene Rate ist fällig — spätestens 7 Tage nach dem Eingang
//      (wer ein paar Tage zu früh überweist, ist kein Sonderfall).
//   3. Hinter ihr steht keine bezahlte Rate mit höherer Nummer: Die Kette läuft
//      vorwärts, nie wird eine Lücke rückwärts gestopft.
//   4. Der Betrag passt auf ±1 €.
//   5. DECKUNG JE KUNDE (Lehre aus dem 23.08., fiaon-raten-doppelbuchung): Der
//      Eingang darf nicht in Wahrheit das Geld für eine schon bezahlte Rate sein
//      (typisch: Startzahlung ohne Bankbeleg gebucht, das Geld kommt danach).
//      Die übrigen Eingänge dieses Kunden bis zu diesem Tag müssen die bezahlten
//      Raten decken (Toleranz 1 € je Rate). Tun sie es nicht, zählt eine
//      bezahlte Rate ohne Bankbeleg nur dann als anderweitig gedeckt, wenn sie
//      mehr als 35 Tage vor dem Eingang bezahlt wurde (Stripe-/Wise-Zeit, deren
//      Geld nie in diesem Bankbuch stand). Sonst: Handarbeit.
//   6. Der Eingang steht noch in keiner bezahlten Rate (oben in liveVerbuchen).
//
// Gebucht wird über rateBezahltBuchen wie jede andere Rate — mit derselben
// Rückwärtssperre, „Bankeingang <txn>" in der Notiz und den Provisionen nach
// Schalter. Kein zweiter Buchungsweg.
// ═══════════════════════════════════════════════════════════════════════════
export interface RegelBDeckung {
  eingaengeCents: number;
  eingaengeAnzahl: number;
  bezahltCents: number;
  bezahltAnzahl: number;
  /** Bezahlte Raten ohne Bankbeleg in der Notiz, die jünger als 35 Tage vor dem Eingang sind. */
  ungedeckteJunge: number;
  text: string;
}

export const REGEL_B = { toleranzCents: 100, vorlaufTage: 7, belegfreiAlterTage: 35 } as const;

/**
 * Liegt zu dieser Bestellung (oder dieser Person) eine BEANTRAGTE, noch unbearbeitete
 * Kündigung vor? Drei Türen, durch die eine Kündigung ins Haus kommt, bevor
 * gekuendigt_am gesetzt ist:
 *   · Formular /kuendigung → cancellation_requests mit status 'pending'
 *   · Aufgabe an Betreuer/Betreiber (fiaon_betreiber_todos) mit Kündigungs-Schlüssel
 *     oder -Quelle, nicht erledigt, die diese Bestellung oder Person nennt
 *   · Postfach (fiaon_postmeister): Mail der Kategorie kuendigung, noch nicht beantwortet
 * Liefert den ersten Fund als Wort — oder null. Scheitert die Abfrage selbst, gilt das
 * als Fund („Prüfung nicht möglich"): lieber Handarbeit als eine Rate gegen einen Kunden
 * buchen, der gerade kündigt.
 */
export async function kuendigungOffen(bestellung: string, personId: number | null): Promise<string | null> {
  try {
    const pid = personId != null && Number.isFinite(personId) ? Number(personId) : null;
    const [r] = (await sqlPool`
      SELECT
        (SELECT COUNT(*) FROM cancellation_requests c
          WHERE c.ref = ${bestellung} AND c.status = 'pending')::int AS formular,
        (SELECT COUNT(*) FROM fiaon_betreiber_todos t
          WHERE t.status <> 'erledigt'
            AND (t.quelle = 'kuendigung' OR t.schluessel LIKE 'kuendigung:%' OR t.schluessel LIKE 'postmeister:kuendigung%'
                 OR t.titel ILIKE '%kündig%' OR t.titel ILIKE '%kuendig%')
            AND (COALESCE(t.link, '') LIKE ${`%${bestellung}%`} OR COALESCE(t.schluessel, '') LIKE ${`%${bestellung}%`}
                 OR COALESCE(t.text, '') LIKE ${`%${bestellung}%`}
                 OR (${pid}::int IS NOT NULL AND COALESCE(t.link, '') ~ ${`/kunden?/${pid ?? 0}(/|$)`})))::int AS aufgabe,
        (SELECT COUNT(*) FROM fiaon_postmeister pm
          WHERE (pm.ref = ${bestellung} OR (${pid}::int IS NOT NULL AND pm.person_id = ${pid}))
            AND (pm.kategorie = 'kuendigung' OR 'kuendigung' = ANY(COALESCE(pm.kategorien, ARRAY[]::text[])))
            AND pm.gesendet_am IS NULL AND pm.aktion <> 'auto_beantwortet')::int AS postfach
    `) as any[];
    if (Number(r?.formular) > 0) return "Kündigungsformular offen";
    if (Number(r?.aufgabe) > 0) return "Kündigungs-Aufgabe offen";
    if (Number(r?.postfach) > 0) return "Kündigungsmail im Postfach unbeantwortet";
    return null;
  } catch (e: any) {
    console.error("[WISE] kuendigungOffen:", String(e?.message || e).slice(0, 160));
    return "Kündigungsprüfung nicht möglich";
  }
}

export async function regelBPruefen(e: {
  txnId: string; bestellung: string; bestellRef: string; cents: number; datum: string; gekuendigtAm: string | Date | null;
  /** Person zur Bestellung — für die Suche nach beantragten Kündigungen (Aufgaben, Postfach). */
  personId?: number | null;
}): Promise<{ ok: boolean; grund: string; rate?: { id: number; rateNr: number; zahlungsreferenz: string; betragCents: number; faelligAm: string }; deckung?: RegelBDeckung }> {
  if (e.gekuendigtAm) return { ok: false, grund: "Vertrag ist gekündigt — Zuordnung entscheidet ein Mensch" };
  const beantragt = await kuendigungOffen(e.bestellung, e.personId ?? null);
  if (beantragt) return { ok: false, grund: `Kündigung beantragt – Mensch entscheidet (${beantragt})` };

  const raten = (await sqlPool`
    SELECT id, rate_nr, zahlungsreferenz, betrag_cents, status, faellig_am, bezahlt_am, notiz
      FROM fiaon_abo_raten
     WHERE ref = ${e.bestellung} AND storniert_am IS NULL AND status IN ('offen', 'bezahlt')
     ORDER BY rate_nr
  `) as any[];
  const bezahlt = raten.filter((r) => r.status === "bezahlt");
  const offen = raten.filter((r) => r.status === "offen");
  if (!bezahlt.some((r) => Number(r.rate_nr) === 1)) return { ok: false, grund: "Rate 1 ist nicht als bezahlt gebucht" };
  const kandidat = offen[0];
  if (!kandidat) return { ok: false, grund: "keine offene Rate (Doppelzahlung oder Vertragsende?)" };
  const faellig = new Date(kandidat.faellig_am).toISOString().slice(0, 10);
  const spaetestens = new Date(`${e.datum}T12:00:00Z`);
  spaetestens.setUTCDate(spaetestens.getUTCDate() + REGEL_B.vorlaufTage);
  if (faellig > spaetestens.toISOString().slice(0, 10)) {
    return { ok: false, grund: `älteste offene Rate ${kandidat.zahlungsreferenz} ist erst am ${faellig} fällig (Vorauszahlung?)` };
  }
  if (bezahlt.some((r) => Number(r.rate_nr) > Number(kandidat.rate_nr))) {
    return { ok: false, grund: `nach der offenen Rate ${kandidat.rate_nr} ist schon eine spätere bezahlt (Lücke in der Kette)` };
  }
  const abw = Math.abs(e.cents - Number(kandidat.betrag_cents));
  if (abw > REGEL_B.toleranzCents) {
    return { ok: false, grund: `Betrag ${(e.cents / 100).toFixed(2)} € passt nicht zur Rate ${kandidat.zahlungsreferenz} (${(Number(kandidat.betrag_cents) / 100).toFixed(2)} €)` };
  }

  // ── Deckung je Kunde ──────────────────────────────────────────────────
  const vgl = refVergleichsform(e.bestellRef);
  const [ein] = (await sqlPool`
    SELECT COALESCE(SUM(b.amount_cents), 0)::bigint AS cents, COUNT(*)::int AS n
      FROM fiaon_bank_txns b
     WHERE b.txn_id <> ${e.txnId} AND b.amount_cents > 0
       AND COALESCE(b.match_status, '') <> 'ignored'
       AND b.booked_at::date <= ${e.datum}::date
       AND (b.matched_ref = ${e.bestellung}
            OR UPPER(REGEXP_REPLACE(REGEXP_REPLACE(COALESCE(b.extracted_ref, ''), '-[0-9]{1,2}$', ''), '[^A-Za-z0-9]', '', 'g')) = ${vgl})
  `) as any[];
  const eingaengeCents = Number(ein?.cents || 0);
  const bezahltCents = bezahlt.reduce((s, r) => s + Number(r.betrag_cents || 0), 0);
  const grenze = new Date(`${e.datum}T12:00:00Z`);
  grenze.setUTCDate(grenze.getUTCDate() - REGEL_B.belegfreiAlterTage);
  const jungOhneBeleg = bezahlt.filter((r) =>
    !String(r.notiz || "").includes("Bankeingang ")
    && r.bezahlt_am && new Date(r.bezahlt_am).getTime() >= grenze.getTime());
  const gedecktDurchEingaenge = eingaengeCents + REGEL_B.toleranzCents * bezahlt.length >= bezahltCents;
  const deckung: RegelBDeckung = {
    eingaengeCents, eingaengeAnzahl: Number(ein?.n || 0), bezahltCents, bezahltAnzahl: bezahlt.length,
    ungedeckteJunge: jungOhneBeleg.length,
    text: `Deckung: ${Number(ein?.n || 0)} frühere(r) Eingang/Eingänge ${(eingaengeCents / 100).toFixed(2)} € gegen ${bezahlt.length} bezahlte Rate(n) ${(bezahltCents / 100).toFixed(2)} €`
      + (gedecktDurchEingaenge ? "." : ` — Rest vor über ${REGEL_B.belegfreiAlterTage} Tagen ohne Bankbeleg bezahlt.`),
  };
  if (!gedecktDurchEingaenge && jungOhneBeleg.length > 0) {
    return {
      ok: false, deckung,
      grund: `Deckung unklar — Rate ${jungOhneBeleg.map((r) => r.rate_nr).join(", ")} ohne Bankbeleg in den letzten ${REGEL_B.belegfreiAlterTage} Tagen bezahlt; der Eingang könnte ihr Geld sein`,
    };
  }
  return {
    ok: true, grund: "passt", deckung,
    rate: {
      id: Number(kandidat.id), rateNr: Number(kandidat.rate_nr), zahlungsreferenz: String(kandidat.zahlungsreferenz),
      betragCents: Number(kandidat.betrag_cents), faelligAm: faellig,
    },
  };
}

// ── Verwaltungs-Endpunkte (hinter dem Admin-Tor, Pfade beginnen mit /admin) ──
router.get("/admin/wise/status", async (_req: Request, res: Response) => {
  const stand: any = { token_gesetzt: !!wiseToken(), sca_schluessel_gesetzt: !!scaSchluessel(), letzter_lauf: letzterLauf };
  try {
    const v = await verbindungFinden();
    stand.profil_id = v.profilId;
    stand.balance_id = v.balanceId;
    stand.verbindung = "ok";
    try {
      const probe = await wiseEinlesen(1);
      stand.auszug = `ok — ${probe.gesehen} Gutschriften in 24 h, ${probe.neu} neu eingetragen, ${probe.gebucht} davon live verbucht`;
    } catch (e: any) {
      stand.auszug = `FEHLT: ${e?.message || e}`;
    }
  } catch (e: any) {
    stand.verbindung = `FEHLT: ${e?.message || e}`;
  }
  res.json({ ok: true, ...stand });
});

router.post("/admin/wise/einlesen", async (req: Request, res: Response) => {
  try {
    const tage = Math.min(30, Math.max(1, Number(req.body?.tage) || 5));
    const erg = await wiseEinlesen(tage);
    res.json({ ok: true, ...erg });
  } catch (e: any) {
    res.status(502).json({ ok: false, error: String(e?.message || e) });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /admin/zahlungen/bankeingang-nachholen { id, trocken, ueberzahlungBisCents? }
//
// DER NACHHOL-LAUF (01.10.2026). Die Einleser (Airwallex, Wise) rufen
// liveVerbuchen nur für NEUE Zeilen. Was schon im Bankbuch liegt — weil E-235
// (Referenz ohne Strich) und Regel B (Rate ohne Nummer) erst jetzt greifen —
// bleibt sonst für immer liegen. Diese Route schickt EINEN bestehenden,
// unverbuchten Eingang durch genau denselben Weg (liveVerbuchen → alsBezahlt-
// Buchen / rateBezahltBuchen). Kein zweiter Buchungsweg, keine eigene Regel.
//
//   · Ein Eingang je Aufruf. `trocken` (Vorgabe: true!) zeigt, was passieren würde.
//   · Bucht nur, was nicht schon verbucht ist und kein Geld „unterwegs" ist.
//   · `ueberzahlungBisCents` (höchstens 100) erlaubt einer ERSTZAHLUNG ein paar
//     Cent zu viel (Beispiel 01.10.: 100,00 € auf 99,99 €). Nie zu wenig.
//   · Liegt unter /admin/zahlungen → nur Admin-Code oder Chef-Stufe
//     Geschäftsführung/Inhaber (NUR_GESCHAEFTSFUEHRUNG in fiaon-admin-zugang.ts:
//     die Chef-Sitzung passiert adminCodeGate ohne Code). Justin selbst klickt
//     im Bankbuch (FIAON Banking → Umsätze, fiaon-buchhaltung.ts) — dieselbe
//     Rechnung aus server/lib/fiaon-bank-nachholen.ts, ohne Admin-Code.
// ═══════════════════════════════════════════════════════════════════════════
router.post("/admin/zahlungen/bankeingang-nachholen", async (req: Request, res: Response) => {
  const id = Number(req.body?.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ ok: false, error: "id fehlt (fiaon_bank_txns.id)." });
  // Vorsicht als Vorgabe: Nur ein ausdrückliches trocken:false bucht.
  const trocken = req.body?.trocken !== false;
  const ueberzahlungBisCents = Math.max(0, Math.min(100, Math.floor(Number(req.body?.ueberzahlungBisCents) || 0)));
  try {
    const { bankeingangTrockenprobe, bankeingangBuchen } = await import("../lib/fiaon-bank-nachholen");
    const chef = readChef(req);
    const wer = chef ? `Chef #${chef.agentId}` : "Admin-Code";
    const a = trocken
      ? await bankeingangTrockenprobe(id, { ueberzahlungBisCents })
      : await bankeingangBuchen(id, { ueberzahlungBisCents, wer, erwartet: req.body?.erwartet ?? null });
    const z = a.zeile;
    // Kopf wie bisher (das Skript liest ihn), dazu die ganze Zeile der Trockenprobe.
    const kopf = z ? { id: z.id, txnId: z.txnId, betragCents: z.betragCents, datum: z.datum, referenz: z.zweckRef, trocken } : { id, trocken };
    if (!a.ok) return res.status(a.status).json({ ok: false, ...kopf, error: a.error, zeile: z ?? null });
    const ergebnis = trocken
      ? { gebucht: false, grund: z!.ergebnis, regel: z!.regel ?? undefined, ziel: z!.ziel ?? undefined, bestellung: z!.bestellung ?? undefined, rateId: z!.rateId ?? undefined, rateNr: z!.rateNr ?? undefined }
      : (a as any).ergebnis;
    res.json({ ok: true, ...kopf, ergebnis, bankbuch: (a as any).bankbuch ?? null, zeile: z ?? null, aufgabe: (a as any).aufgabe ?? null });
  } catch (e: any) {
    console.error("[BANK-NACHHOLEN]", e?.message || e);
    res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 300) });
  }
});

// ── Der Wecker: Wise meldet „Geld ist da" ───────────────────────────────────
// Öffentlich erreichbar (Wise ruft ohne unser Token an). Dem Inhalt wird nicht
// vertraut; er löst nur — gebremst — den signierten Einleser aus. Antwort ist
// immer 200, sonst deaktiviert Wise das Abo nach wiederholten Fehlern.
let letzterWecker = 0;
router.post("/wise/webhook", (req: Request, res: Response) => {
  res.status(200).send("ok");
  const jetzt = Date.now();
  if (jetzt - letzterWecker < 120_000) return;
  letzterWecker = jetzt;
  const art = String((req.body as any)?.event_type || "unbekannt");
  console.log(`[WISE] Wecker: ${art} — Einleser startet`);
  wiseEinlesen(2).catch((e) => console.error("[WISE] Wecker-Einlesen:", e?.message || e));
});

// Alle 30 Minuten von selbst — zusätzlich zum Wecker, als Netz darunter.
// 06.09.2026: WISE_AUS=1 (Render) hält den Lauf still — das Wise-Konto ist seit 02.09. gesperrt,
// und ein Dauerrot in der Laufüberwachung verdeckt echte Ausfälle (Airwallex-Abgleich).
if (process.env.WISE_AUS !== "1") tageslauf("wise-auszug", async () => {
  const r = await wiseEinlesen(5);
  if (r.neu > 0) console.log(`[WISE] Tageslauf: ${r.neu} neue Eingänge im Bankbuch`);
  return r;
}, 30 * 60 * 1000, { beimStartNach: 90_000 });
else console.log("[WISE] Tageslauf still (WISE_AUS=1).");

export default router;
