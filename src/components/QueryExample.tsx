import React, { useState } from 'react';
import { useQuery, useMutation, QueryClient, QueryClientProvider } from 'react-query';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
});

// Types
interface Todo {
  id: number;
  title: string;
  completed: boolean;
}

// Example fetcher function
const fetchTodos = async (): Promise<Todo[]> => {
  const response = await fetch('https://jsonplaceholder.typicode.com/todos?_limit=5');
  if (!response.ok) {
    throw new Error('Network response was not ok');
  }
  return response.json();
};

// Example mutation function
const addTodo = async (newTodo: Omit<Todo, 'id'>): Promise<Todo> => {
  const response = await fetch('https://jsonplaceholder.typicode.com/todos', {
    method: 'POST',
    body: JSON.stringify(newTodo),
    headers: {
      'Content-type': 'application/json; charset=UTF-8',
    },
  });
  
  if (!response.ok) {
    throw new Error('Failed to add todo');
  }
  
  return response.json();
};

// Todo list component with mutations
const TodoList: React.FC = () => {
  const [newTodoTitle, setNewTodoTitle] = useState('');
  
  // Query hook
  const { data: todos, isLoading, isError, error, refetch } = useQuery<Todo[], Error>(
    'todos', 
    fetchTodos
  );

  // Mutation hook
  const addTodoMutation = useMutation(
    (newTodo: Omit<Todo, 'id'>) => addTodo(newTodo),
    {
      onSuccess: () => {
        // Invalidate the todos query to refetch the updated list
        queryClient.invalidateQueries('todos');
        setNewTodoTitle('');
      }
    }
  );

  const handleAddTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoTitle.trim()) return;
    
    addTodoMutation.mutate({
      title: newTodoTitle,
      completed: false
    });
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (isError) {
    return <div>Error: {error.message}</div>;
  }

  return (
    <div>
      <h2>Todo List</h2>
      
      <form onSubmit={handleAddTodo} style={{ marginBottom: '20px' }}>
        <input
          type="text"
          value={newTodoTitle}
          onChange={(e) => setNewTodoTitle(e.target.value)}
          placeholder="Add a new todo"
          style={{ marginRight: '10px', padding: '5px' }}
        />
        <button 
          type="submit" 
          disabled={addTodoMutation.isLoading}
          style={{ padding: '5px 10px' }}
        >
          {addTodoMutation.isLoading ? 'Adding...' : 'Add Todo'}
        </button>
      </form>
      
      {addTodoMutation.isError && (
        <div style={{ color: 'red', marginBottom: '10px' }}>
          Error: {(addTodoMutation.error as Error).message}
        </div>
      )}
      
      <button onClick={() => refetch()} style={{ marginBottom: '10px', padding: '5px 10px' }}>
        Refresh List
      </button>
      
      <ul style={{ listStyleType: 'none', padding: 0 }}>
        {todos?.map((todo) => (
          <li key={todo.id} style={{ margin: '8px 0', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}>
            <input type="checkbox" checked={todo.completed} readOnly />
            <span style={{ marginLeft: '10px' }}>{todo.title}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

// Wrap everything in QueryClientProvider
const QueryExample: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="container" style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
        <h1>React Query Example</h1>
        <p>Using version 3.39.3 without deprecated APIs</p>
        <TodoList />
      </div>
    </QueryClientProvider>
  );
};

export default QueryExample; 