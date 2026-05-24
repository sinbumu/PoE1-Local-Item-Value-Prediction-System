| check | dev mode expectation | packaged mode expectation | notes |
| --- | --- | --- | --- |
| model_manifest.json | desktop/models/v2_mvp/model_manifest.json exists | resources/models/v2_mvp/model_manifest.json exists | 필수 |
| model files | desktop/models/v2_mvp subfolders exist | resources/models/v2_mvp subfolders exist | classifier/regressor artifact |
| Python executable | ml/.venv or POE_VALUE_APP_PYTHON or system python | resources/python/python.exe or Scripts/python.exe | Windows packaged smoke test 필수 |
| Python packages | catboost/pandas import OK | embedded runtime import OK | 한글 stdout UTF-8 적용 |
| feature builder | dist module or npm fallback | resources/dist module | packaged mode에서 npm/tsx 불필요 |
| npm | required for dev mode | not required at runtime | packaged Run Check는 not required 처리 |
