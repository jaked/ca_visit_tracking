var table;
var fileData;  //  globalish variable holding the parsed file data rows  HACK
var stateOrCountySel;
var ageGroupSel;
var essentialSel;
var states = [];
var counties = [];
var locationTypeSel;
var locationTypes = [];
var selectedCounties;
var selectedVenues;
var selectedState;

const urlParams = new URLSearchParams(window.location.search);
var datafilename = urlParams.get('datafilename');
var maxLocationTypeLinesParam = urlParams.get('maxlocationtypes')

const MAX_LOCATIONTYPE_LINES_DEFAULT = 10;

var maxLocationTypes = MAX_LOCATIONTYPE_LINES_DEFAULT;

const ALL = "ALL";
const NONE = "NONE";


if(maxLocationTypeLinesParam) {
  maxLocationTypes = Math.max(maxLocationTypeLinesParam,1);
}

const AGE_GROUP_LABELS = {
  all: "all ages",
  under65: "under 65 years old",
  over65: "over 65 years old",
}

const AGE_GROUP_FIELDS = {
  all: "visit_index",
  under65: "visit_index_under65",
  over65: "visit_index_over65",
}

function chartTitle(stateOrCounty) {

  var result = "";
  if (stateOrCountySel.value) {
    result += stateOrCountySel.value + ", ";
    if (stateOrCounty === 'county')
      result += selectedState + ", ";
  }
  if (locationTypeSel.value) {
    result += locationTypeSel.value + ", ";
  }
  if (ageGroupSel.value) {
    result += AGE_GROUP_LABELS[ageGroupSel.value] + ", ";
  }
  if (!locationTypeSel.value) {
    switch (essentialSel.value) {
      case "all":
        result += "essential+non, ";
        break;
      case "essential":
        result += "essential only, ";
        break;
      case "nonessential":
        result += "non-essential only, ";
        break;
    }
  }
  result += "Visits %";
  return result;
}

function datenum(datestring) {
  var year = parseInt(datestring.slice(0, 4));
  var month = parseInt(datestring.slice(5, 7));
  var day = parseInt(datestring.slice(8, 10));
  return year * 10000 + month * 100 + day;
}

// for a given state/county, which locationtype lines should we show in the chart?
// let's show the top N locationtype that people were visiting on the most recent date,
// and if there aren't enough on the most recent date, then use the previous date as well,
// and so on until we have N locationtypes.
//
function locationTypesToChart(fileData) {

  // sort by rank ascending,
  var sortStepOne = _.sortBy(fileData, function(fileDataRow) { return fileDataRow.rank });

  // then sort by date descending,
  var sortStepTwo = _.sortBy(sortStepOne, function(fileDataRow) { return -1 * fileDataRow.datenum; });

  // then remove duplicates.
  var locationTypes = _.uniq(_.pluck(sortStepTwo, 'location_type'));

  // the top N locationtypes are then from the latest date, going back to previous dates if necessary.
  return locationTypes.slice(0, maxLocationTypes);
}

function fileDataToHighcharts(fileDataToPlot) {
  return _.map(fileDataToPlot, function(fileDataRow) {
    var date = fileDataRow.date;
    var year = date.slice(0, 4);
    var month = date.slice(5, 7);
    var day = date.slice(8, 10);
    return [Date.UTC(year, month-1, day), parseInt(fileDataRow[AGE_GROUP_FIELDS[ageGroupSel.value]])];
  });
}

function styleSeries(series) {
  series.lineWidth = 1;
  series.marker = {radius: 5};
  return series;
}

function seriesToPlot(stateOrCounty) {
  var plotData = _.filter(fileData,
    function (datapoint) {
      var datapointEssential = datapoint.essential;
      switch (essentialSel.value) {
        case "all":
          return true;
        case "essential":
          return datapointEssential;
        case "nonessential":
          return (datapointEssential == false);
      }
    }
  );
  if (stateOrCountySel.value && !locationTypeSel.value) {
    var fileDataToPlot = _.where(plotData, { [stateOrCounty]: stateOrCountySel.value });
    var lts = locationTypesToChart(fileDataToPlot);
    var results = _.map(lts, function(locationType) {
      return styleSeries({
        name: locationType,
        data: fileDataToHighcharts(_.where(fileDataToPlot, { location_type: locationType }))
      });
    });
    results = _.filter(results, function(series) {
      return series.data.length > 0;
    });

    results.unshift({ name: 'Show/Hide All', visible: false });
    return results;
  }
  if (!stateOrCountySel.value && locationTypeSel.value) {
    var fileDataToPlot = _.where(plotData, { location_type: locationTypeSel.value });
    var results = _.map(statesOrCounties, function(stateOrCountyValue) {
      return styleSeries({
        name: stateOrCountyValue,
        data: fileDataToHighcharts(_.where(fileDataToPlot, { [stateOrCounty]: stateOrCountyValue }))
      });
    });
    results = _.filter(results, function(series) {
      return series.data.length > 0;
    });

    results.unshift({ name: 'Show/Hide All', visible: false });
    return results;
  }
  if (stateOrCountySel.value && locationTypeSel.value) {
    var fileDataToPlot = _.where(plotData, { location_type: locationTypeSel.value, [stateOrCounty]: stateOrCountySel.value });
    return [styleSeries({
      name: locationTypeSel.value + " in " + stateOrCountySel.value,
      data: fileDataToHighcharts(fileDataToPlot)
    })];
  }
}

function isPlotDataEmpty(seriesForPlot) {
  var plotEmpty = true;
  for(var seriesIndex = 0; seriesIndex < seriesForPlot.length; seriesIndex++){
    var series = seriesForPlot[seriesIndex];
    var seriesData = series.data;
    if(seriesData && seriesData.length > 0) {
      plotEmpty = false;
      break;
    }
  }
  return plotEmpty;
}

function drawChart(stateOrCounty) {
  var seriesForPlot = seriesToPlot(stateOrCounty);
  if (isPlotDataEmpty(seriesForPlot)) {
    // handle empty plot
    var emptyDataNotice = document.createElement("h2")
    emptyDataNotice.innerText = 'No matching data to chart';
    emptyDataNotice.style.textAlign = 'center';
    document.getElementById('chartcontainer').appendChild(emptyDataNotice);
  } else {
    Highcharts.chart('chartcontainer', {
      chart: {
        animation: false,
        zoomType: 'x',
        events: {
          load() {
            this.showHideFlag = true;
          }
        }
      },
      responsive: {
        rules: [{
          condition: {
            maxWidth: 768
          },
          // Make the labels less space demanding on mobile
          chartOptions: {
            xAxis: {
              dateTimeLabelFormats: {
                day: '%a %b %e',
                week: '%a %b %e',
                month: '%a %b %e',
              },
              title: {
                text: ''
              }
            },
            yAxis: {
              labels: {
                align: 'left',
                x: 0,
                y: -2
              },
              title: {
                text: ''
              }
            }
          }
        }]
      },
      title: { text: chartTitle(stateOrCounty) },
      xAxis: {
        type: 'datetime',
        dateTimeLabelFormats: {
          day: '%a %b %e',
          week: '%a %b %e',
          month: '%a %b %e',
        },
        title: {
          text: 'Date'
        }
      },
      yAxis: { title: { text: 'Visits %' }, min: 0 },
      tooltip: {
        headerFormat: '<b>{series.name}</b><br>',
        pointFormat: '{point.x:%a %b %e}: {point.y}%'
      },
      plotOptions: {
        series: {
          events: {
            legendItemClick: function () {
              if (this.index == 0) {
                if (this.showHideFlag == undefined) {
                  this.showHideFlag = true
                  this.chart.series.forEach(series => {
                    series.hide()
                  })
                } else if (this.showHideFlag == true) {
                  this.chart.series.forEach(series => {
                    series.hide()
                  })
                } else {
                  this.chart.series.forEach(series => {
                    series.show()
                  })
                }
                this.showHideFlag = !this.showHideFlag;
              }
            }
          }
        }
      },
      series: seriesForPlot
    });
  }
}

function cleanLocType(string) {
  if (string == "Cafￃﾩs") {
    return "Cafes";
  }
  return string;
}

function showTopVenuesTable(stateOrCounty) {
  var topVenuesFilename = '{{foursquare_data_url}}/topvenues/'+(isRaw() ? 'raw' : 'grouped') + selectedState.replace(/\s/g, '') + '.csv';
  Papa.parse(topVenuesFilename, {
    download: true, complete:
      function (results, file) {
        // ok, we have the data from the state top venues file but we need to look here for county
        var topVenuesTableData = results.data;
        topVenuesTableData = _.map(topVenuesTableData, function (row) {
          if (isRaw()) {
            // raw
            // 2020-04-01,New York,Bronx County,4f4533814b9074f6e4fb0106,Middle Schools,4d51711871548cfad45a1b9a,Hunts Point Middle School,1
            return {
              date: row[0],
              county: row[2],
              location_type: row[4],
              venue: row[6],
              rank: parseInt(row[7]),
              datenum: datenum(row[0])
            };
          } else {
            // grouped
            // 2020-04-01,New York,Jefferson County,Fast Food Restaurants,4ba2afb8f964a520211038e3,Taco Bell,1
            return {
              date: row[0],
              county: row[2],
              location_type: row[3],
              venue: row[5],
              rank: parseInt(row[6]),
              datenum: datenum(row[0])
            };
          }
        });

        var topVenuesTable = new Tabulator("#data-table", {
          data: topVenuesTableData,
          columns: [
            { title: "Location Type", field: "location_type" },
            { title: "County", field: "county" },
            { title: "Venue", field: "venue" },
            { title: "Rank", field: "rank" },
            { title: "Date", field: "date" },
          ],
          height: "600px",
          layout: "fitColumns",
          initialSort: _.compact([
            { column: "date", dir: "desc" },
            stateOrCounty === 'county' ? { column: "county", dir: "asc" } : null,
            { column: "rank", dir: "asc" },
          ]),
        });

        topVenuesTable.addFilter("location_type", "=", locationTypeSel.value);
        if (stateOrCounty === 'county') {
          topVenuesTable.addFilter("county", "=", countySel.value);
        }
      }
  });
}

function redoFilter(stateOrCounty) {
  table.clearFilter();
  if (stateOrCountySel.value) {
    table.addFilter(stateOrCounty, "=", stateOrCountySel.value);
  }
  if (locationTypeSel.value) {
    table.addFilter("location_type", "=", locationTypeSel.value);
  }
  if (ageGroupSel.value) {
    table.addFilter(AGE_GROUP_FIELDS[ageGroupSel.value], "!=", "");
  }
  if(essentialSel.value != 'all') {
    table.addFilter("essential",'=',(essentialSel.value == 'essential'));
  }
  if (stateOrCountySel.value || locationTypeSel.value) {
    drawChart(stateOrCounty);
  };
  if (ageGroupSel.value) {
    table.redraw(true);
  }
  // if (stateOrCountySel.value && locationTypeSel.value) {
  //   showTopVenuesTable(stateOrCounty);
  // }
}

function populateSelect(selectElement, stringList, selected) {
  // ok, I think we need to disable the event handler while we do this.
  _.each(stringList, function(theString) {
    var option = document.createElement("option");
    option.value = theString;
    option.text = theString;
    if (_.contains(selected, option.text)) {
      option.selected = true;
    }
    selectElement.add(option);
  });
}

function isGroupedCategoryEssential(groupName){
  var isGroupEssential = groupToEssentialMap.get(groupName);
  return isGroupEssential;
}

function parseGroupedRow(stateOrCounty, row) {
  if (stateOrCounty === 'state') {
    return {
      date: row[0],
      state: row[1],
      location_type: row[2],
      essential: isGroupedCategoryEssential(row[2]),
      visit_index: row[3],
      visit_index_over65: row[4],
      visit_index_under65: row[5],
      rank: parseInt(row[6]),
      datenum: datenum(row[0])
    };
  } else {
    return {
      date: row[0],
      state: row[1],
      county: row[2],
      location_type: row[3],
      essential: isGroupedCategoryEssential(row[3]),
      visit_index: row[4],
      visit_index_over65: row[5],
      visit_index_under65: row[6],
      rank: parseInt(row[7]),
      datenum: datenum(row[0])
    };
  }
}

function parseRawRow(stateOrCounty, row) {
  if (stateOrCounty === 'state') {
    return {
      date: row[0],
      state: row[1],
      essential: isCategoryEssential(row[2]),
      location_type: row[3],
      visit_index: row[4],
      visit_index_over65: row[5],
      visit_index_under65: row[6],
      rank: parseInt(row[7]),
      datenum: datenum(row[0])
    };
  } else {
    return {
      date: row[0],
      state: row[1],
      county: row[2],
      essential: isCategoryEssential(row[3]),
      location_type: row[4],
      visit_index: row[5],
      visit_index_over65: row[6],
      visit_index_under65: row[7],
      rank: parseInt(row[8]),
      datenum: datenum(row[0])
    };
  }
}

function isRaw() {
  // WARNING hack
  return (datafilename.includes('raw'));
}

function parseRow(stateOrCounty, row) {
  if (isRaw()) {
    return parseRawRow(stateOrCounty, row);
  }
  return parseGroupedRow(stateOrCounty, row);
}

function getStates() {
  return [
    "Alabama",
    "Alaska",
    "Arizona",
    "Arkansas",
    "California",
    "Colorado",
    "Connecticut",
    "Delaware",
    "Florida",
    "Georgia",
    "Hawaii",
    "Idaho",
    "Illinois",
    "Indiana",
    "Iowa",
    "Kansas",
    "Kentucky",
    "Louisiana",
    "Maine",
    "Maryland",
    "Massachusetts",
    "Michigan",
    "Minnesota",
    "Mississippi",
    "Missouri",
    "Montana",
    "Nebraska",
    "Nevada",
    "New Hampshire",
    "New Jersey",
    "New Mexico",
    "New York",
    "North Carolina",
    "North Dakota",
    "Ohio",
    "Oklahoma",
    "Oregon",
    "Pennsylvania",
    "Rhode Island",
    "South Carolina",
    "South Dakota",
    "Tennessee",
    "Texas",
    "Utah",
    "Vermont",
    "Virginia",
    "Washington",
    "West Virginia",
    "Wisconsin",
    "Wyoming",
    ];
}

function parsingDone(stateOrCounty, results, file) {
  fileData = _.map(
    results.data,
    function(row) { return parseRow(stateOrCounty, row); }
  );  // get rid of header row
  if (stateOrCounty === 'state') {
    statesOrCounties = getStates();
  } else {
    statesOrCounties = _.compact(_.uniq(_.pluck(fileData, 'county')).sort());
  }
  locationTypes = _.compact(_.uniq(_.pluck(fileData, 'location_type')).sort());

  table = new Tabulator("#data-table", {
    data:fileData,
    columns:[
      {title:"Location Type", field:"location_type"},
      {title:"Essential", field:"essential", visible: false},
      {title:"Visits %", field:"visit_index", visible: true},
      {title:"Visits %", field:"visit_index_over65", visible: false},
      {title:"Visits %", field:"visit_index_under65", visible: false},
      stateOrCounty === 'state' ?
        {title:"State", field:"state"} :
        {title:"County", field:"county"},
      {title:"Date", field:"date"},
    ],
    height:"600px",
    layout:"fitColumns",
    initialSort:[
      {column:"date", dir:"desc"}
    ],
  });

  stateOrCountySel = document.getElementById(
    stateOrCounty === 'state' ? 'state-select' : 'county-select'
  );
  if (stateOrCounty === 'county') {
    document.getElementById('state_name_header').innerHTML = selectedState
  }
  populateSelect(
    stateOrCountySel,
    statesOrCounties,
    stateOrCounty === 'state' ? [selectedState] : selectedCounties
  );

  // TODO - probably should think about filtering the location types for grouped when there is an essential filter
  locationTypeSel = document.getElementById('location-type-select');
  populateSelect(locationTypeSel, locationTypes, selectedVenues);

  essentialSel = document.getElementById('essential-select');
  essentialSel.addEventListener('change', function() {
    redoFilter(stateOrCounty);
    if (stateOrCountySel.value || locationTypeSel.value) {
      drawChart(stateOrCounty);
    }
  });

  if(locationTypeSel.value) {
    // ok, we selected a location type so disable essential
    essentialSel.value = 'all';
    essentialSel.style.display = 'none';
  }

  ageGroupSel = document.getElementById('agegroup-select');
  ageGroupSel.addEventListener('change', function(event) {
    // hide all 3
    table.hideColumn("visit_index");
    table.hideColumn("visit_index_over65");
    table.hideColumn("visit_index_under65");
    table.showColumn(AGE_GROUP_FIELDS[ageGroupSel.value]);
    redoFilter(stateOrCounty);

    if (stateOrCountySel.value || locationTypeSel.value) {
      drawChart(stateOrCounty);
    }
  });

  redoFilter(stateOrCounty);

  _.each([stateOrCountySel, locationTypeSel], function(sel) {
    sel.addEventListener('change', function() { return eventListener(stateOrCounty); });
  });

}

var groupToEssentialMap = new Map();

var groupMappings = [
  {groupName:"Airport",essential:true},
  {groupName:"Alcohol",essential:true},
  {groupName:"Arts & Entertainment",essential:false},
  {groupName:"Banks",essential:true},
  {groupName:"Beach",essential:false},
  {groupName:"Big Box Stores",essential:false},
  {groupName:"Bus",essential:true},
  {groupName:"Colleges & Universities",essential:false},
  {groupName:"Convenience Store",essential:true},
  {groupName:"Discount Stores",essential:false},
  {groupName:"Drug Store",essential:true},
  {groupName:"Fast Food Restaurants",essential:true},
  {groupName:"Fitness Center",essential:false},
  {groupName:"Food",essential:true},
  {groupName:"Gas Stations",essential:true},
  {groupName:"Government",essential:true},
  {groupName:"Grocery",essential:true},
  {groupName:"Hardware Stores",essential:true},
  {groupName:"Hotel",essential:false},
  {groupName:"Medical",essential:true},
  {groupName:"Nightlife Spots",essential:false},
  {groupName:"Office",essential:false},
  {groupName:"Outdoors & Recreation",essential:false},
  {groupName:"Professional & Other Places",essential:false},
  {groupName:"Residences",essential:true},
  {groupName:"School",essential:false},
  {groupName:"Shops & Services",essential:false},
  {groupName:"Spiritual Center",essential:false},
  {groupName:"Sports",essential:false},
  {groupName:"Travel & Transport",essential:false},
  {groupName:"undefined",essential:false}
  ];

for (var groupIndex = 0; groupIndex < groupMappings.length; groupIndex++) {
  var nextGroup = groupMappings[groupIndex];
  groupToEssentialMap.set(nextGroup.groupName,nextGroup.essential);
}

var eventListener = function(stateOrCounty) {
  if (stateOrCounty === 'state') {
    var newState = stateOrCountySel.value ? encodeURIComponent(stateOrCountySel.value) : ALL;
    var stateChanged = newState != selectedState;
    selectedState = newState;
    selectedVenue = locationTypeSel.value ? encodeURIComponent(locationTypeSel.value) : ALL;
    windowLocationToSet = "/bystatesel/" + selectedState + "/" + selectedVenue;
    if (urlParams.get('datafilename')) {
      windowLocationToSet += "?datafilename=" + urlParams.get('datafilename');
    }
    window.location = windowLocationToSet;
  } else {
    county = stateOrCountySel.value ? encodeURIComponent(stateOrCountySel.value) : ALL
    venue = locationTypeSel.value ? encodeURIComponent(locationTypeSel.value) : ALL;
    windowLocationToSet = "/bydatesel/" + selectedState + "/" + county + "/" + venue;
    if (urlParams.get('datafilename')) {
      windowLocationToSet += "?datafilename=" + urlParams.get('datafilename');
    }
    window.location = windowLocationToSet;    
  }
};

function parseSelection(stateOrCounty) {
  if (stateOrCounty === 'state') {
    selectedState = _selectedState == ALL ? '' : _selectedState;
    selectedVenues = _selectedVenues == ALL ? [] : _selectedVenues.split(",");
  } else {
    selectedState = (_selectedState == NONE || _selectedState =="") ? 'California' : _selectedState;
    selectedCounties = _selectedCounties == ALL ? [] : _selectedCounties.split(",");
    selectedVenues = _selectedVenues == ALL ? [] : _selectedVenues.split(",");    
  }
}

function setNavLinks(stateOrCounty) {
  var encodedState = encodeURIComponent(selectedState);
  var encodedCounty = stateOrCounty === 'county' ? encodeURIComponent(_selectedCounties) : 'ALL'

  document.getElementById('nav-chartgrouped').href = "/bydatesel/" + encodedState + "/" + encodedCounty + "/ALL";
  document.getElementById('nav-chartall').href = "/bydatesel/" + encodedState + "/" + encodedCounty + "/ALL?datafilename=raw";
  document.getElementById('nav-stategrouped').href = "/bystatesel/" + encodedState + "/ALL";
  document.getElementById('nav-stateall').href = "/bystatesel/" + encodedState + "/ALL?datafilename=raw";
}

function parse(stateOrCounty) {
  if (stateOrCounty === 'state') {
    /*
      to set the filename we have a few questions
      1) is this grouped or raw?
      2) is the state set yet?
    */
    var filePrefix;
    if (!urlParams.get('datafilename')) {
      // OK, this is really just grouped
      filePrefix = 'grouped';
      document.getElementById('nav-stategrouped').classList.add('font-weight-bold')
    } else {
      filePrefix = 'raw';
      document.getElementById('nav-stateall').classList.add('font-weight-bold')
    }

    datafilename = '{{foursquare_data_url}}/allstate/' + filePrefix + selectedState.replace(/\s/g, '') + '.csv';
  } else {
    if (!datafilename) {
      datafilename = '{{foursquare_data_url}}/grouped' + selectedState.replace(/\s/g, '') + '.csv';
      document.getElementById('nav-chartgrouped').classList.add('font-weight-bold')

    } else {
      datafilename = '{{foursquare_data_url}}/' + datafilename + selectedState.replace(/\s/g, '') + '.csv';
      document.getElementById('nav-chartall').classList.add('font-weight-bold')
    }    
  }

  Papa.parse(datafilename, {
    download: true,
    complete: function(results, file) { return parsingDone(stateOrCounty, results, file); }
  });
}

function renderData(stateOrCounty) {
  parseSelection(stateOrCounty);
  setNavLinks(stateOrCounty);
  parse(stateOrCounty);  
}
