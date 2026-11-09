// ═══════════════════════════════════════════════════════════════════════════
// /APP › HEUTE — „IHR VORSORGE-ÜBERBLICK“ MIT DIREKTER BUCHUNG (E-386, 16.10.2026 · E-487 (09.11.2026))
//
// Eine ruhige Karte, kein Band: Nichts daran ist dringend. Bis E-487 konnte der Kunde hier nur Interesse melden („Ihr
// FIAON-Team ruft Sie an“) — der Termin entstand erst im Telefonat, und die Aufgabe an den Betreuer blieb tagelang offen.
// Jetzt bucht er selbst, über denselben Weg wie die Seite des persönlichen Links (VorsorgeBuchung, server/lib/fiaon-vorsorge.ts):
// Themen festhalten, Partner mit Name und Rolle, Terminart, freie Zeit, eigenes Kästchen zum Wortlaut, „Termin buchen“.
// Der Server zeigt die Karte nur mit aktivem Vorsorge-Partner, ohne Sperre (Werbe-/Vertriebssperre, Global, AT/CH …), mit
// bezahltem Paket und nicht nach „kein Interesse“. Heute.tsx zeigt sie nur bei bezahlt und ohne überfällige Rate. Nie in der Demo.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { api } from "@/pages/app/Bausteine";
import { VorsorgeBuchung } from "@/components/kunde/VorsorgeBuchung";
import { VORSORGE_TEXTE, type VorsorgeLage } from "@shared/fiaon-vorsorge";

export function PartnerGespraechKarte({ kundeRef, demo }: { kundeRef: string; demo: boolean }) {
  const [lage, setLage] = useState<VorsorgeLage | null>(null);
  const [ende, setEnde] = useState<string | null>(null);
  const basis = `/kunde/${encodeURIComponent(kundeRef)}/app/partner-gespraech`;
  useEffect(() => {
    if (demo) return;
    api(basis).then((r) => setLage(r.ok && r.json?.ok && r.json.lage ? (r.json.lage as VorsorgeLage) : null)).catch(() => setLage(null));
  }, [basis, demo]);
  if (demo || !lage?.zeigen) return ende ? <p className="ap-fuss">{ende}</p> : null;
  return (
    <section className="ap-karte ap-auf v3" data-fiaon="heute-partner-gespraech">
      <h3>{VORSORGE_TEXTE.karteTitel}</h3>
      <p>{VORSORGE_TEXTE.karteText}</p>
      <VorsorgeBuchung basis={basis} lage={lage} setLage={setLage} kontext="karte" onEnde={(text) => { setEnde(text); setLage(null); }} />
    </section>
  );
}
