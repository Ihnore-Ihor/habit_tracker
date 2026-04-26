import api from './client.js';
import { endpoints } from './endpoints.js';

export const fetchUserHabits = () =>
  api.get(endpoints.habits.userList).then((r) => r.data);

export const logHabitExecution = (habitId, payload) =>
  api.post(endpoints.habits.executions(habitId), payload).then((r) => r.data);
