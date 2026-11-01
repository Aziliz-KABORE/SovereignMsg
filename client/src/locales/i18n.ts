/**
 * SovereignMsg Client - Initialisation i18next
 * Prêt pour l'ajout futur des langues nationales (mooré, dioula).
 */

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import fr from "./fr.json";

i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
  },
  lng: "fr",
  fallbackLng: "fr",
  interpolation: {
    escapeValue: false, // React se charge de l'échappement XSS
  },
});

export default i18n;
