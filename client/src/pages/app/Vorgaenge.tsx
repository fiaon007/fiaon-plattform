// /app/vorgaenge — Was wir für Sie tun (Bauvorlage 3.5): Vorgänge in vier
// Gruppen mit Kante links, zweiter Abschnitt Ansprüche. Gesetz 3: Der Kunde
// sieht die Arbeit — welcher Vorgang wo liegt, seit wann, welche Frist.
import { useState } from "react";
import { Link } from "wouter";
import type { Vorgang } from "./typen";
import { Ansprueche } from "./Bausteine";

const GRUPPEN: { titel: string; staende: string[]; kante: string }[] = [
  { titel: "Wartet auf Sie", staende: ["unterschrift_offen"], kante: "wartet" },
  { titel: "Unterwegs", staende: ["versandt", "nachfrage"], kante: "" },
  { titel: "Bei FIAON", staende: ["eingegangen", "gelesen", "entwurf", "versandbereit"], kante: "" },
  { titel: "Erledigt", staende: ["bewilligt", "abgelehnt", "zurueckgezogen", "erledigt"], kante: "" },
];

export function Vorgaenge({ kundeRef, basis, demo, post, grund, reiter, ansprechpartner }: { kundeRef: string; basis: string; demo: boolean; post: Vorgang[] | null; grund: string | null; reiter: "vorgaenge" | "ansprueche"; ansprechpartner: string | null }) {
  const [tab, setTab] = useState<"vorgaenge" | "ansprueche">(reiter);
  const liste = post ?? [];
  const warten = liste.filter((v) => v.stand === "unterschrift_offen").length;

  return (
    <>
      <h1 className="ap-gruss ap-auf">Was wir für Sie tun<small>{liste.length} {liste.length === 1 ? "Vorgang" : "Vorgänge"}{warten ? ` · ${warten} ${warten === 1 ? "wartet" : "warten"} auf Sie` : ""}</small></h1>
      <div className="ap-segment ap-auf v1" role="tablist">
        <button type="button" role="tab" className={tab === "vorgaenge" ? "aktiv" : ""} aria-selected={tab === "vorgaenge"} onClick={() => setTab("vorgaenge")}>Vorgänge</button>
        <button type="button" role="tab" className={tab === "ansprueche" ? "aktiv" : ""} aria-selected={tab === "ansprueche"} onClick={() => setTab("ansprueche")}>Ansprüche</button>
      </div>

      {tab === "vorgaenge" && (
        <>
          {grund && <div className="ap-karte ap-leer ap-auf v2"><b>Noch einen Moment.</b>{grund}</div>}
          {!post && !grund && <div className="ap-skelett" style={{ height: 160, borderRadius: 14 }} />}
          {post && liste.length === 0 && <div className="ap-karte ap-leer ap-auf v2"><b>Noch kein Vorgang.</b>Der erste entsteht in Ihrem Startgespräch – oder mit Ihrem ersten Brief. <Link href={`${basis}/brief`} className="ap-link">Brief fotografieren</Link></div>}
          {GRUPPEN.map((g) => {
            const zeilen = liste.filter((v) => g.staende.indexOf(v.stand) !== -1);
            if (!zeilen.length) return null;
            return (
              <section key={g.titel} className="ap-abschnitt ap-auf v2">
                <h2 className="ap-abschnitt-titel">{g.titel}</h2>
                {zeilen.map((v) => (
                  <article key={v.id} className={`ap-karte ap-vorgang ${v.stand === "nachfrage" ? "ueberfaellig" : g.kante}`}>
                    <div className="ap-karte-kopf"><h3>{v.artText}</h3>{v.aktenzeichen && <span className="ap-stempel ap-mono" style={{ fontSize: 12 }}>{v.aktenzeichen}</span>}</div>
                    <p style={{ marginTop: 4 }}>
                      {v.stand === "versandt" && <>Bei {v.empfaenger ?? "der Stelle"}{v.versandtAm ? ` seit ${v.versandtAm}` : ""}.{v.fristAm ? ` Antwort bis ${v.fristAm}.` : ""}</>}
                      {v.stand === "nachfrage" && <>Keine Antwort{v.fristAm ? ` bis ${v.fristAm}` : ""}. Wir haben nachgefragt. Sie müssen nichts tun.</>}
                      {(v.stand === "eingegangen" || v.stand === "gelesen") && <>{v.standText}{v.eingegangenAm ? ` · Eingegangen am ${v.eingegangenAm}.` : ""}{v.fristAm && v.stand === "eingegangen" ? ` Wir melden uns bis zum ${v.fristAm}.` : ""}</>}
                      {(v.stand === "entwurf" || v.stand === "versandbereit" || v.stand === "unterschrift_offen") && <>{v.standText}</>}
                      {(v.stand === "bewilligt" || v.stand === "abgelehnt" || v.stand === "zurueckgezogen" || v.stand === "erledigt") && <>{v.standText}{v.aktualisiertAm ? ` · ${v.aktualisiertAm}` : ""}</>}
                    </p>
                    {v.zustaendig && <div className="ap-zeile" style={{ marginTop: 8 }}><span>Kümmert sich</span><b style={{ fontWeight: 500 }}>{v.zustaendig}</b></div>}
                  </article>
                ))}
              </section>
            );
          })}
        </>
      )}

      {tab === "ansprueche" && <Ansprueche kundeRef={kundeRef} demo={demo} ansprechpartner={ansprechpartner} />}
    </>
  );
}
