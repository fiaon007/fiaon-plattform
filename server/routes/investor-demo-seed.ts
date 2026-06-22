// ============================================================================
// SCHWARZOTT GROUP — DEMO INVESTOR SEED
// ============================================================================
// Creates one fully-populated CIRCLE demo investor so the banking experience
// can be showcased end-to-end. Idempotent: only seeds when missing.
//   Login:  demo@schwarzott-capital.com  /  Demo2026!
// ============================================================================

import { client } from "../db";
import { logger } from "../logger";
import { ensureInvestorTables, hashInvestorPassword } from "./investor-auth";

export const DEMO_INVESTOR_EMAIL = "demo@schwarzott-capital.com";
export const DEMO_INVESTOR_PASSWORD = "Demo2026!";
const DEMO_INVESTOR_ID = "INV-DEMO0001";

const day = 24 * 60 * 60 * 1000;
const dISO = (offsetDays: number) => new Date(Date.now() + offsetDays * day).toISOString().slice(0, 10);
const tsISO = (offsetDays: number) => new Date(Date.now() + offsetDays * day).toISOString();

const ALL_BENEFITS = [
  "relationship", "consulting", "card", "flights", "insurance",
  "legal", "tax", "concierge", "realestate", "events",
];

export async function ensureDemoInvestor(): Promise<void> {
  try {
    await ensureInvestorTables();

    const [existing] = await client`
      SELECT id FROM investors WHERE LOWER(email) = ${DEMO_INVESTOR_EMAIL} LIMIT 1
    `;
    if (existing) {
      // Keep password + demo flag fresh, but do not wipe demo interactions.
      await client`
        UPDATE investors SET password_hash = ${hashInvestorPassword(DEMO_INVESTOR_PASSWORD)},
          is_demo = TRUE, tier = 'circle', status = 'active'
        WHERE id = ${existing.id}
      `;
      logger.info?.("[INVESTOR-DEMO] Demo investor present — credentials refreshed");
      return;
    }

    const id = DEMO_INVESTOR_ID;
    const passwordHash = hashInvestorPassword(DEMO_INVESTOR_PASSWORD);

    await client`
      INSERT INTO investors (
        id, email, password_hash, salutation, first_name, last_name, phone, company,
        investor_type, tier, status, street, zip, city, country, iban, tax_id, notes, is_demo
      ) VALUES (
        ${id}, ${DEMO_INVESTOR_EMAIL}, ${passwordHash}, 'Herr', 'Alexander', 'Demo',
        '+41 44 000 00 00', 'Demo Holding AG', 'private', 'circle', 'active',
        'Bahnhofstrasse 1', '8001', 'Zürich', 'Schweiz',
        'CH93 0076 2011 6238 5295 7', 'CHE-000.000.000', 'Demonstrationskonto — fiktive Daten.', TRUE
      )
    `;

    // ---- Investments (3 active + 1 matured) ----
    const investmentSeed = [
      { name: "Private Capital Investment – DEMO-2025-A", type: "loan", principal: 25_000_000, rate: 12.5, start: dISO(-360), maturity: dISO(365), status: "active", desc: "Nachrangdarlehen mit endfälliger Verzinsung." },
      { name: "Wachstumsbeteiligung – DEMO Equity II", type: "equity", principal: 15_000_000, rate: 18.0, start: dISO(-540), maturity: dISO(540), status: "active", desc: "Eigenkapitalbeteiligung an Portfoliogesellschaft." },
      { name: "Immobilien-Portfolio – DEMO Real Estate", type: "real_estate", principal: 50_000_000, rate: 7.5, start: dISO(-800), maturity: dISO(1000), status: "active", desc: "Diversifiziertes Bestandsportfolio in A-Lagen." },
      { name: "Festzins-Anleihe – DEMO 2022", type: "bond", principal: 10_000_000, rate: 5.0, start: dISO(-1200), maturity: dISO(-60), status: "matured", desc: "Endfällig zurückgeführt inkl. Zinsen." },
    ];

    const investmentIds: number[] = [];
    for (const inv of investmentSeed) {
      const [row] = await client`
        INSERT INTO investor_investments (
          investor_id, name, investment_type, principal_cents, current_value_cents,
          currency, interest_rate, status, start_date, maturity_date, payout_frequency, description
        ) VALUES (
          ${id}, ${inv.name}, ${inv.type}, ${inv.principal}, ${inv.principal},
          'EUR', ${inv.rate}, ${inv.status}, ${inv.start}, ${inv.maturity}, 'yearly', ${inv.desc}
        ) RETURNING id
      `;
      investmentIds.push(Number(row.id));
    }

    // ---- Transactions ----
    // Confirmed deposits for the 3 active investments (portfolio value is derived from these)
    const txSeed: Array<{ invIdx: number; type: string; amount: number; date: string; status: string; desc: string }> = [
      { invIdx: 0, type: "deposit", amount: 25_000_000, date: dISO(-360), status: "completed", desc: "Einzahlung Darlehenskapital" },
      { invIdx: 1, type: "deposit", amount: 15_000_000, date: dISO(-540), status: "completed", desc: "Einzahlung Beteiligungskapital" },
      { invIdx: 2, type: "deposit", amount: 50_000_000, date: dISO(-800), status: "completed", desc: "Einzahlung Immobilienportfolio" },
      // Interest / payouts (completed)
      { invIdx: 2, type: "interest", amount: 1_875_000, date: dISO(-440), status: "completed", desc: "Quartalsausschüttung Immobilien" },
      { invIdx: 0, type: "interest", amount: 1_562_500, date: dISO(-270), status: "completed", desc: "Zinsgutschrift Darlehen" },
      { invIdx: 2, type: "interest", amount: 1_875_000, date: dISO(-260), status: "completed", desc: "Quartalsausschüttung Immobilien" },
      { invIdx: 1, type: "interest", amount: 2_700_000, date: dISO(-175), status: "completed", desc: "Gewinnbeteiligung Equity II" },
      { invIdx: 2, type: "interest", amount: 1_875_000, date: dISO(-80), status: "completed", desc: "Quartalsausschüttung Immobilien" },
      // A small fee
      { invIdx: 0, type: "fee", amount: 45_000, date: dISO(-200), status: "completed", desc: "Verwaltungsgebühr" },
      // Upcoming / planned
      { invIdx: 0, type: "interest", amount: 1_562_500, date: dISO(95), status: "pending", desc: "Geplante Zinsgutschrift Darlehen" },
    ];
    for (const tx of txSeed) {
      await client`
        INSERT INTO investor_transactions (
          investor_id, investment_id, transaction_type, amount_cents, currency, description, transaction_date, status
        ) VALUES (
          ${id}, ${investmentIds[tx.invIdx]}, ${tx.type}, ${tx.amount}, 'EUR', ${tx.desc}, ${tx.date}, ${tx.status}
        )
      `;
    }

    // ---- Benefits (all active) ----
    for (const key of ALL_BENEFITS) {
      await client`
        INSERT INTO investor_benefits (investor_id, benefit_key, status, note)
        VALUES (${id}, ${key}, 'active', NULL)
        ON CONFLICT (investor_id, benefit_key) DO NOTHING
      `;
    }

    // ---- Card (active circle card) ----
    await client`
      INSERT INTO investor_card_orders (
        investor_id, cardholder_name, card_design, status, price_cents, is_free,
        shipping_street, shipping_zip, shipping_city, shipping_country
      ) VALUES (
        ${id}, 'ALEXANDER DEMO', 'circle', 'active', 0, TRUE,
        'Bahnhofstrasse 1', '8001', 'Zürich', 'Schweiz'
      )
    `;

    // ---- Benefit activity (history + upcoming) ----
    const activitySeed: Array<{ key: string; kind: string; title: string; details: string; status: string; scheduled: number }> = [
      // Flights
      { key: "flights", kind: "flight", title: "Zürich (ZRH) → London (LCY)", details: "Cessna Citation XLS · 1 Passagier · Hinflug", status: "completed", scheduled: -120 },
      { key: "flights", kind: "flight", title: "London (LCY) → Zürich (ZRH)", details: "Cessna Citation XLS · 1 Passagier · Rückflug", status: "completed", scheduled: -118 },
      { key: "flights", kind: "flight", title: "Zürich (ZRH) → Nizza (NCE)", details: "Phenom 300 · 3 Passagiere", status: "confirmed", scheduled: 14 },
      // Consulting
      { key: "consulting", kind: "consultation", title: "Strategie-Review Q1", details: "Portfolio-Allokation & Reinvestition", status: "completed", scheduled: -90 },
      { key: "consulting", kind: "consultation", title: "Nachfolgeplanung Holding", details: "Strukturierung Demo Holding AG", status: "completed", scheduled: -30 },
      // Tax
      { key: "tax", kind: "consultation", title: "Steueroptimierung 2025", details: "Vorbereitung Jahresabschluss", status: "completed", scheduled: -60 },
      // Legal
      { key: "legal", kind: "consultation", title: "Prüfung Beteiligungsvertrag", details: "Equity II – Vertragsreview", status: "completed", scheduled: -45 },
      // Concierge
      { key: "concierge", kind: "request", title: "Reservierung The Dolder Grand", details: "Dinner für 2 · 20:00 Uhr", status: "completed", scheduled: -20 },
      // Events
      { key: "events", kind: "invitation", title: "Circle Investoren-Dinner Zürich", details: "Baur au Lac · Dresscode: Black Tie", status: "confirmed", scheduled: 30 },
      // Real estate
      { key: "realestate", kind: "request", title: "Off-Market Objekt Zug", details: "Anfrage Exposé Penthouse", status: "requested", scheduled: -5 },
    ];
    for (const a of activitySeed) {
      await client`
        INSERT INTO investor_benefit_activity (investor_id, benefit_key, kind, title, details, status, scheduled_at)
        VALUES (${id}, ${a.key}, ${a.kind}, ${a.title}, ${a.details}, ${a.status}, ${tsISO(a.scheduled)})
      `;
    }

    // ---- A couple of downloadable demo documents ----
    const docSeed = [
      { title: "Darlehensvertrag DEMO-2025-A", type: "contract", invIdx: 0, body: "DEMONSTRATIONSDOKUMENT\n\nDarlehensvertrag DEMO-2025-A\nSchwarzott Capital Partners AG\n\nFiktive Daten zu Demonstrationszwecken." },
      { title: "Jahressteuerbescheinigung 2025", type: "tax", invIdx: null, body: "DEMONSTRATIONSDOKUMENT\n\nJahressteuerbescheinigung 2025\n\nFiktive Daten zu Demonstrationszwecken." },
      { title: "Quartalsbericht Immobilien Q4", type: "report", invIdx: 2, body: "DEMONSTRATIONSDOKUMENT\n\nQuartalsbericht Immobilien-Portfolio\n\nFiktive Daten zu Demonstrationszwecken." },
    ];
    for (const d of docSeed) {
      const buf = Buffer.from(d.body, "utf8");
      await client`
        INSERT INTO investor_documents (
          investor_id, investment_id, title, document_type, file_name, mime_type, file_size, file_data
        ) VALUES (
          ${id}, ${d.invIdx == null ? null : investmentIds[d.invIdx]}, ${d.title}, ${d.type},
          ${d.title.replace(/[^\w]+/g, "_") + ".txt"}, 'text/plain', ${buf.length}, ${buf}
        )
      `;
    }

    logger.info?.(`[INVESTOR-DEMO] Demo investor seeded — login ${DEMO_INVESTOR_EMAIL} / ${DEMO_INVESTOR_PASSWORD}`);
  } catch (err) {
    logger.error("[INVESTOR-DEMO] seed error", err);
  }
}
