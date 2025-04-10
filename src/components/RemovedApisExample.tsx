import React, { useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from 'react-query';
import { 
  Action, 
  CancelledError, 
  CancelOptions, 
  EnsuredQueryKey, 
  DataUpdateFunction,
  dehydrate,
  DehydrateOptions,
  DehydratedState,
  difference
} from '../utils/removedQueryApis';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false
    }
  }
});

interface User {
  id: number;
  name: string;
  email: string;
}

// Using DataUpdateFunction
const updateUserName: DataUpdateFunction<User, User> = (user) => {
  return {
    ...user,
    name: `${user.name} (Updated)`
  };
};

// Example using EnsuredQueryKey
const getUserQueryKey = (userId: string | number): EnsuredQueryKey<typeof userId> => {
  return typeof userId === 'string' ? [userId] : userId;
};

// Component that uses removed APIs
const RemovedApisDemo: React.FC = () => {
  const [userId, setUserId] = useState(1);
  const [dehydratedState, setDehydratedState] = useState<DehydratedState | null>(null);
  const fetchControllerRef = useRef<AbortController | null>(null);

  // Function that uses CancelledError
  const fetchUserWithCancel = async (): Promise<User> => {
    // Create a new AbortController for each request
    fetchControllerRef.current = new AbortController();
    const signal = fetchControllerRef.current.signal;

    try {
      const response = await fetch(`https://jsonplaceholder.typicode.com/users/${userId}`, {
        signal
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch user: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      // Check if this is an AbortError and convert to our CancelledError
      if (error instanceof Error && error.name === 'AbortError') {
        throw new CancelledError('User fetch was cancelled');
      }
      throw error;
    }
  };

  // Using our EnsuredQueryKey
  const queryKey = getUserQueryKey(`user-${userId}`);
  
  const { 
    data: user, 
    isLoading, 
    isError, 
    error, 
    refetch 
  } = useQuery<User, Error>(
    queryKey,
    fetchUserWithCancel,
    {
      onError: (err) => {
        // Special handling for our CancelledError
        if (err instanceof CancelledError) {
          console.log('Query was cancelled:', err.message);
        }
      }
    }
  );

  // Demonstrate using dehydrate function to serialize query cache
  useEffect(() => {
    if (user) {
      const options: DehydrateOptions = {
        shouldDehydrateQuery: (query) => query.queryHash.includes('user')
      };
      
      const state = dehydrate(queryClient, options);
      setDehydratedState(state);
    }
  }, [user]);

  // Cancel the request with CancelOptions
  const cancelRequest = () => {
    if (fetchControllerRef.current) {
      fetchControllerRef.current.abort();
      
      // Example CancelOptions usage
      const cancelOptions: CancelOptions = {
        revert: true,
        silent: false
      };
      
      console.log('Cancelled with options:', cancelOptions);
    }
  };

  // Example showing dispatch of Action types
  const dispatchAction = (actionType: string) => {
    let action: Action<User, Error> | null = null;
    
    switch(actionType) {
      case 'fetch':
        action = { type: 'fetch' };
        refetch();
        break;
      case 'success':
        if (user) {
          action = { type: 'success', data: updateUserName(user) };
        }
        break;
      case 'error':
        action = { 
          type: 'error', 
          error: new Error('Manual error triggered') 
        };
        break;
      case 'continue':
        action = { type: 'continue' };
        break;
      default:
        return;
    }
    
    if (action) {
      console.log('Dispatched action:', action);
    }
  };

  // Example using difference utility
  const tagList1 = ['user', 'profile', 'settings'];
  const tagList2 = ['user', 'dashboard'];
  const uniqueTags = difference(tagList1, tagList2);

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>React Query Removed APIs Example</h1>
      <p>This example demonstrates the use of removed APIs from React Query</p>
      
      <div style={{ marginBottom: '20px' }}>
        <h2>User Fetching</h2>
        <input
          type="number"
          value={userId}
          onChange={(e) => setUserId(parseInt(e.target.value, 10) || 1)}
          min="1"
          max="10"
          style={{ marginRight: '10px', padding: '5px' }}
        />
        <button 
          onClick={() => refetch()} 
          style={{ padding: '5px 10px', marginRight: '10px' }}
        >
          Fetch User
        </button>
        <button 
          onClick={cancelRequest} 
          style={{ padding: '5px 10px' }}
        >
          Cancel Request
        </button>
      </div>
      
      {isLoading && <div>Loading user...</div>}
      
      {isError && (
        <div style={{ color: 'red', padding: '10px', border: '1px solid red', borderRadius: '4px' }}>
          Error: {error instanceof CancelledError 
            ? `Request cancelled: ${error.message}` 
            : error.message}
        </div>
      )}
      
      {user && !isLoading && (
        <div style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '4px', marginBottom: '20px' }}>
          <h3>{user.name}</h3>
          <p>Email: {user.email}</p>
          <p>ID: {user.id}</p>
        </div>
      )}
      
      <div style={{ marginBottom: '20px' }}>
        <h2>Action Dispatcher</h2>
        <div>
          <button onClick={() => dispatchAction('fetch')} style={{ margin: '5px', padding: '5px 10px' }}>
            Dispatch Fetch
          </button>
          <button onClick={() => dispatchAction('success')} style={{ margin: '5px', padding: '5px 10px' }}>
            Dispatch Success
          </button>
          <button onClick={() => dispatchAction('error')} style={{ margin: '5px', padding: '5px 10px' }}>
            Dispatch Error
          </button>
          <button onClick={() => dispatchAction('continue')} style={{ margin: '5px', padding: '5px 10px' }}>
            Dispatch Continue
          </button>
        </div>
      </div>
      
      <div>
        <h2>Utility Examples</h2>
        <div>
          <p><strong>EnsuredQueryKey Example:</strong> {JSON.stringify(queryKey)}</p>
          <p><strong>Difference Utility:</strong> Unique tags = {JSON.stringify(uniqueTags)}</p>
        </div>
      </div>
      
      {dehydratedState && (
        <div style={{ marginTop: '20px' }}>
          <h2>Dehydrated Query State</h2>
          <pre style={{ background: '#f5f5f5', padding: '10px', borderRadius: '4px', overflow: 'auto', maxHeight: '200px' }}>
            {JSON.stringify(dehydratedState, null, 2)}
          </pre>
        </div>
      )}

      <div style={{ marginTop: '30px', padding: '15px', background: '#f8f9fa', borderRadius: '4px' }}>
        <h2>Documentation</h2>
        <p>
          For detailed information on using these removed APIs, see the 
          <a 
            href="#"
            onClick={(e) => {
              e.preventDefault();
              window.open('/src/utils/removed-apis-guide.md', '_blank');
            }}
            style={{ margin: '0 5px', color: '#0066cc' }}
          >
            Removed APIs Guide
          </a>
          which contains examples and best practices.
        </p>
      </div>
    </div>
  );
};

// Wrap with provider
const RemovedApisExample: React.FC = () => (
  <QueryClientProvider client={queryClient}>
    <RemovedApisDemo />
  </QueryClientProvider>
);

export default RemovedApisExample; 