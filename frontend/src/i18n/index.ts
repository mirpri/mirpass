import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

export const I18N_STORAGE_KEY = "mirpass_i18n_lang";

export const SUPPORTED_LANGUAGES = ["en", "zh"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export type LanguagePreference = SupportedLanguage | "auto";

const FALLBACK_LANGUAGE: SupportedLanguage = "en";

const normalizeLanguageCode = (value?: string | null): SupportedLanguage => {
  const normalized = value?.toLowerCase().split("-")[0];
  if (normalized && SUPPORTED_LANGUAGES.includes(normalized as SupportedLanguage)) {
    return normalized as SupportedLanguage;
  }
  return FALLBACK_LANGUAGE;
};

const detectBrowserLanguage = (): SupportedLanguage => {
  if (typeof navigator === "undefined") {
    return FALLBACK_LANGUAGE;
  }

  const candidates = [
    ...(navigator.languages || []),
    navigator.language,
  ];

  for (const candidate of candidates) {
    const normalized = candidate?.toLowerCase().split("-")[0];
    if (normalized && SUPPORTED_LANGUAGES.includes(normalized as SupportedLanguage)) {
      return normalized as SupportedLanguage;
    }
  }

  return FALLBACK_LANGUAGE;
};

const dynamicImportBackend = {
  type: "backend" as const,
  read(language: string, _namespace: string, callback: (error: Error | null, resources: object | false) => void) {
    import(`./locales/${language}.json`)
      .then((module) => callback(null, module.default))
      .catch((error: unknown) => {
        callback(error instanceof Error ? error : new Error("Failed to load language resources"), false);
      });
  },
};

export const getStoredLanguagePreference = (): LanguagePreference => {
  if (typeof window === "undefined") {
    return "auto";
  }

  const stored = window.localStorage.getItem(I18N_STORAGE_KEY);
  if (!stored) {
    return "auto";
  }

  if (stored === "auto") {
    return "auto";
  }

  return normalizeLanguageCode(stored);
};

export const setAppLanguage = async (preference: LanguagePreference): Promise<void> => {
  if (typeof window !== "undefined") {
    if (preference === "auto") {
      window.localStorage.removeItem(I18N_STORAGE_KEY);
    } else {
      window.localStorage.setItem(I18N_STORAGE_KEY, preference);
    }
  }

  const targetLanguage = preference === "auto"
    ? detectBrowserLanguage()
    : preference;

  await i18n.changeLanguage(targetLanguage);
};

i18n
  .use(dynamicImportBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: FALLBACK_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES,
    load: "languageOnly",
    ns: ["translation"],
    defaultNS: "translation",
    react: {
      useSuspense: false,
    },
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      lookupLocalStorage: I18N_STORAGE_KEY,
      caches: [],
    },

    interpolation: {
      escapeValue: false,
    },
  });

export const languageDisplayNames = {
  en: "English",
  zh: "中文",
};

export default i18n;
