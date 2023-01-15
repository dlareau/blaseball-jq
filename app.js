state = {"output_mode": "json",
         "base": "sibr2",
         "query": "",
         "jq_str": "",
         "flags": "",
         "desc": "",
         "options": {}
};

examples = [
      {"output_mode": "json", "options": {},
       "query": "chronicler/v2/versions?type=globalevents&order=desc",
       "jq_str": "[.items[] | {(.validFrom): [.data[].msg]}] | add",
       "desc": "Previous sets of ticker messages and when they were first seen."},
      {"output_mode": "json", "options": {},
       "query": "chronicler/v2/entities?type=stadium",
       "jq_str": ".items[].data.name",
       "desc": "The name of every existing stadium"},
      {"output_mode": "json", "options": {},
       "query": "chronicler/v2/entities?type=team",
       "jq_str": "[.items[].data | select(.stadium) | {team: .nickname, eDensity: .eDensity}] | sort_by(.eDensity)[]",
       "desc": "Each team's name and eDensity"},
      {"output_mode": "json", "options": {},
       "query": 'chronicler/v2/entities?type=item',
       "jq_str": '.items | .[].data | select(.name == "Inflatable Sunglasses")',
       "desc": "Details for the item named \"Inflatable sunglasses\""},
      {"output_mode": "json", "options": {},
       "query": 'chronicler/v2/entities?type=team',
       "jq_str": '.items[].data | select(.permAttr| index("AFFINITY_FOR_CROWS")) | .nickname',
       "desc": "Teams with the AFFINITY_FOR_CROWS mod"},
      {"output_mode": "json", "options": {},
       "query": 'eventually/v2/events?playerTags=21cbbfaa-100e-48c5-9cea-7118b0d08a34&limit=100',
       "jq_str": '.[] | {season, day, description}',
       "desc": "All feed events for Juice Collins"},
      {"output_mode": "json", "options": {},
       "query": 'eventually/v2/events?type=37_or_39&limit=2000',
       "jq_str": '.[].description | sub(".* is (Beaned by|Poured Over with) a "; "") | sub(".\\n.*"; "")',
       "desc": "All of the beaned/poured over coffee variations since the feed existed."},
      {"output_mode": "json", "options": {},
       "query": 'chronicler/v2/entities?type=player',
       "jq_str": '.items[].data | select(.name == "Sixpack Dogwalker")',
       "desc": "Shows both sixpack dogwalkers."},
      {"output_mode": "count", "options": {},
       "query": 'eventually/v2/events?type=71&limit=1000 ',
       "jq_str": '.[] | .playerTags[] | $players[.]',
       "desc": "The number of times players have entered the tunnels."},
    ];

subqueries = {};
response = null;
needToLoad = true;

function loadState() {
  var saved_state = localStorage.getItem("state");
  if(saved_state) {
    parsed_state = JSON.parse(saved_state);
    for(param in parsed_state) {
      if(parsed_state[param]) {
        state[param] = parsed_state[param];
      }
    }
  }
}

function saveState() {
  var saved_state = localStorage.setItem("state", JSON.stringify(state));
}

function clearState() {
  state = {"output_mode": "json",
             "base": "sibr2",
             "query": "",
             "jq_str": "",
             "flags": "",
             "desc": "",
             "options": {}
            };
}

function stateFromURL() {
  var urlParams = new URLSearchParams(window.location.search);
  if(Array.from(urlParams.entries()).length > 0) {
    clearState();
  }
  for(param of urlParams.entries()) {
    if(param[0].endsWith("_enable")) {
      state["options"][param[0]] = param[1];
    }
    state[param[0]] = param[1];
  }
}

function stateFromPage() {
  state["output_mode"] = $("#output_mode").val();
  state["base"] = $("#base").val();
  state["query"] = $("#query").val();
  state["jq_str"] = $("#jq_str").val();
  state["desc"] = $("#desc").val();
  // TODO Options
}

function stateToPage() {
  $("#output_mode").val(state["output_mode"]);
  $("#base").val(state["base"]);
  $("#query").val(state["query"]);
  $("#jq_str").val(state["jq_str"]);
  $("#desc").val(state["desc"]);
  // TODO Options
}

function download_file(ext, data) {
  var a = document.body.appendChild(
    document.createElement("a")
  );
  a.download = "data." + ext;
  a.href = "data:text/html," + data;
  a.click();
}

function trusted_subquery(url, jq_str, key, callback = null) {
  if(!(key in subqueries)) {
    $.ajax({url: url, success: function(data) {
      subqueries[key] = JSON.stringify(jq.json(data, jq_str));
      if(callback) { callback(); }
    }});
    return true;
  }
  return false;
}

function resolve_var_errors(error) {
  console.log(error);
  if(error.startsWith("jq: error: $players is not defined")) {
    console.log("attempting to resolve error");
    $("#web_load").show();
    res = trusted_subquery("https://api.sibr.dev/chronicler/v2/entities?type=player",
                           "[.items[].data | {(.id): (try (.state.unscatteredName) // .name)}] | add",
                           "players",
                            function(argument) {
                              $("#web_load").hide();
                              recalculate(false, true);
                            });

    if(!res) {
      $("#web_load").hide();
    }
    return true;
  }

  if(error.startsWith("jq: error: $teams is not defined")) {
    $("#web_load").show();
    res = trusted_subquery("https://api.sibr.dev/chronicler/v2/entities?type=team",
                           "[.items[].data | {(.id): .fullName}] | add",
                           "teams",
                            function(argument) {
                              $("#web_load").hide();
                              recalculate(false, true);
                            });

    if(!res) {
      $("#web_load").hide();
    }
    return true;
  }
  return false;
}

function untrusted_jq(data, jq_args) {
  flags = ["-c"];
  for(query in subqueries) {
    flags = flags.concat(['--argjson', query, subqueries[query]]);
  }

  try {
    res = jq.raw(data, jq_args, flags);
    // Collect multiple separate outputs into an array if needed.
    if (res.indexOf('\n') !== -1) {
      res = res
        .split('\n')
        .filter(function(x) { return x; })
        .reduce(function(acc, line) { return acc.concat(JSON.parse(line)); }, []);
    } else {
      res = JSON.parse(res);
    }
  } catch (error) {
    if(!resolve_var_errors(error.stack)) {
      $("#error_div").html(error.stack.replace(/(?:\r\n|\r|\n)/g, '<br>'));
      $("#error_div").show();
      return null;
    }
  }
  $("#error_div").hide();
  return res;
}

function do_jq(data, jq_args) {
  // Generate the output data
  $("#jq_load").show();
  output = untrusted_jq(data, jq_args) || output;

  // Return output fields to default state
  $("#tableResult").empty();
  $("#result").show();

  // Display the output data
  switch(state["output_mode"]) {
    case "count":
      var occurrences = { };
      for (var i = 0, j = output.length; i < j; i++) {
         occurrences[output[i]] = (occurrences[output[i]] || 0) + 1;
      }
      sorted = Object.entries(occurrences).sort(([,a],[,b]) => b-a).map(x => x[1] + " " + x[0]);
      text = sorted.join("\n");
      $("#result").text(text);
      break;
    case "csv":
      $("#result").text(doCSV(output));
      break;
    case "table":
      $("#result").hide();
      $("#result").text("");
      $("#tableResult").html(doCSVTable(output));
      break;
    default:
      $("#result").text(JSON.stringify(output, null, 2));
  }

  // Highlight the code block
  document.querySelectorAll('#result').forEach(el => {
    hljs.highlightElement(el);
  });

  $("#jq_load").hide();
}

function recalculate(refetch, recalc) {
  if(!(refetch || recalc)) {
    return;
  }
  stateFromPage();

  if (refetch){
    $("#web_error").hide();
    $("#error_div").hide();

    if(state["base"] == "sibr") {
      url = "https://api.sibr.dev/" + state["query"];
    } else if (state["base"] == "sibr2") {
      url = "https://api2.sibr.dev/" + state["query"];
    } else if (state["base"] == "blaseball") {
      url = "https://api.sibr.dev/corsmechanics/www.blaseball.com/" + state["query"];
    } else {
      url = "";
    }

    if(url == "" || state["query"] == ""){
      return;
    }

    $("#web_load").show();

    $.ajax({url: url, dataType: "text", success: function(data) {
        response = $.trim(data);
        $("#web_load").hide();
        do_jq(response, state["jq_str"]);
      }}
    );
    needToLoad = false;
  } else if (recalc) {
    do_jq(response, state["jq_str"]);
  }
}

$( document ).ready(function() {
  $("#json_btn").on('click', function() {
    download_file("json", JSON.stringify(output, null, 2));
  });

  $("#csv_btn").on('click', function() {
    download_file("csv", doCSV(output));
  });

  hljs.highlightAll();
  // TODO: Do other new stateful functions
});

jq.onInitialized.addListener(function function_name(argument) {
  loadState();
  stateFromURL();
  stateToPage();
  recalculate(true, true);

  $('.updateWatchURL').on('input', function() {
    needToLoad = true;
  });

  // $('.updateWatchJQ').on('input', function() {
  //   clearTimeout(timeoutId);
  //   timeoutId = setTimeout(function() {
  //     recalculate(false, true);
  //   }, 1000);
  // });

  $('.updateImmediate').on('change', function() {
    recalculate(needToLoad, true);
  });

  // $("#random_btn").on('click', function() {
  //   $("#base").val("sibr");
  //   rand_query = examples[Math.floor(Math.random()*examples.length)];
  //   for(param in rand_query) {
  //     state[param] = rand_query[param];
  //   }
  //   stateToPage();
  //   recalculate(true, true);
  // });

  $("#recalculate").on('click', function() {
    recalculate(needToLoad, true);
  });


  $("#clear_btn").on('click', function() {
    clearState();
    stateToPage();
    $("#tableResult").empty();
    $("#result").show();
    $("#result").text("");
  });

  $("#share_btn").on('click', function() {
    url = window.location.origin + window.location.pathname + "?" + $("#input_form").serialize();

    $.post({url: "https://tiny.sibr.dev/submit", data: {"url": url}, success: function(data) {
        $("#link_div").text("https://tiny.sibr.dev/" + data);
        $('#shareModal').modal();
      }}
    );
  });
});



