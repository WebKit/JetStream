"use strict";

/*
 * Copyright (C) 2025 Apple Inc. All rights reserved.
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


class Params {
    // Enable a detailed developer menu to change the current Params.
    developerMode = false;
    startAutomatically = false;
    shouldReport = false;
    startDelay = undefined;

    testList = [];
    testIterationCount = undefined;
    testWorstCaseCount = undefined;
    prefetchResources = true;

    constructor(searchParams = undefined) {
        if (searchParams)
            this._copyFromSearchParams(searchParams);
        if (!this.developerMode) {
            Object.freeze(this.viewport);
            Object.freeze(this);
        }
    }

    _parseInt(value, errorMessage) {
        const number = Number(value);
        if (!Number.isInteger(number) && errorMessage)
            throw new Error(`Invalid ${errorMessage} param: '${value}', expected int.`);
        return parseInt(number);
    }

    _copyFromSearchParams(searchParams) {
        this.startAutomatically = this._parseBooleanParam(searchParams, "startAutomatically");
        this.developerMode = this._parseBooleanParam(searchParams, "developerMode");
        this.shouldReport = this._parseBooleanParam(searchParams, "report");
        this.prefetchResources = this._parseBooleanParam(searchParams, "prefetchResources");

         this.startDelay = this._parseIntParam(searchParams, "startDelay", 0);
        if (this.shouldReport && !this.startDelay)
            this.startDelay = 4000;

        for (const paramKey of ["tag", "tags", "test", "tests"])
          this.testList = this._parseTestListParam(searchParams, paramKey);

        this.testIterationCount = this._parseIntParam(searchParams, "iterationCount", 1);
        this.testWorstCaseCount = this._parseIntParam(searchParams, "worstCaseCount", 1);

        const unused = Array.from(searchParams.keys());
        if (unused.length > 0)
            console.error("Got unused search params", unused);
    }

    _parseTestListParam(searchParams, key) {
        if (this.testList?.length)
            throw new Error(`Overriding previous testList=${this.testList.join()} with ${key} url-parameter.`);
        const value = searchParams.getAll(key);
        searchParams.delete(key);
        return value;
    }

    _parseBooleanParam(searchParams, paramKey) {
        if (!searchParams.has(paramKey))
            return DefaultJetStreamParams[paramKey];
        const value = searchParams.get(paramKey).toLowerCase();
        searchParams.delete(paramKey);
        return !(value === "false" || value === "0");
    }

    _parseIntParam(searchParams, paramKey, minValue) {
        if (!searchParams.has(paramKey))
            return DefaultJetStreamParams[paramKey];

        const parsedValue = this._parseInt(searchParams.get(paramKey), paramKey);
        if (parsedValue < minValue)
            throw new Error(`Invalid ${paramKey} param: '${parsedValue}', value must be >= ${minValue}.`);
        searchParams.delete(paramKey);
        return parsedValue;
    }

    _parseTags(searchParams) {
        if (!searchParams.has("tags"))
            return DefaultJetStreamParams.tags;
        if (this.suites.length)
            throw new Error("'suites' and 'tags' cannot be used together.");
        const tags = searchParams.get("tags").split(",");
        searchParams.delete("tags");
        return tags;
    }

    _parseEnumParam(searchParams, paramKey, enumArray) {
        if (!searchParams.has(paramKey))
            return DefaultJetStreamParams[paramKey];
        const value = searchParams.get(paramKey);
        if (!enumArray.includes(value))
            throw new Error(`Got invalid ${paramKey}: '${value}', choices are ${enumArray}`);
        searchParams.delete(paramKey);
        return value;
    }

    _parseShuffleSeed(searchParams) {
        if (!searchParams.has("shuffleSeed"))
            return DefaultJetStreamParams.shuffleSeed;
        let shuffleSeed = searchParams.get("shuffleSeed");
        if (shuffleSeed !== "off") {
            if (shuffleSeed === "generate") {
                shuffleSeed = Math.floor((Math.random() * 1) << 16);
                console.log(`Generated a random suite order seed: ${shuffleSeed}`);
            } else {
                shuffleSeed = parseInt(shuffleSeed);
            }
            if (!Number.isInteger(shuffleSeed))
                throw new Error(`Invalid shuffle seed: '${shuffleSeed}', must be either 'off', 'generate' or an integer.`);
        }
        searchParams.delete("shuffleSeed");
        return shuffleSeed;
    }


    toCompleteSearchParamsObject() {
        return this.toSearchParamsObject(false);
    }

    toSearchParamsObject(filter = true) {
        const rawUrlParams = { __proto__: null };
        for (const [key, value] of Object.entries(this)) {
            // Skip over default values.
            if (filter && value === DefaultJetStreamParams[key])
                continue;
            rawUrlParams[key] = value;
        }

        if (this.viewport.width !== DefaultJetStreamParams.viewport.width || this.viewport.height !== DefaultJetStreamParams.viewport.height)
            rawUrlParams.viewport = `${this.viewport.width}x${this.viewport.height}`;

        if (this.suites.length) {
            rawUrlParams.suites = this.suites.join(",");
        } else if (this.tags.length) {
            if (!(this.tags.length === 1 && this.tags[0] === "default"))
                rawUrlParams.tags = this.tags.join(",");
        } else {
            rawUrlParams.suites = "";
        }

        return new URLSearchParams(rawUrlParams);
    }

    toSearchParams() {
        return this.toSearchParamsObject().toString();
    }
}

const DefaultJetStreamParams = new Params();
let maybeCustomParams = DefaultJetStreamParams;
if (globalThis?.JetStreamParamsSource) {
    try {
        maybeCustomParams = new Params(globalThis?.JetStreamParamsSource);
    } catch (e) {
        console.error("Invalid Params", e, "\nUsing defaults as fallback:", maybeCustomParams);
    }
}
const JetStreamParams = maybeCustomParams;