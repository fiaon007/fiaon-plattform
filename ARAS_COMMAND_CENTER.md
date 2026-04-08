# 🎯 ARAS COMMAND CENTER - Internal CRM

**Internes, KI-gestütztes CRM-System für das ARAS AI Team**

---

## 🚀 **SETUP**

### **1. Datenbank-Migration ausführen**

```bash
# Migration ausführen
./scripts/migrate-internal-crm.sh

# Oder manuell:
psql "$DATABASE_URL" -f db/migrations/add_internal_crm_system.sql
```

### **2. Deinen User als Admin setzen**

```sql
-- Ersetze 'dein-username' mit deinem tatsächlichen Username
UPDATE users SET user_role = 'admin' WHERE username = 'dein-username';
```

### **3. Server starten**

```bash
npm run dev
```

### **4. Command Center öffnen**

Öffne im Browser: **http://localhost:5000/internal**

---

## 🎨 **FEATURES**

### **✅ Dashboard** (`/internal/dashboard`)
- **KPI Cards**: Companies, Contacts, Deals, Tasks, Calls
- **Pipeline Preview**: 6-Stage Kanban Übersicht
- **AI Insights**: Wöchentliche KI-Analyse mit OpenAI/Gemini

### **✅ Contacts** (`/internal/contacts`)
- Live-Suche (Name, Email, Telefon)
- Grid-Layout mit Status-Badges
- Contact Cards mit allen Details

### **✅ Companies** (`/internal/companies`)
- Verwaltung von Unternehmen
- Verknüpfung mit Contacts & Deals

### **✅ Deals & Pipeline** (`/internal/deals`)
- Kanban-Board (IDEA → WON/LOST)
- Deal-Wert Tracking
- KI-Vorschläge für nächste Schritte

### **✅ Tasks** (`/internal/tasks`)
- Task-Management
- Verknüpfung mit Contacts/Deals
- Due-Date Tracking

### **✅ Call Logs** (`/internal/calls`)
- Telefonie-Historie
- Integration: Retell, ElevenLabs, Twilio
- Sentiment-Analyse

---

## 🔐 **SICHERHEIT**

### **Role-Based Access Control (RBAC)**

Nur User mit `user_role` = `admin` oder `staff` haben Zugriff auf `/internal/*`

**Rollen setzen:**
```sql
-- Admin Role
UPDATE users SET user_role = 'admin' WHERE username = 'username';

-- Staff Role  
UPDATE users SET user_role = 'staff' WHERE username = 'username';
```

### **API-Endpunkte geschützt**

Alle `/api/internal/*` Endpunkte sind durch `requireInternal` Middleware geschützt.

---

## 🧠 **KI-INTEGRATION**

### **Verfügbare AI-Funktionen:**

#### **1. Wöchentliche CRM-Analyse**
```http
POST /api/internal/ai/weekly-summary
```
Analysiert alle CRM-Daten und gibt Trends + Handlungsempfehlungen.

#### **2. Kontakt-Zusammenfassung**
```http
POST /api/internal/ai/contact-summary
Body: { "contactId": "..." }
```
Analysiert Kontakt, Deals, Tasks, Calls → gibt Einschätzung + nächste Schritte.

#### **3. Deal Next Steps**
```http
POST /api/internal/ai/deal-next-steps
Body: { "dealId": "..." }
```
Schlägt konkrete Aktionen für Deal vor basierend auf Kontext.

### **Konfiguration:**

Stelle sicher, dass folgende ENV-Variablen gesetzt sind:
```env
OPENAI_API_KEY=sk-...
GOOGLE_GEMINI_API_KEY=...  # Optional als Fallback
```

---

## 📊 **DATENMODELL**

### **6 Neue Tabellen:**

1. **`internal_companies`** - Unternehmen (Investoren, Partner, Kunden)
2. **`internal_contacts`** - Ansprechpartner
3. **`internal_deals`** - Sales Pipeline
4. **`internal_tasks`** - To-Dos
5. **`internal_call_logs`** - Telefonie-Historie
6. **`internal_notes`** - Notizen zu Contacts/Deals

**Alle Tabellen sind komplett getrennt** vom Public User-System!

---

## 🎨 **DESIGN**

### **Dark Theme - Mission Control Style**

- **Background**: Very Dark Blue/Black (`bg-gray-950`)
- **Accent**: ARAS Orange (`#FE9100`)
- **Typography**: 
  - Headlines: **Orbitron** (futuristisch)
  - Body: **Inter** (modern, lesbar)
- **Effects**:
  - Glassmorphism (`backdrop-blur-xl`)
  - Gradient Glow
  - Smooth Framer Motion Animations

---

## 🛠️ **API-ÜBERSICHT**

### **Companies**
```
GET    /api/internal/companies
GET    /api/internal/companies/:id
POST   /api/internal/companies
PATCH  /api/internal/companies/:id
DELETE /api/internal/companies/:id
```

### **Contacts**
```
GET    /api/internal/contacts
GET    /api/internal/contacts/:id
POST   /api/internal/contacts
PATCH  /api/internal/contacts/:id
DELETE /api/internal/contacts/:id
```

### **Deals**
```
GET    /api/internal/deals
GET    /api/internal/deals/stats
GET    /api/internal/deals/:id
POST   /api/internal/deals
PATCH  /api/internal/deals/:id
DELETE /api/internal/deals/:id
```

### **Tasks**
```
GET    /api/internal/tasks
GET    /api/internal/tasks/:id
POST   /api/internal/tasks
PATCH  /api/internal/tasks/:id
DELETE /api/internal/tasks/:id
```

### **Call Logs**
```
GET    /api/internal/calls
GET    /api/internal/calls/:id
POST   /api/internal/calls
```

### **Notes**
```
GET    /api/internal/notes?contactId=...
POST   /api/internal/notes
DELETE /api/internal/notes/:id
```

### **Dashboard**
```
GET    /api/internal/dashboard/stats
```

### **AI**
```
POST   /api/internal/ai/weekly-summary
POST   /api/internal/ai/contact-summary
POST   /api/internal/ai/deal-next-steps
```

---

## ⚠️ **WICHTIG**

### **Zero Impact auf Public Users:**

✅ **Keine Änderungen** an bestehenden Public-Features
✅ **Backwards Compatible** - alle bestehenden User funktionieren (default `user_role = 'user'`)
✅ **Logisch getrennt** - separate Tabellen, separate Routes
✅ **Sicher** - RBAC auf allen Ebenen

### **Live-System bleibt unberührt:**

- Public Routes funktionieren normal
- Keine Performance-Einbußen
- Keine Breaking Changes
- Internal Routes sind unsichtbar für normale User

---

## 🔧 **TROUBLESHOOTING**

### **Problem: Kann nicht auf /internal zugreifen**

**Lösung:** Prüfe deine User-Rolle:
```sql
SELECT id, username, user_role FROM users WHERE username = 'dein-username';
```

Sollte `admin` oder `staff` sein. Falls nicht:
```sql
UPDATE users SET user_role = 'admin' WHERE username = 'dein-username';
```

### **Problem: AI-Features funktionieren nicht**

**Lösung:** Prüfe API-Keys:
```bash
echo $OPENAI_API_KEY
echo $GOOGLE_GEMINI_API_KEY
```

Setze in `.env`:
```env
OPENAI_API_KEY=sk-...
GOOGLE_GEMINI_API_KEY=...
```

### **Problem: Migration schlägt fehl**

**Lösung:** 
```bash
# Prüfe DATABASE_URL
echo $DATABASE_URL

# Führe Migration manuell aus
psql "$DATABASE_URL" -f db/migrations/add_internal_crm_system.sql
```

---

## 📦 **DEPLOYMENT**

### **Auf Render/Production:**

1. **Environment Variables setzen:**
   - `DATABASE_URL` (bereits vorhanden)
   - `OPENAI_API_KEY` (für AI-Features)
   - `GOOGLE_GEMINI_API_KEY` (optional)

2. **Migration ausführen:**
   ```bash
   # Via Render Shell oder lokal mit Production DB
   psql "$DATABASE_URL" -f db/migrations/add_internal_crm_system.sql
   ```

3. **Admin-User setzen:**
   ```sql
   UPDATE users SET user_role = 'admin' WHERE username = 'production-admin';
   ```

4. **Deploy!**
   ```bash
   git push origin main
   ```

---

## 🎯 **NÄCHSTE SCHRITTE**

### **Optional erweitern:**

1. **Weitere Pages:**
   - Companies Detail View
   - Deals Kanban (Drag & Drop)
   - Tasks mit Kalender-Integration
   - Calls mit Audio-Playback

2. **Erweiterte AI-Features:**
   - Auto-Task-Generation aus Calls
   - Sentiment-Analyse für Deals
   - Predictive Lead Scoring

3. **Telefonie-Integration:**
   - Webhook für Retell/ElevenLabs
   - Auto-Contact-Creation
   - Call-Summary-Generation

4. **Export/Reports:**
   - PDF-Export
   - Excel-Download
   - Custom Reports

---

## 📞 **SUPPORT**

Bei Fragen oder Problemen:
- **Code:** Check Comments in Source Files
- **Database:** Siehe Migration SQL
- **API:** Siehe `/server/routes/internal/`

---

# 🚀 **ARAS COMMAND CENTER IST READY!**

**Viel Erfolg mit deinem internen CRM-System! 🎉**
