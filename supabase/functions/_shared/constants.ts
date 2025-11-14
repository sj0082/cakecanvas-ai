// Global forbidden terms with alternatives for legal/IP guardrails
export const GLOBAL_FORBIDDEN = [
  { keyword: "disney", alternatives: ["whimsical castle", "fairy tale theme"] },
  { keyword: "marvel", alternatives: ["superhero inspired", "heroic theme"] },
  { keyword: "dc comics", alternatives: ["comic book style", "heroic design"] },
  { keyword: "star wars", alternatives: ["space adventure", "galactic theme"] },
  { keyword: "harry potter", alternatives: ["magical school", "wizard theme"] },
  { keyword: "pokemon", alternatives: ["creature collector", "monster friends"] },
  { keyword: "hello kitty", alternatives: ["cute cat character", "kawaii feline"] },
  { keyword: "mickey mouse", alternatives: ["cartoon mouse", "cheerful character"] },
  { keyword: "minions", alternatives: ["yellow helpers", "silly assistants"] },
  { keyword: "frozen", alternatives: ["ice kingdom", "winter princess"] },
  { keyword: "spiderman", alternatives: ["web hero", "acrobatic character"] },
  { keyword: "batman", alternatives: ["caped crusader", "night guardian"] },
  { keyword: "superman", alternatives: ["flying hero", "super character"] },
  { keyword: "barbie", alternatives: ["fashion doll", "glamorous figure"] },
  { keyword: "lego", alternatives: ["building blocks", "construction toy"] },
  { keyword: "coca cola", alternatives: ["red and white theme", "classic soda colors"] },
  { keyword: "pepsi", alternatives: ["blue and red theme", "refreshing colors"] },
  { keyword: "starbucks", alternatives: ["coffee shop theme", "green and white"] },
  { keyword: "mcdonalds", alternatives: ["fast food theme", "golden arches style"] },
  { keyword: "nike", alternatives: ["sporty swoosh", "athletic design"] },
  { keyword: "adidas", alternatives: ["three stripes", "athletic theme"] },
  { keyword: "louis vuitton", alternatives: ["luxury monogram pattern", "elegant checker"] },
  { keyword: "gucci", alternatives: ["vintage floral pattern", "retro stripes"] },
  { keyword: "chanel", alternatives: ["elegant interlocking pattern", "luxury fashion"] },
  { keyword: "prada", alternatives: ["minimalist luxury", "refined elegance"] },
  { keyword: "versace", alternatives: ["baroque pattern", "greek key design"] },
  { keyword: "burberry", alternatives: ["classic plaid", "tartan pattern"] },
  { keyword: "tiffany", alternatives: ["robin egg blue", "elegant box theme"] },
  { keyword: "cartier", alternatives: ["luxury jewelry", "red box theme"] },
  { keyword: "rolex", alternatives: ["luxury timepiece", "crown emblem"] },
  { keyword: "apple", alternatives: ["minimalist tech", "bitten fruit silhouette"] },
  { keyword: "samsung", alternatives: ["modern electronics", "sleek design"] },
  { keyword: "sony", alternatives: ["entertainment tech", "playful colors"] },
  { keyword: "microsoft", alternatives: ["four color squares", "tech windows"] },
  { keyword: "google", alternatives: ["colorful letters", "search theme"] },
  { keyword: "facebook", alternatives: ["social media blue", "connection theme"] },
  { keyword: "instagram", alternatives: ["gradient camera", "photo sharing theme"] },
  { keyword: "youtube", alternatives: ["red play button", "video theme"] },
  { keyword: "twitter", alternatives: ["blue bird", "social chirping"] },
  { keyword: "tiktok", alternatives: ["musical note", "short video theme"] },
  { keyword: "fortnite", alternatives: ["battle royale", "building game"] },
  { keyword: "minecraft", alternatives: ["blocky world", "creative building"] },
  { keyword: "roblox", alternatives: ["avatar game", "creative platform"] },
  { keyword: "among us", alternatives: ["space crew", "impostor game"] },
  { keyword: "angry birds", alternatives: ["flying birds", "slingshot game"] },
  { keyword: "candy crush", alternatives: ["match three game", "sweet puzzles"] },
];

// Base negative prompt for all generations
export const NEGATIVE_PROMPT_BASE = 
  "blurry, low quality, distorted, unrealistic structure, gravity defying, impossible architecture, " +
  "non-edible materials, metal texture, plastic look, chrome finish, glossy synthetic, " +
  "logos, text, watermarks, signatures, brand names, copyrighted characters, " +
  "trademarked symbols, commercial branding";

// Reality Rules based negative prompt
export const REALITY_RULES_NEGATIVE = [
  "floating tiers without support",
  "tier diameter larger than base tier",
  "transparent fondant",
  "glowing neon colors",
  "metallic chrome finish",
  "glass texture",
  "plastic appearance",
  "mirror surface",
  "holographic effect",
  "invisible supports",
  "levitating elements",
  "anti-gravity structure",
  "physically impossible stacking",
  "unsupported overhangs exceeding 45 degrees",
  "molten or melting appearance unless intentional",
  "raw meat texture",
  "uncooked dough appearance",
];

// Combine all negative prompts
export function getFullNegativePrompt(): string {
  return `${NEGATIVE_PROMPT_BASE}, ${REALITY_RULES_NEGATIVE.join(', ')}`;
}
