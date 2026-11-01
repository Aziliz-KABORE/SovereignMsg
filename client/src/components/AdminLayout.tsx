/**
 * SovereignMsg Client - Layout d'Administration
 * ============================================
 * En-tête sécurisé avec navigation pour les administrateurs et le RSSI :
 * - Navigation entre Tableau de bord (P13), Liste des agents (P14), Enrôlement (P15), Journal d'audit (P17)
 * - Indicateur de rôle vérifié
 * - Bouton de retour vers la messagerie chiffrée
 * - Bouton de déconnexion immédiate
 */

import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../store/authStore";

interface AdminLayoutProps {
  children: React.ReactNode;
  titre: string;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children, titre }) => {
  const { state, deconnecter } = useAuth();
  const location = useLocation();

  const estAdmin = state.utilisateur?.role === "admin";

  const navigation = [
    { label: "Tableau de bord", path: "/admin" },
    { label: "Agents", path: "/admin/agents" },
    ...(estAdmin ? [{ label: "+ Enrôler un agent", path: "/admin/agents/nouveau" }] : []),
    { label: "Journal d'audit", path: "/admin/audit" },
  ];

  return (
    <div className="admin-layout">
      {/* Barre supérieure souveraine */}
      <header className="admin-header">
        <div className="admin-brand-bar">
          {/* Drapeau du Burkina Faso */}
          <div className="flag-bf">
            <div className="flag-red" />
            <div className="flag-green" />
          </div>
          <div>
            <span className="font-bold text-lg tracking-wider">SovereignMsg</span>
            <span className="role-badge">
              Back-Office {state.utilisateur?.role?.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-sm opacity-90 hidden sm:block">
            {state.utilisateur?.nom} ({state.utilisateur?.email})
          </span>
          <Link to="/" className="nav-link-btn">
            💬 Messagerie E2EE
          </Link>
          <button onClick={deconnecter} className="btn-logout">
            Déconnexion
          </button>
        </div>
      </header>

      {/* Barre de navigation d'administration */}
      <nav className="admin-nav">
        {navigation.map((item) => {
          const estActif = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`admin-nav-item ${estActif ? "active" : ""}`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Contenu principal */}
      <main className="admin-content">
        <h1 className="admin-title">
          {titre}
        </h1>
        {children}
      </main>
    </div>
  );
};
