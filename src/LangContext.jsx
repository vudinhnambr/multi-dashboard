import React, { createContext, useContext, useState } from 'react';
import { translations } from './i18n.js';

const LangContext = createContext({ lang: 'vi', t: (k) => k, setLang: () => {} });

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(
    () => localStorage.getItem('cmm_lang') || 'vi'
  );

  const setLang = (l) => {
    localStorage.setItem('cmm_lang', l);
    setLangState(l);
  };

  // t(key, vars?) — looks up translation, replaces {var} placeholders
  const t = (key, vars = {}) => {
    const entry = translations[key];
    if (!entry) return key;
    let str = entry[lang] ?? entry['vi'] ?? key;
    Object.entries(vars).forEach(([k, v]) => {
      str = str.replaceAll(`{${k}}`, v);
    });
    return str;
  };

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
