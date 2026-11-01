/**
 * SovereignMsg Client - P05 : Conversation chiffrée
 * ==================================================
 * Vue des échanges au sein d'un salon Matrix.
 * Règles strictes :
 * - Texte affiché en texte brut (JAMAIS de dangerouslySetInnerHTML)
 * - Gestion explicite des échecs de déchiffrement : « Message non déchiffrable »
 * - Envoi chiffré de bout en bout avec vodozemac/Megolm
 */

import React, { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { RoomEvent } from "matrix-js-sdk";
import { useMatrix } from "../store/MatrixContext";
import { useAuth } from "../store/authStore";
import {
  extraireMessagesSalon,
  envoyerMessageTexte,
  MessageDecrypte,
} from "../services/matrix";

export const P05_Conversation: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const decodedRoomId = roomId ? decodeURIComponent(roomId) : "";

  const { client } = useMatrix();
  const { state } = useAuth();
  const monUserId = state.utilisateur?.matrix_user_id || "";

  const [messages, setMessages] = useState<MessageDecrypte[]>([]);
  const [nouveauMessage, setNouveauMessage] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [nomSalon, setNomSalon] = useState("Conversation");
  const [estChiffre, setEstChiffre] = useState(true);

  const finMessagesRef = useRef<HTMLDivElement>(null);

  const chargerMessages = React.useCallback(() => {
    if (!client || !decodedRoomId) return;

    const room = client.getRoom(decodedRoomId);
    if (room) {
      setNomSalon(room.name || decodedRoomId);
      setEstChiffre(client.isRoomEncrypted(decodedRoomId));
      setMessages(extraireMessagesSalon(room));
    }
  }, [client, decodedRoomId]);

  useEffect(() => {
    chargerMessages();

    if (!client || !decodedRoomId) return;

    const room = client.getRoom(decodedRoomId);
    if (!room) return;

    const handleTimelineEvent = () => {
      chargerMessages();
    };

    room.on(RoomEvent.Timeline, handleTimelineEvent);

    return () => {
      room.removeListener(RoomEvent.Timeline, handleTimelineEvent);
    };
  }, [client, decodedRoomId, chargerMessages]);

  useEffect(() => {
    // Défilement automatique vers le bas à chaque nouveau message
    finMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleEnvoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !decodedRoomId || !nouveauMessage.trim() || envoiEnCours) return;

    const texteAEnvoyer = nouveauMessage.trim();
    setNouveauMessage("");
    setEnvoiEnCours(true);

    try {
      await envoyerMessageTexte(client, decodedRoomId, texteAEnvoyer);
      chargerMessages();
    } catch (err) {
      console.error("Échec envoi message chiffré :", err);
    } finally {
      setEnvoiEnCours(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* En-tête de la conversation */}
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center space-x-3">
          <Link
            to="/"
            className="text-gray-500 hover:text-gray-800 text-lg font-bold p-1 rounded-full hover:bg-gray-100"
          >
            ←
          </Link>
          <div>
            <h2 className="text-base font-bold text-gray-900 leading-tight">
              {nomSalon}
            </h2>
            <div className="flex items-center space-x-1.5 text-xs">
              {estChiffre ? (
                <span className="text-green-700 font-medium flex items-center">
                  <span className="mr-1">🔒</span> Chiffrement de bout en bout actif (Megolm)
                </span>
              ) : (
                <span className="text-yellow-600 font-medium">
                  ⚠️ Salon non chiffré
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Timeline des messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            <span className="text-3xl block mb-2">🔐</span>
            <p className="text-sm">Début de la conversation sécurisée.</p>
            <p className="text-xs text-gray-400 mt-1">
              Les messages échangés ici sont protégés par le chiffrement souverain.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const estMonMessage = msg.sender === monUserId;

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${estMonMessage ? "items-end" : "items-start"}`}
              >
                {!estMonMessage && (
                  <span className="text-xs font-semibold text-gray-600 mb-0.5 ml-1">
                    {msg.senderName}
                  </span>
                )}

                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 text-sm shadow-sm ${
                    msg.estEchecDechiffrement
                      ? "bg-red-50 border border-red-300 text-red-700 italic"
                      : estMonMessage
                      ? "bg-green-700 text-white rounded-br-none"
                      : "bg-white border border-gray-200 text-gray-900 rounded-bl-none"
                  }`}
                >
                  {/* Règle non négociable : texte brut exclusivement, jamais de dangerouslySetInnerHTML */}
                  <span className="whitespace-pre-wrap break-words">{msg.corps}</span>
                </div>

                <span className="text-[10px] text-gray-400 mt-0.5 mx-1">
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            );
          })
        )}
        <div ref={finMessagesRef} />
      </div>

      {/* Zone de saisie */}
      <footer className="bg-white border-t p-3">
        <form onSubmit={handleEnvoyer} className="flex space-x-2">
          <input
            type="text"
            className="flex-1 border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
            placeholder="Écrivez un message chiffré..."
            value={nouveauMessage}
            onChange={(e) => setNouveauMessage(e.target.value)}
            disabled={envoiEnCours}
          />
          <button
            type="submit"
            disabled={!nouveauMessage.trim() || envoiEnCours}
            className="bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white px-5 py-2 rounded-md text-sm font-medium transition"
          >
            {envoiEnCours ? "Envoi..." : "Envoyer"}
          </button>
        </form>
      </footer>
    </div>
  );
};
