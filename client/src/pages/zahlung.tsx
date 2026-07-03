import { useState, useEffect, useCallback, useRef } from "react";
import { useRoute } from "wouter";
import { QRCodeSVG } from "qrcode.react";
import GlassNav from "@/components/GlassNav";
import PremiumFooter from "@/components/PremiumFooter";
import { buildEpcQrPayload } from "@/lib/epc-qr";

// ============================================================================
// /zahlung/[payment_reference] — Mobile-first Zahlungsseite (SEPA-Vorkasse)
// Lösung A: Alles-kopieren-Button (Held) · Lösung B: Banking-App-Deep-Link
// (mobil, nachrangig) · Lösung C: QR mobil eingeklappt, Desktop prominent ·
// Tracking: "Ich habe die Überweisung getätigt" → claimed_paid (KEINE
// Freischaltung). Siehe MIGRATION_INVENTORY.md
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

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

function CopyField({ label, display, copyValue, highlight, hint }: { label: string; display: string; copyValue: string; highlight?: boolean; hint?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      const ok = await copyToClipboard(copyValue);
      if (ok) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    },
    [copyValue],
  );

  return (
    <div
      className={`py-3 px-4 rounded-xl bg-white border ${
        highlight ? "border-2 border-amber-300 bg-amber-50/40" : "border-slate-200"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">{label}</p>
          <p className={`text-[14px] sm:text-[15px] font-semibold break-all ${highlight ? "text-amber-900" : "text-slate-900"}`}>{display}</p>
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
      {hint && <p className="mt-1.5 text-[11px] text-amber-700 font-medium">{hint}</p>}
    </div>
  );
}

// ── Danke-Seite nach "Ich habe die Überweisung getätigt" ──────────────
export function ZahlungDankePage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <GlassNav />
      <div className="max-w-xl mx-auto px-4 sm:px-6 pt-28 sm:pt-32 pb-16">
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight fiaon-gradient-text-animated mb-4">Danke!</h1>
          <p className="text-[15px] text-slate-600 leading-relaxed max-w-md mx-auto">
            Wir prüfen deinen Zahlungseingang. Sobald er da ist – meist innerhalb von 24 Stunden – schalten wir dein
            Konto frei und du bekommst eine E-Mail. Du musst nichts weiter tun.
          </p>
        </div>
      </div>
      <PremiumFooter />
    </div>
  );
}

export default function ZahlungPage() {
  const [, params] = useRoute("/zahlung/:paymentRef");
  const paymentRef = params?.paymentRef || "";
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Lösung A: Alles-kopieren
  const [allCopied, setAllCopied] = useState(false);
  const [copyFallback, setCopyFallback] = useState(false);
  const dataBlockRef = useRef<HTMLPreElement>(null);

  // Lösung C: QR mobil eingeklappt
  const [qrOpen, setQrOpen] = useState(false);

  // Tracking-Button
  const [claiming, setClaiming] = useState(false);

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

  // Exaktes Format lt. Spezifikation (Lösung A)
  const allDataText = order
    ? [
        `Empfänger: ${order.bank.recipient}`,
        `IBAN: ${order.bank.iban}`,
        `BIC: ${order.bank.bic}`,
        `Betrag: ${amount.toFixed(2)} EUR`,
        `Verwendungszweck: ${order.paymentReference}`,
      ].join("\n")
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

  // Lösung A: Alle Daten in einem Rutsch kopieren, mit sauberem Fallback
  const handleCopyAll = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      const ok = await copyToClipboard(allDataText);
      if (ok) {
        setAllCopied(true);
        setCopyFallback(false);
        setTimeout(() => setAllCopied(false), 4000);
      } else {
        // Fallback: Datenblock sichtbar machen und zur manuellen Auswahl markieren
        setCopyFallback(true);
        setTimeout(() => {
          const el = dataBlockRef.current;
          if (el) {
            const range = document.createRange();
            range.selectNodeContents(el);
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(range);
            el.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, 50);
      }
    },
    [allDataText],
  );

  // Lösung B: SEPA-Deep-Link (BezahlCode) — darf bei Nicht-Unterstützung nichts kaputtmachen
  const handleOpenBankingApp = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!order) return;
      try {
        const link =
          `bank://singlepaymentsepa?name=${encodeURIComponent(order.bank.recipient)}` +
          `&iban=${encodeURIComponent(order.bank.iban)}` +
          `&bic=${encodeURIComponent(order.bank.bic)}` +
          `&amount=${encodeURIComponent(amount.toFixed(2).replace(".", ","))}` +
          `&currency=EUR` +
          `&reason=${encodeURIComponent(order.paymentReference)}`;
        window.location.href = link;
      } catch {
        // still & leise — Kopier-Button bleibt der Hauptweg
      }
    },
    [order, amount],
  );

  // Tracking: "Ich habe die Überweisung getätigt" → claimed_paid, dann Danke-Seite.
  // Löst NIEMALS Freischaltung oder Willkommensmail aus.
  const handleClaimPaid = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (claiming || !order) return;
      setClaiming(true);
      try {
        await fetch(`/api/fiaon/payment-order/${encodeURIComponent(order.paymentReference)}/claim-paid`, {
          method: "POST",
        });
      } catch {}
      window.location.href = `/zahlung/${order.paymentReference}/danke`;
    },
    [order, claiming],
  );

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
            <div className="text-center mb-5">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight fiaon-gradient-text-animated mb-3 leading-tight">
                Letzter Schritt: Konto aktivieren
              </h1>
              {/* 2. Statuszeile */}
              <p className="text-[13px] sm:text-[14px] text-slate-500">
                Dein Platz ist bis zum <b className="text-slate-900">{dueDateStr}</b> reserviert.
              </p>
              {order.firstName && (
                <p className="text-[12px] text-slate-400 mt-1.5">
                  {order.firstName}
                  {order.packName ? ` · ${order.packName.replace(/\n/g, " ")}` : ""} · {order.paymentReference}
                </p>
              )}
            </div>

            {order.status === "claimed_paid" && (
              <div className="mb-5 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-center">
                <p className="text-[13px] font-semibold text-emerald-700">
                  Danke! Wir prüfen deinen Zahlungseingang – meist innerhalb von 24 Stunden. Du bekommst eine E-Mail, sobald dein Konto frei ist.
                </p>
              </div>
            )}

            {order.status === "expired" && (
              <div className="mb-5 rounded-xl bg-red-50 border border-red-100 p-4 text-center">
                <p className="text-[13px] font-semibold text-red-600">
                  Die Zahlungsfrist ist abgelaufen. Bitte kontaktiere unseren Support, um deinen Antrag zu reaktivieren.
                </p>
              </div>
            )}

            {/* 3. Erklär-Box: So überweist du – in 3 einfachen Schritten */}
            <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5 sm:p-6 mb-5">
              <p className="text-[15px] sm:text-[16px] font-bold text-slate-900 mb-3">So überweist du – in 3 einfachen Schritten</p>
              <ol className="space-y-2.5">
                <li className="flex gap-3 text-[13.5px] sm:text-[14px] text-slate-700 leading-relaxed">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-[#2563eb] text-white text-[12px] font-bold flex items-center justify-center">1</span>
                  Öffne deine Banking-App oder dein Online-Banking.
                </li>
                <li className="flex gap-3 text-[13.5px] sm:text-[14px] text-slate-700 leading-relaxed">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-[#2563eb] text-white text-[12px] font-bold flex items-center justify-center">2</span>
                  <span>Tippe unten auf <b>„Alle Überweisungsdaten kopieren"</b> und füge sie in deine Überweisung ein.</span>
                </li>
                <li className="flex gap-3 text-[13.5px] sm:text-[14px] text-slate-700 leading-relaxed">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-[#2563eb] text-white text-[12px] font-bold flex items-center justify-center">3</span>
                  <span>
                    Wichtig: Trage den Code <b className="text-slate-900">{order.paymentReference}</b> als Verwendungszweck / Betreff ein – nur so finden wir deine Zahlung.
                  </span>
                </li>
              </ol>
            </div>

            {/* 4. LÖSUNG A: Primärer Kopier-Button (der Held der Seite) */}
            <button
              type="button"
              onClick={handleCopyAll}
              className={`w-full inline-flex items-center justify-center gap-2.5 rounded-full py-4 sm:py-5 px-6 font-semibold text-[15px] sm:text-[16px] transition-all duration-300 mb-2 ${
                allCopied
                  ? "bg-emerald-600 text-white shadow-xl shadow-emerald-500/30"
                  : "fiaon-btn-gradient text-white shadow-xl shadow-blue-500/30 hover:shadow-2xl hover:shadow-blue-600/40 hover:-translate-y-0.5"
              }`}
              style={{ minHeight: 56 }}
            >
              {allCopied ? (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                  Kopiert ✓
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                  Alle Überweisungsdaten kopieren
                </>
              )}
            </button>
            {allCopied && (
              <p className="text-center text-[13px] font-semibold text-emerald-600 mb-2">
                Kopiert ✓ – wechsle jetzt in deine Banking-App und füge die Daten ein.
              </p>
            )}
            {copyFallback && (
              <div className="mb-2 rounded-xl bg-amber-50 border border-amber-200 p-4">
                <p className="text-[13px] font-semibold text-amber-800 mb-2">Bitte kopiere die Daten unten manuell.</p>
                <pre
                  ref={dataBlockRef}
                  className="text-[13px] text-slate-800 font-mono whitespace-pre-wrap bg-white rounded-lg border border-amber-200 p-3 select-all"
                >
                  {allDataText}
                </pre>
              </div>
            )}

            {/* 5. LÖSUNG B: Deep-Link (nur Mobile, bewusst nachrangig) */}
            <div className="sm:hidden mb-5">
              <button
                type="button"
                onClick={handleOpenBankingApp}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full py-3 px-5 text-[13px] font-semibold text-[#2563eb] bg-white border border-blue-200 hover:bg-blue-50 transition-all"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                In meiner Banking-App öffnen
              </button>
              <p className="text-center text-[11px] text-slate-400 mt-1.5 px-4">
                Funktioniert nur bei manchen Banken – wenn nichts passiert, nutze einfach den Kopier-Button oben.
              </p>
            </div>

            {/* 6. Einzel-Bankdaten (Fallback Feld-für-Feld) */}
            <div className="space-y-2.5 mb-5 mt-4">
              <CopyField label="Empfänger" display={order.bank.recipient} copyValue={order.bank.recipient} />
              <CopyField label="IBAN" display={order.bank.ibanDisplay} copyValue={order.bank.iban} />
              <CopyField label="BIC" display={order.bank.bic} copyValue={order.bank.bic} />
              <CopyField
                label="Betrag"
                display={`${amount.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`}
                copyValue={amount.toFixed(2)}
              />
              <CopyField
                label="Verwendungszweck"
                display={order.paymentReference}
                copyValue={order.paymentReference}
                highlight
                hint="Ohne diesen Code können wir deine Zahlung nicht zuordnen."
              />
            </div>

            {/* 7. LÖSUNG C: Responsiver QR-Code (GiroCode) */}
            {/* Desktop: prominent sichtbar */}
            <div className="hidden sm:block rounded-2xl border border-slate-200 bg-slate-50/60 p-6 sm:p-8 mb-5 text-center">
              <div className="inline-block p-4 bg-white rounded-2xl border border-slate-200 shadow-sm mb-4">
                <QRCodeSVG value={qrPayload} size={200} level="M" marginSize={1} />
              </div>
              <p className="text-[13px] font-semibold text-slate-700">
                Scanne diesen Code mit deiner Banking-App auf dem Handy.
              </p>
            </div>
            {/* Mobile: eingeklappt hinter Ausklapp-Element */}
            <div className="sm:hidden mb-5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setQrOpen((v) => !v);
                }}
                className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 text-[13px] font-semibold text-slate-600"
                aria-expanded={qrOpen}
              >
                <span>{qrOpen ? "▾" : "▸"} QR-Code anzeigen (zum Scannen mit einem anderen Gerät)</span>
              </button>
              {qrOpen && (
                <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50/60 p-5 text-center">
                  <p className="text-[12px] text-slate-500 mb-3 leading-relaxed">
                    Nützlich, wenn du dein Online-Banking gerade an einem anderen Gerät wie dem Computer geöffnet hast.
                  </p>
                  <div className="inline-block p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
                    <QRCodeSVG value={qrPayload} size={160} level="M" marginSize={1} />
                  </div>
                </div>
              )}
            </div>

            {/* 8. IBAN-Herkunft-Hinweis */}
            <div className="rounded-xl bg-blue-50/70 border border-blue-100 p-4 sm:p-5 mb-4">
              <p className="text-[13px] text-slate-600 leading-relaxed">
                Deine Überweisung geht an unser europäisches Geschäftskonto (die IBAN beginnt mit BE für Belgien). Das
                ist eine ganz normale SEPA-Überweisung – kostenlos und in der Regel innerhalb eines Bankarbeitstages,
                genau wie eine Inlandsüberweisung.
              </p>
            </div>

            {/* 9. Vertrauens-Absatz */}
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 sm:p-5 mb-6">
              <p className="text-[13px] text-slate-600 leading-relaxed">
                <b className="text-slate-800">Warum Überweisung?</b> Du behältst die volle Kontrolle: keine
                automatischen Kartenabbuchungen, keine gespeicherten Zahlungsdaten. Du entscheidest bei jeder Zahlung
                selbst.
              </p>
            </div>

            {/* 10. Tracking-Button: Ich habe die Überweisung getätigt */}
            <button
              type="button"
              onClick={handleClaimPaid}
              disabled={claiming}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full py-4 px-6 text-[14px] sm:text-[15px] font-bold text-emerald-700 bg-emerald-50 border-2 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 transition-all disabled:opacity-60"
              style={{ minHeight: 52 }}
            >
              {claiming ? (
                "Einen Moment…"
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                  Ich habe die Überweisung getätigt
                </>
              )}
            </button>
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
