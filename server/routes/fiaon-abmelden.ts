// ═══════════════════════════════════════════════════════════════════════════
// ABMELDELINK JE PERSON — der zweite Ausstieg neben „Stopp“ (02.09.2026)
//
// Prüfung der Dauerpflege: Ein Antwort-„Stopp“ allein reicht nicht. Gmail und
// Yahoo werten Massenmails ohne One-Click-Unsubscribe seit 2024 ab, und wer
// keinen Abmeldelink findet, klickt „Spam“ — das trifft die Domain für ALLE
// Mails des Hauses. Deshalb: ein signierter Link je Person (Muster wie der
// Termin-Token), der werbung_gesperrt_am setzt — dieselbe Sperre, die auch
// der Postmeister bei „Stopp“ setzt und die die Frequenzbremse liest. Dazu
// die Kopfzeilen List-Unsubscribe / List-Unsubscribe-Post (RFC 8058), damit
// der Postfach-Anbieter den Abmeldeknopf oben zeigen kann.
//
// Justins Grundsatz „niemand fällt aus dem Marketing“ endet genau hier: Wer
// sich abmeldet, hat widersprochen (UWG § 7, DSGVO Art. 21). Das ist Gesetz.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";
import { createHmac } from "crypto";
import { sqlPool } from "../lib/db-pool";
import { absoluteUrl } from "../fiaon-base-url";

const router = Router();

function geheim(): string {
  return process.env.SESSION_SECRET || process.env.PORTAL_SESSION_SECRET || "fiaon-dev-abmelden-secret";
}
function signatur(personId: number): string {
  return createHmac("sha256", geheim()).update(`abmelden.${personId}`).digest("hex").slice(0, 32);
}
/** Der Link in jeder werbenden Mail — ohne Ablauf, denn Abmelden darf nie scheitern. */
export function abmeldeLinkPerson(personId: number): string {
  return absoluteUrl(`/api/fiaon/abmelden/p/${personId}.${signatur(personId)}`);
}
function pruefen(token: string): number | null {
  const [id, sig] = String(token || "").split(".");
  const personId = Number(id);
  if (!Number.isInteger(personId) || personId <= 0 || !sig) return null;
  return signatur(personId) === sig ? personId : null;
}

async function sperren(personId: number): Promise<boolean> {
  const rows = (await sqlPool`
    UPDATE fiaon_persons SET werbung_gesperrt_am = COALESCE(werbung_gesperrt_am, NOW()), updated_at = NOW()
     WHERE id = ${personId} RETURNING id`) as any[];
  if (rows.length) {
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
      SELECT a.ref, ${personId}, NULL, 'System', 'system', 'Abmeldelink geklickt — Werbesperre gesetzt. Keine werbenden Mails mehr.'
        FROM fiaon_applications a WHERE a.person_id = ${personId} AND a.merged_into IS NULL
       ORDER BY a.created_at DESC LIMIT 1`.catch(() => {});
  }
  return rows.length > 0;
}

function seite(titel: string, text: string): string {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titel} · FIAON</title><style>body{margin:0;background:#f6f7f9;font:16px/1.6 -apple-system,Segoe UI,Arial,sans-serif;color:#16213a}
main{max-width:560px;margin:12vh auto;padding:32px;background:#fff;border:1px solid #d9dee7;border-radius:14px}h1{font-size:22px;margin:0 0 12px}p{margin:0 0 10px}
a{color:#1f3b73}</style></head><body><main><h1>${titel}</h1><p>${text}</p><p style="color:#5b6478;font-size:14px">FIAON · <a href="https://fiaon.com">fiaon.com</a></p></main></body></html>`;
}

/** GET — der Klick aus der Mail. */
router.get("/abmelden/p/:token", async (req: Request, res: Response) => {
  const personId = pruefen(String(req.params.token || ""));
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  if (!personId) return res.status(400).send(seite("Dieser Link ist ungültig", "Bitte antworten Sie stattdessen einfach mit „Stopp“ auf unsere E-Mail — dann nehmen wir Sie ebenfalls aus dem Verteiler."));
  try {
    await sperren(personId);
    return res.send(seite("Sie sind abgemeldet", "Wir schicken Ihnen keine werbenden E-Mails mehr. Nachrichten zu einer laufenden Bestellung — etwa Zugangsdaten oder Terminbestätigungen — erhalten Sie weiterhin."));
  } catch (err) {
    console.error("[ABMELDEN]", err);
    return res.status(500).send(seite("Das hat gerade nicht geklappt", "Bitte antworten Sie mit „Stopp“ auf unsere E-Mail — das wirkt genauso."));
  }
});

/** POST — One-Click-Abmeldung durch den Postfach-Anbieter (RFC 8058), ohne Seite. */
router.post("/abmelden/p/:token", async (req: Request, res: Response) => {
  const personId = pruefen(String(req.params.token || ""));
  if (!personId) return res.status(400).end();
  try { await sperren(personId); return res.status(200).end(); }
  catch (err) { console.error("[ABMELDEN] one-click:", err); return res.status(500).end(); }
});

export default router;
