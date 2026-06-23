/**
 * FIAON / Finanzion e.K. — Stripe Kunden-Listing
 * Listet alle Kunden MIT hinterlegter Zahlungsmethode auf
 * Ausgabe: Konsole + customers.csv
 */

const Stripe = require("stripe");
const fs = require("fs");

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

async function listCustomersWithPaymentMethod() {
  console.log("🔍 Lade alle Stripe-Kunden...\n");

  let allCustomers = [];
  let hasMore = true;
  let startingAfter = undefined;

  // Alle Kunden paginiert abrufen
  while (hasMore) {
    const params = { limit: 100 };
    if (startingAfter) params.starting_after = startingAfter;

    const page = await stripe.customers.list(params);
    allCustomers = allCustomers.concat(page.data);
    hasMore = page.has_more;

    if (hasMore) {
      startingAfter = page.data[page.data.length - 1].id;
      console.log(`  → ${allCustomers.length} Kunden geladen...`);
    }
  }

  console.log(`✅ Gesamt: ${allCustomers.length} Kunden gefunden\n`);
  console.log("🔍 Prüfe Zahlungsmethoden...\n");

  const qualified = [];

  for (const customer of allCustomers) {
    // Payment Methods abrufen (card + sepa_debit)
    const [cards, sepa] = await Promise.all([
      stripe.paymentMethods.list({ customer: customer.id, type: "card" }),
      stripe.paymentMethods.list({ customer: customer.id, type: "sepa_debit" }),
    ]);

    const allMethods = [...cards.data, ...sepa.data];

    if (allMethods.length > 0) {
      const pm = allMethods[0]; // Primäre Zahlungsmethode
      const pmInfo =
        pm.type === "card"
          ? `Karte •••• ${pm.card.last4} (${pm.card.brand.toUpperCase()}, exp ${pm.card.exp_month}/${pm.card.exp_year})`
          : `SEPA •••• ${pm.sepa_debit.last4} (${pm.sepa_debit.bank_code || "—"})`;

      qualified.push({
        id: customer.id,
        name: customer.name || "—",
        email: customer.email || "—",
        created: new Date(customer.created * 1000).toLocaleDateString("de-DE"),
        payment_method_id: pm.id,
        payment_method_type: pm.type,
        payment_method_info: pmInfo,
        default_source: customer.invoice_settings?.default_payment_method || customer.default_source || "—",
      });
    }
  }

  // Ausgabe Konsole
  console.log(`💳 Kunden MIT Zahlungsmethode: ${qualified.length}\n`);
  console.log("─".repeat(100));
  console.log(
    "Nr.".padEnd(5) +
    "Stripe ID".padEnd(22) +
    "Name".padEnd(25) +
    "E-Mail".padEnd(35) +
    "Zahlungsmethode"
  );
  console.log("─".repeat(100));

  qualified.forEach((c, i) => {
    console.log(
      String(i + 1).padEnd(5) +
      c.id.padEnd(22) +
      c.name.substring(0, 23).padEnd(25) +
      c.email.substring(0, 33).padEnd(35) +
      c.payment_method_info
    );
  });

  console.log("─".repeat(100));

  // CSV Export
  const csvHeader = "Nr;Stripe ID;Name;E-Mail;Erstellt;PM ID;PM Typ;PM Info";
  const csvRows = qualified.map(
    (c, i) =>
      `${i + 1};${c.id};${c.name};${c.email};${c.created};${c.payment_method_id};${c.payment_method_type};"${c.payment_method_info}"`
  );
  const csvContent = [csvHeader, ...csvRows].join("\n");
  fs.writeFileSync("customers_with_pm.csv", csvContent, "utf8");

  console.log(`\n📄 CSV gespeichert: customers_with_pm.csv`);
  console.log(`\n✅ Fertig. ${qualified.length} Kunden können belastet werden.`);
}

listCustomersWithPaymentMethod().catch((err) => {
  console.error("❌ Fehler:", err.message);
  process.exit(1);
});
