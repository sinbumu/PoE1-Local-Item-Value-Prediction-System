# Clipboard Sample Format

`Ctrl+C` 원문은 공백, 줄바꿈, 구분선(`--------`)이 모두 의미가 있을 수 있으므로 가공 없이 보관하는 것이 중요하다.

따라서 샘플은 아래 규칙으로 관리하는 것을 권장한다.

## 디렉터리 구조

```text
samples/
  clipboard/
    README.md
    en/
      rare-equipment-001.txt
      rare-equipment-001.meta.json
    ko/
      rare-equipment-001.txt
      rare-equipment-001.meta.json
```

## 파일 규칙

- `.txt`
  - 게임에서 `Ctrl+C` 한 원문을 그대로 저장
  - 편집기 자동 포맷 금지
  - 마지막 줄바꿈은 있어도 되고 없어도 되지만, 본문 내용은 바꾸지 않음
- `.meta.json`
  - 사람이 읽기 쉬운 보조 메타데이터
  - parser 테스트에서 기대값 fixture로도 사용 가능

## 파일명 규칙

`<category>-<nnn>.txt`

예시:

- `rare-equipment-001.txt`
- `unique-equipment-001.txt`
- `cluster-jewel-001.txt`
- `skill-gem-001.txt`
- `awakened-gem-001.txt`
- `vaal-gem-001.txt`

## 권장 수집 세트

- Rare 장비 3~5개
- Unique 장비 3~5개
- 일반 Jewel 2~3개
- Cluster Jewel 2~3개
- Skill Gem / Awakened Gem / Vaal Gem 각 2~3개
- Crafted / Fractured / Influenced 아이템 각 2~3개
- 가능하면 영문(`en`) / 한글(`ko`) 각각

## `.meta.json` 권장 스키마

```json
{
  "id": "rare-equipment-001",
  "locale": "en",
  "category": "rare_equipment",
  "notes": [
    "fractured mod 1개 포함",
    "elder influence 포함"
  ],
  "expected": {
    "rarity": "Rare",
    "baseType": "Hubris Circlet",
    "identified": true,
    "corrupted": false,
    "fractured": true,
    "influences": ["elder"]
  }
}
```

## 저장 시 주의사항

- 계정명, 캐릭터명, 가격 메모 같은 민감 정보는 넣지 않는 것이 좋다
- stash 쿼리 결과가 아니라 반드시 게임 `Ctrl+C` 원문을 기준으로 저장한다
- 아이템 원문과 사람이 적은 해설은 분리한다
- 영문/한글 같은 동일 유형 샘플은 가능한 한 쌍으로 모으면 locale parity 테스트에 유리하다

## 첫 수집 추천 순서

1. `en/rare-equipment-001~003`
2. `ko/rare-equipment-001~003`
3. `en/unique-equipment-001~003`
4. `ko/unique-equipment-001~003`
5. jewel / gem / influenced 케이스 확장
