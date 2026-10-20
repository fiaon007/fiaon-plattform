// ═══════════════════════════════════════════════════════════════════════════
// BILDER, SPRACHNACHRICHTEN, DOKUMENTE IN DER BLASE (20.10.2026)
//
// Wie bei WhatsApp direkt im Verlauf: Foto, Sticker, Sprachnachricht, Video,
// Dokument, Standort, Kontakt. Die Datei holt der Server erst beim Hinsehen
// bei Meta (…/medien/<id>) — liegt sie dort nicht mehr, steht ein sauberer
// Platzhalter mit dem Grund da, nie ein kaputtes Bild.
// Nachrichten von vor dem 20.10.2026 haben keine gemerkte Datei: Dort steht
// der Platzhalter „Foto · nur beim Kunden" wie bisher.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import { artAusTyp, medienText, type MedienAnzeige, type MedienArt, type Nachricht } from "./wr-format";
import { ZBild, ZDokument, ZLaden, ZMikro, ZOrt, ZPerson, ZVideo, ZWarnung } from "./Symbole";

function Zeichen({ art, g = 22 }: { art: MedienArt | null; g?: number }) {
  if (art === "bild" || art === "sticker") return <ZBild g={g} />;
  if (art === "audio") return <ZMikro g={g} />;
  if (art === "video") return <ZVideo g={g} />;
  if (art === "standort") return <ZOrt g={g} />;
  if (art === "kontakt") return <ZPerson g={g} />;
  return <ZDokument g={g} />;
}

/** Der saubere Platzhalter: Zeichen, Art und ein kurzer Grund. */
export function MedienPlatzhalter({ art, grund, titel }: { art: MedienArt | null; grund: string; titel?: string }) {
  return (
    <div className="wr-medien-platz" title={titel}>
      <span className="wr-medien-zeichen" aria-hidden="true"><Zeichen art={art} /></span>
      <span className="wr-medien-wort"><b>{medienText(art) ?? "Nachricht"}</b><small>{grund}</small></span>
    </div>
  );
}

function groesseText(mime: string | null): string {
  const m = String(mime ?? "");
  if (m === "application/pdf") return "PDF";
  if (m.startsWith("image/")) return "Bild";
  if (/word|officedocument\.wordprocessing/.test(m)) return "Word";
  if (/excel|spreadsheet/.test(m)) return "Tabelle";
  return "Datei";
}

/** Ein Dokument: Karte mit Namen; Klick holt die Datei (Fehler ehrlich statt einer JSON-Seite). */
function DokumentKarte({ url, m }: { url: string; m: MedienAnzeige }) {
  const [zustand, setZustand] = useState<"bereit" | "laedt" | string>("bereit");
  const holen = async () => {
    if (zustand === "laedt") return;
    setZustand("laedt");
    try {
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) {
        const j = await r.json().catch(() => null);
        setZustand(j?.error || "Die Datei ließ sich nicht laden.");
        return;
      }
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = m.name || "whatsapp-datei";
      document.body.appendChild(a); a.click(); a.remove();
      window.setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
      setZustand("bereit");
    } catch { setZustand("Keine Verbindung."); }
  };
  const fehler = zustand !== "bereit" && zustand !== "laedt" ? zustand : null;
  return (
    <div className="wr-dok">
      <button type="button" className="wr-dok-karte" onClick={() => void holen()} disabled={zustand === "laedt"} title="Datei herunterladen">
        <span className="wr-medien-zeichen" aria-hidden="true"><ZDokument g={24} /></span>
        <span className="wr-medien-wort"><b>{m.name || "Dokument"}</b><small>{groesseText(m.mime)}{zustand === "laedt" ? " · lädt …" : ""}</small></span>
        <span className="wr-dok-laden" aria-hidden="true"><ZLaden g={18} /></span>
      </button>
      {fehler && <small className="wr-medien-fehler"><ZWarnung g={13} />{fehler}</small>}
    </div>
  );
}

/** Ein Foto (oder Sticker): direkt in der Blase; Klick öffnet es groß im neuen Tab. */
function Foto({ url, sticker }: { url: string; sticker: boolean }) {
  const [kaputt, setKaputt] = useState(false);
  const [versuch, setVersuch] = useState(0);
  if (kaputt) {
    return (
      <div className="wr-medien-platz">
        <span className="wr-medien-zeichen" aria-hidden="true"><ZBild g={22} /></span>
        <span className="wr-medien-wort"><b>{sticker ? "Sticker" : "Foto"}</b><small>Ließ sich gerade nicht laden.</small></span>
        <button type="button" className="wr-textknopf" onClick={() => { setKaputt(false); setVersuch((v) => v + 1); }}>Erneut</button>
      </div>
    );
  }
  const src = versuch ? `${url}?v=${versuch}` : url;
  return (
    <a className={sticker ? "wr-sticker" : "wr-foto"} href={src} target="_blank" rel="noopener" title={sticker ? "Sticker" : "Foto groß öffnen"}>
      <img src={src} alt={sticker ? "Sticker vom Kunden" : "Foto vom Kunden"} loading="lazy" decoding="async" onError={() => setKaputt(true)} />
    </a>
  );
}

/** Ton oder Video: der Browser spielt es ab; scheitert es, steht der Platzhalter da. */
function Abspieler({ url, art, sprache }: { url: string; art: "audio" | "video"; sprache: boolean }) {
  const [kaputt, setKaputt] = useState(false);
  if (kaputt) return <MedienPlatzhalter art={art} grund="Ließ sich gerade nicht laden." />;
  return art === "audio" ? (
    <div className="wr-ton">
      <span className="wr-ton-zeichen" aria-hidden="true"><ZMikro g={20} /></span>
      <span className="wr-ton-teil">
        <small>{sprache ? "Sprachnachricht" : "Audio"}</small>
        <audio controls preload="none" src={url} onError={() => setKaputt(true)} />
      </span>
    </div>
  ) : (
    <video className="wr-video" controls preload="metadata" src={url} onError={() => setKaputt(true)} />
  );
}

/**
 * Was die Nachricht trug — oder null, wenn sie nur Text ist.
 * `api` ist /api/fiaon/<tür>/whatsapp (dieselbe Sicht wie das Gespräch).
 */
export function MedienInhalt({ n, api }: { n: Nachricht; api: string }) {
  const m = n.medien ?? null;
  const art: MedienArt | null = m?.art ?? artAusTyp(n.typ);
  if (!art || art === "reaktion") return null;
  const url = `${api}/medien/${n.id}`;
  // Ohne gemerkte Datei (vor dem 20.10.2026 oder Meta nannte keine Kennung): ehrlicher Platzhalter.
  if (!m) {
    return (
      <MedienPlatzhalter art={art} grund="Nur beim Kunden in WhatsApp zu sehen."
        titel="Diese Nachricht kam, bevor der Raum Dateien zeigen konnte. Bitte den Kunden, sie noch einmal zu schicken — oder ruf an." />
    );
  }
  if (art === "standort") {
    const karte = m.lat != null && m.lng != null ? `https://www.google.com/maps?q=${m.lat},${m.lng}` : null;
    return (
      <div className="wr-medien-platz">
        <span className="wr-medien-zeichen" aria-hidden="true"><ZOrt g={22} /></span>
        <span className="wr-medien-wort"><b>{m.ort || "Standort"}</b>
          {karte ? <a href={karte} target="_blank" rel="noopener noreferrer">In Karten öffnen</a> : <small>Ohne Koordinaten</small>}
        </span>
      </div>
    );
  }
  if (art === "kontakt") {
    return (
      <div className="wr-medien-platz">
        <span className="wr-medien-zeichen" aria-hidden="true"><ZPerson g={22} /></span>
        <span className="wr-medien-wort">
          {(m.kontakte ?? []).map((k, i) => <b key={i}>{k.name}{k.nummer ? <small> {k.nummer}</small> : null}</b>)}
          {!(m.kontakte ?? []).length && <b>Kontakt</b>}
        </span>
      </div>
    );
  }
  if (!m.datei) return <MedienPlatzhalter art={art} grund="WhatsApp hat keine Datei mitgeschickt." />;
  if (art === "bild" || art === "sticker") return <Foto url={url} sticker={art === "sticker"} />;
  if (art === "audio" || art === "video") return <Abspieler url={url} art={art} sprache={m.sprache} />;
  return <DokumentKarte url={url} m={m} />;
}
