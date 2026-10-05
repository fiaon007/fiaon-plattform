import { SOZIALE_PROFILE, type SozialesProfil } from "@shared/fiaon-sozial";

/** Schlichte Linien-Zeichen (keine Fremdlogos als Bild), 18 px, Farbe aus der Umgebung. */
function Zeichen({ kanal }: { kanal: SozialesProfil["kanal"] }) {
  if (kanal === "instagram") {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
        <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5.2" />
        <circle cx="12" cy="12" r="4.2" />
        <circle cx="17.4" cy="6.6" r="1.05" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M13.6 21v-7.4h2.5l.4-2.9h-2.9V8.9c0-.8.2-1.4 1.4-1.4h1.6V4.9c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.1H8v2.9h2.5V21h3.1z" />
    </svg>
  );
}

/** Die Social-Profile als kleine Leiste — Fußzeile Privat und FIAON Global (E-292). */
export function SozialeLinks({ en = false, className = "" }: { en?: boolean; className?: string }) {
  return (
    <ul className={`fi-sozial ${className}`} aria-label={en ? "FIAON on social media" : "FIAON in sozialen Netzwerken"}>
      {SOZIALE_PROFILE.map((p) => (
        <li key={p.kanal}>
          <a href={p.href} target="_blank" rel="noopener noreferrer" aria-label={en ? `FIAON on ${p.name}` : `FIAON auf ${p.name}`} title={`${p.name} · ${p.handle}`}>
            <Zeichen kanal={p.kanal} />
          </a>
        </li>
      ))}
    </ul>
  );
}

export default SozialeLinks;
