/**
 * SovereignMsg Client - P04 : Liste des conversations
 * ===================================================
 * Affiche la liste des salons de l'agent avec indicateur de chiffrement (Megolm)
 * et gestion de la création de nouveaux salons directs.
 */

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../store/authStore";
import { useMatrix } from "../store/MatrixContext";
import { P06_NouveauSalon } from "./P06_NouveauSalon";

export const P04_Salons: React.FC = () => {
  const { t } = useTranslation();
  const { state, deconnecter } = useAuth();
  const { salons, estInitialise, erreurInitialisation } = useMatrix();
  const [modalNouveauSalon, setModalNouveauSalon] = useState(false);

  const agent = state.utilisateur;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Barre de navigation supérieure */}
      <header className="bg-green-800 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center space-x-3">
              <span className="text-xl font-bold tracking-wider">🇧🇫 SOVEREIGNMSG</span>
              <span className="bg-green-900 text-green-200 text-xs px-2 py-0.5 rounded font-mono">
                E2EE
              </span>
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-semibold">{agent?.nom}</div>
                <div className="text-xs text-green-200">{agent?.email}</div>
              </div>

              <button
                onClick={deconnecter}
                className="bg-red-700 hover:bg-red-800 text-white text-xs px-3 py-1.5 rounded transition"
              >
                {t("auth.logout")}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Contenu principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col">
        {erreurInitialisation && (
          <div className="mb-4 p-4 bg-red-100 border-l-4 border-red-500 text-red-700 text-sm">
            {erreurInitialisation}
          </div>
        )}

        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mes conversations</h1>
            <p className="text-xs text-gray-500">
              Chiffrement de bout en bout activé (vodozemac/Megolm)
            </p>
          </div>

          <button
            onClick={() => setModalNouveauSalon(true)}
            className="inline-flex items-center px-4 py-2 bg-green-700 hover:bg-green-800 text-white text-sm font-medium rounded-md shadow-sm transition"
          >
            <span className="mr-2 text-lg leading-none">+</span> Nouvelle conversation
          </button>
        </div>

        {/* Modal création de salon direct */}
        {modalNouveauSalon && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <P06_NouveauSalon onFermer={() => setModalNouveauSalon(false)} />
          </div>
        )}

        {/* Liste des salons */}
        <div className="bg-white shadow rounded-lg flex-1 overflow-hidden border border-gray-200">
          {!estInitialise ? (
            <div className="p-8 text-center text-gray-500">
              <div className="animate-spin inline-block w-8 h-8 border-4 border-green-700 border-t-transparent rounded-full mb-2"></div>
              <p className="text-sm">Synchronisation des clés de chiffrement et des salons...</p>
            </div>
          ) : salons.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <span className="text-4xl block mb-2">💬</span>
              <h3 className="text-lg font-medium text-gray-800 mb-1">Aucune conversation</h3>
              <p className="text-sm text-gray-500 mb-4">
                Démarrez une discussion chiffrée avec un agent de l'administration.
              </p>
              <button
                onClick={() => setModalNouveauSalon(true)}
                className="inline-flex items-center px-4 py-2 bg-green-700 text-white text-sm rounded-md hover:bg-green-800"
              >
                Nouvelle conversation
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {salons.map((salon) => (
                <li key={salon.roomId} className="hover:bg-gray-50 transition">
                  <Link
                    to={`/salon/${encodeURIComponent(salon.roomId)}`}
                    className="block p-4 sm:px-6 flex justify-between items-center"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-green-100 text-green-800 flex items-center justify-center font-bold text-sm flex-shrink-0">
                        {salon.nom.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {salon.nom}
                          </p>
                          {salon.estChiffre && (
                            <span
                              title="Salon chiffré de bout en bout (Megolm)"
                              className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-200"
                            >
                              🔒 E2EE
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {salon.dernierMessage || "Aucun message"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 flex-shrink-0 ml-4">
                      {salon.nonLus > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-green-600 text-white">
                          {salon.nonLus}
                        </span>
                      )}
                      <span className="text-gray-400 text-lg">›</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
};
