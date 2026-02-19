/**
 * Routes: Task API endpoints
 */

import { validateHeaders } from '../middleware/validateHeaders.js';

export async function taskRoutes(fastify, options) {
  const { controller } = options;

  // Apply header validation to all routes
  fastify.addHook('onRequest', validateHeaders);

  // Create task
  fastify.post('/v1/workspaces/:workspaceId/tasks', {
    schema: {
      params: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' }
        },
        required: ['workspaceId']
      },
      body: {
        type: 'object',
        properties: {
          title: { type: 'string', maxLength: 120 },
          priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] }
        },
        required: ['title']
      }
    }
  }, async (request, reply) => {
    return controller.create(request, reply);
  });

  // Assign task
  fastify.post('/v1/workspaces/:workspaceId/tasks/:taskId/assign', {
    schema: {
      params: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          taskId: { type: 'string' }
        },
        required: ['workspaceId', 'taskId']
      },
      body: {
        type: 'object',
        properties: {
          assignee_id: { type: 'string' }
        },
        required: ['assignee_id']
      }
    }
  }, async (request, reply) => {
    return controller.assign(request, reply);
  });

  // Transition task state
  fastify.post('/v1/workspaces/:workspaceId/tasks/:taskId/transition', {
    schema: {
      params: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          taskId: { type: 'string' }
        },
        required: ['workspaceId', 'taskId']
      },
      body: {
        type: 'object',
        properties: {
          to_state: { type: 'string', enum: ['NEW', 'IN_PROGRESS', 'DONE', 'CANCELLED'] }
        },
        required: ['to_state']
      }
    }
  }, async (request, reply) => {
    return controller.transition(request, reply);
  });

  // Get task
  fastify.get('/v1/workspaces/:workspaceId/tasks/:taskId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          taskId: { type: 'string' }
        },
        required: ['workspaceId', 'taskId']
      }
    }
  }, async (request, reply) => {
    return controller.get(request, reply);
  });

  // List tasks
  fastify.get('/v1/workspaces/:workspaceId/tasks', {
    schema: {
      params: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' }
        },
        required: ['workspaceId']
      },
      querystring: {
        type: 'object',
        properties: {
          state: { type: 'string', enum: ['NEW', 'IN_PROGRESS', 'DONE', 'CANCELLED'] },
          assignee_id: { type: 'string' },
          limit: { type: 'string' },
          cursor: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    return controller.list(request, reply);
  });

  // Get events (outbox)
  fastify.get('/v1/events', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    return controller.events(request, reply);
  });
}
