import React, { useState } from 'react';
import { KeyRound, Mail, User, ShieldAlert, Sparkles, Phone, Briefcase, UserCheck } from 'lucide-react';

export default function AuthScreen({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [department, setDepartment] = useState('IT');
  const [contactNumber, setContactNumber] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handlePreFill = (roleType) => {
    setError(null);
    if (roleType === 'admin') {
      setEmail('admin@company.com');
      setPassword('admin');
      setIsRegister(false);
    } else {
      setEmail('employee@company.com');
      setPassword('password');
      setIsRegister(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (isRegister) {
        // Register Call
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            employee_id: employeeId,
            email,
            password,
            department,
            contact_number: contactNumber || null
          })
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.detail || 'Registration failed');
        }

        // Auto-login after successful registration
        const loginResponse = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const loginResult = await loginResponse.json();
        if (!loginResponse.ok) {
          throw new Error(loginResult.detail || 'Login failed after registration');
        }
        onLogin(loginResult);
      } else {
        // Login Call
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.detail || 'Invalid credentials');
        }
        onLogin(result);
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#090a0f',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Decorative Glow elements */}
      <div style={{
        position: 'absolute',
        top: '-15%',
        left: '-15%',
        width: '50vw',
        height: '50vw',
        background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, rgba(0,0,0,0) 70%)',
        zIndex: 0
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-15%',
        right: '-15%',
        width: '50vw',
        height: '50vw',
        background: 'radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, rgba(0,0,0,0) 70%)',
        zIndex: 0
      }} />

      <div className="card fade-in" style={{
        width: '100%',
        maxWidth: '520px',
        zIndex: 1,
        padding: '40px 32px',
        border: '1px solid var(--border-color-glow)'
      }}>
        {/* Logo Title */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '8px' }}>
          <div className="brand-icon" style={{ width: '42px', height: '42px', fontSize: '1.2rem' }}>IT</div>
          <h2 className="ai-glowing-text" style={{ fontSize: '1.8rem', letterSpacing: '-0.03em' }}>DIGIPLUS IT</h2>
        </div>
        <p style={{
          textAlign: 'center',
          color: 'var(--text-secondary)',
          fontSize: '0.9rem',
          marginBottom: '32px'
        }}>
          AI-Powered Incident Response & Support Workbench
        </p>

        {error && (
          <div className="sla-warning" style={{ marginBottom: '24px', padding: '12px 16px' }}>
            <ShieldAlert size={20} />
            <div style={{ fontSize: '0.85rem' }}>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {isRegister && (
            <>
              {/* Full Name */}
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    required
                    className="input-text"
                    style={{ width: '100%', paddingLeft: '44px' }}
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <User size={18} style={{ position: 'absolute', left: '16px', top: '14px', color: 'var(--text-muted)' }} />
                </div>
              </div>

              {/* Employee ID & Department */}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Employee ID</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      required
                      className="input-text"
                      style={{ width: '100%', paddingLeft: '44px' }}
                      placeholder="EMP099"
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value)}
                    />
                    <Briefcase size={18} style={{ position: 'absolute', left: '16px', top: '14px', color: 'var(--text-muted)' }} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Department</label>
                  <select
                    className="select-filter"
                    style={{ width: '100%' }}
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                  >
                    <option value="IT">IT</option>
                    <option value="HR">HR</option>
                    <option value="Finance">Finance</option>
                    <option value="Warehouse">Warehouse</option>
                    <option value="Sales">Sales</option>
                    <option value="Operations">Operations</option>
                  </select>
                </div>
              </div>

              {/* Phone number */}
              <div className="form-group">
                <label className="form-label">Contact Number</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="tel"
                    className="input-text"
                    style={{ width: '100%', paddingLeft: '44px' }}
                    placeholder="+1 (555) 0123"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                  />
                  <Phone size={18} style={{ position: 'absolute', left: '16px', top: '14px', color: 'var(--text-muted)' }} />
                </div>
              </div>
            </>
          )}

          {/* Email Address */}
          <div className="form-group">
            <label className="form-label">Corporate Email</label>
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                required
                className="input-text"
                style={{ width: '100%', paddingLeft: '44px' }}
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Mail size={18} style={{ position: 'absolute', left: '16px', top: '14px', color: 'var(--text-muted)' }} />
            </div>
          </div>

          {/* Password */}
          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                required
                className="input-text"
                style={{ width: '100%', paddingLeft: '44px' }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <KeyRound size={18} style={{ position: 'absolute', left: '16px', top: '14px', color: 'var(--text-muted)' }} />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isLoading}
            style={{ width: '100%', justifyContent: 'center', padding: '12px 18px', marginTop: '8px' }}
          >
            {isLoading ? (
              'Authenticating...'
            ) : isRegister ? (
              <>
                <Sparkles size={16} /> Register & Sign In
              </>
            ) : (
              <>
                <UserCheck size={16} /> Sign In
              </>
            )}
          </button>
        </form>

        {/* Toggle Mode */}
        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.9rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>
            {isRegister ? 'Already have an account? ' : 'Need corporate access? '}
          </span>
          <button
            type="button"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-primary)',
              fontWeight: '600',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
            onClick={() => {
              setIsRegister(!isRegister);
              setError(null);
            }}
          >
            {isRegister ? 'Sign In here' : 'Register Account'}
          </button>
        </div>

        {/* Developer Sandbox Login Shortcuts */}
        <div style={{
          borderTop: '1px solid var(--border-color)',
          marginTop: '32px',
          paddingTop: '24px'
        }}>
          <div style={{
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '12px',
            textAlign: 'center'
          }}>
            Quick Login Sandbox Shortcuts
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '8px 12px', gap: '6px' }}
              onClick={() => handlePreFill('employee')}
            >
              <User size={14} color="var(--color-success)" /> Employee Demo
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '8px 12px', gap: '6px' }}
              onClick={() => handlePreFill('admin')}
            >
              <User size={14} color="var(--color-secondary)" /> IT Admin Demo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
