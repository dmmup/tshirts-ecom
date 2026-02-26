import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const lang = i18n.language?.startsWith('es') ? 'es' : 'en';

  return (
    <button
      onClick={() => i18n.changeLanguage(lang === 'en' ? 'es' : 'en')}
      aria-label={lang === 'en' ? 'Switch to Spanish' : 'Cambiar a inglés'}
      className="flex items-center gap-0.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors select-none"
    >
      <span className={lang === 'en' ? 'text-indigo-600' : 'text-slate-400'}>EN</span>
      <span className="text-slate-300 mx-0.5">/</span>
      <span className={lang === 'es' ? 'text-indigo-600' : 'text-slate-400'}>ES</span>
    </button>
  );
}
