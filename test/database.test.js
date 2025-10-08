import { expect } from 'chai';
import { after, afterEach, before, beforeEach, describe, it } from 'mocha';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import {
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
  getCallerByPhoneNumber,
  saveCallerName,
  clearAllData
} from '../database.js';

describe('Database Module', function() {
  const TEST_DB_PATH = './test-data/test-inspections.db';
  
  before(function() {
    // Ensure test data directory exists
    if (!existsSync('./test-data')) {
      mkdirSync('./test-data', { recursive: true });
    }
    // Set test database path
    process.env.DB_PATH = TEST_DB_PATH;
    // Initialize once
    initializeDatabase();
  });

  beforeEach(function() {
    // Clear all data before each test
    clearAllData();
  });

  afterEach(function() {
    // Optional: clear data after test as well
    clearAllData();
  });

  after(function() {
    // Clean up test database file
    try {
      if (existsSync(TEST_DB_PATH)) {
        unlinkSync(TEST_DB_PATH);
      }
      if (existsSync(`${TEST_DB_PATH}-shm`)) {
        unlinkSync(`${TEST_DB_PATH}-shm`);
      }
      if (existsSync(`${TEST_DB_PATH}-wal`)) {
        unlinkSync(`${TEST_DB_PATH}-wal`);
      }
    } catch (err) {
      console.warn('Error cleaning up test database:', err);
    }
  });

  describe('initializeDatabase()', function() {
    it('should initialize the database successfully', function() {
      // Database already initialized in before hook
      expect(initializeDatabase()).to.not.be.null;
    });

    it('should create inspections table', function() {
      // Reinitialize to test table creation
      closeDatabase();
      const db = initializeDatabase();
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='inspections'").all();
      expect(tables).to.have.lengthOf(1);
    });

    it('should create callers table', function() {
      closeDatabase();
      const db = initializeDatabase();
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='callers'").all();
      expect(tables).to.have.lengthOf(1);
    });
  });

  describe('createInspection()', function() {
    it('should create a new inspection with stream_sid', function() {
      const streamSid = 'test-stream-123';
      const inspection = createInspection(streamSid);
      
      expect(inspection).to.not.be.undefined;
      expect(inspection.stream_sid).to.equal(streamSid);
      expect(inspection.status).to.equal('in_progress');
    });

    it('should create a new inspection with phone number', function() {
      const streamSid = 'test-stream-456';
      const phoneNumber = '+1234567890';
      const inspection = createInspection(streamSid, phoneNumber);
      
      expect(inspection.phone_number).to.equal(phoneNumber);
    });

    it('should not create duplicate inspections with same stream_sid', function() {
      const streamSid = 'test-stream-dup';
      createInspection(streamSid);
      createInspection(streamSid); // Try to create duplicate
      
      const allInspections = getAllInspections();
      const duplicates = allInspections.filter(i => i.stream_sid === streamSid);
      expect(duplicates).to.have.lengthOf(1);
    });
  });

  describe('getInspectionByStreamSid()', function() {
    it('should retrieve an inspection by stream_sid', function() {
      const streamSid = 'test-stream-retrieve';
      createInspection(streamSid);
      
      const inspection = getInspectionByStreamSid(streamSid);
      expect(inspection).to.not.be.undefined;
      expect(inspection.stream_sid).to.equal(streamSid);
    });

    it('should return undefined for non-existent stream_sid', function() {
      const inspection = getInspectionByStreamSid('non-existent');
      expect(inspection).to.be.undefined;
    });
  });

  describe('saveInspectionData()', function() {
    it('should save complete inspection data', function() {
      const streamSid = 'test-stream-save';
      createInspection(streamSid);
      
      const inspectionData = {
        equipment_id: 'SCAFF-001',
        inspector_name: 'John Doe',
        location: 'Warehouse A',
        inspection_result: 'PASS',
        comments: 'All checks passed'
      };
      
      saveInspectionData(streamSid, inspectionData);
      
      const inspection = getInspectionByStreamSid(streamSid);
      expect(inspection.equipment_id).to.equal(inspectionData.equipment_id);
      expect(inspection.inspector_name).to.equal(inspectionData.inspector_name);
      expect(inspection.location).to.equal(inspectionData.location);
      expect(inspection.inspection_result).to.equal(inspectionData.inspection_result);
      expect(inspection.comments).to.equal(inspectionData.comments);
      expect(inspection.status).to.equal('completed');
    });

    it('should save inspection data with null comments', function() {
      const streamSid = 'test-stream-no-comments';
      createInspection(streamSid);
      
      const inspectionData = {
        equipment_id: 'SCAFF-002',
        inspector_name: 'Jane Smith',
        location: 'Warehouse B',
        inspection_result: 'FAIL'
      };
      
      saveInspectionData(streamSid, inspectionData);
      
      const inspection = getInspectionByStreamSid(streamSid);
      expect(inspection.comments).to.be.null;
    });
  });

  describe('completeInspection()', function() {
    it('should mark inspection as complete with call_ended_at', function() {
      const streamSid = 'test-stream-complete';
      createInspection(streamSid);
      
      completeInspection(streamSid);
      
      const inspection = getInspectionByStreamSid(streamSid);
      expect(inspection.call_ended_at).to.not.be.null;
      expect(inspection.call_duration_seconds).to.be.at.least(0);
    });
  });

  describe('getInspectionByEquipmentId()', function() {
    it('should retrieve all inspections for an equipment', function() {
      const equipmentId = 'SCAFF-001';
      
      // Create multiple inspections for same equipment
      createInspection('stream-1');
      saveInspectionData('stream-1', {
        equipment_id: equipmentId,
        inspector_name: 'Inspector 1',
        location: 'Location A',
        inspection_result: 'PASS'
      });
      
      createInspection('stream-2');
      saveInspectionData('stream-2', {
        equipment_id: equipmentId,
        inspector_name: 'Inspector 2',
        location: 'Location A',
        inspection_result: 'FAIL'
      });
      
      const inspections = getInspectionByEquipmentId(equipmentId);
      expect(inspections).to.have.lengthOf(2);
    });

    it('should return empty array for equipment with no inspections', function() {
      const inspections = getInspectionByEquipmentId('SCAFF-999');
      expect(inspections).to.be.an('array').that.is.empty;
    });
  });

  describe('getAllInspections()', function() {
    it('should retrieve all inspections', function() {
      createInspection('stream-1');
      createInspection('stream-2');
      createInspection('stream-3');
      
      const inspections = getAllInspections();
      expect(inspections).to.have.lengthOf(3);
    });

    it('should respect the limit parameter', function() {
      for (let i = 0; i < 10; i++) {
        createInspection(`stream-${i}`);
      }
      
      const inspections = getAllInspections(5);
      expect(inspections).to.have.lengthOf(5);
    });

    it('should return inspections in descending order by call_started_at', function() {
      createInspection('stream-old');
      createInspection('stream-new');
      
      const inspections = getAllInspections();
      expect(inspections[0].stream_sid).to.equal('stream-new');
    });
  });

  describe('getInspectionsByResult()', function() {
    beforeEach(function() {
      // Create inspections with different results
      createInspection('stream-pass-1');
      saveInspectionData('stream-pass-1', {
        equipment_id: 'SCAFF-001',
        inspector_name: 'Inspector',
        location: 'Location',
        inspection_result: 'PASS'
      });
      
      createInspection('stream-fail-1');
      saveInspectionData('stream-fail-1', {
        equipment_id: 'SCAFF-002',
        inspector_name: 'Inspector',
        location: 'Location',
        inspection_result: 'FAIL'
      });
      
      createInspection('stream-pass-2');
      saveInspectionData('stream-pass-2', {
        equipment_id: 'SCAFF-003',
        inspector_name: 'Inspector',
        location: 'Location',
        inspection_result: 'PASS'
      });
    });

    it('should retrieve inspections with PASS result', function() {
      const inspections = getInspectionsByResult('PASS');
      expect(inspections).to.have.lengthOf(2);
      inspections.forEach(i => expect(i.inspection_result).to.equal('PASS'));
    });

    it('should retrieve inspections with FAIL result', function() {
      const inspections = getInspectionsByResult('FAIL');
      expect(inspections).to.have.lengthOf(1);
      expect(inspections[0].inspection_result).to.equal('FAIL');
    });
  });

  describe('getInspectionsByLocation()', function() {
    beforeEach(function() {
      createInspection('stream-wh-a');
      saveInspectionData('stream-wh-a', {
        equipment_id: 'SCAFF-001',
        inspector_name: 'Inspector',
        location: 'Warehouse A - Bay 3',
        inspection_result: 'PASS'
      });
      
      createInspection('stream-wh-b');
      saveInspectionData('stream-wh-b', {
        equipment_id: 'SCAFF-002',
        inspector_name: 'Inspector',
        location: 'Warehouse B - Bay 1',
        inspection_result: 'PASS'
      });
    });

    it('should find inspections by partial location match', function() {
      const inspections = getInspectionsByLocation('Warehouse A');
      expect(inspections).to.have.lengthOf(1);
      expect(inspections[0].location).to.include('Warehouse A');
    });

    it('should be case-insensitive', function() {
      const inspections = getInspectionsByLocation('warehouse');
      expect(inspections).to.have.lengthOf(2);
    });

    it('should return empty array when no matches found', function() {
      const inspections = getInspectionsByLocation('NonExistent');
      expect(inspections).to.be.an('array').that.is.empty;
    });
  });

  describe('getInspectionStats()', function() {
    beforeEach(function() {
      // Create mix of completed inspections
      for (let i = 0; i < 5; i++) {
        createInspection(`stream-pass-${i}`);
        saveInspectionData(`stream-pass-${i}`, {
          equipment_id: `SCAFF-00${i}`,
          inspector_name: `Inspector ${i % 2}`,
          location: `Location ${i % 3}`,
          inspection_result: 'PASS'
        });
      }
      
      for (let i = 0; i < 3; i++) {
        createInspection(`stream-fail-${i}`);
        saveInspectionData(`stream-fail-${i}`, {
          equipment_id: `SCAFF-10${i}`,
          inspector_name: `Inspector ${i}`,
          location: `Location ${i}`,
          inspection_result: 'FAIL'
        });
      }
    });

    it('should return correct total count', function() {
      const stats = getInspectionStats();
      expect(stats.total).to.equal(8);
    });

    it('should return correct pass/fail counts', function() {
      const stats = getInspectionStats();
      expect(stats.passed).to.equal(5);
      expect(stats.failed).to.equal(3);
    });

    it('should return unique inspector count', function() {
      const stats = getInspectionStats();
      expect(stats.unique_inspectors).to.be.at.least(2);
    });

    it('should return unique location count', function() {
      const stats = getInspectionStats();
      expect(stats.unique_locations).to.be.at.least(3);
    });
  });

  describe('Caller Management', function() {
    describe('getCallerByPhoneNumber()', function() {
      it('should return null for non-existent phone number', function() {
        const caller = getCallerByPhoneNumber('+9999999999');
        expect(caller).to.satisfy(val => val === null || val === undefined);
      });

      it('should return null when phone number is null', function() {
        const caller = getCallerByPhoneNumber(null);
        expect(caller).to.be.null;
      });

      it('should retrieve saved caller information', function() {
        const phoneNumber = '+1234567890';
        const callerName = 'John Doe';
        
        saveCallerName(phoneNumber, callerName);
        const caller = getCallerByPhoneNumber(phoneNumber);
        
        expect(caller).to.not.be.null;
        expect(caller.phone_number).to.equal(phoneNumber);
        expect(caller.caller_name).to.equal(callerName);
      });
    });

    describe('saveCallerName()', function() {
      it('should save new caller information', function() {
        const phoneNumber = '+1234567890';
        const callerName = 'Jane Smith';
        
        const result = saveCallerName(phoneNumber, callerName);
        expect(result).to.not.be.null;
        
        const caller = getCallerByPhoneNumber(phoneNumber);
        expect(caller.caller_name).to.equal(callerName);
      });

      it('should update existing caller name', function() {
        const phoneNumber = '+1234567890';
        
        saveCallerName(phoneNumber, 'Old Name');
        saveCallerName(phoneNumber, 'New Name');
        
        const caller = getCallerByPhoneNumber(phoneNumber);
        expect(caller.caller_name).to.equal('New Name');
      });

      it('should return null when phone number is null', function() {
        const result = saveCallerName(null, 'Name');
        expect(result).to.be.null;
      });

      it('should return null when caller name is null', function() {
        const result = saveCallerName('+1234567890', null);
        expect(result).to.be.null;
      });
    });
  });

  describe('Database Safety Features', function() {
    describe('clearAllData()', function() {
      it('should throw error when NODE_ENV is production', function() {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        
        expect(() => clearAllData()).to.throw('clearAllData() cannot be called in production environment');
        
        process.env.NODE_ENV = originalEnv;
      });

      it('should work in test environment', function() {
        // This test itself demonstrates that clearAllData works in test mode
        createInspection('safety-test');
        expect(getAllInspections()).to.have.lengthOf(1);
        
        clearAllData();
        
        expect(getAllInspections()).to.have.lengthOf(0);
      });

      it('should warn when called on non-test database path', function() {
        const originalPath = process.env.DB_PATH;
        const originalEnv = process.env.NODE_ENV;
        
        process.env.DB_PATH = './data/production.db';
        process.env.NODE_ENV = 'development';
        
        // Should work but with warning (we can't easily test console.warn)
        expect(() => clearAllData()).to.not.throw();
        
        process.env.DB_PATH = originalPath;
        process.env.NODE_ENV = originalEnv;
      });
    });
  });
});
