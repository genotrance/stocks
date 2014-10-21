// Globals
var base_url = "https://genotrance.github.io/stocks/";
var mstar = "http://quotes.morningstar.com/fund/f?t=";
var gfin = "https://www.google.com/finance?client=ob&q=";
var yql = "https://query.yahooapis.com/v1/public/yql";
var jquery = "https://ajax.googleapis.com/ajax/libs/jquery/2.1.1/jquery.min.js";
var cookie = "https://cdnjs.cloudflare.com/ajax/libs/jquery-cookie/1.4.1/jquery.cookie.min.js";
var momentjs = "https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.8.3/moment.min.js";
var datatable = "https://cdnjs.cloudflare.com/ajax/libs/datatables/1.10.1/js/jquery.dataTables.min.js";
var datatable_css = "https://cdnjs.cloudflare.com/ajax/libs/datatables/1.10.1/css/jquery.dataTables.min.css";
var storageapi = "http://cdn.lukej.me/jquery.storage-api/1.7.2/jquery.storageapi.min.js";
var highstock = "https://cdnjs.cloudflare.com/ajax/libs/highstock/2.0.4/highstock.js";
var NAMESPACE = "com.genotrance.stocks";
var DURATION = "50 years";

var deps = [jquery, momentjs, datatable, storageapi, highstock];
var css = [datatable_css];
var stock_data = {};
var pending = 0;
var table = null;
var chart = null;
var storage = null;
var mobile = false;
var current = "latest";

if (window.matchMedia) {
	var mobile = window.matchMedia("only screen and (max-width: 760px)");
}

// HTML
var gui =
	'<div id="popup" name="popup">' +
		'Add Ticker(s): <input type="text" name="tick" id="tick"></input> ' +
		'<a href="#" onclick="clear_all();return false;">Clear</a> ' +
		'<a href="#" onclick="delete_tickers();return false;">Delete</a> ' +
		'<a href="#" onclick="show_table(\'latest\');return false;">Price</a> ' + 
		'<a href="#" onclick="show_table(\'history\');return false;">Growth</a> ' + 
		'<a href="#" onclick="show_table(\'dividend\');return false;">Dividend</a> ' + 
		'<div id="message" name="message"></div><br/><br/>' +
		'<div id="title"></div>' +
		'<table id="table"></table>' + 
		'<div id="charts" name="charts"></div>' +
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
	
	setTimeout(function() { refresh_stocks(); }, 5000);
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
		"-moz-opacity": 1
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
		"text-decoration": "underline"
	});
	
	$("#title").css({
		"text-align": "center"
	});

	setup_table();
	setup_charts();
	
	show_table("latest");
}

//////
// Table

// Setup Datatables
function setup_table() {
	table = $("#table").DataTable({
		paging: false,
		autoWidth: true,
		searching: false,
		dom: "t",
		
		columns: [
			{title: "Ticker", sClass: "center", sType: "html"},
			{title: "Name", sClass: "center"},
			
			// Latest - 2-6
			{title: "$Last", sClass: "center"},
			{title: "$Max", sClass: "center"},
			{title: "$Min", sClass: "center"},
			{title: "$Range", sClass: "center"},
			{title: "%Potential", sClass: "center"},

			// History - 7-14
			{title: "%Total", sClass: "center"},
			{title: "%Day", sClass: "center"},
			{title: "%Week", sClass: "center"},
			{title: "%Month", sClass: "center"},
			{title: "%6 Month", sClass: "center"},
			{title: "%YTD", sClass: "center"},
			{title: "%Year", sClass: "center"},
			{title: "%Year", sClass: "center"},

			// Dividend - 15-21
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
		// Latest
		'<a href="' + gfin + tick + '" target=_blank onclick="setTimeout(function() { table.$(\'tr.selected\').removeClass(\'selected\'); }, 0);">' + tick + '</a>', value.description,
		"$" + round(value[type].last) + "<br/>" + value[type].lastdate, 
		"$" + round(value[type].max) + "<br/>" + value[type].maxdate, 
		"$" + round(value[type].min) + "<br/>" + value[type].mindate,
		"$" + round(value[type].range),
		round(value[type].potential) + "%",
	
		// History
		round(value[type].totalgrowth) + "%<br/" + value[type].growth.date[value[type].growth.date.length-1] + "+",
		round(value[type].daygrowth) + "%", round(value[type].weekgrowth) + "%",
		round(value[type].monthgrowth) + "%", round(value[type].sixmonthgrowth) + "%",
		value[type].growth.value.length>0?round(value[type].growth.value[0]) + "%<br/>" + value[type].growth.date[0]:"",
		value[type].growth.value.length>1?round(value[type].growth.value[1]) + "%<br/>" + value[type].growth.date[1]:"",
		value[type].growth.value.length>2?round(value[type].growth.value[2]) + "%<br/>" + value[type].growth.date[2]:"",

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
			round(value[type].historical.avgpercent) + "%"
		]);
	} else {
		$.merge(data, ["", "", "", "", "", "", ""]);
	}
	
	table.row.add(data);
	table.draw();
}

// Get selected ticks
function get_selected_ticks() {
	var ticks = [];
	var data = table.rows(".selected").data();
	for (var i = 0; i < data.length; i++) {
		ticks.push(data[i][0].replace(/<.*?>/g, ""));
	}
	
	return ticks;
}

// Find and act on table row
function do_in_table(func, tick) {
	var ticks = table.column(0).data();

	for (var i = ticks.length-1; i >= 0; i--) {
		if (tick == null || ticks[i].replace(/<.*?>/g, "") == tick) {
			func(table.row(table.rows()[0][i]));
		}
	}
}

// Remove tick from each table
function remove_from_table(tick) {
	do_in_table(function(row) { row.remove(); }, tick);
	
	table.draw();
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

		tooltip: {
			pointFormat: '<span style="color:{series.color}">\u25CF</span> {series.name}: <b>{point.y:.2f}</b><br/>'
		}
	});
	
	chart = $("#charts").highcharts();
}

// Add to chart
function add_to_chart(tick) {
	remove_from_chart(tick);
	
	var chartdata = null;
	if (current == "latest") {
		chartdata = stock_data[tick].historical.chartprice;
	} else if (current == "history") {
		chartdata = stock_data[tick].historical.chartgrowth;
	} else if (current == "dividend") {
		chartdata = stock_data[tick].dividend.chartdividend;
	}
	
	chart.addSeries({name: tick, data: chartdata});
}

// Find and act on chart series
function do_in_chart(func, tick) {
	for (var i = chart.series.length-1; i >= 0; i--) {
		if (tick == null || chart.series[i].name == tick) {
			func(chart.series[i]);
		}
	}
}

// Remove from chart
function remove_from_chart(tick) {
	do_in_chart(function(series) { series.remove(); }, tick);
}

// Show series in chart
function show_in_chart(tick) {
	do_in_chart(function(series) { series.show(); }, tick);
}

// Hide series in chart
function hide_in_chart(tick) {
	do_in_chart(function(series) { series.hide(); }, tick);
}

//////
// Events

// Bind events
function bind_events() {
	$(window).bind('resize', resize);
	$(document).bind('resize', resize);
	$("#tick").bind("change", add_ticker);
	
	table.on("click", 'tr', function() {
		var tick = $('td', this).eq(0).text();

		if ($(this).hasClass("selected")) {
			$(this).removeClass("selected");
			remove_from_chart(tick);
		} else {
			$(this).addClass("selected");
			add_to_chart(tick);
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
				load_stock(tick, DURATION);
			}
		}
	});
}

// Delete ticker
function delete_tickers() {
	var ticks = get_selected_ticks();

	for (var i = 0; i < ticks.length; i++) {
		delete stock_data[ticks[i]];
		storage.remove("stock_data." + ticks[i]);
		
		remove_from_table(ticks[i]);
		remove_from_chart(ticks[i]);
	}
}

// Clear all tickers
function clear_all() {
	table.clear().draw();
	chart.destroy();
	setup_charts();
	stock_data = {};
	storage.remove("stock_data");
}

// Show requested table
function show_table(cols) {
	current = cols;
	
	var unhide = [];
	if (cols == "latest") {
		unhide = [2, 3, 4, 5, 6];
		$("#title").html("Price History");
	} else if (cols == "history") {
		unhide = [7, 8, 9, 10, 11, 12, 13, 14];
		$("#title").html("Growth History");
	} else if (cols == "dividend") {
		unhide = [15, 16, 17, 18, 19, 20, 21];
		$("#title").html("Dividend History");
	}
	
	for (i = 2; i < table.columns()[0].length; i++) {
		if ($.inArray(i, unhide) != -1) {
			table.column(i).visible(true);
		} else {
			table.column(i).visible(false);
		}
	}
	
	var ticks = get_selected_ticks();
	for (var i = 0; i < ticks.length; i++) {
		remove_from_chart(ticks[i]);
		add_to_chart(ticks[i]);
	}
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
		var yeargrowth = 0;
		var daygrowth = 0;
		var weekgrowth = 0;
		var monthgrowth = 0;
		var sixmonthgrowth = 0;
		var totalgrowth = 0;
		var years = [];
		var yearlygrowth = [];
		var chartprice = [];
		var chartgrowth = [];
		for (var i = data.date.length-1; i >= 1; i--) {
			newyear = data.date[i].split("-")[0];
			if (year != newyear) {
				if (yeargrowth != 0) {
					years.push(year);
					yearlygrowth.push(yeargrowth * 100);
					
					yeargrowth = 0;
				}
				
				year = newyear;
			}
			
			delta = (data.value[i-1] - data.value[i]) / data.value[i];
			yeargrowth += delta;
			totalgrowth += delta;

			chartprice.push([moment(data.date[i]).valueOf(), data.value[i]]);
			chartgrowth.push([moment(data.date[i]).valueOf(), totalgrowth * 100]);
			
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
		
		chartprice.push([moment(data.date[i]).valueOf(), data.value[i]]);
		
		if (yeargrowth != 0) {
			years.push(year);
			yearlygrowth.push(yeargrowth * 100);
		}
		
		years.reverse();
		yearlygrowth.reverse();
		stock_data[tick][type]["growth"] = {
			date: years,
			value: yearlygrowth,
		};
		
		stock_data[tick][type]["daygrowth"] = daygrowth * 100;
		stock_data[tick][type]["weekgrowth"] = weekgrowth * 100;
		stock_data[tick][type]["monthgrowth"] = monthgrowth * 100;
		stock_data[tick][type]["sixmonthgrowth"] = sixmonthgrowth * 100;
		stock_data[tick][type]["totalgrowth"] = yearlygrowth.reduce(function(a, b) { return a+b; });
		stock_data[tick][type]["chartprice"] = chartprice;
		stock_data[tick][type]["chartgrowth"] = chartgrowth;
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
				var chartdividend = [];
				
				var percent = [];
				for (var i = 0; i < ddate.length; i++) {
					var idx = $.inArray(ddate[i], hdate);
					if (idx != -1) {
						percent.push(damount[i] / hprice[idx] * 100);
						chartdividend.push([moment(ddate[i]).valueOf(), percent[i]]);
					}
				}
				
				stock_data[tick][type].data["percent"] = percent;
				stock_data[tick][type]["chartdividend"] = chartdividend.reverse();
				
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
		}
	}

	$("#message").hide(500);
}