import {
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
} from '@ioc:Adonis/Addons/Authorization';

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
      throw new TypeError('action must be a string');
    }

    if (typeof gate !== 'function') {
      throw new TypeError('gate must be a function');
    }

    if (typeof options !== 'object' || options === null) {
      throw new TypeError('options must be an object');
    }

    if (this.actions.has(action)) {
      throw new Error(`a gate is already defined for the action "${action}"`);
    }

    this.actions.set(action, {
      callback: gate,
      definition: new GateDefinition(options),
    });
  }

  public registerPolicies(policies: Array<[Constructor, Constructor]>): void {
    if (!Array.isArray(policies)) {
      throw new TypeError('policies must be an array');
    }

    for (let i = 0; i < policies.length; i++) {
      const policyTuple = policies[i];
      if (!Array.isArray(policyTuple) || policyTuple.length !== 2) {
        throw new TypeError(`policies.${i} must be a tuple`);
      }
      const [Resource, Policy] = policyTuple;
      if (typeof Resource !== 'function') {
        throw new TypeError(`policies.${i}.0 must be a constructor`);
      }
      if (typeof Policy !== 'function') {
        throw new TypeError(`policies.${i}.1 must be a constructor`);
      }

      if (this.policies.has(Resource)) {
        throw new Error(
          `a policy is already defined for the resource "${Resource.name}"`,
        );
      }

      this.policies.set(Resource, {
        name: Policy.name,
        instance: new Policy(),
      });
    }
  }

  public forUser(user: UserOrGuest): UserGateContractWithoutResource {
    return new UserGate(user, this);
  }

  public async allowsAction<Action extends keyof GlobalActions>(
    user: UserOrGuest,
    action: Action,
    ...args: GlobalActions[Action]
  ): Promise<boolean> {
    const actionData = this.actions.get(action);
    if (actionData) {
      if (!user && !actionData.definition.isGuestAllowed) {
        return false;
      }
      const result = await actionData.callback(user, ...args);
      if (typeof result !== 'boolean') {
        throw new Error('Gates must return boolean values');
      }
      return result;
    }
    throw new Error(`Found no action callback for action ${action}`);
  }

  public async allowsResource(
    user: UserOrGuest,
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
      const policyMethodData = policyData.instance.$gates.get(action);
      if (!policyMethodData) {
        throw new Error(
          `Found no policy gate named ${action} on policy ${policyData.name}`,
        );
      }

      if (!user && !policyMethodData.isGuestAllowed) {
        return false;
      }
      const result = await policyData.instance[action](user, ...params);
      if (typeof result !== 'boolean') {
        throw new Error('Gates must return boolean values');
      }
      return result;
    }
    throw new Error(`Found no policy for resource of type ${constructor.name}`);
  }
}

class UserGate implements UserGateContractWithoutResource {
  public constructor(private user: UserOrGuest, private gate: Gate) {
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
      // TODO: throw standard Adonis error
      throw new Error(`Unauthorized to "${action}"`);
    }
  }

  public for(resource: unknown) {
    return new UserGateWithResource(this.user, this.gate, resource);
  }
}

class UserGateWithResource implements UserGateContractWithResource {
  public constructor(
    private user: UserOrGuest,
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
      throw new Error(`Unauthorized to "${action}"`);
    }
  }
}
