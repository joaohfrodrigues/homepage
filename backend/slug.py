"""Slug generation utilities for SEO-friendly URLs"""

import re
import unicodedata


def slugify(text: str) -> str:
    """Convert text to URL-friendly slug.

    Examples:
        "25' Valencia" -> "25-valencia"
        "Paris 2024" -> "paris-2024"
        "Lisbon – Portugal" -> "lisbon-portugal"

    Args:
        text: Text to slugify

    Returns:
        Slugified text
    """
    # Normalize unicode characters (é -> e, etc.)
    text = unicodedata.normalize('NFKD', text)
    text = text.encode('ascii', 'ignore').decode('ascii')

    # Convert to lowercase
    text = text.lower()

    # Remove special characters, keep only alphanumeric, spaces, and hyphens
    text = re.sub(r'[^\w\s\-]', '', text)

    # Replace spaces with hyphens
    text = re.sub(r'[\s_]+', '-', text)

    # Remove duplicate hyphens
    text = re.sub(r'-+', '-', text)

    # Strip leading/trailing hyphens
    text = text.strip('-')

    return text
