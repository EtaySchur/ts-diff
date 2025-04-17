// CommonJS require
const _ = require('lodash');
const { format } = require('date-fns');
const axios = require('axios');

// Helper functions
function formatDate(date) {
  return format(date, 'yyyy-MM-dd');
}

function clone(obj) {
  return _.cloneDeep(obj);
}

function fetchData(url) {
  return axios.get(url);
}

// Export functions
module.exports = {
  formatDate,
  clone,
  fetchData
}; 