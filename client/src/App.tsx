import React from 'react';

export const App: React.FC = () => {
  return (
    <div style={{ maxWidth: '640px', margin: '40px auto', padding: '24px', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
      <header style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <span style={{ display: 'inline-block', width: '20px', height: '10px', backgroundColor: '#EF3340', borderRadius: '2px' }}></span>
          <span style={{ display: 'inline-block', width: '20px', height: '10px', backgroundColor: '#009739', borderRadius: '2px' }}></span>
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#004D25' }}>SovereignMsg</h1>
        <p style={{ color: '#64748B', fontSize: '14px', marginTop: '4px' }}>
          Messagerie Souveraine Sécurisée — Administration Burkinabè (Hackathon 226)
        </p>
      </header>

      <section style={{ backgroundColor: '#F1F5F9', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#0F172A', marginBottom: '8px' }}>
          Statut de l'Infrastructure (Étape 1)
        </h2>
        <ul style={{ listStyleType: 'none', paddingLeft: 0, fontSize: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <li>🔒 <strong>Chiffrement de bout en bout :</strong> vodozemac / Rust Crypto (Client Only)</li>
          <li>🛡️ <strong>Reverse Proxy Nginx :</strong> Seul le port 443 est exposé avec TLS durci</li>
          <li>🚫 <strong>Synapse :</strong> Inscription publique et fédération désactivées</li>
          <li>🔑 <strong>Passerelle FastAPI :</strong> Authentification forte (Argon2id + TOTP Fernet)</li>
        </ul>
      </section>

      <footer style={{ textAlign: 'center', fontSize: '12px', color: '#94A3B8' }}>
        République du Burkina Faso — Ministère de la Transition Digitale (MTDPCE / DGTD)
      </footer>
    </div>
  );
};

export default App;

