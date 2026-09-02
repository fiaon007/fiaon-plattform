// ═══════════════════════════════════════════════════════════════════════════
// DAS WISSEN DES COPILOT — ein Werkzeug, viele Quellen (02.09.2026, Scheibe 6)
//
// Justin: „Der Agent soll ALLES wissen." Nicht durch einen längeren Prompt
// (der wird vergessen und veraltet), sondern durch NACHSCHLAGEN: Das Werkzeug
// durchsucht die Quellen des Hauses und liefert die Treffer MIT Stand und
// Quelle — der Copilot antwortet daraus und zitiert. Erklärmodus inklusive:
// „Warum schlägst du das vor?" → dieselben Treffer, dieselben Regeln.
//
// ── QUELLEN (alles, was es schon gibt) ─────────────────────────────────────
//   shared/fiaon-fachwissen.ts          belegte Fakten (Recht, Auskunftei, Zahlen, Haus)
//   shared/fiaon-wissen.ts              das Wissen des öffentlichen Assistenten (Abschnitte)
//   shared/fiaon-leitfaeden.ts          Justins Leitfäden (Schritte, Einwände)
//   shared/fiaon-gespraechs-schritte.ts die Schritte je Lage
//   shared/fiaon-academy.ts             die Kapitel der drei Reisen (was/text/warum)
//   GET /ratgeber                       die veröffentlichten Ratgeber (Titel, Teaser, Pfad)
//
// Die Suche ist bewusst schlicht (Wortüberlappung mit Gewichten) — sie läuft
// ohne Modell, ohne Index, ohne Datenbank, in Millisekunden. Ein Vektorindex
// wäre die zweite Wahrheit über dieselben Texte.
// ═══════════════════════════════════════════════════════════════════════════

import type { Werkzeug, WerkzeugKontext } from "./fiaon-assistent-werkzeuge";
import { FACHWISSEN, suchNormal } from "../../shared/fiaon-fachwissen";
import { wissenText } from "../../shared/fiaon-wissen";
import { ARTEN } from "../../shared/fiaon-leitfaeden";
import { GESPRAECHS_SCHRITTE } from "../../shared/fiaon-gespraechs-schritte";
import { REISEN } from "../../shared/fiaon-academy";

const ROLLEN = ["agent", "onboarding", "inkasso", "vertriebsleiter", "admin", "chef"];

interface Eintrag {
  quelle: "fachwissen" | "assistent" | "leitfaden" | "gespraech" | "academy" | "ratgeber";
  titel: string;
  text: string;
  stand?: string | null;
  beleg?: string | null;
  pfad?: string | null;
  /** Vorberechnete Suchform (Titel doppelt gewichtet). */
  such: string;
  suchTitel: string;
}

/** Die festen Quellen werden EINMAL aufgebaut — sie ändern sich nur mit dem Code. */
let FESTE: Eintrag[] | null = null;
function festeEintraege(): Eintrag[] {
  if (FESTE) return FESTE;
  const e: Eintrag[] = [];
  // Kuratierte Suchwörter zählen wie der Titel — sie sind die Absicht des Eintrags.
  const mach = (x: Omit<Eintrag, "such" | "suchTitel">, worte: string[] = []) =>
    e.push({ ...x, such: suchNormal(x.text), suchTitel: suchNormal(`${x.titel} ${worte.join(" ")}`) });

  for (const f of FACHWISSEN) mach({ quelle: "fachwissen", titel: f.titel, text: f.text, stand: f.stand, beleg: f.quelle, pfad: f.seiten?.[0] ?? null }, f.worte);

  // Der Assistenten-Text in Abschnitte (Überschriften in GROSSBUCHSTABEN).
  const abschnitte = wissenText().split(/\n(?=[A-ZÄÖÜ][A-ZÄÖÜ ,()/–-]{6,}\n)/);
  for (const a of abschnitte) {
    const [kopf, ...rest] = a.trim().split("\n");
    if (!rest.length) continue;
    mach({ quelle: "assistent", titel: kopf.trim(), text: rest.join("\n").trim(), stand: null, beleg: "shared/fiaon-wissen.ts", pfad: null });
  }

  for (const l of ARTEN) {
    mach({
      quelle: "leitfaden", titel: `Leitfaden: ${l.label}`,
      text: `${l.kurz}\n${l.schritte.map((s, i) => `${i + 1}. ${s.titel}${s.satz ? ` — „${s.satz}“` : ""}`).join("\n")}\nEinwände: ${l.einwaende.map((x) => `${x.frage} → ${x.antwort}`).join(" | ")}`,
      stand: "2026-08-23", beleg: "shared/fiaon-leitfaeden.ts (Justin, Plan §13)", pfad: "/agent/tools/gespraech",
    }, [l.key.replace("_", " ")]);
  }

  for (const [lage, schritte] of Object.entries(GESPRAECHS_SCHRITTE)) {
    mach({ quelle: "gespraech", titel: `Schritte bei Lage „${lage}“`, text: schritte.map((s) => `${s.titel} ${s.satz}`).join("\n"), stand: "2026-08-25", beleg: "shared/fiaon-gespraechs-schritte.ts", pfad: null }, [lage.replace(/_/g, " ")]);
  }

  for (const r of REISEN) {
    for (const k of r.kapitel) {
      mach({ quelle: "academy", titel: `Academy ${r.titel ?? r.key}: ${k.was}`, text: `${k.text}\nWarum: ${k.warum}${k.zahlen?.length ? `\nZahlen: ${k.zahlen.join("; ")}` : ""}`, stand: null, beleg: k.quelle || "shared/fiaon-academy.ts", pfad: k.weg?.pfad ?? `/agent/academy#${k.key}` });
    }
  }
  FESTE = e;
  return e;
}

/** Die Ratgeber kommen vom Server (öffentlicher Endpunkt, 120 s Cache) — nie aus der DB. */
async function ratgeberEintraege(kontext: WerkzeugKontext): Promise<Eintrag[]> {
  try {
    const r = await kontext.intern("GET", "/ratgeber");
    if (!r.json?.ok) return [];
    return (r.json.artikel || []).map((a: any): Eintrag => ({
      quelle: "ratgeber", titel: `Ratgeber: ${a.titel}`, text: String(a.teaser || ""), stand: a.veroeffentlichtAm ? String(a.veroeffentlichtAm).slice(0, 10) : null,
      beleg: "fiaon.com/ratgeber", pfad: `/ratgeber/${a.slug}`,
      such: suchNormal(`${a.teaser || ""} ${a.kategorie || ""} ${a.land || ""}`), suchTitel: suchNormal(String(a.titel || "")),
    }));
  } catch { return []; }
}

const FUELLWORTE = new Set(["wie", "was", "wann", "wo", "warum", "ist", "sind", "der", "die", "das", "ein", "eine", "und", "oder", "bei", "von", "mit", "fuer", "auf", "im", "in", "zu", "den", "dem", "des", "es", "ich", "man", "kann", "darf", "muss", "soll", "noch", "auch", "nach", "vor", "ueber", "einen", "einer", "lange", "viel", "welche", "welcher", "welches"]);

function bewerten(frage: string, e: Eintrag): number {
  const worte = suchNormal(frage).split(" ").filter((w) => w.length > 2 && !FUELLWORTE.has(w));
  if (!worte.length) return 0;
  let punkte = 0;
  for (const w of worte) {
    const stamm = w.length > 5 ? w.slice(0, 5) : w; // grobe Stammform: „bleibt" trifft „bleiben", „loeschfristen" trifft „loeschfrist"
    if (e.suchTitel.includes(stamm)) punkte += 3;
    if (e.such.includes(stamm)) punkte += 1;
  }
  return punkte / worte.length;
}

export const WERKZEUGE_WISSEN: Werkzeug[] = [
  {
    name: "wissen_nachschlagen",
    titel: "Wissen nachschlagen",
    beschreibung:
      "Schlägt Fachwissen und Hausregeln nach, mit Stand und Quelle: Recht (BDSG, DSGVO, RDG, ZPO, ZKG, BGB), "
      + "Auskunfteien (neuer SCHUFA-Score 2026, Löschfristen, Datenkopie), Zahlen (Pfändungsfreigrenzen, Dispozins), "
      + "FIAON-Regeln (erste Zahlung, Mandat, Provision, Wortverbote, Copilot-Grenzen), Leitfäden, Academy-Kapitel "
      + "und die veröffentlichten Ratgeber. Benutzen bei JEDER Sachfrage („Wie lange bleibt …?“, „Darf ich …?“, "
      + "„Was sagt der Leitfaden zu …?“) und auf „Warum schlägst du das vor?“. Nenne im Antworttext Stand und Quelle.",
    stufe: "frei",
    zugang: "offen",
    rollen: ROLLEN,
    jsonSchema: {
      type: "object",
      properties: {
        frage: { type: "string", description: "Die Frage oder die Stichwörter" },
        bereich: { type: "string", description: "Optional: recht | auskunftei | zahlen | fiaon | haus | leitfaden | ratgeber | academy" },
      },
      required: ["frage"],
      additionalProperties: false,
    },
    ausfuehren: async (p, kontext) => {
      const frage = String(p?.frage || "").trim();
      if (frage.length < 3) return { ok: false, error: "Bitte eine Frage oder Stichwörter angeben." };
      const bereich = String(p?.bereich || "").trim().toLowerCase();
      const alle = [...festeEintraege(), ...(await ratgeberEintraege(kontext))];
      const gefiltert = bereich
        ? alle.filter((e) => e.quelle === bereich || (e.quelle === "fachwissen" && FACHWISSEN.some((f) => f.bereich === bereich && f.titel === e.titel)))
        : alle;
      const treffer = gefiltert
        .map((e) => ({ e, punkte: bewerten(frage, e) }))
        // Unter 0,75 ist es Zufall (ein Wort von vielen) — lieber ehrlich „kein Treffer".
        .filter((t) => t.punkte >= 0.75)
        .sort((a, b) => b.punkte - a.punkte)
        .slice(0, 6)
        .map(({ e, punkte }) => ({
          quelle: e.quelle, titel: e.titel, text: e.text.length > 1400 ? `${e.text.slice(0, 1400)} …` : e.text,
          stand: e.stand ?? null, beleg: e.beleg ?? null, pfad: e.pfad ?? null, gewicht: Math.round(punkte * 100) / 100,
        }));
      return {
        ok: true,
        frage,
        anzahl: treffer.length,
        treffer,
        hinweis: treffer.length
          ? "Antworte aus diesen Treffern, nenne Stand und Quelle. Was nicht drinsteht, weißt du nicht — sag das."
          : "Kein Treffer. Sag ehrlich, dass das Haus dazu nichts Belegtes hat, und schlage vor, es beim Betreiber (TODO) anzufragen.",
      };
    },
  },
];
