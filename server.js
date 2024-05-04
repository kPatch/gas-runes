
var cubeTools = require('./cube');
const path = require('path');
const axios = require('axios');
var crypto = require('crypto');
const express = require('express');

const app = express ();
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("Server Listening on PORT:", PORT);
  });

// app.get("/status", ());

app.get('/', function(req, res) {
  res.sendFile(path.join(__dirname, '/index.html'));
});

app.get("/runesMarket", async (request, response) => {
    const cube = 'cube.xyz' // turn to bytes

    const d = new Date();
    const epochTimeinSec = Math.round(d.getTime() / 1000);
    console.log('EPOCH SECS: ' + epochTimeinSec);
    
    const cubeTimeText = cube + epochTimeinSec
    
    const textEncoder = new TextEncoder();
    const cubeTimeBytes = textEncoder.encode(cubeTimeText);
    
    console.log('Cube Time Bytes: ' + cubeTimeBytes);
    
    const secretBytes = cubeTools.hexToByte(process.env.CUBE_SECRET); // decoded from a hex string into a 32-byte array of bytes
    console.log("SECRET HexToByte: " + secretBytes);
    
    let hmacsha256SigBytes = crypto.createHmac('sha256', secretBytes).update(cubeTimeBytes).digest("base64");
    console.log("SIG FROM BYTES: " + hmacsha256SigBytes);
    
    // const status = {
    //    "Status": "Running"
    // };

    // try {
    //     console.log("Making axios call");
    //     const response = await axios.get(url);
    //     res.status(200).json({ data: response.data });
    //   } catch (err) {
    //     console.log(err);
    //     res.status(500).json({ msg: "something bad has occurred." });
    // }

    // response.send(status);

    const Axiosresponse = await axios.get('https://api.cube.exchange/ir/v0/markets', {
        headers: {
            'x-api-key': process.env.CUBE_API_KEY,
            'x-api-signature': hmacsha256SigBytes,
            'x-api-timestamp': epochTimeinSec
        }
    })
    // .then(response => {
    //     const fullRes = response.data;
    //     // console.log(response.data);
    //     console.log(fullRes.result.assets);
    // })
    // .catch(error => {
    //     console.log(error);
    // });

    const allAssets = Axiosresponse.data.result.assets;
    console.log("ALL ASSETs: " + JSON.stringify(allAssets));
    const runeAssets = allAssets
        .filter((asset ) => asset.hasOwnProperty('metadata') === true && asset.metadata.isRunes === true)
    // .map(({ scenario, profile }) => { return { ...scenario, profile } })

    response.status(200).json(runeAssets);

    // response.status(200).json({ data: runeAssets});
    // response.status(200).json({allAssets});

});

app.get("/latestTxs", async (request, response) => {
    const Axiosresponse = await axios.get('https://mempool.space/api/mempool/recent')
    const latestTxs = Axiosresponse.data
    response.status(200).json(latestTxs);
})