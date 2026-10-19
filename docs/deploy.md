# 배포 가이드

현재 웹은 빌드가 필요 없는 HTML/CSS/JS 구조입니다.

## Vercel
**현재 연결 (10/15 19:29):** 프로젝트 `ai-promise`, Root Directory `app`, 주소 https://ai-promise-six.vercel.app. main에 올리면 이 주소로 다시 배포되고, 다른 브랜치는 Vercel 로그인이 필요한 미리보기 주소로 배포됩니다.

가장 단순한 방법은 Vercel 프로젝트의 **Root Directory를 `app`**으로 지정하는 것입니다.

1. GitHub 저장소 `Sungtae10/ai-promise` 연결
2. Root Directory: `app`
3. Framework Preset: Other
4. Build Command: 비움
5. Output Directory: 비움
6. Deploy

## 실제 데이터 반영
배포 전에 엔진에서 실제 결과를 생성합니다.

```bash
cd engine
python run.py export --companies samsung   # 결과는 data/results/ai_promise_data.json 에만 저장
python run.py check --file ../data/results/ai_promise_data.json
# 사용자 테스트가 끝나고 SK하이닉스 합의 뒤에만: python run.py export --companies samsung skhynix --copy-to ../app/data/results.json
```

`results.json`이 없으면 화면은 예시 데이터로 fallback합니다. 최종 심사용 URL에서는 반드시 화면 상단에 '예시 데이터' 띠가 없는지 확인합니다.

## 배포 QA
- [ ] 기업 선택
- [ ] 약속 목록
- [ ] 약속 상세
- [ ] DART 원문 링크
- [ ] 면접 카드
- [ ] 모바일 화면
- [ ] 다크/라이트 모드
- [ ] 실제 데이터 고지문구


## OpenDART 실시간 기업 검색

Final v6는 미리 분석된 기업 카드만 보여 주는 대신, **OpenDART 전체 기업 코드에서 회사명을 검색**하고 해당 기업의 정기공시 준비도를 확인할 수 있습니다.

Vercel 프로젝트에 아래 환경변수 1개를 추가합니다.

```text
OPENDART_API_KEY=<OpenDART 인증키>
```

`DART_API_KEY` 이름도 fallback으로 읽지만, 제출본은 `OPENDART_API_KEY` 사용을 권장합니다.

Vercel:
1. Project → Settings → Environment Variables
2. Name: `OPENDART_API_KEY`
3. Value: 본인 OpenDART 인증키
4. Production / Preview / Development 중 필요한 환경에 체크
5. 저장 후 Redeploy

키는 GitHub, README, 화면, Google Drive에 올리지 않습니다.

### API
- `GET /api/dart-company-search?q=현대자동차`
  - OpenDART 전체 기업코드 목록에서 회사명 검색
- `GET /api/dart-company-search?corp_code=<8자리 코드>`
  - 2024 사업보고서 / 2025 사업보고서 / 2026 반기보고서 존재 여부와 최근 정기공시 표시

### 기능 범위
- **Universal Discovery**: OpenDART 등록 기업 검색 → 실시간
- **Disclosure Readiness**: AI Promise 분석에 필요한 정기공시가 있는지 확인 → 실시간
- **Verified Deep Analysis**: 약속→근거 RAG 판정과 Citation Verification → 검증 완료 기업부터 제공

따라서 실제 deep-analysis 결과가 없는 회사에 대해 분석 완료라고 표시하지 않습니다.
