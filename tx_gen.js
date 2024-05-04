let btc=require('bitcoinjs-lib')
// outer structure of btc tx
let p= new btc.Psbt();
//key path spend
// pay to taproot
let pubkey=Buffer.from("0x00","hex");
let rune_payment=btc.payments.p2tr({internalPubkey:pubkey,
    network:btc.networks.testnet})
let fund_payment=btc.payments.p2tr({internalPubkey:pubkey,
    network:btc.networks.testnet})
//
let recipient_address='';
//

let txId="0x0000000000"
let txId2="0x0000000000"
p.addInput({hash:txId,index:0})
p.addInput({hash:txId2,index:0})
// Ephemeral anchors work with OP_TRUE
// Do not need a payment because of simplicity
p.addOutput({amount:331,script:btc.script.fromASM("OP_TRUE")})
p.addOutput({amount:1000000000000,script:btc.address.toOutputScript(recipient_address)})

