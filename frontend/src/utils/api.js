// API utility for talking to backend
// yeah we just hardcode the auth token for now lol

const API_BASE_URL = 'http://localhost:8000';
const AUTH_TOKEN = 'ididntwriteauthsystemyetLOL';

// helper to make requests easier
const apiRequest = async (endpoint, options = {}) => {
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AUTH_TOKEN}`,
      ...options.headers,
    },
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...defaultOptions,
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `API Error: ${response.status}`);
  }

  return response.json();
};

// === CAR API ===

export const carsAPI = {
  // get all cars
  getAll: async () => {
    return apiRequest('/api/cars');
  },

  // get one car by name
  get: async (carName) => {
    return apiRequest(`/api/cars/${encodeURIComponent(carName)}`);
  },

  // create new car
  create: async (carData) => {
    return apiRequest('/api/cars', {
      method: 'POST',
      body: JSON.stringify(carData),
    });
  },

  // update existing car
  update: async (carName, carData) => {
    return apiRequest(`/api/cars/${encodeURIComponent(carName)}`, {
      method: 'PUT',
      body: JSON.stringify(carData),
    });
  },

  // delete car
  delete: async (carName) => {
    return apiRequest(`/api/cars/${encodeURIComponent(carName)}`, {
      method: 'DELETE',
    });
  },
};

// === TRACK API ===

export const tracksAPI = {
  // get all tracks
  getAll: async () => {
    return apiRequest('/api/tracks');
  },

  // get one track by name
  get: async (trackName) => {
    return apiRequest(`/api/tracks/${encodeURIComponent(trackName)}`);
  },

  // upload new track (CSV file)
  upload: async (trackName, file) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(
      `${API_BASE_URL}/api/tracks/upload?track_name=${encodeURIComponent(trackName)}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || `Upload failed: ${response.status}`);
    }

    return response.json();
  },

  // delete track
  delete: async (trackName) => {
    return apiRequest(`/api/tracks/${encodeURIComponent(trackName)}`, {
      method: 'DELETE',
    });
  },
};

// === PREDICTION API ===

export const predictionsAPI = {
  // get all predictions
  getAll: async () => {
    return apiRequest('/api/predictions');
  },

  // get one prediction file
  get: async (filename) => {
    const response = await fetch(
      `${API_BASE_URL}/api/predictions/${encodeURIComponent(filename)}`,
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get prediction: ${response.status}`);
    }

    return response.blob();
  },
};

export default {
  cars: carsAPI,
  tracks: tracksAPI,
  predictions: predictionsAPI,
};

