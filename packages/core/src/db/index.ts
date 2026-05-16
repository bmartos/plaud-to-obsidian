import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import * as path from 'path';

export interface RecordingRecord {
  id: string;
  title: string;
  date: string;
  downloaded: number;
  transcribed: number;
  analyzed: number;
  raw_path?: string;
  final_path?: string;
  created_at?: string;
  updated_at?: string;
}

export async function initDb(dbPath: string) {
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS recordings (
      id TEXT PRIMARY KEY,
      title TEXT,
      date TEXT,
      downloaded INTEGER DEFAULT 0,
      transcribed INTEGER DEFAULT 0,
      analyzed INTEGER DEFAULT 0,
      raw_path TEXT,
      final_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  return db;
}

const ALLOWED_FIELDS = ['title', 'date', 'downloaded', 'transcribed', 'analyzed', 'raw_path', 'final_path'];

export async function updateStatus(db: any, record: Partial<RecordingRecord> & { id: string }) {
  const fields = Object.keys(record).filter(k => k !== 'id' && ALLOWED_FIELDS.includes(k));
  const setClause = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => (record as any)[f]);

  const existing = await db.get('SELECT id FROM recordings WHERE id = ?', record.id);
  
  if (existing) {
    if (fields.length > 0) {
      await db.run(
        `UPDATE recordings SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        ...values, record.id
      );
    }
  } else {
    const allFields = ['id', ...fields];
    const placeholders = allFields.map(() => '?').join(', ');
    const columns = allFields.join(', ');
    await db.run(
      `INSERT INTO recordings (${columns}) VALUES (${placeholders})`,
      record.id, ...values
    );
  }
}
