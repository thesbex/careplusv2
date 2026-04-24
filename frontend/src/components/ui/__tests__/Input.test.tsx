import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { Field } from '../Field';
import { Input, Select, Textarea } from '../Input';

describe('form primitives', () => {
  it('Field wraps its children with the field class', () => {
    render(
      <Field>
        <label htmlFor="i">Label</label>
        <Input id="i" />
      </Field>,
    );
    expect(screen.getByLabelText('Label')).toHaveClass('input');
  });

  it('Input forwards events', async () => {
    const user = userEvent.setup();
    render(
      <Field>
        <label htmlFor="i">Email</label>
        <Input id="i" />
      </Field>,
    );
    await user.type(screen.getByLabelText('Email'), 'test@test.ma');
    expect(screen.getByLabelText('Email')).toHaveValue('test@test.ma');
  });

  it('Select + Textarea get their respective classes', () => {
    render(
      <>
        <Field>
          <label htmlFor="s">Sel</label>
          <Select id="s">
            <option>One</option>
          </Select>
        </Field>
        <Field>
          <label htmlFor="t">Notes</label>
          <Textarea id="t" />
        </Field>
      </>,
    );
    expect(screen.getByLabelText('Sel')).toHaveClass('select');
    expect(screen.getByLabelText('Notes')).toHaveClass('textarea');
  });

  it('has no a11y violations', async () => {
    const { container } = render(
      <Field>
        <label htmlFor="a">Adresse email</label>
        <Input id="a" type="email" />
      </Field>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
