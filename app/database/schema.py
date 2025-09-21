"""
Database schema utilities.

This module provides functions for analyzing and inferring database schema information.
"""

from datetime import datetime


def infer_column_type(column_name, sqlite_type, table_name, cursor):
    """
    Infer the actual data type from column name and sample data.
    
    This function analyzes column names and sample data to determine the most
    appropriate data type for display and processing purposes.
    
    Args:
        column_name (str): The name of the column
        sqlite_type (str): The SQLite type declaration
        table_name (str): The name of the table containing the column
        cursor: Database cursor for executing queries
        
    Returns:
        str: The inferred data type ('INTEGER', 'REAL', 'TEXT', 'DATETIME', 'BOOLEAN')
    """
    column_lower = column_name.lower()
    
    # First, try to infer from column name patterns
    if any(keyword in column_lower for keyword in ['id', '_id']):
        return 'INTEGER'
    elif any(keyword in column_lower for keyword in ['date', 'time', 'created', 'updated', 'timestamp']):
        return 'DATETIME'
    elif any(keyword in column_lower for keyword in ['age', 'count', 'number', 'total', 'amount', 'value', 'price', 'cost', 'quantity', 'orders', 'items']):
        return 'INTEGER'
    elif any(keyword in column_lower for keyword in ['rate', 'percent', 'ratio', 'average', 'avg', 'score', 'rating']):
        return 'REAL'
    elif any(keyword in column_lower for keyword in ['email', 'name', 'title', 'description', 'text', 'category', 'type', 'status', 'gender', 'location', 'source', 'channel', 'preference', 'style', 'size']):
        return 'TEXT'
    elif any(keyword in column_lower for keyword in ['is_', 'has_', 'active', 'enabled', 'visible', 'public']):
        return 'BOOLEAN'
    
    # If name-based inference fails, sample some data to determine type
    try:
        cursor.execute(f"SELECT {column_name} FROM '{table_name}' WHERE {column_name} IS NOT NULL LIMIT 10")
        sample_data = cursor.fetchall()
        
        if not sample_data:
            return 'TEXT'  # Default if no data
        
        # Check if all values are numeric
        numeric_count = 0
        date_count = 0
        boolean_count = 0
        
        for row in sample_data:
            value = str(row[0]).strip()
            if not value:
                continue
                
            # Check for numeric
            try:
                float(value)
                numeric_count += 1
            except ValueError:
                pass
            
            # Check for date patterns
            if any(pattern in value for pattern in ['-', '/', ':']) and len(value) > 8:
                try:
                    datetime.fromisoformat(value.replace('/', '-').replace(' ', 'T'))
                    date_count += 1
                except:
                    pass
            
            # Check for boolean patterns
            if value.lower() in ['true', 'false', '1', '0', 'yes', 'no', 'y', 'n']:
                boolean_count += 1
        
        total_samples = len(sample_data)
        
        # Determine type based on sample analysis
        if date_count / total_samples > 0.7:
            return 'DATETIME'
        elif boolean_count / total_samples > 0.7:
            return 'BOOLEAN'
        elif numeric_count / total_samples > 0.7:
            # Check if they're integers or decimals
            integer_count = 0
            for row in sample_data:
                value = str(row[0]).strip()
                try:
                    if float(value).is_integer():
                        integer_count += 1
                except ValueError:
                    pass
            
            if integer_count / numeric_count > 0.8:
                return 'INTEGER'
            else:
                return 'REAL'
        else:
            return 'TEXT'
            
    except Exception:
        return 'TEXT'  # Default fallback
