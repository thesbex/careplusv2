import type { ButtonHTMLAttributes } from 'react';
import { forwardRef } from 'react';

export type ButtonVariant = 'default' | 'primary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
}

const variantClass: Record<ButtonVariant, string> = {
  default: '',
  primary: 'primary',
  ghost: 'ghost',
  danger: 'danger',
};

const sizeClass: Record<ButtonSize, string> = {
  sm: 'sm',
  md: '',
  lg: 'lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'default', size = 'md', iconOnly = false, className, type = 'button', ...rest },
  ref,
) {
  const classes = ['btn', variantClass[variant], sizeClass[size], iconOnly ? 'icon' : '', className]
    .filter(Boolean)
    .join(' ');
  return <button ref={ref} type={type} className={classes} {...rest} />;
});
