import time
import requests
import feedparser
from flask import Flask, render_template, jsonify, request
from bs4 import BeautifulSoup

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

# In-memory cache to avoid hitting Google's feeds too frequently
_feed_cache = {
    "items": None,
    "last_fetched": 0
}
CACHE_TIMEOUT = 300  # 5 minutes

def parse_entry(entry):
    """Parses a single feed entry and splits its HTML content by <h3> tags
    into individual release items.
    """
    content_list = entry.get('content')
    content_html = ""
    if content_list:
        content_html = content_list[0].value
    else:
        content_html = entry.get('summary', '')

    soup = BeautifulSoup(content_html, 'html.parser')
    raw_items = []
    
    current_type = None
    current_elements = []
    
    for element in soup.contents:
        # Check if element is an <h3> tag which defines the update type (e.g. Feature, Fix)
        if hasattr(element, 'name') and element.name == 'h3':
            if current_elements or current_type:
                raw_items.append({
                    'type': current_type or 'Update',
                    'html': ''.join(str(el) for el in current_elements).strip()
                })
            current_type = element.get_text().strip()
            current_elements = []
        else:
            current_elements.append(element)
            
    # Add the last block of elements
    if current_elements or current_type:
        raw_items.append({
            'type': current_type or 'Update',
            'html': ''.join(str(el) for el in current_elements).strip()
        })
        
    parsed_items = []
    for idx, item in enumerate(raw_items):
        html_str = item['html']
        item_soup = BeautifulSoup(html_str, 'html.parser')
        text_content = item_soup.get_text().strip()
        
        # Skip empty items
        if not text_content and item['type'] == 'Update':
            continue
            
        # Standardize links: make absolute and open in new tab
        for link_tag in item_soup.find_all('a'):
            link_tag['target'] = '_blank'
            link_tag['rel'] = 'noopener noreferrer'
            href = link_tag.get('href', '')
            if href.startswith('/'):
                link_tag['href'] = 'https://docs.cloud.google.com' + href
        
        # Add class to lists for nice styling
        for ul_tag in item_soup.find_all('ul'):
            ul_tag['class'] = ul_tag.get('class', []) + ['release-list']
            
        html_str = str(item_soup)
        
        # Generate a unique stable identifier
        entry_id = entry.get('id', entry.get('link', ''))
        unique_id = f"{entry_id}_{idx}"
        
        parsed_items.append({
            'id': unique_id,
            'type': item['type'],
            'html': html_str,
            'text_content': text_content,
            'date': entry.get('updated') or entry.get('published') or '',
            'formatted_date': entry.get('title', ''),  # e.g., "June 17, 2026"
            'link': entry.get('link', 'https://docs.cloud.google.com/bigquery/docs/release-notes')
        })
        
    return parsed_items

def fetch_and_parse_feed(force_refresh=False):
    """Fetches the Google BigQuery release notes RSS feed and parses it.
    Uses in-memory cache if cache is fresh and force_refresh is False.
    """
    now = time.time()
    if not force_refresh and _feed_cache["items"] is not None and (now - _feed_cache["last_fetched"] < CACHE_TIMEOUT):
        return _feed_cache["items"], True  # True means served from cache

    try:
        # Fetch RSS feed using requests with timeout to prevent hang
        response = requests.get(FEED_URL, timeout=10)
        response.raise_for_status()
        
        # Parse XML using feedparser
        feed_data = feedparser.parse(response.text)
        
        all_items = []
        for entry in feed_data.entries:
            all_items.extend(parse_entry(entry))
            
        # Update cache
        _feed_cache["items"] = all_items
        _feed_cache["last_fetched"] = now
        return all_items, False
        
    except Exception as e:
        # Fallback to cache if available, else re-raise
        if _feed_cache["items"] is not None:
            return _feed_cache["items"], True
        raise e

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    try:
        items, from_cache = fetch_and_parse_feed(force_refresh=force_refresh)
        return jsonify({
            'success': True,
            'from_cache': from_cache,
            'count': len(items),
            'items': items
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True, port=5001)
