// /app/brief — Brief fotografieren in drei Schritten (Bauvorlage 3.4):
// 1 Aufnahme · 2 Prüfen (verkleinert auf 2.000 px) · 3 Absenden (Notiz, Dringend)
// → Bestätigung mit Aktenzeichen. Ein Mensch liest binnen zwei Werktagen; kein
// Automat antwortet. Sprachregel: „wir ordnen ihn zu und sagen, was wir daraus
// machen" — nie „was er bedeutet".
import { useRef, useState } from "react";
import { Link } from "wouter";

type Seite = { blob: Blob; url: string; name: string; istPdf: boolean };

async function verkleinern(datei: File): Promise<Seite> {
  if (datei.type === "application/pdf") return { blob: datei, url: "", name: datei.name, istPdf: true };
  const bild = await new Promise<HTMLImageElement>((ok, nein) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => nein(new Error("unlesbar")); i.src = URL.createObjectURL(datei); });
  const max = 2000; const f = Math.min(1, max / Math.max(bild.width, bild.height));
  const c = document.createElement("canvas"); c.width = Math.round(bild.width * f); c.height = Math.round(bild.height * f);
  c.getContext("2d")!.drawImage(bild, 0, 0, c.width, c.height);
  URL.revokeObjectURL(bild.src);
  const blob = await new Promise<Blob>((ok, nein) => c.toBlob((b) => (b ? ok(b) : nein(new Error("leer"))), "image/jpeg", 0.85));
  return { blob, url: URL.createObjectURL(blob), name: datei.name.replace(/\.[^.]+$/, "") + ".jpg", istPdf: false };
}

export function Brief({ kundeRef, basis, demo, ansprechpartner }: { kundeRef: string; basis: string; demo: boolean; ansprechpartner: string | null }) {
  const eingabe = useRef<HTMLInputElement>(null);
  const [seiten, setSeiten] = useState<Seite[]>([]);
  const [schritt, setSchritt] = useState<1 | 2 | 3 | 4>(1);
  const [notiz, setNotiz] = useState("");
  const [dringend, setDringend] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ergebnis, setErgebnis] = useState<{ aktenzeichen: string; text2: string; dringend: boolean } | null>(null);

  const aufnehmen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    setFehler(null);
    try { const s = await verkleinern(f); setSeiten([...seiten, s]); setSchritt(2); }
    catch { setFehler("Diese Datei können wir nicht lesen. Ein Foto mit der Kamera klappt am besten."); }
  };
  const nochEinmal = () => { const rest = seiten.slice(0, -1); setSeiten(rest); setSchritt(rest.length ? 2 : 1); eingabe.current?.click(); };

  const senden = async () => {
    if (!seiten.length) return;
    if (demo) { setErgebnis({ aktenzeichen: "AZ 2026-000000", text2: "In der Demo-Ansicht wird nichts gesendet. Bei echten Kunden ordnet Ihr Ansprechpartner den Brief binnen zwei Werktagen zu.", dringend }); setSchritt(4); return; }
    setLaeuft(true); setFehler(null);
    const fd = new FormData();
    seiten.forEach((s) => fd.append("brief", s.blob, s.name));
    if (notiz.trim()) fd.append("notiz", notiz.trim());
    if (dringend) fd.append("dringend", "1");
    try {
      const r = await fetch(`/api/fiaon/kunde/${encodeURIComponent(kundeRef)}/app/brief`, { method: "POST", body: fd, credentials: "include" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setErgebnis({ aktenzeichen: j.aktenzeichen, text2: j.text2, dringend: !!j.dringend }); setSchritt(4); }
      else setFehler(j?.error || j?.text || "Der Brief konnte nicht gesendet werden. Ihr Foto ist noch da – bitte tippen Sie noch einmal auf Absenden.");
    } catch { setFehler("Ohne Verbindung geht der Brief nicht raus. Ihr Foto bleibt hier, bis Sie wieder online sind."); }
    setLaeuft(false);
  };

  const letzte = seiten[seiten.length - 1];

  return (
    <>
      <input ref={eingabe} type="file" accept="image/*,application/pdf" capture="environment" hidden onChange={aufnehmen} />
      {schritt < 4 && <p className="ap-ruhe ap-auf" style={{ fontSize: 14 }}>Schritt {schritt} von 3 · {schritt === 1 ? "Ihr Brief" : schritt === 2 ? "Prüfen" : "Absenden"}</p>}

      {schritt === 1 && (
        <>
          <h1 className="ap-gruss ap-auf">Ihr Brief<small>Legen Sie den Brief flach hin. Alle vier Ecken ins Bild.</small></h1>
          <button type="button" className="ap-kamera ap-auf v1" onClick={() => eingabe.current?.click()}>
            <svg viewBox="0 0 24 24"><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H8l1.2-2h5.6L16 6h1.5A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z" /><circle cx="12" cy="12.5" r="3.2" /></svg>
            <b style={{ color: "var(--fi-text)", fontWeight: 500 }}>Brief fotografieren</b>
            <span style={{ fontSize: 14 }}>oder eine Datei wählen (JPG, PNG, PDF)</span>
          </button>
          <p className="ap-fuss ap-auf v2">{ansprechpartner ?? "Ihr Ansprechpartner"} ordnet den Brief Ihrer Akte zu und sagt Ihnen unter Vorgänge, was wir daraus machen – mit Datum. Sie müssen nichts erklären.</p>
        </>
      )}

      {schritt === 2 && letzte && (
        <>
          <h1 className="ap-gruss ap-auf">Ist alles lesbar?<small>{seiten.length > 1 ? `Seite ${seiten.length}. ` : ""}Name, Datum und Absender sollten erkennbar sein.</small></h1>
          {letzte.istPdf ? <div className="ap-karte ap-auf v1"><b>{letzte.name}</b><p>PDF-Datei – wird so übernommen.</p></div> : <img className="ap-vorschau ap-auf v1" src={letzte.url} alt="Ihr Brief" />}
          <div className="ap-knopf-reihe ap-auf v2">
            <button type="button" className="ap-knopf still" onClick={nochEinmal}>Noch einmal</button>
            <button type="button" className="ap-knopf" onClick={() => setSchritt(3)}>Ja, weiter</button>
          </div>
          <button type="button" className="ap-link ap-auf v2" style={{ background: "none", border: 0, padding: "8px 0", textAlign: "left", fontSize: 15 }} onClick={() => eingabe.current?.click()}>Noch eine Seite?</button>
        </>
      )}

      {schritt === 3 && (
        <>
          <h1 className="ap-gruss ap-auf">Absenden<small>{seiten.length} {seiten.length === 1 ? "Seite" : "Seiten"}. Sie müssen nichts erklären – wir ordnen den Brief Ihrer Akte zu.</small></h1>
          <div className="ap-karte ap-auf v1" style={{ display: "grid", gap: 14 }}>
            <label className="ap-feld"><span>Was möchten Sie uns dazu sagen? (freiwillig)</span><input value={notiz} onChange={(e) => setNotiz(e.target.value)} maxLength={500} /></label>
            <label className="ap-check"><input type="checkbox" checked={dringend} onChange={(e) => setDringend(e.target.checked)} /><span>Der Brief nennt eine Frist oder kommt von Gericht, Gerichtsvollzieher oder Inkasso.</span></label>
          </div>
          {fehler && <div className="ap-problem" role="alert"><b>{fehler}</b></div>}
          <div className="ap-knopf-reihe ap-auf v2">
            <button type="button" className="ap-knopf still" onClick={() => setSchritt(2)} disabled={laeuft}>Zurück</button>
            <button type="button" className="ap-knopf" onClick={senden} disabled={laeuft}>{laeuft ? "Wird gesendet …" : "Absenden"}</button>
          </div>
        </>
      )}

      {schritt === 4 && ergebnis && (
        <div className="ap-karte ap-auf" style={{ textAlign: "center", padding: 24 }}>
          <svg className="ap-haken" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" /><path d="M20 33l8 8 16-18" /></svg>
          <h1 className="ap-gruss" style={{ marginTop: 12 }}>Ihr Brief ist bei uns.<small>Aktenzeichen <span className="ap-mono">{ergebnis.aktenzeichen}</span></small></h1>
          <p style={{ color: "var(--fi-text-leise)", fontSize: 16, lineHeight: 1.5, marginTop: 12 }}>{ergebnis.text2}{ergebnis.dringend ? " Wir haben den Brief als eilig vermerkt." : ""}</p>
          <Link href={`${basis}/vorgaenge`} className="ap-knopf" style={{ marginTop: 18 }}>Zu meinen Vorgängen</Link>
        </div>
      )}
      {fehler && schritt === 1 && <div className="ap-problem" role="alert"><b>{fehler}</b></div>}
    </>
  );
}
