# Claude Code Guidelines

This directory contains guidelines and configurations specifically for AI assistants (like Claude Code) working on this project.

## Files in This Directory

### `testing-guidelines.md` (MANDATORY READING)

**AI assistants MUST follow these guidelines when:**
- Writing or modifying tests
- Making changes that affect test behavior
- Verifying CI compatibility

**Key requirements:**
- Always run `npm run verify-ci` before committing test changes
- Check for flakiness with `npm run test:flakiness`
- Maintain > 80% code coverage for business logic
- Ensure tests are deterministic (no random failures)

### `pre-commit.sample`

Optional git hook that runs tests before allowing commits.

**To install:**
```bash
cp .claude/pre-commit.sample .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

## Quick Reference for AI Assistants

### Before Every Test-Related Commit

```bash
# 1. Verify CI compatibility (MANDATORY)
npm run verify-ci

# 2. Check for flakiness
npm run test:flakiness

# 3. Check coverage
npm run test:coverage
```

### Test Writing Checklist

- [ ] Tests are fast (< 100ms each)
- [ ] Tests are isolated (no shared state)
- [ ] Tests are deterministic (consistent results)
- [ ] No hardcoded dates/times
- [ ] No random values that could cause flakiness
- [ ] All dependencies in package.json
- [ ] Coverage > 80% for new code

### Common Pitfalls

1. **Missing dependencies** - Always add test tools to `devDependencies`
2. **Flaky tests** - Avoid random values, dates, or timing dependencies
3. **Environment differences** - Don't assume local paths or global packages

## Integration with Development Workflow

These guidelines are referenced in:
- `/README.md` - Quick testing commands
- `.github/workflows/ci.yml` - CI configuration
- `package.json` - Test scripts and dependencies

---

**For human developers:** These guidelines apply to you too! Following them will help maintain a robust, reliable test suite.
