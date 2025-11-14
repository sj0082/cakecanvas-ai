-- ============================================
-- Phase 1: Database Schema Extensions
-- 케이크 디자인 AI 생성 시스템 개선
-- ============================================

-- 1. pgvector 확장 활성화 (임베딩 저장용)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. stylepack_ref_images 테이블 확장
-- 이미지 분석 결과 저장을 위한 컬럼 추가
ALTER TABLE public.stylepack_ref_images 
ADD COLUMN IF NOT EXISTS embedding vector(512),
ADD COLUMN IF NOT EXISTS palette jsonb,
ADD COLUMN IF NOT EXISTS texture_tags text[],
ADD COLUMN IF NOT EXISTS density text CHECK (density IN ('low', 'mid', 'high')),
ADD COLUMN IF NOT EXISTS mask_thumbnail_path text,
ADD COLUMN IF NOT EXISTS meta jsonb;

-- 인덱스 추가 (벡터 유사도 검색용)
CREATE INDEX IF NOT EXISTS stylepack_ref_images_embedding_idx 
ON public.stylepack_ref_images 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- 3. stylepacks 테이블 확장
-- Style Fitness 지표 및 참조 이미지 카운트 추가
ALTER TABLE public.stylepacks
ADD COLUMN IF NOT EXISTS fitness_scores jsonb,
ADD COLUMN IF NOT EXISTS ref_image_count integer DEFAULT 0;

-- fitness_scores 구조: {consistency: 0-100, palette_drift: 0-100, layout_fit: 0-100}
COMMENT ON COLUMN public.stylepacks.fitness_scores IS 
'Style fitness metrics: {consistency, palette_drift, layout_fit}';

-- 4. proposals 테이블 확장
-- 다단계 파이프라인 및 품질 평가 지원
ALTER TABLE public.proposals
ADD COLUMN IF NOT EXISTS seed_class integer CHECK (seed_class BETWEEN 1 AND 5),
ADD COLUMN IF NOT EXISTS stage integer CHECK (stage IN (1, 2, 3)),
ADD COLUMN IF NOT EXISTS engine text,
ADD COLUMN IF NOT EXISTS payload jsonb,
ADD COLUMN IF NOT EXISTS scores jsonb,
ADD COLUMN IF NOT EXISTS rank_score numeric;

-- scores 구조: {on_brief: 0-1, palette_fit: 0-1, bakeable: 0-1, aesthetic: 0-1}
COMMENT ON COLUMN public.proposals.scores IS 
'Quality evaluation scores: {on_brief, palette_fit, bakeable, aesthetic}';

-- seed_class: 1-5 범위로 재현성 보장
COMMENT ON COLUMN public.proposals.seed_class IS 
'Seed class (1-5) for reproducibility and variation control';

-- stage: 1=ideation, 2=refinement, 3=upscaling
COMMENT ON COLUMN public.proposals.stage IS 
'Generation pipeline stage: 1=ideation, 2=refinement, 3=upscaling';

-- 5. 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS proposals_request_stage_idx 
ON public.proposals(request_id, stage);

CREATE INDEX IF NOT EXISTS proposals_rank_score_idx 
ON public.proposals(rank_score DESC NULLS LAST);

-- 6. stylepacks.ref_image_count 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_stylepack_ref_image_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.stylepacks
    SET ref_image_count = (
      SELECT COUNT(*) 
      FROM public.stylepack_ref_images 
      WHERE stylepack_id = NEW.stylepack_id
    )
    WHERE id = NEW.stylepack_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.stylepacks
    SET ref_image_count = (
      SELECT COUNT(*) 
      FROM public.stylepack_ref_images 
      WHERE stylepack_id = OLD.stylepack_id
    )
    WHERE id = OLD.stylepack_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 트리거 생성
DROP TRIGGER IF EXISTS trigger_update_ref_image_count ON public.stylepack_ref_images;
CREATE TRIGGER trigger_update_ref_image_count
AFTER INSERT OR DELETE ON public.stylepack_ref_images
FOR EACH ROW
EXECUTE FUNCTION update_stylepack_ref_image_count();