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
    <div style={{ minHeight: "100vh", backgroundColor: "#F8FAFC", display: "flex", flexDirection: "column" }}>
      {/* Barre supérieure souveraine */}
      <header
        style={{
          backgroundColor: "#004D25",
          color: "#fff",
          padding: "12px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {/* Drapeau du Burkina Faso */}
          <div style={{ display: "flex", flexDirection: "column", width: "24px", height: "16px", borderRadius: "2px", overflow: "hidden" }}>
            <div style={{ flex: 1, backgroundColor: "#EF3340" }} />
            <div style={{ flex: 1, backgroundColor: "#009739" }} />
          </div>
          <div>
            <span style={{ fontWeight: 700, fontSize: "18px", letterSpacing: "0.5px" }}>SovereignMsg</span>
            <span style={{ fontSize: "13px", marginLeft: "8px", opacity: 0.9, backgroundColor: "rgba(255,255,255,0.2)", padding: "2px 8px", borderRadius: "12px" }}>
              Back-Office {state.utilisateur?.role?.toUpperCase()}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span style={{ fontSize: "14px", opacity: 0.9 }}>
            {state.utilisateur?.nom} ({state.utilisateur?.email})
          </span>
          <Link
            to="/"
            style={{
              color: "#fff",
              textDecoration: "none",
              fontSize: "13px",
              backgroundColor: "rgba(255,255,255,0.15)",
              padding: "6px 12px",
              borderRadius: "6px",
              fontWeight: 500,
            }}
          >
            💬 Messagerie E2EE
          </Link>
          <button
            onClick={deconnecter}
            style={{
              backgroundColor: "#EF3340",
              color: "#fff",
              border: "none",
              padding: "6px 14px",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            Déconnexion
          </button>
        </div>
      </header>

      {/* Barre de navigation d'administration */}
      <nav
        style={{
          backgroundColor: "#fff",
          borderBottom: "1px solid #E2E8F0",
          padding: "0 24px",
          display: "flex",
          gap: "8px",
        }}
      >
        {navigation.map((item) => {
          const estActif = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              style={{
                textDecoration: "none",
                padding: "14px 16px",
                fontSize: "14px",
                fontWeight: estActif ? 600 : 500,
                color: estActif ? "#009739" : "#475569",
                borderBottom: estActif ? "2px solid #009739" : "2px solid transparent",
                display: "inline-block",
                transition: "all 0.2s ease",
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Contenu principal */}
      <main style={{ flex: 1, padding: "24px", maxWidth: "1200px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#0F172A", marginBottom: "20px" }}>
          {titre}
        </h1>
        {children}
      </main>
    </div>
  );
};

