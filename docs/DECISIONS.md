# Architecture Decision Records (ADR)

## ADR-001: AI 이미지 생성 모델 선택

**날짜**: 2025-01-08  
**상태**: 승인됨  
**결정자**: 개발팀
**업데이트**: 2025-01-14 - 다단계 생성 파이프라인 계획 추가

### 컨텍스트
A03 (생성 파이프라인) 구현을 위해 케이크 디자인 이미지 생성 모델 선택 필요.

### 고려된 옵션

#### 1. Stable Diffusion (자체 호스팅)
- **장점**: 
  - 완전한 커스터마이징 가능
  - LoRA 직접 제어
  - 프롬프트 엔지니어링 세밀한 조정
- **단점**: 
  - GPU 인프라 구축 필요 (Cloud Run + GPU 또는 별도 서버)
  - FastAPI 워커 구축 및 운영 복잡도 증가
  - 모델 관리 및 버전 관리 부담
  - 초기 설정 및 테스트 시간 소요

#### 2. Google Gemini 2.5 Flash Image (Lovable AI Gateway)
- **장점**: 
  - API 기반 간편 연동
  - Lovable AI Gateway를 통해 LOVABLE_API_KEY 자동 제공
  - 인프라 구축 및 운영 부담 제거
  - Edge Function 기반으로 빠른 구현 가능
  - Base64 인코딩으로 즉시 사용 가능
- **단점**: 
  - 모델 커스터마이징 제한 (LoRA 직접 제어 불가)
  - 외부 서비스 의존성
  - 프롬프트 엔지니어링으로만 제어

### 결정
**Google Gemini 2.5 Flash Image (Stage 1)** 선택
- MVP: 단일 스테이지 생성 (현재 구현)
- 향후: 다단계 파이프라인으로 확장

### 근거
1. **MVP 우선 원칙**: MVP 단계에서는 빠른 검증이 최우선 목표
2. **개발 속도**: Lovable AI Gateway를 통한 즉시 사용 가능
3. **운영 부담 최소화**: 인프라 구축, GPU 관리, 모델 업데이트 등의 운영 부담 제거
4. **기능 충족성**: StylePack 제약 조건을 텍스트 프롬프트로 충분히 표현 가능
5. **확장성**: 향후 필요시 다른 모델로 전환 가능

### 구현 방식 (현재)
```typescript
// supabase/functions/generate-proposals/index.ts
const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "google/gemini-2.5-flash-image-preview",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: promptWithStylePackConstraints },
          ...referenceImages.map(url => ({ type: "image_url", image_url: { url } }))
        ]
      }
    ],
    modalities: ["image", "text"]
  })
});
```

### 향후 확장 계획 (다단계 파이프라인)

#### Stage 1: 초안 생성 (현재 구현)
- **모델**: Gemini 2.5 Flash Image
- **해상도**: 512px
- **변형 수**: 8-10개
- **목적**: 빠른 초안 생성, 다양성 확보

#### Stage 2: 리랭킹 (계획)
- **품질 평가 지표**:
  - Bake-ability (현실성): 0-1
  - Palette Fitness (ΔE ≤ 10): 0-1
  - On-brief Score: 0-1
- **선택**: Top-K 후보 선택 (K=3)

#### Stage 3: 본선 생성 (계획)
- **모델**: Flux / Playground v2.5 (Lovable AI Gateway)
- **해상도**: 1024px
- **변형 수**: 3개 (conservative, standard, bold)
- **목적**: 고품질 최종 시안

#### Stage 4: 업스케일 (선택적)
- **모델**: Real-ESRGAN
- **해상도**: 2048px
- **목적**: 인쇄/프레젠테이션용 고해상도

### 영향
- **A03 구현 단순화**: Edge Function 기반으로 구현
- **개발 기간 단축**: W2 목표 달성 가능
- **문서 업데이트**: 모든 문서에 다단계 파이프라인 계획 반영
- **향후 전환 가능성**: Edge Function 레이어만 수정하면 다른 AI 모델로 전환 가능

### 재검토 시점
- MVP 완료 후 사용자 피드백 수집 시
- 이미지 품질 또는 제약 조건 표현에 한계가 발견될 경우
- 비용 효율성 재평가 필요 시

---

## ADR-002: StylePack 관리자 UI 단순화

**날짜**: 2025-01-14  
**상태**: 승인됨  
**결정자**: 개발팀

### 컨텍스트
관리자가 StylePack을 관리할 때 너무 많은 설정 항목이 노출되어 핵심 디자인 방향성에 집중하기 어려움.

### 문제점
1. 모든 설정이 항상 펼쳐져 있어 UI가 복잡함
2. 중요한 항목(트렌드 키워드, 참조 이미지)과 고급 설정이 구분되지 않음
3. 관리자가 어떤 항목이 이미지 생성에 가장 큰 영향을 미치는지 알기 어려움

### 결정
**UI를 계층화하여 핵심 항목만 상단에 노출하고, 고급 설정은 접을 수 있도록 구성**

### 새로운 UI 구조

#### 항상 보이는 핵심 항목
1. **Name & Description**: 스타일팩 기본 정보
2. **2025 Trend Keywords** (강조 표시):
   - Trending Keywords (Instagram/Pinterest)
   - Trending Techniques (장식 기법)
   - 이미지 생성의 핵심 방향성 결정
3. **Reference Images**:
   - 최소 3장 이상 업로드
   - Auto-Analyze 기능으로 자동 분석

#### 접을 수 있는 고급 설정 (기본 접힌 상태)
1. **Style Controls**:
   - Simple: 6개 슬라이더
   - Advanced: LoRA, Shape Template, Allowed Accents, etc.
2. **Analysis Results**: 분석 후에만 표시
3. **Preset Library**: 프리셋 저장/불러오기

### 구현 방식
```typescript
// Collapsible 컴포넌트 사용
<Collapsible open={isStyleControlsOpen} onOpenChange={setIsStyleControlsOpen}>
  <CollapsibleTrigger>
    <Settings className="w-4 h-4" />
    <h3>Style Controls (고급 설정)</h3>
    <ChevronDown className={isStyleControlsOpen ? 'rotate-180' : ''} />
  </CollapsibleTrigger>
  <CollapsibleContent>
    {/* 고급 설정 내용 */}
  </CollapsibleContent>
</Collapsible>
```

### 근거
1. **사용성 개선**: 관리자가 핵심 항목에 집중할 수 있음
2. **진입 장벽 감소**: 처음 사용하는 관리자도 쉽게 시작 가능
3. **유연성 유지**: 고급 사용자는 여전히 모든 설정에 접근 가능

### 영향
- **P06 구현 완료**: 관리자 UI 단순화
- **사용자 경험 개선**: 트렌드 키워드 입력이 더 직관적
- **문서 업데이트**: APPDEV.md, 개선사항 문서에 반영

---

## ADR-003: 트렌드 키워드 저장 구조

**날짜**: 2025-01-14  
**상태**: 승인됨  
**결정자**: 개발팀

### 컨텍스트
Phase 1 & 2 구현에서 트렌드 키워드가 저장되지 않는 버그 발견.

### 문제점
`handleSave` 함수에서 `trend_keywords`와 `trend_techniques` 필드가 누락됨.

### 결정
**모든 트렌드 데이터를 명시적으로 저장**

### 구현
```typescript
const handleSave = async () => {
  const data = {
    // ... 기존 필드들 ...
    trend_keywords: trendKeywords.length > 0 ? trendKeywords : null,
    trend_techniques: trendTechniques.length > 0 ? trendTechniques : null,
  };
  await onSave(data);
};
```

### 데이터 흐름
1. **입력**: 관리자가 UI에서 입력
2. **저장**: `stylepacks` 테이블의 `trend_keywords`, `trend_techniques` 컬럼
3. **사용**: `generate-proposals` Edge Function에서 DB에서 읽어옴
4. **적용**: Variant별로 다른 트렌드 키워드 적용
   - Conservative: 기본 + 스타일팩 키워드 2개
   - Standard: 기본 + 스타일팩 키워드 3개
   - Bold: 기본 + 스타일팩 키워드 전체

### 영향
- **버그 수정 완료**: 트렌드 키워드가 정상적으로 저장됨
- **Phase 1 & 2 완성**: 트렌드 반영 시스템 동작
- **품질 개선**: 생성되는 이미지가 최신 트렌드를 반영

---

## 향후 ADR 계획
- ADR-004: 참조 이미지 자동 분석 시스템 (stylepack-analyze)
- ADR-005: 충돌 감지 및 대체안 제안 (check-style-compatibility)
- ADR-006: 결제 시스템 선택 (Stripe vs QBO Payment Link)
- ADR-007: 상태 관리 및 비동기 처리 방식
