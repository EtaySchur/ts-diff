import React from 'react';
import {
  Field,
  Formik,
  FieldArray,
  FormikContext,
  ArrayHelpers
} from 'formik';
import { ExtendedFormValues } from '../types';
import ErrorDisplay from './ErrorDisplay';
import CustomFastField from './CustomFastField';
import FormikConnectedInput from './FormikConnectedInput';
import { validateForm, handleSubmit, makeCancelable } from '../utils/formikUtils';

interface LegacyFormikExampleState {
  cancelablePromise: any;
  cancel: () => void;
  promiseResult: string | null;
}

interface LegacyFormikExampleProps {}

// Example component that demonstrates the removed APIs from formik
class LegacyFormikExample extends React.Component<LegacyFormikExampleProps, LegacyFormikExampleState> {
  constructor(props: LegacyFormikExampleProps) {
    super(props);
    
    // Example of using makeCancelable (removed API) directly from formik
    const [cancelablePromise, cancel] = makeCancelable(
      new Promise(resolve => setTimeout(() => resolve('Data loaded!'), 1000))
    );
    
    this.state = {
      cancelablePromise,
      cancel,
      promiseResult: null
    };

    // Use the cancelable promise
    this.state.cancelablePromise
      .then((result: string) => this.setState({ promiseResult: result }))
      .catch((err: any) => {
        if (!err.isCanceled) {
          console.error('Error in promise:', err);
        }
      });
  }
  
  componentWillUnmount(): void {
    // Cancel the promise when component unmounts
    this.state.cancel();
  }
  
  // Using the removed FormikContext type API directly from formik
  renderForm(formikContext: FormikContext<ExtendedFormValues>): React.ReactElement {
    return (
      <div>
        <h3>User Information</h3>
        <div>
          <label htmlFor="firstName">First Name:</label>
          {/* Using Field as React.ComponentType<any> (removed API style) */}
          <Field
            name="firstName"
            type="text"
            placeholder="First Name"
          />
          {formikContext.errors.firstName && formikContext.touched.firstName && (
            <ErrorDisplay message={formikContext.errors.firstName as string} />
          )}
        </div>

        <div>
          <label htmlFor="lastName">Last Name:</label>
          {/* Using Field as React.ComponentType<any> (removed API style) */}
          <Field
            name="lastName"
            type="text"
            placeholder="Last Name"
          />
          {formikContext.errors.lastName && formikContext.touched.lastName && (
            <ErrorDisplay message={formikContext.errors.lastName as string} />
          )}
        </div>
        
        <div>
          <label htmlFor="email">Email:</label>
          {/* Using FastField with FastFieldConfig (removed API) */}
          <CustomFastField
            name="email"
            type="email"
            placeholder="Email"
            validate={(value: string) => {
              let error;
              if (!value) {
                error = 'Required';
              } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value)) {
                error = 'Invalid email address';
              }
              return error;
            }}
          />
          {formikContext.errors.email && formikContext.touched.email && (
            <ErrorDisplay message={formikContext.errors.email as string} />
          )}
        </div>
        
        <div>
          <label htmlFor="password">Password:</label>
          <Field
            name="password"
            type="password"
            placeholder="Password"
          />
          {formikContext.errors.password && formikContext.touched.password && (
            <ErrorDisplay message={formikContext.errors.password as string} />
          )}
        </div>

        {/* Address Section - Using connected component with connect API */}
        <fieldset>
          <legend>Address (Using Connect API)</legend>
          <FormikConnectedInput name="address.street" label="Street" />
          <FormikConnectedInput name="address.city" label="City" />
          <FormikConnectedInput name="address.zipCode" label="Zip Code" />
        </fieldset>
        
        {/* FieldArray example */}
        <div>
          <label>Hobbies:</label>
          <FieldArray
            name="hobbies"
            render={(arrayHelpers: ArrayHelpers) => (
              <div>
                {formikContext.values.hobbies && formikContext.values.hobbies.length > 0 ? (
                  formikContext.values.hobbies.map((hobby, index) => (
                    <div key={index} style={{ display: 'flex', marginBottom: '10px' }}>
                      <Field name={`hobbies.${index}`} />
                      <button
                        type="button"
                        onClick={() => arrayHelpers.remove(index)}
                        style={{ marginLeft: '10px' }}
                      >
                        Remove
                      </button>
                      <button
                        type="button"
                        onClick={() => arrayHelpers.insert(index + 1, '')}
                        style={{ marginLeft: '10px' }}
                      >
                        +
                      </button>
                    </div>
                  ))
                ) : (
                  <button type="button" onClick={() => arrayHelpers.push('')}>
                    Add a Hobby
                  </button>
                )}
              </div>
            )}
          />
        </div>
        
        <div>
          <label>
            <Field type="checkbox" name="rememberMe" />
            Remember me
          </label>
        </div>
        
        <button type="submit" disabled={formikContext.isSubmitting}>
          {formikContext.isSubmitting ? 'Submitting...' : 'Submit'}
        </button>
      </div>
    );
  }
  
  render(): React.ReactElement {
    const initialValues: ExtendedFormValues = {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      rememberMe: false,
      hobbies: [''],
      address: {
        street: '',
        city: '',
        zipCode: ''
      }
    };
    
    return (
      <div className="legacy-formik-example">
        <h2>Legacy Formik Form Using Removed APIs</h2>
        
        {/* Display makeCancelable promise result */}
        {this.state.promiseResult && (
          <div className="promise-result">
            makeCancelable Result: <strong>{this.state.promiseResult}</strong>
          </div>
        )}
        
        {/* Using Formik as a class (removed API style) */}
        <Formik
          initialValues={initialValues}
          validate={validateForm}
          onSubmit={handleSubmit}
        >
          {formik => (
            <form onSubmit={formik.handleSubmit}>
              {/* Pass the formik object as FormikContext type (removed API) */}
              {this.renderForm(formik as unknown as FormikContext<ExtendedFormValues>)}
            </form>
          )}
        </Formik>
        
        <div style={{ marginTop: '20px' }}>
          <h3>Using Removed APIs from formik-versions.json:</h3>
          <ul>
            <li><code>FastFieldConfig</code>: Interface for FastField configuration</li>
            <li><code>Field</code>: Used as React.ComponentType (old way)</li>
            <li><code>Formik</code>: Used as a class (old way)</li>
            <li><code>FormikActions</code>: Interface renamed to FormikHelpers</li>
            <li><code>FormikContext</code>: Type replaced by FormikContextType</li>
            <li><code>makeCancelable</code>: Internal utility function that was removed</li>
            <li><code>ArrayHelpers</code>: Interface that was modified with generic type</li>
            <li><code>CompositeComponent</code>: Type that was modified to use FunctionComponent instead of StatelessComponent</li>
            <li><code>connect</code>: Function used to connect a component to Formik context (API was modified)</li>
          </ul>
        </div>
      </div>
    );
  }
}

export default LegacyFormikExample; 