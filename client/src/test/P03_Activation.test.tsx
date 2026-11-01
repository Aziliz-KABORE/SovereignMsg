/**
 * Tests Vitest pour la page P03_Activation
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { P03_Activation } from "../pages/P03_Activation";
import * as apiModule from "../services/api";

describe("Page P03_Activation - Enrôlement en deux temps", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("exécute le flux complet en deux étapes et efface le secret TOTP après confirmation", async () => {
    const fakeOtpauthUri = "otpauth://totp/SovereignMsg:agent@gouv.bf?secret=JBSWY3DPEHPK3PXP&issuer=SovereignMsg";

    const apiActivationInitSpy = vi.spyOn(apiModule, "apiActivationInit").mockResolvedValue({
      otpauth_uri: fakeOtpauthUri,
      qr_code_base64: "",
      message: "Scannez votre code",
    });

    const apiActivationConfirmSpy = vi.spyOn(apiModule, "apiActivationConfirm").mockResolvedValue({
      message: "Compte activé avec succès.",
      statut: "actif",
    });

    render(
      <MemoryRouter>
        <P03_Activation />
      </MemoryRouter>
    );

    // --- Étape 1 : Saisie jeton et définition du mot de passe ---
    expect(screen.getByText(/Étape 1/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Jeton d'activation/i), {
      target: { value: "token_activation_secret_123" },
    });
    fireEvent.change(screen.getByLabelText(/Nouveau mot de passe/i), {
      target: { value: "PasswordRobuste2026!" },
    });
    fireEvent.change(screen.getByLabelText(/Confirmez le mot de passe/i), {
      target: { value: "PasswordRobuste2026!" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Valider le mot de passe/i }));

    // Attente du passage à l'étape 2
    expect(await screen.findByText(/Étape 2/i)).toBeInTheDocument();
    expect(apiActivationInitSpy).toHaveBeenCalledWith({
      jeton: "token_activation_secret_123",
      mot_de_passe: "PasswordRobuste2026!",
    });

    // Vérification de la présence du QR code rendu et du secret pour saisie manuelle
    expect(screen.getByTestId("qr-code-container")).toBeInTheDocument();
    const secretElement = screen.getByTestId("totp-secret-text");
    expect(secretElement).toHaveTextContent("JBSWY3DPEHPK3PXP");

    // --- Étape 2 : Confirmation du premier code TOTP ---
    fireEvent.change(screen.getByLabelText(/Code TOTP affiché/i), {
      target: { value: "123456" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Confirmer et activer le compte/i }));

    // Attente de l'étape 3 (succès)
    expect(await screen.findByText(/Compte activé avec succès/i)).toBeInTheDocument();
    expect(apiActivationConfirmSpy).toHaveBeenCalledWith({
      jeton: "token_activation_secret_123",
      code: "123456",
    });

    // Vérification que le QR code et le secret TOTP ont bien été purgés du DOM
    expect(screen.queryByTestId("qr-code-container")).toBeNull();
    expect(screen.queryByTestId("totp-secret-text")).toBeNull();
  });
});
