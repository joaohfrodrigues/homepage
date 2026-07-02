"""Collections page component"""

from datetime import datetime

from fasthtml.common import *

from backend.db_service import get_all_collections, get_collection_stats
from components.ui.badges import get_collection_badges, render_badges
from components.ui.footer import create_footer
from components.ui.head import create_head
from components.ui.header import create_navbar


def create_collection_card(collection, badges=None):
    """Create a card for a single collection

    Args:
        collection: Collection data dict
        badges: Optional list of badge dicts from get_collection_badges()
    """
    # Format the published date if available
    published_date = ''
    if collection.get('published_at'):
        try:
            date_obj = datetime.fromisoformat(collection['published_at'].replace('Z', '+00:00'))
            published_date = date_obj.strftime('%B %Y')
        except (ValueError, AttributeError):
            published_date = ''

    return A(
        # Cover photo with overlay gradient
        Div(
            Img(
                src=collection['cover_photo']['url'],
                alt=collection['title'],
                loading='lazy',
                cls='collection-cover-image',
                style="""
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
                """,
            ),
            # Gradient overlay for better text readability
            Div(
                style="""
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%);
                    opacity: 0;
                    transition: opacity 0.4s ease;
                """,
                cls='overlay-gradient',
            ),
            cls='collection-cover',
            style="""
                aspect-ratio: 3/2;
                overflow: hidden;
                border-radius: 12px;
                background: #1a1a1a;
                position: relative;
            """,
        ),
        # Collection info
        Div(
            # Title and photo count
            Div(
                H3(
                    collection['title'],
                    style='font-size: 1.6rem; margin-bottom: 0.4rem; color: var(--text-primary); font-weight: 300; transition: color 0.3s ease;',
                ),
                Div(
                    Span(
                        f'{collection["total_photos"]} photos',
                        style='color: var(--text-tertiary); font-size: 0.9rem;',
                    ),
                    Span(' • ', style='color: var(--text-muted); padding: 0 0.5rem;')
                    if published_date
                    else None,
                    Span(published_date, style='color: var(--text-tertiary); font-size: 0.9rem;')
                    if published_date
                    else None,
                    style='display: flex; align-items: center; margin-bottom: 0.75rem;',
                ),
            ),
            # Description
            P(
                collection['description'][:120] + '...'
                if len(collection['description']) > 120
                else collection['description'],
                style='color: var(--text-secondary); font-size: 0.9rem; line-height: 1.6; transition: color 0.3s ease;',
            )
            if collection['description']
            else None,
            # Badges
            *render_badges(badges) if badges else [],
            cls='collection-info',
            style='padding: 1.75rem;',
        ),
        href=f'/collection/{collection["slug"]}',
        cls='collection-grid-card',
        style="""
            display: block;
            background: rgba(255, 255, 255, 0.03);
            border-radius: 12px;
            text-decoration: none;
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            overflow: hidden;
            opacity: 0;
            animation: fadeInUp 0.6s ease-out forwards;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
            border: 1px solid rgba(255, 255, 255, 0.05);
        """,
        onmouseover="this.style.background='rgba(255, 255, 255, 0.06)'; this.style.transform='translateY(-8px)'; this.style.boxShadow='0 12px 40px rgba(0,0,0,0.4)'; this.querySelector('.collection-cover-image').style.transform='scale(1.05)'; this.querySelector('.overlay-gradient').style.opacity='1'; this.style.borderColor='rgba(255, 255, 255, 0.1)';",
        onmouseout="this.style.background='rgba(255, 255, 255, 0.03)'; this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 20px rgba(0,0,0,0.2)'; this.querySelector('.collection-cover-image').style.transform='scale(1)'; this.querySelector('.overlay-gradient').style.opacity='0'; this.style.borderColor='rgba(255, 255, 255, 0.05)';",
    )


def collections_page(collections=None):
    """Render the all collections page"""
    if collections is None:
        collections = get_all_collections()

    # Get collection statistics for badges
    collection_stats = get_collection_stats()

    # Calculate badges for each collection
    for collection in collections:
        collection['badges'] = get_collection_badges(collection, collection_stats, collections)

    # Get first collection cover for og:image
    og_image = collections[0]['cover_photo']['url'] if collections else None

    return Html(
        create_head(
            title='Collections | Joao Rodrigues',
            description='Browse my photography collections from travels and adventures around the world.',
            current_url='https://joaohfrodrigues.com/collections',
            og_image=og_image,
        ),
        Body(
            create_navbar(current_page='collections'),
            Main(
                Section(
                    Div(
                        H1(
                            'All Collections',
                            style='font-size: 3rem; margin-bottom: 0.75rem; text-align: center; font-weight: 200; letter-spacing: 0.05em;',
                        ),
                        P(
                            f'Explore {len(collections)} curated photography collections from my travels and adventures',
                            style='text-align: center; color: var(--text-secondary); margin-bottom: 4rem; font-size: 1.15rem; max-width: 600px; margin-left: auto; margin-right: auto; line-height: 1.6;',
                        ),
                        # Collections grid
                        Div(
                            *[create_collection_card(c, c.get('badges')) for c in collections],
                            cls='collections-page-grid',
                            style="""
                                display: grid;
                                grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
                                gap: 2.5rem;
                            """,
                        )
                        if collections
                        else Div(
                            P(
                                'No collections found.',
                                style='text-align: center; color: var(--text-muted); font-size: 1.1rem;',
                            )
                        ),
                        cls='container',
                        style='max-width: 1400px; margin: 0 auto; padding: 8rem 2rem 4rem;',
                    ),
                ),
            ),
            create_footer(),
        ),
    )
