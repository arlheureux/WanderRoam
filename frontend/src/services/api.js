const API_URL = process.env.REACT_APP_API_URL || '/api';

class ApiService {
  constructor() {
    this.baseUrl = API_URL;
  }

  async getVersion() {
    const response = await fetch(`${this.baseUrl}/version`);
    return response.json();
  }

  getHeaders(includeAuth = true, isFormData = false) {
    const headers = {};
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }
    if (includeAuth) {
      const token = localStorage.getItem('token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
    return headers;
  }

  async request(method, endpoint, data = null, isFormData = false) {
    const url = `${this.baseUrl}${endpoint}`;
    const options = {
      method,
      headers: this.getHeaders(true, isFormData)
    };

    if (data) {
      if (isFormData && data instanceof FormData) {
        options.body = data;
      } else if (isFormData) {
        const formData = new FormData();
        Object.keys(data).forEach(key => {
          if (data[key] !== null && data[key] !== undefined) {
            formData.append(key, data[key]);
          }
        });
        options.body = formData;
      } else {
        options.body = JSON.stringify(data);
      }
    }

    const response = await fetch(url, options);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Request failed');
    }

    return { data: result };
  }

  get(endpoint) {
    return this.request('GET', endpoint);
  }

  post(endpoint, data, isFormData = false) {
    return this.request('POST', endpoint, data, isFormData);
  }

  put(endpoint, data) {
    return this.request('PUT', endpoint, data);
  }

  delete(endpoint) {
    return this.request('DELETE', endpoint);
  }

  getTags() {
    return this.get('/adventures/tags');
  }

  updateAdventureTags(adventureId, tagIds) {
    return this.put(`/adventures/${adventureId}/tags`, { tagIds });
  }

  createTag(name, category) {
    return this.post('/adventures/tags', { name, category });
  }

  deleteTag(tagId) {
    return this.delete(`/adventures/tags/${tagId}`);
  }

  updateGpx(gpxId, data) {
    return this.put(`/gpx/${gpxId}`, data);
  }
}

export default new ApiService();
