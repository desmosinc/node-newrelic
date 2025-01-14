/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// TODO: remove in favor of /lib/db/query-parsers/sql.js
// This module is currently used only in the Oracle instrumentation

const logger = require('../logger').child({ component: 'parse_sql' })
const StatementMatcher = require('./statement-matcher')
const ParsedStatement = require('./parsed-statement')
const stringify = require('json-stringify-safe')

const OPERATIONS = [
  new StatementMatcher('select', /^\s*select[\S\s]*from[\s\[]+([^\]\s,)(;]*).*/gi),
  new StatementMatcher('update', /^\s*update\s+([^\s,;]*).*/gi),
  new StatementMatcher('insert', /^\s*insert(?:\s+ignore)?\s+into\s+([^\s(,;]*).*/gi),
  new StatementMatcher('delete', /^\s*delete\s+from\s+([^\s,(;]*).*/gi)
]
const COMMENT_PATTERN = /\/\\*.*?\\*\//

// This must be called synchronously after the initial db call for backtraces to
// work correctly

module.exports = function parseSql(type, sql) {
  // Sometimes we get an object here from MySQL. We have been unable to
  // reproduce it, so we'll just log what that object is and return a statement
  // type of `other`.
  if (typeof sql === 'object' && sql.sql !== undefined) {
    sql = sql.sql
  }
  if (typeof sql !== 'string') {
    if (logger.traceEnabled()) {
      try {
        logger.trace('parseSQL got an a non-string sql that looks like: %s', stringify(sql))
      } catch (err) {
        logger.debug(err, 'Unabled to stringify SQL')
      }
    }
    return new ParsedStatement(type, 'other', null, sql)
  }

  sql = sql.replace(COMMENT_PATTERN, '').trim()

  let parsedStatement

  for (let i = 0, l = OPERATIONS.length; i < l; i++) {
    parsedStatement = OPERATIONS[i].getParsedStatement(sql)
    if (parsedStatement) {
      return new ParsedStatement(
        type,
        parsedStatement.operation,
        parsedStatement.collection,
        parsedStatement.query
      )
    }
  }

  return new ParsedStatement(type, 'other', null, sql)
}
