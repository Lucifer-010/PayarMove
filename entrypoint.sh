#!/bin/sh
set -e

echo "Waiting for PostgreSQL to start..."
while ! nc -z ${POSTGRES_HOST:-db} ${POSTGRES_PORT:-5432}; do
  sleep 0.5
done
echo "PostgreSQL is ready!"

# Run migrations and collectstatic only for the web server or when explicitly enabled
if [ "$RUN_MIGRATIONS" = "true" ] || { [ "$RUN_MIGRATIONS" != "false" ] && { [ "$1" = "gunicorn" ] || [ "$2" = "runserver" ]; }; }; then
  echo "Applying database migrations..."
  python manage.py migrate --noinput

  echo "Collecting static files for WhiteNoise..."
  python manage.py collectstatic --noinput || true

  # Run seed_data ONLY if explicitly requested via SEED_DATA=true
  if [ "$SEED_DATA" = "true" ]; then
    echo "SEED_DATA=true: seeding platform data..."
    python manage.py seed_data || true
  else
    echo "Skipping automatic seed_data: database state and user data are preserved across re-deployments."
  fi
fi

exec "$@"

