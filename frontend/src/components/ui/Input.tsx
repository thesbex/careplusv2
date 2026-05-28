import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode, ReactElement } from 'react';
import { Children, forwardRef, isValidElement } from 'react';
import { SelectMenu, type SelectMenuOption } from './SelectMenu';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={['input', className].filter(Boolean).join(' ')} {...rest} />;
  },
);

function extractOptions(children: ReactNode): SelectMenuOption[] {
  const out: SelectMenuOption[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const el = child as ReactElement<{ value?: string | number; children?: ReactNode; disabled?: boolean }>;
    if (el.type === 'option') {
      const v = el.props.value;
      const labelNode = el.props.children;
      const label = typeof labelNode === 'string' || typeof labelNode === 'number'
        ? String(labelNode)
        : (Array.isArray(labelNode) ? labelNode.filter((n) => typeof n === 'string' || typeof n === 'number').join('') : '');
      out.push({ value: v === undefined ? '' : String(v), label, ...(el.props.disabled ? { disabled: true } : {}) });
    } else if (el.type === 'optgroup') {
      const grpChildren = (el.props as { children?: ReactNode }).children;
      out.push(...extractOptions(grpChildren));
    }
  });
  return out;
}

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, value, defaultValue, onChange, name, id, disabled, required, 'aria-label': ariaLabel, ...rest }, _ref) {
    void _ref;
    void rest;
    const options = extractOptions(children);
    return (
      <SelectMenu
        options={options}
        {...(value !== undefined ? { value: String(value) } : {})}
        {...(defaultValue !== undefined ? { defaultValue: String(defaultValue) } : {})}
        {...(onChange ? { onChange: (e) => onChange({ target: { value: e.target.value, name: e.target.name } } as React.ChangeEvent<HTMLSelectElement>) } : {})}
        {...(name ? { name } : {})}
        {...(id ? { id } : {})}
        {...(disabled ? { disabled: true } : {})}
        {...(required ? { required: true } : {})}
        {...(ariaLabel ? { ariaLabel } : {})}
        {...(className ? { className } : {})}
      />
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return (
      <textarea ref={ref} className={['textarea', className].filter(Boolean).join(' ')} {...rest} />
    );
  },
);
