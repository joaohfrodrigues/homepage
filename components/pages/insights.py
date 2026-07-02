import json

from fasthtml.common import *

from components.ui.footer import create_footer
from components.ui.head import create_head
from components.ui.header import create_navbar
from services.insights import build_country_metrics, get_dataset_stats


def create_stat_card(label: str, value: str, unit: str = '', description: str = '') -> Div:
    """Create a stat card component"""
    return Div(
        Div(
            P(label, cls='stat-label'),
            P(
                Span(value, cls='stat-value'),
                Span(unit, cls='stat-unit') if unit else '',
                cls='stat-content',
            ),
            P(description, cls='stat-description') if description else '',
            cls='stat-card-inner',
        ),
        cls='stat-card',
        style="""
            padding: 1.5rem;
            text-align: center;
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            background: rgba(255, 255, 255, 0.02);
            transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
        """,
    )


def insights_page(theme: str = 'dark'):
    """Render the insights page"""
    stats = get_dataset_stats()
    country_metrics = build_country_metrics(stats)
    tags_payload = [
        {'name': tag, 'value': count} for tag, count in (stats.get('top_tags') or {}).items()
    ]

    return Html(
        create_head(
            title='Dataset Insights | Joao Rodrigues',
            description='Explore analytics from my photography collections: locations, engagement, and top tags.',
            current_url='https://joaohfrodrigues.com/insights',
        ),
        Body(
            create_navbar(current_page='insights'),
            Script(src='https://fastly.jsdelivr.net/npm/echarts@5/dist/echarts.min.js'),
            Script(
                src='https://fastly.jsdelivr.net/npm/echarts-wordcloud@2/dist/echarts-wordcloud.min.js'
            ),
            Style(
                """
                .stat-card { position: relative; overflow: hidden; }
                .stat-card:hover { transform: translateY(-4px); border-color: rgba(255, 255, 255, 0.15); box-shadow: 0 10px 30px rgba(0,0,0,0.25); }
                .stat-card-inner { display: flex; flex-direction: column; gap: 0.6rem; }
                .stat-label { color: var(--text-secondary); font-size: 0.9rem; letter-spacing: 0.08em; text-transform: uppercase; margin: 0; }
                .stat-content { margin: 0; font-size: 2.2rem; font-weight: 200; display: flex; justify-content: center; align-items: baseline; gap: 0.35rem; }
                .stat-value { color: var(--text-primary); font-family: "Merriweather", serif; }
                .stat-unit { color: var(--text-secondary); font-size: 1rem; }
                .stat-description { margin: 0; color: var(--text-tertiary); font-size: 0.9rem; }

                .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem; }
                .chart-container { width: 100%; height: 500px; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 0; overflow: hidden !important; position: relative; z-index: 10; touch-action: none; }
                .chart-container > div { position: absolute; inset: 0; }
                [data-theme='light'] .chart-container { background: #ffffff; }
                [data-theme='dark'] .chart-container { background: #1a1a1a; }
                .visualizations-grid { display: grid; grid-template-columns: 1.8fr 1fr; gap: 1.5rem; }
                .metric-btn { border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.04); color: var(--text-primary); padding: 0.5rem 1rem; margin: 0 0.35rem; border-radius: 999px; cursor: pointer; transition: all 0.2s ease; font-size: 0.95rem; }
                .metric-btn:hover { border-color: rgba(255,255,255,0.2); transform: translateY(-1px); }
                .metric-btn-active { background: var(--accent-color); border-color: var(--accent-color); color: #0b1021; }

                .chart-empty { min-height: 240px; display: grid; place-items: center; color: var(--text-secondary); font-size: 1rem; border: 1px dashed rgba(255,255,255,0.12); border-radius: 12px; padding: 1.25rem; }

                @media (max-width: 1024px) {
                    .visualizations-grid { grid-template-columns: 1fr; }
                }

                @media (max-width: 768px) {
                    .stat-content { font-size: 1.9rem; }
                    .chart-container { min-height: 360px; }
                    .visualizations-grid { grid-template-columns: 1fr; }
                }
                """
            ),
            Main(
                Section(
                    Div(
                        H1(
                            'Dataset Insights',
                            style='font-size: 3rem; margin-bottom: 0.75rem; text-align: center; font-weight: 200; letter-spacing: 0.05em;',
                        ),
                        P(
                            'Explore statistics and trends from my photography collection',
                            style='text-align: center; color: var(--text-secondary); margin-bottom: 4rem; font-size: 1.15rem; max-width: 600px; margin-left: auto; margin-right: auto; line-height: 1.6;',
                        ),
                        cls='container',
                        style='max-width: 1200px; margin: 0 auto; padding: 8rem 2rem 4rem;',
                    ),
                ),
                Section(
                    Div(
                        create_stat_card(
                            'Total Photos',
                            f"{stats['total_photos']:,.0f}",
                            description='Across all shoots',
                        ),
                        create_stat_card(
                            'Collections',
                            f"{stats['total_collections']:,.0f}",
                            description='Organized photo series',
                        ),
                        create_stat_card(
                            'Locations',
                            f"{stats.get('total_locations', len(stats.get('top_locations', {}))):,.0f}",
                            description='Unique places captured',
                        ),
                        create_stat_card(
                            'Total Views',
                            f"{stats['total_views']:,.0f}",
                            description='Community engagement',
                        ),
                        cls='stats-grid',
                    ),
                    cls='container',
                    style='max-width: 1200px; margin: 0 auto; padding: 2rem;',
                ),
                Section(
                    Div(
                        H2(
                            'Visualizations',
                            style='font-size: 2rem; margin-bottom: 1.75rem; text-align: center; color: var(--text-primary);',
                        ),
                        Div(
                            Button(
                                'Total Photos',
                                id='metric-btn-photos',
                                cls='metric-btn metric-btn-active',
                                data_metric='photos',
                            ),
                            Button(
                                'Total Views',
                                id='metric-btn-views',
                                cls='metric-btn',
                                data_metric='views',
                            ),
                            Button(
                                'Total Downloads',
                                id='metric-btn-downloads',
                                cls='metric-btn',
                                data_metric='downloads',
                            ),
                            style='margin-bottom: 2rem; text-align: center;',
                        ),
                        Div(
                            Div(
                                Div(
                                    H3(
                                        'By Country',
                                        style='margin: 0 0 0.5rem 0; font-size: 1.1rem; font-weight: 500; color: var(--text-primary);',
                                    ),
                                    Div(id='locations-chart', cls='chart-container'),
                                    style='display: flex; flex-direction: column;',
                                ),
                                Div(
                                    H3(
                                        'Top Tags',
                                        style='margin: 0 0 0.5rem 0; font-size: 1.1rem; font-weight: 500; color: var(--text-primary);',
                                    ),
                                    Div(id='tags-chart', cls='chart-container'),
                                    style='display: flex; flex-direction: column;',
                                ),
                                cls='visualizations-grid',
                            ),
                            cls='container',
                            style='max-width: 1400px; margin: 0 auto; padding: 0;',
                        ),
                        cls='container',
                        style='max-width: 1400px; margin: 0 auto; padding: 3rem 2rem;',
                    ),
                    style='min-height: auto; padding-bottom: 2rem;',
                ),
            ),
            create_footer(),
            Script(
                NotStr(
                    f"""
                    (function() {{
                        const locationData = {json.dumps(country_metrics)};
                        const tagsData = {json.dumps(tags_payload)};
                        const worldGeoUrl = 'https://raw.githubusercontent.com/apache/echarts-examples/master/public/data/asset/geo/world.json';

                        const mapEl = document.getElementById('locations-chart');
                        const tagsEl = document.getElementById('tags-chart');

                        let mapChart = null;
                        let tagsChart = null;
                        let currentMetric = 'photos';

                        function getThemeColors() {{
                            const styles = getComputedStyle(document.documentElement);
                            const text = styles.getPropertyValue('--text-primary').trim() || '#ffffff';
                            const secondary = styles.getPropertyValue('--text-secondary').trim() || '#cccccc';
                            const accent = styles.getPropertyValue('--accent-color').trim() || '#4f8bff';
                            return {{ text, secondary, accent }};
                        }}

                        async function ensureWorldRegistered() {{
                            if (echarts.getMap('world')) return true;
                            try {{
                                const res = await fetch(worldGeoUrl, {{ cache: 'force-cache' }});
                                if (!res.ok) throw new Error(`Geo fetch failed: ${{res.status}}`);
                                const geoJson = await res.json();
                                echarts.registerMap('world', geoJson);
                                return true;
                            }} catch (err) {{
                                console.error('Failed to load world geo data', err);
                                if (mapEl) mapEl.innerHTML = '<div class="chart-empty">Unable to load world map data</div>';
                                return false;
                            }}
                        }}

                        function renderMap() {{
                            if (!mapEl || !window.echarts) return;

                            if (!mapChart) {{
                                mapEl.innerHTML = '';
                                mapChart = echarts.init(mapEl, null, {{ renderer: 'canvas' }});
                                if (mapChart.getZr && mapChart.getZr().dom) {{
                                    const zrDom = mapChart.getZr().dom;
                                    zrDom.style.touchAction = 'none';
                                    zrDom.style.pointerEvents = 'auto';
                                }}
                            }}

                            const colors = getThemeColors();
                            const metricKey = currentMetric;
                            const seriesData = (locationData || []).map(item => ({{
                                name: item.name,
                                value: item[metricKey] || 0,
                                code: item.code,
                                views: item.views,
                                downloads: item.downloads,
                                photos: item.photos,
                            }}));

                            if (!seriesData.length) {{
                                if (mapChart) {{
                                    mapChart.dispose();
                                    mapChart = null;
                                }}
                                mapEl.innerHTML = '<div class="chart-empty">No location data available</div>';
                                return;
                            }}

                            const maxValue = Math.max(...seriesData.map(d => d.value || 0), 1);

                            mapChart.setOption({{
                                backgroundColor: 'rgba(0,0,0,0)',
                                tooltip: {{
                                    trigger: 'item',
                                    formatter: function(params) {{
                                        const d = params.data || {{}};
                                        const val = d.value || 0;
                                        const photos = d.photos ?? 0;
                                        const views = d.views ?? 0;
                                        const downloads = d.downloads ?? 0;
                                        return (
                                            params.name + '<br/>' +
                                            currentMetric.charAt(0).toUpperCase() + currentMetric.slice(1) + ': ' + val.toLocaleString() + '<br/>' +
                                            'Photos: ' + (photos.toLocaleString ? photos.toLocaleString() : photos) + '<br/>' +
                                            'Views: ' + (views.toLocaleString ? views.toLocaleString() : views) + '<br/>' +
                                            'Downloads: ' + (downloads.toLocaleString ? downloads.toLocaleString() : downloads)
                                        );
                                    }},
                                    backgroundColor: 'rgba(0,0,0,0.75)',
                                    borderWidth: 0,
                                    textStyle: {{ color: '#fff' }},
                                }},
                                visualMap: {{
                                    min: 0,
                                    max: maxValue,
                                    left: 'left',
                                    top: 'bottom',
                                    text: ['High', 'Low'],
                                    textStyle: {{ color: colors.text }},
                                    inRange: {{ color: ['#cfe5ff', colors.accent] }},
                                    calculable: true,
                                }},
                                geo: {{
                                    map: 'world',
                                    roam: true,
                                    itemStyle: {{
                                        areaColor: 'rgba(255,255,255,0.04)',
                                        borderColor: colors.secondary || '#888',
                                    }},
                                    emphasis: {{ itemStyle: {{ areaColor: 'rgba(79,139,255,0.4)' }} }},
                                }},
                                series: [
                                    {{
                                        type: 'map',
                                        map: 'world',
                                        roam: true,
                                        data: seriesData,
                                        emphasis: {{ label: {{ show: false }} }},
                                    }}
                                ],
                            }}, true);

                            mapChart.resize();
                        }}

                        function renderTags() {{
                            if (!tagsEl || !window.echarts) return;
                            if (!tagsData || !tagsData.length) {{
                                if (tagsChart) {{
                                    tagsChart.dispose();
                                    tagsChart = null;
                                }}
                                tagsEl.innerHTML = '<div class="chart-empty">No tag data available</div>';
                                return;
                            }}

                            const colors = getThemeColors();
                            tagsEl.innerHTML = '';
                            if (!tagsChart) tagsChart = echarts.init(tagsEl, null, {{ renderer: 'canvas' }});

                            tagsChart.clear();
                            tagsChart.setOption({{
                                backgroundColor: 'rgba(0,0,0,0)',
                                tooltip: {{
                                    show: true,
                                    formatter: function(params) {{
                                        return `${{params.name}}: ${{params.value}}`;
                                    }},
                                }},
                                series: [
                                    {{
                                        type: 'wordCloud',
                                        shape: 'circle',
                                        gridSize: 8,
                                        sizeRange: [14, 36],
                                        rotationRange: [-45, 45],
                                        textStyle: {{ color: () => colors.text }},
                                        emphasis: {{ focus: 'self', textStyle: {{ color: colors.accent }} }},
                                        data: tagsData || [],
                                    }}
                                ],
                            }});

                            tagsChart.resize();
                        }}

                        function rerenderAll() {{
                            if (mapChart) mapChart.dispose();
                            if (tagsChart) tagsChart.dispose();
                            mapChart = null;
                            tagsChart = null;
                            ensureWorldRegistered().then((ok) => {{
                                if (!ok) return;
                                renderMap();
                                renderTags();
                            }});
                        }}

                        function bootstrap(attempt = 0) {{
                            if (!mapEl || !tagsEl) return;
                            if (typeof window.echarts === 'undefined') {{
                                if (attempt < 10) setTimeout(() => bootstrap(attempt + 1), 150);
                                else console.warn('ECharts failed to load');
                                return;
                            }}

                            ensureWorldRegistered().then((ok) => {{
                                if (!ok) return;
                                renderMap();
                                renderTags();
                            }}).catch(err => console.error('ECharts bootstrap failed', err));
                        }}

                        document.querySelectorAll('.metric-btn').forEach(btn => {{
                            btn.addEventListener('click', function() {{
                                const metric = this.getAttribute('data-metric');
                                currentMetric = metric;
                                document.querySelectorAll('.metric-btn').forEach(b => b.classList.remove('metric-btn-active'));
                                this.classList.add('metric-btn-active');
                                renderMap();
                            }});
                        }});

                        const observer = new MutationObserver(() => rerenderAll());
                        observer.observe(document.documentElement, {{ attributes: true, attributeFilter: ['data-theme'] }});

                        window.addEventListener('resize', () => {{
                            if (mapChart) mapChart.resize();
                            if (tagsChart) tagsChart.resize();
                        }});

                        if (document.readyState === 'loading') {{
                            document.addEventListener('DOMContentLoaded', bootstrap);
                        }} else {{
                            bootstrap();

                                                if(window.devMode && window.logDevEvent) {{
                                                    window.logDevEvent('Insights', `Dataset loaded: {stats['total_photos']:.0f} photos, {stats['total_views']:.0f} views, {len(country_metrics)} countries`);
                                                }}
                        }}
                    }})();
                    """
                )
            ),
            style='overflow-x: hidden;',
        ),
        lang='en',
    )
