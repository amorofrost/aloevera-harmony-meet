import {
  loginSchema,
  registerSchema,
  profileEditSchema,
  telegramRegisterSchema,
  messageSchema,
  replySchema,
  createTopicSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  promptsSchema,
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
  country: 'RU',
  region: 'Moscow',
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
  country: 'RU',
  region: 'Moscow',
  bio: 'Short bio',
};

describe('profileEditSchema', () => {
  it('passes with valid name, age, and country', () => {
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

// ---------------------------------------------------------------------------
// createTopicSchema
// ---------------------------------------------------------------------------
describe('createTopicSchema', () => {
  it('passes with valid title and content', () => {
    const result = createTopicSchema.safeParse({
      title: 'Valid topic title',
      content: 'Valid content that is long enough',
    });
    expect(result.success).toBe(true);
  });

  it('fails when title is shorter than 5 characters', () => {
    const result = createTopicSchema.safeParse({
      title: 'Hi',
      content: 'Valid content that is long enough',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Title must be at least 5 characters');
  });

  it('fails when title is longer than 100 characters', () => {
    const result = createTopicSchema.safeParse({
      title: 'A'.repeat(101),
      content: 'Valid content that is long enough',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Title is too long');
  });

  it('fails when content is shorter than 10 characters', () => {
    const result = createTopicSchema.safeParse({
      title: 'Valid title',
      content: 'Short',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Content must be at least 10 characters');
  });

  it('fails when title is whitespace only', () => {
    const result = createTopicSchema.safeParse({
      title: '     ',
      content: 'Valid content that is long enough',
    });
    expect(result.success).toBe(false);
  });

  it('fails when content is whitespace only', () => {
    const result = createTopicSchema.safeParse({
      title: 'Valid title',
      content: '          ',
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// forgotPasswordSchema
// ---------------------------------------------------------------------------
describe('forgotPasswordSchema', () => {
  it('passes with a valid email', () => {
    const result = forgotPasswordSchema.safeParse({ email: 'user@example.com' });
    expect(result.success).toBe(true);
  });

  it('fails with invalid email format', () => {
    const result = forgotPasswordSchema.safeParse({ email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('fails with empty email', () => {
    const result = forgotPasswordSchema.safeParse({ email: '' });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// resetPasswordSchema
// ---------------------------------------------------------------------------
const validReset = { password: 'Password1!', confirmPassword: 'anything' };

describe('resetPasswordSchema', () => {
  it('passes with a strong password and non-empty confirmPassword', () => {
    const result = resetPasswordSchema.safeParse(validReset);
    expect(result.success).toBe(true);
  });

  it('fails when password is too short', () => {
    const result = resetPasswordSchema.safeParse({ ...validReset, password: 'Aa1!' });
    expect(result.success).toBe(false);
  });

  it('fails when password has no uppercase letter', () => {
    const result = resetPasswordSchema.safeParse({ ...validReset, password: 'password1!' });
    expect(result.success).toBe(false);
  });

  it('fails when password has no lowercase letter', () => {
    const result = resetPasswordSchema.safeParse({ ...validReset, password: 'PASSWORD1!' });
    expect(result.success).toBe(false);
  });

  it('fails when password has no digit', () => {
    const result = resetPasswordSchema.safeParse({ ...validReset, password: 'Password!' });
    expect(result.success).toBe(false);
  });

  it('fails when password has no special character', () => {
    const result = resetPasswordSchema.safeParse({ ...validReset, password: 'Password1' });
    expect(result.success).toBe(false);
  });

  it('fails with empty confirmPassword', () => {
    const result = resetPasswordSchema.safeParse({ ...validReset, confirmPassword: '' });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// promptsSchema
// ---------------------------------------------------------------------------
describe('promptsSchema', () => {
  const ok = (p: unknown) => promptsSchema.safeParse(p).success;
  const fail = (p: unknown) => !promptsSchema.safeParse(p).success;

  it('accepts empty array', () => expect(ok([])).toBe(true));
  it('accepts up to 3 unique entries', () =>
    expect(ok([
      { promptId: 'looking_for',    answer: 'a' },
      { promptId: 'concert_memory', answer: 'b' },
      { promptId: 'playlist',       answer: 'c' },
    ])).toBe(true));
  it('rejects 4 entries', () =>
    expect(fail([
      { promptId: 'looking_for',    answer: 'a' },
      { promptId: 'concert_memory', answer: 'b' },
      { promptId: 'playlist',       answer: 'c' },
      { promptId: 'instrument',     answer: 'd' },
    ])).toBe(true));
  it('rejects duplicate promptId', () =>
    expect(fail([
      { promptId: 'looking_for', answer: 'a' },
      { promptId: 'looking_for', answer: 'b' },
    ])).toBe(true));
  it('rejects answer > 200 chars', () =>
    expect(fail([
      { promptId: 'looking_for', answer: 'x'.repeat(201) },
    ])).toBe(true));
  it('rejects HTML in answer', () =>
    expect(fail([
      { promptId: 'looking_for', answer: '<b>hi</b>' },
    ])).toBe(true));
  it('rejects unknown promptId', () =>
    expect(fail([
      { promptId: 'totally_invented', answer: 'a' },
    ])).toBe(true));
});

// ---------------------------------------------------------------------------
// country/region in registerSchema
// ---------------------------------------------------------------------------
describe('country/region in registerSchema', () => {
  const base = {
    email: 'a@b.co',
    password: 'Aa1!aaaa',
    name: 'X',
    age: 25,
    gender: 'male',
  };

  it('accepts ISO country and region', () => {
    expect(registerSchema.safeParse({ ...base, country: 'RU', region: 'Москва' }).success).toBe(true);
  });

  it('accepts custom country', () => {
    expect(registerSchema.safeParse({ ...base, country: 'Atlantis', region: '' }).success).toBe(true);
  });

  it('rejects empty country', () => {
    expect(registerSchema.safeParse({ ...base, country: '', region: '' }).success).toBe(false);
  });

  it('rejects country longer than 56 chars', () => {
    expect(registerSchema.safeParse({ ...base, country: 'a'.repeat(57), region: '' }).success).toBe(false);
  });

  it('rejects region longer than 80 chars', () => {
    expect(registerSchema.safeParse({ ...base, country: 'RU', region: 'a'.repeat(81) }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// country/region in profileEditSchema
// ---------------------------------------------------------------------------
describe('country/region in profileEditSchema', () => {
  it('accepts country + empty region', () => {
    expect(profileEditSchema.safeParse({
      name: 'X', age: 25, country: 'RU', region: '',
    }).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// country/region in telegramRegisterSchema
// ---------------------------------------------------------------------------
describe('country/region in telegramRegisterSchema', () => {
  it('accepts ISO country', () => {
    expect(telegramRegisterSchema.safeParse({
      name: 'X', age: 25, country: 'RU', region: 'Москва', gender: 'male',
    }).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// secondary country/region in registerSchema
// ---------------------------------------------------------------------------
describe('secondary country/region in registerSchema', () => {
  const base = {
    email: 'a@b.co',
    password: 'Aa1!aaaa',
    name: 'X',
    age: 25,
    country: 'RU',
    region: 'Москва',
    gender: 'male',
  };

  it('accepts secondary country and region', () => {
    expect(registerSchema.safeParse({ ...base, secondaryCountry: 'TH', secondaryRegion: 'Пхукет' }).success).toBe(true);
  });

  it('accepts absent secondary fields', () => {
    expect(registerSchema.safeParse(base).success).toBe(true);
  });

  it('rejects secondaryCountry longer than 56 chars', () => {
    expect(registerSchema.safeParse({ ...base, secondaryCountry: 'a'.repeat(57) }).success).toBe(false);
  });

  it('rejects secondaryRegion longer than 80 chars', () => {
    expect(registerSchema.safeParse({ ...base, secondaryRegion: 'a'.repeat(81) }).success).toBe(false);
  });
});
