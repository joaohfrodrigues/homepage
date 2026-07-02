"""Header component"""

from fasthtml.common import *

NAV_LINKS = [
    ('Blog', '/blog', 'blog'),
    ('Gallery', '/gallery', 'gallery'),
    ('Collections', '/collections', 'collections'),
    ('Insights', '/insights', 'insights'),
    ('About', '/about', 'about'),
]


def _link_item(label: str, href: str, active: bool):
    active_class = 'active' if active else ''
    return Li(
        A(
            label,
            href=href,
            cls=f'navbar-link {active_class}'.strip(),
        )
    )


def create_navbar(current_page: str = 'home'):
    """Fixed nav with responsive menu; small JS keeps desktop menu open."""
    link_items = [_link_item(label, href, key == current_page) for label, href, key in NAV_LINKS]

    nav = Nav(
        Div(
            A('JOAO RODRIGUES', href='/', cls='navbar-title', style='text-decoration: none;'),
            Details(
                Summary(
                    Span('', cls='burger-line'),
                    Span('', cls='burger-line'),
                    Span('', cls='burger-line'),
                    cls='navbar-burger',
                    aria_label='Toggle navigation',
                ),
                Ul(*link_items, cls='navbar-links'),
                cls='navbar-menu',
            ),
            Div(
                Button(
                    NotStr(
                        """
                        <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' class='theme-icon sun-icon'>
                            <circle cx='12' cy='12' r='5'></circle>
                            <line x1='12' y1='1' x2='12' y2='3'></line>
                            <line x1='12' y1='21' x2='12' y2='23'></line>
                            <line x1='4.22' y1='4.22' x2='5.64' y2='5.64'></line>
                            <line x1='18.36' y1='18.36' x2='19.78' y2='19.78'></line>
                            <line x1='1' y1='12' x2='3' y2='12'></line>
                            <line x1='21' y1='12' x2='23' y2='12'></line>
                            <line x1='4.22' y1='19.78' x2='5.64' y2='18.36'></line>
                            <line x1='18.36' y1='5.64' x2='19.78' y2='4.22'></line>
                        </svg>
                        """
                    ),
                    NotStr(
                        """
                        <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' class='theme-icon moon-icon'>
                            <path d='M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z'></path>
                        </svg>
                        """
                    ),
                    id='theme-toggle',
                    cls='theme-toggle-btn',
                    onclick='toggleTheme()',
                    style='background: none; border: none; cursor: pointer; padding: 0.5rem; display: flex; align-items: center; color: var(--text-primary); transition: opacity 0.3s;',
                    title='Toggle theme',
                ),
                Button(
                    NotStr(
                        """
                        <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' class='dev-icon'>
                            <polyline points='4 17 10 11 4 5'></polyline>
                            <line x1='12' y1='19' x2='20' y2='19'></line>
                        </svg>
                        """
                    ),
                    id='dev-mode-toggle',
                    cls='dev-toggle-btn',
                    onclick='toggleDevMode()',
                    title='Toggle Developer Mode',
                    style='background: none; border: none; cursor: pointer; padding: 0; color: var(--text-primary);',
                ),
                cls='navbar-actions',
                style='display: flex; align-items: center; gap: 0.75rem;',
            ),
            cls='navbar-content',
        ),
        cls='navbar',
        id='navbar',
    )

    # Tiny helper: keep menu open on desktop, closed on mobile without extra libraries.
    script = Script(
        NotStr(
            """
            (function(){
              const menu = document.querySelector('.navbar-menu');
              if(!menu) return;
              const sync = () => {
                if (window.innerWidth > 900) {
                  menu.setAttribute('open', 'true');
                } else {
                  menu.removeAttribute('open');
                }
              };
              window.addEventListener('resize', sync, { passive: true });
              sync();
            })();
            """
        )
    )

    # Hide navbar on scroll down, show on scroll up
    hide_nav_script = Script(
        NotStr(
            """
            (function(){
              const navbar = document.getElementById('navbar');
              if(!navbar) return;
              let lastScrollTop = 0;
              let scrollTimeout;

              window.addEventListener('scroll', () => {
                const scrollTop = window.scrollY;

                if(scrollTop > lastScrollTop + 5) {
                  navbar.style.transform = 'translateY(-100%)';
                } else if(scrollTop < lastScrollTop - 5) {
                  navbar.style.transform = 'translateY(0)';
                }

                lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
              }, { passive: true });
            })();
            """
        )
    )

    return Div(nav, script, hide_nav_script)


def create_header(current_page: str = 'home'):
    """Create the hero section (no longer contains navigation)."""
    return Header(
        Div(
            H1('JOAO RODRIGUES'),
            P(
                'Photography, Data and Development',
                style='margin-bottom: 1rem; color: var(--text-tertiary); letter-spacing: 0.2rem; text-transform: uppercase;',
            ),
            cls='hero-content',
        ),
        cls='hero',
        id='hero',
    )


def create_hero():
    """Create the hero section with scroll indicator for gallery page."""
    return Div(
        create_header(current_page='home'), Div(cls='scroll-indicator'), style='position: relative;'
    )


def create_section_nav():
    """Create a minimalistic side navigation for homepage sections."""
    sections = [
        ('blog-section', 'Blog'),
        ('photos-section', 'Photos'),
        ('collections-section', 'Collections'),
        ('stats-section', 'Stats'),
    ]

    nav_items = [
        A(
            Span('', cls='section-dot'),
            href=f'#{section_id}',
            cls='section-nav-item',
            title=label,
            **{'data-section': section_id},
        )
        for section_id, label in sections
    ]

    nav = Nav(
        Ul(
            *nav_items,
            cls='section-nav-list',
        ),
        cls='section-nav',
        id='section-nav',
    )

    # JS for scroll detection and highlighting
    script = Script(
        NotStr(
            """
            (function(){
              const nav = document.getElementById('section-nav');
              if(!nav) return;

              const sectionIds = ['blog-section', 'photos-section', 'collections-section', 'stats-section'];
              const sections = {};
              let isManualScroll = false;
              let lastActiveSection = null;
              let scrollCount = 0;

              const log = (msg) => {
                if(window.devMode && window.logDevEvent) {
                  window.logDevEvent('SectionNav', msg);
                }
              };

              // Wait a bit for DOM to fully load
              setTimeout(() => {
                sectionIds.forEach(id => {
                  sections[id] = document.getElementById(id);
                  const offset = sections[id] ? sections[id].offsetTop : 'NOT FOUND';
                  console.log(`[SectionNav Init] ${id}: ${offset}`);
                });
              }, 100);

              const setActive = (sectionId) => {
                if(sectionId !== lastActiveSection) {
                  console.log(`[SectionNav] Section changed to ${sectionId}`);
                  log(`New section detected: ${sectionId}`);
                  lastActiveSection = sectionId;
                }
                nav.querySelectorAll('.section-nav-item').forEach(item => {
                  if(item.getAttribute('data-section') === sectionId) {
                    item.classList.add('active');
                  } else {
                    item.classList.remove('active');
                  }
                });
              };

              // Use scroll event with position checking
              const checkSection = () => {
                scrollCount++;
                if(isManualScroll) {
                  console.log(`[SectionNav] Scroll event ${scrollCount} - skipping (manual scroll active)`);
                  return;
                }

                const scrollPos = window.scrollY + 300;
                let currentActive = null;

                sectionIds.forEach(id => {
                  const el = sections[id];
                  if(el && el.offsetTop <= scrollPos) {
                    currentActive = id;
                  }
                });

                console.log(`[SectionNav] Scroll event ${scrollCount}: scrollY=${window.scrollY}, threshold=${scrollPos}, active=${currentActive}`);

                if(currentActive) {
                  setActive(currentActive);
                }
              };

              window.addEventListener('scroll', checkSection, { passive: true });
              console.log('[SectionNav] Scroll listener attached');

              // Click handlers for manual navigation
              nav.querySelectorAll('.section-nav-item').forEach(item => {
                item.addEventListener('click', (e) => {
                  const target = item.getAttribute('href');
                  const sectionId = item.getAttribute('data-section');
                  e.preventDefault();
                  console.log(`[SectionNav] Click on ${sectionId}`);
                  log(`Click on navbar section: ${sectionId}`);
                  setActive(sectionId);
                  isManualScroll = true;
                  setTimeout(() => {
                    document.querySelector(target)?.scrollIntoView({ behavior: 'smooth' });
                    setTimeout(() => {
                      isManualScroll = false;
                      console.log(`[SectionNav] Manual scroll complete`);
                    }, 800);
                  }, 50);
                });
              });
            })();
            """
        )
    )

    return Div(nav, script)
