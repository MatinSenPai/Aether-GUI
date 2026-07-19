import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { translations, type Lang, type Translation } from "@/i18n/translations";

const STORAGE_KEY = "aether-gui:language";

function readStoredLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "fa" ? "fa" : "en";
  } catch {
    return "en";
  }
}

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** Translation dictionary for the current language — `t.advanced.protocol`
   * rather than a `t("advanced.protocol")` key-string lookup, so typos are
   * TypeScript errors instead of silent blank strings. */
  t: Translation;
  dir: "rtl" | "ltr";
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => readStoredLang());

  useEffect(() => {
    const dir = lang === "fa" ? "rtl" : "ltr";
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
    // Persian gets its own font stack (see index.css's [lang="fa"] rule) —
    // Inter has no Arabic-script glyphs, so without this the browser would
    // fall back to whatever system font happens to have them, inconsistent
    // across Windows versions.
  }, [lang]);

  // On first load, also pull whatever the Rust side has persisted
  // (settings.rs::AppSettings.language) in case this is a fresh profile
  // directory where localStorage hasn't been set yet but the backend
  // store has (e.g. after a reinstall that kept app data) — backend wins
  // only when localStorage had nothing to say.
  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return;
    invoke<{ language: string }>("get_app_settings")
      .then((settings) => {
        if (settings.language === "fa" || settings.language === "en") {
          setLangState(settings.language);
        }
      })
      .catch(() => {
        // Ignore — default "en" from readStoredLang() already applied.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once
  }, []);

  function setLang(next: Lang) {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore — worst case the choice doesn't survive a restart.
    }
    // Keeps the tray menu/tooltip and OS notifications (built in Rust,
    // never touching the webview) in the same language as the window.
    invoke("set_language", { lang: next }).catch((e) => {
      console.error("Failed to sync language to backend:", e);
    });
  }

  const value: LanguageContextValue = {
    lang,
    setLang,
    t: translations[lang],
    dir: lang === "fa" ? "rtl" : "ltr",
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
