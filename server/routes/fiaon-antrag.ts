import { Router } from "express";
import { db } from "../db";
import { fiaonApplications, fiaonClickEvents } from "@shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

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
    const { ref, type, status, currentStep, packKey, packName, firstName, lastName, birthDay, birthMonth, birthYear, phone, street, zip, city, country, nationality, employment, employer, employedSince, income, rent, debts, housing, wantedLimit, purpose, billing, addon, nfc, approvedLimit, email, iban, billingMethod, ag1, ag2, ag3 } = req.body;
    
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "";
    const birthdate = birthDay && birthMonth && birthYear ? `${birthYear}-${String(birthMonth).padStart(2, "0")}-${String(birthDay).padStart(2, "0")}` : null;

    // Try update first
    const existing = await db.select().from(fiaonApplications).where(eq(fiaonApplications.ref, ref)).limit(1);
    
    const values = {
      ref, type: type || "private", status: status || "started", currentStep: currentStep || 0,
      packKey, packName, firstName, lastName, birthdate, phone, street, zip, city, country, nationality,
      employment, employer, employedSince, income: income || null, rent: rent || null, debts: debts || null, housing,
      wantedLimit: wantedLimit || null, purpose, billing, addon, nfc,
      approvedLimit: approvedLimit || null, email, iban, billingMethod,
      consentAgb: ag1 || false, consentSchufa: ag2 || false, consentContract: ag3 || false,
      ip, userAgent: req.headers["user-agent"] || "",
      updatedAt: new Date(),
    };

    if (existing.length > 0) {
      await db.update(fiaonApplications).set(values).where(eq(fiaonApplications.ref, ref));
    } else {
      await db.insert(fiaonApplications).values(values as any);
    }

    res.json({ ok: true, ref });
  } catch (err) {
    console.error("[FIAON-APP]", err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
