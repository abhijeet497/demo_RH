#!/bin/bash

# Script to clean up old migration files and keep only the final schema migration

echo "Cleaning up old migration files..."

# Navigate to the migrations directory
cd supabase/migrations

# Remove all old migration files except the final schema
find . -name "*.sql" ! -name "20250115000000_final_schema.sql" -delete

echo "Migration cleanup complete!"
echo "Only the final schema migration remains: 20250115000000_final_schema.sql"
echo ""
echo "To apply this migration to your database:"
echo "1. Run: supabase db reset"
echo "2. Or run: supabase migration up"
