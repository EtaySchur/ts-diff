import React from 'react';
import {
  Field,
  Formik,
  FormikErrors
} from 'formik';
import { FormikActions, FormikContext, FastFieldConfig, LoginFormValues, CancelablePromise } from './types';

// Mock implementation of removed makeCancelable function
function makeCancelable<T>(promise: Promise<T>): [CancelablePromise<T>, () => void] {
  let hasCanceled_ = false;

  const wrappedPromise = new Promise<T>((resolve, reject) => {
    promise.then(
      val => hasCanceled_ ? reject({isCanceled: true}) : resolve(val),
      error => hasCanceled_ ? reject({isCanceled: true}) : reject(error)
    );
  }) as CancelablePromise<T>;

  const cancel = () => {
    hasCanceled_ = true;
  };

  wrappedPromise.cancel = cancel;
  return [wrappedPromise, cancel];
}

interface LegacyFormikExampleState {
  cancelablePromise: CancelablePromise<string>;
  cancel: () => void;
}

interface LegacyFormikExampleProps {}

// Example component that demonstrates the removed APIs from formik
class LegacyFormikExample extends React.Component<LegacyFormikExampleProps, LegacyFormikExampleState> {
  constructor(props: LegacyFormikExampleProps) {
    super(props);
    
    // Example of using makeCancelable (removed API)
    const [cancelablePromise, cancel] = makeCancelable<string>(
      new Promise(resolve => setTimeout(() => resolve('Data loaded'), 1000))
    );
    
    this.state = {
      cancelablePromise,
      cancel
    };
  }
  
  componentWillUnmount(): void {
    // Cancel the promise when component unmounts
    this.state.cancel();
  }
  
  // Using the removed Formik class API
  renderForm(formikContext: FormikContext<LoginFormValues>): React.ReactElement {
    // formikContext is of type FormikContext (which is now removed)
    return (
      <div>
        <h3>User Information</h3>
        <div>
          <label htmlFor="email">Email:</label>
          {/* Using Field as React.ComponentType<any> (removed API style) */}
          <Field
            name="email"
            type="email"
            placeholder="Email"
          />
        </div>
        
        <div>
          <label htmlFor="password">Password:</label>
          <Field
            name="password"
            type="password"
            placeholder="Password"
          />
        </div>
        
        <div>
          <label>
            <Field type="checkbox" name="rememberMe" />
            Remember me
          </label>
        </div>
        
        <button type="submit">Login</button>
      </div>
    );
  }
  
  validate = (values: LoginFormValues): FormikErrors<LoginFormValues> => {
    const errors: FormikErrors<LoginFormValues> = {};
    if (!values.email) {
      errors.email = 'Required';
    } else if (
      !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(values.email)
    ) {
      errors.email = 'Invalid email address';
    }
    
    if (!values.password) {
      errors.password = 'Required';
    }
    
    return errors;
  };
  
  handleSubmit = (values: LoginFormValues, formikBag: any): void => {
    // Using FormikActions (removed API)
    const formikActions = formikBag as FormikActions<LoginFormValues>;
    
    // Simulating an API call
    setTimeout(() => {
      alert(JSON.stringify(values, null, 2));
      formikActions.setSubmitting(false);
    }, 1000);
  };
  
  render(): React.ReactElement {
    const initialValues: LoginFormValues = {
      email: '',
      password: '',
      rememberMe: false
    };
    
    return (
      <div className="legacy-formik-example">
        <h2>Legacy Formik Login Form</h2>
        
        {/* Using Formik as a class (removed API style) */}
        <Formik
          initialValues={initialValues}
          validate={this.validate}
          onSubmit={this.handleSubmit}
        >
          {formik => (
            <form onSubmit={formik.handleSubmit}>
              {/* Pass the formik object as FormikContext type (removed API) */}
              {this.renderForm(formik as unknown as FormikContext<LoginFormValues>)}
            </form>
          )}
        </Formik>
        
        <div style={{ marginTop: '20px' }}>
          <h3>Notes about removed APIs:</h3>
          <ul>
            <li><code>FastFieldConfig</code>: Used for configuring FastField behavior</li>
            <li><code>Field</code>: Changed from React.ComponentType to function</li>
            <li><code>Formik</code>: Changed from class to function</li>
            <li><code>FormikActions</code>: Renamed to FormikHelpers</li>
            <li><code>FormikContext</code>: Replaced by FormikContextType</li>
            <li><code>makeCancelable</code>: Internal utility that was removed</li>
          </ul>
        </div>
      </div>
    );
  }
}

export default LegacyFormikExample; 