import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  connection: vi.fn(async () => undefined),
  optionalUser: vi.fn(),
  signOut: vi.fn(async () => undefined),
}));

vi.mock('next/server', () => ({ connection: mocks.connection }));
vi.mock('@/lib/auth', () => ({ optionalUser: mocks.optionalUser }));
vi.mock('@/auth', () => ({ signOut: mocks.signOut }));

import { SessionNav } from '@/components/layout/session-nav';

type TestElement = {
  type: unknown;
  props: Record<string, unknown> & { children?: unknown };
};

function element(value: unknown): TestElement {
  expect(value).toBeTruthy();
  return value as TestElement;
}

describe('SessionNav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.connection.mockResolvedValue(undefined);
  });

  it('enters request-time rendering before reading the authenticated user', async () => {
    mocks.optionalUser.mockResolvedValue(null);

    await SessionNav();

    expect(mocks.connection).toHaveBeenCalledOnce();
    expect(mocks.optionalUser).toHaveBeenCalledOnce();
    expect(mocks.connection.mock.invocationCallOrder[0]).toBeLessThan(mocks.optionalUser.mock.invocationCallOrder[0]);
  });

  it('renders Sign in for an unauthenticated request', async () => {
    mocks.optionalUser.mockResolvedValue(null);

    const navigation = element(await SessionNav());

    expect(navigation.props).toMatchObject({ href: '/api/auth/signin', children: 'Sign in' });
  });

  it('renders the authenticated identity and signs out through an Auth.js server action', async () => {
    mocks.optionalUser.mockResolvedValue({
      id: 'user-1',
      email: 'person@example.test',
      displayName: 'Production User',
      provider: 'google',
      subject: 'google-subject',
    });

    const navigation = element(await SessionNav());
    const [identity, form] = navigation.props.children as unknown[];
    const identityElement = element(identity);
    const formElement = element(form);
    const button = element(formElement.props.children);

    expect(identityElement.props.children).toBe('Production User');
    expect(formElement.type).toBe('form');
    expect(formElement.props.action).toEqual(expect.any(Function));
    expect(formElement.props).not.toHaveProperty('href');
    expect(button.props).toMatchObject({ type: 'submit', children: 'Sign out' });
    expect(button.props).not.toHaveProperty('href');

    await (formElement.props.action as () => Promise<void>)();

    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(mocks.signOut).toHaveBeenCalledWith({ redirectTo: '/' });
  });

  it('keeps the dashboard connected to the request-bound sidebar', () => {
    const root = process.cwd();
    const dashboard = readFileSync(path.join(root, 'app/page.tsx'), 'utf8');
    const layout = readFileSync(path.join(root, 'components/layout/main-layout.tsx'), 'utf8');

    expect(dashboard).toContain("import { MainLayout } from '@/components/layout/main-layout'");
    expect(dashboard).toContain('<MainLayout>');
    expect(layout).toContain("import { SessionNav } from './session-nav'");
    expect(layout).toContain('<SessionNav />');
  });
});
