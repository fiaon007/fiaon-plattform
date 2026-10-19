import { lazy, Suspense, useSyncExternalStore } from "react";
import { useLocation } from "wouter";
import { agentSitzung } from "@/lib/office-zustand";

// ═══════════════════════════════════════════════════════════════════════════
// SOFTPHONE-HOST — das Telefon hängt an der App, nicht an der Seite
// (09.09.2026, E-169; Hintergrund in lib/office-zustand.ts)
//
// Vorher: <Softphone /> stand in AgentShellInnen (pages/agent/shared.tsx), und
// JEDE Office-Seite rendert ihren eigenen AgentShell. Ein Seitenwechsel — die
// Akte aus der Pipeline öffnen, ins Menü tippen — baute den Rahmen samt Telefon
// ab, und der Aufräum-Effekt des Telefons legte auf. Für einen Menschen am
// Handy, der während des Gesprächs in der Akte liest, hieß das: alle paar
// Minuten ein Abbruch.
//
// Jetzt: Dieser Host steht in App.tsx NEBEN dem Routen-Schalter. Er rendert
// das Telefon, sobald der Office-Rahmen eine Sitzung gemeldet hat, und lässt
// es bei jedem Seitenwechsel innerhalb von /agent in Ruhe. Verlässt der
// Mitarbeiter das Office (Abmelden, öffentliche Seite), verschwindet das
// Telefon — und legt dabei auf, wie vorher auch.
//
// Nachgeladen: Das Telefon (3.300 Zeilen samt Cockpit und Bühne) gehört nicht
// ins Bündel der öffentlichen Seiten.
// ═══════════════════════════════════════════════════════════════════════════
const Softphone = lazy(() => import("@/components/Softphone").then((m) => ({ default: m.Softphone })));
// E-397 (19.10.2026): „Daraus einen Termin machen?“ — die Frage nach einer Notiz mit Tag und Uhrzeit steht hier,
// damit sie stehen bleibt, wenn die Kundenkarte nach dem Ergebnis die Liste verlässt.
const TerminAusNotizHost = lazy(() => import("@/components/agent/TerminAusNotiz").then((m) => ({ default: m.TerminAusNotizHost })));

export function SoftphoneHost() {
  const sitzung = useSyncExternalStore(agentSitzung.abonnieren, agentSitzung.lesen, agentSitzung.lesen);
  const [pfad] = useLocation();
  // Nur im Office — und in der EINEN Akte (/akte/…, E-315), sobald dort eine Office-Sitzung derselben Person besteht
  // (ZentraleAkte setzt sie). /admin hat sein eigenes Telefon im AdminShell.
  if (!sitzung || !/^\/(agent|akte)(\/|$)/.test(pfad)) return null;
  return <><Suspense fallback={null}><Softphone /></Suspense><Suspense fallback={null}><TerminAusNotizHost /></Suspense></>;
}
