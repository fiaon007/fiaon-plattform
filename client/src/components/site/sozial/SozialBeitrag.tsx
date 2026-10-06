// ═══════════════════════════════════════════════════════════════════════════
// EIN BEITRAG ZUM THEMA (E-296, 06.10.2026) — „Passend dazu auf Instagram“
//
// Im Ratgeber-Artikel: GENAU EIN Beitrag, dessen Themen zur Kategorie oder zu
// den Schlagworten des Artikels passen. Passt keiner, steht hier nichts — kein
// Platzhalter, kein Ersatz-Beitrag. Die Themen der Posts kommen aus dem
// Social-Studio (Wortschatz der Post-Maschine: bonitaet, schufa, score,
// auskunft, dsgvo, loeschung, pkonto, basiskonto, konto, karte, ksv,
// oesterreich, dach, …); die Kategorien des Ratgebers sind andere Wörter —
// deshalb die Übersetzung unten. Im Feed stehen nur Beiträge, die auf Instagram
// als veröffentlicht gemeldet sind — „Passend dazu auf Instagram“ stimmt also.
// Bild und Knopf öffnen die große Ansicht (mit dem Link zu Instagram darin).
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useRef, useState } from "react";
import type { SozialFeedPost } from "@shared/fiaon-sozial-feed";
import { SOZIALE_PROFILE } from "@shared/fiaon-sozial";
import { useWoerter } from "@/i18n/sprache";
import { SOZIAL_WOERTER } from "@/i18n/sozial";
import { useEinmalSichtbar } from "@/components/site/global/bewegung";
import { anzeigeText, bildMasse, sozialDatum, useSozialFeed } from "./sozial-daten";
import { SozialAnsicht } from "./SozialAnsicht";
import { KanalZeichen, KarussellZeichen, NachAussenZeichen, PfeilZeichen, ReelZeichen } from "./SozialZeichen";
import { SozialBild } from "./SozialBild";
import "@/styles/sozial-fenster.css";

/** Ratgeber-Kategorie → Themen der Posts, das wichtigste zuerst (es geht als ?thema= an den Feed). */
const KATEGORIE_THEMEN: Record<string, string[]> = {
  eintraege: ["loeschung", "schufa"],
  auskunft: ["auskunft", "dsgvo", "schufa"],
  karte: ["karte", "konto", "basiskonto"],
  kredit: ["bonitaet", "score"],
  score: ["score", "schufa", "bonitaet"],
  inkasso: ["pkonto", "konto"],
  at: ["ksv", "oesterreich", "dach"],
  ch: ["dach"],
  grundlagen: ["bonitaet", "schufa", "auskunft"],
};

/** Schlagworte („Art. 17 DSGVO“, „Basiskonto“, „Löschantrag“) → Themen der Posts. Wortstämme, kein Raten. */
const STAEMME: [RegExp, string][] = [
  [/basiskonto/, "basiskonto"], [/p-?konto|pfaend/, "pkonto"], [/konto/, "konto"], [/karte/, "karte"],
  [/loesch|erledigungsvermerk/, "loeschung"], [/score/, "score"], [/schufa/, "schufa"], [/bonitaet/, "bonitaet"],
  [/auskunft|datenkopie/, "auskunft"], [/dsgvo|bdsg/, "dsgvo"], [/\bksv\b/, "ksv"], [/oesterreich/, "oesterreich"],
];
const einfach = (s: string) => s.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");

/** Gewichte: Themen der Kategorie zählen mehr (3, 2, 1) als Themen aus Schlagworten (1). */
export function artikelThemen(kategorie: string, schlagworte: string[]): Map<string, number> {
  const g = new Map<string, number>();
  (KATEGORIE_THEMEN[kategorie] ?? []).forEach((t, i) => g.set(t, Math.max(g.get(t) ?? 0, 3 - Math.min(i, 2))));
  for (const s of schlagworte) {
    const e = einfach(s);
    for (const [muster, thema] of STAEMME) if (muster.test(e)) g.set(thema, Math.max(g.get(thema) ?? 0, 1));
  }
  return g;
}

/** Der beste Beitrag: höchste Summe der Gewichte; bei Gleichstand der neuere. Keiner passt → null. */
export function passenderBeitrag(posts: SozialFeedPost[], themen: Map<string, number>): SozialFeedPost | null {
  let best: SozialFeedPost | null = null, bestWert = 0;
  for (const p of posts) {
    const wert = p.themen.reduce((s, t) => s + (themen.get(t) ?? 0), 0);
    if (wert > bestWert || (wert === bestWert && wert > 0 && best && p.datum > best.datum)) { best = p; bestWert = wert; }
  }
  return bestWert > 0 ? best : null;
}

export function SozialBeitrag({ kategorie, schlagworte }: { kategorie: string; schlagworte: string[] }) {
  const ort = useRef<HTMLDivElement>(null);
  const themen = useMemo(() => artikelThemen(kategorie, schlagworte), [kategorie, schlagworte]);
  // Der Ratgeber gehört zur Privatwelt: nur Beiträge der Marke FIAON, nie FIAON Global.
  const daten = useSozialFeed(ort, { marke: "fiaon", n: 12, thema: KATEGORIE_THEMEN[kategorie]?.[0] });
  const post = useMemo(() => (daten.stand === "voll" ? passenderBeitrag(daten.posts, themen) : null), [daten, themen]);
  const ig = daten.profile.find((p) => p.kanal === "instagram") ?? SOZIALE_PROFILE[0];
  // Ohne passenden Beitrag bleibt nur der leere Anker für den Beobachter — keine Höhe, nichts zu sehen.
  return <div ref={ort}>{post && <BeitragKarte post={post} profilHref={ig.href} />}</div>;
}

function BeitragKarte({ post, profilHref }: { post: SozialFeedPost; profilHref: string }) {
  const w = useWoerter(SOZIAL_WOERTER);
  const karte = useRef<HTMLElement>(null);
  const [offen, setOffen] = useState(false);
  useEinmalSichtbar(karte, 0.2);
  const b = post.bilder[0].klein;
  const m = bildMasse(b);
  const datum = sozialDatum(post.datum, w.locale);
  // Die Caption beginnt oft wörtlich mit dem Titel — der steht hier schon als Überschrift.
  const titel = anzeigeText(post.titel);
  const roh = anzeigeText(post.text);
  const text = roh.toLowerCase().startsWith(titel.toLowerCase().replace(/[.!?…]+$/, "")) ? roh.slice(titel.replace(/[.!?…]+$/, "").length).replace(/^[\s.!?…:–-]+/, "") : roh;
  const lang = w.inhaltLang || undefined;
  const art = post.format === "karussell" && post.bilder.length > 1 ? w.karussell : post.format === "reel" ? w.reel : "";
  return (
    <>
      <aside ref={karte} className="sz-beitrag" aria-label={w.passend}>
        {/* Der Name sagt Ziel, Titel (in der Sprache des Beitrags), Format und den KI-Hinweis (Art. 50 KI-VO). */}
        <button type="button" className="sz-beitrag-bild" onClick={() => setOffen(true)}>
          <SozialBild src={b.url} width={m.width} height={m.height} />
          {art && <span className="sz-art" aria-hidden="true">{post.format === "reel" ? <ReelZeichen groesse={15} /> : <KarussellZeichen groesse={15} />}</span>}
          {post.ki && <span className="sz-ki" aria-hidden="true">{w.kiHinweis}</span>}
          <span className="sz-unsichtbar">{w.ansehenVor} </span>
          <span className="sz-unsichtbar" lang={lang}>{titel}</span>
          {art && <span className="sz-unsichtbar">, {art}</span>}
          {post.ki && <span className="sz-unsichtbar">, {w.kiHinweis}</span>}
        </button>
        <div>
          <p className="sz-beitrag-kicker"><KanalZeichen kanal="instagram" groesse={14} />{w.passend}</p>
          <h3 className="sz-beitrag-titel" lang={lang}>{titel}</h3>
          {text && <p className="sz-beitrag-text" lang={lang}>{text}</p>}
          <p className="sz-beitrag-meta">{datum && <time dateTime={post.datum}>{datum}</time>}{post.ki && <span className="sz-ki">{w.kiHinweis}</span>}</p>
          <div className="sz-beitrag-fuss">
            <button type="button" className="sz-beitrag-knopf" onClick={() => setOffen(true)}>{w.ansehen}<PfeilZeichen groesse={14} /></button>
            <a className="sz-beitrag-folgen" href={profilHref} target="_blank" rel="noopener noreferrer">{w.folgenHandle}<NachAussenZeichen /></a>
          </div>
        </div>
      </aside>
      {offen && <SozialAnsicht post={post} w={w} aussehen="hell" onSchliessen={() => setOffen(false)} />}
    </>
  );
}

export default SozialBeitrag;
