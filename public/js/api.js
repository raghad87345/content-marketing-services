const API_BASE = '/api';

const api = {
  token: localStorage.getItem('cms_token'),

  setToken(token) {
    this.token = token;
    if (token) localStorage.setItem('cms_token', token);
    else localStorage.removeItem('cms_token');
  },

  async request(method, path, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (this.token) opts.headers['Authorization'] = `Bearer ${this.token}`;
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(API_BASE + path, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  },

  get: (path) => api.request('GET', path),
  post: (path, body) => api.request('POST', path, body),
  put: (path, body) => api.request('PUT', path, body),
  delete: (path) => api.request('DELETE', path),

  // Auth
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (name, email, password) => api.post('/auth/register', { name, email, password }),
  me: () => api.get('/auth/me'),

  // Content
  getContents: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api.get('/content' + (q ? '?' + q : ''));
  },
  createContent: (data) => api.post('/content', data),
  updateContent: (id, data) => api.put(`/content/${id}`, data),
  deleteContent: (id) => api.delete(`/content/${id}`),

  // Campaigns
  getCampaigns: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api.get('/campaigns' + (q ? '?' + q : ''));
  },
  createCampaign: (data) => api.post('/campaigns', data),
  updateCampaign: (id, data) => api.put(`/campaigns/${id}`, data),
  deleteCampaign: (id) => api.delete(`/campaigns/${id}`),

  // Analytics
  getOverview: () => api.get('/analytics/overview'),
  getTopContent: () => api.get('/analytics/top-content'),
};
