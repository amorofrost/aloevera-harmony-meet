import {
  loginSchema,
  registerSchema,
  profileEditSchema,
  messageSchema,
  replySchema,
} from '../validators';

// ---------------------------------------------------------------------------
// loginSchema
// ---------------------------------------------------------------------------
describe('loginSchema', () => {
  it('passes with valid email and non-empty password', () => {
    const result = loginSchema.safeParse({ email: 'user@example.com', password: 'secret' });
    expect(result.success).toBe(true);
  });

  it('fails with invalid email format', () => {
    const result = loginSchema.safeParse({ email: 'not-an-email', password: 'secret' });
    expect(result.success).toBe(false);
  });

  it('fails with empty password', () => {
    const result = loginSchema.safeParse({ email: 'user@example.com', password: '' });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// registerSchema
// ---------------------------------------------------------------------------
const validRegister = {
  email: 'user@example.com',
  password: 'Password1!',
  name: 'Alice',
  age: 25,
  location: 'Moscow',
  gender: 'female',
  bio: 'Hello there',
};

describe('registerSchema', () => {
  it('passes with valid full input', () => {
    const result = registerSchema.safeParse(validRegister);
    expect(result.success).toBe(true);
  });

  it('fails when password is fewer than 8 characters', () => {
    const result = registerSchema.safeParse({ ...validRegister, password: 'Pw1!' });
    expect(result.success).toBe(false);
  });

  it('fails when password is missing uppercase letter', () => {
    const result = registerSchema.safeParse({ ...validRegister, password: 'password1!' });
    expect(result.success).toBe(false);
  });

  it('fails when password is missing special character', () => {
    const result = registerSchema.safeParse({ ...validRegister, password: 'Password1' });
    expect(result.success).toBe(false);
  });

  it('fails when age is 17 (below minimum)', () => {
    const result = registerSchema.safeParse({ ...validRegister, age: 17 });
    expect(result.success).toBe(false);
  });

  it('fails when age is 100 (above maximum)', () => {
    const result = registerSchema.safeParse({ ...validRegister, age: 100 });
    expect(result.success).toBe(false);
  });

  it('fails with invalid email format', () => {
    const result = registerSchema.safeParse({ ...validRegister, email: 'bad-email' });
    expect(result.success).toBe(false);
  });

  it('fails when bio exceeds 500 characters', () => {
    const result = registerSchema.safeParse({ ...validRegister, bio: 'a'.repeat(501) });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// profileEditSchema
// ---------------------------------------------------------------------------
const validProfileEdit = {
  name: 'Alice',
  age: 30,
  location: 'Moscow',
  bio: 'Short bio',
};

describe('profileEditSchema', () => {
  it('passes with valid name, age, and location', () => {
    const result = profileEditSchema.safeParse(validProfileEdit);
    expect(result.success).toBe(true);
  });

  it('fails when age is 17 (below minimum)', () => {
    const result = profileEditSchema.safeParse({ ...validProfileEdit, age: 17 });
    expect(result.success).toBe(false);
  });

  it('fails when age is 100 (above maximum)', () => {
    const result = profileEditSchema.safeParse({ ...validProfileEdit, age: 100 });
    expect(result.success).toBe(false);
  });

  it('fails when bio exceeds 500 characters', () => {
    const result = profileEditSchema.safeParse({ ...validProfileEdit, bio: 'a'.repeat(501) });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// messageSchema
// ---------------------------------------------------------------------------
describe('messageSchema', () => {
  it('passes with non-empty content', () => {
    const result = messageSchema.safeParse({ content: 'Hello!' });
    expect(result.success).toBe(true);
  });

  it('fails with empty string', () => {
    const result = messageSchema.safeParse({ content: '' });
    expect(result.success).toBe(false);
  });

  it('fails with whitespace-only string', () => {
    const result = messageSchema.safeParse({ content: '   ' });
    expect(result.success).toBe(false);
  });

  it('fails when content exceeds 2000 characters', () => {
    const result = messageSchema.safeParse({ content: 'a'.repeat(2001) });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// replySchema
// ---------------------------------------------------------------------------
describe('replySchema', () => {
  it('passes with non-empty content', () => {
    const result = replySchema.safeParse({ content: 'Great post!' });
    expect(result.success).toBe(true);
  });

  it('fails with whitespace-only string', () => {
    const result = replySchema.safeParse({ content: '   ' });
    expect(result.success).toBe(false);
  });

  it('fails when content exceeds 5000 characters', () => {
    const result = replySchema.safeParse({ content: 'a'.repeat(5001) });
    expect(result.success).toBe(false);
  });
});
