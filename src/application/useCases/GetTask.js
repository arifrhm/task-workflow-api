/**
 * Use Case: GetTask
 * Retrieves a task with its audit timeline
 */

export class GetTask {
  constructor(taskRepository) {
    this.taskRepository = taskRepository;
  }

  async execute(workspaceId, taskId) {
    // Find task
    const task = await this.taskRepository.findById(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    // Verify workspace
    if (task.workspace_id !== workspaceId) {
      throw new Error('Task not found in this workspace');
    }

    // Get events (timeline)
    const events = await this.taskRepository.findEventsByTaskId(taskId, 20);

    return {
      task: task.toPlainObject(),
      timeline: events.map(e => e.toPlainObject())
    };
  }
}
