import os
import json
import requests
import hashlib
from fastapi import FastAPI, HTTPException, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import database as db
from datetime import datetime


app = FastAPI(title="AI-Powered Service Desk API")

@app.on_event("startup")
def on_startup():
    db_file = "service_desk.db"
    db_exists = os.path.exists(db_file)
    db_has_data = False
    
    if db_exists:
        try:
            import sqlite3
            conn = sqlite3.connect(db_file)
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM users")
            count = cursor.fetchone()[0]
            if count > 0:
                db_has_data = True
            conn.close()
        except Exception:
            db_has_data = False

    if not db_exists or not db_has_data:
        print("Database file missing or empty. Auto-seeding database...")
        import seed_db
        try:
            seed_db.download_and_seed()
            print("Database auto-seeded successfully on startup.")
        except Exception as e:
            print(f"Failed to auto-seed database: {e}")


# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins for local development ease
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic Schemas for Requests ---

class TicketCreate(BaseModel):
    summary: str
    description: str
    category_id: Optional[int] = None
    priority: Optional[str] = "P3"
    channel: Optional[str] = "web"
    requester_department: Optional[str] = "Support"
    requester_email: Optional[str] = None
    affected_service: Optional[str] = "general"
    outage_related: Optional[bool] = False

class UserRegister(BaseModel):
    name: str
    employee_id: str
    email: str
    password: str
    department: str
    contact_number: Optional[str] = None

class UserLogin(BaseModel):
    email: str
    password: str

class TicketUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    category_id: Optional[int] = None
    assigned_agent_id: Optional[int] = None
    escalated: Optional[bool] = None
    outage_related: Optional[bool] = None
    resolution_summary: Optional[str] = None

class CommentCreate(BaseModel):
    body: str
    agent_id: Optional[int] = None
    visibility: Optional[str] = "public"
    team: Optional[str] = "Support"

class KBCreate(BaseModel):
    title: str
    content: str
    category_id: int
    tags: Optional[str] = ""

class DraftAnalyzeRequest(BaseModel):
    description: str

# --- Helper function to call Gemini API ---

def call_gemini(api_key: str, prompt: str) -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    headers = {"Content-Type": "application/json"}
    payload = {
        "contents": [{
            "parts": [{"text": prompt}]
        }],
        "generationConfig": {
            "responseMimeType": "application/json"
        }
    }
    
    response = requests.post(url, headers=headers, json=payload, timeout=15)
    if response.status_code == 200:
        result = response.json()
        try:
            return result["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError):
            raise HTTPException(status_code=500, detail="Malformed response structure from Gemini API.")
    else:
        raise HTTPException(
            status_code=response.status_code, 
            detail=f"Gemini API error: {response.text}"
        )

# --- Fallback Mock Analyzer ---

def mock_analyze_ticket(description: str, categories: List[dict]) -> dict:
    desc_lower = description.lower()
    
    # Priority Heuristics
    priority = "P3"
    priority_reason = "Determined normal priority based on standard incident classification."
    outage = False
    
    if any(k in desc_lower for k in ["outage", "down", "critical", "broken for all", "not working for everyone"]):
        priority = "P1"
        priority_reason = "Outage or business-critical issue detected in description."
        outage = True
    elif any(k in desc_lower for k in ["urgent", "vp", "executive", "ceo", "director", "blocking", "cannot work"]):
        priority = "P2"
        priority_reason = "High impact issue or VIP request detected."
    elif any(k in desc_lower for k in ["future", "request", "how to", "question", "install", "upgrade"]):
        priority = "P4"
        priority_reason = "Minor request, question, or enhancement."

    # Department Heuristics
    dept = "IT"
    if any(k in desc_lower for k in ["hr", "human resource", "payroll", "benefits", "danielle from hr"]):
        dept = "HR"
    elif any(k in desc_lower for k in ["finance", "invoice", "billing", "budget", "purchase order"]):
        dept = "Finance"
    elif any(k in desc_lower for k in ["warehouse", "logistics", "shipping", "inventory", "zebra", "shipping station"]):
        dept = "Warehouse"
    elif any(k in desc_lower for k in ["sales", "crm", "lead", "client", "deal"]):
        dept = "Sales"
    elif any(k in desc_lower for k in ["ops", "operations", "facilities"]):
        dept = "Operations"

    # Category Heuristics
    category_id = 1 # Default Access Management
    category_reason = "Matched general keyword mappings."
    
    for cat in categories:
        cat_name = cat["name"].lower()
        if "access" in cat_name or "login" in cat_name or "password" in cat_name or "account" in cat_name:
            if any(k in desc_lower for k in ["password", "lock", "ldap", "credentials", "login", "reset", "access", "permission"]):
                category_id = cat["id"]
                category_reason = f"Keyword matching connected this ticket to '{cat['name']}' due to credential or login references."
                break
        elif "laptop" in cat_name or "endpoint" in cat_name or "hardware" in cat_name:
            if any(k in desc_lower for k in ["laptop", "computer", "macbook", "screen", "keyboard", "battery", "pc"]):
                category_id = cat["id"]
                category_reason = f"Identified hardware keywords. Assigned to '{cat['name']}'."
                break
        elif "vpn" in cat_name or "network" in cat_name or "wifi" in cat_name:
            if any(k in desc_lower for k in ["vpn", "wifi", "network", "internet", "connect", "port", "dns"]):
                category_id = cat["id"]
                category_reason = f"Connection-related issue detected. Assigned to '{cat['name']}'."
                break
        elif "email" in cat_name or "outlook" in cat_name or "slack" in cat_name:
            if any(k in desc_lower for k in ["email", "outlook", "sync", "inbox", "slack", "calendar"]):
                category_id = cat["id"]
                category_reason = f"Collaboration software keywords detected. Routed to '{cat['name']}'."
                break
        elif "erp" in cat_name or "wms" in cat_name or "printer" in cat_name:
            if any(k in desc_lower for k in ["printer", "zebra", "shipping", "warehouse", "erp", "sap"]):
                category_id = cat["id"]
                category_reason = f"Enterprise systems or specialized hardware detected. Routed to '{cat['name']}'."
                break

    # Checklist Heuristics
    checklist = [
        "Acknowledge receipt of the ticket and contact user Danielle for initial details.",
        "Check system status logs for the affected service.",
        "Attempt to reproduce the reported issue in the staging environment.",
        "Document troubleshooting results in internal comments."
    ]
    
    if "printer" in desc_lower:
        checklist = [
            "Check physical USB or network cables and ensure print spooler is active.",
            "Verify drivers are up-to-date via Zebra Setup Utilities.",
            "Reboot the printing station and run a test print job.",
            "If network-connected, verify IP range settings and gateway ping status."
        ]
    elif "password" in desc_lower or "lock" in desc_lower:
        checklist = [
            "Verify username spelling in Active Directory / LDAP.",
            "Check if account status is locked or disabled.",
            "Perform account unlock and generate a temporary password.",
            "Instruct the user to logon on VPN first if testing remotely."
        ]
    elif "vpn" in desc_lower or "wifi" in desc_lower:
        checklist = [
            "Verify the user's internet connection outside the corporate network.",
            "Confirm the VPN client gateway portal setting is set correctly.",
            "Check user credentials and multifactor authentication (MFA) logs.",
            "Reinstall/reset virtual network adapter if protocol errors occur."
        ]

    # Smart Summary Heuristics
    summary = ""
    if "printer" in desc_lower or "zebra" in desc_lower:
        summary = "Zebra Shipping Printer Connection Failure"
    elif "vpn" in desc_lower or "globalprotect" in desc_lower:
        summary = "GlobalProtect VPN Connection Timeout"
    elif "password" in desc_lower or "lock" in desc_lower or "ldap" in desc_lower:
        summary = "AD/LDAP Account Password Reset Request"
    elif "wifi" in desc_lower or "network" in desc_lower:
        summary = "Corporate Wi-Fi Connection Failure"
    elif "outlook" in desc_lower or "email" in desc_lower or "sync" in desc_lower:
        summary = "Outlook Email Sync Failure"
    elif "macbook" in desc_lower or "laptop" in desc_lower:
        summary = "Corporate Laptop Performance Issue"
    else:
        # Fallback to truncated first sentence
        first_sentence = description.split(".")[0].strip()
        if len(first_sentence) > 50:
            summary = first_sentence[:47] + "..."
        else:
            summary = first_sentence


    return {
        "summary": summary,
        "priority": priority,
        "priority_reasoning": f"(Mock Mode) {priority_reason}",
        "category_id": category_id,
        "category_reasoning": f"(Mock Mode) {category_reason}",
        "checklist": checklist,
        "outage_related": outage,
        "requester_department": dept,
        "is_mock": True
    }

# --- Mock Knowledge Base Matching ---

def mock_match_kb(description: str, articles: List[dict]) -> dict:
    desc_lower = description.lower()
    matches = []
    
    # Quick keyword checking for tags or titles
    for art in articles:
        score = 0
        tags = art["tags"].split(",") if art["tags"] else []
        for tag in tags:
            if tag.strip().lower() in desc_lower:
                score += 3
        # Direct word matches in title/content
        words = art["title"].lower().split() + art["content"].lower().split()[:20]
        for word in words:
            if len(word) > 3 and word in desc_lower:
                score += 1
                
        if score > 0:
            matches.append((art, score))
            
    # Sort matches by score descending
    matches.sort(key=lambda x: x[1], reverse=True)
    recommended_ids = [m[0]["id"] for m in matches[:2]]
    
    # Fallback to first two if no matches found
    if not recommended_ids and len(articles) >= 2:
        recommended_ids = [articles[0]["id"], articles[1]["id"]]
        reasoning = "(Mock Mode) Low keyword correlation found. Suggesting general starting articles."
    else:
        reasoning = f"(Mock Mode) Successfully correlated ticket keywords with {len(recommended_ids)} knowledge base article(s)."
        
    return {
        "recommended_article_ids": recommended_ids,
        "reasoning": reasoning
    }


# --- API Routes ---

# --- Authentication Endpoints ---

@app.post("/api/auth/register")
def register_user(user: UserRegister):
    existing = db.get_user_by_email(user.email)
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists.")
        
    pwd_hash = hashlib.sha256(user.password.encode()).hexdigest()
    user_id = db.create_user(
        name=user.name,
        employee_id=user.employee_id,
        email=user.email,
        password_hash=pwd_hash,
        department=user.department,
        contact_number=user.contact_number,
        role="user"
    )
    if not user_id:
        raise HTTPException(status_code=400, detail="Registration failed (duplicate Employee ID).")
    return {"message": "Registration successful.", "user_id": user_id}

@app.post("/api/auth/login")
def login_user(credentials: UserLogin):
    user = db.get_user_by_email(credentials.email)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
        
    pwd_hash = hashlib.sha256(credentials.password.encode()).hexdigest()
    if user["password_hash"] != pwd_hash:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
        
    return {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "employee_id": user["employee_id"],
        "department": user["department"],
        "contact_number": user["contact_number"],
        "role": user["role"]
    }

@app.get("/api/dashboard")
def get_dashboard():
    return db.get_dashboard_stats()

@app.get("/api/tickets")
def get_tickets(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    category_id: Optional[int] = None,
    search: Optional[str] = None,
    requester_email: Optional[str] = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0)
):
    return db.get_tickets(status, priority, category_id, search, requester_email, limit, offset)

@app.get("/api/tickets/{ticket_id}")
def get_ticket(ticket_id: int):
    ticket = db.get_ticket(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found.")
    return ticket

@app.post("/api/tickets", status_code=201)
def create_ticket(ticket: TicketCreate):
    ticket_id = db.create_ticket(
        summary=ticket.summary,
        description=ticket.description,
        category_id=ticket.category_id,
        priority=ticket.priority,
        channel=ticket.channel,
        requester_department=ticket.requester_department,
        affected_service=ticket.affected_service,
        outage_related=ticket.outage_related,
        requester_email=ticket.requester_email
    )
    return {"ticket_id": ticket_id, "message": "Ticket created successfully. AI analysis pending."}

@app.put("/api/tickets/{ticket_id}")
def update_ticket(ticket_id: int, ticket_update: TicketUpdate):
    updates = {k: v for k, v in ticket_update.dict().items() if v is not None}
    
    # If status is changing to resolved, record the resolved_at timestamp
    if updates.get("status") == "resolved":
        updates["resolved_at"] = datetime.now().isoformat()
        if not updates.get("resolution_summary"):
            updates["resolution_summary"] = "Issue resolved by support agent."
            
    success = db.update_ticket(ticket_id, updates)
    if not success:
        raise HTTPException(status_code=404, detail="Ticket not found or no changes made.")
    return {"message": "Ticket updated successfully."}

@app.post("/api/tickets/{ticket_id}/comments", status_code=201)
def add_comment(ticket_id: int, comment: CommentCreate):
    comment_id = db.add_comment(
        ticket_id=ticket_id,
        body=comment.body,
        agent_id=comment.agent_id,
        visibility=comment.visibility,
        team=comment.team
    )
    return {"comment_id": comment_id, "message": "Comment added successfully."}

@app.post("/api/tickets/{ticket_id}/analyze")
def analyze_ticket(ticket_id: int, x_api_key: Optional[str] = Header(None, alias="x-api-key")):
    ticket = db.get_ticket(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found.")
        
    categories = db.get_categories()
    articles = db.get_kb_articles()
    
    # Decide whether to use real Gemini API or Fallback Mock Mode
    api_key = x_api_key or os.environ.get("GEMINI_API_KEY")
    
    if api_key and api_key.strip():
        # --- Real Gemini AI Analysis Flow ---
        try:
            # 1. Analyze Ticket
            cat_list_str = ", ".join([f"id {c['id']}: '{c['name']}'" for c in categories])
            prompt = f"""
            Analyze this support ticket:
            Summary: {ticket['summary']}
            Description: {ticket['description']}
            
            Based on the details, perform the following and return a JSON structure:
            1. Suggest a concise 1-sentence 'summary' (max 80 chars).
            2. Choose the best category from this list: [{cat_list_str}]. Put the selected ID in 'category_id'.
            3. Provide 'category_reasoning' for why this category was chosen.
            4. Recommend a priority level in 'priority' ('P1' for critical service outage, 'P2' for high urgency user blocking, 'P3' for normal operations, 'P4' for inquiries/requests).
            5. Provide 'priority_reasoning'.
            6. Provide a 'checklist' of 3-5 tactical debugging or solution steps as a JSON list of strings.
            7. Identify the requester department in 'department' (Choose from: 'Finance', 'Warehouse', 'IT', 'Sales', 'Operations', 'HR').
            
            Return ONLY the valid JSON structure. Do NOT include markdown blocks.
            Example JSON schema:
            {{
                "summary": "Concise summary",
                "category_id": 1,
                "category_reasoning": "Reason",
                "priority": "P3",
                "priority_reasoning": "Reason",
                "checklist": ["Step 1", "Step 2"],
                "department": "IT"
            }}
            """
            
            response_text = call_gemini(api_key, prompt)
            
            # Clean up the output string to ensure it's valid JSON
            clean_json = response_text.replace("```json", "").replace("```", "").strip()
            analysis = json.loads(clean_json)
            
            # 2. Match KB Articles
            kb_list_str = "\n".join([f"ID: {a['id']}, Title: {a['title']}, Summary: {a['content'][:100]}" for a in articles])
            kb_prompt = f"""
            Identify the top 2 most relevant knowledge base articles from this list to solve this support ticket:
            
            Ticket Description: {ticket['description']}
            
            Knowledge Base articles:
            {kb_list_str}
            
            Return the output in strict JSON format:
            {{
                "recommended_article_ids": [id1, id2],
                "reasoning": "Explain why these articles are relevant."
            }}
            """
            kb_response_text = call_gemini(api_key, kb_prompt)
            clean_kb_json = kb_response_text.replace("```json", "").replace("```", "").strip()
            kb_analysis = json.loads(clean_kb_json)
            
            analysis.update({
                "recommended_article_ids": kb_analysis.get("recommended_article_ids", []),
                "kb_reasoning": kb_analysis.get("reasoning", "Matched via AI semantic search."),
                "is_mock": False
            })
            
        except Exception as e:
            # Fallback to Mock Mode if Gemini API call fails
            print(f"Gemini API request failed ({e}). Falling back to Mock Mode.")
            analysis = mock_analyze_ticket(ticket["description"], categories)
            kb_result = mock_match_kb(ticket["description"], articles)
            analysis.update({
                "recommended_article_ids": kb_result["recommended_article_ids"],
                "kb_reasoning": kb_result["reasoning"],
                "mock_warning": f"AI error occurred: {str(e)}. Activated fallback analysis."
            })
    else:
        # --- Fallback Mock Mode ---
        analysis = mock_analyze_ticket(ticket["description"], categories)
        kb_result = mock_match_kb(ticket["description"], articles)
        analysis.update({
            "recommended_article_ids": kb_result["recommended_article_ids"],
            "kb_reasoning": kb_result["reasoning"]
        })

    # Update Ticket in database
    checklist_str = ";".join(analysis.get("checklist", []))
    db.update_ticket(ticket_id, {
        "priority": analysis.get("priority", ticket["priority"]),
        "category_id": analysis.get("category_id", ticket["category_id"]),
        "ai_summary": analysis.get("summary", ticket["summary"]),
        "ai_priority_reason": analysis.get("priority_reasoning", ""),
        "ai_category_reason": analysis.get("category_reasoning", ""),
        "ai_checklist": checklist_str,
        "outage_related": int(analysis.get("outage_related", ticket["outage_related"])),
        "requester_department": analysis.get("department", ticket["requester_department"])
    })
    
    # Return full analysis details along with recommended article details
    rec_articles = []
    for art in articles:
        if art["id"] in analysis.get("recommended_article_ids", []):
            rec_articles.append(art)
            
    return {
        "summary": analysis.get("summary"),
        "priority": analysis.get("priority"),
        "priority_reasoning": analysis.get("priority_reasoning"),
        "category_id": analysis.get("category_id"),
        "category_reasoning": analysis.get("category_reasoning"),
        "checklist": analysis.get("checklist", []),
        "recommended_articles": rec_articles,
        "kb_reasoning": analysis.get("kb_reasoning"),
        "requester_department": analysis.get("department", ticket["requester_department"]),
        "is_mock": analysis.get("is_mock", False),
        "mock_warning": analysis.get("mock_warning", None)
    }

@app.get("/api/kb")
def get_kb(search: Optional[str] = None):
    return db.get_kb_articles(search)

@app.post("/api/kb", status_code=201)
def create_kb(kb: KBCreate):
    article_id = db.create_kb_article(
        title=kb.title,
        content=kb.content,
        category_id=kb.category_id,
        tags=kb.tags
    )
    return {"article_id": article_id, "message": "Knowledge base article created successfully."}

@app.get("/api/agents")
def get_agents():
    return db.get_agents()

@app.get("/api/categories")
def get_categories():
    return db.get_categories()

@app.post("/api/tickets/analyze-draft")
def analyze_draft(request: DraftAnalyzeRequest, x_api_key: Optional[str] = Header(None, alias="x-api-key")):
    categories = db.get_categories()
    api_key = x_api_key or os.environ.get("GEMINI_API_KEY")
    
    if api_key and api_key.strip():
        try:
            cat_list_str = ", ".join([f"id {c['id']}: '{c['name']}'" for c in categories])
            prompt = f"""
            Analyze this support ticket draft description:
            Description: {request.description}
            
            Based on the details, suggest classification routing, priority, and requester department:
            1. Suggest a concise 1-sentence 'summary' (max 80 chars).
            2. Choose the best category from this list: [{cat_list_str}]. Put the selected ID in 'category_id'.
            3. Recommended priority in 'priority' ('P1' critical outage, 'P2' high urgency blocking, 'P3' normal, 'P4' minor request).
            4. Recommend the requester department in 'department' (Choose from: 'Finance', 'Warehouse', 'IT', 'Sales', 'Operations', 'HR').
            
            Return ONLY the valid JSON structure matching this schema:
            {{
                "summary": "Concise summary",
                "category_id": 1,
                "priority": "P3",
                "department": "IT"
            }}
            """
            response_text = call_gemini(api_key, prompt)
            clean_json = response_text.replace("```json", "").replace("```", "").strip()
            analysis = json.loads(clean_json)
            
            cat_name = "Access Management"
            for c in categories:
                if c["id"] == analysis.get("category_id"):
                    cat_name = c["name"]
                    break
                    
            return {
                "summary": analysis.get("summary", ""),
                "category_id": analysis.get("category_id"),
                "category_name": cat_name,
                "priority": analysis.get("priority", "P3"),
                "requester_department": analysis.get("department", "IT"),
                "is_mock": False
            }
        except Exception as e:
            print(f"Draft AI analysis failed: {e}")
            mock_res = mock_analyze_ticket(request.description, categories)
            cat_name = "Access Management"
            for c in categories:
                if c["id"] == mock_res.get("category_id"):
                    cat_name = c["name"]
                    break
            return {
                "summary": mock_res.get("summary"),
                "category_id": mock_res.get("category_id"),
                "category_name": cat_name,
                "priority": mock_res.get("priority"),
                "requester_department": mock_res.get("requester_department", "IT"),
                "is_mock": True,
                "warning": f"AI error occurred: {str(e)}"
            }
    else:
        mock_res = mock_analyze_ticket(request.description, categories)
        cat_name = "Access Management"
        for c in categories:
            if c["id"] == mock_res.get("category_id"):
                cat_name = c["name"]
                break
        return {
            "summary": mock_res.get("summary"),
            "category_id": mock_res.get("category_id"),
            "category_name": cat_name,
            "priority": mock_res.get("priority"),
            "requester_department": mock_res.get("requester_department", "IT"),
            "is_mock": True
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
