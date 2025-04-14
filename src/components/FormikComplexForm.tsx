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

interface FormikComplexFormState {
  cancelablePromise: any;
  cancel: () => void;
  promiseResult: string | null;
}

interface FormikComplexFormProps {}

// Example component that demonstrates formik features
class FormikComplexForm extends React.Component<FormikComplexFormProps, FormikComplexFormState> {
  constructor(props: FormikComplexFormProps) {
    super(props);
    
    // Example of using makeCancelable utility
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
  
  // Using the FormikContext type
  renderForm(formikContext: FormikContext<ExtendedFormValues>): React.ReactElement {
    return (
      <div>
        <h3>User Information</h3>
        <div>
          <label htmlFor="firstName">First Name:</label>
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

        {/* Address Section using connected component */}
        <fieldset>
          <legend>Address</legend>
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
      <div className="formik-complex-form">
        <h2>Formik Complex Form Example</h2>
        
        {/* Display makeCancelable promise result */}
        {this.state.promiseResult && (
          <div className="promise-result">
            Promise Result: <strong>{this.state.promiseResult}</strong>
          </div>
        )}
        
        <Formik
          initialValues={initialValues}
          validate={validateForm}
          onSubmit={handleSubmit}
        >
          {/* Use the render prop to get access to the Formik context */}
          {formikContext => (
            <form onSubmit={formikContext.handleSubmit}>
              {this.renderForm(formikContext)}
            </form>
          )}
        </Formik>
      </div>
    );
  }
}

export default FormikComplexForm; 