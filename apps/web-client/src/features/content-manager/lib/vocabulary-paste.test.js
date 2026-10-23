import test from 'node:test';
import assert from 'node:assert/strict';
import { newVocabulary } from './lesson-draft.js';
import { parsePastedVocabulary, vocabularyPastePlan } from './vocabulary-paste.js';

const pasted = `word | part of speech | meaning | example
contract | noun | hợp đồng | We signed the contract yesterday. | Chúng tôi đã ký hợp đồng hôm qua. | /ˈkɒntrækt/

negotiate | v. | đàm phán | They negotiated a better price.
on behalf of\t(phr)\tthay mặt cho\tI am writing on behalf of my manager.`;

test('pasted words are read one per line, from pipes or tabs', () => {
  const words = parsePastedVocabulary(pasted);
  assert.deepEqual(words.map((item) => [item.word, item.partOfSpeech, item.columns]), [
    ['contract', 'noun', 6],
    ['negotiate', 'v.', 4],
    ['on behalf of', '(phr)', 4],
  ]);
  assert.deepEqual([words[0].exampleMeaning, words[0].phonetic, words[1].phonetic], ['Chúng tôi đã ký hợp đồng hôm qua.', '/ˈkɒntrækt/', '']);
});

test('pasted words are added, and a word already there is updated', () => {
  const old = { ...newVocabulary(), word: 'Contract', partOfSpeech: 'noun', meaning: 'old', example: 'Old.', phonetic: '/old/', audioUkMediaId: 'audio-1' };
  const verb = { ...newVocabulary(), word: 'contract', partOfSpeech: 'verb', meaning: 'co lại', example: 'Metal contracts.' };
  const { vocabulary, count, lines } = vocabularyPastePlan([old, verb], pasted);
  assert.equal(count, 3);
  assert.deepEqual(lines.map((line) => [line.title, line.note, line.errors]), [
    ['contract', ' · noun · updates the word already there', []],
    ['negotiate', ' · verb · new word', []],
    ['on behalf of', ' · phrase · new word', []],
  ]);
  assert.deepEqual(vocabulary.map((item) => [item.word, item.partOfSpeech]), [
    ['contract', 'noun'],
    ['contract', 'verb'],
    ['negotiate', 'verb'],
    ['on behalf of', 'phrase'],
  ]);
  assert.deepEqual(
    [vocabulary[0].id, vocabulary[0].meaning, vocabulary[0].phonetic, vocabulary[0].audioUkMediaId],
    [old.id, 'hợp đồng', '/ˈkɒntrækt/', 'audio-1'],
  );
  assert.equal(vocabulary[1], verb);
  assert.ok(vocabulary[2].id);

  const kept = vocabularyPastePlan([old], 'contract | n | giao kèo | A new example.').vocabulary[0];
  assert.deepEqual([kept.meaning, kept.phonetic], ['giao kèo', '/old/']);
});

test('lines that cannot be used are reported and nothing changes', () => {
  const before = [];
  const { vocabulary, lines } = vocabularyPastePlan(
    before,
    'ticket | noun | vé | I bought a ticket.\nticket | n | vé | Again.\nrun | fast | chạy | He runs.\nagenda | noun | chương trình\nplan | noun | kế hoạch | A plan. | Một kế hoạch. | /plæn/ | extra',
  );
  assert.deepEqual(lines.map((line) => line.errors), [
    [],
    ['this word appears twice'],
    ['"fast" is not a part of speech'],
    ['no example sentence'],
    ['more than 6 columns'],
  ]);
  assert.equal(vocabulary, before);
});
