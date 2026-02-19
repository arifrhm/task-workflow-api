/**
 * Domain Repository Interface: IdempotencyRepository
 * Defines contract for idempotency key operations
 */

export class IdempotencyRepository {
  /**
   * Check if idempotency key exists and return cached response
   * @param {string} key
   * @returns {Promise<{found: boolean, response: any|null}>}
   */
  async findByKey(key) {
    throw new Error('Method not implemented');
  }

  /**
   * Store idempotency key with response
   * @param {string} key
   * @param {any} response
   * @returns {Promise<void>}
   */
  async save(key, response) {
    throw new Error('Method not implemented');
  }
}
