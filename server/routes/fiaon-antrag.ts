import { Router } from "express";
import { db } from "../db";
import { fiaonApplications, fiaonClickEvents } from "@shared/schema";
import { eq } from "drizzle-orm";
import PDFDocument from "pdfkit";
import postgres from "postgres";
import Stripe from "stripe";
import multer from "multer";

const router = Router();

// Configure multer for KYC document uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max per file
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

// Create a single postgres connection pool for direct SQL queries
const sqlPool = postgres(process.env.DATABASE_URL!, { ssl: 'require', max: 10 });

// Initialize Stripe
const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' as any })
  : null;

// Create subscription with saved payment method
router.post("/create-payment-intent", async (req, res) => {
  try {
    const { amount, packageName, ref, firstName, lastName, email } = req.body;
    
    if (!stripe) {
      return res.status(500).json({ error: "Stripe not configured" });
    }

    if (!amount || !packageName || !ref) {
      return res.status(400).json({ error: "Missing required fields: amount, packageName, ref" });
    }

    console.log("[FIAON-SUBSCRIPTION] Creating subscription for:", { ref, packageName, amount, email, name: `${firstName} ${lastName}` });

    // Get or create Stripe customer
    let customer;
    const existingApp = await sqlPool`
      SELECT stripe_customer_id FROM fiaon_applications WHERE ref = ${ref} LIMIT 1
    `;
    
    if (existingApp.length > 0 && existingApp[0].stripe_customer_id) {
      // Retrieve existing customer
      customer = await stripe.customers.retrieve(existingApp[0].stripe_customer_id);
      console.log("[FIAON-SUBSCRIPTION] Using existing customer:", customer.id);
    } else {
      // Create new customer
      customer = await stripe.customers.create({
        email: email || undefined,
        name: firstName && lastName ? `${firstName} ${lastName}` : undefined,
        metadata: {
          ref,
          packageName,
        },
      });
      console.log("[FIAON-SUBSCRIPTION] Created new customer:", customer.id);
      
      // Save customer ID to database
      await sqlPool`
        UPDATE fiaon_applications 
        SET stripe_customer_id = ${customer.id}
        WHERE ref = ${ref}
      `;
    }

    // Create product first
    console.log("[FIAON-SUBSCRIPTION] Creating product:", packageName);
    const product = await stripe.products.create({
      name: packageName,
      metadata: { ref },
    });
    console.log("[FIAON-SUBSCRIPTION] Created product:", product.id);

    // Create price for the product
    console.log("[FIAON-SUBSCRIPTION] Creating price for product:", product.id, "amount:", amount);
    const price = await stripe.prices.create({
      product: product.id,
      currency: 'eur',
      recurring: {
        interval: 'month',
      },
      unit_amount: Math.round(amount * 100), // Convert to cents
    });
    console.log("[FIAON-SUBSCRIPTION] Created price:", price.id);

    // Create subscription with setup intent for payment method
    console.log("[FIAON-SUBSCRIPTION] Creating subscription with price:", price.id, "for customer:", customer.id);
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{
        price: price.id,
      }],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription',
        payment_method_types: ['card'],
      },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        ref,
        packageName,
      },
    });

    console.log("[FIAON-SUBSCRIPTION] Created subscription:", subscription.id);

    // Save subscription ID to database
    await sqlPool`
      UPDATE fiaon_applications 
      SET stripe_subscription_id = ${subscription.id}
      WHERE ref = ${ref}
    `;

    const invoice = subscription.latest_invoice as any;
    const paymentIntent = invoice?.payment_intent;

    res.json({ 
      clientSecret: paymentIntent?.client_secret,
      subscriptionId: subscription.id,
      customerId: customer.id,
    });
  } catch (err: any) {
    console.error("[FIAON-SUBSCRIPTION] Error:", err.message);
    console.error("[FIAON-SUBSCRIPTION] Full error:", JSON.stringify(err, null, 2));
    res.status(500).json({ error: "Failed to create subscription", details: err.message });
  }
});

// Stripe webhook handler
router.post("/stripe-webhook", async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: "Stripe not configured" });
  }

  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("[STRIPE-WEBHOOK] No webhook secret configured");
    return res.status(400).send('Webhook secret not configured');
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error("[STRIPE-WEBHOOK] Signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log("[STRIPE-WEBHOOK] Received event:", event.type);

  try {
    switch (event.type) {
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as any;
        const subscriptionId = invoice.subscription;
        const paymentMethodId = invoice.payment_intent?.payment_method;
        
        console.log("[STRIPE-WEBHOOK] Payment succeeded for subscription:", subscriptionId, "payment method:", paymentMethodId);
        
        if (subscriptionId && paymentMethodId) {
          // Update payment method in database
          await sqlPool`
            UPDATE fiaon_applications 
            SET 
              stripe_payment_method_id = ${paymentMethodId},
              payment_status = 'paid'
            WHERE stripe_subscription_id = ${subscriptionId}
          `;
          console.log("[STRIPE-WEBHOOK] Updated payment method for subscription:", subscriptionId);
        }
        break;
      }
      
      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const subscription = event.data.object as any;
        const paymentMethodId = subscription.default_payment_method;
        
        console.log("[STRIPE-WEBHOOK] Subscription updated:", subscription.id, "payment method:", paymentMethodId);
        
        if (paymentMethodId) {
          await sqlPool`
            UPDATE fiaon_applications 
            SET stripe_payment_method_id = ${paymentMethodId}
            WHERE stripe_subscription_id = ${subscription.id}
          `;
          console.log("[STRIPE-WEBHOOK] Updated payment method for subscription:", subscription.id);
        }
        break;
      }
      
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any;
        console.log("[STRIPE-WEBHOOK] Subscription cancelled:", subscription.id);
        
        await sqlPool`
          UPDATE fiaon_applications 
          SET payment_status = 'cancelled'
          WHERE stripe_subscription_id = ${subscription.id}
        `;
        break;
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error("[STRIPE-WEBHOOK] Error processing webhook:", err);
    res.status(500).json({ error: "Webhook processing failed" });
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
      await sqlPool`
        UPDATE fiaon_applications 
        SET 
          type = ${values.type ?? null},
          status = ${values.status ?? null},
          current_step = ${values.currentStep ?? null},
          pack_key = ${values.packKey ?? null},
          pack_name = ${values.packName ?? null},
          first_name = COALESCE(NULLIF(${values.firstName ?? ''}, ''), first_name),
          last_name = COALESCE(NULLIF(${values.lastName ?? ''}, ''), last_name),
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
          email = COALESCE(NULLIF(${values.email ?? ''}, ''), email),
          iban = ${values.iban ?? null},
          billing_method = ${values.billingMethod ?? null},
          salary_receipt_day = ${values.salaryReceiptDay ?? null},
          consent_agb = ${values.consentAgb ?? null},
          consent_schufa = ${values.consentSchufa ?? null},
          consent_contract = ${values.consentContract ?? null},
          ip = ${values.ip ?? null},
          user_agent = ${values.userAgent ?? null},
          updated_at = ${values.updatedAt ?? null},
          utm = ${JSON.stringify({ password })}::jsonb
        WHERE ref = ${ref}
      `;
      console.log("[FIAON-APP] Direct SQL update completed");
      
      // Verify password was actually saved in utm field
      const verify = await sqlPool`SELECT utm, email, status FROM fiaon_applications WHERE ref = ${ref}`;
      console.log("[FIAON-APP] Password verification query result:", verify);
    } else {
      console.log("[FIAON-APP] Inserting new application");
      await db.insert(fiaonApplications).values(values);
      console.log("[FIAON-APP] Insert completed");
      
      // Direct SQL update for password to ensure it's saved in utm field
      if (password) {
        await sqlPool`UPDATE fiaon_applications SET utm = ${JSON.stringify({ password })}::jsonb, status = ${status}, email = ${email} WHERE ref = ${ref}`;
        console.log("[FIAON-APP] Password updated via direct SQL after insert in utm field");
        
        const verify = await sqlPool`SELECT utm, email, status FROM fiaon_applications WHERE ref = ${ref}`;
        console.log("[FIAON-APP] Password verification query result:", verify);
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
  try {
    const { email, password } = req.body;
    
    console.log("[FIAON-LOGIN] Login attempt for email:", email, "password length:", password?.length);
    
    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "Email und Passwort erforderlich" });
    }
    
    // Find application by email using direct SQL with same pool as save
    const apps = await sqlPool`SELECT *, utm::text as utm_string FROM fiaon_applications WHERE email = ${email} ORDER BY created_at DESC LIMIT 1`;
    
    console.log("[FIAON-LOGIN] Found apps:", apps.length);
    
    if (apps.length === 0) {
      return res.status(401).json({ ok: false, error: "Ungültige Anmeldedaten" });
    }
    
    const app = apps[0];
    console.log("[FIAON-LOGIN] RAW DB ROW:", JSON.stringify(app));
    
    // Extract password from utm JSON field with brute-force parsing
    let storedPassword = null;

    if (app.password) {
      storedPassword = app.password;
    } else {
      // Nutze den garantierten Text-String aus der DB
      const rawUtmData = app.utm_string || app.utm;

      if (rawUtmData) {
        try {
          const utmObj = typeof rawUtmData === 'string' ? JSON.parse(rawUtmData) : rawUtmData;
          storedPassword = utmObj.password;
        } catch (parseError) {
          console.error("[FIAON-LOGIN] UTM JSON Parse Error:", parseError);
        }
      }
    }

    console.log(`[FIAON-LOGIN] Extracted Password: ${storedPassword} | Input: ${password} | Match: ${storedPassword === password}`);
    
    // Check password
    if (!storedPassword || storedPassword !== password) {
      return res.status(401).json({ ok: false, error: "Ungültige Anmeldedaten" });
    }
    
    // Check if application is completed
    if (app.status !== "completed") {
      return res.status(403).json({ ok: false, error: "Antrag noch nicht abgeschlossen" });
    }
    
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
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// Upload KYC documents
router.post("/upload-kyc", upload.fields([
  { name: 'bankStatement', maxCount: 1 },
  { name: 'idCard', maxCount: 1 }
]), async (req, res) => {
  try {
    const { ref } = req.body;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    
    if (!ref) {
      return res.status(400).json({ error: "Referenznummer fehlt" });
    }
    
    // Get application
    const apps = await sqlPool`
      SELECT * FROM fiaon_applications 
      WHERE ref = ${ref}
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    
    if (apps.length === 0) {
      return res.status(404).json({ error: "Antrag nicht gefunden" });
    }
    
    // Prepare update values
    const updates: string[] = [];
    const values: any = {};
    
    if (files.bankStatement && files.bankStatement[0]) {
      updates.push('bank_statement_pdf = $bankStatementPdf');
      values.bankStatementPdf = files.bankStatement[0].buffer;
    }
    
    if (files.idCard && files.idCard[0]) {
      updates.push('id_card_pdf = $idCardPdf');
      values.idCardPdf = files.idCard[0].buffer;
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: "Keine Dokumente hochgeladen" });
    }
    
    // Add timestamp
    updates.push('documents_uploaded_at = NOW()');
    
    // Check if both documents are now present
    const currentApp = apps[0];
    const hasBankStatement = files.bankStatement || currentApp.bank_statement_pdf;
    const hasIdCard = files.idCard || currentApp.id_card_pdf;
    
    if (hasBankStatement && hasIdCard) {
      updates.push("status = 'documents_submitted'");
    }
    
    // Build dynamic SQL update
    let sql = 'UPDATE fiaon_applications SET ';
    const params: any[] = [];
    let paramIndex = 1;
    
    if (values.bankStatementPdf) {
      sql += `bank_statement_pdf = $${paramIndex++}, `;
      params.push(values.bankStatementPdf);
    }
    
    if (values.idCardPdf) {
      sql += `id_card_pdf = $${paramIndex++}, `;
      params.push(values.idCardPdf);
    }
    
    sql += `documents_uploaded_at = NOW()`;
    
    if (hasBankStatement && hasIdCard) {
      sql += `, status = 'documents_submitted'`;
    }
    
    sql += ` WHERE ref = $${paramIndex}`;
    params.push(ref);
    
    // Execute update
    await sqlPool.unsafe(sql, params);
    
    console.log(`[FIAON-KYC] Documents uploaded for ${ref}`);
    
    res.json({ 
      ok: true, 
      message: "Dokumente erfolgreich hochgeladen",
      hasBankStatement: !!hasBankStatement,
      hasIdCard: !!hasIdCard,
      allDocumentsUploaded: !!(hasBankStatement && hasIdCard)
    });
  } catch (err) {
    console.error("[FIAON-KYC]", err);
    res.status(500).json({ error: "Fehler beim Hochladen der Dokumente" });
  }
});

// Check KYC document status
router.get("/kyc-status/:ref", async (req, res) => {
  try {
    const { ref } = req.params;
    
    const apps = await sqlPool`
      SELECT 
        CASE WHEN bank_statement_pdf IS NOT NULL THEN true ELSE false END as has_bank_statement,
        CASE WHEN id_card_pdf IS NOT NULL THEN true ELSE false END as has_id_card,
        documents_uploaded_at,
        status
      FROM fiaon_applications 
      WHERE ref = ${ref}
      LIMIT 1
    `;
    
    if (apps.length === 0) {
      return res.status(404).json({ error: "Antrag nicht gefunden" });
    }
    
    const app = apps[0];
    res.json({
      hasBankStatement: app.has_bank_statement,
      hasIdCard: app.has_id_card,
      documentsUploadedAt: app.documents_uploaded_at,
      status: app.status
    });
  } catch (err) {
    console.error("[FIAON-KYC-STATUS]", err);
    res.status(500).json({ error: "Fehler beim Abrufen des Status" });
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
