import { Fragment } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui';
import { inlineParts, lineAlign, passageBlocks, tableLayout } from '../../lib/passage.js';
import { cn } from '../../lib/utils.js';

const cellClass = 'border-r px-3 py-2 align-top last:border-r-0';

function InlineText({ text }) {
  return inlineParts(text).map((part, index) => {
    if (part.br) return <br key={index} />;
    if (part.bold) return <strong key={index}>{part.text}</strong>;
    if (part.italic) return <em key={index}>{part.text}</em>;
    return <Fragment key={index}>{part.text}</Fragment>;
  });
}

export function PassageText({ text }) {
  return (
    <div className="space-y-3">
      {passageBlocks(text).map((block, index) => {
        if (!block.rows)
          return (
            <div key={index}>
              {block.text.split('\n').map((line, lineIndex) => {
                const { align, text: shown } = lineAlign(line);
                return (
                  <p key={lineIndex} className={cn('min-h-lh whitespace-pre-wrap', align === 'center' && 'text-center', align === 'right' && 'text-right')}>
                    <InlineText text={shown} />
                  </p>
                );
              })}
            </div>
          );
        const [head, ...body] = tableLayout(block.rows);
        return (
          <div key={index} className="overflow-hidden rounded-lg border whitespace-normal">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  {head.cells.map((cell, cellIndex) => (
                    <TableHead key={cellIndex} colSpan={cell.span} className={cn('h-auto font-normal text-foreground', cellClass, cell.span > 1 && 'text-center')}>
                      <InlineText text={cell.text} />
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {body.map((row, rowIndex) => (
                  <TableRow key={rowIndex} className={cn('hover:bg-transparent', row.full && 'bg-muted/30 hover:bg-muted/30')}>
                    {row.cells.map((cell, cellIndex) => (
                      <TableCell key={cellIndex} colSpan={cell.span} className={cn(cellClass, cell.span > 1 && 'text-center', row.full && 'font-semibold')}>
                        <InlineText text={cell.text} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        );
      })}
    </div>
  );
}
