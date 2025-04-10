import React from 'react';
import { connect, FormikContext } from 'formik';
import { ExtendedFormValues } from '../types';
import ErrorDisplay from './ErrorDisplay';

// Define the base component props
interface BaseComponentProps {
  label: string;
  name: string;
}

// Define props with formik when connected
interface ConnectedComponentProps extends BaseComponentProps {
  formik: FormikContext<ExtendedFormValues>; // This will be injected by connect
}

// Create the base component
class FormikConnectedInputBase extends React.Component<ConnectedComponentProps> {
  render() {
    const { label, name, formik } = this.props;
    
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

// Connect the component with formik
const FormikConnectedInput = connect<BaseComponentProps, ExtendedFormValues>(FormikConnectedInputBase);

export default FormikConnectedInput; 