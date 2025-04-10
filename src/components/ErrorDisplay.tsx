import React from 'react';
import { CompositeComponent } from '../types';

// Simple Error Display Component using CompositeComponent type from formik
const ErrorDisplay: CompositeComponent<{message: string}> = ({message}) => (
  <div className="error-message">{message}</div>
);

export default ErrorDisplay; 