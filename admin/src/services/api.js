const API_URL = process.env.REACT_APP_API_URL || '/api';

async function request(method, url, data, options = {}) {
  const headers = {
    'X-Requested-With': 'XMLHttpRequest',
    ...options.headers,
  };
  const init = {
    method,
    ...options,
    headers,
    credentials: 'include',
  };
  if (data !== undefined && data !== null) {
    if (data instanceof FormData) {
      delete headers['Content-Type'];
      init.body = data;
    } else {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(data);
    }
  }
  const response = await fetch(`${API_URL}${url}`, init);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw { response: { data: error, status: response.status } };
  }
  return response.json();
}

const api = {
  get: (url, options = {}) => request('GET', url, undefined, options),
  post: (url, data, options = {}) => request('POST', url, data, options),
  put: (url, data, options = {}) => request('PUT', url, data, options),
  delete: (url, options = {}) => request('DELETE', url, undefined, options),
};

export default api;