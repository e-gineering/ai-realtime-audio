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
      phone_number TEXT,
      call_started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      call_ended_at DATETIME,
      call_duration_seconds INTEGER,
      
      -- Inspection data (from structured JSON) - nullable until submitted
      equipment_id TEXT,
      inspector_name TEXT,
      location TEXT,
      inspection_result TEXT CHECK(inspection_result IN ('PASS', 'FAIL') OR inspection_result IS NULL),
      comments TEXT,
      
      -- System metadata
      submitted_at DATETIME,
      status TEXT DEFAULT 'in_progress' CHECK(status IN ('in_progress', 'completed', 'failed'))
    );
    
    CREATE TABLE IF NOT EXISTS callers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone_number TEXT UNIQUE NOT NULL,
      caller_name TEXT,
      first_call_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_call_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      total_calls INTEGER DEFAULT 1
    );
    
    CREATE INDEX IF NOT EXISTS idx_stream_sid ON inspections(stream_sid);
    CREATE INDEX IF NOT EXISTS idx_phone_number ON inspections(phone_number);
    CREATE INDEX IF NOT EXISTS idx_equipment_id ON inspections(equipment_id);
    CREATE INDEX IF NOT EXISTS idx_inspector_name ON inspections(inspector_name);
    CREATE INDEX IF NOT EXISTS idx_location ON inspections(location);
    CREATE INDEX IF NOT EXISTS idx_result ON inspections(inspection_result);
    CREATE INDEX IF NOT EXISTS idx_submitted_at ON inspections(submitted_at);
    CREATE INDEX IF NOT EXISTS idx_call_date ON inspections(call_started_at);
    CREATE INDEX IF NOT EXISTS idx_caller_phone ON callers(phone_number);
  `);
  
  console.log('✅ Database initialized:', DB_PATH);
  return db;
}

export function createInspection(streamSid, phoneNumber = null) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO inspections (stream_sid, phone_number)
    VALUES (?, ?)
  `);
  stmt.run(streamSid, phoneNumber);
  
  return getInspectionByStreamSid(streamSid);
}

export function getInspectionByStreamSid(streamSid) {
  const stmt = db.prepare('SELECT * FROM inspections WHERE stream_sid = ?');
  return stmt.get(streamSid);
}

export function getInspectionByEquipmentId(equipmentId) {
  const stmt = db.prepare('SELECT * FROM inspections WHERE equipment_id = ? ORDER BY call_started_at DESC');
  return stmt.all(equipmentId);
}

export function saveInspectionData(streamSid, data) {
  const stmt = db.prepare(`
    UPDATE inspections
    SET 
      equipment_id = ?,
      inspector_name = ?,
      location = ?,
      inspection_result = ?,
      comments = ?,
      submitted_at = CURRENT_TIMESTAMP,
      status = 'completed'
    WHERE stream_sid = ?
  `);
  
  return stmt.run(
    data.equipment_id,
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

export function getCallerByPhoneNumber(phoneNumber) {
  if (!phoneNumber) return null;
  const stmt = db.prepare('SELECT * FROM callers WHERE phone_number = ?');
  return stmt.get(phoneNumber);
}

export function saveCallerName(phoneNumber, callerName) {
  if (!phoneNumber || !callerName) return null;

  const stmt = db.prepare(`
    INSERT INTO callers (phone_number, caller_name, first_call_at, last_call_at, total_calls)
    VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1)
    ON CONFLICT(phone_number)
    DO UPDATE SET
      caller_name = excluded.caller_name,
      last_call_at = CURRENT_TIMESTAMP
      -- INSERT: Initialize new caller with total_calls = 1 (they're on first call)
      -- UPDATE: Only update name/timestamp, don't touch total_calls
      -- Call count increments handled by updateCallerLastCall() per connection
  `);

  return stmt.run(phoneNumber, callerName);
}

export function updateCallerLastCall(phoneNumber) {
  if (!phoneNumber) return null;
  
  const stmt = db.prepare(`
    INSERT INTO callers (phone_number, first_call_at, last_call_at, total_calls)
    VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1)
    ON CONFLICT(phone_number) 
    DO UPDATE SET 
      last_call_at = CURRENT_TIMESTAMP,
      total_calls = total_calls + 1
  `);
  
  return stmt.run(phoneNumber);
}

export default {
  initializeDatabase,
  createInspection,
  getInspectionByStreamSid,
  getInspectionByEquipmentId,
  saveInspectionData,
  completeInspection,
  getAllInspections,
  getInspectionsByResult,
  getInspectionsByLocation,
  getInspectionStats,
  closeDatabase,
  getDatabase,
  getCallerByPhoneNumber,
  saveCallerName,
  updateCallerLastCall
};
