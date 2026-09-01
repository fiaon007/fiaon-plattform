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
// WAS DIE AUTOMATIK TUT — UND WAS BEWUSST NICHT:
//   · Sie liest alle 30 Minuten die Gutschriften der letzten Tage und trägt
//     NEUE ins Bankbuch (fiaon_bank_txns) ein, mit Referenz-Erkennung und
//     Antrags-Zuordnung als VORSCHLAG (match_status).
//   · Sie bucht NICHTS: kein mark-paid, keine Rate, keine Mail, keine
//     Provision. Freischalten bleibt eine menschliche Entscheidung — dieselbe
//     Vier-Augen-Linie wie beim Kontoabgleich (der bewusst AUS ist).
//   · Der Webhook (/api/fiaon/wise/webhook) ist nur ein WECKER: Wise meldet
//     „Geld ist da", wir stoßen den Einleser an. Dem Webhook-Inhalt wird
//     NICHT vertraut — die Wahrheit holt sich der signierte Auszug selbst.
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Request, type Response } from "express";
import { createSign } from "crypto";
import { sqlPool } from "../lib/db-pool";
import { tageslauf } from "../lib/fiaon-crons";

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
async function wiseGetMitSca(pfad: string): Promise<globalThis.Response> {
  const erste = await wiseGet(pfad);
  if (erste.status !== 403) return erste;
  const ott = erste.headers.get("x-2fa-approval");
  const key = scaSchluessel();
  if (!ott || !key) return erste;
  const signatur = createSign("RSA-SHA256").update(ott).sign(key, "base64");
  return wiseGet(pfad, { "x-2fa-approval": ott, "X-Signature": signatur });
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
function refErkennen(text: string): string | null {
  const t = String(text || "");
  // „FIAON-XXXXXX", „Fiaon XXXXXX", auch mit Raten-Anhang „-2"; Tippfehler wie
  // „Fiacon" fängt die Automatik bewusst NICHT — die bleiben Handarbeit.
  const m = t.match(/FIAON[\s-]*([A-Z0-9]{6})(-\d{1,2})?/i);
  if (!m) return null;
  return `FIAON-${m[1].toUpperCase()}${m[2] || ""}`;
}

let letzterLauf: { wann: string; neu: number; gesehen: number; fehler: string | null } | null = null;

/**
 * Der Einleser: Gutschriften der letzten Tage holen, Neues ins Bankbuch.
 * Rückgabe: wie viele Gutschriften gesehen, wie viele neu eingetragen.
 */
export async function wiseEinlesen(tage = 5): Promise<{ gesehen: number; neu: number }> {
  const { profilId: pid, balanceId: bid } = await verbindungFinden();
  const bis = new Date();
  const von = new Date(bis.getTime() - tage * 24 * 60 * 60 * 1000);
  const pfad = `/v1/profiles/${pid}/balance-statements/${bid}/statement.json` +
    `?currency=EUR&intervalStart=${von.toISOString()}&intervalEnd=${bis.toISOString()}&type=COMPACT`;
  const res = await wiseGetMitSca(pfad);
  if (res.status === 403) {
    throw new Error(scaSchluessel()
      ? "SCA abgelehnt — ist der öffentliche Schlüssel im Wise-Konto hinterlegt (Einstellungen → API-Tokens → Public Keys)?"
      : "SCA nötig, aber WISE_SCA_PRIVATE_KEY ist nicht gesetzt.");
  }
  if (!res.ok) throw new Error(`Auszug: HTTP ${res.status} ${await res.text().then((t) => t.slice(0, 200))}`);
  const auszug = (await res.json()) as any;
  const gutschriften = ((auszug.transactions || []) as any[]).filter(
    (t) => t.type === "CREDIT" && String(t.details?.type || "").toUpperCase() === "DEPOSIT" && t.referenceNumber,
  );

  let neu = 0;
  for (const g of gutschriften) {
    const zweck = String(g.details?.paymentReference || g.details?.description || "");
    const ref = refErkennen(zweck);
    const eingefuegt = await sqlPool`
      INSERT INTO fiaon_bank_txns (txn_id, booked_at, amount_cents, currency, payer_name, reference_raw, extracted_ref, matched_ref, match_status, applied, note)
      SELECT ${g.referenceNumber}, ${g.date}, ${Math.round(Number(g.amount?.value || 0) * 100)}, 'EUR',
             ${String(g.details?.senderName || "")}, ${zweck}, ${ref},
             (SELECT a.ref FROM fiaon_applications a
              WHERE a.payment_reference = ${ref ? ref.replace(/-\d{1,2}$/, "") : null} AND a.merged_into IS NULL
              ORDER BY a.created_at DESC LIMIT 1),
             ${ref ? "matched" : "neu"}, false,
             'Wise-Automatik — zur Freischaltung vorgemerkt, noch NICHT gebucht'
      WHERE NOT EXISTS (SELECT 1 FROM fiaon_bank_txns b WHERE b.txn_id = ${g.referenceNumber})
      RETURNING id
    `;
    if (eingefuegt.length > 0) {
      neu += 1;
      console.log(`[WISE] Neuer Eingang ${g.referenceNumber}: ${g.amount?.value} € von ${g.details?.senderName || "?"} (${ref || "ohne Referenz"})`);
    }
  }
  letzterLauf = { wann: new Date().toISOString(), neu, gesehen: gutschriften.length, fehler: null };
  return { gesehen: gutschriften.length, neu };
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
      stand.auszug = `ok — ${probe.gesehen} Gutschriften in 24 h, ${probe.neu} neu eingetragen`;
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
tageslauf("wise-auszug", () => {
  wiseEinlesen(5)
    .then((r) => { if (r.neu > 0) console.log(`[WISE] Tageslauf: ${r.neu} neue Eingänge im Bankbuch`); })
    .catch((e) => console.error("[WISE] Tageslauf:", e?.message || e));
}, 30 * 60 * 1000, { beimStartNach: 90_000 });

export default router;
