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
      description="One word per line: word | part of speech | meaning | example sentence | example translation | phonetic. The last two are optional; spreadsheet rows work as they are."
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
