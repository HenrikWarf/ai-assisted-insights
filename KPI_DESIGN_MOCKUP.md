# Enhanced KPI System - Design Mockup

## Visual Design Overview

### 1. KPI Card - Collapsed State

```
┌─────────────────────────────────────────────────────────────┐
│ ╔═══════════════════════════════════════════════════════╗   │
│ ║ 🎨 Gradient: #ffffff → #f8fafc                         ║   │
│ ║ Border: 1px solid #e2e8f0                             ║   │
│ ║ Border-radius: 12px                                   ║   │
│ ║ Shadow: 0 2px 4px rgba(0,0,0,0.05)                    ║   │
│ ╚═══════════════════════════════════════════════════════╝   │
│                                                             │
│  TOTAL YTD SALES (THIS YEAR)              [✏️] [🗑️]  [▼]  │
│  ─────────────────────────────────────────                 │
│                                                             │
│  $2,456,789                                                 │
│  ────────────                                              │
│  ↗ 15.3% vs last period                                    │
│  ───────────────────                                       │
│                                                             │
│  The total sales from the beginning of the year to         │
│  the current date for this year.                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Hover State:**
- Card lifts: `translateY(-2px)`
- Shadow increases: `0 8px 25px rgba(0,0,0,0.1)`
- Top gradient bar fades in
- Edit & Delete icons become visible

---

### 2. KPI Card - Expanded State

```
┌─────────────────────────────────────────────────────────────┐
│  TOTAL YTD SALES (THIS YEAR)              [✏️] [🗑️]  [▲]  │
│  ─────────────────────────────────────────                 │
│                                                             │
│  $2,456,789                                                 │
│  ↗ 15.3% vs last period                                    │
│                                                             │
│  The total sales from the beginning of the year to         │
│  the current date for this year.                           │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ ░░░░░░░░░ DETAILS SECTION (Background: #f8fafc) ░░░░░░░░░   │
│                                                             │
│  📊 CALCULATION DETAILS                                     │
│  ───────────────────────────────────────                   │
│  Table:          pa_sales                                  │
│  Current Value:  $2,456,789                                │
│                                                             │
│  💻 SQL QUERY                                               │
│  ───────────────────────────────────────                   │
│  ┌────────────────────────────────────────────────┐  [📋]  │
│  │ SELECT SUM("YTD_This_Year_Sales")              │        │
│  │ FROM "pa_sales"                                │        │
│  └────────────────────────────────────────────────┘        │
│  Background: #1e293b (dark code theme)                     │
│  Text: #e2e8f0                                             │
│                                                             │
│  [🔍 Show Columns Used]                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### 3. Edit KPI Modal

```
┌──────────────────────────────────────────────────────────────┐
│                          Edit KPI                      [✕]   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Title                                                       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Total YTD Sales (This Year)                            │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Description                                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ The total sales from the beginning of the year to      │ │
│  │ the current date for this year.                        │ │
│  │                                                         │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Table                                                       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ pa_sales                                                │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  SQL Formula                                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ SELECT SUM("YTD_This_Year_Sales")                       │ │
│  │ FROM "pa_sales"                                         │ │
│  │                                                         │ │
│  │                                                         │ │
│  │                                                         │ │
│  │                                                         │ │
│  └────────────────────────────────────────────────────────┘ │
│  Complete SQLite SELECT statement                            │
│                                                              │
│  [Test Query]  [✨ Ask Gemini to Improve]                   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ✓ Query Successful                                  │   │
│  │ Result: 2456789.45                                  │   │
│  │ {                                                   │   │
│  │   "SUM(\"YTD_This_Year_Sales\")": 2456789.45        │   │
│  │ }                                                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                [Cancel]  [Save Changes]      │
└──────────────────────────────────────────────────────────────┘
```

---

### 4. Add KPI Modal - Manual Tab

```
┌──────────────────────────────────────────────────────────────┐
│                         Add New KPI                    [✕]   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────┬─────────────────────┐              │
│  │ ▶ Manual Entry      │  AI-Assisted        │              │
│  └─────────────────────┴─────────────────────┘              │
│                                                              │
│  ID (unique identifier)                                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ total_revenue_q4                                        │ │
│  └────────────────────────────────────────────────────────┘ │
│  Use snake_case, e.g., total_revenue                        │
│                                                              │
│  Title                                                       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Total Revenue Q4                                        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Description                                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Total revenue for Q4 (Oct-Dec)                          │ │
│  │                                                         │ │
│  │                                                         │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Table                                                       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ sales_data                                              │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  SQL Formula                                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ SELECT SUM("revenue")                                   │ │
│  │ FROM "sales_data"                                       │ │
│  │ WHERE strftime('%m', "date") IN ('10','11','12')        │ │
│  │                                                         │ │
│  │                                                         │ │
│  └────────────────────────────────────────────────────────┘ │
│  Complete SQLite SELECT statement                            │
│                                                              │
│  [Test Query]                                                │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                [Cancel]  [Create KPI]        │
└──────────────────────────────────────────────────────────────┘
```

---

### 5. Add KPI Modal - AI-Assisted Tab

```
┌──────────────────────────────────────────────────────────────┐
│                         Add New KPI                    [✕]   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────┬─────────────────────┐              │
│  │  Manual Entry       │ ▶ AI-Assisted       │              │
│  └─────────────────────┴─────────────────────┘              │
│                                                              │
│  Describe the KPI you want to create                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Show me the total revenue for the Detroit market       │ │
│  │ compared to last year                                  │ │
│  │                                                        │ │
│  │                                                        │ │
│  └────────────────────────────────────────────────────────┘ │
│  Be specific about what you want to measure                 │
│                                                              │
│  [✨ Generate KPI with AI]                                  │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Generated KPI                                        │   │
│  │ ─────────────                                        │   │
│  │ {                                                    │   │
│  │   "id": "detroit_market_revenue_yoy",                │   │
│  │   "title": "Detroit Market Revenue (YoY)",           │   │
│  │   "description": "Total revenue in Detroit...",      │   │
│  │   "formula": "SELECT SUM(revenue) FROM...",          │   │
│  │   "table": "sales_data"                              │   │
│  │ }                                                    │   │
│  │                                                      │   │
│  │ [Use This KPI]                                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                [Cancel]  [Create KPI]        │
└──────────────────────────────────────────────────────────────┘
```

---

### 6. Column Analysis Modal

```
┌──────────────────────────────────────────────────────────────┐
│                   KPI Column Analysis                  [✕]   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Columns Used:                                               │
│  ────────────────                                           │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  YTD_This_Year_Sales                                    │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  YTD_Last_Year_Sales                                    │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Aggregations:                                               │
│  ──────────────                                             │
│                                                              │
│  • SUM                                                       │
│                                                              │
│  ─────────────────────────────────────────────────────      │
│  Table: pa_sales                                            │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                              [OK]            │
└──────────────────────────────────────────────────────────────┘
```

---

## Color Palette

### Primary Colors
- **Brand Blue:** `#3b82f6`
- **Brand Purple:** `#8b5cf6`
- **Success Green:** `#059669`
- **Error Red:** `#dc2626`
- **Warning Orange:** `#f59e0b`

### Neutral Colors
- **Background:** `#f8fafc`
- **Surface:** `#ffffff`
- **Border:** `#e2e8f0`
- **Text Primary:** `#1e293b`
- **Text Secondary:** `#64748b`
- **Text Muted:** `#94a3b8`

### Code Theme (Dark)
- **Background:** `#1e293b`
- **Text:** `#e2e8f0`
- **Overlay:** `rgba(255, 255, 255, 0.1)`

---

## Typography

### Font Family
- **Primary:** `'SF Pro Text', system-ui, -apple-system, 'Segoe UI', sans-serif`
- **Code:** `'Monaco', 'Menlo', 'Courier New', monospace`

### Font Sizes
- **Title:** `14px` (uppercase, bold, letter-spacing: 0.5px)
- **Value:** `28px` (bold)
- **Trend:** `12px` (medium)
- **Description:** `13px` (regular)
- **Label:** `14px` (semibold)
- **Code:** `12-13px` (monospace)

---

## Animations

### Card Hover
```css
transition: all 0.3s ease;
transform: translateY(-2px);
box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
```

### Expand/Collapse
```css
@keyframes slideDown {
  from {
    opacity: 0;
    max-height: 0;
  }
  to {
    opacity: 1;
    max-height: 500px;
  }
}
animation: slideDown 0.3s ease;
```

### Button Hover
```css
transition: all 0.2s ease;
background: rgba(59, 130, 246, 0.1);
color: #3b82f6;
```

---

## Responsive Behavior

### Desktop (> 1200px)
- Grid: 3 columns
- Modal width: 800px
- Card padding: 24px

### Tablet (768px - 1200px)
- Grid: 2 columns
- Modal width: 90%
- Card padding: 20px

### Mobile (< 768px)
- Grid: 1 column
- Modal width: 95%
- Card padding: 16px
- Actions stack vertically

---

## Accessibility

### ARIA Labels
- Expand buttons: `aria-expanded="true/false"`
- Modals: `role="dialog"` with `aria-labelledby`
- Buttons: Descriptive `aria-label` or text content

### Keyboard Navigation
- Tab through all interactive elements
- Enter/Space to activate buttons
- Escape to close modals
- Focus trap within modals

### Color Contrast
- All text meets WCAG AA standards
- Interactive elements have visible focus states
- Error states use both color and icons

---

## Icon Set

Using inline SVG icons from Feather Icons:
- **Edit:** Pen/Edit icon
- **Delete:** Trash icon
- **Expand:** Chevron down/up
- **Copy:** Copy/Clipboard icon
- **Add:** Plus icon
- **AI:** Sparkles/Zap icon
- **Search:** Magnifying glass icon
- **Success:** Check circle
- **Error:** X circle

---

## States & Feedback

### Loading State
- Shimmer effect on cards
- "Generating..." text with spinner
- Disabled buttons with opacity 0.5

### Success State
- Green border-left: `4px solid #22c55e`
- Green background: `#f0fdf4`
- Checkmark icon

### Error State
- Red border-left: `4px solid #ef4444`
- Red background: `#fef2f2`
- X icon
- Error message text

### Empty State
- Centered content
- Large icon or illustration
- Call-to-action button
- Helpful guidance text

---

## Performance Considerations

- CSS animations use `transform` and `opacity` for 60fps
- Lazy load modal content
- Debounce search inputs
- Cache API responses where appropriate
- Use CSS containment for cards
- Minimize repaints with `will-change`

---

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- No IE11 support (uses modern CSS features)

---

## Design System Integration

This design follows and extends the existing platform design with:
- ✅ Consistent color palette
- ✅ Matching button styles
- ✅ Compatible with existing panels
- ✅ Uses same typography scale
- ✅ Maintains spacing rhythm (4px grid)
- ✅ Follows accessibility guidelines

**Result:** Seamless integration that feels native to the platform! 🎨

