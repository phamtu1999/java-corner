# Library performance

Measured on 2026-10-03 with three samples per version. These are controlled
local measurements, not production Core Web Vitals or a promise for every device.

| Change | Before (median) | After (median) | Decision |
| --- | ---: | ---: | --- |
| Unblock page parsing and cached-library search from Java loading | Search ready 2,689 ms | 175 ms | Keep |
| Read game metadata in batches of four | 217 ms | 60 ms | Keep |

The browser comparison uses the actual page and launcher with a mock Java
loader delayed by 2 seconds, a 500 ms mock initialization and identical
100 ms account responses. Full Java readiness remains approximately 2.7 seconds
in both versions. Metadata measurements use 40 games and 5 ms per storage read.
No storage reads, configuration, ownership filtering or save operations are skipped.

Cached metadata remains scoped to the signed-in account. Search, sorting and
play links can be used during loading; settings, selection, storage measurement
and save writes wait for the live Java library. Fresh metadata replaces the cache.

`tests/library-performance.test.js` guards browsing before Java finishes, loader
failure handling, metadata/order preservation and the limit of 20 concurrent
file reads. Browser-local User Timing marks `library.search-ready`,
`library.preview-rendered` and `library.ready` support checking actual loads in
DevTools; they transmit no telemetry. Production p75/RUM has not been measured.

Benchmark fixtures and raw samples are retained locally in
`reports/library-performance/` (ignored by Git).

## Community game startup

Direct `/library?game=…` navigation now resolves game/account metadata while
Java starts. When that account's valid preview lists no installed copy, the JAR
download also starts immediately. An installed or unknown preview defers the
download until the live Java file check. Installation and save synchronization
still complete before player navigation, and a live installed JAR takes priority
over stale preview data. Early request failures are settled and shown by the
existing retry flow rather than becoming unhandled rejections.

Three controlled Node samples with 300 ms runtime startup, 30 ms metadata and
200 ms download give median **531 ms before / 300 ms after** for these independent
pre-installation stages. This measures overlapping waits, not real Java startup
or time until a game is playable. Two production HTTP samples for the screenshot's
1,294,797-byte JAR took 1.98 s and 1.33 s; network throughput remains a limit.
Raw controlled samples are in `reports/library-performance/game-preload.json`.

`tests/community-preload.test.js` covers account-scoped lookup, byte reuse,
permission/network errors, inconclusive cache fallback and live installed-file
checks. `tests/library-performance.test.js` checks that direct navigation begins
preparation before Java loading.

## Installed game startup

The player now fetches the Java loader concurrently with account profile
restoration instead of blocking HTML parsing first. Preference modules still
wait for the restored profile. MIDI initialization overlaps Java initialization;
both finish before the emulator library or game starts. Community permission
checks and local installed-file checks remain in place.

Three controlled samples for independent waits (loader 300 ms, profile 100 ms,
MIDI 200 ms, Java 300 ms) give median **902 ms serial / 600 ms overlapping**.
These synthetic timings demonstrate the removed waits; they exclude actual
module imports, authorization, JAR reads and game startup. They are not a
production time-to-play claim. Raw samples are retained in
`reports/library-performance/player-startup.json`.

`tests/player-startup.test.js` uses deferred promises against the entry and
initialization code to verify overlap, restoration before preference imports,
and Java/MIDI readiness before any game execution.

## Cached list recovery

The preview validator previously rejected the entire cached list if one icon
was not an explicitly typed image data URL. The live Java icon reader uses a
FileReader on filesystem Blobs, which may not carry an image MIME type. Cached
PNG data with an absent or binary MIME type is now normalized to `image/png`;
other unsupported icons get a local placeholder without hiding game names.
Both existing cache reads and future writes are normalized. Account isolation
and the live Java storage refresh remain unchanged.

Regression checks reproduce a binary PNG icon in the actual startup preview
reader and verify that the cached list appears while the Java loader is still
unresolved. Additional checks cover malformed icons and unavailable storage.
This is a cache recovery fix, not a measured production latency claim; a first
visit without cached metadata must still wait for the Java filesystem.
