// src/WorkOrderMobile.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, getToken, setToken } from "./services/api";
import { useAuth } from "./context/AuthContext";
import { EOChip } from "./ui/EOChip";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

// ---------- Overlay de carga ----------
function LoadingOverlay({ show, text = "Cargando…" }) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-white/95 backdrop-blur">
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
  );
}

const cx = {
  page: "min-h-screen bg-white text-neutral-900 overflow-x-hidden",
  wrap: "mx-auto max-w-md w-full px-3 pb-24",
  h1: "text-xl font-extrabold tracking-tight",
  meta: "text-base text-neutral-600",
  groupTitle: "text-sm font-bold tracking-wider text-neutral-700 uppercase",
  card: "w-full rounded-3xl border shadow-sm bg-white overflow-hidden",
  pad: "p-4 sm:p-5",
  row: "grid grid-cols-1 gap-4",
  label: "block text-base font-semibold text-neutral-800",
  input:
    "mt-1 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-lg leading-none outline-none focus-visible:ring-4 focus-visible:ring-blue-500/40",
  select:
    "mt-1 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-lg leading-none outline-none focus-visible:ring-4 focus-visible:ring-blue-500/40",
  bigBtn:
    "rounded-2xl px-3 py-3 text-sm sm:text-base font-bold tracking-tight whitespace-nowrap text-center",
  pill: "rounded-xl border px-3 py-2 text-sm font-semibold whitespace-nowrap",
  listItem:
    "relative w-full rounded-2xl border p-3 hover:bg-neutral-50 overflow-hidden",
};

// ===== utils fecha
function formatDMY(date) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
function parseDMY(text) {
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(text || "");
  if (!m) return null;
  const d = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10) - 1;
  const y = parseInt(m[3], 10);
  const dt = new Date(y, mo, d);
  return dt.getFullYear() === y && dt.getMonth() === mo && dt.getDate() === d
    ? dt
    : null;
}
function maskDMY(value) {
  const digits = (value || "").replace(/\D+/g, "").slice(0, 8);
  const p1 = digits.slice(0, 2);
  const p2 = digits.slice(2, 4);
  const p3 = digits.slice(4, 8);
  let out = p1;
  if (p2) out += "/" + p2;
  if (p3) out += "/" + p3;
  return out;
}
function toDMY(iso) {
  if (!iso) return "";
  const [y, m, d] = (iso || "").split("-").map(Number);
  if (!y || !m || !d) return "";
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}
const toISO = (dmy) => {
  const d = parseDMY(dmy);
  return d ? d.toISOString().slice(0, 10) : null;
};
const toSN = (yesno) => (yesno === "si" ? "S" : "N");

// números: "11,8" -> 11.8
const toNum = (v) => {
  if (v === "" || v == null) return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

function DateField({ id, label, value, onChange }) {
  const hiddenDateRef = useRef(null);
  const openPicker = () => {
    const el = hiddenDateRef.current;
    if (!el) return;
    if (typeof el.showPicker === "function") el.showPicker();
    else {
      el.focus();
      el.click();
    }
  };
  const textToDateInputValue = () => {
    const dt = parseDMY(value);
    if (!dt) return "";
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${dt.getFullYear()}-${mm}-${dd}`;
  };

  return (
    <div>
      <label className={cx.label} htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          className={`${cx.input} pr-14`}
          placeholder="dd/mm/aaaa"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(maskDMY(e.target.value))}
          maxLength={10}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <input
            ref={hiddenDateRef}
            type="date"
            aria-hidden="true"
            className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-pointer"
            value={textToDateInputValue()}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return onChange("");
              const [y, m, d] = v.split("-").map(Number);
              onChange(formatDMY(new Date(y, m - 1, d)));
            }}
          />
          <button
            type="button"
            aria-label="Abrir calendario"
            onClick={openPicker}
            className="relative z-10 rounded-xl border px-3 py-2 text-base bg-white"
          >
            📅
          </button>
        </div>
      </div>
    </div>
  );
}

// helper join por id
const byKey = (key, arr = []) => {
  const m = new Map();
  for (const it of arr || []) m.set(String(it?.[key]), it);
  return m;
};

export default function WorkOrderMobile() {
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const recetaId = id ? String(id) : "";

  const isOperario = user?.rol === "O";
  const isEncargado = user?.rol === "E";

  // auth / estado
  const [hasToken, setHasToken] = useState(!!getToken());

  // overlays
  const [overlay, setOverlay] = useState({ show: false, text: "Cargando…" });
  const openOverlay = (text = "Cargando…") => setOverlay({ show: true, text });
  const closeOverlay = () => setOverlay((o) => ({ ...o, show: false }));

  // para saber si estamos trayendo lista o detalle
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingList, setLoadingList] = useState(false);

  const [errorMsg, setErrorMsg] = useState("");

  // track “guardados”
  const [saved, setSaved] = useState({
    labor: false,
    insumos: false,
    operario: false,
  });

  // LISTA
  const [myList, setMyList] = useState([]);

  // ===== Servicio config (campos activos) =====
  const [servicioInfo, setServicioInfo] = useState({
    idServicio: null,
    nombreServicio: "",
    activeFields: [], // array de campo_recetas_web
    loaded: false,
  });

  const activeSet = useMemo(
    () => new Set(servicioInfo.activeFields || []),
    [servicioInfo.activeFields],
  );

  const isActive = (campo) => {
    if (!servicioInfo.loaded) return true; // mientras carga no ocultes
    return activeSet.has(campo); // si está vacío -> false
  };

  // DETALLE
  const [data, setData] = useState({
    numero: "--------",
    campo: "",
    fechaEmision: "",
    recetaWebId: null,
    estado: null,

    idServicio: null,
    servicioNombre: "",

    // condiciones (base)
    fechaInicio: "",
    fechaFin: "",
    humedad: "",
    viento: "",
    direccionViento: "",
    rocio: "no",
    temperatura: "",
    nublado: "no",

    // nuevos
    humedad2: "B", // B/MB/M
    profundidad: "",
    anchoTrabajo: "",
    rastrojo: "N", // ✅ M/R/P/N

    // otros
    obsEncargado: "",
    obsOperario: "",
    tasaAplicacion: "",
    recargas: "",
    importante: "",
    lotes: [],
    insumos: [],
  });

  const insumosRequired = (data.insumos?.length || 0) > 0;

  const tabs = useMemo(() => {
    const base = [
      { k: "operario", t: "Condiciones" },
      { k: "labor", t: "Labor" },
    ];
    if (insumosRequired) base.push({ k: "insumos", t: "Insumos" });
    return base;
  }, [insumosRequired]);

  const [tab, setTab] = useState("operario");
  useEffect(() => {
    if (!insumosRequired && tab === "insumos") setTab("operario");
  }, [insumosRequired, tab]);

  useEffect(() => {
    setHasToken(!!getToken());
  }, []);

  // ===== LISTA (sin :id)
  useEffect(() => {
    if (!hasToken || recetaId) return;
    setLoadingList(true);
    setErrorMsg("");
    openOverlay("Cargando órdenes…");

    (async () => {
      try {
        const res = await api.getRecetas();
        const base = (Array.isArray(res) ? res : res?.data || []).filter(
          (r) => Number(r.estado) === 2,
        );

        const enriched = await Promise.all(
          base.map(async (r) => {
            try {
              const det = await api.getReceta(String(r.id));
              const obsE = det?.data?.receta_web?.observaciones_e ?? "";
              return { ...r, hasObsE: !!obsE };
            } catch {
              return { ...r, hasObsE: false };
            }
          }),
        );

        setMyList(enriched);
      } catch (e) {
        setErrorMsg(e?.message || "No se pudieron cargar tus órdenes.");
      } finally {
        setLoadingList(false);
        closeOverlay();
      }
    })();
  }, [hasToken, recetaId]);

  // ===== DETALLE (con :id)
  useEffect(() => {
    if (!hasToken || !recetaId) return;
    const ac = new AbortController();

    setLoadingDetail(true);
    setErrorMsg("");
    openOverlay("Cargando OT…");

    api
      .getReceta(recetaId, { signal: ac.signal })
      .then(async (payload) => {
        const D = payload?.data || {};
        const r = D.receta || {};
        const rw = D.receta_web || {};

        const idServicio = Number(r.idServicio ?? r.idservicio ?? 0) || null;

        const mapLw = byKey("idRecetaLote", D.receta_lotes_web || []);
        const lotes = (D.receta_lotes || []).map((x) => {
          const w = mapLw.get(String(x.id)) || {};
          return {
            idRecetaLote: x.id,
            idLoteWeb: w?.id ?? null,
            lote: String(x.lote ?? x.idRotacionLote ?? ""),
            cultivo: x.cultivo || "",
            observaciones: x.observaciones || "",
            hasEstimada:
              parseFloat(
                String(x.hectareas_estimadas || "0").replace(",", "."),
              ) || 0,
            has_e: w?.hectareas_e != null ? String(w.hectareas_e) : "",
            has_o: w?.hectareas_o != null ? String(w.hectareas_o) : "",
          };
        });

        const mapIw = byKey("idRecetaInsumo", D.receta_insumos_web || []);
        const insumos = (D.receta_insumos || []).map((it) => {
          const w = mapIw.get(String(it.id)) || {};
          return {
            idRecetaInsumo: it.id,
            idInsumoWeb: w?.id ?? null,
            nombre: it.nombre_insumo || "",
            unidad: it.medida || "UN",
            dosisHa: Number(String(it.dosis ?? 0).replace(",", ".")) || 0,
            totalRecetado:
              Number(String(it.cantidad_receta ?? 0).replace(",", ".")) || 0,
            cant_e: w?.cantidad_e != null ? String(w.cantidad_e) : "",
            cant_o: w?.cantidad_o != null ? String(w.cantidad_o) : "",
          };
        });

        setData((prev) => ({
          ...prev,
          numero: String(r.id ?? recetaId).padStart(8, "0"),
          campo: r.campo || prev.campo || "",
          fechaEmision: toDMY(r.fecha) || prev.fechaEmision || "",
          importante: r.nota || "",
          recetaWebId: rw?.id ?? null,
          estado: Number(r.estado) || null,

          idServicio,
          servicioNombre: (r.servicio || "").trim(),

          fechaInicio: toDMY(rw.fecha_inicio) || "",
          fechaFin: toDMY(rw.fecha_fin) || "",

          tasaAplicacion:
            rw.tasa_aplicacion != null ? String(rw.tasa_aplicacion) : "",
          recargas: rw.recargas != null ? String(rw.recargas) : "",

          humedad: rw.humedad != null ? String(rw.humedad) : "",
          viento:
            rw.viento_velocidad != null ? String(rw.viento_velocidad) : "",
          direccionViento: rw.viento_direccion || "",
          rocio: rw.rocio === "S" ? "si" : "no",
          temperatura: rw.temperatura != null ? String(rw.temperatura) : "",
          nublado: rw.nublado === "S" ? "si" : "no",

          humedad2: (rw.humedad2 ?? "B") || "B",
          profundidad: rw.profundidad != null ? String(rw.profundidad) : "",
          anchoTrabajo:
            rw.ancho_trabajo != null ? String(rw.ancho_trabajo) : "",
          rastrojo:
            rw.rastrojo && rw.rastrojo !== "-"
              ? String(rw.rastrojo).trim()
              : "N",

          obsEncargado: rw.observaciones_e ?? "",
          obsOperario: rw.observaciones_o ?? "",

          lotes,
          insumos,
        }));

        if (idServicio && api?.servicioEtiquetasActivas) {
          try {
            const resp = await api.servicioEtiquetasActivas(idServicio);
            const list = Array.isArray(resp) ? resp : resp?.data || [];
            const fields = (list || [])
              .map((x) => String(x.campo_recetas_web || "").trim())
              .filter(Boolean);

            setServicioInfo({
              idServicio,
              nombreServicio: list?.[0]?.nombreServicio || "",
              activeFields: fields,
              loaded: true,
            });
          } catch {
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
      })
      .catch((e) => {
        if (e?.name === "AbortError") return;
        setErrorMsg(e?.message || "No se pudo cargar la receta.");
      })
      .finally(() => {
        setLoadingDetail(false);
        closeOverlay();
      });

    return () => ac.abort();
  }, [hasToken, recetaId]);

  // totales
  const totalHasRealizadas = useMemo(() => {
    const key = isEncargado ? "has_e" : "has_o";
    return (data.lotes || []).reduce((a, l) => {
      const n = parseFloat(String(l[key] ?? "").replace(",", ".")) || 0;
      return a + n;
    }, 0);
  }, [data.lotes, isEncargado]);

  const totalHasEstimadas = useMemo(
    () =>
      (data.lotes || []).reduce(
        (a, l) => a + (parseFloat(l.hasEstimada) || 0),
        0,
      ),
    [data.lotes],
  );

  // setters
  const setHas = (i, val) => {
    setData((curr) => {
      const lotes = [...curr.lotes];
      const key = isEncargado ? "has_e" : "has_o";
      lotes[i] = { ...lotes[i], [key]: val };
      return { ...curr, lotes };
    });
  };

  const setUtilizado = (i, val) => {
    setData((curr) => {
      const insumos = [...curr.insumos];
      const key = isEncargado ? "cant_e" : "cant_o";
      insumos[i] = { ...insumos[i], [key]: val };
      return { ...curr, insumos };
    });
  };

  // ======= Validación (solo para campos ACTIVOS) =======
  function validateCondicionesOperarioDynamic(d) {
    const fi = toISO(d.fechaInicio);
    const ff = toISO(d.fechaFin);
    if (!fi) return "Falta la fecha de inicio.";
    if (!ff) return "Falta la fecha de fin.";

    if (isActive("temperatura")) {
      const temp = toNum(d.temperatura);
      if (temp == null || temp <= 0) return "Temperatura debe ser mayor a 0.";
    }
    if (isActive("viento_direccion")) {
      const dir = (d.direccionViento || "").trim();
      if (!dir) return "Dirección del viento no puede estar vacía.";
    }
    if (isActive("humedad2")) {
      const h2 = String(d.humedad2 || "").trim();
      if (!h2) return "Falta seleccionar Humedad (M/B/MB).";
    }
    return null;
  }

  // ======= GUARDADOS =======
  async function saveCondiciones() {
    const recetaWebId = data.recetaWebId;
    if (!recetaWebId)
      throw new Error(
        "No hay registro asociado en recetas_web. Reasigná la receta o recargá.",
      );

    const idReceta = Number(recetaId);

    if (isEncargado) {
      const payload = { id: recetaWebId, idReceta };
      const valE = (data.obsEncargado || "").trim();
      if (valE !== "") payload.observaciones_e = valE;
      const resp = await api.recetaWebGuardar(payload);
      if (!resp?.ok)
        throw new Error(
          resp?.msg || resp?.message || "No se pudo guardar Condiciones (E).",
        );
      return;
    }

    const err = validateCondicionesOperarioDynamic(data);
    if (err) throw new Error(err);

    const DEFAULTS = {
      humedad: 0,
      viento_velocidad: 0,
      viento_direccion: "-",
      rocio: "N",
      temperatura: 0,
      nublado: "N",
      humedad2: "B",
      profundidad: 0,
      ancho_trabajo: 0,
      rastrojo: "-",
    };

    const payload = {
      id: recetaWebId,
      idReceta,
      fecha_inicio: toISO(data.fechaInicio),
      fecha_fin: toISO(data.fechaFin),

      humedad: isActive("humedad")
        ? (toNum(data.humedad) ?? DEFAULTS.humedad)
        : DEFAULTS.humedad,
      viento_velocidad: isActive("viento_velocidad")
        ? (toNum(data.viento) ?? DEFAULTS.viento_velocidad)
        : DEFAULTS.viento_velocidad,
      viento_direccion: isActive("viento_direccion")
        ? (data.direccionViento || "").trim() || DEFAULTS.viento_direccion
        : DEFAULTS.viento_direccion,
      rocio: isActive("rocio") ? toSN(data.rocio) : DEFAULTS.rocio,
      temperatura: isActive("temperatura")
        ? (toNum(data.temperatura) ?? DEFAULTS.temperatura)
        : DEFAULTS.temperatura,
      nublado: isActive("nublado") ? toSN(data.nublado) : DEFAULTS.nublado,

      humedad2: isActive("humedad2")
        ? String(data.humedad2 || "").trim() || DEFAULTS.humedad2
        : DEFAULTS.humedad2,
      profundidad: isActive("profundidad")
        ? (toNum(data.profundidad) ?? DEFAULTS.profundidad)
        : DEFAULTS.profundidad,
      ancho_trabajo: isActive("ancho_trabajo")
        ? (toNum(data.anchoTrabajo) ?? DEFAULTS.ancho_trabajo)
        : DEFAULTS.ancho_trabajo,

      rastrojo: isActive("rastrojo")
        ? String(data.rastrojo || "").trim() || "N"
        : DEFAULTS.rastrojo,
    };

    const obsO = (data.obsOperario || "").trim();
    if (obsO !== "") payload.observaciones_o = obsO;

    const resp = await api.recetaWebGuardar(payload);
    if (!resp?.ok)
      throw new Error(
        resp?.msg || resp?.message || "No se pudo guardar Condiciones (O).",
      );
  }

  async function saveLabor() {
    if (!saved.operario && isOperario) {
      await saveCondiciones();
      setSaved((p) => ({ ...p, operario: true }));
    }

    const items = (data.lotes || []).map((l) => {
      const value = toNum(isEncargado ? l.has_e : l.has_o) ?? 0;
      return isEncargado
        ? { id: l.idLoteWeb, hectareas_e: value }
        : { id: l.idLoteWeb, hectareas_o: value };
    });

    const sinId = items.filter((it) => !it.id);
    if (sinId.length)
      throw new Error(
        "Hay lotes sin ID web; recargá la receta e intentá de nuevo.",
      );

    const resp = await api.recetaLotesWebGuardar(items);
    if (!resp?.ok)
      throw new Error(
        resp?.msg || resp?.message || "No se pudo guardar Lotes.",
      );
  }

  async function saveInsumos() {
    if (!saved.operario && isOperario) {
      await saveCondiciones();
      setSaved((p) => ({ ...p, operario: true }));
    }

    if (!insumosRequired) {
      const payload = {
        receta_insumos_web: [],
        id_receta: Number(recetaId),
        tasa_aplicacion: (() => {
          const v = toNum(data.tasaAplicacion);
          return v != null && v > 0 ? v : 0.01;
        })(),
        recargas: (() => {
          const v = toNum(data.recargas);
          return v != null && v >= 0 ? v : 0;
        })(),
      };

      const resp = await api.recetaInsumosWebGuardar(payload);
      if (!resp?.ok)
        throw new Error(
          resp?.msg || resp?.message || "No se pudo guardar parámetros.",
        );
      return;
    }

    const items = (data.insumos || []).map((it) => {
      const value = toNum(isEncargado ? it.cant_e : it.cant_o) ?? 0;
      return isEncargado
        ? { id: it.idInsumoWeb, cantidad_e: value }
        : { id: it.idInsumoWeb, cantidad_o: value };
    });

    const sinId = items.filter((it) => !it.id);
    if (sinId.length)
      throw new Error(
        "Hay insumos sin ID web; recargá la receta e intentá de nuevo.",
      );

    const payload = {
      receta_insumos_web: items,
      id_receta: Number(recetaId),
      tasa_aplicacion: (() => {
        const v = toNum(data.tasaAplicacion);
        return v != null && v > 0 ? v : 0.01;
      })(),
      recargas: (() => {
        const v = toNum(data.recargas);
        return v != null && v >= 0 ? v : 0;
      })(),
    };

    const resp = await api.recetaInsumosWebGuardar(payload);
    if (!resp?.ok) {
      const detalles = resp?.errores
        ? Object.entries(resp.errores)
            .map(
              ([k, v]) =>
                `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`,
            )
            .join(" | ")
        : "";
      throw new Error(resp?.msg || detalles || "No se pudo guardar Insumos.");
    }
  }

  const verifyServerCompleteness = async () => {
    const payload = await api.getReceta(recetaId);
    const D = payload?.data || {};
    const rw = D.receta_web || {};
    const lw = Array.isArray(D.receta_lotes_web) ? D.receta_lotes_web : [];
    const iw = Array.isArray(D.receta_insumos_web) ? D.receta_insumos_web : [];

    const faltas = [];

    const camposReq = [
      ["fecha_inicio", rw.fecha_inicio],
      ["fecha_fin", rw.fecha_fin],
    ];

    const maybe = [
      ["humedad", rw.humedad],
      ["viento_velocidad", rw.viento_velocidad],
      ["viento_direccion", rw.viento_direccion],
      ["rocio", rw.rocio],
      ["temperatura", rw.temperatura],
      ["nublado", rw.nublado],
      ["humedad2", rw.humedad2],
      ["profundidad", rw.profundidad],
      ["ancho_trabajo", rw.ancho_trabajo],
      ["rastrojo", rw.rastrojo],
    ];
    for (const [k, v] of maybe) {
      if (isActive(k) && (v == null || v === "")) camposReq.push([k, v]);
    }

    for (const [k, v] of camposReq) if (v == null || v === "") faltas.push(k);

    const lotesNull = lw.filter((x) => x.hectareas_o == null).map((x) => x.id);
    const insNull = iw.filter((x) => x.cantidad_o == null).map((x) => x.id);

    if (lotesNull.length)
      faltas.push(`lotes sin hectareas_o (ids web: ${lotesNull.join(", ")})`);
    if (insNull.length)
      faltas.push(`insumos sin cantidad_o (ids web: ${insNull.join(", ")})`);

    return faltas;
  };

  async function handleEnviar() {
    try {
      openOverlay(
        isOperario ? "Enviando al encargado…" : "Enviando a SIGECOM…",
      );

      if (!saved.operario) {
        await saveCondiciones();
        setSaved((p) => ({ ...p, operario: true }));
      }
      if (!saved.labor) {
        await saveLabor();
        setSaved((p) => ({ ...p, labor: true }));
      }
      if (insumosRequired && !saved.insumos) {
        await saveInsumos();
        setSaved((p) => ({ ...p, insumos: true }));
      }
      if (!insumosRequired && !saved.insumos) {
        setSaved((p) => ({ ...p, insumos: true }));
      }

      if (isOperario) {
        const faltas = await verifyServerCompleteness();
        if (faltas.length) {
          closeOverlay();
          await Swal.fire({
            icon: "warning",
            title: "Faltan datos",
            html:
              "Aún falta completar en el servidor:<br>• " +
              faltas.join("<br>• "),
          });
          return;
        }
      }

      if (isOperario) {
        const resp = await api.recetaEnviarEncargado(Number(recetaId));
        if (!resp?.ok)
          throw new Error(
            resp?.msg || resp?.message || "No se pudo enviar al encargado.",
          );
        closeOverlay();
        await Swal.fire({
          icon: "success",
          title: "Enviado",
          text: "Enviado al encargado correctamente",
        });
      } else if (isEncargado) {
        const resp = await api.recetaEnviarSigecom(Number(recetaId));
        if (!resp?.ok)
          throw new Error(
            resp?.msg || resp?.message || "No se pudo enviar a SIGECOM.",
          );
        closeOverlay();
        await Swal.fire({
          icon: "success",
          title: "Enviado",
          text: "Enviado a SIGECOM correctamente",
        });
      }

      navigate(isOperario ? "/operario" : "/encargado");
    } catch (e) {
      console.error(e);
      closeOverlay();
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: e?.message || "Error al enviar la receta.",
      });
    } finally {
      closeOverlay();
    }
  }

  async function handleGuardarActual() {
    try {
      openOverlay("Guardando…");
      if (tab === "operario") await saveCondiciones();
      if (tab === "labor") await saveLabor();
      if (tab === "insumos") {
        if (!insumosRequired) {
          closeOverlay();
          await Swal.fire({
            icon: "success",
            title: "OK",
            text: "Esta receta no tiene insumos.",
          });
          return;
        }
        await saveInsumos();
      }

      setSaved((prev) => ({ ...prev, [tab]: true }));
      closeOverlay();
      await Swal.fire({
        icon: "success",
        title: "Guardado",
        text: `${tabs.find((t) => t.k === tab)?.t} guardado correctamente ✓`,
      });
    } catch (e) {
      console.error(e);
      closeOverlay();
      await Swal.fire({
        icon: "error",
        title: "No se pudo guardar",
        text: e?.message || "Revisá la conexión o volvé a intentar.",
      });
    } finally {
      closeOverlay();
    }
  }

  const allSaved =
    saved.labor && saved.operario && (!insumosRequired || saved.insumos);

  async function handleLogout() {
    const { isConfirmed } = await Swal.fire({
      icon: "question",
      title: "¿Cerrar sesión?",
      text: "Se cerrará tu sesión actual.",
      showCancelButton: true,
      confirmButtonText: "Sí, salir",
      cancelButtonText: "Cancelar",
    });
    if (!isConfirmed) return;

    openOverlay("Cerrando sesión…");
    try {
      await api.logout().catch(() => {});
      setToken("");
      setHasToken(false);
      closeOverlay();
      await Swal.fire({
        icon: "success",
        title: "Sesión cerrada",
        timer: 1200,
        showConfirmButton: false,
      });
      navigate("/login", { replace: true });
    } catch (e) {
      console.error(e);
      closeOverlay();
      await Swal.fire({
        icon: "error",
        title: "No se pudo cerrar sesión",
        text: e?.message || "Intentá de nuevo.",
      });
    }
  }

  if (!hasToken) {
    return (
      <div className="min-h-screen grid place-items-center bg-neutral-50">
        <div
          className={`${cx.card} ${cx.pad} max-w-sm mx-auto text-center space-y-3`}
        >
          <div className="text-lg font-extrabold">Necesitás iniciar sesión</div>
          <Link
            to="/login"
            className="inline-block rounded-2xl bg-blue-600 text-white px-5 py-3 font-bold"
          >
            Ir al login
          </Link>
        </div>
      </div>
    );
  }

  // LISTA
  if (!recetaId) {
    return (
      <div className={cx.page}>
        <LoadingOverlay show={overlay.show} text={overlay.text} />

        <header className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b">
          <div className="mx-auto max-w-sm px-3 py-4 flex items-center justify-between gap-3">
            <div>
              <div className={cx.h1}>Mis órdenes</div>
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
            <button className={cx.pill} onClick={handleLogout}>
              Salir
            </button>
          </div>
        </header>

        <main className={`${cx.wrap} space-y-3`}>
          {errorMsg && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMsg}
            </div>
          )}

          <section className={`${cx.card} ${cx.pad} space-y-3`}>
            <div className={cx.groupTitle}>Asignadas a mí</div>

            {!loadingList && myList.length === 0 ? (
              <div className="text-sm text-neutral-600">
                (No tenés órdenes asignadas)
              </div>
            ) : (
              <div className="grid gap-3">
                {myList.map((r) => (
                  <article key={r.id} className={cx.listItem}>
                    <div className="min-w-0 pr-24">
                      <div className="font-bold leading-tight truncate">
                        #{String(r.id).padStart(4, "0")} ·{" "}
                        {String(
                          r.servicio ||
                            r.nombreServicio ||
                            `Serv ${r.idServicio ?? r.idservicio ?? "—"}`,
                        ).trim()}
                      </div>
                      <div className="text-sm text-neutral-600 truncate">
                        Campo: {r.campo ?? r.campo_nombre ?? "—"}
                      </div>
                      <div className="text-sm text-neutral-600">
                        Fecha: {r.fecha ?? "—"}
                      </div>
                      {r.nota ? (
                        <div className="mt-1 text-xs text-neutral-700 italic line-clamp-2">
                          {r.nota}
                        </div>
                      ) : null}

                      {r.hasObsE && (
                        <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                          ⚠️ Devuelta con observación
                        </div>
                      )}
                    </div>

                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl border px-3 py-2 text-sm font-semibold bg-black text-white"
                      onClick={() => {
                        openOverlay("Abriendo OT…");
                        setTimeout(() => navigate(`/operario/${r.id}`), 50);
                      }}
                    >
                      Abrir
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    );
  }

  // DETALLE
  return (
    <div className={cx.page}>
      <LoadingOverlay
        show={overlay.show || loadingDetail}
        text={overlay.text}
      />

      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b">
        <div className="mx-auto max-w-sm px-3 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className={cx.h1}>Orden de Trabajo #{data.numero}</div>

              <div className={cx.meta}>
                Campo: {data.campo || "—"} ·{" "}
                <span>Fecha de emisión: {data.fechaEmision || "—"}</span>
                {data.idServicio ? (
                  <div className="text-sm text-neutral-600">
                    Servicio:{" "}
                    <b>{data.servicioNombre || data.idServicio || "—"}</b>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button className={cx.pill} onClick={() => navigate("/operario")}>
                ← Mis órdenes
              </button>
              <button className={cx.pill} onClick={handleLogout}>
                Salir
              </button>
            </div>
          </div>

          {data.importante ? (
            <article className="mt-3 w-full rounded-2xl border border-yellow-200 bg-yellow-50 px-3 py-2">
              <div className="text-xs font-extrabold tracking-wide text-amber-900">
                IMPORTANTE
              </div>
              <div className="text-sm text-amber-900 whitespace-pre-line">
                {data.importante}
              </div>
            </article>
          ) : null}
        </div>

        <nav
          className={`mx-auto max-w-sm px-3 pb-3 grid ${
            tabs.length === 3 ? "grid-cols-3" : "grid-cols-2"
          } gap-2`}
        >
          {tabs.map((b) => (
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
              {saved[b.k] ? " ✓" : ""}
            </button>
          ))}
        </nav>
      </header>

      <main className={cx.wrap} aria-busy={loadingDetail}>
        {errorMsg ? (
          <div className="mb-3 text-sm text-red-600">{errorMsg}</div>
        ) : null}

        {isOperario && data.obsEncargado ? (
          <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-900">
            <div className="font-bold mb-1">Observación del Encargado</div>
            <div className="whitespace-pre-line">{data.obsEncargado}</div>
          </div>
        ) : null}

        {/* ===== TAB LABOR ===== */}
        {tab === "labor" && (
          <section className="space-y-4">
            <article className={cx.card}>
              <div className="bg-neutral-100 px-4 py-3 rounded-t-3xl flex items-center justify-between">
                <span className={cx.groupTitle}>Lotes</span>
                <span className="text-sm font-semibold">
                  Has estimadas: {totalHasEstimadas.toFixed(2)}
                </span>
              </div>

              <div className="divide-y">
                {data.lotes.map((l, i) => (
                  <div
                    key={l.idRecetaLote || `${l.lote}-${i}`}
                    className={`${cx.pad} space-y-2`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-lg font-bold">
                        Lote {l.lote} · {l.cultivo}
                      </div>
                      <div className="text-sm text-neutral-600">
                        Has est.: {l.hasEstimada}
                      </div>
                    </div>

                    {l.observaciones ? (
                      <div className="text-neutral-700 text-base italic">
                        {l.observaciones}
                      </div>
                    ) : null}

                    <div className="flex flex-wrap gap-2 text-sm text-neutral-700">
                      {l.has_e !== "" && <EOChip who="E">{l.has_e}</EOChip>}
                      {l.has_o !== "" && <EOChip who="O">{l.has_o}</EOChip>}
                    </div>

                    <div>
                      <label className={cx.label}>Has realizadas</label>
                      {/* ✅ iOS: type text + inputMode decimal permite coma */}
                      <input
                        className={`${cx.input} focus-visible:ring-emerald-500/40`}
                        inputMode="decimal"
                        type="text"
                        pattern="[0-9]*[.,]?[0-9]*"
                        value={isEncargado ? l.has_e : l.has_o}
                        onChange={(e) => setHas(i, e.target.value)}
                        placeholder="0,00"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="px-4 py-3 bg-neutral-50 rounded-b-3xl flex items-center justify-between text-lg">
                <span className="font-bold">HAS TOTALES</span>
                <span className="font-extrabold">
                  {totalHasRealizadas.toFixed(2)}
                </span>
              </div>
            </article>
          </section>
        )}

        {/* ===== TAB INSUMOS ===== */}
        {tab === "insumos" && insumosRequired && (
          <section className="space-y-4">
            <article className={cx.card}>
              <div className="bg-neutral-100 px-4 py-3 rounded-t-3xl">
                <span className={cx.groupTitle}>Tratamiento</span>
              </div>

              {Array.isArray(data.insumos) && data.insumos.length > 0 ? (
                <div className="divide-y">
                  {data.insumos.map((ins, i) => (
                    <div
                      key={ins.idRecetaInsumo || i}
                      className={`${cx.pad} space-y-2`}
                    >
                      <div className="text-lg font-bold leading-tight">
                        {ins.nombre}
                      </div>
                      <div className="text-sm text-neutral-700">
                        Dosis: <b>{ins.dosisHa}</b> <b>{ins.unidad}</b>/Ha
                      </div>
                      <div className="text-sm text-neutral-700">
                        Total recetado:{" "}
                        <b>
                          {ins.totalRecetado} {ins.unidad}
                        </b>
                      </div>

                      <div className="flex flex-wrap gap-2 text-sm text-neutral-700">
                        {ins.cant_e !== "" && (
                          <EOChip who="E">
                            {ins.cant_e} {ins.unidad}
                          </EOChip>
                        )}
                        {ins.cant_o !== "" && (
                          <EOChip who="O">
                            {ins.cant_o} {ins.unidad}
                          </EOChip>
                        )}
                      </div>

                      <div>
                        <label className={cx.label}>
                          Total utilizado ({ins.unidad})
                        </label>
                        {/* ✅ iOS: type text + inputMode decimal permite coma */}
                        <input
                          className={`${cx.input} focus-visible:ring-emerald-500/40`}
                          inputMode="decimal"
                          type="text"
                          pattern="[0-9]*[.,]?[0-9]*"
                          value={isEncargado ? ins.cant_e : ins.cant_o}
                          onChange={(e) => setUtilizado(i, e.target.value)}
                          placeholder="0,00"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={`${cx.pad} text-sm text-neutral-600`}>
                  (Sin insumos en esta receta o aún no cargados.)
                </div>
              )}
            </article>

            <article className={`${cx.card} ${cx.pad} space-y-3`}>
              <div className={cx.groupTitle}>Parámetros del trabajo</div>
              <div>
                <label className={cx.label} htmlFor="tasa">
                  Tasa de aplicación (L/Ha)
                </label>
                {/* ✅ iOS: decimal con coma */}
                <input
                  id="tasa"
                  className={cx.input}
                  inputMode="decimal"
                  type="text"
                  pattern="[0-9]*[.,]?[0-9]*"
                  value={data.tasaAplicacion}
                  onChange={(e) =>
                    setData({ ...data, tasaAplicacion: e.target.value })
                  }
                  placeholder="0,00"
                />
              </div>
              <div>
                <label className={cx.label} htmlFor="recargas">
                  Cantidad de recargas
                </label>
                {/* ✅ entero: text + numeric */}
                <input
                  id="recargas"
                  className={cx.input}
                  inputMode="numeric"
                  type="text"
                  pattern="[0-9]*"
                  value={data.recargas}
                  onChange={(e) =>
                    setData({ ...data, recargas: e.target.value })
                  }
                  placeholder="0"
                />
              </div>
            </article>
          </section>
        )}

        {/* ===== TAB CONDICIONES ===== */}
        {tab === "operario" && (
          <section className="space-y-4">
            <article className={`${cx.card} ${cx.pad} space-y-4`}>
              <div className={cx.groupTitle}>Condiciones</div>

              <div className={cx.row}>
                <DateField
                  id="fi"
                  label="Fecha de inicio"
                  value={data.fechaInicio}
                  onChange={(v) => setData({ ...data, fechaInicio: v })}
                />
                <DateField
                  id="ff"
                  label="Fecha de fin"
                  value={data.fechaFin}
                  onChange={(v) => setData({ ...data, fechaFin: v })}
                />
              </div>

              <div className={cx.row}>
                {isActive("humedad") && (
                  <div>
                    <label className={cx.label} htmlFor="hum">
                      Humedad promedio (%)
                    </label>
                    {/* ✅ decimal */}
                    <input
                      id="hum"
                      className={cx.input}
                      inputMode="decimal"
                      type="text"
                      pattern="[0-9]*[.,]?[0-9]*"
                      value={data.humedad}
                      onChange={(e) =>
                        setData({ ...data, humedad: e.target.value })
                      }
                      placeholder="0,0"
                    />
                  </div>
                )}

                {isActive("viento_velocidad") && (
                  <div>
                    <label className={cx.label} htmlFor="viento">
                      Velocidad del viento (km/h)
                    </label>
                    {/* ✅ decimal */}
                    <input
                      id="viento"
                      className={cx.input}
                      inputMode="decimal"
                      type="text"
                      pattern="[0-9]*[.,]?[0-9]*"
                      value={data.viento}
                      onChange={(e) =>
                        setData({ ...data, viento: e.target.value })
                      }
                      placeholder="0,0"
                    />
                  </div>
                )}

                {isActive("viento_direccion") && (
                  <div>
                    <label className={cx.label} htmlFor="dir">
                      Dirección del viento
                    </label>
                    <input
                      id="dir"
                      className={cx.input}
                      placeholder="Ej: N, NE, E..."
                      value={data.direccionViento}
                      onChange={(e) =>
                        setData({ ...data, direccionViento: e.target.value })
                      }
                    />
                  </div>
                )}

                {isActive("rocio") && (
                  <div>
                    <label className={cx.label} htmlFor="rocio">
                      Rocío
                    </label>
                    <select
                      id="rocio"
                      className={cx.select}
                      value={data.rocio}
                      onChange={(e) =>
                        setData({ ...data, rocio: e.target.value })
                      }
                    >
                      <option value="no">No</option>
                      <option value="si">Sí</option>
                    </select>
                  </div>
                )}

                {isActive("temperatura") && (
                  <div>
                    <label className={cx.label} htmlFor="temp">
                      Temperatura media (°C)
                    </label>
                    {/* ✅ decimal */}
                    <input
                      id="temp"
                      className={cx.input}
                      inputMode="decimal"
                      type="text"
                      pattern="[0-9]*[.,]?[0-9]*"
                      value={data.temperatura}
                      onChange={(e) =>
                        setData({ ...data, temperatura: e.target.value })
                      }
                      placeholder="0,0"
                    />
                  </div>
                )}

                {isActive("nublado") && (
                  <div>
                    <label className={cx.label} htmlFor="nublado">
                      Nublado
                    </label>
                    <select
                      id="nublado"
                      className={cx.select}
                      value={data.nublado}
                      onChange={(e) =>
                        setData({ ...data, nublado: e.target.value })
                      }
                    >
                      <option value="no">No</option>
                      <option value="si">Sí</option>
                    </select>
                  </div>
                )}

                {isActive("humedad2") && (
                  <div>
                    <label className={cx.label} htmlFor="hum2">
                      Humedad (M/B/MB)
                    </label>
                    <select
                      id="hum2"
                      className={cx.select}
                      value={data.humedad2}
                      onChange={(e) =>
                        setData({ ...data, humedad2: e.target.value })
                      }
                    >
                      <option value="B">Buena (B)</option>
                      <option value="MB">Muy Buena (MB)</option>
                      <option value="M">Mala (M)</option>
                    </select>
                  </div>
                )}

                {isActive("profundidad") && (
                  <div>
                    <label className={cx.label} htmlFor="prof">
                      Profundidad (cm)
                    </label>
                    {/* ✅ decimal */}
                    <input
                      id="prof"
                      className={cx.input}
                      inputMode="decimal"
                      type="text"
                      pattern="[0-9]*[.,]?[0-9]*"
                      value={data.profundidad}
                      onChange={(e) =>
                        setData({ ...data, profundidad: e.target.value })
                      }
                      placeholder="0,0"
                    />
                  </div>
                )}

                {isActive("ancho_trabajo") && (
                  <div>
                    <label className={cx.label} htmlFor="ancho">
                      Ancho de trabajo (mt)
                    </label>
                    {/* ✅ decimal */}
                    <input
                      id="ancho"
                      className={cx.input}
                      inputMode="decimal"
                      type="text"
                      pattern="[0-9]*[.,]?[0-9]*"
                      value={data.anchoTrabajo}
                      onChange={(e) =>
                        setData({ ...data, anchoTrabajo: e.target.value })
                      }
                      placeholder="0,0"
                    />
                  </div>
                )}

                {isActive("rastrojo") && (
                  <div>
                    <label className={cx.label} htmlFor="rast">
                      Rastrojo
                    </label>
                    <select
                      id="rast"
                      className={cx.select}
                      value={data.rastrojo}
                      onChange={(e) =>
                        setData({ ...data, rastrojo: e.target.value })
                      }
                    >
                      <option value="M">Mucho (M)</option>
                      <option value="R">Regular (R)</option>
                      <option value="P">Poco (P)</option>
                      <option value="N">Nada (N)</option>
                    </select>
                  </div>
                )}

                <div className="col-span-1">
                  <label className={cx.label} htmlFor="obs">
                    Observaciones
                  </label>
                  <textarea
                    id="obs"
                    rows={4}
                    className={`${cx.input} resize-y`}
                    value={isEncargado ? data.obsEncargado : data.obsOperario}
                    onChange={(e) =>
                      isEncargado
                        ? setData({ ...data, obsEncargado: e.target.value })
                        : setData({ ...data, obsOperario: e.target.value })
                    }
                    placeholder={
                      isEncargado
                        ? data.obsOperario
                          ? `Observación del operario: "${data.obsOperario}"`
                          : "Escriba su observación"
                        : data.obsEncargado
                          ? `Observación del encargado: "${data.obsEncargado}"`
                          : "Escriba observaciones aquí (opcional)"
                    }
                  />
                </div>
              </div>
            </article>
          </section>
        )}
      </main>

      <div className="mx-auto max-w-sm px-3 mt-6 pb-10">
        <div className="grid grid-cols-1 gap-2">
          <button
            type="button"
            className="w-full rounded-2xl bg-amber-600 text-white px-4 py-4 text-lg font-extrabold shadow-md"
            onClick={handleGuardarActual}
            title="Guarda solo la pestaña actual"
          >
            Guardar {tabs.find((t) => t.k === tab)?.t}
          </button>

          <button
            type="button"
            className={`w-full rounded-2xl ${
              allSaved ? "bg-green-600" : "bg-neutral-300 text-neutral-700"
            } text-white px-4 py-4 text-lg font-extrabold shadow-md`}
            onClick={handleEnviar}
            disabled={!allSaved}
            title={
              allSaved
                ? isOperario
                  ? "Enviar al encargado"
                  : "Enviar a SIGECOM"
                : "Guardá las 3 pestañas para habilitar"
            }
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}