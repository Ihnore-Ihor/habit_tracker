import api from './client.js';
import { endpoints } from './endpoints.js';

export const loginRequest = (payload) =>
  api.post(endpoints.auth.login, payload).then((r) => r.data);

export const registerRequest = (payload) =>
  api.post(endpoints.auth.register, payload).then((r) => r.data);

export const meRequest = () =>
  api.get(endpoints.auth.me).then((r) => r.data);
