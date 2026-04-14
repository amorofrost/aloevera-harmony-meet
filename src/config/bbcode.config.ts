export const BBCODE_CONFIG = {
  bold:          true,
  italic:        true,
  underline:     false,
  strikethrough: true,
  url:           false,
  quote:         true,
  code:          false,
  spoiler:       true,
} as const;

export type BbcodeTag = keyof typeof BBCODE_CONFIG;
