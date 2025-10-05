import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '../utils';

export type TableProps = {
  theme?: 'light' | 'dark';
} & ComponentPropsWithoutRef<'table'>;

export type TableHeaderProps = {
  theme?: 'light' | 'dark';
} & ComponentPropsWithoutRef<'thead'>;

export type TableBodyProps = {
  theme?: 'light' | 'dark';
} & ComponentPropsWithoutRef<'tbody'>;

export type TableRowProps = {
  theme?: 'light' | 'dark';
} & ComponentPropsWithoutRef<'tr'>;

export type TableCellProps = {
  theme?: 'light' | 'dark';
  isHeader?: boolean;
} & ComponentPropsWithoutRef<'td'>;

export function Table({ theme = 'light', className, children, ...props }: TableProps) {
  return (
    <div className="overflow-x-auto">
      <table
        className={cn(
          'min-w-full border-collapse border rounded-lg font-serif',
          {
            'border-gray-300 bg-white': theme === 'light',
            'border-gray-600 bg-gray-800': theme === 'dark',
          },
          className,
        )}
        style={{ fontFamily: 'Times New Roman, serif' }}
        {...props}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ theme = 'light', className, children, ...props }: TableHeaderProps) {
  return (
    <thead
      className={cn(
        {
          'bg-gray-100': theme === 'light',
          'bg-gray-700': theme === 'dark',
        },
        className,
      )}
      {...props}>
      {children}
    </thead>
  );
}

export function TableBody({ theme = 'light', className, children, ...props }: TableBodyProps) {
  return (
    <tbody className={cn(className)} {...props}>
      {children}
    </tbody>
  );
}

export function TableRow({ theme = 'light', className, children, ...props }: TableRowProps) {
  return (
    <tr
      className={cn(
        'border-b',
        {
          'border-gray-200 hover:bg-gray-50': theme === 'light',
          'border-gray-600 hover:bg-gray-700': theme === 'dark',
        },
        className,
      )}
      {...props}>
      {children}
    </tr>
  );
}

export function TableCell({ theme = 'light', isHeader = false, className, children, ...props }: TableCellProps) {
  const Component = isHeader ? 'th' : 'td';

  return (
    <Component
      className={cn(
        'px-4 py-2 text-left border',
        {
          'border-gray-300 text-black': theme === 'light',
          'border-gray-600 text-gray-100': theme === 'dark',
          'font-semibold': isHeader,
          'font-medium': !isHeader,
        },
        className,
      )}
      {...props}>
      {children}
    </Component>
  );
}
