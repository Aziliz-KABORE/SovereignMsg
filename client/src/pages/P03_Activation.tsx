/**
 * SovereignMsg Client - P03 : Activation de compte
 * =================================================
 * Processus d'activation en deux temps :
 * Étape 1 : Saisie du jeton d'activation + définition du mot de passe (≥ 12 car.)
 * Étape 2 : Génération locale du QR code via qrcode.react (MIT) et validation du premier TOTP.
 *
 * Règles strictes :
 * - Aucune image Base64 traitée manuellement ni service externe pour le QR code
 * - L'URI otpauth et le secret sont effacés de la mémoire à la confirmation ou au démontage
 * - Aucun stockage dans localStorage/sessionStorage, aucun console.log
 */

import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { QRCodeSVG } from "qrcode.react";
import { InputField } from "../components/InputField";
import { Button } from "../components/Button";
import { apiActivationInit, apiActivationConfirm } from "../services/api";

export const P03_Activation: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Étape du flux : 1 = Mot de passe, 2 = TOTP & Confirmation, 3 = Succès
  const [etape, setEtape] = useState<1 | 2 | 3>(1);

  // Champs de l'étape 1
  const [jeton, setJeton] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmationMotDePasse, setConfirmationMotDePasse] = useState("");

  // Données éphémères de l'étape 2 (gardées uniquement en mémoire React)
  const [otpauthUri, setOtpauthUri] = useState<string | null>(null);
  const [secretTexte, setSecretTexte] = useState<string | null>(null);
  const [codeConfirmation, setCodeConfirmation] = useState("");

  // États de l'interface
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Nettoyage impératif à la destruction du composant (anti-fuite mémoire)
  useEffect(() => {
    return () => {
      setOtpauthUri(null);
      setSecretTexte(null);
    };
  }, []);

  // Étape 1 : Initialisation du mot de passe et réception du secret TOTP
  const handleEtape1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur(null);

    if (motDePasse.length < 12) {
      setErreur(t("auth.activation.password_too_short"));
      return;
    }

    if (motDePasse !== confirmationMotDePasse) {
      setErreur(t("auth.activation.password_mismatch"));
      return;
    }

    setChargement(true);
    try {
      const res = await apiActivationInit({
        jeton: jeton.trim(),
        mot_de_passe: motDePasse,
      });

      // Extraction du secret pour affichage en texte clair (saisie manuelle)
      try {
        const parsedUrl = new URL(res.otpauth_uri);
        const extractedSecret = parsedUrl.searchParams.get("secret");
        setSecretTexte(extractedSecret);
      } catch {
        setSecretTexte(null);
      }

      setOtpauthUri(res.otpauth_uri);
      setEtape(2);
    } catch {
      setErreur(t("auth.activation.error_generic"));
    } finally {
      setChargement(false);
    }
  };

  // Étape 2 : Confirmation du premier code TOTP et finalisation
  const handleEtape2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur(null);
    setChargement(true);

    try {
      await apiActivationConfirm({
        jeton: jeton.trim(),
        code: codeConfirmation.trim(),
      });

      // Effacement immédiat des données sensibles en mémoire
      setOtpauthUri(null);
      setSecretTexte(null);
      setEtape(3);
    } catch {
      setErreur(t("auth.activation.error_generic"));
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
            {t("auth.activation.title")}
          </h2>
        </div>

        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-200">
          {erreur && (
            <div
              data-testid="activation-error-message"
              className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm font-medium"
            >
              {erreur}
            </div>
          )}

          {etape === 1 && (
            <form onSubmit={handleEtape1Submit} className="space-y-4">
              <h3 className="text-md font-semibold text-gray-800 border-b pb-2">
                {t("auth.activation.step1_title")}
              </h3>

              <InputField
                label={t("auth.activation.token_label")}
                type="text"
                name="jeton"
                required
                value={jeton}
                onChange={(e) => setJeton(e.target.value)}
                placeholder={t("auth.activation.token_placeholder")}
              />

              <InputField
                label={t("auth.activation.new_password_label")}
                type="password"
                name="motDePasse"
                required
                minLength={12}
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                placeholder={t("auth.activation.new_password_placeholder")}
              />

              <InputField
                label={t("auth.activation.confirm_password_label")}
                type="password"
                name="confirmationMotDePasse"
                required
                minLength={12}
                value={confirmationMotDePasse}
                onChange={(e) => setConfirmationMotDePasse(e.target.value)}
                placeholder={t("auth.activation.confirm_password_placeholder")}
              />

              <div className="pt-2">
                <Button type="submit" isLoading={chargement}>
                  {t("auth.activation.submit_step1")}
                </Button>
              </div>
            </form>
          )}

          {etape === 2 && otpauthUri && (
            <form onSubmit={handleEtape2Submit} className="space-y-4">
              <h3 className="text-md font-semibold text-gray-800 border-b pb-2">
                {t("auth.activation.step2_title")}
              </h3>

              <p className="text-xs text-gray-600">
                {t("auth.activation.qr_instruction")}
              </p>

              {/* Rendu local du QR Code via SVG sans aucun service externe ni image Base64 */}
              <div
                data-testid="qr-code-container"
                className="flex justify-center p-4 bg-white border border-gray-200 rounded-md"
              >
                <QRCodeSVG
                  value={otpauthUri}
                  size={192}
                  level="M"
                  includeMargin={true}
                />
              </div>

              {secretTexte && (
                <div className="p-3 bg-gray-50 border rounded text-center">
                  <span className="text-xs text-gray-500 block mb-1">
                    {t("auth.activation.manual_entry")}
                  </span>
                  <code
                    data-testid="totp-secret-text"
                    className="text-xs font-mono font-bold tracking-widest text-gray-800 select-all"
                  >
                    {secretTexte}
                  </code>
                </div>
              )}

              <InputField
                label={t("auth.activation.confirm_code_label")}
                type="text"
                name="codeConfirmation"
                required
                inputMode="numeric"
                maxLength={6}
                pattern="[0-9]{6}"
                value={codeConfirmation}
                onChange={(e) => setCodeConfirmation(e.target.value.replace(/\D/g, ""))}
                placeholder={t("auth.activation.confirm_code_placeholder")}
              />

              <div className="pt-2">
                <Button type="submit" isLoading={chargement}>
                  {t("auth.activation.submit_step2")}
                </Button>
              </div>
            </form>
          )}

          {etape === 3 && (
            <div className="text-center py-4 space-y-4">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                <svg
                  className="h-6 w-6 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900">
                {t("auth.activation.success_message")}
              </h3>
              <Button onClick={() => navigate("/connexion")}>
                {t("auth.activation.back_to_login")}
              </Button>
            </div>
          )}

          {etape !== 3 && (
            <div className="mt-6 text-center border-t border-gray-200 pt-4">
              <Link
                to="/connexion"
                className="text-sm font-medium text-green-700 hover:text-green-800"
              >
                {t("auth.activation.back_to_login")}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
