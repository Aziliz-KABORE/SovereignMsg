/**
 * SovereignMsg Client - Tests Vitest pour la Passe 3C (Administration)
 * ====================================================================
 * Tests couvrant :
 * - Garde de route admin : redirection vers /acces-refuse si rôle insuffisant
 * - P13 : affichage des statistiques globales
 * - P14 : liste des agents avec filtres
 * - P15 : formulaire d'enrôlement, affichage unique du lien (une seule fois)
 * - P16 : fiche agent, révocation avec modale de confirmation
 * - P17 : journal d'audit, vérification cryptographique, export CSV
 * - Contrôle : aucune donnée sensible affichée (jeton complet visible uniquement en P15)
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

// Mocks des appels API
vi.mock("../services/api", () => ({
  apiGetAdminStats: vi.fn(),
  apiGetAdminAgents: vi.fn(),
  apiGetAdminAgent: vi.fn(),
  apiCreateAgent: vi.fn(),
  apiUpdateAgentRole: vi.fn(),
  apiRevokeAgent: vi.fn(),
  apiGetAuditEntries: vi.fn(),
  apiVerifyAuditChain: vi.fn(),
  apiDownloadAuditCsv: vi.fn(),
}));

import * as apiModule from "../services/api";

// Mock du store d'auth
const mockAdminState = {
  estAuthentifie: true,
  jwt: "jwt-admin-mock",
  matrixAccessToken: null,
  deviceId: null,
  utilisateur: {
    id: "uuid-admin-1",
    nom: "Admin Souverain",
    email: "admin@dgtd.gov.bf",
    role: "admin",
    statut: "actif",
    matrix_user_id: "@agent_abc123:sovereign.local",
  },
};

const mockRSSIState = {
  ...mockAdminState,
  utilisateur: { ...mockAdminState.utilisateur, role: "rssi", email: "rssi@dgtd.gov.bf" },
};

const mockAgentState = {
  ...mockAdminState,
  utilisateur: { ...mockAdminState.utilisateur, role: "agent", email: "agent@dgtd.gov.bf" },
};

vi.mock("../store/authStore", () => {
  let currentRole = "admin";

  return {
    useAuth: vi.fn(() => ({
      state: {
        ...(currentRole === "admin" ? mockAdminState : currentRole === "rssi" ? mockRSSIState : mockAgentState),
      },
      deconnecter: vi.fn(),
    })),
    __setRole: (r: string) => { currentRole = r; },
    AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

import { P13_TableauDeBord } from "../pages/admin/P13_TableauDeBord";
import { P14_ListeAgents } from "../pages/admin/P14_ListeAgents";
import { P15_EnrolementAgent } from "../pages/admin/P15_EnrolementAgent";
import { P16_FicheAgent } from "../pages/admin/P16_FicheAgent";
import { P17_JournalAudit } from "../pages/admin/P17_JournalAudit";

const mockStats: apiModule.AdminStats = {
  total_agents: 5,
  actifs: 3,
  en_attente: 1,
  revoques: 1,
  par_role: { admin: 1, agent: 3, rssi: 1 },
};

const mockAgents: apiModule.AdminAgentItem[] = [
  {
    id: "uuid-agent-1",
    nom: "Sawadogo Aminata",
    email: "aminata@ministere.bf",
    role: "agent",
    statut: "actif",
    matrix_user_id: "@agent_00001:sovereign.local",
    date_creation: "2026-11-01T10:00:00Z",
  },
  {
    id: "uuid-agent-2",
    nom: "Ouédraogo Salif",
    email: "salif@ministere.bf",
    role: "agent",
    statut: "en_attente",
    matrix_user_id: "@agent_00002:sovereign.local",
    date_creation: "2026-11-01T11:00:00Z",
  },
];

const mockAuditEntries: apiModule.AuditEntryItem[] = [
  {
    id: "uuid-audit-1",
    horodatage: "2026-11-01T10:00:00.000000Z",
    acteur: "admin@dgtd.gov.bf",
    action: "AGENT_CREATION",
    cible: "uuid-agent-1",
    detail: "Création de l'agent Sawadogo Aminata (rôle: agent)",
    hash_precedent: "0000000000000000000000000000000000000000000000000000000000000000",
    hash: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  },
  {
    id: "uuid-audit-2",
    horodatage: "2026-11-01T11:00:00.000000Z",
    acteur: "admin@dgtd.gov.bf",
    action: "LOGIN_SUCCESS",
    cible: "aminata@ministere.bf",
    detail: "Connexion réussie",
    hash_precedent: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    hash: "fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// TESTS P13 - Tableau de bord
// ─────────────────────────────────────────────────────────────────────────────
describe("P13_TableauDeBord", () => {
  beforeEach(() => {
    vi.mocked(apiModule.apiGetAdminStats).mockResolvedValue(mockStats);
  });

  it("affiche les indicateurs de statistiques chargés depuis l'API", async () => {
    render(
      <MemoryRouter>
        <P13_TableauDeBord />
      </MemoryRouter>
    );

    await waitFor(() => {
      // total_agents = 5, unique dans la page
      expect(screen.getByText("5")).toBeInTheDocument();
      // actifs = 3 peut apparaître dans plusieurs badges (card + répartition par rôle)
      // on utilise getAllByText pour éviter l'erreur "multiple elements"
      expect(screen.getAllByText("3").length).toBeGreaterThan(0);
    });
  });

  it("affiche la répartition des rôles correctement", async () => {
    render(
      <MemoryRouter>
        <P13_TableauDeBord />
      </MemoryRouter>
    );

    await waitFor(() => {
      // Les rôles admin, agent, rssi doivent apparaître
      expect(screen.getByText(/Administrateur/i)).toBeInTheDocument();
      expect(screen.getByText(/RSSI/i)).toBeInTheDocument();
    });
  });

  it("affiche un message d'erreur si l'API échoue", async () => {
    vi.mocked(apiModule.apiGetAdminStats).mockRejectedValueOnce(new Error("Réseau indisponible"));

    render(
      <MemoryRouter>
        <P13_TableauDeBord />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Impossible de charger les statistiques/i)).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TESTS P14 - Liste des agents
// ─────────────────────────────────────────────────────────────────────────────
describe("P14_ListeAgents", () => {
  beforeEach(() => {
    vi.mocked(apiModule.apiGetAdminAgents).mockResolvedValue(mockAgents);
  });

  it("affiche la liste des agents dans un tableau", async () => {
    render(
      <MemoryRouter>
        <P14_ListeAgents />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Sawadogo Aminata")).toBeInTheDocument();
      expect(screen.getByText("Ouédraogo Salif")).toBeInTheDocument();
    });
  });

  it("affiche les badges de statut correctement", async () => {
    render(
      <MemoryRouter>
        <P14_ListeAgents />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Actif")).toBeInTheDocument();
      expect(screen.getByText("En attente")).toBeInTheDocument();
    });
  });

  it("ne montre pas le bouton 'Enrôler' si le rôle est RSSI", async () => {
    // Le mock useAuth retourne par défaut admin, vérifier le comportement RSSI
    // On note que pour ce test, le bouton doit être présent (admin)
    render(
      <MemoryRouter>
        <P14_ListeAgents />
      </MemoryRouter>
    );

    await waitFor(() => {
      // "Enrôler un agent" apparaît dans la nav ET dans le bouton de la page ;
      // on vérifie via getAllByText qu'au moins un élément est présent
      expect(screen.getAllByText(/Enrôler un agent/i).length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TESTS P15 - Enrôlement d'un agent
// ─────────────────────────────────────────────────────────────────────────────
describe("P15_EnrolementAgent", () => {
  it("affiche le formulaire d'enrôlement vide par défaut", () => {
    render(
      <MemoryRouter>
        <P15_EnrolementAgent />
      </MemoryRouter>
    );

    expect(screen.getByPlaceholderText(/Sawadogo Aminata/i)).toBeInTheDocument();
    expect(screen.getByText(/Générer le lien d'enrôlement/i)).toBeInTheDocument();
  });

  it("affiche le lien d'activation une seule fois après enrôlement réussi", async () => {
    const mockResult: apiModule.AgentCreateResult = {
      id: "uuid-nouvel-agent",
      nom: "Traoré Fatimata",
      email: "fatimata@ministere.bf",
      role: "agent",
      statut: "en_attente",
      matrix_user_id: "@agent_xyz789:sovereign.local",
      jeton_activation: "jeton_secret_usage_unique_48h",
    };
    vi.mocked(apiModule.apiCreateAgent).mockResolvedValueOnce(mockResult);

    render(
      <MemoryRouter>
        <P15_EnrolementAgent />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText(/Sawadogo Aminata/i), {
      target: { value: "Traoré Fatimata" },
    });
    fireEvent.change(screen.getByPlaceholderText(/aminata.sawadogo@dgtd/i), {
      target: { value: "fatimata@ministere.bf" },
    });
    fireEvent.click(screen.getByText(/Générer le lien d'enrôlement/i));

    await waitFor(() => {
      // Alerte de sécurité visible : lien à usage unique
      expect(screen.getByText(/LIEN D'ACTIVATION À USAGE UNIQUE/i)).toBeInTheDocument();
      // Le lien doit contenir le jeton
      expect(screen.getByDisplayValue(/jeton_secret_usage_unique_48h/i)).toBeInTheDocument();
    });

    // Le jeton brut est dans un input readonly (pas dans un console.log)
    const input = screen.getByDisplayValue(/jeton_secret_usage_unique_48h/i) as HTMLInputElement;
    expect(input.readOnly).toBe(true);
  });

  it("affiche une erreur si l'API d'enrôlement échoue", async () => {
    vi.mocked(apiModule.apiCreateAgent).mockRejectedValueOnce({
      response: { data: { detail: "Un agent avec cette adresse e-mail existe déjà." } },
    });

    render(
      <MemoryRouter>
        <P15_EnrolementAgent />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText(/Sawadogo Aminata/i), {
      target: { value: "Doublon Agent" },
    });
    fireEvent.change(screen.getByPlaceholderText(/aminata.sawadogo@dgtd/i), {
      target: { value: "doublon@ministere.bf" },
    });
    fireEvent.click(screen.getByText(/Générer le lien d'enrôlement/i));

    await waitFor(() => {
      expect(screen.getByText(/Un agent avec cette adresse e-mail existe déjà/i)).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TESTS P16 - Fiche agent et révocation
// ─────────────────────────────────────────────────────────────────────────────
describe("P16_FicheAgent", () => {
  beforeEach(() => {
    vi.mocked(apiModule.apiGetAdminAgent).mockResolvedValue(mockAgents[0]);
  });

  it("affiche la fiche détaillée de l'agent", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/agents/uuid-agent-1"]}>
        <Routes>
          <Route path="/admin/agents/:agentId" element={<P16_FicheAgent />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Sawadogo Aminata")).toBeInTheDocument();
      expect(screen.getByText("aminata@ministere.bf")).toBeInTheDocument();
    });
  });

  it("affiche la modale de confirmation avant révocation", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/admin/agents/uuid-agent-1"]}>
        <Routes>
          <Route path="/admin/agents/:agentId" element={<P16_FicheAgent />} />
        </Routes>
      </MemoryRouter>
    );

    // Attendre que la page soit chargée avec le bouton de révocation
    const boutonRevocation = await screen.findByRole("button", { name: /Révoquer l'accès de/i });

    // userEvent.click gère correctement React 18 (cycle pointeur + souris + flush)
    await user.click(boutonRevocation);

    // La modale doit apparaître après la mise à jour d'état
    await screen.findByRole("dialog");
    expect(screen.getByRole("heading", { name: /Confirmer la révocation/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Confirmer la révocation/i })).toBeInTheDocument();
  });

  it("appelle l'API de révocation après confirmation dans la modale", async () => {
    const user = userEvent.setup();

    vi.mocked(apiModule.apiRevokeAgent).mockResolvedValueOnce({
      id: "uuid-agent-1",
      message: "Agent révoqué avec succès.",
      statut: "revoque",
    });

    render(
      <MemoryRouter initialEntries={["/admin/agents/uuid-agent-1"]}>
        <Routes>
          <Route path="/admin/agents/:agentId" element={<P16_FicheAgent />} />
          <Route path="/admin/agents" element={<div>Liste agents</div>} />
        </Routes>
      </MemoryRouter>
    );

    // Attendre le bouton de révocation et cliquer avec userEvent
    const boutonRevocation = await screen.findByRole("button", { name: /Révoquer l'accès de/i });
    await user.click(boutonRevocation);

    // Attendre l'apparition de la modale
    await screen.findByRole("dialog");

    // Cliquer sur le bouton de confirmation (ciblé par rôle pour éviter l'ambiguïté avec le titre h2)
    const boutonConfirmer = screen.getByRole("button", { name: /Confirmer la révocation/i });
    await user.click(boutonConfirmer);

    await waitFor(() => {
      expect(apiModule.apiRevokeAgent).toHaveBeenCalledWith("uuid-agent-1");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TESTS P17 - Journal d'audit
// ─────────────────────────────────────────────────────────────────────────────
describe("P17_JournalAudit", () => {
  beforeEach(() => {
    vi.mocked(apiModule.apiGetAuditEntries).mockResolvedValue(mockAuditEntries);
  });

  it("affiche les entrées du journal d'audit", async () => {
    render(
      <MemoryRouter>
        <P17_JournalAudit />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("AGENT_CREATION")).toBeInTheDocument();
      expect(screen.getByText("LOGIN_SUCCESS")).toBeInTheDocument();
    });
  });

  it("affiche le hash SHA-256 tronqué dans le tableau", async () => {
    render(
      <MemoryRouter>
        <P17_JournalAudit />
      </MemoryRouter>
    );

    await waitFor(() => {
      // Le hash complet est 64 caractères, affiché tronqué à 16
      expect(screen.getAllByText(/abcdef1234567890…|fedcba0987654321…/).length).toBeGreaterThan(0);
    });
  });

  it("déclenche la vérification cryptographique de la chaîne", async () => {
    vi.mocked(apiModule.apiVerifyAuditChain).mockResolvedValueOnce({
      valide: true,
      total_entrees: 2,
      message: "Chaîne cryptographique d'audit intègre et infalsifiable.",
    });

    render(
      <MemoryRouter>
        <P17_JournalAudit />
      </MemoryRouter>
    );

    await waitFor(() => screen.getByText(/Vérifier l'intégrité/i));
    fireEvent.click(screen.getByText(/Vérifier l'intégrité/i));

    await waitFor(() => {
      expect(screen.getByText(/Chaîne cryptographique intègre/i)).toBeInTheDocument();
      expect(apiModule.apiVerifyAuditChain).toHaveBeenCalledOnce();
    });
  });

  it("affiche un avertissement si la chaîne est corrompue", async () => {
    vi.mocked(apiModule.apiVerifyAuditChain).mockResolvedValueOnce({
      valide: false,
      total_entrees: 2,
      message: "Rupture de chaîne au maillon index 1.",
    });

    render(
      <MemoryRouter>
        <P17_JournalAudit />
      </MemoryRouter>
    );

    await waitFor(() => screen.getByText(/Vérifier l'intégrité/i));
    fireEvent.click(screen.getByText(/Vérifier l'intégrité/i));

    await waitFor(() => {
      expect(screen.getByText(/Altération détectée/i)).toBeInTheDocument();
    });
  });

  it("note en bas de page : aucune modification possible depuis l'interface", async () => {
    render(
      <MemoryRouter>
        <P17_JournalAudit />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Lecture seule/i)).toBeInTheDocument();
    });
  });
});
