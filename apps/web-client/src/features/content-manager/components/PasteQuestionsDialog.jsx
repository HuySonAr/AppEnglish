import { MOCK_FIRST_QUESTION_NUMBERS, pastePreview, pastedPassagesPlan, withPastedQuestions } from '../lib/mock-draft.js';
import { parsePastedPassages, parsePastedQuestions } from '../lib/question-paste.js';
import { PasteDialog } from './PasteDialog.jsx';

const optionLetters = ['A', 'B', 'C', 'D'];
const answerOf = (question) => (question.correct === null ? '?' : optionLetters[question.correct]);
const optionNames = ['First', 'Second', 'Third', 'Fourth'];
const questionExample = (number, spec) =>
  [
    `Question ${number}`,
    ...(spec.question.image && !spec.question.prompt ? [] : ['Text of the question']),
    ...optionLetters.slice(0, spec.optionCount).map((letter, index) => `(${letter}) ${optionNames[index]} option`),
    'Correct Answer: B',
  ].join('\n');
const passageExample = (number, last, blanks) => `Passage 1 – Questions ${number}–${last}
${blanks ? `Text of the passage, with [${number}] where each blank is.` : 'Text of the document.\n| Heading | Heading |\n| Cell | Cell |'}
Question ${number}${blanks ? '' : '\nText of the question'}
(A) First option
(B) Second option
(C) Third option
(D) Fourth option
Correct Answer: B`;

function pastePlan(part, spec, setName, text) {
  if (spec.group.passage) {
    const plan = pastedPassagesPlan(part, spec, parsePastedPassages(text, { blanks: Boolean(spec.group.blanks) }));
    return {
      part: plan.part,
      count: plan.rows.reduce((sum, row) => sum + row.questions.length, 0),
      lines: plan.rows.map((row) => ({
        title: `Passage ${row.set + 1}`,
        note: ` · questions ${row.from}–${row.to}${row.replaces ? ' · replaces what is there' : ''} · answers ${row.questions.map(answerOf).join(' ')}`,
        text: row.passage,
        errors: row.errors,
        warnings: row.warnings,
      })),
    };
  }
  const rows = pastePreview(part, spec, parsePastedQuestions(text));
  return {
    part: withPastedQuestions(part, spec, rows),
    count: rows.length,
    lines: rows.map((row) => ({
      title: `Question ${row.number}`,
      note: `${setName ? ` · ${setName} ${row.set + 1}` : ''}${row.replaces ? ' · replaces what is there' : ''}${row.correct === null ? '' : ` · answer ${answerOf(row)}`}`,
      text: row.prompt,
      errors: row.errors,
      warnings: row.warnings,
    })),
  };
}

export function PasteQuestionsDialog({ spec, part, setName, onApply, planFor = pastePlan, firstNumber = MOCK_FIRST_QUESTION_NUMBERS[spec.key], exampleCount, description: ownDescription }) {
  const byPassage = Boolean(spec.group.passage);
  const blanks = Boolean(spec.group.blanks);
  const exampleLast = firstNumber + (exampleCount ?? (blanks ? 4 : 2)) - 1;
  let description =
    'Each question goes to the place of its number; blank questions are added for the numbers skipped before it. Explanations are still added in the editor.';
  if (!spec.option.text) description = 'Paste what each recording says; it becomes the transcript and sets the answer.';
  if (setName)
    description = `Each question goes to the place of its number, and the ${setName.toLowerCase()}s it needs are added. Recordings, transcripts, graphics and explanations are still added in the editor.`;
  if (byPassage)
    description = blanks
      ? 'Paste each passage with its questions. The numbered blanks of the passage become the blanks of the editor, and a first line that only names the document (Letter, E-mail…) is left out. Explanations are still added in the editor.'
      : 'Paste each set of documents with its questions; the documents of a set go into one passage. Rows copied from a table are written | cell | cell | and drawn as a table for learners. Images and explanations are still added in the editor.';

  return (
    <PasteDialog
      id={`paste-${spec.key}`}
      button={byPassage ? 'Paste passages' : 'Paste questions'}
      title={`Paste ${byPassage ? 'passages' : 'questions'} into Part ${spec.number}`}
      description={ownDescription || description}
      label={byPassage ? 'Passages and questions' : 'Questions'}
      placeholder={byPassage ? passageExample(firstNumber, exampleLast, blanks) : questionExample(firstNumber, spec)}
      notFound={
        byPassage
          ? `No passage found. A passage starts with a line such as "Passage 1 – Questions ${firstNumber}–${exampleLast}".`
          : `No question found. A question starts with a line such as "Question ${firstNumber}".`
      }
      noun="question"
      done={`filled in Part ${spec.number}`}
      planFor={(text) => planFor(part, spec, setName, text)}
      onApply={(plan) => onApply(plan.part)}
    />
  );
}
