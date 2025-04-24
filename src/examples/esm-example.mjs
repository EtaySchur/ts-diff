// ES Modules (.mjs) example of react-query usage
import { useQuery, useMutation, QueryClient } from 'react-query';

// Example of explicit MJS ES Module usage
// In real apps, this would be used in a React component
export function fetchTodos() {
  // Sample usage of useQuery hook
  const { data, isLoading, error } = useQuery('todos', async () => {
    const response = await fetch('https://jsonplaceholder.typicode.com/todos');
    if (!response.ok) throw new Error('Network error');
    return response.json();
  });
  
  return { data, isLoading, error };
}

// Example mutation function
export function addTodo(newTodo) {
  const queryClient = new QueryClient();
  
  // Sample usage of useMutation hook
  const mutation = useMutation(
    async (todoData) => {
      const response = await fetch('https://jsonplaceholder.typicode.com/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(todoData)
      });
      
      if (!response.ok) throw new Error('Failed to add todo');
      return response.json();
    },
    {
      onSuccess: () => {
        // Invalidate and refetch the todos query
        queryClient.invalidateQueries('todos');
      }
    }
  );
  
  // Execute the mutation
  mutation.mutate(newTodo);
  
  return mutation;
}

// This ES Module can be imported by other .mjs files or by .js files
// when "type": "module" is set in package.json 