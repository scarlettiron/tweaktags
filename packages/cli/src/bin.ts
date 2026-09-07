#!/usr/bin/env node
//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

import { diagnoseFailure } from '@tweaktags/core';

import { runCli } from './cli.js';

//Entry point for the "tweaktags" command.
//It runs the cli and turns the result into a process exit code.
runCli(process.argv.slice(2))
  .then((code) => {
    process.exit(code);
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);

    //"tweaktags migrate" is usually the first thing pointed at a new database,
    //so it is where a wrong host or an SSL mismatch shows up first. Say what
    //that message normally means instead of leaving the driver to explain it.
    const { hint } = diagnoseFailure(error);

    if (hint) {
      console.error(`\n${hint}`);
    }

    process.exit(1);
  });
