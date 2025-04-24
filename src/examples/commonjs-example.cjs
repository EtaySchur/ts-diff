// CommonJS (.cjs) example of react-query usage

// CommonJS require syntax
const ReactQuery = require('react-query');

// Destructuring require
const { 
  QueryClient, 
  useQuery, 
  useMutation 
} = require('react-query');

// Example function using CommonJS imports
function createQueryClient() {
  // Create a query client instance
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        staleTime: 5 * 60 * 1000, // 5 minutes
      }
    }
  });
  
  return queryClient;
}

// Example using direct ReactQuery namespace
function fetchTodosWithNamespace() {
  return ReactQuery.useQuery(
    'todos', 
    async () => {
      const response = await fetch('https://jsonplaceholder.typicode.com/todos');
      if (!response.ok) throw new Error('Network error');
      return response.json();
    }
  );
}

// Example using destructured imports
function fetchTodos() {
  return useQuery(
    'todos', 
    async () => {
      const response = await fetch('https://jsonplaceholder.typicode.com/todos');
      if (!response.ok) throw new Error('Network error');
      return response.json();
    }
  );
}

// Another Common JS pattern: direct property access from require
const createMutation = require('react-query').useMutation;

// Export using CommonJS module.exports
module.exports = {
  createQueryClient,
  fetchTodos,
  fetchTodosWithNamespace,
  ReactQuery
}; 