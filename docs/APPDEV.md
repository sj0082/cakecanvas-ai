# App Development Summary

## Overview
AI-powered cake design generation system with StylePack-based constraints and multi-stage image generation pipeline.

## 1) Application Development Use Cases (Storyboard View)

| Lane / Scene | Scene 01 — 고객 요청 생성 | Scene 02 — 요청 검토/생성 처리 | Scene 03 — 제안 확인 & 예약금 결제 | Scene 04 — 결제 후 상태 동기화 |
| ----- | ----- | ----- | ----- | ----- |
| **Actions (User/Baker)** | 고객이 임베드 UI에서 사이즈·스타일팩 선택 → 텍스트/영감 이미지 업로드 → “생성” 요청 제출 | 워커가 제안안 3종 생성(제약/정책 가드 적용) | 고객이 선호안 1개 선택 → 결제(예약금) 진행 | QBO 결제 완료 → 상태 동기화 → 관리자 알림 |
| **Application Logic** | 입력 검증(사이즈·스타일팩 미선택 시 차단), 업로드 서명 URL 발급, 요청 생성(202) 및 큐 등록 | 비동기 작업 실행(Lovable AI Gateway 호출, StylePack 제약 프롬프트 적용), Supabase Storage 저장, 콜백으로 Proposal upsert, 현실성/정책 룰 평가 및 배지 생성 | 선택 멱등 처리, QBO 결제 링크 생성·노출·이메일 전송, 폴링/웹훅 대기 | 웹훅 HMAC 검증, 요청 상태 `DEPOSIT_PAID/FAILED/VOID` 업데이트, 감사 로그 기록 |
| **System** | React + TypeScript (Lovable), Supabase, Supabase Storage | Lovable AI Gateway + Edge Functions, Supabase Storage, Supabase | React (API), Payment Gateway, Email Service | Payment Webhook, Supabase |
| **Required Data** | StylePack, SizeCategory, 사용자 입력/이미지, 동의 플래그 | Request, Proposal(3안), RulesReality, LogsAudit | Proposal 선택, 금액 산식, 고객 연락처 | Payment status, 결제 상태, 감사 로그 |

---

## 2) Development Styles by Tier

| Three-Tier Architecture | Extension Style | 적용 범위(본 프로젝트) |
| ----- | ----- | ----- |
| **Presentation Tier** | User Interface Extension / New User Interface / Form & E-mail | 임베드 고객 UI, 관리자 콘솔, 모달/스텝퍼 폼, 결제 링크 표시, 이메일 템플릿 |
| **Application Tier** | Business Logic Extension | 멱등성/레이트리밋, 큐 등록/재시도, 생성 파이프라인, 현실성/정책 룰, 결제 링크 생성, 웹훅 검증 |
| **Data Tier** | Data Model Extension | ERD(StylePack, SizeCategory, Request, Proposal, RulesReality, LogsAudit), 인덱스/보관 정책 |

---

## 3) Development Tasks by Style

### Presentation Tier

| ID | Extension Style | Extension Task |
| ----- | ----- | ----- |
| P01 | User Interface Extension | 임베드 랜딩/스텝퍼(사이즈→스타일→입력→검토) 구성 |
| P02 | New User Interface | 제안 카드(3안) UI + 현실성/정책 배지 |
| P03 | Form | 다중 업로더(서명 URL, 진행률, 썸네일), 접근성(ARIA/키보드) |
| P04 | E-mail | 예약금 안내/리마인더 템플릿, 발송 변수(제안/금액/링크) |
| P05 | New User Interface | 관리자 콘솔(스타일팩/사이즈/요청·결제 상태) |
| P06 | New User Interface | **StylePack Editor UI 단순화 - 핵심 항목 강조** |

### Application Tier

| ID | Extension Style | Extension Task |
| ----- | ----- | ----- |
| A01 | Business Logic Extension | 멱등성/레이트리밋/Correlation-ID 미들웨어 |
| A02 | Business Logic Extension | 이미지 업로드 보안(MIME+Magic, 20MB/100MB) & EXIF 제거 파이프 |
| A03 | Business Logic Extension | **다단계 생성 파이프라인(Stage1→리랭크→Stage2→업스케일)** |
| A04 | Business Logic Extension | **자동 품질 평가 및 리롤 메커니즘** |
| A05 | Business Logic Extension | 결제 링크 생성 + 이메일 발송 |
| A06 | Business Logic Extension | 웹훅 HMAC+Timestamp+Nonce 검증 및 상태 업데이트 |
| A07 | Business Logic Extension | 모니터링/알람(지표, DLQ, 장애 배너) |
| A08 | Business Logic Extension | **StylePack 참조 이미지 자동 분석 (팔레트, 텍스처, 밀도)** |
| A09 | Business Logic Extension | **의도 vs StylePack 충돌 감지 및 대체안 제안** |

### Data Tier

| ID | Extension Style | Extension Task |
| ----- | ----- | ----- |
| D01 | Data Model Extension | 핵심 스키마 설계/마이그레이션(ERD 6테이블) |
| D02 | Data Model Extension | 인덱스 최적화/보관(180일 삭제 배치)/감사로그 |
| D03 | Data Model Extension | **stylepack_ref_images 테이블 (참조 이미지 메타데이터)** |
| D04 | Data Model Extension | **trend_categories, trend_keywords 테이블** |
| D05 | Data Model Extension | **proposals 테이블 확장 (quality_score, stage, is_fallback_spec)** |

---

## 4) 개선사항 (2025-01-14)

### 4.1 관리자 UI 단순화
**목표**: 관리자가 핵심 디자인 방향성에 집중할 수 있도록 UI 재구성

**변경사항**:
- **항상 보이는 핵심 항목**:
  - Name & Description
  - 2025 Trend Keywords (강조 표시)
    - Trending Keywords (Instagram/Pinterest)
    - Trending Techniques (장식 기법)
  - Reference Images (Auto-Analyze 기능 포함)
  
- **접을 수 있는 고급 설정** (기본 접힌 상태):
  - Style Controls (Simple + Advanced)
  - Analysis Results
  - Preset Library

**구현 파일**: `src/components/admin/stylepack-editor/StylePackEditor.tsx`

### 4.2 트렌드 키워드 저장 수정
**문제**: handleSave에서 trend_keywords, trend_techniques가 저장되지 않음

**해결**: 
```typescript
const handleSave = async () => {
  const data = {
    // ... existing fields ...
    trend_keywords: trendKeywords.length > 0 ? trendKeywords : null,
    trend_techniques: trendTechniques.length > 0 ? trendTechniques : null,
  };
  await onSave(data);
};
```

### 4.3 다단계 생성 파이프라인 (향후 구현)
**아키텍처**:
```
Stage 1 (초안) → 리랭크 → Stage 2 (본선) → 업스케일
512px, 8-10변형   Top-K 선택   1024px, 고품질   2048px (선택)
Gemini Flash     Quality Score  Flux/Playground  Real-ESRGAN
```

**품질 평가 지표**:
- Bake-ability (현실성)
- Palette Fitness (팔레트 적합도, ΔE ≤ 10)
- On-brief Score (요구사항 일치도)

### 4.4 참조 이미지 자동 분석
**기능**:
- 업로드 즉시 자동 분석 (Edge Function: `stylepack-analyze`)
- 추출 데이터:
  - Palette (색상 팔레트)
  - Texture Tags (텍스처 태그)
  - Density (장식 밀도: low/mid/high)
  - CLIP Embedding (유사도 검색용)

**저장 위치**: `stylepack_ref_images` 테이블

### 4.5 충돌 감지 시스템 (향후 구현)
**목표**: 사용자 의도와 StylePack 불일치 감지

**기능**:
- 의도 vs StylePack 유사도 분석
- 충돌 발생 시 대체안 제안
- Tone-down 프리셋 제공

**Edge Function**: `check-style-compatibility`

---

## 5) Technology Stack Updates

### Frontend
- React + TypeScript (Lovable)
- Tailwind CSS (semantic tokens 기반)
- Collapsible UI components

### Backend
- Supabase Edge Functions (Deno)
- Lovable AI Gateway
  - Stage 1: Google Gemini 2.5 Flash Image
  - Stage 2: Flux / Playground v2.5 (planned)

### Database
- PostgreSQL (Supabase)
- pgvector extension (similarity search)
- New tables:
  - `stylepack_ref_images`
  - `trend_categories`
  - `trend_keywords`
  - `trend_stylepack_mappings`

---

## 6) Related Documents
- **PRD.md**: Product requirements and user journeys
- **TRD.md**: Technical specifications
- **DECISIONS.md**: Architecture decision records
- **개선사항 문서**: `디자인_AI_생성_시스템_개선.md`
