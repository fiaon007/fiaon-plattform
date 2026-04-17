#!/bin/bash

# Run migration 017 on Render database
# Usage: ./run-migration-017.sh

if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL environment variable is not set"
  echo "Please set it with: export DATABASE_URL='your-render-postgres-url'"
  exit 1
fi

echo "Running migration 017: Add Stripe subscription fields..."
psql "$DATABASE_URL" -f db/migrations/017_add_stripe_subscription_fields.sql

if [ $? -eq 0 ]; then
  echo "✅ Migration completed successfully!"
else
  echo "❌ Migration failed!"
  exit 1
fi
