# Architecture Decision Records (ADR)

## ADR-001: AI 이미지 생성 모델 선택

**날짜**: 2025-01-08  
**상태**: 승인됨  
**결정자**: 개발팀

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
  - Lovable AI Gateway를 통해 LOVABLE_API_KEY 자동 제공 (별도 API 키 설정 불필요)
  - 인프라 구축 및 운영 부담 제거
  - Edge Function 기반으로 빠른 구현 가능
  - Base64 인코딩으로 즉시 사용 가능
- **단점**: 
  - 모델 커스터마이징 제한 (LoRA 직접 제어 불가)
  - 외부 서비스 의존성
  - 프롬프트 엔지니어링으로만 제어

### 결정
**Google Gemini 2.5 Flash Image (nano banana)** 선택

### 근거
1. **MVP 우선 원칙**: MVP 단계에서는 빠른 검증이 최우선 목표
2. **개발 속도**: Lovable AI Gateway를 통한 즉시 사용 가능 (LOVABLE_API_KEY 자동 제공)
3. **운영 부담 최소화**: 인프라 구축, GPU 관리, 모델 업데이트 등의 운영 부담 제거
4. **기능 충족성**: StylePack 제약 조건을 텍스트 프롬프트로 충분히 표현 가능
5. **확장성**: 향후 필요시 다른 모델로 전환 가능 (Edge Function만 수정하면 됨)
6. **비용 효율성**: 초기 인프라 투자 없이 사용량 기반 과금

### 구현 방식
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
        content: promptWithStylePackConstraints
      }
    ],
    modalities: ["image", "text"]
  })
});

// Base64 이미지 추출 후 Supabase Storage에 업로드
const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
```

### 영향
- **A03 구현 단순화**: Edge Function 기반으로 구현 (Cloud Run + FastAPI + GPU 인프라 불필요)
- **개발 기간 단축**: W2 목표 달성 가능
- **문서 업데이트**: PRD.md, APPDEV.md에 모델 선택 내용 반영
- **향후 전환 가능성**: Edge Function 레이어만 수정하면 다른 AI 모델로 전환 가능

### 재검토 시점
- MVP 완료 후 사용자 피드백 수집 시
- 이미지 품질 또는 제약 조건 표현에 한계가 발견될 경우
- 비용 효율성 재평가 필요 시

---

## 향후 ADR 추가 예정
- ADR-002: 결제 시스템 선택 (Stripe vs QBO Payment Link)
- ADR-003: 상태 관리 및 비동기 처리 방식
