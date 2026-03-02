// src/App.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Login from "./Login";
import WorkOrderMobile from "./WorkOrderMobile";
import Encargado from "./Encargado";
import EncargadoOT from "./EncargadoOT";

const homeByRole = (user) => (user?.rol === "E" ? "/encargado" : "/operario");

function RequireAuth({ children, roles }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.rol)) {
    return <Navigate to={homeByRole(user)} replace />;
  }
  return children;
}

function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={homeByRole(user)} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<Login />} />

      {/* Operario: lista y detalle */}
      <Route
        path="/operario"
        element={
          <RequireAuth roles={["O"]}>
            <WorkOrderMobile />
          </RequireAuth>
        }
      />
      <Route
        path="/operario/:id"
        element={
          <RequireAuth roles={["O"]}>
            <WorkOrderMobile />
          </RequireAuth>
        }
      />

      {/* Encargado: panel y vista de OT en solo lectura */}
      <Route
        path="/encargado"
        element={
          <RequireAuth roles={["E"]}>
            <Encargado />
          </RequireAuth>
        }
      />
      <Route
        path="/encargado/ot/:id"
        element={
          <RequireAuth roles={["E"]}>
            <EncargadoOT />
          </RequireAuth>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}


