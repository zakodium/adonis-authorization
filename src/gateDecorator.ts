import { Exception } from '@poppinss/utils';

import { GateOptions } from '@ioc:Adonis/Addons/Authorization';

import { GateDefinition } from './GateDefinition';

export default function gateDecorator(options?: GateOptions) {
  const definition = new GateDefinition(options);
  return function decorateGate(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    target: any,
    name: string,
    descriptor: PropertyDescriptor,
  ) {
    if (typeof descriptor.value !== 'function') {
      throw new Exception('The gate decorator must be applied to a function');
    }
    if (!target.$gates) {
      target.$gates = new Map();
    }
    target.$gates.set(name, definition);
  };
}
