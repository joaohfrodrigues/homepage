"""Blog page component"""

from fasthtml.common import *

from components.ui.footer import create_footer
from components.ui.head import create_head
from components.ui.header import create_navbar
from services.markdown import get_all_blog_articles, get_series_articles, load_blog_article


def blog_list_page():
    """Render the blog listing page with all articles"""
    articles = get_all_blog_articles(include_drafts=False)

    # Group by series
    series_map: dict[str, list[dict]] = {}
    standalone_articles: list[dict] = []
    for article in articles:
        if article.get('series'):
            series_map.setdefault(article['series'], []).append(article)
        else:
            standalone_articles.append(article)

    # Build series cards
    series_cards = []
    for series_name, items in series_map.items():
        # Order by part number if provided
        items_sorted = sorted(items, key=lambda x: int(x.get('part', 999)))
        total_parts = max(
            (int(i.get('part', 0)) for i in items_sorted if i.get('part')),
            default=len(items_sorted),
        )
        desc = items_sorted[0].get('description', '')

        part_links = []
        for it in items_sorted:
            part_num = it.get('part')
            part_label = f'Part {part_num}' if part_num else 'Part'
            part_links.append(
                A(
                    part_label,
                    href=f"/blog/{it['slug']}",
                    style="""
                        padding: 0.35rem 0.75rem;
                        border-radius: 6px;
                        text-decoration: none;
                        border: 1px solid var(--border-color);
                        color: var(--text-secondary);
                        transition: all 0.2s ease;
                    """,
                    onmouseover='this.style.borderColor="var(--text-primary)"; this.style.color="var(--text-primary)";',
                    onmouseout='this.style.borderColor="var(--border-color)"; this.style.color="var(--text-secondary)";',
                )
            )

        series_cards.append(
            Div(
                Div(
                    Div(
                        P(
                            f'{len(items_sorted)} article(s) • {total_parts} part series',
                            style='margin: 0; color: var(--text-tertiary); font-size: 0.9rem;',
                        ),
                        H2(
                            f'📚 {series_name}',
                            style='margin: 0.35rem 0 0.5rem 0; font-size: 1.6rem; color: var(--text-primary);',
                        ),
                        P(
                            desc,
                            style='margin: 0 0 1rem 0; color: var(--text-secondary); line-height: 1.6;',
                        ),
                    ),
                    Div(
                        *part_links,
                        style='display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;',
                    ),
                    style='display: grid; gap: 1rem;',
                ),
                style='border: 1px solid var(--border-color); border-radius: 12px; padding: 1.5rem; background: var(--card-bg); box-shadow: 0 8px 20px rgba(0,0,0,0.03);',
            )
        )

    # Standalone articles list
    article_items = []
    for article in standalone_articles:
        article_items.append(
            A(
                Div(
                    H3(
                        article['title'],
                        style='margin: 0 0 0.5rem 0; font-size: 1.4rem;',
                    ),
                    P(
                        article['description'],
                        style='margin: 0.5rem 0; color: var(--text-secondary); line-height: 1.6;',
                    ),
                    Div(
                        article['date'],
                        style='margin-top: 1rem; font-size: 0.85rem; color: var(--text-tertiary);',
                    ),
                    cls='blog-card-content',
                    style='padding: 2rem;',
                ),
                href=f'/blog/{article["slug"]}',
                style='text-decoration: none; color: inherit; display: block; border: 1px solid var(--border-color); border-radius: 8px; transition: all 0.3s ease; background: var(--card-bg);',
                onmouseover='this.style.borderColor="var(--text-primary)"; this.style.boxShadow="0 4px 12px rgba(0,0,0,0.1)";',
                onmouseout='this.style.borderColor="var(--border-color)"; this.style.boxShadow="none";',
            )
        )

    return Html(
        create_head(
            title='Blog | Joao Rodrigues',
            description='Articles about technology, photography, and home servers',
            current_url='https://joaohfrodrigues.com/blog',
        ),
        Body(
            create_navbar(current_page='blog'),
            # Content
            Main(
                Section(
                    Div(
                        H1(
                            'Blog',
                            style='font-size: 3rem; margin-bottom: 0.75rem; text-align: center; font-weight: 200; letter-spacing: 0.05em;',
                        ),
                        P(
                            'Articles about technology, photography, and more',
                            style='text-align: center; color: var(--text-secondary); margin-bottom: 4rem; font-size: 1.15rem; max-width: 600px; margin-left: auto; margin-right: auto; line-height: 1.6;',
                        ),
                        Div(
                            H2(
                                'Series',
                                style='font-size: 1.6rem; margin: 2.5rem 0 1rem 0; color: var(--text-primary); text-align: left;',
                            ),
                            Div(
                                *series_cards
                                if series_cards
                                else [
                                    P(
                                        'No series articles yet.',
                                        style='color: var(--text-secondary);',
                                    )
                                ],
                                cls='blog-grid',
                                style='display: grid; grid-template-columns: 1fr; gap: 1.5rem; max-width: 900px;',
                            ),
                        ),
                        Div(
                            H2(
                                'Standalone Articles',
                                style='font-size: 1.6rem; margin: 2.5rem 0 1rem 0; color: var(--text-primary); text-align: left;',
                            ),
                            Div(
                                *article_items
                                if article_items
                                else [
                                    P(
                                        'No standalone articles yet.',
                                        style='color: var(--text-secondary);',
                                    )
                                ],
                                style='display: grid; grid-template-columns: 1fr; gap: 1.25rem;',
                            ),
                            style='width: 100%; max-width: 900px;',
                        ),
                        cls='container',
                        style='max-width: 960px; margin: 0 auto; padding: 8rem 2rem 4rem;',
                    ),
                    style='min-height: 50vh;',
                ),
            ),
            # Use shared footer component
            create_footer(),
            Script(
                NotStr(
                    f"""
                    (function() {{
                        if(window.devMode && window.logDevEvent) {{
                            window.logDevEvent('Blog', 'Loaded {len(series_map)} series, {len(standalone_articles)} standalone, {len(articles)} total articles');
                        }}
                    }})();
                    """
                )
            ),
        ),
    )


def blog_page(article_slug: str = 'home-server-part-1-foundation'):
    """Render a blog article from markdown content"""
    # Load markdown content
    metadata, html_content = load_blog_article(article_slug)
    responsive_styles = Style(
        """
        @media (max-width: 900px) {
            .blog-article-container { padding: 6rem 1.5rem 3rem; }
            .markdown-content { font-size: 1rem; line-height: 1.7; }
        }
        @media (max-width: 640px) {
            .blog-article-container { padding: 5rem 1.25rem 2.5rem; }
            .markdown-content { font-size: 0.98rem; line-height: 1.65; }
        }
        @media (max-width: 480px) {
            .markdown-content { font-size: 0.95rem; line-height: 1.6; }
        }
        """
    )

    # Get series navigation if this is part of a series
    series_nav = None
    if metadata.get('series'):
        series_articles = get_series_articles(metadata['series'], include_drafts=False)
        current_part = int(metadata.get('part', 0))

        # Build series navigation
        nav_items = []
        for article in series_articles:
            part_num = int(article.get('part', 0))
            is_current = part_num == current_part
            nav_items.append(
                A(
                    f'Part {part_num}',
                    href=f'/blog/{article["slug"]}',
                    style=f"""
                        padding: 0.5rem 1rem;
                        border-radius: 6px;
                        text-decoration: none;
                        transition: all 0.3s;
                        {'background: var(--accent-color); color: var(--text-primary);' if is_current else 'color: var(--text-secondary); border: 1px solid var(--border-color);'}
                    """,
                )
            )

        series_nav = Div(
            H3(f'📚 {metadata["series"]}', style='margin: 0 0 1rem 0; color: var(--text-primary);'),
            Div(*nav_items, style='display: flex; gap: 0.5rem; flex-wrap: wrap;'),
            style='background: var(--card-bg); padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem; border: 1px solid var(--border-color);',
        )

    return Html(
        create_head(
            title=metadata.get('title', 'Blog | Joao Rodrigues'),
            description=metadata.get(
                'description', 'Articles about technology, photography, and home servers'
            ),
            current_url=metadata.get('url', 'https://joaohfrodrigues.com/blog'),
        ),
        Body(
            create_navbar(current_page='blog'),
            responsive_styles,
            # Content
            Main(
                Section(
                    Div(
                        A(
                            '← Back to Blog',
                            href='/blog',
                            style='color: var(--text-secondary); text-decoration: none; margin-bottom: 2rem; display: inline-block; transition: opacity 0.3s;',
                            onmouseover='this.style.opacity="0.7";',
                            onmouseout='this.style.opacity="1";',
                        ),
                        H1(
                            metadata.get('title', 'Blog Article'),
                            style='font-size: 2.5rem; margin-bottom: 1rem; text-align: center;',
                        ),
                        Div(
                            metadata.get('date', ''),
                            style='text-align: center; color: var(--text-secondary); margin-bottom: 2.5rem; font-size: 0.95rem;',
                        ),
                        series_nav if series_nav else '',
                        Div(
                            NotStr(html_content),  # Render HTML content from markdown
                            cls='markdown-content',
                            style="""
                                font-size: 1.1rem;
                                line-height: 1.8;
                                color: var(--text-secondary);
                            """,
                        ),
                        cls='container blog-article-container',
                        style='max-width: 900px; margin: 0 auto; padding: 8rem 2rem 4rem;',
                        id='blog-article-container',
                    ),
                    style='min-height: 50vh;',
                ),
            ),
            Script(
                NotStr(
                    f"""
                    (function() {{
                        if(window.devMode && window.logDevEvent) {{
                            const title = {repr(metadata.get('title', 'Unknown'))};
                            const series = {repr(metadata.get('series', None))};
                            const part = {repr(metadata.get('part', None))};
                            const msg = series && part ? `${{title}} (Part ${{part}} of ${{series}})` : title;
                            window.logDevEvent('Blog', `Article loaded: ${{msg}}`);
                        }}
                    }})();
                    """
                )
            ),
            # Use shared footer component
            create_footer(),
        ),
    )
