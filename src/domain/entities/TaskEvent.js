/**
 * Domain Entity: TaskEvent
 * Represents audit events for task lifecycle
 */

export const EventType = {
  TASK_CREATED: 'TASK_CREATED',
  TASK_ASSIGNED: 'TASK_ASSIGNED',
  TASK_STATE_CHANGED: 'TASK_STATE_CHANGED'
};

export class TaskEvent {
  constructor(data) {
    this.event_id = data.event_id;
    this.task_id = data.task_id;
    this.tenant_id = data.tenant_id;
    this.workspace_id = data.workspace_id;
    this.event_type = data.event_type;
    this.event_data = data.event_data || {};
    this.created_at = data.created_at || new Date().toISOString();
  }

  toPlainObject() {
    return {
      event_id: this.event_id,
      task_id: this.task_id,
      tenant_id: this.tenant_id,
      workspace_id: this.workspace_id,
      event_type: this.event_type,
      event_data: this.event_data,
      created_at: this.created_at
    };
  }

  static createTaskCreated(task) {
    return new TaskEvent({
      task_id: task.task_id,
      tenant_id: task.tenant_id,
      workspace_id: task.workspace_id,
      event_type: EventType.TASK_CREATED,
      event_data: {
        title: task.title,
        priority: task.priority,
        initial_state: task.state
      }
    });
  }

  static createTaskAssigned(task, assignee_id) {
    return new TaskEvent({
      task_id: task.task_id,
      tenant_id: task.tenant_id,
      workspace_id: task.workspace_id,
      event_type: EventType.TASK_ASSIGNED,
      event_data: {
        assignee_id: assignee_id,
        previous_assignee: task.assignee_id
      }
    });
  }

  static createTaskStateChanged(task, previousState, newState, changedBy) {
    return new TaskEvent({
      task_id: task.task_id,
      tenant_id: task.tenant_id,
      workspace_id: task.workspace_id,
      event_type: EventType.TASK_STATE_CHANGED,
      event_data: {
        from_state: previousState,
        to_state: newState,
        changed_by: changedBy
      }
    });
  }

  static fromPlainObject(data) {
    return new TaskEvent(data);
  }
}
