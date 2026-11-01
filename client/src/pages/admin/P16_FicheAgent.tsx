/**
 * SovereignMsg Client - P16 Fiche agent et révocation (Administrateur)
 * ====================================================================
 * Vue détaillée d'un agent :
 * - Informations complètes (nom, e-mail, rôle, statut, dates, matrix_user_id)
 * - Modification du rôle par l'administrateur
 * - Révocation immédiate avec confirmation modale (action irréversible)
 * - Journal d'audit disponible pour le RSSI
 */

import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { AdminLayout } from "../../components/AdminLayout";
import {
  apiGetAdminAgent,
  apiUpdateAgentRole,
  apiRevokeAgent,
  AdminAgentItem,
} from "../../services/api";
import { useAuth } from "../../store/authStore";

export const P16_FicheAgent: React.FC = () => {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const { state } = useAuth();
  const estAdmin = state.utilisateur?.role === "admin";

  const [agent, setAgent] = useState<AdminAgentItem | null>(null);
  const [chargement, setChargement] = useState<boolean>(true);
  const [erreur, setErreur] = useState<string | null>(null);

  // Modification de rôle
  const [nouveauRole, setNouveauRole] = useState<string>("");
  const [enMiseAJour, setEnMiseAJour] = useState<boolean>(false);
  const [messageSucces, setMessageSucces] = useState<string | null>(null);

  // Révocation
  const [modalRevocation, setModalRevocation] = useState<boolean>(false);
  const [enRevocation, setEnRevocation] = useState<boolean>(false);

  useEffect(() => {
    if (!agentId) return;
    const charger = async () => {
      try {
        setChargement(true);
        const data = await apiGetAdminAgent(agentId);
        setAgent(data);
        setNouveauRole(data.role);
      } catch {
        setErreur("Impossible de charger la fiche de cet agent.");
      } finally {
        setChargement(false);
      }
    };
    charger();
  }, [agentId]);

  const modifierRole = async () => {
    if (!agent || !nouveauRole || nouveauRole === agent.role) return;
    setEnMiseAJour(true);
    setErreur(null);
    try {
      const mis = await apiUpdateAgentRole(agent.id, nouveauRole);
      setAgent(mis);
      setNouveauRole(mis.role);
      setMessageSucces(`Rôle mis à jour avec succès : ${mis.role}`);
      setTimeout(() => setMessageSucces(null), 5000);
    } catch {
      setErreur("Erreur lors de la modification du rôle.");
    } finally {
      setEnMiseAJour(false);
    }
  };

  const confirmerRevocation = async () => {
    if (!agent) return;
    setEnRevocation(true);
    try {
      await apiRevokeAgent(agent.id);
      setModalRevocation(false);
      navigate("/admin/agents");
    } catch {
      setErreur("Erreur lors de la révocation. Veuillez réessayer.");
      setEnRevocation(false);
      setModalRevocation(false);
    }
  };

  const badgeStatut = (statut: string) => {
    switch (statut) {
      case "actif":
        return (
          <span style={{ backgroundColor: "#DCFCE7", color: "#166534", padding: "4px 12px", borderRadius: "12px", fontSize: "13px", fontWeight: 600 }}>
            ✅ Actif
          </span>
        );
      case "en_attente":
        return (
          <span style={{ backgroundColor: "#FEF3C7", color: "#92400E", padding: "4px 12px", borderRadius: "12px", fontSize: "13px", fontWeight: 600 }}>
            ⏳ En attente d'activation
          </span>
        );
      case "revoque":
        return (
          <span style={{ backgroundColor: "#FEE2E2", color: "#991B1B", padding: "4px 12px", borderRadius: "12px", fontSize: "13px", fontWeight: 600 }}>
            🚫 Révoqué
          </span>
        );
      default:
        return <span>{statut}</span>;
    }
  };

  return (
    <AdminLayout titre="Fiche Agent">
      {chargement ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#64748B" }}>Chargement de la fiche agent...</div>
      ) : erreur ? (
        <div style={{ backgroundColor: "#FEF2F2", color: "#991B1B", padding: "16px", borderRadius: "8px" }}>{erreur}</div>
      ) : agent ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "780px" }}>
          {messageSucces && (
            <div style={{ backgroundColor: "#DCFCE7", color: "#166534", padding: "12px 16px", borderRadius: "8px", border: "1px solid #86EFAC" }}>
              ✓ {messageSucces}
            </div>
          )}

          {/* Carte d'identité de l'agent */}
          <div style={{ backgroundColor: "#fff", padding: "24px", borderRadius: "8px", border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              <div>
                <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#0F172A", margin: "0 0 4px 0" }}>{agent.nom}</h2>
                <span style={{ color: "#64748B", fontSize: "14px" }}>{agent.email}</span>
              </div>
              {badgeStatut(agent.statut)}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>
                  Identifiant Interne
                </div>
                <div style={{ fontFamily: "monospace", fontSize: "12px", color: "#334155", backgroundColor: "#F8FAFC", padding: "6px 10px", borderRadius: "4px" }}>
                  {agent.id}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>
                  Identifiant Matrix (E2EE)
                </div>
                <div style={{ fontFamily: "monospace", fontSize: "12px", color: "#334155", backgroundColor: "#F8FAFC", padding: "6px 10px", borderRadius: "4px" }}>
                  {agent.matrix_user_id}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>
                  Date de création
                </div>
                <div style={{ fontSize: "14px", color: "#334155" }}>
                  {agent.date_creation ? new Date(agent.date_creation).toLocaleString("fr-BF") : "—"}
                </div>
              </div>
              {agent.date_revocation && (
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#991B1B", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>
                    Date de révocation
                  </div>
                  <div style={{ fontSize: "14px", color: "#991B1B" }}>
                    {new Date(agent.date_revocation).toLocaleString("fr-BF")}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Gestion du rôle (admin seulement) */}
          {estAdmin && agent.statut !== "revoque" && (
            <div style={{ backgroundColor: "#fff", padding: "24px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#0F172A", marginTop: 0, marginBottom: "16px" }}>
                Rôle et Privilèges
              </h3>
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <select
                  value={nouveauRole}
                  onChange={(e) => setNouveauRole(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    border: "1px solid #CBD5E1",
                    borderRadius: "6px",
                    fontSize: "14px",
                    backgroundColor: "#fff",
                  }}
                >
                  <option value="agent">Agent standard (Messagerie E2EE)</option>
                  <option value="admin">Administrateur (Enrôlement, révocation)</option>
                  <option value="rssi">RSSI (Audit de sécurité, lecture seule)</option>
                  <option value="invite">Invité restreint</option>
                </select>
                <button
                  onClick={modifierRole}
                  disabled={enMiseAJour || nouveauRole === agent.role}
                  style={{
                    backgroundColor: nouveauRole === agent.role ? "#CBD5E1" : "#0F172A",
                    color: "#fff",
                    border: "none",
                    padding: "8px 16px",
                    borderRadius: "6px",
                    cursor: nouveauRole === agent.role ? "default" : "pointer",
                    fontSize: "14px",
                    fontWeight: 600,
                  }}
                >
                  {enMiseAJour ? "Mise à jour..." : "Modifier le rôle"}
                </button>
              </div>
            </div>
          )}

          {/* Zone de révocation */}
          {estAdmin && agent.statut !== "revoque" && (
            <div style={{ backgroundColor: "#FFF5F5", padding: "24px", borderRadius: "8px", border: "1px solid #FCA5A5" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#991B1B", marginTop: 0, marginBottom: "8px" }}>
                🚫 Zone de Révocation
              </h3>
              <p style={{ fontSize: "14px", color: "#7F1D1D", marginBottom: "16px", lineHeight: "1.5" }}>
                La révocation est <strong>immédiate et irréversible</strong> : le compte Matrix est désactivé sur tous les appareils de l'agent et sa session est invalidée dans les secondes suivantes. Cette action est enregistrée dans le journal d'audit infalsifiable.
              </p>
              <button
                onClick={() => setModalRevocation(true)}
                style={{
                  backgroundColor: "#EF3340",
                  color: "#fff",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: 700,
                }}
              >
                Révoquer l'accès de {agent.nom}
              </button>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <Link
              to="/admin/agents"
              style={{
                color: "#475569",
                textDecoration: "none",
                fontSize: "14px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              ← Retour à la liste des agents
            </Link>
          </div>
        </div>
      ) : null}

      {/* Modale de confirmation de révocation */}
      {modalRevocation && agent && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-revocation-titre"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: "12px",
              padding: "28px",
              maxWidth: "420px",
              width: "90%",
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
            }}
          >
            <h2
              id="modal-revocation-titre"
              style={{ fontSize: "18px", fontWeight: 700, color: "#0F172A", marginTop: 0, marginBottom: "12px" }}
            >
              Confirmer la révocation
            </h2>
            <p style={{ fontSize: "14px", color: "#334155", lineHeight: "1.6", marginBottom: "20px" }}>
              Vous êtes sur le point de révoquer l'accès de <strong>{agent.nom}</strong> ({agent.email}).
              Son compte Matrix sera désactivé <strong>immédiatement sur tous ses appareils</strong>.
              Cette opération sera enregistrée dans la piste d'audit.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                onClick={() => setModalRevocation(false)}
                disabled={enRevocation}
                style={{
                  padding: "10px 16px",
                  borderRadius: "6px",
                  border: "1px solid #CBD5E1",
                  backgroundColor: "#F1F5F9",
                  color: "#334155",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: 500,
                }}
              >
                Annuler
              </button>
              <button
                onClick={confirmerRevocation}
                disabled={enRevocation}
                style={{
                  padding: "10px 20px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: "#EF3340",
                  color: "#fff",
                  cursor: enRevocation ? "not-allowed" : "pointer",
                  fontSize: "14px",
                  fontWeight: 700,
                }}
              >
                {enRevocation ? "Révocation en cours..." : "Confirmer la révocation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};
