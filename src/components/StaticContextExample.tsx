import React from 'react';
import { RouteComponentProps, Link } from 'react-router-dom';

// This example demonstrates the StaticContext type from React Router v4.3.1
// In v4.3.1, you could explicitly type the StaticContext in RouteComponentProps

// Re-implementing StaticContext which was exported in v4.3.1 but isn't in current types
interface StaticContext {
  statusCode?: number;
  url?: string;
}

// Extending StaticContext with custom properties - a feature in v4.3.1
interface CustomStaticContext extends StaticContext {
  statusCode?: number;
  customData?: string;
}

// Using the extended static context in route props - v4.3.1 pattern
interface StaticContextExampleProps extends RouteComponentProps<{}, CustomStaticContext> {}

const StaticContextExample: React.FC<StaticContextExampleProps> = (props) => {
  // In v4.3.1, you could check for staticContext (it's undefined in browser rendering)
  const hasStaticContext = !!props.staticContext;
  
  // Setting staticContext properties (only works in server-side rendering)
  if (props.staticContext) {
    props.staticContext.statusCode = 200;
    props.staticContext.customData = 'This would be used in server-side rendering';
  }
  
  return (
    <div className="static-context-example">
      <h2>StaticContext Example</h2>
      <p>This demonstrates the <code>staticContext</code> property from React Router v4.3.1.</p>
      
      <div className="info-box">
        <p><strong>Has staticContext:</strong> {hasStaticContext ? 'Yes' : 'No'}</p>
        <p>The <code>staticContext</code> property is only available during server-side rendering.</p>
        <p>In React Router v4.3.1, you could extend the <code>StaticContext</code> type and use it 
        to pass data between your routes and server rendering logic.</p>
      </div>
      
      <div className="example-code">
        <pre>
{`// In React Router v4.3.1, StaticContext was exported from the package
import { StaticContext } from 'react-router-dom';  // This export was removed later

interface CustomStaticContext extends StaticContext {
  statusCode?: number;
  customData?: string;
}

interface MyRouteProps extends RouteComponentProps<{}, CustomStaticContext> {}

// Then in your component:
if (props.staticContext) {
  props.staticContext.statusCode = 200; 
}`}
        </pre>
      </div>
      
      <p>This API pattern was changed in newer versions of React Router.</p>
      
      <button 
        className="btn btn-primary"
        onClick={() => props.history.push('/')}
      >
        Back to Home
      </button>
    </div>
  );
};

export default StaticContextExample; 