// Copyright 2025 the V8 project authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

class Benchmark {
    async runIteration() {
        if (!Module._main)
            await setupModule(Module);

        Module._main();
    }
};