
const fn = require('../')
const _T = fn().nodeTypes

module.exports = {

  'needs a root tag': {
    data: 'This is the text',
    throws: 'not found'
  },

  'simple tag': {
    data: '<div></div>',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 5 },
      { type: _T.TAG, name: '/div', start: 5, end: 11 }
    ]
  },

  'simple self-closing tag': {
    data: '<div/>',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 6, selfclose: true }
    ]
  },

  'text before root tag is discarted': {
    data: 'xxx<div/>',
    expected: [
      { type: _T.TAG, name: 'div', start: 3, end: 9, selfclose: true }
    ]
  },

  'text after root tag is discarted': {
    data: '<div/>xxx',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 6, selfclose: true }
    ]
  },

  'text inside tag': {
    data: '<div>xxx</div>',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 5 },
      { type: _T.TEXT, start: 5, end: 8 },
      { type: _T.TAG, name: '/div', start: 8, end: 14 }
    ]
  },

  'tag with multiple attributes': {
    data: '<div a="1" b=2/>',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 16, selfclose: true, attributes: [
        { name: 'a', value: '1', start: 5, end: 10, valueStart: 8 },
        { name: 'b', value: '2', start: 11, end: 14, valueStart: 13 }
      ] },
    ]
  },

  'root with multiple attributes, trailing text': {
    data: '<div a=1 b="2"/>xxx',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 16, selfclose: true, attributes: [
        { name: 'a', value: '1', start: 5, end: 8, valueStart: 7 },
        { name: 'b', value: '2', start: 9, end: 14, valueStart: 12 }
      ] }
    ]
  },

  'tag with mixed attributes #1': {
    data: '<div a=1 b=\'2\' c="3"></div>',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 21, attributes: [
        { name: 'a', value: '1', start: 5, end: 8, valueStart: 7 },
        { name: 'b', value: '2', start: 9, end: 14, valueStart: 12 },
        { name: 'c', value: '3', start: 15, end: 20, valueStart: 18 }
      ] },
      { type: _T.TAG, name: '/div', start: 21, end: 27 }
    ]
  },

  'tag with mixed attributes #2': {
    data: '<div a=1 b="2" c=\'3\' />',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 23, selfclose: true, attributes: [
        { name: 'a', value: '1', start: 5, end: 8, valueStart: 7 },
        { name: 'b', value: '2', start: 9, end: 14, valueStart: 12 },
        { name: 'c', value: '3', start: 15, end: 20, valueStart: 18 }
      ] }
    ]
  },

  'tag with mixed attributes #3': {
    data: '<div a=\'1\' b=2 data-c = "3"/>',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 29, selfclose: true, attributes: [
        { name: 'a', value: '1', start: 5, end: 10, valueStart: 8 },
        { name: 'b', value: '2', start: 11, end: 14, valueStart: 13 },
        { name: 'data-c', value: '3', start: 15, end: 27, valueStart: 25 }
      ] }
    ]
  },

  'tag with mixed attributes #4': {
    data: '<div a=\'1\' b="2" c=3/>',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 22, selfclose: true, attributes: [
        { name: 'a', value: '1', start: 5, end: 10, valueStart: 8 },
        { name: 'b', value: '2', start: 11, end: 16, valueStart: 14 },
        { name: 'c', value: '3', start: 17, end: 20, valueStart: 19 }
      ] }
    ]
  },

  'tag with mixed attributes #6': {
    data: '<div a="1" b=\'2\' c="3"/>',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 24, selfclose: true, attributes: [
        { name: 'a', value: '1', start: 5, end: 10, valueStart: 8 },
        { name: 'b', value: '2', start: 11, end: 16, valueStart: 14 },
        { name: 'c', value: '3', start: 17, end: 22, valueStart: 20 }
      ] }
    ]
  },

  'empty tags with comment inside parsed as attributes': {
    data: '<a><br <!-- comment -->></a>',
    expected: [
      { type: _T.TAG,  name: 'a', start: 0, end: 3 },
      { type: _T.TAG,  name: 'br', start: 3, end: 23, attributes: [
        { name: '<!--', value: '', start: 7, end: 11 },
        { name: 'comment', value: '', start: 12, end: 19 },
        { name: '--', value: '', start: 20, end: 22 }
      ] },
      { type: _T.TEXT, start: 23, end: 24 },
      { type: _T.TAG, name: '/a', start: 24, end: 28 }
    ]
  },

  'root tag with mixed attributes': {
    data: '<div a=1 b=\'2\' c="3"/>',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 22, selfclose: true, attributes: [
        { name: 'a', value: '1', start: 5, end: 8, valueStart: 7 },
        { name: 'b', value: '2', start: 9, end: 14, valueStart: 12 },
        { name: 'c', value: '3', start: 15, end: 20, valueStart: 18 }
      ] }
    ]
  },

  'multiline attribute #1': {
    data: "<div id='\nxxx\nyyy\n'/>",
    expected: [
      { type: _T.TAG,  name: 'div', start: 0, end: 21, selfclose: true, attributes: [
        { name: 'id', value: '\nxxx\nyyy\n', start: 5, end: 19, valueStart: 9 }
      ] }
    ]
  },

  'multiline attribute #2': {
    data: '<div id="\nxxx\nyyy\n"/>',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 21, selfclose: true, attributes: [
        { name: 'id', value: '\nxxx\nyyy\n', start: 5, end: 19, valueStart: 9 }
      ] }
    ]
  },

  'self closing tag': {
    data: '<div/>',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 6, selfclose: true }
    ]
  },

  'self closing tag, trailing text ignored': {
    data: '<div/>xxx',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 6, selfclose: true }
    ]
  },

  'self closing tag with spaces #1': {
    data: '<div />',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 7, selfclose: true }
    ]
  },

  'self closing tag with spaces #2': {
    data: '<div/ >',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 7, selfclose: true }
    ]
  },

  'self closing tag with spaces #3': {
    data: '<div\n / >',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 9, selfclose: true }
    ]
  },

  'self closing tag with spaces, trailing text ignored': {
    data: '<div / >xxx',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 8, selfclose: true }
    ]
  },

  'self closing tag with unquoted attribute': {
    data: '<div a=b/>',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 10, selfclose: true, attributes: [
        { name: 'a', value: 'b', start: 5, end: 8, valueStart: 7 }
      ] }
    ]
  },

  'self closing tag with space after unquoted attribute value': {
    data: '<div a=b />',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 11, selfclose: true, attributes: [
        { name: 'a', value: 'b', start: 5, end: 8, valueStart: 7 }
      ] }
    ]
  },

  'self closing tag with quoted attribute': {
    data: '<div a="b"/>',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 12, selfclose: true, attributes: [
        { name: 'a', value: 'b', start: 5, end: 10, valueStart: 8 }
      ] }
    ]
  },

  'self closing tag with new line after quoted attribute value': {
    data: "<div a='b'\n/>",
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 13, selfclose: true, attributes: [
        { name: 'a', value: 'b', start: 5, end: 10, valueStart: 8 }
      ] }
    ]
  },

  'root tag with attribute': {
    data: '<div a=b ></div>',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 10, attributes: [
        { name: 'a', value: 'b', start: 5, end: 8, valueStart: 7 }
      ] },
      { type: _T.TAG, name: '/div', start: 10, end: 16 }
    ]
  },

  'nested self closing tag with attribute': {
    data: '<div><a a=b/></div>',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 5 },
      { type: _T.TAG, name: 'a', start: 5, end: 13, selfclose: true, attributes: [
        { name: 'a', value: 'b', start: 8, end: 11, valueStart: 10 }
      ] },
      { type: _T.TAG, name: '/div', start: 13, end: 19 }
    ]
  },

  'attribute missing closing quote ignoring tags': {
    data: '<div a="1><span id="foo"/></div>',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 26, selfclose: true, attributes: [
        { name: 'a', value: '1><span id=', start: 5, end: 20, valueStart: 8 },
        { name: 'foo"', value: '', start: 20, end: 24 }
      ] }
    ]
  },

  'nested tags': {
    data: '<div><span></span></div>',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 5 },
      { type: _T.TAG, name: 'span', start: 5, end: 11 },
      { type: _T.TAG, name: '/span', start: 11, end: 18 },
      { type: _T.TAG, name: '/div', start: 18, end: 24 }
    ]
  },

  'nested tags with attributes': {
    data: '<div aaa="bbb"><span 123=\'456\'>xxx</span></div>',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 15, attributes: [
        { name: 'aaa', value: 'bbb', start: 5, end: 14, valueStart: 10 }
      ] },
      { type: _T.TAG, name: 'span', start: 15, end: 31, attributes: [
        { name: '123', value: '456', start: 21, end: 30, valueStart: 26 }
      ] },
      { type: _T.TEXT, start: 31, end: 34 },
      { type: _T.TAG, name: '/span', start: 34, end: 41 },
      { type: _T.TAG, name: '/div', start: 41, end: 47 }
    ]
  },

  'comments are ignored by default': {
    data: '<div><!-- comment text --></div>',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 5 },
      { type: _T.TAG, name: '/div', start: 26, end: 32 }
    ]
  },

  'comments are preserved with `comments: true`': {
    options: { comments: true },
    data: '<div><!-- comment text --></div>',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 5 },
      { type: _T.COMMENT, start: 5, end: 26 },
      { type: _T.TAG, name: '/div', start: 26, end: 32 }
    ]
  },

  'in html, unhidden CDATA sections are parsed as comments enclosed by `<!>`': {
    options: { comments: true },
    data: '<div><![CDATA[ CData content ]]></div>',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 5 },
      { type: _T.COMMENT, start: 5, end: 32 },
      { type: _T.TAG, name: '/div', start: 32, end: 38 }
    ]
  },

  'CDATA is parsed as comment (<! >), nested `>` breaks the tag': {
    options: { comments: true },
    data: '<![CDATA[ <div>\n  foo\n</div> ]]>',
    throws: 'Unexpected'  // last </div> emit error
  },

  'hidden CDATA (inside comments) becomes simple comment text': {
    options: { comments: true },
    data: '<a><!-- <![CDATA[ content ]]> --></a>',
    expected: [
      { type: _T.TAG, name: 'a', start: 0, end: 3 },
      { type: _T.COMMENT, start: 3, end: 33 },
      { type: _T.TAG, name: '/a', start: 33, end: 37 }
    ]
  },

  'must take html inside comment as simple text': {
    options: { comments: true },
    data: '<a><!-- <div>foo</div> --></a>',
    expected: [
      { type: _T.TAG, name: 'a', start: 0, end: 3 },
      { type: _T.COMMENT, start: 3, end: 26 },
      { type: _T.TAG, name: '/a', start: 26, end: 30 }
    ]
  },

  'parses html5 doctype as comment (so it is ignored)': {
    data: '<!doctype html>\n<html></html>',
    expected: [
      { type: _T.TAG, name: 'html', start: 16, end: 22 },
      { type: _T.TAG, name: '/html', start: 22, end: 29 }
    ]
  },

  'parses doctype as comment (so it is ignored)': {
    options: { comments: true },
    data: '\n<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.org/TR/html4/loose.dtd"><html></html>',
    expected: [
      { type: _T.TAG, name: 'html', start: 103, end: 109 },
      { type: _T.TAG, name: '/html', start: 109, end: 116 }
    ]
  },

  'quotes inside attribute value #1': {
    data: '<div xxx=\'a"b\'/>',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 16, selfclose: true, attributes: [
        { name: 'xxx', value: 'a"b', start: 5, end: 14, valueStart: 10 }
      ] }
    ]
  },

  'quotes inside attribute value #2': {
    data: '<div xxx="a\'b"\n/>',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 17, selfclose: true, attributes: [
        { name: 'xxx', value: 'a\'b', start: 5, end: 14, valueStart: 10 }
      ] }
    ]
  },

  'brackets inside attribute value': {
    data: '<div xxx="</div>"/>',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 19, selfclose: true, attributes: [
        { name: 'xxx', value: '</div>', start: 5, end: 17, valueStart: 10 }
      ] }
    ]
  },

  'unfinished simple tag #1': {
    data: '<div',
    throws: /Unexpected/i
  },

  'unfinished simple tag #2': {
    data: '<div ',
    throws: /Unexpected/i
  },

  'unfinished complex tag #1': {
    data: '<div foo="bar"',
    throws: /Unexpected/i
  },

  'unfinished complex tag #2': {
    data: '<div  foo="bar" ',
    throws: /Unexpected/i
  },

  'unfinished comment #1': {
    data: '<!-- comment text',
    throws: /unclosed comment/i
  },

  'unfinished comment #2': {
    data: '<!-- comment text --',
    throws: /unclosed comment/i
  },

  'unfinished comment #3': {
    data: '<div><!-- comment text </div>',
    throws: /unclosed comment/i
  },

  'unfinished comment #4 (short notation)': {
    data: '<! comment text ',
    throws: /unclosed comment/i
  },

  'unfinished unhidden CDATA becomes an unclosed comment': {
    data: '<![CDATA[ content',
    throws: /unclosed comment/i
  },

  // Chrome discard the whole tag
  'must throw error on unfinished attributes': {
    data: '<div foo="bar',
    throws: /unfinished attribute/i
  },

  // Chrome discard the whole tag
  'must throw error on unfinished attributes #2': {
    data: '<div foo=" </div>',
    throws: /unfinished attribute/i
  },

  'must throw error on unfinished attributes #3': {
    data: '<div foo="bar',
    throws: /unfinished attribute/i
  },

  'whitespace after the tag name is ignored #1': {
    data: '<div\t\n\n  \n\t/>',
    expected: [{ type: _T.TAG, name: 'div', end: 13, selfclose: true }]
  },

  'whitespace after the tag name is ignored #2': {
    data: '<div \n></div \n >',
    expected: [
      { type: _T.TAG, name: 'div', end: 7 },
      { type: _T.TAG, name: '/div', start: 7, end: 16 }
    ]
  },

  'whitespace in closing tag is ignored': {
    data: '<a></a\t\n \n\t>',
    expected: [
      { type: _T.TAG, name: 'a', start: 0, end: 3 },
      { type: _T.TAG, name: '/a', start: 3, end: 12 }
    ]
  },

  // ==========================================================================
  // attributes
  // ==========================================================================

  'attribute with single quotes': {
    data: "<div a='1'/>",
    expected: [
      {
        type: _T.TAG, name: 'div', start: 0, end: 12, selfclose: true, attributes: [
          { name: 'a', value: '1', start: 5, end: 10, valueStart: 8 }
        ]
      },
    ]
  },

  'attribute with double quotes': {
    data: '<div a="\'"/>',
    expected: [
      {
        type: _T.TAG, name: 'div', start: 0, end: 12, selfclose: true, attributes: [
          { name: 'a', value: "'", start: 5, end: 10, valueStart: 8 }
        ]
      }
    ]
  },

  'unquoted attribute value': {
    data: '<div  a=1/>',
    expected: [
      {
        type: _T.TAG, name: 'div', start: 0, end: 11, selfclose: true, attributes: [
          { name: 'a', value: '1', start: 6, end: 9, valueStart: 8 }
        ]
      }
    ]
  },

  'attribute with no value must not include `startValue`': {
    data: '<div wierd/>',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 12, selfclose: true, attributes: [
        { name: 'wierd', value: '', start: 5, end: 10 }
      ] }
    ]
  },

  'attribute with no value, trailing text': {
    data: '<div wierd>xxx</div>',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 11, attributes: [
          { name: 'wierd', value: '', start: 5, end: 10 }
      ] },
      { type: _T.TEXT, start: 11, end: 14 },
      { type: _T.TAG, name: '/div', start: 14, end: 20 }
    ]
  },

  'attributes with empty value': {
    data: '<div foo = ""></div>',
    expected: [
      { type: _T.TAG, name: 'div', end: 14, attributes: [
        { name: 'foo', value: '', start: 5, end: 13, valueStart: 12 }
      ] },
      { type: _T.TAG, name: '/div', start: 14, end: 20 }
    ]
  },

  'attributes with equal sign and no value': {
    data: '<div foo=></div>',
    expected: [
      { type: _T.TAG, name: 'div', end: 10, attributes: [
        { name: 'foo', value: '', start: 5, end: 9 }
      ] },
      { type: _T.TAG, name: '/div', start: 10, end: 16 }
    ]
  },

  'attributes with equal sign and no value #2': {
    data: '<div foo= />',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 12, selfclose: true, attributes: [
        { name: 'foo', value: '', start: 5, end: 10 }
      ] }
    ]
  },

  'attributes with equal sign and no value #3': {
    data: '<div foo= bar=2 =baz=3 />',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 25, selfclose: true, attributes: [
        { name: 'foo', value: 'bar=2', start: 5, end: 15, valueStart: 10 },
        { name: '=baz', value: '3', start: 16, end: 22, valueStart: 21 }
      ] }
    ]
  },

  'attributes with equal sign and no value #4': {
    data: '<div foo= bar="2" baz></div>',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 22, attributes: [
        { name: 'foo', value: 'bar="2"', start: 5, end: 17, valueStart: 10 },
        { name: 'baz', value: '', start: 18, end: 21 }
      ] },
      { type: _T.TAG, name: '/div', start: 22, end: 28 }
    ]
  },

  'whitespace around unquoted attribute values is ignored': {
    data: '<div foo = bar />',
    expected: [
      { type: _T.TAG, name: 'div', end: 17, selfclose: true, attributes: [
        { name: 'foo', value: 'bar', start: 5, end: 14, valueStart: 11 }
      ] }
    ]
  },

  'whitespace after attributes with no value is ignored': {
    data: '<div bar\n />',
    expected: [
      { type: _T.TAG, name: 'div', end: 12, selfclose: true, attributes: [
        { name: 'bar', value: '', start: 5, end: 8 }
      ] }
    ]
  },

  'whitespace inside attribute values is preserved': {
    data: '<div bar="\n"/>',
    expected: [
      { type: _T.TAG, name: 'div', end: 14, selfclose: true, attributes: [
        { name: 'bar', value: '\n', start: 5, end: 12, valueStart: 10 }
      ] }
    ]
  },

  'attributes with tag closing inside quotes': {
    data: '<div some="</div>"></div>',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 19, attributes: [
        { name: 'some', value: '</div>', start: 5, end: 18, valueStart: 11 }
      ] },
      { type: _T.TAG, name: '/div', start: 19, end: 25 }
    ]
  },

  'attributes with quotes in wrong position break the tag': {
    data: '<div some=">"5</div>',
    throws: 'Unexpected'
  },

  'attributes with invalid or non-standard names': {
    data: '<div ~a="" /b --c __d=""/>',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 26, selfclose: true, attributes: [
        { name: '~a', value: '', start: 5, end: 10, valueStart: 9 },
        { name: 'b', value: '', start: 12, end: 13 },
        { name: '--c', value: '', start: 14, end: 17 },
        { name: '__d', value: '', start: 18, end: 24, valueStart: 23 }
      ] }
    ]
  },

  'attributes with `<` in unquoted value': {
    data: '<div some=<</div></div>',
    expected: [
      { type: _T.TAG,  name: 'div', start: 0, end: 17, attributes: [
        { name: 'some', value: '<<', start: 5, end: 12, valueStart: 10 },
        { name: 'div', value: '', start: 13, end: 16 }
      ] },
      { type: _T.TAG, name: '/div', start: 17, end: 23 }
    ]
  },

  'attributes with `>` in unquoted value': {
    data: '<div some=f>oo></div>',
    expected: [
      { type: _T.TAG,  name: 'div', start: 0, end: 12, attributes: [
        { name: 'some', value: 'f', start: 5, end: 11, valueStart: 10 }
      ] },
      { type: _T.TEXT, start: 12, end: 15 },
      { type: _T.TAG, name: '/div', start: 15, end: 21 }
    ]
  },

  'attributes with `/` in unquoted value': {
    data: '<div some=a/c></div>',
    expected: [
      { type: _T.TAG,  name: 'div', start: 0, end: 14, attributes: [
        { name: 'some', value: 'a', start: 5, end: 11, valueStart: 10 },
        { name: 'c', value: '', start: 12, end: 13 }
      ] },
      { type: _T.TAG, name: '/div', start: 14, end: 20 }
    ]
  },

  'attributes with multiple "/" in the name': {
    data: '<div so////me/>',
    expected: [
      { type: _T.TAG,  name: 'div', end: 15, selfclose: true, attributes: [
        { name: 'so', value: '', start: 5, end: 7 },
        { name: 'me', value: '', start: 11, end: 13 }
      ] }
    ]
  },

  'attributes with multiple "/" in the name #2': {
    data: '<div/ so/ // /me ></div>',
    expected: [
      { type: _T.TAG,  name: 'div', end: 18, attributes: [
        { name: 'so', value: '', start: 6, end: 8 },
        { name: 'me', value: '', start: 14, end: 16 }
      ] },
      { type: _T.TAG, name: '/div', start: 18, end: 24 }
    ]
  },

  'attributes with "/" in the value': {
    data: '<div/ some="/"/>',
    expected: [
      { type: _T.TAG,  name: 'div', end: 16, selfclose: true, attributes: [
        { name: 'some', value: '/', start: 6, end: 14, valueStart: 12 }
      ] }
    ]
  },

  'attributes with comment in its value': {
    data: '<div data-a="<!-- comment -->"></div>',
    expected: [
      { type: _T.TAG,  name: 'div', start: 0, end: 31, attributes: [
        { name: 'data-a', value: '<!-- comment -->', start: 5, end: 30, valueStart: 13 }
      ] },
      { type: _T.TAG,  name: '/div', start: 31, end: 37 }
    ]
  },

  'attributes with comment between its name and value': {
    data: '<a data-a=<!-- foo -->"1"></a>',
    expected: [
      {
        type: _T.TAG,  name: 'a', start: 0, end: 22, attributes: [
          { name: 'data-a', value: '<!--', start: 3, end: 14, valueStart: 10 },
          { name: 'foo', value: '', start: 15, end: 18 },
          { name: '--', value: '', start: 19, end: 21 }
        ]
      },
      { type: _T.TEXT, start: 22, end: 26 },
      { type: _T.TAG, name: '/a', start: 26, end: 30 }
    ]
  },

  // ==========================================================================
  // complex tags
  // ==========================================================================

  'multiline complex tag': {
    data: "<div\n  id='foo'\n></div\n \n\t>",
    expected: [
      { type: _T.TAG, name: 'div', end: 17, attributes: [
        { name: 'id', value: 'foo', start: 7, end: 15, valueStart: 11 }
      ] },
      { type: _T.TAG, name: '/div', start: 17, end: 27 }
    ]
  },

  'must keep multiline comment': {
    options: { comments: true },
    data: '<a><!--\ncomment text\n--></a>',
    expected: [
      { type: _T.TAG, name: 'a', start: 0, end: 3 },
      { type: _T.COMMENT, start: 3, end: 24 },
      { type: _T.TAG, name: '/a', start: 24, end: 28 }
    ]
  },

  'must keep nested `<!--` sequence in comments': {
    options: { comments: true },
    data: '<a><!--\ncomment text\n<!-- --></a>',
    expected: [
      { type: _T.TAG, name: 'a', start: 0, end: 3 },
      { type: _T.COMMENT, start: 3, end: 29 },
      { type: _T.TAG, name: '/a', start: 29, end: 33 },
    ]
  },

  'must end the comment on the first `-->` sequence': {
    options: { comments: true },
    data: '<a><!-- comment text <!--> --></a>',
    expected: [
      { type: _T.TAG, name: 'a', start: 0, end: 3 },
      { type: _T.COMMENT, start: 3, end: 26 },
      { type: _T.TEXT, start: 26, end: 30 },
      { type: _T.TAG, name: '/a', start: 30, end: 34 },
    ]
  },

  'must keep comment with only dashes as content': {
    options: { comments: true },
    data: '<a><!-------></a>',
    expected: [
      { type: _T.TAG, name: 'a', start: 0, end: 3 },
      { type: _T.COMMENT, start: 3, end: 13 },
      { type: _T.TAG, name: '/a', start: 13, end: 17 }
    ]
  },

  'must keep comment with only dashes as content #2': {
    options: { comments: true },
    data: '<a><!-- ----></a>',
    expected: [
      { type: _T.TAG, name: 'a', start: 0, end: 3 },
      { type: _T.COMMENT, start: 3, end: 13 },
      { type: _T.TAG, name: '/a', start: 13, end: 17 }
    ]
  },

  'comment short notation in one line': {
    options: { comments: true },
    data: '<a><! foo ></a>',
    expected: [
      { type: _T.TAG, name: 'a', start: 0, end: 3 },
      { type: _T.COMMENT, start: 3, end: 11 },
      { type: _T.TAG, name: '/a', start: 11, end: 15 }
    ]
  },

  'comment short notation with 2 dashes': {
    options: { comments: true },
    data: '<a><!--></a>',
    expected: [
      { type: _T.TAG, name: 'a', start: 0, end: 3 },
      { type: _T.COMMENT, start: 3, end: 8 },
      { type: _T.TAG, name: '/a', start: 8, end: 12 }
    ]
  },

  'comment short notation multiline': {
    options: { comments: true },
    data: '<a><!\n  foo\n></a>',
    expected: [
      { type: _T.TAG, name: 'a', start: 0, end: 3 },
      { type: _T.COMMENT, start: 3, end: 13 },
      { type: _T.TAG, name: '/a', start: 13, end: 17 }
    ]
  },

  'comment short notation starting with "-"': {
    options: { comments: true },
    data: '<a><!-foo ></a>',
    expected: [
      { type: _T.TAG, name: 'a', start: 0, end: 3 },
      { type: _T.COMMENT, start: 3, end: 11 },
      { type: _T.TAG, name: '/a', start: 11, end: 15 }
    ]
  },

  'comment short notation ending with "--"': {
    options: { comments: true },
    data: '<a><!foo --></a>',
    expected: [
      { type: _T.TAG, name: 'a', start: 0, end: 3 },
      { type: _T.COMMENT, start: 3, end: 12 },
      { type: _T.TAG, name: '/a', start: 12, end: 16 }
    ]
  },

  'comment short notation with dashes inside': {
    options: { comments: true },
    data: '<a><! -- --></a>',
    expected: [
      { type: _T.TAG, name: 'a', start: 0, end: 3 },
      { type: _T.COMMENT, start: 3, end: 12 },
      { type: _T.TAG, name: '/a', start: 12, end: 16 }
    ]
  },

  'ignored comment #1': {
    data: '<p><! -- <p --></p>',
    expected: [
      { type: _T.TAG, name: 'p', start: 0, end: 3 },
      { type: _T.TAG, name: '/p', start: 15, end: 19 },
    ]
  },

  'ignored comment #2': {
    data: '<p><!----></p>',
    expected: [
      { type: _T.TAG,  name: 'p', start: 0, end: 3 },
      { type: _T.TAG,  name: '/p', start: 10, end: 14 }
    ]
  },

  // ==========================================================================
  // <script>
  // ==========================================================================

  'tags in script tag code': {
    data: "<script language='javascript'>\nvar foo = '<bar>xxx</bar>';\n</script>",
    expected: [
      { type: _T.TAG,  name: 'script', start: 0, end: 30, attributes: [
        { name: 'language', value: 'javascript', start: 8, end: 29, valueStart: 18 }
      ] },
      { type: _T.TEXT, start: 30, end: 59 },
      { type: _T.TAG,  name: '/script', start: 59, end: 68 }
    ]
  },

  'closing script tag inside script code breaks the tag': {
    data: '<script language="javascript">\nvar foo = "</script>";\n</script>',
    expected: [
      { type: _T.TAG,  name: 'script', start: 0, end: 30, attributes: [
        { name: 'language', value: 'javascript', start: 8, end: 29, valueStart: 18 }
      ] },
      { type: _T.TEXT, start: 30, end: 42 },
      { type: _T.TAG,  name: '/script', start: 42, end: 51 }
    ]
  },

  'closing script tag <\\/script> in script code works': {
    data: "<script language=javascript>\nvar foo = '<\\/script>';\n</script>",
    expected: [
      { type: _T.TAG,  name: 'script', start: 0, end: 28, attributes: [
        { name: 'language', value: 'javascript', start: 8, end: 27, valueStart: 17 }
      ] },
      { type: _T.TEXT, start: 28, end: 53 },
      { type: _T.TAG,  name: '/script', start: 53, end: 62 }
    ]
  },

  'comments in script tag code are preserved always': {
    data: "<script language='javascript'>\nvar foo = '<!-- xxx -->';\n</script>",
    expected: [
      { type: _T.TAG,  name: 'script', start: 0, end: 30, attributes: [
        { name: 'language', value: 'javascript', start: 8, end: 29, valueStart: 18 }
      ] },
      { type: _T.TEXT, start: 30, end: 57 },
      { type: _T.TAG,  name: '/script', start: 57, end: 66 },
    ]
  },

  'CDATA sections in script tag code are preserved': {
    data: "<script language='javascript'>\nvar foo = '<![CDATA[ xxx ]]>';\n</script>",
    expected: [
      { type: _T.TAG,  name: 'script', end: 30, attributes: [
        { name: 'language', value: 'javascript', start: 8, end: 29, valueStart: 18 }
      ] },
      { type: _T.TEXT, start: 30, end: 62 },
      { type: _T.TAG,  name: '/script', start: 62, end: 71 },
    ]
  },

  'multiline CDATA inside script': {
    data: '<script>\t<![CDATA[\nCData content\n]]>\n</script>',
    expected: [
      { type: _T.TAG, name: 'script', start: 0, end: 8 },
      { type: _T.TEXT, start: 8, end: 37 },
      { type: _T.TAG, name: '/script', start: 37, end: 46 }
    ]
  },

  'html comments in script code are preserved': {
    data: "<script language='javascript'>\n<!--\nvar foo = '<bar>xxx</bar>';\n//-->\n</script>",
    expected: [
      { type: _T.TAG, name: 'script', end: 30, attributes: [
        { name: 'language', value: 'javascript', start: 8, end: 29, valueStart: 18 }
      ] },
      { type: _T.TEXT, start: 30, end: 70 },
      { type: _T.TAG, name: '/script', start: 70, end: 79 },
    ]
  },

  'cdata within script tag is preserved': {
    data: "<script language='javascript'>\n<![CDATA[\nvar foo = '<bar>xxx</bar>';\n]]>\n</script>",
    expected: [
      { type: _T.TAG, name: 'script', end: 30, attributes: [
        { name: 'language', value: 'javascript', start: 8, end: 29, valueStart: 18 }
      ] },
      { type: _T.TEXT, start: 30, end: 73 },
      { type: _T.TAG, name: '/script', start: 73, end: 82 },
    ]
  },

  // ==========================================================================
  // unexpected characters
  // ==========================================================================

  "character '<' inside text": {
    data: '<div>text < text</div>',
    expected: [
      { type: _T.TAG, name: 'div', end: 5 },
      { type: _T.TEXT, start: 5, end: 16 },
      { type: _T.TAG, name: '/div', start: 16, end: 22 }
    ]
  },

  "character '<' inside text #2": {
    data: '<<div><<div><< </div><</div>',
    expected: [
      { type: _T.TAG, name: 'div', start: 1, end: 6 },
      { type: _T.TEXT, start: 6, end: 7 },
      { type: _T.TAG, name: 'div', start: 7, end: 12 },
      { type: _T.TEXT, start: 12, end: 15 },
      { type: _T.TAG, name: '/div', start: 15, end: 21 },
      { type: _T.TEXT, start: 21, end: 22 },
      { type: _T.TAG, name: '/div', start: 22, end: 28 }
    ]
  },

  "character '<' and '>' before tag": {
    data: '<a><<div></div><<><div>></a>',
    expected: [
      { type: _T.TAG, name: 'a', start: 0, end: 3 },
      { type: _T.TEXT, start: 3, end: 4 },
      { type: _T.TAG, name: 'div', start: 4, end: 9 },
      { type: _T.TAG, name: '/div', start: 9, end: 15 },
      { type: _T.TEXT, start: 15, end: 18 },
      { type: _T.TAG, name: 'div', start: 18, end: 23 },
      { type: _T.TEXT, start: 23, end: 24 },
      { type: _T.TAG, name: '/a', start: 24, end: 28 }
    ]
  },

  "sequence '<!DOCTYPE ' inside text is a comment": {
    data: '<div>text <!DOCTYPE html></div>',
    expected: [
      { type: _T.TAG, name: 'div', end: 5 },
      { type: _T.TEXT, start: 5, end: 10 },
      { type: _T.TAG, name: '/div', start: 25, end: 31 }
    ]
  },

  // =========================================================================
  // Case normalization
  // =========================================================================

  'tag names must be lowercased': {
    data: '<diV/>',
    expected: [{ type: _T.TAG, name: 'div', start: 0, end: 6, selfclose: true }]
  },

  'tag names must be lowercased #2': {
    data: '<A></A>',
    expected: [
      { type: _T.TAG, name: 'a', start: 0, end: 3 },
      { type: _T.TAG, name: '/a', start: 3, end: 7 }
    ]
  },

  'attribute names must be lowercased': {
    data: '<div dAta-xX="Yyy"/>',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 20, selfclose: true, attributes: [
        { name: 'data-xx', value: 'Yyy', start: 5, end: 18, valueStart: 14 }
      ] }
    ]
  },

  'attribute names must be lowercased #2': {
    data: '<div xXx="Yyy" XXX=yyY/>',
    expected: [
      { type: _T.TAG, name: 'div', start: 0, end: 24, selfclose: true, attributes: [
        { name: 'xxx', value: 'Yyy', start: 5, end: 14, valueStart: 10 },
        { name: 'xxx', value: 'yyY', start: 15, end: 22, valueStart: 19 }
      ] }
    ]
  },

  // =========================================================================
  // Line ending
  // =========================================================================

  'must normalize windows line-endings': {
    data: '<div\r\n  foo\r\n>\r\n\r\n</div>\r\n',
    expected: [
      { type: _T.TAG,  name: 'div', end: 14, attributes: [
        { name: 'foo', value: '', start: 8, end: 11 }
      ] },
      { type: _T.TEXT, start: 14, end: 18 },
      { type: _T.TAG,  name: '/div', start: 18, end: 24 }
    ]
  },

  'must normalize mac line-endings': {
    data: '<div\r  foo\r>\r\r</div>\r',
    expected: [
      { type: _T.TAG,  name: 'div', end: 12, attributes: [
        { name: 'foo', value: '', start: 7, end: 10 }
      ] },
      { type: _T.TEXT, start: 12, end: 14 },
      { type: _T.TAG,  name: '/div', start: 14, end: 20 }
    ]
  },

  'must normalize mixed line-endings': {
    data: '\n<div\r  foo\r\n>\r\r\n\n</div>\n\n\r',
    expected: [
      { type: _T.TAG,  name: 'div', start: 1, end: 14, attributes: [
        { name: 'foo', value: '', start: 8, end: 11 }
      ] },
      { type: _T.TEXT, start: 14, end: 18 },
      { type: _T.TAG,  name: '/div', start: 18, end: 24 }
    ]
  }

}
