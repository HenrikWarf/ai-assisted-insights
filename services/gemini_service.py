import os
import json
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

API_KEY = os.getenv("GOOGLE_GENAI_API_KEY")
PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT")
LOCATION = os.getenv("GEMINI_LOCATION", "us-central1")
MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-2.5-pro")

# Prefer service account if project is set; otherwise use API key if provided
AUTH_MODE = "service_account" if PROJECT_ID else ("api_key" if API_KEY else "none")


def gemini_status() -> Dict[str, Any]:
	return {
		"auth_mode": AUTH_MODE,
		"model": MODEL_NAME,
		"project": PROJECT_ID or None,
		"location": LOCATION,
	}


def _generate_text_from_model(prompt: str) -> str:
	"""Generate text using either google.genai (API key) or Vertex AI (service account)."""
	if AUTH_MODE == "service_account":
		from vertexai import init as vertex_init
		from vertexai.preview.generative_models import GenerativeModel
		vertex_init(project=PROJECT_ID, location=LOCATION)
		model = GenerativeModel(MODEL_NAME)
		resp = model.generate_content(prompt)
		text = getattr(resp, "text", None)
		if text is None and hasattr(resp, "candidates") and resp.candidates:
			# Fallback extraction
			try:
				parts = resp.candidates[0].content.parts
				text = "".join(getattr(p, "text", "") for p in parts)
			except Exception:
				text = ""
		return (text or "").strip()
	elif AUTH_MODE == "api_key":
		from google import genai
		client = genai.Client(api_key=API_KEY)
		resp = client.models.generate_content(model=MODEL_NAME, contents=prompt)
		return (resp.text or "").strip()
	else:
		raise RuntimeError("Gemini not configured. Set GOOGLE_CLOUD_PROJECT (service account) or GOOGLE_GENAI_API_KEY (API key).")


"""
This module contains the Gemini service client for generating content.
"""
from vertexai.preview.generative_models import GenerativeModel, GenerationConfig
import json
import logging

logger = logging.getLogger(__name__)

def _generate_content_from_model(prompt_text, default_response=""):
    """Generates content from a generative model."""
    try:
        model = GenerativeModel("gemini-2.5-pro")
        response = model.generate_content(prompt_text)
        return response.text
    except Exception as e:
        logger.error(f"Error generating content from Gemini: {e}", exc_info=True)
        return default_response

def _generate_json_from_model(prompt_text, default_json="{}"):
    """
    Generates a JSON object from a generative model, ensuring the output is valid JSON.
    """
    try:
        model = GenerativeModel("gemini-2.5-pro")
        config = GenerationConfig(response_mime_type="application/json")
        response = model.generate_content(prompt_text, generation_config=config)
        return json.loads(response.text)
    except Exception as e:
        logger.error(f"Error generating JSON from Gemini: {e}", exc_info=True)
        return json.loads(default_json)


def analyze_metrics_short_term(role: str, metrics: Dict[str, Any]) -> Dict[str, Any]:
	"""Use Gemini to analyze LAST 2 WEEKS of metrics for immediate tactical actions."""
	schema_hint = (
		"Return ONLY a JSON object with keys: role (string), prioritized_issues (array), summary (string).\n"
		"Each item in prioritized_issues must be an object: {priority (integer; 1 is highest), title (string), why (string), evidence (object; include relevant metric slices), suggested_actions (array of strings)}.\n"
		"Focus on IMMEDIATE, TACTICAL actions that can be implemented within 1-2 weeks."
	)
	contents_json = json.dumps(metrics, ensure_ascii=False)
	prompt = (
		"You are Gemini 2.5 Pro. Analyze the following role-specific METRICS JSON (LAST 2 WEEKS ONLY) and produce a structured JSON with prioritized issues.\n"
		f"Role: {role}\n"
		"SHORT-TERM FOCUS: Analyze only the most recent 2 weeks of data. Look for:\n"
		"- Recent performance drops or spikes requiring immediate attention\n"
		"- Quick wins and tactical optimizations\n"
		"- Urgent issues that need immediate fixes\n"
		"- Performance thresholds being breached recently (e.g., LCP > 3.5s, ROAS < 2)\n"
		"- Recent anomalies or unusual patterns\n"
		"Provide IMMEDIATE, ACTIONABLE recommendations that can be implemented within 1-2 weeks.\n"
		"Explain WHY each issue is urgent and include evidence with recent metric values and dates.\n"
		+ schema_hint + "\n"
		+ f"\nMETRICS JSON:\n{contents_json}\n"
	)
	obj = _generate_json_from_model(prompt, "{}")
	# annotate
	obj["engine"] = "gemini"
	obj["auth_mode"] = AUTH_MODE
	obj["model"] = MODEL_NAME
	obj["analysis_type"] = "short_term"
	return obj


def analyze_metrics_long_term(role: str, metrics: Dict[str, Any]) -> Dict[str, Any]:
	"""Use Gemini to analyze FULL 90 DAYS of metrics for strategic long-term direction."""
	schema_hint = (
		"Return ONLY a JSON object with keys: role (string), prioritized_issues (array), summary (string).\n"
		"Each item in prioritized_issues must be an object: {priority (integer; 1 is highest), title (string), why (string), evidence (object; include relevant metric slices), suggested_actions (array of strings)}.\n"
		"Focus on STRATEGIC, LONG-TERM initiatives that require planning and implementation over months."
	)
	contents_json = json.dumps(metrics, ensure_ascii=False)
	prompt = (
		"You are Gemini 2.5 Pro. Analyze the following role-specific METRICS JSON (FULL 90 DAYS) and produce a structured JSON with prioritized issues.\n"
		f"Role: {role}\n"
		"LONG-TERM FOCUS: Analyze the ENTIRE dataset spanning multiple months (July-September 2025). Look for:\n"
		"- Long-term trends and strategic patterns across the full time period\n"
		"- Month-over-month performance evolution and strategic shifts\n"
		"- Seasonal variations and cyclical patterns\n"
		"- Cross-metric correlations and strategic insights\n"
		"- Performance thresholds and strategic benchmarks (e.g., LCP > 3.5s, ROAS < 2)\n"
		"- Strategic opportunities and long-term optimization areas\n"
		"Provide STRATEGIC recommendations that require planning and implementation over weeks to months.\n"
		"Explain WHY each issue is strategically important and include evidence with trend data and time periods.\n"
		+ schema_hint + "\n"
		+ f"\nMETRICS JSON:\n{contents_json}\n"
	)
	obj = _generate_json_from_model(prompt, "{}")
	# annotate
	obj["engine"] = "gemini"
	obj["auth_mode"] = AUTH_MODE
	obj["model"] = MODEL_NAME
	obj["analysis_type"] = "long_term"
	return obj


def analyze_metrics(role: str, metrics: Dict[str, Any]) -> Dict[str, Any]:
	"""Legacy function - now calls both short-term and long-term analysis."""
	short_term = analyze_metrics_short_term(role, metrics)
	long_term = analyze_metrics_long_term(role, metrics)
	return {
		"role": role,
		"short_term": short_term,
		"long_term": long_term,
		"engine": "gemini",
		"auth_mode": AUTH_MODE,
		"model": MODEL_NAME
	}


def generate_chart_insights(chart_title: str, chart_data: List[Dict[str, Any]], chart_type: str = "unknown") -> List[str]:
	"""Generate enhanced insights for specific chart data using Gemini Flash 2.5."""
	if not chart_data:
		return ["No data available for analysis."]
	
	prompt = (
		"You are Gemini 2.5 Flash, an expert data analyst. Analyze the following chart data and provide 3-5 key insights in bullet point format.\n\n"
		f"Chart Title: {chart_title}\n"
		f"Chart Type: {chart_type}\n"
		f"Data Records: {len(chart_data)}\n\n"
		"ANALYSIS REQUIREMENTS:\n"
		"- Identify the most significant patterns, trends, and outliers\n"
		"- Provide actionable insights that are specific to this data\n"
		"- Highlight any concerning drops, impressive gains, or unusual patterns\n"
		"- Include specific numbers and percentages where relevant\n"
		"- Focus on business impact and opportunities\n\n"
		"FORMAT: Return ONLY a simple bullet-point list (one insight per line, starting with '• ').\n"
		"Do NOT include any headers, explanations, or additional text.\n"
		"Keep each bullet point concise but informative (max 100 words).\n\n"
		"Data to analyze:\n"
	)
	
	# Limit data size for API efficiency (max 20 records for insights)
	sample_data = chart_data[:20] if len(chart_data) > 20 else chart_data
	data_json = json.dumps(sample_data, ensure_ascii=False)
	
	try:
		insights_text = _generate_text_from_model(prompt + data_json)
		
		# Parse the bullet points
		lines = [line.strip() for line in insights_text.split('\n') if line.strip()]
		insights = []
		
		for line in lines:
			# Clean up the line and ensure it starts with a bullet
			cleaned = line.replace('•', '').replace('-', '').strip()
			if cleaned and len(cleaned) > 10:  # Minimum meaningful insight length
				insights.append(cleaned)
		
		# Ensure we have at least one insight
		if not insights:
			insights = ["Data analysis completed, but no specific insights were generated."]
		
		# Limit to max 5 insights
		return insights[:5]
		
	except Exception as e:
		logger.error(f"Error generating chart insights: {e}")
		return [f"Unable to generate insights: {str(e)}"]


