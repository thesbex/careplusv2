import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

export interface SelectMenuOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectMenuProps {
  value?: string;
  defaultValue?: string;
  onChange?: (event: { target: { value: string; name?: string } }) => void;
  options: SelectMenuOption[];
  name?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  required?: boolean;
  ariaLabel?: string;
  width?: number | string;
  style?: React.CSSProperties;
}

export const SelectMenu = forwardRef<HTMLButtonElement, SelectMenuProps>(function SelectMenu(
  {
    value,
    defaultValue,
    onChange,
    options,
    name,
    id,
    className,
    disabled,
    placeholder,
    ariaLabel,
    width,
    style,
  },
  ref,
) {
  const controlled = value !== undefined;
  const [internal, setInternal] = useState<string>(defaultValue ?? '');
  const current = controlled ? (value as string) : internal;

  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState<number>(-1);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const btnRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const reactId = useId();
  const listId = `selm-${reactId}`;

  const selectedIndex = useMemo(() => options.findIndex((o) => o.value === current), [options, current]);
  const selectedLabel = selectedIndex >= 0 ? options[selectedIndex]!.label : (placeholder ?? '');

  const measure = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left, width: r.width });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    measure();
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => measure();
    const onResize = () => measure();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      if (popRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  useEffect(() => {
    if (open) setHighlight(selectedIndex >= 0 ? selectedIndex : 0);
  }, [open, selectedIndex]);

  const commit = useCallback(
    (val: string) => {
      if (!controlled) setInternal(val);
      onChange?.({ target: name !== undefined ? { value: val, name } : { value: val } });
      setOpen(false);
      btnRef.current?.focus();
    },
    [controlled, name, onChange],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return;
      if (!open) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setOpen(true);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlight((h) => {
          let next = h;
          for (let i = 0; i < options.length; i++) {
            next = (next + 1) % options.length;
            if (!options[next]!.disabled) return next;
          }
          return h;
        });
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight((h) => {
          let next = h;
          for (let i = 0; i < options.length; i++) {
            next = (next - 1 + options.length) % options.length;
            if (!options[next]!.disabled) return next;
          }
          return h;
        });
        return;
      }
      if (e.key === 'Home') {
        e.preventDefault();
        const i = options.findIndex((o) => !o.disabled);
        if (i >= 0) setHighlight(i);
        return;
      }
      if (e.key === 'End') {
        e.preventDefault();
        for (let i = options.length - 1; i >= 0; i--) {
          if (!options[i]!.disabled) { setHighlight(i); break; }
        }
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const opt = options[highlight];
        if (opt && !opt.disabled) commit(opt.value);
        return;
      }
      if (e.key === 'Tab') {
        setOpen(false);
      }
    },
    [open, options, highlight, commit, disabled],
  );

  const setRef = (el: HTMLButtonElement | null) => {
    btnRef.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = el;
  };

  return (
    <>
      <button
        ref={setRef}
        type="button"
        id={id}
        className={['selm', className].filter(Boolean).join(' ')}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        data-empty={!selectedLabel ? '' : undefined}
        style={{ ...(width !== undefined ? { width } : null), ...(style || null) }}
      >
        <span className="selm-val">{selectedLabel || ' '}</span>
        <svg className="selm-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && pos
        ? createPortal(
            <div
              ref={popRef}
              className="selm-pop"
              role="listbox"
              id={listId}
              style={{ position: 'fixed', top: pos.top, left: pos.left, minWidth: pos.width }}
              tabIndex={-1}
            >
              {options.map((opt, i) => {
                const isSelected = opt.value === current;
                const isHi = i === highlight;
                return (
                  <div
                    key={opt.value}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={opt.disabled || undefined}
                    className={[
                      'selm-opt',
                      isSelected ? 'on' : '',
                      isHi ? 'hi' : '',
                      opt.disabled ? 'dis' : '',
                    ].filter(Boolean).join(' ')}
                    onMouseEnter={() => !opt.disabled && setHighlight(i)}
                    onMouseDown={(e) => { e.preventDefault(); if (!opt.disabled) commit(opt.value); }}
                  >
                    <span className="selm-opt-label">{opt.label}</span>
                    {isSelected && (
                      <svg className="selm-opt-check" width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </>
  );
});
