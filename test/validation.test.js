import { expect } from 'chai';
import { describe, it } from 'mocha';
import { validateInspectionData } from '../validation.js';

describe('Validation Module', function() {
  
  describe('validateInspectionData()', function() {
    
    describe('Valid Data', function() {
      it('should validate complete and correct data', function() {
        const data = {
          equipment_id: 'SCAFF-001',
          inspector_name: 'John Doe',
          location: 'Warehouse A',
          inspection_result: 'PASS',
          comments: 'All good'
        };
        
        const result = validateInspectionData(data);
        expect(result.valid).to.be.true;
        expect(result.errors).to.be.an('array').that.is.empty;
      });

      it('should validate data without comments', function() {
        const data = {
          equipment_id: 'SCAFF-002',
          inspector_name: 'Jane Smith',
          location: 'Warehouse B',
          inspection_result: 'FAIL'
        };
        
        const result = validateInspectionData(data);
        expect(result.valid).to.be.true;
        expect(result.errors).to.be.an('array').that.is.empty;
      });

      it('should validate PASS result', function() {
        const data = {
          equipment_id: 'SCAFF-003',
          inspector_name: 'Inspector',
          location: 'Location',
          inspection_result: 'PASS'
        };
        
        const result = validateInspectionData(data);
        expect(result.valid).to.be.true;
      });

      it('should validate FAIL result', function() {
        const data = {
          equipment_id: 'SCAFF-003',
          inspector_name: 'Inspector',
          location: 'Location',
          inspection_result: 'FAIL'
        };
        
        const result = validateInspectionData(data);
        expect(result.valid).to.be.true;
      });
    });

    describe('Equipment ID Validation', function() {
      it('should reject missing equipment_id', function() {
        const data = {
          inspector_name: 'John Doe',
          location: 'Warehouse A',
          inspection_result: 'PASS'
        };
        
        const result = validateInspectionData(data);
        expect(result.valid).to.be.false;
        expect(result.errors).to.include('equipment_id is required');
      });

      it('should reject empty equipment_id', function() {
        const data = {
          equipment_id: '',
          inspector_name: 'John Doe',
          location: 'Warehouse A',
          inspection_result: 'PASS'
        };
        
        const result = validateInspectionData(data);
        expect(result.valid).to.be.false;
        expect(result.errors).to.include('equipment_id is required');
      });

      it('should reject whitespace-only equipment_id', function() {
        const data = {
          equipment_id: '   ',
          inspector_name: 'John Doe',
          location: 'Warehouse A',
          inspection_result: 'PASS'
        };
        
        const result = validateInspectionData(data);
        expect(result.valid).to.be.false;
        expect(result.errors).to.include('equipment_id is required');
      });

      it('should reject non-existent equipment_id', function() {
        const data = {
          equipment_id: 'SCAFF-999',
          inspector_name: 'John Doe',
          location: 'Warehouse A',
          inspection_result: 'PASS'
        };
        
        const result = validateInspectionData(data);
        expect(result.valid).to.be.false;
        expect(result.errors).to.have.lengthOf(1);
        expect(result.errors[0]).to.include('not found in registry');
      });

      it('should accept valid equipment_id', function() {
        const data = {
          equipment_id: 'SCAFF-001',
          inspector_name: 'John Doe',
          location: 'Warehouse A',
          inspection_result: 'PASS'
        };
        
        const result = validateInspectionData(data);
        expect(result.valid).to.be.true;
      });
    });

    describe('Inspector Name Validation', function() {
      it('should reject missing inspector_name', function() {
        const data = {
          equipment_id: 'SCAFF-001',
          location: 'Warehouse A',
          inspection_result: 'PASS'
        };
        
        const result = validateInspectionData(data);
        expect(result.valid).to.be.false;
        expect(result.errors).to.include('inspector_name is required');
      });

      it('should reject empty inspector_name', function() {
        const data = {
          equipment_id: 'SCAFF-001',
          inspector_name: '',
          location: 'Warehouse A',
          inspection_result: 'PASS'
        };
        
        const result = validateInspectionData(data);
        expect(result.valid).to.be.false;
        expect(result.errors).to.include('inspector_name is required');
      });

      it('should reject whitespace-only inspector_name', function() {
        const data = {
          equipment_id: 'SCAFF-001',
          inspector_name: '   ',
          location: 'Warehouse A',
          inspection_result: 'PASS'
        };
        
        const result = validateInspectionData(data);
        expect(result.valid).to.be.false;
        expect(result.errors).to.include('inspector_name is required');
      });

      it('should accept valid inspector_name', function() {
        const data = {
          equipment_id: 'SCAFF-001',
          inspector_name: 'John Doe',
          location: 'Warehouse A',
          inspection_result: 'PASS'
        };
        
        const result = validateInspectionData(data);
        expect(result.valid).to.be.true;
      });
    });

    describe('Location Validation', function() {
      it('should reject missing location', function() {
        const data = {
          equipment_id: 'SCAFF-001',
          inspector_name: 'John Doe',
          inspection_result: 'PASS'
        };
        
        const result = validateInspectionData(data);
        expect(result.valid).to.be.false;
        expect(result.errors).to.include('location is required');
      });

      it('should reject empty location', function() {
        const data = {
          equipment_id: 'SCAFF-001',
          inspector_name: 'John Doe',
          location: '',
          inspection_result: 'PASS'
        };
        
        const result = validateInspectionData(data);
        expect(result.valid).to.be.false;
        expect(result.errors).to.include('location is required');
      });

      it('should reject whitespace-only location', function() {
        const data = {
          equipment_id: 'SCAFF-001',
          inspector_name: 'John Doe',
          location: '   ',
          inspection_result: 'PASS'
        };
        
        const result = validateInspectionData(data);
        expect(result.valid).to.be.false;
        expect(result.errors).to.include('location is required');
      });

      it('should accept valid location', function() {
        const data = {
          equipment_id: 'SCAFF-001',
          inspector_name: 'John Doe',
          location: 'Warehouse A',
          inspection_result: 'PASS'
        };
        
        const result = validateInspectionData(data);
        expect(result.valid).to.be.true;
      });
    });

    describe('Inspection Result Validation', function() {
      it('should reject missing inspection_result', function() {
        const data = {
          equipment_id: 'SCAFF-001',
          inspector_name: 'John Doe',
          location: 'Warehouse A'
        };
        
        const result = validateInspectionData(data);
        expect(result.valid).to.be.false;
        expect(result.errors).to.include('inspection_result is required');
      });

      it('should reject invalid inspection_result values', function() {
        const invalidValues = ['pass', 'fail', 'Pass', 'Fail', 'PASSED', 'FAILED', 'OK', 'NOT OK', 'true', 'false', ''];
        
        invalidValues.forEach(value => {
          const data = {
            equipment_id: 'SCAFF-001',
            inspector_name: 'John Doe',
            location: 'Warehouse A',
            inspection_result: value
          };
          
          const result = validateInspectionData(data);
          expect(result.valid).to.be.false;
          expect(result.errors.length).to.be.greaterThan(0);
        });
      });

      it('should accept PASS', function() {
        const data = {
          equipment_id: 'SCAFF-001',
          inspector_name: 'John Doe',
          location: 'Warehouse A',
          inspection_result: 'PASS'
        };
        
        const result = validateInspectionData(data);
        expect(result.valid).to.be.true;
      });

      it('should accept FAIL', function() {
        const data = {
          equipment_id: 'SCAFF-001',
          inspector_name: 'John Doe',
          location: 'Warehouse A',
          inspection_result: 'FAIL'
        };
        
        const result = validateInspectionData(data);
        expect(result.valid).to.be.true;
      });
    });

    describe('Multiple Validation Errors', function() {
      it('should return all validation errors', function() {
        const data = {
          equipment_id: '',
          inspector_name: '',
          location: '',
          inspection_result: 'invalid'
        };
        
        const result = validateInspectionData(data);
        expect(result.valid).to.be.false;
        expect(result.errors.length).to.be.at.least(4);
      });

      it('should return errors for completely empty data', function() {
        const data = {};
        
        const result = validateInspectionData(data);
        expect(result.valid).to.be.false;
        expect(result.errors.length).to.be.at.least(4);
      });

      it('should collect all specific errors', function() {
        const data = {
          equipment_id: 'SCAFF-999',
          inspector_name: '',
          location: '   ',
          inspection_result: 'maybe'
        };
        
        const result = validateInspectionData(data);
        expect(result.valid).to.be.false;
        
        // Check that we have errors for each field
        const hasEquipmentError = result.errors.some(e => e.includes('equipment_id'));
        const hasInspectorError = result.errors.some(e => e.includes('inspector_name'));
        const hasLocationError = result.errors.some(e => e.includes('location'));
        const hasResultError = result.errors.some(e => e.includes('inspection_result'));
        
        expect(hasEquipmentError).to.be.true;
        expect(hasInspectorError).to.be.true;
        expect(hasLocationError).to.be.true;
        expect(hasResultError).to.be.true;
      });
    });

    describe('Edge Cases', function() {
      it('should handle null values', function() {
        const data = {
          equipment_id: null,
          inspector_name: null,
          location: null,
          inspection_result: null
        };
        
        const result = validateInspectionData(data);
        expect(result.valid).to.be.false;
        expect(result.errors.length).to.be.greaterThan(0);
      });

      it('should trim whitespace when checking equipment_id existence', function() {
        const data = {
          equipment_id: ' SCAFF-001 ',
          inspector_name: 'John Doe',
          location: 'Warehouse A',
          inspection_result: 'PASS'
        };
        
        // This should work because we trim before checking
        const result = validateInspectionData(data);
        expect(result.valid).to.be.true;
      });

      it('should handle very long strings', function() {
        const data = {
          equipment_id: 'SCAFF-001',
          inspector_name: 'A'.repeat(1000),
          location: 'B'.repeat(1000),
          inspection_result: 'PASS',
          comments: 'C'.repeat(10000)
        };
        
        const result = validateInspectionData(data);
        expect(result.valid).to.be.true;
      });

      it('should handle special characters in names and locations', function() {
        const data = {
          equipment_id: 'SCAFF-001',
          inspector_name: "O'Brien-Smith",
          location: 'Warehouse A - Bay #3 (North)',
          inspection_result: 'PASS'
        };
        
        const result = validateInspectionData(data);
        expect(result.valid).to.be.true;
      });
    });
  });
});
