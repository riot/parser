export declare const enum NodeTypes {
  TAG = 1,
  ATTR = 2,
  TEXT = 3,
  CDATA = 4,
  COMMENT = 8,
  DOCUMENT = 9,
  DOCTYPE = 10,
  DOCUMENT_FRAGMENT = 11,
}

export type Position = {
  start: number
  end: number
}

export type Expression = Position & {
  text: string
}

export type ExpressionContainer = {
  expressions?: Expression[]
  unescape?: string
  parts?: string[]
}

export type Attribute = Position &
  ExpressionContainer & {
    name: string
    value: string
    valueStart?: number
  }

export type Node = Position & {
  type: NodeTypes
}

export type TagNode = Node & {
  type: NodeTypes.TAG
  name: string
  isRaw?: boolean
  isCustom?: boolean
  isVoid?: boolean
  attributes?: Attribute[]
  selfclose?: boolean
}

export type CommentNode = Node & {
  type: NodeTypes.COMMENT
}

export type TextNode = Node &
  ExpressionContainer & {
    type: NodeTypes.TEXT
    text: string
  }

export type ParsedNode = TagNode | TextNode | CommentNode

export type ParserOutput = {
  javascript: ScriptNode | null
  css: StyleNode | null
  template: TemplateNode | null
}

type TreeBuilder = {
  get(): ParserOutput
  push(node: ParsedNode): void
}

export type ParserOptions = {
  brackets?: [string, string]
  comments?: boolean
  compact?: boolean
}

export type ParserResult = {
  data: string
  output: ParserOutput
}

export type RiotNode = TemplateNode | TextNode | ScriptNode | StyleNode

export type TemplateNode = TagNode & {
  nodes?: RiotNode[]
}

export type ScriptNode = TagNode & {
  name: 'script'
  text?: TextNode
}

export type StyleNode = TagNode & {
  name: 'style'
  text?: TextNode
}

export default function parser(
  options: ParserOptions,
  treeBuilder?: TreeBuilder,
): {
  parse: (data: string) => ParserResult
}
