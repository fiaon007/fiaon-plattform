import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
const investorId = 'INV-6F8FFA7424';

await sql`
  INSERT INTO investor_benefit_activity
    (investor_id, benefit_key, kind, title, details, status, scheduled_at, created_at, updated_at)
  VALUES (
    ${investorId},
    'flights',
    'booking',
    'Hinflug Hamburg → Doha (QR 90) – Web Summit Qatar 2026',
    'Qatar Airways · QR 90 (Direktflug)' || chr(10) ||
    'Abflug: Fr. 30.01.2026 21:30 Hamburg (HAM)' || chr(10) ||
    'Ankunft: Sa. 31.01.2026 05:30 Doha (DOH)' || chr(10) ||
    'Klasse: Business (BCOMFORT)' || chr(10) ||
    'Reservierungscode: XTS9NK',
    'confirmed',
    '2026-01-30T21:30:00+01:00',
    NOW(), NOW()
  )
`;
console.log('✅ Hinflug eingefügt');

await sql`
  INSERT INTO investor_benefit_activity
    (investor_id, benefit_key, kind, title, details, status, scheduled_at, created_at, updated_at)
  VALUES (
    ${investorId},
    'flights',
    'booking',
    'Rückflug Doha → London → Hamburg – Web Summit Qatar 2026',
    'Qatar Airways · Segment 1: QR 7' || chr(10) ||
    'Doha (DOH) 08:45 → London Heathrow (LHR) 13:20' || chr(10) ||
    'Segment 2: QR 9713' || chr(10) ||
    'London Heathrow (LHR) 15:25 → Hamburg (HAM) 18:10' || chr(10) ||
    'Klasse: Business (BCOMFORT)' || chr(10) ||
    'Reservierungscode: XTS9NK',
    'confirmed',
    '2026-02-05T08:45:00+03:00',
    NOW(), NOW()
  )
`;
console.log('✅ Rückflug eingefügt');

await sql`
  INSERT INTO investor_benefit_activity
    (investor_id, benefit_key, kind, title, details, status, scheduled_at, created_at, updated_at)
  VALUES (
    ${investorId},
    'concierge',
    'booking',
    'Hotel Saraya Corniche Doha – Web Summit Qatar 2026',
    'Saraya Corniche Hotel, Doha' || chr(10) ||
    'Check-in: 30.01.2026 · Check-out: 05.02.2026' || chr(10) ||
    '6 Nächte · 1 Person · Superior Double Room' || chr(10) ||
    'Frühstück: inklusive' || chr(10) ||
    'Buchungsnummer: 636696047',
    'confirmed',
    '2026-01-30T14:00:00+03:00',
    NOW(), NOW()
  )
`;
console.log('✅ Hotel eingefügt');

await sql.end();
console.log('✅ Alle 3 Buchungen für Herr Schwab eingetragen.');
