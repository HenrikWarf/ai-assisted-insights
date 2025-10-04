# AI-Assisted Insights Platform

## Overview

This is an intelligent data analytics and insights platform that combines role-based dashboards with AI-powered analysis. The application helps business users (E-commerce Managers, Marketing Leads, and custom roles) discover actionable insights from their data using Google's Gemini AI.

The platform features:
- **Pre-built Analytics Dashboards** for E-commerce and Marketing roles
- **Custom Role Creation** with BigQuery data integration
- **AI-Powered Insights** using Gemini 2.5 Pro for strategic analysis
- **Priority-Based Action Planning** with automated recommendations
- **Interactive Data Visualizations** with natural language chart creation

## Architecture

### Technology Stack

**Backend:**
- **Flask** (Python web framework)
- **SQLite** (local database for application and role-specific data)
- **Google Cloud Vertex AI** (Gemini 2.5 Pro for AI analysis)
- **Google BigQuery** (optional data source for custom roles)
- **Python 3.x** with dependencies managed via `requirements.txt`

**Frontend:**
- Vanilla JavaScript (ES6+)
- Chart.js for visualizations
- Modular component architecture
- Responsive CSS design

**AI/ML:**
- Gemini 2.5 Pro for strategic analysis and insights
- Gemini 2.5 Flash for chart-specific insights
- Vertex AI SDK for AI integration

### Project Structure

```
ai-assisted-insights/
├── app/                          # Application package
│   ├── api/                      # API route blueprints
│   │   ├── auth_routes.py        # Authentication endpoints
│   │   ├── metrics_routes.py     # Metrics data endpoints
│   │   ├── analysis_routes.py    # AI analysis endpoints
│   │   ├── priority_insights_routes.py  # Priority exploration
│   │   ├── action_routes.py      # Action plan management
│   │   └── custom_role_routes.py # Custom role management
│   ├── auth/                     # Authentication logic
│   │   └── auth.py               # Login/logout handlers
│   ├── database/                 # Database utilities
│   │   ├── connection.py         # Connection management
│   │   ├── schema.py             # Schema inference utilities
│   │   └── role_db_schema.py     # Role-specific DB schema
│   └── models/                   # Business logic models
│       ├── metrics.py            # Metrics data building
│       └── roles.py              # Custom role manager
├── services/                     # Service layer
│   ├── gemini_service.py         # Gemini AI integration
│   ├── action_plan_service.py    # Action plan generation
│   └── bigquery_loader.py        # BigQuery data import
├── static/                       # Frontend assets
│   ├── js/                       # JavaScript modules
│   │   ├── components/           # UI components
│   │   │   ├── ai-assistant.js   # AI chat assistant
│   │   │   ├── action-plan.js    # Action plan UI
│   │   │   ├── kpi.js            # KPI display
│   │   │   ├── metrics.js        # Metrics visualizations
│   │   │   ├── priority-explore-modal.js  # Priority analysis UI
│   │   │   └── explore-action-modal.js    # Action exploration UI
│   │   ├── services/
│   │   │   └── visualizer.js     # Chart rendering
│   │   ├── utils/
│   │   │   ├── formatters.js     # Data formatting utilities
│   │   │   └── ui.js             # UI helpers
│   │   └── dashboard-app.js      # Main dashboard app
│   ├── dashboard.html            # Main dashboard page
│   ├── index.html                # Login/home page
│   └── styles.css                # Application styles
├── db/                           # Database scripts
│   └── seed.py                   # Database seeding script
├── data/                         # SQLite databases
│   └── cfc.db                    # Main application database
├── custom_roles/                 # Custom role data
│   ├── *.db                      # Role-specific SQLite databases
│   ├── *.json                    # Role configurations
│   ├── *.plan.json               # Role dashboard plans (KPIs, charts)
│   └── *.sa.json                 # Service account credentials
├── app.py                        # Flask application entry point
├── requirements.txt              # Python dependencies
└── README.md                     # This file
```

## Core Features

### 1. Role-Based Dashboards

The application provides specialized dashboards for different business roles:

**E-commerce Manager Dashboard:**
- E-commerce funnel metrics (sessions → purchases)
- Payment failure tracking
- Search performance (zero-result queries)
- Product-level conversion analysis
- Page performance monitoring (Core Web Vitals)
- SKU efficiency tracking
- Return rate analysis

**Marketing Lead Dashboard:**
- Campaign ROAS analysis
- Creative performance (CTR, conversion rate)
- Budget pacing monitoring
- Ad disapproval tracking
- Brand health metrics (sentiment, NPS)
- Channel-level performance

### 2. AI-Powered Analysis

The platform uses Gemini 2.5 Pro to provide two types of analysis:

**Short-Term Analysis (Last 2 Weeks):**
- Identifies immediate tactical issues requiring urgent attention
- Provides quick-win opportunities
- Detects recent performance anomalies
- Generates actionable recommendations for 1-2 week implementation

**Long-Term Analysis (90 Days):**
- Analyzes strategic trends and patterns
- Identifies month-over-month evolution
- Detects seasonal variations
- Provides strategic recommendations for long-term planning

### 3. Priority Insights & Explore

Users can deep-dive into any identified priority issue:

**Priority Exploration:**
- Generate detailed insights about a specific priority
- View comprehensive root cause analysis
- Understand business impact
- Get strategic recommendations
- Access data-driven next steps

**Action Generation:**
- AI generates 5 distinct, high-impact actions per priority
- Each action includes effort and impact estimates
- Priority levels (High/Medium/Low)
- Saved for tracking and workspace management

### 4. Action Plan Workspace

**Explore & Act Feature:**
- Deep analysis of proposed actions
- Strategic alignment assessment
- Market rationale and timing analysis
- Potential impact quantification
- Risk assessment
- Detailed next steps with task management
- SQL query generation for data validation
- Communication draft generation
- AI assistant for contextual questions

**Action Tracking:**
- Save actions to personal workspace
- Organize by parent priority
- Add notes and observations
- Track status and progress
- Delete completed or irrelevant actions

### 5. Custom Role Creation

Users can create custom analytics roles connected to their own BigQuery data:

**Setup Process:**
1. **Configure Data Source:**
   - Provide GCP project ID
   - Select BigQuery dataset
   - Choose tables to import
   - Upload service account credentials

2. **Import Data:**
   - Automatic schema detection
   - Bulk import from BigQuery to SQLite
   - Preserves column types and metadata

3. **AI-Powered Analysis:**
   - Gemini analyzes imported data structure
   - Automatically generates relevant KPIs
   - Creates recommended visualizations
   - Generates initial insights

4. **Dashboard Customization:**
   - Natural language chart creation ("Show me revenue by region")
   - AI-generated SQL queries
   - Edit existing visualizations
   - Generate chart-specific insights
   - Delete unwanted charts

### 6. Intelligent Visualizations

**Chart Types Supported:**
- Line charts (time-series trends)
- Bar charts (categorical comparisons)
- Pie charts (distribution/breakdown)
- Tables (detailed data display)

**AI-Enhanced Features:**
- Natural language query to SQL conversion
- Automatic chart type recommendation
- Context-aware insights generation
- Schema-aware query generation

## Data Flow

### Analysis Workflow

1. **Data Collection:**
   - Pre-built roles: Query from centralized SQLite database views
   - Custom roles: Import from BigQuery to role-specific SQLite database

2. **Metrics Building:**
   - Role-based metric filtering
   - Time-series data aggregation
   - KPI calculations with change percentages

3. **AI Analysis:**
   - Package metrics as JSON
   - Send to Gemini 2.5 Pro via Vertex AI
   - Receive structured JSON response with prioritized issues

4. **Priority Exploration:**
   - User selects priority for deep-dive
   - Generate detailed insights via Gemini
   - Generate actionable recommendations
   - Store in role-specific database

5. **Action Planning:**
   - User explores specific action
   - Generate strategic context and next steps
   - Create task breakdown with dependencies
   - Enable query/communication generation
   - Save to workspace for tracking

### Database Architecture

**Main Database (`data/cfc.db`):**
- Product, store, inventory data
- Sales transactions
- E-commerce metrics (web sessions, page performance, search queries, checkout failures)
- Marketing data (campaigns, creatives, budget pacing, brand health)
- Analysis runs (stored AI analyses)
- Actions tracking table

**Role-Specific Databases (`custom_roles/*.db`):**
- User-imported tables from BigQuery
- `proposed_actions` - AI-generated actions from priority analysis
- `saved_analyses` - User-saved priority analyses
- `saved_actions` - User-saved actions for workspace
- `chart_insights` - AI-generated insights per chart
- `action_notes` - User notes on actions
- `priority_notes` - User notes on priorities

## Setup & Installation

### Prerequisites

- Python 3.8+
- Google Cloud Project with Vertex AI enabled
- Service account with appropriate permissions
- (Optional) BigQuery dataset for custom roles

### Installation Steps

1. **Clone the repository:**
```bash
git clone <repository-url>
cd ai-assisted-insights
```

2. **Create and activate virtual environment:**
```bash
python3 -m venv venv
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate
```

3. **Install dependencies:**
```bash
pip install -r requirements.txt
```

4. **Configure environment variables:**
Create a `.env` file in the project root:
```bash
FLASK_SECRET_KEY=your-secret-key-here
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GEMINI_LOCATION=us-central1
GEMINI_MODEL=gemini-2.5-pro
```

5. **Set up Google Cloud authentication:**
```bash
# Set the path to your service account key file
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/service-account-key.json"
```

6. **Initialize the database:**
```bash
python db/seed.py
```

7. **Run the application:**
```bash
python app.py
```

8. **Access the application:**
Open your browser to `http://localhost:5000`

### Configuration Options

**Authentication Modes:**
- **Service Account (Recommended):** Set `GOOGLE_CLOUD_PROJECT` environment variable
- **API Key:** Set `GOOGLE_GENAI_API_KEY` environment variable

**Model Selection:**
- Default: `gemini-2.5-pro`
- Can be changed via `GEMINI_MODEL` environment variable

## API Endpoints

### Authentication
- `POST /login` - User login with role selection
- `POST /logout` - User logout
- `GET /dashboard` - Dashboard page (requires auth)

### Metrics & Analysis
- `GET /api/metrics` - Get role-specific metrics data
- `POST /api/analyze` - Trigger AI analysis (short-term + long-term)
- `GET /api/analysis_latest` - Get most recent analysis for role

### Priority Insights
- `POST /api/priority-insights/generate` - Generate insights for a priority
- `POST /api/priority-insights/actions` - Generate actions for a priority
- `GET /api/priority-insights/proposed-actions` - Get proposed actions
- `POST /api/priority-insights/save` - Save priority analysis
- `GET /api/priority-insights/saved` - Get all saved analyses
- `DELETE /api/priority-insights/saved/:id` - Delete saved analysis
- `POST /api/priority-insights/notes` - Add note to priority
- `GET /api/priority-insights/notes` - Get notes for priority

### Action Management
- `POST /api/actions/explore` - Generate detailed action context and steps
- `GET /api/actions/:id` - Get specific action details
- `POST /api/actions/save` - Save action to workspace
- `GET /api/actions/saved` - Get all saved actions
- `DELETE /api/actions/saved/:id` - Delete saved action
- `POST /api/actions/:id/notes` - Add note to action
- `GET /api/actions/:id/notes` - Get notes for action
- `DELETE /api/actions/:id/notes/:noteId` - Delete note
- `POST /api/actions/:id/steps/update` - Update step status
- `POST /api/actions/:id/steps/:taskId/generate-query` - Generate SQL query
- `POST /api/actions/:id/steps/:taskId/generate-communication` - Generate communication draft
- `POST /api/actions/:id/ai-assistant` - Ask AI assistant about action
- `DELETE /api/actions/:id/ai-assistant/:conversationId` - Delete AI conversation

### Custom Roles
- `GET /api/custom_roles` - List all custom roles
- `POST /api/new_role/create` - Create new custom role
- `POST /api/new_role/import` - Import data from BigQuery
- `POST /api/new_role/analyze` - Analyze and generate dashboard plan
- `GET /api/custom_role/schema` - Get database schema for role
- `GET /api/custom_role/metrics` - Get metrics for custom role
- `POST /api/custom_role/create_visualization` - Create custom chart
- `DELETE /api/custom_role/charts/:roleName/:chartId` - Delete chart
- `GET /api/custom_role/insights/:roleName/:chartId` - Get chart insights
- `POST /api/chart/insights` - Generate new chart insights
- `POST /api/custom_role/analyze` - Analyze custom role data
- `GET /api/custom_role/analysis_latest` - Get latest analysis for custom role

## Key Technologies & Libraries

### Backend
- `Flask==3.1.2` - Web framework
- `google-cloud-aiplatform==1.114.0` - Vertex AI integration
- `google-cloud-bigquery==3.37.0` - BigQuery client
- `google-genai==1.38.0` - Gemini AI client
- `sqlite-utils==3.38` - SQLite utilities
- `python-dotenv==1.1.1` - Environment configuration

### Frontend
- `Chart.js` - Data visualization library
- Native ES6 modules for component architecture
- Fetch API for REST communication

## Development

### Code Organization

**Backend:**
- **Blueprints:** Modular API routes organized by feature
- **Services:** Business logic and external integrations
- **Models:** Data access and manipulation
- **Database:** Connection management and schema utilities

**Frontend:**
- **Components:** Reusable UI components (KPIs, charts, modals)
- **Services:** Data fetching and visualization rendering
- **Utils:** Formatting, validation, and UI helpers

### Adding New Features

**Adding a New API Endpoint:**
1. Create route in appropriate blueprint file (`app/api/*.py`)
2. Add business logic in service layer (`services/*.py`)
3. Update database schema if needed (`app/database/*.py`)

**Adding a New Component:**
1. Create component file in `static/js/components/`
2. Export component class or function
3. Import and use in `dashboard-app.js`

**Adding a New Visualization:**
1. Use the "Create Visualization" feature in the dashboard
2. Describe desired chart in natural language
3. AI generates SQL query and chart configuration
4. Review and optionally generate insights

## Data Model

### Main Database Tables

**Products & Inventory:**
- `products` - Product catalog
- `stores` - Store locations
- `inventory` - Stock levels
- `sales` - Transaction history

**E-commerce Metrics:**
- `web_sessions` - Session funnel data
- `page_performance` - Core Web Vitals
- `product_performance` - Product-level metrics
- `search_queries` - Search analytics
- `checkout_failures` - Checkout issue tracking
- `returns` - Return tracking

**Marketing Metrics:**
- `marketing_campaigns` - Campaign performance
- `creative_performance` - Creative asset metrics
- `budget_pacing` - Budget tracking
- `brand_health` - Brand metrics (NPS, sentiment)
- `ad_disapprovals` - Ad policy violations

**Analysis & Actions:**
- `analysis_runs` - Stored AI analyses
- `actions` - Action tracking (legacy)

### Role-Specific Database Tables

**Action Management:**
- `proposed_actions` - AI-generated actions (transient)
- `saved_actions` - User-saved actions (persistent)
- `action_notes` - Notes on actions

**Priority Management:**
- `saved_analyses` - Saved priority analyses
- `priority_notes` - Notes on priorities

**Visualization:**
- `chart_insights` - AI-generated chart insights

## AI Integration

### Gemini Models Used

**Gemini 2.5 Pro (`gemini-2.5-pro`):**
- Strategic analysis (short-term and long-term)
- Priority insight generation
- Action plan generation
- SQL query generation
- Communication drafting
- Contextual Q&A

**Gemini 2.5 Flash (implicit):**
- Chart-specific insights
- Quick data summaries

### Prompt Engineering

The application uses structured prompts with:
- **Role context** - User's business role and responsibilities
- **Data context** - Relevant metrics and time periods
- **Output schema** - Expected JSON structure
- **Examples** - Format examples for consistent output

### Response Handling

All AI responses are:
1. Validated for JSON structure
2. Sanitized for special characters
3. Stored in database for caching
4. Logged for debugging

## Security Considerations

1. **Authentication:** Session-based authentication with role-based access
2. **API Keys:** Store in environment variables, never commit to repository
3. **Service Accounts:** Store in separate files excluded from git (`.sa.json`)
4. **SQL Injection:** Use parameterized queries throughout
5. **XSS Protection:** Sanitize user inputs in frontend
6. **CORS:** Disabled by default (same-origin policy)

## Performance Optimization

1. **Database Indexing:** Key tables have appropriate indexes
2. **Query Optimization:** Pre-aggregated views for common metrics
3. **Caching:** AI analyses cached in database to avoid redundant API calls
4. **Batch Processing:** BigQuery imports in batches of 500 rows
5. **Lazy Loading:** Charts rendered on-demand

## Troubleshooting

### Common Issues

**"Gemini not configured" error:**
- Ensure `GOOGLE_CLOUD_PROJECT` or `GOOGLE_GENAI_API_KEY` is set
- Verify service account has Vertex AI permissions
- Check `GOOGLE_APPLICATION_CREDENTIALS` path

**BigQuery import fails:**
- Verify service account has BigQuery Data Viewer role
- Check dataset and table names
- Ensure service account JSON is valid

**Charts not rendering:**
- Check browser console for JavaScript errors
- Verify Chart.js library is loaded
- Ensure data format matches chart type

**Analysis not showing:**
- Run `/api/analyze` endpoint first to generate analysis
- Check backend logs for AI errors
- Verify metrics data is populated

### Logs

**Backend Logs:**
```bash
# View Flask server logs
python app.py
```

**Database Inspection:**
```bash
# Open SQLite database
sqlite3 data/cfc.db
# Or for custom role
sqlite3 custom_roles/RoleName.db
```

## Future Enhancements

Potential improvements:
- Multi-user authentication and authorization
- Real-time data streaming from BigQuery
- Scheduled analysis runs
- Email/Slack notifications for critical priorities
- A/B testing framework
- Export reports to PDF/Excel
- Mobile-responsive design improvements
- Dark mode theme
- Multi-language support

## Contributing

When contributing to this project:
1. Follow existing code style and conventions
2. Add comments for complex logic
3. Update README for new features
4. Test thoroughly before submitting
5. Keep commits focused and atomic

## License

[Add your license information here]

## Support

For questions, issues, or feature requests, please [add contact information or issue tracker link].

---

**Note:** This application uses AI-generated insights as recommendations. Always validate findings with domain expertise and additional data analysis before making business decisions.
