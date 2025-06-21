# Google_GAS_Monitor, Use Google Sheet scripts to monitor stock trend and alert through webhook.

功能：用谷歌Sheet的脚本监控股票均价趋势并通过webhook提醒。超过均价和低于均价均提醒。可以设置均价周期及监控周期。

1，新建一个Google Sheet，配置config sheet把想监控的信息和要求放进去。模板如下。可以定义你自己想监控的

ticker         ma_window      webhook                                    main_sheet         log_sheet             freq

QQQ            120	          https://api.chuckfang.com/xxxx/QQQ_Alert	  QQQ	              QQQ_Signal_History	  day

SPY            120            https://api.chuckfang.com/xxxx/SPY_Alert    SPY               SPY_Signal_History    week

2，进入Google Sheet>Extensions>Apps Scripts，把代码拷贝进去。

3，设置为每小时执行一次。

4，Webhook换成你自己的，比如iOS上的Bark(我没试过，我现在用的是HarmonyOS 5+以上的Moew应用程序来实现的。


1. Create a new Google Sheet, configure the config sheet and put the information and requirements you want to monitor. The template is as follows

ticker ma_window webhook main_sheet log_sheet freq

QQQ 120 https://api.chuckfang.com/xxxx/QQQ_Alert QQQ QQQ_Signal_History day

SPY 120 https://api.chuckfang.com/xxxx/SPY_Alert SPY SPY_Signal_History week

2. Go to Google Sheet>Extensions>Apps Scripts and copy the code in.
3. Set it to execute once every hour.
4. Replace the webhook with your own, such as Bark on iOS (I haven't tried it. I'm using the Moew app on HarmonyOS 5+ to implement it.
The `batchCheckETF_MA_Webhook_Configurable` function is designed to automate the processing of multiple ETF (Exchange-Traded Fund) and any other tickers configurations within a Google Spreadsheet. It leverages Google Apps Script to interact with the spreadsheet and perform batch operations based on a configuration sheet.


Here's how the function works step by step:

1. **Spreadsheet and Config Sheet Access:**  
   The function first retrieves the active spreadsheet using `SpreadsheetApp.getActiveSpreadsheet()`. It then attempts to access a sheet named "Config". If this sheet does not exist, it throws an error with a message in Chinese ("找不到Config表！", meaning "Config sheet not found!").

2. **Reading Configuration Data:**  
   The function reads all the data from the "Config" sheet using `getDataRange().getValues()`. This returns a 2D array where the first row is assumed to be the headers (column names), and the subsequent rows contain configuration values for each ETF or ticker.

3. **Iterating Over Configurations:**  
   Starting from the second row (index 1), the function loops through each configuration entry. For each row, it constructs a `params` object by mapping each header (converted to lowercase) to its corresponding value in the row. This makes it easy to reference configuration parameters by name in later processing.

4. **Processing Each Ticker:**  
   For each set of parameters, the function calls `runSingleTicker_MA_Webhook_AutoSheet(params, ss)`. This function (not shown in your snippet) is likely responsible for handling the moving average calculation, sheet management, and webhook notification for a single ticker based on the provided parameters.

5. **Error Handling:**  
   If any error occurs during the processing of a ticker, the function catches the exception and logs an error message using `Logger.log`. The message includes the ticker symbol (if available) or "未知" ("unknown") and the error details.

This approach allows you to manage and automate the monitoring of multiple ETFs or stocks by simply updating the "Config" sheet, making the solution scalable and easy to maintain. The function is robust against missing configuration sheets and individual ticker errors, ensuring that one failure does not halt the entire batch process.
