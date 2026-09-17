import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql=fs.readFileSync(new URL('../db/migrations/20260917_ai_thiet_chan_store_token_handshake_v2.sql',import.meta.url),'utf8');
assert.match(sql,/v_candidate_hash\s*:=\s*encode\(extensions\.digest\(p_token,'sha256'\),'hex'\)/i);
assert.match(sql,/return\s+v_existing_hash\s*=\s*v_candidate_hash/i);
assert.match(sql,/on conflict \(key\) do nothing/i);
assert.match(sql,/revoke all on function public\.ai_thiet_chan_register_secret\(text\) from public, authenticated/i);
assert.match(sql,/grant execute on function public\.ai_thiet_chan_register_secret\(text\) to anon, service_role/i);
assert.doesNotMatch(sql,/on conflict \(key\) do nothing;[\s\S]{0,120}return true/i);

console.log('STORE TOKEN HANDSHAKE SMOKE PASS: existing storage token cannot be falsely accepted or anonymously replaced.');
