# App Dev md


```markdown
# **App Development Summary Tables**

## **1\) Application Development Use Cases (Storyboard View)**

| Lane / Scene | Scene 01 — 고객 요청 생성 | Scene 02 — 요청 검토/생성 처리 | Scene 03 — 제안 확인 & 예약금 결제 | Scene 04 — 결제 후 상태 동기화 |
| ----- | ----- | ----- | ----- | ----- |
| **Actions (User/Baker)** | 고객이 임베드 UI에서 사이즈·스타일팩 선택 → 텍스트/영감 이미지 업로드 → “생성” 요청 제출 | 워커가 제안안 3종 생성(제약/정책 가드 적용) | 고객이 선호안 1개 선택 → 결제(예약금) 진행 | QBO 결제 완료 → 상태 동기화 → 관리자 알림 |
| **Application Logic** | 입력 검증(사이즈·스타일팩 미선택 시 차단), 업로드 서명 URL 발급, 요청 생성(202) 및 큐 등록 | 비동기 작업 실행(LoRA/ControlNet/Negative 프롬프트), R2 저장, 콜백으로 Proposal upsert, 현실성/정책 룰 평가 및 배지 생성 | 선택 멱등 처리, QBO 결제 링크 생성·노출·이메일 전송, 폴링/웹훅 대기 | 웹훅 HMAC 검증, 요청 상태 `DEPOSIT_PAID/FAILED/VOID` 업데이트, 감사 로그 기록 |
| **System** | Next.js App Router(API), Supabase, R2, Upstash QStash | Cloud Run \+ FastAPI \+ Diffusers, R2, Supabase | Next.js(API, Node runtime), QBO API, SendGrid | Next.js(API, Node runtime), QBO Webhook, Supabase |
| **Required Data** | StylePack, SizeCategory, 사용자 입력/이미지, 동의 플래그 | Request, Proposal(3안), RulesReality, LogsAudit | Proposal 선택, 금액 산식, 고객 연락처 | QBO invoice/payment id, 결제 상태, 감사 로그 |

---

## **2\) Development Styles by Tier**

| Three-Tier Architecture | Extension Style | 적용 범위(본 프로젝트) |
| ----- | ----- | ----- |
| **Presentation Tier** | User Interface Extension / New User Interface / Form & E-mail | 임베드 고객 UI, 관리자 콘솔, 모달/스텝퍼 폼, 결제 링크 표시, 이메일 템플릿 |
| **Application Tier** | Business Logic Extension | 멱등성/레이트리밋, 큐 등록/재시도, 생성 파이프라인, 현실성/정책 룰, 결제 링크 생성, 웹훅 검증 |
| **Data Tier** | Data Model Extension | ERD(StylePack, SizeCategory, Request, Proposal, RulesReality, LogsAudit), 인덱스/보관 정책 |

---

## **3\) Development Tasks by Style**

### **Presentation Tier**

| ID | Extension Style | Extension Task |
| ----- | ----- | ----- |
| P01 | User Interface Extension | 임베드 랜딩/스텝퍼(사이즈→스타일→입력→검토) 구성 |
| P02 | New User Interface | 제안 카드(3안) UI \+ 현실성/정책 배지 |
| P03 | Form | 다중 업로더(서명 URL, 진행률, 썸네일), 접근성(ARIA/키보드) |
| P04 | E-mail | 예약금 안내/리마인더 템플릿, 발송 변수(제안/금액/링크) |
| P05 | New User Interface | 관리자 콘솔(스타일팩/사이즈/요청·결제 상태) |

### **Application Tier**

| ID | Extension Style | Extension Task |
| ----- | ----- | ----- |
| A01 | Business Logic Extension | 멱등성/레이트리밋/Correlation-ID 미들웨어 |
| A02 | Business Logic Extension | 이미지 업로드 보안(MIME+Magic, 20MB/100MB) & EXIF 제거 파이프 |
| A03 | Business Logic Extension | 생성 파이프라인(LoRA/ControlNet/Negative) \+ R2 저장 \+ 콜백 |
| A04 | Business Logic Extension | 현실성/정책 룰 평가 → 배지/LogsAudit 기록 |
| A05 | Business Logic Extension | 결제 링크 생성(QBO) \+ 이메일 발송(SendGrid) |
| A06 | Business Logic Extension | 웹훅 HMAC+Timestamp+Nonce 검증 및 상태 업데이트 |
| A07 | Business Logic Extension | 모니터링/알람(지표, DLQ, 장애 배너) |

### **Data Tier**

| ID | Extension Style | Extension Task |
| ----- | ----- | ----- |
| D01 | Data Model Extension | 핵심 스키마 설계/마이그레이션(ERD 6테이블) |
| D02 | Data Model Extension | 인덱스 최적화/보관(180일 삭제 배치)/감사로그 |

---

## **4\) Tasks → Technical Building Blocks & Reasoning**

| ID | Technical Extension Building Block | Reasoning (Why) |
| ----- | ----- | ----- |
| **P01** | Next.js(App Router, React, Tailwind, shadcn/ui), Wix Embed | iFrame 임베드에 최적, SSR/CSR 혼합, 빠른 UI 조립 |
| **P02** | Card/Grid 컴포넌트, Badge/Chip, Skeleton 로딩 | 3안 비교 가독성, 상태 신뢰도/정책 배지 노출 |
| **P03** | R2 서명 URL \+ PUT, 파일 타입 검사, A11y 패턴 | 대용량 이미지 안전 업로드/접근성 보장 |
| **P04** | SendGrid Dynamic Templates | 변수 기반 메일, 전달 신뢰도 |
| **P05** | Next.js Admin UI \+ Supabase | 운영자가 규칙/데이터를 직접 관리 |
| **A01** | Upstash RateLimit, Redis, Idempotency-Key 저장 | 재시도/중복 방지, 남용 보호 |
| **A02** | file-type 검사, Pillow/ExifTool, 1600px 변환 | 보안/품질 표준화, 불필요 메타 제거 |
| **A03** | Cloud Run \+ FastAPI \+ Diffusers, QStash | 확장성/비동기, 모델 교체 용이 |
| **A04** | RulesReality 테이블 \+ 배지 생성 로직 | 제작 가능성/정책 준수 자동화 |
| **A05** | QBO Payment Link API (또는 PG 대안 고려) \+ SendGrid | 회계 동기화/예약금 UX, 대안 PG로 전환 가능성 |
| **A06** | Node runtime 라우트, HMAC+Timestamp+Nonce 검증 | 위변조/리플레이 방지, 감사 가능 |
| **A07** | Vercel Log Drain, Cloud Run Metrics, 알림(Slack) | p95/에러/웹훅 지연 감지/대응 |
| **D01** | Supabase(PostgreSQL) \+ Drizzle/Prisma(선택) | 타입 안전/확장성, 실시간 구독 가능 |
| **D02** | 파티셔닝/인덱스, 스케줄러(Cron) | 조회 성능/비용 관리/규정 준수 |

```