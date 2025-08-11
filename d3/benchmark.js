// Load D3 and data loading utilities for d8
load('dist/d3.js');

// Mock d8's file reading capabilities
const read = (path) => {
    // In a real d8 environment, this would read a file from the filesystem.
    // Here we'll have to pre-load the data as strings.
    // This is a placeholder for where you would load your files.
    // You would replace this with actual file reading logic in your d8 setup.
    if (path === 'dist/counties-albers-10m.json') {
        return "{\"type\":\"Topology\",\"objects\":{\"counties\":{\"type\":\"GeometryCollection\",\"geometries\":[{\"type\":\"Polygon\",\"arcs\":[[0,1,2,3]]}]},\"states\":{\"type\":\"GeometryCollection\",\"geometries\":[]},\"nation\":{\"type\":\"GeometryCollection\",\"geometries\":[]}}},\"arcs\":[[[610,584],[1,0]],[[611,584],[-1,0]],[[610,584],[-1,0]],[[609,584],[1,0]]],\"transform\":{\"scale\":[0.00001,0.00001],\"translate\":[-179.2,17.8]}}";
    }
    if (path === 'dist/unemployment.csv') {
        return "id,rate\n01001,0.027";
    }
    return '';
};

// Start performance measurement
const startTime = performance.now();

// Load data
const us = JSON.parse(read('dist/counties-albers-10m.json'));
const unemployment = d3.csvParse(read('dist/unemployment.csv'), (d) => ({id: d.id, rate: +d.rate}));
const rateById = new Map(unemployment.map(d => [d.id, d.rate]));

// Create a color scale
const color = d3.scaleQuantize([0.01, 0.1], d3.schemeBlues[9]);

// Create a path generator
const path = d3.geoPath();

// Create the SVG paths
const counties = topojson.feature(us, us.objects.counties);
const states = topojson.mesh(us, us.objects.states, (a, b) => a !== b);

let svgOutput = '<svg viewBox="0 0 975 610">';
svgOutput += '<g fill="none" stroke="#000" stroke-linejoin="round" stroke-linecap="round">';
svgOutput += `<path d="${path(counties)}" fill="none" />`;
svgOutput += `<path d="${path(states)}" stroke="#fff" />`;
svgOutput += '</g>';

svgOutput += '<g fill-rule="evenodd">';
counties.features.forEach(feature => {
    const rate = rateById.get(feature.id);
    if (rate !== undefined) {
        svgOutput += `<path d="${path(feature)}" fill="${color(rate)}" />`;
    }
});
svgOutput += '</g>';
svgOutput += '</svg>';


// End performance measurement
const endTime = performance.now();

// Print the result
print(`Render time: ${endTime - startTime} ms`);
// print(svgOutput); // Optional: print the SVG output
