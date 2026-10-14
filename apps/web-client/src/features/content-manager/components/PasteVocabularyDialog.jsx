import { vocabularyPastePlan } from '../lib/vocabulary-paste.js';
import { PasteDialog } from './PasteDialog.jsx';

const example = `contract | noun | hợp đồng | We signed the contract yesterday. | Chúng tôi đã ký hợp đồng hôm qua. | /ˈkɒntrækt/
negotiate | v | đàm phán | They negotiated a better price.`;

// Fills the vocabulary of a lesson from pasted lines, one word per line
// (PasteDialog). onApply receives the vocabulary with the pasted words in it.
export function PasteVocabularyDialog({ vocabulary, onApply }) {
  return (
    <PasteDialog
      id="paste-vocabulary"
      button="Paste words"
      title="Paste vocabulary"
      description="One word per line: word | part of speech | meaning | example sentence | example translation | phonetic. The last two may be left out, and rows copied from a spreadsheet work as they are. A word already in the lesson with the same part of speech is updated and keeps its audio; pronunciation audio is still added in the editor."
      label="Words"
      placeholder={example}
      notFound="No word found."
      noun="word"
      done="filled in the vocabulary"
      planFor={(text) => vocabularyPastePlan(vocabulary, text)}
      onApply={(plan) => onApply(plan.vocabulary)}
    />
  );
}
