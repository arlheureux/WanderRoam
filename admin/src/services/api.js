const API_URL = '/api';

const api = {
  get: async (url, options = {}) => {
    const response = await fetch(`${API_URL}${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw { response: { data: error, status: response.status } };
    }
    return response.json();
  },

  post: async (url, data, options = {}) => {
    const response = await fetch(`${API_URL}${url}`, {
      method: 'POST',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw { response: { data: error, status: response.status } };
    }
    return response.json();
  },

  put: async (url, data, options = {}) => {
    const response = await fetch(`${API_URL}${url}`, {
      method: 'PUT',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw { response: { data: error, status: response.status } };
    }
    return response.json();
  },

  delete: async (url, options = {}) => {
    const response = await fetch(`${API_URL}${url}`, {
      method: 'DELETE',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw { response: { data: error, status: response.status } };
    }
    return response.json();
  },
};

export default api;
