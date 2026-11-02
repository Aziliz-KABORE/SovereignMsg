/**
 * SovereignMsg Client - Store d'Authentification en mémoire
 * =========================================================
 * Règles strictes :
 * - JWT et access_token Matrix stockés EN MÉMOIRE UNIQUEMENT.
 * - Aucun stockage dans localStorage, sessionStorage ni cookies.
 * - Un rechargement de page (F5) impose une reconnexion immédiate.
 * - Réinitialisation totale à la déconnexion.
 */

import React, { createContext, useContext, useReducer, ReactNode } from "react";

export interface Utilisateur {
  id: string;
  nom: string;
  email: string;
  role: string;
  statut: string;
  matrix_user_id: string;
}

export interface AuthState {
  jwt: string | null;
  matrixAccessToken: string | null;
  deviceId: string | null;
  utilisateur: Utilisateur | null;
  estAuthentifie: boolean;
}

type AuthAction =
  | {
      type: "CONNECTER";
      payload: {
        jwt: string;
        matrixAccessToken: string;
        deviceId: string;
        utilisateur: Utilisateur;
      };
    }
  | { type: "DECONNECTER" };

const etatInitial: AuthState = {
  jwt: null,
  matrixAccessToken: null,
  deviceId: null,
  utilisateur: null,
  estAuthentifie: false,
};

// Variable globale fermée pour permettre au client HTTP (api.ts) de lire le JWT sans hook React
let jwtEnMemoire: string | null = null;
let callbackDeconnexion: (() => void) | null = null;

export const getInMemoryJwt = (): string | null => jwtEnMemoire;

export const setInMemoryJwt = (jwt: string | null) => {
  jwtEnMemoire = jwt;
};

export const enregistrerCallbackDeconnexion = (fn: () => void) => {
  callbackDeconnexion = fn;
};

export const declencherDeconnexionExterne = () => {
  jwtEnMemoire = null;
  if (callbackDeconnexion) {
    callbackDeconnexion();
  }
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "CONNECTER":
      jwtEnMemoire = action.payload.jwt;
      return {
        jwt: action.payload.jwt,
        matrixAccessToken: action.payload.matrixAccessToken,
        deviceId: action.payload.deviceId,
        utilisateur: action.payload.utilisateur,
        estAuthentifie: true,
      };

    case "DECONNECTER":
      jwtEnMemoire = null;
      return {
        ...etatInitial,
      };

    default:
      return state;
  }
}

interface AuthContextType {
  state: AuthState;
  connecter: (payload: {
    jwt: string;
    matrixAccessToken: string;
    deviceId: string;
    utilisateur: Utilisateur;
  }) => void;
  deconnecter: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{
  children: ReactNode;
  initialValue?: AuthState;
}> = ({ children, initialValue }) => {
  const [state, dispatch] = useReducer(authReducer, initialValue || etatInitial);

  // Enregistrement du callback pour déclenchement depuis l'intercepteur axios
  React.useEffect(() => {
    if (initialValue?.jwt) {
      jwtEnMemoire = initialValue.jwt;
    }
    enregistrerCallbackDeconnexion(() => {
      dispatch({ type: "DECONNECTER" });
    });
  }, [initialValue]);

  const connecter = React.useCallback(
    (payload: {
      jwt: string;
      matrixAccessToken: string;
      deviceId: string;
      utilisateur: Utilisateur;
    }) => {
      jwtEnMemoire = payload.jwt;
      dispatch({ type: "CONNECTER", payload });
    },
    []
  );

  const deconnecter = React.useCallback(() => {
    jwtEnMemoire = null;
    dispatch({ type: "DECONNECTER" });
  }, []);

  return (
    <AuthContext.Provider value={{ state, connecter, deconnecter }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth doit être utilisé à l'intérieur d'un AuthProvider.");
  }
  return context;
};
