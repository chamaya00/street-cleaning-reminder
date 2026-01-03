# Testing Guidelines for AI Assistants and Developers

This document provides mandatory testing practices that MUST be followed when working on this codebase, especially when using AI assistants like Claude Code.

## 🚨 MANDATORY: Before Every Commit

### 1. Verify CI Compatibility

**ALWAYS run this before committing test-related changes:**

```bash
npm run verify-ci
```

This simulates the CI environment by:
- Removing `node_modules` completely
- Installing with `npm ci` (exact versions from lock file)
- Running tests exactly as CI would

**Why:** Tests can pass locally but fail in CI due to missing dependencies, cached packages, or environment differences.

### 2. Check for Flakiness

**Run tests multiple times to ensure consistency:**

```bash
npm run test:flakiness
```

Tests MUST pass every single time. If they fail intermittently, fix the flakiness before committing.

## 📋 Test Writing Checklist

When writing or modifying tests, verify ALL of these:

### ✅ Test Characteristics

- [ ] **FAST**: Each test completes in < 100ms
- [ ] **ISOLATED**: Tests don't share state or depend on each other
- [ ] **DETERMINISTIC**: Same input always produces same output
- [ ] **READABLE**: Clear arrange-act-assert structure
- [ ] **DESCRIPTIVE**: Test names describe what's tested and expected behavior

### ✅ Coverage Requirements

- [ ] Line coverage > 80% for business logic (`lib/`, `app/api/`)
- [ ] Branch coverage > 80% (all if/else paths tested)
- [ ] All public functions have at least one test
- [ ] Edge cases covered (empty, null, boundary values)

### ✅ No CI/Local Discrepancies

- [ ] **NO** hardcoded dates/times (use mocks or fixtures)
- [ ] **NO** random values that could cause flakiness
- [ ] **NO** file system dependencies (use temp dirs or mocks)
- [ ] **NO** network calls (mock external services)
- [ ] **NO** timing dependencies (`setTimeout` without mocking)
- [ ] **NO** environment-specific code (OS, paths, etc.)

### ✅ Dependency Management

- [ ] All test dependencies in `package.json` devDependencies
- [ ] No reliance on globally installed packages
- [ ] No transitive dependencies assumed to exist
- [ ] Verified with `npm run verify-ci`

## 🎯 Common CI Failure Patterns

### Pattern 1: Missing Dependencies

**Symptom:** Tests pass locally, fail in CI with "Cannot find module"

**Example:**
```
Error: Cannot find package 'ts-node'
```

**Solution:**
```bash
npm install --save-dev ts-node
npm run verify-ci  # Verify fix
```

### Pattern 2: Flaky Tests (Non-Deterministic)

**Symptom:** Tests sometimes pass, sometimes fail

**Bad Example:**
```typescript
it('should generate different tokens', () => {
  const token1 = generateToken();
  const token2 = generateToken();
  expect(token1).not.toBe(token2); // Could collide!
});
```

**Good Example:**
```typescript
it('should generate unique tokens', () => {
  const tokens = new Set();
  for (let i = 0; i < 100; i++) {
    tokens.add(generateToken());
  }
  expect(tokens.size).toBe(100); // No collisions in 100 attempts
});
```

### Pattern 3: Environment-Specific Paths

**Bad Example:**
```typescript
const filePath = '/Users/john/project/data.json'; // Fails on other machines!
```

**Good Example:**
```typescript
const filePath = path.join(__dirname, 'data.json'); // Works everywhere
```

### Pattern 4: Date/Time Dependencies

**Bad Example:**
```typescript
it('should return next Monday', () => {
  const result = getNextMonday();
  expect(result.getDay()).toBe(1); // Fails if run ON Monday!
});
```

**Good Example:**
```typescript
it('should return next Monday from a Wednesday', () => {
  const wednesday = new Date('2024-01-10'); // Fixed date
  const result = getNextMonday(wednesday);
  expect(result.getDay()).toBe(1);
});
```

## 🔍 Verification Methods

### Method 1: Mutation Testing (Manual)

Change the source code and verify tests catch it:

```typescript
// Original
export function formatTime(time: string): string {
  const period = hours >= 12 ? 'pm' : 'am';
  // ...
}

// Mutate it
export function formatTime(time: string): string {
  const period = hours > 12 ? 'pm' : 'am';  // Changed >= to >
  // ...
}

// Run tests - they should FAIL
// If they pass, your tests don't cover this logic!
```

### Method 2: Coverage Analysis

```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

Look for:
- **Red lines**: Not executed by any test
- **Yellow lines**: Partially covered branches
- **Green lines**: Fully tested

### Method 3: CI Simulation

```bash
npm run verify-ci
```

This is the ultimate test - if it passes, CI will pass.

## 🤖 AI Assistant Specific Guidelines

When Claude Code or other AI assistants are writing tests:

### 1. Always Verify CI Compatibility

After creating or modifying tests:

```bash
npm run verify-ci
```

Include this in your workflow summary to the user.

### 2. Check Coverage

After writing tests:

```bash
npm run test:coverage
```

Report uncovered lines to the user and suggest additional tests if coverage is < 80%.

### 3. Test for Flakiness

Run tests multiple times:

```bash
npm run test:flakiness
```

Only mark the task complete if all 5 runs pass.

### 4. Document Assumptions

If a test makes assumptions (e.g., "this random collision is negligible"), document it:

```typescript
it('should generate unique tokens', () => {
  // Note: Testing uniqueness across 100 samples
  // Collision probability: (62^32)^-1 ≈ 0 for practical purposes
  const tokens = new Set();
  for (let i = 0; i < 100; i++) {
    tokens.add(generateToken());
  }
  expect(tokens.size).toBe(100);
});
```

## 📊 Success Metrics

A well-tested codebase has:

- ✅ **Zero flaky tests** (100% consistent pass rate)
- ✅ **< 5 second test suite** (for unit tests)
- ✅ **> 80% coverage** (for business logic)
- ✅ **100% CI pass rate** (when verified locally with `verify-ci`)
- ✅ **Clear test failures** (when they fail, you immediately know why)

## 🚫 Anti-Patterns to Avoid

### ❌ Don't: Test Implementation Details

```typescript
// Bad: Testing how it's done
expect(component.state.counter).toBe(1);

// Good: Testing what it does
expect(screen.getByText('Count: 1')).toBeInTheDocument();
```

### ❌ Don't: Write Tests That Depend on Order

```typescript
// Bad: Test depends on previous test
describe('User', () => {
  let user;
  it('creates user', () => {
    user = new User(); // Side effect!
  });
  it('updates user', () => {
    user.update(); // Depends on previous test!
  });
});

// Good: Each test is independent
describe('User', () => {
  it('creates user', () => {
    const user = new User();
    expect(user).toBeDefined();
  });
  it('updates user', () => {
    const user = new User(); // Fresh instance
    user.update();
    expect(user.isUpdated).toBe(true);
  });
});
```

### ❌ Don't: Mock Everything

```typescript
// Bad: Over-mocking defeats the purpose
jest.mock('./utils');
jest.mock('./helpers');
jest.mock('./services');
// Now you're just testing mocks!

// Good: Only mock external dependencies
jest.mock('axios'); // External service
// Test real business logic
```

## 📝 Commit Message Template for Test Changes

When committing test changes, use this format:

```
<type>: <short description>

- What tests were added/modified
- Coverage impact (before/after %)
- Any CI compatibility fixes
- Verification performed (verify-ci, flakiness check)

Verified:
- [x] npm run verify-ci passed
- [x] npm run test:flakiness passed (5/5)
- [x] Coverage: lib/utils.ts 94.7% -> 98.2%
```

## 🔗 Related Resources

- See `/README.md` for quick testing commands
- Run `npm run test:coverage` for current coverage stats
- Check `.github/workflows/ci.yml` for exact CI configuration

---

**Remember:** Good tests are your safety net. They should give you confidence to refactor, not just check boxes. When in doubt, err on the side of more thorough testing!
