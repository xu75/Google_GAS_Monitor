function batchCheckETF_MA_Webhook_Configurable() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var configSheet = ss.getSheetByName("Config");
  if (!configSheet) throw new Error("找不到Config表！");
  var configs = configSheet.getDataRange().getValues();
  var headers = configs[0];

  for (var i = 1; i < configs.length; i++) {
    var row = configs[i];
    var params = {};
    for (var j = 0; j < headers.length; j++) {
      params[headers[j].toLowerCase()] = row[j];
    }
    try {
      runSingleTicker_MA_Webhook_AutoSheet(params, ss);
    } catch (err) {
      Logger.log("Error: " + (params['ticker'] || '未知') + ": " + err);
    }
  }
}

// 自动触发 GoogleFinance 重新拉数据
function forceSheetRefresh(sheetName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  sheet.getRange("Z1").setValue(new Date().toISOString());
}

function runSingleTicker_MA_Webhook_AutoSheet(params, ss) {
  var webhookBase = params['webhook'];
  var ticker = params['ticker'];
  var MA_WINDOW = Number(params['ma_window']);
  var SHEET_NAME = params['main_sheet'];
  var LOG_SHEET = params['log_sheet'];
  var freq = (params['freq'] || 'day').toLowerCase();

  // ===== 主Sheet自动新建+填公式 =====
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(["Date", "", "MA值", "信号"]);
    // 公式示例：=GOOGLEFINANCE("QQQ","close",DATE(2024,1,1),TODAY(),"DAILY")
    var ticker_formula = '=GOOGLEFINANCE("' + ticker + '","close",DATE(2024,1,1),TODAY(),"DAILY")';
    sheet.getRange("A1").setFormula(ticker_formula);
    Logger.log("已新建Sheet: " + SHEET_NAME + "，A1已填入历史收盘价的公式，请稍等数据自动补全。");
    return; // 第一次拉数据时直接return，等下次数据补齐后再执行
  }

  // ===== 日志表自动新建 =====
  var logSheet = ss.getSheetByName(LOG_SHEET);
  if (!logSheet) {
    logSheet = ss.insertSheet(LOG_SHEET);
    logSheet.appendRow(["日期", "收盘价", "MA窗口", "MA值", "信号", "是否提醒", "备注"]);
  }
  // 去重Set
  var logData = logSheet.getDataRange().getValues();
  var loggedSet = new Set();
  for (var m = 1; m < logData.length; m++) {
    loggedSet.add(String(logData[m][0]) + '_' + ticker);
  }

  // ===== 数据预处理 =====
  var data = sheet.getDataRange().getValues();
  // 跳过表头（如果存在"日期"等中英文表头）
  Logger.log("调试代码1: ticker = " + ticker +", 初始data.length = " + data.length);
  // 打印出数据的前几行
  Logger.log("调试代码1: 初始数据前5行 = " + JSON.stringify(data.slice(0, 5)));
  // 打印出数据的最后几行
  Logger.log("调试代码1: 初始数据后5行 = " + JSON.stringify(data.slice(-5)));

  if (data.length > 1 && typeof data[0][0] === "string" && data[0][0].match(/日期|date/i)) data = data.slice(1);
  Logger.log("调试代码2: 执行slice后 data.length = " + data.length);

  var rows = data.length;
  if (rows < MA_WINDOW + 1) {
    Logger.log("数据不足，当前行数: " + rows + "，所需: " + (MA_WINDOW + 1) + "，请等待GOOGLEFINANCE公式自动填充收盘价。");
    return;
  }

  // ===== 步骤1：脚本内动态计算MA和信号，并自动写入main_sheet C/D列 =====
  var infoList = [];
  Logger.log("调试代码3: for (var i = " + MA_WINDOW +"; i < "+ rows +"; i++)");

  for (var i = MA_WINDOW - 1; i < rows; i++) {
    // 计算MA
    var maSum = 0, valid = true;
    for (var j = i - MA_WINDOW + 1; j <= i; j++) {
      var c = Number(data[j][1]);
      if (isNaN(c)) { valid = false; break; }
      maSum += c;
    }
    if (!valid) continue;
    var maVal = maSum / MA_WINDOW;
    var close = Number(data[i][1]);
    var signal = close > maVal ? 1 : 0;
    var dateStr = data[i][0];
    var thisDate = new Date(dateStr);

    // 打印第MA_WINDOW行的数据和计算结果，用于调试
    if (i === MA_WINDOW - 1) {
        Logger.log("调试代码4: 第" + i + "行数据: 日期 = " + dateStr + ", 收盘 = " + close + ", MA值 = " + maVal + ", 信号 = " + signal);
    }

    // 写入main_sheet（可视化用，不影响推送逻辑），考虑到已经slice过表头，这里从第1行开始写入，sheet的行号从1开始, 所以实际行号应该是？
    sheet.getRange(i + 2, 3).setValue(maVal);
    sheet.getRange(i + 2, 4).setValue(signal);

    infoList.push({ idx: i, dateStr, close, maVal, signal, date: thisDate });
  }

  // 打印infoList的前5个元素，用于调试
  Logger.log("调试代码5: infoList前5个元素 = " + JSON.stringify(infoList.slice(0, 5)));
  // 打印infoList的最后5个元素，用于调试
    Logger.log("调试代码5: infoList后5个元素 = " + JSON.stringify(infoList.slice(-5)));
    // 打印infoList的长度
  Logger.log("调试代码5: infoList长度 = " + infoList.length);

  // 没有足够有效K线
  if (infoList.length < 2) return;

  // ===== 步骤2：推送信号变动 =====
  if (freq === "day") {
    // 日频：每天信号变动就推送
    var prev = infoList[infoList.length - 2];
    var curr = infoList[infoList.length - 1];
    var logKey = curr.dateStr + '_' + ticker;
    if (curr.signal !== prev.signal && !loggedSet.has(logKey)) {
      var msg = ticker + "信号变动：" + (curr.signal ? "进入牛市持有" : "空仓观望") +
        "，日期：" + curr.dateStr +
        "，收盘：" + curr.close.toFixed(2) +
        "，MA" + MA_WINDOW + "：" + curr.maVal.toFixed(2);
      var webhookUrl = webhookBase + encodeURIComponent(msg);
      UrlFetchApp.fetch(webhookUrl);
      logSheet.appendRow([
        curr.dateStr,
        curr.close,
        MA_WINDOW,
        curr.maVal,
        curr.signal,
        "变动提醒",
        (curr.signal ? "进入牛市" : "空仓")
      ]);
    }
  } else if (freq === "week" || freq === "month") {
    // 周/月频：只比周期末的信号变动
    var lastPeriods = [];
    var lastPeriodKey = null;
    for (var k = infoList.length - 1; k >= 0; k--) {
      var row = infoList[k];
      var key;
      if (freq === 'month') {
        key = row.date.getFullYear() + '-' + (row.date.getMonth() + 1);
      } else if (freq === 'week') {
        var firstDayOfWeek = new Date(row.date);
        //打印firstDayOfWeek的值，用于调试
        Logger.log("调试代码6: 计算周的第一天，原日期 = " + row.date + ", 初始化firstDayOfWeek = " + firstDayOfWeek);

        firstDayOfWeek.setDate(row.date.getDate() - row.date.getDay());
        // 打印firstDayOfWeek的值，用于调试
        Logger.log("调试代码6: 计算周的第一天，调整后的firstDayOfWeek = " + firstDayOfWeek);

        key = firstDayOfWeek.getFullYear() + '-' + (firstDayOfWeek.getMonth() + 1) + '-' + firstDayOfWeek.getDate();
      }
        // 打印当前行的key和lastPeriodKey，用于调试
        Logger.log("调试代码6: 当前行的key = " + key + ", lastPeriodKey = " + lastPeriodKey);

      if (key !== lastPeriodKey) {
        lastPeriods.unshift(row);
        lastPeriodKey = key;
        if (lastPeriods.length > 2) lastPeriods = lastPeriods.slice(-2);
      }
      if (lastPeriods.length === 2) break;
    }

    // 打印lastPeriods的长度和内容，用于调试
    Logger.log("调试代码7: lastPeriods长度 = " + lastPeriods.length + ", 内容 = " + JSON.stringify(lastPeriods));
    
    if (lastPeriods.length === 2) {
      var prev = lastPeriods[0];
      var curr = lastPeriods[1];
      var logKey = curr.dateStr + '_' + ticker;
      if (curr.signal !== prev.signal && !loggedSet.has(logKey)) {
        var msg = ticker + "信号变动：" + (curr.signal ? "进入牛市持有" : "空仓观望") +
          "，日期：" + curr.dateStr +
          "，收盘：" + curr.close.toFixed(2) +
          "，MA" + MA_WINDOW + "：" + curr.maVal.toFixed(2);
        var webhookUrl = webhookBase + encodeURIComponent(msg);
        UrlFetchApp.fetch(webhookUrl);
        logSheet.appendRow([
          curr.dateStr,
          curr.close,
          MA_WINDOW,
          curr.maVal,
          curr.signal,
          "变动提醒",
          (curr.signal ? "进入牛市" : "空仓")
        ]);
      }
    }
  }
}