# Log Analyzer

A lightweight and powerful log analyzer.

[![NPM](https://nodei.co/npm/log-analyzer.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/deferred-lib/)

## Installation

### Node

```bash
$ npm install log-analyzer
```

### Browser

```html
<script src="js/log-analyzer.js"></script>
```

## Documentation

### new Analyzer([format], [options])

Instance an log analyzer.

#### options

- separator - The separator of each logs, defaults to `\n`.
- placeholder - The placeholder of empty fields, defaults to `-`.
- encoding - The encoding of the analyzing file, defaults to `utf-8``.
- ignoreMismatches - If true, ignore mismatched logs, defaults to `false`.

### analyzer.token(name, [pattern], [type])

Define a token to match the log field.

**Predefined tokens:**

| name           | pattern           | type   |
| -------------- | ----------------- |:------:|
| url            | /[^ ]+/           | String |
| method         | /\w+/             | String |
| response-time  | /[\d\.]+/         | Number |
| datetime       | /[\w\-\.\/,:+ ]+/ | Date   |
| status         | /\d+/             | Number |
| referrer       | /[^ ]+/           | String |
| remote-addr    | /[\w\.,: ]+/      | String |
| remote-user    | /\w+/             | String |
| http-version   | /\d\.\d/          | Number |
| user-agent     | /.*/              | String |
| content-length | /\d+/             | Number |
| *#default#*    | /[^ ]+/           | String |

### analyzer.format(format)

Set up the log format, if the `token` in `format` is not matched, then use the default `pattern` and `type`.

**Example:**

```js
analyzer.format(':remote-addr - :remote-user [:datetime] ":method :url HTTP/:http-version" :status :content-length');
```

### analyzer.use([method], path)

Adds an request rule.

**Example:**

```js
// Match all request methods.
analyzer.use('/index.html');
// Path with param token.
analyzer.use('GET', '/user/:name');
// Using the regular expression.
analyzer.use('POST', /\/search?q=.*/);
```

### analyzer.overview(callback)

Adds a callback to analyze overview data, `callback` gets one argument `(logs)` where `logs` is an array of log objects.

**Example:**

```js
analyzer.overview(function (logs) {
	var notFoundRequests = 0;
	for (var i = 0, l = logs; i < l; ++i) {
		var log = logs[i];
		if (log['status'] === 404) {
			++notFoundRequests;
		}
	}
	return {
		notFoundRequests: notFoundRequests
	};
});
```

### analyzer.group(name, [groupBy], [calculator])

Adds a analysis group.

If `groupBy` is a string, analyzer will group by the field value, if it is a function, analyzer will group by the return value of it.

The `calculator` callback gets one argument `(logs)` where logs is an array of grouping logs.

**Example:**

```js
// Group by the `method` field
analyzer.group('method');

// Group by the hour
analyzer.group('requestsPerHour', function (log) {
	var date = log['datetime'];
	if (date) {
		return date.getHour();
	} else {
		return '-';
	}
});

// Calculate the band width per hour
analyzer.group('bandWidthPerHour', function (log) {
	return log['datetime'].getHours();
}, function (logs) {
	var result = 0;
	for (var i = 0, l = logs.length; i < l; ++i) {
		var log = logs[i],
			contentLength = log['content-length'];
		if (contentLength) {
			result += contentLength;
		}
	}
	return result;
});
```

### analyzer.parse(logs)

Returns a object array of parsed logs.

### analyzer.analyze(logs)

Returns the analytics result of the logs.

### analyzer.analyzeFile(filename, callback)

Analyze the provided log file, the `callback` gets two arguments `(err, result)`.

```js
analyzer.analyzeFile('access.log', function (err, result) {
	if (err) {
		console.error(err);
	} else {
		console.log(result);
	}
});
```