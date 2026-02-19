/**
 * Config: Dependency injection and setup
 */

import { getDatabase } from '../infrastructure/database.js';
import { SqliteTaskRepository } from '../infrastructure/repositories/SqliteTaskRepository.js';
import { SqliteIdempotencyRepository } from '../infrastructure/repositories/SqliteIdempotencyRepository.js';
import { CreateTask } from '../application/useCases/CreateTask.js';
import { AssignTask } from '../application/useCases/AssignTask.js';
import { TransitionTaskState } from '../application/useCases/TransitionTaskState.js';
import { GetTask } from '../application/useCases/GetTask.js';
import { ListTasks } from '../application/useCases/ListTasks.js';
import { GetEvents } from '../application/useCases/GetEvents.js';
import { TaskController } from '../interfaces/controllers/TaskController.js';

// Initialize database
const db = getDatabase(process.env.DB_PATH || './data/tasks.db');

// Initialize repositories
const taskRepository = new SqliteTaskRepository(db);
const idempotencyRepository = new SqliteIdempotencyRepository(db);

// Initialize use cases
const createTask = new CreateTask(taskRepository, idempotencyRepository);
const assignTask = new AssignTask(taskRepository);
const transitionTaskState = new TransitionTaskState(taskRepository);
const getTask = new GetTask(taskRepository);
const listTasks = new ListTasks(taskRepository);
const getEvents = new GetEvents(taskRepository);

// Initialize controller
const controller = new TaskController(
  createTask,
  assignTask,
  transitionTaskState,
  getTask,
  listTasks,
  getEvents
);

export {
  controller,
  db
};
