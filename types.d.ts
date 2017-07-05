declare const enum NodeTypes {
  TAG = 1,
  ATTR = 2,
  TEXT = 3,
  CDATA = 4,
  COMMENT = 8,
  DOCUMENT = 9,
  DOCTYPE = 10,
  DOCUMENT_FRAGMENT = 11,
}

interface Hash<T> {
  [x: string]: T
}

interface HasExpr {
  expr?: RawExpr[]
  unescape?: string
  parts?: any[]
}

interface Locatable {
  start: number
  end: number
}

interface RawNode extends Locatable {
  type: NodeTypes,
}

interface RawTag extends RawNode {
  type: NodeTypes.TAG
  name: string
  attr?: RawAttr[]
  selfclose?: boolean
}

interface RawCmnt extends RawNode {
  type: NodeTypes.COMMENT
}

interface RawText extends RawNode, HasExpr {
  type: NodeTypes.TEXT
  text: string
}

interface RawAttr extends Locatable, HasExpr {
  name: string
  value: string
  valueStart?: number
}

interface RawExpr extends Locatable {
  text: string
  prefix?: string
}

declare type ParsedNode = RawTag | RawText | RawCmnt

//----------------------------------------------------------------------------
// Builder

interface TreeBuilderOptions {
  compact?: boolean
}

interface ITreeBuilder {
  get(): any
  push(node: ParsedNode): void
}

interface TreeBuilderFactory {
  (data: string, options: TreeBuilderOptions): ITreeBuilder
}

//----------------------------------------------------------------------------
// Parser

interface ParserOptions {
  brackets: [string, string]
  comments?: boolean
  compact?: boolean
}

interface ParserResult {
  data: string
  output: any
}

interface ITagParser {
  parse: (data: string, start?: number) => ParserResult
}

//---------------------------------------------------------------------
// Node types of TreeBuilder

declare type RiotNode = NodeTag | NodeText | NodeScryle

interface NodeTag extends RawTag {
  nodes?: RiotNode[]
  void?: boolean
  raw?: boolean
  ns?: string
}

interface NodeScryle extends RawTag {
  name: 'script' | 'style'
  text?: RawText
}

interface NodeText extends RawText {
}
