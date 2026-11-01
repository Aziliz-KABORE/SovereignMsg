/**
 * Tests Vitest pour le service matrix.ts
 */

import { describe, it, expect, vi } from "vitest";
import {
  creerSalonDirect,
  extraireMessagesSalon,
  envoyerMessageTexte,
} from "../services/matrix";
import { Room, MatrixEvent } from "matrix-js-sdk";

describe("Service Matrix & Chiffrement E2EE", () => {
  it("crée un salon direct avec chiffrement activé dès l'état initial (m.megolm.v1.aes-sha2)", async () => {
    const mockCreateRoom = vi.fn().mockResolvedValue({ room_id: "!room123:sovereign.local" });
    const mockClient = {
      createRoom: mockCreateRoom,
    } as any;

    const roomId = await creerSalonDirect(mockClient, "@destinataire:sovereign.local");

    expect(roomId).toBe("!room123:sovereign.local");
    expect(mockCreateRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        is_direct: true,
        invite: ["@destinataire:sovereign.local"],
        initial_state: [
          {
            type: "m.room.encryption",
            state_key: "",
            content: {
              algorithm: "m.megolm.v1.aes-sha2",
            },
          },
        ],
      })
    );
  });

  it("envoie un message au format texte via sendEvent", async () => {
    const mockSendEvent = vi.fn().mockResolvedValue({ event_id: "$evt123" });
    const mockClient = {
      sendEvent: mockSendEvent,
    } as any;

    await envoyerMessageTexte(mockClient, "!room123:sovereign.local", "Message Confidentiel");

    expect(mockSendEvent).toHaveBeenCalledWith(
      "!room123:sovereign.local",
      "m.room.message",
      {
        msgtype: "m.text",
        body: "Message Confidentiel",
      }
    );
  });

  it("affiche « Message non déchiffrable » lorsque isDecryptionFailure est vrai", () => {
    // Création d'événements factices
    const evtOk = {
      getType: () => "m.room.message",
      isEncrypted: () => true,
      isDecryptionFailure: () => false,
      getContent: () => ({ body: "Texte clair déchiffré" }),
      getSender: () => "@alice:sovereign.local",
      getId: () => "$evt1",
      getTs: () => 1000,
    } as unknown as MatrixEvent;

    const evtEchec = {
      getType: () => "m.room.encrypted",
      isEncrypted: () => true,
      isDecryptionFailure: () => true, // Échec de déchiffrement Megolm
      getContent: () => ({}),
      getSender: () => "@bob:sovereign.local",
      getId: () => "$evt2",
      getTs: () => 2000,
    } as unknown as MatrixEvent;

    const mockRoom = {
      getLiveTimeline: () => ({
        getEvents: () => [evtOk, evtEchec],
      }),
      getMember: () => null,
    } as unknown as Room;

    const messages = extraireMessagesSalon(mockRoom);

    expect(messages).toHaveLength(2);
    expect(messages[0].corps).toBe("Texte clair déchiffré");
    expect(messages[0].estEchecDechiffrement).toBe(false);

    expect(messages[1].corps).toBe("Message non déchiffrable");
    expect(messages[1].estEchecDechiffrement).toBe(true);
  });
});

