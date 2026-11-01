/**
 * SovereignMsg Client - Application principale et routage
 * ========================================================
 * Routage React Router avec AuthProvider, MatrixProvider et garde de routes.
 */

import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./store/authStore";
import { MatrixProvider } from "./store/MatrixContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { P01_Login } from "./pages/P01_Login";
import { P03_Activation } from "./pages/P03_Activation";
import { P04_Salons } from "./pages/P04_Salons";
import { P05_Conversation } from "./pages/P05_Conversation";
import { AccesRefuse } from "./pages/AccesRefuse";
import "./locales/i18n";

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <MatrixProvider>
        <BrowserRouter>
          <Routes>
            {/* Routes publiques d'authentification */}
            <Route path="/connexion" element={<P01_Login />} />
            <Route path="/activation" element={<P03_Activation />} />
            <Route path="/acces-refuse" element={<AccesRefuse />} />

            {/* Espace sécurisé de messagerie (protégé par jeton en mémoire) */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <P04_Salons />
                </ProtectedRoute>
              }
            />

            <Route
              path="/salon/:roomId"
              element={
                <ProtectedRoute>
                  <P05_Conversation />
                </ProtectedRoute>
              }
            />

            {/* Redirection par défaut */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </MatrixProvider>
    </AuthProvider>
  );
};

export default App;
