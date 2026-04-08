# 🚨 KRITISCHE MIGRATION: N8N Email Logs Tabelle

## Problem
Die Tabelle `n8n_email_logs` existiert im Code (`shared/schema.ts`) aber **NICHT** in der Production-Datenbank.

**Fehler:**
```
PostgresError: relation "n8n_email_logs" does not exist
```

## ✅ Lösung: 3 Optionen (in dieser Reihenfolge probieren)

---

### Option 1: Drizzle Push auf Production (EMPFOHLEN)

**Wo:** Auf dem Production-Server (Render.com, Railway, etc.)

**Schritte:**

1. **SSH in Production Server oder über Dashboard:**
   ```bash
   # Falls du SSH-Zugang hast:
   ssh user@www.plattform-aras.ai
   
   # Oder via Render/Railway Dashboard: "Shell" Button
   ```

2. **Ins Projekt-Verzeichnis:**
   ```bash
   cd /path/to/aras-ai-delivery
   ```

3. **Migration ausführen:**
   ```bash
   npm run db:push
   ```

4. **Erwartete Ausgabe:**
   ```
   ✓ Applying changes to database...
   ✓ Table n8n_email_logs created
   ✓ Indexes created
   ```

5. **Server neu starten** (falls nötig):
   ```bash
   pm2 restart aras-ai
   # oder
   npm run start
   ```

---

### Option 2: SQL Script direkt ausführen

**Falls Drizzle nicht funktioniert, nutze das manuelle SQL-Script:**

**Datei:** `db/migrations/create_n8n_email_logs.sql`

**Via PostgreSQL CLI (psql):**

1. **Verbinde zur Production DB:**
   ```bash
   psql $DATABASE_URL
   ```

2. **SQL ausführen:**
   ```bash
   \i db/migrations/create_n8n_email_logs.sql
   ```

3. **Oder direkt:**
   ```bash
   psql $DATABASE_URL -f db/migrations/create_n8n_email_logs.sql
   ```

**Via PgAdmin / Database GUI:**
1. Öffne PgAdmin oder dein DB-Tool
2. Verbinde zur Production-Datenbank
3. Öffne Query Editor
4. Kopiere den Inhalt von `db/migrations/create_n8n_email_logs.sql`
5. Führe aus

---

### Option 3: Via Deployment Script (Render/Railway)

**Falls du Render.com oder Railway nutzt:**

1. **Build Command anpassen** (in `render.yaml` oder Dashboard):
   ```bash
   npm install && npm run db:push && npm run build
   ```

2. **Oder als Pre-Deploy Hook:**
   ```yaml
   # render.yaml
   services:
     - type: web
       name: aras-ai-platform
       env: node
       buildCommand: npm install && npm run db:push && npm run build
       startCommand: npm start
   ```

3. **Neues Deployment triggern:**
   ```bash
   git commit --allow-empty -m "trigger migration"
   git push origin main
   ```

---

## ✅ Verifikation

**Nach der Migration, teste diese Queries direkt in der DB:**

### 1. Tabelle existiert?
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'n8n_email_logs';
```
**Erwartete Ausgabe:** `n8n_email_logs` (1 Row)

### 2. Spalten korrekt?
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'n8n_email_logs'
ORDER BY ordinal_position;
```
**Erwartete Ausgabe:** 13 Spalten (id, recipient, recipient_name, subject, ...)

### 3. Indizes erstellt?
```sql
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'n8n_email_logs';
```
**Erwartete Ausgabe:** 5 Indizes (Primary Key + 4 custom)

### 4. Kann Daten einfügen?
```sql
INSERT INTO n8n_email_logs (recipient, subject, status)
VALUES ('test@test.com', 'Test Email', 'sent')
RETURNING *;
```
**Erwartete Ausgabe:** 1 Row mit ID

### 5. API funktioniert?
```bash
# Email Stats Endpoint
curl https://www.plattform-aras.ai/api/admin/n8n/emails/stats \
  -H "Cookie: connect.sid=<YOUR_ADMIN_SESSION>"

# Erwartete Antwort (alles 0 ist OK, solange kein Error):
{
  "total": 0,
  "sent": 0,
  "delivered": 0,
  "opened": 0,
  "clicked": 0,
  "bounced": 0,
  "failed": 0,
  "todayCount": 0,
  "last7DaysCount": 0,
  "last30DaysCount": 0,
  "successRate": 0,
  "openRate": 0,
  "lastEmailAt": null,
  "lastEmailRecipient": null,
  "lastEmailSubject": null
}
```

---

## 🔍 Troubleshooting

### Problem: "DATABASE_URL not found"
**Lösung:** Migration muss auf Production laufen, nicht lokal. DATABASE_URL ist nur auf dem Server gesetzt.

### Problem: "Permission denied"
**Lösung:** User benötigt CREATE TABLE Rechte:
```sql
GRANT CREATE ON SCHEMA public TO your_user;
```

### Problem: "Table already exists"
**Lösung:** Tabelle wurde bereits erstellt, alles gut! Teste die API.

### Problem: Migration hängt
**Lösung:** 
1. Check DB Connection: `psql $DATABASE_URL -c "SELECT 1;"`
2. Check Locks: `SELECT * FROM pg_locks WHERE NOT granted;`
3. Kill lange Queries: `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'active';`

---

## 📊 Post-Migration Checklist

- [ ] Tabelle existiert (`SELECT * FROM n8n_email_logs LIMIT 1;`)
- [ ] API `/api/admin/n8n/emails/stats` gibt 200 zurück
- [ ] API `/api/admin/n8n/emails` gibt 200 zurück (leere Liste OK)
- [ ] Webhook `/api/n8n/webhook/email` funktioniert (Test-POST)
- [ ] Admin Dashboard "N8N Emails" Tab zeigt keine Fehler
- [ ] Server-Logs zeigen keine "relation does not exist" Fehler mehr

---

## 🎯 Nächster Schritt nach erfolgreicher Migration

**STEP 2:** N8N API Caching implementieren (1.6s → <100ms)

Siehe separate Dokumentation für Performance-Optimierung.

---

## ℹ️ Technische Details

**Schema Location:** `shared/schema.ts:780-831`  
**Migration Script:** `db/migrations/create_n8n_email_logs.sql`  
**Drizzle Config:** `drizzle.config.ts`  
**API Routes:** `server/routes/n8n-admin.ts`  
**Webhook:** `server/routes.ts:1298-1384`

**Indexes erstellt für Performance:**
- `recipient` - Schnelle Suche nach Email-Adressen
- `workflow_id` - Filtern nach Workflow
- `status` - Stats-Aggregation
- `sent_at DESC` - Chronologische Sortierung

**Tabellengröße Schätzung:**
- Pro Email: ~2-5 KB (mit Content/HTML)
- 10.000 Emails: ~30 MB
- 100.000 Emails: ~300 MB
- Kein Archivierung nötig bis 1M+ Emails
