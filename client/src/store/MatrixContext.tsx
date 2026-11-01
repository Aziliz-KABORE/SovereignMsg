/**
 * SovereignMsg Client - Contexte Matrix
 * =====================================
 * Gère le cycle de vie du client Matrix connecté en mémoire :
 * - Démarrage du client et du moteur RustCrypto dès que l'authentification est active
 * - Écoute des événements Matrix (Room, Sync, Timeline)
 * - Arrêt et purge intégrale des clés cryptographiques locales à la déconnexion
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { MatrixClient, RoomEvent, ClientEvent } from "matrix-js-sdk";
import { useAuth } from "./authStore";
import {
  initialiserMatrixClient,
  deconnecterEtPurgerCles,
  obtenirSalons,
  SalonInfo,
} from "../services/matrix";

interface MatrixContextType {
  client: MatrixClient | null;
  salons: SalonInfo[];
  estInitialise: boolean;
  erreurInitialisation: string | null;
  rafraichirSalons: () => void;
}

const MatrixContext = createContext<MatrixContextType | undefined>(undefined);

export const MatrixProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { state } = useAuth();
  const [client, setClient] = useState<MatrixClient | null>(null);
  const [salons, setSalons] = useState<SalonInfo[]>([]);
  const [estInitialise, setEstInitialise] = useState(false);
  const [erreurInitialisation, setErreurInitialisation] = useState<string | null>(null);

  const rafraichirSalons = React.useCallback(() => {
    if (client) {
      setSalons(obtenirSalons(client));
    }
  }, [client]);

  useEffect(() => {
    let clientInstance: MatrixClient | null = null;
    let isActive = true;

    async function demarrerMatrix() {
      if (!state.estAuthentifie || !state.matrixAccessToken || !state.utilisateur || !state.deviceId) {
        setClient(null);
        setSalons([]);
        setEstInitialise(false);
        return;
      }

      setEstInitialise(false);
      setErreurInitialisation(null);

      try {
        // En production avec Nginx, la passerelle et Synapse partagent la même origine (via Nginx)
        const baseUrl = window.location.origin;

        clientInstance = await initialiserMatrixClient({
          baseUrl,
          accessToken: state.matrixAccessToken,
          userId: state.utilisateur.matrix_user_id,
          deviceId: state.deviceId,
        });

        if (!isActive) {
          deconnecterEtPurgerCles(clientInstance);
          return;
        }

        setClient(clientInstance);
        setSalons(obtenirSalons(clientInstance));
        setEstInitialise(true);

        // Écoute des événements pour mise à jour de la liste des salons
        clientInstance.on(ClientEvent.Sync, (syncState) => {
          if (syncState === "PREPARED" || syncState === "SYNCING") {
            if (isActive) {
              setSalons(obtenirSalons(clientInstance!));
            }
          }
        });

        clientInstance.on(RoomEvent.Timeline, () => {
          if (isActive) {
            setSalons(obtenirSalons(clientInstance!));
          }
        });
      } catch (err) {
        console.error("Échec de l'initialisation Matrix :", err);
        if (isActive) {
          setErreurInitialisation("Impossible d'initialiser le service de messagerie chiffrée.");
        }
      }
    }

    demarrerMatrix();

    return () => {
      isActive = false;
      if (clientInstance) {
        deconnecterEtPurgerCles(clientInstance);
      }
    };
  }, [state.estAuthentifie, state.matrixAccessToken, state.deviceId, state.utilisateur]);

  return (
    <MatrixContext.Provider
      value={{
        client,
        salons,
        estInitialise,
        erreurInitialisation,
        rafraichirSalons,
      }}
    >
      {children}
    </MatrixContext.Provider>
  );
};

export const useMatrix = (): MatrixContextType => {
  const context = useContext(MatrixContext);
  if (!context) {
    throw new Error("useMatrix doit être utilisé à l'intérieur d'un MatrixProvider.");
  }
  return context;
};

