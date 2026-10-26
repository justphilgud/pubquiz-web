import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync}from'node:fs';
test('AP3 Preview requires the exact approved branch, dedicated database and runtime identity',()=>{
 const s=readFileSync('.github/workflows/deploy-preview.yml','utf8');
 for(const text of ["(github.ref != 'refs/heads/codex/shared-game-design' || inputs.isolated_shared_design)","(!inputs.isolated_shared_design || github.ref == 'refs/heads/codex/shared-game-design')",'SHARED_DESIGN_MIGRATION_DATABASE_URL','SHARED_DESIGN_DATABASE_URL','shared_design_review_20261026'])assert.ok(s.includes(text),text);
});
