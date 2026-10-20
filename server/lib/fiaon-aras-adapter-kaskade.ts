// ═══════════════════════════════════════════════════════════════════════════
// ARAS — Plan B „Kaskade“: Hören (Deepgram) → Denken (Maras Gehirn) →
// Sprechen (Cartesia Sonic 3.6 mit [laughter]-Marker) — STUB (E-408, Scheibe 7)
//
// Es gibt noch keine Konten und keine Schlüssel. Dieser Stub sagt das in
// Klartext, statt still zu scheitern: Der Labs-Bereich zeigt den Grund, und
// Justin entscheidet, ob er Plan B will (dann trägt ER die Schlüssel in Render
// ein — fremde Schlüssel nie im Chat, justin-schluessel-render).
// ═══════════════════════════════════════════════════════════════════════════
import type { StimmAdapter } from "./fiaon-aras-adapter";

export const KASKADE_ENV = ["CARTESIA_API_KEY", "DEEPGRAM_API_KEY"] as const;

export function kaskadeFehlend(): string[] {
  return KASKADE_ENV.filter((n) => !String(process.env[n] ?? "").trim());
}

export function kaskadeSonicStub(): StimmAdapter {
  const grund = () => {
    const f = kaskadeFehlend();
    return f.length
      ? `Schlüssel fehlt: ${f.join(", ")} — Plan B (Kaskade Deepgram → Gehirn → Cartesia Sonic) ist nicht eingerichtet. Standard bleibt openai_live.`
      : "Plan B (Kaskade) ist vorbereitet, aber noch nicht gebaut (Scheibe 7). Standard bleibt openai_live.";
  };
  return {
    name: "kaskade_sonic",
    async bereit() { return { ok: false, grund: grund() }; },
    async sitzungStarten() { throw new Error(grund()); },
    async hoerprobe() { throw new Error(grund()); },
  };
}
