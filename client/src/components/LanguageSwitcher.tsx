import { motion } from 'framer-motion';
import { useLanguage } from '@/lib/auto-translate';

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed top-8 right-8 z-[60]"
    >
      <div className="flex items-center gap-2 p-1 rounded-full bg-black/90 backdrop-blur-md border border-white/10 shadow-2xl">
        <motion.button
          onClick={() => setLanguage('de')}
          className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
            language === 'de' ? 'text-black' : 'text-white/60 hover:text-white/80'
          }`}
          style={{
            fontFamily: 'Orbitron, sans-serif',
            background: language === 'de'
              ? 'linear-gradient(135deg, #e9d7c4, #FE9100)'
              : 'transparent',
            boxShadow: language === 'de' ? '0 0 20px rgba(254, 145, 0, 0.4)' : 'none'
          }}
          whileHover={{ scale: language === 'de' ? 1 : 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          DE
        </motion.button>
        
        <motion.button
          onClick={() => setLanguage('en')}
          className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
            language === 'en' ? 'text-black' : 'text-white/60 hover:text-white/80'
          }`}
          style={{
            fontFamily: 'Orbitron, sans-serif',
            background: language === 'en'
              ? 'linear-gradient(135deg, #e9d7c4, #FE9100)'
              : 'transparent',
            boxShadow: language === 'en' ? '0 0 20px rgba(254, 145, 0, 0.4)' : 'none'
          }}
          whileHover={{ scale: language === 'en' ? 1 : 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          EN
        </motion.button>
      </div>
    </motion.div>
  );
}
