var response = null;
var output = null;
var timeoutId;
var globalError = null;
var horrible_team_string = "";
var horrible_player_string = "";

function getURLargs() {
  var urlParams = new URLSearchParams(window.location.search);
  if(urlParams.has("base")) {
    $("#base").val(urlParams.get("base"));
  }

  if(urlParams.has("query")) {
    $("#query").val(urlParams.get("query"));
  }

  if(urlParams.has("jq_str")) {
    $("#jq_str").val(urlParams.get("jq_str"));
  }

  if(urlParams.has("csv_enable")) {
    $("#csv_enable").prop('checked', true);
  }

  if(urlParams.has("table_enable")) {
    $("#table_enable").prop('checked', true);
  }

  if(urlParams.has("count_enable")) {
    $("#count_enable").prop('checked', true);
  }

  if(urlParams.has("team_enable")) {
    $("#team_enable").prop('checked', true);
  }

  if(urlParams.has("player_enable")) {
    $("#player_enable").prop('checked', true);
  }
}

function do_jq(data, jq_args) {
  $("#jq_load").show();
  try {
    flags = ["-c"];
    if(horrible_team_string != "") {
      flags = flags.concat(['--argjson', 'teams', horrible_team_string]);
    }
    if(horrible_player_string != "") {
      flags = flags.concat(['--argjson', 'players', horrible_player_string]);
    }
    res = jq.raw(data, jq_args, flags);
    if (res.indexOf('\n') !== -1) {
      res = res
        .split('\n')
        .filter(function(x) {
          return x;
        })
        .reduce(function(acc, line) {
          return acc.concat(JSON.parse(line));
        }, []);
    } else {
      res = JSON.parse(res);
    }
  } catch (error) {
    $("#jq_load").hide();
    $("#error_div").html(error.stack.replace(/(?:\r\n|\r|\n)/g, '<br>'));
    $("#error_div").show();
    globalError = error;
    return output;
  }

  $("#error_div").hide();

  $("#tableResult").empty();
  $("#result").show();
  if($("#count_enable").is(":checked")) {
    var occurrences = { };
    for (var i = 0, j = res.length; i < j; i++) {
       occurrences[res[i]] = (occurrences[res[i]] || 0) + 1;
    }
    sorted = Object.entries(occurrences).sort(([,a],[,b]) => b-a).map(x => x[1] + " " + x[0]);
    text = sorted.join("\n");
    $("#result").text(text);
  } else if($("#table_enable").is(":checked")) {
    $("#result").hide();
    $("#result").text("");
    $("#tableResult").html(doCSVTable(res));
  } else if($("#csv_enable").is(":checked")) {
    $("#result").text(doCSV(res));
  } else {
    $("#result").text(JSON.stringify(res, null, 2));
  }
  document.querySelectorAll('#result').forEach(el => {
    hljs.highlightElement(el);
  });
  $("#jq_load").hide();
  url = window.location.origin + window.location.pathname + "?" + $("#input_form").serialize();
  window.history.pushState(url, 'Web JQ', url);
  return res;
}

function recalculate() {
  // TODO: point at API2 and re-enable html elements for players and teams.
  if($("#player_enable").is(":checked") && horrible_player_string == "") {
    $("#player_load").show();
    $.ajax({url: "https://api.sibr.dev/chronicler/v2/entities?type=player", success: function(players) {
      horrible_player_string = JSON.stringify(jq.json(players, "[.items[].data | {(.id): (try (.state.unscatteredName) // .name)}] | add"));
      output = null;
      $("#player_load").hide();
      recalculate();
    }});
  }

  if($("#team_enable").is(":checked") && horrible_team_string == "") {
    $("#team_load").show();
    $.ajax({url: "https://api.sibr.dev/chronicler/v2/entities?type=team", success: function(teams) {
      horrible_team_string = JSON.stringify(jq.json(teams, "[.items[].data | {(.id): .fullName}] | add"));
      output = null;
      $("#team_load").hide();
      recalculate();
    }});
  }
  if (!response){
    $("#web_load").show();
    $("#web_error").hide();
    $("#error_div").hide();

    if($("#base").val() == "sibr") {
      url = "https://api.sibr.dev/" + $("#query").val();
    } else if ($("#base").val() == "sibr2") {
      url = "https://api2.sibr.dev/" + $("#query").val();
    } else if ($("#base").val() == "blaseball") {
      url = "https://api.sibr.dev/corsmechanics/www.blaseball.com/" + $("#query").val();
    } else {
      url = "";
    }

    if(url == "" || $("#query").val() == ""){
      $("#web_load").hide();
      return;
    }

    $.ajax({url: url, dataType: "text", success: function(data) {
        $("#web_load").hide();
        response = data;
        output = do_jq(data, $("#jq_str").val());
      }}
    );
  } else if (!output) {
    output = do_jq(response, $("#jq_str").val());
  }
}

$( document ).ready(function() {
  $("#json_btn").on('click', function() {
    var a = document.body.appendChild(
      document.createElement("a")
    );
    a.download = "data.json";
    a.href = "data:text/html," + JSON.stringify(output, null, 2);
    a.click();
  });

  $("#csv_btn").on('click', function() {
    var a = document.body.appendChild(
      document.createElement("a")
    );
    a.download = "data.csv";
    a.href = "data:text/html," + doCSV(output);
    a.click();
  });

  hljs.highlightAll();
  getURLargs();
});

jq.onInitialized.addListener(function function_name(argument) {
  recalculate();

  // These are commented as we moved to submit button based jq

  // $('#base').on('input', function() {
  //   response = null;
  //   clearTimeout(timeoutId);
  //   timeoutId = setTimeout(function() {
  //     recalculate();
  //   }, 1000);
  // });

  // $('#query').on('input', function() {
  //   response = null;
  //   clearTimeout(timeoutId);
  //   timeoutId = setTimeout(function() {
  //     recalculate();
  //   }, 1000);
  // });

  // $('#jq_str').on('input', function() {
  //   output = null;
  //   clearTimeout(timeoutId);
  //   timeoutId = setTimeout(function() {
  //     recalculate();
  //   }, 1000);
  // });

  $("#random_btn").on('click', function() {
    output = null;
    recalculate();
  });


  $('#csv_enable').on('change', function() {
    output = null;
    recalculate();
  });

  $('#table_enable').on('change', function() {
    output = null;
    recalculate();
  });

  $('#count_enable').on('change', function() {
    output = null;
    recalculate();
  });

  $('#team_enable').on('change', function() {
    output = null;
    recalculate();
  });

  $('#player_enable').on('change', function() {
    output = null;
    recalculate();
  });

  $("#random_btn").on('click', function() {
    examples = [
      {"boxes": [], "query": "chronicler/v2/versions?type=globalevents&order=desc", "jq_str": "[.items[] | {(.validFrom): [.data[].msg]}] | add"},
      {"boxes": [], "query": "chronicler/v2/entities?type=stadium", "jq_str": ".items[].data.name"},
      {"boxes": [], "query": "chronicler/v2/entities?type=team", "jq_str": "[.items[].data | select(.stadium) | {team: .nickname, eDensity: .eDensity}] | sort_by(.eDensity)[]"},
      {"boxes": [], "query": 'chronicler/v2/entities?type=item', "jq_str": '.items | .[].data | select(.name == "Inflatable Sunglasses")'},
      {"boxes": [], "query": 'chronicler/v2/entities?type=team', "jq_str": '.items[].data | select(.permAttr| index("AFFINITY_FOR_CROWS")) | .nickname'},
      {"boxes": [], "query": 'eventually/v2/events?playerTags=21cbbfaa-100e-48c5-9cea-7118b0d08a34&limit=100', "jq_str": '.[] | {season, day, description}'},
      {"boxes": ["player", "count"], "query": 'eventually/v2/events?type=71&limit=1000 ', "jq_str": '.[] | .playerTags[] | $players[.]'},
    ];
    $("#base").val("sibr");
    rand_query = examples[Math.floor(Math.random()*examples.length)];
    $("#query").val(rand_query["query"]);
    $("#jq_str").val(rand_query["jq_str"]);
    if(rand_query["boxes"].includes("player")) {
      $("#player_enable").prop('checked', true);
    } else {
      $("#player_enable").prop('checked', false);
    }
    if(rand_query["boxes"].includes("team")) {
      $("#team_enable").prop('checked', true);
    } else {
      $("#team_enable").prop('checked', false);
    }
    if(rand_query["boxes"].includes("count")) {
      $("#count_enable").prop('checked', true);
    } else {
      $("#count_enable").prop('checked', false);
    }
    if(rand_query["boxes"].includes("csv")) {
      $("#csv_enable").prop('checked', true);
    } else {
      $("#csv_enable").prop('checked', false);
    }
    if(rand_query["boxes"].includes("csv")) {
      $("#table_enable").prop('checked', true);
    } else {
      $("#table_enable").prop('checked', false);
    }
    response = null;
    recalculate();
  });
});