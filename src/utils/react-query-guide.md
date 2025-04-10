# React Query v3.39.3 Usage Guide

This guide outlines how to use React Query v3.39.3 while avoiding deprecated APIs.

## Avoided Deprecated APIs

The following APIs have been removed in newer versions and should be avoided:

- `Action<TData, TError>`
- `CancelledError`
- `CancelOptions`
- And other deprecated APIs from `react-query-versions.json`

## Safe Pattern Usage

### 1. Setting up React Query

```tsx
import { QueryClient, QueryClientProvider } from 'react-query';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
});

// Wrap your app with QueryClientProvider
const App = () => (
  <QueryClientProvider client={queryClient}>
    <YourApp />
  </QueryClientProvider>
);
```

### 2. Basic Query Example

```tsx
import { useQuery } from 'react-query';

// Correctly typed query
function MyComponent() {
  const { data, isLoading, isError, error } = useQuery<DataType, Error>(
    'queryKey',
    fetchFunction,
    {
      staleTime: 5000,
      cacheTime: 10000,
    }
  );
  
  // Use the data safely...
}
```

### 3. Mutations Example

Instead of using deprecated cancellation APIs, use mutations with proper typing:

```tsx
import { useMutation, useQueryClient } from 'react-query';

function AddItemForm() {
  const queryClient = useQueryClient();
  
  const mutation = useMutation(
    (newItem) => addItemToApi(newItem),
    {
      onSuccess: () => {
        // Invalidate and refetch relevant queries
        queryClient.invalidateQueries('items');
      }
    }
  );
  
  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      mutation.mutate(newItemData);
    }}>
      {/* Form content */}
    </form>
  );
}
```

### 4. Error Handling

Instead of using `CancelledError`, handle errors with proper typing:

```tsx
const { isError, error } = useQuery<DataType, Error>('key', fetcher);

if (isError) {
  return <div>Error: {error.message}</div>;
}
```

## Benefits of React Query

- Automatic refetching and cache management
- Easy loading and error states
- Built-in devtools
- Optimistic updates with mutations
- Automatic garbage collection of unused queries

## Migration Tips

When migrating from earlier versions of React Query, ensure you:

1. Replace any usage of deprecated APIs with modern patterns
2. Specify proper types for query and mutation results
3. Use the QueryClient for managing query cache instead of direct manipulation
4. Implement proper error handling without relying on specific error classes that have been removed 