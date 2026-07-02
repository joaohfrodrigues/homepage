"""Collection detail page component"""

from fasthtml.common import *

from backend.db_service import get_collection_by_slug, search_photos
from components.ui.footer import create_footer
from components.ui.head import create_head
from components.ui.header import create_navbar
from components.ui.lightbox import create_lightbox
from components.ui.photo_card import create_photo_container


def collection_detail_page(collection_slug: str, page: int = 1, search_query: str = ''):
    """Render a collection detail page with search and pagination support

    Args:
        collection_slug: Collection slug to display (e.g., '25-valencia')
        page: Page number (1-indexed)
        search_query: Optional search query to filter photos in collection
    """
    # Get collection info by slug
    collection = get_collection_by_slug(collection_slug)

    if not collection:
        # Collection not found
        return Html(
            create_head(title='Collection Not Found'),
            Body(
                create_navbar(current_page='collections'),
                Main(
                    Section(
                        Div(
                            H1('Collection Not Found', style='text-align: center;'),
                            P(
                                'The requested collection could not be found.',
                                style='text-align: center; color: var(--text-tertiary);',
                            ),
                            A(
                                NotStr(
                                    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><polyline points="15 18 9 12 15 6"></polyline></svg>'
                                ),
                                'Back to Collections',
                                href='/collections',
                                style="""
                                    display: inline-flex;
                                    align-items: center;
                                    gap: 0.5rem;
                                    margin-top: 2rem;
                                    padding: 0.75rem 1.5rem;
                                    color: var(--text-primary);
                                    text-decoration: none;
                                    background: var(--bg-secondary);
                                    border-radius: 8px;
                                    transition: all 0.3s ease;
                                """,
                                onmouseover="this.style.background='var(--bg-tertiary)'; this.style.transform='translateX(-4px)';",
                                onmouseout="this.style.background='var(--bg-secondary)'; this.style.transform='translateX(0)';",
                            ),
                            style='padding: 8rem 2rem 4rem;',
                        )
                    )
                ),
                create_footer(),
            ),
        )

    # Fetch photos for this collection with search support
    # Sort by popularity (same default as homepage)
    photos, has_more = search_photos(
        query=search_query,
        page=page,
        per_page=30,
        order_by='popular',
        collection_id=collection['id'],
    )

    # Get first photo for og:image
    og_image = photos[0].get('url_regular', photos[0].get('url')) if photos else None

    # Breadcrumb schema for SEO
    breadcrumb_schema = f"""
    {{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {{
                "@type": "ListItem",
                "position": 1,
                "name": "Home",
                "item": "https://joaohfrodrigues.com/"
            }},
            {{
                "@type": "ListItem",
                "position": 2,
                "name": "Collections",
                "item": "https://joaohfrodrigues.com/collections"
            }},
            {{
                "@type": "ListItem",
                "position": 3,
                "name": "{collection['title']}",
                "item": "https://joaohfrodrigues.com/collection/{collection['slug']}"
            }}
        ]
    }}
    """

    return Html(
        create_head(
            title=f'{collection["title"]} | Joao Rodrigues',
            description=collection['description']
            or f'Browse {collection["total_photos"]} photos from {collection["title"]}',
            current_url=f'https://joaohfrodrigues.com/collection/{collection["slug"]}',
            og_image=og_image,
            structured_data_override=breadcrumb_schema,
        ),
        Body(
            create_navbar(current_page='collections'),
            # Collection header
            Section(
                Div(
                    A(
                        NotStr(
                            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><polyline points="15 18 9 12 15 6"></polyline></svg>'
                        ),
                        'All Collections',
                        href='/collections',
                        style="""
                            color: var(--text-tertiary);
                            text-decoration: none;
                            font-size: 0.95rem;
                            display: inline-flex;
                            align-items: center;
                            gap: 0.5rem;
                            margin-bottom: 1.5rem;
                            padding: 0.5rem 1rem;
                            border-radius: 8px;
                            transition: all 0.3s ease;
                            background: var(--bg-secondary);
                        """,
                        onmouseover="this.style.color='var(--text-primary)'; this.style.background='var(--bg-tertiary)'; this.style.transform='translateX(-4px)';",
                        onmouseout="this.style.color='var(--text-tertiary)'; this.style.background='var(--bg-secondary)'; this.style.transform='translateX(0)';",
                    ),
                    H1(
                        collection['title'],
                        style='font-size: 2.5rem; margin-bottom: 0.5rem; font-weight: 200; letter-spacing: 0.05em;',
                    ),
                    P(
                        f'{collection["total_photos"]} photos',
                        style='color: var(--text-tertiary); font-size: 1.1rem; margin-bottom: 1rem;',
                    ),
                    P(
                        collection['description'],
                        style='color: var(--text-secondary); font-size: 1rem; line-height: 1.6; max-width: 800px;',
                    )
                    if collection['description']
                    else None,
                    cls='container',
                    style='max-width: 1400px; margin: 0 auto; padding: 8rem 2rem 2rem 2rem;',
                )
            ),
            # Gallery
            Main(
                Section(
                    Div(
                        create_photo_container(
                            photos,
                            show_count=False,
                        ),
                        # Load more link (for pagination)
                        Div(
                            A(
                                'Load More Photos →',
                                href=f'/collection/{collection_slug}?page={page + 1}'
                                + (f'&q={search_query}' if search_query else ''),
                                style="""
                                    display: inline-block;
                                    padding: 1rem 2.5rem;
                                    background: rgba(255, 255, 255, 0.05);
                                    border: 1px solid rgba(255, 255, 255, 0.15);
                                    border-radius: 8px;
                                    color: var(--text-primary);
                                    text-decoration: none;
                                    font-size: 1rem;
                                    text-align: center;
                                    transition: all 0.3s ease;
                                    width: fit-content;
                                """,
                                onmouseover="this.style.background='rgba(255, 255, 255, 0.1)'; this.style.borderColor='rgba(255, 255, 255, 0.25)'",
                                onmouseout="this.style.background='rgba(255, 255, 255, 0.05)'; this.style.borderColor='rgba(255, 255, 255, 0.15)'",
                            ),
                            id='load-more-container',
                            # Keep sentinel in normal flow after the grid to avoid early triggers
                            style='width: 100%; margin-top: 32px; text-align: center;'
                            if has_more
                            else 'display: none;',
                        ),
                        cls='gallery',
                        id='gallery',
                    ),
                    cls='container',
                    style='max-width: 1400px; margin: 0 auto; padding: 1rem 2rem 4rem 2rem;',
                ),
            ),
            create_footer(),
            create_lightbox(),
            # AJAX search handler (shared) and infinite scroll for this gallery
            Script(src='/static/js/search-handler.js'),
            Script(src='/static/js/infinite-scroll.js'),
        ),
    )
