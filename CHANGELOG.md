# Changes for riot-parser

### v4.3.1
- Improve the inline `<script>` tags check

### v4.3.0
- Add support for inline script tags (`<script src='path/to/the/script'>`)

### v4.2.1
- Fix make sure comments nodes will be generated via tree builder

### v4.2.0
- Add the extraction of comment nodes text
- Fix https://github.com/riot/riot/issues/2836

### v4.1.2
- Update generated bundle fixing discrepancy between source files and bundled output

### v4.1.1
- Fix end value of the root node

### v4.1.0
- Add expose the internal constants to the public API

### v4.0.3
- Fix https://github.com/riot/riot/issues/2723 for real this time

### v4.0.2
- Fix parsing of nested svg nodes https://github.com/riot/riot/issues/2723

### v4.0.1
- Fix the creation of the `parts` array in nodes containing expressions

### v4.0.0
- Stable release
- Add more tests for the new feautures listed below

### v4.0.0-rc.2
- Fix: support spread attributes together with other attribute expressions on the same DOM node

### v4.0.0-rc.1
- Fix https://github.com/riot/riot/issues/2679
- Add support for `<a {href}>` expression attributes shortcuts

### v0.8.1
- Add the `src` folder to the npm publishing files

### v0.8.0
- Add support for the spread attributes `<a {...foo.bar}>`
- Fixed the `isCustom` boolean that will be added also to the root nodes

### v0.6.9
- Remove the unecessary PUBLIC_JAVASCRIPT and PRIVATE_JAVASCRIPT nodes

### v0.5.0
- Remove the the useless prefix option
- Improve the coverage
- Improve the quality of the source code

### v0.4.0
- Add the [`dom-nodes`](https://github.com/riot/dom-nodes) dependecy to improve the output
- Add the `isCustom`, `isBoolean`, `isVoid`, `isSelfClosing` and `isRaw` boolean node attributes

### v0.3.0
- Fix treeBuilder issues
- Improve coverage
- Improve code maintainability

### v0.2.0
- Add `voidTags` to the exports

### v0.1.0
- Enhance the javascript parsing: the javascript node will contain nested nodes containing the private and the public javascript methods
- Add the PUBLIC_JAVASCRIPT and PRIVATE_JAVASCRIPT nodes
- Change the `attr` to `attributes` and `expr` to `expressions` keys

### v0.0.6
- Tree-builder support for 'if/else/elseif' tags (avoid unexpected closing tag errors).
- Fix to text nodes only escaping the fist block of whitespace.

### v0.0.5
- Now, attribute names are lowercased in the builder, only for empty namespaces (i.e. not svg).

### v0.0.4
- Included TEXTAREA as special tag that can contain only raw text and expressions.
- For SVG tags, now the `ns` property is the full URI http://www.w3.org/2000/svg.
- The `children` property of TAGs is renamed to `nodes`.

### v0.0.3
- The default builder is integrated in this module and injected in the parser.
- Only two versions, node CommonJS (transpiled to ES5) and ES6 modules (untranspiled).
- The `nodeTypes` property of TagParser is removed, now is in a separated submodule.
- Exposing `skipES6TL` to skip ES6 Template Literals.
- Reduction of code size, `skipRegex` is imported from npm.
- Source files (ES6) are moved to the "lib/" directory.
- Remove dependency on `Object.assign`.
- Updated devDependencies.

### v0.0.2 (UNPUBLISHED)
- Added suport for SVG en the tests.
- Added test/builder/tree-builder2.js as sample.
- Support for self-closing script/style tags.
- The `replace` property of attributes and text is discarded and there's a new property `unescape` is an array containing the positions of the escape characters (relative to the whole buffer).
- Matching literal regexes is a bit faster now.
- Fixes incorrect regex that matches literal regexes.

### v0.0.1
- First public release

# TODO
- Support for case sensitive properties in SVG elements.
