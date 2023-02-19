import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { main } from '../../../src/index.js';
import baseArguments from '../../helpers/baseArguments.js';
import baseCounters from '../../helpers/baseCounters.js';
import { joinPosix } from '../../helpers/index.js';

test('Find unused files and exports with JS entry file', async () => {
  const cwd = path.resolve('test/fixtures/js-only');

  const { issues, counters } = await main({
    ...baseArguments,
    cwd,
  });

  assert.equal(issues.files.size, 1);
  assert(issues.files.has(joinPosix(cwd, 'dangling.js')));

  assert.equal(Object.values(issues.exports).length, 0);

  assert.equal(Object.values(issues.nsExports['my-namespace.js']).length, 2);
  assert.equal(issues.nsExports['my-namespace.js']['x'].symbol, 'x');
  assert.equal(issues.nsExports['my-namespace.js']['z'].symbol, 'z');

  assert.deepEqual(counters, {
    ...baseCounters,
    files: 1,
    nsExports: 2,
    processed: 3,
    total: 3,
  });
});
