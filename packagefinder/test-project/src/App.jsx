import React, { useState, useEffect } from 'react';
import * as ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import axios from 'axios';

// Import components
import { Button, Card, Form } from 'react-bootstrap';

// Import styles
import './App.css';

function App() {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    // Get data from API
    axios.get('/api/data')
      .then(response => {
        setData(response.data);
      })
      .catch(error => {
        console.error('Error fetching data:', error);
      });
  }, []);
  
  function handleSubmit(event) {
    event.preventDefault();
    ReactDOM.findDOMNode(event.target).reset();
  }
  
  return (
    <div className="App">
      <Card>
        <Card.Header>
          <h1>React App</h1>
        </Card.Header>
        <Card.Body>
          <Form onSubmit={handleSubmit}>
            <Form.Group>
              <Form.Label>Name</Form.Label>
              <Form.Control type="text" placeholder="Enter your name" />
            </Form.Group>
            <Button type="submit">Submit</Button>
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
}

App.propTypes = {
  title: PropTypes.string
};

export default App; 