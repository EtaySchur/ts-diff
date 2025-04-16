import React from 'react';
import { RouteComponentProps } from 'react-router-dom';
import FormikComplexForm from './FormikComplexForm';

// This is a wrapper component that takes RouteComponentProps from react-router
// and renders the FormikComplexForm component
const FormikComplexFormWrapper: React.FC<RouteComponentProps> = (props) => {
  // You can pass down router props or use them here as needed
  return <FormikComplexForm />;
};

export default FormikComplexFormWrapper; 