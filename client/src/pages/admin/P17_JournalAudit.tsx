/**
 * SovereignMsg Client - P17 Journal d'audit infalsifiable (Administrateur / RSSI)
 * ===============================================================================
 * Consultation de la piste d'audit à chaînage cryptographique SHA-256 :
 * - Affichage chronologique inverse avec filtres par action
 * - Bouton de vérification cryptographique de la chaîne (verify_chain)
 * - Export CSV du journal complet
 * - Aucune modification possible depuis l'interface (lecture seule, exigence EF-51)
 */

import React, { useEffect, useState } from "react";
import { AdminLayout } from "../../components/AdminLayout";
import {
  apiGetAuditEntries,
  apiVerifyAuditChain,
  apiDownloadAuditCsv,
  AuditEntryItem,
  AuditVerifyResult,
} from "../../services/api";

const ACTIONS_DISPONIBLES = [
  "",
  "LOGIN_SUCCESS",
  "LOGIN_FAILURE",
  "ACTIVATION_INIT",
  "ACTIVATION_CONFIRM",
  "AGENT_CREATION",
  "AGENT_REVOCATION",
  "AGENT_ROLE_UPDATE",
  "AGENT_UPDATE",
];

const badgeAction = (action: string) => {
  const couleurs: Record<string, { bg: string; text: string }> = {
    AGENT_REVOCATION: { bg: "#FEE2E2", text: "#991B1B" },
    LOGIN_FAILURE: { bg: "#FEF3C7", text: "#92400E" },
    LOGIN_SUCCESS: { bg: "#DCFCE7", text: "#166534" },
    AGENT_CREATION: { bg: "#EDE9FE", text: "#5B21B6" },
    ACTIVATION_CONFIRM: { bg: "#E0F2FE", text: "#075985" },
    ACTIVATION_INIT: { bg: "#F0FDF4", text: "#15803D" },
    AGENT_ROLE_UPDATE: { bg: "#FEF3C7", text: "#B45309" },
  };
  const style = couleurs[action] || { bg: "#F1F5F9", text: "#475569" };
  return (
    <span
      style={{
        backgroundColor: style.bg,
        color: style.text,
        padding: "2px 8px",
        borderRadius: "4px",
        fontSize: "11px",
        fontWeight: 700,
        letterSpacing: "0.3px",
        whiteSpace: "nowrap",
      }}
    >
      {action}
    </span>
  );
};

export const P17_JournalAudit: React.FC = () => {
  const [entrees, setEntrees] = useState<AuditEntryItem[]>([]);
  const [chargement, setChargement] = useState<boolean>(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const [filtreAction, setFiltreAction] = useState<string>("");
  const [limite, setLimite] = useState<number>(100);

  const [verification, setVerification] = useState<AuditVerifyResult | null>(null);
  const [enVerification, setEnVerification] = useState<boolean>(false);
  const [enExport, setEnExport] = useState<boolean>(false);

  // Affichage complet du hash pour une entrée sélectionnée
  const [entreeSelectionnee, setEntreeSelectionnee] = useState<string | null>(null);

  const charger = async () => {
    try {
      setChargement(true);
      setErreur(null);
      const data = await apiGetAuditEntries({
        limit: limite,
        action: filtreAction || undefined,
      });
      setEntrees(data);
    } catch {
      setErreur("Erreur lors de la récupération du journal d'audit.");
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    charger();
  }, [filtreAction, limite]);

  const verifierChaine = async () => {
    setEnVerification(true);
    setVerification(null);
    try {
      const res = await apiVerifyAuditChain();
      setVerification(res);
    } catch {
      setVerification({ valide: false, total_entrees: 0, message: "Erreur lors de la vérification." });
    } finally {
      setEnVerification(false);
    }
  };

  const exporterCsv = async () => {
    setEnExport(true);
    try {
      const blob = await apiDownloadAuditCsv();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const nom = `journal_audit_${new Date().toISOString().slice(0, 10)}.csv`;
      a.href = url;
      a.download = nom;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setErreur("Erreur lors de l'export CSV.");
    } finally {
      setEnExport(false);
    }
  };

  const formaterDate = (iso: string): string => {
    try {
      return new Date(iso).toLocaleString("fr-BF", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  return (
    <AdminLayout titre="Journal d'Audit Infalsifiable (SHA-256)">
      {/* Barre d'outils */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          alignItems: "center",
          backgroundColor: "#fff",
          padding: "16px",
          borderRadius: "8px",
          border: "1px solid #E2E8F0",
          marginBottom: "16px",
          flexWrap: "wrap",
        }}
      >
        <select
          value={filtreAction}
          onChange={(e) => setFiltreAction(e.target.value)}
          style={{ padding: "8px 12px", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "14px" }}
        >
          <option value="">Toutes les actions</option>
          {ACTIONS_DISPONIBLES.filter(Boolean).map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        <select
          value={limite}
          onChange={(e) => setLimite(Number(e.target.value))}
          style={{ padding: "8px 12px", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "14px" }}
        >
          <option value={50}>50 entrées</option>
          <option value={100}>100 entrées</option>
          <option value={250}>250 entrées</option>
          <option value={1000}>1 000 entrées</option>
        </select>

        <div style={{ flex: 1 }} />

        {/* Vérification cryptographique */}
        <button
          onClick={verifierChaine}
          disabled={enVerification}
          style={{
            backgroundColor: "#0F172A",
            color: "#fff",
            border: "none",
            padding: "8px 16px",
            borderRadius: "6px",
            cursor: enVerification ? "not-allowed" : "pointer",
            fontSize: "13px",
            fontWeight: 600,
          }}
        >
          {enVerification ? "Vérification..." : "🔐 Vérifier l'intégrité"}
        </button>

        {/* Export CSV */}
        <button
          onClick={exporterCsv}
          disabled={enExport}
          style={{
            backgroundColor: "#009739",
            color: "#fff",
            border: "none",
            padding: "8px 16px",
            borderRadius: "6px",
            cursor: enExport ? "not-allowed" : "pointer",
            fontSize: "13px",
            fontWeight: 600,
          }}
        >
          {enExport ? "Export..." : "📥 Exporter CSV"}
        </button>
      </div>

      {/* Résultat de vérification */}
      {verification && (
        <div
          style={{
            backgroundColor: verification.valide ? "#DCFCE7" : "#FEE2E2",
            border: `1px solid ${verification.valide ? "#86EFAC" : "#FCA5A5"}`,
            color: verification.valide ? "#166534" : "#991B1B",
            padding: "14px 18px",
            borderRadius: "8px",
            marginBottom: "16px",
            display: "flex",
            gap: "10px",
            alignItems: "flex-start",
          }}
        >
          <span style={{ fontSize: "20px" }}>{verification.valide ? "✅" : "❌"}</span>
          <div>
            <strong>{verification.valide ? "Chaîne cryptographique intègre" : "Altération détectée !"}</strong>
            <div style={{ fontSize: "13px", marginTop: "4px" }}>
              {verification.message} — {verification.total_entrees} entrée(s) vérifiée(s).
            </div>
          </div>
        </div>
      )}

      {erreur && (
        <div style={{ backgroundColor: "#FEF2F2", color: "#991B1B", padding: "12px", borderRadius: "8px", marginBottom: "16px" }}>
          {erreur}
        </div>
      )}

      {/* Tableau du journal */}
      <div style={{ backgroundColor: "#fff", borderRadius: "8px", border: "1px solid #E2E8F0", overflow: "auto" }}>
        {chargement ? (
          <div style={{ textAlign: "center", padding: "30px", color: "#64748B" }}>Chargement du journal...</div>
        ) : entrees.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px", color: "#64748B" }}>Aucune entrée dans le journal d'audit.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", minWidth: "900px" }}>
            <thead>
              <tr style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0", color: "#475569" }}>
                <th style={{ padding: "10px 14px", textAlign: "left" }}>Horodatage (UTC)</th>
                <th style={{ padding: "10px 14px", textAlign: "left" }}>Acteur</th>
                <th style={{ padding: "10px 14px", textAlign: "left" }}>Action</th>
                <th style={{ padding: "10px 14px", textAlign: "left" }}>Cible</th>
                <th style={{ padding: "10px 14px", textAlign: "left" }}>Détail</th>
                <th style={{ padding: "10px 14px", textAlign: "left" }}>Hash (SHA-256)</th>
              </tr>
            </thead>
            <tbody>
              {entrees.map((e) => (
                <tr
                  key={e.id}
                  onClick={() => setEntreeSelectionnee(entreeSelectionnee === e.id ? null : e.id)}
                  style={{
                    borderBottom: "1px solid #F1F5F9",
                    cursor: "pointer",
                    backgroundColor: entreeSelectionnee === e.id ? "#F8FAFC" : "transparent",
                  }}
                >
                  <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: "12px", whiteSpace: "nowrap" }}>
                    {formaterDate(e.horodatage)}
                  </td>
                  <td style={{ padding: "10px 14px", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {e.acteur}
                  </td>
                  <td style={{ padding: "10px 14px" }}>{badgeAction(e.action)}</td>
                  <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: "11px", maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {e.cible}
                  </td>
                  <td style={{ padding: "10px 14px", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {e.detail}
                  </td>
                  <td
                    style={{
                      padding: "10px 14px",
                      fontFamily: "monospace",
                      fontSize: "10px",
                      color: "#64748B",
                    }}
                    title={`H. précédent : ${e.hash_precedent}\nHash : ${e.hash}`}
                  >
                    {e.hash.slice(0, 16)}…
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Détail d'une entrée sélectionnée */}
      {entreeSelectionnee && (() => {
        const e = entrees.find((x) => x.id === entreeSelectionnee);
        if (!e) return null;
        return (
          <div style={{ marginTop: "16px", backgroundColor: "#0F172A", color: "#E2E8F0", padding: "16px", borderRadius: "8px", fontFamily: "monospace", fontSize: "12px" }}>
            <div style={{ marginBottom: "8px", fontWeight: 700, fontSize: "13px", color: "#94A3B8" }}>
              Détail cryptographique de l'entrée sélectionnée
            </div>
            <div style={{ marginBottom: "4px" }}>
              <span style={{ color: "#64748B" }}>ID        : </span>{e.id}
            </div>
            <div style={{ marginBottom: "4px" }}>
              <span style={{ color: "#64748B" }}>Horodatage: </span>{e.horodatage}
            </div>
            <div style={{ marginBottom: "4px" }}>
              <span style={{ color: "#64748B" }}>Acteur    : </span>{e.acteur}
            </div>
            <div style={{ marginBottom: "4px" }}>
              <span style={{ color: "#64748B" }}>Action    : </span>{e.action}
            </div>
            <div style={{ marginBottom: "4px" }}>
              <span style={{ color: "#64748B" }}>Cible     : </span>{e.cible}
            </div>
            <div style={{ marginBottom: "8px" }}>
              <span style={{ color: "#64748B" }}>Détail    : </span>{e.detail}
            </div>
            <div style={{ color: "#94A3B8", marginBottom: "4px" }}>
              <span style={{ color: "#64748B" }}>H. préc.  : </span>
              <span style={{ color: "#FCD34D", wordBreak: "break-all" }}>{e.hash_precedent}</span>
            </div>
            <div>
              <span style={{ color: "#64748B" }}>Hash SHA-256 : </span>
              <span style={{ color: "#6EE7B7", wordBreak: "break-all" }}>{e.hash}</span>
            </div>
          </div>
        );
      })()}

      <p style={{ fontSize: "12px", color: "#94A3B8", marginTop: "12px" }}>
        🔒 Lecture seule. Aucune entrée ne peut être modifiée ou supprimée depuis l'interface. Le chaînage cryptographique SHA-256 garantit l'intégrité de la piste d'audit (EF-51).
      </p>
    </AdminLayout>
  );
};

