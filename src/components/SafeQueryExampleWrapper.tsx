import React from 'react';
import { RouteComponentProps } from 'react-router-dom';
import SafeQueryExample from './SafeQueryExample';

// This is a wrapper component that takes RouteComponentProps from react-router
// and renders the SafeQueryExample component
const SafeQueryExampleWrapper: React.FC<RouteComponentProps> = (props) => {
  // You can pass down router props or use them here as needed
  return <SafeQueryExample />;
};

export default SafeQueryExampleWrapper; 