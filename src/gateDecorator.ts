import { Exception } from '@poppinss/utils';

import {
  GateOptions,
  GateOptionsWithGuest,
  TypedDecorator,
  UserOrGuest,
} from '@ioc:Adonis/Addons/Authorization';

import { GateDefinition } from './GateDefinition';

export default function gateDecorator(
  options: GateOptions | GateOptionsWithGuest = {},
): TypedDecorator<UserOrGuest> {
  const definition = new GateDefinition(options);
  return function decorateGate(
    target: any,
    name: string,
    descriptor: PropertyDescriptor,
  ) {
    if (!descriptor || typeof descriptor.value !== 'function') {
      throw new Exception('The gate decorator must be applied to a method');
    }
    if (!target.$gates) {
      target.$gates = new Map();
    }
    target.$gates.set(name, definition);
  };
}
