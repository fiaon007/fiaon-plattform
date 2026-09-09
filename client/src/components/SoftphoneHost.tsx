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

export function SoftphoneHost() {
  const sitzung = useSyncExternalStore(agentSitzung.abonnieren, agentSitzung.lesen, agentSitzung.lesen);
  const [pfad] = useLocation();
  // Nur im Office. /admin hat sein eigenes Telefon im AdminShell.
  if (!sitzung || !/^\/agent(\/|$)/.test(pfad)) return null;
  return <Suspense fallback={null}><Softphone /></Suspense>;
}
