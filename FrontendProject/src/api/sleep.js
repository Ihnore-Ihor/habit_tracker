import api from './client.js';
import { endpoints } from './endpoints.js';

export const fetchSleepProfile = () => 
  api.get(endpoints.sleep.profile).then(r => r.data).catch(() => null);
