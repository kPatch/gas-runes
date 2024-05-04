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
const relayerAccount = hdKey.derivePath("m/86'/0'/4'")

//for (const {wallet, name} of [
//    {wallet: ordAccount, name: 'ord'},
//    {wallet: feeAccount, name: 'fee'},
//    {wallet: cpfpAccount, name: 'cpfp'},
//    {wallet: relayerAccount, name: 'relayer'},
//]) {
//    console.log(`${name} wallet`)
//    for (const i of [0, 1, 2]) {
//        console.log(`m/86'/0'/0'/0/${i}`)
//        console.log(btc.payments.p2tr({
//            network: btc.networks.testnet,
//            internalPubkey: ordAccount.derivePath(`0/${i}`).publicKey.slice(1),
//        }).address)
//    }
//}

// Create the main transaction
// ins:
// * fee token input
// * transfer input
// outs:
// * ephemeral anchor output
// * transfer output
let p1 = new btc.Psbt({version: 3});
const inputs = [
    {
        hash: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
        index: 0,
        amount: 331,
    },
    {
        hash: 'cafebabecafebabecafebabecafebabecafebabecafebabecafebabecafebabe',
        index: 0,
        amount: 331,
    },
]
let feePk = feeAccount.derivePath('0/0').publicKey.slice(1)
let fee_payment = btc.payments.p2tr({pubkey: feePk, network: btc.networks.testnet})

let runePk = ordAccount.derivePath('0/0').publicKey.slice(1)
let rune_payment = btc.payments.p2tr({pubkey: runePk, network: btc.networks.testnet})

let dummyPk = dummyAccount.derivePath('0/0').publicKey.slice(1)
let recipient_payment = btc.payments.p2tr({pubkey: dummyPk, network: btc.networks.testnet})

inputs.forEach(i => p1.addInput(i))
p1.updateInput(0, {
    tapInternalKey: feePk,
    witnessUtxo: {script: fee_payment.output, value: inputs[0].amount}
})
p1.updateInput(1, {
    tapInternalKey: runePk,
    witnessUtxo: {script: rune_payment.output, value: inputs[1].amount}
})
// Ephemeral anchors work with OP_TRUE
p1.addOutput({value: inputs[0].amount, script: btc.script.fromASM("OP_TRUE")})
p1.addOutput({value: inputs[1].amount, script: recipient_payment.output})
p1.signInput(0, feeAccount.derivePath('0/0'))
p1.signInput(1, ordAccount.derivePath('0/0'))
p1.finalizeAllInputs()
const tx1 = p1.extractTransaction()
const totalVb = tx1.virtualSize() + 153

// *****
// Initially self CPFP with a minimal fee rate
const relayFeeRate = 20
const initialCpfpFee = totalVb * relayFeeRate

const cpfpInput = {
    hash: 'fadefeedfadefeedfadefeedfadefeedfadefeedfadefeedfadefeedfadefeed',
    index: 0,
    amount: 10000,
}
let p2 = new btc.Psbt({version: 3});
p2.addInput({hash: tx1.getId(),index: 0})
p2.addInput(cpfpInput)
let cpfpPk = cpfpAccount.derivePath('0/0').publicKey.slice(1)
let cpfp_payment = btc.payments.p2tr({pubkey: cpfpPk, network: btc.networks.testnet})
p2.updateInput(0, {
    witnessUtxo: {script: btc.script.fromASM("OP_TRUE"), value: inputs[0].amount}
})
p2.updateInput(1, {
    tapInternalKey: cpfpPk,
    witnessUtxo: {script: cpfp_payment.output, value: cpfpInput.amount}
})
// build cpfp change address from dummy account using p2tr payment
let cpfpPk2 = cpfpAccount.derivePath('0/1').publicKey.slice(1)
let cpfp_payment2 = btc.payments.p2tr({pubkey: cpfpPk2, network: btc.networks.testnet})
p2.addOutput({value: cpfpInput.amount - initialCpfpFee,script: cpfp_payment2.output})
p2.signInput(1, cpfpAccount.derivePath('0/0'))
p2.finalizeInput(0, () => ({finalScriptSig: Buffer.of()}))
p2.finalizeInput(1)
const tx2 = p2.extractTransaction()


// *****
// Relayer CPFP with a quick confirmation fee rate
const targetFeeRate = 500
const targetCpfpFee = totalVb * targetFeeRate

const relayerInput = {
    hash: 'feeefeeefeeefeeefeeefeeefeeefeeefeeefeeefeeefeeefeeefeeefeeefeee',
    index: 0,
    amount: 200000,
}
let p3 = new btc.Psbt({version: 3});
p3.addInput({hash: tx1.getId(),index: 0})
p3.addInput(relayerInput)
let relayerPk = relayerAccount.derivePath('0/0').publicKey.slice(1)
let relayer_payment = btc.payments.p2tr({
    pubkey: relayerPk,
    network: btc.networks.testnet,
})
p3.updateInput(0, {
    witnessUtxo: {script: btc.script.fromASM("OP_TRUE"), value: inputs[0].amount}
})
p3.updateInput(1, {
    tapInternalKey: relayerPk,
    witnessUtxo: {script: relayer_payment.output, value: relayerInput.amount}
})
// build cpfp change address from dummy account using p2tr payment
let relayerPk2 = relayerAccount.derivePath('0/1').publicKey.slice(1)
let relayer_payment2 = btc.payments.p2tr({pubkey: relayerPk2, network: btc.networks.testnet})
p3.addOutput({value: relayerInput.amount-targetCpfpFee,script: relayer_payment2.output})
p3.signInput(1, relayerAccount.derivePath('0/0'))
p3.finalizeInput(0, () => ({finalScriptSig: Buffer.of()}))
p3.finalizeInput(1)
const tx3 = p3.extractTransaction()


// Output the transaction details
let arr = [[tx1, p1], [tx2, p2], [tx3, p3]]

arr.forEach(([tx, p], i) => {
    console.log(`tx${i+1}`)
    console.log({
        feeRate: p.getFeeRate(),
        vSize: tx.virtualSize(),
        packageFeeRate: Math.round(p.getFee() / (tx.virtualSize() + tx1.virtualSize())),
    })
})
