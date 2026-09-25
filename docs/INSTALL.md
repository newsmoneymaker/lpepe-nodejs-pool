# Installing a LuckyPepe pool

Paths below are examples: the pool in `/opt/lpepe-nodejs-pool`, the node and its data in `/opt/lpepe`, all run by the user `lpepepool`
(the systemd templates in `deployment/systemd/` use these paths).

## 1. LuckyPepe node and wallet

LuckyPepe Core (`https://github.com/LuckyPepeChain/luckypepe-chain`, branch `main`, based on Bitcoin Core v0.21.2 with Taproot backported) builds cleanly with a normal autotools toolchain and its
own `depends` system - no old-glibc/gcc workaround was needed on Debian 10 (gcc 8.3, glibc 2.28). The binaries keep the upstream Bitcoin Core names (`bitcoind`, `bitcoin-cli`, `bitcoin-tx`,
`bitcoin-wallet`) even though the package/chain is LuckyPepe.

```
git clone https://github.com/LuckyPepeChain/luckypepe-chain lpepe-src && cd lpepe-src
# build dependencies: curl build-essential libtool autotools-dev automake pkg-config python3 bsdmainutils patch bison ca-certificates
chmod +x autogen.sh configure depends/config.guess depends/config.sub   # the tarball/clone can lose the executable bit
make -C depends -j$(nproc) NO_QT=1 NO_UPNP=1 NO_NATPMP=1
./autogen.sh
./configure --prefix=$PWD/depends/x86_64-pc-linux-gnu --without-gui --disable-tests --disable-bench --with-incompatible-bdb --disable-man
make -j$(nproc)                                              # src/bitcoind, src/bitcoin-cli
```

`/opt/lpepe/data/luckypepe.conf`:

```
server=1
daemon=0
txindex=1
rpcuser=lpepepool
rpcpassword=<a long random password>
rpcbind=127.0.0.1
rpcallowip=127.0.0.1
rpcport=9778
port=9777
maxconnections=64
```

**No official chain snapshot is published** (the GitHub releases only carry the `bitcoind`/`bitcoin-cli`/wallet binaries, no bootstrap archive) - sync from the network. The seed nodes are in
`src/chainparams.cpp` (`seed1..seed6.luckypepe.org` plus two literal IPs); check a couple resolve/connect on port 9777 before committing to a long sync. The chain is small (height in the low
hundreds of thousands as of writing, `m_assumed_blockchain_size` 350 MB) so a from-scratch sync is a matter of tens of minutes to a few hours, not days. Track progress with
`bitcoin-cli -datadir=... -conf=... getblockchaininfo` (`blocks` vs `headers`, `verificationprogress`). Block templates are served once `initialblockdownload` is `false`. **LuckyPepe needs
`getblocktemplate` with the segwit rule** (`{"rules":["segwit"]}`, `SegwitHeight=1` so this is required from genesis), which the pool does.

The default wallet of the node is the pool wallet:

```
bitcoin-cli -datadir=... -conf=... getnewaddress "pool"          # the pool address (poolServer.poolAddress); base58, version byte 48
bitcoin-cli -datadir=... -conf=... dumpwallet /safe/place/lpepe-wallet-dump.txt   # the private keys: keep it offline, chmod 600 (also: backupwallet <file>)
```

**Mandatory dev fund output.** Unlike some forks that only start requiring a community output at a later height, LuckyPepe's `ConnectBlock` (src/validation.cpp) requires **every** block's
coinbase, from genesis, to pay `nSubsidy * 7 / 100` to the fixed address `lpep1q4aa7j0l5jjac437ammcmm55jf3fqkwlvw3kjqs` (bech32, hardcoded as `DEV_FUND_ADDRESS` in both `src/miner.cpp` and
`src/validation.cpp`). The node's own `getblocktemplate` RPC does **not** expose this as a field the way e.g. Yenten's fork names its community output in a `developer` field - `coinbasevalue` in
the template is already only the miner's own share (`vtx[0]->vout[0].nValue`). The pool therefore recomputes the exact subsidy/split itself from the height and the previous block's hash
(`lib/reward.js`, a byte-for-byte port of `GetBlockSubsidy`) and builds the second output itself (`lib/blockBuilder.js`); the scriptPubKey of the dev fund address was read once from the node with
`bitcoin-cli getaddressinfo lpep1q4aa7j0l5jjac437ammcmm55jf3fqkwlvw3kjqs` and is hardcoded as `DEV_FUND_SCRIPT_HEX` in `lib/blockBuilder.js` (avoids depending on a bech32 decoder in the pool).
`node test/test-lpepe-proposal.js` proves the resulting block validates against a real node.

The wallet is a plain (non HD... check with `getwalletinfo` -> `hdseedid`, modern Core wallets are HD by default) wallet with a key pool: back it up again after new addresses were handed out.

## 2. yescrypt helper

The helper (`hasher/lphash`) is a tiny C program around the yescrypt sources of the node (`hasher/yescrypt`, 2-clause BSD license, copied verbatim from `src/crypto/yescrypt/`): `cd hasher && make`
(needs only a C compiler; `STATIC=-static` for a binary that runs anywhere). Check it against the chain: `node test/test-real-blocks.js`. Each hash needs about 16 MB of memory (N=4096, r=32:
`128*r*N` bytes for the main buffer) - light compared to RandomX but not free; `hasher.threads` controls how many run in parallel (each share is one hash).

## 3. Redis

Use a dedicated instance with a password and AOF (`deployment/redis-pool.conf.example`, unit `lpepe-pool-redis`, port 6391).

## 4. The pool

```
cd /opt/lpepe-nodejs-pool && npm install --production
cp config_examples/lpepe.json config.json      # then edit it
```

Edit `config.json`: `poolHost`, `poolServer.poolAddress` (the wallet address of step 1), the ports and the certificate for TLS (`poolServer.sslCert/sslKey`), `redis`, `api.password`,
`node.password` or `node.passwordFile`, `blockUnlocker.poolFee` and `donations`, `payments`. **Keep `payments.dryRun: true` until the rehearsal below.**

```
cp deployment/systemd/*.service /etc/systemd/system/ && systemctl daemon-reload
systemctl enable --now lpepe-pool-redis lpepe-node
systemctl enable --now lpepe-pool lpepe-pool-api lpepe-pool-unlocker lpepe-pool-payments lpepe-pool-charts
node test/test-lpepe-proposal.js config.json        # the node itself validates a block built by the pool (needs the synchronised node)
```

The pool runs as separate modules (`init.js -module=pool|api|unlocker|payments|chartsDataCollector`), each in its own unit. Set `poolServer.allowIPs` to restrict the stratum ports until you are
ready to announce the pool publicly (leave `[]` to accept everyone).

## 5. Website

Copy `website_example/` to the web root, set `poolHost`, the contact and links in `config.js`, and proxy `/api` to the pool API on 127.0.0.1:8129 (`deployment/apache-vhost.conf.example` exposes
only the read-only methods).

## 6. Rehearse the payments

1. `payments.dryRun: true`: the log of `lpepe-pool-payments` shows what would be paid.
2. Fund the pool wallet with a few coins (or wait for the first block), credit a small balance in Redis to your own test addresses (`<coin>:workers:<address>`, field `balance`), set `payments.onlyAccounts`
   to them, `dryRun: false`, and watch the payout confirm.
3. Remove the test accounts from Redis and set `onlyAccounts` to `[]`.

Good to know: block rewards can be spent after 100 blocks (about 100 minutes at LuckyPepe's 60 second block time); `deployment/pause-payments.sh` stops new payouts at once; the wallet must stay
unlocked and online for the payouts (leave the pool wallet unencrypted with only small balances in it). Of a block the pool only gets the subsidy minus the mandatory 7% dev fund output, plus the
transaction fees.
