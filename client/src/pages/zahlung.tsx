import { useState, useEffect, useCallback } from "react";
import { useRoute } from "wouter";
import { QRCodeSVG } from "qrcode.react";
import GlassNav from "@/components/GlassNav";
import PremiumFooter from "@/components/PremiumFooter";
import { buildEpcQrPayload } from "@/lib/epc-qr";

// ============================================================================
// /zahlung/[payment_reference] — Zahlungsseite (Vorkasse per Banküberweisung)
// Ersetzt den früheren Stripe-Checkout-Redirect. Siehe MIGRATION_INVENTORY.md
// ============================================================================

interface PaymentOrder {
  paymentReference: string;
  status: string;
  dueDate: string;
  amountDue: string;
  currency: string;
  firstName: string;
  packName: string;
  bank: { recipient: string; iban: string; ibanDisplay: string; bic: string };
}

function CopyField({ label, display, copyValue }: { label: string; display: string; copyValue: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(copyValue);
      } catch {
        // Fallback für ältere Browser
        const ta = document.createElement("textarea");
        ta.value = copyValue;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    },
    [copyValue],
  );

  return (
    <div className="flex items-center justify-between gap-3 py-3 px-4 rounded-xl bg-white border border-slate-200">
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">{label}</p>
        <p className="text-[14px] sm:text-[15px] font-semibold text-slate-900 break-all">{display}</p>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-bold transition-all ${
          copied
            ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
            : "bg-blue-50 text-[#2563eb] border border-blue-100 hover:bg-blue-100"
        }`}
        aria-label={`${label} kopieren`}
      >
        {copied ? (
          <>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
            Kopiert ✓
          </>
        ) : (
          <>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
            Kopieren
          </>
        )}
      </button>
    </div>
  );
}

export default function ZahlungPage() {
  const [, params] = useRoute("/zahlung/:paymentRef");
  const paymentRef = params?.paymentRef || "";
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!paymentRef) return;
    (async () => {
      try {
        const res = await fetch(`/api/fiaon/payment-order/${encodeURIComponent(paymentRef)}`);
        const json = await res.json().catch(() => null);
        if (res.ok && json?.ok) setOrder(json);
        else setError(json?.error || "Bestellung nicht gefunden");
      } catch {
        setError("Verbindungsfehler — bitte Seite neu laden");
      } finally {
        setLoading(false);
      }
    })();
  }, [paymentRef]);

  const amount = order ? Number(order.amountDue) : 0;
  const dueDateStr = order
    ? new Date(order.dueDate).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "";

  const qrPayload = order
    ? buildEpcQrPayload({
        recipient: order.bank.recipient,
        iban: order.bank.iban,
        bic: order.bank.bic,
        amount,
        remittance: order.paymentReference,
      })
    : "";

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <GlassNav />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-28 sm:pt-32 pb-16">
        {loading && (
          <div className="flex flex-col items-center py-24">
            <div className="w-12 h-12 rounded-full border-[3px] border-transparent border-t-[#2563eb] animate-spin mb-4" />
            <p className="text-[14px] text-gray-400">Zahlungsdaten werden geladen…</p>
          </div>
        )}

        {!loading && error && (
          <div className="text-center py-24">
            <h1 className="text-2xl font-bold mb-3">Bestellung nicht gefunden</h1>
            <p className="text-[14px] text-gray-500">{error}</p>
          </div>
        )}

        {!loading && order && order.status === "paid" && (
          <div className="text-center py-24">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <h1 className="text-2xl font-bold mb-3">Zahlung eingegangen ✓</h1>
            <p className="text-[14px] text-gray-500">
              {order.firstName ? `${order.firstName}, deine` : "Deine"} Zahlung ist bei uns eingegangen — dein Konto ist aktiv und deine Karte ist unterwegs.
            </p>
          </div>
        )}

        {!loading && order && order.status !== "paid" && (
          <div className="animate-[fadeInUp_.4s_ease]">
            {/* 1. Headline */}
            <div className="text-center mb-6">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight fiaon-gradient-text-animated mb-3 leading-tight">
                Letzter Schritt: Karten Versand und Aktiviere Konto
              </h1>
              {/* 2. Statuszeile */}
              <p className="text-[13px] sm:text-[14px] text-slate-500">
                Dein Konto ist für 7 Tage gültig (keine Zahlung dann schließt sich der Antrag bzw. das Konto) — Frist:{" "}
                <b className="text-slate-900">{dueDateStr}</b>
              </p>
              {order.firstName && (
                <p className="text-[12px] text-slate-400 mt-1.5">
                  {order.firstName}
                  {order.packName ? ` · ${order.packName.replace(/\n/g, " ")}` : ""} · {order.paymentReference}
                </p>
              )}
            </div>

            {order.status === "expired" && (
              <div className="mb-6 rounded-xl bg-red-50 border border-red-100 p-4 text-center">
                <p className="text-[13px] font-semibold text-red-600">
                  Die Zahlungsfrist ist abgelaufen. Bitte kontaktiere unseren Support, um deinen Antrag zu reaktivieren.
                </p>
              </div>
            )}

            {/* 3. EPC-QR-Code (GiroCode) */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-6 sm:p-8 mb-6 text-center">
              <div className="inline-block p-4 bg-white rounded-2xl border border-slate-200 shadow-sm mb-4">
                <QRCodeSVG value={qrPayload} size={220} level="M" marginSize={1} />
              </div>
              <p className="text-[13px] font-semibold text-slate-700">
                Mit deiner Banking-App scannen – alle Daten werden automatisch ausgefüllt
              </p>
            </div>

            {/* 4. Kopierbare Zahlungsdaten */}
            <div className="space-y-2.5 mb-6">
              <CopyField label="Empfänger" display={order.bank.recipient} copyValue={order.bank.recipient} />
              <CopyField label="IBAN" display={order.bank.ibanDisplay} copyValue={order.bank.iban} />
              <CopyField label="BIC" display={order.bank.bic} copyValue={order.bank.bic} />
              <CopyField
                label="Betrag"
                display={`${amount.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`}
                copyValue={amount.toFixed(2)}
              />
              <CopyField label="Verwendungszweck" display={order.paymentReference} copyValue={order.paymentReference} />
            </div>

            {/* 5. Hinweisbox Verwendungszweck */}
            <div className="rounded-xl bg-amber-50 border-2 border-amber-300 p-4 sm:p-5 mb-4">
              <div className="flex items-start gap-3">
                <svg className="shrink-0 mt-0.5" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                <p className="text-[13px] text-amber-900 leading-relaxed">
                  <b>Wichtig:</b> Bitte gib unbedingt deinen persönlichen Code <b>{order.paymentReference}</b> im
                  Verwendungszweck an. Nur so können wir deine Zahlung zuordnen und dein Konto freischalten.
                </p>
              </div>
            </div>

            {/* 6. Hinweisbox IBAN */}
            <div className="rounded-xl bg-blue-50/70 border border-blue-100 p-4 sm:p-5 mb-4">
              <p className="text-[13px] text-slate-600 leading-relaxed">
                Deine Überweisung geht an unser europäisches Geschäftskonto (IBAN beginnt mit BE – Belgien). Das ist
                eine ganz normale SEPA-Überweisung, wie eine Inlandsüberweisung: kostenlos und in der Regel innerhalb
                eines Bankarbeitstages.
              </p>
            </div>

            {/* 7. Vertrauens-Absatz */}
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 sm:p-5 mb-4">
              <p className="text-[13px] text-slate-600 leading-relaxed">
                <b className="text-slate-800">Warum Überweisung?</b> Volle Kontrolle für dich: keine automatischen
                Kartenabbuchungen, keine gespeicherten Zahlungsdaten. Du entscheidest bei jeder Zahlung selbst.
              </p>
            </div>

            {/* 8. Ablauf-Info */}
            <div className="rounded-xl bg-emerald-50/70 border border-emerald-100 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <svg className="shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.2" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                <p className="text-[13px] text-emerald-900 leading-relaxed">
                  Sobald deine Zahlung bei uns eingeht, versenden wir deine Karte und du erhältst sofort eine E-Mail –
                  in der Regel wenige Minuten nach Zahlungseingang.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <PremiumFooter />

      <style>{`
        @keyframes fadeInUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
      `}</style>
    </div>
  );
}
