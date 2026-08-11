/* Thin API client: token storage, JSON handling, and typed errors. */
(function (global) {
  'use strict';

  var TOKEN_KEY = 'mohtawa_token';

  function ApiRequestError(message, status, code, details) {
    var error = new Error(message);
    error.name = 'ApiRequestError';
    error.status = status;
    error.code = code;
    error.details = details;
    return error;
  }

  var api = {
    token: localStorage.getItem(TOKEN_KEY),

    setToken: function (token) {
      this.token = token;
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    },

    request: function (method, path, body) {
      var headers = { Accept: 'application/json' };
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      if (this.token) headers.Authorization = 'Bearer ' + this.token;

      return fetch('/api' + path, {
        method: method,
        headers: headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      }).then(function (res) {
        var isJson = (res.headers.get('content-type') || '').indexOf('application/json') !== -1;
        return (isJson ? res.json() : res.text()).then(function (payload) {
          if (res.ok) return payload;
          var info = (payload && payload.error) || {};
          throw ApiRequestError(
            info.message || 'تعذّر إتمام الطلب. حاول مرة أخرى.',
            res.status,
            info.code,
            info.details
          );
        });
      });
    },

    get: function (path) {
      return this.request('GET', path);
    },
    post: function (path, body) {
      return this.request('POST', path, body || {});
    },
    patch: function (path, body) {
      return this.request('PATCH', path, body || {});
    },
    put: function (path, body) {
      return this.request('PUT', path, body || {});
    },
    del: function (path) {
      return this.request('DELETE', path);
    },

    query: function (path, params) {
      var pairs = Object.keys(params || {})
        .filter(function (key) {
          return params[key] !== undefined && params[key] !== null && params[key] !== '';
        })
        .map(function (key) {
          return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
        });
      return this.get(path + (pairs.length ? '?' + pairs.join('&') : ''));
    },
  };

  global.api = api;
})(window);
