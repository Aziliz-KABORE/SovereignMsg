/**
 * SovereignMsg Client - Application principale et routage
 * ========================================================
 * Routage React Router avec AuthProvider et garde de routes.
 * Règles :
 * - Aucune dépendance externe ni CDN.
 * - Redirection stricte via <Navigate replace /> (aucun rendu vide).
 */

import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./store/authStore";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { P01_Login } from "./pages/P01_Login";
import { P03_Activation } from "./pages/P03_Activation";
import { P04_Accueil } from "./pages/P04_Accueil";
import { AccesRefuse } from "./pages/AccesRefuse";
import "./locales/i18n";

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Routes publiques d'authentification */}
          <Route path="/connexion" element={<P01_Login />} />
          <Route path="/activation" element={<P03_Activation />} />
          <Route path="/acces-refuse" element={<AccesRefuse />} />

          {/* Espace sécurisé de l'agent (protégé par jeton en mémoire) */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <P04_Accueil />
              </ProtectedRoute>
            }
          />

          {/* Exemple de route réservée aux administrateurs pour test de garde de rôle */}
          <Route
            path="/admin-test"
            element={
              <ProtectedRoute rolesAutorises={["admin"]}>
                <div data-testid="admin-content">Espace Administrateur Sécurisé</div>
              </ProtectedRoute>
            }
          />

          {/* Redirection par défaut */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
