import { test } from 'node:test';
import assert from 'node:assert/strict';
import { communityAppId, communityGameId } from '../web/emulator/src/community-bridge.js';

test('community games preserve a stable save namespace per game and account', () => {
  const game = 'e6704ad3-558c-4664-b59d-fb9db201b526';
  const a = { id:'b1e678d3-263c-48d9-8a62-492ca13b19cf' };
  const b = { id:'2523f30d-652f-4cdf-9c08-8a21d97325b6' };
  const installed = communityAppId(game, a);
  assert.equal(communityGameId(installed), game);
  assert.equal(communityAppId(game,a), installed);
  assert.notEqual(communityAppId(game,b), installed);
  assert.notEqual(communityAppId(game,null), installed);
  assert.equal(communityGameId(communityAppId(game,null)),game);
  assert.equal(communityGameId('community_../../private'),null);
  assert.equal(communityGameId('Son Tinh Thuy Tinh'),null);
});
