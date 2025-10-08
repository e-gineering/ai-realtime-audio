# Test Suite Documentation

## Overview

This test suite provides comprehensive unit and integration testing for the AI Realtime Audio application. The tests cover database operations, equipment management, validation logic, and end-to-end workflows.

## Test Structure

```
test/
├── database.test.js      - Database operations and SQLite integration
├── equipment.test.js     - Equipment registry and search functions
├── validation.test.js    - Input validation and data integrity
└── integration.test.js   - End-to-end workflow tests
```

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test Suites
```bash
npm run test:database      # Database tests only
npm run test:equipment     # Equipment tests only
npm run test:validation    # Validation tests only
npm run test:integration   # Integration tests only
```

### Watch Mode
```bash
npm run test:watch
```

## Test Coverage

### Database Module (`database.test.js`)
- **Database initialization** - Table creation, indexes, and schema
- **Inspection CRUD operations** - Create, read, update inspection records
- **Data retrieval** - By stream ID, equipment ID, location, and result
- **Caller management** - Save and retrieve caller information
- **Statistics** - Aggregate inspection data
- **Edge cases** - Null values, duplicates, empty results

**Test Count**: 25+ tests

### Equipment Module (`equipment.test.js`)
- **Equipment retrieval** - Get all equipment, by ID, by status
- **Search functionality** - Location-based search, case-insensitivity
- **Data integrity** - Validate equipment structure and required fields
- **Statistics** - Equipment counts by status and type
- **Edge cases** - Whitespace handling, non-existent IDs

**Test Count**: 30+ tests

### Validation Module (`validation.test.js`)
- **Field validation** - Equipment ID, inspector name, location, result
- **Equipment verification** - Check against equipment registry
- **Result validation** - PASS/FAIL enum enforcement
- **Multiple errors** - Collect all validation issues
- **Edge cases** - Special characters, null values, whitespace

**Test Count**: 35+ tests

### Integration Tests (`integration.test.js`)
- **Complete workflows** - Full inspection lifecycle from start to finish
- **Multi-step processes** - Caller recognition, equipment lookup, data saving
- **Data consistency** - Verify data integrity across operations
- **Real-world scenarios** - Multiple inspections, different locations
- **Error handling** - Validation failures, invalid data

**Test Count**: 15+ tests

## Test Database

Tests use an isolated SQLite database to avoid affecting production data:
- **Location**: `./test-data/test-inspections.db`
- **Lifecycle**: Created before tests, cleaned up after
- **Isolation**: Each test suite uses a fresh database instance

## Key Test Patterns

### Setup and Teardown
```javascript
before(function() {
  // Initialize test database
  initializeDatabase();
});

after(function() {
  // Clean up
  closeDatabase();
});
```

### Assertion Style
Tests use Chai's BDD style assertions:
```javascript
expect(value).to.equal(expected);
expect(array).to.have.lengthOf(5);
expect(result.valid).to.be.true;
```

## Testing Best Practices

1. **Isolation**: Each test is independent and doesn't rely on others
2. **Cleanup**: Test data is cleaned up after execution
3. **Descriptive Names**: Test names clearly describe what is being tested
4. **Comprehensive Coverage**: Tests cover happy paths, edge cases, and error conditions
5. **Fast Execution**: Tests run quickly (< 10 seconds total)

## Adding New Tests

When adding new tests:

1. **Choose the right file**:
   - Database operations → `database.test.js`
   - Equipment functions → `equipment.test.js`
   - Validation logic → `validation.test.js`
   - Multi-module workflows → `integration.test.js`

2. **Follow the pattern**:
   ```javascript
   describe('Feature Name', function() {
     describe('functionName()', function() {
       it('should do something specific', function() {
         // Arrange
         const input = 'test data';
         
         // Act
         const result = functionName(input);
         
         // Assert
         expect(result).to.equal(expected);
       });
     });
   });
   ```

3. **Test edge cases**: Always test boundary conditions, null values, and error states

4. **Keep tests focused**: Each test should verify one specific behavior

## Continuous Integration

Tests are designed to run in CI/CD pipelines:
- No external dependencies required
- Self-contained test database
- Deterministic results
- Fast execution time

## Troubleshooting

### Database Locked Error
If you see "database is locked" errors:
- Ensure previous test runs completed cleanup
- Delete `./test-data/*.db*` files manually
- Check that no other processes are accessing the test database

### Import Errors
If imports fail:
- Verify all dependencies are installed: `npm install`
- Check that you're using Node.js with ES modules support (v14+)
- Ensure `"type": "module"` is in package.json

### Timeout Errors
If tests timeout:
- Check that the database is properly initialized
- Verify no infinite loops in code under test
- Increase timeout in package.json if needed

## Test Metrics

Current test coverage:
- **Total Tests**: 105+
- **Execution Time**: ~5-10 seconds
- **Modules Covered**: 4 (database, equipment, validation, integration)
- **Lines of Test Code**: 500+

## Future Enhancements

Potential areas for additional testing:
- WebSocket connection handling
- OpenAI API integration (with mocks)
- MCP client initialization and tool calling
- Twilio integration (with mocks)
- Error recovery and retry logic
- Performance and load testing
