// src/EncargadoOT.jsx
import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "./services/api";
import { useAuth } from "./context/AuthContext";
import { EOChip } from "./ui/EOChip";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

// ---------- helpers SweetAlert ----------
const showLoading = (title = "Cargando…", html = "") =>
  Swal.fire({
    title,
    html,
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: () => Swal.showLoading(),
  });
const hideLoading = () => Swal.close();

// ---------- UI ----------
const LoadingOverlay = ({ show, text = "Cargando…" }) =>
  show ? (
    <div className="fixed inset-0 z-[9999] grid place-items-center bg-white/95 backdrop-blur">
      <div className="flex flex-col items-center gap-3">
        <svg
          className="animate-spin h-8 w-8"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          />
        </svg>
        <p className="text-sm text-neutral-700">{text}</p>
      </div>
    </div>
  ) : null;

const cx = {
  page: "min-h-screen bg-white text-neutral-900",
  wrap: "mx-auto max-w-md px-3 pb-24",
  h1: "text-xl font-extrabold tracking-tight",
  meta: "text-sm text-neutral-600",
  card: "rounded-3xl border shadow-sm bg-white overflow-hidden",
  pad: "p-4 sm:p-5",
  groupTitle: "text-xs font-bold tracking-wider text-neutral-700 uppercase",
  pill: "rounded-xl border px-3 py-2 text-sm font-semibold",
  k: "text-sm font-semibold text-neutral-700",
  v: "text-sm text-neutral-800",
  input:
    "mt-1 w-full rounded-xl border px-3 py-2 outline-none focus-visible:ring-4 focus-visible:ring-blue-500/30",
};

const dmy = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "—";
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
};

const toNum = (v) => {
  if (v === "" || v == null) return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

// ✅ permite escribir tanto "." como "," (y solo un separador decimal)
const normalizeDecimalInput = (raw) => {
  let s = String(raw ?? "");

  // permitir solo dígitos, coma, punto y signo menos
  s = s.replace(/[^\d,.\-]/g, "");

  // solo un "-" al inicio
  s = s.replace(/(?!^)-/g, "");

  // convertir puntos a coma (para que el usuario vea coma)
  s = s.replace(/\./g, ",");

  // dejar una sola coma
  const firstComma = s.indexOf(",");
  if (firstComma !== -1) {
    s =
      s.slice(0, firstComma + 1) +
      s
        .slice(firstComma + 1)
        .replace(/,/g, ""); // sacar comas extra
  }

  return s;
};

export default function EncargadoOT() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [D, setD] = useState(null);

  const r = useMemo(() => D?.receta || {}, [D]);
  const rw = useMemo(() => D?.receta_web || {}, [D]);
  const lotesW = useMemo(() => D?.receta_lotes_web || [], [D]);
  const insW = useMemo(() => D?.receta_insumos_web || [], [D]);
  const lotes = useMemo(() => D?.receta_lotes || [], [D]);
  const insumos = useMemo(() => D?.receta_insumos || [], [D]);

  const estado = useMemo(() => Number(r?.estado ?? 0), [r]);
  const mostrarAcciones = estado === 3;
  const esSoloLectura = estado !== 3; // 1=pendiente, 2=en curso -> solo lectura

  const mapLw = useMemo(
    () => new Map(lotesW.map((x) => [String(x.idRecetaLote), x])),
    [lotesW]
  );
  const mapIw = useMemo(
    () => new Map(insW.map((x) => [String(x.idRecetaInsumo), x])),
    [insW]
  );

  const [obsE, setObsE] = useState("");
  const [eLotes, setELotes] = useState([]); // [{idWeb, e}]
  const [eInsumos, setEInsumos] = useState([]); // [{idWeb, e}]

  // ===== Etiquetas activas del servicio =====
  const [servicioInfo, setServicioInfo] = useState({
    idServicio: null,
    nombreServicio: "",
    activeFields: [],
    loaded: false,
  });

  const activeSet = useMemo(
    () => new Set(servicioInfo.activeFields || []),
    [servicioInfo.activeFields]
  );

  const isActive = (campo) => {
    if (!servicioInfo.loaded) return true; // mientras carga: no ocultes
    return activeSet.has(campo);
  };

  // ---------- Carga ----------
  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setErr("");

    (async () => {
      try {
        const payload = await api.getReceta(id, { signal: ac.signal });
        const data = payload?.data || {};
        setD(data);

        // precarga inputs
        setObsE(data?.receta_web?.observaciones_e ?? "");
        setELotes(
          (data?.receta_lotes_web || []).map((x) => ({
            idWeb: x.id,
            e: x.hectareas_e != null ? String(x.hectareas_e) : "",
          }))
        );
        setEInsumos(
          (data?.receta_insumos_web || []).map((x) => ({
            idWeb: x.id,
            e: x.cantidad_e != null ? String(x.cantidad_e) : "",
          }))
        );

        // ===== traer etiquetas activas del servicio (para ocultar campos) =====
        const idServicio =
          Number(
            data?.receta?.idServicio ??
              data?.receta?.idservicio ??
              data?.receta?.id_servicio ??
              0
          ) || null;

        if (idServicio && api?.servicioEtiquetasActivas) {
          try {
            const resp = await api.servicioEtiquetasActivas(idServicio);
            const list = Array.isArray(resp) ? resp : resp?.data || [];
            const fields = (list || [])
              .map((x) => String(x.campo_recetas_web || "").trim())
              .filter(Boolean);

            setServicioInfo({
              idServicio,
              nombreServicio: String(list?.[0]?.nombreServicio || "").trim(),
              activeFields: fields,
              loaded: true,
            });
          } catch {
            // si falla, no escondemos nada
            setServicioInfo({
              idServicio,
              nombreServicio: "",
              activeFields: [],
              loaded: true,
            });
          }
        } else {
          setServicioInfo({
            idServicio,
            nombreServicio: "",
            activeFields: [],
            loaded: true,
          });
        }
      } catch (e) {
        if (e?.name !== "AbortError") {
          setErr(e?.message || "No se pudo cargar la OT.");
          await Swal.fire({
            icon: "error",
            title: "Error",
            text: e?.message || "No se pudo cargar la OT.",
          });
        }
      } finally {
        setLoading(false);
        sessionStorage.removeItem("ot-loading");
      }
    })();

    return () => ac.abort();
  }, [id]);

  // edición (solo se usan si estado === 3 porque ahí se muestran los inputs)
  const changeELote = (recetaLoteId, val) => {
    const lw = mapLw.get(String(recetaLoteId));
    if (!lw?.id) return;
    setELotes((curr) => {
      const x = [...curr];
      const i = x.findIndex((it) => it.idWeb === lw.id);
      if (i >= 0) x[i] = { ...x[i], e: val };
      else x.push({ idWeb: lw.id, e: val });
      return x;
    });
  };

  const changeEInsumo = (recetaInsumoId, val) => {
    const iw = mapIw.get(String(recetaInsumoId));
    if (!iw?.id) return;
    setEInsumos((curr) => {
      const x = [...curr];
      const i = x.findIndex((it) => it.idWeb === iw.id);
      if (i >= 0) x[i] = { ...x[i], e: val };
      else x.push({ idWeb: iw.id, e: val });
      return x;
    });
  };

  // Observaciones Encargado (opcional)
  async function saveObservacionesE(nextText) {
    const recWebId = rw?.id;
    if (!recWebId) return;

    const raw = (nextText ?? obsE ?? "").trim();
    const hadPrev = Boolean(
      rw?.observaciones_e && String(rw.observaciones_e).trim() !== ""
    );

    const payload = { id: recWebId };
    if (raw) payload.observaciones_e = raw;
    else if (hadPrev) payload.observaciones_e = null;
    else return;

    const resp = await api.recetaWebGuardar(payload);
    if (!(resp?.ok === true || resp === true)) {
      throw new Error(resp?.msg || "No se pudo guardar observaciones.");
    }
  }

  async function saveLotesE() {
    const items = eLotes.map(({ idWeb, e }) => ({
      id: idWeb,
      hectareas_e: toNum(e) ?? 0,
    }));

    if (items.some((it) => !it.id))
      throw new Error("Hay lotes sin ID web; recargá e intentá nuevamente.");

    if (items.length) {
      const resp = await api.recetaLotesWebGuardar(items);
      if (!(resp?.ok === true || resp === true))
        throw new Error(resp?.msg || "No se pudieron guardar lotes.");
    }
  }

  // Insumos (solo cantidades E). Tasa/Recargas son SOLO lectura.
  async function saveInsumosE() {
    const { receta } = D;
    const items = eInsumos.map(({ idWeb, e }) => ({
      id: idWeb,
      cantidad_e: toNum(e) ?? 0,
    }));

    if (items.some((it) => !it.id))
      throw new Error("Hay insumos sin ID web; recargá e intentá nuevamente.");

    if (items.length) {
      const resp = await api.recetaInsumosWebGuardar({
        id_receta: receta.id,
        receta_insumos_web: items,
      });
      if (!(resp?.ok === true || resp === true))
        throw new Error(resp?.msg || "No se pudieron guardar insumos.");
    }
  }

  // ---- acciones ----
  async function guardarE() {
    try {
      setSaving(true);
      showLoading("Guardando…");
      await saveObservacionesE();
      await saveLotesE();
      await saveInsumosE();
      hideLoading();
      await Swal.fire({ icon: "success", title: "Guardado (Encargado) ✓" });
    } catch (e) {
      hideLoading();
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: e?.message || "No se pudo guardar.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function aprobar() {
    const c = await Swal.fire({
      title: "¿Aprobar y enviar a SIGECOM?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, aprobar",
    });
    if (!c.isConfirmed) return;

    try {
      setSaving(true);
      showLoading("Enviando a SIGECOM…");
      await saveObservacionesE();
      await saveLotesE();
      await saveInsumosE();
      const resp = await api.recetaEnviarSigecom(Number(id));
      if (!resp?.ok) throw new Error(resp?.msg || "No se pudo enviar a SIGECOM.");
      hideLoading();
      await Swal.fire({ icon: "success", title: "Enviada a SIGECOM" });
      navigate("/encargado");
    } catch (e) {
      hideLoading();
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: e?.message || "Error al aprobar.",
      });
      setErr(e?.message || "Error al aprobar.");
    } finally {
      setSaving(false);
    }
  }

  async function devolver() {
    const razonDlg = await Swal.fire({
      title: "Devolver al operario",
      input: "textarea",
      inputLabel: "Observación (obligatoria)",
      inputPlaceholder: "Escribí la observación…",
      inputValue: obsE || rw?.observaciones_o || "",
      inputValidator: (v) =>
        !v || !v.trim()
          ? "Debés ingresar una observación."
          : v.trim().length < 3
          ? "Demasiado corta."
          : undefined,
      showCancelButton: true,
      confirmButtonText: "Devolver",
    });
    if (!razonDlg.isConfirmed) return;

    try {
      setSaving(true);
      showLoading("Devolviendo a operario…");
      await saveObservacionesE(razonDlg.value.trim());
      await saveLotesE();
      await saveInsumosE();
      const resp = await api.recetaDevolverOperario(Number(id));
      if (!resp?.ok) throw new Error(resp?.msg || "No se pudo devolver.");
      hideLoading();
      await Swal.fire({ icon: "success", title: "Devuelta al operario (estado 2)" });
      navigate("/encargado");
    } catch (e) {
      hideLoading();
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: e?.message || "Error al devolver.",
      });
      setErr(e?.message || "Error al devolver.");
    } finally {
      setSaving(false);
    }
  }

  const handleBack = () => navigate("/encargado");

  // ---------- RENDER ----------
  return (
    <div className={cx.page}>
      <LoadingOverlay show={loading || !D} text="Cargando OT…" />

      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b">
        <div className="mx-auto max-w-md px-3 py-4 flex items-center justify-between gap-3">
          <div>
            <div className={cx.h1}>
              Orden de Trabajo #{String(id).padStart(4, "0")}
            </div>
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
            <button className={cx.pill} onClick={handleBack}>
              ← Volver
            </button>
          </div>
        </div>
      </header>

      <main className={cx.wrap} aria-busy={loading}>
        {err && (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {err}
          </div>
        )}

        {!loading && D && (
          <>
            {/* Resumen */}
            <section className={`${cx.card} ${cx.pad} space-y-2`}>
              <div className={cx.groupTitle}>Resumen</div>

              <div className="text-sm">
                <span className={cx.k}>Servicio:</span>{" "}
                <span className={cx.v}>
                  {servicioInfo.nombreServicio ||
                    r.servicio ||
                    r.nombreServicio ||
                    r.idServicio ||
                    r.idservicio ||
                    "—"}
                </span>
              </div>

              <div className="text-sm">
                <span className={cx.k}>Campo:</span>{" "}
                <span className={cx.v}>{r.campo ?? r.campo_nombre ?? "—"}</span>
              </div>

              <div className="text-sm">
                <span className={cx.k}>Fecha de emisión:</span>{" "}
                <span className={cx.v}>{dmy(r.fecha)}</span>
              </div>

              {r.nota ? (
                <div className="text-sm">
                  <span className={cx.k}>Importante:</span>{" "}
                  <span className={cx.v}>{r.nota}</span>
                </div>
              ) : null}
            </section>

            {/* Observaciones */}
            <section className={`${cx.card} ${cx.pad} space-y-2`}>
              <div className={cx.groupTitle}>Observaciones</div>
              {rw?.observaciones_o && (
                <div className="text-sm">
                  <span className={cx.k}>Del Operario:</span>{" "}
                  <span className={cx.v}>{rw.observaciones_o}</span>
                </div>
              )}
              <div className="mt-2">
                <label className={cx.k}>Del Encargado (editable)</label>
                <textarea
                  rows={4}
                  className={`${cx.input} resize-y`}
                  value={obsE}
                  onChange={(e) => setObsE(e.target.value)}
                  disabled={esSoloLectura}
                  placeholder={
                    esSoloLectura
                      ? "Solo lectura mientras la OT está pendiente/en curso."
                      : "Escribí tu observación para el operario"
                  }
                />
              </div>
            </section>

            {/* Condiciones (solo lectura) */}
            <section className={`${cx.card} ${cx.pad} space-y-2`}>
              <div className={cx.groupTitle}>Condiciones del trabajo (cargadas)</div>

              {(() => {
                const items = [
                  { key: "fecha_inicio", label: "Inicio", value: dmy(rw?.fecha_inicio), always: true },
                  { key: "fecha_fin", label: "Fin", value: dmy(rw?.fecha_fin), always: true },

                  { key: "humedad", label: "Humedad %", value: rw?.humedad ?? "—" },
                  { key: "viento_velocidad", label: "Viento (km/h)", value: rw?.viento_velocidad ?? "—" },
                  { key: "viento_direccion", label: "Dirección", value: rw?.viento_direccion ?? "—" },
                  {
                    key: "rocio",
                    label: "Rocío",
                    value: rw?.rocio === "S" ? "Sí" : rw?.rocio === "N" ? "No" : "—",
                  },
                  { key: "temperatura", label: "Temp (°C)", value: rw?.temperatura ?? "—" },
                  {
                    key: "nublado",
                    label: "Nublado",
                    value: rw?.nublado === "S" ? "Sí" : rw?.nublado === "N" ? "No" : "—",
                  },

                  { key: "humedad2", label: "Humedad (M/B/MB)", value: rw?.humedad2 ?? "—" },
                  { key: "profundidad", label: "Profundidad (cm)", value: rw?.profundidad ?? "—" },
                  { key: "ancho_trabajo", label: "Ancho (mt)", value: rw?.ancho_trabajo ?? "—" },
                  { key: "rastrojo", label: "Rastrojo", value: rw?.rastrojo ?? "—" },
                ];

                const visible = items.filter((it) => it.always || isActive(it.key));

                return (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {visible.map((it) => (
                      <div key={it.key}>
                        <span className={cx.k}>{it.label}:</span>{" "}
                        <span className={cx.v}>{it.value}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </section>

            {/* Lotes */}
            <section className={`${cx.card} ${cx.pad} space-y-3`}>
              <div className={cx.groupTitle}>Lotes</div>
              <div className="divide-y">
                {lotes.length === 0 ? (
                  <div className="text-sm text-neutral-600">(Sin lotes)</div>
                ) : (
                  lotes.map((L) => {
                    const LW = mapLw.get(String(L.id));
                    const eVal = eLotes.find((x) => x.idWeb === LW?.id)?.e ?? "";
                    const chipE =
                      eVal !== ""
                        ? eVal
                        : LW?.hectareas_e != null
                        ? LW.hectareas_e
                        : null;

                    return (
                      <div key={L.id} className="py-2">
                        <div className="font-semibold">
                          {`Lote ${L.lote ?? L.idRotacionLote ?? "—"} · ${L.cultivo ?? ""}`}
                        </div>
                        <div className="text-sm text-neutral-600">
                          Estimadas: {L.hectareas_estimadas ?? "—"}
                        </div>

                        <div className="mt-1 flex flex-wrap gap-2 text-sm">
                          {chipE != null && <EOChip who="E">{chipE}</EOChip>}
                          {LW?.hectareas_o != null && <EOChip who="O">{LW.hectareas_o}</EOChip>}
                        </div>

                        {!esSoloLectura && LW?.id && (
                          <div className="mt-2">
                            <label className={cx.k}>Has realizadas (Encargado)</label>

                            {/* ✅ CAMBIO: type="text" + normalización coma/punto */}
                            <input
                              className={cx.input}
                              type="text"
                              inputMode="decimal"
                              value={eVal}
                              onChange={(e) =>
                                changeELote(L.id, normalizeDecimalInput(e.target.value))
                              }
                              placeholder="0,00"
                            />
                          </div>
                        )}

                        {!esSoloLectura && !LW?.id && (
                          <div className="mt-2 text-xs text-neutral-600">
                            (Aún sin id web — recargá e intentá nuevamente)
                          </div>
                        )}

                        {L?.observaciones ? (
                          <div className="mt-1 text-sm italic">{L.observaciones}</div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            {/* Insumos */}
            <section className={`${cx.card} ${cx.pad} space-y-3`}>
              <div className={cx.groupTitle}>Tratamiento / Insumos</div>
              <div className="divide-y">
                {insumos.length === 0 ? (
                  <div className="text-sm text-neutral-600">(Sin insumos)</div>
                ) : (
                  insumos.map((I) => {
                    const IW = mapIw.get(String(I.id));
                    const dosis = Number(String(I.dosis ?? 0).replace(",", ".")) || 0;
                    const totalRec =
                      Number(String(I.cantidad_receta ?? 0).replace(",", ".")) || 0;
                    const unidad = I.medida || "UN";
                    const eVal = eInsumos.find((x) => x.idWeb === IW?.id)?.e ?? "";
                    const chipE =
                      eVal !== ""
                        ? eVal
                        : IW?.cantidad_e != null
                        ? IW.cantidad_e
                        : null;

                    return (
                      <div key={I.id} className="py-2">
                        <div className="font-semibold">{I.nombre_insumo || "—"}</div>
                        <div className="text-sm text-neutral-700">
                          Dosis: <b>{dosis}</b> {unidad}/Ha · Total recetado:{" "}
                          <b>
                            {totalRec} {unidad}
                          </b>
                        </div>

                        <div className="mt-1 flex flex-wrap gap-2 text-sm">
                          {chipE != null && (
                            <EOChip who="E">
                              {chipE} {unidad}
                            </EOChip>
                          )}
                          {IW?.cantidad_o != null && (
                            <EOChip who="O">
                              {IW.cantidad_o} {unidad}
                            </EOChip>
                          )}
                        </div>

                        {!esSoloLectura && IW?.id && (
                          <div className="mt-2">
                            <label className={cx.k}>
                              Total utilizado (Encargado) — {unidad}
                            </label>

                            {/* ✅ CAMBIO: type="text" + normalización coma/punto */}
                            <input
                              className={cx.input}
                              type="text"
                              inputMode="decimal"
                              value={eVal}
                              onChange={(e) =>
                                changeEInsumo(I.id, normalizeDecimalInput(e.target.value))
                              }
                              placeholder="0,00"
                            />
                          </div>
                        )}

                        {!esSoloLectura && !IW?.id && (
                          <div className="mt-2 text-xs text-neutral-600">
                            (Aún sin id web — recargá e intentá nuevamente)
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Parámetros del trabajo — SOLO LECTURA (filtrados por etiquetas activas) */}
              {(() => {
                const params = [
                  {
                    key: "tasa_aplicacion",
                    label: "Tasa de aplicación (L/Ha)",
                    value: rw?.tasa_aplicacion ?? "—",
                  },
                  {
                    key: "recargas",
                    label: "Cantidad de recargas",
                    value: rw?.recargas ?? "—",
                  },
                ];

                const visible = params.filter((p) => isActive(p.key));
                if (visible.length === 0) return null;

                return (
                  <div className="mt-3 border-t pt-3 text-sm space-y-1">
                    {visible.map((p) => (
                      <div key={p.key}>
                        <span className={cx.k}>{p.label}:</span>{" "}
                        <span className={cx.v}>{p.value}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </section>

            {/* Acciones (solo estado 3) */}
            {mostrarAcciones && (
              <div className="mt-4 grid grid-cols-1 gap-2">
                <button
                  className={`${cx.pill} bg-white`}
                  onClick={guardarE}
                  disabled={saving || loading}
                >
                  💾 Guardar (E)
                </button>
                <button
                  className={`${cx.pill} border-green-600 text-green-700`}
                  onClick={aprobar}
                  disabled={saving || loading}
                >
                  ✅ Aprobar y enviar a SIGECOM
                </button>
                <button
                  className={`${cx.pill} border-amber-600 text-amber-700`}
                  onClick={devolver}
                  disabled={saving || loading}
                >
                  🔁 Devolver al operario (estado 2)
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}





