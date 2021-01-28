"use strict";
const axios = require("axios");
const crypto = require("crypto");
const { API_URL, API_SECRET, API_KEY, API_PASSPHRASE } = process.env;
const { checkTimeToTrade, checkIfSameDay, checkPercentDiff } = require("./utils/helpers");

function createSignature(timestamp, method, requestPath, body) {
  const secret = API_SECRET;

  // create the prehash string by concatenating required parts
  let what = `${timestamp + method + requestPath}${body ? body : ""}`;

  // decode the base64 secret
  var key = Buffer.from(secret, "base64");

  // create a sha256 hmac with the secret
  var hmac = crypto.createHmac("sha256", key);

  // sign the require message with the hmac
  // and finally base64 encode the result
  return hmac.update(what).digest("base64");
}

const getLastTrade = async (productID) => {
  const timestamp = Date.now() / 1000;
  const requestPath = "/fills?product_id=" + productID;
  const method = "GET";
  const requestURI = process.env.API_URL + requestPath;

  const requestSig = createSignature(timestamp, method, requestPath);
  const requestOptions = {
    headers: {
      "CB-ACCESS-KEY": API_KEY,
      "CB-ACCESS-SIGN": requestSig,
      "CB-ACCESS-TIMESTAMP": timestamp,
      "CB-ACCESS-PASSPHRASE": API_PASSPHRASE,
    },
  };

  const request = await axios({
    method: "GET",
    url: requestURI,
    headers: requestOptions.headers,
  })
    .then(function (response) {
      // handle success
      // console.log(lastTrade);
      return response.data[0];
    })
    .catch(function (error) {
      // handle error
      return error.response.data;
      // console.log(error.response.data);
    });
  return request;
};

async function getMarketPrice(productID) {
  // GET /products/<product-id>/ticker
  const method = "GET";
  const requestURL = `${process.env.API_URL}/products/${productID}/ticker`;

  const request = await axios({
    method: method,
    url: requestURL,
    // headers: requestOptions.headers,
  })
    .then(function (response) {
      const { price } = response.data;
      // handle success
      // console.log(price);
      return price;
    })
    .catch(function (error) {
      // handle error
      return error.response.data;
      // console.log(error.response.data);
    });
  return request;
}

module.exports.maketrade = async (event) => {
  const { productID, amount, timeToTrade, spread } = event;
  let message = "";

  // get previous transaction data
  const { price: lastPrice, created_at: lastDate } = await getLastTrade(productID);

  const timestamp = Date.now() / 1000;

  // if trade completed for the day already, stop
  const tradeCompletedForToday = checkIfSameDay(lastDate, timestamp);
  // console.log("last trade:", lastPrice, lastDate);
  // console.log("trade completed today already", tradeCompletedForToday);
  if (tradeCompletedForToday) {
    message = "Trade completed for the day.";
    console.log(message);
    return {
      statusCode: 200,
      body: JSON.stringify(
        {
          message: message,
        },
        null,
        2
      ),
    };
  }

  // if the price difference matches the percent, trade
  const marketPrice = await getMarketPrice(productID);
  const checkPercent = checkPercentDiff(lastPrice, marketPrice, spread);
  const checkTime = checkTimeToTrade(timeToTrade);

  // if it is the right time, trade or percentage diff is correct
  if (checkPercent || checkTime) {
    const method = "POST";
    const requestPath = "/orders";
    const requestTrade = {
      product_id: productID,
      side: "buy",
      type: "market",
      funds: amount,
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
    // console.log(requestURI, requestOptions);
    await axios({
      method: method,
      url: requestURI,
      data: requestTrade,
      headers: requestOptions.headers,
    })
      .then(function (response) {
        // handle success
        const { product_id, specified_funds } = response.data;
        message = `Buy Succeeded: ${product_id}, $${specified_funds} `;
        console.log(message);
      })
      .catch(function (error) {
        // handle error
        message = error.response.data;
        // console.log(error.response.data);
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
  } else {
    message = `Percentage Difference match: ${checkPercent}. Time to trade: ${checkTime}`;
    console.log(message);
    return {
      statusCode: 200,
      body: JSON.stringify(
        {
          message: message,
        },
        null,
        2
      ),
    };
  }
};
