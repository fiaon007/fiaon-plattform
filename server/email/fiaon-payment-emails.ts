/**
 * FIAON — Transaktionale E-Mails für Vorkasse per Banküberweisung
 * (Migration Stripe → SEPA, siehe MIGRATION_INVENTORY.md)
 *
 * Alle Mails nutzen die bestehende Resend-Infrastruktur (server/email/mailer.ts).
 */

import { sendEmail, type SendEmailResult } from "./mailer";
import { fiaonBaseUrl } from "../fiaon-base-url";

// ── Bankverbindung (Vorkasse) ────────────────────────────────────────────────
export const FIAON_BANK = {
  recipient: "Fiaon Ltd",
  iban: "BE09905892763957",
  ibanDisplay: "BE09 9058 9276 3957",
  bic: "TRWIBEB1XXX",
} as const;

const FIAON_BASE_URL = fiaonBaseUrl();

export interface PaymentOrderInfo {
  email: string;
  firstName: string;
  paymentReference: string;
  amountDue: string; // "59.99"
  dueDate: Date;
  packName?: string | null;
}

function fmtAmount(amount: string): string {
  const n = Number(amount);
  return (isNaN(n) ? 0 : n).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function paymentDetailsHtml(o: PaymentOrderInfo): string {
  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 12px;color:#64748b;font-size:13px;">${label}</td><td style="padding:6px 12px;color:#0f172a;font-size:14px;font-weight:600;">${value}</td></tr>`;
  return `
    <table style="width:100%;border-collapse:collapse;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin:16px 0;">
      ${row("Empfänger", FIAON_BANK.recipient)}
      ${row("IBAN", FIAON_BANK.ibanDisplay)}
      ${row("BIC", FIAON_BANK.bic)}
      ${row("Betrag", `${fmtAmount(o.amountDue)} EUR`)}
      ${row("Verwendungszweck", `<span style="color:#2563eb;">${o.paymentReference}</span>`)}
    </table>
    <p style="font-size:13px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px 14px;">
      <b>Wichtig:</b> Bitte gib unbedingt deinen persönlichen Code <b>${o.paymentReference}</b> im Verwendungszweck an.
      Nur so können wir deine Zahlung zuordnen und dein Konto freischalten.
    </p>
    <p style="font-size:13px;color:#475569;">
      Deine Zahlungsseite mit QR-Code für deine Banking-App findest du jederzeit hier:<br/>
      <a href="${FIAON_BASE_URL}/zahlung/${o.paymentReference}" style="color:#2563eb;">${FIAON_BASE_URL}/zahlung/${o.paymentReference}</a>
    </p>`;
}

function wrap(inner: string): string {
  return `
  <div style="font-family:Inter,system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a;">
    <p style="font-size:20px;font-weight:800;color:#2563eb;margin-bottom:24px;">FIAON</p>
    ${inner}
    <p style="font-size:12px;color:#94a3b8;margin-top:32px;border-top:1px solid #e2e8f0;padding-top:16px;">
      FIAON LTD · 128 City Road, London, EC1V 2NX, United Kingdom · Registered in England and Wales, Companies House No. 17318250 · Director: Justin Schwarzott · support@fiaon.com<br/>
      Diese E-Mail wurde automatisch versendet. / This e-mail was sent automatically.
    </p>
  </div>`;
}

// ── Template 1: Zahlungsinformationen (bei Bestellung / Reaktivierung) ───────
export async function sendPaymentInstructionsEmail(o: PaymentOrderInfo): Promise<SendEmailResult> {
  if (!o.email) return { ok: false, error: "no recipient" };
  return sendEmail({
    to: o.email,
    subject: `Letzter Schritt: Konto aktivieren — Verwendungszweck ${o.paymentReference}`,
    html: wrap(`
      <h1 style="font-size:22px;">Letzter Schritt: Karten Versand und Aktiviere Konto</h1>
      <p style="font-size:14px;color:#475569;">Hallo ${o.firstName || ""},</p>
      <p style="font-size:14px;color:#475569;">
        dein Antrag${o.packName ? ` (${o.packName})` : ""} ist bei uns eingegangen.
        Überweise jetzt den Aktivierungsbetrag — sobald deine Zahlung bei uns eingeht, versenden wir deine Karte
        und du erhältst sofort eine E-Mail – in der Regel wenige Minuten nach Zahlungseingang.
      </p>
      <p style="font-size:14px;color:#475569;">
        Dein Konto ist für 7 Tage gültig (keine Zahlung dann schließt sich der Antrag bzw. das Konto) — Frist: <b>${fmtDate(o.dueDate)}</b>.
      </p>
      ${paymentDetailsHtml(o)}
      <p style="font-size:13px;color:#475569;">
        Deine Überweisung geht an unser europäisches Geschäftskonto (IBAN beginnt mit BE – Belgien).
        Das ist eine ganz normale SEPA-Überweisung, wie eine Inlandsüberweisung: kostenlos und in der Regel
        innerhalb eines Bankarbeitstages. Bei Echtzeit-Überweisung geht es in wenigen Minuten, bei
        Standard-Überweisung dauert es 3–5 Werktage.
      </p>
    `),
    tags: [{ name: "type", value: "fiaon-payment-instructions" }],
  });
}

// ── Template 2/3: Erinnerungen nach 24h / 72h ────────────────────────────────
export async function sendPaymentReminderEmail(o: PaymentOrderInfo, kind: "24h" | "72h"): Promise<SendEmailResult> {
  if (!o.email) return { ok: false, error: "no recipient" };
  const urgency =
    kind === "24h"
      ? `<p style="font-size:14px;color:#475569;">kleine Erinnerung: Deine Aktivierung wartet noch auf dich. Sobald deine Zahlung eingeht, versenden wir deine Karte und schalten dein Konto frei.</p>`
      : `<p style="font-size:14px;color:#475569;">dein Antrag läuft bald ab! Bitte überweise den Aktivierungsbetrag bis spätestens <b>${fmtDate(o.dueDate)}</b> — danach schließt sich der Antrag bzw. das Konto automatisch.</p>`;
  return sendEmail({
    to: o.email,
    subject:
      kind === "24h"
        ? `Erinnerung: Konto aktivieren — Verwendungszweck ${o.paymentReference}`
        : `Letzte Erinnerung: Dein FIAON Antrag läuft am ${fmtDate(o.dueDate)} ab`,
    html: wrap(`
      <h1 style="font-size:22px;">Deine Aktivierung wartet</h1>
      <p style="font-size:14px;color:#475569;">Hallo ${o.firstName || ""},</p>
      ${urgency}
      ${paymentDetailsHtml(o)}
    `),
    tags: [{ name: "type", value: `fiaon-payment-reminder-${kind}` }],
  });
}

// ── Willkommen / Zugang aktiv (nach manueller Freischaltung) ─────────────────
export async function sendPaymentConfirmedEmail(o: PaymentOrderInfo): Promise<SendEmailResult> {
  if (!o.email) return { ok: false, error: "no recipient" };
  return sendEmail({
    to: o.email,
    subject: "Willkommen bei FIAON — Dein Konto ist aktiv, deine Karte ist unterwegs",
    html: wrap(`
      <h1 style="font-size:22px;">Zahlung eingegangen — Willkommen bei FIAON! 🎉</h1>
      <p style="font-size:14px;color:#475569;">Hallo ${o.firstName || ""},</p>
      <p style="font-size:14px;color:#475569;">
        deine Zahlung (Verwendungszweck <b>${o.paymentReference}</b>) ist bei uns eingegangen.
        Dein Konto ist jetzt aktiv und deine Karte wird versendet.
      </p>
      <p style="font-size:14px;color:#475569;">
        Du kannst dich ab sofort in deinem Dashboard anmelden:<br/>
        <a href="${FIAON_BASE_URL}/login" style="color:#2563eb;">${FIAON_BASE_URL}/login</a>
      </p>
    `),
    tags: [{ name: "type", value: "fiaon-payment-confirmed" }],
  });
}
