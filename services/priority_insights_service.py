"""
Gemini service extension for Priority Insights with Google Search grounding.

This module provides functions to generate insights and action recommendations
for priorities using Gemini with Google Search grounding.
"""

import json
import logging
from typing import Dict, Any, List
from services.gemini_service import _generate_json_from_model, _generate_text_from_model

logger = logging.getLogger(__name__)


def generate_priority_insights_with_search(priority_title: str, priority_description: str, 
                                         priority_category: str, user_role: str) -> Dict[str, Any]:
    """
    Generate insights for a priority using Gemini with Google Search grounding.
    
    Args:
        priority_title (str): The priority title
        priority_description (str): The priority description/why
        priority_category (str): The priority category
        user_role (str): The user role context
        
    Returns:
        dict: Contains insights_content and search_grounding_data
    """
    
    # Create search queries based on the priority
    search_queries = _generate_search_queries(priority_title, priority_description, priority_category, user_role)
    
    # Simulate Google Search grounding (in a real implementation, you'd call Google Search API)
    search_results = _simulate_google_search(search_queries)
    
    # Generate insights using Gemini with the search results as grounding
    insights_prompt = f"""
You are analyzing a business priority for a {user_role} role.

PRIORITY CONTEXT:
- Title: {priority_title}
- Description: {priority_description}
- Category: {priority_category}
- Role: {user_role}

SEARCH GROUNDING DATA:
{json.dumps(search_results, indent=2)}

TASK: Generate comprehensive insights about this business challenge. Structure your response as follows:

## Market Context
What are the current trends and best practices in this area?

## Business Impact
Why is this priority important for the business?

## Key Challenges
What are the main obstacles to address?

## Success Metrics
How should progress be measured?

## Industry Insights
What do successful companies do in this area?

IMPORTANT: 
- Start directly with the content, no introductory phrases
- Use clear, professional language
- Focus on actionable, data-driven insights
- Leverage the search grounding information
- Format with proper markdown headers and bullet points
"""

    try:
        insights_content = _generate_text_from_model(insights_prompt)
        
        return {
            "insights_content": insights_content,
            "search_grounding_data": json.dumps(search_results),
            "search_queries": search_queries
        }
    except Exception as e:
        logger.error(f"Error generating priority insights: {e}")
        return {
            "insights_content": f"Unable to generate insights at this time. Error: {str(e)}",
            "search_grounding_data": json.dumps(search_results),
            "search_queries": search_queries
        }


def generate_action_recommendations(priority_title: str, priority_description: str, 
                                  priority_category: str, user_role: str, 
                                  existing_actions: List[Dict] = None) -> List[Dict[str, Any]]:
    """
    Generate action recommendations for a priority.
    
    Args:
        priority_title (str): The priority title
        priority_description (str): The priority description
        priority_category (str): The priority category
        user_role (str): The user role context
        existing_actions (list): Existing actions to avoid duplicating
        
    Returns:
        list: List of action recommendation dictionaries
    """
    
    existing_actions_text = ""
    if existing_actions:
        existing_actions_text = f"\nEXISTING ACTIONS TO AVOID DUPLICATING:\n{json.dumps(existing_actions, indent=2)}"
    
    actions_prompt = f"""
You are a business strategy expert creating action recommendations for a priority.

PRIORITY CONTEXT:
- Title: {priority_title}
- Description: {priority_description}
- Category: {priority_category}
- Role: {user_role}
{existing_actions_text}

TASK: Generate 3-5 specific, actionable recommendations for addressing this priority.

For each action, provide:
- title: Short, clear action title
- description: Detailed description of what to do
- priority_level: 1 (high), 2 (medium), or 3 (low)
- estimated_effort: "low", "medium", or "high"
- estimated_impact: "low", "medium", or "high"

Return ONLY a JSON array of action objects with this structure:
[
  {{
    "title": "Action Title",
    "description": "Detailed action description...",
    "priority_level": 1,
    "estimated_effort": "medium",
    "estimated_impact": "high"
  }}
]

Focus on practical, implementable actions that a {user_role} can execute.
"""

    try:
        actions_json = _generate_json_from_model(actions_prompt, "")
        return actions_json if isinstance(actions_json, list) else []
    except Exception as e:
        logger.error(f"Error generating action recommendations: {e}")
        return []


def _generate_search_queries(priority_title: str, priority_description: str, 
                            priority_category: str, user_role: str) -> List[str]:
    """
    Generate relevant search queries for the priority.
    
    Args:
        priority_title (str): The priority title
        priority_description (str): The priority description
        priority_category (str): The priority category
        user_role (str): The user role context
        
    Returns:
        list: List of search query strings
    """
    
    # Base queries from the priority content
    base_queries = [
        f"{priority_title} best practices",
        f"{priority_category} optimization strategies",
        f"{user_role} {priority_title} solutions"
    ]
    
    # Extract key terms from description for more specific queries
    description_words = priority_description.lower().split()
    key_terms = [word for word in description_words if len(word) > 4 and word not in ['this', 'that', 'with', 'from', 'they', 'have', 'been', 'will', 'should', 'could']]
    
    if key_terms:
        # Add queries with key terms
        base_queries.extend([
            f"{' '.join(key_terms[:3])} business strategy",
            f"{priority_category} {' '.join(key_terms[:2])} trends"
        ])
    
    # Add industry-specific queries based on category
    category_queries = {
        'marketing': ['digital marketing trends 2024', 'marketing automation best practices'],
        'performance': ['website performance optimization', 'core web vitals improvement'],
        'checkout': ['ecommerce checkout optimization', 'payment processing best practices'],
        'search': ['site search optimization', 'search UX best practices'],
        'returns': ['returns management optimization', 'customer return experience'],
        'merch': ['product catalog optimization', 'inventory management strategies']
    }
    
    if priority_category in category_queries:
        base_queries.extend(category_queries[priority_category])
    
    return base_queries[:5]  # Limit to 5 queries


def _simulate_google_search(queries: List[str]) -> Dict[str, Any]:
    """
    Simulate Google Search results for the queries.
    
    In a real implementation, this would call the Google Search API.
    For now, we'll return structured mock data.
    
    Args:
        queries (list): List of search queries
        
    Returns:
        dict: Structured search results
    """
    
    # Mock search results - in production, replace with actual Google Search API calls
    mock_results = {
        "search_queries": queries,
        "results": []
    }
    
    for query in queries:
        # Generate mock search results based on query content
        mock_result = {
            "query": query,
            "results": [
                {
                    "title": f"Best Practices for {query.split()[0]} in 2024",
                    "url": f"https://example.com/{query.replace(' ', '-')}",
                    "snippet": f"Comprehensive guide to {query} with proven strategies and case studies from industry leaders.",
                    "relevance_score": 0.9
                },
                {
                    "title": f"How to Optimize {query.split()[0]} Performance",
                    "url": f"https://example.com/optimize-{query.replace(' ', '-')}",
                    "snippet": f"Step-by-step approach to improving {query} with measurable results and ROI analysis.",
                    "relevance_score": 0.8
                },
                {
                    "title": f"{query.split()[0]} Trends and Future Outlook",
                    "url": f"https://example.com/trends-{query.replace(' ', '-')}",
                    "snippet": f"Latest trends in {query} and predictions for the coming year based on market analysis.",
                    "relevance_score": 0.7
                }
            ]
        }
        mock_results["results"].append(mock_result)
    
    return mock_results


def get_priority_summary(priority_id: str, grid_type: str, user_role: str) -> Dict[str, Any]:
    """
    Get a summary of all data for a priority (insights, notes, actions).
    
    Args:
        priority_id (str): The priority identifier
        grid_type (str): The grid type (short-term/long-term)
        user_role (str): The user role
        
    Returns:
        dict: Summary of all priority data
    """
    from app.database.priority_insights_schema import (
        get_priority_insights, get_priority_notes, get_priority_actions
    )
    
    insights = get_priority_insights(priority_id, grid_type, user_role)
    notes = get_priority_notes(priority_id, grid_type, user_role)
    actions = get_priority_actions(priority_id, grid_type, user_role)
    
    return {
        "priority_id": priority_id,
        "insights": insights,
        "notes": notes,
        "actions": actions,
        "summary": {
            "has_insights": insights is not None,
            "notes_count": len(notes),
            "actions_count": len(actions),
            "last_updated": insights["updated_ts"] if insights else None
        }
    }
