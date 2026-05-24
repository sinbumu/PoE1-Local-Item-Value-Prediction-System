| sample id | type | expected route | notes |
| --- | --- | --- | --- |
| rare-equipment-001 | rare_equipment | model_prediction | classifier route |
| unique-equipment-001 | unique_equipment | model_prediction | classifier route |
| normal-jewel-001 | jewel | model_prediction | regressor route |
| skill-gem-001 | skill_gem | model_prediction | regressor route |
| currency-001 | currency | external_price_lookup_recommended | fallback route |
| map-001 | map | external_price_lookup_recommended | fallback route |
| divination-card-001 | divination_card | external_price_lookup_recommended | fallback route |
| parse-failure-001 | malformed | parse_failed | fallback route |
