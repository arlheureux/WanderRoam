import toast from 'react-hot-toast';

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

    console.log('API Request:', { method, endpoint, isFormData, hasData: !!data });

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
        console.log('Request body (JSON):', options.body.substring(0, 200));
      }
    }

    console.log('Fetching:', url, 'options:', { method: options.method, hasBody: !!options.body });
    const response = await fetch(url, options);
    console.log('Response status:', response.status, response.statusText);
    const result = await response.json();

    if (!response.ok) {
      const errorMsg = result.error || 'Request failed';
      toast.error(errorMsg);
      throw new Error(errorMsg);
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

  uploadGpx(adventureId, file, name, type) {
    console.log('uploadGpx called:', { adventureId, name, type, file });
    const formData = new FormData();
    formData.append('file', file);
    if (name) formData.append('name', name);
    if (type) formData.append('type', type);
    console.log('FormData created, posting to:', `/adventures/${adventureId}/gpx`);
    return this.post(`/adventures/${adventureId}/gpx`, formData, true);
  }

  uploadGpxBase64(adventureId, base64Data, name, type) {
    console.log('uploadGpxBase64 called:', { adventureId, name, type, dataLength: base64Data?.length });
    return this.post(`/adventures/${adventureId}/gpx-base64`, { 
      file: base64Data, 
      name, 
      type 
    });
  }

  createGpxFromPoints(data) {
    console.log('createGpxFromPoints called with:', data);
    return this.post('/adventures/gpx/from-points', data);
  }

  getSeries() {
    return this.get('/series');
  }

  getSeriesById(id) {
    return this.get(`/series/${id}`);
  }

  createSeries(data) {
    return this.post('/series', data);
  }

  updateSeries(id, data) {
    return this.put(`/series/${id}`, data);
  }

  deleteSeries(id) {
    return this.delete(`/series/${id}`);
  }

  updateSeriesAdventures(id, adventureIds) {
    return this.put(`/series/${id}/adventures`, { adventureIds });
  }
}

export default new ApiService();
