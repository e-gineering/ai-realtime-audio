# Test Suite Quick Reference

## Running Tests

```bash
# Run all tests (109 tests)
npm test

# Run specific test suites
npm run test:database      # 31 tests - Database operations
npm run test:equipment     # 36 tests - Equipment management  
npm run test:validation    # 29 tests - Input validation
npm run test:integration   # 13 tests - End-to-end workflows

# Development mode (auto-rerun on changes)
npm run test:watch
```

## Test Statistics

| Test Suite | Tests | Lines | Coverage |
|------------|-------|-------|----------|
| Database   | 31    | 385   | CRUD operations, filtering, stats, caller management |
| Equipment  | 36    | 301   | Registry, search, filtering, data integrity |
| Validation | 29    | 358   | Field validation, edge cases, error handling |
| Integration| 13    | 341   | End-to-end workflows, multi-module interactions |
| **Total**  | **109** | **1,385** | **All core functionality** |

## Test Execution Time

⚡ **~300-400ms total** - Fast enough for continuous development

## What's Tested

### ✅ Database Operations
- Database initialization and schema
- Creating, reading, updating inspections
- Filtering by equipment, location, result
- Statistics aggregation
- Caller recognition and management
- Data cleanup and isolation

### ✅ Equipment Management
- Retrieving all equipment
- Getting equipment by ID (case-insensitive)
- Searching by location
- Filtering by status
- Equipment statistics
- Data integrity validation

### ✅ Input Validation
- Required field validation
- Equipment ID existence check
- PASS/FAIL enum enforcement
- Whitespace handling
- Special character support
- Multiple error collection

### ✅ Integration Workflows
- Complete inspection lifecycle
- Multiple inspection handling
- Equipment lookup + validation flow
- Caller recognition flow
- Data consistency checks
- Error handling scenarios

## Test Isolation

Each test runs with a clean slate:
- Database cleared before/after each test
- No shared state between tests
- No test dependencies
- Deterministic results

## Common Test Patterns

### Testing a Function
```javascript
it('should do something', function() {
  // Arrange
  const input = 'test-value';
  
  // Act
  const result = functionToTest(input);
  
  // Assert
  expect(result).to.equal('expected-value');
});
```

### Testing Database Operations
```javascript
it('should save data', function() {
  createInspection('stream-123');
  const data = { equipment_id: 'SCAFF-001', ... };
  
  saveInspectionData('stream-123', data);
  
  const saved = getInspectionByStreamSid('stream-123');
  expect(saved.equipment_id).to.equal('SCAFF-001');
});
```

### Testing Validation
```javascript
it('should reject invalid data', function() {
  const data = { equipment_id: 'INVALID' };
  
  const result = validateInspectionData(data);
  
  expect(result.valid).to.be.false;
  expect(result.errors.length).to.be.greaterThan(0);
});
```

## Files Overview

```
test/
├── database.test.js      - Database module tests
├── equipment.test.js     - Equipment module tests  
├── validation.test.js    - Validation logic tests
├── integration.test.js   - End-to-end workflow tests
└── README.md            - Detailed testing documentation
```

## Test Output Example

```
  Database Module
    ✔ should initialize the database successfully
    ✔ should create a new inspection with stream_sid
    ✔ should retrieve an inspection by stream_sid
    ... (28 more)

  Equipment Module
    ✔ should return an array of equipment
    ✔ should retrieve equipment by exact ID
    ✔ should be case-insensitive
    ... (33 more)

  Validation Module
    ✔ should validate complete and correct data
    ✔ should reject missing equipment_id
    ✔ should reject invalid inspection_result values
    ... (26 more)

  Integration Tests
    ✔ should handle a complete inspection from start to finish
    ✔ should handle multiple inspections and aggregate stats
    ... (11 more)

  109 passing (334ms)
```

## Troubleshooting

### Database Locked
If you see "database is locked" errors:
```bash
# Delete test database files
rm -rf test-data/
```

### Import Errors  
Make sure all dependencies are installed:
```bash
npm install --include=dev
```

### Timeout Errors
Tests timeout at 10 seconds. If needed, increase in package.json or .mocharc.json

## CI/CD Integration

Tests are designed for CI/CD:
- ✅ No external dependencies
- ✅ Fast execution
- ✅ Self-contained test database
- ✅ Deterministic results
- ✅ Exit code 0 on success, non-zero on failure

Example GitHub Actions:
```yaml
- name: Run tests
  run: npm test
```

## Adding New Tests

1. Choose the appropriate file (database, equipment, validation, integration)
2. Add test in a `describe` block
3. Use `beforeEach` for setup if needed
4. Follow AAA pattern (Arrange-Act-Assert)
5. Run `npm test` to verify

## Further Reading

- [Mocha Documentation](https://mochajs.org/)
- [Chai Assertions](https://www.chaijs.com/)
