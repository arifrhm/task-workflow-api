/**
 * Database: SQLite connection and schema
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DatabaseManager {
  constructor(dbPath = ':memory:') {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL'); // Better concurrency
    this.initSchema();
  }

  initSchema() {
    // Tasks table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        task_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        title TEXT NOT NULL,
        priority TEXT NOT NULL,
        state TEXT NOT NULL,
        assignee_id TEXT,
        version INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON tasks(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_tenant ON tasks(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_state ON tasks(state);
      CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
    `);

    // Task events table (outbox pattern)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS task_events (
        event_id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        event_data TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (task_id) REFERENCES tasks(task_id)
      );

      CREATE INDEX IF NOT EXISTS idx_events_task ON task_events(task_id);
      CREATE INDEX IF NOT EXISTS idx_events_tenant ON task_events(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_events_created ON task_events(created_at);
    `);

    // Idempotency keys table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS idempotency_keys (
        key TEXT PRIMARY KEY,
        response TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_keys(expires_at);
    `);
  }

  getDatabase() {
    return this.db;
  }

  close() {
    this.db.close();
  }
}

let dbInstance = null;

export function getDatabase(dbPath = './data/tasks.db') {
  if (!dbInstance) {
    dbInstance = new DatabaseManager(dbPath);
  }
  return dbInstance.getDatabase();
}

export default DatabaseManager;
