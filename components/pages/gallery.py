"""Gallery page component - Full photo browsing with infinite scroll"""

from fasthtml.common import *

from backend.db_service import search_photos
from components.ui.footer import create_footer
from components.ui.head import create_head
from components.ui.header import create_navbar
from components.ui.lightbox import create_lightbox
from components.ui.photo_grid import create_photo_grid


def gallery_page(
    photos=None,
    order='popular',
    search_query='',
    current_page=1,
    has_more=False,
):
    """Render the gallery page with full photo browsing and infinite scroll

    Args:
        photos: List of photos (fetched if None)
        order: Sort order - 'popular', 'latest', or 'oldest'
        search_query: Search query string
        current_page: Current page number
        has_more: Whether there are more photos to load
    """
    # Fetch photos if not provided
    if photos is None:
        photos, has_more = search_photos(
            query=search_query, page=current_page, per_page=12, order_by=order
        )

    # Get first photo for og:image
    og_image = None
    if photos:
        og_image = photos[0].get('url_regular', photos[0].get('url'))

    return Html(
        create_head(
            title='Gallery | Joao Rodrigues',
            description='Browse my complete photography collection with advanced search and filtering.',
            og_image=og_image,
        ),
        Body(
            create_navbar(current_page='gallery'),
            # Main content
            Main(
                Section(
                    Div(
                        H1(
                            'Photo Gallery',
                            style='font-size: 3rem; margin-bottom: 0.75rem; text-align: center; font-weight: 200; letter-spacing: 0.05em;',
                        ),
                        P(
                            'Browse all photos with advanced search and filtering',
                            style='text-align: center; color: var(--text-secondary); margin-bottom: 4rem; font-size: 1.15rem; max-width: 600px; margin-left: auto; margin-right: auto; line-height: 1.6;',
                        ),
                        # Photo grid with search
                        create_photo_grid(
                            photos,
                            show_search=True,
                            current_order=order,
                            search_query=search_query,
                        ),
                        # Load-more container for infinite scroll
                        Div(
                            A(
                                href=f'/gallery?order={order}&page={current_page + 1}'
                                + (f'&q={search_query}' if search_query else ''),
                            ),
                            id='load-more-container',
                            style='width: 100%; height: 1px; margin-top: 32px; opacity: 0; pointer-events: none;'
                            if has_more
                            else 'display: none;',
                        )
                        if has_more
                        else Div(id='load-more-container', style='display: none;'),
                        cls='container',
                        style='max-width: 1800px; margin: 0 auto; padding: 8rem 2rem 4rem;',
                    ),
                ),
            ),
            # Load carousel script
            Script(src='/static/js/carousel.js'),
            # AJAX search handler for in-place updates
            Script(src='/static/js/search-handler.js'),
            # Infinite scroll for loading next pages without reload
            Script(src='/static/js/infinite-scroll.js'),
            create_footer(),
            create_lightbox(),
        ),
    )
