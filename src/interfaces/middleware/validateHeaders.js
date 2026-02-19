/**
 * Middleware: Validate Headers
 * Validates required headers (Tenant-Id, Role)
 */

import { UserRole } from '../../domain/entities/Task.js';

export async function validateHeaders(request, reply) {
  const tenantId = request.headers['x-tenant-id'];
  const role = request.headers['x-role'];

  if (!tenantId) {
    return reply.code(400).send({
      error: 'Missing required header: X-Tenant-Id'
    });
  }

  if (!role || !Object.values(UserRole).includes(role)) {
    return reply.code(400).send({
      error: 'Missing or invalid header: X-Role (must be "agent" or "manager")'
    });
  }

  // Attach to request for later use
  request.tenantId = tenantId;
  request.userRole = role;
}
