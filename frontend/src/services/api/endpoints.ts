// api/endpoints.ts
// All API endpoints in one place
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: "/api/auth/login",
    LOGOUT: "/api/auth/logout",
    ME: "/api/auth/me",
    FORGOT_PASSWORD: "/api/auth/request-password-reset",
    RESET_PASSWORD: "/api/auth/reset-password",
  },

  DEALS: {
    GET_ALL: "/api/deals",
    GET_ONE: (id: number) => `/api/deals/${id}`,
    CREATE: "/api/deals",
    UPDATE: (id: number) => `/api/deals/${id}`,
    POST: (id: number) => `/api/deals/${id}`,
    DELETE: (id: number) => `/api/deals/${id}`,
  },

  EXPENSES: {
    GET_ALL: "/api/expenses",
    GET_ONE: (id: number) => `/api/expenses/${id}`,
    CREATE: "/api/expenses",
    UPDATE: (id: number) => `/api/expenses/${id}`,
    PATCH: (id: number) => `/api/expenses/${id}`,
    DELETE: (id: number) => `/api/expenses/${id}`,
  },

  ATTRITION: {
    ATTRITION_DATA: "/api/attrition/list",
    ATTRITION_CREATE: "/api/attrition/create",
    ATTRITION_UPDATE: "/api/attrition/update"
  },
  
  NOTIFICATIONS: {
    LIST: "/api/notifications",
    SEEN: "/api/notifications/seen",
  },
} as const;