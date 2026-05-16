import axios from "axios";

const api = axios.create({
  baseURL: "/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** Запросы к профилю: 401 обрабатываем на странице (toast), без разлогина и редиректа */
function isProfileMeRequest(config) {
  const url = String(config?.url || "");
  const base = String(config?.baseURL || "");
  return url.includes("profile/me") || `${base}${url}`.includes("profile/me");
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      if (isProfileMeRequest(error.config)) {
        return Promise.reject(error);
      }
      if (localStorage.getItem("token")) {
        localStorage.removeItem("token");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export const getErrorMessage = (error) =>
  error?.response?.data?.error ||
  error?.message ||
  "Ошибка запроса. Проверьте подключение к серверу.";

export default api;
