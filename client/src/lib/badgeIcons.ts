import type { LucideIcon } from "lucide-react";
import {
  Award,
  Brain,
  Crown,
  DoorOpen,
  Gem,
  Heart,
  HeartHandshake,
  Lightbulb,
  Medal,
  MessageSquare,
  MessageSquarePlus,
  MessagesSquare,
  Plus,
  PlusCircle,
  Sparkles,
  Star,
  ThumbsUp,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";

/** Known badge / XP-tier Lucide names. Keeps the home bundle from pulling every icon. */
const ICONS: Record<string, LucideIcon> = {
  Award,
  Brain,
  Crown,
  DoorOpen,
  Gem,
  Heart,
  HeartHandshake,
  Lightbulb,
  Medal,
  MessageSquare,
  MessageSquarePlus,
  MessagesSquare,
  Plus,
  PlusCircle,
  Sparkles,
  Star,
  ThumbsUp,
  Trophy,
  UserPlus,
  Users,
};

export function getBadgeIcon(iconName: string | null | undefined): LucideIcon {
  if (!iconName) return Trophy;
  return ICONS[iconName] || Trophy;
}
