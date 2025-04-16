import React from 'react';
import { RouteComponentProps, Link } from 'react-router-dom';

// Define the URL parameters interface
interface ParamTypes {
  name: string;
}

// This extends RouteComponentProps with our param types - a feature of React Router DOM v4.3.1
interface ParamExampleProps extends RouteComponentProps<ParamTypes> {}

const ParameterExample: React.FC<ParamExampleProps> = (props) => {
  // Extract the name parameter from the URL
  const { name } = props.match.params;
  
  return (
    <div className="parameter-example">
      <h2>URL Parameter Example</h2>
      <div className="info-box">
        <p><strong>Parameter from URL:</strong> {name}</p>
        <p>This demonstrates how to extract parameters from URLs using React Router DOM v4.3.1</p>
      </div>
      
      <h3>Try other parameters:</h3>
      <ul>
        <li><Link to="/params/world">Try "world" parameter</Link></li>
        <li><Link to="/params/react-router">Try "react-router" parameter</Link></li>
        <li><Link to="/params/v4.3.1">Try "v4.3.1" parameter</Link></li>
      </ul>
      
      <button 
        className="btn btn-primary"
        onClick={() => props.history.goBack()}
      >
        Go Back
      </button>
    </div>
  );
};

export default ParameterExample; 