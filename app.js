let map;
let deckOverlay;
let currentGeojson = null;
let trackColor = [255, 51, 51];
let trackOpacity = 255;

// From https://maplibre.org/maplibre-gl-js/docs/examples/3d-terrain/
function initMap() {
    map = new maplibregl.Map({
	container: 'map',
	zoom: 12,
	center: [6.1294, 45.8992],
	pitch: 70,
	hash: true,
	style: {
	    version: 8,
	    sources: {
		osm: {
		    type: 'raster',
		    tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
		    tileSize: 256,
		    attribution: '&copy; OpenStreetMap Contributors',
		    maxzoom: 19
		},
		terrainSource: {
		    type: 'raster-dem',
		    url: 'https://tiles.mapterhorn.com/tilejson.json'
		},
		hillshadeSource: {
		    type: 'raster-dem',
		    url: 'https://tiles.mapterhorn.com/tilejson.json'
		}
	    },
	    layers: [
		{
		    id: 'osm',
		    type: 'raster',
		    source: 'osm'
		},
		{
		    id: 'hills',
		    type: 'hillshade',
		    source: 'hillshadeSource',
		    layout: {visibility: 'visible'},
		    paint: {'hillshade-shadow-color': '#473B24'}
		}
	    ],
	    terrain: {
		source: 'terrainSource',
		exaggeration: 1
	    },
	    sky: {}
	},
	maxZoom: 18,
	maxPitch: 85
    });

    map.addControl(
	new maplibregl.NavigationControl({
	    visualizePitch: true,
	    showZoom: true,
	    showCompass: true
	})
    );

    map.addControl(
	new maplibregl.TerrainControl({
	    source: 'terrainSource',
	    exaggeration: 1
	})
    );

    map.addControl(new maplibregl.FullscreenControl());

    // Initialize Deck.gl overlay
    deckOverlay = new deck.MapboxOverlay({
	interleaved: true,
	layers: []
    });
    map.addControl(deckOverlay);
}

function parseGPX(gpxText) {
    const parser = new DOMParser();
    const gpxDoc = parser.parseFromString(gpxText, 'text/xml');
    const geojson = toGeoJSON.gpx(gpxDoc);
    return geojson;
}

function displayTrack(geojson) {
    currentGeojson = geojson;

    updateTrackLayer();

    // Extract coordinates from GeoJSON
    const features = geojson.features || [];
    const tracks = features.filter(f => f.geometry.type === 'LineString');

    // Fit map to track bounds
    const track = tracks[0];
    const coordinates = track.geometry.coordinates;

    if (coordinates.length > 0) {
	const lngs = coordinates.map(c => c[0]);
	const lats = coordinates.map(c => c[1]);
	const bounds = [
	    [Math.min(...lngs), Math.min(...lats)],
	    [Math.max(...lngs), Math.max(...lats)]
	];
	map.fitBounds(bounds, { padding: 50 });
    }
}

function updateTrackLayer() {
    if (!currentGeojson) return;

    const features = currentGeojson.features || [];
    const tracks = features.filter(f => f.geometry.type === 'LineString');

    if (tracks.length === 0) {
	console.error('No track found in GPX');
	return;
    }

    const track = tracks[0];
    const color = [...trackColor, trackOpacity];

    // Create PathLayer
    const pathLayer = new deck.PathLayer({
	id: 'gpx-track',
	data: [track],
	getPath: d => d.geometry.coordinates,
	getColor: color,
	getWidth: 5,
	widthMinPixels: 2,
	widthMaxPixels: 10
    });

    // Update deck.gl overlay
    deckOverlay.setProps({
	layers: [pathLayer]
    });
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
	parseInt(result[1], 16),
	parseInt(result[2], 16),
	parseInt(result[3], 16)
    ] : [255, 51, 51];
}

document.getElementById('gpx-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
	console.log('GPX file selected:', file.name);

	const reader = new FileReader();
	reader.onload = (event) => {
	    try {
		const gpxText = event.target.result;
		const geojson = parseGPX(gpxText);
		console.log('Parsed GeoJSON:', geojson);
		displayTrack(geojson);
	    } catch (error) {
		console.error('Error parsing GPX:', error);
	    }
	};
	reader.readAsText(file);
    }
});

document.getElementById('track-color').addEventListener('input', (e) => {
    trackColor = hexToRgb(e.target.value);
    updateTrackLayer();
});

document.getElementById('track-opacity').addEventListener('input', (e) => {
    trackOpacity = parseInt(e.target.value);
    const percentage = Math.round((trackOpacity / 255) * 100);
    document.getElementById('opacity-value').textContent = `${percentage}%`;
    updateTrackLayer();
});

initMap();
