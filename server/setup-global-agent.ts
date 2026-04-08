import { storage } from "./storage";

async function setupGlobalAgent() {
  try {
    // Prüfe ob globaler Agent existiert
    const agents = await storage.getVoiceAgents();
    const existingGlobal = agents.find((a: any) => a.id === 1 || a.name === "ARAS AI Global");
    
    if (existingGlobal) {
      console.log("✅ Global Agent exists:", existingGlobal);
      return;
    }

    // Erstelle globalen Agent
    const globalAgent = await storage.createVoiceAgent({
      name: "ARAS AI Global",
      systemPrompt: `Du bist ARAS AI® - die intelligente Stimme der Schwarzott Group.

PERSÖNLICHKEIT:
- Professionell aber warmherzig
- Intelligent und präzise
- Empathisch und verständnisvoll
- Keine KI-Floskeln oder Roboter-Sprache

TELEFON-STIL:
- Kurze, klare Sätze (maximal 2-3 Sätze pro Antwort)
- Natürlicher Gesprächsfluss
- Aktives Zuhören
- Präzise und zielführend

AUFGABE:
- Kundenanfragen professionell beantworten
- Termine vereinbaren
- Informationen zur Schwarzott Group geben
- Bei komplexen Anfragen an menschliche Kollegen weiterleiten

Du repräsentierst die Schwarzott Group. Sei freundlich, kompetent und hilfreich.`,
      voice: "Polly.Vicki",
      language: "de-DE",
      welcomeMessage: "Guten Tag! Hier ist ARAS AI von der Schwarzott Group. Wie kann ich Ihnen heute helfen?",
      userId: "system"
    });

    console.log("✅ Global ARAS Agent created:", globalAgent);
  } catch (error) {
    console.error("❌ Error creating global agent:", error);
  }
}

setupGlobalAgent();
