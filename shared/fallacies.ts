// Logical fallacy types and their metadata for the flagging system

export type FallacyType = 
  | 'ad_hominem'
  | 'straw_man'
  | 'false_dichotomy'
  | 'slippery_slope'
  | 'appeal_to_authority'
  | 'cherry_picking'
  | 'circular_reasoning'
  | 'red_herring'
  | 'hasty_generalization'
  | 'appeal_to_emotion'
  | 'misinformation';

export interface Fallacy {
  id: FallacyType;
  name: string;
  icon: string;
  description: string;
  example?: string;
}

export const FALLACIES: Record<FallacyType, Fallacy> = {
  ad_hominem: {
    id: 'ad_hominem',
    name: 'Ad Hominem',
    icon: '👤',
    description: 'Attacking the person instead of their argument',
    example: 'You can\'t trust their climate opinion because they drive a car'
  },
  straw_man: {
    id: 'straw_man',
    name: 'Straw Man',
    icon: '🎪',
    description: 'Misrepresenting or exaggerating someone\'s argument',
    example: 'They want healthcare reform, so they must want socialism'
  },
  false_dichotomy: {
    id: 'false_dichotomy',
    name: 'False Dichotomy',
    icon: '⚖️',
    description: 'Presenting only two options when more exist',
    example: 'You\'re either with us or against us'
  },
  slippery_slope: {
    id: 'slippery_slope',
    name: 'Slippery Slope',
    icon: '⛷️',
    description: 'Claiming one action will lead to extreme consequences without evidence',
    example: 'If we allow this, next thing you know everything will collapse'
  },
  appeal_to_authority: {
    id: 'appeal_to_authority',
    name: 'Appeal to Authority',
    icon: '👑',
    description: 'Using authority or celebrity status instead of evidence',
    example: 'A famous actor said it, so it must be true'
  },
  cherry_picking: {
    id: 'cherry_picking',
    name: 'Cherry Picking',
    icon: '🍒',
    description: 'Selecting only favorable evidence while ignoring contradicting data',
    example: 'Looking at only one study that supports your view'
  },
  circular_reasoning: {
    id: 'circular_reasoning',
    name: 'Circular Reasoning',
    icon: '🔄',
    description: 'Using the conclusion as evidence for itself',
    example: 'It\'s true because I said it\'s true'
  },
  red_herring: {
    id: 'red_herring',
    name: 'Red Herring',
    icon: '🐟',
    description: 'Introducing irrelevant information to distract from the main issue',
    example: 'Why worry about healthcare when there are potholes to fix?'
  },
  hasty_generalization: {
    id: 'hasty_generalization',
    name: 'Hasty Generalization',
    icon: '🏃',
    description: 'Drawing broad conclusions from insufficient evidence',
    example: 'My friend had a bad experience, so the whole system is broken'
  },
  appeal_to_emotion: {
    id: 'appeal_to_emotion',
    name: 'Appeal to Emotion',
    icon: '❤️',
    description: 'Using emotions to manipulate instead of logical reasoning',
    example: 'Think of the children! How can you oppose this?'
  },
  misinformation: {
    id: 'misinformation',
    name: 'Misinformation',
    icon: '⚠️',
    description: 'Stating false or misleading information',
    example: 'Presenting fabricated statistics or debunked claims as facts'
  }
};

export const FALLACY_OPTIONS = Object.values(FALLACIES);

// Helper to get fallacy by ID
export function getFallacy(id: FallacyType): Fallacy {
  return FALLACIES[id];
}

// Helper to validate fallacy type
export function isValidFallacyType(value: string): value is FallacyType {
  return value in FALLACIES;
}
