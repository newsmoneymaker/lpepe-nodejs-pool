# lpepe-nodejs-pool

Mining pool software for **LuckyPepe (LPEPE)** written in Node.js: a stratum server for LuckyPepe's **yescryptr32** algorithm (the standard Bitcoin Stratum protocol), share checking, block building
from the node's block template (a plain Bitcoin style coinbase that also pays the 7% dev fund output the consensus requires on every block), block accounting through the pool wallet, and batch
payouts. It is a fork of [cryptonote-nodejs-pool](https://github.com/dvandal/cryptonote-nodejs-pool) by Dvandal (GNU GPL v2) and of its adaptations
[scash-nodejs-pool](https://github.com/newsmoneymaker/scash-nodejs-pool), [ytn-nodejs-pool](https://github.com/newsmoneymaker/ytn-nodejs-pool) and the other pools of the same family, written for the
Bitcoin Core (v0.21-based, with Taproot) node and wallet RPC of LuckyPepe. Live example: <https://lpepe.pool-pay.com>.

## What it does

* **Stratum server** (plain TCP and TLS ports, Bitcoin Stratum v1): the pool asks the node for a block template (`getblocktemplate`), **builds the block itself** (a coinbase with the BIP34 height,
  the extranonce, the pool's output, the dev fund output (7% of the subsidy) that LuckyPepe's consensus demands on **every** block since genesis, the SegWit witness commitment when the template has
  one; the merkle branch; the 80 byte header) and sends every miner `mining.notify` with a share difficulty that follows the miner's hashrate (vardiff, remembered across reconnects). It checks every
  share itself with a small C helper (`hasher/lphash`): the yescrypt hash of the header, computed with the yescrypt sources of the LuckyPepe node (`hasher/yescrypt`, 2-clause BSD license). A share
  that meets the network target is submitted to the node as a whole block with `submitblock`.
* **LuckyPepe proof of work:** yescrypt with N=4096, r=32, personalization "WaviBanana" (src/hash.cpp `GetPoWHash`, src/crypto/yescrypt/yescrypt.c `yescrypt_hash`), computed over the 80 byte
  header used as both the password and the salt. The hash as a little endian number must not be above the target. Block time 60 seconds.
* **Block reward is NOT a classic halving schedule.** LuckyPepe's `GetBlockSubsidy` (src/validation.cpp) picks a pseudo-random amount inside a range that steps down every 262800 blocks, seeded from
  the *previous* block's hash (`hashPrevBlock.GetUint64(0)`):
  | height | range (LPEPE) |
  |---|---|
  | &le; 262800 | 1,000,000 .. 3,000,000 |
  | &le; 525600 | 500,000 .. 1,500,000 |
  | &le; 788400 | 250,000 .. 750,000 |
  | &le; 1,051,200 | 125,000 .. 375,000 |
  | above | 25,000 .. 75,000 |

  On top, **every block's coinbase must pay 7% of that subsidy to a fixed dev fund address** (`lpep1q4aa7j0l5jjac437ammcmm55jf3fqkwlvw3kjqs`, enforced at consensus level in `ConnectBlock` - not
  height gated, unlike some other forks' community outputs). The pool computes the exact same split itself (`lib/reward.js`, a byte-for-byte port of `GetBlockSubsidy`) since the node's own
  `getblocktemplate` only reports the miner's own share in `coinbasevalue` (it does not expose the dev fund the way some other coins' templates do); `lib/blockBuilder.js` then assembles the
  two-output coinbase (pool payout, dev fund payout, witness commitment if segwit) and the proposal test (below) proves it against the real node.
* **Accounts** are LuckyPepe addresses (P2PKH, address version byte 48; P2SH, version byte 50; base58check verified).
* **Rewards:** PROP with time weighting (slush) or SOLO.
* **Block unlocker:** a block is settled after `depth` blocks (coinbase maturity is 100). The reward is what the pool wallet received in the block's coinbase transaction (`gettransaction`);
  a block that is no longer on the chain is marked orphaned and nothing is credited.
* **Payment processor:** everyone who is due is paid in **one `sendmany` transaction per round**. The balance is debited before sending; a batch whose outcome is unknown (crash, timeout) is found
  again in the wallet by its comment and never sent twice; refused or stuck batches go back to the balances. Dry-run mode, a whitelist for rehearsals and an emergency brake (`deployment/pause-payments.sh`).
* **Website and API:** a ready website (`website_example/`) with the dashboard and its graphs, blocks, payments, top miners, worker statistics, a "Getting started" page with a config generator,
  and the public read-only JSON API.
* **Protection against connection floods:** limits per IP, a login deadline, an optional IP allow list, banning of miners with many invalid shares.
* **Tests** (`test/`): address handling, the yescrypt helper against **real LuckyPepe mainnet blocks** (`test-real-blocks.js`), and `test-lpepe-proposal.js`, which builds a block from the template
  of a **real, synchronised node** and lets the node validate it as a block proposal (coinbase, dev fund output, merkle root: the node answers `null`), and refuses a block that pays one atom too much.

## Developer donation

The pool can take a **developer donation** from the reward of every block it finds, before the miners' shares are computed (`blockUnlocker.donations`, a table `LuckyPepe address -> percent`, up to 10%
per entry; **empty by default in `config_examples/lpepe.json`**). This is separate from, and on top of, the chain's own mandatory 7% dev fund output described above. It is your pool and the license
is the GPL: set what you want and tell your miners the truth about the fees of your pool. This has nothing to do with the miner poolpayminer (a separate project with its own fee).

## Installation

See [docs/INSTALL.md](docs/INSTALL.md): the LuckyPepe node and wallet (build from source; the chain is v0.21-based Bitcoin Core with Taproot, no old-glibc patches were needed), the yescrypt helper,
Redis, the pool services (systemd templates in `deployment/`), the website and the first payout rehearsal.

Requirements: Linux, Node.js 18 or newer, Redis, a LuckyPepe node (`bitcoind`/`bitcoin-cli`, the package name inside the fork is still "bitcoin") synchronised with the network, a C compiler for the
helper, a web server for the website and a TLS certificate for the TLS stratum ports.

## Miners

poolpayminer support for `yescryptr32` is being added in a companion project; check <https://github.com/newsmoneymaker/poolpayminer> for the current status. Any Stratum miner that implements
yescrypt with N=4096, r=32 and the personalization string "WaviBanana" over the 80 byte Bitcoin-style header will work against this pool.

## Tests

```
npm install
node test/test-account.js                  # address handling, needs nothing else
make -C hasher                             # the yescrypt helper, needs only a C compiler
node test/test-real-blocks.js              # the hash of real mainnet blocks, needs only the helper
node test/test-lpepe-proposal.js config.json   # needs a running synchronised node (config.node) and poolServer.poolAddress from its wallet
```

## Money warning

The payment processor moves real coins. Rehearse first: `"dryRun": true`, then a whitelist (`onlyAccounts`) with a few small payouts of your own, then enable it. A transaction that has been sent to
the network can not be cancelled. Keep the wallet backup (`dumpwallet` / `backupwallet`) and the RPC password private.

## License and credits

GNU GPL v2 (see LICENSE), like the original. Based on cryptonote-nodejs-pool by Dvandal and contributors. The block builder, the Bitcoin Stratum server, the yescrypt helper and the LuckyPepe
adaptation are part of this project.
