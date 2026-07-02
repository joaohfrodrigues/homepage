"""Footer component with Vercel Web Analytics"""

from fasthtml.common import *

from components.ui.analytics import create_analytics


def create_footer():
    """Create the footer section with Vercel Web Analytics"""
    return Footer(
        Div(
            P('© 2025 Joao Rodrigues. All rights reserved.'),
            P(
                A(
                    'Instagram',
                    href='https://instagram.com/__joaor__',
                    target='_blank',
                    rel='noopener noreferrer',
                ),
                Span(' • ', style='margin: 0 0.5rem;'),
                A(
                    'Unsplash',
                    href='https://unsplash.com/@joaohfrodrigues',
                    target='_blank',
                    rel='noopener noreferrer',
                ),
                Span(' • ', style='margin: 0 0.5rem;'),
                A(
                    'LinkedIn',
                    href='https://www.linkedin.com/in/joaohfrodrigues/',
                    target='_blank',
                    rel='noopener noreferrer',
                ),
            ),
            cls='footer-content',
        ),
        # Loading overlay for async operations
        Div(
            Div(cls='loading-spinner'),
            Span('Loading...', cls='sr-only'),
            cls='loading-overlay',
            id='loading-overlay',
        ),
        # Back to top button
        Button(
            '↑',
            id='back-to-top',
            cls='back-to-top',
            onclick="window.scrollTo({top:0, behavior:'smooth'});",
            style='display: none;',
        ),
        Script(
            NotStr(
                """
            (function(){
                const btn = document.getElementById('back-to-top');
                if(!btn) return;
                const toggle = () => {
                    if (window.scrollY > 240) { btn.style.display = 'flex'; }
                    else { btn.style.display = 'none'; }
                };
                window.addEventListener('scroll', toggle, { passive: true });
                toggle();
            })();
            """
            )
        ),
        # Vercel Web Analytics
        *create_analytics(),
    )
