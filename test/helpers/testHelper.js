/**
 * Test Helper: Setup and teardown utilities
 */

import { getDatabase } from '../../src/infrastructure/database.js';
import { SqliteTaskRepository } from '../../src/infrastructure/repositories/SqliteTaskRepository.js';
import { SqliteIdempotencyRepository } from '../../src/infrastructure/repositories/SqliteIdempotencyRepository.js';
import { CreateTask } from '../../src/application/useCases/CreateTask.js';
import { AssignTask } from '../../src/application/useCases/AssignTask.js';
import { TransitionTaskState } from '../../src/application/useCases/TransitionTaskState.js';
import { GetTask } from '../../src/application/useCases/GetTask.js';
import { ListTasks } from '../../src/application/useCases/ListTasks.js';
import { TaskState, UserRole } from '../../src/domain/entities/Task.js';

export function setupTestDatabase() {
  // Use in-memory database for tests
  const db = getDatabase(':memory:');
  return db;
}

export function setupRepositories(db) {
  const taskRepository = new SqliteTaskRepository(db);
  const idempotencyRepository = new SqliteIdempotencyRepository(db);
  return { taskRepository, idempotencyRepository };
}

export function setupUseCases(taskRepository, idempotencyRepository) {
  const createTask = new CreateTask(taskRepository, idempotencyRepository);
  const assignTask = new AssignTask(taskRepository);
  const transitionTaskState = new TransitionTaskState(taskRepository);
  const getTask = new GetTask(taskRepository);
  const listTasks = new ListTasks(taskRepository);
  return { createTask, assignTask, transitionTaskState, getTask, listTasks };
}

export async function createSampleTask(createTask, tenantId = 'tenant_1', workspaceId = 'workspace_1') {
  const result = await createTask.execute({
    tenant_id: tenantId,
    workspace_id: workspaceId,
    title: 'Test Task',
    priority: 'MEDIUM'
  });
  return result.task;
}

export async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
