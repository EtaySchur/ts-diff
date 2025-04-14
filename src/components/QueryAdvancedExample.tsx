import React, { useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery, QueryKey } from 'react-query';
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
} from '../utils/queryUtils';

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
const getUserQueryKey = (userId: string | number): QueryKey => {
  return typeof userId === 'string' ? [userId] : [userId];
};

// Component that uses custom query utilities
const QueryAdvancedDemo: React.FC = () => {
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
          action = { type: 'success', data: updateUserName(user as User) };
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
      <h1>React Query Advanced Example</h1>
      <p>This example demonstrates the use of advanced React Query features</p>
      
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
          <h3>User Data</h3>
          <p><strong>ID:</strong> {user.id}</p>
          <p><strong>Name:</strong> {user.name}</p>
          <p><strong>Email:</strong> {user.email}</p>
        </div>
      )}
      
      <div style={{ marginBottom: '20px' }}>
        <h2>Action Dispatch</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => dispatchAction('fetch')} style={{ padding: '5px 10px' }}>
            Fetch Action
          </button>
          <button 
            onClick={() => dispatchAction('success')} 
            disabled={!user}
            style={{ padding: '5px 10px' }}
          >
            Success Action
          </button>
          <button onClick={() => dispatchAction('error')} style={{ padding: '5px 10px' }}>
            Error Action
          </button>
          <button onClick={() => dispatchAction('continue')} style={{ padding: '5px 10px' }}>
            Continue Action
          </button>
        </div>
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <h2>Dehydrated State</h2>
        {dehydratedState ? (
          <div style={{ 
            maxHeight: '200px', 
            overflow: 'auto', 
            background: '#f5f5f5', 
            padding: '10px',
            borderRadius: '4px' 
          }}>
            <pre>{JSON.stringify(dehydratedState, null, 2)}</pre>
          </div>
        ) : (
          <p>No dehydrated state available. Fetch a user first.</p>
        )}
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <h2>Utility Examples</h2>
        <div style={{ 
          background: '#f5f5f5', 
          padding: '10px',
          borderRadius: '4px',
          marginBottom: '10px'
        }}>
          <h3>Difference Utility</h3>
          <p>
            Difference between {JSON.stringify(tagList1)} and {JSON.stringify(tagList2)}:
          </p>
          <pre>{JSON.stringify(uniqueTags)}</pre>
        </div>
      </div>
    </div>
  );
};

// Wrap in QueryClientProvider
const QueryAdvancedExample: React.FC = () => (
  <QueryClientProvider client={queryClient}>
    <QueryAdvancedDemo />
  </QueryClientProvider>
);

export default QueryAdvancedExample; 