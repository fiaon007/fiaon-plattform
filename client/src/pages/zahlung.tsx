import { useState, useEffect, useCallback, useRef } from "react";
import { appViewport } from "@/lib/app-viewport";
import { useRoute } from "wouter";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import GlassNav from "@/components/GlassNav";
import "@/styles/dunkel.css";
import "@/styles/antrag-dunkel.css";
import PremiumFooter from "@/components/PremiumFooter";
import { buildEpcQrPayload } from "@/lib/epc-qr";
import { BANK } from "@shared/fiaon-bank";

// ============================================================================
// /zahlung/[payment_reference] — Zahlungsseite (SEPA-Vorkasse), v2
// Haupt-Baustein: EPC-QR (GiroCode) + "QR-Code speichern" (PNG-Export →
// Galerie-Upload in der Banking-App). KEIN "Alles kopieren"-Button.
// Tracking: "Ich habe die Überweisung getätigt" → claimed_paid (KEINE
// Freischaltung). Siehe MIGRATION_INVENTORY.md
// ============================================================================

interface PaymentOrder {
  /** 02.09.2026: Bestellung ODER Monatsrate — dieselbe Seite, derselbe QR-Code. */
  art?: "bestellung" | "rate";
  rateNr?: number;
  ratenVon?: number;
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
          className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-[12px] font-bold transition-all ${
            copied
              ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
              : "bg-blue-50 text-[#2563eb] border border-blue-100 hover:bg-blue-100"
          }`}
          style={{ minHeight: 42 }}
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

// Ruhige Vertrauens-Badges (SSL / SEPA / EU-Konto) — keine reißerischen Elemente
function TrustBadges() {
  const items = [
    {
      label: "SSL-verschlüsselt",
      icon: <path d="M12 3L4 7v6c0 5.5 3.8 10.7 8 12 4.2-1.3 8-6.5 8-12V7z" />,
    },
    {
      label: "SEPA-Überweisung",
      icon: <><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></>,
    },
    {
      label: "EU-Konto",
      icon: <><circle cx="12" cy="12" r="9" /><path d="M3.5 9h17M3.5 15h17M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></>,
    },
  ];
  return (
    <div className="flex items-center justify-center gap-4 sm:gap-6 flex-wrap">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{it.icon}</svg>
          {it.label}
        </span>
      ))}
    </div>
  );
}

/**
 * Der zweite Ausgang der Bestätigungsseite: einen Termin wählen.
 *
 * Holt das Buchungs-Token beim Server (die Seite kennt nur die
 * Zahlungsreferenz, nicht die Person — und darf sich kein Token selbst
 * ausstellen). Kommt keins zurück, verschwindet der Block wortlos: Ein
 * Angebot, das ins Leere führt, ist schlimmer als keines.
 */
function TerminAngebot({ paymentReference, art }: { paymentReference: string; art?: "bestellung" | "rate" }) {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let abgebrochen = false;
    void (async () => {
      const res = await fetch(`/api/fiaon/termin/onboarding/${encodeURIComponent(paymentReference)}`)
        .catch(() => null);
      const json = await res?.json().catch(() => null);
      if (!abgebrochen && json?.ok && json.token) setToken(String(json.token));
    })();
    return () => { abgebrochen = true; };
  }, [paymentReference]);

  // ── WEG 1 IST EIN KNOPF (22.08.2026, Justins Kundentest) ─────────────────
  // Die optisch dominante Kachel war ein totes <div>: kein Link, kein Ziel.
  // Jetzt scrollt sie zu den Zahlungsdaten — und sagt, was der Kunde davon
  // hat: „Konto sofort aktiv nach Zahlungseingang". Und sie steht auch dann,
  // wenn die Termin-API keinen Token liefert; nur Weg 2 hängt am Token.
  const zuDenZahlungsdaten = () => {
    const ziel = document.getElementById("zahlungsdaten");
    ziel?.scrollIntoView({ behavior: "smooth", block: "start" });
    ziel?.classList.add("zahlung-ziel-blitz");
    setTimeout(() => ziel?.classList.remove("zahlung-ziel-blitz"), 1400);
  };

  return (
    <div className="mb-6 grid sm:grid-cols-2 gap-3">
      <button type="button" onClick={zuDenZahlungsdaten}
              className="text-left p-4 rounded-2xl border-2 border-[#1d4ed8] bg-blue-50/40 active:scale-[.99] transition-transform"
              style={{ boxShadow: "0 10px 30px -14px rgba(29,78,216,.45)" }}>
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#1d4ed8] mb-1">Weg 1 · empfohlen</p>
        <p className="text-[14px] font-bold text-slate-900 leading-tight">{art === "rate" ? "Rate jetzt überweisen — in einer Minute erledigt" : "Jetzt überweisen — Konto sofort aktiv"}</p>
        <p className="text-[12.5px] text-slate-600 mt-1.5 leading-relaxed">
          {art === "rate"
            ? "Sobald die Überweisung eingeht, wird Ihre Rate automatisch verbucht. Tippen Sie hier — die Zahlungsdaten mit Ihrem Verwendungszweck springen Ihnen entgegen."
            : "Nach Zahlungseingang wird Ihr Konto freigeschaltet. Tippen Sie hier — die Zahlungsdaten mit Ihrem Verwendungszweck springen Ihnen entgegen."}
        </p>
        <span className="inline-flex items-center justify-center w-full mt-3 rounded-xl text-[13px] font-bold text-white"
              style={{ minHeight: 44, background: "linear-gradient(180deg,#2563eb,#1d4ed8)" }}>
          Zu den Zahlungsdaten
        </span>
      </button>
      {token && <div className="p-4 rounded-2xl border border-slate-200 bg-white">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Weg 2</p>
        <p className="text-[14px] font-bold text-slate-900 leading-tight">Wunschtermin buchen</p>
        <p className="text-[12.5px] text-slate-600 mt-1.5 leading-relaxed">
          Lieber erst sprechen? Wählen Sie eine Zeit — Ihr persönlicher Ansprechpartner ruft an.
        </p>
        <a href={`/termin/${token}`}
           className="inline-flex items-center justify-center w-full mt-3 rounded-xl text-[13px] font-bold text-slate-900 border border-slate-300 bg-white hover:bg-slate-50"
           style={{ minHeight: 44 }}>
          Termin wählen
        </a>
      </div>}
    </div>
  );
}

// ── Danke-Seite nach "Ich habe die Überweisung getätigt" ──────────────
export function ZahlungDankePage() {
  return (
    <div className="antrag-dk dk min-h-screen antialiased">
      <div className="dk-grund" aria-hidden="true"><span className="dk-nebel a" /><span className="dk-nebel b" /><span className="dk-nebel c" /></div>
      <GlassNav />
      <div className="relative z-10 max-w-xl mx-auto px-4 sm:px-6 pt-28 sm:pt-32 pb-16">
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight zahlung-shimmer-heading mb-4">Danke!</h1>
          <p className="text-[15px] text-slate-600 leading-relaxed max-w-md mx-auto">
            Wir prüfen Ihren Zahlungseingang. Sobald er da ist – meist innerhalb von 24 Stunden – schalten wir Ihr
            Konto frei und Sie bekommen eine E-Mail. Sie müssen nichts weiter tun.
          </p>
          <div className="mt-10">
            <TrustBadges />
          </div>
        </div>
      </div>
      <PremiumFooter />
      <style>{ZAHLUNG_STYLES}</style>
    </div>
  );
}

// Dezent animierter Gradient-Shimmer für Überschriften (edel, langsam).
// prefers-reduced-motion → Animation aus, statischer Gradient bleibt.
const ZAHLUNG_STYLES = `
  .zahlung-ziel-blitz { box-shadow: 0 0 0 4px rgba(37,99,235,.25), 0 18px 40px -18px rgba(37,99,235,.5) !important; transition: box-shadow .3s; }

  .zahlung-shimmer-heading{
    background:linear-gradient(110deg,#0f172a 0%,#1d4ed8 30%,#60a5fa 50%,#1d4ed8 70%,#0f172a 100%);
    background-size:220% auto;
    -webkit-background-clip:text;background-clip:text;
    -webkit-text-fill-color:transparent;color:transparent;
    animation:zahlungShimmer 7s ease-in-out infinite;
  }
  @keyframes zahlungShimmer{0%{background-position:0% center}50%{background-position:100% center}100%{background-position:0% center}}
  @media (prefers-reduced-motion: reduce){.zahlung-shimmer-heading{animation:none}}
  @keyframes zahlungFadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}

  /* Tracking-Button: animierter Farbverlaufs-Rahmen + glänzender Verlauf im Button */
  .zahlung-claim-wrap{
    position:relative;padding:3px;border-radius:9999px;
    background:linear-gradient(115deg,#059669,#10b981,#3b82f6,#10b981,#059669);
    background-size:300% 300%;
    animation:zahlungClaimBorder 5s ease infinite;
    box-shadow:0 12px 34px -8px rgba(16,185,129,.55);
  }
  @keyframes zahlungClaimBorder{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
  .zahlung-claim-btn{
    background:linear-gradient(115deg,#047857,#059669,#10b981,#059669,#047857);
    background-size:300% 300%;
    animation:zahlungClaimBorder 5s ease infinite;
  }
  .zahlung-claim-btn:hover{transform:translateY(-2px);filter:brightness(1.06)}
  @media (prefers-reduced-motion: reduce){
    .zahlung-claim-wrap,.zahlung-claim-btn{animation:none}
    .zahlung-claim-wrap{background:#059669}
    .zahlung-claim-btn{background:linear-gradient(115deg,#047857,#10b981)}
  }
`;

export default function ZahlungPage() {
  const [, params] = useRoute("/zahlung/:paymentRef");
  const paymentRef = params?.paymentRef || "";
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // QR-Speichern
  const [qrSaved, setQrSaved] = useState<null | "shared" | "downloaded">(null);
  useEffect(() => appViewport(), []);
  const exportWrapRef = useRef<HTMLDivElement>(null);

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

  const qrPayload = order
    ? buildEpcQrPayload({
        recipient: order.bank.recipient,
        iban: order.bank.iban,
        bic: order.bank.bic,
        amount,
        remittance: order.paymentReference,
      })
    : "";

  // "QR-Code speichern": exportiert NUR das QR-Bild als PNG (hochauflösendes
  // verstecktes Canvas mit Quiet Zone) — kein Bildschirm-Screenshot.
  const handleSaveQr = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!order) return;
      const canvas = exportWrapRef.current?.querySelector("canvas");
      if (!canvas) return;
      const fileName = `FIAON-Ueberweisung-${order.paymentReference}.png`;

      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) return;

      // Mobile: Web Share API mit Bilddatei (→ "In Fotos sichern")
      try {
        const file = new File([blob], fileName, { type: "image/png" });
        if (typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file] });
          setQrSaved("shared");
          return;
        }
      } catch (err: any) {
        // Nutzer hat das Share-Sheet abgebrochen → keine Bestätigung, kein Fehler
        if (err?.name === "AbortError") return;
      }

      // Fallback: PNG-Download
      try {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        setQrSaved("downloaded");
      } catch {}
    },
    [order],
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
    <div className="antrag-dk dk min-h-screen antialiased">
      <div className="dk-grund" aria-hidden="true"><span className="dk-nebel a" /><span className="dk-nebel b" /><span className="dk-nebel c" /></div>
      <GlassNav />

      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 pt-28 sm:pt-32 pb-16">
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
              {order.firstName ? `${order.firstName}, Ihre` : "Ihre"} Zahlung ist bei uns eingegangen — Ihr Konto ist aktiv und Ihre Karte ist unterwegs.
            </p>
          </div>
        )}

        {!loading && order && order.status !== "paid" && (
          <div style={{ animation: "zahlungFadeUp .4s ease" }}>
            {/* 1. Headline mit dezentem Gradient-Shimmer */}
            <div className="text-center mb-6">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight zahlung-shimmer-heading mb-3 leading-tight pb-1">
                {order.art === "rate" ? `Ihre Monatsrate ${order.rateNr ?? ""} von ${order.ratenVon ?? 12}` : "Letzter Schritt: Konto aktivieren"}
              </h1>
              {/* 2. Statuszeile */}
              <p className="text-[13px] sm:text-[14px] text-slate-500">
                {order.art === "rate"
                  ? <>Fällig am <b className="text-slate-900">{dueDateStr}</b> — Ihr Verwendungszweck: <b className="text-slate-900">{order.paymentReference}</b></>
                  : <>Ihr Platz ist bis zum <b className="text-slate-900">{dueDateStr}</b> reserviert.</>}
              </p>
              {order.firstName && (
                <p className="text-[12px] text-slate-400 mt-1.5">
                  {order.firstName}
                  {order.packName ? ` · ${order.packName.replace(/\n/g, " ")}` : ""} · {order.paymentReference}
                </p>
              )}
              <div className="mt-4">
                <TrustBadges />
              </div>
            </div>

            {/* ── ZWEI GLEICHWERTIGE WEGE ────────────────────────────────────
                Bisher gab es hier genau einen Ausgang: bezahlen. Wer das nicht
                sofort tun wollte oder konnte, schloss den Tab — und wurde
                danach viermal vergeblich angerufen. Der Terminweg ist kein
                Ausweichgleis, sondern der zweite richtige Ausgang. Deshalb
                steht er gleichrangig oben, nicht als Kleingedrucktes unten. */}
            <TerminAngebot paymentReference={order.paymentReference} art={order.art} />

            {order.status === "claimed_paid" && (
              <div className="mb-5 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-center">
                <p className="text-[13px] font-semibold text-emerald-700">
                  Danke! Wir prüfen Ihren Zahlungseingang – meist innerhalb von 24 Stunden. Sie bekommen eine E-Mail, sobald Ihr Konto frei ist.
                </p>
              </div>
            )}

            {order.status === "expired" && (
              <div className="mb-5 rounded-xl bg-red-50 border border-red-100 p-4 text-center">
                <p className="text-[13px] font-semibold text-red-600">
                  Die Zahlungsfrist ist abgelaufen. Bitte kontaktieren Sie unseren Support, um Ihren Antrag zu reaktivieren.
                </p>
              </div>
            )}

            {/* 3. Erklär-Box: So bezahlen Sie – ganz einfach */}
            <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5 sm:p-6 mb-5">
              <p className="text-[16px] sm:text-[17px] font-bold zahlung-shimmer-heading mb-4 inline-block">{order.art === "rate" ? "Rate überweisen – ganz einfach" : <>Konto aktivieren &amp; Karte versenden – ganz einfach</>}</p>

              <p className="text-[12px] font-bold uppercase tracking-wider text-[#2563eb] mb-2.5">Empfohlen (schnell &amp; fehlerfrei)</p>
              <ol className="space-y-2.5 mb-5">
                <li className="flex gap-3 text-[13.5px] sm:text-[14px] text-slate-700 leading-relaxed">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-[#2563eb] text-white text-[12px] font-bold flex items-center justify-center">1</span>
                  <span>Tippen Sie unten auf <b>„QR-Code speichern"</b> – der Code wird in Ihrer Foto-Galerie gespeichert.</span>
                </li>
                <li className="flex gap-3 text-[13.5px] sm:text-[14px] text-slate-700 leading-relaxed">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-[#2563eb] text-white text-[12px] font-bold flex items-center justify-center">2</span>
                  Öffnen Sie Ihre Banking-App und starten Sie eine neue Überweisung.
                </li>
                <li className="flex gap-3 text-[13.5px] sm:text-[14px] text-slate-700 leading-relaxed">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-[#2563eb] text-white text-[12px] font-bold flex items-center justify-center">3</span>
                  <span>
                    Wähle dort <b>„Rechnung fotografieren"</b> oder <b>„QR-Code aus Galerie"</b> und lade den gespeicherten
                    Code hoch. Alle Daten – auch Ihr persönlicher Code – werden automatisch ausgefüllt.
                    <span className="hidden sm:inline"> Oder scannen Sie den Code unten einfach mit Ihrer Banking-App am Handy.</span>
                  </span>
                </li>
              </ol>

              <p className="text-[12px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Alternativ (von Hand)</p>
              <p className="text-[13px] text-slate-600 leading-relaxed">
                Sie können die Daten auch einzeln unten kopieren und selbst eintragen. Wichtig: Tragen Sie dabei den Code{" "}
                <b className="text-slate-900">{order.paymentReference}</b> als Verwendungszweck ein.
              </p>
            </div>

            {/* 4. HAUPT-BAUSTEIN: QR-Code (GiroCode) + "QR-Code speichern" */}
            <div id="zahlungsdaten" className="rounded-2xl border border-slate-200 bg-slate-50/60 p-6 sm:p-8 mb-5 text-center" style={{ scrollMarginTop: 96 }}>
              {/* Immer heller Hintergrund hinter dem QR (Scanbarkeit, auch Darkmode) */}
              <div className="inline-block p-4 rounded-2xl border border-slate-200 shadow-sm mb-4" style={{ background: "#ffffff" }}>
                <QRCodeSVG value={qrPayload} size={190} level="M" marginSize={2} bgColor="#ffffff" fgColor="#0f172a" />
              </div>
              <p className="text-[12px] text-slate-500 mb-4">
                GiroCode — enthält Empfänger, IBAN, Betrag und Ihren persönlichen Verwendungszweck.
              </p>

              <button
                type="button"
                onClick={handleSaveQr}
                className={`w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-full py-4 px-8 font-semibold text-[15px] sm:text-[16px] transition-all duration-300 ${
                  qrSaved
                    ? "bg-emerald-600 text-white shadow-xl shadow-emerald-500/30"
                    : "fiaon-btn-gradient text-white shadow-xl shadow-blue-500/30 hover:shadow-2xl hover:shadow-blue-600/40 hover:-translate-y-0.5"
                }`}
                style={{ minHeight: 56 }}
              >
                {qrSaved ? (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                    QR-Code gespeichert ✓
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                    QR-Code speichern
                  </>
                )}
              </button>
              {qrSaved === "shared" && (
                <p className="mt-3 text-[13px] font-semibold text-emerald-600">
                  QR-Code gespeichert – öffnen Sie jetzt Ihre Banking-App und laden Sie ihn dort hoch.
                </p>
              )}
              {qrSaved === "downloaded" && (
                <p className="mt-3 text-[13px] font-semibold text-emerald-600">
                  Das Bild wurde gespeichert – Sie finden es in Ihren Downloads/Fotos. Öffnen Sie jetzt Ihre Banking-App und laden Sie es dort hoch.
                </p>
              )}

              {/* Verstecktes hochauflösendes Export-Canvas (nur QR + Quiet Zone) */}
              <div ref={exportWrapRef} aria-hidden="true" style={{ position: "absolute", left: -9999, top: -9999, width: 0, height: 0, overflow: "hidden" }}>
                <QRCodeCanvas value={qrPayload} size={640} level="M" marginSize={4} bgColor="#ffffff" fgColor="#000000" />
              </div>
            </div>

            {/* 5. Bankdaten einzeln (Alternativ-Weg) */}
            <div id="bankdaten" className="space-y-2.5 mb-5" style={{ scrollMarginTop: 96 }}>
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
                hint="Ohne diesen Code können wir Ihre Zahlung nicht zuordnen."
              />
            </div>

            {/* 6. IBAN-Herkunft-Hinweis */}
            <div className="rounded-xl bg-blue-50/70 border border-blue-100 p-4 sm:p-5 mb-4">
              <p className="text-[13px] text-slate-600 leading-relaxed">
                Ihre Überweisung geht an unser Geschäftskonto bei {BANK.bank} (die IBAN beginnt mit {BANK.iban.slice(0, 2)}). Das
                ist eine ganz normale SEPA-Überweisung – kostenlos und in der Regel innerhalb eines Bankarbeitstages,
                genau wie eine Inlandsüberweisung.
              </p>
            </div>

            {/* 7. Vertrauens-Absatz */}
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 sm:p-5 mb-6">
              <p className="text-[13px] text-slate-600 leading-relaxed">
                <b className="text-slate-800">Warum Überweisung?</b> Sie behalten die volle Kontrolle: keine
                automatischen Kartenabbuchungen, keine gespeicherten Zahlungsdaten. Sie entscheiden bei jeder Zahlung
                selbst.
              </p>
            </div>

            {order.art === "rate" ? (
              <p className="text-center text-[13px] text-slate-500 mt-2 px-2">
                Sobald Ihre Überweisung mit diesem Verwendungszweck eingeht, wird die Rate automatisch verbucht — Sie müssen nichts weiter tun.
              </p>
            ) : (<>
            {/* 8. Tracking-Button: Ich habe die Überweisung getätigt (präsent, animierter Rahmen) */}
            <div className="zahlung-claim-wrap">
              <button
                type="button"
                onClick={handleClaimPaid}
                disabled={claiming}
                className="zahlung-claim-btn w-full inline-flex items-center justify-center gap-2.5 rounded-full py-5 px-6 text-[15px] sm:text-[17px] font-bold text-white transition-all disabled:opacity-60"
                style={{ minHeight: 60 }}
              >
                {claiming ? (
                  "Einen Moment…"
                ) : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                    Ich habe die Überweisung getätigt
                  </>
                )}
              </button>
            </div>
            <p className="text-center text-[12px] text-slate-400 mt-2.5">
              Bitte erst tippen, wenn Sie die Überweisung in Ihrer Banking-App abgeschickt haben.
            </p>
            </>)}
          </div>
        )}
      </div>

      <PremiumFooter />

      <style>{ZAHLUNG_STYLES}</style>
    </div>
  );
}
