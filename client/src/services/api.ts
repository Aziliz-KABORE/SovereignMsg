/**
 * SovereignMsg Client - Service HTTP API (Axios)
 * ===============================================
 * Gestion des requêtes vers la passerelle FastAPI :
 * - Lecture du JWT en mémoire uniquement (aucun token dans localStorage)
 * - Intercepteur 401 sur routes protégées : déconnexion automatique et redirection vers P01
 * - Pas de déconnexion automatique sur /auth/login ni /auth/activation (traitement local)
 * - Gestion du device_id non secret par utilisateur dans localStorage
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { getInMemoryJwt, declencherDeconnexionExterne } from "../store/authStore";

export const apiClient = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

// Intercepteur de requête : injection du JWT présent en mémoire
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const jwt = getInMemoryJwt();
  if (jwt) {
    config.headers.Authorization = `Bearer ${jwt}`;
  }
  return config;
});

// Intercepteur de réponse : traitement unifié des 401
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response && error.response.status === 401) {
      const url = error.config?.url || "";
      const estRoutePubliqueAuth =
        url.includes("/auth/login") ||
        url.includes("/auth/activation");

      // Sur une route protégée, un 401 signifie que la session a expiré ou que l'agent est révoqué
      if (!estRoutePubliqueAuth) {
        declencherDeconnexionExterne();
        if (typeof window !== "undefined" && window.location && !window.location.pathname?.includes("/connexion")) {
          try {
            window.location.href = "/connexion?session_expired=1";
          } catch {
            // Ignorer l'erreur jsdom 'Not implemented: navigation' dans les tests
          }
        }
      }
    }
    return Promise.reject(error);
  }
);

// -----------------------------------------------------------------------------
// Gestion du device_id (Non secret, mémorisé par utilisateur)
// -----------------------------------------------------------------------------
const DEVICE_ID_KEY_PREFIX = "sovereign_device_id_";

export const getStoredDeviceId = (email: string): string | undefined => {
  if (typeof window === "undefined" || !email) return undefined;
  const stored = localStorage.getItem(`${DEVICE_ID_KEY_PREFIX}${email.toLowerCase().trim()}`);
  return stored || undefined;
};

export const saveStoredDeviceId = (email: string, deviceId: string): void => {
  if (typeof window === "undefined" || !email || !deviceId) return;
  localStorage.setItem(`${DEVICE_ID_KEY_PREFIX}${email.toLowerCase().trim()}`, deviceId);
};

// -----------------------------------------------------------------------------
// Appels d'API typés
// -----------------------------------------------------------------------------
export interface LoginPayload {
  email: string;
  mot_de_passe: string;
  code_totp: string;
  device_id?: string;
}

export interface LoginResult {
  access_token: string;
  token_type: string;
  matrix_access_token: string;
  device_id: string;
  matrix_user_id: string;
  homeserver_url: string;
}

export interface ActivationInitPayload {
  jeton: string;
  mot_de_passe: string;
}

export interface ActivationInitResult {
  otpauth_uri: string;
  qr_code_base64: string;
  message: string;
}

export interface ActivationConfirmPayload {
  jeton: string;
  code: string;
}

export interface ActivationConfirmResult {
  message: string;
  statut: string;
}

export interface AgentProfil {
  id: string;
  nom: string;
  email: string;
  role: string;
  statut: string;
  matrix_user_id: string;
}

// -----------------------------------------------------------------------------
// Administration (P13 à P17)
// -----------------------------------------------------------------------------
export interface AdminStats {
  total_agents: number;
  actifs: number;
  en_attente: number;
  revoques: number;
  par_role: Record<string, number>;
}

export interface AdminAgentItem {
  id: string;
  nom: string;
  email: string;
  role: string;
  statut: string;
  matrix_user_id: string;
  date_creation: string;
  date_revocation?: string | null;
}

export interface AgentCreatePayload {
  nom: string;
  email: string;
  role: string;
}

export interface AgentCreateResult {
  id: string;
  nom: string;
  email: string;
  role: string;
  statut: string;
  matrix_user_id: string;
  jeton_activation: string;
}

export interface AuditEntryItem {
  id: string;
  horodatage: string;
  acteur: string;
  action: string;
  cible: string;
  detail: string;
  hash_precedent: string;
  hash: string;
}

export interface AuditVerifyResult {
  valide: boolean;
  total_entrees: number;
  message?: string;
}

export const apiLogin = async (payload: LoginPayload): Promise<LoginResult> => {
  const { data } = await apiClient.post<LoginResult>("/auth/login", payload);
  return data;
};

export const apiActivationInit = async (payload: ActivationInitPayload): Promise<ActivationInitResult> => {
  const { data } = await apiClient.post<ActivationInitResult>("/auth/activation", payload);
  return data;
};

export const apiActivationConfirm = async (payload: ActivationConfirmPayload): Promise<ActivationConfirmResult> => {
  const { data } = await apiClient.post<ActivationConfirmResult>("/auth/activation/confirm", payload);
  return data;
};

export const apiGetMe = async (customToken?: string): Promise<AgentProfil> => {
  const headers = customToken ? { Authorization: `Bearer ${customToken}` } : undefined;
  const { data } = await apiClient.get<AgentProfil>("/auth/me", { headers });
  return data;
};

// --- Fonctions d'administration ---
export const apiGetAdminStats = async (): Promise<AdminStats> => {
  const { data } = await apiClient.get<AdminStats>("/admin/stats");
  return data;
};

export const apiGetAdminAgents = async (filters?: { statut?: string; role?: string; search?: string }): Promise<AdminAgentItem[]> => {
  const { data } = await apiClient.get<AdminAgentItem[]>("/admin/agents", { params: filters });
  return data;
};

export const apiGetAdminAgent = async (id: string): Promise<AdminAgentItem> => {
  const { data } = await apiClient.get<AdminAgentItem>(`/admin/agents/${id}`);
  return data;
};

export const apiCreateAgent = async (payload: AgentCreatePayload): Promise<AgentCreateResult> => {
  const { data } = await apiClient.post<AgentCreateResult>("/admin/agents", payload);
  return data;
};

export const apiUpdateAgentRole = async (id: string, role: string): Promise<AdminAgentItem> => {
  const { data } = await apiClient.patch<AdminAgentItem>(`/admin/agents/${id}`, { role });
  return data;
};

export const apiRevokeAgent = async (id: string): Promise<{ id: string; message: string; statut: string }> => {
  const { data } = await apiClient.post<{ id: string; message: string; statut: string }>(`/admin/agents/${id}/revoquer`);
  return data;
};

export const apiGetAuditEntries = async (params?: { limit?: number; action?: string }): Promise<AuditEntryItem[]> => {
  const { data } = await apiClient.get<AuditEntryItem[]>("/admin/audit", { params });
  return data;
};

export const apiVerifyAuditChain = async (): Promise<AuditVerifyResult> => {
  const { data } = await apiClient.get<AuditVerifyResult>("/admin/audit/verifier");
  return data;
};

export const apiDownloadAuditCsv = async (): Promise<Blob> => {
  const response = await apiClient.get("/admin/audit/export", { responseType: "blob" });
  return response.data;
};

