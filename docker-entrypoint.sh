#!/bin/sh
set -e

# Wait for PostgreSQL database if DB_HOST is configured
if [ "$DB_ENGINE" = "django.db.backends.postgresql" ] && [ -n "$DB_HOST" ]; then
    echo "Waiting for PostgreSQL at $DB_HOST:${DB_PORT:-5432}..."
    while ! python3 -c "import socket, sys; s = socket.socket(); s.settimeout(1); sys.exit(0 if s.connect_ex(('$DB_HOST', int('${DB_PORT:-5432}'))) == 0 else 1)" 2>/dev/null; do
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
