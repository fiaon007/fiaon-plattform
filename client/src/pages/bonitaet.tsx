// ═══════════════════════════════════════════════════════════════════════════
// /bonitaet und /bonitaet-service — WEITERLEITUNG AUF DIE ÜBERSICHT
// (25.09.2026, E-241)
//
// Bis heute stand hier die helle Vorstellungsseite der Auskunft (neu
// geschrieben am 24.09., E-240). Seit E-241 hat die Bonitätsauskunft eine
// eigene Seitenfamilie unter /bonitaetsauskunft (Übersicht, drei Länder,
// Unternehmen, Ablauf, Handlungsplan, Fragen) — /bonitaet und
// /bonitaet-service führen dorthin.
//
// Die Abfrage reist mit: Alte Kampagnen-Links tragen utm_* und fbclid, und
// die Messung (client/src/lib/werbung.ts) liest die Klick-Kennung aus der
// Adresse. Ohne sie wäre jeder Klick aus einer alten Anzeige nach der
// Weiterleitung ein Besucher ohne Herkunft.
//
// Weiterleitung im Client (wouter, replace — kein zweiter Eintrag im Verlauf).
// Ein 301 im Server wäre besser für Suchmaschinen; der Server gehört nicht zu
// E-241 (Empfehlung im Bericht). Die SEO-Tabelle führt /bonitaet deshalb mit
// canonical /bonitaetsauskunft und noindex.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect } from "react";
import { useLocation } from "wouter";

export const BONITAET_ZIEL = "/bonitaetsauskunft";

export default function BonitaetWeiterleitung() {
  const [, navigieren] = useLocation();
  useEffect(() => {
    const abfrage = typeof window !== "undefined" ? window.location.search : "";
    const anker = typeof window !== "undefined" ? window.location.hash : "";
    navigieren(`${BONITAET_ZIEL}${abfrage}${anker}`, { replace: true });
  }, [navigieren]);
  return null;
}
