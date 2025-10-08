import { expect } from 'chai';
import { after, before, describe, it } from 'mocha';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import {
  initializeDatabase,
  createInspection,
  saveInspectionData,
  completeInspection,
  getInspectionByStreamSid,
  getInspectionStats,
  closeDatabase,
  saveCallerName,
  getCallerByPhoneNumber,
  clearAllData
} from '../database.js';
import { getEquipmentById, searchEquipmentByLocation, getAllEquipment } from '../equipment.js';
import { validateInspectionData } from '../validation.js';

describe('Integration Tests', function() {
  const TEST_DB_PATH = './test-data/integration-test.db';
  
  before(function() {
    // Ensure test data directory exists
    if (!existsSync('./test-data')) {
      mkdirSync('./test-data', { recursive: true });
    }
    // Set test database path
    process.env.DB_PATH = TEST_DB_PATH;
    initializeDatabase();
  });
  
  beforeEach(function() {
    // Clear data before each test
    clearAllData();
  });

  after(function() {
    closeDatabase();
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

  describe('Complete Inspection Workflow', function() {
    it('should handle a complete inspection from start to finish', function() {
      // Step 1: Start inspection
      const streamSid = 'integration-test-001';
      const phoneNumber = '+15551234567';
      
      const inspection = createInspection(streamSid, phoneNumber);
      expect(inspection).to.not.be.undefined;
      expect(inspection.status).to.equal('in_progress');
      
      // Step 2: Save caller name
      const callerName = 'John Inspector';
      saveCallerName(phoneNumber, callerName);
      const caller = getCallerByPhoneNumber(phoneNumber);
      expect(caller.caller_name).to.equal(callerName);
      
      // Step 3: Lookup equipment
      const equipment = getEquipmentById('SCAFF-001');
      expect(equipment).to.not.be.undefined;
      expect(equipment.id).to.equal('SCAFF-001');
      
      // Step 4: Validate inspection data
      const inspectionData = {
        equipment_id: equipment.id,
        inspector_name: callerName,
        location: equipment.location,
        inspection_result: 'PASS',
        comments: 'All safety checks passed'
      };
      
      const validation = validateInspectionData(inspectionData);
      expect(validation.valid).to.be.true;
      
      // Step 5: Save inspection data
      saveInspectionData(streamSid, inspectionData);
      
      const savedInspection = getInspectionByStreamSid(streamSid);
      expect(savedInspection.equipment_id).to.equal(inspectionData.equipment_id);
      expect(savedInspection.inspector_name).to.equal(inspectionData.inspector_name);
      expect(savedInspection.status).to.equal('completed');
      
      // Step 6: Complete inspection (end call)
      completeInspection(streamSid);
      
      const completedInspection = getInspectionByStreamSid(streamSid);
      expect(completedInspection.call_ended_at).to.not.be.null;
      expect(completedInspection.call_duration_seconds).to.be.at.least(0);
    });

    it('should handle multiple inspections and aggregate stats', function() {
      // Create several inspections
      const inspections = [
        {
          streamSid: 'multi-001',
          equipmentId: 'SCAFF-001',
          inspectorName: 'Inspector A',
          result: 'PASS'
        },
        {
          streamSid: 'multi-002',
          equipmentId: 'SCAFF-002',
          inspectorName: 'Inspector B',
          result: 'FAIL'
        },
        {
          streamSid: 'multi-003',
          equipmentId: 'SCAFF-003',
          inspectorName: 'Inspector A',
          result: 'PASS'
        },
        {
          streamSid: 'multi-004',
          equipmentId: 'SCAFF-004',
          inspectorName: 'Inspector C',
          result: 'FAIL'
        }
      ];
      
      inspections.forEach(insp => {
        createInspection(insp.streamSid);
        const equipment = getEquipmentById(insp.equipmentId);
        
        saveInspectionData(insp.streamSid, {
          equipment_id: insp.equipmentId,
          inspector_name: insp.inspectorName,
          location: equipment.location,
          inspection_result: insp.result
        });
      });
      
      // Check stats
      const stats = getInspectionStats();
      expect(stats.passed).to.be.at.least(2);
      expect(stats.failed).to.be.at.least(2);
      expect(stats.unique_inspectors).to.be.at.least(3);
    });
  });

  describe('Equipment Search and Validation', function() {
    it('should search equipment by location and validate result', function() {
      const searchResults = searchEquipmentByLocation('Warehouse A');
      expect(searchResults.length).to.be.greaterThan(0);
      
      // Pick first result and validate it can be used in an inspection
      const equipment = searchResults[0];
      const inspectionData = {
        equipment_id: equipment.id,
        inspector_name: 'Test Inspector',
        location: equipment.location,
        inspection_result: 'PASS'
      };
      
      const validation = validateInspectionData(inspectionData);
      expect(validation.valid).to.be.true;
    });

    it('should reject inspection with invalid equipment from search', function() {
      const inspectionData = {
        equipment_id: 'INVALID-999',
        inspector_name: 'Test Inspector',
        location: 'Somewhere',
        inspection_result: 'PASS'
      };
      
      const validation = validateInspectionData(inspectionData);
      expect(validation.valid).to.be.false;
      expect(validation.errors.some(e => e.includes('not found'))).to.be.true;
    });
  });

  describe('Caller Recognition', function() {
    it('should recognize returning caller', function() {
      const phoneNumber = '+15559876543';
      const callerName = 'Jane Regular';
      
      // First call
      saveCallerName(phoneNumber, callerName);
      createInspection('call-1', phoneNumber);
      
      // Second call - should be able to retrieve caller
      const caller = getCallerByPhoneNumber(phoneNumber);
      expect(caller).to.not.be.null;
      expect(caller.caller_name).to.equal(callerName);
      
      createInspection('call-2', phoneNumber);
      
      // Both inspections should have the phone number
      const inspection1 = getInspectionByStreamSid('call-1');
      const inspection2 = getInspectionByStreamSid('call-2');
      
      expect(inspection1.phone_number).to.equal(phoneNumber);
      expect(inspection2.phone_number).to.equal(phoneNumber);
    });

    it('should update caller name on subsequent saves', function() {
      const phoneNumber = '+15551112222';
      
      saveCallerName(phoneNumber, 'Old Name');
      let caller = getCallerByPhoneNumber(phoneNumber);
      expect(caller.caller_name).to.equal('Old Name');
      
      saveCallerName(phoneNumber, 'Updated Name');
      caller = getCallerByPhoneNumber(phoneNumber);
      expect(caller.caller_name).to.equal('Updated Name');
    });
  });

  describe('Data Consistency', function() {
    it('should maintain data integrity across operations', function() {
      const streamSid = 'consistency-test';
      const equipmentId = 'SCAFF-005';
      
      // Verify equipment exists
      const equipment = getEquipmentById(equipmentId);
      expect(equipment).to.not.be.undefined;
      
      // Create inspection
      createInspection(streamSid);
      
      // Save with equipment data
      const inspectionData = {
        equipment_id: equipmentId,
        inspector_name: 'Consistency Tester',
        location: equipment.location,
        inspection_result: 'PASS'
      };
      
      saveInspectionData(streamSid, inspectionData);
      
      // Retrieve and verify all data matches
      const saved = getInspectionByStreamSid(streamSid);
      expect(saved.equipment_id).to.equal(equipment.id);
      expect(saved.location).to.equal(equipment.location);
      expect(saved.inspector_name).to.equal(inspectionData.inspector_name);
      expect(saved.inspection_result).to.equal(inspectionData.inspection_result);
    });

    it('should handle special characters in data', function() {
      const streamSid = 'special-chars-test';
      const equipment = getAllEquipment()[0];
      
      createInspection(streamSid);
      
      const inspectionData = {
        equipment_id: equipment.id,
        inspector_name: "O'Brien & Sons",
        location: equipment.location,
        inspection_result: 'PASS',
        comments: 'Found minor issues: rust spots (2), loose bolts (3), need attention!'
      };
      
      saveInspectionData(streamSid, inspectionData);
      
      const saved = getInspectionByStreamSid(streamSid);
      expect(saved.inspector_name).to.equal(inspectionData.inspector_name);
      expect(saved.comments).to.equal(inspectionData.comments);
    });
  });

  describe('Error Handling', function() {
    it('should handle validation errors gracefully', function() {
      const invalidData = {
        equipment_id: '',
        inspector_name: '',
        location: '',
        inspection_result: 'INVALID'
      };
      
      const validation = validateInspectionData(invalidData);
      expect(validation.valid).to.be.false;
      expect(validation.errors).to.be.an('array');
      expect(validation.errors.length).to.be.greaterThan(0);
    });

    it('should prevent saving invalid inspection data', function() {
      const streamSid = 'invalid-test';
      createInspection(streamSid);
      
      const invalidData = {
        equipment_id: 'NONEXISTENT-999',
        inspector_name: 'Test',
        location: 'Test',
        inspection_result: 'PASS'
      };
      
      const validation = validateInspectionData(invalidData);
      expect(validation.valid).to.be.false;
      
      // Don't save if validation fails
      if (!validation.valid) {
        const inspection = getInspectionByStreamSid(streamSid);
        expect(inspection.equipment_id).to.be.null;
      }
    });
  });

  describe('Real-world Scenarios', function() {
    it('should handle same equipment inspected multiple times', function() {
      const equipmentId = 'SCAFF-006';
      const equipment = getEquipmentById(equipmentId);
      
      // Create multiple inspections for same equipment
      const inspectionIds = ['scenario-1', 'scenario-2', 'scenario-3'];
      
      inspectionIds.forEach(sid => {
        createInspection(sid);
        saveInspectionData(sid, {
          equipment_id: equipmentId,
          inspector_name: 'Inspector',
          location: equipment.location,
          inspection_result: 'PASS'
        });
      });
      
      // Should be able to track all inspections
      const stats = getInspectionStats();
      expect(stats.total).to.be.at.least(3);
    });

    it('should handle multiple inspectors at different locations', function() {
      const locations = ['Warehouse A', 'Warehouse B', 'Building C'];
      
      locations.forEach((loc, idx) => {
        const equipment = searchEquipmentByLocation(loc)[0];
        if (equipment) {
          const sid = `location-test-${idx}`;
          createInspection(sid);
          saveInspectionData(sid, {
            equipment_id: equipment.id,
            inspector_name: `Inspector ${idx + 1}`,
            location: equipment.location,
            inspection_result: 'PASS'
          });
        }
      });
      
      const stats = getInspectionStats();
      expect(stats.unique_locations).to.be.greaterThan(1);
    });
  });
});
