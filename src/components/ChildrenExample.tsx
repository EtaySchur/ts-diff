import React from 'react';
import { RouteComponentProps, Route, Link } from 'react-router-dom';

// This example demonstrates the children function pattern from React Router v4.3.1
interface ChildrenExampleProps extends RouteComponentProps {}

const ChildrenExample: React.FC<ChildrenExampleProps> = (props) => {
  return (
    <div className="children-example">
      <h2>Children Function Pattern Example</h2>
      <p>This demonstrates the <code>children</code> function pattern from React Router v4.3.1 that was changed in later versions.</p>
      
      <div className="example-content">
        {/* Using the children function pattern that was available in v4.3.1 */}
        <Route
          path={`${props.match.path}/active`}
          children={({ match, location }) => (
            <div>
              {/* This will render regardless of whether the route matches */}
              <div className={match ? 'active-route' : 'inactive-route'}>
                <p>This component always renders, but changes its style when the route matches.</p>
                <p>Route match status: <strong>{match ? 'Active' : 'Inactive'}</strong></p>
                <p>Current location: <code>{location.pathname}</code></p>
              </div>
            </div>
          )}
        />
      </div>
      
      <div className="example-links">
        <Link to={`${props.match.path}/active`}>
          Activate Route
        </Link>
        {' | '}
        <Link to={props.match.path}>
          Deactivate Route
        </Link>
      </div>
      
      <div className="info-box">
        <p>In React Router v4.3.1, routes could have a <code>children</code> function that always rendered, 
        regardless of whether the route matched. This was useful for conditional styling based on route match status.</p>
        <p>This pattern was changed in later versions in favor of using hooks like <code>useMatch</code>.</p>
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

export default ChildrenExample; 