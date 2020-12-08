import { GateContract } from '@ioc:Adonis/Addons/Authorization';
import { ApplicationContract } from '@ioc:Adonis/Core/Application';
import { HttpContextConstructorContract } from '@ioc:Adonis/Core/HttpContext';

import Gate from '../src/Gate';
import gateDecorator from '../src/gateDecorator';

export default class MongodbProvider {
  public static needsApplication = true;
  public constructor(protected app: ApplicationContract) {}

  public register(): void {
    this.app.container.singleton('Adonis/Addons/Authorization', () => {
      return { Gate: new Gate(), gate: gateDecorator };
    });
  }

  public boot(): void {
    this.app.container.with(
      ['Adonis/Core/HttpContext', 'Adonis/Addons/Authorization'],
      (
        HttpContext: HttpContextConstructorContract,
        { Gate }: { Gate: GateContract },
      ) => {
        HttpContext.getter(
          'gate',
          function gateGetter() {
            return Gate.forUser(this.auth.user);
          },
          true,
        );
      },
    );
  }
}
