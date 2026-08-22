// „Der Antrag am Handy muss sich anfühlen wie eine App — man darf nichts
// zoomen können." (Justin, 22.08.2026) Nur auf den Strecken, die das
// brauchen; beim Verlassen wird die Vorgabe aus index.html zurückgesetzt.
// Zusätzlich haben alle Eingabefelder 16 px — sonst zoomt iOS beim Tippen.
const APP = "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover";
export function appViewport(): () => void {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (!meta) return () => {};
  const vorher = meta.getAttribute("content") || "";
  meta.setAttribute("content", APP);
  document.documentElement.style.setProperty("-webkit-text-size-adjust", "100%");
  return () => { meta.setAttribute("content", vorher); };
}
