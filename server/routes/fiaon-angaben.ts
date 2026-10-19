// ═══════════════════════════════════════════════════════════════════════════
// DIE NEUE E-MAIL-ADRESSE BESTÄTIGEN (E-401 4/6, 19.10.2026)
//
// Schreibt ein Kunde Mara „meine neue E-Mail-Adresse ist …“, ändert der Server sie NICHT sofort: Ein signierter
// Einmal-Link mit Ablauf (48 Stunden) geht an die NEUE Adresse (server/lib/fiaon-mara-angaben-aendern.ts). Erst der
// Klick hier ändert sie — über den einen Speicherweg der Akte (Bestellung, Person, Alias, Anmeldung).
//
//   GET  /angaben/email/:token   die Seite mit dem Knopf — ändert NICHTS (Link-Vorschauen und Virenscanner rufen
//                                Links aus Mails ungefragt auf; ein GET, das ändert, wäre ein Klick ohne Kunden)
//   POST /angaben/email/:token   der Klick — prüft den Link noch einmal und ändert genau einmal
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";
import { emailLinkPruefen, emailBestaetigen } from "../lib/fiaon-mara-angaben-aendern";

const router = Router();

const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function seite(titel: string, text: string, knopf: string | null = null): string {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>${esc(titel)} · FIAON</title><style>body{margin:0;background:#f6f7f9;font:16px/1.6 -apple-system,Segoe UI,Arial,sans-serif;color:#16213a}
main{max-width:560px;margin:12vh auto;padding:32px;background:#fff;border:1px solid #d9dee7;border-radius:14px}h1{font-size:22px;margin:0 0 12px}p{margin:0 0 12px}
button{font:inherit;font-weight:600;color:#fff;background:#1f3b73;border:0;border-radius:10px;padding:12px 22px;cursor:pointer}a{color:#1f3b73}
@media (max-width:600px){main{margin:6vh 16px;padding:24px}}</style></head><body><main><h1>${esc(titel)}</h1><p>${esc(text)}</p>
${knopf ? `<form method="post"><button type="submit">${esc(knopf)}</button></form>` : ""}
<p style="color:#5b6478;font-size:14px;margin-top:18px">FIAON · <a href="https://www.fiaon.com">fiaon.com</a></p></main></body></html>`;
}

router.get("/angaben/email/:token", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  const p = await emailLinkPruefen(String(req.params.token ?? ""));
  if (p.art === "offen") {
    return res.send(seite("Neue E-Mail-Adresse bestätigen",
      `Sie haben uns gebeten, Ihre E-Mail-Adresse bei FIAON auf ${p.neuMaske ?? "die neue Adresse"} zu ändern. Mit einem Klick auf den Knopf bestätigen Sie, dass diese Adresse Ihnen gehört — erst dann gilt sie.`,
      "Jetzt bestätigen"));
  }
  return res.status(p.art === "fehler" ? 500 : p.art === "ungueltig" ? 400 : 200)
    .send(seite(p.art === "schon" ? "Schon bestätigt" : "Link nicht mehr gültig", p.text));
});

router.post("/angaben/email/:token", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  const p = await emailBestaetigen(String(req.params.token ?? ""));
  const titel = p.art === "bestaetigt" ? "Danke — bestätigt" : p.art === "schon" ? "Schon bestätigt" : "Das hat nicht geklappt";
  return res.status(p.art === "fehler" ? 500 : p.art === "ungueltig" ? 400 : 200).send(seite(titel, p.text));
});

export default router;
