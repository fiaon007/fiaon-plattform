// ═══════════════════════════════════════════════════════════════════════════
// /agent/whatsapp — der Chat mit den eigenen Kunden (23.09.2026, E-210)
//
// Justin: „Wir brauchen auch für die Mitarbeiter, Chef und einfach jeden einen
// Bereich der WHATSAPP heißt … wo die Mitarbeiter mit den Kunden schreiben
// können."
//
// Die Seite selbst ist nur die Tür: Der Raum steht in
// components/whatsapp/WhatsAppRaum.tsx und wird auch im Chefbüro benutzt. Der
// Unterschied entsteht auf dem Server — der Mitarbeiter sieht die Gespräche
// SEINER Menschen, die Leitung alle.
//
// 28.09.2026 (E-248): Der Raum bringt seine eigene dunkle Bühne mit. Ohne
// `dunkel(true)` lag er halbtransparent auf der hellen Office-Glasfläche —
// grau und verwaschen, die Überschrift unsichtbar. Der feste 1320-px-Rahmen
// ist weg: Wie der Raum sich aufteilt, entscheidet sein Platz (Container Queries).
// Die Office-Hülle setzt `dunkel` bei jedem Seitenwechsel selbst zurück.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect } from "react";
import { AgentShell } from "./shared";
import { useOffice } from "./OfficeShell";
import WhatsAppRaum from "@/components/whatsapp/WhatsAppRaum";

function Innen() {
  const { dunkel } = useOffice();
  useEffect(() => { dunkel(true); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <WhatsAppRaum basis="/agent/whatsapp" telefon="softphone" />;
}

export default function AgentWhatsAppSeite() {
  return (
    <AgentShell>
      <Innen />
    </AgentShell>
  );
}
