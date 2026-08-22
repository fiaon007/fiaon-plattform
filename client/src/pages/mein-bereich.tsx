// ═══════════════════════════════════════════════════════════════════════════
// MEIN BEREICH — der neue Kundenbereich (E-013, 22.08.2026)
//
// Drei Schichten, wie in der Vision: EINSICHT (Bonität, Finanzen), AKTION
// (Fahrplan, Schreiben, Unterlagen), ZUGANG (Vorteile). Dazu das Konto.
//
// Die Seite rechnet nichts selbst: Etappen, Stufe und der nächste Schritt
// kommen aus /api/fiaon/kunde/:ref/bereich (fiaon-kunde-bereich.ts). Hier wird
// nur gezeichnet. Immer hell (styles/mein-bereich.css). Kunden werden gesiezt
// (E-002). Keine Icons, keine Emojis.
//
// Noch nicht angebunden (ehrlich gezeigt statt leer): Kontoanbindung (E-014,
// GoCardless), Schreiben-Generator, KI-Auswertung der Auskunft (E-015).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState } from "react";
import "@/styles/mein-bereich.css";

// ── Datenform des Endpunkts ─────────────────────────────────────────────────
interface Etappe { key: string; titel: string; text: string; stand: "fertig" | "jetzt" | "kommt"; datum: string | null; stempel: string | null; href?: string | null }
interface Bereich {
  kunde: { ref: string; vorname: string; nachname: string; email: string; telefon: string; strasse: string; plz: string; ort: string; land: string; geburtsdatum: string | null; kundeSeit: string | null; profilRueckfrage: boolean; profilHinweis: string | null };
  paket: { key: string | null; name: string; abo: boolean; rahmen: number | null; wunschlimit: number | null; monatlichCents: number | null; zahlungsstatus: string; zahlungsreferenz: string | null; faelligAm: string | null };
  stufe: { stufe: string | null; text: string | null; grund: string | null; naechsterSchritt: string | null; vollAktiv: boolean };
  bonitaet: { stufe: string; fuerKunden: string; naechsterSchritt: string; bezahlt: boolean; hatDokument: boolean; geprueft: boolean; darfKaufen: boolean; darfHochladen: boolean; bestellRef: string | null } | null;
  unterlagen: { kontoauszug: boolean; ausweis: boolean; auskunft: boolean; erneutKontoauszug: boolean; erneutAusweis: boolean; kycStatus: string; kontoStatus: string };
  abo: { naechste: { nr: number; betragCents: number; faelligAm: string | null; status: string; referenz: string } | null; offen: number; bezahlt: number; raten: { nr: number; betragCents: number; faelligAm: string | null; faelligIso: string | null; status: string; bezahltAm: string | null }[] };
  termin: { beginn: string; status: string; agent: string | null } | null;
  fahrplan: Etappe[];
  naechsterSchritt: { key: string; titel: string; text: string; href: string | null } | null;
  ansprechpartner: { name: string; rolle: string | null } | null;
  kontoVerbunden: boolean;
}

const eur = (n: number | null | undefined) => n == null ? "—" : new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 0 }).format(n);
const eurCents = (c: number | null | undefined) => c == null ? "—" : new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(c / 100);
function gruss(): string {
  const h = new Date().getHours();
  return h >= 5 && h < 11 ? "Guten Morgen" : h >= 11 && h < 17 ? "Guten Tag" : "Guten Abend";
}
/** Paketfarbe wie CreditCard3D im alten Dashboard — damit die Karte dieselbe bleibt. */
function paketVerlauf(name: string): string {
  const n = (name || "").toLowerCase();
  if (n.includes("high") || n.includes("black")) return "linear-gradient(145deg,#0d1b2a,#1b2d44,#2a4060)";
  if (n.includes("ultra") || n.includes("elite")) return "linear-gradient(145deg,#1a3050,#2a5580,#3d7ab8)";
  if (n.includes("pro") || n.includes("standard")) return "linear-gradient(145deg,#1a3f6f,#2563eb,#4a8af5)";
  if (!n) return "linear-gradient(145deg,#1a3f6f,#2563eb,#4a8af5)";
  return "linear-gradient(145deg,#4a7ab5,#6a9fd4,#8ab8e8)";
}
function paketKurz(name: string): string {
  const n = (name || "").toLowerCase();
  if (n.includes("high")) return "High End"; if (n.includes("ultra")) return "Ultra";
  if (n.includes("pro")) return "Pro"; if (n.includes("start")) return "Start";
  if (n.includes("business")) return "Business"; return "Mitglied";
}

async function api(pfad: string, init?: RequestInit) {
  const r = await fetch(`/api/fiaon${pfad}`, { credentials: "include", headers: init?.body ? { "Content-Type": "application/json" } : undefined, ...init });
  const j = await r.json().catch(() => null);
  return { status: r.status, ok: r.ok && j?.ok, json: j };
}

// ── Die Mitgliedskarte (Neigung + Lichtpunkt wie im Live-Code) ─────────────
function Mitgliedskarte({ name, paket, rahmen }: { name: string; paket: string; rahmen: number | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const bewegen = (e: React.MouseEvent) => {
    const k = ref.current; if (!k) return;
    const b = k.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top;
    k.classList.add("aktiv");
    k.style.setProperty("--rx", `${(y / b.height - .5) * -10}deg`);
    k.style.setProperty("--ry", `${(x / b.width - .5) * 10}deg`);
    k.style.setProperty("--mx", `${x / b.width * 100}%`);
    k.style.setProperty("--my", `${y / b.height * 100}%`);
  };
  const verlassen = () => { const k = ref.current; if (!k) return; k.classList.remove("aktiv"); k.style.setProperty("--rx", "0deg"); k.style.setProperty("--ry", "0deg"); };
  return (
    <div className="mb-karte-buehne">
      <div ref={ref} className="mb-kk" style={{ background: paketVerlauf(paket) }} onMouseMove={bewegen} onMouseLeave={verlassen}>
        <div className="mb-kk-licht" /><div className="mb-kk-streifen" />
        <div className="mb-kk-innen">
          <div className="mb-kk-kopf"><span className="w">FIAON</span><span className="p">{paketKurz(paket)}</span></div>
          <div className="mb-chip" />
          <div className="mb-kk-rahmen"><small>Paket-Rahmen</small><b>{eur(rahmen)}</b></div>
          <div className="mb-kk-fuss"><span className="n">{name}</span><span className="m">Mitgliedskarte</span></div>
        </div>
      </div>
      <div className="mb-kk-schatten" aria-hidden="true" />
    </div>
  );
}

function Begruessung({ name, paket, rahmen, zeile, onZu }: { name: string; paket: string; rahmen: number | null; zeile: string; onZu: () => void }) {
  const [zu, setZu] = useState(false);
  const schliessen = () => { if (zu) return; setZu(true); setTimeout(onZu, 750); };
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape") schliessen(); }; document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h); });
  return (
    <div className={`mb-vorhang${zu ? " zu" : ""}`} role="dialog" aria-label="Begrüßung">
      <div className="mb-vorhang-innen">
        <div className="mb-vorhang-karte"><Mitgliedskarte name={name} paket={paket} rahmen={rahmen} /></div>
        <div className="z1">Willkommen zurück</div>
        <h1 className="z2">{gruss()}, {name}.</h1>
        <p className="z3">{zeile}</p>
        <button className="mb-knopf" type="button" onClick={schliessen}>Zu meinem Bereich</button>
      </div>
    </div>
  );
}

// ── Seite ───────────────────────────────────────────────────────────────────
export default function MeinBereichPage() {
  const [d, setD] = useState<Bereich | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [vorhang, setVorhang] = useState(() => sessionStorage.getItem("mb_begruesst") !== "1");
  const [eingeklappt, setEingeklappt] = useState(() => localStorage.getItem("mb_leiste") === "zu");
  const [menueOffen, setMenueOffen] = useState(false);
  const [aktiv, setAktiv] = useState("buehne");

  const ref = useMemo(() => { try { return JSON.parse(sessionStorage.getItem("fiaon_user") || "{}")?.ref || ""; } catch { return ""; } }, []);

  useEffect(() => {
    if (!ref) { window.location.href = "/login"; return; }
    api(`/kunde/${encodeURIComponent(ref)}/bereich`).then((r) => {
      if (r.status === 401 || r.status === 403) { window.location.href = "/login"; return; }
      if (!r.ok) { setFehler(r.json?.error || "Der Bereich konnte nicht geladen werden."); return; }
      setD(r.json as Bereich);
    }).catch(() => setFehler("Keine Verbindung. Bitte prüfen Sie Ihr Internet und laden Sie die Seite neu."));
  }, [ref]);

  // Leiste folgt dem Scrollen
  useEffect(() => {
    if (!d) return;
    const ziele = Array.from(document.querySelectorAll<HTMLElement>("main section[id]"));
    const lupe = new IntersectionObserver((es) => { es.forEach((e) => { if (e.isIntersecting) setAktiv(e.target.id); }); }, { rootMargin: "-30% 0px -60% 0px" });
    ziele.forEach((z) => lupe.observe(z));
    return () => lupe.disconnect();
  }, [d]);

  const leisteUmschalten = () => { const zu = !eingeklappt; setEingeklappt(zu); localStorage.setItem("mb_leiste", zu ? "zu" : "auf"); };
  const abmelden = async () => { await api("/kunde/logout", { method: "POST" }).catch(() => null); sessionStorage.removeItem("fiaon_user"); window.location.href = "/login"; };

  if (fehler) return <div className="mb"><div className="mb-laden"><div className="mb-hinweis" style={{ maxWidth: 420 }}><b>Das hat nicht geklappt.</b><br />{fehler}</div></div></div>;
  if (!d) return <div className="mb"><div className="mb-laden">Ihr Bereich wird geladen …</div></div>;

  const name = `${d.kunde.vorname} ${d.kunde.nachname}`.trim() || "Mitglied";
  const initialen = `${d.kunde.vorname?.[0] || ""}${d.kunde.nachname?.[0] || ""}`.toUpperCase() || "FI";
  const ns = d.naechsterSchritt;
  const begruessungsZeile = ns ? `Ihr nächster Schritt: ${ns.titel}.` : "Alles ist auf dem neuesten Stand.";
  const leadText = d.stufe.vollAktiv
    ? (ns ? `${ns.text}` : "Ihr Konto ist vollständig aktiv.")
    : (d.stufe.naechsterSchritt || d.stufe.text || "Ihr Konto wird nach dem Startgespräch vollständig freigeschaltet.");
  const grussWorte = `${gruss()}, ${name}.`.split(" ");

  const punkte = [
    { id: "buehne", kurz: "ÜB", label: "Übersicht", gruppe: "Einsicht" },
    { id: "bonitaet", kurz: "BO", label: "Meine Bonität", gruppe: "Einsicht" },
    { id: "kontoanbindung", kurz: "KV", label: "Konto verbinden", gruppe: "Einsicht" },
    { id: "finanzen", kurz: "MF", label: "Meine Finanzen", gruppe: "Einsicht" },
    { id: "fahrplan", kurz: "FP", label: "Mein Fahrplan", gruppe: "Aktion" },
    { id: "schreiben", kurz: "MS", label: "Meine Schreiben", gruppe: "Aktion" },
    { id: "unterlagen", kurz: "UN", label: "Unterlagen", gruppe: "Aktion", marke: [!d.unterlagen.kontoauszug || d.unterlagen.erneutKontoauszug, !d.unterlagen.ausweis || d.unterlagen.erneutAusweis].filter(Boolean).length || undefined },
    { id: "vorteile", kurz: "MV", label: "Meine Vorteile", gruppe: "Zugang" },
    { id: "konto", kurz: "MK", label: "Mein Konto", gruppe: "Konto" },
    { id: "abo", kurz: "AZ", label: "Abo & Zahlungen", gruppe: "Konto" },
    { id: "sicherheit", kurz: "PS", label: "Passwort & Sicherheit", gruppe: "Konto" },
    { id: "hilfe", kurz: "HI", label: "Hilfe", gruppe: "Konto" },
  ];
  const gruppen = ["Einsicht", "Aktion", "Zugang", "Konto"];

  return (
    <div className="mb">
      <div className="mb-lichter" aria-hidden="true"><div className="mb-licht a" /><div className="mb-licht b" /></div>

      {vorhang && <Begruessung name={name} paket={d.paket.name} rahmen={d.paket.rahmen} zeile={begruessungsZeile}
        onZu={() => { sessionStorage.setItem("mb_begruesst", "1"); setVorhang(false); }} />}

      <header className="mb-kopf">
        <div className="mb-kopf-innen">
          <a className="mb-wort fiaon-gradient-text-animated" href="/mein-bereich">FIAON</a>
          <span className="mb-bereich-marke">Mitgliedsbereich</span>
          <div className="mb-kopf-rechts">
            <div className="mb-kopf-name">{name}<small>{d.paket.name}{d.kunde.kundeSeit ? ` · Mitglied seit ${d.kunde.kundeSeit}` : ""}</small></div>
            <div className="mb-gesicht" aria-hidden="true">{initialen}</div>
          </div>
        </div>
      </header>

      <nav className="mb-unten" aria-label="Bereiche">
        {[["buehne","ÜB","Übersicht"],["bonitaet","BO","Bonität"],["fahrplan","FP","Fahrplan"],["konto","MK","Konto"]].map(([id,k,l]) => (
          <a key={id} href={`#${id}`} className={aktiv === id ? "aktiv" : ""}><span className="mono">{k}</span>{l}</a>
        ))}
        <button type="button" onClick={() => setMenueOffen(true)} aria-expanded={menueOffen}><span className="mono">···</span>Mehr</button>
      </nav>
      {menueOffen && (
        <div className="mb-blatt" role="dialog" aria-label="Alle Bereiche" onClick={() => setMenueOffen(false)}>
          <div className="mb-blatt-innen" onClick={(e) => e.stopPropagation()}>
            <div className="mb-blatt-griff" />
            {gruppen.map((g) => (<div key={g}><div className="mb-blatt-titel">{g}</div>
              {punkte.filter((p) => p.gruppe === g).map((p) => <a key={p.id} href={`#${p.id}`} onClick={() => setMenueOffen(false)}><span>{p.label}</span>{p.marke ? <span className="mb-marke">{p.marke}</span> : null}</a>)}
              {g === "Konto" && <button type="button" className="mb-link" onClick={abmelden}><span>Abmelden</span></button>}
            </div>))}
          </div>
        </div>
      )}

      <div className="mb-rahmen">
        <div className={`mb-grundriss${eingeklappt ? " eingeklappt" : ""}`}>
          <nav className="mb-leiste" aria-label="Bereiche">
            <button className="mb-klapp" type="button" onClick={leisteUmschalten} aria-expanded={!eingeklappt}>{eingeklappt ? "Menü" : "Menü einklappen"}</button>
            {gruppen.map((g) => (
              <div className="mb-leiste-block" key={g}>
                <div className="mb-leiste-titel">{g}</div>
                {punkte.filter((p) => p.gruppe === g).map((p) => (
                  <a key={p.id} href={`#${p.id}`} data-kurz={p.kurz} title={p.label} className={aktiv === p.id ? "aktiv" : ""}>
                    <span>{p.label}</span>{p.marke ? <span className="mb-marke">{p.marke}</span> : null}
                  </a>
                ))}
                {g === "Konto" && <button type="button" className="mb-link" data-kurz="AB" title="Abmelden" onClick={abmelden}><span>Abmelden</span></button>}
              </div>
            ))}
          </nav>

          <main className="mb-spalte">
            {/* ═══ BÜHNE ═══ */}
            <section className="mb-buehne" id="buehne">
              <div>
                <div className="mb-eyebrow">Ihr Stand</div>
                <h1 className="mb-gruss">{grussWorte.map((w, i) => <span key={i} className="w" style={{ animationDelay: `${0.15 + i * 0.12}s` }}>{w}{i < grussWorte.length - 1 ? " " : ""}</span>)}</h1>
                <p className="lead">{leadText}</p>
                <div className="mb-kennzahlen">
                  <div className="mb-kz"><small>Paket</small><b>{d.paket.name}</b></div>
                  <div className="mb-kz"><small>Paket-Rahmen</small><b className="zahl">{eur(d.paket.rahmen)}</b></div>
                  <div className="mb-kz"><small>Wunschlimit</small><b className="zahl">{eur(d.paket.wunschlimit)}</b></div>
                  <div className="mb-kz"><small>Bonitätswert</small><b className="zahl">{d.bonitaet?.geprueft ? "liegt vor" : "noch offen"}</b></div>
                  <div className="mb-kz"><small>Nächste Abbuchung</small><b className="zahl">{d.abo.naechste ? `${d.abo.naechste.faelligAm} · ${eurCents(d.abo.naechste.betragCents)}` : (d.paket.monatlichCents ? eurCents(d.paket.monatlichCents) + " / Monat" : "—")}</b></div>
                  <div className="mb-kz"><small>Status</small><b>{d.stufe.vollAktiv ? "Vollständig aktiv" : "Wartet auf Startgespräch"}</b></div>
                </div>
              </div>
              <Mitgliedskarte name={name} paket={d.paket.name} rahmen={d.paket.rahmen} />
            </section>

            {/* ═══ NÄCHSTER SCHRITT ═══ */}
            {ns && (
              <div className="mb-tat">
                <div><h3>{ns.titel}</h3><p>{ns.text}</p></div>
                {ns.href ? <a className="mb-knopf" href={ns.href}>Jetzt erledigen</a> : null}
              </div>
            )}

            {/* ═══ BONITÄT ═══ */}
            <section id="bonitaet">
              <div className="mb-abschnitt-kopf"><div><h2>Ihre Bonität</h2><p>{d.bonitaet?.fuerKunden || "Eine Auskunft, jeder Eintrag geprüft, in Menschensprache erklärt."}</p></div></div>
              <div className="mb-karte">
                {d.bonitaet?.geprueft ? (
                  <div className="mb-warte"><b>Ihre Auskunft ist geprüft.</b> Die Auswertung mit Ihren Einträgen und deren Wirkung in Punkten erscheint hier, sobald die Analyse freigegeben ist. Ihre Ansprechpartnerin meldet sich dazu.</div>
                ) : d.bonitaet?.hatDokument ? (
                  <div className="mb-warte"><b>Ihre Auskunft ist eingegangen.</b> Wir gehen jeden Eintrag durch und leiten daraus Ihre nächsten Schritte ab. Sie hören von uns, sobald die Auswertung vorliegt.</div>
                ) : d.bonitaet?.bezahlt ? (
                  <div className="mb-warte"><b>Bezahlt — die Auskunft wird beschafft.</b> {d.bonitaet.naechsterSchritt}</div>
                ) : (
                  <div className="mb-raster">
                    <div>
                      <h4 style={{ fontSize: 16, fontWeight: 700 }}>Bonitätsauskunft — der Grundstein</h4>
                      <p style={{ margin: "8px 0 0", fontSize: 13.5, color: "var(--text-leise)", maxWidth: "56ch" }}>Bevor irgendetwas anderes Sinn hat, braucht es einen Überblick: Was steht über Sie in den Auskunfteien? Die Auskunft wird neutral abgerufen und verändert Ihren Wert nicht. Einmalig 74 €, kein Abo.</p>
                      <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {d.bonitaet?.darfKaufen && <a className="mb-knopf" href="/bonitaet-antrag">Auskunft beauftragen</a>}
                        {d.bonitaet?.darfHochladen && <a className="mb-knopf still" href="/dashboard">Eigene Auskunft hochladen</a>}
                      </div>
                    </div>
                    <div className="mb-warte"><b>Was Sie danach sehen:</b> Ihren Wert als Bogen, die drei größten Einträge mit ihrer Wirkung in Punkten, und zu jedem eine Einschätzung — rechtmäßig, angreifbar oder rechtswidrig.</div>
                  </div>
                )}
              </div>
            </section>

            {/* ═══ FAHRPLAN ═══ */}
            <section id="fahrplan">
              <div className="mb-abschnitt-kopf"><div><h2>Ihr Fahrplan</h2><p>{d.fahrplan.length} Etappen bis zum Ziel. Sie stehen bei Nummer {Math.max(1, d.fahrplan.findIndex((e) => e.stand === "jetzt") + 1)}.</p></div></div>
              <div className="mb-karte">
                <ol className="mb-fahrplan">
                  {d.fahrplan.map((e, i) => (
                    <li key={e.key} className={`mb-etappe ${e.stand}`}>
                      <span className="mb-etappe-punkt zahl" aria-hidden="true">{e.stand === "fertig" ? "✓" : i + 1}</span>
                      <h4>{e.titel}{e.stempel && <span className={`mb-stempel ${e.stand === "fertig" ? "gut" : e.stand === "jetzt" ? "jetzt" : ""} zahl`}>{e.datum || e.stempel}</span>}</h4>
                      <p>{e.text}</p>
                    </li>
                  ))}
                </ol>
              </div>
            </section>

            {/* ═══ SCHREIBEN ═══ */}
            <section id="schreiben">
              <div className="mb-abschnitt-kopf"><div><h2>Ihre Schreiben</h2><p>Fertig ausgefüllt, juristisch geprüft, mit einem Klick versendet.</p></div></div>
              <div className="mb-raster">
                {[["Löschantrag · Art. 17 DSGVO", "Für Einträge ohne Rechtsgrund. Die Auskunftei muss innerhalb eines Monats antworten."],
                  ["Ratenvereinbarung", "Für offene Forderungen: ein tragbarer Vorschlag, den das Inkasso annehmen kann."],
                  ["Selbstauskunft · Art. 15 DSGVO", "Ihre kostenlose Datenkopie bei SCHUFA, KSV1870 oder CRIF — vorbereitet, Sie unterschreiben."]].map(([t, x]) => (
                  <article className="mb-kachel" key={t}><h4>{t}</h4><p>{x}</p><div className="mb-kachel-fuss"><span className="mb-lage ruht">Nach der Analyse</span></div></article>
                ))}
              </div>
              <div className="mb-hinweis" style={{ marginTop: 16 }}><b>Jeder Brieftyp wird vor dem ersten Versand vom Anwaltsteam freigegeben</b> und mit Datum versioniert. Welche Fassung an Sie ging, steht später im Verlauf — nachvollziehbar, auch Jahre später.</div>
            </section>

            {/* ═══ UNTERLAGEN ═══ */}
            <section id="unterlagen">
              <div className="mb-abschnitt-kopf"><div><h2>Unterlagen</h2><p>Was vorliegt, was fehlt — und wie Sie es einreichen.</p></div></div>
              <div className="mb-raster">
                {[
                  { t: "Kontoauszug", da: d.unterlagen.kontoauszug && !d.unterlagen.erneutKontoauszug, x: d.unterlagen.erneutKontoauszug ? "Bitte erneut einreichen — die erste Fassung war nicht lesbar." : "Die letzten drei Monate, als PDF aus Ihrem Online-Banking. Ein Handyfoto genügt, wenn alles lesbar ist." },
                  { t: "Ausweis oder Reisepass", da: d.unterlagen.ausweis && !d.unterlagen.erneutAusweis, x: d.unterlagen.erneutAusweis ? "Bitte erneut einreichen — die erste Fassung war nicht lesbar." : "Vorder- und Rückseite, gut beleuchtet, alle vier Ecken sichtbar." },
                  { t: "Bonitätsauskunft", da: d.unterlagen.auskunft, x: "Über uns beschafft oder selbst hochgeladen — beides geht." },
                ].map((u) => (
                  <article className="mb-kachel" key={u.t}><h4>{u.t}</h4><p>{u.x}</p>
                    <div className="mb-kachel-fuss"><span className={`mb-lage ${u.da ? "gut" : "frist"}`}>{u.da ? "Liegt vor" : "Fehlt"}</span>{!u.da && <a className="mb-knopf klein" href="/dashboard">Hochladen</a>}</div></article>
                ))}
              </div>
            </section>

            {/* ═══ KONTOANBINDUNG ═══ */}
            <section id="kontoanbindung">
              <div className="mb-abschnitt-kopf"><div><h2>Ihr Konto verbinden</h2><p>Statt Auszüge zu fotografieren: Sie melden sich einmal bei Ihrer Bank an, wir erhalten die Umsätze direkt und vollständig.</p></div></div>
              <div className="mb-karte mb-verbinden">
                <div>
                  {[["Bank auswählen", "Ihre Bank aus über 2.300 Instituten in Deutschland und Österreich — Filialbank, Direktbank oder Sparkasse."],
                    ["Bei Ihrer Bank anmelden", "Sie werden zu Ihrer Bank weitergeleitet und bestätigen dort wie beim Online-Banking. FIAON sieht Ihre Zugangsdaten nie."],
                    ["Freigabe für 90 Tage", "Sie erlauben nur das Lesen der Umsätze. Kein Zugriff auf Überweisungen. Jederzeit widerrufbar."],
                    ["Umsätze kommen an", "Die letzten 12 Monate werden geprüft, sortiert und in Ihre Finanzübersicht eingearbeitet — in Minuten."]].map(([t, x], i) => (
                    <div className="mb-schritt" key={t}><span className="mb-schritt-nr zahl">{i + 1}</span><div><h4>{t}</h4><p>{x}</p></div></div>
                  ))}
                  <div className="mb-freigabe"><b>Was wir lesen dürfen — und was nicht</b>
                    <ul><li>Lesen: Kontostand, Umsätze der letzten 12 Monate, Daueraufträge.</li><li>Nicht möglich: Überweisungen auslösen, Limits ändern, Zugangsdaten speichern.</li><li>Grundlage: EU-Zahlungsdiensterichtlinie PSD2 über einen zugelassenen Kontoinformationsdienst.</li></ul></div>
                </div>
                <div className="mb-bank-glas">
                  <div className="mb-eyebrow" style={{ marginBottom: 12 }}>Ihre Bank</div>
                  <div className="mb-suche"><input type="text" placeholder="Name, BLZ oder BIC" aria-label="Bank suchen" disabled /><span className="kuerzel">BLZ · BIC</span></div>
                  <div style={{ marginTop: 16, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <button className="mb-knopf" type="button" disabled>Bank verbinden</button>
                    <a className="mb-knopf still" href="#unterlagen">Lieber Auszug hochladen</a>
                  </div>
                  <div className="mb-siegel"><span>Verschlüsselt</span><span>Zugelassener Dienst</span><span>Nur Lesezugriff</span><span>Jederzeit widerrufbar</span></div>
                  <p style={{ margin: "14px 0 0", fontSize: 12.5, color: "var(--text-still)" }}>Die Bankanbindung wird gerade freigeschaltet. Bis dahin nehmen wir Ihren Kontoauszug als Datei entgegen — unter Unterlagen.</p>
                </div>
              </div>
            </section>

            {/* ═══ FINANZEN ═══ */}
            <section id="finanzen">
              <div className="mb-abschnitt-kopf"><div><h2>Ihre Finanzen</h2><p>Wohin Ihr Geld geht — nicht geschätzt, gezählt.</p></div></div>
              <Zahlungskalender raten={d.abo.raten} paket={d.paket.name} />
              <div className="mb-hinweis" style={{ marginTop: 16 }}><b>Sobald Ihr Konto verbunden ist,</b> erscheinen hier auch Miete, Strom, Versicherungen, Abos und alle anderen festen Zahlungen — mit Datum, Betrag und Verwendungszweck. Dazu Ihr Ausgabenprofil nach Bereichen und ein Merksatz, der benennt, wo Spielraum ist.</div>
            </section>

            {/* ═══ VORTEILE ═══ */}
            <section id="vorteile">
              <div className="mb-abschnitt-kopf"><div><h2>Ihre Vorteile</h2><p>Was heute geht, was in Reichweite ist, und was das Ziel bleibt.</p></div></div>
              <div className="mb-raster">
                <article className="mb-kachel"><h4>DKB Girokonto</h4><p>Kostenlos, ohne Bonitätsprüfung. Spart Ihnen rund 60 € im Jahr.</p><div className="mb-kachel-fuss"><span className="mb-lage gut">Heute möglich</span><span className="zahl" style={{ fontSize: 12, color: "var(--text-still)" }}>über Ihre Ansprechpartnerin</span></div></article>
                <article className="mb-kachel"><h4>Kreditkarte{d.paket.wunschlimit ? ` bis ${eur(d.paket.wunschlimit)}` : ""}</h4><p>Ihr Wunschlimit. Erreichbar, sobald Ihr Wert die Schwelle des Kartenpartners erreicht — wir sagen Ihnen, wann es so weit ist.</p><div className="mb-kachel-fuss"><span className="mb-lage bereit">Das Ziel</span></div></article>
                <article className="mb-kachel"><h4>Finanzierung</h4><p>Für Auto, Umzug oder Anschaffung. Braucht einen stabilen Wert über mehrere Monate.</p><div className="mb-kachel-fuss"><span className="mb-lage ruht">Später</span></div></article>
              </div>
            </section>

            {/* ═══ KONTO ═══ */}
            <section id="konto">
              <div className="mb-abschnitt-kopf"><div><h2>Mein Konto</h2><p>Ihre Daten, Ihr Abo, Ihre Sicherheit — alles an einem Ort, jederzeit änderbar.</p></div></div>
              <div className="mb-konto">
                <Stammdaten d={d} />
                <div className="mb-karte" id="abo"><h4 style={{ fontSize: 15, marginBottom: 8 }}>Abo &amp; Zahlungen</h4>
                  <div className="mb-zeile"><span>Paket</span><span>{d.paket.name}</span></div>
                  <div className="mb-zeile"><span>{d.paket.abo ? "Monatlich" : "Einmalig"}</span><span className="zahl">{eurCents(d.paket.monatlichCents)}</span></div>
                  <div className="mb-zeile"><span>Nächste Abbuchung</span><span className="zahl">{d.abo.naechste?.faelligAm || "—"}</span></div>
                  <div className="mb-zeile"><span>Verwendungszweck</span><span className="zahl">{d.abo.naechste?.referenz || d.paket.zahlungsreferenz || "—"}</span></div>
                  <div className="mb-zeile"><span>Bezahlt / offen</span><span className="zahl">{d.abo.bezahlt} / {d.abo.offen}</span></div>
                  <div className="mb-zeile"><span>Kündbar</span><span>zum Monatsende, formlos per E-Mail</span></div>
                  <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {d.abo.naechste && d.abo.naechste.status !== "bezahlt" && d.abo.naechste.referenz && <a className="mb-knopf klein" href={`/zahlung/${encodeURIComponent(d.abo.naechste.referenz)}`}>Jetzt bezahlen</a>}
                    <a className="mb-knopf still klein" href="/abo-kuendigen">Abo kündigen</a>
                  </div>
                </div>
                <Passwort refKunde={d.kunde.ref} />
                <div className="mb-karte" id="hilfe"><h4 style={{ fontSize: 15, marginBottom: 8 }}>Hilfe</h4>
                  <div className="mb-zeile"><span>Ihre Ansprechpartnerin</span><span>{d.ansprechpartner?.name || "FIAON Team"}</span></div>
                  <div className="mb-zeile"><span>E-Mail</span><span>support@fiaon.com</span></div>
                  <div className="mb-zeile"><span>Antwortzeit</span><span>werktags innerhalb von 24 Stunden</span></div>
                  <div style={{ marginTop: 14 }}><a className="mb-knopf still klein" href="mailto:support@fiaon.com">Nachricht schreiben</a></div>
                </div>
              </div>
            </section>

            <footer className="mb-fuss"><span>FIAON LTD · Company No. 17318250</span><span>128 City Road, London EC1V 2NX</span><a href="/impressum">Impressum</a><a href="/privacy">Datenschutz</a></footer>
          </main>
        </div>
      </div>
    </div>
  );
}

// ── Stammdaten (bearbeitbar über den bestehenden PATCH /profile/:ref) ───────
function Stammdaten({ d }: { d: Bereich }) {
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ email: d.kunde.email, phone: d.kunde.telefon, street: d.kunde.strasse, zip: d.kunde.plz, city: d.kunde.ort });
  const [meldung, setMeldung] = useState<{ ton: "gut" | "fehler"; text: string } | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const speichern = async () => {
    setLaeuft(true); setMeldung(null);
    const r = await api(`/profile/${encodeURIComponent(d.kunde.ref)}`, { method: "PATCH", body: JSON.stringify(f) });
    setLaeuft(false);
    if (r.ok) { setMeldung({ ton: "gut", text: "Gespeichert." }); setEdit(false); }
    else setMeldung({ ton: "fehler", text: r.json?.error || "Das konnte nicht gespeichert werden." });
  };
  return (
    <div className="mb-karte" id="stammdaten"><h4 style={{ fontSize: 15, marginBottom: 8 }}>Persönliche Daten</h4>
      {d.kunde.profilRueckfrage && <div className="mb-meldung fehler">{d.kunde.profilHinweis || "Bitte prüfen Sie Ihre Angaben."}</div>}
      {!edit ? (<>
        <div className="mb-zeile"><span>Name</span><span>{d.kunde.vorname} {d.kunde.nachname}</span></div>
        <div className="mb-zeile"><span>E-Mail</span><span>{d.kunde.email || "—"}</span></div>
        <div className="mb-zeile"><span>Telefon</span><span className="zahl">{d.kunde.telefon || "—"}</span></div>
        <div className="mb-zeile"><span>Anschrift</span><span>{[d.kunde.strasse, [d.kunde.plz, d.kunde.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "—"}</span></div>
        <div style={{ marginTop: 14 }}><button className="mb-knopf still klein" type="button" onClick={() => setEdit(true)}>Bearbeiten</button></div>
      </>) : (<>
        {([["email", "E-Mail"], ["phone", "Telefon"], ["street", "Straße und Hausnummer"], ["zip", "PLZ"], ["city", "Ort"]] as const).map(([k, l]) => (
          <div className="mb-feld" key={k}><label htmlFor={`f-${k}`}>{l}</label><input id={`f-${k}`} value={(f as any)[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
        ))}
        <div style={{ marginTop: 14, display: "flex", gap: 8 }}><button className="mb-knopf klein" type="button" disabled={laeuft} onClick={speichern}>{laeuft ? "Speichert …" : "Speichern"}</button><button className="mb-knopf still klein" type="button" onClick={() => setEdit(false)}>Abbrechen</button></div>
      </>)}
      {meldung && <div className={`mb-meldung ${meldung.ton}`}>{meldung.text}</div>}
    </div>
  );
}

function Passwort({ refKunde }: { refKunde: string }) {
  const [alt, setAlt] = useState(""); const [neu, setNeu] = useState(""); const [neu2, setNeu2] = useState("");
  const [meldung, setMeldung] = useState<{ ton: "gut" | "fehler"; text: string } | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const aendern = async () => {
    setMeldung(null);
    if (neu !== neu2) { setMeldung({ ton: "fehler", text: "Die beiden neuen Passwörter stimmen nicht überein." }); return; }
    setLaeuft(true);
    const r = await api(`/kunde/${encodeURIComponent(refKunde)}/passwort`, { method: "POST", body: JSON.stringify({ alt, neu }) });
    setLaeuft(false);
    if (r.ok) { setMeldung({ ton: "gut", text: "Ihr Passwort wurde geändert." }); setAlt(""); setNeu(""); setNeu2(""); }
    else setMeldung({ ton: "fehler", text: r.json?.error || "Das Passwort konnte nicht geändert werden." });
  };
  return (
    <div className="mb-karte" id="sicherheit"><h4 style={{ fontSize: 15, marginBottom: 8 }}>Passwort &amp; Sicherheit</h4>
      <div className="mb-feld"><label htmlFor="pw-alt">Bisheriges Passwort</label><input id="pw-alt" type="password" autoComplete="current-password" value={alt} onChange={(e) => setAlt(e.target.value)} /></div>
      <div className="mb-feld"><label htmlFor="pw-neu">Neues Passwort (mindestens 8 Zeichen)</label><input id="pw-neu" type="password" autoComplete="new-password" value={neu} onChange={(e) => setNeu(e.target.value)} /></div>
      <div className="mb-feld"><label htmlFor="pw-neu2">Neues Passwort wiederholen</label><input id="pw-neu2" type="password" autoComplete="new-password" value={neu2} onChange={(e) => setNeu2(e.target.value)} /></div>
      <div style={{ marginTop: 14 }}><button className="mb-knopf klein" type="button" disabled={laeuft || !alt || neu.length < 8} onClick={aendern}>{laeuft ? "Ändert …" : "Passwort ändern"}</button></div>
      {meldung && <div className={`mb-meldung ${meldung.ton}`}>{meldung.text}</div>}
      <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--text-still)" }}>Ihre Sitzung läuft nach 30 Tagen ab. Abmelden finden Sie im Menü.</p>
    </div>
  );
}

// ── Zahlungskalender: heute die FIAON-Raten, später alle festen Zahlungen ───
function Zahlungskalender({ raten, paket }: { raten: Bereich["abo"]["raten"]; paket: string }) {
  const [monat, setMonat] = useState(() => { const h = new Date(); return new Date(h.getFullYear(), h.getMonth(), 1); });
  const heute = new Date(); const heuteKey = heute.toISOString().slice(0, 10);
  const eintraege = raten.filter((r) => r.faelligIso).map((r) => ({
    datum: r.faelligIso as string, titel: `FIAON ${paket} · Rate ${r.nr}`,
    zweck: `Verwendungszweck: ${(r as any).referenz || "siehe Rechnung"}`, betragCents: r.betragCents,
    art: r.status === "bezahlt" ? "bezahlt" : "offen", bezahltAm: r.bezahltAm,
  }));
  const imMonat = eintraege.filter((e) => e.datum.startsWith(monat.toISOString().slice(0, 7)));
  const summe = (art: string) => imMonat.filter((e) => e.art === art).reduce((a, e) => a + e.betragCents, 0);
  const ersterWt = (monat.getDay() + 6) % 7; const tage = new Date(monat.getFullYear(), monat.getMonth() + 1, 0).getDate();
  const zellen = [...Array(ersterWt).fill(null), ...Array.from({ length: tage }, (_, i) => i + 1)];
  const monatsName = monat.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
  const schieben = (n: number) => setMonat(new Date(monat.getFullYear(), monat.getMonth() + n, 1));
  return (
    <div className="mb-karte mb-kal">
      <div>
        <div className="mb-kal-kopf"><button type="button" onClick={() => schieben(-1)} aria-label="Vormonat">‹</button><h4>{monatsName}</h4><button type="button" onClick={() => schieben(1)} aria-label="Folgemonat">›</button></div>
        <div className="mb-kal-raster">
          {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((w) => <div className="mb-kal-wt" key={w}>{w}</div>)}
          {zellen.map((t, i) => {
            if (!t) return <div className="mb-kal-tag leer" key={`l${i}`} />;
            const key = `${monat.getFullYear()}-${String(monat.getMonth() + 1).padStart(2, "0")}-${String(t).padStart(2, "0")}`;
            const am = eintraege.filter((e) => e.datum === key);
            return <div className={`mb-kal-tag${key === heuteKey ? " heute" : ""}${am.length ? " mit" : ""}`} key={key}>{t}{am.length > 0 && <span style={{ display: "flex", gap: 3 }}>{am.slice(0, 3).map((e, j) => <span key={j} className={`p ${e.art}`} />)}</span>}</div>;
          })}
        </div>
      </div>
      <div>
        <div className="mb-kal-summe">
          <div className="mb-kz"><small>Im Monat</small><b className="zahl">{eurCents(summe("offen") + summe("bezahlt"))}</b></div>
          <div className="mb-kz"><small>Offen</small><b className="zahl" style={{ color: summe("offen") ? "var(--frist)" : undefined }}>{eurCents(summe("offen"))}</b></div>
          <div className="mb-kz"><small>Bezahlt</small><b className="zahl" style={{ color: "var(--gut)" }}>{eurCents(summe("bezahlt"))}</b></div>
        </div>
        <div className="mb-kal-liste">
          {imMonat.length === 0 && <div className="mb-warte">In diesem Monat sind keine Zahlungen eingetragen.</div>}
          {imMonat.sort((a, b) => a.datum.localeCompare(b.datum)).map((e, i) => (
            <div className={`mb-kal-eintrag ${e.art}`} key={i}>
              <div className="d">{e.datum.slice(8, 10)}.{e.datum.slice(5, 7)}.<small>{new Date(e.datum).toLocaleDateString("de-DE", { weekday: "short" })}</small></div>
              <div className="t">{e.titel}<small>{e.zweck}{e.bezahltAm ? ` · bezahlt am ${e.bezahltAm}` : ""}</small></div>
              <div className="b">{eurCents(e.betragCents)}<small>{e.art === "bezahlt" ? "bezahlt" : "offen"}</small></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
