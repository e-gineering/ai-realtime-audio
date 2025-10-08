import { expect } from 'chai';
import { describe, it } from 'mocha';
import {
  getAllEquipment,
  getEquipmentById,
  searchEquipmentByLocation,
  getEquipmentByStatus,
  getEquipmentStats
} from '../equipment.js';

describe('Equipment Module', function() {
  
  describe('getAllEquipment()', function() {
    it('should return an array of equipment', function() {
      const equipment = getAllEquipment();
      expect(equipment).to.be.an('array');
      expect(equipment.length).to.be.greaterThan(0);
    });

    it('should return equipment with required properties', function() {
      const equipment = getAllEquipment();
      const firstEquipment = equipment[0];
      
      expect(firstEquipment).to.have.property('id');
      expect(firstEquipment).to.have.property('type');
      expect(firstEquipment).to.have.property('location');
      expect(firstEquipment).to.have.property('height');
      expect(firstEquipment).to.have.property('last_inspection');
      expect(firstEquipment).to.have.property('status');
      expect(firstEquipment).to.have.property('notes');
    });

    it('should return at least 10 equipment items', function() {
      const equipment = getAllEquipment();
      expect(equipment.length).to.be.at.least(10);
    });

    it('should have unique IDs for all equipment', function() {
      const equipment = getAllEquipment();
      const ids = equipment.map(e => e.id);
      const uniqueIds = new Set(ids);
      
      expect(uniqueIds.size).to.equal(ids.length);
    });
  });

  describe('getEquipmentById()', function() {
    it('should retrieve equipment by exact ID', function() {
      const equipment = getEquipmentById('SCAFF-001');
      
      expect(equipment).to.not.be.undefined;
      expect(equipment.id).to.equal('SCAFF-001');
    });

    it('should be case-insensitive', function() {
      const equipment1 = getEquipmentById('scaff-001');
      const equipment2 = getEquipmentById('SCAFF-001');
      const equipment3 = getEquipmentById('Scaff-001');
      
      expect(equipment1).to.deep.equal(equipment2);
      expect(equipment2).to.deep.equal(equipment3);
    });

    it('should handle whitespace in ID', function() {
      const equipment = getEquipmentById(' SCAFF-001 ');
      
      expect(equipment).to.not.be.undefined;
      expect(equipment.id).to.equal('SCAFF-001');
    });

    it('should return undefined for non-existent ID', function() {
      const equipment = getEquipmentById('SCAFF-999');
      expect(equipment).to.be.undefined;
    });

    it('should return equipment with all properties', function() {
      const equipment = getEquipmentById('SCAFF-001');
      
      expect(equipment).to.have.property('id');
      expect(equipment).to.have.property('type');
      expect(equipment).to.have.property('location');
      expect(equipment).to.have.property('height');
      expect(equipment).to.have.property('last_inspection');
      expect(equipment).to.have.property('status');
      expect(equipment).to.have.property('notes');
    });

    it('should retrieve different equipment for different IDs', function() {
      const equipment1 = getEquipmentById('SCAFF-001');
      const equipment2 = getEquipmentById('SCAFF-002');
      
      expect(equipment1).to.not.deep.equal(equipment2);
      expect(equipment1.id).to.not.equal(equipment2.id);
    });
  });

  describe('searchEquipmentByLocation()', function() {
    it('should find equipment by partial location match', function() {
      const equipment = searchEquipmentByLocation('Warehouse A');
      
      expect(equipment).to.be.an('array');
      expect(equipment.length).to.be.greaterThan(0);
      equipment.forEach(e => {
        expect(e.location.toLowerCase()).to.include('warehouse a');
      });
    });

    it('should be case-insensitive', function() {
      const equipment1 = searchEquipmentByLocation('warehouse a');
      const equipment2 = searchEquipmentByLocation('WAREHOUSE A');
      const equipment3 = searchEquipmentByLocation('Warehouse A');
      
      expect(equipment1.length).to.equal(equipment2.length);
      expect(equipment2.length).to.equal(equipment3.length);
    });

    it('should find equipment by building name', function() {
      const equipment = searchEquipmentByLocation('Building B');
      
      expect(equipment).to.be.an('array');
      expect(equipment.length).to.be.greaterThan(0);
      equipment.forEach(e => {
        expect(e.location.toLowerCase()).to.include('building b');
      });
    });

    it('should find equipment by bay number', function() {
      const equipment = searchEquipmentByLocation('Bay 3');
      
      expect(equipment).to.be.an('array');
      expect(equipment.length).to.be.greaterThan(0);
      equipment.forEach(e => {
        expect(e.location.toLowerCase()).to.include('bay 3');
      });
    });

    it('should return empty array for non-existent location', function() {
      const equipment = searchEquipmentByLocation('NonExistent Location');
      
      expect(equipment).to.be.an('array');
      expect(equipment).to.be.empty;
    });

    it('should handle single word searches', function() {
      const equipment = searchEquipmentByLocation('Warehouse');
      
      expect(equipment).to.be.an('array');
      expect(equipment.length).to.be.greaterThan(0);
    });

    it('should return multiple results when applicable', function() {
      const equipment = searchEquipmentByLocation('Warehouse');
      
      expect(equipment.length).to.be.at.least(2);
    });
  });

  describe('getEquipmentByStatus()', function() {
    it('should retrieve all active equipment', function() {
      const equipment = getEquipmentByStatus('active');
      
      expect(equipment).to.be.an('array');
      expect(equipment.length).to.be.greaterThan(0);
      equipment.forEach(e => {
        expect(e.status).to.equal('active');
      });
    });

    it('should retrieve equipment in maintenance', function() {
      const equipment = getEquipmentByStatus('maintenance');
      
      expect(equipment).to.be.an('array');
      // At least one equipment should be in maintenance based on the data
      expect(equipment.length).to.be.greaterThan(0);
      equipment.forEach(e => {
        expect(e.status).to.equal('maintenance');
      });
    });

    it('should return empty array for non-existent status', function() {
      const equipment = getEquipmentByStatus('decommissioned');
      
      expect(equipment).to.be.an('array');
      expect(equipment).to.be.empty;
    });

    it('should filter correctly by status', function() {
      const allEquipment = getAllEquipment();
      const activeEquipment = getEquipmentByStatus('active');
      const maintenanceEquipment = getEquipmentByStatus('maintenance');
      
      expect(activeEquipment.length + maintenanceEquipment.length).to.be.at.most(allEquipment.length);
    });
  });

  describe('getEquipmentStats()', function() {
    it('should return statistics object', function() {
      const stats = getEquipmentStats();
      
      expect(stats).to.be.an('object');
      expect(stats).to.have.property('total');
      expect(stats).to.have.property('byStatus');
      expect(stats).to.have.property('byType');
    });

    it('should return correct total count', function() {
      const stats = getEquipmentStats();
      const allEquipment = getAllEquipment();
      
      expect(stats.total).to.equal(allEquipment.length);
    });

    it('should count equipment by status', function() {
      const stats = getEquipmentStats();
      
      expect(stats.byStatus).to.be.an('object');
      expect(stats.byStatus).to.have.property('active');
      expect(stats.byStatus.active).to.be.a('number');
      expect(stats.byStatus.active).to.be.greaterThan(0);
    });

    it('should count equipment by type', function() {
      const stats = getEquipmentStats();
      
      expect(stats.byType).to.be.an('object');
      expect(Object.keys(stats.byType).length).to.be.greaterThan(0);
      
      // Check that at least one type exists
      const firstType = Object.keys(stats.byType)[0];
      expect(stats.byType[firstType]).to.be.a('number');
      expect(stats.byType[firstType]).to.be.greaterThan(0);
    });

    it('should have consistent counts', function() {
      const stats = getEquipmentStats();
      
      // Sum of counts by status should equal total
      const statusSum = Object.values(stats.byStatus).reduce((sum, count) => sum + count, 0);
      expect(statusSum).to.equal(stats.total);
      
      // Sum of counts by type should equal total
      const typeSum = Object.values(stats.byType).reduce((sum, count) => sum + count, 0);
      expect(typeSum).to.equal(stats.total);
    });

    it('should include Mobile Scaffold Tower in types', function() {
      const stats = getEquipmentStats();
      
      expect(stats.byType).to.have.property('Mobile Scaffold Tower');
      expect(stats.byType['Mobile Scaffold Tower']).to.be.greaterThan(0);
    });

    it('should have multiple equipment types', function() {
      const stats = getEquipmentStats();
      
      expect(Object.keys(stats.byType).length).to.be.at.least(3);
    });
  });

  describe('Equipment Data Integrity', function() {
    it('should have valid equipment IDs', function() {
      const equipment = getAllEquipment();
      
      equipment.forEach(e => {
        expect(e.id).to.match(/^SCAFF-\d{3}$/);
      });
    });

    it('should have valid height values', function() {
      const equipment = getAllEquipment();
      
      equipment.forEach(e => {
        expect(e.height).to.match(/^\d+m$/);
      });
    });

    it('should have valid date format for last_inspection', function() {
      const equipment = getAllEquipment();
      
      equipment.forEach(e => {
        expect(e.last_inspection).to.match(/^\d{4}-\d{2}-\d{2}$/);
        // Validate it's a valid date
        const date = new Date(e.last_inspection);
        expect(date).to.not.be.NaN;
      });
    });

    it('should have non-empty locations', function() {
      const equipment = getAllEquipment();
      
      equipment.forEach(e => {
        expect(e.location).to.be.a('string');
        expect(e.location.length).to.be.greaterThan(0);
      });
    });

    it('should have non-empty types', function() {
      const equipment = getAllEquipment();
      
      equipment.forEach(e => {
        expect(e.type).to.be.a('string');
        expect(e.type.length).to.be.greaterThan(0);
      });
    });

    it('should have valid status values', function() {
      const equipment = getAllEquipment();
      const validStatuses = ['active', 'maintenance', 'inactive', 'decommissioned'];
      
      equipment.forEach(e => {
        expect(validStatuses).to.include(e.status);
      });
    });
  });

  describe('Equipment Relationships', function() {
    it('should have equipment at different locations', function() {
      const equipment = getAllEquipment();
      const locations = new Set(equipment.map(e => e.location));
      
      expect(locations.size).to.be.at.least(10);
    });

    it('should have equipment of different types', function() {
      const equipment = getAllEquipment();
      const types = new Set(equipment.map(e => e.type));
      
      expect(types.size).to.be.at.least(3);
    });

    it('should have equipment with different heights', function() {
      const equipment = getAllEquipment();
      const heights = new Set(equipment.map(e => e.height));
      
      expect(heights.size).to.be.at.least(5);
    });
  });
});
