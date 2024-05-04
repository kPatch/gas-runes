const fs = require('fs')
const process = require('process')
const btc = require('bitcoinjs-lib')
const {BIP32Factory} = require('bip32')
const bip39 = require('bip39')
const ecc = require('tiny-secp256k1')
const bip32 = new BIP32Factory(ecc)
btc.initEccLib(ecc)

const mnemonic = fs.readFileSync('mnemonic.txt', 'ascii')
if (!mnemonic) {
    console.log('no mnemonic')
    process.exit(1)
}

const seed = bip39.mnemonicToSeedSync(mnemonic)
const hdKey = bip32.fromSeed(seed, btc.networks.testnet)

const ordAccount = hdKey.derivePath("m/86'/0'/0'")
const feeAccount = hdKey.derivePath("m/86'/0'/1'")

console.log(btc.payments.p2tr({
    network: btc.networks.testnet,
    internalPubkey: ordAccount.derivePath('0/0').publicKey.slice(1),
}).address)
console.log(btc.payments.p2tr({
    network: btc.networks.testnet,
    internalPubkey: feeAccount.derivePath('0/0').publicKey.slice(1),
}).address)
