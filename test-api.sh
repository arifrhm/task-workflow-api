#!/bin/bash

BASE_URL="http://localhost:3000/api"
WORKSPACE_ID="workspace_test"
TENANT_ID="tenant_test"
MANAGER_ROLE="manager"
AGENT_ROLE="agent"

echo "=========================================="
echo "1. CREATE TASK (with idempotency key)"
echo "=========================================="
TASK_RESPONSE=$(curl -s -X POST "$BASE_URL/v1/workspaces/$WORKSPACE_ID/tasks" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: $TENANT_ID" \
  -H "X-Role: $MANAGER_ROLE" \
  -H "Idempotency-Key: test-key-001" \
  -d '{"title": "Follow up customer", "priority": "HIGH"}')
echo "$TASK_RESPONSE" | jq '.'
TASK_ID=$(echo "$TASK_RESPONSE" | jq -r '.task.task_id')
echo "Task ID: $TASK_ID"
VERSION=$(echo "$TASK_RESPONSE" | jq -r '.task.version')
echo "Version: $VERSION"

echo ""
echo "=========================================="
echo "2. TEST IDEMPOTENCY (same key again)"
echo "=========================================="
TASK_RESPONSE_2=$(curl -s -X POST "$BASE_URL/v1/workspaces/$WORKSPACE_ID/tasks" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: $TENANT_ID" \
  -H "X-Role: $MANAGER_ROLE" \
  -H "Idempotency-Key: test-key-001" \
  -d '{"title": "Follow up customer", "priority": "HIGH"}')
echo "$TASK_RESPONSE_2" | jq '.'
TASK_ID_2=$(echo "$TASK_RESPONSE_2" | jq -r '.task.task_id')
echo "Task ID from idempotent request: $TASK_ID_2"
echo "Same task? $( [ "$TASK_ID" = "$TASK_ID_2" ] && echo "YES ✅" || echo "NO ❌" )"

echo ""
echo "=========================================="
echo "3. CREATE ANOTHER TASK (different key)"
echo "=========================================="
TASK2_RESPONSE=$(curl -s -X POST "$BASE_URL/v1/workspaces/$WORKSPACE_ID/tasks" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: $TENANT_ID" \
  -H "X-Role: $MANAGER_ROLE" \
  -H "Idempotency-Key: test-key-002" \
  -d '{"title": "Fix critical bug", "priority": "MEDIUM"}')
echo "$TASK2_RESPONSE" | jq '.task'
TASK2_ID=$(echo "$TASK2_RESPONSE" | jq -r '.task.task_id')
echo "Task 2 ID: $TASK2_ID"

echo ""
echo "=========================================="
echo "4. ASSIGN TASK (manager only)"
echo "=========================================="
ASSIGN_RESPONSE=$(curl -s -X POST "$BASE_URL/v1/workspaces/$WORKSPACE_ID/tasks/$TASK_ID/assign" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: $TENANT_ID" \
  -H "X-Role: $MANAGER_ROLE" \
  -H "If-Match-Version: $VERSION" \
  -d '{"assignee_id": "u_agent_123"}')
echo "$ASSIGN_RESPONSE" | jq '.'
VERSION=$(echo "$ASSIGN_RESPONSE" | jq -r '.task.version')
echo "New version after assign: $VERSION"

echo ""
echo "=========================================="
echo "5. TRANSITION NEW -> IN_PROGRESS (agent)"
echo "=========================================="
TRANSITION_1=$(curl -s -X POST "$BASE_URL/v1/workspaces/$WORKSPACE_ID/tasks/$TASK_ID/transition" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: $TENANT_ID" \
  -H "X-Role: $AGENT_ROLE" \
  -H "If-Match-Version: $VERSION" \
  -d '{"to_state": "IN_PROGRESS"}')
echo "$TRANSITION_1" | jq '.'
VERSION=$(echo "$TRANSITION_1" | jq -r '.task.version')
echo "New version: $VERSION"

echo ""
echo "=========================================="
echo "6. TRY COMPLETE UNASSIGNED TASK (should fail)"
echo "=========================================="
# First, create and try to complete without assignment
TASK3_RESPONSE=$(curl -s -X POST "$BASE_URL/v1/workspaces/$WORKSPACE_ID/tasks" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: $TENANT_ID" \
  -H "X-Role: $MANAGER_ROLE" \
  -H "Idempotency-Key: test-key-003" \
  -d '{"title": "Unassigned task"}')
TASK3_ID=$(echo "$TASK3_RESPONSE" | jq -r '.task.task_id')
TASK3_VERSION=$(echo "$TASK3_RESPONSE" | jq -r '.task.version')

FAIL_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$BASE_URL/v1/workspaces/$WORKSPACE_ID/tasks/$TASK3_ID/transition" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: $TENANT_ID" \
  -H "X-Role: $AGENT_ROLE" \
  -H "If-Match-Version: $TASK3_VERSION" \
  -d '{"to_state": "DONE"}')
echo "$FAIL_RESPONSE" | grep -E "HTTP_CODE|error"

echo ""
echo "=========================================="
echo "7. TRANSITION TO DONE (agent with assignment)"
echo "=========================================="
TRANSITION_2=$(curl -s -X POST "$BASE_URL/v1/workspaces/$WORKSPACE_ID/tasks/$TASK_ID/transition" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: $TENANT_ID" \
  -H "X-Role: $AGENT_ROLE" \
  -H "If-Match-Version: $VERSION" \
  -d '{"to_state": "DONE"}')
echo "$TRANSITION_2" | jq '.'

echo ""
echo "=========================================="
echo "8. TRY INVALID TRANSITION (should fail)"
echo "=========================================="
INVALID_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$BASE_URL/v1/workspaces/$WORKSPACE_ID/tasks/$TASK_ID/transition" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: $TENANT_ID" \
  -H "X-Role: $AGENT_ROLE" \
  -H "If-Match-Version: 4" \
  -d '{"to_state": "CANCELLED"}')
echo "$INVALID_RESPONSE" | grep -E "HTTP_CODE|error"

echo ""
echo "=========================================="
echo "9. GET TASK WITH TIMELINE"
echo "=========================================="
GET_TASK=$(curl -s "$BASE_URL/v1/workspaces/$WORKSPACE_ID/tasks/$TASK_ID" \
  -H "X-Tenant-Id: $TENANT_ID" \
  -H "X-Role: $MANAGER_ROLE")
echo "$GET_TASK" | jq '{task: .task | {task_id, state, assignee_id, version}, timeline_count: (.timeline | length), timeline: .timeline[0:3]}'

echo ""
echo "=========================================="
echo "10. LIST TASKS (filtered)"
echo "=========================================="
LIST_TASKS=$(curl -s "$BASE_URL/v1/workspaces/$WORKSPACE_ID/tasks?state=DONE&limit=5" \
  -H "X-Tenant-Id: $TENANT_ID" \
  -H "X-Role: $MANAGER_ROLE")
echo "$LIST_TASKS" | jq '{count: (.tasks | length), next_cursor: .next_cursor}'

echo ""
echo "=========================================="
echo "11. GET EVENTS (outbox)"
echo "=========================================="
EVENTS=$(curl -s "$BASE_URL/v1/events?limit=5" \
  -H "X-Tenant-Id: $TENANT_ID" \
  -H "X-Role: $MANAGER_ROLE")
echo "$EVENTS" | jq '{count: .events.length, events: .events[0:3]}'

echo ""
echo "=========================================="
echo "12. TEST VERSION CONFLICT (optimistic locking)"
echo "=========================================="
# Create a task for conflict test
CONFLICT_TASK=$(curl -s -X POST "$BASE_URL/v1/workspaces/$WORKSPACE_ID/tasks" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: $TENANT_ID" \
  -H "X-Role: $MANAGER_ROLE" \
  -H "Idempotency-Key: test-key-conflict" \
  -d '{"title": "Conflict test task"}')
CONFLICT_TASK_ID=$(echo "$CONFLICT_TASK" | jq -r '.task.task_id')
CONFLICT_VERSION=$(echo "$CONFLICT_TASK" | jq -r '.task.version')

# First update succeeds
ASSIGN_1=$(curl -s -X POST "$BASE_URL/v1/workspaces/$WORKSPACE_ID/tasks/$CONFLICT_TASK_ID/assign" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: $TENANT_ID" \
  -H "X-Role: $MANAGER_ROLE" \
  -H "If-Match-Version: $CONFLICT_VERSION" \
  -d '{"assignee_id": "u_1"}')
echo "First assign (should succeed): $(echo "$ASSIGN_1" | jq -r '.task.assignee_id')"

# Second update with old version (should fail)
CONFLICT_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$BASE_URL/v1/workspaces/$WORKSPACE_ID/tasks/$CONFLICT_TASK_ID/assign" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: $TENANT_ID" \
  -H "X-Role: $MANAGER_ROLE" \
  -H "If-Match-Version: $CONFLICT_VERSION" \
  -d '{"assignee_id": "u_2"}')
echo "$CONFLICT_RESPONSE" | grep -E "HTTP_CODE|error|Version"

echo ""
echo "=========================================="
echo "13. HEALTH CHECK"
echo "=========================================="
HEALTH=$(curl -s http://localhost:3000/health)
echo "$HEALTH" | jq '.'

echo ""
echo "=========================================="
echo "ALL SCENARIOS COMPLETED ✅"
echo "=========================================="
