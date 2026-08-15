import sqlite3
import hashlib
from datetime import datetime

import os
DB_PATH = "/data/service_desk.db" if os.environ.get("RENDER") else "service_desk.db"


def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# Helper to convert sqlite Row to dict
def to_dict(row):
    return dict(row) if row else None

# Helper to convert list of sqlite Rows to list of dicts
def to_dict_list(rows):
    return [dict(r) for r in rows]

# --- Categories & Agents ---

def get_categories():
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM categories ORDER BY name ASC")
        return to_dict_list(cursor.fetchall())

def get_agents():
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM agents ORDER BY name ASC")
        return to_dict_list(cursor.fetchall())

# --- Dashboard Stats ---

def get_dashboard_stats():
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # 1. Total tickets
        cursor.execute("SELECT COUNT(*) FROM tickets")
        total_tickets = cursor.fetchone()[0]
        
        # 2. Status counts
        cursor.execute("SELECT status, COUNT(*) FROM tickets GROUP BY status")
        status_counts = {r[0]: r[1] for r in cursor.fetchall()}
        for s in ["open", "in_progress", "resolved"]:
            if s not in status_counts:
                status_counts[s] = 0
                
        # 3. Priority counts
        cursor.execute("SELECT priority, COUNT(*) FROM tickets GROUP BY priority")
        priority_counts = {r[0]: r[1] for r in cursor.fetchall()}
        for p in ["P1", "P2", "P3", "P4"]:
            if p not in priority_counts:
                priority_counts[p] = 0

        # 4. Outage and Escalation counts
        cursor.execute("SELECT SUM(CASE WHEN outage_related = 1 THEN 1 ELSE 0 END), SUM(CASE WHEN escalated = 1 THEN 1 ELSE 0 END) FROM tickets")
        outage_count, escalated_count = cursor.fetchone()
        outage_count = outage_count or 0
        escalated_count = escalated_count or 0

        # 5. SLA Breach count
        cursor.execute("SELECT COUNT(*) FROM sla_breaches")
        sla_breach_count = cursor.fetchone()[0]
        
        # 6. Average Resolution Time (in hours)
        # Parse timestamps and compute difference in python to avoid sqlite string date differences
        cursor.execute("SELECT created_at, resolved_at FROM tickets WHERE status = 'resolved' AND resolved_at IS NOT NULL")
        resolved_tickets = cursor.fetchall()
        
        total_hours = 0.0
        count_resolved = 0
        for created, resolved in resolved_tickets:
            try:
                # Strip microsecond precision if needed for parsing
                created_dt = datetime.fromisoformat(created.split(".")[0])
                resolved_dt = datetime.fromisoformat(resolved.split(".")[0])
                diff = resolved_dt - created_dt
                total_hours += diff.total_seconds() / 3600.0
                count_resolved += 1
            except Exception as e:
                pass # Parse error fallback
                
        avg_resolution_hours = round(total_hours / count_resolved, 2) if count_resolved > 0 else 0.0

        # 7. Department breakdown
        cursor.execute("SELECT requester_department, COUNT(*) as count FROM tickets GROUP BY requester_department ORDER BY count DESC")
        dept_breakdown = [{"department": r[0], "count": r[1]} for r in cursor.fetchall() if r[0]]

        # 8. Category breakdown
        cursor.execute("""
            SELECT c.name, COUNT(t.ticket_id) as count 
            FROM tickets t
            JOIN categories c ON t.category_id = c.id
            GROUP BY c.name
            ORDER BY count DESC
        """)
        category_breakdown = [{"category": r[0], "count": r[1]} for r in cursor.fetchall()]

        return {
            "total_tickets": total_tickets,
            "status_counts": status_counts,
            "priority_counts": priority_counts,
            "outage_count": outage_count,
            "escalated_count": escalated_count,
            "sla_breach_count": sla_breach_count,
            "avg_resolution_hours": avg_resolution_hours,
            "dept_breakdown": dept_breakdown,
            "category_breakdown": category_breakdown
        }

# --- Ticket Operations ---

def get_tickets(status=None, priority=None, category_id=None, search=None, requester_email=None, limit=20, offset=0):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Base query joining categories and agents
        query = """
            SELECT t.*, c.name as category_name, a.name as assigned_agent_name
            FROM tickets t
            LEFT JOIN categories c ON t.category_id = c.id
            LEFT JOIN agents a ON t.assigned_agent_id = a.id
            WHERE 1=1
        """
        params = []
        
        if requester_email:
            query += " AND t.requester_email = ?"
            params.append(requester_email)
        
        if status:
            query += " AND t.status = ?"
            params.append(status)
        if priority:
            query += " AND t.priority = ?"
            params.append(priority)
        if category_id:
            query += " AND t.category_id = ?"
            params.append(category_id)
        if search:
            query += " AND (t.summary LIKE ? OR t.description LIKE ?)"
            params.append(f"%{search}%")
            params.append(f"%{search}%")
            
        # Get total filtered count
        count_query = f"SELECT COUNT(*) FROM ({query})"
        cursor.execute(count_query, params)
        total_count = cursor.fetchone()[0]
        
        # Add order by and pagination
        # Put recent tickets at the top
        query += " ORDER BY t.created_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        
        cursor.execute(query, params)
        tickets = to_dict_list(cursor.fetchall())
        
        return {
            "tickets": tickets,
            "total_count": total_count,
            "limit": limit,
            "offset": offset
        }

def get_ticket(ticket_id):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # 1. Fetch Ticket details
        cursor.execute("""
            SELECT t.*, c.name as category_name, a.name as assigned_agent_name, a.team as assigned_agent_team
            FROM tickets t
            LEFT JOIN categories c ON t.category_id = c.id
            LEFT JOIN agents a ON t.assigned_agent_id = a.id
            WHERE t.ticket_id = ?
        """, (ticket_id,))
        ticket = to_dict(cursor.fetchone())
        
        if not ticket:
            return None
            
        # 2. Fetch Comments
        cursor.execute("""
            SELECT c.*, a.name as agent_name
            FROM comments c
            LEFT JOIN agents a ON c.agent_id = a.id
            WHERE c.ticket_id = ?
            ORDER BY c.created_at ASC
        """, (ticket_id,))
        comments = to_dict_list(cursor.fetchall())
        
        # 3. Fetch SLA Breach details (if any)
        cursor.execute("SELECT * FROM sla_breaches WHERE ticket_id = ?", (ticket_id,))
        sla_breach = to_dict(cursor.fetchone())
        
        ticket["comments"] = comments
        ticket["sla_breach"] = sla_breach
        
        return ticket

def create_ticket(summary, description, category_id=None, priority="P3", 
                  channel="web", requester_department="Support", 
                  affected_service="general", outage_related=False,
                  requester_email=None):
    created_at = datetime.now().isoformat()
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO tickets (
                created_at, priority, status, channel, category_id,
                requester_department, requester_email, affected_service, summary, description,
                escalated, outage_related
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
        """, (created_at, priority, "open", channel, category_id, 
              requester_department, requester_email, affected_service, summary, description, int(outage_related)))
        conn.commit()
        return cursor.lastrowid

def update_ticket(ticket_id, updates):
    """
    updates is a dict containing fields to update, e.g.:
    {
      'status': 'in_progress',
      'priority': 'P2',
      'assigned_agent_id': 3,
      'escalated': True,
      'resolution_summary': 'Solved details...',
      'resolved_at': '2026-08-14...'
    }
    """
    if not updates:
        return False
        
    set_clauses = []
    params = []
    for key, value in updates.items():
        # Clean inputs and verify columns
        if key in ["status", "priority", "category_id", "assigned_agent_id", 
                   "escalated", "outage_related", "resolution_summary", "resolved_at",
                   "ai_summary", "ai_priority_reason", "ai_category_reason", "ai_checklist",
                   "requester_department", "requester_email"]:
            set_clauses.append(f"{key} = ?")
            # If value is boolean, cast to int for sqlite
            if isinstance(value, bool):
                value = int(value)
            params.append(value)
            
    if not set_clauses:
        return False
        
    params.append(ticket_id)
    query = f"UPDATE tickets SET {', '.join(set_clauses)} WHERE ticket_id = ?"
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        conn.commit()
        return cursor.rowcount > 0

def add_comment(ticket_id, body, agent_id=None, visibility="public", team="Support"):
    created_at = datetime.now().isoformat()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO comments (ticket_id, agent_id, created_at, visibility, team, body)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (ticket_id, agent_id, created_at, visibility, team, body))
        conn.commit()
        return cursor.lastrowid

# --- Knowledge Base Operations ---

def get_kb_articles(search=None):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        query = """
            SELECT k.*, c.name as category_name
            FROM knowledge_base k
            LEFT JOIN categories c ON k.category_id = c.id
            WHERE 1=1
        """
        params = []
        if search:
            query += " AND (k.title LIKE ? OR k.content LIKE ? OR k.tags LIKE ?)"
            term = f"%{search}%"
            params.extend([term, term, term])
            
        query += " ORDER BY k.title ASC"
        cursor.execute(query, params)
        return to_dict_list(cursor.fetchall())

def create_kb_article(title, content, category_id, tags=""):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO knowledge_base (title, content, category_id, tags)
            VALUES (?, ?, ?, ?)
        """, (title, content, category_id, tags))
        conn.commit()
        return cursor.lastrowid


# --- User Operations & Authentication ---

def create_user(name, employee_id, email, password_hash, department, contact_number=None, role="user"):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute("""
                INSERT INTO users (name, employee_id, email, password_hash, department, contact_number, role)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (name, employee_id, email, password_hash, department, contact_number, role))
            conn.commit()
            return cursor.lastrowid
        except sqlite3.IntegrityError as e:
            return None

def get_user_by_email(email):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
        return to_dict(cursor.fetchone())
