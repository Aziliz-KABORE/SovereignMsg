/**
 * SovereignMsg Client - P15 Enrôlement d'un agent (Administrateur uniquement)
 * =========================================================================
 * Formulaire de création d'un agent :
 * - Nom, e-mail, rôle
 * - Appel à POST /api/admin/agents
 * - RÈGLE NON NÉGOCIABLE : Le lien d'activation avec le jeton n'est affiché qu'une seule fois !
 * - Avertissement explicite et bouton de copie du lien
 */

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { AdminLayout } from "../../components/AdminLayout";
import { apiCreateAgent, AgentCreateResult } from "../../services/api";

export const P15_EnrolementAgent: React.FC = () => {
  const [nom, setNom] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [role, setRole] = useState<string>("agent");

  const [chargement, setChargement] = useState<boolean>(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enrolementReussi, setEnrolementReussi] = useState<AgentCreateResult | null>(null);
  const [copie, setCopie] = useState<boolean>(false);

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur(null);
    setChargement(true);

    try {
      const res = await apiCreateAgent({ nom, email, role });
      setEnrolementReussi(res);
      // Réinitialiser le formulaire
      setNom("");
      setEmail("");
      setRole("agent");
    } catch (err: any) {
      setErreur(err.response?.data?.detail || "Erreur lors de l'enrôlement de l'agent.");
    } finally {
      setChargement(false);
    }
  };

  const lienActivation = enrolementReussi
    ? `${window.location.origin}/activation?jeton=${enrolementReussi.jeton_activation}`
    : "";

  const copierLien = async () => {
    if (!lienActivation) return;
    try {
      await navigator.clipboard.writeText(lienActivation);
      setCopie(true);
      setTimeout(() => setCopie(false), 3000);
    } catch {
      // Fallback
    }
  };

  return (
    <AdminLayout titre="Enrôlement d'un Nouvel Agent">
      <div style={{ maxWidth: "680px", margin: "0 auto" }}>
        {enrolementReussi ? (
          <div
            style={{
              backgroundColor: "#fff",
              padding: "28px",
              borderRadius: "8px",
              border: "1px solid #E2E8F0",
              boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
            }}
          >
            <div style={{ textAlign: "center", marginBottom: "20px" }}>
              <div style={{ fontSize: "40px", marginBottom: "8px" }}>✅</div>
              <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#009739", margin: 0 }}>
                Agent Enrôlé avec Succès !
              </h2>
              <p style={{ color: "#64748B", fontSize: "14px", marginTop: "6px" }}>
                Fiche créée pour <strong>{enrolementReussi.nom}</strong> ({enrolementReussi.email})
              </p>
            </div>

            {/* Avertissement de sécurité obligatoire */}
            <div
              style={{
                backgroundColor: "#FEF2F2",
                border: "2px solid #EF3340",
                borderRadius: "8px",
                padding: "16px",
                marginBottom: "20px",
              }}
            >
              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <span style={{ fontSize: "20px" }}>⚠️</span>
                <div>
                  <strong style={{ color: "#991B1B", fontSize: "14px", display: "block", marginBottom: "4px" }}>
                    ATTENTION : LIEN D'ACTIVATION À USAGE UNIQUE
                  </strong>
                  <p style={{ color: "#7F1D1D", fontSize: "13px", margin: 0, lineHeight: "1.4" }}>
                    Ce lien contient le jeton d'activation sécurisé valable 48h. Il ne sera <strong>plus jamais réaffiché</strong> ni accessible après avoir quitté cette page. Transmettez-le immédiatement à l'agent via un canal souverain ou sécurisé.
                  </p>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                Lien d'activation à transmettre à l'agent :
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="text"
                  readOnly
                  value={lienActivation}
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    borderRadius: "6px",
                    border: "1px solid #CBD5E1",
                    backgroundColor: "#F8FAFC",
                    fontFamily: "monospace",
                    fontSize: "13px",
                  }}
                />
                <button
                  onClick={copierLien}
                  style={{
                    backgroundColor: copie ? "#009739" : "#0F172A",
                    color: "#fff",
                    border: "none",
                    padding: "10px 16px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: 600,
                    minWidth: "100px",
                  }}
                >
                  {copie ? "✓ Copié !" : "Copier"}
                </button>
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                onClick={() => setEnrolementReussi(null)}
                style={{
                  backgroundColor: "#F1F5F9",
                  color: "#334155",
                  border: "1px solid #CBD5E1",
                  padding: "10px 16px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: 500,
                }}
              >
                Enrôler un autre agent
              </button>
              <Link
                to="/admin/agents"
                style={{
                  backgroundColor: "#009739",
                  color: "#fff",
                  textDecoration: "none",
                  padding: "10px 16px",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontWeight: 600,
                  display: "inline-block",
                }}
              >
                Voir la liste des agents
              </Link>
            </div>
          </div>
        ) : (
          <form
            onSubmit={soumettre}
            style={{
              backgroundColor: "#fff",
              padding: "28px",
              borderRadius: "8px",
              border: "1px solid #E2E8F0",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}
          >
            <p style={{ color: "#64748B", fontSize: "14px", marginTop: 0, marginBottom: "20px" }}>
              Remplissez les informations administratives pour créer la fiche agent et générer son jeton de premier accès.
            </p>

            {erreur && (
              <div style={{ backgroundColor: "#FEF2F2", color: "#991B1B", padding: "12px", borderRadius: "6px", marginBottom: "16px", border: "1px solid #FCA5A5" }}>
                ⚠️ {erreur}
              </div>
            )}

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                Nom et Prénom *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Sawadogo Aminata"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "6px",
                  border: "1px solid #CBD5E1",
                  fontSize: "14px",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                Adresse e-mail professionnelle *
              </label>
              <input
                type="email"
                required
                placeholder="Ex: aminata.sawadogo@dgtd.gov.bf"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "6px",
                  border: "1px solid #CBD5E1",
                  fontSize: "14px",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                Rôle attribué *
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "6px",
                  border: "1px solid #CBD5E1",
                  fontSize: "14px",
                  backgroundColor: "#fff",
                  boxSizing: "border-box",
                }}
              >
                <option value="agent">Agent standard (Messagerie chiffrée E2EE)</option>
                <option value="admin">Administrateur (Enrôlement, révocation, back-office)</option>
                <option value="rssi">RSSI (Audit et contrôle de sécurité en lecture)</option>
                <option value="invite">Invité restreint</option>
              </select>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <Link
                to="/admin/agents"
                style={{
                  padding: "10px 16px",
                  borderRadius: "6px",
                  border: "1px solid #CBD5E1",
                  backgroundColor: "#F1F5F9",
                  color: "#334155",
                  textDecoration: "none",
                  fontSize: "14px",
                  fontWeight: 500,
                }}
              >
                Annuler
              </Link>
              <button
                type="submit"
                disabled={chargement}
                style={{
                  backgroundColor: "#009739",
                  color: "#fff",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: chargement ? "not-allowed" : "pointer",
                }}
              >
                {chargement ? "Génération en cours..." : "Générer le lien d'enrôlement"}
              </button>
            </div>
          </form>
        )}
      </div>
    </AdminLayout>
  );
};

