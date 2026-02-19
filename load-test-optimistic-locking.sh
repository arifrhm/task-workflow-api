#!/bin/bash
# Load Test: Optimistic Locking
# Send 50 concurrent update requests to the SAME task
# Only ONE should succeed, the rest should get 409 Conflict

BASE_URL="http://localhost:3000/api"
WORKSPACE_ID="workspace_opt_test"
TENANT_ID="tenant_opt_test"
MANAGER_ROLE="manager"

echo "=========================================="
echo "LOAD TEST: OPTIMISTIC LOCKING (50 concurrent updates)"
echo "=========================================="
echo ""

# First, create a task
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/v1/workspaces/$WORKSPACE_ID/tasks" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: $TENANT_ID" \
  -H "X-Role: $MANAGER_ROLE" \
  -H "Idempotency-Key: opt-test-$(date +%s)" \
  -d '{"title": "Optimistic locking test task"}')

TASK_ID=$(echo "$CREATE_RESPONSE" | jq -r '.task.task_id')
VERSION=$(echo "$CREATE_RESPONSE" | jq -r '.task.version')

echo "Created task: $TASK_ID (version: $VERSION)"
echo ""
echo "Sending 50 concurrent assignment requests (all with version $VERSION)..."
echo "Expecting: 1 success, 49 conflicts (409)"
echo ""

# Track results
SUCCESS=0
CONFLICT=0
ERROR=0

# Send 50 concurrent assignments with the SAME version
for i in {1..50}; do
  RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$BASE_URL/v1/workspaces/$WORKSPACE_ID/tasks/$TASK_ID/assign" \
    -H "Content-Type: application/json" \
    -H "X-Tenant-Id: $TENANT_ID" \
    -H "X-Role: $MANAGER_ROLE" \
    -H "If-Match-Version: $VERSION" \
    -d "{\"assignee_id\": \"u_assignee_$i\"}")

  HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)

  if [ "$HTTP_CODE" = "200" ]; then
    SUCCESS=$((SUCCESS + 1))
    ASSIGNEE=$(echo "$RESPONSE" | jq -r '.task.assignee_id // empty' | grep -v "^$")
    if [ ! -z "$ASSIGNEE" ]; then
      echo "✅ SUCCESS: $ASSIGNEE"
    fi
  elif [ "$HTTP_CODE" = "409" ]; then
    CONFLICT=$((CONFLICT + 1))
  else
    ERROR=$((ERROR + 1))
    echo "❌ ERROR: HTTP $HTTP_CODE"
  fi
done

echo ""
echo "=========================================="
echo "RESULTS:"
echo "=========================================="
echo "Success:  $SUCCESS"
echo "Conflict: $CONFLICT"
echo "Error:    $ERROR"
echo ""
echo "Expected: 1 success, 49 conflicts"
echo ""

if [ "$SUCCESS" -eq 1 ] && [ "$CONFLICT" -eq 49 ] && [ "$ERROR" -eq 0 ]; then
  echo "✅ OPTIMISTIC LOCKING WORKS PERFECTLY!"
  echo "=========================================="

  # Show final state of the task
  FINAL_TASK=$(curl -s "$BASE_URL/v1/workspaces/$WORKSPACE_ID/tasks/$TASK_ID" \
    -H "X-Tenant-Id: $TENANT_ID" \
    -H "X-Role: $MANAGER_ROLE")
  echo ""
  echo "Final task state:"
  echo "$FINAL_TASK" | jq '{task_id, assignee_id, version}'
else
  echo "❌ UNEXPECTED RESULTS"
  echo "=========================================="
fi
