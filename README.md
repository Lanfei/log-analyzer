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

### analyzer.format(format)

Set up the log format.

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

### analyzer.overview(fn)

Adds a callback to analyze overview data.

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

### analyzer.group(field, [filter])

Adds a analysis group, the analyzer will caculate the number of each item group by the field or the return value of the filter.

**Example:**

```js
analyzer.group('method');
analyzer.group('hour', function (log) {
	var date = log['datetime'];
	if (date) {
		return date.getHour();
	} else {
		return '-';
	}
});
```

### analyzer.parse(logs)

Returns a object array of parsed logs.

### analyzer.analyze(logs)

Returns the analytics result of the logs.

### analyzer.analyzeFile(filename, callback)

Analyze the provided log file, the callback gets two arguments (err, result).

```js
analyzer.analyzeFile('access.log', function (err, result) {
	if (err) {
		console.error(err);
	} else {
		console.log(result);
	}
});
```