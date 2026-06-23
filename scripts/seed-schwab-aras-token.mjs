import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
const investorId = 'INV-6F8FFA7424';

// Idempotent: remove any existing ARAS Token investment for Schwab
await sql`
  DELETE FROM investor_investments
  WHERE investor_id = ${investorId}
    AND investment_type = 'token'
`;

// Laut Addendum Nr. 2: Investition EUR 50.000, Zuteilungspreis EUR 0,12/Token
// Basiszuteilung: 416.666 + Kampagnenbonus 15%: 62.499 + Zusatzbonus 6%: 24.999 = 504.164 ARAS
const tokenQty      = 504164; // Gesamt-Token inkl. aller Boni
const buyPriceCents = 12;     // EUR 0,12 pro Token (Zuteilungspreis lt. Vertrag)
const curPriceCents = 12;     // Aktueller Kurs – Admin kann diesen per UI aktualisieren

// principal_cents = tatsächlich eingezahltes Kapital (EUR 50.000)
// current_value_cents = Tokenwert zum aktuellen Kurs (504.164 × EUR 0,12)
const principalCents    = 5_000_000;                        // EUR 50.000,00
const currentValueCents = Math.round(tokenQty * curPriceCents); // EUR 60.499,68

await sql`
  INSERT INTO investor_investments (
    investor_id, name, investment_type,
    principal_cents, current_value_cents, currency,
    interest_rate, status, start_date, maturity_date,
    payout_frequency, description,
    token_quantity, token_purchase_price_cents, token_current_price_cents,
    created_at, updated_at
  ) VALUES (
    ${investorId},
    'ARAS Token',
    'token',
    ${principalCents},
    ${currentValueCents},
    'EUR',
    NULL,
    'active',
    '2025-12-15',
    NULL,
    'yearly',
    'Private Sale Agreement – Addendum Nr. 2 · 504.164 ARAS Token (inkl. 15 % Campaign Bonus + 6 % Zusatzbonus) · ERC-20 auf Arbitrum One · Unterzeichnet 15.12.2025 · Dokument-Referenz: O3GU8-SKXPJ-QXGYX-UVXM8',
    ${tokenQty},
    ${buyPriceCents},
    ${curPriceCents},
    NOW(), NOW()
  )
`;

console.log(`✅ ARAS Token Investment für Herr Schwab eingetragen:`);
console.log(`   Token: ${tokenQty.toLocaleString('de-DE')} ARAS`);
console.log(`   Einkaufskurs: EUR ${(buyPriceCents/100).toFixed(2)}/Token`);
console.log(`   Einkaufswert: EUR ${(principalCents/100).toLocaleString('de-DE', {minimumFractionDigits:2})}`);

await sql.end();
