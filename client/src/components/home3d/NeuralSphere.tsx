// NeuralSphere — seit 22.08.2026 nur noch ein Name: Das KI-Hirn kommt als
// Hologramm-Video (HirnVideo). Der Name bleibt, damit alle Seiten weiterlaufen.
// variant="hero" → voll sichtbar · variant="calm" → zurückgenommen (Abschluss-Hintergrund)
import HirnVideo from "./HirnVideo";

export default function NeuralSphere({ variant = "hero", className = "" }: { variant?: "hero" | "calm"; className?: string }) {
  return <HirnVideo className={className} ruhig={variant === "calm"} groesse={variant === "calm" ? "min(70vh, 640px)" : "min(80vh, 720px)"} />;
}
