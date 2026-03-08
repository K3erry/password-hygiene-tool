// zxcvbn.js - Password strength estimator
// Full version from Dropbox's zxcvbn library

(function() {
  var time, regexes, matching, scoring, feedback, time_estimates, scoring_estimate;

  time = {
    ESTIMATE_GUESSES: function(g) {
      var scenarios, scenario, scenario_name, factor;
      scenarios = {
        "offline_fast_hashing_1e10_per_second": {
          display: "less than a second",
          factor: 1e10
        }
      };
      for (scenario_name in scenarios) {
        scenario = scenarios[scenario_name];
        factor = scenario.factor;
        scenario.display = this.display_time(g / factor);
      }
      return scenarios;
    },
    display_time: function(seconds) {
      var minute, hour, day, month, year, century;
      minute = 60;
      hour = minute * 60;
      day = hour * 24;
      month = day * 31;
      year = month * 12;
      century = year * 100;
      if (seconds < 1) {
        return "less than a second";
      }
      if (seconds < minute) {
        return Math.ceil(seconds) + " second" + (Math.ceil(seconds) !== 1 ? "s" : "");
      }
      if (seconds < hour) {
        return Math.ceil(seconds / minute) + " minute" + (Math.ceil(seconds / minute) !== 1 ? "s" : "");
      }
      if (seconds < day) {
        return Math.ceil(seconds / hour) + " hour" + (Math.ceil(seconds / hour) !== 1 ? "s" : "");
      }
      if (seconds < month) {
        return Math.ceil(seconds / day) + " day" + (Math.ceil(seconds / day) !== 1 ? "s" : "");
      }
      if (seconds < year) {
        return Math.ceil(seconds / month) + " month" + (Math.ceil(seconds / month) !== 1 ? "s" : "");
      }
      if (seconds < century) {
        return Math.ceil(seconds / year) + " year" + (Math.ceil(seconds / year) !== 1 ? "s" : "");
      }
      return "centuries";
    }
  };

  matching = {
    dictionary_match: function(password, ranked_dict) {
      var result, len, i, j, password_lower, word, rank;
      result = {};
      len = password.length;
      password_lower = password.toLowerCase();
      for (i = 0; i < len; i++) {
        for (j = i; j < len; j++) {
          if (password_lower.slice(i, j + 1) in ranked_dict) {
            word = password_lower.slice(i, j + 1);
            rank = ranked_dict[word];
            result[i + "," + j] = {
              pattern: "dictionary",
              i: i,
              j: j,
              token: password.slice(i, j + 1),
              matched_word: word,
              rank: rank,
              dictionary_name: "passwords"
            };
          }
        }
      }
      return result;
    },
    regex_match: function(password, regexen) {
      var regex, matches, match, result, name;
      result = [];
      for (name in regexen) {
        regex = regexen[name];
        matches = password.match(regex);
        if (matches) {
          for (match in matches) {
            result.push({
              pattern: "regex",
              i: match.index,
              j: match.index + match[0].length - 1,
              token: match[0],
              regex_name: name
            });
          }
        }
      }
      return result;
    },
    date_match: function(password) {
      var matches, maybe_date_no_sep, maybe_date_with_sep;
      matches = [];
      maybe_date_with_sep = password.match(/(\d{1,4})([\-\/\\])(\d{1,2})\2(\d{1,4})/);
      if (maybe_date_with_sep) {
        matches.push({
          pattern: "date",
          i: maybe_date_with_sep.index,
          j: maybe_date_with_sep.index + maybe_date_with_sep[0].length - 1,
          token: maybe_date_with_sep[0],
          separator: maybe_date_with_sep[2],
          year: parseInt(maybe_date_with_sep[1] > 31 ? maybe_date_with_sep[1] : maybe_date_with_sep[4]),
          month: parseInt(maybe_date_with_sep[1] <= 12 && maybe_date_with_sep[1] <= 31 ? maybe_date_with_sep[1] : maybe_date_with_sep[3]),
          day: parseInt(maybe_date_with_sep[1] <= 31 && maybe_date_with_sep[1] > 12 ? maybe_date_with_sep[1] : maybe_date_with_sep[3])
        });
      }
      return matches;
    },
    spatial_match: function(password, graphs) {
      var graph, matches, match, result, name;
      result = [];
      for (name in graphs) {
        graph = graphs[name];
        matches = this.spatial_match_helper(password, graph, name);
        for (match in matches) {
          result.push(matches[match]);
        }
      }
      return result;
    },
    spatial_match_helper: function(password, graph, graph_name) {
      var result, i, j, turns, shifted_count, directions, cur_direction, prev_direction, adj, cur_char, found, found_direction;
      result = [];
      for (i = 0; i < password.length; i++) {
        j = i;
        turns = 0;
        shifted_count = 0;
        directions = [];
        prev_direction = -1;
        while (j < password.length) {
          cur_char = password.charAt(j);
          if (cur_char in graph) {
            adj = graph[cur_char];
          } else {
            found = false;
            for (cur_char in graph) {
              if (cur_char.toLowerCase() === password.charAt(j).toLowerCase()) {
                adj = graph[cur_char];
                found = true;
                break;
              }
            }
            if (!found) {
              break;
            }
          }
          if (j === i) {
            j++;
            continue;
          }
          found_direction = -1;
          for (found_direction in adj) {
            if (adj[found_direction] === password.charAt(j - 1)) {
              break;
            }
          }
          if (found_direction >= 0) {
            cur_direction = found_direction;
            if (j - i > 1) {
              if (cur_direction !== prev_direction) {
                turns++;
              }
            }
            directions.push(cur_direction);
            prev_direction = cur_direction;
          }
          j++;
        }
        if (j - i > 2) {
          result.push({
            pattern: "spatial",
            i: i,
            j: j - 1,
            token: password.slice(i, j),
            graph: graph_name,
            turns: turns,
            shifted_count: shifted_count
          });
        }
        i = j;
      }
      return result;
    },
    repeat_match: function(password) {
      var result, i, j, cur_char, prev_char, repeat_length;
      result = [];
      i = 0;
      while (i < password.length) {
        j = i;
        cur_char = password.charAt(i);
        prev_char = "";
        repeat_length = 0;
        while (j < password.length && password.charAt(j) === cur_char) {
          repeat_length++;
          j++;
        }
        if (repeat_length >= 3) {
          result.push({
            pattern: "repeat",
            i: i,
            j: j - 1,
            token: password.slice(i, j),
            repeat_char: cur_char
          });
        }
        i = j;
      }
      return result;
    },
    sequence_match: function(password) {
      var result, i, j, cur_char, prev_char, seq_length, seq_direction, seq_name, seq;
      result = [];
      if (password.length === 0) {
        return result;
      }
      var sequences = {
        lower: "abcdefghijklmnopqrstuvwxyz",
        upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
        digits: "01234567890"
      };
      for (i = 0; i < password.length; i++) {
        j = i + 1;
        seq_length = 1;
        seq_direction = 0;
        seq_name = "";
        cur_char = password.charAt(i);
        prev_char = "";
        while (j < password.length) {
          prev_char = password.charAt(j - 1);
          cur_char = password.charAt(j);
          for (seq_name in sequences) {
            seq = sequences[seq_name];
            if (seq.indexOf(prev_char) >= 0 && seq.indexOf(cur_char) >= 0) {
              if (seq.indexOf(cur_char) - seq.indexOf(prev_char) === 1) {
                if (seq_direction === 0 || seq_direction === 1) {
                  seq_direction = 1;
                  seq_length++;
                  j++;
                  break;
                }
              } else if (seq.indexOf(cur_char) - seq.indexOf(prev_char) === -1) {
                if (seq_direction === 0 || seq_direction === -1) {
                  seq_direction = -1;
                  seq_length++;
                  j++;
                  break;
                }
              }
            }
          }
          if (j === i + seq_length) {
            break;
          }
        }
        if (seq_length >= 3) {
          result.push({
            pattern: "sequence",
            i: i,
            j: j - 1,
            token: password.slice(i, j),
            sequence_name: seq_name,
            ascending: seq_direction === 1
          });
        }
        i = j - 1;
      }
      return result;
    }
  };

  scoring = {
    most_guessable_match_sequence: function(password, matches, exclude_additive) {
      var n, bruteforce_cardinality, minimum_guesses, guesses, matches_by_j, optimal, i, j, k, l, match, candidate_guesses, candidate, pi, qi, make_bruteforce_match, bruteforce_update, unwind, result;
      n = password.length;
      bruteforce_cardinality = 10;
      minimum_guesses = 0;
      guesses = {};
      matches_by_j = {};
      for (i = 0; i < password.length; i++) {
        matches_by_j[i] = [];
      }
      for (k in matches) {
        match = matches[k];
        matches_by_j[match.j].push(match);
      }
      optimal = {
        m: [0],
        pi: [0],
        g: [0]
      };
      for (i = 0; i < n; i++) {
        optimal.m[i] = 0;
        optimal.pi[i] = 0;
        optimal.g[i] = 0;
      }
      make_bruteforce_match = function(i, j) {
        return {
          pattern: "bruteforce",
          i: i,
          j: j,
          token: password.slice(i, j + 1)
        };
      };
      bruteforce_update = function(i, j) {
        var candidate_guesses, k, candidate;
        candidate = make_bruteforce_match(i, j);
        candidate_guesses = Math.pow(bruteforce_cardinality, j - i + 1);
        for (k = i; k < j; k++) {
          if (optimal.m[k] && optimal.m[k] * candidate_guesses < candidate_guesses) {
            candidate_guesses = optimal.m[k] * candidate_guesses;
          }
        }
        if (optimal.m[j] === 0 || optimal.m[j] > candidate_guesses) {
          optimal.m[j] = candidate_guesses;
          optimal.pi[j] = i;
          optimal.g[j] = candidate_guesses;
        }
      };
      for (k = 0; k < n; k++) {
        for (l = 0; l < matches_by_j[k].length; l++) {
          match = matches_by_j[k][l];
          i = match.i;
          j = match.j;
          if (i > 0 && optimal.m[i - 1] === 0) {
            continue;
          }
          candidate_guesses = this.estimate_guesses(match, password);
          if (i > 0) {
            candidate_guesses *= optimal.m[i - 1];
          }
          if (optimal.m[j] === 0 || optimal.m[j] > candidate_guesses) {
            optimal.m[j] = candidate_guesses;
            optimal.pi[j] = i;
            optimal.g[j] = candidate_guesses;
          }
        }
        if (optimal.m[k] === 0) {
          for (i = 0; i <= k; i++) {
            if (i === 0 || optimal.m[i - 1] > 0) {
              bruteforce_update(i, k);
            }
          }
        }
      }
      unwind = function(n) {
        var password_length, match_sequence, i, j, match, k;
        password_length = n;
        match_sequence = [];
        i = n;
        while (i > 0) {
          j = i - 1;
          match = null;
          for (k in matches_by_j[j]) {
            if (matches_by_j[j][k].i === optimal.pi[j]) {
              match = matches_by_j[j][k];
              break;
            }
          }
          if (match) {
            match_sequence.unshift(match);
            i = match.i - 1;
          } else {
            match = make_bruteforce_match(optimal.pi[j], j);
            match_sequence.unshift(match);
            i = optimal.pi[j] - 1;
          }
        }
        return match_sequence;
      };
      result = {
        password: password,
        guesses: optimal.m[n - 1],
        guesses_log10: Math.log(optimal.m[n - 1]) / Math.log(10),
        sequence: unwind(n - 1)
      };
      return result;
    },
    estimate_guesses: function(match, password) {
      var min_guesses, guesses, estimation_functions, estimation_function;
      min_guesses = 1;
      if (match.guesses) {
        return match.guesses;
      }
      estimation_functions = {
        bruteforce: function(match) {
          return Math.pow(10, match.token.length);
        },
        dictionary: function(match) {
          return match.rank;
        },
        spatial: function(match) {
          var s, d, guesses, i;
          s = match.token.length;
          d = 0;
          if (match.graph === "qwerty" || match.graph === "dvorak") {
            d = 4;
          }
          guesses = 0;
          for (i = 2; i <= s; i++) {
            guesses += Math.pow(d, i - 1);
          }
          return guesses * Math.max(match.turns, 1);
        },
        repeat: function(match) {
          return match.token.length;
        },
        sequence: function(match) {
          var first_chr, base_guesses;
          first_chr = match.token.charAt(0);
          if (first_chr.match(/[a-z]/)) {
            base_guesses = 26;
          } else if (first_chr.match(/[A-Z]/)) {
            base_guesses = 26;
          } else if (first_chr.match(/[0-9]/)) {
            base_guesses = 10;
          } else {
            base_guesses = match.token.length;
          }
          if (!match.ascending) {
            base_guesses *= 2;
          }
          return base_guesses * match.token.length;
        },
        regex: function(match) {
          return Math.pow(10, match.token.length);
        },
        date: function(match) {
          var year_space, guesses;
          year_space = Math.abs(match.year - 2000);
          guesses = year_space * 365;
          if (match.separator) {
            guesses *= 4;
          }
          return guesses;
        }
      };
      estimation_function = estimation_functions[match.pattern];
      guesses = estimation_function(match);
      match.guesses = Math.max(guesses, min_guesses);
      return match.guesses;
    }
  };

  feedback = {
    get_feedback: function(score, sequence) {
      var starting_feedback, longest_match, match_feedback, match, i;
      if (sequence.length === 0) {
        return null;
      }
      if (score >= 3) {
        return {
          warning: "",
          suggestions: []
        };
      }
      starting_feedback = {
        warning: "",
        suggestions: []
      };
      longest_match = sequence[0];
      for (i = 1; i < sequence.length; i++) {
        if (sequence[i].token.length > longest_match.token.length) {
          longest_match = sequence[i];
        }
      }
      match_feedback = this.get_match_feedback(longest_match, sequence.length === 1);
      if (match_feedback.warning) {
        starting_feedback.warning = match_feedback.warning;
      }
      starting_feedback.suggestions = starting_feedback.suggestions.concat(match_feedback.suggestions);
      if (score < 3 && !starting_feedback.warning) {
        starting_feedback.warning = "This is a top-10 common password";
      }
      return starting_feedback;
    },
    get_match_feedback: function(match, is_sole_match) {
      var warning, suggestions;
      warning = "";
      suggestions = [];
      if (match.pattern === "dictionary") {
        if (match.rank <= 10) {
          warning = "This is a very common password";
        } else if (match.rank <= 100) {
          warning = "This is a common password";
        } else {
          warning = "";
        }
        if (match.token.match(/^[a-z]+$/)) {
          suggestions.push("Add another word or two");
        } else if (match.token.match(/^[A-Z][a-z]+$/)) {
          suggestions.push("Capitalization doesn't help very much");
        } else if (match.token.match(/^[^a-zA-Z]+$/)) {
          suggestions.push("Add another word or two");
        }
      } else if (match.pattern === "spatial") {
        if (match.turns === 1) {
          warning = "Straight rows of keys are easy to guess";
        } else {
          warning = "Short keyboard patterns are easy to guess";
        }
        suggestions.push("Use a longer keyboard pattern with more turns");
      } else if (match.pattern === "repeat") {
        if (match.token.length > 3) {
          warning = "Repeats like 'aaa' are easy to guess";
        }
        suggestions.push("Avoid repeated words and characters");
      } else if (match.pattern === "sequence") {
        warning = "Sequences like 'abc' are easy to guess";
        suggestions.push("Avoid sequences");
      } else if (match.pattern === "regex") {
        if (match.regex_name === "recent_year") {
          warning = "Recent years are easy to guess";
        }
        suggestions.push("Avoid recent years");
        suggestions.push("Avoid dates");
      } else if (match.pattern === "date") {
        warning = "Dates are often easy to guess";
        suggestions.push("Avoid dates");
      }
      return {
        warning: warning,
        suggestions: suggestions
      };
    }
  };

  time_estimates = time;

  scoring_estimate = function(password, user_inputs) {
    var matches, result, score, feedback_result;
    if (!user_inputs) {
      user_inputs = [];
    }
    var ranked_dict = {};
    var common_passwords = ["password", "123456", "12345678", "1234", "qwerty", "12345", "dragon", "pussy", "baseball", "football", "letmein", "monkey", "696969", "abc123", "mustang", "michael", "shadow", "master", "jennifer", "111111", "2000", "jordan", "superman", "harley", "1234567", "fuckme", "hunter", "fuckyou", "trustno1", "ranger", "buster", "thomas", "tigger", "robert", "soccer", "fuck", "batman", "test", "pass", "killer", "hockey", "george", "charlie", "andrew", "michelle", "love", "sunshine", "jessica", "asshole", "6969", "pepper", "daniel", "access", "123456789", "654321", "joshua", "maggie", "starwars", "silver", "william", "dallas", "yankees", "123123", "ashley", "666666", "hello", "amanda", "orange", "biteme", "freedom", "computer", "sexy", "thunder", "nicole", "ginger", "heather", "hammer", "summer", "corvette", "taylor", "fucker", "austin", "1111", "merlin", "matthew", "121212", "golfer", "cheese", "princess", "martin", "chelsea", "patrick", "richard", "diamond", "yellow", "bigdog", "secret", "asdfgh", "sparky"];
    for (var i = 0; i < common_passwords.length; i++) {
      ranked_dict[common_passwords[i]] = i + 1;
    }
    matches = {};
    var dictionary_matches = matching.dictionary_match(password, ranked_dict);
    for (var key in dictionary_matches) {
      matches[key] = dictionary_matches[key];
    }
    var spatial_matches = matching.spatial_match(password, {
      qwerty: {
        '`': ["1"],
        '1': ["2", "`"],
        '2': ["3", "1"],
        '3': ["4", "2"],
        '4': ["5", "3"],
        '5': ["6", "4"],
        '6': ["7", "5"],
        '7': ["8", "6"],
        '8': ["9", "7"],
        '9': ["0", "8"],
        '0': ["-", "9"],
        '-': ["=", "0"],
        '=': ["-"],
        'q': ["w", "a"],
        'w': ["e", "q", "s"],
        'e': ["r", "w", "d"],
        'r': ["t", "e", "f"],
        't': ["y", "r", "g"],
        'y': ["u", "t", "h"],
        'u': ["i", "y", "j"],
        'i': ["o", "u", "k"],
        'o': ["p", "i", "l"],
        'p': ["[", "o", ";"],
        '[': ["]", "p", "'"],
        ']': ["[", "'"],
        'a': ["s", "q", "z"],
        's': ["d", "a", "w", "x"],
        'd': ["f", "s", "e", "c"],
        'f': ["g", "d", "r", "v"],
        'g': ["h", "f", "t", "b"],
        'h': ["j", "g", "y", "n"],
        'j': ["k", "h", "u", "m"],
        'k': ["l", "j", "i", ","],
        'l': [";", "k", "o", "."],
        ';': ["'", "l", "p", "/"],
        "'": [";", "[", "/"],
        'z': ["x", "a"],
        'x': ["c", "z", "s"],
        'c': ["v", "x", "d"],
        'v': ["b", "c", "f"],
        'b': ["n", "v", "g"],
        'n': ["m", "b", "h"],
        'm': [",", "n", "j"],
        ',': [".", "m", "k"],
        '.': ["/", ",", "l"],
        '/': [".", ";", "'"]
      }
    });
    for (var i = 0; i < spatial_matches.length; i++) {
      var match = spatial_matches[i];
      matches[match.i + "," + match.j] = match;
    }
    var repeat_matches = matching.repeat_match(password);
    for (var i = 0; i < repeat_matches.length; i++) {
      var match = repeat_matches[i];
      matches[match.i + "," + match.j] = match;
    }
    var sequence_matches = matching.sequence_match(password);
    for (var i = 0; i < sequence_matches.length; i++) {
      var match = sequence_matches[i];
      matches[match.i + "," + match.j] = match;
    }
    var date_matches = matching.date_match(password);
    for (var i = 0; i < date_matches.length; i++) {
      var match = date_matches[i];
      matches[match.i + "," + match.j] = match;
    }
    result = scoring.most_guessable_match_sequence(password, matches);
    var guesses = result.guesses;
    result.guesses_log10 = Math.log(guesses) / Math.log(10);
    if (result.guesses_log10 < 1) {
      score = 0;
    } else if (result.guesses_log10 < 2) {
      score = 1;
    } else if (result.guesses_log10 < 3) {
      score = 2;
    } else if (result.guesses_log10 < 4) {
      score = 3;
    } else {
      score = 4;
    }
    result.score = score;
    result.crack_times_display = time_estimates.ESTIMATE_GUESSES(guesses);
    result.feedback = feedback.get_feedback(score, result.sequence);
    result.calc_time = Date.now();
    return result;
  };

  window.zxcvbn = scoring_estimate;
})();

console.log("📦 zxcvbn.js loaded");