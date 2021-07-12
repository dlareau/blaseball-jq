function parse_object(obj, path) {
  if (path == undefined)
    path = "";

  var type = typeof(obj);
  var scalar = (type == "number" || type == "string" || type == "boolean" || type == "null");

  if (type == "array" || type == "object") {
    var d = {};
    for (var i in obj) {
      var newD = parse_object(obj[i], path + i + "/");
      $.extend(d, newD);
    }

    return d;
  }

  else if (scalar) {
    var d = {};
    var endPath = path.substr(0, path.length-1);
    d[endPath] = obj;
    return d;
  }

  else return {};
}

function arrayFrom(json) {
    var queue = [], next = json;
    while (next !== undefined) {
        if (Array.isArray(next)) {
            if (next.length > 0) {

              var type = typeof(next[0]);
              var scalar = (type == "number" || type == "string" || type == "boolean" || type == "null");

              if (!scalar)
                return next;
            }
        } if (typeof(next) == "object") {
          for (var key in next)
             queue.push(next[key]);
        }
        next = queue.shift();
    }
    return [json];
}


function removeTrailingComma(input) {
  if (input.slice(-1) == ",")
    return input.slice(0,-1);
  else
    return input;
}

function isJSONLines(string) {
 return !!(string.match(/\}\s+\{/))
}

function linesToJSON(string) {
  return "[" + string.replace(/\}\s+\{/g, "}, {") + "]";
}

function hasLineBreaksInStrings(string) {
  return !!(string.match(/([^,\{\}\[\]\n\"\'"])([\n]{1,})/));
}

function escapeLineBreaksInStrings(string) {
  return string.replace(
    /([^,\{\}\[\]\n\"\'"])([\n]{1,})/g,
    function (match, prefix, newlines) {
      return "" + prefix + newlines.replace(/\n/g, "\\n")
    }
  );
}

function doCSV(json) {
  var inArray = arrayFrom(json);

  var outArray = [];
  for (var row in inArray)
      outArray[outArray.length] = parse_object(inArray[row]);

  var result = $.csv.fromObjects(outArray, {separator: ','});
  // show raw data if people really want it
  return result;
}

function doCSVTable(json) {
  var inArray = arrayFrom(json);

  var data = [];
  for (var row in inArray)
      data[data.length] = parse_object(inArray[row]);
  data = $.csv.toArrays($.csv.fromObjects(data, {separator: ','}));

  var html = '<table  class="table table-condensed table-hover table-striped">';
  if(typeof(data[0]) === 'undefined') {
    return null;
  } else {
    $.each(data, function( index, row ) {
      //bind header
      if(index == 0) {
        html += '<thead>';
        html += '<tr>';
        $.each(row, function( index, colData ) {
          html += '<th>';
          html += colData;
          html += '</th>';
        });
        html += '</tr>';
        html += '</thead>';
        html += '<tbody>';
      } else {
        html += '<tr>';
        $.each(row, function( index, colData ) {
          html += '<td>';
          html += colData;
          html += '</td>';
        });
        html += '</tr>';
      }
    });
    html += '</tbody>';
    html += '</table>';
    return html;
  }
}