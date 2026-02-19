/**
 * Server: Main entry point
 */

import Fastify from 'fastify';
import { taskRoutes } from './interfaces/routes/taskRoutes.js';
import { controller } from './config/index.js';

const fastify = Fastify({
  logger: true
});

// Register task routes
await fastify.register(taskRoutes, {
  prefix: '/api',
  controller
});

// Health check
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Start server
const start = async () => {
  try {
    const port = process.env.PORT || 3000;
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`🚀 Server running on port ${port}`);
    console.log(`📚 API docs: http://localhost:${port}/api/v1/workspaces/:workspaceId/tasks`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
