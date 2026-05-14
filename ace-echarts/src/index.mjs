/*
 * Copyright (C) 2026 Apple Inc. All rights reserved.
 * Copyright 2026 Google LLC
 * 
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY APPLE INC. AND ITS CONTRIBUTORS ``AS IS''
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
 * THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 * PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL APPLE INC. OR ITS CONTRIBUTORS
 * BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF
 * THE POSSIBILITY OF SUCH DAMAGE.
 */

import "./mocks.js";
import * as echarts from "echarts";
import * as ecStat from "echarts-stat";
import { originalData } from "./data.js";
import { JSHINT } from "jshint";

globalThis.echarts = echarts;
globalThis.ecStat = ecStat;

// Read the file ONCE at top level
let codeToLint = "";
try {
    codeToLint = read(
        "./ace-echarts/node_modules/ace-builds/src-min-noconflict/worker-javascript.js"
    );
} catch (e) {
    // Fallback if read is not available or fails
    codeToLint = "var a = " + JSON.stringify(new Array(10000).fill({ val: 1 })) + ";";
}

export function runTest() {
    // 1. Run the original clustering workload
    const step = ecStat.clustering.hierarchicalKMeans(originalData, {
        clusterCount: 6,
        outputType: "single",
        outputClusterIndexDimension: 2,
        outputCentroidDimensions: [3, 4],
        stepByStep: true,
    });

    const colorAll = [
        "#bbb",
        "#37A2DA",
        "#e06343",
        "#37a354",
        "#b55dba",
        "#b5bd48",
        "#8378EA",
        "#96BFFF",
    ];
    const ANIMATION_DURATION_UPDATE = 1500;

    function renderItemPoint(params, api) {
        const coord = api.coord([api.value(0), api.value(1)]);
        let clusterIdx = api.value(2);
        if (clusterIdx == null || isNaN(clusterIdx)) {
            clusterIdx = 0;
        }
        const isNewCluster = clusterIdx === api.value(3);
        const extra = { transition: [] };
        const contentColor = colorAll[clusterIdx];
        return {
            type: "circle",
            x: coord[0],
            y: coord[1],
            shape: { cx: 0, cy: 0, r: 10 },
            extra: extra,
            style: {
                fill: contentColor,
                stroke: "#333",
                lineWidth: 1,
                shadowColor: contentColor,
                shadowBlur: isNewCluster ? 12 : 0,
                transition: ["shadowBlur", "fill"],
            },
        };
    }

    function renderBoundary(params, api) {
        const xVal = api.value(0);
        const yVal = api.value(1);
        const maxDist = api.value(2);
        const center = api.coord([xVal, yVal]);
        const size = api.size([maxDist, maxDist]);
        return {
            type: "ellipse",
            shape: {
                cx: isNaN(center[0]) ? 0 : center[0],
                cy: isNaN(center[1]) ? 0 : center[1],
                rx: isNaN(size[0]) ? 0 : size[0] + 15,
                ry: isNaN(size[1]) ? 0 : size[1] + 15,
            },
            style: {
                fill: null,
                stroke: "rgba(0,0,0,0.2)",
                lineDash: [4, 4],
                lineWidth: 4,
            },
        };
    }

    function makeStepOption(option, data, centroids) {
        const newCluIdx = centroids ? centroids.length - 1 : -1;
        let maxDist = 0;
        for (let i = 0; i < data.length; i++) {
            const line = data[i];
            if (line[2] === newCluIdx) {
                const dist0 = Math.pow(line[0] - line[3], 2);
                const dist1 = Math.pow(line[1] - line[4], 2);
                maxDist = Math.max(maxDist, dist0 + dist1);
            }
        }
        const boundaryData = centroids
            ? [[centroids[newCluIdx][0], centroids[newCluIdx][1], Math.sqrt(maxDist)]]
            : [];
        option.options.push({
            series: [
                {
                    type: "custom",
                    encode: { tooltip: [0, 1] },
                    renderItem: renderItemPoint,
                    data: data,
                },
                {
                    type: "custom",
                    renderItem: renderBoundary,
                    animationDuration: 3000,
                    silent: true,
                    data: boundaryData,
                },
            ],
        });
    }

    const option = {
        timeline: {
            top: "center",
            right: 50,
            height: 300,
            width: 10,
            inverse: true,
            autoPlay: false,
            playInterval: 2500,
            symbol: "none",
            orient: "vertical",
            axisType: "category",
            label: { formatter: "step {value}", position: 10 },
            checkpointStyle: { animationDuration: ANIMATION_DURATION_UPDATE },
            data: [],
        },
        baseOption: {
            animationDurationUpdate: ANIMATION_DURATION_UPDATE,
            transition: ["shape"],
            tooltip: {},
            xAxis: { type: "value" },
            yAxis: { type: "value" },
            series: [{ type: "scatter" }],
        },
        options: [],
    };

    makeStepOption(option, originalData);
    option.timeline.data.push("0");
    for (let i = 1, stepResult; !(stepResult = step.next()).isEnd; i++) {
        makeStepOption(
            option,
            echarts.util.clone(stepResult.data),
            echarts.util.clone(stepResult.centroids)
        );
        option.timeline.data.push(i + "");
    }

    // 2. Mimic regression by invoking JSHint on a large string
    // Use the pre-read code
    JSHINT(codeToLint, { esversion: 6 });

    return option;
}
