"""Home page component - Hybrid layout with latest collections and featured photos"""

from datetime import datetime, timezone

from fasthtml.common import *

from backend.db_service import (
    get_all_collections,
    get_collection_photos,
    get_collection_stats,
    search_photos,
)
from components.ui.badges import get_collection_badges, render_badges
from components.ui.footer import create_footer
from components.ui.head import create_head
from components.ui.header import create_hero, create_navbar, create_section_nav
from components.ui.lightbox import create_lightbox
from components.ui.photo_grid import create_photo_grid
from services.insights import get_dataset_stats
from services.markdown import get_all_blog_articles


def _format_date(date_str):  # noqa: PLR0911
    """Format date string to relative time (e.g., '2 days ago')."""
    if not date_str:
        return 'recently'
    try:
        if isinstance(date_str, datetime):
            updated = date_str
        else:
            updated = datetime.fromisoformat(str(date_str).replace('Z', '+00:00'))

        if updated.tzinfo is None:
            updated = updated.replace(tzinfo=timezone.utc)
        else:
            updated = updated.astimezone(timezone.utc)

        now = datetime.now(timezone.utc)
        delta = now - updated

        if delta.days == 0:
            return 'today'
        if delta.days == 1:
            return 'yesterday'
        if delta.days < 7:
            return f'{delta.days} days ago'
        if delta.days < 30:
            weeks = delta.days // 7
            return f'{weeks} week{"s" if weeks > 1 else ""} ago'
        if delta.days < 365:
            months = delta.days // 30
            return f'{months} month{"s" if months > 1 else ""} ago'

        years = delta.days // 365
        return f'{years} year{"s" if years > 1 else ""} ago'
    except (ValueError, AttributeError):
        return 'recently'


def create_latest_blog_articles():
    """Create a section displaying the 3 latest blog articles."""
    articles = get_all_blog_articles(include_drafts=False)[:3]

    if not articles:
        return None

    article_cards = [
        A(
            Div(
                P(
                    _format_date(article.get('date')),
                    style='color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 0.25rem;',
                ),
                H3(
                    article['title'],
                    style='font-size: 1.4rem; margin: 0 0 0.5rem 0; font-weight: 300;',
                ),
                P(
                    article.get('description', ''),
                    style='color: var(--text-secondary); font-size: 1rem; line-height: 1.6;',
                ),
                Div(
                    Span('Read article', style='font-weight: 600;'),
                    Span(' →', style='color: var(--text-secondary); margin-left: 6px;'),
                    style='color: var(--text-primary); font-size: 0.95rem; display: inline-flex; align-items: center;',
                ),
                style='padding: 1.5rem; display: grid; gap: 0.6rem; height: 100%; background: linear-gradient(135deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));',
            ),
            href=f'/blog/{article["slug"]}',
            style='display: block; text-decoration: none; color: inherit; transition: all 0.3s ease; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; overflow: hidden;',
            onmouseover='this.style.transform="translateY(-4px)"; this.style.backgroundColor="rgba(255, 255, 255, 0.05)"; this.style.borderColor="rgba(255, 255, 255, 0.15)";',
            onmouseout='this.style.transform="translateY(0)"; this.style.backgroundColor="rgba(255, 255, 255, 0.03)"; this.style.borderColor="rgba(255, 255, 255, 0.1)";',
        )
        for article in articles
    ]

    return Section(
        Div(
            Style(
                """
                @media (max-width: 1024px) {
                    .blog-cards-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                }
                @media (max-width: 768px) {
                    .blog-cards-grid { grid-template-columns: 1fr; }
                }
                """
            ),
            Div(
                H2(
                    'Latest Blog Articles',
                    style='font-size: 2rem; margin-bottom: 0.5rem; font-weight: 200; letter-spacing: 0.05em;',
                ),
                P(
                    'Thoughts and articles from my current work',
                    style='color: var(--text-secondary); font-size: 1rem; margin-bottom: 3rem;',
                ),
                style='text-align: center;',
            ),
            Div(
                *article_cards,
                cls='blog-cards-grid',
                style="""
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 1.5rem;
                    margin-bottom: 2rem;
                """,
            ),
            Div(
                A(
                    'View All Articles →',
                    href='/blog',
                    style="""
                        display: inline-block;
                        padding: 1rem 2.5rem;
                        background: rgba(255, 255, 255, 0.05);
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        border-radius: 8px;
                        color: var(--text-primary);
                        text-decoration: none;
                        font-size: 0.95rem;
                        transition: all 0.3s ease;
                    """,
                    onmouseover="this.style.background='rgba(255, 255, 255, 0.1)'; this.style.borderColor='rgba(255, 255, 255, 0.2)'",
                    onmouseout="this.style.background='rgba(255, 255, 255, 0.05)'; this.style.borderColor='rgba(255, 255, 255, 0.1)'",
                ),
                style='text-align: center; margin-top: 2rem;',
            ),
            cls='container',
            style='max-width: 1600px; margin: 0 auto; padding: 3rem 2rem 2rem;',
        ),
        style='background: linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%);',
        id='blog-section',
    )


def create_collection_card(collection, index, badges=None):
    """Create a compact collection card with carousel.

    Args:
        collection: Collection data dict
        index: Card index for animation timing
        badges: List of badge dicts (optional)
    """

    badges = badges or []

    collection_id = collection['id']
    collection_slug = collection.get('slug', '')
    photos, _ = get_collection_photos(collection_id, page=1, per_page=6, order_by='popular')

    carousel_items = []
    for i, photo in enumerate(photos[:6]):
        img_url = photo.get('url_regular', photo.get('url', ''))

        carousel_items.append(
            Img(
                src=img_url,
                alt=photo.get('title', ''),
                loading='lazy' if i > 0 else 'eager',
                cls='carousel-image',
                style=f'display: {"block" if i == 0 else "none"}; width: 100%; height: 100%; object-fit: contain; opacity: {1 if i == 0 else 0}; transition: opacity 0.5s ease-in-out;',
                **{'data-index': str(i)},
            )
        )

    carousel_id = f'carousel-{collection_id}'

    return A(
        # Carousel container
        Div(
            # Images
            Div(
                *carousel_items,
                cls='carousel-images',
                style="""
                    position: relative;
                    aspect-ratio: 4/3;
                    overflow: hidden;
                    border-radius: 8px 8px 0 0;
                    background: #1a1a1a;
                """,
            ),
            # Previous arrow
            Button(
                NotStr(
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 20px; height: 20px; display: block; flex-shrink: 0;"><polyline points="15 18 9 12 15 6"></polyline></svg>'
                ),
                cls='carousel-arrow carousel-prev',
                style="""
                    position: absolute;
                    left: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    background: rgba(0, 0, 0, 0.5);
                    color: white;
                    border: none;
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    cursor: pointer;
                    z-index: 3;
                    display: grid;
                    place-items: center;
                    opacity: 0;
                    transition: opacity 0.3s ease, background 0.2s ease;
                    padding: 0;
                    user-select: none;
                    -webkit-tap-highlight-color: transparent;
                """,
                onclick='event.preventDefault(); event.stopPropagation();',
            ),
            # Next arrow
            Button(
                NotStr(
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 20px; height: 20px; display: block; flex-shrink: 0;"><polyline points="9 18 15 12 9 6"></polyline></svg>'
                ),
                cls='carousel-arrow carousel-next',
                style="""
                    position: absolute;
                    right: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    background: rgba(0, 0, 0, 0.5);
                    color: white;
                    border: none;
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    cursor: pointer;
                    z-index: 3;
                    display: grid;
                    place-items: center;
                    opacity: 0;
                    transition: opacity 0.3s ease, background 0.2s ease;
                    padding: 0;
                    user-select: none;
                    -webkit-tap-highlight-color: transparent;
                """,
                onclick='event.preventDefault(); event.stopPropagation();',
            ),
            # Photo count badge
            Div(
                Span(f'{collection["total_photos"]}', style='font-weight: 600;'),
                ' photos',
                cls='photo-count-badge',
                style="""
                    position: absolute;
                    top: 12px;
                    right: 12px;
                    background: rgba(0, 0, 0, 0.75);
                    color: white;
                    padding: 6px 12px;
                    border-radius: 20px;
                    font-size: 0.85rem;
                    z-index: 2;
                    backdrop-filter: blur(8px);
                    -webkit-backdrop-filter: blur(8px);
                """,
            ),
            # Multiple badges support (stacked vertically)
            *render_badges(badges),
            # Carousel indicators (dots)
            Div(
                *[
                    Span(
                        cls='carousel-dot',
                        style=f"""
                            width: 8px;
                            height: 8px;
                            border-radius: 50%;
                            background: {'rgba(255, 255, 255, 0.8)' if i == 0 else 'rgba(255, 255, 255, 0.3)'};
                            display: inline-block;
                            margin: 0 4px;
                            transition: background 0.3s ease;
                            cursor: pointer;
                        """,
                        **{'data-index': str(i)},
                    )
                    for i in range(len(photos[:6]))
                ],
                cls='carousel-dots',
                style="""
                    position: absolute;
                    bottom: 12px;
                    left: 50%;
                    transform: translateX(-50%);
                    z-index: 2;
                    display: flex;
                    gap: 4px;
                """,
            ),
            id=carousel_id,
            cls='collection-carousel',
            style='position: relative;',
        ),
        # Collection info
        Div(
            H3(
                collection['title'],
                style='font-size: 1.3rem; margin-bottom: 0.5rem; color: var(--text-primary); font-weight: 300;',
            ),
            Div(
                Span(f'{collection["total_photos"]} photos', style='color: var(--text-tertiary);'),
                Span(' • ', style='color: var(--text-muted); margin: 0 6px;'),
                Span(
                    f'Updated {_format_date(collection.get("updated_at", ""))}',
                    style='color: var(--text-tertiary);',
                ),
                style='font-size: 0.85rem; display: flex; align-items: center;',
            ),
            style='padding: 1.25rem;',
        ),
        href=f'/collection/{collection_slug}',
        cls='collection-card',
        style=f"""
            display: block;
            background: rgba(255, 255, 255, 0.03);
            border-radius: 8px;
            overflow: hidden;
            text-decoration: none;
            transition: all 0.3s ease;
            opacity: 0;
            animation: fadeInScale 0.6s ease-out forwards;
            animation-delay: {index * 0.1}s;
            height: fit-content;
        """,
        onmouseover="this.style.transform='translateY(-8px)'; this.style.background='rgba(255, 255, 255, 0.05)'",
        onmouseout="this.style.transform='translateY(0)'; this.style.background='rgba(255, 255, 255, 0.03)'",
    )


def home_page(
    collections=None,
    latest_photos=None,
):
    """Render the home page with latest collections and featured photos."""

    if collections is None:
        collections = get_all_collections()

    # Get collection statistics for badge calculations
    collection_stats = get_collection_stats()

    # Get 3 most recent collections sorted by created_at (published_at)
    featured_collections = sorted(
        collections, key=lambda c: c.get('published_at', ''), reverse=True
    )[:3]

    # Calculate badges for each featured collection
    collection_badges = {}
    for collection in featured_collections:
        badges = get_collection_badges(collection, collection_stats, collections)
        collection_badges[collection['id']] = badges

    # Fetch featured photos if not provided (just 6 for featured section)
    if latest_photos is None:
        latest_photos, _ = search_photos(query='', page=1, per_page=6, order_by='popular')

    # Get first photo for og:image (social sharing preview)
    og_image = None
    if latest_photos:
        og_image = latest_photos[0].get('url_regular', latest_photos[0].get('url'))

    # Get dataset stats for the mini stats section
    try:
        latest_stats = get_dataset_stats()
    except Exception:
        # Fallback if stats generation fails
        latest_stats = {
            'total_collections': len(collections),
            'total_photos': 0,
            'total_views': 0,
            'total_locations': 0,
        }

    latest_blog_section = create_latest_blog_articles()

    return Html(
        create_head(
            title='Home | Joao Rodrigues',
            description='Browse my best photography work, curated by popularity and views. Landscapes, portraits, and travel photography.',
            og_image=og_image,
        ),
        Body(
            create_navbar(current_page='home'),
            create_hero(),
            create_section_nav(),
            # Main content
            Main(
                # Latest Blog Articles Section
                *([latest_blog_section] if latest_blog_section else []),
                # Featured Photos Section
                Section(
                    Div(
                        Div(
                            H2(
                                'Featured Photos',
                                style='font-size: 2rem; margin-bottom: 0.5rem; font-weight: 200; letter-spacing: 0.05em;',
                            ),
                            P(
                                'My best work, curated by popularity and views',
                                style='color: var(--text-secondary); font-size: 1rem; margin-bottom: 3rem;',
                            ),
                            style='text-align: center;',
                        ),
                        # Photo grid with small selection
                        create_photo_grid(
                            latest_photos[:6] if latest_photos else [],
                            show_search=False,
                        ),
                        # Link to gallery
                        Div(
                            A(
                                'View All Photos →',
                                href='/gallery',
                                style="""
                                    display: inline-block;
                                    padding: 1rem 2.5rem;
                                    background: rgba(255, 255, 255, 0.05);
                                    border: 1px solid rgba(255, 255, 255, 0.1);
                                    border-radius: 8px;
                                    color: var(--text-primary);
                                    text-decoration: none;
                                    font-size: 0.95rem;
                                    transition: all 0.3s ease;
                                """,
                                onmouseover="this.style.background='rgba(255, 255, 255, 0.1)'; this.style.borderColor='rgba(255, 255, 255, 0.2)'",
                                onmouseout="this.style.background='rgba(255, 255, 255, 0.05)'; this.style.borderColor='rgba(255, 255, 255, 0.1)'",
                            ),
                            style='text-align: center; margin-top: 2rem;',
                        ),
                        cls='container',
                        style='max-width: 1800px; margin: 0 auto; padding: 4rem 2rem;',
                    ),
                    id='photos-section',
                ),
                # Featured Collections Section
                Section(
                    Div(
                        Div(
                            H2(
                                'Featured Collections',
                                style='font-size: 2rem; margin-bottom: 0.5rem; font-weight: 200; letter-spacing: 0.05em;',
                            ),
                            P(
                                'Curated photo series from my portfolio',
                                style='color: var(--text-secondary); font-size: 1rem; margin-bottom: 3rem;',
                            ),
                            style='text-align: center;',
                        ),
                        # Featured collections grid (3 columns matching photo grid)
                        Div(
                            *[
                                create_collection_card(
                                    c, i, badges=collection_badges.get(c['id'], [])
                                )
                                for i, c in enumerate(featured_collections)
                            ],
                            cls='featured-collections-grid',
                            style="""
                                display: grid;
                                grid-template-columns: repeat(3, 1fr);
                                gap: 1.5rem;
                                margin-bottom: 2rem;
                            """,
                        ),
                        # Link to all collections
                        Div(
                            A(
                                'View All Collections →',
                                href='/collections',
                                style="""
                                    display: inline-block;
                                    padding: 1rem 2.5rem;
                                    background: rgba(255, 255, 255, 0.05);
                                    border: 1px solid rgba(255, 255, 255, 0.1);
                                    border-radius: 8px;
                                    color: var(--text-primary);
                                    text-decoration: none;
                                    font-size: 0.95rem;
                                    transition: all 0.3s ease;
                                """,
                                onmouseover="this.style.background='rgba(255, 255, 255, 0.1)'; this.style.borderColor='rgba(255, 255, 255, 0.2)'",
                                onmouseout="this.style.background='rgba(255, 255, 255, 0.05)'; this.style.borderColor='rgba(255, 255, 255, 0.1)'",
                            ),
                            style='text-align: center; margin-top: 2rem;',
                        ),
                        cls='container',
                        style='max-width: 1600px; margin: 0 auto; padding: 3rem 2rem 2rem;',
                    ),
                    style='background: linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%);',
                    id='collections-section',
                ),
                # Metrics Section - Focused set
                Section(
                    Div(
                        Div(
                            H2(
                                'Statistics & Insights',
                                style='font-size: 2rem; margin-bottom: 0.5rem; font-weight: 200; letter-spacing: 0.05em; text-align: center;',
                            ),
                            P(
                                'Overview of my portfolio and dataset',
                                style='color: var(--text-secondary); font-size: 1rem; margin-bottom: 3rem; text-align: center;',
                            ),
                        ),
                        # Focused 4-card grid (aligned with Insights page)
                        Div(
                            Div(
                                P(
                                    'Total Photos',
                                    style='color: var(--text-secondary); font-size: 0.85rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 0.75rem;',
                                ),
                                P(
                                    f"{latest_stats['total_photos']:,.0f}",
                                    style='color: var(--text-primary); font-size: 2rem; font-weight: 300; font-family: "Merriweather", serif;',
                                ),
                                style='text-align: center; padding: 1.5rem 1rem; border-radius: 12px; background: rgba(255,255,255,0.03);',
                            ),
                            Div(
                                P(
                                    'Collections',
                                    style='color: var(--text-secondary); font-size: 0.85rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 0.75rem;',
                                ),
                                P(
                                    f"{latest_stats['total_collections']:,.0f}",
                                    style='color: var(--text-primary); font-size: 2rem; font-weight: 300; font-family: "Merriweather", serif;',
                                ),
                                style='text-align: center; padding: 1.5rem 1rem; border-radius: 12px; background: rgba(255,255,255,0.03);',
                            ),
                            Div(
                                P(
                                    'Locations',
                                    style='color: var(--text-secondary); font-size: 0.85rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 0.75rem;',
                                ),
                                P(
                                    f"{latest_stats.get('total_locations', len(latest_stats.get('top_locations', {}))):,.0f}",
                                    style='color: var(--text-primary); font-size: 2rem; font-weight: 300; font-family: "Merriweather", serif;',
                                ),
                                style='text-align: center; padding: 1.5rem 1rem; border-radius: 12px; background: rgba(255,255,255,0.03);',
                            ),
                            Div(
                                P(
                                    'Total Views',
                                    style='color: var(--text-secondary); font-size: 0.85rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 0.75rem;',
                                ),
                                P(
                                    f"{latest_stats['total_views']:,.0f}",
                                    style='color: var(--text-primary); font-size: 2rem; font-weight: 300; font-family: "Merriweather", serif;',
                                ),
                                style='text-align: center; padding: 1.5rem 1rem; border-radius: 12px; background: rgba(255,255,255,0.03);',
                            ),
                            cls='unified-stats-grid',
                            style="""
                                display: grid;
                                grid-template-columns: repeat(4, minmax(220px, 1fr));
                                gap: 1.5rem;
                                margin-bottom: 2rem;
                                @media (max-width: 1100px) {
                                    grid-template-columns: repeat(2, minmax(0, 1fr));
                                }
                                @media (max-width: 640px) {
                                    grid-template-columns: 1fr;
                                }
                            """,
                        ),
                        # Link to insights
                        Div(
                            A(
                                'View Full Insights & Charts →',
                                href='/insights',
                                style="""
                                    display: inline-block;
                                    padding: 1rem 2.5rem;
                                    background: rgba(255, 255, 255, 0.05);
                                    border: 1px solid rgba(255, 255, 255, 0.1);
                                    border-radius: 8px;
                                    color: var(--text-primary);
                                    text-decoration: none;
                                    font-size: 0.95rem;
                                    transition: all 0.3s ease;
                                """,
                                onmouseover="this.style.background='rgba(255, 255, 255, 0.1)'; this.style.borderColor='rgba(255, 255, 255, 0.2)'",
                                onmouseout="this.style.background='rgba(255, 255, 255, 0.05)'; this.style.borderColor='rgba(255, 255, 255, 0.1)'",
                            ),
                            style='text-align: center;',
                        ),
                        cls='container',
                        style='max-width: 1600px; margin: 0 auto; padding: 3rem 2rem;',
                    ),
                    style='background: linear-gradient(180deg, rgba(255,255,255,0.01) 0%, rgba(255,255,255,0.015) 100%);',
                    id='stats-section',
                ),
            ),
            # Load carousel script
            Script(src='/static/js/carousel.js'),
            # Lightbox script already loaded in head.py
            create_footer(),
            create_lightbox(),
        ),
    )
