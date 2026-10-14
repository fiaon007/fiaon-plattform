// ═══════════════════════════════════════════════════════════════════════════
// DIE REIHE DER KUNDENLISTE — „Nächster Kunde“ in der Akte (14.10.2026)
//
// Florentine: „Im Chefbüro, bei Alle Kunden, wäre es super, wenn ich einfach auf
// ‚nächster Kunde‘ drücken kann. So muss ich immer zurück und wieder runter scrollen
// zu dem Kunden, wo ich war.“
//
// Die Liste (ChefKundenliste) legt beim Laden ihre sichtbare Reihe ab — Personen in
// der Reihenfolge der Seite, dazu Filter, Sortierung, Suche und Seite. Die Akte
// (ZentraleAkte) blättert darin vor und zurück und lädt an den Seitenrändern die
// nächste bzw. vorige Seite derselben Auswahl nach. Zurück in der Liste steht man
// wieder auf derselben Seite, beim zuletzt geöffneten Kunden.
// Nur sessionStorage: je Tab, nichts auf dem Server, nach 12 Stunden verworfen.
// ═══════════════════════════════════════════════════════════════════════════

const SCHLUESSEL = "fiaon_akte_reihe";
const HALTBAR_MS = 12 * 60 * 60 * 1000;

export interface ReiheEintrag { id: number; name: string }
export interface AkteReihe {
  eintraege: ReiheEintrag[];
  filter: string; sort: string; suche: string;
  seite: number; seiten: number; gesamt: number; proSeite: number;
  /** Zuletzt in der Akte geöffnet — die Liste springt beim Zurückkommen dorthin. */
  zuletzt: number | null;
  am: number;
}

export function reiheLesen(): AkteReihe | null {
  try {
    const r = JSON.parse(sessionStorage.getItem(SCHLUESSEL) || "null") as AkteReihe | null;
    if (!r || !Array.isArray(r.eintraege) || Date.now() - Number(r.am || 0) > HALTBAR_MS) return null;
    return r;
  } catch {
    return null;
  }
}

export function reiheSpeichern(r: Omit<AkteReihe, "am" | "zuletzt"> & { zuletzt?: number | null }): void {
  try {
    const alt = reiheLesen();
    sessionStorage.setItem(SCHLUESSEL, JSON.stringify({ ...r, zuletzt: r.zuletzt ?? alt?.zuletzt ?? null, am: Date.now() }));
  } catch { /* privates Fenster o. Ä. — dann eben ohne Blättern */ }
}

export function reiheZuletzt(id: number): void {
  const r = reiheLesen();
  if (!r) return;
  try { sessionStorage.setItem(SCHLUESSEL, JSON.stringify({ ...r, zuletzt: id, am: Date.now() })); } catch { /* egal */ }
}

/** Eine Seite derselben Auswahl nachladen (am Rand der Reihe). */
export async function reiheSeiteLaden(r: AkteReihe, seite: number): Promise<AkteReihe | null> {
  const pfad = `/api/fiaon/chef/kunden?filter=${encodeURIComponent(r.filter)}&sort=${encodeURIComponent(r.sort)}&seite=${seite}&proSeite=${r.proSeite}`
    + (r.suche ? `&q=${encodeURIComponent(r.suche)}` : "");
  try {
    const res = await fetch(pfad, { credentials: "include" });
    const j = await res.json().catch(() => null);
    if (!j?.ok || !Array.isArray(j.zeilen)) return null;
    const neu: AkteReihe = {
      ...r, eintraege: reiheAusZeilen(j.zeilen), seite: Number(j.seite ?? seite), seiten: Number(j.seiten ?? r.seiten), gesamt: Number(j.gesamt ?? r.gesamt), am: Date.now(),
    };
    reiheSpeichern(neu);
    return neu;
  } catch {
    return null;
  }
}

/** Aus den Zeilen der Liste: nur Personen mit eigener Akte (Firmenkunden führen ins Mandat, nicht in die Akte). */
export function reiheAusZeilen(zeilen: any[]): ReiheEintrag[] {
  return zeilen
    .filter((z) => !z?.global && Number(z?.id) > 0)
    .map((z) => ({
      id: Number(z.id),
      name: [z.first_name, z.last_name].filter(Boolean).join(" ").trim() || String(z.company_name || "").trim() || `Person ${z.id}`,
    }));
}
