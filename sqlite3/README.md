# Official sqlite3 benchmark, compiled to WebAssembly

This is a Wasm (shell-only) build of SQLite's official `speedtest1.c` benchmark program.
Quoting from https://sqlite.org/cpu.html:
"This program strives to exercise the SQLite library in a way that is typical of real-world applications. Of course, every application is different, and so no test program can exactly mirror the behavior of all applications. The speedtest1.c program is updated from time to time as the SQLite developers' understanding of what constitutes "typical" usage evolves."

## Build Instructions

See `build.sh` or just run it.
See `build.log` for the last build time, used sources, and toolchain versions.

Prerequisites:
- Emscripten: https://emscripten.org. Make sure `emcc` is on your `PATH`, e.g., by running `source /path/to/emsdk_env.sh`.
- `wasm-strip`: Install WABT, e.g., via `sudo apt install wabt` or by compiling yourself from the source at https://github.com/WebAssembly/wabt.

Since this benchmark is meant for the developers of SQLite, it is not part of the official Wasm build of SQLite at https://sqlite.org/wasm/doc/trunk/index.md and also not contained in the "amalgamation" single-file source code of SQLite (see https://sqlite.org/amalgamation.html).
So we need to build it ourselves from the full sources.
You can download the full SQLite source tree from https://sqlite.org/download.html.
See under "Alternative Source Code Formats" or search for "Snapshot of the complete (raw) source tree for SQLite".

## Running in JS shells

The SQLite developers only maintain compatibility of the Wasm build for running inside browsers, so `shell-runner.js` contains some polyfills and dirty hacks to make it run in `d8`/`jshell`/`jsc` as well.
Ideally it should run just via `$shell shell-runner.js` from the current directory.

Note that because there is no OPFS (Origin Private File System) available in some shells, this uses an in-memory file system that might run slower compared to browsers.

## Running in the Browser

Start a webserver in `build/` that serves with the correct headers set for Wasm execution, e.g., this simple Python server will do:
```
#!/usr/bin/env python3
from http.server import HTTPServer, SimpleHTTPRequestHandler, test
import sys

class CORSRequestHandler (SimpleHTTPRequestHandler):
    def end_headers (self):
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')

        SimpleHTTPRequestHandler.end_headers(self)

if __name__ == '__main__':
    test(CORSRequestHandler, HTTPServer, port=int(sys.argv[1]) if len(sys.argv) > 1 else 8083)
```

Then just browse to http://localhost:8083/speedtest1.html. Because the computation happens on the main thread, it may hang for a little while but should show the console output afterwards.