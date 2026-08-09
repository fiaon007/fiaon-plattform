import { useEffect } from "react";
import { useLocation } from "wouter";

// ═══════════════════════════════════════════════════════════════════════════
// UMLEITUNG — kein Lesezeichen läuft ins Leere
//
// Sechs Kundenseiten sind am 09.08.2026 in der Kunden-Zentrale aufgegangen.
// Wer eine davon im Lesezeichen hat — oder in einer Notiz, einer Mail, einem
// Screenshot in der Schulungsunterlage — landet sonst auf „Seite nicht
// gefunden" und glaubt, die Funktion sei weg.
//
// Die Umleitung nimmt den passenden Filter mit: Wer „Kündigungen" aufruft,
// sieht die Kündigungen — nicht eine ungefilterte Liste mit 4.000 Zeilen, in
// der er suchen darf.
//
// `replace: true`: Die alte Adresse verschwindet aus dem Verlauf. Sonst
// landet man beim Zurück-Knopf wieder auf der Umleitung und wird erneut
// weitergeschickt — eine Falle, aus der man nur mit Gewalt herauskommt.
// ═══════════════════════════════════════════════════════════════════════════

export function Umleitung({ nach }: { nach: string }) {
  const [, navigate] = useLocation();
  useEffect(() => { navigate(nach, { replace: true }); }, [nach, navigate]);
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <p className="text-[13px] text-slate-400">Diese Seite ist in die Kunden-Zentrale umgezogen …</p>
    </div>
  );
}
