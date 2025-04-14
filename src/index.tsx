import React from 'react';
import ReactDOM from 'react-dom';
import FormikComplexForm from './components/FormikComplexForm';
import QueryExample from './components/QueryExample';
import SafeQueryExample from './components/SafeQueryExample';
import QueryAdvancedExample from './components/QueryAdvancedExample';
import './styles.css';

ReactDOM.render(
  <div>
    <QueryAdvancedExample />
    <hr style={{ margin: '30px 0' }} />
    <SafeQueryExample />
    <hr style={{ margin: '30px 0' }} />
    <QueryExample />
    <hr style={{ margin: '30px 0' }} />
    <FormikComplexForm />
  </div>,
  document.getElementById('root')
); 