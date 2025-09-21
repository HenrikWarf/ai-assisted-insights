## Crazy Fashion Corp - Data Driven App (Base)

### Quick start

1) Create/activate venv and install deps (already done by assistant). If running manually:

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

2) Configure environment:

```bash
cp .env.example .env
# Edit .env as needed
```

3) Seed the local SQLite database:

```bash
python db/seed.py
```

4) Run the dev server:

```bash
FLASK_APP=app.py FLASK_ENV=development flask run --host 0.0.0.0 --port 5000
```

Then open http://localhost:5000 in your browser.

### Project structure

- `app.py`: Flask app and API routes
- `db/seed.py`: Creates schema and seeds sample data into SQLite
- `services/gemini_service.py`: Gemini analysis wrapper with local fallback
- `static/`: HTML, CSS, and JS assets
- `.env`: Environment variables (Gemini and config)

### Notes

- Gemini integration uses Google Cloud libraries if configured; otherwise falls back to deterministic mock suggestions.
- This base includes two login roles (E-commerce Manager and Marketing Lead) to start.


