#!/bin/sh
set -e

echo "==> Running database migration..."
prisma migrate deploy

echo "==> Starting Next.js server..."
exec node server.js
