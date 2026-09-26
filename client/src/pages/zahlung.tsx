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
import { ZAHLUNG_WOERTER, type ZahlungWorte } from "@/i18n/zahlung";
import { ZAHLUNG_AUSKUNFT, type AuskunftSicht } from "@/i18n/zahlung-auskunft";

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
  // 19.09.2026 (E-194): sofortUrl/sofortVorrang sind weg — die Sofortzahlung per
  // Bank-App lief über GoCardless und ist beendet. Bezahlt wird per Überweisung.
  paymentReference: string;
  status: string;
  dueDate: string;
  amountDue: string;
  currency: string;
  firstName: string;
  packName: string;
  /**
   * E-188 (17.09.2026): Firmenauftrag über FIAON Global — Einmalpreis von 2.499 bis 35.999 €.
   * Die Seite spricht dann das Unternehmen an und lässt weg, was nur für das Privatpaket
   * stimmt: „Konto aktivieren", „Karte", Startgespräch-Kachel.
   */
  firmenauftrag?: boolean;
  firmenName?: string;
  /** Nur beim Firmenauftrag: die Sprache des Auftrags (/en/business/start → "en"). */
  sprache?: "de" | "en";
  /**
   * E-243 (26.09.2026): eine Bonitätsauskunft — Einmalkauf, kein Konto, das „aktiviert"
   * wird, keine Karte „unterwegs", kein Startgespräch. Die Seite spricht dann nur von der
   * Auskunft (Sätze in client/src/i18n/zahlung-auskunft.ts); Bankdaten, GiroCode und
   * Verwendungszweck bleiben dieselben (eine Quelle: shared/fiaon-bank.ts).
   */
  produkt?: "auskunft";
  auskunftArt?: "privat" | "firma";
  land?: "DE" | "AT" | "CH";
  auskunfteien?: string;
  /** Läuft heute ein bezahltes Paket? Nur ohne Paket zeigt die Dankeseite „Ihr nächster Schritt zur Karte". */
  mitAbo?: boolean;
  kundenpreis?: boolean;
  beginnAb?: string;
  /** Gegenlese E-243: Welcher Hinweis zur Karte auf der Dankeseite — null = keiner (Server, dieselbe Regel wie „Ihre Auskunft ist da"). */
  paketSchritt?: "neu" | "antrag" | null;
  bank: { recipient: string; iban: string; ibanDisplay: string; bic: string };
}

/** Die Sicht der Auskunft-Sätze aus der Antwort des Servers — null, wenn es keine Auskunft ist. */
function auskunftSicht(o: Partial<PaymentOrder> | null | undefined): AuskunftSicht | null {
  if (!o || o.produkt !== "auskunft") return null;
  return { art: o.auskunftArt === "firma" ? "firma" : "privat", auskunfteien: o.auskunfteien ?? null, beginnAb: o.beginnAb ?? null };
}

// E-188: Das kleine Wörterbuch der Seite (deutsch = Bestand, englisch nur für den Firmenauftrag,
// der auf /en/business/start unterschrieben wurde) liegt im Hausmuster unter client/src/i18n/zahlung.ts.
const WORTE = ZAHLUNG_WOERTER;
type Worte = ZahlungWorte;

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

function CopyField({ label, display, copyValue, highlight, hint, w = WORTE.de }: { label: string; display: string; copyValue: string; highlight?: boolean; hint?: string; w?: Worte }) {
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
          aria-label={w.kopierenLabel(label)}
        >
          {copied ? (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
              {w.kopiert}
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
              {w.kopieren}
            </>
          )}
        </button>
      </div>
      {hint && <p className="mt-1.5 text-[11px] text-amber-700 font-medium">{hint}</p>}
    </div>
  );
}

// Ruhige Vertrauens-Badges (SSL / SEPA / EU-Konto) — keine reißerischen Elemente
function TrustBadges({ w = WORTE.de, labels }: { w?: Worte; labels?: readonly [string, string, string] }) {
  // E-243: Die Auskunft trägt als drittes Siegel „Einmalig, kein Abo" statt „EU-Konto" —
  // Auskunft-Käufer sollen auf ihrer Seite kein „Konto" lesen (siehe zahlung-auskunft.ts).
  const b = labels ?? w.badges;
  const items = [
    {
      label: b[0],
      icon: <path d="M12 3L4 7v6c0 5.5 3.8 10.7 8 12 4.2-1.3 8-6.5 8-12V7z" />,
    },
    {
      label: b[1],
      icon: <><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></>,
    },
    {
      label: b[2],
      // Gegenlese E-243: „Einmalig, kein Abo" trägt einen Haken — der Globus gehört zu „EU-Konto".
      icon: labels
        ? <><circle cx="12" cy="12" r="9" /><polyline points="8 12.5 11 15.5 16.5 9.5" /></>
        : <><circle cx="12" cy="12" r="9" /><path d="M3.5 9h17M3.5 15h17M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></>,
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

  // ── EINE FARBFAMILIE, EIN HAUPTKNOPF (02.09.2026, Justin) ──────────────
  // Vorher stand der schnellste Weg in Smaragdgrün auf dem Navy-Glas — eine
  // Fremdfarbe, die aus dem Blau-System ausbricht. Justin: „das Grün auf
  // Dunkelblau gefällt mir nicht". Es gibt genau einen gefüllten Knopf; der
  // Termin trägt nur eine ruhige Kante.
  // 19.09.2026 (E-194): Die zweite Kachel „Sofort per Bank-App bezahlen" ist
  // weg — sie lief über GoCardless, und die Zusammenarbeit ist beendet. Die
  // Überweisung ist der eine Weg.
  const knopfGefuellt = "inline-flex items-center justify-center w-full mt-3 rounded-xl text-[13px] font-bold text-white";
  const stilGefuellt = { minHeight: 44, background: "linear-gradient(180deg,#3b82f6,#1d4ed8)", boxShadow: "0 8px 22px -10px rgba(29,78,216,.8)" };

  const kachelFuehrend = {
    border: "1px solid rgba(147,197,253,.55)",
    background: "linear-gradient(160deg, rgba(37,99,235,.16), rgba(29,78,216,.06))",
    boxShadow: "0 16px 40px -18px rgba(37,99,235,.65)",
  };

  const ueberweisungKachel = (
    <button key="ueberweisung" type="button" onClick={zuDenZahlungsdaten}
            className="sm:col-span-2 text-left p-4 rounded-2xl active:scale-[.99] transition-transform"
            style={kachelFuehrend}>
      <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "#2563eb" }}>
        Per Überweisung
      </p>
      <p className="text-[15px] font-bold text-slate-900 leading-tight">{art === "rate" ? "Rate jetzt überweisen — in einer Minute erledigt" : "Jetzt überweisen — Konto sofort aktiv"}</p>
      <p className="text-[12.5px] text-slate-600 mt-1.5 leading-relaxed">
        {art === "rate"
          ? "Sobald die Überweisung eingeht, wird Ihre Rate automatisch verbucht. Tippen Sie hier — die Zahlungsdaten mit Ihrem Verwendungszweck springen Ihnen entgegen."
          : "Nach Zahlungseingang wird Ihr Konto freigeschaltet. Tippen Sie hier — die Zahlungsdaten mit Ihrem Verwendungszweck springen Ihnen entgegen."}
      </p>
      <span className={knopfGefuellt} style={stilGefuellt}>
        Zu den Zahlungsdaten
      </span>
    </button>
  );

  return (
    <div className="mb-6 grid sm:grid-cols-2 gap-3">
      {ueberweisungKachel}
      {/* „Weg 2" hieß der Termin, solange es einen nummerierten Weg 1 gab. Den
          gibt es seit dem Umbau nicht mehr — die Nummer zeigte auf nichts. */}
      {token && <div className="p-4 rounded-2xl border border-slate-200 bg-white">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Lieber erst sprechen</p>
        <p className="text-[14px] font-bold text-slate-900 leading-tight">Wunschtermin buchen</p>
        <p className="text-[12.5px] text-slate-600 mt-1.5 leading-relaxed">
          Wählen Sie eine Zeit — Ihr persönlicher Ansprechpartner ruft an.
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

// ── DIE AUSKUNFT: KURZFASSUNG STATT „KONTO SOFORT AKTIV" (26.09.2026, E-243) ─────
// Bei einer Bonitätsauskunft steht oben nicht die Kachel „Jetzt überweisen — Konto
// sofort aktiv" und keine Startgespräch-Kachel (die Auskunft hat kein Startgespräch;
// fiaon-kontostufe.ts nimmt sie aus). Stattdessen: was nach der Überweisung passiert,
// in drei Schritten, und EIN gefüllter Knopf zu den Zahlungsdaten — dieselbe
// Farbfamilie wie die Kachel der Pakete (Justin 02.09.: ein Hauptknopf, Blau).
function zuDenZahlungsdatenScrollen() {
  const ziel = document.getElementById("zahlungsdaten");
  ziel?.scrollIntoView({ behavior: "smooth", block: "start" });
  ziel?.classList.add("zahlung-ziel-blitz");
  setTimeout(() => ziel?.classList.remove("zahlung-ziel-blitz"), 1400);
}

function AuskunftKurzfassung({ sicht }: { sicht: AuskunftSicht }) {
  const t = ZAHLUNG_AUSKUNFT;
  return (
    <div className="zahlung-auskunft-kurz mb-6 p-5 sm:p-6 rounded-2xl text-left"
         style={{
           border: "1px solid rgba(147,197,253,.55)",
           background: "linear-gradient(160deg, rgba(37,99,235,.16), rgba(29,78,216,.06))",
           boxShadow: "0 16px 40px -18px rgba(37,99,235,.65)",
         }}>
      <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "#2563eb" }}>{t.kurzfassungTitel}</p>
      <p className="text-[14px] sm:text-[15px] font-semibold text-slate-900 leading-relaxed">{t.kurzfassung(sicht)}</p>
      <ol className="mt-4 space-y-3">
        {t.schritte(sicht).map((x, i) => (
          <li key={x.titel} className="flex gap-3">
            <span className="shrink-0 w-6 h-6 rounded-full bg-[#2563eb] text-white text-[12px] font-bold flex items-center justify-center">{i + 1}</span>
            <span className="text-[13px] sm:text-[13.5px] text-slate-600 leading-relaxed"><b className="text-slate-900">{x.titel}</b> — {x.text}</span>
          </li>
        ))}
      </ol>
      <button type="button" onClick={zuDenZahlungsdatenScrollen}
              className="inline-flex items-center justify-center w-full mt-4 rounded-xl text-[13px] font-bold text-white"
              style={{ minHeight: 44, background: "linear-gradient(180deg,#3b82f6,#1d4ed8)", boxShadow: "0 8px 22px -10px rgba(29,78,216,.8)" }}>
        {t.zuDenZahlungsdaten}
      </button>
    </div>
  );
}

/**
 * Die Dankeseite der Auskunft (26.09.2026, E-243): was als Nächstes kommt — und nur für
 * Menschen OHNE laufendes Paket ein ruhiger Hinweis „Ihr nächster Schritt zur Karte".
 * Der Hinweis erscheint nur, wenn der Server sicher „kein Paket" gesagt hat; im Zweifel
 * (Seite noch nicht geladen, Fehler) bleibt er weg. Gegenlese E-243: Ob und welcher, sagt
 * paketSchritt — dieselben Sperren wie „Ihre Auskunft ist da" (Kündigung, Storno, Sperre;
 * offener Paket-Antrag → kein zweiter Antrag, nur der Hinweis auf die erste Zahlung).
 */
function AuskunftDanke({ sicht, geladen, paketSchritt }: { sicht: AuskunftSicht; geladen: boolean; paketSchritt: "neu" | "antrag" | null }) {
  const t = ZAHLUNG_AUSKUNFT.danke;
  const weiter = paketSchritt ? t.weiter(sicht.art, paketSchritt) : null;
  return (
    <div className="py-10 sm:py-14">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight zahlung-shimmer-heading mb-4">{t.titel}</h1>
        <p className="text-[15px] text-slate-600 leading-relaxed max-w-md mx-auto">{t.lead(sicht.art)}</p>
      </div>

      {geladen && (
        <div className="zahlung-auskunft-danke mt-8 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 text-left" style={{ animation: "zahlungFadeUp .4s ease" }}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#2563eb] mb-3">{t.wasKommt}</p>
          <ol className="space-y-3">
            {t.schritte(sicht).map((x, i) => (
              <li key={x.titel} className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-[#2563eb] text-white text-[12px] font-bold flex items-center justify-center">{i + 1}</span>
                <span className="text-[13.5px] text-slate-600 leading-relaxed"><b className="text-slate-900">{x.titel}</b> — {x.text}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {geladen && weiter && (
        <div className="zahlung-auskunft-weiter mt-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-5 sm:p-6 text-left" style={{ animation: "zahlungFadeUp .5s ease" }}>
          <p className="text-[14px] font-bold text-slate-900 mb-1.5">{weiter.titel}</p>
          <p className="text-[13px] text-slate-600 leading-relaxed">{weiter.text}</p>
          {weiter.ziel && weiter.knopf && (
            <a href={weiter.ziel}
               className="inline-flex items-center justify-center mt-4 px-5 rounded-xl text-[13px] font-bold text-slate-900 border border-slate-300 bg-white hover:bg-slate-50"
               style={{ minHeight: 44 }}>
              {weiter.knopf}
            </a>
          )}
        </div>
      )}

      <div className="mt-10">
        <TrustBadges labels={ZAHLUNG_AUSKUNFT.badges} />
      </div>
    </div>
  );
}

// ── Danke-Seite nach "Ich habe die Überweisung getätigt" ──────────────
export function ZahlungDankePage() {
  // E-188: Der Firmenauftrag kommt mit ?art=firma — dort wird kein Konto freigeschaltet, dort beginnt ein Projekt.
  const firma = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("art") === "firma";
  // … und mit &sprache=en, wenn der Auftrag englisch geführt wurde (Feld `sprache` der Zahlungsseite).
  const englisch = firma && new URLSearchParams(window.location.search).get("sprache") === "en";
  // ── E-243 (26.09.2026): DIE AUSKUNFT HAT IHRE EIGENE DANKESEITE ──────────────
  // Die Zahlungsseite schickt ?art=auskunft (&typ=firma) — so steht der richtige Satz
  // sofort da. Was als Nächstes kommt (Auskunfteien des Landes) und ob ein Paket läuft,
  // liest die Seite beim Server nach (dieselbe öffentliche Antwort wie die Zahlungsseite).
  // Auch ohne Adress-Marke (alte Links) erkennt sie eine Auskunft an der Antwort.
  const [, dankeParams] = useRoute("/zahlung/:paymentRef/danke");
  const dankeRef = dankeParams?.paymentRef || "";
  const suche = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const auskunftAdresse = !firma && suche.get("art") === "auskunft";
  const [dankeOrder, setDankeOrder] = useState<PaymentOrder | null>(null);
  const [dankeGeladen, setDankeGeladen] = useState(false);
  useEffect(() => {
    if (firma || !dankeRef) { setDankeGeladen(true); return; }
    let ab = false;
    void (async () => {
      const res = await fetch(`/api/fiaon/payment-order/${encodeURIComponent(dankeRef)}`).catch(() => null);
      const json = await res?.json().catch(() => null);
      if (ab) return;
      if (res?.ok && json?.ok) setDankeOrder(json);
      setDankeGeladen(true);
    })();
    return () => { ab = true; };
  }, [firma, dankeRef]);
  const auskunft: AuskunftSicht | null = auskunftSicht(dankeOrder)
    ?? (auskunftAdresse ? { art: suche.get("typ") === "firma" ? "firma" : "privat", auskunfteien: null, beginnAb: null } : null);
  if (auskunft) {
    return (
      <div className="antrag-dk dk min-h-screen antialiased">
        <div className="dk-grund" aria-hidden="true"><span className="dk-nebel a" /><span className="dk-nebel b" /><span className="dk-nebel c" /></div>
        <GlassNav />
        <div className="relative z-10 max-w-xl mx-auto px-4 sm:px-6 pt-28 sm:pt-32 pb-16">
          <AuskunftDanke sicht={auskunft} geladen={dankeGeladen}
                         paketSchritt={dankeOrder?.produkt === "auskunft" && dankeOrder.mitAbo === false ? (dankeOrder.paketSchritt ?? null) : null} />
        </div>
        <PremiumFooter />
        <style>{ZAHLUNG_STYLES}</style>
      </div>
    );
  }
  // 19.09.2026: Der Firmenauftrag steht hell im Rahmen von FIAON Global (siehe ZahlungPage).
  return (
    <div className={firma ? "zahlung-business min-h-screen antialiased" : "antrag-dk dk min-h-screen antialiased"} lang={englisch ? "en" : undefined}>
      {!firma && <div className="dk-grund" aria-hidden="true"><span className="dk-nebel a" /><span className="dk-nebel b" /><span className="dk-nebel c" /></div>}
      <GlassNav bereich={firma ? "business" : undefined} />
      <div className="relative z-10 max-w-xl mx-auto px-4 sm:px-6 pt-28 sm:pt-32 pb-16">
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight zahlung-shimmer-heading mb-4">{englisch ? "Thank you!" : "Danke!"}</h1>
          <p className="text-[15px] text-slate-600 leading-relaxed max-w-md mx-auto">
            {englisch
              ? "We are checking for your payment. As soon as it has been recorded, your order begins: you will receive an email with your contact and the list of documents. There is nothing more you need to do."
              : firma
              ? "Wir prüfen Ihren Zahlungseingang. Sobald er gebucht ist, beginnt Ihr Auftrag: Sie erhalten eine E-Mail mit Ihrem Ansprechpartner und der Liste der Unterlagen. Sie müssen nichts weiter tun."
              : <>Wir prüfen Ihren Zahlungseingang. Sobald er da ist – meist innerhalb von 24 Stunden – schalten wir Ihr
                Konto frei und Sie bekommen eine E-Mail. Sie müssen nichts weiter tun.</>}
          </p>
          <div className="mt-10">
            <TrustBadges w={englisch ? WORTE.en : WORTE.de} />
          </div>
        </div>
      </div>
      <PremiumFooter bereich={firma ? "business" : undefined} />
      <style>{ZAHLUNG_STYLES}</style>
    </div>
  );
}

// Dezent animierter Gradient-Shimmer für Überschriften (edel, langsam).
// prefers-reduced-motion → Animation aus, statischer Gradient bleibt.
//
// ── DER VERLAUF MUSS ZUR BÜHNE PASSEN (02.09.2026) ─────────────────────────
// Er begann und endete auf #0f172a. Die Zahlungsseite steht aber auf der
// dunklen Bühne mit dem Grund rgb(10,22,40) — praktisch dieselbe Farbe. Die
// Enden der Überschrift waren damit unsichtbar: „Letzter Schritt: Konto
// aktivieren" las sich als „Letzter Schritt: Konto", das letzte Wort löste
// sich im Hintergrund auf, und weil der Verlauf wandert, wechselte auch noch,
// welches Wort gerade verschwand. Betraf alle drei Überschriften der Seite.
// Jetzt läuft er zwischen hellen Tönen — sichtbar bleibt er in jeder Phase.
const ZAHLUNG_STYLES = `
  /* Firmenauftrag (FIAON Global): hell, Kanzlei-Ton — die Farben wie client/src/styles/global.css */
  .zahlung-business{background:#f5f7fa;color:#0c1a2e;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
  .zahlung-business .zahlung-shimmer-heading{background:none;-webkit-text-fill-color:#0c1a2e;color:#0c1a2e;animation:none;
    font-family:'Newsreader','Iowan Old Style',Georgia,serif;font-weight:400;letter-spacing:-.01em}
  .zahlung-business h1.zahlung-shimmer-heading{font-size:clamp(28px,4vw,38px)}
  .zahlung-business .fiaon-btn-gradient{background:#12284a!important;box-shadow:0 10px 24px rgba(18,40,74,.18)!important;border-radius:10px!important}
  .zahlung-business .zahlung-claim-wrap{background:#12284a;animation:none;box-shadow:0 10px 24px rgba(18,40,74,.18);border-radius:12px;padding:0}
  .zahlung-business .zahlung-claim-btn{background:#12284a;animation:none;border-radius:12px}
  .zahlung-business .zahlung-claim-btn:hover{background:#0b1c36;filter:none}
  .zahlung-business .text-\\[\\#2563eb\\]{color:#12284a}
  .zahlung-business .bg-\\[\\#2563eb\\]{background:#12284a}

  .zahlung-ziel-blitz { box-shadow: 0 0 0 4px rgba(37,99,235,.25), 0 18px 40px -18px rgba(37,99,235,.5) !important; transition: box-shadow .3s; }

  .zahlung-shimmer-heading{
    background:linear-gradient(110deg,#e2e8f0 0%,#93c5fd 30%,#ffffff 50%,#93c5fd 70%,#e2e8f0 100%);
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
  // E-243: Bonitätsauskunft → eigene Sätze, keine Paket-Sätze („Konto aktivieren", „Karte", Startgespräch).
  const auskunft = auskunftSicht(order);
  const ta = ZAHLUNG_AUSKUNFT;
  // Gegenlese E-243: Eine stornierte, ersetzte oder abgelaufene Auskunft zeigt keine Zahlungsdaten mehr —
  // sonst überweist jemand auf eine stornierte Bestellung oder zu einem Preis, der nicht mehr gilt.
  // Abgelaufen führt direkt zur neuen Bestellung (der Server setzt den Preis dort neu).
  const auskunftNichtOffen = !!auskunft && (order?.status === "cancelled" || order?.status === "superseded" || order?.status === "expired");
  // E-188: Englisch nur für den Firmenauftrag, dessen Auftrag englisch geführt wurde — sonst wörtlich der Bestand.
  const englisch = !!order?.firmenauftrag && order.sprache === "en";
  const w: Worte = englisch ? WORTE.en : WORTE.de;
  const dueDateStr = order
    ? (englisch
      ? new Date(order.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
      : new Date(order.dueDate).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }))
    : "";
  const betragText = amount.toLocaleString(w.zahlen, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
      // 19.09.2026: Der Firmenauftrag bleibt auch auf der Dankeseite im Rahmen von FIAON Global (lib/bereich.ts).
      // E-243: Die Auskunft hat ihre eigene Dankeseite (?art=auskunft, bei Firmen &typ=firma).
      const auskunftMarke = order.produkt === "auskunft" ? `?art=auskunft${order.auskunftArt === "firma" ? "&typ=firma" : ""}` : "";
      window.location.href = `/zahlung/${order.paymentReference}/danke${order.firmenauftrag ? `?art=firma&bereich=business${order.sprache === "en" ? "&sprache=en" : ""}` : auskunftMarke}`;
    },
    [order, claiming],
  );

  // ── FIRMENAUFTRAG: HELL IM RAHMEN VON FIAON GLOBAL (19.09.2026) ──────────
  // Die Seite ist hell gebaut (Tailwind-Klassen) und wird erst durch .antrag-dk dunkel. Beim
  // Firmenauftrag fällt diese Klasse weg: heller Grund, Serifen-Überschrift, ruhige Navy-Knöpfe —
  // wie die Seiten von FIAON Global. ?bereich=business (Links aus Auftrag und Mails) schaltet
  // sofort um, noch bevor die Bestellung geladen ist; sonst entscheidet order.firmenauftrag.
  const businessAdresse = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("bereich") === "business";
  const business = businessAdresse || !!order?.firmenauftrag;

  return (
    <div className={business ? "zahlung-business min-h-screen antialiased" : "antrag-dk dk min-h-screen antialiased"} lang={englisch ? "en" : undefined}>
      {!business && <div className="dk-grund" aria-hidden="true"><span className="dk-nebel a" /><span className="dk-nebel b" /><span className="dk-nebel c" /></div>}
      <GlassNav bereich={business ? "business" : undefined} />

      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 pt-28 sm:pt-32 pb-16">
        {loading && (
          <div className="flex flex-col items-center py-24">
            <div className="w-12 h-12 rounded-full border-[3px] border-transparent border-t-[#2563eb] animate-spin mb-4" />
            <p className="text-[14px] text-gray-400">{w.laden}</p>
          </div>
        )}

        {!loading && error && (
          <div className="text-center py-24">
            <h1 className="text-2xl font-bold mb-3">{w.nichtGefunden}</h1>
            <p className="text-[14px] text-gray-500">{error}</p>
          </div>
        )}

        {!loading && order && order.status === "paid" && (
          <div className="text-center py-24">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <h1 className="text-2xl font-bold mb-3">{w.bezahltTitel}</h1>
            <p className="text-[14px] text-gray-500">
              {order.firmenauftrag
                ? w.bezahltFirma(order.firmenName || "", order.packName || "")
                : auskunft
                  ? ta.bezahlt(auskunft, order.firstName || "")
                  : <>{order.firstName ? `${order.firstName}, Ihre` : "Ihre"} Zahlung ist bei uns eingegangen — Ihr Konto ist aktiv und Ihre Karte ist unterwegs.</>}
            </p>
          </div>
        )}

        {!loading && order && auskunft && auskunftNichtOffen && (
          <div className="zahlung-auskunft-zu text-center py-24">
            <h1 className="text-2xl font-bold mb-3">{ta.nichtOffenTitel}</h1>
            <p className="text-[14px] text-gray-500 max-w-md mx-auto leading-relaxed">
              {order.status === "cancelled" ? ta.storniert : order.status === "expired" ? ta.abgelaufen : ta.ersetzt}
            </p>
            {order.status === "expired" && (
              <a href={ta.neuBestellen(auskunft.art).ziel}
                 className="inline-flex items-center justify-center mt-5 px-6 rounded-xl text-[14px] font-bold text-white"
                 style={{ minHeight: 48, background: "linear-gradient(180deg,#3b82f6,#1d4ed8)", boxShadow: "0 8px 22px -10px rgba(29,78,216,.8)" }}>
                {ta.neuBestellen(auskunft.art).text}
              </a>
            )}
            <p className="text-[12px] text-slate-400 mt-4">{order.paymentReference}</p>
          </div>
        )}

        {!loading && order && order.status !== "paid" && !auskunftNichtOffen && (
          <div style={{ animation: "zahlungFadeUp .4s ease" }}>
            {/* 1. Headline mit dezentem Gradient-Shimmer */}
            <div className="text-center mb-6">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight zahlung-shimmer-heading mb-3 leading-tight pb-1">
                {order.art === "rate" ? `Ihre Monatsrate ${order.rateNr ?? ""} von ${order.ratenVon ?? 12}` : auskunft ? ta.titel(auskunft.art) : order.firmenauftrag ? w.titelFirma : "Letzter Schritt: Konto aktivieren"}
              </h1>
              {/* 2. Statuszeile */}
              <p className="text-[13px] sm:text-[14px] text-slate-500">
                {order.art === "rate"
                  ? <>Fällig am <b className="text-slate-900">{dueDateStr}</b> — Ihr Verwendungszweck: <b className="text-slate-900">{order.paymentReference}</b></>
                  : auskunft
                    ? <>{ta.statusVor}<b className="text-slate-900">{betragText} €</b>{ta.statusNach}{order.dueDate ? <>{ta.statusFaellig}<b className="text-slate-900">{dueDateStr}</b>.</> : null}</>
                  : order.firmenauftrag
                    ? <>{w.statusFirma[0]}<b className="text-slate-900">{englisch ? `€${betragText}` : `${betragText} €`}</b>{w.statusFirma[1]}<b className="text-slate-900">{dueDateStr}</b>{w.statusFirma[2]}</>
                    : <>Ihr Platz ist bis zum <b className="text-slate-900">{dueDateStr}</b> reserviert.</>}
              </p>
              {order.firmenauftrag && (
                <p className="text-[12px] text-slate-400 mt-1.5">
                  {order.firmenName ? `${order.firmenName} · ` : ""}{order.packName ? `${order.packName.replace(/\n/g, " ")} · ${w.einmalig} · ` : ""}{order.paymentReference}
                </p>
              )}
              {auskunft && (
                <p className="text-[12px] text-slate-400 mt-1.5">
                  {[order.firmenName || order.firstName, order.packName, order.kundenpreis ? ta.kundenpreis : "", order.paymentReference]
                    .filter(Boolean).join(" · ")}
                </p>
              )}
              {!auskunft && !order.firmenauftrag && order.firstName && (
                <p className="text-[12px] text-slate-400 mt-1.5">
                  {order.firstName}
                  {order.packName ? ` · ${order.packName.replace(/\n/g, " ")}` : ""} · {order.paymentReference}
                </p>
              )}
              <div className="mt-4">
                <TrustBadges w={w} labels={auskunft ? ta.badges : undefined} />
              </div>
            </div>

            {/* ── ZWEI GLEICHWERTIGE WEGE ────────────────────────────────────
                Bisher gab es hier genau einen Ausgang: bezahlen. Wer das nicht
                sofort tun wollte oder konnte, schloss den Tab — und wurde
                danach viermal vergeblich angerufen. Der Terminweg ist kein
                Ausweichgleis, sondern der zweite richtige Ausgang. Deshalb
                steht er gleichrangig oben, nicht als Kleingedrucktes unten. */}
            {/* E-188: Nicht beim Firmenauftrag — die Kacheln versprechen „Konto sofort aktiv" und bieten das
                Startgespräch der Privatkundenlinie an. Dort führt die Rechnung, und den Termin macht der
                Ansprechpartner aus der Auftragsbestätigung. */}
            {/* E-243: Nicht bei der Auskunft — dort steht die Kurzfassung (kein Konto, kein Startgespräch). */}
            {!order.firmenauftrag && !auskunft && <TerminAngebot paymentReference={order.paymentReference} art={order.art} />}
            {auskunft && <AuskunftKurzfassung sicht={auskunft} />}

            {order.status === "claimed_paid" && (
              <div className="mb-5 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-center">
                <p className="text-[13px] font-semibold text-emerald-700">
                  {order.firmenauftrag
                    ? w.gemeldetFirma
                    : auskunft
                      ? ta.gemeldet(auskunft.art)
                      : "Danke! Wir prüfen Ihren Zahlungseingang – meist innerhalb von 24 Stunden. Sie bekommen eine E-Mail, sobald Ihr Konto frei ist."}
                </p>
              </div>
            )}

            {order.status === "expired" && (
              <div className="mb-5 rounded-xl bg-red-50 border border-red-100 p-4 text-center">
                <p className="text-[13px] font-semibold text-red-600">
                  {w.abgelaufen}
                </p>
              </div>
            )}

            {/* 3. Erklär-Box: So bezahlen Sie – ganz einfach */}
            <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5 sm:p-6 mb-5">
              <p className="text-[16px] sm:text-[17px] font-bold zahlung-shimmer-heading mb-4 inline-block">{order.art === "rate" ? "Rate überweisen – ganz einfach" : auskunft ? ta.boxTitel : order.firmenauftrag ? w.boxTitelFirma : <>Konto aktivieren &amp; Karte versenden – ganz einfach</>}</p>

              <p className="text-[12px] font-bold uppercase tracking-wider text-[#2563eb] mb-2.5">{auskunft ? ta.schnell : order.firmenauftrag ? w.schnellFirma : <>Empfohlen (schnell &amp; fehlerfrei)</>}</p>
              <ol className="space-y-2.5 mb-5">
                <li className="flex gap-3 text-[13.5px] sm:text-[14px] text-slate-700 leading-relaxed">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-[#2563eb] text-white text-[12px] font-bold flex items-center justify-center">1</span>
                  <span>{w.schritt1[0]}<b>{w.schritt1[1]}</b>{w.schritt1[2]}</span>
                </li>
                <li className="flex gap-3 text-[13.5px] sm:text-[14px] text-slate-700 leading-relaxed">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-[#2563eb] text-white text-[12px] font-bold flex items-center justify-center">2</span>
                  {w.schritt2}
                </li>
                <li className="flex gap-3 text-[13.5px] sm:text-[14px] text-slate-700 leading-relaxed">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-[#2563eb] text-white text-[12px] font-bold flex items-center justify-center">3</span>
                  <span>
                    {w.schritt3[0]}<b>{w.schritt3[1]}</b>{w.schritt3[2]}<b>{w.schritt3[3]}</b>{w.schritt3[4]}
                    <span className="hidden sm:inline">{w.schritt3Breit}</span>
                  </span>
                </li>
              </ol>

              <p className="text-[12px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">{w.alternativ}</p>
              <p className="text-[13px] text-slate-600 leading-relaxed">
                {w.alternativText[0]}{" "}
                <b className="text-slate-900">{order.paymentReference}</b>{w.alternativText[1]}
              </p>
            </div>

            {/* 4. HAUPT-BAUSTEIN: QR-Code (GiroCode) + "QR-Code speichern" */}
            <div id="zahlungsdaten" className="rounded-2xl border border-slate-200 bg-slate-50/60 p-6 sm:p-8 mb-5 text-center" style={{ scrollMarginTop: 96 }}>
              {/* Immer heller Hintergrund hinter dem QR (Scanbarkeit, auch Darkmode) */}
              <div className="inline-block p-4 rounded-2xl border border-slate-200 shadow-sm mb-4" style={{ background: "#ffffff" }}>
                <QRCodeSVG value={qrPayload} size={190} level="M" marginSize={2} bgColor="#ffffff" fgColor="#0f172a" />
              </div>
              <p className="text-[12px] text-slate-500 mb-4">
                {w.qrText}
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
                    {w.qrGespeichert}
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                    {w.qrSpeichern}
                  </>
                )}
              </button>
              {qrSaved === "shared" && (
                <p className="mt-3 text-[13px] font-semibold text-emerald-600">
                  {w.qrGeteilt}
                </p>
              )}
              {qrSaved === "downloaded" && (
                <p className="mt-3 text-[13px] font-semibold text-emerald-600">
                  {w.qrGeladen}
                </p>
              )}

              {/* Verstecktes hochauflösendes Export-Canvas (nur QR + Quiet Zone) */}
              <div ref={exportWrapRef} aria-hidden="true" style={{ position: "absolute", left: -9999, top: -9999, width: 0, height: 0, overflow: "hidden" }}>
                <QRCodeCanvas value={qrPayload} size={640} level="M" marginSize={4} bgColor="#ffffff" fgColor="#000000" />
              </div>
            </div>

            {/* 5. Bankdaten einzeln (Alternativ-Weg) */}
            <div id="bankdaten" className="space-y-2.5 mb-5" style={{ scrollMarginTop: 96 }}>
              <CopyField w={w} label={w.empfaenger} display={order.bank.recipient} copyValue={order.bank.recipient} />
              <CopyField w={w} label="IBAN" display={order.bank.ibanDisplay} copyValue={order.bank.iban} />
              <CopyField w={w} label="BIC" display={order.bank.bic} copyValue={order.bank.bic} />
              <CopyField
                w={w}
                label={w.betrag}
                display={`${betragText} EUR`}
                copyValue={amount.toFixed(2)}
              />
              <CopyField
                w={w}
                label={w.zweck}
                display={order.paymentReference}
                copyValue={order.paymentReference}
                highlight
                hint={w.zweckHinweis}
              />
            </div>

            {/* 6. IBAN-Herkunft-Hinweis */}
            <div className="rounded-xl bg-blue-50/70 border border-blue-100 p-4 sm:p-5 mb-4">
              <p className="text-[13px] text-slate-600 leading-relaxed">
                {w.ibanHinweis(BANK.bank, BANK.iban.slice(0, 2))}
              </p>
            </div>

            {/* 7. Vertrauens-Absatz */}
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 sm:p-5 mb-6">
              <p className="text-[13px] text-slate-600 leading-relaxed">
                <b className="text-slate-800">{w.warumTitel}</b>{w.warumText}
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
                  w.moment
                ) : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                    {w.claim}
                  </>
                )}
              </button>
            </div>
            <p className="text-center text-[12px] text-slate-400 mt-2.5">
              {w.claimHinweis}
            </p>
            </>)}
          </div>
        )}
      </div>

      <PremiumFooter bereich={business ? "business" : undefined} />

      <style>{ZAHLUNG_STYLES}</style>
    </div>
  );
}
