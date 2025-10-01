import Database from 'better-sqlite3';

const DB_PATH = process.env.DB_PATH || './data/inspections.db';

let db = null;

export function initializeDatabase() {
  db = new Database(DB_PATH);
  
  db.pragma('journal_mode = WAL');
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS inspections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      
      -- Call metadata
      stream_sid TEXT UNIQUE,
      call_started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      call_ended_at DATETIME,
      call_duration_seconds INTEGER,
      
      -- Inspection data (from structured JSON)
      tag_identifier TEXT NOT NULL,
      inspector_name TEXT NOT NULL,
      location TEXT NOT NULL,
      inspection_result TEXT NOT NULL CHECK(inspection_result IN ('PASS', 'FAIL')),
      comments TEXT,
      
      -- System metadata
      submitted_at DATETIME,
      status TEXT DEFAULT 'in_progress' CHECK(status IN ('in_progress', 'completed', 'failed'))
    );
    
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tag_identifier ON inspections(tag_identifier);
    CREATE INDEX IF NOT EXISTS idx_stream_sid ON inspections(stream_sid);
    CREATE INDEX IF NOT EXISTS idx_inspector_name ON inspections(inspector_name);
    CREATE INDEX IF NOT EXISTS idx_location ON inspections(location);
    CREATE INDEX IF NOT EXISTS idx_result ON inspections(inspection_result);
    CREATE INDEX IF NOT EXISTS idx_submitted_at ON inspections(submitted_at);
    CREATE INDEX IF NOT EXISTS idx_call_date ON inspections(call_started_at);
  `);
  
  console.log('✅ Database initialized:', DB_PATH);
  return db;
}

export function createInspection(streamSid) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO inspections (stream_sid)
    VALUES (?)
  `);
  stmt.run(streamSid);
  
  return getInspectionByStreamSid(streamSid);
}

export function getInspectionByStreamSid(streamSid) {
  const stmt = db.prepare('SELECT * FROM inspections WHERE stream_sid = ?');
  return stmt.get(streamSid);
}

export function getInspectionByTag(tagIdentifier) {
  const stmt = db.prepare('SELECT * FROM inspections WHERE tag_identifier = ?');
  return stmt.get(tagIdentifier);
}

export function saveInspectionData(streamSid, data) {
  const stmt = db.prepare(`
    UPDATE inspections
    SET 
      tag_identifier = ?,
      inspector_name = ?,
      location = ?,
      inspection_result = ?,
      comments = ?,
      submitted_at = CURRENT_TIMESTAMP,
      status = 'completed'
    WHERE stream_sid = ?
  `);
  
  return stmt.run(
    data.tag_identifier,
    data.inspector_name,
    data.location,
    data.inspection_result,
    data.comments || null,
    streamSid
  );
}

export function completeInspection(streamSid) {
  const stmt = db.prepare(`
    UPDATE inspections
    SET 
      call_ended_at = CURRENT_TIMESTAMP,
      call_duration_seconds = CAST((julianday(CURRENT_TIMESTAMP) - julianday(call_started_at)) * 86400 AS INTEGER)
    WHERE stream_sid = ?
  `);
  
  return stmt.run(streamSid);
}

export function getAllInspections(limit = 100) {
  const stmt = db.prepare(`
    SELECT * FROM inspections
    ORDER BY call_started_at DESC
    LIMIT ?
  `);
  return stmt.all(limit);
}

export function getInspectionsByResult(result, limit = 100) {
  const stmt = db.prepare(`
    SELECT * FROM inspections
    WHERE inspection_result = ?
    ORDER BY call_started_at DESC
    LIMIT ?
  `);
  return stmt.all(result, limit);
}

export function getInspectionsByLocation(location, limit = 100) {
  const stmt = db.prepare(`
    SELECT * FROM inspections
    WHERE location LIKE ?
    ORDER BY call_started_at DESC
    LIMIT ?
  `);
  return stmt.all(`%${location}%`, limit);
}

export function getInspectionStats() {
  const stmt = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN inspection_result = 'PASS' THEN 1 ELSE 0 END) as passed,
      SUM(CASE WHEN inspection_result = 'FAIL' THEN 1 ELSE 0 END) as failed,
      COUNT(DISTINCT inspector_name) as unique_inspectors,
      COUNT(DISTINCT location) as unique_locations
    FROM inspections
    WHERE status = 'completed'
  `);
  return stmt.get();
}

export function closeDatabase() {
  if (db) {
    db.close();
    console.log('🔒 Database connection closed');
  }
}

export function getDatabase() {
  return db;
}

export default {
  initializeDatabase,
  createInspection,
  getInspectionByStreamSid,
  getInspectionByTag,
  saveInspectionData,
  completeInspection,
  getAllInspections,
  getInspectionsByResult,
  getInspectionsByLocation,
  getInspectionStats,
  closeDatabase,
  getDatabase
};
