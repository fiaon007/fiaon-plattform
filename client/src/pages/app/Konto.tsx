// ═══════════════════════════════════════════════════════════════════════════
// /app/mehr/konto — KONTOANBINDUNG, Vorstufe (Bauvorlage 3.13, Scheibe 6, 06.09.2026)
//
// Heute gibt es NUR den Zustand „nicht verfügbar“: Es existiert kein Anbieter-
// Zugang (GoCardless Bank Account Data ist bis 01.12. geplant, E-134). Darum
// KEIN Bankfeld, KEIN Knopf „Zu meiner Bank“ — ein Knopf, der ins Leere
// führt, ist eine Zusage, die wir nicht halten. Der Bildschirm erklärt in drei
// Punkten, wie die Anbindung später funktioniert, und bietet als EINE Handlung
// den Weg, der heute geht: Foto oder PDF unter Unterlagen.
//
// `verbunden` kommt aus dem Bereich-JSON (kontoVerbunden, heute immer false) —
// wird es einmal wahr, zeigt der Kopf das an, ohne dass der Bildschirm bricht.
// ═══════════════════════════════════════════════════════════════════════════
import { Link } from "wouter";
import { ereignisMelden } from "./Bericht";
import "@/styles/app-antraege.css";
import "@/styles/app-bericht.css";

export function KontoVerbinden({ kundeRef, basis, demo, verbunden }: { kundeRef: string; basis: string; demo: boolean; verbunden: boolean }) {
  // „geoeffnet“ meldet die Schale (Bereich.tsx, /unterlagen/konto) — hier nur der Knopf.
  return (
    <>
      {/* Erreichbar unter /unterlagen/konto (Bereich.tsx) — Zurück führt dorthin, wo der Kunde herkam. */}
      <Link href={`${basis}/unterlagen`} className="ap-textknopf ap-auf">← Zurück</Link>
      <h1 className="ap-gruss ap-auf" style={{ marginTop: 0 }}>
        Konto verbinden
        <small>{verbunden ? "Ihr Konto ist verbunden." : "Später bestätigt Ihre Bank, wir sehen die Umsätze. Heute: Foto oder PDF unter Unterlagen."}</small>
      </h1>
      {demo && <div className="ap-demo-band ap-auf"><b>Demo-Ansicht</b><span>Feste Vorführdaten, kein echtes Konto.</span></div>}

      <div className="ap-karte ap-auf v1">
        <h3>So wird es funktionieren</h3>
        <ul className="ap-punkte" style={{ marginTop: 12 }}>
          <li>Sie bestätigen bei Ihrer Bank – in der App oder im Online-Banking Ihrer Bank, nicht bei uns.</li>
          <li>Wir sehen Umsätze, keine Zugangsdaten. Ihre PIN und Ihr Passwort bleiben bei Ihrer Bank.</li>
          <li>Ihre Zustimmung gilt 90 Tage und ist jederzeit widerrufbar – hier in Ihrem Bereich.</li>
        </ul>
      </div>

      <div className="ap-karte ap-auf v2">
        <h3>Die Kontoanbindung kommt.</h3>
        <p>Bis dahin: Foto oder PDF unter Unterlagen. Ein Handyfoto genügt, wenn alles lesbar ist.</p>
        <Link href={`${basis}/unterlagen`} className="ap-knopf" style={{ marginTop: 14 }} onClick={() => ereignisMelden(kundeRef, demo, "konto", "knopf")}>Zu den Unterlagen</Link>
      </div>

      <p className="ap-fuss ap-auf v3">Ihre hochgeladenen Unterlagen bleiben gültig.</p>
    </>
  );
}
