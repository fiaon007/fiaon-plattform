// ═══════════════════════════════════════════════════════════════════════════
// DIE ZEICHEN DES WHATSAPP-RAUMS (20.10.2026)
//
// Ein Satz feiner Linien-Zeichen (24er-Raster, Strich 1,6) — überall gleich,
// statt jedes Teil mit eigenem SVG. Farbe kommt immer aus `currentColor`.
// ═══════════════════════════════════════════════════════════════════════════
import type { ReactNode } from "react";

function Z({ g = 20, children, titel, className }: { g?: number; children: ReactNode; titel?: string; className?: string }) {
  return (
    <svg className={className} width={g} height={g} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden={titel ? undefined : true} role={titel ? "img" : undefined} aria-label={titel}>
      {children}
    </svg>
  );
}

type P = { g?: number; className?: string };

export const ZSuche = (p: P) => <Z {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></Z>;
export const ZNeu = (p: P) => <Z {...p}><path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3z" /><path d="m14.5 7.5 3 3" /></Z>;
export const ZMenue = (p: P) => <Z {...p}><circle cx="12" cy="5.5" r=".9" fill="currentColor" /><circle cx="12" cy="12" r=".9" fill="currentColor" /><circle cx="12" cy="18.5" r=".9" fill="currentColor" /></Z>;
export const ZTelefon = (p: P) => <Z {...p}><path d="M6.2 3.8h2.9l1.5 4-1.9 1.3a10.6 10.6 0 0 0 5.2 5.2l1.3-1.9 4 1.5v2.9a1.9 1.9 0 0 1-2.1 1.9A15.8 15.8 0 0 1 4.3 5.9a1.9 1.9 0 0 1 1.9-2.1z" /></Z>;
export const ZInfo = (p: P) => <Z {...p}><circle cx="12" cy="12" r="8.6" /><path d="M12 11v5.2" /><path d="M12 7.7v.1" strokeWidth="2" /></Z>;
export const ZAkte = (p: P) => <Z {...p}><path d="M3.8 7.2V18a1.8 1.8 0 0 0 1.8 1.8h12.8a1.8 1.8 0 0 0 1.8-1.8V9.6a1.8 1.8 0 0 0-1.8-1.8h-6.6L9.9 5.6a1.8 1.8 0 0 0-1.3-.6H5.6a1.8 1.8 0 0 0-1.8 1.8z" /></Z>;
export const ZZurueck = (p: P) => <Z {...p}><path d="M15 5 8 12l7 7" /></Z>;
export const ZSenden = ({ g = 20, className }: P) => (
  <svg className={className} width={g} height={g} viewBox="0 0 24 24" aria-hidden="true"><path d="M3.6 20.2 21 12 3.6 3.8 3.6 10l12.2 2-12.2 2z" fill="currentColor" /></svg>
);
export const ZPlus = (p: P) => <Z {...p}><path d="M12 5v14M5 12h14" /></Z>;
export const ZVorlage = (p: P) => <Z {...p}><path d="M6.5 3.8h7.6l3.9 3.9v11.5a1.6 1.6 0 0 1-1.6 1.6H6.5a1.6 1.6 0 0 1-1.6-1.6V5.4a1.6 1.6 0 0 1 1.6-1.6z" /><path d="M13.8 4v4h4M8.5 12.5h7M8.5 16h5" /></Z>;
export const ZSchloss = (p: P) => <Z {...p}><rect x="5" y="10.5" width="14" height="9.5" rx="2" /><path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5" /></Z>;
export const ZBild = (p: P) => <Z {...p}><rect x="3.5" y="5" width="17" height="14" rx="2.2" /><circle cx="9" cy="10" r="1.6" /><path d="m20.5 16-4.6-4.6L7 19" /></Z>;
export const ZMikro = (p: P) => <Z {...p}><rect x="9" y="3.5" width="6" height="11" rx="3" /><path d="M5.8 11.5a6.2 6.2 0 0 0 12.4 0M12 17.7v2.8" /></Z>;
export const ZVideo = (p: P) => <Z {...p}><rect x="3.5" y="6" width="12.5" height="12" rx="2" /><path d="m16 10.3 4.5-2.6v8.6L16 13.7" /></Z>;
export const ZDokument = (p: P) => <Z {...p}><path d="M6.5 3.8h7.6l3.9 3.9v11.5a1.6 1.6 0 0 1-1.6 1.6H6.5a1.6 1.6 0 0 1-1.6-1.6V5.4a1.6 1.6 0 0 1 1.6-1.6z" /><path d="M13.8 4v4h4" /></Z>;
export const ZOrt = (p: P) => <Z {...p}><path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21z" /><circle cx="12" cy="9.8" r="2.3" /></Z>;
export const ZPerson = (p: P) => <Z {...p}><circle cx="12" cy="8.5" r="3.6" /><path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" /></Z>;
export const ZLink = (p: P) => <Z {...p}><path d="M14 4.5h5.5V10M19.5 4.5 11 13M17.5 14v4a2 2 0 0 1-2 2H6.5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h4" /></Z>;
export const ZAntwort = (p: P) => <Z {...p}><path d="M9.5 6.5 4.5 11l5 4.5" /><path d="M4.8 11H14a5.5 5.5 0 0 1 5.5 5.5V18" /></Z>;
export const ZRunter = (p: P) => <Z {...p}><path d="M12 5v13M6.5 12.5 12 18l5.5-5.5" /></Z>;
export const ZFunke = (p: P) => <Z {...p}><path d="M12 3.5c.6 3.9 2.6 5.9 6.5 6.5-3.9.6-5.9 2.6-6.5 6.5-.6-3.9-2.6-5.9-6.5-6.5 3.9-.6 5.9-2.6 6.5-6.5z" /><path d="M18.5 16.5c.2 1.3.9 2 2.2 2.2-1.3.2-2 .9-2.2 2.2-.2-1.3-.9-2-2.2-2.2 1.3-.2 2-.9 2.2-2.2z" /></Z>;
export const ZAuge = (p: P) => <Z {...p}><path d="M2.8 12S6.2 5.8 12 5.8 21.2 12 21.2 12 17.8 18.2 12 18.2 2.8 12 2.8 12z" /><circle cx="12" cy="12" r="2.6" /></Z>;
export const ZUhr = (p: P) => <Z {...p}><circle cx="12" cy="12" r="8.4" /><path d="M12 7.6V12l2.8 1.8" /></Z>;
export const ZKalender = (p: P) => <Z {...p}><rect x="4" y="5.5" width="16" height="14.5" rx="2.2" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></Z>;
export const ZSchliessen = (p: P) => <Z {...p}><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" /></Z>;
export const ZLaden = (p: P) => <Z {...p}><path d="M12 4v10.5M7.5 10.5 12 15l4.5-4.5M5 19.5h14" /></Z>;
export const ZKlappeLinks = (p: P) => <Z {...p}><path d="M11.5 6.5 6 12l5.5 5.5M18 6.5 12.5 12l5.5 5.5" /></Z>;
export const ZKlappeRechts = (p: P) => <Z {...p}><path d="M12.5 6.5 18 12l-5.5 5.5M6 6.5l5.5 5.5L6 17.5" /></Z>;
export const ZSchrift = (p: P) => <Z {...p}><path d="M3.5 18.5 8.2 6h1.6l4.7 12.5M5.2 14h7.6" /><path d="M15.5 18.5l2.6-7h1.4l2.6 7M16.4 16h4.2" /></Z>;
export const ZFrage = (p: P) => <Z {...p}><circle cx="12" cy="12" r="8.6" /><path d="M9.6 9.4a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.7" /><path d="M12 16.9v.1" strokeWidth="2" /></Z>;
export const ZSchritte = (p: P) => <Z {...p}><path d="M5 7h14M5 12h14M5 17h9" /></Z>;
export const ZWarnung = (p: P) => <Z {...p}><circle cx="12" cy="12" r="8.6" /><path d="M12 7.5v5.6" /><path d="M12 16.4v.1" strokeWidth="2" /></Z>;

/** Häkchen: gesendet ✓, zugestellt ✓✓, gelesen ✓✓ (hell). */
export function ZHaken({ doppelt, className }: { doppelt: boolean; className?: string }) {
  return (
    <svg className={className} width="17" height="11" viewBox="0 0 17 11" aria-hidden="true">
      <path d="M1.2 6.1 4.3 9.2 10.8 1.8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {doppelt && <path d="M7.4 8.3 8.3 9.2 14.8 1.8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}
