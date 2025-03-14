import parser, { ParserOutput, ScriptNode, StyleNode } from '../'
import boxJson from './expected/box.json'
import commentsAndExpessiosJson from './expected/comments-and-expressions.json'
import es6NestedRegexJson from './expected/es6-nested-regex.json'
import historyRouterAppJson from './expected/history-router-app.json'
import loopSvgNodesJson from './expected/loop-svg-nodes.json'
import svgLoaderJson from './expected/svg-loader.json'
import textFragsJson from './expected/text-frags.json'

// The following patched are needed due to https://github.com/microsoft/TypeScript/issues/32063

type PatchedScriptNode = Omit<ScriptNode, 'name'> & {
  name: string
}

type PatchedStyleNode = Omit<StyleNode, 'name'> & {
  name: string
}

type PatchedParserOutput = Omit<ParserOutput, 'css' | 'javascript'> & {
  css: PatchedStyleNode | null
  javascript: PatchedScriptNode | null
}

const boxParsedOutput = boxJson satisfies PatchedParserOutput
const commendAndExpressionsOuput =
  commentsAndExpessiosJson satisfies PatchedParserOutput
const es6NestedRegexOutput = es6NestedRegexJson satisfies PatchedParserOutput
const historyRouterAppOutput =
  historyRouterAppJson satisfies PatchedParserOutput
const loopSvgNodesOutput = loopSvgNodesJson satisfies PatchedParserOutput
const svgLoaderOutput = svgLoaderJson satisfies PatchedParserOutput
const textFragsOutput = textFragsJson satisfies PatchedParserOutput

const { parse } = parser({
  brackets: ['${', '}'],
})

const { data, output } = parse('<p>${greeting}</p>')
