/**
 * SovereignMsg Client - Garde de routes
 * =====================================
 * Contrôle d'accès basé sur l'état en mémoire :
 * - Non authentifié : <Navigate to="/connexion" replace /> (JAMAIS de rendu vide)
 * - Rôle insuffisant : <Navigate to="/acces-refuse" replace /> (JAMAIS de rendu vide)
 */

import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../store/authStore";

interface ProtectedRouteProps {
  children: React.ReactElement;
  rolesAutorises?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  rolesAutorises,
}) => {
  const { state } = useAuth();
  const location = useLocation();

  // 1. Contrôle d'authentification en mémoire
  if (!state.estAuthentifie || !state.jwt) {
    return <Navigate to="/connexion" state={{ from: location }} replace />;
  }

  // 2. Contrôle de rôle
  if (rolesAutorises && rolesAutorises.length > 0) {
    const userRole = state.utilisateur?.role || "";
    if (!rolesAutorises.includes(userRole)) {
      return <Navigate to="/acces-refuse" replace />;
    }
  }

  return children;
};
