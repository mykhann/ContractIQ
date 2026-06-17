# ContractGuard — AI Contract Risk Scanner

Production-grade AI agent that scans contracts clause-by-clause, scores legal risk, persists every scan to SQLite, and saves reports to Google Docs via n8n cloud.

**Stack:** Python 3.11 · FastAPI · Groq (LLaMA 3.3 70B) · SQLite · Vanilla JS frontend · n8n cloud

---

## Setup (3 steps)

### 1. Install dependencies
```bash
cd python-service
pip install -r requirements.txt
```

### 2. Configure environment
```bash
# Edit python-service/.env
GROQ_API_KEY=gsk_your_key_here    # free at console.groq.com
```

### 3. Start the API
```bash
cd python-service
uvicorn main:app --reload --port 8000
```

API live at **http://localhost:8000**
Docs at **http://localhost:8000/docs**

---

## Use the frontend

Just open `frontend/index.html` in any browser. No build step.

The **Backend URL** field in the top-right defaults to `http://localhost:8000`. Change it if deployed elsewhere.

---

## Connect n8n cloud

1. Log in to your n8n cloud account
2. **Workflows → Import from File** → upload `n8n/workflow.json`
3. In the workflow, replace `YOUR_BACKEND_URL` with your public backend URL
   - Local dev: use [ngrok](https://ngrok.com) → `ngrok http 8000`
   - Deployed: your server URL
4. Click **Save to Google Docs** node → connect your Google Docs OAuth2 credential
5. **Activate** the workflow

---

## File structure

```
contractguard/
├── frontend/
│   └── index.html          — Full UI: upload + analyze + history tab
├── python-service/
│   ├── main.py             — FastAPI app (all endpoints)
│   ├── database.py         — SQLite persistence layer
│   ├── groq_client.py      — Groq API wrapper
│   ├── models.py           — Pydantic schemas
│   ├── extractor.py        — LLM clause extraction + chunking
│   ├── scorer.py           — LLM per-clause risk scoring
│   ├── report_builder.py   — Report assembly + LLM summary
│   ├── requirements.txt
│   ├── .env                — Add your GROQ_API_KEY here
│   └── utils/
│       ├── pdf_parser.py
│       └── docx_parser.py
├── n8n/
│   └── workflow.json       — Import into n8n cloud
└── README.md
```

---

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/analyze` | Analyze contract text (JSON) |
| POST | `/analyze/upload` | Analyze uploaded PDF/DOCX/TXT |
| POST | `/decode-file` | Base64 file → text (n8n helper) |
| GET | `/history` | List all past scans |
| GET | `/history/stats` | Dashboard aggregate stats |
| GET | `/report/{id}` | Full report for one scan |
| DELETE | `/report/{id}` | Delete a scan |

---

## Where data is stored

SQLite database file is created automatically at:
```
python-service/contractguard.db
```

Every completed analysis is saved with: contract name, risk scores, clause count, red flag count, party perspective, full report JSON, and timestamp.

The history tab in the frontend reads from `/history` and `/history/stats`.

---

## Example curl

```bash
# Analyze text
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{"contract_text":"...","contract_name":"NDA","party_perspective":"employee"}'

# Upload file
curl -X POST http://localhost:8000/analyze/upload \
  -F "file=@contract.pdf" \
  -F "contract_name=Service Agreement" \
  -F "party_perspective=vendor"

# List history
curl http://localhost:8000/history

# Get one report
curl http://localhost:8000/report/1
```
