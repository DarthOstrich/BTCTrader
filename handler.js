"use strict";
const axios = require("axios");
const crypto = require("crypto");
const { API_URL, API_SECRET, API_KEY, API_PASSPHRASE } = process.env;
const timestamp = Date.now() / 1000;

function createSignature(timestamp, method, requestPath, body) {
  var secret = API_SECRET;

  // create the prehash string by concatenating required parts
  var what = `${timestamp + method + requestPath}${body ? body : ""}`;
  console.log(what);

  // decode the base64 secret
  var key = Buffer.from(secret, "base64");

  // create a sha256 hmac with the secret
  var hmac = crypto.createHmac("sha256", key);

  // sign the require message with the hmac
  // and finally base64 encode the result
  return hmac.update(what).digest("base64");
}

module.exports.maketrade = async (event) => {
  let message = "";
  const method = "POST";
  const requestPath = "/orders";
  const requestTrade = {
    product_id: "BTC-USD",
    side: "buy",
    type: "market",
    funds: "10.00",
  };
  const body = JSON.stringify(requestTrade);
  const requestURI = process.env.API_URL + requestPath;
  const requestSig = createSignature(timestamp, method, requestPath, body);
  const requestOptions = {
    headers: {
      "CB-ACCESS-KEY": API_KEY,
      "CB-ACCESS-SIGN": requestSig,
      "CB-ACCESS-TIMESTAMP": timestamp,
      "CB-ACCESS-PASSPHRASE": API_PASSPHRASE,
    },
  };
  console.log(requestURI, requestOptions);
  const request = axios({
    method: method,
    url: requestURI,
    data: requestTrade,
    headers: requestOptions.headers,
  })
    .then(function (response) {
      // handle success
      message = "it ran";
      console.log(response.data);
    })
    .catch(function (error) {
      // handle error
      message = "error";
      console.log(error.response.data);
    });

  return {
    statusCode: 200,
    body: JSON.stringify(
      {
        message: message,
        input: event,
      },
      null,
      2
    ),
  };
};

module.exports.transferFunds = async (event) => {
  return {
    statusCode: 200,
    body: JSON.stringify(
      {
        message: "Go Serverless v1.0! Your function executed successfully!",
        input: event,
      },
      null,
      2
    ),
  };
};
