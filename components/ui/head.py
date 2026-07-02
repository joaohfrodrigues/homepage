"""HTML head component with SEO meta tags"""

from fasthtml.common import *


def create_head(
    title='Joao Rodrigues | Photography',
    description=None,
    current_url='https://joaohfrodrigues.com',
    og_image=None,
    structured_data_override=None,
):
    """Create the HTML head section with SEO optimization

    Args:
        title: Page title
        description: Meta description
        current_url: Canonical URL (for canonical tag)
        og_image: Open Graph image URL for social sharing
        structured_data_override: Custom structured data (JSON-LD) to override default
    """

    if description is None:
        description = 'Professional photography portfolio by Joao Rodrigues. Explore stunning photographs from around the world, featuring landscapes, portraits, and travel photography.'

    if og_image is None:
        og_image = 'https://joaohfrodrigues.com/static/favicons/apple-touch-icon.png'

    # Structured data for SEO (JSON-LD)
    structured_data = (
        structured_data_override
        or """
    {
        "@context": "https://schema.org",
        "@type": "Person",
        "name": "Joao Rodrigues",
        "url": "https://joaohfrodrigues.com",
        "jobTitle": "Photographer",
        "description": "Data Engineer and hobbyist photographer based in Lisbon, Portugal.",
        "sameAs": [
            "https://unsplash.com/@joaohfrodrigues",
            "https://instagram.com/joaohfrodrigues",
            "https://www.linkedin.com/in/joaohfrodrigues/"
        ],
        "image": "https://joaohfrodrigues.com/static/favicons/apple-touch-icon.png"
    }
    """
    )

    return Head(
        Title(title),
        Meta(name='viewport', content='width=device-width, initial-scale=1'),
        Meta(name='description', content=description),
        Meta(
            name='keywords',
            content='photography, portfolio, Joao Rodrigues, photos, landscape, portrait, travel',
        ),
        Meta(name='author', content='Joao Rodrigues'),
        Meta(charset='utf-8'),
        # Canonical URL for SEO (prevents duplicate content issues)
        Link(rel='canonical', href=current_url),
        # CRITICAL: Theme initialization - must run before ANY CSS loads
        # Handles localStorage SecurityError gracefully (private browsing, file://, etc.)
        Script(
            NotStr("""
(function() {
    let savedTheme = null;

    // Try to access localStorage (may fail in private browsing or file://)
    try {
        savedTheme = localStorage.getItem('theme');
    } catch (e) {
        // localStorage blocked - will use OS preference or fallback
        console.warn('localStorage blocked, using OS preference');
    }

    if (savedTheme) {
        // User has explicitly chosen a theme
        document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
        // No saved preference - respect OS/browser preference
        try {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const theme = prefersDark ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', theme);
        } catch (e) {
            // Fallback to dark if media query fails
            document.documentElement.setAttribute('data-theme', 'dark');
        }
    }
})();
        """)
        ),
        # Dev mode class initialization (mirrors theme bootstrap)
        # Dev mode class initialization - must run before CSS loads
        Script(
            NotStr("""
(function() {
    try {
        const devMode = localStorage.getItem('devMode') === 'true';
        if (devMode) {
            document.documentElement.classList.add('dev-mode-active');
        }
    } catch (e) {
        // localStorage blocked
    }
})();
            """)
        ),
        # Open Graph / Social Media
        Meta(property='og:type', content='website'),
        Meta(property='og:title', content=title),
        Meta(property='og:description', content=description),
        Meta(property='og:url', content=current_url),
        Meta(property='og:site_name', content='Joao Rodrigues Photography'),
        Meta(property='og:image', content=og_image),
        # Twitter Card
        Meta(name='twitter:card', content='summary_large_image'),
        Meta(name='twitter:title', content=title),
        Meta(name='twitter:description', content=description),
        # Favicons
        Link(rel='icon', type='image/x-icon', href='/static/favicons/favicon.ico'),
        Link(
            rel='icon', type='image/png', sizes='32x32', href='/static/favicons/favicon-32x32.png'
        ),
        Link(
            rel='icon', type='image/png', sizes='16x16', href='/static/favicons/favicon-16x16.png'
        ),
        Link(rel='apple-touch-icon', sizes='180x180', href='/static/favicons/apple-touch-icon.png'),
        # Preload critical resources
        Link(rel='preload', href='/static/css/styles.css', **{'as': 'style'}),
        # DNS prefetch for external domains
        Link(rel='dns-prefetch', href='https://images.unsplash.com'),
        Link(rel='preconnect', href='https://images.unsplash.com', crossorigin='anonymous'),
        # Stylesheet
        Link(rel='stylesheet', href='/static/css/styles.css'),
        # Structured data
        Script(structured_data, type='application/ld+json'),
        # Theme toggle functions
        Script(src='/static/js/theme-toggle.js'),
        # Developer mode overlay / event bus
        Script(src='/static/js/dev-mode.js'),
        # JavaScript (deferred)
        Script(src='/static/js/sticky-header.js', defer=True),
        Script(src='/static/js/swipe.js', defer=True),
        Script(src='/static/js/lightbox.js', defer=True),
        Script(src='/static/js/animations.js', defer=True),
        Script(src='/static/js/keyboard-navigation.js', defer=True),
    )
