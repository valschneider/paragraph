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

    // Extract trackpoints with time and elevation data
    const trackpoints = gpxDoc.querySelectorAll('trkpt');
    const points = [];

    trackpoints.forEach(trkpt => {
        const lat = parseFloat(trkpt.getAttribute('lat'));
        const lon = parseFloat(trkpt.getAttribute('lon'));

        const eleElement = trkpt.querySelector('ele');
        const ele = eleElement ? parseFloat(eleElement.textContent) : null;

        const timeElement = trkpt.querySelector('time');
        const time = timeElement ? new Date(timeElement.textContent) : null;

        points.push({
            coordinates: [lon, lat, ele],
            elevation: ele,
            time: time
        });
    });

    const geojson = toGeoJSON.gpx(gpxDoc);

    // Attach our parsed points with elevation and time
    if (geojson.features && geojson.features.length > 0) {
        geojson.features[0].properties.points = points;
    }

    return geojson;
}

function computeClimbRate(points, windowSeconds = 5) {
    const climbRates = [];

    for (let i = 0; i < points.length; i++) {
        const currentPoint = points[i];

        if (!currentPoint.time || currentPoint.elevation === null) {
            climbRates.push(0);
            continue;
        }

        // Find points within window
        let startIdx = i;
        for (let j = i - 1; j >= 0; j--) {
            if (!points[j].time) break;
            const timeDiff = (currentPoint.time - points[j].time) / 1000;
            if (timeDiff > windowSeconds) break;
            startIdx = j;
        }

        if (startIdx === i) {
            climbRates.push(0);
            continue;
        }

        const startPoint = points[startIdx];
        const elevationGain = currentPoint.elevation - startPoint.elevation;
        const timeDiff = (currentPoint.time - startPoint.time) / 1000;

        const climbRate = timeDiff > 0 ? elevationGain / timeDiff : 0;
        climbRates.push(climbRate);
    }

    return climbRates;
}

// Color palette: blue (cold/sinking) to red (hot/climbing)
// Ranges: ]-inf, -4], ]-4, -3], ]-3, -2], ]-2, -1], ]-1, 0], ]0, 1], ]1, 2], ]2, 3], ]3, 4], ]4, inf[
function getColorForClimbRate(climbRate) {
    if (climbRate <= -4) {
        return [0, 0, 139];      // Dark blue
    } else if (climbRate <= -3) {
        return [0, 0, 205];      // Medium blue
    } else if (climbRate <= -2) {
        return [30, 144, 255];   // Dodger blue
    } else if (climbRate <= -1) {
        return [100, 149, 237];  // Cornflower blue
    } else if (climbRate <= 0) {
        return [135, 206, 250];  // Light sky blue
    } else if (climbRate <= 1) {
        return [50, 205, 50];    // Lime green
    } else if (climbRate <= 2) {
        return [255, 255, 0];    // Yellow
    } else if (climbRate <= 3) {
        return [255, 165, 0];    // Orange
    } else if (climbRate <= 4) {
        return [255, 69, 0];     // Red-orange
    } else {
        return [139, 0, 0];      // Dark red
    }
}

function segmentTrackByClimbRate(points, climbRates, opacity) {
    const segments = [];

    let currentSegment = {
        path: [points[0].coordinates],
        color: [...getColorForClimbRate(climbRates[0]), opacity]
    };

    for (let i = 1; i < points.length; i++) {
        const currentColor = getColorForClimbRate(climbRates[i]);
        const prevColor = getColorForClimbRate(climbRates[i - 1]);

        // Check if color category changed
        if (JSON.stringify(currentColor) === JSON.stringify(prevColor)) {
            currentSegment.path.push(points[i].coordinates);
        } else {
            // Finish current segment
            currentSegment.path.push(points[i].coordinates);
            segments.push(currentSegment);

            // Start new segment
            currentSegment = {
                path: [points[i].coordinates],
                color: [...currentColor, opacity]
            };
        }
    }

    // Add final segment
    if (currentSegment.path.length > 0) {
        segments.push(currentSegment);
    }

    return segments;
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
    const points = track.properties.points;

    if (!points || points.length === 0) {
	console.error('No points data available');
	return;
    }

    // Compute climb rates
    const climbRates = computeClimbRate(points, 5);

    // Segment track by climb rate
    const segments = segmentTrackByClimbRate(points, climbRates, trackOpacity);

    console.log('Created', segments.length, 'segments');

    // Create PathLayer with segmented data
    const pathLayer = new deck.PathLayer({
	id: 'gpx-track',
	data: segments,
	getPath: d => d.path,
	getColor: d => d.color,
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
