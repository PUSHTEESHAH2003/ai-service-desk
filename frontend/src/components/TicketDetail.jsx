import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Sparkles, 
  Send, 
  UserPlus, 
  AlertTriangle, 
  Activity, 
  FileText, 
  CheckSquare, 
  Key, 
  ChevronRight,
  BookOpen,
  Info
} from 'lucide-react';

export default function TicketDetail({ ticketId, onBack, apiKey, currentUser }) {
  const [ticket, setTicket] = useState(null);
  const [agents, setAgents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  
  // Comment Form State
  const [commentBody, setCommentBody] = useState('');
  const [commentVisibility, setCommentVisibility] = useState('public');
  
  // Edit State
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [agentId, setAgentId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [escalated, setEscalated] = useState(false);
  const [outage, setOutage] = useState(false);
  
  // Resolution Logger
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [showResolutionBox, setShowResolutionBox] = useState(false);

  // Active KB modal reader
  const [activeArticle, setActiveArticle] = useState(null);
  const [kbArticles, setKbArticles] = useState([]);

  // AI checklist checked states persistent in localStorage
  const [checkedTasks, setCheckedTasks] = useState({});

  const fetchTicketDetails = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/tickets/${ticketId}`);
      if (!res.ok) throw new Error("Failed to load ticket");
      const data = await res.json();
      setTicket(data);
      
      // Initialize edit states
      setStatus(data.status);
      setPriority(data.priority);
      setAgentId(data.assigned_agent_id || '');
      setCategoryId(data.category_id || '');
      setEscalated(data.escalated === 1);
      setOutage(data.outage_related === 1);
      setResolutionSummary(data.resolution_summary || '');
      setShowResolutionBox(data.status === 'resolved');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTicketDetails();
    
    // Load Agents and Categories for dropdowns
    fetch('/api/agents')
      .then(res => res.json())
      .then(data => setAgents(data));
      
    fetch('/api/categories')
      .then(res => res.json())
      .then(data => setCategories(data));

    fetch('/api/kb')
      .then(res => res.json())
      .then(data => setKbArticles(data));
  }, [ticketId]);

  // Load checked tasks state from localStorage when ticket details are loaded
  useEffect(() => {
    if (ticket) {
      const stored = localStorage.getItem(`ticket_tasks_${ticketId}`);
      if (stored) {
        try {
          setCheckedTasks(JSON.parse(stored));
        } catch (e) {
          console.error(e);
        }
      } else {
        setCheckedTasks({});
      }
    }
  }, [ticketId, ticket?.ai_checklist]);

  const handleTaskToggle = (idx) => {
    const next = { ...checkedTasks, [idx]: !checkedTasks[idx] };
    setCheckedTasks(next);
    localStorage.setItem(`ticket_tasks_${ticketId}`, JSON.stringify(next));
  };

  // Submit edits
  const handleUpdateDetails = async (e) => {
    const isResolving = status === 'resolved' && ticket.status !== 'resolved';
    
    const updates = {
      status,
      priority,
      category_id: categoryId ? parseInt(categoryId) : null,
      assigned_agent_id: agentId ? parseInt(agentId) : null,
      escalated,
      outage_related: outage,
      resolution_summary: status === 'resolved' ? (resolutionSummary || "Issue resolved by support agent.") : null
    };

    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (!res.ok) throw new Error("Failed to update ticket");
      
      // If resolving, add a resolution comment
      if (isResolving) {
        await fetch(`/api/tickets/${ticketId}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            body: `[SYSTEM] Ticket resolved. Outcome: ${updates.resolution_summary}`,
            agent_id: agentId ? parseInt(agentId) : null,
            visibility: 'public',
            team: 'Support'
          })
        });
      }
      
      fetchTicketDetails();
      alert("Ticket details updated successfully.");
    } catch (err) {
      alert(err.message);
    }
  };

  // Run AI Copilot
  const handleRunAI = async () => {
    try {
      setAiLoading(true);
      const headers = {};
      if (apiKey) {
        headers['x-api-key'] = apiKey;
      }
      const res = await fetch(`/api/tickets/${ticketId}/analyze`, {
        method: 'POST',
        headers: headers
      });
      if (!res.ok) throw new Error("AI Analysis request failed");
      const result = await res.json();
      
      // Update check states and local state
      fetchTicketDetails();
    } catch (err) {
      alert("Error generating AI analysis: " + err.message);
    } finally {
      setAiLoading(false);
    }
  };

  // Submit new comment
  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentBody.trim()) return;

    try {
      const res = await fetch(`/api/tickets/${ticketId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: commentBody,
          agent_id: agentId ? parseInt(agentId) : null,
          visibility: commentVisibility,
          team: 'Support'
        })
      });
      if (!res.ok) throw new Error("Failed to post comment");
      
      setCommentBody('');
      fetchTicketDetails();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }} className="pulse">
        <span style={{ color: 'var(--text-secondary)' }}>Loading ticket details...</span>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="card text-center" style={{ padding: '40px' }}>
        <h3>Ticket Not Found</h3>
        <p>This incident records might have been removed or does not exist.</p>
        <button className="btn btn-secondary" onClick={onBack}>Go Back</button>
      </div>
    );
  }

  // Format Date helpers
  const getFormattedDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr.replace(" ", "T"));
    return d.toLocaleString();
  };

  const parsedChecklist = ticket.ai_checklist ? ticket.ai_checklist.split(";") : [];

  const getMatchedArticles = () => {
    if (!ticket) return [];
    return kbArticles.filter(art => {
      const matchesCategory = art.category_id === ticket.category_id;
      const summaryWords = (ticket.ai_summary || ticket.summary || '').toLowerCase().split(/\s+/);
      const matchesKeywords = summaryWords.some(word => 
        word.length > 4 && (art.title.toLowerCase().includes(word) || art.tags.toLowerCase().includes(word))
      );
      return matchesCategory || matchesKeywords;
    }).slice(0, 2);
  };

  return (
    <div className="fade-in">
      {/* Back button */}
      <button 
        className="btn btn-secondary" 
        onClick={onBack} 
        style={{ marginBottom: '20px', padding: '8px 14px' }}
      >
        <ArrowLeft size={16} /> Back to List
      </button>

      {/* SLA Breach Warning Bar */}
      {ticket.sla_breach && (
        <div className="sla-warning">
          <AlertTriangle size={20} />
          <div>
            <strong>SLA Breach Detected!</strong> Breach type: {ticket.sla_breach.breach_type}. 
            Target time was {ticket.sla_breach.sla_target_hours}h. Actual duration: {ticket.sla_breach.actual_hours}h 
            ({ticket.sla_breach.breach_minutes} minutes over target).
          </div>
        </div>
      )}

      {/* Ticket Details & Workbench Grid */}
      <div className="workbench">
        {/* Left Side: Ticket Workspace */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Main Info Card */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <span style={{ color: 'var(--color-primary)', fontWeight: 600, fontSize: '0.9rem' }}>
                  INCIDENT #{ticket.ticket_id} ({ticket.channel} channel)
                </span>
                <h2 style={{ fontSize: '1.5rem', margin: '4px 0 12px' }}>{ticket.ai_summary || ticket.summary}</h2>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {ticket.outage_related === 1 && <span className="badge badge-outage">Outage</span>}
                {ticket.escalated === 1 && <span className="badge badge-escalated">Escalated</span>}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '16px', color: 'var(--text-secondary)', fontSize: '0.85rem', flexWrap: 'wrap', margin: '8px 0 20px', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
              <div>Department: <strong style={{ color: '#fff' }}>{ticket.requester_department}</strong></div>
              <div>Affected Service: <strong style={{ color: '#fff' }}>{ticket.affected_service}</strong></div>
              <div>Submitted: <strong style={{ color: '#fff' }}>{getFormattedDate(ticket.created_at)}</strong></div>
              {ticket.resolved_at && (
                <div>Resolved: <strong style={{ color: '#fff' }}>{getFormattedDate(ticket.resolved_at)}</strong></div>
              )}
            </div>

            <div>
              <h4 style={{ marginBottom: '8px', color: '#fff' }}>Original Description</h4>
              <p style={{ color: 'var(--text-primary)', whiteSpace: 'pre-wrap', background: 'rgba(255,255,255,0.01)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontSize: '0.92rem' }}>
                {ticket.description}
              </p>
            </div>
          </div>

          {/* Manage Form Card */}
          {currentUser?.role === 'technical_head' ? (
            <div className="card">
              <h3 style={{ marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>Incident Management Panel</h3>
              
              <div className="form-row">
                {/* Status Select */}
                <div className="form-group">
                  <label className="form-label">Lifecycle Status</label>
                  <select 
                    className="select-filter" 
                    value={status}
                    onChange={(e) => {
                      setStatus(e.target.value);
                      setShowResolutionBox(e.target.value === 'resolved');
                    }}
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>

                {/* Priority Select */}
                <div className="form-group">
                  <label className="form-label">Priority Impact</label>
                  <select 
                    className="select-filter" 
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                  >
                    <option value="P1">P1 (Outage)</option>
                    <option value="P2">P2 (High)</option>
                    <option value="P3">P3 (Medium)</option>
                    <option value="P4">P4 (Low)</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                {/* Category Select */}
                <div className="form-group">
                  <label className="form-label">Classification Category</label>
                  <select 
                    className="select-filter" 
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.service})</option>
                    ))}
                  </select>
                </div>

                {/* Agent Assignment */}
                <div className="form-group">
                  <label className="form-label">Assigned Support Agent</label>
                  <select 
                    className="select-filter" 
                    value={agentId}
                    onChange={(e) => setAgentId(e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {agents.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.team})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '20px', margin: '12px 0 20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={escalated}
                    onChange={(e) => setEscalated(e.target.checked)}
                  />
                  Escalate Support Ticket
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={outage}
                    onChange={(e) => setOutage(e.target.checked)}
                  />
                  Outage Event Related
                </label>
              </div>

              {/* Resolution outcome summary */}
              {showResolutionBox && (
                <div className="form-group fade-in">
                  <label className="form-label" style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>Resolution outcome summary</label>
                  <textarea
                    className="form-textarea"
                    placeholder="Explain how the incident was investigated and resolved..."
                    value={resolutionSummary}
                    onChange={(e) => setResolutionSummary(e.target.value)}
                    style={{ minHeight: '80px', borderColor: 'var(--color-success)' }}
                  ></textarea>
                </div>
              )}

              <button className="btn btn-primary" onClick={handleUpdateDetails}>
                Apply System Updates
              </button>
            </div>
          ) : (
            ticket.status !== 'resolved' && (
              <div className="card">
                <h3 style={{ marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>Ticket Actions</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  If this incident has been resolved to your satisfaction, you can close it below.
                </p>
                <button 
                  className="btn btn-primary" 
                  style={{ background: 'var(--color-success)', color: '#fff', boxShadow: 'none' }}
                  onClick={async () => {
                    try {
                      const res = await fetch(`/api/tickets/${ticketId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          status: 'resolved',
                          resolution_summary: "Closed by user."
                        })
                      });
                      if (!res.ok) throw new Error("Failed to close ticket");
                      
                      // Post a public system comment
                      await fetch(`/api/tickets/${ticketId}/comments`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          body: "[SYSTEM] Incident marked as resolved and closed by the requester.",
                          visibility: 'public',
                          team: 'Customer'
                        })
                      });

                      fetchTicketDetails();
                      alert("Incident marked as resolved.");
                    } catch (err) {
                      alert(err.message);
                    }
                  }}
                >
                  Mark as Resolved / Close Incident
                </button>
              </div>
            )
          )}

          {/* Activity / Comments Timeline */}
          <div className="comments-section">
            <h3 style={{ marginBottom: '20px' }}>Activity Log ({ticket.comments.length} comments)</h3>
            
            {/* Comment timeline items */}
            {ticket.comments.map(c => {
              const isSystem = c.body.startsWith('[SYSTEM]');
              const isInternal = c.visibility === 'internal';
              if (isInternal && currentUser?.role === 'user') return null;
              return (
                <div key={c.comment_id} className={`comment-card fade-in ${isInternal ? 'internal' : ''}`}>
                  <div className="comment-header">
                    <span style={{ fontWeight: 600, color: isInternal ? 'var(--color-warning)' : '#fff' }}>
                      {isSystem ? 'SYSTEM ENGINE' : (c.agent_name || 'Support Agent')} 
                      {isInternal && ' (Internal Note)'}
                    </span>
                    <span>{getFormattedDate(c.created_at)}</span>
                  </div>
                  <div style={{ color: 'var(--text-primary)', whiteSpace: 'pre-wrap', fontSize: '0.9rem' }}>
                    {c.body}
                  </div>
                </div>
              );
            })}

            {/* New Comment Form */}
            <form onSubmit={handleAddComment} className="card" style={{ marginTop: '20px' }}>
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label">Add Note / Update Reply</label>
                  
                  {/* Visibility Toggler */}
                  {currentUser?.role === 'technical_head' && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        className={`btn ${commentVisibility === 'public' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '4px' }}
                        onClick={() => setCommentVisibility('public')}
                      >
                        Public Reply
                      </button>
                      <button
                        type="button"
                        className={`btn ${commentVisibility === 'internal' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '4px', background: commentVisibility === 'internal' ? 'var(--color-warning)' : '' }}
                        onClick={() => setCommentVisibility('internal')}
                      >
                        Internal Note
                      </button>
                    </div>
                  )}
                </div>
                
                <textarea
                  className="form-textarea"
                  placeholder={commentVisibility === 'internal' ? "Write internal debugging details visible only to support agents..." : "Write customer-facing reply..."}
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  style={{ minHeight: '100px' }}
                ></textarea>
              </div>
              <button type="submit" className="btn btn-secondary" style={{ alignSelf: 'flex-start' }}>
                <Send size={14} /> Post Comment
              </button>
            </form>
          </div>
        </div>

        {/* Right Side: AI Assistant Workbench */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Copilot Card */}
          <div className="card ai-panel">
            <div className="ai-header">
              <Sparkles size={20} color="var(--color-secondary)" />
              <span>AI Copilot Assistant</span>
            </div>

            {aiLoading ? (
              <div style={{ padding: '40px 10px', textAlign: 'center' }}>
                <div className="pulse" style={{ color: '#fff', fontSize: '0.9rem', marginBottom: '8px' }}>
                  Analyzing ticket context...
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                  Querying Gemini LLM engine & searching KB database.
                </div>
              </div>
            ) : (
              <div>
                {!ticket.ai_summary ? (
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '14px' }}>
                      This incident has not been analyzed by the AI engine yet.
                    </p>
                    <button className="btn btn-primary" onClick={handleRunAI} style={{ width: '100%' }}>
                      <Sparkles size={16} /> Analyze Incident
                    </button>
                  </div>
                ) : (
                  <div>
                    {/* Priority analysis */}
                    <div className="ai-block">
                      <div className="ai-label">Recommended Impact</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0 8px' }}>
                        <span className={`badge badge-${ticket.priority.toLowerCase()}`}>{ticket.priority}</span>
                        <strong style={{ fontSize: '0.85rem' }}>AI recommendation</strong>
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        {ticket.ai_priority_reason}
                      </div>
                    </div>

                    {/* Category analysis */}
                    <div className="ai-block">
                      <div className="ai-label">Suggested Routing</div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', margin: '4px 0' }}>
                        {ticket.category_name}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        {ticket.ai_category_reason}
                      </div>
                    </div>

                    {/* Interactive Task list */}
                    {parsedChecklist.length > 0 && (
                      <div className="ai-block">
                        <div className="ai-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                          <CheckSquare size={14} /> Interactive Resolution Checklist
                        </div>
                        {parsedChecklist.map((task, idx) => (
                          <div key={idx} className="ai-checklist-item">
                            <input 
                              type="checkbox" 
                              checked={!!checkedTasks[idx]}
                              onChange={() => handleTaskToggle(idx)}
                              style={{ marginTop: '3px' }}
                            />
                            <span style={{ 
                              color: checkedTasks[idx] ? 'var(--text-muted)' : 'var(--text-primary)',
                              textDecoration: checkedTasks[idx] ? 'line-through' : 'none'
                            }}>
                              {task}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}



                    <button 
                      className="btn btn-secondary" 
                      onClick={handleRunAI} 
                      style={{ width: '100%', marginTop: '16px', fontSize: '0.8rem', justifyContent: 'center' }}
                    >
                      Re-run AI Analysis
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Active Copilot Recommendations (Article Preview list if ticket is analyzed) */}
          {ticket.ai_summary && (
            <div className="card">
              <h4 style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookOpen size={16} color="var(--color-primary)" />
                Connected Support Docs
              </h4>
              
              {getMatchedArticles().length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '4px' }}>
                    Click an article below to open the resolution manual:
                  </p>
                  {getMatchedArticles().map(art => (
                    <div 
                      key={art.id} 
                      className="kb-card" 
                      style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', margin: 0 }}
                      onClick={() => setActiveArticle(art)}
                    >
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#fff', display: 'flex', alignItems: 'center' }}>
                        <span>{art.title}</span>
                        <ChevronRight size={14} style={{ color: 'var(--color-secondary)', marginLeft: 'auto' }} />
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {art.content.slice(0, 100)}...
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                    No support documents connected yet. Ensure you run **Analyze Incident** to link semantic support files here.
                  </p>
                  <button className="btn btn-secondary" style={{ fontSize: '0.8rem' }} onClick={handleRunAI}>
                    Sync Connected Files
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* KB Article Reader Modal Overlay */}
      {activeArticle && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
          <div className="card fade-in" style={{ maxWidth: '600px', width: '100%', maxHeight: '80vh', overflowY: 'auto' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <BookOpen color="var(--color-primary)" size={20} />
              {activeArticle.title}
            </h3>
            <p style={{ whiteSpace: 'pre-wrap', color: 'var(--text-primary)', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', lineHeight: '1.6' }}>
              {activeArticle.content}
            </p>
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => setActiveArticle(null)}>Dismiss</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
