/**
 * Tests Vitest pour la page P01_Login
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { P01_Login } from "../pages/P01_Login";
import { AuthProvider } from "../store/authStore";
import * as apiModule from "../services/api";

describe("Page P01_Login - Authentification & Anti-Énumération", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("affiche TOUJOURS le même message d'erreur générique quel que soit le motif de rejet", async () => {
    // 1. Simulation d'un rejet de type compte inconnu / mot de passe faux
    const apiLoginSpy = vi.spyOn(apiModule, "apiLogin").mockRejectedValue(new Error("401 Unauthorized"));

    render(
      <AuthProvider>
        <MemoryRouter>
          <P01_Login />
        </MemoryRouter>
      </AuthProvider>
    );

    fireEvent.change(screen.getByLabelText(/Adresse e-mail/i), {
      target: { value: "agent.inconnu@ministere.bf" },
    });
    fireEvent.change(screen.getByLabelText(/Mot de passe/i), {
      target: { value: "MauvaisPassword123!" },
    });
    fireEvent.change(screen.getByLabelText(/Code d'authentification/i), {
      target: { value: "123456" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Se connecter/i }));

    const errorMsg = await screen.findByTestId("login-error-message");
    expect(errorMsg).toHaveTextContent(
      "Identifiants invalides. Si vous venez d'utiliser un code, attendez le suivant (30 s) avant de réessayer."
    );
    expect(apiLoginSpy).toHaveBeenCalledTimes(1);
  });

  it("envoie automatiquement le device_id mémorisé sans jamais le demander à l'utilisateur", async () => {
    // Pré-enregistrement du device_id dans localStorage
    localStorage.setItem("sovereign_device_id_salif.ouedraogo@ministere.bf", "PREVIOUS_SAVED_DEV_01");

    const apiLoginSpy = vi.spyOn(apiModule, "apiLogin").mockResolvedValue({
      access_token: "jwt_token_123",
      token_type: "bearer",
      matrix_access_token: "matrix_token_123",
      device_id: "PREVIOUS_SAVED_DEV_01",
      matrix_user_id: "@salif:sovereign.local",
      homeserver_url: "https://sovereign.local",
    });

    vi.spyOn(apiModule, "apiGetMe").mockResolvedValue({
      id: "agent-1",
      nom: "Salif Ouedraogo",
      email: "salif.ouedraogo@ministere.bf",
      role: "agent",
      statut: "actif",
      matrix_user_id: "@salif:sovereign.local",
    });

    render(
      <AuthProvider>
        <MemoryRouter>
          <P01_Login />
        </MemoryRouter>
      </AuthProvider>
    );

    fireEvent.change(screen.getByLabelText(/Adresse e-mail/i), {
      target: { value: "salif.ouedraogo@ministere.bf" },
    });
    fireEvent.change(screen.getByLabelText(/Mot de passe/i), {
      target: { value: "MonMotDePasseFort123!" },
    });
    fireEvent.change(screen.getByLabelText(/Code d'authentification/i), {
      target: { value: "654321" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Se connecter/i }));

    await waitFor(() => {
      expect(apiLoginSpy).toHaveBeenCalledWith({
        email: "salif.ouedraogo@ministere.bf",
        mot_de_passe: "MonMotDePasseFort123!",
        code_totp: "654321",
        device_id: "PREVIOUS_SAVED_DEV_01",
      });
    });

    // Aucun champ device_id n'existe dans le DOM
    expect(screen.queryByLabelText(/device/i)).toBeNull();
  });
});
