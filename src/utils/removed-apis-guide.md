# Using Removed React Query APIs

This guide explains how to use the removed APIs from React Query v3.39.3 in your project. These APIs have been reimplemented in our codebase for compatibility purposes.

## Available Removed APIs

We've reimplemented the following removed APIs from React Query:

- `Action<TData, TError>` - Type for query actions
- `CancelledError` - Error class for cancelled queries
- `CancelOptions` - Options for cancelling queries
- `EnsuredQueryKey` - Type for ensuring proper query key format
- `DataUpdateFunction` - Function type for updating query data
- `DehydratedState` - Interface for serialized query cache
- `dehydrate` - Function to serialize query cache
- `difference` - Utility function for array difference

## How to Use

### 1. Action Type

The `Action` type represents different actions that can be performed with React Query:

```tsx
import { Action } from '../utils/removedQueryApis';

// Example usage:
const fetchAction: Action<User, Error> = { type: 'fetch' };
const successAction: Action<User, Error> = { 
  type: 'success', 
  data: userData 
};
const errorAction: Action<User, Error> = { 
  type: 'error', 
  error: new Error('Failed to fetch') 
};
```

### 2. CancelledError

Use `CancelledError` to represent cancelled queries:

```tsx
import { CancelledError } from '../utils/removedQueryApis';

// In a fetcher function:
try {
  // Fetch data...
} catch (error) {
  if (error instanceof DOMException && error.name === 'AbortError') {
    throw new CancelledError('Query was cancelled');
  }
  throw error;
}
```

### 3. CancelOptions

Use `CancelOptions` when cancelling queries:

```tsx
import { CancelOptions } from '../utils/removedQueryApis';

const cancelOptions: CancelOptions = {
  revert: true,  // Revert to previous data
  silent: false  // Emit events
};
```

### 4. EnsuredQueryKey

Use `EnsuredQueryKey` to ensure proper formatting of query keys:

```tsx
import { EnsuredQueryKey } from '../utils/removedQueryApis';

function getQueryKey<T>(key: T): EnsuredQueryKey<T> {
  return typeof key === 'string' ? [key] : key as Exclude<T, string>;
}

// Usage:
const userId = '123';
const queryKey = getQueryKey(userId);  // Returns ['123']
```

### 5. DataUpdateFunction

Use `DataUpdateFunction` for consistent data updates:

```tsx
import { DataUpdateFunction } from '../utils/removedQueryApis';

const updateUser: DataUpdateFunction<User, User> = (user) => {
  return {
    ...user,
    lastUpdated: new Date()
  };
};
```

### 6. DehydratedState and dehydrate

Use `dehydrate` to serialize the query cache:

```tsx
import { dehydrate, DehydrateOptions } from '../utils/removedQueryApis';

// In a component:
const options: DehydrateOptions = {
  shouldDehydrateQuery: (query) => query.queryHash.includes('user')
};

const state = dehydrate(queryClient, options);
```

### 7. difference utility

Use the `difference` utility for array operations:

```tsx
import { difference } from '../utils/removedQueryApis';

const array1 = ['a', 'b', 'c'];
const array2 = ['a', 'd'];
const result = difference(array1, array2);  // ['b', 'c']
```

## Working Example

See the `RemovedApisExample.tsx` component for a complete working example that demonstrates all these removed APIs in action.

## Important Notes

1. These APIs were removed in newer versions of React Query for various reasons, including:
   - They were considered internal implementation details
   - Better alternatives were created
   - They added complexity to the API surface

2. While we've reimplemented them for compatibility, be aware that:
   - Future versions of React Query might make these reimplementations incompatible
   - Using removed APIs might make it harder to upgrade in the future
   - You should have a migration plan for eventually replacing these with supported APIs 