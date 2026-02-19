/**
 * Integration Test: Optimistic Locking
 * Tests version-based concurrency control
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import {
  setupTestDatabase,
  setupRepositories,
  setupUseCases,
  createSampleTask
} from '../helpers/testHelper.js';
import { TaskState, UserRole } from '../../src/domain/entities/Task.js';

describe('Optimistic Locking Tests', () => {
  let db;
  let repositories;
  let useCases;

  before(() => {
    db = setupTestDatabase();
    repositories = setupRepositories(db);
    useCases = setupUseCases(repositories.taskRepository, repositories.idempotencyRepository);
  });

  after(() => {
    db.close();
  });

  it('should reject update with version mismatch', async () => {
    const task = await createSampleTask(useCases.createTask);
    const initialVersion = task.version;

    // First update with correct version
    await useCases.assignTask.execute(
      task.workspace_id,
      task.task_id,
      'u_123',
      UserRole.MANAGER,
      initialVersion
    );

    // Try to update again with old version (should fail)
    try {
      await useCases.assignTask.execute(
        task.workspace_id,
        task.task_id,
        'u_456',
        UserRole.MANAGER,
        initialVersion // Using old version!
      );
      assert.fail('Should have thrown a version conflict error');
    } catch (error) {
      assert.ok(error.message.includes('Version conflict'));
    }
  });

  it('should allow update with correct version', async () => {
    const task = await createSampleTask(useCases.createTask);
    const initialVersion = task.version;

    // Update with correct version
    const result = await useCases.assignTask.execute(
      task.workspace_id,
      task.task_id,
      'u_789',
      UserRole.MANAGER,
      initialVersion
    );

    assert.strictEqual(result.task.assignee_id, 'u_789');
    assert.strictEqual(result.task.version, initialVersion + 1);
  });

  it('should increment version on each update', async () => {
    const task = await createSampleTask(useCases.createTask);
    let currentVersion = task.version;

    // First assignment
    let result = await useCases.assignTask.execute(
      task.workspace_id,
      task.task_id,
      'u_111',
      UserRole.MANAGER,
      currentVersion
    );
    currentVersion = result.task.version;
    assert.strictEqual(currentVersion, 2);

    // Second assignment
    result = await useCases.assignTask.execute(
      task.workspace_id,
      task.task_id,
      'u_222',
      UserRole.MANAGER,
      currentVersion
    );
    currentVersion = result.task.version;
    assert.strictEqual(currentVersion, 3);

    // State transition
    result = await useCases.transitionTaskState.execute(
      task.workspace_id,
      task.task_id,
      TaskState.IN_PROGRESS,
      UserRole.AGENT,
      currentVersion
    );
    assert.strictEqual(result.task.version, 4);
  });

  it('should handle concurrent update attempts correctly', async () => {
    const task = await createSampleTask(useCases.createTask);
    const initialVersion = task.version;

    // First update succeeds
    const result1 = await useCases.assignTask.execute(
      task.workspace_id,
      task.task_id,
      'u_333',
      UserRole.MANAGER,
      initialVersion
    );

    // Concurrent update with stale version fails
    try {
      await useCases.assignTask.execute(
        task.workspace_id,
        task.task_id,
        'u_444',
        UserRole.MANAGER,
        initialVersion // Stale version
      );
      assert.fail('Should have thrown a version conflict error');
    } catch (error) {
      assert.ok(error.message.includes('Version conflict'));
    }

    // Verify only first update was applied
    const getTaskResult = await useCases.getTask.execute(task.workspace_id, task.task_id);
    assert.strictEqual(getTaskResult.task.assignee_id, 'u_333');
  });
});
