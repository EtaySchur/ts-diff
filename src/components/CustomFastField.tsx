import React from 'react';
import { FastField, FastFieldConfig } from 'formik';

// Using FastField with FastFieldConfig from formik
// Extend FastFieldConfig with our additional HTML props
interface CustomFastFieldProps extends FastFieldConfig<any> {
  type?: string;
  placeholder?: string;
  className?: string;
}

// Now we can properly use FastFieldConfig with our extended props
const CustomFastField = (props: CustomFastFieldProps) => {
  // Explicitly using FastFieldConfig for shouldUpdate (a feature of FastFieldConfig)
  const { name, validate, ...inputProps } = props;
  const fastFieldProps: FastFieldConfig<any> = {
    name,
    validate,
    shouldUpdate: (nextProps: any, currentProps: any) => {
      // Custom implementation of shouldUpdate - only update if the name changes
      return nextProps.name !== currentProps.name;
    }
  };
  
  // Return FastField with both the original props and the FastFieldConfig props
  return <FastField {...inputProps} {...fastFieldProps} />;
};

export default CustomFastField; 