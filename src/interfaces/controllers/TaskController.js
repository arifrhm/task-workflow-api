/**
 * Controller: TaskController
 * HTTP handlers for task endpoints
 */

import { TaskState, TaskPriority } from '../../domain/entities/Task.js';

export class TaskController {
  constructor(
    createTask,
    assignTask,
    transitionTaskState,
    getTask,
    listTasks,
    getEvents
  ) {
    this.createTask = createTask;
    this.assignTask = assignTask;
    this.transitionTaskState = transitionTaskState;
    this.getTask = getTask;
    this.listTasks = listTasks;
    this.getEvents = getEvents;
  }

  // POST /v1/workspaces/:workspaceId/tasks
  async create(request, reply) {
    try {
      const { workspaceId } = request.params;
      const { title, priority } = request.body;
      const idempotencyKey = request.headers['idempotency-key'];

      const result = await this.createTask.execute(
        {
          tenant_id: request.tenantId,
          workspace_id: workspaceId,
          title,
          priority: priority || TaskPriority.MEDIUM
        },
        idempotencyKey
      );

      return reply.code(201).send(result);
    } catch (error) {
      if (error.message.includes('Title is required') || error.message.includes('120 characters')) {
        return reply.code(400).send({ error: error.message });
      }
      throw error;
    }
  }

  // POST /v1/workspaces/:workspaceId/tasks/:taskId/assign
  async assign(request, reply) {
    try {
      const { workspaceId, taskId } = request.params;
      const { assignee_id } = request.body;
      const version = request.headers['if-match-version'];

      if (!version) {
        return reply.code(400).send({
          error: 'Missing required header: If-Match-Version'
        });
      }

      const result = await this.assignTask.execute(
        workspaceId,
        taskId,
        assignee_id,
        request.userRole,
        parseInt(version)
      );

      return reply.send(result);
    } catch (error) {
      if (error.message.includes('Version conflict')) {
        return reply.code(409).send({ error: error.message });
      }
      if (error.message.includes('not found') || error.message.includes('Only manager')) {
        return reply.code(400).send({ error: error.message });
      }
      throw error;
    }
  }

  // POST /v1/workspaces/:workspaceId/tasks/:taskId/transition
  async transition(request, reply) {
    try {
      const { workspaceId, taskId } = request.params;
      const { to_state } = request.body;
      const version = request.headers['if-match-version'];

      if (!version) {
        return reply.code(400).send({
          error: 'Missing required header: If-Match-Version'
        });
      }

      if (!Object.values(TaskState).includes(to_state)) {
        return reply.code(400).send({
          error: 'Invalid state. Must be one of: ' + Object.values(TaskState).join(', ')
        });
      }

      const result = await this.transitionTaskState.execute(
        workspaceId,
        taskId,
        to_state,
        request.userRole,
        parseInt(version)
      );

      return reply.send(result);
    } catch (error) {
      if (error.message.includes('Version conflict') || error.message.includes('Invalid state') || error.message.includes('not authorized')) {
        return reply.code(409).send({ error: error.message });
      }
      if (error.message.includes('not found') || error.message.includes('cannot')) {
        return reply.code(400).send({ error: error.message });
      }
      throw error;
    }
  }

  // GET /v1/workspaces/:workspaceId/tasks/:taskId
  async get(request, reply) {
    try {
      const { workspaceId, taskId } = request.params;

      const result = await this.getTask.execute(workspaceId, taskId);

      return reply.send(result);
    } catch (error) {
      if (error.message.includes('not found')) {
        return reply.code(404).send({ error: error.message });
      }
      throw error;
    }
  }

  // GET /v1/workspaces/:workspaceId/tasks
  async list(request, reply) {
    try {
      const { workspaceId } = request.params;
      const { state, assignee_id, limit, cursor } = request.query;

      const result = await this.listTasks.execute(workspaceId, {
        state,
        assignee_id,
        limit,
        cursor
      });

      return reply.send(result);
    } catch (error) {
      throw error;
    }
  }

  // GET /v1/events
  async events(request, reply) {
    try {
      const { limit } = request.query;

      const result = await this.getEvents.execute(request.tenantId, limit);

      return reply.send(result);
    } catch (error) {
      throw error;
    }
  }
}
