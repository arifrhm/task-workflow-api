/**
 * Domain Repository Interface: TaskRepository
 * Defines contract for task persistence operations
 */

export class TaskRepository {
  /**
   * Find task by ID
   * @param {string} taskId
   * @returns {Promise<Task|null>}
   */
  async findById(taskId) {
    throw new Error('Method not implemented');
  }

  /**
   * Find tasks by workspace with filters
   * @param {string} workspaceId
   * @param {object} filters - { state, assignee_id, limit, cursor }
   * @returns {Promise<{tasks: Task[], nextCursor: string|null}>}
   */
  async findByWorkspace(workspaceId, filters) {
    throw new Error('Method not implemented');
  }

  /**
   * Create a new task
   * @param {Task} task
   * @returns {Promise<Task>}
   */
  async create(task) {
    throw new Error('Method not implemented');
  }

  /**
   * Update task with optimistic locking
   * @param {Task} task
   * @param {number} expectedVersion
   * @returns {Promise<Task>}
   * @throws {Error} if version mismatch
   */
  async updateWithVersion(task, expectedVersion) {
    throw new Error('Method not implemented');
  }

  /**
   * Find events for a task
   * @param {string} taskId
   * @param {number} limit
   * @returns {Promise<TaskEvent[]>}
   */
  async findEventsByTaskId(taskId, limit = 20) {
    throw new Error('Method not implemented');
  }

  /**
   * Find events for tenant
   * @param {string} tenantId
   * @param {number} limit
   * @returns {Promise<TaskEvent[]>}
   */
  async findEventsByTenant(tenantId, limit = 50) {
    throw new Error('Method not implemented');
  }

  /**
   * Save event in outbox pattern
   * @param {TaskEvent} event
   * @returns {Promise<TaskEvent>}
   */
  async saveEvent(event) {
    throw new Error('Method not implemented');
  }
}
