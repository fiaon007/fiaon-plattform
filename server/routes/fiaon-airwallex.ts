// ═══════════════════════════════════════════════════════════════════════════
// AIRWALLEX-EINLESER — der Ersatz für die Wise-Automatik (02.09.2026)
//
// DER ANLASS: Das Wise-Konto wurde am 02.09.2026 gesperrt. Seitdem zahlen die
// Kunden auf das Airwallex Global Account (Banking Circle, siehe
// shared/fiaon-bank.ts). Ohne Einleser sieht die Plattform kein Geld: keine
// Freischaltung, keine Ratenbuchung, kein Schutz vor Mahnungen an Menschen,
// die längst bezahlt haben (fiaon_bank_txns ist die Wahrheit für alle).
//
// WAS ER TUT: Alle 30 Minuten (und auf Zuruf) die Gutschriften der letzten
// Tage holen, Neues ins Bankbuch (fiaon_bank_txns — dieselbe Tabelle, dieselben
// Spalten wie beim Wise-CSV), und den GLASKLAREN Fall live verbuchen — mit
// exakt derselben Regel wie bei Wise (liveVerbuchen aus fiaon-wise.ts):
// Referenz trifft genau eine offene Bestellung/Rate, Betrag auf den Cent.
// Alles andere bleibt Vorschlag für den Menschen.
//
// ZUGANG: Airwallex-API-Schlüssel (Konto → Entwickler → API-Schlüssel), als
// Render-Umgebung AIRWALLEX_CLIENT_ID + AIRWALLEX_API_KEY; optional
// AIRWALLEX_GLOBAL_ACCOUNT_ID (sonst wird das EUR-Konto mit unserer IBAN
// gesucht) und AIRWALLEX_BASE (Standard https://api.airwallex.com).
// Ohne Schlüssel läuft nichts — der Status sagt es ehrlich.
//
// FELDNAMEN: Die Airwallex-Antwort wird tolerant gelesen (mehrere mögliche
// Feldnamen je Wert). Der erste Eingang wird einmal mit seinen Schlüsseln ins
// Log geschrieben, damit die Zuordnung am echten Datensatz nachgezogen werden
// kann, falls sie abweicht. Nichts wird gebucht, was nicht sauber gelesen wurde.
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { tageslauf } from "../lib/fiaon-crons";
import { BANK } from "@shared/fiaon-bank";
import { refErkennen, liveVerbuchen } from "./fiaon-wise";

const router = Router();

function basis(): string { return (process.env.AIRWALLEX_BASE || "https://api.airwallex.com").replace(/\/+$/, ""); }
function konfiguriert(): boolean { return !!(process.env.AIRWALLEX_CLIENT_ID && process.env.AIRWALLEX_API_KEY); }

let token: { wert: string; bis: number } | null = null;
let letzterLauf: { wann: string; gesehen: number; neu: number; gebucht: number; fehler: string | null } | null = null;
let beispielGeloggt = false;

async function anmelden(): Promise<string> {
  if (token && Date.now() < token.bis) return token.wert;
  const res = await fetch(`${basis()}/api/v1/authentication/login`, {
    method: "POST",
    headers: {
      "x-client-id": String(process.env.AIRWALLEX_CLIENT_ID),
      "x-api-key": String(process.env.AIRWALLEX_API_KEY),
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  if (!res.ok) throw new Error(`Airwallex-Anmeldung HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j: any = await res.json();
  if (!j?.token) throw new Error("Airwallex-Anmeldung ohne Token");
  // Token gilt ~30 Minuten; wir erneuern nach 25.
  token = { wert: String(j.token), bis: Date.now() + 25 * 60 * 1000 };
  return token.wert;
}

async function awGet(pfad: string): Promise<any> {
  const t = await anmelden();
  const res = await fetch(`${basis()}${pfad}`, { headers: { Authorization: `Bearer ${t}` } });
  if (!res.ok) throw new Error(`Airwallex GET ${pfad.split("?")[0]} → HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

/** Das Global Account mit unserer IBAN finden (oder die gesetzte ID nehmen). */
async function globalAccountId(): Promise<string> {
  const fest = String(process.env.AIRWALLEX_GLOBAL_ACCOUNT_ID || "").trim();
  if (fest) return fest;
  const j = await awGet(`/api/v1/global_accounts?page_size=50`);
  const liste: any[] = Array.isArray(j?.items) ? j.items : [];
  const iban = BANK.iban.replace(/\s+/g, "").toUpperCase();
  const treffer = liste.find((g) => String(g?.iban || g?.account_number || "").replace(/\s+/g, "").toUpperCase() === iban)
    ?? liste.find((g) => String(g?.currency || "").toUpperCase() === "EUR");
  if (!treffer?.id) throw new Error(`Kein Global Account mit IBAN ${BANK.ibanDisplay} gefunden (${liste.length} Konten)`);
  return String(treffer.id);
}

type Eingang = { id: string; datum: string; cents: number; absender: string; zweck: string; status: string };

/** Ein Airwallex-Datensatz → unser Eingang. Tolerant bei Feldnamen; null, wenn unbrauchbar. */
function lesen(t: any): Eingang | null {
  const id = String(t?.id ?? t?.transaction_id ?? t?.request_id ?? "").trim();
  const betragRoh = t?.amount ?? t?.settled_amount ?? t?.net_amount ?? t?.transaction_amount;
  const cents = Math.round(Number(betragRoh) * 100);
  if (!id || !Number.isFinite(cents)) return null;
  const waehrung = String(t?.currency ?? t?.transaction_currency ?? "EUR").toUpperCase();
  if (waehrung !== "EUR") return null;
  const datum = String(t?.settled_at ?? t?.created_at ?? t?.transaction_date ?? t?.posted_at ?? "").slice(0, 10);
  const absender = String(
    t?.payer?.name ?? t?.payer_name ?? t?.counterparty?.name ?? t?.source?.name ?? t?.sender_name ?? t?.debtor_name ?? "",
  ).trim();
  const zweck = String(
    t?.remittance_information ?? t?.reference ?? t?.payment_reference ?? t?.description ?? t?.memo ?? t?.narrative ?? "",
  ).trim();
  const status = String(t?.status ?? "").toUpperCase();
  return { id, datum, cents, absender, zweck, status };
}

/** Gutschriften der letzten `tage` Tage — nur EUR, nur positive Beträge, nur abgeschlossene. */
async function gutschriften(tage: number): Promise<{ eingaenge: Eingang[]; gesehen: number }> {
  const konto = await globalAccountId();
  const ab = new Date(Date.now() - tage * 24 * 60 * 60 * 1000).toISOString();
  const alle: any[] = [];
  for (let seite = 0; seite < 20; seite++) {
    const j = await awGet(`/api/v1/global_accounts/${encodeURIComponent(konto)}/transactions?from_created_at=${encodeURIComponent(ab)}&page_num=${seite}&page_size=100`);
    const items: any[] = Array.isArray(j?.items) ? j.items : [];
    alle.push(...items);
    if (!j?.has_more || items.length === 0) break;
  }
  if (alle.length && !beispielGeloggt) {
    beispielGeloggt = true;
    console.log(`[AIRWALLEX] Beispiel-Datensatz (Schlüssel): ${Object.keys(alle[0]).join(", ")}`);
  }
  const eingaenge: Eingang[] = [];
  for (const t of alle) {
    const e = lesen(t);
    if (!e || e.cents <= 0) continue;
    // Abgeschlossene Gutschriften; unbekannte Statuswerte werden zugelassen, aber vermerkt.
    if (e.status && !/SETTLED|COMPLETED|SUCCE|CLEARED|POSTED/.test(e.status) && /PENDING|FAILED|CANCEL|REVERS|DECLIN/.test(e.status)) continue;
    eingaenge.push(e);
  }
  return { eingaenge, gesehen: alle.length };
}

/**
 * Der Einleser: Neues ins Bankbuch, Glasklares live buchen.
 * Idempotent über txn_id (AWX-…) — mehrfaches Lesen bucht nie doppelt.
 */
export async function airwallexEinlesen(tage = 3): Promise<{ gesehen: number; neu: number; gebucht: number }> {
  if (!konfiguriert()) throw new Error("AIRWALLEX_CLIENT_ID / AIRWALLEX_API_KEY fehlen");
  const { eingaenge, gesehen } = await gutschriften(tage);
  let neu = 0, gebucht = 0;
  for (const e of eingaenge) {
    const txnId = `AWX-${e.id}`;
    const ref = refErkennen(e.zweck);
    const basisRef = ref ? ref.replace(/-\d{1,2}$/, "") : null;
    const eingefuegt = await sqlPool`
      INSERT INTO fiaon_bank_txns (txn_id, booked_at, amount_cents, currency, payer_name, reference_raw, extracted_ref, matched_ref, match_status, amount_ok, applied, note)
      SELECT ${txnId}, ${e.datum || null}, ${e.cents}, 'EUR', ${e.absender}, ${e.zweck}, ${ref},
             ziel.ref,
             CASE WHEN ziel.ref IS NOT NULL THEN 'matched' ELSE 'unmatched' END,
             CASE WHEN ziel.ref IS NULL THEN NULL ELSE (ROUND(ziel.amount_due * 100) = ${e.cents}) END,
             false,
             ${`Airwallex-Automatik — zur Freischaltung vorgemerkt, noch NICHT gebucht${e.status ? ` (Status ${e.status})` : ""}`}
      FROM (SELECT ref, amount_due FROM (
              SELECT a.ref, a.amount_due FROM fiaon_applications a
              WHERE a.payment_reference = ${basisRef} AND a.merged_into IS NULL
              ORDER BY a.created_at DESC LIMIT 1
            ) t
            UNION ALL SELECT NULL, NULL WHERE NOT EXISTS (
              SELECT 1 FROM fiaon_applications a2
              WHERE a2.payment_reference = ${basisRef} AND a2.merged_into IS NULL)
           ) ziel
      WHERE NOT EXISTS (SELECT 1 FROM fiaon_bank_txns b WHERE b.txn_id = ${txnId})
      RETURNING id
    `;
    if (eingefuegt.length === 0) continue;
    neu += 1;
    console.log(`[AIRWALLEX] Neuer Eingang ${txnId}: ${(e.cents / 100).toFixed(2)} € von ${e.absender || "?"} (${ref || "ohne Referenz"})`);
    const erg = await liveVerbuchen(txnId, ref, e.cents, e.datum);
    if (erg.gebucht) gebucht += 1;
  }
  letzterLauf = { wann: new Date().toISOString(), gesehen, neu, gebucht, fehler: null };
  return { gesehen, neu, gebucht };
}

router.get("/admin/airwallex/status", async (_req: Request, res: Response) => {
  res.json({
    ok: true,
    konfiguriert: konfiguriert(),
    konto: BANK.ibanDisplay,
    globalAccountId: process.env.AIRWALLEX_GLOBAL_ACCOUNT_ID || null,
    letzterLauf,
    hinweis: konfiguriert() ? null : "Render-Umgebung: AIRWALLEX_CLIENT_ID und AIRWALLEX_API_KEY setzen (Airwallex → Entwickler → API-Schlüssel, Rechte: Global Accounts lesen).",
  });
});

router.post("/admin/airwallex/einlesen", async (req: Request, res: Response) => {
  try {
    const tage = Math.min(30, Math.max(1, Number(req.body?.tage) || 3));
    const erg = await airwallexEinlesen(tage);
    res.json({ ok: true, tage, ...erg });
  } catch (e: any) {
    letzterLauf = { wann: new Date().toISOString(), gesehen: 0, neu: 0, gebucht: 0, fehler: String(e?.message || e).slice(0, 300) };
    res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 300) });
  }
});

// Alle 30 Minuten von selbst — sobald die Schlüssel gesetzt sind. Ohne Schlüssel schweigt der Takt.
tageslauf("airwallex-eingaenge", () => {
  if (!konfiguriert()) return;
  airwallexEinlesen(3)
    .then((r) => { if (r.neu > 0) console.log(`[AIRWALLEX] Tageslauf: ${r.neu} neue Eingänge, ${r.gebucht} live gebucht`); })
    .catch((e) => {
      letzterLauf = { wann: new Date().toISOString(), gesehen: 0, neu: 0, gebucht: 0, fehler: String(e?.message || e).slice(0, 300) };
      console.error("[AIRWALLEX] Tageslauf:", e?.message || e);
    });
}, 30 * 60 * 1000, { beimStartNach: 120_000 });

export default router;
