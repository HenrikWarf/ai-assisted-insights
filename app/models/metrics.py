"""
Metrics models and business logic.

This module contains functions for building and processing metrics data for different roles.
"""

from datetime import datetime, timedelta
from app.database import get_db_connection


def filter_data_for_short_term(data: dict) -> dict:
    """
    Filter data to only include the last 2 weeks for short-term analysis.
    
    Args:
        data (dict): Dictionary containing metrics data
        
    Returns:
        dict: Filtered data containing only the last 2 weeks of data
    """
    # Calculate 2 weeks ago
    two_weeks_ago = (datetime.now() - timedelta(days=14)).strftime('%Y-%m-%d')
    
    filtered_data = {}
    for key, values in data.items():
        if isinstance(values, list) and len(values) > 0:
            # Filter to only include data from last 2 weeks
            filtered_values = [item for item in values if item.get('day', '') >= two_weeks_ago]
            filtered_data[key] = filtered_values
        else:
            filtered_data[key] = values
    
    return filtered_data


def build_metrics_for_role(role: str) -> dict:
    """
    Build metrics data for a specific role.
    
    This function queries the database and builds a comprehensive metrics dictionary
    tailored to the specific role (E-commerce Manager, Marketing Lead, etc.).
    
    Args:
        role (str): The role name to build metrics for
        
    Returns:
        dict: Dictionary containing role-specific metrics data
    """
    conn = get_db_connection()
    cur = conn.cursor()
    resp = {}
    
    # E-commerce metrics (up to ~90 days) - ORDER BY day ASC for chronological analysis
    cur.execute("SELECT * FROM vw_ecom_daily_funnel ORDER BY day ASC LIMIT 90")
    resp["ecom_funnel"] = [dict(r) for r in cur.fetchall()]
    cur.execute("SELECT * FROM vw_payment_failures ORDER BY day ASC LIMIT 90")
    resp["payment_failures"] = [dict(r) for r in cur.fetchall()]
    cur.execute("SELECT * FROM vw_zero_result_search ORDER BY day ASC LIMIT 90")
    resp["zero_result_search"] = [dict(r) for r in cur.fetchall()]
    cur.execute("SELECT * FROM vw_plp_perf ORDER BY day ASC LIMIT 90")
    resp["plp_perf"] = [dict(r) for r in cur.fetchall()]
    cur.execute("SELECT * FROM vw_product_conv WHERE product IN ('Sneakers','Denim Jacket','Graphic Tee','Chino Pants','Hoodie') ORDER BY day ASC LIMIT 120")
    resp["product_conv"] = [dict(r) for r in cur.fetchall()]
    
    # Advanced e-com
    cur.execute("SELECT * FROM vw_ecom_rates_by_day ORDER BY day ASC LIMIT 180")
    resp["ecom_rates_by_day"] = [dict(r) for r in cur.fetchall()]
    cur.execute("SELECT * FROM vw_ecom_mobile_desktop_delta ORDER BY day ASC LIMIT 90")
    resp["ecom_mobile_desktop_delta"] = [dict(r) for r in cur.fetchall()]
    cur.execute("SELECT * FROM vw_zero_result_top_share ORDER BY day ASC LIMIT 90")
    resp["zero_result_top_share"] = [dict(r) for r in cur.fetchall()]
    cur.execute("SELECT * FROM vw_sku_efficiency ORDER BY day ASC LIMIT 500")
    resp["sku_efficiency"] = [dict(r) for r in cur.fetchall()]
    cur.execute("SELECT * FROM vw_return_rate_trend ORDER BY day ASC LIMIT 180")
    resp["return_rate_trend"] = [dict(r) for r in cur.fetchall()]
    
    # Marketing metrics
    cur.execute("SELECT * FROM vw_mkt_roas_campaign ORDER BY day ASC, roas ASC LIMIT 180")
    resp["mkt_roas_campaign"] = [dict(r) for r in cur.fetchall()]
    cur.execute("SELECT * FROM vw_creative_ctr ORDER BY day ASC")
    resp["creative_ctr"] = [dict(r) for r in cur.fetchall()]
    cur.execute("SELECT * FROM vw_budget_pacing_var ORDER BY day ASC LIMIT 220")
    resp["budget_pacing"] = [dict(r) for r in cur.fetchall()]
    cur.execute("SELECT * FROM vw_disapprovals ORDER BY day ASC LIMIT 180")
    resp["disapprovals"] = [dict(r) for r in cur.fetchall()]
    cur.execute("SELECT * FROM vw_brand_health ORDER BY day ASC LIMIT 90")
    resp["brand_health"] = [dict(r) for r in cur.fetchall()]
    
    # Advanced mkt
    cur.execute("SELECT * FROM vw_campaign_kpis ORDER BY day ASC LIMIT 400")
    resp["campaign_kpis"] = [dict(r) for r in cur.fetchall()]
    cur.execute("SELECT * FROM vw_disapproval_rate ORDER BY day ASC LIMIT 180")
    resp["disapproval_rate"] = [dict(r) for r in cur.fetchall()]
    cur.execute("SELECT * FROM vw_brand_lift_proxy ORDER BY day ASC LIMIT 90")
    resp["brand_lift_proxy"] = [dict(r) for r in cur.fetchall()]
    cur.execute("SELECT * FROM vw_sentiment_social_roas ORDER BY day ASC LIMIT 90")
    resp["sentiment_social_roas"] = [dict(r) for r in cur.fetchall()]
    
    conn.close()
    
    # Filter by role
    if role == "E-commerce Manager":
        for k in [
            "mkt_roas_campaign","creative_ctr","budget_pacing","disapprovals","brand_health",
            "campaign_kpis","disapproval_rate","brand_lift_proxy","sentiment_social_roas"
        ]:
            resp.pop(k, None)
    elif role == "Marketing Lead":
        for k in [
            "ecom_funnel","payment_failures","zero_result_search","plp_perf","product_conv",
            "ecom_rates_by_day","ecom_mobile_desktop_delta","zero_result_top_share","sku_efficiency","return_rate_trend"
        ]:
            resp.pop(k, None)
    
    return {"role": role, "metrics": resp}
