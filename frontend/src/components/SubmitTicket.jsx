import React, { useState, useEffect } from 'react';
import { Sparkles, FileText, CheckCircle, AlertTriangle, Info } from 'lucide-react';

export default function SubmitTicket({ onTicketCreated, apiKey, currentUser }) {
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [department, setDepartment] = useState(currentUser?.department || 'IT');
  const [categoryId, setCategoryId] = useState('');
  const [priority, setPriority] = useState('P3');
  const [outage, setOutage] = useState(false);

  const [categories, setCategories] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pre-analysis states
  const [aiPreview, setAiPreview] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    // Load categories for assignment drop-down
    fetch('/api/categories')
      .then(res => res.json())
      .then(data => setCategories(data))
      .catch(err => console.error("Error loading categories:", err));
  }, []);

  const handlePreAnalyze = async () => {
    if (!description.trim()) {
      alert("Please type an incident description first to analyze.");
      return;
    }

    try {
      setAiLoading(true);
      setAiPreview(null);
      
      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) {
        headers['x-api-key'] = apiKey;
      }
      
      const res = await fetch('/api/tickets/analyze-draft', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ description })
      });
      
      if (!res.ok) throw new Error("Pre-analysis API failed");
      const result = await res.json();
      
      setAiPreview({
        priority: result.priority,
        categoryId: result.category_id,
        categoryName: result.category_name,
        department: result.requester_department,
        summary: result.summary || (description.split(".")[0].slice(0, 70) + "...")
      });
    } catch (err) {
      console.error(err);
      alert("AI Pre-analysis failed. Make sure backend is running.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleApplyAi = () => {
    if (aiPreview) {
      setPriority(aiPreview.priority);
      setCategoryId(aiPreview.categoryId.toString());
      setSummary(aiPreview.summary);
      if (aiPreview.department) {
        setDepartment(aiPreview.department);
      }
      if (aiPreview.priority === 'P1') {
        setOutage(true);
      }
      setAiPreview(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!summary.trim() || !description.trim()) {
      alert("Please fill in the incident title and description.");
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        summary,
        description,
        category_id: categoryId ? parseInt(categoryId) : null,
        priority,
        channel: 'web',
        requester_department: department,
        requester_email: currentUser?.email || null,
        affected_service: 'general',
        outage_related: outage
      };

      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Failed to submit ticket");
      const result = await res.json();
      
      // Trigger background AI analysis on the newly created ticket automatically
      const headers = {};
      if (apiKey) {
        headers['x-api-key'] = apiKey;
      }
      fetch(`/api/tickets/${result.ticket_id}/analyze`, {
        method: 'POST',
        headers: headers
      }).catch(err => console.error("Auto analyze error:", err));

      alert("Incident ticket created successfully!");
      onTicketCreated(result.ticket_id);
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h2>Submit Technical Incident</h2>
          <p className="page-title-desc">Log a new operational issue or request with AI-assisted routing</p>
        </div>
      </div>

      <div className="grid-form-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '24px' }}>
        
        {/* Main Form */}
        <form onSubmit={handleSubmit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div className="form-group">
            <label className="form-label">Issue Summary / Title</label>
            <input
              type="text"
              placeholder="e.g. Zebra label printer printing blank pages"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="input-text"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Detailed Description</label>
            <textarea
              placeholder="Explain the incident in natural language. Provide error messages, specific hardware models, departments affected, or step-by-step actions that caused it..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="form-textarea"
              required
            ></textarea>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                onClick={handlePreAnalyze}
              >
                <Sparkles size={14} color="var(--color-secondary)" /> Pre-Analyze Description
              </button>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Requester Department</label>
              <select 
                className="select-filter"
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

            <div className="form-group">
              <label className="form-label">Category Routing</label>
              <select
                className="select-filter"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">Unassigned</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Initial Priority</label>
              <select
                className="select-filter"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="P1">P1 (Critical)</option>
                <option value="P2">P2 (High)</option>
                <option value="P3">P3 (Medium)</option>
                <option value="P4">P4 (Low)</option>
              </select>
            </div>

            <div className="form-group" style={{ justifyContent: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '20px' }}>
                <input
                  type="checkbox"
                  checked={outage}
                  onChange={(e) => setOutage(e.target.checked)}
                />
                <span>Business-Critical Outage</span>
                
                <span className="tooltip-container">
                  <Info size={14} style={{ color: 'var(--text-secondary)', cursor: 'help' }} />
                  <span className="tooltip-text">
                    <strong style={{ color: '#fff', fontSize: '0.85rem' }}>Business-Critical Outage</strong>
                    <div style={{ marginTop: '6px', marginBottom: '4px', fontWeight: 600, color: 'var(--color-success)' }}>✅ Select if:</div>
                    <ul style={{ margin: '0 0 8px 14px', padding: 0, listStyleType: 'disc' }}>
                      <li>Core servers (ERP, Email, Login portals) are completely down.</li>
                      <li>Main network/internet connection is offline.</li>
                      <li>An entire department is blocked from working.</li>
                    </ul>
                    <div style={{ marginBottom: '4px', fontWeight: 600, color: 'var(--color-danger)' }}>❌ Do NOT select for:</div>
                    <ul style={{ margin: '0 0 0 14px', padding: 0, listStyleType: 'disc' }}>
                      <li>Individual laptop/hardware malfunctions.</li>
                      <li>Single-user app errors or slow loading.</li>
                    </ul>
                  </span>
                </span>
              </label>
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ marginTop: '12px', alignSelf: 'flex-start' }}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Creating Incident..." : "Create Support Ticket"}
          </button>
        </form>

        {/* Right Side AI Copilot Pre-analysis results */}
        <div>
          {aiLoading && (
            <div className="card text-center" style={{ padding: '20px' }}>
              <div className="pulse" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                AI Model Pre-Analyzing...
              </div>
            </div>
          )}

          {aiPreview && (
            <div className="card fade-in" style={{ border: '1px solid var(--border-color-glow)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={16} color="var(--color-secondary)" />
                AI Routing Assistant
              </h4>
              
              <div style={{ fontSize: '0.85rem' }}>
                <div>Recommended Priority: <span className={`badge badge-${aiPreview.priority.toLowerCase()}`}>{aiPreview.priority}</span></div>
                <div style={{ marginTop: '8px' }}>Routing Category: <strong>{aiPreview.categoryName}</strong></div>
              </div>

              <button 
                type="button" 
                className="btn btn-primary" 
                style={{ fontSize: '0.8rem', padding: '6px 10px', marginTop: '6px' }}
                onClick={handleApplyAi}
              >
                Apply AI Suggestions
              </button>
            </div>
          )}

          {!aiLoading && !aiPreview && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                <FileText size={16} />
                Natural Language AI
              </h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                Click "Pre-Analyze Description" to run a local pattern-matching model. It scans your issue text and recommends categories and priority levels automatically.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
