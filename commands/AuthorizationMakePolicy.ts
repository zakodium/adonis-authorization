import { BaseCommand, args } from '@adonisjs/core/build/standalone';

const stub = `import { gate, User } from '@ioc:Adonis/Addons/Authorization';

import {{ resource }} from 'App/Models/{{ resource }}';

export default class {{ policy }} {
  @gate()
  public read(user: User, resource: {{ resource }}) {
    return false;
  }
}
`;

export default class MongodbMakeMigration extends BaseCommand {
  public static commandName = 'make:policy';
  public static description = 'Make a new policy class';

  @args.string({ description: 'Name of the policy class' })
  public name: string;

  public async run(): Promise<void> {
    let { name } = this;

    if (name.toLowerCase().endsWith('policy')) {
      name = name.slice(0, name.length - 6);
    }

    const resource = `${name[0].toUpperCase()}${name.slice(1)}`;
    const policy = `${resource}Policy`;

    this.generator
      .addFile(name, {
        form: 'singular',
        suffix: 'Policy',
        pattern: 'pascalcase',
        extname: '.ts',
      })
      .stub(stub, { raw: true })
      .destinationDir('app/Policies')
      .useMustache()
      .apply({ resource, policy });
    await this.generator.run();

    this.logger.info(
      `Now add [${resource}, ${policy}] to your gate.registerPolicies() call`,
    );
  }
}
