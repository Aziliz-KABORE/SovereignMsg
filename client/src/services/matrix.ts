/**
 * SovereignMsg Client - Service Matrix & Chiffrement E2EE (Rust/vodozemac)
 * =========================================================================
 * Règles strictes :
 * - Aucune cryptographie maison. Les messages sont chiffrés uniquement par matrix-js-sdk.
 * - Moteur cryptographique : initRustCrypto() avec WebAssembly / vodozemac.
 * - Base IndexedDB propre et isolée pour les clés Olm/Megolm.
 * - Le serveur Synapse ne voit JAMAIS un message ni un fichier en clair.
 * - Salons créés avec chiffrement activé dès l'état initial (m.megolm.v1.aes-sha2).
 * - Effacement complet des clés locales lors de la révocation ou déconnexion.
 */

import * as sdk from "matrix-js-sdk";
import { MatrixClient, Room, MatrixEvent, EventType, MsgType } from "matrix-js-sdk";

export interface MessageDecrypte {
  id: string;
  sender: string;
  senderName: string;
  timestamp: number;
  corps: string;
  estChiffre: boolean;
  estEchecDechiffrement: boolean;
}

export interface SalonInfo {
  roomId: string;
  nom: string;
  estChiffre: boolean;
  dernierMessage?: string;
  dernierTimestamp?: number;
  nonLus: number;
  estDirect: boolean;
  membres: string[];
}

export interface InitMatrixOptions {
  baseUrl: string;
  accessToken: string;
  userId: string;
  deviceId: string;
}

/**
 * Initialise le client Matrix avec le moteur cryptographique Rust (vodozemac).
 */
export async function initialiserMatrixClient({
  baseUrl,
  accessToken,
  userId,
  deviceId,
}: InitMatrixOptions): Promise<MatrixClient> {
  const client = sdk.createClient({
    baseUrl: baseUrl.replace(/\/+$/, ""),
    accessToken,
    userId,
    deviceId,
    timelineSupport: true,
  });

  // Initialisation du moteur de chiffrement Rust WebAssembly (vodozemac)
  // Utilise IndexedDB pour la persistance locale des clés de session
  try {
    await client.initRustCrypto({
      useIndexedDB: true,
    });
  } catch (error) {
    // Si déjà initialisé ou fallback mémoire en environnement de test
    console.warn("Initialisation RustCrypto :", error);
  }

  // Démarrage de la boucle de synchronisation Matrix
  await client.startClient({
    initialSyncLimit: 20,
  });

  return client;
}

/**
 * Crée un salon direct 1-to-1 avec chiffrement activé dès l'état initial.
 * Règle non négociable : 'm.room.encryption' configuré avec 'm.megolm.v1.aes-sha2'.
 */
export async function creerSalonDirect(
  client: MatrixClient,
  destinataireMatrixId: string
): Promise<string> {
  const response = await client.createRoom({
    is_direct: true,
    invite: [destinataireMatrixId],
    preset: sdk.Preset.TrustedPrivateChat,
    visibility: sdk.Visibility.Private,
    initial_state: [
      {
        type: "m.room.encryption",
        state_key: "",
        content: {
          algorithm: "m.megolm.v1.aes-sha2",
        },
      },
    ],
  });

  return response.room_id;
}

/**
 * Envoie un message texte chiffré de bout en bout dans un salon.
 */
export async function envoyerMessageTexte(
  client: MatrixClient,
  roomId: string,
  texte: string
): Promise<void> {
  const content = {
    msgtype: MsgType.Text,
    body: texte,
  };

  await (client as any).sendEvent(roomId, EventType.RoomMessage, content);
}

/**
 * Extrait et formate les messages d'un salon avec gestion des échecs de déchiffrement.
 * Texte brut uniquement : JAMAIS de dangerouslySetInnerHTML.
 */
export function extraireMessagesSalon(room: Room): MessageDecrypte[] {
  const timeline = room.getLiveTimeline().getEvents();

  return timeline
    .filter((event: MatrixEvent) => {
      const type = event.getType();
      return type === "m.room.message" || type === "m.room.encrypted";
    })
    .map((event: MatrixEvent) => {
      const isEncrypted = event.isEncrypted();
      const isDecryptionFailure = event.isDecryptionFailure();

      let corpsTexte = "";

      if (isDecryptionFailure) {
        corpsTexte = "Message non déchiffrable";
      } else {
        const content = event.getContent();
        corpsTexte = content.body || (isEncrypted ? "Message chiffré" : "");
      }

      const senderId = event.getSender() || "Inconnu";
      const member = room.getMember(senderId);
      const senderName = member?.name || senderId;

      return {
        id: event.getId() || Math.random().toString(),
        sender: senderId,
        senderName,
        timestamp: event.getTs(),
        corps: corpsTexte,
        estChiffre: isEncrypted,
        estEchecDechiffrement: isDecryptionFailure,
      };
    });
}

/**
 * Liste tous les salons rejoints avec leur statut de chiffrement et dernier message.
 */
export function obtenirSalons(client: MatrixClient): SalonInfo[] {
  const rooms = client.getRooms();

  return rooms.map((room: Room) => {
    const isEncrypted = client.isRoomEncrypted(room.roomId);
    const liveTimeline = room.getLiveTimeline().getEvents();
    const lastEvent = liveTimeline[liveTimeline.length - 1];

    let dernierMsg: string | undefined;
    let dernierTs: number | undefined;

    if (lastEvent) {
      dernierTs = lastEvent.getTs();
      if (lastEvent.isDecryptionFailure()) {
        dernierMsg = "Message non déchiffrable";
      } else {
        const content = lastEvent.getContent();
        dernierMsg = content.body || (lastEvent.isEncrypted() ? "Message chiffré" : "");
      }
    }

    const members = room.getJoinedMembers().map((m) => m.userId);

    return {
      roomId: room.roomId,
      nom: room.name || room.roomId,
      estChiffre: isEncrypted,
      dernierMessage: dernierMsg,
      dernierTimestamp: dernierTs,
      nonLus: room.getUnreadNotificationCount() || 0,
      estDirect: members.length === 2,
      membres: members,
    };
  });
}

/**
 * Déconnexion propre et effacement intégral des bases de clés cryptographiques locales.
 */
export async function deconnecterEtPurgerCles(client: MatrixClient): Promise<void> {
  try {
    client.stopClient();
    await client.clearStores();
  } catch (e) {
    console.warn("Arrêt client Matrix :", e);
  }

  // Purge de toutes les bases de données IndexedDB associées à Matrix
  if (typeof window !== "undefined" && window.indexedDB && window.indexedDB.databases) {
    try {
      const dbs = await window.indexedDB.databases();
      for (const db of dbs) {
        if (db.name && (db.name.includes("matrix") || db.name.includes("crypto"))) {
          window.indexedDB.deleteDatabase(db.name);
        }
      }
    } catch {
      // Ignorer si deleteDatabase non supporté
    }
  }
}
