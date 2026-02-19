/**
 * Infrastructure: SQLite implementation of IdempotencyRepository
 */

import { IdempotencyRepository } from '../../domain/repositories/IdempotencyRepository.js';

export class SqliteIdempotencyRepository extends IdempotencyRepository {
  constructor(db) {
    super();
    this.db = db;
  }

  async findByKey(key) {
    const stmt = this.db.prepare(`
      SELECT response, expires_at FROM idempotency_keys WHERE key = ?
    `);

    const row = stmt.get(key);

    if (!row) {
      return { found: false, response: null };
    }

    // Check if expired
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      // Delete expired entry
      const deleteStmt = this.db.prepare(`DELETE FROM idempotency_keys WHERE key = ?`);
      deleteStmt.run(key);
      return { found: false, response: null };
    }

    return {
      found: true,
      response: JSON.parse(row.response)
    };
  }

  async save(key, response) {
    // Set expiration to 24 hours from now
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO idempotency_keys (key, response, created_at, expires_at)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(key, JSON.stringify(response), new Date().toISOString(), expiresAt);
  }
}
