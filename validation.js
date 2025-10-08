import { getEquipmentById } from './equipment.js';

/**
 * Validate inspection data before saving
 * @param {Object} data - Inspection data to validate
 * @returns {Object} - Validation result with valid flag and errors array
 */
export function validateInspectionData(data) {
  const errors = [];
  
  if (!data.equipment_id || data.equipment_id.trim() === '') {
    errors.push('equipment_id is required');
  } else {
    const equipment = getEquipmentById(data.equipment_id);
    if (!equipment) {
      errors.push(`equipment_id "${data.equipment_id}" not found in registry`);
    }
  }
  
  if (!data.inspector_name || data.inspector_name.trim() === '') {
    errors.push('inspector_name is required');
  }
  
  if (!data.location || data.location.trim() === '') {
    errors.push('location is required');
  }
  
  if (!data.inspection_result) {
    errors.push('inspection_result is required');
  } else if (data.inspection_result !== 'PASS' && data.inspection_result !== 'FAIL') {
    errors.push('inspection_result must be exactly "PASS" or "FAIL"');
  }
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

export default {
  validateInspectionData
};
