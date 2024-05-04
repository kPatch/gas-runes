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
const cpfpAccount = hdKey.derivePath("m/86'/0'/2'")
const dummyAccount = hdKey.derivePath("m/86'/0'/3'")
for (const {wallet, name} of [
    {wallet: ordAccount, name: 'ord'},
    {wallet: feeAccount, name: 'fee'},
    {wallet: cpfpAccount, name: 'cpfp'},
]) {
    console.log(`${name} wallet`)
    for (const i of [0, 1, 2]) {
        console.log(`m/86'/0'/0'/0/${i}`)
        console.log(btc.payments.p2tr({
            network: btc.networks.testnet,
            internalPubkey: ordAccount.derivePath(`0/${i}`).publicKey.slice(1),
        }).address)
    }
}

// outer structure of btc tx
let p= new btc.Psbt({version: 3});
//key path spend
// pay to taproot
const inputs = [
    // Fee ordinal
    {
        hash: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
        index: 0,
        amount: 331,
    },
    // Transfer ordinal
    {
        hash: 'cafebabecafebabecafebabecafebabecafebabecafebabecafebabecafebabe',
        index: 0,
        amount: 331,
    },
]
let feePk=feeAccount.derivePath('0/0').publicKey.slice(1)
let runePk=ordAccount.derivePath('0/0').publicKey.slice(1)

let fee_payment=btc.payments.p2tr({
    pubkey:feePk,
    network:btc.networks.testnet,
})
let rune_payment=btc.payments.p2tr({
    pubkey:runePk,
    network:btc.networks.testnet,
})

// build recipient address from dummy account using p2tr payment
let recipient_payment=btc.payments.p2tr({
    pubkey:dummyAccount.derivePath('0/0').publicKey.slice(1),
    network:btc.networks.testnet,
})

inputs.forEach(i => p.addInput(i))
p.updateInput(0, {
    tapInternalKey: feePk,
    witnessUtxo: {
        script: fee_payment.output,
        value: inputs[0].amount,
    }
})
p.updateInput(1, {
    tapInternalKey: runePk,
    witnessUtxo: {
        script: rune_payment.output,
        value: inputs[1].amount,
    }
})
// Ephemeral anchors work with OP_TRUE
// Do not need a payment because of simplicity
p.addOutput({value:inputs[0].amount, script:btc.script.fromASM("OP_TRUE")})
p.addOutput({value:inputs[1].amount, script:recipient_payment.output})
p.signInput(0, feeAccount.derivePath('0/0'))
p.signInput(1, ordAccount.derivePath('0/0'))
p.finalizeAllInputs()
const tx1 = p.extractTransaction()
console.log(`tx1 size: ${tx1.virtualSize()}`)

const cpfpInput = {
    hash: 'fadefeedfadefeedfadefeedfadefeedfadefeedfadefeedfadefeedfadefeed',
    index: 0,
    amount: 10000,
}
let p2= new btc.Psbt();
p2.addInput({hash:tx1.getId(),index:0})
p2.addInput(cpfpInput)
let cpfpPk = cpfpAccount.derivePath('0/0').publicKey.slice(1)
let cpfp_payment=btc.payments.p2tr({
    pubkey:cpfpPk,
    network:btc.networks.testnet,
})
p2.updateInput(0, {
    witnessUtxo: {
        script: btc.script.fromASM("OP_TRUE"),
        value: inputs[0].amount,
    }
})
p2.updateInput(1, {
    tapInternalKey: cpfpPk,
    witnessUtxo: {
        script: cpfp_payment.output,
        value: cpfpInput.amount,
    }
})
// build cpfp change address from dummy account using p2tr payment
let cpfp_payment2=btc.payments.p2tr({
    pubkey:cpfpAccount.derivePath('0/1').publicKey.slice(1),
    network:btc.networks.testnet,
})
p2.addOutput({value:331,script:cpfp_payment2.output})
p2.signInput(1, cpfpAccount.derivePath('0/0'))
p2.finalizeInput(0, () => ({finalScriptSig: Buffer.of()}))
p2.finalizeInput(1)
const tx2 = p2.extractTransaction()

console.log(`tx2 size: ${tx2.virtualSize()}`)
