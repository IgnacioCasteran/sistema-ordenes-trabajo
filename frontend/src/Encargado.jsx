// src/Encargado.jsx
import {
  useEffect,
  useMemo,
  useState,
  memo,
  useCallback,
  startTransition,
} from "react";
import { Link } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { api } from "./services/api";

// 👉 SweetAlert2
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

const cx = {
  page: "min-h-screen bg-white text-neutral-900",
  wrap: "mx-auto max-w-md px-3 pb-24",
  h1: "text-xl font-extrabold tracking-tight",
  meta: "text-sm text-neutral-600",
  card: "rounded-3xl border shadow-sm bg-white",
  pad: "p-4 sm:p-5",
  groupTitle: "text-xs font-bold tracking-wider text-neutral-700 uppercase",
  row: "grid grid-cols-1 gap-3",
  pill: "rounded-xl border px-3 py-2 text-sm font-semibold",
  bigBtn: "rounded-2xl px-3 py-3 text-sm sm:text-base font-bold tracking-tight",
  listItem:
    "flex items-start justify-between gap-3 rounded-2xl border p-3 hover:bg-neutral-50",
  tag: "inline-flex items-center gap-1 rounded-full text-xs px-2 py-1 border",
};

const LAST_OPERARIO_KEY = "le_last_operario_id";
const OPERS_CACHE_KEY = "opers_cache_v1";
const OPERS_TTL_MS = 5 * 60 * 1000; // 5 minutos

// ---------- SweetAlert helpers ----------
const showLoading = (title = "Cargando…", html = "") =>
  Swal.fire({
    title,
    html,
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: () => {
      Swal.showLoading();
    },
  });

const hideLoading = () => Swal.close();

const toast = Swal.mixin({
  toast: true,
  position: "top-end",
  timer: 2500,
  timerProgressBar: true,
  showConfirmButton: false,
});

// Item memoizado (CORREGIDO)
const Item = memo(function Item({ r, actions, extra }) {
  // Limpia espacios del servicio si viene con padding
  const servicioNombre =
    (r.servicio ?? r.Servicio ?? r.servicio_nombre ?? "").trim() ||
    `Serv ${r.idServicio ?? r.idservicio ?? "—"}`;

  return (
    <div className={cx.listItem}>
      <div className="min-w-0">
        <div className="font-bold leading-tight">
          #{String(r.id).padStart(4, "0")} · {servicioNombre}
        </div>

        <div className="text-sm text-neutral-600 truncate">
          Campo: {r.campo ?? r.campo_nombre ?? "—"} · Fecha: {r.fecha ?? "—"}
        </div>

        {r.nota ? (
          <div className="mt-1 text-xs text-neutral-700 italic line-clamp-2">
            {r.nota}
          </div>
        ) : null}

        {extra}
      </div>

      <div className="flex flex-col gap-2 shrink-0">{actions}</div>
    </div>
  );
});


export default function Encargado() {
  const { user, logout } = useAuth();

  const [tab, setTab] = useState("e1");
  const [loading, setLoading] = useState(false); // SOLO controla el botón Actualizar
  const [errorMsg, setErrorMsg] = useState("");
  const [rows, setRows] = useState([]);
  const [hasLoaded, setHasLoaded] = useState(false); // para evitar "sin pendientes" en la primer nada

  const [actionId, setActionId] = useState(null);

  // Operarios
  const [opers, setOpers] = useState([]);
  const [opersLoading, setOpersLoading] = useState(false);

  // Panel inline de asignación
  const [assignOpenId, setAssignOpenId] = useState(null);
  const [assignOperarioId, setAssignOperarioId] = useState("");

  // ------- Carga de recetas (SIN SweetAlert y SIN tocar el botón) -------
  async function load() {
    setErrorMsg("");
    const t0 = performance.now();
    let mounted = true;

    try {
      const data = await api.getRecetas();
      const list = Array.isArray(data) ? data : data?.data || [];
      if (!mounted) return;
      startTransition(() => setRows(list));
      toast.fire({ icon: "success", title: "Recetas actualizadas" });
    } catch (e) {
      if (!mounted) return;
      setErrorMsg(e.message || "No se pudieron cargar las recetas.");
      Swal.fire({
        icon: "error",
        title: "Error",
        text: e.message || "No se pudieron cargar las recetas.",
      });
    } finally {
      if (!mounted) return;
      const t1 = performance.now();
      console.info(`[timing] getRecetas net=${((t1 - t0) / 1000).toFixed(2)}s`);
      setHasLoaded(true);
    }

    return () => {
      mounted = false;
    };
  }

  // ------- Carga de operarios (SIN SweetAlert de loading) -------
  async function loadOperarios() {
    setOpersLoading(true);
    const t0 = performance.now();

    try {
      // Cache local con TTL
      const cached = localStorage.getItem(OPERS_CACHE_KEY);
      if (cached) {
        try {
          const { at, data } = JSON.parse(cached);
          if (Array.isArray(data) && Date.now() - at < OPERS_TTL_MS) {
            setOpers(data);
            console.info("[cache] operarios: hit");
            setOpersLoading(false);
            return;
          }
        } catch {
          // cache corrupto: ignorar
        }
      }

      const list = await api.getOperarios(); // [{id, name, email}]
      startTransition(() => setOpers(list));
      localStorage.setItem(
        OPERS_CACHE_KEY,
        JSON.stringify({ at: Date.now(), data: list })
      );
      console.info("[cache] operarios: refreshed");
    } catch (e) {
      setErrorMsg((prev) => prev || "No se pudieron cargar los operarios.");
      Swal.fire({
        icon: "error",
        title: "Error",
        text: e.message || "No se pudieron cargar los operarios.",
      });
    } finally {
      setOpersLoading(false);
      const t1 = performance.now();
      console.info(
        `[timing] getOperarios net=${((t1 - t0) / 1000).toFixed(2)}s`
      );
    }
  }

  // ------- Wrapper con SweetAlert PARA LA PRIMER ENTRADA -------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      showLoading("Cargando recetas…");
      try {
        await Promise.all([load(), loadOperarios()]);
      } finally {
        if (!cancelled) hideLoading();
      }
    })();
    return () => {
      cancelled = true;
      hideLoading();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------- Handler para el botón Actualizar (SweetAlert + loading del botón) -------
  async function handleRefresh() {
    setLoading(true);
    showLoading("Cargando recetas…");
    try {
      await load();
    } finally {
      setLoading(false);
      hideLoading();
    }
  }

  // Agrupación estados
  const { e1, e2, e3 } = useMemo(() => {
    const g = { e1: [], e2: [], e3: [] };
    for (const r of rows) {
      const st = Number(r.estado);
      if (st === 1) g.e1.push(r);
      else if (st === 2) g.e2.push(r);
      else if (st === 3) g.e3.push(r);
    }
    return g;
  }, [rows]);

  // Dada una receta, deduce operario
  function getOperarioInfo(r) {
    const opId =
      r.idOperario ??
      r.id_operario ??
      r.operario_id ??
      r.operarioId ??
      r.id_operario_asignado ??
      null;

    const apiName = r.operario_nombre ?? r.operarioName ?? null;
    if (apiName) return { id: opId ?? "", name: apiName };

    const op = opers.find((o) => String(o.id) === String(opId));
    return { id: opId ?? "", name: op?.name ?? "" };
  }

  const openAssignFor = useCallback(
    (recetaId) => {
      setAssignOpenId(recetaId);
      const last = localStorage.getItem(LAST_OPERARIO_KEY);
      if (last && opers.some((o) => String(o.id) === String(last))) {
        setAssignOperarioId(String(last));
      } else if (opers.length > 0) {
        setAssignOperarioId(String(opers[0].id));
      } else {
        setAssignOperarioId("");
      }
    },
    [opers]
  );

  async function handleAsignarConfirm(r) {
    if (!assignOperarioId) {
      Swal.fire({ icon: "info", title: "Elegí un operario" });
      return;
    }
    const conf = await Swal.fire({
      title: "¿Asignar receta al operario?",
      html: `#${String(r.id).padStart(
        4,
        "0"
      )} será asignada al operario seleccionado.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, asignar",
      cancelButtonText: "Cancelar",
    });
    if (!conf.isConfirmed) return;

    const tAll0 = performance.now();
    showLoading("Asignando receta…", "Por favor, esperá");
    try {
      setLoading(true);
      setErrorMsg("");

      const inicio = performance.now();
      const resp = await api.asignarRecetaOperario({
        id_receta: r.id,
        id_operario: Number(assignOperarioId),
      });
      const fin = performance.now();
      const netSeg = ((fin - inicio) / 1000).toFixed(2);
      console.info(
        `[timing] asignarRecetaOperario id_receta=${r.id} net=${netSeg}s`
      );

      if (resp?.ok === true || resp === true) {
        localStorage.setItem(LAST_OPERARIO_KEY, String(assignOperarioId));

        const op = opers.find((o) => String(o.id) === String(assignOperarioId));
        startTransition(() =>
          setRows((prev) =>
            prev.map((x) =>
              x.id === r.id
                ? {
                  ...x,
                  estado: 2,
                  id_operario: Number(assignOperarioId),
                  operario_nombre: op?.name || x.operario_nombre || "",
                }
                : x
            )
          )
        );

        setAssignOpenId(null);
        setAssignOperarioId("");

        hideLoading();
        await Swal.fire({
          icon: "success",
          title: "Asignada",
          text: `La receta #${String(r.id).padStart(4, "0")} fue asignada.`,
        });
      } else {
        throw new Error("La API no confirmó la asignación.");
      }
    } catch (e) {
      hideLoading();
      Swal.fire({
        icon: "error",
        title: "Error",
        text: e.message || "No se pudo asignar la receta.",
      });
      setErrorMsg(e.message || "No se pudo asignar la receta.");
    } finally {
      setLoading(false);
      const tAll1 = performance.now();
      const e2eSeg = ((tAll1 - tAll0) / 1000).toFixed(2);
      console.info(
        `[timing] asignarRecetaOperario:E2E id_receta=${r.id} total=${e2eSeg}s`
      );
    }
  }
  // Utilidades de chequeo (modo operario: campos _o)
  async function checkRecetaCompleta(
    recetaId,
    options = { zeroAsEmpty: false }
  ) {
    const payload = await api.getReceta(recetaId);
    const D = payload?.data || {};
    const rw = D.receta_web || {};
    const lw = Array.isArray(D.receta_lotes_web) ? D.receta_lotes_web : [];
    const iw = Array.isArray(D.receta_insumos_web) ? D.receta_insumos_web : [];

    const faltas = [];
    const isEmpty = (v) =>
      v == null || v === "" || (options.zeroAsEmpty && (v === 0 || v === "0"));

    const req = [
      ["fecha_inicio", rw.fecha_inicio],
      ["fecha_fin", rw.fecha_fin],
      ["tasa_aplicacion", rw.tasa_aplicacion],
      ["recargas", rw.recargas],
      ["humedad", rw.humedad],
      ["viento_velocidad", rw.viento_velocidad],
      ["viento_direccion", rw.viento_direccion],
      ["rocio", rw.rocio],
      ["temperatura", rw.temperatura],
      ["nublado", rw.nublado],
      ["observaciones_o", rw.observaciones_o],
    ];
    for (const [k, v] of req) if (isEmpty(v)) faltas.push(k);

    const lotesNull = lw.filter((x) => isEmpty(x.hectareas_o)).map((x) => x.id);
    const insNull = iw.filter((x) => isEmpty(x.cantidad_o)).map((x) => x.id);

    if (lotesNull.length)
      faltas.push(`lotes sin hectareas_o (ids web: ${lotesNull.join(", ")})`);
    if (insNull.length)
      faltas.push(`insumos sin cantidad_o (ids web: ${insNull.join(", ")})`);

    return { faltas, D, rw, lw, iw };
  }

  // Copia automática O → E (lotes, insumos, observaciones)
  async function ensureEncargadoCompleto(recetaId) {
    const payload = await api.getReceta(recetaId);
    const D = payload?.data || {};
    const rw = D.receta_web || {};
    const lw = Array.isArray(D.receta_lotes_web) ? D.receta_lotes_web : [];
    const iw = Array.isArray(D.receta_insumos_web) ? D.receta_insumos_web : [];

    const toFillLotes = lw
      .filter(
        (x) =>
          (x.hectareas_e == null || x.hectareas_e === "") &&
          x.hectareas_o != null
      )
      .map((x) => ({ id: x.id, hectareas_e: Number(x.hectareas_o) }));
    if (toFillLotes.length) await api.recetaLotesWebGuardar(toFillLotes);

    const toFillInsumos = iw
      .filter(
        (x) =>
          (x.cantidad_e == null || x.cantidad_e === "") && x.cantidad_o != null
      )
      .map((x) => ({ id: x.id, cantidad_e: Number(x.cantidad_o) }));
    if (toFillInsumos.length) await api.recetaInsumosWebGuardar(toFillInsumos);

    if (rw?.id) {
      const obsE = rw.observaciones_e ?? "";
      const obsO = rw.observaciones_o ?? "";
      if (!obsE && obsO) {
        await api.recetaWebGuardar({ id: rw.id, observaciones_e: obsO });
      }
    }
  }

  // Chequeo rápido modo encargado: observaciones_e + _e
  async function checkEncargadoCompleto(recetaId) {
    const payload = await api.getReceta(recetaId);
    const D = payload?.data || {};
    const rw = D.receta_web || {};
    const lw = Array.isArray(D.receta_lotes_web) ? D.receta_lotes_web : [];
    const iw = Array.isArray(D.receta_insumos_web) ? D.receta_insumos_web : [];

    const faltasE = [];
    if (!rw?.observaciones_e) faltasE.push("observaciones_e");

    const lotesFaltan = lw
      .filter((x) => x.hectareas_e == null)
      .map((x) => x.id);
    if (lotesFaltan.length)
      faltasE.push(
        `lotes sin hectareas_e (ids web: ${lotesFaltan.join(", ")})`
      );

    const insFaltan = iw.filter((x) => x.cantidad_e == null).map((x) => x.id);
    if (insFaltan.length)
      faltasE.push(`insumos sin cantidad_e (ids web: ${insFaltan.join(", ")})`);

    return { faltasE, rw, lw, iw };
  }

  // Handlers
  async function handleAprobar(r) {
    const conf = await Swal.fire({
      title: "¿Aprobar y enviar a SIGECOM?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, aprobar",
      cancelButtonText: "Cancelar",
    });
    if (!conf.isConfirmed) return;

    showLoading("Enviando a SIGECOM…", "Validando y preparando datos");
    try {
      setActionId(r.id);
      setErrorMsg("");

      await ensureEncargadoCompleto(r.id);

      const local = await checkRecetaCompleta(r.id, { zeroAsEmpty: false });
      if (local.faltas.length) {
        hideLoading();
        await Swal.fire({
          icon: "warning",
          title: "Faltan datos del operario",
          html: "Debés completar:<br>• " + local.faltas.join("<br>• "),
        });
        return;
      }

      const enc = await checkEncargadoCompleto(r.id);
      if (enc.faltasE.length) {
        hideLoading();
        await Swal.fire({
          icon: "warning",
          title: "Faltan datos del encargado",
          html: "Debés completar:<br>• " + enc.faltasE.join("<br>• "),
        });
        return;
      }

      const resp = await api.recetaEnviarSigecom(Number(r.id));
      if (!resp?.ok) {
        const msg =
          resp?.msg || "El servidor indica que la receta no está completa.";
        throw new Error(msg);
      }

      startTransition(() =>
        setRows((prev) =>
          prev.map((x) => (x.id === r.id ? { ...x, estado: 4 } : x))
        )
      );

      hideLoading();
      await Swal.fire({
        icon: "success",
        title: "Aprobada",
        text: "Enviada a SIGECOM correctamente.",
      });
      await load();
    } catch (e) {
      hideLoading();
      console.error("❌ Error en handleAprobar:", e);
      setErrorMsg(e?.message || "Error al aprobar.");
      Swal.fire({
        icon: "error",
        title: "Error",
        text: e?.message || "Error al aprobar.",
      });
    } finally {
      setActionId(null);
    }
  }

  async function handleVolverA2(r) {
    const razonDlg = await Swal.fire({
      title: "Devolver al operario",
      input: "textarea",
      inputLabel: "Observación del Encargado (obligatoria)",
      inputPlaceholder: "Escribí la observación…",
      inputAttributes: { "aria-label": "Observación del Encargado" },
      inputValidator: (value) => {
        if (!value || !value.trim()) return "Debés ingresar una observación.";
        if (value.trim().length < 3) return "Demasiado corta.";
        return undefined;
      },
      showCancelButton: true,
      confirmButtonText: "Devolver",
      cancelButtonText: "Cancelar",
    });
    if (!razonDlg.isConfirmed) return;
    const razon = razonDlg.value.trim();

    showLoading("Devolviendo a operario…");
    try {
      setActionId(r.id);
      setErrorMsg("");

      const det = await api.getReceta(r.id);
      const rw = det?.data?.receta_web;
      if (rw?.id) {
        await api.recetaWebGuardar({
          id: rw.id,
          observaciones_e: razon,
        });
      }

      const resp = await api.recetaDevolverOperario(Number(r.id));
      if (!resp?.ok) throw new Error(resp?.msg || "No se pudo devolver.");

      startTransition(() =>
        setRows((prev) =>
          prev.map((x) => (x.id === r.id ? { ...x, estado: 2 } : x))
        )
      );

      hideLoading();
      await Swal.fire({
        icon: "success",
        title: "Devuelta",
        text: "La receta volvió al estado 2 (operario).",
      });
      await load();
    } catch (e) {
      hideLoading();
      console.error("❌ Error en handleVolverA2:", e);
      setErrorMsg(e?.message || "Error al devolver.");
      Swal.fire({
        icon: "error",
        title: "Error",
        text: e?.message || "Error al devolver.",
      });
    } finally {
      setActionId(null);
    }
  }

  async function handleCancelarAsignacion(r) {
    const conf = await Swal.fire({
      title: "¿Volver a pendientes?",
      html: `Se cancelará la asignación de la receta <b>#${String(
        r.id
      ).padStart(4, "0")}</b> al operario actual.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, volver a pendientes",
      cancelButtonText: "Cancelar",
    });
    if (!conf.isConfirmed) return;

    showLoading("Cancelando asignación…");
    try {
      setActionId(r.id);

      const resp = await api.recetaCancelarAsignarOperario(Number(r.id));
      if (!resp?.ok)
        throw new Error(resp?.msg || "No se pudo cancelar la asignación.");

      // Estado optimista: pasa a 1 y limpiamos el operario mostrado
      startTransition(() =>
        setRows((prev) =>
          prev.map((x) =>
            x.id === r.id
              ? {
                ...x,
                estado: 1,
                id_operario: null,
                operario_nombre: "",
                idOperario: null,
                operarioId: null,
              }
              : x
          )
        )
      );

      hideLoading();
      await Swal.fire({
        icon: "success",
        title: "Volvió a pendientes",
        text: "La asignación fue cancelada correctamente.",
      });

      // opcional: refrescar del server
      await load();
    } catch (e) {
      hideLoading();
      console.error("❌ Error en handleCancelarAsignacion:", e);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: e?.message || "No se pudo cancelar la asignación.",
      });
    } finally {
      setActionId(null);
    }
  }

  const renderTab = () => {
    if (tab === "e1") {
      return (
        <section className={`${cx.card} ${cx.pad} space-y-3`}>
          <div className={cx.groupTitle}>Pendientes a asignar (Estado 1)</div>
          {!hasLoaded ? (
            // 👇 mientras todavía no terminó la primer carga, no mostramos nada
            <div className="text-sm text-neutral-600">&nbsp;</div>
          ) : e1.length === 0 ? (
            <div className="text-sm text-neutral-600">(Sin pendientes)</div>
          ) : (
            <div className={cx.row}>
              {e1.map((r) => {
                const isOpen = assignOpenId === r.id;
                return (
                  <Item
                    key={r.id}
                    r={r}
                    actions={
                      isOpen ? (
                        <>
                          <button
                            className={`${cx.pill} bg-black text-white`}
                            onClick={() => handleAsignarConfirm(r)}
                            disabled={loading || opersLoading || !assignOperarioId}
                          >
                            Confirmar
                          </button>
                          <button
                            className={cx.pill}
                            onClick={() => {
                              setAssignOpenId(null);
                              setAssignOperarioId("");
                            }}
                            disabled={loading}
                          >
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <>
                          {/* NUEVO: Ver OT también en Pendientes */}
                          <Link
                            className={cx.pill}
                            to={`/encargado/ot/${r.id}`}
                            title="Ver OT"
                            onClick={() => {
                              sessionStorage.setItem("ot-loading", "1");
                            }}
                          >
                            Ver OT  📄
                          </Link>

                          <button
                            className={cx.pill}
                            onClick={() => openAssignFor(r.id)}
                          >
                            Asignar a operario
                          </button>
                        </>
                      )
                    }
                    extra={
                      isOpen && (
                        <div className="mt-2 flex items-center gap-2">
                          <label className="text-xs text-neutral-700 shrink-0">
                            Operario
                          </label>
                          <select
                            className="rounded-lg border px-2 py-1 text-sm"
                            value={assignOperarioId}
                            onChange={(e) => setAssignOperarioId(e.target.value)}
                            disabled={opersLoading}
                          >
                            {opersLoading && <option>Cargando…</option>}
                            {!opersLoading && opers.length === 0 && (
                              <option value="">(Sin operarios)</option>
                            )}
                            {!opersLoading &&
                              opers.map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.name} · #{o.id}
                                </option>
                              ))}
                          </select>
                        </div>
                      )
                    }
                  />
                );
              })}
            </div>
          )}
        </section>
      );
    }

    if (tab === "e2") {
      return (
        <section className={`${cx.card} ${cx.pad} space-y-3`}>
          <div className={cx.groupTitle}>Enviadas a operarios (Estado 2)</div>
          {e2.length === 0 ? (
            <div className="text-sm text-neutral-600">
              (Sin recetas en curso)
            </div>
          ) : (
            <div className={cx.row}>
              {e2.map((r) => {
                const { name: opName } = getOperarioInfo(r);
                return (
                  <Item
                    key={r.id}
                    r={r}
                    extra={
                      <div className="mt-2">
                        <span className={cx.tag}>
                          👷‍♂️ Asignada a: <b className="ml-1">{opName || "—"}</b>
                        </span>
                      </div>
                    }
                    actions={
                      <>
                        <Link
                          className={cx.pill}
                          to={`/encargado/ot/${r.id}`}
                          title="Ver OT"
                          onClick={() => {
                            sessionStorage.setItem("ot-loading", "1");
                          }}
                        >
                          Ver OT 📄
                        </Link>

                        {/* 👇 NUEVO: botón debajo de Ver OT */}
                        <button
                          className={`${cx.pill} border-amber-600 text-amber-700`}
                          onClick={() => handleCancelarAsignacion(r)}
                          disabled={actionId === r.id}
                          title="Cancelar asignación y volver a Estado 1 (pendientes)"
                        >
                          {actionId === r.id ? "Procesando..." : "↩️ Volver "}
                        </button>
                      </>
                    }
                  />
                );
              })}
            </div>
          )}
        </section>
      );
    }

    // e3 (COMPLETADAS) → muestra operario y permite VER OT
    return (
      <section className={`${cx.card} ${cx.pad} space-y-3`}>
        <div className={cx.groupTitle}>Completadas por operario (Estado 3)</div>
        {e3.length === 0 ? (
          <div className="text-sm text-neutral-600">(Sin completadas)</div>
        ) : (
          <div className={cx.row}>
            {e3.map((r) => {
              const { name: opName } = getOperarioInfo(r);
              return (
                <Item
                  key={r.id}
                  r={r}
                  extra={
                    <div className="mt-2">
                      <span className={cx.tag}>
                        👷‍♂️ Enviado por: <b className="ml-1">{opName || "—"}</b>
                      </span>
                    </div>
                  }
                  actions={
                    <>
                      <Link
                        className={cx.pill}
                        to={`/encargado/ot/${r.id}`}
                        title="Ver OT"
                        onClick={() => {
                          sessionStorage.setItem("ot-loading", "1");
                        }}
                      >
                        Ver OT 📄
                      </Link>

                      <button
                        className={`${cx.pill} border-green-600 text-green-700`}
                        onClick={() => handleAprobar(r)}
                        disabled={actionId === r.id}
                        title="Enviar a SIGECOM (estado 4)"
                      >
                        {actionId === r.id ? "Enviando..." : "✅ Aprobar"}
                      </button>
                      <button
                        className={`${cx.pill} border-amber-600 text-amber-700`}
                        onClick={() => handleVolverA2(r)}
                        disabled={actionId === r.id}
                        title="Devolver al operario (estado 2)"
                      >
                        {actionId === r.id ? "Procesando..." : "🔁 Devolver"}
                      </button>
                    </>
                  }
                />
              );
            })}
          </div>
        )}
      </section>
    );
  };

    return (
    <div className={cx.page}>
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b">
        <div className="mx-auto max-w-md px-3 py-4 flex items-center justify-between gap-3">
          <div>
            <div className={cx.h1}>Panel de Encargado</div>
            <div className={cx.meta}>
              {user ? (
                <>
                  Sesión: <b>{user.name}</b> ({user.email})
                </>
              ) : (
                "—"
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              className={cx.pill}
              onClick={handleRefresh}
              disabled={loading}
            >
              {loading ? "Actualizando…" : "Actualizar"}
            </button>
            <button
              className={cx.pill}
              onClick={async () => {
                const c = await Swal.fire({
                  title: "¿Cerrar sesión?",
                  icon: "question",
                  showCancelButton: true,
                  confirmButtonText: "Sí, salir",
                  cancelButtonText: "Cancelar",
                });
                if (!c.isConfirmed) return;
                showLoading("Cerrando sesión…");
                try {
                  await logout();
                } finally {
                  hideLoading();
                }
              }}
              title="Cerrar sesión"
            >
              Salir
            </button>
          </div>
        </div>

        <nav className="mx-auto max-w-md px-3 pb-3 grid grid-cols-3 gap-2">
          {[
            { k: "e1", t: "Pendientes" },
            { k: "e2", t: "En curso" },
            { k: "e3", t: "Completadas" },
          ].map((b) => (
            <button
              key={b.k}
              className={`${cx.bigBtn} border ${
                tab === b.k
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white"
              }`}
              onClick={() => setTab(b.k)}
              aria-pressed={tab === b.k}
            >
              {b.t}
            </button>
          ))}
        </nav>
      </header>

      <main className={cx.wrap}>
        {errorMsg ? (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMsg}
          </div>
        ) : null}

        {renderTab()}
      </main>
    </div>
  );
}