<#
.SYNOPSIS
    SovereignMsg - Génération des certificats TLS de démonstration sous Windows PowerShell
#>
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$CertsDir = Join-Path $RootDir "deploy\nginx\certs"

Write-Host "🔐 [SovereignMsg] Génération du certificat TLS de démonstration..." -ForegroundColor Cyan

if (-not (Test-Path $CertsDir)) {
    New-Item -ItemType Directory -Path $CertsDir -Force | Out-Null
}

$KeyFile = Join-Path $CertsDir "server.key"
$CrtFile = Join-Path $CertsDir "server.crt"
$ExtFile = Join-Path $CertsDir "server.ext"
$CsrFile = Join-Path $CertsDir "server.csr"

# Vérification si OpenSSL est disponible
$opensslCmd = Get-Command openssl -ErrorAction SilentlyContinue

if ($opensslCmd) {
    @"
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = sovereign.local
DNS.3 = sovereignmsg.local
IP.1 = 127.0.0.1
"@ | Set-Content -Path $ExtFile -Encoding ASCII

    & openssl genrsa -out $KeyFile 4096
    & openssl req -new -key $KeyFile -out $CsrFile -subj "/C=BF/ST=Kadiogo/L=Ouagadougou/O=MTDPCE-DGTD/OU=Securite/CN=sovereign.local"
    & openssl x509 -req -in $CsrFile -signkey $KeyFile -out $CrtFile -days 365 -sha256 -extfile $ExtFile

    if (Test-Path $CsrFile) { Remove-Item $CsrFile }
    if (Test-Path $ExtFile) { Remove-Item $ExtFile }

    Write-Host "✅ Certificat TLS généré via OpenSSL avec succès !" -ForegroundColor Green
} else {
    # Secours via New-SelfSignedCertificate natif Windows
    Write-Host "ℹ️ OpenSSL non détecté, création via PowerShell New-SelfSignedCertificate..." -ForegroundColor Yellow
    $cert = New-SelfSignedCertificate -DnsName "localhost", "sovereign.local" -CertStoreLocation "cert:\CurrentUser\My" -NotAfter (Get-Date).AddYears(1) -KeyAlgorithm RSA -KeyLength 4096
    
    # Export du certificat au format PEM
    $certBytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
    $certBase64 = [System.Convert]::ToBase64String($certBytes, [System.Base64FormattingOptions]::InsertLineBreaks)
    $certPem = "-----BEGIN CERTIFICATE-----`r`n$certBase64`r`n-----END CERTIFICATE-----`r`n"
    [System.IO.File]::WriteAllText($CrtFile, $certPem)

    Write-Host "⚠️ Veuillez vous assurer qu'une clé privée server.key valide est présente dans $CertsDir." -ForegroundColor Yellow
}
