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

globalThis.self = globalThis;
globalThis.window = globalThis;
globalThis.document = {
    createElement: function () {
        return {
            setAttribute: function () {},
            style: {},
            appendChild: function () {},
            removeChild: function () {},
            insertBefore: function () {},
            querySelectorAll: function () {
                return [];
            },
        };
    },
    createTextNode: function (text) {
        return {
            textContent: text,
        };
    },
    getElementsByTagName: function () {
        return [];
    },
    getElementById: function () {
        return null;
    },
    querySelector: function () {
        return null;
    },
    querySelectorAll: function () {
        return [];
    },
    documentElement: {
        style: {},
        querySelectorAll: function () {
            return [];
        },
        insertBefore: function () {},
    },
    body: {
        style: {},
        appendChild: function () {},
        removeChild: function () {},
        insertBefore: function () {},
        querySelectorAll: function () {
            return [];
        },
    },
};
globalThis.navigator = {
    userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36",
};
globalThis.postMessage = function (data) {};
globalThis.addEventListener = function (type, listener) {
    if (type === "message") {
        globalThis.onmessage = listener;
    }
};
globalThis.importScripts = function () {};
