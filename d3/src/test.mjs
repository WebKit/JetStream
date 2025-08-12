import { JSDOM } from "jsdom";
import * as d3 from "d3";
import * as topojson from "topojson-client";

export function runTest(airportsData, usData) {
    const airports = d3.csvParse(airportsData, d3.autoType);

    // Setup jsdom
    const dom = new JSDOM(`<!DOCTYPE html><body></body>`);
    const document = dom.window.document;
    const body = d3.select(document.body);


    const width = 975;
    const height = 610;

    const svg = body.append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, 975, 610])
        .attr("style", "width: 100%; height: auto; height: intrinsic;");

    const path = d3.geoPath();

    const states = topojson.feature(usData, usData.objects.states);
    svg.append("path")
        .datum(topojson.mesh(usData, usData.objects.states, (a, b) => a !== b))
        .attr("fill", "none")
        .attr("stroke", "currentColor")
        .attr("stroke-linejoin", "round")
        .attr("d", path);

    const delaunay = d3.Delaunay.from(airports, d => d.longitude, d => d.latitude);
    const voronoi = delaunay.voronoi([0, 0, width, height]);

    svg.append("g")
        .attr("fill", "none")
        .attr("stroke", "currentColor")
        .attr("stroke-opacity", 0.2)
        .selectAll("path")
        .data(airports)
        .join("path")
        .attr("d", (d, i) => voronoi.renderCell(i))
        .append("title")
        .text(d => `${d.name}
${d.city}, ${d.state}`);

    svg.append("path")
        .datum(states)
        .attr("fill", "none")
        .attr("d", path);

    svg.append("g")
        .attr("font-family", "sans-serif")
        .attr("font-size", 10)
        .attr("text-anchor", "middle")
        .selectAll("text")
        .data(airports)
        .join("text")
        .attr("transform", d => `translate(${d.longitude},${d.latitude})`)
        .call(text => text.append("tspan")
            .attr("y", "-0.7em")
            .attr("font-weight", "bold")
            .text(d => d.iata))
        .call(text => text.append("tspan")
            .attr("x", 0)
            .attr("y", "0.7em")
            .attr("fill-opacity", 0.7)
            .text(d => d.name));

    return body.html();
}