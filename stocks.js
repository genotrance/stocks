// Globals
var base_url = "https://genotrance.github.io/stocks/";
var mstar = "http://quotes.morningstar.com/fund/f?t=";
var yql = "https://query.yahooapis.com/v1/public/yql";
var jquery = "https://ajax.googleapis.com/ajax/libs/jquery/2.1.1/jquery.min.js";
var aes = "https://crypto-js.googlecode.com/svn/tags/3.1.2/build/rollups/aes.js";
var sha1 = "https://crypto-js.googlecode.com/svn/tags/3.1.2/build/rollups/sha1.js";
var cookie = "https://cdnjs.cloudflare.com/ajax/libs/jquery-cookie/1.4.1/jquery.cookie.min.js";
var momentjs = "http://momentjs.com/downloads/moment.min.js";
var datatable = "https://cdn.datatables.net/1.10.2/js/jquery.dataTables.min.js";
var datatable_css = "https://cdn.datatables.net/1.10.2/css/jquery.dataTables.css";
var storageapi = "http://cdn.lukej.me/jquery.storage-api/1.7.2/jquery.storageapi.min.js";
var highstock = "http://code.highcharts.com/stock/highstock.js";
var NAMESPACE = "com.genotrance.stocks";

var dirty = false;
var key = "";
var hash = "";
var rev = "";
var deps = [jquery, aes, sha1, cookie, momentjs, datatable, storageapi, highstock];
var css = [datatable_css];
var stock_data = {};
var pending = 0;
var table = null;
var chart = null;
var storage = null;
var mobile = false;

if (window.matchMedia) {
	var mobile = window.matchMedia("only screen and (max-width: 760px)");
}

// HTML
var gui =
	'<div id="popup" name="popup">' +
		'<div id="stocks" name="stocks"><table id="table"></table></div>' +
		'<div id="charts" name="charts"></div>' +
		'Add Ticker(s): <input type="text" name="tick" id="tick"></input> ' +
		'<a href="#" onclick="clear_all();return false;">Clear</a> ' +
		'<a href="#" onclick="delete_ticker();return false;">Delete</a> ' +
		'<div id="message" name="message"></div>' +
	'</div>';

// Load dependencies
load_scripts();

// Load javascript
function load_scripts()
{
    var head = document.getElementsByTagName('head')[0];
    var script = document.createElement('script');
	var callback = load_scripts;
 
	script.type = 'text/javascript';
    script.src = deps.shift();
	
	if (deps.length == 0) {
		callback = load_css;
	}

    script.onload = callback;

    head.appendChild(script);
}

// Load CSS
function load_css()
{
    var head = document.getElementsByTagName('head')[0];
    var link = document.createElement('link');
	var callback = load_css;
 
	link.rel = "stylesheet";
	link.type = "text/css";
    link.href = css.shift();
	
	if (css.length == 0) {
		callback = initialize;
	}

    link.onload = callback;

    head.appendChild(link);
}

// Initialization routine
function initialize() {
	jQuery.support.cors = true;

	setup_gui();
	bind_events();
	
	setup_localstorage();
	refresh_stocks();
}

// Wait for pending transactions
function wait_pending(callback) {
	if (pending == 0) {
		callback();
	} else {
		setTimeout(function() { wait_pending(callback); }, 1000);
	}
}

//////
// GUI

// Add elements
function setup_gui() {
	$("head").append('<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0">');
	$("head").append('<style type="text/css">.center { text-align: center; font-size: 10px; }</style>');
	
	$("body").append($(gui));
	
	$("#popup").css({
		"font-family": "Arial",
		"font-size": "11",
		"position": "absolute",
		"z-index": "2147483638",
		"top": "10px",
		"left": "10px",
		"width": $(window).width()-30,
		"height": $(window).height()-30,
		"border": "1px solid black",
		"padding": "5px",
		"text-align": "left",
		"background-color": "white",
		"opacity": 1,
		"filter": "alpha(opacity=100)",
		"-moz-opacity": 1, 
	});
	
	$("#message").css({
		"display": "inline",
		"font-family": "Arial",
		"font-size": "11",
		"color": "white",
		"background-color": "red"
	});
	
	$("#key").css({
		"font-family": "Arial",
		"font-size": "10",
		"width": "30%",
		"padding": "0px",
		"margin": "5px"
	});
	
	$(".a").css({
		"font-family": "Arial",
		"font-size": "10",
		"color": "blue",
		"text-decoration": "underline",
	});

	setup_table();
	setup_charts();
}

//////
// Table

// Setup Datatables
function setup_table() {
	table = $("#table").DataTable({
		paging: false,
		autoWidth: true,
		
		columns: [
			{title: "Ticker", sClass: "center", sType: "html"},
			{title: "Name", sClass: "center"},
			{title: "%Total", sClass: "center"},
			{title: "%Day", sClass: "center"},
			{title: "%Week", sClass: "center"},
			{title: "%Month", sClass: "center"},
			{title: "%6 Month", sClass: "center"},
			{title: "%YTD", sClass: "center"},
			{title: "%Year", sClass: "center"},
			{title: "%Year", sClass: "center"},
			{title: "$Last", sClass: "center"},
			{title: "$Max", sClass: "center"},
			{title: "$Min", sClass: "center"},
			{title: "$Range", sClass: "center"},
			{title: "%Potential", sClass: "center"},
			{title: "%YTD", sClass: "center"},
			{title: "%Year", sClass: "center"},
			{title: "%Year", sClass: "center"},
			{title: "%Max", sClass: "center"},
			{title: "%Min", sClass: "center"},
			{title: "%Range", sClass: "center"},
			{title: "%Average", sClass: "center"},
		]
	});
}

// Add specified tick to table
function add_to_table(tick) {	
	var value = stock_data[tick];
	
	remove_from_table(tick);
	
	var type = "historical";
	var data = [
		'<a href="' + mstar + tick + '" target=_blank onclick="setTimeout(function() { table.$(\'tr.selected\').removeClass(\'selected\'); }, 0);">' + tick + '</a>', value.description,
		round(value[type].totalgrowth) + "%<br/" + value[type].growth.date[value[type].growth.date.length-1] + "+",
		round(value[type].daygrowth) + "%", round(value[type].weekgrowth) + "%",
		round(value[type].monthgrowth) + "%", round(value[type].sixmonthgrowth) + "%",
		value[type].growth.value.length>0?round(value[type].growth.value[0]) + "%<br/>" + value[type].growth.date[0]:"",
		value[type].growth.value.length>1?round(value[type].growth.value[1]) + "%<br/>" + value[type].growth.date[1]:"",
		value[type].growth.value.length>2?round(value[type].growth.value[2]) + "%<br/>" + value[type].growth.date[2]:"",
		"$" + round(value[type].last) + "<br/>" + value[type].lastdate, 
		"$" + round(value[type].max) + "<br/>" + value[type].maxdate, 
		"$" + round(value[type].min) + "<br/>" + value[type].mindate,
		"$" + round(value[type].range),
		round(value[type].potential) + "%"
	];
	
	type = "dividend";
	if (value.hasOwnProperty(type) == true) {
		$.merge(data, [
			round(value[type].historical.lastpercent) + "%<br/>" + value[type].historical.lastdate,
			value[type].historical.percent.length>1?round(value[type].historical.percent[1]) + "%<br/>" + value[type].historical.date[1]:"", 
			value[type].historical.percent.length>2?round(value[type].historical.percent[2]) + "%<br/>" + value[type].historical.date[2]:"", 
			round(value[type].historical.maxpercent) + "%<br/>" + value[type].historical.maxdate, 
			round(value[type].historical.minpercent) + "%<br/>" + value[type].historical.mindate, 
			round(value[type].historical.rangepercent) + "%",
			round(value[type].historical.avgpercent) + "%",
		]);
	} else {
		$.merge(data, ["", "", "", "", "", "", "", "", "", ""]);
	}
	
	table.row.add(data);
	table.draw();
}

// Remove tick from table
function remove_from_table(tick) {
	var ticks = table.column(0).data();

	for (var i = ticks.length-1; i >= 0; i--) {
		if (ticks[i].replace(/<.*?>/g, "") == tick) {
			table.row(table.rows()[0][i]).remove();
		}
	}
}

// Round
function round(val) {
	return Math.round(val * 100) / 100;
}

//////
// Chart

// Setup Highstocks
function setup_charts() {
	$("#charts").highcharts("StockChart", {
		chart: {
			type: "line"
		},
		title: {
			text: "Growth of $10k"
		},
		legend: {
			enabled: true
		}
	});
	
	chart = $("#charts").highcharts();
}

// Add to chart
function add_to_chart(tick) {
	remove_from_chart(tick);
	
	var data = stock_data[tick].historical.data;
	var out = [];
	var numshares = 10000 / data.value[data.value.length-1]
	for (var i = data.date.length-1; i >= 0; i--) {
		out.push([moment(data.date[i]).valueOf(), round(numshares * data.value[i])]);
	}

	chart.addSeries({name: tick, data: out});
}

// Remove from chart
function remove_from_chart(tick) {
	for (var i = chart.series.length-1; i >= 0; i--) {
		if (chart.series[i].name == tick) {
			chart.series[i].remove();
		}
	}
}

//////
// Events

// Bind events
function bind_events() {
	$(window).bind('resize', resize);
	$(document).bind('resize', resize);
	$("#tick").bind("change", add_ticker);
	
	table.on("click", 'tr', function() {
        if ($(this).hasClass("selected")) {
            $(this).removeClass("selected");
        } else {
			table.$("tr.selected").removeClass("selected");
            $(this).addClass("selected");
        }
    });
}

// Resize window
function resize() {
	$("#popup").css({
		"width": $(window).width()-30,
		"height": $(window).height()-30,
	});
}

// Add ticker
function add_ticker() {
	var seen = {};
	var val = $("#tick").val().toUpperCase().trim();
	$("#tick").val("");
	$.each(val.split(" "), function(key, tick) {
		if (seen.hasOwnProperty(tick) == false) {
			seen[tick] = true;
			tick = tick.trim();
			if (tick != "" && stock_data.hasOwnProperty(tick) == false) {
				load_stock(tick, "3 years");
			}
		}
	});
}

// Delete ticker
function delete_ticker() {
	var data = table.row(".selected").data();
	var tick = data[0].replace(/<.*?>/g, "");
	
	delete stock_data[tick];
	storage.remove("stock_data." + tick);
	
	table.row(".selected").remove().draw(false);
	remove_from_chart(tick);
}

// Clear all tickers
function clear_all() {
	table.clear().draw();
	chart.destroy();
	setup_charts();
	stock_data = {};
	storage.remove("stock_data");
}

//////
// Local storage

// Setup localstorage
function setup_localstorage() {
	var ns = $.initNamespaceStorage(NAMESPACE);
	storage = ns.localStorage;
	
	if (storage.isSet("stock_data") == true) {
		stock_data = storage.get("stock_data");
		$.each(stock_data, function(tick, value) {
			analyze_stock(tick, "historical");
			analyze_stock(tick, "dividend");
			analyze_dividend_percentage(tick);
		});
	} else {
		storage.set("stock_data", {});
	}
}

//////
// YQL

// Load data from YQL
function load_yql(query, callback) {
	console.log("Running " + query);
	pending += 1;
	$.getJSON(
		yql + "?format=json&env=store%3A%2F%2Fdatatables.org%2Falltableswithkeys&callback=&q=" + query,
		callback
	);
}

// Get all stock data
function load_stock(tick, duration) {
	$('#message').html("Loading...").show();

	load_stock_info(tick, save_stock_data);
	load_historical_data(tick, duration, save_stock_data);
	load_dividend_history(tick, duration, save_stock_data);
	
	wait_pending(function() { analyze_dividend_percentage(tick); });
}

// Refresh all stock data
function refresh_stocks() {
	$.each(stock_data, function(tick, value) {
		var duration = moment().diff(moment(stock_data[tick].historical.data.date[0]), "days") - 1;
		if (duration >= 0) {
			load_stock(tick, duration + " days");
		}
	});
}

// Get stock info
function load_stock_info(tick, callback) {
	var query = "select * from yahoo.finance.quote where symbol='" + tick + "'";
	
	load_yql(query, function(data) {
		pending -= 1;
		callback(data);
	});
}

// Get historical data
function load_historical_data(tick, from, callback) {
	var query = "select * from yahoo.finance.historicaldata where symbol='" + tick + "'";

	load_with_dates(query, from, callback);
}

// Get dividend history
function load_dividend_history(tick, from, callback) {
	var query = "select * from yahoo.finance.dividendhistory where symbol='" + tick + "'";

	load_with_dates(query, from, callback);
}

// Convert from 6 months, 2 years, etc. to a day subtracted from today
function convert_from(from) {
	var split_from = from.split(" ");
	return moment().subtract(split_from[0], split_from[1]);
}	

// Get with dates
function load_with_dates(query, from, callback) {
	from = convert_from(from);
	var to = moment();
	
	load_with_dates_helper(query, from, to, callback, {});
}

// Get with dates helper
function load_with_dates_helper(query, from, to, callback, alldata) {
	if (to - from > 31535988159 && query.indexOf("historicaldata") != -1) {
		var year = to.clone().subtract(365, "days");
		var query_date = query + " and startDate='" + year.clone().add(1, "days").format("YYYY-MM-DD") + "' and endDate='" + to.format("YYYY-MM-DD") + "'";
		load_yql(query_date, load_with_dates_recurse(query, from, year, callback, alldata, false));
	} else {
		var query_date = query + " and startDate='" + from.format("YYYY-MM-DD") + "' and endDate='" + to.format("YYYY-MM-DD") + "'";
		load_yql(query_date, load_with_dates_recurse(query, from, to, callback, alldata, true));
	}
}

// Get with dates recurse
var load_with_dates_recurse = function(query, from, to, callback, alldata, stop) {
	return function(data) {
		pending -= 1;
		if ($.isEmptyObject(alldata)) {
			alldata = $.extend(true, {}, data);
		} else {
			if (data != null && data.query != null && data.query.results != null && data.query.results.quote != null) {
				$.merge(alldata.query.results.quote, data.query.results.quote);
				alldata.query.count += data.query.count;
			} else {
				callback(alldata);
				return;
			}
		}
		
		if (data.query.count != 0 && stop == false) {
			load_with_dates_helper(query, from, to, callback, alldata);
		} else {
			callback(alldata);
		}
	}
}

//////
// Stock data

// Save stock data to global
function save_stock_data(data) {
	if (data == null || data.query == null || data.query.results == null || data.query.results.quote == null) {
		return;
	}
	
	var tick = "";
	var quote = [];
	if (data.query.results.quote.hasOwnProperty("Symbol")) {
		tick = data.query.results.quote.Symbol;
		quote = [data.query.results.quote];
	} else {
		tick = data.query.results.quote[0].Symbol;
		quote = data.query.results.quote;
	}

	tick = tick.replace("%5e", "^");
	
	if (stock_data.hasOwnProperty(tick) == false) {
		stock_data[tick] = {};
		storage.set("stock_data." + tick, {});
	}
	
	if (quote[0].hasOwnProperty("Name")) {
		stock_data[tick]["description"] = quote[0].Name;
		storage.set("stock_data." + tick + ".description", quote[0].Name);
	} else {
		var type = "";
		var key = "";
		if (quote[0].hasOwnProperty("Adj_Close")) {
			type = "historical";
			key = "Adj_Close";
		} else if (quote[0].hasOwnProperty("Dividends")) {
			type = "dividend";
			key = "Dividends";
		}
		
		if (stock_data[tick].hasOwnProperty(type) == false) {
			stock_data[tick][type] = {};
			storage.set("stock_data." + tick + "." + type, {});
			stock_data[tick][type]["data"] = convert_to_array(quote, key);
		} else {
			var arr = convert_to_array(quote, key);
			$.merge(arr.date, stock_data[tick][type].data.date);
			$.merge(arr.value, stock_data[tick][type].data.value);
			stock_data[tick][type].data = arr;
		}
		storage.set("stock_data." + tick + "." + type + ".data", stock_data[tick][type]["data"]);
		analyze_stock(tick, type);
	}
}

// Convert to array
function convert_to_array(data, field) {
	var date = $.map(data, function(v) { return v["Date"]; }); 
	var value = $.map(data, function(v) { return parseFloat(v[field]); });
	
	return {date: date, value: value};
}

// Analyze stock
function analyze_stock(tick, type) {
	if (stock_data.hasOwnProperty(tick) == false) {
		return;
	}
	
	if (stock_data[tick].hasOwnProperty(type) == false) {
		return;
	}
	
	var data = stock_data[tick][type].data;
	stock_data[tick][type]["last"] = data.value[0];
	stock_data[tick][type]["lastdate"] = data.date[0];
	stock_data[tick][type]["max"] = Math.max.apply(Math, data.value);
	stock_data[tick][type]["maxdate"] = data.date[$.inArray(stock_data[tick][type]["max"], data.value)];
	stock_data[tick][type]["min"] = Math.min.apply(Math, data.value);
	stock_data[tick][type]["mindate"] = data.date[$.inArray(stock_data[tick][type]["min"], data.value)];
	stock_data[tick][type]["range"] = stock_data[tick][type]["max"] - stock_data[tick][type]["min"];
	stock_data[tick][type]["avg"] = data.value.reduce(function(p,c,i){return p+(c-p)/(i+1)},0);
	stock_data[tick][type]["potential"] = (stock_data[tick][type]["max"] - stock_data[tick][type]["last"]) / stock_data[tick][type]["last"] * 100;

	if (type == "historical") {
		var last = moment(data.date[0]);
		var year = "";
		var newyear = "";
		var delta = 0;
		var totalgrowth = 0;
		var daygrowth = 0;
		var weekgrowth = 0;
		var monthgrowth = 0;
		var sixmonthgrowth = 0;
		var years = [];
		var growth = [];
		for (var i = 0; i < data.date.length-1; i++) {
			newyear = data.date[i].split("-")[0];
			if (year != newyear) {
				if (totalgrowth != 0) {
					years.push(year);
					growth.push(totalgrowth * 100);
					
					totalgrowth = 0;
				}
				
				year = newyear;
			}
			
			delta = (data.value[i] - data.value[i+1]) / data.value[i+1];
			totalgrowth += delta;
			
			if (last.diff(moment(data.date[i]), "days") == 1) {
				daygrowth += delta;
			}
			
			if (last.diff(moment(data.date[i]), "weeks") == 0) {
				weekgrowth += delta;
			}
			
			var mdiff = last.diff(moment(data.date[i]), "months");
			if (mdiff == 0) {
				monthgrowth += delta;
			}
			
			if (mdiff < 6) {
				sixmonthgrowth += delta;
			}
		}
		
		if (totalgrowth != 0) {
			years.push(year);
			growth.push(totalgrowth * 100);
		}
		
		stock_data[tick][type]["growth"] = {
			date: years,
			value: growth,
		};
		
		stock_data[tick][type]["daygrowth"] = daygrowth * 100;
		stock_data[tick][type]["weekgrowth"] = weekgrowth * 100;
		stock_data[tick][type]["monthgrowth"] = monthgrowth * 100;
		stock_data[tick][type]["sixmonthgrowth"] = sixmonthgrowth * 100;
		stock_data[tick][type]["totalgrowth"] = growth.reduce(function(a, b) { return a+b; });
	}
}

// Analyze dividend percentage
function analyze_dividend_percentage(tick) {
	var type = "dividend";
	
	if (stock_data.hasOwnProperty(tick)) {
		var value = stock_data[tick];
		
		if (value.hasOwnProperty("historical") == true) {
			if (value.hasOwnProperty("dividend") == true && value[type].hasOwnProperty("data") == true && value[type].data.hasOwnProperty("percent") == false) {
				var ddate = value[type].data.date;
				var damount = value[type].data.value;
				var hdate = value["historical"].data.date;
				var hprice = value["historical"].data.value;
				
				var percent = [];
				for (var i = 0; i < ddate.length; i++) {
					var idx = $.inArray(ddate[i], hdate);
					if (idx != -1) {
						percent.push(damount[i] / hprice[idx] * 100);
					}
				}
				
				stock_data[tick][type].data["percent"] = percent;
				
				stock_data[tick][type]["lastpercent"] = percent[0];
				stock_data[tick][type]["maxpercent"] = Math.max.apply(Math, percent);
				stock_data[tick][type]["maxpercentdate"] = ddate[$.inArray(stock_data[tick][type]["maxpercent"], percent)];
				stock_data[tick][type]["maxpercent"] = stock_data[tick][type]["maxpercent"];
				stock_data[tick][type]["minpercent"] = Math.min.apply(Math, percent);
				stock_data[tick][type]["minpercentdate"] = ddate[$.inArray(stock_data[tick][type]["minpercent"], percent)];
				stock_data[tick][type]["minpercent"] = stock_data[tick][type]["minpercent"];
				stock_data[tick][type]["rangepercent"] = stock_data[tick][type]["maxpercent"] - stock_data[tick][type]["minpercent"];
				stock_data[tick][type]["avgpercent"] = percent.reduce(function(p,c,i){return p+(c-p)/(i+1)},0);
				
				var year = "";
				var newyear = "";
				var totaldiv = 0;
				var totaldivpercent = 0;
				var years = [];
				var totaldivs = [];
				var totaldivspercent = [];
				for (var i = 0; i < ddate.length; i++) {
					newyear = ddate[i].split("-")[0];
					if (year != newyear) {
						if (totaldiv != 0) {
							years.push(year);
							totaldivs.push(totaldiv);
							totaldivspercent.push(totaldivpercent);
							
							totaldiv = 0;
							totaldivpercent = 0;
						}
						
						year = newyear;
					}
					
					totaldiv += damount[i];
					totaldivpercent += percent[i];
				}
				
				if (totaldiv != 0) {
					years.push(year);
					totaldivs.push(totaldiv);
					totaldivspercent.push(totaldivpercent);
				}
				
				stock_data[tick][type]["historical"] = {
					date: years,
					value: totaldivs,
					percent: totaldivspercent
				};
				
				var data = stock_data[tick][type]["historical"];
				stock_data[tick][type]["historical"]["last"] = data.value[0];
				stock_data[tick][type]["historical"]["lastpercent"] = data.percent[0];
				stock_data[tick][type]["historical"]["lastdate"] = data.date[0];
				stock_data[tick][type]["historical"]["max"] = Math.max.apply(Math, data.value);
				stock_data[tick][type]["historical"]["maxpercent"] = Math.max.apply(Math, data.percent);
				stock_data[tick][type]["historical"]["maxdate"] = data.date[$.inArray(stock_data[tick][type]["historical"]["maxpercent"], data.percent)];
				stock_data[tick][type]["historical"]["min"] = Math.min.apply(Math, data.value);
				stock_data[tick][type]["historical"]["minpercent"] = Math.min.apply(Math, data.percent.slice(1));
				stock_data[tick][type]["historical"]["mindate"] = data.date[$.inArray(stock_data[tick][type]["historical"]["minpercent"], data.percent)];
				stock_data[tick][type]["historical"]["range"] = stock_data[tick][type]["historical"]["max"] - stock_data[tick][type]["historical"]["min"];
				stock_data[tick][type]["historical"]["rangepercent"] = stock_data[tick][type]["historical"]["maxpercent"] - stock_data[tick][type]["historical"]["minpercent"];
				stock_data[tick][type]["historical"]["avg"] = data.value.reduce(function(p,c,i){return p+(c-p)/(i+1)},0);
				stock_data[tick][type]["historical"]["avgpercent"] = data.percent.slice(1).reduce(function(p,c,i){return p+(c-p)/(i+1)},0);
			}
			add_to_table(tick);
			add_to_chart(tick);
		}
	}

	$("#message").hide(500);
}