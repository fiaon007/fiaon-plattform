import { Router } from "express";
import { db } from "../db";
import { fiaonApplications, fiaonClickEvents } from "@shared/schema";
import { eq } from "drizzle-orm";
import PDFDocument from "pdfkit";
import postgres from "postgres";
import Stripe from "stripe";

const router = Router();

// Initialize Stripe
const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' as any })
  : null;

// Create payment intent for Stripe Elements checkout
router.post("/create-payment-intent", async (req, res) => {
  try {
    const { amount, packageName, ref } = req.body;
    
    if (!stripe) {
      return res.status(500).json({ error: "Stripe not configured" });
    }

    if (!amount || !packageName) {
      return res.status(400).json({ error: "Missing required fields: amount, packageName" });
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'eur',
      metadata: {
        packageName,
        ref,
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error("[FIAON-PAYMENT-INTENT]", err);
    res.status(500).json({ error: "Failed to create payment intent" });
  }
});

// Track click events
router.post("/track", async (req, res) => {
  try {
    const { event, data, ref, sessionId, page } = req.body;
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "";
    await db.insert(fiaonClickEvents).values({
      event, data, applicationRef: ref || null, sessionId: sessionId || null, page: page || null, ip, userAgent: req.headers["user-agent"] || "",
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-TRACK]", err);
    res.json({ ok: false });
  }
});

// Save/update application
router.post("/application", async (req, res) => {
  try {
    console.log("[FIAON-APP] Received application save request. Body keys:", Object.keys(req.body), "password in body:", 'password' in req.body, "password value:", req.body.password);
    
    const { 
      ref, type, status, currentStep, packKey, packName, 
      // Private customer fields
      firstName, lastName, birthDay, birthMonth, birthYear, phone, phoneCountryCode, street, zip, city, country, nationality, employment, employer, employedSince, income, rent, debts, housing,
      // Password for login
      password,
      // Business customer fields
      companyName, legalForm, taxId, establishedYear, contactName, contactEmail, contactPhone, businessType, industry, annualRevenue, employees, monthlyExpenses, billingEmail,
      // Common fields
      wantedLimit, purpose, billing, addon, nfc, approvedLimit, email, iban, billingMethod, salaryReceiptDay, ag1, ag2, ag3 
    } = req.body;
    
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "";
    const birthdate = birthDay && birthMonth && birthYear ? `${birthYear}-${String(birthMonth).padStart(2, "0")}-${String(birthDay).padStart(2, "0")}` : null;

    // Auto-run migration for new fields if they don't exist
    try {
      const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' });
      const columns = await sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'fiaon_applications' 
        AND table_schema = 'public'
        AND column_name IN ('phone_country_code', 'salary_receipt_day', 'password')
      `;
      
      const columnNames = columns.map(c => c.column_name);
      console.log("[FIAON-APP] Existing columns:", columnNames);
      
      const needsMigration = !columnNames.includes('phone_country_code') || 
                             !columnNames.includes('salary_receipt_day') || 
                             !columnNames.includes('password');
      
      if (needsMigration) {
        console.log("[FIAON-APP] Running auto-migration for phoneCountryCode, salaryReceiptDay, and password...");
        await sql`
          ALTER TABLE fiaon_applications 
          ADD COLUMN IF NOT EXISTS phone_country_code VARCHAR,
          ADD COLUMN IF NOT EXISTS salary_receipt_day VARCHAR,
          ADD COLUMN IF NOT EXISTS password VARCHAR;
        `;
        console.log("[FIAON-APP] Auto-migration completed successfully");
      }
      await sql.end();
    } catch (migrateErr) {
      console.error("[FIAON-APP] Auto-migration failed:", migrateErr);
      // Continue with the application save even if migration fails
    }

    // Auto-run migration for business fields if type is business
    if (type === "business") {
      try {
        const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' });
        const columns = await sql`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'fiaon_applications' 
          AND table_schema = 'public'
          AND column_name = 'company_name'
        `;
        
        if (columns.length === 0) {
          console.log("[FIAON-APP] Running auto-migration for business fields...");
          await sql`
            ALTER TABLE fiaon_applications 
            ADD COLUMN IF NOT EXISTS company_name VARCHAR,
            ADD COLUMN IF NOT EXISTS legal_form VARCHAR,
            ADD COLUMN IF NOT EXISTS tax_id VARCHAR,
            ADD COLUMN IF NOT EXISTS established_year VARCHAR,
            ADD COLUMN IF NOT EXISTS contact_name VARCHAR,
            ADD COLUMN IF NOT EXISTS contact_email VARCHAR,
            ADD COLUMN IF NOT EXISTS contact_phone VARCHAR,
            ADD COLUMN IF NOT EXISTS business_type VARCHAR,
            ADD COLUMN IF NOT EXISTS industry VARCHAR,
            ADD COLUMN IF NOT EXISTS annual_revenue INTEGER,
            ADD COLUMN IF NOT EXISTS employees INTEGER,
            ADD COLUMN IF NOT EXISTS monthly_expenses INTEGER,
            ADD COLUMN IF NOT EXISTS billing_email VARCHAR;
          `;
          await sql`
            CREATE INDEX IF NOT EXISTS fiaon_app_type_idx ON fiaon_applications(type);
          `;
          console.log("[FIAON-APP] Auto-migration completed successfully");
        }
        await sql.end();
      } catch (migrateErr) {
        console.error("[FIAON-APP] Auto-migration failed:", migrateErr);
        // Continue with the application save even if migration fails
      }
    }

    // Try update first
    const existing = await db.select().from(fiaonApplications).where(eq(fiaonApplications.ref, ref)).limit(1);
    
    const values: any = {
      ref, type: type || "private", status: status || "started", currentStep: currentStep || 0,
      packKey, packName,
      // Private customer fields
      firstName, lastName, birthdate, phone, phoneCountryCode, street, zip, city, country, nationality,
      employment, employer, employedSince, income: income || null, rent: rent || null, debts: debts || null, housing,
      // Password for login
      password,
      // Business customer fields
      companyName, legalForm, taxId, establishedYear, contactName, contactEmail, contactPhone, businessType, industry, annualRevenue: annualRevenue || null, employees: employees || null, monthlyExpenses: monthlyExpenses || null, billingEmail,
      // Common fields
      wantedLimit: wantedLimit || null, purpose, billing, addon, nfc,
      approvedLimit: approvedLimit || null, email, iban, billingMethod, salaryReceiptDay,
      consentAgb: ag1 || false, consentSchufa: ag2 || false, consentContract: ag3 || false,
      ip, userAgent: req.headers["user-agent"] || "",
      updatedAt: new Date(),
    };

    console.log("[FIAON-APP] Saving application with ref:", ref, "status:", status, "password length:", password?.length, "email:", email);

    if (existing.length > 0) {
      console.log("[FIAON-APP] Updating existing application via direct SQL only to prevent password overwrite");
      
      // Use direct SQL for ALL fields to prevent Drizzle from overwriting password
      // Convert undefined to null to avoid UNDEFINED_VALUE error
      const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' });
      await sql`
        UPDATE fiaon_applications 
        SET 
          type = ${values.type ?? null},
          status = ${values.status ?? null},
          current_step = ${values.currentStep ?? null},
          pack_key = ${values.packKey ?? null},
          pack_name = ${values.packName ?? null},
          first_name = ${values.firstName ?? null},
          last_name = ${values.lastName ?? null},
          birthdate = ${values.birthdate ?? null},
          phone = ${values.phone ?? null},
          phone_country_code = ${values.phoneCountryCode ?? null},
          street = ${values.street ?? null},
          zip = ${values.zip ?? null},
          city = ${values.city ?? null},
          country = ${values.country ?? null},
          nationality = ${values.nationality ?? null},
          employment = ${values.employment ?? null},
          employer = ${values.employer ?? null},
          employed_since = ${values.employedSince ?? null},
          income = ${values.income ?? null},
          rent = ${values.rent ?? null},
          debts = ${values.debts ?? null},
          housing = ${values.housing ?? null},
          password = ${password ?? null},
          company_name = ${values.companyName ?? null},
          legal_form = ${values.legalForm ?? null},
          tax_id = ${values.taxId ?? null},
          established_year = ${values.establishedYear ?? null},
          contact_name = ${values.contactName ?? null},
          contact_email = ${values.contactEmail ?? null},
          contact_phone = ${values.contactPhone ?? null},
          business_type = ${values.businessType ?? null},
          industry = ${values.industry ?? null},
          annual_revenue = ${values.annualRevenue ?? null},
          employees = ${values.employees ?? null},
          monthly_expenses = ${values.monthlyExpenses ?? null},
          billing_email = ${values.billingEmail ?? null},
          wanted_limit = ${values.wantedLimit ?? null},
          purpose = ${values.purpose ?? null},
          billing = ${values.billing ?? null},
          addon = ${values.addon ?? null},
          nfc = ${values.nfc ?? null},
          approved_limit = ${values.approvedLimit ?? null},
          email = ${values.email ?? null},
          iban = ${values.iban ?? null},
          billing_method = ${values.billingMethod ?? null},
          salary_receipt_day = ${values.salaryReceiptDay ?? null},
          consent_agb = ${values.consentAgb ?? null},
          consent_schufa = ${values.consentSchufa ?? null},
          consent_contract = ${values.consentContract ?? null},
          ip = ${values.ip ?? null},
          user_agent = ${values.userAgent ?? null},
          updated_at = ${values.updatedAt ?? null}
        WHERE ref = ${ref}
      `;
      console.log("[FIAON-APP] Direct SQL update completed");
      
      // Explicit commit to ensure transaction is committed
      await sql`COMMIT`;
      
      // Verify password was actually saved
      const verify = await sql`SELECT password, email, status FROM fiaon_applications WHERE ref = ${ref}`;
      console.log("[FIAON-APP] Password verification query result:", verify);
      
      await sql.end();
    } else {
      console.log("[FIAON-APP] Inserting new application");
      await db.insert(fiaonApplications).values(values);
      console.log("[FIAON-APP] Insert completed");
      
      // Direct SQL update for password to ensure it's saved
      if (password) {
        const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' });
        await sql`UPDATE fiaon_applications SET password = ${password}, status = ${status}, email = ${email} WHERE ref = ${ref}`;
        console.log("[FIAON-APP] Password updated via direct SQL after insert");
        
        const verify = await sql`SELECT password, email, status FROM fiaon_applications WHERE ref = ${ref}`;
        console.log("[FIAON-APP] Password verification query result:", verify);
        
        await sql.end();
      }
    }

    res.json({ ok: true, ref });
  } catch (err) {
    console.error("[FIAON-APP]", err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// Login endpoint for fiaon applications
router.post("/login", async (req, res) => {
  let sql: any = null;
  try {
    const { email, password } = req.body;
    
    console.log("[FIAON-LOGIN] Login attempt for email:", email, "password length:", password?.length);
    
    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "Email und Passwort erforderlich" });
    }
    
    // Find application by email using direct SQL to bypass Drizzle ORM issue
    sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' });
    
    // Add small delay to ensure transaction is committed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const apps = await sql`SELECT ref, status, password, first_name, last_name, email, pack_name, approved_limit FROM fiaon_applications WHERE email = ${email} LIMIT 1`;
    
    console.log("[FIAON-LOGIN] Found apps:", apps.length);
    
    if (apps.length === 0) {
      await sql.end();
      return res.status(401).json({ ok: false, error: "Ungültige Anmeldedaten" });
    }
    
    const app = apps[0];
    
    console.log("[FIAON-LOGIN] App status:", app.status, "App password from DB:", app.password, "Input password:", password, "Match:", app.password === password);
    
    // Check password
    if (!app.password || app.password !== password) {
      await sql.end();
      return res.status(401).json({ ok: false, error: "Ungültige Anmeldedaten" });
    }
    
    // Check if application is completed
    if (app.status !== "completed") {
      await sql.end();
      return res.status(403).json({ ok: false, error: "Antrag noch nicht abgeschlossen" });
    }
    
    await sql.end();
    
    // Return success with application data
    res.json({ 
      ok: true, 
      ref: app.ref,
      firstName: app.first_name,
      lastName: app.last_name,
      email: app.email,
      packName: app.pack_name,
      approvedLimit: app.approved_limit,
    });
  } catch (err) {
    console.error("[FIAON-LOGIN]", err);
    if (sql) {
      try { await sql.end(); } catch (e) { /* ignore */ }
    }
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// Generate and download contract PDF
router.get("/contract/:ref", async (req, res) => {
  try {
    const { ref } = req.params;
    
    // Get application data
    const apps = await db.select().from(fiaonApplications).where(eq(fiaonApplications.ref, ref)).limit(1);
    if (apps.length === 0) {
      return res.status(404).json({ error: "Antrag nicht gefunden" });
    }
    
    const app = apps[0];
    
    // Create PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="FIAON_Vertrag_${ref}.pdf"`);
    
    // Pipe PDF to response
    doc.pipe(res);
    
    // Header
    doc.fontSize(24).font('Helvetica-Bold').text('FIAON Kreditkartenvertrag', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).font('Helvetica').text(`Vertragsnummer: ${ref}`, { align: 'center' });
    doc.text(`Datum: ${new Date().toLocaleDateString('de-DE')}`, { align: 'center' });
    doc.moveDown(2);
    
    // Vertragsparteien
    doc.fontSize(14).font('Helvetica-Bold').text('§1 Vertragsparteien');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text('Kreditgeber:', { continued: true }).font('Helvetica-Bold').text(' FIAON Financial Services GmbH');
    doc.font('Helvetica').text('Musterstraße 123, 10115 Berlin');
    doc.moveDown();
    doc.text('Kreditnehmer:', { continued: true }).font('Helvetica-Bold').text(` ${app.firstName || ''} ${app.lastName || ''}`);
    if (app.street) doc.font('Helvetica').text(`${app.street}, ${app.zip || ''} ${app.city || ''}`);
    if (app.birthdate) doc.text(`Geburtsdatum: ${new Date(app.birthdate).toLocaleDateString('de-DE')}`);
    doc.moveDown(1.5);
    
    // Vertragsgegenstand
    doc.fontSize(14).font('Helvetica-Bold').text('§2 Vertragsgegenstand');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Der Kreditgeber stellt dem Kreditnehmer eine ${app.packName || 'FIAON'} Kreditkarte mit folgenden Konditionen zur Verfügung:`);
    doc.moveDown(0.5);
    doc.list([
      `Kreditlimit: bis zu ${app.approvedLimit ? (app.approvedLimit.toLocaleString('de-DE') + ' €') : 'individuell festgelegt'}`,
      `Monatliche Grundgebühr: gemäß Preisverzeichnis`,
      `Verwendungszweck: ${app.purpose || 'allgemeine Nutzung'}`,
      `Abrechnungsart: ${app.billing || 'Vollzahlung'}`,
      `NFC kontaktlos: ${app.nfc || 'aktiviert'}`
    ]);
    doc.moveDown(1.5);
    
    // Kreditkonditionen
    doc.fontSize(14).font('Helvetica-Bold').text('§3 Kreditkonditionen');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text('3.1 Der Kreditnehmer kann die Kreditkarte im Rahmen des vereinbarten Kreditlimits nutzen.');
    doc.text('3.2 Die Abrechnung erfolgt monatlich zum Ende des Abrechnungszeitraums.');
    doc.text('3.3 Bei Vollzahlung fallen keine Sollzinsen an. Bei Teilzahlung gelten die Konditionen gemäß Preisverzeichnis.');
    doc.moveDown(1.5);
    
    // Zahlungsbedingungen
    doc.fontSize(14).font('Helvetica-Bold').text('§4 Zahlungsbedingungen');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    if (app.billingMethod === 'iban' && app.iban) {
      doc.text(`4.1 Die Abbuchung erfolgt per SEPA-Lastschrift von folgendem Konto:`);
      doc.text(`IBAN: ${app.iban}`);
    } else {
      doc.text('4.1 Die Abrechnung erfolgt per Papierrechnung.');
    }
    doc.text('4.2 Die Zahlung ist innerhalb von 14 Tagen nach Rechnungsstellung fällig.');
    doc.moveDown(1.5);
    
    // Kündigungsrecht
    doc.fontSize(14).font('Helvetica-Bold').text('§5 Kündigungsrecht');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text('5.1 Beide Vertragsparteien können diesen Vertrag jederzeit mit einer Frist von 4 Wochen kündigen.');
    doc.text('5.2 Die Kündigung bedarf der Schriftform.');
    doc.moveDown(1.5);
    
    // Datenschutz
    doc.fontSize(14).font('Helvetica-Bold').text('§6 Datenschutz');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text('6.1 Der Kreditgeber verarbeitet personenbezogene Daten gemäß DSGVO.');
    doc.text('6.2 Eine Bonitätsprüfung bei der SCHUFA wurde durchgeführt.');
    doc.moveDown(2);
    
    // Unterschriften
    doc.fontSize(12).font('Helvetica-Bold').text('Vertragsannahme');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Der Kreditnehmer ${app.firstName || ''} ${app.lastName || ''} bestätigt hiermit:`);
    doc.moveDown(0.5);
    doc.list([
      app.consentAgb ? '✓ AGB und Datenschutzerklärung akzeptiert' : '☐ AGB und Datenschutzerklärung',
      app.consentSchufa ? '✓ Einwilligung zur Bonitätsprüfung erteilt' : '☐ Einwilligung zur Bonitätsprüfung',
      app.consentContract ? '✓ Vertrag verbindlich angenommen' : '☐ Vertrag angenommen'
    ]);
    doc.moveDown(2);
    
    doc.text(`Ort, Datum: Berlin, ${new Date().toLocaleDateString('de-DE')}`);
    doc.moveDown(2);
    doc.text('_'.repeat(40));
    doc.text('Unterschrift Kreditnehmer (digital bestätigt)');
    
    // Footer
    doc.fontSize(8).text('\n\nFIAON Financial Services GmbH | Musterstraße 123 | 10115 Berlin | info@fiaon.de | www.fiaon.de', { align: 'center' });
    
    // Finalize PDF
    doc.end();
    
  } catch (err) {
    console.error('[FIAON-CONTRACT-PDF]', err);
    res.status(500).json({ error: 'PDF-Generierung fehlgeschlagen' });
  }
});

// Run migration endpoint (temporary for setup)
router.post("/run-migration", async (req, res) => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.status(500).json({ ok: false, error: "DATABASE_URL not set" });
    }
    
    const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
    
    // Check if columns already exist
    const columns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'fiaon_applications' 
      AND table_schema = 'public'
      AND column_name = 'company_name'
    `;
    
    if (columns.length > 0) {
      await sql.end();
      return res.json({ ok: true, message: "Migration already run - business fields exist" });
    }
    
    // Run migration
    await sql`
      ALTER TABLE fiaon_applications 
      ADD COLUMN IF NOT EXISTS company_name VARCHAR,
      ADD COLUMN IF NOT EXISTS legal_form VARCHAR,
      ADD COLUMN IF NOT EXISTS tax_id VARCHAR,
      ADD COLUMN IF NOT EXISTS established_year VARCHAR,
      ADD COLUMN IF NOT EXISTS contact_name VARCHAR,
      ADD COLUMN IF NOT EXISTS contact_email VARCHAR,
      ADD COLUMN IF NOT EXISTS contact_phone VARCHAR,
      ADD COLUMN IF NOT EXISTS business_type VARCHAR,
      ADD COLUMN IF NOT EXISTS industry VARCHAR,
      ADD COLUMN IF NOT EXISTS annual_revenue INTEGER,
      ADD COLUMN IF NOT EXISTS employees INTEGER,
      ADD COLUMN IF NOT EXISTS monthly_expenses INTEGER,
      ADD COLUMN IF NOT EXISTS billing_email VARCHAR;
    `;
    
    // Create index
    await sql`
      CREATE INDEX IF NOT EXISTS fiaon_app_type_idx ON fiaon_applications(type);
    `;
    
    await sql.end();
    res.json({ ok: true, message: "Migration completed successfully" });
  } catch (err) {
    console.error("[FIAON-MIGRATION]", err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
