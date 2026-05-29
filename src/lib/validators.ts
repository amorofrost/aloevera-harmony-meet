import { z } from 'zod';
import { PROMPT_IDS } from '@/data/prompts';

const ACCOUNT_NAME_RE = /^[A-Za-z][A-Za-z0-9_]{4,31}$/;
export const RESERVED_ACCOUNT_NAMES = new Set<string>([
  'admin', 'root', 'system', 'support', 'help', 'api', 'auth', 'login', 'logout',
  'register', 'settings', 'profile', 'user', 'users', 'me', 'you', 'search', 'feed',
  'friends', 'talks', 'aloevera', 'aloeve', 'aloeband', 'telegram', 'google',
  'official', 'mod', 'moderator', 'staff', 'undefined', 'null', 'anonymous', 'bot',
]);

export const accountNameSchema = z.string()
  .regex(ACCOUNT_NAME_RE, 'auth.accountNameInvalid')
  .refine((v) => !RESERVED_ACCOUNT_NAMES.has(v.toLowerCase()), 'auth.accountNameReserved');

export const loginSchema = z.object({
  email: z.string().email('auth.invalidEmail'),
  password: z.string().min(1, 'auth.passwordRequired'),
});

export const registerSchema = z.object({
  accountName: accountNameSchema,
  email: z.string().email('auth.invalidEmail'),
  password: z
    .string()
    .min(8, 'auth.passwordMin8')
    .regex(/[A-Z]/, 'auth.passwordUppercase')
    .regex(/[a-z]/, 'auth.passwordLowercase')
    .regex(/[0-9]/, 'auth.passwordNumber')
    .regex(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/, 'auth.passwordSpecial'),
  name: z.string().min(1, 'auth.nameRequired'),
  age: z.preprocess(
    (val) => (Number.isNaN(val) ? undefined : val),
    z.number().int().min(18, 'auth.ageMin').max(99, 'auth.ageMax').optional()
  ),
  country: z.string().min(1, 'auth.countryRequired').max(56, 'auth.countryMax'),
  region: z.string().max(80, 'auth.regionMax').optional(),
  secondaryCountry: z.string().max(56, 'auth.secondaryCountryMax').optional(),
  secondaryRegion: z.string().max(80, 'auth.secondaryRegionMax').optional(),
  gender: z.string().min(1, 'auth.genderRequired'),
  bio: z.string().max(500, 'auth.bioMax').optional(),
  /** Event invite; optional when registration is open, validated as required via registerSchemaWithInvite when policy demands it */
  inviteCode: z.string().optional(),
});

export const profileEditSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  age: z
    .number({ invalid_type_error: 'Age is required' })
    .int()
    .min(18, 'Must be at least 18')
    .max(99, 'Must be 99 or under'),
  country: z.string().min(1, 'Country is required').max(56, 'Country must be 56 characters or less'),
  region: z.string().max(80, 'Region must be 80 characters or less').optional(),
  secondaryCountry: z.string().max(56, 'Secondary country must be 56 characters or less').optional(),
  secondaryRegion: z.string().max(80, 'Secondary region must be 80 characters or less').optional(),
  bio: z.string().max(500, 'Bio must be 500 characters or less').optional(),
  instagramHandle: z
    .string()
    .max(30, 'Max 30 characters')
    .regex(/^[a-zA-Z0-9_.]*$/, 'Only letters, numbers, . and _')
    .optional(),
});

export const messageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Message can't be empty")
    .max(2000, 'Message is too long'),
});

export const replySchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Reply can't be empty")
    .max(5000, 'Reply is too long'),
});

export const createTopicSchema = z.object({
  title: z.string().trim().min(5, 'Title must be at least 5 characters').max(100, 'Title is too long'),
  content: z.string().trim().min(10, 'Content must be at least 10 characters').max(5000, 'Content is too long'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Enter a valid email'),
});

export const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, 'At least 8 characters')
    .regex(/[A-Z]/, 'One uppercase letter')
    .regex(/[a-z]/, 'One lowercase letter')
    .regex(/[0-9]/, 'One number')
    .regex(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/, 'One special character'),
  confirmPassword: z.string().min(1),
});

export const registerSchemaWithInvite = registerSchema.extend({
  inviteCode: z.string().min(1, 'register.inviteCodeRequired'),
});

/** Registration via Telegram pending ticket — no email/password fields (those come later via attach). */
export const telegramRegisterSchema = z.object({
  accountName: accountNameSchema,
  name: z.string().min(1, 'Name is required'),
  age: z.preprocess(
    (val) => (Number.isNaN(val) ? undefined : val),
    z.number().int().min(18, 'Must be at least 18').max(99, 'Must be 99 or under').optional()
  ),
  country: z.string().min(1, 'Country is required').max(56, 'Country must be 56 characters or less'),
  region: z.string().max(80, 'Region must be 80 characters or less').optional(),
  secondaryCountry: z.string().max(56, 'Secondary country must be 56 characters or less').optional(),
  secondaryRegion: z.string().max(80, 'Secondary region must be 80 characters or less').optional(),
  gender: z.string().min(1, 'Gender is required'),
  bio: z.string().max(500, 'Bio must be 500 characters or less').optional(),
  inviteCode: z.string().optional(),
});

export const telegramRegisterSchemaWithInvite = telegramRegisterSchema.extend({
  inviteCode: z.string().min(1, 'Invite code is required'),
});

/** Registration via Google pending ticket — same fields as Telegram flow. */
export const googleRegisterSchema = telegramRegisterSchema;
export const googleRegisterSchemaWithInvite = telegramRegisterSchemaWithInvite;

export const telegramLinkLoginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export const attachEmailSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z
    .string()
    .min(8, 'At least 8 characters')
    .regex(/[A-Z]/, 'One uppercase letter')
    .regex(/[a-z]/, 'One lowercase letter')
    .regex(/[0-9]/, 'One number')
    .regex(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/, 'One special character'),
});

const HTML_RE = /<[a-z!\/][\s\S]*?>/i;

export const promptsSchema = z.array(
  z.object({
    promptId: z.string().refine(id => (PROMPT_IDS as readonly string[]).includes(id), {
      message: 'Unknown prompt id',
    }),
    answer: z.string()
      .max(200, 'Answer must be 200 characters or less')
      .refine(s => !HTML_RE.test(s), 'HTML is not allowed'),
  })
).max(3, 'At most 3 prompts allowed').refine(
  arr => new Set(arr.map(a => a.promptId)).size === arr.length,
  'Duplicate prompt id',
);

export type LoginSchema = z.infer<typeof loginSchema>;
export type RegisterSchema = z.infer<typeof registerSchema>;
export type RegisterSchemaWithInvite = z.infer<typeof registerSchemaWithInvite>;
export type TelegramRegisterSchema = z.infer<typeof telegramRegisterSchema>;
export type TelegramRegisterSchemaWithInvite = z.infer<typeof telegramRegisterSchemaWithInvite>;
export type GoogleRegisterSchema = z.infer<typeof googleRegisterSchema>;
export type GoogleRegisterSchemaWithInvite = z.infer<typeof googleRegisterSchemaWithInvite>;
export type TelegramLinkLoginSchema = z.infer<typeof telegramLinkLoginSchema>;
export type AttachEmailSchema = z.infer<typeof attachEmailSchema>;
export type ProfileEditSchema = z.infer<typeof profileEditSchema>;
export type MessageSchema = z.infer<typeof messageSchema>;
export type ReplySchema = z.infer<typeof replySchema>;
export type CreateTopicFormData = z.infer<typeof createTopicSchema>;
export type ForgotPasswordSchema = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordSchema = z.infer<typeof resetPasswordSchema>;
export type PromptsSchema = z.infer<typeof promptsSchema>;
