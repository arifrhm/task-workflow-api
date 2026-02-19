/**
 * Infrastructure: SQLite implementation of TaskRepository
 */

import { Task } from '../../domain/entities/Task.js';
import { TaskEvent } from '../../domain/entities/TaskEvent.js';
import { TaskRepository } from '../../domain/repositories/TaskRepository.js';

export class SqliteTaskRepository extends TaskRepository {
  constructor(db) {
    super();
    this.db = db;
  }

  async findById(taskId) {
    const stmt = this.db.prepare(`
      SELECT * FROM tasks WHERE task_id = ?
    `);

    const row = stmt.get(taskId);
    if (!row) return null;

    return Task.fromPlainObject(row);
  }

  async findByWorkspace(workspaceId, filters = {}) {
    const { state, assignee_id, limit = 20, cursor } = filters;

    let query = `SELECT * FROM tasks WHERE workspace_id = ?`;
    const params = [workspaceId];

    if (state) {
      query += ` AND state = ?`;
      params.push(state);
    }

    if (assignee_id) {
      query += ` AND assignee_id = ?`;
      params.push(assignee_id);
    }

    // Handle cursor pagination (base64 encoded timestamp)
    if (cursor) {
      try {
        const decoded = Buffer.from(cursor, 'base64').toString();
        query += ` AND created_at < ?`;
        params.push(decoded);
      } catch (e) {
        // Invalid cursor, ignore
      }
    }

    query += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(parseInt(limit) + 1); // Fetch one more to determine if there's a next page

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params);

    const tasks = rows.slice(0, limit).map(row => Task.fromPlainObject(row));

    // Generate next cursor if there are more results
    let nextCursor = null;
    if (rows.length > limit) {
      const lastTask = tasks[tasks.length - 1];
      nextCursor = Buffer.from(lastTask.created_at).toString('base64');
    }

    return { tasks, nextCursor };
  }

  async create(task) {
    const stmt = this.db.prepare(`
      INSERT INTO tasks (
        task_id, tenant_id, workspace_id, title, priority, state,
        assignee_id, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      task.task_id,
      task.tenant_id,
      task.workspace_id,
      task.title,
      task.priority,
      task.state,
      task.assignee_id,
      task.version,
      task.created_at,
      task.updated_at
    );

    return task;
  }

  async updateWithVersion(task, expectedVersion) {
    const stmt = this.db.prepare(`
      UPDATE tasks
      SET title = ?, priority = ?, state = ?, assignee_id = ?,
          version = ?, updated_at = ?
      WHERE task_id = ? AND version = ?
    `);

    const result = stmt.run(
      task.title,
      task.priority,
      task.state,
      task.assignee_id,
      task.version,
      task.updated_at,
      task.task_id,
      expectedVersion
    );

    if (result.changes === 0) {
      throw new Error('Version conflict - task was modified by another transaction');
    }

    return task;
  }

  async findEventsByTaskId(taskId, limit = 20) {
    const stmt = this.db.prepare(`
      SELECT * FROM task_events
      WHERE task_id = ?
      ORDER BY created_at DESC, event_id DESC
      LIMIT ?
    `);

    const rows = stmt.all(taskId, limit);
    return rows.map(row => {
      const parsedEvent = TaskEvent.fromPlainObject(row);
      parsedEvent.event_data = JSON.parse(row.event_data);
      return parsedEvent;
    });
  }

  async findEventsByTenant(tenantId, limit = 50) {
    const stmt = this.db.prepare(`
      SELECT * FROM task_events
      WHERE tenant_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);

    const rows = stmt.all(tenantId, limit);
    return rows.map(row => {
      const parsedEvent = TaskEvent.fromPlainObject(row);
      parsedEvent.event_data = JSON.parse(row.event_data);
      return parsedEvent;
    });
  }

  async saveEvent(event) {
    const stmt = this.db.prepare(`
      INSERT INTO task_events (
        task_id, tenant_id, workspace_id, event_type, event_data, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      event.task_id,
      event.tenant_id,
      event.workspace_id,
      event.event_type,
      JSON.stringify(event.event_data),
      event.created_at
    );

    return event;
  }
}
