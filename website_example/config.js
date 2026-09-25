/* LuckyPepe pool website settings */

// Coin name shown next to the pool name (must equal the "symbol" of the pool config)
var parentCoin = "LPEPE";

// Pool API: proxied by the web server from /api to the pool's API on 127.0.0.1
var api = "/api";

// Pool host name shown on the "Getting started" page
var poolHost = "lpepe.pool-pay.com";

// A notice shown above every page (empty = none)
var poolNotice = {en: "", ru: ""};

// Contact / community links (leave empty to hide)
var email = "admin@pool-pay.com";
var telegram = "";
var discord = "";
var github = "https://github.com/newsmoneymaker/lpepe-nodejs-pool";
var minerDownload = "";      // poolpayminer download page not published yet (yescryptr32 support pending) - left empty on purpose
var allPoolsUrl = "https://all.pool-pay.com/";      // link to the page listing every pool-pay.com pool

// No exchange data source for LuckyPepe here, market widgets are hidden
var marketCurrencies = [];

// Block explorer links ({id} = block hash or height / transaction id)
var blockchainExplorer = "https://explorer.luckypepe.org/block/{id}";
// the explorer opens a block by its hash or its height; "height" is the default
var blockExplorerId = "hash";
var transactionExplorer = "https://explorer.luckypepe.org/tx/{id}";

// Theme and default language ("en" or "ru")
var themeCss = "themes/default.css";
var defaultLang = "en";
