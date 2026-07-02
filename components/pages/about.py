"""About page component"""

from fasthtml.common import *

from components.ui.footer import create_footer
from components.ui.head import create_head
from components.ui.header import create_navbar
from services.markdown import load_markdown_page


def about_page():
    """Render the About page from markdown content"""
    # Load markdown content
    metadata, html_content = load_markdown_page('about')

    return Html(
        create_head(
            title=metadata.get('title', 'About | Joao Rodrigues'),
            description=metadata.get(
                'description', 'Data Engineer and hobbyist photographer based in Lisbon, Portugal'
            ),
            current_url=metadata.get('url', 'https://joaohfrodrigues.com/about'),
        ),
        Body(
            create_navbar(current_page='about'),
            # Content
            Main(
                Section(
                    Div(
                        H1(
                            'About Me',
                            style='font-size: 3rem; margin-bottom: 0.75rem; text-align: center; font-weight: 200; letter-spacing: 0.05em;',
                        ),
                        P(
                            'Data Engineer, photographer, and developer based in Lisbon',
                            style='text-align: center; color: var(--text-secondary); margin-bottom: 4rem; font-size: 1.15rem; max-width: 600px; margin-left: auto; margin-right: auto; line-height: 1.6;',
                        ),
                        Div(
                            NotStr(html_content),  # Render HTML content from markdown
                            cls='markdown-content',
                            style="""
                                font-size: 1.1rem;
                                line-height: 1.8;
                                color: var(--text-secondary);
                            """,
                        ),
                        cls='container',
                        style='max-width: 800px; margin: 0 auto; padding: 8rem 2rem 4rem;',
                    ),
                    style='min-height: 50vh;',
                ),
            ),
            # Use shared footer component
            create_footer(),
        ),
    )
