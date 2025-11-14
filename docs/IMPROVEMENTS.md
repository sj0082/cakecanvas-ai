\# 케이크 디자인 AI 생성 시스템 개선 \- Lovable 구현 프롬프트

\#\# 0\. 목표 (Outcome)

판매 가능한 품질의 케이크 디자인 시안을 자동 생성한다.

\#\#\# 핵심 목표  
\- 하드 제약 강제화: 레이아웃 마스크, 팔레트 록(ΔE ≤ 10), 스타일 참조 이미지 2-3장  
\- 프롬프트 엔지니어링: Base Template \+ StylePack Context \+ Trend Context \+ User Intent  
\- 다단계 생성 파이프라인: Stage1 초안(512px, 8-10변형) → 리랭크 → Stage2 본선(1024px, Top-K) → 업스케일(2048px)  
\- 자동 품질 평가: 현실성(Bake-ability), 팔레트 적합도, On-brief 점수, 자동 리롤  
\- 충돌 감지: 의도 vs StylePack 충돌 감지 및 대체안 제안  
\- 관리자 도구: Style Fitness 3지표, 트렌드 관리, 품질 모니터링  
\- 법적/IP 가드레일: 금칙어→대체어 자동 변환, 사후 간이 탐지

\---

\#\# 1\. 시스템 아키텍처

\#\#\# Frontend  
\- 프레임워크: React \+ TypeScript (Lovable)  
\- 라우팅:  
  \- 고객: \`/design/size\` → \`/design/style\` → \`/design/details\` → \`/design/proposals/:requestId\`  
  \- 관리자: \`/admin\` (대시보드, StylePack 관리, 트렌드 관리)

\#\#\# Backend  
\- 데이터베이스: Supabase PostgreSQL  
\- 스토리지: Supabase Storage  
  \- \`stylepack-ref\`: 참조 이미지, 마스크, Moodboard  
  \- \`cake-inspiration\`: 고객 업로드 영감 이미지  
\- Edge Functions: Supabase Edge Functions (Deno)  
\- AI Gateway: Lovable AI Gateway (\`LOVABLE\_API\_KEY\`)

\#\#\# 이미지 생성 엔진  
\- Stage 1: Gemini 2.5 Flash Image (저비용, 빠름)  
\- Stage 2: Flux / Playground v2.5 (고품질, Lovable AI Gateway 또는 외부 API)  
\- Stage 3: Real-ESRGAN (업스케일, 선택적)

\---

\#\# 2\. 데이터 모델 (SQL Migrations)

\#\#\# 2.1 StylePack 참조 이미지 테이블 (신규)

\`\`\`sql  
\-- StylePack 참조 이미지 (업로드 즉시 분석)  
create table if not exists stylepack\_ref\_images (  
  id uuid primary key default gen\_random\_uuid(),  
  stylepack\_id uuid references stylepacks(id) on delete cascade,  
  image\_path text not null,              \-- storage 경로  
  embedding vector(512),                 \-- CLIP/ViT 임베딩 (pgvector 확장 필요)  
  palette jsonb,                         \-- \[{hex: "\#F2E9E4", ratio: 0.3}, ...\]  
  texture\_tags text\[\],                   \-- \["smooth buttercream", "quilt embossing"\]  
  density text check (density in ('low','mid','high')),  \-- 장식 밀도  
  mask\_thumbnail\_path text,              \-- 추출 마스크 썸네일 (선택적)  
  meta jsonb,                            \-- {width, height, exif, ...}  
  created\_at timestamptz default now()  
);

create index idx\_stylepack\_ref\_images\_stylepack on stylepack\_ref\_images(stylepack\_id);  
create index idx\_stylepack\_ref\_images\_embedding on stylepack\_ref\_images using ivfflat (embedding vector\_cosine\_ops);  
\`\`\`

\#\#\# 2.2 트렌드 관련 테이블 (신규)

\`\`\`sql  
\-- 트렌드 카테고리  
create table if not exists trend\_categories (  
  id uuid primary key default gen\_random\_uuid(),  
  name text unique not null,  
  description text,  
  source\_type text check (source\_type in ('instagram','pinterest','luxury\_brand','manual')) default 'manual',  
  is\_active boolean default true,  
  created\_at timestamptz default now()  
);

\-- 트렌드 키워드  
create table if not exists trend\_keywords (  
  id uuid primary key default gen\_random\_uuid(),  
  category\_id uuid references trend\_categories(id),  
  keyword text not null,  
  description text,  
  visual\_examples jsonb,         \-- \[{url: "...", note: "..."}\]  
  palette\_preset jsonb,          \-- 팔레트 프리셋 (팔레트 록과 즉시 연결)  
  popularity\_score numeric default 0.5,  \-- 0\~1  
  trend\_period daterange,  
  related\_keywords jsonb,        \-- \["pearlescent", "minimal", ...\]  
  created\_at timestamptz default now()  
);

\-- 트렌드-StylePack 매핑  
create table if not exists trend\_stylepack\_mappings (  
  id uuid primary key default gen\_random\_uuid(),  
  trend\_keyword\_id uuid references trend\_keywords(id),  
  stylepack\_id uuid references stylepacks(id),  
  relevance\_score numeric default 0.5,  \-- 0\~1  
  created\_at timestamptz default now()  
);

create index idx\_trend\_keywords\_category on trend\_keywords(category\_id);  
create index idx\_trend\_mappings\_stylepack on trend\_stylepack\_mappings(stylepack\_id);  
\`\`\`

\#\#\# 2.3 기존 테이블 확장

\`\`\`sql  
\-- stylepacks 테이블에 필드 추가 (이미 있으면 스킵)  
alter table stylepacks add column if not exists fitness\_scores jsonb;  \-- {consistency, palette\_drift, layout\_fit}  
alter table stylepacks add column if not exists ref\_image\_count int default 0;

\-- proposals 테이블 확장 (재현성 & A/B 테스트)  
alter table proposals add column if not exists seed\_class int;  \-- 1\~5  
alter table proposals add column if not exists stage int;       \-- 1 or 2 or 3  
alter table proposals add column if not exists engine text;     \-- 'gemini-flash', 'flux', etc.  
alter table proposals add column if not exists payload jsonb;   \-- 요청 파라미터 전체  
alter table proposals add column if not exists scores jsonb;    \-- {on\_brief, palette\_fit, bakeable, aesthetic}  
alter table proposals add column if not exists rank\_score numeric;  
\`\`\`

\---

\#\# 3\. 스토리지 구조

\#\#\# Bucket: \`stylepack-ref\`  
\`\`\`  
refs/  
  {stylepack\_id}/  
    {image\_id}.jpg          \-- 원본 참조 이미지  
    {image\_id}\_mask.png     \-- 마스크 (선택적)  
    {image\_id}\_thumb.jpg    \-- 썸네일

masks/  
  {stylepack\_id}\_{shape\_template}.png  \-- 레이아웃 마스크 (자동 생성)

mood/  
  {trend\_id}.jpg            \-- Moodboard 이미지 (선택적)  
\`\`\`

\#\#\# Bucket: \`cake-inspiration\` (기존 유지)  
\`\`\`  
inspiration/  
  {timestamp}-{random}.jpg  \-- 고객 업로드 영감 이미지  
\`\`\`

\---

\#\# 4\. Edge Functions 구현

\#\#\# 4.1 \`stylepack-analyze\` (개선)

위치: \`supabase/functions/stylepack-analyze/index.ts\`

입력:  
\`\`\`typescript  
{  
  imagePaths: string\[\]  // Storage 경로 배열  
}  
\`\`\`

처리 로직:  
1\. 이미지 검증: 최소 3장 확인 (부족 시 400\)  
2\. 각 이미지 처리:  
   \- 1024px 정규화 (비율 유지)  
   \- 배경 클린업 (간단한 인페인팅, 선택적)  
   \- 팔레트 추출: OKLab 색상 공간, 상위 5-7개 색상 \+ 비율  
   \- 질감 태깅: Vision 모델로 분석 ("smooth buttercream", "quilt embossing" 등)  
   \- 밀도 분석: 장식 요소 밀도 계산 (low/mid/high)  
   \- CLIP 임베딩 생성: 512차원 벡터  
   \- 마스크 추출: 티어/형상 자동 탐지 (선택적)  
3\. \`stylepack\_ref\_images\` 테이블에 저장  
4\. \`stylepacks.ref\_image\_count\` 업데이트

출력:  
\`\`\`typescript  
{  
  requestId: string,  
  palette: string\[\],           // \["\#F2E9E4", "\#E6D7C8", ...\]  
  textures: string\[\],          // \["smooth buttercream", ...\]  
  density: "low" | "mid" | "high",  
  count: number,  
  ref\_image\_ids: string\[\]      // 생성된 레코드 ID 배열  
}  
\`\`\`

에러 처리:  
\- \`LOVABLE\_API\_KEY\` 없음 → 500, "AI gateway is not configured"  
\- 이미지 3장 미만 → 400, "At least 3 images required"  
\- Vision API 실패 → 502, "Image analysis failed"

\---

\#\#\# 4.2 \`generate-proposals-v2\` (핵심 오케스트레이터)

위치: \`supabase/functions/generate-proposals-v2/index.ts\`

입력:  
\`\`\`typescript  
{  
  request\_id: string,          // requests 테이블 ID  
  stylepack\_id: string,  
  user\_intent: {  
    text?: string,  
    inspo\_image\_url?: string,  
    theme?: string,  
    colors?: string\[\]  
  },  
  size\_category\_id: string     // 레이아웃 마스크 생성용  
}  
\`\`\`

파이프라인:

\#\#\#\# Step 1: 컨텍스트 수집  
\`\`\`typescript  
// 1\. StylePack 분석 결과 조회  
const stylepackRefs \= await supabase  
  .from('stylepack\_ref\_images')  
  .select('\*')  
  .eq('stylepack\_id', stylepack\_id)  
  .limit(3)  
  .order('created\_at', { ascending: false });

const stylepack \= await supabase  
  .from('stylepacks')  
  .select('\*')  
  .eq('id', stylepack\_id)  
  .single();

// 2\. 트렌드 키워드 조회 (선택적)  
const trends \= await supabase  
  .from('trend\_stylepack\_mappings')  
  .select('trend\_keywords(\*)')  
  .eq('stylepack\_id', stylepack\_id)  
  .order('relevance\_score', { ascending: false })  
  .limit(3);

// 3\. 사용자 의도 파싱  
const intentKeywords \= parseUserIntent(user\_intent);  // NLP 또는 키워드 추출  
const intentPalette \= extractPaletteFromImage(user\_intent.inspo\_image\_url);  // 선택적  
\`\`\`

\#\#\#\# Step 2: 충돌 감지  
\`\`\`typescript  
// 스타일 임베딩 유사도 계산  
const styleIntentEmbedding \= await generateEmbedding(intentKeywords);  
const stylepackEmbedding \= averageEmbeddings(stylepackRefs.map(r \=\> r.embedding));  
const styleSimilarity \= cosineSimilarity(styleIntentEmbedding, stylepackEmbedding);

// 팔레트 충돌 검사  
const paletteScore \= calculatePaletteCompatibility(intentPalette, stylepack.palette\_range);

// 밀도 충돌 검사  
const densityScore \= calculateDensityCompatibility(intentKeywords, stylepackRefs\[0\].density);

const compatScore \= 0.5 \* styleSimilarity \+ 0.3 \* paletteScore \+ 0.2 \* densityScore;

if (compatScore \< 0.6) {  
  // 대체 StylePack 추천  
  const alternatives \= await findSimilarStylepacks(stylepack\_id, styleIntentEmbedding, 2);  
  return {  
    warning: true,  
    compat\_score: compatScore,  
    suggested\_stylepacks: alternatives,  
    tone\_down\_preset: generateToneDownPreset(intentKeywords)  
  };  
}  
\`\`\`

\#\#\#\# Step 3: 하드 제약 확정  
\`\`\`typescript  
// 1\. 레이아웃 마스크 생성  
const layoutMask \= await generateLayoutMask(size\_category\_id, stylepack.shape\_template);  
// → SVG/PNG 생성, Storage에 저장, URL 반환

// 2\. 팔레트 록  
const paletteLock \= {  
  colors: stylepack.palette\_range || extractFromRefs(stylepackRefs),  
  deltaE\_max: 10  
};

// 3\. 참조 이미지  
const styleRefs \= stylepackRefs.slice(0, 3).map(r \=\>   
  supabase.storage.from('stylepack-ref').getPublicUrl(r.image\_path)  
);

// 4\. Moodboard (트렌드 기반, 선택적)  
const moodRef \= trends.length \> 0 ? trends\[0\].visual\_examples\[0\]?.url : null;

// 5\. 금칙어 결합  
const forbidden \= \[  
  ...GLOBAL\_FORBIDDEN,  // \["glitter", "toy-like plastic", "metallic chrome", ...\]  
  ...(stylepack.banned\_terms || \[\]),  
  ...extractForbiddenFromIntent(intentKeywords)  
\];  
\`\`\`

\#\#\#\# Step 4: 프롬프트 빌드 (LLM 호출)  
\`\`\`typescript  
const promptResponse \= await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {  
  method: 'POST',  
  headers: {  
    'Authorization': \`Bearer ${LOVABLE\_API\_KEY}\`,  
    'Content-Type': 'application/json'  
  },  
  body: JSON.stringify({  
    model: 'google/gemini-2.5-flash',  
    messages: \[  
      {  
        role: 'system',  
        content: 'You are a cake-design prompt composer. Output JSON only. Enforce hard constraints: layout\_mask\_url, palette\_lock, style\_refs, forbidden. Respect real-world bake-ability.'  
      },  
      {  
        role: 'user',  
        content: JSON.stringify({  
          base\_template: {  
            structure\_terms: \['tiered stability', 'support ratio', 'topper safe zone'\],  
            techniques: \['buttercream piping', 'fondant panel', 'sugar flower', 'quilt embossing'\],  
            composition\_rules: \['balance', 'negative space', 'light asymmetry allowed'\]  
          },  
          stylepack\_context: {  
            mood: stylepack.mood || 'elegant',  
            density: stylepackRefs\[0\].density,  
            palettes: paletteLock.colors,  
            textures: stylepackRefs.flatMap(r \=\> r.texture\_tags),  
            banned\_terms: stylepack.banned\_terms || \[\]  
          },  
          trend\_context: {  
            keywords: trends.map(t \=\> t.keyword),  
            seasonal: getCurrentSeason()  
          },  
          user\_intent: {  
            text: user\_intent.text,  
            image\_palette: intentPalette  
          },  
          hard\_constraints: {  
            layout\_mask\_url: layoutMask.url,  
            palette\_lock: paletteLock,  
            style\_refs: styleRefs,  
            mood\_ref: moodRef,  
            forbidden: forbidden  
          }  
        })  
      }  
    \],  
    response\_format: { type: 'json\_object' }  
  })  
});

const { positive\_prompt, negative\_prompt, weights, generation\_hints } \= await promptResponse.json();  
\`\`\`

\#\#\#\# Step 5: Stage 1 \- 아이디어 생성 (512px, 8-10변형)  
\`\`\`typescript  
const stage1Results \= \[\];  
const seedClasses \= \[1, 2, 3, 4, 5\];  // 5개 시드 클래스

// 캐시 확인  
const cacheKey \= generateCacheKey(stylepack\_id, layoutMask.hash, paletteLock, intentHash, trends);  
const cached \= await getCachedStage1(cacheKey);  
if (cached) {  
  return cached;  // 24h 캐시  
}

// 병렬 생성 (5-10개 변형)  
for (const seedClass of seedClasses) {  
  const result \= await generateImage({  
    engine: 'gemini-2.5-flash-image',  
    size: 512,  
    steps: 10,  
    seed: generateSeed(seedClass),  
    prompt: positive\_prompt,  
    negative\_prompt: negative\_prompt,  
    style\_refs: styleRefs.map(url \=\> ({ url, weight: 0.55 })),  
    layout\_mask: { url: layoutMask.url, strength: 0.7 },  
    palette\_lock: paletteLock  
  });  
    
  // 품질 평가  
  const scores \= await evaluateQuality(result.image\_url, {  
    on\_brief: await clipSimilarity(result.image\_url, positive\_prompt),  
    palette\_fit: await checkPaletteFit(result.image\_url, paletteLock),  
    bakeable: await checkBakeability(result.image\_url),  
    aesthetic: await aestheticScore(result.image\_url)  
  });  
    
  stage1Results.push({  
    image\_url: result.image\_url,  
    seed\_class: seedClass,  
    scores,  
    rank\_score: 0.40 \* scores.on\_brief \+ 0.25 \* scores.palette\_fit \+ 0.25 \* scores.bakeable \+ 0.10 \* scores.aesthetic  
  });  
}

// 리랭크 & Top-K 선발  
stage1Results.sort((a, b) \=\> b.rank\_score \- a.rank\_score);  
const topK \= stage1Results.slice(0, 5);

// 캐시 저장  
await cacheStage1(cacheKey, topK, 24 \* 60 \* 60);  
\`\`\`

\#\#\#\# Step 6: Stage 2 \- 본선 생성 (1024px, Top-K)  
\`\`\`typescript  
const stage2Results \= \[\];

for (const candidate of topK) {  
  const result \= await generateImage({  
    engine: 'flux' || 'playground-v2.5',  // 고품질 모델  
    size: 1024,  
    steps: 22,  
    seed: candidate.seed\_class,  
    prompt: positive\_prompt,  
    negative\_prompt: negative\_prompt,  
    style\_refs: styleRefs.map(url \=\> ({ url, weight: 0.75 })),  // 가중치 상향  
    layout\_mask: { url: layoutMask.url, strength: 0.7 },  
    palette\_lock: paletteLock  
  });  
    
  // 재평가  
  const scores \= await evaluateQuality(result.image\_url, {...});  
  const rankScore \= calculateRankScore(scores);  
    
  // 임계 미달 시 리롤 (1회)  
  if (rankScore \< 0.7) {  
    const retryResult \= await generateImage({  
      ...result,  
      layout\_mask: { url: layoutMask.url, strength: 0.85 },  // 강도 상향  
      negative\_prompt: enhanceNegativePrompt(negative\_prompt)  // 네거티브 보강  
    });  
    // 재평가 후 저장  
  }  
    
  stage2Results.push({ ...result, scores, rank\_score: rankScore });  
}

// 최종 3종 선발  
const final3 \= stage2Results.sort((a, b) \=\> b.rank\_score \- a.rank\_score).slice(0, 3);  
\`\`\`

\#\#\#\# Step 7: Stage 3 \- 업스케일 (선택적, 2048px)  
\`\`\`typescript  
const upscaledResults \= await Promise.all(  
  final3.map(result \=\> upscaleImage(result.image\_url, 2048))  
);  
\`\`\`

\#\#\#\# Step 8: 결과 저장  
\`\`\`typescript  
// proposals 테이블에 저장  
for (const result of final3) {  
  await supabase.from('proposals').insert({  
    request\_id: request\_id,  
    stylepack\_id: stylepack\_id,  
    variant: \['conservative', 'standard', 'bold'\]\[final3.indexOf(result)\],  
    image\_url: result.image\_url,  
    seed\_class: result.seed\_class,  
    stage: 2,  
    engine: 'flux',  
    payload: { prompt: positive\_prompt, ... },  
    scores: result.scores,  
    rank\_score: result.rank\_score  
  });  
}  
\`\`\`

출력:  
\`\`\`typescript  
{  
  requestId: string,  
  proposals: \[  
    {  
      id: string,  
      image\_url: string,  
      variant: 'conservative' | 'standard' | 'bold',  
      scores: { on\_brief, palette\_fit, bakeable, aesthetic },  
      rank\_score: number  
    }  
  \],  
  warning?: {  
    compat\_score: number,  
    suggested\_stylepacks: \[...\],  
    tone\_down\_preset: {...}  
  }  
}  
\`\`\`

\---

\#\#\# 4.3 \`generate-layout-mask\` (신규, 선택적)

위치: \`supabase/functions/generate-layout-mask/index.ts\`

입력:  
\`\`\`typescript  
{  
  size\_category\_id: string,  
  shape\_template: string  // "1T", "2T", "3T", "heart", "round", etc.  
}  
\`\`\`

처리:  
\- \`size\_categories.tiers\_spec\` 파싱  
\- \`shape\_template\` 기반 SVG/PNG 마스크 생성  
\- Storage에 저장, URL 반환

\---

\#\# 5\. 프론트엔드 구현

\#\#\# 5.1 고객 여정 \- DesignDetails 페이지 개선

위치: \`src/pages/DesignDetails.tsx\`

충돌 감지 UI 추가:  
\`\`\`typescript  
// generate-proposals-v2 호출 전 충돌 감지 (선택적, 빠른 체크)  
const checkCompatibility \= async () \=\> {  
  const { data } \= await supabase.functions.invoke('check-style-compatibility', {  
    body: { stylepack\_id, user\_intent }  
  });  
    
  if (data.warning) {  
    setCompatibilityWarning({  
      score: data.compat\_score,  
      suggestions: data.suggested\_stylepacks,  
      toneDownPreset: data.tone\_down\_preset  
    });  
  }  
};

// UI 표시  
{compatibilityWarning && (  
  \<Alert variant="warning"\>  
    \<AlertTitle\>스타일 충돌 감지\</AlertTitle\>  
    \<AlertDescription\>  
      선택한 스타일과 요청 내용이 일치하지 않을 수 있습니다.  
      \<div className="mt-4 flex gap-2"\>  
        \<Button onClick={() \=\> showAlternativeStyles()}\>  
          대체 스타일 보기  
        \</Button\>  
        \<Button variant="outline" onClick={() \=\> applyToneDown()}\>  
          톤 다운 적용  
        \</Button\>  
        \<Button variant="ghost" onClick={() \=\> proceedAnyway()}\>  
          그대로 진행  
        \</Button\>  
      \</div\>  
    \</AlertDescription\>  
  \</Alert\>  
)}  
\`\`\`

\#\#\# 5.2 관리자 UI \- StylePack 관리 단순화

위치: \`src/components/admin/stylepack-editor/StylePackEditor.tsx\`

\#\#\#\# Style Fitness 카드 (단순화)  
\`\`\`typescript  
// 3개 지표만 표시  
\<StyleFitnessCard\>  
  \<Metric  
    label="일관성"  
    value={fitnessScores?.consistency || 0}  
    format="percent"  
    threshold={0.7}  
  /\>  
  \<Metric  
    label="팔레트 정확도"  
    value={fitnessScores?.palette\_drift || 0}  
    format="percent"  
    threshold={0.8}  
  /\>  
  \<Metric  
    label="레이아웃 적합도"  
    value={fitnessScores?.layout\_fit || 0}  
    format="percent"  
    threshold={0.75}  
  /\>  
\</StyleFitnessCard\>  
\`\`\`

\#\#\#\# 이미지 업로드 개선  
\`\`\`typescript  
// 자동 분석 트리거  
\<MultiImageUpload  
  onUploadComplete={(imagePaths) \=\> {  
    // 자동으로 stylepack-analyze 호출  
    triggerAutoAnalysis(imagePaths);  
  }}  
  minImages={3}  // 최소 3장 강제  
  showAnalysisProgress={true}  
/\>  
\`\`\`

\#\#\#\# 분석 결과 미리보기 (단순화)  
\`\`\`typescript  
\<AnalysisPanel\>  
  \<PalettePreview colors={analysisResult.palette} /\>  
  \<TextureTags tags={analysisResult.textures} /\>  
  \<DensityBadge value={analysisResult.density} /\>  
  {/\* 복잡한 설정은 숨김, 필요시 "고급 설정" 토글 \*/}  
\</AnalysisPanel\>  
\`\`\`

\#\#\# 5.3 관리자 UI \- 트렌드 관리 (신규)

위치: \`src/components/admin/TrendsManager.tsx\`

단순한 입력 폼:  
\`\`\`typescript  
\<TrendsManager\>  
  \<Card\>  
    \<CardHeader\>  
      \<CardTitle\>트렌드 키워드 추가\</CardTitle\>  
    \</CardHeader\>  
    \<CardContent\>  
      \<Input label="키워드" placeholder="pearlescent accent" /\>  
      \<Textarea label="설명" placeholder="진주 같은 광택 악센트" /\>  
      \<ColorPicker label="팔레트 프리셋" /\>  {/\* 선택적 \*/}  
      \<Input label="예시 이미지 URL" placeholder="https://..." /\>  {/\* 선택적 \*/}  
      \<Button onClick={saveTrend}\>저장\</Button\>  
    \</CardContent\>  
  \</Card\>  
\</TrendsManager\>  
\`\`\`

\---

\#\# 6\. 품질 평가 함수

위치: \`supabase/functions/utils/quality-evaluation.ts\`

\#\#\# 6.1 On-brief 점수 (CLIP)  
\`\`\`typescript  
async function calculateOnBriefScore(imageUrl: string, prompt: string): Promise\<number\> {  
  // CLIP 텍스트-이미지 유사도  
  const response \= await fetch('https://ai.gateway.lovable.dev/v1/embeddings', {  
    method: 'POST',  
    headers: { 'Authorization': \`Bearer ${LOVABLE\_API\_KEY}\` },  
    body: JSON.stringify({  
      model: 'text-embedding-ada-002',  // 또는 CLIP 모델  
      input: \[prompt, imageUrl\]  
    })  
  });  
  // 코사인 유사도 계산  
  return cosineSimilarity(textEmbedding, imageEmbedding);  
}  
\`\`\`

\#\#\# 6.2 팔레트 적합도  
\`\`\`typescript  
async function calculatePaletteFit(imageUrl: string, paletteLock: PaletteLock): Promise\<number\> {  
  const imagePalette \= await extractPalette(imageUrl);  // OKLab 색상 추출  
  const deltaEs \= imagePalette.map(color \=\>   
    Math.min(...paletteLock.colors.map(lockColor \=\>   
      deltaE(color, lockColor, 'oklab')  
    ))  
  );  
  const avgDeltaE \= deltaEs.reduce((a, b) \=\> a \+ b, 0\) / deltaEs.length;  
  return Math.max(0, 1 \- (avgDeltaE / paletteLock.deltaE\_max));  // 0\~1 정규화  
}  
\`\`\`

\#\#\# 6.3 현실성 (Bake-ability)  
\`\`\`typescript  
async function checkBakeability(imageUrl: string): Promise\<number\> {  
  // 규칙 기반 검사  
  const checks \= {  
    gravityViolation: await detectFloatingElements(imageUrl),  // 떠있는 장식  
    nonEdibleTexture: await detectMetallicFabric(imageUrl),    // 금속/천 질감  
    logoReplication: await detectLogoReplication(imageUrl),    // 로고 복제  
    textDistortion: await detectTextDistortion(imageUrl),      // 텍스트 왜곡  
    unrealisticStructure: await detectUnrealisticStructure(imageUrl)  // 비현실 구조  
  };  
    
  // 각 체크에 패널티 적용  
  let score \= 1.0;  
  if (checks.gravityViolation) score \-= 0.2;  
  if (checks.nonEdibleTexture) score \-= 0.3;  
  if (checks.logoReplication) score \-= 0.4;  
  if (checks.textDistortion) score \-= 0.1;  
  if (checks.unrealisticStructure) score \-= 0.2;  
    
  return Math.max(0, score);  
}  
\`\`\`

\---

\#\# 7\. 캐싱 전략

위치: Redis 또는 Supabase Cache (선택적)

\`\`\`typescript  
// 캐시 키 생성  
function generateCacheKey(  
  stylepackId: string,  
  maskHash: string,  
  paletteLock: PaletteLock,  
  intentHash: string,  
  trends: string\[\]  
): string {  
  return \`stage1:${stylepackId}:${maskHash}:${hashPalette(paletteLock)}:${intentHash}:${trends.join(',')}\`;  
}

// 캐시 저장 (24h)  
await cache.set(cacheKey, stage1Results, 24 \* 60 \* 60);  
\`\`\`

\---

\#\# 8\. 에러 처리 표준화

모든 Edge Function에서 통일된 에러 포맷:  
\`\`\`typescript  
{  
  requestId: string,  
  status: number,  
  code: 'INTERNAL' | 'INVALID\_BODY' | 'AT\_LEAST\_3\_IMAGES' | 'COMPATIBILITY\_WARNING',  
  message: string,  
  details?: any  
}  
\`\`\`

\---

\#\# 9\. 수용 기준 (AC)

1\. 하드 제약 적용: 마스크, 팔레트 록, 참조 이미지가 항상 적용됨 (누락 시 400\)  
2\. StylePack 분석: 3장 이상 업로드 시 자동 분석, Fitness 점수 갱신  
3\. 캐싱: 동일 입력으로 Stage1 캐시 동작, 2차 호출 1초 이내 응답  
4\. 충돌 감지: 정합도 \< 0.6 시 경고 \+ 대체 StylePack 제안 표시  
5\. 품질 임계: 최종 3종이 on-brief/팔레트/현실성 임계 이상, 미달 시 자동 리롤 1회  
6\. 재현성: \`proposals\` 테이블에 seed\_class/파라미터/점수 저장, 재생성 가능

\---

\#\# 10\. 구현 우선순위

\#\#\# Phase 1 (즉시, 1-2주)  
1\. \`stylepack-analyze\` 개선: 벡터 임베딩, 팔레트/질감/밀도 분석  
2\. 하드 제약 강제화: 레이아웃 마스크, 팔레트 록, 참조 이미지  
3\. 네거티브 프롬프트 상수화

\#\#\# Phase 2 (단기, 2-3주)  
1\. \`generate-proposals-v2\` 구현: 다단계 파이프라인  
2\. 충돌 감지 로직  
3\. 품질 평가 함수

\#\#\# Phase 3 (중기, 3-4주)  
1\. 트렌드 DB 구축 (큐레이션 우선)  
2\. 관리자 UI 단순화  
3\. 캐싱 및 성능 최적화

\---

\#\# 11\. Lovable 특화 구현 팁

1\. Edge Functions: Deno 환경, \`Deno.env.get()\`로 환경 변수 접근  
2\. Storage: \`supabase.storage.from('bucket').upload()\` 사용  
3\. AI Gateway: \`https://ai.gateway.lovable.dev/v1/chat/completions\` 사용, \`LOVABLE\_API\_KEY\` 필수  
4\. 벡터 검색: pgvector 확장 필요 (Supabase에서 지원)  
5\. 이미지 생성: 외부 API 호출 시 HTTP fetch 사용

