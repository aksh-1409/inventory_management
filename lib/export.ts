import { stringify } from 'csv-stringify';
import { Readable } from 'stream';

type ColumnDef = { key: string; label: string; transform?: (val: unknown) => string };

export function csvStream(
  columns: ColumnDef[],
  rows: AsyncGenerator<Record<string, unknown>> | Record<string, unknown>[]
) {
  return new Response(
    new ReadableStream({
      async start(controller) {
        const csvStream = stringify({
          header: true,
          columns: columns.map((c) => ({ key: c.key, header: c.label })),
        });

        csvStream.on('data', (chunk: Buffer) => controller.enqueue(chunk));
        csvStream.on('end', () => controller.close());
        csvStream.on('error', (err: Error) => controller.error(err));

        const iter = Symbol.asyncIterator in rows ? rows : rows[Symbol.iterator]();
        for await (const row of iter) {
          const transformed: Record<string, unknown> = {};
          for (const col of columns) {
            transformed[col.key] = col.transform
              ? col.transform(row[col.key])
              : (row[col.key] ?? '');
          }
          csvStream.write(transformed);
        }
        csvStream.end();
      },
    }),
    {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="export.csv"',
      },
    }
  );
}

export interface ExportColumn {
  key: string;
  label: string;
  transform?: (val: unknown) => string;
}

const numberFormat = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(val: unknown): string {
  if (val == null || val === '') return '';
  return numberFormat.format(Number(val));
}

export function formatDate(val: unknown): string {
  if (!val) return '';
  try {
    return new Date(val as string).toISOString().split('T')[0];
  } catch {
    return '';
  }
}
