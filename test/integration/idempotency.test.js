/**
 * Integration Test: Idempotency
 * Tests that repeated requests with same Idempotency-Key return same response
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import {
  setupTestDatabase,
  setupRepositories,
  setupUseCases,
  sleep
} from '../helpers/testHelper.js';

describe('Idempotency Tests', () => {
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

  it('should return same task for repeated requests with same idempotency key', async () => {
    const idempotencyKey = 'test-key-123';
    const createData = {
      tenant_id: 'tenant_1',
      workspace_id: 'workspace_1',
      title: 'Follow up customer',
      priority: 'HIGH'
    };

    // First request
    const result1 = await useCases.createTask.execute(createData, idempotencyKey);
    const taskId1 = result1.task.task_id;

    // Wait a bit
    await sleep(10);

    // Second request with same key
    const result2 = await useCases.createTask.execute(createData, idempotencyKey);
    const taskId2 = result2.task.task_id;

    // Should return the same task
    assert.strictEqual(taskId1, taskId2, 'Task IDs should be the same');
    assert.strictEqual(result1.task.title, result2.task.title, 'Titles should match');
    assert.strictEqual(result1.task.priority, result2.task.priority, 'Priorities should match');
  });

  it('should create different tasks for requests with different idempotency keys', async () => {
    const key1 = 'test-key-456';
    const key2 = 'test-key-789';

    const createData = {
      tenant_id: 'tenant_1',
      workspace_id: 'workspace_1',
      title: 'Another task',
      priority: 'LOW'
    };

    // First request with key1
    const result1 = await useCases.createTask.execute(createData, key1);
    const taskId1 = result1.task.task_id;

    // Second request with key2
    const result2 = await useCases.createTask.execute(createData, key2);
    const taskId2 = result2.task.task_id;

    // Should create different tasks
    assert.notStrictEqual(taskId1, taskId2, 'Task IDs should be different');
  });

  it('should create different tasks when no idempotency key is provided', async () => {
    const createData = {
      tenant_id: 'tenant_1',
      workspace_id: 'workspace_1',
      title: 'Task without idempotency',
      priority: 'MEDIUM'
    };

    // First request without key
    const result1 = await useCases.createTask.execute(createData);
    const taskId1 = result1.task.task_id;

    // Second request without key
    const result2 = await useCases.createTask.execute(createData);
    const taskId2 = result2.task.task_id;

    // Should create different tasks
    assert.notStrictEqual(taskId1, taskId2, 'Task IDs should be different');
  });
});
