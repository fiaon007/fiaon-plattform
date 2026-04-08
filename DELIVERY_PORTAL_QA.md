# ARAS Portal — Release QA Checklist

> **Ziel:** Post-Deploy Smoke Test in 10–15 Minuten abschließen.  
> **Scope:** Login, Calls, Drawer, Audio, Analyse, Write-Actions, Exports, Permissions.

---

## Pre-Deploy Checklist

| Check | Erwartung |
|-------|-----------|
| `PORTAL_FILTER_VOICE_AGENT_ID` gesetzt | Entspricht dem Voice Agent des Kunden |
| `PORTAL_COMPANY_*` ENV vars | Name, CEO, Adresse, USt, Email |
| `PORTAL_PACKAGE_*` ENV vars | Label, includedCalls |
| `PORTAL_USERS` JSON array | Min. 1 CEO + 1 Marketing User |
| `DATABASE_URL` erreichbar | DB Connection erfolgreich |
| Audio proxy `/api/portal/calls/:id/audio` | Route existiert |

---

## Post-Deploy Smoke Test (10–15 min)

### 1. Login — Falsches Passwort
**Aktion:** Portal URL öffnen, falsches Passwort eingeben  
**Erwartung:** Fehlermeldung „Ungültige Anmeldedaten", kein Login

### 2. Login — Korrektes Passwort
**Aktion:** Korrektes Passwort eingeben  
**Erwartung:** Dashboard lädt, Company Card + Package Card sichtbar

### 3. Session Expired → Login Redirect
**Aktion:** Cookie löschen oder `?expired=1` an URL hängen  
**Erwartung:** Login-Seite mit Hinweis „Session abgelaufen"

### 4. Calls Liste + Infinite Scroll
**Aktion:** Dashboard Call-Tabelle prüfen, nach unten scrollen  
**Erwartung:** Calls laden, bei >50 Calls weitere nachladen (Sentinel)

### 5. Drawer öffnen/schließen + Deep Link
**Aktion:** Call anklicken → Drawer öffnet, URL prüfen  
**Erwartung:** Drawer zeigt Call Details, URL enthält `?call=<id>`

### 6. Audio abspielen (Proxy)
**Aktion:** Im Drawer auf Play klicken (falls Recording vorhanden)  
**Erwartung:** Audio spielt ab, kein CORS-Fehler

### 7. Analyse — Single + Bulk
**Aktion:** 
- Single: Im Drawer „Analysieren" klicken
- Bulk: Mehrere Calls selektieren → „Bulk Analyze"  
**Erwartung:** 
- Single: Analysis erscheint nach wenigen Sekunden
- Bulk: Toast „X Calls analysiert"
- Permission: Marketing-User sieht Button nicht (canWrite=false)

### 8. Write Actions — Note/Star/Review/Outcome/Owner
**Aktion:** Im Drawer:
1. Note eingeben + speichern
2. Star togglen
3. Reviewed togglen
4. Outcome Tag setzen
5. Owner setzen (falls canWrite)  
**Erwartung:** Alle Aktionen speichern erfolgreich, Toast-Feedback, CSRF-Token wird gesendet

### 9. Exports — CSV + Report
**Aktion:** 
- CSV: „Export CSV" klicken
- Report: „PDF Report" öffnen  
**Erwartung:** 
- CSV: Download startet, Nummern maskiert
- Report: Report-Seite öffnet mit maskierten Daten

### 10. Audit Access — Permission Gating
**Aktion:** 
- Als CEO: Audit Tab prüfen (falls vorhanden)
- Als Marketing: Audit Tab prüfen  
**Erwartung:** 
- CEO: Audit sichtbar
- Marketing: Audit nicht sichtbar

### 11. Views — Save/Load/Share
**Aktion:** 
1. Filter setzen → „Save View"
2. View aus Dropdown laden
3. Share Link kopieren  
**Erwartung:** View wird gespeichert, lädt korrekt, Share-Link funktioniert

### 12. Compact Toggle — Persistence
**Aktion:** „Compact" Button klicken, Seite neu laden  
**Erwartung:** Compact-Modus bleibt erhalten (localStorage)

---

## QA Sign-Off Template

```
ARAS Portal QA — [KUNDE] — [DATUM]
============================================
Tester: _______________
Environment: Production / Staging

[ ] 1. Login wrong pw → error
[ ] 2. Login ok → dashboard  
[ ] 3. Session expired → login
[ ] 4. Calls list + infinite scroll
[ ] 5. Drawer open/close + deep link
[ ] 6. Audio play via proxy
[ ] 7. Analyze single + bulk (permission)
[ ] 8. Write actions (note/star/review/outcome/owner)
[ ] 9. Exports CSV + Report (masked)
[ ] 10. Audit access (CEO yes / Marketing no)
[ ] 11. Views save/load/share
[ ] 12. Compact toggle persistence

Issues found:
- 

Sign-off: _______________  Date: _______________
```

---

## Rollback / Recovery

### Portal deaktivieren (Notfall)
```bash
# Render Dashboard → Environment Variables
# Setze PORTAL_USERS auf leeres Array:
PORTAL_USERS=[]

# Oder: Setze ungültigen Filter
PORTAL_FILTER_VOICE_AGENT_ID=0
```

### Session invalidieren
```bash
# Nutzer muss sich neu einloggen.
# Cookies werden clientseitig gelöscht bei Logout.
```

### Passwort zurücksetzen
```bash
# Lokal:
npm run hash-password -- newpassword123

# Output in PORTAL_USERS JSON eintragen
```

---

## Debug Mode (QA Panel)

Das Portal enthält ein internes QA Panel, das nur sichtbar ist wenn:
- URL Parameter `?qa=1` gesetzt ist **UND**
- Eingeloggter User role = `CEO`

**Aktivierung:**
```
https://portal.aras.ai/portal/leadely?qa=1
```

**Features:**
- Live API Status Checks
- Checkbox-basierte Checkliste
- „Copy QA Notes" für schnelle Dokumentation

---

*Letzte Aktualisierung: Januar 2026*
