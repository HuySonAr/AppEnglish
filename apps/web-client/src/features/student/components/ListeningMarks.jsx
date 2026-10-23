import { Input } from '../../../components/ui';

export function CheckedWords({ words }) {
  return (
    <p className="leading-8">
      {words.map((word, index) => (
        <span key={index}>
          {index ? ' ' : ''}
          {word.status === 'correct' ? <span className="text-success">{word.text}</span> : null}
          {word.status === 'wrong' ? (
            <span className="rounded bg-destructive/10 px-1 font-medium text-destructive" title={word.typed ? `You wrote “${word.typed}”` : undefined}>
              {word.text}
              {word.typed ? <span className="ml-1 text-xs font-normal text-muted-foreground line-through">{word.typed}</span> : null}
            </span>
          ) : null}
          {word.status === 'missing' ? (
            <span className="font-medium text-destructive underline decoration-dotted underline-offset-4" title="Missing">
              {word.text}
            </span>
          ) : null}
          {word.status === 'extra' ? (
            <span className="text-muted-foreground line-through" title="Not in the recording">
              {word.text}
            </span>
          ) : null}
        </span>
      ))}
    </p>
  );
}

export function BlankLine({ pieces = [], answers, onAnswer, label, onEnter }) {
  return (
    <p className="leading-10">
      {pieces.map((piece, index) => {
        if (!('blank' in piece)) return <span key={index}>{piece.text}</span>;
        if ('correct' in piece)
          return piece.correct ? (
            <span key={index} className="rounded bg-success/15 px-1 font-semibold text-success">
              {piece.answer}
            </span>
          ) : (
            <span key={index} className="rounded bg-destructive/10 px-1 font-semibold text-destructive" title={piece.typed ? `You wrote “${piece.typed}”` : 'Left empty'}>
              {piece.answer}
              <span className="ml-1 text-xs font-normal text-muted-foreground line-through">{piece.typed || '…'}</span>
            </span>
          );
        return (
          <Input
            key={index}
            aria-label={`${label}, blank ${piece.blank + 1}`}
            className="mx-1 inline-flex h-8 w-32 align-middle"
            autoComplete="off"
            spellCheck={false}
            maxLength={80}
            value={answers[piece.blank] || ''}
            onChange={(event) => onAnswer(piece.blank, event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && onEnter) {
                event.preventDefault();
                onEnter();
              }
            }}
          />
        );
      })}
    </p>
  );
}
