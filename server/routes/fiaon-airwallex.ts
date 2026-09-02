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

/**
 * Das Global Account mit unserer IBAN finden (oder die gesetzte ID nehmen).
 *
 * Der frühere Rückfall „nimm das Konto mit currency === EUR" ist ersatzlos
 * gestrichen: Am echten Datensatz gemessen steht auf oberster Ebene des
 * Global-Account-Objekts GAR KEINE Währung (`currency` ist undefined bei
 * beiden Konten) — die Zeile hätte nie gegriffen und im Zweifel das falsche,
 * nämlich das britische Konto gewählt. Der IBAN-Vergleich trifft; darunter
 * bleibt nur noch ein ehrlicher Fehler.
 */
async function globalAccountId(): Promise<string> {
  const fest = String(process.env.AIRWALLEX_GLOBAL_ACCOUNT_ID || "").trim();
  if (fest) return fest;
  const j = await awGet(`/api/v1/global_accounts?page_size=50`);
  const liste: any[] = Array.isArray(j?.items) ? j.items : [];
  const iban = BANK.iban.replace(/\s+/g, "").toUpperCase();
  const treffer = liste.find((g) => String(g?.iban || g?.account_number || "").replace(/\s+/g, "").toUpperCase() === iban);
  if (!treffer?.id) throw new Error(`Kein Global Account mit IBAN ${BANK.ibanDisplay} gefunden (${liste.length} Konten) — AIRWALLEX_GLOBAL_ACCOUNT_ID setzen`);
  return String(treffer.id);
}

type Eingang = { id: string; datum: string; cents: number; absender: string; zweck: string; status: string; art: string; schwebt: boolean };

/**
 * Ein Airwallex-Datensatz → unser Eingang. Tolerant bei Feldnamen; null, wenn unbrauchbar.
 *
 * ── AM ECHTEN DATENSATZ NACHGEZOGEN (02.09.2026) ──────────────────────────
 * Die Feldnamen waren nach der Dokumentation geraten, weil die API wegen der
 * fehlenden IP-Freigabe nicht erreichbar war. Der erste echte Datensatz hat
 * zwei davon widerlegt:
 *   { amount, create_time, currency, description, id, payer_country,
 *     payer_name, status, type }
 * 1. Das Datum heißt `create_time` — keiner der geratenen Namen traf. Folge:
 *    `datum` blieb leer, und `liveVerbuchen` steigt bei leerem Datum in der
 *    ersten Zeile aus. Der Einleser hätte brav ins Bankbuch geschrieben und
 *    NIE eine einzige Zahlung automatisch gebucht — die Automatik wäre
 *    stillschweigend wirkungslos gewesen.
 * 2. Es gibt ein Feld `type` mit CREDIT/DEBIT. Ohne Auswertung hinge die
 *    Unterscheidung Eingang/Ausgang allein am Vorzeichen von `amount` — und
 *    ob Airwallex Abbuchungen negativ liefert, ist ungeprüft. Eine als
 *    Eingang gebuchte Abbuchung würde einen Kunden freischalten, der nichts
 *    bezahlt hat. Deshalb: nur ausdrückliche CREDIT-Zeilen.
 */
function lesen(t: any): Eingang | null {
  const id = String(t?.id ?? t?.transaction_id ?? t?.request_id ?? "").trim();
  const betragRoh = t?.amount ?? t?.settled_amount ?? t?.net_amount ?? t?.transaction_amount;
  const cents = Math.round(Number(betragRoh) * 100);
  if (!id || !Number.isFinite(cents)) return null;
  const waehrung = String(t?.currency ?? t?.transaction_currency ?? "EUR").toUpperCase();
  if (waehrung !== "EUR") return null;
  const datum = String(
    t?.created_at ?? t?.create_time ?? t?.settled_at ?? t?.transaction_date ?? t?.posted_at ?? "",
  ).slice(0, 10);
  const absender = String(
    t?.payer?.name ?? t?.payer_name ?? t?.counterparty?.name ?? t?.source?.name ?? t?.sender_name ?? t?.debtor_name ?? "",
  ).trim();
  // Bei /deposits ist `reference` die Bankreferenz des Absenders — also genau
  // das, was der Kunde in den Verwendungszweck geschrieben hat. Sie steht
  // deshalb vorn; `description` (das Feld von /transactions) bleibt dahinter.
  const zweck = String(
    t?.reference ?? t?.description ?? t?.remittance_information ?? t?.payment_reference ?? t?.memo ?? t?.narrative ?? "",
  ).trim();
  const status = String(t?.status ?? "").toUpperCase();
  const art = String(t?.type ?? t?.transaction_type ?? "").toUpperCase();
  // Gebucht wird NUR bei ausdrücklich abgeschlossenem Status. Alles andere —
  // auch ein unbekannter Wert — gilt als schwebend: Es wird sichtbar gemacht,
  // aber nie gebucht. Vorher war die Prüfung andersherum und ließ jeden
  // unbekannten Status durch; ein neuer Statuswert von Airwallex hätte damit
  // Geld gebucht, das noch gar nicht da ist.
  const schwebt = !/^(SETTLED|COMPLETED|SUCCEEDED|SUCCESS|CLEARED|POSTED)$/.test(status);
  return { id, datum, cents, absender, zweck, status, art, schwebt };
}

/**
 * Der Abruf reicht höchstens so weit zurück. Gemessen am 02.09.2026: Anfragen
 * bis 30 Tage liefern die Bewegung, ab 60 Tagen kommt eine LEERE Liste — kein
 * Fehler, keine Warnung, einfach nichts. Wer weiter zurückfragt, bekommt also
 * „keine Eingänge" statt „Zeitraum zu groß" und hält das Konto für leer.
 * Darum wird hier hart gedeckelt statt der Grenze zu vertrauen.
 */
const MAX_RUECKSCHAU_TAGE = 30;

/**
 * Gutschriften der letzten `tage` Tage.
 *
 * ── WARUM /deposits UND NICHT /global_accounts/{id}/transactions ──────────
 * Am 02.09.2026 direkt verglichen, gleicher Zeitraum, gleiches Konto:
 *   /transactions →  1 Datensatz,  Verwendungszweck im Feld `description`
 *   /deposits     →  4 Datensätze, Verwendungszweck im Feld `reference`
 * `/deposits` zeigt zusätzlich die noch schwebenden Eingänge (PENDING) und
 * nennt den Absender vollständig unter `payer.name`. Genau die schwebenden
 * sind wertvoll: Solange wir sie sehen, mahnen wir niemanden, dessen Geld
 * schon unterwegs ist. Außerdem stehen auf /deposits per Definition nur
 * Eingänge — die Richtungsfrage (Gutschrift oder Abbuchung?) stellt sich gar
 * nicht erst. Die `id` ist bei beiden Endpunkten DIESELBE, ein Wechsel kann
 * also nichts doppelt anlegen.
 */
async function gutschriften(tage: number): Promise<{ eingaenge: Eingang[]; gesehen: number; gedeckelt: boolean }> {
  const konto = await globalAccountId();
  const gedeckelt = tage > MAX_RUECKSCHAU_TAGE;
  const wirklich = Math.min(tage, MAX_RUECKSCHAU_TAGE);
  const ab = new Date(Date.now() - wirklich * 24 * 60 * 60 * 1000).toISOString();
  const alle: any[] = [];
  for (let seite = 0; seite < 20; seite++) {
    const j = await awGet(`/api/v1/deposits?from_created_at=${encodeURIComponent(ab)}&page_num=${seite}&page_size=100`);
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
    // Die API kennt keinen Kontofilter — also hier, sonst zöge das britische
    // Konto seine Eingänge in unser Bankbuch.
    const kontoDesEingangs = String(t?.global_account_id || "").trim();
    if (kontoDesEingangs && kontoDesEingangs !== konto) continue;
    const e = lesen(t);
    if (!e || e.cents <= 0) continue;
    // Steht eine Art dabei, muss sie eine Gutschrift sein. Auf /deposits ist
    // das immer der Fall (BANK_TRANSFER u.ä.); die Prüfung bleibt für den Tag,
    // an dem jemand den Endpunkt zurückdreht.
    if (e.art === "DEBIT") continue;
    // Ohne Datum bucht liveVerbuchen grundsätzlich nicht — dann lieber laut sein,
    // als die Zeile stumm im Bankbuch versanden zu lassen.
    if (!e.datum) console.warn(`[AIRWALLEX] Eingang ${e.id} ohne lesbares Datum — bleibt Handarbeit. Felder prüfen.`);
    eingaenge.push(e);
  }
  return { eingaenge, gesehen: alle.length, gedeckelt };
}

/**
 * Der Einleser: Neues ins Bankbuch, Glasklares live buchen.
 * Idempotent über txn_id (AWX-…) — mehrfaches Lesen bucht nie doppelt.
 */
/**
 * Woran eine schwebende Zeile erkennbar ist. Nur dieser Lauf schreibt diesen
 * Satzanfang; sobald ein Mensch oder `liveVerbuchen` die Zeile anfasst, steht
 * dort etwas anderes. Damit zieht die Nachreichung unten ausschließlich das
 * nach, was der Automat selbst als „noch unterwegs" abgelegt hat — und rührt
 * keine Zeile an, die jemand bewusst von Hand anders zugeordnet hat.
 */
const SCHWEBE_VERMERK = "Airwallex: Geld ist UNTERWEGS";

export async function airwallexEinlesen(tage = 3): Promise<{ gesehen: number; neu: number; gebucht: number; schwebend: number; nachgezogen: number; gedeckelt: boolean }> {
  if (!konfiguriert()) throw new Error("AIRWALLEX_CLIENT_ID / AIRWALLEX_API_KEY fehlen");
  const { eingaenge, gesehen, gedeckelt } = await gutschriften(tage);
  let neu = 0, gebucht = 0, schwebend = 0, nachgezogen = 0;
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
             ${e.schwebt
               ? `${SCHWEBE_VERMERK}, noch nicht gutgeschrieben (Status ${e.status || "unbekannt"}) — nicht buchen, aber auch nicht mahnen.`
               : `Airwallex-Automatik — zur Freischaltung vorgemerkt, noch NICHT gebucht${e.status ? ` (Status ${e.status})` : ""}`}
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
    if (eingefuegt.length === 0) {
      // Die Zeile kennen wir schon. Ein Fall bleibt trotzdem offen: Sie wurde
      // angelegt, als das Geld noch unterwegs war, und ist inzwischen
      // gutgeschrieben. Ohne diese Nachreichung bliebe genau dieses Geld für
      // immer ungebucht — der Doppelschutz über txn_id würde es jedes Mal
      // wortlos überspringen.
      if (!e.schwebt) {
        const [alt] = (await sqlPool`
          SELECT applied, note FROM fiaon_bank_txns WHERE txn_id = ${txnId} LIMIT 1
        `) as any[];
        if (alt && !alt.applied && String(alt.note || "").startsWith(SCHWEBE_VERMERK)) {
          const erg = await liveVerbuchen(txnId, ref, e.cents, e.datum);
          if (erg.gebucht) { gebucht += 1; nachgezogen += 1; }
          console.log(`[AIRWALLEX] Nachgereicht ${txnId}: war unterwegs, ist jetzt da — ${erg.gebucht ? "gebucht" : erg.grund}`);
        }
      }
      continue;
    }
    neu += 1;
    console.log(`[AIRWALLEX] Neuer Eingang ${txnId}: ${(e.cents / 100).toFixed(2)} € von ${e.absender || "?"} (${ref || "ohne Referenz"})${e.schwebt ? ` — schwebt noch (${e.status})` : ""}`);
    // Schwebendes Geld wird NIE gebucht: Es ist angekündigt, nicht angekommen.
    // Es steht trotzdem im Bankbuch, damit niemand gemahnt wird, dessen
    // Überweisung schon unterwegs ist. Sobald Airwallex den Eingang auf
    // abgeschlossen dreht, holt ihn der nächste Lauf — dieselbe id, aber der
    // Doppelschutz greift über txn_id, also braucht es dafür einen eigenen
    // Weg: die Nachreichung (siehe schwebendeNachziehen).
    if (e.schwebt) { schwebend += 1; continue; }
    const erg = await liveVerbuchen(txnId, ref, e.cents, e.datum);
    if (erg.gebucht) gebucht += 1;
  }
  letzterLauf = { wann: new Date().toISOString(), gesehen, neu, gebucht, fehler: null };
  return { gesehen, neu, gebucht, schwebend, nachgezogen, gedeckelt };
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

/**
 * GET /admin/airwallex/konto — alles, was ein Mensch über das Geschäftskonto
 * wissen will, auf einer Antwort.
 *
 * JUSTIN am 03.09.2026: „Airwallex ist ja jetzt verbunden — wo sehen wir nun
 * unser Konto? Wo ist die Seite mit den Zahlungen, Funktionen und sowas?"
 *
 * Es gab keine. Die Eingänge landeten im Bankbuch und waren dort richtig, aber
 * niemand konnte sehen, ob überhaupt abgerufen wird, wann zuletzt, und was
 * seitdem hereinkam. Ein Konto, dessen Stand man nicht sieht, ist kein Konto,
 * dem man vertraut.
 */
router.get("/admin/airwallex/konto", async (req: Request, res: Response) => {
  try {
    const tage = Math.min(60, Math.max(1, Number(req.query?.tage) || 14));
    const { sqlPool } = await import("../lib/db-pool");

    const zeilen = (await sqlPool`
      SELECT id, txn_id, booked_at, amount_cents, currency, payer_name,
             reference_raw, extracted_ref, matched_ref, applied, applied_at,
             match_status, note, amount_ok
        FROM fiaon_bank_txns
       WHERE booked_at > NOW() - (${tage} || ' days')::interval
       ORDER BY booked_at DESC NULLS LAST, id DESC
       LIMIT 300
    `) as any[];

    // Was davon ist wirklich offen? Eine Zeile ohne Haken ist NICHT gleich
    // liegengebliebenes Geld — meist ist der Antrag längst bezahlt und nur die
    // Kennzeichnung fehlt (gemessen am 03.09.: 34 von 37 genau so).
    const offen = (await sqlPool`
      SELECT t.id, t.txn_id, t.booked_at, t.amount_cents, t.payer_name,
             t.reference_raw, t.extracted_ref, a.payment_status, a.ref AS antrag
        FROM fiaon_bank_txns t
        LEFT JOIN fiaon_applications a
               ON a.payment_reference = t.extracted_ref AND a.merged_into IS NULL
       WHERE NOT t.applied
         AND t.booked_at > NOW() - INTERVAL '60 days'
         AND (a.ref IS NULL OR a.payment_status NOT IN ('paid', 'superseded'))
       ORDER BY t.booked_at DESC NULLS LAST
       LIMIT 50
    `) as any[];

    const summe = (r: any[]) => r.reduce((s, z) => s + Number(z.amount_cents || 0), 0);
    const schwebend = zeilen.filter((z) => String(z.note || "").includes("UNTERWEGS"));

    res.json({
      ok: true,
      konfiguriert: konfiguriert(),
      konto: BANK.ibanDisplay,
      empfaenger: BANK.empfaenger,
      bic: BANK.bic,
      letzterLauf,
      tage,
      eingaenge: {
        anzahl: zeilen.length,
        summeCents: summe(zeilen),
        gebucht: zeilen.filter((z) => z.applied).length,
        gebuchtCents: summe(zeilen.filter((z) => z.applied)),
        schwebend: schwebend.length,
        schwebendCents: summe(schwebend),
      },
      // Nur das, was wirklich noch niemandem zugeordnet ist.
      wirklichOffen: {
        anzahl: offen.length,
        summeCents: summe(offen),
        zeilen: offen.slice(0, 25).map((z) => ({
          id: z.id, txnId: z.txn_id, am: z.booked_at,
          betrag: (Number(z.amount_cents || 0) / 100).toFixed(2),
          zahler: z.payer_name ?? null,
          zweck: String(z.reference_raw ?? "").slice(0, 120),
          erkannteReferenz: z.extracted_ref ?? null,
          antragStatus: z.payment_status ?? null,
        })),
      },
      liste: zeilen.slice(0, 60).map((z) => ({
        id: z.id, txnId: z.txn_id, am: z.booked_at,
        betrag: (Number(z.amount_cents || 0) / 100).toFixed(2),
        waehrung: z.currency ?? "EUR",
        zahler: z.payer_name ?? null,
        zweck: String(z.reference_raw ?? "").slice(0, 140),
        referenz: z.matched_ref ?? z.extracted_ref ?? null,
        gebucht: !!z.applied,
        schwebend: String(z.note || "").includes("UNTERWEGS"),
        betragPasst: z.amount_ok,
        vermerk: z.note ?? null,
      })),
    });
  } catch (e: any) {
    console.error("[AIRWALLEX] konto:", e);
    res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 300) });
  }
});

router.post("/admin/airwallex/einlesen", async (req: Request, res: Response) => {
  try {
    const tage = Math.min(MAX_RUECKSCHAU_TAGE, Math.max(1, Number(req.body?.tage) || 3));
    const erg = await airwallexEinlesen(tage);
    res.json({ ok: true, tage, maxTage: MAX_RUECKSCHAU_TAGE, quelle: "/api/v1/deposits", ...erg });
  } catch (e: any) {
    letzterLauf = { wann: new Date().toISOString(), gesehen: 0, neu: 0, gebucht: 0, fehler: String(e?.message || e).slice(0, 300) };
    res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 300) });
  }
});

// ── DER TAKT MUSS AUF SEINE ARBEIT WARTEN (02.09.2026) ─────────────────────
// Vorher wurde hier eine Hülle übergeben, die die Arbeit nur ANSTIESS und
// sofort zurückkam. Folge: `laufMitHistorie` maß 0 ms, schrieb „erfolg" und
// hat einen Fehler nie gesehen. In der Laufhistorie standen am 02.09. sechs
// Läufe als „erfolg | 0 ms" — für eine Automatik, die mangels Schlüssel noch
// nie einen Cent gelesen hatte. Genau die Überwachung, die den Ausfall melden
// soll, meldete Erfolg. Zweiter Schaden derselben Ursache: Die Sperre gegen
// gleichzeitige Läufe greift über das Alter der Zeile — dreht die sofort auf
// „erfolg", schützt sie nichts mehr. Sobald ein Webhook dazukommt, läsen
// Wecker und Takt gleichzeitig.
// Jetzt wird die Arbeit erwartet: Dauer stimmt, Fehler schlägt durch, Sperre hält.
tageslauf("airwallex-eingaenge", async () => {
  if (!konfiguriert()) return;
  try {
    const r = await airwallexEinlesen(3);
    if (r.neu > 0 || r.nachgezogen > 0) {
      console.log(`[AIRWALLEX] Takt: ${r.neu} neu, ${r.gebucht} gebucht, ${r.schwebend} unterwegs, ${r.nachgezogen} nachgereicht`);
    }
  } catch (e: any) {
    letzterLauf = { wann: new Date().toISOString(), gesehen: 0, neu: 0, gebucht: 0, fehler: String(e?.message || e).slice(0, 300) };
    throw e; // Muss durchschlagen, sonst schreibt die Historie wieder „erfolg".
  }
}, 30 * 60 * 1000, { beimStartNach: 120_000 });

export default router;
