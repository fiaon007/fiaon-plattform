import { Router } from "express";
import { client } from "../db";
import { adminZugriff } from "../lib/fiaon-admin-wache";

const router = Router();
// 06.09.2026: kein festes Kennwort mehr im Quelltext — siehe lib/fiaon-admin-wache.ts.
const requireAdminToken = adminZugriff;

// ─── Table setup ────────────────────────────────────────────────────────────
export async function ensureLedgerTables() {
  await client`
    CREATE TABLE IF NOT EXISTS accounting_config (
      id INT PRIMARY KEY DEFAULT 1,
      opening_balance_cents BIGINT NOT NULL DEFAULT 0,
      currency CHAR(3) NOT NULL DEFAULT 'CHF',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await client`
    CREATE TABLE IF NOT EXISTS accounting_ledger (
      id SERIAL PRIMARY KEY,
      booking_date DATE NOT NULL,
      value_date DATE NOT NULL,
      reference VARCHAR(80) NOT NULL,
      description TEXT NOT NULL,
      category VARCHAR(120) NOT NULL,
      booking_type VARCHAR(10) NOT NULL CHECK (booking_type IN ('credit','debit')),
      amount_cents BIGINT NOT NULL,
      currency CHAR(3) NOT NULL DEFAULT 'CHF',
      counter_account VARCHAR(200),
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  const [{ cnt }] = await client`SELECT COUNT(*)::int AS cnt FROM accounting_ledger`;
  if (cnt === 0) await seedLedger();
}

// ─── Deterministic seed ──────────────────────────────────────────────────────
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 4294967296; };
}

async function seedLedger() {
  const rand = rng(42);
  const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const between = (min: number, max: number) => Math.round(min + rand() * (max - min));

  const clientNames = ["Müller Family Office", "Stiftung Helvetica", "Kaiser & Söhne AG", "Weber Holding GmbH", "Baumann Trust AG", "Fischbach Capital", "Stern & Partner", "Rothkopf Vermögensverwaltung", "Albrecht Family Trust", "Berger AG Zürich"];
  const bankNames   = ["UBS AG Zürich", "Julius Bär", "Zürcher Kantonalbank", "BNP Paribas Zürich", "Pictet & Cie", "Vontobel AG"];
  const destinations = ["Dubai", "London", "Frankfurt", "Singapur", "Miami", "New York", "Abu Dhabi", "Genf", "Liechtenstein"];
  const legalFirms  = ["Schreiber & Partner", "Lenz & Staehelin", "Bär & Karrer", "Homburger AG", "Baker McKenzie Zürich"];
  const insurers    = ["Zurich Insurance Group", "Allianz Suisse", "Swiss Re", "Helvetia Versicherung"];
  const funds       = ["Schwarzott Global I", "Schwarzott Alpine II", "Schwarzott Real Estate III", "Schwarzott Tech Fund IV"];
  const extSvc      = ["McKinsey & Company", "Boston Consulting Group", "Accenture Schweiz", "Deloitte Zürich", "PwC Schweiz"];

  type RawEntry = { bookingDate: string; valueDate: string; reference: string; description: string; category: string; bookingType: "credit"|"debit"; amountCents: number; currency: "CHF"; };

  const creditGens: Array<() => { description: string; category: string; amountCents: number }> = [
    () => ({ description: `Managementgebühren – ${pick(clientNames)}`, category: "Managementgebühren", amountCents: between(5_000_000, 48_000_000) }),
    () => ({ description: `Beratungshonorar – ${pick(clientNames)}`, category: "Beratungshonorare", amountCents: between(1_500_000, 14_000_000) }),
    () => ({ description: `Zinserträge ${pick(bankNames)}`, category: "Zinserträge", amountCents: between(280_000, 4_500_000) }),
    () => ({ description: `Investmentrenditen – ${pick(funds)}`, category: "Investmentrenditen", amountCents: between(8_000_000, 80_000_000) }),
    () => ({ description: `Dividendenerträge Portfolio ${Math.floor(rand() * 5) + 1}`, category: "Dividendenerträge", amountCents: between(120_000, 3_200_000) }),
    () => ({ description: `Erfolgsgebühr – M&A Transaktion Q${Math.floor(rand() * 2) + 1}`, category: "Erfolgsgebühren", amountCents: between(3_000_000, 110_000_000) }),
    () => ({ description: `Provision Kapitalvermittlung – ${pick(clientNames)}`, category: "Provisionen", amountCents: between(800_000, 12_000_000) }),
    () => ({ description: `Rückzahlung Darlehen – ${pick(clientNames)}`, category: "Darlehensrückflüsse", amountCents: between(10_000_000, 90_000_000) }),
  ];

  const debitGens: Array<() => { description: string; category: string; amountCents: number }> = [
    () => ({ description: `Gehaltsauszahlung – ${Math.floor(rand() * 8) + 12} Mitarbeiter`, category: "Personalkosten", amountCents: between(14_000_000, 24_000_000) }),
    () => ({ description: `Büromiete Schifflände 26, 8001 Zürich`, category: "Miete & Infrastruktur", amountCents: 4_500_000 }),
    () => ({ description: `Rechtsberatung – ${pick(legalFirms)}`, category: "Rechtsberatung", amountCents: between(500_000, 8_500_000) }),
    () => ({ description: `Bankgebühren & Transaktionskosten – ${pick(bankNames)}`, category: "Bankgebühren", amountCents: between(50_000, 550_000) }),
    () => ({ description: `Reisekosten Investorenmeetings ${pick(destinations)}`, category: "Reise & Repräsentation", amountCents: between(180_000, 2_200_000) }),
    () => ({ description: `IT-Infrastruktur, Lizenzen & Cloud-Services`, category: "IT & Infrastruktur", amountCents: between(450_000, 3_500_000) }),
    () => ({ description: `Investorenausschüttung – ${pick(funds)}`, category: "Investorenausschüttungen", amountCents: between(15_000_000, 100_000_000) }),
    () => ({ description: `Steuervorauszahlung Kanton Zürich`, category: "Steuern & Abgaben", amountCents: between(5_000_000, 20_000_000) }),
    () => ({ description: `Versicherungsprämien – ${pick(insurers)}`, category: "Versicherungen", amountCents: between(800_000, 3_500_000) }),
    () => ({ description: `Externe Beratung – ${pick(extSvc)}`, category: "Externe Dienstleister", amountCents: between(500_000, 9_000_000) }),
    () => ({ description: `Repräsentationsaufwand & Events`, category: "Repräsentation", amountCents: between(200_000, 1_800_000) }),
  ];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rawEntries: RawEntry[] = [];
  let seq = 1;

  for (let dayAgo = 29; dayAgo >= 0; dayAgo--) {
    const date = new Date(today);
    date.setDate(today.getDate() - dayAgo);
    const dateStr = date.toISOString().split("T")[0];
    const numEntries = rand() > 0.45 ? 5 : 4;
    const numCredits = rand() > 0.55 ? 2 : 1;
    const numDebits  = numEntries - numCredits;

    for (let c = 0; c < numCredits; c++) {
      const gen = creditGens[Math.floor(rand() * creditGens.length)]();
      rawEntries.push({ bookingDate: dateStr, valueDate: dateStr, reference: `SGC-${dateStr.replace(/-/g,"")}-${String(seq++).padStart(4,"0")}`, ...gen, bookingType: "credit", currency: "CHF" });
    }
    for (let d = 0; d < numDebits; d++) {
      const gen = debitGens[Math.floor(rand() * debitGens.length)]();
      rawEntries.push({ bookingDate: dateStr, valueDate: dateStr, reference: `SGD-${dateStr.replace(/-/g,"")}-${String(seq++).padStart(4,"0")}`, ...gen, bookingType: "debit", currency: "CHF" });
    }
  }

  const TARGET_CENTS = 4_598_229_394; // 45,982,293.94 CHF
  const netCents = rawEntries.reduce((acc, e) => acc + (e.bookingType === "credit" ? e.amountCents : -e.amountCents), 0);
  const openingBalance = TARGET_CENTS - netCents;

  await client`INSERT INTO accounting_config (id, opening_balance_cents, currency) VALUES (1, ${openingBalance}, 'CHF') ON CONFLICT (id) DO UPDATE SET opening_balance_cents = EXCLUDED.opening_balance_cents`;

  for (const e of rawEntries) {
    await client`
      INSERT INTO accounting_ledger (booking_date, value_date, reference, description, category, booking_type, amount_cents, currency)
      VALUES (${e.bookingDate}, ${e.valueDate}, ${e.reference}, ${e.description}, ${e.category}, ${e.bookingType}, ${e.amountCents}, ${e.currency})
    `;
  }
}

// ─── Routes ─────────────────────────────────────────────────────────────────

// GET all entries + opening balance
router.get("/", requireAdminToken, async (_req, res) => {
  try {
    const [configRow] = await client`SELECT opening_balance_cents, currency FROM accounting_config WHERE id = 1`;
    const entries = await client`SELECT * FROM accounting_ledger ORDER BY booking_date ASC, id ASC`;
    res.json({ ok: true, openingBalanceCents: Number(configRow?.opening_balance_cents ?? 0), currency: configRow?.currency ?? "CHF", entries: entries.map(e => ({ ...e, amount_cents: Number(e.amount_cents) })) });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST add entry
router.post("/", requireAdminToken, async (req, res) => {
  try {
    const { bookingDate, valueDate, reference, description, category, bookingType, amountCents, counterAccount, notes } = req.body;
    if (!bookingDate || !description || !category || !["credit","debit"].includes(bookingType) || !amountCents) return res.status(400).json({ ok: false, error: "Pflichtfelder fehlen" });
    const [row] = await client`
      INSERT INTO accounting_ledger (booking_date, value_date, reference, description, category, booking_type, amount_cents, counter_account, notes)
      VALUES (${bookingDate}, ${valueDate || bookingDate}, ${reference || `SG-${Date.now()}`}, ${description}, ${category}, ${bookingType}, ${Math.abs(amountCents)}, ${counterAccount || null}, ${notes || null})
      RETURNING *
    `;
    res.json({ ok: true, entry: { ...row, amount_cents: Number(row.amount_cents) } });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// DELETE entry
router.delete("/:id", requireAdminToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await client`DELETE FROM accounting_ledger WHERE id = ${id}`;
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PATCH update opening balance (admin utility)
router.patch("/config", requireAdminToken, async (req, res) => {
  try {
    const { openingBalanceCents } = req.body;
    await client`UPDATE accounting_config SET opening_balance_cents = ${openingBalanceCents}, updated_at = NOW() WHERE id = 1`;
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
