(function (global) {

	const PARAM_RE = /:\w+\b/g;
	const TOKEN_RE = /((?:.|\n)*?)(:[\w\-]+\b)((?:.|\n)*?)/g;
	const GROUP_RE = /(^|[^\\])\((?!\?)/g;
	const SPECIAL_RE = /([\*\.\?\+\$\^\[\]\(\)\{\}\|\\\/])/g;

	/**
	 * Predefined tokens
	 * @member Analyzer.tokens
	 */
	var tokens = Analyzer.tokens = {
		'url': {
			type: String,
			pattern: /[^ ]+/
		},
		'method': {
			type: String,
			pattern: /\w+/
		},
		'response-time': {
			type: Number,
			pattern: /[\d\.]+/
		},
		'datetime': {
			type: Date,
			pattern: /[\w\-\.\/,:+ ]+/
		},
		'status': {
			type: Number,
			pattern: /\d+/
		},
		'referrer': {
			type: String,
			pattern: /[^ ]+/
		},
		'remote-addr': {
			type: String,
			pattern: /[\w\.,: ]+/
		},
		'remote-user': {
			type: String,
			pattern: /\w+/
		},
		'http-version': {
			type: Number,
			pattern: /\d\.\d/
		},
		'user-agent': {
			type: String,
			pattern: /.*/
		},
		'content-length': {
			type: Number,
			pattern: /\d+/
		}
	};

	function merge(target, /** ..., **/ objects) {
		target = target || {};
		for (var i = 1, l = arguments.length; i < l; ++i) {
			var object = arguments[i];
			if (typeof object === 'object') {
				var keys = Object.keys(object);
				for (var j = 0, m = keys.length; j < m; ++j) {
					var key = keys[j];
					target[key] = object[key];
				}
			}
		}
		return target;
	}

	function statAccessLogs(logs) {
		var firstUrl = logs && logs[0] && logs[0]['url'];
		if (!firstUrl) {
			return;
		}
		var totalRequests = logs.length,
			abortedRequests = 0,
			failedRequests = 0,
			avgTimeServed = 0,
			totalTime = 0,
			bandWidth = 0;
		for (var i = 0, l = logs.length; i < l; ++i) {
			var log = logs[i];
			if (log['response-time']) {
				totalTime += log['response-time'];
			} else {
				++abortedRequests;
			}
			if (log['status'] >= 400) {
				++failedRequests;
			}
			if (log['content-length']) {
				bandWidth += log['content-length'];
			}
		}
		if (totalRequests > abortedRequests) {
			avgTimeServed = (totalTime / (totalRequests - abortedRequests)).toFixed(3);
		}
		return {
			totalRequests: totalRequests,
			abortedRequests: abortedRequests,
			failedRequests: failedRequests,
			avgTimeServed: avgTimeServed,
			bandWidth: bandWidth
		};
	}

	/**
	 * Instance an log analyzer.
	 * @class Analyzer
	 * @param {String}  [format]
	 * @param {Object}  [options]
	 * @param {String}  [options.separator=\n]
	 * @param {String}  [options.placeholder=-]
	 * @param {String}  [options.encoding=utf8]
	 * @param {Boolean} [options.ignoreMismatches=false]
	 */
	function Analyzer(format, options) {
		if (typeof format !== 'string') {
			options = arguments[0];
			format = null;
		}
		options = options || {};

		this.logs = [];
		this.fields = [];
		this.groups = {};
		this.requests = [];
		this.logFormat = format || '';
		this.overviews = [statAccessLogs];
		this.tokens = Object.create(tokens);
		this.separator = options.separator || '\n';
		this.ignoreMismatches = !!options.ignoreMismatches;
		this.placeholder = typeof options.placeholder === 'string' ? options.placeholder : '-';

		this._callback = null;
		this._hasError = false;
	}

	/**
	 * Returns the pattern of path
	 * @param  {String} path
	 * @return {RegExp}
	 */
	Analyzer.getPathPattern = function (path) {
		return new RegExp('^' +
			path.replace(SPECIAL_RE, '\\$1')
				.replace(PARAM_RE, '[^\/]+')
		);
	};

	/**
	 * Define a token to match the log field.
	 * @method Analyzer#token
	 * @param  {String}   name
	 * @param  {RegExp}   [pattern=/[^ ]+/]
	 * @param  {Function} [type=String]
	 * @return {Analyzer} this
	 */
	Analyzer.prototype.token = function (name, pattern, type) {
		this.tokens[name] = {
			type: type,
			pattern: pattern
		};
		return this;
	};

	/**
	 * Set up the log format.
	 * @method Analyzer#format
	 * @param  {String} format
	 * @return {String}
	 */
	Analyzer.prototype.format = function (format) {
		if (format) {
			this.logFormat = format;
		}
		return this.logFormat;
	};

	/**
	 * Adds an request rule.
	 * @method Analyzer#use
	 * @param  {String}        [method] The request method.
	 * @param  {String|RegExp} path     The request path.
	 * @return {Analyzer}      this
	 */
	Analyzer.prototype.use = function (method, path) {
		if (!path) {
			path = method;
			method = '';
		}
		this.requests.push({
			method: method,
			path: path
		});
		return this;
	};

	/**
	 * Adds a callback function to analyze overview data.
	 * @method Analyzer#overview
	 * @param  {Function} fn
	 * @return {Analyzer} this
	 */
	Analyzer.prototype.overview = function (fn) {
		this.overviews.push(fn);
		return this;
	};

	/**
	 * Adds a analysis group.
	 * @method Analyzer#group
	 * @param  {String}          name
	 * @param  {String|Function} [groupBy]
	 * @param  {Function}        [calculator]
	 * @return {Analyzer}        this
	 */
	Analyzer.prototype.group = function (name, groupBy, calculator) {
		this.groups[name] = {
			groupBy: groupBy,
			calculator: calculator
		};
		return this;
	};

	/**
	 * Returns a object array of parsed logs.
	 * @param  {String|Array} logs The log string or log string array.
	 * @return {Array}             The parsed result.
	 */
	Analyzer.prototype.parse = function (logs) {
		if (typeof logs === 'string') {
			logs = logs.split(this.separator);
		}
		var result = [];
		for (var i = 0, l = logs.length; i < l; ++i) {
			var log = logs[i].trim();
			if (!log) {
				continue;
			}

			var parsedLog = this._parseLog(log);
			if (parsedLog) {
				result.push(parsedLog);
			} else if (!this.ignoreMismatches) {
				this._emitError(new Error('Log not matched\n' + this.logFormat + '\n' + log));
				break;
			}
		}
		return result;
	};

	Analyzer.prototype.filter = function (callback) {
		var logs = this.logs,
			filteredLogs = [];
		for (var i = 0, l = logs.length; i < l; ++i) {
			var log = logs[i];
			var filtered = callback(log);
			if (filtered) {
				filteredLogs.push(filtered);
			}
		}
	};

	/**
	 * Start analyze with logs.
	 * @method Analyzer#analyze
	 * @param  {String|Array} logs
	 * @return {Object}            The analytics result.
	 */
	Analyzer.prototype.analyze = function (logs) {
		this._hasError = false;
		this._callback = null;
		this._parseFormat();
		if (typeof logs === 'string') {
			logs = logs.split(this.separator);
			this.logs = this.parse(logs);
		} else {
			this.logs = logs;
		}

		var result = {};
		var requests = this.requests;
		result['overall'] = this._analyzeRequests('', /.*/);
		for (var i = 0, l = requests.length; i < l; ++i) {
			var request = requests[i],
				method = request['method'].toUpperCase(),
				path = request['path'],
				key = (method ? method + ' ' : '') + path;
			result[key] = this._analyzeRequests(method, path);
		}
		return result;
	};

	/**
	 * Start analyze with the log file.
	 * @method Analyzer#analyzeFile
	 * @param  {String}   filename
	 * @param  {Function} [callback]
	 * @return {Analyzer} this
	 */
	Analyzer.prototype.analyzeFile = function (filename, callback) {
		var fs = require('fs');
		var cache = '';
		var self = this;
		var parsedLogs = [];
		var stream = fs.createReadStream(filename);

		this._hasError = false;
		this._callback = callback;
		this._parseFormat();

		stream.on('data', function (chunk) {
			if (self._hasError) {
				return;
			}
			var data = cache + chunk.toString(),
				logs = data.split(self.separator);
			if (logs[logs.length - 1]) {
				cache = logs.pop();
			} else {
				cache = '';
			}
			parsedLogs = parsedLogs.concat(self.parse(logs));
		});
		stream.on('end', function () {
			if (self._hasError) {
				return;
			}
			if (cache) {
				self.parse(cache);
			}
			if (!self._hasError && callback) {
				var result = self.analyze(parsedLogs);
				callback.call(self, null, result);
			}
		});
		stream.on('error', function (err) {
			self._emitError(err);
		});
		return this;
	};

	Analyzer.prototype._parseFormat = function () {
		var self = this,
			fields = this.fields,
			format = this.logFormat,
			placeholder = this.placeholder;

		var source = format.replace(TOKEN_RE, function (_, before, field, after) {
			field = field.slice(1);
			fields.push(field);

			var token = self.tokens[field],
				pattern = token && token['pattern'] || /[^ ]+/,
				source = pattern.source || pattern;

			before = before.replace(SPECIAL_RE, '\\$1');
			field = '(' + source.replace(GROUP_RE, '$1(?:') + '|' + placeholder + ')';
			after = after.replace(SPECIAL_RE, '\\$1');

			return before + field + after;
		});
		this._pattern = new RegExp('^' + source + '$', 'i');
	};

	Analyzer.prototype._parseLog = function (log) {
		var result = null,
			tokens = this.tokens,
			fields = this.fields;
		log.replace(this._pattern, function () {
			result = {};
			for (var i = 0, l = fields.length; i < l; ++i) {
				var field = fields[i],
					token = tokens[field],
					type = token && token['type'],
					value = arguments[i + 1];
				if (type === Number) {
					value = parseFloat(value);
				} else if (type === Date) {
					value = new Date(value);
				}
				result[field] = value;
			}
		});
		return result;
	};

	Analyzer.prototype._analyzeRequests = function (method, path) {
		var i, l, pattern;
		if (path instanceof RegExp) {
			pattern = path;
		} else {
			pattern = Analyzer.getPathPattern(path);
		}

		var logs = this.logs,
			matchedLogs = [];
		for (i = 0, l = logs.length; i < l; ++i) {
			var log = logs[i];
			if ((!method || method === log['method'].toUpperCase()) && pattern.test(log['url'])) {
				matchedLogs.push(log);
			}
		}

		return {
			overview: this._analyzeOverview(matchedLogs),
			groups: this._analyzeGroups(matchedLogs)
		};
	};

	Analyzer.prototype._analyzeOverview = function (logs) {
		var overview = {},
			overviews = this.overviews;
		for (var i = 0, l = overviews.length; i < l; ++i) {
			overview = merge(overview, overviews[i].call(this, logs));
		}
		return overview;
	};

	Analyzer.prototype._analyzeGroups = function (logs) {
		var i, j, l, m,
			results = {},
			groups = this.groups,
			placeholder = this.placeholder,
			names = Object.keys(groups);
		for (i = 0, l = names.length; i < l; ++i) {
			var key,
				result = {},
				logGroups = {},
				name = names[i],
				group = groups[name],
				groupBy = group['groupBy'] || name,
				calculator = group['calculator'];

			for (j = 0, m = logs.length; j < m; ++j) {
				var log = logs[j];
				if (typeof groupBy === 'function') {
					key = groupBy.call(this, log);
				} else {
					key = log[groupBy];
				}
				if (!key && key !== 0) {
					key = placeholder;
				}

				if (calculator) {
					logGroups[key] = logGroups[key] || [];
					logGroups[key].push(log);
				} else {
					result[key] = result[key] || 0;
					result[key] += 1;
				}
			}

			if (calculator) {
				var keys = Object.keys(logGroups);
				for (j = 0, m = keys.length; j < m; ++j) {
					key = keys[j];
					result[key] = calculator.call(this, logGroups[key]);
				}
			}

			results[name] = result;
		}
		return results;
	};

	Analyzer.prototype._emitError = function (err) {
		this._hasError = true;
		if (this._callback) {
			this._callback.call(this, err);
		} else {
			throw err;
		}
	};

	// Expose
	if (typeof module !== 'undefined' && module.exports) {
		module.exports = Analyzer;
	} else if (typeof define === 'function') {
		define(Analyzer);
	} else {
		global.LogAnalyzer = Analyzer;
	}

})(this);