import * as vscode from 'vscode'

/**
 * A grammar
 */
export interface IGrammar {
  /**
   * Tokenize `lineText` using previous line state `prevState`.
   */
  tokenizeLine(lineText: string, prevState: StackElement): ITokenizeLineResult;
}
export interface ITokenizeLineResult {
  readonly tokens: IToken[];
  /**
   * The `prevState` to be passed on to the next line tokenization.
   */
  readonly ruleStack: StackElement;
}
export interface IToken {
  startIndex: number;
  readonly endIndex: number;
  readonly scopes: string[];
}
/**
 * **IMPORTANT** - Immutable!
 */
export interface StackElement {
  equals(other: StackElement): boolean;
}


export interface Token {
  range: vscode.Range,
  text: string,
  scopes: string[];
}

export interface ScopeInfoAPI {
  getScopeAt(document: vscode.TextDocument, position: vscode.Position) : Token|null;
  getGrammar(scopeName: string) : Promise<IGrammar|null>;
  getScopeForLanguage(language: string) : string|null;
}