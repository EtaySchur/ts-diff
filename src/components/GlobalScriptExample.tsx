import React, { useState, useEffect } from 'react';

// Notice we don't need to import Lodash - it's available globally from the script tag

const GlobalScriptExample: React.FC = () => {
  const [items, setItems] = useState<string[]>([
    'Apple', 'Banana', 'Cherry', 'Date', 'Elderberry'
  ]);
  
  const [filteredItems, setFilteredItems] = useState<string[]>([]);
  
  useEffect(() => {
    // Using the global _ (Lodash) from the script tag
    const filtered = _.filter(items, item => item.length > 5);
    setFilteredItems(filtered);
  }, [items]);
  
  const handleAddItem = () => {
    // Using the debounce function from global Lodash
    const debouncedAdd = _.debounce(() => {
      const newItem = `Item ${Math.floor(Math.random() * 100)}`;
      setItems(prev => [...prev, newItem]);
    }, 300);
    
    debouncedAdd();
  };
  
  return (
    <div className="global-script-example">
      <h2>Global Script Example (Lodash)</h2>
      <p>This component uses Lodash loaded from a CDN via script tag</p>
      
      <div className="card mb-4">
        <div className="card-header">All Items</div>
        <ul className="list-group list-group-flush">
          {_.map(items, (item, index) => (
            <li key={index} className="list-group-item">{item}</li>
          ))}
        </ul>
      </div>
      
      <div className="card">
        <div className="card-header">Filtered Items (length {'>'} 5)</div>
        <ul className="list-group list-group-flush">
          {filteredItems.map((item, index) => (
            <li key={index} className="list-group-item">{item}</li>
          ))}
        </ul>
      </div>
      
      <button 
        className="btn btn-primary mt-3" 
        onClick={handleAddItem}
      >
        Add Random Item
      </button>
    </div>
  );
};

export default GlobalScriptExample; 