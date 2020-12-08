import {
  GateOptions,
  GateOptionsWithGuest,
} from '@ioc:Adonis/Addons/Authorization';

export class GateDefinition {
  public isGuestAllowed: boolean;

  public constructor(options: GateOptionsWithGuest | GateOptions = {}) {
    const { allowGuest = false } = options;

    if (typeof allowGuest !== 'boolean') {
      throw new TypeError('options.allowGuest must be a boolean');
    }

    this.isGuestAllowed = allowGuest;
  }
}
