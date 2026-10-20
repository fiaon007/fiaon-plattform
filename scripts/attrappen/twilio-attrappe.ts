// ═══════════════════════════════════════════════════════════════════════════
// TWILIO-ATTRAPPE — spielt Twilio Media Streams gegen unsere Brücke (E-408, § 13)
//
// Twilio ist in Wirklichkeit der CLIENT: Es verbindet sich zu unserer
// Stream-Adresse, schickt `connected`, `start` (mit customParameters) und
// dann alle 20 ms einen `media`-Rahmen (µ-law), bestätigt unsere `mark`s und
// schickt am Ende `stop`. Genau das tut diese Klasse — und zählt, was die
// Brücke zurückschickt (media, mark, clear).
//
// Wie Twilio spielt sie den Ton in Echtzeit ab: jeder Rahmen hinter dem, was noch
// läuft; eine Marke kommt zurück, wenn der Ton davor gespielt ist; `clear` leert
// alles und schickt die offenen Marken sofort zurück. Daraus misst der Prüfstand
// Lücken mitten in der Rede, den Vorrat und den Pegel beim Kunden (Ton-Werk, 20.10.).
// ═══════════════════════════════════════════════════════════════════════════
import WebSocket from "ws";

export class TwilioAttrappe {
  private ws: WebSocket | null = null;
  private takt: NodeJS.Timeout | null = null;
  private zaehler = { media: 0, clear: 0, mark: 0, offen: 0, maxOffen: 0 };
  /** Abspiel-Modell: bis wann gespielt wird, je Rahmen Start (gespielt) und Ankunft; offene Marken-Zeitgeber. */
  private spielEnde = 0;
  private log: { empfangen: number; start: number; roh: Buffer }[] = [];
  private markenTimer = new Map<NodeJS.Timeout, () => void>();
  maxVorratMs = 0;
  private zu = false;
  readonly streamSid: string;
  readonly callSid: string;
  constructor(private readonly e: { url: string; anrufId: number; t: string; callSid?: string; fortsetzung?: string; rahmen?: Buffer }) {
    this.streamSid = `MZ${String(e.anrufId).padStart(32, "0")}`;
    this.callSid = e.callSid ?? `ATTRAPPE-${e.anrufId}`;
  }

  /** Verbinden, start schicken, Ton senden — löst sich, sobald die Verbindung steht. */
  start(): Promise<void> {
    return new Promise((loesen, ablehnen) => {
      const ws = new WebSocket(this.e.url);
      this.ws = ws;
      ws.on("open", () => {
        ws.send(JSON.stringify({ event: "connected", protocol: "Call", version: "1.0.0" }));
        const customParameters: Record<string, string> = { anruf: String(this.e.anrufId), t: this.e.t };
        if (this.e.fortsetzung) customParameters.fortsetzung = this.e.fortsetzung;
        ws.send(JSON.stringify({ event: "start", sequenceNumber: "1", start: { streamSid: this.streamSid, accountSid: "ACattrappe", callSid: this.callSid, tracks: ["inbound"], customParameters, mediaFormat: { encoding: "audio/x-mulaw", sampleRate: 8000, channels: 1 } }, streamSid: this.streamSid }));
        const rahmen = (this.e.rahmen ?? Buffer.alloc(160, 0xff)).toString("base64");
        const lauterRahmen = Buffer.from(Array.from({ length: 160 }, (_, i) => (i % 16 < 8 ? 0x20 : 0xa0))).toString("base64");
        let n = 0;
        this.takt = setInterval(() => {
          if (ws.readyState !== WebSocket.OPEN) return;
          n += 1;
          // Echte Kundenstimme (sprechen) geht vor; sonst laute Rahmen (laut) oder Stille.
          const echt = this.stimme.length ? this.stimme.shift()!.toString("base64") : null;
          if (echt) this.lautBis = Math.max(this.lautBis, Date.now() + 20);
          ws.send(JSON.stringify({ event: "media", sequenceNumber: String(n + 1), media: { track: "inbound", chunk: String(n), timestamp: String(n * 20), payload: echt ?? (Date.now() < this.lautBis ? lauterRahmen : rahmen) }, streamSid: this.streamSid }));
        }, 20);
        loesen();
      });
      ws.on("message", (roh) => {
        let m: any; try { m = JSON.parse(roh.toString()); } catch { return; }
        if (m?.event === "media") {
          this.zaehler.media += 1;
          // Rede (nicht µ-law-Stille 0xff/0x7f) — wann der Kunde Aras' Stimme hört (Geduld-Tor, E-408 20.10.2026).
          const b = Buffer.from(String(m?.media?.payload ?? ""), "base64");
          const jetzt = Date.now();
          if (b.some((x) => x !== 0xff && x !== 0x7f)) this.lautEmpfangen.push(jetzt);
          // Abspielen in Echtzeit, hinter dem, was noch läuft.
          const start = Math.max(jetzt, this.spielEnde);
          this.spielEnde = start + b.length / 8;
          this.maxVorratMs = Math.max(this.maxVorratMs, this.spielEnde - jetzt);
          this.log.push({ empfangen: jetzt, start, roh: b });
          if (this.log.length > 30_000) this.log.splice(0, 10_000);
        }
        else if (m?.event === "clear") {
          this.zaehler.clear += 1;
          // Twilio: nach clear ist der Vorrat weg, alle offenen Marken kommen sofort zurück (der Ton davor wurde verworfen).
          const jetzt = Date.now();
          this.spielEnde = jetzt;
          this.log = this.log.filter((r) => r.start < jetzt);
          for (const [t, fertig] of Array.from(this.markenTimer.entries())) { clearTimeout(t); fertig(); }
          this.markenTimer.clear();
          this.zaehler.offen = 0;
        } else if (m?.event === "mark") {
          this.zaehler.mark += 1;
          this.zaehler.offen += 1; this.zaehler.maxOffen = Math.max(this.zaehler.maxOffen, this.zaehler.offen);
          // Twilio bestätigt die Marke, sobald der Ton davor gespielt ist.
          const fertig = () => { this.zaehler.offen = Math.max(0, this.zaehler.offen - 1); if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ event: "mark", streamSid: this.streamSid, mark: { name: m.mark?.name } })); };
          const t = setTimeout(() => { this.markenTimer.delete(t); fertig(); }, Math.max(0, this.spielEnde - Date.now()));
          this.markenTimer.set(t, fertig);
        }
      });
      ws.on("close", () => { this.zu = true; if (this.takt) clearInterval(this.takt); });
      ws.on("error", (err) => { if (!this.zu) ablehnen(err); });
    });
  }

  /** Der Kunde legt auf: stop, dann zu. */
  aufhaengen(): void {
    if (this.takt) clearInterval(this.takt);
    const ws = this.ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event: "stop", streamSid: this.streamSid, stop: { accountSid: "ACattrappe", callSid: this.callSid } }));
      setTimeout(() => { try { ws.close(1000); } catch { /* egal */ } }, 50);
    }
  }
  /** Warten, bis die Brücke die Verbindung schließt (oder Frist). */
  geschlossen(fristMs = 5000): Promise<boolean> {
    return new Promise((l) => {
      if (this.zu || !this.ws) return l(true);
      const t = setTimeout(() => l(false), fristMs);
      this.ws.once("close", () => { clearTimeout(t); l(true); });
    });
  }
  istZu(): boolean { return this.zu; }
  gesendet(): { media: number; clear: number; mark: number; offen: number; maxOffen: number } { return { ...this.zaehler }; }
  /** Der Kunde spricht: laute Rahmen (µ-law) für n Millisekunden statt Stille — für die Lautstärke-Erkennung der Brücke. */
  laut(ms: number): void { this.lautBis = Date.now() + ms; }
  /** Der Kunde spricht echten Ton (µ-law 8 kHz) — in 20-ms-Rahmen, in Echtzeit, statt Stille (Rauchtest mit echtem GPT-Live). */
  sprechen(mulaw: Buffer): void { for (let o = 0; o < mulaw.length; o += 160) this.stimme.push(mulaw.subarray(o, o + 160)); }
  private stimme: Buffer[] = [];
  /** Bis wann der Kunde zuletzt laut war (Uhrzeit). */
  lautEnde(): number { return this.lautBis; }
  /** Wann Rede-Rahmen von Aras bei „Twilio“ ankamen (Uhrzeiten) — ohne Atmo ist alles andere Stille. */
  lautAngekommen(): number[] { return [...this.lautEmpfangen]; }
  /** Was der Kunde hört, als PCM16 je Rahmen mit Abspiel-Start (Uhrzeit). */
  gespielt(): { start: number; empfangen: number; pcm: Int16Array }[] {
    return this.log.map((r) => ({ start: r.start, empfangen: r.empfangen, pcm: TwilioAttrappe.dekodieren(r.roh) }));
  }
  /** Hörbare Lücken mitten in der Rede (ms): Stille oder „Twilio leer“ zwischen zwei Rede-Rahmen, `abMs`–350 ms. */
  luecken(abMs = 5): number[] {
    const z = this.gespielt().sort((a, b) => a.start - b.start);
    const aus: number[] = [];
    let rede = false, still = 0, pos = 0;
    for (const g of z) {
      const dauer = g.pcm.length / 8;
      if (pos && g.start > pos) still += g.start - pos;
      if (TwilioAttrappe.dbfs(g.pcm) > -45) { if (rede && still >= abMs && still <= 350) aus.push(Math.round(still)); rede = true; still = 0; }
      else still += dauer;
      pos = g.start + dauer;
    }
    return aus;
  }
  /**
   * „Twilio lief leer“ mitten in einem Redebeitrag (ms je Lücke): ein Rahmen kam erst, nachdem alles davor schon gespielt war,
   * und davor lief Rede (bis 400 ms zurück). Natürliche Sprechpausen schickt GPT-Live als Stille-Rahmen — die zählen hier
   * NICHT. Das ist die Messung für echte Sprache; `luecken` taugt nur für gleichmäßigen Prüfton.
   */
  leerLaeufe(abMs = 5): number[] {
    const z = this.gespielt().sort((a, b) => a.start - b.start);
    const aus: number[] = [];
    let pos = 0, redeBis = -1;
    for (const g of z) {
      const dauer = g.pcm.length / 8;
      if (pos && g.start - pos >= abMs && pos - redeBis <= 400) aus.push(Math.round(g.start - pos));
      if (TwilioAttrappe.dbfs(g.pcm) > -45) redeBis = g.start + dauer;
      pos = g.start + dauer;
    }
    return aus;
  }
  /** Pegel der Rede beim Kunden (RMS in dBFS über Rede-Rahmen). */
  redePegel(): number {
    let s = 0, n = 0;
    for (const g of this.gespielt()) if (TwilioAttrappe.dbfs(g.pcm) > -45) { for (const v of g.pcm) s += (v / 32768) ** 2; n += g.pcm.length; }
    return n ? 10 * Math.log10(s / n) : -120;
  }
  static dbfs(x: Int16Array): number { let s = 0; for (const v of x) s += (v / 32768) ** 2; return 10 * Math.log10(Math.max(1e-12, s / Math.max(1, x.length))); }
  static dekodieren(b: Buffer): Int16Array {
    const a = new Int16Array(b.length);
    for (let i = 0; i < b.length; i++) { const u = ~b[i] & 0xff, e = (u >> 4) & 7, m = u & 15, v = (((m << 3) + 0x84) << e) - 0x84; a[i] = u & 0x80 ? -v : v; }
    return a;
  }
  private lautBis = 0;
  private lautEmpfangen: number[] = [];
}
