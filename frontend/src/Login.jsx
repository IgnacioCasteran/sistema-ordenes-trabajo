// src/Login.jsx
import { useEffect, useState } from "react";
import { useAuth } from "./context/AuthContext";
import { api } from "./services/api";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

const showLoading = (title = "Iniciando sesión…") =>
  Swal.fire({
    title,
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: () => Swal.showLoading(),
  });
const hideLoading = () => Swal.close();

export default function Login() {
  const { login } = useAuth();

  // usuarios para el dropdown
  const [users, setUsers] = useState([]); // [{id, name, email, rol}]
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [fetchErr, setFetchErr] = useState("");

  // selección + credenciales
  const [selectedUserId, setSelectedUserId] = useState("");
  const [email, setEmail] = useState(""); // se completa al elegir usuario
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Traer usuarios al montar
  useEffect(() => {
    let ac = new AbortController();
    setLoadingUsers(true);
    setFetchErr("");

    (async () => {
      try {
        const res = await api.getUsuarios({ signal: ac.signal });
        const list = Array.isArray(res) ? res : res?.data || [];

        // Normalizamos solo lo que usamos
        const normalized = list.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          rol: u.rol,
        }));

        // Opcional: orden por nombre
        normalized.sort((a, b) =>
          String(a.name || "").localeCompare(String(b.name || ""), "es", {
            sensitivity: "base",
          })
        );

        setUsers(normalized);
      } catch (e) {
        setFetchErr("No se pudieron cargar los usuarios.");
        console.error(e);
      } finally {
        setLoadingUsers(false);
      }
    })();

    return () => ac.abort();
  }, []);

  // Al cambiar selección, rellenamos email interno
  const handleSelectUser = (idStr) => {
    setSelectedUserId(idStr);
    const u = users.find((x) => String(x.id) === idStr);
    setEmail(u?.email || "");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setErr("");

    // Validaciones mínimas
    if (!selectedUserId) {
      setErr("Seleccioná tu usuario.");
      return;
    }
    if (!password) {
      setErr("Ingresá tu contraseña.");
      return;
    }

    setSubmitting(true);
    showLoading();

    try {
      await login(email, password);
      // Si querés feedback visible:
      // await Swal.fire({ icon: "success", title: "Listo", timer: 900, showConfirmButton: false });
    } catch (e) {
      await Swal.fire({
        icon: "error",
        title: "No se pudo iniciar sesión",
        text: "Usuario/contraseña inválidos o error de servidor.",
      });
      setErr("Usuario/contraseña inválidos o error de servidor.");
    } finally {
      hideLoading();
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-neutral-50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white rounded-2xl shadow p-6 space-y-4 border"
        aria-busy={submitting}
      >
        <h1 className="text-2xl font-extrabold">Iniciar sesión</h1>

        {/* Selector de usuario (solo muestra name) */}
        <div>
          <label className="block text-sm font-semibold mb-1">Usuario</label>
          <select
            className="w-full rounded-xl border px-4 py-3 outline-none focus:ring-4 focus:ring-blue-500/30 disabled:opacity-60"
            value={selectedUserId}
            onChange={(e) => handleSelectUser(e.target.value)}
            disabled={submitting || loadingUsers}
            required
          >
            <option value="" disabled>
              {loadingUsers ? "Cargando usuarios…" : "Seleccioná tu usuario"}
            </option>
            {users.map((u) => (
              <option key={u.id} value={String(u.id)}>
                {u.name}
              </option>
            ))}
          </select>
          {fetchErr && (
            <div className="mt-1 text-xs text-red-600">{fetchErr}</div>
          )}
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-semibold mb-1">Contraseña</label>
          <input
            type="password"
            className="w-full rounded-xl border px-4 py-3 outline-none focus:ring-4 focus:ring-blue-500/30 disabled:opacity-60"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="********"
            autoComplete="current-password"
            required
            disabled={submitting}
          />
        </div>

        {/* Mensaje de error general */}
        {err && <div className="text-sm text-red-600">{err}</div>}

        <button
          type="submit"
          className="w-full rounded-xl bg-blue-600 text-white py-3 font-bold hover:bg-blue-700 disabled:opacity-60"
          disabled={submitting || loadingUsers || !users.length}
        >
          {submitting ? "Ingresando…" : "Entrar"}
        </button>

        {/* Campo oculto solo por depuración local (email usado realmente) */}
        <input type="hidden" value={email} readOnly />
      </form>
    </div>
  );
}


