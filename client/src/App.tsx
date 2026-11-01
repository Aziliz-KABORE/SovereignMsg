/**
 * SovereignMsg Client - Application principale et routage
 * ========================================================
 * Routage React Router avec AuthProvider, MatrixProvider et garde de routes.
 * Passe 3A+3B : Messagerie E2EE chiffrée (P01, P03, P04, P05, P06)
 * Passe 3C : Console d'administration et RSSI (P13, P14, P15, P16, P17)
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
// Pages d'administration (Passe 3C)
import { P13_TableauDeBord } from "./pages/admin/P13_TableauDeBord";
import { P14_ListeAgents } from "./pages/admin/P14_ListeAgents";
import { P15_EnrolementAgent } from "./pages/admin/P15_EnrolementAgent";
import { P16_FicheAgent } from "./pages/admin/P16_FicheAgent";
import { P17_JournalAudit } from "./pages/admin/P17_JournalAudit";
import "./locales/i18n";

/** Rôles autorisés pour l'accès au back-office */
const ROLES_ADMIN = ["admin", "rssi"];

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <MatrixProvider>
        <BrowserRouter>
          <Routes>
            {/* ----------------------------------------------------------------
             * Routes publiques (non authentifiées)
             * ---------------------------------------------------------------- */}
            <Route path="/connexion" element={<P01_Login />} />
            <Route path="/activation" element={<P03_Activation />} />
            <Route path="/acces-refuse" element={<AccesRefuse />} />

            {/* ----------------------------------------------------------------
             * Espace de messagerie chiffrée (tous les agents authentifiés)
             * ---------------------------------------------------------------- */}
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

            {/* ----------------------------------------------------------------
             * Console d'administration et RSSI (P13 à P17)
             * Contrôle de rôle : 'admin' ou 'rssi' uniquement.
             * Note : Le serveur (passerelle FastAPI) reste l'autorité finale.
             * ---------------------------------------------------------------- */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute rolesAutorises={ROLES_ADMIN}>
                  <P13_TableauDeBord />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/agents"
              element={
                <ProtectedRoute rolesAutorises={ROLES_ADMIN}>
                  <P14_ListeAgents />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/agents/nouveau"
              element={
                <ProtectedRoute rolesAutorises={["admin"]}>
                  <P15_EnrolementAgent />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/agents/:agentId"
              element={
                <ProtectedRoute rolesAutorises={ROLES_ADMIN}>
                  <P16_FicheAgent />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/audit"
              element={
                <ProtectedRoute rolesAutorises={ROLES_ADMIN}>
                  <P17_JournalAudit />
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
