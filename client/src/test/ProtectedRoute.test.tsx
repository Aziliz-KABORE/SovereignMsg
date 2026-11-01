/**
 * Tests Vitest pour le composant ProtectedRoute
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { AuthProvider } from "../store/authStore";

describe("Garde de routes (ProtectedRoute)", () => {
  it("redirige immédiatement vers /connexion si non authentifié (aucun rendu vide)", () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/espace-prive"]}>
          <Routes>
            <Route
              path="/espace-prive"
              element={
                <ProtectedRoute>
                  <div data-testid="protected-content">Contenu Secret</div>
                </ProtectedRoute>
              }
            />
            <Route path="/connexion" element={<div data-testid="login-page">Page Connexion</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    expect(screen.getByTestId("login-page")).toBeInTheDocument();
    expect(screen.queryByTestId("protected-content")).toBeNull();
  });

  it("redirige vers /acces-refuse si le rôle de l'agent est insuffisant", async () => {
    const mockAuthAgentState = {
      jwt: "mock_jwt_token",
      matrixAccessToken: "mock_matrix_token",
      deviceId: "mock_dev_id",
      utilisateur: {
        id: "1",
        nom: "Agent Salif",
        email: "salif@gouv.bf",
        role: "agent", // Rôle standard
        statut: "actif",
        matrix_user_id: "@salif:sovereign.local",
      },
      estAuthentifie: true,
    };

    render(
      <AuthProvider initialValue={mockAuthAgentState}>
        <MemoryRouter initialEntries={["/zone-admin"]}>
          <Routes>
            <Route
              path="/zone-admin"
              element={
                <ProtectedRoute rolesAutorises={["admin"]}>
                  <div data-testid="admin-content">Zone Admin Strict</div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/acces-refuse"
              element={<div data-testid="denied-page">Page Accès Refusé</div>}
            />
            <Route
              path="/connexion"
              element={<div data-testid="login-page">Page Connexion</div>}
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    expect(await screen.findByTestId("denied-page")).toBeInTheDocument();
    expect(screen.queryByTestId("admin-content")).toBeNull();
  });
});
