//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

//Turns a list of command line arguments into a simple map of flags.
//It understands "--name value" and "--name=value" forms.
export const parseFlags = (args: string[]): Record<string, string> => {
  const flags: Record<string, string> = {};

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];

    if (!current || !current.startsWith('--')) {
      continue;
    }

    const withoutDashes = current.slice(2);
    const equalsAt = withoutDashes.indexOf('=');

    if (equalsAt !== -1) {
      const key = withoutDashes.slice(0, equalsAt);
      flags[key] = withoutDashes.slice(equalsAt + 1);
      continue;
    }

    //The value is the next argument, unless the next thing is another flag.
    const next = args[index + 1];

    if (next && !next.startsWith('--')) {
      flags[withoutDashes] = next;
      index += 1;
    } else {
      flags[withoutDashes] = 'true';
    }
  }

  return flags;
};
