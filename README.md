# AI Promise | 기업 AI 약속 검증

회사가 사업보고서에 "AI로 이것을 하겠다"고 쓴 약속을 찾고, 다음 보고서에서 실행 근거를 찾아 **근거 확인 / 일부 확인 / 공시에서 확인 불가 / 회사가 미추진으로 공시**의 4가지로 판정해 보여주는 Codyssey Final Project입니다.

> 핵심 차별점은 공시 요약이 아니라 **Promise → Evidence → Judgment → Citation Verification → Human Evaluation**입니다.

## 현재 범위

- **Core 2**
  - 삼성전자: calibration / development
  - SK하이닉스: blind evaluation
- **최종 제품 목표**: 5개 기업
- **확장 후보**: 현대자동차, LG전자, NAVER
- **약속 보고서**: 2024 사업보고서
- **근거 보고서**: 2025 사업보고서, 2026 반기보고서

추가 기업은 브랜드 인지도만으로 넣지 않고, 실제 공시에서 v2 기준 구체적 AI 약속이 충분히 존재하는지 먼저 확인합니다. 자세한 기준은 [5개 기업 확장 계획](docs/company-expansion-plan.md)을 봐 주세요.

## 시스템 흐름

```text
DART PDF
→ Collect
→ Promise Extraction
→ Specificity Classification
→ Evidence Retrieval
→ LLM Judgment
→ Citation Verification
→ Interview Card
→ Human/ML Evaluation
```

자세한 내용: [아키텍처](docs/architecture.md)

## 저장소 구조

| 폴더 | 내용 | Owner |
| --- | --- | --- |
| `app/` | 웹 화면 4개, 실제 결과 JSON 연결 | 박수민 / Integration: 김성태 |
| `engine/` | 공시 수집, 약속 추출, 검색, 판정, 인용 검사, 면접 카드 | 김성태 |
| `eval/` | Human Ground Truth, AI 평가, 사용자 테스트, ML benchmark | 김성태 / 김서원 |
| `tests/` | API 키 없이 도는 mock end-to-end test | 김성태 |
| `docs/` | 방법론, 배포, 윤리, 제출 증빙, Drive-GitHub 동기화 | 팀 |
| `data/` | 실제 공시와 중간 실행 결과 자리. PDF 원본은 GitHub에 올리지 않음 | |

## 화면

`app/index.html`은 `app/data/results.json`을 먼저 읽고, 없으면 `app/data/sample-data.js`를 사용합니다.

화면:
1. 기업 선택
2. AI 약속 목록
3. 약속-근거 상세
4. 면접 카드

예시 데이터일 때는 화면 상단에 안내 띠가 나타납니다. 최종 심사용 URL에서는 실제 `results.json`이 연결되어야 합니다.

## 엔진 실행

자세한 내용은 [engine/README.md](engine/README.md)를 참고합니다.

```bash
cd engine
python run.py doctor --company samsung
python run.py all --company samsung
python run.py export --companies samsung skhynix --copy-to ../app/data/results.json
python run.py check --file ../app/data/results.json
```

오프라인 mock 점검:

```bash
python tests/test_mock.py
```

## 평가

### Human-AI
- 사람 2명이 AI 결과를 보기 전에 독립 판정
- 사람 간 일치율 + Cohen's kappa
- 합의 Gold Label 생성
- AI Accuracy / Macro-F1 / confusion matrix / 95% Wilson CI
- Citation inclusion / exact-match verification
- Unsupported execution claims
- 비교 coverage와 end-to-end 성능을 함께 해석

삼성전자는 개발 기업, SK하이닉스는 blind evaluation 기업으로 분리합니다.

### 사용자 테스트
- 비대면 화면 공유
- 1인 약 10분
- 서비스 과제와 직접 검색 과제 비교
- 시간, 정답 여부, 이해도, 신뢰도, 면접 활용 의향 기록

자세한 내용: [사용자 테스트 프로토콜](docs/user-test-protocol.md)

### ML Benchmark
제품 본체 안정화 후 5개 기업 약 300문장을 `PROMISE / EVIDENCE / OTHER`로 라벨링해 TF-IDF + Logistic Regression baseline과 LLM을 비교합니다.

자세한 내용: [ML benchmark](eval/ml/README.md)

## AI 윤리·신뢰성

- "AI 워싱", "거짓", "약속 위반"으로 단정하지 않습니다.
- `공시에서 확인 불가`는 분석한 정기공시 범위에서 근거를 못 찾았다는 뜻입니다.
- 약속과 근거 문장은 원문 그대로 보존합니다.
- 근거 기반 판정은 citation verification을 통과해야 합니다.
- 사용자 테스트 개인정보는 GitHub에 저장하지 않습니다.
- 모든 LLM 호출은 실행 로그를 남깁니다.

자세한 내용: [AI 윤리·신뢰성 원칙](docs/ai-ethics.md)

## 팀 역할

- **김성태** — Product / AI Engine / Evaluation / Integration
- **김서원** — Research / Human Validation / User Test
- **박수민** — Frontend / App Implementation / QA
- **서준용** — UX / Visual / Demo / Presentation

협업 규칙: [CONTRIBUTING.md](CONTRIBUTING.md)

## Drive와 GitHub

Drive는 원본 협업 문서와 중간 산출물, GitHub는 실행 코드·버전 고정 방법론·익명 평가 데이터·재현 가능한 결과를 관리합니다.

대응표: [Drive ↔ GitHub 동기화 기준](docs/drive-sync.md)

## 배포

현재 프론트엔드는 빌드가 필요 없는 HTML/CSS/JS 구조이며 Vercel의 Root Directory를 `app`으로 지정해 배포할 수 있습니다.

가이드: [배포 가이드](docs/deploy.md)

## 제출 증빙

현재 참고 중인 6개 평가항목은 공식 문서 확인 전까지 잠정 기준입니다.

체크리스트: [제출 증빙 체크리스트](docs/submission-evidence-checklist.md)

## AI 사용

초기 엔진과 일부 화면 통합 작업에 AI 코딩 도구를 사용했습니다. 실제 실행, 판정기준 설계, Human Ground Truth, 검증과 최종 QA는 팀이 수행합니다. AI 호출 기록은 `data/work/<기업>/llm_log.jsonl`에 남도록 설계되어 있습니다.
