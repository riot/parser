# parser

[![Build Status][travis-image]][travis-url]
[![Code Quality][codeclimate-image]][codeclimate-url]
[![NPM version][npm-version-image]][npm-url]
[![NPM downloads][npm-downloads-image]][npm-url]
[![MIT License][license-image]][license-url]
[![Coverage Status][coverage-image]][coverage-url]

Minimal, loose html parser for Riot tags

### Install

```bash
npm i @riotjs/parser --save
```

The package has two modules:

```js
// Use as: parser(options).parse(code, startPosition)
const parser = require('@riotjs/parser').default

// The enum NodeTypes (a plain JS object) that contains the values of the
// type property of the nodes emited by tagParser (and more).
const nodeTypes = require('@riotjs/parser').nodeTypes
```

ES6 modules export:

```js
import parser, { nodeTypes } from '@riotjs/parser'
```

This parser is a low-level tool that builds a simple array of objects with information about the given html fragment, readed secuencially. It is designed to parse one single tag and not entire html pages, the tag closing the root element ends the parsing.

There are 3 main node types:

* Tags - HTMLElements, including SCRIPT and STYLE elements.
* Comments - Ignored by default.
* Text - Text nodes.

Opening tags can contain attributes. Text and attribute values can contain expressions.

There's no support for untagged JavaScript block.

The value returned by the parser is an object like this:

```js
{
  data,         // String of the given html fragment with no changes.
  output        // Array of objects with information about the parsed tags.
}
```

The first element of `output` is the opening tag of the root element.

The parsing stops when the closing tag of the root is found, so the last node have the ending position.


### Commands

* Build: `npm run build`
* Test: `npm t`
* Samples: `npm run samples`

## Tag names

Both, html and Riot tag names must start with a 7 bit letter (`[a-zA-Z]`) followed by zero o more ISO-8859-1 characters, except those in `[\x00-\x2F\x7F-\xA0>/]`.

If the first letter is not found, it becomes simple text.
Any non-recognized character ends the tag name (`'/'` behaves like whitespace).

All the tag names are converted to lower case.

## Openning Tags

Start with a `'<'` followed by a [tag name](#tag-names) or the character `'!'` that signals the start of a [comment](#comments), `DOCTYPE` or `CDATA` declaration (last two are parsed as comments).

Against the html5 specs, tags ending with `'/>'` are preserved as self-closing tags (the builder must handle this).

## Closing tags

They are included in the output, except for void or self-closing tags, and its name include the first slash.

## Attributes

Accepts all characters as the tag names and more.

An equal sign (`'='`) separates the name of the value. If there's no name, this `'='` is the first character of the name (yes). The value can be empty.

One or more slashes (`'/'`) behaves like whitespace. In the name, the slash splits the name generating two attributes, even if the name was quoted.

The first `>` anywhere in the openning tag ends the attribute list, except if this is in a quoted value.

All attribute names are converted to lowercase and the unquoted values are trimmed.

## Comments

Must start with `'<!--'`. The next following `'-->'` or the end of file ends the comment.

Comments in short notation, starting with `'<!'` (without `'--'`), ends at the first `'>'`.

By default, comments are discarted.

## Expressions

Expressions may be contained in attribute values or text nodes.
The default delimiters are `'{'` and `'}'`.

There may be more tan one expression as part of one attribute value or text node, or only one replacing the entire value or node.

When used as the whole attribute value, there's no need to enclose the expression inside quotes, even if the expression contains whitespace.

Single and double quotes can be nested inside the expression.

To emit opening (left) brackets as literal text wherever an opening bracket is expected, the bracket must be prefixed with a backslash (the JS escape char `'\'`).
This character is preserved in the output, but the parser will add a `replace` property for the attribute or node containing the escaped bracket, whose value is the bracket itself.

## Options

* `comments` - Pass `true` to preserve the comments.
* `brackets` - Array of two string with the left/right brackets used to extract expressions.

[travis-image]:https://img.shields.io/travis/riot/parser.svg?style=flat-square
[travis-url]:https://travis-ci.org/riot/parser

[license-image]:http://img.shields.io/badge/license-MIT-000000.svg?style=flat-square
[license-url]:LICENSE.txt

[npm-version-image]:http://img.shields.io/npm/v/@riotjs/parser.svg?style=flat-square
[npm-downloads-image]:http://img.shields.io/npm/dm/@riotjs/parser.svg?style=flat-square
[npm-url]:https://npmjs.org/package/@riotjs/parser

[coverage-image]:https://img.shields.io/coveralls/riot/parser/master.svg?style=flat-square
[coverage-url]:https://coveralls.io/r/riot/parser/?branch=master

[codeclimate-image]:https://api.codeclimate.com/v1/badges/5db4f1c96a43e3736cf0/maintainability
[codeclimate-url]:https://codeclimate.com/github/riot/parser

