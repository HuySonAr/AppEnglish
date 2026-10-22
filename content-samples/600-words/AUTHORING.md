# Authoring a lesson file

One JSON file per lesson in `lessons/`, named as `pack.json` lists it. The
reference is `lessons/01-contracts.json`: copy its shape exactly. Check a file
with `node scripts/validate-600-words.mjs <number>` from `apps/content-service`
(it runs the real schema and publishing rules); fix every `error`, and every
`warn` you can.

## Rules that are not negotiable

- **Original text only.** The word list and the lesson title come from the
  book; every sentence (meanings, examples, the fill-in passage, transcripts,
  passages, questions, options, explanations) is written fresh for AppEnglish.
  Do not reproduce, paraphrase closely or translate any passage, example
  sentence or test question from *600 Essential Words for the TOEIC* or any
  other TOEIC book.
- **Exactly the 12 words of the lesson** in `pack.json`, spelled the same, in
  the same order. (Lesson 26 has 11: write those.)
- **Vietnamese** for `meaning`, `exampleMeaning` and every `explanation`.
  English for everything else. Use plain, natural Vietnamese; no machine-
  translation phrasing.
- Business and everyday workplace contexts, TOEIC style: offices, suppliers,
  customers, travel, services. No politics, religion, violence or real
  companies and brands.
- No `phonetic` and no audio: the user handles pronunciation later.

## Fields

```
number, title                       as in pack.json
vocabulary[12]                      word, partOfSpeech, meaning, example, exampleMeaning
fillIn                              passage with ___ blanks, answers (one per blank, in order)
test.part1                          photoHint, options[4], answer, explanation
test.part2[2]                       question, options[3], answer, explanation
test.part3                          transcript, questions[3] (prompt, options[4], answer, explanation)
test.part4                          transcript, questions[3]
test.part5[6]                       prompt with _____, options[4], answer, explanation
test.part6                          passage with exactly three ___, questions[3] (options[4], answer, explanation)
test.part7                          passage, questions[5] (prompt, options[4], answer, explanation)
```

Optional: `test.part1.transcript` and `test.part2Transcript` hold what the
recording says when it is not just the options read out (the generated
transcript is "Number 1. …" with the lettered options); Export JSON writes
them when the editor's transcript differs from the generated one.

The same files are what the editor's **Import JSON** reads and **Export
JSON** writes (D124), so a lesson can be edited here, imported, checked and
published without the seed script.

`answer` is the letter of the correct option: "A".."D" (Part 2: "A".."C").
`partOfSpeech` is one of: noun, verb, adjective, adverb, preposition,
conjunction, pronoun, determiner, interjection, phrase. Phrasal verbs ("abide
by", "figure out") are `verb`; other multi-word entries ("as needed", "on
track", "be in charge of") are `phrase`.

## Vocabulary

- `meaning`: the Vietnamese sense used in business English, 3–12 words; add a
  second sense after a semicolon when the word commonly has one.
- `example`: one natural English sentence of 10–20 words using the word in
  its listed form or an inflection, in a workplace situation.
- `exampleMeaning`: the Vietnamese translation of the example.

## Fill-in (the "Words in Context" passage)

- One connected story of 130–200 words in 2–3 paragraphs about a workplace
  situation of the lesson's theme, with 10–12 blanks written as `___` (three
  underscores, nothing else).
- Every lesson word is used once (use an inflected form where the grammar
  needs it: "engaged", "parties", "obligates"). `answers` lists the exact
  text of each blank in passage order; it is what learners see as a shuffled
  word bank, so answers must read naturally in the blank.
- Do not put the answer word elsewhere in the passage where it would give the
  blank away.

## Test (23 questions, TOEIC format)

All listening parts are written as what the recording will say; the user
records the audio later, so transcripts must be complete and speakable.

- **Part 1** (1 question): `photoHint` describes, in Vietnamese, the photograph
  the user should add (a workplace scene). `options` are four short spoken
  statements about the photo, one true; wrong ones use a similar sound, a
  wrong action or a wrong object, as in TOEIC.
- **Part 2** (2 questions): a spoken question (Wh- or Yes/No) with three
  short responses, one appropriate. Wrong responses repeat a word of the
  question with another meaning, answer a different question type, or
  answer Yes/No to a Wh- question.
- **Part 3** (3 questions): a conversation of 6–10 lines between `Man:` and
  `Woman:` (these two labels only, each line on its own line), about the
  lesson's theme and using 3–5 of the lesson words. Questions: one about the
  topic or purpose, one detail, one about a request, problem or next step.
- **Part 4** (3 questions): a talk of 100–150 words by one speaker
  (announcement, voicemail, short speech, radio notice, tour guide) using
  3–5 lesson words. Three questions as in Part 3.
- **Part 5** (6 questions): one sentence each with a blank written `_____`
  (`___` or `-------` are accepted too); four options testing the lesson's words, mostly word forms
  of the same root (noun / verb / adjective / adverb), sometimes a choice
  between lesson words. Exactly one fits.
- **Part 6** (3 questions): a short email, memo or notice of 70–120 words with
  exactly three `___` blanks; each question lists four options for its blank
  in passage order (word forms or vocabulary; one may be a short phrase).
- **Part 7** (5 questions): one document of 120–200 words (email, letter,
  notice, advertisement, article, schedule, form); a table is written one row
  per line as `| cell | cell |`. Questions: purpose or main idea, two or three
  details, one inference or "what is the reader asked to do". Options are
  short and all plausible.
- Every `explanation` is 1–2 Vietnamese sentences saying why the answer is
  right (grammar rule or the line of the text that proves it) and, when
  useful, why a tempting option is wrong.
- Use the lesson's words throughout the test so every word appears at least
  once somewhere in it.
- Options of one question are all different, exactly one is correct, no
  "all of the above", no trick questions about tiny details.

## Export from the system

`pnpm --filter @appenglish/content-service export:600-words` (reviews) and
`export:600-words -- --lessons` write what the running content-service holds
(the published version, else the draft) back into these files, so content
written in the editor stays in the pack.

## Unit review (one file per unit, `reviews/NN-slug.json`)

The Word Review of a unit (D121, D129): a 19-question Reading test on the
words of its five lessons, taken after the last lesson; 80% opens the next
unit. Part 5 is questions 1-10, Part 6 questions 11-19.
The reference is `reviews/01-general-business.json`. Check with
`node scripts/validate-600-words.mjs reviews <unit number>`.

```
unit, title                         as in pack.json (unit number 1-10)
part5[10]                           prompt with _____, options[4], answer, explanation
part6[3]                            passage with exactly three ___, questions[3] (options[4], answer, explanation)
```

- Use as many of the 60 words of the unit as the 19 items allow (as a
  correct answer, an option or inside a passage), spread across the five
  lessons, not just the first; the validator lists the words left out as a
  warning, not an error.
- Part 5: 10 sentences, mostly word forms of one root (noun / verb /
  adjective / adverb) and a few choices between four different words of the
  unit; exactly one fits. Workplace sentences, 10–20 words.
- Part 6: three documents of 70–120 words (email, memo, notice, letter,
  article) with exactly three `___` blanks each, in passage order; each blank
  has four options (word forms or vocabulary) and one correct answer.
- Explanations in Vietnamese, 1–2 sentences, as in the lessons.
- Original text only, as for the lessons.

## Style

- ASCII punctuation in English text (straight quotes, `...`), except for
  names that need accents. Vietnamese text uses full diacritics.
- Keep names and places varied across lessons (not the same "Mrs. Tran" every
  time). Mix men and women in roles.
- Numbers, dates and prices should be consistent inside a passage.
