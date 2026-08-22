// Eigene Marken für die Navigation — 1,6 px Strich, 24er-Raster, keine
// fremde Bibliothek. Dieselbe Sprache wie fiaon-zeichen.tsx (E-022, Scheibe 3).
import type { CSSProperties } from "react";
type P = { size?: number; strokeWidth?: number; style?: CSSProperties; className?: string };
const Basis = ({ size = 18, strokeWidth = 1.6, style, className, children }: P & { children: React.ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
       strokeLinecap="round" strokeLinejoin="round" style={style} className={className} aria-hidden="true" focusable="false">{children}</svg>
);
export const MarkeMenschen = (p: P) => <Basis {...p}><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19c.6-3.3 2.8-5 5.5-5s4.9 1.7 5.5 5" /><circle cx="17" cy="9" r="2.4" /><path d="M15.5 14.2c2.6.2 4.3 1.8 4.8 4.8" /></Basis>;
export const MarkeStart = (p: P) => <Basis {...p}><rect x="3.5" y="3.5" width="7" height="7" rx="1.6" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.6" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.6" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.6" /></Basis>;
export const MarkeGeld = (p: P) => <Basis {...p}><rect x="3" y="6" width="18" height="12" rx="2.2" /><path d="M3 10h18" /><path d="M7 14.5h3" /></Basis>;
export const MarkePost = (p: P) => <Basis {...p}><rect x="3" y="5.5" width="18" height="13" rx="2.2" /><path d="M4 7.5l8 6 8-6" /></Basis>;
export const MarkeAufgaben = (p: P) => <Basis {...p}><path d="M4 7l2 2 3.5-3.5" /><path d="M4 15l2 2 3.5-3.5" /><path d="M12.5 7.5H20" /><path d="M12.5 15.5H20" /></Basis>;
export const MarkeKalender = (p: P) => <Basis {...p}><rect x="3.5" y="5" width="17" height="15.5" rx="2.2" /><path d="M3.5 10h17" /><path d="M8 3v4M16 3v4" /></Basis>;
export const MarkeMehr = (p: P) => <Basis {...p}><circle cx="6" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="18" cy="12" r="1.4" fill="currentColor" stroke="none" /></Basis>;
export const MarkeForderung = (p: P) => <Basis {...p}><path d="M5 20V9.5L12 4l7 5.5V20" /><path d="M9.5 20v-5.5h5V20" /></Basis>;
export const MarkeGespraech = (p: P) => <Basis {...p}><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H10l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5z" /><path d="M8 9h8M8 12.5h5" /></Basis>;
export const MarkeVertrieb = (p: P) => <Basis {...p}><path d="M4 18l5-5 3.5 3.5L20 8" /><path d="M15 8h5v5" /></Basis>;
