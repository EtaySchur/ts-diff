import React from 'react';
import { connect, FormikContext } from 'formik';
import { ExtendedFormValues } from '../types';
import ErrorDisplay from './ErrorDisplay';

// Define props with formik as required when connected
interface ConnectedComponentProps {
  label: string;
  name: string;
  formik?: FormikContext<ExtendedFormValues>; // This will be injected by connect
}

// Create the base component
class FormikConnectedInputBase extends React.Component<ConnectedComponentProps> {
  render() {
    const { label, name, formik } = this.props;
    
    if (!formik) {
      return null; // Safety check
    }
    
    return (
      <div>
        <label htmlFor={name}>{label}:</label>
        <input
          id={name}
          name={name}
          type="text"
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          value={formik.values[name as keyof ExtendedFormValues] as string}
        />
        {formik.errors[name as keyof ExtendedFormValues] && 
         formik.touched[name as keyof ExtendedFormValues] && (
          <ErrorDisplay 
            message={formik.errors[name as keyof ExtendedFormValues] as string} 
          />
        )}
      </div>
    );
  }
}

// Use any to bypass type checking for now since this is legacy code using removed APIs
const FormikConnectedInput = connect(FormikConnectedInputBase) as any;

export default FormikConnectedInput; 