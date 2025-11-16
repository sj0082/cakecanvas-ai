export interface DesignRequirements {
  colorPalette?: string;
  decorationStyle?: string;
  themeMood?: string;
  messageText?: string;
  flowerType?: string;
  textureFinish?: string;
  specialElements?: string[];
  occasion?: string;
}

export const DESIGN_REQUIREMENT_OPTIONS = {
  colorPalette: [
    { value: 'ivory-cream', label: 'Ivory & Cream' },
    { value: 'blush-pink', label: 'Blush Pink' },
    { value: 'sage-green', label: 'Sage Green' },
    { value: 'dusty-rose', label: 'Dusty Rose' },
    { value: 'champagne-gold', label: 'Champagne & Gold' },
    { value: 'navy-blue', label: 'Navy Blue' },
    { value: 'lavender-purple', label: 'Lavender & Purple' },
    { value: 'terracotta-warm', label: 'Terracotta & Warm' },
    { value: 'monochrome', label: 'Monochrome' },
    { value: 'custom', label: 'Custom' }
  ],
  decorationStyle: [
    { value: 'minimalist', label: 'Minimalist' },
    { value: 'classic-elegant', label: 'Classic Elegant' },
    { value: 'romantic', label: 'Romantic' },
    { value: 'modern-contemporary', label: 'Modern Contemporary' },
    { value: 'rustic-natural', label: 'Rustic & Natural' },
    { value: 'luxury-opulent', label: 'Luxury & Opulent' },
    { value: 'artistic-creative', label: 'Artistic & Creative' },
    { value: 'vintage', label: 'Vintage' }
  ],
  themeMood: [
    { value: 'elegant-sophisticated', label: 'Elegant & Sophisticated' },
    { value: 'romantic-dreamy', label: 'Romantic & Dreamy' },
    { value: 'cheerful-vibrant', label: 'Cheerful & Vibrant' },
    { value: 'calm-serene', label: 'Calm & Serene' },
    { value: 'dramatic-bold', label: 'Dramatic & Bold' },
    { value: 'playful-whimsical', label: 'Playful & Whimsical' },
    { value: 'timeless-classic', label: 'Timeless & Classic' }
  ],
  messageText: [
    { value: 'none', label: 'No message' },
    { value: 'happy-birthday', label: 'Happy Birthday' },
    { value: 'congratulations', label: 'Congratulations' },
    { value: 'thank-you', label: 'Thank You' },
    { value: 'custom', label: 'Custom message' }
  ],
  flowerType: [
    { value: 'none', label: 'No flowers' },
    { value: 'roses', label: 'Roses' },
    { value: 'peonies', label: 'Peonies' },
    { value: 'hydrangeas', label: 'Hydrangeas' },
    { value: 'eucalyptus', label: 'Eucalyptus' },
    { value: 'baby-breath', label: "Baby's Breath" },
    { value: 'ranunculus', label: 'Ranunculus' },
    { value: 'garden-roses', label: 'Garden Roses' },
    { value: 'mixed-botanicals', label: 'Mixed Botanicals' },
    { value: 'sugar-flowers', label: 'Sugar Flowers' }
  ],
  textureFinish: [
    { value: 'smooth-fondant', label: 'Smooth Fondant' },
    { value: 'textured-buttercream', label: 'Textured Buttercream' },
    { value: 'naked-semi-naked', label: 'Naked / Semi-Naked' },
    { value: 'ruffled', label: 'Ruffled' },
    { value: 'brushstroke', label: 'Brushstroke' },
    { value: 'watercolor', label: 'Watercolor Effect' },
    { value: 'metallic', label: 'Metallic Finish' },
    { value: 'mirror-glaze', label: 'Mirror Glaze' }
  ],
  specialElements: [
    { value: 'fresh-flowers', label: 'Fresh Flowers' },
    { value: 'dried-flowers', label: 'Dried Flowers' },
    { value: 'berries-fruits', label: 'Berries / Fruits' },
    { value: 'macarons', label: 'Macarons' },
    { value: 'topper', label: 'Cake Topper' },
    { value: 'drip-effect', label: 'Drip Effect' },
    { value: 'ombre-gradient', label: 'Ombré / Gradient' },
    { value: 'geometric-shapes', label: 'Geometric Shapes' },
    { value: 'gold-leaf', label: 'Gold Leaf Accents' },
    { value: 'fresh-fruits', label: 'Fresh Fruits' }
  ],
  occasion: [
    { value: 'wedding', label: 'Wedding' },
    { value: 'birthday', label: 'Birthday' },
    { value: 'anniversary', label: 'Anniversary' },
    { value: 'engagement', label: 'Engagement' },
    { value: 'baby-shower', label: 'Baby Shower' },
    { value: 'graduation', label: 'Graduation' },
    { value: 'corporate', label: 'Corporate Event' },
    { value: 'other', label: 'Other' }
  ]
};
