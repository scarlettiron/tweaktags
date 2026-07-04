//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { runCreateSuperuser } from './commands/create-superuser.js';
import { runCreateUser } from './commands/create-user.js';
import { runMigrate } from './commands/migrate.js';
import { runUpdatePassword } from './commands/update-password.js';
import { runListTags } from './commands/list-tags.js';
import { runListUsers } from './commands/list-users.js';
import { parseFlags } from './utilities/args.js';
import { loadEnv } from './utilities/env.js';

//Prints a short list of what the cli can do.
const printHelp = (): void => {
  console.log(
    [
      'TweakTags command line',
      '',
      'Usage:',
      '  tweaktags migrate [--config path]',
      '  tweaktags create-superuser --email you@example.com --password secret [--role superuser|editor] [--config path]',
      '  tweaktags create-user --email you@example.com --password secret [--config path]',
      '  tweaktags update-password --email you@example.com --password newsecret [--config path]',
      '  tweaktags list-tags [--tenant name] [--config path]',
      '  tweaktags list-users [--config path]',
      '',
      'The config path is optional. When left out, TweakTags looks for a tweaktags.config file',
      'in the current folder.',
    ].join('\n'),
  );
};

//Reads the command name, then runs the matching command.
//Returns the process exit code so the caller can pass it to process.exit.
export const runCli = async (argv: string[]): Promise<number> => {
  //Load the dotenv files first so the database settings are available.
  loadEnv();

  const [command, ...rest] = argv;
  const flags = parseFlags(rest);

  switch (command) {
    case 'migrate':
      return runMigrate(flags);

    case 'create-superuser':
      return runCreateSuperuser(flags);

    case 'create-user':
      return runCreateUser(flags);

    case 'update-password':
      return runUpdatePassword(flags);

    case 'list-tags':
      return runListTags(flags);

    case 'list-users':
      return runListUsers(flags);

    case undefined:
    case 'help':
    case '--help':
      printHelp();

      return 0;

    default:
      console.error(`Unknown command "${command}".`);
      printHelp();

      return 1;
  }
};
