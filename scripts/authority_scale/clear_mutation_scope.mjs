#!/usr/bin/env node
import fs from 'node:fs';import path from 'node:path';const p=path.join(process.cwd(),'data/release/active_mutation_scope.json');fs.rmSync(p,{force:true});console.log(JSON.stringify({cleared:true},null,2));
