#!/bin/sh
set -e

# Wait for PostgreSQL database if DB_HOST is configured
if [ "$DB_ENGINE" = "django.db.backends.postgresql" ] && [ -n "$DB_HOST" ]; then
    echo "Waiting for PostgreSQL at $DB_HOST:${DB_PORT:-5432}..."
    while ! nc -z "$DB_HOST" "${DB_PORT:-5432}" 2>/dev/null; do
        sleep 1
    done
    echo "PostgreSQL is available!"
fi

echo "Applying database migrations..."
python manage.py migrate --noinput

echo "Collecting static assets..."
python manage.py collectstatic --noinput --clear || true

echo "Starting application server..."
exec "$@"
