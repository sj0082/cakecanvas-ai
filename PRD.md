# PRD

고정하기: No
프로젝트: ASC 3-Builder Track (https://www.notion.so/ASC-3-Builder-Track-29ede782122380f48afdc47d6f7976c0?pvs=21)
연결된 노트: TRD (https://www.notion.so/TRD-29ede78212238029b8f5d4fafd514ec5?pvs=21)

```markdown

# AI 케이크 디자인 서비스 PRD (Lovable‑Ready)

## 0. 한눈 요약 (Executive One‑Pager)
- **문제**: 인스타 DM/전화로 시작되는 비구조화 상담 → 긴 리드타임, 낮은 전환율, 가격·스타일 불일치.
- **해결**: 사이트 임베드(Lovable)에서 **StylePack 기반 AI 제안 3종** 생성 → 고객이 선호안 선택 → **예약금 온라인 결제** → 관리자 대시보드에서 진행.
- **대상**: 구매 고객(행사용 케이크), 관리자/베이커(스타일·사이즈·가격·리드타임 소유).
- **핵심 KPI(MVP)**: 제안 완료율 ≥ 60%, 결제 전환율 ≥ 25%, 초기 상담 시간 50%↓.
- **핵심 제약**: 디자인은 **StylePack(판매자 정의 범위)** 를 **하드 제약**으로 준수. 고객 입력은 **소프트 제약**.
- **범위(MVP)**: 임베드 UX, 제안 3종, 예약금 결제, 상태 동기화, 이메일/알림, 기본 대시보드.

---

## 1. 배경·목표·원칙
### 1.1 배경
- 고객 니즈가 이미지/문장 단위로 비정형 유입 → 상담 반복, 견적 불일치, 제작 불가 시안 빈발.
- 베이커는 브랜드 일관성(스타일팩)과 현실성(지지대/운송)을 보장해야 함.

### 1.2 목표(Objectives)
- 웹 임베드에서 **5분 내** 선호안 선택까지 유도, **즉시 예약금 수납**까지 완결.
- StylePack/SizeCategory를 표준화하여 **현실 제작 가능** 시안만 제안.
- 회계·운영은 경량으로 시작(MVP), 점진적 자동화.

### 1.3 제품 원칙
- **게스트 퍼스트**: 로그인 없이 생성·미리보기 가능, **결제 시점**에 최소 정보 수집.
- **제약 내 자유**: StylePack은 하드 제약, 고객 입력은 소프트 제약.
- **비동기 기본**: 생성은 큐·워커로 처리, UI는 알림·SSE/폴링.

---

## 2. 용어집(Glossary)
- **StylePack**: 판매자 업로드 이미지/팔레트/형상 템플릿/허용 장식/금지어/LoRA 참조의 묶음.
- **SizeCategory**: 티어/지름/높이/서빙 수/기본가/리드타임/운송 반경 프로필.
- **Proposal(제안안)**: 3종(conservative/standard/bold) 목업 이미지(워터마크)+스펙+가격 범위+배지.
- **현실성 배지**: 지지대 필요, 운송 리스크, 알레르겐/저작권 경고 등 제작·운송 관점 신호.
- **예약금**: 제작 슬롯 확보 목적 선결제. 환불·변경 정책 별도 고지.

---

## 3. 사용자 및 여정
### 3.1 페르소나
- **고객**: 행사 케이크 구매, 인스타 참고, 모바일 중심.
- **관리자/베이커**: 스타일·가격·리드타임·현실성 규칙 정의·운영.

### 3.2 엔드투엔드 여정(고객, 8단계)
1) **진입(임베드)** → 2) **사이즈 선택** → 3) **스타일팩 선택** → 4) **추가 입력(선택: 텍스트/영감 이미지)** →  
5) **AI 제안 3종 생성(비동기)** → 6) **선호안 1개 선택** → 7) **예약금 결제** → 8) **완료 확인/이메일**
- *폴백*: 20s 초과 시 진행 상태 표시, 40s 초과 시 “텍스트 스펙 초안” 제공 + 완료 알림 구독.

### 3.3 관리자 여정
- 스타일팩 다중 업로드·태깅, Size/Price/LeadTime 설정, 현실성 룰 테이블 관리, 요청/제안/결제 대시보드.

---

## 4. 범위(Scope)
### 4.1 In‑Scope (MVP)
- 임베드 UX(게스트 모드), Size/StylePack 강제 선택, 제안 3종, 선호안 선택.
- **예약금 결제**: (권장) **Stripe 등 PG 결제** → QBO에 **동기화**. *(대안)* QBO Payment Link 사용(사전 PoC 필요).
- 결제 상태 동기화(웹훅 또는 안전 폴링), 이메일 알림, 기본 대시보드(요청/제안/결제).
- 업로드 정책(확장자·용량), EXIF 제거, 이미지 1600px 웹 변환.
- 접근성 WCAG 2.1 AA 준수.

### 4.2 Out‑of‑Scope (차기)
- 배달·픽업 스케줄러, 풀 CRM, 정교한 회계 계정 매핑 자동화(차기).
- 무제한 AI 재수정/채팅형 공동편집.

---

## 5. 핵심 기능 요구사항(FRD)
### 5.1 고객 UX
- **사이즈 선택(필수)**: 서빙/기본가/리드타임/현실성 배지 즉시 표시.
- **스타일팩 선택(필수)**: 이미지 썸네일·팔레트 칩·텍스처 태그·허용/금지 장식.
- **고객 입력(선택)**: 텍스트(테마/팔레트/포인트/문구/알레르겐), 영감 이미지 다중 업로드.
- **제안 3종**: 워터마크 목업, 팔레트, 허용 장식 리스트, 난이도/제작시간, **가격 범위**, 현실성 배지, 금지 시 대체안.
- **선호안 선택→결제**: 결제 모달/새 탭 + 이메일 전송. 완료 시 앱 상태 업데이트.

### 5.2 관리자 UX
- StylePack 컬렉션 생성/수정(다중 업로드, 자동 팔레트/텍스처 태깅 + 수동 보정).
- Size/Price/LeadTime/운송 반경 편집. 현실성 룰 테이블(지지대/장식 밀도/운송).
- 요청/제안/결제 상태 + **감사 로그** 열람.

### 5.3 오류/폴백
- 생성 p95 20s 목표(최대 40s). 20s↑ 진행 UI, 40s↑ 텍스트 초안 폴백 + 이메일 알림.

---

## 6. AI 설계
### 6.1 입력 계층 구조(중요)
- **Hard Constraint**: `StylePack.shape_template`, `palette_range`, `allowed_accents` *(반드시 준수)*
- **Soft Constraint**: 고객 텍스트·이미지에서 추출한 팔레트/무드/액센트 *(가중치 적용)*

### 6.2 초기 가중치/파라미터(권장값)
- StyleAdapter/LoRA 0.85, Text 0.4, Img2Img 0.25, CFG 6–7, Steps 30–40
- Negative: 로고/캐릭터, 부유 장식, 물리 불가 구조, 과도 메탈릭 등

### 6.3 프롬프트 골격(개념)
```
[STYLE_HARD]: {stylepack.keywords}/{shape_template}/{palette_range}
[SIZE_HARD]: {tiers_spec}
[ACCENTS_ALLOWED]: {allowed_accents}
[USER_SOFT]: {theme}/{palette}/{accent}/{inscription}
[NEGATIVE]: {policy_forbidden} + (floating, impossible structure, logo, licensed character)
```

---

## 7. 데이터 모델(요약)
### 7.1 엔터티
- **StylePack**: `id, name, images[], palette_range, shape_template, allowed_accents[], banned_terms[], lora_ref, created_at`
- **SizeCategory**: `id, tiers_spec(JSON), serving, base_price, lead_time, delivery_radius`
- **Request**: `id, size_category_id, stylepack_id, user_text, parsed_slots(JSON), user_images[], contact(email/phone), consent_flags, created_at, payment_status`
- **Proposal**: `id, request_id, variant(enum), image_url, spec_json, price_range[min,max], badges[], created_at`
- **RulesReality**: `id, key, threshold/enum, message, severity`
- **LogsAudit**: `id, request_id, rule_id, action(block|replace|warn), note, created_at`

### 7.2 업로드 정책
- 확장자: jpg/jpeg/png/webp, **파일당 ≤ 20MB / 요청당 ≤ 100MB**, EXIF 제거, 장축 1600px, 기본 보관 180일.

---

## 8. API 개요 (Lovable 임베드용)
> **원칙**: 브라우저 → Next Route Handler만 호출(직접 워커/API 호출 금지).  
> **비동기**: 요청은 202 반환 + `request_id`, 상태는 SSE/폴링로 추적.

- `POST /api/requests` → `{ request_id }` *(Idempotency-Key 필수)*  
- `GET /api/requests/{id}` → 요청/제안 조회(SSE 토픽 키 포함)  
- `POST /api/requests/{id}/select` → 선호안 선택 → (결제 링크 트리거)  
- `POST /api/payments/link` → `{ payment_link_url, provider: 'stripe'|'qbo', invoice_id? }`  
- `POST /api/payments/webhook` → 결제 상태 수신(서명/HMAC)  
- `POST /api/admin/stylepacks` (다중 업로드) / `PUT /api/admin/stylepacks/{id}`  
- `POST /api/admin/size-categories` / `PUT /api/admin/size-categories/{id}`

**샘플 응답 – GET `/api/requests/{id}`**
```json
{
  "data": {
    "id": "req_abc123",
    "size_category_id": "size_M",
    "stylepack_id": "sp_modern",
    "payment_status": "PENDING",
    "proposals": [
      {
        "id": "prop_1",
        "variant": "conservative",
        "image_url": "https://cdn/prop1.jpg",
        "spec_json": {"tiers":"2T 6+8", "palette":"pastel", "accents":["rosette"]},
        "price_range": [220, 280],
        "badges": ["support_required"]
      }
    ]
  }
}
```

---

## 9. 비기능(NFR)·보안·정책
### 9.1 성능·가용성
- 생성 **p95 ≤ 20s(목표)**, 최대 40s 폴백. 비생성 API **p95 ≤ 400ms**. 가용성 99.5%+.
- 4G 환경 LCP(제안 썸네일) ≤ 2.5s.

### 9.2 보안·프라이버시
- 관리자 JWT/RBAC, CORS/CSP 화이트리스트(bakesbymarie.com).
- 업로드는 **서명 URL(TTL≈10분)**, MIME+Magic 검사.
- PII/이미지 **180일 보관**, 고객 요청 시 즉시 삭제. 로그(비식별) 12개월.

### 9.3 법무·고지(복붙용)
- **저작권/상표**: 고객 제공 콘텐츠는 고객 소유. 정책상 허용되지 않는 요소는 자동 대체·제외될 수 있음.
- **알레르겐/보건**: 알레르기 정보는 고객이 고지. 미고지 책임은 고객에게 있음.
- **환불/변경**: 제작 준비 착수 이후 환불 불가(예: 픽업 72시간 전 이후). 그 이전 취소 시 수수료 X% 공제.
- **이미지 안내**: 제안 이미지는 목업으로 실제 결과와 다를 수 있음.

---

## 10. 결제/회계 통합 (리스크 관리)
### 10.1 권장 경로(Stripe/PG → QBO 동기화)
- 고객 결제는 **Stripe 등 PG**로 처리(모바일 최적화/신뢰도/속도).  
- 결제 성공 시 QBO에 **수납 동기화(Invoice/Payment)**. 회계 계정 매핑은 **차기**.

### 10.2 대안 경로(QBO 링크 직결) – *사전 PoC 필수*
- QBO Payment Link 생성 속도/모바일 UX/웹훅 신뢰도 **사전 측정**.  
- 성공 시 사용, 실패 시 즉시 PG로 전환.

---

## 11. 접근성·UX 가드
- 모든 핵심 플로우 **키보드만으로 완료** 가능, 버튼 대비 4.5:1 이상, 포커스 링 유지.
- StylePack 제약 미준수 시 **생성 버튼 비활성 + 이유 툴팁**.
- 20s↑ 진행 상태, 40s↑ 폴백(텍스트 스펙 초안 + 이메일 알림 구독).

---

## 12. KPI 정의·계측
- **제안 완료율** = (제안 3종 완결 건 / 생성 시도 건)×100  
  - 분모: POST `/api/requests` 성공, 분자: 워커 콜백 3종 완료.
- **결제 전환율** = (DEPOSIT_PAID 요청 / 제안 3종 전달 요청)×100  
- **상담 시간 50%↓**: 베이스라인 T1(현행) 대비 MVP T2(제안→결제확정) 비교.
- 이벤트 로깅: `req_id, step, ts(ms)` 기반, 대시보드 카드 제공.

---

## 13. 수용 기준(테스트 시나리오)
- **AC‑01 생성 비활성**: 사이즈·스타일 미선택 시 버튼 비활성 + 툴팁(Cypress).
- **AC‑02 제안 3종**: 이미지(워터마크)·팔레트·사양·배지·가격 범위 3카드 스냅샷 검증.
- **AC‑03 금지어 처리**: 로고/캐릭터 포함 → “대체안 안내” 토스트 + 미생성 사유 로그.
- **AC‑04 결제 링크**: 선호안 선택 후 3초 내 링크 표시·이메일 수신(Mock webhook).
- **AC‑05 상태 동기화**: 결제 완료 웹훅 → `payment_status=DEPOSIT_PAID` 전이 확인.
- **AC‑06 감사 로그**: 룰 히트 시 `LogsAudit.rule_id/action` 기록 존재(SQL 검증).

---

## 14. 마일스톤(예시: 4주)
- **W1**: DB 스키마·업로드·StylePack 다중 업로드/태깅, Size 카테고리 UI
- **W2**: 생성 파이프라인(제약/가중치)·제안 카드·현실성 배지
- **W3**: 결제(Stripe/PG 권장) 연동·이메일·대시보드·임베드 안정화
- **W4**: 베타(실요청 ≥10)·금지어/가중치/결제 퍼널 튜닝·PoC(QBO 경로)

---

## 15. 오픈 이슈(결정 필요)
1) 업로드 상한(최대 5장/총 100MB) 고정 여부  
2) 제안 이미지 해상도/워터마크(예: 1600×1600, 우하단)  
3) 예약금 산식(고정액 vs 기본가의 x%)  
4) 결제 수단 최종 결정(Stripe/PG 권장 vs QBO 링크) 및 QBO 계정 매핑 테이블(차기)

---

## 16. 부록
### A. 초기 SizeCategory 샘플
| 코드 | 티어/지름/높이 | 서빙 | 기본가(예) | 리드타임 |
|---|---|---:|---:|---|
| S | 1T 6″×4″ | 8–10 | $85–$110 | 3–5일 |
| M | 2T 6″+8″(각 4″) | 26–30 | $220–$280 | 5–7일 |
| L | 3T 6″+8″+10″ | 50+ | $420–$520 | 7–10일 |

### B. StylePack 메타 필드
`name, images[], palette_range(H/S/L), shape_template(1T/2T/3T), allowed_accents[], banned_terms[], lora_ref, notes`

### C. 현실성 룰 예시
- 지지대 필요: 2T 이상 또는 높이 ≥ 5″  
- 장식 밀도 경고: 표면 면적 대비 장식 요소 수 임계 초과  
- 운송 리스크: 온도 > 28℃ 또는 이동거리 > 25mi

```