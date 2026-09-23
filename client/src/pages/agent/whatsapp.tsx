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
// ═══════════════════════════════════════════════════════════════════════════
import { AgentShell } from "./shared";
import WhatsAppRaum from "@/components/whatsapp/WhatsAppRaum";

export default function AgentWhatsAppSeite() {
  return (
    <AgentShell>
      <div style={{ maxWidth: 1320, margin: "0 auto" }}>
        <WhatsAppRaum basis="/agent/whatsapp" />
      </div>
    </AgentShell>
  );
}
