import type {
  Repository,
  RepositoryListOptions,
  RepositoryRecord,
} from "../../domain/chronos/repositories";

type SQLiteStoredRow = {
  id: string;
  payload: string;
};

/**
 * Small SQLite boundary compatible with better-sqlite3, sql.js, or a mobile
 * SQLite bridge. Keep the driver outside the domain/application layers.
 */
export interface SQLiteDatabase {
  run(sql: string, params?: unknown[]): Promise<void> | void;
  get<T>(sql: string, params?: unknown[]): Promise<T | undefined> | T | undefined;
  all<T>(sql: string, params?: unknown[]): Promise<T[]> | T[];
}

const validTable = /^[a-z_][a-z0-9_]*$/;

/**
 * SQLite implementation of the shared repository port. Values are persisted
 * as JSON so the adapter can store any Chronos entity without schema drift.
 */
export class SQLiteRepository<T extends RepositoryRecord> implements Repository<T> {
  private initialized = false;

  constructor(
    private readonly database: SQLiteDatabase,
    private readonly table: string
  ) {
    if (!validTable.test(table)) {
      throw new Error(`Invalid SQLite table name: ${table}`);
    }
  }

  async get(id: string): Promise<T | null> {
    await this.ensureTable();
    const row = await this.database.get<SQLiteStoredRow>(
      `SELECT id, payload FROM ${this.table} WHERE id = ? LIMIT 1`,
      [id]
    );
    return row ? this.deserialize(row) : null;
  }

  async list(options: RepositoryListOptions = {}): Promise<T[]> {
    await this.ensureTable();
    const limit = options.limit ?? 100;
    const offset = options.offset ?? 0;
    const rows = await this.database.all<SQLiteStoredRow>(
      `SELECT id, payload FROM ${this.table} ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    return rows.map((row) => this.deserialize(row));
  }

  async save(record: T): Promise<T> {
    await this.ensureTable();
    await this.database.run(
      `INSERT INTO ${this.table} (id, payload, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = CURRENT_TIMESTAMP`,
      [record.id, JSON.stringify(record)]
    );
    return record;
  }

  async delete(id: string): Promise<void> {
    await this.ensureTable();
    await this.database.run(`DELETE FROM ${this.table} WHERE id = ?`, [id]);
  }

  private async ensureTable() {
    if (this.initialized) return;
    await this.database.run(
      `CREATE TABLE IF NOT EXISTS ${this.table} (
        id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`
    );
    this.initialized = true;
  }

  private deserialize(row: SQLiteStoredRow): T {
    return JSON.parse(row.payload) as T;
  }
}
