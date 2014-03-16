/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

var releases = ["1.3", "1.3T", "1.4"]; // which releases to show
var reload = 0; // reload every this many seconds (0 means disabled)

// Parse the url and extract configuration information.
parseQueryString(function (name, value, integer, list) {
  switch (name) {
  case "releases":
    releases = list;
    break;
  case "reload":
    reload = integer;
    break;
  }
});

// Initially hide the body and fade it in when we get some data to show.
$("body").hide();

$("div#toggleOwners").click(function () {
  var checkbox = $(this);
  checkbox.toggleClass("checked");
  $("div.component").each(function () {
    var component = $(this).attr("id");
    $(this).text((checkbox.hasClass("checked") && (component in OWNERS))
                 ? OWNERS[component]
                 : component);
  });
});

$("div#toggleHelp").click(function () {
  var checkbox = $(this);
  checkbox.toggleClass("checked");
  $("div#help").toggle(400);
});
$("div#help").hide();

function update() {
  // Assign a unique color and return it as a class declaration
  var getUniqueColor = (function () {
    var color = 0;
    return function () {
      return "class='color" + (color++) + "'";
    };
  })();

  // Get the color for a release as a class declaration
  var getReleaseColor = (function () {
    var colors = [];
    return function (canonical) {
      if (!(canonical in colors)) {
        colors[canonical] = getUniqueColor();
      }
      return colors[canonical];
    };
  })();

  // Create a search query link for bugzilla we can redirect to.
  function getLink(release, component, assigned_to) {
    var url = "https://bugzilla.mozilla.org/buglist.cgi?";
    var args = [];

    function push(field, value) {
      if (typeof value === "object") {
        $.each(value, function (_, v) {
          push(field, v);
        });
        return;
      }
      args.push([field, value]);
    }

    push("bug_status", ["UNCONFIRMED", "NEW", "ASSIGNED", "REOPENED"]);
    if (release)
      push("cf_blocking_b2g", release);
    if (component)
      push("component", component);
    if (assigned_to)
      push("assigned_to", assigned_to);
    $.each(args, function (n, arg) {
        args[n] = encodeURIComponent(arg[0]) + "=" + encodeURIComponent(arg[1]);
      });
    return "href='" + url + args.join("&") + "'";
  }

  function brace(s) {
    return "(" + s + ")";
  }

  function formatCount(className, release, component, assigned_to, count) {
    var html = "<a";
    if (className)
      html += " class='" + className + "'";
    html += " " + getLink(release, component, assigned_to);
    html += ">";
    html += count;
    html += "</a>";
    return html;
  }
  function formatCounts(className, release, component, count) {
    var html = formatCount(className, release, component, null, accumulate(count));
    var unassigned = accumulate(count, "nobody@mozilla.org");
    if (unassigned > 0)
      html += " " + formatCount(className + " unassigned", release, component, "nobody@mozilla.org", brace(unassigned));
    return html;
  }
  function formatStatus(counts, component) {
    var html = "<ul id='status'>";
    eachAlphabetically(counts, function (release, count) {
      var canonical = release.replace("+", "").replace("?", "");
      html += "<li " + getReleaseColor(canonical) + ">";
      html += "<div class='release'>" + release + "</div>";
      html += formatCounts("count", release, component, count);
      html += "</li>";
    });
    html += "</ul>";
    return html;
  }
  function formatComponents(components) {
    var html = "<ul id='components'>";
    eachAlphabetically(components, function (component, counts) {
      html += "<li>";
      html += "<div class='component' id='" + component + "'>" + component + "</div>";
      html += formatStatus(counts, component);
      html += "</li>";
    });
    html += "</ul>";
    return html;
  }

  var nom_flag = suffix(releases, "?");
  var block_flag = suffix(releases, "+");

  $.when(
    group(all().blocking(nom_flag).open(), ["cf_blocking_b2g", "assigned_to"]).then(function (counts) {
      $("li#noms").empty().append("<div>Nominations: " +
                                  formatCounts(null, nom_flag, null, counts) +
                                  "</div>").append(formatStatus(counts));
    }),
    group(all().blocking(block_flag).open(), ["component", "cf_blocking_b2g", "assigned_to"]).then(function (counts) {
      if ("General" in counts) {
        $("li#triage").empty().append("<div>Triage: " +
                                      formatCounts(null, block_flag, "General", counts.General) +
                                      "</div>").append(formatStatus(counts.General, "General"));
        delete counts.General;
      }
      $("li#blockers").empty().append("<div>Blockers: " +
                                      formatCounts(null, block_flag, null, counts) +
                                      "</div>").append(formatComponents(counts));
    })
  ).then(function() {
    $("body").fadeIn(400);
  });

  // Reload the data set if requested.
  if (reload) {
    setTimeout(update, reload * 1000);
  }
}

$(function () {
  update();
});
