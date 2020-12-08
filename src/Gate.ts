import { GateDefinition, GateOptions } from './GateDefinition';

type GateCallback = (...args: unknown[]) => unknown;

export default class Gate {
  private actions = new Map<
    string,
    { callback: GateCallback; definition: GateDefinition }
  >();
  private policies = new Map<any, { name: any; instance: any }>();

  public define(action: string, callback: GateCallback, options?: GateOptions) {
    this.actions.set(action, {
      callback,
      definition: new GateDefinition(options),
    });
  }

  public registerPolicies(policies: any[][]) {
    for (const [Model, Policy] of policies) {
      this.policies.set(Model, { name: Policy.name, instance: new Policy() });
    }
  }

  public forUser(user: unknown): UserGate {
    return new UserGate(user, this);
  }

  public async allowsAction(
    user: unknown,
    action: string,
    ...params: unknown[]
  ): Promise<boolean> {
    const actionData = this.actions.get(action);
    if (actionData) {
      if (!user && !actionData.definition.isGuestAllowed) {
        return false;
      }
      const result = await actionData.callback(user, ...params);
      if (typeof result !== 'boolean') {
        throw new Error('Gates must return boolean values');
      }
      return result;
    }
    throw new Error(`Found no action callback for action ${action}`);
  }

  public async allowsResource(
    user: unknown,
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

class UserGate {
  public constructor(private user: unknown, private gate: Gate) {
    this.gate = gate;
    this.user = user;
  }

  public allows(action: string, ...params: unknown[]): Promise<boolean> {
    return this.gate.allowsAction(this.user, action, ...params);
  }

  public async denies(action: string, ...params: unknown[]): Promise<boolean> {
    const isAllowed = await this.allows(action, ...params);
    return !isAllowed;
  }

  public async authorize(action: string, ...params: unknown[]): Promise<void> {
    const isAllowed = await this.allows(action, ...params);
    if (!isAllowed) {
      throw new Error(`Unauthorized to "${action}"`);
    }
  }

  public for(resource: any) {
    return new UserGateWithResource(this.user, this.gate, resource);
  }
}

class UserGateWithResource {
  public constructor(
    private user: unknown,
    private gate: Gate,
    private resource: unknown,
  ) {}

  public allows(action: string, ...params: unknown[]): Promise<boolean> {
    return this.gate.allowsResource(
      this.user,
      action,
      this.resource,
      ...params,
    );
  }

  public async denies(action: string, ...params: unknown[]): Promise<boolean> {
    const isAllowed = await this.allows(action, ...params);
    return !isAllowed;
  }

  public async authorize(action: string, ...params: unknown[]): Promise<void> {
    const isAllowed = await this.allows(action, ...params);
    if (!isAllowed) {
      throw new Error(`Unauthorized to "${action}"`);
    }
  }
}
