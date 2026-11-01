/**
 * SovereignMsg Client - P13 Tableau de bord (Administrateur / RSSI)
 * =================================================================
 * Vue d'ensemble opérationnelle :
 * - Compteurs d'agents : Total, Actifs, En attente, Révoqués
 * - Répartition des agents par rôle
 * - Raccourcis vers la liste des agents, l'enrôlement et le journal d'audit
 */

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AdminLayout } from "../../components/AdminLayout";
import { apiGetAdminStats, AdminStats } from "../../services/api";

export const P13_TableauDeBord: React.FC = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [chargement, setChargement] = useState<boolean>(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let monte = true;
    const charger = async () => {
      try {
        setChargement(true);
        const data = await apiGetAdminStats();
        if (monte) setStats(data);
      } catch (err: any) {
        if (monte) setErreur("Impossible de charger les statistiques du système.");
      } finally {
        if (monte) setChargement(false);
      }
    };
    charger();
    return () => {
      monte = false;
    };
  }, []);

  return (
    <AdminLayout titre="Tableau de bord - Pilotage de la Sécurité">
      {erreur && (
        <div style={{ backgroundColor: "#FEF2F2", color: "#991B1B", padding: "12px 16px", borderRadius: "8px", marginBottom: "20px", border: "1px solid #FCA5A5" }}>
          ⚠️ {erreur}
        </div>
      )}

      {chargement ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#64748B" }}>
          Chargement des indicateurs...
        </div>
      ) : stats ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Cartes d'indicateurs clés */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
            <div style={{ backgroundColor: "#fff", padding: "20px", borderRadius: "8px", border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize: "13px", color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>
                Total Agents
              </div>
              <div style={{ fontSize: "32px", fontWeight: 700, color: "#0F172A", marginTop: "8px" }}>
                {stats.total_agents}
              </div>
            </div>

            <div style={{ backgroundColor: "#fff", padding: "20px", borderRadius: "8px", border: "1px solid #E2E8F0", borderLeft: "4px solid #009739", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize: "13px", color: "#009739", fontWeight: 600, textTransform: "uppercase" }}>
                Agents Actifs
              </div>
              <div style={{ fontSize: "32px", fontWeight: 700, color: "#009739", marginTop: "8px" }}>
                {stats.actifs}
              </div>
            </div>

            <div style={{ backgroundColor: "#fff", padding: "20px", borderRadius: "8px", border: "1px solid #E2E8F0", borderLeft: "4px solid #F59E0B", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize: "13px", color: "#D97706", fontWeight: 600, textTransform: "uppercase" }}>
                En Attente d'Activation
              </div>
              <div style={{ fontSize: "32px", fontWeight: 700, color: "#D97706", marginTop: "8px" }}>
                {stats.en_attente}
              </div>
            </div>

            <div style={{ backgroundColor: "#fff", padding: "20px", borderRadius: "8px", border: "1px solid #E2E8F0", borderLeft: "4px solid #EF3340", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize: "13px", color: "#EF3340", fontWeight: 600, textTransform: "uppercase" }}>
                Agents Révoqués
              </div>
              <div style={{ fontSize: "32px", fontWeight: 700, color: "#EF3340", marginTop: "8px" }}>
                {stats.revoques}
              </div>
            </div>
          </div>

          {/* Grille : Répartition par rôle et Actions rapides */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
            {/* Répartition par rôles */}
            <div style={{ backgroundColor: "#fff", padding: "24px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#0F172A", marginBottom: "16px" }}>
                Répartition des Rôles
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {Object.entries(stats.par_role).map(([role, count]) => (
                  <div key={role} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", backgroundColor: "#F8FAFC", borderRadius: "6px" }}>
                    <span style={{ textTransform: "capitalize", fontWeight: 500, color: "#334155" }}>
                      {role === "admin" ? "🛡️ Administrateur" : role === "rssi" ? "🔍 RSSI" : role === "agent" ? "👤 Agent" : "👥 Invité"}
                    </span>
                    <span style={{ fontWeight: 700, backgroundColor: "#E2E8F0", padding: "2px 10px", borderRadius: "12px", fontSize: "13px" }}>
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Raccourcis et Actions */}
            <div style={{ backgroundColor: "#fff", padding: "24px", borderRadius: "8px", border: "1px solid #E2E8F0", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#0F172A", marginBottom: "12px" }}>
                  Actions de Gestion
                </h2>
                <p style={{ fontSize: "14px", color: "#64748B", marginBottom: "20px" }}>
                  Enrôlez un nouvel agent, révoquez un accès compromis ou auditez la chaîne cryptographique d'intégrité.
                </p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <Link
                  to="/admin/agents/nouveau"
                  style={{
                    display: "block",
                    textAlign: "center",
                    backgroundColor: "#009739",
                    color: "#fff",
                    textDecoration: "none",
                    padding: "10px 16px",
                    borderRadius: "6px",
                    fontWeight: 600,
                    fontSize: "14px",
                  }}
                >
                  ➕ Enrôler un nouvel agent
                </Link>
                <Link
                  to="/admin/agents"
                  style={{
                    display: "block",
                    textAlign: "center",
                    backgroundColor: "#0F172A",
                    color: "#fff",
                    textDecoration: "none",
                    padding: "10px 16px",
                    borderRadius: "6px",
                    fontWeight: 600,
                    fontSize: "14px",
                  }}
                >
                  📋 Consulter l'annuaire des agents
                </Link>
                <Link
                  to="/admin/audit"
                  style={{
                    display: "block",
                    textAlign: "center",
                    backgroundColor: "#F1F5F9",
                    color: "#334155",
                    textDecoration: "none",
                    padding: "10px 16px",
                    borderRadius: "6px",
                    fontWeight: 600,
                    fontSize: "14px",
                    border: "1px solid #CBD5E1",
                  }}
                >
                  📜 Consulter le journal d'audit infalsifiable
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </AdminLayout>
  );
};

