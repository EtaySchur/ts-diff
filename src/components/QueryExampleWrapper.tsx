import React from 'react';
import { RouteComponentProps } from 'react-router-dom';
import QueryExample from './QueryExample';

// This is a wrapper component that takes RouteComponentProps from react-router
// and renders the QueryExample component
const QueryExampleWrapper: React.FC<RouteComponentProps> = (props) => {
  // You can pass down router props or use them here as needed
  return <QueryExample />;
};

export default QueryExampleWrapper; 