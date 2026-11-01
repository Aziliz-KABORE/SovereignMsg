/**
 * SovereignMsg Client - P06 : Création de salon direct chiffré (1-to-1)
 * ====================================================================
 * Règle d'or : Chiffrement activé dès l'état initial (m.room.encryption).
 */

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMatrix } from "../store/MatrixContext";
import { creerSalonDirect } from "../services/matrix";
import { InputField } from "../components/InputField";
import { Button } from "../components/Button";

interface NouveauSalonProps {
  onFermer?: () => void;
}

export const P06_NouveauSalon: React.FC<NouveauSalonProps> = ({ onFermer }) => {
  const navigate = useNavigate();
  const { client, rafraichirSalons } = useMatrix();

  const [destinataire, setDestinataire] = useState("");
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;

    setErreur(null);
    setChargement(true);

    try {
      const cleanTarget = destinataire.trim();
      if (!cleanTarget.startsWith("@") || !cleanTarget.includes(":")) {
        setErreur("L'identifiant doit être au format Matrix complet (ex: @agent_123:sovereign.local).");
        setChargement(false);
        return;
      }

      // Création du salon avec chiffrement initial Megolm
      const roomId = await creerSalonDirect(client, cleanTarget);
      rafraichirSalons();

      if (onFermer) {
        onFermer();
      }
      navigate(`/salon/${encodeURIComponent(roomId)}`);
    } catch (err) {
      console.error("Échec création salon direct :", err);
      setErreur("Impossible de créer le salon direct avec ce destinataire.");
    } finally {
      setChargement(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200 max-w-md w-full">
      <div className="flex justify-between items-center mb-4 border-b pb-2">
        <h3 className="text-lg font-bold text-gray-900">
          Nouvelle conversation chiffrée
        </h3>
        {onFermer && (
          <button
            onClick={onFermer}
            className="text-gray-400 hover:text-gray-600 font-bold text-lg"
          >
            ×
          </button>
        )}
      </div>

      {erreur && (
        <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm">
          {erreur}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <InputField
          label="Identifiant Matrix du destinataire"
          type="text"
          name="destinataire"
          required
          value={destinataire}
          onChange={(e) => setDestinataire(e.target.value)}
          placeholder="@agent_identifiant:sovereign.local"
          helpText="Saisissez l'identifiant Matrix complet de l'agent de l'administration."
        />

        <div className="p-3 bg-green-50 border border-green-200 rounded text-xs text-green-800 flex items-center space-x-2">
          <span>🔒</span>
          <span>
            Le chiffrement de bout en bout (Megolm/vodozemac) sera automatiquement activé dès la création du salon.
          </span>
        </div>

        <div className="flex space-x-3 pt-2">
          {onFermer && (
            <Button
              type="button"
              variant="secondary"
              onClick={onFermer}
              disabled={chargement}
            >
              Annuler
            </Button>
          )}
          <Button type="submit" isLoading={chargement}>
            Démarrer la discussion
          </Button>
        </div>
      </form>
    </div>
  );
};
