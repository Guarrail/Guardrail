#!/bin/sh
set -e

# Wait for database if POSTGRES_HOST or DB_HOST is configured or default 'db' is reachable
DB_TARGET_HOST="${POSTGRES_HOST:-${DB_HOST:-db}}"
DB_TARGET_PORT="${POSTGRES_PORT:-${DB_PORT:-5432}}"

if [ -n "$DB_TARGET_HOST" ]; then
    echo "Checking database connectivity at $DB_TARGET_HOST:$DB_TARGET_PORT..."
    MAX_RETRIES=30
    COUNT=0
    while ! python3 -c "import socket, sys; s = socket.socket(); s.settimeout(1); sys.exit(0 if s.connect_ex(('$DB_TARGET_HOST', int('$DB_TARGET_PORT'))) == 0 else 1)" 2>/dev/null; do
        COUNT=$((COUNT+1))
        if [ $COUNT -ge $MAX_RETRIES ]; then
            echo "Warning: Database not reachable at $DB_TARGET_HOST:$DB_TARGET_PORT after $MAX_RETRIES seconds. Proceeding..."
            break
        fi
        sleep 1
    done
    echo "Database connectivity confirmed."
fi

# Run migrations and static collection only when RUN_MIGRATIONS is not explicitly set to false
if [ "$RUN_MIGRATIONS" != "false" ]; then
    echo "Applying database migrations..."
    python manage.py migrate --noinput

    # Ensure persistent administrative superuser exists without modifying existing records
    echo "Verifying administrative superuser preservation..."
    python manage.py shell -c "
import os
from django.contrib.auth import get_user_model
User = get_user_model()
username = os.getenv('DJANGO_SUPERUSER_USERNAME', 'guardrail')
password = os.getenv('DJANGO_SUPERUSER_PASSWORD', 'master2025')
email = os.getenv('DJANGO_SUPERUSER_EMAIL', 'admin@guardrail.stellar')
if not User.objects.filter(username=username).exists():
    User.objects.create_superuser(username=username, email=email, password=password)
    print(f'Superuser {username} created and initialized.')
else:
    print(f'Superuser {username} verified and preserved.')
" || true

    echo "Collecting static assets..."
    python manage.py collectstatic --noinput --clear || true
else
    echo "Skipping migrations and static collection (RUN_MIGRATIONS=false)..."
fi

echo "Starting application service: $@"
exec "$@"
