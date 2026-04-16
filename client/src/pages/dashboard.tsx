import { useEffect, useState } from "react";

export default function DashboardPage() {
  const [greeting, setGreeting] = useState("");
  const [mounted, setMounted] = useState(false);

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
    packName: "FIAON Ultra",
    approvedLimit: 15000,
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD]">
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Header & Greeting Section */}
        <div className={`animate-[fadeInUp_0.4s_ease-out] ${mounted ? 'opacity-100' : 'opacity-0'}`}>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 mb-2">
            {greeting}, {userData.firstName}.
          </h1>
          <p className="text-sm text-slate-500 font-medium">
            Willkommen in deinem strategischen Finanz-Hub.
          </p>
        </div>

        {/* Asset Section - Bento Grid */}
        <div className={`mt-12 animate-[fadeInUp_0.4s_ease-out_0.1s] ${mounted ? 'opacity-100' : 'opacity-0'} fill-mode-forwards`}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Master Card - Credit Card */}
            <div className="relative">
              <div className="relative w-full aspect-[1.586/1] bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 shadow-2xl overflow-hidden">
                {/* Noise Texture Overlay */}
                <div className="absolute inset-0 opacity-[0.03]" style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%' height='100%' filter='url(%23noise)'/%3E%3C/svg%3E")`
                }}></div>
                
                {/* Inner Glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
                
                {/* Card Content */}
                <div className="relative z-10 h-full flex flex-col justify-between">
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
                </div>
              </div>
            </div>

            {/* Status Card */}
            <div className="group relative">
              <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm flex flex-col justify-center h-full">
                {/* Status Badge with Pulsing Dot */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="relative">
                    <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                  </div>
                  <span className="bg-amber-50 text-amber-600 px-4 py-2 rounded-full text-sm font-semibold">
                    Konto in Bearbeitung
                  </span>
                </div>

                {/* Custom Premium Tooltip */}
                <div className="relative inline-block mb-6">
                  <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md text-white text-xs px-3 py-2 rounded-lg whitespace-nowrap z-10">
                    Ihre Unterlagen werden geprüft. In der Regel dauert dies 1-3 Werktage.
                  </div>
                  <div className="text-slate-900 font-semibold text-lg mb-1">
                    {userData.packName}
                  </div>
                  <div className="text-slate-500 text-sm">
                    Ihr Premium-Konto wird aktiviert
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-1000 ease-out"
                    style={{ width: '33%' }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
