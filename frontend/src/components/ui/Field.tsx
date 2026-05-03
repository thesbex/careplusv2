import type { HTMLAttributes, LabelHTMLAttributes, ReactNode } from 'react';

interface FieldProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Field({ className, children, ...rest }: FieldProps) {
  return (
    <div className={['field', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </div>
  );
}

interface FieldLabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  children: ReactNode;
}

export function FieldLabel({ children, ...rest }: FieldLabelProps) {
  return <label {...rest}>{children}</label>;
}

interface FieldHelpProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function FieldHelp({ className, children, ...rest }: FieldHelpProps) {
  return (
    <div className={['help', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </div>
  );
}
