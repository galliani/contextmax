# Test Suite Documentation

This directory contains comprehensive unit tests for the PromptSong application, covering both composables and Vue components following Nuxt's testing best practices.

## Test Structure

```
tests/
├── composables/          # Tests for Vue composables
│   ├── useProjectStore.nuxt.test.ts
│   ├── useNotifications.nuxt.test.ts
│   ├── useKeyboardShortcuts.nuxt.test.ts
│   ├── useAutoSave.nuxt.test.ts
│   └── useLoadingStates.nuxt.test.ts
├── components/           # Tests for Vue components
│   ├── FileContentModal.nuxt.test.ts
│   └── ProjectFileBrowser.nuxt.test.ts
├── setup.ts             # Global test setup and mocks
└── README.md            # This file
```

## Testing Framework

- **Vitest**: Main testing framework with Nuxt environment support
- **@nuxt/test-utils**: Provides `mountSuspended` for component testing
- **@vue/test-utils**: Vue component testing utilities
- **happy-dom**: DOM environment for testing

## Test Naming Convention

All test files use the `.nuxt.test.ts` extension to ensure they run in the Nuxt environment with proper auto-imports and context.

## Composables Testing

The composables tests cover:

### useProjectStore
- View management (landing/workspace)
- File ID generation and management
- Context set CRUD operations
- File management within context sets
- Local storage persistence
- OPFS (Origin Private File System) support
- File content modal state
- Project data serialization/deserialization

### useNotifications
- Basic notification management (add, remove, clear)
- Convenience methods (success, error, warning, info)
- Auto-dismiss functionality with timers
- Notification actions and callbacks
- Multiple notifications handling

### useKeyboardShortcuts
- Shortcut registration and unregistration
- Keyboard event handling with modifiers
- Platform detection (macOS vs Windows/Linux)
- Context-sensitive shortcuts (ignore in input fields)
- Key combination formatting for display
- Enable/disable state management

### useAutoSave
- Auto-save configuration and state management
- Timer-based save triggering
- Manual save operations
- Change tracking and state persistence
- Error handling in save operations
- Configuration updates and cleanup

### useLoadingStates
- Loading state management for multiple operations
- Async operation wrapping with loading states
- Batch operations (clear all, set multiple)
- Reactive updates and computed properties
- Edge cases and performance testing

## Component Testing

Component tests use `mountSuspended` from `@nuxt/test-utils` to properly test Vue components in a Nuxt environment.

### Testing Approach
- **Mocking**: External dependencies (composables, APIs) are mocked using Vitest
- **User Interaction**: Tests simulate clicks, input changes, and other user interactions
- **Reactive Updates**: Tests verify components react correctly to prop and state changes
- **Visual Elements**: Tests check for proper rendering of text, icons, and layout

### FileContentModal Tests
- Modal visibility based on store state
- File name and content display
- Line numbers and code formatting
- Modal actions (close functionality)
- Empty state handling
- Edge cases (long content, special characters)

## Running Tests

```bash
# Run all tests
yarn test

# Run tests in watch mode
yarn test:watch

# Run with coverage
yarn test:coverage

# Run specific test file
yarn test tests/composables/useProjectStore.nuxt.test.ts

# Run composables tests only
yarn test tests/composables

# Run component tests only
yarn test tests/components
```

## Test Configuration

The test configuration is defined in `vitest.config.ts`:

- **Environment**: Nuxt environment for proper auto-imports
- **Setup**: Global setup file for mocks and utilities
- **Coverage**: Text, JSON, and HTML reporters
- **Mocks**: IntersectionObserver and IndexedDB mocking

## Global Setup

The `tests/setup.ts` file provides:
- Browser API mocks (matchMedia, localStorage, clipboard)
- ResizeObserver mock
- Other global mocks for testing environment

## Best Practices

1. **Test Isolation**: Each test is independent and doesn't rely on other tests
2. **Descriptive Names**: Test descriptions clearly explain what is being tested
3. **Arrange-Act-Assert**: Tests follow the AAA pattern
4. **Edge Cases**: Tests cover both happy paths and edge cases
5. **Mocking**: External dependencies are properly mocked
6. **Cleanup**: Tests clean up after themselves to prevent side effects

## Mocking Strategy

- **Composables**: Mocked when testing components to isolate component logic
- **Browser APIs**: Mocked for consistent testing environment
- **Async Operations**: Use `vi.fn()` with resolved/rejected promises
- **Timers**: Use `vi.useFakeTimers()` for time-dependent tests

## Coverage Goals

The test suite aims for high coverage of:
- All public methods and computed properties
- Error handling and edge cases
- User interaction flows
- State management and persistence
- Reactive behavior and watchers

## Continuous Integration

Tests are designed to run reliably in CI environments:
- No real file system dependencies
- Deterministic timing (fake timers)
- Proper cleanup to prevent test pollution
- Cross-platform compatibility 