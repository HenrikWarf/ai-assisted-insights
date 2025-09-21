import sqlite3
from pathlib import Path
import os

APP_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = APP_ROOT / 'data'
DB_PATH = DATA_DIR / 'cfc.db'

DATA_DIR.mkdir(parents=True, exist_ok=True)

conn = sqlite3.connect(str(DB_PATH))
cur = conn.cursor()

cur.executescript(
    """
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        price REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stores (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        region TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inventory (
        store_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        on_hand INTEGER NOT NULL,
        threshold INTEGER NOT NULL DEFAULT 5,
        PRIMARY KEY (store_id, product_id),
        FOREIGN KEY (store_id) REFERENCES stores(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY,
        store_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        sale_ts TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (store_id) REFERENCES stores(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS actions (
        id INTEGER PRIMARY KEY,
        role TEXT NOT NULL,
        action_type TEXT NOT NULL,
        details_json TEXT,
        created_ts TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- E-commerce manager synthetic data tables
    CREATE TABLE IF NOT EXISTS web_sessions (
        id INTEGER PRIMARY KEY,
        session_date TEXT NOT NULL,
        device TEXT NOT NULL,
        source TEXT NOT NULL,
        sessions INTEGER NOT NULL,
        pdp_views INTEGER NOT NULL,
        add_to_cart INTEGER NOT NULL,
        checkouts INTEGER NOT NULL,
        purchases INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS page_performance (
        id INTEGER PRIMARY KEY,
        day TEXT NOT NULL,
        page_type TEXT NOT NULL,
        p75_lcp_ms INTEGER NOT NULL,
        p75_fid_ms INTEGER NOT NULL,
        p75_cls FLOAT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS product_performance (
        id INTEGER PRIMARY KEY,
        product_id INTEGER NOT NULL,
        day TEXT NOT NULL,
        views INTEGER NOT NULL,
        add_to_carts INTEGER NOT NULL,
        purchases INTEGER NOT NULL,
        FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS search_queries (
        id INTEGER PRIMARY KEY,
        day TEXT NOT NULL,
        query TEXT NOT NULL,
        searches INTEGER NOT NULL,
        clicks INTEGER NOT NULL,
        zero_results INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS checkout_failures (
        id INTEGER PRIMARY KEY,
        day TEXT NOT NULL,
        step TEXT NOT NULL,
        failures INTEGER NOT NULL,
        reason TEXT
    );

    CREATE TABLE IF NOT EXISTS channel_performance (
        id INTEGER PRIMARY KEY,
        day TEXT NOT NULL,
        channel TEXT NOT NULL,
        spend REAL NOT NULL,
        revenue REAL NOT NULL,
        sessions INTEGER NOT NULL,
        purchases INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS returns (
        id INTEGER PRIMARY KEY,
        day TEXT NOT NULL,
        product_id INTEGER NOT NULL,
        returns INTEGER NOT NULL,
        reason TEXT,
        FOREIGN KEY (product_id) REFERENCES products(id)
    );

    -- Marketing lead synthetic data tables
    CREATE TABLE IF NOT EXISTS marketing_campaigns (
        id INTEGER PRIMARY KEY,
        day TEXT NOT NULL,
        channel TEXT NOT NULL,
        campaign TEXT NOT NULL,
        spend REAL NOT NULL,
        impressions INTEGER NOT NULL,
        clicks INTEGER NOT NULL,
        sessions INTEGER NOT NULL,
        purchases INTEGER NOT NULL,
        revenue REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS creative_performance (
        id INTEGER PRIMARY KEY,
        day TEXT NOT NULL,
        channel TEXT NOT NULL,
        creative_id TEXT NOT NULL,
        variant TEXT NOT NULL,
        impressions INTEGER NOT NULL,
        clicks INTEGER NOT NULL,
        conversions INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS budget_pacing (
        id INTEGER PRIMARY KEY,
        month TEXT NOT NULL,
        day TEXT NOT NULL,
        channel TEXT NOT NULL,
        planned_spend REAL NOT NULL,
        actual_spend REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS brand_health (
        id INTEGER PRIMARY KEY,
        day TEXT NOT NULL,
        branded_search_volume INTEGER NOT NULL,
        social_sentiment_score REAL NOT NULL,
        nps INTEGER
    );

    CREATE TABLE IF NOT EXISTS ad_disapprovals (
        id INTEGER PRIMARY KEY,
        day TEXT NOT NULL,
        channel TEXT NOT NULL,
        disapprovals INTEGER NOT NULL,
        reason TEXT
    );

    -- Store Gemini analysis runs (one row per run)
    CREATE TABLE IF NOT EXISTS analysis_runs (
      id INTEGER PRIMARY KEY,
      role TEXT NOT NULL,
      created_ts TEXT NOT NULL DEFAULT (datetime('now')),
      summary TEXT,
      issue1_title TEXT, issue1_why TEXT, issue1_category TEXT, issue1_evidence_json TEXT,
      issue2_title TEXT, issue2_why TEXT, issue2_category TEXT, issue2_evidence_json TEXT,
      issue3_title TEXT, issue3_why TEXT, issue3_category TEXT, issue3_evidence_json TEXT,
      analysis_json TEXT
    );
    """
)

# Seed data if empty
cur.execute("SELECT COUNT(*) FROM products")
if cur.fetchone()[0] == 0:
    cur.executemany(
        "INSERT INTO products(name, category, price) VALUES (?, ?, ?)",
        [
            ("Denim Jacket", "Outerwear", 79.0),
            ("Graphic Tee", "Tops", 24.0),
            ("Sneakers", "Footwear", 99.0),
            ("Chino Pants", "Bottoms", 59.0),
            ("Hoodie", "Tops", 49.0),
        ],
    )

cur.execute("SELECT COUNT(*) FROM stores")
if cur.fetchone()[0] == 0:
    cur.executemany(
        "INSERT INTO stores(name, region) VALUES (?, ?)",
        [
            ("SoHo Flagship", "East"),
            ("LA Melrose", "West"),
            ("Chicago Loop", "Midwest"),
        ],
    )

# Inventory baseline
cur.execute("SELECT COUNT(*) FROM inventory")
if cur.fetchone()[0] == 0:
    # map every store x product with on_hand values
    cur.execute("SELECT id FROM stores")
    store_ids = [row[0] for row in cur.fetchall()]
    cur.execute("SELECT id FROM products")
    product_ids = [row[0] for row in cur.fetchall()]
    rows = []
    for s in store_ids:
        for p in product_ids:
            rows.append((s, p, 10, 5))
    cur.executemany("INSERT INTO inventory(store_id, product_id, on_hand, threshold) VALUES (?, ?, ?, ?)", rows)

# Some sales to have recent activity
cur.execute("SELECT COUNT(*) FROM sales")
if cur.fetchone()[0] == 0:
    cur.execute("SELECT id FROM stores")
    stores = [r[0] for r in cur.fetchall()]
    cur.execute("SELECT id FROM products")
    products = [r[0] for r in cur.fetchall()]
    sales_rows = []
    for i in range(20):
        s = stores[i % len(stores)]
        p = products[i % len(products)]
        qty = (i % 4) + 1
        sales_rows.append((s, p, qty))
    cur.executemany("INSERT INTO sales(store_id, product_id, quantity) VALUES (?, ?, ?)", sales_rows)

# Populate e-commerce synthetic data if empty
cur.execute("SELECT COUNT(*) FROM web_sessions")
if cur.fetchone()[0] == 0:
    import datetime
    base = []
    
    # Generate daily data for July-September 2025 (90+ days)
    start_date = datetime.date(2025, 7, 1)
    end_date = datetime.date(2025, 9, 30)
    
    current_date = start_date
    day_offset = 0
    
    while current_date <= end_date:
        # Create realistic daily variations with trends
        base_sessions = 4000 + (day_offset * 20)  # Growing trend
        weekend_factor = 0.7 if current_date.weekday() >= 5 else 1.0
        
        # Mobile vs Desktop split
        mobile_sessions = int(base_sessions * 0.6 * weekend_factor)
        desktop_sessions = int(base_sessions * 0.4 * weekend_factor)
        
        # Conversion rates with some variation - more realistic rates
        pdp_rate = 0.65 + (day_offset % 7) * 0.02  # Weekly pattern
        atc_rate = 0.25 + (day_offset % 5) * 0.01
        co_rate = 0.75 + (day_offset % 3) * 0.02
        purchase_rate = 0.85 + (day_offset % 4) * 0.01
        
        # Mobile data
        mobile_pdp = int(mobile_sessions * pdp_rate)
        mobile_atc = int(mobile_pdp * atc_rate)
        mobile_co = int(mobile_atc * co_rate)
        mobile_purchase = int(mobile_co * purchase_rate)
        
        # Desktop data
        desktop_pdp = int(desktop_sessions * pdp_rate)
        desktop_atc = int(desktop_pdp * atc_rate)
        desktop_co = int(desktop_atc * co_rate)
        desktop_purchase = int(desktop_co * purchase_rate)
        
        # Add different sources
        sources = ['seo', 'paid', 'email', 'social']
        source_idx = day_offset % len(sources)
        
        base.extend([
            (current_date.strftime('%Y-%m-%d'), "mobile", sources[source_idx], mobile_sessions, mobile_pdp, mobile_atc, mobile_co, mobile_purchase),
            (current_date.strftime('%Y-%m-%d'), "desktop", sources[source_idx], desktop_sessions, desktop_pdp, desktop_atc, desktop_co, desktop_purchase)
        ])
        
        current_date += datetime.timedelta(days=1)
        day_offset += 1
    
    cur.executemany("INSERT INTO web_sessions(session_date, device, source, sessions, pdp_views, add_to_cart, checkouts, purchases) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", base)

cur.execute("DELETE FROM page_performance")
import datetime
perf_rows = []
start_date = datetime.date(2025, 7, 1)
end_date = datetime.date(2025, 9, 30)
current_date = start_date
day_offset = 0
while current_date <= end_date:
    # Create mild trends and occasional degradation spikes
    base_lcp = 2100 + (day_offset % 20) * 5
    base_fid = 18 + (day_offset % 10)
    base_cls = 0.07 + ((day_offset % 5) * 0.005)
    # Simulate a PLP degradation mid-September
    if datetime.date(2025, 9, 15) <= current_date <= datetime.date(2025, 9, 18):
        plp_lcp = base_lcp + 500
        plp_cls = min(base_cls + 0.06, 0.25)
    else:
        plp_lcp = base_lcp + 50
        plp_cls = base_cls + 0.01
    # Rows for home, plp, pdp
    perf_rows.extend([
        (current_date.strftime('%Y-%m-%d'), "home", base_lcp - 50, base_fid, max(0.05, base_cls - 0.01)),
        (current_date.strftime('%Y-%m-%d'), "plp", plp_lcp, base_fid + 2, plp_cls),
        (current_date.strftime('%Y-%m-%d'), "pdp", base_lcp, base_fid + 1, base_cls)
    ])
    current_date += datetime.timedelta(days=1)
    day_offset += 1
cur.executemany("INSERT INTO page_performance(day, page_type, p75_lcp_ms, p75_fid_ms, p75_cls) VALUES (?, ?, ?, ?, ?)", perf_rows)

cur.execute("SELECT COUNT(*) FROM product_performance")
if cur.fetchone()[0] == 0:
    import datetime
    cur.execute("SELECT id FROM products WHERE name='Sneakers'")
    sneakers_id = cur.fetchone()[0]
    cur.execute("SELECT id FROM products WHERE name='Denim Jacket'")
    denim_id = cur.fetchone()[0]
    cur.execute("SELECT id FROM products WHERE name='Graphic Tee'")
    tee_id = cur.fetchone()[0]
    cur.execute("SELECT id FROM products WHERE name='Chino Pants'")
    chino_id = cur.fetchone()[0]
    cur.execute("SELECT id FROM products WHERE name='Hoodie'")
    hoodie_id = cur.fetchone()[0]
    
    products = [sneakers_id, denim_id, tee_id, chino_id, hoodie_id]
    prod_rows = []
    
    # Generate daily data for July-September 2025
    start_date = datetime.date(2025, 7, 1)
    end_date = datetime.date(2025, 9, 30)
    
    current_date = start_date
    day_offset = 0
    
    while current_date <= end_date:
        for product_id in products:
            # Base performance with trends
            base_views = 2000 + (day_offset * 10) + (product_id * 200)
            weekend_factor = 0.8 if current_date.weekday() >= 5 else 1.0
            
            views = int(base_views * weekend_factor)
            add_to_carts = int(views * (0.15 + (day_offset % 7) * 0.01))
            # Improve conversion over time for top SKUs (Sneakers, Denim Jacket)
            progress = day_offset / 92.0
            conv_base = 0.4 + (day_offset % 5) * 0.02
            if product_id in (sneakers_id, denim_id):
                conv_base *= (1.0 + 0.25 * progress)
            purchases = int(add_to_carts * conv_base)
            
            prod_rows.append((product_id, current_date.strftime('%Y-%m-%d'), views, add_to_carts, purchases))
        
        current_date += datetime.timedelta(days=1)
        day_offset += 1
    
    cur.executemany("INSERT INTO product_performance(product_id, day, views, add_to_carts, purchases) VALUES (?, ?, ?, ?, ?)", prod_rows)

cur.execute("DELETE FROM search_queries")
search_rows = []
start_date = datetime.date(2025, 7, 1)
end_date = datetime.date(2025, 9, 30)
current_date = start_date
day_offset = 0
queries = ["sneakers", "hoodie", "dress", "linen jacket", "denim jacket", "chino pants"]
while current_date <= end_date:
    for i, q in enumerate(queries):
        base_searches = 1200 + (i * 200) + (day_offset % 7) * 30
        ctr = 0.45 - (i * 0.03)  # popular terms have higher CTR
        # Steady improvement: zero-result bias trends down ~30% over 3 months
        progress = day_offset / 92.0
        base_zero_bias = 0.05 + (0.02 if q in ("linen jacket", "denim jacket") else 0)
        zero_bias = max(0.005, base_zero_bias * (1.0 - 0.3 * progress))
        searches = int(base_searches)
        clicks = int(searches * max(0.05, min(ctr, 0.6)))
        zero_results = int(searches * zero_bias * (0.8 if (day_offset % 10) else 1.5))
        search_rows.append((current_date.strftime('%Y-%m-%d'), q, searches, clicks, zero_results))
    current_date += datetime.timedelta(days=1)
    day_offset += 1
cur.executemany("INSERT INTO search_queries(day, query, searches, clicks, zero_results) VALUES (?, ?, ?, ?, ?)", search_rows)

import datetime
# Always regenerate checkout_failures to ensure daily coverage
cur.execute("DELETE FROM checkout_failures")
fail_rows = []
# Daily failures across the whole range with known spikes
start_date = datetime.date(2025, 7, 1)
end_date = datetime.date(2025, 9, 30)
current_date = start_date
day_offset = 0
while current_date <= end_date:
    # Baseline failures and reasons
    # Overall steady decline across the quarter with spike + recovery
    decline = max(0, int(day_offset * 0.1))
    base_payment = max(3, 12 + (day_offset % 5) * 2 - decline)
    base_address = 5 + (day_offset % 3)
    base_stock = 3 + (day_offset % 2)
    reason_payment = "declines"
    reason_address = "validation_error"
    reason_stock = "oos_block"

    # Introduce realistic spikes in September mid-month (problem scenario)
    if datetime.date(2025, 9, 16) <= current_date <= datetime.date(2025, 9, 20):
        base_payment += 220  # payment gateway issue spike
        reason_payment = "gateway_timeout"

    # After the spike, drive a meaningful recovery through end of Sept
    if current_date > datetime.date(2025, 9, 20):
        days_after_spike = (current_date - datetime.date(2025, 9, 20)).days
        base_payment = max(2, int(base_payment * (1.0 - min(0.5, days_after_spike * 0.04))))

    # Occasional weekend increase due to traffic but similar failure rate
    if current_date.weekday() >= 5:
        base_payment = int(base_payment * 1.15)
        base_address = int(base_address * 1.1)

    fail_rows.extend([
        (current_date.strftime('%Y-%m-%d'), "payment", base_payment, reason_payment),
        (current_date.strftime('%Y-%m-%d'), "address", base_address, reason_address),
        (current_date.strftime('%Y-%m-%d'), "inventory", base_stock, reason_stock)
    ])

    current_date += datetime.timedelta(days=1)
    day_offset += 1

cur.executemany("INSERT INTO checkout_failures(day, step, failures, reason) VALUES (?, ?, ?, ?)", fail_rows)

cur.execute("SELECT COUNT(*) FROM channel_performance")
if cur.fetchone()[0] == 0:
    chan_rows = [
        ("2025-09-16", "paid_search", 3000.0, 12000.0, 4000, 380),
        ("2025-09-16", "social", 2500.0, 7000.0, 3500, 260),
        ("2025-09-17", "paid_search", 3000.0, 9000.0, 4100, 290),
        ("2025-09-17", "social", 2500.0, 6800.0, 3600, 250)
    ]
    cur.executemany("INSERT INTO channel_performance(day, channel, spend, revenue, sessions, purchases) VALUES (?, ?, ?, ?, ?, ?)", chan_rows)

cur.execute("SELECT COUNT(*) FROM returns")
if cur.fetchone()[0] == 0:
    cur.execute("SELECT id FROM products WHERE name='Chino Pants'")
    chino_id = cur.fetchone()[0]
    ret_rows = [
        ("2025-09-16", chino_id, 15, "fit"),
        ("2025-09-17", chino_id, 18, "fit")
    ]
    cur.executemany("INSERT INTO returns(day, product_id, returns, reason) VALUES (?, ?, ?, ?)", ret_rows)

# Populate marketing synthetic data if empty
cur.execute("DELETE FROM marketing_campaigns")
import datetime
camp_rows = []

# Generate daily data for July-September 2025
start_date = datetime.date(2025, 7, 1)
end_date = datetime.date(2025, 9, 30)

current_date = start_date
day_offset = 0

campaigns = [
        ("paid_search", "Brand - Exact"),
        ("social", "Prospecting - Video"),
        ("display", "Retargeting - Cart"),
        ("email", "Newsletter - Promo")
    ]
    # Performance multipliers per campaign to create differentiation
campaign_conv_factor = {
        "Brand - Exact": 1.60,         # notably better
        "Retargeting - Cart": 2.00,    # best
        "Prospecting - Video": 0.70,   # worse
        "Newsletter - Promo": 0.60     # worst
}
campaign_aov_factor = {
        "Brand - Exact": 1.25,
        "Retargeting - Cart": 1.35,
        "Prospecting - Video": 0.90,
        "Newsletter - Promo": 0.85
}
    
while current_date <= end_date:
    for channel, campaign in campaigns:
        # Base spend with trends
        base_spend = 3000 + (day_offset * 15) + (hash(channel) % 500)
        weekend_factor = 0.6 if current_date.weekday() >= 5 else 1.0
        
        spend = base_spend * weekend_factor
        impressions = int(spend * 200)  # $5 CPM

        # Enhanced CTR calculation with multiple variability factors
        import math
        
        base_ctr = {
            "paid_search": 0.045,  # ~4.5% (Google Ads search network range)
            "social": 0.025,       # ~2.5% (Facebook/Instagram range)
            "display": 0.008,      # ~0.8% (Display network)
            "email": 0.035         # ~3.5% (Email marketing range)
        }.get(channel, 0.020)

        # 1. Multi-frequency seasonality (weekly + bi-weekly + monthly patterns)
        phase = (hash(channel) % 7) / 7.0
        weekly_pattern = 1.0 + 0.12 * math.sin(2 * math.pi * (day_offset / 7.0 + phase))
        
        # Bi-weekly pattern (different for each channel)
        biweekly_phase = (hash(channel + "_biweekly") % 14) / 14.0
        biweekly_pattern = 1.0 + 0.08 * math.sin(2 * math.pi * (day_offset / 14.0 + biweekly_phase))
        
        # Monthly pattern (seasonal trends)
        monthly_pattern = 1.0 + 0.06 * math.sin(2 * math.pi * (day_offset / 30.0))
        
        # 2. Long-term trend with channel-specific evolution
        progress = day_offset / 92.0
        channel_ctr_slope = {
            "paid_search": 0.05,   # slight improvement
            "social": -0.08,       # slight decline
            "display": 0.02,
            "email": 0.03
        }.get(channel, 0.0)
        trend = 1.0 + channel_ctr_slope * progress
        
        # 3. Campaign-specific CTR performance
        campaign_lift = {
            "Brand - Exact": 0.06,
            "Retargeting - Cart": 0.10,
            "Prospecting - Video": -0.06,
            "Newsletter - Promo": -0.04
        }.get(campaign, 0.0)
        
        # 4. Audience fatigue and saturation effects
        fatigue_factor = 1.0
        if campaign == "Retargeting - Cart":
            # Retargeting campaigns can fatigue over time
            fatigue_factor = max(0.85, 1.0 - (day_offset * 0.001))
        elif campaign == "Prospecting - Video":
            # Prospecting campaigns improve as they learn
            fatigue_factor = min(1.15, 1.0 + (day_offset * 0.0008))
        
        # 5. Market saturation effects (simulate competitive pressure)
        saturation_cycle = (day_offset + hash(campaign + "_saturation")) % 21  # 3-week cycles
        if saturation_cycle < 5:  # High saturation period
            saturation_factor = 0.90
        elif saturation_cycle > 16:  # Low saturation period
            saturation_factor = 1.08
        else:
            saturation_factor = 1.0
        
        # 6. Day-of-week effects (different patterns per channel)
        dow_factor = 1.0
        if channel == "social":
            # Social performs better mid-week
            dow_factor = 1.0 + 0.10 * math.sin(2 * math.pi * current_date.weekday() / 7.0)
        elif channel == "email":
            # Email performs better on weekdays
            dow_factor = 1.0 if current_date.weekday() < 5 else 0.85
        elif channel == "display":
            # Display performs better on weekends
            dow_factor = 1.0 + 0.08 * math.sin(2 * math.pi * (current_date.weekday() + 3) / 7.0)
        
        # Combine all CTR factors
        ctr = base_ctr * weekly_pattern * biweekly_pattern * monthly_pattern * trend * \
              (1.0 + campaign_lift) * fatigue_factor * saturation_factor * dow_factor

        # 7. Market events and external factors
        event_factor = 1.0
        
        # Mid-August: Back-to-school shopping surge
        if datetime.date(2025, 8, 15) <= current_date <= datetime.date(2025, 8, 25):
            if campaign in ["Brand - Exact", "Prospecting - Video"]:
                event_factor *= 1.20  # Strong performance during back-to-school
            elif campaign == "Retargeting - Cart":
                event_factor *= 1.15  # Good performance but not as strong
        
        # Early September: Labor Day weekend effect
        if datetime.date(2025, 9, 1) <= current_date <= datetime.date(2025, 9, 4):
            if channel == "social":
                event_factor *= 0.90  # Social performs worse on holiday weekends
            elif channel == "email":
                event_factor *= 1.10  # Email performs better during holidays
        
        # Mid-September: Creative refresh and optimization event
        if datetime.date(2025, 9, 16) <= current_date <= datetime.date(2025, 9, 20):
            if campaign == "Prospecting - Video":
                event_factor *= 0.85  # Creative issue hurts CTR
            elif campaign == "Retargeting - Cart":
                event_factor *= 1.05  # Stronger audience matching that week
            elif campaign == "Brand - Exact":
                event_factor *= 1.08  # Brand campaigns benefit from optimization
        
        # Late September: Holiday prep season begins
        if current_date >= datetime.date(2025, 9, 25):
            if campaign == "Retargeting - Cart":
                event_factor *= 1.12  # Retargeting excels during holiday prep
            elif campaign == "Newsletter - Promo":
                event_factor *= 1.08  # Promotional campaigns pick up
        
        # Major market events and external shocks
        # August 8-12: Major competitor goes out of business (huge opportunity)
        if datetime.date(2025, 8, 8) <= current_date <= datetime.date(2025, 8, 12):
            if campaign in ["Brand - Exact", "Prospecting - Video"]:
                event_factor *= 1.40  # Massive opportunity spike
            elif campaign == "Retargeting - Cart":
                event_factor *= 1.30  # Good opportunity
        
        # August 20-22: Social media platform outage (major disruption)
        if datetime.date(2025, 8, 20) <= current_date <= datetime.date(2025, 8, 22):
            if channel == "social":
                event_factor *= 0.30  # Massive social platform crash
            elif channel == "email":
                event_factor *= 1.25  # Email benefits from social outage
        
        # September 5-7: Major shopping event (Black Friday preview)
        if datetime.date(2025, 9, 5) <= current_date <= datetime.date(2025, 9, 7):
            if campaign == "Retargeting - Cart":
                event_factor *= 1.50  # Huge shopping event boost
            elif campaign == "Newsletter - Promo":
                event_factor *= 1.35  # Promotional campaigns excel
            elif campaign == "Brand - Exact":
                event_factor *= 1.25  # Brand awareness boost
        
        # September 12-14: Economic uncertainty (market downturn)
        if datetime.date(2025, 9, 12) <= current_date <= datetime.date(2025, 9, 14):
            if campaign == "Prospecting - Video":
                event_factor *= 0.70  # Prospecting hardest hit
            elif campaign == "Brand - Exact":
                event_factor *= 0.80  # Brand campaigns affected
            elif campaign == "Retargeting - Cart":
                event_factor *= 0.85  # Retargeting more resilient
        
        # Apply event factor to CTR
        ctr *= event_factor
        
        # Add CTR anomalies and spikes
        ctr_anomaly_factor = 1.0
        
        # Deterministic but random-like CTR anomalies
        ctr_anomaly_seed = (day_offset * 11 + hash(campaign + channel + "ctr")) % 100
        
        # Major CTR spikes (6% chance) - viral content, trending keywords
        if ctr_anomaly_seed < 6:
            if channel == "social" and campaign == "Prospecting - Video":
                ctr_anomaly_factor = 1.60  # Viral video content (up to ~4% CTR)
            elif channel == "paid_search" and campaign == "Brand - Exact":
                ctr_anomaly_factor = 1.50  # Trending brand search (up to ~6.75% CTR)
            elif channel == "email":
                ctr_anomaly_factor = 1.40  # High-performing email subject (up to ~4.9% CTR)
            else:
                ctr_anomaly_factor = 1.30  # General CTR spike
        
        # CTR crashes (10% chance) - ad disapprovals, technical issues
        elif ctr_anomaly_seed < 16:
            if channel == "social":
                ctr_anomaly_factor = 0.60  # Social platform algorithm change
            elif channel == "display":
                ctr_anomaly_factor = 0.55  # Ad blocker impact
            elif campaign == "Prospecting - Video":
                ctr_anomaly_factor = 0.65  # Video loading issues
            else:
                ctr_anomaly_factor = 0.70  # General CTR crash
        
        # Medium CTR fluctuations (20% chance)
        elif ctr_anomaly_seed < 36:
            if ctr_anomaly_seed % 3 == 0:
                ctr_anomaly_factor = 1.20  # Small CTR boost
            elif ctr_anomaly_seed % 3 == 1:
                ctr_anomaly_factor = 0.80  # Small CTR dip
            else:
                ctr_anomaly_factor = 1.10  # Minor CTR improvement
        
        # Apply CTR anomaly
        ctr *= ctr_anomaly_factor

        # Clamp realistic bounds (updated for industry standards)
        ctr = max(0.005, min(0.12, ctr))

        clicks = int(impressions * ctr)
        sessions = int(clicks * 0.8)

        # Target realistic ROAS per campaign with more complex variations
        base_roas = {
            "Retargeting - Cart": 5.0,
            "Brand - Exact": 4.0,
            "Prospecting - Video": 2.0,
            "Newsletter - Promo": 1.8
        }.get(campaign, 3.0)
        
        # Multi-factor ROAS calculation with seasonal and competitive effects
        # 1. Long-term trend
        slope = {
            "Retargeting - Cart": 0.15,
            "Brand - Exact": 0.10,
            "Prospecting - Video": -0.15,
            "Newsletter - Promo": 0.0
        }.get(campaign, 0.0)
        trend_factor = 1.0 + slope * progress
        
        # 2. Seasonal effects (back-to-school, holiday prep)
        seasonal_factor = 1.0
        if current_date.month == 8:  # August - back to school
            if campaign in ["Brand - Exact", "Prospecting - Video"]:
                seasonal_factor = 1.15
        elif current_date.month == 9:  # September - holiday prep
            if campaign == "Retargeting - Cart":
                seasonal_factor = 1.20
            elif campaign == "Newsletter - Promo":
                seasonal_factor = 1.10
        
        # 3. Competitive pressure simulation (random-like but deterministic)
        competitive_cycle = (day_offset + hash(campaign)) % 14  # 2-week cycles
        if competitive_cycle < 3:  # High competition period
            competitive_factor = 0.85
        elif competitive_cycle > 11:  # Low competition period
            competitive_factor = 1.12
        else:
            competitive_factor = 1.0
        
        # 4. Channel-specific market dynamics
        channel_factor = {
            "paid_search": 1.0 + 0.08 * math.sin(2 * math.pi * day_offset / 21),  # 3-week cycles
            "social": 1.0 + 0.12 * math.sin(2 * math.pi * day_offset / 14),      # 2-week cycles
            "display": 1.0 + 0.06 * math.sin(2 * math.pi * day_offset / 28),     # 4-week cycles
            "email": 1.0 + 0.04 * math.sin(2 * math.pi * day_offset / 7)        # weekly cycles
        }.get(channel, 1.0)
        
        # 5. Campaign maturity effect (newer campaigns perform differently)
        maturity_factor = 1.0
        if campaign == "Prospecting - Video" and day_offset < 30:
            maturity_factor = 0.75  # New campaign learning period
        elif campaign == "Retargeting - Cart" and day_offset > 60:
            maturity_factor = 1.15  # Optimized campaign
        
        # 6. Weekday vs weekend performance
        weekday_factor = 0.95 if current_date.weekday() >= 5 else 1.0
        
        # Combine all factors
        target_roas = max(0.5, base_roas * trend_factor * seasonal_factor * 
                        competitive_factor * channel_factor * maturity_factor * weekday_factor)
        
        # Add realistic anomalies and spikes
        anomaly_factor = 1.0
        
        # Random-like but deterministic anomalies (using day_offset for consistency)
        anomaly_seed = (day_offset * 7 + hash(campaign + channel)) % 100
        
        # Major performance spikes (5% chance)
        if anomaly_seed < 5:
            if campaign == "Retargeting - Cart":
                anomaly_factor = 1.35  # Big retargeting win
            elif campaign == "Brand - Exact":
                anomaly_factor = 1.25  # Brand campaign success
            else:
                anomaly_factor = 1.20  # General spike
        
        # Performance crashes (8% chance)
        elif anomaly_seed < 13:
            if campaign == "Prospecting - Video":
                anomaly_factor = 0.65  # Prospecting campaign crash
            elif channel == "social":
                anomaly_factor = 0.70  # Social platform issue
            else:
                anomaly_factor = 0.75  # General crash
        
        # Medium fluctuations (15% chance)
        elif anomaly_seed < 28:
            if anomaly_seed % 2 == 0:
                anomaly_factor = 1.15  # Small positive spike
            else:
                anomaly_factor = 0.85  # Small negative dip
        
        # Apply anomaly
        target_roas *= anomaly_factor
        
        # Add spend anomalies (budget changes, emergency campaigns)
        spend_anomaly_factor = 1.0
        spend_anomaly_seed = (day_offset * 17 + hash(campaign + channel + "spend")) % 100
        
        # Major spend spikes (4% chance) - emergency campaigns, budget increases
        if spend_anomaly_seed < 4:
            if campaign == "Retargeting - Cart":
                spend_anomaly_factor = 1.80  # Emergency retargeting boost
            elif campaign == "Brand - Exact":
                spend_anomaly_factor = 1.60  # Brand awareness push
            else:
                spend_anomaly_factor = 1.40  # General spend increase
        
        # Spend cuts (6% chance) - budget constraints, campaign pauses
        elif spend_anomaly_seed < 10:
            if campaign == "Prospecting - Video":
                spend_anomaly_factor = 0.50  # Prospecting budget cut
            elif channel == "display":
                spend_anomaly_factor = 0.60  # Display budget reduction
            else:
                spend_anomaly_factor = 0.70  # General spend cut
        
        # Apply spend anomaly
        spend *= spend_anomaly_factor
        
        aov = 75 * campaign_aov_factor.get(campaign, 1.0)
        revenue = spend * target_roas
        purchases = int(revenue / max(1.0, aov))
        # Ensure purchases do not exceed sessions to keep CVR sensible
        purchases = min(purchases, max(0, sessions))
        revenue = int(purchases * aov)
        
        camp_rows.append((current_date.strftime('%Y-%m-%d'), channel, campaign, spend, impressions, clicks, sessions, purchases, revenue))
    
    current_date += datetime.timedelta(days=1)
    day_offset += 1
    
cur.executemany("INSERT INTO marketing_campaigns(day, channel, campaign, spend, impressions, clicks, sessions, purchases, revenue) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", camp_rows)

cur.execute("DELETE FROM creative_performance")
import datetime
creative_rows = []
start_date = datetime.date(2025, 7, 1)
end_date = datetime.date(2025, 9, 30)
current_date = start_date
day_offset = 0
creatives = [
    ("social", "VID_A", "v1"),
    ("social", "VID_B", "v1"),
    ("display", "BNR_A", "v1"),
    ("display", "BNR_B", "v1")
]
while current_date <= end_date:
    for channel, creative_id, variant in creatives:
        base_impr = 300000 + (day_offset * 2000) + (hash(creative_id) % 20000)
        weekend_factor = 0.7 if current_date.weekday() >= 5 else 1.0
        impressions = int(base_impr * weekend_factor)
        # Enhanced creative performance with realistic variability patterns
        import math
        base_ctr = 0.025 if channel == "social" else 0.008  # social ~2.5%, display ~0.8%
        
        # 1. Multi-layered seasonality patterns
        # Weekly pattern with creative-specific phase
        phase = (hash(creative_id) % 7) / 7.0
        weekly_pattern = 1.0 + 0.15 * math.sin(2 * math.pi * (day_offset / 7.0 + phase))
        
        # Bi-weekly creative refresh cycles
        refresh_phase = (hash(creative_id + "_refresh") % 14) / 14.0
        refresh_pattern = 1.0 + 0.10 * math.sin(2 * math.pi * (day_offset / 14.0 + refresh_phase))
        
        # Monthly audience behavior shifts
        monthly_pattern = 1.0 + 0.08 * math.sin(2 * math.pi * (day_offset / 30.0))
        
        # 2. Creative-specific performance evolution
        progress = day_offset / 92.0
        creative_trends = {
            "VID_A": -0.12,  # declining performance (creative fatigue)
            "VID_B": 0.08,   # improving performance (optimization)
            "BNR_A": -0.06,  # slight decline (audience saturation)
            "BNR_B": 0.15    # strong improvement (fresh creative)
        }
        trend_slope = creative_trends.get(creative_id, 0.0)
        trend = 1.0 + trend_slope * progress
        
        # 3. Creative lifecycle effects
        lifecycle_factor = 1.0
        if creative_id in ["VID_A", "BNR_A"]:
            # Older creatives show fatigue
            lifecycle_factor = max(0.75, 1.0 - (day_offset * 0.0015))
        elif creative_id in ["VID_B", "BNR_B"]:
            # Newer creatives improve with optimization
            lifecycle_factor = min(1.25, 1.0 + (day_offset * 0.0012))
        
        # 4. Audience saturation and frequency capping effects
        saturation_cycle = (day_offset + hash(creative_id + "_audience")) % 18  # 2.5-week cycles
        if saturation_cycle < 4:  # High frequency period
            saturation_factor = 0.88
        elif saturation_cycle > 14:  # Low frequency period
            saturation_factor = 1.12
        else:
            saturation_factor = 1.0
        
        # 5. Channel-specific behavioral patterns
        channel_effect = 1.0
        if channel == "social":
            # Social creatives perform better mid-week, worse on weekends
            channel_effect = 1.0 + 0.12 * math.sin(2 * math.pi * current_date.weekday() / 7.0)
            # Social also has daily patterns (better during work hours)
            daily_effect = 1.0 + 0.08 * math.sin(2 * math.pi * (day_offset % 24) / 24.0)
            channel_effect *= daily_effect
        else:
            # Display performs better on weekends, worse mid-week
            channel_effect = 1.0 + 0.08 * math.sin(2 * math.pi * (current_date.weekday() + 3) / 7.0)
        
        # 6. Competitive landscape effects (simulate market dynamics)
        competitive_cycle = (day_offset + hash(creative_id + "_competition")) % 25  # ~3.5-week cycles
        if competitive_cycle < 6:  # High competition period
            competitive_factor = 0.92
        elif competitive_cycle > 19:  # Low competition period
            competitive_factor = 1.10
        else:
            competitive_factor = 1.0
        
        # Combine all creative performance factors
        ctr = base_ctr * weekly_pattern * refresh_pattern * monthly_pattern * trend * \
              lifecycle_factor * saturation_factor * channel_effect * competitive_factor
        
        # Mid-September creative refresh event
        if datetime.date(2025, 9, 16) <= current_date <= datetime.date(2025, 9, 20):
            if creative_id in ("VID_B", "BNR_B"):
                ctr *= 1.15  # refresh boost
            else:
                ctr *= 0.90  # fatigue penalty
        
        # Add creative-specific anomalies and spikes
        creative_anomaly_factor = 1.0
        
        # Deterministic creative anomalies
        creative_anomaly_seed = (day_offset * 13 + hash(creative_id + channel + "creative")) % 100
        
        # Major creative spikes (7% chance) - viral content, trending creatives
        if creative_anomaly_seed < 7:
            if creative_id == "VID_B" and channel == "social":
                creative_anomaly_factor = 1.80  # Viral video content (up to ~4.5% CTR)
            elif creative_id == "BNR_B" and channel == "display":
                creative_anomaly_factor = 1.60  # High-performing banner (up to ~1.28% CTR)
            elif creative_id == "VID_A":
                creative_anomaly_factor = 1.50  # Classic video performs well (up to ~3.75% CTR)
            else:
                creative_anomaly_factor = 1.40  # General creative spike
        
        # Creative crashes (12% chance) - creative fatigue, technical issues
        elif creative_anomaly_seed < 19:
            if creative_id == "VID_A":
                creative_anomaly_factor = 0.55  # Old video fatigued
            elif creative_id == "BNR_A":
                creative_anomaly_factor = 0.60  # Banner ad blindness
            elif channel == "social":
                creative_anomaly_factor = 0.65  # Social platform changes
            else:
                creative_anomaly_factor = 0.70  # General creative crash
        
        # Medium creative fluctuations (25% chance)
        elif creative_anomaly_seed < 44:
            if creative_anomaly_seed % 4 == 0:
                creative_anomaly_factor = 1.25  # Creative boost
            elif creative_anomaly_seed % 4 == 1:
                creative_anomaly_factor = 0.75  # Creative dip
            elif creative_anomaly_seed % 4 == 2:
                creative_anomaly_factor = 1.15  # Minor improvement
            else:
                creative_anomaly_factor = 0.85  # Minor decline
        
        # Apply creative anomaly
        ctr *= creative_anomaly_factor
        
        ctr = max(0.005, min(0.10, ctr))
        clicks = int(impressions * ctr)
        conversions = int(clicks * (0.04 + (day_offset % 6) * 0.004))
        creative_rows.append((current_date.strftime('%Y-%m-%d'), channel, creative_id, variant, impressions, clicks, conversions))
    day_offset += 1
    current_date += datetime.timedelta(days=1)
cur.executemany("INSERT INTO creative_performance(day, channel, creative_id, variant, impressions, clicks, conversions) VALUES (?, ?, ?, ?, ?, ?, ?)", creative_rows)

import datetime
# Always regenerate budget_pacing to ensure full daily coverage
cur.execute("DELETE FROM budget_pacing")
pacing_rows = []
# Generate daily pacing data for July-September 2025 for two channels
start_date = datetime.date(2025, 7, 1)
end_date = datetime.date(2025, 9, 30)
channels = ["paid_search", "social"]
current_date = start_date
day_index = 0
while current_date <= end_date:
    month = current_date.strftime('%Y-%m')
    # Planned spend increases modestly by month and has slight weekday variation
    base_planned = 3000.0 + (current_date.month - 7) * 200.0
    weekday_factor = 0.95 if current_date.weekday() >= 5 else 1.0
    planned_paid = base_planned * 1.1 * weekday_factor
    planned_social = base_planned * 0.9 * weekday_factor

    # Actual spend varies around plan with deterministic patterns and a mid-Sept deviation
    # Use day_index to create a repeating pattern without randomness
    paid_variance = ((day_index % 7) - 3) * 25.0  # -75..+100
    social_variance = ((day_index % 5) - 2) * 20.0  # -40..+60

    # Introduce pacing spike/miss around 2025-09-16..20
    if datetime.date(2025, 9, 16) <= current_date <= datetime.date(2025, 9, 20):
        paid_variance += 900.0  # overspend spike
        social_variance -= 300.0 # underspend
    # Converge variances toward 0 by end of Sept
    days_to_end = (end_date - current_date).days
    if current_date >= datetime.date(2025, 9, 21):
        factor = max(0.1, 1.0 - (92 - days_to_end) * 0.02)
        paid_variance *= factor
        social_variance *= factor

    actual_paid = planned_paid + paid_variance
    actual_social = planned_social + social_variance

    pacing_rows.append((month, current_date.strftime('%Y-%m-%d'), "paid_search", round(planned_paid, 2), round(actual_paid, 2)))
    pacing_rows.append((month, current_date.strftime('%Y-%m-%d'), "social", round(planned_social, 2), round(actual_social, 2)))

    current_date += datetime.timedelta(days=1)
    day_index += 1

cur.executemany("INSERT INTO budget_pacing(month, day, channel, planned_spend, actual_spend) VALUES (?, ?, ?, ?, ?)", pacing_rows)

# Clear existing brand health data and regenerate
cur.execute("DELETE FROM brand_health")
# Generate 90 days of brand health data with realistic patterns
import math
import random

start_date = datetime.date(2025, 7, 1)
end_date = datetime.date(2025, 9, 30)
current_date = start_date
day_offset = 0
brand_rows = []

# Set random seed for consistent data
random.seed(42)

while current_date <= end_date:
    # Branded search volume with trends and seasonality
    base_search_volume = 100000 + (day_offset * 200)  # Gradual growth
    weekend_factor = 0.8 if current_date.weekday() >= 5 else 1.0
    seasonal_factor = 1.0 + 0.15 * math.sin(2 * math.pi * day_offset / 30.0)  # Monthly cycles
    
    # Back-to-school and holiday prep effects
    if current_date.month == 8:  # August - back to school
        seasonal_factor *= 1.2
    elif current_date.month == 9:  # September - holiday prep
        seasonal_factor *= 1.3
    
    branded_search_volume = int(base_search_volume * weekend_factor * seasonal_factor)
    
    # Brand Sentiment (-1 to +1) with realistic patterns
    base_sentiment = 0.2  # Slightly positive baseline
    
    # 1. Long-term trend (brand building over time)
    progress = day_offset / 92.0
    trend_sentiment = base_sentiment + 0.15 * progress  # Gradual improvement
    
    # 2. Weekly patterns (sentiment varies by day of week)
    weekly_sentiment = 0.1 * math.sin(2 * math.pi * current_date.weekday() / 7.0)
    
    # 3. Monthly cycles (campaign impact cycles)
    monthly_sentiment = 0.08 * math.sin(2 * math.pi * day_offset / 21.0)  # 3-week cycles
    
    # 4. Seasonal effects
    seasonal_sentiment = 0.0
    if current_date.month == 8:  # Back-to-school positive sentiment
        seasonal_sentiment = 0.12
    elif current_date.month == 9:  # Holiday prep excitement
        seasonal_sentiment = 0.15
    
    # 5. Campaign impact simulation
    campaign_impact = 0.0
    if day_offset % 14 < 3:  # Campaign launch period
        campaign_impact = 0.08
    elif day_offset % 14 > 11:  # Campaign fatigue
        campaign_impact = -0.05
    
    # 6. Random-like but deterministic anomalies
    anomaly_seed = (day_offset * 13 + hash(str(current_date))) % 100
    anomaly_sentiment = 0.0
    
    # Major sentiment spikes (3% chance)
    if anomaly_seed < 3:
        anomaly_sentiment = random.uniform(0.15, 0.25)
    # Major sentiment drops (2% chance)
    elif anomaly_seed > 97:
        anomaly_sentiment = random.uniform(-0.20, -0.15)
    # Medium fluctuations (10% chance)
    elif anomaly_seed > 85:
        anomaly_sentiment = random.uniform(-0.08, 0.08)
    
    # Combine all sentiment factors
    sentiment = trend_sentiment + weekly_sentiment + monthly_sentiment + seasonal_sentiment + campaign_impact + anomaly_sentiment
    
    # Ensure sentiment stays within bounds (-1 to +1)
    sentiment = max(-1.0, min(1.0, sentiment))
    
    # NPS Score (0-10) with realistic patterns
    base_nps = 6.5  # Good baseline NPS
    
    # 1. Long-term NPS trend (customer satisfaction improvement)
    nps_trend = base_nps + 0.8 * progress  # Gradual improvement
    
    # 2. Weekly patterns (NPS varies by day)
    nps_weekly = 0.3 * math.sin(2 * math.pi * current_date.weekday() / 7.0)
    
    # 3. Seasonal NPS effects
    nps_seasonal = 0.0
    if current_date.month == 8:  # Back-to-school satisfaction
        nps_seasonal = 0.5
    elif current_date.month == 9:  # Holiday prep satisfaction
        nps_seasonal = 0.7
    
    # 4. Campaign impact on NPS
    nps_campaign = 0.0
    if day_offset % 14 < 3:  # New campaign satisfaction
        nps_campaign = 0.4
    elif day_offset % 14 > 11:  # Campaign fatigue
        nps_campaign = -0.3
    
    # 5. Anomalies for NPS
    nps_anomaly = 0.0
    if anomaly_seed < 3:  # Major NPS spikes
        nps_anomaly = random.uniform(0.8, 1.2)
    elif anomaly_seed > 97:  # Major NPS drops
        nps_anomaly = random.uniform(-1.0, -0.8)
    elif anomaly_seed > 85:  # Medium NPS fluctuations
        nps_anomaly = random.uniform(-0.4, 0.4)
    
    # Combine all NPS factors
    nps_score = nps_trend + nps_weekly + nps_seasonal + nps_campaign + nps_anomaly
    
    # Ensure NPS stays within bounds (0-10)
    nps_score = max(0, min(10, nps_score))
    
    brand_rows.append((
        current_date.strftime('%Y-%m-%d'),
        branded_search_volume,
        round(sentiment, 3),
        round(nps_score, 1)
    ))
    
    current_date += datetime.timedelta(days=1)
    day_offset += 1

cur.executemany("INSERT INTO brand_health(day, branded_search_volume, social_sentiment_score, nps) VALUES (?, ?, ?, ?)", brand_rows)

cur.execute("SELECT COUNT(*) FROM ad_disapprovals")
if cur.fetchone()[0] == 0:
    dis_rows = [
        ("2025-09-16", "display", 2, "policy_text"),
        ("2025-09-17", "display", 35, "destination_mismatch")
    ]
    cur.executemany("INSERT INTO ad_disapprovals(day, channel, disapprovals, reason) VALUES (?, ?, ?, ?)", dis_rows)

# Create metric views (refresh vw_payment_failures to fix alias)
cur.executescript(
    """
    CREATE VIEW IF NOT EXISTS vw_ecom_daily_funnel AS
    SELECT session_date AS day,
           SUM(sessions) AS sessions,
           SUM(pdp_views) AS pdp_views,
           SUM(add_to_cart) AS add_to_cart,
           SUM(checkouts) AS checkouts,
           SUM(purchases) AS purchases,
           (SUM(add_to_cart)*1.0/NULLIF(SUM(pdp_views),0)) AS rate_pdp_to_atc,
           (SUM(checkouts)*1.0/NULLIF(SUM(add_to_cart),0)) AS rate_atc_to_co,
           (SUM(purchases)*1.0/NULLIF(SUM(checkouts),0)) AS rate_co_to_purchase
    FROM web_sessions
    GROUP BY session_date;

    DROP VIEW IF EXISTS vw_payment_failures;
    CREATE VIEW vw_payment_failures AS
    WITH co AS (
      SELECT session_date AS day, SUM(checkouts) AS checkouts FROM web_sessions GROUP BY 1
    ),
    failures AS (
      SELECT day, SUM(CASE WHEN step='payment' THEN failures ELSE 0 END) AS payment_failures,
             SUM(failures) AS total_failures
      FROM checkout_failures
      GROUP BY day
    )
    SELECT co.day,
           COALESCE(f.payment_failures, 0) AS payment_failures,
           COALESCE(f.total_failures, 0) AS total_failures,
           (COALESCE(f.payment_failures,0)*1.0/NULLIF(co.checkouts,0)) AS payment_failure_rate,
           (COALESCE(f.payment_failures,0)*1000.0/NULLIF(co.checkouts,0)) AS payment_failures_per_1k_checkouts
    FROM co LEFT JOIN failures f ON co.day=f.day;

    CREATE VIEW IF NOT EXISTS vw_zero_result_search AS
    SELECT day,
           SUM(zero_results) AS zero_results,
           SUM(searches) AS searches,
           (SUM(zero_results)*1.0/NULLIF(SUM(searches),0)) AS zero_result_rate
    FROM search_queries
    GROUP BY day;

    CREATE VIEW IF NOT EXISTS vw_plp_perf AS
    SELECT day, p75_lcp_ms, p75_fid_ms, p75_cls
    FROM page_performance
    WHERE page_type='plp';

    CREATE VIEW IF NOT EXISTS vw_pdp_perf AS
    SELECT day, p75_lcp_ms, p75_fid_ms, p75_cls
    FROM page_performance
    WHERE page_type='pdp';

    CREATE VIEW IF NOT EXISTS vw_product_conv AS
    SELECT pp.day,
           p.name AS product,
           pp.views,
           pp.purchases,
           (pp.purchases*1.0/NULLIF(pp.views,0)) AS view_to_purchase
    FROM product_performance pp JOIN products p ON p.id=pp.product_id;

    CREATE VIEW IF NOT EXISTS vw_ecom_rates_by_day AS
    SELECT session_date AS day, device, source,
           (SUM(add_to_cart)*1.0/NULLIF(SUM(pdp_views),0)) AS atc_rate,
           (SUM(checkouts)*1.0/NULLIF(SUM(add_to_cart),0)) AS co_start_rate,
           (SUM(purchases)*1.0/NULLIF(SUM(sessions),0)) AS purchase_rate
    FROM web_sessions
    GROUP BY session_date, device, source;

    DROP VIEW IF EXISTS vw_ecom_mobile_desktop_delta;
    CREATE VIEW vw_ecom_mobile_desktop_delta AS
    WITH rates AS (
      SELECT session_date AS day, device,
             (SUM(purchases)*1.0/NULLIF(SUM(sessions),0)) AS purchase_rate
      FROM web_sessions
      GROUP BY session_date, device
    )
    SELECT m.day,
           m.purchase_rate AS mobile_purchase_rate,
           d.purchase_rate AS desktop_purchase_rate,
           (m.purchase_rate - d.purchase_rate) AS mobile_minus_desktop
    FROM rates m JOIN rates d ON m.day=d.day
    WHERE m.device='mobile' AND d.device='desktop';

    CREATE VIEW IF NOT EXISTS vw_zero_result_top_share AS
    WITH agg AS (
      SELECT day, SUM(searches) AS total_searches FROM search_queries GROUP BY day
    ),
    ranked AS (
      SELECT day, query, zero_results, searches,
             ROW_NUMBER() OVER (PARTITION BY day ORDER BY zero_results DESC) AS rn
      FROM search_queries
    )
    SELECT r.day, r.query AS top_query, r.zero_results AS top_zero_results, a.total_searches,
           (r.zero_results*1.0/NULLIF(a.total_searches,0)) AS top_zero_share
    FROM ranked r JOIN agg a ON a.day=r.day
    WHERE r.rn=1;

    DROP VIEW IF EXISTS vw_sku_efficiency;
    CREATE VIEW vw_sku_efficiency AS
    SELECT p.name AS sku, day,
           (purchases*1.0/NULLIF(views,0)) AS efficiency_score,
           (purchases*1.0/NULLIF(views,0)) AS purchase_per_view,
           (purchases*1.0) AS purchases,
           (views*1.0) AS views,
           (views*1.0/NULLIF(purchases,0)) AS inventory_turnover
    FROM product_performance pp JOIN products p ON p.id=pp.product_id;

    CREATE VIEW IF NOT EXISTS vw_return_rate_trend AS
    WITH pur AS (
      SELECT product_id, day, SUM(purchases) AS purchases
      FROM product_performance GROUP BY 1,2
    )
    SELECT r.day, p.name AS product, r.returns, pur.purchases,
           (r.returns*1.0/NULLIF(pur.purchases,0)) AS return_rate
    FROM returns r JOIN pur ON pur.product_id=r.product_id AND pur.day=r.day
    JOIN products p ON p.id=r.product_id;

    CREATE VIEW IF NOT EXISTS vw_campaign_kpis AS
    SELECT day, channel, campaign, spend, revenue,
           (revenue/NULLIF(spend,0)) AS roas,
           (spend/NULLIF(purchases,0)) AS cac,
           (clicks*1.0/NULLIF(impressions,0)) AS ctr,
           (purchases*1.0/NULLIF(sessions,0)) AS cvr
    FROM marketing_campaigns;

    DROP VIEW IF EXISTS vw_disapproval_rate;
    CREATE VIEW vw_disapproval_rate AS
    WITH imp AS (
      SELECT day, channel, SUM(impressions) AS impressions
      FROM marketing_campaigns GROUP BY 1,2
    )
    SELECT d.day, d.channel, d.disapprovals, d.reason,
           (d.disapprovals*10000.0/NULLIF(imp.impressions,0)) AS disapprovals_per_10k_impr
    FROM ad_disapprovals d LEFT JOIN imp ON imp.day=d.day AND imp.channel=d.channel;

    CREATE VIEW IF NOT EXISTS vw_brand_lift_proxy AS
    WITH brand_sessions AS (
      SELECT day, SUM(sessions) AS brand_sessions
      FROM marketing_campaigns
      WHERE campaign LIKE 'Brand%'
      GROUP BY day
    )
    SELECT bh.day, bh.branded_search_volume, bs.brand_sessions
    FROM brand_health bh LEFT JOIN brand_sessions bs ON bs.day=bh.day;

    CREATE VIEW IF NOT EXISTS vw_sentiment_social_roas AS
    WITH social AS (
      SELECT day, SUM(revenue) AS revenue, SUM(spend) AS spend
      FROM marketing_campaigns WHERE channel='social' GROUP BY day
    )
    SELECT bh.day, bh.social_sentiment_score, (social.revenue/NULLIF(social.spend,0)) AS social_roas
    FROM brand_health bh LEFT JOIN social ON social.day=bh.day;

    -- Budget pacing variance view for marketing
    DROP VIEW IF EXISTS vw_budget_pacing_var;
    CREATE VIEW vw_budget_pacing_var AS
    SELECT day,
           channel,
           month,
           planned_spend,
           actual_spend,
           (actual_spend - planned_spend) AS variance,
           ((actual_spend - planned_spend) * 1.0 / NULLIF(planned_spend, 0)) AS pacing_variance
    FROM budget_pacing;

    -- Monthly aggregates for MoM indicators
    DROP VIEW IF EXISTS vw_ecom_funnel_monthly;
    CREATE VIEW vw_ecom_funnel_monthly AS
    SELECT substr(session_date,1,7) AS month,
           SUM(sessions) AS sessions,
           SUM(pdp_views) AS pdp_views,
           SUM(add_to_cart) AS add_to_cart,
           SUM(checkouts) AS checkouts,
           SUM(purchases) AS purchases,
           (SUM(add_to_cart)*1.0/NULLIF(SUM(pdp_views),0)) AS rate_pdp_to_atc,
           (SUM(checkouts)*1.0/NULLIF(SUM(add_to_cart),0)) AS rate_atc_to_co,
           (SUM(purchases)*1.0/NULLIF(SUM(checkouts),0)) AS rate_co_to_purchase
    FROM web_sessions
    GROUP BY substr(session_date,1,7);

    DROP VIEW IF EXISTS vw_budget_pacing_monthly;
    CREATE VIEW vw_budget_pacing_monthly AS
    SELECT month,
           channel,
           SUM(planned_spend) AS planned_spend,
           SUM(actual_spend) AS actual_spend,
           (SUM(actual_spend) - SUM(planned_spend)) AS variance,
           ((SUM(actual_spend) - SUM(planned_spend)) * 1.0 / NULLIF(SUM(planned_spend),0)) AS pacing_variance
    FROM budget_pacing
    GROUP BY month, channel;

    DROP VIEW IF EXISTS vw_campaign_kpis_monthly;
    CREATE VIEW vw_campaign_kpis_monthly AS
    SELECT substr(day,1,7) AS month,
           channel,
           campaign,
           SUM(spend) AS spend,
           SUM(revenue) AS revenue,
           (SUM(revenue)/NULLIF(SUM(spend),0)) AS roas,
           (SUM(spend)/NULLIF(SUM(purchases),0)) AS cac,
           (SUM(clicks)*1.0/NULLIF(SUM(impressions),0)) AS ctr,
           (SUM(purchases)*1.0/NULLIF(SUM(sessions),0)) AS cvr
    FROM marketing_campaigns
    GROUP BY substr(day,1,7), channel, campaign;

    CREATE VIEW IF NOT EXISTS vw_creative_ctr AS
    SELECT day, channel, creative_id, variant,
           (clicks*1.0/NULLIF(impressions,0)) AS ctr,
           (conversions*1.0/NULLIF(clicks,0)) AS conv_rate
    FROM creative_performance;
    """
)

conn.commit()
conn.close()

print(f"Seeded database at {DB_PATH}")


