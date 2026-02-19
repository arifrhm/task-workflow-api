/**
 * Integration Test: Outbox Events
 * Tests that events are created for task operations
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import {
  setupTestDatabase,
  setupRepositories,
  setupUseCases,
  createSampleTask
} from '../helpers/testHelper.js';
import { EventType } from '../../src/domain/entities/TaskEvent.js';
import { TaskState, UserRole } from '../../src/domain/entities/Task.js';

describe('Outbox Events Tests', () => {
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

  it('should create TASK_CREATED event on task creation', async () => {
    const result = await useCases.createTask.execute({
      tenant_id: 'tenant_1',
      workspace_id: 'workspace_1',
      title: 'Test task for events',
      priority: 'MEDIUM'
    });

    const task = result.task;
    const events = await repositories.taskRepository.findEventsByTaskId(task.task_id, 10);

    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].event_type, EventType.TASK_CREATED);
    assert.strictEqual(events[0].event_data.title, 'Test task for events');
    assert.strictEqual(events[0].event_data.priority, 'MEDIUM');
    assert.strictEqual(events[0].event_data.initial_state, TaskState.NEW);
  });

  it('should create TASK_ASSIGNED event on assignment', async () => {
    const task = await createSampleTask(useCases.createTask);

    await useCases.assignTask.execute(
      task.workspace_id,
      task.task_id,
      'u_123',
      UserRole.MANAGER,
      task.version
    );

    const events = await repositories.taskRepository.findEventsByTaskId(task.task_id, 10);

    // Should have 2 events: TASK_CREATED and TASK_ASSIGNED
    assert.strictEqual(events.length, 2);
    assert.strictEqual(events[0].event_type, EventType.TASK_ASSIGNED);
    assert.strictEqual(events[0].event_data.assignee_id, 'u_123');
    assert.strictEqual(events[0].event_data.previous_assignee, null);
  });

  it('should create TASK_STATE_CHANGED event on state transition', async () => {
    const task = await createSampleTask(useCases.createTask);

    await useCases.transitionTaskState.execute(
      task.workspace_id,
      task.task_id,
      TaskState.IN_PROGRESS,
      UserRole.AGENT,
      task.version
    );

    const events = await repositories.taskRepository.findEventsByTaskId(task.task_id, 10);

    // Should have 2 events: TASK_CREATED and TASK_STATE_CHANGED
    assert.strictEqual(events.length, 2);
    assert.strictEqual(events[0].event_type, EventType.TASK_STATE_CHANGED);
    assert.strictEqual(events[0].event_data.from_state, TaskState.NEW);
    assert.strictEqual(events[0].event_data.to_state, TaskState.IN_PROGRESS);
    assert.strictEqual(events[0].event_data.changed_by, UserRole.AGENT);
  });

  it('should maintain event order by creation time', async () => {
    const task = await createSampleTask(useCases.createTask);

    // Assign task
    await useCases.assignTask.execute(
      task.workspace_id,
      task.task_id,
      'u_456',
      UserRole.MANAGER,
      task.version
    );

    // Transition to IN_PROGRESS
    await useCases.transitionTaskState.execute(
      task.workspace_id,
      task.task_id,
      TaskState.IN_PROGRESS,
      UserRole.AGENT,
      2
    );

    // Get all events
    const events = await repositories.taskRepository.findEventsByTaskId(task.task_id, 20);

    assert.strictEqual(events.length, 3);

    // Events should be in reverse chronological order (newest first)
    assert.strictEqual(events[0].event_type, EventType.TASK_STATE_CHANGED);
    assert.strictEqual(events[1].event_type, EventType.TASK_ASSIGNED);
    assert.strictEqual(events[2].event_type, EventType.TASK_CREATED);
  });

  it('should limit timeline to last 20 events', async () => {
    const result = await useCases.createTask.execute({
      tenant_id: 'tenant_1',
      workspace_id: 'workspace_1',
      title: 'Task with many events',
      priority: 'MEDIUM'
    });

    const task = result.task;

    // Create multiple assignments to generate events
    let currentVersion = task.version;
    for (let i = 1; i <= 25; i++) {
      await useCases.assignTask.execute(
        task.workspace_id,
        task.task_id,
        `u_${i}`,
        UserRole.MANAGER,
        currentVersion
      );
      currentVersion++; // Increment for next iteration
    }

    // Get events with limit 20
    const events = await repositories.taskRepository.findEventsByTaskId(task.task_id, 20);

    assert.strictEqual(events.length, 20);
    assert.strictEqual(events[0].event_type, EventType.TASK_ASSIGNED);
  });

  it('should include events in task timeline via GetTask use case', async () => {
    const task = await createSampleTask(useCases.createTask);

    await useCases.assignTask.execute(
      task.workspace_id,
      task.task_id,
      'u_789',
      UserRole.MANAGER,
      task.version
    );

    await useCases.transitionTaskState.execute(
      task.workspace_id,
      task.task_id,
      TaskState.IN_PROGRESS,
      UserRole.AGENT,
      2
    );

    const result = await useCases.getTask.execute(task.workspace_id, task.task_id);

    assert.ok(result.task);
    assert.ok(result.timeline);
    assert.strictEqual(result.timeline.length, 3);
    assert.strictEqual(result.timeline[0].event_type, EventType.TASK_STATE_CHANGED);
  });
});
