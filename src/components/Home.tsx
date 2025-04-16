import React from 'react';
import { Link, RouteComponentProps } from 'react-router-dom';

// Using RouteComponentProps from react-router-dom v4.3.1
const Home: React.FC<RouteComponentProps> = (props) => {
  // Accessing router props provided by react-router-dom v4.3.1
  const { history, location, match } = props;
  
  return (
    <div className="home-container">
      <h1>React Router DOM v4.3.1 Example</h1>
      
      <div className="router-features">
        <h2>Router Features Demonstrated:</h2>
        <ul>
          <li>
            <strong>Basic Routing:</strong> Using Switch and Route components
          </li>
          <li>
            <strong>Navigation:</strong> Using Link component
          </li>
          <li>
            <strong>Route Props:</strong> Accessing history, location, and match objects
          </li>
          <li>
            <strong>URL Parameters:</strong> Try <Link to="/params/hello">URL Parameters Example</Link>
          </li>
        </ul>
      </div>
      
      <div className="router-info">
        <h3>Current Router State:</h3>
        <div className="info-box">
          <p><strong>Location Pathname:</strong> {location.pathname}</p>
          <p><strong>Location Search:</strong> {location.search}</p>
          <p><strong>Match URL:</strong> {match.url}</p>
          <p><strong>Match Path:</strong> {match.path}</p>
        </div>
        
        <button 
          className="btn btn-primary"
          onClick={() => history.push('/formik')}
        >
          Programmatically Navigate to Formik Example
        </button>
      </div>
    </div>
  );
};

export default Home; 