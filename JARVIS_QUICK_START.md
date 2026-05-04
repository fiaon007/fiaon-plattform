# 🚀 JARVIS Brain-Link — Quick Start

## Was ist das?

JARVIS Brain-Link ist dein **Langzeitgedächtnis** für CEO Mind-OS. Du kannst massives Wissen (Chat-Logs, Strategien, Dokumente) hochladen, und JARVIS erinnert sich semantisch daran.

## ⚡ 3-Schritte-Setup

### 1. OpenAI API Key holen

1. Gehe zu: https://platform.openai.com/api-keys
2. Erstelle einen neuen API Key
3. Füge ihn zu `.env` hinzu:

```bash
OPENAI_EMBEDDING_API_KEY=sk-proj-dein-key-hier
```

### 2. Server starten

```bash
npm run dev
```

Die Datenbank-Migration läuft automatisch. ✅

### 3. Wissen hochladen

1. Öffne: http://localhost:5000/admin/database
2. Scrolle zu **JARVIS Brain-Link**
3. Füge Text ein (z.B. Chat-Logs, Strategien)
4. Klicke **"In JARVIS einspeisen"**

## 🎯 Was passiert jetzt?

- **Automatisch:** JARVIS nutzt dein Wissen bei jeder CEO Mind-OS Analyse
- **Semantisch:** Er findet relevante Infos, auch wenn du andere Wörter benutzt
- **Langfristig:** Dein Wissen bleibt dauerhaft gespeichert

## 💰 Kosten

**Praktisch kostenlos:**
- 10.000 Zeichen hochladen = ~$0.0001
- 1 Million Zeichen = ~$0.01

## 🔍 Testen

**Upload:**
```bash
curl -X POST http://localhost:5000/api/ceo-mind-os/knowledge/feed \
  -H "Content-Type: application/json" \
  -d '{"content": "FIAON ist eine Finanzierungsplattform für Selbstständige..."}'
```

**Search:**
```bash
curl -X POST http://localhost:5000/api/ceo-mind-os/knowledge/search \
  -H "Content-Type: application/json" \
  -d '{"query": "Was macht FIAON?"}'
```

## ✅ Fertig!

JARVIS hat jetzt ein Gedächtnis. Füttere ihn mit deinem Wissen! 🧠

---

**Mehr Details:** Siehe `JARVIS_BRAIN_LINK_SETUP.md`
