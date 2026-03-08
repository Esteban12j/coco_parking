#!/usr/bin/env bash
# Verifica si hay datos en la BD entre 2026-01-01 y 2026-01-02 para reportes.
# Uso: ./scripts/check-report-range.sh
# Opcional: COCO_PARKING_DB=/ruta/a/coco_parking.db ./scripts/check-report-range.sh

set -e
IDENTIFIER="com.cocoparking.app"
DEFAULT_DB="${XDG_DATA_HOME:-$HOME/.local/share}/${IDENTIFIER}/coco_parking.db"
DB_PATH="${COCO_PARKING_DB:-$DEFAULT_DB}"

if [ ! -f "$DB_PATH" ]; then
  echo "DB not found: $DB_PATH"
  echo "Set COCO_PARKING_DB or run the Tauri app once to create the DB."
  exit 1
fi

echo "=== DB: $DB_PATH ==="
echo ""

echo "--- 1) transactions between 2026-01-01 and 2026-01-02 (inclusive) ---"
echo "    Backend uses: created_at >= '2026-01-01%' AND created_at < '2026-01-02 23:59:59.999'"
sqlite3 -header -column "$DB_PATH" "
  SELECT id, amount, method, created_at
  FROM transactions
  WHERE created_at >= '2026-01-01'
    AND created_at < '2026-01-03T00:00:00'
  ORDER BY created_at
  LIMIT 20;
"
COUNT_T=$(sqlite3 "$DB_PATH" "
  SELECT COUNT(*) FROM transactions
  WHERE created_at >= '2026-01-01' AND created_at < '2026-01-03T00:00:00';
")
echo "    Total transactions in range: $COUNT_T"
echo ""

echo "--- 2) Same range with backend-style end (space) ---"
sqlite3 -header -column "$DB_PATH" "
  SELECT id, amount, method, created_at
  FROM transactions
  WHERE created_at >= '2026-01-01%'
    AND created_at < '2026-01-02 23:59:59.999'
  ORDER BY created_at
  LIMIT 20;
"
COUNT_BUG=$(sqlite3 "$DB_PATH" "
  SELECT COUNT(*) FROM transactions
  WHERE created_at >= '2026-01-01%' AND created_at < '2026-01-02 23:59:59.999';
")
echo "    Total with backend-style end: $COUNT_BUG"
echo ""

echo "--- 3) Sample created_at format ---"
sqlite3 "$DB_PATH" "SELECT created_at FROM transactions LIMIT 1;"
echo ""

echo "--- 4) completed vehicles (exit_time 2026-01-01 .. 2026-01-02) ---"
sqlite3 -header -column "$DB_PATH" "
  SELECT id, plate, vehicle_type, exit_time
  FROM vehicles
  WHERE status = 'completed' AND exit_time IS NOT NULL
    AND exit_time >= '2026-01-01' AND exit_time < '2026-01-03T00:00:00'
  LIMIT 10;
"
COUNT_V=$(sqlite3 "$DB_PATH" "
  SELECT COUNT(*) FROM vehicles
  WHERE status = 'completed' AND exit_time IS NOT NULL
    AND exit_time >= '2026-01-01' AND exit_time < '2026-01-03T00:00:00';
")
echo "    Total completed vehicles in range: $COUNT_V"
echo ""

echo "--- 5) shift_closures in range ---"
sqlite3 -header -column "$DB_PATH" "
  SELECT id, closed_at, expected_total
  FROM shift_closures
  WHERE closed_at >= '2026-01-01' AND closed_at < '2026-01-03T00:00:00'
  LIMIT 10;
"
COUNT_S=$(sqlite3 "$DB_PATH" "
  SELECT COUNT(*) FROM shift_closures
  WHERE closed_at >= '2026-01-01' AND closed_at < '2026-01-03T00:00:00';
")
echo "    Total shift_closures in range: $COUNT_S"
