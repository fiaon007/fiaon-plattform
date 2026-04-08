# ARAS Portal — Leadely · Internal Operations Notes

> **INTERNAL USE ONLY** — Diese Datei enthält Konfigurationsdetails und darf nicht an Kunden weitergegeben werden.

---

## Render ENV Checklist

### 1. PORTAL_SESSION_SECRET
```
PORTAL_SESSION_SECRET=<<min 32 random chars>>
```

### 2. CLIENT_PORTAL_USERS_JSON
```json
[
  {
    "portalKey": "leadely",
    "username": "info@leadely.de",
    "displayName": "Alessandro Vitale",
    "role": "Marketing",
    "passwordHash": "<<scrypt hash>>"
  }
]
```

### 3. CLIENT_PORTAL_CONFIG_JSON
```json
{
  "leadely": {
    "company": {
      "name": "Leadely GmbH",
      "ceo": "<<GF Name>>",
      "email": "info@leadely.de",
      "addressLine": "<<Straße Nr>>",
      "zipCity": "<<PLZ Stadt>>",
      "vatId": "DE<<XXXXXXXXX>>"
    },
    "package": {
      "includedCalls": 1000,
      "label": "Call-Paket Standard",
      "notes": ""
    },
    "ui": {
      "portalTitle": "Leadely Portal",
      "tooltipMode": "hover",
      "kpiFocus": "successChance",
      "branding": {},
      "copy": {},
      "infoHints": {}
    },
    "filter": {
      "mode": "voiceAgent",
      "field": "voiceAgentId",
      "value": 123
    }
  }
}
```

---

## Password Handling

```bash
# Hash neues Passwort (lokal):
npm run hash-password -- "neuesPasswort123"

# Output (scrypt format) in CLIENT_PORTAL_USERS_JSON eintragen
```

---

## Deployment Steps

1. **Set ENV** — Alle 3 ENV Variablen in Render Dashboard setzen
2. **Deploy** — Redeploy auslösen
3. **Health Check** — `GET /api/portal/health` prüfen (muss `ok: true` zurückgeben)
4. **QA 12/12** — QA Panel durchgehen (URL: `?qa=1` als CEO)
5. **Customer Handover** — `PORTAL_LEADELY_HANDOVER_DE.md` senden + Passwort separat

---

## Hand-off Checklist

- [ ] Render ENV gesetzt (alle 3 Variablen)
- [ ] `/api/portal/health` returns `ok: true`
- [ ] QA Script 12/12 bestanden
- [ ] Test Login: info@leadely.de funktioniert
- [ ] Credentials separat übermittelt (nicht per E-Mail)
- [ ] Handover-Dokument gesendet

---

## Rollback

### Option A: Revert Commit
```bash
git revert <<last_known_good_sha>>
git push
# Render auto-deploys
```

### Option B: ENV Disable (Fail-Closed)
```bash
# In Render Dashboard:
# Setze CLIENT_PORTAL_USERS_JSON auf ungültigen Wert:
CLIENT_PORTAL_USERS_JSON=[]

# Oder setze CLIENT_PORTAL_CONFIG_JSON auf leeres Objekt:
CLIENT_PORTAL_CONFIG_JSON={}

# Redeploy → Portal gibt 503 PORTAL_NOT_READY zurück
```

---

## Filter Configuration

| Field | Value |
|-------|-------|
| **mode** | voiceAgent |
| **field** | voiceAgentId |
| **value** | 123 |

> Nur Calls mit `voiceAgentId = 123` werden im Leadely Portal angezeigt.

---

*Letzte Aktualisierung: Januar 2026*
