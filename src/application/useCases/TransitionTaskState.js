/**
 * Use Case: TransitionTaskState
 * Handles state transitions with role-based authorization
 */

import { TaskEvent } from '../../domain/entities/TaskEvent.js';

export class TransitionTaskState {
  constructor(taskRepository) {
    this.taskRepository = taskRepository;
  }

  async execute(workspaceId, taskId, to_state, role, version) {
    // Find task
    const task = await this.taskRepository.findById(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    // Verify workspace
    if (task.workspace_id !== workspaceId) {
      throw new Error('Task not found in this workspace');
    }

    // Check authorization for transition
    const canTransition = task.canTransition(role, to_state);
    if (!canTransition.allowed) {
      throw new Error(canTransition.reason);
    }

    // Check optimistic locking version
    if (!task.matchesVersion(version)) {
      throw new Error('Version conflict - task was modified by another transaction');
    }

    // Store previous state
    const previousState = task.state;

    // Create event for state change
    const event = TaskEvent.createTaskStateChanged(
      task,
      previousState,
      to_state,
      role
    );

    // Update task state
    task.state = to_state;
    task.incrementVersion();

    // Update task and save event
    const updatedTask = await this.taskRepository.updateWithVersion(task, version);
    await this.taskRepository.saveEvent(event);

    return {
      task: updatedTask.toPlainObject(),
      event: {
        type: event.event_type,
        from_state: previousState,
        to_state: to_state,
        changed_by: role
      }
    };
  }
}
