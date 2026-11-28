import assert from "node:assert/strict";
import test from "node:test";
import { eveningPreviewVariables } from "./configure-bingo-evening-preview";

const environment = {
  DEPLOYMENT_BRANCH: 'codex/bingo-evening-dramaturgy', DEPLOYMENT_ENV: 'preview', DEPLOYMENT_EVENT: 'workflow_dispatch',
  DEPLOYMENT_REF: 'refs/heads/codex/bingo-evening-dramaturgy', DEPLOYMENT_REPOSITORY: 'justphilgud/pubquiz-web',
  VERCEL_ORG_ID: 'team_BE4XNxNRwsaEnSb9N8FFvWEH', VERCEL_PROJECT_ID: 'prj_9Nnwer6B43P0nfrOZPIEygFWg666',
  DATABASE_URL: 'postgresql://synthetic:fixture@ep-holy-term-baa881iq-pooler.c-8.eu-central-1.aws.neon.tech/bingo_evening_review?sslmode=verify-full',
};
test('administrative configuration emits only four exact Preview branch database overrides', () => {
  const variables = eveningPreviewVariables(environment);
  assert.deepEqual(variables.map(v => v.key), ['DATABASE_URL', 'EXPECTED_DATABASE_HOST', 'EXPECTED_DATABASE_NAME', 'EXPECTED_DATABASE_BRANCH']);
  for (const variable of variables) {
    assert.equal(variable.gitBranch, environment.DEPLOYMENT_BRANCH);
    assert.deepEqual(variable.target, ['preview']);
  }
  assert.equal(variables[0].type, 'sensitive');
  for (const [key, value] of Object.entries({ DEPLOYMENT_BRANCH: 'main', DEPLOYMENT_ENV: 'production', DEPLOYMENT_EVENT: 'push', DEPLOYMENT_REF: 'refs/heads/main', DEPLOYMENT_REPOSITORY: 'other/repo', VERCEL_ORG_ID: 'foreign', VERCEL_PROJECT_ID: 'foreign', DATABASE_URL: environment.DATABASE_URL.replace('bingo_evening_review', 'bingo_print_v4_review') })) {
    assert.throws(() => eveningPreviewVariables({ ...environment, [key]: value }), key);
  }
});

test('explicit Bingo color branch shares only the approved synthetic database',()=>{
 const approved={...environment,DEPLOYMENT_BRANCH:'codex/bingo-presentation-colors',DEPLOYMENT_REF:'refs/heads/codex/bingo-presentation-colors'};
 for(const variable of eveningPreviewVariables(approved))assert.equal(variable.gitBranch,approved.DEPLOYMENT_BRANCH);
 assert.throws(()=>eveningPreviewVariables({...approved,DATABASE_URL:approved.DATABASE_URL.replace('bingo_evening_review','neondb')}));
 assert.throws(()=>eveningPreviewVariables({...approved,DEPLOYMENT_ENV:'production'}));
 assert.throws(()=>eveningPreviewVariables({...approved,DEPLOYMENT_BRANCH:'codex/bingo-presentation-colors-foreign'}));
});
