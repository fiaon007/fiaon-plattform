# 🔄 JARVIS Brain-Link Migration Guide

## Von OpenAI zu Open-Source Embeddings

JARVIS Brain-Link nutzt jetzt **100% Open-Source Embeddings** statt OpenAI. Das bedeutet:

✅ **Keine API-Kosten mehr**  
✅ **Keine externen Abhängigkeiten**  
✅ **Läuft komplett lokal**  
✅ **Privacy-First** (Daten verlassen nie deinen Server)  

---

## 🚨 Breaking Change

Die Vektor-Dimension hat sich geändert:
- **Alt:** OpenAI text-embedding-3-small (1536 Dimensionen)
- **Neu:** all-MiniLM-L6-v2 (384 Dimensionen)

**Bestehende Knowledge Base Einträge müssen neu eingespeist werden.**

---

## 📋 Migrations-Schritte

### 1. Backup erstellen (optional)

Falls du wichtige Daten in der Knowledge Base hast:

```bash
# Export existing knowledge
psql $DATABASE_URL -c "COPY (SELECT content, metadata FROM knowledge_base) TO STDOUT CSV HEADER" > knowledge_backup.csv
```

### 2. Alte Daten löschen

```bash
# Truncate table (keeps structure, removes data)
psql $DATABASE_URL -c "TRUNCATE TABLE knowledge_base;"
```

**ODER** komplett neu aufsetzen:

```bash
# Drop and recreate
psql $DATABASE_URL -c "DROP TABLE IF EXISTS knowledge_base CASCADE;"
```

### 3. Server neu starten

```bash
npm run dev
```

Die neue Migration läuft automatisch und erstellt die Tabelle mit `vector(384)`.

### 4. Wissen neu hochladen

1. Öffne `/admin/database`
2. Scrolle zu **JARVIS Brain-Link**
3. Füge dein Wissen wieder ein
4. Klicke "In JARVIS einspeisen"

---

## 🔧 Umgebungsvariablen

### Entfernen

Du kannst diese Variable aus deiner `.env` **löschen**:

```bash
# NICHT MEHR BENÖTIGT
OPENAI_EMBEDDING_API_KEY=...
```

### Keine neuen Variablen

Das System läuft **ohne Konfiguration**. Keine API-Keys erforderlich!

---

## 📊 Technische Details

### Modell-Vergleich

| Feature | OpenAI (alt) | Open-Source (neu) |
|---------|--------------|-------------------|
| Modell | text-embedding-3-small | all-MiniLM-L6-v2 |
| Dimensionen | 1536 | 384 |
| API-Kosten | $0.02/1M tokens | **$0** |
| Latenz | ~200ms (API) | ~100ms (lokal) |
| Privacy | Daten an OpenAI | **100% lokal** |
| Qualität | Sehr hoch | Hoch (gut genug für die meisten Use Cases) |

### Performance

- **Erster Start:** Modell wird heruntergeladen (~25MB)
- **Danach:** Modell ist lokal gecacht
- **Embedding-Generierung:** ~50-100ms pro Chunk
- **Batch-Processing:** Parallel möglich

---

## 🧪 Testen

### 1. Upload testen

```bash
curl -X POST http://localhost:5000/api/ceo-mind-os/knowledge/feed \
  -H "Content-Type: application/json" \
  -d '{"content": "FIAON ist eine Finanzierungsplattform für Selbstständige in Deutschland."}'
```

Erwartete Antwort:
```json
{
  "success": true,
  "chunks_processed": 1,
  "ids": [1],
  "message": "1 Wissens-Chunks erfolgreich gespeichert"
}
```

### 2. Suche testen

```bash
curl -X POST http://localhost:5000/api/ceo-mind-os/knowledge/search \
  -H "Content-Type: application/json" \
  -d '{"query": "Was macht FIAON?", "limit": 3}'
```

Erwartete Antwort:
```json
{
  "query": "Was macht FIAON?",
  "results": [
    {
      "id": 1,
      "content": "FIAON ist eine Finanzierungsplattform...",
      "similarity": 0.89,
      "metadata": {},
      "created_at": "2026-05-04T..."
    }
  ]
}
```

### 3. CEO Agent Integration testen

Erstelle eine neue Strategie im CEO Mind-OS Dashboard. JARVIS sollte automatisch relevantes Wissen aus der Knowledge Base nutzen.

---

## 🛠️ Troubleshooting

### "Model download failed"

- Prüfe Internetverbindung (nur beim ersten Start nötig)
- Modell wird nach `~/.cache/huggingface/` heruntergeladen
- Bei Problemen: Cache löschen und neu starten

### "Dimension mismatch"

- Alte Daten mit 1536 Dimensionen sind inkompatibel
- Lösung: Tabelle leeren und Wissen neu hochladen (siehe oben)

### "Embedding generation slow"

- Beim ersten Chunk wird das Modell geladen (~1-2 Sekunden)
- Danach ist es schnell (~100ms pro Chunk)
- Für Production: Modell beim Server-Start vorladen (optional)

---

## 🎯 Vorteile der Migration

1. **Keine Kosten:** Unbegrenzte Nutzung ohne API-Gebühren
2. **Privacy:** Daten verlassen nie deinen Server
3. **Schneller:** Lokale Verarbeitung ohne API-Latenz
4. **Unabhängig:** Keine Abhängigkeit von OpenAI
5. **Open-Source:** Volle Kontrolle über das Modell

---

## 📚 Weiterführende Links

- **Modell:** [all-MiniLM-L6-v2 auf Hugging Face](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2)
- **Library:** [@xenova/transformers](https://github.com/xenova/transformers.js)
- **Dokumentation:** `JARVIS_BRAIN_LINK_SETUP.md`

---

**Status:** ✅ Migration abgeschlossen (Commit `907e4b8`)

Bei Fragen oder Problemen: Check die Server-Logs für detaillierte Fehlermeldungen.
