import React from 'react';
import { RouteComponentProps, Route, Link } from 'react-router-dom';

// This example demonstrates the action property from React Router v4.3.1
// which was later removed in newer versions
interface ActionExampleProps extends RouteComponentProps {}

// Define the location type to avoid 'any' error
interface LocationObject {
  location: {
    pathname: string;
    search: string;
    hash: string;
    state: any;
  };
}

const ActionExample: React.FC<ActionExampleProps> = (props) => {
  return (
    <div className="action-example">
      <h2>Action Property Example</h2>
      <p>This demonstrates the <code>action</code> property from React Router v4.3.1 that was later removed.</p>
      
      {/* 
        Using the action property that was removed in later versions.
        We use 'as any' to suppress TypeScript errors since this API is not in the current types,
        but it did exist in React Router DOM v4.3.1
      */}
      <Route
        path={`${props.match.path}/submit`}
        {...{
          // Using spread to add the 'action' property, which TypeScript doesn't know about
          // This is just to demonstrate a removed API
          action: ({ location }: LocationObject) => {
            console.log('Action triggered with location:', location);
            alert('Action handler triggered! Check console for details.');
            return null;
          }
        } as any}
        render={() => <div>Action route rendered!</div>}
      />
      
      <div className="example-links">
        <Link to={`${props.match.path}/submit`}>
          Go to action route
        </Link>
      </div>
      
      <div className="info-box">
        <p>In React Router v4.3.1, routes could have an <code>action</code> property which would be 
        called when the route matched. This was typically used with form submissions or other user interactions.</p>
        <p>This API was removed in later versions in favor of using hooks and more React-like patterns.</p>
      </div>
      
      <button 
        className="btn btn-primary"
        onClick={() => props.history.push('/')}
      >
        Back to Home
      </button>
    </div>
  );
};

export default ActionExample; 