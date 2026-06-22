# 🚀 BigQuery Release Notes Explorer

A beautiful, premium web application built with **Python Flask** on the backend and **vanilla HTML, JavaScript, and CSS** on the frontend. The application aggregates Google BigQuery's official release notes XML feed, slices the content into discrete cards by update category, and allows you to select one or multiple updates to tweet about them.

---

## ✨ Features

- **📬 Real-time Feed Aggregation:** Automatically pulls updates from Google Cloud's official BigQuery releases feed.
- **⚡ ambient Server Caching:** Caches the XML data for 5 minutes in memory to ensure super-fast client loading and prevent hitting Google's feeds on every page reload. Includes a **Refresh Feed** bypass button.
- **🔪 Smart Content Slicing:** Uses `BeautifulSoup` to break down Google's daily grouped logs into individual, digestible release cards (Features, Fixes, Issues, Announcements).
- **🛡️ Secure Link Normalization:** Rewrites relative URLs to absolute Cloud Console URLs and injects `target="_blank"` and `rel="noopener noreferrer"` attributes on all anchors.
- **🔍 Advanced Instant Filters:** Instant client-side search across titles, dates, or content, type filtering, and chronological sorting.
- **🐥 Interactive Multi-Selection:** Select multiple updates across different dates and bundle them into a Twitter summary.
- **📝 Custom Tweet Modal:** Review the formatted tweet with an active character counter (max 280), modify content inline, and launch an X/Twitter Web Intent.
- **🎨 Glassmorphic Dark Design:** Fully responsive grid built with modern Inter/Outfit fonts, glowing borders, custom loading skeletons, and fluid visual blobs.

---

## 📂 Project Structure

```
bq-releases-notes/
├── app.py                 # Flask server, feed caching & BeautifulSoup slicing logic
├── requirements.txt       # Python library dependencies
├── .gitignore             # Git exclusion parameters
├── templates/
│   └── index.html         # Application dashboard containing filters, modals, and templates
└── static/
    ├── css/
    │   └── style.css      # Premium glassmorphic theme styling & CSS variables
    └── js/
        └── app.js         # Client state controller, search engine, selection sync & tweet compiler
```

---

## 🛠️ Prerequisites

- **Python 3.8+**
- **pip** (Python package installer)

---

## 🚀 Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/k-bhagwan09/gxk-day-2.git
   cd gxk-day-2
   ```

2. **Set up a Python Virtual Environment (recommended):**
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```
   *(On Windows, use `venv\Scripts\activate`)*

3. **Install the dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

---

## 💻 Running the Application

1. **Start the Flask server:**
   ```bash
   python app.py
   ```
   *By default, the server runs on port `5001` in debug mode.*

2. **Access the interface:**
   Navigate to [http://localhost:5001](http://localhost:5001) in your web browser.

---

## 📡 API Reference

### `GET /api/releases`
Fetches and returns the parsed list of release items.

**Query Parameters:**
- `refresh` (string, optional): Pass `true` to force a cache bypass and fetch new XML notes directly from Google.

**Example Response:**
```json
{
  "success": true,
  "from_cache": true,
  "count": 66,
  "items": [
    {
      "id": "tag:google.com,2016:bigquery-release-notes#June_17_2026_0",
      "type": "Feature",
      "date": "2026-06-17T00:00:00-07:00",
      "formatted_date": "June 17, 2026",
      "link": "https://docs.cloud.google.com/bigquery/docs/release-notes#June_17_2026",
      "html": "<p>You can enable autonomous embedding generation on tables...</p>",
      "text_content": "You can enable autonomous embedding generation on tables..."
    }
  ]
}
```

---

## 📝 Twitter/X Intent Share Design

The client-side scripts wrap selected items into custom URLs:
- **Single Card:** Formats the specific update type, date, and description snippet, followed by a direct link to the official notes anchor.
- **Multiple Cards:** Bundles updates in a list grouped by dates and generates a threaded/summary preview.
- **Character Constraint Safety:** The application alerts you when the text is over 280 characters and blocks the share button until the text is shortened to meet X/Twitter specifications.
