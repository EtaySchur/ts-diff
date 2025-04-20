// ============================================================
// Example 1: ES6 Module Import Style
// ============================================================

// Standard ES6 imports - individual functions/components
import { 
  useQuery, 
  useMutation, 
  useQueryClient, 
  QueryClient, 
  QueryClientProvider 
} from 'react-query';

// Example component using ES6 imports
function QueryComponent() {
  // Create a query client instance
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        staleTime: 5 * 60 * 1000, // 5 minutes
      }
    }
  });
  
  // Example query hook with options
  function useTodos() {
    return useQuery(
      'todos', 
      () => fetch('/api/todos').then(res => res.json()),
      {
        onSuccess: (data) => {
          console.log('Todos fetched successfully', data);
        },
        onError: (error) => {
          console.error('Error fetching todos', error);
        }
      }
    );
  }
  
  // Example usage (would be inside a component)
  const { data, isLoading, error } = useTodos();
  
  // Example mutation
  const addTodoMutation = useMutation(
    (newTodo) => fetch('/api/todos', {
      method: 'POST',
      body: JSON.stringify(newTodo)
    }).then(res => res.json()),
    {
      onSuccess: () => {
        // Invalidate and refetch the todos query
        queryClient.invalidateQueries('todos');
      }
    }
  );
  
  // Add a new todo
  function handleAddTodo(todo) {
    addTodoMutation.mutate(todo);
  }
  
  // This would be the JSX render part
  /* 
  return (
    <QueryClientProvider client={queryClient}>
      <div>
        {isLoading ? (
          <div>Loading...</div>
        ) : error ? (
          <div>Error: {error.message}</div>
        ) : (
          <ul>
            {data.map(todo => (
              <li key={todo.id}>{todo.title}</li>
            ))}
          </ul>
        )}
        <button onClick={() => handleAddTodo({ title: 'New Todo' })}>
          Add Todo
        </button>
      </div>
    </QueryClientProvider>
  );
  */
}

// ============================================================
// Example 2: CommonJS Import Style
// ============================================================

// CommonJS require syntax (for Node.js environments or non-ESM projects)
const ReactQuery = require('react-query');

// Destructuring from the require
const { 
  QueryClient, 
  useMutation, 
  useQuery 
} = require('react-query');

// Example of using the CommonJS import
function createQueryClient() {
  // Create a query client with the common import
  return new ReactQuery.QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        cacheTime: 300000 // 5 minutes
      }
    }
  });
}

// Alternative with destructured imports
function fetchUsers() {
  // This is how you would use the destructured imports
  const queryClient = new QueryClient();
  
  // Example prefetching data (server-side)
  async function prefetchUsers() {
    await queryClient.prefetchQuery('users', 
      () => fetch('/api/users').then(res => res.json())
    );
  }
  
  return {
    queryClient,
    prefetchUsers
  };
}

// ============================================================
// Example 3: UMD / AMD Style
// ============================================================

// AMD (RequireJS) style
define(['react-query'], function(ReactQuery) {
  'use strict';
  
  // Create a reusable query client
  const queryClient = new ReactQuery.QueryClient();
  
  return {
    // Factory function to create query hooks
    createQueryHook: function(queryKey, queryFn, options = {}) {
      return function() {
        return ReactQuery.useQuery(queryKey, queryFn, options);
      };
    },
    
    // Simple wrapper around the query client
    invalidateQuery: function(queryKey) {
      return queryClient.invalidateQueries(queryKey);
    },
    
    // Access to the query client
    getQueryClient: function() {
      return queryClient;
    }
  };
});

// Alternative AMD syntax with named dependencies
require(['react-query', 'react'], function(ReactQuery, React) {
  // Combined usage with React
  const { QueryClient, QueryClientProvider } = ReactQuery;
  
  // Example creating a provider component
  function createQueryProvider(children) {
    const queryClient = new QueryClient();
    
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  }
  
  // Use the provider in an application
  console.log('Query provider created:', createQueryProvider);
});

// ============================================================
// Example 4: SystemJS Import Style
// ============================================================

// SystemJS dynamic import (for browser environments)
if (typeof SystemJS !== 'undefined') {
  // Import react-query using SystemJS
  SystemJS.import('react-query').then(function(ReactQuery) {
    // Create a query client
    const queryClient = new ReactQuery.QueryClient();
    
    // Register a custom module that uses react-query
    SystemJS.register('query-helpers', [], function(exports) {
      return {
        setters: [],
        execute: function() {
          exports({
            // Export a function to fetch data with react-query
            fetchWithCache: async function(url, queryKey) {
              // Check cache first
              const cachedData = queryClient.getQueryData(queryKey);
              if (cachedData) {
                return cachedData;
              }
              
              // Fetch and cache data
              const data = await fetch(url).then(res => res.json());
              queryClient.setQueryData(queryKey, data);
              return data;
            },
            
            // Utility to clear cached queries
            clearQueryCache: function() {
              queryClient.clear();
            }
          });
        }
      };
    });
    
    console.log('React Query helpers registered with SystemJS');
  }).catch(function(error) {
    console.error('Error loading React Query with SystemJS:', error);
  });
}

// ============================================================
// Example 5: Dynamic import (Modern ES Modules)
// ============================================================

// Modern dynamic import (works in modern browsers and Node.js with ESM support)
async function loadReactQueryDynamically() {
  try {
    // Dynamic import returns a promise
    const ReactQuery = await import('react-query');
    
    // Use the dynamically imported module
    const queryClient = new ReactQuery.QueryClient();
    
    // Example of using the dynamically loaded module
    queryClient.setDefaultOptions({
      queries: {
        refetchOnWindowFocus: false,
        staleTime: 10000,
      }
    });
    
    // Return the module and client for further use
    return {
      ReactQuery,
      queryClient
    };
  } catch (error) {
    console.error('Error dynamically importing React Query:', error);
    return null;
  }
}

// Export for CommonJS environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    createQueryClient,
    fetchUsers,
    loadReactQueryDynamically
  };
} 