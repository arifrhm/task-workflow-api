/**
 * Domain Entity: Task
 * Core business rules and invariants live here
 */

const { v4: uuidv4 } = await import('uuid');

export const TaskState = {
  NEW: 'NEW',
  IN_PROGRESS: 'IN_PROGRESS',
  DONE: 'DONE',
  CANCELLED: 'CANCELLED'
};

export const TaskPriority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH'
};

export const UserRole = {
  AGENT: 'agent',
  MANAGER: 'manager'
};

// Valid state transitions
export const VALID_TRANSITIONS = {
  [TaskState.NEW]: [TaskState.IN_PROGRESS, TaskState.CANCELLED],
  [TaskState.IN_PROGRESS]: [TaskState.DONE, TaskState.CANCELLED],
  [TaskState.DONE]: [],
  [TaskState.CANCELLED]: []
};

export class Task {
  constructor(data) {
    this.task_id = data.task_id || uuidv4();
    this.tenant_id = data.tenant_id;
    this.workspace_id = data.workspace_id;
    this.title = data.title;
    this.priority = data.priority || TaskPriority.MEDIUM;
    this.state = data.state || TaskState.NEW;
    this.assignee_id = data.assignee_id || null;
    this.version = data.version || 1;
    this.created_at = data.created_at || new Date().toISOString();
    this.updated_at = data.updated_at || new Date().toISOString();
  }

  // Business rule: validate title
  static validateTitle(title) {
    if (!title || title.trim().length === 0) {
      throw new Error('Title is required');
    }
    if (title.length > 120) {
      throw new Error('Title must be at most 120 characters');
    }
    return title.trim();
  }

  // Business rule: check if state transition is valid
  canTransitionTo(newState) {
    const allowedStates = VALID_TRANSITIONS[this.state];
    return allowedStates.includes(newState);
  }

  // Business rule: can transition based on role and assignee
  canTransition(role, newState) {
    // Check if transition is valid in state machine
    if (!this.canTransitionTo(newState)) {
      return { allowed: false, reason: 'Invalid state transition' };
    }

    // Role-based rules
    if (role === UserRole.AGENT) {
      // Agent can move NEW → IN_PROGRESS (claim task if unassigned, or start if assigned)
      if (this.state === TaskState.NEW && newState === TaskState.IN_PROGRESS) {
        // Agent can start task whether assigned or not
        // If unassigned, this acts as a claim
        return { allowed: true };
      }

      // Agent can move IN_PROGRESS → DONE only if assigned
      if (this.state === TaskState.IN_PROGRESS && newState === TaskState.DONE) {
        if (this.assignee_id === null) {
          return { allowed: false, reason: 'Agent cannot complete unassigned task' };
        }
        return { allowed: true };
      }

      return { allowed: false, reason: 'Agent not authorized for this transition' };
    }

    if (role === UserRole.MANAGER) {
      // Manager can cancel NEW or IN_PROGRESS
      if (newState === TaskState.CANCELLED) {
        if (this.state === TaskState.NEW || this.state === TaskState.IN_PROGRESS) {
          return { allowed: true };
        }
        return { allowed: false, reason: 'Cannot cancel from this state' };
      }
      return { allowed: false, reason: 'Manager not authorized for this transition' };
    }

    return { allowed: false, reason: 'Unknown role' };
  }

  // Business rule: can assign task
  canAssign(role) {
    if (role !== UserRole.MANAGER) {
      return { allowed: false, reason: 'Only manager can assign tasks' };
    }

    if (this.state === TaskState.DONE || this.state === TaskState.CANCELLED) {
      return { allowed: false, reason: 'Cannot assign DONE or CANCELLED tasks' };
    }

    return { allowed: true };
  }

  // Increment version for optimistic locking
  incrementVersion() {
    this.version += 1;
    this.updated_at = new Date().toISOString();
  }

  // Check version match for optimistic locking
  matchesVersion(version) {
    return this.version === parseInt(version);
  }

  toPlainObject() {
    return {
      task_id: this.task_id,
      tenant_id: this.tenant_id,
      workspace_id: this.workspace_id,
      title: this.title,
      priority: this.priority,
      state: this.state,
      assignee_id: this.assignee_id,
      version: this.version,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }

  static fromPlainObject(data) {
    return new Task(data);
  }
}
