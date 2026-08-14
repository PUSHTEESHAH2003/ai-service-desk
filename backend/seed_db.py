import os
import sqlite3
import pandas as pd
import requests

DB_PATH = "service_desk.db"
BASE_URL = "https://huggingface.co/datasets/mindweave/help-desk-tickets/resolve/main/data/"

files = {
    "agents": "agents.csv",
    "categories": "categories.csv",
    "tickets": "tickets.csv",
    "comments": "comments.csv",
    "sla_breaches": "sla_breaches.csv"
}

def create_schema(conn):
    cursor = conn.cursor()
    
    # 1. Agents Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS agents (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        team TEXT NOT NULL
    )""")
    
    # 2. Categories Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        service TEXT NOT NULL
    )""")
    
    # 3. Tickets Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS tickets (
        ticket_id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        first_response_at TEXT,
        resolved_at TEXT,
        priority TEXT NOT NULL,
        status TEXT NOT NULL,
        channel TEXT NOT NULL,
        category_id INTEGER,
        assigned_agent_id INTEGER,
        requester_department TEXT,
        requester_email TEXT,
        affected_service TEXT,
        summary TEXT NOT NULL,
        description TEXT NOT NULL,
        escalated BOOLEAN DEFAULT 0,
        outage_related BOOLEAN DEFAULT 0,
        resolution_summary TEXT,
        ai_summary TEXT,
        ai_priority_reason TEXT,
        ai_category_reason TEXT,
        ai_checklist TEXT,
        FOREIGN KEY (category_id) REFERENCES categories(id),
        FOREIGN KEY (assigned_agent_id) REFERENCES agents(id)
    )""")
    
    # 4. Comments Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS comments (
        comment_id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL,
        agent_id INTEGER,
        created_at TEXT NOT NULL,
        visibility TEXT NOT NULL,
        team TEXT,
        body TEXT NOT NULL,
        FOREIGN KEY (ticket_id) REFERENCES tickets(ticket_id),
        FOREIGN KEY (agent_id) REFERENCES agents(id)
    )""")
    
    # 5. SLA Breaches Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sla_breaches (
        breach_id INTEGER PRIMARY KEY,
        ticket_id INTEGER NOT NULL,
        breach_type TEXT NOT NULL,
        sla_target_hours REAL NOT NULL,
        actual_hours REAL NOT NULL,
        breach_minutes INTEGER NOT NULL,
        FOREIGN KEY (ticket_id) REFERENCES tickets(ticket_id)
    )""")
    
    # 6. Knowledge Base Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS knowledge_base (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        category_id INTEGER,
        tags TEXT,
        FOREIGN KEY (category_id) REFERENCES categories(id)
    )""")
    
    # 7. Users Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        employee_id TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        department TEXT NOT NULL,
        contact_number TEXT,
        role TEXT NOT NULL DEFAULT 'user'
    )""")
    
    conn.commit()
    print("Database tables created successfully.")

def download_and_seed():
    if os.path.exists(DB_PATH):
        print(f"Database already exists at {DB_PATH}. Removing to reseed...")
        os.remove(DB_PATH)
        
    conn = sqlite3.connect(DB_PATH)
    create_schema(conn)
    
    # Download and load CSVs using Pandas
    dfs = {}
    for name, file_path in files.items():
        url = BASE_URL + file_path
        print(f"Downloading {name} from {url}...")
        try:
            # We download full categories and agents since they are small
            if name in ["categories", "agents"]:
                dfs[name] = pd.read_csv(url)
            elif name == "tickets":
                # Only load the first 300 tickets for the sample
                dfs[name] = pd.read_csv(url, nrows=300)
            elif name == "comments":
                # Comments might be large, load them in chunk/full and we filter later
                dfs[name] = pd.read_csv(url)
            elif name == "sla_breaches":
                dfs[name] = pd.read_csv(url)
        except Exception as e:
            print(f"Error loading {name}: {e}")
            return

    # Seed Agents
    print("Seeding Agents...")
    dfs["agents"].to_sql("agents", conn, if_exists="append", index=False)
    
    # Seed Categories
    print("Seeding Categories...")
    dfs["categories"].to_sql("categories", conn, if_exists="append", index=False)
    
    # Seed Users
    print("Seeding Users...")
    import hashlib
    def get_hash(pwd):
        return hashlib.sha256(pwd.encode()).hexdigest()
        
    cursor = conn.cursor()
    # 1. Technical Head Admin Account
    cursor.execute("""
        INSERT INTO users (name, employee_id, email, password_hash, department, contact_number, role)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, ("Danielle (Technical Head)", "EMP001", "admin@company.com", get_hash("admin"), "IT", "+1-555-0199", "technical_head"))
    
    # 2. Normal Employee Account
    cursor.execute("""
        INSERT INTO users (name, employee_id, email, password_hash, department, contact_number, role)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, ("Danielle (Employee)", "EMP002", "employee@company.com", get_hash("password"), "Finance", "+1-555-0100", "user"))
    
    # 3. Additional normal employee
    cursor.execute("""
        INSERT INTO users (name, employee_id, email, password_hash, department, contact_number, role)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, ("Sarah Jenkins", "EMP003", "sarah@company.com", get_hash("password"), "HR", "+1-555-0145", "user"))
    
    conn.commit()
    
    # Seed Tickets
    print("Seeding Tickets...")
    # Add AI placeholder columns to the DataFrame
    tickets_df = dfs["tickets"].copy()
    tickets_df["resolution_summary"] = None
    tickets_df["ai_summary"] = None
    tickets_df["ai_priority_reason"] = None
    tickets_df["ai_category_reason"] = None
    tickets_df["ai_checklist"] = None
    tickets_df["requester_email"] = "external@company.com"
    
    # Associate first 15 tickets to employee@company.com and set department to Finance
    tickets_df.loc[0:14, "requester_email"] = "employee@company.com"
    tickets_df.loc[0:14, "requester_department"] = "Finance"
    
    tickets_df.to_sql("tickets", conn, if_exists="append", index=False)
    
    # Filter comments for the 300 tickets we loaded
    print("Filtering and Seeding Comments...")
    ticket_ids = set(tickets_df["ticket_id"])
    comments_df = dfs["comments"]
    comments_filtered = comments_df[comments_df["ticket_id"].isin(ticket_ids)]
    comments_filtered.to_sql("comments", conn, if_exists="append", index=False)
    
    # Filter SLA Breaches for the 300 tickets
    print("Filtering and Seeding SLA Breaches...")
    breaches_df = dfs["sla_breaches"]
    breaches_filtered = breaches_df[breaches_df["ticket_id"].isin(ticket_ids)]
    breaches_filtered.to_sql("sla_breaches", conn, if_exists="append", index=False)
    
    # Seed Knowledge Base
    print("Seeding Knowledge Base articles...")
    kb_articles = [
        # Access Management (ID: 1)
        {
            "title": "Resetting Password in Active Directory (AD)",
            "content": "To reset a user password in AD:\n1. Open 'Active Directory Users and Computers'.\n2. Search for the user using their username or full name.\n3. Right-click the user account and select 'Reset Password...'.\n4. Type and confirm the temporary password.\n5. Select 'User must change password at next logon' to enforce security.\n6. Click OK and notify the user.",
            "category_id": 1,
            "tags": "ad,password,reset,credentials,login"
        },
        {
            "title": "Unlocking Account via LDAP / Admin Console",
            "content": "If a user receives a 'Locked Out' error:\n1. Access the Okta/LDAP admin dashboard.\n2. Locate the user profile.\n3. Verify if status is 'Suspended' or 'Locked'.\n4. Click 'Unlock Account'.\n5. Ask user to wait 2 minutes and retry connection over corporate VPN.",
            "category_id": 1,
            "tags": "okta,lockout,ldap,login,access"
        },
        # Laptop / Endpoint (ID: 2)
        {
            "title": "Troubleshooting MacBook Wi-Fi Disconnections",
            "content": "If a MacBook frequently drops from corporate Wi-Fi:\n1. Go to System Settings -> Wi-Fi -> Details -> Forget This Network.\n2. Turn Wi-Fi Off and On again.\n3. Re-connect to corporate Wi-Fi using Enterprise credentials.\n4. If issue persists, open Terminal and run: `sudo killall -9 directoryserverd` and restart the machine.",
            "category_id": 2,
            "tags": "mac,wifi,network,wireless,apple"
        },
        {
            "title": "Clearing Disk Space on Windows Laptops",
            "content": "To resolve slow performance and low disk errors on Windows:\n1. Press Win+R, type `cleanmgr` and hit enter.\n2. Select drive C: and press OK.\n3. Select 'Clean up system files' to delete old Windows installations.\n4. Check the 'Downloads' and 'Recycle Bin' folders manually.\n5. Run defragmentation/optimization if SSD is below 15% free space.",
            "category_id": 2,
            "tags": "windows,disk,slow,performance,cleanup"
        },
        # Network & VPN (ID: 3)
        {
            "title": "GlobalProtect VPN Failed Connection Errors",
            "content": "For VPN connection errors (e.g. portal not found):\n1. Right-click the GlobalProtect icon in the system tray and select Settings.\n2. Verify the portal address is set to `vpn.company.com`.\n3. Click 'Refresh Connection'.\n4. If failure persists, reinstall the network virtual adapter driver in Device Manager.",
            "category_id": 3,
            "tags": "vpn,globalprotect,network,remote"
        },
        # Email & Collaboration (ID: 4)
        {
            "title": "Fixing Outlook Syncing and Offline Mode Issues",
            "content": "If Outlook is not receiving new emails:\n1. Check the status bar at the bottom right. If it says 'Disconnected' or 'Offline Mode', go to the Send/Receive tab and toggle off 'Work Offline'.\n2. If sync is stuck, go to File -> Account Settings -> Account Settings, select the exchange email, and click 'Repair'.\n3. Restart Outlook.",
            "category_id": 4,
            "tags": "outlook,email,sync,offline,exchange"
        },
        # ERP / WMS (ID: 5)
        {
            "title": "Zebra Shipping Printer Setup and Visibility",
            "content": "If a shipping station cannot see the Zebra thermal printer:\n1. Verify the USB connection is secure or the network IP is pingable.\n2. Open Windows Services (services.msc) and restart the 'Print Spooler' service.\n3. Open Zebra Setup Utilities and verify the printer settings. Try printing a test configuration page to ensure driver alignment.",
            "category_id": 5,
            "tags": "zebra,printer,shipping,wms,hardware"
        }
    ]
    
    cursor = conn.cursor()
    for art in kb_articles:
        cursor.execute(
            "INSERT INTO knowledge_base (title, content, category_id, tags) VALUES (?, ?, ?, ?)",
            (art["title"], art["content"], art["category_id"], art["tags"])
        )
    conn.commit()
    print("Knowledge base seeded successfully.")
    
    # Verification logs
    print("-" * 30)
    print("Database seeding completed.")
    print(f"Total Agents seeded: {len(dfs['agents'])}")
    print(f"Total Categories seeded: {len(dfs['categories'])}")
    print(f"Total Tickets seeded: {len(tickets_df)}")
    print(f"Total Comments seeded: {len(comments_filtered)}")
    print(f"Total SLA Breaches seeded: {len(breaches_filtered)}")
    print(f"Total KB Articles seeded: {len(kb_articles)}")
    
    conn.close()

if __name__ == "__main__":
    download_and_seed()
