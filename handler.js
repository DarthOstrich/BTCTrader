"use strict";
const axios = require("axios");
const crypto = require("crypto");
const { API_URL, API_SECRET, API_KEY, API_PASSPHRASE } = process.env;

function checkIfSameDay(lastDate, timestamp) {
  const d1 = new Date();
  const d2 = new Date(lastDate);
  const same = d1.getDay() === d2.getDay();
  return same;
}

function checkPercentDiff(last, current, diff) {
  const percent = 1.0 - diff / 100;
  console.log(last, current, last * percent);
  return current < last * percent;
}

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
  const { productID, amount } = event;
  let message = "";

  // get previous transaction data
  const { price: lastPrice, created_at: lastDate } = await getLastTrade(productID);

  const timestamp = Date.now() / 1000;

  // if trade completed for the day already, stop
  const tradeCompletedForToday = checkIfSameDay(lastDate, timestamp);
  console.log("last trade:", lastPrice, lastDate);
  console.log("trade completed today already", tradeCompletedForToday);
  if (tradeCompletedForToday) {
    message = "Trade completed for the day.";
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
  const checkPercent = checkPercentDiff(lastPrice, marketPrice, 10);
  console.log("trade diff", checkPercent);
  console.log("market price", marketPrice);
  if (!checkPercent) {
    message = "The spread doesn't match the percentage supplied";
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

  // if the time matches chosen time, trade

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
      // console.log(response.data);
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
};

module.exports.transferFunds = async (event) => {
  return {
    statusCode: 200,
    body: JSON.stringify(
      {
        message: "TODO: transferFunds",
        input: event,
      },
      null,
      2
    ),
  };
};
