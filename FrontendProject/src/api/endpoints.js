// Central place for backend route paths. Adjust to match the ASP.NET Core API.
export const endpoints = {
  auth: {
    login: '/api/auth/login',
    register: '/api/auth/register',
    me: '/api/auth/me',
  },
  habits: {
    list: '/api/habits',
    userList: '/api/user-habits',
    userHabit: (id) => `/api/user-habits/${id}`,
    catalog: '/api/catalog/habits',
    executions: (id) => `/api/user-habits/${id}/executions`,
    recentExecutions: '/api/user-habits/executions/recent',
  },
  sleep: {
    list:    '/api/sleep',
    logs:    '/api/sleep/logs',
    profile: '/api/sleep/profile',
  },
  affect: {
    list:    '/api/affect',
    log:     '/api/affect',
    today:   '/api/affect/today',
    summary: '/api/affect/today/summary',
  },
  analytics: {
    me: '/api/analytics/me',
    global: '/api/analytics/global',
  },
};
