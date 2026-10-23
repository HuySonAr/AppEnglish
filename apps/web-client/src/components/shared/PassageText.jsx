import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui';
import { passageBlocks } from '../../lib/passage.js';

const cellClass = 'border-r px-3 py-2 align-top last:border-r-0';

export function PassageText({ text }) {
  return (
    <div className="space-y-3">
      {passageBlocks(text).map((block, index) =>
        block.rows ? (
          <div key={index} className="overflow-hidden rounded-lg border whitespace-normal">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  {block.rows[0].map((cell, cellIndex) => (
                    <TableHead key={cellIndex} className={`h-auto text-foreground ${cellClass}`}>
                      {cell}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {block.rows.slice(1).map((row, rowIndex) => (
                  <TableRow key={rowIndex} className="hover:bg-transparent">
                    {row.map((cell, cellIndex) => (
                      <TableCell key={cellIndex} className={cellClass}>
                        {cell}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p key={index} className="whitespace-pre-wrap">
            {block.text}
          </p>
        ),
      )}
    </div>
  );
}
