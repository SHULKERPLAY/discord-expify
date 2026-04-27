/** Returns difference of `time1` and `time2` specified in Date.now() format. Returns ms*/
function timeDiff(time1, time2) {
    return (time2 ?? Date.now()) - (time1 ?? Date.now())
}

module.exports = { timeDiff };