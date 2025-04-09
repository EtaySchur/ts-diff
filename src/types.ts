import { FormikErrors } from 'formik';

// Types for legacy formik APIs
export interface FormikActions<Values> {
  setSubmitting: (isSubmitting: boolean) => void;
  setErrors: (errors: FormikErrors<Values>) => void;
  setValues: (values: Values, shouldValidate?: boolean) => void;
  setFieldValue: (field: string, value: any, shouldValidate?: boolean) => void;
  setFieldError: (field: string, message: string) => void;
  setFieldTouched: (field: string, isTouched?: boolean, shouldValidate?: boolean) => void;
  setStatus: (status: any) => void;
  setTouched: (touched: { [field: string]: boolean }, shouldValidate?: boolean) => void;
  resetForm: (nextState?: any) => void;
  validateForm: () => Promise<FormikErrors<Values>>;
  validateField: (field: string) => Promise<void> | Promise<string>;
}

export type FormikContext<Values> = {
  values: Values;
  errors: FormikErrors<Values>;
  touched: { [field: string]: boolean };
  isSubmitting: boolean;
  isValidating: boolean;
  status?: any;
  submitCount: number;
  handleBlur: (e: React.FocusEvent<any>) => void;
  handleChange: (e: React.ChangeEvent<any>) => void;
  handleSubmit: (e?: React.FormEvent<HTMLFormElement>) => void;
  handleReset: () => void;
  getFieldProps: (fieldName: string) => {
    value: any;
    name: string;
    onChange: (e: React.ChangeEvent<any>) => void;
    onBlur: (e: React.FocusEvent<any>) => void;
  };
  setFieldValue: (field: string, value: any, shouldValidate?: boolean) => void;
  setFieldError: (field: string, message: string) => void;
  setFieldTouched: (field: string, isTouched?: boolean, shouldValidate?: boolean) => void;
  setSubmitting: (isSubmitting: boolean) => void;
  resetForm: (nextState?: any) => void;
  setFormikState: (state: any, callback?: () => void) => void;
  validateForm: () => Promise<FormikErrors<Values>>;
  validateField: (field: string) => Promise<void> | Promise<string>;
};

export interface FastFieldConfig<T> {
  name: string;
  component?: React.ComponentType<T> | string;
  as?: React.ComponentType<T> | string;
  render?: (props: any) => React.ReactNode;
  children?: (props: any) => React.ReactNode;
  validate?: (value: any) => string | Promise<string | undefined> | undefined;
  shouldUpdate?: (nextProps: T, props: {}) => boolean;
}

// Form values types
export interface LoginFormValues {
  email: string;
  password: string;
  rememberMe: boolean;
}

// Utility type for makeCancelable function
export type CancelablePromise<T> = Promise<T> & { cancel: () => void }; 