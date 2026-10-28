"""Configuration and environment setup"""

import logging
import os

from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Unsplash configuration
UNSPLASH_ACCESS_KEY = os.getenv('UNSPLASH_ACCESS_KEY')
UNSPLASH_USERNAME = os.getenv('UNSPLASH_USERNAME', 'joaohfrodrigues')
CACHE_DURATION_MINUTES = int(os.getenv('CACHE_DURATION_MINUTES', '30'))

# Which fetch mode to use for Unsplash photo retrieval.
# 'batch' returns up to 30 photos in a single call; 'details' requests full
# metadata for each photo via `/photos/{id}`. Default to 'details' now that
# the daily ETL runs with increased API limits.
FETCH_MODE = os.getenv('FETCH_MODE', 'details')

# When true, provider validation failures raise an exception during ETL runs.
# Defaults to false so development runs log and skip invalid items.
ETL_STRICT_VALIDATION = os.getenv('ETL_STRICT_VALIDATION', 'false').lower() in ('1', 'true', 'yes')

# Default values for missing EXIF and metadata fields
# Centralized here to ensure consistency across all code locations (ETL, API, frontend)
DEFAULT_EXIF_VALUES = {
    'make': 'Unknown',
    'model': 'Unknown',
    'exposure_time': 'N/A',
    'aperture': 'N/A',
    'focal_length': 'N/A',
    'iso': 'N/A',
}
DEFAULT_USER_NAME = 'Unknown'

# Log configuration status
logger.info(f'Unsplash configured: {bool(UNSPLASH_ACCESS_KEY)}')
logger.info(f'Unsplash username: {UNSPLASH_USERNAME}')
logger.info(f'Cache duration: {CACHE_DURATION_MINUTES} minutes')
logger.info(f'Unsplash fetch mode: {FETCH_MODE}')
logger.info(f'ETL strict validation: {ETL_STRICT_VALIDATION}')
