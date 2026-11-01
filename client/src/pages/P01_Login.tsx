/**
 * SovereignMsg Client - P01 : Connexion
 * =====================================
 * Page de connexion unique regroupant mot de passe et code TOTP.
 * Règles strictes :
 * - Message d'erreur unique anti-énumération après tout échec
 * - Le device_id est envoyé automatiquement depuis localStorage sans être saisi ni affiché
 * - Aucun log de mot de passe, de code TOTP ni de jeton
 */

import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { InputField } from "../components/InputField";
import { Button } from "../components/Button";
import { useAuth } from "../store/authStore";
import {
  apiLogin,
  apiGetMe,
  getStoredDeviceId,
  saveStoredDeviceId,
} from "../services/api";

export const P01_Login: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { connecter } = useAuth();

  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [codeTotp, setCodeTotp] = useState("");
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("session_expired") === "1") {
      setInfoMessage(t("auth.login.session_expired"));
    }
  }, [location.search, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur(null);
    setInfoMessage(null);
    setChargement(true);

    try {
      // Récupération automatique du device_id mémorisé localement (sans saisie)
      const storedDeviceId = getStoredDeviceId(email);

      // Appel de connexion vers la passerelle
      const loginRes = await apiLogin({
        email: email.trim(),
        mot_de_passe: motDePasse,
        code_totp: codeTotp.trim(),
        device_id: storedDeviceId,
      });

      // Mémorisation non-secrète du device_id attribué pour les futures connexions
      if (loginRes.device_id) {
        saveStoredDeviceId(email, loginRes.device_id);
      }

      // Connexion au store en mémoire
      // Nous initialisons temporairement le JWT dans le store pour permettre l'appel /auth/me
      connecter({
        jwt: loginRes.access_token,
        matrixAccessToken: loginRes.matrix_access_token,
        deviceId: loginRes.device_id,
        utilisateur: {
          id: "",
          nom: email,
          email: email,
          role: "agent",
          statut: "actif",
          matrix_user_id: loginRes.matrix_user_id,
        },
      });

      // Récupération de l'identité complète vérifiée par la passerelle
      const me = await apiGetMe();
      connecter({
        jwt: loginRes.access_token,
        matrixAccessToken: loginRes.matrix_access_token,
        deviceId: loginRes.device_id,
        utilisateur: me,
      });

      // Redirection vers l'espace de travail
      const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/";
      navigate(from, { replace: true });
    } catch {
      // Règle anti-énumération absolue : message unique quel que soit le motif de rejet
      setErreur(t("auth.login.error_generic"));
    } finally {
      setChargement(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center mb-6">
          <div className="inline-block p-2 bg-green-800 rounded-lg text-white font-bold text-2xl tracking-wider mb-2">
            🇧🇫 SOVEREIGNMSG
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900">
            {t("auth.login.title")}
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            {t("app.republic")}
          </p>
        </div>

        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-200">
          {infoMessage && (
            <div className="mb-4 p-3 bg-blue-50 border-l-4 border-blue-500 text-blue-700 text-sm">
              {infoMessage}
            </div>
          )}

          {erreur && (
            <div
              data-testid="login-error-message"
              className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm font-medium"
            >
              {erreur}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <InputField
              label={t("auth.login.email_label")}
              type="email"
              name="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("auth.login.email_placeholder")}
            />

            <InputField
              label={t("auth.login.password_label")}
              type="password"
              name="motDePasse"
              required
              autoComplete="current-password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              placeholder={t("auth.login.password_placeholder")}
            />

            <InputField
              label={t("auth.login.totp_label")}
              type="text"
              name="codeTotp"
              required
              maxLength={32}
              autoComplete="one-time-code"
              value={codeTotp}
              onChange={(e) => setCodeTotp(e.target.value.trim())}
              placeholder="Ex : 123456 ou JBSWY3DPEHPK3PXP"
              helpText="Saisissez le code à 6 chiffres généré par votre application (Google Authenticator) ou directement le secret de test (JBSWY3DPEHPK3PXP)."
            />

            <div className="p-3 bg-gray-50 rounded border border-gray-200 text-xs">
              <span className="font-semibold text-gray-700 block mb-2">Comptes de test rapide (1-clic) :</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="px-2.5 py-1.5 bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-100 text-gray-800 font-medium cursor-pointer"
                  onClick={() => {
                    setEmail("admin@gouv.bf");
                    setMotDePasse("AdminDemo2026!#");
                    setCodeTotp("JBSWY3DPEHPK3PXP");
                  }}
                >
                  👑 Admin (admin@gouv.bf)
                </button>
                <button
                  type="button"
                  className="px-2.5 py-1.5 bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-100 text-gray-800 font-medium cursor-pointer"
                  onClick={() => {
                    setEmail("agent.a@gouv.bf");
                    setMotDePasse("AgentADemo2026!#");
                    setCodeTotp("JBSWY3DPEHPK3PXP");
                  }}
                >
                  🛡️ Agent A (agent.a@gouv.bf)
                </button>
                <button
                  type="button"
                  className="px-2.5 py-1.5 bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-100 text-gray-800 font-medium cursor-pointer"
                  onClick={() => {
                    setEmail("agent.c@gouv.bf");
                    setMotDePasse("AgentCDemo2026!#");
                    setCodeTotp("JBSWY3DPEHPK3PXP");
                  }}
                >
                  📋 Agent C (agent.c@gouv.bf)
                </button>
              </div>
            </div>

            <div className="pt-2">
              <Button type="submit" isLoading={chargement}>
                {t("auth.login.submit")}
              </Button>
            </div>
          </form>

          <div className="mt-6 text-center border-t border-gray-200 pt-4">
            <Link
              to="/activation"
              className="text-sm font-medium text-green-700 hover:text-green-800"
            >
              {t("auth.login.activation_link")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
