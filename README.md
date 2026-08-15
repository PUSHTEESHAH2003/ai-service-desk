# AI-Powered Service Desk

A modern, high-fidelity support incident management web application. Built for IT support teams to capture incidents in natural language, automatically prioritize and route tickets using AI, match incoming problems to local troubleshooting knowledge documents, track SLA metrics, and maintain a full comment and resolution lifecycle.

---

## 🌐 Deployed Live Demos
* **Frontend Web Application (Vercel)**: [https://ai-service-desk-official.vercel.app](https://ai-service-desk-official.vercel.app)
* **Backend API Service (Render)**: [https://ai-service-desk-api.onrender.com](https://ai-service-desk-api.onrender.com)

---

## ✨ Key Custom Additions & Overhaul Details
1. **Interactive Cyber-HUD Visual Theme**: Re-engineered the typography (using `JetBrains Mono`), layout, and color palettes to design a premium dark sci-fi HUD theme. Features glowing accents, neon status badges, and dynamic bracket containers (`::before` / `::after` on `.card` elements) that expand on hover.
2. **Blurred Wallpaper Backdrop**: Decoupled the high-resolution tech background wallpaper into a fixed background layer with `filter: blur(8px); transform: scale(1.02); z-index: -1;` ensuring all foreground dashboard text is 100% sharp and easy to read.
3. **Scroll-Driven Reveal Animations**: Hardware-accelerated entry transitions using `animation-timeline: view()` and `animation-range: entry 5% cover 25%` that scale and fade elements in smoothly as they scroll into view.
4. **Self-Healing Database & Multi-Environment Support**:
   * **Auto-Seeding**: The backend automatically detects empty or missing databases on startup and downloads the Hugging Face dataset dynamically—enabling true "plug-and-play" setups.
   * **Windows Lock Resolution**: Wrapped file deletion in a try-except block and implemented SQL `DROP TABLE IF EXISTS` logic. This prevents Windows file-lock permission crashes (`WinError 32`) during auto-seeding.
   * **Render Free Tier Support**: Added path checking to fallback to the local folder (`service_desk.db`) if `/data` (where Render paid persistent disks reside) is missing or unwritable.
5. **Mobile Top Header & Bottom Tab Bar**: Fully responsive layout optimization. On screens narrower than `1024px`, the app hides the desktop sidebar and introduces a native-like fixed top header (with brand name & logout button) and bottom tab navigation (Dashboard, Workbench, Submit, KB, Control) for mobile devices.

---


## 🛠️ Technology Stack & Architecture

- **Backend**: FastAPI (Python 3.14+)
- **Database**: SQLite 3 (persistent storage file at `backend/service_desk.db`)
- **Frontend**: React 19 + Vite + Lucide Icons
- **Styling**: Premium custom Vanilla CSS (dark glassmorphism theme, HSL custom palette, fluid responsive grids, micro-animations)
- **AI Integration**: Gemini API (`gemini-2.5-flash`) via standard JSON HTTPS requests.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
Ensure you have **Python 3.10+** and **Node.js 18+** installed.

### 2. Backend Setup & Run
1. Open a terminal and navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install the python requirements:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the database seeding script to fetch the HF help-desk dataset, create tables, and populate seed records:
   ```bash
   python seed_db.py
   ```
4. Start the FastAPI server:
   ```bash
   python main.py
   ```
   *The API will start running on `http://127.0.0.1:8000`. You can inspect the interactive OpenAPI docs at `http://127.0.0.1:8000/docs`.*

### 3. Frontend Setup & Run
1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install node dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to `http://localhost:5173`.

---

## 🧠 AI Configuration & Prompt Design

The system runs a **Dual AI Mode** strategy:
- **API Mode**: If a `GEMINI_API_KEY` is provided (either via environment variable or pasted into the **Control Panel** in the UI), the system calls the official Google Gemini API using the fast `gemini-2.5-flash` model.
- **Mock Mode**: If no key is configured, the system automatically falls back to heuristic pattern matching based on terms (e.g. "zebra", "outlook", "vpn") to classify, prioritize, and generate checklists immediately. This ensures the app is 100% functional out-of-the-box for evaluation.

### 1. Incident Analysis Prompt
This prompt is sent to classify, summarize, and draft checklists:
```json
Analyze this support ticket:
Summary: {summary}
Description: {description}

Based on the details, perform the following and return a JSON structure:
1. Suggest a concise 1-sentence 'summary' (max 80 chars).
2. Choose the best category from this list: [{list_of_available_categories}]. Put the selected ID in 'category_id'.
3. Provide 'category_reasoning' for why this category was chosen.
4. Recommend a priority level in 'priority' ('P1' for critical service outage, 'P2' for high urgency user blocking, 'P3' for normal operations, 'P4' for inquiries/requests).
5. Provide 'priority_reasoning'.
6. Provide a 'checklist' of 3-5 tactical debugging or solution steps as a JSON list of strings.

Return ONLY the valid JSON structure. Do NOT include markdown blocks.
```

### 2. Knowledge Base Matching Prompt
Passes the ticket description and all available articles to Gemini for semantic connecting:
```json
Identify the top 2 most relevant knowledge base articles from this list to solve this support ticket:

Ticket Description: {description}

Knowledge Base articles:
{list_of_titles_and_summaries}

Return the output in strict JSON format:
{
    "recommended_article_ids": [id1, id2],
    "reasoning": "Explain why these articles are relevant."
}
```

---

## 📂 Data Handling & Hugging Face Source

Data is sourced from the relational IT service management dataset at **`huggingface.co/datasets/mindweave/help-desk-tickets`**.
- To keep the app fast and responsive, the `seed_db.py` script automatically downloads the source tables and seeds the database with the **first 300 tickets**, **all 10 agents**, **all 8 categories**, and filters/injects matching **comments (682)** and **SLA breaches (28)**.
- It also seeds a set of standard IT Knowledge Base articles covering Active Directory, VPN gateways, Zebra shipping printers, and Outlook sync issues.

---

## 📐 Assumptions & Known Trade-offs

1. **Local State for Checkbox Checklists**: The checkbox states of the AI checklist items are saved in the client's `localStorage` (scoped by ticket ID) rather than writing database tables. This preserves checked actions across reloads without adding database transaction complexity.
2. **CORS Handling**: The FastAPI backend is configured to accept requests from all origins (`*`) via CORSMiddleware to ease local pairing between port 5173 (frontend) and port 8000 (backend).
3. **Draft Ticket Pre-Analysis**: The "Pre-Analyze Description" button on the submission form runs a fast client-side heuristic parser. When the ticket is finalized and submitted, the full backend analysis (Gemini or Mock) is triggered instantly.
