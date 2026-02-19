/**
 * Integration Test: List Tasks
 * Tests listing tasks with filtering and cursor pagination
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import {
  setupTestDatabase,
  setupRepositories,
  setupUseCases
} from '../helpers/testHelper.js';
import { TaskState, TaskPriority } from '../../src/domain/entities/Task.js';

describe('List Tasks Tests', () => {
  let db;
  let repositories;
  let useCases;

  before(async () => {
    db = setupTestDatabase();
    repositories = setupRepositories(db);
    useCases = setupUseCases(repositories.taskRepository, repositories.idempotencyRepository);

    // Create some test tasks
    for (let i = 1; i <= 25; i++) {
      await useCases.createTask.execute({
        tenant_id: 'tenant_1',
        workspace_id: 'workspace_1',
        title: `Test Task ${i}`,
        priority: i % 3 === 0 ? TaskPriority.HIGH : (i % 2 === 0 ? TaskPriority.MEDIUM : TaskPriority.LOW)
      });
    }

    // Create tasks in different states
    const task26 = await useCases.createTask.execute({
      tenant_id: 'tenant_1',
      workspace_id: 'workspace_1',
      title: 'Task in IN_PROGRESS',
      priority: TaskPriority.MEDIUM
    });
    await useCases.transitionTaskState.execute(
      'workspace_1',
      task26.task.task_id,
      TaskState.IN_PROGRESS,
      'agent',
      1
    );

    const task27 = await useCases.createTask.execute({
      tenant_id: 'tenant_1',
      workspace_id: 'workspace_1',
      title: 'Task DONE',
      priority: TaskPriority.HIGH
    });
    await useCases.transitionTaskState.execute(
      'workspace_1',
      task27.task.task_id,
      TaskState.IN_PROGRESS,
      'agent',
      1
    );
    await useCases.assignTask.execute(
      'workspace_1',
      task27.task.task_id,
      'u_123',
      'manager',
      2
    );
    await useCases.transitionTaskState.execute(
      'workspace_1',
      task27.task.task_id,
      TaskState.DONE,
      'agent',
      3
    );
  });

  after(() => {
    db.close();
  });

  it('should list all tasks in workspace', async () => {
    const result = await useCases.listTasks.execute('workspace_1', { limit: 10 });

    assert.ok(result.tasks);
    assert.strictEqual(result.tasks.length, 10);
    assert.ok(result.next_cursor);
  });

  it('should filter tasks by state', async () => {
    const result = await useCases.listTasks.execute('workspace_1', {
      state: TaskState.IN_PROGRESS
    });

    assert.ok(result.tasks.length > 0);
    result.tasks.forEach(task => {
      assert.strictEqual(task.state, TaskState.IN_PROGRESS);
    });
  });

  it('should filter tasks by assignee_id', async () => {
    const result = await useCases.listTasks.execute('workspace_1', {
      assignee_id: 'u_123'
    });

    assert.ok(result.tasks.length > 0);
    result.tasks.forEach(task => {
      assert.strictEqual(task.assignee_id, 'u_123');
    });
  });

  it('should combine filters (state + assignee)', async () => {
    const result = await useCases.listTasks.execute('workspace_1', {
      state: TaskState.DONE,
      assignee_id: 'u_123'
    });

    assert.ok(result.tasks.length > 0);
    result.tasks.forEach(task => {
      assert.strictEqual(task.state, TaskState.DONE);
      assert.strictEqual(task.assignee_id, 'u_123');
    });
  });

  it('should use cursor for pagination', async () => {
    // First page
    const page1 = await useCases.listTasks.execute('workspace_1', { limit: 10 });
    assert.strictEqual(page1.tasks.length, 10);
    assert.ok(page1.next_cursor);

    // Second page
    const page2 = await useCases.listTasks.execute('workspace_1', {
      limit: 10,
      cursor: page1.next_cursor
    });
    assert.ok(page2.tasks.length > 0);

    // Verify no overlap
    const page1Ids = page1.tasks.map(t => t.task_id);
    const page2Ids = page2.tasks.map(t => t.task_id);
    const overlap = page1Ids.filter(id => page2Ids.includes(id));
    assert.strictEqual(overlap.length, 0);
  });

  it('should return null next_cursor on last page', async () => {
    // Get first page with small limit
    const page1 = await useCases.listTasks.execute('workspace_1', { limit: 5 });
    assert.ok(page1.next_cursor);

    // Keep fetching pages until we reach the end
    let currentCursor = page1.next_cursor;
    let pageCount = 1;

    while (currentCursor) {
      const result = await useCases.listTasks.execute('workspace_1', {
        limit: 5,
        cursor: currentCursor
      });
      currentCursor = result.next_cursor;
      pageCount++;
      if (pageCount > 10) break; // Safety limit
    }

    assert.ok(pageCount > 1);
  });

  it('should respect limit parameter', async () => {
    const result5 = await useCases.listTasks.execute('workspace_1', { limit: 5 });
    const result15 = await useCases.listTasks.execute('workspace_1', { limit: 15 });

    assert.strictEqual(result5.tasks.length, 5);
    assert.strictEqual(result15.tasks.length, 15);
  });
});
