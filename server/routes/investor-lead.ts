import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { Resend } from "resend";

const router = Router();

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.FROM_EMAIL || "ARAS AI <noreply@arasai.com>";
const NOTIFY_EMAIL = process.env.INVESTOR_NOTIFY_EMAIL || "info@aras-ai.com";

// Simple in-memory rate limiter scoped to this route
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX = 5;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    return true;
  }
  return false;
}

// Cleanup stale entries every 15 minutes
setInterval(() => {
  const now = Date.now();
  Array.from(rateLimitMap.keys()).forEach((key) => {
    const entry = rateLimitMap.get(key);
    if (entry && now > entry.resetAt) {
      rateLimitMap.delete(key);
    }
  });
}, 15 * 60 * 1000);

const investorLeadSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  firm: z.string().min(2, "Firm must be at least 2 characters"),
  email: z.string().email("Please provide a valid email address"),
  ticketSize: z.string().optional(),
  thesis: z.string().max(800, "Message must be under 800 characters").optional(),
  website: z.string().url().optional().or(z.literal("")),
  requestType: z.enum(["data_room", "intro_call"]).optional(),
  lang: z.enum(["de", "en"]).optional(),
  companyWebsite2: z.string().optional(), // honeypot
});

// POST /api/investors/lead
router.post("/lead", async (req: Request, res: Response) => {
  try {
    // Rate limiting
    const clientIp =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "unknown";

    if (isRateLimited(clientIp)) {
      return res.status(429).json({
        ok: false,
        message: "Too many requests. Please try again in a few minutes.",
      });
    }

    // Validate payload
    const parsed = investorLeadSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0]?.message || "Invalid input";
      return res.status(400).json({ ok: false, message: firstError });
    }

    const { name, firm, email, ticketSize, thesis, website, requestType, lang, companyWebsite2 } =
      parsed.data;

    // Honeypot — if filled, silently succeed without sending
    if (companyWebsite2) {
      return res.json({ ok: true, message: "Thank you." });
    }

    // Hash IP for logging (don't store raw IP)
    const crypto = await import("crypto");
    const ipHash = crypto
      .createHash("sha256")
      .update(clientIp + "aras-investor-salt")
      .digest("hex")
      .substring(0, 12);

    const timestamp = new Date().toISOString();
    const typeLabel =
      requestType === "intro_call" ? "Intro Call Request" : "Data Room Request";

    // Send notification email
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: NOTIFY_EMAIL,
      subject: `Investor ${typeLabel} (${(lang || "de").toUpperCase()}) — ${firm}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #0a0a0a;
                margin: 0;
                padding: 20px;
                color: #e9d7c4;
              }
              .container {
                max-width: 600px;
                margin: 0 auto;
                background: linear-gradient(135deg, rgba(10,10,10,0.98), rgba(20,20,20,0.98));
                border: 2px solid transparent;
                background-image:
                  linear-gradient(135deg, rgba(10,10,10,0.98), rgba(20,20,20,0.98)),
                  linear-gradient(135deg, #FE9100, #E9D7C4);
                background-origin: border-box;
                background-clip: padding-box, border-box;
                border-radius: 16px;
                padding: 40px;
                box-shadow: 0 0 40px rgba(254, 145, 0, 0.2);
              }
              h1 {
                background: linear-gradient(135deg, #E9D7C4, #FE9100, #A34E00);
                -webkit-background-clip: text;
                background-clip: text;
                -webkit-text-fill-color: transparent;
                font-size: 24px;
                margin: 0 0 24px 0;
              }
              .field { margin-bottom: 16px; }
              .label { color: #a34e00; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px; }
              .value { color: #f5f5f7; font-size: 16px; }
              .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid rgba(233,215,196,0.2); color: #a34e00; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>${typeLabel}</h1>
              <div class="field"><div class="label">Name</div><div class="value">${name}</div></div>
              <div class="field"><div class="label">Firm</div><div class="value">${firm}</div></div>
              <div class="field"><div class="label">Email</div><div class="value">${email}</div></div>
              ${ticketSize ? `<div class="field"><div class="label">Ticket Size</div><div class="value">${ticketSize}</div></div>` : ""}
              ${website ? `<div class="field"><div class="label">Website</div><div class="value">${website}</div></div>` : ""}
              ${thesis ? `<div class="field"><div class="label">Thesis / Notes</div><div class="value">${thesis}</div></div>` : ""}
              <div class="footer">
                <p>Received: ${timestamp}</p>
                <p>Ref: ${ipHash}</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error("[INVESTOR-LEAD] Email send error:", error);
      return res.status(500).json({
        ok: false,
        message: "Something went wrong. Please try again or email us directly.",
      });
    }

    console.log(
      `[INVESTOR-LEAD] New ${typeLabel} from ${firm} (ref: ${ipHash})`
    );

    return res.json({
      ok: true,
      message: "Thank you. We'll respond within 24–48 hours.",
    });
  } catch (err) {
    console.error("[INVESTOR-LEAD] Unexpected error:", err);
    return res.status(500).json({
      ok: false,
      message: "Something went wrong. Please try again or email us directly.",
    });
  }
});

export default router;
