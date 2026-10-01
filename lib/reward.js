/**
 * Block "reward" of LuckyPepe mainnet (src/validation.cpp GetBlockSubsidy of the node — NOT a classic halving schedule: the
 * subsidy is a pseudo-random amount within a range that steps down every 262800 blocks, seeded from the PREVIOUS block's hash):
 *
 *   height <= 262800   -> [1,000,000 .. 3,000,000) LPEPE
 *   height <= 525600   -> [  500,000 .. 1,500,000) LPEPE
 *   height <= 788400   -> [  250,000 ..   750,000) LPEPE
 *   height <= 1051200  -> [  125,000 ..   375,000) LPEPE
 *   else               -> [   25,000 ..    75,000) LPEPE
 *
 *   seed = hashPrevBlock.GetUint64(0)     (the node's internal little-endian uint256, position 0: the LAST 8 bytes of the
 *                                          usual display/RPC hex string, read left to right as a big-endian 64 bit number)
 *   subsidy = minReward + (seed % (maxReward - minReward))     (amounts already in atomic units - LuckyPepe's own src/amount.h sets
 *                                                                COIN = 10000, i.e. 1 LPEPE = 10000 atomic units, 4 decimal places,
 *                                                                NOT the usual Bitcoin-style 1e8/8 decimals - confirmed both by
 *                                                                reading amount.h and by cross-checking a real mined block's coinbase)
 *
 * On top, since genesis every block's coinbase MUST pay a 7 % dev fund cut out of the subsidy itself (validation.cpp
 * ConnectBlock, enforced at consensus level, not just height-gated like Yenten's): nDevFund = nSubsidy * 7 / 100 (integer
 * division), nMinerReward = nSubsidy - nDevFund. The miner/pool side of the coinbase then gets nMinerReward + the tx fees;
 * see lib/blockBuilder.js for how the two-output coinbase is assembled (this file only computes the split).
 **/
const LPEPE_BASE = 10000; // src/amount.h: static const CAmount COIN = 10000;
const DEV_FUND_PERCENT = 7n;

const TIERS = [
	{maxHeight: 262800, min: 1000000, max: 3000000},
	{maxHeight: 525600, min: 500000, max: 1500000},
	{maxHeight: 788400, min: 250000, max: 750000},
	{maxHeight: 1051200, min: 125000, max: 375000},
	{maxHeight: Infinity, min: 25000, max: 75000}
];

/** the 64 bit seed the node reads out of the previous block's hash (uint256::GetUint64(0)) from its usual display/RPC hex string */
function prevHashSeed (previousblockhashHex) {
	if (typeof previousblockhashHex !== 'string' || previousblockhashHex.length < 64) return 0n;
	// GetHex() reverses the internal bytes, so m_data[0..7] (used by GetUint64(0)) are exactly the LAST 16 hex chars, in order
	return BigInt('0x' + previousblockhashHex.slice(48, 64));
}
exports.prevHashSeed = prevHashSeed;

/** the block subsidy in atomic units (BigInt), before the dev fund cut - mirrors GetBlockSubsidy(height, hashPrevBlock) exactly */
exports.subsidy = function (height, previousblockhashHex) {
	if (!(height >= 0)) return 0n;
	let tier = TIERS.find(function (t) { return height <= t.maxHeight; });
	let min = BigInt(tier.min) * BigInt(LPEPE_BASE);
	let max = BigInt(tier.max) * BigInt(LPEPE_BASE);
	let seed = prevHashSeed(previousblockhashHex);
	return min + (seed % (max - min));
};

/** {minerReward, devFund} in atomic units (BigInt), split exactly the way miner.cpp / validation.cpp do: nSubsidy * 7 / 100 to the dev fund */
exports.split = function (height, previousblockhashHex) {
	let nSubsidy = exports.subsidy(height, previousblockhashHex);
	let devFund = (nSubsidy * DEV_FUND_PERCENT) / 100n;
	return {minerReward: nSubsidy - devFund, devFund: devFund};
};

/** miner reward only, as a plain Number (safe: max ~2.79e15 atomic units, well under Number.MAX_SAFE_INTEGER) - kept for callers
 *  that only need the pool's share and not the dev fund split (e.g. a display estimate) */
exports.minerReward = function (height, previousblockhashHex) {
	return Number(exports.split(height, previousblockhashHex).minerReward);
};
