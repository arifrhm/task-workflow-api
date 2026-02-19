#!/bin/bash
# Load Test: Idempotency
# Send 100 concurrent requests with the SAME idempotency key
# Should all return the SAME task (no duplicates)

BASE_URL="http://localhost:3000/api"
WORKSPACE_ID="workspace_load_test"
TENANT_ID="tenant_load_test"
MANAGER_ROLE="manager"
IDEMPOTENCY_KEY="load-test-key-$(date +%s)"

echo "=========================================="
echo "LOAD TEST: IDEMPOTENCY (100 concurrent requests)"
echo "=========================================="
echo "Idempotency Key: $IDEMPOTENCY_KEY"
echo "Sending 100 concurrent requests..."
echo ""

# Send 100 concurrent requests with the same key
for i in {1..100}; do
  curl -s -X POST "$BASE_URL/v1/workspaces/$WORKSPACE_ID/tasks" \
    -H "Content-Type: application/json" \
    -H "X-Tenant-Id: $TENANT_ID" \
    -H "X-Role: $MANAGER_ROLE" \
    -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
    -d "{\"title\": \"Load test task\", \"priority\": \"HIGH\"}" &
done

# Wait for all requests to complete
wait

echo ""
echo "All requests completed!"
echo ""
echo "Checking database for duplicates..."
echo ""

# Count how many tasks were created with this idempotency key
# We'll query the database directly
sqlite3 ~/task-workflow-api/data/tasks.db <<EOF
.mode box
SELECT COUNT(*) as task_count,
       GROUP_CONCAT(task_id, ', ') as task_ids
FROM tasks
WHERE task_id IN (
  SELECT task_id FROM idempotency_keys WHERE key = '$IDEMPOTENCY_KEY'
);
EOF

echo ""
echo "Checking idempotency_keys table..."
sqlite3 ~/task-workflow-api/data/tasks.db <<EOF
.mode box
SELECT key, response
FROM idempotency_keys
WHERE key = '$IDEMPOTENCY_KEY'
LIMIT 1;
EOF

echo ""
echo "=========================================="
echo "RESULT: If task_count = 1, IDEMPOTENCY ✅"
echo "=========================================="
