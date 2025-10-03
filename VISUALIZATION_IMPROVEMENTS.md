# Custom Visualization Feature - Major Improvements

## Overview
The Custom Visualization feature (Add & Edit charts) has been significantly enhanced with better AI context and understanding. The AI now has much more information to work with when generating or editing visualizations.

---

## What Was Wrong Before

### 1. **Minimal Context in AI Prompt**
The original prompt was very basic:
```python
prompt = f"""
You are a SQL expert. Generate a SQL query for the following request:
Request: {description}
Available tables and columns: {schema_info}
"""
```

**Problems:**
- ❌ No role context (e.g., "Sales Analyst")
- ❌ No sample data - AI couldn't see what values exist
- ❌ No existing charts context - AI didn't know what else was on the dashboard
- ❌ For edits: AI had no idea what the current chart showed
- ❌ Chart type detection was just keyword matching ("line" → line chart)
- ❌ No guidance on visualization best practices

### 2. **Edit Mode Had No Context**
When editing a chart, the AI didn't know:
- What the current chart displays
- What SQL query is currently used
- What chart type it is
- What the title/description was

### 3. **No Sample Data**
The AI only saw column names and types, not actual data values. This made it hard to:
- Understand what kinds of values exist
- Generate appropriate WHERE clauses
- Suggest meaningful aggregations

---

## What's Improved Now

### 1. **Rich Context in Every Request**

The AI now receives:

#### **Role Context**
```python
CONTEXT:
- Role: Sales Analyst
- User Request: "Show me top products by revenue"
```

#### **Sample Data from All Tables**
```json
{
  "sales_data": {
    "columns": [...],
    "sample_data": [
      {"product": "Widget A", "revenue": 15000, "date": "2024-01"},
      {"product": "Widget B", "revenue": 12000, "date": "2024-01"},
      {"product": "Widget C", "revenue": 9500, "date": "2024-01"}
    ],
    "row_count": 5432
  }
}
```

#### **Existing Charts Context**
```
EXISTING CHARTS IN THIS DASHBOARD:
- Monthly Revenue Trend: line chart
- Top 10 Customers: bar chart
- Product Category Distribution: pie chart
```

#### **Current Chart Context (for Edits)**
```
EDITING EXISTING CHART:
- Current Title: Revenue by Product Category
- Current Type: bar
- Current SQL Query: SELECT category, SUM(revenue) FROM sales_data GROUP BY category
- Current Description: Show product category breakdown

User wants to modify this chart. Interpret their request as a modification to the existing visualization.
```

### 2. **Better AI Instructions**

The prompt now includes:

✅ **Visualization Guidelines:**
- LINE CHART: Time-based trends (requires date column + metric)
- BAR CHART: Comparisons across categories (requires category + metric)
- PIE CHART: Distribution/breakdown (requires category + percentage/count)
- TABLE: Detailed records with multiple columns

✅ **SQL Best Practices:**
- Use appropriate aggregations (GROUP BY, SUM, COUNT, AVG)
- Order by relevant columns
- Limit results to reasonable size (e.g., TOP 10)
- Handle time-series properly

✅ **Structured Response:**
The AI now returns:
```json
{
  "sql_query": "SELECT ...",
  "suggested_chart_type": "bar",
  "chart_title": "Clear, descriptive title",
  "reasoning": "Brief explanation of approach"
}
```

### 3. **Better Chart Metadata**

Charts now store:
```json
{
  "id": "1",
  "title": "Top 10 Products by Revenue",
  "description": "Show me top products by revenue",  // Original user request
  "type": "bar",
  "query_sql": "SELECT product, SUM(revenue) as total...",
  "ai_reasoning": "Used bar chart for comparison..."  // AI's explanation
}
```

### 4. **Improved Chart ID Management**

- New charts get sequential numeric IDs (1, 2, 3...)
- Edits preserve the original chart ID
- No more random string IDs

---

## Example Scenarios

### Scenario 1: Creating a New Chart
**User Input:** "Show me revenue trends over the last 6 months"

**AI Receives:**
- Role: Sales Analyst
- All table schemas + sample data
- Existing charts on dashboard
- Row counts and data types

**AI Returns:**
```json
{
  "sql_query": "SELECT strftime('%Y-%m', date) as month, SUM(revenue) as total_revenue FROM sales_data WHERE date >= date('now', '-6 months') GROUP BY month ORDER BY month",
  "suggested_chart_type": "line",
  "chart_title": "Revenue Trends - Last 6 Months",
  "reasoning": "Time-series data best visualized as line chart showing monthly progression"
}
```

### Scenario 2: Editing an Existing Chart
**User Input:** "Make it show top 5 instead"

**AI Receives:**
- Current chart: "Top 10 Products by Revenue" (bar chart)
- Current SQL: `SELECT product, SUM(revenue) FROM sales_data GROUP BY product ORDER BY SUM(revenue) DESC LIMIT 10`
- User request: "Make it show top 5 instead"

**AI Understands:**
- User wants to modify existing "top 10" to "top 5"
- Keep the same structure, just change LIMIT clause

**AI Returns:**
```json
{
  "sql_query": "SELECT product, SUM(revenue) as total_revenue FROM sales_data GROUP BY product ORDER BY total_revenue DESC LIMIT 5",
  "suggested_chart_type": "bar",
  "chart_title": "Top 5 Products by Revenue",
  "reasoning": "Modified LIMIT from 10 to 5 as requested, kept bar chart type appropriate for comparison"
}
```

### Scenario 3: Complex Request
**User Input:** "Compare sales performance between Q1 and Q2 this year"

**AI Receives:**
- Sample data showing date formats
- Existing charts (knows if similar comparisons exist)
- Table row counts

**AI Returns:**
```json
{
  "sql_query": "SELECT CASE WHEN strftime('%m', date) IN ('01','02','03') THEN 'Q1' ELSE 'Q2' END as quarter, SUM(revenue) as total_revenue, COUNT(*) as transaction_count FROM sales_data WHERE strftime('%Y', date) = strftime('%Y', 'now') AND strftime('%m', date) IN ('01','02','03','04','05','06') GROUP BY quarter ORDER BY quarter",
  "suggested_chart_type": "bar",
  "chart_title": "Q1 vs Q2 Sales Performance",
  "reasoning": "Grouped data into quarters using date functions, bar chart best for comparing two periods"
}
```

---

## Benefits

✅ **More Accurate SQL Generation:** AI understands actual data values and types
✅ **Better Chart Type Selection:** AI suggests appropriate visualization based on data structure
✅ **Contextual Edits:** When editing, AI knows what it's modifying
✅ **Clearer Titles:** AI generates descriptive, business-friendly titles
✅ **Reduced Errors:** Sample data helps avoid invalid queries
✅ **Dashboard Awareness:** AI avoids creating duplicate visualizations
✅ **Better Error Messages:** More context means better debugging

---

## Technical Changes

**File: `app/api/custom_role_routes.py`**

1. **Enhanced Schema Collection** (lines 382-434):
   - Added sample data collection (3 rows per table)
   - Added row count for each table
   - Added current chart context for edits
   - Added existing charts summary

2. **Improved Prompt** (lines 437-475):
   - Added role context
   - Added sample data
   - Added visualization guidelines
   - Added structured response format
   - Better instructions for SQL generation

3. **Better Response Parsing** (lines 477-556):
   - Extract chart_title from AI response
   - Use AI-suggested chart type
   - Store original user description
   - Store AI reasoning
   - Better chart ID management

4. **Enhanced Chart Objects** (lines 546-556):
   - `title`: AI-generated descriptive title
   - `description`: Original user request
   - `ai_reasoning`: AI's explanation (optional)

---

## Testing Recommendations

Test these scenarios:

1. **Create New Chart:** "Show me monthly sales trends"
2. **Edit Existing:** "Change this to show top 5 instead of top 10"
3. **Complex Query:** "Compare this month vs last month by product category"
4. **Natural Language:** "What are my best performing regions?"
5. **Ambiguous Request:** "Show me the data" (AI should ask for clarification via error)

---

## Future Enhancements (Optional)

- [ ] Add data quality checks (null values, outliers)
- [ ] Suggest related visualizations
- [ ] Auto-detect when a chart should be updated (data changes)
- [ ] Multi-table join suggestions
- [ ] Chart recommendation engine based on data characteristics

