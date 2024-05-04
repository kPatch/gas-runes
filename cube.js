require('dotenv').config()
// console.log(process.env) // remove this

const https = require('https');
var crypto = require('crypto');
const { hostname } = require('os');

const byteToHex = (byte) => {
    const key = '0123456789abcdef'
    let bytes = new Uint8Array(byte)
    let newHex = ''
    let currentChar = 0
    for (let i=0; i<bytes.length; i++) { // Go over each 8-bit byte
      currentChar = (bytes[i] >> 4)      // First 4-bits for first hex char
      newHex += key[currentChar]         // Add first hex char to string
      currentChar = (bytes[i] & 15)      // Erase first 4-bits, get last 4-bits for second hex char
      newHex += key[currentChar]         // Add second hex char to string
    }
    return newHex
  }
  // byteToHex([104,101,108,108,111])
  // => '68656c6c6f'

const hexToByte = (hex) => {
    const key = '0123456789abcdef'
    let newBytes = []
    let currentChar = 0
    let currentByte = 0
    for (let i=0; i<hex.length; i++) {   // Go over two 4-bit hex chars to convert into one 8-bit byte
    currentChar = key.indexOf(hex[i])
    if (i%2===0) { // First hex char
        currentByte = (currentChar << 4) // Get 4-bits from first hex char
    }
    if (i%2===1) { // Second hex char
        currentByte += (currentChar)     // Concat 4-bits from second hex char
        newBytes.push(currentByte)       // Add byte
    }
    }
    return new Uint8Array(newBytes)
}
// hexToByte('68656c6c6f')
// => [104, 101, 108, 108, 111]

const cube = 'cube.xyz' // turn to bytes

const d = new Date();
const epochTimeinSec = Math.round(d.getTime() / 1000);
console.log('EPOCH SECS: ' + epochTimeinSec);

const cubeTimeText = cube + epochTimeinSec

const textEncoder = new TextEncoder();
const cubeTimeBytes = textEncoder.encode(cubeTimeText);

console.log('Cube Time Text: ' + cubeTimeText);
console.log('Cube Time Bytes: ' + cubeTimeBytes);

const secretBytes = hexToByte(process.env.CUBE_SECRET); // decoded from a hex string into a 32-byte array of bytes
console.log("SECRET HexToByte: " + secretBytes);

// let hmacsha256SigHex = crypto.createHmac('sha256', secret).update(cubeTimeBytes).digest("base64");
// console.log("SIG FROM HEX: " + hmacsha256SigHex);

let hmacsha256SigBytes = crypto.createHmac('sha256', secretBytes).update(cubeTimeBytes).digest("base64");
console.log("SIG FROM BYTES: " + hmacsha256SigBytes);

const axios = require('axios');

axios.get('https://api.cube.exchange/ir/v0/markets', {
    headers: {
        'x-api-key': process.env.CUBE_API_KEY,
        'x-api-signature': hmacsha256SigBytes,
        'x-api-timestamp': epochTimeinSec
    }
})
.then(response => {
  const fullRes = response.data;
  // console.log(response.data);
  console.log(fullRes.result.assets);
})
.catch(error => {
  console.log(error);
});