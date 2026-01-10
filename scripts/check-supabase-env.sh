#!/usr/bin/env bash
set -euo pipefail

missing=0
if [ -z "${NEXT_PUBLIC_SUPABASE_URL-}" ]; then
  echo "MISSING: NEXT_PUBLIC_SUPABASE_URL"
  missing=1
fi
if [ -z "${NEXT_PUBLIC_SUPABASE_ANON_KEY-}" ]; then
  echo "MISSING: NEXT_PUBLIC_SUPABASE_ANON_KEY"
  missing=1
fi

if [ "$missing" -eq 1 ]; then
  echo "Supabase environment variables are not fully configured. Please set the required variables and try again."
  exit 2
fi

echo "Supabase environment variables OK"