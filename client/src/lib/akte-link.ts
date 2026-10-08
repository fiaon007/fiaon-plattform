// ═══════════════════════════════════════════════════════════════════════════
// DER LINK IN EINE AKTE (E-IT-E, 08.10.2026, Punkt 5)
//
// Zwölf Stellen im Chefbüro bauten den Link selbst: `/chef/s/akte?id=${x}`.
// Fehlte die Kennung, entstand „?id=null" oder „?id=undefined" — und die Akte
// meldete „nicht gefunden" für einen Link, der nie eine Kennung trug. Die
// Kunden-Zentrale sprang außerdem nach /admin/kunde und verließ das Chefbüro.
//
// Regel: Ohne Kennung gibt es KEINEN Link (null) — der Aufrufer zeigt dann den
// Namen ohne Link. Im Chefbüro bleibt der Link im Chefbüro. Die Kennung darf
// alles sein, was die Akte auflöst: Personen-Nummer, lead-N, Referenz.
// ═══════════════════════════════════════════════════════════════════════════
import { AKTE_FEHLER_TITEL, akteLinkFuer } from "@shared/fiaon-akte-aufloesung";

/** Läuft die Seite gerade im Chefbüro (/chef, /chef/<raum>, /chef/s/<seite>)? */
export function imChefbuero(): boolean {
  return typeof window !== "undefined" && window.location.pathname.startsWith("/chef");
}

/**
 * Der Link in die Akte — oder `null`, wenn keine Kennung da ist.
 * Ohne `ort` entscheidet die aktuelle Adresse: im Chefbüro /chef/s/akte, sonst /admin/kunde.
 */
export function akteLink(kennung: unknown, ort?: "chef" | "admin"): string | null {
  return akteLinkFuer(kennung, ort ?? (imChefbuero() ? "chef" : "admin"));
}

/**
 * Titel und Satz für eine Akte, die nicht aufging — aus der Server-Antwort.
 * Für die Agenten-Akten (Pipeline, Bestand, Forderungen): Statt immer „Akte
 * nicht gefunden … oder die Kennung stimmt nicht" steht der GRUND da
 * (keine Freigabe, Person gibt es nicht, Kette kaputt, Sitzung, Server).
 */
export function akteFehlerAus(r: { status?: number; json?: any } | null | undefined): { titel: string; text: string } {
  const st = Number(r?.status ?? 0);
  const grund = r?.json?.grund as keyof typeof AKTE_FEHLER_TITEL | undefined;
  if (st === 401 || st === 403) {
    return { titel: AKTE_FEHLER_TITEL.sitzung, text: r?.json?.error || "Bitte neu anmelden — danach öffnet die Akte wieder." };
  }
  if (st === 0 || st >= 500) {
    return { titel: AKTE_FEHLER_TITEL.server, text: r?.json?.error || "Bitte die Seite neu laden." };
  }
  return {
    titel: (grund && AKTE_FEHLER_TITEL[grund]) || "Akte nicht gefunden",
    text: r?.json?.error || "Dieser Kunde gehört nicht zu deinem Bestand oder die Kennung stimmt nicht.",
  };
}
