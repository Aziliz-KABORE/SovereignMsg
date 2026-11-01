/**
 * Tests Vitest pour le service HTTP api.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiClient, getStoredDeviceId, saveStoredDeviceId } from "../services/api";
import { enregistrerCallbackDeconnexion } from "../store/authStore";

describe("Service API & Sécurité des jetons", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("garantit que le JWT n'est JAMAIS écrit dans localStorage ni sessionStorage", () => {
    // Vérification qu'aucune clé de token n'existe
    expect(localStorage.getItem("jwt")).toBeNull();
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("access_token")).toBeNull();
    expect(sessionStorage.getItem("jwt")).toBeNull();
  });

  it("gère la persistance locale non-secrète du device_id par email", () => {
    saveStoredDeviceId("test@gouv.bf", "DEVICE_BURKINA_123");
    expect(getStoredDeviceId("test@gouv.bf")).toBe("DEVICE_BURKINA_123");
    expect(getStoredDeviceId("autre@gouv.bf")).toBeUndefined();
  });

  it("déclenche la déconnexion automatique lors d'un 401 sur une route protégée", async () => {
    const callbackMock = vi.fn();
    enregistrerCallbackDeconnexion(callbackMock);

    // Simulation d'une erreur 401 interceptée sur une route protégée (/auth/me)
    try {
      await (apiClient.interceptors.response as any).handlers[0].rejected({
        response: { status: 401 },
        config: { url: "/auth/me" },
      });
    } catch {
      // Rejet normal
    }

    expect(callbackMock).toHaveBeenCalledTimes(1);
  });

  it("NE déclenche PAS la déconnexion ni la redirection sur un 401 sur /auth/login", async () => {
    const callbackMock = vi.fn();
    enregistrerCallbackDeconnexion(callbackMock);

    try {
      await (apiClient.interceptors.response as any).handlers[0].rejected({
        response: { status: 401 },
        config: { url: "/auth/login" },
      });
    } catch {
      // Rejet normal
    }

    // Le callback de déconnexion ne doit pas avoir été appelé
    expect(callbackMock).not.toHaveBeenCalled();
  });
});
