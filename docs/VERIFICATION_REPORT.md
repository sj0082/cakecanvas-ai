\# 케이크 디자인 AI 생성 시스템 개선사항 검증 보고서

\*\*검증 일시\*\*: 2025-01-XX    
\*\*검증 기준 문서\*\*: \`\#디자인 AI 생성 시스템 개선.md\`    
\*\*검증 범위\*\*: 데이터 모델, Edge Functions, 프론트엔드, 품질 평가, 캐싱 전략

\---

\#\# 📊 전체 요약

| 카테고리 | 반영률 | 상태 |  
|---------|--------|------|  
| 데이터 모델 | 30% | ⚠️ 부분 반영 |  
| Edge Functions | 20% | ❌ 대부분 미반영 |  
| 프론트엔드 | 15% | ❌ 대부분 미반영 |  
| 품질 평가 | 0% | ❌ 미반영 |  
| 캐싱 전략 | 0% | ❌ 미반영 |

\*\*전체 반영률: 약 20%\*\*

\---

\#\# 1\. 데이터 모델 (SQL Migrations)

\#\#\# 1.1 StylePack 참조 이미지 테이블

\*\*요구사항\*\*:  
\`\`\`sql  
create table stylepack\_ref\_images (  
  id uuid primary key,  
  stylepack\_id uuid references stylepacks(id),  
  image\_path text not null,  
  embedding vector(512),              *\-- CLIP/ViT 임베딩*  
  palette jsonb,                      *\-- \[{hex: "\#F2E9E4", ratio: 0.3}, ...\]*  
  texture\_tags text\[\],                *\-- \["smooth buttercream", ...\]*  
  density text check (density in ('low','mid','high')),  
  mask\_thumbnail\_path text,  
  meta jsonb,  
  created\_at timestamptz default now()  
);  
\`\`\`

\*\*현재 상태\*\*: ⚠️ \*\*부분 반영\*\*

\*\*실제 구현\*\* (\`20251112042048\_1c967358-b07d-4250-be04-156df4be2971.sql\`):  
\`\`\`sql  
CREATE TABLE IF NOT EXISTS public.stylepack\_ref\_images (  
  id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
  stylepack\_id UUID NOT NULL REFERENCES public.stylepacks(id) ON DELETE CASCADE,  
  key TEXT NOT NULL,  
  url TEXT NOT NULL,  
  mime TEXT NOT NULL,  
  width INTEGER,  
  height INTEGER,  
  size\_bytes INTEGER NOT NULL,  
  uploaded\_by UUID NOT NULL,  
  created\_at TIMESTAMPTZ NOT NULL DEFAULT now()  
);  
\`\`\`

\*\*차이점\*\*:  
\- ❌ \`embedding vector(512)\` 컬럼 없음 (pgvector 확장 필요)  
\- ❌ \`palette jsonb\` 컬럼 없음  
\- ❌ \`texture\_tags text\[\]\` 컬럼 없음  
\- ❌ \`density text\` 컬럼 없음  
\- ❌ \`mask\_thumbnail\_path text\` 컬럼 없음  
\- ❌ \`meta jsonb\` 컬럼 없음 (width, height는 있지만 meta 구조 아님)  
\- ✅ 기본 구조는 존재 (stylepack\_id, created\_at)

\*\*영향\*\*: 참조 이미지 분석 결과를 저장할 수 없어, 향후 유사도 검색 및 자동 분석 기능 구현 불가

\---

\#\#\# 1.2 트렌드 관련 테이블

\*\*요구사항\*\*:  
\- \`trend\_categories\` 테이블  
\- \`trend\_keywords\` 테이블  
\- \`trend\_stylepack\_mappings\` 테이블

\*\*현재 상태\*\*: ❌ \*\*미반영\*\*

\*\*실제 구현\*\*:  
\- ❌ \`trend\_categories\` 테이블 없음  
\- ❌ \`trend\_keywords\` 테이블 없음  
\- ❌ \`trend\_stylepack\_mappings\` 테이블 없음  
\- ✅ \`stylepacks\` 테이블에 \`trend\_keywords TEXT\[\]\`, \`trend\_techniques TEXT\[\]\` 컬럼 추가됨 (단순화된 구조)

\*\*차이점\*\*:  
\- 문서 요구사항: 정규화된 별도 테이블 구조 (카테고리, 키워드, 매핑)  
\- 현재 구현: \`stylepacks\` 테이블에 배열 컬럼으로 단순 저장

\*\*영향\*\*:  
\- 트렌드 키워드의 재사용성 및 관리 용이성 저하  
\- 트렌드 키워드별 메타데이터 (popularity\_score, trend\_period, visual\_examples 등) 저장 불가  
\- StylePack 간 트렌드 키워드 공유 어려움

\---

\#\#\# 1.3 기존 테이블 확장

\#\#\#\# stylepacks 테이블

\*\*요구사항\*\*:  
\`\`\`sql  
alter table stylepacks add column if not exists fitness\_scores jsonb;  *\-- {consistency, palette\_drift, layout\_fit}*  
alter table stylepacks add column if not exists ref\_image\_count int default 0;  
\`\`\`

\*\*현재 상태\*\*: ❌ \*\*미반영\*\*

\*\*실제 구현\*\*:  
\- ✅ \`style\_strength\`, \`sharpness\`, \`realism\`, \`complexity\`, \`palette\_lock\`, \`uniformity\`, \`performance\_profile\` 컬럼 추가됨  
\- ❌ \`fitness\_scores jsonb\` 컬럼 없음  
\- ❌ \`ref\_image\_count int\` 컬럼 없음

\*\*영향\*\*: Style Fitness 지표를 저장할 수 없어, 관리자 UI에서 일관성/팔레트 정확도/레이아웃 적합도 표시 불가

\#\#\#\# proposals 테이블

\*\*요구사항\*\*:  
\`\`\`sql  
alter table proposals add column if not exists seed\_class int;  *\-- 1\~5*  
alter table proposals add column if not exists stage int;       *\-- 1 or 2 or 3*  
alter table proposals add column if not exists engine text;     *\-- 'gemini-flash', 'flux', etc.*  
alter table proposals add column if not exists payload jsonb;   *\-- 요청 파라미터 전체*  
alter table proposals add column if not exists scores jsonb;    *\-- {on\_brief, palette\_fit, bakeable, aesthetic}*  
alter table proposals add column if not exists rank\_score numeric;  
\`\`\`

\*\*현재 상태\*\*: ❌ \*\*미반영\*\*

\*\*실제 구현\*\* (\`generate-proposals/index.ts\` 263-289번 라인):  
\`\`\`typescript  
const proposalsToInsert \= generatedProposals.map((*imgData*: any) \=\> ({  
  request\_id: requestId,  
  variant: imgData.variant,  
  image\_url: imgData.url,  
  spec\_json: {  
    prompt: imgData.prompt,  
    negativePrompt,  
    seed: imgData.seed,  
    provider,  
    variantType: imgData.variantType,  
    variantLabel: imgData.variantLabel,  
    description: imgData.description  
  },  
  generator\_request: {...},  
  generator\_response: imgData.metadata || {},  
  seed: imgData.seed,  
  price\_range\_min: sizeCategory.base\_price\_min,  
  price\_range\_max: sizeCategory.base\_price\_max,  
  badges: \[\]  
}));  
\`\`\`

\*\*차이점\*\*:  
\- ❌ \`seed\_class\` 컬럼 없음 (seed는 있지만 클래스 구분 없음)  
\- ❌ \`stage\` 컬럼 없음 (다단계 파이프라인 미구현)  
\- ❌ \`engine\` 컬럼 없음 (provider는 spec\_json에만 저장)  
\- ⚠️ \`payload\`는 \`spec\_json\`과 \`generator\_request\`로 분산 저장됨  
\- ❌ \`scores jsonb\` 컬럼 없음 (품질 평가 미구현)  
\- ❌ \`rank\_score numeric\` 컬럼 없음 (리랭킹 미구현)

\*\*영향\*\*:  
\- 재현성 보장 어려움 (seed\_class 없음)  
\- 다단계 파이프라인 구현 불가  
\- 품질 평가 결과 저장 불가  
\- A/B 테스트 및 리랭킹 불가

\---

\#\# 2\. Edge Functions 구현

\#\#\# 2.1 stylepack-analyze (개선)

\*\*요구사항\*\*:  
1\. 이미지 검증: 최소 3장 확인  
2\. 각 이미지 처리:  
   \- 1024px 정규화  
   \- 배경 클린업 (선택적)  
   \- 팔레트 추출: OKLab 색상 공간, 상위 5-7개 색상 \+ 비율  
   \- 질감 태깅: Vision 모델로 분석  
   \- 밀도 분석: 장식 요소 밀도 계산 (low/mid/high)  
   \- CLIP 임베딩 생성: 512차원 벡터  
   \- 마스크 추출: 티어/형상 자동 탐지 (선택적)  
3\. \`stylepack\_ref\_images\` 테이블에 저장  
4\. \`stylepacks.ref\_image\_count\` 업데이트

\*\*현재 상태\*\*: ⚠️ \*\*부분 반영\*\*

\*\*실제 구현\*\* (\`supabase/functions/stylepack-analyze/index.ts\`):  
\- ✅ 이미지 검증: 최소 3장 확인 (100-120번 라인)  
\- ✅ 팔레트 추출: AI Vision 모델 사용 (209-330번 라인)  
\- ✅ 질감 태깅: AI Vision 모델 사용 (textures 배열 반환)  
\- ❌ 1024px 정규화 없음  
\- ❌ 배경 클린업 없음  
\- ❌ OKLab 색상 공간 사용 안 함 (hex 문자열만 반환)  
\- ❌ 색상 비율(ratio) 추출 없음  
\- ❌ 밀도 분석 없음 (low/mid/high)  
\- ❌ CLIP 임베딩 생성 없음  
\- ❌ 마스크 추출 없음  
\- ❌ \`stylepack\_ref\_images\` 테이블에 저장 안 함 (분석 결과만 반환)  
\- ❌ \`stylepacks.ref\_image\_count\` 업데이트 안 함

\*\*출력 형식\*\*:  
\`\`\`typescript  
*// 요구사항*  
{  
  requestId: string,  
  palette: string\[\],           *// \["\#F2E9E4", "\#E6D7C8", ...\]*  
  textures: string\[\],          *// \["smooth buttercream", ...\]*  
  density: "low" | "mid" | "high",  
  count: number,  
  ref\_image\_ids: string\[\]      *// 생성된 레코드 ID 배열*  
}

*// 현재 구현*  
{  
  requestId: string,  
  palette: string\[\],           *// ✅ 반환됨*  
  textures: string\[\]           *// ✅ 반환됨*  
  *// ❌ density, count, ref\_image\_ids 없음*  
}  
\`\`\`

\*\*영향\*\*:  
\- 참조 이미지 분석 결과가 DB에 저장되지 않아 재사용 불가  
\- 밀도 정보 없이 프롬프트 생성 시 정확도 저하  
\- CLIP 임베딩 없이 유사도 검색 불가

\---

\#\#\# 2.2 generate-proposals-v2 (핵심 오케스트레이터)

\*\*요구사항\*\*: 다단계 파이프라인  
\- Step 1: 컨텍스트 수집 (StylePack 분석, 트렌드 키워드, 사용자 의도)  
\- Step 2: 충돌 감지 (스타일 임베딩 유사도, 팔레트 충돌, 밀도 충돌)  
\- Step 3: 하드 제약 확정 (레이아웃 마스크, 팔레트 록, 참조 이미지, Moodboard, 금칙어)  
\- Step 4: 프롬프트 빌드 (LLM 호출)  
\- Step 5: Stage 1 \- 아이디어 생성 (512px, 8-10변형, 품질 평가, 리랭크)  
\- Step 6: Stage 2 \- 본선 생성 (1024px, Top-K, 재평가, 리롤)  
\- Step 7: Stage 3 \- 업스케일 (2048px, 선택적)  
\- Step 8: 결과 저장

\*\*현재 상태\*\*: ❌ \*\*미반영\*\*

\*\*실제 구현\*\*: \`generate-proposals\` 함수만 존재 (v2 없음)

\*\*현재 \`generate-proposals\` 구현\*\*:  
\- ✅ Step 1 (부분): StylePack 조회, 트렌드 키워드 조회 (stylepacks.trend\_keywords 사용)  
\- ❌ Step 2: 충돌 감지 없음  
\- ❌ Step 3: 하드 제약 확정 없음 (레이아웃 마스크, 팔레트 록 ΔE ≤ 10, Moodboard 없음)  
\- ⚠️ Step 4 (부분): 프롬프트 빌드 (LLM 호출 없이 직접 빌드)  
\- ❌ Step 5: Stage 1 없음 (직접 3개 variant 생성)  
\- ❌ Step 6: Stage 2 없음  
\- ❌ Step 7: Stage 3 없음  
\- ⚠️ Step 8 (부분): 결과 저장 (scores, rank\_score 없음)

\*\*차이점\*\*:  
\- 현재: Gemini 2.5 Flash Image로 직접 3개 variant 생성 (1024px 추정)  
\- 요구사항: Stage 1 (512px, 8-10변형) → 리랭크 → Stage 2 (1024px, Top-K) → 업스케일

\*\*영향\*\*:  
\- 다단계 파이프라인으로 인한 품질 향상 효과 없음  
\- 충돌 감지 없이 사용자 의도와 StylePack 불일치 가능  
\- 하드 제약 강제화 없이 팔레트/레이아웃 일관성 저하  
\- 품질 평가 및 리랭킹 없이 최적 결과 선택 불가

\---

\#\#\# 2.3 generate-layout-mask (신규)

\*\*요구사항\*\*: 레이아웃 마스크 생성 (SVG/PNG, Storage 저장)

\*\*현재 상태\*\*: ❌ \*\*미반영\*\*

\*\*실제 구현\*\*: Edge Function 없음

\*\*영향\*\*: 레이아웃 제약 강제화 불가

\---

\#\#\# 2.4 check-style-compatibility (신규)

\*\*요구사항\*\*: 사용자 의도 vs StylePack 충돌 감지

\*\*현재 상태\*\*: ❌ \*\*미반영\*\*

\*\*실제 구현\*\*: Edge Function 없음

\*\*영향\*\*: 충돌 감지 및 대체안 제안 불가

\---

\#\# 3\. 프론트엔드 구현

\#\#\# 3.1 고객 여정 \- DesignDetails 페이지 개선

\*\*요구사항\*\*: 충돌 감지 UI 추가  
\`\`\`typescript  
const checkCompatibility \= async () \=\> {  
  const { data } \= await supabase.functions.invoke('check-style-compatibility', {  
    body: { stylepack\_id, user\_intent }  
  });  
   
  if (data.warning) {  
    setCompatibilityWarning({...});  
  }  
};  
\`\`\`

\*\*현재 상태\*\*: ❌ \*\*미반영\*\*

\*\*실제 구현\*\* (\`src/pages/DesignDetails.tsx\`):  
\- ❌ \`checkCompatibility\` 함수 없음  
\- ❌ 충돌 감지 UI 없음  
\- ✅ 기본 폼 기능만 존재 (userText, contactEmail, contactPhone, image upload)

\*\*영향\*\*: 사용자가 스타일 충돌을 사전에 인지하지 못함

\---

\#\#\# 3.2 관리자 UI \- StylePack 관리 단순화

\*\*요구사항\*\*:  
1\. Style Fitness 카드 (3개 지표: 일관성, 팔레트 정확도, 레이아웃 적합도)  
2\. 이미지 업로드 개선 (자동 분석 트리거, 최소 3장 강제)  
3\. 분석 결과 미리보기 (단순화)

\*\*현재 상태\*\*: ⚠️ \*\*부분 반영\*\*

\*\*실제 구현\*\* (\`src/components/admin/stylepack-editor/StylePackEditor.tsx\`):  
\- ✅ 트렌드 키워드 입력 UI 존재 (406-461번 라인)  
\- ✅ Collapsible UI로 단순화 (Style Controls, Analysis Panel, Preset Library)  
\- ⚠️ Style Fitness 카드 존재하지만 구조 다름 (\`StyleFitnessCard.tsx\` \- 이미지 개수, 팔레트 일관성, 텍스처 다양성, 안전성 점수)  
\- ✅ 이미지 업로드 기능 존재 (\`MultiImageUpload\`)  
\- ⚠️ 자동 분석 트리거 존재하지만 최소 3장 강제는 UI 레벨에서만  
\- ✅ 분석 결과 미리보기 존재 (\`AnalysisPanel\`)

\*\*차이점\*\*:  
\- 요구사항: \`fitness\_scores.consistency\`, \`fitness\_scores.palette\_drift\`, \`fitness\_scores.layout\_fit\`  
\- 현재 구현: 이미지 개수, 팔레트 일관성, 텍스처 다양성, 안전성 (다른 지표)

\*\*영향\*\*: 요구사항과 다른 지표로 인해 일관성 있는 품질 관리 어려움

\---

\#\#\# 3.3 관리자 UI \- 트렌드 관리 (신규)

\*\*요구사항\*\*: \`src/components/admin/TrendsManager.tsx\` 컴포넌트

\*\*현재 상태\*\*: ❌ \*\*미반영\*\*

\*\*실제 구현\*\*: 컴포넌트 없음

\*\*영향\*\*: 트렌드 키워드를 별도로 관리할 수 없음 (현재는 StylePack 편집 시에만 입력)

\---

\#\# 4\. 품질 평가 함수

\*\*요구사항\*\*: \`supabase/functions/utils/quality-evaluation.ts\`  
\- \`calculateOnBriefScore\`: CLIP 텍스트-이미지 유사도  
\- \`calculatePaletteFit\`: OKLab 색상 공간, ΔE 계산  
\- \`checkBakeability\`: 규칙 기반 검사 (gravityViolation, nonEdibleTexture, logoReplication, textDistortion, unrealisticStructure)

\*\*현재 상태\*\*: ❌ \*\*미반영\*\*

\*\*실제 구현\*\*: 파일 없음

\*\*영향\*\*:  
\- 자동 품질 평가 불가  
\- 리랭킹 불가  
\- 자동 리롤 불가

\---

\#\# 5\. 캐싱 전략

\*\*요구사항\*\*: Stage 1 결과 캐싱 (24h, Redis 또는 Supabase Cache)

\*\*현재 상태\*\*: ❌ \*\*미반영\*\*

\*\*실제 구현\*\*:  
\- ⚠️ \`generate-proposals\`에 idempotency 캐싱만 존재 (5분, 메모리 기반)  
\- ❌ Stage 1 캐시 없음  
\- ❌ Redis/Supabase Cache 사용 없음

\*\*영향\*\*: 동일 입력에 대한 재생성 시 비용 및 시간 낭비

\---

\#\# 6\. 에러 처리 표준화

\*\*요구사항\*\*: 통일된 에러 포맷  
\`\`\`typescript  
{  
  requestId: string,  
  status: number,  
  code: 'INTERNAL' | 'INVALID\_BODY' | 'AT\_LEAST\_3\_IMAGES' | 'COMPATIBILITY\_WARNING',  
  message: string,  
  details?: any  
}  
\`\`\`

\*\*현재 상태\*\*: ⚠️ \*\*부분 반영\*\*

\*\*실제 구현\*\*:  
\- ✅ \`stylepack-analyze\`: \`respondError\` 함수로 통일된 포맷 사용  
\- ⚠️ \`generate-proposals\`: 에러 포맷 불일치 (일부만 통일)

\*\*영향\*\*: 에러 처리 일관성 저하

\---

\#\# 📋 우선순위별 미반영 사항 요약

\#\#\# 🔴 긴급 (Phase 1 \- 즉시, 1-2주)

1\. \*\*stylepack\_ref\_images 테이블 확장\*\*  
   \- \`embedding vector(512)\` 컬럼 추가 (pgvector 확장 필요)  
   \- \`palette jsonb\`, \`texture\_tags text\[\]\`, \`density text\` 컬럼 추가  
   \- \`stylepack-analyze\` 함수에서 분석 결과를 테이블에 저장하도록 수정

2\. \*\*stylepack-analyze 개선\*\*  
   \- 밀도 분석 추가 (low/mid/high)  
   \- CLIP 임베딩 생성 추가  
   \- 분석 결과를 \`stylepack\_ref\_images\` 테이블에 저장  
   \- \`stylepacks.ref\_image\_count\` 업데이트

3\. \*\*하드 제약 강제화\*\*  
   \- 레이아웃 마스크 생성 (\`generate-layout-mask\` 함수)  
   \- 팔레트 록 ΔE ≤ 10 검증  
   \- 참조 이미지 2-3장 강제

4\. \*\*네거티브 프롬프트 상수화\*\*  
   \- GLOBAL\_FORBIDDEN 상수 정의  
   \- 금칙어 자동 변환 로직

\#\#\# 🟡 중요 (Phase 2 \- 단기, 2-3주)

1\. \*\*generate-proposals-v2 구현\*\*  
   \- 다단계 파이프라인 (Stage 1 → Stage 2 → Stage 3\)  
   \- 충돌 감지 로직 (\`check-style-compatibility\`)  
   \- 품질 평가 함수 통합

2\. \*\*proposals 테이블 확장\*\*  
   \- \`seed\_class\`, \`stage\`, \`engine\`, \`scores\`, \`rank\_score\` 컬럼 추가

3\. \*\*stylepacks 테이블 확장\*\*  
   \- \`fitness\_scores jsonb\` 컬럼 추가  
   \- \`ref\_image\_count int\` 컬럼 추가

\#\#\# 🟢 선택 (Phase 3 \- 중기, 3-4주)

1\. \*\*트렌드 DB 구축\*\*  
   \- \`trend\_categories\`, \`trend\_keywords\`, \`trend\_stylepack\_mappings\` 테이블 생성  
   \- \`TrendsManager\` 컴포넌트 구현

2\. \*\*관리자 UI 개선\*\*  
   \- Style Fitness 카드 지표 수정 (consistency, palette\_drift, layout\_fit)  
   \- DesignDetails 충돌 감지 UI 추가

3\. \*\*캐싱 및 성능 최적화\*\*  
   \- Stage 1 캐싱 (24h)  
   \- Redis 또는 Supabase Cache 통합

\---

\#\# 🎯 결론

현재 코드베이스는 개선 문서의 \*\*약 20%만 반영\*\*되어 있습니다.

\*\*반영된 부분\*\*:  
\- ✅ 기본적인 트렌드 키워드 입력 기능 (stylepacks.trend\_keywords 컬럼)  
\- ✅ StylePack 스타일 제어 파라미터 (style\_strength, sharpness, realism 등)  
\- ✅ 기본적인 참조 이미지 분석 (팔레트, 텍스처 추출)  
\- ✅ UI 단순화 (Collapsible 구조)

\*\*미반영된 핵심 기능\*\*:  
\- ❌ 다단계 생성 파이프라인 (Stage 1/2/3)  
\- ❌ 품질 평가 및 리랭킹  
\- ❌ 충돌 감지 시스템  
\- ❌ 하드 제약 강제화 (레이아웃 마스크, 팔레트 록 ΔE)  
\- ❌ 정규화된 트렌드 DB 구조  
\- ❌ Style Fitness 지표 (consistency, palette\_drift, layout\_fit)

\*\*권장 사항\*\*:  
1\. \*\*즉시 조치\*\*: Phase 1 항목부터 순차적으로 구현  
2\. \*\*데이터 모델 우선\*\*: 테이블 스키마 확장이 다른 기능의 기반이 됨  
3\. \*\*점진적 개선\*\*: 기존 \`generate-proposals\`를 \`generate-proposals-v2\`로 점진적 전환

