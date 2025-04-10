import React, { useState, useRef } from 'react';
import { useQuery, useQueryClient, QueryClient, QueryClientProvider } from 'react-query';
import { createSafeFetcher, updateQueryData, isNetworkError, SafeQueryKey } from '../utils/queryUtils';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false
    }
  }
});

// Example with safe fetcher (avoids CancelledError)
const SafeQueryExample: React.FC = () => {
  const [postId, setPostId] = useState<number>(1);
  const fetcherRef = useRef<{ cancel: () => void } | null>(null);
  const queryClient = useQueryClient();

  // Type for our data
  interface Post {
    id: number;
    title: string;
    body: string;
    userId: number;
  }

  // Define a safe query key (alternative to EnsuredQueryKey)
  const postQueryKey: SafeQueryKey<string> = ['post', postId.toString()];

  // Use our safe fetcher to avoid CancelledError
  const fetchPost = async (): Promise<Post> => {
    // Create a safe fetcher that can be cancelled
    const fetcher = createSafeFetcher(async () => {
      const response = await fetch(`https://jsonplaceholder.typicode.com/posts/${postId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch post');
      }
      return response.json();
    });
    
    // Store reference for potential cancellation
    fetcherRef.current = fetcher;
    
    return fetcher.execute();
  };

  // Query using our safe pattern
  const { data: post, isLoading, isError, error, refetch } = useQuery<Post, Error>(
    postQueryKey,
    fetchPost,
    {
      enabled: postId > 0,
      onError: (err) => {
        // Safe error type checking without CancelledError
        if (isNetworkError(err)) {
          console.log('Network error occurred');
        }
      }
    }
  );

  // Cancel current request when changing post ID
  const changePost = (newId: number) => {
    if (fetcherRef.current) {
      fetcherRef.current.cancel();
    }
    setPostId(newId);
  };

  // Safe data update (alternative to DataUpdateFunction)
  const markAsRead = () => {
    if (post) {
      updateQueryData<Post>(
        queryClient,
        postQueryKey,
        (oldData) => {
          if (!oldData) return { ...post, title: `[READ] ${post.title}` };
          return { ...oldData, title: `[READ] ${oldData.title}` };
        }
      );
    }
  };

  return (
    <div className="safe-query-example" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Safe React Query Example</h1>
      <p>This example demonstrates safe alternatives to deprecated React Query APIs</p>

      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="postId">Post ID: </label>
        <input
          id="postId"
          type="number"
          value={postId}
          onChange={(e) => changePost(parseInt(e.target.value, 10) || 1)}
          min="1"
          max="100"
          style={{ marginRight: '10px', padding: '5px' }}
        />
        <button onClick={() => refetch()} style={{ padding: '5px 10px', marginRight: '10px' }}>
          Refetch
        </button>
        <button onClick={markAsRead} disabled={!post} style={{ padding: '5px 10px' }}>
          Mark as Read
        </button>
      </div>

      {isLoading && <div>Loading post...</div>}
      
      {isError && (
        <div style={{ color: 'red', padding: '10px', border: '1px solid red', borderRadius: '4px' }}>
          Error: {error.message}
        </div>
      )}

      {post && !isLoading && (
        <div style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '4px' }}>
          <h2>{post.title}</h2>
          <p><strong>User ID:</strong> {post.userId}</p>
          <p>{post.body}</p>
        </div>
      )}
    </div>
  );
};

// Wrap with provider
const SafeQueryExampleWrapper: React.FC = () => (
  <QueryClientProvider client={queryClient}>
    <SafeQueryExample />
  </QueryClientProvider>
);

export default SafeQueryExampleWrapper; 