import React, { useEffect, useState } from 'react';
import { 
  BarChart3, 
  Layers, 
  Clock, 
  AlertTriangle, 
  Flame, 
  CheckCircle2, 
  TrendingUp, 
  HelpCircle 
} from 'lucide-react';

export default function Dashboard({ onViewTicket }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/dashboard');
      if (!res.ok) throw new Error('Failed to fetch dashboard stats');
      const data = await res.json();
      setStats(data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Could not connect to backend server. Ensure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Poll every 30 seconds for live updates
    const timer = setInterval(fetchStats, 30000);
    return () => clearInterval(timer);
  }, []);

  if (loading && !stats) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
        <div className="pulse" style={{ color: 'var(--text-secondary)' }}>Loading Dashboard Analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card fade-in" style={{ borderColor: 'var(--color-danger)', textAlign: 'center', padding: '40px' }}>
        <AlertTriangle size={48} color="var(--color-danger)" style={{ marginBottom: '16px' }} />
        <h3>Connection Error</h3>
        <p style={{ color: 'var(--text-secondary)', margin: '8px 0 20px' }}>{error}</p>
        <button className="btn btn-secondary" onClick={fetchStats}>Retry Connection</button>
      </div>
    );
  }

  const {
    total_tickets,
    status_counts,
    priority_counts,
    outage_count,
    escalated_count,
    sla_breach_count,
    avg_resolution_hours,
    dept_breakdown,
    category_breakdown
  } = stats;

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h2>Analytics Dashboard</h2>
          <p className="page-title-desc">Real-time support operations overview and SLA monitoring</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchStats}>Refresh Data</button>
      </div>

      {/* KPI Cards Grid */}
      <div className="dashboard-grid">
        <div className="card kpi-card">
          <div className="kpi-icon primary">
            <Layers size={22} />
          </div>
          <div>
            <div className="kpi-label">Active Incidents</div>
            <div className="kpi-value">{(status_counts.open || 0) + (status_counts.in_progress || 0)}</div>
          </div>
        </div>

        <div className="card kpi-card">
          <div className="kpi-icon warning">
            <Clock size={22} />
          </div>
          <div>
            <div className="kpi-label">Avg Resolution Time</div>
            <div className="kpi-value">{avg_resolution_hours}h</div>
          </div>
        </div>

        <div className="card kpi-card">
          <div className="kpi-icon success">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div className="kpi-label">Resolved Tickets</div>
            <div className="kpi-value">{status_counts.resolved || 0}</div>
          </div>
        </div>

        <div className="card kpi-card">
          <div className="kpi-icon danger">
            <AlertTriangle size={22} />
          </div>
          <div>
            <div className="kpi-label">SLA Breaches</div>
            <div className="kpi-value">{sla_breach_count}</div>
          </div>
        </div>
      </div>

      {/* Operational Highlights */}
      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', marginBottom: '28px' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', borderLeft: '3px solid #ef4444' }}>
          <Flame size={32} color="#ef4444" />
          <div>
            <h4 style={{ margin: 0 }}>{outage_count} Outage Events</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Incidents marked as business-critical service disruptions</p>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', borderLeft: '3px solid #f59e0b' }}>
          <TrendingUp size={32} color="#f59e0b" />
          <div>
            <h4 style={{ margin: 0 }}>{escalated_count} Escalated Tickets</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Incidents actively escalated to higher tier support teams</p>
          </div>
        </div>
      </div>

      {/* Chart Layout */}
      <div className="charts-container">
        {/* Category breakdown */}
        <div className="card">
          <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BarChart3 size={20} color="var(--color-primary)" />
            Incidents by Classification Category
          </h3>
          
          <div className="bar-chart-container">
            {category_breakdown.map((cat, idx) => {
              const maxVal = category_breakdown[0]?.count || 1;
              const percent = (cat.count / maxVal) * 100;
              return (
                <div key={idx} className="bar-row">
                  <div className="bar-label" title={cat.category}>{cat.category}</div>
                  <div className="bar-outer">
                    <div className="bar-inner" style={{ width: `${percent}%` }}></div>
                  </div>
                  <div className="bar-value">{cat.count}</div>
                </div>
              );
            })}
            {category_breakdown.length === 0 && (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No categories tracked yet</p>
            )}
          </div>
        </div>

        {/* Department breakdown */}
        <div className="card">
          <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <HelpCircle size={20} color="var(--color-secondary)" />
            Top Departments
          </h3>
          
          <div className="bar-chart-container">
            {dept_breakdown.slice(0, 5).map((dept, idx) => {
              const maxVal = dept_breakdown[0]?.count || 1;
              const percent = (dept.count / maxVal) * 100;
              return (
                <div key={idx} className="bar-row">
                  <div className="bar-label" title={dept.department}>{dept.department}</div>
                  <div className="bar-outer">
                    <div className="bar-inner" style={{ 
                      width: `${percent}%`, 
                      background: 'linear-gradient(90deg, var(--color-secondary), var(--color-accent))' 
                    }}></div>
                  </div>
                  <div className="bar-value">{dept.count}</div>
                </div>
              );
            })}
            {dept_breakdown.length === 0 && (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No departments logged yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
