# 🚀 JARVIS Brain-Link — Quick Start

## Was ist das?

JARVIS Brain-Link ist dein **Langzeitgedächtnis** für CEO Mind-OS. Du kannst massives Wissen (Chat-Logs, Strategien, Dokumente) hochladen, und JARVIS erinnert sich semantisch daran.

**⚡ 100% Open-Source** — Keine API-Keys, keine Kosten, läuft lokal!

## ⚡ 2-Schritte-Setup

### 1. Server starten

```bash
npm run dev
```

Die Datenbank-Migration läuft automatisch. ✅

### 2. Wissen hochladen

1. Öffne: http://localhost:5000/admin/database
2. Scrolle zu **JARVIS Brain-Link**
3. Füge Text ein (z.B. Chat-Logs, Strategien)
4. Klicke **"In JARVIS einspeisen"**

## 🎯 Was passiert jetzt?

- **Automatisch:** JARVIS nutzt dein Wissen bei jeder CEO Mind-OS Analyse
- **Semantisch:** Er findet relevante Infos, auch wenn du andere Wörter benutzt
- **Langfristig:** Dein Wissen bleibt dauerhaft gespeichert

## 💰 Kosten

**100% KOSTENLOS:**
- ✅ Keine API-Kosten
- ✅ Unbegrenzte Nutzung
- ✅ Läuft auf deinem Server
- ✅ Open-Source (all-MiniLM-L6-v2)

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
