import { useEffect, useState, useRef } from "react";

export default function DashboardPage() {
  const [greeting, setGreeting] = useState("");
  const [mounted, setMounted] = useState(false);
  const [cardTilt, setCardTilt] = useState({ x: 0, y: 0 });
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isDataOpen, setIsDataOpen] = useState(false);
  const [bankStatementFile, setBankStatementFile] = useState<File | null>(null);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadSuccess, setIsUploadSuccess] = useState(false);
  
  const fileInputRef1 = useRef<HTMLInputElement>(null);
  const fileInputRef2 = useRef<HTMLInputElement>(null);

  // Dynamic greeting based on time of day
  useEffect(() => {
    const hour = new Date().getHours();
    let greetingText = "";

    if (hour >= 5 && hour < 12) {
      greetingText = "Guten Morgen";
    } else if (hour >= 12 && hour < 18) {
      greetingText = "Guten Tag";
    } else {
      greetingText = "Guten Abend";
    }

    setGreeting(greetingText);
    setMounted(true);
  }, []);

  // Mock data (will be replaced with API data)
  const userData = {
    firstName: "Max",
    lastName: "Mustermann",
    packName: "FIAON Ultra",
    approvedLimit: 15000,
    email: "max@mustermann.de",
    phone: "+49 170 1234567",
    street: "Musterstraße 42",
    zip: "10115",
    city: "Berlin",
    country: "Deutschland",
    birthdate: "15.03.1990",
    employment: "Angestellt",
    employer: "Tech GmbH",
    income: 75000,
    rent: 1200,
    housing: "Miete",
    purpose: "Umsatzfinanzierung",
    wantedLimit: 15000,
    billingMethod: "SEPA",
    iban: "DE89 3704 0044 0532 0130 00",
  };

  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const tiltX = (y - centerY) / 20;
    const tiltY = (centerX - x) / 20;
    
    setCardTilt({ x: tiltX, y: tiltY });
    setMousePos({ x, y });
  };

  const handleCardMouseLeave = () => {
    setCardTilt({ x: 0, y: 0 });
  };

  const handleUpload = async () => {
    setIsUploading(true);
    // Simulate 2-second upload
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsUploading(false);
    setIsUploadSuccess(true);
  };


  return (
    <div className="min-h-screen bg-[#FDFDFD] relative">
      {/* Ambient Background Layer */}
      <div className="fixed inset-0 z-[-1] bg-[#FDFDFD] overflow-hidden pointer-events-none">
        {/* Animierter Blur-Orb Oben Rechts */}
        <div className="absolute -top-[20%] -right-[10%] w-[70vw] h-[70vw] rounded-full bg-blue-100/40 blur-[120px] mix-blend-multiply animate-pulse-slow"></div>
        {/* Animierter Blur-Orb Unten Links */}
        <div className="absolute -bottom-[20%] -left-[10%] w-[60vw] h-[60vw] rounded-full bg-slate-100/50 blur-[100px] mix-blend-multiply"></div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Header & Greeting Section */}
        <div className={`animate-[fadeInUp_0.4s_ease-out] ${mounted ? 'opacity-100' : 'opacity-0'}`}>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-800 via-blue-600 to-slate-800 animate-gradient-x bg-[length:200%_auto] mb-2">
            {greeting}, {userData.firstName}.
          </h1>
          <p className="text-sm text-slate-500 font-medium">
            Willkommen in deinem strategischen Finanz-Hub.
          </p>
        </div>

        {/* Asset Section - Bento Grid */}
        <div className={`mt-12 animate-[fadeInUp_0.4s_ease-out_0.1s] ${mounted ? 'opacity-100' : 'opacity-0'} fill-mode-forwards`}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Master Card - Credit Card with Hover Effects */}
            <div className="relative">
              <div 
                className="relative w-full aspect-[1.586/1] bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 shadow-2xl overflow-hidden transition-all duration-200 ease-out cursor-pointer"
                style={{
                  transform: `perspective(1000px) rotateX(${cardTilt.x}deg) rotateY(${cardTilt.y}deg)`,
                  transformStyle: 'preserve-3d',
                }}
                onMouseMove={handleCardMouseMove}
                onMouseLeave={handleCardMouseLeave}
              >
                {/* Noise Texture Overlay */}
                <div className="absolute inset-0 opacity-[0.03]" style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%' height='100%' filter='url(%23noise)'/%3E%3C/svg%3E")`
                }}></div>
                
                {/* Inner Glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
                
                {/* Reflection/Shine Effect */}
                <div 
                  className="absolute inset-0 opacity-0 transition-opacity duration-200"
                  style={{
                    background: `radial-gradient(circle at ${mousePos.x}px ${mousePos.y}px, rgba(255,255,255,0.15) 0%, transparent 50%)`,
                    opacity: cardTilt.x !== 0 || cardTilt.y !== 0 ? 1 : 0,
                  }}
                ></div>
                
                {/* Card Content */}
                <div className="relative z-10 h-full flex flex-col justify-between" style={{ transform: 'translateZ(20px)' }}>
                  <div className="flex justify-between items-start">
                    <div className="text-white/80 text-sm font-medium tracking-wider">
                      FIAON
                    </div>
                    <div className="text-white/60 text-xs">
                      ULTRA
                    </div>
                  </div>
                  
                  {/* EMV Chip */}
                  <div className="w-12 h-10 bg-gradient-to-br from-yellow-300 to-yellow-500 rounded-md shadow-inner relative overflow-hidden">
                    <div className="absolute inset-0 opacity-20" style={{
                      backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)`
                    }}></div>
                  </div>
                  
                  <div className="flex justify-between items-end">
                    <div>
                      <div className="text-white/60 text-xs mb-1">Limit</div>
                      <div className="text-white text-2xl font-bold">
                        €{userData.approvedLimit.toLocaleString('de-DE')}
                      </div>
                    </div>
                    <div className="text-white/40 text-xs tracking-widest">
                      •••• 4242
                    </div>
                  </div>
                  
                  {/* User Name */}
                  <div className="text-white text-sm font-medium tracking-wider uppercase">
                    {userData.firstName} {userData.lastName}
                  </div>
                </div>
              </div>
            </div>

            {/* User Data Section */}
            <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
              {/* Accordion Header */}
              <div 
                className="flex justify-between items-center w-full cursor-pointer group"
                onClick={() => setIsDataOpen(!isDataOpen)}
              >
                <span className="text-lg font-bold tracking-tight text-slate-800 group-hover:text-blue-600 transition-colors duration-300">
                  Vertragsdetails & Daten
                </span>
                <div 
                  className="transform transition-transform duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]"
                  style={{ transform: isDataOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400 group-hover:text-blue-600 transition-colors duration-300">
                    <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>

              {/* CSS Grid Accordion Animation */}
              <div className={`grid transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${isDataOpen ? 'grid-rows-[1fr] opacity-100 mt-6' : 'grid-rows-[0fr] opacity-0 mt-0'}`}>
                <div className="overflow-hidden">
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:justify-between py-3 border-b border-slate-50 last:border-0">
                      <span className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Name</span>
                      <span className="text-sm font-medium text-slate-900 text-right">{userData.firstName} {userData.lastName}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between py-3 border-b border-slate-50 last:border-0">
                      <span className="text-xs uppercase tracking-widest text-slate-400 font-semibold">E-Mail</span>
                      <span className="text-sm font-medium text-slate-900 text-right">{userData.email}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between py-3 border-b border-slate-50 last:border-0">
                      <span className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Telefon</span>
                      <span className="text-sm font-medium text-slate-900 text-right">{userData.phone}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between py-3 border-b border-slate-50 last:border-0">
                      <span className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Adresse</span>
                      <span className="text-sm font-medium text-slate-900 text-right">{userData.street}, {userData.zip} {userData.city}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between py-3 border-b border-slate-50 last:border-0">
                      <span className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Geburtsdatum</span>
                      <span className="text-sm font-medium text-slate-900 text-right">{userData.birthdate}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between py-3 border-b border-slate-50 last:border-0">
                      <span className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Beschäftigung</span>
                      <span className="text-sm font-medium text-slate-900 text-right">{userData.employment} bei {userData.employer}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between py-3 border-b border-slate-50 last:border-0">
                      <span className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Einkommen</span>
                      <span className="text-sm font-medium text-slate-900 text-right">€{userData.income.toLocaleString('de-DE')}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between py-3 border-b border-slate-50 last:border-0">
                      <span className="text-xs uppercase tracking-widest text-slate-400 font-semibold">IBAN</span>
                      <span className="text-sm font-medium text-slate-900 text-right">{userData.iban}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between py-3 last:border-0">
                      <span className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Paket</span>
                      <span className="text-sm font-medium text-slate-900 text-right">{userData.packName}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Divider when accordion is closed */}
              {!isDataOpen && <div className="border-t border-slate-100 my-6"></div>}

              {/* Status Badge - Always Visible */}
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div>
                <span 
                  className="bg-rose-50 text-rose-600 px-4 py-2 rounded-full text-sm font-semibold cursor-pointer hover:bg-rose-100 transition-colors"
                  onClick={() => document.getElementById('kyc-section')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  Handlung erforderlich
                </span>
              </div>
              
              {/* Progress Bar - Always Visible */}
              <div className="mt-4 w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: '33%' }}
                ></div>
              </div>
              
              {/* Tooltip - Always Visible */}
              <div className="mt-4 text-xs text-slate-400 text-center">
                Bitte laden Sie die fehlenden Dokumente hoch, um das Konto zu aktivieren.
              </div>
            </div>
          </div>
        </div>

        {/* KYC Document Upload Section */}
        <div id="kyc-section" className={`mt-16 animate-[fadeInUp_0.4s_ease-out_0.2s] ${mounted ? 'opacity-100' : 'opacity-0'} fill-mode-forwards`}>
          {/* Section Header */}
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight text-slate-800">Aktion erforderlich: Verifizierung</h2>
            <span className="bg-amber-50 text-amber-600 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              1 Aufgabe offen
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Um Ihr Limit freizuschalten, benötigen wir noch folgende Unterlagen. Der Upload ist End-to-End verschlüsselt.
          </p>

          {/* Upload Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            {/* Bank Statement Card */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
              <div className="font-mono text-xs text-slate-300 tracking-widest mb-4">01</div>
              <h3 className="text-lg font-bold text-slate-800 tracking-tight">Kontoauszüge (6 Monate)</h3>

              {!bankStatementFile ? (
                <>
                  <div 
                    className="mt-6 bg-slate-50/50 rounded-2xl p-6 transition-all duration-300 cursor-pointer border border-transparent hover:border-blue-100 hover:bg-blue-50/30 group flex flex-col items-center justify-center h-32"
                    onClick={() => fileInputRef1.current?.click()}
                  >
                    <span className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                      Datei auswählen
                    </span>
                    <span className="text-xs text-slate-400 mt-1">PDF, max. 10 MB</span>
                  </div>
                  <input
                    ref={fileInputRef1}
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => e.target.files && setBankStatementFile(e.target.files[0])}
                  />
                </>
              ) : (
                <div className="mt-6 bg-slate-900 rounded-2xl p-4 flex justify-between items-center">
                  <div className="flex flex-col truncate pr-4">
                    <span className="text-sm font-medium text-white truncate">{bankStatementFile.name}</span>
                    <span className="text-xs text-slate-400">Bereit zum Upload</span>
                  </div>
                  <button 
                    onClick={() => setBankStatementFile(null)} 
                    className="text-xs text-slate-400 hover:text-white transition-colors uppercase tracking-widest font-semibold"
                  >
                    Entfernen
                  </button>
                </div>
              )}
            </div>

            {/* Passport/ID Card */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
              <div className="font-mono text-xs text-slate-300 tracking-widest mb-4">02</div>
              <h3 className="text-lg font-bold text-slate-800 tracking-tight">Identitätsnachweis</h3>

              {!idFile ? (
                <>
                  <div 
                    className="mt-6 bg-slate-50/50 rounded-2xl p-6 transition-all duration-300 cursor-pointer border border-transparent hover:border-blue-100 hover:bg-blue-50/30 group flex flex-col items-center justify-center h-32"
                    onClick={() => fileInputRef2.current?.click()}
                  >
                    <span className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                      Datei auswählen
                    </span>
                    <span className="text-xs text-slate-400 mt-1">PDF, max. 10 MB</span>
                  </div>
                  <input
                    ref={fileInputRef2}
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => e.target.files && setIdFile(e.target.files[0])}
                  />
                </>
              ) : (
                <div className="mt-6 bg-slate-900 rounded-2xl p-4 flex justify-between items-center">
                  <div className="flex flex-col truncate pr-4">
                    <span className="text-sm font-medium text-white truncate">{idFile.name}</span>
                    <span className="text-xs text-slate-400">Bereit zum Upload</span>
                  </div>
                  <button 
                    onClick={() => setIdFile(null)} 
                    className="text-xs text-slate-400 hover:text-white transition-colors uppercase tracking-widest font-semibold"
                  >
                    Entfernen
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Upload Button */}
          {(bankStatementFile || idFile) && !isUploadSuccess && (
            <div className="mt-8 flex justify-center">
              <button
                onClick={handleUpload}
                disabled={isUploading}
                className="relative px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                {isUploading ? (
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Wird hochgeladen...</span>
                  </div>
                ) : (
                  <>
                    <span className="relative z-10">Dokumente sicher hochladen</span>
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-400 to-blue-500 opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-300"></div>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Success Message */}
          {isUploadSuccess && (
            <div className="mt-8 flex justify-center">
              <div className="text-center">
                <div className="inline-flex items-center gap-2 text-emerald-600 font-semibold">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Upload erfolgreich. Wir prüfen Ihre Dokumente.</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
