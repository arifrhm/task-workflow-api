/**
 * Use Case: ListTasks
 * Lists tasks with filtering and cursor pagination
 */

export class ListTasks {
  constructor(taskRepository) {
    this.taskRepository = taskRepository;
  }

  async execute(workspaceId, filters) {
    const { state, assignee_id, limit, cursor } = filters;

    // Build filters object
    const queryFilters = {};
    if (state) queryFilters.state = state;
    if (assignee_id) queryFilters.assignee_id = assignee_id;
    if (limit) queryFilters.limit = parseInt(limit);
    if (cursor) queryFilters.cursor = cursor;

    const result = await this.taskRepository.findByWorkspace(
      workspaceId,
      queryFilters
    );

    return {
      tasks: result.tasks.map(t => t.toPlainObject()),
      next_cursor: result.nextCursor
    };
  }
}
