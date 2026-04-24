| setting | value | notes |
| --- | --- | --- |
| target_league | Mirage | exact match filtering |
| poe_realm | pc | default runtime realm |
| resume_strategy | collector_state + next_change_id | restart-safe tailing |
| poll_interval_ms |  | collector loop interval |
| exchange_rate_interval_ms | 900000 | collector-side snapshot tick |
| raw_retention_hours | 24 | short-lived raw retention |
| normalized_retention_hours | 168 | stale listing cleanup window |
