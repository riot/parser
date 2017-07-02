# Changes for riot-parser

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
