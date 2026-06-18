let map;

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
}

initMap();
