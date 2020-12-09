import { Exception } from '@poppinss/utils';

import type {
  Constructor,
  GateCallbackUserOrGuest,
  GateOptions,
  GateCallbackUser,
  GateContract,
  GateOptionsWithGuest,
  GlobalActions,
  UserOrGuest,
  UserGateContractWithResource,
  UserGateContractWithoutResource,
  RegisteredActions,
  GateFnOrGateFnWithOptions,
} from '@ioc:Adonis/Addons/Authorization';

import { AuthorizationException } from './Exceptions';
import { GateDefinition } from './GateDefinition';

export default class Gate implements GateContract {
  private actions = new Map<
    keyof GlobalActions,
    {
      callback: GateCallbackUserOrGuest<any>;
      definition: GateDefinition;
    }
  >();

  private policies = new Map<
    Constructor,
    { name: string; instance: InstanceType<any> }
  >();

  public registerActions<
    Actions extends {
      [key: string]: GateFnOrGateFnWithOptions;
    }
  >(actions: Actions): RegisteredActions<Actions> {
    for (const [key, value] of Object.entries(actions)) {
      if (typeof value === 'function') {
        // @ts-expect-error: This key is added to the types externally
        this.define(key, value);
      } else {
        // @ts-expect-error: This key is added to the types externally
        this.define(key, value.gate, value);
      }
    }
    // @ts-expect-error: We pretend to return something but it's a lie.
    return undefined;
  }

  public define<Action extends keyof GlobalActions>(
    action: Action,
    gate: GateCallbackUser<Action>,
    options?: GateOptions,
  ): void;
  public define<Action extends keyof GlobalActions>(
    action: Action,
    gate: GateCallbackUserOrGuest<Action>,
    options?: GateOptionsWithGuest,
  ): void;
  public define<Action extends keyof GlobalActions>(
    action: Action,
    gate: GateCallbackUser<Action>,
    options: GateOptionsWithGuest | GateOptions = {},
  ) {
    if (typeof action !== 'string') {
      throw new Exception('action must be a string');
    }

    if (typeof gate !== 'function') {
      throw new Exception('gate must be a function');
    }

    if (typeof options !== 'object' || options === null) {
      throw new Exception('options must be an object');
    }

    if (this.actions.has(action)) {
      throw new Exception(
        `A gate is already defined for the action "${action}"`,
      );
    }

    this.actions.set(action, {
      callback: gate,
      definition: new GateDefinition(options),
    });
  }

  public registerPolicies(policies: Array<[Constructor, Constructor]>): void {
    if (!Array.isArray(policies)) {
      throw new Exception('policies must be an array');
    }

    for (let i = 0; i < policies.length; i++) {
      const policyTuple = policies[i];
      if (!Array.isArray(policyTuple) || policyTuple.length !== 2) {
        throw new Exception(`policies.${i} must be a tuple`);
      }
      const [Resource, Policy] = policyTuple;
      if (typeof Resource !== 'function') {
        throw new Exception(`policies.${i}.0 must be a constructor`);
      }
      if (typeof Policy !== 'function') {
        throw new Exception(`policies.${i}.1 must be a constructor`);
      }

      if (this.policies.has(Resource)) {
        throw new Exception(
          `A policy is already defined for the resource "${Resource.name}"`,
        );
      }

      this.policies.set(Resource, {
        name: Policy.name,
        instance: new Policy(),
      });
    }
  }

  public forUser(
    user: UserOrGuest | undefined,
  ): UserGateContractWithoutResource {
    return new UserGate(user, this);
  }

  public async allowsAction<Action extends keyof GlobalActions>(
    user: UserOrGuest | undefined,
    action: Action,
    ...args: GlobalActions[Action]
  ): Promise<boolean> {
    const actionData = this.actions.get(action);
    if (actionData) {
      if (!user) {
        if (!actionData.definition.isGuestAllowed) {
          return false;
        } else {
          // Normalize user so the callback is never called with `undefined`.
          user = null;
        }
      }
      const result = await actionData.callback(user, ...args);
      if (typeof result !== 'boolean') {
        throw new Exception('Gates must return boolean values');
      }
      return result;
    }
    throw new Exception(`Found no callback for action "${action}"`);
  }

  public async allowsResource(
    user: UserOrGuest | undefined,
    action: string,
    resource: any,
    ...params: unknown[]
  ): Promise<boolean> {
    let constructor;
    if (typeof resource === 'function') {
      // Constructor
      constructor = resource;
    } else {
      // Instance
      constructor = resource.constructor;
      params = [resource, ...params];
    }

    const policyData = this.policies.get(constructor);
    if (policyData) {
      const policyInstance = policyData.instance;
      if (!policyInstance.$gates) {
        throw new Exception(
          `Policy "${policyData.name}" has no gates. Use the @gate decorator to define gate methods`,
        );
      }
      const policyMethodData = policyInstance.$gates.get(action);
      if (!policyMethodData) {
        throw new Exception(
          `Found no policy gate named "${action}" on policy "${policyData.name}"`,
        );
      }

      if (!user) {
        if (!policyMethodData.isGuestAllowed) {
          return false;
        } else {
          // Normalize user so the callback is never called with `undefined`.
          user = null;
        }
      }
      const result = await policyData.instance[action](user, ...params);
      if (typeof result !== 'boolean') {
        throw new Exception('Gates must return boolean values');
      }
      return result;
    }
    throw new Exception(
      `Found no policy for resource of type "${constructor.name}"`,
    );
  }
}

class UserGate implements UserGateContractWithoutResource {
  public constructor(
    private user: UserOrGuest | undefined,
    private gate: Gate,
  ) {
    this.gate = gate;
    this.user = user;
  }

  public allows<Action extends keyof GlobalActions>(
    action: Action,
    ...args: GlobalActions[Action]
  ): Promise<boolean> {
    return this.gate.allowsAction(this.user, action, ...args);
  }

  public async denies<Action extends keyof GlobalActions>(
    action: Action,
    ...args: GlobalActions[Action]
  ): Promise<boolean> {
    const isAllowed = await this.allows(action, ...args);
    return !isAllowed;
  }

  public async authorize<Action extends keyof GlobalActions>(
    action: Action,
    ...args: GlobalActions[Action]
  ): Promise<void> {
    const isAllowed = await this.allows(action, ...args);
    if (!isAllowed) {
      throw new AuthorizationException(
        `Authorization to "${action}" was denied`,
      );
    }
  }

  public for(resource: unknown) {
    if (
      typeof resource !== 'function' &&
      (typeof resource !== 'object' || resource === null)
    ) {
      throw new Exception('resource must be an object or constructor');
    }
    return new UserGateWithResource(this.user, this.gate, resource);
  }
}

class UserGateWithResource implements UserGateContractWithResource {
  public constructor(
    private user: UserOrGuest | undefined,
    private gate: Gate,
    private resource: unknown,
  ) {}

  public allows(action: string, ...args: unknown[]): Promise<boolean> {
    return this.gate.allowsResource(this.user, action, this.resource, ...args);
  }

  public async denies(action: string, ...args: unknown[]): Promise<boolean> {
    const isAllowed = await this.allows(action, ...args);
    return !isAllowed;
  }

  public async authorize(action: string, ...args: unknown[]): Promise<void> {
    const isAllowed = await this.allows(action, ...args);
    if (!isAllowed) {
      throw new AuthorizationException(
        `Authorization to "${action}" was denied`,
      );
    }
  }
}
