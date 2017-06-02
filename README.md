# parser

Minimal, loose html parser for Riot tags

This parser is a low-level tool that builds a simple array of objects with information about the given html fragment, readed secuencially. It is designed to parse one single tag and not entire html pages, the tag closing the root element ends the parsing.

There 3 main node types:

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

## Pseudo-node structure

#### Tags

Sample markup:

```html
<div data-str="Hi { "world" }">{ text }<br></div>
```

Sample output:

```js
[
  {
    type: TAG,
    name: 'div',              // element name, closing tags are prefixed with a slash
    start: 0,                 // start position of the tag (the character `<`)
    end: 31,                  // ending position (character following the `>`)
    attributes: [             // tag attributes of opening tags, missed if tag has no attributes
      name: 'data-str',       // attribute name, always lowercased
      value: 'hi',            // attribute value without quotes, trimmed for unquoted values.
      start: 5,               // start position of the attribute name
      end: 30                 // ending position + 1 of the attribute
      valueStart: 15,         // start of the value, initial quote skipped
      expressions: [          // array of expressions, missed if the attribue has no expressions
        {
          text: ' world ',    // text of the expression without brackets
          start: 18,          // starting position, including left brackets
          end: 29             // ending position (character following the closing bracket)
        }
      ]
    ]
  },
  {
    type: TEXT,
    value: '{ text }',
    start: 31,
    end: 39,
    expressions: [
      text: ' text '
      start: 31,
      end: 39
    ]
  },
  {
    type: TAG,
    name: 'br',
    start: 39,
    end: 43,
  },
  {
    type: TAG,
    name: '/div',
    start: 43,
    end: 49,
  }
]
```
