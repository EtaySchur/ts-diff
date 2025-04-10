import { FormikActions, FormikErrors } from 'formik';
import { ExtendedFormValues } from '../types';

// Function to validate form values
export const validateForm = (values: ExtendedFormValues): FormikErrors<ExtendedFormValues> => {
  const errors: FormikErrors<ExtendedFormValues> = {};
  
  if (!values.firstName) {
    errors.firstName = 'Required';
  }
  
  if (!values.lastName) {
    errors.lastName = 'Required';
  }
  
  if (!values.email) {
    errors.email = 'Required';
  } else if (
    !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(values.email)
  ) {
    errors.email = 'Invalid email address';
  }
  
  if (!values.password) {
    errors.password = 'Required';
  } else if (values.password.length < 6) {
    errors.password = 'Password must be at least 6 characters';
  }
  
  return errors;
};

// Function to handle form submission
export const handleSubmit = (
  values: ExtendedFormValues, 
  actions: FormikActions<ExtendedFormValues>
): void => {
  // Using FormikActions (removed API) directly from formik
  setTimeout(() => {
    alert(JSON.stringify(values, null, 2));
    actions.setSubmitting(false);
  }, 1000);
};

// Implementation of makeCancelable function that was removed from formik
export const makeCancelable = <T>(promise: Promise<T>): [Promise<T>, () => void] => {
  let hasCanceled_ = false;

  const wrappedPromise = new Promise<T>((resolve, reject) => {
    promise.then(
      val => hasCanceled_ ? reject({isCanceled: true}) : resolve(val),
      error => hasCanceled_ ? reject({isCanceled: true}) : reject(error)
    );
  });

  const cancel = () => {
    hasCanceled_ = true;
  };

  return [wrappedPromise as Promise<T>, cancel];
}; 