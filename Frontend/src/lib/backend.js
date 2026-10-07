// Backend address for every API call. Set VITE_BACKEND_URL in .env for
// production (e.g. https://api.yourdomain.com); local development falls back
// to the Express server on port 5000.
export const BACKEND_URL = String(import.meta.env?.VITE_BACKEND_URL || "http://localhost:5000").replace(/\/+$/, "");

export const backendUrl = (path) => `${BACKEND_URL}${path.startsWith("/") ? path : `/${path}`}`;
