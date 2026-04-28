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
