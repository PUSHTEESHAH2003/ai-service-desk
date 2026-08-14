import React, { useState, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight, Filter, AlertTriangle, ArrowUpDown } from 'lucide-react';

export default function TicketList({ onSelectTicket, requesterEmail }) {
  const [tickets, setTickets] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter States
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [categoryId, setCategoryId] = useState('');
  
  // Pagination
  const [page, setPage] = useState(0);
  const limit = 15;

  // Fetch Categories
  useEffect(() => {
    fetch('/api/categories')
      .then(res => res.json())
      .then(data => setCategories(data))
      .catch(err => console.error("Error fetching categories:", err));
  }, []);

  // Fetch Tickets
  const fetchTickets = () => {
    setLoading(true);
    const offset = page * limit;
    
    // Build query params
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString()
    });
    
    if (status) params.append('status', status);
    if (priority) params.append('priority', priority);
    if (categoryId) params.append('category_id', categoryId);
    if (search) params.append('search', search);
    if (requesterEmail) params.append('requester_email', requesterEmail);

    fetch(`/api/tickets?${params.toString()}`)
      .then(res => {
        if (!res.ok) throw new Error("Could not fetch tickets");
        return res.json();
      })
      .then(data => {
        setTickets(data.tickets);
        setTotalCount(data.total_count);
        setError(null);
      })
      .catch(err => {
        console.error(err);
        setError("Error loading support tickets. Please retry.");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchTickets();
  }, [page, status, priority, categoryId]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(0);
    fetchTickets();
  };

  const handleResetFilters = () => {
    setSearch('');
    setStatus('');
    setPriority('');
    setCategoryId('');
    setPage(0);
  };

  const totalPages = Math.ceil(totalCount / limit);

  // Helper to format date
  const formatDate = (dateStr) => {
    try {
      const d = new Date(dateStr.replace(" ", "T"));
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h2>{requesterEmail ? 'My Support Incidents' : 'Incident Workbench'}</h2>
          <p className="page-title-desc">
            {requesterEmail 
              ? 'Track, update, and review resolutions for your reported incidents' 
              : 'Search, filter, and assign active support requests'}
          </p>
        </div>
        <button className="btn btn-secondary" onClick={handleResetFilters}>Reset Filters</button>
      </div>

      {/* Filter Toolbar Card */}
      <div className="card" style={{ padding: '16px', marginBottom: '20px' }}>
        <form onSubmit={handleSearchSubmit} className="filters-panel">
          {/* Keyword Search */}
          <div style={{ position: 'relative', display: 'flex', flexGrow: 1, minWidth: '240px' }}>
            <Search 
              size={18} 
              color="var(--text-muted)" 
              style={{ position: 'absolute', left: '14px', top: '13px' }} 
            />
            <input
              type="text"
              placeholder="Search by keywords..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-text"
              style={{ paddingLeft: '40px', width: '100%', borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
            />
            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
            >
              Search
            </button>
          </div>

          {/* Status Filter */}
          <select 
            className="select-filter" 
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(0); }}
          >
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
          </select>

          {/* Priority Filter */}
          <select 
            className="select-filter" 
            value={priority}
            onChange={(e) => { setPriority(e.target.value); setPage(0); }}
          >
            <option value="">All Priorities</option>
            <option value="P1">P1 (Critical)</option>
            <option value="P2">P2 (High)</option>
            <option value="P3">P3 (Medium)</option>
            <option value="P4">P4 (Low)</option>
          </select>

          {/* Category Filter */}
          <select 
            className="select-filter" 
            value={categoryId}
            onChange={(e) => { setCategoryId(e.target.value); setPage(0); }}
          >
            <option value="">All Categories</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </form>
      </div>

      {error && (
        <div className="card" style={{ borderColor: 'var(--color-danger)', color: 'var(--text-p1)', marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <AlertTriangle size={18} />
            <div>{error}</div>
          </div>
        </div>
      )}

      {/* Tickets Table */}
      <div className="table-container">
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }} className="pulse">
            Fetching ticket records...
          </div>
        ) : tickets.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No incident tickets found matching these search criteria.
          </div>
        ) : (
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{ width: '80px' }}>ID</th>
                <th>Summary</th>
                <th>Category</th>
                <th>Assigned Agent</th>
                <th>Dept</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map(t => (
                <tr key={t.ticket_id} onClick={() => onSelectTicket(t.ticket_id)}>
                  <td>
                    <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                      #{t.ticket_id}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500, color: '#fff', marginBottom: '4px' }}>
                      {t.summary}
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {t.outage_related === 1 && (
                        <span className="badge badge-outage">Outage</span>
                      )}
                      {t.escalated === 1 && (
                        <span className="badge badge-escalated">Escalated</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {t.category_name || "Unassigned"}
                    </span>
                  </td>
                  <td>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                      {t.assigned_agent_name || "—"}
                    </span>
                  </td>
                  <td>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {t.requester_department}
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge-${t.priority.toLowerCase()}`}>
                      {t.priority}
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge-${t.status === 'in_progress' ? 'progress' : t.status}`}>
                      {t.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {formatDate(t.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Bar */}
      {!loading && tickets.length > 0 && (
        <div className="pagination">
          <div>
            Showing <span style={{ color: '#fff', fontWeight: 600 }}>{page * limit + 1}</span> to <span style={{ color: '#fff', fontWeight: 600 }}>{Math.min((page + 1) * limit, totalCount)}</span> of <span style={{ color: '#fff', fontWeight: 600 }}>{totalCount}</span> tickets
          </div>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              className="btn btn-secondary" 
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              style={{ padding: '6px 12px' }}
            >
              <ChevronLeft size={16} />
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              style={{ padding: '6px 12px' }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
