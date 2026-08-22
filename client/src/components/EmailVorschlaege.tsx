// ═══════════════════════════════════════════════════════════════════════════
// E-MAIL-ENDUNGEN ZUM ANTIPPEN (22.08.2026, Justins Kundentest)
//
// „Wenn man die E-Mail eingibt — VEREINFACHEN, z. B. mit den gängigsten
// Endungen." Sobald ein @ getippt ist, erscheinen die passenden Anbieter des
// Landes als Chips; ein Tipp vervollständigt. Deutsche Kunden sehen gmx.de
// und web.de, österreichische gmx.at und aon.at, Schweizer bluewin.ch.
// ═══════════════════════════════════════════════════════════════════════════
const ENDUNGEN: Record<string, string[]> = {
  DE: ["gmail.com", "gmx.de", "web.de", "t-online.de", "outlook.de", "icloud.com", "yahoo.de", "hotmail.de", "freenet.de", "posteo.de"],
  AT: ["gmail.com", "gmx.at", "aon.at", "outlook.at", "icloud.com", "hotmail.com", "yahoo.de", "chello.at", "a1.net", "gmx.net"],
  CH: ["gmail.com", "bluewin.ch", "gmx.ch", "outlook.com", "icloud.com", "hotmail.ch", "sunrise.ch", "yahoo.com", "protonmail.com"],
};
const ALLGEMEIN = ["gmail.com", "gmx.de", "web.de", "outlook.com", "icloud.com", "hotmail.com", "yahoo.com"];

export function emailVorschlaege(wert: string, land?: string | null, max = 4): string[] {
  const at = wert.indexOf("@");
  if (at < 0) return [];
  const lokal = wert.slice(0, at); const rest = wert.slice(at + 1).toLowerCase();
  if (!lokal) return [];
  const liste = ENDUNGEN[String(land || "").toUpperCase()] || ALLGEMEIN;
  return liste.filter((d) => d.startsWith(rest) && d !== rest).slice(0, max).map((d) => `${lokal}@${d}`);
}

export function EmailVorschlaege({ wert, land, onWahl }: { wert: string; land?: string | null; onWahl: (v: string) => void }) {
  const liste = emailVorschlaege(wert, land);
  if (liste.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2" role="listbox" aria-label="Vorschläge für die E-Mail-Adresse">
      {liste.map((v) => (
        <button key={v} type="button" role="option" aria-selected={false}
                onMouseDown={(e) => e.preventDefault()} onClick={() => onWahl(v)}
                className="px-3 py-1.5 rounded-full text-[13px] font-medium bg-white border border-blue-100 text-[#1d4ed8] shadow-sm active:scale-[.97]"
                style={{ minHeight: 36 }}>
          {v}
        </button>
      ))}
    </div>
  );
}
