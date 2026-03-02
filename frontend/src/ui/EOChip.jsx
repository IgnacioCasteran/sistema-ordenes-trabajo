// src/ui/EOChip.jsx
export function EOChip({ who, children, className = "" }) {
  const isE = who === "E";
  const base =
    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold border";
  const styles = isE
    ? "bg-blue-50 border-blue-300 text-blue-700"
    : "bg-emerald-50 border-emerald-300 text-emerald-700";
  const title = isE ? "Dato cargado por el Encargado" : "Dato cargado por el Operario";
  const icon = isE ? "ENCARGADO:" : "OPERARIO:";
  return (
    <span className={`${base} ${styles} ${className}`} title={title} aria-label={title}>
      <span className="opacity-80">{icon}</span>
      <span className="font-bold"></span> {children}
    </span>
  );
}


