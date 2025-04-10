import React from 'react';
import ReactDOM from 'react-dom';
import LegacyFormikExample from './components/LegacyFormikExample';
import QueryExample from './components/QueryExample';
import SafeQueryExample from './components/SafeQueryExample';
import RemovedApisExample from './components/RemovedApisExample';
import './styles.css';

ReactDOM.render(
  <div>
    <RemovedApisExample />
    <hr style={{ margin: '30px 0' }} />
    <SafeQueryExample />
    <hr style={{ margin: '30px 0' }} />
    <QueryExample />
    <hr style={{ margin: '30px 0' }} />
    <LegacyFormikExample />
  </div>,
  document.getElementById('root')
); 