/**
 * SovereignMsg Client - P14 Liste des agents (Administrateur / RSSI)
 * =================================================================
 * Annuaire d'administration :
 * - Recherche par nom ou e-mail
 * - Filtres par statut (actif, en attente, révoqué) et par rôle
 * - Lien vers la fiche agent P16
 * - Bouton d'accès direct à l'enrôlement P15
 */

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AdminLayout } from "../../components/AdminLayout";
import { apiGetAdminAgents, AdminAgentItem } from "../../services/api";
import { useAuth } from "../../store/authStore";

export const P14_ListeAgents: React.FC = () => {
  const { state } = useAuth();
  const estAdmin = state.utilisateur?.role === "admin";

  const [agents, setAgents] = useState<AdminAgentItem[]>([]);
  const [chargement, setChargement] = useState<boolean>(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const [recherche, setRecherche] = useState<string>("");
  const [filtreStatut, setFiltreStatut] = useState<string>("");
  const [filtreRole, setFiltreRole] = useState<string>("");

  const chargerAgents = async () => {
    try {
      setChargement(true);
      setErreur(null);
      const data = await apiGetAdminAgents({
        statut: filtreStatut || undefined,
        role: filtreRole || undefined,
        search: recherche || undefined,
      });
      setAgents(data);
    } catch {
      setErreur("Erreur lors de la récupération des agents.");
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    chargerAgents();
  }, [filtreStatut, filtreRole]);

  const gererRecherche = (e: React.FormEvent) => {
    e.preventDefault();
    chargerAgents();
  };

  const badgeStatut = (statut: string) => {
    switch (statut) {
      case "actif":
        return <span style={{ backgroundColor: "#DCFCE7", color: "#166534", padding: "3px 8px", borderRadius: "12px", fontSize: "12px", fontWeight: 600 }}>Actif</span>;
      case "en_attente":
        return <span style={{ backgroundColor: "#FEF3C7", color: "#92400E", padding: "3px 8px", borderRadius: "12px", fontSize: "12px", fontWeight: 600 }}>En attente</span>;
      case "revoque":
        return <span style={{ backgroundColor: "#FEE2E2", color: "#991B1B", padding: "3px 8px", borderRadius: "12px", fontSize: "12px", fontWeight: 600 }}>Révoqué</span>;
      default:
        return <span>{statut}</span>;
    }
  };

  return (
    <AdminLayout titre="Annuaire des Agents de l'Administration">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <p style={{ color: "#64748B", margin: 0, fontSize: "14px" }}>
          Consultez les statuts, auditez les privilèges et gérez les révocations d'accès.
        </p>
        {estAdmin && (
          <Link
            to="/admin/agents/nouveau"
            style={{
              backgroundColor: "#009739",
              color: "#fff",
              textDecoration: "none",
              padding: "8px 16px",
              borderRadius: "6px",
              fontWeight: 600,
              fontSize: "13px",
            }}
          >
            ➕ Enrôler un agent
          </Link>
        )}
      </div>

      {/* Barre de filtres et recherche */}
      <form
        onSubmit={gererRecherche}
        style={{
          display: "flex",
          gap: "12px",
          backgroundColor: "#fff",
          padding: "16px",
          borderRadius: "8px",
          border: "1px solid #E2E8F0",
          marginBottom: "20px",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <input
          type="text"
          placeholder="Rechercher par nom ou e-mail..."
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          style={{
            flex: 1,
            minWidth: "220px",
            padding: "8px 12px",
            border: "1px solid #CBD5E1",
            borderRadius: "6px",
            fontSize: "14px",
          }}
        />

        <select
          value={filtreStatut}
          onChange={(e) => setFiltreStatut(e.target.value)}
          style={{ padding: "8px 12px", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "14px" }}
        >
          <option value="">Tous les statuts</option>
          <option value="actif">Actif</option>
          <option value="en_attente">En attente</option>
          <option value="revoque">Révoqué</option>
        </select>

        <select
          value={filtreRole}
          onChange={(e) => setFiltreRole(e.target.value)}
          style={{ padding: "8px 12px", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "14px" }}
        >
          <option value="">Tous les rôles</option>
          <option value="agent">Agent</option>
          <option value="admin">Administrateur</option>
          <option value="rssi">RSSI</option>
          <option value="invite">Invité</option>
        </select>

        <button
          type="submit"
          style={{
            backgroundColor: "#0F172A",
            color: "#fff",
            border: "none",
            padding: "8px 16px",
            borderRadius: "6px",
            fontSize: "14px",
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          Filtrer
        </button>
      </form>

      {erreur && (
        <div style={{ backgroundColor: "#FEF2F2", color: "#991B1B", padding: "12px", borderRadius: "8px", marginBottom: "16px" }}>
          {erreur}
        </div>
      )}

      {/* Tableau des agents */}
      <div style={{ backgroundColor: "#fff", borderRadius: "8px", border: "1px solid #E2E8F0", overflow: "hidden" }}>
        {chargement ? (
          <div style={{ textAlign: "center", padding: "30px", color: "#64748B" }}>Chargement des agents...</div>
        ) : agents.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px", color: "#64748B" }}>Aucun agent correspondant.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
            <thead>
              <tr style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0", color: "#475569" }}>
                <th style={{ padding: "12px 16px" }}>Nom & Prénom</th>
                <th style={{ padding: "12px 16px" }}>E-mail</th>
                <th style={{ padding: "12px 16px" }}>Rôle</th>
                <th style={{ padding: "12px 16px" }}>Statut</th>
                <th style={{ padding: "12px 16px" }}>Identifiant Matrix</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 600, color: "#0F172A" }}>{agent.nom}</td>
                  <td style={{ padding: "12px 16px", color: "#334155" }}>{agent.email}</td>
                  <td style={{ padding: "12px 16px", textTransform: "capitalize" }}>
                    <span style={{ backgroundColor: "#F1F5F9", padding: "2px 8px", borderRadius: "4px", fontSize: "12px" }}>
                      {agent.role}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>{badgeStatut(agent.statut)}</td>
                  <td style={{ padding: "12px 16px", fontSize: "12px", fontFamily: "monospace", color: "#64748B" }}>
                    {agent.matrix_user_id}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>
                    <Link
                      to={`/admin/agents/${agent.id}`}
                      style={{
                        backgroundColor: "#E2E8F0",
                        color: "#0F172A",
                        textDecoration: "none",
                        padding: "6px 12px",
                        borderRadius: "4px",
                        fontSize: "12px",
                        fontWeight: 600,
                      }}
                    >
                      Consulter
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  );
};

