import { InsertBadge } from "./schema";

// All available badges in the system
export const BADGE_DEFINITIONS: InsertBadge[] = [
  // Debate Badges
  {
    id: "first_debate",
    name: "First Debate",
    description: "Started your first debate",
    icon: "MessageSquare",
    category: "debate",
    tier: 1,
    requirement: 1,
    requirementType: "debate_count",
  },
  {
    id: "debate_enthusiast",
    name: "Debate Enthusiast",
    description: "Participated in 10 debates",
    icon: "MessageSquarePlus",
    category: "debate",
    tier: 2,
    requirement: 10,
    requirementType: "debate_count",
  },
  {
    id: "debate_veteran",
    name: "Debate Veteran",
    description: "Participated in 50 debates",
    icon: "MessagesSquare",
    category: "debate",
    tier: 3,
    requirement: 50,
    requirementType: "debate_count",
  },
  {
    id: "debate_master",
    name: "Debate Master",
    description: "Participated in 100 debates",
    icon: "Trophy",
    category: "debate",
    tier: 4,
    requirement: 100,
    requirementType: "debate_count",
  },

  // Opinion Badges
  {
    id: "first_opinion",
    name: "First Opinion",
    description: "Shared your first opinion",
    icon: "Lightbulb",
    category: "opinion",
    tier: 1,
    requirement: 1,
    requirementType: "opinion_count",
  },
  {
    id: "opinionated",
    name: "Opinionated",
    description: "Shared 10 opinions",
    icon: "Brain",
    category: "opinion",
    tier: 2,
    requirement: 10,
    requirementType: "opinion_count",
  },
  {
    id: "highly_opinionated",
    name: "Highly Opinionated",
    description: "Shared 50 opinions",
    icon: "Sparkles",
    category: "opinion",
    tier: 3,
    requirement: 50,
    requirementType: "opinion_count",
  },
  {
    id: "opinion_champion",
    name: "Opinion Champion",
    description: "Shared 100 opinions",
    icon: "Crown",
    category: "opinion",
    tier: 4,
    requirement: 100,
    requirementType: "opinion_count",
  },

  // Topic Badges
  {
    id: "conversation_starter",
    name: "Conversation Starter",
    description: "Created your first topic",
    icon: "Plus",
    category: "topic",
    tier: 1,
    requirement: 1,
    requirementType: "topic_count",
  },
  {
    id: "topic_creator",
    name: "Topic Creator",
    description: "Created 10 topics",
    icon: "PlusCircle",
    category: "topic",
    tier: 2,
    requirement: 10,
    requirementType: "topic_count",
  },
  {
    id: "topic_leader",
    name: "Topic Leader",
    description: "Created 25 topics",
    icon: "Star",
    category: "topic",
    tier: 3,
    requirement: 25,
    requirementType: "topic_count",
  },

  // Quality Badges
  {
    id: "logical_thinker",
    name: "Logical Thinker",
    description: "Participated in 10+ debates with minimal logical fallacies (< 5% of messages flagged)",
    icon: "Brain",
    category: "quality",
    tier: 2,
    requirement: 10,
    requirementType: "low_fallacy_rate",
  },
  {
    id: "master_debater",
    name: "Master Debater",
    description: "Participated in 25+ debates with excellent logical reasoning (< 3% of messages flagged)",
    icon: "Award",
    category: "quality",
    tier: 3,
    requirement: 25,
    requirementType: "low_fallacy_rate",
  },
];

// Badge categories for UI organization
export const BADGE_CATEGORIES = [
  { id: "debate", name: "Debate", icon: "MessageSquare" },
  { id: "opinion", name: "Opinion", icon: "Lightbulb" },
  { id: "topic", name: "Topic", icon: "Plus" },
  { id: "quality", name: "Quality", icon: "Award" },
] as const;

// Requirement types for badge unlock checking
export type BadgeRequirementType = 
  | "debate_count" 
  | "opinion_count" 
  | "topic_count" 
  | "low_fallacy_rate";
