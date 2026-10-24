import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:8000",
  timeout: 30000,
});
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("ku-token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && sessionStorage.getItem("ku-token"))
      window.dispatchEvent(new Event("ku-session-expired"));
    return Promise.reject(error);
  },
);
export function errorMessage(error) {
  const message = error.response?.data?.error?.message;
  return typeof message === "string"
    ? message
    : message?.message || error.message || "Request failed. Please try again.";
}
export function filterParams(filters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
    else if (value !== "" && value != null) params.set(key, value);
  }
  return params;
}
export async function discover({ query, mode, page = 1, filters, signal }) {
  const params = filterParams(filters);
  params.set("page", page);
  if (query.trim()) {
    params.set("q", query.trim());
    params.set("top_n", 20);
    const { data } = await api.get(
      mode === "ask" ? "/search" : "/keyword-search",
      { params, signal },
    );
    return data;
  }
  params.set("page_size", 20);
  const { data } = await api.get("/courses", { params, signal });
  return { ...data, results: data.courses, total_results: data.total_courses };
}
export const getCourse = async (code, signal) =>
  (await api.get(`/courses/${encodeURIComponent(code)}`, { signal })).data;
export const validateTimetable = async (body) =>
  (await api.post("/timetable/validate", body)).data;
