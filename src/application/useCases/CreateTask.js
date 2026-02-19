/**
 * Use Case: CreateTask
 * Handles task creation with idempotency
 */

import { Task } from '../../domain/entities/Task.js';
import { TaskEvent } from '../../domain/entities/TaskEvent.js';

export class CreateTask {
  constructor(taskRepository, idempotencyRepository) {
    this.taskRepository = taskRepository;
    this.idempotencyRepository = idempotencyRepository;
  }

  async execute(data, idempotencyKey = null) {
    const { tenant_id, workspace_id, title, priority } = data;

    // Validate title using domain logic
    const validatedTitle = Task.validateTitle(title);

    // Check idempotency
    if (idempotencyKey) {
      const existing = await this.idempotencyRepository.findByKey(idempotencyKey);
      if (existing.found) {
        return existing.response; // Return cached response
      }
    }

    // Create task entity
    const task = new Task({
      tenant_id,
      workspace_id,
      title: validatedTitle,
      priority
    });

    // Create event for outbox
    const event = TaskEvent.createTaskCreated(task);

    // Store task and event in same transaction (simulated here)
    const createdTask = await this.taskRepository.create(task);
    await this.taskRepository.saveEvent(event);

    const response = {
      task: createdTask.toPlainObject()
    };

    // Cache response for idempotency
    if (idempotencyKey) {
      await this.idempotencyRepository.save(idempotencyKey, response);
    }

    return response;
  }
}
