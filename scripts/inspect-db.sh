#!/usr/bin/env bash
# Inspecciona la base de datos SQLite de COCO Parking.
# Ubicación por defecto (Linux): ~/.local/share/com.cocoparking.app/coco_parking.db
# Requiere: sqlite3 (apt install sqlite3)

set -e
IDENTIFIER="com.cocoparking.app"
DEFAULT_DB="${XDG_DATA_HOME:-$HOME/.local/share}/${IDENTIFIER}/coco_parking.db"
DB_PATH="${COCO_PARKING_DB:-$DEFAULT_DB}"

if [ ! -f "$DB_PATH" ]; then
  echo "No se encontró la base de datos en: $DB_PATH"
  echo "La base se crea la primera vez que ejecutas la app Tauri (npm run tauri dev)."
  echo "Para usar otra ruta: COCO_PARKING_DB=/ruta/a/coco_parking.db $0"
  exit 1
fi

echo "=== Base de datos: $DB_PATH ==="
echo ""

echo "--- Tablas ---"
sqlite3 "$DB_PATH" ".tables"

echo ""
echo "--- schema_version ---"
sqlite3 -header -column "$DB_PATH" "SELECT * FROM schema_version;"

echo ""
echo "--- vehicles (últimos 20) ---"
sqlite3 -header -column "$DB_PATH" "
  SELECT id, ticket_code, plate, vehicle_type, status, entry_time, exit_time, total_amount, debt
  FROM vehicles
  ORDER BY entry_time DESC
  LIMIT 20;
"

echo ""
echo "--- transactions (últimas 20) ---"
sqlite3 -header -column "$DB_PATH" "
  SELECT id, vehicle_id, amount, method, created_at
  FROM transactions
  ORDER BY created_at DESC
  LIMIT 20;
"

echo ""
echo "--- Resumen ---"
sqlite3 "$DB_PATH" "
  SELECT 'vehicles' AS tabla, COUNT(*) AS total FROM vehicles
  UNION ALL
  SELECT 'transactions', COUNT(*) FROM transactions;
"

echo ""
echo "--- Tesorería hoy (suma por método) ---"
sqlite3 -header -column "$DB_PATH" "
  SELECT method AS metodo, COUNT(*) AS transacciones, SUM(amount) AS total
  FROM transactions
  WHERE date(created_at) = date('now')
  GROUP BY method;
"
