import api from './client.js';
import { endpoints } from './endpoints.js';

export const fetchUserHabits = () =>
  api.get(endpoints.habits.userList).then((r) => r.data);

export const logHabitExecution = (habitId, payload) =>
  api.post(endpoints.habits.executions(habitId), payload).then((r) => r.data);

export const createUserHabit = (payload) =>
  api.post(endpoints.habits.userList, payload).then((r) => r.data);

export const updateUserHabit = (id, payload) =>
  api.put(endpoints.habits.userHabit(id), payload).then((r) => r.data);

export const deleteUserHabit = (id) =>
  api.delete(endpoints.habits.userHabit(id)).then((r) => r.data);

export const fetchCatalogHabits = () =>
  api.get(endpoints.habits.catalog).then((r) => r.data);

export const fetchRecentExecutions = (take = 100) =>
  api.get(`${endpoints.habits.recentExecutions}?take=${take}`).then((r) => r.data);
