import React, { useState } from 'react';
import * as ReactRouter from 'react-router-dom';

interface RoutesExampleProps extends ReactRouter.RouteComponentProps {}

const RoutesExample: React.FC<RoutesExampleProps> = (props) => {
  const [count, setCount] = useState(0);
  const { match } = props;

  return (
    <div className="routes-example">
      <h2>Routes Example</h2>
      <p>This page demonstrates using multiple routes with namespace imports.</p>

      <div className="routes-container">
        <ReactRouter.Switch>
          <ReactRouter.Route 
            path={`${match.path}/dashboard`} 
            render={() => (
              <div className="dashboard-view">
                <h3>Dashboard</h3>
                <p>Welcome to your dashboard!</p>
                <button 
                  className="btn btn-info"
                  onClick={() => setCount(count + 1)}
                >
                  Click count: {count}
                </button>
              </div>
            )} 
          />
          <ReactRouter.Route 
            path={`${match.path}/profile`} 
            render={() => (
              <div className="profile-view">
                <h3>User Profile</h3>
                <p>This is your profile page.</p>
                <div className="profile-stats">
                  <p><strong>Username:</strong> demo_user</p>
                  <p><strong>Member since:</strong> Jan 2023</p>
                </div>
              </div>
            )} 
          />
          <ReactRouter.Route 
            path={`${match.path}/settings`} 
            render={() => (
              <div className="settings-view">
                <h3>Settings</h3>
                <p>Configure your application settings here.</p>
                <form className="settings-form">
                  <div className="form-group">
                    <label>
                      Dark Mode:
                      <input type="checkbox" className="ml-2" />
                    </label>
                  </div>
                  <div className="form-group">
                    <label>
                      Notifications:
                      <input type="checkbox" className="ml-2" defaultChecked />
                    </label>
                  </div>
                </form>
              </div>
            )} 
          />
          <ReactRouter.Route 
            exact
            path={match.path} 
            render={() => (
              <div className="welcome-view">
                <h3>Welcome to Routes Example</h3>
                <p>Please select a route from the navigation menu.</p>
              </div>
            )} 
          />
        </ReactRouter.Switch>
      </div>

      <div className="navigation-menu">
        <ul>
          <li>
            <ReactRouter.NavLink 
              to={`${match.path}/dashboard`}
              activeClassName="active-link"
            >
              Dashboard
            </ReactRouter.NavLink>
          </li>
          <li>
            <ReactRouter.NavLink 
              to={`${match.path}/profile`}
              activeClassName="active-link"
            >
              Profile
            </ReactRouter.NavLink>
          </li>
          <li>
            <ReactRouter.NavLink 
              to={`${match.path}/settings`}
              activeClassName="active-link"
            >
              Settings
            </ReactRouter.NavLink>
          </li>
        </ul>
      </div>

      <button 
        className="btn btn-primary mt-4"
        onClick={() => props.history.push('/')}
      >
        Back to Home
      </button>
    </div>
  );
};

export default RoutesExample; 