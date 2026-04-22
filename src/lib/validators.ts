import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z
    .string()
    .min(8, 'At least 8 characters')
    .regex(/[A-Z]/, 'One uppercase letter')
    .regex(/[a-z]/, 'One lowercase letter')
    .regex(/[0-9]/, 'One number')
    .regex(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/, 'One special character'),
  name: z.string().min(1, 'Name is required'),
  age: z
    .number({ invalid_type_error: 'Age is required' })
    .int()
    .min(18, 'Must be at least 18')
    .max(99, 'Must be 99 or under'),
  location: z.string().min(1, 'Location is required'),
  gender: z.string().min(1, 'Gender is required'),
  bio: z.string().max(500, 'Bio must be 500 characters or less').optional(),
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
  location: z.string().min(1, 'Location is required'),
  bio: z.string().max(500, 'Bio must be 500 characters or less').optional(),
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
  inviteCode: z.string().min(1, 'Invite code is required'),
});

/** Registration via Telegram pending ticket — no email/password fields (those come later via attach). */
export const telegramRegisterSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  age: z
    .number({ invalid_type_error: 'Age is required' })
    .int()
    .min(18, 'Must be at least 18')
    .max(99, 'Must be 99 or under'),
  location: z.string().min(1, 'Location is required'),
  gender: z.string().min(1, 'Gender is required'),
  bio: z.string().max(500, 'Bio must be 500 characters or less').optional(),
  inviteCode: z.string().optional(),
});

export const telegramRegisterSchemaWithInvite = telegramRegisterSchema.extend({
  inviteCode: z.string().min(1, 'Invite code is required'),
});

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

export type LoginSchema = z.infer<typeof loginSchema>;
export type RegisterSchema = z.infer<typeof registerSchema>;
export type RegisterSchemaWithInvite = z.infer<typeof registerSchemaWithInvite>;
export type TelegramRegisterSchema = z.infer<typeof telegramRegisterSchema>;
export type TelegramRegisterSchemaWithInvite = z.infer<typeof telegramRegisterSchemaWithInvite>;
export type TelegramLinkLoginSchema = z.infer<typeof telegramLinkLoginSchema>;
export type AttachEmailSchema = z.infer<typeof attachEmailSchema>;
export type ProfileEditSchema = z.infer<typeof profileEditSchema>;
export type MessageSchema = z.infer<typeof messageSchema>;
export type ReplySchema = z.infer<typeof replySchema>;
export type CreateTopicFormData = z.infer<typeof createTopicSchema>;
export type ForgotPasswordSchema = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordSchema = z.infer<typeof resetPasswordSchema>;
