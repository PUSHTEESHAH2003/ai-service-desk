import React, { useState, useEffect } from 'react';
import { Key, Settings as Gear, Database, Server, CheckCircle2, ShieldAlert } from 'lucide-react';

export default function Settings({ apiKey, onApiKeyChange }) {
  const [inputKey, setInputKey] = useState(apiKey);
  const [dbStats, setDbStats] = useState(null);

  useEffect(() => {
    // Fetch stats to show DB details in diagnostics
    fetch('/api/dashboard')
      .then(res => res.json())
      .then(data => setDbStats(data))
      .catch(err => console.error("Error loading settings diagnostics:", err));
  }, []);

  const handleSave = (e) => {
    e.preventDefault();
    onApiKeyChange(inputKey);
    alert("Gemini API key configuration saved successfully!");
  };

  const handleClear = () => {
    setInputKey('');
    onApiKeyChange('');
    alert("Gemini API key removed. Activated heuristic fallback Mock Mode.");
  };

  const isMockMode = !apiKey || apiKey.trim() === '';

  return (
    <div className="fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h2>System Control Panel</h2>
          <p className="page-title-desc">Configure AI models, API keys, and inspect database diagnostics</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* API Key Panel */}
        <div className="card">
          <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Gear size={20} color="var(--color-primary)" />
            AI Integration Configuration
          </h3>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '20px' }}>
            {isMockMode ? (
              <>
                <ShieldAlert size={24} color="var(--color-warning)" />
                <div>
                  <div style={{ fontWeight: 600, color: '#fff' }}>Heuristic Mock Mode Active</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    The service desk is running offline logic. Analysis and checklists will be simulated using pre-defined patterns. Enter a Gemini API Key below to unlock live LLM analysis.
                  </div>
                </div>
              </>
            ) : (
              <>
                <CheckCircle2 size={24} color="var(--color-success)" />
                <div>
                  <div style={{ fontWeight: 600, color: '#fff' }}>Gemini API Integration Active</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    The service desk is communicating directly with `gemini-2.5-flash` model. Incoming incident text will be routed to Google LLMs for classifications and checklist drafting.
                  </div>
                </div>
              </>
            )}
          </div>

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Key size={14} /> Gemini API Authorization Key
              </label>
              <input
                type="password"
                placeholder="AIzaSy..."
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                className="input-text"
                style={{ fontFamily: 'monospace', letterSpacing: inputKey ? '0.2em' : 'normal' }}
              />
              <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '4px' }}>
                Keys are stored securely in local browser memory and never uploaded elsewhere.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" className="btn btn-primary">Save Configuration</button>
              {apiKey && (
                <button type="button" className="btn btn-secondary" onClick={handleClear}>
                  Disable Key (Use Mock)
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Diagnostic Panel */}
        <div className="card">
          <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Database size={20} color="var(--color-secondary)" />
            Database & Diagnostic Metrics
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
            <div style={{ background: 'rgba(255,255,255,0.01)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Storage Driver</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 600, color: '#fff', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Server size={16} color="var(--color-primary)" /> SQLite 3
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.01)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Total Incidents</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 600, color: '#fff', marginTop: '4px' }}>
                {dbStats ? dbStats.total_tickets : '—'} rows
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.01)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>SLA Breaches</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 600, color: '#fff', marginTop: '4px' }}>
                {dbStats ? dbStats.sla_breach_count : '—'} logged
              </div>
            </div>
            
            <div style={{ background: 'rgba(255,255,255,0.01)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>System Backend</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-success)', marginTop: '4px' }}>
                ONLINE
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
