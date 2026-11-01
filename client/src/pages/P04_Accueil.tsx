/**
 * SovereignMsg Client - P04 : Espace Agent (Accueil sécurisé)
 * Présentation des données de session en mémoire et bouton de déconnexion.
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../store/authStore";

export const P04_Accueil: React.FC = () => {
  const { t } = useTranslation();
  const { state, deconnecter } = useAuth();
  const agent = state.utilisateur;

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-green-800 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center space-x-3">
              <span className="text-xl font-bold tracking-wider">🇧🇫 SOVEREIGNMSG</span>
              <span className="bg-green-900 text-green-200 text-xs px-2 py-1 rounded">
                {agent?.role?.toUpperCase() || "AGENT"}
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium">{agent?.nom || agent?.email}</span>
              <button
                onClick={deconnecter}
                className="bg-red-700 hover:bg-red-800 text-white text-xs px-3 py-1.5 rounded transition"
              >
                {t("auth.logout")}
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            Session active en mémoire
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="p-3 bg-gray-50 rounded border">
              <span className="font-semibold text-gray-600 block">Agent connecté :</span>
              <span className="text-gray-900">{agent?.nom} ({agent?.email})</span>
            </div>
            <div className="p-3 bg-gray-50 rounded border">
              <span className="font-semibold text-gray-600 block">Identifiant Matrix :</span>
              <span className="font-mono text-gray-900">{agent?.matrix_user_id}</span>
            </div>
            <div className="p-3 bg-gray-50 rounded border">
              <span className="font-semibold text-gray-600 block">Appareil (Device ID) :</span>
              <span className="font-mono text-gray-900">{state.deviceId || "Non spécifié"}</span>
            </div>
            <div className="p-3 bg-gray-50 rounded border">
              <span className="font-semibold text-gray-600 block">Sécurité des jetons :</span>
              <span className="text-green-700 font-medium">En mémoire uniquement (aucun stockage local)</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
