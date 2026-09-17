// ═══════════════════════════════════════════════════════════════════════════
// FIRMENSUCHE — robots.txt BEACHTEN (17.09.2026, E-188)
//
// Der Impressum-Leser ist ein Einzelabruf auf Wunsch des Besuchers, kein
// Crawler. Trotzdem hält er sich an robots.txt (RFC 9309): Wer Maschinen von
// seinem Impressum fernhalten will, bekommt von uns keinen Besuch — der Kunde
// trägt seine Daten dann von Hand ein. Das kostet einen kleinen Abruf je Host
// und erspart die Diskussion, ob wir es „dürften".
//
// Regeln nach RFC 9309: Die Gruppe mit UNSEREM Namen gilt vor der Gruppe „*";
// innerhalb der Gruppe gewinnt die LÄNGSTE passende Regel, bei Gleichstand
// „Allow". Platzhalter „*" und Endanker „$" werden verstanden.
//   · robots.txt fehlt (4xx)            → alles erlaubt
//   · robots.txt nicht erreichbar (5xx, Netz) → nichts erlaubt
// ═══════════════════════════════════════════════════════════════════════════

export interface RobotsRegel { erlaubt: boolean; muster: string }

const UNSER_NAME = "fiaon-firmensuche";

/** Die für uns geltenden Regeln aus einer robots.txt. */
export function robotsRegeln(text: string, name: string = UNSER_NAME): RobotsRegel[] {
  const gruppen: { agenten: string[]; regeln: RobotsRegel[] }[] = [];
  let laufend: { agenten: string[]; regeln: RobotsRegel[] } | null = null;
  let zuletztAgent = false;
  for (const roh of String(text ?? "").slice(0, 200_000).split(/\r?\n/)) {
    const zeile = roh.replace(/#.*$/, "").trim();
    const m = zeile.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const feld = m[1].toLowerCase(), wert = m[2].trim();
    if (feld === "user-agent") {
      if (!laufend || !zuletztAgent) { laufend = { agenten: [], regeln: [] }; gruppen.push(laufend); }
      laufend.agenten.push(wert.toLowerCase());
      zuletztAgent = true;
    } else if ((feld === "allow" || feld === "disallow") && laufend) {
      zuletztAgent = false;
      // „Disallow:" ohne Wert heißt: nichts verboten.
      if (wert) laufend.regeln.push({ erlaubt: feld === "allow", muster: wert });
    } else {
      zuletztAgent = false;
    }
  }
  const n = name.toLowerCase();
  const eigene = gruppen.filter((g) => g.agenten.some((a) => a !== "*" && a.length >= 3 && n.startsWith(a)));
  const wahl = eigene.length ? eigene : gruppen.filter((g) => g.agenten.includes("*"));
  return wahl.flatMap((g) => g.regeln);
}

function passt(muster: string, pfad: string): boolean {
  const anker = muster.endsWith("$");
  const kern = (anker ? muster.slice(0, -1) : muster).split("*").map((t) => t.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*");
  try { return new RegExp(`^${kern}${anker ? "$" : ""}`).test(pfad); } catch { return false; }
}

/** Darf dieser Pfad (mit Query) abgerufen werden? */
export function robotsErlaubt(regeln: RobotsRegel[], pfad: string): boolean {
  let beste: RobotsRegel | null = null;
  for (const r of regeln) {
    if (!passt(r.muster, pfad || "/")) continue;
    if (!beste || r.muster.length > beste.muster.length || (r.muster.length === beste.muster.length && r.erlaubt)) beste = r;
  }
  return beste ? beste.erlaubt : true;
}
