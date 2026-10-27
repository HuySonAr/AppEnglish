import test from 'node:test';
import assert from 'node:assert/strict';
import { authFormSchema, loginFormSchema, registerFormSchema } from './auth-schemas.js';

const message = (schema, password) => schema.safeParse({ email: 'a@b.co', password }).error?.issues[0].message;

test('login asks for a password before checking its length', () => {
  assert.equal(message(loginFormSchema, ''), 'Enter your password');
  assert.equal(message(loginFormSchema, 'short'), 'Incorrect email or password');
  assert.equal(message(loginFormSchema, 'longenough'), undefined);
});

test('register requires the minimum length', () => {
  assert.equal(message(authFormSchema, 'short'), 'Use at least 8 characters');
  assert.equal(message(authFormSchema, 'longenough'), undefined);
});

test('register asks to repeat the same password', () => {
  const issue = (confirmPassword) => registerFormSchema.safeParse({ email: 'a@b.co', password: 'longenough', confirmPassword }).error?.issues[0];
  assert.equal(issue('').message, 'Repeat your password');
  assert.equal(issue('different1').message, 'Passwords do not match');
  assert.deepEqual(issue('different1').path, ['confirmPassword']);
  assert.equal(issue('longenough'), undefined);
});
