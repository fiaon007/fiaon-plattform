// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DAS REGISTER DER UNTERSEITEN (19.09.2026, E-191)
// Eine Liste, aus der Seite, Menü, SEO-Tabelle, FAQ und Prüfstände lesen.
// ═══════════════════════════════════════════════════════════════════════════
import type { GlobalBlock, GlobalLandingpage, GlobalSeite } from "./typen";
import { globalMenuePunkt } from "../fiaon-global-menue";
import { LEISTUNGEN } from "./leistungen";
import { PREISE_UND_ABLAUF } from "./preise";
import { KOSTEN } from "./kosten";
import { ZIELGRUPPEN } from "./zielgruppen";
import { STAATEN } from "./staaten";
import { WISSEN } from "./wissen";
import { PARTNER_SEITE } from "./partner";
import { PRIVAT_SEITE } from "./privat";
import { LANDINGPAGES } from "./landingpages";
import { fragenSeite } from "./fragen";

export * from "./typen";

/** Alle Unterseiten ohne die Fragen-Seite (die sammelt aus allen anderen). */
const OHNE_FRAGEN: GlobalSeite[] = [...LEISTUNGEN, ...KOSTEN, ...PREISE_UND_ABLAUF, ...ZIELGRUPPEN, PRIVAT_SEITE, ...STAATEN, ...WISSEN, PARTNER_SEITE];

export const GLOBAL_SEITEN: GlobalSeite[] = [...OHNE_FRAGEN, fragenSeite(OHNE_FRAGEN)];
export { LANDINGPAGES };

const NACH_PFAD = new Map(GLOBAL_SEITEN.map((s) => [s.pfad, s]));
const LP_NACH_PFAD = new Map(LANDINGPAGES.map((s) => [s.pfad, s]));

const norm = (pfad: string) => (pfad.split("?")[0].split("#")[0].replace(/\/+$/, "") || "/").toLowerCase();

export function globalSeite(pfad: string): GlobalSeite | null {
  return NACH_PFAD.get(norm(pfad)) ?? null;
}
export function globalLandingpage(pfad: string): GlobalLandingpage | null {
  return LP_NACH_PFAD.get(norm(pfad)) ?? null;
}

export { globalMenue, GLOBAL_MENUE_GRUPPEN, globalMenuePunkt } from "../fiaon-global-menue";

/** Die Brotkrumen unterhalb der Startseite: Business → Gruppe → Seite. */
export function globalKrumen(s: GlobalSeite): { name: string; pfad: string }[] {
  const k = [{ name: "FIAON Global", pfad: "/business" }];
  if (s.pfad.startsWith("/business/wissen/")) k.push({ name: "Wissen", pfad: "/business/wissen" });
  k.push({ name: globalMenuePunkt(s.pfad)?.titel ?? s.h1.replace(/[.?!]$/, ""), pfad: s.pfad });
  return k;
}

/** Das Inhaltsverzeichnis einer Seite: jeder Baustein mit Überschrift. */
export function globalInhalt(s: GlobalSeite): { id: string; titel: string }[] {
  const mitTitel = s.bloecke.filter((b): b is Extract<GlobalBlock, { h2: string }> => "h2" in b && !!b.h2);
  const liste = [{ id: "kurz", titel: "Kurz beantwortet" }, ...mitTitel.map((b) => ({ id: b.id, titel: b.h2 }))];
  if (s.fragen.length) liste.push({ id: "fragen", titel: "Häufige Fragen" });
  return liste;
}

/** Ein Baustein als Klartext — für den Korpus der Suchmaschinen (derselbe Inhalt wie sichtbar). */
export function blockAlsText(b: GlobalBlock, seitenTitel: (pfad: string) => string): { h2: string; text: string; punkte?: string[] } | null {
  switch (b.typ) {
    case "text": return { h2: b.h2, text: [...b.absaetze, ...(b.nach ? [b.nach] : [])].join(" "), punkte: b.punkte };
    case "etappen": return { h2: b.h2, text: b.lead ?? "", punkte: b.etappen.map((e, i) => `${i + 1}. ${e.titel}${e.dauer ? ` (${e.dauer})` : ""}: ${e.text}`) };
    case "rollen": return { h2: b.h2, text: b.lead ?? "", punkte: [`FIAON: ${b.fiaon.join("; ")}`, `Partner: ${b.partner.join("; ")}`, `Sie: ${b.sie.join("; ")}`] };
    case "tabelle": return { h2: b.h2, text: [b.lead ?? "", ...(b.fuss ?? [])].join(" ").trim(), punkte: b.zeilen.map((z) => z.map((zelle, i) => (b.kopf[i] ? `${b.kopf[i]}: ${zelle}` : zelle)).join(" · ")) };
    case "karten": return { h2: b.h2, text: b.lead ?? "", punkte: b.karten.map((k) => `${k.tag ? `${k.tag} — ` : ""}${k.titel}: ${k.text}`) };
    case "hinweis": return { h2: b.h2, text: b.lead ?? "", punkte: b.punkte };
    case "fragen": return { h2: b.h2, text: b.lead ?? "", punkte: b.fragen.map((f) => `${f.f} ${f.a}`) };
    case "verzeichnis": return { h2: b.h2, text: b.lead ?? "", punkte: b.eintraege.map((e) => seitenTitel(e.pfad)) };
    case "zitat": return null;
    case "paket": case "pakete": case "standorte": case "finder": return b.h2 ? { h2: b.h2, text: b.lead ?? "" } : null;
  }
}
