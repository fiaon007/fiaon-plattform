import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
const investorId = 'INV-6F8FFA7424';

// Idempotent: remove any existing ARAS Token investment for Schwab
await sql`
  DELETE FROM investor_investments
  WHERE investor_id = ${investorId}
    AND investment_type = 'token'
`;

// Values from ADDENDUM NR. 2 – Private Sale Agreement ARAS Token
// Signed: 15. Dezember 2025 · Zürich
// Total tokens: 504,164 ARAS (base 416,666 + 15% campaign bonus 62,499 + 6% additional bonus 24,999)
// Purchase price: EUR 0.12/token → 12 cents
// Current price (admin can update via UI): EUR 0.12/token → 12 cents (break-even at time of seeding)
const tokenQty     = 504164;
const buyPriceCents = 12;   // EUR 0.12 per token → 12 cents
const curPriceCents = 12;   // admin updates this via the investment form to reflect live price

const principalCents    = Math.round(tokenQty * buyPriceCents); // 6,049,968 → ≈ EUR 60,499.68
const currentValueCents = Math.round(tokenQty * curPriceCents);

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
