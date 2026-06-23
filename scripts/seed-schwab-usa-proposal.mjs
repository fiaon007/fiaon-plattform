import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
const investorId = 'INV-6F8FFA7424';

// Idempotent: remove a previous proposal of the same trip if present
await sql`
  DELETE FROM investor_benefit_activity
  WHERE investor_id = ${investorId}
    AND benefit_key = 'flights'
    AND status = 'proposed'
    AND title LIKE 'USA-Reise%'
`;

await sql`
  INSERT INTO investor_benefit_activity
    (investor_id, benefit_key, kind, title, details, status, scheduled_at, created_at, updated_at)
  VALUES (
    ${investorId},
    'flights',
    'booking',
    'USA-Reise: Hinflug HAM → LAX & Rückflug LAS → HAM',
    'Hinflug: Fr. 31.07.2026 · Hamburg (HAM) ➔ Los Angeles (LAX)' || chr(10) ||
    'Rückflug: Mi. 26.08.2026 · Las Vegas (LAS) ➔ Hamburg (HAM)' || chr(10) ||
    'Airline: Lufthansa Group / Star Alliance · Senator-Status berücksichtigt' || chr(10) ||
    'Miles & More ID: 2220 1392 4048 007' || chr(10) ||
    chr(10) ||
    'Hotel Los Angeles: Hotel Bel-Air (Zimmer mit Balkon/Terrasse)' || chr(10) ||
    'Hotel Las Vegas: The Cosmopolitan of Las Vegas (direkt am Strip)' || chr(10) ||
    'Transfer: Airport-Shuttle-Service bei Ankunft',
    'proposed',
    '2026-07-31T00:00:00+02:00',
    NOW(), NOW()
  )
`;
console.log('✅ USA-Reise-Vorschlag (proposed) für Herr Schwab eingetragen');

await sql.end();
