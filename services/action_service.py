"""
Action service for Gemini integration with Google Search grounding.

This module provides functions to generate detailed action context and next steps
using Gemini with Google Search grounding for the Explore Action feature.
"""

import json
import logging
from typing import Dict, Any, List
from services.gemini_service import _generate_json_from_model, _generate_text_from_model

logger = logging.getLogger(__name__)


def generate_action_context_with_search(action_title: str, action_description: str,
                                      priority_title: str, priority_description: str,
                                      user_role: str) -> Dict[str, Any]:
    """
    Generate detailed context for an action using Gemini with Google Search grounding.
    
    Args:
        action_title (str): The action title
        action_description (str): The action description
        priority_title (str): The priority title
        priority_description (str): The priority description
        user_role (str): The user role context
        
    Returns:
        dict: Contains context_content and search_grounding_data
    """
    
    # Create search queries based on the action
    search_queries = _generate_action_search_queries(
        action_title, action_description, priority_title, user_role
    )
    
    # Simulate Google Search grounding
    search_results = _simulate_google_search(search_queries)
    
    # Generate detailed context using Gemini
    context_prompt = f"""
You are analyzing a specific business action for a {user_role} role.

ACTION CONTEXT:
- Action Title: {action_title}
- Action Description: {action_description}
- Related Priority: {priority_title}
- Priority Description: {priority_description}
- Role: {user_role}

SEARCH GROUNDING DATA:
{json.dumps(search_results, indent=2)}

TASK: Generate comprehensive context and analysis for this specific action. Structure your response as follows:

## Action Overview
Provide a clear summary of what this action involves and why it's important.

## Implementation Strategy
Detail the specific steps and approach for executing this action.

## Success Factors
What are the key factors that will determine success?

## Potential Challenges
What obstacles might be encountered and how to address them?

## Resource Requirements
What resources (time, budget, people, tools) are needed?

## Industry Best Practices
What do successful companies do when implementing similar actions?

## Expected Outcomes
What results can be expected from this action?

## Risk Assessment
What are the potential risks and mitigation strategies?

IMPORTANT: 
- Start directly with the content, no introductory phrases
- Use clear, professional language
- Focus on actionable, specific guidance
- Leverage the search grounding information
- Format with proper markdown headers and bullet points
- Make it practical and implementable for a {user_role}
"""

    try:
        context_content = _generate_text_from_model(context_prompt)
        
        return {
            "context_content": context_content,
            "search_grounding_data": json.dumps(search_results),
            "search_queries": search_queries
        }
    except Exception as e:
        logger.error(f"Error generating action context: {e}")
        return {
            "context_content": f"Unable to generate context at this time. Error: {str(e)}",
            "search_grounding_data": json.dumps(search_results),
            "search_queries": search_queries
        }


def generate_action_next_steps(action_title: str, action_description: str,
                              context_data: str, user_role: str) -> str:
    """
    Generate specific next steps for an action.
    
    Args:
        action_title (str): The action title
        action_description (str): The action description
        context_data (str): The context data from Gemini
        user_role (str): The user role context
        
    Returns:
        str: Formatted next steps
    """
    
    next_steps_prompt = f"""
You are creating a practical action plan for a {user_role}.

ACTION DETAILS:
- Title: {action_title}
- Description: {action_description}

CONTEXT ANALYSIS:
{context_data}

TASK: Create a specific, actionable next steps plan. Structure as follows:

## Immediate Actions (Next 1-2 weeks)
List 3-5 specific, concrete steps that should be taken immediately.

## Short-term Goals (Next 1-3 months)
Define 3-4 measurable milestones to achieve.

## Medium-term Objectives (Next 3-6 months)
Outline 2-3 broader objectives to work toward.

## Success Metrics
Define 3-5 specific metrics to track progress and success.

## Timeline
Provide a realistic timeline with key milestones.

## Resource Allocation
Break down what resources are needed and when.

## Dependencies
Identify what needs to happen first or what this action depends on.

IMPORTANT:
- Make steps specific and actionable
- Include timeframes and deadlines
- Focus on measurable outcomes
- Consider the {user_role} role context
- Format with clear headers and bullet points
"""

    try:
        next_steps = _generate_text_from_model(next_steps_prompt)
        return next_steps
    except Exception as e:
        logger.error(f"Error generating next steps: {e}")
        return f"Unable to generate next steps at this time. Error: {str(e)}"


def _generate_action_search_queries(action_title: str, action_description: str,
                                   priority_title: str, user_role: str) -> List[str]:
    """
    Generate relevant search queries for the action.
    
    Args:
        action_title (str): The action title
        action_description (str): The action description
        priority_title (str): The priority title
        user_role (str): The user role context
        
    Returns:
        list: List of search query strings
    """
    
    # Base queries from the action content
    base_queries = [
        f"{action_title} implementation guide",
        f"{action_title} best practices",
        f"{user_role} {action_title} strategies",
        f"{priority_title} {action_title} solutions"
    ]
    
    # Extract key terms from description for more specific queries
    description_words = action_description.lower().split()
    key_terms = [word for word in description_words if len(word) > 4 and word not in ['this', 'that', 'with', 'from', 'they', 'have', 'been', 'will', 'should', 'could', 'action', 'priority']]
    
    if key_terms:
        # Add queries with key terms
        base_queries.extend([
            f"{' '.join(key_terms[:3])} implementation",
            f"{action_title} {' '.join(key_terms[:2])} guide"
        ])
    
    # Add role-specific queries
    role_queries = {
        'Customer_Analyst': ['customer analytics implementation', 'data-driven customer insights'],
        'Marketing_Manager': ['marketing campaign optimization', 'customer acquisition strategies'],
        'Product_Manager': ['product optimization strategies', 'user experience improvement'],
        'Sales_Manager': ['sales process optimization', 'customer conversion strategies']
    }
    
    if user_role in role_queries:
        base_queries.extend(role_queries[user_role])
    
    # Add industry-specific queries based on action title
    if 'optimization' in action_title.lower():
        base_queries.append('business optimization strategies')
    if 'analysis' in action_title.lower():
        base_queries.append('data analysis best practices')
    if 'strategy' in action_title.lower():
        base_queries.append('business strategy implementation')
    
    return base_queries[:6]  # Limit to 6 queries


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
                    "title": f"Complete Guide to {query.split()[0]} Implementation",
                    "url": f"https://example.com/{query.replace(' ', '-')}-guide",
                    "snippet": f"Comprehensive step-by-step guide for {query} with real-world examples and case studies from industry experts.",
                    "relevance_score": 0.95
                },
                {
                    "title": f"Best Practices for {query.split()[0]} in 2024",
                    "url": f"https://example.com/{query.replace(' ', '-')}-best-practices",
                    "snippet": f"Latest best practices and proven strategies for {query} based on current market trends and successful implementations.",
                    "relevance_score": 0.90
                },
                {
                    "title": f"How to Successfully Implement {query.split()[0]}",
                    "url": f"https://example.com/implement-{query.replace(' ', '-')}",
                    "snippet": f"Practical implementation guide for {query} with actionable steps, common pitfalls to avoid, and success metrics.",
                    "relevance_score": 0.85
                },
                {
                    "title": f"{query.split()[0]} Case Studies and Examples",
                    "url": f"https://example.com/{query.replace(' ', '-')}-case-studies",
                    "snippet": f"Real-world case studies and examples of successful {query} implementations with measurable results and lessons learned.",
                    "relevance_score": 0.80
                }
            ]
        }
        mock_results["results"].append(mock_result)
    
    return mock_results
