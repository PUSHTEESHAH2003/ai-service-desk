import React, { useState, useEffect } from 'react';
import { 
  Layers, 
  BarChart3, 
  PlusCircle, 
  BookOpen, 
  Settings as GearIcon, 
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  LogOut,
  Lock
} from 'lucide-react';


import Dashboard from './components/Dashboard';
import TicketList from './components/TicketList';
import TicketDetail from './components/TicketDetail';
import SubmitTicket from './components/SubmitTicket';
import KnowledgeBase from './components/KnowledgeBase';
import Settings from './components/Settings';
import AuthScreen from './components/AuthScreen';
import BlockchainLedger from './components/BlockchainLedger';

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('current_user');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  
  // Set default active tab based on user role when logged in
  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'technical_head') {
        setActiveTab('dashboard');
      } else {
        setActiveTab('tickets');
      }
    }
  }, [currentUser]);

  const handleLogin = (userData) => {
    setCurrentUser(userData);
    localStorage.setItem('current_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('current_user');
  };

  // Persistent API key state
  const [apiKey, setApiKey] = useState(() => {
    return localStorage.getItem('gemini_api_key') || '';
  });

  const handleApiKeyChange = (newKey) => {
    setApiKey(newKey);
    localStorage.setItem('gemini_api_key', newKey);
  };

  // Whenever we change tab, reset selected ticket detail view
  const handleTabChange = (tabName) => {
    setActiveTab(tabName);
    setSelectedTicketId(null);
  };

  const isMockMode = !apiKey || apiKey.trim() === '';

  if (!currentUser) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div>
          <div className="brand">
            <div className="brand-icon">IT</div>
            <div className="brand-title">DIGIPLUS IT</div>
          </div>
          
          <nav className="nav-menu">
            {currentUser.role === 'technical_head' && (
              <div 
                className={`nav-item ${activeTab === 'dashboard' && !selectedTicketId ? 'active' : ''}`}
                onClick={() => handleTabChange('dashboard')}
              >
                <BarChart3 size={18} /> Dashboard
              </div>
            )}
            
            <div 
              className={`nav-item ${(activeTab === 'tickets' || selectedTicketId) ? 'active' : ''}`}
              onClick={() => handleTabChange('tickets')}
            >
              <Layers size={18} /> {currentUser.role === 'technical_head' ? 'Incident Workbench' : 'My Incidents'}
            </div>
            
            <div 
              className={`nav-item ${activeTab === 'submit' ? 'active' : ''}`}
              onClick={() => handleTabChange('submit')}
            >
              <PlusCircle size={18} /> Submit Incident
            </div>
            
            <div 
              className={`nav-item ${activeTab === 'kb' ? 'active' : ''}`}
              onClick={() => handleTabChange('kb')}
            >
              <BookOpen size={18} /> Knowledge Base
            </div>

            {currentUser.role === 'technical_head' && (
              <div 
                className={`nav-item ${activeTab === 'ledger' ? 'active' : ''}`}
                onClick={() => handleTabChange('ledger')}
              >
                <Lock size={18} /> Audit Ledger
              </div>
            )}
          </nav>
        </div>

        <div>
          {/* AI engine status check */}
          <div 
            className="nav-item" 
            style={{ 
              marginBottom: '12px', 
              fontSize: '0.8rem',
              padding: '8px 12px',
              background: isMockMode ? 'rgba(245, 158, 11, 0.05)' : 'rgba(16, 185, 129, 0.05)',
              border: isMockMode ? '1px dashed rgba(245, 158, 11, 0.2)' : '1px solid rgba(16, 185, 129, 0.2)',
              cursor: 'default'
            }}
          >
            {isMockMode ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-p2)' }}>
                <ShieldAlert size={14} /> Mock AI Engine
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-success)' }}>
                <ShieldCheck size={14} /> Gemini AI Online
              </span>
            )}
          </div>

          {currentUser.role === 'technical_head' && (
            <div 
              className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => handleTabChange('settings')}
              style={{ borderTop: '1px solid var(--border-color)', borderRadius: 0, paddingTop: '16px' }}
            >
              <GearIcon size={18} /> Control Panel
            </div>
          )}
          
          <div 
            className="nav-item"
            onClick={handleLogout}
            style={{ 
              color: 'var(--text-p1)', 
              marginTop: '8px', 
              cursor: 'pointer',
              borderTop: currentUser.role !== 'technical_head' ? '1px solid var(--border-color)' : 'none',
              borderRadius: 0,
              paddingTop: currentUser.role !== 'technical_head' ? '16px' : '12px'
            }}
          >
            <LogOut size={18} /> Sign Out ({currentUser.name.split(' ')[0]})
          </div>
          
          <div className="sidebar-footer">
            DigiPlus Assessment v1.0
          </div>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <main className="main-content">
        {selectedTicketId ? (
          <TicketDetail 
            ticketId={selectedTicketId} 
            apiKey={apiKey} 
            currentUser={currentUser}
            onBack={() => setSelectedTicketId(null)} 
          />
        ) : (
          <>
            {activeTab === 'dashboard' && currentUser.role === 'technical_head' && (
              <Dashboard onViewTicket={(id) => setSelectedTicketId(id)} />
            )}
            
            {activeTab === 'tickets' && (
              <TicketList 
                onSelectTicket={(id) => setSelectedTicketId(id)} 
                requesterEmail={null}
              />
            )}
            
            {activeTab === 'submit' && (
              <SubmitTicket 
                apiKey={apiKey} 
                currentUser={currentUser}
                onTicketCreated={(id) => {
                  setSelectedTicketId(id);
                }} 
              />
            )}
            
            {activeTab === 'kb' && (
              <KnowledgeBase />
            )}
            
            {activeTab === 'ledger' && currentUser.role === 'technical_head' && (
              <BlockchainLedger />
            )}
            
            {activeTab === 'settings' && currentUser.role === 'technical_head' && (
              <Settings 
                apiKey={apiKey} 
                onApiKeyChange={handleApiKeyChange} 
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
