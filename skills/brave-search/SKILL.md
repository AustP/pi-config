---
name: brave-search
description: "USE FOR all Brave Search API tasks in one skill: web, news, videos, images, llm context grounding, local POI lookup, and local POI descriptions. Use when user asks to search the web."
---

# Brave Search (Unified)

Use this skill as the single entry point for Brave Search APIs.

## Authentication

- API key required in header: `X-Subscription-Token: $BRAVE_SEARCH_API_KEY`
- Base URL: `https://api.search.brave.com/res/v1`
- Common headers:
  - `Accept: application/json`
  - `Accept-Encoding: gzip` (recommended when response may be large)

## Choose the Right Endpoint

| Need | Endpoint |
|--|--|
| General web results, mixed verticals, locations IDs | `GET/POST /web/search` |
| News-only search | `GET/POST /news/search` |
| Video-only search | `GET/POST /videos/search` |
| Image-only search | `GET /images/search` |
| LLM/RAG grounding content (snippets/chunks) | `GET/POST /llm/context` |
| Full local business details from POI IDs | `GET /local/pois` |
| AI-generated markdown descriptions from POI IDs | `GET /local/descriptions` |

## Shared Query Parameters (when supported)

- Required: `q`
- Common optional: `country`, `search_lang`, `ui_lang`, `count`, `offset`, `safesearch`, `freshness`, `spellcheck`, `operators`
- Freshness values: `pd`, `pw`, `pm`, `py`, or `YYYY-MM-DDtoYYYY-MM-DD`

## Endpoint-specific Notes

### 1) Web Search — `/web/search`
Use when you need broad search or mixed result types (web/news/videos/locations/discussions/faq/infobox).

- `count`: 1-20
- Supports: `result_filter`, `goggles`, `extra_snippets`, `enable_rich_callback`, `include_fetch_metadata`
- For POI IDs: set `result_filter=locations` and read `locations.results[].id`

### 2) News Search — `/news/search`
Use for article feeds and current events.

- `count`: 1-50
- Supports: `freshness`, `goggles`, `extra_snippets`, `include_fetch_metadata`

### 3) Videos Search — `/videos/search`
Use for video metadata (duration, views, creator, publisher).

- `count`: 1-50
- Supports: `freshness`, `include_fetch_metadata`

### 4) Images Search — `/images/search`
Use for image discovery with source URLs and thumbnails.

- `count`: 1-200
- `safesearch`: `off` or `strict` only

### 5) LLM Context — `/llm/context`
Use for RAG/agent grounding with extracted snippets and source metadata.

- Context controls:
  - `maximum_number_of_urls` (1-50)
  - `maximum_number_of_tokens` (1024-32768)
  - `maximum_number_of_snippets` (1-100)
  - `maximum_number_of_tokens_per_url` (512-8192)
  - `maximum_number_of_snippets_per_url` (1-100)
- Quality controls:
  - `context_threshold_mode`: `strict` / `balanced` / `lenient`
  - `goggles` for source curation
- Local recall: `enable_local` + optional location headers

### 6) Local POIs — `/local/pois`
Use to fetch structured details for local businesses.

- Requires `ids` (1-20) from `/web/search` locations results
- Optional: `units=metric|imperial`, `search_lang`, `ui_lang`
- Optional distance headers: `X-Loc-Lat`, `X-Loc-Long`

### 7) Local Descriptions — `/local/descriptions`
Use to fetch AI-generated markdown summaries for POIs.

- Requires `ids` (1-20) from `/web/search` locations results
- Output includes markdown; individual descriptions may be `null`

## Local Flow (Two-step)

1. Search for places and collect IDs:

```bash
curl -s "https://api.search.brave.com/res/v1/web/search?q=coffee+shops+near+me&result_filter=locations" \
  -H "Accept: application/json" \
  -H "X-Subscription-Token: $BRAVE_SEARCH_API_KEY"
```

2. Reuse IDs for local endpoints:

```bash
# Structured POI details
curl -s "https://api.search.brave.com/res/v1/local/pois" \
  -H "Accept: application/json" \
  -H "X-Subscription-Token: $BRAVE_SEARCH_API_KEY" \
  -G --data-urlencode "ids=<POI_ID>"

# AI markdown descriptions
curl -s "https://api.search.brave.com/res/v1/local/descriptions" \
  -H "Accept: application/json" \
  -H "X-Subscription-Token: $BRAVE_SEARCH_API_KEY" \
  -G --data-urlencode "ids=<POI_ID>"
```

## Practical Defaults

- Start simple:
  - web/news/videos: `count=20`
  - images: `count=50`
  - llm-context: `count=20`, `maximum_number_of_tokens=8192`, `context_threshold_mode=balanced`
- Use `goggles` when source quality matters.
- Use location headers only when local intent is present.
- Use POST for long queries or complex inline goggles.

## Quick cURL Templates

```bash
# Web
curl -s "https://api.search.brave.com/res/v1/web/search?q=<QUERY>" \
  -H "Accept: application/json" \
  -H "X-Subscription-Token: $BRAVE_SEARCH_API_KEY"

# News
curl -s "https://api.search.brave.com/res/v1/news/search?q=<QUERY>" \
  -H "Accept: application/json" \
  -H "X-Subscription-Token: $BRAVE_SEARCH_API_KEY"

# Videos
curl -s "https://api.search.brave.com/res/v1/videos/search?q=<QUERY>" \
  -H "Accept: application/json" \
  -H "X-Subscription-Token: $BRAVE_SEARCH_API_KEY"

# Images
curl -s "https://api.search.brave.com/res/v1/images/search?q=<QUERY>" \
  -H "Accept: application/json" \
  -H "X-Subscription-Token: $BRAVE_SEARCH_API_KEY"

# LLM Context
curl -s "https://api.search.brave.com/res/v1/llm/context?q=<QUERY>" \
  -H "Accept: application/json" \
  -H "X-Subscription-Token: $BRAVE_SEARCH_API_KEY"
```
