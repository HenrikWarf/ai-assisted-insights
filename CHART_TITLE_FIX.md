# Chart Title and Description Fix

**Date:** October 3, 2025  
**Issue:** Charts displaying IDs (1, 2, 3) instead of proper titles

## Problem

Charts were being rendered with their ID numbers (1, 2, 3) as titles instead of the descriptive titles from the plan.json file. Additionally, chart descriptions were not being displayed.

### Example Issue:
- **Displayed**: "1", "2", "3"
- **Should Display**: "YTD Sales: This Year vs Last Year by Market Area"

## Root Cause

In `static/js/services/visualizer.js`, the chart rendering code was:
1. Taking the chart key (e.g., "chart_1")
2. Formatting it as a title instead of looking it up in the plan
3. Not retrieving the description at all

**Old Code:**
```javascript
const title = chartKey.replace('chart_', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
```

This would turn "chart_1" into "1", not "YTD Sales: This Year vs Last Year by Market Area".

## Solution Implemented

Updated the `renderCustomRoleCharts()` method to:

1. **Extract the chart ID** from the key (e.g., "chart_1" → "1")
2. **Look up the chart** in the plan data using the extracted ID
3. **Use the actual title** from the plan instead of formatted key
4. **Display the description** under the title
5. **Properly escape HTML** to prevent XSS issues

### Key Changes:

```javascript
// Extract chart ID from key (e.g., "chart_1" -> "1")
const chartIdFromKey = chartKey.replace('chart_', '');

// Get chart info from the plan
let title = chartIdFromKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()); // fallback
let description = '';
let chartType = 'bar';

if (window.__LATEST_METRICS__ && window.__LATEST_METRICS__.plan) {
  const charts = window.__LATEST_METRICS__.plan.charts || [];
  const matchingChart = charts.find(chart => String(chart.id) === chartIdFromKey);
  if (matchingChart) {
    if (matchingChart.title) title = matchingChart.title;
    if (matchingChart.description) description = matchingChart.description;
    if (matchingChart.type) chartType = matchingChart.type;
  }
}
```

### Display Format:

```html
<h3>YTD Sales: This Year vs Last Year by Market Area</h3>
<p style="color: #6b7280; font-size: 14px;">
  Compares the total Year-to-Date (YTD) sales for the current year 
  against the same period last year, broken down by Primary Market Area. 
  This helps identify which markets are growing or declining.
</p>
```

## Files Modified

1. ✅ `static/js/services/visualizer.js`
   - Updated `renderCustomRoleCharts()` method
   - Added description rendering
   - Added proper HTML escaping
   - Fixed chart ID matching logic

## Features Added

✅ **Proper Chart Titles**: Charts now display their full descriptive titles  
✅ **Chart Descriptions**: Descriptions appear under titles in gray text  
✅ **HTML Escaping**: All user content is properly escaped for security  
✅ **Fallback Support**: If plan data is missing, falls back to formatted ID  

## Visual Improvements

**Before:**
```
┌─────────────────┐
│ 1               │ ← Just the ID
├─────────────────┤
│ [Chart Here]    │
└─────────────────┘
```

**After:**
```
┌──────────────────────────────────────────────────────┐
│ YTD Sales: This Year vs Last Year by Market Area    │
│                                                       │
│ Compares the total Year-to-Date (YTD) sales for     │
│ the current year against the same period last year... │
├──────────────────────────────────────────────────────┤
│ [Chart Here]                                          │
└──────────────────────────────────────────────────────┘
```

## Testing

To verify the fix:

1. **Refresh the dashboard** (Ctrl+F5 / Cmd+Shift+R)
2. **Check chart section headers** - Should show full descriptive titles
3. **Read descriptions** - Gray text under each title explaining the chart
4. **Verify all charts** - Each should have its unique title from the plan

### Expected Titles (Sales Analyst):
- ✅ "YTD Sales: This Year vs Last Year by Market Area"
- ✅ "Weekly Sales Trend: This Year vs Last Year"
- ✅ "YTD Sales Contribution by Product Area"
- ✅ "Rolling 4-Week Sales Performance by Market"
- ✅ "Top 10 Markets by YTD Sales Growth"

## Security Note

Added `escapeHtml()` function calls to prevent XSS attacks from user-generated content in titles and descriptions. This ensures that if any HTML/JavaScript is in the plan data, it's safely displayed as text rather than executed.

---

**Status:** Complete ✅  
**Ready for Testing:** YES  

