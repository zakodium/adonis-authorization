/* eslint-disable @typescript-eslint/no-extraneous-class */

import { promisify } from 'util';

import { TestUser } from '@ioc:Adonis/Addons/Auth';

import Gate from '../Gate';

const wait = promisify(setTimeout);

const testUser1: TestUser = {
  id: 1,
};
const testUser2: TestUser = {
  id: 2,
};

function noop() {
  // no-op
}

describe('Gate.define', () => {
  it('should allow to define multiple gates', () => {
    const testGate = new Gate();
    testGate.define('always-true', () => true);
    testGate.define('always-false', () => false);
  });

  it('should throw if the same action is reused', () => {
    const gate = new Gate();

    gate.define('always-true', () => true);

    expect(() => gate.define('always-true', () => false)).toThrow(
      /a gate is already defined for the action "always-true"/,
    );
  });

  it('should throw if called with bad arguments', () => {
    const gate = new Gate();

    // @ts-expect-error
    expect(() => gate.define(null)).toThrow(/action must be a string/);
    // @ts-expect-error
    expect(() => gate.define(42)).toThrow(/action must be a string/);

    // @ts-expect-error
    expect(() => gate.define('test', null)).toThrow(/gate must be a function/);
    // @ts-expect-error
    expect(() => gate.define('test', 'blah')).toThrow(
      /gate must be a function/,
    );

    // @ts-expect-error
    expect(() => gate.define('test', noop, null)).toThrow(
      /options must be an object/,
    );
    // @ts-expect-error
    expect(() => gate.define('test', noop, 'bleh')).toThrow(
      /options must be an object/,
    );

    // @ts-expect-error
    expect(() => gate.define('test', noop, { allowGuest: null })).toThrow(
      /options.allowGuest must be a boolean/,
    );

    // @ts-expect-error
    expect(() => gate.define('test', noop, { allowGuest: 42 })).toThrow(
      /options.allowGuest must be a boolean/,
    );
  });
});

describe('Gate.registerPolicies', () => {
  it('should allow to define multiple policies', () => {
    class Resource1 {}
    class Policy1 {}
    class Resource2 {}
    class Policy2 {}
    class Resource3 {}
    class Policy3 {}

    const gate = new Gate();
    gate.registerPolicies([
      [Resource1, Policy1],
      [Resource2, Policy2],
    ]);
    gate.registerPolicies([[Resource3, Policy3]]);
  });

  it('should throw if the same resource constructor is reused in the same call', () => {
    class Resource {}
    class Policy {}

    const gate = new Gate();
    expect(() =>
      gate.registerPolicies([
        [Resource, Policy],
        [Resource, Policy],
      ]),
    ).toThrow(/a policy is already defined for the resource "Resource"/);
  });

  it('should throw if the same resource constructor is reused in a separate call', () => {
    class Resource {}
    class Policy {}

    const gate = new Gate();
    gate.registerPolicies([[Resource, Policy]]);
    expect(() => gate.registerPolicies([[Resource, Policy]])).toThrow(
      /a policy is already defined for the resource "Resource"/,
    );
  });

  it('should throw if called with bad arguments', () => {
    const gate = new Gate();

    class Resource {}
    class Policy {}

    // @ts-expect-error
    expect(() => gate.registerPolicies(null)).toThrow(
      /policies must be an array/,
    );
    // @ts-expect-error
    expect(() => gate.registerPolicies(42)).toThrow(
      /policies must be an array/,
    );

    // @ts-expect-error
    expect(() => gate.registerPolicies([[]])).toThrow(
      /policies.0 must be a tuple/,
    );
    // @ts-expect-error
    expect(() => gate.registerPolicies([['x']])).toThrow(
      /policies.0 must be a tuple/,
    );
    expect(() =>
      gate.registerPolicies([
        [Resource, Policy],
        // @ts-expect-error
        ['x', 'x', 'x'],
      ]),
    ).toThrow(/policies.1 must be a tuple/);

    // @ts-expect-error
    expect(() => gate.registerPolicies([[null, Policy]])).toThrow(
      /policies.0.0 must be a constructor/,
    );
    // @ts-expect-error
    expect(() => gate.registerPolicies([[Resource, null]])).toThrow(
      /policies.0.1 must be a constructor/,
    );
  });
});

describe('Gate.forUser', () => {
  const gate = new Gate();

  gate.define('always-true', () => true);
  gate.define('always-true-guest', () => true, { allowGuest: true });
  gate.define('always-false', () => false);
  gate.define('user-id', async (user, userId) => {
    await wait(1);
    return user.id === userId;
  });
  gate.define(
    'user-id-bool',
    async (user, userId, other) => {
      if (!other) return false;
      if (!user) return true;
      return user.id === userId;
    },
    { allowGuest: true },
  );

  describe('always-true', () => {
    it('should allow any user', async () => {
      const userGate = gate.forUser(testUser1);
      expect(await userGate.allows('always-true')).toBe(true);
      expect(await userGate.denies('always-true')).toBe(false);
      await userGate.authorize('always-true');
    });
    it('should deny guests', async () => {
      const userGate = gate.forUser(undefined);
      expect(await userGate.allows('always-true')).toBe(false);
      expect(await userGate.denies('always-true')).toBe(true);
      await expect(userGate.authorize('always-true')).rejects.toThrow(
        /Unauthorized to "always-true"/,
      );
    });
  });

  describe('always-false', () => {
    it('should disallow everyone', async () => {
      expect(await gate.forUser(testUser1).allows('always-false')).toBe(false);
      expect(await gate.forUser(testUser2).allows('always-false')).toBe(false);
      expect(await gate.forUser(undefined).allows('always-false')).toBe(false);
    });
  });

  it('should pass the additional arguments (user-id)', async () => {
    expect(await gate.forUser(testUser1).allows('user-id', 1)).toBe(true);
    expect(await gate.forUser(testUser2).allows('user-id', 1)).toBe(false);
    expect(await gate.forUser(undefined).allows('user-id', 1)).toBe(false);
    expect(await gate.forUser(testUser2).allows('user-id', 2)).toBe(true);
  });

  it('should pass the additional arguments (user-id-bool)', async () => {
    expect(await gate.forUser(testUser1).allows('user-id-bool', 1, false)).toBe(
      false,
    );
    expect(await gate.forUser(testUser1).allows('user-id-bool', 1, true)).toBe(
      true,
    );
    expect(await gate.forUser(undefined).allows('user-id-bool', 1, true)).toBe(
      true,
    );
    expect(await gate.forUser(testUser2).allows('user-id-bool', 1, true)).toBe(
      false,
    );
  });
});
