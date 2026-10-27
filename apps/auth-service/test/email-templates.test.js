import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, inviteMessage, otpMessage } from '../src/auth/email-templates.js';

test('verification email carries the code in text and html', () => {
  const message = otpMessage('042917', 'VERIFY_EMAIL');
  assert.equal(message.subject, 'Your AppEnglish verification code');
  assert.match(message.text, /042917/);
  assert.match(message.html, /042917/);
  assert.match(message.html, /Confirm your email/);
  assert.match(message.html, /expires in 5 minutes/);
});

test('reset email uses its own copy', () => {
  const message = otpMessage('111222', 'RESET_PASSWORD');
  assert.equal(message.subject, 'Your AppEnglish password reset code');
  assert.match(message.html, /Reset your password/);
});

test('invite email escapes the display name and links to the web app', () => {
  const previous = process.env.WEB_APP_URL;
  process.env.WEB_APP_URL = 'https://app.example.com/';
  try {
    const message = inviteMessage('a+b@x.co', '123456', { role: 'TEACHER', displayName: '<Lan>' });
    assert.match(message.html, /&lt;Lan&gt;/);
    assert.doesNotMatch(message.html, /<Lan>/);
    assert.match(message.html, /https:\/\/app\.example\.com\/accept-invite\?email=a%2Bb%40x\.co/);
    assert.match(message.text, /as a teacher/);
  } finally {
    if (previous === undefined) delete process.env.WEB_APP_URL;
    else process.env.WEB_APP_URL = previous;
  }
});

test('escapeHtml replaces markup characters', () => {
  assert.equal(escapeHtml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
});
