#!/bin/bash
# ============================================================================
# ARAS Command Center - Internal CRM Migration Script
# ============================================================================
# Dieses Script führt die Internal CRM Migration sicher aus
# ============================================================================

echo "🚀 ARAS Command Center - Internal CRM Migration"
echo "================================================"
echo ""
echo "⚠️  WICHTIG: Dieses Script erweitert die Datenbank um das interne CRM-System"
echo "✅ SICHER: Alle bestehenden Daten bleiben unverändert"
echo ""

# Prüfe ob DATABASE_URL gesetzt ist
if [ -z "$DATABASE_URL" ]; then
  echo "❌ Fehler: DATABASE_URL ist nicht gesetzt!"
  echo "Bitte setze DATABASE_URL in deiner .env Datei"
  exit 1
fi

echo "📊 Datenbank: ${DATABASE_URL%@*}@***"
echo ""
read -p "Migration jetzt ausführen? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]
then
  echo ""
  echo "🔧 Führe Migration aus..."
  echo ""
  
  # Führe Migration aus
  psql "$DATABASE_URL" -f db/migrations/add_internal_crm_system.sql
  
  if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration erfolgreich abgeschlossen!"
    echo ""
    echo "📋 Nächste Schritte:"
    echo "1. Setze deinen User als Admin:"
    echo "   psql \"\$DATABASE_URL\" -c \"UPDATE users SET user_role = 'admin' WHERE username = 'DEIN-USERNAME';\""
    echo ""
    echo "2. Starte den Server neu:"
    echo "   npm run dev"
    echo ""
    echo "3. Öffne /internal/dashboard (nur für Admin/Staff sichtbar)"
    echo ""
  else
    echo ""
    echo "❌ Migration fehlgeschlagen!"
    echo "Bitte prüfe die Fehlermeldung oben"
    exit 1
  fi
else
  echo ""
  echo "❌ Migration abgebrochen"
  exit 0
fi
