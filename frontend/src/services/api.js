// services/api.js

// Base de la API (puedes sobreescribir con VITE_API_BASE)
const BASE =
  (import.meta && import.meta.env && import.meta.env.VITE_API_BASE) ||
  "https://recetasapi.laenergiaapp.com/api";

// ======== Storage keys ========
const TOKEN_KEY = "le_auth_token";
const USER_KEY = "le_auth_user";

// ======== Token / User helpers ========
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t || "");
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export const setUser = (u) =>
  localStorage.setItem(USER_KEY, JSON.stringify(u || null));

export const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
};

export const clearUser = () => localStorage.removeItem(USER_KEY);

export const clearAuth = () => {
  clearToken();
  clearUser();
  try {
    // 👇 Emitimos evento para que AuthContext o tabs lo detecten
    window.dispatchEvent(new Event("auth:cleared"));
  } catch { }
};

// ======== Helpers ========
const authHeader = () => {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
};

const joinUrl = (base, path) => {
  const b = String(base || "").replace(/\/+$/, "");
  const p = String(path || "").replace(/^\/+/, "");
  return `${b}/${p}`;
};

// ======== HTTP wrapper ========
async function http(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();

  const baseHeaders = {
    Accept: "application/json",
    ...authHeader(),
    ...(options.headers || {}),
  };

  const shouldSetJSON =
    method !== "GET" &&
    options.body != null &&
    !(options.body instanceof FormData) &&
    !("Content-Type" in baseHeaders);

  const headers = shouldSetJSON
    ? { "Content-Type": "application/json", ...baseHeaders }
    : baseHeaders;

  let controller;
  let signal = options.signal;
  if (options.timeout && !signal) {
    controller = new AbortController();
    signal = controller.signal;
    setTimeout(() => controller.abort(), options.timeout);
  }

  const res = await fetch(joinUrl(BASE, path), {
    ...options,
    method,
    headers,
    signal,
  });

  // Si el token expiró o es inválido
  if (res.status === 401) {
    clearAuth(); // limpia y dispara el evento "auth:cleared"
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText}${txt ? ` - ${txt}` : ""}`);
  }

  if (res.status === 204) return null;
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

// ======== API pública ========
export const api = {
  // LOGIN
  async login({ email, password }) {
    const data = await http("/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    const tk = data?.accessToken || data?.access_token || data?.token || null;
    if (tk) setToken(tk);
    if (data?.user) setUser(data.user);

    return data;
  },

  // LOGOUT
  async logout() {
    try {
      await http("/logout", { method: "GET" });
    } catch {
      // Ignoramos error pero limpiamos auth de todos modos
    } finally {
      clearAuth();
    }
  },

  // ======= Recetas =======
  getRecetas: () => http("/recetas-pendientes"),
  getReceta: (id, opts = {}) => http(`/receta/${id}`, opts),

  enviarParte: (id, payload) =>
    http(`/recetas/${id}/parte`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  asignarRecetaOperario: ({ id_receta, id_operario }) =>
    http("/receta-asignar-operario", {
      method: "POST",
      body: JSON.stringify({ id_receta, id_operario }),
    }),

  getUsuarios: () => http("/usuarios"),

  async getOperarios() {
    const res = await http("/usuarios");
    const list = Array.isArray(res) ? res : res?.data || [];
    return list
      .filter((u) => u.rol === "O")
      .map(({ id, name, email }) => ({ id, name, email }));
  },

  // ======= Guardados web =======
  recetaWebGuardar: (payload) =>
    http("/receta-web-guardar", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  recetaLotesWebGuardar: (items) =>
    http("/receta-lotes-web-guardar", {
      method: "POST",
      body: JSON.stringify({ receta_lotes_web: items }),
    }),

  recetaInsumosWebGuardar: (payload) =>
    http("/receta-insumos-web-guardar", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // ======= Cambios de estado =======
  recetaEnviarEncargado: (id) =>
    http("/receta-enviar-encargado", {
      method: "POST",
      body: JSON.stringify({ id }),
    }),

  recetaEnviarSigecom: (id) =>
    http("/receta-enviar-sigecom", {
      method: "POST",
      body: JSON.stringify({ id }),
    }),

  recetaDevolverOperario: (id) =>
    http("/receta-devolver-operario", {
      method: "POST",
      body: JSON.stringify({ id }),
    }),

  recetaCancelarAsignarOperario: (id_receta) =>
    http("/receta-cancelar-asignar-operario", {
      method: "POST",
      body: JSON.stringify({ id_receta }),
    }),

  servicioEtiquetasActivas: (servicio) =>
    http(`/servicio-etiquetas-activas/${servicio}`),
};

