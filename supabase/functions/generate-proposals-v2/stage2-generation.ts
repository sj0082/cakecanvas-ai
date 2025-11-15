/**
 * Stage 2 High-Quality Generation (1024px refinement)
 */

export async function generateStage2(
  topKProposals: any[],
  prompts: any,
  constraints: any,
  stylepack: any,
  requestId: string,
  supabase: any,
  apiKey: string
) {
  const stage2Proposals = [];
  
  console.log(`🎨 Refining ${topKProposals.length} top proposals to 1024px high quality...`);

  for (const proposal of topKProposals) {
    // Use google/gemini-2.5-pro for higher quality
    const enhancedPrompt = `${proposal.prompt}

QUALITY ENHANCEMENTS for 1024px output:
- Ultra high resolution, professional photography quality
- Sharp details, perfect lighting, studio quality
- Commercial product photography standards
- Photorealistic textures and materials

Negative: ${constraints.negativePrompt}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro', // Higher quality model for Stage 2
        messages: [{
          role: 'user',
          content: enhancedPrompt
        }],
        modalities: ['image', 'text']
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const refinedImageBase64 = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      
      if (refinedImageBase64) {
        stage2Proposals.push({
          ...proposal,
          url: refinedImageBase64,
          stage: 2,
          resolution: '1024px'
        });
        console.log(`✅ Refined ${proposal.variantType} variant to 1024px`);
      } else {
        console.warn(`⚠️ Failed to refine ${proposal.variantType}, keeping Stage 1 version`);
        stage2Proposals.push(proposal); // Fallback to Stage 1
      }
    } else {
      console.error(`❌ Stage 2 API error for ${proposal.variantType}:`, response.status);
      stage2Proposals.push(proposal); // Fallback to Stage 1
    }
  }

  return stage2Proposals;
}
