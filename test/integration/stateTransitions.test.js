/**
 * Integration Test: State Transitions
 * Tests state machine validation and role-based authorization
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

describe('State Transition Tests', () => {
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

  it('should return 409 for invalid state transition', async () => {
    const task = await createSampleTask(useCases.createTask);

    // Try invalid transition: DONE -> CANCELLED (not allowed)
    // First, move to DONE
    await useCases.transitionTaskState.execute(
      task.workspace_id,
      task.task_id,
      TaskState.IN_PROGRESS,
      UserRole.AGENT,
      task.version
    );

    await useCases.assignTask.execute(
      task.workspace_id,
      task.task_id,
      'u_123',
      UserRole.MANAGER,
      2
    );

    await useCases.transitionTaskState.execute(
      task.workspace_id,
      task.task_id,
      TaskState.DONE,
      UserRole.AGENT,
      3
    );

    // Now try to transition from DONE to CANCELLED (invalid)
    const getTaskResult = await useCases.getTask.execute(task.workspace_id, task.task_id);
    const currentTask = getTaskResult.task;

    try {
      await useCases.transitionTaskState.execute(
        task.workspace_id,
        task.task_id,
        TaskState.CANCELLED,
        UserRole.AGENT,
        currentTask.version
      );
      assert.fail('Should have thrown an error for invalid transition');
    } catch (error) {
      assert.ok(error.message.includes('Invalid state transition') || error.message.includes('not authorized'));
    }
  });

  it('agent cannot complete unassigned task', async () => {
    const task = await createSampleTask(useCases.createTask);

    // Agent tries to move NEW -> IN_PROGRESS (should work for unassigned)
    await useCases.transitionTaskState.execute(
      task.workspace_id,
      task.task_id,
      TaskState.IN_PROGRESS,
      UserRole.AGENT,
      task.version
    );

    // Get updated task
    const getTaskResult = await useCases.getTask.execute(task.workspace_id, task.task_id);
    const currentTask = getTaskResult.task;

    // Agent tries to complete (IN_PROGRESS -> DONE) without assignment - should fail
    try {
      await useCases.transitionTaskState.execute(
        task.workspace_id,
        task.task_id,
        TaskState.DONE,
        UserRole.AGENT,
        currentTask.version
      );
      assert.fail('Should have thrown an error - agent cannot complete unassigned task');
    } catch (error) {
      assert.ok(error.message.includes('Agent cannot complete unassigned task') || error.message.includes('not authorized'));
    }
  });

  it('agent can complete task assigned to them', async () => {
    const task = await createSampleTask(useCases.createTask);
    const agentId = 'u_456';

    // Manager assigns task to agent
    await useCases.assignTask.execute(
      task.workspace_id,
      task.task_id,
      agentId,
      UserRole.MANAGER,
      task.version
    );

    // Agent moves to IN_PROGRESS
    await useCases.transitionTaskState.execute(
      task.workspace_id,
      task.task_id,
      TaskState.IN_PROGRESS,
      UserRole.AGENT,
      2
    );

    // Get updated task
    const getTaskResult = await useCases.getTask.execute(task.workspace_id, task.task_id);
    const currentTask = getTaskResult.task;

    // Agent completes task (should work)
    const result = await useCases.transitionTaskState.execute(
      task.workspace_id,
      task.task_id,
      TaskState.DONE,
      UserRole.AGENT,
      currentTask.version
    );

    assert.strictEqual(result.task.state, TaskState.DONE);
  });

  it('manager can cancel NEW task', async () => {
    const task = await createSampleTask(useCases.createTask);

    const result = await useCases.transitionTaskState.execute(
      task.workspace_id,
      task.task_id,
      TaskState.CANCELLED,
      UserRole.MANAGER,
      task.version
    );

    assert.strictEqual(result.task.state, TaskState.CANCELLED);
  });

  it('manager can cancel IN_PROGRESS task', async () => {
    const task = await createSampleTask(useCases.createTask);

    // Move to IN_PROGRESS
    await useCases.transitionTaskState.execute(
      task.workspace_id,
      task.task_id,
      TaskState.IN_PROGRESS,
      UserRole.AGENT,
      task.version
    );

    // Get updated task
    const getTaskResult = await useCases.getTask.execute(task.workspace_id, task.task_id);
    const currentTask = getTaskResult.task;

    // Manager cancels
    const result = await useCases.transitionTaskState.execute(
      task.workspace_id,
      task.task_id,
      TaskState.CANCELLED,
      UserRole.MANAGER,
      currentTask.version
    );

    assert.strictEqual(result.task.state, TaskState.CANCELLED);
  });
});
