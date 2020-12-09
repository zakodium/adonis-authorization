/* eslint-disable @typescript-eslint/no-extraneous-class */

import { promisify } from 'util';

import { TestUser } from '@ioc:Adonis/Addons/Auth';

import Gate from '../Gate';
import gateDecorator from '../gateDecorator';

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
      /A gate is already defined for the action "always-true"/,
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
    ).toThrow(/A policy is already defined for the resource "Resource"/);
  });

  it('should throw if the same resource constructor is reused in a separate call', () => {
    class Resource {}
    class Policy {}

    const gate = new Gate();
    gate.registerPolicies([[Resource, Policy]]);
    expect(() => gate.registerPolicies([[Resource, Policy]])).toThrow(
      /A policy is already defined for the resource "Resource"/,
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
  // @ts-expect-error
  gate.define('bad-return', (user, type) => {
    switch (type) {
      case 'undefined':
        return undefined;
      case 'null':
        return null;
      case 'number':
        return 42;
      case 'object':
        return {};
      default:
        throw new Error('unreachable');
    }
  });
  gate.define('sync-throw', () => {
    throw new Error('sync-throw error');
  });
  gate.define('async-throw', async () => {
    throw new Error('async-throw error');
  });

  it('always-true: should allow any user', async () => {
    const userGate = gate.forUser(testUser1);
    expect(await userGate.allows('always-true')).toBe(true);
  });
  it('always-true: should not allow guests', async () => {
    const userGate = gate.forUser(undefined);
    expect(await userGate.allows('always-true')).toBe(false);
  });
  it('always-true: should not deny users', async () => {
    const userGate = gate.forUser(testUser1);
    expect(await userGate.denies('always-true')).toBe(false);
  });
  it('always-true: should authorize users', async () => {
    const userGate = gate.forUser(testUser1);
    await userGate.authorize('always-true');
  });
  it('always-true: should deny guests', async () => {
    const userGate = gate.forUser(undefined);
    expect(await userGate.denies('always-true')).toBe(true);
  });
  it('always-true: should not authorize guests', async () => {
    const userGate = gate.forUser(undefined);
    await expect(userGate.authorize('always-true')).rejects.toThrow(
      /E_AUTHORIZATION_DENIED: Authorization to "always-true" was denied/,
    );
  });

  it('always-true-guest: should allow everyone', async () => {
    expect(await gate.forUser(testUser1).allows('always-true-guest')).toBe(
      true,
    );
    expect(await gate.forUser(testUser2).allows('always-true-guest')).toBe(
      true,
    );
    expect(await gate.forUser(undefined).allows('always-true-guest')).toBe(
      true,
    );
  });

  it('always-false: should disallow everyone', async () => {
    expect(await gate.forUser(testUser1).allows('always-false')).toBe(false);
    expect(await gate.forUser(testUser2).allows('always-false')).toBe(false);
    expect(await gate.forUser(undefined).allows('always-false')).toBe(false);
  });

  it('user-id: should pass the additional arguments', async () => {
    expect(await gate.forUser(testUser1).allows('user-id', 1)).toBe(true);
    expect(await gate.forUser(testUser2).allows('user-id', 1)).toBe(false);
    expect(await gate.forUser(undefined).allows('user-id', 1)).toBe(false);
    expect(await gate.forUser(testUser2).allows('user-id', 2)).toBe(true);
  });

  it('user-id-bool: should pass the additional arguments', async () => {
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

  it('sync-throw: should propagate sync exceptions', async () => {
    await expect(gate.forUser(testUser1).allows('sync-throw')).rejects.toThrow(
      /sync-throw error/,
    );
  });

  it('async-throw: should propagate sync exceptions', async () => {
    await expect(gate.forUser(testUser1).allows('async-throw')).rejects.toThrow(
      /async-throw error/,
    );
  });

  it('does-not-exist: should throw if action callback was not defined', async () => {
    await expect(
      // @ts-expect-error
      gate.forUser(testUser1).allows('does-not-exist'),
    ).rejects.toThrow(/Found no callback for action "does-not-exist"/);
  });

  it.each(['undefined', 'null', 'number', 'object'])(
    'bad-return(%s): should throw if action callback does not return a boolean',
    async (param: 'undefined' | 'null' | 'number' | 'object') => {
      await expect(
        gate.forUser(testUser1).allows('bad-return', param),
      ).rejects.toThrow(/Gates must return boolean values/);
    },
  );
});

describe('Gate.forUser with resource', () => {
  const gate = new Gate();

  class Resource1 {}
  class Policy1 {}
  class Resource2 {
    public constructor(public value = 'test') {}
  }
  class Policy2 {
    @gateDecorator()
    public test2() {
      return true;
    }

    @gateDecorator()
    public testDeny() {
      return false;
    }

    @gateDecorator()
    public testParams(user: TestUser, param1: string, param2: boolean) {
      return user.id === 1 && param1 === 'correct' && param2 === true;
    }

    @gateDecorator()
    public testResourceParams(
      user: TestUser,
      resource: Resource2,
      param: boolean,
    ) {
      return user.id === 1 && resource.value === 'correct' && param === true;
    }

    // @ts-expect-error
    @gateDecorator()
    public noBool() {
      return null;
    }
  }
  class Resource3 {}
  class Policy3 {
    @gateDecorator({ allowGuest: true })
    public test3() {
      return true;
    }
  }
  class ResourceNoPolicy {}

  gate.registerPolicies([
    [Resource1, Policy1],
    [Resource2, Policy2],
    [Resource3, Policy3],
  ]);

  it('should call the right policy method based on the resource', async () => {
    const userGate = gate.forUser(testUser1);
    expect(await userGate.for(Resource2).allows('test2')).toBe(true);
    expect(await userGate.for(new Resource2()).allows('test2')).toBe(true);
    expect(await userGate.for(Resource3).allows('test3')).toBe(true);
    expect(await userGate.for(new Resource3()).allows('test3')).toBe(true);
  });

  it('should allow user but not guest', async () => {
    expect(await gate.forUser(testUser1).for(Resource2).allows('test2')).toBe(
      true,
    );
    expect(await gate.forUser(testUser2).for(Resource2).allows('test2')).toBe(
      true,
    );
    expect(await gate.forUser(undefined).for(Resource2).allows('test2')).toBe(
      false,
    );
  });

  it('should not deny user but deny guest', async () => {
    expect(await gate.forUser(testUser1).for(Resource2).denies('test2')).toBe(
      false,
    );
    expect(await gate.forUser(testUser2).for(Resource2).denies('test2')).toBe(
      false,
    );
    expect(await gate.forUser(undefined).for(Resource2).denies('test2')).toBe(
      true,
    );
  });

  it('should deny everyone', async () => {
    expect(
      await gate.forUser(testUser1).for(Resource2).denies('testDeny'),
    ).toBe(true);
    expect(
      await gate.forUser(testUser2).for(Resource2).denies('testDeny'),
    ).toBe(true);
    expect(
      await gate.forUser(undefined).for(Resource2).denies('testDeny'),
    ).toBe(true);
  });

  it('should authorize user but not guest', async () => {
    await gate.forUser(testUser1).for(Resource2).authorize('test2');
    await gate.forUser(testUser2).for(Resource2).authorize('test2');
    await expect(
      gate.forUser(undefined).for(Resource2).authorize('test2'),
    ).rejects.toThrow(
      /E_AUTHORIZATION_DENIED: Authorization to "test2" was denied/,
    );
  });

  it('should pass additional params', async () => {
    const userGate1 = gate.forUser(testUser1);
    const userGate2 = gate.forUser(testUser2);
    expect(
      await userGate1.for(Resource2).allows('testParams', 'correct', true),
    ).toBe(true);
    expect(
      await userGate1.for(Resource2).allows('testParams', 'incorrect', true),
    ).toBe(false);
    expect(
      await userGate1.for(Resource2).allows('testParams', 'correct', false),
    ).toBe(false);
    expect(
      await userGate2.for(Resource2).allows('testParams', 'correct', true),
    ).toBe(false);
  });

  it('should pass resource before additional params', async () => {
    const userGate1 = gate.forUser(testUser1);
    const userGate2 = gate.forUser(testUser2);
    expect(
      await userGate1
        .for(new Resource2('correct'))
        .allows('testResourceParams', true),
    ).toBe(true);
    expect(
      await userGate2
        .for(new Resource2('correct'))
        .allows('testResourceParams', true),
    ).toBe(false);
    expect(
      await userGate1
        .for(new Resource2('correct'))
        .allows('testResourceParams', false),
    ).toBe(false);
    expect(
      await userGate1.for(new Resource2()).allows('testResourceParams', true),
    ).toBe(false);
  });

  it('should throw if the policy has no gate', async () => {
    const userGate = gate.forUser(testUser1);
    const policyGate1 = userGate.for(Resource1);

    await expect(policyGate1.allows('test')).rejects.toThrow(
      /Policy "Policy1" has no gates/,
    );
  });

  it('should throw if the policy gate does not exist', async () => {
    const userGate = gate.forUser(testUser1);
    const policyGate2 = userGate.for(Resource2);

    await expect(policyGate2.allows('bad-gate')).rejects.toThrow(
      /Found no policy gate named "bad-gate" on policy "Policy2"/,
    );
  });

  it('should throw if the resource is not an object', async () => {
    // @ts-expect-error
    expect(() => gate.forUser(testUser1).for(null)).toThrow(
      /resource must be an object or constructor/,
    );
    // @ts-expect-error
    expect(() => gate.forUser(testUser1).for(42)).toThrow(
      /resource must be an object or constructor/,
    );
  });

  it('should throw if no policy matches the resource', async () => {
    await expect(() =>
      gate.forUser(testUser1).for(ResourceNoPolicy).allows('something'),
    ).rejects.toThrow(
      /Found no policy for resource of type "ResourceNoPolicy"/,
    );
    await expect(() =>
      gate.forUser(testUser1).for(new ResourceNoPolicy()).allows('something'),
    ).rejects.toThrow(
      /Found no policy for resource of type "ResourceNoPolicy"/,
    );
  });

  it('should throw if gate does not return a boolean', async () => {
    await expect(
      gate.forUser(testUser1).for(Resource2).allows('noBool'),
    ).rejects.toThrow(/Gates must return boolean values/);
  });

  it('should throw if the gate decorator is not applied to a method', () => {
    expect(() => {
      class Test {
        // @ts-expect-error
        @gateDecorator()
        public bad: string;
      }
      return Test;
    }).toThrow(/The gate decorator must be applied to a method/);
    expect(() => {
      class Test {
        // @ts-expect-error
        @gateDecorator()
        public get bad() {
          return 'bad';
        }
      }
      return Test;
    }).toThrow(/The gate decorator must be applied to a method/);
  });
});
