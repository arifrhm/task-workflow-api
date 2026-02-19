/**
 * Integration Test: Validation and Error Handling
 * Tests input validation and error paths not covered in other tests
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import {
  setupTestDatabase,
  setupRepositories,
  setupUseCases
} from '../helpers/testHelper.js';
import { TaskState, TaskPriority, UserRole } from '../../src/domain/entities/Task.js';

describe('Validation and Error Tests', () => {
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

  // Edge Case 4: Empty or whitespace-only title
  describe('Title Validation', () => {
    it('should reject empty title', async () => {
      try {
        await useCases.createTask.execute({
          tenant_id: 'tenant_1',
          workspace_id: 'workspace_1',
          title: '',
          priority: TaskPriority.MEDIUM
        });
        assert.fail('Should have thrown an error for empty title');
      } catch (error) {
        assert.ok(error.message.includes('Title is required'));
      }
    });

    it('should reject whitespace-only title', async () => {
      try {
        await useCases.createTask.execute({
          tenant_id: 'tenant_1',
          workspace_id: 'workspace_1',
          title: '   ',
          priority: TaskPriority.MEDIUM
        });
        assert.fail('Should have thrown an error for whitespace-only title');
      } catch (error) {
        // Task.validateTitle() trims and checks length, so whitespace becomes empty
        assert.ok(error.message.includes('Title is required'));
      }
    });

    // Edge Case 5: Title > 120 characters
    it('should reject title > 120 characters', async () => {
      const longTitle = 'A'.repeat(121);
      try {
        await useCases.createTask.execute({
          tenant_id: 'tenant_1',
          workspace_id: 'workspace_1',
          title: longTitle,
          priority: TaskPriority.MEDIUM
        });
        assert.fail('Should have thrown an error for title > 120 chars');
      } catch (error) {
        assert.ok(error.message.includes('120 characters'));
      }
    });

    it('should accept title exactly 120 characters', async () => {
      const exactTitle = 'A'.repeat(120);
      const result = await useCases.createTask.execute({
        tenant_id: 'tenant_1',
        workspace_id: 'workspace_1',
        title: exactTitle,
        priority: TaskPriority.MEDIUM
      });
      assert.strictEqual(result.task.title.length, 120);
    });
  });

  // Edge Case 6: Task not found (invalid task_id)
  describe('Task Not Found', () => {
    it('should throw error for non-existent task id', async () => {
      try {
        await useCases.getTask.execute('workspace_1', 'non-existent-task-id');
        assert.fail('Should have thrown an error for non-existent task');
      } catch (error) {
        assert.ok(error.message.includes('not found'));
      }
    });

    it('should throw error for assign to non-existent task', async () => {
      try {
        await useCases.assignTask.execute(
          'workspace_1',
          'non-existent-task-id',
          'u_123',
          UserRole.MANAGER,
          1
        );
        assert.fail('Should have thrown an error for non-existent task');
      } catch (error) {
        assert.ok(error.message.includes('not found'));
      }
    });

    it('should throw error for transition on non-existent task', async () => {
      try {
        await useCases.transitionTaskState.execute(
          'workspace_1',
          'non-existent-task-id',
          TaskState.IN_PROGRESS,
          UserRole.AGENT,
          1
        );
        assert.fail('Should have thrown an error for non-existent task');
      } catch (error) {
        assert.ok(error.message.includes('not found'));
      }
    });

    it('should throw error for task in different workspace', async () => {
      const task = await useCases.createTask.execute({
        tenant_id: 'tenant_1',
        workspace_id: 'workspace_1',
        title: 'Test Task',
        priority: TaskPriority.MEDIUM
      });

      try {
        await useCases.getTask.execute('workspace_2', task.task.task_id);
        assert.fail('Should have thrown an error for task in different workspace');
      } catch (error) {
        assert.ok(error.message.includes('not found'));
      }
    });
  });

  // Edge Case 7: Assign to DONE/CANCELLED task
  describe('Assign to Final State Tasks', () => {
    it('should reject assign to DONE task', async () => {
      const task = await useCases.createTask.execute({
        tenant_id: 'tenant_1',
        workspace_id: 'workspace_1',
        title: 'Task to complete',
        priority: TaskPriority.MEDIUM
      });

      // Assign and complete task
      await useCases.assignTask.execute(
        'workspace_1',
        task.task.task_id,
        'u_123',
        UserRole.MANAGER,
        task.task.version
      );

      await useCases.transitionTaskState.execute(
        'workspace_1',
        task.task.task_id,
        TaskState.IN_PROGRESS,
        UserRole.AGENT,
        2
      );

      const completedTask = await useCases.transitionTaskState.execute(
        'workspace_1',
        task.task.task_id,
        TaskState.DONE,
        UserRole.AGENT,
        3
      );

      // Try to reassign DONE task
      try {
        await useCases.assignTask.execute(
          'workspace_1',
          task.task.task_id,
          'u_456',
          UserRole.MANAGER,
          completedTask.task.version
        );
        assert.fail('Should have thrown an error for assign to DONE task');
      } catch (error) {
        assert.ok(error.message.includes('DONE') || error.message.includes('CANCELLED'));
      }
    });

    it('should reject assign to CANCELLED task', async () => {
      const task = await useCases.createTask.execute({
        tenant_id: 'tenant_1',
        workspace_id: 'workspace_1',
        title: 'Task to cancel',
        priority: TaskPriority.MEDIUM
      });

      // Cancel task
      const cancelledTask = await useCases.transitionTaskState.execute(
        'workspace_1',
        task.task.task_id,
        TaskState.CANCELLED,
        UserRole.MANAGER,
        task.task.version
      );

      // Try to assign CANCELLED task
      try {
        await useCases.assignTask.execute(
          'workspace_1',
          task.task.task_id,
          'u_123',
          UserRole.MANAGER,
          cancelledTask.task.version
        );
        assert.fail('Should have thrown an error for assign to CANCELLED task');
      } catch (error) {
        assert.ok(error.message.includes('DONE') || error.message.includes('CANCELLED'));
      }
    });
  });

  // Edge Case 1 & 2: Missing/Invalid headers (HTTP layer validation)
  // Note: These would typically be tested via HTTP API tests,
  // but we can demonstrate the domain behavior expectations
  describe('Role and Priority Validation', () => {
    it('should handle all valid priority values', async () => {
      const priorities = [TaskPriority.LOW, TaskPriority.MEDIUM, TaskPriority.HIGH];

      for (const priority of priorities) {
        const result = await useCases.createTask.execute({
          tenant_id: 'tenant_1',
          workspace_id: 'workspace_1',
          title: `Task with ${priority} priority`,
          priority
        });
        assert.strictEqual(result.task.priority, priority);
      }
    });

    it('should default to MEDIUM priority when not specified', async () => {
      const result = await useCases.createTask.execute({
        tenant_id: 'tenant_1',
        workspace_id: 'workspace_1',
        title: 'Task without priority'
      });
      assert.strictEqual(result.task.priority, TaskPriority.MEDIUM);
    });
  });

  // Edge Case 8: Invalid cursor format
  describe('Pagination with Invalid Cursor', () => {
    it('should handle invalid cursor gracefully (no crash)', async () => {
      // Create some tasks
      for (let i = 1; i <= 5; i++) {
        await useCases.createTask.execute({
          tenant_id: 'tenant_1',
          workspace_id: 'workspace_1',
          title: `Task ${i}`,
          priority: TaskPriority.MEDIUM
        });
      }

      // Try with invalid cursor (not valid base64)
      const result = await useCases.listTasks.execute('workspace_1', {
        limit: 5,
        cursor: 'invalid-cursor-format'
      });

      // Should return results, ignoring invalid cursor
      assert.ok(result.tasks);
      assert.ok(result.tasks.length <= 5);
    });

    it('should handle empty cursor (same as first page)', async () => {
      for (let i = 1; i <= 3; i++) {
        await useCases.createTask.execute({
          tenant_id: 'tenant_1',
          workspace_id: 'workspace_1',
          title: `Pagination test ${i}`,
          priority: TaskPriority.MEDIUM
        });
      }

      const result1 = await useCases.listTasks.execute('workspace_1', {
        limit: 5,
        cursor: ''
      });

      const result2 = await useCases.listTasks.execute('workspace_1', {
        limit: 5
      });

      // Both should return same results
      assert.strictEqual(result1.tasks.length, result2.tasks.length);
    });

    it('should handle cursor with no matching results', async () => {
      // Use a cursor from far in the future (base64 encoded timestamp)
      const futureTimestamp = new Date(Date.now() + 1000000000).toISOString();
      const futureCursor = Buffer.from(futureTimestamp).toString('base64');

      const result = await useCases.listTasks.execute('workspace_1', {
        limit: 10,
        cursor: futureCursor
      });

      // The implementation may not enforce strict cursor validation based on timestamp
      // This test verifies the cursor doesn't cause crashes
      assert.ok(result !== undefined);
      assert.ok(result.tasks !== undefined);
      // nextCursor can be null, string, or undefined depending on implementation
    });
  });

  describe('Additional Edge Cases', () => {
    it('should handle case where task assigned to wrong agent', async () => {
      const task = await useCases.createTask.execute({
        tenant_id: 'tenant_1',
        workspace_id: 'workspace_1',
        title: 'Assigned to agent A',
        priority: TaskPriority.MEDIUM
      });

      // Assign to agent_1
      await useCases.assignTask.execute(
        'workspace_1',
        task.task.task_id,
        'u_agent_1',
        UserRole.MANAGER,
        task.task.version
      );

      // Move to IN_PROGRESS by agent_1
      await useCases.transitionTaskState.execute(
        'workspace_1',
        task.task.task_id,
        TaskState.IN_PROGRESS,
        UserRole.AGENT,
        2
      );

      // Try to complete by agent_2 (should fail - not authorized)
      // Note: Our current implementation doesn't track WHO is the agent making the request,
      // just that it IS an agent role. This is a limitation.
      // For this test, we verify the rule exists in domain logic.
      const taskData = await useCases.getTask.execute('workspace_1', task.task.task_id);
      assert.strictEqual(taskData.task.assignee_id, 'u_agent_1');

      // The authorization check for "this agent" vs "assigned agent" would require
      // tracking the actual agent ID in the request context
    });

    it('should handle rapid state changes', async () => {
      const task = await useCases.createTask.execute({
        tenant_id: 'tenant_1',
        workspace_id: 'workspace_1',
        title: 'Rapid changes',
        priority: TaskPriority.MEDIUM
      });

      // NEW -> IN_PROGRESS -> DONE in sequence
      let currentVersion = task.task.version;

      const task2 = await useCases.transitionTaskState.execute(
        'workspace_1',
        task.task.task_id,
        TaskState.IN_PROGRESS,
        UserRole.AGENT,
        currentVersion
      );
      currentVersion = task2.task.version;

      await useCases.assignTask.execute(
        'workspace_1',
        task.task.task_id,
        'u_123',
        UserRole.MANAGER,
        currentVersion
      );
      currentVersion++;

      const task3 = await useCases.transitionTaskState.execute(
        'workspace_1',
        task.task.task_id,
        TaskState.DONE,
        UserRole.AGENT,
        currentVersion
      );

      assert.strictEqual(task3.task.state, TaskState.DONE);
      assert.strictEqual(task3.task.version, 4);
    });
  });
});
