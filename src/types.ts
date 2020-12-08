/* eslint-disable import/order */

declare module '@ioc:Adonis/Addons/Authorization' {
  import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext';

  export type User = Exclude<HttpContextContract['auth']['user'], undefined>;
  export type UserOrGuest = User | undefined;

  export type Constructor = new (...args: unknown[]) => unknown;

  export interface UserGateContractWithoutResource {
    allows<Action extends keyof GlobalActions>(
      action: Action,
      ...args: GlobalActions[Action]
    ): Promise<boolean>;

    denies<Action extends keyof GlobalActions>(
      action: Action,
      ...args: GlobalActions[Action]
    ): Promise<boolean>;

    authorize<Action extends keyof GlobalActions>(
      action: Action,
      ...args: GlobalActions[Action]
    ): Promise<void>;

    // TODO: any, none, all?

    // TODO: infer T from the type of resource
    /* for<T extends Constructor>() */
    for(resource: unknown): UserGateContractWithResource;
  }

  // TODO: enable additional arguments
  // This is not trivial and we cannot just remove the first or two elements from tuple
  // because there are gates that have one element to remove (the user, for gates that do not expect an instance)
  // and other gates that have two (the user and the instance)
  /*
    export interface UserGateContractWithResource<PolicyConstructor extends Constructor>
  */
  export interface UserGateContractWithResource {
    // <PolicyMethod extends keyof InstanceType<PolicyConstructor>>
    allows(
      action: string /*: PolicyMethod*/,
      ...args: unknown[]
    ): // ...args: RemoveFirstFromTuple<Parameters<InstanceType<PolicyConstructor>[PolicyMethod]>>
    Promise<boolean>;

    // <PolicyMethod extends keyof InstanceType<PolicyConstructor>>
    denies(
      action: string /*: PolicyMethod*/,
      args: unknown[],
      //   ...args: RemoveFirstFromTuple<
      //   Parameters<InstanceType<PolicyConstructor>[PolicyMethod]>
      // >
    ): Promise<boolean>;

    // <PolicyMethod extends keyof InstanceType<PolicyConstructor>>
    authorize(
      action: string /*: PolicyMethod*/,
      args: unknown[],
      //   ...args: RemoveFirstFromTuple<
      //   Parameters<InstanceType<PolicyConstructor>[PolicyMethod]>
      // >
    ): Promise<void>;

    // TODO: any, none, all?
  }

  type TypedDecorator<PropType> = <
    TKey extends string,
    TTarget extends {
      [K in TKey]: (
        user: PropType,
        ...otherArgs: unknown[]
      ) => boolean | Promise<boolean>;
    }
  >(
    target: TTarget,
    property: TKey,
  ) => void;

  export function gate(options?: { allowGuest?: false }): TypedDecorator<User>;
  export function gate(options: {
    allowGuest: true;
  }): TypedDecorator<UserOrGuest>;

  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  export interface GlobalActions {}

  export type GateCallbackUser<Action extends keyof GlobalActions> = (
    user: User,
    ...args: GlobalActions[Action]
  ) => boolean | Promise<boolean>;
  export type GateCallbackUserOrGuest<Action extends keyof GlobalActions> = (
    user: UserOrGuest,
    ...args: GlobalActions[Action]
  ) => boolean | Promise<boolean>;

  export interface GateOptionsWithGuest {
    /**
     * Whether guests (non-authenticated) users may be allowed to pass the gate.
     * By default, this is `false` and the gate callback won't even be called.
     * If `allowGuest` is `true`, the callback will be called with `null` as the
     * user.
     */
    allowGuest: true;
  }

  export interface GateOptions {
    /**
     * Whether guests (non-authenticated) users may be allowed to pass the gate.
     * By default, this is `false` and the gate callback won't even be called.
     * If `allowGuest` is `true`, the callback will be called with `null` as the
     * user.
     */
    allowGuest?: false;
  }

  export interface GateContract {
    /**
     * Define a new global gate.
     * @param action - Name of the action to protect
     * @param gate - Function that implements the gate
     * @param options
     */
    define<Action extends keyof GlobalActions>(
      action: Action,
      gate: GateCallbackUser<Action>,
      options?: GateOptions,
    ): void;
    define<Action extends keyof GlobalActions>(
      action: Action,
      gate: GateCallbackUserOrGuest<Action>,
      options?: GateOptionsWithGuest,
    ): void;

    registerPolicies(policies: Array<[Constructor, Constructor]>): void;

    forUser(user: UserOrGuest): UserGateContractWithoutResource;
  }

  export const Gate: GateContract;
}

declare module '@ioc:Adonis/Core/HttpContext' {
  import { UserGateContractWithoutResource } from '@ioc:Adonis/Addons/Authorization';

  interface HttpContextContract {
    gate: UserGateContractWithoutResource;
  }
}
