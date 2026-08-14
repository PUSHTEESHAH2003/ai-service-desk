import React, { useState, useEffect } from 'react';
import { BookOpen, Search, Plus, ArrowLeft, Tag, FileText, AlertTriangle } from 'lucide-react';

export default function KnowledgeBase() {
  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Read view
  const [selectedArticle, setSelectedArticle] = useState(null);
  
  // Write view
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [tags, setTags] = useState('');

  const fetchArticles = () => {
    setLoading(true);
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    fetch(`/api/kb${query}`)
      .then(res => {
        if (!res.ok) throw new Error("Failed to load knowledge base");
        return res.json();
      })
      .then(data => {
        setArticles(data);
        setError(null);
      })
      .catch(err => {
        console.error(err);
        setError("Error fetching knowledge base articles.");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchArticles();
  }, [search]);

  useEffect(() => {
    fetch('/api/categories')
      .then(res => res.json())
      .then(data => setCategories(data));
  }, []);

  const handleSubmitArticle = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim() || !categoryId) {
      alert("Please fill in Title, Content, and select a Category.");
      return;
    }

    try {
      const res = await fetch('/api/kb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          category_id: parseInt(categoryId),
          tags
        })
      });
      if (!res.ok) throw new Error("Failed to save article");
      
      // Reset form
      setTitle('');
      setContent('');
      setCategoryId('');
      setTags('');
      setShowAddForm(false);
      fetchArticles();
      alert("Knowledge Base Article saved successfully.");
    } catch (err) {
      alert(err.message);
    }
  };

  if (selectedArticle) {
    return (
      <div className="fade-in">
        <button 
          className="btn btn-secondary" 
          onClick={() => setSelectedArticle(null)} 
          style={{ marginBottom: '20px' }}
        >
          <ArrowLeft size={16} /> Back to Library
        </button>

        <div className="card">
          <span className="badge badge-p3" style={{ marginBottom: '12px' }}>
            Category: {selectedArticle.category_name}
          </span>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '16px' }}>{selectedArticle.title}</h2>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <Tag size={12} /> Keywords:
            </span>
            {selectedArticle.tags ? selectedArticle.tags.split(',').map((t, idx) => (
              <span key={idx} className="kb-tag">{t.trim()}</span>
            )) : <span className="kb-tag">None</span>}
          </div>

          <div style={{ fontSize: '1rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: '1.7' }}>
            {selectedArticle.content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h2>Knowledge Base Library</h2>
          <p className="page-title-desc">Search technical articles, SOPs, and troubleshooting guides</p>
        </div>
        {!showAddForm ? (
          <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>
            <Plus size={16} /> Add Article
          </button>
        ) : (
          <button className="btn btn-secondary" onClick={() => setShowAddForm(false)}>
            Cancel Add
          </button>
        )}
      </div>

      {showAddForm ? (
        <form onSubmit={handleSubmitArticle} className="card fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '800px', margin: '0 auto' }}>
          <h3>Create Knowledge Base Document</h3>
          
          <div className="form-group">
            <label className="form-label">Article Title</label>
            <input
              type="text"
              placeholder="e.g. Cisco Packet Tracer configuration reset"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-text"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Category Routing</label>
            <select
              className="select-filter"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
            >
              <option value="">Select Category...</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Article Contents (Markdown/Plaintext)</label>
            <textarea
              placeholder="Provide a step-by-step resolution checklist or troubleshooting procedure..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="form-textarea"
              style={{ minHeight: '200px' }}
              required
            ></textarea>
          </div>

          <div className="form-group">
            <label className="form-label">Search Tags / Keywords (Comma separated)</label>
            <input
              type="text"
              placeholder="e.g. cisco, network, config, reset"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="input-text"
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
            Publish Article
          </button>
        </form>
      ) : (
        <div>
          {/* Search bar */}
          <div className="card" style={{ padding: '16px', marginBottom: '20px' }}>
            <div style={{ position: 'relative', display: 'flex', width: '100%' }}>
              <Search 
                size={18} 
                color="var(--text-muted)" 
                style={{ position: 'absolute', left: '14px', top: '13px' }} 
              />
              <input
                type="text"
                placeholder="Search troubleshooting documents by title, contents, or tags..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-text"
                style={{ paddingLeft: '40px', width: '100%' }}
              />
            </div>
          </div>

          {error && (
            <div className="card" style={{ borderColor: 'var(--color-danger)', color: 'var(--text-p1)', marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <AlertTriangle size={18} />
                <div>{error}</div>
              </div>
            </div>
          )}

          {/* Articles Library grid */}
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }} className="pulse">
              Loading technical articles...
            </div>
          ) : articles.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No support articles found matching your query.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {articles.map(art => (
                <div key={art.id} className="kb-card" onClick={() => setSelectedArticle(art)}>
                  <span className="badge badge-p3" style={{ fontSize: '0.65rem', padding: '2px 8px', marginBottom: '8px' }}>
                    {art.category_name}
                  </span>
                  <h3 style={{ fontSize: '1.15rem', margin: '4px 0 8px', color: '#fff' }}>{art.title}</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', minHeight: '52px' }}>
                    {art.content}
                  </p>
                  
                  {art.tags && (
                    <div className="kb-tags">
                      {art.tags.split(',').slice(0, 3).map((tag, idx) => (
                        <span key={idx} className="kb-tag">{tag.trim()}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
