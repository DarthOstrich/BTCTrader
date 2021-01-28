exports.checkTimeToTrade = (timeToTrade) => {
  const [hour, minute] = timeToTrade.split(":");
  const now = new Date();
  const minutes = now.getMinutes();
  const withinFive = minutes - minute <= 5 && minutes - minute >= -5;
  const rightHour = hour == now.getHours();
  if (!rightHour) {
    console.log("Wrong hour");
    return false;
  }
  if (!withinFive) {
    console.log("Not within five:", withinFive);
    return false;
  }
  return true;
};

exports.checkIfSameDay = (lastDate, timestamp) => {
  const d1 = new Date();
  const d2 = new Date(lastDate);
  const same = d1.getDay() === d2.getDay();
  return same;
};

exports.checkPercentDiff = (last, current, diff) => {
  const percent = 1.0 - diff / 100;
  console.log(last, current, last * percent);
  return current < last * percent;
};
