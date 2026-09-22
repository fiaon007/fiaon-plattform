// ═══════════════════════════════════════════════════════════════════════════
// DER EINWILLIGUNGS-HINWEIS (19.09.2026, E-191)
// Eine ruhige Karte unten links — kein Vorhang, der die Seite verdeckt.
// „Nur notwendige" steht gleichwertig neben „Alle erlauben" (DSK, EDSA: die
// Ablehnung darf nicht schwerer sein als die Zustimmung). Erscheint nur, wenn
// es überhaupt etwas einzuwilligen gibt, und nie in den internen Bereichen.
// Wieder öffnen: Ereignis „fiaon-einwilligung-oeffnen" (Cookie-Einstellungen).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { einwilligungLesen, einwilligungNoetig, einwilligungSetzen, messungStarten, metaSeitenwechsel } from "@/lib/werbung";
import { istBusinessBereich, mitBereich } from "@/lib/bereich";

const INTERN = /^\/(agent|admin|chef|Admindashboard|admindashboard|onboarding|inkasso|team-intern)(\/|$)/;

export default function EinwilligungsHinweis() {
  // Auf Business-Seiten öffnen die Rechtsseiten im Rahmen von FIAON Global (lib/bereich.ts).
  const verweis = (href: string) => (typeof window !== "undefined" && istBusinessBereich(window.location.pathname, window.location.search) ? mitBereich(href) : href);
  const [offen, setOffen] = useState(false);
  const [auswahl, setAuswahl] = useState(false);
  const [statistik, setStatistik] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [pfadJetzt] = useLocation();

  // Ein Einseiter lädt nie neu — ohne diese Meldung sähe Meta nur die erste Seite.
  useEffect(() => { if (!INTERN.test(pfadJetzt)) metaSeitenwechsel(pfadJetzt); }, [pfadJetzt]);

  useEffect(() => {
    messungStarten();
    let weg = false;
    const pfad = window.location.pathname;
    if (!INTERN.test(pfad) && !einwilligungLesen()) {
      einwilligungNoetig().then((noetig) => { if (!weg && noetig) setOffen(true); });
    }
    const oeffnen = () => {
      const e = einwilligungLesen();
      setStatistik(!!e?.statistik); setMarketing(!!e?.marketing); setAuswahl(true); setOffen(true);
    };
    window.addEventListener("fiaon-einwilligung-oeffnen", oeffnen);
    return () => { weg = true; window.removeEventListener("fiaon-einwilligung-oeffnen", oeffnen); };
  }, []);

  if (!offen) return null;
  const fertig = (w: { statistik: boolean; marketing: boolean }) => { einwilligungSetzen(w); setOffen(false); };

  return (
    <div role="dialog" aria-modal="false" aria-labelledby="ew-titel" className="ew-karte">
      <style>{`
        .ew-karte{position:fixed;left:16px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:200;width:min(420px,calc(100vw - 32px));
          background:#fff;color:#3b4658;border:1px solid #e3e7ee;border-radius:16px;box-shadow:0 24px 60px rgba(12,26,46,.22);
          font:400 13.5px/1.6 'Inter',system-ui,sans-serif;padding:20px 20px 18px;animation:ewIn .35s cubic-bezier(.22,1,.36,1) both}
        @keyframes ewIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
        @media(prefers-reduced-motion:reduce){.ew-karte{animation:none}}
        .ew-karte h2{margin:0;font:400 19px/1.25 'Newsreader',Georgia,serif;color:#0c1a2e}
        .ew-karte p{margin:8px 0 0}
        .ew-karte a{color:#12284a;text-underline-offset:3px}
        .ew-knoepfe{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}
        .ew-knopf{min-height:42px;border-radius:8px;border:1px solid #12284a;background:#fff;color:#12284a;font:500 13.5px 'Inter',system-ui,sans-serif;cursor:pointer;transition:background .15s,color .15s}
        .ew-knopf:hover{background:#12284a;color:#fff}
        .ew-knopf:focus-visible,.ew-text:focus-visible{outline:2px solid #1d4ed8;outline-offset:2px}
        .ew-text{margin-top:10px;background:none;border:0;padding:0;font:inherit;color:#12284a;text-decoration:underline;text-underline-offset:3px;cursor:pointer}
        .ew-wahl{display:grid;gap:10px;margin-top:14px;padding-top:12px;border-top:1px solid #e3e7ee}
        .ew-zeile{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:start}
        .ew-zeile b{display:block;color:#0c1a2e;font-weight:500}
        .ew-zeile small{display:block;font-size:12px;color:#6b7587;line-height:1.5}
        .ew-schalter{appearance:none;width:40px;height:22px;border-radius:999px;background:#cdd5e0;position:relative;cursor:pointer;transition:background .2s;margin-top:2px}
        .ew-schalter::after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2);transition:transform .2s}
        .ew-schalter:checked{background:#12284a}.ew-schalter:checked::after{transform:translateX(18px)}
        .ew-schalter:disabled{opacity:.6;cursor:default}
      `}</style>
      <h2 id="ew-titel">Ihre Wahl zu Cookies</h2>
      <p>Wir messen nur mit Ihrer Einwilligung, welche Seiten gelesen und welche Anzeigen geklickt werden. Ohne sie funktioniert fiaon.com genauso. Einzelheiten stehen in den <a href={verweis("/cookie-einstellungen")}>Cookie-Einstellungen</a> und der <a href={verweis("/datenschutz")}>Datenschutzerklärung</a>.</p>
      {auswahl && (
        <div className="ew-wahl">
          <label className="ew-zeile"><span><b>Notwendig</b><small>Anmeldung, Sicherheit, diese Entscheidung. Immer aktiv.</small></span><input className="ew-schalter" type="checkbox" checked disabled aria-label="Notwendig" /></label>
          <label className="ew-zeile"><span><b>Statistik</b><small>Microsoft Clarity und Google Analytics: welche Seiten gelesen werden, wo Besucher hängen bleiben.</small></span><input className="ew-schalter" type="checkbox" checked={statistik} onChange={(e) => setStatistik(e.target.checked)} aria-label="Statistik" /></label>
          <label className="ew-zeile"><span><b>Marketing</b><small>Google Ads: ob ein Gespräch oder Auftrag aus einer Anzeige kam.</small></span><input className="ew-schalter" type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} aria-label="Marketing" /></label>
        </div>
      )}
      <div className="ew-knoepfe">
        {/* Beide Knöpfe sehen gleich aus — keine Lenkung zur Zustimmung (DSK-Orientierungshilfe, EDSA-Leitlinien 03/2022). */}
        <button type="button" className="ew-knopf" onClick={() => fertig({ statistik: false, marketing: false })}>Nur notwendige</button>
        {auswahl
          ? <button type="button" className="ew-knopf" onClick={() => fertig({ statistik, marketing })}>Auswahl speichern</button>
          : <button type="button" className="ew-knopf" onClick={() => fertig({ statistik: true, marketing: true })}>Alle erlauben</button>}
      </div>
      {!auswahl && <button type="button" className="ew-text" onClick={() => setAuswahl(true)}>Einzeln auswählen</button>}
    </div>
  );
}
