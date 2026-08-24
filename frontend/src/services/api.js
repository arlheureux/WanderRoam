import toast from 'react-hot-toast';

class ApiService {
  constructor() {
    this.baseUrl = '/api';
  }

  buildUrl(endpoint, params) {
    const url = new URL(`${this.baseUrl}${endpoint}`, window.location.origin);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, value);
        }
      });
    }
    return url.toString();
  }

  getHeaders(includeAuth = true, isFormData = false) {
    const headers = {};
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }
    // Authorization header removed - using httpOnly cookies instead
    return headers;
  }

  async request(method, endpoint, data = null, isFormData = false, config = {}) {
    const url = this.buildUrl(endpoint, config.params);
    const options = {
      method,
      headers: this.getHeaders(true, isFormData),
      credentials: 'include' // Required for CORS with cookies
    };

    if (config.signal) {
      options.signal = config.signal;
    }

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
      const errorMsg = result.error || 'Request failed';
      toast.error(errorMsg);
      throw new Error(errorMsg);
    }

    return { data: result };
  }

  get(endpoint, config = {}) {
    return this.request('GET', endpoint, null, false, config);
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

  getTags(config = {}) {
    return this.get('/adventures/tags', config);
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

  uploadGpxBase64(adventureId, base64Data, name, type) {
    return this.post(`/adventures/${adventureId}/gpx-base64`, {
      file: base64Data,
      name,
      type
    });
  }

  createGpxFromPoints(data) {
    return this.post('/adventures/gpx/from-points', data);
  }

  getSeries(config = {}) {
    return this.get('/series', config);
  }

  getSeriesById(id, config = {}) {
    return this.get(`/series/${id}`, config);
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
