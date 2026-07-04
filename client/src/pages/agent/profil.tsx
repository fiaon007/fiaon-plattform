import { useState, useEffect, useRef } from "react";
import { Camera, Trash2 } from "lucide-react";
import { AgentShell, Card, FlashMessage, Avatar, api, inputCls, btnPrimary, btnGhost } from "./shared";
import { Reveal } from "./motion";

// ============================================================================
// /agent/profil (F3)
// - Profilbild: quadratischer Zuschnitt + Verkleinerung auf 256px im Browser
//   (Canvas), max. 2 MB Rohdatei; Anzeige als dezenter Kreis, Initialen-Fallback
// - Telefonnummer selbst änderbar; Name/E-Mail nur durch Admin
// - Passwort ändern (altes Passwort erforderlich)
// - Auszahlungsdaten: IBAN-Prüfsummen-Check, verschlüsselte Speicherung,
//   maskierte Anzeige; jede Änderung wird auditiert + beim Admin gemeldet
// ============================================================================

interface Profile {
  firstName: string | null;
  lastName: string | null;
  name: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  ibanMasked: string | null;
  hasBank: boolean;
  bankHolder: string | null;
}

/** Quadratischer Center-Crop + Resize auf 256×256 als JPEG-DataURL. */
async function cropResizeImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const side = Math.min(img.width, img.height);
    const sx = (img.width - side) / 2;
    const sy = (img.height - side) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, sx, sy, side, side, 0, 0, 256, 256);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Client-seitige IBAN-Vorprüfung (Server validiert erneut)
function ibanLooksValid(input: string): boolean {
  const iban = input.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let rem = 0;
  for (const ch of rearranged) {
    const val = ch >= "A" ? String(ch.charCodeAt(0) - 55) : ch;
    for (const d of val) rem = (rem * 10 + Number(d)) % 97;
  }
  return rem === 1;
}

export default function AgentProfilPage() {
  return (
    <AgentShell>
      <ProfilContent />
    </AgentShell>
  );
}

function ProfilContent() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [phone, setPhone] = useState("");
  const [pwForm, setPwForm] = useState({ old: "", neu: "", neu2: "" });
  const [bankForm, setBankForm] = useState({ holder: "", iban: "", bic: "" });
  const [busy, setBusy] = useState<string | null>(null);

  const flash = (m: string) => { setMessage(m); setTimeout(() => setMessage(null), 4000); };

  const load = () => {
    api("/agent/profile").then((r) => {
      if (r.ok) {
        setProfile(r.json.profile);
        setPhone(r.json.profile.phone || "");
        setBankForm((f) => ({ ...f, holder: r.json.profile.bankHolder || "" }));
      }
    });
  };
  useEffect(load, []);

  if (!profile) return <p className="py-14 text-center text-[13px] text-slate-400">Lädt …</p>;

  const uploadAvatar = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) { flash("Bild zu groß (max. 2 MB)"); return; }
    setBusy("avatar");
    try {
      const dataUrl = await cropResizeImage(file);
      const r = await api("/agent/profile/avatar", { method: "POST", body: JSON.stringify({ avatar: dataUrl }) });
      if (r.ok) { flash("Profilbild aktualisiert"); load(); }
      else flash(r.json?.error || "Fehler beim Upload");
    } catch {
      flash("Bild konnte nicht verarbeitet werden");
    } finally {
      setBusy(null);
    }
  };

  const removeAvatar = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setBusy("avatar");
    const r = await api("/agent/profile/avatar", { method: "POST", body: JSON.stringify({ avatar: "" }) });
    setBusy(null);
    if (r.ok) { flash("Profilbild entfernt"); load(); }
  };

  const savePhone = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setBusy("phone");
    const r = await api("/agent/profile/phone", { method: "POST", body: JSON.stringify({ phone }) });
    setBusy(null);
    flash(r.ok ? "Telefonnummer gespeichert" : r.json?.error || "Fehler");
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.neu !== pwForm.neu2) { flash("Neue Passwörter stimmen nicht überein"); return; }
    setBusy("pw");
    const r = await api("/agent/profile/password", {
      method: "POST",
      body: JSON.stringify({ oldPassword: pwForm.old, newPassword: pwForm.neu }),
    });
    setBusy(null);
    if (r.ok) { flash("Passwort geändert"); setPwForm({ old: "", neu: "", neu2: "" }); }
    else flash(r.json?.error || "Fehler");
  };

  const saveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ibanLooksValid(bankForm.iban)) { flash("IBAN ungültig (Prüfsumme fehlgeschlagen)"); return; }
    setBusy("bank");
    const r = await api("/agent/profile/bank", {
      method: "POST",
      body: JSON.stringify({ holder: bankForm.holder, iban: bankForm.iban, bic: bankForm.bic }),
    });
    setBusy(null);
    if (r.ok) { flash("Auszahlungsdaten gespeichert"); setBankForm((f) => ({ ...f, iban: "", bic: "" })); load(); }
    else flash(r.json?.error || "Fehler");
  };

  return (
    <div className="max-w-2xl">
      <Reveal index={0}>
        <h1 className="text-xl font-bold tracking-tight mb-1">Profil</h1>
        <p className="text-[12px] text-slate-400 mb-5">Deine Konto- und Auszahlungsdaten.</p>
      </Reveal>
      <FlashMessage message={message} />

      {/* Profilbild + Stammdaten */}
      <Reveal index={1} className="block mb-4"><Card className="p-5">
        <div className="flex items-center gap-4">
          <Avatar src={profile.avatar} name={profile.name} size={64} />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-slate-900">{profile.name}</p>
            <p className="text-[12px] text-slate-400">{profile.email}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Name und E-Mail können nur vom Administrator geändert werden.</p>
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
              disabled={busy === "avatar"}
              className={`${btnGhost} px-3 py-2 inline-flex items-center gap-1.5 text-[12px]`}
            >
              <Camera size={13} strokeWidth={1.8} /> Bild
            </button>
            {profile.avatar && (
              <button type="button" onClick={removeAvatar} className="text-[11px] text-slate-400 hover:text-slate-600 inline-flex items-center gap-1 justify-center">
                <Trash2 size={11} /> Entfernen
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); e.target.value = ""; }}
          />
        </div>
      </Card></Reveal>

      {/* Telefon */}
      <Reveal index={2} className="block mb-4"><Card className="p-5">
        <h2 className="text-[13px] font-semibold text-slate-900 mb-3">Telefonnummer</h2>
        <div className="flex gap-2">
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+49 …" className={inputCls} />
          <button type="button" onClick={savePhone} disabled={busy === "phone"} className={btnPrimary}>
            {busy === "phone" ? "…" : "Speichern"}
          </button>
        </div>
      </Card></Reveal>

      {/* Passwort */}
      <Reveal index={3} className="block mb-4"><Card className="p-5">
        <h2 className="text-[13px] font-semibold text-slate-900 mb-3">Passwort ändern</h2>
        <form onSubmit={savePassword} className="space-y-3">
          <input type="password" value={pwForm.old} onChange={(e) => setPwForm((f) => ({ ...f, old: e.target.value }))} placeholder="Aktuelles Passwort" autoComplete="current-password" className={inputCls} />
          <div className="grid sm:grid-cols-2 gap-3">
            <input type="password" value={pwForm.neu} onChange={(e) => setPwForm((f) => ({ ...f, neu: e.target.value }))} placeholder="Neues Passwort" autoComplete="new-password" className={inputCls} />
            <input type="password" value={pwForm.neu2} onChange={(e) => setPwForm((f) => ({ ...f, neu2: e.target.value }))} placeholder="Neues Passwort wiederholen" autoComplete="new-password" className={inputCls} />
          </div>
          <p className="text-[11px] text-slate-400">Min. 10 Zeichen, Zahl, Groß- und Kleinbuchstabe.</p>
          <button type="submit" disabled={busy === "pw" || !pwForm.old || !pwForm.neu} className={btnPrimary}>
            {busy === "pw" ? "…" : "Passwort ändern"}
          </button>
        </form>
      </Card></Reveal>

      {/* Auszahlungsdaten */}
      <Reveal index={4} className="block"><Card className="p-5">
        <h2 className="text-[13px] font-semibold text-slate-900 mb-1">Auszahlungsdaten</h2>
        <p className="text-[12px] text-slate-400 mb-3">
          Wird verschlüsselt gespeichert und nur maskiert angezeigt. Jede Änderung wird protokolliert und dem Administrator gemeldet.
        </p>
        {profile.ibanMasked && (
          <div className="mb-4 px-3.5 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-[13px]">
            <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wide mr-2">Hinterlegt</span>
            <span className="font-mono font-medium text-slate-700">{profile.ibanMasked}</span>
            {profile.bankHolder && <span className="text-slate-500"> · {profile.bankHolder}</span>}
          </div>
        )}
        <form onSubmit={saveBank} className="space-y-3">
          <input type="text" value={bankForm.holder} onChange={(e) => setBankForm((f) => ({ ...f, holder: e.target.value }))} placeholder="Kontoinhaber" className={inputCls} />
          <div className="grid sm:grid-cols-[1fr_180px] gap-3">
            <input type="text" value={bankForm.iban} onChange={(e) => setBankForm((f) => ({ ...f, iban: e.target.value }))} placeholder="IBAN" className={`${inputCls} font-mono`} />
            <input type="text" value={bankForm.bic} onChange={(e) => setBankForm((f) => ({ ...f, bic: e.target.value }))} placeholder="BIC (optional)" className={`${inputCls} font-mono`} />
          </div>
          <button type="submit" disabled={busy === "bank" || !bankForm.holder || !bankForm.iban} className={btnPrimary}>
            {busy === "bank" ? "…" : profile.hasBank ? "Auszahlungsdaten aktualisieren" : "Auszahlungsdaten speichern"}
          </button>
        </form>
      </Card></Reveal>
    </div>
  );
}
