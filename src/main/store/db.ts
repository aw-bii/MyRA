import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

let db: Database.Database

export function initDb(dbPath: string): void {
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations()
}

export function getDb(): Database.Database {
  if (!db) throw new Error('DB not initialized — call initDb() first')
  return db
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = undefined as unknown as Database.Database
  }
}

function runMigrations(): void {
  const migrationsDir = path.join(__dirname, 'migrations')
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort()
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY)`)
  for (const file of files) {
    const already = db.prepare('SELECT 1 FROM _migrations WHERE name = ?').get(file)
    if (already) continue
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
    db.exec(sql)
    db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file)
  }
}
