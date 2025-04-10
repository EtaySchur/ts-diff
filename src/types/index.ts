import React from 'react';

// Define CompositeComponent type that was removed according to formik-versions.json
export type CompositeComponent<P> = React.ComponentClass<P> | React.StatelessComponent<P>;

// Define type for our extended form values
export interface ExtendedFormValues {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  rememberMe: boolean;
  hobbies: string[];
  address: {
    street: string;
    city: string;
    zipCode: string;
  };
} 