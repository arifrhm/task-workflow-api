/**
 * Use Case: AssignTask
 * Handles task assignment with role checks and optimistic locking
 */

import { TaskEvent } from '../../domain/entities/TaskEvent.js';

export class AssignTask {
  constructor(taskRepository) {
    this.taskRepository = taskRepository;
  }

  async execute(workspaceId, taskId, assignee_id, role, version) {
    // Find task
    const task = await this.taskRepository.findById(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    // Verify workspace
    if (task.workspace_id !== workspaceId) {
      throw new Error('Task not found in this workspace');
    }

    // Check authorization
    const canAssign = task.canAssign(role);
    if (!canAssign.allowed) {
      throw new Error(canAssign.reason);
    }

    // Check optimistic locking version
    if (!task.matchesVersion(version)) {
      throw new Error('Version conflict - task was modified by another transaction');
    }

    // Create event for assignment
    const event = TaskEvent.createTaskAssigned(task, assignee_id);

    // Update task
    const previousAssignee = task.assignee_id;
    task.assignee_id = assignee_id;
    task.incrementVersion();

    // Update task and save event
    const updatedTask = await this.taskRepository.updateWithVersion(task, version);
    await this.taskRepository.saveEvent(event);

    return {
      task: updatedTask.toPlainObject(),
      event: {
        type: event.event_type,
        previous_assignee: previousAssignee,
        new_assignee: assignee_id
      }
    };
  }
}
