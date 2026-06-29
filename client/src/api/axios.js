//axios instance with base URL + auth header
import axios from 'axios';

// Instead of writing http://localhost:5000/api/documents on every call, you just write /documents and axios prepends the base URL automatically.
const api = axios.create({
  baseURL: 'http://localhost:5000/api',
});

// reads the JWT token from localStorage and attaches it as an Authorization: Bearer <token> header.This means you never have to manually attach the token in your components — it happens automatically on every single API call.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;