import React, { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, Cpu, Calendar, Database, RefreshCw, Lock, Terminal } from 'lucide-react';

export default function BlockchainLedger() {
  const [ledgerData, setLedgerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);

  const fetchLedger = async () => {
    try {
      setLoading(true);
      const res = await fetch('http://127.0.0.1:8000/api/blockchain');
      if (!res.ok) throw new Error("Failed to load blockchain ledger.");
      const data = await res.json();
      setLedgerData(data);
      setVerificationResult(null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyLedger = async () => {
    try {
      setVerifying(true);
      const res = await fetch('http://127.0.0.1:8000/api/blockchain/verify', {
        method: 'POST'
      });
      if (!res.ok) throw new Error("Verification request failed.");
      const result = await res.json();
      setVerificationResult(result);
    } catch (err) {
      console.error(err);
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, []);

  if (loading && !ledgerData) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }} className="pulse">
        <span style={{ color: 'var(--text-secondary)' }}>Syncing with cryptographic ledger...</span>
      </div>
    );
  }

  const { valid, status, height, chain } = ledgerData || {};

  const getFormattedDate = (timestamp) => {
    const d = new Date(timestamp * 1000);
    return d.toLocaleString();
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h2>Cryptographic Audit Ledger Explorer</h2>
          <p className="page-title-desc">
            Immutable blockchain timeline verifying history integrity of ticket lifecycles and comments.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={fetchLedger}>
          <RefreshCw size={16} /> Sync Ledger
        </button>
      </div>

      {/* Verification KPI Panel */}
      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', marginBottom: '28px' }}>
        {/* Ledger Integrity Card */}
        <div className="card kpi-card" style={{ borderLeft: `3px solid ${valid ? 'var(--color-success)' : 'var(--color-danger)'}` }}>
          <div className="kpi-icon" style={{ color: valid ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {valid ? <ShieldCheck size={24} /> : <ShieldAlert size={24} />}
          </div>
          <div>
            <div className="kpi-label">Ledger Validation</div>
            <div className="kpi-value" style={{ color: valid ? 'var(--color-success)' : 'var(--color-danger)', fontSize: '1.4rem' }}>
              {valid ? 'Chain Verified' : 'Breach Detected'}
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {status}
            </p>
          </div>
        </div>

        {/* Ledger Height Card */}
        <div className="card kpi-card">
          <div className="kpi-icon primary">
            <Database size={22} />
          </div>
          <div>
            <div className="kpi-label">Block Count</div>
            <div className="kpi-value">{height} Blocks</div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Chronological block records logged
            </p>
          </div>
        </div>

        {/* Trigger verification Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '10px' }}>
          <button 
            className="btn btn-primary" 
            onClick={handleVerifyLedger} 
            disabled={verifying}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            <ShieldCheck size={18} /> 
            {verifying ? 'Running Cryptographic Verification...' : 'Verify Ledger Integrity'}
          </button>
          
          {verificationResult && (
            <div 
              className="fade-in" 
              style={{ 
                fontSize: '0.8rem', 
                textAlign: 'center', 
                color: verificationResult.valid ? 'var(--color-success)' : 'var(--color-danger)',
                fontWeight: 600
              }}
            >
              {verificationResult.valid 
                ? '✓ Success: All previous block hashes calculate correctly!' 
                : `⚠ Warning: Chain broken! ${verificationResult.status}`}
            </div>
          )}
        </div>
      </div>

      {/* Node Timeline */}
      <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Terminal size={18} color="var(--color-primary)" /> Ledger Timeline
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative', paddingLeft: '20px', borderLeft: '1px dashed var(--border-color)' }}>
        {chain.map((block, idx) => (
          <div key={block.index} className="card fade-in" style={{ padding: '20px', margin: 0 }}>
            {/* Timeline connector circle */}
            <div 
              style={{ 
                position: 'absolute', 
                left: '-26px', 
                top: '28px', 
                width: '11px', 
                height: '11px', 
                borderRadius: '50%', 
                background: block.index === 0 ? 'var(--color-secondary)' : 'var(--color-primary)', 
                border: '3px solid var(--bg-app)',
                boxShadow: `0 0 10px ${block.index === 0 ? 'var(--color-secondary)' : 'var(--color-primary)'}`
              }}
            ></div>

            {/* Block Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <div>
                <span className="mode-badge" style={{ background: block.index === 0 ? 'rgba(217, 70, 239, 0.1)' : 'rgba(0, 240, 255, 0.1)', color: block.index === 0 ? 'var(--color-secondary)' : 'var(--color-primary)' }}>
                  BLOCK #{block.index}
                </span>
                <strong style={{ marginLeft: '12px', fontSize: '0.9rem', color: '#fff' }}>
                  {block.data.event || 'System Event'}
                </strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                <Calendar size={14} />
                <span>{getFormattedDate(block.timestamp)}</span>
              </div>
            </div>

            {/* Cryptographic Hashes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', margin: '12px 0', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.02)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                <span style={{ color: 'var(--text-muted)', width: '90px' }}>PREV HASH:</span>
                <span style={{ color: block.index === 0 ? 'var(--text-muted)' : 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {block.previous_hash}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                <span style={{ color: 'var(--color-primary)', width: '90px', fontWeight: 600 }}>BLOCK HASH:</span>
                <span style={{ color: 'var(--color-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textShadow: '0 0 5px rgba(0, 240, 255, 0.2)' }}>
                  {block.hash}
                </span>
              </div>
            </div>

            {/* Event Payload Data Details */}
            <div>
              <div className="ai-label" style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Cpu size={12} /> Event Payload Data
              </div>
              <pre 
                style={{ 
                  margin: '4px 0 0', 
                  padding: '10px', 
                  background: 'rgba(0,0,0,0.3)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '4px', 
                  fontFamily: 'var(--font-mono)', 
                  fontSize: '0.78rem', 
                  color: 'var(--text-primary)',
                  overflowX: 'auto',
                  whiteSpace: 'pre-wrap'
                }}
              >
                {JSON.stringify(block.data, null, 2)}
              </pre>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
