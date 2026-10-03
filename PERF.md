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
