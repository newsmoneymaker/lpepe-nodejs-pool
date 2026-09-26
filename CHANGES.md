# Changes

## 1.0.0

* First release: LuckyPepe (LPEPE, yescryptr32: yescrypt N=4096 r=32, personalization "WaviBanana") pool derived from ytn-nodejs-pool, scash-nodejs-pool, veil-nodejs-pool, qwc-nodejs-pool and
  epic-nodejs-pool.
* The pool builds the blocks itself from `getblocktemplate` (called with the segwit rule; `lib/blockBuilder.js`): a coinbase with BIP34 height, extranonce, the pool's output, a **mandatory 7% dev
  fund output** the chain's consensus requires on every block since genesis (recomputed by the pool itself - `lib/reward.js` - since the node's template does not expose it as a field), the witness
  commitment if present, the merkle branch and the 80 byte header; a solved block is sent with `submitblock`.
* `lib/pool.js` speaks Bitcoin Stratum v1 (prevhash with every 4 byte word reversed, version / ntime / nbits big endian, the nonce as the hex of the number, extranonce1 of
  4 bytes and extranonce2 of 4 bytes). Job ids are per miner (`<job>.<n>`) and carry the difficulty of that miner: the miner applies a new difficulty with its next job.
* `hasher/lphash` is a small C program around the yescrypt sources of the LuckyPepe node (`hasher/yescrypt`, 2-clause BSD license, copied verbatim): `make -C hasher`, no other dependency.
* `lib/reward.js` reproduces LuckyPepe's `GetBlockSubsidy` exactly: a pseudo-random reward within a range that steps down every 262800 blocks, seeded from the previous block's hash - not a classic
  halving schedule.
* Payments and unlocker as in Bitcoin based pools (`sendmany`, `gettransaction`, coinbase maturity 100), base58 addresses (P2PKH version byte 48, P2SH version byte 50).
* **LuckyPepe's `COIN` is 10000, not the usual Bitcoin-style 100000000** (src/amount.h): 1 LPEPE = 10000 atomic units, 4 decimal places, not 8. `config.json`'s `coinUnits`/`coinDecimalPlaces` and
  `lib/reward.js`'s internal scale reflect this (found by reading amount.h directly and confirmed by decoding a real mined block's coinbase outputs against the computed subsidy/dev-fund split -
  the proposal test in `test/test-lpepe-proposal.js` would otherwise fail with `bad-cb-amount` since the pool's own coinbase output would be off by a factor of 10000).
* The variable difficulty of a worker is remembered across reconnects (`poolServer.diffMemoryMinutes`, default 15).
* Tests: address handling, the yescrypt hash of real mainnet blocks, and a block built by the pool from a real node's template validated by that node as a proposal (including a negative test:
  overpaying the pool output by one atom is refused).
* Not yet checked on a block found on mainnet: the payout with the real wallet (`sendmany` with `subtractfeefrom`); payments stay in dry-run mode until then.
