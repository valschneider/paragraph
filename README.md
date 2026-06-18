# Paragraph

A GPX visualizer for paragliding traces, hosted on GitHub Pages.
Mostly driven by Claude because I don't know web.

## Features

- Interactive 3D terrain visualization using MapLibre GL JS
- Terrain and hillshade data from Mapterhorn
- Load and display GPX flight tracks
- Visual start/end markers
- Navigation controls (zoom, rotate, tilt)
- Colour-coded climb rate in meters/second

## Usage

1. Open the page in a web browser
2. Click "Choose File" and select a GPX file from your paragliding flight
3. The track will be displayed on the 3D terrain map
4. Use mouse controls to navigate:
   - Left-click drag: rotate view
   - Right-click drag: pan
   - Scroll: zoom
   - Ctrl + left-click drag: change pitch/tilt

## Development

This is a static site that can be served directly from GitHub Pages. To test locally:

```bash
python -m http.server 8000
```

Then open http://localhost:8000 in your browser.
