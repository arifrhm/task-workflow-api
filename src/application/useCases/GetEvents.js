/**
 * Use Case: GetEvents
 * Retrieves events from outbox (for event consumers)
 */

export class GetEvents {
  constructor(taskRepository) {
    this.taskRepository = taskRepository;
  }

  async execute(tenantId, limit = 50) {
    const events = await this.taskRepository.findEventsByTenant(tenantId, limit);

    return {
      events: events.map(e => e.toPlainObject()),
      count: events.length
    };
  }
}
