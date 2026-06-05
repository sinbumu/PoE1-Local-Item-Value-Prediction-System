| setting_or_case | actual_value | human_readable | notes |
| --- | --- | --- | --- |
| POLL_INTERVAL_MS | 10000 ms | 10 seconds | src/config/env.ts default. Runtime can override with env var POLL_INTERVAL_MS. |
| active_success_delay_ms | 1000 ms | 1 second | src/services/collector.service.ts uses 1000ms when filtered stashCount > 0. |
| empty_success_delay_ms | env.POLL_INTERVAL_MS | default 10000 ms | Used when filtered stashCount === 0. |
| error_delay_ms | env.POLL_INTERVAL_MS | default 10000 ms | Used after collector cycle failure. |
| COLLECTOR_EXCHANGE_RATE_INTERVAL_MS | 900000 ms | 15 minutes | poe.ninja exchange rate snapshot interval default. |
