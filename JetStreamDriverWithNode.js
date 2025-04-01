import * as fs from 'node:fs/promises';
import vm from 'node:vm';

const defaultIterationCount = 120;
const defaultWorstCaseCount = 4;

function assert(b, m = "") {
    if (!b)
        throw new Error("Bad assertion: " + m);
}

function geomean(values) {
    assert(values instanceof Array);
    let product = 1;
    for (let x of values)
        product *= x;
    return product ** (1 / values.length);
}

function toScore(timeValue) {
    return 5000 / Math.max(timeValue, 1);
}

function mean(values) {
    assert(values instanceof Array);
    let sum = 0;
    for (let x of values)
        sum += x;
    return sum / values.length;
}

function processResults(results, worstCaseCount = defaultWorstCaseCount) {
    function copyArray(a) {
        const result = [];
        for (let x of a)
            result.push(x);
        return result;
    }

    results = copyArray(results);

    // this.firstIterationTime = results[0];
    // const firstIterationScore = toScore(results[0]);

    results = results.slice(1);
    results.sort((a, b) => a < b ? 1 : -1);
    for (let i = 0; i + 1 < results.length; ++i)
        assert(results[i] >= results[i + 1]);

    const worstCase = [];
    for (let i = 0; i < worstCaseCount; ++i)
        worstCase.push(results[i]);

    // console.log("Worst Case: ", worstCase, results);

    const worst4Time = mean(worstCase);
    const worst4Score = toScore(worst4Time);
    const averageTime = mean(results);
    const averageScore = toScore(averageTime);
    const score = geomean([results[0], worst4Score, averageScore]);

    // console.log("Score: ", {
    //     "First": toScore(results[0]),
    //     "Worst": toScore(worst4Time),
    //     "Average": toScore(averageTime)
    // });

    return {
        "First": toScore(results[0]),
        "Worst": toScore(worst4Time),
        "Average": toScore(averageTime),
        "score": score
    }
}

const ARESGroup = Symbol.for("ARES");
const CDJSGroup = Symbol.for("CDJS");
const CodeLoadGroup = Symbol.for("CodeLoad");
const LuaJSFightGroup = Symbol.for("LuaJSFight");
const OctaneGroup = Symbol.for("Octane");
const RexBenchGroup = Symbol.for("RexBench");
const SeaMonsterGroup = Symbol.for("SeaMonster");
const SimpleGroup = Symbol.for("Simple");
const SunSpiderGroup = Symbol.for("SunSpider");
const WasmGroup = Symbol.for("Wasm");
const WorkerTestsGroup = Symbol.for("WorkerTests");
const WSLGroup = Symbol.for("WSL");
const WTBGroup = Symbol.for("WTB");

//JETSTREAM2.2
const BENCHMARKS = [
    // ARES
    {
        name: "Air",
        files: [
            "./ARES-6/Air/symbols.js"
            , "./ARES-6/Air/tmp_base.js"
            , "./ARES-6/Air/arg.js"
            , "./ARES-6/Air/basic_block.js"
            , "./ARES-6/Air/code.js"
            , "./ARES-6/Air/frequented_block.js"
            , "./ARES-6/Air/inst.js"
            , "./ARES-6/Air/opcode.js"
            , "./ARES-6/Air/reg.js"
            , "./ARES-6/Air/stack_slot.js"
            , "./ARES-6/Air/tmp.js"
            , "./ARES-6/Air/util.js"
            , "./ARES-6/Air/custom.js"
            , "./ARES-6/Air/liveness.js"
            , "./ARES-6/Air/insertion_set.js"
            , "./ARES-6/Air/allocate_stack.js"
            , "./ARES-6/Air/payload-gbemu-executeIteration.js"
            , "./ARES-6/Air/payload-imaging-gaussian-blur-gaussianBlur.js"
            , "./ARES-6/Air/payload-airjs-ACLj8C.js"
            , "./ARES-6/Air/payload-typescript-scanIdentifier.js"
            , "./ARES-6/Air/benchmark.js"
        ],
        testGroup: ARESGroup
    },
    {
        name: "Basic",
        files: [
            "./ARES-6/Basic/ast.js"
            , "./ARES-6/Basic/basic.js"
            , "./ARES-6/Basic/caseless_map.js"
            , "./ARES-6/Basic/lexer.js"
            , "./ARES-6/Basic/number.js"
            , "./ARES-6/Basic/parser.js"
            , "./ARES-6/Basic/random.js"
            , "./ARES-6/Basic/state.js"
            , "./ARES-6/Basic/util.js"
            , "./ARES-6/Basic/benchmark.js"
        ],
        testGroup: ARESGroup
    },
    {
        name: "ML",
        files: [
            "./ARES-6/ml/index.js"
            , "./ARES-6/ml/benchmark.js"
        ],
        iterations: 60,
        testGroup: ARESGroup
    },
    {
        name: "Babylon",
        files: [
            "./ARES-6/Babylon/index.js"
            , "./ARES-6/Babylon/benchmark.js"
        ],
        preload: {
            airBlob: "./ARES-6/Babylon/air-blob.js",
            basicBlob: "./ARES-6/Babylon/basic-blob.js",
            inspectorBlob: "./ARES-6/Babylon/inspector-blob.js",
            babylonBlob: "./ARES-6/Babylon/babylon-blob.js"
        },
        testGroup: ARESGroup
    },
    // CDJS
    {
        name: "cdjs",
        files: [
            "./cdjs/constants.js"
            , "./cdjs/util.js"
            , "./cdjs/red_black_tree.js"
            , "./cdjs/call_sign.js"
            , "./cdjs/vector_2d.js"
            , "./cdjs/vector_3d.js"
            , "./cdjs/motion.js"
            , "./cdjs/reduce_collision_set.js"
            , "./cdjs/simulator.js"
            , "./cdjs/collision.js"
            , "./cdjs/collision_detector.js"
            , "./cdjs/benchmark.js"
        ],
        iterations: 60,
        worstCaseCount: 3,
        testGroup: CDJSGroup
    },
    // CodeLoad
    {
        name: "first-inspector-code-load",
        files: [
            "./code-load/code-first-load.js"
        ],
        preload: {
            inspectorPayloadBlob: "./code-load/inspector-payload-minified.js"
        },
        testGroup: CodeLoadGroup
    },
    {
        name: "multi-inspector-code-load",
        files: [
            "./code-load/code-multi-load.js"
        ],
        preload: {
            inspectorPayloadBlob: "./code-load/inspector-payload-minified.js"
        },
        testGroup: CodeLoadGroup
    },
    // Octane
    {
        name: "Box2D",
        files: [
            "./Octane/box2d.js"
        ],
        deterministicRandom: true,
        testGroup: OctaneGroup
    },
    {
        name: "octane-code-load",
        files: [
            "./Octane/code-first-load.js"
        ],
        deterministicRandom: true,
        testGroup: OctaneGroup
    },
    {
        name: "crypto",
        files: [
            "./Octane/crypto.js"
        ],
        deterministicRandom: true,
        testGroup: OctaneGroup
    },
    {
        name: "delta-blue",
        files: [
            "./Octane/deltablue.js"
        ],
        deterministicRandom: true,
        testGroup: OctaneGroup
    },
    {
        name: "earley-boyer",
        files: [
            "./Octane/earley-boyer.js"
        ],
        deterministicRandom: true,
        testGroup: OctaneGroup
    },
    {
        name: "gbemu",
        files: [
            "./Octane/gbemu-part1.js"
            , "./Octane/gbemu-part2.js"
        ],
        deterministicRandom: true,
        testGroup: OctaneGroup
    },
    {
        name: "mandreel",
        files: [
            "./Octane/mandreel.js"
        ],
        iterations: 80,
        deterministicRandom: true,
        testGroup: OctaneGroup
    },
    {
        name: "navier-stokes",
        files: [
            "./Octane/navier-stokes.js"
        ],
        deterministicRandom: true,
        testGroup: OctaneGroup
    },
    {
        name: "pdfjs",
        files: [
            "./Octane/pdfjs.js"
        ],
        deterministicRandom: true,
        testGroup: OctaneGroup
    },
    {
        name: "raytrace",
        files: [
            "./Octane/raytrace.js"
        ],
        deterministicRandom: true,
        testGroup: OctaneGroup
    },
    {
        name: "regexp",
        files: [
            "./Octane/regexp.js"
        ],
        deterministicRandom: true,
        testGroup: OctaneGroup
    },
    {
        name: "richards",
        files: [
            "./Octane/richards.js"
        ],
        deterministicRandom: true,
        testGroup: OctaneGroup
    },
    {
        name: "splay",
        files: [
            "./Octane/splay.js"
        ],
        deterministicRandom: true,
        testGroup: OctaneGroup
    },
    {
        name: "typescript",
        files: [
            "./Octane/typescript-compiler.js"
            , "./Octane/typescript-input.js"
            , "./Octane/typescript.js"
        ],
        iterations: 15,
        worstCaseCount: 2,
        deterministicRandom: true,
        testGroup: OctaneGroup
    },
    {
        name: "octane-zlib",
        files: [
            "./Octane/zlib-data.js"
            , "./Octane/zlib.js"
        ],
        iterations: 15,
        worstCaseCount: 2,
        deterministicRandom: true,
        testGroup: OctaneGroup
    },
    // RexBench
    {
        name: "FlightPlanner",
        files: [
            "./RexBench/FlightPlanner/airways.js"
            , "./RexBench/FlightPlanner/waypoints.js"
            , "./RexBench/FlightPlanner/flight_planner.js"
            , "./RexBench/FlightPlanner/expectations.js"
            , "./RexBench/FlightPlanner/benchmark.js"
        ],
        testGroup: RexBenchGroup
    },
    {
        name: "OfflineAssembler",
        files: [
            "./RexBench/OfflineAssembler/registers.js"
            , "./RexBench/OfflineAssembler/instructions.js"
            , "./RexBench/OfflineAssembler/ast.js"
            , "./RexBench/OfflineAssembler/parser.js"
            , "./RexBench/OfflineAssembler/file.js"
            , "./RexBench/OfflineAssembler/LowLevelInterpreter.js"
            , "./RexBench/OfflineAssembler/LowLevelInterpreter32_64.js"
            , "./RexBench/OfflineAssembler/LowLevelInterpreter64.js"
            , "./RexBench/OfflineAssembler/InitBytecodes.js"
            , "./RexBench/OfflineAssembler/expected.js"
            , "./RexBench/OfflineAssembler/benchmark.js"
        ],
        iterations: 80,
        testGroup: RexBenchGroup
    },
    {
        name: "UniPoker",
        files: [
            "./RexBench/UniPoker/poker.js"
            , "./RexBench/UniPoker/expected.js"
            , "./RexBench/UniPoker/benchmark.js"
        ],
        deterministicRandom: true,
        testGroup: RexBenchGroup
    },
    // Simple
    {
        name: "async-fs",
        files: [
            "./simple/file-system.js"
        ],
        iterations: 40,
        worstCaseCount: 3,
        testGroup: SimpleGroup
    },
    {
        name: "float-mm.c",
        files: [
            "./simple/float-mm.c.js"
        ],
        iterations: 15,
        worstCaseCount: 2,
        testGroup: SimpleGroup
    },
    {
        name: "hash-map",
        files: [
            "./simple/hash-map.js"
        ],
        testGroup: SimpleGroup
    },
    // SeaMonster
    {
        name: "ai-astar",
        files: [
            "./SeaMonster/ai-astar.js"
        ],
        testGroup: SeaMonsterGroup
    },
    {
        name: "gaussian-blur",
        files: [
            "./SeaMonster/gaussian-blur.js"
        ],
        testGroup: SeaMonsterGroup
    },
    {
        name: "stanford-crypto-aes",
        files: [
            "./SeaMonster/sjlc.js"
            , "./SeaMonster/stanford-crypto-aes.js"
        ],
        testGroup: SeaMonsterGroup
    },
    {
        name: "stanford-crypto-pbkdf2",
        files: [
            "./SeaMonster/sjlc.js"
            , "./SeaMonster/stanford-crypto-pbkdf2.js"
        ],
        testGroup: SeaMonsterGroup
    },
    {
        name: "stanford-crypto-sha256",
        files: [
            "./SeaMonster/sjlc.js"
            , "./SeaMonster/stanford-crypto-sha256.js"
        ],
        testGroup: SeaMonsterGroup
    },
    {
        name: "json-stringify-inspector",
        files: [
            "./SeaMonster/inspector-json-payload.js"
            , "./SeaMonster/json-stringify-inspector.js"
        ],
        iterations: 20,
        worstCaseCount: 2,
        testGroup: SeaMonsterGroup
    },
    {
        name: "json-parse-inspector",
        files: [
            "./SeaMonster/inspector-json-payload.js"
            , "./SeaMonster/json-parse-inspector.js"
        ],
        iterations: 20,
        worstCaseCount: 2,
        testGroup: SeaMonsterGroup
    },
    // Wasm
    {
        name: "HashSet-wasm",
        wasmPath: "./wasm/HashSet.wasm",
        files: [
            "./wasm/HashSet.js"
        ],
        preload: {
            wasmBlobURL: "./wasm/HashSet.wasm"
        },
        testGroup: WasmGroup
    },
    {
        name: "tsf-wasm",
        wasmPath: "./wasm/tsf.wasm",
        files: [
            "./wasm/tsf.js"
        ],
        preload: {
            wasmBlobURL: "./wasm/tsf.wasm"
        },
        testGroup: WasmGroup
    },
    {
        name: "quicksort-wasm",
        wasmPath: "./wasm/quicksort.wasm",
        files: [
            "./wasm/quicksort.js"
        ],
        preload: {
            wasmBlobURL: "./wasm/quicksort.wasm"
        },
        testGroup: WasmGroup
    },
    {
        name: "gcc-loops-wasm",
        wasmPath: "./wasm/gcc-loops.wasm",
        files: [
            "./wasm/gcc-loops.js"
        ],
        preload: {
            wasmBlobURL: "./wasm/gcc-loops.wasm"
        },
        testGroup: WasmGroup
    },
    {
        name: "richards-wasm",
        wasmPath: "./wasm/richards.wasm",
        files: [
            "./wasm/richards.js"
        ],
        preload: {
            wasmBlobURL: "./wasm/richards.wasm"
        },
        testGroup: WasmGroup
    },
    // WorkerTests
    {
        name: "bomb-workers",
        files: [
            "./worker/bomb.js"
        ],
        iterations: 80,
        preload: {
            rayTrace3D: "./worker/bomb-subtests/3d-raytrace.js"
            , accessNbody: "./worker/bomb-subtests/access-nbody.js"
            , morph3D: "./worker/bomb-subtests/3d-morph.js"
            , cube3D: "./worker/bomb-subtests/3d-cube.js"
            , accessFunnkuch: "./worker/bomb-subtests/access-fannkuch.js"
            , accessBinaryTrees: "./worker/bomb-subtests/access-binary-trees.js"
            , accessNsieve: "./worker/bomb-subtests/access-nsieve.js"
            , bitopsBitwiseAnd: "./worker/bomb-subtests/bitops-bitwise-and.js"
            , bitopsNsieveBits: "./worker/bomb-subtests/bitops-nsieve-bits.js"
            , controlflowRecursive: "./worker/bomb-subtests/controlflow-recursive.js"
            , bitops3BitBitsInByte: "./worker/bomb-subtests/bitops-3bit-bits-in-byte.js"
            , botopsBitsInByte: "./worker/bomb-subtests/bitops-bits-in-byte.js"
            , cryptoAES: "./worker/bomb-subtests/crypto-aes.js"
            , cryptoMD5: "./worker/bomb-subtests/crypto-md5.js"
            , cryptoSHA1: "./worker/bomb-subtests/crypto-sha1.js"
            , dateFormatTofte: "./worker/bomb-subtests/date-format-tofte.js"
            , dateFormatXparb: "./worker/bomb-subtests/date-format-xparb.js"
            , mathCordic: "./worker/bomb-subtests/math-cordic.js"
            , mathPartialSums: "./worker/bomb-subtests/math-partial-sums.js"
            , mathSpectralNorm: "./worker/bomb-subtests/math-spectral-norm.js"
            , stringBase64: "./worker/bomb-subtests/string-base64.js"
            , stringFasta: "./worker/bomb-subtests/string-fasta.js"
            , stringValidateInput: "./worker/bomb-subtests/string-validate-input.js"
            , stringTagcloud: "./worker/bomb-subtests/string-tagcloud.js"
            , stringUnpackCode: "./worker/bomb-subtests/string-unpack-code.js"
            , regexpDNA: "./worker/bomb-subtests/regexp-dna.js"
        },
        testGroup: WorkerTestsGroup
    },
    {
        name: "segmentation",
        files: [
            "./worker/segmentation.js"
        ],
        preload: {
            asyncTaskBlob: "./worker/async-task.js"
        },
        iterations: 36,
        worstCaseCount: 3,
        testGroup: WorkerTestsGroup
    },
    // WSL
    {
        name: "WSL",
        files: ["./WSL/Node.js", "./WSL/Type.js", "./WSL/ReferenceType.js", "./WSL/Value.js", "./WSL/Expression.js", "./WSL/Rewriter.js", "./WSL/Visitor.js", "./WSL/CreateLiteral.js", "./WSL/CreateLiteralType.js", "./WSL/PropertyAccessExpression.js", "./WSL/AddressSpace.js", "./WSL/AnonymousVariable.js", "./WSL/ArrayRefType.js", "./WSL/ArrayType.js", "./WSL/Assignment.js", "./WSL/AutoWrapper.js", "./WSL/Block.js", "./WSL/BoolLiteral.js", "./WSL/Break.js", "./WSL/CallExpression.js", "./WSL/CallFunction.js", "./WSL/Check.js", "./WSL/CheckLiteralTypes.js", "./WSL/CheckLoops.js", "./WSL/CheckRecursiveTypes.js", "./WSL/CheckRecursion.js", "./WSL/CheckReturns.js", "./WSL/CheckUnreachableCode.js", "./WSL/CheckWrapped.js", "./WSL/Checker.js", "./WSL/CloneProgram.js", "./WSL/CommaExpression.js", "./WSL/ConstexprFolder.js", "./WSL/ConstexprTypeParameter.js", "./WSL/Continue.js", "./WSL/ConvertPtrToArrayRefExpression.js", "./WSL/DereferenceExpression.js", "./WSL/DoWhileLoop.js", "./WSL/DotExpression.js", "./WSL/DoubleLiteral.js", "./WSL/DoubleLiteralType.js", "./WSL/EArrayRef.js", "./WSL/EBuffer.js", "./WSL/EBufferBuilder.js", "./WSL/EPtr.js", "./WSL/EnumLiteral.js", "./WSL/EnumMember.js", "./WSL/EnumType.js", "./WSL/EvaluationCommon.js", "./WSL/Evaluator.js", "./WSL/ExpressionFinder.js", "./WSL/ExternalOrigin.js", "./WSL/Field.js", "./WSL/FindHighZombies.js", "./WSL/FlattenProtocolExtends.js", "./WSL/FlattenedStructOffsetGatherer.js", "./WSL/FloatLiteral.js", "./WSL/FloatLiteralType.js", "./WSL/FoldConstexprs.js", "./WSL/ForLoop.js", "./WSL/Func.js", "./WSL/FuncDef.js", "./WSL/FuncInstantiator.js", "./WSL/FuncParameter.js", "./WSL/FunctionLikeBlock.js", "./WSL/HighZombieFinder.js", "./WSL/IdentityExpression.js", "./WSL/IfStatement.js", "./WSL/IndexExpression.js", "./WSL/InferTypesForCall.js", "./WSL/Inline.js", "./WSL/Inliner.js", "./WSL/InstantiateImmediates.js", "./WSL/IntLiteral.js", "./WSL/IntLiteralType.js", "./WSL/Intrinsics.js", "./WSL/LateChecker.js", "./WSL/Lexer.js", "./WSL/LexerToken.js", "./WSL/LiteralTypeChecker.js", "./WSL/LogicalExpression.js", "./WSL/LogicalNot.js", "./WSL/LoopChecker.js", "./WSL/MakeArrayRefExpression.js", "./WSL/MakePtrExpression.js", "./WSL/NameContext.js", "./WSL/NameFinder.js", "./WSL/NameResolver.js", "./WSL/NativeFunc.js", "./WSL/NativeFuncInstance.js", "./WSL/NativeType.js", "./WSL/NativeTypeInstance.js", "./WSL/NormalUsePropertyResolver.js", "./WSL/NullLiteral.js", "./WSL/NullType.js", "./WSL/OriginKind.js", "./WSL/OverloadResolutionFailure.js", "./WSL/Parse.js", "./WSL/Prepare.js", "./WSL/Program.js", "./WSL/ProgramWithUnnecessaryThingsRemoved.js", "./WSL/PropertyResolver.js", "./WSL/Protocol.js", "./WSL/ProtocolDecl.js", "./WSL/ProtocolFuncDecl.js", "./WSL/ProtocolRef.js", "./WSL/PtrType.js", "./WSL/ReadModifyWriteExpression.js", "./WSL/RecursionChecker.js", "./WSL/RecursiveTypeChecker.js", "./WSL/ResolveNames.js", "./WSL/ResolveOverloadImpl.js", "./WSL/ResolveProperties.js", "./WSL/ResolveTypeDefs.js", "./WSL/Return.js", "./WSL/ReturnChecker.js", "./WSL/ReturnException.js", "./WSL/StandardLibrary.js", "./WSL/StatementCloner.js", "./WSL/StructLayoutBuilder.js", "./WSL/StructType.js", "./WSL/Substitution.js", "./WSL/SwitchCase.js", "./WSL/SwitchStatement.js", "./WSL/SynthesizeEnumFunctions.js", "./WSL/SynthesizeStructAccessors.js", "./WSL/TrapStatement.js", "./WSL/TypeDef.js", "./WSL/TypeDefResolver.js", "./WSL/TypeOrVariableRef.js", "./WSL/TypeParameterRewriter.js", "./WSL/TypeRef.js", "./WSL/TypeVariable.js", "./WSL/TypeVariableTracker.js", "./WSL/TypedValue.js", "./WSL/UintLiteral.js", "./WSL/UintLiteralType.js", "./WSL/UnificationContext.js", "./WSL/UnreachableCodeChecker.js", "./WSL/VariableDecl.js", "./WSL/VariableRef.js", "./WSL/VisitingSet.js", "./WSL/WSyntaxError.js", "./WSL/WTrapError.js", "./WSL/WTypeError.js", "./WSL/WhileLoop.js", "./WSL/WrapChecker.js", "./WSL/Test.js"],
        testGroup: WSLGroup
    }
];

// LuaJSFight tests
let luaJSFightTests = [
    "hello_world",
    "list_search",
    "lists",
    "string_lists"
];
for (let test of luaJSFightTests) {
    BENCHMARKS.push({
        name: `${test}-LJF`,
        files: [
            `./LuaJSFight/${test}.js`
        ],
        testGroup: LuaJSFightGroup
    });
}

// SunSpider tests
let sunSpiderTests = [
    "3d-cube"
    , "3d-raytrace"
    , "base64"
    , "crypto-aes"
    , "crypto-md5"
    , "crypto-sha1"
    , "date-format-tofte"
    , "date-format-xparb"
    , "n-body"
    , "regex-dna"
    , "string-unpack-code"
    , "tagcloud"
];
for (let test of sunSpiderTests) {
    BENCHMARKS.push({
        name: `${test}-SP`,
        files: [
            `./SunSpider/${test}.js`
        ],
        testGroup: SunSpiderGroup
    });
}

// WTB (Web Tooling Benchmark) tests
let WTBTests = [
    "acorn"
    , "babylon"
    , "chai"
    , "coffeescript"
    , "espree"
    , "jshint"
    , "lebab"
    , "prepack"
    , "uglify-js"
];
for (let name of WTBTests) {
    BENCHMARKS.push({
        name: `${name}-wtb`,
        files: [
            "./web-tooling-benchmark/cli.js",
            `./web-tooling-benchmark/${name}.js`
        ],
        iterations: 5,
        worstCaseCount: 1,
        testGroup: WTBGroup
    });
}

const succeededTests = [];
const failedTests = [];

for (const benchmark of BENCHMARKS) {
    try {
        let combinedCode = 'let performance = {now: Date.now.bind(Date)}\n';

        let context = vm.createContext({});

        if (benchmark.preload) {
            for (const filePath of Object.values(benchmark.preload)) {
                combinedCode += await fs.readFile(filePath, 'utf8') + '\n';
            }
        }

        // Read and concatenate all file contents once
        for (const filePath of benchmark.files) {
            combinedCode += await fs.readFile(filePath, 'utf8') + '\n';
        }

        // Inject a snippet to expose Benchmark class if it exists
        combinedCode += `
            const isInBrowser = false;
            globalThis.performance = {now: Date.now.bind(Date)};\n
            if (typeof Benchmark !== 'undefined') {
                globalThis.Benchmark = Benchmark;
            }
        `;

        if (benchmark.deterministicRandom) {
            combinedCode += `
                Math.random = (function() {
                    var seed = 49734321;
                    return function() {
                        // Robert Jenkins' 32 bit integer hash function.
                        seed = ((seed + 0x7ed55d16) + (seed << 12))  & 0xffffffff;
                        seed = ((seed ^ 0xc761c23c) ^ (seed >>> 19)) & 0xffffffff;
                        seed = ((seed + 0x165667b1) + (seed << 5))   & 0xffffffff;
                        seed = ((seed + 0xd3a2646c) ^ (seed << 9))   & 0xffffffff;
                        seed = ((seed + 0xfd7046c5) + (seed << 3))   & 0xffffffff;
                        seed = ((seed ^ 0xb55a4f09) ^ (seed >>> 16)) & 0xffffffff;
                        return (seed & 0xfffffff) / 0x10000000;
                    };
                })();
            `;
        }

        // Create a new VM context
        context = vm.createContext({globalThis});

        // Execute the combined code to load the classes & functions
        const script = new vm.Script(combinedCode);
        script.runInContext(context);

        // Check if Benchmark is available
        if (!context.globalThis.Benchmark) {
            throw new Error("Benchmark class not found. Check your script execution.");
        }

        const BenchmarkClass = context.globalThis.Benchmark;
        const benchmarkInstance = new BenchmarkClass(benchmark.iterations);

        // Run iterations
        const results = [];

        const numberOfIterations = benchmark.iterations ?? defaultIterationCount;
        console.log("Running Benchmark: ", benchmark.name, "with", numberOfIterations, "iterations");

        for (let i = 0; i < numberOfIterations; i++) {
            if (benchmark.prepareForNextIteration) {
                benchmark.prepareForNextIteration();
            }
            let start = Date.now();
            benchmarkInstance.runIteration();
            let end = Date.now();
            results.push(Math.max(1, end - start));
        }

        const scores = processResults(results, benchmark.worstCaseCount);
        succeededTests.push(benchmark.name);
        console.log(`Scores: ${benchmark.name}`, scores);
        console.log('\n\n');
    } catch (error) {
        console.error(`Error in benchmark "${benchmark.name}":`, error?.toString().substring(0, 100));
        console.log("\n\n");
        failedTests.push(benchmark.name);
    }
}

console.log(`\n\nTotal Succeeded Tests: ${succeededTests.length}`);
console.log(`\n\nSucceeded Tests: ${succeededTests.join(", ")}`);
console.log(`\n\nTotal Failed Tests: ${failedTests.length}`);
console.log(`\n\nFailed Tests: ${failedTests.join(", ")}\n\n`);


