// Canonical set of message-reaction emojis. Must mirror
// Lovecraft.Backend/Constants/AllowedReactions.cs on the backend.
// Adding/removing requires a coordinated release.
export const REACTION_EMOJIS = [
  '👍',
  '❤️',
  '😂',
  '😮',
  '😢',
  '🙏',
  '🔥',
  '🎉',
] as const;

export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];
