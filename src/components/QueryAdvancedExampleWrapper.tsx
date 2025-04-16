import React from 'react';
import { RouteComponentProps } from 'react-router-dom';
import QueryAdvancedExample from './QueryAdvancedExample';

// This is a wrapper component that takes RouteComponentProps from react-router
// and renders the QueryAdvancedExample component
const QueryAdvancedExampleWrapper: React.FC<RouteComponentProps> = (props) => {
  // You can pass down router props or use them here as needed
  return <QueryAdvancedExample />;
};

export default QueryAdvancedExampleWrapper; 